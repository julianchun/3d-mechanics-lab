// 所有含肩關節自由度的清單動作：整程峰值前四名與超載幀數。
import { CATALOG } from '../src/catalog.js';
import { LIFTS, MUSCLE_GROUP_IDS, analyze, defaultParams } from '../src/biomech.js';

const out = [];
for (const item of CATALOG.filter((entry) => entry.lift && LIFTS[entry.lift].dofs.some((dof) => ['shFwd', 'shSide'].includes(dof)))) {
  const P = { ...defaultParams(item.lift), ...item.set };
  const peak = new Map();
  const overloadByMuscle = new Map();
  let overloadFrames = 0;
  for (let i = 0; i <= 40; i++) {
    const mus = analyze(item.lift, P, i / 40).mus;
    let overloaded = false;
    for (const [id, value] of Object.entries(mus)) {
      if (MUSCLE_GROUP_IDS.includes(id)) peak.set(id, Math.max(peak.get(id) || 0, value.s));
      if (value.a > 1.000001 && (!value.group || !mus[value.group])) {
        overloaded = true;
        overloadByMuscle.set(id, (overloadByMuscle.get(id) || 0) + 1);
      }
    }
    if (overloaded) overloadFrames++;
  }
  out.push({ id: item.id, top4: [...peak].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, s]) => ({ id, s: +s.toFixed(4) })),
    overloadFrames, overloadByMuscle: Object.fromEntries(overloadByMuscle) });
}
console.log(JSON.stringify(out, null, 2));
