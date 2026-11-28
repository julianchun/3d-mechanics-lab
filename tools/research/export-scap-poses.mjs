// 唯讀匯出產品姿勢、手臂外力、肩帶需求與各肌肉現行 scElev／scRet 力臂，供獨立的肩胛力臂研究使用。
// 用法：node tools/research/export-scap-poses.mjs 輸出.json [id1,id2,...]
// 不修改 src/；在記憶體副本公開私有的 jointAngles（forcesOf 已是公開匯出）。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATALOG } from '../../src/catalog.js';

const source = readFileSync(resolve('src/biomech.js'), 'utf8');
const marker = 'function jointAngles(pose) {';
if (source.split(marker).length !== 2) throw new Error('找不到唯一的 jointAngles 定義');
const instrumented = source
  .replace(/from '\.\/([\w-]+\.js)'/g, (_, f) => `from '${pathToFileURL(resolve('src', f)).href}'`)
  .replace(marker, `export ${marker}`);
let core;
try {
  core = await import(`data:text/javascript;base64,${Buffer.from(instrumented).toString('base64')}`);
} catch (error) {
  console.error('匯入失敗：', String(error.message).slice(0, 300));
  process.exit(1);
}
const { LIFTS, MUSCLES, analyze, defaultParams, forcesOf, jointAngles, girdleForBody, dot, sub, cross, add, mul } = core;
const deg = 180 / Math.PI;
// 產品局部座標 (lat, u, f) → TSM 胸廓座標 [前, 上, 右]
const osVector = (v, pose) => [dot(v, pose.f), dot(v, pose.u), dot(v, pose.lat)];
const osMoment = (v, pose) => osVector(v, pose).map((n) => -n); // 交換 X／Z 改變手性，力矩是偽向量
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const STEPS = 8;
const entries = [];
for (const item of CATALOG) {
  if (item.planned || (only && !only.has(item.id))) continue;
  const P = { ...defaultParams(item.lift), ...item.set };
  const samples = [];
  for (let i = 0; i <= STEPS; i++) {
    const e = i / STEPS;
    const analysis = analyze(item.lift, P, e);
    const pose = analysis.pose;
    const forces = forcesOf(pose, P, item.lift).filter((f) => f.region === 'upper' || f.region === 'fore');
    const gh = pose.R.shoulder;
    const scj = add(add(add(pose.Pc, mul(pose.lat, girdleForBody().scj[0])), mul(pose.u, girdleForBody().scj[1])), mul(pose.f, girdleForBody().scj[2]));
    const h = sub(pose.R.elbow, gh), hlen = Math.hypot(...h);
    const fore = sub(pose.R.hand, pose.R.elbow);
    const q = jointAngles(pose);
    // 需求：重新以胸鎖關節力矩計算（與 analyze() 的 dem.scRet／scElev 對照）
    let Mg = [0, 0, 0];
    for (const f of forces) Mg = add(Mg, cross(sub(f.p, scj), f.F));
    const arms = {};
    for (const m of MUSCLES) {
      const a = {};
      for (const k of ['scElev', 'scRet']) {
        const v = m.arms[k];
        if (v !== undefined) a[k] = typeof v === 'function' ? v(q) : v;
      }
      if (Object.keys(a).length) arms[m.id] = { F: m.F, ...a };
    }
    const elevation = Math.acos(Math.max(-1, Math.min(1, -osVector(mul(h, 1 / hlen), pose)[1]))) * deg;
    samples.push({
      e, arm_unit_os: osVector(mul(h, 1 / hlen), pose), arm_elevation_deg: elevation,
      arm_plane_deg: Math.atan2(osVector(h, pose)[2], osVector(h, pose)[0]) * deg,
      fore_unit_os: osVector(mul(fore, 1 / Math.hypot(...fore)), pose),
      upper_length_m: hlen, fore_length_m: Math.hypot(...fore),
      girdle_deg: { ret: (pose.girdle?.ret || 0) * deg, elev: (pose.girdle?.elev || 0) * deg },
      gh_rel_scj_os_m: osVector(sub(gh, scj), pose),
      hand_rel_scj_os_m: osVector(sub(pose.R.hand, scj), pose),
      external_forces_os: forces.map((f) => ({ region: f.region, p_rel_gh_m: osVector(sub(f.p, gh), pose), F_N: osVector(f.F, pose) })),
      dem_scElev_Nm: analysis.dem.scElev ?? null, dem_scRet_Nm: analysis.dem.scRet ?? null,
      check_scElev_Nm: dot(Mg, pose.f), check_scRet_Nm: dot(Mg, pose.u),
      product_arms: arms,
      product_activation: Object.fromEntries(Object.entries(analysis.mus).map(([id, m]) => [id, m.s])),
    });
  }
  entries.push({ id: item.id, lift: item.lift, has_scap_dof: LIFTS[item.lift].dofs.includes('scRet'), samples });
}
const result = { modelVersion: core.MODEL_VERSION, units: { angles: 'deg', positions: 'm', forces: 'N', moments: 'Nm' },
  coordinate_system: 'TSM/OpenSim 胸廓：X 前、Y 上、Z 右；由產品軀幹局部 (lat,u,f) 轉成 [f,u,lat]；力矩取偽向量符號', entries };
if (process.argv[2]) writeFileSync(process.argv[2], `${JSON.stringify(result, null, 1)}\n`);
else process.stdout.write(JSON.stringify(result));
