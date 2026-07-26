"""既存ノートを上書きしないことの検証(同日2回実行のデータ消失防止)。"""

import tempfile
import unittest
from pathlib import Path

from arthroplasty_watch.cli import _resolve_output_path


class ResolveOutputPathTest(unittest.TestCase):
    def test_writes_to_base_path_when_absent(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "2026-07-25.md"
            self.assertEqual(_resolve_output_path(base, True), base)

    def test_records_a_zero_hit_run_when_no_file_yet(self):
        """新着0でも、初回は「確認した記録」としてノートを残す。"""
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "2026-07-25.md"
            self.assertEqual(_resolve_output_path(base, False), base)

    def test_does_not_touch_existing_note_when_nothing_new(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "2026-07-25.md"
            base.write_text("既存の記録", encoding="utf-8")
            self.assertIsNone(_resolve_output_path(base, False))
            self.assertEqual(base.read_text(encoding="utf-8"), "既存の記録")

    def test_uses_new_file_when_rerun_has_new_articles(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "2026-07-25.md"
            base.write_text("1回目の記録", encoding="utf-8")

            second = _resolve_output_path(base, True)
            self.assertEqual(second.name, "2026-07-25_2.md")
            second.write_text("2回目", encoding="utf-8")

            third = _resolve_output_path(base, True)
            self.assertEqual(third.name, "2026-07-25_3.md")

            # 1回目の記録は失われていない。
            self.assertEqual(base.read_text(encoding="utf-8"), "1回目の記録")



class ChunkArticlesTest(unittest.TestCase):
    """遡り取得の分割。1ファイルが大きすぎるとObsidianが開けなくなる。"""

    def test_splits_into_chunks_without_losing_items(self):
        from arthroplasty_watch.cli import _chunk_articles

        items = list(range(500))
        chunks = _chunk_articles(items, 150)
        self.assertEqual(len(chunks), 4)
        self.assertEqual([len(c) for c in chunks], [150, 150, 150, 50])
        # 全件が保存され、順序も保たれる。
        self.assertEqual([x for c in chunks for x in c], items)

    def test_single_chunk_when_small(self):
        from arthroplasty_watch.cli import _chunk_articles

        self.assertEqual(_chunk_articles([1, 2, 3], 150), [[1, 2, 3]])

    def test_empty_input(self):
        from arthroplasty_watch.cli import _chunk_articles

        self.assertEqual(_chunk_articles([], 150), [])

    def test_invalid_chunk_size_does_not_hang(self):
        from arthroplasty_watch.cli import _chunk_articles

        self.assertEqual(_chunk_articles([1, 2], 0), [[1], [2]])
        self.assertEqual(_chunk_articles([1, 2], -5), [[1], [2]])

if __name__ == "__main__":
    unittest.main()
