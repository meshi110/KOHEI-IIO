/*
 * ROMレコーダー shoulder-ui
 * 肩検査(動画自動解析)の結果表示と一括記録。
 *
 * 撮影は「正面 / 右側面 / 左側面」の最大3本。解析するたびに結果を
 * 上書きせず積み上げ(merge)、1枚の肩シートにまとめる。
 * 各値は片手(uni)と両手(bi)を並べて示し、確認してからチェックした項目だけ保存する。
 */
(function (global) {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // 結帯動作(1st内旋)の母指到達レベル
  const TH_LEVELS = ["未測定", "C7"]
    .concat(Array.from({ length: 12 }, (_, i) => "Th" + (i + 1)))
    .concat(Array.from({ length: 5 }, (_, i) => "L" + (i + 1)))
    .concat(["仙骨部", "殿部", "大腿"]);

  const VIEW_LABEL = { front: "正面", side: "側面" };

  let appRef = null;
  let seekFn = null;
  // 積み上げた結果: acc[side][key] = {uni, bi, view, source}
  let acc = { left: {}, right: {} };
  let sources = [];   // 取り込んだ動画の情報(表示用)

  function fillLevels(sel) {
    sel.innerHTML = "";
    for (const l of TH_LEVELS) {
      const o = document.createElement("option");
      o.value = l;
      o.textContent = l;
      sel.appendChild(o);
    }
  }

  function init(app, opts) {
    appRef = app;
    seekFn = opts && opts.seek;
    fillLevels($("shThR"));
    fillLevels($("shThL"));
    $("shSaveAll").addEventListener("click", saveAll);
    $("shClear").addEventListener("click", () => {
      if (!sources.length || confirm("取り込んだ解析結果をすべて消去しますか?")) reset();
    });
  }

  function reset() {
    acc = { left: {}, right: {} };
    sources = [];
    $("shoulderResults").hidden = true;
    render();
  }

  // 1本の解析結果を積み上げる(同じ項目が再度得られたら新しい方で置き換える)
  function merge(results, label) {
    const SE = global.ShoulderExam;
    let added = 0;
    for (const side of ["right", "left"]) {
      for (const mt of SE.METRICS) {
        const r = results[side] && results[side][mt.key];
        if (!r) continue;
        acc[side][mt.key] = Object.assign({}, r, { view: results.view, source: label });
        added++;
      }
    }
    sources.push({
      label,
      view: results.view,
      nearSide: results.nearSide,
      frames: results.frames,
      added,
    });
    render();
    return added;
  }

  function cellFor(side, mt) {
    const td = document.createElement("td");
    const r = acc[side][mt.key];
    if (!r) {
      td.textContent = "—";
      td.className = "sh-none";
      return td;
    }
    // 片手を優先して既定チェック(両手は健側の引っ張り・体幹代償が入りやすい)
    const preferred = r.uni ? "uni" : "bi";
    for (const cond of ["uni", "bi"]) {
      const v = r[cond];
      if (!v) continue;
      const label = document.createElement("label");
      label.className = "sh-cell";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = cond === preferred;
      cb.dataset.side = side;
      cb.dataset.key = mt.key;
      cb.dataset.cond = cond;

      const tag = document.createElement("span");
      tag.className = "sh-tag";
      tag.textContent = cond === "uni" ? "片手" : "両手";

      const val = document.createElement("span");
      val.className = "sh-val";
      val.textContent = v.value + "°";

      const tbtn = document.createElement("button");
      tbtn.type = "button";
      tbtn.className = "timelink";
      tbtn.textContent = v.t.toFixed(1) + "s";
      tbtn.title = "動画のこの時刻へ移動して確認";
      tbtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (seekFn) seekFn(v.t);
      });

      label.appendChild(cb);
      label.appendChild(tag);
      label.appendChild(val);
      if (v.compensated) {
        const warn = document.createElement("span");
        warn.className = "sh-warn";
        warn.textContent = "体幹" + v.lean + "°";
        warn.title = "計測時に体幹が傾いています(代償の可能性)";
        label.appendChild(warn);
      }
      label.appendChild(tbtn);
      td.appendChild(label);
    }
    if (!td.children.length) { td.textContent = "—"; td.className = "sh-none"; }
    return td;
  }

  function render() {
    const SE = global.ShoulderExam;
    const tbody = $("shoulderTbody");
    tbody.innerHTML = "";
    for (const mt of SE.METRICS) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = mt.motion + (mt.note ? " ※" : "");
      if (mt.note) name.title = mt.note;
      const need = document.createElement("span");
      need.className = "sh-view";
      need.textContent = mt.view === "any" ? "" : "(" + VIEW_LABEL[mt.view] + ")";
      name.appendChild(need);
      tr.appendChild(name);
      tr.appendChild(cellFor("right", mt));
      tr.appendChild(cellFor("left", mt));
      tbody.appendChild(tr);
    }

    // 取り込み状況(どの向きがまだか)
    const el = $("shSources");
    el.innerHTML = "";
    if (!sources.length) {
      el.textContent = "まだ解析していません。";
    } else {
      for (const s of sources) {
        const li = document.createElement("li");
        li.textContent = s.label + ": " + (VIEW_LABEL[s.view] || "判定不能") +
          (s.view === "side" && s.nearSide ? "(" + (s.nearSide === "right" ? "右" : "左") + "側)" : "") +
          " ／ " + s.frames + "フレーム ／ " + s.added + "項目を取得";
        el.appendChild(li);
      }
      const missing = [];
      const has = (side, key) => !!(acc[side] && acc[side][key]);
      if (!has("right", "abd") && !has("left", "abd")) missing.push("正面(外転・回旋)");
      if (!has("right", "flex")) missing.push("右側面(挙上・伸展)");
      if (!has("left", "flex")) missing.push("左側面(挙上・伸展)");
      if (missing.length) {
        const li = document.createElement("li");
        li.className = "sh-missing";
        li.textContent = "未取得: " + missing.join(" / ");
        el.appendChild(li);
      }
    }
    $("shoulderResults").hidden = !sources.length;
  }

  function saveAll() {
    const SE = global.ShoulderExam;
    const Store = global.Store;
    const patient = $("shPatient").value.trim();
    let n = 0;
    document.querySelectorAll("#shoulderTbody input[type=checkbox]:checked").forEach((cb) => {
      const mt = SE.METRICS.find((m) => m.key === cb.dataset.key);
      const holder = acc[cb.dataset.side] && acc[cb.dataset.side][cb.dataset.key];
      const r = holder && holder[cb.dataset.cond];
      if (!mt || !r) return;
      const condLabel = cb.dataset.cond === "uni" ? "片手" : "両手";
      const memo = [
        condLabel,
        VIEW_LABEL[holder.view] || "",
        "t=" + r.t.toFixed(1) + "s",
        r.compensated ? "体幹傾斜" + r.lean + "°(代償の可能性)" : "",
        mt.note ? "※" + mt.note : "",
      ].filter(Boolean).join(" / ");
      const rec = Store.addRecord({
        patient,
        joint: "肩",
        motion: mt.motion,
        side: cb.dataset.side === "right" ? "右" : "左",
        angle: r.value,
        method: "動画解析(肩)",
        memo,
      });
      if (rec) n++;
    });
    for (const [selId, side] of [["shThR", "右"], ["shThL", "左"]]) {
      const v = $(selId).value;
      if (v && v !== "未測定") {
        const rec = Store.addRecord({
          patient, joint: "肩", motion: "1st内旋(結帯)", side,
          valueText: v, method: "目視", memo: "",
        });
        if (rec) n++;
      }
    }
    if (!n) {
      appRef.toast("記録する項目がありません(チェックを確認してください)");
      return;
    }
    appRef.toast(n + "件を記録しました(記録タブで確認できます)");
    appRef.refreshRecords();
  }

  global.ShoulderUI = { init, merge, reset, render, TH_LEVELS };
})(window);
