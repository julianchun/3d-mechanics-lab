// 臥推驗證的條件反解與幾何指標（定義見 validation/schema.md「T36 臥推預先固定條件」）。
// 只讀取姿勢與外力幾何，不修改模型；BODY 為呼叫當下的人體。
import { BAR_RATIO, BODY, analyze, solvePose } from '../src/biomech.js';

const G = 9.81;
const deg = (x) => x * 180 / Math.PI;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const len = (a) => Math.hypot(...a);
const norm = (a) => { const n = len(a); return a.map((v) => v / n); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x) => Math.max(-1, Math.min(1, x));
const N_PATH = 400;

export const benchMetrics = new Set([
  'elbowPeakFlexion', 'elbowFlexionRom', 'shoulderAbductionBottom', 'shoulderPeakBarMoment', 'elbowPeakBarMoment',
  'shoulderPeakMomentArm', 'elbowPeakMomentArm', 'shoulderMomentArm', 'elbowMomentArm', 'barVerticalTravel',
  'barHorizontalTravel', 'shoulderAbsMomentPeak', 'shoulderHorizontalAdductionPeak', 'shoulderHorizontalAdductionRom',
  'forearmAngleMean', 'archAngleMean']);
const noModel = new Set(['shoulderHorizontalAdductionPeak', 'shoulderHorizontalAdductionRom', 'forearmAngleMean', 'archAngleMean']);

function pose(params, e) {
  const p = solvePose('bench', params, e);
  if (!p.ok) throw new Error(`臥推姿勢失敗，e=${e.toFixed(3)}`);
  return p;
}
function armAngles(p) {
  const { shoulder: S, elbow: E, hand: H } = p.R;
  const upper = sub(E, S), fore = sub(H, E);
  return {
    elbowFlexion: deg(Math.acos(clamp(dot(norm(upper), norm(fore))))),
    abduction: deg(Math.asin(clamp(dot(norm(upper), p.lat)))),
  };
}
// 槓力只含槓：每手垂直 F；力矩軸 = 前臂—上臂平面法向量。
function barMoments(p) {
  const { shoulder: S, elbow: E, hand: H } = p.R;
  const F = BAR_RATIO.bench * BODY.mass * G / 2, Fv = [0, -F, 0];
  const nRaw = cross(sub(E, S), sub(H, E));
  if (len(nRaw) < 1e-9) return { shoulder: 0, elbow: 0, shoulderArm: 0, elbowArm: 0 };
  const n = norm(nRaw), inPlane = len(sub(Fv, n.map((v) => v * dot(Fv, n))));
  const m = (J) => Math.abs(dot(cross(sub(H, J), Fv), n));
  const shoulder = m(S), elbow = m(E);
  return { shoulder, elbow, shoulderArm: inPlane > 1e-9 ? shoulder / inPlane : 0, elbowArm: inPlane > 1e-9 ? elbow / inPlane : 0 };
}
function bisect(f, lo, hi, increasing) {
  // f 單調；回傳 f(x) = 0 的 x；以符號判斷方向。
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if ((f(mid) < 0) === increasing) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
function solveRange(target, lo, hi, fn, what) {
  const a = fn(lo) - target, b = fn(hi) - target;
  if (a * b > 0) return { x: Math.abs(a) < Math.abs(b) ? lo : hi, clamped: true, what };
  return { x: bisect((x) => fn(x) - target, lo, hi, a < 0), clamped: false, what };
}

// 逐人反解 derivedParams；回傳新的 params（含解出的 grip／flare）與是否觸及端點。
export function resolveBenchParams(base, derived = {}) {
  let params = { ...base };
  const notes = [];
  const topAB = (grip) => {
    const p = pose({ ...params, grip }, 0), { shoulder: S, hand: H } = p.R;
    return deg(Math.acos(clamp(dot(norm(sub(S, H)), [-1, 0, 0]))));
  };
  const solveGrip = () => {
    const rule = derived.grip;
    const r = solveRange(rule.deg, rule.range[0], rule.range[1], topAB, 'grip');
    if (r.clamped) throw new Error(`握距無法由 AB 角 ${rule.deg}° 反解（範圍 ${rule.range.join('–')}）`);
    params = { ...params, grip: r.x };
  };
  if (derived.grip) solveGrip();
  if (derived.flare) {
    // 研究條件明訂底部外展角時，反解的是手動 flare；幾何模式不讀取此旋鈕。
    params = { ...params, flareMode: 'manual' };
    const rule = derived.flare;
    const abd = (flare) => armAngles(pose({ ...params, flare }, 1)).abduction;
    const r = solveRange(rule.deg, rule.range[0], rule.range[1], abd, 'flare');
    params = { ...params, flare: r.x };
    if (r.clamped) notes.push('flare 取範圍端點');
    if (derived.grip) solveGrip();
  }
  return { params, notes };
}

export function loadRatioFor(condition, massKg) {
  if (condition.loadBarTareKg !== undefined) return condition.loadBodyFraction + condition.loadBarTareKg / massKg;
  return condition.loadRatio;
}

function pathValues(params, fn) {
  const xs = [];
  for (let i = 0; i <= N_PATH; i++) xs.push(fn(pose(params, i / N_PATH), i / N_PATH));
  return xs;
}
function peakOf(xs) {
  let best = -Infinity, at = 0;
  xs.forEach((x, i) => { if (x > best) { best = x; at = i / N_PATH; } });
  return { value: best, atE: at };
}
function eAtBarHeight(params, meters) {
  const bottom = pose(params, 1).bar[1];
  const f = (e) => pose(params, e).bar[1] - bottom - meters;
  if (f(0) < 0 || f(1) > 0) throw new Error(`槓行程不含高於最低點 ${meters} m`);
  return bisect(f, 0, 1, false);
}

// 回傳 { value, atE }；沒有模型對應量的定義不一致列回傳 value: null。
export function benchValue(m, params) {
  const metric = m.metric, sample = m.sample;
  if (noModel.has(metric)) return { value: null, atE: 1 };
  let r;
  if (metric === 'barVerticalTravel' || metric === 'barHorizontalTravel') {
    const top = pose(params, 0).bar, bottom = pose(params, 1).bar;
    r = { value: Math.abs(metric === 'barVerticalTravel' ? top[1] - bottom[1] : top[2] - bottom[2]), atE: 1 };
  } else if (metric === 'shoulderAbsMomentPeak') {
    if (sample.type !== 'peak') throw new Error('shoulderAbsMomentPeak 只支援 peak');
    const xs = [];
    for (let i = 0; i <= N_PATH; i++) xs.push(analyze('bench', params, i / N_PATH).joints.shoulder);
    r = peakOf(xs);
  } else {
    const pick = {
      elbowPeakFlexion: (p) => armAngles(p).elbowFlexion, elbowFlexionRom: (p) => armAngles(p).elbowFlexion,
      shoulderAbductionBottom: (p) => armAngles(p).abduction,
      shoulderPeakBarMoment: (p) => barMoments(p).shoulder, elbowPeakBarMoment: (p) => barMoments(p).elbow,
      shoulderPeakMomentArm: (p) => barMoments(p).shoulderArm, elbowPeakMomentArm: (p) => barMoments(p).elbowArm,
      shoulderMomentArm: (p) => barMoments(p).shoulderArm, elbowMomentArm: (p) => barMoments(p).elbowArm,
    }[metric];
    if (!pick) throw new Error(`未支援臥推指標：${metric}`);
    if (sample.type === 'bottom') r = { value: pick(pose(params, 1)), atE: 1 };
    else if (sample.type === 'barHeightAboveBottom') { const e = eAtBarHeight(params, sample.meters); r = { value: pick(pose(params, e)), atE: e }; }
    else if (sample.type === 'peak') r = peakOf(pathValues(params, pick));
    else if (sample.type === 'range') { const xs = pathValues(params, pick); r = { value: Math.max(...xs) - Math.min(...xs), atE: 1 }; }
    else throw new Error(`未支援 sample.type：${sample.type}`);
  }
  if (m.normalization === 'mass') r.value /= BODY.mass;
  else if (m.normalization !== undefined) throw new Error(`未知正規化：${m.normalization}`);
  if (!Number.isFinite(r.value)) throw new Error(`${metric} 非有限數`);
  return r;
}
