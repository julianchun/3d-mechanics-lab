// 清單預設姿勢的生理合理性驗收；每條肌肉只比較主動活化 a，避免被動張力與顯示截斷掩蓋超載。
import { CATALOG } from '../src/catalog.js';
import { analyze, defaultParams, BODY } from '../src/biomech.js';

// 排名用畫面顯示的 s（主動活化加被動份額）；超載門檻只用未截斷的 a。
// 文獻趨勢見 docs/references.md；同一肌肉的不同動作峰值不等於跨肌肉 EMG 百分比。
// 臀橋已修正為肩線貼地支撐與地板連續反力模型，臀大肌為第一位（高於腰背伸肌）。
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
};

// 規則照常執行；每項已知失敗都要保留目前結果、原因和預計修正方向。
const KNOWN_ISSUES = [
  ...[
    ['pushup', '胸大肌峰值排名第四'], ['pushup-feet', '胸大肌未進前二'], ['pushup-hands', '胸大肌峰值排名第三'],
    ['dips-upright', '胸大肌與三頭肌均未進前二'],
  ].map(([id, current]) => ({
    id, rule: 'rank:top2', kind: '新動作', current,
    cause: '固定手部支撐下，現有肩部三軸力矩與肌肉分配把部分需求分給背闊肌、三角肌及肱三頭；缺少此動作的三維關節力矩驗證',
    fix: '取得伏地挺身／雙槓撐體的同步三維運動學、測力與肌電資料，再核對肩部力矩分解，暫不調 MUSCLES',
  })),
  ...Object.entries({
    pushup: ['trilat'], 'pushup-feet': ['trilat'], 'pushup-hands': ['trilat'],
    dips: ['pecs', 'lat', 'mdelt'], 'dips-upright': ['pecs', 'lat', 'pdelt', 'trilong'],
    pullup: ['lat'], 'pullup-wide': ['pecs', 'lat'], chinup: ['adelt', 'lat', 'bic', 'brach', 'mdelt'],
  }).flatMap(([id, muscles]) => muscles.map((muscle) => ({
    id, rule: `activation:${muscle}`, kind: '新動作', current: `${muscle} 的模型主動活化超過 1`,
    cause: '全身重量由手部支撐，現有肌肉最大力及肩肘力臂估計不足以承受部分姿勢的準靜態力矩；未以自體重量動作測力資料校準',
    fix: '以量測的手部反力與關節力矩驗證姿勢及負荷，再檢討共用肌肉模型，暫不手調常數',
  }))),
  {
    id: 'db-bench-incline', rule: 'rank:first', kind: '新動作', current: '上斜 30° 啞鈴臥推底端三角肌中束（0.74）高於前三角肌（0.57）與胸大肌（0.36）',
    cause: '上斜 30° 下放至較深拉伸端（depth=0.6）時上臂低於肩線且向外展開，重力於肩外展軸（shSide）需求上升，使現有中三角外展分攤於底端超過前三角與胸大肌（類似上斜槓鈴臥推底端 mdelt=0.64）',
    fix: '待取得上斜啞鈴臥推 3D 軌跡與肩部三軸力矩實測資料後再校對深拉伸端軌跡與三角肌分攤，暫不手調參數',
  },
  {
    id: 'db-press', rule: 'rank:top2', kind: '新動作', current: '坐姿啞鈴肩推前兩名為中三角（0.45）與上斜方（0.45），前三角（0.40）居第三',
    cause: '啞鈴於肩胛平面（elbowFwd=30° 前偏，即離矢狀面 60°）兩側下放、不受槓鈴迫使雙手往前繞過下巴，肩外展（shSide≈32 Nm）高於肩屈（shFwd≈23 Nm），且手臂外側承重造成胸鎖關節上提需求（scElev≈56 Nm）偏高',
    fix: '待以 OpenSim 肩帶模型與肩推三軸肌電／運動學資料檢核肩胛平面推舉分攤，暫不手調模型參數',
  },
  {
    id: 'hammer-curl', rule: 'rank:first', kind: '新動作', current: '錘式彎舉前三角肌（0.75）高於肱二頭肌（0.59）與肱肌／肱橈肌（0.51）',
    cause: '沿用既有對握偏好（pref.bic × 1.0）後，二頭肌分擔下降、單關節肱肌／肱橈肌上升，導致二頭肌對抗前臂重力的肩屈貢獻減少、肩前舉穩定集中到前三角肌（與既有反手彎舉 reverse-curl 同源）',
    fix: '待統一校準上臂貼身彎舉的肩前舉穩定模型並拆分肱肌與肱橈肌後再檢核，暫不加特例',
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
    cause: '握把力線沿上臂軸造成外旋需求；新增棘上肌後仍由棘下肌／小圓肌承擔最多，現有模型缺握把接觸偶矩與旋前自由度',
    fix: '取得握把軸向力矩量測並拆分肩袖肌束，再校準外旋分攤',
  },
  {
    id: 'reverse-curl', rule: 'rank:first',
    kind: '既有問題', current: '正握彎舉前三角肌（0.92）高於肱肌／肱橈肌（0.69）與肱二頭肌（0.47）',
    cause: '正握降低肱二頭肌效率後，屈肘肌群對抗前臂重力的肩屈貢獻減少，肩部前舉穩定需求集中到前三角肌；目前肱肌與肱橈肌合併且未單獨校準',
    fix: '核對肱肌／肱橈肌與二頭肌的握法差異，以及上臂貼身時的肩關節穩定模型',
  },
  ...[
    ['pulldown', '胸大肌仍進前四'],
  ].map(([id, current]) => ({
    id, rule: 'rank:notTop4', kind: '本分支退步',
    current: `${current}，main 分支胸大肌未進前四`,
    cause: '背闊肌水平力臂已改用路徑擬合，下壓需求仍由既有肩胛等效力臂分攤；胸大肌在正握下拉仍代償肩胛下壓',
    fix: '以可驗證的肩胛肌束路徑及肩胛下壓力矩量測重建 scElev 力臂',
  })),
  ...[
    ['row', 'lat'],
    ['row-sup', 'lat'],
    ['cable-row-wide', 'lat'],
  ].map(([id, muscle]) => ({
    id, rule: `rank:${muscle}:top4`, kind: '既有問題',
    current: `${muscle} 未進前四`,
    cause: '背闊肌水平力臂修正後，中斜方與背闊肌仍未能同時進前四；Seth 路徑的中斜方等效力臂直接替換又使已通過的划船排名失敗',
    fix: '以 OpenSim 逐點驗證肩胛兩軸力矩與中斜方路徑，再校準功能群能力',
  })),
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
const declaredRules = new Set();
for (const c of CATALOG.filter((entry) => entry.lift)) {
  catalogIds.add(c.id);
  const P = { ...defaultParams(c.lift), ...c.set };
  const peaks = new Map();
  const overload = new Map();
  for (let i = 0; i <= N; i++) {
    const e = i / N;
    for (const [id, mus] of Object.entries(analyze(c.lift, P, e).mus)) {
      if (!Number.isFinite(mus.a) || mus.a > 1.000001) {
        const prior = overload.get(id);
        if (!prior || !Number.isFinite(mus.a) || mus.a > prior.a) overload.set(id, { a: mus.a, e });
      }
      peaks.set(id, Math.max(peaks.get(id) || 0, mus.s));
    }
  }
  const ranked = [...peaks].sort((a, b) => b[1] - a[1]);
  for (const [id, { a, e }] of overload) check(c.id, `activation:${id}`, `e=${e.toFixed(3)} a=${a.toFixed(4)} > 1`);
  const rule = RANKS[c.id];
  if (rule?.first) declaredRules.add(`${c.id}|rank:first`);
  if (rule?.notFirst) declaredRules.add(`${c.id}|rank:notFirst`);
  if (rule?.notTop4) declaredRules.add(`${c.id}|rank:notTop4`);
  if (rule?.allTop3) declaredRules.add(`${c.id}|rank:allTop3`);
  for (const [a, b] of rule?.above || []) declaredRules.add(`${c.id}|rank:${a}>${b}`);
  for (const id of Object.keys(rule?.within || {})) declaredRules.add(`${c.id}|rank:${id}:top${rule.within[id]}`);
  for (const n of [2, 3, 4]) if (rule?.[`top${n}`]) declaredRules.add(`${c.id}|rank:top${n}`);
  if (rule?.first && !rule.first.includes(ranked[0][0])) {
    check(c.id, 'rank:first', `第一名 ${ranked[0][0]}，預期 ${rule.first.join(' 或 ')}`);
  }
  if (rule?.notFirst?.includes(ranked[0][0])) {
    check(c.id, 'rank:notFirst', `第一名不應為 ${ranked[0][0]}`);
  }
  if (rule?.notTop4) {
    const hit = ranked.slice(0, 4).filter(([id]) => rule.notTop4.includes(id)).map(([id, v]) => `${id} ${v.toFixed(2)}`);
    if (hit.length) check(c.id, 'rank:notTop4', `前4名不應含 ${rule.notTop4.join('、')}，目前含 ${hit.join(', ')}`);
  }
  if (rule?.allTop3 && !rule.allTop3.every((id) => ranked.slice(0, 3).some(([muscle]) => muscle === id))) {
    check(c.id, 'rank:allTop3', `前三名 ${ranked.slice(0, 3).map(([id]) => id).join(', ')}，預期同時含 ${rule.allTop3.join('、')}`);
  }
  for (const [a, b] of rule?.above || []) {
    if ((peaks.get(a) || 0) <= (peaks.get(b) || 0)) check(c.id, `rank:${a}>${b}`, `${a} ${(peaks.get(a) || 0).toFixed(2)} ≤ ${b} ${(peaks.get(b) || 0).toFixed(2)}`);
  }
  for (const [id, n] of Object.entries(rule?.within || {})) {
    if (!ranked.slice(0, n).some(([muscle]) => muscle === id)) {
      check(c.id, `rank:${id}:top${n}`, `前${n}名 ${ranked.slice(0, n).map(([muscle]) => muscle).join(', ')}，預期含 ${id}`);
    }
  }
  for (const n of [2, 3, 4]) {
    const accepted = rule?.[`top${n}`];
    if (accepted && !ranked.slice(0, n).some(([id]) => accepted.includes(id))) {
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
    for (const [id, muscle] of Object.entries(analyze('hacksquat', P, j / N).mus)) {
      peaks.set(id, Math.max(peaks.get(id) || 0, muscle.s));
    }
  }
  const first = [...peaks].sort((a, b) => b[1] - a[1])[0][0];
  if (first !== 'vasti') errors.push(`hack-squat 站距 ${(i / 100).toFixed(2)} 第一名 ${first}，預期 vasti`);
}
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
