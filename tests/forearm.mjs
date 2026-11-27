// 前臂旋轉角、外力矩與肌肉平衡；文獻門檻先固定，失敗如實列為已知問題。
import { analyze, defaultParams, LIFTS, liftMuscles, peakAnalysis, forearmAxialDemand } from '../src/biomech.js';
import { forearmArm } from '../src/forearm.js';

const near = (a, b, tol, label) => { if (Math.abs(a - b) > tol) throw new Error(`${label}: ${a} ≠ ${b}`); };
for (const [name, lift] of Object.entries(LIFTS)) {
  if (lift.dofs.includes('elbExt') && !lift.dofs.includes('foreRot')) throw new Error(`${name} 缺少前臂旋轉平衡`);
}
for (const [grip, expected] of [['sup', -80], ['pro', 80]]) {
  const r = analyze('curl', { ...defaultParams('curl'), supin: grip }, 0.5);
  near(r.q.foreRot * 180 / Math.PI, expected, 1e-8, `${grip} 角度`);
  near(r.dem.foreRot, 0, 1e-8, `${grip} 掌心通過握把的軸向外力矩`);
}
near(analyze('dbcurl', { ...defaultParams('dbcurl'), grip: 'neutral' }, 0.5).q.foreRot, 0, 1e-8, '中立握角度');
near(forearmAxialDemand([{ p: [0, 1, 0], F: [100, 0, 0], region: 'fore' }], [0, 0, 0], [0, 1, 0]), 0, 1e-8, '掌心通軸');
near(forearmAxialDemand([{ p: [0, 1, 0.05], F: [100, 0, 0], region: 'fore' }], [0, 0, 0], [0, 1, 0]), -5, 1e-8, '偏心 5 cm 的 100 N 握把');
const q = { elbFlex: Math.PI / 2, foreRot: 0 };
if (!(forearmArm('bicLong', 'foreRot', q) < 0 && forearmArm('pronatorTeres', 'foreRot', q) > 0 &&
      forearmArm('pronatorQuadratus', 'foreRot', q) > 0 && forearmArm('supinator', 'foreRot', q) < 0))
  throw new Error('前臂力臂方向錯誤');
for (const [lift, grip] of [['curl', 'sup'], ['curl', 'pro'], ['dbcurl', 'neutral'], ['pullup', 'sup']]) {
  const P = { ...defaultParams(lift), ...(lift === 'curl' ? { supin: grip } : { grip }) };
  for (let i = 0; i <= 20; i++) {
    const r = analyze(lift, P, i / 20);
    const produced = liftMuscles(lift).reduce((sum, m) => {
      const arm = m.arms.foreRot;
      return sum + (r.mus[m.id]?.force || 0) * (typeof arm === 'function' ? arm(r.q) : arm || 0);
    }, 0);
    near(produced, r.dem.foreRot, 0.03, `${lift} ${grip}@${i / 20} 前臂力矩平衡`);
  }
}

const peak = (lift, patch, muscle) => peakAnalysis(lift, { ...defaultParams(lift), ...patch }).mus[muscle].a;
const checks = [
  // Coratella 2023 PMID 36976950：雙側彎舉向心期二頭肌反握高於正握及中立握。
  ['反握彎舉二頭肌高於正握', peak('curl', { supin: 'sup' }, 'bic') > peak('curl', { supin: 'pro' }, 'bic')],
  ['反握啞鈴彎舉二頭肌高於中立握', peak('dbcurl', { grip: 'sup' }, 'bic') > peak('dbcurl', { grip: 'neutral' }, 'bic')],
  // 同研究的肱橈肌向心期反握高於正握；與 Kleiber 2015 單關節屈肘結果相反。
  ['反握彎舉肱橈肌高於正握', peak('curl', { supin: 'sup' }, 'brachioradialis') > peak('curl', { supin: 'pro' }, 'brachioradialis')],
];
const KNOWN_ISSUES = new Set(['反握彎舉肱橈肌高於正握']);
for (const [name, passed] of checks) {
  if (!passed && !KNOWN_ISSUES.has(name)) throw new Error(`未列已知問題的文獻趨勢失敗：${name}`);
  if (passed && KNOWN_ISSUES.has(name)) throw new Error(`已知問題已通過，請移除：${name}`);
  console.log(`${passed ? 'PASS' : 'KNOWN_ISSUE'}：${name}`);
}
console.log('前臂旋轉與力矩平衡 PASS');
