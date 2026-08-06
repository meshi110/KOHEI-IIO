/*
 * ボイス検査 speech
 * ブラウザの音声合成(読み上げ)と音声認識のアダプタ。
 * - 読み上げ: speechSynthesis (端末内処理)
 * - 認識: SpeechRecognition。対応環境では端末内処理(processLocally)を優先するが、
 *   Chrome系では既定で音声が認識サーバーへ送信される。アプリ側の注意事項で明示する。
 */
(function (global) {
  "use strict";

  const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
  const synth = global.speechSynthesis;

  function srSupported() { return !!SR; }
  function ttsSupported() { return !!(synth && global.SpeechSynthesisUtterance); }

  function jaVoices() {
    if (!synth) return [];
    return synth.getVoices().filter((v) => /^ja/i.test(v.lang));
  }

  // 読み上げ(終了で解決)。iOSでonendが発火しない場合に備えタイムアウト保険付き
  function speak(text, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      if (!ttsSupported()) { resolve(); return; }
      try { synth.cancel(); } catch (_e) { /* noop */ }
      const u = new global.SpeechSynthesisUtterance(String(text));
      u.lang = "ja-JP";
      u.rate = opts.rate || 1;
      if (opts.voiceURI) {
        const v = synth.getVoices().find((x) => x.voiceURI === opts.voiceURI);
        if (v) u.voice = v;
      }
      let done = false;
      let tid = 0;
      const fin = () => {
        if (done) return;
        done = true;
        clearTimeout(tid);
        resolve();
      };
      u.onend = fin;
      u.onerror = fin;
      tid = setTimeout(fin, Math.max(3000, String(text).length * 400));
      synth.speak(u);
    });
  }

  // 連続認識。stop()は即時黙らせる(読み上げの拾い込み防止)ため abort を使う
  function createRecognizer(handlers) {
    if (!SR) return null;
    let enabled = false;
    let running = false;
    let restartTid = 0;
    const rec = new SR();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;
    try {
      if ("processLocally" in rec) rec.processLocally = true;
    } catch (_e) { /* 非対応なら既定(サーバー処理)のまま */ }

    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const t = res[0] && res[0].transcript ? res[0].transcript.trim() : "";
        if (t) handlers.onText(t, res.isFinal);
      }
    };
    rec.onstart = () => { running = true; if (handlers.onState) handlers.onState("listening"); };
    rec.onend = () => {
      running = false;
      if (handlers.onState) handlers.onState(enabled ? "restarting" : "idle");
      if (enabled) {
        clearTimeout(restartTid);
        restartTid = setTimeout(() => { try { rec.start(); } catch (_e) { /* 二重start */ } }, 200);
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        enabled = false;
        if (handlers.onState) handlers.onState("denied");
      }
    };

    return {
      start() {
        enabled = true;
        if (!running) { try { rec.start(); } catch (_e) { /* 二重start */ } }
      },
      stop() {
        enabled = false;
        clearTimeout(restartTid);
        try { rec.abort(); } catch (_e) { /* noop */ }
      },
      isRunning: () => running,
    };
  }

  global.VexSpeech = { srSupported, ttsSupported, jaVoices, speak, createRecognizer };
})(window);
