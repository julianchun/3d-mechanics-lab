// 文獻趨勢自動檢查：比對 src/biomech.js 的模型輸出方向是否與 docs/references.md 文獻一致
// 執行方式：npm run test:trends（或 node tests/trends.mjs）
// 注意：本腳本僅作趨勢報告，不修改力學模型；若模型與文獻不一致，印出 FAIL 供後續調校參考。

import { analyze, peakAnalysis, defaultParams } from '../src/biomech.js';

const P = (lift, overrides = {}) => ({ ...defaultParams(lift), ...overrides });

// 取全行程（n 步）某項關節力矩 dem[dof] 的峰值（取絕對值或指定方向）
function peakDem(lift, params, dof, { abs = true, n = 20 } = {}) {
  let best = -Infinity;
  for (let i = 0; i <= n; i++) {
    const v = analyze(lift, params, i / n).dem[dof] ?? 0;
    const val = abs ? Math.abs(v) : v;
    if (val > best) best = val;
  }
  return best;
}

// 取全行程某肌肉峰值活化 a、負荷 s 或最大長度 l
function peakMus(lift, params, musId, field = 'a', n = 20) {
  let best = -Infinity;
  for (let i = 0; i <= n; i++) {
    const m = analyze(lift, params, i / n).mus[musId];
    const val = m ? m[field] : 0;
    if (val > best) best = val;
  }
  return best;
}

// 取得全行程中指定點的 analyze 結果
function atE(lift, params, e) {
  return analyze(lift, params, e);
}

// 每一項檢查回傳 { labelA, valA, labelB, valB, unit, pass }
const CHECKS = [
  // ---------- 1. 45° 腿推機：腳位高低 ----------
  {
    exercise: '45° 腿推機',
    compare: '腳踩高 (footHigh=0.8) vs 腳踩低 (footHigh=0.2) — 臀大肌活化',
    ref: 'Da Silva 2008 (PMID 18545207, n=14)',
    expected: '腳踩高 > 腳踩低',
    run() {
      const a = peakMus('legpress', P('legpress', { footHigh: 0.8 }), 'gmax', 'a');
      const b = peakMus('legpress', P('legpress', { footHigh: 0.2 }), 'gmax', 'a');
      return { labelA: '高腳位', valA: a, labelB: '低腳位', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '45° 腿推機',
    compare: '腳踩高 (footHigh=0.8) vs 腳踩低 (footHigh=0.2) — 髖伸力矩',
    ref: 'Da Silva 2008 (PMID 18545207); Escamilla 2001 (PMID 11528346)',
    expected: '腳踩高 > 腳踩低',
    run() {
      const a = peakDem('legpress', P('legpress', { footHigh: 0.8 }), 'hipExt', { abs: false });
      const b = peakDem('legpress', P('legpress', { footHigh: 0.2 }), 'hipExt', { abs: false });
      return { labelA: '高腳位', valA: a, labelB: '低腳位', valB: b, unit: 'N·m', pass: a > b };
    },
  },
  {
    exercise: '45° 腿推機',
    compare: '腳踩低 (footHigh=0.2) vs 腳踩高 (footHigh=0.8) — 膝伸力矩',
    ref: 'Da Silva 2008 (PMID 18545207, 低腳位股四頭肌較高)',
    expected: '腳踩低 > 腳踩高',
    run() {
      const a = peakDem('legpress', P('legpress', { footHigh: 0.2 }), 'kneeExt', { abs: false });
      const b = peakDem('legpress', P('legpress', { footHigh: 0.8 }), 'kneeExt', { abs: false });
      return { labelA: '低腳位', valA: a, labelB: '高腳位', valB: b, unit: 'N·m', pass: a > b };
    },
  },

  // ---------- 2. 深蹲 vs 45° 腿推機 ----------
  {
    exercise: '深蹲 vs 45° 腿推機',
    compare: '高槓深蹲 vs 45° 腿推機 — 膕繩肌活化',
    ref: 'Escamilla 1998 (PMID 9565938, n=10, 約 2 倍); Escamilla 2001 (PMID 11528346)',
    expected: '深蹲 > 腿推機',
    run() {
      const a = peakMus('squat', P('squat', { barPos: 'high' }), 'hams', 'a');
      const b = peakMus('legpress', P('legpress'), 'hams', 'a');
      return { labelA: '深蹲', valA: a, labelB: '腿推機', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 3. 自由深蹲 vs 史密斯深蹲 ----------
  {
    exercise: '自由深蹲 vs 史密斯深蹲',
    compare: '高槓深蹲 vs 史密斯深蹲 — 膕繩肌活化',
    ref: 'Schwanbeck 2009 (PMID 19855308, n=6, 股二頭肌 +26%)',
    expected: '自由深蹲 > 史密斯',
    run() {
      const a = peakMus('squat', P('squat', { barPos: 'high' }), 'hams', 'a');
      const b = peakMus('smith', P('smith'), 'hams', 'a');
      return { labelA: '自由深蹲', valA: a, labelB: '史密斯', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '自由深蹲 vs 史密斯深蹲',
    compare: '高槓深蹲 vs 史密斯深蹲 — 股四頭肌活化',
    ref: 'Schwanbeck 2009 (PMID 19855308, n=6, 股內側肌 +49%)',
    expected: '自由深蹲 > 史密斯',
    run() {
      const a = peakMus('squat', P('squat', { barPos: 'high' }), 'vasti', 'a');
      const b = peakMus('smith', P('smith'), 'vasti', 'a');
      return { labelA: '自由深蹲', valA: a, labelB: '史密斯', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 4. 深蹲：低槓 vs 高槓 ----------
  {
    exercise: '深蹲（低槓 vs 高槓）',
    compare: '低槓 vs 高槓 — 髖伸力矩',
    ref: 'Glassbrook 2017 (PMID 28570490); Murawa 2020 (PMID 32551198)',
    expected: '低槓 > 高槓',
    run() {
      const a = peakDem('squat', P('squat', { barPos: 'low' }), 'hipExt', { abs: false });
      const b = peakDem('squat', P('squat', { barPos: 'high' }), 'hipExt', { abs: false });
      return { labelA: '低槓', valA: a, labelB: '高槓', valB: b, unit: 'N·m', pass: a > b };
    },
  },
  {
    exercise: '深蹲（低槓 vs 高槓）',
    compare: '低槓 vs 高槓 — 腰椎伸展力矩（豎脊肌需求）',
    ref: 'Glassbrook 2017 (PMID 28570490)',
    expected: '低槓 > 高槓',
    run() {
      const a = peakDem('squat', P('squat', { barPos: 'low' }), 'trunkExt', { abs: false });
      const b = peakDem('squat', P('squat', { barPos: 'high' }), 'trunkExt', { abs: false });
      return { labelA: '低槓', valA: a, labelB: '高槓', valB: b, unit: 'N·m', pass: a > b };
    },
  },
  {
    exercise: '深蹲（高槓 vs 低槓）',
    compare: '高槓 vs 低槓 — 股四頭肌活化',
    ref: 'Glassbrook 2017 (PMID 28570490)',
    expected: '高槓 > 低槓',
    run() {
      const a = peakMus('squat', P('squat', { barPos: 'high' }), 'vasti', 'a');
      const b = peakMus('squat', P('squat', { barPos: 'low' }), 'vasti', 'a');
      return { labelA: '高槓', valA: a, labelB: '低槓', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 5. 前蹲 vs 高槓背蹲 ----------
  {
    exercise: '前蹲 vs 高槓深蹲',
    compare: '前蹲 vs 高槓 — 最低點軀幹前傾角',
    ref: 'Gullett 2009 (PMID 19002072, n=15)',
    expected: '前蹲 < 高槓（較直立）',
    run() {
      const a = (atE('squat', P('squat', { barPos: 'front' }), 1).pose.phi * 180) / Math.PI;
      const b = (atE('squat', P('squat', { barPos: 'high' }), 1).pose.phi * 180) / Math.PI;
      return { labelA: '前蹲', valA: a, labelB: '高槓', valB: b, unit: '°', pass: a < b };
    },
  },
  {
    exercise: '前蹲 vs 高槓深蹲',
    compare: '前蹲 vs 高槓 — 髖伸力矩',
    ref: 'Gullett 2009 (PMID 19002072)',
    expected: '前蹲 < 高槓',
    run() {
      const a = peakDem('squat', P('squat', { barPos: 'front' }), 'hipExt', { abs: false });
      const b = peakDem('squat', P('squat', { barPos: 'high' }), 'hipExt', { abs: false });
      return { labelA: '前蹲', valA: a, labelB: '高槓', valB: b, unit: 'N·m', pass: a < b };
    },
  },

  // ---------- 6. 深蹲深度 ----------
  {
    exercise: '深蹲深度',
    compare: '全蹲 (depth=0.9) vs 淺蹲 (depth=0.1) — 臀大肌負荷 s',
    ref: 'Kubo 2019 (PMID 31230110, 臀大肌 +6.7% vs +2.2%); Bryanton 2012 (PMID 22797000)',
    expected: '全蹲 > 淺蹲',
    run() {
      const a = peakAnalysis('squat', P('squat', { depth: 0.9 })).mus.gmax.s;
      const b = peakAnalysis('squat', P('squat', { depth: 0.1 })).mus.gmax.s;
      return { labelA: '全蹲', valA: a, labelB: '淺蹲', valB: b, unit: 's', pass: a > b };
    },
  },
  {
    exercise: '深蹲深度',
    compare: '全蹲 (depth=0.9) vs 淺蹲 (depth=0.1) — 內收大肌負荷 s',
    ref: 'Kubo 2019 (PMID 31230110, 內收肌 +6.2% vs +2.7%)',
    expected: '全蹲 > 淺蹲',
    run() {
      const a = peakAnalysis('squat', P('squat', { depth: 0.9 })).mus.addmag.s;
      const b = peakAnalysis('squat', P('squat', { depth: 0.1 })).mus.addmag.s;
      return { labelA: '全蹲', valA: a, labelB: '淺蹲', valB: b, unit: 's', pass: a > b };
    },
  },

  // ---------- 7. 深蹲站距 ----------
  {
    exercise: '深蹲站距',
    compare: '寬站距 (stance=0.9) vs 窄站距 (stance=0.1) — 臀大肌活化',
    ref: 'Paoli 2009 (PMID 19130646)',
    expected: '寬站距 > 窄站距',
    run() {
      const a = peakMus('squat', P('squat', { stance: 0.9 }), 'gmax', 'a');
      const b = peakMus('squat', P('squat', { stance: 0.1 }), 'gmax', 'a');
      return { labelA: '寬站距', valA: a, labelB: '窄站距', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 8. 相撲硬舉 vs 傳統硬舉 ----------
  {
    exercise: '相撲 vs 傳統硬舉',
    compare: '相撲 vs 傳統 — 股四頭肌活化',
    ref: 'Escamilla 2002 (PMID 11932579)',
    expected: '相撲 > 傳統',
    run() {
      const a = peakMus('deadlift', P('deadlift', { style: 'sumo' }), 'vasti', 'a');
      const b = peakMus('deadlift', P('deadlift', { style: 'conv' }), 'vasti', 'a');
      return { labelA: '相撲', valA: a, labelB: '傳統', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '相撲 vs 傳統硬舉',
    compare: '相撲 vs 傳統 — 腰椎伸展力矩',
    ref: 'Cholewicki 1991 (PMID 1758295, -10%); Escamilla 2000 (PMID 10912892)',
    expected: '相撲 < 傳統',
    run() {
      const a = peakDem('deadlift', P('deadlift', { style: 'sumo' }), 'trunkExt', { abs: false });
      const b = peakDem('deadlift', P('deadlift', { style: 'conv' }), 'trunkExt', { abs: false });
      return { labelA: '相撲', valA: a, labelB: '傳統', valB: b, unit: 'N·m', pass: a < b };
    },
  },

  // ---------- 9. 赤字硬舉 vs 墊高硬舉 ----------
  {
    exercise: '赤字 vs 墊高硬舉',
    compare: '赤字 (start=-5) vs 墊高 (start=+10) — 股四頭肌活化',
    ref: 'Rogacion 2024 摘要 (WKU IJES 14(4):68)',
    expected: '赤字 > 墊高',
    run() {
      const a = peakMus('deadlift', P('deadlift', { start: -5 }), 'vasti', 'a');
      const b = peakMus('deadlift', P('deadlift', { start: 10 }), 'vasti', 'a');
      return { labelA: '赤字', valA: a, labelB: '墊高', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '赤字 vs 墊高硬舉',
    compare: '赤字 (start=-5) vs 墊高 (start=+10) — 臀大肌活化',
    ref: 'Rogacion 2024 摘要 (WKU IJES 14(4):68)',
    expected: '赤字 > 墊高',
    run() {
      const a = peakMus('deadlift', P('deadlift', { start: -5 }), 'gmax', 'a');
      const b = peakMus('deadlift', P('deadlift', { start: 10 }), 'gmax', 'a');
      return { labelA: '赤字', valA: a, labelB: '墊高', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '赤字 vs 墊高硬舉',
    compare: '赤字 (start=-5) vs 墊高 (start=+10) — 膕繩肌活化',
    ref: 'Rogacion 2024 摘要 (WKU IJES 14(4):68)',
    expected: '赤字 > 墊高',
    run() {
      const a = peakMus('deadlift', P('deadlift', { start: -5 }), 'hams', 'a');
      const b = peakMus('deadlift', P('deadlift', { start: 10 }), 'hams', 'a');
      return { labelA: '赤字', valA: a, labelB: '墊高', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 10. 早安體前屈膝彎曲 ----------
  {
    exercise: '早安體前屈',
    compare: '近直腿 (kneeBend=5°) vs 屈膝 (kneeBend=35°) — 膕繩肌最大長度 l',
    ref: 'Vigotsky 2015 (PMID 25653899)',
    expected: '近直腿 > 屈膝',
    run() {
      const a = peakMus('goodmorning', P('goodmorning', { kneeBend: 5 }), 'hams', 'l');
      const b = peakMus('goodmorning', P('goodmorning', { kneeBend: 35 }), 'hams', 'l');
      return { labelA: '5°', valA: a, labelB: '35°', valB: b, unit: 'l', pass: a > b };
    },
  },

  // ---------- 11. 臀推 vs 深蹲 ----------
  {
    exercise: '臀推 vs 深蹲',
    compare: '臀推 vs 高槓深蹲 — 臀大肌活化',
    ref: 'Contreras 2015 (PMID 26214739, n=13, 69.5/86.8% vs 29.4/45.4% MVIC)',
    expected: '臀推 > 深蹲',
    run() {
      const a = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 90 }), 'gmax', 'a');
      const b = peakMus('squat', P('squat', { barPos: 'high' }), 'gmax', 'a');
      return { labelA: '臀推', valA: a, labelB: '深蹲', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 12. 臀推腳位 ----------
  {
    exercise: '臀推腳位',
    compare: '腳放遠 (kneeTop=70°) vs 腳放近 (kneeTop=120°) — 膕繩肌活化',
    ref: 'Collazo García 2020 (DOI 10.1519/JSC.0000000000002859)',
    expected: '腳放遠 > 腳放近',
    run() {
      const a = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 70 }), 'hams', 'a');
      const b = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 120 }), 'hams', 'a');
      return { labelA: '腳遠 70°', valA: a, labelB: '腳近 120°', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 13. 臀推 vs 槓鈴臀橋 ----------
  {
    exercise: '臀推 vs 槓鈴臀橋',
    compare: '臀推 vs 槓鈴臀橋 — 股四頭肌活化',
    ref: 'Kennedy 2022 (PMID 35586943, n=10)',
    expected: '臀推 > 臀橋',
    run() {
      const a = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 90 }), 'vasti', 'a');
      const b = peakMus('hipthrust', P('hipthrust', { surface: 'floor', kneeTop: 130 }), 'vasti', 'a');
      return { labelA: '臀推', valA: a, labelB: '臀橋', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '臀橋 vs 臀推',
    compare: '槓鈴臀橋 vs 臀推 — 臀大肌活化',
    ref: 'Kennedy 2022 (PMID 35586943, n=10)',
    expected: '臀橋 > 臀推',
    run() {
      const a = peakMus('hipthrust', P('hipthrust', { surface: 'floor', kneeTop: 130 }), 'gmax', 'a');
      const b = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 90 }), 'gmax', 'a');
      return { labelA: '臀橋', valA: a, labelB: '臀推', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 14. 臥推：上斜 vs 平板 ----------
  {
    exercise: '上斜 vs 平板臥推',
    compare: '上斜 30° vs 平板 0° — 上胸 (pecc) 活化',
    ref: 'Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339); Lauver 2016 (PMID 25799093)',
    expected: '上斜 30° > 平板 0°',
    run() {
      const a = peakMus('bench', P('bench', { incline: 30 }), 'pecc', 'a');
      const b = peakMus('bench', P('bench', { incline: 0 }), 'pecc', 'a');
      return { labelA: '上斜 30°', valA: a, labelB: '平板 0°', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '上斜 vs 平板臥推',
    compare: '上斜 30° vs 平板 0° — 前三角肌 (adelt) 活化',
    ref: 'Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339)',
    expected: '上斜 30° > 平板 0°',
    run() {
      const a = peakMus('bench', P('bench', { incline: 30 }), 'adelt', 'a');
      const b = peakMus('bench', P('bench', { incline: 0 }), 'adelt', 'a');
      return { labelA: '上斜 30°', valA: a, labelB: '平板 0°', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '平板 vs 上斜臥推',
    compare: '平板 0° vs 上斜 30° — 中下胸 (pecs) 活化',
    ref: 'Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339)',
    expected: '平板 0° > 上斜 30°',
    run() {
      const a = peakMus('bench', P('bench', { incline: 0 }), 'pecs', 'a');
      const b = peakMus('bench', P('bench', { incline: 30 }), 'pecs', 'a');
      return { labelA: '平板 0°', valA: a, labelB: '上斜 30°', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 15. 臥推握距：窄握 vs 寬握 ----------
  {
    exercise: '窄握 vs 平板臥推',
    compare: '窄握 (grip=0.9, flare=35) vs 標準 (grip=1.6, flare=52) — 三頭肌活化',
    ref: 'Lehman 2005 (PMID 16095407)',
    expected: '窄握 > 標準握',
    run() {
      const a = peakMus('bench', P('bench', { grip: 0.9, flare: 35 }), 'trilat', 'a');
      const b = peakMus('bench', P('bench', { grip: 1.6, flare: 52 }), 'trilat', 'a');
      return { labelA: '窄握', valA: a, labelB: '標準握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '窄握 vs 平板臥推',
    compare: '標準 (grip=1.6, flare=52) vs 窄握 (grip=0.9, flare=35) — 中下胸活化',
    ref: 'Lehman 2005 (PMID 16095407)',
    expected: '標準握 > 窄握',
    run() {
      const a = peakMus('bench', P('bench', { grip: 1.6, flare: 52 }), 'pecs', 'a');
      const b = peakMus('bench', P('bench', { grip: 0.9, flare: 35 }), 'pecs', 'a');
      return { labelA: '標準握', valA: a, labelB: '窄握', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 16. 滑輪下拉：正握 vs 反握 ----------
  {
    exercise: '滑輪下拉（清單預設）',
    compare: '正握 (pro, grip=1.7) vs 反握 (sup, grip=1.1) — 背闊肌活化',
    ref: 'Lusk 2010 (PMID 20543740, n=12)',
    expected: '正握 > 反握',
    run() {
      const a = peakMus('pulldown', P('pulldown', { supin: 'pro' }), 'lat', 'a');
      const b = peakMus('pulldown', P('pulldown', { supin: 'sup', grip: 1.1 }), 'lat', 'a');
      return { labelA: '正握', valA: a, labelB: '反握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '滑輪下拉（同握距）',
    compare: '同握距 (grip=1.4) 正握 vs 反握 — 背闊肌活化',
    ref: 'Lusk 2010 (PMID 20543740, n=12, 握法主效應)',
    expected: '正握 > 反握',
    run() {
      const a = peakMus('pulldown', P('pulldown', { supin: 'pro', grip: 1.4 }), 'lat', 'a');
      const b = peakMus('pulldown', P('pulldown', { supin: 'sup', grip: 1.4 }), 'lat', 'a');
      return { labelA: '正握', valA: a, labelB: '反握', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 17. 坐姿滑輪划船：寬握 vs 窄握 ----------
  {
    exercise: '坐姿滑輪划船',
    compare: '寬握 (wide) vs 窄握 V 把 (v) — 三角肌後束活化',
    ref: 'de Abreu Vasconcelos 2023 (DOI 10.47206/ijsc.v3i1.190); Padovan 2025 (DOI 10.5114/jhk/209550)',
    expected: '寬握 > 窄握',
    run() {
      const a = peakMus('cablerow', P('cablerow', { grip: 'wide' }), 'pdelt', 'a');
      const b = peakMus('cablerow', P('cablerow', { grip: 'v' }), 'pdelt', 'a');
      return { labelA: '寬握', valA: a, labelB: '窄握 V 把', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '坐姿滑輪划船',
    compare: '窄握 V 把 (v) vs 寬握 (wide) — 背闊肌活化',
    ref: 'de Abreu Vasconcelos 2023 (DOI 10.47206/ijsc.v3i1.190); Padovan 2025 (DOI 10.5114/jhk/209550)',
    expected: '窄握 > 寬握',
    run() {
      const a = peakMus('cablerow', P('cablerow', { grip: 'v' }), 'lat', 'a');
      const b = peakMus('cablerow', P('cablerow', { grip: 'wide' }), 'lat', 'a');
      return { labelA: '窄握 V 把', valA: a, labelB: '寬握', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 18. 槓鈴划船 vs 坐姿滑輪划船 ----------
  {
    exercise: '槓鈴划船 vs 坐姿滑輪划船',
    compare: '站姿槓鈴划船 vs 坐姿滑輪划船 — 腰椎伸展力矩',
    ref: 'Fenwick 2009 (PMID 19197209, n=7); Saeterbakken 2015 (PMID 26134664)',
    expected: '槓鈴划船 > 坐姿滑輪划船',
    run() {
      const a = peakDem('row', P('row', { supin: 'pro' }), 'trunkExt', { abs: false });
      const b = peakDem('cablerow', P('cablerow', { grip: 'v' }), 'trunkExt', { abs: false });
      return { labelA: '槓鈴划船', valA: a, labelB: '坐姿滑輪划船', valB: b, unit: 'N·m', pass: a > b };
    },
  },

  // ---------- 19. 直立划船握距 ----------
  {
    exercise: '直立划船',
    compare: '寬握 (grip=1.5) vs 窄握 (grip=0.7) — 三角肌中束活化',
    ref: 'McAllister 2013 (PMID 22362088, n=16)',
    expected: '寬握 > 窄握',
    run() {
      const a = peakMus('uprow', P('uprow', { grip: 1.5 }), 'mdelt', 'a');
      const b = peakMus('uprow', P('uprow', { grip: 0.7 }), 'mdelt', 'a');
      return { labelA: '寬握', valA: a, labelB: '窄握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '直立划船',
    compare: '寬握 (grip=1.5) vs 窄握 (grip=0.7) — 上斜方肌活化',
    ref: 'McAllister 2013 (PMID 22362088, n=16)',
    expected: '寬握 > 窄握',
    run() {
      const a = peakMus('uprow', P('uprow', { grip: 1.5 }), 'uptrap', 'a');
      const b = peakMus('uprow', P('uprow', { grip: 0.7 }), 'uptrap', 'a');
      return { labelA: '寬握', valA: a, labelB: '窄握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '直立划船',
    compare: '窄握 (grip=0.7) vs 寬握 (grip=1.5) — 肱二頭肌活化',
    ref: 'McAllister 2013 (PMID 22362088, n=16)',
    expected: '窄握 > 寬握',
    run() {
      const a = peakMus('uprow', P('uprow', { grip: 0.7 }), 'bic', 'a');
      const b = peakMus('uprow', P('uprow', { grip: 1.5 }), 'bic', 'a');
      return { labelA: '窄握', valA: a, labelB: '寬握', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 20. 坐姿 vs 俯臥腿彎舉 ----------
  {
    exercise: '腿彎舉（坐姿 vs 俯臥）',
    compare: '坐姿 vs 俯臥 — 膕繩肌最大正規化長度 l',
    ref: 'Maeo 2021 (PMID 33009197, n=20, 坐姿肌肥大 +14% vs +9%)',
    expected: '坐姿 > 俯臥',
    run() {
      const a = peakMus('legcurl', P('legcurl', { posture: 'seated' }), 'hams', 'l');
      const b = peakMus('legcurl', P('legcurl', { posture: 'lying' }), 'hams', 'l');
      return { labelA: '坐姿', valA: a, labelB: '俯臥', valB: b, unit: 'l', pass: a > b };
    },
  },

  // ---------- 21. 腿伸機 vs 深蹲：峰值角度位置 ----------
  {
    exercise: '腿伸機（無凸輪槓桿）',
    compare: '接近伸直端 (e=0.1) vs 彎曲端 (e=0.9) — 膝伸力矩',
    ref: 'Escamilla 1998 (PMID 9565938, 開放鏈峰值在近伸直端)',
    expected: '伸直端 > 彎曲端',
    run() {
      const a = atE('legext', P('legext', { cam: 'gravity' }), 0.1).dem.kneeExt;
      const b = atE('legext', P('legext', { cam: 'gravity' }), 0.9).dem.kneeExt;
      return { labelA: '伸直端', valA: a, labelB: '彎曲端', valB: b, unit: 'N·m', pass: a > b };
    },
  },
  {
    exercise: '深蹲（膝伸峰值位置）',
    compare: '深屈端 (e=1.0) vs 淺屈端 (e=0.2) — 膝伸力矩',
    ref: 'Escamilla 1998 (PMID 9565938); Escamilla 2001 (PMID 11194098)',
    expected: '深屈端 > 淺屈端',
    run() {
      const a = atE('squat', P('squat', { barPos: 'high' }), 1.0).dem.kneeExt;
      const b = atE('squat', P('squat', { barPos: 'high' }), 0.2).dem.kneeExt;
      return { labelA: '深屈端', valA: a, labelB: '淺屈端', valB: b, unit: 'N·m', pass: a > b };
    },
  },

  // ---------- 22. 槓鈴彎舉：反握 vs 正握（反手彎舉） ----------
  {
    exercise: '槓鈴彎舉（握法）',
    compare: '反握 (sup) vs 反手正握 (pro) — 肱二頭肌活化',
    ref: 'Kleiber 2015 (PMID 26321946)',
    expected: '反握 > 反手正握',
    run() {
      const a = peakMus('curl', P('curl', { supin: 'sup' }), 'bic', 'a');
      const b = peakMus('curl', P('curl', { supin: 'pro' }), 'bic', 'a');
      return { labelA: '反握', valA: a, labelB: '反手正握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    exercise: '槓鈴彎舉（握法）',
    compare: '反手正握 (pro) vs 反握 (sup) — 肱肌／肱橈肌活化',
    ref: 'Kleiber 2015 (PMID 26321946)',
    expected: '反手正握 > 反握',
    run() {
      const a = peakMus('curl', P('curl', { supin: 'pro' }), 'brach', 'a');
      const b = peakMus('curl', P('curl', { supin: 'sup' }), 'brach', 'a');
      return { labelA: '反手正握', valA: a, labelB: '反握', valB: b, unit: 'a', pass: a > b };
    },
  },
];

let passed = 0;
let failed = 0;

console.log('=== 生物力學模型 vs 文獻趨勢檢查 ===\n');

for (let i = 0; i < CHECKS.length; i++) {
  const c = CHECKS[i];
  const r = c.run();
  const status = r.pass ? 'PASS' : 'FAIL';
  if (r.pass) passed++;
  else failed++;
  const fmt = (v) => (r.unit === 'N·m' || r.unit === '°' ? v.toFixed(1) : v.toFixed(3));
  console.log(`[${String(i + 1).padStart(2, '0')}] ${status} | ${c.exercise}`);
  console.log(`     比較：${c.compare}`);
  console.log(`     文獻：${c.ref}`);
  console.log(`     預期：${c.expected}`);
  console.log(`     模型：${r.labelA} = ${fmt(r.valA)} ${r.unit} vs ${r.labelB} = ${fmt(r.valB)} ${r.unit}`);
}

console.log('\n=== 總計 ===');
console.log(`共 ${CHECKS.length} 項：PASS ${passed} 項，FAIL ${failed} 項（一致率 ${((passed / CHECKS.length) * 100).toFixed(1)}%）`);
