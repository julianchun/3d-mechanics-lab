# 肌肉參數來源與轉換

本表對應 `src/biomech.js` 的右側 `MUSCLES`。力 `F` 單位 N，最佳纖維長 `Lf`、長度尺度 `Lmt` 與力臂單位 m。模型只顯示右側，左側鏡像；每條肌肉的 `F` **沒有乘二**。參數是一般人體模型值，不是使用者個別肌力測量。

## 已核對來源

- **R**：[Rajagopal et al. (2016)](https://pubmed.ncbi.nlm.nih.gov/27392337/)，[OpenSim `Rajagopal2016.osim`](https://github.com/opensim-org/opensim-models/blob/d9b05d470b1a481c222372c85b75772faf8f7792/Models/Rajagopal/Rajagopal2016.osim)，`opensim-models` commit `d9b05d470b1a481c222372c85b75772faf8f7792`。該儲存庫 [README](https://github.com/opensim-org/opensim-models/blob/d9b05d470b1a481c222372c85b75772faf8f7792/Models/Rajagopal/README.txt) 說明：此檔從原始發布版更新至 OpenSim 4.5 XML 格式，並將纖維阻尼設為 0.1；本文使用的 `F`、`Lf`、肌腱鬆弛長與路徑點都直接讀取此檔。
- **U**：[Holzbaur et al. (2005)](https://pubmed.ncbi.nlm.nih.gov/16078622/) 為上肢模型前身；實際取值來自 [Saul et al. (2015) MoBL-ARMS 動態模型](https://pmc.ncbi.nlm.nih.gov/articles/PMC4282829/) 的 [CEINMS-RT `MOBL_ARMS_41.osim`](https://github.com/CEINMS-RT/UpperLimbModel/blob/459e2ebbf47acb72b0ecbc59950a2d0a983d28db/MOBL_ARMS_41.osim)，commit `459e2ebbf47acb72b0ecbc59950a2d0a983d28db`。**不能把這些數字稱作 Holzbaur 原版的逐項數值。**
- **C**：[Christophy et al. (2012)](https://link.springer.com/content/pdf/10.1007/s10237-011-0290-6.pdf)，Table 1 的單側肌束表與 Fig. 7 的 L5/S1 力臂。SimTK `Lumbar_C_210.osim` 下載需登入，本次未取得可核對的模型檔版本；因此軀幹值標示為「論文表格」，**模型檔版本未查證**。
- **S**：[Seth et al. (2016)](https://pubmed.ncbi.nlm.nih.gov/26734761/) 與 [Seth et al. (2019)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6856649/) 說明肩胛胸廓模型；本次未取得可執行的對應 `.osim`，故沒有宣稱肩帶數值來自該模型。

`python3 tools/muscle_params.py` 以固定 commit 下載 R、U 檔案，重算下表的組合 `F`、`Lf` 與髖路徑弦力臂。採樣對應：`F=ΣFᵢ`；`Lf=Σ(Fᵢ Lfᵢ)/ΣFᵢ`；`Lmt=Σ[Fᵢ(Lfᵢ+Ltᵢ)]/ΣFᵢ`。`Lt` 是 `.osim` 的 tendon slack length。合併後的肌群各成分共用一個活化度；這是本工具現有單條肌肉結構的近似。`Lmt` 僅用於原有肌肉長度近似的分母，避免把整段肌腱位移誤當成短纖維位移；它**不是**最佳纖維長，也不是完整的腱順應性求解。

## F、Lf、Lmt 逐條資料

表內 `R`／`U` 的 F、Lf、Lmt 都來自上述固定版本模型檔；列出的肌束明確定義加總範圍。`C` 直接按 Table 1 的肌束欄位相加或抄錄。`估計` 沿用原值，因無法把現有簡化肌肉直接對到已取得的模型。四捨五入至程式中精度。

| id | 原始肌束／推導 | F | Lf | Lmt | 來源與狀態 |
|---|---|---:|---:|---:|---|
| vasti | vasint_r + vaslat_r + vasmed_r | 9594.0 | 0.0986 | 0.3101 | R，力加總、長度力加權 |
| rf | recfem_r | 2191.7 | 0.0759 | 0.5244 | R，直接取值 |
| hams | bflh_r + semimem_r + semiten_r | 4105.5 | 0.0960 | 0.4220 | R，**不含**僅跨膝的股二頭短頭；它不具本項 `hipExt` 力臂 |
| gmax | glmax1_r + glmax2_r + glmax3_r | 3337.6 | 0.1569 | 0.2197 | R，力加總、長度力加權 |
| gmed | glmed1_r + glmed2_r + glmed3_r | 2729.8 | 0.0730 | 0.1281 | R，力加總、長度力加權 |
| addmag | addmagDist_r + addmagIsch_r + addmagMid_r + addmagProx_r | 2389.2 | 0.1442 | 0.2418 | R，力加總、長度力加權 |
| addl | addlong_r + addbrev_r | 1542.6 | 0.1061 | 0.1988 | R，力加總、長度力加權 |
| ilio | iliacus_r + psoas_r | 2447.9 | 0.1126 | 0.2107 | R，力加總、長度力加權 |
| gas | gaslat_r + gasmed_r | 4690.6 | 0.0536 | 0.4447 | R，力加總、長度力加權 |
| sol | soleus_r | 6194.8 | 0.0440 | 0.3208 | R，直接取值 |
| ta | tibant_r | 1227.5 | 0.0683 | 0.3088 | R，直接取值 |
| erec | Table 1 的 IL_L、IL_R、LTpT_T、LTpT_R、LTpL_L 共 38 束 | 1285 | 0.0808 | 0.1947 | C，論文表格；模型檔版本未查證。F 加總，長度力加權；同側 |
| ra | Table 1 `rect_abd` | 261 | 0.2986 | 0.3796 | C，論文表格；模型檔版本未查證 |
| pecs | PECM2 + PECM3 | 1156.4 | 0.1385 | 0.2460 | U，中下胸 |
| pecc | PECM1 | 444.3 | 0.1442 | 0.1470 | U，上胸 |
| adelt | DELT1 | 1218.9 | 0.0976 | 0.1906 | U，前三角 |
| pdelt | DELT3 | 201.6 | 0.1367 | 0.1747 | U，後三角 |
| lat | LAT1 + LAT2 + LAT3 | 797.0 | 0.2513 | 0.3986 | U，背闊肌三區 |
| trilong | TRIlong | 771.8 | 0.1340 | 0.2770 | U，三頭長頭 |
| trilat | TRIlat + TRImed | 1435.0 | 0.1138 | 0.2082 | U，三頭外／內側頭 |
| bic | BIClong + BICshort | 841.9 | 0.1219 | 0.3641 | U，二頭長／短頭 |
| brach | BRA + BRD | 1453.4 | 0.1023 | 0.1709 | U，肱肌與肱橈肌 |
| tmaj | TMAJ | 144.0 | 0.1624 | 0.1824 | U，大圓肌 |
| corb | CORB | 208.2 | 0.0932 | 0.1902 | U，喙肱肌 |
| infra | INFSP + TMIN | 1345.3 | 0.0752 | 0.1141 | U，棘下肌與小圓肌 |
| subsc | SUBSC | 1306.9 | 0.0873 | 0.1203 | U，肩胛下肌 |
| mdelt | DELT2 | 1103.5 | 0.1078 | 0.2173 | U，三角肌中束 |
| midtrap | 斜方肌中束／菱形肌 | 1000 | 0.12 | 未使用 | **估計**：未取得 S 對應模型與分束 F、Lf；沿用原值 |
| uptrap | 斜方肌上束 | 900 | 0.15 | 未使用 | **估計**：同上 |
| lowtrap | 斜方肌下束 | 500 | 0.15 | 未使用 | **估計**：同上 |
| serr | 前鋸肌 | 1000 | 0.15 | 未使用 | **估計**：同上 |

## 力臂逐項資料

正號表示產生該自由度的正向力矩。`q` 是 `jointAngles` 的角度（弧度）；所有表值以 m 表示。未列出的自由度，該肌肉沒有力臂。

- `H(a,b,c)`：0°、45°、90° 三點二次插值；屈髖角限制在 0–90°。R 的 pelvis／femur 路徑點，取骨盆最後點、股骨第一點，以 `hip_r` 骨盆側中心 `(-0.056276,-0.07849,0.07726)` 及 Z 軸旋轉；用中央差分 `∂弦長/∂hip_flexion`，多束依 F 加權。忽略包覆物與移動路徑點，屬 **模型路徑推導近似**，非 OpenSim 完整力臂。
- `S(b,k,d)`：`b+d×clamp(q[k]/90°,-0.5,1.7)`。`b` 與每 90° 斜率 `d` 均是 **估計**；現有 `.osim` 的包覆幾何、膝髕骨耦合與肩三維座標未能在本工具直接求解。這項函數只讓現有自由度在實際動作範圍內連續變化，**不能**視作論文擬合。
- `A(r)`：`r×q.haddW`。`q.haddW` 是上臂離開軀幹長軸的投影係數；本工具沒有肱骨軸向旋轉自由度，故 `shHAdd` 是等效座標，所有 `A` 值皆為 **估計**。
- `X(r)`：`r×|cos(q.shElev)|`，軸向旋轉肌等效投影；也是 **估計**。
- `C(x,a,b)`：`clamp(x,a,b)`。`rad(n)` 表示角度轉弧度。`hipAbd` 符號與 R 模型的 hip_adduction 相反；使用 `∂弦長/∂hip_adduction` 得到本工具外展力臂。其餘未標示 R／C 的力臂皆沿用舊估計。

| id | 自由度＝數值／函數 | 來源與推導狀態 |
|---|---|---|
| vasti | kneeExt=`S(0.045,kneeFlex,+0.005)` | **估計**：髕骨與膝包覆未解析 |
| rf | kneeExt=`S(0.040,kneeFlex,+0.004)`；hipExt=`-0.035` | **估計**：跨膝／髖路徑含髕骨，未解析 |
| hams | hipExt=`S(0.060,hipFlex,-0.010)`；kneeExt=`S(-0.030,kneeFlex,-0.005)` | **估計**：跨膝的脛骨路徑未完整轉換 |
| gmax | hipExt=`0.075-0.020 C(q.hipFlex/rad(100),0,1.2)`；hipAbd=`-0.0051` | hipExt **調整／估計**：R 直線弦 0/45/90° 得 0.0621/0.0472/0.0206，但深屈髖時直線穿過骨盆、150° 會變負；沿用原繞行近似，不能宣稱已由 R 驗證。hipAbd 為 R 路徑弦推導 |
| gmed | hipAbd=`+0.0430` | R，0° 路徑弦與 F 加權；角度依賴未求得 |
| addmag | hipExt=`H(0.0094,0.0342,0.0362)`；hipAbd=`-0.0499` | R，路徑弦與 F 加權；髖屈超過 90° 固定端點，**外插估計** |
| addl | hipExt=`H(-0.0410,-0.0233,0.0148)`；hipAbd=`-0.0568` | R，路徑弦與 F 加權；髖屈超過 90° 固定端點，**外插估計** |
| ilio | hipExt=`H(-0.0217,-0.0347,-0.0370)` | R，路徑弦與 F 加權；忽略骨盆包覆，**近似** |
| gas | ankPF=`S(0.050,ankleDorsi,+0.005)`；kneeExt=`S(-0.020,kneeFlex,-0.003)` | **估計**：踝包覆與膝路徑未解析 |
| sol | ankPF=`S(0.050,ankleDorsi,+0.005)` | **估計**：踝包覆未解析 |
| ta | ankPF=`S(-0.040,ankleDorsi,+0.004)` | **估計**：踝包覆未解析 |
| erec | trunkExt=`+0.0465` | C Fig. 7，L5/S1 腰部 ES 約 4.6–4.7 cm；本工具未表示逐節腰椎，角度固定為 0 |
| ra | trunkExt=`-0.0635` | C Fig. 7，L5/S1 約 -6.7 至 -6.0 cm 的中點；本工具未表示逐節腰椎 |
| pecs | shHAdd=`A(+0.070)`；shFlex=`0.055-0.050 C(q.shFlex/rad(110),0,1)`；scElev=`-0.025` | **估計**：肩水平內收及胸鎖等效軸；肩屈曲曲線沿用原估計 |
| pecc | shHAdd=`A(+0.040)`；shFlex=`0.035 C((rad(150)-q.shFlex)/rad(50),0,1)` | **估計**：同上；肩屈曲曲線沿用原估計 |
| adelt | shFlex=`S(+0.035,shFlex,+0.008)`；shHAdd=`A(+0.020)`；shAbd=`+0.012` | **估計**：肩模型座標非本工具的屈曲／外展／水平內收軸 |
| pdelt | shFlex=`S(-0.025,shFlex,-0.004)`；shHAdd=`A(-0.040)`；shAbd=`+0.012` | **估計**：同上 |
| lat | shFlex=`-0.050 C((rad(170)-q.shFlex)/rad(80),0.15,1)`；shAbd=`-0.035 C(q.shAbd/rad(60),0.2,1)`；shHAdd=`A(-0.020)`；scElev=`-0.040` | **估計**：肩與胸鎖等效軸，沿用原曲線 |
| trilong | elbExt=`S(+0.020,elbFlex,+0.008)`；shFlex=`-0.020` | **估計**：肘包覆與肩座標未解析 |
| trilat | elbExt=`S(+0.022,elbFlex,+0.006)` | **估計**：肘包覆未解析 |
| bic | elbExt=`S(-0.030,elbFlex,-0.010)`；shFlex=`+0.012` | **估計**：肘包覆與肩座標未解析 |
| brach | elbExt=`S(-0.025,elbFlex,-0.006)` | **估計**：肘包覆未解析 |
| tmaj | shFlex=`-0.025`；shAbd=`-0.030` | **估計**：肩座標未解析 |
| corb | shFlex=`+0.015`；shAbd=`-0.020` | **估計**：肩座標未解析 |
| infra | shHAdd=`-0.025 max(|cos(q.shElev)|,q.haddW)` | **估計**：無肱骨內外旋軸，旋轉肌袖投影近似 |
| subsc | shHAdd=`X(+0.025)` | **估計**：同上 |
| mdelt | shAbd=`0.020+0.015 C(q.shAbd/rad(60),0,1)` | **估計**：肩座標未解析，沿用原曲線 |
| midtrap | scRet=`+0.070` | **估計**：胸鎖等效後收軸 |
| uptrap | scElev=`+0.070`；scRet=`+0.020` | **估計**：胸鎖等效上提／後收軸 |
| lowtrap | scElev=`-0.035`；scRet=`+0.050` | **估計**：下束只作下壓肌；未表示其上旋功能 |
| serr | scRet=`-0.070`；scElev=`+0.030` | **估計**：胸鎖等效前伸／上提軸 |

胸鎖等效力臂的計算規則應為 `r_axis=(p_attachment-p_SC)×u_muscle · axis`。現有 `GIRDLE` 只提供胸鎖與肩中心，中心距約 0.15 m，沒有可供數值重建的 S 模型肌束端點與胸廓包覆面；例如 0.07 m 等於假定有效力線與此半徑約 28° 的夾角。**現值未經該公式逐條重算，仍是估計**；不能把視覺用 `rig.js/ATTACH` 當成解剖端點。水平內收也缺肱骨軸向旋轉座標與可匹配的肩水平面，因此保留原來的幾何投影估計。

## 角度範圍與限制

在清單標準參數、每項 13 個行程點量得：`hipFlex` -9°～153°、`kneeFlex` 3°～146°、`ankleDorsi` -33°～45°、`shFlex` -82°～176°、`shAbd` -15°～84°、`elbFlex` 2°～150°。R 模型 hip_flexion 原座標範圍 -30°～120°；本次弦近似在 90° 後不再推算，這尤其影響深蹲、腿推與臀推。`S` 的斜率只是連續插值，並非原始模型的角度擬合。肩模型的上肢固定肩胛節律及旋轉軸與本工具不同。詳見 [結果影響](muscle-params-impact.md)。
