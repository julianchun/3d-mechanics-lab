// T46 原型（研究工具；不屬於產品，不影響 npm test）：node tools/research/unilateral-prototype.mjs
// 1) 分腿蹲矢狀面靜力：前後腳垂直反力分配與各腿髖／膝力矩
// 2) 單腿站立額狀面：軀幹側傾對髖外展需求
// 3) 單臂啞鈴：L5 處額狀面力矩
// 4) 對稱不變量：雙側 2 接觸點求解器在對稱姿勢下重現現有半身結果
import { DEFAULT_BODY as B, analyze, defaultParams } from '../../src/biomech.js';
const G = 9.81, M = B.mass, W = M * G;
const m = { thigh: .1416, shank: .0433, foot: .0137, trunk: .4346, head: .0694, upper: .0271, fore: .0162, hand: .0061 };
const cm = { thigh: .4095, shank: .4395 };
const sub = (a, b) => a.map((v, i) => v - b[i]);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function ik(root, tgt, L1, L2) { // 矢狀面 (z,y)，膝往前（+z）
  const d = sub(tgt, root), D = Math.min(Math.hypot(...d), L1 + L2 - 1e-4);
  const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const n = d.map((v) => v / Math.hypot(...d)), p = [-n[1], n[0]]; // 垂直於 n；n 朝下 → p 朝前 (+z)
  const sgn = p[0] > 0 ? 1 : -1;
  return [root[0] + n[0] * a + sgn * p[0] * h, root[1] + n[1] * a + sgn * p[1] * h];
}
// ---- 1) 分腿蹲 ----
function split({ stride, hipY, frontShare, barKg, H = 0 }) {
  // 座標 (z, y)；前腳踝 z=0，後腳踝 z=-stride；髖 z 由前後分配反解
  const aF = [0, B.ankleH], aR = [-stride, B.ankleH];
  const copF = [0.05, 0], copR = [-stride + 0.05, 0]; // 足底壓力中心：前腳掌方向 5 cm（假設）
  // 垂直力分配 = 重心 z 的線性內插（無水平摩擦）
  const Fy = W + barKg * G, FF = frontShare * Fy, FR = Fy - FF;
  const zcom = (FF * copF[0] + FR * copR[0]) / Fy; // 系統（含槓）重心 z
  // 假設：軀幹直立，髖 z = 系統重心 z（槓與上半身在髖正上方，腿質量另計→迭代一次）
  let hz = zcom;
  for (let k = 0; k < 20; k++) {
    const hip = [hz, hipY], kF = ik(hip, aF, B.Lt, B.Ls), kR = ik(hip, aR, B.Lt, B.Ls);
    const legs = (knee, ank) => [[lerp(hip, knee, cm.thigh), m.thigh * M], [lerp(knee, ank, cm.shank), m.shank * M], [[ank[0] + 0.03, ank[1] - .03], m.foot * M]];
    const pts = [...legs(kF, aF), ...legs(kR, aR)];
    const hatM = Fy / G - pts.reduce((s, p) => s + p[1], 0);
    const mom = pts.reduce((s, p) => s + p[1] * p[0][0], 0);
    const hz2 = (zcom * Fy / G - mom) / hatM;
    if (Math.abs(hz2 - hz) < 1e-9) break; hz = hz2;
  }
  const hip = [hz, hipY], kF = ik(hip, aF, B.Lt, B.Ls), kR = ik(hip, aR, B.Lt, B.Ls);
  const res = {};
  for (const [name, knee, ank, F, cop] of [['front', kF, aF, FF, copF], ['rear', kR, aR, FR, copR]]) {
    // 繞關節的外力矩（腿段重量＋地面反力），垂直力 + 無水平力；正值 = 需要伸肌
    const Fz = name === 'front' ? -H : H; // 地面對腳的水平力（內部成對：前腳向後、後腳向前）
    const segsAll = [[lerp(hip, knee, cm.thigh), m.thigh], [lerp(knee, ank, cm.shank), m.shank], [[ank[0] + .03, ank[1]], m.foot]];
    const tau = (J, segs) => { let t = 0; for (const [p, mm] of segs) t += (p[0] - J[0]) * (-mm * M * G); return t + (cop[0] - J[0]) * F - (0 - J[1]) * Fz; };
    const mom = (J) => tau(J, segsAll), kneeSegs = (J) => tau(J, segsAll.slice(1));
    res[name] = { grfN: +F.toFixed(0), hipNm: +mom(hip).toFixed(1), kneeNm: +kneeSegs(knee).toFixed(1),
      kneeFlexDeg: +(180 - Math.acos(Math.max(-1, Math.min(1, ((hip[0]-knee[0])*(ank[0]-knee[0]) + (hip[1]-knee[1])*(ank[1]-knee[1])) / (B.Lt * B.Ls)))) * 180 / Math.PI).toFixed(0) };
  }
  return { hipZ: +hz.toFixed(3), ...res };
}
console.log('== 1) 分腿蹲（槓 = 1.0 體重；Lt+Ls =', (B.Lt + B.Ls).toFixed(2), 'm）');
for (const fs of [0.6, 0.84]) for (const H of [0, 0.15, 0.3, 0.45]) { const r = split({ stride: 0.75, hipY: 0.62, frontShare: fs, barKg: M, H: H * W });
  console.log(`前腳份額 ${fs} 內部水平力 H=${H}BW`, JSON.stringify({ front: [r.front.hipNm, r.front.kneeNm], rear: [r.rear.hipNm, r.rear.kneeNm] })); }
// 對照：雙腳深蹲每側（現有模型）
const sq = analyze('squat', defaultParams('squat'), 0.5);
console.log('對照：現有深蹲底點每側 hipExt', sq.dem.hipExt.toFixed(1), 'kneeExt', sq.dem.kneeExt.toFixed(1), 'N·m（同樣 1.0 體重槓）');
// ---- 2) 單腿站立額狀面 ----
console.log('== 2) 單腿站立：HAT（軀幹＋頭＋雙臂）相對骨盆中心的側移 s（朝站立側為正）');
const legM = (m.thigh + m.shank + m.foot) * M, hatM = M - 2 * legM;
for (const s of [0, 0.02, 0.04, 0.06]) {
  // 骨盆中心 x=0；站立髖 x=+0.09、站立腿垂直（足在髖正下方）；擺動腿垂直掛在 x=-0.09
  const xcom = (hatM * s + legM * 0.09 + legM * -0.09) / M;
  const abd = W * (0.09 - xcom) - 0; // 髖外展需求 = GRF（在 xcom）對站立髖的力矩，腿重心在髖正下方不計
  console.log(`  s=${(s*100).toFixed(0)} cm → COM x=${(xcom*100).toFixed(1)} cm, 髖外展需求 ≈ ${abd.toFixed(1)} N·m (${(abd/M).toFixed(2)} N·m/kg)`);
}
// ---- 3) 單臂啞鈴：L5 額狀面力矩 ----
console.log('== 3) 單臂啞鈴（站姿垂握於身側 x=0.28 m、L5 高於髖 0.05 m）');
for (const kg of [10, 20, 30]) console.log(`  ${kg} kg：L5 額狀面力矩 ≈ ${(kg * G * 0.28).toFixed(1)} N·m（雙啞鈴對稱時淨額狀面力矩 = 0）`);
// ---- 4) 對稱不變量（雙側求解重現半身）----
{
  const P = defaultParams('squat'), r = analyze('squat', P, 0.5), p = r.pose;
  // 雙側：左腳為右腳鏡像；兩足底接觸點（x=±w），共同的 z 壓力中心由 legacy cop 給定
  const cop = p.cop, Fy = W * (1 + p.barW); // 系統總重
  const contacts = [[p.R.ankle[0], cop[2]], [-p.R.ankle[0], cop[2]]];
  // 2 接觸點垂直力：Fy1+Fy2=Fy；x 力矩：Fy1*x1+Fy2*x2 = Fy*xcom(=0)
  const Fy1 = Fy * (0 - contacts[1][0]) / (contacts[0][0] - contacts[1][0]);
  console.log('== 4) 對稱不變量：右腳 GRF 垂直力 雙側解 =', Fy1.toFixed(3), 'N；現有半身 =', (Fy / 2).toFixed(3), 'N');
}
// ---- 1b) 水平力閉合假設：H 取使各腿髖＋膝力矩平方和最小（二次式，格點搜尋）----
console.log('== 1b) 閉合假設比較：H=0 vs 最小化 Σ(M_hip²+M_knee²)');
for (const fs of [0.6, 0.84]) {
  let best = null;
  for (let h = -0.6; h <= 0.8; h += 0.005) {
    const r = split({ stride: 0.75, hipY: 0.62, frontShare: fs, barKg: M, H: h * W });
    const c = r.front.hipNm ** 2 + r.front.kneeNm ** 2 + r.rear.hipNm ** 2 + r.rear.kneeNm ** 2;
    if (!best || c < best.c) best = { c, h, r };
  }
  console.log(`  前腳份額 ${fs}：最佳 H=${best.h.toFixed(2)} BW → 前腿 hip/knee ${best.r.front.hipNm}/${best.r.front.kneeNm}，後腿 ${best.r.rear.hipNm}/${best.r.rear.kneeNm} N·m`);
}
