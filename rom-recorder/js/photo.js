/*
 * ROMレコーダー photo
 * 写真・X線画像上の手動角度計測(デジタルゴニオメーター)。
 * 3点モード: A-頂点-B の角度 / 4点モード: 2直線のなす角(Cobb角・FTAなど)。
 * 画像はブラウザ内でのみ処理され、どこにも送信されない。
 */
(function (global) {
  "use strict";

  const AC = global.AngleCore;

  const HINTS_3 = [
    "点1: 1本目の軸の端(関節から遠い側)をタップ",
    "点2: 頂点(関節の中心)をタップ",
    "点3: 2本目の軸の端をタップ",
  ];
  const HINTS_4 = [
    "線1の始点をタップ",
    "線1の終点をタップ",
    "線2の始点をタップ",
    "線2の終点をタップ",
  ];

  function init(app) {
    const canvas = document.getElementById("photoCanvas");
    const ctx = canvas.getContext("2d");
    const fileInput = document.getElementById("photoFileInput");
    const cameraInput = document.getElementById("photoCameraInput");
    const hintEl = document.getElementById("photoHint");
    const listEl = document.getElementById("photoMeasList");
    const emptyEl = document.getElementById("photoEmpty");

    let img = null;             // HTMLImageElement
    let rotation = 0;           // 0/90/180/270 (表示のみ回転。座標は元画像系)
    let scale = 1, tx = 0, ty = 0;
    let fitScale = 1;
    let mode = "3pt";
    let current = [];           // 配置中の点(画像座標)
    let measurements = [];      // {id, type, pts}
    let nextId = 1;
    let drag = null;            // {kind:"point", ref:{arr,idx}} | {kind:"pan"} | {kind:"maybe", start}
    const pointers = new Map(); // pinch用
    let pinch = null;

    function rotSize() {
      return (rotation === 90 || rotation === 270)
        ? { w: img.naturalHeight, h: img.naturalWidth }
        : { w: img.naturalWidth, h: img.naturalHeight };
    }

    // 画像座標 → 画面座標
    function imgToScr(p) {
      const W = img.naturalWidth, H = img.naturalHeight;
      let u, v;
      if (rotation === 0) { u = p.x; v = p.y; }
      else if (rotation === 90) { u = H - p.y; v = p.x; }
      else if (rotation === 180) { u = W - p.x; v = H - p.y; }
      else { u = p.y; v = W - p.x; }
      return { x: u * scale + tx, y: v * scale + ty };
    }

    // 画面座標 → 画像座標
    function scrToImg(s) {
      const W = img.naturalWidth, H = img.naturalHeight;
      const u = (s.x - tx) / scale, v = (s.y - ty) / scale;
      if (rotation === 0) return { x: u, y: v };
      if (rotation === 90) return { x: v, y: H - u };
      if (rotation === 180) return { x: W - u, y: H - v };
      return { x: W - v, y: u };
    }

    function imageMatrix() {
      const W = img.naturalWidth, H = img.naturalHeight, s = scale;
      if (rotation === 0) return [s, 0, 0, s, tx, ty];
      if (rotation === 90) return [0, s, -s, 0, s * H + tx, ty];
      if (rotation === 180) return [-s, 0, 0, -s, s * W + tx, s * H + ty];
      return [0, -s, s, 0, tx, s * W + ty];
    }

    function fit() {
      if (!img) return;
      const { w, h } = rotSize();
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      fitScale = Math.min(cw / w, ch / h) * 0.98;
      scale = fitScale;
      tx = (cw - w * scale) / 2;
      ty = (ch - h * scale) / 2;
    }

    function values(m) {
      // 3pt: 頂点角と補角 / 4pt: ベクトル角と交角(鋭角)
      if (m.type === "3pt") {
        const a = AC.angleAt(m.pts[0], m.pts[1], m.pts[2]);
        if (!isFinite(a)) return null;
        return [
          { label: "∠", value: a },
          { label: "補角(180−∠)", value: 180 - a },
        ];
      }
      const a = AC.angleOfLines(m.pts[0], m.pts[1], m.pts[2], m.pts[3]);
      if (!isFinite(a)) return null;
      return [
        { label: "交角", value: AC.acute(a) },
        { label: "ベクトル角", value: a },
      ];
    }

    function fmt(v) { return (Math.round(v * 10) / 10) + "°"; }

    function draw() {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const dpr = global.devicePixelRatio || 1;
      if (canvas.width !== Math.round(cw * dpr)) canvas.width = Math.round(cw * dpr);
      if (canvas.height !== Math.round(ch * dpr)) canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      if (!img) return;

      const m = imageMatrix();
      ctx.save();
      ctx.setTransform(dpr * m[0], dpr * m[1], dpr * m[2], dpr * m[3], dpr * m[4], dpr * m[5]);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const t = chartTheme();
      for (const meas of measurements) drawMeasurement(meas, t, false);
      drawMeasurement({ type: mode, pts: current }, t, true);
      drawLoupe(t);
    }

    function chartTheme() {
      const css = getComputedStyle(document.documentElement);
      const get = (n, f) => (css.getPropertyValue(n).trim() || f);
      return {
        line: get("--photo-line", "#22d3ee"),
        pt: "#ffffff",
        label: get("--ink", "#0f172a"),
        chip: get("--surface", "#ffffff"),
        border: get("--border", "rgba(100,116,139,0.35)"),
      };
    }

    function drawSeg(a, b, t) {
      const s1 = imgToScr(a), s2 = imgToScr(b);
      ctx.strokeStyle = t.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
    }

    function drawPoint(p, t, hot) {
      const s = imgToScr(p);
      ctx.beginPath(); ctx.arc(s.x, s.y, hot ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = t.line; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = t.pt; ctx.stroke();
    }

    function drawLabel(text, sx, sy, t) {
      ctx.font = "bold 13px system-ui, sans-serif";
      const w = ctx.measureText(text).width + 14;
      let x = sx + 10, y = sy - 30;
      x = Math.min(Math.max(4, x), canvas.clientWidth - w - 4);
      y = Math.min(Math.max(4, y), canvas.clientHeight - 26);
      ctx.fillStyle = t.chip; ctx.strokeStyle = t.border; ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, 22, 6); else ctx.rect(x, y, w, 22);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.label; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(text, x + 7, y + 11);
    }

    function drawMeasurement(meas, t, isCurrent) {
      const pts = meas.pts;
      if (!pts.length) return;
      if (meas.type === "3pt") {
        if (pts.length >= 2) drawSeg(pts[0], pts[1], t);
        if (pts.length >= 3) drawSeg(pts[1], pts[2], t);
      } else {
        if (pts.length >= 2) drawSeg(pts[0], pts[1], t);
        if (pts.length >= 4) drawSeg(pts[2], pts[3], t);
      }
      pts.forEach((p, i) => drawPoint(p, t, isCurrent && i === pts.length - 1));

      const need = meas.type === "3pt" ? 3 : 4;
      if (pts.length === need) {
        const vs = values(meas);
        if (vs) {
          const anchor = meas.type === "3pt" ? pts[1] : pts[3];
          const s = imgToScr(anchor);
          const text = meas.type === "3pt"
            ? fmt(vs[0].value)
            : fmt(vs[0].value) + " (V " + fmt(vs[1].value) + ")";
          drawLabel(text, s.x, s.y, t);
          if (meas.type === "3pt") drawArc(pts, t);
        }
      }
    }

    function drawArc(pts, t) {
      const v = imgToScr(pts[1]);
      const a1 = Math.atan2(imgToScr(pts[0]).y - v.y, imgToScr(pts[0]).x - v.x);
      const a2 = Math.atan2(imgToScr(pts[2]).y - v.y, imgToScr(pts[2]).x - v.x);
      let d = a2 - a1;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      ctx.strokeStyle = t.line; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(v.x, v.y, 26, a1, a1 + d, d < 0); ctx.stroke();
    }

    // ドラッグ中の拡大鏡: つかんだ点の周囲を2.5倍で表示
    function drawLoupe(t) {
      if (!drag || drag.kind !== "point" || !drag.scr) return;
      const R = 54, k = 2.5;
      const p = drag.ref.arr[drag.ref.idx];
      const s0 = imgToScr(p);
      const sp = drag.scr;
      const cx = sp.x;
      let cy = sp.y - 92;
      if (cy - R < 0) cy = sp.y + 92;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.translate(-s0.x, -s0.y);
      const m = imageMatrix();
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      ctx.strokeStyle = t.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy);
      ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12);
      ctx.stroke();
    }

    function need() { return mode === "3pt" ? 3 : 4; }

    function updateHint() {
      if (!img) {
        hintEl.textContent = "画像を読み込むと計測できます(X線・診察写真など)";
        return;
      }
      const hints = mode === "3pt" ? HINTS_3 : HINTS_4;
      hintEl.textContent = current.length < need()
        ? "(" + (current.length + 1) + "/" + need() + ") " + hints[current.length]
        : "";
    }

    function renderList() {
      listEl.innerHTML = "";
      emptyEl.style.display = measurements.length ? "none" : "";
      measurements.forEach((meas, i) => {
        const vs = values(meas);
        if (!vs) return;
        const row = document.createElement("div");
        row.className = "meas-row";
        const name = document.createElement("span");
        name.className = "meas-name";
        name.textContent = "#" + (i + 1) + " " + (meas.type === "3pt" ? "3点" : "2直線");
        row.appendChild(name);
        vs.forEach((v) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chip";
          b.textContent = v.label + " " + fmt(v.value) + " を記録";
          b.addEventListener("click", () => {
            app.openSaveDialog({ angle: Math.round(v.value * 10) / 10, method: "写真計測" });
          });
          row.appendChild(b);
        });
        const del = document.createElement("button");
        del.type = "button";
        del.className = "chip chip-danger";
        del.textContent = "削除";
        del.addEventListener("click", () => {
          measurements.splice(i, 1);
          renderList(); draw();
        });
        row.appendChild(del);
        listEl.appendChild(row);
      });
    }

    function loadFile(file) {
      if (!file) return;
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        img = im;
        rotation = 0; current = []; measurements = []; drag = null;
        fit(); updateHint(); renderList(); draw();
        URL.revokeObjectURL(url);
      };
      im.onerror = () => {
        URL.revokeObjectURL(url);
        app.toast("画像を読み込めませんでした");
      };
      im.src = url;
    }

    // ---- ポインタ操作: タップ=点追加 / ドラッグ=パン / 点をつかむ=移動 / 2本指=ピンチ ----

    function evtPos(ev) {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    function hitPoint(s) {
      const lists = [current].concat(measurements.map((m) => m.pts));
      for (const arr of lists) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const sp = imgToScr(arr[i]);
          if (Math.hypot(sp.x - s.x, sp.y - s.y) <= 14) return { arr, idx: i };
        }
      }
      return null;
    }

    canvas.addEventListener("pointerdown", (ev) => {
      if (!img) return;
      canvas.setPointerCapture(ev.pointerId);
      const pos = evtPos(ev);
      pointers.set(ev.pointerId, pos);
      if (pointers.size === 2) {
        const [p1, p2] = Array.from(pointers.values());
        pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), scale, mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, tx, ty };
        drag = null;
        return;
      }
      const hit = hitPoint(pos);
      if (hit) drag = { kind: "point", ref: hit, scr: pos };
      else drag = { kind: "maybe", start: pos, tx, ty };
      draw();
    });

    canvas.addEventListener("pointermove", (ev) => {
      if (!img || !pointers.has(ev.pointerId)) return;
      const pos = evtPos(ev);
      pointers.set(ev.pointerId, pos);

      if (pinch && pointers.size >= 2) {
        const [p1, p2] = Array.from(pointers.values());
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const k = Math.min(Math.max(d / pinch.d, 0.2), 20);
        const ns = Math.min(Math.max(pinch.scale * k, fitScale * 0.3), fitScale * 60);
        const kk = ns / pinch.scale;
        scale = ns;
        tx = pinch.mid.x - (pinch.mid.x - pinch.tx) * kk;
        ty = pinch.mid.y - (pinch.mid.y - pinch.ty) * kk;
        draw();
        return;
      }
      if (!drag) return;
      if (drag.kind === "maybe") {
        if (Math.hypot(pos.x - drag.start.x, pos.y - drag.start.y) > 6) {
          drag = { kind: "pan", start: drag.start, tx: drag.tx, ty: drag.ty };
        } else return;
      }
      if (drag.kind === "pan") {
        tx = drag.tx + (pos.x - drag.start.x);
        ty = drag.ty + (pos.y - drag.start.y);
        draw();
      } else if (drag.kind === "point") {
        const ip = scrToImg(pos);
        ip.x = Math.min(Math.max(0, ip.x), img.naturalWidth);
        ip.y = Math.min(Math.max(0, ip.y), img.naturalHeight);
        drag.ref.arr[drag.ref.idx] = ip;
        drag.scr = pos;
        draw();
      }
    });

    function endPointer(ev) {
      if (!pointers.has(ev.pointerId)) return;
      const pos = evtPos(ev);
      pointers.delete(ev.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!img) { drag = null; return; }

      if (drag && drag.kind === "maybe" && ev.type === "pointerup") {
        // タップ = 点を追加
        const ip = scrToImg(pos);
        if (ip.x >= -50 && ip.y >= -50 && ip.x <= img.naturalWidth + 50 && ip.y <= img.naturalHeight + 50) {
          ip.x = Math.min(Math.max(0, ip.x), img.naturalWidth);
          ip.y = Math.min(Math.max(0, ip.y), img.naturalHeight);
          current.push(ip);
          if (current.length === need()) {
            measurements.push({ id: nextId++, type: mode, pts: current });
            current = [];
            renderList();
          }
          updateHint();
        }
      }
      if (drag && drag.kind === "point") renderList();
      drag = null;
      draw();
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    canvas.addEventListener("wheel", (ev) => {
      if (!img) return;
      ev.preventDefault();
      const pos = evtPos(ev);
      const k = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
      const ns = Math.min(Math.max(scale * k, fitScale * 0.3), fitScale * 60);
      const kk = ns / scale;
      scale = ns;
      tx = pos.x - (pos.x - tx) * kk;
      ty = pos.y - (pos.y - ty) * kk;
      draw();
    }, { passive: false });

    // ドラッグ&ドロップ(PC)
    canvas.addEventListener("dragover", (ev) => ev.preventDefault());
    canvas.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) loadFile(f);
    });

    // ---- ツールバー ----
    fileInput.addEventListener("change", () => { loadFile(fileInput.files[0]); fileInput.value = ""; });
    cameraInput.addEventListener("change", () => { loadFile(cameraInput.files[0]); cameraInput.value = ""; });

    function setMode(m) {
      mode = m;
      current = [];
      document.getElementById("photoMode3").classList.toggle("active", m === "3pt");
      document.getElementById("photoMode4").classList.toggle("active", m === "4pt");
      updateHint(); draw();
    }
    document.getElementById("photoMode3").addEventListener("click", () => setMode("3pt"));
    document.getElementById("photoMode4").addEventListener("click", () => setMode("4pt"));

    document.getElementById("photoUndo").addEventListener("click", () => {
      if (current.length) current.pop();
      else if (measurements.length) measurements.pop();
      renderList(); updateHint(); draw();
    });
    document.getElementById("photoClear").addEventListener("click", () => {
      current = []; measurements = [];
      renderList(); updateHint(); draw();
    });
    document.getElementById("photoRotate").addEventListener("click", () => {
      rotation = (rotation + 90) % 360;
      fit(); draw();
    });
    document.getElementById("photoZoomIn").addEventListener("click", () => zoomCenter(1.3));
    document.getElementById("photoZoomOut").addEventListener("click", () => zoomCenter(1 / 1.3));
    document.getElementById("photoFit").addEventListener("click", () => { fit(); draw(); });

    function zoomCenter(k) {
      if (!img) return;
      const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2;
      const ns = Math.min(Math.max(scale * k, fitScale * 0.3), fitScale * 60);
      const kk = ns / scale;
      scale = ns;
      tx = cx - (cx - tx) * kk;
      ty = cy - (cy - ty) * kk;
      draw();
    }

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => { draw(); }).observe(canvas);
    }

    updateHint();
    return { redraw: draw };
  }

  global.PhotoMeasure = { init };
})(window);
