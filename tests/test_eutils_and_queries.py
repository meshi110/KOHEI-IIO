"""ネットワークに出ずに、規約順守まわりの挙動を検証する。"""

import io
import json
import unittest
import urllib.error
import urllib.parse

from arthroplasty_watch.eutils import EUtilsClient, EUtilsError, RateLimiter
from arthroplasty_watch import queries


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
        return False


class RecordingOpener:
    """urlopen の差し替え。リクエストを記録し、決められた応答を返す。"""

    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def __call__(self, request, timeout=None):
        self.requests.append(request)
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return FakeResponse(item.encode("utf-8"))


def esearch_payload(count, pmids):
    return json.dumps({"esearchresult": {"count": str(count), "idlist": pmids}})


def parse_query(request):
    if request.data:
        return urllib.parse.parse_qs(request.data.decode("utf-8"))
    return urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query)


class RateLimiterTest(unittest.TestCase):
    def test_waits_to_respect_rate(self):
        slept = []
        clock = {"t": 0.0}

        limiter = RateLimiter(
            3.0, sleep=lambda s: slept.append(s), clock=lambda: clock["t"]
        )
        limiter.wait()  # 1回目は待たない
        self.assertEqual(slept, [])
        limiter.wait()  # 時間が進んでいないので約1/3秒待つ
        self.assertEqual(len(slept), 1)
        self.assertAlmostEqual(slept[0], 1 / 3, places=6)

    def test_no_wait_when_enough_time_passed(self):
        slept = []
        clock = {"t": 0.0}
        limiter = RateLimiter(
            3.0, sleep=lambda s: slept.append(s), clock=lambda: clock["t"]
        )
        limiter.wait()
        clock["t"] = 10.0
        limiter.wait()
        self.assertEqual(slept, [])


class EUtilsClientTest(unittest.TestCase):
    def _client(self, opener, **kwargs):
        kwargs.setdefault("rate_per_second", 1000)
        return EUtilsClient(
            tool="arthroplasty-watch",
            email="test@example.com",
            opener=opener,
            sleep=lambda s: None,
            **kwargs,
        )

    def test_email_is_required(self):
        with self.assertRaises(EUtilsError):
            EUtilsClient(tool="t", email="")

    def test_tool_and_email_sent_on_every_request(self):
        opener = RecordingOpener([esearch_payload(1, ["1"]), "<PubmedArticleSet/>"])
        client = self._client(opener)
        client.esearch("test", reldate=10)
        client.efetch_xml(["1"])

        self.assertEqual(len(opener.requests), 2)
        for request in opener.requests:
            params = parse_query(request)
            self.assertEqual(params["tool"], ["arthroplasty-watch"])
            self.assertEqual(params["email"], ["test@example.com"])

    def test_api_key_included_when_present(self):
        opener = RecordingOpener([esearch_payload(0, [])])
        client = self._client(opener, api_key="secret-key")
        client.esearch("test", reldate=10)
        self.assertEqual(parse_query(opener.requests[0])["api_key"], ["secret-key"])

    def test_api_key_absent_when_not_configured(self):
        opener = RecordingOpener([esearch_payload(0, [])])
        client = self._client(opener)
        client.esearch("test", reldate=10)
        self.assertNotIn("api_key", parse_query(opener.requests[0]))

    def test_esearch_uses_edat_and_reldate(self):
        opener = RecordingOpener([esearch_payload(0, [])])
        client = self._client(opener)
        client.esearch("test", reldate=10)
        params = parse_query(opener.requests[0])
        self.assertEqual(params["datetype"], ["edat"])
        self.assertEqual(params["reldate"], ["10"])

    def test_esearch_supports_date_range(self):
        opener = RecordingOpener([esearch_payload(0, [])])
        client = self._client(opener)
        client.esearch("test", mindate="2020/01/01", maxdate="2026/07/25")
        params = parse_query(opener.requests[0])
        self.assertEqual(params["mindate"], ["2020/01/01"])
        self.assertEqual(params["maxdate"], ["2026/07/25"])
        self.assertNotIn("reldate", params)

    def test_esearch_paginates(self):
        page_one = esearch_payload(1500, [str(i) for i in range(1000)])
        page_two = esearch_payload(1500, [str(i) for i in range(1000, 1500)])
        opener = RecordingOpener([page_one, page_two])
        client = self._client(opener)
        result = client.esearch("test", reldate=10)
        self.assertEqual(result["count"], 1500)
        self.assertEqual(len(result["pmids"]), 1500)

    def test_retries_then_succeeds(self):
        error = urllib.error.HTTPError("u", 500, "err", None, None)
        opener = RecordingOpener([error, esearch_payload(1, ["7"])])
        client = self._client(opener)
        result = client.esearch("test", reldate=10)
        self.assertEqual(result["pmids"], ["7"])
        self.assertEqual(len(opener.requests), 2)

    def test_non_retryable_error_raises(self):
        error = urllib.error.HTTPError("u", 400, "bad", None, None)
        opener = RecordingOpener([error])
        client = self._client(opener)
        with self.assertRaises(EUtilsError):
            client.esearch("test", reldate=10)

    def test_efetch_failure_is_reported_not_swallowed(self):
        error = urllib.error.HTTPError("u", 500, "err", None, None)
        opener = RecordingOpener([error] * 5)  # max_retries=4 → 5回で打ち切り
        client = self._client(opener, max_retries=4)
        result = client.efetch_xml(["1", "2"])
        self.assertEqual(result["documents"], [])
        self.assertEqual(len(result["failed"]), 1)
        self.assertEqual(result["failed"][0]["pmids"], ["1", "2"])

    def test_efetch_uses_post(self):
        opener = RecordingOpener(["<PubmedArticleSet/>"])
        client = self._client(opener)
        client.efetch_xml(["1", "2"])
        self.assertIsNotNone(opener.requests[0].data)


class QueriesTest(unittest.TestCase):
    def test_channels_match_step1_verified_design(self):
        # A/B は症例報告を除外し、C が症例報告を受け持つ。
        self.assertIn("NOT case reports[pt]", queries.CHANNEL_A)
        self.assertIn("NOT case reports[pt]", queries.CHANNEL_B)
        self.assertIn("AND case reports[pt]", queries.CHANNEL_C)

    def test_channel_a_is_medium_setting(self):
        for term in ("randomized controlled trial[pt]", "meta-analysis[pt]",
                     "registry[tiab]", "survivorship[tiab]"):
            self.assertIn(term, queries.CHANNEL_A)
        # 「広」設定の語は入っていない。
        self.assertNotIn("randomised[tiab]", queries.CHANNEL_A)
        self.assertNotIn('"revision rate"[tiab]', queries.CHANNEL_A)

    def test_no_language_restriction(self):
        for term in queries.CHANNELS.values():
            self.assertNotIn("[la]", term)

    def test_all_verified_terms_present(self):
        self.assertEqual(len(queries.KS_TERMS), 16)
        self.assertEqual(len(queries.CHANNEL_B_JOURNAL_TERMS), 9)
        for term in queries.KS_TERMS:
            self.assertIn(term, queries.KS)

    def test_queries_have_no_newlines(self):
        """改行が入るとURLエンコード時に事故る。"""
        for term in queries.CHANNELS.values():
            self.assertNotIn("\n", term)


if __name__ == "__main__":
    unittest.main()
