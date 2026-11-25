# 健美式技術原則（教練已審閱）

本文件用於後續逐項稽核 63 個動作的**預設姿勢**。目標是讓預定肌群承擔較多可控制的力矩，同時避免為了追求某種外觀姿勢而強迫關節進入不舒服的位置。這些原則是教學與模型檢查的起點，**不是個人受傷風險預測或醫療禁忌**。肌肉「排名」只指本模型的分配結果，不等於肌電、實際肌力或長期增肌成效。

證據強度在此指**這一句技術主張**的支持程度，不是論文品質的單一分數：**強**＝多項一致的人體介入或前瞻結果可支持此具體主張；**中**＝生物力學或介入結果方向一致，但不能直接推論受傷；**弱**＝少量急性研究、跨情境外推或教練共識；**爭議**＝有相反結果，或「力學／增肌」與「安全」結論不能合併。表中的角度及握距若來自單篇實驗，只是**研究條件**，不自動成為安全門檻。「未有通用門檻」表示未找到可移植至所有人的數值界線；第三節已記錄教練採用的判讀方式。

量化欄使用目前 `analyze(lift, P, e)` 的 `pose`、`q`、`dem`、`mus`（`e=0` 頂點、`e=1` 最低點）。力矩比用同一幀絕對值比較；肌群比較用模型 `mus[id].a` 或 `s`，須同時查看總力矩，避免把模型偏好係數當作實際訓練效果。**能**＝現有輸出可直接計算；**部分**＝可用姿勢／參數代理，但缺關鍵自由度或個人測量；**不能**＝目前沒有相應狀態量。教練選用的示範值不能宣稱為文獻界線。

## 一、跨動作總則（8 條）

| 編號 | 原則與依據 | 證據強度 | 模型量化；門檻 | 目前能否表達 |
| --- | --- | --- | --- | --- |
| G1 | **自由站姿先維持穩定支撐，再選擇動作路徑。** 靜力平衡要求足底反力可抵消外力矩；滑輪水平拉力下，壓力中心不等同人與器材的重心投影。[Hof 2007][R33] 說明壓力中心、質心及外力在平衡中的不同作用；[Fry 2003][R06] 顯示刻意限制膝前移會改變髖膝力矩，不能只看槓路。 | **中**：平衡條件明確，沒有查到健美動作通用的「距腳掌中點 ±幾公分」實證界線。 | 每幀 `pose.cop[2] − (pose.R.heel[2]+pose.R.toe[2])/2`，另檢查是否位於足底接觸範圍；前後容許距離尚無通用界線。器械固定軌道或多接點動作須改看各接點反力。 | **部分**：有準靜態壓力中心；沒有足底壓力分布或動態失衡。 |
| G2 | **負重時維持自己可控制的軀幹姿勢，避免為追求深度而突然改變腰背形狀。** [Saraceni 2020][R01] 的統合分析未發現舉物時較大腰椎屈曲與下背痛有明確關聯，且納入研究品質低；因此不能把任何可見圓背直接判為受傷。[Straub 2024][R07] 說明軀幹前傾會改變髖膝負擔。 | **爭議**：沒有可通用的安全腰椎屈曲／過伸角，也缺重訓長期傷害因果證據。 | 理想量：逐節腰椎屈曲、骨盆相對胸廓角及每下變化；暫看 `pose.phi`、`dem.trunkExt`，但**不得**用軀幹傾角當腰椎屈曲角。尚無通用門檻。 | **不能**：軀幹單一剛體，無腰椎分段；`round` 參數也只是示意。 |
| G3 | **深蹲時膝蓋沿身體前後方向朝正前方前進，不必刻意對齊腳尖；避免失控向內塌。** 搭配腳尖小幅外開、全腳穩定接地。若腳尖大幅外開而膝仍朝正前方，腳掌與膝路徑方向不一致會形成小腿相對大腿的扭轉要求；這是幾何推論，實際脛股旋轉量與傷害風險未獲直接驗證。[Asayama 2021][R09] 顯示站距／腳尖方向影響模型膝接觸力；[Collings 2026][R35] 顯示深蹲時內收大肌坐骨髁束有高模型估計力，但未比較膝朝向。 | **弱**：膝朝正前方及其內收肌效果是教練經驗；深蹲內收大肌參與有模型證據，指定膝路徑的增益與安全界線未證。 | 理想量：股骨在水平面相對前後方向的外展角、膝相對腳掌的橫向位置、膝路徑與腳尖方向差、脛骨相對股骨旋轉；不設統一容許角。膝可超過腳尖。 | **部分**：有 3D 關節與腳尖方向；`squatPose` 已能分開選膝朝正前方或跟腳尖；仍無脛股旋轉自由度。 |
| G4 | **握把與手腕、上臂路徑以可控制且無不適的位置優先。** [Polovinets 2018][R10] 在伏地挺身比較中立與過伸手腕的力傳遞；[Noteboom 2024][R11] 發現臥推握距與肩胛位置改變肩關節模型反力，但未量到受傷率。 | **弱**：伏地挺身結果不能直接轉成所有握把動作的手腕安全角；肩關節反力不是傷害發生率。 | 理想量：手腕屈伸／橈尺偏角、肩胛與肱骨相對角、疼痛回報；各角尚無通用門檻。 | **部分**：上臂與肩胛有代理角；沒有可靠手腕角、疼痛或獨立肱骨內外旋。 |
| G5 | **在目標肌仍能出力且關節舒適的範圍練習，不一律排除末端，也不強迫碰到末端。** [Pallarés 2021][R02] 偏向全行程的力量與下肢肌肥大結果；[Kassiano 2023][R03] 指出長肌長區間的局部行程也可能有增肌價值。[Roach 1991][R04] 的髖膝主動活動度常模隨群體而異，並非負重安全界線。 | **爭議**：增肌最佳範圍與末端受傷門檻是不同問題；沒有通用「末端最後幾度」的安全值。 | 各 `q` 關節角／**個人實測主動活動度**、端點力矩與疼痛；個人 ROM 及負重末端比例尚無通用界線。現有 `rom` 警示角僅為程式啟發式，非文獻界線。 | **部分**：有部分關節角及端點力矩；無個人 ROM、疼痛或關節接觸應力。 |
| G6 | **一般組下放（離心）吸氣、推／站起（向心）有控制地吐出部分氣，全程保留胸腔與軀幹張力。** 向心吐氣不是把氣全部吐掉；臥推尤其要在下放與推起時都維持胸廓擴張、肋骨有張力。[NSCA 官方手冊][R38] 建議在最吃力處吐氣、較輕鬆段吸氣；離心吸／向心部分吐及不塌胸的具體提示是教練決定。大重量短暫憋氣由教練按個人情況判斷；[Hackett 2013][R12] 與 [Linsenbardt 1992][R13] 分別討論腹壓與血壓反應。 | **爭議**：NSCA 支持一般呼吸相位；「部分吐氣保留胸廓張力」屬教練經驗，沒有通用吐氣量、負重百分比或憋氣秒數。 | 理想量：吸吐氣相位與量、胸廓擴張、憋氣時間、腹內壓及血壓；不設統一界線。 | **不能**：`brace` 是肌肉分配設定，不能量呼吸、胸廓、腹壓或血壓。 |
| G7 | **離心段能主動煞住、避免靠反彈或借力改變目標肌負荷；不指定固定秒數。** [Enes 2025][R05] 的統合分析發現約 1 秒與約 3.5 秒等不同節奏對肌肥大整體差異很小。 | **弱**：節奏對肌肥大有研究，但「某秒數較安全」或「每下必須慢放」沒有直接支持。 | 理想量：器材速度、加速度、反彈及目標肌張力；模型只有行程 `e`，無時間軸；秒數尚無通用界線。 | **不能**：準靜態模型無速度、加速度或離心階段動態。 |
| G8 | **腳掌保持可靠接觸，容許足弓隨負重有自然變形；「三點支撐」作教學提示即可。** [Powell 2012][R16] 觀察足弓在垂直負重下形變；「三點支撐」可降低重訓傷害或必須壓住足弓這兩項主張**未找到實證，屬教練共識**。 | **弱**：有足弓負重形變資料，沒有健美動作三點壓力比例或足弓下降安全門檻。 | 理想量：跟骨、第一與第五蹠骨頭接觸力及舟狀骨高度變化；三點比例／足弓下降量尚無通用界線。 | **不能**：腳是單一剛體，只有一個合成接觸點。 |

## 二、各動作模式

以下「偏移」指可觀察的**模型力矩或急性肌肉活動方向**，不是證明長期增肌或傷害。每類三至四條；同一動作可因選擇目標肌而採不同版本。對器械動作，先確認椅墊、握把與阻力軌道是否真能對應實物。

### 1. 深蹲類（自由深蹲、高腳杯、史密斯、腿推、哈克）

**主要目標：**股四頭肌與臀大肌，內收大肌也可參與髖伸；站距、深度和軀幹／小腿相對角會改變需求。器械須另外考慮靠墊與軌道。

高腳杯深蹲預設 `dom=0.25`、膝朝正前方：模型最低點軀幹前傾約 39.4°，股廣肌在該點的全肌活化排第 2，踝背屈約 33.9°。`dom=0.05` 可作較膝主導的選擇，最低點軀幹約 31.5°、踝背屈約 38.5°，後者超過模型 36° 提示線；這是姿勢與模型比較，並非個人安全角或訓練成效判定。

| 編號 | 關鍵技術原則；常見錯誤與負荷偏移 | 依據與強度 | 模型量化；門檻 | 表達 |
| --- | --- | --- | --- | --- |
| S1 | **想偏股四頭時，容許膝自然前移並控制軀幹前傾。** 硬擋膝前移會讓髖、軀幹需求大增；膝超過腳尖本身不是錯誤。 | [Fry 2003][R06]、[Straub 2025][R17]；**中**：急性力矩研究一致，非傷害研究。 | `|dem.kneeExt| / |dem.hipExt|`、軀幹與小腿傾角差；何值算股四頭偏重尚無通用界線。 | **能**（力矩）；無真實肌肥大。 |
| S2 | **下蹲深度由可控制的髖、膝、踝活動度與目標肌決定。** 只蹲淺可能少了臀大肌與內收肌群的訓練刺激；強迫深度造成骨盆姿勢改變時應調整。 | [Kubo 2019][R18]、[Pallarés 2021][R02]；**中**：介入支持較深行程的部分增肌效果，安全下限未定。 | 最低點 `q.hipFlex`、`q.kneeFlex`、`q.ankleDorsi` 與個人 ROM 比例；尚無通用界線。 | **部分**：有關節角，沒有骨盆／腰椎分段或個人 ROM。 |
| S3 | **自由深蹲以腳尖小幅外開、膝朝正前方的可控路徑為起點，不要求膝對齊腳尖。** 依站距、個人關節活動度調整；膝失控內塌時先檢查負重與深度。大幅外八仍讓膝直行，會形成小腿相對大腿的扭轉要求；實際旋轉量與安全角未獲直接驗證。腿推／哈克的足板與軌道另需判讀。 | [Asayama 2021][R09] 顯示站距與腳尖角會改變估計膝力。[McCaw 1999][R39] 發現站距與動作階段交互影響內收長肌 EMG；[Paoli 2009][R40] 未發現站距使內收肌或臀中肌 EMG 顯著不同；[Reece 2020][R36] 的環帶深蹲未提高臀中肌 EMG，反而增加膝外翻與脛骨旋轉。**弱**：研究操弄並非教練所指的膝朝前路徑，不能直接證明其肌肉效果。 | 股骨水平面外展角、膝相對腳掌橫向位移、膝路徑／腳尖夾角；各值按人與動作觀察，不設統一合格角。 | **部分**：`squatPose` 已用 `kneePath` 分開膝與腳尖方向；實際脛股旋轉與關節接觸力仍不可量。 |
| S4 | **深蹲的內收大肌也可參與髖伸，深位可增加內收肌群訓練刺激；膝朝正前方是教練採用的提示。** 不把「膝比腳尖更朝內」等同失控膝內夾，也不保證這條路徑會比其他路徑多練內收肌。 | [Takahashi 2025][R34] 的人體肌束模型支持內收大肌髖伸力矩能力；[Collings 2026][R35] 的肌骨模型估計深蹲中內收大肌坐骨髁束高受力；[Kubo 2019][R18] 的全蹲組內收肌群體積增長大於半蹲組。[Chiu 2025][R37] 的短期膝內／外路徑介入未證實內收大肌增長差異。**中**（參與深蹲）；**弱**（指定膝路徑增加參與）。 | 對比不同深度的 `q.hipFlex`、`dem.hipExt` 與模型內收大肌分配，並記錄股骨水平面外展角；不能把模型值當 EMG 或長期增肌。 | **部分**：可估髖伸需求與兩種膝路徑的肌肉分配；模型內收大肌參數仍是估計。 |

### 2. 髖鉸鏈（傳統／相撲硬舉、RDL、早安；臀推與背伸展依相同髖伸原則）

**主要目標：**傳統硬舉（含赤字、墊高）以臀大肌、膕繩肌及離地推地階段的股四頭肌為目標，內收大肌協同；相撲硬舉沿用此分工，但股四頭與內收肌比重較高。RDL 以膕繩肌為重點、臀大肌為另一目標，內收大肌協同。硬舉與 RDL 的腰背伸肌、讓槓貼身的背闊肌是穩定肌，傳統硬舉的上背與握力也屬穩定工作，不列作主要訓練目標；握力目前沒有肌肉模型輸出。早安、臀推、背伸展及臀橋維持原本的目標分工。

| 編號 | 關鍵技術原則；常見錯誤與負荷偏移 | 依據與強度 | 模型量化；門檻 | 表達 |
| --- | --- | --- | --- | --- |
| H1 | **讓負重路徑靠近身體、以髖屈伸承接主要力矩。** 槓或握把遠離身體會增加髖與軀幹外力臂；若下背先失去可控姿勢，縮短行程或減重。 | [Straub 2024][R07]、[Fenwick 2009][R19]；**中**：力臂與下背負荷方向有依據，無通用安全距離。 | 槓到髖／腰部的水平距離、`|dem.hipExt|`、`|dem.trunkExt|`；距離尚無通用界線。 | **部分**：可算力臂與淨力矩，無椎間負荷。 |
| H2 | **RDL 保留適度屈膝並靠髖折疊；傳統硬舉容許更多膝伸參與。** 把 RDL 蹲成深蹲會把需求轉向股四頭；把硬舉膝鎖直則改變可用路徑。 | [Martín-Fuentes 2020][R20]、[Lee 2018][R21]；**中**：綜述與比較研究支持肌群／力矩方向，但肌電不等於增肌。 | `q.kneeFlex` 與 `|dem.kneeExt| / |dem.hipExt|`；各動作膝角標準尚無通用界線。 | **能**（幾何與力矩）。 |
| H3 | **用髖鉸鏈的可控底點決定 RDL／早安行程，別把腰椎圓背直接等同受傷。** 末端若需要骨盆後捲，先由教練判斷是否仍可控制。 | [Saraceni 2020][R01] 與 [Kassiano 2023][R03]；**爭議**：屈曲與疼痛未見明確關聯，長肌長刺激可能有益，但重負荷末端界線未確立。 | 應量腰椎分段與膕繩肌長度；現有 `pose.phi`、`mus.hams.l` 僅代理，底點尚無通用門檻。 | **部分**：肌長代理可看，腰椎屈曲不能。 |

### 3. 水平推（臥推、伏地挺身、胸推、飛鳥）

**主要目標：**胸大肌；窄握臥推較偏三頭／前三角，飛鳥較偏肩水平內收。

| 編號 | 關鍵技術原則；常見錯誤與負荷偏移 | 依據與強度 | 模型量化；門檻 | 表達 |
| --- | --- | --- | --- | --- |
| P1 | **臥推先選能穩定肩胛、手腕的握距，不為追求胸感無限制加寬。** 過寬握距提高肩水平內收需求，窄握則提高肘伸與前三角需求；肩關節反力也會變。 | [Noteboom 2024][R11]、[Mausehund 2022][R22]；**中**：急性力矩／模型反力清楚，傷害預防仍屬推論。 | 握距／肩峰寬比、`|dem.shFwd|`、`|dem.elbExt|`、肩胛後收參數；`<1.5` 倍肩峰寬是 Noteboom 的**實驗比較條件**，不是普遍安全線。 | **部分**：握距、力矩可算；無可靠手腕角與肩關節接觸力。 |
| P2 | **手肘外展角與觸胸點配合個人肩活動度，保留可控制的底部。** 肘向兩側過度張開或下放到肩前不適位置時，先改握距、觸點或深度。 | [Noteboom 2024][R11] 比較 45°／70°／90° 外展；**中**：對模型反力有急性差異，但沒有證明某角必然受傷。 | `P.flare`、`P.touch`、底點 `q.shElev`／`q.shPlane` 與肩力矩；安全角尚無通用界線。 | **部分**：可看上臂角，缺獨立肱骨軸旋。 |
| P3 | **飛鳥與器械胸推在肩前側仍舒適的範圍做水平內收。** 把重量放到深拉伸端而失去控制，可能讓肩部需求而非胸肌成為限制。 | [Kassiano 2023][R03] 支持長肌長刺激的可能性；此特定飛鳥安全界線**未找到實證，屬教練共識**；**弱**。 | 底點肩水平外展代理、`mus.pecs/pecc` 對 `mus.adelt` 排名、`joints.shoulder`；深度尚無通用門檻。 | **部分**：無肩關節接觸應力，排名有模型偏差。 |
| P4 | **臥推、伏地挺身與胸推在下放與推起時都保持胸廓擴張、肋骨有張力，肩胛穩定；推起時有控制地吐出部分氣，不塌胸。** 肩胛穩定指能控制其位置，不要求所有動作把肩胛夾死。 | [Noteboom 2024][R11] 在臥推比較中發現肩胛後收可降低估計肩關節後向剪力；不能直接外推伏地挺身／器械胸推。全程胸廓擴張與部分吐氣屬教練經驗，**未找到直接量化實證**；整體**弱**。 | 觀察肋骨／胸骨相對骨盆的位置與胸圍或胸廓擴張、呼吸相位、肩胛位置及觸胸點；不設胸廓擴張量門檻。 | **部分**：臥推與坐姿胸推有 `P.scap` 肩胛設定；模型沒有胸椎拱起、胸廓擴張或呼吸參數，不能檢查不塌胸。 |

### 4. 垂直推（肩推、雙槓撐體）

**主要目標：**前三角／中三角與三頭；雙槓撐體還會讓胸大肌參與。

| 編號 | 關鍵技術原則；常見錯誤與負荷偏移 | 依據與強度 | 模型量化；門檻 | 表達 |
| --- | --- | --- | --- | --- |
| V1 | **上舉時容許肩胛自然上轉，不把肩胛固定夾死。** 為追求「肩胛一直後收」而阻止上舉，可能改變上臂與肩峰附近空間。 | [Phadke 2009][R23]、[Ludewig 2011][R24]；**弱**：是肩部運動學／復健證據，非健康健美者肩推傷害試驗。 | 理想量：肩胛上轉／後傾隨 `q.shElev` 的曲線；正常運動學不是安全閾值，尚無通用界線。 | **不能**：現有肩胛等效自由度缺完整上轉／後傾。 |
| V2 | **槓路靠近身體可平衡的上舉路徑，避免用大幅腰背後仰把肩推變成上斜推。** 後仰增加胸大肌與軀幹參與，改變預定肩部刺激。 | [Straub 2024][R07] 支持軀幹角改變力矩的一般原理；特定肩推轉移幅度**未找到實證，屬教練共識**；**弱**。 | `P.lean`、槓到肩的水平距離、`mus.adelt/mdelt` 對 `mus.pecc` 排名、`dem.trunkExt`；後仰上限尚無通用界線。 | **部分**：可算代理，但無腰椎伸展角。 |
| V3 | **雙槓撐體只下到肩前側可控制的位置，軀幹傾角按胸／三頭目標選。** 不要為追求深度在肩前疼痛處反彈。 | [Kassiano 2023][R03] 僅支持活動範圍可能影響增肌；撐體深度傷害門檻**未找到實證，屬教練共識**；**弱**。 | `P.lean`、最低點 `q.shElev`／`q.shPlane`、胸與三頭模型分配；底點尚無通用界線。 | **部分**：撐體肩部／肌肉模型有已知超載問題，不能按排名定姿勢。 |

### 5. 水平拉（槓鈴／滑輪划船、反向飛鳥）

**主要目標：**背闊肌、菱形／中斜方肌與後三角；肘路徑及軀幹角會改變相對需求。

| 編號 | 關鍵技術原則；常見錯誤與負荷偏移 | 依據與強度 | 模型量化；門檻 | 表達 |
| --- | --- | --- | --- | --- |
| L1 | **槓鈴划船先選能維持支撐的軀幹角，再讓肩／肘完成拉動。** 反覆伸髖甩槓會把部分動作交給腿與腰；太直立會改變上背與聳肩需求。 | [Fenwick 2009][R19] 比較划船型式的背肌活動與腰椎負荷；**中**：姿勢對負荷方向有實測，沒有「正確軀幹幾度」。 | `P.torso`、每幀 `pose.phi`、`dem.trunkExt` 與背肌分配；軀幹角尚無通用界線。 | **部分**：準靜態可比較姿勢，無甩槓動量。 |
| L2 | **若要偏背闊肌，讓肘路徑較靠身體；若要偏後三角／上背，可選較外展路徑。** 只用「夾肩胛」作唯一提示未必提高目標肌活動。 | [Lehman 2004][R25] 在坐姿划船發現刻意後收未提高中斜方／菱形肌電；不同肘路徑的長期增肌**未找到實證，屬教練共識**；**弱**。 | `P.flare`、`q.shPlane`、`mus.lat` 對 `mus.pdelt/midtrap` 排名；肘角尚無通用界線。 | **部分**：有代理角與估計分配，肩胛模型有限。 |
| L3 | **坐姿滑輪划船保持骨盆／椅墊穩定，只用可控制的身體擺幅。** 大幅借後仰可能把訓練目的改成髖／軀幹伸展。 | 此特定身體擺幅的增肌或傷害界線**未找到實證，屬教練共識**；**弱**。 | `P.leanStart − P.leanEnd`、肩伸與軀幹力矩；容許擺幅尚無通用界線。 | **部分**：有姿勢參數，缺動態借力與真實座椅接觸。 |

### 6. 垂直拉（引體、下拉；直立划船另看肩部風險）

**主要目標：**背闊肌與其他肩內收／伸肌；肘屈肌協同。直立划船實際是肩外展／肩胛上提，不能沿用背闊肌目標。

| 編號 | 關鍵技術原則；常見錯誤與負荷偏移 | 依據與強度 | 模型量化；門檻 | 表達 |
| --- | --- | --- | --- | --- |
| D1 | **下拉與引體優先選能完成肩部動作的握距，別預設越寬越練背。** 寬握可能縮短可用行程或增加肩需求；手臂仍會協同。 | [Andersen 2014][R26]、[Buonsenso 2025][R27] 發現握距對背闊肌肌電影響小或不一致；**中**：急性結果方向清楚，不能推長期增肌相同。 | 握距／肩峰寬、`q.shElev` 行程、`mus.lat` 對 `mus.bic/brach`；研究測過 1–2 倍肩峰寬，**非安全範圍**。 | **部分**：有握距與估計肌肉分配，無真實肌電。 |
| D2 | **讓上臂向軀幹拉，避免靠劇烈後仰把下拉變成划船。** 後仰會改變肩伸與肘屈相對需求，還會改變滑輪外力方向。 | [Lehman 2004][R25]、[Buonsenso 2025][R27] 顯示不同拉法的肌電差異有限；**中**：可辨機械方向，但「最佳後仰角」未定。 | `P.lean`、`q.shElev`、`|dem.shFwd|/|dem.elbExt|`；後仰幅度尚無通用界線。 | **部分**：有靜態力矩，無甩動。 |
| D3 | **直立划船先檢查上臂外展高度及肩部舒適度，不把模型的肩袖高排名當作訓練目標。** 內旋合併外展是否造成個人夾擠，不能由此模型判定。 | [Ludewig 2011][R24] 提供肩峰下空間的生物力學背景；此動作的通用安全高度**未找到實證，屬教練共識**；**弱**。 | `q.shElev`／`q.shPlane`、肩力矩；若需評估內旋角，現有 `q.shRot` **不可代替**；高度尚無通用界線。 | **部分**：有上臂高度，缺獨立肱骨內旋與肩關節接觸力。 |

### 7. 上肢單關節（彎舉、三頭下壓、側平舉、聳肩）

**主要目標：**依動作分別是肘屈肌、肱三頭肌、三角肌中束、上斜方肌；不要把借力後的模型排名視為孤立訓練效果。

| 編號 | 關鍵技術原則；常見錯誤與負荷偏移 | 依據與強度 | 模型量化；門檻 | 表達 |
| --- | --- | --- | --- | --- |
| U1 | **彎舉／三頭下壓先選穩定上臂位置，再由肘完成主要行程。** 大幅前後擺上臂會增加肩部需求，並改變所謂單關節動作。 | 此特定「上臂移動幾度會減少增肌」**未找到實證，屬教練共識**；**弱**。 | 全程 `q.shElev` 變化、`|dem.elbExt|` 與肩力矩；上臂容許擺幅尚無通用界線。 | **部分**：靜態姿勢可看，不能計動量或純肘屈肌刺激。 |
| U2 | **側平舉可從肩胛平面、可控制的上舉高度開始，必要時調整握法。** 刻意大幅內旋又高舉不能單憑肩部外觀判為安全或危險。 | [Yasojima 2008][R28] 比較肩胛平面不同上臂旋轉的肌電；[Phadke 2009][R23] 描述肩胛上舉機制；**中**：有急性肌肉差異，無普遍受傷界線。 | `P.plane`、`P.topHeight`、`q.shElev`、`mus.mdelt` 對 `mus.uptrap`；最佳高度尚無通用界線。 | **部分**：有舉臂代理，缺獨立內外旋與完整肩胛上轉。 |
| U3 | **單關節動作在肌肉可控制的端點轉向，手腕與肘不要靠反彈承重。** 尤其槓鈴彎舉若手腕被迫後折，先改握距或器材。 | [Polovinets 2018][R10] 僅是伏地挺身手腕實驗；本項跨到彎舉／下壓的安全主張**未找到實證，屬教練共識**；**弱**。 | 理想量：手腕角、肘端點力矩、反彈速度；尚無通用門檻。 | **不能**：無手腕自由度及動態反彈。 |

### 8. 下肢單關節與器械（腿伸、腿彎舉、提踵、腿推、髖外展／內收）

**主要目標：**腿伸偏股四頭、腿彎舉偏膕繩肌、提踵偏小腿；腿推是多關節器械，腳位與軌道會改變髖膝需求。

| 編號 | 關鍵技術原則；常見錯誤與負荷偏移 | 依據與強度 | 模型量化；門檻 | 表達 |
| --- | --- | --- | --- | --- |
| M1 | **腿推先設定可穩定接觸踏板的腳位，再按股四頭／臀部目標調整高低。** 低腳位可能增加膝伸需求，高腳位可能增加髖伸需求；不能單靠腳位宣稱特定肌群必定增長更多。 | [Martín-Fuentes 2020][R29] 綜述認為腿推腳位的肌電證據未一致；[Da Silva 2008][R30] 為小樣本急性研究；**中**：可比力矩方向，肌電與增肌證據有限。 | `P.footHigh`、`|dem.kneeExt|/|dem.hipExt|`、踏板反力；高低腳位界線尚無通用界線。 | **部分**：器械軌道／摩擦是估計，無實測踏板壓力分布。 |
| M2 | **腿彎舉可依膕繩肌目標考慮坐姿，腿伸則依欲偏股直肌或廣肌選椅背角。** 同一器械只看負重數字會忽略髖角造成的肌長改變。 | [Maeo 2021][R31] 的 12 週比較：坐姿腿彎舉較俯臥有更大膕繩肌體積增長；[Larsen 2025][R32] 的腿伸介入顯示較小髖屈角偏股直肌；**中**：各有單一介入情境，不能推所有器械。 | 髖角、膝角、`mus.hams.l`／`mus.rf.l` 與目標肌分配；座椅角尚無通用界線。 | **部分**：可選姿勢並估肌長；座椅尺寸與真實纖維長未知。 |
| M3 | **腿伸、提踵及髖外展／內收先對齊器械轉軸與身體關節，讓靠墊穩定接觸。** 軸位錯開或離墊借力可能把阻力移到非目標部位。 | 此特定器械對軸公差與傷害門檻**未找到實證，屬教練共識**；**弱**。 | 理想量：器械軸到關節中心距離、墊壓力與滑移；公差尚無通用界線。 | **部分**：有估計機器幾何，無接觸壓力與個人化對軸量測。 |

## 三、教練決定（10 題）

以下是預設教學與人工複查方式；數字若沒有同條件研究支持，僅是示範或複查提示，不是安全界線。

| 題目 | 教練決定 | 理由與證據 |
| --- | --- | --- |
| Q1. 自由站姿壓力中心 | 先確認壓力中心留在足底接觸範圍內；偏離腳掌名義中段超過 ±5 cm 時提示人工複查，不直接判錯。 | 準靜態支撐必須成立，但鞋子、動作及水平外力會改變足底前後負重；±5 cm 是複查設定，未找到通用界線。[Hof 2007][R33] |
| Q2. 深蹲底部骨盆／腰背變化 | 輕微且可控的變化不自動判錯；突然增大、疼痛或失穩時由教練複查。 | [Saraceni 2020][R01] 未證實舉物時較大腰椎屈曲必然與下背痛相關；模型沒有腰椎分段，不能自動判定。 |
| Q3. 股四頭導向深蹲的深度與膝前移 | 容許膝超過腳尖；以可控制、無不適的個人底點為預設，不設固定膝越線量。 | 限制膝前移會增加髖力矩 [Fry 2003][R06]；全蹲對部分肌群有較大增長 [Kubo 2019][R18]，但個人活動度不同。 |
| Q4. 深蹲膝路徑 | 腳尖小幅外開，膝蓋沿身體前後方向朝正前方前進，不刻意朝腳尖方向；避免失控向內塌，按個人狀況觀察，不訂角度線。 | 這是教練經驗，目的是讓內收肌參與。站距研究對內收肌活化結果不一 [McCaw 1999][R39]、[Paoli 2009][R40]；[Collings 2026][R35] 支持內收大肌參與深蹲，[Chiu 2025][R37] 的膝內／外路徑比較未證明此提示可提高其增長；腳尖大幅外開卻讓膝直行的扭轉風險幅度未查證。 |
| Q5. 槓鈴划船軀幹角 | 保留相對直立前傾約 60° 作健美示範起點，可依背闊肌／上背目標調整。 | [Fenwick 2009][R19] 顯示划船型式改變肌肉活動與腰椎負荷，未提供通用最佳角；60° 不是安全線。 |
| Q6. 臥推握距與肘外展 | 保留約 1.6 倍肩峰寬、肘外展約 52° 的現有示範；保留窄握選項，肩不適時調整。 | [Noteboom 2024][R11] 顯示握距、肩胛後收改變模型肩關節力，沒有證明 1.6 倍或 52° 是普遍最佳。 |
| Q7. 肩上舉與直立划船 | 先用舒適、可控制的行程；直立划船不設自動合格高度。 | 肩胛與肩峰下空間有生物力學依據 [Ludewig 2011][R24]；模型缺獨立肱骨內旋，不能判斷特定夾擠風險。 |
| Q8. 動作末端保留角度 | 由個人活動度、疼痛及控制決定端點；程式 `rom` 警示只作人工提示。 | 全行程及長肌長局部行程均有增肌研究 [Pallarés 2021][R02]、[Kassiano 2023][R03]；沒有通用負重安全角。 |
| Q9. 深蹲與臥推呼吸 | 一般組下放吸氣、站起或推起時有控制地吐出部分氣，保留胸腔與軀幹張力；臥推全程維持胸廓擴張、肋骨有張力，推起不把氣吐光。大重量短暫憋氣由教練按個人狀況判斷。 | [NSCA 官方手冊][R38] 建議吃力處吐氣、較輕鬆時吸氣；「部分吐氣、不塌胸」是教練經驗。[Hackett 2013][R12]、[Linsenbardt 1992][R13] 分別說明腹壓作用及血壓反應；不訂一刀切負重百分比。 |
| Q10. 足弓與三點支撐 | 三點支撐只作保持全腳接觸的口語提示，不要求足弓完全不變，也不由模型自動評分。 | 足弓負重可形變 [Powell 2012][R16]；三點壓力比例或足弓下降的重訓傷害界線未找到。 |

## 四、與目前模型的初步對照（只列觀察）

- 以預設 1.75 m、75 kg 身體、各 lift 的預設參數、`e=0, 0.25, 0.5, 0.75, 1` 讀取 `analyze()`；下表單位為 **`pose.cop[2] × 100` 公分**。模型把 `z=0` 當腳掌**名義中段**；以 `pose.R.heel`／`pose.R.toe` 的幾何中點算會再差約 0.6–0.8 cm。正值往腳尖，負值往腳跟。這是模型估值，不是壓力板實測；滑輪有水平外力時也不等於單純系統重心投影。

  | 預設動作 | e=0 | e=0.25 | e=0.5 | e=0.75 | e=1 |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | 高槓深蹲 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
  | 傳統硬舉 | -2.2 | +0.8 | **-2.8** | -4.9 | -3.7 |
  | RDL | -2.4 | -1.9 | **-4.2** | -5.1 | -3.6 |
  | 槓鈴划船 | +1.9 | +1.6 | **+1.6** | +1.5 | +1.6 |
  | 站姿肩推 | +2.1 | +2.5 | +2.7 | +2.6 | +2.0 |

- G1 目前只能檢查準靜態單腳合成壓力中心；史密斯、腿推、哈克、臀推等有軌道／靠墊／多接點反力，不能直接套用「人＋器材重心落腳中段」。槓鈴划船的名義前 1.6 cm 可作後續審核基準，但尚未確立容許界線。
- 自由深蹲與高腳杯深蹲預設膝沿正前方，腳尖按站距外開；可切換「跟著腳尖」重現原幾何。預設站距下高槓腳尖約 17°、膝路徑 0°；這是水平面方向差代理，不是脛股軸旋量或受傷風險。模型最低點高槓內收大肌活化由舊路徑 0.207 變 0.243、臀中肌 0.103 變 0.067，僅表示目前肌肉分配模型的結果，不能當作肌電或長期增肌證據。寬站軀幹比對改善，詳見[深蹲結果](results/squat.md)。
- 水平推目前只能以臥推及坐姿胸推的 `P.scap` 設定代理肩胛姿勢；伏地挺身沒有同等可調設定。模型缺胸椎拱起、胸廓擴張、肋骨張力及呼吸相位，不能檢查全程不塌胸或部分吐氣；[Noteboom 2024][R11] 的肩關節力比較也只適用其臥推實驗條件。
- G2、G4、G6、G7、G8 的關鍵量目前缺失：腰椎分段／骨盆、可靠手腕與獨立肱骨內外旋、呼吸／腹壓／血壓、速度／加速度、足弓與三點壓力。`brace`、`round`、`q.shRot` 不可冒充這些量。
- 現有 `rom` 警示使用髖屈 136°、膝屈 138°、踝背屈 36°、肘屈 140°、舉臂 178° 等程式界線；本次未找到足以把它們當作普遍負重安全門檻的依據。這些值應留作**模型提示**，供教練逐人判讀。
- 肌肉分配有已知偏差：直立划船肩袖排名偏高；窄握臥推胸大肌偏低；槓鈴與坐姿划船背闊肌／中斜方肌排名不穩；上斜臥推前臂偏斜；雙槓／引體肩胛下壓能力不足。因此 P、L、D、V 類的「目標肌排名」只能作**需人工查核的模型觀察**，不作技術合格判準。詳見[限制與已知問題](limitations.md)。

## 參考資料（已核對 PubMed／期刊頁）

以下編號對應上表。標題保留原文，連結直達可核對的 PubMed 頁；同一來源重複使用時不代表有多項獨立證據。未找到特定技術主張的直接實證，已在該條標明「未找到實證，屬教練共識」。

- **R01** Saraceni 等，2020，[*To Flex or Not to Flex? Is There a Relationship Between Lumbar Spine Flexion During Lifting and Low Back Pain? A Systematic Review With Meta-analysis*](https://pubmed.ncbi.nlm.nih.gov/31775556/)。DOI: 10.2519/jospt.2020.9218。
- **R02** Pallarés 等，2021，[*Effects of range of motion on resistance training adaptations: A systematic review and meta-analysis*](https://pubmed.ncbi.nlm.nih.gov/34170576/)。DOI: 10.1111/sms.14006。
- **R03** Kassiano 等，2023，[*Which ROMs Lead to Rome? A Systematic Review of the Effects of Range of Motion on Muscle Hypertrophy*](https://pubmed.ncbi.nlm.nih.gov/36662126/)。DOI: 10.1519/JSC.0000000000004415。
- **R04** Roach 等，1991，[*Normal hip and knee active range of motion: the relationship to age*](https://pubmed.ncbi.nlm.nih.gov/1881956/)。DOI: 10.1093/ptj/71.9.656。
- **R05** Enes 等，2025，[*How Slow Should You Go? A Systematic Review With Meta-Analysis of the Effect of Resistance Training Repetition Tempo on Muscle Hypertrophy*](https://pubmed.ncbi.nlm.nih.gov/42709703/)。DOI: 10.1519/JSC.0000000000005302。
- **R06** Fry、Smith、Schilling，2003，[*Effect of knee position on hip and knee torques during the barbell squat*](https://pubmed.ncbi.nlm.nih.gov/14636100/)。DOI: `10.1519/1533-4287(2003)017<0629:EOKPOH>2.0.CO;2`。
- **R07** Straub、Powers，2024，[*A Biomechanical Review of the Squat Exercise: Implications for Clinical Practice*](https://pubmed.ncbi.nlm.nih.gov/38576836/)。DOI: 10.26603/001c.94600。
- **R08** Wilczyński 等，2020，[*Dynamic Knee Valgus in Single-Leg Movement Tasks. Potentially Modifiable Factors and Exercise Training Options. A Literature Review*](https://pubmed.ncbi.nlm.nih.gov/33172101/)。DOI: 10.3390/ijerph17218208。
- **R09** Asayama 等，2021，[*Influence of stance width and toe direction on medial knee contact force during bodyweight squats*](https://pubmed.ncbi.nlm.nih.gov/34717162/)。DOI: 10.1016/j.jbiomech.2021.110824。
- **R10** Polovinets 等，2018，[*Force transmission through the wrist during performance of push-ups on a hyperextended and a neutral wrist*](https://pubmed.ncbi.nlm.nih.gov/28684196/)。DOI: 10.1016/j.jht.2017.04.005。
- **R11** Noteboom 等，2024，[*Effects of bench press technique variations on musculoskeletal shoulder loads and potential injury risk*](https://pubmed.ncbi.nlm.nih.gov/38974522/)。DOI: 10.3389/fphys.2024.1393235。
- **R12** Hackett、Chow，2013，[*The Valsalva maneuver: its effect on intra-abdominal pressure and safety issues during resistance exercise*](https://pubmed.ncbi.nlm.nih.gov/23222073/)。DOI: 10.1519/JSC.0b013e31827de07d。
- **R13** Linsenbardt、Thomas、Madsen，1992，[*Effect of breathing techniques on blood pressure response to resistance exercise*](https://pubmed.ncbi.nlm.nih.gov/1623367/)。DOI: 10.1136/bjsm.26.2.97。
- **R14** Arjmand、Shirazi-Adl，2006，[*Role of intra-abdominal pressure in the unloading and stabilization of the human spine during static lifting tasks*](https://pubmed.ncbi.nlm.nih.gov/16333683/)。DOI: 10.1007/s00586-005-0012-9。
- **R15** Nachemson、Andersson、Schultz，1986，[*Valsalva maneuver biomechanics. Effects on lumbar trunk loads of elevated intraabdominal pressures*](https://pubmed.ncbi.nlm.nih.gov/3750086/)。PubMed PMID: 3750086；DOI 未查得。
- **R16** Powell 等，2012，[*Effects of vertical loading on arch characteristics and intersegmental foot motions*](https://pubmed.ncbi.nlm.nih.gov/21975372/)。DOI: 10.1123/jab.28.2.165。
- **R17** Straub 等，2025，[*Targeting the hip and/or knee extensors during the back squat in males and females: A repeated measures decision tree analysis using the relative difference in trunk and tibia inclination and knee flexion angle*](https://pubmed.ncbi.nlm.nih.gov/40157154/)。DOI: 10.1016/j.ptsp.2025.03.008。
- **R18** Kubo 等，2019，[*Effects of squat training with different depths on lower limb muscle volumes*](https://pubmed.ncbi.nlm.nih.gov/31230110/)。DOI: 10.1007/s00421-019-04181-y。
- **R19** Fenwick 等，2009，[*Comparison of different rowing exercises: trunk muscle activation and lumbar spine motion, load, and stiffness*](https://pubmed.ncbi.nlm.nih.gov/19620925/)。DOI: 10.1519/JSC.0b013e3181b07334。
- **R20** Martín-Fuentes 等，2020，[*Electromyographic activity in deadlift exercise and its variants. A systematic review*](https://pubmed.ncbi.nlm.nih.gov/32107499/)。DOI: 10.1371/journal.pone.0229507。
- **R21** Lee 等，2018，[*An electromyographic and kinetic comparison of conventional and Romanian deadlifts*](https://pubmed.ncbi.nlm.nih.gov/30662500/)。DOI: 10.1016/j.jesf.2018.08.001。
- **R22** Mausehund 等，2022，[*Understanding Bench Press Biomechanics—The Necessity of Measuring Lateral Barbell Forces*](https://pubmed.ncbi.nlm.nih.gov/33555823/)。DOI: 10.1519/JSC.0000000000003948。
- **R23** Phadke、Camargo、Ludewig，2009，[*Scapular and rotator cuff muscle activity during arm elevation: A review of normal function and alterations with shoulder impingement*](https://pubmed.ncbi.nlm.nih.gov/20411160/)。DOI: 10.1590/S1413-35552009005000012。
- **R24** Ludewig、Braman，2011，[*Shoulder impingement: biomechanical considerations in rehabilitation*](https://pubmed.ncbi.nlm.nih.gov/20888284/)。DOI: 10.1016/j.math.2010.08.004。
- **R25** Lehman 等，2004，[*Variations in muscle activation levels during traditional latissimus dorsi weight training exercises: An experimental study*](https://pubmed.ncbi.nlm.nih.gov/15228624/)。DOI: 10.1186/1476-5918-3-4。
- **R26** Andersen 等，2014，[*Effects of grip width on muscle strength and activation in the lat pull-down*](https://pubmed.ncbi.nlm.nih.gov/24662157/)。DOI: 10.1097/JSC.0000000000000232。
- **R27** Buonsenso 等，2025，[*Electromyographic Analysis of Back Muscle Activation During Lat Pulldown Exercise: Effects of Grip Variations and Forearm Orientation*](https://pubmed.ncbi.nlm.nih.gov/40981044/)。DOI: 10.3390/jfmk10030345。
- **R28** Yasojima 等，2008，[*Differences in EMG activity in scapular plane abduction under variable arm positions and loading conditions*](https://pubmed.ncbi.nlm.nih.gov/18317372/)。DOI: 10.1249/MSS.0b013e31816073fb。
- **R29** Martín-Fuentes 等，2020，[*Evaluation of the Lower Limb Muscles' Electromyographic Activity during the Leg Press Exercise and Its Variants: A Systematic Review*](https://pubmed.ncbi.nlm.nih.gov/32605065/)。DOI: 10.3390/ijerph17134626。
- **R30** Da Silva 等，2008，[*Analysis of muscle activation during different leg press exercises at submaximum effort levels*](https://pubmed.ncbi.nlm.nih.gov/18545207/)。DOI: 10.1519/JSC.0b013e3181739445。
- **R31** Maeo 等，2021，[*Greater Hamstrings Muscle Hypertrophy but Similar Damage Protection after Training at Long versus Short Muscle Lengths*](https://pubmed.ncbi.nlm.nih.gov/33009197/)。DOI: 10.1249/MSS.0000000000002523。
- **R32** Larsen 等，2025，[*The effects of hip flexion angle on quadriceps femoris muscle hypertrophy in the leg extension exercise*](https://pubmed.ncbi.nlm.nih.gov/39699974/)。DOI: 10.1080/02640414.2024.2444713。
- **R33** Hof，2007，[*The equations of motion for a standing human reveal three mechanisms for balance*](https://pubmed.ncbi.nlm.nih.gov/16530203/)。DOI: 10.1016/j.jbiomech.2005.12.016。
- **R34** Takahashi 等，2025，[*Redefining muscular action: human "adductor" magnus is designed to act primarily for hip "extension" rather than adduction in living young individuals*](https://pubmed.ncbi.nlm.nih.gov/40139264/)。DOI: 10.1152/japplphysiol.00600.2024。人體肌束幾何與力矩能力研究，未比較深蹲膝路徑。
- **R35** Collings 等，2026，[*Hip Adductor Muscle Forces during Strength Training and Rehabilitation Exercises*](https://pubmed.ncbi.nlm.nih.gov/41931009/)。DOI: 10.1249/MSS.0000000000004002。EMG 輔助肌骨模型估計深蹲時內收大肌坐骨髁束高受力，未比較膝朝向或深淺。
- **R36** Reece 等，2020，[*Barbell back squat: how do resistance bands affect muscle activation and knee kinematics?*](https://pubmed.ncbi.nlm.nih.gov/32095265/)。DOI: 10.1136/bmjsem-2019-000610。膝外環帶改變膝外翻與脛骨旋轉，不能當作主動「膝朝前」的直接試驗。
- **R37** Chiu、Fry，2025，[*Effects of Lower Extremity Alignment During Barbell Squat Training on Muscle Volumes*](https://pubmed.ncbi.nlm.nih.gov/40570305/)。DOI: 10.1519/JSC.0000000000005179。11 名初學女性六週膝內／外路徑介入，未證實內收大肌增長差異；不等同本文件的膝朝前提示。
- **R38** NSCA，[*Basics of Strength and Conditioning*，Breathing Considerations](https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf)。官方手冊建議最吃力處吐氣、較輕鬆段吸氣；未規定「吐多少」或每次都須離心吸、向心吐。
- **R39** McCaw、Melrose，1999，[*Stance width and bar load effects on leg muscle activity during the parallel squat*](https://pubmed.ncbi.nlm.nih.gov/10188748/)。DOI: 10.1097/00005768-199903000-00012。站距與階段交互影響內收長肌 EMG；未測內收大肌或膝朝前提示。
- **R40** Paoli、Marcolin、Petrone，2009，[*The effect of stance width on the electromyographical activity of eight superficial thigh muscles during back squat with different bar loads*](https://pubmed.ncbi.nlm.nih.gov/19130646/)。DOI: 10.1519/JSC.0b013e3181876811。六名有經驗舉者的站距實驗，除臀大肌外未見受測肌群 EMG 顯著差異，含內收肌與臀中肌。

[R01]: https://pubmed.ncbi.nlm.nih.gov/31775556/
[R02]: https://pubmed.ncbi.nlm.nih.gov/34170576/
[R03]: https://pubmed.ncbi.nlm.nih.gov/36662126/
[R04]: https://pubmed.ncbi.nlm.nih.gov/1881956/
[R05]: https://pubmed.ncbi.nlm.nih.gov/42709703/
[R06]: https://pubmed.ncbi.nlm.nih.gov/14636100/
[R07]: https://pubmed.ncbi.nlm.nih.gov/38576836/
[R08]: https://pubmed.ncbi.nlm.nih.gov/33172101/
[R09]: https://pubmed.ncbi.nlm.nih.gov/34717162/
[R10]: https://pubmed.ncbi.nlm.nih.gov/28684196/
[R11]: https://pubmed.ncbi.nlm.nih.gov/38974522/
[R12]: https://pubmed.ncbi.nlm.nih.gov/23222073/
[R13]: https://pubmed.ncbi.nlm.nih.gov/1623367/
[R14]: https://pubmed.ncbi.nlm.nih.gov/16333683/
[R15]: https://pubmed.ncbi.nlm.nih.gov/3750086/
[R16]: https://pubmed.ncbi.nlm.nih.gov/21975372/
[R17]: https://pubmed.ncbi.nlm.nih.gov/40157154/
[R18]: https://pubmed.ncbi.nlm.nih.gov/31230110/
[R19]: https://pubmed.ncbi.nlm.nih.gov/19620925/
[R20]: https://pubmed.ncbi.nlm.nih.gov/32107499/
[R21]: https://pubmed.ncbi.nlm.nih.gov/30662500/
[R22]: https://pubmed.ncbi.nlm.nih.gov/33555823/
[R23]: https://pubmed.ncbi.nlm.nih.gov/20411160/
[R24]: https://pubmed.ncbi.nlm.nih.gov/20888284/
[R25]: https://pubmed.ncbi.nlm.nih.gov/15228624/
[R26]: https://pubmed.ncbi.nlm.nih.gov/24662157/
[R27]: https://pubmed.ncbi.nlm.nih.gov/40981044/
[R28]: https://pubmed.ncbi.nlm.nih.gov/18317372/
[R29]: https://pubmed.ncbi.nlm.nih.gov/32605065/
[R30]: https://pubmed.ncbi.nlm.nih.gov/18545207/
[R31]: https://pubmed.ncbi.nlm.nih.gov/33009197/
[R32]: https://pubmed.ncbi.nlm.nih.gov/39699974/
[R33]: https://pubmed.ncbi.nlm.nih.gov/16530203/

[R34]: https://pubmed.ncbi.nlm.nih.gov/40139264/
[R35]: https://pubmed.ncbi.nlm.nih.gov/41931009/
[R36]: https://pubmed.ncbi.nlm.nih.gov/32095265/
[R37]: https://pubmed.ncbi.nlm.nih.gov/40570305/
[R38]: https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf
[R39]: https://pubmed.ncbi.nlm.nih.gov/10188748/
[R40]: https://pubmed.ncbi.nlm.nih.gov/19130646/
