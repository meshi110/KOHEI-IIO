"""トピック定義とパス構成の検証。"""

import unittest

from arthroplasty_watch import topics as topics_mod
from arthroplasty_watch.config import Config
from arthroplasty_watch.topics import TOPICS, get_topic


class TopicDefinitionTest(unittest.TestCase):
    def test_five_topics_registered(self):
        self.assertEqual(
            sorted(TOPICS), ["cuff", "infection", "knee", "prp", "shoulder"]
        )

    def test_every_topic_has_case_report_channel(self):
        """症例報告は捨てずに必ず別建てで蓄積する。"""
        for topic in TOPICS.values():
            self.assertIsNotNone(topic.case_channel, topic.id)
            self.assertTrue(topic.main_channels, topic.id)

    def test_main_channels_exclude_case_reports(self):
        for topic in TOPICS.values():
            for channel in topic.main_channels:
                self.assertIn("NOT case reports[pt]", channel.query, topic.id)

    def test_case_channels_target_case_reports(self):
        for topic in TOPICS.values():
            self.assertIn("AND case reports[pt]", topic.case_channel.query, topic.id)

    def test_no_language_restriction_anywhere(self):
        for topic in TOPICS.values():
            for channel in topic.channels:
                self.assertNotIn("[la]", channel.query, topic.id)

    def test_no_newlines_in_queries(self):
        """改行が入るとURLエンコード時に事故る。"""
        for topic in TOPICS.values():
            for channel in topic.channels:
                self.assertNotIn("\n", channel.query, topic.id)

    def test_ambiguous_abbreviations_are_not_used(self):
        """検証でノイズが多すぎると判明した略語を使っていないこと。

        RSA: 85%がshoulder非言及 / PRP: 55%がplatelet-rich plasma無関係
        SSI: "surgical site infection"以外に4,506件のノイズ
        """
        for topic in TOPICS.values():
            for channel in topic.channels:
                self.assertNotIn("RSA[tiab]", channel.query, topic.id)
                self.assertNotIn("SSI[tiab]", channel.query, topic.id)
                # PRP[tiab] 単独は不可。PRPトピックはMeSHと完全語で拾う。
                self.assertNotIn("PRP[tiab]", channel.query, topic.id)

    def test_pji_is_used_because_it_is_unambiguous(self):
        """PJIはノイズ6%のみだったため使用してよい。"""
        self.assertIn("PJI[tiab]", get_topic("infection").channel("A").query)

    def test_shoulder_topic_absorbs_reverse_arthroplasty(self):
        """RSA単独トピックを作らず、肩トピックに統合する方針。"""
        query = get_topic("shoulder").channel("A").query
        for term in ('"reverse shoulder"[tiab]', '"reverse total shoulder"[tiab]',
                     "rTSA[tiab]", '"Rotator Cuff Tear Arthropathy"[Mesh]'):
            self.assertIn(term, query)

    def test_knee_and_shoulder_are_separated(self):
        """案3: 膝と肩を別トピックにし、重複を出さない。"""
        knee = get_topic("knee").channel("A").query
        shoulder = get_topic("shoulder").channel("A").query
        self.assertNotIn("shoulder", knee)
        self.assertNotIn("TKA[tiab]", shoulder)

    def test_knee_channel_a_is_strict_to_meet_weekly_target(self):
        """膝は週20件に収めるためRCT/メタのみに絞る(実測 年958件)。"""
        query = get_topic("knee").channel("A").query
        self.assertIn("randomized controlled trial[pt]", query)
        self.assertIn("meta-analysis[pt]", query)
        self.assertNotIn("registry[tiab]", query)

    def test_prp_is_restricted_to_musculoskeletal(self):
        """PRPは歯科・皮膚科を除くため運動器に限定する。"""
        query = get_topic("prp").channel("A").query
        self.assertIn('"Musculoskeletal Diseases"[Mesh]', query)
        self.assertIn('"autologous conditioned plasma"[tiab]', query)

    def test_infection_includes_guidelines(self):
        """感染症は意思決定支援が目的のためガイドラインを含める。"""
        query = get_topic("infection").channel("A").query
        self.assertIn("guideline[pt]", query)
        self.assertIn("systematic review[pt]", query)

    def test_infection_topic_states_no_clinical_judgement(self):
        self.assertIn("臨床判断は行わない", get_topic("infection").note)

    def test_verified_term_counts(self):
        self.assertEqual(len(topics_mod.KNEE_TERMS), 9)
        self.assertEqual(len(topics_mod.SHOULDER_TERMS), 10)
        self.assertEqual(len(topics_mod.CUFF_TERMS), 6)
        self.assertEqual(len(topics_mod.INFECTION_TERMS), 9)
        self.assertEqual(len(topics_mod.KNEE_JOURNALS), 5)
        self.assertEqual(len(topics_mod.CUFF_JOURNALS), 10)

    def test_unknown_topic_raises(self):
        with self.assertRaises(KeyError):
            get_topic("unknown")


class TopicPathTest(unittest.TestCase):
    def setUp(self):
        self.config = Config({"VAULT_DIR": "/tmp/KOHEI-Vault"})

    def test_each_topic_has_its_own_folder(self):
        folders = {
            str(self.config.main_output_dir(topic)) for topic in TOPICS.values()
        }
        self.assertEqual(len(folders), len(TOPICS))
        self.assertIn("/tmp/KOHEI-Vault/文献監視/人工関節-膝", folders)
        self.assertIn("/tmp/KOHEI-Vault/文献監視/術後感染症", folders)

    def test_case_reports_live_under_the_topic_folder(self):
        topic = get_topic("cuff")
        self.assertEqual(
            str(self.config.case_output_dir(topic)),
            "/tmp/KOHEI-Vault/文献監視/腱板/症例報告",
        )

    def test_state_is_per_topic_and_outside_the_vault(self):
        paths = {self.config.state_path(t) for t in TOPICS}
        self.assertEqual(len(paths), len(TOPICS))
        for path in paths:
            self.assertNotIn("KOHEI-Vault", str(path))


if __name__ == "__main__":
    unittest.main()
