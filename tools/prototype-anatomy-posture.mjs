// 方案原型（只供設計評估）：把 src/ 複製到暫存目錄，替深蹲／高腳杯的小腿角加一個 P._dTh 偏移，
// 在暫存副本外層求解各方案的偏移。不修改 src/；產品行為與回歸基準不受影響。
// 用法：node tools/prototype-anatomy-posture.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const srcDir = new URL('../src/', import.meta.url).pathname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anatomy-proto-'));
fs.cpSync(srcDir, path.join(tmp, 'src'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
const file = path.join(tmp, 'src/biomech.js');
let code = fs.readFileSync(file, 'utf8');
const pattern = /(thS = flatShank \+ \(foot\?\.a \|\| 0\) \* heelShankShare \* e);/g;
if ((code.match(pattern) || []).length !== 2) throw new Error('找不到小腿角那兩行，原型補丁失效');
code = code.replace(pattern, '$1 + (P._dTh || 0);');
fs.writeFileSync(file, code);
const M = await import(pathToFileURL(file).href);
const { CATALOG } = await import(pathToFileURL(path.join(tmp, 'src/catalog.js')).href);

const deg = (x) => x * 180 / Math.PI;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const catalog = new Map(CATALOG.map((c) => [c.id, c]));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => Math.sqrt(xs.reduce((a, b) => a + (b - mean(xs)) ** 2, 0) / (xs.length - 1));
const anthro = JSON.parse(fs.readFileSync(new URL('../validation/anthropometry/ansur-ii-ratios.json', import.meta.url)));
const cv = Object.fromEntries(anthro.keys.map((k, i) => { const c = anthro.male.map((r) => r[i]); return [k, sd(c) / mean(c)]; }));
const variant = (changes) => {
  const h = M.DEFAULT_BODY.heightM, ratios = {};
  for (const k of anthro.keys) ratios[k] = M.DEFAULT_BODY[k] / h * (1 + (changes[k] || 0) * cv[k]);
  return M.createBody({ heightM: h, massKg: 75, sex: 'male', ratios });
};

export function pose(id, body, e, dTh = 0) {
  const entry = catalog.get(id), P = { ...M.defaultParams(entry.lift), ...entry.set, _dTh: dTh };
  return M.withBody(body, () => {
    const r = M.analyze(entry.lift, P, e), p = r.pose, R = p.R;
    const sh = sub(R.knee, R.ankle);
    return { ok: p.ok, shank: deg(Math.atan2(sh[2], sh[1])), trunk: deg(p.phi), dem: r.dem, hipBack: (R.hip[2] - R.ankle[2]) * 100 };
  });
}
// 方案 A：在平衡（由姿勢求解本身保證）下，最小化 J = (Δθ/σθ)² + ((φ − φref)/σφ)²，並限制小腿角 ≤ θmax。
// φref、θref 取參考身體（預設 1.75 m 男）在同一動作、同一行程點的值；參考身體的 Δθ = 0、J = 0，姿勢不變。
export function solveA(id, body, e, { lambda, thetaMax = 90 }) {
  const ref = pose(id, M.DEFAULT_BODY, e);
  const cost = (d) => { const p = pose(id, body, e, d * Math.PI / 180); return ((d * lambda) ** 2 + (p.trunk - ref.trunk) ** 2); };
  const limit = Math.max(0, thetaMax - ref.shank);
  let lo = -10, hi = Math.min(25, limit);
  for (let i = 0; i < 30; i++) { // 三分搜尋；J 對 Δθ 為單峰
    const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
    if (cost(a) < cost(b)) hi = b; else lo = a;
  }
  const d = (lo + hi) / 2;
  return { d, ...pose(id, body, e, d * Math.PI / 180), ref };
}


// 方案 B：最小化 Σ(M_k/M_k0)²，M_k0 為「同一身體、Δθ = 0」的關節需求（k = 髖、膝、踝、腰背）。
// 為使參考身體的姿勢不變，另加常數偏移 d0（參考身體的最佳 Δθ）；非參考身體的偏移 = 自己的最佳 Δθ − d0。
export function solveB(id, body, e, thetaMax = 90) {
  const base = pose(id, body, e), keys = ['hipExt', 'kneeExt', 'ankPF', 'trunkExt'];
  const cost = (d) => { const q = pose(id, body, e, d * Math.PI / 180).dem; return keys.reduce((a, k) => a + (q[k] / base.dem[k]) ** 2, 0); };
  let lo = -15, hi = Math.min(25, thetaMax - base.shank);
  for (let i = 0; i < 30; i++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; if (cost(a) < cost(b)) hi = b; else lo = a; }
  return (lo + hi) / 2;
}

const f = (x, n = 1) => x.toFixed(n);
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const bodies = [['參考', M.createBody()], ['股骨 +1 SD', variant({ Lt: 1 })], ['股骨 −1 SD', variant({ Lt: -1 })],
    ['軀幹 +1 SD', variant({ Ltr: 1 })], ['小腿 +1 SD', variant({ Ls: 1 })], ['小腿 −1 SD', variant({ Ls: -1 })],
    ['長股骨＋短軀幹＋短小腿', variant({ Lt: 1, Ltr: -1, Ls: -1 })], ['短股骨＋長軀幹＋長小腿', variant({ Lt: -1, Ltr: 1, Ls: 1 })],
    ['2.00 m 男 110 kg', M.createBody({ heightM: 2, massKg: 110 })], ['1.50 m 女 50 kg', M.createBody({ heightM: 1.5, massKg: 50, sex: 'female' })]];
  for (const id of ['squat-high', 'squat-low', 'front-squat']) {
    console.log(`\n## 方案 A 原型：${id}，e = 1（λ = σφ/σθ；λ = 1 代表小腿偏離 1° 與軀幹偏離 1° 代價相同）`);
    console.log('| 身體 | 現行（λ→∞）小腿° / 軀幹° | λ=0.05（近似軀幹不變）小腿° / 軀幹° | λ=0.5 小腿° / 軀幹° | λ=1 小腿° / 軀幹° | λ=2 小腿° / 軀幹° | λ=1 且 θmax=35° |');
    console.log('|---|---:|---:|---:|---:|---:|---:|');
    for (const [name, b] of bodies) {
      const cur = pose(id, b, 1);
      const cells = [0.05, 0.5, 1, 2].map((l) => { const r = solveA(id, b, 1, { lambda: l }); return `${f(r.shank)} / ${f(r.trunk)}`; });
      const cap = solveA(id, b, 1, { lambda: 1, thetaMax: 35 });
      console.log(`| ${name} | ${f(cur.shank)} / ${f(cur.trunk)} | ${cells.join(' | ')} | ${f(cap.shank)} / ${f(cap.trunk)} |`);
    }
  }
  // 方案 B 對參考身體的一致性：只最小化 Σ（正規化關節需求）² 時，最佳小腿角在哪？
  console.log('\n## 方案 B 檢查：參考身體，e = 1，掃小腿角偏移 Δθ，看各關節需求（Nm，雙側合計以模型單側右腿值為準）');
  for (const id of ['squat-high', 'front-squat']) {
    console.log(`\n${id}`);
    console.log('| Δθ ° | 小腿° | 軀幹° | hipExt | kneeExt | ankPF | trunkExt | Σ(M/Mref)² |');
    console.log('|---:|---:|---:|---:|---:|---:|---:|---:|');
    const base = pose(id, M.DEFAULT_BODY, 1);
    for (const d of [-10, -6, -3, 0, 3, 6, 10]) {
      const p = pose(id, M.DEFAULT_BODY, 1, d * Math.PI / 180), q = p.dem;
      const s = ['hipExt', 'kneeExt', 'ankPF', 'trunkExt'].reduce((a, k) => a + (q[k] / base.dem[k]) ** 2, 0);
      console.log(`| ${d} | ${f(p.shank)} | ${f(p.trunk)} | ${f(q.hipExt, 0)} | ${f(q.kneeExt, 0)} | ${f(q.ankPF, 0)} | ${f(q.trunkExt, 0)} | ${f(s, 3)} |`);
    }
  }

  // 與 Demers 2018（校準組）的相關對照：踝背屈對大腿／小腿長度比的斜率。
  // Demers 表 1：軀幹 0.54±0.03、大腿 0.40±0.03、小腿 0.40±0.03 m（獨立常態、固定種子）；150% 站距、大腿 50° 事件。
  // 文獻只報相關係數 r = 0.35–0.45（n = 32，信賴區間很寬），無斜率；以下斜率僅用於檢查數量級。
  {
    let st = 12345;
    const rnd = () => { st ^= st << 13; st ^= st >>> 17; st ^= st << 5; return (st >>> 0) / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd());
    const people = Array.from({ length: 60 }, () => ({ tr: 0.54 + 0.03 * gauss(), th: 0.40 + 0.03 * gauss(), sh: 0.40 + 0.03 * gauss() }));
    const entry = catalog.get('squat-high'), h = 1.75, keys = ['Ls', 'Lt', 'Ltr', 'Lu', 'Lf', 'hipHalf', 'shHalf', 'ankleH'];
    const bodiesD = people.map((q) => {
      const r = Object.fromEntries(keys.map((k) => [k, M.DEFAULT_BODY[k] / h]));
      r.Ls = q.sh / h * (M.DEFAULT_BODY.Ls / 0.40) / 1; r.Lt = q.th / h * (M.DEFAULT_BODY.Lt / 0.40); r.Ltr = q.tr / h * (M.DEFAULT_BODY.Ltr / 0.54);
      return { q, body: M.createBody({ heightM: h, massKg: 75, ratios: r }) };
    });
    const e = 50 / (70 + 48 * 0.55); // 大腿 ≈ 50°（股骨角 = 96.4° × e）
    const slope = (xs, ys) => { const mx = mean(xs), my = mean(ys); return xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0); };
    console.log('\n## Demers 相關對照：150% 站距、大腿 50° 的踝背屈對 大腿/小腿 長度比 的斜率（°／單位比值；文獻 r≈0.35–0.45，SD 比值 0.04）');
    console.log('| 設定 | 斜率 | 比值 +1 SD（0.04）的踝角變化 ° |');
    console.log('|---|---:|---:|');
    const xs = bodiesD.map(({ q }) => q.th / q.sh);
    const params = { stance: 0.024 }; // Demers 150% 站距的代理換算（見 validation/calibration/demers-2018.json）
    const entryP = { ...entry, set: { ...entry.set, ...params } };
    const orig = catalog.get('squat-high'); catalog.set('squat-high', entryP);
    const cur = bodiesD.map(({ body }) => pose('squat-high', body, e).shank);
    console.log(`| 現行（λ→∞，小腿角固定） | ${f(slope(xs, cur), 1)} | ${f(0.04 * slope(xs, cur), 2)} |`);
    for (const l of [2, 1, 0.5]) {
      const ys = bodiesD.map(({ body }) => solveA('squat-high', body, e, { lambda: l }).shank);
      console.log(`| 方案 A，λ = ${l} | ${f(slope(xs, ys), 1)} | ${f(0.04 * slope(xs, ys), 2)} |`);
    }
    catalog.set('squat-high', orig);
  }
  console.log('\n## 方案 B：以參考身體最佳 Δθ 為零點的相對偏移（e = 1）');
  console.log('| 動作 | 身體 | 自己的最佳 Δθ ° | 相對參考的偏移 ° |');
  console.log('|---|---|---:|---:|');
  for (const id of ['squat-high', 'front-squat']) {
    const d0 = solveB(id, M.DEFAULT_BODY, 1);
    for (const [name, b] of bodies.slice(0, 8)) { const d = solveB(id, b, 1); console.log(`| ${id} | ${name} | ${f(d)} | ${f(d - d0)} |`); }
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
