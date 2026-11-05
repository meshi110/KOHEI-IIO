# vendor/ について

オフライン動作とバージョン固定のため、以下のサードパーティ資産を同梱しています。

## tasks-vision/
- **@mediapipe/tasks-vision 1.0.1**(Google, Apache License 2.0)
- 取得元: npm レジストリ `https://registry.npmjs.org/@mediapipe/tasks-vision`
- 同梱物: `vision_bundle.mjs`(ESMバンドル)、`wasm/`(SIMD版・非SIMD版ランタイム)、`LICENSE`(Apache-2.0全文)
- ※ `vision_wasm_module_internal.*` は vision タスクの通常経路では使用されないため同梱していません。必要時はCDNフォールバックで取得されます。

## models/
- **pose_landmarker_lite.task**(float16, v1)
- 取得元: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
- MediaPipe の姿勢推定モデル(ライセンスは MediaPipe と同じく Apache-2.0 系。詳細は上記取得元のモデルカードを参照)
- 高精度版 `pose_landmarker_full` は同梱せず、設定で選択した場合のみCDNから取得します。

## 更新方法
```
npm pack @mediapipe/tasks-vision
# 展開して vision_bundle.mjs と wasm/ の4ファイルを差し替え
# js/ai.js の CDN_BASE のバージョン表記も合わせて更新
```
