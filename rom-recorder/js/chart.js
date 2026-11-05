/*
 * ROMレコーダー chart
 * 依存ライブラリなしの単一系列ラインチャート(canvas)。
 * 経過グラフ(横軸:日付)と動画解析の角度推移(横軸:秒)で共用する。
 * 色は CSS変数(--chart-*)から取得し、ライト/ダーク両テーマに追従する。
 */
(function (global) {
  "use strict";

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function theme() {
    return {
      line: cssVar("--chart-line", "#2563eb"),
      grid: cssVar("--chart-grid", "rgba(100,116,139,0.18)"),
      ref: cssVar("--chart-ref", "#94a3b8"),
      ink: cssVar("--ink", "#0f172a"),
      muted: cssVar("--ink-muted", "#64748b"),
      surface: cssVar("--surface", "#ffffff"),
      tooltipBg: cssVar("--surface2", "#f1f5f9"),
      border: cssVar("--border", "rgba(100,116,139,0.35)"),
    };
  }

  function niceStep(span, maxTicks) {
    const rough = span / Math.max(1, maxTicks);
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-9))));
    for (const m of [1, 2, 5]) if (rough <= m * pow) return m * pow;
    return 10 * pow;
  }

  const DAY = 86400000;
  const DATE_STEPS = [DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 61 * DAY, 91 * DAY, 183 * DAY, 365 * DAY, 730 * DAY, 1826 * DAY];

  function fmtSec(t) {
    if (t >= 60) {
      const m = Math.floor(t / 60);
      const s = Math.round(t % 60);
      return m + ":" + String(s).padStart(2, "0");
    }
    return (Math.round(t * 10) / 10) + "s";
  }

  function fmtDateTick(ms, spanMs) {
    const d = new Date(ms);
    if (spanMs > 300 * DAY) return String(d.getFullYear()).slice(2) + "/" + (d.getMonth() + 1);
    return (d.getMonth() + 1) + "/" + d.getDate();
  }

  function fmtDateFull(ms) {
    const d = new Date(ms);
    return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
  }

  // canvas: 対象要素 / opts: {xType:"date"|"seconds", refValue, refLabel, onSeek, emptyText}
  function createLineChart(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext("2d");
    let data = [];            // [{x, y}] x昇順
    let refValue = opts.refValue ?? null;
    let refLabel = opts.refLabel || "参考";
    let hoverIdx = null;
    let layout = null;        // 直近描画のスケール(ホバー計算用)
    let destroyed = false;

    const ro = (typeof ResizeObserver !== "undefined") ? new ResizeObserver(() => draw()) : null;
    if (ro) ro.observe(canvas);
    const mql = global.matchMedia ? global.matchMedia("(prefers-color-scheme: dark)") : null;
    const onScheme = () => draw();
    if (mql && mql.addEventListener) mql.addEventListener("change", onScheme);

    function xToPx(x) { return layout.px + ((x - layout.x0) / layout.xs) * layout.pw; }
    function yToPx(y) { return layout.py + layout.ph - ((y - layout.y0) / layout.ys) * layout.ph; }

    function computeLayout(cw, ch) {
      const m = { l: 46, r: 14, t: 14, b: 24 };
      let x0, x1;
      if (data.length) {
        x0 = data[0].x; x1 = data[data.length - 1].x;
      } else { x0 = 0; x1 = 1; }
      if (x1 - x0 <= 0) {
        const pad = opts.xType === "date" ? DAY : 1;
        x0 -= pad; x1 += pad;
      }
      let ys = data.map((p) => p.y);
      if (refValue != null && isFinite(refValue)) ys = ys.concat([refValue]);
      let y0 = ys.length ? Math.min.apply(null, ys) : 0;
      let y1 = ys.length ? Math.max.apply(null, ys) : 100;
      if (y1 - y0 < 10) { const c = (y0 + y1) / 2; y0 = c - 5; y1 = c + 5; }
      const padY = (y1 - y0) * 0.1;
      y0 -= padY; y1 += padY;
      return {
        px: m.l, py: m.t, pw: Math.max(10, cw - m.l - m.r), ph: Math.max(10, ch - m.t - m.b),
        x0, xs: x1 - x0, y0, ys: y1 - y0,
      };
    }

    function draw() {
      if (destroyed) return;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const dpr = global.devicePixelRatio || 1;
      if (canvas.width !== Math.round(cw * dpr)) canvas.width = Math.round(cw * dpr);
      if (canvas.height !== Math.round(ch * dpr)) canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      const t = theme();
      ctx.font = "11px system-ui, sans-serif";

      if (!data.length) {
        ctx.fillStyle = t.muted;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(opts.emptyText || "データがありません", cw / 2, ch / 2);
        layout = null;
        return;
      }

      layout = computeLayout(cw, ch);
      const L = layout;

      // 横グリッド + y目盛
      const yStep = niceStep(L.ys, 4);
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (let v = Math.ceil(L.y0 / yStep) * yStep; v <= L.y0 + L.ys + 1e-9; v += yStep) {
        const y = yToPx(v);
        ctx.strokeStyle = t.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L.px, y); ctx.lineTo(L.px + L.pw, y); ctx.stroke();
        ctx.fillStyle = t.muted;
        ctx.fillText(Math.round(v * 10) / 10 + "°", L.px - 6, y);
      }

      // x目盛
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillStyle = t.muted;
      if (opts.xType === "date") {
        let step = DATE_STEPS[DATE_STEPS.length - 1];
        for (const s of DATE_STEPS) { if (L.xs / s <= 5) { step = s; break; } }
        for (let v = Math.ceil(L.x0 / step) * step; v <= L.x0 + L.xs; v += step) {
          ctx.fillText(fmtDateTick(v, L.xs), xToPx(v), L.py + L.ph + 6);
        }
      } else {
        const step = niceStep(L.xs, 6);
        for (let v = Math.ceil(L.x0 / step) * step; v <= L.x0 + L.xs + 1e-9; v += step) {
          ctx.fillText(fmtSec(v), xToPx(v), L.py + L.ph + 6);
        }
      }

      // 参考値ライン(点線・控えめ)
      if (refValue != null && isFinite(refValue)) {
        const y = yToPx(refValue);
        ctx.strokeStyle = t.ref; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(L.px, y); ctx.lineTo(L.px + L.pw, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = t.muted; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
        ctx.fillText(refLabel + " " + refValue + "°", L.px + L.pw - 2, y - 2);
      }

      // データライン(2px)
      ctx.strokeStyle = t.line; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      data.forEach((p, i) => {
        const x = xToPx(p.x), y = yToPx(p.y);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      if (data.length > 1) ctx.stroke();

      // マーカー(点数が多い時系列では省略)
      const showMarkers = data.length <= 60;
      if (showMarkers) {
        for (const p of data) {
          const x = xToPx(p.x), y = yToPx(p.y);
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = t.line; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = t.surface; ctx.stroke();
        }
        // 最新値のみ直接ラベル(選択的ラベリング)
        const last = data[data.length - 1];
        const lx = xToPx(last.x), ly = yToPx(last.y);
        ctx.fillStyle = t.ink; ctx.font = "bold 12px system-ui, sans-serif";
        ctx.textAlign = lx > L.px + L.pw - 40 ? "right" : "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(Math.round(last.y * 10) / 10 + "°", lx + (ctx.textAlign === "left" ? 8 : -8), ly - 6);
      }

      // ホバー表示(十字線+ツールチップ)
      if (hoverIdx != null && data[hoverIdx]) {
        const p = data[hoverIdx];
        const x = xToPx(p.x), y = yToPx(p.y);
        ctx.strokeStyle = t.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, L.py); ctx.lineTo(x, L.py + L.ph); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = t.line; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = t.surface; ctx.stroke();

        const l1 = opts.xType === "date" ? fmtDateFull(p.x) : fmtSec(p.x);
        const l2 = Math.round(p.y * 10) / 10 + "°" + (p.label ? " " + p.label : "");
        ctx.font = "11px system-ui, sans-serif";
        const w1 = ctx.measureText(l1).width;
        ctx.font = "bold 13px system-ui, sans-serif";
        const w2 = ctx.measureText(l2).width;
        const tw = Math.max(w1, w2) + 16, th = 40;
        let tx = x + 10, ty = y - th - 10;
        if (tx + tw > L.px + L.pw) tx = x - tw - 10;
        if (ty < L.py) ty = y + 10;
        ctx.fillStyle = t.tooltipBg; ctx.strokeStyle = t.border; ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(tx, ty, tw, th, 6); else ctx.rect(tx, ty, tw, th);
        ctx.fill(); ctx.stroke();
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillStyle = t.muted; ctx.font = "11px system-ui, sans-serif";
        ctx.fillText(l1, tx + 8, ty + 6);
        ctx.fillStyle = t.ink; ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillText(l2, tx + 8, ty + 20);
      }
    }

    function nearestIdx(px) {
      if (!layout || !data.length) return null;
      let best = null, bestD = Infinity;
      for (let i = 0; i < data.length; i++) {
        const d = Math.abs(xToPx(data[i].x) - px);
        if (d < bestD) { bestD = d; best = i; }
      }
      return bestD <= 32 ? best : null;
    }

    function evtPos(ev) {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    let downPos = null;
    canvas.addEventListener("pointermove", (ev) => {
      const idx = nearestIdx(evtPos(ev).x);
      if (idx !== hoverIdx) { hoverIdx = idx; draw(); }
    });
    canvas.addEventListener("pointerdown", (ev) => {
      downPos = evtPos(ev);
      const idx = nearestIdx(downPos.x);
      if (idx !== hoverIdx) { hoverIdx = idx; draw(); }
    });
    canvas.addEventListener("pointerup", (ev) => {
      const pos = evtPos(ev);
      if (downPos && Math.hypot(pos.x - downPos.x, pos.y - downPos.y) < 8 && typeof opts.onSeek === "function") {
        const idx = nearestIdx(pos.x);
        if (idx != null) opts.onSeek(data[idx].x, data[idx]);
      }
      downPos = null;
    });
    canvas.addEventListener("pointerleave", () => {
      if (hoverIdx != null) { hoverIdx = null; draw(); }
    });

    return {
      setData(points) {
        data = (points || []).slice().sort((a, b) => a.x - b.x);
        hoverIdx = null;
        draw();
      },
      setRef(value, label) {
        refValue = (value == null || !isFinite(value)) ? null : Number(value);
        if (label) refLabel = label;
        draw();
      },
      redraw: draw,
      destroy() {
        destroyed = true;
        if (ro) ro.disconnect();
        if (mql && mql.removeEventListener) mql.removeEventListener("change", onScheme);
      },
    };
  }

  global.createLineChart = createLineChart;
})(window);
