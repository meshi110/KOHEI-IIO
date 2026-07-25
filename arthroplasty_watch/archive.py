"""症例報告の保管庫(JSONL)。

チャンネルCで拾った症例報告を捨てずに蓄積し、後から
「◯◯の症例報告はあるか?」に答えられるようにする。
vault側のMarkdownはObsidianで、こちらはCLIで検索できる。
"""

import json
from pathlib import Path


class CaseArchive:
    def __init__(self, path):
        self.path = Path(path)

    def existing_pmids(self):
        pmids = set()
        for record in self.iter_records():
            pmid = record.get("pmid")
            if pmid:
                pmids.add(pmid)
        return pmids

    def iter_records(self):
        if not self.path.exists():
            return
        with self.path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except ValueError:
                    # 壊れた行は飛ばす(保管庫全体を落とさない)。
                    continue

    def append(self, articles, retrieved_on):
        """新規の症例報告を追記する。既に保管済みのPMIDは追記しない。"""
        if not articles:
            return 0
        known = self.existing_pmids()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        written = 0
        with self.path.open("a", encoding="utf-8") as handle:
            for article in articles:
                if article.pmid in known:
                    continue
                record = article.to_dict()
                record["retrieved_on"] = retrieved_on
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
                known.add(article.pmid)
                written += 1
        return written

    def search(self, query, limit=20):
        """タイトル・抄録・キーワード・雑誌名の部分一致検索(大文字小文字を無視)。"""
        needle = query.strip().lower()
        if not needle:
            return []
        hits = []
        for record in self.iter_records():
            haystack = " ".join(
                [
                    str(record.get("title", "")),
                    str(record.get("abstract", "")),
                    str(record.get("journal", "")),
                    " ".join(record.get("keywords", []) or []),
                    " ".join(
                        other.get("text", "")
                        for other in (record.get("other_abstracts") or [])
                    ),
                ]
            ).lower()
            if needle in haystack:
                hits.append(record)
                if len(hits) >= limit:
                    break
        return hits

    def count(self):
        return sum(1 for _ in self.iter_records())
