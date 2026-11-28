// 深蹲族姿勢隨骨長改變（方案 A）與個人踝背屈上限的行為檢查。
import assert from 'node:assert/strict';
import { DEFAULT_BODY, SQUAT_ANATOMY_LAMBDA, createBody, defaultParams, solvePose, withAnatomyLambdaForValidation, withBody } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const deg = (x) => x * 180 / Math.PI;
const keys = ['Ls', 'Lt', 'Ltr', 'Lu', 'Lf', 'hipHalf', 'shHalf', 'ankleH'];
// 單節段比例變動 ±5%（身高固定）；只用來檢查方向與可行性，不是群體分布。
const scaled = (changes) => createBody({ heightM: 1.75, massKg: 75, ratios: Object.fromEntries(keys.map((k) =>
  [k, DEFAULT_BODY[k] / 1.75 * (1 + (changes[k] || 0))])) });
const entry = (id) => CATALOG.find((c) => c.id === id);
const params = (id, extra = {}) => ({ ...defaultParams(entry(id).lift), ...entry(id).set, ...extra });
const shank = (p) => deg(Math.atan2(p.R.knee[2] - p.R.ankle[2], p.R.knee[1] - p.R.ankle[1])) - deg(p.heelTiltRad || 0);
const at = (body, id, e, extra) => withBody(body, () => solvePose(entry(id).lift, params(id, extra), e));
const ref = createBody(), longFemur = scaled({ Lt: 0.05 }), shortFemur = scaled({ Lt: -0.05 });

assert.equal(SQUAT_ANATOMY_LAMBDA, 1);
for (const id of ['squat-high', 'squat-low', 'front-squat', 'goblet-squat']) {
  for (const e of [0.25, 0.5, 0.75, 1]) {
    // 預設身體：與 _dTh = 0 的原策略逐值相同
    const a = at(ref, id, e), b = at(ref, id, e, { _dTh: 0 });
    assert.deepEqual(a.R.knee, b.R.knee, `${id} ${e}：預設身體膝位置改變`);
    assert.equal(a.phi, b.phi, `${id} ${e}：預設身體軀幹角改變`);
    // 方向：長股骨 → 小腿與軀幹都不小於預設；短股骨反之
    const L = at(longFemur, id, e), S = at(shortFemur, id, e);
    assert.ok(shank(L) >= shank(a) - 1e-6 && L.phi >= a.phi - 1e-6, `${id} ${e}：長股骨方向錯誤`);
    assert.ok(shank(S) <= shank(a) + 1e-6 && S.phi <= a.phi + 1e-6, `${id} ${e}：短股骨方向錯誤`);
    // λ → 大：回到舊行為（小腿角不隨骨長）
    const old = withAnatomyLambdaForValidation(1e6, () => at(longFemur, id, e));
    assert.ok(Math.abs(shank(old) - shank(a)) < 0.01, `${id} ${e}：大 λ 未回到固定小腿角`);
  }
  // 預設身體上限關閉等於未設定
  assert.equal(at(ref, id, 1, { ankleDfCap: 'off' }).phi, at(ref, id, 1).phi);
  // 上限：小腿前傾（相對足板）不超過上限，軀幹吸收剩餘，並有提示
  for (const body of [ref, longFemur]) {
    const free = at(body, id, 1), capped = at(body, id, 1, { ankleDfCap: '25' });
    assert.ok(shank(capped) <= 25.06, `${id}：踝背屈超過上限 ${shank(capped)}`);
    assert.ok(shank(free) > 25.06 && capped.phi > free.phi, `${id}：上限未使軀幹增加`);
    assert.ok(capped.ankleCapBinding && capped.warn.some((w) => w.includes('踝背屈已到你設定的上限')), `${id}：缺上限提示`);
    assert.ok(capped.ok || capped.conflict.includes('個人踝背屈上限'), `${id}：不可行時須說明上限`);
  }
}
// 極端比例：高腳杯行程中段原本不可行（軀幹 85° 上限），分配後可行
const extreme = scaled({ Lt: 0.05, Ltr: -0.05, Ls: -0.04 });
assert.ok(at(extreme, 'goblet-squat', 0.75).ok, '極端比例高腳杯應可行');
// 其他動作不受影響：硬舉、早安、RDL 不讀此參數
for (const id of ['deadlift', 'good-morning', 'rdl']) {
  const a = withBody(longFemur, () => solvePose(entry(id).lift, params(id), 1)), b = withBody(longFemur, () => solvePose(entry(id).lift, params(id, { ankleDfCap: '25' }), 1));
  assert.equal(a.phi, b.phi);
}
console.log('深蹲族依骨長分配小腿與軀幹、個人踝背屈上限 PASS');
