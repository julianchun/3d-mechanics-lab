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
