import assert from 'node:assert/strict';
import { analyze, createBody, defaultParams, withBody } from '../src/biomech.js';
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

for (const shape of [
  { heightM: 1.6, massKg: 55, sex: 'female', ratios: { Ls: 0.215, Lt: 0.23, Ltr: 0.32, Lu: 0.17, Lf: 0.19 } },
  { heightM: 1.9, massKg: 95, ratios: { Ls: 0.24, Lt: 0.27, Ltr: 0.285, Lu: 0.16, Lf: 0.185 } },
]) {
  const body = createBody(shape);
  for (const style of ['conv', 'sumo']) withBody(body, () => {
    const P = { ...defaultParams('deadlift'), style };
    const poses = Array.from({ length: 21 }, (_, i) => analyze('deadlift', P, i / 20).pose);
    const start = poses.at(-1);
    assert.ok(start.ok, `${style} ${body.heightM} m 起槓姿勢不成立`);
    assert.ok(Math.abs(start.bar[2] - (start.R.heel[2] + start.R.toe[2]) / 2) < 0.001);
    assert.ok(Math.abs(start.R.shoulder[2] - start.bar[2]) < 0.005);
    assert.ok(poses.every((p) => Math.abs(p.bar[2] - start.bar[2]) < 1e-6), `${style} 槓路未保持垂直`);
  });
}
console.log('站姿 G1 控制與硬舉 H1 身材幾何 PASS');
