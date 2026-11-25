# 數值驗證資料格式

`validation/*.json`（不含產物 `results.json`）每檔對應一篇已核對的原始研究。研究數值與容許誤差已先於 T16 的比對提交（`0df5506`、`cb666ff`）；T16b 依研究方法修正條件的提交為 `f88f525`，早於重新比對。容許誤差未修改；不因結果調整產品數值。

## 研究與條件

- `id`、`source`、`participants`、`protocol`：研究識別、可查來源、受試者與方法。來源查不到的設定記錄未知。
- `sourceQuality`：來源品質註記，不改變數值或門檻。Gullett 2009 的跨研究膝力矩差距列為審閱警訊；其原文採三台攝影機作 3D 重建，不能把整篇稱為 2D。
- `model`：本次模型設定與限制。`conditions[].catalogId` 須為深蹲清單項目；`params` 是 `defaultParams('squat')` 的覆寫。
- 四篇數值比對研究未報告可重建的膝蓋水平路徑；所有條件明列 `kneePath: "forward"`，採教練指定的產品預設。這是模型假設，並非研究條件或用比對結果校準的值。腳尖角仍由模型站距決定，研究角度未對齊。
- `conditions[].conditionDerivation`：由研究方案推導深度、站距、負重與事件位置，不得用被比較的研究結果反推。`referenceLoadKg` 為報告或推算的公斤數；`loadRatio` 為槓重相對模型體重的比例。比對器僅在重算當下暫時覆寫 `BAR_RATIO.squat`，並在運算後還原。未知比例填 `null`，採模型原本預設值但不得視為條件已對齊。
- `measurements[]`：每筆指標、`sample`、`reference` 平均值／SD／原始定義、`evidence` 類型與 `location`、預先設定的 `tolerance`；`limitations` 寫明不能對齊之處。

## 指標與換算

`trunkInclination` 為軀幹對垂直前傾角；`hipFlexion` 為模型軀幹—大腿角；`kneeFlexion` 伸直為 0°；`ankleDorsiflexion` 為小腿相對腳掌的背屈角，平底時等於小腿對垂直的前傾角。`pelvisAnteriorTilt` 為 Goršič 表 2 的骨盆前傾，模型沒有骨盆自由度，所以四筆均為 `definition-mismatch`、模型值為 `null`；預記 12° 容許範圍供未來模型使用，本次不判定。Larsen 髖屈為骨盆—大腿 Cardan 角，模型沒有骨盆自由度；其踝角欠缺站立參考，原先的 `minus90` 換算未經證實。這八筆也標記 `definition-mismatch`，產物不輸出差距或通過判定。需有骨盆自由度及踝角站立參考；踝角亦可改比站距間的變化量。

`hipExtensionMoment`、`kneeExtensionMoment`、`anklePlantarflexionMoment`、`lumbarExtensionMoment` 為模型右半身內部淨力矩，單位 Nm。`normalization: "massHeight"` 除以模型 75 kg × 1.75 m；`"mass"` 除以 75 kg。研究以負號報膝伸需求時，`referenceTransform: "absolute"` 取絕對值。Goršič 中央腰背力矩是整體量，`modelFactor: 2`；其髖／膝／踝為左右平均，不倍乘。Hutchison 表 2 未明示側別，但原文用單塊測力板記錄約 1077 N 整體反力並追蹤雙腿；三筆力矩**推定**為雙腿合計，`modelFactor: 2`，側別仍列不確定。

`sample.type` 可為：`bottom`（`e=1`）、`parallelThigh`（在模型路徑尋找方法定義的股骨對垂直角）、`peak`（401 點最大正力矩）。`peak.endKneeFlexionDeg` 限制峰值搜尋到模型首次達方法膝屈下限的位置，供 Hutchison 的 >80° 條件；其表 2 膝角平均 89°只作描述，沒有用來設定深度。模型是準靜態，不能驗證動態加速度與時間曲線。

## 狀態與計數

`comparisonRole` 預設 `comparable`；也可為 `definition-mismatch`、`exploratory`、`consistency-check`。只有 `comparable` 用 `|model − reference| ≤ tolerance.absolute` 判定 `pass`／`fail`。Hutchison 動態 30% 1RM 的三筆為探索性；Larsen 膝角與深度高度相關，四筆只作一致性檢查。這些筆仍保留量測值與來源，但不進通過率。文獻 SD 僅供展示，不自動放寬門檻。

`results.summary.total` 是全部筆數；`count=pass+fail` 是可比較筆數；另列 `definitionMismatch`、`exploratory`、`consistencyCheck`。`src/validation-status.json` 各清單項目、各層使用相同算法，層級狀態只由可比較筆數決定：有失敗為 `failed`、全通過仍因條件限制為 `partial`；零筆可比較時為 `definition-mismatch`、`exploratory` 或 `unvalidated`。肌肉層仍只有定性趨勢，不代表肌力已驗證。

`npm run test:heel-sweep` 將鞋跟足板角分給小腿前傾的 `HEEL_SHANK_SHARE` 暫時設為 0、0.25、0.5、0.75、1；此指令不寫入產品或驗證產物。對有鞋跟且可比較的項目，再以 0.01 網格偵測 0–1 間通過／失敗翻轉，二分求邊界。翻轉項於 `results.comparisons[]` 加 `assumptionSensitive: { "parameter": "HEEL_SHANK_SHARE", "passRange": [起點, 終點] }`，端點取四位小數；`passRange` 表示此比例下通過原門檻，不代表生理有效範圍。`summary.assumptionSensitivePass` 與 `src/validation-status.json` 有可比較項目的層級同名欄位為目前 0.5 預設下，會受此假設翻轉的通過數。

## T23 硬舉預先固定條件

`escamilla-2000.json`、`henning-2023.json`、`lee-2018.json` 的研究數值、比較角色與絕對容許差須先獨立提交，再執行任何模型比對；不以模型輸出調整條件。硬舉 `catalogId` 可為 `deadlift`、`sumo`、`deficit-dl`、`block-pull`，RDL 為 `rdl`；清單的 `style`／`start` 必須一致。`loadRatio` 暫時覆寫對應的 `BAR_RATIO.deadlift` 或 `.rdl`，`null` 表示平均負重公斤數未知、只用產品預設作探索；不能聲稱負重對齊。`conditions[].participants` 可覆寫研究整體受試者分布，供 Escamilla 非配對兩組各自抽樣。

`sample.type` 另可為 `liftOff`（硬舉 `e=1`）、`kneePassing`（沿上升路徑找槓心與右膝中心等高）、`fullRange`（頂點至離地槓心垂直位移）。`barVerticalTravelPctHeight` 為槓垂直位移／當前身高 ×100，不包含槓片壓縮或預張力。`referenceTransform: "negate"` 用於研究負號代表伸力矩的表列值，正值代表屈力矩時轉為模型的負伸需求。模型力矩為右側／單腳；Henning 的「average」視為左右平均，並保留側別不確定。L5/S1 研究點與模型單一剛體軀幹不等同，列 `definition-mismatch`。

Henning 的槓重來自方法頁 8，受試者 SD 用表 1 逐人值計算；本文體重均值 89.9 kg 與表 1 逐人均值 88.9 kg 不一致，負重比例採本文明示的 89.9 kg。其站距、腳尖、鞋型與模型不能完整對齊，來源品質另註記學位論文及表 2 單位錯標。Lee 的平均 1RM 未報，只有最低點膝屈角列可比較；骨盆—大腿髖角及欠站立零位的踝角列定義不一致。Escamilla 的槓位移採原文表 3，來源掃描 OCR 有欄位交錯疑慮。

固定身體容許差按指標在來源資料中事先固定：Henning 軀幹／膝／踝角分別 15°／15°／12°，髖／膝／踝力矩 100／65／60 Nm；Escamilla 槓位移 5% 身高；Lee 膝角 15°。容許差是建模與量測代理的工程界線，不是研究 SD 或安全門檻。群體仍沿用 `|模型平均−研究平均| ≤ 研究個體 SD`；兩準則分開呈現。RDL 底點研究事件不完全明示且有人未觸地，膝角結果須連同此限制解讀。
