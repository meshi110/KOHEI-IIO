-- 2026年10-11月 当番表（アップロードされたExcel）から抽出した休養日の登録。
-- ログインユーザー作成（SETUP.md 手順1）の後に、SupabaseのSQL Editorで1回実行する。
-- 当直（泊まり）は翌朝の車通勤がないため、当直日とその翌日を登録する（CLAUDE.md参照）。
-- 日直・日当番（10/3田中・11/8田中・11/22飯尾日直など）は車で回診に行くため登録しない。
-- 二重実行しても安全（ON CONFLICT DO NOTHING）。

INSERT INTO rest_days (user_id, date, reason)
SELECT u.id, d.date, d.reason
FROM auth.users u,
     (VALUES
        ('2026-10-07'::date, '当直'),
        ('2026-10-08'::date, '当直明け'),
        ('2026-10-21'::date, '当直'),
        ('2026-10-22'::date, '当直明け'),
        ('2026-11-02'::date, '当直'),
        ('2026-11-03'::date, '当直明け'),
        ('2026-11-25'::date, '不在（当番表メモ）')
     ) AS d(date, reason)
ON CONFLICT (user_id, date) DO NOTHING;
