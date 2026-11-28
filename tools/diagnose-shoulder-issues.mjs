// 肩帶相關已知問題總診斷（只讀；不改產品）。
// 用法：
//   node tools/diagnose-shoulder-issues.mjs            人讀摘要（每項問題一段）
//   node tools/diagnose-shoulder-issues.mjs --json     完整 JSON
//   node tools/diagnose-shoulder-issues.mjs --md       產生 docs 用的 Markdown 表格
//   node tools/diagnose-shoulder-issues.mjs --only=pullup   只跑某動作
// 作法：對每項已知問題找峰值幀，列出各肩自由度需求、前 6 名肌肉的有效 F 與力臂、
// 各肌肉承擔各自由度需求的份額；再用與 analyze() 相同的最小 Σa²／pref 分配（本檔複刻，
// 並在每個峰值幀自我核對與 analyze() 的 a 一致）做單項替換敏感度。DAS3 全套另開子行程
// （SHOULDER_PARAMETER_SET=das3）重算同一幀。
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { CATALOG } from '../src/catalog.js';
import {
  analyze, defaultParams, forcesOf, liftMuscles, LIFTS, MUSCLE_GROUPS, MUSCLE_GROUP_IDS, SHOULDER_PARAMETER_SET,
  girdleForBody, norm, len, cross, sub, add, mul, dot,
} from '../src/biomech.js';
import { frames } from '../src/rig.js';
import { DAS3_SHOULDER } from '../src/das3-shoulder.js';

const args = process.argv.slice(2);
const FLAG = (k) => args.includes(k);
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const N = 40;
const DEG = 180 / Math.PI;
const r1 = (x, n = 3) => (Number.isFinite(x) ? +x.toFixed(n) : x);

// ---------- 問題清單（與 tests/plausibility.mjs 的 KNOWN_ISSUES 對應） ----------
// metric：act = 該肌（群）全程峰值 a；rank = 以 subject 肌群峰值幀看排名
// frame：峰值幀依據的肌肉（預設同 subject）
const ISSUES = [
  { id: 'dips', rule: 'activation:pecs', subject: 'pecs' },
  { id: 'dips', rule: 'activation:lat', subject: 'lat' },
  { id: 'dips', rule: 'activation:tmaj', subject: 'tmaj' },
  { id: 'dips-upright', rule: 'activation:pecs', subject: 'pecs' },
  { id: 'dips-upright', rule: 'activation:lat', subject: 'lat' },
  { id: 'dips-upright', rule: 'activation:tmaj', subject: 'tmaj' },
  { id: 'pullup', rule: 'activation:lat', subject: 'lat' },
  { id: 'pullup-wide', rule: 'activation:pecs', subject: 'pecs' },
  { id: 'pullup-wide', rule: 'activation:lat', subject: 'lat' },
  { id: 'chinup', rule: 'activation:adelt', subject: 'adelt' },
  { id: 'chinup', rule: 'activation:lat', subject: 'lat' },
  { id: 'chinup', rule: 'activation:mdelt', subject: 'mdelt' },
  { id: 'chinup', rule: 'activation:brach', subject: 'brach' },
  { id: 'row', rule: 'rank:lat:top4', subject: 'lat', want: 'lat' },
  { id: 'row-sup', rule: 'rank:lat:top4', subject: 'lat', want: 'lat' },
  { id: 'cable-row-wide', rule: 'rank:lat:top4', subject: 'lat', want: 'lat' },
  { id: 'pulldown', rule: 'rank:notTop4', subject: 'pecs', unwanted: 'pecs' },
  { id: 'uprow', rule: 'rank:notFirst', subject: 'infra', unwanted: 'infra' },
  { id: 'db-press', rule: 'rank:top2', subject: 'adelt', want: 'adelt' },
  { id: 'db-bench-incline', rule: 'rank:first', subject: 'mdelt', want: 'pecs|adelt' },
  { id: 'reverse-deck', rule: 'activation:pdelt', subject: 'pdelt' },
  { id: 'db-reverse-fly', rule: 'activation:pdelt', subject: 'pdelt' },
  { id: 'deadlift', rule: 'activation:lat', subject: 'lat' },
  { id: 'deficit-dl', rule: 'activation:lat', subject: 'lat' },
  { id: 'curl', rule: 'rank:first', subject: 'adelt', want: 'bic|brach' },
  { id: 'reverse-curl', rule: 'rank:first', subject: 'adelt', want: 'bic|brach' },
  { id: 'db-curl', rule: 'rank:first', subject: 'adelt', want: 'bic' },
  { id: 'hammer-curl', rule: 'rank:first', subject: 'adelt', want: 'brach|bic' },
  { id: 'cable-fly-mid', rule: 'rank:first', subject: 'brach', want: 'pecs|pecc' },
  { id: 'cable-fly-low', rule: 'rank:first', subject: 'brach', want: 'pecs|pecc' },
].filter((i) => !ONLY || i.id === ONLY);


// ---------- 肩胛／胸鎖幾何力臂（由 rig.js 的肌肉附著點估計；僅作一致性檢查） ----------
// ATTACH 沒有輸出，直接從原始碼取出（只讀）。附著點是畫面用的估計位置，不是量測值。
const ATTACH = new Function(`${(() => { const t = readFileSync(new URL('../src/rig.js', import.meta.url), 'utf8'); const a = t.indexOf('const ATTACH = {'); const b = t.indexOf('\n};', a); return t.slice(a, b + 3); })()}; return ATTACH;`)();
// 只有「一端在軀幹」的肌肉對（手臂＋肩胛）系統相對胸鎖關節有淨力矩；肩胛－上臂內部肌肉共線抵銷。
function geoScapArms(pose, id) {
  const at = ATTACH[id];
  if (!at || at.a[0] !== 'trunk') return null;
  const F = frames(pose), pt = (s) => { const f = F[s[0]]; return add(add(add(f.a, mul(sub(f.b, f.a), s[1])), mul(f.lat, s[2])), mul(f.ant, s[3])); };
  const g = girdleForBody(), scj = add(add(add(pose.Pc, mul(pose.lat, g.scj[0])), mul(pose.u, g.scj[1])), mul(pose.f, g.scj[2]));
  const a = pt(at.a), b = pt(at.b), dir = norm(sub(a, b));
  const M = cross(sub(b, scj), dir); // 單位力（1 N）作用在手臂／肩胛端
  return { scElev: dot(M, pose.f), scRet: dot(M, pose.u) };
}

// ---------- 取得動作狀態 ----------
const itemOf = (id) => CATALOG.find((c) => c.id === id);
const paramsOf = (item) => ({ ...defaultParams(item.lift), ...item.set });
const groupOf = (m) => (MUSCLE_GROUPS[m.group] ? m.group : m.id);
const groupMap = (muscles) => {
  const g = new Map();
  for (const m of muscles) {
    const id = MUSCLE_GROUPS[m.group] ? m.group : m.id;
    if (!g.has(id)) g.set(id, []);
    g.get(id).push(m);
  }
  return g;
};

// 峰值幀：以 metric 指定肌群的 a（act）或 s（rank）在 N+1 格上最大處
function scanLift(item) {
  const P = paramsOf(item);
  const frames = [];
  for (let i = 0; i <= N; i++) {
    const r = analyze(item.lift, P, i / N);
    frames.push({ e: i / N, r });
  }
  return { P, frames };
}
const groupVal = (r, id, key) => r.mus[id]?.[key] ?? 0;
const rankedGroups = (r) => MUSCLE_GROUP_IDS.filter((id) => r.mus[id]).map((id) => [id, r.mus[id].s]).sort((a, b) => b[1] - a[1]);

// ---------- 複刻分配求解 ----------
const solveLinear = (K, b) => {
  const n = b.length, M = K.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-30;
    for (let i = c + 1; i < n; i++) {
      const f = M[i][c] / d;
      for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / (M[i][i] || 1e-30);
  }
  return x;
};

// 取出某幀的平衡系統：需求向量 b0、每條肌肉的 A（= 力臂 × F × 力長係數）、pref、下限
function buildSystem(item, P, r) {
  const lift = item.lift, L = LIFTS[lift], dofs = L.dofs, has = (d) => dofs.includes(d);
  const muscles = liftMuscles(lift), q = r.q;
  const pose = r.pose;
  const frame = has('shFwd') && has('shSide');
  const t = Math.hypot(q.shFwd, q.shSide), c = t < 1e-8 ? 1 : q.shFwd / t, s = t < 1e-8 ? 0 : q.shSide / t;
  const ct = Math.cos(t), st = Math.sin(t);
  const basis = { elev: [-c, 0, s], hadd: [-ct * s, -st, -ct * c], long: [st * s, -ct, st * c] };
  const world = (v) => add(add(mul(pose.lat, v[0]), mul(pose.u, v[1])), mul(pose.f, v[2]));
  let phys = null;
  if (frame) {
    const Ms = [0, 0, 0];
    for (const f of forcesOf(pose, P, lift)) {
      if (f.region === 'upper' || f.region === 'fore') {
        const cr = cross(sub(f.p, pose.R.shoulder), f.F);
        Ms[0] -= cr[0]; Ms[1] -= cr[1]; Ms[2] -= cr[2];
      }
    }
    phys = [basis.elev, basis.hadd, basis.long].map((ax) => dot(Ms, world(ax)));
  }
  const bd = dofs.map((d) => (frame ? ({ shFwd: 'shElev', shSide: 'shHadd', shRot: 'shLong' }[d] || d) : d));
  const demand = bd.map((d) => {
    if (d === 'shElev') return phys[0];
    if (d === 'shHadd') return phys[1];
    if (d === 'shLong') return phys[2];
    return r.dem[d] || 0;
  });
  // 偏好（機制 C）與群組不變成本
  const pref = Object.fromEntries(muscles.map((m) => [m.id, 1]));
  for (const p of L.params) {
    if (p.mech !== 'C') continue;
    const v = P[p.key] || 0;
    for (const id of p.pref[0]) for (const m of muscles) if (m.id === id || m.group === id) pref[m.id] *= Math.pow(3, -v);
    for (const id of p.pref[1]) for (const m of muscles) if (m.id === id || m.group === id) pref[m.id] *= Math.pow(3, v);
  }
  const lb = Object.fromEntries(muscles.map((m) => [m.id, 0]));
  if (P.brace && lb.ra !== undefined) lb.ra = 0.3 * P.brace;
  L.lowerBounds?.(P, lb);
  for (const id of Object.keys(MUSCLE_GROUPS)) {
    const ch = muscles.filter((m) => m.group === id);
    if (!ch.length) continue;
    const gF = ch.reduce((sum, m) => sum + m.F, 0);
    for (const m of ch) pref[m.id] *= gF / m.F;
  }
  const info = muscles.map((m) => {
    const shVec = m.arms.shFwd?.shoulderVec;
    const v = frame && shVec ? shVec(q) : null;
    const arms = bd.map((d) => {
      if (d === 'shElev') return v ? dot(v, basis.elev) : 0;
      if (d === 'shHadd') return v ? dot(v, basis.hadd) : 0;
      const a = m.arms[d === 'shLong' ? 'shRot' : d];
      return typeof a === 'function' ? a(q) : a || 0;
    });
    const mu = r.mus[m.id];
    const fl = Math.exp(-((mu.l - 1) ** 2) / 0.45);
    return { id: m.id, group: groupOf(m), name: m.name, geo: geoScapArms(pose, m.id), F: m.F, fl, pas: mu.p, arms, pref: pref[m.id], lb: lb[m.id], aProd: mu.a };
  });
  return { bd, demand, info, dofs, q };
}


// 最小最大活化（線性規劃，單純形）：min t + M·Σ(平衡缺口)，s.t. A a + u − v = b0、lb_i ≤ a_i ≤ t。
// 缺口 u、v 允許「在 a ≥ lb 下無法完全平衡」的自由度（與求解器相同：不足的部分不強制）。
// t 是任何分配準則下「最大活化」的下限：t > 1 代表能力不足（力臂、F、需求），
// t ≤ 1 但最小 Σa² 的解 > 1 才是分配準則造成。
function minimax(info, b0) {
  const m = info.length, n = b0.length, M = 1e3;
  const Lmax = Math.max(0, ...info.map((x) => x.lb));
  // 變數：a'_i = a_i − lb_i（m）、s_i（m）、tau（1，t = tau + Lmax）、u_j（n）、v_j（n）
  const iA = 0, iS = m, iT = 2 * m, iU = 2 * m + 1, iV = 2 * m + 1 + n, nv = 2 * m + 1 + 2 * n, rows = n + m;
  const T = Array.from({ length: rows }, () => Array(nv + 1).fill(0));
  const basis = Array(rows).fill(-1);
  for (let j = 0; j < n; j++) {
    const bj = b0[j] - info.reduce((sum, x) => sum + x.A[j] * x.lb, 0), sg = bj < 0 ? -1 : 1;
    for (let i = 0; i < m; i++) T[j][iA + i] = sg * info[i].A[j];
    T[j][iU + j] = 1; T[j][iV + j] = -1; T[j][nv] = sg * bj; basis[j] = iU + j;
  }
  for (let i = 0; i < m; i++) { // a'_i + s_i − tau = Lmax − lb_i ≥ 0
    const r = n + i;
    T[r][iA + i] = 1; T[r][iS + i] = 1; T[r][iT] = -1; T[r][nv] = Lmax - info[i].lb; basis[r] = iS + i;
  }
  const cost = Array(nv).fill(0); cost[iT] = 1;
  for (let j = 0; j < n; j++) { cost[iU + j] = M; cost[iV + j] = M; }
  const pivot = (r, c) => {
    const d = T[r][c];
    for (let k = 0; k <= nv; k++) T[r][k] /= d;
    for (let i = 0; i < rows; i++) if (i !== r && Math.abs(T[i][c]) > 1e-15) { const f = T[i][c]; for (let k = 0; k <= nv; k++) T[i][k] -= f * T[r][k]; }
    basis[r] = c;
  };
  for (let it = 0; it < 20000; it++) {
    let c = -1;
    for (let k = 0; k < nv; k++) {
      let z = cost[k]; for (let r = 0; r < rows; r++) z -= cost[basis[r]] * T[r][k];
      if (z < -1e-9) { c = k; break; }
    }
    if (c < 0) break;
    let r = -1, best = Infinity;
    for (let i = 0; i < rows; i++) if (T[i][c] > 1e-12) { const q = T[i][nv] / T[i][c]; if (q < best - 1e-12 || (Math.abs(q - best) <= 1e-12 && basis[i] < basis[r])) { best = q; r = i; } }
    if (r < 0) return null;
    pivot(r, c);
  }
  const val = Array(nv).fill(0); basis.forEach((bv, r) => { val[bv] = T[r][nv]; });
  const gap = Array.from({ length: n }, (_, j) => val[iU + j] + val[iV + j]).reduce((x, y) => x + y, 0);
  return { t: val[iT] + Lmax, gap, act: Object.fromEntries(info.map((x, i) => [x.id, val[iA + i] + x.lb])) };
}

// 變體：zero（需求歸零的自由度名）、F（id→倍率）、armScale（id→{dof→倍率}；dof '*' 為全部）、
// remove（移除肌肉）、p（>2 近似最小最大活化，IRLS）
function solve(sys, o = {}) {
  const zero = new Set(o.zero || []), rem = new Set(o.remove || []);
  const info = sys.info.filter((x) => !rem.has(x.id)).map((x) => {
    const Fm = (o.F?.[x.id] ?? 1);
    const sc = o.armScale?.[x.id] || {};
    const ov = o.armOverride?.[x.id] || {};
    const arms = x.arms.map((a, j) => (ov[sys.bd[j]] ?? a) * (sc[sys.bd[j]] ?? sc['*'] ?? 1));
    return { ...x, Fx: x.F * Fm, arms, A: arms.map((a) => a * x.F * Fm * x.fl) };
  });
  const b0 = sys.demand.map((d, j) => (zero.has(sys.bd[j]) ? 0 : d) - info.reduce((sum, x) => sum + x.pas * x.Fx * x.arms[j], 0));
  const n = sys.bd.length;
  const run = (prefOf) => {
    const act = Object.fromEntries(info.map((x) => [x.id, 0]));
    const fixed = new Set();
    for (let it = 0; it < 120; it++) {
      const free = info.filter((x) => !fixed.has(x.id));
      const b = b0.map((v, j) => v - info.filter((x) => fixed.has(x.id)).reduce((sum, x) => sum + act[x.id] * x.A[j], 0));
      const K = Array.from({ length: n }, () => Array(n).fill(0));
      for (const x of free) { const p = prefOf(x); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) K[i][j] += p * x.A[i] * x.A[j]; }
      let tr = 0; for (let i = 0; i < n; i++) tr += K[i][i];
      for (let i = 0; i < n; i++) K[i][i] += 1e-7 * tr + 1e-9;
      const lam = solveLinear(K, b);
      const want = (x) => prefOf(x) * x.A.reduce((sum, v, i) => sum + v * lam[i], 0);
      for (const x of free) act[x.id] = want(x);
      let worst = null, wv = -1e-9;
      for (const x of free) { const d = act[x.id] - x.lb; if (d < wv) { wv = d; worst = x; } }
      if (worst) { act[worst.id] = worst.lb; fixed.add(worst.id); continue; }
      let rel = null, rv = 1e-9;
      for (const x of info) if (fixed.has(x.id)) { const d = want(x) - x.lb; if (d > rv) { rv = d; rel = x; } }
      if (rel) { fixed.delete(rel.id); continue; }
      break;
    }
    // 殘差：平衡誤差（無法在 a ≥ 下限下平衡時才會 > 0）
    const res = b0.map((v, j) => v - info.reduce((sum, x) => sum + Math.max(0, act[x.id]) * x.A[j], 0));
    return { act, res };
  };
  let out = run((x) => x.pref);
  let lpT = null;
  if (o.minimax) {
    const lp = minimax(info, b0);
    if (lp) { lpT = lp.t; out = { act: lp.act, res: b0.map((v, j) => v - info.reduce((sum, x) => sum + lp.act[x.id] * x.A[j], 0)) }; }
    else lpT = Infinity;
  }
  const act = Object.fromEntries(info.map((x) => [x.id, Math.max(0, out.act[x.id])]));
  // 群組聚合（F 加權）與 s
  const groups = {};
  for (const x of info) {
    const g = x.group;
    groups[g] ||= { F: 0, a: 0, s: 0 };
    groups[g].F += x.Fx; groups[g].a += x.Fx * act[x.id]; groups[g].s += x.Fx * (Math.min(act[x.id], 1.5) + x.pas);
  }
  for (const g of Object.values(groups)) { g.a /= g.F; g.s /= g.F; }
  return { act, groups, res: out.res, info, lpT };
}

const topGroups = (groups, n = 4) => Object.entries(groups).sort((a, b) => b[1].s - a[1].s).slice(0, n).map(([id, g]) => `${id} ${r1(g.s, 2)}`);
const rankOf = (groups, id) => 1 + Object.values(groups).filter((g) => g.s > (groups[id]?.s ?? -1)).length;

// ---------- 逐幀系統與判定 ----------
const liftCache = new Map();
function loadLift(id) {
  if (liftCache.has(id)) return liftCache.get(id);
  const item = itemOf(id), P = paramsOf(item);
  const frames = [];
  for (let i = 0; i <= N; i++) {
    const r = analyze(item.lift, P, i / N);
    frames.push({ e: i / N, r, sys: buildSystem(item, P, r) });
  }
  const out = { item, P, frames };
  liftCache.set(id, out);
  return out;
}
// 對全程每幀求解並彙整：每群組的 s、a 全程峰值（與 tests/plausibility.mjs 相同的口徑）
function runTrajectory(lift, o = {}) {
  const peaksS = {}, peaksA = {};
  let maxA = 0, maxMus = '', lpMax = 0, lpFeasible = true;
  for (const fr of lift.frames) {
    const sol = solve(fr.sys, o);
    for (const [g, v] of Object.entries(sol.groups)) {
      peaksS[g] = Math.max(peaksS[g] ?? 0, v.s); peaksA[g] = Math.max(peaksA[g] ?? 0, v.a);
    }
    for (const [id, a] of Object.entries(sol.act)) if (a > maxA) { maxA = a; maxMus = id; }
    if (sol.lpT != null) { lpMax = Math.max(lpMax, sol.lpT); if (!Number.isFinite(sol.lpT)) lpFeasible = false; }
  }
  return { peaksS, peaksA, maxA, maxMus, lpMax: lpFeasible ? lpMax : Infinity };
}
const rankedPeaks = (peaksS) => Object.entries(peaksS).sort((a, b) => b[1] - a[1]);
function verdict(issue, agg) {
  const [kind] = issue.rule.split(':');
  const rk = rankedPeaks(agg.peaksS), pos = (id) => rk.findIndex(([g]) => g === id) + 1;
  const lead = rk.slice(0, 4).map(([g, v]) => `${g} ${r1(v, 2)}`).join(', ');
  if (kind === 'activation') {
    const v = agg.peaksA[issue.subject] ?? 0;
    return { val: r1(v, 2), pass: v <= 1.000001, txt: `a峰值 ${r1(v, 2)}`, lead };
  }
  const W = (issue.want || '').split('|').filter(Boolean);
  if (issue.rule.endsWith(':first')) { const k = Math.min(...W.map(pos)); return { val: k, pass: k === 1, txt: `目標 ${W.join('/')} 名次 #${k}`, lead }; }
  if (issue.rule.endsWith(':top2')) { const k = pos(W[0]); return { val: k, pass: k <= 2, txt: `${W[0]} 名次 #${k}`, lead }; }
  if (issue.rule.endsWith(':top4')) { const k = pos(W[0]); return { val: k, pass: k <= 4, txt: `${W[0]} 名次 #${k}`, lead }; }
  if (issue.rule.endsWith(':notTop4')) { const k = pos(issue.unwanted); return { val: k, pass: k > 4, txt: `${issue.unwanted} 名次 #${k}`, lead }; }
  if (issue.rule.endsWith(':notFirst')) { const k = pos(issue.unwanted); return { val: k, pass: k !== 1, txt: `${issue.unwanted} 名次 #${k}`, lead }; }
  throw new Error(`未知規則 ${issue.rule}`);
}

// ---------- 單項問題診斷 ----------
function diagnose(issue) {
  const lift = loadLift(issue.id);
  const { item, P } = lift;
  const base = runTrajectory(lift);
  const key = issue.rule.startsWith('activation') ? 'a' : 's';
  // 決定性幀：目標肌群 a（act）或 s（rank）最大處
  let best = lift.frames[0], bv = -1;
  for (const fr of lift.frames) { const g = solve(fr.sys).groups[issue.subject]; const v = g ? g[key] : 0; if (v > bv) { bv = v; best = fr; } }
  const { r, sys } = best;
  const sol0 = solve(sys);
  let maxErr = 0;
  for (const fr of lift.frames) { const sl = solve(fr.sys); for (const x of fr.sys.info) maxErr = Math.max(maxErr, Math.abs(sl.act[x.id] - x.aProd)); }
  const demand = Object.fromEntries(sys.bd.map((d, j) => [d, r1(sys.demand[j], 1)]));
  // 各自由度承擔
  const share = {};
  sys.bd.forEach((d, j) => {
    const parts = sys.info.map((x) => ({ id: x.id, tq: sol0.act[x.id] * x.F * x.fl * x.arms[j] + x.pas * x.F * x.arms[j] }))
      .filter((p) => Math.abs(p.tq) > 0.5).sort((a, b) => Math.abs(b.tq) - Math.abs(a.tq)).slice(0, 4);
    share[d] = parts.map((p) => `${p.id} ${r1(p.tq, 1)}`);
  });
  // 能力：同號肌肉在 a=1 時可提供的最大力矩總和（不含被動）
  const capacity = {};
  sys.bd.forEach((d, j) => {
    const sgn = Math.sign(sys.demand[j]) || 1;
    const parts = sys.info.map((x) => ({ id: x.id, c: Math.max(0, sgn * x.arms[j] * x.F * x.fl) })).filter((p) => p.c > 0.5).sort((a, b) => b.c - a.c);
    const cap = parts.reduce((sum, p) => sum + p.c, 0);
    const lead = parts[0] && sys.info.find((x) => x.id === parts[0].id);
    const solo = lead ? { id: lead.id, needN: r1(Math.abs(sys.demand[j]) / Math.abs(lead.arms[j]), 0), ratioToF: r1(Math.abs(sys.demand[j]) / Math.abs(lead.arms[j]) / (lead.F * lead.fl), 2) } : null;
    capacity[d] = { demand: r1(sys.demand[j], 1), cap: r1(cap, 1), ratio: r1(Math.abs(sys.demand[j]) / (cap || 1e-9), 2), by: parts.slice(0, 4).map((p) => `${p.id} ${r1(p.c, 1)}`), solo };
  });
  const scap = ['scElev', 'scRet'].filter((d) => sys.bd.includes(d));
  const top = [...sys.info].sort((a, b) => sol0.act[b.id] - sol0.act[a.id]).slice(0, 6).map((x) => ({
    id: x.id, a: r1(sol0.act[x.id], 2), F: r1(x.F, 0), Fl: r1(x.F * x.fl, 0),
    armsMm: Object.fromEntries(sys.bd.map((d, j) => [d, r1(x.arms[j] * 1000, 1)]).filter(([, v]) => v !== 0)),
    geoMm: x.geo ? Object.fromEntries(scap.map((d) => [d, r1(x.geo[d] * 1000, 0)])) : undefined,
  }));
  const R = r.pose.R, handOff = sub(R.hand, R.shoulder);
  const handF = forcesOf(r.pose, P, item.lift).filter((f) => f.region === 'fore' && (len(sub(f.p, R.hand)) < 1e-6 || f.ext)).reduce((sum, f) => add(sum, f.F), [0, 0, 0]);
  const contact = { handMinusShoulderCm: handOff.map((v) => r1(v * 100, 1)), handForceN: handF.map((v) => r1(v, 0)), trunkLeanDeg: r1(Math.atan2(r.pose.u[2], r.pose.u[1]) * DEG, 1) };
  const geoTable = sys.info.filter((x) => x.geo && scap.some((d) => x.arms[sys.bd.indexOf(d)] !== 0)).map((x) => ({ id: x.id, model: Object.fromEntries(scap.map((d) => [d, r1(x.arms[sys.bd.indexOf(d)] * 1000, 0)])), geo: Object.fromEntries(scap.map((d) => [d, r1(x.geo[d] * 1000, 0)])) }));
  // ---- 全程敏感度（每個變體重解全部 41 幀並套用同一判定） ----
  const subj = issue.subject;
  const members = (g) => sys.info.filter((x) => x.group === g || x.id === g).map((x) => x.id);
  const subjMem = members(subj);
  const shDofs = sys.bd.filter((d) => /^sh(Elev|Hadd|Long)$/.test(d));
  const geoOv = (ids) => ({ armOverrideFn: (fr) => Object.fromEntries(fr.sys.info.filter((x) => x.geo && (!ids || ids.includes(x.id))).map((x) => [x.id, Object.fromEntries(scap.map((d) => [d, x.geo[d]]))])) });
  const variants = {};
  const add1 = (name, o) => {
    const oo = { ...o };
    // armOverrideFn 需要逐幀產生；在 runTrajectory 外層展開
    let agg;
    if (oo.armOverrideFn) {
      const fn = oo.armOverrideFn; delete oo.armOverrideFn;
      agg = runTrajectoryFn(lift, (fr) => ({ ...oo, armOverride: fn(fr) }));
    } else agg = runTrajectory(lift, oo);
    const v = verdict(issue, agg);
    variants[name] = { ...v, maxA: r1(agg.maxA, 2), maxMus: agg.maxMus, lpT: r1(agg.lpMax, 2) };
  };
  variants['基線'] = { ...verdict(issue, base), maxA: r1(base.maxA, 2), maxMus: base.maxMus };
  if (scap.length) {
    add1('scElev需求=0', { zero: ['scElev'] });
    add1('肩胛兩軸需求=0', { zero: scap });
    add1('背闊／胸大肌肩胛力臂=幾何', geoOv(['lat', 'pecs', 'latUpper', 'latLower', 'pecSternal', 'pecAbdominal']));
  }
  if (shDofs.length) {
    add1('肩三軸需求=0', { zero: shDofs });
    add1('問題肌肩力臂×2', { armScale: Object.fromEntries(subjMem.map((id) => [id, Object.fromEntries(shDofs.map((d) => [d, 2]))])) });
  }
  // 單項換成 DAS3 的 F（其餘不變）：群組總 F 的比例
  const das3Total = { pecs: ['pecSternal', 'pecAbdominal'], lat: ['latUpper', 'latLower'], midtrap: ['midtrapPart', 'rhomboid'], serr: ['serrUpper', 'serrLower'], infra: ['infraPart', 'tmin'] };
  const singleF = {};
  for (const id of ['pecs', 'pecc', 'adelt', 'mdelt', 'pdelt', 'lat', 'tmaj', 'infra', 'supsp', 'subsc', 'uptrap', 'midtrap', 'lowtrap', 'serr', 'corb']) {
    const mem = sys.info.filter((x) => x.id === id);
    if (!mem.length) continue;
    const tot = (das3Total[id] || [id]).reduce((sum, k) => sum + (DAS3_SHOULDER[k]?.F ?? 0), 0);
    if (!tot) continue;
    const agg = runTrajectory(lift, { F: { [id]: tot / mem[0].F } });
    singleF[id] = { ...verdict(issue, agg), ratio: r1(tot / mem[0].F, 2) };
  }
  variants['_單項換DAS3_F'] = singleF;
  add1('問題肌F×2', { F: Object.fromEntries(subjMem.map((id) => [id, 2])) });
  add1('移除問題肌', { remove: subjMem });
  if (issue.rule.startsWith('activation')) add1('最小最大(LP)', { minimax: true });
  return { id: issue.id, rule: issue.rule, subject: subj, e: best.e, peak: r1(bv, 3), selfCheckMaxErr: maxErr,
    q: { elevDeg: r1(r.q.shElev * DEG, 1), planeDeg: r1(r.q.shPlane * DEG, 1), elbFlexDeg: r1(r.q.elbFlex * DEG, 1) },
    demand, capacity, share, top, contact, geoTable, variants };
}
function runTrajectoryFn(lift, optsOf) {
  const peaksS = {}, peaksA = {};
  let maxA = 0, maxMus = '';
  for (const fr of lift.frames) {
    const sol = solve(fr.sys, optsOf(fr));
    for (const [g, v] of Object.entries(sol.groups)) { peaksS[g] = Math.max(peaksS[g] ?? 0, v.s); peaksA[g] = Math.max(peaksA[g] ?? 0, v.a); }
    for (const [id, a] of Object.entries(sol.act)) if (a > maxA) { maxA = a; maxMus = id; }
  }
  return { peaksS, peaksA, maxA, maxMus, lpMax: 0 };
}

// ---------- DAS3 全套（子行程） ----------
function das3Compare(ids) {
  if (SHOULDER_PARAMETER_SET === 'das3') return null;
  const out = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child-das3'], { input: JSON.stringify(ids), env: { ...process.env, SHOULDER_PARAMETER_SET: 'das3' }, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (out.status !== 0) return { error: out.stderr.slice(0, 300) };
  return JSON.parse(out.stdout);
}
if (FLAG('--child-das3')) {
  const ids = JSON.parse(await new Promise((res) => { let s = ''; process.stdin.on('data', (d) => (s += d)); process.stdin.on('end', () => res(s)); }));
  const res = {};
  for (const id of ids) {
    const item = itemOf(id), P = paramsOf(item), peaksS = {}, peaksA = {};
    let maxA = 0, maxMus = '';
    for (let i = 0; i <= N; i++) {
      const r = analyze(item.lift, P, i / N);
      for (const g of MUSCLE_GROUP_IDS) if (r.mus[g]) { peaksS[g] = Math.max(peaksS[g] ?? 0, r.mus[g].s); peaksA[g] = Math.max(peaksA[g] ?? 0, r.mus[g].a); }
      for (const [m, v] of Object.entries(r.mus)) if (v.a > maxA) { maxA = v.a; maxMus = m; }
    }
    res[id] = { peaksS, peaksA, maxA, maxMus };
  }
  process.stdout.write(JSON.stringify(res));
  process.exit(0);
}

// ---------- 主程式 ----------
const results = ISSUES.map((i) => diagnose(i));
const das = das3Compare([...new Set(ISSUES.map((i) => i.id))]);
results.forEach((x, i) => {
  if (das && !das.error) { const v = verdict(ISSUES[i], das[x.id]); x.variants['DAS3 全套'] = { ...v, maxA: r1(das[x.id].maxA, 2), maxMus: das[x.id].maxMus }; }
});

const cellOf = (x, k) => { const v = x.variants[k]; return v ? `${v.pass ? '✓' : '✗'} ${v.val}` : '—'; };
if (FLAG('--json')) {
  console.log(JSON.stringify(results, null, 1));
} else if (FLAG('--md')) {
  console.log('| 問題 | 基線 | scElev需求=0 | 背闊／胸大肌肩胛臂=幾何 | 肩三軸需求=0 | 問題肌肩力臂×2 | 問題肌F×2 | 最小最大 t | DAS3 全套 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const x of results) {
    const lp = x.variants['最小最大(LP)'];
    console.log(`| ${x.id} ${x.rule} | ${cellOf(x, '基線')} | ${cellOf(x, 'scElev需求=0')} | ${cellOf(x, '背闊／胸大肌肩胛力臂=幾何')} | ${cellOf(x, '肩三軸需求=0')} | ${cellOf(x, '問題肌肩力臂×2')} | ${cellOf(x, '問題肌F×2')} | ${lp ? lp.lpT : '—'} | ${cellOf(x, 'DAS3 全套')} |`);
  }
} else {
  let worst = 0;
  for (const x of results) {
    worst = Math.max(worst, x.selfCheckMaxErr);
    console.log(`\n== ${x.id}  ${x.rule}  （目標肌群 ${x.subject}；決定性幀 e=${x.e}，該群峰值 ${x.peak}；上舉 ${x.q.elevDeg}°、平面 ${x.q.planeDeg}°、肘屈 ${x.q.elbFlexDeg}°）`);
    console.log('  姿勢（手−肩 cm [x,y,z]，手上外力 N，軀幹前傾°）：', JSON.stringify(x.contact));
    console.log('  需求 N·m：', JSON.stringify(x.demand));
    console.log('  需求／同號最大能力（a=1 全肌總和）：', Object.entries(x.capacity).filter(([d]) => /Elev|Hadd|Long|elbExt|sc/.test(d)).map(([d, c]) => `${d} ${c.demand}/${c.cap}=${c.ratio}〔${c.by.join('，')}；單獨靠 ${c.solo?.id} 需 ${c.solo?.needN} N＝其有效F的 ${c.solo?.ratioToF} 倍〕`).join('；'));
    console.log('  前6名（子部位 a、F、力臂 mm）：');
    for (const t of x.top) console.log(`    ${t.id.padEnd(10)} a=${t.a}  F=${t.F}  Fl=${t.Fl}  ${JSON.stringify(t.armsMm)}${t.geoMm ? '  幾何(mm)=' + JSON.stringify(t.geoMm) : ''}`);
    if (x.geoTable.length) console.log('  肩胛力臂 模型常數 vs 附著點幾何（mm）：', x.geoTable.map((g) => `${g.id} ${JSON.stringify(g.model)}→${JSON.stringify(g.geo)}`).join('；'));
    console.log('  各自由度承擔（力矩 N·m）：');
    for (const [d, p] of Object.entries(x.share)) if (p.length) console.log(`    ${d}: ${p.join('，')}`);
    console.log('  單項換 DAS3 F（✓過／✗未過 值）：', Object.entries(x.variants._單項換DAS3_F).map(([id, v]) => `${id}×${v.ratio} ${v.pass ? '✓' : '✗'}${v.val}`).join('；'));
    console.log('  全程敏感度（判定 ✓ 通過／✗ 未過；全程最大單肌 a）：');
    for (const [k, v] of Object.entries(x.variants).filter(([k]) => !k.startsWith('_'))) console.log(`    ${k.padEnd(18)} ${v.pass ? '✓' : '✗'} ${v.txt}  前四 ${v.lead}  全程最大a=${v.maxA}(${v.maxMus})${v.lpT !== undefined ? `  LP下限=${v.lpT}` : ''}`);
  }
  console.log(`\n自我核對：複刻求解與 analyze() 各肌 a 的最大差（全部峰值幀）${worst.toExponential(2)}`);
}
