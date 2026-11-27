# 腰背力矩取矩點：來源、位置與歸類計畫

本文件在執行任何新的驗證比對前提交。研究值、容許差與條件均不更動；歸類只依「定義」，不依通過或失敗。

## 1. 獨立人體測量來源（皆未使用驗證測試組的數值）

| 點 | 來源 | 數值 | 查證 |
|---|---|---|---|
| 髂嵴高度減大轉子高度 | ANSUR II 公開逐人資料（男 4,082、女 1,986；`iliocristaleheight`、`trochanterionheight`、`stature`），由 [`tools/derive-lumbar-point.py`](../../tools/derive-lumbar-point.py) 算出 | 男 0.0915 × 身高（SD 0.0123；約 16.1 cm，SD 2.2 cm）；女 0.0923 × 身高（SD 0.0106；約 15.0 cm，SD 1.9 cm） | 已用本機 CSV 重算，CSV 雜湊與 [`ansur-ii-ratios.json`](../../validation/anthropometry/ansur-ii-ratios.json) 記錄相同；與官方檔逐位元是否相同仍未查證（見[方法](methods.md)） |
| 髖到 L5–S1 | Németh G, Ohlsén H. 3D-location of the L5-S1 fulcrum in relation to the hip. Spine 1989;14(6):604–605. [PMID 2749375](https://pubmed.ncbi.nlm.nih.gov/2749375/)，[DOI 10.1097/00007632-198906000-00011](https://doi.org/10.1097/00007632-198906000-00011) | CT 21 人；髖與 L5–S1 的三維距離 122 mm，男 6.9%、女 7.5% 身高 | 已由 PubMed 摘要核對。摘要只給三維距離，沒有垂直／前後分量，受試者年齡為中高齡（MeSH 標示 Aged／Middle Aged）；髖參考點的定義（股骨頭中心與否）摘要未載明，未查證 |

查到但本次不能用的來源：Murphy AJ, Bull AMJ, McGregor AH. Predicting the lumbosacral joint centre location from palpable anatomical landmarks. Proc Inst Mech Eng H 2011;225(11):1078–83，[PMID 22292206](https://pubmed.ncbi.nlm.nih.gov/22292206/)（16 具骨盆 CT，回歸誤差約 8.2 mm）。取得的頁面只有摘要，**回歸係數未查證**，因此不採用。Reed 等 1999（SAE 1999-01-0959）、Dumas 2007（[PMID 16616757](https://pubmed.ncbi.nlm.nih.gov/16616757)）只確認書目；其髖中心或 L5S1 係數本次沒有取得，**未查證**。de Leva、Dempster、Bell／Harrington 的 L5S1 或髂嵴位置同樣沒有取得，未查證。

## 2. 模型中的點位（沿單一軀幹軸，自髖中心 Pc 起算）

| 設定 | 男 | 女 | 說明 |
|---|---|---|---|
| `model5cm`（產品預設） | 0.05 m | 0.05 m | 原設定，不隨身材縮放，無出處 |
| `iliacCrest` | 0.0915 × 身高 | 0.0923 × 身高 | 175 cm 男性 0.160 m |
| `L5S1` | 0.069 × 身高 | 0.075 × 身高 | 175 cm 男性 0.121 m；方向假設為沿軀幹軸 |

髖中心高度在模型中由 ANSUR 大轉子高度決定（軀幹＝肩峰高度減大轉子高度），所以髂嵴點用同樣的大轉子高度相減，在高度基準上一致。這不等於證明大轉子高度等於髖關節中心高度；兩者差距未查證。審查原先粗估 8–12 cm 與 ANSUR 實測差距不符：髂嵴比預期更高，約 15–16 cm，而 L5–S1 約 12 cm。

## 3. 定義對應

| 研究 | 研究定義 | 對應的取矩點 | 一致的部分 | 不一致的部分 |
|---|---|---|---|---|
| Goršič 2020 腰背 | 左右髂嵴中點；力矩在遠端節段座標系表達；除體重與身高 | `iliacCrest` | 點的高度（以人群平均）；正規化（體重×身高）；中央值＝左右合計（modelFactor 2）；對稱矩狀面動作的屈伸軸皆為左右軸 | 研究點固定在骨盆上，骨盆姿勢對軀幹有獨立運動；模型沒有骨盆自由度，只能沿軀幹軸取點，深蹲時兩者方向可差到數十度，等於取矩點前後位置可有數公分差異；研究的遠端節段（骨盆）座標系與模型的軀幹／全域矢狀面座標系在數學上於對稱動作相同，但骨盆自由度缺失使點位置無法對齊；髂嵴點本身有個體差（身高比例 SD 約 0.012，約 ±2 cm） |
| Henning 2023 腰背 | L5/S1 局部力矩；原表單位誤標 N；節段參考點不明；「average」左右側別不確定 | `L5S1` | 點的高度（以人群平均） | 研究節段參考點／座標系不明，無法確認取矩點與座標軸；側別不確定；模型只有單一剛體軀幹，不含腰椎分節；論文為學位論文，來源品質另註記 |

## 4. 歸類計畫（比較前決定）

依 `validation/schema.md`，只有點、座標系、正規化都能對齊才改回 `comparable`。

- **Goršič 兩筆腰背：維持 `definition-mismatch`。** 點的高度已可用獨立資料對齊，但研究點屬骨盆節段，模型沒有骨盆自由度，點只能沿軀幹軸；殘餘差異是骨盆—軀幹相對姿勢，需有骨盆自由度才能消除，不得以研究報告的骨盆角當參數。
- **Henning 四筆腰背：維持 `definition-mismatch`。** L5/S1 點可以用獨立資料表示，但研究的節段參考點與座標軸不明、單位誤標、側別不確定，定義在來源端就無法確認。
- 不新增 `comparisonRole` 值。兩類各自附上 `momentPoint`（`iliacCrest`／`L5S1`），驗證工具以該點重算模型值作為診斷，原 5 cm 值另列 `modelAt5cm`；兩者都不判通過或失敗，不進通過率。
- 比對後的結果與此歸類不符時，歸類不改；結果照實記錄於[深蹲結果](results/squat.md)與[硬舉結果](results/deadlift.md)。
- 診斷另加：以 ANSUR 髂嵴比例 ±1 SD 重算 Goršič 兩筆，顯示取點個體差造成的範圍。
