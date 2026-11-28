// 新接觸面的力學平衡：墊面與座位的反力須共同承受上肢／身體／器材負重。
import assert from 'node:assert/strict';
import { cross, sub, defaultParams, solvePose, forcesOf } from '../src/biomech.js';

for (const lift of ['preachercurl', 'chestsupportedrow']) {
  const P = defaultParams(lift);
  for (let i = 0; i <= 20; i++) {
    const pose = solvePose(lift, P, i / 20);
    const forces = forcesOf(pose, P, lift);
    assert.ok(pose.ok, `${lift} ${i}/20 姿勢無法成立`);
    const pad = lift === 'preachercurl' ? pose.support.pad : pose.support.chest;
    assert.ok(pad[1] > 0 && pose.support.seat[1] >= 0, `${lift} ${i}/20 接觸面離開或座位需向下拉住身體`);
    const net = [0, 1, 2].map((axis) => forces.reduce((sum, f) => sum + f.F[axis], 0));
    assert.ok(net.every((v) => Math.abs(v) < 1e-6), `${lift} ${i}/20 外力未平衡`);
    const origin = lift === 'preachercurl' ? pose.R.shoulder : pose.R.hip;
    const included = lift === 'preachercurl' ? ['upper', 'fore'] : null;
    const moment = forces.filter((f) => included ? included.includes(f.region) : f.region !== 'pelvis')
      .reduce((sum, f) => sum + cross(sub(f.p, origin), f.F)[0], 0);
    assert.ok(Math.abs(moment) < 1e-6, `${lift} ${i}/20 墊子力矩未平衡`);
  }
}
console.log('新增墊面接觸力與座位反力 PASS');
