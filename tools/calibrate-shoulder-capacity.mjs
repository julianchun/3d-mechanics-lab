// 依獨立等長常模重算肩伸與水平外展的單側最大有效力矩。
// 校準姿勢、順序與不足才補的規則見 docs/research/shoulder-capacity-calibration.md。
import { MUSCLES, createBody, dot } from '../src/biomech.js';

const rad = (degrees) => degrees * Math.PI / 180;
const tasks = [
  { name: '水平外展', angle: [0, 90], axis: 'hadd', sign: -1, target: 11.0 * 9.80665 * createBody({ heightM: 1.645 }).Lu, adjustable: 'pdelt' },
  { name: '肩伸', angle: [90, 0], axis: 'elev', sign: -1, target: 73.5, adjustable: 'tmaj' },
];
const effectiveF = new Map(MUSCLES.map((muscle) => [muscle.id, muscle.F]));

for (const task of tasks) {
  const [fwd, side] = task.angle.map(rad);
  const t = Math.hypot(fwd, side);
  const c = fwd / t, s = side / t;
  const q = { shFwd: fwd, shSide: side, shElev: t, shPlane: Math.atan2(side, fwd), shRot: 0, scRet: 0, scElev: 0 };
  const axis = task.axis === 'elev' ? [-c, 0, s] : [-Math.cos(t) * s, -Math.sin(t), -Math.cos(t) * c];
  const parts = MUSCLES.map((muscle) => {
    const vec = muscle.arms.shFwd?.shoulderVec?.(q);
    const r = vec ? task.sign * dot(vec, axis) : 0;
    return { id: muscle.id, F: effectiveF.get(muscle.id), r, capacity: Math.max(0, r) * effectiveF.get(muscle.id) };
  }).filter((part) => part.capacity > 0).sort((a, b) => b.capacity - a.capacity);
  const total = parts.reduce((sum, part) => sum + part.capacity, 0);
  const adjustable = parts.find((part) => part.id === task.adjustable);
  const deficit = Math.max(0, task.target - total);
  const newF = adjustable?.r > 0 ? adjustable.F + deficit / adjustable.r : null;
  if (newF !== null) effectiveF.set(task.adjustable, newF);
  console.log(JSON.stringify({ task: task.name, postureDeg: task.angle, targetNm: task.target, totalNm: total,
    deficitNm: deficit, adjustable: task.adjustable, newF, parts }, null, 2));
}
