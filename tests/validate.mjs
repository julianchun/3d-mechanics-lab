// 檢查每個清單項目：整個軌跡成立、清單參數能對回自己、列出峰值最高的肌肉
import { validate, defaultParams, peakAnalysis, LIFTS } from '../src/biomech.js';
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
console.log(bad ? `${bad} problems` : 'all ok');
process.exit(bad ? 1 : 0);
