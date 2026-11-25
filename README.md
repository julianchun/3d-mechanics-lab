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

## 數據蒐集、模擬與驗證流程

驗證前先核對研究原文的方法、表格與量測定義，再把可用的定點數值、受試者資料及條件推導記入 [`validation/`](validation/)。[de Leva 1996](https://doi.org/10.1016/0021-9290(95)00178-6) 提供男女節段質量與質心；[美國陸軍 ANSUR II](https://ph.health.mil/topics/workplacehealth/ergo/Pages/Anthropometric-Database.aspx) 提供身材比例的逐人資料。[身體參數與標記換算](docs/validation/body-anthropometry.md) 說明哪些長度只是外觀標記的代理。

Demers 2018 是姿勢參數的**校準組**；Goršič、Gullett、Hutchison、Larsen 四篇是**測試組**，不拿其結果反調身體參數。[群體比對條件與準則](docs/validation/population-protocol.md) 在模擬前獨立提交：每篇以固定種子抽 200 人，依研究的人數、男女比例、身高與體重分布抽樣，骨頭比例按性別從 ANSUR II 整列重抽以保留可觀測的相關性，並依各人的體重換算負重。`npm run test:validation` 重算[舊固定身體結果](validation/results.json)；`npm run test:validation-pop` 重算[群體結果](validation/population-results.json)，兩種判定並列。新準則為模型群體平均與研究平均的差不超過研究個體標準差；這是描述性檢查，不是精度證明。

模型仍是準靜態、左右對稱，單一剛體軀幹沒有獨立骨盆角。各研究的訓練史、測量標記、負重或運動速度未完全對齊；ANSUR II 軍人樣本也不代表各研究受試者。[既有深蹲驗證說明](docs/validation/squat-calibration-result.md) 記錄固定身體比對的失敗項與疑點。

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
