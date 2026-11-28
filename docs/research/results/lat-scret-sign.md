# 背闊肌 scRet 符號診斷（0.14.0 提交版）

診斷用，不改 `src/`。工具：`tools/research/diagnose-lat-scret-sign.mjs`（`decomp`／`rank`／`fit`；變體以執行期覆寫背闊肌力臂，不寫入產品）。合理性與趨勢次數在 `/tmp` 複本加環境變數鉤子取得，不提交。

## 結論

1. **背闊肌 `scRet` 的符號不是上斜方／中斜方進前列的主因。** 把背闊肌 `scRet` 改成 0 或 DAS3 符號，引體、划船、肩推的上斜方仍居首或前二，下拉第一名仍是肩胛下肌，撐體大圓肌仍 3.2～3.6。
2. **主因是背闊肌 `scElev` 力臂放大（−30 → 約 −130 mm）。** 背闊肌的活化由肩內收／伸／內旋需求決定，其 `scElev` 副作用從 −30 mm 變成 −130 mm，產生遠超肩胛下壓需求的下壓力矩，上斜方（`scElev` +70 mm，在這一軸是拮抗肌）必須共收縮抵消。只把背闊肌 `scElev` 退回 −30 mm（`scRet` 仍用 TSM）時，上斜方不再居首（引體 `lowtrap`、划船 `midtrap`）。
3. **符號證據：沒有任何查得的來源直接量過或給出背闊肌對肩胛的前伸／後收作用。** 解剖與生物力學文獻只支持「背闊肌主要作用在肱骨，對肩胛沒有確定的直接附著」，不能裁決符號。TSM 的符號隨姿勢改變（映射 A 與 B 同號），DAS3 全部姿勢皆為正且幾乎不隨姿勢變；幾何上前者較合理，但這是推論，不是證據。

## 1. 逐肌力矩分解（0.14.0，N·m；格式 scElev／scRet）

每個動作取上斜方峰值幀（全程 41 點）。需求為產品 `dem`。完整輸出（含 |scElev| 峰值幀）：`node tools/research/diagnose-lat-scret-sign.mjs decomp tsm`。

| 動作（幀 e） | 需求 | lat | pecs | pecc | uptrap | midtrap | lowtrap | serr | subsc |
|---|---|---|---|---|---|---|---|---|---|
| pullup（0.00） | −87／1 | −160／−21 | −19／−32 | 0／0 | +92／+26 | 0／+27 | 0／1 | 0／−1 | 0／0 |
| pullup-wide（0.00） | −95／12 | −165／−17 | −31／−54 | 0／0 | +103／+29 | 0／+50 | −3／4 | 0／−1 | 0／0 |
| pulldown（0.775） | −59／9 | −124／−26 | −10／−19 | 0／0 | +77／+22 | 0／+30 | −1／2 | 0／0 | 0／0（a 0.39） |
| row（1.00） | +36／+63 | −63／−16 | 0／0 | 0／0 | +101／+29 | 0／+48 | −3／4 | +1／−2 | 0／0 |
| cable-row（0.875） | +27／+22 | −76／−9 | 0／0 | 0／0 | +101／+29 | 0／+10 | 0／0 | +3／−7 | 0／0 |
| ohp（0.025） | +53／1 | −16／−2 | −13／−15 | 0／−2 | +82／+24 | 0／0 | 0／0 | 0／−4 | 0／0 |
| dips（0.95） | −99／−27 | −281／−93 | −53／−112 | 0／0 | +239／+68 | 0／+104 | −5／7 | 0／0 | 0／0 |

讀法：

- **引體、下拉、撐體：** 背闊肌（加胸大肌）的 `scElev` 超出需求 70～180 N·m，上斜方 +77～+239 抵消。其 `scRet` 副作用（上斜方 +22～+29、中斜方另補 +27～+104）只是附帶，淨 `scRet` 幾乎只靠中斜方把背闊肌的 −17～−26 抵消。
- **划船：** 需求是 `scElev` +36、`scRet` +63，背闊肌 `scElev` 為負（拮抗），上斜方 +101 同時補上提需求與抵消背闊肌；背闊肌因此被壓低（a 0.33）。符號相反的 `scRet` 在這裡反而是同向（背闊肌 −16 與需求 +63 反向，需中斜方補）。
- **肩推（ohp e=0.025）：** 背闊肌幾乎不出力（a 0.00）、需求 `scElev` +53 靠上斜方（a 0.80）承擔。這是上斜方本來的功能，與背闊肌符號無關；0.13.1 同動作上斜方為 0.61，增加主因是胸大肌／鎖骨部 `scRet` 與需求重新分配。
- 下拉終點需求 `shRot` 48 N·m：背闊肌只需 a 0.6，內旋改由肩胛下肌分擔（a 0.69～0.79）。

## 2. 敏感度（背闊肌 `scRet`；其餘不變）

變體：**TSM**＝提交版；**0**＝`scRet` 恆 0；**DAS3**＝對 80 個產品姿勢的 DAS3 背闊肌 `scRet`（`scapular-arms-data.json` 的 `das3_scRet`）作同形式二次擬合（+29～+75 mm，RMS 2.5 mm、最大 6.0 mm）；**elev30**＝對照，只把背闊肌 `scElev` 退回 −30 mm、`scRet` 維持 TSM。

| 指標 | main 0.13.1 | TSM（提交） | 0 | DAS3 | elev30（對照） |
|---|---:|---:|---:|---:|---:|
| 失敗規則總數（已知＋未列入） | 50 | 59 | 58（已知 56＋新增 2；另 3 項已通過待移除） | 57（已知 55＋新增 2；另 4 項待移除） | 未跑完整測試 |
| 趨勢通過 | 50/58 | 49/58 | 49/58 | 49/58 | — |
| 下拉握法趨勢（正握 vs 反握，要求正握 >） | 0.829 vs 0.732 ✓ | 0.468 vs 0.492 ✗ | 0.469 vs 0.501 ✗ | 0.470 vs 0.515 ✗ | — |

「0」變體新增：row／row-sup 上斜方 a 1.003。「DAS3」變體新增：dips 前鋸肌 1.06、cable-row-wide 中斜方未進前四。

前四名與 a>1（全程峰值 s／a）：

| 動作 | TSM | 0 | DAS3 | elev30 |
|---|---|---|---|---|
| pullup | uptrap 0.88, brach 0.81, lat 0.77, pecs 0.53 | uptrap 0.86, brach 0.81, lat 0.77, pecs 0.53 | brach 0.81, lat 0.77, uptrap 0.66, serr 0.59 | lat 1.30, lowtrap 1.02, brach 0.81, midtrap 0.73 |
| pullup-wide | uptrap 0.99, pecs 0.87, lat 0.81, midtrap 0.73 | uptrap 0.98, pecs 0.87, lat 0.81, brach 0.73 | pecs 0.88, uptrap 0.83, lat 0.81, brach 0.73 | lat 1.32, lowtrap 1.07, midtrap 1.00, pecs 0.94 |
| pulldown | subsc 0.79, uptrap 0.73, lat 0.61, midtrap 0.52 | subsc 0.77, uptrap 0.72, lat 0.63, ra 0.51 | subsc 0.77, lat 0.64, uptrap 0.57, ra 0.51 | midtrap 0.87, lat 0.84, lowtrap 0.77, ra 0.51 |
| row | uptrap 0.97, pdelt 0.93, midtrap 0.74, erec 0.73 | uptrap 1.00, pdelt 0.85, erec 0.73, midtrap 0.65 | uptrap 0.96, pdelt 0.85, erec 0.73, mdelt 0.63 | midtrap 0.93, erec 0.73, pdelt 0.69, mdelt 0.67 |
| cable-row | uptrap 0.96, brach 0.71, erec 0.70, mdelt 0.54 | uptrap 0.95, brach 0.71, erec 0.70, mdelt 0.54 | uptrap 0.82, brach 0.72, erec 0.70, mdelt 0.55 | erec 0.70, brach 0.66, lat 0.54, mdelt 0.50 |
| ohp | uptrap 0.80, adelt 0.65, trilat 0.62, mdelt 0.46 | 同 TSM | 同 TSM | uptrap 0.66, adelt 0.63, trilat 0.62, mdelt 0.46 |
| dips | pecs 1.52, lat 1.50, tmaj 1.50, midtrap 1.50；a>1 tmaj 3.61、uptrap 2.28、pecs 2.45、lat 1.61 | …tmaj 3.34、uptrap 2.39、pecs 2.52、lat 1.75 | …tmaj 3.24、uptrap 2.10、pecs 2.57、lat 1.83、serr 1.06 | …tmaj 2.97、midtrap 2.43、pecs 2.59、lat 1.87 |

判讀：符號從 TSM 換到 0 或 DAS3，總失敗數只少 1～2 項、趨勢相同、下拉第一名仍是肩胛下肌、大圓肌只從 3.61 降到 3.24～3.34；DAS3 符號只改善引體與坐姿滑輪划船的上斜方（0.88 → 0.66、0.96 → 0.82）。結果受符號影響小於受 `scElev` 力臂影響。肩推上斜方居首不隨 `scRet` 變。

## 3. 符號的獨立證據

### 查得的文獻（PubMed efetch 讀過摘要）

| 文獻 | 內容 | 對符號的意義 |
|---|---|---|
| [Variation in the insertion of the latissimus dorsi & its clinical importance（J Orthop 2013；PMID 24403744）](https://pubmed.ncbi.nlm.nih.gov/24403744/) | 50 具大體；背闊肌起於 T7–T12 棘突、胸腰筋膜、髂嵴、下 3–4 肋與肩胛下角，止於結節間溝底；作用列為肩伸、內收、水平外展、屈（由伸位）與內旋 | 作用清單**沒有**肩胛前伸／後收／下壓 |
| [Significance of the latissimus dorsi for shoulder instability. I（Clin Anat 2005；PMID 16092134）](https://pubmed.ncbi.nlm.nih.gov/16092134/) | 100 具大體；43% 有來自肩胛下角的肌纖維（type 1），57% 只有少量纖維條或中間有滑囊（type 2） | 背闊肌對肩胛的直接附著**因人而異**，多數沒有肌性附著 |
| [The latissimus dorsi creates a dynamic track for the inferior angle of the scapula（J Orthop Surg Res 2024；PMID 38504340）](https://pubmed.ncbi.nlm.nih.gov/38504340/) | CT：背闊肌不直接附著肩胛下角，而是從表面經過；舉臂時肩胛在肌腹下滑動，覆蓋約 20%（手下 2.7%） | 背闊肌對肩胛是**接觸／滑動軌道**，不是明確的肩胛運動肌 |
| [A review of the biomechanical and functional changes in the shoulder following transfer of the latissimus dorsi（Plast Reconstr Surg 2005；PMID 15923857）](https://pubmed.ncbi.nlm.nih.gov/15923857/) | 背闊肌功能為伸、內收、內旋與外旋；移位後缺伸、內收，肩活動度不減 | 同上，不涉及肩胛 |
| [Avoiding high-risk rotator cuff loading: Muscle force during three pull-up techniques（Scand J Med Sci Sports 2020；PMID 32715526）](https://pubmed.ncbi.nlm.nih.gov/32715526/) | UK National Shoulder model 的引體分析；上肢下壓是軀幹上升的次要結果；寬握背闊肌較活躍 | 為模型結果，摘要未報告背闊肌對肩胛的前伸／後收 |

另外查過的方向（PubMed esearch，查詢如 `latissimus dorsi scapula retraction depression`、`latissimus dorsi electromyography scapula`、`scapular muscle moment arms scapulothoracic ... latissimus`）沒有找到直接量測或計算背闊肌對肩胛前伸／後收力臂的來源。**教科書（如 Kendall、Gray's Anatomy）常寫背闊肌可「下壓／後收肩胛」：未查證**，本文沒有取得可逐頁引用的版本。已有的研究文件 [scapular-arms.md](../scapular-arms.md) 亦記 [Kuechle 1997](https://pubmed.ncbi.nlm.nih.gov/9356931/) 只涵蓋盂肱座標。

### 力學推論（不是證據）

產品定義的 `scRet` 力臂＝背闊肌力線（胸腰起點 → 肱骨止點）對胸鎖關節垂直軸的力矩臂。力線在水平面上的投影，在止點相對胸鎖關節的前後位置改變時會換邊：手臂在身前（平面小）時止點在起點前方，向後下拉的力使肩帶後收（正）；手臂在身後（撐體，平面 > 110°）止點可在起點後方，淨力矩反向（負）。TSM 的結果符合這個預期：平面 −20～40° 平均 +23 mm、40～70° +7、70～95° −13、95～140° −27（見下表）。DAS3 的數值在全部 80 個姿勢都是正的（+29～+75 mm），且與姿勢相關性很弱；DAS3 背闊肌路徑的胸廓起點位在胸廓座標 x ≈ +0.01～+0.02 m、z ≈ +0.085～+0.153 m（`tools/data/das3.osim` 的 `lat_dorsi_1/4/6`，即外側胸壁附近而非後正中），並繞 `ter_lat_pec` 包覆面；是否因此造成恆正，**未驗證**。

| 肩平面分組（姿勢數） | TSM-B | TSM-A（剛體） | DAS3-A |
|---|---:|---:|---:|
| −20～40°（15） | +23.5 | +34.9 | +56.5 |
| 40～70°（24） | +7.3 | +15.3 | +60.6 |
| 70～95°（20） | −13.3 | −6.6 | +59.1 |
| 95～140°（21） | −27.1 | −28.9 | +62.3 |
| 負值姿勢數（共 80） | 49 | 44 | 0 |

### 映射 A 的符號

映射 A（剛體，與產品需求定義一致）與 B 在 75／80 個姿勢同號，A 的平均比 B 大約 +6 mm（A 較偏正）。所以負號不是「貼胸廓約束」造成的偽影：TSM 的路徑本身就給出負值，B 只把它再往負方向推幾毫米。引體、下拉的產品姿勢（平面 50～86°）A 為 −4～−12 mm，B 為 −17～−23 mm，兩者都接近 0。

### TSM 與 DAS3 為何可能相反（假設，未驗證）

本環境沒有 TSM 模型檔（只有固定版 DAS3），以下無法逐項查證：

1. 起點位置不同：DAS3 起點在外側胸壁，TSM 若起於棘突／胸腰筋膜，力線對垂直軸的力臂符號會不同。
2. 包覆面不同：DAS3 用 `ter_lat_pec` 包覆面改變力線，TSM 另用胸廓橢球測地線，路徑形狀差異會直接改變對垂直軸的力矩。
3. 姿勢對應：DAS3 以 TSM 肩胛／鎖骨的方位增量映入（休息姿勢對齊假設），對應偏差會移動整條曲線；DAS3 值幾乎不隨姿勢變是一個可疑訊號。
4. 映射 B 的軸耦合：已排除為主因（A 同號）。
5. 沒有任何實測可裁決（見上）。

## 評估

證據不足以支持任何一個符號，但相對支持度如下（只看證據，不看結果）：

- **解剖**：背闊肌對肩胛沒有可靠的直接附著（57% 只有纖維條或滑囊、多數 CT 無附著），其對肩胛的作用主要由肱骨傳遞與接觸滑動；因此對肩胛前後向的淨力矩理應**很小、且隨手臂位置改變**，而不是固定的 +60 mm。這比較貼近 TSM（−40～+50 mm，隨平面換號）與「0」。
- **數據**：兩個互相獨立的 TSM 映射（A、B）同號且同型態，DAS3 與兩者在平面 > 70° 差約 70～100 mm，而 DAS3 值的姿勢相關性弱，來源不明；單一 DAS3 檔不能視為第二個獨立來源（與 T44 結論「兩個獨立來源」的措辭需保留）。
- 結論：**目前沒有理由改用 DAS3 符號；TSM 提交值是較有物理依據的選擇，但不確定度大（±40 mm 量級），0 是同等合理的中性替代。** 測試結果對此選擇不敏感，所以符號問題不是 0.14.0 變差的原因；要改善排名，需處理背闊肌（與胸大肌）`scElev` 力臂放大後的肩帶共收縮（斜方肌力臂、大圓肌 F、肩內旋分攤），這已在下一步（斜方、前鋸肌換用有出處力臂）範圍內。

## 重現

```bash
node tools/research/diagnose-lat-scret-sign.mjs decomp tsm        # 逐肌力矩分解（zero／das3／elev30 同理）
node tools/research/diagnose-lat-scret-sign.mjs rank tsm          # 全程前四與 a>1（zero／das3／elev30）
node tools/research/diagnose-lat-scret-sign.mjs fit               # DAS3 scRet 二次擬合係數
```

失敗規則總數與趨勢：在複本的 `src/biomech.js` 末端加入同樣的變體覆寫後執行 `node tests/plausibility.mjs`、`node tests/trends.mjs`。
