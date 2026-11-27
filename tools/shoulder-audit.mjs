// 比較預設與 DAS3 參數組的肩部清單排名及主動活化超載點；輸出 JSON 供報告核對。
import { CATALOG } from '../src/catalog.js';
import { analyze, defaultParams, LIFTS, MUSCLES, MUSCLE_GROUP_IDS, SHOULDER_PARAMETER_SET } from '../src/biomech.js';

const entries = {};
for (const c of CATALOG.filter((entry) => entry.lift &&
  LIFTS[entry.lift].dofs.some((d) => ['shFwd', 'shSide', 'shRot', 'scRet', 'scElev'].includes(d)))) {
  const P = { ...defaultParams(c.lift), ...c.set };
  const peaks = new Map();
  let saturatedFrames = 0, saturatedMusclePoints = 0;
  const overload = new Map();
  for (let i = 0; i <= 40; i++) {
    const e = i / 40;
    const mus = analyze(c.lift, P, e).mus;
    let frameSaturated = false;
    for (const id of MUSCLE_GROUP_IDS) {
      const m = mus[id];
      if (!m) continue;
      peaks.set(id, Math.max(peaks.get(id) || 0, m.s));
      if (m.a > 1.000001 || !Number.isFinite(m.a)) {
        frameSaturated = true;
        saturatedMusclePoints++;
        if (!overload.has(id) || m.a > overload.get(id).a) overload.set(id, { a: m.a, e });
      }
    }
    if (frameSaturated) saturatedFrames++;
  }
  const ranking = [...peaks].sort((a, b) => b[1] - a[1]);
  entries[c.id] = {
    top4: ranking.slice(0, 4).map(([id, s]) => [id, +s.toFixed(3)]),
    saturatedFrames, saturatedMusclePoints,
    overload: Object.fromEntries([...overload].map(([id, m]) => [id, { a: +m.a.toFixed(3), e: m.e }])),
    lat: +((peaks.get('lat') || 0).toFixed(3)),
    subsc: +((peaks.get('subsc') || 0).toFixed(3)),
  };
}
// 單項替換只用於歸因診斷：每次恢復 DAS3 狀態，不把舊 F 或力臂寫回產品。
let causes;
if (process.argv.includes('--causes')) {
  if (SHOULDER_PARAMETER_SET !== 'das3') throw new Error('--causes 需設 SHOULDER_PARAMETER_SET=das3');
  process.env.SHOULDER_PARAMETER_SET = 'legacy';
  const legacy = await import('../src/biomech.js?shoulder-audit-legacy');
  process.env.SHOULDER_PARAMETER_SET = 'das3';
  causes = {};
  for (const [id, group] of [
    ['bench', 'pecs'], ['row', 'midtrap'], ['row', 'lat'],
    ['cable-row', 'lat'], ['cable-row-wide', 'midtrap'],
    ['shrug', 'uptrap'], ['curl', 'adelt'], ['pulldown', 'lat'], ['deadlift', 'pdelt'],
  ]) {
    const c = CATALOG.find((entry) => entry.id === id);
    const P = { ...defaultParams(c.lift), ...c.set };
    const members = MUSCLES.filter((m) => (m.group || m.id) === group);
    const old = legacy.MUSCLES.find((m) => (m.group || m.id) === group);
    const oldF = legacy.MUSCLES.filter((m) => (m.group || m.id) === group)
      .reduce((sum, m) => sum + m.F, 0);
    const newF = members.reduce((sum, m) => sum + m.F, 0);
    const measure = () => {
      let maxA = 0, overloadedFrames = 0;
      const peaks = new Map();
      for (let i = 0; i <= 40; i++) {
        const mus = analyze(c.lift, P, i / 40).mus;
        maxA = Math.max(maxA, mus[group].a);
        for (const key of MUSCLE_GROUP_IDS) if (mus[key])
          peaks.set(key, Math.max(peaks.get(key) || 0, mus[key].s));
        if (MUSCLE_GROUP_IDS.some((key) => mus[key] && (mus[key].a > 1.000001 || !Number.isFinite(mus[key].a))))
          overloadedFrames++;
      }
      return { maxA: +maxA.toFixed(3), peakS: +(peaks.get(group) || 0).toFixed(3),
        top4: [...peaks].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key]) => key), overloadedFrames };
    };
    const baseline = measure();
    const originalF = members.map((m) => m.F);
    for (const m of members) m.F *= oldF / newF;
    const legacyFOnly = measure();
    members.forEach((m, i) => { m.F = originalF[i]; });
    const originalArms = members.map((m) => m.arms);
    for (const m of members) m.arms = old.arms;
    const legacyArmsOnly = measure();
    members.forEach((m, i) => { m.arms = originalArms[i]; });
    causes[`${id}:${group}`] = { oldF, newF, baseline, legacyFOnly, legacyArmsOnly };
  }
}
console.log(JSON.stringify({ set: SHOULDER_PARAMETER_SET, entries, ...(causes ? { causes } : {}) }));
