/*
 * ROMレコーダー ai
 * MediaPipe Pose Landmarker によるAI角度計測。
 *  - AiLive : カメラのライブ映像から関節角度をリアルタイム計測
 *  - AiVideo: 動画ファイルを再生しながら解析し、角度の時系列を得る
 * 推定はすべて端末内(ブラウザのWASM/GPU)で実行され、映像は外部送信されない。
 * 同梱の vendor/ を優先し、読めない場合のみCDNへフォールバックする。
 */
(function (global) {
  "use strict";

  const AC = global.AngleCore;

  // 注意: classic script内の動的import()はスクリプトURL基準で解決されるため、
  // ドキュメント基準の絶対URLを組み立てる(GitHub Pagesのサブパス配信でも動く)
  const APP_BASE = new URL(".", document.baseURI).href;
  const LOCAL_BASE = APP_BASE + "vendor/tasks-vision";
  const CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";
  const MODELS = {
    lite: {
      local: APP_BASE + "vendor/models/pose_landmarker_lite.task",
      cdn: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    },
    full: {
      // full はサイズが大きいため同梱せず、選択時のみCDNから取得(要ネット接続)
      cdn: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    },
  };

  // PoseLandmarker.POSE_CONNECTIONS が取れない場合の骨格線(体幹・四肢のみ)
  const FALLBACK_CONNS = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28],
    [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
  ];

  let visionModule = null;

  async function loadVisionModule() {
    if (visionModule) return visionModule;
    try {
      visionModule = await import(LOCAL_BASE + "/vision_bundle.mjs");
    } catch (e) {
      console.warn("同梱MediaPipeの読み込みに失敗。CDNを試します", e);
      visionModule = await import(CDN_BASE + "/vision_bundle.mjs");
    }
    return visionModule;
  }

  // wasm/モデルとも ローカル→CDN、GPU→CPU の順で試す
  async function createLandmarker(variant, runningMode) {
    const mod = await loadVisionModule();
    const { PoseLandmarker, FilesetResolver } = mod;
    const model = MODELS[variant] || MODELS.lite;
    const attempts = [
      { wasm: LOCAL_BASE + "/wasm", model: model.local || model.cdn },
      { wasm: CDN_BASE + "/wasm", model: model.cdn },
    ];
    let lastErr = null;
    for (const a of attempts) {
      for (const delegate of ["GPU", "CPU"]) {
        try {
          const fileset = await FilesetResolver.forVisionTasks(a.wasm);
          const lm = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: a.model, delegate },
            runningMode,
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          return { landmarker: lm, PoseLandmarker: mod.PoseLandmarker };
        } catch (e) {
          lastErr = e;
        }
      }
    }
    throw lastErr || new Error("PoseLandmarker init failed");
  }

  function makeSmoother(n) {
    const buf = [];
    return {
      push(v) {
        buf.push(v);
        if (buf.length > n) buf.shift();
        const s = buf.slice().sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
      },
      reset() { buf.length = 0; },
    };
  }

  // 正規化ランドマークから、プリセットに応じた角度を計算する
  // use3D=true のときは worldLandmarks(メートル系3D)を使う
  function computeFromResult(result, preset, side, use3D, w, h) {
    const norm = result && result.landmarks && result.landmarks[0];
    if (!norm) return null;
    const world = result.worldLandmarks && result.worldLandmarks[0];
    const src = (use3D && world) ? world : norm;
    const specs = AC.roleSpecs(preset, side);
    const mapPt = (i) => {
      const p = src[i];
      if (!p) return null;
      return (use3D && world) ? { x: p.x, y: p.y, z: p.z } : { x: p.x * w, y: p.y * h };
    };
    const avg = (a, b) => (a && b) ? {
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      z: (typeof a.z === "number" && typeof b.z === "number") ? (a.z + b.z) / 2 : undefined,
    } : null;
    const pts = specs.map((s) => s.mid ? avg(mapPt(s.mid[0]), mapPt(s.mid[1])) : mapPt(s.idx));
    const res = AC.computeAngle(preset, pts);
    if (!res) return null;
    let minVis = 1;
    for (const i of AC.involvedIndices(preset, side)) {
      const v = (norm[i] && typeof norm[i].visibility === "number") ? norm[i].visibility : 0;
      if (v < minVis) minVis = v;
    }
    return { raw: res.raw, value: res.value, minVis };
  }

  // 骨格と計測対象のオーバーレイ描画(座標は正規化ランドマーク×表示サイズ)
  function drawOverlay(ctx, result, preset, side, w, h, conns) {
    ctx.clearRect(0, 0, w, h);
    const norm = result && result.landmarks && result.landmarks[0];
    if (!norm) return;
    const P = (i) => ({ x: norm[i].x * w, y: norm[i].y * h });

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    for (const c of conns) {
      const a = c.start !== undefined ? c.start : c[0];
      const b = c.end !== undefined ? c.end : c[1];
      if (!norm[a] || !norm[b]) continue;
      ctx.beginPath();
      ctx.moveTo(norm[a].x * w, norm[a].y * h);
      ctx.lineTo(norm[b].x * w, norm[b].y * h);
      ctx.stroke();
    }

    if (!preset) return;
    const specs = AC.roleSpecs(preset, side);
    const pts = specs.map((s) => {
      if (s.mid) {
        if (!norm[s.mid[0]] || !norm[s.mid[1]]) return null;
        const a = P(s.mid[0]), b = P(s.mid[1]);
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
      return norm[s.idx] ? P(s.idx) : null;
    });
    if (pts.some((p) => !p)) return;

    const accent = "#22d3ee";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    if (preset.type === "3pt") {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.stroke();
      const a1 = Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x);
      const a2 = Math.atan2(pts[2].y - pts[1].y, pts[2].x - pts[1].x);
      let d = a2 - a1;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pts[1].x, pts[1].y, 30, a1, a1 + d, d < 0);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pts[2].x, pts[2].y); ctx.lineTo(pts[3].x, pts[3].y); ctx.stroke();
    }
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }

  function fitCanvasTo(el, canvas) {
    const w = el.clientWidth, h = el.clientHeight;
    const dpr = global.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function fillPresetSelect(sel) {
    sel.innerHTML = "";
    for (const p of AC.PRESETS) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.joint + " " + p.motion;
      sel.appendChild(o);
    }
  }

  function presetById(id) {
    return AC.PRESETS.find((p) => p.id === id) || AC.PRESETS[0];
  }

  // ============================== ライブ計測 ==============================

  const AiLive = {
    init(app) {
      const video = document.getElementById("liveVideo");
      const canvas = document.getElementById("liveOverlay");
      const wrap = document.getElementById("liveWrap");
      const zoomBox = document.getElementById("liveZoomBox");
      const viewZoomVal = document.getElementById("liveViewZoomVal");
      const optWrap = document.getElementById("liveOptZoomWrap");
      const optSlider = document.getElementById("liveOptZoom");
      const optVal = document.getElementById("liveOptZoomVal");
      const jointSel = document.getElementById("liveJoint");
      const sideL = document.getElementById("liveSideL");
      const sideR = document.getElementById("liveSideR");
      const facingSel = document.getElementById("liveFacing");
      const mirrorChk = document.getElementById("liveMirror");
      const use3DChk = document.getElementById("live3D");
      const startBtn = document.getElementById("liveStart");
      const measureBtn = document.getElementById("liveMeasure");
      const readout = document.getElementById("liveReadout");
      const subEl = document.getElementById("liveSub");
      const statusEl = document.getElementById("liveStatus");
      const defEl = document.getElementById("liveDef");
      const resultEl = document.getElementById("liveResult");

      fillPresetSelect(jointSel);

      let side = "right";
      let stream = null;
      let lmHandle = null;      // {landmarker, PoseLandmarker}
      let running = false;
      let measuring = false;
      let sessionMax = null, sessionMin = null;
      let smoother = makeSmoother(7);
      let lastDetect = 0;
      let lastTs = 0;
      let rafId = 0;
      let conns = FALLBACK_CONNS;

      const settings = app.getSettings();
      mirrorChk.checked = settings.mirror;
      use3DChk.checked = settings.use3D;

      function preset() { return presetById(jointSel.value); }

      function updateDef() {
        defEl.textContent = "計測定義: " + preset().view;
      }
      jointSel.addEventListener("change", () => { updateDef(); resetSession(); });
      updateDef();

      function setSide(s) {
        side = s;
        sideL.classList.toggle("active", s === "left");
        sideR.classList.toggle("active", s === "right");
        resetSession();
      }
      sideL.addEventListener("click", () => setSide("left"));
      sideR.addEventListener("click", () => setSide("right"));
      setSide("right");

      function applyMirror() {
        wrap.classList.toggle("mirror", mirrorChk.checked);
      }
      mirrorChk.addEventListener("change", () => {
        applyMirror();
        app.saveSettings({ mirror: mirrorChk.checked });
      });
      use3DChk.addEventListener("change", () => app.saveSettings({ use3D: use3DChk.checked }));

      // カメラ選択: 許可後は実デバイス一覧(iPhoneなら超広角なども)に置き換わる
      function isFrontSelection() {
        if (facingSel.value === "user") return true;
        if (facingSel.value === "environment") return false;
        const opt = facingSel.selectedOptions[0];
        return /前面|フロント|front|user|facetime/i.test(opt ? opt.textContent : "");
      }

      async function populateCameras() {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
          const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
          if (devs.length < 2 || !devs.some((d) => d.label)) return; // ラベル未取得(未許可)なら前面/背面のまま
          const prev = facingSel.value;
          facingSel.innerHTML = "";
          for (const d of devs) {
            const o = document.createElement("option");
            o.value = "dev:" + d.deviceId;
            o.textContent = d.label || "カメラ";
            facingSel.appendChild(o);
          }
          const track = stream && stream.getVideoTracks()[0];
          const set = track && track.getSettings ? track.getSettings() : null;
          if (set && set.deviceId && Array.from(facingSel.options).some((o) => o.value === "dev:" + set.deviceId)) {
            facingSel.value = "dev:" + set.deviceId;
          } else if (Array.from(facingSel.options).some((o) => o.value === prev)) {
            facingSel.value = prev;
          }
        } catch (_e) { /* 一覧が取れなくても前面/背面指定で動作は継続 */ }
      }

      facingSel.addEventListener("change", () => {
        mirrorChk.checked = isFrontSelection();
        applyMirror();
        if (running) startCamera();
      });
      applyMirror();

      // ---- カメラ自体のズーム(対応端末のみ表示。iOS/Androidの多くで対応) ----
      function setupOpticalZoom(track) {
        optWrap.hidden = true;
        optSlider.oninput = null;
        try {
          const caps = track && track.getCapabilities ? track.getCapabilities() : null;
          const z = caps && caps.zoom;
          if (!z || typeof z !== "object" || !isFinite(z.max) || z.max <= (z.min || 0)) return;
          optSlider.min = z.min;
          optSlider.max = z.max;
          optSlider.step = z.step || 0.1;
          const cur = (track.getSettings && track.getSettings().zoom) || z.min;
          optSlider.value = cur;
          optVal.textContent = "×" + (Math.round(cur * 10) / 10);
          optWrap.hidden = false;
          optSlider.oninput = () => {
            const v = Number(optSlider.value);
            optVal.textContent = "×" + (Math.round(v * 10) / 10);
            track.applyConstraints({ advanced: [{ zoom: v }] }).catch(() => {});
          };
        } catch (_e) { /* 非対応ブラウザでは表示しない */ }
      }

      // ---- 表示ズーム: プレビューの拡大表示のみ。検出はフレーム全体に対して行われる ----
      let vScale = 1, vTx = 0, vTy = 0;

      function applyView() {
        const w = wrap.clientWidth, h = wrap.clientHeight;
        const maxX = (vScale - 1) * w / 2, maxY = (vScale - 1) * h / 2;
        vTx = Math.min(maxX, Math.max(-maxX, vTx));
        vTy = Math.min(maxY, Math.max(-maxY, vTy));
        zoomBox.style.transform = "translate(" + vTx + "px," + vTy + "px) scale(" + vScale + ")";
        viewZoomVal.textContent = "×" + (Math.round(vScale * 10) / 10);
      }

      // (cx,cy)は要素中心を原点とした画面上の固定点。省略時は中心
      function setViewScaleAt(s, cx, cy) {
        const ns = Math.min(4, Math.max(1, s));
        const k = ns / vScale;
        cx = cx || 0; cy = cy || 0;
        vTx = cx - (cx - vTx) * k;
        vTy = cy - (cy - vTy) * k;
        vScale = ns;
        if (vScale === 1) { vTx = 0; vTy = 0; }
        applyView();
      }

      document.getElementById("liveViewZoomIn").addEventListener("click", () => setViewScaleAt(vScale * 1.3));
      document.getElementById("liveViewZoomOut").addEventListener("click", () => setViewScaleAt(vScale / 1.3));
      document.getElementById("liveViewZoomReset").addEventListener("click", () => setViewScaleAt(1));

      const vPointers = new Map();
      let vPinch = null, vPan = null, vLastTap = 0;

      function relPos(ev) {
        const r = wrap.getBoundingClientRect();
        return { x: ev.clientX - r.left - r.width / 2, y: ev.clientY - r.top - r.height / 2 };
      }

      wrap.addEventListener("pointerdown", (ev) => {
        wrap.setPointerCapture(ev.pointerId);
        const p = relPos(ev);
        vPointers.set(ev.pointerId, p);
        if (vPointers.size === 2) {
          const pts = Array.from(vPointers.values());
          vPinch = {
            d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
            mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
            scale: vScale,
          };
          vPan = null;
        } else if (vPointers.size === 1) {
          const now = performance.now();
          if (now - vLastTap < 300) { setViewScaleAt(1); vLastTap = 0; } else { vLastTap = now; }
          if (vScale > 1) vPan = { x: p.x, y: p.y, tx: vTx, ty: vTy };
        }
      });
      wrap.addEventListener("pointermove", (ev) => {
        if (!vPointers.has(ev.pointerId)) return;
        const p = relPos(ev);
        vPointers.set(ev.pointerId, p);
        if (vPinch && vPointers.size >= 2) {
          const pts = Array.from(vPointers.values());
          const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (vPinch.d > 0) setViewScaleAt(vPinch.scale * (d / vPinch.d), vPinch.mid.x, vPinch.mid.y);
        } else if (vPan) {
          vTx = vPan.tx + (p.x - vPan.x);
          vTy = vPan.ty + (p.y - vPan.y);
          applyView();
        }
      });
      function endViewPointer(ev) {
        vPointers.delete(ev.pointerId);
        if (vPointers.size < 2) vPinch = null;
        if (!vPointers.size) vPan = null;
      }
      wrap.addEventListener("pointerup", endViewPointer);
      wrap.addEventListener("pointercancel", endViewPointer);
      wrap.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        const p = relPos(ev);
        setViewScaleAt(vScale * (ev.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y);
      }, { passive: false });

      function status(msg) { statusEl.textContent = msg || ""; }

      function resetSession() {
        measuring = false;
        sessionMax = null; sessionMin = null;
        smoother.reset();
        measureBtn.textContent = "計測開始";
        measureBtn.classList.remove("armed");
        subEl.textContent = "";
        resultEl.innerHTML = "";
      }

      async function startCamera() {
        stopCamera(true);
        if (!global.isSecureContext) {
          status("カメラは https または localhost でのみ使用できます(README参照)");
          return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          status("このブラウザはカメラ取得(getUserMedia)に対応していません");
          return;
        }
        try {
          status("AIモデルを読み込み中…(初回は数秒かかります)");
          if (!lmHandle) {
            lmHandle = await createLandmarker(app.getSettings().modelVariant, "VIDEO");
            if (lmHandle.PoseLandmarker && lmHandle.PoseLandmarker.POSE_CONNECTIONS) {
              conns = lmHandle.PoseLandmarker.POSE_CONNECTIONS;
            }
          }
          status("カメラを起動中…");
          const sel = facingSel.value;
          const vconst = sel.indexOf("dev:") === 0
            ? { deviceId: { exact: sel.slice(4) }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: sel, width: { ideal: 1280 }, height: { ideal: 720 } };
          stream = await navigator.mediaDevices.getUserMedia({ video: vconst, audio: false });
          video.srcObject = stream;
          await video.play();
          running = true;
          startBtn.textContent = "カメラ停止";
          status("");
          setupOpticalZoom(stream.getVideoTracks()[0]);
          populateCameras(); // 許可済みになったので実デバイス名で選択肢を更新
          loop();
        } catch (e) {
          console.error(e);
          if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
            status("カメラの使用が許可されませんでした。ブラウザの設定でカメラを許可してください");
          } else if (e && e.name === "NotFoundError") {
            status("カメラが見つかりませんでした");
          } else {
            status("起動に失敗しました: " + (e && e.message ? e.message : e));
          }
          stopCamera(true);
        }
      }

      function stopCamera(silent) {
        running = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        if (stream) {
          for (const t of stream.getTracks()) t.stop();
          stream = null;
        }
        video.srcObject = null;
        startBtn.textContent = "カメラ開始";
        optWrap.hidden = true;
        resetSession();
        const { ctx, w, h } = fitCanvasTo(wrap, canvas);
        ctx.clearRect(0, 0, w, h);
        if (!silent) status("");
      }

      function loop() {
        if (!running) return;
        rafId = requestAnimationFrame(loop);
        if (!video.videoWidth || video.readyState < 2) return;
        const now = performance.now();
        if (now - lastDetect < 33) return; // ~30fps
        lastDetect = now;
        const ts = Math.max(now, lastTs + 1);
        lastTs = ts;
        let result = null;
        try {
          result = lmHandle.landmarker.detectForVideo(video, ts);
        } catch (e) {
          console.error(e);
          return;
        }
        const { ctx, w, h } = fitCanvasTo(wrap, canvas);
        const p = preset();
        drawOverlay(ctx, result, p, side, w, h, conns);

        const r = computeFromResult(result, p, side, use3DChk.checked, video.videoWidth, video.videoHeight);
        if (!r) {
          readout.textContent = "--";
          readout.classList.add("dim");
          status(result && result.landmarks && result.landmarks[0] ? "" : "人物を検出できません。全身(対象関節を含む範囲)を映してください");
          return;
        }
        const ok = r.minVis >= 0.5;
        status(ok ? "" : "対象関節の一部が隠れています(信頼度低下)");
        const smoothed = smoother.push(r.value);
        readout.textContent = AC.describeValue(p, smoothed).display;
        readout.classList.toggle("dim", !ok);
        if (measuring && ok) {
          if (sessionMax === null || smoothed > sessionMax) sessionMax = smoothed;
          if (sessionMin === null || smoothed < sessionMin) sessionMin = smoothed;
          subEl.textContent = "最大 " + fmtVal(p, sessionMax) + " ／ 最小 " + fmtVal(p, sessionMin);
        }
      }

      function fmtVal(p, v) {
        return v === null ? "--" : AC.describeValue(p, v).display;
      }

      startBtn.addEventListener("click", () => {
        if (running) stopCamera(); else startCamera();
      });

      measureBtn.addEventListener("click", () => {
        if (!running) { status("先にカメラを開始してください"); return; }
        if (!measuring) {
          resetSession();
          measuring = true;
          measureBtn.textContent = "計測終了";
          measureBtn.classList.add("armed");
        } else {
          measuring = false;
          measureBtn.textContent = "計測開始";
          measureBtn.classList.remove("armed");
          showResult();
        }
      });

      function showResult() {
        resultEl.innerHTML = "";
        const p = preset();
        if (sessionMax === null) {
          resultEl.textContent = "有効な計測値がありませんでした(関節が隠れていないか確認してください)";
          return;
        }
        const sideLabel = side === "left" ? "左" : "右";
        const method = use3DChk.checked ? "AIカメラ(3D)" : "AIカメラ";
        const mk = (label, v) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chip chip-accent";
          b.textContent = label + " " + fmtVal(p, v) + " を記録";
          b.addEventListener("click", () => app.openSaveDialog({
            angle: Math.round(v * 10) / 10,
            joint: p.joint, motion: p.motion, side: sideLabel, method,
          }));
          resultEl.appendChild(b);
        };
        mk("最大", sessionMax);
        if (sessionMin !== null && Math.abs(sessionMax - sessionMin) > 1) mk("最小", sessionMin);
      }

      // タブ離脱・画面非表示でカメラを解放
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && running) stopCamera();
      });

      return {
        deactivate() { if (running) stopCamera(); },
      };
    },
  };

  // ============================== 動画解析 ==============================

  const AiVideo = {
    init(app) {
      const fileInput = document.getElementById("vidFile");
      const video = document.getElementById("vidPlayer");
      const canvas = document.getElementById("vidOverlay");
      const wrap = document.getElementById("vidWrap");
      const jointSel = document.getElementById("vidJoint");
      const sideL = document.getElementById("vidSideL");
      const sideR = document.getElementById("vidSideR");
      const use3DChk = document.getElementById("vid3D");
      const rateSel = document.getElementById("vidRate");
      const analyzeBtn = document.getElementById("vidAnalyze");
      const statusEl = document.getElementById("vidStatus");
      const statsEl = document.getElementById("vidStats");
      const chartCanvas = document.getElementById("vidChart");
      const csvBtn = document.getElementById("vidCSV");
      const resultEl = document.getElementById("vidResult");

      fillPresetSelect(jointSel);

      let side = "right";
      let analyzing = false;
      let series = [];          // [{t, value, vis}]
      let lmHandle = null;
      let conns = FALLBACK_CONNS;
      let vfcId = 0, rafId = 0;
      let lastT = -1;

      // ---- 解析モード: 単一関節 / 肩検査(一連動作から両側の各指標を自動抽出) ----
      const modeSingleBtn = document.getElementById("vidModeSingle");
      const modeShoulderBtn = document.getElementById("vidModeShoulder");
      const singleCtls = document.getElementById("vidSingleCtls");
      const guideEl = document.getElementById("shoulderGuide");
      const shResultsEl = document.getElementById("shoulderResults");
      let mode = "single";
      let shSession = null;

      function setMode(m) {
        mode = m;
        modeSingleBtn.classList.toggle("active", m === "single");
        modeShoulderBtn.classList.toggle("active", m === "shoulder");
        singleCtls.classList.toggle("hide", m === "shoulder");
        guideEl.hidden = m !== "shoulder";
        chartCanvas.style.display = m === "shoulder" ? "none" : "";
        csvBtn.style.display = m === "shoulder" ? "none" : "";
        if (m === "single") shResultsEl.hidden = true;
      }
      modeSingleBtn.addEventListener("click", () => setMode("single"));
      modeShoulderBtn.addEventListener("click", () => setMode("shoulder"));

      if (global.ShoulderUI) {
        global.ShoulderUI.init(app, {
          seek(t) { if (!analyzing && video.src) video.currentTime = t; },
        });
      }

      const chart = global.createLineChart(chartCanvas, {
        xType: "seconds",
        emptyText: "動画を解析すると角度の推移が表示されます",
        onSeek(t) { if (!analyzing && video.src) video.currentTime = t; },
      });

      function preset() { return presetById(jointSel.value); }

      function setSide(s) {
        side = s;
        sideL.classList.toggle("active", s === "left");
        sideR.classList.toggle("active", s === "right");
      }
      sideL.addEventListener("click", () => setSide("left"));
      sideR.addEventListener("click", () => setSide("right"));
      setSide("right");

      function status(msg) { statusEl.textContent = msg || ""; }

      fileInput.addEventListener("change", () => {
        const f = fileInput.files[0];
        if (!f) return;
        if (video.dataset.url) URL.revokeObjectURL(video.dataset.url);
        const url = URL.createObjectURL(f);
        video.src = url;
        video.dataset.url = url;
        series = [];
        chart.setData([]);
        statsEl.textContent = "";
        resultEl.innerHTML = "";
        csvBtn.disabled = true;
        shResultsEl.hidden = true;
        shSession = null;
        status("動画を読み込みました。「解析開始」で先頭から解析します");
      });

      async function startAnalyze() {
        if (!video.src) { status("先に動画ファイルを選択してください"); return; }
        analyzing = true;
        analyzeBtn.textContent = "解析停止";
        series = [];
        lastT = -1;
        chart.setData([]);
        statsEl.textContent = "";
        resultEl.innerHTML = "";
        csvBtn.disabled = true;
        shResultsEl.hidden = true;
        shSession = (mode === "shoulder" && global.ShoulderExam) ? global.ShoulderExam.createSession() : null;
        try {
          status("AIモデルを読み込み中…");
          // タイムスタンプ管理をリセットするため毎回作り直す
          if (lmHandle) { try { lmHandle.landmarker.close(); } catch (_e) {} }
          lmHandle = await createLandmarker(app.getSettings().modelVariant, "VIDEO");
          if (lmHandle.PoseLandmarker && lmHandle.PoseLandmarker.POSE_CONNECTIONS) {
            conns = lmHandle.PoseLandmarker.POSE_CONNECTIONS;
          }
        } catch (e) {
          console.error(e);
          status("AIモデルの読み込みに失敗しました(オフラインの場合は同梱ファイルの配信を確認)");
          stopAnalyze();
          return;
        }
        video.pause();
        video.currentTime = 0;
        video.playbackRate = Number(rateSel.value) || 1;
        video.muted = true;
        await video.play().catch(() => {});
        status("解析中… 0%");
        scheduleFrame();
      }

      function scheduleFrame() {
        if (video.requestVideoFrameCallback) {
          vfcId = video.requestVideoFrameCallback(onFrame);
        } else {
          rafId = requestAnimationFrame(() => onFrame(performance.now(), { mediaTime: video.currentTime }));
        }
      }

      function onFrame(_now, meta) {
        if (!analyzing) return;
        const t = meta && typeof meta.mediaTime === "number" ? meta.mediaTime : video.currentTime;
        if (t > lastT && video.readyState >= 2) {
          lastT = t;
          let result = null;
          try {
            result = lmHandle.landmarker.detectForVideo(video, t * 1000);
          } catch (e) {
            console.error(e);
          }
          const { ctx, w, h } = fitCanvasTo(wrap, canvas);
          const p = mode === "shoulder" ? null : preset();
          drawOverlay(ctx, result, p, side, w, h, conns);
          if (mode === "shoulder") {
            if (shSession && result && result.worldLandmarks && result.worldLandmarks[0]) {
              shSession.add(result.worldLandmarks[0], result.landmarks && result.landmarks[0], t);
            }
          } else {
            const r = result ? computeFromResult(result, p, side, use3DChk.checked, video.videoWidth, video.videoHeight) : null;
            if (r && r.minVis >= 0.5) series.push({ t, value: Math.round(r.value * 10) / 10 });
          }
          if (video.duration) {
            const points = mode === "shoulder" ? (shSession ? shSession.frames : 0) : series.length;
            status("解析中… " + Math.min(100, Math.round((t / video.duration) * 100)) + "%  (" + points + "点)");
          }
        }
        if (video.ended) { finishAnalyze(); return; }
        scheduleFrame();
      }

      function stopAnalyze() {
        analyzing = false;
        analyzeBtn.textContent = "解析開始";
        if (vfcId && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(vfcId);
        if (rafId) cancelAnimationFrame(rafId);
        vfcId = 0; rafId = 0;
        video.pause();
      }

      function finishAnalyze() {
        stopAnalyze();
        if (mode === "shoulder") {
          if (!shSession || !shSession.frames) {
            status("解析終了: 有効なフレームがありませんでした(正面から全身が映っているか確認してください)");
            return;
          }
          const res = shSession.finalize();
          status("解析終了: " + res.frames + "フレーム");
          statsEl.textContent = "結果を下に表示しました。時刻ボタンで動画の該当場面を確認できます";
          if (global.ShoulderUI) global.ShoulderUI.render(res);
          return;
        }
        if (!series.length) {
          status("解析終了: 有効なフレームがありませんでした(人物全身が映っているか確認してください)");
          chart.setData([]);
          return;
        }
        const p = preset();
        chart.setData(series.map((d) => ({ x: d.t, y: d.value })));
        let max = series[0], min = series[0];
        for (const d of series) {
          if (d.value > max.value) max = d;
          if (d.value < min.value) min = d;
        }
        status("解析終了: " + series.length + "フレーム");
        statsEl.textContent =
          "最大 " + AC.describeValue(p, max.value).display + " (" + max.t.toFixed(2) + "秒) ／ " +
          "最小 " + AC.describeValue(p, min.value).display + " (" + min.t.toFixed(2) + "秒)";
        csvBtn.disabled = false;

        resultEl.innerHTML = "";
        const sideLabel = side === "left" ? "左" : "右";
        const mk = (label, v) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chip chip-accent";
          b.textContent = label + " " + AC.describeValue(p, v).display + " を記録";
          b.addEventListener("click", () => app.openSaveDialog({
            angle: Math.round(v * 10) / 10,
            joint: p.joint, motion: p.motion, side: sideLabel,
            method: use3DChk.checked ? "動画解析(3D)" : "動画解析",
          }));
          resultEl.appendChild(b);
        };
        mk("最大", max.value);
        if (Math.abs(max.value - min.value) > 1) mk("最小", min.value);
      }

      analyzeBtn.addEventListener("click", () => {
        if (analyzing) { finishAnalyze(); } else { startAnalyze(); }
      });

      csvBtn.addEventListener("click", () => {
        const p = preset();
        const name = "rom-series-" + p.joint + p.motion.replace(/[()\/+\-]/g, "") + ".csv";
        app.downloadText(name, global.Store.seriesToCSV(series), "text/csv");
      });

      return {
        deactivate() { if (analyzing) finishAnalyze(); video.pause(); },
      };
    },
  };

  global.AiLive = AiLive;
  global.AiVideo = AiVideo;
})(window);
