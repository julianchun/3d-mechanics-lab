# 重訓動作生物力學與肌電圖文獻彙整

本文件針對 [`src/catalog.js`](../src/catalog.js) 中**所有已實作動作**（共 37 項）整理同儕審查文獻（逆動力學／關節力矩、肌電圖 EMG、肌肥大研究與動作技術研究）、可與本模型比較的量化數據，以及可用於自動驗證（[`tests/trends.mjs`](../tests/trends.mjs)）的方向性趨勢。

> **驗證原則**：每筆引用均附已查證之 PubMed（PMID）或 DOI／原始出處連結；針對目前缺乏直接同儕審查動態研究之動作，明確標記「未找到」並說明替代參考方向。

---

## 目錄與覆蓋總覽

| 分類 | 清單 ID | 動作名稱 | 文獻狀態 |
|---|---|---|---|
| 蹲 | `squat-high` | 深蹲（高槓） | 完整（逆動力學、EMG、肌肥大） |
| 蹲 | `squat-low` | 深蹲（低槓） | 完整（綜述、EMG、1RM 力學） |
| 蹲 | `front-squat` | 前蹲 | 完整（逆動力學、EMG） |
| 蹲 | `smith-squat` | 史密斯深蹲 | 完整（EMG） |
| 蹲 | `leg-press` | 45° 腿推機 | 完整（逆動力學、EMG、腳位） |
| 髖鉸鏈 | `deadlift` | 硬舉（傳統） | 完整（3D 逆動力學、EMG 系統綜述） |
| 髖鉸鏈 | `deficit-dl` | 赤字硬舉 | 僅研討會摘要（期刊全文未找到） |
| 髖鉸鏈 | `block-pull` | 墊高硬舉 | 僅研討會摘要（期刊全文未找到） |
| 髖鉸鏈 | `sumo` | 相撲硬舉 | 完整（3D 逆動力學、EMG、腰椎負荷） |
| 髖鉸鏈 | `rdl` | 羅馬尼亞硬舉 | 完整（EMG、系統綜述） |
| 髖鉸鏈 | `good-morning` | 早安體前屈 | 完整（運動學、EMG） |
| 髖鉸鏈 | `hip-thrust` | 臀推 | 完整（EMG、系統綜述、腳位變化） |
| 髖鉸鏈 | `glute-bridge` | 槓鈴臀橋 | 完整（與臀推直接比較 EMG） |
| 水平推 | `bench` | 臥推（平板） | 完整（EMG、握距與角度比較） |
| 水平推 | `incline-bench` | 上斜臥推 | 完整（多角度 EMG） |
| 水平推 | `cg-bench` | 窄握臥推 | 完整（握距 EMG） |
| 水平推 | `floor-press` | 地板臥推 | 動態 EMG／逆動力學未找到（僅等長測試研究） |
| 水平推 | `chest-press` | 坐姿胸推機 | 部分（多以史密斯機或機械臥推代替比較） |
| 水平推 | `pec-deck` | 蝴蝶機 | 完整（與臥推直接比較 EMG、預先疲勞） |
| 水平推 | `cable-fly-high` | 滑輪夾胸（高位） | 間接（斜向水平內收 EMG、肩力臂、滑輪比較） |
| 水平推 | `cable-fly-mid` | 滑輪夾胸（中位） | 間接（斜向水平內收 EMG、滑輪比較） |
| 水平推 | `cable-fly-low` | 滑輪夾胸（低位） | 間接（斜向水平內收 EMG、肩力臂、傾角比較） |
| 垂直推 | `ohp` | 站姿肩推 | 完整（站姿 vs 坐姿、槓鈴 vs 啞鈴 EMG） |
| 水平拉 | `row` | 槓鈴划船（正握） | 完整（腰椎負荷與 EMG） |
| 水平拉 | `row-sup` | 槓鈴划船（反握） | 直接正反握槓鈴划船全文未找到（參考拉類握法研究） |
| 水平拉 | `cable-row` | 坐姿滑輪划船 | 完整（EMG、肩胛後收與握距） |
| 水平拉 | `cable-row-wide` | 坐姿滑輪划船（寬握） | 完整（寬握 vs 窄握肩外展角 EMG） |
| 垂直拉 | `uprow` | 直立划船 | 完整（握距 EMG） |
| 垂直拉 | `pulldown` | 滑輪下拉 | 完整（握法、握距 EMG） |
| 垂直拉 | `pulldown-sup` | 反握滑輪下拉 | 完整（與正握直接比較 EMG） |
| 單關節 | `leg-ext` | 腿伸機 | 完整（逆動力學、EMG、凸輪曲線） |
| 單關節 | `leg-curl` | 坐姿腿彎舉 | 完整（MRI 肌肥大、EMG） |
| 單關節 | `lying-leg-curl` | 俯臥腿彎舉 | 完整（與坐姿直接比較肌肥大、EMG） |
| 單關節 | `pushdown` | 滑輪三頭下壓 | 完整（長頭肌肥大比較、三頭疲勞 EMG） |
| 單關節 | `curl` | 槓鈴彎舉 | 完整（EMG、槓種與姿勢比較） |
| 單關節 | `reverse-curl` | 反手彎舉 | 完整（旋前 vs 旋後肌肉協調 EMG） |
| 單關節 | `shrug` | 槓鈴聳肩 | 完整（EMG、肩胛上旋變化式） |

---

## 一、蹲（Squat）

### 1. `squat-high` 深蹲（高槓）

- **可靠研究來源**
  1. Escamilla RF, Fleisig GS, Zheng N, Barrentine SW, Wilk KE, Andrews JR. (1998). *Biomechanics of the knee during closed kinetic chain and open kinetic chain exercises.* Med Sci Sports Exerc, 30(4):556–569. [PubMed 9565938](https://pubmed.ncbi.nlm.nih.gov/9565938/)
  2. Escamilla RF. (2001). *Knee biomechanics of the dynamic squat exercise.* Med Sci Sports Exerc, 33(1):127–141. [PubMed 11194098](https://pubmed.ncbi.nlm.nih.gov/11194098/) / [DOI](https://doi.org/10.1097/00005768-200101000-00020)
  3. Escamilla RF, Fleisig GS, Lowry TM, Barrentine SW, Andrews JR. (2001). *A three-dimensional biomechanical analysis of the squat during varying stance widths.* Med Sci Sports Exerc, 33(6):984–998. [PubMed 11404665](https://pubmed.ncbi.nlm.nih.gov/11404665/)
  4. Escamilla RF, Fleisig GS, Zheng N, Lander JE, Barrentine SW, Andrews JR, Bergemann BW, Moorman CT 3rd. (2001). *Effects of technique variations on knee biomechanics during the squat and leg press.* Med Sci Sports Exerc, 33(9):1552–1566. [PubMed 11528346](https://pubmed.ncbi.nlm.nih.gov/11528346/)
  5. Paoli A, Marcolin G, Petrone N. (2009). *The effect of stance width on the electromyographical activity of eight superficial thigh muscles during back squat with different bar loads.* J Strength Cond Res, 23(1):246–250. [PubMed 19130646](https://pubmed.ncbi.nlm.nih.gov/19130646/) / [DOI](https://doi.org/10.1519/jsc.0b013e3181876811)
  6. Bryanton MA, Kennedy MD, Carey JP, Chiu LZ. (2012). *Effect of squat depth and barbell load on relative muscular effort in squatting.* J Strength Cond Res, 26(10):2820–2828. [PubMed 22797000](https://pubmed.ncbi.nlm.nih.gov/22797000/) / [DOI](https://doi.org/10.1519/JSC.0b013e31826791a7)
  7. Kubo K, Ikebukuro T, Yata H. (2019). *Effects of squat training with different depths on lower limb muscle volumes.* Eur J Appl Physiol, 119(9):1933–1942. [PubMed 31230110](https://pubmed.ncbi.nlm.nih.gov/31230110/) / [DOI](https://doi.org/10.1007/s00421-019-04181-y)
  8. Illmeier G, Rechberger JS. (2023). *The limitations of anterior knee displacement during different barbell squat techniques: A comprehensive review.* J Clin Med, 12(8):2955. [PubMed 37109294](https://pubmed.ncbi.nlm.nih.gov/37109294/) / [DOI](https://doi.org/10.3390/jcm12082955)
- **可比較量化結果**
  - **關節力與峰值位置**（Escamilla 1998, n=10 有經驗男性；Escamilla 2001 綜述）：閉鏈深蹲時，股四頭肌 EMG、髕股關節壓迫力與脛股關節壓迫力隨膝屈曲增加而遞增，於**接近最大膝屈曲（最低點）達到峰值**；深蹲產生之膕繩肌共同活化約為腿推機與腿伸機的 **2 倍**。
  - **深度對肌肥大之影響**（Kubo 2019, 10 週訓練 MRI 體積變化）：全蹲組（FST）與半蹲組（HST）之股四頭肌（不含股直肌）增幅相近（FST +4.9% vs HST +4.6%），膕繩肌與股直肌兩組皆無顯著增加；但**臀大肌（FST +6.7% vs HST +2.2%）與內收肌群（FST +6.2% vs HST +2.7%）在全蹲組顯著較高**。
  - **站距對 EMG 之影響**（Paoli 2009, n=6 有經驗舉重者，測試 0%、30%、70% 1RM 與 3 種站距，測 8 條大腿／髖部肌群）：**僅臀大肌**於最寬站距呈現顯著較高肌電活動，且差異**僅在 0% 與 70% 1RM 達統計顯著**（30% 1RM 與其餘 7 條肌群均無顯著差異）。
  - **腳尖外轉角度**（Escamilla 2001, n=10）：腳尖朝前 vs 外轉 30° 對肌電與膝關節受力皆無顯著差異。
- **可檢驗趨勢**
  - 深蹲最低點（深屈）膝伸力矩 > 淺屈處（Escamilla 1998, 2001）。
  - 深蹲膕繩肌活動 > 45° 腿推機，文獻約為 2 倍（Escamilla 1998, n=10）。
  - 全蹲（`depth` 高）臀大肌與內收大肌負荷 > 淺蹲（Kubo 2019；Bryanton 2012）。
  - 寬站距（`stance` 高）臀大肌活動 > 窄站距（Paoli 2009, n=6，僅 0% 與 70% 1RM 顯著）。

### 2. `squat-low` 深蹲（低槓）

- **可靠研究來源**
  1. Glassbrook DJ, Helms ER, Brown SR, Storey AG. (2017). *A review of the biomechanical differences between the high-bar and low-bar back-squat.* J Strength Cond Res, 31(9):2618–2634. [PubMed 28570490](https://pubmed.ncbi.nlm.nih.gov/28570490/) / [DOI](https://doi.org/10.1519/JSC.0000000000002007)
  2. Glassbrook DJ, Brown SR, Helms ER, Duncan S, Storey AG. (2019). *The high-bar and low-bar back-squats: A biomechanical analysis.* J Strength Cond Res, 33(Suppl 1):S1–S18. [DOI](https://doi.org/10.1519/JSC.0000000000001836)
  3. Murawa M, Fryzowicz A, Kabacinski J, Jurga J, Gorwa J, Galli M, Zago M. (2020). *Muscle activation varies between high-bar and low-bar back squat.* PeerJ, 8:e9256. [PubMed 32551198](https://pubmed.ncbi.nlm.nih.gov/32551198/) / [DOI](https://doi.org/10.7717/peerj.9256)
  4. van den Tillaar R, Knutli TR, Larsen S. (2020). *The effects of barbell placement on kinematics and muscle activation around the sticking region in squats.* Front Sports Act Living, 2:604177. [PubMed 33345183](https://pubmed.ncbi.nlm.nih.gov/33345183/) / [DOI](https://doi.org/10.3389/fspor.2020.604177)
  5. Illmeier G, Rechberger JS. (2023). *The limitations of anterior knee displacement during different barbell squat techniques: A comprehensive review.* J Clin Med, 12(8):2955. [PubMed 37109294](https://pubmed.ncbi.nlm.nih.gov/37109294/) / [DOI](https://doi.org/10.3390/jcm12082955)
- **可比較量化結果**
  - Glassbrook et al. (2017) 系統綜述指出：低槓將槓鈴下移至三角肌後束，為維持重心在腳掌中段，造成**較大的軀幹前傾與髖屈曲**、較小的膝屈曲與踝背屈，進而增加髖關節力臂、減少膝關節力臂；後側鏈肌群（**臀大肌、豎脊肌、內收肌**）活動高於高槓，高槓則有較高之股四頭肌活動。兩者垂直地面反作用力差異有限。
  - Murawa et al. (2020) 比較有經驗健力選手於 60%、65%、70% 1RM 執行高槓與低槓深蹲：離心期低槓於後側鏈與受測肌群呈現顯著較高肌電活動。
- **可檢驗趨勢**
  - 低槓深蹲髖伸力矩與腰椎伸展力矩（豎脊肌）> 高槓深蹲（Glassbrook 2017）。
  - 高槓深蹲膝伸力矩／股四頭肌活化 > 低槓深蹲（Glassbrook 2017）。

### 3. `front-squat` 前蹲

- **可靠研究來源**
  1. Gullett JC, Tillman MD, Gutierrez GM, Chow JW. (2009). *A biomechanical comparison of back and front squats in healthy trained individuals.* J Strength Cond Res, 23(1):284–292. [PubMed 19002072](https://pubmed.ncbi.nlm.nih.gov/19002072/) / [DOI](https://doi.org/10.1519/JSC.0b013e31818546bb)
  2. Yavuz HU, Erdağ D, Amca AM, Aritan S. (2015). *Kinematic and EMG activities during front and back squat variations in maximum loads.* J Sports Sci, 33(10):1058–1066. [PubMed 25630691](https://pubmed.ncbi.nlm.nih.gov/25630691/) / [DOI](https://doi.org/10.1080/02640414.2014.984240)
  3. Krzyszkowski J, Kipp K. (2020). *Load-dependent mechanical demands of the lower extremity during the back and front squat.* J Sports Sci, 38(17):2005–2012. [PubMed 32544021](https://pubmed.ncbi.nlm.nih.gov/32544021/) / [DOI](https://doi.org/10.1080/02640414.2020.1766738)
  4. Russell PJ, Phillips SJ. (1989). *A preliminary comparison of front and back squat exercises.* Res Q Exerc Sport, 60(3):201–208. [PubMed 2489844](https://pubmed.ncbi.nlm.nih.gov/2489844/)
  5. Illmeier G, Rechberger JS. (2023). *The limitations of anterior knee displacement during different barbell squat techniques: A comprehensive review.* J Clin Med, 12(8):2955. [PubMed 37109294](https://pubmed.ncbi.nlm.nih.gov/37109294/) / [DOI](https://doi.org/10.3390/jcm12082955)
- **可比較量化結果**
  - Gullett et al. (2009, n=15 有訓練經驗健康成人，交叉設計，採各自相對 1RM 百分比負荷)：
    - 背蹲產生**顯著較高的脛股關節壓迫力與膝伸肌力矩**（部分因背蹲絕對 1RM 較重）；膝剪力小且兩者無差異。
    - 槓位對下肢與豎脊肌整體 EMG **無顯著差異**；向心期 EMG 顯著高於離心期。（註：該摘要僅報告膝關節動力學與肌電，未報告髖力矩或軀幹前傾角。）
  - Yavuz et al. (2015, n=12，最大負荷比較)：背蹲呈現**顯著較大的軀幹前傾角**（前蹲軀幹較直立），膝關節運動學兩者無顯著差異；前蹲向心與全程之股內側肌 EMG 較高，背蹲向心期半腱肌 EMG 較高。
  - Krzyszkowski & Kipp (2020, n=11 NCAA Division-I 運動員，以**相同絕對負重** 40%、60%、80% 前蹲 1RM 比較)：**背蹲於 60% 與 80% FS-1RM 產生顯著較高的峰值髖伸淨關節力矩**；前蹲於 80% FS-1RM 產生較高的峰值膝伸淨關節力矩（若依各自 1RM 預測最大負重，背蹲膝伸力矩則略高約 3%）。
- **可檢驗趨勢**
  - 前蹲最低點軀幹前傾角 < 高槓背蹲（Yavuz 2015, n=12）。
  - 同等絕對槓重下，前蹲髖伸力矩 < 高槓背蹲（Krzyszkowski & Kipp 2020, n=11，60% 與 80% FS-1RM）。

### 4. `smith-squat` 史密斯深蹲

- **可靠研究來源**
  1. Schwanbeck S, Chilibeck PD, Binsted G. (2009). *A comparison of free weight squat to Smith machine squat using electromyography.* J Strength Cond Res, 23(9):2588–2591. [PubMed 19855308](https://pubmed.ncbi.nlm.nih.gov/19855308/)
- **可比較量化結果**
  - Schwanbeck et al. (2009, n=6 健康受試者，各自 8RM × 1 組)：
    - 自由重量深蹲於所有受測肌群平均總 EMG 比史密斯深蹲高 **43%**。
    - 單肌群顯著高於史密斯深蹲：**股內側肌 +49%、腓腸肌 +34%、股二頭肌 +26%**。
    - 軀幹穩定肌（腰部豎脊肌、腹直肌）單獨比較未達統計顯著（樣本數較小）。
- **可檢驗趨勢**
  - 自由重量深蹲（高槓）膕繩肌活動 > 史密斯深蹲（Schwanbeck 2009, +26%）。
  - 自由重量深蹲（高槓）股四頭肌活動 > 史密斯深蹲（Schwanbeck 2009, 股內側肌 +49%）。

### 5. `leg-press` 45° 腿推機

- **可靠研究來源**
  1. Escamilla RF, Fleisig GS, Zheng N, Barrentine SW, Wilk KE, Andrews JR. (1998). *Biomechanics of the knee during closed kinetic chain and open kinetic chain exercises.* Med Sci Sports Exerc, 30(4):556–569. [PubMed 9565938](https://pubmed.ncbi.nlm.nih.gov/9565938/)
  2. Escamilla RF, Fleisig GS, Zheng N, Lander JE, Barrentine SW, Andrews JR, Bergemann BW, Moorman CT 3rd. (2001). *Effects of technique variations on knee biomechanics during the squat and leg press.* Med Sci Sports Exerc, 33(9):1552–1566. [PubMed 11528346](https://pubmed.ncbi.nlm.nih.gov/11528346/)
  3. Da Silva EM, Brentano MA, Cadore EL, De Almeida APV, Kruel LFM. (2008). *Analysis of muscle activation during different leg press exercises at submaximum effort levels.* J Strength Cond Res, 22(4):1059–1065. [PubMed 18545207](https://pubmed.ncbi.nlm.nih.gov/18545207/) / [DOI](https://doi.org/10.1519/JSC.0b013e3181739445)
- **可比較量化結果**
  - Da Silva et al. (2008, n=14 健康女性，40% 與 80% 1RM)：45° 腿推機**高腳位（LPH）之臀大肌 EMG 顯著高於低腳位（LPL）**；反之，**低腳位（LPL）**於較高負荷下對股直肌與股四頭肌（較大膝屈曲幅度）誘發較高活動。
  - Escamilla et al. (2001, n=10 男性)：寬站距高腳位（WS-LPH）膕繩肌活動高於窄站距高腳位（NS-LPH）；窄站距腿推機的脛股與髕股壓迫力高於寬站距；自由深蹲股四頭肌與膕繩肌活動皆高於高低腳位腿推機。
  - Escamilla et al. (1998, n=10)：閉鏈腿推機股四頭肌活動峰值出現在接近最大膝屈曲處；無顯著 ACL 拉力。
- **可檢驗趨勢**
  - 腿推機腳踩高（`footHigh` 高）臀大肌活化與髖伸力矩 > 腳踩低（Da Silva 2008, n=14）。
  - 腿推機腳踩低（`footHigh` 低）膝伸力矩 > 腳踩高（Da Silva 2008）。
  - 腿推機膕繩肌活化 < 深蹲（Escamilla 1998, 2001）。

---

## 二、髖鉸鏈（Hinge）

### 6. `deadlift` 硬舉（傳統）

- **可靠研究來源**
  1. Cholewicki J, McGill SM, Norman RW. (1991). *Lumbar spine loads during the lifting of extremely heavy weights.* Med Sci Sports Exerc, 23(10):1179–1186. [PubMed 1758295](https://pubmed.ncbi.nlm.nih.gov/1758295/)
  2. Escamilla RF, Francisco AC, Fleisig GS, Barrentine SW, Welch CM, Kayes AV, Speer KP, Andrews JR. (2000). *A three-dimensional biomechanical analysis of sumo and conventional style deadlifts.* Med Sci Sports Exerc, 32(7):1265–1275. [PubMed 10912892](https://pubmed.ncbi.nlm.nih.gov/10912892/) / [DOI](https://doi.org/10.1097/00005768-200007000-00013)
  3. Escamilla RF, Francisco AC, Kayes AV, Speer KP, Moorman CT 3rd. (2002). *An electromyographic analysis of sumo and conventional style deadlifts.* Med Sci Sports Exerc, 34(4):682–688. [PubMed 11932579](https://pubmed.ncbi.nlm.nih.gov/11932579/) / [DOI](https://doi.org/10.1097/00005768-200204000-00019)
  4. Martín-Fuentes I, Oliva-Lozano JM, Muyor JM. (2020). *Electromyographic activity in deadlift exercise and its variants. A systematic review.* PLoS ONE, 15(2):e0229507. [PubMed 32107499](https://pubmed.ncbi.nlm.nih.gov/32107499/)
- **可比較量化結果**
  - Martín-Fuentes et al. (2020) 系統性綜述：傳統硬舉中，**豎脊肌與股四頭肌**的整體 sEMG 通常高於臀大肌與膕繩肌；膕繩肌內半腱肌常略高於股二頭肌。
  - Cholewicki et al. (1991, 全國錦標賽健力選手)：傳統硬舉於 L4/L5 產生極高伸展力矩與前剪力，較相撲硬舉多出約 10% 力矩與 8% 剪力。
  - Escamilla et al. (2002, 測 16 條肌肉)：傳統硬舉的**內側腓腸肌** EMG 顯著高於相撲硬舉。
- **可檢驗趨勢**
  - 傳統硬舉腰椎伸展力矩 > 相撲硬舉（Cholewicki 1991, ~+10%；Escamilla 2000）。
  - 槓離身體越遠（`barDist` 大）→ 腰椎伸展力矩與髖伸力矩皆上升（基礎槓桿力學，Cholewicki 1991）。

### 7. `deficit-dl` 赤字硬舉 & 8. `block-pull` 墊高硬舉

- **可靠研究來源**
  - **同儕審查期刊全文：未找到**（PubMed 檢索未查得直接比較赤字硬舉、傳統硬舉與墊高硬舉之完整期刊逆動力學或 EMG 原著論文）。
  - **研討會摘要參考**：Rogacion CR, Schick EE, Cotter JA, Valenzuela K. (2024). *Differences in Joint Kinematics and Electromyography Activity among the Conventional, Block, and Deficit Deadlifts.* International Journal of Exercise Science: Conference Proceedings, 14(4):Article 68. [WKU TopSCHOLAR](https://digitalcommons.wku.edu/ijesab/vol14/iss4/68)
- **可比較量化結果（研討會摘要，70% 1RM 標準化負荷）**
  - 赤字硬舉（站於墊高台）起始踝、膝、髖與軀幹屈曲角皆顯著大於傳統與墊高硬舉，總行程最長。
  - 峰值 EMG：赤字硬舉之**股外側肌**與**臀大肌**顯著高於傳統硬舉與墊高硬舉；赤字硬舉之**股二頭肌**顯著高於墊高硬舉；豎脊肌峰值差異不顯著。
- **可檢驗趨勢（參考研討會初步證據，待期刊全文驗證）**
  - 赤字硬舉（`start = -5`）股四頭肌、臀大肌、膕繩肌峰值活化 > 墊高硬舉（`start = +10`）（Rogacion 2024 摘要）。

### 9. `sumo` 相撲硬舉

- **可靠研究來源**
  1. Escamilla RF et al. (2000). *A three-dimensional biomechanical analysis of sumo and conventional style deadlifts.* Med Sci Sports Exerc, 32(7):1265–1275. [PubMed 10912892](https://pubmed.ncbi.nlm.nih.gov/10912892/) / [DOI](https://doi.org/10.1097/00005768-200007000-00013)
  2. Escamilla RF et al. (2002). *An electromyographic analysis of sumo and conventional style deadlifts.* Med Sci Sports Exerc, 34(4):682–688. [PubMed 11932579](https://pubmed.ncbi.nlm.nih.gov/11932579/) / [DOI](https://doi.org/10.1097/00005768-200204000-00019)
  3. Cholewicki J, McGill SM, Norman RW. (1991). *Lumbar spine loads during the lifting of extremely heavy weights.* Med Sci Sports Exerc, 23(10):1179–1186. [PubMed 1758295](https://pubmed.ncbi.nlm.nih.gov/1758295/)
- **可比較量化結果**
  - Escamilla et al. (2000)：相撲硬舉在離地與過膝時**軀幹明顯較直立**，槓與 L5/S1 水平距離較短，且額狀面與水平面關節負荷增加。
  - Escamilla et al. (2002)：相撲硬舉在**股內側肌、股外側肌與脛前肌**呈現顯著較高之整體 EMG；傳統硬舉則在內側腓腸肌較高。
  - Cholewicki et al. (1991)：相撲硬舉相較傳統硬舉降低約 **10% L4/L5 伸展力矩**與 **8% 前剪力**。
- **可檢驗趨勢**
  - 相撲硬舉股四頭肌（`vasti`）活化 > 傳統硬舉（Escamilla 2002）。
  - 相撲硬舉腰椎伸展力矩（`trunkExt`）< 傳統硬舉（Cholewicki 1991；Escamilla 2000）。

### 10. `rdl` 羅馬尼亞硬舉

- **可靠研究來源**
  1. McAllister MJ, Hammond KG, Schilling BK, Ferreria LC, Reed JP, Weiss LW. (2014). *Muscle activation during various hamstring exercises.* J Strength Cond Res, 28(6):1573–1580. [PubMed 24149748](https://pubmed.ncbi.nlm.nih.gov/24149748/) / [DOI](https://doi.org/10.1519/JSC.0000000000000302)
  2. Martín-Fuentes I, Oliva-Lozano JM, Muyor JM. (2020). *Electromyographic activity in deadlift exercise and its variants. A systematic review.* PLoS ONE, 15(2):e0229507. [PubMed 32107499](https://pubmed.ncbi.nlm.nih.gov/32107499/)
- **可比較量化結果**
  - Martín-Fuentes et al. (2020) 綜述指出：與傳統硬舉相比，RDL 呈現**極高的膕繩肌活化（股二頭肌與半腱肌）**，同時豎脊肌相對比例較傳統硬舉低（且膝屈曲小、股四頭肌參與極低）。
  - McAllister et al. (2014) 比較 RDL、早安體前屈、腿彎舉與臀腿上抬（GHR）之膕繩肌活化，顯示髖鉸鏈類動作在拉長端對膕繩肌提供高機械張力。
- **可檢驗趨勢**
  - RDL 膕繩肌活化 > 股四頭肌（膝伸力矩極小），且膕繩肌處於拉長位置（Martín-Fuentes 2020；McAllister 2014）。

### 11. `good-morning` 早安體前屈

- **可靠研究來源**
  1. Vigotsky AD, Harper EN, Ryan DR, Contreras B. (2015). *Effects of load on good morning kinematics and EMG activity.* PeerJ, 3:e708. [PubMed 25653899](https://pubmed.ncbi.nlm.nih.gov/25653899/) / [DOI](https://doi.org/10.7717/peerj.708)
  2. McAllister MJ et al. (2014). *Muscle activation during various hamstring exercises.* J Strength Cond Res, 28(6):1573–1580. [PubMed 24149748](https://pubmed.ncbi.nlm.nih.gov/24149748/) / [DOI](https://doi.org/10.1519/JSC.0000000000000302)
- **可比較量化結果**
  - Vigotsky et al. (2015, n=15 有訓練男性，操弄變因為**負重** 50% 至 90% 1RM，而非直接操弄膝彎曲角度)：隨負荷增加，膕繩肌與豎脊肌積分 EMG（IEMG）顯著上升；同時受試者膝屈曲角度自發性增加、估計膕繩肌長度隨之縮短，而腰椎與髖屈曲角度無顯著變化。
  - 模型在相同軀幹前傾 72°、要求系統重心落在腳掌中段時，膝屈 5°→35° 會讓髖屈 91.3°→107.1°；膕繩肌跨髖拉長與跨膝縮短互相抵銷，估計最大長度為 1.170→1.164（相對差 0.56%，未達趨勢檢查的 1%）。Vigotsky 等人的負重比較中，髖屈約 75°、膝屈約 17°→25°；其研究不能證明在**相同軀幹前傾與同一重心約束**下，膝屈 5°→35° 仍會縮短超過 1%。因此此項目前保留為未通過的推論，不據此調整力臂或姿勢常數。
  - 槓扛於上背（較高槓位離髖與 L5 力臂長於低槓），因此早安體前屈雖使用較輕重量，但下背與膕繩肌承受高力矩。
- **可檢驗趨勢**
  - 早安體前屈膝彎曲越小（`kneeBend = 5°` vs `35°`）→ 膕繩肌估計長度越長（**幾何推論**——雙關節膕繩肌跨膝後側；註：Vigotsky 2015 係操弄負重而非直接操弄膝角，僅觀察到負重上升時膝屈曲增加伴隨估計長度縮短）。
  - 早安體前屈高槓（`barPos: 'high'`）腰椎伸展力矩 > 低槓（`barPos: 'low'`）（幾何推論）。

### 12. `hip-thrust` 臀推

- **可靠研究來源**
  1. Contreras B, Vigotsky AD, Schoenfeld BJ, Beardsley C, Cronin J. (2015). *A comparison of gluteus maximus, biceps femoris, and vastus lateralis electromyographic activity in the back squat and barbell hip thrust exercises.* J Appl Biomech, 31(6):452–458. [PubMed 26214739](https://pubmed.ncbi.nlm.nih.gov/26214739/) / [DOI](https://doi.org/10.1123/jab.2014-0301)
  2. Krause Neto W, Soares EG, Vieira TL, Aguiar R, Chola TA, Sampaio VL, Gama EF. (2020). *Gluteus maximus activation during common strength and hypertrophy exercises: A systematic review.* J Sports Sci Med, 19(1):195–203. [PubMed 32132843](https://pubmed.ncbi.nlm.nih.gov/32132843/)
  3. Collazo García CL, Rueda J, Suárez Luginick B, Navarro E. (2020). *Differences in the electromyographic activity of lower-body muscles in hip thrust variations.* J Strength Cond Res, 34(9):2449–2455. [DOI](https://doi.org/10.1519/JSC.0000000000002859)
  4. Kennedy D, Casebolt JB, Farren GL, Fiaud V, Bartlett M, Strong L. (2024). *Electromyographic differences of the gluteus maximus, gluteus medius, biceps femoris, and vastus lateralis between the barbell hip thrust and barbell glute bridge.* Sports Biomech, 23(12):2935–2949. [PubMed 35586943](https://pubmed.ncbi.nlm.nih.gov/35586943/) / [DOI](https://doi.org/10.1080/14763141.2022.2074875)
- **可比較量化結果**
  - Contreras et al. (2015, n=13 有訓練女性，估計 10RM)：
    - **上臀大肌平均 EMG**：臀推 **69.5% MVIC** vs 背蹲 **29.4% MVIC**（顯著較高）。
    - **下臀大肌平均 EMG**：臀推 **86.8% MVIC** vs 背蹲 **45.4% MVIC**（顯著較高）。
    - **股二頭肌平均 EMG**：臀推 **40.8% MVIC** vs 背蹲 **14.9% MVIC**（顯著較高）。
    - **股外側肌平均 EMG**：臀推 99.5% vs 背蹲 110% MVIC（無顯著差異）。
  - Collazo García et al. (2020)：臀推時**腳放得較遠（feet-away，膝伸角度較大／屈曲角度較小）**顯著提高股二頭肌與半腱肌等膕繩肌活動；臀中肌無顯著改變。
- **可檢驗趨勢**
  - 臀推臀大肌活動 > 高槓深蹲（Contreras 2015, n=13）。
  - 臀推腳放遠（`kneeTop = 70°`）膕繩肌活動 > 腳放近（`kneeTop = 120°`）（Collazo García 2020）。

### 13. `glute-bridge` 槓鈴臀橋

- **可靠研究來源**
  1. Kennedy D, Casebolt JB, Farren GL, Fiaud V, Bartlett M, Strong L. (2024). *Electromyographic differences of the gluteus maximus, gluteus medius, biceps femoris, and vastus lateralis between the barbell hip thrust and barbell glute bridge.* Sports Biomech, 23(12):2935–2949. [PubMed 35586943](https://pubmed.ncbi.nlm.nih.gov/35586943/) / [DOI](https://doi.org/10.1080/14763141.2022.2074875)
- **可比較量化結果**
  - Kennedy et al. (2024, n=10 男性)：
    - **槓鈴臀橋（BGB）**在上下臀大肌的峰值與平均 EMG，以及臀中肌平均 EMG 均**顯著高於槓鈴臀推（BHT）**。
    - **槓鈴臀推（BHT）**在**股外側肌**的峰值與平均 EMG 則**顯著高於槓鈴臀橋（BGB）**（因行程與小腿角度差異）。
- **可檢驗趨勢**
  - 臀推股四頭肌（`vasti`）活化 > 槓鈴臀橋（Kennedy 2024, n=10）。
  - 槓鈴臀橋臀大肌活化 ≥ 臀推（Kennedy 2024, n=10；本模型依 Contreras 2015 作者摘錄與 Kennedy 2024 ResearchGate 摘要設為 `BAR_RATIO.hipthrust = 1.7`、`BAR_RATIO.glutebridge = 1.83`〔註：兩篇負重公斤數皆未能從期刊付費全文核對〕，可藉此檢驗模型幾何、地板支撐與肌肉長度假設）。

---

## 三、水平推（Horizontal Push）

### 14. `bench` 臥推（平板）

- **可靠研究來源**
  1. Lehman GJ. (2005). *The influence of grip width and forearm pronation/supination on upper-body myoelectric activity during the flat bench press.* J Strength Cond Res, 19(3):587–591. [PubMed 16095407](https://pubmed.ncbi.nlm.nih.gov/16095407/) / [DOI](https://doi.org/10.1519/R-15024.1)
  2. Saeterbakken AH, Mo DA, Scott S, Andersen V. (2017). *The effects of bench press variations in competitive athletes on muscle activity and performance.* J Hum Kinet, 57:61–71. [PubMed 28713459](https://pubmed.ncbi.nlm.nih.gov/28713459/) / [DOI](https://doi.org/10.1515/hukin-2017-0047)
  3. Rodríguez-Ridao D, Antequera-Vique JA, Martín-Fuentes I, Muyor JM. (2020). *Effect of five bench inclinations on the electromyographic activity of the pectoralis major, anterior deltoid, and triceps brachii during the bench press exercise.* Int J Environ Res Public Health, 17(19):7339. [DOI](https://doi.org/10.3390/ijerph17197339)（PMCID: PMC7579505）
- **可比較量化結果**
  - Rodríguez-Ridao et al. (2020, 60% 1RM)：**0° 平板臥推**在胸大肌中下束（胸骨部）產生最高 EMG，且整體胸大肌與前三角肌比例均衡。
  - Saeterbakken et al. (2017, 競技運動員)：寬握與中握的 6RM 重量比窄握高 **5.8%–11.1%**。
- **可檢驗趨勢**
  - 平板臥推（0°）中下胸（`pecs`）活化 > 上斜 30°（Rodríguez-Ridao 2020；Lauver 2016）。

### 15. `incline-bench` 上斜臥推

- **可靠研究來源**
  1. Lauver JD, Cayot TE, Scheuermann BW. (2016). *Influence of bench angle on upper extremity muscular activation during bench press exercise.* Eur J Sport Sci, 16(3):309–316. [PubMed 25799093](https://pubmed.ncbi.nlm.nih.gov/25799093/) / [DOI](https://doi.org/10.1080/17461391.2015.1022605)
  2. Rodríguez-Ridao D et al. (2020). *Effect of five bench inclinations on the electromyographic activity of the pectoralis major, anterior deltoid, and triceps brachii during the bench press exercise.* Int J Environ Res Public Health, 17(19):7339. [DOI](https://doi.org/10.3390/ijerph17197339)
- **可比較量化結果**
  - Rodríguez-Ridao et al. (2020, 比較 0°、15°、30°、45°、60°)：
    - **上胸（鎖骨部胸大肌）**：於 **30° 上斜**達最大 EMG（30° 與 45° 顯著高於 0° 平板）。
    - **前三角肌**：隨角度遞增，於 60° 達最高（30°／45° 顯著高於 0°）。
    - **中下胸（胸骨部）**：0° 平板高於 30°／45°／60°。
    - **三頭肌**：各角度之間相近。
  - Lauver et al. (2016) 亦證實上斜 30°–45° 增加鎖骨部胸大肌與前三角肌活化、降低胸骨部比例。
- **可檢驗趨勢**
  - 30° 上斜臥推上胸（`pecc`）活化 > 0° 平板臥推（Rodríguez-Ridao 2020；Lauver 2016）。
  - 30° 上斜臥推前三角肌（`adelt`）活化 > 0° 平板臥推（Rodríguez-Ridao 2020）。

### 16. `cg-bench` 窄握臥推

- **可靠研究來源**
  1. Lehman GJ. (2005). *The influence of grip width and forearm pronation/supination on upper-body myoelectric activity during the flat bench press.* J Strength Cond Res, 19(3):587–591. [PubMed 16095407](https://pubmed.ncbi.nlm.nih.gov/16095407/) / [DOI](https://doi.org/10.1519/R-15024.1)
  2. Saeterbakken AH et al. (2017). *The effects of bench press variations in competitive athletes on muscle activity and performance.* J Hum Kinet, 57:61–71. [PubMed 28713459](https://pubmed.ncbi.nlm.nih.gov/28713459/) / [DOI](https://doi.org/10.1515/hukin-2017-0047)
- **可比較量化結果**
  - Lehman (2005, 等長平板臥推測試寬、中、窄握)：從寬握移至**窄握**時，**肱三頭肌肌電活動顯著增加**，同時**胸骨部（中下胸）胸大肌顯著下降**。
  - Saeterbakken et al. (2017) 補充：在競技運動員 6RM 動態測試中，窄握與寬握於胸大肌總 EMG 差異不大，但窄握負重能力低 5.8%–11.1% 且肱二頭肌穩定需求較低。
- **可檢驗趨勢**
  - 窄握臥推（`grip: 0.9, flare: 35`）肱三頭肌（`trilat`）活化 > 標準寬握（`grip: 1.6, flare: 52`）（Lehman 2005）。
  - 窄握臥推中下胸（`pecs`）活化 < 標準寬握（Lehman 2005）。

### 17. `floor-press` 地板臥推

- **可靠研究來源**
  - **動態 EMG／逆動力學直接比較研究：未找到**（PubMed 缺乏將動態槓鈴地板臥推與平板臥推直接對比的 EMG 或關節力矩研究）。
  - **相關參考（等長力量信效度研究）**：*Isometric floor press: A valid, reliable, and practical field-based assessment of upper-body strength.* J Strength Cond Res (2026). [DOI](https://doi.org/10.1519/JSC.0000000000005585)
- **可比較量化結果**
  - 實務與力學推論（參考縮短行程／板推文獻）：地板阻擋上臂下降，減少肩水平外展末端行程（減少胸大肌最拉長區段負荷）並排除下肢驅動；因無直接動態 EMG 對照數據，暫不列為文獻趨勢自動測試。

### 18. `chest-press` 坐姿胸推機

- **可靠研究來源**
  1. McCaw ST, Friday JJ. (1994). *A comparison of muscle activity between a free weight and machine bench press.* J Strength Cond Res, 8(4):259–264.（早期 NSCA 期刊未配發 PMID／DOI，為經典基準研究）
  2. Schick EE, Coburn JW, Brown LE, Judelson DA, Khamoui AV, Tran TT, Uribe BP. (2010). *A comparison of muscle activation between a Smith machine and free weight bench press.* J Strength Cond Res, 24(3):779–784. [PubMed 20093960](https://pubmed.ncbi.nlm.nih.gov/20093960/) / [DOI](https://doi.org/10.1519/JSC.0b013e3181cc2237)
  3. Saeterbakken AH, van den Tillaar R, Fimland MS. (2011). *A comparison of muscle activity and 1-RM strength of three chest-press exercises with different stability requirements.* J Sports Sci, 29(5):533–538. [PubMed 21225489](https://pubmed.ncbi.nlm.nih.gov/21225489/) / [DOI](https://doi.org/10.1080/02640414.2010.543916)
- **可比較量化結果**
  - Schick et al. (2010, 70% 與 90% 1RM)：自由槓鈴臥推之**三角肌中束**（穩定肌）活動顯著高於史密斯機臥推；**胸大肌與前三角肌**在兩者間無顯著差異。
  - Saeterbakken et al. (2011, 比較史密斯機、槓鈴、啞鈴 1RM)：穩定度越高的導軌器械（史密斯機），三頭肌與胸大肌主動發力表現穩定，不需額外穩定肌（如二頭肌在啞鈴中較高）。
  - **說明**：直接比較「坐姿插銷／掛片胸推機（特別是直線軌跡 vs 內聚弧線軌跡）」與自由臥推之同儕審查 EMG 文獻較稀缺，多以史密斯機／固定軌跡胸推推論。
- **可檢驗趨勢**
  - 坐姿胸推機胸大肌與三頭肌為主要動肌；與自由平板臥推相比，同等相對參數下胸大肌活化處於同量級（Schick 2010）。

### 18b. `pec-deck` 蝴蝶機

- **可靠研究來源**
  1. Rocha Júnior VA, Gentil P, Oliveira E, do Carmo J. (2007). *Comparison among the EMG activity of the pectoralis major, anterior deltoidis and triceps brachii during the bench press and peck deck exercises.* Rev Bras Med Esporte, 13(1):43–46. [DOI](https://doi.org/10.1590/S1517-86922007000100012)
  2. Gentil P, Oliveira E, de Araújo Rocha Júnior V, do Carmo J, Bottaro M. (2007). *Effects of exercise order on upper-body muscle activation and exercise performance.* J Strength Cond Res, 21(4):1082–1086. [PubMed 18076251](https://pubmed.ncbi.nlm.nih.gov/18076251/)
  3. Welsch EA, Bird MJ, Mayhew JL. (2005). *Electromyographic activity of the pectoralis major and anterior deltoid muscles during three upper-body lifts.* J Strength Cond Res, 19(2):449–452. [PubMed 15903389](https://pubmed.ncbi.nlm.nih.gov/15903389/)
  4. Solstad TE, Andersen V, Shaw M, Hoel EM, Vonheim A, Saeterbakken AH. (2020). *A comparison of muscle activation between barbell bench press and dumbbell flyes in resistance-trained males.* J Sports Sci Med, 19(4):645–651. [PubMed 33239937](https://pubmed.ncbi.nlm.nih.gov/33239937/)
  5. Ackland DC, Pak P, Richardson M, Pandy MG. (2008). *Moment arms of the muscles crossing the anatomical shoulder.* J Anat, 213(4):383–390. [PubMed 18691376](https://pubmed.ncbi.nlm.nih.gov/18691376/)
- **可比較量化結果**
  - Rocha Júnior et al. (2007, 10RM)：蝴蝶機與平板臥推在**胸大肌**與**前三角肌**之 EMG 無顯著差異，但平板臥推之**肱三頭肌** EMG 顯著高於蝴蝶機；蝴蝶機內胸大肌與前三角肌顯著高於三頭肌。
  - Solstad et al. (2020, 6RM 啞鈴飛鳥 vs 槓鈴臥推)：飛鳥類動作以水平內收為主，三頭肌參與大幅降低，而保持微彎肘角時**肱二頭肌**活化高於臥推（57%–86%）。
  - **握把式 vs 前臂墊式**：同儕審查期刊中直接比較握把式與前臂墊式蝴蝶機之 EMG 全文**未找到**；由機構力學推論，握把式需屈肘肌等長維持微彎肘角，前臂墊式阻力垂直於屈肘平面而大幅減少屈肘肌需求。
- **可檢驗趨勢**
  - 平板臥推肱三頭肌（`trilat`）活化 > 蝴蝶機（Rocha Júnior 2007, direct）。
  - 蝴蝶機握把式（`style: 'handle'`）屈肘肌群（`brach`）活化 > 前臂墊式（`style: 'pad'`）（力學／解剖推論）。

### 18c. `cable-fly-high`／`cable-fly-mid`／`cable-fly-low` 滑輪夾胸（高位／中位／低位）

- **可靠研究來源**
  1. Lee HM. (2019). *Force direction and arm position affect contribution of clavicular and sternal parts of pectoralis major muscle during muscle strength testing.* J Hand Ther, 32(1):71–79. [PubMed 28943236](https://pubmed.ncbi.nlm.nih.gov/28943236/)
  2. Ackland DC, Pak P, Richardson M, Pandy MG. (2008). *Moment arms of the muscles crossing the anatomical shoulder.* J Anat, 213(4):383–390. [PubMed 18691376](https://pubmed.ncbi.nlm.nih.gov/18691376/)
  3. Signorile JF, Rendos NK, Heredia Vargas HH, Alipio TC, Regis RC, Eltoukhy MM, Nargund RS, Romero MA. (2017). *Differences in muscle activation and kinematics between cable-based and selectorized weight training.* J Strength Cond Res, 31(2):313–322. [PubMed 28129277](https://pubmed.ncbi.nlm.nih.gov/28129277/)
  4. Rodríguez-Ridao D et al. (2020). [DOI](https://doi.org/10.3390/ijerph17197339)；Lauver JD et al. (2016). [PubMed 25799093](https://pubmed.ncbi.nlm.nih.gov/25799093/)
- **可比較量化結果**
  - **直接比較動態高／中／低三檔滑輪夾胸之同儕審查期刊全文：未找到**。
  - Lee (2019, 橫斷面等長測試)：比較水平、上斜 +30° 與下斜 -30° 施力方向對胸大肌鎖骨部與胸骨部之貢獻，顯示**上斜 +30° 方向**結合肩外旋 45° 最能區分鎖骨部（上胸）與胸骨部（中下胸），兩部仍高度協同。
  - Ackland et al. (2008, 解剖力臂量測)：胸大肌鎖骨部具顯著較大的肩屈曲力臂（71° 時達 53.7 mm），胸骨中下束則屈曲力臂甚小且具肩內收／下壓傾向，從力學結構支持低位往上偏上胸、高位往下偏中下胸。
- **可檢驗趨勢**
  - 高位滑輪夾胸（`height: 'high'`）中下胸（`pecs`）活化 > 低位滑輪夾胸（`height: 'low'`）（Lee 2019；Ackland 2008；Rodríguez-Ridao 2020，indirect）。
  - 低位滑輪夾胸（`height: 'low'`）上胸（`pecc`）活化 > 高位滑輪夾胸（`height: 'high'`）（Lee 2019；Ackland 2008；Rodríguez-Ridao 2020，indirect）。

---

## 四、垂直推（Vertical Push）

### 19. `ohp` 站姿肩推

- **可靠研究來源**
  1. Saeterbakken AH, Fimland MS. (2013). *Effects of body position and loading modality on muscle activity and strength in shoulder presses.* J Strength Cond Res, 27(7):1824–1831. [PubMed 23096062](https://pubmed.ncbi.nlm.nih.gov/23096062/) / [DOI](https://doi.org/10.1519/JSC.0b013e318276b873)
- **可比較量化結果**
  - Saeterbakken & Fimland (2013, 比較站姿／坐姿 × 槓鈴／啞鈴 4 種肩推 1RM 與 EMG)：
    - **站姿**比坐姿需要更高全身穩定度，**三角肌（前、中、後束）**肌電活動顯著較高。
    - 槓鈴肩推之**肱三頭肌與肱二頭肌**活動高於啞鈴肩推，且可舉起之 1RM 重量高於站姿啞鈴。
- **可檢驗趨勢**
  - 站姿肩推主要動肌為**前三角肌（`adelt`）、肱三頭肌（`trilat`）與上斜方肌（`uptrap`）**；軀幹過度後仰（`lean` 增加）會使推舉方向偏向水平／上斜，使上胸（`pecc`）參與增加且下背負荷上升。

---

## 五、水平拉（Horizontal Pull）

### 20. `row` 槓鈴划船（正握）

- **可靠研究來源**
  1. Fenwick CMJ, Brown SHM, McGill SM. (2009). *Comparison of different rowing exercises: trunk muscle activation and lumbar spine motion, load, and stiffness.* J Strength Cond Res, 23(2):350–358. [PubMed 19197209](https://pubmed.ncbi.nlm.nih.gov/19197209/) / [DOI](https://doi.org/10.1519/JSC.0b013e3181942019)
  2. Saeterbakken A, Andersen V, Brudeseth A, Lund H, Fimland MS. (2015). *The effect of performing bi- and unilateral row exercises on core muscle activation.* Int J Sports Med, 36(11):900–905. [PubMed 26134664](https://pubmed.ncbi.nlm.nih.gov/26134664/) / [DOI](https://doi.org/10.1055/s-0034-1398646)
  3. Fischer J et al. (2025). *Impact of different ranges of motion in the prone barbell row on muscle excitation.* J Electromyogr Kinesiol, 83:103025. [PubMed 40513198](https://pubmed.ncbi.nlm.nih.gov/40513198/) / [DOI](https://doi.org/10.1016/j.jelekin.2025.103025)
- **可比較量化結果**
  - Fenwick et al. (2009, n=7 健康男性)：比較站姿俯身槓鈴划船、單臂滑輪划船與仰臥懸吊划船（inverted row）；**俯身槓鈴划船在對稱刺激上背與下背的同時，對腰椎產生顯著最高之壓迫力、剪力與伸展力矩**。
  - Saeterbakken et al. (2015)：自由重量俯身划船之豎脊肌與多裂肌活化顯著高於坐姿滑輪划船或器械划船。
- **可檢驗趨勢**
  - 站姿槓鈴划船腰椎伸展力矩（`trunkExt`）> 坐姿滑輪划船（Fenwick 2009；Saeterbakken 2015）。

### 21. `row-sup` 槓鈴划船（反握）

- **可靠研究來源**
  - **直接比較俯身槓鈴正握 vs 反握之期刊全文：未找到**。
  - **間接參考（前臂旋前／旋後對屈肘協同肌之影響）**：
    - Kleiber T, Kunz L, Disselhorst-Klug C. (2015). *Muscular coordination of biceps brachii and brachioradialis in elbow flexion with respect to hand position.* Front Physiol, 6:215. [PubMed 26300781](https://pubmed.ncbi.nlm.nih.gov/26300781/) / [DOI](https://doi.org/10.3389/fphys.2015.00215)（註：該單關節屈肘研究顯示**二頭肌 EMG 在旋前／中立／旋後間無顯著差異**，僅肱橈肌於旋前顯著較高。）
- **可檢驗趨勢**
  - 目前缺乏直接文獻證明「反握槓鈴划船肱二頭肌 EMG > 正握」；反握較利於肱二頭肌發力屬**解剖推論**（旋前時二頭肌屈肘力臂效率下降），非直接實測文獻結果。

### 22. `cable-row` 坐姿滑輪划船 & 23. `cable-row-wide` 坐姿滑輪划船（寬握）

- **可靠研究來源**
  1. Lehman GJ, Buchan DD, Lundy A, Myers N, Nalborczyk A. (2004). *Variations in muscle activation levels during traditional latissimus dorsi weight training exercises: An experimental study.* Dyn Med, 3(1):4. [PubMed 15228624](https://pubmed.ncbi.nlm.nih.gov/15228624/) / [DOI](https://doi.org/10.1186/1476-5918-3-4)
  2. de Abreu Vasconcelos CMW, Lopes CR, Almeida VM, Krause Neto W, Soares EG. (2023). *Effect of different grip position and shoulder-abduction angle on muscle strength and activation during the seated cable row.* Int J Strength Cond, 3(1). [DOI](https://doi.org/10.47206/ijsc.v3i1.190)
  3. Padovan R, Cè E, Longo S, Tornatore G, Trentin C, Esposito F, Coratella G. (2025). *High-density surface electromyography excitation of prime movers in the narrow vs. wide grip seated row exercise.* J Hum Kinet. [DOI](https://doi.org/10.5114/jhk/209550)
- **可比較量化結果**
  - Lehman et al. (2004)：坐姿划船呈現高「背闊肌／二頭肌」活化比，中斜方肌與菱形肌皆高度活化；刻意強調額外肩胛後收並未顯著再提高中斜方肌峰值 EMG。
  - de Abreu Vasconcelos et al. (2023, n=21：11 男 10 女，等長與動態測試)：比較的是**接近 0° 外展之正握（PRO）／反握（SUP）／對握（NEU）**與**肩外展 30°／60°／90°**（研究**未測試 V 把**亦未直接標稱窄 vs 寬握）：
    - **肩外展角增加（60°、90°）**：**三角肌後束、上斜方肌、中斜方肌**活化上升，但**背闊肌（上下束）與峰值力下降**。
    - **肩外展角接近 0°（PRO、SUP、NEU）**：**峰值力**與**背闊肌（上下束）**活化較高。
  - Padovan et al. (2025, n=14 有重訓經驗男性，8RM，HD-sEMG)：直接比較**窄握（narrow-SR）vs 寬握（wide-SR）**坐姿划船：
    - **窄握**：**背闊肌**在向心與離心期之 EMG 振幅均顯著較高（ES = 1.08）。
    - **寬握**：**上斜方肌**（向心 ES = 1.35／離心 ES = 2.79）、**中斜方肌**（ES = 1.24／1.44）、**下斜方肌**（ES = 0.90／0.71）、**中／側三角肌**（ES = 1.03／0.58）與**離心期豎脊肌**（ES = 0.65）顯著較高。（註：摘要**未顯示後三角肌振幅較高**，僅報告離心期激發重心偏移。）
- **可檢驗趨勢**
  - 寬握／高肩外展坐姿滑輪划船（`grip: 'wide'`）三角肌後束（`pdelt`）活化 > 窄握低外展（`grip: 'v'`）（間接來自 de Abreu Vasconcelos 2023 肩外展角 60°–90° > 0° 結果；不歸因於 Padovan 2025）。
  - 窄握低外展坐姿滑輪划船（`grip: 'v'`）背闊肌（`lat`）活化 > 寬握高外展（`grip: 'wide'`）（Padovan 2025, n=14, ES=1.08；de Abreu Vasconcelos 2023, n=21，低外展角背闊較高）。

---

## 六、垂直拉（Vertical Pull）

### 24. `uprow` 直立划船

- **可靠研究來源**
  1. McAllister MJ, Schilling BK, Hammond KG, Weiss LW, Farney TM. (2013). *Effect of grip width on electromyographic activity during the upright row.* J Strength Cond Res, 27(1):181–187. [PubMed 22362088](https://pubmed.ncbi.nlm.nih.gov/22362088/) / [DOI](https://doi.org/10.1519/JSC.0b013e31824f23ad)
- **可比較量化結果**
  - McAllister et al. (2013, n=16 有重訓經驗男性，以 100% 肩峰寬 1RM 的 85% 測試 **50%、100%、200% 肩峰寬 [BAB]** 握距；量測肌群為**前三角肌 [AD]、側三角肌 [LD]、後三角肌 [PD]、上斜方肌 [UT]、中斜方肌 [MT]、肱二頭肌 [BB]**)：
    - **側三角肌（LD）**：向心期（50% vs 200%、100% vs 200% BAB）與離心期（所有兩兩比較）均隨握距加寬顯著增加（p < 0.001）。
    - **後三角肌（PD）**：向心期（50% vs 200%、100% vs 200% BAB）隨握距加寬顯著增加（p < 0.001）。
    - **前三角肌（AD）**：離心期整體變異數分析達顯著（p = 0.023）。
    - **上斜方肌（UT）與中斜方肌（MT）**：**僅離心期**達顯著（UT 全部兩兩比較顯著，p < 0.001；MT 於 50% vs 200%、100% vs 200% BAB 顯著，p < 0.001；向心期未達顯著）。
    - **肱二頭肌（BB）**：隨握距加寬下降，但事後比較**僅離心期 50% vs 200% BAB** 達統計顯著（p = 0.003；向心期未達顯著）。
- **可檢驗趨勢**
  - 直立划船寬握（`grip = 1.5`）側／中三角肌（`mdelt`）活化 > 窄握（`grip = 0.7`）（McAllister 2013, n=16，向心與離心皆顯著，強證據）。
  - 直立划船寬握（`grip = 1.5`）上斜方肌（`uptrap`）活化 > 窄握（`grip = 0.7`）（McAllister 2013, n=16，**僅離心期顯著**，向心期不顯著）。
  - 直立划船窄握（`grip = 0.7`）肱二頭肌（`bic`）活化 > 寬握（`grip = 1.5`）（McAllister 2013, n=16，**僅離心期 50% vs 200% BAB 顯著**）。

### 25. `pulldown` 滑輪下拉 & 26. `pulldown-sup` 反握滑輪下拉

- **可靠研究來源**
  1. Signorile JF, Zink AJ, Szwed SP. (2002). *A comparative electromyographical investigation of muscle utilization patterns using various hand positions during the lat pull-down.* J Strength Cond Res, 16(4):539–546. [PubMed 12423182](https://pubmed.ncbi.nlm.nih.gov/12423182/)
  2. Lehman GJ et al. (2004). *Variations in muscle activation levels during traditional latissimus dorsi weight training exercises: An experimental study.* Dyn Med, 3(1):4. [PubMed 15228624](https://pubmed.ncbi.nlm.nih.gov/15228624/) / [DOI](https://doi.org/10.1186/1476-5918-3-4)
  3. Lusk SJ, Hale BD, Russell DM. (2010). *Grip width and forearm orientation effects on muscle activity during the lat pull-down.* J Strength Cond Res, 24(7):1895–1900. [PubMed 20543740](https://pubmed.ncbi.nlm.nih.gov/20543740/) / [DOI](https://doi.org/10.1519/JSC.0b013e3181ddb0ab)
  4. Andersen V, Fimland MS, Wiik E, Skoglund A, Saeterbakken AH. (2014). *Effects of grip width on muscle strength and activation in the lat pull-down.* J Strength Cond Res, 28(4):1135–1142. [PubMed 24662157](https://pubmed.ncbi.nlm.nih.gov/24662157/) / [DOI](https://doi.org/10.1097/JSC.0000000000000232)
- **可比較量化結果**
  - Lusk et al. (2010, n=12 健康男性，70% 1RM，2 種握距 × 正／反握)：
    - **正握（pronated）之背闊肌 EMG 顯著高於反握（supinated）**（p < 0.05），無論寬握或窄握皆然。
    - 握距本身對背闊肌、中斜方肌與二頭肌均無顯著主效應。
    - 該研究只報告肌電，**沒有量測手肘軌跡或上臂平面**。目前模型以反握手肘較靠前且貼近身體、正握手肘較向外為運動學推論；它只決定反向運動學的手肘方向，不是 Lusk 實測的角度。Ronai (2019) 的[動作教學與照片](https://doi.org/10.1249/FIT.0000000000000469)展示正握與反握下拉，但同樣未量化兩者的平面差異。
  - Andersen et al. (2014, 比較 1.0×、1.5×、2.0× 肩峰寬正握 6RM)：
    - 窄握與中握（1.0×、1.5×）可拉起之 6RM 重量高於寬握（2.0×）。
    - 三種握距之間，**背闊肌整體 EMG 大致相近**（差異小）。
- **可檢驗趨勢**
  - 滑輪下拉正握（`supin: 'pro'`）背闊肌（`lat`）活化 > 反握（`supin: 'sup'`）（Lusk 2010, n=12）。
  - 反握滑輪下拉肱二頭肌（`bic`）活化 > 正握（本模型 `adjust` 假設；註：Lusk 2010 與 Lehman 2004 中二頭肌差異未達統計顯著，可一併紀錄對照）。

---

## 七、單關節（Isolation）

### 27. `leg-ext` 腿伸機

- **可靠研究來源**
  1. Escamilla RF et al. (1998). *Biomechanics of the knee during closed kinetic chain and open kinetic chain exercises.* Med Sci Sports Exerc, 30(4):556–569. [PubMed 9565938](https://pubmed.ncbi.nlm.nih.gov/9565938/)
  2. Folland JP, Morris B. (2008). *Variable-cam resistance training machines: do they match the angle-torque relationship in humans?* J Sports Sci, 26(2):163–169. [PubMed 17885926](https://pubmed.ncbi.nlm.nih.gov/17885926/) / [DOI](https://doi.org/10.1080/02640410701370663)
- **可比較量化結果**
  - Escamilla et al. (1998, n=10)：
    - 開放鏈坐姿腿伸機之**股四頭肌 EMG 峰值出現在接近完全伸直端**（與深蹲／腿推機在深屈端達到峰值相反）。
    - 開放鏈腿伸機比閉鏈深蹲更強調**股直肌（rectus femoris）**；僅在腿伸機末端伸直（30°–0°）測得顯著 ACL 張力。
  - Folland & Morris (2008)：人體膝伸肌力矩－角度曲線呈倒 U 型（峰值在膝屈 60°–80°，近伸直端急劇下降約 -60%）；市售 8 台可變凸輪腿伸機阻力曲線普遍較平緩，未完整貼合人體曲線（詳見 [`docs/machine-data.md`](machine-data.md)）。
- **可檢驗趨勢**
  - 無凸輪槓桿腿伸機（`cam: 'gravity'`）於接近伸直端之膝伸力矩 > 彎曲端（與深蹲深屈端 > 淺屈端相反；Escamilla 1998）。
  - 開放鏈腿伸機股直肌相對於股廣肌的參與比例（`rf / vasti`）高於閉鏈深蹲（Escamilla 1998）。

### 28. `leg-curl` 坐姿腿彎舉 & 29. `lying-leg-curl` 俯臥腿彎舉

- **可靠研究來源**
  1. Maeo S, Huang M, Wu Y, Sakurai H, Kusagawa Y, Sugiyama T, Kanehisa H, Isaka T. (2021). *Greater hamstrings muscle hypertrophy but similar damage protection after training at long versus short muscle lengths.* Med Sci Sports Exerc, 53(4):825–837. [PubMed 33009197](https://pubmed.ncbi.nlm.nih.gov/33009197/)
  2. McAllister MJ et al. (2014). *Muscle activation during various hamstring exercises.* J Strength Cond Res, 28(6):1573–1580. [PubMed 24149748](https://pubmed.ncbi.nlm.nih.gov/24149748/) / [DOI](https://doi.org/10.1519/JSC.0000000000000302)
- **可比較量化結果**
  - Maeo et al. (2021, n=20 健康成人，單腳內對照 12 週訓練，70% 1RM、5 組 × 10 下、每週 2 次，MRI 量測肌肉體積)：
    - **整體膕繩肌體積增長**：坐姿腿彎舉 **+14%** 顯著高於俯臥腿彎舉 **+9%**。
    - **雙關節膕繩肌（股二頭肌長頭、半腱肌、半膜肌）**：坐姿 +8%～+24% vs 俯臥 +4%～+19%（因坐姿髖屈曲讓雙關節膕繩肌處於較長肌肉長度）。
    - **單關節股二頭肌短頭**：兩組相近（約 +10% vs +9%）。
- **可檢驗趨勢**
  - 坐姿腿彎舉（`posture: 'seated'`）全行程膕繩肌正規化長度 `l` > 俯臥腿彎舉（`posture: 'lying'`）（Maeo 2021, n=20）。

### 30. `pushdown` 滑輪三頭下壓

- **可靠研究來源**
  1. Maeo S, Wu Y, Huang M, Sakurai H, Kusagawa Y, Sugiyama T, Kanehisa H, Isaka T. (2023). *Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position.* Eur J Sport Sci, 23(7):1240–1250. [PubMed 35819335](https://pubmed.ncbi.nlm.nih.gov/35819335/) / [DOI](https://doi.org/10.1080/17461391.2022.2100279)
  2. Hussain J, Sundaraj K, Subramaniam ID, Lam CK. (2020). *Muscle fatigue in the three heads of triceps brachii during intensity and speed variations of triceps push-down exercise.* Front Physiol, 11:112. [PubMed 32153422](https://pubmed.ncbi.nlm.nih.gov/32153422/) / [DOI](https://doi.org/10.3389/fphys.2020.00112)
- **可比較量化結果**
  - Maeo et al. (2023, n=21 成人，12 週單手臂內對照設計，70% 1RM、10 下 × 5 組、每週 2 次，MRI 量測肌肉體積)：上臂中立位（近似三頭下壓）訓練雙關節三頭肌長頭時處於較短長度；與中立位相比，過頭伸肘（長頭拉長）在**三頭肌長頭（+28.5% vs +19.6%，1.5 倍）、外側＋內側頭（+14.6% vs +10.5%，1.4 倍）與整體三頭肌（+19.9% vs +13.9%，1.4 倍）**之肌肥大皆顯著較大（儘管過頭位絕對訓練負重低 34%–39%）。
  - Hussain et al. (2020, n=25)：三頭下壓可同步活化三頭肌三頭，且外側頭與內側頭隨負荷與速度變化出現顯著疲勞特徵。
- **可檢驗趨勢**
  - 三頭下壓時，手肘前移（`elbFwd` 增加）使肩屈曲角上升，三頭肌長頭（`trilong`）被拉長，且肩伸肌（`lat`）穩定需求改變（Maeo 2023, n=21 長度力學）。

### 31. `curl` 槓鈴彎舉 & 32. `reverse-curl` 反手彎舉

- **可靠研究來源**
  1. Oliveira AS, Gonçalves M. (2009). *Positioning during resistance elbow flexor exercise affects electromyographic activity, heart rate, and perceived exertion.* J Strength Cond Res, 23(3):854–862. [PubMed 19387393](https://pubmed.ncbi.nlm.nih.gov/19387393/) / [DOI](https://doi.org/10.1519/JSC.0b013e3181a00c25)
  2. Kleiber T, Kunz L, Disselhorst-Klug C. (2015). *Muscular coordination of biceps brachii and brachioradialis in elbow flexion with respect to hand position.* Front Physiol, 6:215. [PubMed 26300781](https://pubmed.ncbi.nlm.nih.gov/26300781/) / [DOI](https://doi.org/10.3389/fphys.2015.00215)
  3. Marcolin G, Panizzolo FA, Petrone N, Moro T, Grigoletto D, Piccolo D, Paoli A. (2018). *Differences in electromyographic activity of biceps brachii and brachioradialis while performing three variants of curl.* PeerJ, 6:e5165. [PubMed 30013836](https://pubmed.ncbi.nlm.nih.gov/30013836/) / [DOI](https://doi.org/10.7717/peerj.5165)
- **可比較量化結果**
  - Kleiber et al. (2015, n=16 健康受試者，20°/s 單關節屈肘，比較旋後、中立、旋前握法)：**肱二頭肌（biceps brachii）sEMG 活動在三種握法間沒有顯著差異**；僅**肱橈肌（brachioradialis）**於**旋前（正握）**時對屈肘的相對肌電貢獻顯著高於旋後與中立握法（反映二頭肌於旋前處於生物力學劣勢時由肱橈肌代償）。
  - Marcolin et al. (2018)：直槓彎舉與 EZ 曲槓彎舉之二頭肌與肱橈肌向心／離心 EMG 普遍高於啞鈴彎舉。
- **可檢驗趨勢**
  - 槓鈴彎舉反握（`supin: 'sup'`）肱二頭肌（`bic`）活化 > 反手彎舉（`supin: 'pro'`）：**屬解剖推論**（前臂旋前時二頭肌屈肘效率下降；**非文獻實測結果**，Kleiber 2015 實測顯示二頭肌 EMG 在各握法間無顯著差異）。
  - 反手彎舉（`supin: 'pro'`）肱肌／肱橈肌（`brach`）活化 > 槓鈴彎舉（`supin: 'sup'`）（Kleiber 2015, n=16；註：文獻實測為肱橈肌，本模型 `brach` 為肱肌＋肱橈肌合併）。

### 33. `shrug` 槓鈴聳肩

- **可靠研究來源**
  1. Andersen LL, Kjær M, Andersen CH, Hansen PB, Zebis MK, Hansen K, Sjøgaard G. (2008). *Muscle activation during selected strength exercises in women with chronic neck muscle pain.* Phys Ther, 88(6):703–711. [PubMed 18339796](https://pubmed.ncbi.nlm.nih.gov/18339796/) / [DOI](https://doi.org/10.2522/ptj.20070304)
  2. Pizzari T, Wickham J, Balster S, Ganderton C, Watson L. (2014). *Modifying a shrug exercise can facilitate the upward rotator muscles of the scapula.* Clin Biomech, 29(2):201–205. [PubMed 24342452](https://pubmed.ncbi.nlm.nih.gov/24342452/) / [DOI](https://doi.org/10.1016/j.clinbiomech.2013.11.011)
- **可比較量化結果**
  - Andersen et al. (2008)：標準聳肩動作可誘發極高的**上斜方肌活化（102 ± 11% MVC）**。
  - Pizzari et al. (2014)：比較標準 0° 外展聳肩與改良 30° 外展上旋聳肩，顯示改良聳肩能進一步提高上斜方肌與下斜方肌活動；標準聳肩則以上斜方肌為絕對主導。
- **可檢驗趨勢**
  - 槓鈴聳肩中，上斜方肌（`uptrap`）為顯著最高活化之肩胛／上肢動肌（Andersen 2008）；軀幹前傾（`lean` 增加）時，抵抗重力方向朝向肩胛後收，使中斜方肌（`midtrap`）參與上升。

### 34–41. E 階段器械與自體重量動作

- **反向蝴蝶機**：肩關節肌肉力臂參考 [Ackland et al. 2008](https://pubmed.ncbi.nlm.nih.gov/18691376/)；未查證同機型握把阻力、凸輪曲線或直接肌電比較。
- **45° 背伸展**：[Andersen et al. 2021](https://pubmed.ncbi.nlm.nih.gov/33948095/) 比較羅馬椅、羅馬尼亞硬舉與坐姿背伸機的臀大肌、股二頭肌、豎脊肌肌電。研究未比較墊子高度，因此不建立墊高趨勢檢查。
- **哈克深蹲機**：目前僅以 [Escamilla et al. 1998](https://pubmed.ncbi.nlm.nih.gov/9565938/) 的深蹲與腿推閉鎖鏈資料間接說明膝伸肌需求；未查證此哈克機軌道或肌電。
- **器械肩推**：[Saeterbakken & Fimland 2013](https://pubmed.ncbi.nlm.nih.gov/23096062/) 比較肩推身體姿勢及負重型式；未量本模型固定握把軌跡。
- **站姿／坐姿提踵**：[Kinoshita et al. 2023](https://pubmed.ncbi.nlm.nih.gov/38156065/) 於 12 週訓練發現站姿腓腸肌肥大高於坐姿、比目魚肌增長相近；其圖 1 的 OpenSim 推算顯示同一踝角下站姿腓腸肌操作長度較長，此一長度方向列入模型趨勢檢查。肌肥大結果不能直接當成即時肌電或模型活化驗證。[Paz et al. 2021](https://pubmed.ncbi.nlm.nih.gov/33992275/) 的小樣本肌電研究指出站坐姿與踝部被動拉伸條件交互影響腓腸肌兩頭，未支持簡單的「站姿 EMG 一定高於坐姿」規則。
- **臀外展／內收機**：[de Almeida Paz et al. 2022](https://pubmed.ncbi.nlm.nih.gov/35500965/) 量外展機與兩種徒手外展的臀中肌、闊筋膜張肌肌電；未研究內收機或前傾差異。模型沒有臀大肌上束獨立肌束，無法驗證前傾參與趨勢。
