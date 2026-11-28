import assert from 'node:assert/strict';
import { defaultParams, solvePose, withBody, createBody } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const benchIds = ['bench', 'incline-bench', 'cg-bench', 'floor-press', 'db-bench', 'db-bench-incline'];
const point = (p) => [p.R.shoulder, p.R.elbow, p.R.hand, p.bar];
for (const id of benchIds) {
  const c = CATALOG.find((x) => x.id === id), base = { ...defaultParams(c.lift), ...c.set };
  const legacy = { ...base, arch: 0, flareMode: 'manual' };
  const omitted = { ...legacy }; delete omitted.arch; delete omitted.flareMode;
  for (const e of [0, 0.5, 1]) {
    assert.deepEqual(point(solvePose(c.lift, omitted, e)), point(solvePose(c.lift, legacy, e)), `${id} 明訂舊參數須重現原幾何`);
  }
  const top = solvePose(c.lift, { ...base, arch: 30 }, 0), bottom = solvePose(c.lift, { ...base, arch: 30 }, 1);
  assert(top.ok && bottom.ok, `${id} 拱背端點可及`);
  assert(bottom.chestArch?.lift > 0, `${id} 應提供胸廓視覺代理`);
  assert(bottom.R.shoulder[1] > solvePose(c.lift, base, 1).R.shoulder[1], `${id} 肩相對凳面應抬高`);
  assert(top.bar[1] - bottom.bar[1] < solvePose(c.lift, base, 0).bar[1] - solvePose(c.lift, base, 1).bar[1], `${id} 槓行程應縮短`);
}
for (const body of [createBody({ heightM: 1.5, massKg: 50, sex: 'female' }), createBody({ heightM: 2, massKg: 110, sex: 'male' })]) {
  withBody(body, () => {
    const p = { ...defaultParams('bench'), arch: 30, flareMode: 'vertical' };
    for (let i = 0; i <= 20; i++) assert(solvePose('bench', p, i / 20).ok, '新模式整段須可及');
  });
}
const base = defaultParams('bench');
const tilt = (p) => {
  const v = p.R.hand.map((x, i) => x - p.R.elbow[i]);
  return Math.hypot(v[0], v[2]) / Math.hypot(...v);
};
const abduction = (p) => {
  const v = p.R.elbow.map((x, i) => x - p.R.shoulder[i]);
  return Math.asin(v[0] / Math.hypot(...v));
};
for (const grip of [1.2, 1.6, 2]) {
  const manual = solvePose('bench', { ...base, grip }, 1);
  const vertical = solvePose('bench', { ...base, grip, flareMode: 'vertical' }, 1);
  assert(vertical.ok && tilt(vertical) <= tilt(manual) + 1e-12, '幾何模式應使底點前臂更接近垂直');
}
const narrow = solvePose('bench', { ...base, grip: 1.2, flareMode: 'vertical' }, 1);
const wide = solvePose('bench', { ...base, grip: 2, flareMode: 'vertical' }, 1);
assert(abduction(wide) > abduction(narrow), '幾何模式的寬握應增加肩外展');
console.log('bench gaps PASS');
