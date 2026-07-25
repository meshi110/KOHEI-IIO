"""1トピック時代の状態ファイルを、トピック別の構成へ移行する。

移行しないと、既に取得済みのPMIDが「新規」と判定され、
過去分がもう一度ノートに出力されてしまう。

旧構成(人工関節エージェント1本: 膝と肩が同一トピック):
    state/seen_pmids.json
    state/case_reports.jsonl

新構成(トピック別):
    state/seen_pmids_<topic_id>.json
    state/case_reports_<topic_id>.jsonl

旧トピックは膝と肩の両方を含んでいたため、取得済みPMIDは
knee と shoulder の両方へ引き継ぐ(重複出力を防ぐことが目的のため、
両方に入れて問題ない)。
"""

import shutil

# 旧「人工関節」トピックを引き継ぐ新トピック。
LEGACY_SUCCESSOR_TOPIC_IDS = ("knee", "shoulder")

LEGACY_ARCHIVE_TOPIC_ID = "legacy-arthroplasty"


def migrate_legacy_state(config):
    """必要なら移行を行い、実施内容のメッセージ一覧を返す。

    冪等: 移行済みなら何もしない。
    """
    messages = []

    legacy_state = config.legacy_state_path
    if legacy_state.exists():
        for topic_id in LEGACY_SUCCESSOR_TOPIC_IDS:
            target = config.state_path(topic_id)
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(legacy_state, target)
            messages.append(
                f"取得済みPMIDを引き継ぎました: {legacy_state.name} -> {target.name}"
            )
        retired = legacy_state.with_name(legacy_state.name + ".migrated")
        legacy_state.rename(retired)
        messages.append(f"旧状態ファイルを {retired.name} に退避しました")

    legacy_archive = config.legacy_case_archive_path
    if legacy_archive.exists():
        target = config.case_archive_path(LEGACY_ARCHIVE_TOPIC_ID)
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            legacy_archive.rename(target)
            messages.append(
                f"症例報告保管庫を引き継ぎました: {legacy_archive.name} -> {target.name}"
                "(search-cases の検索対象に含まれます)"
            )

    return messages
