"""出力先パスとObsidian向けフロントマターの検証。"""

import os
import unittest

from arthroplasty_watch.config import Config
from arthroplasty_watch.queries import CHANNELS
from arthroplasty_watch.render import render_note


class ConfigPathTest(unittest.TestCase):
    def test_default_layout_matches_spec(self):
        """既定は <vault>/文献監視/人工関節/ (仕様書どおり)。"""
        config = Config({"VAULT_DIR": "/tmp/KOHEI-Vault"})
        self.assertEqual(str(config.main_output_dir), "/tmp/KOHEI-Vault/文献監視/人工関節")
        self.assertEqual(
            str(config.case_output_dir), "/tmp/KOHEI-Vault/文献監視/人工関節/症例報告"
        )

    def test_subdir_is_configurable(self):
        config = Config({"VAULT_DIR": "/tmp/v", "SUBDIR": "論文/膝肩"})
        self.assertEqual(str(config.main_output_dir), "/tmp/v/論文/膝肩")
        self.assertEqual(str(config.case_output_dir), "/tmp/v/論文/膝肩/症例報告")

    def test_blank_values_fall_back_to_defaults(self):
        config = Config({"VAULT_DIR": "  ", "SUBDIR": ""})
        self.assertTrue(str(config.main_output_dir).endswith("文献監視/人工関節"))
        self.assertIn("KOHEI-Vault", str(config.vault_dir))

    def test_tilde_is_expanded(self):
        config = Config({"VAULT_DIR": "~/Desktop/KOHEI-Vault"})
        self.assertNotIn("~", str(config.vault_dir))
        self.assertEqual(
            str(config.vault_dir),
            os.path.join(os.path.expanduser("~"), "Desktop", "KOHEI-Vault"),
        )

    def test_state_stays_out_of_the_vault(self):
        """状態ファイルはiCloud/vault上に置かない(同期競合を避けるため)。"""
        config = Config({"VAULT_DIR": "/tmp/KOHEI-Vault"})
        self.assertNotIn("KOHEI-Vault", str(config.state_path))
        self.assertNotIn("KOHEI-Vault", str(config.case_archive_path))


class FrontMatterTest(unittest.TestCase):
    def _note(self, **kwargs):
        return render_note(
            date_str="2026-07-25",
            articles=[],
            channel_counts={"A": {"total": 0, "new": 0}},
            new_total=0,
            seen_total=0,
            reldate=10,
            query_map={"A": CHANNELS["A"]},
            **kwargs,
        )

    def test_default_tags_for_obsidian(self):
        note = self._note()
        self.assertIn("tags:\n  - 文献監視\n  - 人工関節\n", note)

    def test_case_report_note_is_tagged(self):
        note = self._note(tags=["文献監視", "人工関節", "症例報告"])
        self.assertIn("  - 症例報告", note)

    def test_front_matter_is_first_and_well_formed(self):
        note = self._note()
        lines = note.splitlines()
        self.assertEqual(lines[0], "---")
        # 2つ目の "---" でフロントマターが閉じている。
        self.assertEqual(lines.index("---", 1), lines[1:].index("---") + 1)


if __name__ == "__main__":
    unittest.main()
