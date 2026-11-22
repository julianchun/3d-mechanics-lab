// 肩三維角度的軌跡連續性：側舉至肩高及划船經過垂臂時，不應再有投影角跳變。
import { CATALOG } from '../src/catalog.js';
import { LIFTS, analyze, defaultParams } from '../src/biomech.js';

const rad = (d) => d * Math.PI / 180;
const failures = [];
for (const item of CATALOG.filter((c) => c.lift && LIFTS[c.lift].dofs.includes('shRot'))) {
  const P = { ...defaultParams(item.lift), ...item.set };
  let previous = null;
  for (let i = 0; i <= 80; i++) {
    const result = analyze(item.lift, P, i / 80);
    for (const key of ['shFwd', 'shSide', 'shRot']) {
      const value = result.q[key], demand = result.dem[key];
      if (!Number.isFinite(value) || !Number.isFinite(demand)) failures.push(`${item.id}@${i / 80} ${key} 非有限值`);
      if (previous && Math.abs(value - previous[key]) > rad(30)) failures.push(`${item.id}@${i / 80} ${key} 單步跳動超過 30°`);
    }
    if (previous) {
      for (const [id, muscle] of Object.entries(result.mus)) {
        const before = previous.mus[id];
        if (before && Math.abs(muscle.a - before.a) > 0.3) failures.push(`${item.id}@${i / 80} ${id} 活化單步跳動超過 0.3`);
      }
    }
    previous = { ...result.q, mus: result.mus };
  }
}
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log('shoulder PASS：上肢三維角度與需求力矩連續');
