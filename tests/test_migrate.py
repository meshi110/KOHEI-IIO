"""旧構成からの移行の検証。

移行に失敗すると、Mac上で既に取得済みの66件が「新規」と判定され、
過去分がもう一度ノートに出力されてしまう。ここが壊れると実害が出る。
"""

import json
import tempfile
import unittest
from pathlib import Path

from arthroplasty_watch import archive as archive_mod
from arthroplasty_watch.config import Config
from arthroplasty_watch.migrate import migrate_legacy_state
from arthroplasty_watch.state import SeenStore


class MigrationTest(unittest.TestCase):
    def _config(self, tmp):
        return Config({"VAULT_DIR": f"{tmp}/vault", "STATE_DIR": f"{tmp}/state"})

    def _write_legacy_state(self, config, pmids):
        path = config.legacy_state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(
                {
                    "version": 1,
                    "last_run": "2026-07-25T16:01:02",
                    "pmids": {
                        pmid: {"first_seen": "2026-07-25", "channels": ["A"]}
                        for pmid in pmids
                    },
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    def test_seen_pmids_are_inherited_by_knee_and_shoulder(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = self._config(tmp)
            pmids = [str(40000000 + i) for i in range(66)]
            self._write_legacy_state(config, pmids)

            messages = migrate_legacy_state(config)
            self.assertTrue(messages)

            for topic_id in ("knee", "shoulder"):
                store = SeenStore(config.state_path(topic_id)).load()
                self.assertEqual(len(store), 66, topic_id)
                # 移行済みなので「新規」と判定されない = 再出力されない。
                self.assertEqual(store.new_pmids(pmids), [], topic_id)

    def test_new_topics_start_empty(self):
        """膝・肩以外は旧トピックの対象外だったので引き継がない。"""
        with tempfile.TemporaryDirectory() as tmp:
            config = self._config(tmp)
            self._write_legacy_state(config, ["40000001"])
            migrate_legacy_state(config)

            for topic_id in ("cuff", "prp", "infection"):
                store = SeenStore(config.state_path(topic_id)).load()
                self.assertEqual(len(store), 0, topic_id)

    def test_legacy_file_is_retired_not_deleted(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = self._config(tmp)
            self._write_legacy_state(config, ["40000001"])
            migrate_legacy_state(config)

            self.assertFalse(config.legacy_state_path.exists())
            retired = config.state_dir / "seen_pmids.json.migrated"
            self.assertTrue(retired.exists())

    def test_migration_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = self._config(tmp)
            self._write_legacy_state(config, ["40000001", "40000002"])

            migrate_legacy_state(config)
            second = migrate_legacy_state(config)
            self.assertEqual(second, [])

            store = SeenStore(config.state_path("knee")).load()
            self.assertEqual(len(store), 2)

    def test_migration_does_not_clobber_existing_topic_state(self):
        """既にトピック別の状態がある場合、それを壊さない。"""
        with tempfile.TemporaryDirectory() as tmp:
            config = self._config(tmp)
            self._write_legacy_state(config, ["40000001"])

            existing = SeenStore(config.state_path("knee"))
            existing.mark_seen("99999999", "2026-08-01", {"A"})
            existing.save()

            migrate_legacy_state(config)

            store = SeenStore(config.state_path("knee")).load()
            self.assertEqual(len(store), 1)
            self.assertIn("99999999", store)

    def test_case_archive_is_preserved_and_searchable(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = self._config(tmp)
            legacy = config.legacy_case_archive_path
            legacy.parent.mkdir(parents=True, exist_ok=True)
            legacy.write_text(
                json.dumps(
                    {
                        "pmid": "40000003",
                        "title": "Periprosthetic infection after arthroplasty",
                        "abstract": "A 72-year-old patient...",
                        "journal": "J Shoulder Elbow Surg",
                        "year": "2026",
                        "keywords": [],
                        "other_abstracts": [],
                    },
                    ensure_ascii=False,
                )
                + "\n",
                encoding="utf-8",
            )

            migrate_legacy_state(config)

            self.assertFalse(legacy.exists())
            hits = archive_mod.search_all(config.state_dir, "periprosthetic")
            self.assertEqual(len(hits), 1)
            self.assertEqual(hits[0]["pmid"], "40000003")

    def test_no_legacy_files_is_a_noop(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = self._config(tmp)
            config.state_dir.mkdir(parents=True, exist_ok=True)
            self.assertEqual(migrate_legacy_state(config), [])


if __name__ == "__main__":
    unittest.main()
