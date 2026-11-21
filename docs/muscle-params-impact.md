# 肌肉參數更換後的清單影響

以每個清單項目的 `defaultParams(lift) + c.set`，用 `peakAnalysis(lift,P,12)` 掃描 13 個行程點；表內是肌肉顯示值 `s = min(活化度,1.5)+被動份額` 的峰值前四名，四捨五入至兩位。改前來自修改前分支程式執行結果，改後來自本次完成的參數。這是**整個行程的各肌肉最大值**，四個峰值不一定發生在同一姿勢；數字也不是 EMG 百分比。

標記：**A** 單一軀幹肌肉的活化過高；**Q** 深蹲股廣肌群只排第四；**S** 硬舉的背闊肌作為穩定肌排在主要髖／膝伸肌前；**B** 臀推／臀橋的臀大肌不是第一；**C** 肩部旋轉肌袖或軀幹穩定肌相對過高；**D** 下壓時三頭肌不是第一。— 表示未在這個簡單排行中發現顯著異常，並非已驗證生理正確。

| 清單項目 | 改前峰值前四名 | 改後峰值前四名 | 檢視 |
|---|---|---|---|
| squat-high | addmag 1.07、vasti 0.76、hams 0.74、erec 0.73 | erec 1.50、hams 0.67、gmax 0.55、vasti 0.49 | A、Q |
| squat-low | addmag 1.22、hams 0.83、vasti 0.76、gmax 0.75 | erec 1.50、hams 0.69、gmax 0.58、vasti 0.48 | A、Q |
| front-squat | addmag 0.96、erec 0.77、vasti 0.74、gmax 0.71 | erec 1.50、hams 0.67、gmax 0.55、vasti 0.49 | A、Q |
| smith-squat | vasti 0.69、gmax 0.32、erec 0.27、addmag 0.20 | erec 1.07、vasti 0.39、gmax 0.22、hams 0.14 | A |
| leg-press | vasti 0.74、gmax 0.32、addmag 0.28、hams 0.25 | vasti 0.41、gmax 0.30、hams 0.16、gmed 0.09 | — |
| deadlift | addmag 1.09、gmax 0.97、erec 0.88、hams 0.87 | erec 1.50、lat 1.45、hams 0.85、gmax 0.65 | A、S |
| deficit-dl | addmag 1.09、gmax 0.97、erec 0.89、hams 0.88 | erec 1.50、lat 1.33、hams 0.85、gmax 0.65 | A、S |
| block-pull | addmag 0.96、gmax 0.91、lat 0.90、erec 0.85 | erec 1.50、lat 1.50、hams 0.80、gmax 0.62 | A、S |
| sumo | addmag 1.42、vasti 0.82、hams 0.75、addl 0.73 | erec 1.50、lat 1.02、hams 0.58、gmax 0.54 | A、S |
| rdl | hams 1.39、lat 0.68、erec 0.66、addmag 0.41 | erec 1.50、lat 1.27、hams 0.58、gmax 0.47 | A、S |
| good-morning | hams 1.35、erec 0.56、gas 0.44、addmag 0.29 | erec 1.50、hams 0.52、gmax 0.34、ra 0.33 | A |
| hip-thrust | gmax 0.65、hams 0.43、erec 0.43、gmed 0.22 | erec 1.50、hams 0.46、gmax 0.39、gmed 0.37 | A、B |
| glute-bridge | gmax 0.43、erec 0.33、hams 0.33、gmed 0.17 | erec 1.32、gmed 0.27、gmax 0.21、hams 0.20 | A、B |
| bench | pecs 0.64、trilat 0.47、trilong 0.32、bic 0.21 | pecs 0.97、subsc 0.57、pecc 0.47、trilat 0.44 | C |
| incline-bench | pecc 0.74、adelt 0.73、pecs 0.55、trilat 0.49 | pecs 0.76、adelt 0.76、trilat 0.46、pecc 0.37 | — |
| cg-bench | trilat 1.13、adelt 0.70、pecc 0.53、infra 0.53 | trilat 1.05、adelt 0.60、trilong 0.51、pecs 0.51 | — |
| floor-press | pecs 0.69、trilat 0.46、subsc 0.42、trilong 0.40 | pecs 0.98、subsc 0.84、trilong 0.46、trilat 0.43 | C |
| chest-press | trilat 0.72、pecs 0.56、trilong 0.42、subsc 0.15 | pecs 0.91、trilat 0.69、trilong 0.50、pecc 0.44 | — |
| ohp | adelt 1.20、infra 1.13、trilat 0.83、uptrap 0.81 | adelt 0.90、trilat 0.79、uptrap 0.75、mdelt 0.70 | — |
| row | hams 1.19、uptrap 1.14、infra 1.03、mdelt 1.01 | erec 1.50、lat 1.28、uptrap 1.24、mdelt 1.18 | A |
| row-sup | hams 1.19、uptrap 1.15、mdelt 1.01、infra 1.01 | erec 1.50、lat 1.29、uptrap 1.25、mdelt 1.18 | A |
| cable-row | brach 1.09、uptrap 0.90、bic 0.73、erec 0.64 | erec 1.50、lat 1.02、uptrap 0.87、brach 0.85 | A |
| cable-row-wide | uptrap 1.13、mdelt 1.11、pdelt 0.90、brach 0.87 | erec 1.50、mdelt 1.32、lat 1.28、uptrap 1.26 | A |
| uprow | brach 0.97、infra 0.97、uptrap 0.67、bic 0.66 | infra 1.21、uptrap 0.91、mdelt 0.73、brach 0.57 | C |
| pulldown | lat 0.97、brach 0.73、ra 0.70、infra 0.60 | ra 1.50、lat 1.50、brach 0.75、trilong 0.55 | A |
| pulldown-sup | lat 0.85、brach 0.84、bic 0.82、ra 0.69 | ra 1.50、lat 1.18、brach 0.90、trilong 0.65 | A |
| leg-ext | vasti 0.53、rf 0.09、hams 0.03、gas 0.00 | vasti 0.30、rf 0.06、hams 0.00、gas 0.00 | — |
| leg-curl | hams 0.54、gas 0.36、vasti 0.00、rf 0.00 | hams 0.20、gas 0.15、vasti 0.00、rf 0.00 | — |
| lying-leg-curl | hams 0.61、gas 0.53、rf 0.03、vasti 0.00 | hams 0.28、gas 0.21、vasti 0.00、rf 0.00 | — |
| pushdown | trilat 0.49、trilong 0.31、lat 0.28、ra 0.25 | ra 0.85、lat 0.52、trilat 0.45、trilong 0.42 | D |
| curl | bic 1.04、brach 0.76、uptrap 0.63、subsc 0.45 | bic 0.77、erec 0.75、pecs 0.61、uptrap 0.56 | C |
| reverse-curl | brach 1.12、uptrap 0.65、bic 0.56、subsc 0.45 | erec 0.75、brach 0.73、pecs 0.66、uptrap 0.57 | C |
| shrug | uptrap 1.24、hams 0.45、serr 0.44、gas 0.43 | uptrap 1.24、erec 0.85、serr 0.44、pecs 0.30 | A |

## 檢查與剩餘不確定性

- 165 個快照姿勢、2,935 個肌肉活化值中，超過 1 的格數由 34 增至 106；其中 `erec` 佔 66 格，最高為赤字硬舉 `e=0.75` 的 3.6261。這表示簡化模型在這些姿勢下**沒有可行的生理活化解**，不宜把截斷的顯示值 1.50 解讀為正常肌肉負荷。
- 關節力矩 `dem` 的計算式未修改；這些排行變化源自 F、Lf、力臂與長度尺度。R 的股廣肌群、臀大肌、內收大肌與 U 的胸大肌、三角肌等替換為固定模型版本的數值；來源與逐項公式見 [肌肉參數](muscle-params.md)。
- **A／Q／B：** Christophy Table 1 單側豎脊肌合計 F=1285 N，原估計 5000 N；本工具只有一條 `erec`，沒有多裂肌、腹斜肌及腰椎逐節分配。確認力臂正號與需求方向一致後，仍有多項 `erec` 真實活化度超過 1，顯示目前的簡化肌肉集合承擔不了既定外力。峰值 1.50 是顯示上限，**不是**可達到的生理容量。深蹲股廣肌群仍在前四，但排序偏低；臀推與臀橋的臀大肌排序也偏低。臀大肌的直線弦力臂在深屈髖時穿過骨盆，故拒絕該錯誤外插並保留原繞行估計（文件標「調整／估計」）；修正後仍不能消除 B。若要真正修正，須增列腰背肌束、正確包覆路徑或重新校正負重／長度模型；不能單為排行調高 F。
- **S／C／D：** `lat` 原估計 F=1500 N，MoBL-ARMS 三束合計為 797 N；硬舉負重仍要求肩穩定力矩，造成背闊肌高活化。肩水平內收、肱骨軸向旋轉與胸鎖等效軸未能直接對到 U／S 模型；臥推與直立划船的旋轉肌袖、下壓時的腹直肌與背闊肌、彎舉時胸肌等排行受此影響。已檢查外力力矩與力臂符號，未找到可用單一符號反轉修正的問題。這些仍是模型限制，不能當成教練的肌肉招募預測。
- 纖維長普遍比舊估計短。若沿用舊式 `arms/Lf` 把整段肌腱路徑位移都算到纖維，許多項目同時達到 1.50；改採來源檔的 `Lf+肌腱鬆弛長` 作長度尺度後，該系統性錯誤大幅下降。此尺度仍是近似，沒有解腱彈性或逐肌束最佳長度狀態。
