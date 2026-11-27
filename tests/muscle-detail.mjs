// 細分後的合群顯示值，逐動作確認模型力加總與活化、排名指標的 F 加權平均。
import { analyze, defaultParams, MUSCLES, MUSCLE_GROUPS, MUSCLE_GROUP_IDS } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

if (MUSCLE_GROUP_IDS.length !== 32) throw new Error(`一般視圖預期 32 群，收到 ${MUSCLE_GROUP_IDS.length}`);
const byGroup = Object.fromEntries(Object.keys(MUSCLE_GROUPS).map((id) => [id, MUSCLES.filter((m) => m.group === id)]));
for (const [id, children] of Object.entries(byGroup)) if (children.length < 2) throw new Error(`${id} 子部位不足`);
let checked = 0;
for (const c of CATALOG.filter((entry) => entry.lift)) {
  const P = { ...defaultParams(c.lift), ...c.set };
  for (const e of [0, 0.25, 0.5, 0.75, 1]) {
    const mus = analyze(c.lift, P, e).mus;
    for (const [id, children] of Object.entries(byGroup)) {
      const included = children.filter((m) => mus[m.id]);
      if (!included.length) continue;
      if (!mus[id]) throw new Error(`${c.id}@${e} 缺少 ${id} 合群值`);
      const F = included.reduce((s, m) => s + m.F, 0);
      const force = included.reduce((s, m) => s + mus[m.id].force, 0);
      const a = included.reduce((s, m) => s + m.F * mus[m.id].a, 0) / F;
      const rank = included.reduce((s, m) => s + m.F * (Math.min(mus[m.id].a, 1.5) + mus[m.id].p), 0) / F;
      if (Math.abs(mus[id].force - force) > 1e-7 || Math.abs(mus[id].a - a) > 1e-10 || Math.abs(mus[id].s - rank) > 1e-10) {
        throw new Error(`${c.id}@${e} ${id} 合群數值不一致`);
      }
      checked++;
    }
  }
}
console.log(`肌肉細分 PASS：32 個一般群組，${checked} 個合群幀驗證`);
