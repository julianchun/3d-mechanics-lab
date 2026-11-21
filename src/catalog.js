// 動作清單：依動作模式分類；同一個力學模型（lift）可以有多個變化式（set = 套用的參數）
// planned = 規劃中，清單顯示灰色、不能選

export const CATEGORIES = [
  ['squat', '蹲'],
  ['hinge', '髖鉸鏈'],
  ['hpush', '水平推'],
  ['vpush', '垂直推'],
  ['hpull', '水平拉'],
  ['vpull', '垂直拉'],
  ['iso', '單關節'],
];

export const EQUIPMENT = [
  ['barbell', '槓鈴'],
  ['machine', '器械'],
  ['cable', '滑輪'],
];

export const CATALOG = [
  // 蹲
  { id: 'squat-high', name: '深蹲（高槓）', cat: 'squat', equip: 'barbell', lift: 'squat', set: { barPos: 'high' }, alias: ['squat', 'high bar', '背蹲'] },
  { id: 'squat-low', name: '深蹲（低槓）', cat: 'squat', equip: 'barbell', lift: 'squat', set: { barPos: 'low' }, alias: ['squat', 'low bar', '背蹲'] },
  { id: 'front-squat', name: '前蹲', cat: 'squat', equip: 'barbell', lift: 'squat', set: { barPos: 'front' }, alias: ['front squat'] },
  { id: 'smith-squat', name: '史密斯深蹲', cat: 'squat', equip: 'machine', lift: 'smith', set: {}, alias: ['smith'] },
  { id: 'leg-press', name: '45° 腿推機', cat: 'squat', equip: 'machine', lift: 'legpress', set: {}, alias: ['leg press'] },
  // 髖鉸鏈
  { id: 'deadlift', name: '硬舉（傳統）', cat: 'hinge', equip: 'barbell', lift: 'deadlift', set: { style: 'conv', start: 0 }, alias: ['deadlift', 'dl'] },
  { id: 'deficit-dl', name: '赤字硬舉', cat: 'hinge', equip: 'barbell', lift: 'deadlift', set: { style: 'conv', start: -5 }, alias: ['deficit deadlift'] },
  { id: 'block-pull', name: '墊高硬舉', cat: 'hinge', equip: 'barbell', lift: 'deadlift', set: { style: 'conv', start: 10 }, alias: ['block pull', 'rack pull'] },
  { id: 'sumo', name: '相撲硬舉', cat: 'hinge', equip: 'barbell', lift: 'deadlift', set: { style: 'sumo', start: 0 }, alias: ['sumo'] },
  { id: 'rdl', name: '羅馬尼亞硬舉', cat: 'hinge', equip: 'barbell', lift: 'rdl', set: {}, alias: ['rdl', 'romanian'] },
  { id: 'good-morning', name: '早安體前屈', cat: 'hinge', equip: 'barbell', lift: 'goodmorning', set: { barPos: 'high' }, alias: ['good morning', 'gm'] },
  { id: 'hip-thrust', name: '臀推', cat: 'hinge', equip: 'barbell', lift: 'hipthrust', set: { surface: 'bench', kneeTop: 90 }, alias: ['hip thrust', '臀部'] },
  { id: 'glute-bridge', name: '槓鈴臀橋', cat: 'hinge', equip: 'barbell', lift: 'hipthrust', set: { surface: 'floor', kneeTop: 130 }, alias: ['glute bridge', '臀橋'] },
  // 水平推
  { id: 'bench', name: '臥推（平板）', cat: 'hpush', equip: 'barbell', lift: 'bench', set: { surface: 'bench', incline: 0, grip: 1.6, flare: 52 }, alias: ['bench', 'bp'] },
  { id: 'incline-bench', name: '上斜臥推', cat: 'hpush', equip: 'barbell', lift: 'bench', set: { surface: 'bench', incline: 30, grip: 1.6, flare: 52 }, alias: ['incline'] },
  { id: 'cg-bench', name: '窄握臥推', cat: 'hpush', equip: 'barbell', lift: 'bench', set: { surface: 'bench', incline: 0, grip: 0.9, flare: 35 }, alias: ['close grip', 'cgbp'] },
  { id: 'floor-press', name: '地板臥推', cat: 'hpush', equip: 'barbell', lift: 'bench', set: { surface: 'floor', incline: 0, grip: 1.6, flare: 45 }, alias: ['floor press'] },
  { id: 'chest-press', name: '坐姿胸推機', cat: 'hpush', equip: 'machine', lift: 'chestpress', set: {}, alias: ['chest press'] },
  { id: 'pec-deck', name: '蝴蝶機', cat: 'hpush', equip: 'machine', planned: true, alias: ['pec deck', 'fly'] },
  // 垂直推
  { id: 'ohp', name: '站姿肩推', cat: 'vpush', equip: 'barbell', lift: 'ohp', set: {}, alias: ['ohp', 'press', '肩推'] },
  // 水平拉
  { id: 'row', name: '槓鈴划船（正握）', cat: 'hpull', equip: 'barbell', lift: 'row', set: { supin: 'pro' }, alias: ['row', 'bor'] },
  { id: 'row-sup', name: '槓鈴划船（反握）', cat: 'hpull', equip: 'barbell', lift: 'row', set: { supin: 'sup' }, alias: ['row', 'yates'] },
  { id: 'cable-row', name: '坐姿滑輪划船', cat: 'hpull', equip: 'cable', lift: 'cablerow', set: { grip: 'v' }, alias: ['cable row', 'seated row'] },
  { id: 'cable-row-wide', name: '坐姿滑輪划船（寬握）', cat: 'hpull', equip: 'cable', lift: 'cablerow', set: { grip: 'wide' }, alias: ['cable row', 'wide'] },
  // 垂直拉
  { id: 'uprow', name: '直立划船', cat: 'vpull', equip: 'barbell', lift: 'uprow', set: {}, alias: ['upright row'] },
  { id: 'pulldown', name: '滑輪下拉', cat: 'vpull', equip: 'cable', lift: 'pulldown', set: { supin: 'pro' }, alias: ['lat pulldown', 'pulldown'] },
  { id: 'pulldown-sup', name: '反握滑輪下拉', cat: 'vpull', equip: 'cable', lift: 'pulldown', set: { supin: 'sup', grip: 1.1 }, alias: ['chin', 'underhand'] },
  // 單關節
  { id: 'leg-ext', name: '腿伸機', cat: 'iso', equip: 'machine', lift: 'legext', set: {}, alias: ['leg extension'] },
  { id: 'leg-curl', name: '坐姿腿彎舉', cat: 'iso', equip: 'machine', lift: 'legcurl', set: { posture: 'seated' }, alias: ['leg curl', 'seated'] },
  { id: 'lying-leg-curl', name: '俯臥腿彎舉', cat: 'iso', equip: 'machine', lift: 'legcurl', set: { posture: 'lying' }, alias: ['leg curl', 'lying'] },
  { id: 'pushdown', name: '滑輪三頭下壓', cat: 'iso', equip: 'cable', lift: 'pushdown', set: {}, alias: ['pushdown', 'triceps'] },
  { id: 'curl', name: '槓鈴彎舉', cat: 'iso', equip: 'barbell', lift: 'curl', set: { supin: 'sup' }, alias: ['curl', 'biceps'] },
  { id: 'reverse-curl', name: '反手彎舉', cat: 'iso', equip: 'barbell', lift: 'curl', set: { supin: 'pro' }, alias: ['reverse curl'] },
  { id: 'shrug', name: '槓鈴聳肩', cat: 'iso', equip: 'barbell', lift: 'shrug', set: {}, alias: ['shrug', '斜方'] },
];

// 清單上「主要肌群」用的簡稱；沒列在這裡的（穩定肌、小腿、旋轉肌袖）不顯示
export const MUSCLE_SHORT = {
  vasti: '股四頭', rf: '股四頭', hams: '膕繩肌', gmax: '臀大肌', addmag: '內收大肌', erec: '腰背伸肌',
  pecs: '胸大肌', pecc: '上胸', adelt: '前三角', mdelt: '中三角', pdelt: '後三角', lat: '背闊肌',
  trilat: '三頭', trilong: '三頭', bic: '二頭', brach: '肱肌', midtrap: '中斜方／菱形', uptrap: '上斜方', serr: '前鋸肌',
};

// 目前的動作＋參數對應到哪一個清單項目（參數被改過、對不上任何變化式時回傳 null）
export function matchEntry(lift, params) {
  return CATALOG.find((c) => c.lift === lift && Object.entries(c.set).every(([k, v]) => params[k] === v)) || null;
}
