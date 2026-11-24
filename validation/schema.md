# 數值驗證資料格式

`validation/*.json`（不含 `schema.md`）每檔是一篇已核對的原始研究。所有容許誤差先於執行 `npm run test:validation` 固定並單獨提交。比對失敗只記錄，不調整門檻或產品數值。

## 欄位

- `id`：研究代碼；`source`：作者、年份、完整標題、DOI／PubMed 與可讀全文連結。
- `participants`：人數、性別、訓練程度、平均體重與身高；未報告時填 `null` 並在 `limitations` 說明。
- `protocol`：負重、站距、槓位、深度、動作期與量測方式。未報告的 %1RM 或 %BW 不反推。
- `model`：模型 `BODY`（75 kg、1.75 m）及與研究不同的條件／正規化限制。
- `conditions[]`：`catalogId` 必須存在；`params` 是相對於 `defaultParams('squat')` 的覆寫，包含槓位、站距和深度。`referenceLoadKg` 為該條件研究負重，未知填 `null`。
- `measurements[]`：每筆 `id`、三層之一的 `layer`、`metric`、`sample`、`reference`（平均、SD、單位、原文角度或力矩定義）、`evidence`（`table`、`text`、`figureDigitized`、`datasetComputed`）、`location`、`tolerance`（預設的絕對誤差上限，與比較值同單位）。`reference.sd` 未提供時填 `null`。`limitations` 記錄比較限制。

## 本試點可計算的量

`trunkInclination` = 軀幹長軸相對垂直的前傾角，度；`hipFlexion` = 大腿相對軀幹的屈曲角，度；`kneeFlexion` = 大腿與小腿方向的屈曲角，伸直為 0°；`ankleDorsiflexion` = 小腿相對垂直的背屈角，平足站立為 0°。Larsen 表 3 的踝角以小腿與腳的內角表達，本資料保留原值，計算時用 `referenceTransform: "minus90"` 換為背屈角。其三維 Cardan 軸序與模型幾何角不完全相同，因此列入測量定義的不確定性。

`hipExtensionMoment`、`kneeExtensionMoment`、`anklePlantarflexionMoment`、`lumbarExtensionMoment` 為模型右半身內部淨力矩，Nm。`normalization: "massHeight"` 除以 75 kg × 1.75 m，得 Nm/(kg·m)；`"mass"` 除以 75 kg，得 Nm/kg。研究若報負膝伸力矩，以 `referenceTransform: "absolute"` 轉為正的需求量。這只消除體重／身高單位差異，不消除槓重、體型、速度及器材差異。

`sample.type`：`bottom` 取 `e=1`；`parallelThigh` 在 `e∈[0,1]` 找大腿對垂直角達 `targetDeg` 的點（上升期的對應姿勢）；`peak` 在 401 個等距行程點找最大正力矩。模型為準靜態，下降與上升期輸出相同，不能驗證加速度造成的峰值或時間曲線。

比對：`error = model − transformedReference`；`pass = |error| ≤ tolerance.absolute`。文獻 SD 只作呈現，不自動放寬門檻。`partial` 表示已有比對、全數通過但研究條件仍不匹配或證據不足；`failed` 表示至少一筆不通過。未有數值比對的層為 `unvalidated`；本試點肌肉分工只沿用定性趨勢並標示「模型估計」，不能給 `validated`。
