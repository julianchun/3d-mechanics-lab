// 力學核心：姿勢求解 → 關節力矩（準靜態）→ 肌肉分配（最小化活化平方和）
// 座標：X = 身體右側、Y = 上、Z = 前方（臥推時 Z = 腳的方向）。只算右側，左側鏡像。

export const MODEL_VERSION = '0.6.0';
const G = 9.81;

export const BODY = {
  // 依 BodyParts3D 骨骼比例，縮放到身高 175 cm
  mass: 75, Ls: 0.394, Lt: 0.44, Ltr: 0.518, Lu: 0.287, Lf: 0.332,
  hipHalf: 0.09, shHalf: 0.167, ankleH: 0.068,
};
const MF = { foot: 0.0145, shank: 0.0465, thigh: 0.1, upper: 0.028, fore: 0.022 };
MF.trunk = 1 - 2 * (MF.foot + MF.shank + MF.thigh + MF.upper + MF.fore);
export const BAR_RATIO = { squat: 1.0, deadlift: 1.2, rdl: 0.9, bench: 0.8, row: 0.7, ohp: 0.5, goodmorning: 0.45, curl: 0.35, shrug: 1.2, uprow: 0.35, hipthrust: 1.3,
  // 器械：槓／配重片／滑輪配重（× 體重）
  smith: 0.9, legpress: 2.4, pulldown: 0.6, cablerow: 0.75, pushdown: 0.25, legext: 1.2, legcurl: 0.45, chestpress: 0.9 };
// 凸輪的阻力曲線選項（腿伸機、腿彎舉）
export const CAMS = [['gravity', '槓桿＋配重（無凸輪）'], ['flat', '凸輪：全程平均'], ['asc', '凸輪：收縮端較重'], ['desc', '凸輪：拉長端較重']];


// ---------- 向量 ----------
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerpV = (a, b, t) => add(a, mul(sub(b, a), t));
const lerp = (a, b, t) => a + (b - a) * t;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const neg = (a) => [-a[0], -a[1], -a[2]];

function ik2(root, target, L1, L2, pole) {
  const d = sub(target, root);
  let D = len(d);
  let ok = true;
  const maxD = L1 + L2 - 1e-4, minD = Math.abs(L1 - L2) + 0.05;
  if (D > maxD) { ok = false; D = maxD; }
  if (D < minD) { ok = false; D = minD; }
  const n = norm(d);
  const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let p = sub(pole, mul(n, dot(pole, n)));
  if (len(p) < 1e-6) p = Math.abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0]);
  p = norm(p);
  return { mid: add(root, add(mul(n, a), mul(p, h))), end: add(root, mul(n, D)), ok };
}

// ---------- 動作定義 ----------
// mech：A 改姿勢／軌跡、B 等長用力、C 協同肌偏好
export const LIFTS = {
  squat: {
    name: '深蹲', bottomLabel: '最低點',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: squatPose, loads: barOnTrunkLoads,
    params: [
      { key: 'dom', label: '主導', left: '膝主導', right: '髖主導', min: 0, max: 1, step: 0.01, def: 0.45, joint: 'hip', mech: 'A' },
      { key: 'depth', label: '深度', left: '高於平行', right: '全蹲', min: 0, max: 1, step: 0.01, def: 0.55, joint: 'knee', mech: 'A' },
      { key: 'stance', label: '站距', left: '窄', right: '寬', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'ankle', mech: 'A' },
      { key: 'barPos', label: '槓位', type: 'select', options: [['high', '高槓'], ['low', '低槓'], ['front', '前槓（前蹲）']], def: 'high', joint: 'bar', mech: 'A' },
      { key: 'kneesOut', label: '膝蓋往外推', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'knee', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefGA', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏內收大肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['addmag']] },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '高槓、站距約與肩同寬、軀幹偏直立、蹲到大腿與地面平行或更低。',
  },
  deadlift: {
    name: '硬舉', bottomLabel: '離地',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFlex'],
    pose: deadliftPose, loads: barInHandsLoads,
    // moving：主要在動的關節（清單上「主要肌群」只看作用在這些關節的肌肉，排除純穩定用的）
    moving: ['hipExt', 'kneeExt', 'trunkExt'],
    params: [
      { key: 'dom', label: '主導（起始髖高）', left: '膝主導', right: '髖主導', min: 0, max: 1, step: 0.01, def: 0.5, joint: 'hip', mech: 'A' },
      { key: 'style', label: '站姿', type: 'select', options: [['conv', '傳統'], ['sumo', '相撲']], def: 'conv', joint: 'ankle', mech: 'A' },
      { key: 'start', label: '起始槓高', left: '赤字（站高 10 cm）', right: '墊高 10 cm', min: -10, max: 10, step: 1, def: 0, joint: 'equip', mech: 'A', unit: ' cm' },
      { key: 'barDist', label: '槓離身體', left: '貼腿', right: '離腿 10 cm', min: 0, max: 1, step: 0.01, def: 0, joint: 'bar', mech: 'A' },
      { key: 'pullIn', label: '把槓往身上拉', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'shoulder', mech: 'B' },
      { key: 'kneesOut', label: '膝蓋往外推', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'knee', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '傳統站姿、背部中立、槓貼近身體。',
  },
  rdl: {
    name: '羅馬尼亞硬舉', bottomLabel: '最低點',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFlex'],
    pose: rdlPose, loads: barInHandsLoads,
    moving: ['hipExt', 'kneeExt', 'trunkExt'],
    params: [
      { key: 'depth', label: '下放深度（軀幹前傾）', left: '50°', right: '85°', min: 0, max: 1, step: 0.01, def: 0.55, joint: 'hip', mech: 'A' },
      { key: 'kneeBend', label: '膝彎曲', left: '5°（近直腿）', right: '35°', min: 5, max: 35, step: 1, def: 18, joint: 'knee', mech: 'A', unit: '°' },
      { key: 'barDist', label: '槓離身體', left: '貼腿', right: '離腿 10 cm', min: 0, max: 1, step: 0.01, def: 0, joint: 'bar', mech: 'A' },
      { key: 'pullIn', label: '把槓往身上拉', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'shoulder', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '髖往後推、膝蓋微彎約 15～20° 且角度幾乎不變、槓沿著大腿滑下、背部中立，下放到膝蓋下方。',
  },
  row: {
    name: '槓鈴划船', topLabel: '手臂伸直', bottomLabel: '觸身',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev']],
    pose: rowPose, loads: handBarLoads,
    moving: ['shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev'],
    // 正握時肱二頭肌處於旋前、力臂效率較差，屈肘改由肱肌／肱橈肌多分擔
    adjust: (P, pref) => { if (pref.bic !== undefined) pref.bic *= P.supin === 'sup' ? 1.6 : 0.6; },
    params: [
      { key: 'torso', label: '軀幹前傾', left: '30°（較直立）', right: '85°（接近水平）', min: 30, max: 85, step: 1, def: 60, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'grip', label: '握距（× 肩峰寬）', left: '1.0', right: '2.0', min: 1, max: 2, step: 0.01, def: 1.3, joint: 'hand', mech: 'A' },
      { key: 'supin', label: '握法', type: 'select', options: [['pro', '正握'], ['sup', '反握']], def: 'pro', joint: 'hand', mech: 'A' },
      { key: 'flare', label: '手肘外開角度', left: '10°（夾緊）', right: '80°（往外）', min: 10, max: 80, step: 1, def: 35, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'pullTo', label: '拉到哪裡', left: '肚臍', right: '下胸', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'bar', mech: 'A' },
      { key: 'scap', label: '頂點肩胛後收', left: '不收', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.7, joint: 'scap', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefLP', label: '肩伸肌偏好', left: '偏背闊肌', right: '偏三角肌後束', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['lat'], ['pdelt']] },
    ],
    standardNote: '軀幹前傾約 45～70°、膝微彎、背部中立，槓從腳掌中段正上方拉到上腹，頂點收肩胛。',
  },
  ohp: {
    name: '站姿肩推', topLabel: '鎖死', bottomLabel: '鎖骨',
    viewCenter: [0, 1.12, 0], viewScale: 1.32,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev']],
    pose: ohpPose, loads: handBarLoads,
    moving: ['shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev'],
    params: [
      { key: 'grip', label: '握距（× 肩峰寬）', left: '1.0', right: '2.0', min: 1, max: 2, step: 0.01, def: 1.3, joint: 'hand', mech: 'A' },
      { key: 'flare', label: '手肘位置', left: '0°（正前方）', right: '90°（往兩側）', min: 0, max: 90, step: 1, def: 30, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'lean', label: '軀幹後仰', left: '0°', right: '20°', min: 0, max: 20, step: 1, def: 5, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'path', label: '鎖死位置', left: '肩膀正上方', right: '頭前方 10 cm', min: 0, max: 1, step: 0.01, def: 0.1, joint: 'bar', mech: 'A' },
      { key: 'shrug', label: '鎖死時聳肩', left: '不聳', right: '完全上提', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'scap', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'lumbar', mech: 'B' },
      { key: 'prefAP', label: '肩屈肌偏好', left: '偏前三角', right: '偏上胸', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['adelt'], ['pecc']] },
    ],
    standardNote: '握距略寬於肩、手肘略在槓前方、臀腿收緊、軀幹微後仰讓槓繞過臉；鎖死時槓在肩膀與腳掌中段正上方、肩胛上提。',
  },
  bench: {
    name: '臥推', bottomLabel: '觸胸',
    ground: false, supine: true, dofs: ['shFlex', 'shHAdd', 'elbExt'],
    pose: benchPose, loads: benchLoads,
    lowerBounds: (P, lb) => { if (P.bend) lb.lat = 0.35 * P.bend; },
    params: [
      { key: 'dom', label: '主導', left: '肩主導', right: '肘主導', min: 0, max: 1, step: 0.01, def: 0.5, joint: 'shoulder', mech: 'A' },
      { key: 'surface', label: '躺在', type: 'select', options: [['bench', '臥推椅'], ['floor', '地板（地板臥推）']], def: 'bench', joint: 'equip', mech: 'A' },
      { key: 'incline', label: '椅背角度', left: '平板 0°', right: '上斜 45°', min: 0, max: 45, step: 1, def: 0, joint: 'equip', mech: 'A', unit: '°' },
      { key: 'grip', label: '握距（× 肩峰寬）', left: '0.8（窄握）', right: '2.0', min: 0.8, max: 2, step: 0.01, def: 1.6, joint: 'hand', mech: 'A' },
      { key: 'flare', label: '手肘外開角度', left: '30°', right: '90°', min: 30, max: 90, step: 1, def: 52, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'scap', label: '肩胛後收', left: '前伸', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'shoulder', mech: 'A' },
      { key: 'touch', label: '觸胸點', left: '上胸', right: '下胸', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'bar', mech: 'A' },
      { key: 'bend', label: '把槓折彎', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'B' },
      { key: 'pullApart', label: '把槓往外拉開', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'hand', mech: 'B' },
      { key: 'prefPD', label: '肩水平內收偏好', left: '偏胸', right: '偏前三角', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecs', 'pecc'], ['adelt']] },
      { key: 'prefUL', label: '胸大肌偏好', left: '偏上胸', right: '偏中下胸', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecc'], ['pecs']] },
    ],
    standardNote: '中等拱背、肩胛後收、觸胸點在胸中段偏下、手肘外開約 45～60°、握距中等、完整行程。',
  },
  goodmorning: {
    name: '早安體前屈', bottomLabel: '最低點',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: goodMorningPose, loads: barOnTrunkLoads,
    moving: ['hipExt', 'trunkExt'],
    params: [
      { key: 'depth', label: '前傾深度', left: '45°', right: '90°（水平）', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'hip', mech: 'A' },
      { key: 'kneeBend', label: '膝彎曲', left: '5°（近直腿）', right: '35°', min: 5, max: 35, step: 1, def: 15, joint: 'knee', mech: 'A', unit: '°' },
      { key: 'barPos', label: '槓位', type: 'select', options: [['high', '高槓'], ['low', '低槓']], def: 'high', joint: 'bar', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '槓扛在上背、膝微彎且角度固定、髖往後推、背部中立，前傾到膕繩肌有明顯拉伸（約 60～80°）。',
  },
  curl: {
    name: '槓鈴彎舉', topLabel: '頂點', bottomLabel: '手臂伸直',
    viewCenter: [0, 0.88, 0.05], viewScale: 1.1,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev']],
    pose: curlPose, loads: handBarLoads,
    moving: ['elbExt'],
    adjust: (P, pref) => { if (pref.bic !== undefined) pref.bic *= P.supin === 'pro' ? 0.6 : 1.6; },
    params: [
      { key: 'supin', label: '握法', type: 'select', options: [['sup', '反握（掌心朝上）'], ['pro', '正握（反手彎舉）']], def: 'sup', joint: 'hand', mech: 'A' },
      { key: 'grip', label: '握距（× 肩峰寬）', left: '0.8', right: '1.6', min: 0.8, max: 1.6, step: 0.01, def: 1.1, joint: 'hand', mech: 'A' },
      { key: 'topFlex', label: '頂點手肘角度', left: '110°', right: '150°', min: 110, max: 150, step: 1, def: 135, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'elbFwd', label: '頂點手肘前移', left: '0°（貼身）', right: '40°', min: 0, max: 40, step: 1, def: 10, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'swing', label: '身體後仰借力', left: '0°', right: '15°', min: 0, max: 15, step: 1, def: 0, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefBB', label: '屈肘肌偏好', left: '偏二頭', right: '偏肱肌／肱橈肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'elbow', mech: 'C', pref: [['bic'], ['brach']] },
    ],
    standardNote: '握距約與肩同寬、反握、上臂貼身幾乎不動、身體不後仰，從手臂伸直彎到前臂接近垂直。',
  },
  shrug: {
    name: '槓鈴聳肩', topLabel: '聳到頂', bottomLabel: '放下',
    viewCenter: [0, 0.88, 0], viewScale: 1.1,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev']],
    pose: shrugPose, loads: handBarLoads,
    moving: ['scElev', 'scRet'],
    adjust: (P, pref) => { if (pref.bic !== undefined) pref.bic *= 0.6; },
    params: [
      { key: 'grip', label: '握距（× 肩峰寬）', left: '1.0', right: '1.6', min: 1, max: 1.6, step: 0.01, def: 1.15, joint: 'hand', mech: 'A' },
      { key: 'height', label: '聳起高度', left: '小（約 10°）', right: '盡量高（約 30°）', min: 0, max: 1, step: 0.01, def: 0.7, joint: 'scap', mech: 'A' },
      { key: 'ret', label: '頂點肩胛後收', left: '不收', right: '後收', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'scap', mech: 'A' },
      { key: 'lean', label: '軀幹前傾', left: '0°', right: '30°', min: 0, max: 30, step: 1, def: 5, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
    ],
    standardNote: '站直、手臂伸直垂在大腿前、握距略寬於肩，肩膀往耳朵方向直直上提，頂點停一下。',
  },
  uprow: {
    name: '直立划船', topLabel: '頂點', bottomLabel: '手臂伸直',
    viewCenter: [0, 0.88, 0], viewScale: 1.1,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev']],
    pose: uprowPose, loads: handBarLoads,
    moving: ['shAbd', 'scElev', 'elbExt'],
    adjust: (P, pref) => { if (pref.bic !== undefined) pref.bic *= 0.6; },
    params: [
      { key: 'grip', label: '握距（× 肩峰寬）', left: '0.6（窄）', right: '1.6（寬）', min: 0.6, max: 1.6, step: 0.01, def: 1.2, joint: 'hand', mech: 'A' },
      { key: 'height', label: '拉到哪裡', left: '下胸', right: '鎖骨', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'bar', mech: 'A' },
      { key: 'lean', label: '軀幹前傾', left: '0°', right: '20°', min: 0, max: 20, step: 1, def: 3, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefDT', label: '上提偏好', left: '偏三角肌中束', right: '偏上斜方', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['mdelt'], ['uptrap']] },
    ],
    standardNote: '握距約與肩同寬或略寬、手肘帶頭往外上方拉，拉到下胸、手肘約與肩同高，不超過肩膀。',
  },
  hipthrust: {
    name: '臀推', topLabel: '頂點', bottomLabel: '最低點',
    viewCenter: [0, 0.4, 0.3], viewScale: 1.05,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: hipThrustPose, loads: barOnPelvisLoads, reactions: twoContactReactions,
    moving: ['hipExt'],
    params: [
      { key: 'surface', label: '上背靠在', type: 'select', options: [['bench', '臥推椅（臀推）'], ['floor', '地板（臀橋）']], def: 'bench', joint: 'equip', mech: 'A' },
      { key: 'kneeTop', label: '頂點膝角度（腳的位置）', left: '60°（腳放遠）', right: '140°（腳放很近）', min: 60, max: 140, step: 1, def: 90, joint: 'knee', mech: 'A', unit: '°' },
      { key: 'depth', label: '下放深度', left: '淺', right: '深', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'hip', mech: 'A' },
      { key: 'lockout', label: '頂點髖伸展', left: '-15°（沒推到底）', right: '+10°（過伸、腰代償）', min: -15, max: 10, step: 1, def: 0, joint: 'hip', mech: 'A', unit: '°' },
      { key: 'push', label: '用力點', left: '腳跟', right: '前腳掌', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'ankle', mech: 'B' },
      { key: 'kneesOut', label: '膝蓋往外推', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'knee', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '椅緣在肩胛骨下角、頂點小腿垂直（膝約 90°）、用腳跟推、頂點軀幹與大腿成一直線（不過伸下背）、下巴微收。',
  },
  smith: {
    name: '史密斯深蹲', bottomLabel: '最低點',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: smithPose, loads: barOnTrunkLoads, reactions: twoContactReactions,
    moving: ['hipExt', 'kneeExt'],
    params: [
      { key: 'feetFwd', label: '腳在槓前方', left: '0（同自由深蹲）', right: '30 cm', min: 0, max: 0.3, step: 0.01, def: 0.12, joint: 'ankle', mech: 'A', fmt: 'cm' },
      { key: 'depth', label: '深度', left: '高於平行', right: '全蹲', min: 0, max: 1, step: 0.01, def: 0.55, joint: 'knee', mech: 'A' },
      { key: 'torso', label: '最低點軀幹前傾', left: '0°（直立）', right: '45°', min: 0, max: 45, step: 1, def: 15, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'push', label: '用力點', left: '腳跟', right: '前腳掌', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'ankle', mech: 'B' },
      { key: 'kneesOut', label: '膝蓋往外推', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'knee', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '腳放在槓前方約 10～15 cm、軀幹比自由深蹲直立、蹲到大腿約平行；滑軌承擔前後平衡，重心不必在腳掌正上方。',
  },
  legpress: {
    name: '45° 腿推機', topLabel: '腿伸直', bottomLabel: '最低點',
    viewCenter: [0, 0.78, 0.25], viewScale: 1.18,
    seated: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF'],
    pose: legPressPose, loads: pushLoads,
    moving: ['hipExt', 'kneeExt'],
    params: [
      { key: 'footHigh', label: '腳踩踏板的位置', left: '低（偏股四頭）', right: '高（偏臀／膕繩）', min: 0, max: 1, step: 0.01, def: 0.5, joint: 'ankle', mech: 'A' },
      { key: 'stance', label: '站距', left: '窄', right: '寬', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'ankle', mech: 'A' },
      { key: 'depth', label: '下放深度（最低點膝角度）', left: '75°', right: '125°', min: 0, max: 1, step: 0.01, def: 0.5, joint: 'knee', mech: 'A' },
      { key: 'seat', label: '椅背角度（離垂直）', left: '35°（較直立）', right: '65°（較躺）', min: 35, max: 65, step: 1, def: 50, joint: 'equip', mech: 'A', unit: '°' },
      { key: 'push', label: '用力點', left: '腳跟', right: '前腳掌', min: 0, max: 1, step: 0.01, def: 0.35, joint: 'ankle', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '腳踩踏板中間、與髖同寬，下放到膝約 90°、臀部不離開椅墊，用整個腳掌推。',
  },
  pulldown: {
    name: '滑輪下拉', topLabel: '手臂伸直', bottomLabel: '拉到胸前',
    viewCenter: [0, 1.1, 0.1], viewScale: 1.15,
    seated: true, dofs: ['trunkExt', 'shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev'],
    pose: pulldownPose, loads: cableLoads,
    moving: ['shFlex', 'shAbd', 'elbExt', 'scRet', 'scElev'],
    adjust: (P, pref) => { if (pref.bic !== undefined) pref.bic *= P.supin === 'sup' ? 1.6 : 0.6; },
    params: [
      { key: 'grip', label: '握距（× 肩峰寬）', left: '1.0', right: '2.2', min: 1, max: 2.2, step: 0.01, def: 1.7, joint: 'hand', mech: 'A' },
      { key: 'supin', label: '握法', type: 'select', options: [['pro', '正握'], ['sup', '反握']], def: 'pro', joint: 'hand', mech: 'A' },
      { key: 'lean', label: '軀幹後仰', left: '0°', right: '40°', min: 0, max: 40, step: 1, def: 15, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'pullTo', label: '拉到哪裡', left: '下巴', right: '上胸', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'bar', mech: 'A' },
      { key: 'scap', label: '底部肩胛下壓後收', left: '不動', right: '完全下壓後收', min: 0, max: 1, step: 0.01, def: 0.7, joint: 'scap', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefLB', label: '拉的偏好', left: '偏背闊肌', right: '偏手臂（二頭／肱肌）', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['lat'], ['bic', 'brach']] },
    ],
    standardNote: '握距約 1.5～1.8 倍肩寬、軀幹微後仰 10～20°、拉到上胸，底部肩胛下壓後收，頂點讓肩胛上提伸展。',
  },
  cablerow: {
    name: '坐姿滑輪划船', topLabel: '手臂伸直', bottomLabel: '觸身',
    viewCenter: [0, 0.75, 0.35], viewScale: 1.1,
    seated: true, dofs: ['trunkExt', 'shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev'],
    pose: cableRowPose, loads: cableLoads,
    moving: ['shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev'],
    adjust: (P, pref) => { if (pref.bic !== undefined) pref.bic *= P.grip === 'v' ? 1.0 : 0.6; },
    params: [
      { key: 'grip', label: '握把', type: 'select', options: [['v', 'V 把（窄、對握）'], ['wide', '寬握桿（正握）']], def: 'v', joint: 'hand', mech: 'A' },
      { key: 'leanStart', label: '起點軀幹前傾', left: '0°', right: '40°', min: 0, max: 40, step: 1, def: 15, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'leanEnd', label: '終點軀幹角度', left: '後仰 25°', right: '前傾 10°', min: -25, max: 10, step: 1, def: -5, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'pullTo', label: '拉到哪裡', left: '肚臍', right: '下胸', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'bar', mech: 'A' },
      { key: 'scap', label: '終點肩胛後收', left: '不收', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'scap', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefLP', label: '肩伸肌偏好', left: '偏背闊肌', right: '偏三角肌後束', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['lat'], ['pdelt']] },
    ],
    standardNote: '膝微彎、腳踩穩，起點肩胛前伸、軀幹微前傾，拉到肚臍上方、肩胛後收，軀幹回到直立或微後仰，不用身體甩。',
  },
  pushdown: {
    name: '滑輪三頭下壓', topLabel: '伸直', bottomLabel: '手肘彎曲',
    viewCenter: [0, 0.92, 0.18], viewScale: 1.15,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFlex', 'shHAdd', 'shAbd', 'elbExt', 'scRet', 'scElev'],
    pose: pushdownPose, loads: cableLoads,
    moving: ['elbExt'],
    params: [
      { key: 'topFlex', label: '起點手肘角度', left: '80°', right: '130°', min: 80, max: 130, step: 1, def: 100, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'elbFwd', label: '手肘位置', left: '-10°（往後）', right: '30°（往前）', min: -10, max: 30, step: 1, def: 5, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'lean', label: '軀幹前傾', left: '0°', right: '30°', min: 0, max: 30, step: 1, def: 10, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefTri', label: '三頭偏好', left: '偏外側／內側頭', right: '偏長頭', min: -1, max: 1, step: 0.01, def: 0, joint: 'elbow', mech: 'C', pref: [['trilat'], ['trilong']] },
    ],
    standardNote: '站在滑輪前、軀幹微前傾，上臂貼身不動，從手肘約 90～100° 壓到完全伸直。',
  },
  legext: {
    name: '腿伸機', topLabel: '伸直', bottomLabel: '彎曲',
    viewCenter: [0, 0.55, 0.3], viewScale: 0.95,
    seated: true, dofs: ['kneeExt'], optDofs: ['hipExt', 'ankPF'],
    pose: legExtPose, loads: padLoads,
    moving: ['kneeExt'],
    params: [
      { key: 'cam', label: '阻力曲線', type: 'select', options: CAMS, def: 'flat', joint: 'equip', mech: 'A' },
      { key: 'depth', label: '起點彎曲角度', left: '70°', right: '115°', min: 0, max: 1, step: 0.01, def: 0.45, joint: 'knee', mech: 'A' },
      { key: 'padPos', label: '墊子位置', left: '小腿中段', right: '腳踝上方', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'equip', mech: 'A' },
    ],
    standardNote: '膝關節對準機器轉軸、墊子在腳踝上方，從約 90° 伸到接近伸直，頂點停一下。',
  },
  legcurl: {
    name: '腿彎舉機', topLabel: '彎到底', bottomLabel: '伸直',
    viewCenter: [0, 0.55, 0.2], viewScale: 1.0,
    seated: true, dofs: ['kneeExt'], optDofs: ['hipExt', 'ankPF'],
    pose: legCurlPose, loads: padLoads,
    moving: ['kneeExt'],
    params: [
      { key: 'posture', label: '姿勢', type: 'select', options: [['seated', '坐姿'], ['lying', '俯臥']], def: 'seated', joint: 'hip', mech: 'A' },
      { key: 'cam', label: '阻力曲線', type: 'select', options: CAMS, def: 'flat', joint: 'equip', mech: 'A' },
      { key: 'depth', label: '頂點彎曲角度', left: '70°', right: '115°', min: 0, max: 1, step: 0.01, def: 0.5, joint: 'knee', mech: 'A' },
      { key: 'padPos', label: '墊子位置', left: '小腿中段', right: '腳踝上方', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'equip', mech: 'A' },
    ],
    standardNote: '膝關節對準機器轉軸、墊子在跟腱上方；坐姿時髖屈曲讓膕繩肌處於拉長位置，俯臥時較短。',
  },
  chestpress: {
    name: '坐姿胸推機', topLabel: '推直', bottomLabel: '最靠近胸口',
    viewCenter: [0, 1.0, 0.2], viewScale: 1.0,
    seated: true, dofs: ['shFlex', 'shHAdd', 'elbExt'],
    pose: chestPressPose, loads: pushLoads,
    moving: ['shFlex', 'shHAdd', 'elbExt'],
    params: [
      { key: 'grip', label: '握把寬度（× 肩峰寬）', left: '0.8', right: '2.0', min: 0.8, max: 2, step: 0.01, def: 1.5, joint: 'hand', mech: 'A' },
      { key: 'flare', label: '手肘外開角度', left: '30°', right: '90°', min: 30, max: 90, step: 1, def: 55, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'touch', label: '握把高度', left: '上胸', right: '下胸', min: 0, max: 1, step: 0.01, def: 0.5, joint: 'bar', mech: 'A' },
      { key: 'scap', label: '肩胛後收', left: '前伸', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.7, joint: 'shoulder', mech: 'A' },
      { key: 'prefPD', label: '肩水平內收偏好', left: '偏胸', right: '偏前三角', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecs', 'pecc'], ['adelt']] },
    ],
    standardNote: '椅子調到握把與胸中段同高、肩胛後收貼椅背、手肘外開約 45～60°，推到手臂接近伸直。',
  },
};
export const JOINT_NAMES = { equip: '器材', scap: '肩胛', hip: '髖', knee: '膝', ankle: '踝', lumbar: '下背', shoulder: '肩', elbow: '肘', hand: '握距', bar: '槓' };

export function defaultParams(lift) {
  const o = {};
  for (const p of LIFTS[lift].params) o[p.key] = p.def;
  return o;
}

// ---------- 肌肉 ----------
// arms：各自由度的力臂（m），正值 = 產生該方向力矩
// 水平內收力臂隨「上臂離開軀幹長軸的角度」縮小：手臂夾在身側時，繞軀幹長軸轉動變成上臂內旋（由旋轉肌袖平衡），不再是水平內收
const hadd = (r) => (q) => r * (q.haddW ?? 1);
// 旋轉肌袖：繞上臂自身長軸轉，投影到軀幹長軸的比例 = |cos(上臂與軀幹長軸夾角)|；手臂外展時棘下肌也是水平外展肌
const axial = (q) => Math.abs(Math.cos(q.shElev ?? rad(90)));
export const MUSCLES = [
  { id: 'vasti', name: '股四頭肌（股廣肌群）', F: 6000, Lf: 0.2, arms: { kneeExt: 0.045 } },
  { id: 'rf', name: '股直肌', F: 1100, Lf: 0.2, arms: { kneeExt: 0.04, hipExt: -0.035 } },
  { id: 'hams', name: '膕繩肌', F: 2000, Lf: 0.22, arms: { hipExt: 0.06, kneeExt: -0.03 } },
  { id: 'gmax', name: '臀大肌', F: 2600, Lf: 0.28, arms: { hipExt: (q) => 0.075 - 0.02 * clamp(q.hipFlex / rad(100), 0, 1.2), hipAbd: 0.015 } },
  { id: 'gmed', name: '臀中肌', F: 1700, Lf: 0.15, arms: { hipAbd: 0.05 } },
  { id: 'addmag', name: '內收大肌', F: 1700, Lf: 0.32, arms: { hipExt: (q) => 0.03 + 0.025 * clamp(q.hipFlex / rad(90), 0, 1.3), hipAbd: -0.035 } },
  { id: 'addl', name: '內收長／短肌', F: 900, Lf: 0.15, arms: { hipAbd: -0.05, hipExt: -0.015 } },
  { id: 'ilio', name: '髂腰肌', F: 1300, Lf: 0.18, arms: { hipExt: -0.04 } },
  { id: 'gas', name: '腓腸肌', F: 2200, Lf: 0.12, arms: { ankPF: 0.05, kneeExt: -0.02 } },
  { id: 'sol', name: '比目魚肌', F: 3500, Lf: 0.1, arms: { ankPF: 0.05 } },
  { id: 'ta', name: '脛前肌', F: 900, Lf: 0.1, arms: { ankPF: -0.04 } },
  { id: 'erec', name: '豎脊肌', F: 5000, Lf: 0.15, arms: { trunkExt: 0.05 } },
  { id: 'ra', name: '腹直肌', F: 700, Lf: 0.2, arms: { trunkExt: -0.08 } },
  { id: 'pecs', name: '胸大肌（中下胸）', F: 1800, Lf: 0.35, arms: { shHAdd: hadd(0.07), shFlex: (q) => 0.055 - 0.05 * clamp(q.shFlex / rad(110), 0, 1), scElev: -0.025 } },
  // 上胸：手臂舉過約 100° 之後屈曲力臂逐漸消失
  { id: 'pecc', name: '胸大肌（上胸）', F: 700, Lf: 0.3, arms: { shHAdd: hadd(0.04), shFlex: (q) => 0.035 * clamp((rad(150) - q.shFlex) / rad(50), 0, 1) } },
  { id: 'adelt', name: '三角肌前束', F: 600, Lf: 0.25, arms: { shFlex: 0.035, shHAdd: hadd(0.02), shAbd: 0.012 } },
  { id: 'pdelt', name: '三角肌後束', F: 500, Lf: 0.2, arms: { shFlex: -0.025, shHAdd: hadd(-0.04), shAbd: 0.012 } },
  // 背闊肌從軀幹接到肱骨、跨過肩胛：也是肩帶的主要下壓肌（scElev 負力臂）
  { id: 'lat', name: '背闊肌', F: 1500, Lf: 0.25, opt: ['shHAdd'], arms: { shFlex: (q) => -0.05 * clamp((rad(170) - q.shFlex) / rad(80), 0.15, 1), shAbd: (q) => -0.035 * clamp(q.shAbd / rad(60), 0.2, 1), shHAdd: hadd(-0.02), scElev: -0.04 } },
  { id: 'trilong', name: '肱三頭肌長頭', F: 1000, Lf: 0.15, arms: { elbExt: 0.02, shFlex: -0.02 } },
  { id: 'trilat', name: '肱三頭肌外側／內側頭', F: 2000, Lf: 0.12, arms: { elbExt: 0.022 } },
  { id: 'bic', name: '肱二頭肌', F: 750, Lf: 0.14, arms: { elbExt: -0.03, shFlex: 0.012 } },
  { id: 'brach', name: '肱肌／肱橈肌', F: 1200, Lf: 0.1, arms: { elbExt: -0.025 } },
  // 起點在肩胛骨的肩內收肌：不跨肩胛胸廓，單純提供內收（避免只有背闊肌能內收、牽動整串副作用）
  { id: 'tmaj', name: '大圓肌', F: 600, Lf: 0.15, arms: { shFlex: -0.025, shAbd: -0.03 } },
  { id: 'corb', name: '喙肱肌', F: 250, Lf: 0.12, arms: { shFlex: 0.015, shAbd: -0.02 } },
  { id: 'infra', name: '棘下肌／小圓肌', F: 900, Lf: 0.08, arms: { shHAdd: (q) => -0.025 * Math.max(axial(q), q.haddW ?? 1) } },
  { id: 'subsc', name: '肩胛下肌', F: 1200, Lf: 0.08, arms: { shHAdd: (q) => 0.025 * axial(q) } },
  // 以下只在有分析肩外展與肩胛的動作出現（划船、肩推）
  { id: 'mdelt', name: '三角肌中束', F: 1100, Lf: 0.2, arms: { shAbd: (q) => 0.02 + 0.015 * clamp(q.shAbd / rad(60), 0, 1) } },
  // 肩胛：力臂相對胸鎖關節；scRet = 後收、scElev = 上提（含上旋）
  { id: 'midtrap', name: '斜方肌中束／菱形肌', F: 1000, Lf: 0.12, arms: { scRet: 0.07 } },
  { id: 'uptrap', name: '斜方肌上束', F: 900, Lf: 0.15, arms: { scElev: 0.07, scRet: 0.02 } },
  { id: 'lowtrap', name: '斜方肌下束', F: 500, Lf: 0.15, arms: { scElev: -0.035, scRet: 0.05 } },
  { id: 'serr', name: '前鋸肌', F: 1000, Lf: 0.15, arms: { scRet: -0.07, scElev: 0.03 } },
];
export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));

const DOF_REF = { hipExt: rad(-40), hipAbd: 0, kneeExt: rad(-50), ankPF: rad(-10), trunkExt: 0, shFlex: rad(20), shHAdd: rad(20), elbExt: rad(-70), shAbd: rad(20), scRet: 0, scElev: 0 };
// 只在部分動作分析的自由度：沒分析時，肌肉在這些方向的力臂直接忽略（例如背闊肌在臥推只算屈伸）
const OPTIONAL_DOFS = ['shAbd', 'scRet', 'scElev'];
export function liftMuscles(lift) {
  const dofs = LIFTS[lift].dofs, opt = LIFTS[lift].optDofs || [];
  return MUSCLES.filter((m) => {
    const ks = Object.keys(m.arms);
    // opt：次要作用，該動作沒分析這個方向時可以忽略（不會因此把整條肌肉排除）
    return ks.some((k) => dofs.includes(k)) && ks.every((k) => dofs.includes(k) || OPTIONAL_DOFS.includes(k) || opt.includes(k) || m.opt?.includes(k));
  });
}

// ---------- 姿勢 ----------
function legChain(pose, A, toe, hip, extra = {}) {
  const leg = ik2(hip, A, BODY.Lt, BODY.Ls, toe);
  pose.R.hip = hip; pose.R.knee = leg.mid; pose.R.ankle = A;
  const fy = A[1] - BODY.ankleH + 0.02; // 腳底高度（站在墊高台上時 > 0）
  pose.R.toe = [A[0] + toe[0] * 0.19, fy, A[2] + toe[2] * 0.19];
  pose.R.heel = [A[0] - toe[0] * 0.06, fy, A[2] - toe[2] * 0.06];
  pose.toeDir = toe;
  return leg.ok;
}

// ---------- 肩帶（肩胛骨＋鎖骨）----------
// 軀幹局部座標：x = 外側、y = 沿軀幹向上、z = 前方，原點 = 骨盆中心；數值來自 BodyParts3D
export const GIRDLE = { scj: [0.0151, 0.5243, 0.0583], sh: [BODY.shHalf, BODY.Ltr, 0] };
// ret：後收（正）／前伸（負）；elev：上提（正）／下壓（負）；單位 rad
export function girdleMatrix(g) {
  const cr = Math.cos(g.ret), sr = Math.sin(g.ret), ce = Math.cos(g.elev), se = Math.sin(g.elev);
  // Ry(ret) · Rz(elev)
  return [[cr * ce, -cr * se, sr], [se, ce, 0], [-sr * ce, sr * se, cr]];
}
export function shoulderLocal(g) {
  const M = girdleMatrix(g), d = sub(GIRDLE.sh, GIRDLE.scj);
  return add(GIRDLE.scj, M.map((r) => dot(r, d)));
}
const toWorld = (tf, l) => add(add(add(tf.Pc, mul(tf.lat, l[0])), mul(tf.u, l[1])), mul(tf.f, l[2]));

function trunkFrame(Pc, u) {
  const lat = [1, 0, 0];
  const f = norm(cross(lat, u));
  return { Pc, u, f, lat, SC: add(Pc, mul(u, BODY.Ltr)) };
}

function armChain(pose, S, H, pole) {
  const arm = ik2(S, H, BODY.Lu, BODY.Lf, pole);
  pose.R.shoulder = S; pose.R.elbow = arm.mid; pose.R.hand = arm.end;
  pose.armPole = pole;
  return arm.ok;
}

// 手腕折彎的握法（深蹲扛槓）：前臂到手腕 Lw、手腕到槓中心 Lh、手腕背伸約 eps。
// 前臂＋手當成一根直棍（BODY.Lf）時，槓在肩膀附近會逼手肘甩到頭旁邊或往脊椎塌；實際上手腕是往後折的。
// 手腕→槓 的方向一定垂直槓（手掌橫過槓），hpref 決定兩個解中取哪一個（手從手腕往哪個方向伸到槓）。
// R.hand 仍放在前臂延長線上 Lf 處（前臂座標的握點），R.grip = 槓上的實際握點，R.wrist = 手腕。
const WRIST_LW = 0.746; // 肘→腕 = 0.746 Lf（BodyParts3D）；Lh = 腕→槓中心：槓在掌骨頭掌側約 9 cm、在掌根約 5 cm
function armChainBent(pose, S, B, pole, [epsDeg, Lh], hpref) {
  const Lw = WRIST_LW * BODY.Lf, eps = rad(epsDeg);
  const Leff = Math.sqrt(Lw * Lw + Lh * Lh + 2 * Lw * Lh * Math.cos(eps));
  const arm = ik2(S, B, BODY.Lu, Leff, pole);
  const E = arm.mid, v = sub(E, B);
  // h = 手腕→槓（在 yz 平面）：|v + Lh h| = Lw → v·h = c
  const c = (Lw * Lw - dot(v, v) - Lh * Lh) / (2 * Lh), Rr = Math.hypot(v[1], v[2]), ph = Math.atan2(v[2], v[1]);
  const da = Math.acos(clamp(c / Rr, -1, 1));
  const hs = [ph + da, ph - da].map((t) => [0, Math.cos(t), Math.sin(t)]);
  const h = dot(hs[0], hpref) >= dot(hs[1], hpref) ? hs[0] : hs[1];
  const W = sub(B, mul(h, Lh));
  pose.R.shoulder = S; pose.R.elbow = E; pose.R.wrist = W;
  pose.R.hand = add(E, mul(norm(sub(W, E)), BODY.Lf));
  pose.R.grip = B;
  pose.armPole = pole;
  return arm.ok;
}

// [手腕背伸角（度）, 腕→槓距離（m）]
export const SQ_WRIST = { high: [30, 0.075], low: [90, 0.05], front: [105, 0.05] };
function squatPose(P, e) {
  const w = lerp(0.13, 0.34, P.stance), tau = rad(lerp(8, 38, P.stance));
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const thS = rad(4 + (lerp(40, 16, P.dom) - 4) * e), gam = rad(lerp(70, 118, P.depth)) * e;
  const A = [w, BODY.ankleH, -0.07];
  let Ls = BODY.Ls, Lt = BODY.Lt, K, Hy, Hz;
  for (let i = 0; i < 4; i++) {
    const Ky = A[1] + Ls * Math.cos(thS), Kz = A[2] + Ls * Math.sin(thS);
    Hy = Ky + Lt * Math.cos(gam); Hz = Kz - Lt * Math.sin(gam);
    const Kx = w + (Kz - A[2]) * Math.tan(tau);
    K = [Kx, Ky, Kz];
    Ls = Math.sqrt(Math.max(0.01, BODY.Ls ** 2 - (Kx - w) ** 2));
    Lt = Math.sqrt(Math.max(0.01, BODY.Lt ** 2 - (Kx - BODY.hipHalf) ** 2));
  }
  const low = P.barPos === 'low', front = P.barPos === 'front';
  // ob：槓在軀幹後方的距離（負值 = 前方，前槓放在三角肌前束上）
  const Lb = front ? 0.5 : low ? 0.45 : 0.53, ob = front ? -0.11 : low ? 0.085 : 0.05, handX = front ? 0.23 : low ? 0.3 : 0.34;
  const Pc = [0, Hy, Hz];
  const build = (phi) => {
    const u = [0, Math.cos(phi), Math.sin(phi)];
    const tf = trunkFrame(Pc, u);
    const bar = add(add(Pc, mul(u, Lb)), mul(tf.f, -ob));
    return { tf, bar };
  };
  const pose = { R: {}, warn: [], ok: true };
  pose.R.hip = [BODY.hipHalf, Hy, Hz]; pose.R.knee = K; pose.R.ankle = A;
  const comz = (phi) => {
    const { tf, bar } = build(phi);
    const W = BAR_RATIO.squat;
    // 腿部 + 軀幹 + 槓（雙側）；手臂近似併入軀幹
    let m = W, z = W * bar[2];
    const tr = add(tf.Pc, mul(tf.u, 0.3));
    const mt = MF.trunk + 2 * (MF.upper + MF.fore);
    m += mt; z += mt * tr[2];
    const th = lerpV(pose.R.hip, K, 0.433), sh = lerpV(K, A, 0.433);
    m += 2 * MF.thigh + 2 * MF.shank + 2 * MF.foot;
    z += 2 * MF.thigh * th[2] + 2 * MF.shank * sh[2] + 2 * MF.foot * (A[2] + 0.06);
    return z / m;
  };
  let phi;
  if (comz(0) >= 0) phi = 0;
  else if (comz(rad(85)) < 0) { phi = rad(85); pose.ok = false; pose.conflict = '重心無法維持在腳掌中段：軀幹已前傾到極限'; }
  else {
    let lo = 0, hi = rad(85);
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (comz(mid) < 0) lo = mid; else hi = mid; }
    phi = (lo + hi) / 2;
  }
  const { tf, bar } = build(phi);
  Object.assign(pose, tf);
  pose.phi = phi;
  legChain(pose, A, toe, pose.R.hip);
  pose.R.knee = K; // 以平面解的膝位置為準
  pose.girdle = { ret: rad(15), elev: 0 };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  // 握點 = 槓中心（手掌與手指在 rig.js 依槓的位置擺放）
  // 手腕往後折（背伸），手肘才會落在合理位置：高槓手肘朝下後方、低槓上臂往後下約 45°（世界座標，不隨軀幹前傾翹起）、前槓手肘在前略低於肩（手掌朝上托槓）
  const B = [handX, bar[1], bar[2]];
  if (front) {
    // 前架式：手肘往前抬高（上臂接近水平）、掌心朝上（旋後）用手指在槓下方托住
    armChainBent(pose, S, B, norm([0.45, -0.05, 1]), SQ_WRIST.front, norm(add(tf.u, mul(tf.f, -0.4))));
    pose.supinated = true;
  } else if (low) armChainBent(pose, S, B, norm([0.6, -1, -1]), SQ_WRIST.low, [0, 1, 0]);
  else armChainBent(pose, S, B, norm(add(mul(tf.f, -1), [0, -1, 0])), SQ_WRIST.high, [0, 1, 0]);
  pose.bar = bar;
  if (deg(phi) > 62) pose.warn.push('軀幹前傾很大');
  else if (front && deg(phi) > 45) pose.warn.push('前蹲軀幹前傾 ' + Math.round(deg(phi)) + '°，槓容易從肩上滑落');
  pose.cop = [w, 0, 0];
  pose.barW = BAR_RATIO.squat;
  pose.barOnBack = true;
  return pose;
}

// 腿前緣（含軟組織）在高度 y 的 z 座標
function legFrontZ(A, hip, knee, y) {
  if (y <= knee[1]) {
    const t = clamp((y - A[1]) / (knee[1] - A[1]), 0, 1);
    return lerp(A[2], knee[2], t) + 0.035;
  }
  const t = clamp((y - knee[1]) / (hip[1] - knee[1]), 0, 1);
  return lerp(knee[2], hip[2], t) + lerp(0.05, 0.09, t);
}

const dlTopCache = new Map();
function deadliftPose(P, e) {
  const sumo = P.style === 'sumo';
  const w = sumo ? 0.36 : 0.15, tau = rad(sumo ? 40 : 8), gx = sumo ? 0.17 : 0.25;
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  // 起始槓高：負值 = 赤字（站在墊高台上）、正值 = 槓片架在墊塊上
  const dfc = Math.max(0, -(P.start || 0)) / 100, blk = Math.max(0, P.start || 0) / 100;
  const A = [w, BODY.ankleH + dfc, -0.07];
  const gap = 0.1 * P.barDist;           // 槓與腿前緣的距離
  const bz = 0.02 + 0.5 * gap;           // 槓的垂直路徑（約在腳掌中段）
  const target = bz - 0.016 - gap;        // 腿前緣要停在這裡（槓半徑 1.4 cm + 空隙）
  const Lr = BODY.Lu + BODY.Lf - 0.002;
  const girdle = { ret: rad(-8), elev: rad(-5) }; // 負重下肩胛略前伸、下壓
  const dl = shoulderLocal(girdle);
  const R2 = Lr ** 2 - (gx - dl[0]) ** 2;
  const maxReach = (BODY.Ls + BODY.Lt) * 0.997;

  // 給定軀幹角與槓高：找出「腿剛好貼著槓」的骨盆前後位置
  const place = (phi, barY) => {
    const u = [0, Math.cos(phi), Math.sin(phi)];
    const build = (pcz) => {
      const Sz = pcz + u[2] * dl[1] + u[1] * dl[2];
      const dz = clamp(Sz - bz, -Math.sqrt(R2) * 0.98, Math.sqrt(R2) * 0.98);
      const Sy = barY + Math.sqrt(R2 - dz * dz);
      const Pc = [0, Sy - (u[1] * dl[1] - u[2] * dl[2]), pcz - (Sz - (bz + dz))];
      const hip = [BODY.hipHalf, Pc[1], Pc[2]];
      const knee = ik2(hip, A, BODY.Lt, BODY.Ls, toe).mid;
      return { u, Pc, hip, knee, S: [dl[0], Sy, bz + dz], front: legFrontZ(A, hip, knee, barY), d: len(sub(hip, A)) };
    };
    let lo = bz - 1.0, hi = bz + 0.3;
    for (let i = 0; i < 34; i++) { const m = (lo + hi) / 2; if (build(m).front > target) hi = m; else lo = m; }
    return build(lo);
  };
  const key = JSON.stringify([P.style, P.barDist, P.start || 0]);
  let barTopY = dlTopCache.get(key);
  if (barTopY === undefined) {
    let lo = 0.4, hi = 1.3;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (place(0, m).d <= maxReach) lo = m; else hi = m; }
    barTopY = lo;
    if (dlTopCache.size > 50) dlTopCache.clear();
    dlTopCache.set(key, barTopY);
  }
  const barY = lerp(barTopY, 0.225 + blk, e);
  const phi0 = rad(sumo ? lerp(36, 58, P.dom) : lerp(48, 70, P.dom));
  const pose = { R: {}, warn: [], ok: true };
  // 前半段主要伸膝、軀幹角變化小；後半段才伸髖
  let phi = phi0 * Math.pow(e, 0.45);
  let r = place(phi, barY);
  if (r.d > maxReach) {
    // 腿伸直也碰不到：軀幹改直一點（髖往下、往前）
    let lo = 0, hi = phi;
    if (place(0, barY).d > maxReach) { pose.ok = false; pose.conflict = '槓的位置太高或太遠，腿伸直也碰不到'; }
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (place(m, barY).d > maxReach) hi = m; else lo = m; }
    phi = lo; r = place(phi, barY);
  }
  if (r.d < 0.3) { pose.ok = false; pose.conflict = '髖位太低，膝關節彎曲超過可行範圍'; }
  const tf = trunkFrame(r.Pc, r.u);
  Object.assign(pose, tf);
  pose.phi = phi;
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  armChain(pose, r.S, [gx, barY, bz], norm(add(mul(tf.f, -1), [0.3, -0.2, 0])));
  pose.bar = [0, barY, bz];
  const armTilt = deg(Math.atan2(Math.abs(r.S[2] - bz), r.S[1] - barY));
  if (armTilt > 10 && r.S[2] < bz && e > 0.5) pose.warn.push('肩膀落在槓後方 ' + Math.round(armTilt) + '°');
  pose.cop = [w, dfc, 0];
  pose.floorY = dfc;
  if (dfc > 0) pose.platform = { h: dfc, x: w, z: A[2] + 0.05 };
  if (blk > 0) pose.blocks = { h: blk, z: bz };
  pose.barW = BAR_RATIO.deadlift;
  return pose;
}

// 羅馬尼亞硬舉：膝角度固定、從站姿往下做髖鉸鏈；槓沿腳掌中段垂直移動並貼著腿
function rdlPose(P, e) {
  const w = 0.14, tau = rad(8), gx = 0.24;
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const gap = 0.1 * P.barDist;
  const bz = 0.02 + 0.5 * gap;
  const target = bz - 0.016 - gap;
  const Lr = BODY.Lu + BODY.Lf - 0.002;
  const girdle = { ret: rad(-5), elev: rad(-5) };
  const dl = shoulderLocal(girdle);
  const R2 = Lr ** 2 - (gx - dl[0]) ** 2;
  const kap = rad(P.kneeBend);
  const phi = rad(lerp(3, lerp(50, 85, P.depth), e));
  const u = [0, Math.cos(phi), Math.sin(phi)];
  // 平面上的有效長度（扣掉左右方向的距離）
  const kx = lerp(w, BODY.hipHalf, BODY.Ls / (BODY.Ls + BODY.Lt));
  const Ls = Math.sqrt(BODY.Ls ** 2 - (w - kx) ** 2), Lt = Math.sqrt(BODY.Lt ** 2 - (kx - BODY.hipHalf) ** 2);
  // 給定小腿前傾角 th：求出髖、肩、槓的位置，回傳腿前緣與槓的距離
  const build = (th) => {
    const knee = [kx, A[1] + Ls * Math.cos(th), A[2] + Ls * Math.sin(th)];
    const hip = [BODY.hipHalf, knee[1] + Lt * Math.cos(th - kap), knee[2] + Lt * Math.sin(th - kap)];
    const Pc = [0, hip[1], hip[2]];
    const tf = trunkFrame(Pc, u);
    const S = toWorld(tf, dl);
    const dz = S[2] - bz;
    const reach = dz * dz < R2;
    const barY = S[1] - Math.sqrt(Math.max(0, R2 - dz * dz));
    return { knee, hip, tf, S, barY, reach, f: legFrontZ(A, hip, knee, barY) - target };
  };
  // 兩個條件取較靠後的：(1) 肩膀略在槓前方（手臂接近垂直）→ 髖往後推維持平衡；(2) 腿不能穿過槓
  const solve = (g) => {
    let lo = rad(-10), hi = rad(30);
    if (g(lo) > 0) return lo;
    if (g(hi) < 0) return hi;
    for (let i = 0; i < 34; i++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; }
    return lo;
  };
  const sOff = 0.03 * e;
  const thS = solve((th) => build(th).S[2] - (bz + sOff));
  const thC = solve((th) => build(th).f);
  const r = build(Math.min(thS, thC));
  const pose = { R: {}, warn: [], ok: true };
  if (!r.reach) { pose.ok = false; pose.conflict = '手臂碰不到腳掌正上方的槓'; }
  if (r.barY < 0.225) { pose.ok = false; pose.conflict = '下放太深，槓片已經碰到地面'; }
  Object.assign(pose, r.tf);
  pose.phi = phi;
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  armChain(pose, r.S, [gx, r.barY, bz], norm(add(mul(r.tf.f, -1), [0.3, -0.2, 0])));
  pose.bar = [0, r.barY, bz];
  pose.cop = [w, 0, 0];
  pose.barW = BAR_RATIO.rdl;
  const shin = deg(Math.atan2(r.knee[2] - A[2], r.knee[1] - A[1]));
  if (shin > 15 && e > 0.3) pose.warn.push('膝蓋往前跑 ' + Math.round(shin) + '°，變成接近深蹲');
  if (r.barY < r.knee[1] - 0.12 && e > 0.5) pose.warn.push('槓已低於膝下方，注意膕繩肌柔軟度');
  return pose;
}

// 膝角度固定的站姿：給小腿前傾角 th，回傳膝、髖（平面近似，扣掉左右方向的距離）
function fixedKneeLegs(A, w, kap) {
  const kx = lerp(w, BODY.hipHalf, BODY.Ls / (BODY.Ls + BODY.Lt));
  const Ls = Math.sqrt(BODY.Ls ** 2 - (w - kx) ** 2), Lt = Math.sqrt(BODY.Lt ** 2 - (kx - BODY.hipHalf) ** 2);
  return (th) => {
    const knee = [kx, A[1] + Ls * Math.cos(th), A[2] + Ls * Math.sin(th)];
    const hip = [BODY.hipHalf, knee[1] + Lt * Math.cos(th - kap), knee[2] + Lt * Math.sin(th - kap)];
    return { knee, hip };
  };
}
// 單調函數 g 的根（找不到就停在邊界）
function bisect(g, lo, hi, n = 34) {
  if (g(lo) > 0) return lo;
  if (g(hi) < 0) return hi;
  for (let i = 0; i < n; i++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
// 系統重心 z（雙側；手臂各自計入，槓在 bar）
function systemComZ(pose, bar, barW) {
  const R = pose.R;
  const parts = [
    [2 * MF.foot, R.ankle[2] + 0.06], [2 * MF.shank, lerp(R.knee[2], R.ankle[2], 0.433)], [2 * MF.thigh, lerp(R.hip[2], R.knee[2], 0.433)],
    [MF.trunk, pose.Pc[2] + pose.u[2] * 0.3], [2 * MF.upper, lerp(R.shoulder[2], R.elbow[2], 0.436)], [2 * MF.fore, lerp(R.elbow[2], R.hand[2], 0.55)],
    [barW, bar[2]],
  ];
  let m = 0, z = 0;
  for (const [mi, zi] of parts) { m += mi; z += mi * zi; }
  return z / m;
}

// 槓鈴划船：軀幹角固定、髖往後讓手臂垂下時槓在腳掌中段正上方；槓從垂手位置拉到軀幹
function rowPose(P, e) {
  const w = 0.15, tau = rad(8);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const bz = 0.02, gx = 0.2 * P.grip;
  const phi = rad(P.torso);
  const u = [0, Math.cos(phi), Math.sin(phi)];
  const legs = fixedKneeLegs(A, w, rad(22));
  const g0 = { ret: rad(-8), elev: rad(-6) };
  const girdle = { ret: lerp(g0.ret, rad(lerp(-2, 25, P.scap)), Math.pow(e, 1.5)), elev: lerp(g0.elev, rad(0), e) };
  const Lr = 0.985 * (BODY.Lu + BODY.Lf);
  const dl = shoulderLocal(girdle), dl0 = shoulderLocal(g0);
  // 給小腿角 th：手臂垂下的位置（肩膀正下方）→ 觸身點（軀幹前緣，腹部厚度約 13 cm＋槓半徑，從肚臍到下胸）
  const at = (th) => {
    const { knee, hip } = legs(th);
    const tf = trunkFrame([0, hip[1], hip[2]], u);
    const S0 = toWorld(tf, dl0), S = toWorld(tf, dl);
    const hang = [gx, S0[1] - Math.sqrt(Math.max(0.01, Lr ** 2 - (gx - S0[0]) ** 2)), S0[2]];
    const touch = add(add(tf.Pc, mul(u, lerp(0.14, 0.36, P.pullTo))), mul(tf.f, 0.145));
    touch[0] = gx;
    const bar = lerpV(hang, touch, e);
    return { knee, hip, tf, S, hang, bar };
  };
  // 每一幀都讓系統重心停在腳掌中段（槓往身上拉時，髖會跟著往前一點）
  const com = (th) => {
    const r = at(th);
    return systemComZ({ R: { hip: r.hip, knee: r.knee, ankle: A, shoulder: r.S, elbow: lerpV(r.S, r.bar, 0.5), hand: r.bar }, Pc: r.tf.Pc, u }, r.bar, BAR_RATIO.row);
  };
  const r = at(bisect((th) => com(th) - bz, rad(-10), rad(30)));
  const { tf, S, hang, bar } = r;
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = phi;
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  const fl = rad(P.flare);
  const pole = norm(add(add(mul(tf.f, -Math.cos(fl)), mul(tf.lat, Math.sin(fl))), mul(tf.u, -0.3)));
  const ok = armChain(pose, S, bar, pole);
  if (!ok && e > 0.3) { pose.ok = false; pose.conflict = '手臂長度無法把槓拉到這個位置'; }
  pose.bar = [0, bar[1], bar[2]];
  if (hang[1] < 0.225) { pose.ok = false; pose.conflict = '軀幹太低，垂手時槓片會碰地'; }
  pose.barW = BAR_RATIO.row;
  pose.supinated = P.supin === 'sup';
  if (P.torso < 40) pose.warn.push('軀幹偏直立：拉的方向接近聳肩，上斜方肌參與增加');
  return pose;
}

// 站姿肩推：腳到肩近似一個整體繞踝關節前後傾，讓系統重心停在腳掌中段；軀幹可再相對骨盆後仰
function ohpPose(P, e) {
  const w = 0.14, tau = rad(8);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const bz = 0.02, gx = 0.2 * P.grip;
  const legs = fixedKneeLegs(A, w, rad(3));
  const lean = rad(P.lean) * (0.4 + 0.6 * e); // 槓經過臉時後仰最多，鎖死時身體回正一些
  const girdle = { ret: rad(lerp(0, 8, e)), elev: rad(lerp(4 + 14 * P.shrug, -2, e)) };
  const dl = shoulderLocal(girdle);
  const Rl = 0.995 * (BODY.Lu + BODY.Lf);
  const a = rad(P.flare);
  const build = (th) => {
    const { knee, hip } = legs(th);
    const pt = th - rad(3) - lean;
    const tf = trunkFrame([0, hip[1], hip[2]], [0, Math.cos(pt), Math.sin(pt)]);
    const S = toWorld(tf, dl);
    // 鎖死：手臂幾乎伸直、往前偏 path；觸鎖骨：槓在胸骨上緣前方
    const dz = lerp(0, 0.1, P.path), dx = gx - S[0];
    const lock = [gx, S[1] + Math.sqrt(Math.max(0.01, Rl ** 2 - dx * dx - dz * dz)), S[2] + dz];
    // 前臂垂直時槓約在肩關節高度、架在三角肌前束上
    const rack = add(add(tf.Pc, mul(tf.u, 0.535)), mul(tf.f, 0.11));
    rack[0] = gx;
    const bar = lerpV(lock, rack, e);
    // 槓經過頭部高度時要繞過下巴
    const head = add(tf.SC, mul(tf.u, 0.2));
    if (Math.abs(bar[1] - head[1]) < 0.13) bar[2] = Math.max(bar[2], head[2] + 0.12);
    return { knee, hip, tf, S, bar, head };
  };
  const com = (th) => {
    const r = build(th);
    const pose = { R: { hip: r.hip, knee: r.knee, ankle: A, shoulder: r.S, hand: r.bar }, Pc: r.tf.Pc, u: r.tf.u };
    pose.R.elbow = lerpV(r.S, r.bar, 0.45);
    return systemComZ(pose, r.bar, BAR_RATIO.ohp);
  };
  const r = build(bisect((th) => com(th) - bz, rad(-15), rad(15)));
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, r.tf);
  pose.phi = r.tf.u[2] < 0 ? -Math.asin(-r.tf.u[2]) : Math.asin(r.tf.u[2]);
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  const pole = norm(add(add(mul(r.tf.lat, Math.sin(a)), mul(r.tf.f, Math.cos(a))), mul(r.tf.u, -0.8)));
  const ok = armChain(pose, r.S, r.bar, pole);
  if (!ok && e > 0.2) { pose.ok = false; pose.conflict = '手臂長度無法支撐這個槓位'; }
  pose.bar = [0, r.bar[1], r.bar[2]];
  pose.barW = BAR_RATIO.ohp;
  const fore = sub(pose.R.hand, pose.R.elbow);
  const tilt = deg(Math.acos(clamp(fore[1] / len(fore), -1, 1)));
  if (e > 0.7 && tilt > 25) pose.warn.push('前臂偏離垂直 ' + Math.round(tilt) + '°');
  if (deg(lean) > 12) pose.warn.push('後仰 ' + Math.round(deg(lean)) + '°，變成上斜推、下背壓力增加');
  return pose;
}

// 站姿、槓在手上（彎舉、聳肩、直立划船）：腳到肩繞踝前後傾，讓系統重心停在腳掌中段
// kap = 膝彎曲、lean = 軀幹相對大腿前傾（負 = 後仰）；barAt(tf, S, hip, knee) 回傳 { bar, elbow? }（bar 的 x = 握點）
function standingHands(P, { kap, lean, girdle, barAt, pole, barW, ext, copZ = 0.02 }) {
  const w = 0.14, tau = rad(8);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const legs = fixedKneeLegs(A, w, kap);
  const dl = shoulderLocal(girdle);
  const build = (th) => {
    const { knee, hip } = legs(th);
    const pt = th - kap + lean;
    const tf = trunkFrame([0, hip[1], hip[2]], [0, Math.cos(pt), Math.sin(pt)]);
    const S = toWorld(tf, dl);
    return { knee, hip, tf, S, ...barAt(tf, S, hip, knee) };
  };
  const com = (th) => {
    const r = build(th);
    const pz = { R: { hip: r.hip, knee: r.knee, ankle: A, shoulder: r.S, hand: r.bar, elbow: r.elbow || lerpV(r.S, r.bar, 0.5) }, Pc: r.tf.Pc, u: r.tf.u };
    const cz = systemComZ(pz, r.bar, barW);
    if (!ext) return cz;
    // 滑輪等外力（單位：體重）：壓力中心 = 力矩平衡（重量總和 = 1 + barW）
    const F = ext(r), m = 1 + barW;
    return (-m * cz + r.bar[2] * F[1] - r.bar[1] * F[2]) / (-m + F[1]);
  };
  const r = build(bisect((th) => com(th) - copZ, rad(-15), rad(25)));
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, r.tf);
  pose.phi = Math.asin(clamp(r.tf.u[2], -1, 1));
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  const ok = armChain(pose, r.S, r.bar, typeof pole === 'function' ? pole(r.tf, r) : pole);
  pose.barAxial = true;
  pose.bar = [0, r.bar[1], r.bar[2]];
  pose.barW = barW;
  pose.armOk = ok;
  pose.r = r;
  pose.shinTilt = Math.atan2(r.knee[2] - A[2], r.knee[1] - A[1]);
  return pose;
}

// 槓鈴彎舉：上臂從垂直（底部）往前帶到 elbFwd（頂點），手肘屈曲從 18° 到 topFlex
function curlPose(P, e) {
  const gx = 0.2 * P.grip, t = 1 - e; // t = 0 底部、1 頂點
  const as = rad(P.elbFwd) * t, ef = rad(lerp(18, P.topFlex, t));
  const pose = standingHands(P, {
    kap: rad(4), lean: -rad(P.swing) * Math.sin(Math.PI * Math.min(1, t * 1.4) / 2),
    girdle: { ret: rad(8), elev: rad(-4) }, barW: BAR_RATIO.curl,
    pole: (tf, r) => sub(r.elbow, r.S),
    barAt: (tf, S) => {
      const down = mul(tf.u, -1);
      const ud = add(mul(down, Math.cos(as)), mul(tf.f, Math.sin(as)));
      const n = add(mul(tf.u, Math.sin(as)), mul(tf.f, Math.cos(as))); // 矢狀面內、垂直上臂往前
      const E = add(S, mul(ud, BODY.Lu));
      const fd = add(mul(ud, Math.cos(ef)), mul(n, Math.sin(ef)));
      const bar = add(E, mul(fd, BODY.Lf));
      bar[0] = gx;
      return { bar, elbow: E };
    },
  });
  pose.supinated = P.supin !== 'pro';
  if (P.swing > 8) pose.warn.push('身體後仰 ' + Math.round(P.swing) + '°：借力，下背承受較多');
  if (P.elbFwd > 30 && e < 0.3) pose.warn.push('頂點手肘往前帶很多：前臂接近垂直時二頭張力幾乎歸零');
  return pose;
}

// 站姿垂手：手臂從肩膀往下伸直，槓在大腿前方
function hangBar(tf, S, hip, knee, gx) {
  const Lr = 0.997 * (BODY.Lu + BODY.Lf), dx = gx - S[0];
  const y = S[1] - Math.sqrt(Math.max(0.01, Lr * Lr - dx * dx));
  // 槓不能穿過大腿：大腿前緣（含軟組織）約在骨頭前方 9 cm
  const tA = clamp((y - knee[1]) / (hip[1] - knee[1]), 0, 1);
  const thighFront = lerp(knee[2], hip[2], tA) + lerp(0.05, 0.09, tA) + 0.016;
  let z = Math.max(S[2], thighFront);
  const dz = z - S[2];
  const y2 = S[1] - Math.sqrt(Math.max(0.01, Lr * Lr - dx * dx - dz * dz));
  return [gx, y2, z];
}

// 聳肩：手臂垂直伸直，只動肩胛上提（可加後收）
function shrugPose(P, e) {
  const gx = 0.2 * P.grip, t = 1 - e;
  const girdle = { ret: rad(lerp(-6, lerp(-4, 20, P.ret), t)), elev: rad(lerp(-10, lerp(10, 30, P.height), t)) };
  const pose = standingHands(P, {
    kap: rad(6), lean: rad(P.lean), girdle, barW: BAR_RATIO.shrug,
    // 肘部略朝外後方（同硬舉），讓前臂旋前落在自然範圍內、手指確實包覆槓身
    pole: (tf) => norm(add(mul(tf.f, -1), [0.55, -0.1, 0])),
    barAt: (tf, S, hip, knee) => ({ bar: hangBar(tf, S, hip, knee, gx) }),
  });
  if (P.lean > 20) pose.warn.push('軀幹前傾 ' + Math.round(P.lean) + '°：上提方向偏向後收，中斜方參與增加');
  return pose;
}

// 直立划船：槓沿身體前方垂直拉高，手肘往外上方帶
function uprowPose(P, e) {
  const gx = 0.2 * P.grip, t = 1 - e;
  const girdle = { ret: rad(lerp(-4, 6, t)), elev: rad(lerp(-8, lerp(8, 22, P.height), t)) };
  const pose = standingHands(P, {
    kap: rad(6), lean: rad(P.lean), girdle, barW: BAR_RATIO.uprow,
    pole: (tf) => norm(add(add(mul(tf.lat, 1), mul(tf.u, 0.12)), mul(tf.f, -0.3))),
    barAt: (tf, S, hip, knee) => {
      const hang = hangBar(tf, S, hip, knee, gx);
      // 頂點：槓在軀幹前方 4 cm，高度從下胸（0.36）到鎖骨（0.5）
      const top = add(add(tf.Pc, mul(tf.u, lerp(0.36, 0.5, P.height))), mul(tf.f, 0.155));
      top[0] = gx;
      const bar = lerpV(hang, top, Math.pow(t, 0.9));
      // 中間行程：槓貼著身體前緣（不能穿過軀幹）
      const rel = sub(bar, tf.Pc), along = dot(rel, tf.u), front = dot(rel, tf.f);
      if (along > 0 && along < 0.55 && front < 0.15) return { bar: add(bar, mul(tf.f, 0.15 - front)) };
      return { bar };
    },
  });
  const shAbd = deg(Math.asin(clamp(dot(norm(sub(pose.R.elbow, pose.R.shoulder)), pose.lat), -1, 1)));
  const up = deg(Math.acos(clamp(dot(norm(sub(pose.R.elbow, pose.R.shoulder)), mul(pose.u, -1)), -1, 1)));
  if (e < 0.2 && up > 95) pose.warn.push('手肘舉高超過肩膀（上臂抬起 ' + Math.round(up) + '°）：肩峰下空間變窄');
  if (P.grip < 0.8) pose.warn.push('握距很窄：手腕屈曲、肩關節內旋角度大');
  pose.shAbdDeg = shAbd;
  return pose;
}

// 早安體前屈：槓扛在背上、膝角度固定，從站姿往前做髖鉸鏈；每一幀髖往後讓重心停在腳掌中段
function goodMorningPose(P, e) {
  const w = 0.15, tau = rad(10);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const kap = rad(lerp(3, P.kneeBend, Math.min(1, e * 2)));
  const legs = fixedKneeLegs(A, w, kap);
  const low = P.barPos === 'low';
  const Lb = low ? 0.45 : 0.53, ob = low ? 0.085 : 0.05, handX = low ? 0.3 : 0.34;
  const phi = rad(lerp(3, lerp(45, 90, P.depth), e));
  const u = [0, Math.cos(phi), Math.sin(phi)];
  const build = (th) => {
    const { knee, hip } = legs(th);
    const tf = trunkFrame([0, hip[1], hip[2]], u);
    const bar = add(add(tf.Pc, mul(u, Lb)), mul(tf.f, -ob));
    return { knee, hip, tf, bar };
  };
  const comz = (th) => {
    const r = build(th);
    const W = BAR_RATIO.goodmorning, mt = MF.trunk + 2 * (MF.upper + MF.fore);
    const tr = add(r.tf.Pc, mul(u, 0.3));
    const parts = [[W, r.bar[2]], [mt, tr[2]], [2 * MF.thigh, lerp(r.hip[2], r.knee[2], 0.433)], [2 * MF.shank, lerp(r.knee[2], A[2], 0.433)], [2 * MF.foot, A[2] + 0.06]];
    return parts.reduce((s, [m, z]) => s + m * z, 0) / parts.reduce((s, [m]) => s + m, 0);
  };
  const r = build(bisect((th) => comz(th), rad(-20), rad(30)));
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, r.tf);
  pose.phi = phi;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  pose.girdle = { ret: rad(15), elev: 0 };
  const S = toWorld(r.tf, shoulderLocal(pose.girdle));
  const B = [handX, r.bar[1], r.bar[2]];
  if (low) armChainBent(pose, S, B, norm(add(add(mul(r.tf.f, -0.6), mul(r.tf.u, -1)), [0.6, 0, 0])), SQ_WRIST.low, r.tf.u);
  else armChainBent(pose, S, B, norm(add(mul(r.tf.f, -1), mul(r.tf.u, -1))), SQ_WRIST.high, r.tf.u);
  pose.bar = r.bar;
  pose.barW = BAR_RATIO.goodmorning;
  pose.barOnBack = true;
  const shin = deg(Math.atan2(r.knee[2] - A[2], r.knee[1] - A[1]));
  if (deg(phi) > 80) pose.warn.push('軀幹接近水平：下背與膕繩肌承受最大力矩，建議用輕重量');
  if (shin < -12) pose.warn.push('小腿往後傾 ' + Math.round(-shin) + '°，重心偏腳跟');
  return pose;
}

function benchPose(P, e) {
  const pose = { R: {}, warn: [], ok: true, supine: true };
  // 地板臥推：背貼地、不拱背、不能上斜；下放到上臂碰地為止
  const floor = P.surface === 'floor';
  // 上斜：身體繞左右軸轉，頭端抬高；平板時 inc = 0，所有數值與原本相同
  const inc = floor ? 0 : rad(P.incline || 0), ci = Math.cos(inc), si = Math.sin(inc);
  const rot = (v) => [v[0], v[1] * ci - v[2] * si, v[1] * si + v[2] * ci];
  const u = floor ? norm([0, 0.005, -0.5]) : rot(norm(sub([0, 0.53, 0], [0, 0.5, 0.5])));
  pose.girdle = { ret: rad(lerp(-8, 25, P.scap ?? 0.8)), elev: rad(-6) };
  const dl = shoulderLocal(pose.girdle);
  // 軀幹整體平移，讓肩關節停在臥推架的固定位置（拱背幅度不變）；上斜時肩膀跟著椅背升高
  // 地板：肩關節中心離地約 9 cm（肩胛＋背部軟組織厚度）
  const Sy = floor ? 0.09 : 0.53 + 0.45 * si;
  const t0 = trunkFrame([0, 0.5, 0.5], u);
  const S0 = toWorld(t0, dl);
  const tf = trunkFrame(add([0, 0.5, 0.5], [0, Sy - S0[1], -S0[2]]), u);
  Object.assign(pose, tf);
  const S = toWorld(tf, dl);
  const g = 0.2 * P.grip;
  // 觸胸點：以肩膀為原點，沿身體長軸 zt、離胸面高 h，再跟著椅背轉
  const h = 0.125 + 0.03 * Math.sin(Math.PI * P.touch) + 0.015;
  // 上斜時「下胸」離肩膀太遠、前臂無法垂直，觸胸範圍隨角度往上胸收（45° 時最低到 9 cm）
  const [, dyT, zt] = rot([0, h, lerp(0.03, lerp(0.17, 0.09, Math.min(1, inc / rad(45))), P.touch)]);
  const yBot = Sy + dyT;
  // 鎖死點：手臂在肩膀正上方（重力方向），主導決定往觸胸點方向偏多少
  const zLock = lerp(0.0, zt, P.dom);
  const R = 0.985 * (BODY.Lu + BODY.Lf);
  const yTop = Sy + Math.sqrt(Math.max(0.05, R * R - (g - S[0]) ** 2 - zLock ** 2));
  const a = rad(P.flare);
  const pole = norm(rot([Math.sin(a), -0.25, Math.cos(a)]));
  const barAt = (t) => [g, lerp(yTop, yBot, t), lerp(zLock, zt, Math.pow(t, 0.7))];
  let eE = e;
  if (floor) {
    // 上臂碰地：肘關節中心離地約 4.5 cm；整個行程縮到碰地那一點
    const elbY = (t) => ik2(S, barAt(t), BODY.Lu, BODY.Lf, pole).mid[1];
    const eStop = elbY(1) >= 0.045 ? 1 : bisect((t) => 0.045 - elbY(t), 0, 1);
    eE = e * eStop;
  }
  const [, y, z] = barAt(eE);
  armChain(pose, S, [g, y, z], pole);
  pose.bar = [0, y, z];
  // 腿：靜態
  const toe = [0, 0, 1];
  if (floor) {
    // 屈膝、腳掌平貼地面
    const hip = add(tf.Pc, [BODY.hipHalf, 0, 0]);
    legChain(pose, [0.2, BODY.ankleH, hip[2] + 0.56], toe, hip);
    pose.R.knee = ik2(hip, pose.R.ankle, BODY.Lt, BODY.Ls, [0, 1, 0]).mid;
    pose.floor = true;
  } else {
    legChain(pose, [0.25, BODY.ankleH, 1.0], toe, add(tf.Pc, [BODY.hipHalf, 0, 0]));
    const leg = ik2(pose.R.hip, pose.R.ankle, BODY.Lt, BODY.Ls, [0, 1, 0.3]);
    pose.R.knee = leg.mid;
    pose.R.toe = [0.27, 0.02, 1.17]; pose.R.heel = [0.25, 0.02, 0.95];
    pose.bench = { incline: inc, Pc: tf.Pc, u, f: tf.f };
  }
  pose.barW = BAR_RATIO.bench;
  const fore = sub(pose.R.hand, pose.R.elbow);
  const tilt = deg(Math.acos(clamp(fore[1] / len(fore), -1, 1)));
  if (e > 0.6 && tilt > 28) pose.warn.push('前臂偏離垂直 ' + Math.round(tilt) + '°');
  return pose;
}

// ---------- 臀推／臀橋：上背靠在支撐上（第二個接觸點）----------
// 上背接觸點：骨盆中心沿軀幹 0.38 m（肩胛骨下角）、背面離軀幹軸 9 cm
const HT = { sc: 0.38, tb: 0.09, bench: 0.42, w: 0.16 };
function hipThrustPose(P, e) {
  const floor = P.surface === 'floor';
  const hb = floor ? 0 : HT.bench;
  const C = [0, hb, 0];
  const w = HT.w, tau = rad(10);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  // 平面有效長度（扣掉髖寬與站距的左右差）
  const kx = lerp(w, BODY.hipHalf, BODY.Ls / (BODY.Ls + BODY.Lt));
  const Ls = Math.sqrt(BODY.Ls ** 2 - (w - kx) ** 2), Lt = Math.sqrt(BODY.Lt ** 2 - (kx - BODY.hipHalf) ** 2);
  // psi：軀幹傾角（0 = 水平；正 = 骨盆低於肩膀）。軀幹以背部接觸點為支點轉動
  const frame = (psi) => {
    const u = [0, Math.sin(psi), -Math.cos(psi)];
    const tf0 = trunkFrame([0, 0, 0], u);
    const Pc = add(sub(C, mul(u, HT.sc)), mul(tf0.f, HT.tb));
    return trunkFrame(Pc, u);
  };
  // 頂點：大腿相對軀幹伸展 lockout、膝屈曲 kneeTop，腳踩到地面 → 解出 psi
  const x = rad(P.lockout), kf = rad(P.kneeTop);
  const topAnkle = (psi) => {
    const tf = frame(psi);
    const hip = [BODY.hipHalf, tf.Pc[1], tf.Pc[2]];
    const tt = -psi - x, ts = tt - kf;
    const knee = [kx, hip[1] + Lt * Math.sin(tt), hip[2] + Lt * Math.cos(tt)];
    return [w, knee[1] + Ls * Math.sin(ts), knee[2] + Ls * Math.cos(ts)];
  };
  const psiTop = bisect((psi) => BODY.ankleH - topAnkle(psi)[1], rad(-50), rad(50));
  const A = topAnkle(psiTop);
  A[1] = BODY.ankleH;
  // 臀部最低點（骨盆後下緣）不能低於地面；標準槓片半徑 0.225 m，槓中心不能低於 0.225 m
  const PLATE_R = 0.225;
  const buttY = (psi) => { const tf = frame(psi); return add(add(tf.Pc, mul(tf.f, -0.1)), mul(tf.u, -0.06))[1]; };
  const barYOf = (psi) => { const tf = frame(psi); return add(add(tf.Pc, mul(tf.f, 0.16)), mul(tf.u, -0.03))[1]; };
  let psiBot = psiTop + rad(lerp(25, 55, P.depth));
  let hitFloor = false, hitPlates = false;
  if (buttY(psiBot) < 0.03) { psiBot = bisect((psi) => 0.03 - buttY(psi), psiTop, psiBot); hitFloor = true; }
  if (barYOf(psiBot) < PLATE_R) {
    psiBot = barYOf(psiTop) <= PLATE_R ? psiTop : bisect((psi) => PLATE_R - barYOf(psi), psiTop, psiBot);
    hitPlates = true;
  }
  const psi = lerp(psiTop, psiBot, e);
  const tf = frame(psi);
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = psi;
  const hip = [BODY.hipHalf, tf.Pc[1], tf.Pc[2]];
  const leg = ik2(hip, A, BODY.Lt, BODY.Ls, [0, 1, 0.4]);
  if (!leg.ok) { pose.ok = false; pose.conflict = '腳的位置太遠，腿伸直也碰不到'; }
  legChain(pose, A, toe, hip);
  pose.girdle = { ret: rad(10), elev: rad(-4) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  // 槓壓在髖前方（骨盆前緣、髖屈褶處），手扶著槓
  const front = add(add(tf.Pc, mul(tf.f, 0.115)), mul(tf.u, -0.03));
  pose.barPt = front;
  pose.bar = add(front, mul(tf.f, 0.045));
  armChain(pose, S, [0.3, pose.bar[1], pose.bar[2]], norm(add([1, 0, 0], mul(tf.f, -0.6))));
  pose.barW = BAR_RATIO.hipthrust;
  pose.contact = { p: add(C, [0.12, 0, 0]), n: floor ? [0, 1, 0] : tf.f };
  if (!floor) pose.boxes = [{ c: [0, hb / 2, -0.24], s: [0.42, hb, 0.5] }];
  // 臀橋：軀幹往頭端下斜，頭要點頭才能貼地（約讓頭回到水平再多收下巴 10°）
  if (floor) pose.neckFlex = Math.max(0, -psi) + rad(10);
  if (hitPlates && e > 0.9) pose.warn.push('槓片碰到地面，行程已到底');
  else if (hitFloor && !floor && e > 0.9) pose.warn.push('臀部碰到地面，行程已到底');
  return pose;
}

function barOnPelvisLoads(pose, P, W, out) {
  // region 'pelvis'：骨盆承受，不計入髖（腿側）也不計入下背（上半身側）的力矩
  out.push({ p: [BODY.hipHalf * 0.5, pose.barPt[1], pose.barPt[2]], F: [0, -(pose.barW * W) / 2, 0], region: 'pelvis' });
}

// 兩個接觸點：上背（椅墊，有摩擦）＋腳底（壓力中心由「用力點」決定）
// 未知數：背部力（2）、腳底力（2）；平衡方程 3 條 → 假設腳底不出水平力（不會往前／往後滑），
// 水平力由背部摩擦承擔；超出摩擦錐（μ = 0.5）時，背部力停在摩擦錐邊緣，其餘由腳底摩擦補
const BACK_MU = 0.5;
function twoContactReactions(pose, P, W, out) {
  const R = pose.R, fy = pose.floorY || 0;
  // 腳跟：壓力中心最遠在踝關節後方 2 cm（腳跟著地面的中心）；前腳掌：腳尖往回 5 cm
  const cz = lerp(R.ankle[2] - 0.02, R.toe[2] - 0.05, P.push ?? 0.3);
  const cop = [R.ankle[0], fy, cz];
  let Fy = 0, Fz = 0, M = 0; // M：繞 x 軸、對壓力中心的力矩
  for (const f of out) {
    Fy += f.F[1]; Fz += f.F[2];
    M += (f.p[1] - cop[1]) * f.F[2] - (f.p[2] - cop[2]) * f.F[1];
  }
  const { p: C, n, mu = BACK_MU, bilateral = false } = pose.contact;
  const ay = C[1] - cop[1], az = C[2] - cop[2];
  // 先試腳底沒有水平力：背部 Bz = -Fz，力矩方程解 By
  let Fb = [0, Math.abs(az) < 1e-6 ? 0 : (M - ay * Fz) / az, -Fz];
  const t = [0, -n[2], n[1]]; // 背部切線方向
  const bn = dot(Fb, n), bt = dot(Fb, t);
  if ((bn < 0 && !bilateral) || Math.abs(bt) > mu * Math.abs(bn) + 1e-9) {
    // 超出摩擦錐：接觸力方向固定在錐邊緣，大小由力矩方程決定（bilateral：導軌可推可拉）
    const d = norm(add(n, mul(t, Math.sign(bt || 1) * Math.sign(bn || 1) * mu)));
    const k = ay * d[2] - az * d[1];
    let N = Math.abs(k) < 1e-6 ? 0 : -M / k;
    if (N < 0 && !bilateral) { pose.warn.push('上背沒有壓在支撐上（重心太靠腳）'); N = 0; }
    Fb = mul(d, N);
  }
  const G = [0, -(Fy + Fb[1]), -(Fz + Fb[2])];
  if (pose.contact.rail && Math.abs(Fb[2]) > 0.06 * W) {
    const pct = Math.round((Math.abs(Fb[2]) / W) * 100);
    pose.warn.push(Fb[2] > 0 ? `身體往後靠在槓上：滑軌往前撐住約 ${pct}% 體重的力` : `身體往前壓槓：滑軌往後擋住約 ${pct}% 體重的力`);
  }
  if (G[1] < 0) pose.warn.push('腳會離地');
  else if (Math.abs(G[2]) > 0.7 * G[1]) pose.warn.push('腳底需要很大摩擦力，容易滑動');
  // 額狀面：地面反作用力通過髖關節（同站姿動作）
  const hip = R.hip;
  G[0] = ((hip[0] - cop[0]) / Math.max(0.3, hip[1] - fy)) * G[1];
  if (P.kneesOut > 0) G[0] -= P.kneesOut * 0.1 * W;
  out.push({ p: C, F: Fb, region: 'trunk' });
  out.push({ p: cop, F: G, region: 'foot' });
  pose.cop = cop;
  pose.lineZ = cop[2];
  pose.support = { N: Fb, G };
}

// ================= 器械與滑輪 =================
// 阻力的種類：自由重量（重力，方向固定）、滑輪（朝向滑輪，大小固定）、導軌（只能沿軌道方向，垂直方向由機器承受）、
// 槓桿／凸輪（繞機器轉軸的力矩隨角度改變）。坐在器械上的動作，椅墊／靠墊承受身體，不算地面反作用力。

// 滑輪：手上的力 = 配重 × 方向（槓中心 → 滑輪）；ext = 外力（站姿時影響壓力中心與腳底摩擦）
function cableLoads(pose, P, W, out) {
  const T = (pose.barW * W) / 2;
  const d = norm(sub(pose.pulley, [0, pose.bar[1], pose.bar[2]]));
  const F = mul(d, T);
  // 雙手握同一根剛體握把：兩手之間可以互推／互拉（左右方向，左右相消），
  // 取讓肩＋肘關節力矩平方和最小的那個橫向力（上限為拉力的一半）
  let ab = 0, bb = 0;
  for (const J of [pose.R.shoulder, pose.R.elbow]) {
    const r = sub(pose.R.hand, J), a = cross(r, F), b = cross(r, [1, 0, 0]);
    ab += dot(a, b); bb += dot(b, b);
  }
  F[0] += clamp(-ab / (bb || 1), -0.5 * T, 0.5 * T);
  out.push({ p: pose.R.hand, F, region: 'fore', ext: true });
  // 視覺力線畫在鋼索線上（x = 0，通過握把中心）；力臂分析只看矢狀面 yz，與手位置一致
  pose.forceLine = { p: pose.bar, d };
}
// 機器沿固定方向推回來（胸推機、腿推機）：pose.push = { p, d, region, k }
function pushLoads(pose, P, W, out) {
  const { p, d, region } = pose.push;
  const F = (pose.barW * W * (pose.push.k ?? 1)) / 2;
  out.push({ p, F: mul(d, -F), region, ext: true });
  pose.forceLine = { p, d };
}
// 槓桿＋凸輪：繞關節的阻力力矩 τ(角度)，由墊子垂直壓在肢段上（pose.pad = { p, dir, arm, tau, region }）
function padLoads(pose, P, W, out) {
  const { p, dir, arm, tau, region } = pose.pad;
  out.push({ p, F: mul(dir, (tau * W) / arm), region });
  pose.forceLine = { p, d: dir };
}
// 凸輪的阻力曲線：x = 0（拉長端）→ 1（收縮端）；gravity：槓桿掛配重、沒有凸輪（力矩 ∝ 槓桿的水平分量）
function camFactor(cam, x, horiz) {
  if (cam === 'gravity') return horiz;
  if (cam === 'asc') return lerp(0.6, 1.2, x);
  if (cam === 'desc') return lerp(1.2, 0.6, x);
  return 0.9;
}
const box = (c, s, rx = 0, mat = 'pad') => ({ c, s, rx, mat });
// 沿方向 d（矢狀面）的長方體：局部 y 軸轉到 d
const boxAlong = (c, d, s, mat) => box(c, s, Math.atan2(d[2], d[1]), mat);
// 手扶握把（坐姿器械）
function restHands(pose, S, H) {
  armChain(pose, S, H, norm([0.6, -1, -0.3]));
}

// ---------- 史密斯深蹲 ----------
// 槓在垂直滑軌上：槓的前後位置固定，重心不必在腳掌正上方；多出來的前後力由滑軌承受
function smithPose(P, e) {
  const w = 0.16, tau = rad(10);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const railZ = 0;
  const A = [w, BODY.ankleH, railZ - 0.07 + P.feetFwd];
  const kap = rad(lerp(4, lerp(70, 125, P.depth), e));
  const phi = rad(lerp(3, P.torso, e));
  const u = [0, Math.cos(phi), Math.sin(phi)];
  const legs = fixedKneeLegs(A, w, kap);
  const Lb = 0.53, ob = 0.05;
  const build = (th) => {
    const { knee, hip } = legs(th);
    const tf = trunkFrame([0, hip[1], hip[2]], u);
    return { knee, hip, tf, bar: add(add(tf.Pc, mul(u, Lb)), mul(tf.f, -ob)) };
  };
  const th = bisect((t) => build(t).bar[2] - railZ, rad(-45), rad(60));
  const r = build(th);
  const pose = { R: {}, warn: [], ok: true };
  if (Math.abs(r.bar[2] - railZ) > 0.01) { pose.ok = false; pose.conflict = '這個軀幹角度和腳的位置，槓無法停在滑軌上'; }
  Object.assign(pose, r.tf);
  pose.phi = phi;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  pose.girdle = { ret: rad(15), elev: 0 };
  const S = toWorld(r.tf, shoulderLocal(pose.girdle));
  armChainBent(pose, S, [0.34, r.bar[1], r.bar[2]], norm(add(mul(r.tf.f, -1), [0, -1, 0])), SQ_WRIST.high, [0, 1, 0]);
  pose.bar = r.bar;
  pose.barW = BAR_RATIO.smith;
  pose.barOnBack = true;
  pose.contact = { p: [BODY.hipHalf * 0.5, r.bar[1], r.bar[2]], n: [0, 0, 1], mu: 0, bilateral: true, rail: true };
  // 標準槓穿過兩側垂直滑軌（x = ±0.70），外側掛標準槓片（x = ±0.78、±0.84）
  pose.boxes = [
    ...[-1, 1].flatMap((sx) => [
      box([sx * 0.7, 1.1, railZ], [0.045, 2.2, 0.045], 0, 'glass'),
      box([sx * 0.7, r.bar[1], railZ], [0.075, 0.14, 0.075], 0, 'frame'), // 滑套軸承
      box([sx * 0.7, 0.025, railZ], [0.09, 0.05, 0.75], 0, 'frame'), // 底座腳
    ]),
    box([0, 2.2, railZ], [1.46, 0.055, 0.055], 0, 'glass'), // 頂部橫樑
  ];
  const shin = deg(th);
  if (shin < -12) pose.warn.push('小腿往後傾 ' + Math.round(-shin) + '°：腳放得很前面，膝關節剪力方向改變');
  return pose;
}

// ---------- 45° 腿推機 ----------
const LP = { a: rad(45), hipY: 0.42 };
function legPressPose(P, e) {
  const a = LP.a, d = [0, Math.sin(a), Math.cos(a)], t = [0, Math.cos(a), -Math.sin(a)];
  const recl = rad(P.seat);
  const u = [0, Math.cos(recl), -Math.sin(recl)];
  const tf = trunkFrame([0, LP.hipY, 0], u);
  const hip = [BODY.hipHalf, LP.hipY, 0];
  const w = lerp(0.12, 0.3, P.stance);
  const off = lerp(-0.06, 0.24, P.footHigh);
  const at = (s) => { const Q = add(add([w, hip[1], hip[2]], mul(d, s)), mul(t, off)); return { Q, A: sub(Q, mul(d, BODY.ankleH)) }; };
  const Dk = (kf) => Math.sqrt(BODY.Lt ** 2 + BODY.Ls ** 2 + 2 * BODY.Lt * BODY.Ls * Math.cos(kf));
  const kf = rad(lerp(10, lerp(75, 125, P.depth), e));
  const s = bisect((x) => len(sub(at(x).A, hip)) - Dk(kf), 0.05, 1.3);
  const { Q, A } = at(s);
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = -recl;
  pose.R.hip = hip; pose.R.ankle = A;
  const leg = ik2(hip, A, BODY.Lt, BODY.Ls, [0, 0.7, -0.7]);
  pose.R.knee = leg.mid;
  if (!leg.ok) { pose.ok = false; pose.conflict = '腳踩的位置太近或太遠'; }
  pose.toeDir = t; pose.footUp = neg(d); pose.hinge = [1, 0, 0];
  pose.R.heel = add(Q, mul(t, -0.06)); pose.R.toe = add(Q, mul(t, 0.19));
  pose.girdle = { ret: rad(5), elev: rad(-3) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  const gripPt = [0.29, hip[1] - 0.02, hip[2] + 0.12];
  restHands(pose, S, gripPt);
  pose.R.grip = gripPt;
  pose.bar = [0, hip[1], hip[2]];
  pose.barStyle = 'none';
  pose.barW = BAR_RATIO.legpress;
  // 腳底壓力中心沿踏板：腳跟 ↔ 前腳掌；滑台只能沿軌道方向出力（重量 × sin 45°）
  pose.push = { p: add(Q, mul(t, lerp(-0.03, 0.14, P.push))), d, region: 'foot', k: Math.sin(a) };
  pose.armJoints = ['hip', 'knee', 'ankle'];
  // 椅背與座墊、底座機架、兩側握把、45° 雙導軌與滑台（導軌直接穿過滑台軸套）
  const backC = add(add(tf.Pc, mul(u, 0.34)), mul(tf.f, -0.13));
  const seatTopY = LP.hipY - 0.08;
  const plateC = add([0, Q[1], Q[2]], mul(d, 0.024));
  // 導軌中心線：與滑台（踏板中段後方）同軸，從接近地面一路斜上 45° 到前立柱頂端
  const sledCenterT = dot(add([0, hip[1], hip[2]], mul(t, 0.09)), t);
  const railLineAt = (sd) => add(mul(d, sd), mul(t, sledCenterT));
  const sMin = (0.07 - sledCenterT * t[1]) / d[1];
  const sMax = Math.max(sMin + 1.85, dot(plateC, d) + 0.45);
  const railMid = railLineAt((sMin + sMax) / 2);
  const railLen = sMax - sMin;
  const frontTop = railLineAt(sMax - 0.1);
  const sledS = dot(plateC, d) + 0.12;
  const sledRailPt = railLineAt(sledS);
  // 椅背支撐立柱：頂端貼齊斜板背面下緣，不穿透椅背
  const bpZ = backC[2] - 0.05;
  const bpH = Math.max(0.08, backC[1] + (-0.035 - (bpZ - 0.045 - backC[2]) * tf.f[2]) / Math.max(0.25, tf.f[1]));
  pose.boxes = [
    // 座墊與椅背（下緣相接）
    box([0, seatTopY - 0.04, 0.04], [0.46, 0.08, 0.42]),
    boxAlong(backC, u, [0.46, 0.78, 0.07]),
    // 座椅與機台底座支架（落地）
    box([0, (seatTopY - 0.08) / 2, 0.04], [0.28, seatTopY - 0.08, 0.28], 0, 'frame'),
    box([0, bpH / 2, bpZ], [0.14, bpH, 0.09], 0, 'frame'),
    box([0, 0.025, (bpZ + frontTop[2]) / 2], [0.88, 0.05, Math.abs(frontTop[2] - bpZ) + 0.2], 0, 'frame'),
    // 兩側握把＋支架（手握在橫桿上）
    ...[-1, 1].flatMap((sx) => [
      box([sx * 0.29, gripPt[1], gripPt[2]], [0.12, 0.032, 0.032], 0, 'frame'),
      box([sx * 0.25, (gripPt[1] + 0.05) / 2, gripPt[2]], [0.03, gripPt[1] - 0.05, 0.03], 0, 'frame'),
    ]),
    // 45° 雙側導軌、前立柱與滑台軸套（精準套在導軌上）
    ...[-1, 1].flatMap((sx) => [
      boxAlong([sx * 0.41, railMid[1], railMid[2]], d, [0.045, railLen, 0.045], 'glass'),
      box([sx * 0.41, frontTop[1] / 2, frontTop[2]], [0.055, frontTop[1], 0.055], 0, 'glass'),
      boxAlong([sx * 0.41, sledRailPt[1], sledRailPt[2]], d, [0.075, 0.32, 0.075], 'frame'), // 滑台軸套
      boxAlong([sx * 0.36, (plateC[1] + sledRailPt[1]) / 2, (plateC[2] + sledRailPt[2]) / 2], d, [0.04, 0.14, 0.06], 'frame'), // 踏板→軸套連桿
    ]),
    box([0, frontTop[1], frontTop[2]], [0.86, 0.055, 0.055], 0, 'glass'),
    // 踏板（近面留 6 mm 淨空，避免腳趾穿入）與滑台橫樑
    boxAlong(plateC, d, [0.74, 0.036, 0.56], 'frame'),
    boxAlong(sledRailPt, d, [0.84, 0.06, 0.08], 'frame'),
  ];
  return pose;
}

// ---------- 坐姿器械共用：骨盆在椅墊上、軀幹角 lean（正 = 前傾、負 = 後仰），腳踩地 ----------
function seatedBase(lean, seatY = 0.47, ankleZ = 0.5) {
  const u = [0, Math.cos(lean), Math.sin(lean)];
  const tf = trunkFrame([0, seatY, 0], u);
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = lean;
  legChain(pose, [0.15, BODY.ankleH, ankleZ], [0, 0, 1], [BODY.hipHalf, seatY, 0]);
  pose.R.knee = ik2(pose.R.hip, pose.R.ankle, BODY.Lt, BODY.Ls, [0, 1, 0.3]).mid;
  return pose;
}

// ---------- 滑輪下拉 ----------
function pulldownPose(P, e) {
  const lean = -rad(P.lean);
  const pose = seatedBase(lean);
  const tf = pose;
  pose.girdle = { ret: rad(lerp(-5, lerp(0, 20, P.scap), e)), elev: rad(lerp(18, lerp(2, -10, P.scap), e)) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  const gx = 0.2 * P.grip, Rl = 0.99 * (BODY.Lu + BODY.Lf), dx = gx - S[0];
  const top = [gx, S[1] + Math.sqrt(Math.max(0.01, Rl * Rl - dx * dx - 0.0025)), S[2] + 0.05];
  const bot = add(add(tf.Pc, mul(tf.u, lerp(0.6, 0.45, P.pullTo))), mul(tf.f, lerp(0.13, 0.17, P.pullTo)));
  bot[0] = gx;
  const bar = lerpV(top, bot, e);
  // 槓經過臉時要在臉前方
  const head = add(tf.SC, mul(tf.u, 0.2));
  if (Math.abs(bar[1] - head[1]) < 0.14) bar[2] = Math.max(bar[2], head[2] + 0.13);
  const pole = norm(add(add(tf.lat, mul(tf.u, -0.4)), mul(tf.f, -0.15)));
  const ok = armChain(pose, S, bar, pole);
  if (!ok && e > 0.15) { pose.ok = false; pose.conflict = '手臂長度無法把槓拉到這個位置'; }
  pose.bar = [0, bar[1], bar[2]];
  pose.barW = BAR_RATIO.pulldown;
  pose.barStyle = { len: 1.25 };
  pose.supinated = P.supin === 'sup';
  pose.pulley = [0, 2.35, top[2]];
  pose.armJoints = ['shoulder', 'elbow', 'lumbar'];
  // 人面向配重塔坐：塔在膝蓋前方，座墊與壓腿墊皆經支架連到底座與塔
  const towerZ = 0.8;
  const boomZ = (top[2] + towerZ) / 2;
  pose.boxes = [
    box([0, 0.4, 0.02], [0.42, 0.08, 0.42]), // 座墊
    box([0, 0.66, 0.34], [0.5, 0.08, 0.12]), // 大腿壓墊
    // 底座、座椅支柱、壓腿墊支撐（垂直落地＋橫桿接到塔）
    box([0, 0.025, 0.4], [0.1, 0.05, 1.05], 0, 'frame'),
    box([0, 0.025, 0.02], [0.52, 0.05, 0.08], 0, 'frame'),
    box([0, 0.025, towerZ], [0.52, 0.05, 0.12], 0, 'frame'),
    box([0, 0.205, 0.02], [0.09, 0.31, 0.09], 0, 'frame'),
    box([0, 0.34, 0.34], [0.05, 0.58, 0.05], 0, 'frame'), // 壓腿墊立柱（位於雙腿之間）
    box([0, 0.66, (0.34 + towerZ) / 2], [0.06, 0.05, towerZ - 0.34], 0, 'frame'), // 水平連桿接到塔
    box([0, 1.2, towerZ], [0.16, 2.4, 0.16], 0, 'glass'), // 配重塔
    box([0, 2.38, boomZ], [0.08, 0.07, Math.abs(towerZ - top[2]) + 0.16], 0, 'glass'), // 頂部滑輪懸臂
  ];
  pose.cables = [[pose.bar, pose.pulley], [pose.pulley, [0, 2.35, towerZ]]];
  if (P.lean > 30) pose.warn.push('後仰 ' + Math.round(P.lean) + '°：拉的方向接近划船，下背參與增加');
  return pose;
}

// ---------- 坐姿滑輪划船 ----------
function cableRowPose(P, e) {
  const lean = rad(lerp(P.leanStart, P.leanEnd, e));
  const seatY = 0.47;
  const u = [0, Math.cos(lean), Math.sin(lean)];
  const tf = trunkFrame([0, seatY, 0], u);
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = lean;
  // 腳踩在前方的踏板上（腳掌朝前、腳尖朝上），膝微彎
  const A = [0.15, 0.32, 0.74];
  pose.R.hip = [BODY.hipHalf, seatY, 0]; pose.R.ankle = A;
  pose.R.knee = ik2(pose.R.hip, A, BODY.Lt, BODY.Ls, [0, 1, 0]).mid;
  pose.toeDir = [0, 1, 0]; pose.footUp = [0, 0, -1]; pose.hinge = [1, 0, 0];
  pose.R.heel = add(A, [0, -0.06, BODY.ankleH]); pose.R.toe = add(A, [0, 0.19, BODY.ankleH]);
  pose.girdle = { ret: rad(lerp(-18, lerp(0, 25, P.scap), e)), elev: rad(lerp(4, -4, e)) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  const v = P.grip === 'v', gx = v ? 0.07 : 0.3;
  pose.pulley = [0, 0.42, 1.0];
  const Rl = 0.997 * (BODY.Lu + BODY.Lf);
  // 起點：手臂伸直、朝滑輪方向；終點：握把碰到腹部
  const dirP = norm([0, pose.pulley[1] - S[1], pose.pulley[2] - S[2]]);
  const reach = add(S, mul(dirP, Math.sqrt(Math.max(0.01, Rl * Rl - (gx - S[0]) ** 2))));
  reach[0] = gx;
  const touch = add(add(tf.Pc, mul(u, lerp(0.2, 0.34, P.pullTo))), mul(tf.f, 0.15));
  touch[0] = gx;
  const bar = lerpV(reach, touch, e);
  const fl = rad(v ? 15 : 55);
  const pole = norm(add(add(mul(tf.f, -Math.cos(fl)), mul(tf.lat, Math.sin(fl))), mul(tf.u, -0.3)));
  const ok = armChain(pose, S, bar, pole);
  if (!ok && e > 0.3) { pose.ok = false; pose.conflict = '手臂長度無法把握把拉到這個位置'; }
  pose.bar = [0, bar[1], bar[2]];
  pose.barW = BAR_RATIO.cablerow;
  pose.barStyle = { len: v ? 0.2 : 0.75 };
  pose.armJoints = ['shoulder', 'elbow', 'lumbar'];
  // 座墊落地支架；腳踏板分左右兩片，中央留 16 cm 通道讓鋼索無阻礙通過
  pose.boxes = [
    box([0, 0.38, 0.05], [0.4, 0.1, 0.6]), // 座墊
    box([0, 0.025, 0.43], [0.12, 0.05, 1.32], 0, 'frame'), // 地面長底座
    box([0, 0.025, -0.15], [0.48, 0.05, 0.08], 0, 'frame'),
    box([0, 0.025, 1.06], [0.48, 0.05, 0.1], 0, 'frame'),
    box([0, 0.19, -0.12], [0.09, 0.28, 0.09], 0, 'frame'), // 座椅後腳
    box([0, 0.19, 0.24], [0.09, 0.28, 0.09], 0, 'frame'), // 座椅前腳
    ...[-1, 1].flatMap((sx) => [
      boxAlong([sx * 0.18, 0.32, 0.84], [0, 0, 1], [0.2, 0.04, 0.36], 'frame'), // 左右腳踏板
      box([sx * 0.18, 0.1, 0.86], [0.05, 0.15, 0.05], 0, 'frame'), // 踏板支撐腳
    ]),
    box([0, 0.075, 0.86], [0.4, 0.05, 0.06], 0, 'frame'), // 踏板橫樑（在鋼索下方）
    box([0, 0.42, 1.01], [0.08, 0.09, 0.09], 0, 'frame'), // 低滑輪座
    box([0, 0.45, 1.08], [0.28, 0.9, 0.12], 0, 'glass'), // 滑輪塔
  ];
  pose.cables = [[pose.bar, pose.pulley]];
  if (deg(lean) < -15) pose.warn.push('收尾後仰 ' + Math.round(-deg(lean)) + '°：用身體甩，下背負擔增加');
  return pose;
}

// ---------- 滑輪三頭下壓（站姿）----------
const PD_PULLEY_Z = 0.58;
function pushdownPose(P, e) {
  const gx = 0.12; // e = 0 伸直、1 手肘彎曲
  const as = rad(P.elbFwd), ef = rad(lerp(8, P.topFlex, e));
  // 滑輪把手往上推：重心要往前移才站得穩。真人是髖往後、軀幹再前傾（不是整個人從腳踝往前倒）：
  // 找出需要多前傾 extra，讓小腿維持接近垂直（前傾約 3°）
  const make = (extra) => standingHands(P, {
    kap: rad(8), lean: rad(P.lean) + extra, girdle: { ret: rad(0), elev: rad(-6) }, barW: 0, copZ: -0.05, // 滑輪往上推手：壓力中心落在腳跟那一側，重心才不必前移太多
    ext: (r) => mul(norm(sub([0, 2.1, PD_PULLEY_Z], [0, r.bar[1], r.bar[2]])), BAR_RATIO.pushdown),
    pole: (tf, r) => sub(r.elbow, r.S),
    barAt: (tf, S) => {
      const ud = add(mul(tf.u, -Math.cos(as)), mul(tf.f, Math.sin(as)));
      const n = add(mul(tf.u, Math.sin(as)), mul(tf.f, Math.cos(as)));
      const E = add(S, mul(ud, BODY.Lu));
      const bar = add(E, mul(add(mul(ud, Math.cos(ef)), mul(n, Math.sin(ef))), BODY.Lf));
      bar[0] = gx;
      return { bar, elbow: E };
    },
  });
  const extra = bisect((x) => rad(3) - make(x).shinTilt, 0, rad(40), 16);
  const pose = make(extra);
  if (deg(extra) > 8) pose.warn.push('滑輪把手往上推：軀幹要再前傾約 ' + Math.round(deg(extra)) + '° 才站得穩（實務上常用前後腳站）');
  // 調整前臂視覺參考軸讓正握旋前角落在自然範圍內，五指包覆直槓
  pose.armPole = norm(add(sub(pose.R.elbow, pose.R.shoulder), [0.35, 0, -0.1]));
  pose.barAxial = false;
  pose.barW = BAR_RATIO.pushdown;
  pose.barStyle = { len: 0.45 };
  pose.pulley = [0, 2.1, PD_PULLEY_Z];
  pose.armJoints = ['shoulder', 'elbow'];
  const colZ = PD_PULLEY_Z + 0.18;
  pose.boxes = [
    box([0, 1.07, colZ], [0.16, 2.14, 0.16], 0, 'glass'), // 滑輪柱
    box([0, 2.12, (PD_PULLEY_Z + colZ) / 2], [0.08, 0.06, colZ - PD_PULLEY_Z + 0.08], 0, 'glass'), // 滑輪懸臂
    box([0, 0.025, colZ], [0.46, 0.05, 0.36], 0, 'frame'), // 底座
  ];
  pose.cables = [[pose.bar, pose.pulley]];
  if (P.elbFwd > 20) pose.warn.push('手肘往前 ' + Math.round(P.elbFwd) + '°：肩關節伸展（背闊肌）開始參與');
  return pose;
}

// ---------- 腿伸機／腿彎舉（槓桿＋凸輪）----------
function kneeMachinePose(P, e, mode) {
  const lying = mode === 'curl' && P.posture === 'lying';
  const pose = { R: {}, warn: [], ok: true };
  let tf, thighDir;
  if (lying) {
    // 俯臥：頭朝 +z、臉朝下，大腿往 -z 水平
    tf = trunkFrame([0, 0.62, 0], [0, 0, 1]);
    thighDir = [0, -0.05, -1];
  } else {
    tf = trunkFrame([0, 0.55, 0], [0, Math.cos(rad(-15)), Math.sin(rad(-15))]);
    thighDir = [0, 0, 1];
  }
  Object.assign(pose, tf);
  pose.phi = 0;
  thighDir = norm(thighDir);
  const hip = [BODY.hipHalf, tf.Pc[1], tf.Pc[2]];
  const knee = add(add(hip, mul(thighDir, BODY.Lt * 0.995)), [0.03, 0, 0]);
  const fT = norm(cross(thighDir, [1, 0, 0])); // 大腿前方
  const kMax = rad(lerp(70, 115, P.depth)), kMin = rad(8);
  // ext：e = 0 伸直、1 彎曲；curl：e = 0 彎曲（收縮）、1 伸直
  const kf = mode === 'ext' ? lerp(kMin, kMax, e) : lerp(kMax, kMin, e);
  const sd = norm(add(mul(thighDir, Math.cos(kf)), mul(fT, -Math.sin(kf))));
  const A = add(knee, mul(sd, BODY.Ls));
  pose.R.hip = hip; pose.R.knee = knee; pose.R.ankle = A;
  pose.toeDir = norm(add(mul(fT, Math.cos(kf)), mul(thighDir, Math.sin(kf))));
  pose.footUp = neg(sd); pose.hinge = [1, 0, 0];
  pose.R.heel = add(A, mul(pose.toeDir, -0.06)); pose.R.toe = add(A, mul(pose.toeDir, 0.19));
  pose.girdle = { ret: rad(5), elev: rad(-3) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  const gripPt = lying ? [0.27, 0.35, 0.72] : [0.28, 0.48, 0.15];
  if (lying) armChain(pose, S, gripPt, norm([0.8, -0.4, -0.5]));
  else restHands(pose, S, gripPt);
  pose.R.grip = gripPt;
  pose.bar = [0, hip[1], hip[2]];
  pose.barStyle = 'none';
  pose.barW = mode === 'ext' ? BAR_RATIO.legext : BAR_RATIO.legcurl;
  // 墊子在小腿前（ext）或後（curl），阻力把小腿往彎曲（ext）／伸直（curl）的方向推
  const flexDir = norm(add(mul(thighDir, -Math.sin(kf)), mul(fT, -Math.cos(kf))));
  const arm = lerp(0.6, 0.95, P.padPos) * BODY.Ls;
  const x = mode === 'ext' ? (kMax - kf) / (kMax - kMin) : (kf - kMin) / (kMax - kMin); // 0 拉長端 → 1 收縮端
  const horiz = Math.hypot(sd[0], sd[2]);
  const tau = (0.3 * pose.barW * camFactor(P.cam, x, horiz)) / 2; // × 體重（N·m／N）
  const push = mode === 'ext' ? flexDir : neg(flexDir);
  const p = add(add(knee, mul(sd, arm)), mul(push, -0.05));
  pose.pad = { p, dir: push, arm, tau, region: 'shank' };
  pose.armJoints = ['knee'];
  // 視覺滾輪墊：伸直時與脛骨前側保持淨空；槓桿臂放在腿外側（遠側 x = -0.27）且精準連接轉軸與滾輪墊
  const padOff = mode === 'ext' ? -0.055 : -0.04;
  const padC = add([0, p[1], p[2]], mul(push, padOff));
  const armX = -0.27;
  const pivPt = [armX, knee[1], knee[2]];
  const padEnd = [armX, padC[1], padC[2]];
  const leverVec = sub(padEnd, pivPt);
  const leverBox = boxAlong(lerpV(pivPt, padEnd, 0.5), norm(leverVec), [0.04, len(leverVec), 0.04], 'frame');
  const rollerBox = boxAlong([-0.02, padC[1], padC[2]], sd, [0.54, 0.075, 0.075], 'frame');
  const pivPost = box([armX, knee[1] / 2, knee[2]], [0.05, knee[1], 0.05], 0, 'frame');
  if (lying) {
    pose.boxes = [
      box([0, 0.5, 0.15], [0.42, 0.12, 1.1]), // 臥墊
      // 底座與前後支架（落地）
      box([0, 0.025, 0.15], [0.62, 0.05, 1.18], 0, 'frame'),
      box([0, 0.245, -0.28], [0.34, 0.39, 0.07], 0, 'frame'),
      box([0, 0.245, 0.62], [0.34, 0.39, 0.07], 0, 'frame'),
      // 前端兩側握把＋支架
      ...[-1, 1].flatMap((sx) => [
        box([sx * 0.27, gripPt[1], gripPt[2]], [0.12, 0.03, 0.03], 0, 'frame'),
        box([sx * 0.22, gripPt[1], (0.62 + gripPt[2]) / 2], [0.03, 0.03, gripPt[2] - 0.62 + 0.04], 0, 'frame'),
      ]),
      pivPost, leverBox, rollerBox,
    ];
  } else {
    const backC = add(add(tf.Pc, mul(tf.u, 0.31)), mul(tf.f, -0.13));
    const backPostTop = add(add(tf.Pc, mul(tf.u, 0.25)), mul(tf.f, -0.175));
    pose.boxes = [
      box([0, 0.43, 0.2], [0.45, 0.1, 0.5]), // 座墊
      boxAlong(backC, tf.u, [0.45, 0.72, 0.07]), // 椅背（下緣接座墊）
      // 底座、座椅與椅背支柱（落地，底座薄片不碰腳尖）
      box([0, 0.015, 0.12], [0.62, 0.03, 0.84], 0, 'frame'),
      box([0, 0.205, 0.2], [0.14, 0.35, 0.24], 0, 'frame'),
      box([0, backPostTop[1] / 2, backPostTop[2]], [0.1, backPostTop[1], 0.07], 0, 'frame'),
      // 兩側握把＋支架（手握在上面）
      ...[-1, 1].flatMap((sx) => [
        box([sx * 0.28, gripPt[1], gripPt[2]], [0.11, 0.03, 0.03], 0, 'frame'),
        box([sx * 0.24, (gripPt[1] + 0.38) / 2, gripPt[2]], [0.03, gripPt[1] - 0.38 + 0.04, 0.03], 0, 'frame'),
      ]),
      // 坐姿腿彎舉：大腿上方固定壓墊＋遠側支撐桿
      ...(mode === 'curl' ? [
        box([0, 0.69, 0.28], [0.48, 0.08, 0.1]),
        box([armX, 0.56, 0.28], [0.04, 0.28, 0.04], 0, 'frame'),
        box([armX, 0.42, (0.28 + knee[2]) / 2], [0.04, 0.04, Math.abs(knee[2] - 0.28) + 0.04], 0, 'frame'),
      ] : []),
      pivPost, leverBox, rollerBox,
    ];
  }
  return pose;
}
function legExtPose(P, e) { return kneeMachinePose(P, e, 'ext'); }
function legCurlPose(P, e) { return kneeMachinePose(P, e, 'curl'); }

// ---------- 坐姿胸推機 ----------
// 用臥推的手臂幾何（軀幹座標內相同），整個身體轉 90° 成坐姿；機器沿推的方向推回來
function chestPressPose(P, e) {
  const bP = { ...P, incline: 0, surface: 'bench', bend: 0, dom: 0.5 };
  const r = (v) => [v[0], -v[2], v[1]]; // 繞 x 轉 90°：躺 → 坐
  // 器械底部有機械止擋：手肘不往後穿透椅背前緣
  const CP_BACK_FRONT_Z = -0.085; // 椅背前緣（肩關節後方約 8.5 cm）
  const elbZ = (t) => {
    const b = benchPose(bP, t);
    return r(b.R.elbow)[2] + (0 - r(b.Pc)[2]);
  };
  const eStop = elbZ(1) >= CP_BACK_FRONT_Z ? 1 : bisect((t) => CP_BACK_FRONT_Z - elbZ(t), 0, 1, 20);
  const bp = benchPose(bP, e * eStop);
  const T = sub([0, 0.55, 0], r(bp.Pc));
  const pt = (v) => add(r(v), T);
  const pose = { R: {}, warn: bp.warn.map((w) => w.replace('前臂偏離垂直', '前臂偏離推的方向')), ok: bp.ok, conflict: bp.conflict };
  for (const k of ['shoulder', 'elbow', 'hand']) pose.R[k] = pt(bp.R[k]);
  Object.assign(pose, trunkFrame(pt(bp.Pc), r(bp.u)));
  pose.phi = 0;
  pose.girdle = bp.girdle;
  pose.armPole = r(bp.armPole);
  pose.bar = pt(bp.bar);
  legChain(pose, [0.15, BODY.ankleH, 0.5], [0, 0, 1], [BODY.hipHalf, pose.Pc[1], pose.Pc[2]]);
  pose.R.knee = ik2(pose.R.hip, pose.R.ankle, BODY.Lt, BODY.Ls, [0, 1, 0.3]).mid;
  pose.barW = BAR_RATIO.chestpress;
  const armX = 0.2 * P.grip + 0.08;
  pose.barStyle = { len: 2 * armX + 0.04 };
  pose.push = { p: pose.R.hand, d: pose.f, region: 'fore' };
  pose.armJoints = ['shoulder', 'elbow'];
  // 座椅、椅背（相接落地）、後方機架轉軸與兩側機械臂連到握把
  const backC = add(add(pose.Pc, mul(pose.u, 0.34)), mul(pose.f, -0.155));
  const colZ = -0.36;
  const pivY = 1.72, pivZ = -0.18;
  const barY = pose.bar[1], barZ = pose.bar[2];
  const armVec = [0, barY - pivY, barZ - pivZ];
  const armMid = [0, (pivY + barY) / 2, (pivZ + barZ) / 2];
  pose.boxes = [
    box([0, 0.43, 0.1], [0.44, 0.1, 0.44]), // 座墊
    boxAlong(backC, pose.u, [0.34, 0.84, 0.07]), // 椅背（寬 34 cm，下緣接座墊）
    // 底座與座椅／椅背支架（落地）
    box([0, 0.025, -0.08], [0.56, 0.05, 0.72], 0, 'frame'),
    box([0, 0.215, 0.1], [0.12, 0.33, 0.18], 0, 'frame'),
    box([0, 0.36, -0.18], [0.1, 0.68, 0.07], 0, 'frame'),
    // 後方立柱＋上方轉軸懸臂（半透明不擋側面視線）
    box([0, 0.9, colZ], [0.14, 1.8, 0.14], 0, 'glass'),
    box([0, pivY + 0.04, (colZ + pivZ) / 2], [0.1, 0.07, pivZ - colZ + 0.1], 0, 'glass'),
    box([0, pivY, pivZ], [2 * armX + 0.08, 0.06, 0.06], 0, 'frame'), // 頂部轉軸橫桿
    // 兩側機械臂：從上方轉軸連到握把兩端
    ...[-1, 1].map((sx) => boxAlong([sx * armX, armMid[1], armMid[2]], norm(armVec), [0.04, len(armVec), 0.04], 'frame')),
  ];
  return pose;
}

export function solvePose(lift, P, e) {
  const pose = LIFTS[lift].pose(P, e);
  pose.lift = lift;
  return pose;
}

// 檢查整個軌跡是否成立
export function validate(lift, P) {
  for (let i = 0; i <= 12; i++) {
    const p = solvePose(lift, P, i / 12);
    if (!p.ok) return p.conflict || '姿勢不成立';
  }
  return null;
}

// ---------- 力學分析 ----------
// 外力：各動作的 loads() 只負責器材（槓、接觸力），身體重量與地面反作用力共用
function barOnTrunkLoads(pose, P, W, out) {
  out.push({ p: [BODY.hipHalf * 0.5, pose.bar[1], pose.bar[2]], F: [0, -(pose.barW * W) / 2, 0], region: 'trunk' });
}

function barInHandsLoads(pose, P, W, out) {
  const R = pose.R, barHalf = (pose.barW * W) / 2;
  out.push({ p: R.hand, F: [0, -barHalf, 0], region: 'fore' });
  // 槓貼著腿時，腿把槓往前頂住，手臂不必自己撐住往前的角度
  const dz = R.hand[2] - R.shoulder[2], dy = R.shoulder[1] - R.hand[1];
  const touch = clamp(1 - P.barDist / 0.15, 0, 1);
  const Fc = Math.max(0, (dz * barHalf) / Math.max(0.2, dy)) * touch;
  const Fi = Fc + (P.pullIn || 0) * 0.08 * W;
  out.push({ p: R.hand, F: [0, 0, Fi], region: 'fore' });
  // 槓壓在腿上的反作用力
  const by = pose.bar[1];
  let pt, region;
  if (by <= R.knee[1]) { const t = (by - R.ankle[1]) / (R.knee[1] - R.ankle[1]); pt = lerpV(R.ankle, R.knee, clamp(t, 0, 1)); region = 'shank'; }
  else { const t = (by - R.knee[1]) / (R.hip[1] - R.knee[1]); pt = lerpV(R.knee, R.hip, clamp(t, 0, 1)); region = 'thigh'; }
  out.push({ p: pt, F: [0, 0, -Fi], region });
}

function handBarLoads(pose, P, W, out) {
  const F = [0, -(pose.barW * W) / 2, 0];
  // 垂手握槓：槓是剛體，兩手之間可以互推／互拉，讓手上的合力在額狀面指向肩膀（三角肌不必撐住手臂外展）
  if (pose.barAxial) {
    const R = pose.R, dy = R.shoulder[1] - R.hand[1];
    if (dy > 0.2) F[0] = clamp((-F[1] * (R.hand[0] - R.shoulder[0])) / dy, -0.3 * -F[1], 0.3 * -F[1]);
  }
  out.push({ p: pose.R.hand, F, region: 'fore' });
}

function benchLoads(pose, P, W, out) {
  out.push({ p: pose.R.hand, F: [0, -(pose.barW * W) / 2, 0], region: 'fore' });
  if (P.pullApart > 0) out.push({ p: pose.R.hand, F: [-P.pullApart * 0.12 * W, 0, 0], region: 'fore' });
}

function forcesOf(pose, P, lift) {
  const L = LIFTS[lift];
  const W = BODY.mass * G;
  const R = pose.R, out = [];
  const wt = (p, frac, region) => out.push({ p, F: [0, -frac * W, 0], region });
  // 半身（右側）；seated：坐在器械上，身體重量照算，但由椅墊／靠墊支撐（不算地面反作用力）
  if (L.ground || L.seated) {
    wt(add(R.ankle, mul(pose.toeDir, 0.06)), MF.foot, 'foot');
    wt(lerpV(R.knee, R.ankle, 0.433), MF.shank, 'shank');
    wt(lerpV(R.hip, R.knee, 0.433), MF.thigh, 'thigh');
    wt(add(pose.Pc, mul(pose.u, 0.3)), MF.trunk / 2, 'trunk');
  }
  wt(lerpV(R.shoulder, R.elbow, 0.436), MF.upper, 'upper');
  wt(lerpV(R.elbow, R.hand, 0.55), MF.fore, 'fore');
  L.loads(pose, P, W, out);
  if (L.reactions) L.reactions(pose, P, W, out);
  else if (L.ground) {
    // 地面反作用力：力矩平衡決定壓力中心；只有重力時 = 系統重心正下方
    // ext：器械／滑輪施加的外力（可能有水平分量，例如滑輪往前拉），水平分量由腳底摩擦平衡
    const fy = pose.floorY || 0;
    let SFy = 0, Sz = 0, Sy = 0, SFz = 0;
    for (const f of out) {
      if (f.ext || f.F[1] < 0) { SFy += f.F[1]; Sz += f.p[2] * f.F[1]; }
      if (f.ext) { Sy += (f.p[1] - fy) * f.F[2]; SFz += f.F[2]; }
    }
    const m = -SFy;
    const cop = [pose.R.ankle[0], fy, (Sz - Sy) / SFy];
    pose.cop = cop;
    if (cop[2] < R.heel[2] - 0.02) pose.warn.push('重心落在腳跟後方，會往後倒');
    else if (cop[2] > R.toe[2] + 0.02) pose.warn.push('重心落在腳尖前方，會往前倒');
    // 水平分量讓力線在額狀面通過髖關節（雙腳站立時髖外展力矩最小）
    const hip = pose.R.hip;
    const grf = [((hip[0] - cop[0]) / Math.max(0.3, hip[1] - fy)) * m, m, -SFz];
    if (P.kneesOut > 0) grf[0] -= P.kneesOut * 0.1 * W;
    out.push({ p: cop, F: grf, region: 'foot' });
  }
  return out;
}

function musMoment(forces, J, regions) {
  let M = [0, 0, 0];
  for (const f of forces) if (regions.includes(f.region)) M = add(M, cross(sub(f.p, J), f.F));
  return neg(M);
}

function jointAngles(pose) {
  const R = pose.R, q = {};
  const angIn = (v, down, fwd) => Math.atan2(dot(v, fwd), dot(v, down));
  const mu = neg(pose.u);
  if (R.hip && R.knee && R.ankle) {
    const t = sub(R.knee, R.hip), s = sub(R.ankle, R.knee);
    q.hipFlex = angIn(t, mu, pose.f);
    q.hipAbd = Math.asin(clamp(dot(norm(t), pose.lat), -1, 1));
    q.kneeFlex = Math.acos(clamp(dot(norm(t), norm(s)), -1, 1));
    const su = neg(s);
    // footUp：腳底的法線（往踝的方向）；平踩地面時 = 正上方
    q.ankleDorsi = Math.atan2(dot(su, pose.toeDir), pose.footUp ? dot(su, pose.footUp) : su[1]);
  }
  const h = sub(R.elbow, R.shoulder), fo = sub(R.hand, R.elbow);
  q.shFlex = angIn(h, mu, pose.f);
  // 手臂舉過頭且略在軀幹後方時 atan2 會跳到 -180°，展開成 > 180°
  if (q.shFlex < rad(-135)) q.shFlex += 2 * Math.PI;
  // 手臂往側邊舉（額狀面）時，矢狀面投影的屈曲角沒有意義（側平舉過水平會被算成 180°）：
  // 外側分量 > 0.7 起漸漸改用「離開額狀面往前的角度」
  const hn = norm(h), hl = Math.abs(dot(hn, pose.lat));
  // 只在手肘高過肩膀（沿軀幹長軸）時才會跳；臥推手臂外開但在肩膀高度以下，不受影響
  const bl = clamp((hl - 0.7) / 0.25, 0, 1) * clamp(-dot(hn, mu) / 0.15, 0, 1);
  if (bl > 0) q.shFlex = lerp(q.shFlex, Math.atan2(dot(hn, pose.f), Math.hypot(dot(hn, mu), dot(hn, pose.lat))), bl);
  q.shAbd = Math.asin(clamp(dot(norm(h), pose.lat), -1, 1));
  q.shElev = Math.acos(clamp(dot(norm(h), mu), -1, 1)); // 上臂與軀幹長軸（往下）的夾角
  // 上臂離軀幹長軸 30° 以內：水平內收沒有意義；55° 以上：完整（臥推預設在 55° 以上）
  // 舉過頭（接近軀幹長軸往上）同理
  const hp = Math.hypot(dot(h, pose.f), dot(h, pose.lat)) / (len(h) || 1);
  q.haddW = clamp((q.shElev - rad(30)) / rad(25), 0.05, 1) * clamp(hp / 0.5, 0.05, 1);
  q.shHAdd = lerp(DOF_REF.shHAdd, Math.atan2(dot(h, pose.f), dot(h, pose.lat)), q.haddW);
  q.elbFlex = Math.acos(clamp(dot(norm(h), norm(fo)), -1, 1));
  q.dof = {
    hipExt: -(q.hipFlex || 0), hipAbd: q.hipAbd || 0, kneeExt: -(q.kneeFlex || 0), ankPF: -(q.ankleDorsi || 0),
    trunkExt: 0, shFlex: q.shFlex, shHAdd: q.shHAdd, elbExt: -q.elbFlex,
    shAbd: q.shAbd, scRet: pose.girdle?.ret || 0, scElev: pose.girdle?.elev || 0,
  };
  return q;
}

function solveLinear(K, b) {
  const n = b.length, A = K.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = A[r][c] / d;
      for (let k2 = c; k2 <= n; k2++) A[r][k2] -= k * A[c][k2];
    }
  }
  return A.map((r, i) => r[n] / (r[i] || 1e-12));
}

export function analyze(lift, P, e) {
  const pose = solvePose(lift, P, e);
  const forces = forcesOf(pose, P, lift);
  const R = pose.R, L = LIFTS[lift];
  const dofs = L.dofs, has = (d) => dofs.includes(d);
  const dem = {};
  if (has('hipExt')) {
    const Mh = musMoment(forces, R.hip, ['foot', 'shank', 'thigh']);
    dem.hipExt = dot(Mh, norm(cross(neg(pose.u), neg(pose.f))));
    if (has('hipAbd')) dem.hipAbd = dot(Mh, norm(cross(neg(pose.u), pose.lat)));
  }
  // 膝／踝的屈伸軸：預設沿腳尖方向（站姿）；腳不是平踩地面時（腿推機、腿伸機）由 pose.hinge 指定
  const fx = pose.hinge || (pose.toeDir && norm(cross([0, 1, 0], pose.toeDir)));
  if (has('kneeExt')) {
    const Mk = musMoment(forces, R.knee, ['foot', 'shank']);
    dem.kneeExt = dot(Mk, neg(fx)); // 膝蓋沿腳尖方向屈伸
  }
  if (has('ankPF')) {
    const Ma = musMoment(forces, R.ankle, ['foot']);
    dem.ankPF = dot(Ma, pose.hinge || norm(cross(pose.toeDir, [0, -1, 0])));
  }
  if (has('trunkExt')) {
    const L5 = add(pose.Pc, mul(pose.u, 0.05));
    const Mu = musMoment(forces, L5, ['trunk', 'upper', 'fore']);
    dem.trunkExt = dot(Mu, norm(cross(pose.u, neg(pose.f)))); // 肌肉作用在上半身的伸展力矩
  }
  if (has('shFlex')) {
    const Ms = musMoment(forces, R.shoulder, ['upper', 'fore']);
    dem.shFlex = dot(Ms, norm(cross(neg(pose.u), pose.f)));
    if (has('shHAdd')) dem.shHAdd = dot(Ms, norm(cross(pose.lat, pose.f)));
    if (has('shAbd')) dem.shAbd = dot(Ms, pose.f);
  }
  if (has('elbExt')) {
    const Me = musMoment(forces, R.elbow, ['fore']);
    const fx = cross(sub(R.elbow, R.shoulder), sub(R.hand, R.elbow));
    dem.elbExt = len(fx) < 1e-5 ? 0 : dot(Me, neg(norm(fx)));
    // 接近伸直時，把肘往伸直方向壓的力矩由骨性卡榫（鷹嘴）承受，不需要屈肌
    const ef = Math.acos(clamp(dot(norm(sub(R.elbow, R.shoulder)), norm(sub(R.hand, R.elbow))), -1, 1));
    if (dem.elbExt < 0) dem.elbExt *= clamp((deg(ef) - 8) / 17, 0, 1);
  }
  if (has('scRet')) {
    // 手臂的負荷經肩關節傳到肩胛，再由肩胛肌群固定在軀幹上：力矩取在胸鎖關節
    const SCJ = toWorld(pose, GIRDLE.scj);
    const Mg = musMoment(forces, SCJ, ['upper', 'fore']);
    dem.scRet = dot(Mg, pose.u);
    dem.scElev = dot(Mg, pose.f);
  }

  const q = jointAngles(pose);
  const muscles = liftMuscles(lift);
  // 偏好與共同收縮
  const pref = Object.fromEntries(muscles.map((m) => [m.id, 1]));
  for (const p of L.params) {
    if (p.mech !== 'C') continue;
    const v = P[p.key] || 0;
    for (const id of p.pref[0]) if (pref[id] !== undefined) pref[id] *= Math.pow(3, -v);
    for (const id of p.pref[1]) if (pref[id] !== undefined) pref[id] *= Math.pow(3, v);
  }
  const lb = Object.fromEntries(muscles.map((m) => [m.id, 0]));
  if (P.brace && lb.ra !== undefined) lb.ra = 0.3 * P.brace;
  L.lowerBounds?.(P, lb);
  L.adjust?.(P, pref);

  const info = muscles.map((m) => {
    const arms = dofs.map((d) => { const a = m.arms[d]; return typeof a === 'function' ? a(q) : a || 0; });
    let l = 1;
    dofs.forEach((d, j) => { if (arms[j]) l -= (arms[j] / m.Lf) * (q.dof[d] - DOF_REF[d]); });
    // optDofs：不分析力矩、但關節角度仍影響肌肉長度（例如坐姿腿彎舉時髖屈曲拉長膕繩肌）
    for (const d of L.optDofs || []) { let r = m.arms[d]; r = typeof r === 'function' ? r(q) : r || 0; if (r) l -= (r / m.Lf) * ((q.dof[d] ?? DOF_REF[d]) - DOF_REF[d]); }
    const fl = Math.max(0.35, Math.exp(-(((l - 1) / 0.5) ** 2)));
    const pas = l <= 1.15 ? 0 : Math.min(0.8, 0.5 * ((l - 1.15) / 0.45) ** 2);
    const Feff = m.F * fl;
    return { m, arms, l, pas, A: arms.map((r) => r * Feff), F: m.F };
  });
  const b0 = dofs.map((d, j) => (dem[d] || 0) - info.reduce((s, x) => s + x.pas * x.F * x.arms[j], 0));
  const act = Object.fromEntries(info.map((x) => [x.m.id, 0]));
  const fixed = new Set();
  for (let it = 0; it < 80; it++) {
    const free = info.filter((x) => !fixed.has(x.m.id));
    const b = b0.map((v, j) => v - info.filter((x) => fixed.has(x.m.id)).reduce((s, x) => s + act[x.m.id] * x.A[j], 0));
    const n = dofs.length;
    const K = Array.from({ length: n }, () => Array(n).fill(0));
    let tr = 0;
    for (const x of free) {
      const p = pref[x.m.id];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) K[i][j] += p * x.A[i] * x.A[j];
    }
    for (let i = 0; i < n; i++) tr += K[i][i];
    for (let i = 0; i < n; i++) K[i][i] += 1e-7 * tr + 1e-9;
    const lam = solveLinear(K, b);
    const want = (x) => pref[x.m.id] * x.A.reduce((s, v, i) => s + v * lam[i], 0);
    for (const x of free) act[x.m.id] = want(x);
    // 一次只固定最違反下限的一條；收斂後檢查是否有該釋放的
    let worst = null, wv = -1e-9;
    for (const x of free) { const d = act[x.m.id] - lb[x.m.id]; if (d < wv) { wv = d; worst = x; } }
    if (worst) { act[worst.m.id] = lb[worst.m.id]; fixed.add(worst.m.id); continue; }
    let rel = null, rv = 1e-9;
    for (const x of info) if (fixed.has(x.m.id)) { const d = want(x) - lb[x.m.id]; if (d > rv) { rv = d; rel = x; } }
    if (rel) { fixed.delete(rel.m.id); continue; }
    break;
  }
  const mus = {};
  for (const x of info) {
    const a = Math.max(0, act[x.m.id]);
    mus[x.m.id] = { a, p: x.pas, s: Math.min(a, 1.5) + x.pas, l: x.l, len: x.l > 1.12 ? '拉長' : x.l < 0.9 ? '縮短' : '中段' };
  }
  // 關節負擔
  const rom = {};
  if (has('hipExt') && deg(q.hipFlex) > 136) rom.hip = '髖屈曲接近末端';
  if (has('kneeExt') && deg(q.kneeFlex) > 138) rom.knee = '膝屈曲接近末端';
  if (has('ankPF') && deg(q.ankleDorsi) > 36) rom.ankle = '踝背屈接近末端';
  if (has('shHAdd') && deg(q.shHAdd) < -28) rom.shoulder = '肩前側拉伸接近末端';
  if (has('elbExt') && deg(q.elbFlex) > 140) rom.elbow = '肘屈曲接近末端';
  if (has('shAbd') && deg(q.shFlex) > 178) rom.shoulder = '肩屈曲接近末端';
  const joints = {};
  if (has('hipExt')) joints.hip = Math.hypot(dem.hipExt, dem.hipAbd || 0);
  if (has('kneeExt')) joints.knee = Math.abs(dem.kneeExt);
  if (has('ankPF')) joints.ankle = Math.abs(dem.ankPF);
  if (has('trunkExt')) joints.lumbar = Math.abs(dem.trunkExt);
  if (has('shFlex')) joints.shoulder = Math.hypot(dem.shFlex, dem.shHAdd || 0);
  if (has('shAbd')) joints.shoulder = Math.hypot(dem.shFlex, dem.shHAdd || 0, dem.shAbd);
  if (has('elbExt')) joints.elbow = Math.abs(dem.elbExt);
  if (has('scRet')) joints.scap = Math.hypot(dem.scRet, dem.scElev);
  return { pose, dem, q, mus, joints, rom };
}

export function peakAnalysis(lift, P, n = 20) {
  const peak = {}; const jpeak = {};
  for (let i = 0; i <= n; i++) {
    const r = analyze(lift, P, i / n);
    for (const [k, v] of Object.entries(r.mus)) {
      if (!peak[k] || v.s > peak[k].s) peak[k] = { ...v };
    }
    for (const [k, v] of Object.entries(r.joints)) jpeak[k] = Math.max(jpeak[k] || 0, v);
  }
  return { mus: peak, joints: jpeak };
}
