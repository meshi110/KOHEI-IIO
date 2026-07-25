import json
import tempfile
import unittest
from pathlib import Path

from arthroplasty_watch.archive import CaseArchive
from arthroplasty_watch.parse import (
    FETCH_FAILED,
    failed_article,
    parse_efetch_xml,
)
from arthroplasty_watch.topics import get_topic
from arthroplasty_watch.render import render_article, render_note
from arthroplasty_watch.state import SeenStore

FIXTURE = Path(__file__).parent / "fixtures" / "efetch_sample.xml"


def load_articles():
    return {a.pmid: a for a in parse_efetch_xml(FIXTURE.read_text(encoding="utf-8"))}


class RenderTest(unittest.TestCase):
    def setUp(self):
        self.articles = load_articles()

    def test_article_always_has_pmid(self):
        for article in self.articles.values():
            rendered = render_article(article)
            self.assertIn(f"**PMID**: [{article.pmid}]", rendered)

    def test_abstract_appears_verbatim_in_markdown(self):
        article = self.articles["40000001"]
        rendered = render_article(article)
        self.assertIn(
            "Mean Knee Society Score was 89.4 ± 6.2 versus 88.1 ± 7.0 (p = 0.18).",
            rendered,
        )
        self.assertIn("原文ママ", rendered)

    def test_failed_article_marked_in_markdown(self):
        rendered = render_article(failed_article("40000009", "接続に失敗しました"))
        self.assertIn(FETCH_FAILED, rendered)
        self.assertIn("40000009", rendered)

    def test_note_reports_only_measured_counts(self):
        article = self.articles["40000001"]
        article.channels = ["A", "B"]
        note = render_note(
            date_str="2026-07-25",
            articles=[article],
            channel_counts={
                "A": {"total": 12, "new": 1},
                "B": {"total": 20, "new": 0},
            },
            new_total=1,
            seen_total=345,
            reldate=10,
            query_map={"A": get_topic("knee").channel("A").query,
                       "B": get_topic("knee").channel("B").query},
        )
        self.assertIn("PubMedヒット 12件", note)
        self.assertIn("うち新規 1件", note)
        self.assertIn("既取得PMID累計: 345件", note)
        self.assertIn("date: 2026-07-25", note)
        # 検索式が監査できるようノートに残る。
        self.assertIn('"Arthroplasty, Replacement, Knee"[Mesh]', note)

    def test_note_with_no_new_articles(self):
        note = render_note(
            date_str="2026-07-25",
            articles=[],
            channel_counts={"A": {"total": 5, "new": 0}},
            new_total=0,
            seen_total=10,
            reldate=10,
            query_map={"A": get_topic("knee").channel("A").query},
        )
        self.assertIn("(今回の新着はありません)", note)

    def test_note_lists_fetch_failures(self):
        note = render_note(
            date_str="2026-07-25",
            articles=[],
            channel_counts={"A": {"total": 1, "new": 1}},
            new_total=0,
            seen_total=0,
            reldate=10,
            query_map={"A": get_topic("knee").channel("A").query},
            failures=[{"pmids": ["40000009"], "reason": "HTTP 500"}],
        )
        self.assertIn("## 取得失敗", note)
        self.assertIn("40000009", note)


class StateTest(unittest.TestCase):
    def test_new_pmids_and_persistence(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "seen.json"
            store = SeenStore(path).load()
            self.assertEqual(len(store), 0)

            new = store.new_pmids(["1", "2", "2", "3"])
            self.assertEqual(new, ["1", "2", "3"])  # 呼び出し内の重複も除去

            for pmid in new:
                store.mark_seen(pmid, "2026-07-25", {"A"})
            store.save(last_run="2026-07-25T09:00:00")

            reloaded = SeenStore(path).load()
            self.assertEqual(len(reloaded), 3)
            self.assertEqual(reloaded.new_pmids(["1", "2", "3", "4"]), ["4"])
            self.assertEqual(reloaded.get("1")["first_seen"], "2026-07-25")
            self.assertEqual(reloaded.last_run, "2026-07-25T09:00:00")

    def test_save_is_atomic_and_valid_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "nested" / "seen.json"
            store = SeenStore(path).load()
            store.mark_seen("42", "2026-07-25", {"C"})
            store.save()
            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertIn("42", payload["pmids"])
            self.assertFalse(list(path.parent.glob("*.tmp")))

    def test_corrupt_state_raises_rather_than_silently_resetting(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "seen.json"
            path.write_text("{ this is not json", encoding="utf-8")
            with self.assertRaises(RuntimeError):
                SeenStore(path).load()


class ArchiveTest(unittest.TestCase):
    def test_append_dedupes_and_search_finds(self):
        articles = load_articles()
        case = articles["40000003"]
        with tempfile.TemporaryDirectory() as tmp:
            archive = CaseArchive(Path(tmp) / "case_reports.jsonl")
            self.assertEqual(archive.append([case], retrieved_on="2026-07-25"), 1)
            # 同じPMIDは二重に貯めない。
            self.assertEqual(archive.append([case], retrieved_on="2026-08-01"), 0)
            self.assertEqual(archive.count(), 1)

            hits = archive.search("periprosthetic")
            self.assertEqual(len(hits), 1)
            self.assertEqual(hits[0]["pmid"], "40000003")
            # 抄録は保管庫でも原文のまま。
            self.assertIn("72-year-old patient", hits[0]["abstract"])

            self.assertEqual(archive.search("該当しない語"), [])

    def test_search_covers_journal_and_keywords(self):
        articles = load_articles()
        with tempfile.TemporaryDirectory() as tmp:
            archive = CaseArchive(Path(tmp) / "c.jsonl")
            archive.append([articles["40000003"]], retrieved_on="2026-07-25")
            self.assertEqual(len(archive.search("J Shoulder Elbow Surg")), 1)
            self.assertEqual(len(archive.search("REVERSE SHOULDER")), 1)


if __name__ == "__main__":
    unittest.main()
