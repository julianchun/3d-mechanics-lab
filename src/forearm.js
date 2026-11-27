// MoBL-ARMS 固定版路徑點的直線弦力臂；角度為右手前臂旋轉，正值旋前。
import { FOREARM_SOURCE, FOREARM_ELBOW_DEG, FOREARM_ROT_DEG } from './forearm-arms.js';

const DEG = 180 / Math.PI;
const interp = (knots, values, x) => {
  const v = Math.max(knots[0], Math.min(knots.at(-1), x));
  let i = knots.length - 2;
  for (let j = 0; j < knots.length - 1; j++) if (v <= knots[j + 1]) { i = j; break; }
  const t = (v - knots[i]) / (knots[i + 1] - knots[i]);
  return values[i] * (1 - t) + values[i + 1] * t;
};

export function forearmArm(id, dof, q) {
  const source = FOREARM_SOURCE[id];
  const elbow = (q.elbFlex || 0) * DEG;
  const fore = (q.foreRot || 0) * DEG;
  const rows = source[dof === 'elbExt' ? 'elb' : 'rot'];
  const values = FOREARM_ELBOW_DEG.map((_, j) => interp(FOREARM_ROT_DEG, rows.map((row) => row[j]), fore));
  const chord = interp(FOREARM_ELBOW_DEG, values, elbow);
  if (dof === 'elbExt') return -chord; // 來源角為屈肘，產品軸為伸肘。
  // SUP 的直線弦略過繞橈骨的包覆，於中立後錯誤換向；
  // 保留來源弦的量級並依該肌的旋後功能定向，數值仍待 OpenSim 包覆路徑核對。
  if (id === 'supinator') return -Math.max(0.003, Math.abs(chord));
  return chord;
}

export const FOREARM_MUSCLE_SOURCE = FOREARM_SOURCE;
