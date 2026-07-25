"""NCBI E-utilities クライアント。

NCBI規約への対応:
  - 全リクエストに tool= と email= を付与する
  - APIキーありで10req/秒、なしで3req/秒を超えない(実効レートは上限より少し下)
  - 429/5xx は指数バックオフでリトライする
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

RETRYABLE_STATUS = {429, 500, 502, 503, 504}

# esearch 1回あたりの取得上限。週次(reldate=10)なら1回で収まるが、
# backfill 用にページングも実装する。
ESEARCH_PAGE_SIZE = 1000
# efetch 1回あたりのPMID数。NCBIは大量IDでのPOSTを推奨。
EFETCH_BATCH_SIZE = 200
# 暴走防止の上限。
MAX_TOTAL_RESULTS = 50000


class EUtilsError(Exception):
    pass


class RateLimiter:
    """最短間隔を保証する単純なレートリミッタ。"""

    def __init__(self, per_second, sleep=time.sleep, clock=time.monotonic):
        if per_second <= 0:
            raise ValueError("per_second must be > 0")
        self.min_interval = 1.0 / per_second
        self._sleep = sleep
        self._clock = clock
        self._last = None

    def wait(self):
        now = self._clock()
        if self._last is not None:
            elapsed = now - self._last
            if elapsed < self.min_interval:
                self._sleep(self.min_interval - elapsed)
        self._last = self._clock()


class EUtilsClient:
    def __init__(
        self,
        tool,
        email,
        api_key=None,
        rate_per_second=2.8,
        timeout=30,
        max_retries=4,
        opener=None,
        sleep=time.sleep,
    ):
        if not email:
            raise EUtilsError("NCBI規約により email は必須です。")
        self.tool = tool
        self.email = email
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self.limiter = RateLimiter(rate_per_second, sleep=sleep)
        self._opener = opener or urllib.request.urlopen
        self._sleep = sleep

    # -- 内部 ---------------------------------------------------------------
    def _base_params(self):
        params = {"db": "pubmed", "tool": self.tool, "email": self.email}
        if self.api_key:
            params["api_key"] = self.api_key
        return params

    def _request(self, endpoint, params, use_post=False):
        url = f"{BASE_URL}/{endpoint}"
        encoded = urllib.parse.urlencode(params, doseq=True)
        headers = {"User-Agent": f"{self.tool} (mailto:{self.email})"}

        last_error = None
        for attempt in range(self.max_retries + 1):
            self.limiter.wait()
            try:
                if use_post:
                    request = urllib.request.Request(
                        url, data=encoded.encode("utf-8"), headers=headers
                    )
                else:
                    request = urllib.request.Request(f"{url}?{encoded}", headers=headers)
                with self._opener(request, timeout=self.timeout) as response:
                    return response.read().decode("utf-8", errors="replace")
            except urllib.error.HTTPError as exc:
                last_error = exc
                if exc.code not in RETRYABLE_STATUS or attempt == self.max_retries:
                    raise EUtilsError(
                        f"{endpoint} がHTTP {exc.code}を返しました: {exc.reason}"
                    ) from exc
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                last_error = exc
                if attempt == self.max_retries:
                    raise EUtilsError(f"{endpoint} への接続に失敗しました: {exc}") from exc
            # 指数バックオフ (1s, 2s, 4s, 8s ...)
            self._sleep(2 ** attempt)

        raise EUtilsError(f"{endpoint} が失敗しました: {last_error}")

    # -- 公開API ------------------------------------------------------------
    def esearch(self, term, reldate=None, datetype="edat", mindate=None, maxdate=None):
        """検索式にマッチするPMIDを全件返す。

        reldate を渡すと「直近N日」、mindate/maxdate を渡すと期間指定になる。
        """
        collected = []
        total = None
        retstart = 0

        while True:
            params = self._base_params()
            params.update(
                {
                    "term": term,
                    "retmode": "json",
                    "retmax": ESEARCH_PAGE_SIZE,
                    "retstart": retstart,
                    "datetype": datetype,
                }
            )
            if reldate is not None:
                params["reldate"] = reldate
            if mindate is not None:
                params["mindate"] = mindate
            if maxdate is not None:
                params["maxdate"] = maxdate

            raw = self._request("esearch.fcgi", params)
            try:
                payload = json.loads(raw)
                result = payload["esearchresult"]
            except (ValueError, KeyError) as exc:
                raise EUtilsError(f"esearch の応答を解釈できませんでした: {exc}") from exc

            if "ERROR" in result:
                raise EUtilsError(f"esearch がエラーを返しました: {result['ERROR']}")

            if total is None:
                total = int(result.get("count", 0))
            page = result.get("idlist", [])
            collected.extend(page)

            if not page or len(collected) >= min(total, MAX_TOTAL_RESULTS):
                break
            retstart += ESEARCH_PAGE_SIZE

        return {"count": total, "pmids": collected}

    def efetch_xml(self, pmids):
        """PMIDのリストをefetchし、XML文字列のリスト(バッチごと)を返す。

        バッチ単位で失敗を切り分けられるよう、成功XMLと失敗PMIDを分けて返す。
        """
        documents = []
        failed = []

        for index in range(0, len(pmids), EFETCH_BATCH_SIZE):
            batch = pmids[index : index + EFETCH_BATCH_SIZE]
            params = self._base_params()
            params.update({"id": ",".join(batch), "retmode": "xml"})
            try:
                documents.append(self._request("efetch.fcgi", params, use_post=True))
            except EUtilsError as exc:
                # 取得失敗は握りつぶさず、対象PMIDと理由を呼び出し元へ返す。
                failed.append({"pmids": batch, "reason": str(exc)})

        return {"documents": documents, "failed": failed}
