"""監視トピックの定義。

ここに書かれた語はすべて PubMed 実機に問い合わせて検証済み:
  - MeSH語が正式見出し語であること([Mesh] -> [MeSH Terms] に解決)
  - 雑誌略記が正式NLM略称であること([ta] -> [Journal] に解決)
  - 各語が単体で0件でないこと(静かな0件がないこと)

検索式を変更した場合は必ず同じ検証をやり直すこと。

【使用しない略語】検証の結果、以下はノイズが多すぎるため単独では使わない:
  RSA[tiab] : 9,413件中8,049件(85%)がshoulder非言及
              (radiostereometric analysis, respiratory sinus arrhythmia 等)
  PRP[tiab] : 23,303件中12,846件(55%)がplatelet-rich plasma無関係
              (prion protein PrP 等)
  SSI[tiab] : "surgical site infection"以外に4,506件のノイズ
  PJI[tiab] はノイズ334件(6%)のみのため使用可。
"""

from dataclasses import dataclass, field

CASE_REPORT_PT = "case reports[pt]"


def _or_block(terms):
    return "(" + " OR ".join(terms) + ")"


# =========================================================================
# 検索ブロック
# =========================================================================

KNEE_TERMS = [
    '"Arthroplasty, Replacement, Knee"[Mesh]',
    '"Knee Prosthesis"[Mesh]',
    '"total knee arthroplasty"[tiab]',
    "TKA[tiab]",
    '"knee arthroplasty"[tiab]',
    '"knee replacement"[tiab]',
    "unicompartmental[tiab]",
    "UKA[tiab]",
    "UKR[tiab]",
]

# 肩はリバース型(RSA)を完全に取り込む。RSA単独エージェントを作らず
# ここに集約する方針(検証時、RSAブロックの98%が肩ブロックに含まれていたため)。
SHOULDER_TERMS = [
    '"Arthroplasty, Replacement, Shoulder"[Mesh]',
    '"Shoulder Prosthesis"[Mesh]',
    '"shoulder arthroplasty"[tiab]',
    '"shoulder replacement"[tiab]',
    '"reverse shoulder"[tiab]',
    '"reverse total shoulder"[tiab]',
    "rTSA[tiab]",
    '"anatomic total shoulder"[tiab]',
    '"shoulder hemiarthroplasty"[tiab]',
    '"Rotator Cuff Tear Arthropathy"[Mesh]',
]

CUFF_TERMS = [
    '"Rotator Cuff"[Mesh]',
    '"Rotator Cuff Injuries"[Mesh]',
    '"rotator cuff"[tiab]',
    '"cuff repair"[tiab]',
    "supraspinatus[tiab]",
    '"superior capsular reconstruction"[tiab]',
]

PRP_TERMS = [
    '"Platelet-Rich Plasma"[Mesh]',
    '"platelet-rich plasma"[tiab]',
    '"autologous conditioned plasma"[tiab]',  # ACP
]

# PRPは歯科・皮膚科・創傷治癒での使用が多いため、運動器に限定する。
MUSCULOSKELETAL_TERMS = [
    '"Musculoskeletal Diseases"[Mesh]',
    '"Orthopedic Procedures"[Mesh]',
    "knee[tiab]",
    "shoulder[tiab]",
    "tendinopathy[tiab]",
    "osteoarthritis[tiab]",
    '"rotator cuff"[tiab]',
    "cartilage[tiab]",
]

INFECTION_TERMS = [
    '"Prosthesis-Related Infections"[Mesh]',
    '"periprosthetic joint infection"[tiab]',
    '"prosthetic joint infection"[tiab]',
    "PJI[tiab]",
    '"septic arthritis"[tiab]',
    '"Osteomyelitis"[Mesh]',
    "DAIR[tiab]",  # debridement, antibiotics, implant retention
    '"two-stage revision"[tiab]',
    '"antibiotic spacer"[tiab]',
]

# =========================================================================
# エビデンスフィルタ
# =========================================================================

EVIDENCE_STRICT = [
    "randomized controlled trial[pt]",
    "meta-analysis[pt]",
]

# 人工関節ではレジストリ研究・インプラント生存率が重要なため加える。
EVIDENCE_WITH_REGISTRY = EVIDENCE_STRICT + [
    "registry[tiab]",
    "survivorship[tiab]",
]

# 腱板では再断裂率・腱癒合率が主要アウトカム。
EVIDENCE_CUFF = EVIDENCE_STRICT + [
    "retear[tiab]",
    '"healing rate"[tiab]',
]

# 感染症は相談相手がいない状況での意思決定支援が目的のため、
# ガイドラインとシステマティックレビューを重視する。
EVIDENCE_INFECTION = EVIDENCE_STRICT + [
    "guideline[pt]",
    "systematic review[pt]",
]

# =========================================================================
# 雑誌
# =========================================================================

KNEE_JOURNALS = [
    '"J Arthroplasty"[ta]',
    '"J Bone Joint Surg Am"[ta]',
    '"Bone Joint J"[ta]',
    '"Clin Orthop Relat Res"[ta]',
    '"Acta Orthop"[ta]',
]

SHOULDER_JOURNALS = [
    '"J Shoulder Elbow Surg"[ta]',
    '"JSES Int"[ta]',
    '"Shoulder Elbow"[ta]',
    '"J Arthroplasty"[ta]',
    '"J Bone Joint Surg Am"[ta]',
    '"Bone Joint J"[ta]',
    '"Clin Orthop Relat Res"[ta]',
    '"Acta Orthop"[ta]',
    '"J Orthop Sci"[ta]',
]

CUFF_JOURNALS = [
    '"J Shoulder Elbow Surg"[ta]',
    '"Arthroscopy"[ta]',
    '"Am J Sports Med"[ta]',
    '"Orthop J Sports Med"[ta]',
    '"JSES Int"[ta]',
    '"Shoulder Elbow"[ta]',
    '"Knee Surg Sports Traumatol Arthrosc"[ta]',
    '"J Bone Joint Surg Am"[ta]',
    '"Bone Joint J"[ta]',
    '"J Orthop Sci"[ta]',
]

INFECTION_JOURNALS = [
    '"J Bone Jt Infect"[ta]',
    '"Clin Infect Dis"[ta]',
    '"J Arthroplasty"[ta]',
    '"Bone Joint J"[ta]',
    '"J Bone Joint Surg Am"[ta]',
    '"Clin Orthop Relat Res"[ta]',
]


# =========================================================================
# トピック定義
# =========================================================================


@dataclass
class Channel:
    key: str
    label: str
    query: str
    is_case_reports: bool = False


@dataclass
class Topic:
    id: str
    label: str
    folder: str
    channels: list
    core: str = ""          # 検索対象を定めるブロック。別フィルタとの合成に使う
    tags: list = field(default_factory=list)
    note: str = ""

    @property
    def main_channels(self):
        return [c for c in self.channels if not c.is_case_reports]

    @property
    def case_channel(self):
        for channel in self.channels:
            if channel.is_case_reports:
                return channel
        return None

    def channel(self, key):
        for channel in self.channels:
            if channel.key == key:
                return channel
        return None


def _standard_channels(core, evidence_terms, journals, evidence_label,
                       journal_label):
    """A(エビデンス) / B(コア誌) / C(症例報告) の標準3チャンネル構成。"""
    channels = [
        Channel(
            key="A",
            label=evidence_label,
            query=f"{core} AND {_or_block(evidence_terms)} NOT {CASE_REPORT_PT}",
        )
    ]
    if journals:
        channels.append(
            Channel(
                key="B",
                label=journal_label,
                query=f"{core} AND {_or_block(journals)} NOT {CASE_REPORT_PT}",
            )
        )
    channels.append(
        Channel(
            key="C",
            label="症例報告",
            query=f"{core} AND {CASE_REPORT_PT}",
            is_case_reports=True,
        )
    )
    return channels


KNEE_CORE = _or_block(KNEE_TERMS)
SHOULDER_CORE = _or_block(SHOULDER_TERMS)
CUFF_CORE = _or_block(CUFF_TERMS)
INFECTION_CORE = _or_block(INFECTION_TERMS)
# PRPは他トピックと異なり、エビデンスフィルタではなく
# 「運動器に限定する」ことで件数を絞る構成にしている。
PRP_CORE = f"{_or_block(PRP_TERMS)} AND {_or_block(MUSCULOSKELETAL_TERMS)}"

# 遡り取得(過去分)用のフィルタ。確立した知識の土台を集めるため、
# 個々の観察研究ではなくSR・メタ解析・ガイドラインに絞る。
HIGH_EVIDENCE_TERMS = [
    "systematic review[pt]",
    "meta-analysis[pt]",
    "practice guideline[pt]",
    "guideline[pt]",
]


def high_evidence_channel(topic):
    """トピックのコアブロックに高エビデンスフィルタをかけたチャンネル。"""
    return Channel(
        key="H",
        label="高エビデンス(SR/メタ解析/ガイドライン)",
        query=(f"{topic.core} AND {_or_block(HIGH_EVIDENCE_TERMS)}"
               f" NOT {CASE_REPORT_PT}"),
    )

TOPICS = {}


def _register(topic):
    TOPICS[topic.id] = topic
    return topic


# --- 人工関節(膝) --- 実測 週約18件 ------------------------------------
# 週20件に収めるため、チャンネルAはRCT/メタのみに絞りコア誌も5誌に限定。
# レジストリ研究・survivorship研究はコア5誌に載るものはBで捕捉される。
_register(
    Topic(
        id="knee",
        label="人工関節(膝)",
        folder="人工関節-膝",
        tags=["文献監視", "人工関節", "膝"],
        core=KNEE_CORE,
        channels=_standard_channels(
            KNEE_CORE,
            EVIDENCE_STRICT,
            KNEE_JOURNALS,
            "高エビデンス(RCT/メタ解析)",
            "コアジャーナル5誌",
        ),
    )
)

# --- 人工関節(肩) + リバース型 --- 実測 週約9件 -------------------------
_register(
    Topic(
        id="shoulder",
        label="人工関節(肩)・リバース型",
        folder="人工関節-肩",
        tags=["文献監視", "人工関節", "肩", "リバース型"],
        core=SHOULDER_CORE,
        channels=_standard_channels(
            SHOULDER_CORE,
            EVIDENCE_WITH_REGISTRY,
            SHOULDER_JOURNALS,
            "高エビデンス(RCT/メタ/レジストリ/survivorship)",
            "肩関連9誌",
        ),
    )
)

# --- 腱板 --- 実測 週約12件 ---------------------------------------------
_register(
    Topic(
        id="cuff",
        label="腱板(修復術・断裂)",
        folder="腱板",
        tags=["文献監視", "腱板"],
        core=CUFF_CORE,
        channels=_standard_channels(
            CUFF_CORE,
            EVIDENCE_CUFF,
            CUFF_JOURNALS,
            "高エビデンス(RCT/メタ/retear/healing rate)",
            "肩・スポーツ関連10誌",
        ),
    )
)

# --- PRP(整形外科・運動器に限定) --- 実測 週約10件 ----------------------
# PRPは歯科・皮膚科・創傷治癒での使用が多く(全分野だと年1,643件)、
# 運動器に限定して年540件。ACP(autologous conditioned plasma)も含む。
_register(
    Topic(
        id="prp",
        label="多血小板血漿(PRP・運動器)",
        folder="PRP",
        core=PRP_CORE,
        tags=["文献監視", "PRP"],
        channels=[
            Channel(
                key="A",
                label="運動器PRP全般",
                query=(
                    f"{PRP_CORE} NOT {CASE_REPORT_PT}"
                ),
            ),
            Channel(
                key="C",
                label="症例報告",
                query=f"{PRP_CORE} AND {CASE_REPORT_PT}",
                is_case_reports=True,
            ),
        ],
    )
)

# --- 術後感染症 --- 実測 週約8件 ----------------------------------------
# 感染症内科に相談できない状況での意思決定支援が目的のため、
# チャンネルAにガイドラインとシステマティックレビューを含める。
# 症例報告(年410件)は稀な起因菌の参考になるため保管庫に蓄積する。
_register(
    Topic(
        id="infection",
        label="術後感染症(人工関節感染・骨髄炎)",
        folder="術後感染症",
        tags=["文献監視", "術後感染症"],
        note="臨床判断は行わない。情報収集のみ。治療方針は主治医・専門医の判断による。",
        core=INFECTION_CORE,
        channels=_standard_channels(
            INFECTION_CORE,
            EVIDENCE_INFECTION,
            INFECTION_JOURNALS,
            "高エビデンス(RCT/メタ/ガイドライン/システマティックレビュー)",
            "感染症・整形6誌",
        ),
    )
)


DEFAULT_TOPIC_IDS = list(TOPICS.keys())


def get_topic(topic_id):
    if topic_id not in TOPICS:
        raise KeyError(
            f"未知のトピック: {topic_id} (利用可能: {', '.join(TOPICS)})"
        )
    return TOPICS[topic_id]
