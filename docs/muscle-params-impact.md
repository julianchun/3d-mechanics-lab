# 肌肉參數審查修正後的清單影響

比較本分支與目前 `main` 的 `src/biomech.js`。兩側均使用本分支清單預設參數與每項 13 個行程點；表內為顯示負荷 `s=min(a,1.5)+被動份額` 的峰值前四名。各肌肉峰值不一定在同一姿勢，不能解讀為 EMG 百分比。

| 清單項目 | main 峰值前四名 | 本分支峰值前四名 |
|---|---|---|
| squat-high | addmag 1.07、vasti 0.76、hams 0.74、erec 0.73 | erec 0.79、vasti 0.74、gmax 0.72、hams 0.49 |
| squat-low | addmag 1.22、hams 0.83、vasti 0.76、gmax 0.75 | erec 0.79、gmax 0.75、vasti 0.73、hams 0.50 |
| front-squat | addmag 0.97、erec 0.78、vasti 0.73、gmax 0.72 | erec 0.83、vasti 0.74、gmax 0.71、hams 0.49 |
| smith-squat | vasti 0.68、gmax 0.32、erec 0.27、addmag 0.20 | vasti 0.63、gmax 0.36、erec 0.29、gmed 0.11 |
| leg-press | vasti 0.74、gmax 0.32、addmag 0.28、hams 0.25 | vasti 0.67、gmax 0.45、gmed 0.13、hams 0.13 |
| deadlift | addmag 1.09、gmax 0.97、erec 0.88、hams 0.87 | erec 0.96、gmax 0.79、lat 0.77、hams 0.66 |
| deficit-dl | addmag 1.09、gmax 0.97、erec 0.89、hams 0.88 | erec 0.96、gmax 0.79、lat 0.71、vasti 0.68 |
| block-pull | addmag 0.96、gmax 0.91、lat 0.90、erec 0.85 | lat 0.93、erec 0.92、gmax 0.72、hams 0.64 |
| sumo | addmag 1.42、vasti 0.82、hams 0.75、addl 0.73 | vasti 0.89、erec 0.79、gmax 0.72、lat 0.54 |
| rdl | hams 1.39、lat 0.68、erec 0.66、addmag 0.41 | erec 0.71、lat 0.67、hams 0.53、gmax 0.46 |
| good-morning | hams 1.35、erec 0.56、gas 0.44、addmag 0.29 | erec 0.61、hams 0.49、gmax 0.32、gas 0.13 |
| hip-thrust | gmax 0.65、hams 0.43、erec 0.43、gmed 0.22 | erec 0.47、gmax 0.45、hams 0.38、gmed 0.37 |
| glute-bridge | gmax 0.43、erec 0.33、hams 0.33、gmed 0.17 | erec 0.36、gmed 0.27、gmax 0.24、vasti 0.21 |
| bench | pecs 0.64、trilat 0.46、trilong 0.32、bic 0.21 | pecs 0.89、adelt 0.62、trilat 0.49、subsc 0.44 |
| incline-bench | pecc 0.75、adelt 0.73、pecs 0.55、trilat 0.49 | adelt 0.86、pecs 0.64、trilat 0.42、pecc 0.27 |
| cg-bench | trilat 1.13、adelt 0.70、pecc 0.53、infra 0.53 | trilat 0.99、adelt 0.79、pecs 0.36、subsc 0.32 |
| floor-press | pecs 0.69、trilat 0.46、subsc 0.42、trilong 0.40 | pecs 0.79、adelt 0.65、trilat 0.50、subsc 0.31 |
| chest-press | trilat 0.73、pecs 0.48、trilong 0.42、pecc 0.14 | pecs 0.83、trilat 0.70、adelt 0.56、subsc 0.42 |
| ohp | adelt 1.20、infra 1.13、trilat 0.83、uptrap 0.80 | adelt 0.65、trilat 0.64、mdelt 0.47、uptrap 0.47 |
| row | hams 1.19、uptrap 1.14、infra 1.03、mdelt 1.01 | infra 0.86、mdelt 0.77、erec 0.73、uptrap 0.72 |
| row-sup | hams 1.19、uptrap 1.15、mdelt 1.02、infra 1.01 | infra 0.85、mdelt 0.78、uptrap 0.73、erec 0.73 |
| cable-row | brach 1.09、uptrap 0.90、bic 0.73、erec 0.64 | erec 0.70、brach 0.66、corb 0.60、lat 0.59 |
| cable-row-wide | uptrap 1.13、mdelt 1.11、pdelt 0.90、brach 0.87 | mdelt 0.78、erec 0.70、uptrap 0.67、midtrap 0.67 |
| uprow | brach 0.98、infra 0.97、uptrap 0.67、bic 0.66 | brach 0.56、adelt 0.50、infra 0.43、uptrap 0.36 |
| pulldown | lat 0.97、brach 0.73、ra 0.70、infra 0.60 | lat 0.84、brach 0.50、ra 0.50、adelt 0.46 |
| pulldown-sup | lat 0.85、brach 0.84、bic 0.82、ra 0.69 | lat 0.69、bic 0.51、ra 0.49、brach 0.43 |
| leg-ext | vasti 0.53、rf 0.09、hams 0.03、gas 0.00 | vasti 0.51、rf 0.20、hams 0.00、gas 0.00 |
| leg-curl | hams 0.54、gas 0.36、vasti 0.00、rf 0.00 | hams 0.20、gas 0.15、vasti 0.00、rf 0.00 |
| lying-leg-curl | hams 0.61、gas 0.53、rf 0.03、vasti 0.00 | hams 0.28、gas 0.21、vasti 0.00、rf 0.00 |
| pushdown | trilat 0.46、trilong 0.37、lat 0.34、ra 0.33 | trilat 0.44、lat 0.31、trilong 0.27、ra 0.18 |
| curl | bic 1.04、brach 0.76、uptrap 0.63、subsc 0.45 | adelt 0.91、bic 0.79、brach 0.44、subsc 0.42 |
| reverse-curl | brach 1.12、uptrap 0.65、bic 0.56、subsc 0.45 | adelt 0.98、brach 0.72、bic 0.43、subsc 0.42 |
| shrug | uptrap 1.24、hams 0.45、serr 0.44、gas 0.43 | corb 0.99、uptrap 0.70、tmaj 0.52、adelt 0.49 |

## 數值與合理性摘要

- 13 點掃描：main 的 `a>1` 為 **81** 格、峰值 **1.296**；本分支為 **0** 格、峰值 **0.988**。41 點 plausibility 亦無 `a>1`。
- 相對目前 main 的 165 個回歸姿勢，`dem` 數值差異 **146** 格、`warn` 差異 **3** 格、`ok` 差異 **0** 格。這些差異由本分支先前已提交的姿勢與器械修改造成；本次審查修正未增加新的 `dem/warn/ok` 差異。
- 臀推移除 `gmax` ×3 偏好後，臀大肌由第一降為第二；臀橋仍由腰背伸肌領先。直立划船不再由棘下肌排名第一，因移除了未校準胸肌長度代理帶來的虛假被動張力。
- `npm run test:trends`：**37 PASS／5 FAIL**。未通過的是低槓／高槓腰椎力矩、前蹲／高槓髖力矩、寬窄站距臀大肌、臀推／深蹲臀大肌、臀橋／臀推臀大肌。
- 槓鈴划船的旋轉肌袖仍偏高；彎舉肩前束及聳肩喙肱肌亦偏高。肩胛等效軸、肩屈與外展投影、胸肌被動長度需進一步校準。`lRigid` 是診斷值，尚未參與出力。

參數來源與局限見 [肌肉參數說明](muscle-params.md)。
