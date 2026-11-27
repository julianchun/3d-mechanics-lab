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

`hipExtensionMoment`、`kneeExtensionMoment`、`anklePlantarflexionMoment`、`lumbarExtensionMoment` 為模型右半身內部淨力矩，單位 Nm。`normalization: "massHeight"` 除以模型 75 kg × 1.75 m；`"mass"` 除以 75 kg。研究以負號報膝伸需求時，`referenceTransform: "absolute"` 取絕對值。Goršič 中央腰背力矩是整體量，`modelFactor: 2`；其髖／膝／踝為左右平均，不倍乘。Goršič 原文 Data Reduction 將下背點定為左右髂嵴中點、在遠端節段座標系取力矩；模型沿單一軀幹軸在髖上 5 cm 取矩。兩筆腰背值保留模型輸出和研究原值供診斷，標 `definition-mismatch`，不判通過；體重身高正規化及 `modelFactor` 未變。T35 起，腰背力矩項可加 `momentPoint`（`iliacCrest`、`L5S1`；省略時為產品預設 `model5cm`），驗證工具在該研究定義的取矩點重算模型值（髖中心上方沿軀幹軸 ＝ 身高比例，來源與數值見 [lumbar-point](../docs/research/lumbar-point.md)），並在 `results.json` 另列 `modelAt5cm`、群體結果另列 `modelMeanAt5cm` 供對照。取矩點對齊**不足以**改回 `comparable`：還需研究節段（骨盆或 L5/S1 局部）座標與模型單一軀幹軸一致；兩者目前皆有殘餘差異，因此仍為 `definition-mismatch`，不新增狀態值。Hutchison 表 2 未明示側別，但原文用單塊測力板記錄約 1077 N 整體反力並追蹤雙腿；三筆力矩**推定**為雙腿合計，`modelFactor: 2`，側別仍列不確定。

`sample.type` 可為：`bottom`（`e=1`）、`parallelThigh`（在模型路徑尋找方法定義的股骨對垂直角）、`peak`（401 點最大正力矩）。`peak.endKneeFlexionDeg` 限制峰值搜尋到模型首次達方法膝屈下限的位置，供 Hutchison 的 >80° 條件；其表 2 膝角平均 89°只作描述，沒有用來設定深度。模型是準靜態，不能驗證動態加速度與時間曲線。

## 狀態與計數

`comparisonRole` 預設 `comparable`；也可為 `definition-mismatch`、`exploratory`、`consistency-check`。只有 `comparable` 用 `|model − reference| ≤ tolerance.absolute` 判定 `pass`／`fail`。Hutchison 動態 30% 1RM 的三筆為探索性；Larsen 膝角與深度高度相關，四筆只作一致性檢查。這些筆仍保留量測值與來源，但不進通過率。文獻 SD 僅供展示，不自動放寬門檻。

`results.summary.total` 是全部筆數；`count=pass+fail` 是可比較筆數；另列 `definitionMismatch`、`exploratory`、`consistencyCheck`。`src/validation-status.json` 各清單項目、各層使用相同算法，層級狀態只由可比較筆數決定：有失敗為 `failed`、全通過仍因條件限制為 `partial`；零筆可比較時為 `definition-mismatch`、`exploratory` 或 `unvalidated`。肌肉層仍只有定性趨勢，不代表肌力已驗證。

`npm run test:heel-sweep` 將鞋跟足板角分給小腿前傾的 `HEEL_SHANK_SHARE` 暫時設為 0、0.25、0.5、0.75、1；此指令不寫入產品或驗證產物。對有鞋跟且可比較的項目，再以 0.01 網格偵測 0–1 間通過／失敗翻轉，二分求邊界。翻轉項於 `results.comparisons[]` 加 `assumptionSensitive: { "parameter": "HEEL_SHANK_SHARE", "passRange": [起點, 終點] }`，端點取四位小數；`passRange` 表示此比例下通過原門檻，不代表生理有效範圍。`summary.assumptionSensitivePass` 與 `src/validation-status.json` 有可比較項目的層級同名欄位為目前 0.5 預設下，會受此假設翻轉的通過數。腰背定義不一致項也重算敏感度區間，但不產生通過／失敗結論。

## T23 硬舉預先固定條件

`escamilla-2000.json`、`henning-2023.json`、`lee-2018.json` 的研究數值、比較角色與絕對容許差須先獨立提交，再執行任何模型比對；不以模型輸出調整條件。硬舉 `catalogId` 可為 `deadlift`、`sumo`、`deficit-dl`、`block-pull`，RDL 為 `rdl`；清單的 `style`／`start` 必須一致。`loadRatio` 暫時覆寫對應的 `BAR_RATIO.deadlift` 或 `.rdl`，`null` 表示平均負重公斤數未知、只用產品預設作探索；不能聲稱負重對齊。`conditions[].participants` 可覆寫研究整體受試者分布，供 Escamilla 非配對兩組各自抽樣。

`sample.type` 另可為 `liftOff`（硬舉 `e=1`）、`kneePassing`（沿上升路徑找槓心與右膝中心等高）、`fullRange`（頂點至離地槓心垂直位移）。`barVerticalTravelPctHeight` 為槓垂直位移／當前身高 ×100，不包含槓片壓縮或預張力。`referenceTransform: "negate"` 用於研究負號代表伸力矩的表列值，正值代表屈力矩時轉為模型的負伸需求。模型力矩為右側／單腳；Henning 的「average」視為左右平均，並保留側別不確定。L5/S1 研究點與模型單一剛體軀幹不等同，列 `definition-mismatch`。

Henning 的槓重來自方法頁 8，受試者 SD 用表 1 逐人值計算；本文體重均值 89.9 kg 與表 1 逐人均值 88.9 kg 不一致，負重比例採本文明示的 89.9 kg。其站距、腳尖、鞋型與模型不能完整對齊，來源品質另註記學位論文及表 2 單位錯標。Lee 的平均 1RM 未報，只有最低點膝屈角列可比較；骨盆—大腿髖角及欠站立零位的踝角列定義不一致。Escamilla 的槓位移採原文表 3，來源掃描 OCR 有欄位交錯疑慮。

固定身體容許差按指標在來源資料中事先固定：Henning 軀幹／膝／踝角分別 15°／15°／12°，髖／膝／踝力矩 100／65／60 Nm；Escamilla 槓位移 5% 身高；Lee 膝角 15°。容許差是建模與量測代理的工程界線，不是研究 SD 或安全門檻。群體仍沿用 `|模型平均−研究平均| ≤ 研究個體 SD`；兩準則分開呈現。RDL 底點研究事件不完全明示且有人未觸地，膝角結果須連同此限制解讀。

## T36 臥推預先固定條件

`mausehund-2022.json`、`larsen-bench-2021.json`、`schutz-2022.json` 的研究數值、比較角色、條件推導與絕對容許差須先獨立提交，再執行任何模型比對；之後不依結果修改。臥推 `catalogId` 可為 `bench`、`cg-bench`、`incline-bench`；`params` 為 `defaultParams('bench')` 的覆寫；啞鈴與地板臥推沒有可比較的量測資料。

**條件推導欄位。**`derivedParams` 由研究方法在模型人體上逐人反解：`grip.rule = "armBarAngleTop"`：Mausehund 以手臂伸直時手臂與槓的內夾角（AB-angle）標準化握距，模型在頂點（e = 0）取肩中心到手點的連線，與槓軸（左右方向）在手點處朝內側的夾角 = AB 角，以二分法求握距旋鈕（`range` 內，不截斷到旋鈕上限 2.0）；`flare.rule = "shoulderAbductionBottom"`：方法指示底部肩外展約 45°，反解「手肘外開角度」使模型最低點（e = 1）的肩外展角為 45°，範圍 30–90°，無解取最近端點；先以清單預設手肘外開解握距，再解手肘外開，再重解握距一次。`loadBarTareKg`／`loadBodyFraction`：槓質量 = 空槓 kg + 比例×體重，固定身體用 `loadRatio`（以研究平均體重換算），群體逐人重算；`loadRatio` 暫時覆寫 `BAR_RATIO.bench`（槓質量／體重，含槓）。

**幾何指標**（皆取右側；R.shoulder、R.elbow、R.hand 為模型關節中心與前臂延長線上的握點）：

- `elbowPeakFlexion`／`elbowFlexionRom`／`shoulderAbductionBottom`：肘屈角 = 肩→肘與肘→手方向的夾角（伸直 = 0°）；取全程（401 點）最大值或最大減最小；肩外展角 = 肱骨（肩→肘）與胸廓矢狀面的夾角 = asin(肱骨單位向量 · 左右軸)，取最低點（e = 1）。
- `shoulderPeakBarMoment`／`elbowPeakBarMoment`：外部力矩只含槓力，每手 F = BAR_RATIO.bench × 體重 × g／2，垂直向下作用在 R.hand；前臂—上臂平面法向量 n = (肘−肩)×(手−肘)，力矩 = |(r × F)·n|，r 為關節中心到手點；不含上肢自重（研究以槓合力定義）。`Nm/kg` 時除以模型體重。
- `shoulderPeakMomentArm`／`elbowPeakMomentArm`／`shoulderMomentArm`／`elbowMomentArm`：力矩 ÷ F 在前臂—上臂平面內的分量大小，即關節中心到力線的垂直距離；`peak` 取全程最大，`bottom` 取 e = 1，`barHeightAboveBottom` 取槓高於最低點指定公尺數處（二分搜尋，槓高單調）。
- `barVerticalTravel`／`barHorizontalTravel`：槓心在頂點與最低點的垂直差／水平（前後方向）差的絕對值（m）。
- `shoulderAbsMomentPeak`：`analyze()` 的 `joints.shoulder`（肩三維力矩大小，含上肢節段重量與槓力）全程最大，右側單側，再除以體重。
- `shoulderHorizontalAdductionPeak`／`shoulderHorizontalAdductionRom`／`forearmAngleMean`／`archAngleMean`：研究定義（Figure 2 的零位與參考平面不可由文字核對；胸骨拱形）模型沒有對應量，一律 `definition-mismatch`，不輸出模型值，預記容許差供未來使用。

**取樣型別**：`bottom`（e = 1）、`peak`（401 點最大）、`range`（401 點最大減最小；位移指標取頂點與最低點差）、`barHeightAboveBottom`。`consistency-check` 用於條件已設定同一量（BPNO 底部肩外展）。模型為準靜態、僅垂直槓力、不含橫向力。群體比對的準則不變（|模型群體平均 − 研究平均| ≤ 研究個體 SD）；Larsen 未報身高，只做固定身體。
