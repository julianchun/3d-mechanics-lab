import { readFileSync } from 'node:fs';
import { CATALOG } from '../src/catalog.js';
import { CUES } from '../src/cues.js';

const principles = readFileSync(new URL('../docs/research/technique-principles.md', import.meta.url), 'utf8');
const validCodes = new Set([...principles.matchAll(/^\| (G[1-8]|[SHPVLDU][1-9]|M[1-9]) \|/gm)].map((m) => m[1]));
const ids = new Set(CATALOG.map((entry) => entry.id));
const errors = [];
for (const id of Object.keys(CUES)) if (!ids.has(id)) errors.push(`${id}: 不在清單中`);
for (const entry of CATALOG) {
  const card = CUES[entry.id];
  if (!card) { errors.push(`${entry.id}: 缺少動作要點`); continue; }
  for (const [group, min, max] of [['setup', 2, 3], ['motion', 2, 3], ['breath', 1, 2], ['errors', 1, 2]]) {
    const points = card[group];
    if (!Array.isArray(points) || points.length < min || points.length > max) {
      errors.push(`${entry.id}/${group}: 應有 ${min}–${max} 點`); continue;
    }
    for (const point of points) {
      if (!point.text?.trim() || !point.principles?.length) errors.push(`${entry.id}/${group}: 文字或原則缺漏`);
      for (const code of point.principles || []) if (!validCodes.has(code)) errors.push(`${entry.id}/${group}: 未定義原則 ${code}`);
    }
  }
  if (!card.breath.some((point) => point.principles.includes('G6'))) errors.push(`${entry.id}: 呼吸缺 G6`);
  if (['bench', 'incline-bench', 'cg-bench', 'floor-press', 'db-bench', 'db-bench-incline'].includes(entry.id) &&
      !card.breath.some((point) => point.text.includes('胸廓擴張'))) errors.push(`${entry.id}: 臥推缺全程胸廓提示`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`動作要點 PASS：${CATALOG.length} 項；原則編號均可在文件查得`);
