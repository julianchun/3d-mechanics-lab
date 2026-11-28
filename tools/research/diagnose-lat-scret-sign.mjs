// 診斷用（不改產品）：背闊肌 scRet 符號敏感度。
//   node tools/research/diagnose-lat-scret-sign.mjs fit            → 印出 DAS3 背闊肌 scRet 的二次擬合係數（對 80 個產品姿勢）
//   node tools/research/diagnose-lat-scret-sign.mjs rank [tsm|zero|das3|elev30]   → 全程前四名與 a>1
//   node tools/research/diagnose-lat-scret-sign.mjs decomp [tsm|zero|das3]  → 各動作峰值幀 scRet／scElev 逐肌力矩分解與前四名
// 變體以執行期覆寫 MUSCLE_BY_ID.lat.arms.scRet 實作，不寫入 src/。
import fs from 'node:fs';
import { CATALOG } from '../../src/catalog.js';
import { analyze, defaultParams, MUSCLES, MUSCLE_GROUP_IDS } from '../../src/biomech.js';

const DATA = JSON.parse(fs.readFileSync(new URL('../../docs/research/results/scapular-arms-data.json', import.meta.url)));
const EXPS = DATA.fit_B_deg2.exps;
const hOf = (el, pl) => { const t = el * Math.PI / 180, p = pl * Math.PI / 180; return [Math.sin(t) * Math.sin(p), -Math.cos(t), Math.sin(t) * Math.cos(p)]; };
const mono = (h) => EXPS.map(([a, b, c]) => h[0] ** a * h[1] ** b * h[2] ** c);
function fitDas3() {
  const rows = [], ys = [];
  for (const v of Object.values(DATA.postures)) { rows.push(mono(hOf(v.arm_elevation_deg, v.arm_plane_deg))); ys.push(v.groups.lat.das3_scRet / 1000); }
  const n = EXPS.length, A = Array.from({ length: n }, () => Array(n + 1).fill(0));
  rows.forEach((r, k) => { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += r[i] * r[j]; A[i][n] += r[i] * ys[k]; } });
  for (let i = 0; i < n; i++) A[i][i] += 1e-4;
  for (let i = 0; i < n; i++) { let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r; [A[i], A[m]] = [A[m], A[i]];
    for (let r = 0; r < n; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= n; c++) A[r][c] -= f * A[i][c]; } }
  return A.map((r, i) => r[n] / r[i]);
}
function applyVariant(variant) {
  const lat = MUSCLES.find((m) => m.id === 'lat');
  if (variant === 'zero') lat.arms.scRet = () => 0;
  if (variant === 'elev30') lat.arms.scElev = () => -0.030; // 對照：只把背闊肌 scElev 退回舊常數，scRet 保持 TSM（診斷用）
  if (variant === 'das3') {
    const c = fitDas3();
    lat.arms.scRet = (q) => mono([Math.sin(q.shElev) * Math.sin(q.shPlane), -Math.cos(q.shElev), Math.sin(q.shElev) * Math.cos(q.shPlane)]).reduce((s, m, i) => s + m * c[i], 0);
  }
}
const mode = process.argv[2];
if (mode === 'fit') {
  const c = fitDas3();
  let se = 0, mx = 0; Object.values(DATA.postures).forEach((v) => { const e = Math.abs(1000 * mono(hOf(v.arm_elevation_deg, v.arm_plane_deg)).reduce((s, m, i) => s + m * c[i], 0) - v.groups.lat.das3_scRet); se += e * e; mx = Math.max(mx, e); });
  console.log(JSON.stringify(c.map((x) => +x.toPrecision(6))), 'RMS mm', Math.sqrt(se / 80).toFixed(1), 'max', mx.toFixed(1));
} else if (mode === 'rank') {
  const variant = process.argv[3] || 'tsm';
  applyVariant(variant);
  const LIFTS = process.argv[4] ? process.argv[4].split(',') : ['pullup', 'pullup-wide', 'pulldown', 'row', 'cable-row', 'ohp', 'dips'];
  for (const id of LIFTS) {
    const c = CATALOG.find((x) => x.id === id), P = { ...defaultParams(c.lift), ...c.set };
    const pk = new Map(), pa = new Map();
    for (let i = 0; i <= 40; i++) for (const [k, m] of Object.entries(analyze(c.lift, P, i / 40).mus)) {
      if (MUSCLE_GROUP_IDS.includes(k)) pk.set(k, Math.max(pk.get(k) || 0, m.s));
      pa.set(k, Math.max(pa.get(k) || 0, m.a));
    }
    const top = [...pk].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
    const over = [...pa].filter(([, v]) => v > 1.000001).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
    console.log(`${id}: ${top} | a>1: ${over || '-'}`);
  }
} else {
  const variant = process.argv[3] || 'tsm';
  applyVariant(variant);
  const SHOW = ['lat', 'pecs', 'pecc', 'uptrap', 'midtrap', 'lowtrap', 'serr', 'subsc'];
  const LIFTS = process.argv[4] ? process.argv[4].split(',') : ['pullup', 'pullup-wide', 'pulldown', 'row', 'cable-row', 'ohp', 'dips'];
  const f = (x) => (typeof x === 'function' ? x : () => x || 0);
  for (const id of LIFTS) {
    const c = CATALOG.find((x) => x.id === id), P = { ...defaultParams(c.lift), ...c.set };
    const frames = Array.from({ length: 41 }, (_, i) => ({ e: i / 40, r: analyze(c.lift, P, i / 40) }));
    const pickers = { 'uptrap 峰值幀': (r) => r.mus.uptrap.a, '|scElev 需求| 峰值幀': (r) => Math.abs(r.dem.scElev) };
    for (const [label, fn] of Object.entries(pickers)) {
      const best = frames.reduce((b, x) => (fn(x.r) > fn(b.r) ? x : b));
      const { e, r } = best;
      const row = SHOW.map((m) => { const mu = MUSCLES.find((x) => x.id === m), a = r.mus[m]?.a || 0, F = r.mus[m]?.force || 0;
        return `${m} a${a.toFixed(2)} ${(F * f(mu.arms.scElev)(r.q)).toFixed(0)}／${(F * f(mu.arms.scRet)(r.q)).toFixed(0)}`; }).join(' | ');
      const top = Object.entries(r.mus).filter(([k]) => MUSCLE_GROUP_IDS.includes(k)).sort((a, b) => b[1].s - a[1].s).slice(0, 4).map(([k, m]) => `${k} ${m.s.toFixed(2)}`).join(', ');
      console.log(`${id} [${label}] e=${e.toFixed(3)} 需求 scElev／scRet ${r.dem.scElev.toFixed(0)}／${r.dem.scRet.toFixed(0)} N·m\n  逐肌 scElev／scRet N·m：${row}\n  該幀前四：${top}`);
    }
  }
}
