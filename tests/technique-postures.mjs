import assert from 'node:assert/strict';
import { analyze, createBody, defaultParams, scapulaLocal, withBody } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const free = new Set(['rdl', 'goodmorning', 'row', 'ohp', 'curl', 'shrug', 'uprow',
  'latraise', 'dbcurl', 'dbreversefly', 'pushdown', 'cablefly']);
function offsetCm(pose) {
  const mid = (pose.R.heel[2] + pose.R.toe[2]) / 2;
  return (pose.cop[2] - mid) * 100;
}
for (const entry of CATALOG.filter((x) => free.has(x.lift))) {
  const P = { ...defaultParams(entry.lift), ...entry.set };
  for (let i = 0; i <= 20; i++) {
    const pose = analyze(entry.lift, P, i / 20).pose;
    assert.ok(pose.ok, `${entry.id} ${i}/20：${pose.conflict}`);
    assert.ok(Math.abs(offsetCm(pose)) < 1, `${entry.id} ${i}/20 壓力中心 ${offsetCm(pose).toFixed(2)} cm`);
  }
  for (const shift of [-3, 3]) {
    const pose = analyze(entry.lift, { ...P, balanceCm: shift }, 0.5).pose;
    assert.ok(Math.abs(offsetCm(pose) - shift) < 0.2, `${entry.id} 重心控制 ${shift} cm 未達設定`);
  }
}

const pushdown = defaultParams('pushdown');
assert.equal(pushdown.footStance, 'staggered');
for (let i = 0; i <= 20; i++) {
  const pose = analyze('pushdown', pushdown, i / 20).pose;
  assert.ok(pose.supportSpan && pose.cop[2] >= pose.supportSpan[0] && pose.cop[2] <= pose.supportSpan[1]);
  assert.ok(pose.phi < 20 * Math.PI / 180, `三頭下壓 ${i}/20 軀幹過度前傾`);
}

const shapes = [
  { heightM: 1.6, massKg: 55, sex: 'female', ratios: { Ls: 0.215, Lt: 0.23, Ltr: 0.32, Lu: 0.17, Lf: 0.19 } },
  { heightM: 1.9, massKg: 95, ratios: { Ls: 0.24, Lt: 0.27, Ltr: 0.285, Lu: 0.16, Lf: 0.185 } },
];
const startAngles = [];
for (const shape of shapes) {
  const body = createBody(shape);
  for (const [style, start] of [['conv', 0], ['conv', -5], ['conv', 10], ['sumo', 0]]) withBody(body, () => {
    const P = { ...defaultParams('deadlift'), style, start };
    const poses = Array.from({ length: 21 }, (_, i) => analyze('deadlift', P, i / 20).pose);
    const startPose = poses.at(-1);
    assert.ok(startPose.ok, `${style} ${body.heightM} m 起槓姿勢不成立`);
    assert.ok(Math.abs(startPose.bar[2] - (startPose.R.heel[2] + startPose.R.toe[2]) / 2) < 0.001);
    const scap = scapulaLocal(startPose.girdle);
    const scapZ = startPose.Pc[2] + startPose.u[2] * scap[1] + startPose.f[2] * scap[2];
    assert.ok(Math.abs(scapZ - startPose.bar[2]) < 0.001, `${style} 肩胛未在槓上方`);
    assert.ok(startPose.R.shoulder[2] > startPose.bar[2], `${style} 肩關節應在槓前方`);
    assert.ok(poses.every((p) => Math.abs(p.bar[2] - startPose.bar[2]) < 1e-6), `${style} 槓路未保持垂直`);
    if (style === 'conv' && P.start === 0) startAngles.push(startPose.phi);
  });
}
assert.ok(Math.abs(startAngles[0] - startAngles[1]) > 10 * Math.PI / 180, '不同身材的起槓角度沒有跟著段長改變');
console.log('站姿 G1 控制與硬舉 H1 身材幾何 PASS');
