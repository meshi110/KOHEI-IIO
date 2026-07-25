"""コマンドラインインタフェース。

  python3 -m arthroplasty_watch run              週次取得(cronから呼ぶのはこれ)
  python3 -m arthroplasty_watch run --dry-run    件数だけ確認(書き込み・状態更新なし)
  python3 -m arthroplasty_watch backfill ...     過去分の遡り取得(症例報告の保管庫作りなど)
  python3 -m arthroplasty_watch search-cases ... 症例報告保管庫の検索
  python3 -m arthroplasty_watch stats            現在の状態を表示
"""

import argparse
import sys
from datetime import datetime

from .archive import CaseArchive
from .config import ConfigError, load_config
from .eutils import EUtilsClient, EUtilsError
from .parse import failed_article, parse_documents
from .queries import CASE_REPORT_CHANNEL, CHANNEL_LABELS, CHANNELS, MAIN_CHANNELS
from .render import render_note, write_note
from .state import SeenStore


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
    parent = config.vault_dir.parent
    if config.vault_dir.exists() or allow_create:
        return
    if not parent.exists():
        raise ConfigError(
            f"vaultの親フォルダが見つかりません: {parent}\n"
            "iCloud Driveが同期されているか、.env の VAULT_DIR が正しいか確認してください。\n"
            "意図的に新規作成する場合は --create-vault を付けてください。"
        )


def _search_channels(client, config, *, reldate=None, mindate=None, maxdate=None,
                     channels=None):
    selected = channels or list(CHANNELS.keys())
    results = {}
    for channel in selected:
        term = CHANNELS[channel]
        found = client.esearch(
            term, reldate=reldate, mindate=mindate, maxdate=maxdate
        )
        results[channel] = found
        print(
            f"  チャンネル{channel}({CHANNEL_LABELS[channel]}): {found['count']}件",
            flush=True,
        )
    return results


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


def cmd_run(args, config):
    print("設定:")
    print(config.describe())
    print()

    client = _build_client(config)
    if not args.dry_run:
        _check_vault(config, args.create_vault)

    store = SeenStore(config.state_path).load()
    date_str = datetime.now().strftime("%Y-%m-%d")
    reldate = args.reldate if args.reldate is not None else config.reldate

    print(f"PubMed検索中(edat 直近{reldate}日)...")
    search_results = _search_channels(client, config, reldate=reldate)

    # A∪B を本体、C(症例報告)を別建てにする。
    main_pmids = []
    channel_membership = {}
    for channel in MAIN_CHANNELS:
        for pmid in search_results[channel]["pmids"]:
            channel_membership.setdefault(pmid, set()).add(channel)
            if pmid not in main_pmids:
                main_pmids.append(pmid)

    case_pmids = []
    for pmid in search_results[CASE_REPORT_CHANNEL]["pmids"]:
        channel_membership.setdefault(pmid, set()).add(CASE_REPORT_CHANNEL)
        if pmid not in case_pmids:
            case_pmids.append(pmid)

    new_main = store.new_pmids(main_pmids)
    new_case = [pmid for pmid in store.new_pmids(case_pmids) if pmid not in set(new_main)]

    print()
    print(f"  A∪B 重複除去後: {len(main_pmids)}件 / うち新規 {len(new_main)}件")
    print(f"  C(症例報告)   : {len(case_pmids)}件 / うち新規 {len(new_case)}件")

    if args.dry_run:
        print("\n--dry-run のため、取得・書き込み・状態更新は行いません。")
        return 0

    print("\nメタデータ取得中...")
    articles, failures = _fetch_articles(client, new_main + new_case)

    main_articles = []
    for pmid in new_main:
        article = articles[pmid]
        article.channels = sorted(channel_membership.get(pmid, []))
        main_articles.append(article)

    case_articles = []
    for pmid in new_case:
        article = articles[pmid]
        article.channels = sorted(channel_membership.get(pmid, []))
        case_articles.append(article)

    # 取得に失敗したPMIDは「取得済み」にしない(次回再取得するため)。
    succeeded = {
        pmid for pmid, article in articles.items() if not article.fetch_failed
    }
    for pmid in new_main + new_case:
        if pmid in succeeded:
            store.mark_seen(pmid, date_str, channel_membership.get(pmid, []))

    counts_main = {
        channel: {
            "total": search_results[channel]["count"],
            "new": len(
                [p for p in new_main if channel in channel_membership.get(p, set())]
            ),
        }
        for channel in MAIN_CHANNELS
    }
    counts_case = {
        CASE_REPORT_CHANNEL: {
            "total": search_results[CASE_REPORT_CHANNEL]["count"],
            "new": len(new_case),
        }
    }

    main_path = _resolve_output_path(
        config.main_output_dir / f"{date_str}.md", bool(main_articles)
    )
    if main_path is None:
        print(f"\n新着なし。既存ノートを保持します: {config.main_output_dir / f'{date_str}.md'}")
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
                query_map={ch: CHANNELS[ch] for ch in MAIN_CHANNELS},
                failures=[
                    f
                    for f in failures
                    if any(p in set(new_main) for p in f["pmids"])
                ],
            ),
        )
        print(f"\n出力: {main_path}")

    if case_articles or counts_case[CASE_REPORT_CHANNEL]["total"]:
        case_path = _resolve_output_path(
            config.case_output_dir / f"{date_str}.md", bool(case_articles)
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
                    query_map={CASE_REPORT_CHANNEL: CHANNELS[CASE_REPORT_CHANNEL]},
                    failures=[
                        f
                        for f in failures
                        if any(p in set(new_case) for p in f["pmids"])
                    ],
                    title_suffix=" (症例報告)",
                ),
            )
            print(f"出力: {case_path}")

    archive = CaseArchive(config.case_archive_path)
    added = archive.append(
        [a for a in case_articles if not a.fetch_failed], retrieved_on=date_str
    )
    print(f"症例報告保管庫: {added}件を追加(累計 {archive.count()}件)")

    store.save(last_run=datetime.now().isoformat(timespec="seconds"))
    print(f"状態を更新: 既取得PMID累計 {len(store)}件")

    if failures:
        print("\n取得失敗があります(次回再取得します):", file=sys.stderr)
        for failure in failures:
            print(
                f"  PMID {', '.join(failure['pmids'])}: {failure['reason']}",
                file=sys.stderr,
            )
    return 0


def cmd_backfill(args, config):
    """過去分の遡り取得。症例報告の保管庫を最初に作るときなどに使う。"""
    print("設定:")
    print(config.describe())
    print()

    client = _build_client(config)
    _check_vault(config, args.create_vault)

    store = SeenStore(config.state_path).load()
    date_str = datetime.now().strftime("%Y-%m-%d")
    channels = args.channels or [CASE_REPORT_CHANNEL]

    print(f"PubMed検索中(edat {args.date_from} 〜 {args.date_to})...")
    search_results = _search_channels(
        client, config, mindate=args.date_from, maxdate=args.date_to, channels=channels
    )

    all_pmids = []
    channel_membership = {}
    for channel in channels:
        for pmid in search_results[channel]["pmids"]:
            channel_membership.setdefault(pmid, set()).add(channel)
            if pmid not in all_pmids:
                all_pmids.append(pmid)

    new_pmids = store.new_pmids(all_pmids)
    print(f"\n  重複除去後 {len(all_pmids)}件 / うち新規 {len(new_pmids)}件")

    if args.dry_run:
        print("\n--dry-run のため、取得・書き込み・状態更新は行いません。")
        return 0
    if not new_pmids:
        print("新規はありません。")
        return 0

    print("\nメタデータ取得中(件数によっては時間がかかります)...")
    articles, failures = _fetch_articles(client, new_pmids)

    collected = []
    for pmid in new_pmids:
        article = articles[pmid]
        article.channels = sorted(channel_membership.get(pmid, []))
        collected.append(article)

    archive = CaseArchive(config.case_archive_path)
    added = 0
    if CASE_REPORT_CHANNEL in channels:
        case_only = [
            a
            for a in collected
            if not a.fetch_failed and CASE_REPORT_CHANNEL in a.channels
        ]
        added = archive.append(case_only, retrieved_on=date_str)

    out_path = (
        config.case_output_dir / f"backfill_{args.date_from.replace('/', '-')}_"
        f"{args.date_to.replace('/', '-')}.md"
    )
    write_note(
        out_path,
        render_note(
            date_str=date_str,
            articles=collected,
            channel_counts={
                ch: {
                    "total": search_results[ch]["count"],
                    "new": len(
                        [p for p in new_pmids if ch in channel_membership.get(p, set())]
                    ),
                }
                for ch in channels
            },
            new_total=len(collected),
            seen_total=len(store) + len(collected),
            reldate=f"{args.date_from}〜{args.date_to}(遡り取得)",
            query_map={ch: CHANNELS[ch] for ch in channels},
            failures=failures,
            title_suffix=" (遡り取得)",
        ),
    )

    for pmid in new_pmids:
        if not articles[pmid].fetch_failed:
            store.mark_seen(pmid, date_str, channel_membership.get(pmid, []))
    store.save(last_run=datetime.now().isoformat(timespec="seconds"))

    print(f"\n出力: {out_path}")
    print(f"症例報告保管庫: {added}件を追加(累計 {archive.count()}件)")
    print(f"状態を更新: 既取得PMID累計 {len(store)}件")
    return 0


def cmd_search_cases(args, config):
    archive = CaseArchive(config.case_archive_path)
    total = archive.count()
    if total == 0:
        print(f"症例報告保管庫は空です: {config.case_archive_path}")
        print("`backfill` で過去分を取り込むか、週次実行の蓄積を待ってください。")
        return 0

    hits = archive.search(args.query, limit=args.limit)
    print(f"保管庫 {total}件中 {len(hits)}件が該当(検索語: {args.query})\n")
    for record in hits:
        print(f"- PMID {record.get('pmid')} | {record.get('journal')} {record.get('year')}")
        print(f"  {record.get('title')}")
        doi = record.get("doi", "")
        if doi and not doi.startswith("記載なし") and doi != "取得失敗":
            print(f"  DOI: https://doi.org/{doi}")
        print(f"  https://pubmed.ncbi.nlm.nih.gov/{record.get('pmid')}/")
        print()
    return 0


def cmd_stats(args, config):
    print("設定:")
    print(config.describe())
    print()
    store = SeenStore(config.state_path).load()
    stats = store.stats()
    print(f"既取得PMID累計 : {stats['total']}件")
    print(f"最終実行       : {stats['last_run'] or '(未実行)'}")
    for channel, count in sorted(stats["by_channel"].items()):
        print(f"  チャンネル{channel}({CHANNEL_LABELS.get(channel, channel)}): {count}件")
    archive = CaseArchive(config.case_archive_path)
    print(f"症例報告保管庫 : {archive.count()}件")
    return 0


def build_parser():
    parser = argparse.ArgumentParser(
        prog="arthroplasty_watch",
        description="人工関節(膝・肩)文献監視エージェント v1 — PubMed新着をMarkdownで出力する",
    )
    parser.add_argument("--env", help="読み込む .env のパス(既定: リポジトリ直下の .env)")
    subparsers = parser.add_subparsers(dest="command")

    run_parser = subparsers.add_parser("run", help="週次取得(cronから呼ぶのはこれ)")
    run_parser.add_argument("--reldate", type=int, help="直近N日(既定: .env の RELDATE)")
    run_parser.add_argument(
        "--dry-run", action="store_true", help="件数だけ確認し、書き込み・状態更新をしない"
    )
    run_parser.add_argument(
        "--create-vault", action="store_true", help="vaultフォルダが無ければ作成する"
    )
    run_parser.set_defaults(func=cmd_run)

    backfill_parser = subparsers.add_parser(
        "backfill", help="過去分の遡り取得(症例報告の保管庫作りなど)"
    )
    backfill_parser.add_argument("--from", dest="date_from", required=True,
                                 help="開始日 YYYY/MM/DD")
    backfill_parser.add_argument("--to", dest="date_to", required=True,
                                 help="終了日 YYYY/MM/DD")
    backfill_parser.add_argument(
        "--channels", nargs="+", choices=sorted(CHANNELS.keys()),
        help="対象チャンネル(既定: C 症例報告のみ)"
    )
    backfill_parser.add_argument("--dry-run", action="store_true", help="件数だけ確認する")
    backfill_parser.add_argument(
        "--create-vault", action="store_true", help="vaultフォルダが無ければ作成する"
    )
    backfill_parser.set_defaults(func=cmd_backfill)

    search_parser = subparsers.add_parser(
        "search-cases", help="症例報告保管庫を検索する"
    )
    search_parser.add_argument("query", help="検索語(タイトル・抄録・雑誌名・キーワードを対象)")
    search_parser.add_argument("--limit", type=int, default=20, help="最大表示件数")
    search_parser.set_defaults(func=cmd_search_cases)

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
    except (ConfigError, EUtilsError, RuntimeError) as exc:
        print(f"エラー: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
