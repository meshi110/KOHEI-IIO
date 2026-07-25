"""Markdown出力。

厳守事項:
  - abstract は原文のまま。要約・改変・翻訳をしない。
  - PubMedから取得していない数値・記述を生成しない(件数は実測値のみ)。
  - 取得失敗は空欄にせず「取得失敗」と明記する。
  - 各記事に必ずPMIDを付す。
"""

from .parse import FETCH_FAILED, NOT_IN_RECORD

ABSTRACT_HEADING = "**Abstract(PubMed原文ママ / 未要約・未翻訳)**"


def _format_authors(authors):
    if not authors:
        return NOT_IN_RECORD
    return ", ".join(authors)


def _format_list(values):
    if not values:
        return NOT_IN_RECORD
    return ", ".join(values)


def _format_doi(article):
    if article.doi in (NOT_IN_RECORD, FETCH_FAILED, ""):
        return article.doi or NOT_IN_RECORD
    return f"[{article.doi}]({article.doi_url})"


def render_article(article, index=None, channel_labels=None):
    channel_labels = channel_labels or {}
    heading_number = f"{index}. " if index is not None else ""
    lines = [f"### {heading_number}{article.title}", ""]

    if article.fetch_failed:
        lines.append(
            f"> **{FETCH_FAILED}**: このPMIDのメタデータを取得できませんでした。"
            "取得済みとして記録していないため、次回実行時に再取得を試みます。"
        )
        if article.fetch_error:
            lines.append(f"> 理由: {article.fetch_error}")
        lines.append("")

    channels = (
        ", ".join(f"{ch}({channel_labels.get(ch, ch)})" for ch in article.channels)
        if article.channels
        else NOT_IN_RECORD
    )

    lines.extend(
        [
            f"- **PMID**: [{article.pmid}]({article.pubmed_url})",
            f"- **DOI**: {_format_doi(article)}",
            f"- **雑誌**: {article.journal}",
            f"- **年**: {article.year}",
            f"- **著者**: {_format_authors(article.authors)}",
            f"- **言語**: {_format_list(article.languages)}",
            f"- **Publication type**: {_format_list(article.publication_types)}",
            f"- **チャンネル**: {channels}",
            "",
            ABSTRACT_HEADING,
            "",
            article.abstract,
            "",
        ]
    )

    if article.copyright:
        lines.extend([f"*{article.copyright}*", ""])

    for other in article.other_abstracts:
        lines.extend(
            [
                f"**別言語の抄録({other.get('language', NOT_IN_RECORD)}) — 原文ママ**",
                "",
                other.get("text", NOT_IN_RECORD),
                "",
            ]
        )

    return "\n".join(lines)


def _render_summary_block(counts, channel_labels):
    """実測値のみを書く。推定値は書かない。"""
    lines = []
    for channel, value in counts.items():
        label = channel_labels.get(channel, channel)
        lines.append(f"  - チャンネル{channel}({label}): PubMedヒット {value['total']}件 "
                     f"/ うち新規 {value['new']}件")
    return lines


def render_note(
    *,
    date_str,
    articles,
    channel_counts,
    new_total,
    seen_total,
    reldate,
    query_map,
    failures=None,
    title_suffix="",
    tags=None,
    topic_label="人工関節",
    channel_labels=None,
    topic_note="",
):
    failures = failures or []
    channel_labels = channel_labels or {}
    # Obsidianのタグペイン・検索から辿れるようにする。
    tags = tags or ["文献監視"]
    title = f"{topic_label} 文献監視 {date_str}"
    if title_suffix:
        title = f"{title}{title_suffix}"

    lines = [
        "---",
        f"date: {date_str}",
        "tags:",
    ]
    lines.extend(f"  - {tag}" for tag in tags)
    lines.extend([
        "source: PubMed (NCBI E-utilities)",
        "generator: arthroplasty-watch v1",
        "note: abstractはPubMed原文のまま。要約・評価・翻訳は行っていない。",
        "---",
        "",
        f"# {title}",
        "",
        "## 取得条件",
        "",
        f"- 取得日: {date_str}",
        f"- 日付種別: edat(PubMed登録日) / 直近 {reldate} 日(週次実行に対する重複バッファ込み)",
        "- 言語制限: なし(全言語)",
        "- 出典: PubMed (NCBI E-utilities)",
        "",
    ])
    if topic_note:
        lines.extend([f"> {topic_note}", ""])
    lines.extend([
        "## 件数(PubMed実測)",
        "",
    ])
    lines.extend(_render_summary_block(channel_counts, channel_labels))
    lines.extend(
        [
            f"  - 本ノート掲載(重複除去後の新規): {new_total}件",
            f"  - 既取得PMID累計: {seen_total}件",
            "",
        ]
    )

    if failures:
        lines.extend(["## 取得失敗", ""])
        for failure in failures:
            lines.append(
                f"- PMID {', '.join(failure['pmids'])}: {FETCH_FAILED} — {failure['reason']}"
            )
        lines.append("")

    lines.extend(["## 新着文献", ""])
    if not articles:
        lines.extend(["(今回の新着はありません)", ""])
    else:
        for index, article in enumerate(articles, start=1):
            lines.append(
                render_article(article, index=index, channel_labels=channel_labels)
            )
            lines.append("---")
            lines.append("")

    lines.extend(["## 使用した検索式", ""])
    for channel, term in query_map.items():
        label = channel_labels.get(channel, channel)
        lines.extend([f"### チャンネル{channel}: {label}", "", "```", term, "```", ""])

    return "\n".join(lines).rstrip() + "\n"


def write_note(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path
