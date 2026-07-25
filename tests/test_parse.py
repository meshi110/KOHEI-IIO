import unittest
from pathlib import Path

from arthroplasty_watch.parse import (
    FETCH_FAILED,
    NOT_IN_RECORD,
    failed_article,
    parse_efetch_xml,
)

FIXTURE = Path(__file__).parent / "fixtures" / "efetch_sample.xml"


class ParseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.articles = {
            a.pmid: a for a in parse_efetch_xml(FIXTURE.read_text(encoding="utf-8"))
        }

    def test_all_records_have_pmid(self):
        self.assertEqual(len(self.articles), 3)
        for pmid, article in self.articles.items():
            self.assertTrue(pmid)
            self.assertEqual(article.pmid, pmid)

    def test_basic_fields(self):
        article = self.articles["40000001"]
        self.assertEqual(
            article.title,
            "Cemented versus cementless fixation in total knee arthroplasty: "
            "a randomized controlled trial.",
        )
        self.assertEqual(article.journal, "J Arthroplasty")
        self.assertEqual(article.year, "2026")
        self.assertEqual(article.doi, "10.1016/j.arth.2026.01.001")
        self.assertEqual(article.authors, ["Tanaka Hiroshi", "Smith Jane A"])
        self.assertEqual(article.languages, ["eng"])
        self.assertIn("Randomized Controlled Trial", article.publication_types)
        self.assertEqual(article.keywords, ["cementless", "total knee arthroplasty"])

    def test_structured_abstract_is_verbatim(self):
        """抄録の本文はPubMed原文そのまま。要約・改変をしない。"""
        abstract = self.articles["40000001"].abstract
        self.assertIn(
            "Fixation choice in total knee arthroplasty remains debated.", abstract
        )
        self.assertIn(
            "We randomized 200 patients (100 per group) and followed them for 24 months.",
            abstract,
        )
        # 数値・記号(±)が改変されずに保持されていること。
        self.assertIn("Mean Knee Society Score was 89.4 ± 6.2 versus 88.1 ± 7.0 (p = 0.18).",
                      abstract)
        # 構造化ラベルは収載データの一部なので保持する。
        self.assertIn("BACKGROUND", abstract)
        self.assertIn("METHODS", abstract)
        self.assertIn("RESULTS", abstract)

    def test_copyright_preserved(self):
        self.assertEqual(
            self.articles["40000001"].copyright,
            "Copyright © 2026 Elsevier Inc. All rights reserved.",
        )

    def test_missing_fields_are_marked_not_fabricated(self):
        """DOIや抄録が元データに無い場合、勝手に埋めず明示マーカーを入れる。"""
        article = self.articles["40000002"]
        self.assertEqual(article.doi, NOT_IN_RECORD)
        self.assertEqual(article.abstract, NOT_IN_RECORD)
        # 「取得失敗」ではない(取得はできている)ことを区別する。
        self.assertNotEqual(article.abstract, FETCH_FAILED)
        self.assertFalse(article.fetch_failed)

    def test_medline_date_and_collective_author(self):
        article = self.articles["40000002"]
        self.assertEqual(article.year, "2025 Nov-Dec")
        self.assertEqual(article.authors, ["German Arthroplasty Registry Study Group"])
        self.assertEqual(article.languages, ["ger"])

    def test_other_abstract_kept_untranslated(self):
        """原語抄録は翻訳せずそのまま保管する。"""
        others = self.articles["40000002"].other_abstracts
        self.assertEqual(len(others), 1)
        self.assertEqual(others[0]["language"], "ger")
        self.assertEqual(
            others[0]["text"],
            "Die Registerdaten zeigen eine Revisionsrate von 4,2% nach fünf Jahren.",
        )

    def test_doi_from_article_id_list(self):
        self.assertEqual(self.articles["40000003"].doi, "10.1016/j.jse.2026.02.002")

    def test_case_report_publication_type(self):
        self.assertIn("Case Reports", self.articles["40000003"].publication_types)

    def test_failed_article_stub_is_explicit(self):
        """取得失敗は空欄にせず「取得失敗」と明記する。PMIDは必ず付く。"""
        stub = failed_article("40000009", "efetch がHTTP 500を返しました")
        self.assertEqual(stub.pmid, "40000009")
        self.assertTrue(stub.fetch_failed)
        for value in (stub.title, stub.journal, stub.year, stub.doi, stub.abstract):
            self.assertEqual(value, FETCH_FAILED)


if __name__ == "__main__":
    unittest.main()
