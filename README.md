# 3d-mechanics-lab

重訓動作的 3D 生物力學教學工具。教練設定動作與技術參數，即時看到姿勢、力線、關節力矩需求與肌肉受力熱力圖。

- **關節力矩**：剛體連桿＋準靜態平衡（物理計算）
- **肌肉分配**：最小化活化平方和（模型估計）
- 涵蓋槓鈴動作、器械與滑輪動作；可比較兩組設定、檢視整個動作的力矩曲線

## 開發

```bash
npm install
npm run dev      # 開發伺服器
npm run build    # 輸出到 dist/
npm test         # 驗證所有動作＋回歸比對
```

動作總覽截圖（給教練檢查每個動作的姿勢）：`npm run review`，輸出到 `review/index.html`；加 `-- --publish` 會複製到 `dist/review/`（`vite build` 會清掉，建置後要重跑）。需要 Playwright：用 `NODE_PATH` 指向已安裝的 playwright，瀏覽器路徑可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定。

改動力學模型後請跑 `npm test`。如果數值變化是刻意的，確認後用 `npm run test:update` 更新基準快照，並在提交說明裡寫明原因。

## 結構

| 檔案 | 內容 |
|---|---|
| `src/biomech.js` | 姿勢求解、外力與接觸、關節力矩、肌肉模型與分配 |
| `src/catalog.js` | 動作清單（分類、變化式） |
| `src/rig.js` | 3D 骨骼與肌肉呈現 |
| `src/curve.js` | 全行程曲線圖 |
| `src/main.js` | 介面 |
| `tools/` | 骨骼資料處理（BodyParts3D） |
| `tests/` | 驗證與回歸比對 |

## 授權與資料來源

骨骼模型：BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International（已簡化並重新擺位）。
