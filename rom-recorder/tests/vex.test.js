/*
 * ボイス検査(vex-*) のユニットテスト (Node実行: node tests/vex.test.js)
 * 回答パーサー・進行ステートマシン・シート保存を疑似ioで通しテストする。
 */
"use strict";
const assert = require("assert");
const P = require("../js/vex-parse.js");
const S = require("../js/vex-session.js");
const Items = require("../js/vex-items.js");
const VStore = require("../js/vex-store.js");

let passed = 0;
function ok(name, fn) {
  const r = fn();
  const done = () => { passed++; console.log("  ok - " + name); };
  if (r && typeof r.then === "function") return r.then(done);
  done();
}

(async () => {

console.log("parse:");

await ok("±: 陽性/プラス/陰性/なし/判定不能", () => {
  assert.strictEqual(P.parsePM("陽性").value, "+");
  assert.strictEqual(P.parsePM("プラスです").value, "+");
  assert.strictEqual(P.parsePM("陰性").value, "-");
  assert.strictEqual(P.parsePM("痛みなし").value, "-");
  assert.strictEqual(P.parsePM("判定不能").value, "判定不能");
  assert.strictEqual(P.parsePM("こんにちは"), null);
});

await ok("数値: 算用/漢数字/小数/マイナス/全角/範囲外棄却", () => {
  assert.strictEqual(P.parseNum("45").value, 45);
  assert.strictEqual(P.parseNum("九十").value, 90);
  assert.strictEqual(P.parseNum("45.5度").value, 45.5);
  assert.strictEqual(P.parseNum("マイナス20").value, -20, "膝伸展のマイナス値");
  assert.strictEqual(P.parseNum("１２０").value, 120);
  assert.strictEqual(P.parseNum("たくさん"), null);
  assert.strictEqual(P.parseNum("9999"), null);
});

await ok("長音「ー」を負号と誤解釈しない", () => {
  assert.strictEqual(P.parseNum("えーっと"), null);
  assert.strictEqual(P.toHalfWidth("エーティーアール").includes("-"), false);
});

await ok("MMT: 4プラス/五マイナス/範囲外棄却", () => {
  assert.strictEqual(P.parseMMT("4プラス").value, "4+");
  assert.strictEqual(P.parseMMT("4+").value, "4+");
  assert.strictEqual(P.parseMMT("五マイナス").value, "5-");
  assert.strictEqual(P.parseMMT("3").value, "3");
  assert.strictEqual(P.parseMMT("7"), null);
});

await ok("反射: 数値と記述語を0〜4+へ正規化", () => {
  assert.strictEqual(P.parseReflex("2プラス").value, "2+");
  assert.strictEqual(P.parseReflex("正常").value, "2+");
  assert.strictEqual(P.parseReflex("亢進").value, "3+");
  assert.strictEqual(P.parseReflex("低下").value, "1+");
  assert.strictEqual(P.parseReflex("消失").value, "0");
  assert.strictEqual(P.parseReflex("クローヌス").value, "4+");
  assert.strictEqual(P.parseReflex("プラスマイナス").value, "±");
  assert.strictEqual(P.parseReflex("ぜんぜんわからない"), null);
});

await ok("反射: 表示に説明語が付く", () => {
  assert.strictEqual(P.parseReflex("3").display, "3+ 亢進");
  assert.strictEqual(P.parseReflex("0").display, "0 消失");
});

await ok("レベル: Th7/ティーエイチ7/腰椎4/殿部", () => {
  assert.strictEqual(P.parseLevel("Th7").value, "Th7");
  assert.strictEqual(P.parseLevel("ティーエイチ7").value, "Th7");
  assert.strictEqual(P.parseLevel("腰椎4").value, "L4");
  assert.strictEqual(P.parseLevel("シー7").value, "C7");
  assert.strictEqual(P.parseLevel("殿部まで").value, "殿部");
  assert.strictEqual(P.parseLevel("Th13"), null);
});

await ok("NRS: 0-10の整数のみ", () => {
  assert.strictEqual(P.parseNRS("7").value, 7);
  assert.strictEqual(P.parseNRS("十").value, 10);
  assert.strictEqual(P.parseNRS("11"), null);
});

await ok("コマンド認識(回答をコマンド扱いしない)", () => {
  assert.strictEqual(P.command("スキップ"), "skip");
  assert.strictEqual(P.command("戻る"), "back");
  assert.strictEqual(P.command("もう一度"), "repeat");
  assert.strictEqual(P.command("一時停止"), "pause");
  assert.strictEqual(P.command("再開"), "resume");
  assert.strictEqual(P.command("終了"), "end");
  assert.strictEqual(P.command("45度"), null);
  assert.strictEqual(P.command("陽性"), null);
});

console.log("items(診察ルーティーン):");

await ok("初期シート3種が定義されている", () => {
  const t = Items.defaultTemplates();
  assert.deepStrictEqual(t.map((x) => x.name),
    ["脊椎 診察ルーティーン", "肩 診察ルーティーン", "膝 診察ルーティーン"]);
});

await ok("脊椎シート: 主要項目とタイプ", () => {
  const spine = Items.defaultTemplates()[0];
  const byName = (n) => spine.items.find((i) => i.name === n);
  assert.ok(byName("Deltoid") && byName("Deltoid").type === "mmt");
  assert.ok(byName("BTR") && byName("BTR").type === "reflex");
  assert.ok(byName("Hoffman") && byName("Hoffman").type === "pm");
  assert.ok(byName("Spurling") && byName("Spurling").type === "pm");
  assert.ok(byName("EHL") && byName("EHL").type === "mmt");
  assert.ok(byName("Babinski") && byName("Babinski").type === "pm");
  assert.ok(byName("SLR") && byName("SLR").type === "pm");
  assert.ok(byName("FNST"));
  assert.ok(byName("排尿障害") && byName("排尿障害").bilateral === false);
  assert.ok(byName("Sensory disturbance").type === "text");
  assert.ok(byName("PVM tenderness").bilateral === true);
});

await ok("肩シート: ROM/IRレベル/圧痛5部位", () => {
  const sh = Items.defaultTemplates()[1];
  const byName = (n) => sh.items.find((i) => i.name === n);
  assert.strictEqual(byName("Elevation").type, "num");
  assert.strictEqual(byName("Elevation").unit, "°");
  assert.strictEqual(byName("IR(母指最高位)").type, "level");
  assert.strictEqual(byName("Full can").type, "pm");
  for (const n of ["圧痛 Coracoid", "圧痛 CHL", "圧痛 LHB", "圧痛 SSp", "圧痛 ISp"]) assert.ok(byName(n), n);
  assert.ok(byName("Swallow tail sign"));
});

await ok("膝シート: ROMと徒手テスト", () => {
  const kn = Items.defaultTemplates()[2];
  const names = kn.items.map((i) => i.name);
  for (const n of ["Extension", "Flexion", "Ballottement", "McMurray", "Lachman", "Valgus stress", "Varus stress", "Sagging"]) {
    assert.ok(names.includes(n), n);
  }
});

await ok("英語略語に日本語の読みが付いている", () => {
  const spine = Items.defaultTemplates()[0];
  const btr = spine.items.find((i) => i.name === "BTR");
  assert.strictEqual(btr.say, "上腕二頭筋反射");
  const ehl = spine.items.find((i) => i.name === "EHL");
  assert.strictEqual(ehl.say, "長母趾伸筋");
});

console.log("session:");

function makeIO() {
  const log = { spoken: [], listen: 0, stop: 0 };
  return {
    log,
    speak(t) { log.spoken.push(t); return Promise.resolve(); },
    startListen() { log.listen++; },
    stopListen() { log.stop++; },
  };
}

const ITEMS = [
  { id: "a", name: "BTR", say: "上腕二頭筋反射", type: "reflex", bilateral: true },
  { id: "b", name: "Elevation", say: "挙上", type: "num", unit: "°", bilateral: false },
];

await ok("buildSteps: 両側は右→左、読み上げは日本語の読み", () => {
  const steps = S.buildSteps(ITEMS);
  assert.deepStrictEqual(steps.map((s) => s.label), ["BTR 右", "BTR 左", "Elevation"]);
  assert.deepStrictEqual(steps.map((s) => s.say), ["右、上腕二頭筋反射", "左、上腕二頭筋反射", "挙上"]);
});

await ok("通し: 読み上げ→回答→自動前進→完了", async () => {
  const io = makeIO();
  let done = null;
  const r = S.createRunner(S.buildSteps(ITEMS), io, { onDone: (res) => { done = res; } });
  await r.start();
  assert.ok(io.log.spoken.some((t) => t.includes("右、上腕二頭筋反射")), "日本語読みで読み上げ");
  await r.handleText("2プラス");
  await r.handleText("亢進");
  await r.handleText("百二十");
  assert.ok(done);
  assert.strictEqual(done[0].value, "2+");
  assert.strictEqual(done[1].value, "3+");
  assert.strictEqual(done[2].value, 120);
  assert.strictEqual(done[2].display, "120°");
  assert.ok(io.log.spoken.some((t) => t.includes("評価終了")));
});

await ok("解釈不能は再質問して前進しない", async () => {
  const io = makeIO();
  const r = S.createRunner(S.buildSteps(ITEMS), io, {});
  await r.start();
  await r.handleText("えーっと");
  assert.strictEqual(r.state().idx, 0);
  assert.ok(io.log.spoken.some((t) => t.includes("もう一度")));
  await r.handleText("2プラス");
  assert.strictEqual(r.state().idx, 1);
});

await ok("スキップ/戻る/もう一度", async () => {
  const io = makeIO();
  const r = S.createRunner(S.buildSteps(ITEMS), io, {});
  await r.start();
  await r.handleText("スキップ");
  assert.strictEqual(r.state().idx, 1);
  assert.strictEqual(r.state().results[0].status, "skip");
  await r.handleText("戻る");
  assert.strictEqual(r.state().idx, 0);
  assert.strictEqual(r.state().results[0], null);
  await r.handleText("もう一度");
  assert.strictEqual(r.state().idx, 0);
});

await ok("一時停止中は回答を取り込まない→再開で続行", async () => {
  const io = makeIO();
  const r = S.createRunner(S.buildSteps(ITEMS), io, {});
  await r.start();
  await r.handleText("一時停止");
  assert.strictEqual(r.state().status, "paused");
  await r.handleText("2プラス");
  assert.strictEqual(r.state().results[0], null);
  await r.handleText("再開");
  await r.handleText("2プラス");
  assert.strictEqual(r.state().results[0].value, "2+");
});

await ok("終了コマンドで途中終了(部分結果が残る)", async () => {
  const io = makeIO();
  let done = null, meta = null;
  const r = S.createRunner(S.buildSteps(ITEMS), io, { onDone: (res, m) => { done = res; meta = m; } });
  await r.start();
  await r.handleText("2プラス");
  await r.handleText("終了");
  assert.ok(meta.aborted);
  assert.strictEqual(done[0].value, "2+");
  assert.strictEqual(done[1], null);
});

await ok("読み上げ中は認識を止める", async () => {
  const io = makeIO();
  const r = S.createRunner(S.buildSteps(ITEMS), io, {});
  await r.start();
  await r.handleText("2プラス");
  assert.ok(io.log.stop >= io.log.spoken.length - 1);
});

await ok("実ルーティーン(脊椎)全項目を通しで完走できる", async () => {
  const io = makeIO();
  const spine = Items.defaultTemplates()[0];
  const steps = S.buildSteps(spine.items);
  let done = null;
  const r = S.createRunner(steps, io, { onDone: (res) => { done = res; }, echo: false });
  await r.start();
  const reply = { mmt: "4プラス", reflex: "2プラス", pm: "陰性", text: "なし", num: "90", level: "Th7", nrs: "3" };
  for (const st of steps) await r.handleText(reply[st.type]);
  assert.ok(done, "完走");
  assert.strictEqual(done.filter((x) => x && x.status === "done").length, steps.length, "全項目に回答が入る");
  assert.ok(steps.length > 50, "項目数: " + steps.length);
});

console.log("store:");

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
VStore.__setStorage(memStorage());

await ok("初回ロードで診察ルーティーン3シートが入る", () => {
  const list = VStore.loadTemplates();
  assert.strictEqual(list.length, 3);
  assert.ok(list[0].items.length > 25);
});

await ok("シートの保存・複製・削除", () => {
  const t = VStore.saveTemplate({ name: "テスト", items: [{ id: "z", name: "項目A", type: "pm", bilateral: true }] });
  assert.ok(t.id);
  const copy = VStore.duplicateTemplate(t.id);
  assert.strictEqual(copy.name, "テスト のコピー");
  assert.notStrictEqual(copy.items[0].id, t.items[0].id, "複製は項目idも新規");
  VStore.deleteTemplate(copy.id);
  assert.ok(!VStore.loadTemplates().some((x) => x.id === copy.id));
});

await ok("実施記録の保存とCSV(BOM・スキップ・未実施)", () => {
  const steps = S.buildSteps(ITEMS);
  const rec = VStore.addSession({
    patient: "A-01", templateName: "テスト", steps,
    results: [
      { status: "done", value: "2+", display: "2+ 正常", raw: "2プラス" },
      { status: "skip", raw: "スキップ" },
      null,
    ],
    aborted: true,
  });
  assert.ok(rec.id);
  const csv = VStore.sessionToCSV(rec);
  assert.strictEqual(csv.charCodeAt(0), 0xfeff, "BOM");
  assert.ok(csv.includes("日付,時刻,患者ID"), "ヘッダ");
  assert.ok(csv.includes("BTR,右,2+"), "値");
  assert.ok(csv.includes("スキップ"), "スキップ");
  assert.ok(csv.includes("未実施"), "未実施");
  assert.ok(csv.includes("2プラス"), "認識テキストが残る(監査用)");
});

await ok("バックアップJSONの往復", () => {
  const dump = VStore.exportJSON();
  const before = VStore.loadSessions().length;
  const r = VStore.importJSON(dump, "merge");
  assert.strictEqual(r.sessions, before, "同一idは増えない");
  assert.throws(() => VStore.importJSON('{"app":"other"}', "merge"), /形式/);
});

console.log("\n" + passed + " tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
