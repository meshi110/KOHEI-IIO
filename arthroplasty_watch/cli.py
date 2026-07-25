"""コマンドラインインタフェース。

  python3 -m arthroplasty_watch run              全トピックの週次取得(cronから呼ぶのはこれ)
  python3 -m arthroplasty_watch run --dry-run    件数だけ確認(書き込み・状態更新なし)
  python3 -m arthroplasty_watch run --topics knee cuff   トピックを指定して実行
  python3 -m arthroplasty_watch backfill ...     過去分の遡り取得
  python3 -m arthroplasty_watch search-cases ... 症例報告保管庫の横断検索
  python3 -m arthroplasty_watch topics           トピック一覧
  python3 -m arthroplasty_watch stats            現在の状態
"""

import argparse
import sys
from datetime import datetime

from . import archive as archive_mod
from .archive import CaseArchive
from .config import ConfigError, load_config
from .eutils import EUtilsClient, EUtilsError
from .migrate import migrate_legacy_state
from .parse import failed_article, parse_documents
from .render import render_note, write_note
from .state import SeenStore
from .topics import DEFAULT_TOPIC_IDS, TOPICS, get_topic


def _build_client(config):
    config.require_email()
    return EUtilsClient(
        tool=config.tool,
        email=config.email,
        api_key=config.api_key,
        rate_per_second=config.rate_per_second,
        timeout=config.timeout,
        max_retries=config.max_retries,
    )


def _check_vault(config, allow_create):
    """iCloudが未同期のときに、意図しない場所へ書き込むのを防ぐ。"""
    if config.vault_dir.exists() or allow_create:
        return
    parent = config.vault_dir.parent
    if not parent.exists():
        raise ConfigError(
            f"vaultの親フォルダが見つかりません: {parent}\n"
            "iCloud Driveが同期されているか、.env の VAULT_DIR が正しいか確認してください。\n"
            "意図的に新規作成する場合は --create-vault を付けてください。"
        )


def _resolve_output_path(base_path, has_new_articles):
    """既存ノートを絶対に上書きしない出力先を決める。

    同日に2回実行しても1回目の記録を失わないようにする。
      - 既存なし            -> そのまま書く(新着0でも「確認した記録」を残す)
      - 既存あり & 新着なし -> 何も書かない(None)
      - 既存あり & 新着あり -> YYYY-MM-DD_2.md のように別ファイルに書く
    """
    if not base_path.exists():
        return base_path
    if not has_new_articles:
        return None
    for suffix_number in range(2, 100):
        candidate = base_path.with_name(
            f"{base_path.stem}_{suffix_number}{base_path.suffix}"
        )
        if not candidate.exists():
            return candidate
    return base_path.with_name(f"{base_path.stem}_overflow{base_path.suffix}")


def _fetch_articles(client, pmids):
    """PMIDのメタデータを取得。失敗分は「取得失敗」スタブとして返す。"""
    if not pmids:
        return {}, []
    fetched = client.efetch_xml(pmids)
    by_pmid = parse_documents(fetched["documents"])

    failures = list(fetched["failed"])
    # バッチ自体は成功したがレコードが返らなかったPMIDも取りこぼさない。
    missing = [pmid for pmid in pmids if pmid not in by_pmid]
    already_reported = {p for failure in failures for p in failure["pmids"]}
    unexplained = [pmid for pmid in missing if pmid not in already_reported]
    if unexplained:
        failures.append(
            {"pmids": unexplained, "reason": "efetchが該当レコードを返しませんでした"}
        )

    for failure in failures:
        for pmid in failure["pmids"]:
            if pmid not in by_pmid:
                by_pmid[pmid] = failed_article(pmid, failure["reason"])
    return by_pmid, failures


def _selected_topics(args):
    ids = getattr(args, "topics", None) or DEFAULT_TOPIC_IDS
    return [get_topic(topic_id) for topic_id in ids]


def _search_topic(client, topic, *, reldate=None, mindate=None, maxdate=None):
    results = {}
    for channel in topic.channels:
        found = client.esearch(
            channel.query, reldate=reldate, mindate=mindate, maxdate=maxdate
        )
        results[channel.key] = found
        print(f"    {channel.key}({channel.label}): {found['count']}件", flush=True)
    return results


def _run_topic(client, config, topic, *, date_str, reldate, dry_run):
    """1トピックを処理し、サマリ辞書を返す。"""
    print(f"\n[{topic.label}]")
    search_results = _search_topic(client, topic, reldate=reldate)

    channel_labels = {c.key: c.label for c in topic.channels}
    store = SeenStore(config.state_path(topic.id)).load()

    main_pmids = []
    channel_membership = {}
    for channel in topic.main_channels:
        for pmid in search_results[channel.key]["pmids"]:
            channel_membership.setdefault(pmid, set()).add(channel.key)
            if pmid not in main_pmids:
                main_pmids.append(pmid)

    case_channel = topic.case_channel
    case_pmids = []
    if case_channel:
        for pmid in search_results[case_channel.key]["pmids"]:
            channel_membership.setdefault(pmid, set()).add(case_channel.key)
            if pmid not in case_pmids:
                case_pmids.append(pmid)

    new_main = store.new_pmids(main_pmids)
    new_case = [p for p in store.new_pmids(case_pmids) if p not in set(new_main)]

    print(f"    -> 本体 {len(main_pmids)}件(新規 {len(new_main)}件) / "
          f"症例報告 {len(case_pmids)}件(新規 {len(new_case)}件)")

    summary = {
        "topic": topic,
        "new_main": len(new_main),
        "new_case": len(new_case),
        "failures": [],
    }
    if dry_run:
        return summary

    articles, failures = _fetch_articles(client, new_main + new_case)
    summary["failures"] = failures

    def collect(pmids):
        out = []
        for pmid in pmids:
            article = articles[pmid]
            article.channels = sorted(channel_membership.get(pmid, []))
            out.append(article)
        return out

    main_articles = collect(new_main)
    case_articles = collect(new_case)

    # 取得に失敗したPMIDは「取得済み」にしない(次回再取得するため)。
    for pmid in new_main + new_case:
        if not articles[pmid].fetch_failed:
            store.mark_seen(pmid, date_str, channel_membership.get(pmid, []))

    counts_main = {
        c.key: {
            "total": search_results[c.key]["count"],
            "new": len(
                [p for p in new_main if c.key in channel_membership.get(p, set())]
            ),
        }
        for c in topic.main_channels
    }

    main_path = _resolve_output_path(
        config.main_output_dir(topic) / f"{date_str}.md", bool(main_articles)
    )
    if main_path is None:
        print("    新着なし。既存ノートを保持します")
    else:
        write_note(
            main_path,
            render_note(
                date_str=date_str,
                articles=main_articles,
                channel_counts=counts_main,
                new_total=len(main_articles),
                seen_total=len(store),
                reldate=reldate,
                query_map={c.key: c.query for c in topic.main_channels},
                failures=[f for f in failures
                          if any(p in set(new_main) for p in f["pmids"])],
                tags=topic.tags,
                topic_label=topic.label,
                channel_labels=channel_labels,
                topic_note=topic.note,
            ),
        )
        print(f"    出力: {main_path}")

    if case_channel:
        counts_case = {
            case_channel.key: {
                "total": search_results[case_channel.key]["count"],
                "new": len(new_case),
            }
        }
        if case_articles or counts_case[case_channel.key]["total"]:
            case_path = _resolve_output_path(
                config.case_output_dir(topic) / f"{date_str}.md", bool(case_articles)
            )
            if case_path is not None:
                write_note(
                    case_path,
                    render_note(
                        date_str=date_str,
                        articles=case_articles,
                        channel_counts=counts_case,
                        new_total=len(case_articles),
                        seen_total=len(store),
                        reldate=reldate,
                        query_map={case_channel.key: case_channel.query},
                        failures=[f for f in failures
                                  if any(p in set(new_case) for p in f["pmids"])],
                        tags=topic.tags + ["症例報告"],
                        topic_label=topic.label,
                        channel_labels=channel_labels,
                        topic_note=topic.note,
                        title_suffix=" (症例報告)",
                    ),
                )
                print(f"    出力: {case_path}")

        case_archive = CaseArchive(config.case_archive_path(topic.id))
        added = case_archive.append(
            [a for a in case_articles if not a.fetch_failed], retrieved_on=date_str
        )
        if added:
            print(f"    症例報告保管庫: {added}件を追加(累計 {case_archive.count()}件)")

    store.save(last_run=datetime.now().isoformat(timespec="seconds"))
    return summary


def cmd_run(args, config):
    print("設定:")
    print(config.describe())

    for message in migrate_legacy_state(config):
        print(f"  [移行] {message}")
    print()

    client = _build_client(config)
    if not args.dry_run:
        _check_vault(config, args.create_vault)

    date_str = datetime.now().strftime("%Y-%m-%d")
    reldate = args.reldate if args.reldate is not None else config.reldate
    topics = _selected_topics(args)

    print(f"PubMed検索中(edat 直近{reldate}日) / 対象{len(topics)}トピック")

    summaries = []
    for topic in topics:
        summaries.append(
            _run_topic(
                client, config, topic,
                date_str=date_str, reldate=reldate, dry_run=args.dry_run,
            )
        )

    print("\n" + "=" * 50)
    total_main = sum(s["new_main"] for s in summaries)
    total_case = sum(s["new_case"] for s in summaries)
    for summary in summaries:
        print(f"  {summary['topic'].label}: 新規 本体{summary['new_main']}件 / "
              f"症例報告{summary['new_case']}件")
    print(f"  合計: 本体{total_main}件 / 症例報告{total_case}件")

    if args.dry_run:
        print("\n--dry-run のため、取得・書き込み・状態更新は行いませんでした。")
        return 0

    all_failures = [f for s in summaries for f in s["failures"]]
    if all_failures:
        print("\n取得失敗があります(次回再取得します):", file=sys.stderr)
        for failure in all_failures:
            print(f"  PMID {', '.join(failure['pmids'])}: {failure['reason']}",
                  file=sys.stderr)
    return 0


def cmd_backfill(args, config):
    """過去分の遡り取得。症例報告の保管庫を作るときなどに使う。"""
    print("設定:")
    print(config.describe())
    for message in migrate_legacy_state(config):
        print(f"  [移行] {message}")
    print()

    client = _build_client(config)
    _check_vault(config, args.create_vault)

    date_str = datetime.now().strftime("%Y-%m-%d")
    topics = _selected_topics(args)
    period = f"{args.date_from}〜{args.date_to}(遡り取得)"

    print(f"PubMed検索中(edat {args.date_from} 〜 {args.date_to})")

    for topic in topics:
        print(f"\n[{topic.label}]")
        channels = topic.channels
        if args.case_reports_only:
            channels = [c for c in channels if c.is_case_reports]
            if not channels:
                print("    症例報告チャンネルがないためスキップします")
                continue

        channel_labels = {c.key: c.label for c in topic.channels}
        store = SeenStore(config.state_path(topic.id)).load()

        search_results = {}
        all_pmids = []
        channel_membership = {}
        for channel in channels:
            found = client.esearch(
                channel.query, mindate=args.date_from, maxdate=args.date_to
            )
            search_results[channel.key] = found
            print(f"    {channel.key}({channel.label}): {found['count']}件", flush=True)
            for pmid in found["pmids"]:
                channel_membership.setdefault(pmid, set()).add(channel.key)
                if pmid not in all_pmids:
                    all_pmids.append(pmid)

        new_pmids = store.new_pmids(all_pmids)
        print(f"    -> 重複除去後 {len(all_pmids)}件 / 新規 {len(new_pmids)}件")

        if args.dry_run or not new_pmids:
            continue

        print("    メタデータ取得中(件数によっては時間がかかります)...")
        articles, failures = _fetch_articles(client, new_pmids)

        collected = []
        for pmid in new_pmids:
            article = articles[pmid]
            article.channels = sorted(channel_membership.get(pmid, []))
            collected.append(article)

        case_channel = topic.case_channel
        if case_channel:
            case_archive = CaseArchive(config.case_archive_path(topic.id))
            case_only = [
                a for a in collected
                if not a.fetch_failed and case_channel.key in a.channels
            ]
            added = case_archive.append(case_only, retrieved_on=date_str)
            print(f"    症例報告保管庫: {added}件を追加"
                  f"(累計 {case_archive.count()}件)")

        out_name = (f"backfill_{args.date_from.replace('/', '-')}_"
                    f"{args.date_to.replace('/', '-')}.md")
        out_path = _resolve_output_path(
            config.main_output_dir(topic) / out_name, bool(collected)
        )
        if out_path is not None:
            write_note(
                out_path,
                render_note(
                    date_str=date_str,
                    articles=collected,
                    channel_counts={
                        c.key: {
                            "total": search_results[c.key]["count"],
                            "new": len([p for p in new_pmids
                                        if c.key in channel_membership.get(p, set())]),
                        }
                        for c in channels
                    },
                    new_total=len(collected),
                    seen_total=len(store) + len(collected),
                    reldate=period,
                    query_map={c.key: c.query for c in channels},
                    failures=failures,
                    tags=topic.tags,
                    topic_label=topic.label,
                    channel_labels=channel_labels,
                    topic_note=topic.note,
                    title_suffix=" (遡り取得)",
                ),
            )
            print(f"    出力: {out_path}")

        for pmid in new_pmids:
            if not articles[pmid].fetch_failed:
                store.mark_seen(pmid, date_str, channel_membership.get(pmid, []))
        store.save(last_run=datetime.now().isoformat(timespec="seconds"))

    if args.dry_run:
        print("\n--dry-run のため、取得・書き込み・状態更新は行いませんでした。")
    return 0


def cmd_search_cases(args, config):
    migrate_legacy_state(config)
    counts = archive_mod.count_all(config.state_dir)
    total = sum(counts.values())
    if total == 0:
        print(f"症例報告保管庫は空です: {config.state_dir}")
        print("`backfill` で過去分を取り込むか、週次実行の蓄積を待ってください。")
        return 0

    hits = archive_mod.search_all(config.state_dir, args.query, limit=args.limit)
    print(f"保管庫 {total}件中 {len(hits)}件が該当(検索語: {args.query})\n")
    for record in hits:
        topic_id = record.get("_topic", "")
        topic_label = TOPICS[topic_id].label if topic_id in TOPICS else topic_id
        print(f"- [{topic_label}] PMID {record.get('pmid')} | "
              f"{record.get('journal')} {record.get('year')}")
        print(f"  {record.get('title')}")
        doi = record.get("doi", "")
        if doi and not doi.startswith("記載なし") and doi != "取得失敗":
            print(f"  DOI: https://doi.org/{doi}")
        print(f"  https://pubmed.ncbi.nlm.nih.gov/{record.get('pmid')}/")
        print()
    return 0


def cmd_topics(args, config):
    print("登録トピック:\n")
    for topic in TOPICS.values():
        print(f"[{topic.id}] {topic.label}")
        print(f"  出力先: {config.main_output_dir(topic)}")
        for channel in topic.channels:
            print(f"  {channel.key}: {channel.label}")
        print()
    return 0


def cmd_stats(args, config):
    print("設定:")
    print(config.describe())
    for message in migrate_legacy_state(config):
        print(f"  [移行] {message}")
    print()

    archive_counts = archive_mod.count_all(config.state_dir)
    for topic in TOPICS.values():
        store = SeenStore(config.state_path(topic.id)).load()
        stats = store.stats()
        print(f"[{topic.label}]")
        print(f"  既取得PMID : {stats['total']}件")
        print(f"  最終実行   : {stats['last_run'] or '(未実行)'}")
        print(f"  症例報告   : {archive_counts.get(topic.id, 0)}件")

    legacy = {k: v for k, v in archive_counts.items() if k not in TOPICS}
    for name, count in legacy.items():
        print(f"[移行済み保管庫 {name}] 症例報告 {count}件")
    return 0


def build_parser():
    parser = argparse.ArgumentParser(
        prog="arthroplasty_watch",
        description="整形外科 文献監視エージェント — PubMed新着をMarkdownで出力する",
    )
    parser.add_argument("--env", help="読み込む .env のパス(既定: リポジトリ直下の .env)")
    subparsers = parser.add_subparsers(dest="command")

    run_parser = subparsers.add_parser("run", help="週次取得(cronから呼ぶのはこれ)")
    run_parser.add_argument("--reldate", type=int, help="直近N日(既定: .env の RELDATE)")
    run_parser.add_argument("--topics", nargs="+", choices=sorted(TOPICS),
                            help="対象トピック(既定: 全部)")
    run_parser.add_argument("--dry-run", action="store_true",
                            help="件数だけ確認し、書き込み・状態更新をしない")
    run_parser.add_argument("--create-vault", action="store_true",
                            help="vaultフォルダが無ければ作成する")
    run_parser.set_defaults(func=cmd_run)

    backfill_parser = subparsers.add_parser("backfill", help="過去分の遡り取得")
    backfill_parser.add_argument("--from", dest="date_from", required=True,
                                 help="開始日 YYYY/MM/DD")
    backfill_parser.add_argument("--to", dest="date_to", required=True,
                                 help="終了日 YYYY/MM/DD")
    backfill_parser.add_argument("--topics", nargs="+", choices=sorted(TOPICS),
                                 help="対象トピック(既定: 全部)")
    backfill_parser.add_argument("--case-reports-only", action="store_true",
                                 help="症例報告チャンネルのみ遡る")
    backfill_parser.add_argument("--dry-run", action="store_true", help="件数だけ確認する")
    backfill_parser.add_argument("--create-vault", action="store_true",
                                 help="vaultフォルダが無ければ作成する")
    backfill_parser.set_defaults(func=cmd_backfill)

    search_parser = subparsers.add_parser("search-cases",
                                          help="症例報告保管庫を横断検索する")
    search_parser.add_argument("query", help="検索語(タイトル・抄録・雑誌名・キーワード)")
    search_parser.add_argument("--limit", type=int, default=20, help="最大表示件数")
    search_parser.set_defaults(func=cmd_search_cases)

    topics_parser = subparsers.add_parser("topics", help="トピック一覧を表示する")
    topics_parser.set_defaults(func=cmd_topics)

    stats_parser = subparsers.add_parser("stats", help="現在の状態を表示する")
    stats_parser.set_defaults(func=cmd_stats)

    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return 1
    try:
        config = load_config(args.env)
        return args.func(args, config)
    except (ConfigError, EUtilsError, RuntimeError, KeyError) as exc:
        print(f"エラー: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
