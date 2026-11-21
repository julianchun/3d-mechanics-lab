# 肌肉參數修正後的清單影響

比較「原本 main」工作樹 `/home/ubuntu/workspace/3d-mechanical-model` 的 `src/biomech.js` 與本分支修正後模型。兩邊均以本分支 `CATALOG` 的 `defaultParams(lift)+c.set`、`peakAnalysis(lift,P,12)` 掃描每項 13 個行程點；表內是顯示負荷 `s=min(a,1.5)+被動份額` 的峰值前四名。四個峰值不一定出現在同一姿勢，數字不是 EMG 百分比。`tests/plausibility.mjs` 用 41 點掃描，超載判定則用未截斷的 `a`。

| 清單項目 | 原本 main 峰值前四名 | 本分支修正後峰值前四名 |
|---|---|---|
| squat-high | addmag 1.07、vasti 0.76、hams 0.74、erec 0.73 | vasti 0.89、erec 0.79、gmax 0.69、hams 0.59 |
| squat-low | addmag 1.22、hams 0.83、vasti 0.76、gmax 0.75 | vasti 0.88、erec 0.79、gmax 0.71、hams 0.62 |
| front-squat | addmag 0.96、erec 0.77、vasti 0.74、gmax 0.71 | vasti 0.87、erec 0.83、gmax 0.69、hams 0.58 |
| smith-squat | vasti 0.68、gmax 0.32、erec 0.27、addmag 0.20 | vasti 0.65、gmax 0.37、erec 0.29、gmed 0.12 |
| leg-press | vasti 0.74、gmax 0.32、addmag 0.28、hams 0.25 | vasti 0.72、gmax 0.42、hams 0.14、gmed 0.14 |
| deadlift | addmag 1.09、gmax 0.97、erec 0.88、hams 0.87 | erec 0.96、hams 0.78、lat 0.77、gmax 0.75 |
| deficit-dl | addmag 1.09、gmax 0.97、erec 0.89、hams 0.88 | erec 0.96、hams 0.78、vasti 0.78、gmax 0.76 |
| block-pull | addmag 0.96、gmax 0.91、lat 0.90、erec 0.85 | lat 0.93、erec 0.92、hams 0.74、gmax 0.70 |
| sumo | addmag 1.42、vasti 0.82、hams 0.75、addl 0.73 | vasti 0.97、erec 0.79、gmax 0.70、lat 0.54 |
| rdl | hams 1.39、lat 0.68、erec 0.66、addmag 0.41 | erec 0.71、lat 0.68、hams 0.58、gmax 0.48 |
| good-morning | hams 1.35、erec 0.56、gas 0.44、addmag 0.29 | erec 0.61、hams 0.52、gmax 0.34、addmag 0.12 |
| hip-thrust | gmax 0.65、hams 0.43、erec 0.43、gmed 0.22 | gmax 0.70、erec 0.47、gmed 0.40、hams 0.21 |
| glute-bridge | gmax 0.43、erec 0.33、hams 0.33、gmed 0.17 | erec 0.36、gmax 0.34、gmed 0.29、vasti 0.16 |
| bench | pecs 0.64、trilat 0.46、trilong 0.32、bic 0.21 | pecs 0.96、subsc 0.56、pecc 0.47、trilat 0.42 |
| incline-bench | pecc 0.75、adelt 0.73、pecs 0.55、trilat 0.49 | adelt 0.90、pecs 0.76、trilat 0.42、pecc 0.37 |
| cg-bench | trilat 1.13、adelt 0.70、pecc 0.53、infra 0.53 | trilat 0.99、adelt 0.55、pecs 0.50、trilong 0.42 |
| floor-press | pecs 0.69、trilat 0.46、subsc 0.42、trilong 0.40 | pecs 0.97、subsc 0.76、trilat 0.42、trilong 0.37 |
| chest-press | trilat 0.73、pecs 0.56、trilong 0.42、subsc 0.15 | pecs 0.90、trilat 0.65、pecc 0.45、trilong 0.43 |
| ohp | adelt 1.20、infra 1.13、trilat 0.83、uptrap 0.80 | adelt 0.90、trilat 0.74、uptrap 0.47、mdelt 0.47 |
| row | hams 1.19、uptrap 1.14、infra 1.03、mdelt 1.01 | mdelt 0.87、uptrap 0.83、lat 0.79、erec 0.73 |
| row-sup | hams 1.19、uptrap 1.15、mdelt 1.02、infra 1.01 | mdelt 0.87、uptrap 0.83、lat 0.80、erec 0.73 |
| cable-row | brach 1.09、uptrap 0.90、bic 0.73、erec 0.64 | erec 0.70、brach 0.67、lat 0.61、uptrap 0.58 |
| cable-row-wide | uptrap 1.13、mdelt 1.11、pdelt 0.90、brach 0.87 | mdelt 0.98、uptrap 0.84、lat 0.80、infra 0.77 |
| uprow | brach 0.98、infra 0.97、uptrap 0.67、bic 0.66 | infra 0.90、uptrap 0.59、brach 0.58、mdelt 0.51 |
| pulldown | lat 0.97、brach 0.73、ra 0.70、infra 0.60 | lat 0.90、brach 0.55、trilong 0.50、ra 0.50 |
| pulldown-sup | lat 0.85、brach 0.84、bic 0.82、ra 0.69 | lat 0.68、trilong 0.59、bic 0.55、ra 0.49 |
| leg-ext | vasti 0.53、rf 0.09、hams 0.03、gas 0.00 | vasti 0.51、rf 0.20、hams 0.00、gas 0.00 |
| leg-curl | hams 0.54、gas 0.36、vasti 0.00、rf 0.00 | hams 0.20、gas 0.15、vasti 0.00、rf 0.00 |
| lying-leg-curl | hams 0.61、gas 0.53、rf 0.03、vasti 0.00 | hams 0.28、gas 0.21、vasti 0.00、rf 0.00 |
| pushdown | trilat 0.49、trilong 0.31、lat 0.28、ra 0.25 | trilat 0.46、lat 0.31、trilong 0.29、ra 0.18 |
| curl | bic 1.04、brach 0.76、uptrap 0.63、subsc 0.45 | bic 0.74、pecs 0.64、brach 0.48、subsc 0.41 |
| reverse-curl | brach 1.12、uptrap 0.65、bic 0.56、subsc 0.45 | brach 0.74、pecs 0.68、adelt 0.43、subsc 0.41 |
| shrug | uptrap 1.24、hams 0.45、serr 0.44、gas 0.43 | uptrap 0.82、pecs 0.35、serr 0.26、erec 0.23 |

## 數值與合理性摘要

- 以每項 13 點直接比較，原本 main 的 `a>1` 有 **81** 個肌肉／姿勢格，峰值 **1.296**；本分支為 **0** 格，峰值 **0.991**。全程 41 點的 plausibility 亦無 `a>1`；這是預設清單參數的檢查，不能外推到所有滑桿組合。
- 相對本分支修正前的 T1 回歸基準，165 個姿勢快照的 `dem`、`warn`、`ok` 均不變；肌肉主動活化有 **1,426** 個數值改變，最大絕對差 **2.678**，`a>1` 由 **106** 格降至 **0** 格。
- 關節外力矩 `dem` 無差異；變化都來自 F、二頭肌肩部力臂及臀推分配偏好。高槓／低槓／前蹲的股廣肌顯示排名均為第一；臀推臀大肌第一；下拉背闊肌第一；三頭下壓三頭肌第一。
- `npm run test:trends` 為 **36 PASS／6 FAIL**（最低要求 35／42）。未通過的方向是低槓與高槓的腰椎力矩、前蹲與高槓的髖力矩、寬窄深蹲臀大肌、臀橋與臀推臀大肌、同握距下拉握法、坐姿滑輪划船窄寬握背闊肌。細節見 [`tests/trends.mjs`](../tests/trends.mjs) 與 [`docs/references.md`](references.md)。

## 仍不合理與模型限制

- 臀橋的顯示排名仍是腰背伸肌群 0.36、臀大肌 0.34；文獻對臀橋與臀推同相對負荷的臀大肌比較，和本模型的絕對負重及接觸反力假設無法直接相提並論。臀橋的外部支撐／受力仍須獨立驗證。
- RDL 與早安體前屈的膕繩肌分別只排第三、第二；直立划船的旋轉肌袖排第一；坐姿滑輪划船的腰背伸肌群略高於背闊肌。這些跨肌肉排名不是 EMG，尤其肩水平內收與肩胛等效軸尚無逐束驗證。
- 髖伸、膝伸以外的下肢理論最大力矩仍高於健康受試者量測平均；`fl`、腱順應性與最適關節角度都未逐肌束求解。能力對照與未校正項目見 [`docs/muscle-params.md`](muscle-params.md)。
