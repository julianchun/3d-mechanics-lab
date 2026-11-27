// 以事先固定的文獻數值與容許誤差比對動作；FAIL 是研究結果，不讓測試程序中斷。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAR_RATIO, BODY, HEEL_SHANK_SHARE, MODEL_VERSION, analyze, defaultParams, solvePose, withHeelShankShareForValidation, withLumbarPoint } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';
import trendStatus from '../src/trend-status.json' with { type: 'json' };

const root = fileURLToPath(new URL('../', import.meta.url));
const validationDir = path.join(root, 'validation');
const resultsPath = path.join(validationDir, 'results.json');
const statusPath = path.join(root, 'src/validation-status.json');
const figurePath = path.join(root, 'docs/research/results/squat-curves.svg');
const mode = process.argv[2] ?? '';
if (!['', '--check', '--write-status', '--heel-share-sweep'].includes(mode) || process.argv.length > 3) {
  throw new Error('用法：node tools/validate-sim.mjs [--check|--write-status|--heel-share-sweep]');
}

const deg = (v) => v * 180 / Math.PI;
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const clamp = (v) => Math.max(-1, Math.min(1, v));
const round = (v) => Number(v.toFixed(4));
const metricLayer = {
  trunkInclination: 'kinematics', pelvisAnteriorTilt: 'kinematics', hipFlexion: 'kinematics', kneeFlexion: 'kinematics', ankleDorsiflexion: 'kinematics',
  barVerticalTravelPctHeight: 'kinematics',
  hipExtensionMoment: 'moments', kneeExtensionMoment: 'moments', anklePlantarflexionMoment: 'moments', lumbarExtensionMoment: 'moments',
};
const momentDof = { hipExtensionMoment: 'hipExt', kneeExtensionMoment: 'kneeExt', anklePlantarflexionMoment: 'ankPF', lumbarExtensionMoment: 'trunkExt' };

function angles(pose) {
  const { hip, knee, ankle } = pose.R;
  const thigh = sub(knee, hip), shank = sub(ankle, knee), upShank = shank.map((x) => -x);
  const downTrunk = pose.u.map((x) => -x);
  return {
    trunkInclination: deg(pose.phi),
    hipFlexion: deg(Math.atan2(dot(thigh, pose.f), dot(thigh, downTrunk))),
    kneeFlexion: deg(Math.acos(clamp(dot(norm(thigh), norm(shank))))),
    ankleDorsiflexion: deg(Math.atan2(dot(upShank, pose.toeDir), pose.footUp ? dot(upShank, pose.footUp) : upShank[1])),
  };
}

function thighAngle(pose) {
  const v = sub(pose.R.knee, pose.R.hip);
  // Goršič 等人用矢狀面 2D 股骨角，不能把模型的髖外展 X 分量算進去。
  return deg(Math.atan2(Math.abs(v[2]), -v[1]));
}

function sampleE(lift, type, sample, params) {
  if (type === 'bottom' || type === 'liftOff') return 1;
  if (type === 'kneePassing') {
    if (lift !== 'deadlift') throw new Error('過膝事件只適用硬舉');
    const delta = (e) => { const p = solvePose(lift, params, e); return p.bar[1] - p.R.knee[1]; };
    if (!(delta(0) >= 0 && delta(1) <= 0)) throw new Error('槓未經過膝中心高度');
    let lo = 0, hi = 1;
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (delta(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  if (type === 'parallelThigh') {
    const target = sample.targetDeg;
    if (!Number.isFinite(target) || target <= 0 || target >= 180) throw new Error('parallelThigh.targetDeg 無效');
    const loAngle = thighAngle(solvePose('squat', params, 0));
    const hiAngle = thighAngle(solvePose('squat', params, 1));
    if (!(loAngle <= target && target <= hiAngle)) throw new Error(`模型行程未經過股骨 ${target}°（${round(loAngle)}–${round(hiAngle)}°）`);
    let lo = 0, hi = 1;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (thighAngle(solvePose('squat', params, mid)) < target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  throw new Error(`未支援 sample.type：${type}`);
}

function withLoad(lift, loadRatio, run) {
  if (loadRatio === null) return run();
  if (!Number.isFinite(loadRatio) || loadRatio <= 0) throw new Error(`無效 loadRatio：${loadRatio}`);
  const original = BAR_RATIO[lift];
  try {
    BAR_RATIO[lift] = loadRatio;
    return run();
  } finally {
    BAR_RATIO[lift] = original;
  }
}

function peakEndE(sample, params) {
  if (sample.endKneeFlexionDeg === undefined) return 1;
  const target = sample.endKneeFlexionDeg;
  if (!Number.isFinite(target) || target <= 0 || target >= 180) throw new Error('endKneeFlexionDeg 無效');
  const at = (e) => angles(solvePose('squat', params, e)).kneeFlexion;
  if (!(at(0) <= target && target <= at(1))) throw new Error(`模型行程未經過方法膝角 ${target}°`);
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// 研究定義的腰背取矩點（momentPoint）只用於重算模型值，不改產品設定；未註記者維持產品預設點。
function modelValue(lift, measure, params) {
  if (measure.momentPoint !== undefined && measure.metric !== 'lumbarExtensionMoment') throw new Error('momentPoint 只適用腰背力矩');
  return withLumbarPoint(measure.momentPoint ?? 'model5cm', () => modelValueAtPoint(lift, measure, params));
}
function modelValueAtPoint(lift, measure, params) {
  const { metric, sample } = measure;
  // 模型沒有獨立骨盆；保留文獻定點，但不虛構骨盆角模型值。
  if (metric === 'pelvisAnteriorTilt') return { value: null, atE: round(sampleE(lift, sample.type, sample, params)) };
  let value, atE;
  if (sample.type === 'fullRange') {
    if (metric !== 'barVerticalTravelPctHeight' || lift !== 'deadlift') throw new Error('全程槓位移只適用硬舉');
    const top = solvePose(lift, params, 0), bottom = solvePose(lift, params, 1);
    if (!top.ok || !bottom.ok) throw new Error('全程槓位移姿勢失敗');
    value = (top.bar[1] - bottom.bar[1]) / BODY.heightM * 100;
    atE = 1;
  } else if (sample.type === 'peak') {
    if (!momentDof[metric]) throw new Error(`${metric} 不支援 peak`);
    value = -Infinity;
    const endE = peakEndE(sample, params);
    for (let i = 0; i <= 400; i++) {
      const e = endE * i / 400, raw = analyze(lift, params, e).dem[momentDof[metric]];
      if (raw > value) { value = raw; atE = e; }
    }
  } else {
    atE = sampleE(lift, sample.type, sample, params);
    const result = analyze(lift, params, atE);
    if (!result.pose.ok) throw new Error(`姿勢失敗，e=${round(atE)}`);
    value = momentDof[metric] ? result.dem[momentDof[metric]] : angles(result.pose)[metric];
  }
  if (!Number.isFinite(value)) throw new Error(`${metric} 輸出非有限數`);
  if (measure.modelFactor !== undefined) {
    if (!Number.isFinite(measure.modelFactor) || measure.modelFactor <= 0) throw new Error(`無效 modelFactor：${measure.modelFactor}`);
    value *= measure.modelFactor;
  }
  if (measure.normalization === 'massHeight') value /= BODY.mass * 1.75;
  else if (measure.normalization === 'mass') value /= BODY.mass;
  else if (measure.normalization !== undefined) throw new Error(`未知正規化：${measure.normalization}`);
  return { value: round(value), atE: round(atE) };
}

function referenceValue(measure) {
  const raw = measure.reference.mean;
  if (!Number.isFinite(raw)) throw new Error('文獻平均值非數字');
  if (measure.referenceTransform === 'minus90') return raw - 90;
  if (measure.referenceTransform === 'absolute') return Math.abs(raw);
  if (measure.referenceTransform === 'negate') return -raw;
  if (measure.referenceTransform !== undefined) throw new Error(`未知文獻轉換：${measure.referenceTransform}`);
  return raw;
}

const filenames = fs.readdirSync(validationDir).filter((f) => f.endsWith('.json') && !['results.json', 'population-results.json'].includes(f)).sort();
if (!filenames.length) throw new Error('validation/ 沒有文獻資料');
const entries = new Map(CATALOG.map((c) => [c.id, c]));
const comparisons = [], ids = new Set(), heelContexts = new Map();
const sources = filenames.map((f) => JSON.parse(fs.readFileSync(path.join(validationDir, f), 'utf8')));
for (const source of sources) {
  if (!source.id || !source.source?.url || !source.participants || !source.protocol || !source.model || !Array.isArray(source.conditions)) throw new Error(`${source.id ?? '?'} 資料格式不完整`);
  for (const condition of source.conditions) {
    const entry = entries.get(condition.catalogId);
    if (!entry || !['squat', 'deadlift', 'rdl'].includes(entry.lift)) throw new Error(`未知驗證清單項目：${condition.catalogId}`);
    const params = { ...defaultParams(entry.lift), ...entry.set, ...condition.params };
    if (entry.lift === 'squat' && params.barPos !== entry.set.barPos) throw new Error(`${condition.catalogId} 槓位與清單不符`);
    if (entry.lift === 'deadlift' && (params.style !== entry.set.style || params.start !== entry.set.start)) throw new Error(`${condition.catalogId} 站姿或起槓高度與清單不符`);
    if (!condition.conditionDerivation || !Object.hasOwn(condition, 'loadRatio')) throw new Error(`${source.id}/${condition.id} 缺少條件推導或負重`);
    for (const measure of condition.measurements) {
      const id = `${source.id}/${condition.id}/${measure.id}`;
      if (ids.has(id)) throw new Error(`重複比對 ID：${id}`);
      ids.add(id);
      if (metricLayer[measure.metric] !== measure.layer) throw new Error(`${id} 指標或層級不符`);
      if (measure.metric === 'pelvisAnteriorTilt' && measure.comparisonRole !== 'definition-mismatch') throw new Error(`${id} 骨盆角只能標為 definition-mismatch`);
      if (!['table', 'text', 'figureDigitized', 'datasetComputed'].includes(measure.evidence) || !measure.location) throw new Error(`${id} 出處不完整`);
      if (!(measure.tolerance?.absolute >= 0) || measure.tolerance.unit !== measure.reference.unit) throw new Error(`${id} 容許範圍無效`);
      const reference = referenceValue(measure);
      const actual = withLoad(entry.lift, condition.loadRatio, () => modelValue(entry.lift, measure, params));
      // 有指定研究取矩點時，另列產品預設 5 cm 的值供對照（診斷用，不進判定）。
      const at5 = measure.momentPoint ? withLoad(entry.lift, condition.loadRatio, () => modelValue(entry.lift, { ...measure, momentPoint: undefined }, params)) : null;
      const category = measure.comparisonRole ?? 'comparable';
      if (!['comparable', 'definition-mismatch', 'exploratory', 'consistency-check'].includes(category)) throw new Error(`${id} 比對類別無效`);
      const comparableDefinition = category !== 'definition-mismatch';
      const error = comparableDefinition ? actual.value - reference : null;
      const withinTolerance = comparableDefinition ? Math.abs(error) <= measure.tolerance.absolute + 1e-8 : null;
      if (entry.lift === 'squat' && params.heelHeight > 0) {
        heelContexts.set(id, { measure, params, loadRatio: condition.loadRatio, reference });
      }
      comparisons.push({
        id, catalogId: condition.catalogId, layer: measure.layer, metric: measure.metric,
        sample: measure.sample, modelParams: condition.params, modelLoadRatio: condition.loadRatio ?? BAR_RATIO[entry.lift], modelE: actual.atE,
        model: actual.value, ...(measure.momentPoint ? { momentPoint: measure.momentPoint, modelAt5cm: at5.value } : {}), reference: comparableDefinition ? round(reference) : null,
        referenceRaw: measure.reference.mean, referenceSd: measure.reference.sd,
        unit: measure.reference.unit, error: comparableDefinition ? round(error) : null, tolerance: measure.tolerance.absolute,
        category, status: category === 'comparable' ? (withinTolerance ? 'pass' : 'fail') : category,
        pass: category === 'comparable' ? withinTolerance : null, withinTolerance,
        sourceQuality: source.sourceQuality ?? null,
        evidence: measure.evidence, location: measure.location, source: source.source.url,
      });
    }
  }
}

// 只重算有鞋跟且可比較的條件。狀態翻轉以 0–1 的 0.01 網格偵測，邊界再二分；
// 研究值、容許範圍及產品預設值在整個掃描中均固定。
const shares = [0, 0.25, HEEL_SHANK_SHARE, 0.75, 1];
function heelResult(context, share) {
  return withHeelShankShareForValidation(share, () =>
    withLoad('squat', context.loadRatio, () => modelValue('squat', context.measure, context.params)));
}
function heelPass(context, share) {
  return Math.abs(heelResult(context, share).value - context.reference) <= context.measure.tolerance.absolute + 1e-8;
}
const sweep = shares.map((share) => {
  const changed = new Map([...heelContexts].map(([id, context]) => [id, heelResult(context, share)]));
  const pass = comparisons.filter((c) => c.category === 'comparable' &&
    (changed.has(c.id) ? Math.abs(changed.get(c.id).value - c.reference) <= c.tolerance + 1e-8 : c.pass)).length;
  return { share, pass, changed };
});
for (const comparison of comparisons) {
  const context = heelContexts.get(comparison.id);
  if (!context || comparison.category !== 'comparable') continue;
  const grid = Array.from({ length: 101 }, (_, i) => heelPass(context, i / 100));
  if (grid.every((pass) => pass === grid[0])) continue;
  let start = grid[0] ? 0 : null;
  const ranges = [];
  for (let i = 1; i < grid.length; i++) {
    if (grid[i] === grid[i - 1]) continue;
    let lo = (i - 1) / 100, hi = i / 100;
    for (let step = 0; step < 24; step++) {
      const mid = (lo + hi) / 2;
      if (heelPass(context, mid) === grid[i - 1]) lo = mid;
      else hi = mid;
    }
    // 四位小數端點必須本身通過；向通過側收斂，避免四捨五入落在失敗側。
    const boundary = grid[i] ? round(Math.ceil(hi * 10000) / 10000) : round(Math.floor(lo * 10000) / 10000);
    if (grid[i]) start = boundary;
    else { ranges.push([start, boundary]); start = null; }
  }
  if (start !== null) ranges.push([start, 1]);
  if (ranges.length !== 1) throw new Error(`${comparison.id} 的通過範圍不連續，須擴充 passRange 格式`);
  if (!ranges.every(([from, to]) => heelPass(context, from) && heelPass(context, to))) throw new Error(`${comparison.id} 的 passRange 端點未通過`);
  comparison.assumptionSensitive = { parameter: 'HEEL_SHANK_SHARE', passRange: ranges[0] };
}

function counts(items) {
  const pass = items.filter((c) => c.status === 'pass').length;
  const fail = items.filter((c) => c.status === 'fail').length;
  return {
    total: items.length, count: pass + fail, pass, fail,
    definitionMismatch: items.filter((c) => c.status === 'definition-mismatch').length,
    exploratory: items.filter((c) => c.status === 'exploratory').length,
    consistencyCheck: items.filter((c) => c.status === 'consistency-check').length,
    assumptionSensitivePass: items.filter((c) => c.status === 'pass' && c.assumptionSensitive).length,
  };
}
const summary = { ...counts(comparisons), sources: sources.length };
const results = { modelVersion: MODEL_VERSION, summary, comparisons };
// 只提供公開說明文字；驗證計數、門檻與模型計算均不受此欄位影響。
const calibrationCaveats = {
  'squat-high': '六點無負重圖讀值擬合；參數種類與方向非對測試組盲選，站距換算未校驗，預設負重與站距屬外推。見 docs/research/results/squat.md。',
  'squat-low': '沿用無負重背蹲校準；低槓偏移未獨立校準，站距換算與負重外推不確定，寬站軀幹比對失敗。見 docs/research/results/squat.md。',
  'front-squat': '沿用無負重背蹲校準；前槓偏移未獨立校準，姿勢可疑偏直立，Goršič 群體軀幹角比對失敗。見 docs/research/results/squat.md。',
  'goblet-squat': '沿用無負重背蹲校準；高腳杯姿勢與負重未獨立校準，站距換算及參數可辨識性有限。見 docs/research/results/squat.md。',
};
const byId = Object.fromEntries(CATALOG.map((entry) => {
  const make = (layer) => {
    const items = comparisons.filter((c) => c.catalogId === entry.id && c.layer === layer);
    const stats = counts(items);
    const { assumptionSensitivePass, ...baseStats } = stats;
    return {
      status: stats.count ? (stats.fail ? 'failed' : 'partial') : stats.definitionMismatch ? 'definition-mismatch' : stats.exploratory ? 'exploratory' : 'unvalidated',
      ...baseStats,
      ...(stats.count ? { assumptionSensitivePass } : {}),
      links: items.length ? [entry.cat === 'hinge' ? 'docs/research/results/deadlift.md' : 'docs/research/results/squat.md', ...new Set(items.map((c) => c.source))] : [],
    };
  };
  const muscle = { status: 'unvalidated', count: 0, pass: 0, fail: 0, qualitativeCount: 0, qualitativePass: 0, qualitativeFail: 0, links: [] };
  if (['squat-high', 'squat-low', 'front-squat', 'deadlift', 'sumo'].includes(entry.id)) {
    const qualitative = (trendStatus.byId[entry.id] || []).filter((t) => /活化|肌.*負荷/.test(t.compare));
    muscle.status = qualitative.length ? (qualitative.some((t) => !t.pass) ? 'failed' : 'partial') : 'unvalidated';
    muscle.qualitativeCount = qualitative.length;
    muscle.qualitativePass = qualitative.filter((t) => t.pass).length;
    muscle.qualitativeFail = qualitative.filter((t) => !t.pass).length;
    muscle.note = '僅有定性趨勢檢查；肌肉分工為模型估計，無數值驗證';
    muscle.links = qualitative.length ? [entry.cat === 'hinge' ? 'docs/research/results/deadlift.md' : 'docs/research/results/squat.md', 'docs/research/references.md'] : [];
  }
  return [entry.id, {
    ...(calibrationCaveats[entry.id] ? { calibrationCaveat: calibrationCaveats[entry.id] } : {}),
    kinematics: make('kinematics'), moments: make('moments'), muscles: muscle,
  }];
}));
const status = { modelVersion: MODEL_VERSION, summary, byId };
const serialize = (o) => JSON.stringify(o, null, 2) + '\n';

function makeFigure() {
  const panels = [
    { title: '最低點：軀幹前傾角', unit: '度', metric: 'trunkInclination', source: 'larsen-2021', ids: ['high-narrow', 'low-narrow'] },
    { title: '最低點：膝屈角（一致性檢查）', unit: '度', metric: 'kneeFlexion', source: 'larsen-2021', ids: ['high-narrow', 'low-narrow'] },
    { title: '平行位置：髖伸力矩', unit: 'Nm/(kg·m)', metric: 'hipExtensionMoment', source: 'gorsic-2020', ids: ['straight-back', 'straight-front'] },
    { title: '平行位置：膝伸力矩', unit: 'Nm/(kg·m)', metric: 'kneeExtensionMoment', source: 'gorsic-2020', ids: ['straight-back', 'straight-front'] },
  ];
  const colors = ['#166aab', '#bd482e'];
  const labels = { 'high-narrow': '高槓窄站', 'low-narrow': '低槓窄站', 'straight-back': '高槓背蹲', 'straight-front': '前蹲' };
  const W = 1200, H = 800, cardW = 570, cardH = 350;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="深蹲模型全行程與研究特定位置數值比對">`,
    `<rect width="${W}" height="${H}" fill="#f8fafc"/>`,
    `<text x="30" y="32" font-family="sans-serif" font-size="22" font-weight="700" fill="#17324d">深蹲全行程：模型曲線與研究定點量測</text>`,
    `<text x="30" y="54" font-family="sans-serif" font-size="13" fill="#526579">線：準靜態模型；圓點：研究平均；短棒：±1 SD；淺棒：預先設定的容許範圍。研究沒有提供此圖對應的全行程數值。</text>`];
  panels.forEach((panel, index) => {
    const ox = 25 + (index % 2) * 590, oy = 75 + Math.floor(index / 2) * 360;
    const x0 = ox + 55, y0 = oy + 52, pw = 455, ph = 245;
    const lines = panel.ids.map((id, j) => {
      const source = sources.find((s) => s.id === panel.source);
      const condition = source.conditions.find((c) => c.id === id);
      const params = { ...defaultParams('squat'), ...condition.params };
      const comparison = comparisons.find((c) => c.id.startsWith(`${panel.source}/${id}/`) && c.metric === panel.metric);
      const series = withLoad('squat', condition.loadRatio, () => Array.from({ length: 101 }, (_, i) => {
        const r = analyze('squat', params, i / 100);
        let value = momentDof[panel.metric] ? r.dem[momentDof[panel.metric]] / (BODY.mass * 1.75) : angles(r.pose)[panel.metric];
        return value;
      }));
      return { id, color: colors[j], comparison, series };
    });
    const vals = lines.flatMap((l) => [...l.series, l.comparison.reference - l.comparison.tolerance, l.comparison.reference + l.comparison.tolerance]);
    const min = Math.min(...vals), max = Math.max(...vals), pad = Math.max((max - min) * 0.1, panel.unit === '度' ? 3 : 0.08);
    const lower = min - pad, upper = max + pad;
    const xp = (e) => x0 + e * pw, yp = (v) => y0 + ph - (v - lower) / (upper - lower) * ph;
    svg.push(`<rect x="${ox}" y="${oy}" width="${cardW}" height="${cardH}" rx="12" fill="white" stroke="#dce4ed"/>`,
      `<text x="${ox + 18}" y="${oy + 27}" font-family="sans-serif" font-size="17" font-weight="700" fill="#17324d">${panel.title}</text>`);
    for (let t = 0; t <= 4; t++) {
      const value = lower + (upper - lower) * t / 4, y = yp(value);
      svg.push(`<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x0 + pw}" y2="${y.toFixed(1)}" stroke="#e8edf2"/>`,
        `<text x="${x0 - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-family="sans-serif" font-size="11" fill="#526579">${value.toFixed(panel.unit === '度' ? 0 : 1)}</text>`);
    }
    svg.push(`<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + ph}" stroke="#6b7c8c"/>`,
      `<line x1="${x0}" y1="${y0 + ph}" x2="${x0 + pw}" y2="${y0 + ph}" stroke="#6b7c8c"/>`,
      `<text x="${x0 - 5}" y="${y0 + ph + 18}" font-family="sans-serif" font-size="11" fill="#526579">頂點 0</text>`,
      `<text x="${x0 + pw - 5}" y="${y0 + ph + 18}" text-anchor="end" font-family="sans-serif" font-size="11" fill="#526579">最低點 1</text>`);
    lines.forEach((line, j) => {
      const points = line.series.map((v, i) => `${i ? 'L' : 'M'}${xp(i / 100).toFixed(1)},${yp(v).toFixed(1)}`).join(' ');
      const c = line.comparison, rx = xp(c.modelE), ry = yp(c.reference), shift = j ? 4 : -4;
      svg.push(`<path d="${points}" fill="none" stroke="${line.color}" stroke-width="2.5"/>`,
        `<line x1="${rx + shift}" y1="${yp(c.reference - c.tolerance).toFixed(1)}" x2="${rx + shift}" y2="${yp(c.reference + c.tolerance).toFixed(1)}" stroke="${line.color}" stroke-width="10" opacity="0.18"/>`,
        `<line x1="${rx + shift}" y1="${yp(c.reference - c.referenceSd).toFixed(1)}" x2="${rx + shift}" y2="${yp(c.reference + c.referenceSd).toFixed(1)}" stroke="${line.color}" stroke-width="2"/>`,
        `<circle cx="${rx + shift}" cy="${ry.toFixed(1)}" r="4.5" fill="white" stroke="${line.color}" stroke-width="2"/>`,
        `<line x1="${ox + 22 + j * 185}" y1="${oy + 327}" x2="${ox + 46 + j * 185}" y2="${oy + 327}" stroke="${line.color}" stroke-width="3"/>`,
        `<text x="${ox + 52 + j * 185}" y="${oy + 331}" font-family="sans-serif" font-size="12" fill="#17324d">${labels[line.id]}</text>`);
    });
  });
  svg.push('</svg>');
  return svg.join('\n') + '\n';
}
const figure = makeFigure();
if (mode === '--write-status') {
  fs.mkdirSync(path.dirname(figurePath), { recursive: true });
  fs.writeFileSync(resultsPath, serialize(results));
  fs.writeFileSync(statusPath, serialize(status));
  fs.writeFileSync(figurePath, figure);
} else if (mode === '--check') {
  for (const [filename, expected] of [[resultsPath, serialize(results)], [statusPath, serialize(status)], [figurePath, figure]]) {
    if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8') !== expected) throw new Error(`${path.relative(root, filename)} 缺少或與重算不一致；請執行 npm run test:validation`);
  }
}
if (mode === '--heel-share-sweep') {
  const keys = ['gorsic-2020/straight-back/trunk', 'gorsic-2020/straight-back/hip', 'gorsic-2020/straight-front/hip'];
  console.log('| 小腿前傾比例 | 背蹲軀幹 ° | 背蹲髖伸 Nm/(kg·m) | 前蹲髖伸 Nm/(kg·m) | 可比較通過 |');
  console.log('|---:|---:|---:|---:|---:|');
  for (const row of sweep) {
    const cells = keys.map((id) => {
      const c = comparisons.find((item) => item.id === id);
      const value = row.changed.get(id).value;
      return `${value.toFixed(c.metric === 'trunkInclination' ? 2 : 3)} ${Math.abs(value - c.reference) <= c.tolerance + 1e-8 ? '通過' : '失敗'}`;
    });
    console.log(`| ${row.share} | ${cells.join(' | ')} | ${row.pass}/${summary.count} |`);
  }
  console.log(`假設敏感：${comparisons.filter((c) => c.assumptionSensitive).length} 筆；預設 ${HEEL_SHANK_SHARE} 的敏感通過 ${summary.assumptionSensitivePass} 筆`);
  for (const c of comparisons.filter((item) => item.assumptionSensitive)) console.log(`${c.id}: passRange ${c.assumptionSensitive.passRange.join('–')}`);
  for (const id of ['gorsic-2020/straight-back/lumbar', 'gorsic-2020/straight-front/lumbar']) {
    const c = comparisons.find((item) => item.id === id);
    const values = sweep.map((row) => row.changed.get(id).value);
    console.log(`${id}: ${Math.min(...values).toFixed(4)}–${Math.max(...values).toFixed(4)}，${c.category === 'definition-mismatch' ? '定義不一致，僅顯示敏感度' : '可比較'}`);
  }
} else if (mode !== '--check') {
  console.log(`數值驗證：可比較 ${summary.count} 筆，PASS ${summary.pass}，FAIL ${summary.fail}；假設敏感通過 ${summary.assumptionSensitivePass} 筆；定義不一致 ${summary.definitionMismatch}、探索性 ${summary.exploratory}、一致性檢查 ${summary.consistencyCheck}；門檻未變`);
  console.log('比對 ID'.padEnd(39), '模型'.padStart(9), '文獻'.padStart(9), '誤差'.padStart(9), '容許'.padStart(9), '結果');
  const cell = (v) => v === null ? '—'.padStart(9) : v.toFixed(2).padStart(9);
  for (const c of comparisons) console.log(c.id.padEnd(39), cell(c.model), cell(c.reference), cell(c.error), cell(c.tolerance), c.status);
} else console.log(`validation-status.json 與 results.json 一致：${summary.pass}/${summary.count} PASS（可比較）`);
