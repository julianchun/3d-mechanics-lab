// 肩部軌跡：以真實上臂方向量角，避免把近 180° 的旋轉向量分量誤當成物理跳動。
import { CATALOG } from '../src/catalog.js';
import { LIFTS, MUSCLES, analyze, defaultParams, forcesOf, add, sub, mul, dot, cross } from '../src/biomech.js';

const rad = (d) => d * Math.PI / 180;
const failures = [];
const shoulderMuscles = MUSCLES.filter((m) => m.arms.shFwd || m.arms.shSide);
const upper = (r) => {
  const a = r.pose.R.shoulder, b = r.pose.R.elbow;
  const v = b.map((x, i) => x - a[i]);
  return v.map((x) => x / Math.hypot(...v));
};
for (const item of CATALOG.filter((c) => c.lift && LIFTS[c.lift].dofs.includes('shFwd'))) {
  const P = { ...defaultParams(item.lift), ...item.set };
  let previous = null;
  for (let i = 0; i <= 80; i++) {
    const r = analyze(item.lift, P, i / 80);
    const u = upper(r);
    for (const key of ['shFwd', 'shSide', 'shRot', 'shElev', 'shFlex']) {
      if (!Number.isFinite(r.q[key])) failures.push(`${item.id}@${i / 80} ${key} 非有限值`);
    }
    for (const key of LIFTS[item.lift].dofs.filter((d) => d.startsWith('sh'))) {
      if (!Number.isFinite(r.dem[key])) failures.push(`${item.id}@${i / 80} ${key} 需求非有限值`);
    }
    if (previous) {
      const direction = Math.acos(Math.max(-1, Math.min(1, u.reduce((s, v, j) => s + v * previous.u[j], 0))));
      if (direction > rad(5)) failures.push(`${item.id}@${i / 80} 上臂方向單步跳動 ${(direction / rad(1)).toFixed(2)}° > 5°`);
      if (Math.abs(r.q.shRot - previous.r.q.shRot) > rad(5)) failures.push(`${item.id}@${i / 80} 軸旋單步跳動超過 5°`);
      for (const m of shoulderMuscles) for (const key of ['shFwd', 'shSide']) {
        if (typeof m.arms[key] !== 'function') continue;
        if (Math.abs(m.arms[key](r.q) - m.arms[key](previous.r.q)) > 0.01) failures.push(`${item.id}@${i / 80} ${m.id}.${key} 力臂單步跳動超過 10 mm`);
      }
      for (const [id, muscle] of Object.entries(r.mus)) {
        const before = previous.r.mus[id];
        if (before && Math.abs(muscle.a - before.a) > 0.3) {
          // 靠近行程端點時，肘部負載可在 1/80 行程內快速但連續地上升；
          // 用中點確認兩個 1/160 細步均無突跳，而非把斜率誤判為不連續。
          const mid = analyze(item.lift, P, (i - 0.5) / 80).mus[id].a;
          if (Math.max(Math.abs(mid - before.a), Math.abs(muscle.a - mid)) > 0.3) {
            failures.push(`${item.id}@${i / 80} ${id} 活化 1/160 細步跳動超過 0.3`);
          }
        }
        if (before && Math.abs(muscle.l - before.l) > 0.1) failures.push(`${item.id}@${i / 80} ${id} 長度單步跳動超過 0.1`);
      }
    }
    previous = { r, u };
  }
}
// 高上舉與一般角度皆用獨立的外力叉積核對正交肩部力矩平衡。
// 未列 shRot 的動作，長軸由固定自由度的反力矩承受，僅檢查兩個主動切向軸。
for (const [id, e] of [['pullup', 0], ['pullup', 0.5], ['pullup', 1], ['pullup-wide', 1], ['chinup', 1], ['ohp', 0], ['lat-raise', 0], ['pulldown', 0]]) {
  const item = CATALOG.find((c) => c.id === id);
  const P = { ...defaultParams(item.lift), ...item.set };
  const r = analyze(item.lift, P, e), q = r.q, p = q.shPlane, t = q.shElev;
  const c = Math.cos(p), s = Math.sin(p), ct = Math.cos(t), st = Math.sin(t);
  const axes = [[-c, 0, s], [-ct * s, -st, -ct * c], [st * s, -ct, st * c]];
  const M = forcesOf(r.pose, P, item.lift).filter((f) => f.region === 'upper' || f.region === 'fore')
    .reduce((sum, f) => sub(sum, cross(sub(f.p, r.pose.R.shoulder), f.F)), [0, 0, 0]);
  const world = (v) => add(add(mul(r.pose.lat, v[0]), mul(r.pose.u, v[1])), mul(r.pose.f, v[2]));
  for (let j = 0; j < 3; j++) {
    const demand = dot(M, world(axes[j]));
    const supplied = MUSCLES.reduce((sum, m) => {
      const force = r.mus[m.id]?.force || 0;
      if (j === 2) {
        const rot = m.arms.shRot;
        return sum + force * (typeof rot === 'function' ? rot(q) : rot || 0);
      }
      const v = m.arms.shFwd?.shoulderVec?.(q);
      return sum + force * (v ? dot(v, axes[j]) : 0);
    }, 0);
    const reaction = j === 2 ? r.shoulderLong?.constraint : 0;
    if (j === 2 && Math.abs(r.shoulderLong.external - demand) > 0.05) failures.push(`${id}@${e} 長軸外力矩回報 ${r.shoulderLong.external.toFixed(3)} 與重算 ${demand.toFixed(3)} 不符`);
    if (Math.abs(demand - supplied - reaction) > 0.25) failures.push(`${id}@${e} 正交肩力矩第 ${j + 1} 軸殘差 ${(demand - supplied - reaction).toFixed(3)} N·m`);
    if (j === 2 && LIFTS[item.lift].dofs.includes('shRot') && Math.abs(reaction) > 0.25) {
      failures.push(`${id}@${e} 已求解的肩長軸殘差 ${reaction.toFixed(3)} N·m`);
    }
  }
}
// 肩推鎖死前 10% 行程以 1/400 細步檢查軸旋與肌肉長度，確認無 rotConfidence 或 180° 分支跳變。
{
  const ohp = CATALOG.find((c) => c.id === 'ohp');
  const P = { ...defaultParams(ohp.lift), ...ohp.set };
  let prev = null;
  for (let i = 0; i <= 40; i++) {
    const r = analyze(ohp.lift, P, i / 400);
    if (prev) {
      if (Math.abs(r.q.shRot - prev.q.shRot) > rad(2)) failures.push(`ohp@${i / 400} 鎖死附近軸旋細步跳動超過 2°`);
      for (const [id, muscle] of Object.entries(r.mus)) {
        if (Math.abs(muscle.l - prev.mus[id].l) > 0.03) failures.push(`ohp@${i / 400} ${id} 鎖死附近長度細步跳動超過 0.03`);
      }
    }
    prev = r;
  }
}
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log('shoulder PASS：所有含肩動作的上臂方向／軸旋每 1/80 行程 ≤5°、肩推鎖死 1/400 細步連續，力臂、長度與活化（必要時以 1/160 細步）連續');
