"""PubMed検索式の定義。

ここに書かれた語は STEP 1 で PubMed 実機に問い合わせて検証済み:
  - MeSH 4語すべてが正式見出し語 ([Mesh] -> [MeSH Terms] に解決)
  - 雑誌9誌すべてが正式NLM略称 ([ta] -> [Journal] に解決)
  - KS の全tiab語・チャンネルAの全フィルタ語が 0件でないこと(静かな0件なし)

検索式を変更した場合は必ず STEP 1 と同じ検証(単体件数の確認)をやり直すこと。
"""

# --- KS: 共通ブロック(膝・肩の人工関節) -----------------------------------
# 注意: 改行を入れないこと(URLエンコード時の事故防止)。リストから組み立てる。
KS_TERMS = [
    '"Arthroplasty, Replacement, Knee"[Mesh]',
    '"Arthroplasty, Replacement, Shoulder"[Mesh]',
    '"Knee Prosthesis"[Mesh]',
    '"Shoulder Prosthesis"[Mesh]',
    '"total knee arthroplasty"[tiab]',
    "TKA[tiab]",
    '"knee arthroplasty"[tiab]',
    '"knee replacement"[tiab]',
    "unicompartmental[tiab]",
    "UKA[tiab]",
    "UKR[tiab]",
    '"shoulder arthroplasty"[tiab]',
    '"shoulder replacement"[tiab]',
    '"reverse shoulder"[tiab]',
    '"anatomic total shoulder"[tiab]',
    '"shoulder hemiarthroplasty"[tiab]',
]

# --- チャンネルA: 高エビデンス(「②中」設定) -------------------------------
# RCT・メタ解析の publication type に加え、人工関節で重要な
# レジストリ研究・インプラント生存率(survivorship)を tiab で拾う。
# ノイズの多い素の randomized/randomised/"revision rate" の tiab は「広」設定のみ。
CHANNEL_A_FILTER_TERMS = [
    "randomized controlled trial[pt]",
    "meta-analysis[pt]",
    "registry[tiab]",
    "survivorship[tiab]",
]

# 参考: 「広」設定にする場合に足す語(現在は不使用)。
CHANNEL_A_WIDE_EXTRA_TERMS = [
    "randomized[tiab]",  # 米式綴り
    "randomised[tiab]",  # 英式綴り
    '"revision rate"[tiab]',
]

# --- チャンネルB: コアジャーナル9誌 ---------------------------------------
CHANNEL_B_JOURNAL_TERMS = [
    '"J Arthroplasty"[ta]',
    '"J Bone Joint Surg Am"[ta]',
    '"Bone Joint J"[ta]',
    '"Clin Orthop Relat Res"[ta]',
    '"Acta Orthop"[ta]',
    '"J Shoulder Elbow Surg"[ta]',
    '"Knee Surg Sports Traumatol Arthrosc"[ta]',
    '"Knee"[ta]',
    '"J Orthop Sci"[ta]',
]

# 症例報告の publication type。A/Bからは除外し、チャンネルCとして別建てで保管する。
CASE_REPORT_PT = "case reports[pt]"


def _or_block(terms):
    return "(" + " OR ".join(terms) + ")"


KS = _or_block(KS_TERMS)
CHANNEL_A_FILTER = _or_block(CHANNEL_A_FILTER_TERMS)
CHANNEL_B_JOURNALS = _or_block(CHANNEL_B_JOURNAL_TERMS)

# 言語制限は設けない(翻訳可能なため、質の高い研究は言語を問わず取り込む)。
# 質の担保は「A=研究デザイン」「B=コア誌」で行う。
CHANNEL_A = f"{KS} AND {CHANNEL_A_FILTER} NOT {CASE_REPORT_PT}"
CHANNEL_B = f"{KS} AND {CHANNEL_B_JOURNALS} NOT {CASE_REPORT_PT}"
CHANNEL_C = f"{KS} AND {CASE_REPORT_PT}"

CHANNELS = {
    "A": CHANNEL_A,
    "B": CHANNEL_B,
    "C": CHANNEL_C,
}

CHANNEL_LABELS = {
    "A": "高エビデンス(RCT/メタ/レジストリ/survivorship)",
    "B": "コアジャーナル9誌",
    "C": "症例報告",
}

# 本体ノートに出すチャンネル(A∪B)と、別建て保管するチャンネル。
MAIN_CHANNELS = ("A", "B")
CASE_REPORT_CHANNEL = "C"
