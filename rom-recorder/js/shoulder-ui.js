/*
 * ROMレコーダー shoulder-ui
 * 肩検査(動画自動解析)の結果表示と一括記録。
 * 値の確認(該当時刻へのシーク)→チェックした項目のみ保存、という流れにして
 * 自動抽出値を無確認のまま記録しない設計にしている。
 */
(function (global) {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // 結帯動作(1st内旋)の母指到達レベル
  const TH_LEVELS = ["未測定", "C7"]
    .concat(Array.from({ length: 12 }, (_, i) => "Th" + (i + 1)))
    .concat(Array.from({ length: 5 }, (_, i) => "L" + (i + 1)))
    .concat(["仙骨部", "殿部", "大腿"]);

  let appRef = null;
  let seekFn = null;
  let lastResults = null;

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
  }

  function render(results) {
    const SE = global.ShoulderExam;
    lastResults = results;
    const tbody = $("shoulderTbody");
    tbody.innerHTML = "";
    for (const mt of SE.METRICS) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = mt.motion + (mt.note ? " ※" : "");
      if (mt.note) name.title = mt.note;
      tr.appendChild(name);
      for (const side of ["right", "left"]) {
        const td = document.createElement("td");
        const r = results[side] && results[side][mt.key];
        if (!r) {
          td.textContent = "未検出";
          td.className = "sh-none";
        } else {
          const label = document.createElement("label");
          label.className = "sh-cell";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = true;
          cb.dataset.side = side;
          cb.dataset.key = mt.key;
          const val = document.createElement("span");
          val.textContent = r.value + "°";
          const tbtn = document.createElement("button");
          tbtn.type = "button";
          tbtn.className = "timelink";
          tbtn.textContent = r.t.toFixed(1) + "s";
          tbtn.title = "動画のこの時刻へ移動して確認";
          tbtn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (seekFn) seekFn(r.t);
          });
          label.appendChild(cb);
          label.appendChild(val);
          label.appendChild(tbtn);
          td.appendChild(label);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    $("shoulderResults").hidden = false;
    $("shoulderResults").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function saveAll() {
    const SE = global.ShoulderExam;
    const Store = global.Store;
    if (!lastResults) return;
    const patient = $("shPatient").value.trim();
    let n = 0;
    document.querySelectorAll("#shoulderTbody input[type=checkbox]:checked").forEach((cb) => {
      const mt = SE.METRICS.find((m) => m.key === cb.dataset.key);
      const r = lastResults[cb.dataset.side] && lastResults[cb.dataset.side][cb.dataset.key];
      if (!mt || !r) return;
      const rec = Store.addRecord({
        patient,
        joint: "肩",
        motion: mt.motion,
        side: cb.dataset.side === "right" ? "右" : "左",
        angle: r.value,
        method: "動画解析(肩)",
        memo: "t=" + r.t.toFixed(1) + "s" + (mt.note ? " ※" + mt.note : ""),
      });
      if (rec) n++;
    });
    for (const [selId, side] of [["shThR", "右"], ["shThL", "左"]]) {
      const v = $(selId).value;
      if (v && v !== "未測定") {
        const rec = Store.addRecord({
          patient,
          joint: "肩",
          motion: "1st内旋(結帯)",
          side,
          valueText: v,
          method: "目視",
          memo: "",
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

  global.ShoulderUI = { init, render, TH_LEVELS };
})(window);
