// Murray 1995 大體力臂優先；缺量測的 PQ／SUP 暫用 MoBL-ARMS 路徑點弦。
import { FOREARM_SOURCE, FOREARM_ELBOW_DEG, FOREARM_ROT_DEG } from './forearm-arms.js';
import { MEASURED_ELBOW_DEG, MEASURED_ROT_DEG, MEASURED_ELBOW_NEUTRAL,
  MEASURED_BICEPS_ELBOW, MEASURED_ROT_85, BICEPS_ROT_45_TO_85 } from './forearm-measured.js';

const DEG = 180 / Math.PI;
const interp = (knots, values, x) => {
  const v = Math.max(knots[0], Math.min(knots.at(-1), x));
  let i = knots.length - 2;
  for (let j = 0; j < knots.length - 1; j++) if (v <= knots[j + 1]) { i = j; break; }
  const t = (v - knots[i]) / (knots[i + 1] - knots[i]);
  return values[i] * (1 - t) + values[i + 1] * t;
};

export function forearmArm(id, dof, q) {
  const elbow = (q.elbFlex || 0) * DEG;
  const fore = (q.foreRot || 0) * DEG;
  const biceps = id === 'bicLong' || id === 'bicShort';
  if (dof === 'elbExt') {
    if (biceps) {
      const byAngle = ['supinated', 'neutral', 'pronated'].map((key) => interp(MEASURED_ELBOW_DEG, MEASURED_BICEPS_ELBOW[key], elbow));
      return -interp([-80, 0, 80], byAngle, fore); // 來源角為屈肘，產品軸為伸肘。
    }
    if (MEASURED_ELBOW_NEUTRAL[id]) return -interp(MEASURED_ELBOW_DEG, MEASURED_ELBOW_NEUTRAL[id], elbow);
  } else {
    const key = biceps ? 'biceps' : id;
    if (MEASURED_ROT_85[key]) {
      const measured = interp(MEASURED_ROT_DEG, MEASURED_ROT_85[key], fore);
      // 只有二頭肌有 45°／85° 的旋後峰值交叉測量；其他肌肉沿用 85° 曲線。
      return biceps ? measured * interp([45, 85], [BICEPS_ROT_45_TO_85, 1], elbow) : measured;
    }
  }
  const source = FOREARM_SOURCE[id];
  const rows = source[dof === 'elbExt' ? 'elb' : 'rot'];
  const values = FOREARM_ELBOW_DEG.map((_, j) => interp(FOREARM_ROT_DEG, rows.map((row) => row[j]), fore));
  const chord = interp(FOREARM_ELBOW_DEG, values, elbow);
  if (dof === 'elbExt') return -chord; // 來源角為屈肘，產品軸為伸肘。
  // SUP 弦在中立後錯誤換向；僅保留弦的量級與旋後方向，允許為零，沒有假定最低值。
  if (id === 'supinator') return -Math.abs(chord);
  return chord;
}

export const FOREARM_MUSCLE_SOURCE = FOREARM_SOURCE;
