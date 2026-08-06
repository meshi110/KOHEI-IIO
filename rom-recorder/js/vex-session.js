/*
 * ボイス検査 session
 * 音声ガイド評価の進行ステートマシン(純粋ロジック)。
 * 入出力は io として注入するため、Node で通しテストできる。
 *   io.speak(text) => Promise (読み上げ終了で解決)
 *   io.startListen() / io.stopListen()
 * 読み上げ中は認識を止め、読み上げ終了後に認識を再開する
 * (スピーカー出力を自分で拾う誤認識を避けるため)。
 */
(function (global) {
  "use strict";

  const Parse = (typeof module !== "undefined" && module.exports)
    ? require("./vex-parse.js")
    : global.VexParse;

  // テンプレート(items)を実行ステップ列に展開する。両側項目は 右→左 の2ステップ。
  // label = 画面表示、say = 読み上げ(英語略語を日本語読みにするため item.say を使う)
  function buildSteps(items) {
    const steps = [];
    for (const it of items || []) {
      if (!it || !it.name) continue;
      const spoken = it.say || it.name;
      if (it.bilateral) {
        for (const [side, label] of [["right", "右"], ["left", "左"]]) {
          steps.push({
            key: it.id + ":" + side,
            itemId: it.id,
            name: it.name,
            side: label,
            label: it.name + " " + label,
            say: label + "、" + spoken,
            type: it.type || "pm",
            unit: it.unit || "",
          });
        }
      } else {
        steps.push({
          key: it.id + ":both",
          itemId: it.id,
          name: it.name,
          side: "",
          label: it.name,
          say: spoken,
          type: it.type || "pm",
          unit: it.unit || "",
        });
      }
    }
    return steps;
  }

  // runner: start() で開始し、認識結果は handleText(text) に流し込む
  function createRunner(steps, io, opts) {
    opts = opts || {};
    const echo = opts.echo !== false;
    const results = steps.map(() => null);
    let idx = 0;
    let status = "idle"; // idle | prompting | listening | paused | done
    let busy = false;    // 読み上げ中の再入防止

    function state() {
      return { idx, total: steps.length, status, step: steps[idx] || null, results };
    }
    function update() { if (opts.onUpdate) opts.onUpdate(state()); }

    async function speak(text) {
      io.stopListen();
      try { await io.speak(text); } catch (_e) { /* 読み上げ失敗でも進行は続ける */ }
    }

    function listen() {
      status = "listening";
      io.startListen();
      update();
    }

    async function promptCurrent(prefix) {
      if (status === "done") return;
      if (idx >= steps.length) return finish(false);
      status = "prompting";
      update();
      await speak((prefix || "") + (steps[idx].say || steps[idx].label));
      if (status !== "prompting") return; // 途中で終了/一時停止された
      listen();
    }

    async function finish(aborted) {
      if (status === "done") return;
      status = "done";
      io.stopListen();
      update();
      await speak(aborted ? "途中で終了します。" : "評価終了です。おつかれさまでした。");
      if (opts.onDone) opts.onDone(results, { aborted: !!aborted });
    }

    async function start() {
      idx = 0;
      await speak("評価を開始します。");
      return promptCurrent();
    }

    async function handleText(text) {
      if (busy || status === "done" || status === "idle" || status === "prompting") return;
      busy = true;
      try {
        const cmd = Parse.command(text);

        if (status === "paused") {
          if (cmd === "resume") {
            await speak("再開します。");
            await promptCurrent();
          } else if (cmd === "end") {
            await finish(true);
          } else {
            io.startListen(); // 一時停止のまま「再開/終了」だけを聞き続ける
          }
          return;
        }

        if (cmd === "skip") {
          results[idx] = { status: "skip", raw: text };
          idx++;
          await speak("スキップします。");
          await promptCurrent(idx < steps.length ? "次、" : "");
          return;
        }
        if (cmd === "back") {
          idx = Math.max(0, idx - 1);
          results[idx] = null;
          await speak("戻ります。");
          await promptCurrent();
          return;
        }
        if (cmd === "repeat") {
          await promptCurrent();
          return;
        }
        if (cmd === "pause") {
          status = "paused";
          update();
          await speak("一時停止します。再開、と言うと続きから始まります。");
          status = "paused";
          io.startListen(); // 「再開」を聞き続ける
          update();
          return;
        }
        if (cmd === "end") {
          await finish(true);
          return;
        }

        const step = steps[idx];
        const parsed = Parse.answerWithUnit(step, text);
        if (!parsed) {
          await speak("聞き取れませんでした。もう一度どうぞ。");
          listen();
          return;
        }
        results[idx] = { status: "done", value: parsed.value, display: parsed.display, raw: text };
        idx++;
        if (echo) await speak(parsed.display + "。");
        await promptCurrent(idx < steps.length ? "次、" : "");
      } finally {
        busy = false;
      }
    }

    return {
      start,
      handleText,
      finish: () => finish(true),
      state,
      // 画面ボタンからの操作(音声コマンドと同じ動き)
      skip: () => handleText("スキップ"),
      back: () => handleText("戻る"),
      repeat: () => handleText("もう一度"),
      pause: () => handleText("一時停止"),
      resume: () => handleText("再開"),
    };
  }

  const api = { buildSteps, createRunner };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.VexSession = api;
})(typeof window !== "undefined" ? window : globalThis);
