import assert from 'node:assert/strict';
import { BODY, DEFAULT_BODY, analyze, createBody, defaultParams, withBody } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const same = createBody();
for (const key of Object.keys(DEFAULT_BODY)) assert.equal(same[key], DEFAULT_BODY[key], `預設 ${key}`);
const small = createBody({ heightM: 1.6, massKg: 60, sex: 'female' });
const tall = createBody({ heightM: 1.9, massKg: 90, sex: 'male' });
const P = defaultParams('squat');
const baseline = analyze('squat', P, 1);
const low = withBody(small, () => analyze('squat', P, 1));
const high = withBody(tall, () => analyze('squat', P, 1));
assert.equal(BODY, DEFAULT_BODY, '正常返回後還原');
assert.equal(low.pose.body, small, '姿勢保留其身體供骨架使用');
assert.ok(low.pose.R.hip[1] < high.pose.R.hip[1], '大腿與小腿長度改變姿勢');
assert.notEqual(low.dem.hipExt, high.dem.hipExt, '質量與長度改變關節力矩');
assert.notEqual(low.dem.hipExt, baseline.dem.hipExt, '女性身體改變力矩');
assert.equal(withBody(small, () => withBody(tall, () => BODY)), tall, '巢狀作用域');
assert.equal(BODY, DEFAULT_BODY, '巢狀返回後還原');
assert.throws(() => withBody(small, () => { throw new Error('預期錯誤'); }), /預期錯誤/);
assert.equal(BODY, DEFAULT_BODY, '發生例外時還原');
assert.throws(() => createBody({ ratios: { Lt: -1 } }), /無效身體比例/);
assert.throws(() => withBody({ ...small, heightM: undefined }, () => {}), /無效身體參數/);
assert.throws(() => withBody({ ...small, mass: 0 }, () => {}), /無效身體參數/);

// 獨立載入一份尚未建立快取的模型，取得小身材硬舉的正確參考值。
const isolated = await import('../src/biomech.js?body-cache-reference');
const deadlift = { ...defaultParams('deadlift'), style: 'conv', start: 0 };
const reference = isolated.withBody(isolated.createBody({ heightM: 1.6, massKg: 60, sex: 'female' }),
  () => isolated.analyze('deadlift', deadlift, 0));
for (const e of [0, 0.5, 1]) analyze('deadlift', deadlift, e);
const afterDefault = withBody(small, () => analyze('deadlift', deadlift, 0));
assert.deepEqual(afterDefault.pose.R, reference.pose.R, '硬舉姿勢不得依先前身材改變');
assert.deepEqual(afterDefault.dem, reference.dem, '硬舉力矩不得依先前身材改變');
assert.equal(afterDefault.pose.ok, reference.pose.ok, '硬舉鏈結狀態一致');
assert.equal(afterDefault.pose.ok, true, '小身材硬舉可解');

// 全清單以各變化式的預設參數掃描，器械可調後兩種身材均須可解。
assert.equal(CATALOG.length, 72);
for (const [label, body] of [['160 cm 女性', small], ['190 cm 男性', tall]]) {
  const failures = [];
  withBody(body, () => {
    for (const item of CATALOG) {
      const params = { ...defaultParams(item.lift), ...item.set };
      const failed = [];
      for (let i = 0; i <= 10; i++) {
        const pose = analyze(item.lift, params, i / 10).pose;
        if (!pose.ok) failed.push(`${i}/10：${pose.conflict || '姿勢無法成立'}`);
      }
      if (failed.length) failures.push(`${item.id}（${failed.join('；')}）`);
    }
  });
  assert.deepEqual(failures.map((entry) => entry.split('（')[0]), [], `${label}的器材姿勢應可成立`);
  console.log(`${label}：${failures.length} / ${CATALOG.length} 項有姿勢失敗${failures.length ? `\n${failures.join('\n')}` : ''}`);
}
console.log('身體參數 API PASS');

// 腰背取矩點：預設 model5cm 不變；其餘兩點隨身高與性別縮放，且可巢狀還原。
{
  const { LUMBAR_POINTS, lumbarOffsetM, lumbarPointName, withLumbarPoint } = await import('../src/biomech.js');
  assert.equal(lumbarPointName(), 'model5cm');
  assert.equal(lumbarOffsetM('model5cm', small), 0.05);
  assert.ok(Math.abs(lumbarOffsetM('iliacCrest', tall) / lumbarOffsetM('iliacCrest', createBody({ heightM: 1.7, sex: 'male' })) - 1.9 / 1.7) < 1e-9);
  assert.ok(lumbarOffsetM('L5S1', createBody({ sex: 'female' })) > lumbarOffsetM('L5S1', createBody({ sex: 'male' })) * 0.99);
  assert.equal(createBody().lumbar.iliacCrest, lumbarOffsetM('iliacCrest', createBody()));
  const Psq = defaultParams('squat');
  const base = analyze('squat', Psq, 1).dem.trunkExt;
  const crest = withLumbarPoint('iliacCrest', () => analyze('squat', Psq, 1).dem.trunkExt);
  assert.notEqual(base, crest);
  assert.equal(analyze('squat', Psq, 1).dem.trunkExt, base, '離開作用域後還原');
  assert.throws(() => withLumbarPoint('x', () => {}), /未知腰背取矩點/);
  assert.equal(Object.keys(LUMBAR_POINTS).length, 3);
}
