// 依教練原則掃描每個清單預設；輸出為模型稽核，不是人體安全或增肌判定。
import fs from 'node:fs';
import { analyze, defaultParams, MUSCLE_BY_ID } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const data = JSON.parse(fs.readFileSync(new URL('./technique-targets.json', import.meta.url)));
const output = new URL('../docs/research/results/technique-audit.md', import.meta.url);
const freeFootLifts = new Set(['squat', 'goblet', 'deadlift', 'rdl', 'goodmorning', 'row', 'dbreversefly',
  'cablefly', 'ohp', 'uprow', 'pushdown', 'curl', 'latraise', 'dbcurl', 'shrug']);
// 依 limitations.md 中已列的肌肉分配偏差；未在此列者僅標成姿勢／模型待判讀。
const knownModel = new Set(['cg-bench', 'db-bench-incline', 'reverse-deck', 'machine-press', 'db-press',
  'dips', 'dips-upright', 'row', 'row-sup', 'cable-row', 'cable-row-wide', 'db-reverse-fly',
  'uprow', 'pulldown', 'pulldown-sup', 'pullup', 'pullup-wide', 'chinup', 'assist-pullup',
  'assist-chinup', 'reverse-curl', 'hammer-curl']);
const deg = (x) => x * 180 / Math.PI;
const fmt = (x, n = 1) => Number(x).toFixed(n);
const esc = (s) => String(s).replaceAll('|', '／').replaceAll('\n', ' ');
const active = CATALOG.filter((c) => !c.planned);
const targetIds = Object.keys(data.entries);
if (active.length !== 63 || targetIds.length !== active.length ||
    active.some((c) => !data.patterns[data.entries[c.id]]) ||
    targetIds.some((id) => !active.some((c) => c.id === id))) throw new Error('目標肌群資料須逐項覆蓋 63 個清單項目');
for (const pattern of Object.values(data.patterns)) {
  if (!pattern.source || !pattern.groups.length || pattern.groups.some((g) =>
    !g.name || !g.ids.length || g.ids.some((id) => !MUSCLE_BY_ID[id]))) throw new Error('目標肌群來源或肌肉 ID 無效');
}

const rows = [], misses = [], counts = { '符合': 0, '需複查': 0, '不符合': 0 };
for (const entry of active) {
  const P = { ...defaultParams(entry.lift), ...entry.set };
  const results = Array.from({ length: 21 }, (_, i) => analyze(entry.lift, P, i / 20));
  const pattern = data.patterns[data.entries[entry.id]];
  const peaks = {};
  for (const r of results) for (const [id, m] of Object.entries(r.mus)) peaks[id] = Math.max(peaks[id] ?? 0, m.a);
  const order = Object.keys(peaks).sort((a, b) => peaks[b] - peaks[a] || a.localeCompare(b));
  const ranks = pattern.groups.map((g) => ({ name: g.name,
    rank: Math.min(...g.ids.map((id) => order.indexOf(id) < 0 ? Infinity : order.indexOf(id) + 1)),
    muscle: g.ids.slice().sort((a, b) => peaks[b] - peaks[a])[0] }));
  const missed = ranks.filter((g) => g.rank > 3);
  const warnings = [...new Set(results.flatMap((r) => r.pose.warn || []))];
  const rom = [...new Set(results.flatMap((r) => Object.values(r.rom || {})))];
  const badPose = results.filter((r) => !r.pose.ok);
  let cop = null;
  if (freeFootLifts.has(entry.lift)) {
    const samples = results.map(({ pose }) => {
      if (!pose.cop || !pose.R.heel || !pose.R.toe) throw new Error(`${entry.id} 缺少腳底接觸幾何`);
      const mid = (pose.R.heel[2] + pose.R.toe[2]) / 2;
      return { delta: (pose.cop[2] - mid) * 100,
        outside: pose.cop[2] < Math.min(pose.R.heel[2], pose.R.toe[2]) - 1e-9 ||
          pose.cop[2] > Math.max(pose.R.heel[2], pose.R.toe[2]) + 1e-9 };
    });
    cop = { max: samples.reduce((a, b) => Math.abs(a.delta) > Math.abs(b.delta) ? a : b).delta,
      outside: samples.some((x) => x.outside) };
  }
  const knees = results.map((r) => r.pose.kneePath).filter(Boolean);
  const kneeText = knees.length ? `膝 ${fmt(knees.at(-1).pathDeg)}°／腳尖 ${fmt(knees.at(-1).toeDeg)}°；腳尖－小腿 ${fmt(Math.max(...knees.map((k) => Math.abs(k.footShankProxyDeg))))}°；小腿－大腿 ${fmt(Math.max(...knees.map((k) => Math.abs(k.shankThighProxyDeg ?? 0))))}°` : '—';
  const angleParts = [['髖屈', 'hipFlex', 136], ['膝屈', 'kneeFlex', 138], ['踝背屈', 'ankleDorsi', 36],
    ['舉臂', 'shElev', 178], ['肘屈', 'elbFlex', 140]].filter(([, key]) => results.some((r) => Number.isFinite(r.q[key])))
    .map(([name, key, hint]) => {
      const value = Math.max(...results.map((r) => Number.isFinite(r.q[key]) ? deg(r.q[key]) : -Infinity));
      return `${name} ${fmt(value)}°（${value >= 0 ? `${fmt(value / hint * 100, 0)}% 模型提示線` : '反方向，未達此提示線'}）`;
    });
  if (Number.isFinite(P.flare)) angleParts.push(`肘外展設定 ${fmt(P.flare, 0)}°`);
  if (Number.isFinite(P.topHeight)) angleParts.push(`上舉設定 ${fmt(P.topHeight, 0)}°`);
  const reasons = [];
  if (badPose.length) reasons.push(`姿勢無法成立 ${badPose.length}/21 點`);
  if (cop?.outside) reasons.push('壓力中心超出腳掌接觸範圍');
  else if (cop && Math.abs(cop.max) > 5) reasons.push('壓力中心偏離中段超過 5 cm');
  if (missed.length) {
    const category = knownModel.has(entry.id) ? '已知肌肉模型問題' : '姿勢預設／肌肉模型待教練判定';
    reasons.push(`${category}：${missed.map((x) => x.name).join('、')}未進前三`);
    misses.push({ entry, missed, category });
  }
  if (rom.length) reasons.push(`模型 ROM 提示：${rom.join('、')}`);
  if (warnings.length) reasons.push(`姿勢提示：${warnings.join('；')}`);
  const status = badPose.length || cop?.outside ? '不符合' : reasons.length ? '需複查' : '符合';
  counts[status]++;
  rows.push(`| ${entry.name} | ${status} | ${cop ? `${cop.max >= 0 ? '+' : ''}${fmt(cop.max)} cm${cop.outside ? '（越界）' : ''}` : '不適用'} | ${ranks.map((r) => `${r.name} #${Number.isFinite(r.rank) ? r.rank : '—'}`).join('；')} | ${kneeText} | ${angleParts.join('；') || '—'} | ${esc(reasons.join('；') || '量化項目無提示')} |`);
}

const lines = [
  '# 預設動作技術原則稽核', '',
  `使用預設身體（1.75 m、75 kg）與 63 個清單項目的預設參數，每項取全行程 21 點。結果：符合 ${counts['符合']}、需複查 ${counts['需複查']}、不符合 ${counts['不符合']}。`, '',
  '「符合」只表示本工具可量化的檢查沒有提示，不代表個人安全、動作正確或增肌效果。姿勢／壓力中心越界列「不符合」；壓力中心偏離腳掌幾何中段超過 ±5 cm、模型 ROM 與姿勢提示、目標肌群未進前三列「需複查」。±5 cm 是教練指定的複查值，不是文獻安全線。', '',
  '自由站姿以腳跟至腳尖的前後接觸範圍檢查 `pose.cop`。史密斯、哈克、腿推、臀推、伏地挺身、提踵機等有軌道、墊子或多接點支撐，不套用單腳掌判準。目標肌排名是各肌肉在 21 點中的最高模型活化 `a` 的排序；目標群組與依據見 [`tools/technique-targets.json`](../../../tools/technique-targets.json) 及[技術原則](../technique-principles.md)。肌肉排名只是模型觀察。', '',
  '角度欄為全程模型最大值與程式 `rom` 提示角的比例（髖 136°、膝 138°、踝 36°、舉臂 178°、肘 140°）；肘外展等為設定值。提示角是啟發式，**不是個人活動範圍或負重安全界線**；沒有個人活動度、疼痛與通用負重門檻，角度數值均**待教練決定**。腳尖－小腿、小腿－大腿的水平投影方向差是幾何代理，**不是實際脛股旋轉角**；25° 警示只是幾何人工複查設定。史密斯使用固定膝位求解器，未共用自由深蹲的 `kneePath`。', '',
  '| 動作 | 結果 | 壓力中心離中段最大偏移 | 目標肌群最高排名 | 膝路徑 | 角度／設定（待教練決定） | 原因 |',
  '| --- | --- | ---: | --- | --- | --- | --- |', ...rows, '',
  '## 目標肌群未進前三', '',
  misses.length ? '| 動作 | 分類 | 未進前三的目標肌群 |\n| --- | --- | --- |\n' + misses.map((x) => `| ${x.entry.name} | ${x.category} | ${x.missed.map((m) => `${m.name} #${Number.isFinite(m.rank) ? m.rank : '—'}`).join('；')} |`).join('\n') : '無。', '',
  '已知肌肉模型問題的分類依[模型限制與已知問題](../limitations.md)；其餘為姿勢預設或肌肉模型待教練判定，不能僅憑排名調整姿勢。胸廓擴張、呼吸、腰椎分段、腕角、真實脛股旋轉、個人疼痛與足底壓力分布目前無法稽核。'
];
fs.writeFileSync(output, lines.join('\n') + '\n');
console.log(`技術稽核：符合 ${counts['符合']}、需複查 ${counts['需複查']}、不符合 ${counts['不符合']}；目標肌群未進前三 ${misses.length} 項`);
