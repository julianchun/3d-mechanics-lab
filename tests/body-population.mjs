import assert from 'node:assert/strict';
import { analyze, createBody, defaultParams, withBody } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const bodies = [
  createBody({ heightM: 1.5, massKg: 50, sex: 'female' }),
  createBody(),
  createBody({ heightM: 2, massKg: 110, sex: 'male' }),
];
const finite = (value) => typeof value === 'number' ? Number.isFinite(value)
  : !value || typeof value !== 'object' ? true : Object.values(value).every(finite);
const stats = [];
for (const body of bodies) withBody(body, () => {
  let healthy = 0, warned = 0;
  const warnings = new Set();
  for (const entry of CATALOG) {
    const P = { ...defaultParams(entry.lift), ...entry.set };
    for (let i = 0; i <= 20; i++) {
      const pose = analyze(entry.lift, P, i / 20).pose;
      if (pose.ok && finite(pose) && pose.armOk !== false) healthy++;
      else {
        assert.ok(pose.warn.some((w) => /[\u3400-\u9fff]/u.test(w)), `${body.heightM} m ${entry.id} ${i}/20：無繁中警告`);
        warned++;
        warnings.add(entry.id);
      }
      if (body.heightM === 1.5 && ['pec-deck', 'reverse-deck', 'calf-raise-standing'].includes(entry.id))
        assert.ok(pose.ok, `${entry.id} 矮身材應能藉器械調整完成行程：${pose.conflict}`);
    }
  }
  assert.equal(healthy + warned, 63 * 21);
  stats.push(`${body.heightM} m：正常 ${healthy}，有警告 ${warned}；${[...warnings].join('、') || '無'}`);
});

for (const lean of [0, 15]) {
  const P = { ...defaultParams('dips'), lean };
  let previous = -Infinity;
  for (let i = 0; i <= 20; i++) {
    const { pose, q } = analyze('dips', P, i / 20);
    const extension = -q.shFlex * 180 / Math.PI;
    assert.ok(pose.R.elbow[1] < pose.R.shoulder[1], `雙槓 ${lean}° ${i}/20：手肘高於肩`);
    assert.ok(extension >= previous - 0.01, `雙槓 ${lean}° ${i}/20：肩後伸不連續`);
    assert.ok(Math.abs(pose.R.elbow[2] - pose.R.hand[2]) / (pose.R.elbow[1] - pose.R.hand[1]) < 0.6,
      `雙槓 ${lean}° ${i}/20：前臂過度傾斜`);
    previous = extension;
  }
  assert.ok(Math.abs(previous - 50) < 0.1, `雙槓 ${lean}° 最低點應約 50° 肩後伸`);
}
console.log(`三種身材 × 63 項 × 21 點 PASS；${stats.join('；')}`);
