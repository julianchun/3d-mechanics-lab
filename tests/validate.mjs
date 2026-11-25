// 檢查每個清單項目：整個軌跡成立、清單參數能對回自己、列出峰值最高的肌肉
import { validate, defaultParams, peakAnalysis, LIFTS, analyze } from '../src/biomech.js';
import { CATALOG, matchEntry } from '../src/catalog.js';

let bad = 0;
for (const c of CATALOG) {
  if (c.planned) continue;
  if (!LIFTS[c.lift]) { console.log(`${c.id}: unknown lift ${c.lift}`); bad++; continue; }
  const P = { ...defaultParams(c.lift), ...c.set };
  const err = validate(c.lift, P);
  const m = matchEntry(c.lift, P);
  const top = Object.entries(peakAnalysis(c.lift, P, 12).mus).sort((a, b) => b[1].s - a[1].s).slice(0, 4)
    .map(([k, v]) => `${k} ${v.s.toFixed(2)}`).join(', ');
  const flags = [err && `INVALID: ${err}`, m?.id !== c.id && `MATCHES ${m?.id}`].filter(Boolean);
  if (flags.length) bad++;
  console.log(`${c.id.padEnd(16)} ${flags.join(' ') || 'ok'} | ${top}`);
}
// 前後腳僅延展等效支撐面；壓力中心須落在兩腳外緣，併站仍採單腳接觸範圍。
if (defaultParams('cablefly').footStance !== 'staggered' || defaultParams('pushdown').footStance !== 'parallel') {
  console.log('滑輪站姿預設錯誤'); bad++;
}
for (const lift of ['cablefly', 'pushdown']) for (const e of [0, 0.5, 1]) {
  const staggered = analyze(lift, { ...defaultParams(lift), footStance: 'staggered' }, e).pose;
  const parallel = analyze(lift, { ...defaultParams(lift), footStance: 'parallel' }, e).pose;
  const span = staggered.supportSpan;
  if (!staggered.ok || !span || parallel.supportSpan || parallel.visualLegs ||
      Math.abs(staggered.visualLegs.R.toe[2] - staggered.visualLegs.L.toe[2] - 0.20) > 1e-9 ||
      staggered.cop[2] < span[0] || staggered.cop[2] > span[1]) {
    console.log(`${lift} e=${e}: 前後腳支撐幾何錯誤`); bad++;
  }
}
// 自由深蹲與高腳杯可分開設定膝路徑；舊的跟腳尖幾何仍可重現。
for (const lift of ['squat', 'goblet']) {
  const P = defaultParams(lift);
  for (const e of [0, 0.5, 1]) {
    const f = analyze(lift, { ...P, kneePath: 'forward' }, e).pose;
    const t = analyze(lift, { ...P, kneePath: 'toes' }, e).pose;
    const dx = t.R.knee[0] - t.R.ankle[0], dz = t.R.knee[2] - t.R.ankle[2];
    if (!f.ok || !t.ok || Math.abs(f.R.knee[0] - f.R.ankle[0]) > 1e-9 ||
        Math.abs(dx - dz * t.toeDir[0] / t.toeDir[2]) > 1e-9 ||
        Math.abs(f.kneePath.footShankProxyDeg - f.kneePath.toeDeg) > 1e-9) {
      console.log(`${lift} e=${e}: 膝路徑幾何檢查失敗`); bad++;
    }
  }
  const wide = analyze(lift, { ...P, stance: 1, kneePath: 'forward' }, 1).pose;
  if (wide.kneePath.footShankProxyDeg < 25 || wide.kneePath.shankThighProxyDeg < 25 ||
      !wide.warn.some((x) => x.includes('腳尖、小腿與大腿的水平面方向差較大'))) {
    console.log(`${lift}: 寬站膝路徑提示失敗`); bad++;
  }
  const normal = Array.from({ length: 21 }, (_, i) => analyze(lift, { ...P, kneePath: 'forward' }, i / 20).pose);
  if (normal.some((pose) => pose.warn.some((x) => x.includes('腳尖、小腿與大腿的水平面方向差較大'))) ||
      normal[0].kneePath.shankThighProxyDeg !== null ||
      normal.at(-1).kneePath.shankThighProxyDeg === null) {
    console.log(`${lift}: 預設站距膝路徑誤報或缺少底點資料`); bad++;
  }
}
// 鞋跟墊高：腳掌繞前腳掌抬起，外鞋底仍接地；角度須以腳掌為參考。
for (const [lift, barPos] of [['squat', 'high'], ['squat', 'low'], ['squat', 'front'], ['goblet'], ['smith']]) {
  const P = { ...defaultParams(lift), ...(barPos ? { barPos } : {}) };
  for (const e of [0, 0.5, 1]) {
    const flat = analyze(lift, P, e), raised = analyze(lift, { ...P, heelHeight: 3 }, e);
    const R = raised.pose.R, footAngle = Math.atan2(R.heel[1] - R.toe[1], Math.hypot(R.toe[0] - R.heel[0], R.toe[2] - R.heel[2]));
    const upShank = R.knee.map((v, i) => v - R.ankle[i]);
    const relativeAnkle = Math.atan2(upShank.reduce((s, v, i) => s + v * raised.pose.toeDir[i], 0), upShank.reduce((s, v, i) => s + v * raised.pose.footUp[i], 0));
    const ok = raised.pose.ok && Math.abs(R.heel[1] - R.toe[1] - 0.03) < 1e-10
      && Math.abs(footAngle - Math.asin(0.03 / 0.25)) < 1e-10
      && Math.abs(raised.pose.cop[1]) < 1e-10
      && Math.abs(relativeAnkle - raised.q.ankleDorsi) < 1e-10
      && raised.q.ankleDorsi < flat.q.ankleDorsi
      && R.knee[2] > flat.pose.R.knee[2];
    if (!ok) { console.log(`${lift}/${barPos || ''} e=${e}: 鞋跟／踝角／地面接觸檢查失敗`); bad++; }
  }
}
console.log(bad ? `${bad} problems` : 'all ok');
process.exit(bad ? 1 : 0);
