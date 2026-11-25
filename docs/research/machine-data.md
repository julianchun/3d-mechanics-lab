# 器械數值與幾何假設

本文件列出目前 [`src/biomech.js`](../../src/biomech.js) 使用的器械幾何、軌道角、配重比例、凸輪阻力曲線與滑輪位置，並標明來源或估計。文獻與原廠資料索引見[參考資料](references.md#器材與阻力曲線)。

目前 `MACHINES` 中的椅墊、握把、軌道與滑輪幾何，以及槓高、單槓高度和腳長等場景常數，不隨輸入身高縮放。身材離預設 175 cm 越遠，固定器材與手腳可及範圍越容易衝突。160 cm／60 kg 女性以清單預設參數掃描 63 項、每項 11 點時，蝴蝶機、反向蝴蝶機與站姿提踵機姿勢無法成立；190 cm／90 kg 男性同樣掃描則無失敗。這是目前器材幾何的適用範圍限制。

> **標示原則**：每個數據均註明來源（文獻 PMID／DOI 或原廠規格）；若因機型差異大或缺乏公開實測值，明確標註「範圍估計」或「未查證」。

---

## 1. 45° 腿推機（45° Leg Press）

### 1.1 經典文獻與常見商用機型規格

| 參數 | 數值／範圍 | 來源與備註 |
|---|---|---|
| 滑台軌道傾角 | **45°**（有效重力分量 $\sin 45^\circ \approx 0.7071$） | 標準 45° 掛片腿推機；Escamilla et al. (1998, [PubMed 9565938](https://pubmed.ncbi.nlm.nih.gov/9565938/)) 與 Escamilla et al. (2001, [PubMed 11528346](https://pubmed.ncbi.nlm.nih.gov/11528346/)) 採用 Body Masters, Inc.（Rayne, LA）設備 |
| 空滑台重量（Carriage / Sled Weight） | 約 34–57 kg（75–125+ lb）；重型商用款（如 Hammer Strength Linear Leg Press）約 53–60 kg（**無出處的假設**） | **無出處的假設**（未查核單一原廠規格表或同儕審查實測值，僅為常見商用範圍估計；各廠牌結構差異大，實際使用應查該型號手冊） |
| 滑台導軌摩擦係數 $\mu$ | 線性培林／滾輪動態值約 0.05–0.15（**無出處的假設**） | **無出處的假設**；**Escamilla 2001 全文內使用之 Body Masters 特定機台實測摩擦係數未查證**（需查原紙本附錄）。注意：摩擦力方向永遠反於運動方向——向心推起時增加阻力 $(mg(\sin\theta + \mu\cos\theta))$，離心下放時減少阻力 $(mg(\sin\theta - \mu\cos\theta))$ |
| 椅背與座椅夾角 | 常見可調範圍：靠背與水平約 25°–45°（即離垂直約 45°–65°）（**無出處的假設**） | **無出處的假設**（未查單一原廠規格書）；目前模型 `seat` 參數為離垂直 35°–65°（預設 50°） |
| 腳位與肌電／關節變化（Escamilla 2001 與 Da Silva 2008 分別支持） | • **寬站距＋高腳位（WS-LPH）**：膕繩肌 EMG 高於窄站距＋高腳位（NS-LPH）；LPH 與 LPL 之間膝關節受力無顯著差異（Escamilla 2001，**未量臀大肌**）<br>• **高腳位（LPH）vs 低腳位（LPL）**：高腳位之**臀大肌** EMG 顯著高於低腳位；低腳位於高負荷（80% 1RM）下**股四頭肌（股直肌、股外側肌）**高於高腳位（Da Silva 2008） | Escamilla et al. (2001, n=10 男性, [PubMed 11528346](https://pubmed.ncbi.nlm.nih.gov/11528346/)) 只支持「寬站距＋高腳位 → 膕繩肌較多」；臀大肌與低腳位股四頭肌差異由 Da Silva et al. (2008, n=14 女性, [PubMed 18545207](https://pubmed.ncbi.nlm.nih.gov/18545207/)) 支持 |

### 1.2 目前模型
- 現行 `src/biomech.js` 採 45° 軌道且忽略導軌摩擦（僅算 $\sin 45^\circ$），準靜態下屬合理一階近似；若未來需區分向心／離心差異，可加入 $\pm\mu\cos 45^\circ$（$\mu$ 數值屬無出處的假設，需以實機測力校正）。

---

## 2. 史密斯機（Smith Machine）

### 2.1 軌道角度與配重規格

| 類型／代表機型 | 軌道角度 | 空槓起始阻力（Starting Resistance） | 配重系統 | 來源 |
|---|---|---|---|---|
| **傾斜軌道商用經典**：Hammer Strength Smith Machine（Life Fitness） | **7° 傾斜**（模擬自由重量推／蹲自然弧線） | **30 lb（13.6 kg）** | 無配重或結構平衡標稱起始 30 lb | [Hammer Strength 官方規格](https://www.lifefitness.com/en-gb/catalog/strength-training/benches/smith-machine) |
| **有配重平衡（Counterbalanced）商用款**（如部分 Life Fitness Signature / Cybex / Technogym 款） | 常見 **0°（垂直）或 7°–12°** | **約 15–25 lb（6.8–11.3 kg）**（部分全平衡款標稱可低至 ~15 lb） | 內部滑輪配重塊抵銷部分槓重與滑套重 | 商業健身器材常見規格（各型號差異大，使用特定型號時應查該型號手冊） |
| **無配重垂直軌道款**（力量訓練／健力房常見） | **0°（完全垂直）** | **約 35–45 lb（16–20.4 kg）**（含線性軸承滑座重量） | 無配重 | 商業器材常見規格 |

### 2.2 力學意義與模型對照
- 傾斜 7° 的史密斯機在**面向前或背向前**使用時，斜軌方向相反（往後上方 vs 往前上方），會改變身體站位與滑軌法向反作用力方向。
- 現行 `src/biomech.js` 的 `smithPose` 預設 **0° 垂直滑軌**，亦可選 ±7°；滑軌承受法向反作用力。示範負重與軌道位置仍是假設。

---

## 3. 滑輪機（下拉、坐姿划船、三頭下壓）

### 3.1 商用滑輪比（Pulley Ratio）與滑輪高度

| 動作／設備類型 | 常見滑輪比（配重：實感阻力） | 實際感受到的力 | 典型機架／滑輪高度 | 來源 |
|---|---|---|---|---|
| **專用滑輪下拉機（Lat Pulldown）**<br>Hammer Strength HD Elite Dual Pulldown/Row (`HDU-DPR`)<br>Technogym Selection Lat Machine | **1:1**（HDU-DPR 的配重與手感比） | HDU-DPR 選 100 kg 約為手感 100 kg（忽略摩擦） | HDU-DPR：96"（244 cm）；Technogym Selection：90"（228 cm） | [Hammer Strength HDU-DPR 官方規格](https://www.lifefitness.com/en-eu/catalog/strength-training/cable-machines-functional-trainers/hd-elite-dual-pulldown-row)；[Technogym Selection 官方規格](https://www.technogym.com/de-DE/product/selection-lat-machine-med_C91200-ANVK.html) |
| **專用坐姿低拉划船機（Seated Low Row）**<br>Life Fitness PWR Play 等 | **1:1 為模型預設** | 選 100 kg 約為手感 100 kg（忽略摩擦） | 低滑輪出繩口約 **35–45 cm**，與坐墊同高或略低，為未查證的典型設計估算 | 本模型的機型與尺寸估計；單一原廠出繩中心尺寸未查證 |
| **多功能可調滑輪柱／大飛鳥（Functional Trainer / Cable Crossover）**（常用於三頭下壓） | **2:1**（所引機型） | 2:1 時選 50 kg 約為手感 25 kg | Life Fitness 滑車高度 **7"–76"（17.8–193.0 cm）**；模型機架頂部約 210–240 cm 為估計 | [Life Fitness Adjustable Cable Crossover 官方規格](https://www.lifefitness.com/en-us/catalog/strength-training/cable-machines-functional-trainers/adjustable-cable-crossover)；[PWR Play 官方手冊](https://support.lifefitness.com/hc/en-us/articles/30762202977431-Life-Fitness-PWR-Play-Assembly-Manual) |

### 3.2 與現行模型對照
- 現行 `src/biomech.js`：
  - `pulldown`：滑輪高度 `y = 2.35 m`（位於商用 216–244 cm 範圍內，合理）。
  - `cablerow`：滑輪高度 `y = 0.42 m`、距骨盆中心 `z = 1.0 m`（合理，對應坐墊高 0.47 m）。
  - `pushdown`：滑輪高度 `y = 2.10 m`（對應可調滑輪高檔或高拉柱，合理）。
- 注意：現行模型以配重片公斤數除以選定滑輪比求手感鋼索張力；下拉、划船、三頭下壓及滑輪夾胸均可選滑輪比。機架尺寸仍是教學示意值。

---

## 4. 腿伸機與腿彎舉：人體角度－力矩曲線與凸輪實測資料

### 4.1 人體膝伸（股四頭肌）等長／等速角度－力矩關係

**角度定義**：$0^\circ$ = 膝關節完全伸直；角度越大 = 膝屈曲越深（例如 $90^\circ$ 為坐姿垂腿）。

- **來源**：
  1. Knapik JJ, Wright JE, Mawdsley RH, Braun J. (1983). *Isometric, isotonic, and isokinetic torque variations in four muscle groups through a range of joint motion.* Phys Ther, 63(6):938–947. [PubMed 6856681](https://pubmed.ncbi.nlm.nih.gov/6856681/) / [DOI](https://doi.org/10.1093/ptj/63.6.938)
  2. Kulig K, Andrews JG, Hay JG. (1984). *Human strength curves.* Exerc Sport Sci Rev, 12:417–466. [PubMed 6376139](https://pubmed.ncbi.nlm.nih.gov/6376139/)
  3. Marginson V, Eston R. (2001). *The relationship between torque and joint angle during knee extension in boys and men.* J Sports Sci, 19(11):875–880. [PubMed 11695509](https://pubmed.ncbi.nlm.nih.gov/11695509/) / [DOI](https://doi.org/10.1080/026404101753113822)
  4. Folland JP, Morris B. (2008). *Variable-cam resistance training machines: do they match the angle-torque relationship in humans?* J Sports Sci, 26(2):163–169. [PubMed 17885926](https://pubmed.ncbi.nlm.nih.gov/17885926/) / [DOI](https://doi.org/10.1080/02640410701370663)

#### 人體膝伸（Quadriceps）角度 → 相對力矩表（% 峰值力矩）

| 膝屈曲角度 | 相對力矩（% Peak Torque） | 數據出處與說明 |
|---|---|---|
| **100°–105°**（約 1.75 rad） | 約 **65%–75%**（依 Folland & Morris 2008，從 100° 伸至 80° 上升約 +40%） | Folland & Morris (2008)；Marginson & Eston (2001) 於 100° 已過峰值開始下降 |
| **90°** | **約 80%–95%** | 綜合 Knapik (1983)、Marginson & Eston (2001) |
| **75°–80°**（約 1.3–1.4 rad） | **100%（峰值區間）** | Marginson & Eston (2001) 成年男性峰值落於 ~80°；Folland & Morris (2008) 動態峰值落於 60°–80° |
| **60°**（約 1.05 rad） | **約 85%–95%**（Marginson & Eston 2001 成年男性約 **93.6%**） | Marginson & Eston (2001)；Folland & Morris (2008) |
| **40°–45°** | **約 60%–70%**（Marginson & Eston 2001 於 40° 約 **63.6%**） | Marginson & Eston (2001) |
| **20°–30°**（約 0.35 rad） | **約 30%–45%**（Marginson & Eston 2001 於 20° 約 **35.2%**；Folland & Morris 2008 從 60° 至 20° 下降 **-60%**） | Marginson & Eston (2001)；Folland & Morris (2008) |

> **曲線特徵**：人體膝伸力量曲線呈明顯的**倒 U 型（上升－下降曲線）**，在深屈約 100° 處較弱，於 **60°–80° 達最高峰值**，接著在接近完全伸直（20°–0°）急劇下降超過一半。

---

### 4.2 人體膝屈（膕繩肌）等長／等速角度－力矩關係

- **來源**：
  1. Knapik JJ et al. (1983). [PubMed 6856681](https://pubmed.ncbi.nlm.nih.gov/6856681/)
  2. Kulig K et al. (1984). [PubMed 6376139](https://pubmed.ncbi.nlm.nih.gov/6376139/)
  3. Onishi H, Yagi R, Oyama M, Akasaka K, Ihashi K, Hoshimiya N. (2002). *EMG-angle relationship of the hamstring muscles during maximum knee flexion.* J Electromyogr Kinesiol, 12(5):399–406. [PubMed 12223173](https://pubmed.ncbi.nlm.nih.gov/12223173/) / [DOI](https://doi.org/10.1016/s1050-6411%2802%2900033-0)
  4. Beyer EB, Lunden JB, Russell Giveans M. (2019). *Medial and lateral hamstrings response and force production at varying degrees of knee flexion and tibial rotation in healthy individuals.* Int J Sports Phys Ther, 14(3):376–383. [PubMed 31681497](https://pubmed.ncbi.nlm.nih.gov/31681497/) / [DOI](https://doi.org/10.26603/ijspt20190376)

#### 人體膝屈（Hamstrings）角度 → 相對力矩趨勢表

| 膝屈曲角度 | 相對力矩趨勢（% Peak Torque） | 說明 |
|---|---|---|
| **15°–30°**（接近伸直、拉長端） | **100%（峰值區間）** | 膕繩肌處於較長肌肉長度且力臂有利，等長／等速屈膝力矩最大（Kulig 1984；Onishi 2002；Beyer 2019） |
| **45°–60°**（中段） | **中段遞減（約 70%–85%，範圍估計）** | 隨膝屈曲增加、膕繩肌縮短，力矩單調遞減（精確百分比受髖角度——坐姿 vs 俯臥——顯著影響，未查得跨姿態單一標準值） |
| **75°–90°**（深屈、縮短端） | **顯著最低（約 45%–65%，範圍估計）** | 尤其在**俯臥（髖伸展）**時進入主動不足（active insufficiency），末端力矩掉落更劇烈；**坐姿（髖屈曲 ~90°）**能保留較長肌纖維與較高絕對力矩 |

> **曲線特徵**：人體膝屈力量曲線呈**遞減型（Descending curve）**——從拉長端（15°–30°）往縮短端（90°+）單調下降。

---

### 4.3 商用可變凸輪（Variable Cam）實測阻力曲線

#### (A) Folland & Morris (2008) 實測 8 台商用可變凸輪腿伸機
- **來源**：Folland JP, Morris B. (2008). *Variable-cam resistance training machines: do they match the angle-torque relationship in humans?* J Sports Sci, 26(2):163–169. [PubMed 17885926](https://pubmed.ncbi.nlm.nih.gov/17885926/) / [DOI](https://doi.org/10.1080/02640410701370663)
- **樣本**：6 家廠商共 **8 台商用可變凸輪腿伸機**。
- **實測量化結果**（相較人體動態膝伸曲線：上升段 1.75→1.40 rad 為 **+40%**；下降段 1.05→0.35 rad 為 **-60%**）：
  - **商用凸輪上升段（100°→80° 屈曲）**：阻力力矩僅變化 **+2.5% 至 +22.2%**（遠平緩於人體 +40%）。
  - **商用凸輪下降段（60°→20° 屈曲）**：阻力力矩變化範圍為 **+37.6%（反而上升）至 -20.5%（僅微幅下降）**，完全未能重現人體在近伸直端 -60% 的大幅力矩滑落。
- **結論**：大多數商用可變凸輪腿伸機的實際阻力曲線偏平坦，甚至在伸直端阻力偏高（類似本模型 `flat` 或 `asc`），這也是為何腿伸機在最後 30° 伸直時常感到特別吃力。

#### (B) Nautilus 經典凸輪分析（Harman 1983；Cabell & Zebas 1999）
- **來源**：
  - Harman EA. (1983). *Resistive torque analysis of 5 Nautilus exercise machines.* Med Sci Sports Exerc, 15(5):113.
  - Cabell L, Zebas CJ. (1999). *Resistive torque validation of the Nautilus Multi-Biceps machine.* J Strength Cond Res, 13(1):20–23. [DOI](https://doi.org/10.1519/00124278-199902000-00004)（1999 年 JSCR 尚未收錄於 PubMed）
- **重點**：Arthur Jones 的 Nautilus 凸輪原始設計理念即為「改變凸輪半徑（力臂）以匹配人體關節強度曲線」（膝伸設計目標為中段高、末端低），但實測（Harman 1983；Folland & Morris 2008）發現早期與商用多數凸輪在行程兩端仍明顯偏離人體真實曲線。

#### (C) VMAC®（Variable Moment Arm Cam）新型可調凸輪驗證（2026）
- **來源**：
  1. da Costa-Machado RA, Marques DL, Marson RA, Louro H, Marinho DA, Conceição A. (2026). *Validation of a Novel Variable-Cam System: Electromyographic and Kinetic Analysis.* Applied Sciences, 16(6):2633. [DOI](https://doi.org/10.3390/app16062633)
  2. da Costa-Machado RA et al. (2026). *Validation of constant and progressive CAM configurations for torque modulation.* Mechanics Based Design of Structures and Machines. [DOI](https://doi.org/10.1080/15397734.2026.2669990)
- **重點**：透過可調半徑插銷調整凸輪力臂（VMAC®），在腿伸 100°–0° 範圍內與等速肌力儀實測比對，驗證能輸出貼近人體倒 U 型曲線的阻力力矩（於 60°–70° 膝屈處與人體峰值最為吻合）。

#### (D) 建議用於本模型之「擬合人體強度曲線」凸輪參數表（供後續擴充 `CAMS` 參考）
現行 `src/biomech.js` 的 `CAMS` 提供 `gravity`（$\propto$ 小腿水平分量）、`flat`（常數 0.9）、`asc`（0.6→1.2）、`desc`（1.2→0.6）。由上述實測可知：
- **商用平均腿伸機（Folland & Morris 2008）**：接近 `flat` 至微幅 `asc`（伸直端相對人體能力偏重）。
- **理想人體匹配腿伸凸輪（倒 U 型）**：峰值落在膝屈 ~70°（`x ≈ 0.3`），伸直端（膝屈 15°–20°）需降至峰值之 ~40%。
- **理想人體匹配腿彎舉凸輪（遞減型）**：接近 `desc`（伸直拉長端重、屈曲縮短端輕，約 1.0 → 0.55）。

---

## 5. 坐姿胸推機（Seated Chest Press Machine）

### 5.1 常見設計架構與握把軌跡

| 設計類型 | 代表機型 | 握把軌跡 | 力學與肌肉意義 |
|---|---|---|---|
| **固定直線軌跡（Linear Path）** | 傳統插銷式胸推機（部分 Life Fitness / Cybex 舊款、史密斯式胸推） | 雙手間距固定，沿單一水平或微上斜直線前後移動 | 穩定度高、利於最大水平推力輸出；但終點鎖死時雙手無法向中線收攏，限制胸大肌的水平內收完整行程 |
| **單軸樞紐弧線（Arc / Lever Path）** | 單一頂部或底部轉軸擺臂胸推機 | 沿圓弧軌跡前進（推起時略微向上或向下偏移） | 推力方向隨行程微幅改變，且常伴隨槓桿重力角度造成阻力曲線變化（起點重或終點重） |
| **獨立內聚弧線（Converging Iso-Lateral Arc）** | Hammer Strength Iso-Lateral Chest Press、Life Fitness Insignia Converging Chest Press | 左右臂獨立運作，推起時雙手向身體中線**內聚（converge）** | 貼合盂肱關節自然水平內收動作，頂點時仍維持胸大肌收縮張力，並降低雙側肌力不平衡代償 |

- **參考說明**：針對「內聚弧線 vs 直線軌跡」胸推機的同儕審查 EMG 直接量化比較文獻極為稀缺（**未查得直接比較此二軌跡之 PubMed 實測論文**），上表屬機構運動學與商用設計規範整理；相關穩定度對照可參考 Schick et al. (2010, [PubMed 20093960](https://pubmed.ncbi.nlm.nih.gov/20093960/)) 與 Saeterbakken et al. (2011, [PubMed 21225489](https://pubmed.ncbi.nlm.nih.gov/21225489/))。
- **現行模型對應**：`src/biomech.js` 的 `chestPressPose` 目前以旋轉 90° 的臥推幾何搭配固定方向推力 `d = pose.f` 近似**直線軌跡胸推機**；若未來要模擬內聚弧線，可讓手部 X 座標 `g` 隨進度 `e` 減小（推直時變窄）。

---

## 6. 蝴蝶機（Pec Deck / Pectoral Fly）與雙側滑輪夾胸（Cable Crossover）

### 6.1 商用機構與規格整理

| 設備類型 | 機構與傳動特徵 | 參數／範圍 | 來源與備註 |
|---|---|---|---|
| **蝴蝶機（握把式／前臂墊式）** | 雙側獨立機械臂繞位於肩關節正上方附近的**垂直軸**轉動；阻力經凸輪傳動，方向恆為圓弧切線（頂點夾緊時仍維持向外的水平張力） | 傳動多為 1:1 凸輪直連；機械臂半徑（握把 54 cm／前臂墊 29 cm）、等效凸輪基準力臂（22 cm）與溫和鐘型凸輪曲線表皆屬**無出處假設** | 商用雙用蝴蝶機／經典前臂墊式蝴蝶機結構；**未查得單一商用機台公開實測凸輪阻力曲線表** |
| **雙側可調滑輪柱／大飛鳥（Cable Crossover / Dual Adjustable Pulley）** | 兩手各握獨立 D 型把手、各連一條獨立鋼索（無剛體握把互推）；滑輪可於低／中／高檔調整 | 商用主流滑輪比為 **2:1**（部分四線系統為 4:1）；滑輪高度範圍 **17.8–193.0 cm**（7"–76"），機架高約 **210–240 cm**；柱距 260 cm 與單側 18 kg 配重為假設 | Life Fitness PWR Play / Signature Cable Crossover 規格表（見 §3.1）；站位距離與配重屬模型假設 |

### 6.2 模型對應
- `src/biomech.js` 的 `pecDeckPose` 與 `MACHINES.pecdeck` 實作坐姿垂直轉軸圓弧阻力（`padLoads` 搭配切線方向），提供握把式（`style: 'handle'`）與前臂墊式（`style: 'pad'`）。
- `src/biomech.js` 的 `cableFlyPose` 與 `MACHINES.cablefly` 實作站姿雙側獨立滑輪（`pose.dualCable = true`，`cableLoads` 不套用 `minimizeAxialMoment`），提供高位（192 cm）、中位（134 cm）、低位（85 cm）三種滑輪高度。

---

## 7. 其他器械與羅馬椅（幾何假設未查證）

下表尺寸、配重與凸輪值只供教學示意，未取得單一商用機型的原廠尺寸、握把力曲線或實測校正；程式數值集中於 `MACHINES`。所列研究僅支持動作與肌肉作用，不視為器械尺寸的出處。

| 動作 | 模型尺寸與負重假設 | 支撐與力線 |
|---|---|---|
| 反向蝴蝶機 | 握把半徑 52 cm、凸輪等效力臂 22 cm、配重 40 kg、座高 55 cm | 胸墊承受握把水平合力；握把阻力沿旋轉臂切線。肩力臂可間接參考 [Ackland 2008](https://pubmed.ncbi.nlm.nih.gov/18691376/)，未查證本機型凸輪。 |
| 45° 背伸展 | 髖高 92 cm、腳踝墊在後方 50 cm、胸前槓片 10 kg | 大腿墊向上、腳踝墊向下；兩接觸力以全身力矩平衡求解。[Andersen 2021](https://pubmed.ncbi.nlm.nih.gov/33948095/) 直接比較羅馬椅肌電，未量墊高效果。 |
| 哈克深蹲機 | 滑軌 45°、長 185 cm、半寬 49 cm、腳板 12°、滑台加掛片 80 kg | 背與肩墊沿滑軌，腳板壓力中心加滑軌法向反力平衡；不含摩擦。45° 腿推與深蹲可參考 [Escamilla 1998](https://pubmed.ncbi.nlm.nih.gov/9565938/)，並非哈克機規格。 |
| 器械肩推 | 握把行程 47 cm、頂部轉軸高 183 cm、座高 55 cm、配重 40 kg、預設軌跡前傾 8° | 固定軌跡給手部向下阻力，座墊與椅背承重。[Saeterbakken 2013](https://pubmed.ncbi.nlm.nih.gov/23096062/) 比較肩推姿勢與負重型式，未量此機台。 |
| 站姿／坐姿提踵 | 前腳掌台階高 13 cm、站姿肩墊 60 kg、坐姿膝墊 45 kg、腳掌角度約背屈 15° 至蹠屈 20° | 前腳掌支撐踝力矩；坐姿軀幹由座墊承重。[Kinoshita 2023](https://pubmed.ncbi.nlm.nih.gov/38156065/) 比較 12 週肌肥大，並非即時肌電負重校正。 |
| 臀外展／內收機 | 膝墊槓桿 35 cm、凸輪等效力臂 22 cm、配重 35 kg、座高 55 cm | 膝側墊沿左右方向給力，在水平面繞髖轉動。[de Almeida Paz 2022](https://pubmed.ncbi.nlm.nih.gov/35500965/) 直接研究外展機肌電，未量幾何與內收機。 |

---

## 8. 啞鈴器材與預設負重（未查證單一商用規格）

啞鈴沒有剛體橫槓連接雙手，模型採共用負重函式 `dumbbellLoads`：每隻手各自承受自己那顆啞鈴的垂直重力（`barAxial = false`，不套用 `minimizeAxialMoment`），高腳杯深蹲則由雙手平分單顆啞鈴重量。以下尺寸與預設重量集中於 `MACHINES.dumbbell`，皆屬教學示意假設：

| 項目 | 模型尺寸與負重假設 | 備註 |
|---|---|---|
| 啞鈴共用尺寸 | 握把內距 13 cm、握把直徑 32 mm（半徑 1.6 cm）；兩端八角片半徑 5.5–11.5 cm、寬度 3.2–8.5 cm 隨重量線性縮放 | 無單一原廠出處假設，依常見商用六角／包膠啞鈴外觀估計 |
| 啞鈴臥推（平板／上斜 30°） | 預設每顆 22 kg（雙手 44 kg，略輕於槓鈴臥推 60 kg） | 下放時手可比槓鈴更外、更深並維持前臂接近垂直，頂點向肩上方微內聚（間距 44 cm） |
| 坐姿啞鈴肩推 | 預設每顆 14 kg（雙手 28 kg）；椅座高 50 cm、椅背後傾 8°（82°） | 手肘預設於肩胛平面（前偏 30°），下放至耳側／肩旁、頂點微內聚（間距 42 cm） |
| 啞鈴側平舉 | 預設每顆 8 kg | 站姿重心平衡（`standingHands` 且 `barAxial = false`），自體側 14° 沿肩胛或冠狀面平舉至 90° |
| 啞鈴彎舉／錘式彎舉 | 預設每顆 12 kg（雙手 24 kg） | 站姿雙手垂於體側（上臂外開 8° 避開髖部）；反握／錘式沿用既有握法偏好係數（1.6×／1.0×） |
| 俯身啞鈴反向飛鳥 | 預設每顆 6 kg；預設俯身 65°、肘微彎 20° | 站姿俯身重心平衡，雙手自胸下方 8° 水平外展至 86° |
| 高腳杯深蹲 | 預設單顆 20 kg | 單顆啞鈴垂直捧於胸前（距軀幹軸 22 cm、沿軀幹 40 cm），沿用深蹲前側負重姿勢求解（預設偏膝主導 `dom = 0.25`，屬無單一實測出處之預設假設） |
