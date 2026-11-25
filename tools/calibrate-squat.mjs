// 僅讀獨立校準組；測試組留待擬合完成後檢驗。
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const data = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../validation/calibration/demers-2018.json', import.meta.url)), 'utf8'));
const points = data.conditions.flatMap(({ id, params, measurements }) => measurements.map(({ sample, reference }) => ({
  id: `${id}/${sample.targetDeg}`,
  stance: params.stance,
  angle: sample.targetDeg,
  reference: reference.mean,
})));
if (points.length !== 6 || data.role !== 'calibration-only') throw new Error('校準資料筆數或角色不符');

const predict = ({ stance, angle }, d, k, p) => {
  const dom = Math.max(0, Math.min(1, d + k * (stance - 0.3)));
  return (36 - 24 * dom) * (angle / (70 + 48 * 0.55)) ** p;
};
const score = (d, k, p) => points.reduce((sum, point) => sum + (predict(point, d, k, p) - point.reference) ** 2, 0);
let best = { error: Infinity };
for (let di = 20; di <= 70; di++) {
  for (let ki = 10; ki <= 80; ki++) {
    for (let pi = 70; pi <= 130; pi++) {
      const d = di / 100, k = ki / 100, p = pi / 100;
      const error = score(d, k, p);
      if (error < best.error - 1e-12) best = { d, k, p, error };
    }
  }
}
console.log(JSON.stringify({
  parameters: { domDefault: best.d, stanceShiftSlope: best.k, shankProgressExponent: best.p },
  rmse: Math.sqrt(best.error / points.length),
  baselineRmse: Math.sqrt(score(0.45, 0.35, 1) / points.length),
  points: points.map((point) => ({ id: point.id, reference: point.reference, baseline: predict(point, 0.45, 0.35, 1), calibrated: predict(point, best.d, best.k, best.p), residual: predict(point, best.d, best.k, best.p) - point.reference })),
}, null, 2));
