/*
 * ROMレコーダー voice
 * ブラウザ標準の Web Speech API (SpeechRecognition) をラップする。
 *
 * 【重要・プライバシー】
 * Chrome/Edge系ブラウザでは、音声認識は端末内で完結せず、音声データが
 * ブラウザベンダーのサーバへ送信されて処理される場合がある。
 * そのため本アプリでは:
 *   - 音声入力は既定オフ。設定で明示的に有効化したときだけ使う
 *   - 音声で扱うのは「部位・左右・数値」のみ。患者IDや氏名は音声で扱わない
 *     (患者IDは画面で選択する。認識テキストも患者情報を含まない前提)
 * この方針はUI文言・READMEにも明記する。
 */
(function (global) {
  "use strict";

  function getCtor() {
    return global.SpeechRecognition || global.webkitSpeechRecognition || null;
  }

  function isSupported() {
    return !!getCtor();
  }

  /**
   * 端末内(オンデバイス)処理が使えるか調べる。
   * 対応ブラウザでは SpeechRecognition.available() が返す状態を利用する。
   * 戻り値: "available"(すぐ使える) | "downloadable"(言語パックの取得が必要)
   *        | "unavailable"(端末内処理は不可) | "unknown"(照会APIが無い)
   */
  async function localAvailability(lang) {
    const Ctor = getCtor();
    if (!Ctor || typeof Ctor.available !== "function") return "unknown";
    try {
      const r = await Ctor.available({ langs: [lang || "ja-JP"], processLocally: true });
      if (typeof r === "string") return r;
      return r ? "available" : "unavailable";
    } catch (_e) {
      return "unknown";
    }
  }

  /** 端末内処理用の言語パックの取得を促す(対応ブラウザのみ) */
  async function installLocal(lang) {
    const Ctor = getCtor();
    if (!Ctor || typeof Ctor.install !== "function") return false;
    try {
      return !!(await Ctor.install({ langs: [lang || "ja-JP"], processLocally: true }));
    } catch (_e) {
      return false;
    }
  }

  /**
   * 連続認識のコントローラを作る。
   * opts: {
   *   lang, onResult(text, isFinal), onStart, onEnd, onError(kind, message)
   * }
   */
  function createRecognizer(opts) {
    opts = opts || {};
    const Ctor = getCtor();
    if (!Ctor) return null;

    let rec = null;
    let running = false;      // 利用者が「オン」にしている状態
    let restarting = false;
    let localMode = false;    // 端末内処理で動作しているか

    function build() {
      const r = new Ctor();
      r.lang = opts.lang || "ja-JP";
      r.continuous = true;      // 1文ごとに止まらず聞き続ける
      r.interimResults = true;  // 認識途中の文字列も表示して手応えを出す
      r.maxAlternatives = 1;
      // 端末内処理が使える環境では、音声を外部に出さない設定を優先する
      if (localMode && "processLocally" in r) r.processLocally = true;

      r.onresult = (ev) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const text = res[0] && res[0].transcript ? res[0].transcript.trim() : "";
          if (!text) continue;
          if (opts.onResult) opts.onResult(text, res.isFinal);
        }
      };

      r.onerror = (ev) => {
        const kind = ev.error || "unknown";
        // no-speech / aborted は日常的に起きるので、致命扱いしない
        if (kind === "no-speech" || kind === "aborted") return;
        if (opts.onError) opts.onError(kind, describeError(kind));
        if (kind === "not-allowed" || kind === "service-not-allowed") {
          running = false;
          if (opts.onEnd) opts.onEnd();
        }
      };

      r.onend = () => {
        // continuousでも無音が続くと自動終了するため、利用者がオンの間は再開する
        if (running && !restarting) {
          restarting = true;
          setTimeout(() => {
            restarting = false;
            if (running) {
              try { r.start(); } catch (_e) { /* 二重startは無視 */ }
            }
          }, 250);
        } else if (!running && opts.onEnd) {
          opts.onEnd();
        }
      };

      return r;
    }

    function describeError(kind) {
      switch (kind) {
        case "not-allowed":
        case "service-not-allowed":
          return "マイクの使用が許可されていません。ブラウザの設定で許可してください";
        case "network":
          return "音声認識サービスに接続できません(この機能はオンライン接続が必要です)";
        case "audio-capture":
          return "マイクが見つかりません";
        default:
          return "音声認識でエラーが発生しました (" + kind + ")";
      }
    }

    return {
      isRunning: () => running,
      isLocal: () => localMode,
      async start() {
        if (running) return true;
        if (!global.isSecureContext) {
          if (opts.onError) opts.onError("insecure", "音声入力は https または localhost でのみ使用できます");
          return false;
        }
        // 端末内処理が使えるなら、それを優先して音声を外部に出さない
        if (rec === null) {
          const avail = await localAvailability(opts.lang || "ja-JP");
          localMode = (avail === "available");
          if (opts.onMode) opts.onMode(localMode ? "local" : "remote", avail);
        }
        if (!rec) rec = build();
        running = true;
        try {
          rec.start();
        } catch (_e) {
          // すでに開始済みの場合など
        }
        if (opts.onStart) opts.onStart();
        return true;
      },
      stop() {
        running = false;
        if (rec) {
          try { rec.stop(); } catch (_e) { /* noop */ }
        }
        if (opts.onEnd) opts.onEnd();
      },
      toggle() {
        if (running) { this.stop(); return false; }
        return this.start();
      },
    };
  }

  global.Voice = { isSupported, createRecognizer, localAvailability, installLocal };
})(window);
