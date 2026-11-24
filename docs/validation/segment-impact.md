# de Leva 節段參數修改：單項影響

本表比較診斷提交 `c263722` 的基線與本次**唯一模型修改**後、更新回歸基準前的結果。參數來自 [de Leva 1996 表 4](https://ebm.ufabc.edu.br/wp-content/uploads/2013/12/Leva-1996.pdf)，DOI [10.1016/0021-9290(95)00178-6](https://doi.org/10.1016/0021-9290(95)00178-6)。模型版本 0.7.2 → 0.7.3。

採男性全身比例：頭頸 6.94%、整體軀幹 43.46%，每側上臂 2.71%、前臂 1.62%、手 0.61%、大腿 14.16%、小腿 4.33%、足 1.37%。軀幹質心採 SUPR→MIDH 44.86%，換為骨盆往肩線 55.14%；頭頸質心採 VERT→MIDG 59.76%，以現有頭部球體頂端／下顎代理點映射。上臂、前臂、手、大腿、小腿、足各採原文相應端點的質心比例。一般動作的腕點由骨架肘→手端 74.6% 估計，深蹲折腕則用已求得的腕點；這些代理標記的誤差未經量測。所有節段質量合計 100%。

## 63 項清單主要關節力矩

對每個動作，在舊基準的五個行程點 `e=0,0.25,0.5,0.75,1` 選絕對值最大的自由度作為「主要關節力矩」，取該自由度的五點峰值絕對值（Nm）比較。百分比 =（新−舊）／舊；負值表示需求下降。此為模型改動的回歸量，不是文獻驗證。

| 動作 ID | 主要自由度 | 舊峰值 Nm | 新峰值 Nm | 變化 |
|---|---|---:|---:|---:|
| squat-high | hipExt | 202.52 | 199.37 | -1.6% |
| squat-low | hipExt | 209.53 | 206.37 | -1.5% |
| front-squat | hipExt | 195.60 | 192.44 | -1.6% |
| goblet-squat | hipExt | 102.33 | 99.21 | -3.1% |
| smith-squat | kneeExt | 155.04 | 154.36 | -0.4% |
| leg-press | kneeExt | 162.30 | 162.34 | +0.0% |
| hack-squat | kneeExt | 163.92 | 163.14 | -0.5% |
| deadlift | hipExt | 242.80 | 243.13 | +0.1% |
| deficit-dl | hipExt | 243.71 | 244.04 | +0.1% |
| block-pull | hipExt | 238.87 | 239.19 | +0.1% |
| sumo | hipExt | 203.08 | 203.33 | +0.1% |
| rdl | hipExt | 188.01 | 188.31 | +0.2% |
| good-morning | hipExt | 155.21 | 154.87 | -0.2% |
| hip-thrust | hipExt | 203.47 | 202.42 | -0.5% |
| back-extension | hipExt | 95.63 | 96.01 | +0.4% |
| glute-bridge | hipExt | 97.30 | 99.36 | +2.1% |
| bench | shFwd | 57.69 | 58.39 | +1.2% |
| incline-bench | shFwd | 56.14 | 56.80 | +1.2% |
| cg-bench | shFwd | 45.62 | 46.29 | +1.5% |
| floor-press | shFwd | 58.63 | 59.37 | +1.3% |
| db-bench | shFwd | 46.74 | 47.43 | +1.5% |
| db-bench-incline | shFwd | 41.36 | 41.89 | +1.3% |
| pushup | elbExt | 49.32 | 49.04 | -0.6% |
| pushup-feet | elbExt | 53.36 | 53.08 | -0.5% |
| pushup-hands | elbExt | 45.67 | 45.39 | -0.6% |
| chest-press | shFwd | 47.92 | 47.86 | -0.1% |
| pec-deck | shFwd | 34.89 | 35.17 | +0.8% |
| reverse-deck | scRet | 56.73 | 56.73 | -0.0% |
| machine-press | scElev | 66.74 | 67.17 | +0.7% |
| cable-fly-high | shSide | 29.09 | 28.83 | -0.9% |
| cable-fly-mid | shFwd | 34.71 | 34.80 | +0.2% |
| cable-fly-low | shFwd | 46.12 | 46.40 | +0.6% |
| ohp | scElev | 54.12 | 54.57 | +0.8% |
| db-press | scElev | 56.30 | 56.76 | +0.8% |
| dips | scElev | 98.49 | 97.81 | -0.7% |
| dips-upright | scElev | 103.32 | 102.84 | -0.5% |
| row | hipExt | 185.77 | 186.08 | +0.2% |
| row-sup | hipExt | 185.77 | 186.08 | +0.2% |
| cable-row | trunkExt | 156.98 | 157.89 | +0.6% |
| cable-row-wide | trunkExt | 156.99 | 157.91 | +0.6% |
| db-reverse-fly | hipExt | 102.21 | 102.67 | +0.4% |
| uprow | scElev | 43.55 | 44.37 | +1.9% |
| pulldown | scElev | 60.55 | 59.96 | -1.0% |
| pulldown-sup | scElev | 42.37 | 41.84 | -1.2% |
| pullup | scElev | 90.92 | 89.95 | -1.1% |
| pullup-wide | scElev | 96.63 | 95.84 | -0.8% |
| chinup | elbExt | 92.53 | 93.94 | +1.5% |
| assist-pullup | scElev | 50.50 | 49.66 | -1.7% |
| assist-chinup | elbExt | 50.28 | 49.74 | -1.1% |
| leg-ext | kneeExt | 135.49 | 135.18 | -0.2% |
| calf-raise-standing | ankPF | 126.17 | 126.31 | +0.1% |
| calf-raise-seated | ankPF | 64.32 | 69.77 | +8.5% |
| hip-abduction | hipAbd | 39.96 | 39.96 | +0.0% |
| hip-adduction | hipAbd | 41.38 | 41.38 | +0.0% |
| leg-curl | kneeExt | 40.58 | 41.13 | +1.3% |
| lying-leg-curl | kneeExt | 58.95 | 58.40 | -0.9% |
| pushdown | shFwd | 33.79 | 33.99 | +0.6% |
| curl | shFwd | 50.72 | 50.63 | -0.2% |
| reverse-curl | shFwd | 50.72 | 50.63 | -0.2% |
| lat-raise | scElev | 60.64 | 61.13 | +0.8% |
| db-curl | shFwd | 45.75 | 45.64 | -0.3% |
| hammer-curl | shFwd | 45.75 | 45.64 | -0.3% |
| shrug | scElev | 77.71 | 77.74 | +0.0% |

主要力矩峰值變化範圍：-3.1% 至 +8.5%；63 項皆列於上表。

## 逐筆深蹲數值驗證

狀態只由既定定義及容許範圍決定。下表「舊→新」是模型值；文獻與門檻沒有更動。

| 比對 ID | 舊→新模型值 | 文獻值 | 狀態（舊→新） |
|---|---:|---:|---|
| gorsic-2020/straight-back/trunk | 54.76 → 53.75 | 37.90 | fail → fail |
| gorsic-2020/straight-back/lumbar | 2.51 → 2.48 | 1.53 | fail → fail |
| gorsic-2020/straight-back/hip | 1.43 → 1.40 | 0.93 | fail → fail |
| gorsic-2020/straight-back/knee | 0.49 → 0.49 | 0.67 | pass → pass |
| gorsic-2020/straight-back/ankle | 0.34 → 0.34 | 0.28 | pass → pass |
| gorsic-2020/straight-front/trunk | 39.58 → 38.04 | 40.60 | pass → pass |
| gorsic-2020/straight-front/lumbar | 2.49 → 2.47 | 1.64 | fail → fail |
| gorsic-2020/straight-front/hip | 1.38 → 1.36 | 0.89 | fail → fail |
| gorsic-2020/straight-front/knee | 0.53 → 0.53 | 0.70 | pass → pass |
| gorsic-2020/straight-front/ankle | 0.34 → 0.34 | 0.25 | pass → pass |
| gullett-2009/back/peak-knee | 1.48 → 1.48 | 1.00 | pass → pass |
| gullett-2009/front/peak-knee | 1.41 → 1.41 | 0.70 | fail → fail |
| hutchison-2019/steel-back/peak-hip | 384.68 → 379.07 | 324.00 | exploratory → exploratory |
| hutchison-2019/steel-back/peak-knee | 123.88 → 123.94 | 157.00 | exploratory → exploratory |
| hutchison-2019/steel-back/peak-ankle | 93.77 → 94.09 | 90.00 | exploratory → exploratory |
| larsen-2021/high-narrow/trunk | 46.28 → 45.60 | 46.70 | pass → pass |
| larsen-2021/high-narrow/hip | 141.24 → 140.56 | — | definition-mismatch → definition-mismatch |
| larsen-2021/high-narrow/knee | 125.88 → 125.88 | 126.40 | consistency-check → consistency-check |
| larsen-2021/high-narrow/ankle | 31.12 → 31.12 | — | definition-mismatch → definition-mismatch |
| larsen-2021/high-wide/trunk | 35.01 → 34.61 | 46.00 | fail → fail |
| larsen-2021/high-wide/hip | 129.97 → 129.57 | — | definition-mismatch → definition-mismatch |
| larsen-2021/high-wide/knee | 121.55 → 121.55 | 119.30 | consistency-check → consistency-check |
| larsen-2021/high-wide/ankle | 28.80 → 28.80 | — | definition-mismatch → definition-mismatch |
| larsen-2021/low-narrow/trunk | 58.86 → 57.91 | 56.70 | pass → pass |
| larsen-2021/low-narrow/hip | 153.82 → 152.87 | — | definition-mismatch → definition-mismatch |
| larsen-2021/low-narrow/knee | 123.95 → 123.95 | 122.70 | consistency-check → consistency-check |
| larsen-2021/low-narrow/ankle | 29.18 → 29.18 | — | definition-mismatch → definition-mismatch |
| larsen-2021/low-wide/trunk | 45.76 → 45.20 | 53.00 | pass → pass |
| larsen-2021/low-wide/hip | 140.72 → 140.16 | — | definition-mismatch → definition-mismatch |
| larsen-2021/low-wide/knee | 119.70 → 119.70 | 120.30 | consistency-check → consistency-check |
| larsen-2021/low-wide/ankle | 26.68 → 26.68 | — | definition-mismatch → definition-mismatch |

可比較項：9/16 → 9/16 通過。未計分狀態未改。

Goršič 背蹲軀幹 54.76°→53.75°，仍高於研究 37.90°；背蹲髖 1.43→1.40、中央腰背 2.51→2.48，前蹲髖 1.38→1.36、中央腰背 2.49→2.47 Nm/(kg·m)，四項仍失敗。Larsen 高槓寬站軀幹 35.01°→34.61°，對研究 46.00° 的差距略擴大，照實保留。寬站大腿矢狀投影變短加上固定中足壓力中心，仍會使軀幹偏直立；原有註解所述方向未變，不能以這筆資料反調 `domShift`。

定性趨勢維持 52/56。`tests/plausibility.mjs` 的已知問題總數維持 28：`dips-upright activation:trilong` 因活化降至門檻內而移除；`cable-row rank:midtrap:top4` 因中斜方肌跌出前四而新增。後者可能來自手臂質量與質心造成的肩胛力矩變化，但尚無對應量測，因此列為退步，不另調肌肉能力。

## 尚未實作的骨盆與壓力中心設計

若要拆骨盆與腰椎以上，需為骨盆建立獨立角度、薦骨／腰椎作用點及兩段質心；de Leva 表 4 的軀幹上／中／下段質量 15.96%／16.33%／11.17% 可作質量起點，但下段（臍部到髖中點）不等於純骨盆。需再取得同深蹲負重、站距、深度下的骨盆與腰椎角度時間曲線，才能定腰骨盆節律。[深蹲薦骨／腰椎研究](https://pubmed.ncbi.nlm.nih.gov/20885195/)報告站距與性別差異；[深度與時序研究](https://www.jssm.org/volume19/iss3/cap/jssm-19-500.pdf)指出各段峰值並不同步，無單一可安全移植的比例。因此未新增骨盆自由度，Larsen 四筆髖角仍為 `definition-mismatch`。

平衡求解仍以中足 `cop.z=0` 為示範假設。壓力中心可隨階段及策略移動，但目前找到的[壓力中心前移實驗](https://pubmed.ncbi.nlm.nih.gov/31191094/)是刻意把 COP 移至極前方，不能代表這些負重深蹲的自然定點；未採其位置，也沒有調整壓力中心或站距 `domShift`。
