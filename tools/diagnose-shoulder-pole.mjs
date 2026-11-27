// 肩部旋轉向量極點診斷：同時列出正交三維力矩、肌肉力臂及舊廣義投影。
import { CATALOG } from '../src/catalog.js';
import { MUSCLES, analyze, defaultParams, forcesOf, cross, sub, add, mul, dot } from '../src/biomech.js';

const cases = [
  ['pullup', 0], ['pullup', 0.25], ['pullup', 0.5], ['pullup', 0.75], ['pullup', 1],
  ['pullup-wide', 1], ['chinup', 1], ['assist-pullup', 1],
  ['ohp', 0], ['db-press', 0], ['lat-raise', 0], ['pulldown', 0], ['pulldown-sup', 0],
];
const keyMuscles = ['lat', 'pdelt', 'mdelt', 'adelt', 'pecs', 'pecc', 'tmaj', 'supsp'];
const round = (x, n = 4) => +x.toFixed(n);
const vec = (v, n = 4) => v.map((x) => round(x, n));
const sumMoment = (forces, joint) => forces
  .filter((f) => ['upper', 'fore'].includes(f.region))
  .reduce((sum, f) => sub(sum, cross(sub(f.p, joint), f.F)), [0, 0, 0]);

for (const [id, e] of cases) {
  const item = CATALOG.find((c) => c.id === id);
  const P = { ...defaultParams(item.lift), ...item.set };
  const r = analyze(item.lift, P, e);
  const q = r.q, t = q.shElev, p = q.shPlane;
  const c = Math.cos(p), s = Math.sin(p), ct = Math.cos(t), st = Math.sin(t), sinc = t < 1e-5 ? 1 - t * t / 6 : st / t;
  const elev = [-c, 0, s], hadd = [-ct * s, -st, -ct * c], axial = [st * s, -ct, st * c];
  const world = (v) => add(add(mul(r.pose.lat, v[0]), mul(r.pose.u, v[1])), mul(r.pose.f, v[2]));
  const M = sumMoment(forcesOf(r.pose, P, item.lift), r.pose.R.shoulder);
  const ortho = [elev, hadd, axial].map((axis) => dot(M, world(axis)));
  const muscles = Object.fromEntries(keyMuscles.flatMap((id) => {
    const m = MUSCLES.find((candidate) => candidate.id === id);
    if (!m?.arms.shFwd?.shoulderVec) return [];
    const arm = m.arms.shFwd.shoulderVec(q);
    return [[id, { vecMm: vec(mul(arm, 1000), 2), orthoMm: vec([elev, hadd, axial].map((axis) => dot(arm, axis) * 1000), 2),
      generalizedMm: vec([m.arms.shFwd(q), m.arms.shSide(q)].map((v) => v * 1000), 2) }]];
  }));
  console.log(JSON.stringify({ id, e, elevDeg: round(t * 180 / Math.PI, 2), planeDeg: round(p * 180 / Math.PI, 2),
    sinc: round(sinc, 5), shoulderMomentNm: vec(M, 3), orthogonalNm: vec(ortho, 3),
    generalizedNm: vec([r.dem.shFwd, r.dem.shSide, r.dem.shRot || 0], 3),
    axes: { elev: vec(elev, 3), hadd: vec(hadd, 3), long: vec(axial, 3) }, muscles }));
}
