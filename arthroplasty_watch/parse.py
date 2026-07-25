"""PubMed XML の解析。

厳守事項:
  - abstract は原文のまま保持する。要約・改変・翻訳は一切しない。
  - PubMedから取得していない数値・記述を生成しない。
  - 取得できなかった項目は空欄にせず、明示マーカーを入れる。
"""

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

# 取得処理そのものが失敗した場合のマーカー。
FETCH_FAILED = "取得失敗"
# PubMedの収載データに、その項目が元々存在しない場合のマーカー。
# (取得失敗と区別する。DOIが無い論文などを「取得失敗」と書くと事実に反するため)
NOT_IN_RECORD = "記載なし(PubMed収載データに該当項目なし)"


@dataclass
class Article:
    pmid: str
    title: str = NOT_IN_RECORD
    authors: list = field(default_factory=list)
    journal: str = NOT_IN_RECORD
    year: str = NOT_IN_RECORD
    doi: str = NOT_IN_RECORD
    abstract: str = NOT_IN_RECORD
    other_abstracts: list = field(default_factory=list)
    copyright: str = ""
    languages: list = field(default_factory=list)
    publication_types: list = field(default_factory=list)
    keywords: list = field(default_factory=list)
    channels: list = field(default_factory=list)
    fetch_failed: bool = False
    fetch_error: str = ""

    @property
    def pubmed_url(self):
        return f"https://pubmed.ncbi.nlm.nih.gov/{self.pmid}/"

    @property
    def doi_url(self):
        if self.doi and self.doi not in (NOT_IN_RECORD, FETCH_FAILED):
            return f"https://doi.org/{self.doi}"
        return ""

    def to_dict(self):
        return {
            "pmid": self.pmid,
            "title": self.title,
            "authors": self.authors,
            "journal": self.journal,
            "year": self.year,
            "doi": self.doi,
            "abstract": self.abstract,
            "other_abstracts": self.other_abstracts,
            "copyright": self.copyright,
            "languages": self.languages,
            "publication_types": self.publication_types,
            "keywords": self.keywords,
            "channels": self.channels,
            "fetch_failed": self.fetch_failed,
            "fetch_error": self.fetch_error,
        }


def failed_article(pmid, reason):
    """efetchに失敗したPMIDのスタブ。空欄にせず「取得失敗」と明記する。"""
    return Article(
        pmid=pmid,
        title=FETCH_FAILED,
        journal=FETCH_FAILED,
        year=FETCH_FAILED,
        doi=FETCH_FAILED,
        abstract=FETCH_FAILED,
        fetch_failed=True,
        fetch_error=reason,
    )


def _text(element):
    """要素配下のテキストを、タグを除いてそのまま連結する(改変しない)。"""
    if element is None:
        return ""
    return "".join(element.itertext())


def _parse_authors(article_el):
    authors = []
    for author in article_el.findall("./AuthorList/Author"):
        collective = author.find("CollectiveName")
        if collective is not None:
            name = _text(collective).strip()
            if name:
                authors.append(name)
            continue
        last = _text(author.find("LastName")).strip()
        fore = _text(author.find("ForeName")).strip()
        if not last and not fore:
            initials = _text(author.find("Initials")).strip()
            if initials:
                authors.append(initials)
            continue
        authors.append(" ".join(part for part in (last, fore) if part))
    return authors


def _parse_year(article_el):
    pub_date = article_el.find("./Journal/JournalIssue/PubDate")
    if pub_date is not None:
        year = _text(pub_date.find("Year")).strip()
        if year:
            return year
        # 例: "2025 Nov-Dec" のような MedlineDate はそのまま保持する。
        medline_date = _text(pub_date.find("MedlineDate")).strip()
        if medline_date:
            return medline_date
    article_date_year = _text(article_el.find("./ArticleDate/Year")).strip()
    if article_date_year:
        return article_date_year
    return NOT_IN_RECORD


def _parse_doi(article_el, pubmed_data_el):
    for elocation in article_el.findall("./ELocationID"):
        if elocation.get("EIdType") == "doi":
            doi = _text(elocation).strip()
            if doi:
                return doi
    if pubmed_data_el is not None:
        for article_id in pubmed_data_el.findall("./ArticleIdList/ArticleId"):
            if article_id.get("IdType") == "doi":
                doi = _text(article_id).strip()
                if doi:
                    return doi
    return NOT_IN_RECORD


def _parse_abstract(abstract_el):
    """抄録を原文のまま組み立てる。

    構造化抄録のラベル(BACKGROUND等)はPubMedの収載データの一部なので保持する。
    本文の語句には一切手を加えない。
    """
    if abstract_el is None:
        return NOT_IN_RECORD, ""

    sections = []
    for node in abstract_el.findall("AbstractText"):
        body = _text(node)
        label = (node.get("Label") or "").strip()
        if not body.strip() and not label:
            continue
        sections.append({"label": label, "text": body})

    copyright_text = _text(abstract_el.find("CopyrightInformation")).strip()

    if not sections:
        return NOT_IN_RECORD, copyright_text

    if len(sections) == 1 and not sections[0]["label"]:
        return sections[0]["text"], copyright_text

    parts = []
    for section in sections:
        if section["label"]:
            parts.append(f"{section['label']}\n{section['text']}")
        else:
            parts.append(section["text"])
    return "\n\n".join(parts), copyright_text


def _parse_other_abstracts(citation_el):
    """原語抄録など(OtherAbstract)。翻訳せずそのまま保管する。"""
    others = []
    for other in citation_el.findall("./OtherAbstract"):
        text, _ = _parse_abstract(other)
        if text == NOT_IN_RECORD:
            continue
        others.append(
            {
                "language": (other.get("Language") or "").strip() or NOT_IN_RECORD,
                "type": (other.get("Type") or "").strip(),
                "text": text,
            }
        )
    return others


def _parse_keywords(citation_el):
    keywords = []
    for keyword in citation_el.findall("./KeywordList/Keyword"):
        value = _text(keyword).strip()
        if value:
            keywords.append(value)
    return keywords


def _parse_pubmed_article(node):
    citation = node.find("MedlineCitation")
    if citation is None:
        return None
    pmid = _text(citation.find("PMID")).strip()
    if not pmid:
        # PMIDの無いレコードは扱えない(各記事に必ずPMIDを付す方針のため)。
        return None

    article_el = citation.find("Article")
    if article_el is None:
        return Article(pmid=pmid)

    abstract_text, copyright_text = _parse_abstract(article_el.find("Abstract"))
    title = _text(article_el.find("ArticleTitle")).strip() or NOT_IN_RECORD

    journal = _text(article_el.find("./Journal/ISOAbbreviation")).strip()
    if not journal:
        journal = _text(article_el.find("./Journal/Title")).strip()
    if not journal:
        journal = NOT_IN_RECORD

    languages = [
        _text(lang).strip()
        for lang in article_el.findall("Language")
        if _text(lang).strip()
    ]
    publication_types = [
        _text(pt).strip()
        for pt in article_el.findall("./PublicationTypeList/PublicationType")
        if _text(pt).strip()
    ]

    return Article(
        pmid=pmid,
        title=title,
        authors=_parse_authors(article_el),
        journal=journal,
        year=_parse_year(article_el),
        doi=_parse_doi(article_el, node.find("PubmedData")),
        abstract=abstract_text,
        other_abstracts=_parse_other_abstracts(citation),
        copyright=copyright_text,
        languages=languages,
        publication_types=publication_types,
        keywords=_parse_keywords(citation),
    )


def _parse_pubmed_book_article(node):
    """書籍系レコード(PubmedBookArticle)。稀だが落とさず拾う。"""
    document = node.find("BookDocument")
    if document is None:
        return None
    pmid = _text(document.find("PMID")).strip()
    if not pmid:
        return None

    abstract_text, copyright_text = _parse_abstract(document.find("Abstract"))
    title = _text(document.find("ArticleTitle")).strip()
    if not title:
        title = _text(document.find("./Book/BookTitle")).strip() or NOT_IN_RECORD

    return Article(
        pmid=pmid,
        title=title,
        authors=_parse_authors(document),
        journal=_text(document.find("./Book/Publisher/PublisherName")).strip()
        or NOT_IN_RECORD,
        year=_text(document.find("./Book/PubDate/Year")).strip() or NOT_IN_RECORD,
        doi=_parse_doi(document, node.find("PubmedBookData")),
        abstract=abstract_text,
        copyright=copyright_text,
        publication_types=[
            _text(pt).strip()
            for pt in document.findall("./PublicationType")
            if _text(pt).strip()
        ],
        keywords=_parse_keywords(document),
    )


def parse_efetch_xml(xml_text):
    """efetchのXMLからArticleのリストを返す。"""
    root = ET.fromstring(xml_text)
    articles = []
    for node in root.findall("PubmedArticle"):
        article = _parse_pubmed_article(node)
        if article is not None:
            articles.append(article)
    for node in root.findall("PubmedBookArticle"):
        article = _parse_pubmed_book_article(node)
        if article is not None:
            articles.append(article)
    return articles


def parse_documents(documents):
    """複数のefetch応答XMLをまとめて解析し、PMID -> Article の辞書を返す。"""
    by_pmid = {}
    for xml_text in documents:
        for article in parse_efetch_xml(xml_text):
            by_pmid[article.pmid] = article
    return by_pmid
