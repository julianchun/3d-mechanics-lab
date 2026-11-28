// 清單預設姿勢的生理合理性驗收；每條肌肉只比較主動活化 a，避免被動張力與顯示截斷掩蓋超載。
import { CATALOG } from '../src/catalog.js';
import { analyze, defaultParams, BODY, MUSCLE_GROUP_IDS } from '../src/biomech.js';

// 排名用畫面顯示的 s（主動活化加被動份額）；超載門檻只用未截斷的 a。
// 文獻趨勢見 docs/research/references.md；同一肌肉的不同動作峰值不等於跨肌肉 EMG 百分比。
// 排名邊界容許近平手；規則與量級見 docs/research/rank-tolerance-plan.md。
const RANKS = {
  'squat-high': { top3: ['vasti'] }, 'squat-low': { top3: ['vasti'] }, 'front-squat': { top3: ['vasti'] },
  'goblet-squat': { first: ['vasti'] },
  'smith-squat': { top2: ['vasti'] }, 'leg-press': { top2: ['vasti'] },
  'hack-squat': { first: ['vasti'] },
  deadlift: { top3: ['erec', 'hams', 'gmax'] }, 'deficit-dl': { top3: ['erec', 'hams', 'gmax'] },
  'block-pull': { top3: ['erec', 'hams', 'gmax'] }, sumo: { top3: ['erec', 'hams', 'gmax'] },
  'hip-thrust': { top2: ['gmax'] }, 'glute-bridge': { top2: ['gmax'] },
  'back-extension': { top3: ['erec', 'hams', 'gmax'] },
  bench: { first: ['pecs'] }, 'incline-bench': { first: ['pecs', 'adelt'], allTop3: ['pecs', 'adelt'] }, 'cg-bench': { top3: ['trilat'] },
  'floor-press': { first: ['pecs'] }, 'db-bench': { first: ['pecs'] }, 'db-bench-incline': { first: ['pecs', 'adelt'], allTop3: ['pecs', 'adelt'] }, 'chest-press': { top3: ['pecs'] }, ohp: { top2: ['adelt'] },
  pushup: { top2: ['pecs'] }, 'pushup-feet': { top2: ['pecs'] }, 'pushup-hands': { top2: ['pecs'] },
  dips: { top2: ['pecs', 'trilat'] }, 'dips-upright': { top2: ['pecs', 'trilat'] },
  pullup: { top2: ['lat'] }, 'pullup-wide': { top2: ['lat'] }, chinup: { top2: ['lat', 'bic'] },
  'assist-pullup': { top2: ['lat'] }, 'assist-chinup': { top2: ['lat'] },
  'db-press': { top2: ['adelt'] },
  'pec-deck': { first: ['pecs', 'pecc'] },
  'reverse-deck': { top2: ['pdelt'] }, 'db-reverse-fly': { top2: ['pdelt'] }, 'machine-press': { top2: ['adelt'] },
  'cable-fly-high': { first: ['pecs', 'pecc'] },
  'cable-fly-mid': { first: ['pecs', 'pecc'] },
  'cable-fly-low': { first: ['pecs', 'pecc'] },
  pulldown: { first: ['lat'], notTop4: ['pecs'] }, 'pulldown-sup': { first: ['lat'], notTop4: ['pecs'] },
  row: { within: { lat: 4, midtrap: 4 } }, 'row-sup': { within: { lat: 4, midtrap: 4 } },
  'cable-row': { within: { lat: 4, midtrap: 4 } }, 'cable-row-wide': { within: { lat: 4, midtrap: 4 } },
  curl: { first: ['bic', 'brach'] }, 'reverse-curl': { first: ['bic', 'brach'] },
  'lat-raise': { first: ['mdelt', 'supsp'] },
  'db-curl': { first: ['bic'] }, 'hammer-curl': { first: ['brach', 'bic'] },
  pushdown: { first: ['trilat', 'trilong'] }, 'leg-ext': { first: ['vasti'] },
  'calf-raise-standing': { first: ['gas', 'sol'] }, 'calf-raise-seated': { first: ['sol'], above: [['sol', 'gas']] },
  'hip-abduction': { first: ['gmed'] }, 'hip-adduction': { first: ['addl', 'addmag'] },
  'leg-curl': { first: ['hams'] }, 'lying-leg-curl': { first: ['hams'] }, shrug: { first: ['uptrap'] },
  uprow: { notFirst: ['infra'] },
  rdl: { top3: ['hams'] }, 'good-morning': { top3: ['hams'] },
  'skull-crusher': { first: ['trilat', 'trilong'] },
  'db-overhead-ext': { first: ['trilat', 'trilong'] },
  'cable-overhead-ext': { first: ['trilat', 'trilong'] },
  'preacher-curl': { top3: ['bic', 'brach'] },
  'incline-db-curl': { first: ['bic', 'brach'] },
  'db-front-raise': { first: ['adelt'] },
  'db-pullover': { top3: ['lat', 'pecs'] },
  'chest-supported-row': { top3: ['lat', 'midtrap'] },
  'cable-pull-through': { top3: ['gmax', 'hams'] },
};

// 規則照常執行；每項已知失敗都要保留目前結果、原因和預計修正方向。
const KNOWN_ISSUES = [
  ...[
    ['incline-db-curl', 'rank:first', '胸大肌高於肘屈肌', '後傾椅背與兩手自由承重使肩部穩定分配偏高；現有肌肉模型未經上斜彎舉三維力矩校準'],
    ['cable-pull-through', 'rank:top3', '髖伸肌未進前三名', '握點隨肩移動後髖伸需求增加，但肩部承受約 172 N 繩索力且站姿軀幹重力較大；肌肉分配尚無同條件量測'],
    ['db-overhead-ext', 'rank:first', '棘上肌高於三頭肌', '補入肩外展及肩帶自由度後，上舉近 169° 時現有肩肌的有效力臂與最大力不足；原先單一肩屈軸漏算較大的外展需求'],
    ['cable-overhead-ext', 'rank:first', '後三角高於三頭肌', '修正頭後握點後，後方低滑輪對高舉上臂產生肩伸需求；現有後三角有效能力與出繩口幾何未經校準'],
  ].map(([id, rule, current, cause]) => ({ id, rule, kind: '新增動作肌群分配', current, cause,
    fix: '取得同動作的三維握點反力、關節力矩與器材位置後核對；暫不按排名調整肌肉常數' })),
  ...Object.entries({
    'db-overhead-ext': ['trilong', 'supsp', 'pdelt', 'mdelt', 'tmaj'],
    'cable-overhead-ext': ['pdelt'],
    'db-pullover': ['pdelt', 'supsp'],
    'chest-supported-row': ['pdelt'],
    'cable-pull-through': ['adelt'],
  }).flatMap(([id, muscles]) => muscles.map((muscle) => ({
    id, rule: `activation:${muscle}`, kind: '新增動作超載',
    current: `${muscle} 的模型主動活化超過 1`,
    cause: id === 'cable-pull-through' ? '自然下垂的近直臂仍承受約 172 N 後下方繩索力；肩屈需求及前三角有效能力未經同條件驗證' :
      id === 'chest-supported-row' ? '胸靠姿勢下肩伸展需求由後三角分擔，現有肩肌能力與胸墊接觸幾何未經同條件校準' :
      id === 'db-overhead-ext' ? muscle === 'trilong' ? '底端三頭長頭力臂與最大力仍是模型估計，14 kg 共握啞鈴負重未與同條件實測校準' :
        '補入肩外展的正交力矩後，上舉近極點時棘上肌與後三角等肩肌的有效力臂縮小，現有最大力不足以平衡完整三維需求' :
      id === 'db-pullover' ? '頭後下放至高舉角時，新增肩外展分量要求棘上肌與後三角承擔更多力矩；有效力臂與同條件三維力矩未校準' :
        '修正頭後握點後，繩索由後下方拉住高舉把手，後三角有效能力與滑輪站位幾何未以同條件校準',
    fix: '以實機器材位置、握點反力與三維關節力矩核對；暫不為通過門檻調整 F、力臂或逐動作偏好',
  }))),
  {
    id: 'hip-thrust', rule: 'trend:gmaxLower', kind: '區域性文獻趨勢',
    current: '臀推臀大肌中下部峰值 0.495，低於高槓深蹲 0.571；Contreras 2015 實測方向相反',
    cause: '峰值幀髖外展需求為臀推 +30.6、深蹲 −22.4 N·m；中下部在模型中為髖內收肌，深蹲的額狀面需求增加其分配。髖伸共用繞行估計，支撐反力亦未與研究條件校準',
    fix: '以同負重條件的區域肌電與三維力矩重新核對；%MVIC 不與模型活化數值等同',
  },
  ...['deadlift', 'deficit-dl'].map((id) => ({
    id, rule: 'activation:erec', kind: '起槓幾何變更',
    current: '離地端腰背伸肌模型活化略高於 1',
    cause: '足中段槓位、小腿貼槓與肩在槓上方的閉鏈求解改變髖與軀幹力臂；腰背伸肌最大力和力臂仍是估計值',
    fix: '取得同姿勢腰薦力矩與肌肉能力資料後校核，暫不按測試組結果調整肌肉常數',
  })),
  ...['deadlift', 'deficit-dl'].map((id) => ({
    id, rule: 'activation:lat', kind: '拉起時序變更',
    current: '過膝附近背闊肌模型活化略高於 1',
    cause: 'H1／H2 軀幹角在過膝前維持起槓角，手臂與槓的力臂變大；背闊肌肩部與肩胛下壓等效能力尚未以同條件資料校準',
    fix: '取得過膝附近手部反力與肩胛力矩資料後檢核，暫不調整肌肉常數',
  })),
  {
    id: 'goblet-squat', rule: 'rank:first', kind: '預設變更',
    current: 'dom=0.25 時全程峰值臀大肌約 0.42，股廣肌約 0.37；最低點股廣肌居全肌第 2',
    cause: '依教練決定還原高腳杯主導預設，較 0.05 減少膝前移並增加髖與軀幹需求；原股廣肌第一名準則仍保留執行',
    fix: '待同條件姿勢與肌群量測後檢核高腳杯的力矩及肌肉分配，暫不調整模型常數或排名準則',
  },
  ...Object.entries({
    dips: ['pecs', 'lat', 'tmaj'], 'dips-upright': ['pecs', 'lat', 'tmaj'],
    chinup: ['brach'],
  }).flatMap(([id, muscles]) => muscles.map((muscle) => ({
    id, rule: `activation:${muscle}`, kind: '新動作', current: `${muscle} 的模型主動活化超過 1`,
    cause: muscle === 'lat' && ['dips', 'dips-upright'].includes(id)
      ? `每手承受約 368 N；肩胛下壓需求約 ${id === 'dips' ? 99 : 102} Nm（上舉近 45–58°、肩在手上方）；背闊肌 scElev 力臂改為 TSM 擬合（約 −120～−140 mm）後活化由 2.3 降到 1.6，但下壓能力仍由背闊肌、胸大肌、下斜方共同逼近全肌上限`
      : muscle === 'tmaj' && ['dips', 'dips-upright'].includes(id)
      ? '背闊肌、胸大肌 scElev 力臂放大後，肩內收與肩伸需求的分攤改變；大圓肌有效 F 只有 144 N，成為瓶頸（由 2.0 升到約 3.6）；與總診斷的大圓肌 F 問題同源，尚未處理'
      : '手部承受全身重量，對應肩肘需求超過目前未以自體重量動作校準的肌肉力臂與最大力估計',
    fix: '以量測的手部反力與關節力矩驗證姿勢及負荷，再檢討共用肌肉模型，暫不手調常數',
  }))),
  {
    id: 'hammer-curl', rule: 'rank:first', kind: '前臂旋轉模型', current: '詳細視圖肱橈肌約 1.33，但一般視圖與肱肌合群後前三角肌仍居首',
    cause: '中立握時肱橈肌與肱肌的力臂及活化差異很大；一般視圖採 F 加權合群，肱肌的較大 F 降低群組平均值',
    fix: '以同條件量測核對肱橈肌區域肌電與群組呈現方式，暫不調整肌肉力臂或偏好',
  },
  {
    id: 'db-reverse-fly', rule: 'activation:pdelt', kind: '新動作', current: '預設每顆 6 kg 啞鈴於展開頂點時三角肌後束主動活化（1.15）超過 1.0',
    cause: '近直臂（肘微彎 20°）水平外展約 58 cm 力臂承受 6 kg 啞鈴與手臂自重，現有三角肌後束有效最大力（675 N）與水平外展力臂（40 mm）不足以負擔全行程需求（與既有反向蝴蝶機 reverse-deck 同源）',
    fix: '待以實測水平外展力矩與肩胛後收模型共同核對後三角有效最大力，暫不修改 MUSCLES 參數',
  },
  {
    id: 'reverse-deck', rule: 'activation:pdelt', kind: '新動作', current: '預設 40 kg 配重時後三角肌需求超過最大主動活化',
    cause: '52 cm 握把與 22 cm 等效凸輪下，現有後三角肌最大力和力臂不足以負擔全行程估計力矩；肩胛後收需求約 57 Nm 也偏高；機台實際凸輪曲線未查證',
    fix: '量測實機握把阻力曲線，再核對後三角肌有效最大力；肩胛後收需求待肩胛模型後續處理，暫不手調模型參數',
  },
  {
    id: 'back-extension', rule: 'model:padHeight', kind: '新動作', current: '墊高無法改變髖與腰背力矩分配',
    cause: '單一剛體軀幹與固定腰背受力點無法描述墊子壓住骨盆時髖鉸鏈受限；墊高只影響肌肉長度與畫面，圓背也沒有逐節腰椎屈曲',
    fix: '取得骨盆與腰椎分段運動及墊子壓力資料後，建立分段軀幹與骨盆接觸模型',
  },
  {
    id: 'uprow', rule: 'rank:notFirst',
    kind: '既有問題', current: '棘下肌／小圓肌仍居首',
    cause: '握把力線沿上臂軸造成外旋需求；新增棘上肌與前臂旋轉自由度後，仍由棘下肌／小圓肌承擔最多，缺可核對的握把接觸偶矩',
    fix: '取得握把軸向力矩量測並拆分肩袖肌束，再校準外旋分攤',
  },
  ...[
    ['pulldown', 'rank:first', '正握下拉第一名為肩胛下肌'],
    ['pulldown-sup', 'rank:first', '反握下拉第一名為肩胛下肌'],
  ].map(([id, rule, current]) => ({
    id, rule, kind: '肩帶力臂改用 TSM', current,
    cause: '背闊肌 scElev 力臂改為 TSM 擬合（約 −130 mm）後，背闊肌只需約 0.6 即可承擔肩胛下壓；肩內旋需求 48 N·m 在最小 Σa² 分配下由肩胛下肌分擔較多（0.79）。是分配結果，不是力臂擬合誤差；肩內旋與旋轉肌袖分工尚無同條件資料校準',
    fix: '待肱骨旋轉自由度與旋轉肌袖力臂有出處後檢核，暫不為通過排名調參',
  })),
  ...[
    ['row', 'rank:lat:top4', '背闊肌未進前四（上斜方、後三角、中斜方／菱形、豎脊肌在前）'],
    ['row-sup', 'rank:lat:top4', '背闊肌未進前四'],
    ['cable-row', 'rank:lat:top4', '背闊肌未進前四'],
    ['cable-row', 'rank:midtrap:top4', '中斜方／菱形肌未進前四（上斜方、肱肌、豎脊肌、中三角在前）'],
    ['cable-row-wide', 'rank:lat:top4', '背闊肌未進前四'],
  ].map(([id, rule, current]) => ({
    id, rule, kind: '肩帶力臂改用 TSM', current,
    cause: '划船終點需求為肩胛上提 scElev 約 +36 N·m，而背闊肌 scElev 力臂為負（TSM 約 −130 mm）：背闊肌在這一軸是拮抗肌，最小 Σa² 分配壓低它；與 T13d 七座標結果（背闊肌在三種划船皆 0）一致，是 TSM 與 DAS3 兩模型共同的幾何，不是擬合造成。上斜方等肩帶肌的力臂尚為估計常數，下一步更換後排名會再變',
    fix: '待斜方、前鋸、提肩胛肌換用有出處的力臂後重新檢核；暫不為通過排名改回常數，也不調整 F',
  })),
  {
    id: 'cable-row', rule: 'activation:brachioradialis', kind: '肩帶力臂改用 TSM',
    current: '肱橈肌獨立主動活化 1.04，超過 1',
    cause: '背闊肌退出划船後肘屈與肩部需求重新分配，肱橈肌由 <1 升到 1.04；前臂細分的 F 與力臂本身尚未驗證',
    fix: '取得同條件前臂肌肉能力與肌電後核對；暫不調 F',
  },
  ...['dips', 'dips-upright'].flatMap((id) => ['uptrap', 'corb'].map((muscle) => ({
    id, rule: `activation:${muscle}`, kind: '肩帶力臂改用 TSM', current: `${muscle} 的模型主動活化超過 1`,
    cause: '撐體 e=0.95：背闊肌與胸大肌被肩內收／肩伸需求推到超載，其 TSM 力臂同時產生遠超需求的肩胛下壓與前伸力矩（需求 −99／−26 N·m），平衡需靠上斜方（TSM scElev 僅約 +30～+43 mm、scRet 約 +73 mm）共收縮抵消，喙肱肌亦略超載；上斜方與前鋸肌（scElev 正、scRet 負）形成上旋力偶是 TSM 幾何的結果，不是 F 或力臂擬合誤差',
    fix: '待斜方、前鋸肌換用有出處的力臂與大圓肌 F 校準後重新檢核；暫不調參',
  }))),
  ...[
    ['ohp', 'activation:serr', '站姿肩推前鋸肌主動活化 2.05，超過 1'],
    ['ohp', 'rank:top2', '站姿肩推前兩名為前鋸肌與上斜方，前三角未進前二'],
    ['db-press', 'activation:serr', '坐姿啞鈴肩推前鋸肌主動活化 1.45，超過 1'],
    ['db-press', 'rank:top2', '坐姿啞鈴肩推前兩名為前鋸肌與上斜方，前三角未進前二'],
    ['machine-press', 'activation:serr', '肩推機前鋸肌主動活化 1.08，超過 1'],
    ['dips', 'activation:serr', '撐體前鋸肌主動活化 1.49，超過 1'],
    ['dips-upright', 'activation:serr', '直立撐體前鋸肌主動活化 1.40，超過 1'],
    ['lat-raise', 'rank:first', '側平舉第一名為前鋸肌，中三角與棘上肌在後'],
    ['shrug', 'rank:first', '聳肩第一名為前鋸肌，上斜方在後'],
  ].map(([id, rule, current]) => ({
    id, rule, kind: '肩帶力臂全面改用 TSM', current,
    cause: 'TSM 映射 B 的上斜方 scElev 只有約 +31～+43 mm、scRet 約 +73 mm（舊常數 +70／+20 mm）：上提需求（+53～+78 N·m）由上斜方承擔時同時產生約 2 倍的後收，必須由前鋸肌（scElev 約 +55 mm、scRet 約 −65 mm）以上旋力偶抵消，前鋸肌有效 F 只有 1000 N，於是成為瓶頸。肩推 e=0 時上斜方 scRet +107、前鋸肌 −89 N·m 互相抵消。斜方—前鋸肌同為上旋協同肌（Seth 2019），方向有出處，但量值依 TSM 受試者與映射 B；未做體型縮放',
    fix: '待前鋸肌有效 F（Seth 來源 1325.8 N，產品 1000 N）與肩帶需求定義（肩胛姿勢 girdle 偏移）另行檢討；不為通過排名調整 F 或力臂',
  })),
  ...[
    ['dips', 'activation:trilong', '撐體肱三頭長頭主動活化 1.14，超過 1'],
    ['dips-upright', 'activation:trilong', '直立撐體肱三頭長頭主動活化 1.22，超過 1'],
    ['row', 'activation:pdelt', '槓鈴划船後三角主動活化 1.20，超過 1'],
    ['row-sup', 'activation:pdelt', '槓鈴反握划船後三角主動活化 1.20，超過 1'],
    ['cable-row-wide', 'activation:pdelt', '寬握坐姿滑輪划船後三角主動活化 1.25，超過 1'],
    ['row', 'activation:uptrap', '槓鈴划船終點上斜方主動活化 1.0002，略超過 1'],
    ['row-sup', 'activation:uptrap', '槓鈴反握划船終點上斜方主動活化 1.0002，略超過 1'],
    ['pullup-wide', 'activation:uptrap', '寬握引體起點上斜方主動活化 1.06，超過 1'],
  ].map(([id, rule, current]) => ({
    id, rule, kind: '肩帶力臂全面改用 TSM', current,
    cause: '肩帶共收縮改變分配：划船終點肩胛上提／後收需求主要由上斜方承擔（TSM 上提力臂較小，需更高活化），再由前鋸肌抵消後收，肩胛上提與肩水平外展需求同時推高上斜方與後三角；撐體與引體則是背闊肌／胸大肌／上斜方的 scElev、scRet 耦合，使三頭長頭或上斜方在峰值幀超載。皆為分配結果，非單一力臂擬合誤差',
    fix: '待後三角、前鋸肌 F 與肩帶需求定義檢討後重新核對；暫不調參',
  })),
  ...[
    ['row', 'rank:midtrap:top4'], ['row-sup', 'rank:midtrap:top4'], ['cable-row-wide', 'rank:midtrap:top4'],
  ].map(([id, rule]) => ({
    id, rule, kind: '肩帶力臂全面改用 TSM', current: '中斜方／菱形肌未進前四（後三角、上斜方、豎脊肌、前鋸肌在前）',
    cause: 'TSM 中斜方＋菱形 scRet 約 +72～+85 mm 與舊常數 70 mm 相近，但其 scElev 為負（−20～+6 mm）且上斜方 scRet 由 +20 增為 +73 mm，後收需求改由上斜方分攤，中斜方活化降低',
    fix: '待前鋸、上斜方有效 F 與肩帶需求定義檢討後重新核對；暫不調參',
  })),
  {
    id: 'pullup', rule: 'rank:top2', kind: '肩帶力臂全面改用 TSM', current: '前兩名為肱肌群與上斜方，背闊肌第四（0.73）',
    cause: '背闊肌 scElev 力臂放大使其只需約 0.7 即可承擔下壓，上斜方 scElev 力臂偏小（TSM），共收縮抵消背闊肌多餘的下壓力矩；與背闊肌 scRet 符號無關（見 lat-scret-sign.md）',
    fix: '待前鋸、上斜方有效 F 與肩帶需求定義檢討後重新核對；暫不調參',
  },
  {
    id: 'pullup-wide', rule: 'rank:top2', kind: '肩帶力臂全面改用 TSM', current: '前兩名為上斜方與胸大肌，背闊肌第四（0.76）',
    cause: '同引體：背闊肌 scElev 放大後所需活化較低，上斜方共收縮居首',
    fix: '待前鋸、上斜方有效 F 與肩帶需求定義檢討後重新核對；暫不調參',
  },
  {
    id: 'assist-chinup', rule: 'rank:top2', kind: '肩帶力臂改用 TSM',
    current: '前兩名為肱肌群與大圓肌，背闊肌 0.38（原 0.70）',
    cause: '背闊肌 scElev 力臂放大後，肩胛下壓只需較低活化；輔助重量使需求小，大圓肌分到肩內收而超前背闊肌',
    fix: '大圓肌 F（有效 144 N）校準後重新檢核；暫不調參',
  },
  ...[
    ['curl', 'rank:first', '槓鈴反握彎舉的一般視圖前三角肌高於屈肘肌群'],
    ['reverse-curl', 'rank:first', '槓鈴正握彎舉的一般視圖前三角肌高於屈肘肌群'],
    ['db-curl', 'rank:first', '反握啞鈴彎舉的一般視圖前三角肌高於肱二頭肌群'],
    ['cable-fly-mid', 'rank:first', '中位滑輪夾胸的肱肌／肱橈肌高於胸大肌'],
    ['cable-fly-low', 'rank:first', '低位滑輪夾胸的肱肌／肱橈肌高於胸大肌'],
  ].map(([id, rule, current]) => ({
    id, rule, kind: '前臂旋轉模型', current,
    cause: 'Murray 1995 兩標本力臂與固定／共握接觸反力偶改變肌肉分配；肩部穩定與單手把手力矩仍未以同條件資料校準',
    fix: '取得同姿勢三維肘肩力矩、手部接觸偶矩及肌電資料後核對；暫不為通過排名或超載準則調參',
  })),
  ...Object.entries({
    pullup: ['brachioradialis'],
    'pullup-wide': ['brachioradialis'],
    chinup: ['brachialis', 'brachioradialis'],
    'assist-chinup': ['brachioradialis'],
    'db-curl': ['brachioradialis'],
  }).flatMap(([id, muscles]) => muscles.map((muscle) => ({
    id, rule: `activation:${muscle}`, kind: '前臂細分超載',
    current: `${muscle} 的獨立主動活化超過 1，可能被 F 加權一般群組掩蓋`,
    cause: 'Murray 1995 大體力臂只涵蓋兩標本與部分角度；同負重的肘肩力矩、握持力偶與肌力上限尚未驗證',
    fix: '取得同條件的前臂肌肉能力、肌電及接觸偶矩後核對；暫不調 F 或設定動作特例',
  }))),
];
const known = new Map(KNOWN_ISSUES.map((issue) => [`${issue.id}|${issue.rule}`, issue]));
if (known.size !== KNOWN_ISSUES.length) throw new Error('KNOWN_ISSUES 有重複的動作與規則');

const N = 40;
const errors = [];
const seen = new Set();
const check = (id, rule, result) => {
  const key = `${id}|${rule}`;
  const issue = known.get(key);
  if (issue) {
    seen.add(key);
    console.log(`已知問題（${issue.kind}）${id} ${rule}：${result}；原因：${issue.cause}；預計：${issue.fix}`);
  } else errors.push(`${id} ${rule}：${result}`);
};
let checked = 0;
const catalogIds = new Set();
const forearmDetailIds = new Set(['bicLong', 'bicShort', 'brachialis', 'brachioradialis', 'pronatorTeres', 'pronatorQuadratus', 'supinator']);
const declaredRules = new Set();
for (const c of CATALOG.filter((entry) => entry.lift)) {
  catalogIds.add(c.id);
  const P = { ...defaultParams(c.lift), ...c.set };
  const peaks = new Map();
  const overload = new Map();
  for (let i = 0; i <= N; i++) {
    const e = i / N;
    for (const [id, mus] of Object.entries(analyze(c.lift, P, e).mus).filter(([id]) => MUSCLE_GROUP_IDS.includes(id) || forearmDetailIds.has(id))) {
      if (!Number.isFinite(mus.a) || mus.a > 1.000001) {
        const prior = overload.get(id);
        if (!prior || !Number.isFinite(mus.a) || mus.a > prior.a) overload.set(id, { a: mus.a, e });
      }
      if (MUSCLE_GROUP_IDS.includes(id)) peaks.set(id, Math.max(peaks.get(id) || 0, mus.s));
    }
  }
  const ranked = [...peaks].sort((a, b) => b[1] - a[1]);
  const rankTolerance = (boundary) => Math.min(0.08, 0.15 * boundary);
  const nearTop = (id, n) => {
    const boundary = ranked[Math.min(n, ranked.length) - 1]?.[1] ?? 0;
    return peaks.has(id) && peaks.get(id) >= boundary - rankTolerance(boundary) - 1e-12;
  };
  for (const [id, { a, e }] of overload) check(c.id, `activation:${id}`, `e=${e.toFixed(3)} a=${a.toFixed(4)} > 1`);
  const rule = RANKS[c.id];
  if (rule?.first) declaredRules.add(`${c.id}|rank:first`);
  if (rule?.notFirst) declaredRules.add(`${c.id}|rank:notFirst`);
  if (rule?.notTop4) declaredRules.add(`${c.id}|rank:notTop4`);
  if (rule?.allTop3) declaredRules.add(`${c.id}|rank:allTop3`);
  for (const [a, b] of rule?.above || []) declaredRules.add(`${c.id}|rank:${a}>${b}`);
  for (const id of Object.keys(rule?.within || {})) declaredRules.add(`${c.id}|rank:${id}:top${rule.within[id]}`);
  for (const n of [2, 3, 4]) if (rule?.[`top${n}`]) declaredRules.add(`${c.id}|rank:top${n}`);
  if (rule?.first && !rule.first.some((id) => nearTop(id, 1))) {
    check(c.id, 'rank:first', `第一名 ${ranked[0][0]}，預期 ${rule.first.join(' 或 ')}`);
  }
  if (rule?.notFirst?.some((id) => nearTop(id, 1))) {
    check(c.id, 'rank:notFirst', `第一名附近不應含 ${rule.notFirst.join('、')}；目前第一名 ${ranked[0][0]}`);
  }
  if (rule?.notTop4) {
    const hit = rule.notTop4.filter((id) => nearTop(id, 4)).map((id) => `${id} ${(peaks.get(id) || 0).toFixed(2)}`);
    if (hit.length) check(c.id, 'rank:notTop4', `前4名附近不應含 ${rule.notTop4.join('、')}，目前含 ${hit.join(', ')}`);
  }
  if (rule?.allTop3 && !rule.allTop3.every((id) => nearTop(id, 3))) {
    check(c.id, 'rank:allTop3', `前三名 ${ranked.slice(0, 3).map(([id]) => id).join(', ')}，預期同時含 ${rule.allTop3.join('、')}`);
  }
  for (const [a, b] of rule?.above || []) {
    const bScore = peaks.get(b) || 0;
    if ((peaks.get(a) || 0) < bScore - rankTolerance(bScore) - 1e-12) check(c.id, `rank:${a}>${b}`, `${a} ${(peaks.get(a) || 0).toFixed(2)} 低於 ${b} ${bScore.toFixed(2)} 且超過容差`);
  }
  for (const [id, n] of Object.entries(rule?.within || {})) {
    if (!nearTop(id, n)) {
      check(c.id, `rank:${id}:top${n}`, `前${n}名 ${ranked.slice(0, n).map(([muscle]) => muscle).join(', ')}，預期含 ${id}`);
    }
  }
  for (const n of [2, 3, 4]) {
    const accepted = rule?.[`top${n}`];
    if (accepted && !accepted.some((id) => nearTop(id, n))) {
      check(c.id, `rank:top${n}`, `前${n}名 ${ranked.slice(0, n).map(([id]) => id).join(', ')}，預期含 ${accepted.join(' 或 ')}`);
    }
  }
  checked++;
}
// 自體重量支撐力須承擔整體重量；輔助膝墊減少的是實際手部反力。
for (const c of CATALOG.filter((item) => ['pushup', 'dips', 'pullup', 'assistpullup'].includes(item.lift))) {
  const P = { ...defaultParams(c.lift), ...c.set };
  for (let i = 0; i <= N; i++) {
    const pose = analyze(c.lift, P, i / N).pose;
    const hand = pose.support.hand[1], foot = pose.support.foot?.[1] || 0, knee = pose.support.knee?.[1] || 0;
    const expected = (BODY.mass + (P.load || 0)) * 9.81 / 2;
    if (Math.abs(hand + foot + knee - expected) > 1e-5 || pose.warn.some((w) => w.includes('重心未落在手部支撐線'))) {
      errors.push(`${c.id} e=${(i / N).toFixed(3)} 支撐與重心未平衡`); break;
    }
  }
}
// 同一握距與姿勢掃描 0～60 kg；全行程肌肉主動活化總量應隨膝墊輔助增加而下降。
for (const grip of ['pro', 'sup']) {
  let previous = Infinity;
  for (let assist = 0; assist <= 60; assist += 5) {
    const P = { ...defaultParams('assistpullup'), grip, width: grip === 'sup' ? 1.1 : 1.35, assist };
    let total = 0;
    for (let i = 0; i <= N; i++) {
      total += Object.values(analyze('assistpullup', P, i / N).mus).reduce((s, m) => s + m.a, 0);
    }
    if (!(total < previous)) errors.push(`assistpullup ${grip} 輔助 ${assist} kg 時活化總量未單調下降`);
    previous = total;
  }
}
// 掃過站距 0～1 的每個介面刻度；股廣肌群須全程維持第一位。
for (let i = 0; i <= 100; i++) {
  const P = { ...defaultParams('hacksquat'), stance: i / 100 };
  const peaks = new Map();
  for (let j = 0; j <= N; j++) {
    for (const [id, muscle] of Object.entries(analyze('hacksquat', P, j / N).mus).filter(([id]) => MUSCLE_GROUP_IDS.includes(id))) {
      peaks.set(id, Math.max(peaks.get(id) || 0, muscle.s));
    }
  }
  const first = [...peaks].sort((a, b) => b[1] - a[1])[0][0];
  if (first !== 'vasti') errors.push(`hack-squat 站距 ${(i / 100).toFixed(2)} 第一名 ${first}，預期 vasti`);
}
// [Contreras 2015](https://pubmed.ncbi.nlm.nih.gov/26214739/)：臀推上下部峰值皆應高於深蹲；下部目前失敗。
const lowerGlutePeak = (lift, params) => Math.max(...Array.from({ length: 21 }, (_, i) =>
  analyze(lift, params, i / 20).mus.gmaxLower.a));
const hipLower = lowerGlutePeak('hipthrust', { ...defaultParams('hipthrust'), surface: 'bench', kneeTop: 90 });
const squatLower = lowerGlutePeak('squat', { ...defaultParams('squat'), barPos: 'high' });
if (hipLower <= squatLower * 1.01) check('hip-thrust', 'trend:gmaxLower', `臀推 ${hipLower.toFixed(3)}，深蹲 ${squatLower.toFixed(3)}；預期臀推至少高 1%`);

// 墊高的需求力矩若日後真的因分段支撐改變，這項已知限制應移除。
const padBase = defaultParams('backext');
const lowPad = analyze('backext', { ...padBase, padHeight: -6 }, 0.5).dem;
const highPad = analyze('backext', { ...padBase, padHeight: 6 }, 0.5).dem;
if (Math.abs(lowPad.hipExt - highPad.hipExt) < 1e-6 && Math.abs(lowPad.trunkExt - highPad.trunkExt) < 1e-6) {
  check('back-extension', 'model:padHeight', '墊高 ±6 cm 時 hipExt 與 trunkExt 需求不變；只影響肌肉長度與畫面');
}
for (const issue of KNOWN_ISSUES) {
  if (!catalogIds.has(issue.id) || (issue.rule.startsWith('rank:') && !declaredRules.has(`${issue.id}|${issue.rule}`))) {
    errors.push(`已知問題沒有對應規則：${issue.id} ${issue.rule}`);
  } else if (!seen.has(`${issue.id}|${issue.rule}`)) {
    errors.push(`已知問題已通過，請從 KNOWN_ISSUES 移除：${issue.id} ${issue.rule}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`plausibility PASS：${checked} 個清單項目、每項 ${N + 1} 個行程點；${seen.size} 項已知問題另列`);
}
