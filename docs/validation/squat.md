# 深蹲數值驗證試點

2026-11-24；產品版本 0.7.2。容許範圍與研究數值先於比對提交（`0df5506`、`cb666ff`）；以下結果由 `npm run test:validation` 產生，沒有回頭調門檻或產品數值。機器可讀逐筆結果在 [`validation/results.json`](../../validation/results.json)，全清單三層狀態在 [`src/validation-status.json`](../../src/validation-status.json)。

## 研究與對應條件

| 來源 | 受試者與條件 | 模型對應 | 主要差異 |
|---|---|---|---|
| [Larsen 等，2021，*Effects of Stance Width and Barbell Placement on Kinematics, Kinetics, and Myoelectric Activity in Back Squats*，DOI 10.3389/fspor.2021.719013，表 1–3](https://pmc.ncbi.nlm.nih.gov/articles/PMC8440835/) | 18 人（9 男 9 女），休閒阻力訓練；76.2±11.1 kg、1.73±0.086 m；各條件 3RM：高槓窄／寬 99.2／92.9 kg，低槓窄／寬 102.5／95.6 kg；窄 31.7±2.7 cm、寬 59.8±5.1 cm，髖頂低於膝。取第三次向心最低槓位 v0。 | `squat-high`、`squat-low`，stance=0.14／0.80，depth=0.90；模型 75 kg、1.75 m、固定 75 kg 槓。 | 研究負重隨條件不同，模型不能改；模型深度只預先近似，未依實測膝角調整。表 2 低槓寬站列 95.6 kg，摘要列 97.1 kg，採表值。 |
| [Goršič 等，2020 線上發表，*Biomechanical comparisons of back and front squats with a straight bar and four squats with a transformer bar*，DOI 10.1080/14763141.2020.1832563，表 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC8106690/) | 18 人（10 男 8 女），前後蹲經驗 ≥6 個月；72.6±11.4 kg、1.75±0.09 m；前後蹲用相同絕對負重＝前蹲 1RM 的 70%，髖寬站距、3 cm 鞋跟、平行深度；取上升期股骨對垂直 70° 的姿勢。 | `squat-high`、`front-squat`，stance=0.10，depth=0.80；程式搜尋相同的矢狀面股骨角。髖／膝／踝單側力矩除 75 kg × 1.75 m，對研究雙側平均；中央腰背力矩將右半身輸出乘 2 再正規化。 | 論文未報平均槓重公斤數；模型固定 75 kg 且無鞋跟參數；模型軀幹和骨盆是單一剛體。表 2 是**定點力矩**，不是峰值。 |
| [Gullett 等，2009，*A biomechanical comparison of back and front squats in healthy trained individuals*，DOI 10.1519/JSC.0b013e31818546bb，結果 p. 287](https://pubmed.ncbi.nlm.nih.gov/19002072/)（[全文 PDF](https://paleostrengthconditioning.weebly.com/uploads/2/6/3/0/26307353/gullet_et_al_2009_-_j_strength__conditioning_research.pdf)） | 15 人（9 男 6 女），前後蹲經驗 ≥1 年；69.7±6.2 kg、1.712±0.064 m；各自 70% 1RM，背蹲 61.8±18.6 kg、前蹲 48.5±14.1 kg；約肩寬、到大腿平行；最大淨膝伸力矩。 | `squat-high`、`front-squat`，stance=0.30、depth=0.55；模型峰值除 75 kg。 | 模型兩式均固定 75 kg，研究使用不同重量；研究的動態峰值含慣性。 |
| [Hutchison 與 Caterisano，2019，*Comparison of Peak Ground Reaction Force, Joint Kinetics and Kinematics, and Muscle Activity Between a Flexible and Steel Barbell During the Back Squat Exercise*，DOI 10.2478/hukin-2019-0059，表 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC6724600/) | 10 名男性大學美式足球選手；89.4±17.1 kg、1.82±0.074 m；鋼槓 30% 背蹲 1RM、每分鐘 52 次節拍，膝屈最低至少 80°；取向心期髖／膝／踝峰值。 | `squat-high`，預設 stance=0.30、depth=0.55；直接比較 Nm。 | 負重、慣性、體型及側別未對齊，只是**探索性**峰值對照。站距與平均槓重公斤數未報。正文摘要的髖力矩與表 2 不一致，採表 2。 |

研究數值全為表格或正文**原值**，無圖讀值；29 筆表格值、2 筆正文值。未知條件維持「未報告」，沒有反推。每筆完整條件與證據位置見 `validation/*.json`。

## 比對方法與曲線

姿勢行程 `e=0` 是頂點，`e=1` 是最低點。髖角用大腿相對模型軀幹的屈曲角，膝角伸直為 0°，軀幹角對垂直。Larsen 表 3 踝內角以 90° 站立為零點，換算為背屈角（原值減 90°）；該研究的三維 Cardan 軸序與模型幾何角不完全等價。Goršič 表 2 膝力矩負號轉正，以內部膝伸需求量比較。峰值取 401 個等距姿勢點中最大的**正**力矩。研究標準差展示個體差異；通過與否只由預先固定的絕對誤差門檻決定。

![模型曲線與研究定點數值](squat-curves.svg)

圖中曲線是模型完整行程，研究僅提供圖示位置的平均 ± SD；淡色棒是事先設定的容許範圍。不能把研究定點外推成全行程實測曲線。研究的時間正規化曲線與模型位置行程也不能直接一對一配對；動態中的蹲起速度和慣性模型未涵蓋。

## 逐筆結果

正誤差表示模型值較大。31 筆中 9 通過、22 失敗；運動學 3/18 通過、關節力矩 6/13 通過。Hutchison 三筆的寬探索性門檻及 Gullett 的負重差使「通過」不能解讀為獨立驗證成功。Goršič 腰背兩筆先按其中央整體力矩定義換算模型半身輸出；容許誤差未變，兩筆均失敗。

| 研究／條件 | 指標 | 模型 | 文獻平均 ± SD | 誤差 | 門檻 | 結果 |
|---|---|---:|---:|---:|---:|---|
| gorsic-2020／straight-back | 軀幹前傾 (deg) | 56.39 | 37.90 ± 6.4 | 18.49 | ±12 | 失敗 |
| gorsic-2020／straight-back | 腰背伸力矩 (Nm/(kg*m)) | 2.90 | 1.53 ± 0.25 | 1.37 | ±0.35 | 失敗 |
| gorsic-2020／straight-back | 髖伸力矩 (Nm/(kg*m)) | 1.65 | 0.93 ± 0.15 | 0.72 | ±0.3 | 失敗 |
| gorsic-2020／straight-back | 膝伸力矩 (Nm/(kg*m)) | 0.46 | 0.67 ± 0.15 | -0.21 | ±0.3 | 通過 |
| gorsic-2020／straight-back | 踝蹠屈力矩 (Nm/(kg*m)) | 0.37 | 0.28 ± 0.11 | 0.09 | ±0.2 | 通過 |
| gorsic-2020／straight-front | 軀幹前傾 (deg) | 41.22 | 40.60 ± 5.7 | 0.62 | ±12 | 通過 |
| gorsic-2020／straight-front | 腰背伸力矩 (Nm/(kg*m)) | 2.89 | 1.64 ± 0.27 | 1.25 | ±0.35 | 失敗 |
| gorsic-2020／straight-front | 髖伸力矩 (Nm/(kg*m)) | 1.60 | 0.89 ± 0.14 | 0.71 | ±0.3 | 失敗 |
| gorsic-2020／straight-front | 膝伸力矩 (Nm/(kg*m)) | 0.50 | 0.70 ± 0.15 | -0.20 | ±0.3 | 通過 |
| gorsic-2020／straight-front | 踝蹠屈力矩 (Nm/(kg*m)) | 0.37 | 0.25 ± 0.11 | 0.12 | ±0.2 | 通過 |
| gullett-2009／back | 膝伸力矩 (Nm/kg) | 1.57 | 1.00 ± 0.4 | 0.57 | ±0.5 | 失敗 |
| gullett-2009／front | 膝伸力矩 (Nm/kg) | 1.68 | 0.70 ± 0.2 | 0.98 | ±0.4 | 失敗 |
| hutchison-2019／steel-back | 髖伸力矩 (Nm) | 202.74 | 324.00 ± 52 | -121.26 | ±100 | 失敗 |
| hutchison-2019／steel-back | 膝伸力矩 (Nm) | 117.56 | 157.00 ± 34 | -39.44 | ±70 | 通過 |
| hutchison-2019／steel-back | 踝蹠屈力矩 (Nm) | 46.89 | 90.00 ± 24 | -43.11 | ±50 | 通過 |
| larsen-2021／high-narrow | 軀幹前傾 (deg) | 42.05 | 46.70 ± 2.9 | -4.65 | ±10 | 通過 |
| larsen-2021／high-narrow | 髖屈 (deg) | 155.25 | 111.00 ± 7.2 | 44.25 | ±12 | 失敗 |
| larsen-2021／high-narrow | 膝屈 (deg) | 143.40 | 126.40 ± 4.7 | 17.00 | ±12 | 失敗 |
| larsen-2021／high-narrow | 踝背屈 (deg) | 31.12 | 16.00 ± 4.5 | 15.12 | ±12 | 失敗 |
| larsen-2021／high-wide | 軀幹前傾 (deg) | 32.03 | 46.00 ± 3.4 | -13.97 | ±10 | 失敗 |
| larsen-2021／high-wide | 髖屈 (deg) | 145.23 | 110.40 ± 4.5 | 34.83 | ±12 | 失敗 |
| larsen-2021／high-wide | 膝屈 (deg) | 133.85 | 119.30 ± 6.4 | 14.55 | ±12 | 失敗 |
| larsen-2021／high-wide | 踝背屈 (deg) | 28.80 | 8.60 ± 5.9 | 20.20 | ±12 | 失敗 |
| larsen-2021／low-narrow | 軀幹前傾 (deg) | 52.91 | 56.70 ± 2.5 | -3.79 | ±10 | 通過 |
| larsen-2021／low-narrow | 髖屈 (deg) | 166.11 | 110.50 ± 6.6 | 55.61 | ±12 | 失敗 |
| larsen-2021／low-narrow | 膝屈 (deg) | 141.52 | 122.70 ± 5 | 18.82 | ±12 | 失敗 |
| larsen-2021／low-narrow | 踝背屈 (deg) | 29.18 | 16.30 ± 5 | 12.88 | ±12 | 失敗 |
| larsen-2021／low-wide | 軀幹前傾 (deg) | 41.78 | 53.00 ± 4.4 | -11.22 | ±10 | 失敗 |
| larsen-2021／low-wide | 髖屈 (deg) | 154.98 | 111.90 ± 4.8 | 43.08 | ±12 | 失敗 |
| larsen-2021／low-wide | 膝屈 (deg) | 132.38 | 120.30 ± 5.8 | 12.08 | ±12 | 失敗 |
| larsen-2021／low-wide | 踝背屈 (deg) | 26.68 | 10.50 ± 6.3 | 16.18 | ±12 | 失敗 |

## 三層結論

| 清單項目 | 運動學 | 關節力矩 | 肌肉分工 |
|---|---|---|---|
| 高槓 `squat-high` | **failed**；1/9 通過 | **failed**；4/8 通過 | **failed**；定性趨勢 7/8 通過，寬站距臀大肌活化方向失敗。僅屬模型估計。 |
| 低槓 `squat-low` | **failed**；1/8 通過 | **unvalidated**；未取得可直接對齊且已量化的低槓峰值資料 | **partial**；定性趨勢 1/1 通過，僅屬模型估計。 |
| 前蹲 `front-squat` | **partial**；1/1 通過，但缺最低點髖／膝／踝數值 | **failed**；2/5 通過 | **unvalidated**；現有趨勢腳本沒有前蹲肌肉分工的直接檢查。 |

本試點沒有任何層達 `validated`。其他 60 個清單項目的三層均為 `unvalidated`。肌肉活化 `a` 與負荷 `s` 是最佳化分配結果，不等於肌電 %MVIC 或肌肉實測力；不能用定性趨勢通過來代替數值校準。現有 [`tests/trends.mjs`](../../tests/trends.mjs) 高槓在寬站距臀大肌活化比較失敗，與 [`src/biomech.js`](../../src/biomech.js) 原有的寬站姿股骨矢狀投影限制相符。

## 失敗原因假設與資料限制

1. **最低點角度與深度**：Larsen 高槓窄站膝屈 126.4°，模型 143.4°；髖屈 111°，模型 155.25°。`depth=0.90` 是比對前選定，沒有使實際膝角與研究相同。研究髖角相對骨盆的 Cardan 定義，模型以軀幹作參考且沒有獨立骨盆姿勢，可能再擴大髖角差。先核對骨盆與髖角定義及實際膝深，再判斷姿勢求解是否需修正。[Larsen 等，方法與表 3](https://pmc.ncbi.nlm.nih.gov/articles/PMC8440835/)
2. **寬站軀幹**：Larsen 高槓窄／寬站軀幹 46.7°／46.0°，模型 42.05°／32.03°，寬站過度直立。現有姿勢求解註記指出，股骨外展縮短矢狀投影，固定壓力中心後會把軀幹拉直並降低髖伸需求；此為待查的幾何假設，不能從定性排序推認已校準。[Larsen 等，表 3](https://pmc.ncbi.nlm.nih.gov/articles/PMC8440835/)、[Lahti 等，2019，DOI 10.1111/sms.13305，方法與表 3](https://jyx.jyu.fi/bitstream/handle/123456789/60648/lahtietal2018scandinavianjournalofmedicine26scienceinsports.pdf?sequence=1)
3. **平行位置髖／腰背伸力矩偏高**：Goršič 背／前蹲髖伸 0.93／0.89 Nm/(kg·m)，模型 1.65／1.60；中央腰背伸 1.53／1.64，模型右半身換成整體後為 2.90／2.89。模型 75 kg 槓重與研究未知的 70% 前蹲 1RM 絕對重量不一定相同；軀幹／骨盆分段、足壓中心及下肢幾何亦可能影響分配。研究本身是動態逆動力學；需要負重與壓力中心對齊的資料才能分辨原因。[Goršič 等，方法及表 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC8106690/)
4. **峰值對照限制**：Gullett 前蹲模型膝伸峰值 1.68 Nm/kg，研究 0.7；研究前蹲平均槓重 48.5 kg，模型 75 kg，不能把 0.98 Nm/kg 的差全部歸因於力矩公式。Hutchison 的 30% 1RM 快速蹲與準靜態 75 kg 槓設定差距更大，而且表 2 側別未明；其 2 筆「通過」只反映探索門檻寬。[Gullett 等，結果](https://paleostrengthconditioning.weebly.com/uploads/2/6/3/0/26307353/gullet_et_al_2009_-_j_strength__conditioning_research.pdf)、[Hutchison 等，方法及表 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC6724600/)
5. **槓位、站距、深度、負重的效應**：本試點能直接檢查高／低槓與窄／寬站在最低點的角度，以及同負重前／背蹲在平行位置的定點力矩。Larsen 研究的低槓與高槓使用各自 3RM，無法把槓位效應和負重效應完全分離。現有產品 `BAR_RATIO.squat=1.0`，沒有使用者可設的深蹲槓重；因此無法驗證文獻的負重反應。深度／站距對力矩的量化資料仍需加入，例如 Lahti 表 3 的 70%／85% 1RM 站距比較；須先查明其**雙側力矩加總**與本工具單側輸出的換算，並預先固定門檻。[Larsen 等，方法](https://pmc.ncbi.nlm.nih.gov/articles/PMC8440835/)、[Lahti 等，方法](https://jyx.jyu.fi/bitstream/handle/123456789/60648/lahtietal2018scandinavianjournalofmedicine26scienceinsports.pdf?sequence=1)

以上是有來源支持的**待檢假設**，不是對產品數值的校正。本任務沒有修改姿勢、負重、肌肉或肩力臂。

## 公開資料集評估

| 資料 | 深蹲與測力 | 授權／取得 | 本次決定 |
|---|---|---|---|
| [AddBiomechanics 1.0](https://www.addbiomechanics.org/download_data.html) | 官方資料頁列有 squat 類別，包含光學標記、地面反力與逆動力學關節力矩；核心資料來自 15 個既有資料源。 | 資料為 [CC BY 4.0](https://addbiomechanics.org/data_sharing_mission.html)，下載時須保留各資料集 `LICENSE.txt` 的上傳者署名。官方頁面提供整包核心資料下載，未在該頁提供可核對槓重、槓位的單筆試驗索引。 | 可供**徒手蹲的運動學／力矩形狀**後續比較；尚未確認含負重槓鈴蹲、檔名及受試條件，故本次不納入數值參考，也未下載大包資料。 |
| [OpenCap](https://doi.org/10.1371/journal.pcbi.1011462) | 官方[運動學／動力學範例](https://github.com/opencap-org/opencap-processing/blob/main/example_kinetics.py)支援 squat 分段與估算地面反力／力矩；其原始研究報角度、反力、力矩的精度評估。 | [程式庫](https://github.com/opencap-org/opencap-processing)為 Apache 2.0；這不等於可下載的個別受試者資料也有相同授權。範例資料以登入後的 session ID 下載。 | 尚未找到可核對授權及負重條件的公開、可逐筆下載之槓鈴深蹲 session；本次不納入。 |

下一步先取得與模型負重、深度及站距相同的原始試驗；若採 AddBiomechanics 徒手蹲，先記錄 `b3d` 檔名、版本、受試者、試驗標籤、原始授權與力矩軸方向，再以相同姿勢相位做曲線比較。現有 `e` 是位置比例，不能直接等同文獻的時間百分比。硬舉可從已查的 3D 逆動力學研究盤點數值；臥推須另找含肩、肘力矩與同負重條件的開放原始數據。
