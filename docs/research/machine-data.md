# 器械數值與幾何假設

本文件列出目前 [`src/biomech.js`](../../src/biomech.js) 使用的器械幾何、軌道角、配重比例、凸輪阻力曲線與滑輪位置，並標明來源或估計。文獻與原廠資料索引見[參考資料](references.md#器材與阻力曲線)。

目前蝴蝶機、反向蝴蝶機、胸推、肩推、站姿提踵與羅馬椅的座椅／靠墊／握把示範位置會按身材調整；引體懸垂的肩高與腿姿勢亦依骨長求解。滑軌角、滑輪位置、單槓高度和雙槓握點維持固定。可調部件、範圍與出處狀態見[第 9 節](#9-身材適配與可調範圍)。

> **標示原則**：每個數據均註明來源（文獻 PMID／DOI 或原廠規格）；若因機型差異大或缺乏公開實測值，明確標註「範圍估計」或「未查證」。

## 查證總表（2026-11-27）

表中「已查證」只適用於列明的機型與參數；機架**總高不等於出繩中心或轉軸高度**。所有未查證尺寸維持估計值，不把其他機型的外形尺寸轉成握把坐標。

| 項目 | 已查證並採用或核對 | 未查證、維持估計 |
|---|---|---|
| 專用下拉／坐姿划船 | [HDU-DPR](https://www.lifefitness.com/en-eu/catalog/strength-training/cable-machines-functional-trainers/hd-elite-dual-pulldown-row) 與 [PWR Play](https://www.lifefitness.com/en-us/catalog/strength-training/cable-machines-functional-trainers/pwr-play) 的 1:1 滑輪比；HDU-DPR 總高 244 cm | 下拉出繩高 235 cm；划船出繩高 42 cm、水平位置 100 cm；均無原廠中心坐標 |
| 三頭下壓／滑輪夾胸 | [Life Fitness LCM-CC](https://www.lifefitness.com/en-eu/catalog/strength-training/cable-machines-functional-trainers/adjustable-cable-crossover)：2:1、滑車 17.8–193.0 cm、總高 239 cm；模型高檔由 210 改 192 cm，夾胸機架高由 215 改 239 cm | 精確出繩中心、柱中心距、站位、短桿尺寸、示範配重；模型中位 134 cm／低位 85 cm 僅為範圍內示例 |
| 腿推滑台與軌道 | [Titanium Strength GS-45LP](https://www.titaniumstrength.co.uk/productpdf/download/file/id/1402/name/45-Degree_Leg_Press.pdf/)：45°、**空滑台實體質量 50 kg**；模型由 45 改 50 kg | 摩擦、椅背絕對角度及掛片示範重量；其他廠牌標的「起始阻力」不能當實體滑台質量 |
| 史密斯滑軌與起始阻力 | [Hammer Strength HSSMV](https://www.lifefitness.com/de-de/produkte/strength-training/stationen-mit-gewichtsscheiben/plate-loaded-vertical-smith-machine)：垂直、13.6 kg；[HSSM](https://www.lifefitness.com/en-gb/catalog/strength-training/benches/smith-machine)：7°、13.6 kg | 摩擦、槓的實體質量、滑軌相對人體站位、示範掛片量；13.6 kg 為有效起始阻力 |
| 坐姿胸推 | [Life Fitness Axiom OP-CP](https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/axiom-series-chest-press) 證實可調座高 | 模型 43–68 cm 座高、轉軸 172 cm、握把路徑／半徑、靠背位置；無同坐標定義的原廠刻度 |
| 器械肩推 | [Precor Vitality VSL024BP](https://www.precor.com/en-US/strength/selectorized/vitality) 說明可調起始位置；[Life Fitness Iso-Lateral 手冊](https://resources.lifefitness.com/hub/life-fitness/en-US/1000419-0001-xd_32ce9968be620066-6b5ac64-1817a3e5ec1--7f3d.ditamap?onepage=true) 說明座椅按握把／胸部對齊 | 模型 47 cm 行程、183 cm 轉軸與 43–68 cm 座高數值，沒有同機型量測 |
| 蝴蝶／反向蝴蝶 | [Precor VSL015BP](https://www.precor.com/en-US/products/VSL015BP) 證實雙用機的可調起始位置與自動適臂機構 | 握把半徑 54／52 cm、前臂墊半徑 29 cm、轉軸位置、42–62 cm 可及範圍、43–68 cm 座高及凸輪力臂，均未查到尺寸刻度 |
| 腿伸／腿彎舉凸輪 | [Folland 與 Morris 2008](https://pubmed.ncbi.nlm.nih.gov/17885926/) 實測 8 台腿伸機；[Pizzimenti 1992](https://pubmed.ncbi.nlm.nih.gov/1322768/) 實測 Nautilus 俯臥腿彎舉的阻力趨勢 | 未取得可一一對應目前預設機型的逐角度實測力矩表；保留現有示範曲線，不以人體力量曲線代替器械曲線 |
| 啞鈴握把 | [REP Hex KG](https://repfitness.com/products/hex-dumbbells-kg) 7.5–22.5 kg：長 13.2 cm、直徑 34 mm；模型由 13／32 mm 修正 | 片頭尺寸、示範重量；2.5–5 kg 的 28 mm 細握把未建模 |
| 引體握點與踏台 | [Life Fitness PWR Play](https://www.lifefitness.com/en-us/catalog/strength-training/cable-machines-functional-trainers/pwr-play) 證實輔助引體機有可折疊踏台 | 模型固定 235 cm 握點、膝墊位置及踏台高度；懸垂肩高與彎腿距離依骨長幾何求解，踏台不參與動作力學 |

---

## 1. 45° 腿推機（45° Leg Press）

### 1.1 經典文獻與常見商用機型規格

| 參數 | 數值／範圍 | 來源與備註 |
|---|---|---|
| 滑台軌道傾角 | **45°**（有效重力分量 $\sin 45^\circ \approx 0.7071$） | 預設機型 [Titanium Strength Genesis GS-45LP 官方規格](https://www.titaniumstrength.co.uk/productpdf/download/file/id/1402/name/45-Degree_Leg_Press.pdf/) 明示 45°；Escamilla et al. (1998, [PubMed 9565938](https://pubmed.ncbi.nlm.nih.gov/9565938/)) 與 Escamilla et al. (2001, [PubMed 11528346](https://pubmed.ncbi.nlm.nih.gov/11528346/)) 使用不同的 Body Masters 設備 |
| 空滑台實體質量（Carriage / Sled Mass） | **50 kg（預設）** | [Titanium Strength Genesis GS-45LP 官方規格](https://www.titaniumstrength.co.uk/productpdf/download/file/id/1402/name/45-Degree_Leg_Press.pdf/) 明列「Sled Weight (unloaded): 50 kg」。選此機型因其同時公布 45° 與**實體滑台重量**；模型掛片 1.8× 體重仍為示例。20–65 kg 滑桿範圍為**未查證的示範界線**，不能推及其他機型。[Hammer Strength HSLLP](https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/plate-loaded-linear-leg-press) 的 53 kg 是「Starting Resistance」，未說明是否為實體滑台質量，不與本欄混用。 |
| 滑台導軌摩擦係數 $\mu$ | 線性培林／滾輪動態值約 0.05–0.15（**無出處的假設**） | **無出處的假設**；**Escamilla 2001 全文內使用之 Body Masters 特定機台實測摩擦係數未查證**（需查原紙本附錄）。注意：摩擦力方向永遠反於運動方向——向心推起時增加阻力 $(mg(\sin\theta + \mu\cos\theta))$，離心下放時減少阻力 $(mg(\sin\theta - \mu\cos\theta))$ |
| 椅背與座椅夾角 | 常見可調範圍：靠背與水平約 25°–45°（即離垂直約 45°–65°）（**無出處的假設**） | **無出處的假設**（未查單一原廠規格書）；目前模型 `seat` 參數為離垂直 35°–65°（預設 50°） |
| 腳位與肌電／關節變化（Escamilla 2001 與 Da Silva 2008 分別支持） | • **寬站距＋高腳位（WS-LPH）**：膕繩肌 EMG 高於窄站距＋高腳位（NS-LPH）；LPH 與 LPL 之間膝關節受力無顯著差異（Escamilla 2001，**未量臀大肌**）<br>• **高腳位（LPH）vs 低腳位（LPL）**：高腳位之**臀大肌** EMG 顯著高於低腳位；低腳位於高負荷（80% 1RM）下**股四頭肌（股直肌、股外側肌）**高於高腳位（Da Silva 2008） | Escamilla et al. (2001, n=10 男性, [PubMed 11528346](https://pubmed.ncbi.nlm.nih.gov/11528346/)) 只支持「寬站距＋高腳位 → 膕繩肌較多」；臀大肌與低腳位股四頭肌差異由 Da Silva et al. (2008, n=14 女性, [PubMed 18545207](https://pubmed.ncbi.nlm.nih.gov/18545207/)) 支持 |

### 1.2 目前模型
- 現行 `src/biomech.js` 採 GS-45LP 的 45° 軌道與 50 kg 空滑台；預設 75 kg 身材的 135 kg 示範掛片加滑台共 185 kg，沿軌道準靜態重力約 1,283 N（前版本 180 kg、約 1,249 N）。忽略導軌摩擦；若未來需區分向心／離心差異，可加入 $\pm\mu\cos 45^\circ$（$\mu$ 數值屬無出處的假設，需以實機測力校正）。

---

## 2. 史密斯機（Smith Machine）

### 2.1 軌道角度與配重規格

| 類型／代表機型 | 軌道角度 | 空槓起始阻力（Starting Resistance） | 配重系統 | 來源 |
|---|---|---|---|---|
| **垂直軌道預設機型**：Hammer Strength Plate Loaded Vertical Smith Machine `HSSMV` | **0° 垂直** | **30 lb（13.6 kg）** | 官方列的是起始阻力，未說明實體槓質量或配重平衡結構 | [HSSMV 原廠規格](https://www.lifefitness.com/de-de/produkte/strength-training/stationen-mit-gewichtsscheiben/plate-loaded-vertical-smith-machine) |
| **可選傾斜軌道**：Hammer Strength Smith Machine `HSSM` | **7° 傾斜** | **30 lb（13.6 kg）** | 同樣是標稱起始阻力；反向站位的 −7° 是模型座標轉向 | [HSSM 原廠規格](https://www.lifefitness.com/en-gb/catalog/strength-training/benches/smith-machine) |
| 其他配重平衡與無配重款 | **未查證** | **未查證** | 機型間差異不能用概括範圍代替單一規格 | 未選作預設 |

### 2.2 力學意義與模型對照
- 傾斜 7° 的史密斯機在**面向前或背向前**使用時，斜軌方向相反（往後上方 vs 往前上方），會改變身體站位與滑軌法向反作用力方向。
- 現行 `src/biomech.js` 的 `smithPose` 預設 **HSSMV 的 0° 垂直滑軌**，亦可選 HSSM 的 ±7°；滑軌承受法向反作用力。起始阻力固定 13.6 kg，示範掛片以體重縮放：75 kg 身材掛片 53.9 kg，總 67.5 kg；掛片選擇、摩擦與軌道空間位置仍是假設。起始阻力是使用者感受的有效量，不宣稱槓本身實體質量。

---

## 3. 滑輪機（下拉、坐姿划船、三頭下壓）

### 3.1 商用滑輪比（Pulley Ratio）與滑輪高度

| 動作／設備類型 | 常見滑輪比（配重：實感阻力） | 實際感受到的力 | 典型機架／滑輪高度 | 來源 |
|---|---|---|---|---|
| **專用滑輪下拉機（Lat Pulldown）**<br>Hammer Strength HD Elite Pulldown/Row `HDU-DPR` | **1:1** | 選 100 kg 約為手感 100 kg（忽略摩擦） | 機架總高 **244 cm**；出繩中心精確高度**未查證**，模型 235 cm 是估計 | [HDU-DPR 原廠規格](https://www.lifefitness.com/en-eu/catalog/strength-training/cable-machines-functional-trainers/hd-elite-dual-pulldown-row) 同列 1:1 與總高；[Life Fitness PWR Play](https://www.lifefitness.com/en-us/catalog/strength-training/cable-machines-functional-trainers/pwr-play) 亦列專用下拉 1:1 |
| **專用坐姿低拉划船機（Seated Low Row）**<br>Life Fitness PWR Play Row | **1:1** | 選 100 kg 約為手感 100 kg（忽略摩擦） | 模型低出繩中心 **42 cm**、距骨盆前方 100 cm，均**未查證** | [Life Fitness PWR Play 官方頁](https://www.lifefitness.com/en-us/catalog/strength-training/cable-machines-functional-trainers/pwr-play) 列專用 Row 1:1，未提供出繩點坐標 |
| **雙側可調滑輪柱／大飛鳥**<br>Life Fitness Signature Adjustable Cable Crossover `LCM-CC`；三頭下壓示範用單側高檔並接短桿 | **2:1** | 2:1 時選 50 kg 約為手感 25 kg | 官方滑車可調 **7"–76"（17.8–193.0 cm）**、機架總高 **239 cm**；模型高檔 192 cm 在調整區間內，精確出繩中心與滑車標記的偏差**未查證** | [LCM-CC 原廠規格](https://www.lifefitness.com/en-eu/catalog/strength-training/cable-machines-functional-trainers/adjustable-cable-crossover) 列 2:1、滑車範圍、機架總高；[PWR Play](https://www.lifefitness.com/en-us/catalog/strength-training/cable-machines-functional-trainers/pwr-play) 的**專用**三頭下壓站另為 1:1，並非模型預設機型 |

### 3.2 與現行模型對照
- 現行 `src/biomech.js`：
  - `pulldown`：出繩高度 `y = 2.35 m`，低於 HDU-DPR 機架總高 2.44 m，但出繩中心高度仍**未查證**。
  - `cablerow`：出繩高度 `y = 0.42 m`、距骨盆中心 `z = 1.0 m`，均**未查證**。
  - `pushdown`：可調滑車高檔 `y = 1.92 m`，對應 LCM-CC 的 17.8–193.0 cm 可調區間；前版本 2.10 m 超出該區間。
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

#### (E) 腿彎舉機的直接量測

[Pizzimenti（1992，PubMed 1322768）](https://pubmed.ncbi.nlm.nih.gov/1322768/) 實測 Nautilus 俯臥腿彎舉機與 20 名男性在兩種等速條件的膝屈力矩趨勢，摘要指出機台阻力曲線與受試者力矩曲線不吻合。可取得的摘要沒有逐角度、可移植到本模型的原始阻力係數；而目前模型還包含坐姿腿彎舉，故此次**不調整凸輪預設或節點**。原有 `legcurl.human` 是人體曲線示例，並非 Nautilus 機台實測凸輪。

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
| **雙側可調滑輪柱／大飛鳥（Cable Crossover / Dual Adjustable Pulley）** | 兩手各握獨立 D 型把手、各連一條獨立鋼索（無剛體握把互推）；滑輪可於低／中／高檔調整 | 所選 Life Fitness `LCM-CC` 的滑輪比 **2:1**、滑車範圍 **17.8–193.0 cm**（7"–76"）、機架總高 **239 cm**；柱距 260 cm、單側 18 kg 示範配重及出繩中心與滑車刻度的對應仍**未查證** | [LCM-CC 官方規格](https://www.lifefitness.com/en-eu/catalog/strength-training/cable-machines-functional-trainers/adjustable-cable-crossover)；站位距離與配重屬模型假設 |

### 6.2 模型對應
- `src/biomech.js` 的 `pecDeckPose` 與 `MACHINES.pecdeck` 實作坐姿垂直轉軸圓弧阻力（`padLoads` 搭配切線方向），提供握把式（`style: 'handle'`）與前臂墊式（`style: 'pad'`）。
- `src/biomech.js` 的 `cableFlyPose` 與 `MACHINES.cablefly` 實作站姿雙側獨立滑輪（`pose.dualCable = true`，`cableLoads` 不套用 `minimizeAxialMoment`），提供高位（192 cm）、中位（134 cm）、低位（85 cm）三種滑輪高度。

---

## 7. 其他器械與羅馬椅（幾何假設未查證）

下表尺寸、配重與凸輪值只供教學示意，未取得單一商用機型的原廠尺寸、握把力曲線或實測校正；程式數值集中於 `MACHINES`。所列研究僅支持動作與肌肉作用，不視為器械尺寸的出處。

| 動作 | 模型尺寸與負重假設 | 支撐與力線 |
|---|---|---|
| 反向蝴蝶機 | 預設握把半徑 52 cm、凸輪等效力臂 22 cm、配重 40 kg、預設座高 55 cm | 胸墊承受握把水平合力；握把阻力沿旋轉臂切線。肩力臂可間接參考 [Ackland 2008](https://pubmed.ncbi.nlm.nih.gov/18691376/)，未查證本機型凸輪。 |
| 45° 背伸展 | 預設髖高 92 cm、腳踝墊在後方 50 cm、胸前槓片 10 kg | 大腿墊向上、腳踝墊向下；兩接觸力以全身力矩平衡求解。[Andersen 2021](https://pubmed.ncbi.nlm.nih.gov/33948095/) 直接比較羅馬椅肌電，未量墊高效果。 |
| 哈克深蹲機 | 滑軌 45°、長 185 cm、半寬 49 cm、腳板 12°、滑台加掛片 80 kg | 背與肩墊沿滑軌，腳板壓力中心加滑軌法向反力平衡；不含摩擦。45° 腿推與深蹲可參考 [Escamilla 1998](https://pubmed.ncbi.nlm.nih.gov/9565938/)，並非哈克機規格。 |
| 器械肩推 | 握把行程 47 cm、頂部轉軸高 183 cm、預設座高 55 cm、配重 40 kg、預設軌跡前傾 8° | 固定軌跡給手部向下阻力，座墊與椅背承重。[Saeterbakken 2013](https://pubmed.ncbi.nlm.nih.gov/23096062/) 比較肩推姿勢與負重型式，未量此機台。 |
| 站姿／坐姿提踵 | 前腳掌台階高 13 cm、站姿肩墊 60 kg、坐姿膝墊 45 kg、腳掌角度約背屈 15° 至蹠屈 20° | 前腳掌支撐踝力矩；坐姿軀幹由座墊承重。[Kinoshita 2023](https://pubmed.ncbi.nlm.nih.gov/38156065/) 比較 12 週肌肥大，並非即時肌電負重校正。 |
| 臀外展／內收機 | 膝墊槓桿 35 cm、凸輪等效力臂 22 cm、配重 35 kg、座高 55 cm | 膝側墊沿左右方向給力，在水平面繞髖轉動。[de Almeida Paz 2022](https://pubmed.ncbi.nlm.nih.gov/35500965/) 直接研究外展機肌電，未量幾何與內收機。 |

---

## 8. 啞鈴器材與預設負重

啞鈴沒有剛體橫槓連接雙手，模型採共用負重函式 `dumbbellLoads`：每隻手各自承受自己那顆啞鈴的垂直重力（`barAxial = false`，不套用 `minimizeAxialMoment`），高腳杯深蹲則由雙手平分單顆啞鈴重量。握把尺寸採 [REP Fitness Hex Dumbbells (KG) 原廠規格](https://repfitness.com/products/hex-dumbbells-kg) 的 7.5–22.5 kg 段：握把長 5.2"（約 13.2 cm）、直徑 34 mm。這一款與模型常用 8–22 kg 示範負重相近，適合作為外觀預設；2.5–5 kg 段的原廠直徑是 28 mm，模型未做重量分段。片頭尺寸與負重仍屬示範假設：

| 項目 | 模型尺寸與負重假設 | 備註 |
|---|---|---|
| 啞鈴共用尺寸 | 握把長 13.2 cm、直徑 34 mm（半徑 1.7 cm）；兩端八角片半徑 5.5–11.5 cm、寬度 3.2–8.5 cm 隨重量線性縮放 | 握把取 REP Hex KG 7.5–22.5 kg 原廠規格；片頭形狀與尺寸未查證，仍為示範外觀 |
| 啞鈴臥推（平板／上斜 30°） | 預設每顆 22 kg（雙手 44 kg，略輕於槓鈴臥推 60 kg） | 下放時手可比槓鈴更外、更深並維持前臂接近垂直，頂點向肩上方微內聚（間距 44 cm） |
| 坐姿啞鈴肩推 | 預設每顆 14 kg（雙手 28 kg）；椅座高 50 cm、椅背後傾 8°（82°） | 手肘預設於肩胛平面（前偏 30°），下放至耳側／肩旁、頂點微內聚（間距 42 cm） |
| 啞鈴側平舉 | 預設每顆 8 kg | 站姿重心平衡（`standingHands` 且 `barAxial = false`），自體側 14° 沿肩胛或冠狀面平舉至 90° |
| 啞鈴彎舉／錘式彎舉 | 預設每顆 12 kg（雙手 24 kg） | 站姿雙手垂於體側（上臂外開 8° 避開髖部）；反握／錘式沿用既有握法偏好係數（1.6×／1.0×） |
| 俯身啞鈴反向飛鳥 | 預設每顆 6 kg；預設俯身 65°、肘微彎 20° | 站姿俯身重心平衡，雙手自胸下方 8° 水平外展至 86° |
| 高腳杯深蹲 | 預設單顆 20 kg | 單顆啞鈴垂直捧於胸前（距軀幹軸 22 cm、沿軀幹 40 cm），沿用深蹲前側負重姿勢求解（預設偏膝主導 `dom = 0.05`，依教練技術原則 S1／Q3 採較多膝前移；數值仍是未經同條件實測的示範假設） |

---

## 9. 身材適配與可調範圍

以下是模型**目前**使用的調整。商用資料證明部分器械有對應的可調機構；除 Cybex 羅馬椅的總行程 34 cm 外，沒有查到與本模型同機型、同座標定義的刻度。其餘上下限均標為**示範假設**，不可當作所有器械的實際規格。程式以軀幹長補償座高，以手臂長補償可握半徑；機架轉軸、滑輪高度與軌道角維持固定。

| 部件與動作 | 模型範圍或三身材實際值（1.5／1.75／2.0 m） | 依據與界線狀態 |
|---|---|---|
| 蝴蝶機／反向蝴蝶機／胸推／肩推的座椅 | 可調骨盆高 43–68 cm；三身材為 62.4／55.0／47.6 cm，令肩高對齊固定握把或轉軸 | [Life Fitness Insignia 使用手冊](https://kb.cybexintl.com/Owners_Manuals/Strength/Life_Fitness_Insignia_Series_Owners_Manual_9481201_Rev_BE.pdf) 指示飛鳥／反飛鳥按手臂與地面平行調座高；[Axiom 胸推官方頁](https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/axiom-series-chest-press) 說明座椅可依身高調整。43–68 cm 為**示範假設**。 |
| 蝴蝶機／反向蝴蝶機握把可及半徑 | 蝴蝶 42–62 cm，三身材 46.3／54.0／61.7 cm；反向蝴蝶 42–62 cm，三身材 44.6／52.0／59.4 cm | [Precor Vitality 雙用機](https://www.precor.com/en-US/products/VSL015BP) 的旋轉臂可依臂長適配；[Cybex VR1 產品資料](https://kb.cybexintl.com/Product_Info/VR1_Product_Info.pdf) 亦載明浮動式握把適配臂長。模型固定轉軸與 42–62 cm 半徑**未經該機型刻度查證**，屬示範假設。 |
| 蝴蝶機背墊、反向蝴蝶機胸墊 | 背墊前後距 13.3／15.5／17.7 cm；胸墊前後距 11.1／13.0／14.9 cm，胸墊接點高度隨座高移動 | [Precor Vitality Rear Delt / Pec Fly 官方頁](https://www.precor.com/en-US/products/VSL015BP) 證實同一靠墊提供胸／背支撐；本模型按身高移動接點的距離與範圍**未查證**，為示範假設。 |
| 站姿提踵肩墊 | 腳台固定 13 cm；肩墊隨肩高逐幀移動，三身材在行程中約 1.34–1.84 m | [Cybex VR1 產品資料](https://kb.cybexintl.com/Product_Info/VR1_Product_Info.pdf) 指出輸入臂可依身高調整。具體高度與本模型逐幀接觸追蹤屬**示範假設**。 |
| 45° 羅馬椅大腿墊 | 模型可調髖參考高 72–106 cm（總行程 34 cm）；三身材為 81.3／92.0／102.7 cm；踝部滾輪位置固定 | [Cybex Prestige 45° Back Extension 官方規格](https://www.lifefitness.com/en-us/catalog/cybex/cybex-products/cybex-prestige-series-45%C2%BA-back-extension) 公布可調行程 34 cm；72–106 cm 的絕對高度及腿長對應為**示範假設**。 |
| 三頭下壓、槓鈴彎舉 | 三頭下壓使用 LCM-CC 滑車高檔 1.92 m；握距與前臂矢狀面投影由閉鏈幾何求出，避免少數身材把手推到臂長之外 | 1.92 m 在原廠可調滑車範圍內；實際出繩中心、站位與短桿尺寸仍**未查證**。若姿勢不可達，介面顯示繁中警告。 |
| 引體向上／輔助引體的懸垂起點 | 固定握點 2.35 m；按臂長與握距求近乎伸直的肩高，腿部彎曲距離按腿長縮放。三身材底點腳尖離地約 72／44／16 cm（徒手），輔助機約 62／32／3 cm | 由握點—肩—臂長及腿長的幾何必要條件推得；2.35 m 握點及輔助機膝墊高度仍為**未查證的示範值**。矮身材可踩踏台抓槓，懸吊後離台；踏台不計入運動中的支撐或負重。原廠 [Life Fitness PWR Play](https://www.lifefitness.com/en-us/catalog/strength-training/cable-machines-functional-trainers/pwr-play) 說明輔助引體站有可折疊腳踏，但未公布握點與腳踏距離。 |

三身材 × 63 項 × 21 點掃描：1.5 m／50 kg 女性、預設及 2.0 m／110 kg 男性各正常 1323 點、警告 0 點。先前矮身材的 66 點不可達已由骨長幾何修正；器械實際握點、膝墊與踏台刻度仍須以實機核對。
