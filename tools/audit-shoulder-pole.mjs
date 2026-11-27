// 63 項清單的全程峰值排名與超載點數；每點使用與合理性檢查相同的 1/40 行程網格。
import { CATALOG } from '../src/catalog.js';
import { analyze, defaultParams, MUSCLE_GROUP_IDS, MUSCLES } from '../src/biomech.js';

const rows = {};
const groupIds = new Set(MUSCLE_GROUP_IDS);
const detailIds = new Set(MUSCLES.map((m) => m.id));
for (const item of CATALOG.filter((c) => c.lift)) {
  const P = { ...defaultParams(item.lift), ...item.set };
  const peaks = new Map(), aPeaks = new Map();
  let overGroupPoints = 0, overDetailPoints = 0, overGroupEvents = 0, overDetailEvents = 0;
  for (let i = 0; i <= 40; i++) {
    const mus = analyze(item.lift, P, i / 40).mus;
    let groupOver = false, detailOver = false;
    for (const [id, x] of Object.entries(mus)) {
      if (groupIds.has(id)) {
        peaks.set(id, Math.max(peaks.get(id) || 0, x.s));
        if (x.a > 1.000001) { groupOver = true; overGroupEvents++; }
      }
      if (detailIds.has(id)) {
        aPeaks.set(id, Math.max(aPeaks.get(id) || 0, x.a));
        if (x.a > 1.000001) { detailOver = true; overDetailEvents++; }
      }
    }
    if (groupOver) overGroupPoints++;
    if (detailOver) overDetailPoints++;
  }
  rows[item.id] = {
    top4: [...peaks].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, s]) => [id, +s.toFixed(4)]),
    overGroupPoints, overDetailPoints, overGroupEvents, overDetailEvents,
    aPeaks: Object.fromEntries([...aPeaks].map(([id, a]) => [id, +a.toFixed(4)])),
  };
}
console.log(JSON.stringify(rows, null, 2));
