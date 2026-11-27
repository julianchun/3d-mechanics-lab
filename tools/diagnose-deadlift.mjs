// 硬舉起槓平衡診斷：分解踝力矩、系統重心與壓力中心（不改模型，只讀取）。
import { BODY, BAR_RATIO, analyze, defaultParams, solvePose, forcesOf, segmentPoints, footMidZ } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const G = 9.80665;
const cm = (x) => (x * 100).toFixed(2);
for (const id of ['deadlift', 'sumo', 'deficit-dl', 'block-pull']) {
  const it = CATALOG.find((c) => c.id === id);
  const P = { ...defaultParams('deadlift'), ...it.set };
  const pose = solvePose('deadlift', P, 1);
  const W = BODY.mass * G;
  const forces = forcesOf(pose, P, 'deadlift');
  const A = pose.R.ankle;
  console.log(`\n== ${id}（e=1，預設身材 ${BODY.mass} kg，槓 ${BAR_RATIO.deadlift}×BW）`);
  console.log(`z(cm)：踝 ${cm(A[2])}｜腳跟 ${cm(pose.R.heel[2])}｜足中段 ${cm(footMidZ(pose))}｜腳尖 ${cm(pose.R.toe[2])}｜槓 ${cm(pose.bar[2])}`);
  // 系統重心（人＋槓；半身 ×2）
  let M = 0, Z = 0;
  const rows = [];
  for (const [p, m, region] of segmentPoints(pose)) { M += 2 * m; Z += 2 * m * p[2]; rows.push([region, p[2], 2 * m]); }
  const barF = BAR_RATIO.deadlift;
  M += barF; Z += barF * pose.bar[2];
  console.log(`系統重心 z = ${cm(Z / M)} cm（相對足中段 ${cm(Z / M - footMidZ(pose))}，相對踝 ${cm(Z / M - A[2])}）`);
  console.log(`forcesOf 壓力中心 z = ${cm(pose.cop[2])} cm（相對足中段 ${cm(pose.cop[2] - footMidZ(pose))}）`);
  // 各來源對「地面反力矩（繞踝）」與「踝力矩」的貢獻（單位 N·m，半身）
  const out = [];
  let tot = 0;
  for (const f of forces) {
    if (f.region !== 'foot') continue;
    const mz = (f.p[2] - A[2]) * -f.F[1]; // 繞 x 軸的力矩分量（正 = 往前）
    tot += (f.p[2] - A[2]) * f.F[1];
    out.push([f.F[1] < 0 ? '足部重量' : 'GRF', f.p[2], f.F[1], (f.p[2] - A[2]) * f.F[1]]);
  }
  for (const [n, z, Fy, tz] of out) console.log(`  ${n}: z=${cm(z)} Fy=${Fy.toFixed(1)} N 力矩(繞踝)=${tz.toFixed(2)}`);
  // 由上往下：槓＋全身各節段對踝的力矩（半身）
  let up = 0;
  for (const f of forces) if (f.region !== 'foot') up += (f.p[2] - A[2]) * f.F[1];
  console.log(`  足以外各力（人體上方重量＋槓）對踝力矩合計（半身）= ${up.toFixed(2)} N·m（負 = 往前倒）`);
  const grfF = forces.filter((f) => f.region === 'foot' && f.F[1] > 0).reduce((s, f) => s + f.F[1], 0);
  console.log(`  地面反力合計 ${grfF.toFixed(1)} N（半身）；平衡檢查：上方合力 ${(-forces.filter((f) => f.region !== 'foot').reduce((s, f) => s + f.F[1], 0)).toFixed(1)} N`);
  const a = analyze('deadlift', P, 1);
  console.log(`  analyze ankPF = ${a.dem.ankPF.toFixed(2)} N·m（雙側 ×2 = ${(2 * a.dem.ankPF).toFixed(1)}）`);
  console.log(`  軀幹前傾 ${(pose.phi * 180 / Math.PI).toFixed(2)}°，膝 z = ${cm(pose.R.knee[2])}，髖 z = ${cm(pose.R.hip[2])}，肩 z = ${cm(pose.R.shoulder[2])}`);
  // 各節段的貢獻（雙側）相對踝的力臂
  for (const [region, z, m] of rows) console.log(`    ${region.padEnd(6)} z=${cm(z)} 力臂(踝)=${cm(z - A[2])} cm 重量=${(m * W / 1).toFixed(0)} N`);
  console.log(`    槓 z=${cm(pose.bar[2])} 力臂(踝)=${cm(pose.bar[2] - A[2])} cm 重量=${(barF * W).toFixed(0)} N`);
}

// 相撲：每腳額狀面水平地面力、其在膝高的力矩，及投影到 40° 外轉膝軸的分量
{
  const P = { ...defaultParams('deadlift'), style: 'sumo' };
  const pose = solvePose('deadlift', P, 1);
  const forces = forcesOf(pose, P, 'deadlift');
  const g = forces.find((f) => f.region === 'foot' && f.F[1] > 0);
  const K = pose.R.knee;
  const Fx = g.F[0], Fy = g.F[1];
  const hKnee = K[1] - g.p[1];
  const frontal = Math.abs(Fx) * hKnee; // 水平力 × 膝離地面高度（額狀面力矩）
  const ax = [Math.cos(Math.atan2(pose.toeDir[0], pose.toeDir[2])), 0, -Math.sin(Math.atan2(pose.toeDir[0], pose.toeDir[2]))];
  // 完整向量力矩（足＋小腿力對膝），再投影到膝軸（與 analyze 相同定義）
  let M = [0, 0, 0];
  for (const f of forces) if (f.region === 'foot' || f.region === 'shank') {
    const r = [f.p[0] - K[0], f.p[1] - K[1], f.p[2] - K[2]];
    const c = [r[1] * f.F[2] - r[2] * f.F[1], r[2] * f.F[0] - r[0] * f.F[2], r[0] * f.F[1] - r[1] * f.F[0]];
    M = [M[0] - c[0], M[1] - c[1], M[2] - c[2]];
  }
  const proj = -(M[0] * ax[0] + M[1] * ax[1] + M[2] * ax[2]);
  console.log('\n== 相撲：額狀面水平地面力（每腳）');
  console.log(`  水平力 Fx = ${Fx.toFixed(1)} N，垂直力 Fy = ${Fy.toFixed(1)} N，Fx/Fy = ${(Fx / Fy).toFixed(3)}`);
  console.log(`  膝離地高 = ${cm(hKnee)} cm；額狀面力矩 |Fx|×h = ${frontal.toFixed(1)} N·m`);
  console.log(`  膝軸方向（外轉 ${(Math.atan2(pose.toeDir[0], pose.toeDir[2]) * 180 / Math.PI).toFixed(0)}°）：[${ax.map((v) => v.toFixed(3)).join(', ')}]`);
  console.log(`  足＋小腿力對膝的力矩向量 = [${M.map((v) => v.toFixed(1)).join(', ')}] N·m；投影到膝軸（膝伸矩）= ${proj.toFixed(1)} N·m`);
  console.log(`  其中 Fx 貢獻（Fx×膝高×sin 外轉角）≈ ${(frontal * Math.sin(Math.atan2(pose.toeDir[0], pose.toeDir[2]))).toFixed(1)} N·m`);
}
