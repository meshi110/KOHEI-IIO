"""設定の読み込み。

秘密情報(APIキー・メールアドレス)はコードに直書きせず .env から読む。
優先順位: 環境変数 > .env > 既定値
"""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# 出力先は「Obsidianが実際に読みに行くvault」を指す必要がある。
# そうでないとノートがObsidianに取り込まれず、検索もリンクも効かない。
# iCloud Drive の「デスクトップ」同期が有効な Mac では ~/Desktop が iCloud 上の
# デスクトップそのものを指す。同期が無効な場合は .env でフルパスを指定する:
#   ~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/KOHEI-Vault
DEFAULT_VAULT_DIR = "~/Desktop/KOHEI-Vault"

# vault 内のサブフォルダ。この下にトピックごとのフォルダを作る。
#   <vault>/文献監視/<トピックのフォルダ名>/YYYY-MM-DD.md
DEFAULT_SUBDIR = "文献監視"
CASE_REPORTS_FOLDER = "症例報告"

# NCBI の規約レート。APIキーありで10req/秒、なしで3req/秒。
# 「厳守」のため、上限そのものではなく少し下を実効レートとして使う。
RATE_WITH_KEY = 9.0
RATE_WITHOUT_KEY = 2.8


def load_dotenv(path):
    """依存パッケージ無しの最小 .env パーサ。"""
    values = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


class ConfigError(Exception):
    pass


class Config:
    def __init__(self, values):
        self._values = values

        # NCBI規約: tool と email は全リクエストに必須。
        self.tool = values.get("NCBI_TOOL", "arthroplasty-watch")
        self.email = values.get("NCBI_EMAIL", "").strip()
        self.api_key = values.get("NCBI_API_KEY", "").strip() or None

        vault = values.get("VAULT_DIR", DEFAULT_VAULT_DIR).strip() or DEFAULT_VAULT_DIR
        self.vault_dir = Path(os.path.expanduser(vault))

        self.subdir = values.get("SUBDIR", DEFAULT_SUBDIR).strip() or DEFAULT_SUBDIR

        state_dir = values.get("STATE_DIR", "").strip()
        self.state_dir = (
            Path(os.path.expanduser(state_dir)) if state_dir else PROJECT_ROOT / "state"
        )

        self.reldate = int(values.get("RELDATE", "10"))
        self.timeout = int(values.get("HTTP_TIMEOUT", "30"))
        self.max_retries = int(values.get("MAX_RETRIES", "4"))

    @property
    def rate_per_second(self):
        return RATE_WITH_KEY if self.api_key else RATE_WITHOUT_KEY

    # -- トピック別のパス ---------------------------------------------------
    def state_path(self, topic_id):
        return self.state_dir / f"seen_pmids_{topic_id}.json"

    def case_archive_path(self, topic_id):
        return self.state_dir / f"case_reports_{topic_id}.jsonl"

    def main_output_dir(self, topic):
        return self.vault_dir / self.subdir / topic.folder

    def case_output_dir(self, topic):
        return self.vault_dir / self.subdir / topic.folder / CASE_REPORTS_FOLDER

    # -- 移行前の旧パス(1トピック時代) --------------------------------------
    @property
    def legacy_state_path(self):
        return self.state_dir / "seen_pmids.json"

    @property
    def legacy_case_archive_path(self):
        return self.state_dir / "case_reports.jsonl"

    def require_email(self):
        """NCBI規約上 email は必須。未設定なら実行を止める。"""
        if not self.email:
            raise ConfigError(
                "NCBI_EMAIL が未設定です。NCBIの規約により tool= と email= は必須です。\n"
                ".env に NCBI_EMAIL=あなたのメールアドレス を設定してください。"
            )

    def describe(self):
        key_state = "あり(10req/秒)" if self.api_key else "なし(3req/秒)"
        return "\n".join(
            [
                f"  tool           : {self.tool}",
                f"  email          : {self.email or '(未設定)'}",
                f"  APIキー        : {key_state}",
                f"  実効レート     : {self.rate_per_second} req/秒",
                f"  vault          : {self.vault_dir}",
                f"  出力先         : {self.vault_dir / self.subdir}/<トピック>/",
                f"  状態ディレクトリ: {self.state_dir}",
            ]
        )


def load_config(env_path=None):
    env_path = Path(env_path) if env_path else PROJECT_ROOT / ".env"
    values = dict(load_dotenv(env_path))
    # 環境変数を優先。
    for key in (
        "NCBI_TOOL",
        "NCBI_EMAIL",
        "NCBI_API_KEY",
        "VAULT_DIR",
        "STATE_DIR",
        "RELDATE",
        "HTTP_TIMEOUT",
        "MAX_RETRIES",
    ):
        if os.environ.get(key):
            values[key] = os.environ[key]
    return Config(values)
