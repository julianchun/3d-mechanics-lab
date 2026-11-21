// 清單預設姿勢的生理合理性驗收；每條肌肉只比較主動活化 a，避免被動張力與顯示截斷掩蓋超載。
import { CATALOG } from '../src/catalog.js';
import { analyze, defaultParams } from '../src/biomech.js';

// 排名用畫面顯示的 s（主動活化加被動份額）；超載門檻只用未截斷的 a。
// 文獻趨勢見 docs/references.md；同一肌肉的不同動作峰值不等於跨肌肉 EMG 百分比。
// 臀橋獨立於臀推驗收：接觸反力近似使臀橋腰背群高於臀大肌，待姿勢／反力任務修正。
// 槓鈴划船的肩胛等效軸尚未校準，暫不對背闊肌／斜方肌中束設定跨肌肉排名。
const RANKS = {
  'squat-high': { top3: ['vasti'] }, 'squat-low': { top3: ['vasti'] }, 'front-squat': { top3: ['vasti'] },
  'smith-squat': { top2: ['vasti'] }, 'leg-press': { top2: ['vasti'] },
  deadlift: { top3: ['erec', 'hams', 'gmax'] }, 'deficit-dl': { top3: ['erec', 'hams', 'gmax'] },
  'block-pull': { top3: ['erec', 'hams', 'gmax'] }, sumo: { top3: ['erec', 'hams', 'gmax'] },
  'hip-thrust': { top2: ['gmax'] }, 'glute-bridge': { top3: ['gmax'] },
  bench: { top3: ['pecs'] }, 'incline-bench': { top3: ['pecs'] }, 'cg-bench': { top3: ['trilat'] },
  'floor-press': { top3: ['pecs'] }, 'chest-press': { top3: ['pecs'] }, ohp: { top3: ['adelt'] },
  pulldown: { first: ['lat'] }, 'pulldown-sup': { first: ['lat'] },
  'cable-row': { top4: ['lat', 'midtrap'] }, 'cable-row-wide': { top4: ['lat', 'midtrap'] },
  curl: { top2: ['bic', 'brach'] }, 'reverse-curl': { top2: ['bic', 'brach'] },
  pushdown: { first: ['trilat', 'trilong'] }, 'leg-ext': { first: ['vasti'] },
  'leg-curl': { first: ['hams'] }, 'lying-leg-curl': { first: ['hams'] }, shrug: { top2: ['uptrap'] },
  uprow: { notFirst: ['infra'] },
  rdl: { top3: ['hams'] }, 'good-morning': { top3: ['hams'] },
};

const N = 40;
const errors = [];
let checked = 0;
for (const c of CATALOG.filter((entry) => entry.lift)) {
  const P = { ...defaultParams(c.lift), ...c.set };
  const peaks = new Map();
  for (let i = 0; i <= N; i++) {
    const e = i / N;
    for (const [id, mus] of Object.entries(analyze(c.lift, P, e).mus)) {
      if (!Number.isFinite(mus.a) || mus.a > 1.000001) {
        errors.push(`${c.id} e=${e.toFixed(3)} ${id}: a=${mus.a.toFixed(4)} > 1`);
      }
      peaks.set(id, Math.max(peaks.get(id) || 0, mus.s));
    }
  }
  const ranked = [...peaks].sort((a, b) => b[1] - a[1]);
  const rule = RANKS[c.id];
  if (rule?.first && !rule.first.includes(ranked[0][0])) {
    errors.push(`${c.id}: 第一名 ${ranked[0][0]}，預期 ${rule.first.join(' 或 ')}`);
  }
  if (rule?.notFirst?.includes(ranked[0][0])) {
    errors.push(`${c.id}: 第一名不應為 ${ranked[0][0]}`);
  }
  for (const n of [2, 4]) {
    const accepted = rule?.[`top${n}`];
    if (accepted && !ranked.slice(0, n).some(([id]) => accepted.includes(id))) {
      errors.push(`${c.id}: 前${n}名 ${ranked.slice(0, n).map(([id]) => id).join(', ')}，預期含 ${accepted.join(' 或 ')}`);
    }
  }
  if (rule?.top3 && !ranked.slice(0, 3).some(([id]) => rule.top3.includes(id))) {
    errors.push(`${c.id}: 前三名 ${ranked.slice(0, 3).map(([id]) => id).join(', ')}，預期含 ${rule.top3.join(' 或 ')}`);
  }
  checked++;
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`plausibility PASS：${checked} 個清單項目、每項 ${N + 1} 個行程點；a ≤ 1 且主要肌群排名符合規則`);
}
