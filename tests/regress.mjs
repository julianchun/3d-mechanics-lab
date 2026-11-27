// 回歸比對：把每個清單項目在 5 個位置的 analyze() 結果和基準快照比較
//   node tests/regress.mjs          → 比對 tests/snapshots/baseline.json
//   node tests/regress.mjs --update → 重新產生基準（只在確認變更是刻意的之後）
import fs from 'node:fs';
import { analyze, defaultParams, LIFTS } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const FILE = new URL('./snapshots/baseline.json', import.meta.url);
const JOINT_FILE = new URL('./snapshots/joint-moments.json', import.meta.url);
const TOL = 1e-3;
const snap = {};
for (const c of CATALOG) {
  if (!c.lift || !LIFTS[c.lift]) continue;
  const P = { ...defaultParams(c.lift), ...c.set };
  for (const e of [0, 0.25, 0.5, 0.75, 1]) {
    const r = analyze(c.lift, P, e);
    snap[`${c.id}@${e}`] = {
      dem: Object.fromEntries(Object.entries(r.dem).map(([k, v]) => [k, +v.toFixed(4)])),
      mus: Object.fromEntries(Object.entries(r.mus).map(([k, v]) => [k, +v.a.toFixed(4)])),
      warn: r.pose.warn, ok: r.pose.ok,
    };
  }
}
// 肌肉細分可更新肌肉基準；關節外力矩仍須等於細分前的固定物理基準。
const jointBase = JSON.parse(fs.readFileSync(JOINT_FILE));
for (const [key, expected] of Object.entries(jointBase)) {
  const actual = snap[key]?.dem;
  const oldAxes = actual && Object.fromEntries(Object.keys(expected).map((axis) => [axis, actual[axis]]));
  if (JSON.stringify(oldAxes) !== JSON.stringify(expected)) {
    console.error(`關節力矩改變：${key} ${JSON.stringify(expected)} → ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}
if (process.argv.includes('--update')) {
  fs.writeFileSync(FILE, JSON.stringify(snap, null, 1));
  console.log('baseline updated:', Object.keys(snap).length, 'entries');
  process.exit(0);
}
const base = JSON.parse(fs.readFileSync(FILE));
let diffs = 0;
const out = [];
for (const k of new Set([...Object.keys(base), ...Object.keys(snap)])) {
  const a = base[k], b = snap[k];
  if (!a || !b) { out.push(`${a ? 'removed' : 'added'}: ${k}`); diffs++; continue; }
  for (const g of ['dem', 'mus']) for (const m of new Set([...Object.keys(a[g]), ...Object.keys(b[g])])) {
    if (Math.abs((a[g][m] ?? NaN) - (b[g][m] ?? NaN)) > TOL || (a[g][m] === undefined) !== (b[g][m] === undefined)) { out.push(`${k} ${g}.${m}: ${a[g][m]} → ${b[g][m]}`); diffs++; }
  }
  if (JSON.stringify(a.warn) !== JSON.stringify(b.warn)) { out.push(`${k} warn: ${JSON.stringify(a.warn)} → ${JSON.stringify(b.warn)}`); diffs++; }
  if (a.ok !== b.ok) { out.push(`${k} ok: ${a.ok} → ${b.ok}`); diffs++; }
}
console.log(out.slice(0, 200).join('\n'));
console.log(diffs ? `${diffs} differences` : 'IDENTICAL');
process.exit(diffs ? 1 : 0);
