import assert from 'node:assert/strict';
import { analyze, BODY, createBody, defaultParams, scapulaLocal, withBody } from '../src/biomech.js';
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

// 滑桿的每個身材／端點都要兌現；若幾何碰到界線，必須明確說明實際偏移。
const balanceBodies = [null, createBody({ heightM: 1.5, massKg: 50, sex: 'female' }),
  createBody({ heightM: 2, massKg: 110, sex: 'male' })];
for (const body of balanceBodies) {
  const check = () => {
    for (const entry of CATALOG.filter((x) => free.has(x.lift))) {
      const base = { ...defaultParams(entry.lift), ...entry.set };
      for (const shift of [-8, 0, 8]) for (let i = 0; i <= 20; i++) {
        const pose = analyze(entry.lift, { ...base, balanceCm: shift }, i / 20).pose;
        const error = Math.abs(offsetCm(pose) - shift);
        assert.ok(error <= 1 || pose.warn.some((w) => w.includes('重心設定') && w.includes('實際偏移')),
          `${body?.heightM ?? 1.75} m ${entry.id} ${shift} cm ${i}/20：實際 ${offsetCm(pose).toFixed(2)} cm，無警告`);
      }
    }
  };
  body ? withBody(body, check) : check();
}
const beyond = analyze('rdl', { ...defaultParams('rdl'), balanceCm: 30 }, 0.5).pose;
assert.ok(beyond.warn.some((w) => w.includes('重心設定 30.0 cm') && w.includes('實際偏移')),
  '超出可行槓位時應顯示實際達成的重心偏移');

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

// H1／H2：四式硬舉在槓過膝之前維持起槓軀幹角；用關節幾何判斷事件，不指定行程百分比。
for (const id of ['deadlift', 'deficit-dl', 'block-pull', 'sumo']) {
  const entry = CATALOG.find((x) => x.id === id);
  const P = { ...defaultParams(entry.lift), ...entry.set };
  const start = analyze('deadlift', P, 1).pose.phi;
  for (let i = 0; i <= 40; i++) {
    const pose = analyze('deadlift', P, i / 40).pose;
    if (pose.bar[1] < pose.R.knee[1] - 0.01)
      assert.ok(Math.abs(pose.phi - start) < Math.PI / 180, `${id} 過膝前軀幹角未維持`);
  }
}
const smithDefault = defaultParams('smith');
const smithSamples = Array.from({ length: 41 }, (_, i) => analyze('smith', smithDefault, i / 40));
assert.ok(smithSamples.every((r) => Math.abs(r.pose.support.N[2]) < 0.02 * BODY.mass * 9.81), '史密斯滑軌水平支撐力過高');
const pressDefault = defaultParams('legpress');
const pressSamples = Array.from({ length: 41 }, (_, i) => analyze('legpress', pressDefault, i / 40));
assert.ok(pressSamples.every((r) => r.q.hipFlex * 180 / Math.PI <= 136 && r.q.ankleDorsi * 180 / Math.PI <= 39), '腿推預設超過模型髖／踝參考線');
console.log('站姿 G1、硬舉 H1／H2 與器械預設幾何 PASS');
