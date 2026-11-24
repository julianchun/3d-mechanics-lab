// 文獻趨勢自動檢查：比對 src/biomech.js 的模型輸出方向是否與 docs/references.md 文獻一致
// 執行方式：
//   npm run test:trends          → 印出完整 42 項檢查報告
//   node tests/trends.mjs --write-status → 重新產生靜態狀態檔 src/trend-status.json
//   node tests/trends.mjs --check        → 重新計算並比對 src/trend-status.json，過時或不一致即失敗
// 注意：本腳本僅作趨勢報告，不修改力學模型；若模型與文獻不一致，印出 FAIL 供後續調校參考。
// 證據分級（evidence）：
//   'direct'    — 文獻直接量測相同比較與對應指標（肌電、肌肉體積或關節力矩／角度）
//   'indirect'  — 文獻相關但非直接（如由肌電推關節力矩、單一收縮期顯著、研討會摘要或模型合併肌群）
//   'inference' — 解剖或幾何推論（無直接實測文獻支持，或文獻顯示無顯著差異）

import fs from 'node:fs';

// 兩個比較值的相對差小於這個比例時視為平手（例如 0.0000001 的差距不代表模型呈現了文獻的方向）
const TIE_MARGIN = 0.01;
import { MODEL_VERSION, analyze, peakAnalysis, defaultParams } from '../src/biomech.js';

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

const EVIDENCE_LABEL = {
  direct: '文獻直接量到',
  indirect: '文獻相關非直接',
  inference: '解剖／幾何推論',
};

// 每一項檢查回傳 { labelA, valA, labelB, valB, unit, pass }；ids 為對應的清單項目 ID
const CHECKS = [
  // Cogley 2005 比較同一伏地挺身的窄手距與寬手距；兩組肌電均以原文方向檢查。
  ...[['pecs', '胸大肌'], ['trilat', '肱三頭肌']].map(([muscle, name]) => ({
    ids: ['pushup'], exercise: '伏地挺身',
    compare: `窄手距（模型 0.8× 肩寬）vs 寬手距（模型 1.8× 肩寬）— ${name}活化`,
    ref: 'Cogley et al. 2005（PMID 16095413；40 人、窄手距與寬手距伏地挺身，胸大肌及肱三頭肌 EMG 均較高）',
    evidence: 'direct', expected: '窄手距 > 寬手距',
    run() {
      const a = peakMus('pushup', P('pushup', { grip: 0.8 }), muscle, 'a');
      const b = peakMus('pushup', P('pushup', { grip: 1.8 }), muscle, 'a');
      return { labelA: '窄手距', valA: a, labelB: '寬手距', valB: b, unit: 'a', pass: a > b };
    },
  })),
  {
    ids: ['pushup'], exercise: '伏地挺身',
    compare: '平地標準伏地挺身：下放位置 vs 撐起位置 — 手部承擔的體重比例',
    ref: 'Suprak et al. 2011（PMID 20179649；傳統腳尖著地伏地挺身，手部測力平台記錄下放位置承重高於撐起位置）',
    evidence: 'direct', expected: '下放位置 > 撐起位置',
    run() {
      const a = atE('pushup', P('pushup'), 1).pose.support.hand[1];
      const b = atE('pushup', P('pushup'), 0).pose.support.hand[1];
      return { labelA: '下放', valA: a, labelB: '撐起', valB: b, unit: 'N', pass: a > b };
    },
  },
  // ---------- 1. 45° 腿推機：腳位高低 ----------
  {
    ids: ['leg-press'],
    exercise: '45° 腿推機',
    compare: '腳踩高 (footHigh=0.8) vs 腳踩低 (footHigh=0.2) — 臀大肌活化',
    ref: 'Da Silva 2008 (PMID 18545207, n=14，高腳位臀大肌 EMG 顯著高於低腳位)',
    evidence: 'direct',
    expected: '腳踩高 > 腳踩低',
    run() {
      const a = peakMus('legpress', P('legpress', { footHigh: 0.8 }), 'gmax', 'a');
      const b = peakMus('legpress', P('legpress', { footHigh: 0.2 }), 'gmax', 'a');
      return { labelA: '高腳位', valA: a, labelB: '低腳位', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['leg-press'],
    exercise: '45° 腿推機',
    compare: '腳踩高 (footHigh=0.8) vs 腳踩低 (footHigh=0.2) — 髖伸力矩',
    ref: 'Da Silva 2008 (PMID 18545207, n=14，實測臀大肌 EMG 較高，推論髖伸力矩較高)',
    evidence: 'indirect',
    expected: '腳踩高 > 腳踩低',
    run() {
      const a = peakDem('legpress', P('legpress', { footHigh: 0.8 }), 'hipExt', { abs: false });
      const b = peakDem('legpress', P('legpress', { footHigh: 0.2 }), 'hipExt', { abs: false });
      return { labelA: '高腳位', valA: a, labelB: '低腳位', valB: b, unit: 'N·m', pass: a > b };
    },
  },
  {
    ids: ['leg-press'],
    exercise: '45° 腿推機',
    compare: '腳踩低 (footHigh=0.2) vs 腳踩高 (footHigh=0.8) — 膝伸力矩',
    ref: 'Da Silva 2008 (PMID 18545207, n=14，實測低腳位股四頭肌 EMG 較高，推論膝伸力矩較高)',
    evidence: 'indirect',
    expected: '腳踩低 > 腳踩高',
    run() {
      const a = peakDem('legpress', P('legpress', { footHigh: 0.2 }), 'kneeExt', { abs: false });
      const b = peakDem('legpress', P('legpress', { footHigh: 0.8 }), 'kneeExt', { abs: false });
      return { labelA: '低腳位', valA: a, labelB: '高腳位', valB: b, unit: 'N·m', pass: a > b };
    },
  },

  // ---------- 2. 深蹲 vs 45° 腿推機 ----------
  {
    ids: ['squat-high', 'leg-press'],
    exercise: '深蹲 vs 45° 腿推機',
    compare: '高槓深蹲 vs 45° 腿推機 — 膕繩肌活化',
    ref: 'Escamilla 1998 (PMID 9565938, n=10, 約 2 倍); Escamilla 2001 (PMID 11528346, n=10)',
    evidence: 'direct',
    expected: '深蹲 > 腿推機',
    run() {
      const a = peakMus('squat', P('squat', { barPos: 'high' }), 'hams', 'a');
      const b = peakMus('legpress', P('legpress'), 'hams', 'a');
      return { labelA: '深蹲', valA: a, labelB: '腿推機', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 3. 自由深蹲 vs 史密斯深蹲 ----------
  {
    ids: ['squat-high', 'smith-squat'],
    exercise: '自由深蹲 vs 史密斯深蹲',
    compare: '高槓深蹲 vs 史密斯深蹲 — 膕繩肌活化',
    ref: 'Schwanbeck 2009 (PMID 19855308, n=6, 股二頭肌 +26%)',
    evidence: 'direct',
    expected: '自由深蹲 > 史密斯',
    run() {
      const a = peakMus('squat', P('squat', { barPos: 'high' }), 'hams', 'a');
      const b = peakMus('smith', P('smith'), 'hams', 'a');
      return { labelA: '自由深蹲', valA: a, labelB: '史密斯', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['squat-high', 'smith-squat'],
    exercise: '自由深蹲 vs 史密斯深蹲',
    compare: '高槓深蹲 vs 史密斯深蹲 — 股四頭肌活化',
    ref: 'Schwanbeck 2009 (PMID 19855308, n=6, 股內側肌 +49%)',
    evidence: 'direct',
    expected: '自由深蹲 > 史密斯',
    run() {
      const a = peakMus('squat', P('squat', { barPos: 'high' }), 'vasti', 'a');
      const b = peakMus('smith', P('smith'), 'vasti', 'a');
      return { labelA: '自由深蹲', valA: a, labelB: '史密斯', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 4. 深蹲：低槓 vs 高槓 ----------
  {
    ids: ['squat-low', 'squat-high'],
    exercise: '深蹲（低槓 vs 高槓）',
    compare: '低槓 vs 高槓 — 髖伸力矩',
    ref: 'Glassbrook 2017 (PMID 28570490); Murawa 2020 (PMID 32551198)',
    evidence: 'direct',
    expected: '低槓 > 高槓',
    run() {
      const a = peakDem('squat', P('squat', { barPos: 'low' }), 'hipExt', { abs: false });
      const b = peakDem('squat', P('squat', { barPos: 'high' }), 'hipExt', { abs: false });
      return { labelA: '低槓', valA: a, labelB: '高槓', valB: b, unit: 'N·m', pass: a > b };
    },
  },
  {
    ids: ['squat-low', 'squat-high'],
    exercise: '深蹲（低槓 vs 高槓）',
    compare: '低槓 vs 高槓 — 腰椎伸展力矩（豎脊肌需求）',
    ref: 'Glassbrook 2017 (PMID 28570490，綜述軀幹前傾與豎脊肌活化較高，推論腰椎力矩較高)',
    evidence: 'indirect',
    expected: '低槓 > 高槓',
    run() {
      const a = peakDem('squat', P('squat', { barPos: 'low' }), 'trunkExt', { abs: false });
      const b = peakDem('squat', P('squat', { barPos: 'high' }), 'trunkExt', { abs: false });
      return { labelA: '低槓', valA: a, labelB: '高槓', valB: b, unit: 'N·m', pass: a > b };
    },
  },
  {
    ids: ['squat-high', 'squat-low'],
    exercise: '深蹲（高槓 vs 低槓）',
    compare: '高槓 vs 低槓 — 股四頭肌活化',
    ref: 'Glassbrook 2017 (PMID 28570490)',
    evidence: 'direct',
    expected: '高槓 > 低槓',
    run() {
      const a = peakMus('squat', P('squat', { barPos: 'high' }), 'vasti', 'a');
      const b = peakMus('squat', P('squat', { barPos: 'low' }), 'vasti', 'a');
      return { labelA: '高槓', valA: a, labelB: '低槓', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 5. 前蹲 vs 高槓背蹲 ----------
  {
    ids: ['front-squat', 'squat-high'],
    exercise: '前蹲 vs 高槓深蹲',
    compare: '前蹲 vs 高槓 — 最低點軀幹前傾角',
    ref: 'Yavuz 2015 (PMID 25630691, n=12，背蹲軀幹前傾角顯著大於前蹲)',
    evidence: 'direct',
    expected: '前蹲 < 高槓（較直立）',
    run() {
      const a = (atE('squat', P('squat', { barPos: 'front' }), 1).pose.phi * 180) / Math.PI;
      const b = (atE('squat', P('squat', { barPos: 'high' }), 1).pose.phi * 180) / Math.PI;
      return { labelA: '前蹲', valA: a, labelB: '高槓', valB: b, unit: '°', pass: a < b };
    },
  },
  {
    ids: ['front-squat', 'squat-high'],
    exercise: '前蹲 vs 高槓深蹲',
    compare: '前蹲 vs 高槓 — 髖伸力矩',
    ref: 'Krzyszkowski & Kipp 2020 (PMID 32544021, n=11，同等絕對負重 60%/80% FS-1RM 下背蹲峰值髖伸力矩顯著大於前蹲)',
    evidence: 'direct',
    expected: '前蹲 < 高槓',
    run() {
      const a = peakDem('squat', P('squat', { barPos: 'front' }), 'hipExt', { abs: false });
      const b = peakDem('squat', P('squat', { barPos: 'high' }), 'hipExt', { abs: false });
      return { labelA: '前蹲', valA: a, labelB: '高槓', valB: b, unit: 'N·m', pass: a < b };
    },
  },

  // ---------- 6. 深蹲深度 ----------
  {
    ids: ['squat-high'],
    exercise: '深蹲深度',
    compare: '全蹲 (depth=0.9) vs 淺蹲 (depth=0.1) — 臀大肌負荷 s',
    ref: 'Kubo 2019 (PMID 31230110，實測 MRI 體積 +6.7% vs +2.2%); Bryanton 2012 (PMID 22797000，髖 RME)',
    evidence: 'indirect',
    expected: '全蹲 > 淺蹲',
    run() {
      const a = peakAnalysis('squat', P('squat', { depth: 0.9 })).mus.gmax.s;
      const b = peakAnalysis('squat', P('squat', { depth: 0.1 })).mus.gmax.s;
      return { labelA: '全蹲', valA: a, labelB: '淺蹲', valB: b, unit: 's', pass: a > b };
    },
  },
  {
    ids: ['squat-high'],
    exercise: '深蹲深度',
    compare: '全蹲 (depth=0.9) vs 淺蹲 (depth=0.1) — 內收大肌負荷 s',
    ref: 'Kubo 2019 (PMID 31230110，實測 MRI 體積 +6.2% vs +2.7%，對照模型負荷指標 s)',
    evidence: 'indirect',
    expected: '全蹲 > 淺蹲',
    run() {
      const a = peakAnalysis('squat', P('squat', { depth: 0.9 })).mus.addmag.s;
      const b = peakAnalysis('squat', P('squat', { depth: 0.1 })).mus.addmag.s;
      return { labelA: '全蹲', valA: a, labelB: '淺蹲', valB: b, unit: 's', pass: a > b };
    },
  },

  // ---------- 7. 深蹲站距 ----------
  // 模型限制（不硬調）：
  // 1. 與 Escamilla et al. 2001 (PMID 11404665) 的兩點矛盾：雖然站距偏移已讓寬站距小腿較窄站距直立 6.7°（符合文獻 5–9°），
  //    但同一研究指出寬／窄站距「軀幹角度無顯著差異」且寬站距「髖伸力矩較高」（382–628 vs 275–577 N·m）；
  //    本模型在固定腳掌中段 cop.z=0 且膝對齊腳尖（外八 35°）下，股骨矢狀面投影縮短約 33%，導致寬站距軀幹反而更直立約 16°（31.8° vs 47.9°）、矢狀面髖伸力矩不升反降（底部 125.6 vs 188.5 N·m）。
  // 2. 肌群／自由度限制：文獻中寬站距臀大肌 EMG 較高亦涉及髖外旋與臀大肌上束外展需求，但本模型缺少髖外旋自由度、
  //    臀大肌以單一合併肌表示且外展力臂為 -0.0051 m（無上束外展力臂），且額狀面 GRF 預設通過髖關節。
  {
    ids: ['squat-high'],
    exercise: '深蹲站距',
    compare: '寬站距 (stance=0.9) vs 窄站距 (stance=0.1) — 臀大肌活化',
    ref: 'Paoli 2009 (PMID 19130646, n=6；僅 0%/70% 1RM 顯著)｜模型限制：寬站距受股骨矢狀投影縮短影響，軀幹反少傾約 16° 且髖力矩下降（與 Escamilla 2001 PMID 11404665 矛盾），另缺髖外旋與臀大肌上束外展力臂',
    evidence: 'direct',
    expected: '寬站距 > 窄站距',
    run() {
      const a = peakMus('squat', P('squat', { stance: 0.9 }), 'gmax', 'a');
      const b = peakMus('squat', P('squat', { stance: 0.1 }), 'gmax', 'a');
      return { labelA: '寬站距', valA: a, labelB: '窄站距', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 8. 相撲硬舉 vs 傳統硬舉 ----------
  {
    ids: ['sumo', 'deadlift'],
    exercise: '相撲 vs 傳統硬舉',
    compare: '相撲 vs 傳統 — 股四頭肌活化',
    ref: 'Escamilla 2002 (PMID 11932579)',
    evidence: 'direct',
    expected: '相撲 > 傳統',
    run() {
      const a = peakMus('deadlift', P('deadlift', { style: 'sumo' }), 'vasti', 'a');
      const b = peakMus('deadlift', P('deadlift', { style: 'conv' }), 'vasti', 'a');
      return { labelA: '相撲', valA: a, labelB: '傳統', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['sumo', 'deadlift'],
    exercise: '相撲 vs 傳統硬舉',
    compare: '相撲 vs 傳統 — 腰椎伸展力矩',
    ref: 'Cholewicki 1991 (PMID 1758295, -10%); Escamilla 2000 (PMID 10912892)',
    evidence: 'direct',
    expected: '相撲 < 傳統',
    run() {
      const a = peakDem('deadlift', P('deadlift', { style: 'sumo' }), 'trunkExt', { abs: false });
      const b = peakDem('deadlift', P('deadlift', { style: 'conv' }), 'trunkExt', { abs: false });
      return { labelA: '相撲', valA: a, labelB: '傳統', valB: b, unit: 'N·m', pass: a < b };
    },
  },

  // ---------- 9. 赤字硬舉 vs 墊高硬舉 ----------
  {
    ids: ['deficit-dl', 'block-pull'],
    exercise: '赤字 vs 墊高硬舉',
    compare: '赤字 (start=-5) vs 墊高 (start=+10) — 股四頭肌活化',
    ref: 'Rogacion 2024 研討會摘要 (WKU IJES 14(4):68，非期刊全文)',
    evidence: 'indirect',
    expected: '赤字 > 墊高',
    run() {
      const a = peakMus('deadlift', P('deadlift', { start: -5 }), 'vasti', 'a');
      const b = peakMus('deadlift', P('deadlift', { start: 10 }), 'vasti', 'a');
      return { labelA: '赤字', valA: a, labelB: '墊高', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['deficit-dl', 'block-pull'],
    exercise: '赤字 vs 墊高硬舉',
    compare: '赤字 (start=-5) vs 墊高 (start=+10) — 臀大肌活化',
    ref: 'Rogacion 2024 研討會摘要 (WKU IJES 14(4):68，非期刊全文)',
    evidence: 'indirect',
    expected: '赤字 > 墊高',
    run() {
      const a = peakMus('deadlift', P('deadlift', { start: -5 }), 'gmax', 'a');
      const b = peakMus('deadlift', P('deadlift', { start: 10 }), 'gmax', 'a');
      return { labelA: '赤字', valA: a, labelB: '墊高', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['deficit-dl', 'block-pull'],
    exercise: '赤字 vs 墊高硬舉',
    compare: '赤字 (start=-5) vs 墊高 (start=+10) — 膕繩肌活化',
    ref: 'Rogacion 2024 研討會摘要 (WKU IJES 14(4):68，非期刊全文)',
    evidence: 'indirect',
    expected: '赤字 > 墊高',
    run() {
      const a = peakMus('deadlift', P('deadlift', { start: -5 }), 'hams', 'a');
      const b = peakMus('deadlift', P('deadlift', { start: 10 }), 'hams', 'a');
      return { labelA: '赤字', valA: a, labelB: '墊高', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 10. 早安體前屈膝彎曲 ----------
  {
    ids: ['good-morning'],
    exercise: '早安體前屈',
    compare: '近直腿 (kneeBend=5°) vs 屈膝 (kneeBend=35°) — 膕繩肌最大長度 l',
    ref: '幾何推論（雙關節膕繩肌跨膝後側；註：Vigotsky 2015 PMID 25653899 n=15 操弄變因為負重而非膝角）',
    evidence: 'inference',
    expected: '近直腿 > 屈膝',
    run() {
      const a = peakMus('goodmorning', P('goodmorning', { kneeBend: 5 }), 'hams', 'l');
      const b = peakMus('goodmorning', P('goodmorning', { kneeBend: 35 }), 'hams', 'l');
      return { labelA: '5°', valA: a, labelB: '35°', valB: b, unit: 'l', pass: a > b };
    },
  },

  // ---------- 11. 臀推 vs 深蹲 ----------
  {
    ids: ['hip-thrust', 'squat-high'],
    exercise: '臀推 vs 深蹲',
    compare: '臀推 vs 高槓深蹲 — 臀大肌活化',
    ref: 'Contreras 2015 (PMID 26214739, n=13, 69.5/86.8% vs 29.4/45.4% MVIC)',
    evidence: 'direct',
    expected: '臀推 > 深蹲',
    run() {
      const a = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 90 }), 'gmax', 'a');
      const b = peakMus('squat', P('squat', { barPos: 'high' }), 'gmax', 'a');
      return { labelA: '臀推', valA: a, labelB: '深蹲', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 12. 臀推腳位 ----------
  {
    ids: ['hip-thrust'],
    exercise: '臀推腳位',
    compare: '腳放遠 (kneeTop=70°) vs 腳放近 (kneeTop=120°) — 膕繩肌活化',
    ref: 'Collazo García 2020 (DOI 10.1519/JSC.0000000000002859)',
    evidence: 'direct',
    expected: '腳放遠 > 腳放近',
    run() {
      const a = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 70 }), 'hams', 'a');
      const b = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 120 }), 'hams', 'a');
      return { labelA: '腳遠 70°', valA: a, labelB: '腳近 120°', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 13. 臀推 vs 槓鈴臀橋 ----------
  {
    ids: ['hip-thrust', 'glute-bridge'],
    exercise: '臀推 vs 槓鈴臀橋',
    compare: '臀推 vs 槓鈴臀橋 — 股四頭肌活化',
    ref: 'Kennedy 2024 (PMID 35586943, Sports Biomech 23(12):2935–2949, n=10)',
    evidence: 'direct',
    expected: '臀推 > 臀橋',
    run() {
      const a = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 90 }), 'vasti', 'a');
      const b = peakMus('hipthrust', P('hipthrust', { surface: 'floor', kneeTop: 130 }), 'vasti', 'a');
      return { labelA: '臀推', valA: a, labelB: '臀橋', valB: b, unit: 'a', pass: a > b };
    },
  },
  // 模型限制（不硬調）：已採用參考 Kennedy 2024（ResearchGate／同團隊 5RM 1.83 vs 1.71× 體重，未能自付費全文核對）之負重比（1.83 vs 1.70×）與地板連續支撐；
  // 但臀橋頂點（髖伸 0°＋屈膝 129°）膕繩肌處於主動不足（診斷值 lRigid≈0.01），現行 Lmt 代理仍保留 fl≈0.91，
  // 使膕繩肌分走約三成髖伸需求，加上臀橋行程較短且臀大肌於 0° 力臂較大（0.075 vs 底部 0.059 m），致峰值低於臀推。
  {
    ids: ['glute-bridge', 'hip-thrust'],
    exercise: '臀橋 vs 臀推',
    compare: '槓鈴臀橋 vs 臀推 — 臀大肌活化',
    ref: 'Kennedy 2024 (PMID 35586943, Sports Biomech 23(12):2935–2949, n=10)｜模型限制：Lmt 長度代理未反映臀橋膕繩肌主動不足',
    evidence: 'direct',
    expected: '臀橋 > 臀推',
    run() {
      const a = peakMus('hipthrust', P('hipthrust', { surface: 'floor', kneeTop: 130 }), 'gmax', 'a');
      const b = peakMus('hipthrust', P('hipthrust', { surface: 'bench', kneeTop: 90 }), 'gmax', 'a');
      return { labelA: '臀橋', valA: a, labelB: '臀推', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 14. 臥推：上斜 vs 平板 ----------
  {
    ids: ['incline-bench', 'bench'],
    exercise: '上斜 vs 平板臥推',
    compare: '上斜 30° vs 平板 0° — 上胸 (pecc) 活化',
    ref: 'Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339，上胸於 30° 達最高); Lauver 2016 (PMID 25799093，整段向心期無顯著差異，僅 26–50% 段 30°／45° 高於平板)',
    evidence: 'direct',
    expected: '上斜 30° > 平板 0°',
    run() {
      const a = peakMus('bench', P('bench', { incline: 30 }), 'pecc', 'a');
      const b = peakMus('bench', P('bench', { incline: 0 }), 'pecc', 'a');
      return { labelA: '上斜 30°', valA: a, labelB: '平板 0°', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['incline-bench', 'bench'],
    exercise: '上斜 vs 平板臥推',
    compare: '上斜 30° vs 平板 0° — 前三角肌 (adelt) 活化',
    ref: 'Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339)',
    evidence: 'direct',
    expected: '上斜 30° > 平板 0°',
    run() {
      const a = peakMus('bench', P('bench', { incline: 30 }), 'adelt', 'a');
      const b = peakMus('bench', P('bench', { incline: 0 }), 'adelt', 'a');
      return { labelA: '上斜 30°', valA: a, labelB: '平板 0°', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['bench', 'incline-bench'],
    exercise: '平板 vs 上斜臥推',
    compare: '平板 0° vs 上斜 30° — 中下胸 (pecs) 活化',
    ref: 'Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339)',
    evidence: 'direct',
    expected: '平板 0° > 上斜 30°',
    run() {
      const a = peakMus('bench', P('bench', { incline: 0 }), 'pecs', 'a');
      const b = peakMus('bench', P('bench', { incline: 30 }), 'pecs', 'a');
      return { labelA: '平板 0°', valA: a, labelB: '上斜 30°', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 15. 臥推握距：窄握 vs 寬握 ----------
  {
    ids: ['cg-bench', 'bench'],
    exercise: '窄握 vs 平板臥推',
    compare: '窄握 (grip=0.9, flare=35) vs 標準 (grip=1.6, flare=52) — 三頭肌活化',
    ref: 'Lehman 2005 (PMID 16095407)',
    evidence: 'direct',
    expected: '窄握 > 標準握',
    run() {
      const a = peakMus('bench', P('bench', { grip: 0.9, flare: 35 }), 'trilat', 'a');
      const b = peakMus('bench', P('bench', { grip: 1.6, flare: 52 }), 'trilat', 'a');
      return { labelA: '窄握', valA: a, labelB: '標準握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['cg-bench', 'bench'],
    exercise: '窄握 vs 平板臥推',
    compare: '標準 (grip=1.6, flare=52) vs 窄握 (grip=0.9, flare=35) — 中下胸活化',
    ref: 'Lehman 2005 (PMID 16095407)',
    evidence: 'direct',
    expected: '標準握 > 窄握',
    run() {
      const a = peakMus('bench', P('bench', { grip: 1.6, flare: 52 }), 'pecs', 'a');
      const b = peakMus('bench', P('bench', { grip: 0.9, flare: 35 }), 'pecs', 'a');
      return { labelA: '標準握', valA: a, labelB: '窄握', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 16. 滑輪下拉：正握 vs 反握 ----------
  {
    ids: ['pulldown', 'pulldown-sup'],
    exercise: '滑輪下拉（清單預設）',
    compare: '正握 (pro, grip=1.7) vs 反握 (sup, grip=1.1) — 背闊肌活化',
    ref: 'Lusk 2010 (PMID 20543740, n=12)',
    evidence: 'direct',
    expected: '正握 > 反握',
    run() {
      const a = peakMus('pulldown', P('pulldown', { supin: 'pro' }), 'lat', 'a');
      const b = peakMus('pulldown', P('pulldown', { supin: 'sup', grip: 1.1 }), 'lat', 'a');
      return { labelA: '正握', valA: a, labelB: '反握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['pulldown', 'pulldown-sup'],
    exercise: '滑輪下拉（同握距）',
    compare: '同握距 (grip=1.4) 正握 vs 反握 — 背闊肌活化',
    ref: 'Lusk 2010 (PMID 20543740, n=12, 握法主效應)｜模型能呈現差異，靠的是推論的反握手肘平面（較前、較貼身，未經實測）',
    evidence: 'direct',
    expected: '正握 > 反握',
    run() {
      const a = peakMus('pulldown', P('pulldown', { supin: 'pro', grip: 1.4 }), 'lat', 'a');
      const b = peakMus('pulldown', P('pulldown', { supin: 'sup', grip: 1.4 }), 'lat', 'a');
      return { labelA: '正握', valA: a, labelB: '反握', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 17. 坐姿滑輪划船：寬握／高外展 vs 窄握／低外展 ----------
  {
    ids: ['cable-row-wide', 'cable-row'],
    exercise: '坐姿滑輪划船',
    compare: '寬握高外展 (wide) vs 窄握低外展 (v) — 三角肌後束活化',
    ref: 'de Abreu Vasconcelos 2023 (DOI 10.47206/ijsc.v3i1.190, n=21，比較肩外展 0°/30°/60°/90°，外展越高後三角越高；Padovan 2025 未報告後三角振幅較高)',
    evidence: 'indirect',
    expected: '寬握高外展 > 窄握低外展',
    run() {
      const a = peakMus('cablerow', P('cablerow', { grip: 'wide' }), 'pdelt', 'a');
      const b = peakMus('cablerow', P('cablerow', { grip: 'v' }), 'pdelt', 'a');
      return { labelA: '寬握', valA: a, labelB: '窄握 V 把', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['cable-row', 'cable-row-wide'],
    exercise: '坐姿滑輪划船',
    compare: '窄握低外展 (v) vs 寬握高外展 (wide) — 背闊肌活化',
    ref: 'Padovan 2025 (DOI 10.5114/jhk/209550, n=14，窄握背闊較高 ES=1.08); de Abreu Vasconcelos 2023 (DOI 10.47206/ijsc.v3i1.190, n=21，肩外展接近 0° 背闊較高)',
    evidence: 'direct',
    expected: '窄握低外展 > 寬握高外展',
    run() {
      const a = peakMus('cablerow', P('cablerow', { grip: 'v' }), 'lat', 'a');
      const b = peakMus('cablerow', P('cablerow', { grip: 'wide' }), 'lat', 'a');
      return { labelA: '窄握 V 把', valA: a, labelB: '寬握', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 18. 槓鈴划船 vs 坐姿滑輪划船 ----------
  {
    ids: ['row', 'cable-row'],
    exercise: '槓鈴划船 vs 坐姿滑輪划船',
    compare: '站姿槓鈴划船 vs 坐姿滑輪划船 — 腰椎伸展力矩',
    ref: 'Fenwick 2009 (PMID 19197209, n=7); Saeterbakken 2015 (PMID 26134664)',
    evidence: 'direct',
    expected: '槓鈴划船 > 坐姿滑輪划船',
    run() {
      const a = peakDem('row', P('row', { supin: 'pro' }), 'trunkExt', { abs: false });
      const b = peakDem('cablerow', P('cablerow', { grip: 'v' }), 'trunkExt', { abs: false });
      return { labelA: '槓鈴划船', valA: a, labelB: '坐姿滑輪划船', valB: b, unit: 'N·m', pass: a > b };
    },
  },

  // ---------- 19. 直立划船握距 ----------
  {
    ids: ['uprow'],
    exercise: '直立划船',
    compare: '寬握 (grip=1.5) vs 窄握 (grip=0.7) — 側／中三角肌活化',
    ref: 'McAllister 2013 (PMID 22362088, n=16；側三角 LD 向心 50/100 vs 200% BAB 與離心全部比較皆顯著，強證據)',
    evidence: 'direct',
    expected: '寬握 > 窄握',
    run() {
      const a = peakMus('uprow', P('uprow', { grip: 1.5 }), 'mdelt', 'a');
      const b = peakMus('uprow', P('uprow', { grip: 0.7 }), 'mdelt', 'a');
      return { labelA: '寬握', valA: a, labelB: '窄握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['uprow'],
    exercise: '直立划船',
    compare: '寬握 (grip=1.5) vs 窄握 (grip=0.7) — 上斜方肌活化',
    ref: 'McAllister 2013 (PMID 22362088, n=16；上斜方 UT 僅離心期達顯著，向心期不顯著，中度證據)',
    evidence: 'indirect',
    expected: '寬握 > 窄握',
    run() {
      const a = peakMus('uprow', P('uprow', { grip: 1.5 }), 'uptrap', 'a');
      const b = peakMus('uprow', P('uprow', { grip: 0.7 }), 'uptrap', 'a');
      return { labelA: '寬握', valA: a, labelB: '窄握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['uprow'],
    exercise: '直立划船',
    compare: '窄握 (grip=0.7) vs 寬握 (grip=1.5) — 肱二頭肌活化',
    ref: 'McAllister 2013 (PMID 22362088, n=16；僅離心期 50% vs 200% BAB 顯著，向心期不顯著，弱／條件式證據)',
    evidence: 'indirect',
    expected: '窄握 > 寬握',
    run() {
      const a = peakMus('uprow', P('uprow', { grip: 0.7 }), 'bic', 'a');
      const b = peakMus('uprow', P('uprow', { grip: 1.5 }), 'bic', 'a');
      return { labelA: '窄握', valA: a, labelB: '寬握', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 20. 坐姿 vs 俯臥腿彎舉 ----------
  {
    ids: ['leg-curl', 'lying-leg-curl'],
    exercise: '腿彎舉（坐姿 vs 俯臥）',
    compare: '坐姿 vs 俯臥 — 膕繩肌最大正規化長度 l',
    ref: 'Maeo 2021 (PMID 33009197, n=20，實測坐姿肌肥大 +14% vs +9%，歸因於髖屈拉長雙關節膕繩肌)',
    evidence: 'indirect',
    expected: '坐姿 > 俯臥',
    run() {
      const a = peakMus('legcurl', P('legcurl', { posture: 'seated' }), 'hams', 'l');
      const b = peakMus('legcurl', P('legcurl', { posture: 'lying' }), 'hams', 'l');
      return { labelA: '坐姿', valA: a, labelB: '俯臥', valB: b, unit: 'l', pass: a > b };
    },
  },

  // ---------- 21. 腿伸機 vs 深蹲：峰值角度位置 ----------
  {
    ids: ['leg-ext'],
    exercise: '腿伸機（無凸輪槓桿）',
    compare: '接近伸直端 (e=0.1) vs 彎曲端 (e=0.9) — 膝伸力矩',
    ref: 'Escamilla 1998 (PMID 9565938，開放鏈股四頭肌 EMG 峰值在近伸直端；力矩對應槓桿幾何)',
    evidence: 'indirect',
    expected: '伸直端 > 彎曲端',
    run() {
      const a = atE('legext', P('legext', { cam: 'gravity' }), 0.1).dem.kneeExt;
      const b = atE('legext', P('legext', { cam: 'gravity' }), 0.9).dem.kneeExt;
      return { labelA: '伸直端', valA: a, labelB: '彎曲端', valB: b, unit: 'N·m', pass: a > b };
    },
  },
  {
    ids: ['squat-high'],
    exercise: '深蹲（膝伸峰值位置）',
    compare: '深屈端 (e=1.0) vs 淺屈端 (e=0.2) — 膝伸力矩',
    ref: 'Escamilla 1998 (PMID 9565938); Escamilla 2001 (PMID 11194098)',
    evidence: 'direct',
    expected: '深屈端 > 淺屈端',
    run() {
      const a = atE('squat', P('squat', { barPos: 'high' }), 1.0).dem.kneeExt;
      const b = atE('squat', P('squat', { barPos: 'high' }), 0.2).dem.kneeExt;
      return { labelA: '深屈端', valA: a, labelB: '淺屈端', valB: b, unit: 'N·m', pass: a > b };
    },
  },

  // ---------- 22. 槓鈴彎舉：反握 vs 正握（反手彎舉） ----------
  {
    ids: ['curl', 'reverse-curl'],
    exercise: '槓鈴彎舉（握法）',
    compare: '反握 (sup) vs 反手正握 (pro) — 肱二頭肌活化',
    ref: '解剖推論（前臂旋前時二頭肌屈肘效率下降；非文獻結果，Kleiber 2015 PMID 26300781 顯示二頭肌 EMG 在各握法間無顯著差異）',
    evidence: 'inference',
    expected: '反握 > 反手正握',
    run() {
      const a = peakMus('curl', P('curl', { supin: 'sup' }), 'bic', 'a');
      const b = peakMus('curl', P('curl', { supin: 'pro' }), 'bic', 'a');
      return { labelA: '反握', valA: a, labelB: '反手正握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['reverse-curl', 'curl'],
    exercise: '槓鈴彎舉（握法）',
    compare: '反手正握 (pro) vs 反握 (sup) — 肱肌／肱橈肌活化',
    ref: 'Kleiber 2015 (PMID 26300781, n=16，實測肱橈肌旋前貢獻顯著較高；註：模型 brach 為肱肌＋肱橈肌合併)',
    evidence: 'indirect',
    expected: '反手正握 > 反握',
    run() {
      const a = peakMus('curl', P('curl', { supin: 'pro' }), 'brach', 'a');
      const b = peakMus('curl', P('curl', { supin: 'sup' }), 'brach', 'a');
      return { labelA: '反手正握', valA: a, labelB: '反握', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 23. 蝴蝶機 vs 平板臥推 ----------
  {
    ids: ['pec-deck', 'bench'],
    exercise: '平板臥推 vs 蝴蝶機',
    compare: '平板臥推 vs 蝴蝶機 — 肱三頭肌活化',
    ref: 'Rocha Júnior, Gentil et al. 2007 (DOI 10.1590/S1517-86922007000100012，實測臥推三頭肌 EMG 顯著高於蝴蝶機)',
    evidence: 'direct',
    expected: '平板臥推 > 蝴蝶機',
    run() {
      const a = peakMus('bench', P('bench'), 'trilat', 'a');
      const b = peakMus('pecdeck', P('pecdeck'), 'trilat', 'a');
      return { labelA: '平板臥推', valA: a, labelB: '蝴蝶機', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['pec-deck'],
    exercise: '蝴蝶機（握把型式）',
    compare: '握把式 (handle) vs 前臂墊式 (pad) — 屈肘肌群 (brach) 活化',
    ref: '力學／解剖推論（握把式需屈肘肌等長維持微彎肘角；前臂墊式阻力直接作用於前臂且垂直於屈肘平面，無直接 EMG 對照文獻）',
    evidence: 'inference',
    expected: '握把式 > 前臂墊式',
    run() {
      const a = peakMus('pecdeck', P('pecdeck', { style: 'handle' }), 'brach', 'a');
      const b = peakMus('pecdeck', P('pecdeck', { style: 'pad' }), 'brach', 'a');
      return { labelA: '握把式', valA: a, labelB: '前臂墊式', valB: b, unit: 'a', pass: a > b };
    },
  },

  // ---------- 24. 滑輪夾胸：高位往下 vs 低位往上 ----------
  {
    ids: ['cable-fly-high', 'cable-fly-mid', 'cable-fly-low'],
    exercise: '滑輪夾胸（滑輪高度）',
    compare: '高位往下 (high) vs 低位往上 (low) — 中下胸 (pecs) 活化',
    ref: '解剖推論：Ackland 2008 力臂方向；Lee 2019 (PMID 28943236) 等長施力方向研究未區分出胸骨／鎖骨部差異，不是滑輪高低位的直接證據; Ackland 2008 (PMID 18691376，胸骨部具肩內收／下壓傾向); Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339)',
    evidence: 'inference',
    expected: '高位往下 > 低位往上',
    run() {
      const a = peakMus('cablefly', P('cablefly', { height: 'high' }), 'pecs', 'a');
      const b = peakMus('cablefly', P('cablefly', { height: 'low' }), 'pecs', 'a');
      return { labelA: '高位往下', valA: a, labelB: '低位往上', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['cable-fly-low', 'cable-fly-mid', 'cable-fly-high'],
    exercise: '滑輪夾胸（滑輪高度）',
    compare: '低位往上 (low) vs 高位往下 (high) — 上胸 (pecc) 活化',
    ref: '解剖推論：Ackland 2008 力臂方向；Lee 2019 (PMID 28943236) 等長施力方向研究未區分出胸骨／鎖骨部差異，不是滑輪高低位的直接證據; Ackland 2008 (PMID 18691376，鎖骨部肩屈力臂大); Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339)',
    evidence: 'inference',
    expected: '低位往上 > 高位往下',
    run() {
      const a = peakMus('cablefly', P('cablefly', { height: 'low' }), 'pecc', 'a');
      const b = peakMus('cablefly', P('cablefly', { height: 'high' }), 'pecc', 'a');
      return { labelA: '低位往上', valA: a, labelB: '高位往下', valB: b, unit: 'a', pass: a > b };
    },
  },
  // ---------- 25. 提踵：膝角對腓腸肌操作長度 ----------
  {
    ids: ['calf-raise-standing', 'calf-raise-seated'],
    exercise: '站姿 vs 坐姿提踵',
    compare: '同一踝角時，站姿近伸膝 vs 坐姿屈膝 — 腓腸肌相對長度',
    ref: 'Kinoshita et al. 2023 (PMID 38156065，OpenSim 圖 1 顯示站姿腓腸肌操作長度高於坐姿；屬文獻中的模型推算，非即時肌電)',
    evidence: 'indirect',
    expected: '站姿腓腸肌較長',
    run() {
      const a = atE('calfraise', P('calfraise', { posture: 'standing' }), 0.5).mus.gas.l;
      const b = atE('calfraise', P('calfraise', { posture: 'seated' }), 0.5).mus.gas.l;
      return { labelA: '站姿', valA: a, labelB: '坐姿', valB: b, unit: 'l', pass: a > b };
    },
  },
  // ---------- 26. 啞鈴彎舉：反握 vs 錘式對握 ----------
  {
    ids: ['db-curl', 'hammer-curl'],
    exercise: '啞鈴彎舉（反握 vs 錘式）',
    compare: '反握 (sup) vs 錘式對握 (neutral) — 肱二頭肌活化',
    ref: 'Coratella et al. 2023 (PMID 36976950，向心期反握肱二頭肌 sEMG 顯著高於對握約 12%)',
    evidence: 'direct',
    expected: '反握 > 錘式對握',
    run() {
      const a = peakMus('dbcurl', P('dbcurl', { grip: 'sup' }), 'bic', 'a');
      const b = peakMus('dbcurl', P('dbcurl', { grip: 'neutral' }), 'bic', 'a');
      return { labelA: '反握', valA: a, labelB: '錘式對握', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['hammer-curl', 'db-curl'],
    exercise: '啞鈴彎舉（錘式 vs 反握）',
    compare: '錘式對握 (neutral) vs 反握 (sup) — 前三角肌活化',
    ref: 'Coratella et al. 2023 (PMID 36976950，對握前三角肌穩定活化顯著高於反握約 9%)',
    evidence: 'direct',
    expected: '錘式對握 > 反握',
    run() {
      const a = peakMus('dbcurl', P('dbcurl', { grip: 'neutral' }), 'adelt', 'a');
      const b = peakMus('dbcurl', P('dbcurl', { grip: 'sup' }), 'adelt', 'a');
      return { labelA: '錘式對握', valA: a, labelB: '反握', valB: b, unit: 'a', pass: a > b };
    },
  },
  // ---------- 27. 啞鈴側平舉 vs 平板臥推 ----------
  {
    ids: ['lat-raise', 'bench'],
    exercise: '啞鈴側平舉 vs 平板臥推',
    compare: '啞鈴側平舉 vs 平板臥推 — 三角肌中束活化',
    ref: 'Campos et al. 2020 (PMID 33312291，側平舉三角肌中束 sEMG 顯著高於臥推)',
    evidence: 'direct',
    expected: '側平舉 > 平板臥推',
    run() {
      const a = peakMus('latraise', P('latraise'), 'mdelt', 'a');
      const b = peakMus('bench', P('bench'), 'mdelt', 'a');
      return { labelA: '側平舉', valA: a, labelB: '平板臥推', valB: b, unit: 'a', pass: a > b };
    },
  },
  // ---------- 28. 啞鈴臥推：上斜 30° vs 平板 0° ----------
  {
    ids: ['db-bench', 'db-bench-incline'],
    exercise: '啞鈴臥推（平板 0° vs 上斜 30°）',
    compare: '平板 0° vs 上斜 30° — 中下胸 (pecs) 活化',
    ref: 'Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339，槓鈴臥推平板中下胸高於上斜 30°，間接支持啞鈴平板趨勢)',
    evidence: 'indirect',
    expected: '平板 0° > 上斜 30°',
    run() {
      const a = peakMus('dbbench', P('dbbench', { incline: '0' }), 'pecs', 'a');
      const b = peakMus('dbbench', P('dbbench', { incline: '30' }), 'pecs', 'a');
      return { labelA: '平板 0°', valA: a, labelB: '上斜 30°', valB: b, unit: 'a', pass: a > b };
    },
  },
  {
    ids: ['db-bench-incline', 'db-bench'],
    exercise: '啞鈴臥推（上斜 30° vs 平板 0°）',
    compare: '上斜 30° vs 平板 0° — 上胸 (pecc) 活化',
    ref: 'Rodríguez-Ridao 2020 (DOI 10.3390/ijerph17197339，槓鈴臥推上胸於 30° 達最高，間接支持啞鈴上斜趨勢); Lauver 2016 (PMID 25799093，槓鈴臥推上胸整段向心期無顯著差異，僅 26–50% 向心段 30°／45° 高於平板)',
    evidence: 'indirect',
    expected: '上斜 30° > 平板 0°',
    run() {
      const a = peakMus('dbbench', P('dbbench', { incline: '30' }), 'pecc', 'a');
      const b = peakMus('dbbench', P('dbbench', { incline: '0' }), 'pecc', 'a');
      return { labelA: '上斜 30°', valA: a, labelB: '平板 0°', valB: b, unit: 'a', pass: a > b };
    },
  },
  // ---------- 29. 高腳杯深蹲 vs 高槓背蹲：軀幹前傾角 ----------
  {
    ids: ['goblet-squat', 'squat-high'],
    exercise: '高腳杯深蹲 vs 高槓深蹲',
    compare: '高腳杯深蹲 vs 高槓背蹲 — 最低點軀幹前傾角',
    ref: '幾何／預設推論（高腳杯預設 dom=0.25 與前側偏移 domShift=-0.08 皆為模型設定，與高槓預設 dom=0.45 比較屬預設反映而非獨立實測驗證；前側負重較直立概念參考 Yavuz 2015 PMID 25630691）',
    evidence: 'inference',
    expected: '高腳杯 < 高槓（較直立）',
    run() {
      const a = (atE('goblet', P('goblet'), 1).pose.phi * 180) / Math.PI;
      const b = (atE('squat', P('squat', { barPos: 'high' }), 1).pose.phi * 180) / Math.PI;
      return { labelA: '高腳杯', valA: a, labelB: '高槓', valB: b, unit: '°', pass: a < b };
    },
  },
];

const writeStatus = process.argv.includes('--write-status');
const checkStatus = process.argv.includes('--check');
const quiet = writeStatus || checkStatus;

let passed = 0;
let failed = 0;
const stats = {
  direct: { total: 0, pass: 0, fail: 0 },
  indirect: { total: 0, pass: 0, fail: 0 },
  inference: { total: 0, pass: 0, fail: 0 },
};
const byId = {};

if (!quiet) console.log('=== 生物力學模型 vs 文獻趨勢檢查 ===\n');

for (let i = 0; i < CHECKS.length; i++) {
  const c = CHECKS[i];
  if (!stats[c.evidence]) {
    throw new Error(`Check #${i + 1} 缺少有效的 evidence 欄位：${c.evidence}`);
  }
  if (!Array.isArray(c.ids) || c.ids.length === 0) {
    throw new Error(`Check #${i + 1} 缺少有效的 ids 欄位`);
  }
  const r = c.run();
  // 差距太小（相對差 < TIE_MARGIN）視為平手：模型沒有呈現出方向，不算與文獻一致
  const rel = Math.abs(r.valA - r.valB) / Math.max(Math.abs(r.valA), Math.abs(r.valB), 1e-9);
  r.tie = rel < TIE_MARGIN;
  if (r.tie) r.pass = false;
  const status = r.pass ? 'PASS' : r.tie ? 'FAIL（平手）' : 'FAIL';
  if (r.pass) {
    passed++;
    stats[c.evidence].pass++;
  } else {
    failed++;
    stats[c.evidence].fail++;
  }
  stats[c.evidence].total++;
  const fmt = (v) => (r.unit === 'N·m' || r.unit === '°' ? v.toFixed(1) : v.toFixed(3));
  const modelText = `${r.labelA} = ${fmt(r.valA)} ${r.unit} vs ${r.labelB} = ${fmt(r.valB)} ${r.unit}`;
  if (!quiet) {
    console.log(`[${String(i + 1).padStart(2, '0')}] ${status} | [${c.evidence}] ${c.exercise}`);
    console.log(`     比較：${c.compare}`);
    console.log(`     依據：${c.ref}（${EVIDENCE_LABEL[c.evidence]}）`);
    console.log(`     預期：${c.expected}`);
    console.log(`     模型：${modelText}`);
  }

  const item = {
    index: i + 1,
    pass: r.pass,
    tie: r.tie,
    evidence: c.evidence,
    evidenceLabel: EVIDENCE_LABEL[c.evidence],
    exercise: c.exercise,
    compare: c.compare,
    expected: c.expected,
    ref: c.ref,
    model: modelText,
  };
  for (const id of c.ids) {
    if (!byId[id]) byId[id] = [];
    byId[id].push(item);
  }
}

if (!quiet) {
  console.log('\n=== 總計 ===');
  console.log(`全部共 ${CHECKS.length} 項：PASS ${passed} 項，FAIL ${failed} 項（一致率 ${((passed / CHECKS.length) * 100).toFixed(1)}%）`);
  for (const key of ['direct', 'indirect', 'inference']) {
    const s = stats[key];
    const pct = s.total > 0 ? ((s.pass / s.total) * 100).toFixed(1) : '0.0';
    console.log(`  - ${key.padEnd(9)}（${EVIDENCE_LABEL[key]}）：共 ${String(s.total).padStart(2)} 項｜PASS ${String(s.pass).padStart(2)}，FAIL ${String(s.fail).padStart(2)}（${pct}%）`);
  }
}

const outPath = new URL('../src/trend-status.json', import.meta.url);
const payload = {
  modelVersion: MODEL_VERSION,
  summary: { total: CHECKS.length, pass: passed, fail: failed, byEvidence: stats },
  byId,
};
const serialized = JSON.stringify(payload, null, 2) + '\n';

if (writeStatus) {
  fs.writeFileSync(outPath, serialized, 'utf8');
  console.log(`已寫入靜態比對結果：src/trend-status.json（modelVersion=${MODEL_VERSION}，${passed}/${CHECKS.length} PASS）`);
}

if (checkStatus) {
  let existing = null;
  try {
    existing = fs.readFileSync(outPath, 'utf8');
  } catch {
    console.error('trend-status.json 檢查失敗：檔案不存在，請執行 npm run trends:json 產生。');
    process.exit(1);
  }
  if (existing !== serialized) {
    console.error('trend-status.json 檢查失敗：內容與目前模型結果不一致（或過時），請執行 npm run trends:json 更新。');
    process.exit(1);
  }
  console.log(`trend-status.json PASS（modelVersion=${MODEL_VERSION}，${passed}/${CHECKS.length} PASS）`);
}
