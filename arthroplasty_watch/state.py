"""取得済みPMIDの永続化。

差分抽出のための状態。iCloud上ではなくローカル(既定はリポジトリ内 state/)に置く。
書き込みは一時ファイル + os.replace で原子的に行い、途中終了で壊れないようにする。
"""

import json
import os
from pathlib import Path

STATE_VERSION = 1


class SeenStore:
    def __init__(self, path):
        self.path = Path(path)
        self._data = {"version": STATE_VERSION, "pmids": {}, "last_run": None}

    # -- 読み書き -----------------------------------------------------------
    def load(self):
        if not self.path.exists():
            return self
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (ValueError, OSError) as exc:
            raise RuntimeError(
                f"状態ファイルを読めませんでした: {self.path} ({exc})\n"
                "破損している場合は手動で確認してください。"
                "削除すると既取得PMIDを失い、過去分が再出力されます。"
            ) from exc
        if isinstance(payload, dict) and isinstance(payload.get("pmids"), dict):
            self._data = {
                "version": payload.get("version", STATE_VERSION),
                "pmids": payload["pmids"],
                "last_run": payload.get("last_run"),
            }
        return self

    def save(self, last_run=None):
        if last_run is not None:
            self._data["last_run"] = last_run
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp_path.write_text(
            json.dumps(self._data, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        os.replace(tmp_path, self.path)

    # -- 問い合わせ ---------------------------------------------------------
    def __contains__(self, pmid):
        return pmid in self._data["pmids"]

    def __len__(self):
        return len(self._data["pmids"])

    @property
    def last_run(self):
        return self._data.get("last_run")

    def new_pmids(self, pmids):
        """未取得のPMIDだけを、渡された順序を保って返す。"""
        seen_in_call = set()
        result = []
        for pmid in pmids:
            if pmid in self._data["pmids"] or pmid in seen_in_call:
                continue
            seen_in_call.add(pmid)
            result.append(pmid)
        return result

    def mark_seen(self, pmid, first_seen, channels):
        self._data["pmids"][pmid] = {
            "first_seen": first_seen,
            "channels": sorted(channels),
        }

    def get(self, pmid):
        return self._data["pmids"].get(pmid)

    def stats(self):
        by_channel = {}
        for record in self._data["pmids"].values():
            for channel in record.get("channels", []):
                by_channel[channel] = by_channel.get(channel, 0) + 1
        return {
            "total": len(self._data["pmids"]),
            "by_channel": by_channel,
            "last_run": self._data.get("last_run"),
        }
