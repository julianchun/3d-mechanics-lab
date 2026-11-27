# 肩部參數：DAS3 與 Ackland 獨立核對

## 來源與可核對範圍

- [DAS3 固定版](https://github.com/dasproject/DAS3/tree/d6f2ff0d49ada37bd6c3c1edbacc101ea8d9af92) 的 `model/das3.osim`：138 條 Schutte1993 肌肉元素，逐條列出最大等長力 `max_isometric_force`（N）、最佳纖維長 `optimal_fiber_length`（m）、肌腱鬆弛長 `tendon_slack_length`（m）、最佳長度羽狀角（rad）及路徑點。固定 commit、SHA-256 與 Apache-2.0 授權見 [`tools/data/README.md`](../../tools/data/README.md)。`python3 tools/das3_params.py --json` 可重算逐條資料。
- [Chadwick 等 2014](https://pubmed.ncbi.nlm.nih.gov/24956613/)（*IEEE TBME* 61(7):1947–1956, DOI `10.1109/TBME.2014.2309727`）說明 138 元素模型從 SIMM 解剖模型移入 OpenSim，其解剖資料來自 [Klein Breteler 等 1999](https://pubmed.ncbi.nlm.nih.gov/10541069/) 的大體研究。後者摘要確認量測了最佳纖維長、肌腱長與 PCSA；[Nikooyan 等 2011](https://link.springer.com/article/10.1007/s11517-011-0839-7) 是 Delft Shoulder and Elbow Model 的後續模型說明。[Veeger 等 1992](https://pubmed.ncbi.nlm.nih.gov/1733989/) 列出另一組肩部幾何資料；它與 DAS3 各條 F 的逐項對應**未查證**。DAS3 所列 F 是否完全由 Klein Breteler 單一標本的 PCSA 和同一比張力換算，亦**未查證**；本任務直接採用固定版模型 F，並不倒推宣稱原始測量值。
- [Ackland 等 2008 Table 1](https://onlinelibrary.wiley.com/doi/10.1111/j.1469-7580.2008.00965.x)（*J Anat* 213:383–390, DOI `10.1111/j.1469-7580.2008.00965.x`）是**獨立的八具大體**肌腱位移實測。記錄額狀面外展、矢狀面前舉及肩胛平面上舉 2.5°–120° 的 18 個子區域極值與角度。背闊肌、大圓肌只有 10°–120°；表格沒有水平內收或軸旋力臂。本文在 30° 後以 2:1 盂肱／肩胛旋轉模擬肩胛節律，與本產品及 DAS3 的節律均不完全相同。

`das3.osim` 不包含 C／Matlab 實作的肩胛—胸廓接觸力；本任務只讀肌肉參數與路徑，不把缺失的接觸力當零。

## 現行最大等長力與 DAS3（單側，N）

下表 DAS3 值是元素 F 直接相加；拆分後 Lf／Lt／羽狀角以元素 F 加權。這些數值**不是**以產品的原有效力再校正。肩胛分束界線及胸大肌腹部界線是根據路徑起點的解剖近似，見階段 2 定稿。

| 現行群組 | 現行有效 F | DAS3 元素 F | 備註 |
|---|---:|---:|---|
| 胸大肌胸骨／下胸 `pecs` | 1156.4 | 896 | `pect_maj_t_1..6`；最低肋起點 `t_1` 可獨立為 125 |
| 胸大肌鎖骨 `pecc` | 444.3 | 292 | `pect_maj_c_1..2` |
| 三角肌前束 `adelt` | 1350 | 505 | `delt_clav_1..4` |
| 三角肌中束 `mdelt` | 1650 | 1856 | `delt_scap_4..11` 起點分組近似 |
| 三角肌後束 `pdelt` | 675 | 946 | `delt_scap_1..3` 起點分組近似 |
| 背闊肌 `lat` | 1500 | 562 | `lat_dorsi_1..6`，起點上／下各 273／289 |
| 大圓肌 `tmaj` | 144 | 608 | `ter_maj_1..4` |
| 喙肱肌 `corb` | 208.2 | 463 | `coracobr_1..3` |
| 棘下肌／小圓肌 `infra` | 1345.3 | 1929 | `infra_1..6`=1432；`ter_min_1..3`=497 |
| 棘上肌 `supsp` | 499.2 | 621 | `supra_1..4` |
| 肩胛下肌 `subsc` | 1306.9 | 1431 | `subscap_1..11` |
| 上斜方肌 `uptrap` | 1500 | 889 | `trap_scap_1..5`＋`trap_clav_1..2` |
| 中斜方／菱形 `midtrap` | 1000 | 770 | `trap_scap_6..8`=336；`rhomboid_1..5`=434 |
| 下斜方肌 `lowtrap` | 500 | 296 | `trap_scap_9..11` |
| 前鋸肌 `serr` | 1000 | 947 | `serr_ant_1..6`=547（下）；`7..12`=400（上） |
| 提肩胛肌／胸小肌 | 無 | 200／307 | 分別為 `lev_scap_1..2`／`pect_min_1..4` |

## 力臂獨立核對（階段 1）

同一列以 Ackland Table 1 的**對應角度及平面**作比較。產品值由 `MUSCLES.arms` 在純前舉（`shFwd=θ, shSide=0`）或純外展（`shFwd=0, shSide=θ`）求得，`shRot=0`。DAS3 值由 `tools/das3_chords.py`：固定 SC／AC／GH 長軸旋轉在檔案預設角，調整兩個 GH 角使肱骨長軸對準胸廓前舉或外展角，取跨盂肱關節第一段路徑直線弦，以 `(附著點−GH中心)×單位力線` 投影到上舉軸，最後以元素 F 加權。DAS3 座標 Z 往後，換成前舉方向比較。此方法忽略包覆、肩胛節律改變及經肱骨骨面繞行；是**診斷近似，不是 OpenSim 求得的力臂**。尤其肩袖的符號／量級可能失真。

| 肌肉／子區域 | 平面與角度 | Ackland (mm) | 現行 (mm) | DAS3 直線弦 (mm) | 診斷 |
|---|---|---:|---:|---:|---|
| 前三角／鎖骨束 | 前舉 120° | +40.0 | +43.0 | +32.7 | 大致同向 |
| 中三角 | 外展 86° | +29.1 | +31.0 | +22.9 | 大致同向 |
| 後三角 | 前舉 30° | −33.0 | −26.3 | −29.5 | 大致同向 |
| 胸大肌鎖骨部 | 前舉 71° | +53.7 | +53.4 | +31.4 | 現行符合此極值；弦低約 42% |
| 胸大肌胸骨中部 | 前舉 45° | +15.9 | +6.0 | +19.5 | **現行低 62%** |
| 背闊肌上部對照現行合群 | 前舉 45° | −22.1 | −50.0 | −29.7（全群） | **現行大 126%**；弦全群非上部 |
| 背闊肌上部對照現行合群 | 外展 71° | −29.9 | −31.3 | −42.4（全群） | 現行近似；弦全群非上部 |
| 大圓肌 | 前舉 56° | −54.4 | −44.5 | −63.6 | 同向 |
| 棘上肌前部對照現行合群 | 前舉 2.5° | +41.8 | +5.1 | +5.7（全群） | **現行低 88%**；弦亦低 |
| 棘下肌上部對照現行合群 | 外展 28° | +13.4 | 0 | +19.0（棘下全群） | **現行缺外展作用** |
| 肩胛下肌上部對照現行合群 | 前舉 2.5° | +35.3 | 0 | −12.4（全群） | **現行缺前舉作用**；弦符號反向，包覆不可忽略 |

現行模型的旋轉肌袖主要在 `shRot` 軸出力，而 Ackland Table 1 只測前舉／外展；將其角度峰值直接當作本模型常數會改變自由度分工。背闊肌前舉 45° 的大差距，連同其總 F 將由 1500 降至 562 N，預示划船及自體重量下拉可能退步；不能據此改動 DAS3 F。對實際划船／下拉姿勢的水平內收軸，Ackland Table 1 沒有對應量測，**未查證**；需另看姿勢與 DAS3 路徑弦，並保留其包覆誤差。


## 階段 2：細分與產品實作

可用建置旗標 `VITE_SHOULDER_PARAMETER_SET=das3` 啟用 DAS3；Node 分析可設 `SHOULDER_PARAMETER_SET=das3`。預設仍為 `legacy`，理由見階段 3。`src/das3-shoulder.js` 由 `tools/das3_product.py` 從原始 138 元素重生，`tools/check-generated.sh` 檢查一致性。啟用時，所有跨肩的 F（含二頭長／短頭、三頭長頭）直接取 DAS3；沒有再加有效力調整。肱三頭外／內側頭、肱肌及肱橈肌只跨肘，仍使用 T28 來源；旋前圓肌 651 N（Lf/Lt 0.0563/0.0772 m，羽狀角 0）、旋後肌 838 N（0.0264/0.0174 m，0.0119 rad）、旋前方肌 470 N（0.0369/0.0050 m，0）的元素參數已可由解析器查到，未加入前臂自由度或產品求解，留待 T30。

| 肌群 | 決定與理由 | 力臂處理 |
|---|---|---|
| 胸大肌 | 鎖骨部維持 `pecc`；胸骨／肋骨較高起點 `pect_maj_t_2..6` 為 `pecSternal` 771 N，最低肋起點 `t_1` 為 `pecAbdominal` 125 N，一般視圖後兩者合回 `pecs` 896 N。兩者前舉力臂方向與大小不同，符合可分辨原則。 | 鎖骨部保留既有 Ackland 錨點；胸骨部用 Table 1 +4.4 mm@2.5°、+15.9@45° 與末端近似線性節點；腹部用 +1.9@2.5°、−9.3@98° 線性近似。腹部外展以 Table 1 −33.6 mm 極值作常數近似。 |
| 背闊肌 | `lat_dorsi_1..3` 的較高胸廓起點為 `latUpper` 273 N，`4..6` 為 `latLower` 289 N，一般視圖合回 `lat` 562 N。上下束 Lf 0.2796／0.3254 m 也不同。 | 前舉沿 Ackland Table 1 的上部 −22.1 mm@45°、−0.1@120°，下部 −10.8@53°、−2.9@120° 近似；10° 端數值為假設。外展沿現行曲線，上下束比例 0.9／1.2 為近似；水平內收沿用 MoBL 路徑擬合，因 Ackland 未量此軸。 |
| 三角肌 | 前／中／後三束保留；DAS3 `delt_clav_1..4` 505 N、`delt_scap_4..11` 1856 N、`delt_scap_1..3` 946 N。肩胛束分界根據起點由肩胛棘向肩峰的次序，是近似。 | 保留既有曲線；前／中／後束在 Table 1 代表點大致同向，但沒有完整曲線可直接移植。 |
| 斜方肌、菱形肌 | `trap_scap_1..5`＋鎖骨束為上束 889 N，`6..8` 中束 336 N，`9..11` 下束 296 N。菱形肌 434 N 獨立求解，與中束合回一般視圖舊名稱；路徑弦顯示兩者後收力臂大小可分。 | 中束後收 70 mm 沿用舊等效值，菱形肌 37 mm、下壓 10 mm 為 DAS3 預設姿勢路徑弦比例近似。下斜方仍只代表下壓，未重建上旋。 |
| 前鋸肌 | `serr_ant_7..12` 上部 400 N、`1..6` 下部 547 N，對應胸廓肋骨起點高度；一般視圖合回 `serr`。兩組在現有肩帶兩軸的弦力臂差距較小，解剖拆分的模型辨識力有限。 | 沿用 Seth 等效曲線，按 DAS3 預設姿勢弦比縮放：上／下部後收 0.887／1.083、上提 0.972／1.018；跨模型幾何仍是近似。 |
| 旋轉肌袖 | 棘下肌 1432 N 與小圓肌 497 N 獨立求解、一般視圖合回 `infra`；棘上肌 621 N、肩胛下肌 1431 N 保留。小圓肌在 Ackland 的前舉／外展極值可和棘下肌區分。 | 小圓肌的前舉 −18.7@2.5° 至 +2.2@120°、外展 −3.3@18° 至 +5.1@120° 線性近似；軸旋仍沿用舊近似。棘下／肩胛下舊模型只含軸旋，未根據弦的相反符號增添前舉力臂。 |
| 提肩胛肌、胸小肌 | DAS3 各 200／307 N。兩者相對肩帶的弦方向不同於既有斜方／前鋸肌，故列為獨立項；一般視圖各自顯示。 | 以 DAS3 預設姿勢直線弦估得提肩胛肌上提 +43、後收 −5 mm；胸小肌上提 −75、後收 −39 mm。肩胛接觸與包覆未納入，故絕對值不可靠。 |
| 大圓肌、喙肱肌 | 保留獨立，DAS3 F 608／463 N。 | 保留既有 MoBL／估計力臂；大圓肌前舉 56° 的現行 −44.5 mm 對 Ackland −54.4 mm。 |

上述力臂除 Ackland 註明的極值外，**點間插值及量測範圍外固定端點均為模型近似**。尤其超過 120° 的上舉、屈肘時肩胛節律、肱骨內外旋與水平內收軸缺直接實測。DAS3 的 `Lt` 與羽狀角供 `lRigid` 診斷，正式求解的力長曲線仍使用本產品原 `Lmt` 位移代理；模型沒有把 DAS3 肌腱力學完整移植。

## 階段 3：預設組與 DAS3 組比較

比較使用同一分支的階段 0 前原有力學作基線（與 main 的肩部參數相同），每個含肩清單項目掃描 41 個行程點。排名是一般視圖每肌群 `s` 的全程峰值排序；「超載幀」為該幀任一一般肌群未截斷主動活化 `a>1`，一幀只計一次。`tools/shoulder-audit.mjs` 可重算 JSON。**兩組關節外力矩完全相同**：DAS3 下執行回歸測試先通過 `joint-moments.json` 的逐項精確比對，再因預期肌肉值變化顯示 4618 筆差異。

45 個含肩項目合計：舊組 264／1845 超載幀、467 個肌群超載點；DAS3 組 **726／1845 超載幀、1169 個肌群超載點**。舊組合理性檢查為 33 項已知問題且無新失敗；DAS3 組保留 24 項已知失敗、新增 **44 項**、解決 9 項舊失敗，故 `tests/plausibility.mjs` 在實驗組仍不通過。沒有為了通過檢查調大 DAS3 F 或針對個別動作加例外。

下表中的代號是清單 ID；`pecs`、`lat`、`midtrap` 等為一般視圖合群。`s` 峰值含被動份額且顯示活化截於 1.5；超載計數及下文 `a` 峰值使用未截斷主動活化。一個超載幀可能有多個肌群超載，故「肌群超載點」多於超載幀。

| 動作 | 舊組前四名 | 舊組超載幀 | DAS3 前四名 | DAS3 超載幀 |
|---|---|---:|---|---:|
| `deadlift` | lat, erec, gmax, hams | 5 | pdelt, tmaj, erec, gmax | 15 |
| `deficit-dl` | lat, erec, gmax, hams | 8 | pdelt, tmaj, erec, gmax | 17 |
| `block-pull` | erec, lat, gmax, hams | 0 | pdelt, tmaj, erec, gmax | 6 |
| `sumo` | lat, erec, gmax, vasti | 0 | tmaj, pdelt, erec, gmax | 9 |
| `rdl` | erec, gmax, hams, lat | 0 | erec, gmax, pdelt, hams | 0 |
| `bench` | pecs, adelt, trilat, pecc | 0 | pecs, adelt, trilat, pecc | 41 |
| `incline-bench` | adelt, mdelt, pecs, trilat | 0 | pecs, adelt, mdelt, pecc | 22 |
| `cg-bench` | trilat, pecs, adelt, trilong | 0 | pecs, trilat, adelt, corb | 4 |
| `floor-press` | pecs, adelt, trilat, pecc | 0 | pecs, adelt, trilat, pecc | 29 |
| `db-bench` | pecs, adelt, mdelt, trilat | 0 | pecs, adelt, pecc, trilat | 13 |
| `db-bench-incline` | mdelt, adelt, pecs, trilat | 0 | pecs, adelt, mdelt, pecc | 0 |
| `pushup` | trilat, pecs, adelt, mdelt | 0 | trilat, pecs, pmin, serr | 0 |
| `pushup-feet` | trilat, pecs, adelt, mdelt | 0 | trilat, pmin, pecs, serr | 0 |
| `pushup-hands` | trilat, pecs, adelt, lat | 0 | pecs, trilat, pmin, tmaj | 0 |
| `chest-press` | pecs, trilat, adelt, pecc | 0 | pecs, trilat, adelt, pecc | 12 |
| `pec-deck` | pecs, adelt, infra, brach | 0 | pecs, brach, pecc, infra | 0 |
| `reverse-deck` | pdelt, mdelt, infra, lat | 40 | pdelt, midtrap, mdelt, trilat | 31 |
| `machine-press` | adelt, mdelt, infra, uptrap | 0 | mdelt, adelt, uptrap, bic | 26 |
| `cable-fly-high` | pecs, infra, brach, bic | 0 | pecs, infra, brach, bic | 0 |
| `cable-fly-mid` | pecs, infra, brach, adelt | 0 | pecs, brach, infra, adelt | 0 |
| `cable-fly-low` | pecs, adelt, infra, brach | 0 | pecs, adelt, pecc, brach | 0 |
| `ohp` | adelt, trilat, uptrap, mdelt | 0 | uptrap, mdelt, adelt, trilat | 4 |
| `db-press` | mdelt, uptrap, adelt, tmaj | 0 | uptrap, mdelt, adelt, tmaj | 0 |
| `dips` | pecs, lat, tmaj, corb | 41 | pecs, tmaj, pmin, lat | 41 |
| `dips-upright` | pecs, lat, tmaj, corb | 41 | pecs, lat, pmin, tmaj | 41 |
| `row` | erec, mdelt, midtrap, uptrap | 0 | midtrap, pdelt, uptrap, erec | 41 |
| `row-sup` | erec, mdelt, midtrap, uptrap | 0 | midtrap, pdelt, uptrap, erec | 41 |
| `cable-row` | erec, lat, brach, midtrap | 0 | pdelt, midtrap, mdelt, brach | 0 |
| `cable-row-wide` | midtrap, erec, mdelt, uptrap | 0 | midtrap, pdelt, uptrap, erec | 38 |
| `db-reverse-fly` | pdelt, mdelt, midtrap, trilat | 6 | midtrap, pdelt, uptrap, lowtrap | 4 |
| `uprow` | infra, uptrap, mdelt, brach | 0 | uptrap, infra, brach, mdelt | 0 |
| `pulldown` | lat, pecs, ra, infra | 0 | lat, pmin, subsc, lowtrap | 23 |
| `pulldown-sup` | lat, infra, mdelt, ra | 0 | lat, pmin, subsc, pdelt | 0 |
| `pullup` | lat, mdelt, pecs, brach | 41 | pmin, lat, pdelt, pecs | 41 |
| `pullup-wide` | lat, pecs, mdelt, brach | 41 | lat, pmin, pecs, pdelt | 41 |
| `chinup` | lat, adelt, mdelt, brach | 41 | pmin, lat, mdelt, brach | 41 |
| `assist-pullup` | lat, mdelt, pecs, brach | 0 | lat, pmin, pecs, lowtrap | 0 |
| `assist-chinup` | lat, adelt, mdelt, brach | 0 | pmin, lat, brach, bic | 0 |
| `pushdown` | trilat, lat, trilong, infra | 0 | trilong, pdelt, tmaj, trilat | 0 |
| `curl` | adelt, bic, brach, uptrap | 0 | bic, adelt, corb, uptrap | 30 |
| `reverse-curl` | adelt, brach, bic, uptrap | 0 | adelt, bic, corb, uptrap | 32 |
| `lat-raise` | mdelt, uptrap, adelt, infra | 0 | uptrap, mdelt, adelt, pecc | 0 |
| `db-curl` | adelt, bic, infra, brach | 0 | bic, adelt, uptrap, corb | 22 |
| `hammer-curl` | adelt, bic, brach, infra | 0 | adelt, bic, uptrap, corb | 20 |
| `shrug` | uptrap, adelt, infra, erec | 0 | uptrap, adelt, corb, bic | 41 |

### 合理性檢查增減

下表逐項列出 DAS3 組的 **44 項新增失敗**；`activation:x` 是全程任一點 `a>1`，`rank:*` 是既有排名準則未達。這些是同一套產品準則在實驗組下的診斷結果，不是對 DAS3 來源數字的修正要求。

| 清單 ID | 新增失敗規則 |
|---|---|
| `deadlift`、`deficit-dl`、`block-pull`、`sumo` | 各 `activation:pdelt`、`activation:tmaj`（8） |
| `rdl` | `rank:top3`：膕繩肌未進前三（1） |
| `bench`、`incline-bench`、`cg-bench`、`floor-press`、`db-bench`、`chest-press` | 各 `activation:pecs`（6） |
| `pushup-feet` | `rank:top2`：胸大肌未進前二（1） |
| `reverse-deck` | `activation:midtrap`（1） |
| `machine-press` | `activation:mdelt`、`activation:uptrap`、`activation:adelt`（3） |
| `ohp` | `activation:uptrap`、`rank:top2`：前三角肌未進前二（2） |
| `dips`、`dips-upright` | 各 `activation:pmin`（2） |
| `row`、`row-sup` | 各 `activation:midtrap`、`activation:pdelt`（4） |
| `cable-row` | `rank:lat:top4`：背闊肌掉出前四（1） |
| `cable-row-wide`、`db-reverse-fly` | 各 `activation:midtrap`（2） |
| `pulldown` | `activation:lat`（1） |
| `pullup`、`pullup-wide`、`chinup` | 各 `activation:pmin`（3） |
| `curl` | `activation:bic`、`activation:adelt`（2） |
| `reverse-curl` | `activation:adelt`（1） |
| `lat-raise` | `rank:first`：上斜方肌取代中三角肌居首（1） |
| `db-curl` | `activation:bic`、`activation:adelt`（2） |
| `hammer-curl` | `activation:adelt`（1） |
| `shrug` | `activation:adelt`、`activation:uptrap`（2） |

**9 項舊失敗消失**：`curl`／`db-curl rank:first`、`deadlift`／`deficit-dl activation:lat`、`chinup activation:adelt`、`db-bench-incline rank:first`、`db-reverse-fly activation:pdelt`、`uprow rank:notFirst`、`pulldown rank:notTop4`。已有問題仍有 24 項，包括自體重量引體與撐體的背闊肌超載；「消失」只表示上述準則通過，未證實肌群分配符合人體。

### 超載原因診斷

下列為模型內的能力與力臂比較，**不能把 `a>1` 等同肌電大於 100%**。DAS3 取代 F／Lf 並拆分肌束；同時變動會透過最小努力分配改變其他肌群。`SHOULDER_PARAMETER_SET=das3 node tools/shoulder-audit.mjs --causes` 可重算單項反事實：僅把一個群組的 F 總量按原比例縮放回舊組，或僅把該群組各子束力臂換成舊合群力臂，再恢復原值。此診斷不改產品設定，也沒有重建真實纖維長或肩胛接觸，因此只能指出模型內較敏感的環節。

| 超載位置與肌群 | F 舊→DAS3（單側 N）與力臂證據 | 單項替換診斷／判讀 |
|---|---|---|
| 臥推、上斜、地板推及胸推的 `pecs` | 1156.4→896；胸骨部前舉 45° 的舊值 +6.0 mm 低於 [Ackland Table 1](https://onlinelibrary.wiley.com/doi/full/10.1111/j.1469-7580.2008.00965.x) +15.9 mm，新組採該極值近似；腹部另有相反方向的前舉力臂。 | 平板臥推 41 幀超載，`pecs` 最大 `a=1.262`；單恢復 F 為 18 幀、`a=1.117`，單恢復舊力臂為 38 幀、`a=1.250`。F 下降是較大的模型內因素，但單恢復 F 仍未消除超載；新分束力臂、Lf 與協同分配仍有影響。 |
| 槓鈴／寬握滑輪划船的 `midtrap`，反向蝴蝶機與反向飛鳥亦超載 | 舊中斜方／菱形合群 1000 N、後收 70 mm，標稱後收能力 70 N·m；新中斜方 336 N×70 mm＋菱形 434 N×37 mm，合計 39.6 N·m，**F 與估計力臂都降低能力**。菱形的 37 mm 只是 DAS3 預設姿勢弦比例，不是 Ackland 實測。 | 槓鈴划船 41 幀、`a=1.259`；單恢復 F 或舊合群力臂皆降至 5 幀。寬握滑輪划船 38 幀、`a=1.693`；兩種單項替換分別為 10／24 幀。後收軸的拆分力臂需逐姿勢核對。 |
| 聳肩與肩推的 `uptrap`，肩推／彎舉／聳肩的 `adelt` | 上斜方 1500→889，前三角 1350→505；兩者保留原等效力臂。Ackland 前三角前舉 120° +40.0 mm 與舊模型 +43.0 mm 大致一致，沒有獨立證據要求大幅改臂。 | 聳肩上斜方 `a=1.313`、41 幀；單恢復 F 後該肌 `a=0.841`，整項仍有 19 幀，主要還有前三角超載。彎舉前三角 `a=1.190`、30 幀；單恢復其 F 後整項 0 幀。這兩處主要是有效 F 下降。中三角 1650→1856 卻在機器肩推超載，需看共同分配與器械力矩，不能歸因於其 F 下降。 |
| 引體／撐體的 `pmin` 與 `lat`、正握下拉的 `lat` | 胸小肌 307 N 是新增項，肩帶下壓 −75 mm 來自**未包覆的弦估計**。背闊 1500→562，肩帶下壓臂仍 −30 mm，標稱下壓能力 45→16.9 N·m；下斜方 500→296，−35 mm 不變。 | 正握下拉背闊 `a=1.247`、23 幀；只恢復背闊 F 即為 0 幀，換回舊背闊力臂仍 22 幀。此動作的新增超載主要受 F 降低；引體／撐體舊組本已全程超載，新增胸小肌 `a` 峰值約 1.45–1.68 暴露肩帶分工與弦力臂的不確定性。 |
| 硬舉的 `pdelt`／`tmaj`，划船的 `pdelt`；彎舉的 `bic` | 後三角 675→946、大圓肌 144→608，**自身 F 上升**，仍在硬舉與划船超載；符合負擔由背闊等肌轉移的可能性，不能稱為這兩塊肌的來源 F 過小。二頭肌兩頭合計 841.9→842 N，彎舉新增超載也非群組總 F 下降。 | 硬舉後三角 `a=1.534`；單換回較小的舊 F 反而使全動作超載幀 15→20。後三角既有力臂未改；需檢查背闊、肩伸／肩帶軸與分配。二頭長／短頭 F 比例和 Lf 改變，且前三角 F 下降，彎舉結果是耦合效應。 |

背闊肌的划船結論需與下拉分開：**槓鈴划船**峰值 `s` 0.506→0.291，**V 把滑輪划船** 0.559→0.281。DAS3 將背闊 F 降到 562 N，但模型的前舉伸展力臂也由舊組純前舉 45° 的 −50.0 mm 改為上束 −22.1 mm（[Ackland 實測極值](https://onlinelibrary.wiley.com/doi/full/10.1111/j.1469-7580.2008.00965.x)）、下束約 −10.5 mm。單恢復 F，槓鈴／V 把划船背闊峰值僅到 0.298／0.355，仍未進前四；單恢復舊背闊力臂則到 0.536／0.725，V 把回到前四。**模型內划船排名對力臂更敏感**，但 Ackland 沒有量划船的水平內收力臂；舊組 −50 mm 在純前舉 45° 又比實測上束峰值大 126%，不能為了排名恢復。划船姿勢的真實背闊力臂與力長仍未查證。

### 指定動作的判讀

- **槓鈴划船／反手划船**：背闊肌一般峰值 `s` 0.506／0.508 → 0.291／0.288，均未進前四；兩式中斜方／菱形合群升至約 1.20，後三角約 1.08–1.10，所有 41 幀均有超載。**V 把滑輪划船**背闊肌 0.559 → 0.281，從第 2 掉出前四；寬握滑輪划船 0.493 → 約 0.35，38 幀超載。上述單項替換顯示划船背闊排名對力臂較敏感，中斜方超載則同時受 F 和後收力臂影響；Ackland 沒有水平內收軸實測，結論限於目前模型。
- **下拉**：正握背闊肌 0.963 → 約 1.25，肩胛下肌 0.273 → 約 0.74，背闊仍居首但 23 幀超載；反握背闊 0.731 → 約 0.79、肩胛下 0.411 → 約 0.67，無新超載。正握胸大肌舊組進前四的問題消失，但新組胸小肌進前四。單項替換指出正握超載主要受背闊 F 下降影響；肩胛下壓軸的需求與新胸小肌力臂仍需驗證，不能用另一來源替換 F。
- **引體／撐體**：舊組引體、雙槓已各有 41 幀超載；DAS3 仍各 41 幀，並新增胸小肌超載。正握引體背闊最高未截斷 `a` 1.71，前傾／直立雙槓背闊分別 1.54／1.74；排名顯示值因 `min(a,1.5)` 截斷不能代表超載嚴重度。
- **直立划船**：舊組棘下／小圓合群第 1（約 0.66），DAS3 組上斜方第 1（約 0.64）、棘下／小圓第 2（約 0.47）；原排名問題在 0.9.0 的 DAS3 試驗組消失；0.10.0 已加入前臂旋轉，但握把接觸偶矩仍未量得。
- **聳肩**：上斜方仍第 1，峰值約 0.71 → 1.31；舊組 0 超載幀，DAS3 41 幀，上斜方與前三角均超載。DAS3 上斜方 F 889 N，遠低於舊有效 F 1500 N，且肩帶力臂仍採舊等效值。
- **臥推／上斜臥推**：平板胸大肌仍第 1，但峰值約 0.77 → 1.26，從 0 變 41 超載幀。上斜胸大肌約 0.64 → 1.27、鎖骨部約 0.29 → 0.48；鎖骨部增加，卻仍低於胸骨／腹部，且新增 22 超載幀。上斜啞鈴胸大肌從約 0.37 升至 0.96、排名第 1，解決舊排名問題。這些結果同時受新胸骨前舉力臂插值及 F 分配影響，不能歸因於單一參數。

**0.9.0 當時的決定：** DAS3 組的超載幀約為舊組 2.75 倍、已知／新增合理性問題合計 68 項（24＋44），整體明顯退步。產品預設維持舊組；DAS3 組保留可切換供逐項評估。當時 `tests/snapshots/baseline.json` 未更新，因預設產品數值完全相同；0.10.0 加入前臂旋轉後已另行更新基準。此處數值保留為 0.9.0 比較紀錄，不宣稱 DAS3 組已達正式驗收。

### 若要採用 DAS3 組，仍缺的工作

1. **重建包覆路徑與力臂**：用固定版 DAS3 在實際 11 自由度姿勢逐點求 OpenSim 肌肉路徑與力臂，納入肱骨／肩胛包覆；先檢查現有弦對棘上肌前舉 2.5° 只得 +5.7 mm、Ackland 前部 +41.8 mm，以及肩胛下肌上部前舉 Ackland +35.3 mm、全群弦卻 −12.4 mm 的量級／符號衝突。不能把直線弦當正式力臂。
2. **肩胛胸廓接觸與節律**：重建 DAS3 原 C／Matlab 的胸廓滑動接觸，或以有實測校準的等效約束替代；逐姿勢核對 `scRet`／`scElev` 所需力矩。特別檢查中斜方／菱形 70／37 mm 後收臂、胸小肌 −75 mm 下壓臂、前鋸肌上下部與下斜方上旋作用。現有肩帶僅兩軸，無法直接沿用完整肩胛力學。
3. **核對 Ackland 的對應平面與區域**：將前舉、外展的完整曲線或可複核讀圖點與產品實際姿勢比較，至少修正胸大肌胸骨部舊值 45° +6.0 對實測 +15.9 mm、背闊上束舊值 −50.0 對 −22.1 mm、棘下肌外展 28° 舊值 0 對上部 +13.4 mm；下拉與划船的水平內收／肩軸旋仍需其他獨立資料。DAS3 背闊兩束合併了 Ackland 的中／下部，須核對區域映射。
4. **完成來源與負荷驗證**：追到每條 DAS3 F 的 PCSA、比張力及個體縮放鏈；以可量測的器械阻力、手部反力、肩肘三維力矩和姿勢檢查超載動作，並在肩胛接觸與路徑改善後重跑 45 項全程及合理性檢查。另需將 DAS3 肌腱伸長、羽狀角與纖維長納入一致的出力求解，不能只以目前 `Lmt` 代理判斷 F 是否足夠。

### 仍未查證

- DAS3 各條 F 從 Klein Breteler 1999 PCSA 到 Schutte1993 元素的逐項換算、比張力、參數是否混入 Veeger 資料；模型檔的固定版數值可核對，但不能倒推資料血緣。
- DAS3 的直線弦未執行 OpenSim 包覆與完整 11 自由度節律，尤其棘上肌與肩胛下肌的量級／符號對 Ackland 不可靠。胸小肌、菱形肌與前鋸肌等效肩帶軸亦未經原模型逐點比對。
- Ackland Table 1 只有極值，本文節點間線性近似及量測範圍外固定端點不是其原始曲線。旋轉肌袖內外旋及實際划船水平內收沒有 Ackland 對應角度資料。
