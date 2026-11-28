// 依教練原則掃描每個清單預設；輸出為模型稽核，不是人體安全或增肌判定。
import fs from 'node:fs';
import { analyze, BAR_RATIO, defaultParams, MUSCLE_BY_ID, ROM_HINTS, scapulaLocal } from '../src/biomech.js';
import { CATALOG } from '../src/catalog.js';

const data = JSON.parse(fs.readFileSync(new URL('./technique-targets.json', import.meta.url)));
const output = new URL('../docs/research/results/technique-audit.md', import.meta.url);
const freeFootLifts = new Set(['squat', 'goblet', 'deadlift', 'rdl', 'goodmorning', 'row', 'dbreversefly',
  'cablefly', 'ohp', 'uprow', 'pushdown', 'curl', 'latraise', 'dbcurl', 'shrug',
  'cableoverheadext', 'dbfrontraise', 'cablepullthrough']);
const deadliftIds = new Set(['deadlift', 'deficit-dl', 'block-pull', 'sumo']);
// 依 limitations.md 中已列的肌肉分配偏差；未在此列者僅標成姿勢／模型待判讀。
const knownModel = new Set(['cg-bench', 'db-bench-incline', 'reverse-deck', 'machine-press', 'db-press',
  'dips', 'dips-upright', 'deadlift', 'deficit-dl', 'block-pull', 'sumo', 'rdl',
  'row', 'row-sup', 'cable-row', 'cable-row-wide', 'db-reverse-fly',
  'uprow', 'pulldown', 'pulldown-sup', 'pullup', 'pullup-wide', 'chinup', 'assist-pullup',
  'assist-chinup', 'reverse-curl', 'hammer-curl']);
const deg = (x) => x * 180 / Math.PI;
const fmt = (x, n = 1) => Number(x).toFixed(n);
const esc = (s) => String(s).replaceAll('|', '／').replaceAll('\n', ' ');
const active = CATALOG.filter((c) => !c.planned);
// 規劃中（planned）的項目可預先保留目標肌群資料，但不列入稽核。
const plannedIds = new Set(CATALOG.filter((c) => c.planned).map((c) => c.id));
const targetIds = Object.keys(data.entries).filter((id) => !plannedIds.has(id));
if (targetIds.length !== active.length ||
    active.some((c) => !data.patterns[data.entries[c.id]]) ||
    targetIds.some((id) => !active.some((c) => c.id === id))) throw new Error(`目標肌群資料須逐項覆蓋 ${active.length} 個清單項目`);
for (const pattern of Object.values(data.patterns)) {
  const groups = [...pattern.targets, ...pattern.synergists, ...pattern.stabilizers];
  const ids = groups.flatMap((g) => g.ids);
  if (!pattern.source || !pattern.targets.length || groups.some((g) =>
    !g.name || !g.ids.length || g.ids.some((id) => !MUSCLE_BY_ID[id])) ||
    new Set(ids).size !== ids.length ||
    (pattern.targetOrder && pattern.targetOrder.some((name) => !pattern.targets.some((g) => g.name === name))))
    throw new Error('目標／協同／穩定肌來源、肌肉 ID 或內部順序無效');
}

const rows = [], misses = [], counts = { '符合': 0, '需複查': 0, '不符合': 0 };
for (const entry of active) {
  const P = { ...defaultParams(entry.lift), ...entry.set };
  const results = Array.from({ length: 21 }, (_, i) => analyze(entry.lift, P, i / 20));
  const pattern = data.patterns[data.entries[entry.id]];
  const peaks = {};
  // 只排名一般視圖的群組與未細分肌肉；細分子部位（有 group）已併入群組值，避免同群重複佔名次。
  for (const r of results) for (const [id, m] of Object.entries(r.mus)) {
    if (MUSCLE_BY_ID[id]?.group) continue;
    peaks[id] = Math.max(peaks[id] ?? 0, m.a);
  }
  const order = Object.keys(peaks).sort((a, b) => peaks[b] - peaks[a] || a.localeCompare(b));
  const excluded = new Set(pattern.stabilizers.flatMap((g) => g.ids));
  const workingOrder = order.filter((id) => !excluded.has(id));
  const groupPeak = (g, rankOrder) => {
    const muscle = g.ids.slice().sort((a, b) => (peaks[b] ?? 0) - (peaks[a] ?? 0))[0];
    return { name: g.name, rank: Math.min(...g.ids.map((id) => rankOrder.indexOf(id) < 0 ? Infinity : rankOrder.indexOf(id) + 1)),
      muscle, peak: peaks[muscle] ?? null };
  };
  const ranks = pattern.targets.map((g) => groupPeak(g, workingOrder));
  const synergists = pattern.synergists.map((g) => groupPeak(g, workingOrder));
  const stabilizers = pattern.stabilizers.map((g) => groupPeak(g, order));
  const missed = ranks.filter((g) => g.rank > 3);
  const targetOrder = pattern.targetOrder?.map((name) => ranks.find((g) => g.name === name));
  const orderFailed = targetOrder?.some((g, i) => i > 0 && targetOrder[i - 1].rank >= g.rank) ?? false;
  const warnings = [...new Set(results.flatMap((r) => r.pose.warn || []))];
  const rom = [...new Set(results.flatMap((r) => Object.values(r.rom || {})))];
  const badPose = results.filter((r) => !r.pose.ok);
  let cop = null;
  if (freeFootLifts.has(entry.lift)) {
    const samples = results.map(({ pose }) => {
      if (!pose.cop || !pose.R.heel || !pose.R.toe) throw new Error(`${entry.id} 缺少腳底接觸幾何`);
      const [rear, front] = pose.supportSpan || [pose.R.heel[2], pose.R.toe[2]];
      const mid = pose.supportSpan ? (pose.visualLegs.L.heel[2] + pose.visualLegs.L.toe[2] +
        pose.visualLegs.R.heel[2] + pose.visualLegs.R.toe[2]) / 4 : (rear + front) / 2;
      return { delta: (pose.cop[2] - mid) * 100,
        outside: pose.cop[2] < rear - 1e-9 || pose.cop[2] > front + 1e-9 };
    });
    cop = { max: samples.reduce((a, b) => Math.abs(a.delta) > Math.abs(b.delta) ? a : b).delta,
      outside: samples.some((x) => x.outside) };
  }
  const knees = results.map((r) => r.pose.kneePath).filter(Boolean);
  const thighAngles = knees.map((k) => k.shankThighProxyDeg).filter((v) => v !== null);
  const kneeText = knees.length ? `膝 ${fmt(knees.at(-1).pathDeg)}°／腳尖 ${fmt(knees.at(-1).toeDeg)}°；腳尖－小腿 ${fmt(Math.max(...knees.map((k) => Math.abs(k.footShankProxyDeg))))}°；小腿－大腿 ${thighAngles.length ? `${fmt(Math.max(...thighAngles.map(Math.abs)))}°` : '—'}` : '—';
  const angleParts = [['髖屈', 'hipFlex', ROM_HINTS.hipFlex], ['膝屈', 'kneeFlex', ROM_HINTS.kneeFlex], ['踝背屈', 'ankleDorsi', ROM_HINTS.ankleDorsi],
    ['肘屈', 'elbFlex', ROM_HINTS.elbFlex]].filter(([, key]) => results.some((r) => Number.isFinite(r.q[key])))
    .map(([name, key, hint]) => {
      const value = Math.max(...results.map((r) => Number.isFinite(r.q[key]) ? deg(r.q[key]) : -Infinity));
      const label = key === 'hipFlex' ? '模型提示線' : '常模參考';
      return `${name} ${fmt(value)}°（${value >= 0 ? `${fmt(value / hint * 100, 0)}% ${label}` : '反方向，未達此參考'}）`;
    });
  if (results.some((r) => Number.isFinite(r.q.shElev))) {
    const peak = results.reduce((a, b) => b.q.shElev > a.q.shElev ? b : a);
    const hint = Math.abs(deg(peak.q.shPlane)) < 45 ? ROM_HINTS.shFlex : ROM_HINTS.shAbd;
    angleParts.push(`舉臂 ${fmt(deg(peak.q.shElev))}°（${fmt(deg(peak.q.shElev) / hint * 100, 0)}% 常模參考）`);
  }
  if (entry.lift === 'cablerow') {
    const ext = Math.max(0, ...results.map((r) => -deg(r.q.shFlex)));
    angleParts.push(`肩後伸 ${fmt(ext)}°（約 50° 主動常模供人工複查）`);
  }
  if (entry.lift === 'dips') {
    const ext = Math.max(0, ...results.map((r) => -deg(r.q.shFlex)));
    angleParts.push(`肩後伸 ${fmt(ext)}°（約 50° 主動常模供人工複查）`);
  }
  if (Number.isFinite(P.flare)) angleParts.push(`肘外展設定 ${fmt(P.flare, 0)}°`);
  if (Number.isFinite(P.topHeight)) angleParts.push(`上舉設定 ${fmt(P.topHeight, 0)}°`);
  const reasons = [];
  if (badPose.length) reasons.push(`姿勢無法成立 ${badPose.length}/21 點`);
  if (cop?.outside) reasons.push('壓力中心超出兩腳支撐範圍');
  else if (cop && !deadliftIds.has(entry.id) && P.footStance !== 'staggered' && Math.abs(cop.max) > 5) reasons.push('壓力中心偏離中段超過 5 cm');
  if (deadliftIds.has(entry.id)) {
    const start = results.at(-1).pose, scap = scapulaLocal(start.girdle);
    const scapZ = start.Pc[2] + start.u[2] * scap[1] + start.f[2] * scap[2];
    const footMid = (start.R.heel[2] + start.R.toe[2]) / 2;
    if (Math.abs(start.bar[2] - footMid) > 0.01 || Math.abs(scapZ - start.bar[2]) > 0.01) {
      reasons.push('起槓槓位或肩胛位置未符合 G1 幾何');
    }
  }
  if (missed.length) {
    const category = knownModel.has(entry.id) ? '已知肌肉模型問題' : '姿勢預設／肌肉模型待教練判定';
    reasons.push(`${category}：${missed.map((x) => x.name).join('、')}未進前三`);
    misses.push({ entry, missed, category });
  }
  const latStab = stabilizers.find((r) => r.name === '背闊肌' && Number.isFinite(r.rank) && r.rank <= 3);
  if (latStab && knownModel.has(entry.id)) reasons.push(`已知肌肉模型問題：穩定肌背闊肌偏高（全肌 #${latStab.rank}）`);
  if (orderFailed) reasons.push(`目標內部順序未達：${targetOrder.map((g) => `${g.name} #${g.rank}`).join(' → ')}`);
  if (rom.length) reasons.push(`模型 ROM 提示：${rom.join('、')}`);
  if (warnings.length) reasons.push(`姿勢提示：${warnings.join('；')}`);
  const status = badPose.length || cop?.outside || reasons.includes('起槓槓位或肩胛位置未符合 G1 幾何') ? '不符合' : reasons.length ? '需複查' : '符合';
  counts[status]++;
  const peakText = (r) => r.peak === null ? '未計' : fmt(r.peak, 2);
  const targetText = ranks.map((r) => `${r.name} #${Number.isFinite(r.rank) ? r.rank : '—'}（a=${peakText(r)}）`).join('；');
  const synergyText = synergists.map((r) => `${r.name} #${Number.isFinite(r.rank) ? r.rank : '—'}（a=${peakText(r)}）`).join('；') || '—';
  const stableText = stabilizers.map((r) => r.peak === null ? `${r.name}（模型未計）` :
    `${r.name} a=${peakText(r)}（全肌 #${r.rank}）`).join('；') || '—';
  const orderText = targetOrder ? `${orderFailed ? '未達' : '符合'}：${targetOrder.map((r) => `${r.name} #${r.rank}`).join(' → ')}` :
    ['deadlift', 'sumo'].includes(data.entries[entry.id]) ? `股四頭肌 a=${fmt(ranks.find((r) => r.name === '股四頭肌').peak, 2)}；參與門檻待教練決定` : '—';
  rows.push(`| ${entry.name} | ${status} | ${cop ? `${cop.max >= 0 ? '+' : ''}${fmt(cop.max)} cm${P.footStance === 'staggered' ? '（兩腳中點）' : ''}${cop.outside ? '（越界）' : ''}` : '不適用'} | ${targetText} | ${synergyText} | ${stableText} | ${orderText} | ${kneeText} | ${angleParts.join('；') || '—'} | ${esc(reasons.join('；') || '量化項目無提示')} |`);
}

const deadliftLoadRows = [];
const deadliftDefaultCops = [];
for (const id of ['deadlift', 'deficit-dl', 'block-pull', 'sumo']) {
  const entry = active.find((x) => x.id === id), P = { ...defaultParams(entry.lift), ...entry.set };
  const values = [];
  for (const ratio of [0.5, 1.2, 2.0]) {
    const before = BAR_RATIO.deadlift;
    try {
      BAR_RATIO.deadlift = ratio;
      const pose = analyze(entry.lift, P, 1).pose;
      values.push(`${fmt((pose.cop[2] - (pose.R.heel[2] + pose.R.toe[2]) / 2) * 100, 2)} cm`);
    } finally { BAR_RATIO.deadlift = before; }
  }
  deadliftDefaultCops.push(values[1]);
  deadliftLoadRows.push(`| ${entry.name} | ${values.join(' | ')} |`);
}
const lines = [
  '# 預設動作技術原則稽核', '',
  `使用預設身體（1.75 m、75 kg）與 ${active.length} 個清單項目的預設參數，每項取全行程 21 點。結果：符合 ${counts['符合']}、需複查 ${counts['需複查']}、不符合 ${counts['不符合']}。`, '',
  `目前狀態：可用完整骨架／外力調整的自由站姿模型，預設全行程壓力中心離足底幾何中點均小於 1 cm；滑輪三頭下壓與滑輪夾胸預設前後腳，以兩腳等效支撐中點計算。四種硬舉採槓在足中段、小腿貼槓及右肩胛骨頂點中心在槓上方的 G1 閉鏈幾何；壓力中心隨負重自然偏腳跟。預設 1.2×BW 起槓時，傳統／赤字／墊高／相撲分別偏 ${deadliftDefaultCops.join('／')}。深蹲姿勢維持現有設定；前蹲相對幾何中點偏前 2.7 cm，名義座標仍是足中段解。這些是模型結果，不是實測足底壓力。`, '',
  '「符合」只表示本工具可量化的檢查沒有提示，不代表個人安全、動作正確或增肌效果。姿勢／壓力中心越界列「不符合」；一般雙腳併站動作的壓力中心偏離幾何中段超過 ±5 cm、模型 ROM 與姿勢提示、目標肌群未進前三列「需複查」。硬舉以起槓槓位及右肩胛骨頂點中心相對腳掌中段檢查 G1，偏腳跟本身不標記。前後腳站姿只以壓力中心是否落在兩腳支撐範圍判斷，仍報相對兩腳中點的偏移。±5 cm 是教練指定的一般複查值，不是文獻安全線。', '',
  '硬舉起槓壓力中心（相對腳掌中段，負值偏腳跟）：', '',
  '| 變式 | 0.5×BW | 1.2×BW | 2.0×BW |',
  '| --- | ---: | ---: | ---: |',
  ...deadliftLoadRows, '',
  '自由站姿以腳跟至腳尖的前後接觸範圍檢查 `pose.cop`；前後腳視覺各錯開 10 cm，以兩腳外緣作等效支撐範圍。左右對稱力學仍只解右半身並鏡像，不會算出前後腳分力或單側關節力矩。史密斯、哈克、腿推、臀推、伏地挺身、提踵機等有軌道、墊子或多接點支撐，不套用此判準。目標與協同肌排名按 21 點最高模型活化 `a`，先排除各動作明列的穩定肌；穩定肌仍列最高 `a` 及全肌排名。目標群組與依據見 [`tools/technique-targets.json`](../../../tools/technique-targets.json) 及[技術原則](../technique-principles.md)。肌肉排名只是模型觀察。', '',
  '角度欄為全程模型最大值與程式 `rom` 提示角／常模參考的比例（髖 136° 為啟發式；膝 138° 為成人男性被動常模；踝 39° 為屈膝負重常模；舉臂前舉 160°／外展 150° 為混合性別主動常模約值；肘 146° 為主動常模）。舉臂依峰值姿勢的肩平面選前舉或外展代理；各動作過程可切換參考線。坐姿滑輪划船與雙槓的肩後伸以 `shFlex` 負角計；雙槓預設底點約 50°，群體主動常模見 [Kim 與 Kim 2016](https://www.jstage.jst.go.jp/article/jpts/28/3/28_jpts-2015-845/_pdf/-char/en)。此常模並非負重安全線。肘外展等為設定值。常模群體與量測條件不等同負重動作，**不是個人活動範圍或安全界線**；髖屈為軀幹—大腿夾角，不能直接等同骨盆—大腿屈曲常模。肩平面 `shPlane` 155° 為幾何啟發式，並非肩後伸角。詳見[技術原則 G5](../technique-principles.md)。腳尖－小腿、小腿－大腿的水平投影方向差是幾何代理，**不是實際脛股旋轉角**；小腿－大腿只取大腿相對垂直屈曲超過 45° 的點，避免頂點近垂直的大腿因微小水平跨距造成 90° 誤報。25° 警示只是幾何人工複查設定。史密斯使用固定膝位求解器，未共用自由深蹲的 `kneePath`。', '',
  '| 動作 | 結果 | 壓力中心離中段最大偏移 | 目標肌群排名 | 協同肌排名 | 穩定肌（不列目標） | 目標內部順序／股四頭參與 | 膝路徑 | 角度／設定（待教練決定） | 原因 |',
  '| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |', ...rows, '',
  '## 目標肌群未進前三', '',
  misses.length ? '| 動作 | 分類 | 未進前三的目標肌群 |\n| --- | --- | --- |\n' + misses.map((x) => `| ${x.entry.name} | ${x.category} | ${x.missed.map((m) => `${m.name} #${Number.isFinite(m.rank) ? m.rank : '—'}`).join('；')} |`).join('\n') : '無。', '',
  '已知肌肉模型問題的分類依[模型限制與已知問題](../limitations.md)；其餘為姿勢預設或肌肉模型待教練判定，不能僅憑排名調整姿勢。胸廓擴張、呼吸、腰椎分段、腕角、真實脛股旋轉、個人疼痛與足底壓力分布目前無法稽核。'
];
fs.writeFileSync(output, lines.join('\n') + '\n');
console.log(`技術稽核：符合 ${counts['符合']}、需複查 ${counts['需複查']}、不符合 ${counts['不符合']}；目標肌群未進前三 ${misses.length} 項`);
