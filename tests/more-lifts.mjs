// 新接觸面的力學平衡：墊面與座位的反力須共同承受上肢／身體／器材負重。
import assert from 'node:assert/strict';
import { BODY, analyze, cross, dot, sub, defaultParams, solvePose, forcesOf } from '../src/biomech.js';

for (const lift of ['preachercurl', 'chestsupportedrow']) {
  const P = defaultParams(lift);
  for (let i = 0; i <= 20; i++) {
    const pose = solvePose(lift, P, i / 20);
    const forces = forcesOf(pose, P, lift);
    assert.ok(pose.ok, `${lift} ${i}/20 姿勢無法成立`);
    const pad = lift === 'preachercurl' ? pose.support.pad : pose.support.chest;
    assert.ok(pad[1] > 0 && pose.support.seat[1] >= 0, `${lift} ${i}/20 接觸面離開或座位需向下拉住身體`);
    if (lift === 'preachercurl') {
      const n = pose.padNormal;
      assert.ok(Math.abs(cross(pad, n)[0]) < 1e-8 && dot(pad, n) >= 0,
        `${lift} ${i}/20 墊面反力未沿法向或出現拉力`);
      assert.ok(pad[2] > 0, `${lift} ${i}/20 墊面反力缺少前向分量`);
    }
    const net = [0, 1, 2].map((axis) => forces.reduce((sum, f) => sum + f.F[axis], 0));
    assert.ok(net.every((v) => Math.abs(v) < 1e-6), `${lift} ${i}/20 外力未平衡`);
    const origin = lift === 'preachercurl' ? pose.R.shoulder : pose.R.hip;
    const included = lift === 'preachercurl' ? ['upper', 'fore'] : null;
    const moment = forces.filter((f) => included ? included.includes(f.region) : f.region !== 'pelvis')
      .reduce((sum, f) => sum + cross(sub(f.p, origin), f.F)[0], 0);
    assert.ok(Math.abs(moment) < 1e-6, `${lift} ${i}/20 墊子力矩未平衡`);
  }
}
// 繩索後拉的握點應隨肩部移動，近直臂懸在兩腿間；低滑輪對髖產生實際力臂。
const pull = defaultParams('cablepullthrough');
let topHandZ;
for (const e of [0, 0.5, 1]) {
  const r = analyze('cablepullthrough', pull, e), p = r.pose;
  assert.ok(p.ok && p.armOk, `滑輪後拉 ${e} 手臂不可達`);
  const upper = sub(p.R.elbow, p.R.shoulder), fore = sub(p.R.hand, p.R.elbow);
  const armLength = Math.hypot(...sub(p.R.hand, p.R.shoulder));
  const elbowFlex = Math.acos(dot(upper, fore) / (BODY.Lu * BODY.Lf)) * 180 / Math.PI;
  assert.ok(armLength < BODY.Lu + BODY.Lf && elbowFlex < 20,
    `滑輪後拉 ${e} 手肘未維持微彎`);
  assert.ok(p.R.hand[0] < p.R.shoulder[0] && p.R.hand[0] > 0 && p.R.hand[1] < p.R.shoulder[1],
    `滑輪後拉 ${e} 握點未垂於兩腿間`);
  assert.ok(p.pulley[2] < p.R.hand[2] && p.pulley[1] < p.R.hand[1],
    `滑輪後拉 ${e} 鋼索未指向後下方`);
  if (e === 0) topHandZ = p.R.hand[2];
  if (e === 1) assert.ok(p.R.hand[2] > topHandZ + 0.08,
    '滑輪後拉握點未隨髖鉸鏈向前移動');
  const cable = forcesOf(p, pull, 'cablepullthrough').find((f) => f.ext);
  const hipMoment = cross(sub(cable.p, p.R.hip), cable.F)[0];
  assert.ok(Math.abs(Math.hypot(cable.F[1], cable.F[2]) - pull.load * 9.81 / 4) < 1e-6,
    `滑輪後拉 ${e} 繩索張力與滑輪比不符`);
  assert.ok(Math.abs(hipMoment) > (e === 1 ? 25 : 10) && Math.abs(hipMoment) < 0.6 * pull.load * 9.81,
    `滑輪後拉 ${e} 繩索對髖的力臂異常：${hipMoment}`);
}
for (const lift of ['cableoverheadext', 'dboverheadext']) {
  const p = solvePose(lift, defaultParams(lift), 1);
  assert.ok(p.R.hand[2] < p.R.elbow[2] && p.R.hand[2] < p.R.shoulder[2] && p.R.hand[1] > p.R.shoulder[1],
    `${lift} 底點握點未在頭後`);
}
for (const lift of ['dboverheadext', 'dbpullover']) {
  const dem = analyze(lift, defaultParams(lift), 1).dem;
  assert.ok(Math.abs(dem.shSide) > Math.abs(dem.shFwd) && Math.abs(dem.shSide) > 10,
    `${lift} 未計入主要肩外展需求`);
}
console.log('新動作接觸力、握點與肩部需求 PASS');
