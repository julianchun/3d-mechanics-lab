// 固定種子群體模擬；準則見 docs/research/methods.md。
import fs from 'node:fs';
import { BODY, DEFAULT_BODY, BAR_RATIO, MODEL_VERSION, analyze, createBody, defaultParams, solvePose, withBody, withLumbarPoint } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const mode = process.argv[2] ?? '';
if (!['', '--check'].includes(mode) || process.argv.length > 3) throw new Error('用法：node tools/validate-population.mjs [--check]');
const path = new URL('../validation/', import.meta.url);
const output = new URL('population-results.json', path);
// 舊研究維持原抽樣順序，使深蹲的固定種子結果逐筆不變。
const sourceNames = ['gorsic-2020', 'gullett-2009', 'hutchison-2019', 'larsen-2021',
  'escamilla-2000', 'henning-2023', 'lee-2018'];
const source = Object.fromEntries(sourceNames.map((name) => [name, JSON.parse(fs.readFileSync(new URL(`${name}.json`, path)))]));
const old = JSON.parse(fs.readFileSync(new URL('results.json', path)));
const oldById = new Map(old.comparisons.map((c) => [c.id, c]));
const anthro = JSON.parse(fs.readFileSync(new URL('anthropometry/ansur-ii-ratios.json', path)));
const catalog = new Map(CATALOG.map((c) => [c.id, c]));
const N = 200, SEED = 0x19b0d9;
const round = (x) => Number(x.toFixed(4));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => Math.sqrt(xs.reduce((a, b) => a + (b - mean(xs)) ** 2, 0) / (xs.length - 1));
const maleMean = anthro.keys.map((_, j) => mean(anthro.male.map((r) => r[j])));
const proxySd = Object.fromEntries(['male', 'female'].map((sex) => [sex,
  anthro.keys.map((_, j) => sd(anthro[sex].map((r) => r[j]))) ]));
let state = SEED;
function random() { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }
function normal() { return Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(2 * Math.PI * random()); }
function truncated(meanValue, std, min, max) {
  if (!Number.isFinite(meanValue) || !Number.isFinite(std)) throw new Error('研究身高／體重平均與標準差不足');
  for (let i = 0; i < 100; i++) {
    const x = meanValue + std * normal();
    if (x >= min && x <= max && Math.abs(x - meanValue) <= 3 * std) return x;
  }
  throw new Error('截斷常態抽樣失敗');
}
function sexCounts(participants) {
  if (participants.sex === '全男') return [participants.n, 0];
  const male = Number(participants.sex?.match(/(\d+)\s*男/)?.[1]);
  const female = Number(participants.sex?.match(/(\d+)\s*女/)?.[1]);
  if (!Number.isFinite(male) || !Number.isFinite(female) || male + female !== participants.n) throw new Error('性別比例缺少或與人數不符');
  return [male, female];
}
function bodyFromRow(sex, row, heightM, massKg) {
  const ratios = Object.fromEntries(anthro.keys.map((key, j) => [key,
    DEFAULT_BODY[key] / DEFAULT_BODY.heightM * row[j] / maleMean[j]]));
  return createBody({ heightM, massKg, sex, ratios });
}
function sampleBodies(participants) {
  const [male, female] = sexCounts(participants), maleN = Math.round(N * male / (male + female));
  const sexes = Array.from({ length: N }, (_, i) => i < maleN ? 'male' : 'female');
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [sexes[i], sexes[j]] = [sexes[j], sexes[i]]; }
  return sexes.map((sex) => {
    const rows = anthro[sex], row = rows[Math.floor(random() * rows.length)];
    return bodyFromRow(sex, row,
      truncated(participants.heightM.mean, participants.heightM.sd, 1.2, 2.3),
      truncated(participants.massKg.mean, participants.massKg.sd, 25, 250));
  });
}
const deg = (x) => x * 180 / Math.PI;
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const norm = (a) => { const n = Math.hypot(...a); return a.map((v) => v / n); };
const clamp = (x) => Math.max(-1, Math.min(1, x));
function angles(p) {
  const thigh = sub(p.R.knee, p.R.hip), shank = sub(p.R.ankle, p.R.knee), upShank = shank.map((v) => -v);
  return { trunkInclination: deg(p.phi), hipFlexion: deg(Math.atan2(dot(thigh, p.f), dot(thigh, p.u.map((x) => -x)))),
    kneeFlexion: deg(Math.acos(clamp(dot(norm(thigh), norm(shank))))),
    ankleDorsiflexion: deg(Math.atan2(dot(upShank, p.toeDir), p.footUp ? dot(upShank, p.footUp) : upShank[1])) };
}
function thighAngle(p) { const v = sub(p.R.knee, p.R.hip); return deg(Math.atan2(Math.abs(v[2]), -v[1])); }
function bisectSample(target, fn) {
  const low = fn(0), high = fn(1);
  if (!(low <= target && target <= high)) throw new Error(`行程未經過 ${target}°（${round(low)}–${round(high)}°）`);
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (fn(mid) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function withLoad(lift, loadRatio, fn) {
  if (loadRatio === null) return fn();
  const before = BAR_RATIO[lift]; BAR_RATIO[lift] = loadRatio;
  try { return fn(); } finally { BAR_RATIO[lift] = before; }
}
const dof = { hipExtensionMoment: 'hipExt', kneeExtensionMoment: 'kneeExt',
  anklePlantarflexionMoment: 'ankPF', lumbarExtensionMoment: 'trunkExt' };
// momentPoint 為研究定義的腰背取矩點；未註記者維持產品預設點。
function measureValue(lift, m, params, cache) {
  return withLumbarPoint(m.momentPoint ?? 'model5cm', () => measureValueAtPoint(lift, m, params, cache));
}
function measureValueAtPoint(lift, m, params, cache) {
  if (m.metric === 'pelvisAnteriorTilt') return null;
  const at = (e) => { if (!cache.has(e)) cache.set(e, analyze(lift, params, e)); return cache.get(e); };
  const poseAt = (e) => at(e).pose;
  let value;
  if (m.sample.type === 'fullRange') {
    value = (poseAt(0).bar[1] - poseAt(1).bar[1]) / BODY.heightM * 100;
  } else if (m.sample.type === 'peak') {
    const end = m.sample.endKneeFlexionDeg === undefined ? 1 :
      bisectSample(m.sample.endKneeFlexionDeg, (e) => angles(poseAt(e)).kneeFlexion);
    value = -Infinity;
    for (let i = 0; i <= 400; i++) value = Math.max(value, at(end * i / 400).dem[dof[m.metric]]);
  } else {
    let e;
    if (m.sample.type === 'bottom' || m.sample.type === 'liftOff') e = 1;
    else if (m.sample.type === 'kneePassing') {
      const delta = (t) => poseAt(t).bar[1] - poseAt(t).R.knee[1];
      if (!(delta(0) >= 0 && delta(1) <= 0)) throw new Error('槓未經過膝中心高度');
      let lo = 0, hi = 1;
      for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (delta(mid) > 0) lo = mid; else hi = mid; }
      e = (lo + hi) / 2;
    } else e = bisectSample(m.sample.targetDeg, (t) => thighAngle(poseAt(t)));
    const r = at(e);
    if (!r.pose.ok) throw new Error(r.pose.conflict || '姿勢失敗');
    value = dof[m.metric] ? r.dem[dof[m.metric]] : angles(r.pose)[m.metric];
  }
  if (m.modelFactor !== undefined) value *= m.modelFactor;
  if (m.normalization === 'massHeight') value /= BODY.mass * BODY.heightM;
  else if (m.normalization === 'mass') value /= BODY.mass;
  else if (m.normalization !== undefined) throw new Error('未知正規化');
  if (!Number.isFinite(value)) throw new Error('非有限數值');
  return value;
}
function referenceValue(m) {
  if (m.referenceTransform === 'minus90') return m.reference.mean - 90;
  if (m.referenceTransform === 'absolute') return Math.abs(m.reference.mean);
  if (m.referenceTransform === 'negate') return -m.reference.mean;
  return m.reference.mean;
}
const bodiesBySource = Object.fromEntries(sourceNames.filter((name) => source[name].participants.heightM)
  .map((name) => [name, sampleBodies(source[name].participants)]));
const comparisons = [], summaries = {};
for (const name of sourceNames) {
  const study = source[name];
  for (const condition of study.conditions) {
    const entry = catalog.get(condition.catalogId);
    const bodies = condition.participants ? sampleBodies(condition.participants) : bodiesBySource[name];
    const params = { ...defaultParams(entry.lift), ...entry.set, ...condition.params };
    const values = condition.measurements.map(() => []), values5 = condition.measurements.map(() => []), errors = [];
    for (const body of bodies) {
      try {
        withBody(body, () => withLoad(entry.lift, condition.loadRatio, () => {
          const cache = new Map();
          condition.measurements.forEach((m, j) => {
            const value = measureValue(entry.lift, m, params, cache); if (value !== null) values[j].push(value);
            if (m.momentPoint) values5[j].push(measureValue(entry.lift, { ...m, momentPoint: undefined }, params, new Map()));
          });
        }));
      } catch (error) { errors.push(error.message); }
    }
    // 整個人的條件須成立，避免各指標使用不同人數。
    if (errors.length) throw new Error(`${name}/${condition.id} 有 ${errors.length} 個人姿勢失敗；首例：${errors[0]}`);
    condition.measurements.forEach((m, j) => {
      const id = `${name}/${condition.id}/${m.id}`, prior = oldById.get(id);
      if (!prior) throw new Error(`找不到舊固定身體比對：${id}`);
      const category = m.comparisonRole ?? 'comparable', reference = category === 'definition-mismatch' ? null : referenceValue(m);
      const modelMean = values[j].length ? round(mean(values[j])) : null;
      const modelSd = values[j].length ? round(sd(values[j])) : null;
      const pass = category === 'comparable' ? Math.abs(modelMean - reference) <= m.reference.sd : null;
      comparisons.push({ id, category, unit: m.reference.unit, oldModel: prior.model, oldStatus: prior.status,
        ...(m.momentPoint ? { momentPoint: m.momentPoint, modelMeanAt5cm: round(mean(values5[j])) } : {}),
        modelMean, modelSd, referenceMean: reference, referenceSd: m.reference.sd,
        newStatus: category === 'comparable' ? (pass ? 'pass' : 'fail') : category, pass,
        sampleN: values[j].length });
    });
  }
  const rows = comparisons.filter((c) => c.id.startsWith(`${name}/`) && c.category === 'comparable');
  summaries[name] = { pass: rows.filter((c) => c.pass).length, comparable: rows.length };
}

// 股骨代理長度 ±1 個 ANSUR II 標準差；同一群人、同一條件配對比較。
const sensitivityIds = [
  'gorsic-2020/straight-back/lumbar', 'gorsic-2020/straight-front/trunk',
  'gullett-2009/front/peak-knee', 'larsen-2021/high-wide/trunk',
];
const sensitivity = sensitivityIds.map((id) => {
  const [name, conditionId, measureId] = id.split('/'), condition = source[name].conditions.find((c) => c.id === conditionId);
  const m = condition.measurements.find((x) => x.id === measureId), entry = catalog.get(condition.catalogId);
  const params = { ...defaultParams('squat'), ...entry.set, ...condition.params };
  const run = (direction) => mean(bodiesBySource[name].map((body) => {
    const ratioChange = proxySd[body.sex][anthro.keys.indexOf('Lt')] / maleMean[anthro.keys.indexOf('Lt')];
    const changed = createBody({ heightM: body.heightM, massKg: body.mass, sex: body.sex,
      ratios: Object.fromEntries(anthro.keys.map((key) => [key, key === 'Lt' ?
        body.Lt / body.heightM * (1 + direction * ratioChange) : body[key] / body.heightM])) });
    return withBody(changed, () => withLoad('squat', condition.loadRatio, () => measureValue('squat', m, params, new Map())));
  }));
  return { id, shortThigh: round(run(-1)), population: comparisons.find((c) => c.id === id).modelMean,
    longThigh: round(run(1)) };
});

// Demers 圖讀六點只診斷：原文未報身高、體重；直接用表 1 的節段長度平均 ±SD。
const demers = JSON.parse(fs.readFileSync(new URL('calibration/demers-2018.json', path)));
const demersBodies = Array.from({ length: N }, (_, i) => {
  const sex = i < 125 ? 'male' : 'female'; // 20/32 與 12/32
  const row = anthro[sex][Math.floor(random() * anthro[sex].length)];
  const proxy = bodyFromRow(sex, row, 1.75, 75);
  const means = { Ltr: 0.54, Lt: 0.40, Ls: 0.40 };
  const ratios = Object.fromEntries(anthro.keys.map((key) => [key, key in means ?
    Math.max(0.3, means[key] + 0.03 * (row[anthro.keys.indexOf(key)] - mean(anthro[sex].map((r) => r[anthro.keys.indexOf(key)]))) /
      proxySd[sex][anthro.keys.indexOf(key)]) / 1.75 : proxy[key] / 1.75]));
  return createBody({ heightM: 1.75, massKg: 75, sex, ratios });
});
const calibration = demers.conditions.flatMap((condition) => {
  const params = { ...defaultParams('squat'), ...condition.params };
  return condition.measurements.map((m) => {
    const xs = demersBodies.map((body) => withBody(body, () => withLoad('squat', 0, () => {
      const e = bisectSample(m.sample.targetDeg, (t) => thighAngle(solvePose('squat', params, t)));
      return angles(solvePose('squat', params, e)).ankleDorsiflexion - angles(solvePose('squat', params, 0)).ankleDorsiflexion;
    })));
    return { condition: condition.id, thighDeg: m.sample.targetDeg, modelMean: round(mean(xs)), modelSd: round(sd(xs)),
      referenceApprox: m.reference.mean, figureTolerance: m.tolerance.absolute,
      withinFigureTolerance: Math.abs(mean(xs) - m.reference.mean) <= m.tolerance.absolute };
  });
});
const comparable = comparisons.filter((c) => c.category === 'comparable');
const result = { modelVersion: MODEL_VERSION, seed: SEED, virtualN: N,
  source: 'ANSUR II 2012', criterion: '|模型群體平均−研究平均| ≤ 研究個體標準差',
  summary: { pass: comparable.filter((c) => c.pass).length, comparable: comparable.length, byStudy: summaries },
  comparisons, sensitivity, calibration };
const serialized = JSON.stringify(result, null, 2) + '\n';
if (mode === '--check') {
  if (fs.readFileSync(output, 'utf8') !== serialized) throw new Error('群體結果與固定種子重算不一致');
} else fs.writeFileSync(output, serialized);
console.log(`群體驗證 ${result.summary.pass}/${result.summary.comparable}；舊固定身體 ${old.summary.pass}/${old.summary.count}；Demers 診斷 ${calibration.filter((r) => r.withinFigureTolerance).length}/${calibration.length}`);
