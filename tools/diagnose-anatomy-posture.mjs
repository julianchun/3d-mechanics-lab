// 診斷：現行模型的姿勢（小腿角、軀幹角、膝前移、髖後移、系統重心）如何隨骨長比例改變。
// 只讀取模型，不改產品行為；數值寫入 docs/research/anatomy-posture-plan.md。
// 用法：node tools/diagnose-anatomy-posture.mjs [--md]
import fs from 'node:fs';
import { analyze, createBody, defaultParams, withBody, segmentPoints, footMidZ, DEFAULT_BODY } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const deg = (x) => x * 180 / Math.PI;
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => Math.sqrt(xs.reduce((a, b) => a + (b - mean(xs)) ** 2, 0) / (xs.length - 1));
const anthro = JSON.parse(fs.readFileSync(new URL('../validation/anthropometry/ansur-ii-ratios.json', import.meta.url)));
const idx = Object.fromEntries(anthro.keys.map((k, i) => [k, i]));
const cv = Object.fromEntries(anthro.keys.map((k, i) => {
  const col = anthro.male.map((r) => r[i]);
  return [k, sd(col) / mean(col)];
}));

// 以預設身體的比例為中心，單一節段比例乘 (1 + n × CV)；其餘比例不動（身高固定）。
function variant(changes, extra = {}) {
  const h = DEFAULT_BODY.heightM, ratios = {};
  for (const k of anthro.keys) ratios[k] = DEFAULT_BODY[k] / h * (1 + (changes[k] || 0) * cv[k]);
  return createBody({ heightM: h, massKg: 75, sex: 'male', ratios, ...extra });
}
const bodies = [
  ['參考 1.75 m 男', createBody()],
  ['股骨 +1 SD', variant({ Lt: 1 })], ['股骨 −1 SD', variant({ Lt: -1 })],
  ['軀幹 +1 SD', variant({ Ltr: 1 })], ['軀幹 −1 SD', variant({ Ltr: -1 })],
  ['小腿 +1 SD', variant({ Ls: 1 })], ['小腿 −1 SD', variant({ Ls: -1 })],
  ['長股骨＋短軀幹＋短小腿（各 1 SD）', variant({ Lt: 1, Ltr: -1, Ls: -1 })],
  ['短股骨＋長軀幹＋長小腿（各 1 SD）', variant({ Lt: -1, Ltr: 1, Ls: 1 })],
  ['1.50 m 女 50 kg（等比）', createBody({ heightM: 1.5, massKg: 50, sex: 'female' })],
  ['2.00 m 男 110 kg（等比）', createBody({ heightM: 2, massKg: 110, sex: 'male' })],
];
const lifts = ['squat-high', 'squat-low', 'front-squat', 'goblet-squat', 'deadlift', 'good-morning', 'rdl'];
const catalog = new Map(CATALOG.map((c) => [c.id, c]));

function metrics(body, id, e = 1) {
  return withBody(body, () => {
    const entry = catalog.get(id), P = { ...defaultParams(entry.lift), ...entry.set };
    const r = analyze(entry.lift, P, e), p = r.pose, R = p.R;
    const shank = sub(R.knee, R.ankle), thigh = sub(R.knee, R.hip);
    const parts = segmentPoints(p).map(([q, m]) => [2 * m, q[2]]);
    if (p.bar && p.barW) parts.push([p.barW, p.bar[2]]);
    const M = parts.reduce((s, [m]) => s + m, 0), com = parts.reduce((s, [m, z]) => s + m * z, 0) / M;
    return {
      ok: p.ok, shankDeg: deg(Math.atan2(shank[2], shank[1])), trunkDeg: deg(p.phi),
      thighDeg: deg(Math.atan2(Math.abs(thigh[2]), -thigh[1])),
      kneeFwdCm: (R.knee[2] - R.ankle[2]) * 100, hipBackCm: (R.hip[2] - R.ankle[2]) * 100,
      hipHeightCm: R.hip[1] * 100, comCm: (com - footMidZ(p)) * 100,
    };
  });
}
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
const out = [];
for (const id of lifts) {
  out.push(`\n### ${id}（e = 1，預設參數）\n`);
  out.push('| 身體 | 小腿前傾 ° | 軀幹前傾 ° | 大腿對垂直 ° | 膝前移 cm | 髖後移 cm | 髖高 cm | 系統重心−足中點 cm | ok |');
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|---|');
  let ref;
  for (const [name, body] of bodies) {
    const m = metrics(body, id);
    if (!ref) ref = m;
    out.push(`| ${name} | ${f(m.shankDeg)} | ${f(m.trunkDeg)} | ${f(m.thighDeg)} | ${f(m.kneeFwdCm)} | ${f(m.hipBackCm)} | ${f(m.hipHeightCm)} | ${f(m.comCm)} | ${m.ok ? '是' : '否'} |`);
  }
}
// 行程內的小腿角跨身體 SD（只看 ANSUR 單節段變化的變體）
out.push('\n### 小腿角隨身材的變異（e = 0.25、0.5、0.75、1；七個 ANSUR ±1 SD 變體的 SD，°）\n');
out.push('| 動作 | 小腿角 SD | 軀幹角 SD |');
out.push('|---|---:|---:|');
for (const id of lifts) {
  const sh = [], tr = [];
  for (const e of [0.25, 0.5, 0.75, 1]) {
    const ms = bodies.slice(0, 9).map(([, b]) => metrics(b, id, e));
    sh.push(sd(ms.map((m) => m.shankDeg))); tr.push(sd(ms.map((m) => m.trunkDeg)));
  }
  out.push(`| ${id} | ${sh.map((x) => f(x, 2)).join(' / ')} | ${tr.map((x) => f(x, 2)).join(' / ')} |`);
}
console.log(out.join('\n'));
console.log('\nANSUR II 男性 CV（SD/平均）：' + anthro.keys.map((k) => `${k} ${f(cv[k] * 100, 2)}%`).join('、'));
