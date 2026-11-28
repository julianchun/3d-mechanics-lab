// 力學核心：姿勢求解 → 關節力矩（準靜態）→ 肌肉分配（最小化活化平方和）
// 座標：X = 身體右側、Y = 上、Z = 前方（臥推時 Z = 腳的方向）。只算右側，左側鏡像。
import { shoulderFitVector, shoulderFitScap } from './shoulder-arms.js';
import { DAS3_SHOULDER } from './das3-shoulder.js';
import { forearmArm, FOREARM_MUSCLE_SOURCE } from './forearm.js';

export const MODEL_VERSION = '0.13.0';
// DAS3 實驗組若增加超載或既有問題，預設維持原組；建置時可設 VITE_SHOULDER_PARAMETER_SET=das3。
export const SHOULDER_PARAMETER_SET = (typeof process !== 'undefined' && process.env.SHOULDER_PARAMETER_SET === 'das3') ||
  import.meta.env?.VITE_SHOULDER_PARAMETER_SET === 'das3' ? 'das3' : 'legacy';
// 群體常模僅供人工複查；髖角缺骨盆分段，肩後伸代理亦無可直接換算的常模。
export const ROM_HINTS = Object.freeze({
  hipFlex: 136, kneeFlex: 138, ankleDorsi: 39, shFlex: 160, shAbd: 150,
  shPlane: 155, elbFlex: 146,
});
const G = 9.81;
// 示範假設：足板角有一半用於小腿前傾；此比例沒有同條件實測值。
export const HEEL_SHANK_SHARE = 0.5;
let heelShankShare = HEEL_SHANK_SHARE;
// 僅供同步驗證重算；每次還原，產品路徑仍使用上方預設值。
export function withHeelShankShareForValidation(share, run) {
  if (!Number.isFinite(share) || share < 0 || share > 1) throw new Error('鞋跟小腿分配比例須介於 0 與 1');
  const original = heelShankShare;
  try {
    heelShankShare = share;
    return run();
  } finally {
    heelShankShare = original;
  }
}

export const DEFAULT_BODY = Object.freeze({
  // 依 BodyParts3D 骨骼比例，縮放到身高 175 cm
  heightM: 1.75, sex: 'male', mass: 75, Ls: 0.394, Lt: 0.44, Ltr: 0.518, Lu: 0.287, Lf: 0.332,
  hipHalf: 0.09, shHalf: 0.167, ankleH: 0.068,
});
const BODY_LENGTHS = ['Ls', 'Lt', 'Ltr', 'Lu', 'Lf', 'hipHalf', 'shHalf', 'ankleH'];
// ratios 以身高為分母；未指定的欄位依原示範身體等比例縮放。
export function createBody({ heightM = DEFAULT_BODY.heightM, massKg = DEFAULT_BODY.mass, sex = 'male', ratios = {} } = {}) {
  if (!Number.isFinite(heightM) || heightM < 1.2 || heightM > 2.3) throw new Error('身高須介於 1.2 與 2.3 m');
  if (!Number.isFinite(massKg) || massKg < 25 || massKg > 250) throw new Error('體重須介於 25 與 250 kg');
  if (!['male', 'female'].includes(sex)) throw new Error('性別須為 male 或 female');
  for (const [key, value] of Object.entries(ratios)) {
    if (!BODY_LENGTHS.includes(key) || !Number.isFinite(value) || value <= 0 || value >= 0.7) throw new Error(`無效身體比例：${key}`);
  }
  const body = { heightM, sex, mass: massKg };
  for (const key of BODY_LENGTHS) body[key] = ratios[key] === undefined ?
    DEFAULT_BODY[key] * (heightM / DEFAULT_BODY.heightM) : heightM * ratios[key];
  body.lumbar = Object.freeze({ model5cm: lumbarOffsetM('model5cm', body), iliacCrest: lumbarOffsetM('iliacCrest', body), L5S1: lumbarOffsetM('L5S1', body) });
  return Object.freeze(body);
}
// ---------- 腰背力矩取矩點 ----------
// 取矩點位於髖中心上方、沿單一軀幹軸 u 的距離（m）。模型沒有獨立骨盆，只能沿 u 取點。
// - model5cm：原產品設定，固定 0.05 m（不隨身材縮放，沒有出處；產品預設，保持舊數字不變）。
// - iliacCrest：髂嵴高度減大轉子高度。ANSUR II 公開逐人資料（iliocristaleheight − trochanterionheight）
//   除以身高，男 0.0915、女 0.0923（SD 約 0.012、0.011）；模型髖中心高度本來就由大轉子高度定義，兩者相減一致。
//   資料來源與推導見 docs/research/lumbar-point.md。
// - L5S1：Németh & Ohlsén 1989（Spine 14(6):604–605，PMID 2749375，CT 21 人）髖到 L5–S1 的三維距離 122 mm，
//   男 6.9%、女 7.5% 身高。原文只給三維距離，沒有垂直／前後分量；此處假設沿軀幹軸（方向未查證）。
export const LUMBAR_POINTS = Object.freeze({ model5cm: null, iliacCrest: { male: 0.0915, female: 0.0923 }, L5S1: { male: 0.069, female: 0.075 } });
export function lumbarOffsetM(name, body = BODY) {
  if (!Object.hasOwn(LUMBAR_POINTS, name)) throw new Error(`未知腰背取矩點：${name}`);
  const ratio = LUMBAR_POINTS[name];
  return ratio ? ratio[body.sex] * body.heightM : 0.05; // 以身高比例隨身材縮放；model5cm 保持固定值
}
let lumbarPoint = 'model5cm';
export const lumbarPointName = () => lumbarPoint;
// 僅供驗證／診斷：暫時改用研究定義的取矩點；產品路徑維持 model5cm，finally 還原。
export function withLumbarPoint(name, run) {
  lumbarOffsetM(name);
  const original = lumbarPoint;
  try { lumbarPoint = name; return run(); } finally { lumbarPoint = original; }
}
// 模型幾何使用同步的動態身體範圍；可巢狀呼叫，finally 保證恢復。
// 不可在 run 內 await。此 API 適合批次驗證，也可供日後 UI 在單次運算中使用。
export let BODY = DEFAULT_BODY;
export function withBody(body, run) {
  if (!body || !Number.isFinite(body.heightM) || body.heightM <= 0 ||
      !BODY_LENGTHS.every((key) => Number.isFinite(body[key]) && body[key] > 0) ||
      !Number.isFinite(body.mass) || body.mass <= 0 || !['male', 'female'].includes(body.sex) ||
      typeof run !== 'function') throw new Error('無效身體參數');
  const previous = BODY;
  BODY = body;
  try {
    const result = run();
    if (result && typeof result.then === 'function') throw new Error('withBody 僅支援同步函式');
    return result;
  } finally { BODY = previous; }
}
// de Leva 1996 表 4，男性節段質量（全身比例）；頭頸與手各自計入，不把殘差塞進軀幹。
// DOI: 10.1016/0021-9290(95)00178-6；節段標記與本骨架的對應見 docs/research/methods.md。
const SEGMENTS = {
  male: { mass: { head: 0.0694, trunk: 0.4346, upper: 0.0271, fore: 0.0162, hand: 0.0061,
    thigh: 0.1416, shank: 0.0433, foot: 0.0137 }, cm: { head: 0.5976, trunkUp: 0.5514, upper: 0.5772,
    fore: 0.4574, hand: 0.7900, thigh: 0.4095, shank: 0.4395, foot: 0.4415 } },
  female: { mass: { head: 0.0668, trunk: 0.4257, upper: 0.0255, fore: 0.0138, hand: 0.0056,
    thigh: 0.1478, shank: 0.0481, foot: 0.0129 }, cm: { head: 0.5894, trunkUp: 0.5036, upper: 0.5754,
    fore: 0.4559, hand: 0.7474, thigh: 0.3612, shank: 0.4352, foot: 0.4014 } },
};
// 負重比例（× 體重）：
// - 臀推 1.70、臀橋 1.83：參考 Contreras et al. 2015（PMID 26214739；10RM 臀推／背蹲比 87.4／53.2 kg ≈ 1.64×，注意 1.64× 為臀推相對背蹲之負重比，非體重倍數）
//   與 Kennedy et al. 2024（PMID 35586943；5RM 臀推 143.6 kg ≈ 1.71× 體重、臀橋 154.3 kg ≈ 1.83× 體重，體重 84.3 kg）。
//   註：兩篇 PubMed 摘要皆未列負重公斤數，上述數值係見作者公開摘錄／ResearchGate 與同團隊論文，未能從期刊付費全文核對；
//   因本模型以深蹲 1.0× 體重為基準，採用 1.70／1.83 可同時反映「臀推負重顯著高於深蹲」與「臀橋 5RM 略高於臀推」之實測排序，取代原無出處之 1.3× 假設。
export const BAR_RATIO = { squat: 1.0, deadlift: 1.2, rdl: 0.9, bench: 0.8, row: 0.7, ohp: 0.5, goodmorning: 0.45, curl: 0.35, shrug: 1.2, uprow: 0.35, hipthrust: 1.7, glutebridge: 1.83,
  // 器械示範負重基準（× 體重；細部設定集中在下方 MACHINES）
  smith: 0.9, legpress: 2.47, pulldown: 0.6, cablerow: 0.75, pushdown: 0.25, legext: 1.2, legcurl: 0.45, chestpress: 0.9, pecdeck: 0.6, cablefly: 0.24 };

// ---------- 器械規格與參數設定 ----------
// 每個數值均標註 docs/research/machine-data.md 出處或「假設」（未查得單一原廠／論文實測值）
export const MACHINES = {
  smith: {
    railDegDefault: '0',             // docs/research/machine-data.md §2.1：Hammer Strength HSSMV 垂直軌道
    railDegOptions: [
      ['0', '0°（垂直軌道）'],       // docs/research/machine-data.md §2.1：Hammer Strength HSSMV 官方規格
      ['7', '7°（往上微後傾）'],     // docs/research/machine-data.md §2.1：Hammer Strength Smith Machine（Life Fitness 官方規格 7°）
      ['-7', '-7°（反向站位）'],     // docs/research/machine-data.md §2.2：背向／面向使用時斜軌方向相反
    ],
    railZ0: 0,                       // 假設：滑軌於參考高度處之 Z 座標（m）
    railRefY: 1.4,                   // 假設：斜軌參考高度（約站姿扛槓高度，使「腳在槓前方」定義一致）
    railMu: 0,                       // 假設：忽略線性軸承滑軌摩擦
    startingKg: 13.6,                // docs/research/machine-data.md §2.1：HSSMV 官方起始阻力 13.6 kg
    platesRatio: (0.9 * DEFAULT_BODY.mass - 13.6) / DEFAULT_BODY.mass, // 假設：掛片按體重縮放；75 kg 身材總示範阻力維持 67.5 kg
    railHalfSpan: 0.7,               // 假設：左右滑軌半寬（m）
    railHeight: 2.2,                 // 假設：機架高度（m）
  },
  legpress: {
    railDeg: 45,                     // docs/research/machine-data.md §1.1：Titanium Strength GS-45LP 原廠 45° 軌道
    sledKgDefault: 50,               // docs/research/machine-data.md §1.1：GS-45LP 原廠空滑台實體質量 50 kg
    sledKgRange: [20, 65],           // 假設：輕型至重型商用滑台重量範圍（kg）
    platesRatio: 1.8,                // 假設：示範掛片重＝1.8× 體重（135 kg，加已查證 50 kg 滑台 ＝ 總重 185 kg）
    railMuDefault: 0,                // 預設 0（準靜態參考，見 docs/research/machine-data.md §1.2）；設定 μ 時代表向心上限 sinθ + μcosθ，離心為 sinθ − μcosθ（0.05–0.15 為假設範圍）
    railMuRange: [0, 0.15],          // 假設：docs/research/machine-data.md §1.1
    seatDegDefault: 50,              // 假設：docs/research/machine-data.md §1.1 椅背離垂直估計 45°–65°
    seatDegRange: [35, 65],          // 假設：docs/research/machine-data.md §1.1
    hipY: 0.42,                      // 假設：座椅骨盆高度（m）
  },
  pulldown: {
    pulleyRatioDefault: '1:1',       // docs/research/machine-data.md §3.1：專用滑輪下拉機 1:1（Hammer Strength / Life Fitness / Technogym 商用規格）
    stackKg: 45,                     // 假設：示範配重片＝45 kg（1:1 實感 45 kg ≈ 0.6× 體重；2:1 實感 22.5 kg）
    pulleyY: 2.35,                   // docs/research/machine-data.md §3.1：商用機總高 216–244 cm（Hammer Strength HDU-DPR 244 cm / HS-PD 226 cm / Technogym 228 cm）
    towerZ: 0.8,                     // 假設：配重塔距骨盆水平距離（m）
    seatY: 0.47,                     // 假設：座墊高度（m）
    barLen: 1.25,                    // 假設：下拉長桿寬度（m）
  },
  cablerow: {
    pulleyRatioDefault: '1:1',       // docs/research/machine-data.md §3.1：專用坐姿低拉划船機 1:1（Life Fitness PWR Play / Optima / Axiom / Technogym 規格）
    stackKg: 56,                     // 假設：示範配重片＝56 kg（1:1 實感 56 kg ≈ 0.75× 體重；2:1 實感 28 kg）
    pulleyY: 0.42,                   // docs/research/machine-data.md §3.1：低滑輪出繩口典型估算 35–45 cm（與坐墊同高或略低）
    pulleyZ: 1.0,                    // 假設：低滑輪距骨盆水平距離（m）
    seatY: 0.47,                     // 假設：座墊高度（m）
    barLen: { v: 0.2, wide: 0.75 },  // 假設：V 把與寬握桿寬度（m）
  },
  pushdown: {
    pulleyRatioDefault: '2:1',       // docs/research/machine-data.md §3.1：多功能可調滑輪柱／大飛鳥主流為 2:1（Life Fitness PWR Play 規格表）
    stackKg: 38,                     // 假設：示範配重片＝38 kg（2:1 實感 19 kg ≈ 0.25× 體重；1:1 實感 38 kg）
    pulleyY: 1.92,                   // docs/research/machine-data.md §3.1：LCM-CC 可調滑車 17.8–193.0 cm，預設高檔 192 cm
    pulleyZ: 0.58,                   // 假設：站位距滑輪水平距離（m）
    barLen: 0.45,                    // 假設：短直桿寬度（m）
  },
  legext: {
    barRatio: 1.2,                   // 假設：示範配重片＝1.2× 體重
    camArmM: 0.3,                    // 假設：等效凸輪基準力臂（m）
    camDefault: 'comm_desc',         // docs/research/machine-data.md §4.3(A)：商用凸輪微降型（端點比例依 Folland & Morris 2008 極值，中間點為插值假設）
    seatY: 0.55,                     // 假設：座椅骨盆高度（m）
    backReclineDeg: 15,              // 假設：椅背後傾角（°）
    padOffset: 0.05,                 // 假設：小腿滾輪墊接觸偏移（m）
    // 膝屈角度（°；0°=完全伸直）→ 相對阻力力矩表（線性內插）
    cams: {
      // 中段點依 Marginson & Eston (2001, PMID 11695509；等長測量) 與 Knapik (1983, PMID 6856681)、Folland & Morris (2008, PMID 17885926)；0° 與 115° 為外插
      human: [[0, 0.25], [20, 0.35], [40, 0.64], [60, 0.94], [80, 1.0], [90, 0.88], [100, 0.71], [115, 0.58]],
      // 端點比例依 Folland & Morris (2008, PMID 17885926) 8 台商用腿伸機極值（100°→80° +22.2%、60°→20° +37.6%），中間點與 0°／115° 為插值／外插假設
      comm_asc: [[0, 1.25], [20, 1.204], [40, 1.04], [60, 0.875], [80, 0.7943], [100, 0.65], [115, 0.6]],
      // 端點比例依 Folland & Morris (2008, PMID 17885926) 8 台商用腿伸機極值（100°→80° +2.5%、60°→20° −20.5%），中間點與 0°／115° 為插值／外插假設
      comm_desc: [[0, 0.71], [20, 0.795], [40, 0.9], [60, 1.0], [80, 0.984], [100, 0.96], [115, 0.93]],
      // 假設／等力矩基準：全程常數 0.90（貼近 Folland & Morris 2008 所述商用偏平坦平均）
      flat: [[0, 0.9], [115, 0.9]],
      // 無凸輪（槓桿＋配重）：依小腿水平分量物理計算，不用查表
      gravity: null,
    },
  },
  legcurl: {
    barRatio: 0.45,                  // 假設：示範配重片＝0.45× 體重
    camArmM: 0.3,                    // 假設：等效凸輪基準力臂（m）
    camDefault: 'human',             // docs/research/machine-data.md §4.2：人體膝屈遞減曲線
    seatedHipY: 0.55,                // 假設：坐姿骨盆高度（m）
    seatedBackReclineDeg: 15,        // 假設：坐姿椅背後傾角（°）
    lyingHipY: 0.62,                 // 假設：俯臥骨盆高度（m）
    padOffset: 0.05,                 // 假設：小腿滾輪墊接觸偏移（m）
    // 膝屈角度（°；0°=完全伸直）→ 相對阻力力矩表（線性內插）
    cams: {
      // 趨勢與範圍依 Kulig (1984, PMID 6376139)、Knapik (1983, PMID 6856681)、Onishi (2002, PMID 12223173)、Beyer (2019, PMID 31681497)，逐點為取中值
      // 已知限制：文獻指出膝屈曲線依坐姿／俯臥（髖角）而異，目前兩種姿勢共用同一表
      human: [[0, 0.95], [15, 1.0], [30, 1.0], [45, 0.85], [60, 0.73], [75, 0.62], [90, 0.55], [115, 0.45]],
      // 示意用上升型凸輪（假設，非實測；Folland & Morris 2008 只量腿伸機，未量腿彎舉）
      comm_asc: [[0, 0.65], [30, 0.75], [60, 0.92], [90, 1.12], [115, 1.2]],
      // 假設／等力矩基準：全程常數 0.90
      flat: [[0, 0.9], [115, 0.9]],
      // 無凸輪（槓桿＋配重）：依小腿水平分量物理計算
      gravity: null,
    },
  },
  chestpress: {
    barRatio: 0.9,                   // 假設：示範配重＝0.9× 體重
    pathDefault: 'linear',           // docs/research/machine-data.md §5.1：固定直線軌跡胸推機
    convergeRatio: 0.72,             // 假設：內聚弧線推直時手距縮為起始寬度 72%（對應 §5.1 Hammer Strength / Life Fitness 內聚概念）
    seatY: 0.55,                     // 假設：座墊骨盆高度（m）
    backFrontZ: -0.085,              // 假設：椅背前緣止擋（肩關節後方 8.5 cm）
    pivotY: 1.72,                    // 假設：上方轉軸高度（m）
    pivotZ: -0.18,                   // 假設：上方轉軸前後位置（m）
    colZ: -0.36,                     // 假設：後方立柱前後位置（m）
  },
  pecdeck: {
    styleDefault: 'handle',          // 假設：預設握把式（手臂微彎）；可切換前臂墊式（屈肘 90°）
    loadDefault: 45,                 // 假設：示範配重片＝45 kg（0.6× 體重，1:1 凸輪傳動）
    loadRange: [20, 80],             // 假設：配重範圍（kg）
    camArmM: 0.22,                   // 假設：等效凸輪基準力臂（m；單臂阻力力矩 = camArmM × 配重/2 × 凸輪係數）
    seatY0: 0.55,                    // 假設：預設座墊骨盆高度（m）
    pivX: 0.18,                      // 假設：垂直轉軸左右偏移（m，位於肩關節正上方附近）
    pivY: 1.76,                      // 假設：上方垂直轉軸高度（m）
    pivZ: -0.02,                     // 假設：垂直轉軸前後位置（m）
    handleR: 0.54,                   // 假設：握把式機械臂水平半徑（m）
    padR: 0.29,                      // 假設：前臂墊式機械臂水平半徑（m）
    colZ: -0.36,                     // 假設：後方配重塔前後位置（m）
    // 假設：商用蝴蝶機典型溫和鐘型凸輪（機械臂角度 °，0°=正前、90°=正側 → 相對力矩係數；未查得單一原廠實測凸輪表）
    camTable: [[-20, 0.85], [15, 0.96], [45, 1.0], [80, 0.94], [110, 0.84]],
  },
  cablefly: {
    heightDefault: 'mid',            // 滑輪高度：高位往下／與肩同高／低位往上
    pulleyRatioDefault: '2:1',       // docs/research/machine-data.md §3.1：多功能滑輪柱／大飛鳥主流為 2:1（Life Fitness PWR Play 規格）
    dualStack: true,                 // 雙側獨立配重塔，每手一條鋼索
    stackKg: 18,                     // 假設：單側示範配重片＝18 kg（2:1 實感單手 9 kg；1:1 實感單手 18 kg）
    pulleyX: 1.30,                   // 假設：左右滑輪柱半寬（m，總寬 2.60 m，對應商用大飛鳥門框寬度）
    pulleyZ: -0.10,                  // 假設：滑輪柱位於雙腳站位後方 10 cm（人站在大飛鳥門框略前方）
    // docs/research/machine-data.md §3.1：Life Fitness 可調滑輪柱滑車高度範圍 17.8–193.0 cm、機架頂高約 210–240 cm
    pulleyY: { high: 1.92, mid: 1.34, low: 0.85 },
    towerH: 2.39,                    // docs/research/machine-data.md §3.1：Life Fitness LCM-CC 機架總高 239 cm
  },
  reversedeck: { seatY: 0.55, handleR: 0.52, pivotX: 0.18, pivotZ: 0.02, pivotY: 1.76, camArm: 0.22, loadKg: 40, chestZ: 0.13 }, // 假設：反向蝴蝶機尺寸與 1:1 配重
  backext: { hipY: 0.92, thighPadZ: -0.16, ankleZ: -0.50, loadKg: 10, padMu: 0.5 }, // 假設：45° 羅馬椅及胸前槓片
  hacksquat: { railDeg: 45, railHalfSpan: 0.49, railHeight: 1.85, plateDeg: 12, loadKg: 80 }, // 假設：滑台與掛片總有效質量
  machinepress: { seatY: 0.55, pivotY: 1.83, pivotZ: -0.16, loadKg: 40 }, // 假設：肩推機握把與轉軸
  calfraise: { stepY: 0.13, standingKg: 60, seatedKg: 45, padY: 0.64 }, // 假設：前腳掌台階與肩／膝墊配重
  hipabd: { seatY: 0.55, camArm: 0.22, padArm: 0.35, loadKg: 35 }, // 假設：髖外展／內收機槓桿
  // REP Hex KG 握把尺寸已查證；片頭尺寸與預設每顆重量仍為示範估計。
  dumbbell: {
    handleLen: 0.132,                // docs/research/machine-data.md §8：REP Hex KG 握把長 5.2" ≈ 13.2 cm
    handleR: 0.017,                  // docs/research/machine-data.md §8：REP Hex KG 7.5–22.5 kg 握把直徑 34 mm
    benchKg: 22,                     // 假設：啞鈴臥推預設每顆 22 kg（雙手 44 kg，略輕於槓鈴臥推 60 kg）
    pressKg: 14,                     // 假設：坐姿啞鈴肩推預設每顆 14 kg（雙手 28 kg，略輕於站姿槓鈴肩推 37.5 kg）
    latRaiseKg: 8,                   // 假設：側平舉預設每顆 8 kg
    curlKg: 12,                      // 假設：啞鈴彎舉預設每顆 12 kg（雙手 24 kg）
    reverseFlyKg: 6,                 // 假設：俯身反向飛鳥預設每顆 6 kg
    gobletKg: 20,                    // 假設：高腳杯深蹲預設單顆 20 kg
    pressSeatY: 0.50,                // 假設：坐姿肩推椅座高 50 cm
    pressBackReclineDeg: 8,          // 假設：坐姿肩推椅背微後傾 8°（82° 靠背）
  },
};

export const PULLEY_RATIOS = [['1:1', '1:1（直拉）'], ['2:1', '2:1（減半）']];
export const pulleyDivisor = (r) => (r === '2:1' ? 2 : 1);

// 凸輪阻力曲線選項（依 docs/research/machine-data.md §4 資料驅動）
export const CAMS_LEGEXT = [
  ['human', '貼合人體力量曲線（倒 U 型）'],
  ['comm_desc', '商用凸輪：伸直端微降'],
  ['comm_asc', '商用凸輪：伸直端漸增'],
  ['flat', '凸輪：全程平均'],
  ['gravity', '無凸輪（槓桿＋配重）'],
];
export const CAMS_LEGCURL = [
  ['human', '貼合人體力量曲線（拉長端重）'],
  ['comm_asc', '示意用上升型凸輪（假設）'],
  ['flat', '凸輪：全程平均'],
  ['gravity', '無凸輪（槓桿＋配重）'],
];
export const CAMS = CAMS_LEGEXT;


// ---------- 向量 ----------
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerpV = (a, b, t) => add(a, mul(sub(b, a), t));
const lerp = (a, b, t) => a + (b - a) * t;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// 商用器械可調座高／握把位置；數值界線為示範假設，調整機構的出處見 machine-data.md。
const fittedSeatY = (base, offset = 0) => clamp(base + DEFAULT_BODY.Ltr - BODY.Ltr + offset, 0.43, 0.68);
const fittedHandleR = (base) => clamp(base * (BODY.Lu + BODY.Lf) / (DEFAULT_BODY.Lu + DEFAULT_BODY.Lf), 0.42, 0.62);
const neg = (a) => [-a[0], -a[1], -a[2]];

function ik2(root, target, L1, L2, pole) {
  const d = sub(target, root);
  let D = len(d);
  let ok = true;
  const maxD = L1 + L2 - 1e-4, minD = Math.abs(L1 - L2) + 0.05;
  if (D > maxD) { ok = false; D = maxD; }
  if (D < minD) { ok = false; D = minD; }
  const n = norm(d);
  const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let p = sub(pole, mul(n, dot(pole, n)));
  if (len(p) < 1e-6) p = Math.abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0]);
  p = norm(p);
  return { mid: add(root, add(mul(n, a), mul(p, h))), end: add(root, mul(n, D)), ok };
}

// ---------- 動作定義 ----------
// mech：A 改姿勢／軌跡、B 等長用力、C 協同肌偏好
export const LIFTS = {
  pushup: {
    forearmContact: 'fixed',
    name: '伏地挺身', topLabel: '撐起', bottomLabel: '胸口接近地面',
    viewCenter: [0, 0.42, 0], viewScale: 1.55,
    ground: true, dofs: ['shFwd', 'shSide', 'elbExt', 'scRet', 'scElev'],
    pose: pushupPose, loads: bodyweightLoads, reactions: pushupReactions,
    params: [
      { key: 'grip', label: '手距（× 肩寬）', left: '窄', right: '寬', min: 0.8, max: 1.8, step: 0.05, def: 1.2, joint: 'hand', mech: 'A' },
      { key: 'flare', label: '手肘外展角', left: '貼近身體', right: '向兩側', min: 20, max: 80, step: 1, def: 45, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'handFwd', label: '手掌前後位置（相對撐起時肩關節）', left: '肩後方', right: '肩前方', min: -0.15, max: 0.15, step: 0.01, def: -0.06, joint: 'hand', mech: 'A', unit: ' m' },
      { key: 'elevation', label: '墊高位置', type: 'select', options: [['flat', '平地'], ['feet', '腳墊高'], ['hands', '手墊高']], def: 'flat', joint: 'equip', mech: 'A' },
      { key: 'pelvis', label: '骨盆位置', left: '稍下沉', right: '稍上翹', min: -0.04, max: 0.04, step: 0.01, def: 0, joint: 'hip', mech: 'A', unit: ' m' },
      { key: 'load', label: '負重背心', left: '徒手', right: '30 kg', min: 0, max: 30, step: 5, def: 0, joint: 'equip', mech: 'A', unit: ' kg' },
    ],
    standardNote: '掌根壓穩、腳尖著地，軀幹與腿維持一直線，下放到胸口接近地面。',
  },
  dips: {
    forearmContact: 'fixed',
    name: '雙槓撐體', topLabel: '撐起', bottomLabel: '下放',
    viewCenter: [0, 1.0, 0], viewScale: 1.45,
    ground: true, dofs: ['shFwd', 'shSide', 'elbExt', 'scRet', 'scElev'],
    pose: dipsPose, loads: bodyweightLoads, reactions: handSupportReactions,
    params: [
      { key: 'lean', label: '軀幹前傾', left: '直立', right: '前傾', min: 0, max: 30, step: 1, def: 15, joint: 'hip', mech: 'A', unit: '°' },
      { key: 'depth', label: '下放深度', left: '較淺', right: '較深', min: 0, max: 1, step: 0.05, def: 0.6, joint: 'shoulder', mech: 'A' },
      { key: 'load', label: '腰掛負重', left: '徒手', right: '30 kg', min: 0, max: 30, step: 5, def: 0, joint: 'equip', mech: 'A', unit: ' kg' },
    ],
    standardNote: '握住兩側平行槓，腿在身後彎曲，前傾程度決定軀幹姿勢。',
  },
  pullup: {
    forearmContact: 'fixed',
    name: '引體向上', topLabel: '下巴過槓', bottomLabel: '手臂伸直',
    viewCenter: [0, 1.35, 0], viewScale: 1.7,
    ground: true, dofs: ['shFwd', 'shSide', 'elbExt', 'scRet', 'scElev'],
    pose: pullupPose, loads: bodyweightLoads, reactions: handSupportReactions,
    params: [
      { key: 'grip', label: '握法', type: 'select', options: [['pro', '正握'], ['sup', '反握']], def: 'pro', joint: 'hand', mech: 'A' },
      { key: 'width', label: '握距（× 肩寬）', left: '1.0', right: '2.0', min: 1, max: 2, step: 0.05, def: 1.35, joint: 'hand', mech: 'A' },
      { key: 'lean', label: '腿相對軀幹後收', left: '較少', right: '較多', min: 0, max: 20, step: 1, def: 5, joint: 'hip', mech: 'A', unit: '°' },
      { key: 'load', label: '腰掛負重', left: '徒手', right: '25 kg', min: 0, max: 25, step: 5, def: 0, joint: 'equip', mech: 'A', unit: ' kg' },
    ],
    standardNote: '可踩踏台抓住固定單槓，再讓雙腳離台。腿往身後收的設定改變身體形狀；軀幹角度由重心平衡求出（滑桿主要改變腿角，0～20° 只讓軀幹角變約 5°），從近乎伸直的懸垂姿勢拉到下巴過槓。',
  },
  assistpullup: {
    forearmContact: 'fixed',
    name: '輔助引體機', topLabel: '下巴過槓', bottomLabel: '手臂伸直',
    viewCenter: [0, 1.35, 0], viewScale: 1.7,
    ground: true, dofs: ['shFwd', 'shSide', 'elbExt', 'scRet', 'scElev'],
    pose: pullupPose, loads: bodyweightLoads, reactions: handSupportReactions,
    params: [
      { key: 'grip', label: '握法', type: 'select', options: [['pro', '正握'], ['sup', '反握']], def: 'pro', joint: 'hand', mech: 'A' },
      { key: 'width', label: '握距（× 肩寬）', left: '1.0', right: '2.0', min: 1, max: 2, step: 0.05, def: 1.35, joint: 'hand', mech: 'A' },
      { key: 'lean', label: '身體後仰', left: '垂直', right: '後仰', min: 0, max: 20, step: 1, def: 5, joint: 'hip', mech: 'A', unit: '°' },
      { key: 'assist', label: '膝墊輔助', left: '0 kg', right: '60 kg', min: 0, max: 60, step: 5, def: 30, joint: 'equip', mech: 'A', unit: ' kg' },
    ],
    standardNote: '可踩踏台或器械踏階握住固定握把，再把雙膝放上輔助墊；動作中膝墊向上托住部分體重。',
  },
  squat: {
    name: '深蹲', bottomLabel: '最低點',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: squatPose, loads: barOnTrunkLoads,
    params: [
      { key: 'dom', label: '主導', left: '膝主導', right: '髖主導', min: 0, max: 1, step: 0.01, def: 0.30, joint: 'hip', mech: 'A' },
      { key: 'depth', label: '深度', left: '高於平行', right: '全蹲', min: 0, max: 1, step: 0.01, def: 0.55, joint: 'knee', mech: 'A' },
      { key: 'stance', label: '站距', left: '窄', right: '寬', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'ankle', mech: 'A' },
      { key: 'kneePath', label: '膝蓋方向', type: 'select', options: [['forward', '正前方'], ['toes', '跟著腳尖']], def: 'forward', joint: 'knee', mech: 'A' },
      { key: 'heelHeight', label: '鞋跟墊高', left: '0 cm（平底）', right: '4 cm（墊片）', min: 0, max: 4, step: 1, def: 0, joint: 'ankle', mech: 'A', unit: ' cm' },
      { key: 'ankleDfCap', label: '個人踝背屈上限', type: 'select', options: [['off', '不限制（預設）'], ['25', '25°'], ['30', '30°'], ['35', '35°'], ['40', '40°']], def: 'off', joint: 'ankle', mech: 'A' },
      { key: 'barPos', label: '槓位', type: 'select', options: [['high', '高槓'], ['low', '低槓'], ['front', '前槓（前蹲）']], def: 'high', joint: 'bar', mech: 'A' },
      { key: 'kneesOut', label: '膝蓋往外推', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'knee', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefGA', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏內收大肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['addmag']] },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '高槓、站距約與肩同寬、軀幹偏直立、蹲到大腿與地面平行或更低。',
  },
  deadlift: {
    name: '硬舉', bottomLabel: '離地',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFwd'],
    pose: deadliftPose, loads: barInHandsLoads,
    // moving：主要在動的關節（清單上「主要肌群」只看作用在這些關節的肌肉，排除純穩定用的）
    moving: ['hipExt', 'kneeExt', 'trunkExt'],
    params: [
      { key: 'style', label: '站姿', type: 'select', options: [['conv', '傳統'], ['sumo', '相撲']], def: 'conv', joint: 'ankle', mech: 'A' },
      { key: 'start', label: '起始槓高', left: '赤字（站高 10 cm）', right: '墊高 10 cm', min: -10, max: 10, step: 1, def: 0, joint: 'equip', mech: 'A', unit: ' cm' },
      { key: 'barDist', label: '槓離身體', left: '貼腿', right: '離腿 10 cm', min: 0, max: 1, step: 0.01, def: 0, joint: 'bar', mech: 'A' },
      { key: 'pullIn', label: '把槓往身上拉', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'shoulder', mech: 'B' },
      { key: 'kneesOut', label: '膝蓋往外推', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'knee', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '傳統站姿、背部中立、槓貼近身體。',
  },
  rdl: {
    name: '羅馬尼亞硬舉', bottomLabel: '最低點',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFwd'],
    pose: rdlPose, loads: barInHandsLoads,
    moving: ['hipExt', 'kneeExt', 'trunkExt'],
    params: [
      { key: 'depth', label: '下放深度（軀幹前傾）', left: '50°', right: '85°', min: 0, max: 1, step: 0.01, def: 0.55, joint: 'hip', mech: 'A' },
      { key: 'kneeBend', label: '膝彎曲', left: '5°（近直腿）', right: '35°', min: 5, max: 35, step: 1, def: 18, joint: 'knee', mech: 'A', unit: '°' },
      { key: 'barDist', label: '槓離身體', left: '貼腿', right: '離腿 10 cm', min: 0, max: 1, step: 0.01, def: 0, joint: 'bar', mech: 'A' },
      { key: 'pullIn', label: '把槓往身上拉', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'shoulder', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '髖往後推、膝蓋微彎約 15～20° 且角度幾乎不變、槓沿著大腿滑下、背部中立，下放到膝蓋下方。',
  },
  row: {
    forearmContact: 'sharedRigid',
    name: '槓鈴划船', topLabel: '手臂伸直', bottomLabel: '觸身',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev']],
    pose: rowPose, loads: handBarLoads,
    moving: ['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    params: [
      { key: 'torso', label: '軀幹前傾', left: '30°（較直立）', right: '85°（接近水平）', min: 30, max: 85, step: 1, def: 60, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'grip', label: '握距（× 肩峰寬）', left: '1.0', right: '2.0', min: 1, max: 2, step: 0.01, def: 1.3, joint: 'hand', mech: 'A' },
      { key: 'supin', label: '握法', type: 'select', options: [['pro', '正握'], ['sup', '反握']], def: 'pro', joint: 'hand', mech: 'A' },
      { key: 'flare', label: '手肘外開角度', left: '10°（夾緊）', right: '80°（往外）', min: 10, max: 80, step: 1, def: 35, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'pullTo', label: '拉到哪裡', left: '肚臍', right: '下胸', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'bar', mech: 'A' },
      { key: 'scap', label: '頂點肩胛後收', left: '不收', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.7, joint: 'scap', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefLP', label: '肩伸肌偏好', left: '偏背闊肌', right: '偏三角肌後束', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['lat'], ['pdelt']] },
    ],
    standardNote: '軀幹前傾約 45～70°、膝微彎、背部中立，槓從腳掌中段正上方拉到上腹，頂點收肩胛。',
  },
  ohp: {
    forearmContact: 'sharedRigid',
    name: '站姿肩推', topLabel: '鎖死', bottomLabel: '鎖骨',
    viewCenter: [0, 1.12, 0], viewScale: 1.32,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev']],
    pose: ohpPose, loads: handBarLoads,
    moving: ['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    params: [
      { key: 'grip', label: '握距（× 肩峰寬）', left: '1.0', right: '2.0', min: 1, max: 2, step: 0.01, def: 1.3, joint: 'hand', mech: 'A' },
      { key: 'flare', label: '手肘位置', left: '0°（正前方）', right: '90°（往兩側）', min: 0, max: 90, step: 1, def: 30, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'lean', label: '軀幹後仰', left: '0°', right: '20°', min: 0, max: 20, step: 1, def: 5, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'path', label: '鎖死位置', left: '肩膀正上方', right: '頭前方 10 cm', min: 0, max: 1, step: 0.01, def: 0.1, joint: 'bar', mech: 'A' },
      { key: 'shrug', label: '鎖死時聳肩', left: '不聳', right: '完全上提', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'scap', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'lumbar', mech: 'B' },
      { key: 'prefAP', label: '肩屈肌偏好', left: '偏前三角', right: '偏上胸', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['adelt'], ['pecc']] },
    ],
    standardNote: '握距略寬於肩、手肘略在槓前方、臀腿收緊、軀幹微後仰讓槓繞過臉；鎖死時槓在肩膀與腳掌中段正上方、肩胛上提。',
  },
  bench: {
    forearmContact: 'sharedRigid',
    name: '臥推', bottomLabel: '觸胸',
    ground: false, supine: true, dofs: ['shFwd', 'shSide', 'elbExt'],
    pose: benchPose, loads: benchLoads,
    lowerBounds: (P, lb) => { if (P.bend) lb.lat = 0.35 * P.bend; },
    params: [
      { key: 'dom', label: '主導', left: '肩主導', right: '肘主導', min: 0, max: 1, step: 0.01, def: 0.5, joint: 'shoulder', mech: 'A' },
      { key: 'surface', label: '躺在', type: 'select', options: [['bench', '臥推椅'], ['floor', '地板（地板臥推）']], def: 'bench', joint: 'equip', mech: 'A' },
      { key: 'incline', label: '椅背角度', left: '平板 0°', right: '上斜 45°', min: 0, max: 45, step: 1, def: 0, joint: 'equip', mech: 'A', unit: '°' },
      { key: 'grip', label: '握距（× 肩峰寬）', left: '0.8（窄握）', right: '2.0', min: 0.8, max: 2, step: 0.01, def: 1.6, joint: 'hand', mech: 'A' },
      { key: 'flare', label: '手肘外開角度', left: '30°', right: '90°', min: 30, max: 90, step: 1, def: 52, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'flareMode', label: '手肘位置模式', type: 'select', options: [['manual', '手動角度'], ['vertical', '觸胸時前臂近垂直']], def: 'vertical', joint: 'elbow', mech: 'A' },
      { key: 'arch', label: '胸椎拱起／胸骨抬高', left: '0°（原姿勢）', right: '30°', min: 0, max: 30, step: 1, def: 10, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'scap', label: '肩胛後收', left: '前伸', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'shoulder', mech: 'A' },
      { key: 'touch', label: '觸胸點', left: '上胸', right: '下胸', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'bar', mech: 'A' },
      { key: 'bend', label: '把槓折彎', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'B' },
      { key: 'pullApart', label: '把槓往外拉開', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'hand', mech: 'B' },
      { key: 'prefPD', label: '肩水平內收偏好', left: '偏胸', right: '偏前三角', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecs', 'pecc'], ['adelt']] },
      { key: 'prefUL', label: '胸大肌偏好', left: '偏上胸', right: '偏中下胸', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecc'], ['pecs']] },
    ],
    standardNote: '中等拱背、肩胛後收、觸胸點在胸中段偏下、手肘外開約 45～60°、握距中等、完整行程。',
  },
  goodmorning: {
    name: '早安體前屈', bottomLabel: '最低點',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: goodMorningPose, loads: barOnTrunkLoads,
    moving: ['hipExt', 'trunkExt'],
    params: [
      { key: 'depth', label: '前傾深度', left: '45°', right: '90°（水平）', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'hip', mech: 'A' },
      { key: 'kneeBend', label: '膝彎曲', left: '5°（近直腿）', right: '35°', min: 5, max: 35, step: 1, def: 15, joint: 'knee', mech: 'A', unit: '°' },
      { key: 'barPos', label: '槓位', type: 'select', options: [['high', '高槓'], ['low', '低槓']], def: 'high', joint: 'bar', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '槓扛在上背、膝微彎且角度固定、髖往後推、背部中立，前傾到膕繩肌有明顯拉伸（約 60～80°）。',
  },
  curl: {
    forearmContact: 'sharedRigid',
    name: '槓鈴彎舉', topLabel: '頂點', bottomLabel: '手臂伸直',
    viewCenter: [0, 0.88, 0.05], viewScale: 1.1,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev']],
    pose: curlPose, loads: handBarLoads,
    moving: ['elbExt'],
    params: [
      { key: 'supin', label: '握法', type: 'select', options: [['sup', '反握（掌心朝上）'], ['pro', '正握（反手彎舉）']], def: 'sup', joint: 'hand', mech: 'A' },
      { key: 'grip', label: '握距（× 肩峰寬）', left: '0.8', right: '1.6', min: 0.8, max: 1.6, step: 0.01, def: 1.1, joint: 'hand', mech: 'A' },
      { key: 'topFlex', label: '頂點手肘角度', left: '110°', right: '150°', min: 110, max: 150, step: 1, def: 135, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'elbFwd', label: '頂點手肘前移', left: '0°（貼身）', right: '40°', min: 0, max: 40, step: 1, def: 10, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'swing', label: '身體後仰借力', left: '0°', right: '15°', min: 0, max: 15, step: 1, def: 0, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefBB', label: '屈肘肌偏好', left: '偏二頭', right: '偏肱肌／肱橈肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'elbow', mech: 'C', pref: [['bic'], ['brach']] },
    ],
    standardNote: '握距約與肩同寬、反握、上臂貼身幾乎不動、身體不後仰，從手臂伸直彎到前臂接近垂直。',
  },
  shrug: {
    forearmContact: 'sharedRigid',
    name: '槓鈴聳肩', topLabel: '聳到頂', bottomLabel: '放下',
    viewCenter: [0, 0.88, 0], viewScale: 1.1,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev']],
    pose: shrugPose, loads: handBarLoads,
    moving: ['scElev', 'scRet'],
    params: [
      { key: 'grip', label: '握距（× 肩峰寬）', left: '1.0', right: '1.6', min: 1, max: 1.6, step: 0.01, def: 1.15, joint: 'hand', mech: 'A' },
      { key: 'height', label: '聳起高度', left: '小（約 10°）', right: '盡量高（約 30°）', min: 0, max: 1, step: 0.01, def: 0.7, joint: 'scap', mech: 'A' },
      { key: 'ret', label: '頂點肩胛後收', left: '不收', right: '後收', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'scap', mech: 'A' },
      { key: 'lean', label: '軀幹前傾', left: '0°', right: '30°', min: 0, max: 30, step: 1, def: 5, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
    ],
    standardNote: '站直、手臂伸直垂在大腿前、握距略寬於肩，肩膀往耳朵方向直直上提，頂點停一下。',
  },
  uprow: {
    forearmContact: 'sharedRigid',
    name: '直立划船', topLabel: '頂點', bottomLabel: '手臂伸直',
    viewCenter: [0, 0.88, 0], viewScale: 1.1,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', ...['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev']],
    pose: uprowPose, loads: handBarLoads,
    moving: ['shSide', 'scElev', 'elbExt'],
    params: [
      { key: 'grip', label: '握距（× 肩峰寬）', left: '0.6（窄）', right: '1.6（寬）', min: 0.6, max: 1.6, step: 0.01, def: 1.2, joint: 'hand', mech: 'A' },
      { key: 'height', label: '拉到哪裡', left: '下胸', right: '鎖骨', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'bar', mech: 'A' },
      { key: 'lean', label: '軀幹前傾', left: '0°', right: '20°', min: 0, max: 20, step: 1, def: 3, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefDT', label: '上提偏好', left: '偏三角肌中束', right: '偏上斜方', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['mdelt'], ['uptrap']] },
    ],
    standardNote: '握距約與肩同寬或略寬、手肘帶頭往外上方拉，拉到下胸、手肘約與肩同高，不超過肩膀。',
  },
  hipthrust: {
    name: '臀推', topLabel: '頂點', bottomLabel: '最低點',
    viewCenter: [0, 0.4, 0.3], viewScale: 1.05,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: hipThrustPose, loads: barOnPelvisLoads, reactions: twoContactReactions,
    moving: ['hipExt'],
    params: [
      { key: 'surface', label: '上背靠在', type: 'select', options: [['bench', '臥推椅（臀推）'], ['floor', '地板（臀橋）']], def: 'bench', joint: 'equip', mech: 'A' },
      { key: 'kneeTop', label: '頂點膝角度（腳的位置）', left: '60°（腳放遠）', right: '140°（腳放很近）', min: 60, max: 140, step: 1, def: 90, joint: 'knee', mech: 'A', unit: '°' },
      { key: 'depth', label: '下放深度', left: '淺', right: '深', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'hip', mech: 'A' },
      { key: 'lockout', label: '頂點髖伸展', left: '-15°（沒推到底）', right: '+10°（過伸、腰代償）', min: -15, max: 10, step: 1, def: 0, joint: 'hip', mech: 'A', unit: '°' },
      { key: 'push', label: '用力點', left: '腳跟', right: '前腳掌', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'ankle', mech: 'B' },
      { key: 'kneesOut', label: '膝蓋往外推', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'knee', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '椅緣在肩胛骨下角、頂點小腿垂直（膝約 90°）、用腳跟推、頂點軀幹與大腿成一直線（不過伸下背）、下巴微收。',
  },
  smith: {
    name: '史密斯深蹲', bottomLabel: '最低點',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: smithPose, loads: barOnTrunkLoads, reactions: twoContactReactions,
    moving: ['hipExt', 'kneeExt'],
    params: [
      { key: 'railAngle', label: '滑軌角度', type: 'select', options: MACHINES.smith.railDegOptions, def: MACHINES.smith.railDegDefault, joint: 'equip', mech: 'A' },
      { key: 'feetFwd', label: '腳在槓前方', left: '0（同自由深蹲）', right: '30 cm', min: 0, max: 0.3, step: 0.01, def: 0.02, joint: 'ankle', mech: 'A', fmt: 'cm' },
      { key: 'heelHeight', label: '鞋跟墊高', left: '0 cm（平底）', right: '4 cm（墊片）', min: 0, max: 4, step: 1, def: 0, joint: 'ankle', mech: 'A', unit: ' cm' },
      { key: 'depth', label: '深度', left: '高於平行', right: '全蹲', min: 0, max: 1, step: 0.01, def: 0.55, joint: 'knee', mech: 'A' },
      { key: 'torso', label: '最低點軀幹前傾', left: '0°（直立）', right: '45°', min: 0, max: 45, step: 1, def: 26, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'push', label: '用力點', left: '腳跟', right: '前腳掌', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'ankle', mech: 'B' },
      { key: 'kneesOut', label: '膝蓋往外推', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'knee', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '腳放在槓前方約 2 cm、最低點軀幹前傾約 26°，讓滑軌的水平支撐力接近零；蹲到大腿約平行。傾斜 7° 款（如 Hammer Strength）面向斜軌站立時起立軌跡微向後。',
  },
  legpress: {
    name: '45° 腿推機', topLabel: '腿伸直', bottomLabel: '最低點',
    viewCenter: [0, 0.78, 0.25], viewScale: 1.18,
    seated: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF'],
    pose: legPressPose, loads: pushLoads,
    moving: ['hipExt', 'kneeExt'],
    params: [
      { key: 'footHigh', label: '腳踩踏板的位置', left: '低（偏股四頭）', right: '高（偏臀／膕繩）', min: 0, max: 1, step: 0.01, def: 0.52, joint: 'ankle', mech: 'A' },
      { key: 'stance', label: '站距', left: '窄', right: '寬', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'ankle', mech: 'A' },
      { key: 'depth', label: '下放深度（最低點膝角度）', left: '75°', right: '125°', min: 0, max: 1, step: 0.01, def: 0.25, joint: 'knee', mech: 'A' },
      { key: 'seat', label: '椅背角度（離垂直）', left: '35°（較直立）', right: '65°（較躺）', min: MACHINES.legpress.seatDegRange[0], max: MACHINES.legpress.seatDegRange[1], step: 1, def: MACHINES.legpress.seatDegDefault, joint: 'equip', mech: 'A', unit: '°' },
      { key: 'sledKg', label: '空滑台重量', left: '20 kg（示例）', right: '65 kg（示例）', min: MACHINES.legpress.sledKgRange[0], max: MACHINES.legpress.sledKgRange[1], step: 1, def: MACHINES.legpress.sledKgDefault, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'friction', label: '導軌摩擦 μ（假設・向心上限）', left: '0（準靜態參考）', right: '0.15', min: MACHINES.legpress.railMuRange[0], max: MACHINES.legpress.railMuRange[1], step: 0.01, def: MACHINES.legpress.railMuDefault, joint: 'equip', mech: 'A', fmt: 'dec2' },
      { key: 'push', label: '用力點', left: '腳跟', right: '前腳掌', min: 0, max: 1, step: 0.01, def: 0.35, joint: 'ankle', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '45° 軌道、腳踩踏板中間略偏高、與髖同寬，下放到膝約 88°；按個人活動度調整深度，臀部不離開椅墊，用整個腳掌推。',
  },
  pulldown: {
    forearmContact: 'sharedRigid',
    name: '滑輪下拉', topLabel: '手臂伸直', bottomLabel: '拉到胸前',
    viewCenter: [0, 1.1, 0.1], viewScale: 1.15,
    seated: true, dofs: ['trunkExt', 'shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    pose: pulldownPose, loads: cableLoads,
    moving: ['shFwd', 'shSide', 'elbExt', 'scRet', 'scElev'],
    params: [
      { key: 'pulleyRatio', label: '滑輪比（配重：實感）', type: 'select', options: PULLEY_RATIOS, def: MACHINES.pulldown.pulleyRatioDefault, joint: 'equip', mech: 'A' },
      { key: 'grip', label: '握距（× 肩峰寬）', left: '1.0', right: '2.2', min: 1, max: 2.2, step: 0.01, def: 1.7, joint: 'hand', mech: 'A' },
      { key: 'supin', label: '握法', type: 'select', options: [['pro', '正握'], ['sup', '反握']], def: 'pro', joint: 'hand', mech: 'A' },
      { key: 'lean', label: '軀幹後仰', left: '0°', right: '40°', min: 0, max: 40, step: 1, def: 15, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'pullTo', label: '拉到哪裡', left: '下巴', right: '上胸', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'bar', mech: 'A' },
      { key: 'scap', label: '底部肩胛下壓後收', left: '不動', right: '完全下壓後收', min: 0, max: 1, step: 0.01, def: 0.7, joint: 'scap', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefLB', label: '拉的偏好', left: '偏背闊肌', right: '偏手臂（二頭／肱肌）', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['lat'], ['bic', 'brach']] },
    ],
    standardNote: '握距約 1.5～1.8 倍肩寬、軀幹微後仰 10～20°、拉到上胸，底部肩胛下壓後收，頂點讓肩胛上提伸展；專用下拉機多為 1:1 滑輪比。',
  },
  cablerow: {
    forearmContact: 'sharedRigid',
    name: '坐姿滑輪划船', topLabel: '手臂伸直', bottomLabel: '觸身',
    viewCenter: [0, 0.75, 0.35], viewScale: 1.1,
    seated: true, dofs: ['trunkExt', 'shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    pose: cableRowPose, loads: cableLoads,
    moving: ['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    params: [
      { key: 'pulleyRatio', label: '滑輪比（配重：實感）', type: 'select', options: PULLEY_RATIOS, def: MACHINES.cablerow.pulleyRatioDefault, joint: 'equip', mech: 'A' },
      { key: 'grip', label: '握把', type: 'select', options: [['v', 'V 把（窄、對握）'], ['wide', '寬握桿（正握）']], def: 'v', joint: 'hand', mech: 'A' },
      { key: 'leanStart', label: '起點軀幹前傾', left: '0°', right: '40°', min: 0, max: 40, step: 1, def: 15, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'leanEnd', label: '終點軀幹角度', left: '後仰 25°', right: '前傾 10°', min: -25, max: 10, step: 1, def: -5, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'pullTo', label: '拉到哪裡', left: '肚臍', right: '下胸', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'bar', mech: 'A' },
      { key: 'scap', label: '終點肩胛後收', left: '不收', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'scap', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefLP', label: '肩伸肌偏好', left: '偏背闊肌', right: '偏三角肌後束', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['lat'], ['pdelt']] },
    ],
    standardNote: '膝微彎、腳踩穩，起點肩胛前伸、軀幹微前傾，拉到肚臍上方、肩胛後收，軀幹回到直立或微後仰，不用身體甩；專用低拉機多為 1:1 滑輪比。',
  },
  pushdown: {
    forearmContact: 'sharedRigid',
    name: '滑輪三頭下壓', topLabel: '伸直', bottomLabel: '手肘彎曲',
    viewCenter: [0, 0.92, 0.18], viewScale: 1.15,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    pose: pushdownPose, loads: cableLoads,
    moving: ['elbExt'],
    params: [
      { key: 'footStance', label: '站姿', type: 'select', options: [['parallel', '雙腳併站'], ['staggered', '前後腳']], def: 'staggered', joint: 'ankle', mech: 'A' },
      { key: 'pulleyRatio', label: '滑輪比（配重：實感）', type: 'select', options: PULLEY_RATIOS, def: MACHINES.pushdown.pulleyRatioDefault, joint: 'equip', mech: 'A' },
      { key: 'topFlex', label: '起點手肘角度', left: '80°', right: '130°', min: 80, max: 130, step: 1, def: 100, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'elbFwd', label: '手肘位置', left: '-10°（往後）', right: '30°（往前）', min: -10, max: 30, step: 1, def: 5, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'lean', label: '軀幹前傾', left: '0°', right: '30°', min: 0, max: 30, step: 1, def: 10, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefTri', label: '三頭偏好', left: '偏外側／內側頭', right: '偏長頭', min: -1, max: 1, step: 0.01, def: 0, joint: 'elbow', mech: 'C', pref: [['trilat'], ['trilong']] },
    ],
    standardNote: '站在滑輪前、前後腳微錯開、軀幹微前傾，上臂貼身不動，從手肘約 90～100° 壓到完全伸直；多功能滑輪柱多為 2:1 滑輪比（實感為配重片一半）。',
  },
  legext: {
    name: '腿伸機', topLabel: '伸直', bottomLabel: '彎曲',
    viewCenter: [0, 0.55, 0.3], viewScale: 0.95,
    seated: true, dofs: ['kneeExt'], optDofs: ['hipExt', 'ankPF'],
    pose: legExtPose, loads: padLoads,
    moving: ['kneeExt'],
    params: [
      { key: 'cam', label: '阻力曲線（角度內插）', type: 'select', options: CAMS_LEGEXT, def: MACHINES.legext.camDefault, joint: 'equip', mech: 'A' },
      { key: 'depth', label: '起點彎曲角度', left: '70°', right: '115°', min: 0, max: 1, step: 0.01, def: 0.45, joint: 'knee', mech: 'A' },
      { key: 'padPos', label: '墊子位置', left: '小腿中段', right: '腳踝上方', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'equip', mech: 'A' },
    ],
    standardNote: '膝關節對準機器轉軸、墊子在腳踝上方，從約 90° 伸到接近伸直；商用凸輪多偏平緩，伸直端相對人體能力較吃力。',
  },
  legcurl: {
    name: '腿彎舉機', topLabel: '彎到底', bottomLabel: '伸直',
    viewCenter: [0, 0.55, 0.2], viewScale: 1.0,
    seated: true, dofs: ['kneeExt'], optDofs: ['hipExt', 'ankPF'],
    pose: legCurlPose, loads: padLoads,
    moving: ['kneeExt'],
    params: [
      { key: 'posture', label: '姿勢', type: 'select', options: [['seated', '坐姿'], ['lying', '俯臥']], def: 'seated', joint: 'hip', mech: 'A' },
      { key: 'cam', label: '阻力曲線（角度內插）', type: 'select', options: CAMS_LEGCURL, def: MACHINES.legcurl.camDefault, joint: 'equip', mech: 'A' },
      { key: 'depth', label: '頂點彎曲角度', left: '70°', right: '115°', min: 0, max: 1, step: 0.01, def: 0.5, joint: 'knee', mech: 'A' },
      { key: 'padPos', label: '墊子位置', left: '小腿中段', right: '腳踝上方', min: 0, max: 1, step: 0.01, def: 0.8, joint: 'equip', mech: 'A' },
    ],
    standardNote: '膝關節對準機器轉軸、墊子在跟腱上方；坐姿時髖屈曲讓膕繩肌處於拉長位置，俯臥時較短；人體膝屈力量呈遞減曲線（拉長端較強）。',
  },
  chestpress: {
    forearmContact: 'fixed',
    name: '坐姿胸推機', topLabel: '推直', bottomLabel: '最靠近胸口',
    viewCenter: [0, 1.0, 0.2], viewScale: 1.0,
    seated: true, dofs: ['shFwd', 'shSide', 'elbExt'],
    pose: chestPressPose, loads: pushLoads,
    moving: ['shFwd', 'shSide', 'elbExt'],
    params: [
      { key: 'path', label: '握把軌跡', type: 'select', options: [['linear', '直線軌跡'], ['converging', '內聚弧線（頂點收攏）']], def: MACHINES.chestpress.pathDefault, joint: 'equip', mech: 'A' },
      { key: 'grip', label: '握把寬度（× 肩峰寬）', left: '0.8', right: '2.0', min: 0.8, max: 2, step: 0.01, def: 1.5, joint: 'hand', mech: 'A' },
      { key: 'flare', label: '手肘外開角度', left: '30°', right: '90°', min: 30, max: 90, step: 1, def: 55, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'flareMode', label: '手肘位置模式', type: 'select', options: [['manual', '手動角度'], ['vertical', '觸胸時前臂近垂直']], def: 'vertical', joint: 'elbow', mech: 'A' },
      { key: 'touch', label: '握把高度', left: '上胸', right: '下胸', min: 0, max: 1, step: 0.01, def: 0.5, joint: 'bar', mech: 'A' },
      { key: 'scap', label: '肩胛後收', left: '前伸', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.7, joint: 'shoulder', mech: 'A' },
      { key: 'prefPD', label: '肩水平內收偏好', left: '偏胸', right: '偏前三角', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecs', 'pecc'], ['adelt']] },
    ],
    standardNote: '椅子調到握把與胸中段同高、肩胛後收貼椅背、手肘外開約 45～60°，推到手臂接近伸直；內聚弧線推直時雙手向中線收攏。',
  },
  pecdeck: {
    forearmContact: 'fixed',
    name: '蝴蝶機', topLabel: '夾緊', bottomLabel: '外展拉伸',
    viewCenter: [0, 1.05, 0.15], viewScale: 1.08,
    seated: true, dofs: ['shFwd', 'shSide', 'shRot', 'elbExt'],
    pose: pecDeckPose, loads: padLoads,
    moving: ['shFwd', 'shSide', 'shRot'],
    params: [
      { key: 'style', label: '握把型式', type: 'select', options: [['handle', '握把式（手臂微彎）'], ['pad', '前臂墊式（屈肘 90°）']], def: MACHINES.pecdeck.styleDefault, joint: 'equip', mech: 'A' },
      { key: 'stretch', label: '起始外展（拉伸程度）', left: '60°（保守）', right: '105°（深拉伸）', min: 60, max: 105, step: 1, def: 85, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'seat', label: '座椅高度（手臂相對肩）', left: '-10 cm（手臂高於肩）', right: '+10 cm（手臂低於肩）', min: -10, max: 10, step: 1, def: 0, joint: 'equip', mech: 'A', unit: ' cm' },
      { key: 'scap', label: '肩胛後收', left: '前伸', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.7, joint: 'scap', mech: 'A' },
      { key: 'load', label: '配重', left: '20 kg', right: '80 kg', min: MACHINES.pecdeck.loadRange[0], max: MACHINES.pecdeck.loadRange[1], step: 5, def: MACHINES.pecdeck.loadDefault, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefPD', label: '肩水平內收偏好', left: '偏胸', right: '偏前三角', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecs', 'pecc'], ['adelt']] },
      { key: 'prefUL', label: '胸大肌偏好', left: '偏上胸', right: '偏中下胸', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecc'], ['pecs']] },
    ],
    standardNote: '調整座椅讓握把或前臂墊約與胸中段同高、肩胛穩定後收貼椅背；從肩前側有拉伸感處沿圓弧水平內收至胸前交會。',
  },
  reversedeck: {
    forearmContact: 'fixed',
    name: '反向蝴蝶機', topLabel: '手臂向外打開', bottomLabel: '握把在身前',
    viewCenter: [0, 1.05, 0.22], viewScale: 1.13,
    seated: true, dofs: ['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    pose: reverseDeckPose, loads: padLoads, reactions: reverseDeckReactions,
    moving: ['shFwd', 'shSide', 'scRet'],
    params: [
      { key: 'height', label: '握把高度（相對肩）', left: '低 8 cm', right: '高 8 cm', min: -8, max: 8, step: 1, def: 0, joint: 'equip', mech: 'A', unit: ' cm' },
      { key: 'scap', label: '肩胛後收', left: '前伸', right: '後收', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'scap', mech: 'A' },
      { key: 'load', label: '配重', left: '20 kg', right: '65 kg', min: 20, max: 65, step: 5, def: MACHINES.reversedeck.loadKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefRear', label: '後三角與背部偏好', left: '偏後三角', right: '偏肩胛後收肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pdelt'], ['midtrap']] },
    ],
    standardNote: '面向椅背、胸貼墊，手臂微彎，握把從身前向外後方打開；肩胛自然後收。',
  },
  backext: {
    name: '45° 背伸展', topLabel: '軀幹伸直', bottomLabel: '軀幹下放',
    viewCenter: [0, 0.86, 0.15], viewScale: 1.15,
    seated: true, dofs: ['hipExt', 'trunkExt'], optDofs: ['hipAbd', 'kneeExt'],
    pose: backExtPose, loads: backExtLoads, reactions: backExtReactions,
    moving: ['hipExt', 'trunkExt'],
    params: [
      { key: 'padHeight', label: '髖與大腿墊位置（示意）', left: '髖低於墊 6 cm', right: '髖高於墊 6 cm', min: -6, max: 6, step: 1, def: 0, joint: 'equip', mech: 'A', unit: ' cm' },
      { key: 'load', label: '抱胸前槓片', left: '徒手', right: '20 kg', min: 0, max: 20, step: 5, def: MACHINES.backext.loadKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'round', label: '圓背程度（示意）', left: '髖鉸鏈、背平', right: '軀幹較圓', min: 0, max: 1, step: 0.01, def: 0, joint: 'lumbar', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '放鬆', right: '收緊', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
    ],
    standardNote: '大腿前側靠墊、腳踝卡在後墊；從髖部折疊到軀幹與腿約成一直線，不用腰椎猛然過伸。模型以單一剛體表示軀幹：墊高只影響畫面與肌肉長度，不會改變髖與腰背力矩分配；圓背僅改軀幹角度與肌肉長度，無法預測腰椎逐節屈伸的分力。',
  },
  hacksquat: {
    name: '哈克深蹲機', topLabel: '站起', bottomLabel: '最低點',
    viewCenter: [0, 0.9, 0], viewScale: 1.15,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: hackSquatPose, loads: hackSquatLoads, reactions: hackSquatReactions,
    moving: ['hipExt', 'kneeExt'],
    params: [
      { key: 'feetFwd', label: '腳位前後', left: '靠後', right: '靠前 25 cm', min: 0, max: 0.25, step: 0.01, def: 0.10, joint: 'ankle', mech: 'A', fmt: 'cm' },
      { key: 'stance', label: '站距', left: '窄', right: '寬', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'ankle', mech: 'A' },
      { key: 'depth', label: '蹲深', left: '較淺', right: '全蹲', min: 0, max: 1, step: 0.01, def: 0.55, joint: 'knee', mech: 'A' },
      { key: 'load', label: '滑台與掛片總重', left: '40 kg', right: '160 kg', min: 40, max: 160, step: 5, def: MACHINES.hacksquat.loadKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'push', label: '腳掌用力點', left: '腳跟', right: '前腳掌', min: 0, max: 1, step: 0.01, def: 0.4, joint: 'ankle', mech: 'B' },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '背貼滑台、肩抵肩墊，腳踩踏板中段；膝蓋與腳尖同方向，按可控制的深度下蹲。',
  },
  machinepress: {
    forearmContact: 'fixed',
    name: '器械肩推', topLabel: '推起', bottomLabel: '握把下降',
    viewCenter: [0, 1.12, 0.07], viewScale: 1.1,
    seated: true, dofs: ['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    pose: machinePressPose, loads: pushLoads,
    moving: ['shFwd', 'shSide', 'elbExt', 'scElev'],
    params: [
      { key: 'grip', label: '握把', type: 'select', options: [['pronated', '正握'], ['neutral', '中立握']], def: 'pronated', joint: 'hand', mech: 'A' },
      { key: 'seat', label: '座椅高度', left: '低 6 cm', right: '高 6 cm', min: -6, max: 6, step: 1, def: 0, joint: 'equip', mech: 'A', unit: ' cm' },
      { key: 'pathAngle', label: '軌跡向前傾角', left: '垂直', right: '向前 15°', min: 0, max: 15, step: 1, def: 8, joint: 'equip', mech: 'A', unit: '°' },
      { key: 'load', label: '配重', left: '20 kg', right: '70 kg', min: 20, max: 70, step: 5, def: MACHINES.machinepress.loadKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefAD', label: '前三角與三頭偏好', left: '偏前三角', right: '偏三頭', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['adelt'], ['trilat', 'trilong']] },
    ],
    standardNote: '座椅調到握把在耳旁略低，背貼椅背，沿固定軌跡上推但不鎖死手肘。',
  },
  calfraise: {
    name: '提踵', topLabel: '踮起', bottomLabel: '腳跟下放',
    viewCenter: [0, 0.88, 0.32], viewScale: 1.06,
    seated: true, dofs: ['ankPF'], optDofs: ['kneeExt'],
    pose: calfRaisePose, loads: calfRaiseLoads, reactions: calfRaiseReactions,
    moving: ['ankPF'],
    params: [
      { key: 'posture', label: '姿勢', type: 'select', options: [['standing', '站姿肩墊'], ['seated', '坐姿膝墊']], def: 'standing', joint: 'equip', mech: 'A' },
      { key: 'knee', label: '坐姿膝角度', left: '75°', right: '110°', min: 75, max: 110, step: 1, def: 90, joint: 'knee', mech: 'A', unit: '°' },
      { key: 'load', label: '配重', left: '20 kg', right: '90 kg', min: 20, max: 90, step: 5, def: MACHINES.calfraise.standingKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'range', label: '行程', left: '半程', right: '全程', min: 0.5, max: 1, step: 0.01, def: 1, joint: 'ankle', mech: 'A' },
    ],
    standardNote: '前腳掌踩台階、腳跟緩慢下降再踮高；站姿膝微彎，坐姿膝約 90° 且大腿壓墊固定。',
  },
  hipabd: {
    name: '臀外展／內收機', topLabel: '推開／合攏', bottomLabel: '回到起點',
    viewCenter: [0, 0.72, 0.2], viewScale: 1.13,
    seated: true, dofs: ['hipAbd'], optDofs: ['hipExt', 'kneeExt'],
    pose: hipAbdPose, loads: padLoads,
    moving: ['hipAbd'],
    params: [
      { key: 'direction', label: '方向', type: 'select', options: [['abd', '外展'], ['add', '內收']], def: 'abd', joint: 'hip', mech: 'A' },
      { key: 'lean', label: '軀幹前傾', left: '直坐', right: '前傾 25°', min: 0, max: 25, step: 1, def: 0, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'load', label: '配重', left: '20 kg', right: '65 kg', min: 20, max: 65, step: 5, def: MACHINES.hipabd.loadKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefGM', label: '臀中肌與內收肌偏好', left: '偏臀中肌', right: '偏內收肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmed'], ['addmag', 'addl']] },
    ],
    standardNote: '坐穩後用膝側墊慢慢推開或合攏大腿，不用身體甩動機械臂。',
  },
  cablefly: {
    forearmContact: 'singleFree',
    name: '滑輪夾胸', topLabel: '夾緊交會', bottomLabel: '外展拉伸',
    viewCenter: [0, 1.20, 0.05], viewScale: 1.55,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFwd', 'shSide', 'shRot', 'elbExt'],
    pose: cableFlyPose, loads: cableLoads,
    moving: ['shFwd', 'shSide', 'shRot'],
    params: [
      { key: 'footStance', label: '站姿', type: 'select', options: [['parallel', '雙腳併站'], ['staggered', '前後腳']], def: 'staggered', joint: 'ankle', mech: 'A' },
      { key: 'height', label: '滑輪高度', type: 'select', options: [['high', '高位（由上往下）'], ['mid', '中位（與肩同高）'], ['low', '低位（由下往上）']], def: MACHINES.cablefly.heightDefault, joint: 'equip', mech: 'A' },
      { key: 'pulleyRatio', label: '滑輪比（配重：實感）', type: 'select', options: PULLEY_RATIOS, def: MACHINES.cablefly.pulleyRatioDefault, joint: 'equip', mech: 'A' },
      { key: 'stretch', label: '起始外展（拉伸程度）', left: '60°（保守）', right: '100°（深拉伸）', min: 60, max: 100, step: 1, def: 82, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'elbowBend', label: '手肘微彎角度', left: '15°（近直臂）', right: '45°（較彎）', min: 15, max: 45, step: 1, def: 25, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'lean', label: '軀幹前傾', left: '5°', right: '35°', min: 5, max: 35, step: 1, def: 12, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'scap', label: '肩胛後收', left: '前伸', right: '完全後收', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'scap', mech: 'A' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.3, joint: 'lumbar', mech: 'B' },
      { key: 'prefPD', label: '肩水平內收偏好', left: '偏胸', right: '偏前三角', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecs', 'pecc'], ['adelt']] },
      { key: 'prefUL', label: '胸大肌偏好', left: '偏上胸', right: '偏中下胸', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecc'], ['pecs']] },
    ],
    standardNote: '雙手各握獨立把手、手肘固定微彎約 20°～30°、前後腳站穩並微前傾；高位往下偏中下胸、中位均衡水平內收、低位往上偏上胸。前後腳畫面為等效支撐示意，未計算左右腳分力。',
  },
  dbbench: {
    forearmContact: 'singleFree',
    name: '啞鈴臥推', topLabel: '推直', bottomLabel: '下放最低點',
    ground: false, supine: true, dofs: ['shFwd', 'shSide', 'elbExt'],
    pose: dbBenchPose, loads: dumbbellLoads,
    moving: ['shFwd', 'shSide', 'elbExt'],
    params: [
      { key: 'incline', label: '凳面角度', type: 'select', options: [['0', '平板 0°'], ['30', '上斜 30°']], def: '0', joint: 'equip', mech: 'A' },
      { key: 'depth', label: '下放深度', left: '平胸（較淺）', right: '深拉伸', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'shoulder', mech: 'A' },
      { key: 'arch', label: '胸椎拱起／胸骨抬高', left: '0°（原姿勢）', right: '30°', min: 0, max: 30, step: 1, def: 10, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'flare', label: '手肘外展角', left: '30°（較夾）', right: '80°（較開）', min: 30, max: 80, step: 1, def: 50, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'grip', label: '握法', type: 'select', options: [['pro', '正握'], ['neutral', '對握（掌心相對）']], def: 'pro', joint: 'hand', mech: 'A' },
      { key: 'load', label: '每顆重量', left: '8 kg', right: '40 kg', min: 8, max: 40, step: 2, def: MACHINES.dumbbell.benchKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefPD', label: '肩水平內收偏好', left: '偏胸', right: '偏前三角', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecs', 'pecc'], ['adelt']] },
      { key: 'prefUL', label: '胸大肌偏好', left: '偏上胸', right: '偏中下胸', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pecc'], ['pecs']] },
    ],
    standardNote: '雙手各自獨立承重（無剛體槓互推），下放時雙手可比槓鈴略外、略深，推起時向肩膀上方自然微收攏；手肘外展約 45～60°、前臂保持接近垂直。',
  },
  dbpress: {
    forearmContact: 'singleFree',
    name: '坐姿啞鈴肩推', topLabel: '推直', bottomLabel: '最低點',
    viewCenter: [0, 1.12, 0.08], viewScale: 1.12,
    seated: true, dofs: ['shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    pose: dbPressPose, loads: dumbbellLoads,
    moving: ['shFwd', 'shSide', 'elbExt', 'scElev'],
    params: [
      { key: 'grip', label: '握法', type: 'select', options: [['pro', '正握'], ['neutral', '對握（掌心相對）']], def: 'pro', joint: 'hand', mech: 'A' },
      { key: 'elbowFwd', label: '手肘前移角', left: '0°（正兩側）', right: '60°（偏前方）', min: 0, max: 60, step: 1, def: 30, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'depth', label: '下放深度', left: '耳側（較淺）', right: '肩旁（較深）', min: 0, max: 1, step: 0.01, def: 0.6, joint: 'shoulder', mech: 'A' },
      { key: 'load', label: '每顆重量', left: '6 kg', right: '30 kg', min: 6, max: 30, step: 2, def: MACHINES.dumbbell.pressKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefAP', label: '肩屈肌偏好', left: '偏前三角', right: '偏上胸', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['adelt'], ['pecc']] },
    ],
    standardNote: '背貼微後傾椅背（約 82°），手肘置於肩胛平面（略往前約 30°），下放到耳側至肩旁、前臂接近垂直，向上微內聚推至接近伸直。',
  },
  latraise: {
    forearmContact: 'singleFree',
    name: '啞鈴側平舉', topLabel: '舉到頂點', bottomLabel: '雙手垂下',
    viewCenter: [0, 0.95, 0], viewScale: 1.25,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    pose: latRaisePose, loads: dumbbellLoads,
    moving: ['shSide', 'shFwd', 'scElev'],
    params: [
      { key: 'plane', label: '外展平面', type: 'select', options: [['scap', '肩胛平面（前偏 30°）'], ['coronal', '冠狀面（正兩側 0°）']], def: 'scap', joint: 'shoulder', mech: 'A' },
      { key: 'elbowBend', label: '手肘微彎角度', left: '10°（近直臂）', right: '40°（較彎）', min: 10, max: 40, step: 1, def: 20, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'topHeight', label: '上舉高度', left: '70°（低於肩）', right: '105°（高於肩）', min: 70, max: 105, step: 1, def: 90, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'load', label: '每顆重量', left: '2 kg', right: '16 kg', min: 2, max: 16, step: 1, def: MACHINES.dumbbell.latRaiseKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefDM', label: '外展偏好', left: '偏三角肌中束', right: '偏上斜方', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['mdelt'], ['uptrap']] },
    ],
    standardNote: '站直、雙手持啞鈴垂於體側，手肘固定微彎約 15～25°，於肩胛平面（略向前約 30°）或冠狀面平舉至與肩同高（約 90°）。',
  },
  dbcurl: {
    forearmContact: 'singleFree',
    name: '啞鈴彎舉', topLabel: '頂點', bottomLabel: '手臂伸直',
    viewCenter: [0, 0.88, 0.05], viewScale: 1.1,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    pose: dbCurlPose, loads: dumbbellLoads,
    moving: ['elbExt'],
    params: [
      { key: 'grip', label: '握法', type: 'select', options: [['sup', '反握（掌心朝上）'], ['neutral', '錘式（掌心相對）']], def: 'sup', joint: 'hand', mech: 'A' },
      { key: 'elbFwd', label: '上臂前移角度', left: '0°（貼身）', right: '35°（前移）', min: 0, max: 35, step: 1, def: 10, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'load', label: '每顆重量', left: '4 kg', right: '24 kg', min: 4, max: 24, step: 1, def: MACHINES.dumbbell.curlKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefBB', label: '屈肘肌偏好', left: '偏二頭', right: '偏肱肌／肱橈肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'elbow', mech: 'C', pref: [['bic'], ['brach']] },
    ],
    standardNote: '站姿雙手各持啞鈴垂於體側（不需受直槓寬度限制），上臂貼身或頂點微前移，控制下放不借力後仰；握法會改變前臂旋轉力矩平衡。',
  },
  dbreversefly: {
    forearmContact: 'singleFree',
    name: '俯身啞鈴反向飛鳥', topLabel: '展開頂點', bottomLabel: '垂手下方',
    viewCenter: [0, 0.78, 0.05], viewScale: 1.22,
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFwd', 'shSide', 'shRot', 'elbExt', 'scRet', 'scElev'],
    pose: dbReverseFlyPose, loads: dumbbellLoads,
    moving: ['shFwd', 'shSide', 'shRot', 'scRet'],
    params: [
      { key: 'torso', label: '軀幹前傾角', left: '45°（較直立）', right: '75°（接近水平）', min: 45, max: 75, step: 1, def: 65, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'elbowBend', label: '手肘微彎角度', left: '10°（近直臂）', right: '40°（較彎）', min: 10, max: 40, step: 1, def: 20, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'load', label: '每顆重量', left: '2 kg', right: '14 kg', min: 2, max: 14, step: 1, def: MACHINES.dumbbell.reverseFlyKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefRear', label: '後三角與背部偏好', left: '偏後三角', right: '偏肩胛後收肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'shoulder', mech: 'C', pref: [['pdelt'], ['midtrap']] },
    ],
    standardNote: '髖鉸鏈俯身約 45～70°、背部中立、膝微彎，雙手各持啞鈴垂於胸前下方，手肘維持微彎向兩側水平外展至與軀幹近平行。',
  },
  skullcrusher: {
    forearmContact: 'sharedRigid', name: '仰臥三頭伸展', topLabel: '伸直', bottomLabel: '下放額後',
    supine: true, dofs: ['shFwd', 'shSide', 'elbExt'], pose: skullCrusherPose, loads: handBarLoads,
    moving: ['elbExt'],
    params: [
      { key: 'upperTilt', label: '上臂後傾', left: '垂直', right: '向頭後 20°', min: 0, max: 20, step: 1, def: 10, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'bottomFlex', label: '底點屈肘', left: '90°', right: '130°', min: 90, max: 130, step: 1, def: 110, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'load', label: 'EZ 槓總重', left: '10 kg', right: '35 kg', min: 10, max: 35, step: 1, def: 20, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefTri', label: '三頭偏好', left: '偏外／內側頭', right: '偏長頭', min: -1, max: 1, step: 0.01, def: 0, joint: 'elbow', mech: 'C', pref: [['trilat'], ['trilong']] },
    ], standardNote: '平凳仰臥、上臂近垂直並略向頭後；固定上臂，屈肘讓 EZ 槓下放到額後，再伸肘。',
  },
  dboverheadext: {
    forearmContact: 'sharedRigid', name: '坐姿過頭啞鈴三頭伸展', topLabel: '伸直', bottomLabel: '下放頭後',
    seated: true, dofs: ['shFwd', 'elbExt'], optDofs: ['shSide', 'scElev'], pose: dbOverheadExtPose, loads: sharedDumbbellLoads,
    moving: ['elbExt'], params: [
      { key: 'bottomFlex', label: '底點屈肘', left: '85°', right: '125°', min: 85, max: 125, step: 1, def: 105, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'load', label: '單顆啞鈴重量', left: '6 kg', right: '30 kg', min: 6, max: 30, step: 1, def: 14, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefTri', label: '三頭偏好', left: '偏外／內側頭', right: '偏長頭', min: -1, max: 1, step: 0.01, def: 0, joint: 'elbow', mech: 'C', pref: [['trilat'], ['trilong']] },
    ], standardNote: '坐穩靠背、雙手托住同一顆啞鈴，上臂留在耳旁，肘部有控制地屈伸。',
  },
  cableoverheadext: {
    forearmContact: 'sharedRigid', name: '滑輪過頭繩索三頭伸展', topLabel: '伸直', bottomLabel: '屈肘',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFwd', 'shSide', 'elbExt', 'scElev'],
    pose: cableOverheadExtPose, loads: cableLoads, moving: ['elbExt'], params: [
      { key: 'footStance', label: '站姿', type: 'select', options: [['staggered', '前後腳'], ['parallel', '雙腳併站']], def: 'staggered', joint: 'ankle', mech: 'A' },
      { key: 'pulleyRatio', label: '滑輪比（配重：實感）', type: 'select', options: PULLEY_RATIOS, def: '2:1', joint: 'equip', mech: 'A' },
      { key: 'lean', label: '軀幹前傾', left: '5°', right: '25°', min: 5, max: 25, step: 1, def: 15, joint: 'lumbar', mech: 'A', unit: '°' },
      { key: 'bottomFlex', label: '底點屈肘', left: '85°', right: '125°', min: 85, max: 125, step: 1, def: 105, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'load', label: '配重片重量', left: '10 kg', right: '45 kg', min: 10, max: 45, step: 1, def: 25, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
    ], standardNote: '背對低滑輪，前後腳站穩；上臂靠近頭側，握繩由屈肘伸至頭前上方。',
  },
  preachercurl: {
    forearmContact: 'sharedRigid', name: '牧師椅彎舉', topLabel: '彎舉頂點', bottomLabel: '手臂伸展',
    seated: true, dofs: ['shFwd', 'shSide', 'elbExt'], pose: preacherCurlPose, loads: handBarLoads,
    reactions: preacherReactions, moving: ['elbExt'], params: [
      { key: 'padAngle', label: '上臂墊前傾', left: '40°', right: '65°', min: 40, max: 65, step: 1, def: 55, joint: 'equip', mech: 'A', unit: '°' },
      { key: 'topFlex', label: '頂點屈肘', left: '100°', right: '130°', min: 100, max: 130, step: 1, def: 115, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'load', label: 'EZ 槓總重', left: '8 kg', right: '30 kg', min: 8, max: 30, step: 1, def: 16, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefBB', label: '屈肘肌偏好', left: '偏二頭', right: '偏肱肌／肱橈肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'elbow', mech: 'C', pref: [['bic'], ['brach']] },
    ], standardNote: '坐穩讓上臂貼住斜墊，肘在墊上緣附近；由近伸直彎舉 EZ 槓，墊子承受上臂反力。',
  },
  inclinedbcurl: {
    forearmContact: 'singleFree', name: '上斜啞鈴彎舉', topLabel: '彎舉頂點', bottomLabel: '手臂下垂',
    seated: true, dofs: ['shFwd', 'shSide', 'elbExt'], pose: inclineDbCurlPose, loads: dumbbellLoads,
    moving: ['elbExt'], params: [
      { key: 'backAngle', label: '椅背相對地面角度', left: '45°', right: '60°', min: 45, max: 60, step: 1, def: 55, joint: 'equip', mech: 'A', unit: '°' },
      { key: 'topFlex', label: '頂點屈肘', left: '105°', right: '135°', min: 105, max: 135, step: 1, def: 120, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'load', label: '每顆啞鈴重量', left: '4 kg', right: '22 kg', min: 4, max: 22, step: 1, def: 10, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'prefBB', label: '屈肘肌偏好', left: '偏二頭', right: '偏肱肌／肱橈肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'elbow', mech: 'C', pref: [['bic'], ['brach']] },
    ], standardNote: '坐於 45–60° 上斜凳，雙臂自然垂於軀幹後方；保持上臂位置由肘彎舉。',
  },
  dbfrontraise: {
    forearmContact: 'singleFree', name: '啞鈴前平舉', topLabel: '舉到肩高', bottomLabel: '雙手垂下',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt', 'shFwd', 'shSide', 'elbExt', 'scRet', 'scElev'],
    pose: dbFrontRaisePose, loads: dumbbellLoads, moving: ['shFwd', 'scElev'], params: [
      { key: 'topHeight', label: '上舉高度', left: '70°', right: '100°', min: 70, max: 100, step: 1, def: 90, joint: 'shoulder', mech: 'A', unit: '°' },
      { key: 'elbowBend', label: '手肘微彎', left: '10°', right: '35°', min: 10, max: 35, step: 1, def: 20, joint: 'elbow', mech: 'A', unit: '°' },
      { key: 'load', label: '每顆啞鈴重量', left: '2 kg', right: '16 kg', min: 2, max: 16, step: 1, def: 6, joint: 'equip', mech: 'A', unit: ' kg' },
    ], standardNote: '站穩後雙手各持啞鈴，手肘固定微彎，從大腿前平舉到肩高附近。',
  },
  goblet: {
    name: '高腳杯深蹲', topLabel: '頂點', bottomLabel: '最低點',
    ground: true, dofs: ['hipExt', 'hipAbd', 'kneeExt', 'ankPF', 'trunkExt'],
    pose: gobletPose, loads: dumbbellLoads,
    params: [
      // 高腳杯預設採教練選定的 0.25；0.05 可另作較膝主導示範，不是文獻界線。
      { key: 'dom', label: '主導', left: '膝主導', right: '髖主導', min: 0, max: 1, step: 0.01, def: 0.25, joint: 'hip', mech: 'A' },
      { key: 'depth', label: '深度', left: '高於平行', right: '全蹲', min: 0, max: 1, step: 0.01, def: 0.55, joint: 'knee', mech: 'A' },
      { key: 'stance', label: '站距', left: '窄', right: '寬', min: 0, max: 1, step: 0.01, def: 0.35, joint: 'ankle', mech: 'A' },
      { key: 'kneePath', label: '膝蓋方向', type: 'select', options: [['forward', '正前方'], ['toes', '跟著腳尖']], def: 'forward', joint: 'knee', mech: 'A' },
      { key: 'heelHeight', label: '鞋跟墊高', left: '0 cm（平底）', right: '4 cm（墊片）', min: 0, max: 4, step: 1, def: 0, joint: 'ankle', mech: 'A', unit: ' cm' },
      { key: 'ankleDfCap', label: '個人踝背屈上限', type: 'select', options: [['off', '不限制（預設）'], ['25', '25°'], ['30', '30°'], ['35', '35°'], ['40', '40°']], def: 'off', joint: 'ankle', mech: 'A' },
      { key: 'load', label: '啞鈴重量', left: '8 kg', right: '40 kg', min: 8, max: 40, step: 2, def: MACHINES.dumbbell.gobletKg, joint: 'equip', mech: 'A', unit: ' kg' },
      { key: 'kneesOut', label: '膝蓋往外推', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0, joint: 'knee', mech: 'B' },
      { key: 'brace', label: '核心收緊', left: '0%', right: '100%', min: 0, max: 1, step: 0.01, def: 0.2, joint: 'lumbar', mech: 'B' },
      { key: 'prefGA', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏內收大肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['addmag']] },
      { key: 'prefGH', label: '髖伸肌偏好', left: '偏臀大肌', right: '偏膕繩肌', min: -1, max: 1, step: 0.01, def: 0, joint: 'hip', mech: 'C', pref: [['gmax'], ['hams']] },
    ],
    standardNote: '雙手於胸前垂直捧住一顆啞鈴上端、手肘自然下垂靠胸前；前側配重讓軀幹較背蹲直立、膝伸參與比例提高。',
  },
};
// 握住單手自由物體時，前臂軸向力矩由肌肉平衡。固定／雙手共握的剛體可承受未知反力偶；
// 旋轉角仍影響肌肉長度，但此軸不加入肌肉平衡方程。
for (const [name, lift] of Object.entries(LIFTS)) if (lift.dofs.includes('elbExt')) {
  if (lift.forearmContact === 'singleFree') lift.dofs.push('foreRot');
  else if (lift.forearmContact === 'fixed' || lift.forearmContact === 'sharedRigid')
    lift.optDofs = [...(lift.optDofs || []), 'foreRot'];
  else throw new Error(`${name} 缺少前臂接觸型態`);
}
// 自由站姿共用的教練控制量：幾何足底中點為 0，正值往腳尖、負值往腳跟。
const BALANCE_LIFTS = new Set(['rdl', 'goodmorning', 'row', 'ohp', 'curl', 'shrug', 'uprow',
  'latraise', 'dbcurl', 'dbreversefly', 'pushdown', 'cablefly']);
for (const lift of BALANCE_LIFTS) {
  LIFTS[lift].params.unshift({ key: 'balanceCm', label: '重心前後位置', left: '偏腳跟 8 cm',
    right: '偏腳尖 8 cm', min: -8, max: 8, step: 0.5, def: 0, joint: 'ankle', mech: 'A', unit: ' cm' });
}
export const JOINT_NAMES = { equip: '器材', scap: '肩胛', hip: '髖', knee: '膝', ankle: '踝', lumbar: '下背', shoulder: '肩', elbow: '肘', hand: '握距', bar: '槓' };

export function defaultParams(lift) {
  const o = {};
  for (const p of LIFTS[lift].params) o[p.key] = p.def;
  return o;
}

// ---------- 肌肉 ----------
// arms：各自由度的力臂（m），正值 = 產生該方向力矩
// F 含依本模型負重與簡化力臂校正的有效能力；Lf 為來源最佳纖維長。
// Lmt 是現行出力用的位移代理尺度；剛性肌腱估計另列在 FIBER_GEOMETRY。
// 上臂方向用三維旋轉向量的兩個分量表示：向前 shFwd、向外 shSide；長軸旋轉 shRot。
// 在垂臂附近這兩軸仍有定義，不會出現舉臂平面方位的奇異點。
// 先以屈、外展、水平內收三個解剖力矩分量近似肌肉力線，再投影到實際轉軸。
function shoulderAxes(q) {
  const { elev, hadd, sinc, c, s } = shoulderBasis(q);
  return {
    fwd: add(mul(elev, c), mul(hadd, s * sinc)),
    side: add(mul(elev, s), mul(hadd, -c * sinc)),
  };
}
// 正交肩部力矩基底不使用旋轉向量的退化切向軸；長軸沿肩至肘方向。
function shoulderBasis(q) {
  const x = q.shFwd, y = q.shSide, t = Math.hypot(x, y);
  const c = t < 1e-8 ? 1 : x / t, s = t < 1e-8 ? 0 : y / t;
  const ct = Math.cos(t), st = Math.sin(t);
  const sinc = t < 1e-5 ? 1 - (t * t) / 6 : st / t;
  const elev = [-c, 0, s];
  const hadd = [-ct * s, -st, -ct * c];
  const long = [st * s, -ct, st * c];
  return { elev, hadd, long, sinc, c, s };
}
// 在上臂正交基底（上舉軸 e_elev、水平內收軸 e_hadd）定義三維力臂向量：
// - r_elev = f cosφ + a sinφ（矢狀面屈曲 f 與額狀面外展 a 依上舉平面 φ 過渡）
// - r_hadd = h sinθ + max(0, cosθ)(f sinφ - a cosφ)：垂臂（θ=0）時完全不依賴 φ，
//   水平位（θ=90°）為純水平內收 h，舉過頭（θ>90°）不因 cosθ 變號反轉。
function shoulderVec(flex, abd, hadd, q) {
  const f = typeof flex === 'function' ? flex(q) : flex;
  const a = typeof abd === 'function' ? abd(q) : abd;
  const h = typeof hadd === 'function' ? hadd(q) : hadd;
  const t = q.shElev, p = q.shPlane;
  const c = Math.cos(p), s = Math.sin(p), ct = Math.cos(t), st = Math.sin(t);
  const w0 = Math.max(0, ct);
  const rElev = f * c + a * s;
  const rHadd = h * st + w0 * (f * s - a * c);
  return {
    rElev, rHadd,
    vec: add(mul([-c, 0, s], rElev), mul([-ct * s, -st, -ct * c], rHadd)),
  };
}
const shoulderArm = (flex, abd, hadd, axis) => {
  const fn = (q) => {
    const { rElev, rHadd } = shoulderVec(flex, abd, hadd, q);
    const t = q.shElev, p = q.shPlane, c = Math.cos(p), s = Math.sin(p);
    const sinc = t < 1e-5 ? 1 - (t * t) / 6 : Math.sin(t) / t;
    return axis === 'fwd'
      ? c * rElev + s * sinc * rHadd
      : s * rElev - c * sinc * rHadd;
  };
  fn.shoulderVec = (q) => shoulderVec(flex, abd, hadd, q).vec;
  return fn;
};
// MoBL-ARMS 路徑擬合的三維力臂投影到本模型的瞬時轉軸。
const fittedArms = (id) => {
  const vec = (q) => shoulderFitVector(id, q);
  const fwd = (q) => dot(vec(q), shoulderAxes(q).fwd);
  fwd.shoulderVec = vec;
  const side = (q) => dot(vec(q), shoulderAxes(q).side);
  const rot = (q) => {
    const t = q.shElev, p = q.shPlane;
    return dot(vec(q), [Math.sin(t) * Math.sin(p), -Math.cos(t), Math.sin(t) * Math.cos(p)]);
  };
  return { shFwd: fwd, shSide: side, shRot: rot };
};
// 將路徑擬合向量投影到上臂的水平內收軸；沿用既有肩座標的平滑端點映射。
const pathHadd = (id, q) => {
  const t = q.shElev, p = q.shPlane;
  return dot(shoulderFitVector(id, q), [-Math.cos(t) * Math.sin(p), -Math.sin(t), -Math.cos(t) * Math.cos(p)]);
};
const fittedScapArms = (id) => ({
  scElev: (q) => shoulderFitScap(id, 0, q),
  scRet: (q) => shoulderFitScap(id, 1, q),
});
// 髖路徑點直線近似：在 0／45／90° 取 ∂肌腱長／∂髖屈角，二次插值；超出路徑可靠區間則固定端點。
const hipFit = (a, b, c) => (q) => {
  const x = clamp((q.hipFlex || 0) / rad(45), 0, 2);
  return a + (b - a) * x + 0.5 * (c - 2 * b + a) * x * (x - 1);
};
// 膝、踝、肘包覆路徑尚無可執行的 OpenSim 幾何；角度斜率是估計，見 docs/research/muscle-params.md。
const angleSlope = (base, key, per90) => (q) => base + per90 * clamp((q[key] || 0) / rad(90), -0.5, 1.7);
// 三角肌三束共用同一條高上舉（>90°）外展衰減規則；0.65 衰減幅度與 90°→170° 區間皆為無直接出處的估計，見 docs/research/muscle-params.md。
const deltoidScale = (q) => 1 - 0.65 * clamp((q.shElev - rad(90)) / rad(80), 0, 1);
const adeltFlex = (q) => 0.035 + 0.008 * clamp(q.shElev / rad(90), 0, 1);
const adeltAbduction = (q) => (0.006 + 0.020 * clamp(q.shElev / rad(75), 0, 1)) * deltoidScale(q);
const mdeltAbduction = (q) => (0.019 + 0.012 * clamp(q.shElev / rad(60), 0, 1)) * deltoidScale(q);
const pdeltAbduction = (q) => (0.004 + 0.008 * clamp(q.shElev / rad(75), 0, 1)) * deltoidScale(q);
// Ackland et al. 2008 Table 1：胸大肌胸骨中束屈曲力臂遠小於鎖骨束，下束可為伸肌。
// PECM2／3 合群仍須共用一個力臂；下列節點是依原文區域差異的近似，非原文逐角度量測。
const pecSternalFlex = (q) => {
  const flex = q.shFlex;
  if (flex < 0) return 0.003 - 0.05 * clamp(flex / rad(50), -1, 0);
  const angle = clamp(flex / rad(45), 0, 3);
  const arms = [0.003, 0.006, -0.002, -0.005];
  const i = Math.min(Math.floor(angle), arms.length - 2);
  return arms[i] + (arms[i + 1] - arms[i]) * (angle - i);
};
// Ackland et al. 2008：鎖骨束 2.5° 約 9.6 mm，71° 約 53.7 mm；其餘角度線性插值。
const pecClavicularFlex = (q) => {
  const angle = q.shFlex / rad(1);
  if (angle < 0) return 0.0096 + (0.035 - 0.0096) * clamp(-angle / 45, 0, 1);
  if (angle < 70) return 0.0096 + (0.0537 - 0.0096) * angle / 70;
  return 0.0537 - 0.0137 * clamp((angle - 70) / 50, 0, 1);
};
// Ackland 2008 Table 1 胸大肌腹部前舉 2.5° +1.9 mm、98° −9.3 mm；範圍外固定端點。
const pecAbdominalFlex = (q) => {
  const t = clamp(q.shFlex / rad(1), 2.5, 98);
  return 0.0019 + (t - 2.5) * (-0.0093 - 0.0019) / 95.5;
};
// Ackland 2008 Table 1 胸骨中部前舉極值 2.5° +4.4、45° +15.9 mm；120° 後固定端點。
const pecSternalDAS3Flex = (q) => {
  const t = clamp(q.shFlex / rad(1), 2.5, 120);
  return t <= 45 ? 0.0044 + (t - 2.5) * 0.0115 / 42.5 : 0.0159 - (t - 45) * 0.0115 / 75;
};
// Ackland 2008 Table 1 背闊肌前舉上／下束可測 10°–120°，端點外固定避免無依據放大。
const latUpperFlex = (q) => {
  const t = clamp(q.shFlex / rad(1), 10, 120);
  return t <= 45 ? -0.015 - (t - 10) * 0.0071 / 35 : -0.0221 + (t - 45) * 0.022 / 75;
};
const latLowerFlex = (q) => {
  const t = clamp(q.shFlex / rad(1), 10, 120);
  return t <= 53 ? -0.009 - (t - 10) * 0.0018 / 43 : -0.0108 + (t - 53) * 0.0079 / 67;
};
// Ackland 2008 Table 1 小圓肌在前舉由伸肌轉為弱屈肌，外展亦換號；節點間線性近似。
const teresMinorFlex = (q) => {
  const t = clamp(q.shFlex / rad(1), 2.5, 120);
  return -0.0187 + (t - 2.5) * 0.0209 / 117.5;
};
const teresMinorAbd = (q) => {
  const t = clamp(q.shElev / rad(1), 18, 120);
  return -0.0033 + (t - 18) * 0.0084 / 102;
};
export const MUSCLES = [
  // R 三束原始 F=9594 N 對本模型膝伸軸的理論力矩過高；按單側等長膝伸力矩校正有效能力。
  { id: 'vasti', name: '股四頭肌（股廣肌群）', F: 5000, Lf: 0.0986, Lmt: 0.3101, arms: { kneeExt: angleSlope(0.045, 'kneeFlex', 0.005) } },
  { id: 'rf', name: '股直肌', F: 2191.7, Lf: 0.0759, Lmt: 0.5244, arms: { kneeExt: angleSlope(0.04, 'kneeFlex', 0.004), hipExt: -0.035 } },
  { id: 'bflh', group: 'hams', name: '股二頭肌長頭', F: 1313.1836, Lf: 0.0976, Lmt: 0.4228, arms: { hipExt: hipFit(0.0488, 0.0617, 0.0398), kneeExt: angleSlope(-0.03, 'kneeFlex', -0.005) } },
  { id: 'semis', group: 'hams', name: '內側膕繩肌', F: 2792.2820, Lf: 0.0953, Lmt: 0.4216, arms: { hipExt: hipFit(0.0448, 0.0572, 0.0371), kneeExt: angleSlope(-0.03, 'kneeFlex', -0.005) } },
  { id: 'bfsh', group: 'hams', name: '股二頭肌短頭', F: 557.1148, Lf: 0.1103, Lmt: 0.2161, arms: { kneeExt: angleSlope(-0.03, 'kneeFlex', -0.005) } },
  // 臀大肌子部位只拆有來源方向差異的髖外展力臂；髖伸共用原群組繞行估計。
  // 直線弦在深屈髖時穿過骨盆，90° 以後甚至反轉，不能用來分配髖伸力臂。
  { id: 'gmaxUpper', group: 'gmax', name: '臀大肌上部', F: 983.7836, Lf: 0.1470, Lmt: 0.1958, arms: { hipExt: (q) => 0.075 - 0.02 * clamp(q.hipFlex / rad(100), 0, 1.2), hipAbd: 0.0175 } },
  { id: 'gmaxLower', group: 'gmax', name: '臀大肌中下部', F: 2353.8, Lf: 0.1610, Lmt: 0.2296, arms: { hipExt: (q) => 0.075 - 0.02 * clamp(q.hipFlex / rad(100), 0, 1.2), hipAbd: -0.0145 } },
  { id: 'gmedFront', group: 'gmed', name: '臀中肌前部', F: 1093.4668, Lf: 0.0730, Lmt: 0.1288, arms: { hipAbd: 0.0513, hipExt: hipFit(0.0175, 0.0035, -0.0116) } },
  { id: 'gmedBack', group: 'gmed', name: '臀中肌中後部', F: 1636.2909, Lf: 0.0730, Lmt: 0.1276, arms: { hipAbd: 0.0375, hipExt: hipFit(0.0225, 0.0185, 0.0059) } },
  { id: 'addmagIsch', group: 'addmag', name: '內收大肌後部', F: 597.2951, Lf: 0.1562, Lmt: 0.3725, arms: { hipExt: hipFit(0.0389, 0.0611, 0.0464), hipAbd: -0.0357 } },
  { id: 'addmagOther', group: 'addmag', name: '內收大肌其餘部分', F: 1791.8853, Lf: 0.1402, Lmt: 0.1983, arms: { hipExt: hipFit(-0.0004, 0.0252, 0.0328), hipAbd: -0.0546 } },
  { id: 'addl', name: '內收長／短肌', F: 1542.6, Lf: 0.1061, Lmt: 0.1988, arms: { hipAbd: -0.0568, hipExt: hipFit(-0.0410, -0.0233, 0.0148) } },
  { id: 'ilio', name: '髂腰肌', F: 2447.9, Lf: 0.1126, Lmt: 0.2107, arms: { hipExt: hipFit(-0.0217, -0.0347, -0.0370) } },
  { id: 'gas', name: '腓腸肌', F: 4690.6, Lf: 0.0536, Lmt: 0.4447, arms: { ankPF: angleSlope(0.05, 'ankleDorsi', 0.005), kneeExt: angleSlope(-0.02, 'kneeFlex', -0.003) } },
  { id: 'sol', name: '比目魚肌', F: 6194.8, Lf: 0.0440, Lmt: 0.3208, arms: { ankPF: angleSlope(0.05, 'ankleDorsi', 0.005) } },
  { id: 'ta', name: '脛前肌', F: 1227.5, Lf: 0.0683, Lmt: 0.3088, arms: { ankPF: angleSlope(-0.04, 'ankleDorsi', 0.004) } },
  // 軀幹單條代表同側所有伸／屈肌的功能群；依最大等長軀幹力矩校正總能力，非單一肌束的 OpenSim F。
  { id: 'erec', name: '腰背伸肌群', F: 5000, Lf: 0.0808, Lmt: 0.1947, arms: { trunkExt: 0.0465 } },
  { id: 'ra', name: '腹部屈肌群', F: 1250, Lf: 0.2986, Lmt: 0.3796, arms: { trunkExt: -0.0635 } },
  { id: 'pecs', name: '胸大肌（中下胸）', F: 1156.4, Lf: 0.1385, Lmt: 0.2460, arms: { shFwd: shoulderArm(pecSternalFlex, (q) => -0.024 * Math.max(0, Math.cos(q.shElev)), 0.055, 'fwd'), shSide: shoulderArm(pecSternalFlex, (q) => -0.024 * Math.max(0, Math.cos(q.shElev)), 0.055, 'side'), shRot: 0.020, scElev: -0.025 } },
  { id: 'pecc', name: '胸大肌（上胸）', F: 444.3, Lf: 0.1442, Lmt: 0.1470, arms: { shFwd: shoulderArm(pecClavicularFlex, (q) => -0.008 * Math.max(0, Math.cos(q.shElev)) + 0.008 * Math.sin(q.shElev), 0.040, 'fwd'), shSide: shoulderArm(pecClavicularFlex, (q) => -0.008 * Math.max(0, Math.cos(q.shElev)) + 0.008 * Math.sin(q.shElev), 0.040, 'side'), shRot: 0.009 } },
  { id: 'adelt', name: '三角肌前束', F: 1350, Lf: 0.0976, Lmt: 0.1906, arms: { shFwd: shoulderArm(adeltFlex, adeltAbduction, 0.015, 'fwd'), shSide: shoulderArm(adeltFlex, adeltAbduction, 0.015, 'side'), shRot: 0.005 } },
  // 後束 675 N 是以肩水平外展群總力矩校準的有效能力，非 MoBL DELT3 的原始 201.6 N。
  { id: 'pdelt', name: '三角肌後束', F: 675, Lf: 0.1367, Lmt: 0.1747, arms: { shFwd: shoulderArm(angleSlope(-0.025, 'shElev', -0.004), pdeltAbduction, -0.040, 'fwd'), shSide: shoulderArm(angleSlope(-0.025, 'shElev', -0.004), pdeltAbduction, -0.040, 'side'), shRot: -0.006 } },
  // 背闊肌跨過肩胛與肱骨，是肩伸、內收與內旋肌；肩帶下壓另由 scElev 表示。
  { id: 'lat', name: '背闊肌', F: 1500, Lf: 0.2513, Lmt: 0.3986, arms: { shFwd: shoulderArm((q) => -0.05 * clamp((rad(170) - q.shElev) / rad(80), 0.15, 1), (q) => -0.035 * Math.sin(q.shElev) ** 2, (q) => pathHadd('lat', q), 'fwd'), shSide: shoulderArm((q) => -0.05 * clamp((rad(170) - q.shElev) / rad(80), 0.15, 1), (q) => -0.035 * Math.sin(q.shElev) ** 2, (q) => pathHadd('lat', q), 'side'), shRot: 0.020, scElev: -0.030 } },
  { id: 'trilong', name: '肱三頭肌長頭', F: 771.8, Lf: 0.1340, Lmt: 0.2770, arms: { elbExt: angleSlope(0.02, 'elbFlex', 0.008), shFwd: shoulderArm(-0.020, -0.010, 0, 'fwd'), shSide: shoulderArm(-0.020, -0.010, 0, 'side') } },
  { id: 'trilat', name: '肱三頭肌外側／內側頭', F: 1700, Lf: 0.1138, Lmt: 0.2082, arms: { elbExt: angleSlope(0.022, 'elbFlex', 0.006) } },
  // 二頭肌兩頭的肩屈基值分別取 MOBL_ARMS_41.osim 0° 路徑弦長 16.0／21.6 mm；
  // Landin 2008（PMID 17196396，電刺激＋測力儀）測得上舉 ≥60° 肩上提力矩近零，此處 0°→60° 線性歸零且省略肘角相依為估計。
  { id: 'bicLong', group: 'bic', name: '肱二頭肌長頭', F: 525.1, Lf: 0.1157, Lmt: 0.3880, arms: { elbExt: (q) => forearmArm('bicLong', 'elbExt', q), foreRot: (q) => forearmArm('bicLong', 'foreRot', q), shFwd: shoulderArm((q) => 0.0160 * clamp((rad(60) - q.shElev) / rad(60), 0, 1), 0, 0, 'fwd'), shSide: shoulderArm((q) => 0.0160 * clamp((rad(60) - q.shElev) / rad(60), 0, 1), 0, 0, 'side') } },
  { id: 'bicShort', group: 'bic', name: '肱二頭肌短頭', F: 316.8, Lf: 0.1321, Lmt: 0.3244, arms: { elbExt: (q) => forearmArm('bicShort', 'elbExt', q), foreRot: (q) => forearmArm('bicShort', 'foreRot', q), shFwd: shoulderArm((q) => 0.0216 * clamp((rad(60) - q.shElev) / rad(60), 0, 1), 0, 0, 'fwd'), shSide: shoulderArm((q) => 0.0216 * clamp((rad(60) - q.shElev) / rad(60), 0, 1), 0, 0, 'side') } },
  // 肘屈與旋前／旋後力臂取固定版 MoBL-ARMS 路徑點弦的角度表。
  { id: 'brachialis', group: 'brach', name: '肱肌', F: 1177.37, Lf: 0.0858, Lmt: 0.1393, arms: { elbExt: (q) => forearmArm('brachialis', 'elbExt', q) } },
  { id: 'brachioradialis', group: 'brach', name: '肱橈肌', F: 276.0, Lf: 0.1726, Lmt: 0.3056, arms: { elbExt: (q) => forearmArm('brachioradialis', 'elbExt', q), foreRot: (q) => forearmArm('brachioradialis', 'foreRot', q) } },
  { id: 'pronatorTeres', group: 'pronators', name: '旋前圓肌', F: FOREARM_MUSCLE_SOURCE.pronatorTeres.F, Lf: FOREARM_MUSCLE_SOURCE.pronatorTeres.Lf, Lmt: FOREARM_MUSCLE_SOURCE.pronatorTeres.Lf + FOREARM_MUSCLE_SOURCE.pronatorTeres.Lt, arms: { elbExt: (q) => forearmArm('pronatorTeres', 'elbExt', q), foreRot: (q) => forearmArm('pronatorTeres', 'foreRot', q) } },
  { id: 'pronatorQuadratus', group: 'pronators', name: '旋前方肌', F: FOREARM_MUSCLE_SOURCE.pronatorQuadratus.F, Lf: FOREARM_MUSCLE_SOURCE.pronatorQuadratus.Lf, Lmt: FOREARM_MUSCLE_SOURCE.pronatorQuadratus.Lf + FOREARM_MUSCLE_SOURCE.pronatorQuadratus.Lt, arms: { foreRot: (q) => forearmArm('pronatorQuadratus', 'foreRot', q) } },
  { id: 'supinator', name: '旋後肌', F: FOREARM_MUSCLE_SOURCE.supinator.F, Lf: FOREARM_MUSCLE_SOURCE.supinator.Lf, Lmt: FOREARM_MUSCLE_SOURCE.supinator.Lf + FOREARM_MUSCLE_SOURCE.supinator.Lt, arms: { foreRot: (q) => forearmArm('supinator', 'foreRot', q) } },
  { id: 'tmaj', name: '大圓肌', F: 144.0, Lf: 0.1624, Lmt: 0.1824, arms: fittedArms('tmaj') },
  { id: 'corb', name: '喙肱肌', F: 208.2, Lf: 0.0932, Lmt: 0.1902, arms: { shFwd: shoulderArm(0.015, (q) => -0.020 * Math.max(0, Math.cos(q.shElev)), 0.012, 'fwd'), shSide: shoulderArm(0.015, (q) => -0.020 * Math.max(0, Math.cos(q.shElev)), 0.012, 'side') } },
  { id: 'infra', name: '棘下肌／小圓肌', F: 1345.3, Lf: 0.0752, Lmt: 0.1141, arms: { shRot: -0.025 } },
  { id: 'supsp', name: '棘上肌', F: 499.2, Lf: 0.0682, Lmt: 0.1077, arms: fittedArms('supsp') },
  { id: 'subsc', name: '肩胛下肌', F: 1306.9, Lf: 0.0873, Lmt: 0.1203, arms: { shRot: 0.025 } },
  { id: 'mdelt', name: '三角肌中束', F: 1650, Lf: 0.1078, Lmt: 0.2173, arms: { shFwd: shoulderArm(0.004, mdeltAbduction, -0.004, 'fwd'), shSide: shoulderArm(0.004, mdeltAbduction, -0.004, 'side') } },
  // 肩胛：力臂相對胸鎖關節；scRet = 後收、scElev = 上提（含上旋）
  // Seth 路徑的中斜方力臂已算出，但直接接入會破壞划船排名；此處保留既有等效值。
  { id: 'midtrap', name: '斜方肌中束／菱形肌', F: 1000, Lf: 0.12, arms: { scRet: 0.070 } },
  { id: 'uptrap', name: '斜方肌上束', F: 1500, Lf: 0.15, arms: { scElev: 0.07, scRet: 0.02 } },
  { id: 'lowtrap', name: '斜方肌下束', F: 500, Lf: 0.15, arms: { scElev: -0.035, scRet: 0.05 } },
  // 前鋸肌肩帶兩軸用 Seth 三束路徑 F 加權擬合；1000 N 仍是本模型的有效能力估計。
  { id: 'serr', name: '前鋸肌', F: 1000, Lf: 0.15, arms: fittedScapArms('serr') },
];
if (SHOULDER_PARAMETER_SET === 'das3') {
  const byId = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
  const fromDAS3 = (id, base, extra = {}) => ({
    ...base, ...extra, id, F: DAS3_SHOULDER[id].F, Lf: DAS3_SHOULDER[id].Lf,
  });
  const oldPecs = byId.pecs, oldLat = byId.lat, oldTrap = byId.midtrap, oldSerr = byId.serr;
  const latArms = (flex, abdScale) => ({
    shFwd: shoulderArm(flex, (q) => abdScale * -0.035 * Math.sin(q.shElev) ** 2, (q) => pathHadd('lat', q), 'fwd'),
    shSide: shoulderArm(flex, (q) => abdScale * -0.035 * Math.sin(q.shElev) ** 2, (q) => pathHadd('lat', q), 'side'),
    shRot: 0.020, scElev: -0.030,
  });
  const serrArms = (retScale, elevScale) => ({
    scRet: (q) => oldSerr.arms.scRet(q) * retScale,
    scElev: (q) => oldSerr.arms.scElev(q) * elevScale,
  });
  const replacements = {
    pecs: [
      fromDAS3('pecSternal', oldPecs, { group: 'pecs', name: '胸大肌胸骨部', arms: {
        ...oldPecs.arms,
        shFwd: shoulderArm(pecSternalDAS3Flex, (q) => -0.024 * Math.max(0, Math.cos(q.shElev)), 0.055, 'fwd'),
        shSide: shoulderArm(pecSternalDAS3Flex, (q) => -0.024 * Math.max(0, Math.cos(q.shElev)), 0.055, 'side'),
      } }),
      fromDAS3('pecAbdominal', oldPecs, { group: 'pecs', name: '胸大肌腹部', arms: {
        ...oldPecs.arms,
        shFwd: shoulderArm(pecAbdominalFlex, -0.0336, 0.055, 'fwd'),
        shSide: shoulderArm(pecAbdominalFlex, -0.0336, 0.055, 'side'),
      } }),
    ],
    lat: [
      fromDAS3('latUpper', oldLat, { group: 'lat', name: '背闊肌上部', arms: latArms(latUpperFlex, 0.9) }),
      fromDAS3('latLower', oldLat, { group: 'lat', name: '背闊肌下部', arms: latArms(latLowerFlex, 1.2) }),
    ],
    midtrap: [
      fromDAS3('midtrapPart', oldTrap, { group: 'midtrap', name: '斜方肌中束', arms: { scRet: 0.070 } }),
      fromDAS3('rhomboid', oldTrap, { group: 'midtrap', name: '菱形肌', arms: { scRet: 0.037, scElev: -0.010 } }),
      fromDAS3('levscap', oldTrap, { name: '提肩胛肌', arms: { scElev: 0.043, scRet: -0.005 } }),
      fromDAS3('pmin', oldTrap, { name: '胸小肌', arms: { scElev: -0.075, scRet: -0.039 } }),
    ],
    serr: [
      fromDAS3('serrUpper', oldSerr, { group: 'serr', name: '前鋸肌上部', arms: serrArms(0.887, 0.972) }),
      fromDAS3('serrLower', oldSerr, { group: 'serr', name: '前鋸肌下部', arms: serrArms(1.083, 1.018) }),
    ],
    infra: [
      fromDAS3('infraPart', byId.infra, { group: 'infra', name: '棘下肌' }),
      fromDAS3('tmin', byId.infra, { group: 'infra', name: '小圓肌', arms: { shRot: -0.025,
        shFwd: shoulderArm(teresMinorFlex, teresMinorAbd, 0, 'fwd'),
        shSide: shoulderArm(teresMinorFlex, teresMinorAbd, 0, 'side') } }),
    ],
  };
  for (const id of ['pecc', 'adelt', 'mdelt', 'pdelt', 'tmaj', 'corb', 'supsp', 'subsc', 'uptrap', 'lowtrap', 'trilong', 'bicLong', 'bicShort']) {
    replacements[id] = [fromDAS3(id, byId[id])];
  }
  MUSCLES.splice(0, MUSCLES.length, ...MUSCLES.flatMap((m) => replacements[m.id] || [m]));
}
export const MUSCLE_GROUPS = {
  hams: { name: '膕繩肌' }, gmax: { name: '臀大肌' }, gmed: { name: '臀中肌' }, addmag: { name: '內收大肌' },
  bic: { name: '肱二頭肌' }, brach: { name: '肱肌／肱橈肌' }, pronators: { name: '前臂旋前肌' },
  ...(SHOULDER_PARAMETER_SET === 'das3' ? {
    pecs: { name: '胸大肌（中下胸）' }, lat: { name: '背闊肌' }, midtrap: { name: '斜方肌中束／菱形肌' },
    serr: { name: '前鋸肌' }, infra: { name: '棘下肌／小圓肌' },
  } : {}),
};
export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
for (const [id, group] of Object.entries(MUSCLE_GROUPS)) {
  const children = MUSCLES.filter((m) => m.group === id);
  MUSCLE_BY_ID[id] = { id, name: group.name, F: children.reduce((s, m) => s + m.F, 0),
    arms: Object.assign({}, ...children.map((m) => m.arms)) };
}
export const MUSCLE_GROUP_IDS = [...new Set(MUSCLES.map((m) => m.group || m.id))];

// R／U 固定版本 .osim：肌腱鬆弛長 Lt、最佳長度羽狀角 alpha，合群時按來源 F 加權。
// 供剛性肌腱診斷；來源與重算方式見 tools/muscle_params.py。現有姿勢／路徑基準不足以拿它直接算出力。
const FIBER_GEOMETRY = {
  vasti: [0.2114, 0.2678], rf: [0.4485, 0.2170], bflh: [0.3252, 0.1759], semis: [0.3263, 0.2518], bfsh: [0.1058, 0.2642],
  gmaxUpper: [0.0488, 0.3540], gmaxLower: [0.0686, 0.3734], gmedFront: [0.0558, 0.3166], gmedBack: [0.0546, 0.3166],
  addmagIsch: [0.2163, 0.1680], addmagOther: [0.0581, 0.2378],
  addl: [0.0927, 0.1284], ilio: [0.0981, 0.2424], gas: [0.3911, 0.1806],
  sol: [0.2768, 0.3814], ta: [0.2405, 0.1952], pecs: [0.1075, 0.4463],
  pecc: [0.0028, 0.2967], adelt: [0.0930, 0.3840], pdelt: [0.0380, 0.3142],
  lat: [0.1473, 0.3781], trilong: [0.1430, 0.2094], trilat: [0.0944, 0.1571],
  bicLong: [0.2723, 0], bicShort: [0.1923, 0], brachialis: [0.0535, 0], brachioradialis: [0.1330, 0],
  pronatorTeres: [0.0980, 0.1745], pronatorQuadratus: [0.0050, 0.1745], supinator: [0.0280, 0], tmaj: [0.0200, 0.2793],
  corb: [0.0970, 0.4712], infra: [0.0389, 0.3491], supsp: [0.0395, 0.1222], subsc: [0.0330, 0.3491],
  mdelt: [0.1095, 0.2618],
};
if (SHOULDER_PARAMETER_SET === 'das3') {
  for (const [id, data] of Object.entries(DAS3_SHOULDER)) FIBER_GEOMETRY[id] = [data.Lt, data.alpha];
}

const DOF_REF = { hipExt: rad(-40), hipAbd: 0, kneeExt: rad(-50), ankPF: rad(-10), trunkExt: 0, shFwd: rad(20), shSide: rad(10), shRot: 0, elbExt: rad(-70), foreRot: 0, scRet: 0, scElev: 0 };
// 只在部分動作分析的自由度：沒分析時，肌肉在這些方向的力臂直接忽略（例如背闊肌在臥推只算屈伸）
const OPTIONAL_DOFS = ['shFwd', 'shSide', 'shRot', 'foreRot', 'scRet', 'scElev'];
export function liftMuscles(lift) {
  const dofs = LIFTS[lift].dofs, opt = LIFTS[lift].optDofs || [];
  return MUSCLES.filter((m) => {
    const ks = Object.keys(m.arms);
    // opt：次要作用，該動作沒分析這個方向時可以忽略（不會因此把整條肌肉排除）
    return ks.some((k) => dofs.includes(k)) && ks.every((k) => dofs.includes(k) || OPTIONAL_DOFS.includes(k) || opt.includes(k) || m.opt?.includes(k));
  }).map((m) => ({ ...m, arms: Object.fromEntries(Object.entries(m.arms).filter(([k]) => dofs.includes(k) || opt.includes(k))) }));
}

// ---------- 姿勢 ----------
function legChain(pose, A, toe, hip, extra = {}) {
  const leg = ik2(hip, A, BODY.Lt, BODY.Ls, toe);
  pose.R.hip = hip; pose.R.knee = leg.mid; pose.R.ankle = A;
  const fy = A[1] - BODY.ankleH + 0.02; // 腳底高度（站在墊高台上時 > 0）
  pose.R.toe = [A[0] + toe[0] * 0.19, fy, A[2] + toe[2] * 0.19];
  pose.R.heel = [A[0] - toe[0] * 0.06, fy, A[2] - toe[2] * 0.06];
  pose.toeDir = toe;
  return leg.ok;
}

// 前腳掌固定在原站位；腳跟墊高 h 後，足底從跟到趾長 25 cm，繞前腳掌傾斜。
// 踝在足底法線上 4.8 cm；外鞋底／墊片接觸地面，地面反力仍作用於 y=0。
function squatHeelFoot(P, flatA, toe) {
  const h = clamp(Number(P.heelHeight ?? 0), 0, 4) / 100;
  if (!h) return null;
  const a = Math.asin(h / 0.25), sn = Math.sin(a), cs = Math.cos(a);
  const dir = [toe[0] * cs, -sn, toe[2] * cs];
  const up = [toe[0] * sn, cs, toe[2] * sn];
  const tip = add(flatA, add(mul(toe, 0.19), [0, -BODY.ankleH + 0.02, 0]));
  const ankle = add(sub(tip, mul(dir, 0.19)), mul(up, BODY.ankleH - 0.02));
  return { h, a, ankle, heel: sub(tip, mul(dir, 0.25)), tip, dir, up };
}

function applySquatHeel(pose, foot) {
  if (!foot) return;
  pose.R.heel = foot.heel; pose.R.toe = foot.tip;
  pose.toeDir = foot.dir; pose.footUp = foot.up;
  // 顯示用墊片包含鞋底的 2 cm 高度，頂面貼齊腳跟骨架；地面接觸及力矩均不變。
  const visualHeight = foot.heel[1];
  const c = [foot.heel[0], visualHeight / 2, foot.heel[2]];
  pose.boxes = [-1, 1].map((side) => box([side * c[0], c[1], c[2]], [0.10, visualHeight, 0.075], 0, 'frame'));
}

// ---------- 肩帶（肩胛骨＋鎖骨）----------
// 軀幹局部座標：x = 外側、y = 沿軀幹向上、z = 前方，原點 = 骨盆中心；數值來自 BodyParts3D
export const GIRDLE = { scj: [0.0151, 0.5243, 0.0583], sh: [BODY.shHalf, BODY.Ltr, 0] };
export function girdleForBody(body = BODY) {
  if (body === DEFAULT_BODY) return GIRDLE;
  return { scj: [GIRDLE.scj[0] * body.shHalf / DEFAULT_BODY.shHalf,
    GIRDLE.scj[1] * body.Ltr / DEFAULT_BODY.Ltr,
    GIRDLE.scj[2] * body.Ltr / DEFAULT_BODY.Ltr], sh: [body.shHalf, body.Ltr, 0] };
}
// ret：後收（正）／前伸（負）；elev：上提（正）／下壓（負）；單位 rad
export function girdleMatrix(g) {
  const cr = Math.cos(g.ret), sr = Math.sin(g.ret), ce = Math.cos(g.elev), se = Math.sin(g.elev);
  // Ry(ret) · Rz(elev)
  return [[cr * ce, -cr * se, sr], [se, ce, 0], [-sr * ce, sr * se, cr]];
}
function girdlePointLocal(point, g) {
  const G = girdleForBody(), M = girdleMatrix(g), d = sub(point, G.scj);
  return add(G.scj, M.map((r) => dot(r, d)));
}
export function shoulderLocal(g) { return girdlePointLocal(girdleForBody().sh, g); }
// BodyParts3D 原始右肩胛骨的頂點中心，依 tools/build_bones.py 的軀幹座標正規化。
// rig.js 顯示網格合併肩胛與鎖骨；此點只取肩胛骨，仍同繞胸鎖關節旋轉，不另設距離。
export function scapulaLocal(g) {
  const center = [0.235231909098065 * DEFAULT_BODY.Ltr * BODY.shHalf / DEFAULT_BODY.shHalf,
    0.975678396831072 * BODY.Ltr, -0.059557042521439 * BODY.Ltr];
  return girdlePointLocal(center, g);
}
const toWorld = (tf, l) => add(add(add(tf.Pc, mul(tf.lat, l[0])), mul(tf.u, l[1])), mul(tf.f, l[2]));

function trunkFrame(Pc, u) {
  const lat = [1, 0, 0];
  const f = norm(cross(lat, u));
  return { Pc, u, f, lat, SC: add(Pc, mul(u, BODY.Ltr)) };
}

function armChain(pose, S, H, pole) {
  const arm = ik2(S, H, BODY.Lu, BODY.Lf, pole);
  pose.R.shoulder = S; pose.R.elbow = arm.mid; pose.R.hand = arm.end;
  pose.armPole = pole;
  return arm.ok;
}

// 手腕折彎的握法（深蹲扛槓）：前臂到手腕 Lw、手腕到槓中心 Lh、手腕背伸約 eps。
// 前臂＋手當成一根直棍（BODY.Lf）時，槓在肩膀附近會逼手肘甩到頭旁邊或往脊椎塌；實際上手腕是往後折的。
// 手腕→槓 的方向一定垂直槓（手掌橫過槓），hpref 決定兩個解中取哪一個（手從手腕往哪個方向伸到槓）。
// R.hand 仍放在前臂延長線上 Lf 處（前臂座標的握點），R.grip = 槓上的實際握點，R.wrist = 手腕。
const WRIST_LW = 0.746; // 肘→腕 = 0.746 Lf（BodyParts3D）；Lh = 腕→槓中心：槓在掌骨頭掌側約 9 cm、在掌根約 5 cm
function armChainBent(pose, S, B, pole, [epsDeg, Lh], hpref) {
  const Lw = WRIST_LW * BODY.Lf, eps = rad(epsDeg);
  const Leff = Math.sqrt(Lw * Lw + Lh * Lh + 2 * Lw * Lh * Math.cos(eps));
  const arm = ik2(S, B, BODY.Lu, Leff, pole);
  const E = arm.mid, v = sub(E, B);
  // h = 手腕→槓（在 yz 平面）：|v + Lh h| = Lw → v·h = c
  const c = (Lw * Lw - dot(v, v) - Lh * Lh) / (2 * Lh), Rr = Math.hypot(v[1], v[2]), ph = Math.atan2(v[2], v[1]);
  const da = Math.acos(clamp(c / Rr, -1, 1));
  const hs = [ph + da, ph - da].map((t) => [0, Math.cos(t), Math.sin(t)]);
  const h = dot(hs[0], hpref) >= dot(hs[1], hpref) ? hs[0] : hs[1];
  const W = sub(B, mul(h, Lh));
  pose.R.shoulder = S; pose.R.elbow = E; pose.R.wrist = W;
  pose.R.hand = add(E, mul(norm(sub(W, E)), BODY.Lf));
  pose.R.grip = B;
  pose.armPole = pole;
  return arm.ok;
}

// [手腕背伸角（度）, 腕→槓距離（m）]
export const SQ_WRIST = { high: [30, 0.075], low: [90, 0.05], front: [105, 0.05] };
// Demers 等 2018 圖 1（無負重背蹲，股骨角 20°／40°／60°）的六個踝背屈圖讀點，
// 依 docs/research/methods.md 等權網格擬合；跨到負重／其他槓位是外推。
// 寫計畫前已由測試組診斷知道髖位太後、膝前移不足，三種參數與冪函數形式不是盲選；數值才由 Demers 決定。
// 原文大轉子間寬／腳跟外側標記暫以模型髖中心 18 cm／踝中心距代理，兩站距僅對應 stance≈0.024／0.238；
// 預設 stance=0.3 的 dom=0.30 因而是外推。若僅假設大轉子寬 32 cm（非實測），兩點約為 stance=0.52／0.90。
// 六點擬合三參數；站距差 0.8–1.5° 接近讀圖誤差 ±1–2°，參數可辨識性弱，冪函數殘差呈系統型態。
const SQUAT_STANCE_SHIFT = 0.47;
const SQUAT_SHANK_PROGRESS = 0.83;
function freeSquatShankAngle(P, e, frontShift = 0) {
  const domEff = clamp(P.dom + frontShift + SQUAT_STANCE_SHIFT * (P.stance - 0.3), 0, 1);
  const flat = rad(4 + (lerp(40, 16, domEff) - 4) * Math.pow(e, SQUAT_SHANK_PROGRESS));
  return { domEff, flat };
}
// 水平面的膝路徑與腳尖方向差只是幾何代理；模型沒有脛股軸旋自由度。
function recordSquatKneePath(pose) {
  const A = pose.R.ankle, K = pose.R.knee, H = pose.R.hip;
  const forward = K[2] - A[2], lateral = K[0] - A[0];
  const path = Math.atan2(lateral, forward);
  const toe = Math.atan2(pose.toeDir[0], pose.toeDir[2]);
  const mismatch = Math.atan2(Math.sin(toe - path), Math.cos(toe - path));
  const thigh = Math.atan2(K[0] - H[0], K[2] - H[2]);
  const thighMismatch = Math.atan2(Math.sin(thigh - path), Math.cos(thigh - path));
  const thighSpan = Math.hypot(K[0] - H[0], K[2] - H[2]);
  // 大腿接近垂直時，水平投影角會被很小的前後跨距放大；只在屈曲超過 45° 時計入。
  const thighBent = thighSpan > Math.abs(K[1] - H[1]);
  pose.kneePath = { pathDeg: deg(path), toeDeg: deg(toe), footShankProxyDeg: deg(mismatch),
    thighDeg: deg(thigh), shankThighProxyDeg: thighBent ? deg(thighMismatch) : null,
    forwardM: forward, lateralM: lateral };
  pose.kneeDir = [Math.sin(path), 0, Math.cos(path)];
  // 25° 只觸發幾何人工複查，並非脛股旋轉或受傷安全界線。
  if ((Math.hypot(forward, lateral) > 0.05 && Math.abs(deg(mismatch)) > 25) ||
      (thighBent && Math.abs(deg(thighMismatch)) > 25))
    pose.warn.push('腳尖、小腿與大腿的水平面方向差較大，請檢查站距與腳尖角');
}
function squatPoseAt(P, e) {
  const low = P.barPos === 'low', front = P.barPos === 'front';
  const w = lerp(0.13, 0.34, P.stance), tau = rad(lerp(8, 38, P.stance));
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  // 低槓 +0.08、前槓 -0.08 仍為原來跨研究反推的示範偏移，未由 Demers 的單槓位資料重估；兩式姿勢未獨立校準。
  // 40°／16° 策略端點與大腿 70°／118° 仍為原始示範幾何，非研究量測邊界；端點也未納入本次擬合。
  // Demers 赤足持輕木桿、無外加負重；產品 1.0 倍體重槓重是外推。前蹲在 Goršič 定點可疑偏直立。
  // 站距斜率及小腿隨股骨角進度的曲線按上述獨立校準組；舊註解 46.6°／29.2° 是舊模型輸出，非研究目標。
  const { flat: flatShank } = freeSquatShankAngle(P, e, low ? 0.08 : front ? -0.08 : 0);
  const flatA = [w, BODY.ankleH, -0.07], foot = squatHeelFoot(P, flatA, toe);
  // 示範假設：鞋跟足板角按具名比例分給小腿前傾，其餘降低相對腳掌的踝背屈需求。
  // P._dTh：依骨長比例的小腿角偏移（見 anatomyWrapped）；缺省 0 即原策略。
  let thS = flatShank + (foot?.a || 0) * heelShankShare * e + (P._dTh || 0);
  const gam = rad(lerp(70, 118, P.depth)) * e;
  const A = foot?.ankle || flatA;
  const legAt = (angle) => {
    let Ls = BODY.Ls, Lt = BODY.Lt, K, Hy, Hz;
    for (let i = 0; i < 4; i++) {
      const Ky = A[1] + Ls * Math.cos(angle), Kz = A[2] + Ls * Math.sin(angle);
      Hy = Ky + Lt * Math.cos(gam); Hz = Kz - Lt * Math.sin(gam);
      const Kx = w + (P.kneePath === 'toes' ? (Kz - A[2]) * Math.tan(tau) : 0);
      K = [Kx, Ky, Kz];
      Ls = Math.sqrt(Math.max(0.01, BODY.Ls ** 2 - (Kx - w) ** 2));
      Lt = Math.sqrt(Math.max(0.01, BODY.Lt ** 2 - (Kx - BODY.hipHalf) ** 2));
    }
    return { K, Hy, Hz };
  };
  let { K, Hy, Hz } = legAt(thS);
  // ob：槓在軀幹後方的距離（負值 = 前方，前槓放在三角肌前束上）
  const Lb = front ? 0.5 : low ? 0.45 : 0.53, ob = front ? -0.11 : low ? 0.085 : 0.05, handX = front ? 0.23 : low ? 0.3 : 0.34;
  let Pc = [0, Hy, Hz];
  const girdle = { ret: rad(15), elev: 0 };
  const dl = shoulderLocal(girdle);
  const build = (phi) => {
    const u = [0, Math.cos(phi), Math.sin(phi)];
    const tf = trunkFrame(Pc, u);
    const bar = add(add(Pc, mul(u, Lb)), mul(tf.f, -ob));
    const S = toWorld(tf, dl);
    // 握點 = 槓中心（手掌與手指在 rig.js 依槓的位置擺放）
    // 手腕往後折（背伸），手肘才會落在合理位置：高槓手肘朝下後方、低槓上臂往後下約 45°（世界座標，不隨軀幹前傾翹起）、前槓手肘抬起，求解結果約在肩上方 11 cm（手掌朝上托槓，對應「手肘抬高」的前槓口令）
    const B = [handX, bar[1], bar[2]];
    const arm = { R: {} };
    if (front) armChainBent(arm, S, B, norm([0.45, -0.05, 1]), SQ_WRIST.front, norm(add(tf.u, mul(tf.f, -0.4))));
    else if (low) armChainBent(arm, S, B, norm([0.6, -1, -1]), SQ_WRIST.low, [0, 1, 0]);
    else armChainBent(arm, S, B, norm(add(mul(tf.f, -1), [0, -1, 0])), SQ_WRIST.high, [0, 1, 0]);
    return { tf, bar, arm };
  };
  const pose = { R: {}, warn: [], ok: true };
  pose.R.hip = [BODY.hipHalf, Hy, Hz]; pose.R.knee = K; pose.R.ankle = A;
  // 以實際三維手臂質心計算系統重心（避免前蹲前伸手肘在忽略手臂位置時使壓力中心前移約 1.2 cm、高估髖伸力矩）
  const comz = (phi) => {
    const { tf, bar, arm } = build(phi);
    const pz = { R: { hip: pose.R.hip, knee: K, ankle: A, shoulder: arm.R.shoulder, elbow: arm.R.elbow, wrist: arm.R.wrist, hand: arm.R.hand }, Pc: tf.Pc, u: tf.u, toeDir: toe };
    if (foot) applySquatHeel(pz, foot);
    return systemComZ(pz, bar, BAR_RATIO.squat);
  };
  // 極端骨長比例若使原小腿角無法在足中段平衡，先讓膝再往前移到剛好可平衡；不由文獻測試值設定角度。
  if (comz(rad(85)) < 0 && e > 0) {
    const base = thS, limit = Math.max(0, rad(45) - base);
    const shift = (extra) => {
      ({ K, Hy, Hz } = legAt(base + extra));
      Pc = [0, Hy, Hz];
      pose.R.hip = [BODY.hipHalf, Hy, Hz]; pose.R.knee = K;
      return comz(rad(85));
    };
    if (shift(limit) >= 0) {
      let lo = 0, hi = limit;
      for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (shift(mid) < 0) lo = mid; else hi = mid; }
      thS = base + hi;
      shift(hi);
    }
  }
  let phi;
  if (comz(0) >= 0) phi = 0;
  else if (comz(rad(85)) < 0) { phi = rad(85); pose.ok = false; pose.conflict = '重心無法維持在腳掌中段：軀幹已前傾到極限'; }
  else {
    let lo = 0, hi = rad(85);
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (comz(mid) < 0) lo = mid; else hi = mid; }
    phi = (lo + hi) / 2;
  }
  const { tf, bar, arm } = build(phi);
  Object.assign(pose, tf);
  pose.phi = phi;
  legChain(pose, A, toe, pose.R.hip);
  applySquatHeel(pose, foot);
  pose.R.knee = K; // 以平面解的膝位置為準
  recordSquatKneePath(pose);
  pose.girdle = girdle;
  Object.assign(pose.R, arm.R);
  pose.armPole = arm.armPole;
  if (front) pose.supinated = true;
  pose.bar = bar;
  if (deg(phi) > 62) pose.warn.push('軀幹前傾 ' + Math.round(deg(phi)) + '°（偏大）：股骨相對長或軀幹短的身材較容易如此；可加寬站距、墊高鞋跟、降低深度或改前槓，並確認踝背屈活動度');
  else if (front && deg(phi) > 45) pose.warn.push('前蹲軀幹前傾 ' + Math.round(deg(phi)) + '°，槓容易從肩上滑落');
  pose.heelTiltRad = foot?.a || 0;
  pose.cop = [w, 0, 0];
  pose.barW = BAR_RATIO.squat;
  pose.barOnBack = true;
  return pose;
}

// ---------- 依骨長比例分配小腿與軀幹（深蹲、高腳杯）----------
// 現行策略（freeSquatShankAngle）是預設身體（1.75 m 男）的小腿前傾；其他身材若小腿角固定，
// 股骨相對長時只有軀幹吸收。這裡在「大腿角（深度事件）與系統重心＝原平衡目標」都不變的前提下，
// 對小腿角加偏移 Δθ，最小化
//   J(Δθ) = λ²·Δθ² + (φ(Δθ) − φ_ref)²
// φ(Δθ) 是該身體在此小腿角下由平衡解出的軀幹角，φ_ref 是預設身體在原策略下的軀幹角。
// 預設身體 J = 0、Δθ = 0（以數值逐值相等短路，不靠最佳化殘差）；λ→∞ 即回到舊行為。
// λ：教學示範選擇，無文獻來源（教練確認 2026-11-28）。文獻只能判斷方向，無法識別 λ；
// 不得依任何驗證結果或角度分散度調整。見 docs/research/anatomy-posture-plan.md。
export const SQUAT_ANATOMY_LAMBDA = 1;
let anatomyLambda = SQUAT_ANATOMY_LAMBDA;
// 僅供同步驗證／敏感度掃描；finally 還原，產品路徑維持上方常數。
export function withAnatomyLambdaForValidation(lambda, run) {
  if (!Number.isFinite(lambda) || lambda < 0) throw new Error('λ 須為非負數');
  const original = anatomyLambda;
  try { anatomyLambda = lambda; return run(); } finally { anatomyLambda = original; }
}
const SQUAT_OFFSET_MAX = rad(25), SQUAT_OFFSET_MIN = rad(-10);
function isDefaultBodyByValue() {
  return BODY.sex === DEFAULT_BODY.sex && BODY_LENGTHS.every((k) => Math.abs(BODY[k] - DEFAULT_BODY[k]) < 1e-12);
}
// 個人踝背屈上限（度）：'off' 或未設為不限制。沒有找到成人負重蹲的度數常模，故只是使用者輸入。
function ankleDfCapRad(P) {
  if (P.ankleDfCap === undefined || P.ankleDfCap === 'off') return null;
  const v = Number(P.ankleDfCap);
  return Number.isFinite(v) && v > 0 ? rad(v) : null;
}
function anatomyWrapped(base) {
  return (P, e) => {
    if (P._dTh !== undefined) return base(P, e);
    const cap = ankleDfCapRad(P);
    if (e <= 0 || (cap === null && isDefaultBodyByValue())) return base(P, e);
    const shankOf = (p) => Math.atan2(p.R.knee[2] - p.R.ankle[2], p.R.knee[1] - p.R.ankle[1]);
    const phiRef = withBody(DEFAULT_BODY, () => base({ ...P, _dTh: 0 }, e)).phi;
    const at = (d) => base({ ...P, _dTh: d }, e);
    const p0 = at(0);
    const dfBase = shankOf(p0) - p0.heelTiltRad; // 相對足板的踝背屈
    const hi = Math.min(SQUAT_OFFSET_MAX, cap === null ? Infinity : cap - dfBase);
    const lo = Math.min(SQUAT_OFFSET_MIN, hi);
    const l2 = anatomyLambda * anatomyLambda;
    // 割線法：φ(Δθ) 近似線性，minimize l2·x² + (φd + s(x−d) − φref)²
    let d = 0, fd = p0.phi, s = (at(rad(0.5)).phi - fd) / rad(0.5);
    for (let i = 0; i < 4; i++) {
      const x = Math.min(hi, Math.max(lo, s * (s * d - fd + phiRef) / (l2 + s * s)));
      if (Math.abs(x - d) < rad(0.02)) break;
      const fx = at(x).phi;
      s = (fx - fd) / (x - d); d = x; fd = fx;
    }
    if (d > hi) d = hi;
    const pose = d === 0 ? p0 : at(d);
    pose.anatomyShiftDeg = deg(d);
    if (cap !== null && shankOf(pose) - pose.heelTiltRad >= cap - rad(0.05)) {
      pose.ankleCapBinding = true;
      pose.warn.push(`踝背屈已到你設定的上限 ${Math.round(deg(cap))}°，其餘由軀幹前傾吸收`);
      if (!pose.ok && pose.conflict) pose.conflict += '（已受個人踝背屈上限限制，可放寬上限、加寬站距或墊高鞋跟）';
    }
    return pose;
  };
}
const squatWrapped = anatomyWrapped(squatPoseAt), gobletWrapped = anatomyWrapped(gobletPoseAt);
function squatPose(P, e) { return squatWrapped(P, e); }
function gobletPose(P, e) { return gobletWrapped(P, e); }

// 腿前緣（含軟組織）在高度 y 的 z 座標
function legFrontZ(A, hip, knee, y) {
  if (y <= knee[1]) {
    const t = clamp((y - A[1]) / (knee[1] - A[1]), 0, 1);
    return lerp(A[2], knee[2], t) + 0.035;
  }
  const t = clamp((y - knee[1]) / (hip[1] - knee[1]), 0, 1);
  return lerp(knee[2], hip[2], t) + lerp(0.05, 0.09, t);
}

// 槓頂點由整條身體幾何鏈決定；不同身材不可共用求解結果。
const dlTopCache = new Map();
function deadliftPose(P, e) {
  const sumo = P.style === 'sumo';
  const w = sumo ? 0.36 : 0.15, tau = rad(sumo ? 40 : 8), gx = sumo ? 0.17 : 0.25;
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  // 起始槓高：負值 = 赤字（站在墊高台上）、正值 = 槓片架在墊塊上
  const dfc = Math.max(0, -(P.start || 0)) / 100, blk = Math.max(0, P.start || 0) / 100;
  const A = [w, BODY.ankleH + dfc, -0.07];
  const gap = 0.1 * P.barDist;           // 槓與腿前緣的距離
  const footMid = A[2] + (0.19 - 0.06) * toe[2] / 2;
  const bz = footMid + 0.5 * gap;        // H1：預設槓路在足底幾何中點正上方
  const target = bz - 0.016 - gap;        // 腿前緣要停在這裡（槓半徑 1.4 cm + 空隙）
  const Lr = BODY.Lu + BODY.Lf - 0.002;
  const girdle = { ret: rad(-8), elev: rad(-5) }; // 負重下肩胛略前伸、下壓
  const dl = shoulderLocal(girdle);
  const scap = scapulaLocal(girdle);
  const R2 = Lr ** 2 - (gx - dl[0]) ** 2;
  const maxReach = (BODY.Ls + BODY.Lt) * 0.997;

  // 給定軀幹角與槓高：找出「腿剛好貼著槓」的骨盆前後位置
  const place = (phi, barY) => {
    const u = [0, Math.cos(phi), Math.sin(phi)];
    const build = (pcz) => {
      const Sz = pcz + u[2] * dl[1] + u[1] * dl[2];
      const dz = clamp(Sz - bz, -Math.sqrt(R2) * 0.98, Math.sqrt(R2) * 0.98);
      const Sy = barY + Math.sqrt(R2 - dz * dz);
      const Pc = [0, Sy - (u[1] * dl[1] - u[2] * dl[2]), pcz - (Sz - (bz + dz))];
      const hip = [BODY.hipHalf, Pc[1], Pc[2]];
      const knee = ik2(hip, A, BODY.Lt, BODY.Ls, toe).mid;
      const scapZ = Pc[2] + u[2] * scap[1] + u[1] * scap[2];
      return { u, Pc, hip, knee, S: [dl[0], Sy, bz + dz], scapZ, front: legFrontZ(A, hip, knee, barY), d: len(sub(hip, A)) };
    };
    let lo = bz - 1.0, hi = bz + 0.3;
    for (let i = 0; i < 34; i++) { const m = (lo + hi) / 2; if (build(m).front > target) hi = m; else lo = m; }
    return build(lo);
  };
  const key = JSON.stringify([P.style, P.barDist, P.start || 0,
    BODY.Ls, BODY.Lt, BODY.Ltr, BODY.Lu, BODY.Lf, BODY.hipHalf, BODY.shHalf, BODY.ankleH]);
  let barTopY = dlTopCache.get(key);
  if (barTopY === undefined) {
    let lo = 0.4, hi = 1.3;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (place(0, m).d <= maxReach) lo = m; else hi = m; }
    barTopY = lo;
    if (dlTopCache.size > 50) dlTopCache.clear();
    dlTopCache.set(key, barTopY);
  }
  const barY = lerp(barTopY, 0.225 + blk, e);
  // H1／G1：槓在足中段、小腿貼槓，右肩胛骨頂點中心在槓正上方；肩關節自然位於槓前。
  const startY = 0.225 + blk;
  const phi0 = bisect((a) => place(a, startY).scapZ - bz, rad(15), rad(85));
  const pose = { R: {}, warn: [], ok: true };
  // H1／H2 教練原則：槓離地至過膝維持起槓軀幹角，先靠伸膝抬槓；過膝才逐步伸髖。
  const kneeY = bisect((y) => y - place(phi0, y).knee[1], startY, barTopY);
  let phi = phi0 * (barY <= kneeY ? 1 : clamp((barTopY - barY) / (barTopY - kneeY), 0, 1));
  let r = place(phi, barY);
  if (r.d > maxReach) {
    // 腿伸直也碰不到：軀幹改直一點（髖往下、往前）
    let lo = 0, hi = phi;
    if (place(0, barY).d > maxReach) { pose.ok = false; pose.conflict = '槓的位置太高或太遠，腿伸直也碰不到'; }
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (place(m, barY).d > maxReach) hi = m; else lo = m; }
    phi = lo; r = place(phi, barY);
  }
  if (r.d < 0.3) { pose.ok = false; pose.conflict = '髖位太低，膝關節彎曲超過可行範圍'; }
  const tf = trunkFrame(r.Pc, r.u);
  Object.assign(pose, tf);
  pose.phi = phi;
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  armChain(pose, r.S, [gx, barY, bz], norm(add(mul(tf.f, -1), [0.3, -0.2, 0])));
  pose.bar = [0, barY, bz];
  const armTilt = deg(Math.atan2(Math.abs(r.S[2] - bz), r.S[1] - barY));
  if (armTilt > 10 && r.S[2] < bz && e > 0.5) pose.warn.push('肩膀落在槓後方 ' + Math.round(armTilt) + '°');
  pose.cop = [w, dfc, 0];
  pose.floorY = dfc;
  if (dfc > 0) pose.platform = { h: dfc, x: w, z: A[2] + 0.05 };
  if (blk > 0) pose.blocks = { h: blk, z: bz };
  pose.barW = BAR_RATIO.deadlift;
  return pose;
}

// 羅馬尼亞硬舉：膝角度固定、從站姿往下做髖鉸鏈；槓沿腳掌中段垂直移動並貼著腿
function rdlPose(P, e) {
  const w = 0.14, tau = rad(8), gx = 0.24;
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const gap = 0.1 * P.barDist;
  const bz = 0.02 + 0.5 * gap + (P._balanceBarShift || 0);
  const target = bz - 0.016 - gap;
  const Lr = BODY.Lu + BODY.Lf - 0.002;
  const girdle = { ret: rad(-5), elev: rad(-5) };
  const dl = shoulderLocal(girdle);
  const R2 = Lr ** 2 - (gx - dl[0]) ** 2;
  const kap = rad(P.kneeBend);
  const phi = rad(lerp(3, lerp(50, 85, P.depth), e));
  const u = [0, Math.cos(phi), Math.sin(phi)];
  // 平面上的有效長度（扣掉左右方向的距離）
  const kx = lerp(w, BODY.hipHalf, BODY.Ls / (BODY.Ls + BODY.Lt));
  const Ls = Math.sqrt(BODY.Ls ** 2 - (w - kx) ** 2), Lt = Math.sqrt(BODY.Lt ** 2 - (kx - BODY.hipHalf) ** 2);
  // 給定小腿前傾角 th：求出髖、肩、槓的位置，回傳腿前緣與槓的距離
  const build = (th) => {
    const knee = [kx, A[1] + Ls * Math.cos(th), A[2] + Ls * Math.sin(th)];
    const hip = [BODY.hipHalf, knee[1] + Lt * Math.cos(th - kap), knee[2] + Lt * Math.sin(th - kap)];
    const Pc = [0, hip[1], hip[2]];
    const tf = trunkFrame(Pc, u);
    const S = toWorld(tf, dl);
    const dz = S[2] - bz;
    const reach = dz * dz < R2;
    const barY = S[1] - Math.sqrt(Math.max(0, R2 - dz * dz));
    return { knee, hip, tf, S, barY, reach, f: legFrontZ(A, hip, knee, barY) - target };
  };
  // 兩個條件取較靠後的：(1) 肩膀略在槓前方（手臂接近垂直）→ 髖往後推維持平衡；(2) 腿不能穿過槓
  const solve = (g) => {
    let lo = rad(-10), hi = rad(30);
    if (g(lo) > 0) return lo;
    if (g(hi) < 0) return hi;
    // 17 步的角度誤差換算到肢段端點小於 0.01 mm，外層平衡不必重解 34 次。
    for (let i = 0; i < 17; i++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; }
    return lo;
  };
  const sOff = 0.03 * e;
  const thS = solve((th) => build(th).S[2] - (bz + sOff));
  const thC = solve((th) => build(th).f);
  const r = build(Math.min(thS, thC));
  const pose = { R: {}, warn: [], ok: true };
  if (!r.reach) { pose.ok = false; pose.conflict = '手臂碰不到腳掌正上方的槓'; }
  if (r.barY < 0.225) { pose.ok = false; pose.conflict = '下放太深，槓片已經碰到地面'; }
  Object.assign(pose, r.tf);
  pose.phi = phi;
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  armChain(pose, r.S, [gx, r.barY, bz], norm(add(mul(r.tf.f, -1), [0.3, -0.2, 0])));
  pose.bar = [0, r.barY, bz];
  pose.barW = BAR_RATIO.rdl;
  const shin = deg(Math.atan2(r.knee[2] - A[2], r.knee[1] - A[1]));
  if (shin > 15 && e > 0.3) pose.warn.push('膝蓋往前跑 ' + Math.round(shin) + '°，變成接近深蹲');
  if (r.barY < r.knee[1] - 0.12 && e > 0.5) pose.warn.push('槓已低於膝下方，注意膕繩肌柔軟度');
  // H2：保留膝角與髖折疊，以槓貼腿的位置作唯一剩餘自由度；按完整外力求平衡。
  // 不把骨盆或膝角硬調成另一個動作。求解得到的槓前後漂移須由稽核另列。
  if (P._balanceBarShift === undefined) {
    const target = balanceTargetZ(pose, P);
    const error = (shift) => {
      const candidate = rdlPose({ ...P, _balanceBarShift: shift }, e);
      forcesOf(candidate, P, 'rdl');
      return candidate.cop[2] - target;
    };
    return rdlPose({ ...P, _balanceBarShift: bisect(error, -0.12, 0.3, 17) }, e);
  }
  return pose;
}

// 膝角度固定的站姿：給小腿前傾角 th，回傳膝、髖（平面近似，扣掉左右方向的距離）
function fixedKneeLegs(A, w, kap) {
  const kx = lerp(w, BODY.hipHalf, BODY.Ls / (BODY.Ls + BODY.Lt));
  const Ls = Math.sqrt(BODY.Ls ** 2 - (w - kx) ** 2), Lt = Math.sqrt(BODY.Lt ** 2 - (kx - BODY.hipHalf) ** 2);
  return (th) => {
    const knee = [kx, A[1] + Ls * Math.cos(th), A[2] + Ls * Math.sin(th)];
    const hip = [BODY.hipHalf, knee[1] + Lt * Math.cos(th - kap), knee[2] + Lt * Math.sin(th - kap)];
    return { knee, hip };
  };
}
// 單調函數 g 的根（找不到就停在邊界）
function bisect(g, lo, hi, n = 34) {
  if (g(lo) > 0) return lo;
  if (g(hi) < 0) return hi;
  for (let i = 0; i < n; i++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
// de Leva 表 4：質心自各節段起點往終點。軀幹 SUPR→MIDH 換成骨盆→肩線；
// 頭頸 VERT→MIDG 的標記骨架未分出，以現有頭部球體的頂端／下顎代理點（肩上 0.34／0.14 m）映射。
// 手腕在一般動作由肘→手端 74.6% 估計；深蹲折腕姿勢則使用實際求得的腕點。
export function segmentPoints(pose) {
  const R = pose.R;
  const { mass: MF, cm } = SEGMENTS[BODY.sex];
  const toe = pose.toeDir || [0, 0, 1];
  const foot = R.heel && R.toe ? lerpV(R.heel, R.toe, cm.foot) : add(R.ankle, mul(toe, -0.06 + 0.25 * cm.foot));
  const wrist = R.wrist || lerpV(R.elbow, R.hand, 0.746);
  return [
    [foot, MF.foot, 'foot'],
    [lerpV(R.knee, R.ankle, cm.shank), MF.shank, 'shank'],
    [lerpV(R.hip, R.knee, cm.thigh), MF.thigh, 'thigh'],
    [add(pose.Pc, mul(pose.u, BODY.Ltr * cm.trunkUp)), MF.trunk / 2, 'trunk'],
    [add(pose.Pc, mul(pose.u, BODY.Ltr + (0.34 - 0.20 * cm.head) * BODY.heightM / DEFAULT_BODY.heightM)), MF.head / 2, 'trunk'],
    [lerpV(R.shoulder, R.elbow, cm.upper), MF.upper, 'upper'],
    [lerpV(R.elbow, wrist, cm.fore), MF.fore, 'fore'],
    [lerpV(wrist, R.hand, cm.hand), MF.hand, 'fore'],
  ];
}

// 系統重心 z（雙側；手臂各自計入，槓在 bar）
function systemComZ(pose, bar, barW) {
  const parts = segmentPoints(pose).map(([p, m]) => [2 * m, p[2]]);
  parts.push([barW, bar[2]]);
  let m = 0, z = 0;
  for (const [mi, zi] of parts) { m += mi; z += mi * zi; }
  return z / m;
}

// 腳跟與腳尖的幾何中點；G1 的零點使用實際足底，而非世界座標 z=0。
export function footMidZ(pose) { return (pose.R.heel[2] + pose.R.toe[2]) / 2; }
function balanceTargetZ(pose, P) { return footMidZ(pose) + (P.balanceCm || 0) / 100; }

// 槓鈴划船：軀幹角固定、髖往後讓手臂垂下時槓在腳掌中段正上方；槓從垂手位置拉到軀幹
function rowPose(P, e) {
  const w = 0.15, tau = rad(8);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const gx = 0.2 * P.grip;
  const phi = rad(P.torso);
  const u = [0, Math.cos(phi), Math.sin(phi)];
  const legs = fixedKneeLegs(A, w, rad(22));
  const g0 = { ret: rad(-8), elev: rad(-6) };
  const girdle = { ret: lerp(g0.ret, rad(lerp(-2, 25, P.scap)), Math.pow(e, 1.5)), elev: lerp(g0.elev, rad(0), e) };
  const Lr = 0.985 * (BODY.Lu + BODY.Lf);
  const dl = shoulderLocal(girdle), dl0 = shoulderLocal(g0);
  // 給小腿角 th：手臂垂下的位置（肩膀正下方）→ 觸身點（軀幹前緣，腹部厚度約 13 cm＋槓半徑，從肚臍到下胸）
  const at = (th) => {
    const { knee, hip } = legs(th);
    const tf = trunkFrame([0, hip[1], hip[2]], u);
    const S0 = toWorld(tf, dl0), S = toWorld(tf, dl);
    const hang = [gx, S0[1] - Math.sqrt(Math.max(0.01, Lr ** 2 - (gx - S0[0]) ** 2)), S0[2]];
    const touch = add(add(tf.Pc, mul(u, lerp(0.14, 0.36, P.pullTo))), mul(tf.f, 0.145));
    touch[0] = gx;
    const bar = lerpV(hang, touch, e);
    return { knee, hip, tf, S, hang, bar };
  };
  // 每一幀都讓系統重心停在腳掌中段（槓往身上拉時，髖會跟著往前一點）
  const com = (th) => {
    const r = at(th), p = { R: {}, Pc: r.tf.Pc, u, toeDir: toe };
    legChain(p, A, toe, r.hip);
    const fl = rad(P.flare);
    const pole = norm(add(add(mul(r.tf.f, -Math.cos(fl)), mul(r.tf.lat, Math.sin(fl))), mul(r.tf.u, -0.3)));
    armChain(p, r.S, r.bar, pole);
    return systemComZ(p, r.bar, BAR_RATIO.row);
  };
  const footMid = A[2] + (0.19 - 0.06) * toe[2] / 2;
  const r = at(bisect((th) => com(th) - footMid - (P.balanceCm || 0) / 100, rad(-30), rad(30)));
  const { tf, S, hang, bar } = r;
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = phi;
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  const fl = rad(P.flare);
  const pole = norm(add(add(mul(tf.f, -Math.cos(fl)), mul(tf.lat, Math.sin(fl))), mul(tf.u, -0.3)));
  const ok = armChain(pose, S, bar, pole);
  if (!ok && e > 0.3) { pose.ok = false; pose.conflict = '手臂長度無法把槓拉到這個位置'; }
  pose.bar = [0, bar[1], bar[2]];
  if (hang[1] < 0.225) { pose.ok = false; pose.conflict = '軀幹太低，垂手時槓片會碰地'; }
  pose.barW = BAR_RATIO.row;
  pose.supinated = P.supin === 'sup';
  if (P.torso < 40) pose.warn.push('軀幹偏直立：拉的方向接近聳肩，上斜方肌參與增加');
  return pose;
}

// 站姿肩推：腳到肩近似一個整體繞踝關節前後傾，讓系統重心停在腳掌中段；軀幹可再相對骨盆後仰
function ohpPose(P, e) {
  const w = 0.14, tau = rad(8);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const gx = 0.2 * P.grip;
  const legs = fixedKneeLegs(A, w, rad(3));
  const lean = rad(P.lean) * (0.4 + 0.6 * e); // 槓經過臉時後仰最多，鎖死時身體回正一些
  const girdle = { ret: rad(lerp(0, 8, e)), elev: rad(lerp(4 + 14 * P.shrug, -2, e)) };
  const dl = shoulderLocal(girdle);
  const Rl = 0.995 * (BODY.Lu + BODY.Lf);
  const a = rad(P.flare);
  const build = (th) => {
    const { knee, hip } = legs(th);
    const pt = th - rad(3) - lean;
    const tf = trunkFrame([0, hip[1], hip[2]], [0, Math.cos(pt), Math.sin(pt)]);
    const S = toWorld(tf, dl);
    // 鎖死：手臂幾乎伸直、往前偏 path；觸鎖骨：槓在胸骨上緣前方
    const dz = lerp(0, 0.1, P.path), dx = gx - S[0];
    const lock = [gx, S[1] + Math.sqrt(Math.max(0.01, Rl ** 2 - dx * dx - dz * dz)), S[2] + dz];
    // 前臂垂直時槓約在肩關節高度、架在三角肌前束上
    const rack = add(add(tf.Pc, mul(tf.u, 0.535)), mul(tf.f, 0.11));
    rack[0] = gx;
    // 鎖死端（e→0）手臂近全伸直（Rl=0.995(Lu+Lf)），雙連桿 IK 具奇異點（線性 e 時首步 1/80 上臂跳動 5.56°）；
    // 以 e^1.25 放緩離開鎖死端速度、並以 smoothstep 取代原避頭硬判斷（原硬判斷造成上臂 8.60°／軸旋 10.72° 跳動），
    // 僅為連續性修正（最大步長降至上臂 3.18°／軸旋 2.07°），不改變前五名肌群排名（峰值差 ≤0.003）。
    const bar = lerpV(lock, rack, Math.pow(e, 1.25));
    // 槓經過頭部高度時以平滑過渡繞過下巴，避免硬門檻階躍
    const head = add(tf.SC, mul(tf.u, 0.2));
    const headGap = Math.abs(bar[1] - head[1]);
    const clearance = clamp((0.16 - headGap) / 0.12, 0, 1);
    const blend = clearance * clearance * (3 - 2 * clearance);
    bar[2] += Math.max(0, head[2] + 0.12 - bar[2]) * blend;
    return { knee, hip, tf, S, bar, head };
  };
  const com = (th) => {
    const r = build(th), p = { R: {}, Pc: r.tf.Pc, u: r.tf.u, toeDir: toe };
    legChain(p, A, toe, r.hip);
    const pole = norm(add(add(mul(r.tf.lat, Math.sin(a)), mul(r.tf.f, Math.cos(a))), mul(r.tf.u, -0.8)));
    armChain(p, r.S, r.bar, pole);
    return systemComZ(p, r.bar, BAR_RATIO.ohp);
  };
  const footMid = A[2] + (0.19 - 0.06) * toe[2] / 2;
  const r = build(bisect((th) => com(th) - footMid - (P.balanceCm || 0) / 100, rad(-15), rad(15)));
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, r.tf);
  pose.phi = r.tf.u[2] < 0 ? -Math.asin(-r.tf.u[2]) : Math.asin(r.tf.u[2]);
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  const pole = norm(add(add(mul(r.tf.lat, Math.sin(a)), mul(r.tf.f, Math.cos(a))), mul(r.tf.u, -0.8)));
  const ok = armChain(pose, r.S, r.bar, pole);
  if (!ok && e > 0.2) { pose.ok = false; pose.conflict = '手臂長度無法支撐這個槓位'; }
  pose.bar = [0, r.bar[1], r.bar[2]];
  pose.barW = BAR_RATIO.ohp;
  const fore = sub(pose.R.hand, pose.R.elbow);
  const tilt = deg(Math.acos(clamp(fore[1] / len(fore), -1, 1)));
  if (e > 0.7 && tilt > 25) pose.warn.push('前臂偏離垂直 ' + Math.round(tilt) + '°');
  if (deg(lean) > 12) pose.warn.push('後仰 ' + Math.round(deg(lean)) + '°，變成上斜推、下背壓力增加');
  return pose;
}

// 站姿、槓在手上（彎舉、聳肩、直立划船）：腳到肩繞踝前後傾，讓系統重心停在腳掌中段
// kap = 膝彎曲、lean = 軀幹相對大腿前傾（負 = 後仰）；barAt(tf, S, hip, knee) 回傳 { bar, elbow? }（bar 的 x = 握點）
function standingHands(P, { kap, lean, girdle, barAt, pole, barW, ext, barAxial = true }) {
  const w = 0.14, tau = rad(8);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const legs = fixedKneeLegs(A, w, kap);
  const dl = shoulderLocal(girdle);
  const build = (th) => {
    const { knee, hip } = legs(th);
    const pt = th - kap + lean;
    const tf = trunkFrame([0, hip[1], hip[2]], [0, Math.cos(pt), Math.sin(pt)]);
    const S = toWorld(tf, dl);
    return { knee, hip, tf, S, ...barAt(tf, S, hip, knee) };
  };
  const makePose = (th) => {
    const r = build(th), pose = { R: {}, warn: [], ok: true };
    Object.assign(pose, r.tf);
    pose.phi = Math.asin(clamp(r.tf.u[2], -1, 1));
    pose.girdle = girdle;
    legChain(pose, A, toe, r.hip);
    pose.R.knee = r.knee;
    pose.armOk = armChain(pose, r.S, r.bar, typeof pole === 'function' ? pole(r.tf, r) : pole);
    pose.barAxial = barAxial;
    pose.bar = [0, r.bar[1], r.bar[2]];
    pose.barW = barW;
    pose.r = r;
    pose.shinTilt = Math.atan2(r.knee[2] - A[2], r.knee[1] - A[1]);
    return pose;
  };
  const copAt = (th) => {
    const p = makePose(th), cz = systemComZ(p, p.R.hand, barW);
    if (!ext) return cz;
    // 鋼索的水平與垂直外力均納入壓力中心；只使用實際求得的肘、手與足底幾何。
    const F = ext(p.r), m = 1 + barW, H = p.R.hand;
    return (-m * cz + H[2] * F[1] - H[1] * F[2]) / (-m + F[1]);
  };
  const target = balanceTargetZ(makePose(0), P);
  const pose = makePose(bisect((th) => copAt(th) - target, rad(-25), rad(45)));
  if (P.footStance === 'staggered') {
    // 力學仍以左右對稱半身求解；畫面前後各錯開 10 cm，支撐面取兩腳外緣。
    // 此等效支撐面不推算左右腳各自反力或不對稱的髖膝踝力矩。
    const shifted = (dz) => {
      const ankle = add(pose.R.ankle, [0, 0, dz]);
      const knee = ik2(pose.R.hip, ankle, BODY.Lt, BODY.Ls, [0, 1, 0]).mid;
      return { ankle, knee, heel: add(pose.R.heel, [0, 0, dz]), toe: add(pose.R.toe, [0, 0, dz]) };
    };
    pose.visualLegs = { R: shifted(0.10), L: shifted(-0.10) };
    pose.supportSpan = [pose.visualLegs.L.heel[2], pose.visualLegs.R.toe[2]];
  }
  return pose;
}

// 槓鈴彎舉：上臂從垂直（底部）往前帶到 elbFwd（頂點），手肘屈曲從 18° 到 topFlex
function curlPose(P, e) {
  const gx = 0.2 * P.grip, t = 1 - e; // t = 0 底部、1 頂點
  const as = rad(P.elbFwd) * t, ef = rad(lerp(18, P.topFlex, t));
  const pose = standingHands(P, {
    kap: rad(4), lean: -rad(P.swing) * Math.sin(Math.PI * Math.min(1, t * 1.4) / 2),
    girdle: { ret: rad(8), elev: rad(-4) }, barW: BAR_RATIO.curl,
    pole: (tf, r) => sub(r.elbow, r.S),
    barAt: (tf, S) => {
      const down = mul(tf.u, -1);
      const ud = add(mul(down, Math.cos(as)), mul(tf.f, Math.sin(as)));
      const n = add(mul(tf.u, Math.sin(as)), mul(tf.f, Math.cos(as))); // 矢狀面內、垂直上臂往前
      const E = add(S, mul(ud, BODY.Lu));
      const fd = add(mul(ud, Math.cos(ef)), mul(n, Math.sin(ef)));
      // 槓的橫向握距占掉一部分前臂長；矢狀面投影需相應縮短。
      const foreYZ = Math.sqrt(Math.max(0, BODY.Lf ** 2 - (gx - E[0]) ** 2)) - 0.001;
      const bar = add(E, mul(fd, foreYZ));
      bar[0] = gx;
      return { bar, elbow: E };
    },
  });
  pose.supinated = P.supin !== 'pro';
  if (P.swing > 8) pose.warn.push('身體後仰 ' + Math.round(P.swing) + '°：借力，下背承受較多');
  if (P.elbFwd > 30 && e < 0.3) pose.warn.push('頂點手肘往前帶很多：前臂接近垂直時二頭張力幾乎歸零');
  return pose;
}

// 站姿垂手：手臂從肩膀往下伸直，槓在大腿前方
function hangBar(tf, S, hip, knee, gx) {
  const Lr = 0.997 * (BODY.Lu + BODY.Lf), dx = gx - S[0];
  const y = S[1] - Math.sqrt(Math.max(0.01, Lr * Lr - dx * dx));
  // 槓不能穿過大腿：大腿前緣（含軟組織）約在骨頭前方 9 cm
  const tA = clamp((y - knee[1]) / (hip[1] - knee[1]), 0, 1);
  const thighFront = lerp(knee[2], hip[2], tA) + lerp(0.05, 0.09, tA) + 0.016;
  let z = Math.max(S[2], thighFront);
  const dz = z - S[2];
  const y2 = S[1] - Math.sqrt(Math.max(0.01, Lr * Lr - dx * dx - dz * dz));
  return [gx, y2, z];
}

// 聳肩：手臂垂直伸直，只動肩胛上提（可加後收）
function shrugPose(P, e) {
  const gx = 0.2 * P.grip, t = 1 - e;
  const girdle = { ret: rad(lerp(-6, lerp(-4, 20, P.ret), t)), elev: rad(lerp(-10, lerp(10, 30, P.height), t)) };
  const pose = standingHands(P, {
    kap: rad(6), lean: rad(P.lean), girdle, barW: BAR_RATIO.shrug,
    // 肘部略朝外後方（同硬舉），讓前臂旋前落在自然範圍內、手指確實包覆槓身
    pole: (tf) => norm(add(mul(tf.f, -1), [0.55, -0.1, 0])),
    barAt: (tf, S, hip, knee) => ({ bar: hangBar(tf, S, hip, knee, gx) }),
  });
  if (P.lean > 20) pose.warn.push('軀幹前傾 ' + Math.round(P.lean) + '°：上提方向偏向後收，中斜方參與增加');
  return pose;
}

// 直立划船：槓沿身體前方垂直拉高，手肘往外上方帶
function uprowPose(P, e) {
  const gx = 0.2 * P.grip, t = 1 - e;
  const girdle = { ret: rad(lerp(-4, 6, t)), elev: rad(lerp(-8, lerp(8, 22, P.height), t)) };
  const pose = standingHands(P, {
    kap: rad(6), lean: rad(P.lean), girdle, barW: BAR_RATIO.uprow,
    pole: (tf) => norm(add(add(mul(tf.lat, 1), mul(tf.u, 0.12)), mul(tf.f, -0.3))),
    barAt: (tf, S, hip, knee) => {
      const hang = hangBar(tf, S, hip, knee, gx);
      // 頂點：槓在軀幹前方 4 cm，高度從下胸（0.36）到鎖骨（0.5）
      const top = add(add(tf.Pc, mul(tf.u, lerp(0.36, 0.5, P.height))), mul(tf.f, 0.155));
      top[0] = gx;
      // 垂臂端（t→0）手臂近全伸直（Lr=0.997(Lu+Lf)），原 t^0.9 在 t→0 導數發散疊加 IK 奇異點（1/80 上臂跳動 7.25°，線性 t 仍達 5.28°）；
      // 改用 t^1.12 放緩垂臂起步速度，僅為連續性修正（最大步長降至 4.57°），不改變前四名肌群排名（峰值差 ≤0.0014）。
      const bar = lerpV(hang, top, Math.pow(t, 1.12));
      // 中間行程：槓貼著身體前緣（不能穿過軀幹）
      const rel = sub(bar, tf.Pc), along = dot(rel, tf.u), front = dot(rel, tf.f);
      if (along > 0 && along < 0.55 && front < 0.15) return { bar: add(bar, mul(tf.f, 0.15 - front)) };
      return { bar };
    },
  });
  const shAbd = deg(Math.asin(clamp(dot(norm(sub(pose.R.elbow, pose.R.shoulder)), pose.lat), -1, 1)));
  const up = deg(Math.acos(clamp(dot(norm(sub(pose.R.elbow, pose.R.shoulder)), mul(pose.u, -1)), -1, 1)));
  if (e < 0.2 && up > 95) pose.warn.push('手肘舉高超過肩膀（上臂抬起 ' + Math.round(up) + '°）：肩峰下空間變窄');
  if (P.grip < 0.8) pose.warn.push('握距很窄：手腕屈曲、肩關節內旋角度大');
  pose.shAbdDeg = shAbd;
  return pose;
}

// 早安體前屈：槓扛在背上、膝角度固定，從站姿往前做髖鉸鏈；每一幀髖往後讓重心停在腳掌中段
function goodMorningPose(P, e) {
  const w = 0.15, tau = rad(10);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const kap = rad(lerp(3, P.kneeBend, Math.min(1, e * 2)));
  const legs = fixedKneeLegs(A, w, kap);
  const low = P.barPos === 'low';
  const Lb = low ? 0.45 : 0.53, ob = low ? 0.085 : 0.05, handX = low ? 0.3 : 0.34;
  const phi = rad(lerp(3, lerp(45, 90, P.depth), e));
  const u = [0, Math.cos(phi), Math.sin(phi)];
  const build = (th) => {
    const { knee, hip } = legs(th);
    const tf = trunkFrame([0, hip[1], hip[2]], u);
    const bar = add(add(tf.Pc, mul(u, Lb)), mul(tf.f, -ob));
    const S = toWorld(tf, shoulderLocal({ ret: rad(15), elev: 0 }));
    const B = [handX, bar[1], bar[2]];
    const arm = { R: {} };
    if (low) armChainBent(arm, S, B, norm(add(add(mul(tf.f, -0.6), mul(tf.u, -1)), [0.6, 0, 0])), SQ_WRIST.low, tf.u);
    else armChainBent(arm, S, B, norm(add(mul(tf.f, -1), mul(tf.u, -1))), SQ_WRIST.high, tf.u);
    return { knee, hip, tf, bar, arm };
  };
  const comz = (th) => {
    const r = build(th), p = { R: {}, Pc: r.tf.Pc, u, toeDir: toe };
    legChain(p, A, toe, r.hip);
    Object.assign(p.R, r.arm.R);
    return systemComZ(p, r.bar, BAR_RATIO.goodmorning);
  };
  const footMid = A[2] + (0.19 - 0.06) * toe[2] / 2;
  const r = build(bisect((th) => comz(th) - footMid - (P.balanceCm || 0) / 100, rad(-20), rad(30)));
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, r.tf);
  pose.phi = phi;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  pose.girdle = { ret: rad(15), elev: 0 };
  Object.assign(pose.R, r.arm.R);
  pose.armPole = r.arm.armPole;
  pose.bar = r.bar;
  pose.barW = BAR_RATIO.goodmorning;
  pose.barOnBack = true;
  const shin = deg(Math.atan2(r.knee[2] - A[2], r.knee[1] - A[1]));
  if (deg(phi) > 80) pose.warn.push('軀幹接近水平：下背與膕繩肌承受最大力矩，建議用輕重量');
  if (shin < -12) pose.warn.push('小腿往後傾 ' + Math.round(-shin) + '°，重心偏腳跟');
  return pose;
}

// 底點在所有可及的肘彎曲方向中，取前臂水平偏移最小者；由肩、固定握點、觸點及臂長決定。
// 這是運動學條件，不把研究量到的外展角反推到產品參數。
function benchVerticalPole(S, H, rot) {
  let best = null, cost = Infinity;
  for (let d = 0; d <= 90; d++) {
    const a = rad(d), pole = norm(rot([Math.sin(a), -0.25, Math.cos(a)]));
    const E = ik2(S, H, BODY.Lu, BODY.Lf, pole).mid;
    const c = (E[0] - H[0]) ** 2 + (E[2] - H[2]) ** 2;
    if (c < cost) { cost = c; best = pole; }
  }
  return best;
}

// 上胸椎拱起的兩段近似：肩胛支點微抬，胸骨繞肩端的 24 cm 等效半徑抬高。
// 0° 時所有位移精確為零；角度是模型控制量，不能當作受試者實測胸骨線角。
function benchArch(P) {
  const a = rad(P.arch || 0);
  return { a, shoulderLift: 0.08 * (1 - Math.cos(a)), chestLift: 0.24 * Math.sin(a), chestBack: 0.24 * (1 - Math.cos(a)) };
}

function benchPose(P, e) {
  const pose = { R: {}, warn: [], ok: true, supine: true };
  // 地板臥推：肩胛支點貼近地面、不能上斜；胸骨可抬起，下放到上臂碰地為止
  const floor = P.surface === 'floor';
  // 上斜：身體繞左右軸轉，頭端抬高；平板時 inc = 0，所有數值與原本相同
  const inc = floor ? 0 : rad(P.incline || 0), ci = Math.cos(inc), si = Math.sin(inc);
  const rot = (v) => [v[0], v[1] * ci - v[2] * si, v[1] * si + v[2] * ci];
  const baseU = floor ? norm([0, 0.005, -0.5]) : rot(norm(sub([0, 0.53, 0], [0, 0.5, 0.5])));
  const arch = benchArch(P), ac = Math.cos(arch.a / 4), as = Math.sin(arch.a / 4);
  const u = arch.a ? [0, baseU[1] * ac + baseU[2] * as, -baseU[1] * as + baseU[2] * ac] : baseU;
  pose.girdle = { ret: rad(lerp(-8, 25, P.scap ?? 0.8)), elev: rad(-6) };
  const dl = shoulderLocal(pose.girdle);
  // 軀幹整體平移，讓肩關節停在臥推架的固定位置（拱背幅度不變）；上斜時肩膀跟著椅背升高
  // 地板：肩關節中心離地約 9 cm（肩胛＋背部軟組織厚度）
  const Sy0 = floor ? 0.09 : 0.53 + 0.45 * si;
  const Sy = Sy0 + arch.shoulderLift;
  const t0 = trunkFrame([0, 0.5, 0.5], u);
  const S0 = toWorld(t0, dl);
  const tf = trunkFrame(add([0, 0.5, 0.5], [0, Sy - S0[1], -S0[2]]), u);
  const supportTf = arch.a ? (() => {
    const b0 = trunkFrame([0, 0.5, 0.5], baseU), bs = toWorld(b0, dl);
    return trunkFrame(add([0, 0.5, 0.5], [0, Sy0 - bs[1], -bs[2]]), baseU);
  })() : tf;
  Object.assign(pose, tf);
  const S = toWorld(tf, dl);
  const g = 0.2 * P.grip;
  // 觸胸點：以肩膀為原點，沿身體長軸 zt、離胸面高 h，再跟著椅背轉
  const h = 0.125 + 0.03 * Math.sin(Math.PI * P.touch) + 0.015;
  // 上斜時「下胸」離肩膀太遠、前臂無法垂直，觸胸範圍隨角度往上胸收（45° 時最低到 9 cm）
  const [, dyT, zBase] = rot([0, h, lerp(0.03, lerp(0.17, 0.09, Math.min(1, inc / rad(45))), P.touch)]);
  const zt = zBase - arch.chestBack;
  const yBot = Sy + dyT + arch.chestLift;
  if (arch.a) pose.chestArch = { touch: [0, yBot, zt], lift: arch.chestLift };
  // 鎖死點：手臂在肩膀正上方（重力方向），主導決定往觸胸點方向偏多少
  const zLock = lerp(0.0, zt, P.dom);
  const R = 0.985 * (BODY.Lu + BODY.Lf);
  const yTop = Sy + Math.sqrt(Math.max(0.05, R * R - (g - S[0]) ** 2 - zLock ** 2));
  const a = rad(P.flare);
  const manualPole = norm(rot([Math.sin(a), -0.25, Math.cos(a)]));
  const pole = P.flareMode === 'vertical' ? benchVerticalPole(S, [g, yBot, zt], rot) : manualPole;
  const barAt = (t) => [g, lerp(yTop, yBot, t), lerp(zLock, zt, Math.pow(t, 0.7))];
  let eE = e;
  if (floor) {
    // 上臂碰地：肘關節中心離地約 4.5 cm；整個行程縮到碰地那一點
    const elbY = (t) => ik2(S, barAt(t), BODY.Lu, BODY.Lf, pole).mid[1];
    const eStop = elbY(1) >= 0.045 ? 1 : bisect((t) => 0.045 - elbY(t), 0, 1);
    eE = e * eStop;
  }
  const [, y, z] = barAt(eE);
  armChain(pose, S, [g, y, z], pole);
  pose.bar = [0, y, z];
  // 腿：靜態
  const toe = [0, 0, 1];
  if (floor) {
    // 屈膝、腳掌平貼地面
    const hip = add(supportTf.Pc, [BODY.hipHalf, 0, 0]);
    legChain(pose, [0.2, BODY.ankleH, hip[2] + 0.56], toe, hip);
    pose.R.knee = ik2(hip, pose.R.ankle, BODY.Lt, BODY.Ls, [0, 1, 0]).mid;
    pose.floor = true;
  } else {
    legChain(pose, [0.25, BODY.ankleH, 1.0], toe, add(supportTf.Pc, [BODY.hipHalf, 0, 0]));
    const leg = ik2(pose.R.hip, pose.R.ankle, BODY.Lt, BODY.Ls, [0, 1, 0.3]);
    pose.R.knee = leg.mid;
    pose.R.toe = [0.27, 0.02, 1.17]; pose.R.heel = [0.25, 0.02, 0.95];
    pose.bench = { incline: inc, Pc: supportTf.Pc, u: baseU, f: supportTf.f };
  }
  pose.barW = BAR_RATIO.bench;
  const fore = sub(pose.R.hand, pose.R.elbow);
  const tilt = deg(Math.acos(clamp(fore[1] / len(fore), -1, 1)));
  if (e > 0.6 && tilt > 28) pose.warn.push('前臂偏離垂直 ' + Math.round(tilt) + '°');
  return pose;
}

// ---------- 臀推／臀橋：上背靠在支撐上（第二個接觸點）----------
// 臥推椅：支點在肩胛骨下角（0.38 m）；地板臀橋：肩膀貼地（0.50 m），避免肩與頭穿入地板
// 地板接觸區段（解剖估計）：上胸椎自然後凸貼地長 floorFlat = 0.16 m、背部軟組織／地墊壓縮量 floorPad = 0.04 m、腰段貼地過渡寬度 floorBlend = 0.03 m
const HT = { sc: 0.38, scFloor: 0.50, floorFlat: 0.16, floorPad: 0.04, floorBlend: 0.03, tb: 0.09, bench: 0.42, w: 0.16 };
function hipThrustPose(P, e) {
  const floor = P.surface === 'floor';
  const hb = floor ? 0 : HT.bench;
  const sc = floor ? HT.scFloor : HT.sc;
  const C = [0, hb, 0];
  const w = HT.w, tau = rad(10);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  // 平面有效長度（扣掉髖寬與站距的左右差）
  const kx = lerp(w, BODY.hipHalf, BODY.Ls / (BODY.Ls + BODY.Lt));
  const Ls = Math.sqrt(BODY.Ls ** 2 - (w - kx) ** 2), Lt = Math.sqrt(BODY.Lt ** 2 - (kx - BODY.hipHalf) ** 2);
  // psi：軀幹傾角（0 = 水平；正 = 骨盆低於肩膀）。軀幹以背部接觸點為支點轉動
  const frame = (psi) => {
    const u = [0, Math.sin(psi), -Math.cos(psi)];
    const tf0 = trunkFrame([0, 0, 0], u);
    const Pc = add(sub(C, mul(u, sc)), mul(tf0.f, HT.tb));
    return trunkFrame(Pc, u);
  };
  // 頂點：大腿相對軀幹伸展 lockout、膝屈曲 kneeTop，腳踩到地面 → 解出 psi
  const x = rad(P.lockout), kf = rad(P.kneeTop);
  const topAnkle = (psi) => {
    const tf = frame(psi);
    const hip = [BODY.hipHalf, tf.Pc[1], tf.Pc[2]];
    const tt = -psi - x, ts = tt - kf;
    const knee = [kx, hip[1] + Lt * Math.sin(tt), hip[2] + Lt * Math.cos(tt)];
    return [w, knee[1] + Ls * Math.sin(ts), knee[2] + Ls * Math.cos(ts)];
  };
  const psiTop = bisect((psi) => BODY.ankleH - topAnkle(psi)[1], rad(-50), rad(50));
  const A = topAnkle(psiTop);
  A[1] = BODY.ankleH;
  // 臀部最低點（骨盆後下緣）不能低於地面；標準槓片半徑 0.225 m，槓中心不能低於 0.225 m
  const PLATE_R = 0.225;
  const buttY = (psi) => { const tf = frame(psi); return add(add(tf.Pc, mul(tf.f, -0.1)), mul(tf.u, -0.06))[1]; };
  const barYOf = (psi) => {
    const tf = frame(psi);
    const bd = psi < 0 ? [0, 1, 0] : tf.f;
    return add(add(tf.Pc, mul(bd, 0.16)), mul(tf.u, -0.04))[1];
  };
  let psiBot = psiTop + rad(lerp(25, 55, P.depth));
  let hitFloor = false, hitPlates = false;
  if (buttY(psiBot) < 0.03) { psiBot = bisect((psi) => 0.03 - buttY(psi), psiTop, psiBot); hitFloor = true; }
  if (barYOf(psiBot) < PLATE_R) {
    psiBot = barYOf(psiTop) <= PLATE_R ? psiTop : bisect((psi) => PLATE_R - barYOf(psi), psiTop, psiBot);
    hitPlates = true;
  }
  const psi = lerp(psiTop, psiBot, e);
  const tf = frame(psi);
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = psi;
  const hip = [BODY.hipHalf, tf.Pc[1], tf.Pc[2]];
  // 修正膝關節極向量：不讓 legChain 的水平 toe 覆蓋 leg.mid（先前會導致臀橋底部膝蓋內扣越過中線）
  const leg = ik2(hip, A, BODY.Lt, BODY.Ls, [0.06, 1, 0.4]);
  if (!leg.ok) { pose.ok = false; pose.conflict = '腳的位置太遠，腿伸直也碰不到'; }
  legChain(pose, A, toe, hip);
  pose.R.knee = leg.mid;
  pose.girdle = { ret: rad(10), elev: rad(-4) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  // 槓壓在髖前方褶皺處（骨盆前緣／大腿根部）；psi < 0（臀橋骨盆高於肩）時由雙手扶住維持在髖前，不往腹部滑落
  const barDir = psi < 0 ? [0, 1, 0] : tf.f;
  const front = add(add(tf.Pc, mul(barDir, 0.115)), mul(tf.u, -0.04));
  pose.barPt = front;
  pose.bar = add(front, mul(barDir, 0.045));
  armChain(pose, S, [0.3, pose.bar[1], pose.bar[2]], norm(add([1, 0, 0], mul(tf.f, -0.6))));
  pose.barW = floor ? BAR_RATIO.glutebridge : BAR_RATIO.hipthrust;
  if (floor) {
    // 地板臀橋：上背從肩線延伸至胸椎離地邊緣（sLift）平貼地板，隨骨盆放低以軟最小（soft-min，寬度 floorBlend = 0.03 m）平滑趨近 L5，避免硬夾截造成腰椎力矩斜率折點
    const sTh = sc - HT.floorFlat;
    const sLiftRaw = sTh - HT.floorPad / Math.max(0.02, -Math.sin(psi));
    const L5z = add(tf.Pc, mul(tf.u, 0.05))[2];
    const rawZ = add(add(tf.Pc, mul(tf.u, sLiftRaw)), mul(tf.f, -HT.tb))[2];
    const cLiftZ = Math.max(C[2], 0.5 * (L5z + rawZ - Math.hypot(L5z - rawZ, HT.floorBlend)));
    pose.contact = { p: [0.12, 0, cLiftZ], n: [0, 1, 0], floorSpan: [C[2], cLiftZ] };
  } else {
    pose.contact = { p: add(C, [0.12, 0, 0]), n: tf.f };
    pose.boxes = [{ c: [0, hb / 2, -0.24], s: [0.42, hb, 0.5] }];
  }
  // 臀橋：軀幹往頭端下斜，頭要點頭才能貼地（約讓頭回到水平再多收下巴 10°）
  if (floor) pose.neckFlex = Math.max(0, -psi) + rad(10);
  if (hitPlates && e > 0.9) pose.warn.push('槓片碰到地面，行程已到底');
  else if (hitFloor && !floor && e > 0.9) pose.warn.push('臀部碰到地面，行程已到底');
  return pose;
}

function barOnPelvisLoads(pose, P, W, out) {
  // region 'pelvis'：骨盆承受，不計入髖（腿側）也不計入下背（上半身側）的力矩
  out.push({ p: [BODY.hipHalf * 0.5, pose.barPt[1], pose.barPt[2]], F: [0, -(pose.barW * W) / 2, 0], region: 'pelvis' });
}

// 兩個接觸點：上背（椅墊，有摩擦）＋腳底（壓力中心由「用力點」決定）
// 未知數：背部力（2）、腳底力（2）；平衡方程 3 條 → 假設腳底不出水平力（不會往前／往後滑），
// 水平力由背部摩擦承擔；超出摩擦錐（μ = 0.5）時，背部力停在摩擦錐邊緣，其餘由腳底摩擦補
const BACK_MU = 0.5;
function twoContactReactions(pose, P, W, out) {
  const R = pose.R, fy = pose.floorY || 0;
  // 腳跟：壓力中心最遠在踝關節後方 2 cm（腳跟著地面的中心）；前腳掌：腳尖往回 5 cm
  const cz = lerp(R.ankle[2] - 0.02, R.toe[2] - 0.05, P.push ?? 0.3);
  const cop = [R.ankle[0], fy, cz];
  if (pose.contact.floorSpan) {
    // 地板臀橋為連續平面支撐：貼於地板之上背與雙臂重力由接觸區段正下方地板直接承載，其餘橋式反力集中於離地前緣
    const [zMin, zMax] = pose.contact.floorSpan;
    let uFy = 0, uMz = 0;
    for (const f of out) {
      if (f.region === 'trunk' || f.region === 'upper' || f.region === 'fore') {
        uFy += f.F[1]; uMz += f.p[2] * f.F[1];
      }
    }
    if (uFy < -1e-6) {
      out.push({ p: [0.12, fy, clamp(uMz / uFy, zMin, zMax)], F: [0, -uFy, 0], region: 'trunk' });
    }
  }
  let Fy = 0, Fz = 0, M = 0; // M：繞 x 軸、對壓力中心的力矩
  for (const f of out) {
    Fy += f.F[1]; Fz += f.F[2];
    M += (f.p[1] - cop[1]) * f.F[2] - (f.p[2] - cop[2]) * f.F[1];
  }
  const { p: C, n, mu = BACK_MU, bilateral = false } = pose.contact;
  const ay = C[1] - cop[1], az = C[2] - cop[2];
  // 先試腳底沒有水平力：背部 Bz = -Fz，力矩方程解 By
  let Fb = [0, Math.abs(az) < 1e-6 ? 0 : (M - ay * Fz) / az, -Fz];
  const t = [0, -n[2], n[1]]; // 背部切線方向
  const bn = dot(Fb, n), bt = dot(Fb, t);
  if ((bn < 0 && !bilateral) || Math.abs(bt) > mu * Math.abs(bn) + 1e-9) {
    // 超出摩擦錐：接觸力方向固定在錐邊緣，大小由力矩方程決定（bilateral：導軌可推可拉）
    const d = norm(add(n, mul(t, Math.sign(bt || 1) * Math.sign(bn || 1) * mu)));
    const k = ay * d[2] - az * d[1];
    let N = Math.abs(k) < 1e-6 ? 0 : -M / k;
    if (N < 0 && !bilateral) { pose.warn.push('上背沒有壓在支撐上（重心太靠腳）'); N = 0; }
    Fb = mul(d, N);
  }
  const G = [0, -(Fy + Fb[1]), -(Fz + Fb[2])];
  if (pose.contact.rail && Math.abs(Fb[2]) > 0.06 * W) {
    const pct = Math.round((Math.abs(Fb[2]) / W) * 100);
    pose.warn.push(Fb[2] > 0 ? `身體往後靠在槓上：滑軌往前撐住約 ${pct}% 體重的力` : `身體往前壓槓：滑軌往後擋住約 ${pct}% 體重的力`);
  }
  if (G[1] < 0) pose.warn.push('腳會離地');
  else if (Math.abs(G[2]) > 0.7 * G[1]) pose.warn.push('腳底需要很大摩擦力，容易滑動');
  // 額狀面：地面反作用力通過髖關節（同站姿動作）
  const hip = R.hip;
  G[0] = ((hip[0] - cop[0]) / Math.max(0.3, hip[1] - fy)) * G[1];
  if (P.kneesOut > 0) G[0] -= P.kneesOut * 0.1 * W;
  out.push({ p: C, F: Fb, region: 'trunk' });
  out.push({ p: cop, F: G, region: 'foot' });
  pose.cop = cop;
  pose.lineZ = cop[2];
  pose.support = { N: Fb, G };
}

// ================= 器械與滑輪 =================
// 阻力的種類：自由重量（重力，方向固定）、滑輪（朝向滑輪，大小固定）、導軌（只能沿軌道方向，垂直方向由機器承受）、
// 槓桿／凸輪（繞機器轉軸的力矩隨角度改變）。坐在器械上的動作，椅墊／靠墊承受身體，不算地面反作用力。

// 同一根剛體握把的兩手可沿槓軸互推／互拉；取肩與肘力矩平方和最小的橫向力。
function minimizeAxialMoment(pose, F, limit) {
  let ab = 0, bb = 0;
  for (const J of [pose.R.shoulder, pose.R.elbow]) {
    const r = sub(pose.R.hand, J), a = cross(r, F), b = cross(r, [1, 0, 0]);
    ab += dot(a, b); bb += dot(b, b);
  }
  F[0] += clamp(-ab / (bb || 1), -limit, limit);
}

// 滑輪：手上的力 = 配重 × 方向（槓中心 → 滑輪）；ext = 外力（站姿時影響壓力中心與腳底摩擦）
// dualCable：雙側獨立滑輪（如滑輪夾胸），兩手各握獨立把手、各向同側滑輪拉，不套用剛體握把互推
function cableLoads(pose, P, W, out) {
  const T = (pose.barW * W) / 2;
  if (pose.dualCable) {
    const d = norm(sub(pose.pulley, pose.R.hand));
    const F = mul(d, T);
    out.push({ p: pose.R.hand, F, region: 'fore', ext: true });
    pose.forceLine = { p: pose.R.hand, d, is3d: true };
    return;
  }
  const d = norm(sub(pose.pulley, [0, pose.bar[1], pose.bar[2]]));
  const F = mul(d, T);
  minimizeAxialMoment(pose, F, 0.5 * T);
  out.push({ p: pose.R.hand, F, region: 'fore', ext: true });
  // 視覺力線畫在鋼索線上（x = 0，通過握把中心）；力臂分析只看矢狀面 yz，與手位置一致
  pose.forceLine = { p: pose.bar, d };
}
// 機器沿固定方向推回來（胸推機、腿推機）：pose.push = { p, d, region, k }
function pushLoads(pose, P, W, out) {
  const { p, d, region } = pose.push;
  const F = (pose.barW * W * (pose.push.k ?? 1)) / 2;
  out.push({ p, F: mul(d, -F), region, ext: true });
  pose.forceLine = { p, d };
}
// 槓桿＋凸輪：繞關節的阻力力矩 τ(角度)，由墊子垂直壓在肢段上（pose.pad = { p, dir, arm, tau, region }）
function padLoads(pose, P, W, out) {
  const { p, dir, arm, tau, region, is3d } = pose.pad;
  out.push({ p, F: mul(dir, (tau * W) / arm), region });
  pose.forceLine = { p, d: dir, is3d };
}
// 凸輪阻力曲線內插：以膝屈角度（°；0°＝伸直）查表內插相對阻力力矩
function interpTable(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1], [x1, y1] = table[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return table[table.length - 1][1];
}
function camFactor(mode, cam, kfDeg, horiz) {
  if (cam === 'gravity') return horiz;
  const M = mode === 'ext' ? MACHINES.legext : MACHINES.legcurl;
  const alias = cam === 'asc' ? 'comm_asc' : cam === 'desc' ? (mode === 'ext' ? 'comm_desc' : 'human') : cam;
  const table = M.cams[alias] || M.cams.flat;
  return interpTable(table, kfDeg);
}
const box = (c, s, rx = 0, mat = 'pad') => ({ c, s, rx, mat });
// 沿方向 d（矢狀面）的長方體：局部 y 軸轉到 d
const boxAlong = (c, d, s, mat) => box(c, s, Math.atan2(d[2], d[1]), mat);
// 手扶握把（坐姿器械）
function restHands(pose, S, H) {
  armChain(pose, S, H, norm([0.6, -1, -0.3]));
}

// ---------- 史密斯深蹲 ----------
// 槓在滑軌上（0° 垂直或 ±7° 傾斜）：槓受滑軌約束，重心不必在腳掌正上方；滑軌承受垂直於軌道的法向反作用力
function smithPose(P, e) {
  const M = MACHINES.smith;
  const w = 0.16, tau = rad(10);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const railDeg = Number(P.railAngle ?? M.railDegDefault) || 0;
  const a = rad(railDeg);
  // 正角度（+7°）：滑軌往上往後傾（dir = [0, cos a, -sin a]）；法向量 n = [0, sin a, cos a]
  const railDir = [0, Math.cos(a), -Math.sin(a)];
  const railN = [0, Math.sin(a), Math.cos(a)];
  const railZAt = (y) => M.railZ0 - (y - M.railRefY) * Math.tan(a);
  const flatA = [w, BODY.ankleH, M.railZ0 - 0.07 + P.feetFwd];
  const foot = squatHeelFoot(P, flatA, toe), A = foot?.ankle || flatA;
  const kap = rad(lerp(4, lerp(70, 125, P.depth), e));
  const phi = rad(lerp(3, P.torso, e));
  const u = [0, Math.cos(phi), Math.sin(phi)];
  const legs = fixedKneeLegs(A, w, kap);
  const Lb = 0.53, ob = 0.05;
  const build = (th) => {
    const { knee, hip } = legs(th);
    const tf = trunkFrame([0, hip[1], hip[2]], u);
    return { knee, hip, tf, bar: add(add(tf.Pc, mul(u, Lb)), mul(tf.f, -ob)) };
  };
  const th = bisect((t) => { const b = build(t).bar; return b[2] - railZAt(b[1]); }, rad(-45), rad(60));
  const r = build(th);
  const pose = { R: {}, warn: [], ok: true };
  if (Math.abs(r.bar[2] - railZAt(r.bar[1])) > 0.01) { pose.ok = false; pose.conflict = '這個軀幹角度和腳的位置，槓無法停在滑軌上'; }
  Object.assign(pose, r.tf);
  pose.phi = phi;
  legChain(pose, A, toe, r.hip);
  applySquatHeel(pose, foot);
  pose.R.knee = r.knee;
  pose.girdle = { ret: rad(15), elev: 0 };
  const S = toWorld(r.tf, shoulderLocal(pose.girdle));
  armChainBent(pose, S, [0.34, r.bar[1], r.bar[2]], norm(add(mul(r.tf.f, -1), [0, -1, 0])), SQ_WRIST.high, [0, 1, 0]);
  pose.bar = r.bar;
  pose.barW = M.platesRatio + M.startingKg / BODY.mass;
  pose.barOnBack = true;
  pose.contact = { p: [BODY.hipHalf * 0.5, r.bar[1], r.bar[2]], n: railN, mu: M.railMu, bilateral: true, rail: true };
  // 標準槓穿過兩側滑軌（x = ±0.70），外側掛標準槓片（x = ±0.78、±0.84）
  const zBot = railZAt(0.025), zTop = railZAt(M.railHeight);
  const yMid = (0.025 + M.railHeight) / 2, zMid = (zBot + zTop) / 2;
  const railLen = (M.railHeight - 0.025) / Math.cos(a);
  pose.boxes = [
    ...(pose.boxes || []),
    ...[-1, 1].flatMap((sx) => [
      boxAlong([sx * M.railHalfSpan, yMid, zMid], railDir, [0.045, railLen, 0.045], 'glass'),
      boxAlong([sx * M.railHalfSpan, r.bar[1], r.bar[2]], railDir, [0.075, 0.14, 0.075], 'frame'), // 滑套軸承
      box([sx * M.railHalfSpan, 0.025, zBot], [0.09, 0.05, 0.75], 0, 'frame'), // 底座腳
    ]),
    box([0, M.railHeight, zTop], [2 * M.railHalfSpan + 0.06, 0.055, 0.055], 0, 'glass'), // 頂部橫樑
  ];
  const shin = deg(th);
  if (shin < -12) pose.warn.push('小腿往後傾 ' + Math.round(-shin) + '°：腳放得很前面，膝關節剪力方向改變');
  return pose;
}

// ---------- 45° 腿推機 ----------
function legPressPose(P, e) {
  const M = MACHINES.legpress;
  const a = rad(M.railDeg), d = [0, Math.sin(a), Math.cos(a)], t = [0, Math.cos(a), -Math.sin(a)];
  const recl = rad(P.seat);
  const u = [0, Math.cos(recl), -Math.sin(recl)];
  const tf = trunkFrame([0, M.hipY, 0], u);
  const hip = [BODY.hipHalf, M.hipY, 0];
  const w = lerp(0.12, 0.3, P.stance);
  const off = lerp(-0.06, 0.24, P.footHigh);
  const at = (s) => { const Q = add(add([w, hip[1], hip[2]], mul(d, s)), mul(t, off)); return { Q, A: sub(Q, mul(d, BODY.ankleH)) }; };
  const Dk = (kf) => Math.sqrt(BODY.Lt ** 2 + BODY.Ls ** 2 + 2 * BODY.Lt * BODY.Ls * Math.cos(kf));
  const kf = rad(lerp(10, lerp(75, 125, P.depth), e));
  const s = bisect((x) => len(sub(at(x).A, hip)) - Dk(kf), 0.05, 1.3);
  const { Q, A } = at(s);
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = -recl;
  pose.R.hip = hip; pose.R.ankle = A;
  const leg = ik2(hip, A, BODY.Lt, BODY.Ls, [0, 0.7, -0.7]);
  pose.R.knee = leg.mid;
  if (!leg.ok) { pose.ok = false; pose.conflict = '腳踩的位置太近或太遠'; }
  pose.toeDir = t; pose.footUp = neg(d); pose.hinge = [1, 0, 0];
  pose.R.heel = add(Q, mul(t, -0.06)); pose.R.toe = add(Q, mul(t, 0.19));
  pose.girdle = { ret: rad(5), elev: rad(-3) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  const gripPt = [0.29, hip[1] - 0.02, hip[2] + 0.12];
  restHands(pose, S, gripPt);
  pose.R.grip = gripPt;
  pose.bar = [0, hip[1], hip[2]];
  pose.barStyle = 'none';
  const sledKg = P.sledKg ?? M.sledKgDefault;
  const mu = P.friction ?? M.railMuDefault;
  pose.barW = M.platesRatio + sledKg / BODY.mass;
  // 腳底壓力中心沿踏板：腳跟 ↔ 前腳掌；滑台沿 45° 軌道方向出力（預設 μ = 0 為準靜態參考；設定 μ 時代表向心上限 sinθ + μcosθ，離心為 sinθ − μcosθ）
  pose.push = { p: add(Q, mul(t, lerp(-0.03, 0.14, P.push))), d, region: 'foot', k: Math.sin(a) + mu * Math.cos(a) };
  pose.armJoints = ['hip', 'knee', 'ankle'];
  // 椅背與座墊、底座機架、兩側握把、45° 雙導軌與滑台（導軌直接穿過滑台軸套）
  const backC = add(add(tf.Pc, mul(u, 0.34)), mul(tf.f, -0.13));
  const seatTopY = M.hipY - 0.08;
  const plateC = add([0, Q[1], Q[2]], mul(d, 0.024));
  // 導軌中心線：與滑台（踏板中段後方）同軸，從接近地面一路斜上 45° 到前立柱頂端
  const sledCenterT = dot(add([0, hip[1], hip[2]], mul(t, 0.09)), t);
  const railLineAt = (sd) => add(mul(d, sd), mul(t, sledCenterT));
  const sMin = (0.07 - sledCenterT * t[1]) / d[1];
  const sMax = Math.max(sMin + 1.85, dot(plateC, d) + 0.45);
  const railMid = railLineAt((sMin + sMax) / 2);
  const railLen = sMax - sMin;
  const frontTop = railLineAt(sMax - 0.1);
  const sledS = dot(plateC, d) + 0.12;
  const sledRailPt = railLineAt(sledS);
  // 椅背支撐立柱：頂端貼齊斜板背面下緣，不穿透椅背
  const bpZ = backC[2] - 0.05;
  const bpH = Math.max(0.08, backC[1] + (-0.035 - (bpZ - 0.045 - backC[2]) * tf.f[2]) / Math.max(0.25, tf.f[1]));
  pose.boxes = [
    // 座墊與椅背（下緣相接）
    box([0, seatTopY - 0.04, 0.04], [0.46, 0.08, 0.42]),
    boxAlong(backC, u, [0.46, 0.78, 0.07]),
    // 座椅與機台底座支架（落地）
    box([0, (seatTopY - 0.08) / 2, 0.04], [0.28, seatTopY - 0.08, 0.28], 0, 'frame'),
    box([0, bpH / 2, bpZ], [0.14, bpH, 0.09], 0, 'frame'),
    box([0, 0.025, (bpZ + frontTop[2]) / 2], [0.88, 0.05, Math.abs(frontTop[2] - bpZ) + 0.2], 0, 'frame'),
    // 兩側握把＋支架（手握在橫桿上）
    ...[-1, 1].flatMap((sx) => [
      box([sx * 0.29, gripPt[1], gripPt[2]], [0.12, 0.032, 0.032], 0, 'frame'),
      box([sx * 0.25, (gripPt[1] + 0.05) / 2, gripPt[2]], [0.03, gripPt[1] - 0.05, 0.03], 0, 'frame'),
    ]),
    // 45° 雙側導軌、前立柱與滑台軸套（精準套在導軌上）
    ...[-1, 1].flatMap((sx) => [
      boxAlong([sx * 0.41, railMid[1], railMid[2]], d, [0.045, railLen, 0.045], 'glass'),
      box([sx * 0.41, frontTop[1] / 2, frontTop[2]], [0.055, frontTop[1], 0.055], 0, 'glass'),
      boxAlong([sx * 0.41, sledRailPt[1], sledRailPt[2]], d, [0.075, 0.32, 0.075], 'frame'), // 滑台軸套
      boxAlong([sx * 0.36, (plateC[1] + sledRailPt[1]) / 2, (plateC[2] + sledRailPt[2]) / 2], d, [0.04, 0.14, 0.06], 'frame'), // 踏板→軸套連桿
    ]),
    box([0, frontTop[1], frontTop[2]], [0.86, 0.055, 0.055], 0, 'glass'),
    // 踏板（近面留 6 mm 淨空，避免腳趾穿入）與滑台橫樑
    boxAlong(plateC, d, [0.74, 0.036, 0.56], 'frame'),
    boxAlong(sledRailPt, d, [0.84, 0.06, 0.08], 'frame'),
  ];
  return pose;
}

// ---------- 坐姿器械共用：骨盆在椅墊上、軀幹角 lean（正 = 前傾、負 = 後仰），腳踩地 ----------
function seatedBase(lean, seatY = 0.47, ankleZ = 0.5) {
  const u = [0, Math.cos(lean), Math.sin(lean)];
  const tf = trunkFrame([0, seatY, 0], u);
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = lean;
  legChain(pose, [0.15, BODY.ankleH, ankleZ], [0, 0, 1], [BODY.hipHalf, seatY, 0]);
  pose.R.knee = ik2(pose.R.hip, pose.R.ankle, BODY.Lt, BODY.Ls, [0, 1, 0.3]).mid;
  return pose;
}

// ---------- 滑輪下拉 ----------
function pulldownPose(P, e) {
  const M = MACHINES.pulldown;
  const lean = -rad(P.lean);
  const pose = seatedBase(lean, M.seatY);
  const tf = pose;
  pose.girdle = { ret: rad(lerp(-5, lerp(0, 20, P.scap), e)), elev: rad(lerp(18, lerp(2, -10, P.scap), e)) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  const gx = 0.2 * P.grip, Rl = 0.99 * (BODY.Lu + BODY.Lf), dx = gx - S[0];
  const top = [gx, S[1] + Math.sqrt(Math.max(0.01, Rl * Rl - dx * dx - 0.0025)), S[2] + 0.05];
  const bot = add(add(tf.Pc, mul(tf.u, lerp(0.6, 0.45, P.pullTo))), mul(tf.f, lerp(0.13, 0.17, P.pullTo)));
  bot[0] = gx;
  const bar = lerpV(top, bot, e);
  // 槓經過臉時要在臉前方
  const head = add(tf.SC, mul(tf.u, 0.2));
  if (Math.abs(bar[1] - head[1]) < 0.14) bar[2] = Math.max(bar[2], head[2] + 0.13);
  // 反握時手肘沿身體前側下拉，屈肘平面較接近矢狀面；正握保留向外開的路徑。
  // 這是握法與上臂平面連動的解剖推論，文獻量到肌電差異，未提供手肘軌跡角度。
  const pole = P.supin === 'sup'
    ? norm(add(add(tf.lat, tf.f), mul(tf.u, -0.4)))
    : norm(add(add(tf.lat, mul(tf.u, -0.4)), mul(tf.f, -0.15)));
  const ok = armChain(pose, S, bar, pole);
  if (!ok && e > 0.15) { pose.ok = false; pose.conflict = '手臂長度無法把槓拉到這個位置'; }
  pose.bar = [0, bar[1], bar[2]];
  const div = pulleyDivisor(P.pulleyRatio ?? M.pulleyRatioDefault);
  pose.barW = M.stackKg / (div * BODY.mass);
  pose.barStyle = { len: M.barLen };
  pose.supinated = P.supin === 'sup';
  pose.pulley = [0, M.pulleyY, top[2]];
  pose.armJoints = ['shoulder', 'elbow', 'lumbar'];
  // 人面向配重塔坐：塔在膝蓋前方，座墊與壓腿墊皆經支架連到底座與塔
  const towerZ = M.towerZ;
  const boomZ = (top[2] + towerZ) / 2;
  pose.boxes = [
    box([0, 0.4, 0.02], [0.42, 0.08, 0.42]), // 座墊
    box([0, 0.66, 0.34], [0.5, 0.08, 0.12]), // 大腿壓墊
    // 底座、座椅支柱、壓腿墊支撐（垂直落地＋橫桿接到塔）
    box([0, 0.025, 0.4], [0.1, 0.05, 1.05], 0, 'frame'),
    box([0, 0.025, 0.02], [0.52, 0.05, 0.08], 0, 'frame'),
    box([0, 0.025, towerZ], [0.52, 0.05, 0.12], 0, 'frame'),
    box([0, 0.205, 0.02], [0.09, 0.31, 0.09], 0, 'frame'),
    box([0, 0.34, 0.34], [0.05, 0.58, 0.05], 0, 'frame'), // 壓腿墊立柱（位於雙腿之間）
    box([0, 0.66, (0.34 + towerZ) / 2], [0.06, 0.05, towerZ - 0.34], 0, 'frame'), // 水平連桿接到塔
    box([0, 1.2, towerZ], [0.16, 2.4, 0.16], 0, 'glass'), // 配重塔
    box([0, M.pulleyY + 0.03, boomZ], [0.08, 0.07, Math.abs(towerZ - top[2]) + 0.16], 0, 'glass'), // 頂部滑輪懸臂
  ];
  pose.cables = [[pose.bar, pose.pulley], [pose.pulley, [0, M.pulleyY, towerZ]]];
  if (P.lean > 30) pose.warn.push('後仰 ' + Math.round(P.lean) + '°：拉的方向接近划船，下背參與增加');
  return pose;
}

// ---------- 坐姿滑輪划船 ----------
function cableRowPose(P, e) {
  const M = MACHINES.cablerow;
  const lean = rad(lerp(P.leanStart, P.leanEnd, e));
  const seatY = M.seatY;
  const u = [0, Math.cos(lean), Math.sin(lean)];
  const tf = trunkFrame([0, seatY, 0], u);
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, tf);
  pose.phi = lean;
  // 腳踩在前方的踏板上（腳掌朝前、腳尖朝上），膝微彎
  const A = [0.15, 0.32, 0.74];
  pose.R.hip = [BODY.hipHalf, seatY, 0]; pose.R.ankle = A;
  pose.R.knee = ik2(pose.R.hip, A, BODY.Lt, BODY.Ls, [0, 1, 0]).mid;
  pose.toeDir = [0, 1, 0]; pose.footUp = [0, 0, -1]; pose.hinge = [1, 0, 0];
  pose.R.heel = add(A, [0, -0.06, BODY.ankleH]); pose.R.toe = add(A, [0, 0.19, BODY.ankleH]);
  pose.girdle = { ret: rad(lerp(-18, lerp(0, 25, P.scap), e)), elev: rad(lerp(4, -4, e)) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  const v = P.grip === 'v', gx = v ? 0.07 : 0.3;
  pose.pulley = [0, M.pulleyY, M.pulleyZ];
  const Rl = 0.997 * (BODY.Lu + BODY.Lf);
  // 起點：手臂伸直、朝滑輪方向；終點：握把碰到腹部
  const dirP = norm([0, pose.pulley[1] - S[1], pose.pulley[2] - S[2]]);
  const reach = add(S, mul(dirP, Math.sqrt(Math.max(0.01, Rl * Rl - (gx - S[0]) ** 2))));
  reach[0] = gx;
  const touch = add(add(tf.Pc, mul(u, lerp(0.2, 0.34, P.pullTo))), mul(tf.f, 0.15));
  touch[0] = gx;
  const bar = lerpV(reach, touch, e);
  const fl = rad(v ? 15 : 55);
  const pole = norm(add(add(mul(tf.f, -Math.cos(fl)), mul(tf.lat, Math.sin(fl))), mul(tf.u, -0.3)));
  const ok = armChain(pose, S, bar, pole);
  if (!ok && e > 0.3) { pose.ok = false; pose.conflict = '手臂長度無法把握把拉到這個位置'; }
  pose.bar = [0, bar[1], bar[2]];
  const div = pulleyDivisor(P.pulleyRatio ?? M.pulleyRatioDefault);
  pose.barW = M.stackKg / (div * BODY.mass);
  pose.barStyle = { len: v ? M.barLen.v : M.barLen.wide };
  pose.armJoints = ['shoulder', 'elbow', 'lumbar'];
  // 座墊落地支架；腳踏板分左右兩片，中央留 16 cm 通道讓鋼索無阻礙通過
  pose.boxes = [
    box([0, 0.38, 0.05], [0.4, 0.1, 0.6]), // 座墊
    box([0, 0.025, 0.43], [0.12, 0.05, 1.32], 0, 'frame'), // 地面長底座
    box([0, 0.025, -0.15], [0.48, 0.05, 0.08], 0, 'frame'),
    box([0, 0.025, 1.06], [0.48, 0.05, 0.1], 0, 'frame'),
    box([0, 0.19, -0.12], [0.09, 0.28, 0.09], 0, 'frame'), // 座椅後腳
    box([0, 0.19, 0.24], [0.09, 0.28, 0.09], 0, 'frame'), // 座椅前腳
    ...[-1, 1].flatMap((sx) => [
      boxAlong([sx * 0.18, 0.32, 0.84], [0, 0, 1], [0.2, 0.04, 0.36], 'frame'), // 左右腳踏板
      box([sx * 0.18, 0.1, 0.86], [0.05, 0.15, 0.05], 0, 'frame'), // 踏板支撐腳
    ]),
    box([0, 0.075, 0.86], [0.4, 0.05, 0.06], 0, 'frame'), // 踏板橫樑（在鋼索下方）
    box([0, M.pulleyY, M.pulleyZ + 0.01], [0.08, 0.09, 0.09], 0, 'frame'), // 低滑輪座
    box([0, 0.45, M.pulleyZ + 0.08], [0.28, 0.9, 0.12], 0, 'glass'), // 滑輪塔
  ];
  pose.cables = [[pose.bar, pose.pulley]];
  if (deg(lean) < -15) pose.warn.push('收尾後仰 ' + Math.round(-deg(lean)) + '°：用身體甩，下背負擔增加');
  return pose;
}

// ---------- 滑輪三頭下壓（站姿）----------
function pushdownPose(P, e) {
  const M = MACHINES.pushdown;
  const div = pulleyDivisor(P.pulleyRatio ?? M.pulleyRatioDefault);
  const effBarW = M.stackKg / (div * BODY.mass);
  const gx = 0.12; // e = 0 伸直、1 手肘彎曲
  const as = rad(P.elbFwd), ef = rad(lerp(8, P.topFlex, e));
  // 滑輪把手往上推：重心要往前移才站得穩。真人是髖往後、軀幹再前傾（不是整個人從腳踝往前倒）：
  // 找出需要多前傾 extra，讓小腿維持接近垂直（前傾約 3°）
  const make = (extra) => standingHands(P, {
    kap: rad(8), lean: rad(P.lean) + extra, girdle: { ret: rad(0), elev: rad(-6) }, barW: 0,
    ext: (r) => mul(norm(sub([0, M.pulleyY, M.pulleyZ], [0, r.bar[1], r.bar[2]])), effBarW),
    pole: (tf, r) => sub(r.elbow, r.S),
    barAt: (tf, S) => {
      const ud = add(mul(tf.u, -Math.cos(as)), mul(tf.f, Math.sin(as)));
      const n = add(mul(tf.u, Math.sin(as)), mul(tf.f, Math.cos(as)));
      const E = add(S, mul(ud, BODY.Lu));
      const foreYZ = Math.sqrt(Math.max(0, BODY.Lf ** 2 - (gx - E[0]) ** 2)) - 0.001;
      const bar = add(E, mul(add(mul(ud, Math.cos(ef)), mul(n, Math.sin(ef))), foreYZ));
      bar[0] = gx;
      return { bar, elbow: E };
    },
  });
  const extra = P.footStance === 'staggered' ? 0 : bisect((x) => rad(3) - make(x).shinTilt, 0, rad(40), 16);
  const pose = make(extra);
  if (!pose.armOk) pose.warn.push('手臂無法達到此三頭下壓握把位置，請調整站位或握距');
  if (deg(extra) > 8) pose.warn.push('雙腳併站時模型已讓軀幹額外前傾約 ' + Math.round(deg(extra)) + '° 以平衡；可改用前後腳站姿');
  // 調整前臂視覺參考軸讓正握旋前角落在自然範圍內，五指包覆直槓
  pose.armPole = norm(add(sub(pose.R.elbow, pose.R.shoulder), [0.35, 0, -0.1]));
  pose.barAxial = false;
  pose.barW = effBarW;
  pose.barStyle = { len: M.barLen };
  pose.pulley = [0, M.pulleyY, M.pulleyZ];
  pose.armJoints = ['shoulder', 'elbow'];
  const colZ = M.pulleyZ + 0.18;
  pose.boxes = [
    box([0, 1.07, colZ], [0.16, 2.14, 0.16], 0, 'glass'), // 滑輪柱
    box([0, M.pulleyY + 0.02, (M.pulleyZ + colZ) / 2], [0.08, 0.06, colZ - M.pulleyZ + 0.08], 0, 'glass'), // 滑輪懸臂
    box([0, 0.025, colZ], [0.46, 0.05, 0.36], 0, 'frame'), // 底座
  ];
  pose.cables = [[pose.bar, pose.pulley]];
  if (P.elbFwd > 20) pose.warn.push('手肘往前 ' + Math.round(P.elbFwd) + '°：肩關節伸展（背闊肌）開始參與');
  return pose;
}

// ---------- 腿伸機／腿彎舉（槓桿＋凸輪）----------
function kneeMachinePose(P, e, mode) {
  const M = mode === 'ext' ? MACHINES.legext : MACHINES.legcurl;
  const lying = mode === 'curl' && P.posture === 'lying';
  const pose = { R: {}, warn: [], ok: true };
  let tf, thighDir;
  if (lying) {
    // 俯臥：頭朝 +z、臉朝下，大腿往 -z 水平
    tf = trunkFrame([0, M.lyingHipY, 0], [0, 0, 1]);
    thighDir = [0, -0.05, -1];
  } else {
    const hipY = mode === 'ext' ? M.seatY : M.seatedHipY;
    const recl = -rad(mode === 'ext' ? M.backReclineDeg : M.seatedBackReclineDeg);
    tf = trunkFrame([0, hipY, 0], [0, Math.cos(recl), Math.sin(recl)]);
    thighDir = [0, 0, 1];
  }
  Object.assign(pose, tf);
  pose.phi = 0;
  thighDir = norm(thighDir);
  const hip = [BODY.hipHalf, tf.Pc[1], tf.Pc[2]];
  const knee = add(add(hip, mul(thighDir, BODY.Lt * 0.995)), [0.03, 0, 0]);
  const fT = norm(cross(thighDir, [1, 0, 0])); // 大腿前方
  const kMax = rad(lerp(70, 115, P.depth)), kMin = rad(8);
  // ext：e = 0 伸直、1 彎曲；curl：e = 0 彎曲（收縮）、1 伸直
  const kf = mode === 'ext' ? lerp(kMin, kMax, e) : lerp(kMax, kMin, e);
  const sd = norm(add(mul(thighDir, Math.cos(kf)), mul(fT, -Math.sin(kf))));
  const A = add(knee, mul(sd, BODY.Ls));
  pose.R.hip = hip; pose.R.knee = knee; pose.R.ankle = A;
  pose.toeDir = norm(add(mul(fT, Math.cos(kf)), mul(thighDir, Math.sin(kf))));
  pose.footUp = neg(sd); pose.hinge = [1, 0, 0];
  pose.R.heel = add(A, mul(pose.toeDir, -0.06)); pose.R.toe = add(A, mul(pose.toeDir, 0.19));
  pose.girdle = { ret: rad(5), elev: rad(-3) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  const gripPt = lying ? [0.27, 0.35, 0.72] : [0.28, 0.48, 0.15];
  if (lying) armChain(pose, S, gripPt, norm([0.8, -0.4, -0.5]));
  else restHands(pose, S, gripPt);
  pose.R.grip = gripPt;
  pose.bar = [0, hip[1], hip[2]];
  pose.barStyle = 'none';
  pose.barW = M.barRatio;
  // 墊子在小腿前（ext）或後（curl），阻力把小腿往彎曲（ext）／伸直（curl）的方向推
  const flexDir = norm(add(mul(thighDir, -Math.sin(kf)), mul(fT, -Math.cos(kf))));
  const arm = lerp(0.6, 0.95, P.padPos) * BODY.Ls;
  const horiz = Math.hypot(sd[0], sd[2]);
  const cf = camFactor(mode, P.cam ?? M.camDefault, deg(kf), horiz);
  const tau = (M.camArmM * pose.barW * cf) / 2; // × 體重（N·m／N）
  const push = mode === 'ext' ? flexDir : neg(flexDir);
  const p = add(add(knee, mul(sd, arm)), mul(push, -M.padOffset));
  pose.pad = { p, dir: push, arm, tau, region: 'shank' };
  pose.armJoints = ['knee'];
  // 視覺滾輪墊：伸直時與脛骨前側保持淨空；槓桿臂放在腿外側（遠側 x = -0.27）且精準連接轉軸與滾輪墊
  const padOff = mode === 'ext' ? -0.055 : -0.04;
  const padC = add([0, p[1], p[2]], mul(push, padOff));
  const armX = -0.27;
  const pivPt = [armX, knee[1], knee[2]];
  const padEnd = [armX, padC[1], padC[2]];
  const leverVec = sub(padEnd, pivPt);
  const leverBox = boxAlong(lerpV(pivPt, padEnd, 0.5), norm(leverVec), [0.04, len(leverVec), 0.04], 'frame');
  const rollerBox = boxAlong([-0.02, padC[1], padC[2]], sd, [0.54, 0.075, 0.075], 'frame');
  const pivPost = box([armX, knee[1] / 2, knee[2]], [0.05, knee[1], 0.05], 0, 'frame');
  if (lying) {
    pose.boxes = [
      box([0, 0.5, 0.15], [0.42, 0.12, 1.1]), // 臥墊
      // 底座與前後支架（落地）
      box([0, 0.025, 0.15], [0.62, 0.05, 1.18], 0, 'frame'),
      box([0, 0.245, -0.28], [0.34, 0.39, 0.07], 0, 'frame'),
      box([0, 0.245, 0.62], [0.34, 0.39, 0.07], 0, 'frame'),
      // 前端兩側握把＋支架
      ...[-1, 1].flatMap((sx) => [
        box([sx * 0.27, gripPt[1], gripPt[2]], [0.12, 0.03, 0.03], 0, 'frame'),
        box([sx * 0.22, gripPt[1], (0.62 + gripPt[2]) / 2], [0.03, 0.03, gripPt[2] - 0.62 + 0.04], 0, 'frame'),
      ]),
      pivPost, leverBox, rollerBox,
    ];
  } else {
    const backC = add(add(tf.Pc, mul(tf.u, 0.31)), mul(tf.f, -0.13));
    const backPostTop = add(add(tf.Pc, mul(tf.u, 0.25)), mul(tf.f, -0.175));
    pose.boxes = [
      box([0, 0.43, 0.2], [0.45, 0.1, 0.5]), // 座墊
      boxAlong(backC, tf.u, [0.45, 0.72, 0.07]), // 椅背（下緣接座墊）
      // 底座、座椅與椅背支柱（落地，底座薄片不碰腳尖）
      box([0, 0.015, 0.12], [0.62, 0.03, 0.84], 0, 'frame'),
      box([0, 0.205, 0.2], [0.14, 0.35, 0.24], 0, 'frame'),
      box([0, backPostTop[1] / 2, backPostTop[2]], [0.1, backPostTop[1], 0.07], 0, 'frame'),
      // 兩側握把＋支架（手握在上面）
      ...[-1, 1].flatMap((sx) => [
        box([sx * 0.28, gripPt[1], gripPt[2]], [0.11, 0.03, 0.03], 0, 'frame'),
        box([sx * 0.24, (gripPt[1] + 0.38) / 2, gripPt[2]], [0.03, gripPt[1] - 0.38 + 0.04, 0.03], 0, 'frame'),
      ]),
      // 坐姿腿彎舉：大腿上方固定壓墊＋遠側支撐桿
      ...(mode === 'curl' ? [
        box([0, 0.69, 0.28], [0.48, 0.08, 0.1]),
        box([armX, 0.56, 0.28], [0.04, 0.28, 0.04], 0, 'frame'),
        box([armX, 0.42, (0.28 + knee[2]) / 2], [0.04, 0.04, Math.abs(knee[2] - 0.28) + 0.04], 0, 'frame'),
      ] : []),
      pivPost, leverBox, rollerBox,
    ];
  }
  return pose;
}
function legExtPose(P, e) { return kneeMachinePose(P, e, 'ext'); }
function legCurlPose(P, e) { return kneeMachinePose(P, e, 'curl'); }

// ---------- 坐姿胸推機 ----------
// 用臥推的手臂幾何（軀幹座標內相同），整個身體轉 90° 成坐姿；支援直線軌跡與內聚弧線
function chestPressPose(P, e) {
  const M = MACHINES.chestpress;
  const seatY = fittedSeatY(M.seatY);
  const conv = (P.path ?? M.pathDefault) === 'converging';
  const gripAt = (t) => (conv ? P.grip * lerp(M.convergeRatio, 1, t) : P.grip);
  const bPAt = (t) => ({ ...P, grip: gripAt(t), incline: 0, surface: 'bench', bend: 0, dom: 0.5 });
  const r = (v) => [v[0], -v[2], v[1]]; // 繞 x 轉 90°：躺 → 坐
  // 器械底部有機械止擋：手肘不往後穿透椅背前緣
  const elbZ = (t) => {
    const b = benchPose(bPAt(t), t);
    return r(b.R.elbow)[2] + (0 - r(b.Pc)[2]);
  };
  const eStop = elbZ(1) >= M.backFrontZ ? 1 : bisect((t) => M.backFrontZ - elbZ(t), 0, 1, 20);
  const tEff = e * eStop;
  const bp = benchPose(bPAt(tEff), tEff);
  const T = sub([0, seatY, 0], r(bp.Pc));
  const pt = (v) => add(r(v), T);
  const pose = { R: {}, warn: bp.warn.map((w) => w.replace('前臂偏離垂直', '前臂偏離推的方向')), ok: bp.ok, conflict: bp.conflict };
  for (const k of ['shoulder', 'elbow', 'hand']) pose.R[k] = pt(bp.R[k]);
  Object.assign(pose, trunkFrame(pt(bp.Pc), r(bp.u)));
  pose.phi = 0;
  pose.girdle = bp.girdle;
  pose.armPole = r(bp.armPole);
  pose.bar = pt(bp.bar);
  legChain(pose, [0.15, BODY.ankleH, 0.5], [0, 0, 1], [BODY.hipHalf, pose.Pc[1], pose.Pc[2]]);
  pose.R.knee = ik2(pose.R.hip, pose.R.ankle, BODY.Lt, BODY.Ls, [0, 1, 0.3]).mid;
  pose.barW = M.barRatio;
  const armX = conv ? pose.R.hand[0] + 0.06 : 0.2 * P.grip + 0.08;
  pose.barStyle = conv ? 'none' : { len: 2 * armX + 0.04 };
  let pushDir = pose.f;
  if (conv) {
    // 內聚弧線：推力沿手部從底部往頂點的內聚方向，使頂點仍保有向內收攏阻力
    const bp0 = benchPose(bPAt(0), 0), bp1 = benchPose(bPAt(eStop), eStop);
    const dVec = sub(r(bp0.R.hand), r(bp1.R.hand));
    pushDir = norm([dVec[0], 0, Math.max(0.05, dVec[2])]);
  }
  pose.push = { p: pose.R.hand, d: pushDir, region: 'fore' };
  pose.armJoints = ['shoulder', 'elbow'];
  // 座椅、椅背（相接落地）、後方機架轉軸與兩側機械臂連到握把
  const backZ = -0.155 * BODY.heightM / DEFAULT_BODY.heightM;
  const backC = add(add(pose.Pc, mul(pose.u, 0.34)), mul(pose.f, backZ));
  pose.machineAdjust = { seatY, backZ, handleY: pose.R.hand[1] };
  const colZ = M.colZ;
  const pivY = M.pivotY, pivZ = M.pivotZ;
  const barY = pose.bar[1], barZ = pose.bar[2];
  const armVec = [0, barY - pivY, barZ - pivZ];
  const armMid = [0, (pivY + barY) / 2, (pivZ + barZ) / 2];
  pose.boxes = [
    box([0, seatY - 0.12, 0.1], [0.44, 0.1, 0.44]), // 座墊
    boxAlong(backC, pose.u, [0.34, 0.84, 0.07]), // 椅背（寬 34 cm，下緣接座墊）
    // 底座與座椅／椅背支架（落地）
    box([0, 0.025, -0.08], [0.56, 0.05, 0.72], 0, 'frame'),
    box([0, (seatY - 0.12) / 2, 0.1], [0.12, seatY - 0.12, 0.18], 0, 'frame'),
    box([0, 0.36, -0.18], [0.1, 0.68, 0.07], 0, 'frame'),
    // 後方立柱＋上方轉軸懸臂（半透明不擋側面視線）
    box([0, 0.9, colZ], [0.14, 1.8, 0.14], 0, 'glass'),
    box([0, pivY + 0.04, (colZ + pivZ) / 2], [0.1, 0.07, pivZ - colZ + 0.1], 0, 'glass'),
    box([0, pivY, pivZ], [2 * armX + 0.08, 0.06, 0.06], 0, 'frame'), // 頂部轉軸橫桿
    // 兩側機械臂：從上方轉軸連到握把兩端（內聚模式另繪左右獨立握把）
    ...[-1, 1].flatMap((sx) => [
      boxAlong([sx * armX, armMid[1], armMid[2]], norm(armVec), [0.04, len(armVec), 0.04], 'frame'),
      ...(conv ? [box([sx * (pose.R.hand[0] - 0.01), barY, barZ], [0.14, 0.03, 0.03], 0, 'frame')] : []),
    ]),
  ];
  return pose;
}

// ---------- 蝴蝶機（夾胸機）----------
// 坐姿、機械臂繞位於肩關節正上方附近的垂直軸轉動；支援握把式（手臂微彎）與前臂墊式（屈肘 90°）
function pecDeckPose(P, e) {
  const M = MACHINES.pecdeck;
  const pad = (P.style ?? M.styleDefault) === 'pad';
  const seatOff = (P.seat ?? 0) / 100;
  const seatY = fittedSeatY(M.seatY0, seatOff);
  const handleR = fittedHandleR(M.handleR);
  const pose = seatedBase(0, seatY, 0.45);
  pose.girdle = { ret: rad(lerp(-6, 22, P.scap ?? 0.7)), elev: rad(-4) };
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  // 機械臂／握把維持在機台固定高度（對應預設座高時的肩高），調座椅即改變手臂相對肩的高度
  const refArmY = M.seatY0 + DEFAULT_BODY.Ltr - 0.015;
  const thTop = rad(pad ? -12 : -10);
  const thBot = rad(P.stretch ?? 85);
  const theta = lerp(thTop, thBot, e);
  const st = Math.sin(theta), ct = Math.cos(theta);
  const armDir = [st, 0, ct];
  const tanRes = [ct, 0, -st]; // 水平圓弧切線（阻力方向：反於內收、往外後方推）
  let loadPt, effArm, tipX, tipZ, padBoxMid = null;
  if (pad) {
    const dy = clamp(refArmY - S[1], -0.45 * BODY.Lu, 0.45 * BODY.Lu);
    const rh = Math.sqrt(Math.max(0.01, BODY.Lu * BODY.Lu - dy * dy));
    const E = [S[0] + rh * st, S[1] + dy, S[2] + rh * ct];
    const H = add(E, [0, BODY.Lf, 0]);
    pose.R.shoulder = S; pose.R.elbow = E; pose.R.hand = H;
    pose.R.grip = H;
    pose.armPole = norm(add([0, -1, 0], tanRes));
    pose.gripAxis = armDir;
    loadPt = lerpV(E, H, 0.45);
    effArm = rh;
    // 前臂墊位於前臂內／前側（-tanRes 方向），手臂內收時往前壓進墊子
    padBoxMid = add(loadPt, mul(tanRes, -0.055));
    tipX = padBoxMid[0]; tipZ = padBoxMid[2];
  } else {
    const H = [M.pivX + handleR * st, refArmY, M.pivZ + handleR * ct];
    const pole = norm(add(tanRes, [0, -0.25, 0]));
    const ok = armChain(pose, S, H, pole);
    if (!ok) { pose.ok = false; pose.conflict = '座椅或拉伸角度超出握把可及範圍'; }
    pose.R.grip = H;
    pose.gripAxis = [0, -1, 0]; // 直立握把：小指朝下、拇指朝上
    loadPt = pose.R.hand;
    effArm = handleR;
    tipX = H[0]; tipZ = H[2];
  }
  pose.bar = [0, refArmY, M.pivZ + 0.3];
  const backZ = -0.155 * BODY.heightM / DEFAULT_BODY.heightM;
  pose.machineAdjust = { seatY, handleR, backZ };
  pose.barStyle = 'none';
  const loadKg = P.load ?? M.loadDefault;
  pose.barW = loadKg / BODY.mass;
  const cf = interpTable(M.camTable, deg(theta));
  const tau = (M.camArmM * pose.barW * cf) / 2;
  pose.pad = { p: loadPt, dir: tanRes, arm: effArm, tau, region: 'fore', is3d: true };
  pose.armJoints = ['shoulder', 'elbow'];
  // 機台幾何：可調座墊、垂直椅背、後方配重塔、雙側垂直轉軸與旋轉機械臂
  const backC = add(add(pose.Pc, mul(pose.u, 0.34)), mul(pose.f, backZ));
  const seatTopY = seatY - 0.08;
  const pivY = M.pivY, pivZ = M.pivZ, pivX = M.pivX, colZ = M.colZ;
  const armR = Math.hypot(tipX - pivX, tipZ - pivZ);
  const armAng = Math.atan2(tipX - pivX, tipZ - pivZ);
  const dropBotY = pad ? padBoxMid[1] - 0.12 : refArmY - 0.12;
  pose.boxes = [
    box([0, seatTopY - 0.04, 0.08], [0.42, 0.08, 0.42]), // 座墊（隨 seat 上下移）
    boxAlong(backC, pose.u, [0.34, 0.82, 0.07]), // 椅背
    box([0, 0.025, -0.12], [0.58, 0.05, 0.72], 0, 'frame'), // 底座
    box([0, (seatTopY - 0.08) / 2, 0.08], [0.1, Math.max(0.1, seatTopY - 0.08), 0.12], 0, 'frame'), // 座椅支柱
    box([0, 0.42, -0.18], [0.1, 0.78, 0.07], 0, 'frame'), // 椅背立柱
    box([0, 0.92, colZ], [0.16, 1.84, 0.16], 0, 'glass'), // 後方配重塔
    box([0, pivY + 0.04, (colZ + pivZ) / 2], [0.44, 0.07, pivZ - colZ + 0.12], 0, 'glass'), // 上方懸臂橋
    // 左右獨立垂直轉軸＋旋轉水平臂＋垂直連桿＋握把／前臂墊
    ...[-1, 1].flatMap((sx) => {
      const midX = sx * (pivX + 0.5 * armR * Math.sin(armAng));
      const midZ = pivZ + 0.5 * armR * Math.cos(armAng);
      const dropH = Math.max(0.1, pivY - dropBotY);
      const parts = [
        box([sx * pivX, pivY - 0.02, pivZ], [0.08, 0.12, 0.08], 0, 'frame'), // 垂直轉軸座
        { c: [midX, pivY, midZ], s: [0.045, 0.045, armR], rx: 0, ry: sx * armAng, mat: 'frame' }, // 水平旋轉臂
        box([sx * tipX, (pivY + dropBotY) / 2, tipZ], [0.036, dropH, 0.036], 0, 'frame'), // 垂直下垂連桿
      ];
      if (pad) {
        parts.push({ c: [sx * padBoxMid[0], padBoxMid[1], padBoxMid[2]], s: [0.06, 0.34, 0.13], rx: 0, ry: sx * theta, mat: 'pad' });
      } else {
        parts.push(box([sx * tipX, refArmY, tipZ], [0.034, 0.24, 0.034], 0, 'frame'));
      }
      return parts;
    }),
  ];
  if (P.stretch > 95 && e > 0.7) pose.warn.push('起始外展角度大（' + Math.round(P.stretch) + '°）：肩前側拉伸深，留意關節囊壓力');
  if (P.seat < -6) pose.warn.push('座椅偏低（手臂高於肩）：肩外展超過 90°，留意肩峰下空間');
  return pose;
}

// ---------- 滑輪夾胸／飛鳥（站姿、雙側獨立滑輪）----------
// 雙手各握獨立把手、各連至同側滑輪柱，不套用剛體握把互推；雙腳併站、軀幹前傾維持平衡
function cableFlyPose(P, e) {
  const M = MACHINES.cablefly;
  const hKey = P.height ?? M.heightDefault;
  const div = pulleyDivisor(P.pulleyRatio ?? M.pulleyRatioDefault);
  // 單側配重片 ÷ 滑輪比 = 單手拉力；barW 為雙手總拉力（× 體重）
  const effBarW = (2 * M.stackKg) / (div * BODY.mass);
  const py = M.pulleyY[hKey] ?? M.pulleyY.mid;
  const pulleyR = [M.pulleyX, py, M.pulleyZ];
  const ef = rad(P.elbowBend ?? 25);
  const Lch = Math.sqrt(BODY.Lu ** 2 + BODY.Lf ** 2 + 2 * BODY.Lu * BODY.Lf * Math.cos(ef));
  // 軀幹座標內的上舉角（elev）與水平方位角（plane）：e = 0 胸前交會、e = 1 外展拉伸
  const cfg = {
    high: { elevBot: rad(96), elevTop: rad(54) },
    mid: { elevBot: rad(86), elevTop: rad(84) },
    low: { elevBot: rad(68), elevTop: rad(90) },
  }[hKey] || { elevBot: rad(86), elevTop: rad(84) };
  const planeBot = rad(P.stretch ?? 82);
  const toWorldVec = (tf, v) => add(add(mul(tf.lat, v[0]), mul(tf.u, v[1])), mul(tf.f, v[2]));
  const solveAt = (eAt, extra) => {
    const elev = lerp(cfg.elevTop, cfg.elevBot, eAt);
    const girdle = { ret: rad(lerp(-4, 18, P.scap ?? 0.6)), elev: rad(hKey === 'low' ? lerp(2, -4, eAt) : -4) };
    const handAt = (tf, S) => {
      const sinTop = clamp((0.065 - S[0]) / Math.max(0.1, Lch * Math.sin(cfg.elevTop)), -0.5, 0.5);
      const planeTop = Math.asin(sinTop);
      const plane = lerp(planeTop, planeBot, eAt);
      const cLoc = [Math.sin(elev) * Math.sin(plane), -Math.cos(elev), Math.sin(elev) * Math.cos(plane)];
      const H = add(S, mul(toWorldVec(tf, cLoc), Lch));
      // 手肘與鋼索力線共面（S-H-pulley），符合教練教學「前臂順著鋼索方向」並避免肩關節異常扭轉力矩
      const chDir = norm(sub(H, S));
      const cDir = norm(sub(pulleyR, H));
      const inPlane = sub(cDir, mul(chDir, dot(cDir, chDir)));
      const outVec = toWorldVec(tf, [Math.cos(plane), 0, -Math.sin(plane)]);
      const pole = len(inPlane) > 0.12 ? norm(inPlane) : norm(outVec);
      const arm = ik2(S, H, BODY.Lu, BODY.Lf, pole);
      return { bar: H, elbow: arm.mid, pole, ok: arm.ok };
    };
    // 兩側鋼索的 X 分量左右相消；Y、Z 分量合計作用於系統平衡（雙手總和 = effBarW）
    // 鋼索往後拉的水平分量進入完整壓力中心計算。
    return standingHands(P, {
      kap: rad(10), lean: rad(P.lean ?? 12) + extra, girdle, barW: 0,
      ext: (r) => {
        const d = norm(sub(pulleyR, r.bar));
        return [0, d[1] * effBarW, d[2] * effBarW];
      },
      pole: (tf, r) => r.pole,
      barAt: (tf, S) => handAt(tf, S),
    });
  };
  // 以行程中段決定整組動作一致的站姿前傾補充角，避免每幀軀幹上下晃動
  const extra = P.footStance === 'staggered' ? 0 : bisect((x) => rad(12) - solveAt(0.5, x).shinTilt, 0, rad(24), 16);
  const pose = solveAt(e, extra);
  if (!pose.armOk) { pose.ok = false; pose.conflict = '手臂無法達到此夾胸位置'; }
  pose.dualCable = true;
  pose.barAxial = false;
  pose.barStyle = 'none';
  pose.barW = effBarW;
  pose.pulley = pulleyR;
  pose.R.grip = pose.R.hand;
  pose.gripAxis = [0, -1, 0];
  pose.armJoints = ['shoulder', 'elbow'];
  // 雙側龍門架、可調滑輪座、雙手獨立 D 把與雙側獨立鋼索
  const px = M.pulleyX, pz = M.pulleyZ, th = M.towerH;
  const HR = pose.R.hand, HL = [-HR[0], HR[1], HR[2]];
  const pulleyL = [-px, py, pz];
  pose.boxes = [
    box([0, th, pz], [2 * px + 0.16, 0.07, 0.1], 0, 'glass'), // 頂部橫樑
    ...[-1, 1].flatMap((sx) => [
      box([sx * px, th / 2, pz], [0.12, th, 0.12], 0, 'glass'), // 左右滑輪柱
      box([sx * px, 0.025, pz + 0.08], [0.34, 0.05, 0.62], 0, 'frame'), // 柱底腳座
      box([sx * px, py, pz + 0.03], [0.14, 0.12, 0.12], 0, 'frame'), // 可調滑輪滑車
      box([sx * HR[0], HR[1], HR[2]], [0.026, 0.13, 0.026], 0, 'frame'), // D 型把手
    ]),
  ];
  pose.cables = [
    [HR, pulleyR],
    [HL, pulleyL],
    [pulleyR, [px, th - 0.04, pz]],
    [pulleyL, [-px, th - 0.04, pz]],
  ];
  if (P.footStance !== 'staggered' && deg(extra) > 4) {
    pose.warn.push('雙側鋼索往後拉：目前以雙腳併站、軀幹需額外前傾約 ' + Math.round(deg(extra)) + '° 平衡（實務上常用前後腳站姿）');
  } else if (P.footStance !== 'staggered') {
    pose.warn.push('目前為雙腳併站模型，實務上建議前後腳分站以增加前後穩定度');
  }
  return pose;
}

// ---------- E 階段器械與自體重量動作 ----------
function reverseDeckPose(P, e) {
  const M = MACHINES.reversedeck;
  const seatY = fittedSeatY(M.seatY);
  const handleR = fittedHandleR(M.handleR);
  const chestZ = clamp(M.chestZ * BODY.heightM / DEFAULT_BODY.heightM, 0.11, 0.15);
  const pose = seatedBase(0, seatY, 0.48);
  pose.girdle = { ret: rad(lerp(-5, 20, P.scap)), elev: rad(-3) };
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  const th = rad(lerp(88, 8, e)), y = seatY + BODY.Ltr + P.height / 100;
  const H = [M.pivotX + handleR * Math.sin(th), y, M.pivotZ + handleR * Math.cos(th)];
  const ok = armChain(pose, S, H, norm([0.6, -0.3, -1]));
  if (!ok) { pose.ok = false; pose.conflict = '握把高度超出手臂可及範圍'; }
  pose.R.grip = H; pose.gripAxis = [0, -1, 0];
  pose.bar = [0, y, H[2]]; pose.barStyle = 'none'; pose.barW = P.load / BODY.mass;
  const outward = [Math.cos(th), 0, -Math.sin(th)];
  pose.pad = { p: H, dir: neg(outward), arm: handleR, tau: M.camArm * pose.barW / 2, region: 'fore', is3d: true };
  pose.contact = { p: [0.12, seatY + 0.31, chestZ], n: [0, 0, -1] };
  pose.machineAdjust = { seatY, handleR, chestZ };
  pose.armJoints = ['shoulder', 'elbow'];
  const seatTop = seatY - 0.08;
  pose.boxes = [
    box([0, seatTop - 0.04, 0.05], [0.42, 0.08, 0.42]),
    box([0, seatY + 0.30, chestZ + 0.04], [0.34, 0.57, 0.07]), // 胸墊在身前
    box([0, seatTop / 2, 0.05], [0.12, seatTop, 0.12], 0, 'frame'),
    box([0, 0.03, 0.03], [0.7, 0.06, 0.75], 0, 'frame'),
    ...[-1, 1].flatMap((sx) => [
      box([sx * M.pivotX, M.pivotY / 2, M.pivotZ], [0.055, M.pivotY, 0.055], 0, 'glass'),
      { c: [sx * (M.pivotX + H[0]) / 2, M.pivotY, (M.pivotZ + H[2]) / 2], s: [0.045, 0.045, handleR], ry: sx * th, mat: 'frame' },
      box([sx * H[0], (M.pivotY + y) / 2, H[2]], [0.035, M.pivotY - y, 0.035], 0, 'frame'),
      box([sx * H[0], y, H[2]], [0.035, 0.18, 0.035], 0, 'frame'),
    ]),
  ];
  return pose;
}
function reverseDeckReactions(pose, P, W, out) {
  // 胸墊承受握把往前拉的合力；座墊承受垂直重量。
  const hand = out.filter((f) => f.region === 'fore' && f.F[2] > 0).reduce((s, f) => s + f.F[2], 0);
  const F = [0, 0, -hand];
  out.push({ p: pose.contact.p, F, region: 'trunk' });
  pose.support = { N: F };
}

function backExtPose(P, e) {
  const M = MACHINES.backext;
  // 羅馬椅的可調大腿支架跟隨腿長；踝部滾輪仍固定在機架上。
  const fittedHipY = clamp(M.hipY + 0.9 * (BODY.Lt + BODY.Ls - DEFAULT_BODY.Lt - DEFAULT_BODY.Ls), 0.72, 1.06);
  const hip = [BODY.hipHalf, fittedHipY + P.padHeight / 100, 0];
  const A = [0.15, 0.37, M.ankleZ];
  const phi = rad(lerp(45, 105 + 8 * P.round, e));
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, trunkFrame([0, hip[1], hip[2]], [0, Math.cos(phi), Math.sin(phi)]));
  pose.phi = phi;
  const leg = legChain(pose, A, [0, 0, -1], hip);
  if (!leg) { pose.ok = false; pose.conflict = '墊高位置使腳踝無法卡在固定墊'; }
  pose.girdle = { ret: rad(8), elev: 0 };
  pose.machineAdjust = { thighPadY: fittedHipY };
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  restHands(pose, S, add(pose.Pc, add(mul(pose.u, 0.32), mul(pose.f, 0.16))));
  pose.bar = [0, hip[1] + pose.u[1] * 0.32 + pose.f[1] * 0.16, pose.u[2] * 0.32 + pose.f[2] * 0.16];
  pose.barStyle = 'none'; pose.barW = P.load / BODY.mass;
  pose.platePt = add(pose.bar, [BODY.hipHalf / 2, 0, 0]);
  pose.thighContact = lerpV(pose.R.hip, pose.R.knee, clamp(0.43 - P.padHeight / 100, 0.25, 0.65));
  pose.ankleContact = lerpV(pose.R.knee, pose.R.ankle, 0.88);
  pose.trunkExt = -rad(35 * P.round * e);
  pose.armJoints = ['hip', 'lumbar'];
  const C = pose.thighContact, D = pose.ankleContact;
  pose.boxes = [
    boxAlong(add(C, [0, -0.055, 0]), norm(sub(pose.R.hip, pose.R.knee)), [0.48, 0.31, 0.09]),
    box([0, D[1] + 0.06, D[2]], [0.43, 0.09, 0.14]),
    box([0, C[1] / 2, C[2]], [0.1, C[1], 0.1], 0, 'frame'),
    box([0, D[1] / 2, D[2]], [0.1, D[1], 0.1], 0, 'frame'),
    box([0, 0.03, (C[2] + D[2]) / 2], [0.62, 0.06, Math.abs(C[2] - D[2]) + 0.24], 0, 'frame'),
    ...(P.load > 0 ? [box(pose.platePt, [0.29, 0.29, 0.045], 0, 'frame')] : []),
  ];
  return pose;
}
function backExtLoads(pose, P, W, out) {
  if (P.load > 0) out.push({ p: pose.platePt, F: [0, -P.load * G / 2, 0], region: 'trunk' });
}
function backExtReactions(pose, P, W, out) {
  // 大腿墊向上、腳踝固定墊向下；以兩處接觸的力矩平衡求大小。
  const C = pose.thighContact, D = pose.ankleContact;
  let Fy = 0, M = 0;
  for (const f of out) { Fy += f.F[1]; M += (f.p[1] - C[1]) * f.F[2] - (f.p[2] - C[2]) * f.F[1]; }
  const rawAnkle = M / Math.max(0.08, C[2] - D[2]);
  if (rawAnkle < 0) pose.warn.push('腳踝墊無法提供所需反向接觸力；此姿勢的支撐力矩未平衡');
  const n = Math.max(0, rawAnkle);
  const ankle = [0, -n, 0], thigh = [0, -Fy + n, 0];
  out.push({ p: D, F: ankle, region: 'shank' }, { p: C, F: thigh, region: 'thigh' });
  pose.support = { ankle, thigh };
}

function hackSquatPose(P, e) {
  const M = MACHINES.hacksquat, a = rad(M.railDeg), d = [0, Math.cos(a), -Math.sin(a)], n = [0, Math.sin(a), Math.cos(a)];
  const w = lerp(0.13, 0.3, P.stance), ankle = [w, 0.18, 0.25 + P.feetFwd];
  const kf = rad(lerp(8, lerp(78, 120, P.depth), e));
  const reach = Math.sqrt(BODY.Lt ** 2 + BODY.Ls ** 2 + 2 * BODY.Lt * BODY.Ls * Math.cos(kf));
  // 滑軌固定於機架；腳位只移動踏板上的腳，不拖著滑軌一起移動。
  const railBaseZ = 0.35;
  const hipAt = (s) => [BODY.hipHalf, ankle[1] + d[1] * s, railBaseZ + d[2] * s];
  const slide = bisect((s) => len(sub(hipAt(s), ankle)) - reach, 0.1, 1.05);
  const hip = hipAt(slide);
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, trunkFrame([0, hip[1], hip[2]], d)); pose.phi = -a;
  const leg = legChain(pose, ankle, [0, Math.sin(rad(M.plateDeg)), Math.cos(rad(M.plateDeg))], hip);
  if (!leg) { pose.ok = false; pose.conflict = '腳位使膝關節無法沿滑台軌道屈伸'; }
  pose.footUp = [0, Math.cos(rad(M.plateDeg)), -Math.sin(rad(M.plateDeg))];
  pose.R.toe = add(ankle, mul(pose.toeDir, 0.19));
  pose.R.heel = sub(ankle, mul(pose.toeDir, 0.06));
  pose.girdle = { ret: rad(8), elev: 0 };
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  const H = add(S, [0.16, -0.12, -0.13]);
  restHands(pose, S, H);
  pose.bar = [0, S[1], S[2]]; pose.barStyle = 'none'; pose.barW = P.load / BODY.mass;
  pose.contact = { p: add(S, [0, 0, -0.09]), n, rail: true, bilateral: true };
  pose.armJoints = ['hip', 'knee', 'ankle'];
  const center = add(pose.Pc, mul(d, 0.28));
  const railZ0 = railBaseZ + ankle[1] - 0.12;
  pose.boxes = [
    boxAlong(add(center, [0, 0, -0.115]), d, [0.49, 0.67, 0.09]),
    boxAlong(add(S, [0, 0, -0.13]), d, [0.48, 0.12, 0.16]),
    boxAlong([0, 0.1, 0.42], pose.footUp, [0.78, 0.045, 0.65], 'frame'),
    ...[-1, 1].flatMap((sx) => [
      boxAlong([sx * M.railHalfSpan, M.railHeight / 2, railZ0 - M.railHeight / 2], d, [0.055, M.railHeight / Math.cos(a), 0.055], 'glass'),
      box([sx * M.railHalfSpan, 0.03, railZ0 / 2], [0.08, 0.06, Math.abs(railZ0) + 1.1], 0, 'frame'),
    ]),
  ];
  return pose;
}
function hackSquatLoads(pose, P, W, out) {
  const d = pose.u;
  out.push({ p: pose.R.shoulder, F: mul(d, -P.load * G / 2), region: 'trunk', ext: true });
}
function hackSquatReactions(pose, P, W, out) {
  const R = pose.R, cop = lerpV(R.heel, R.toe, P.push);
  let F = [0, 0, 0], M = 0;
  for (const f of out) { F = add(F, f.F); M += (f.p[1] - cop[1]) * f.F[2] - (f.p[2] - cop[2]) * f.F[1]; }
  const C = pose.contact.p, n = pose.contact.n;
  const k = (C[1] - cop[1]) * n[2] - (C[2] - cop[2]) * n[1];
  const rail = mul(n, Math.abs(k) > 1e-5 ? -M / k : 0);
  const foot = neg(add(F, rail));
  // 雙腳對稱站立：足底反力的額狀面力線通過髖關節，避免把外側壓力中心誤算成髖內收需求。
  foot[0] = coronalFootForce(R.hip, cop, foot[1]);
  out.push({ p: C, F: rail, region: 'trunk' }, { p: cop, F: foot, region: 'foot' });
  pose.cop = cop; pose.support = { N: rail, G: foot };
}

function machinePressPose(P, e) {
  const M = MACHINES.machinepress;
  const seatY = fittedSeatY(M.seatY, P.seat / 100);
  const pose = seatedBase(0, seatY, 0.48);
  pose.girdle = { ret: rad(8), elev: rad(lerp(12, -3, e)) };
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  const a = rad(P.pathAngle), d = [0, Math.cos(a), Math.sin(a)];
  const H = add([0.31, M.seatY + 0.46, 0.22], mul(d, 0.47 * (1 - e)));
  const ok = armChain(pose, S, H, norm([0.72, -0.8, 0.72]));
  if (!ok) { pose.ok = false; pose.conflict = '座高或握把軌跡使手臂無法握住'; }
  pose.R.grip = H; pose.gripAxis = P.grip === 'neutral' ? [0, -1, 0] : [1, 0, 0];
  pose.bar = [0, H[1], H[2]]; pose.barStyle = 'none'; pose.barW = P.load / BODY.mass;
  pose.push = { p: H, d, region: 'fore' }; pose.armJoints = ['shoulder', 'elbow'];
  pose.machineAdjust = { seatY, backZ: -0.15 };
  const seatTop = seatY - 0.08;
  pose.boxes = [
    box([0, seatTop - 0.04, 0], [0.44, 0.08, 0.42]),
    box([0, seatY + 0.27, -0.15], [0.37, 0.58, 0.07]),
    box([0, seatTop / 2, 0], [0.12, seatTop, 0.12], 0, 'frame'),
    box([0, 0.03, -0.1], [0.66, 0.06, 0.75], 0, 'frame'),
    ...[-1, 1].flatMap((sx) => [
      box([sx * 0.39, M.pivotY / 2, M.pivotZ], [0.06, M.pivotY, 0.06], 0, 'glass'),
      boxAlong([sx * 0.35, (M.pivotY + H[1]) / 2, (M.pivotZ + H[2]) / 2], norm([0, H[1] - M.pivotY, H[2] - M.pivotZ]), [0.045, Math.hypot(H[1] - M.pivotY, H[2] - M.pivotZ), 0.045], 'frame'),
      box([sx * H[0], H[1], H[2]], [0.17, 0.035, 0.035], 0, 'frame'),
    ]),
  ];
  return pose;
}

function calfRaisePose(P, e) {
  const M = MACHINES.calfraise, seated = P.posture === 'seated';
  const alpha = rad(lerp(-20, 15, e * P.range));
  const toeDir = [0, Math.sin(alpha), Math.cos(alpha)], footUp = [0, Math.cos(alpha), -Math.sin(alpha)];
  const toe = [0.15, M.stepY, seated ? 0.65 + (P.knee - 90) / 500 : 0.45];
  const ankle = add(sub(toe, mul(toeDir, 0.18)), mul(footUp, BODY.ankleH));
  let pose;
  if (seated) {
    pose = seatedBase(0, 0.55, toe[2]);
    pose.R.ankle = ankle;
    const leg = ik2(pose.R.hip, ankle, BODY.Lt, BODY.Ls, [0, 0.3, 1]);
    pose.R.knee = leg.mid;
    if (!leg.ok) { pose.ok = false; pose.conflict = '膝角與腳掌位置不相容'; }
  } else {
    const hip = [BODY.hipHalf, ankle[1] + 0.82 * (BODY.Lt + BODY.Ls) / (DEFAULT_BODY.Lt + DEFAULT_BODY.Ls), ankle[2] - 0.02];
    pose = { R: {}, warn: [], ok: true };
    Object.assign(pose, trunkFrame([0, hip[1], hip[2]], [0, 1, 0])); pose.phi = 0;
    const leg = legChain(pose, ankle, toeDir, hip);
    if (!leg) { pose.ok = false; pose.conflict = '站姿腿長不足'; }
  }
  pose.R.toe = toe; pose.R.heel = sub(ankle, mul(toeDir, 0.07));
  pose.toeDir = toeDir; pose.footUp = footUp;
  pose.girdle = { ret: rad(5), elev: 0 };
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  restHands(pose, S, add(S, [0.15, -0.17, 0.18]));
  pose.bar = [0, seated ? pose.R.knee[1] + 0.07 : S[1], seated ? pose.R.knee[2] : S[2]];
  pose.barStyle = 'none'; pose.barW = P.load / BODY.mass;
  pose.padPt = seated ? add(pose.R.knee, [0, 0.07, -0.04]) : add(S, [0, 0.05, -0.04]);
  pose.machineAdjust = seated ? { kneePadY: pose.padPt[1] } : { shoulderPadY: pose.padPt[1] };
  pose.armJoints = ['ankle'];
  pose.boxes = [
    box([0, M.stepY / 2, toe[2] + 0.02], [0.65, M.stepY, 0.2], 0, 'frame'),
    ...(seated ? [
      box([0, 0.43, -0.03], [0.44, 0.09, 0.42]),
      box([0, 0.2, -0.03], [0.12, 0.4, 0.12], 0, 'frame'),
      box([0, pose.padPt[1] + 0.025, pose.padPt[2]], [0.52, 0.08, 0.22]),
    ] : [
      box([0, pose.padPt[1] + 0.08, pose.padPt[2]], [0.5, 0.12, 0.2]),
      box([0, pose.padPt[1] / 2, pose.padPt[2] - 0.3], [0.08, pose.padPt[1], 0.08], 0, 'glass'),
    ]),
  ];
  return pose;
}
function calfRaiseLoads(pose, P, W, out) {
  out.push({ p: pose.padPt, F: [0, -P.load * G / 2, 0], region: P.posture === 'seated' ? 'thigh' : 'trunk' });
}
function calfRaiseReactions(pose, P, W, out) {
  const seated = P.posture === 'seated';
  const Fy = seated ? out.filter((f) => ['foot', 'shank', 'thigh'].includes(f.region)).reduce((s, f) => s + f.F[1], 0) : out.reduce((s, f) => s + f.F[1], 0);
  const F = [0, -Fy, 0];
  out.push({ p: pose.R.toe, F, region: 'foot' });
  pose.cop = pose.R.toe; pose.support = { G: F };
}

function hipAbdPose(P, e) {
  const M = MACHINES.hipabd, abd = P.direction === 'abd';
  const pose = seatedBase(rad(P.lean), M.seatY, 0.46);
  const alpha = rad(abd ? lerp(54, 17, e) : lerp(8, 42, e));
  const hip = [BODY.hipHalf, M.seatY, 0];
  const knee = add(hip, [BODY.Lt * Math.sin(alpha), -0.04, BODY.Lt * Math.cos(alpha)]);
  const ankle = add(knee, [0, -BODY.Ls + 0.02, 0]);
  pose.R.hip = hip; pose.R.knee = knee; pose.R.ankle = ankle;
  pose.R.toe = add(ankle, [0, -BODY.ankleH, 0.19]);
  pose.R.heel = add(ankle, [0, -BODY.ankleH, -0.06]);
  pose.toeDir = [0, 0, 1]; pose.hipAbdAxis = [0, 1, 0];
  pose.girdle = { ret: rad(5), elev: 0 };
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  restHands(pose, S, add(S, [0.16, -0.23, 0.16]));
  pose.bar = [0, knee[1], knee[2]]; pose.barStyle = 'none'; pose.barW = P.load / BODY.mass;
  const contact = lerpV(hip, knee, 0.88);
  pose.pad = { p: contact, dir: [abd ? -1 : 1, 0, 0], arm: M.padArm, tau: M.camArm * pose.barW / 2, region: 'thigh', is3d: true };
  pose.armJoints = ['hip'];
  pose.boxes = [
    box([0, M.seatY - 0.12, 0.08], [0.48, 0.1, 0.46]),
    box([0, M.seatY + 0.22, -0.14], [0.4, 0.58, 0.08]),
    box([0, 0.2, 0.04], [0.12, 0.4, 0.12], 0, 'frame'),
    ...[-1, 1].flatMap((sx) => [
      box([sx * (contact[0] + (abd ? 0.06 : -0.06)), contact[1], contact[2]], [0.08, 0.22, 0.12]),
      box([sx * contact[0] / 2, contact[1] - 0.16, contact[2]], [contact[0], 0.045, 0.045], 0, 'frame'),
    ]),
  ];
  return pose;
}

// ================= 啞鈴動作（F 階段）=================
// 共用視覺輔助：由右手握把中心與方向產生左右對稱兩顆啞鈴
function pairDumbbells(c, axis, kg) {
  const a = norm(axis);
  return [
    { c, axis: a, kg },
    { c: [-c[0], c[1], c[2]], axis: [-a[0], a[1], a[2]], kg },
  ];
}

// ---------- 啞鈴臥推（平板／上斜 30°）----------
// 手部路徑假設：無剛體槓約束，下放時雙手依手肘外展角落在胸兩側並可低於胸面（深度可調），
// 且前臂維持接近垂直（手腕疊在手肘正上方）；推起過程前半段保持寬距以維持前臂垂直，接近鎖死時才自然微內聚（頂點寬度 40 cm，兩顆啞鈴不碰撞）。
function dbBenchPose(P, e) {
  const pose = { R: {}, warn: [], ok: true, supine: true };
  const inc = rad(Number(P.incline) || 0), ci = Math.cos(inc), si = Math.sin(inc);
  const rot = (v) => [v[0], v[1] * ci - v[2] * si, v[1] * si + v[2] * ci];
  const baseU = rot(norm(sub([0, 0.53, 0], [0, 0.5, 0.5])));
  const arch = benchArch(P), ac = Math.cos(arch.a / 4), as = Math.sin(arch.a / 4);
  const u = arch.a ? [0, baseU[1] * ac + baseU[2] * as, -baseU[1] * as + baseU[2] * ac] : baseU;
  pose.girdle = { ret: rad(18), elev: rad(-6) };
  const dl = shoulderLocal(pose.girdle);
  const Sy0 = 0.53 + 0.45 * si, Sy = Sy0 + arch.shoulderLift;
  const t0 = trunkFrame([0, 0.5, 0.5], u);
  const S0 = toWorld(t0, dl);
  const tf = trunkFrame(add([0, 0.5, 0.5], [0, Sy - S0[1], -S0[2]]), u);
  const supportTf = arch.a ? (() => {
    const b0 = trunkFrame([0, 0.5, 0.5], baseU), bs = toWorld(b0, dl);
    return trunkFrame(add([0, 0.5, 0.5], [0, Sy0 - bs[1], -bs[2]]), baseU);
  })() : tf;
  Object.assign(pose, tf);
  const S = toWorld(tf, dl);
  const neutral = P.grip === 'neutral';
  // 下放最低點：依外展角決定自然手寬，並使底端與中段前臂維持接近垂直（不像槓鈴受限於固定握距）
  const flareT = clamp((P.flare - 30) / 50, 0, 1);
  const xBot = lerp(0.32, 0.40, flareT) - (neutral ? 0.025 : 0);
  const xTop = 0.22; // 頂點雙手微內聚（間距 44 cm，兩顆啞鈴不碰撞且推起中段前臂不向內倒）
  // 底端高度：啞鈴可比槓鈴略低（槓鈴觸胸 h ≈ 0.165 m；啞鈴可依深度降到胸側 h ≈ 0.17→0.10 m）
  const hBot = lerp(0.175, 0.105, P.depth);
  const [, dyT, zBase] = rot([0, hBot, lerp(0.12, 0.08, clamp(inc / rad(30), 0, 1))]);
  const zt = zBase - arch.chestBack;
  const yBot = Sy + dyT + arch.chestLift;
  if (arch.a) pose.chestArch = { touch: [0, yBot, zt], lift: arch.chestLift };
  const zLock = lerp(0.02, zt, 0.45);
  const R = 0.978 * (BODY.Lu + BODY.Lf);
  const yTop = Sy + Math.sqrt(Math.max(0.05, R * R - (xTop - S[0]) ** 2 - zLock ** 2));
  // 推起弧線：下段與中段維持較寬（手疊在肘上方），接近頂點才向肩上方內聚
  const x = lerp(xTop, xBot, Math.pow(e, 0.42));
  const H = [x, lerp(yTop, yBot, e), lerp(zLock, zt, Math.pow(e, 0.75))];
  const a = rad(P.flare);
  const pole = norm(rot([Math.sin(a), -0.25, Math.cos(a)]));
  const ok = armChain(pose, S, H, pole);
  if (!ok) { pose.ok = false; pose.conflict = '此深度與手肘角度超出雙臂可及範圍'; }
  const gripAxis = neutral ? [0, 0, 1] : [1, 0, 0];
  pose.R.grip = pose.R.hand;
  pose.gripAxis = gripAxis;
  pose.bar = [0, pose.R.hand[1], pose.R.hand[2]];
  pose.barStyle = 'none';
  pose.barAxial = false;
  pose.barW = (2 * P.load) / BODY.mass;
  pose.dumbbells = pairDumbbells(pose.R.hand, gripAxis, P.load);
  // 靜態下肢與臥推椅
  legChain(pose, [0.25, BODY.ankleH, 1.0], [0, 0, 1], add(supportTf.Pc, [BODY.hipHalf, 0, 0]));
  pose.R.knee = ik2(pose.R.hip, pose.R.ankle, BODY.Lt, BODY.Ls, [0, 1, 0.3]).mid;
  pose.R.toe = [0.27, 0.02, 1.17]; pose.R.heel = [0.25, 0.02, 0.95];
  pose.bench = { incline: inc, Pc: supportTf.Pc, u: baseU, f: supportTf.f };
  const fore = sub(pose.R.hand, pose.R.elbow);
  const tilt = deg(Math.acos(clamp(fore[1] / len(fore), -1, 1)));
  if (e > 0.6 && tilt > 28) pose.warn.push('前臂偏離垂直 ' + Math.round(tilt) + '°');
  return pose;
}

// ---------- 坐姿啞鈴肩推 ----------
// 手部路徑假設：坐於微後傾 8°（82°）椅背，下放時手肘位於肩胛／前移平面（elbowFwd）且前臂接近垂直；
// 推起過程下中段維持手在手肘上方，接近頂點才自然微內聚至肩膀上方（頂點寬度 42 cm，不需繞過下巴）。
function dbPressPose(P, e) {
  const M = MACHINES.dumbbell;
  const recl = rad(M.pressBackReclineDeg);
  const pose = seatedBase(-recl, M.pressSeatY, 0.48);
  const tf = pose;
  pose.girdle = { ret: rad(lerp(2, 10, e)), elev: rad(lerp(13, -2, e)) };
  const S = toWorld(tf, shoulderLocal(pose.girdle));
  const ang = rad(P.elbowFwd);
  const neutral = P.grip === 'neutral';
  const rBot = BODY.Lu * lerp(0.86, 0.78, P.depth) - (neutral ? 0.02 : 0);
  const bot = [S[0] + Math.cos(ang) * rBot, S[1] + lerp(0.22, 0.10, P.depth), S[2] + Math.sin(ang) * rBot + 0.03];
  const xTop = 0.21, zTop = S[2] + 0.06;
  const R = 0.972 * (BODY.Lu + BODY.Lf);
  const top = [xTop, S[1] + Math.sqrt(Math.max(0.05, R * R - (xTop - S[0]) ** 2 - (zTop - S[2]) ** 2)), zTop];
  const ey = Math.pow(e, 1.15);
  const ex = Math.pow(e, 0.55); // 下中段保持手疊在手肘上方，頂端再收攏
  const H = [lerp(top[0], bot[0], ex), lerp(top[1], bot[1], ey), lerp(top[2], bot[2], ey)];
  const pole = norm([Math.cos(ang), -0.95, Math.sin(ang)]);
  const ok = armChain(pose, S, H, pole);
  if (!ok) { pose.ok = false; pose.conflict = '手臂長度無法達到此肩推位置'; }
  const gripAxis = neutral ? [0, 0, 1] : [1, 0, 0];
  pose.R.grip = pose.R.hand;
  pose.gripAxis = gripAxis;
  pose.bar = [0, pose.R.hand[1], pose.R.hand[2]];
  pose.barStyle = 'none';
  pose.barAxial = false;
  pose.barW = (2 * P.load) / BODY.mass;
  pose.dumbbells = pairDumbbells(pose.R.hand, gripAxis, P.load);
  pose.armJoints = ['shoulder', 'elbow'];
  // 坐姿肩推椅（座墊＋微後傾椅背＋支架）
  const seatTop = M.pressSeatY - 0.08;
  const backC = add(add(tf.Pc, mul(tf.u, 0.34)), mul(tf.f, -0.14));
  const backPostTop = add(add(tf.Pc, mul(tf.u, 0.22)), mul(tf.f, -0.175));
  pose.boxes = [
    box([0, seatTop - 0.04, 0.08], [0.36, 0.08, 0.42]), // 座墊
    boxAlong(backC, tf.u, [0.30, 0.78, 0.07]), // 微後傾椅背
    box([0, 0.025, -0.02], [0.46, 0.05, 0.68], 0, 'frame'), // 底座
    box([0, (seatTop - 0.08) / 2, 0.08], [0.10, seatTop - 0.08, 0.14], 0, 'frame'), // 座椅支柱
    box([0, backPostTop[1] / 2, backPostTop[2]], [0.09, backPostTop[1], 0.07], 0, 'frame'), // 椅背支柱
  ];
  const fore = sub(pose.R.hand, pose.R.elbow);
  const tilt = deg(Math.acos(clamp(fore[1] / len(fore), -1, 1)));
  if (e > 0.65 && tilt > 26) pose.warn.push('前臂偏離垂直 ' + Math.round(tilt) + '°');
  return pose;
}

// ---------- 啞鈴側平舉 ----------
// 手部路徑假設：站姿維持總重心在腳掌中段上方（barAxial = false），手臂由垂體側 14°（避開大腿）
// 沿肩胛平面（前偏 30°）或冠狀面（0°）外展至 topHeight，肘微彎角度全程固定、前臂略朝前內側彎折。
function latRaisePose(P, e) {
  const t = 1 - e; // t = 0 垂手、1 舉到頂點
  const plFwd = P.plane === 'scap' ? rad(30) : rad(0);
  const elev = rad(lerp(14, P.topHeight, t));
  const ef = rad(P.elbowBend);
  const girdle = {
    ret: rad(lerp(0, 6, t)),
    elev: rad(lerp(-4, lerp(8, 22, clamp((P.topHeight - 70) / 35, 0, 1)), t)),
  };
  const pose = standingHands(P, {
    kap: rad(5), lean: rad(3), girdle, barW: (2 * P.load) / BODY.mass, barAxial: false,
    pole: (tf, r) => r.pole,
    barAt: (tf, S) => {
      const latDir = add(mul(tf.lat, Math.cos(plFwd)), mul(tf.f, Math.sin(plFwd)));
      const bendDir = add(mul(tf.f, Math.cos(plFwd)), mul(tf.lat, -Math.sin(plFwd)));
      const ud = add(mul(tf.u, -Math.cos(elev)), mul(latDir, Math.sin(elev)));
      const E = add(S, mul(ud, BODY.Lu));
      const fd = add(mul(ud, Math.cos(ef)), mul(bendDir, Math.sin(ef)));
      const H = add(E, mul(fd, BODY.Lf));
      return { bar: H, elbow: E, pole: neg(bendDir), gripAxis: neg(bendDir) };
    },
  });
  if (!pose.armOk) { pose.ok = false; pose.conflict = '手臂姿勢超出可及範圍'; }
  const gripAxis = pose.r.gripAxis;
  pose.R.grip = pose.R.hand;
  pose.gripAxis = gripAxis;
  pose.barStyle = 'none';
  pose.barAxial = false;
  pose.dumbbells = pairDumbbells(pose.R.hand, gripAxis, P.load);
  pose.armJoints = ['shoulder', 'elbow'];
  if (P.topHeight > 95 && e < 0.25) pose.warn.push('上舉超過水平（' + Math.round(P.topHeight) + '°）：上斜方肌參與增加，留意肩峰下空間');
  return pose;
}

// ---------- 啞鈴彎舉（反握／錘式）----------
// 手部路徑假設：站姿兩手各自垂於大腿兩側（上臂微外開 8° 避開髖部，不受直槓手距限制），
// 屈肘由 18° 至 135°，上臂依 elbFwd 於頂點前移；錘式對握時啞鈴軸隨前臂垂直於矢狀面且掌心朝內。
function dbCurlPose(P, e) {
  const t = 1 - e;
  const as = rad(P.elbFwd) * t;
  const ef = rad(lerp(18, 135, t));
  const neutral = P.grip === 'neutral';
  const pose = standingHands(P, {
    kap: rad(4), lean: 0, girdle: { ret: rad(8), elev: rad(-4) },
    barW: (2 * P.load) / BODY.mass, barAxial: false,
    pole: (tf, r) => r.pole,
    barAt: (tf, S) => {
      const down = mul(tf.u, -1);
      const ud = norm(add(add(mul(down, Math.cos(as)), mul(tf.f, Math.sin(as))), mul(tf.lat, 0.14)));
      const n = add(mul(tf.u, Math.sin(as)), mul(tf.f, Math.cos(as))); // 垂直 ud 且指向前上方
      const E = add(S, mul(ud, BODY.Lu));
      const fd = norm(add(mul(ud, Math.cos(ef)), mul(n, Math.sin(ef))));
      const H = add(E, mul(fd, BODY.Lf));
      const gripAxis = neutral ? norm(cross(fd, [-1, 0, 0])) : [1, 0, 0];
      return { bar: H, elbow: E, pole: neg(n), gripAxis };
    },
  });
  if (!pose.armOk) { pose.ok = false; pose.conflict = '手臂姿勢超出可及範圍'; }
  const gripAxis = pose.r.gripAxis;
  pose.supinated = !neutral;
  pose.R.grip = pose.R.hand;
  pose.gripAxis = gripAxis;
  pose.barStyle = 'none';
  pose.barAxial = false;
  pose.dumbbells = pairDumbbells(pose.R.hand, gripAxis, P.load);
  pose.armJoints = ['shoulder', 'elbow'];
  if (P.elbFwd > 25 && e < 0.3) pose.warn.push('頂點手肘往前帶較多：前臂接近垂直時屈肘張力下降');
  return pose;
}

// ---------- 俯身啞鈴反向飛鳥 ----------
// 手部路徑假設：俯身站姿維持系統重心在腳掌中段（barAxial = false），手臂在世界 XY 平面
// 由垂於胸下方（外展 8°，兩顆啞鈴不碰撞）水平外展至 86°，肘微彎固定、前臂朝內下方彎折。
function dbReverseFlyPose(P, e) {
  const t = 1 - e; // t = 0 垂手下方、1 展開頂點
  const w = 0.15, tau = rad(8);
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const A = [w, BODY.ankleH, -0.07];
  const phi = rad(P.torso);
  const u = [0, Math.cos(phi), Math.sin(phi)];
  const legs = fixedKneeLegs(A, w, rad(22));
  const girdle = { ret: rad(lerp(-8, 16, t)), elev: rad(lerp(-6, 0, t)) };
  const dl = shoulderLocal(girdle);
  const alpha = rad(lerp(8, 86, t));
  const ef = rad(P.elbowBend);
  const ud = [Math.sin(alpha), -Math.cos(alpha), 0];
  const inward = [-Math.cos(alpha), -Math.sin(alpha), 0];
  const fd = norm(add(mul(ud, Math.cos(ef)), mul(inward, Math.sin(ef))));
  const pole = neg(inward);
  const barW = (2 * P.load) / BODY.mass;
  const at = (th) => {
    const { knee, hip } = legs(th);
    const tf = trunkFrame([0, hip[1], hip[2]], u);
    const S = toWorld(tf, dl);
    const E = add(S, mul(ud, BODY.Lu));
    const H = add(E, mul(fd, BODY.Lf));
    return { knee, hip, tf, S, E, H };
  };
  const com = (th) => {
    const r = at(th), p = { R: {}, Pc: r.tf.Pc, u, toeDir: toe };
    legChain(p, A, toe, r.hip);
    armChain(p, r.S, r.H, pole);
    return systemComZ(p, r.H, barW);
  };
  const footMid = A[2] + (0.19 - 0.06) * toe[2] / 2;
  const r = at(bisect((th) => com(th) - footMid - (P.balanceCm || 0) / 100, rad(-15), rad(30)));
  const pose = { R: {}, warn: [], ok: true };
  Object.assign(pose, r.tf);
  pose.phi = phi;
  pose.girdle = girdle;
  legChain(pose, A, toe, r.hip);
  pose.R.knee = r.knee;
  const ok = armChain(pose, r.S, r.H, pole);
  if (!ok) { pose.ok = false; pose.conflict = '手臂姿勢超出可及範圍'; }
  const gripAxis = [0, 0, -1];
  pose.R.grip = pose.R.hand;
  pose.gripAxis = gripAxis;
  pose.bar = [0, pose.R.hand[1], pose.R.hand[2]];
  pose.barStyle = 'none';
  pose.barAxial = false;
  pose.barW = barW;
  pose.dumbbells = pairDumbbells(pose.R.hand, gripAxis, P.load);
  pose.armJoints = ['shoulder', 'elbow', 'lumbar'];
  if (r.H[1] < 0.08) pose.warn.push('手部位置接近地面');
  return pose;
}

// 共用固定上臂路徑：上臂與前臂長度直接定義，避免反解肘位隨行程換支。
function fixedArm(pose, E, H) {
  pose.R.elbow = E; pose.R.hand = H; pose.R.grip = H;
  pose.armPole = norm(cross(sub(E, pose.R.shoulder), sub(H, E)));
  pose.armOk = true;
  return pose;
}

// 平凳沿用啞鈴臥推的軀幹、雙腳及凳面；重新定義垂直上臂的肘屈路徑。
function skullCrusherPose(P, e) {
  const pose = dbBenchPose({ incline: '0', arch: 10, depth: 0.4, flare: 50, grip: 'pro', load: P.load }, 0);
  pose.warn = []; pose.ok = true;
  const S = pose.R.shoulder, a = rad(P.upperTilt), flex = rad(lerp(8, P.bottomFlex, e));
  const E = add(S, mul(norm([0.26, Math.cos(a), -Math.sin(a) - 0.06]), BODY.Lu));
  const H = add(E, [0, BODY.Lf * Math.cos(flex), -BODY.Lf * Math.sin(flex)]);
  fixedArm(pose, E, H);
  pose.bar = [0, H[1], H[2]]; pose.barW = P.load / BODY.mass;
  pose.barStyle = { len: 0.56 }; pose.barAxial = true; pose.dumbbells = [];
  pose.armJoints = ['shoulder', 'elbow'];
  return pose;
}

function dbOverheadExtPose(P, e) {
  const pose = dbPressPose({ grip: 'neutral', elbowFwd: 30, depth: 0.5, load: P.load }, 0);
  pose.warn = []; pose.ok = true;
  const S = pose.R.shoulder, flex = rad(lerp(8, P.bottomFlex, e));
  const E = add(S, mul(norm([-0.18, 0.968, -0.20]), BODY.Lu));
  const H = add(E, mul(norm([-0.15, Math.cos(flex), -Math.sin(flex)]), BODY.Lf));
  fixedArm(pose, E, H);
  pose.bar = [0, H[1], H[2]]; pose.barW = P.load / BODY.mass;
  pose.barStyle = 'none'; pose.barAxial = true;
  pose.dbLoadPt = [0, H[1], H[2]];
  pose.dumbbells = [{ c: [0, H[1], H[2]], axis: [0, 1, 0], kg: P.load }];
  pose.armJoints = ['shoulder', 'elbow'];
  return pose;
}

function cableOverheadExtPose(P, e) {
  const pulley = [0, 0.48, -0.85], ratio = pulleyDivisor(P.pulleyRatio);
  const barW = P.load / (ratio * BODY.mass);
  const flex = rad(lerp(8, P.bottomFlex, e));
  const pose = standingHands(P, {
    kap: rad(8), lean: rad(P.lean), girdle: { ret: rad(0), elev: rad(8) }, barW: 0,
    ext: (r) => mul(norm(sub(pulley, r.bar)), barW),
    pole: (tf, r) => [0, 0, 1],
    barAt: (tf, S) => {
      const E = add(S, mul(norm([-0.10, 0.92, 0.35]), BODY.Lu));
      const H = add(E, mul(norm([-0.12, Math.cos(flex), Math.sin(flex)]), BODY.Lf));
      return { bar: H, elbow: E };
    },
  });
  fixedArm(pose, pose.r.elbow, pose.r.bar);
  pose.barW = barW; pose.barStyle = { len: 0.34 }; pose.barAxial = false;
  pose.bar = [0, pose.R.hand[1], pose.R.hand[2]]; pose.pulley = pulley;
  pose.armJoints = ['shoulder', 'elbow', 'lumbar'];
  pose.cables = [[pose.bar, pulley]];
  pose.boxes = [box([0, 1.08, -1.02], [0.12, 2.16, 0.12], 0, 'frame'),
    box([0, 0.025, -1.02], [0.42, 0.05, 0.35], 0, 'frame')];
  return pose;
}

function preacherCurlPose(P, e) {
  const pose = seatedBase(-rad(8), 0.54, 0.55);
  pose.girdle = { ret: rad(8), elev: rad(-4) };
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  pose.R.shoulder = S;
  const a = rad(P.padAngle), ud = norm([0.10, -Math.cos(a), Math.sin(a)]);
  const n = norm([0, Math.sin(a), Math.cos(a)]);
  const E = add(S, mul(ud, BODY.Lu));
  const ef = rad(lerp(12, P.topFlex, 1 - e));
  const H = add(E, mul(add(mul(ud, Math.cos(ef)), mul(n, Math.sin(ef))), BODY.Lf));
  fixedArm(pose, E, H);
  pose.bar = [0, H[1], H[2]]; pose.barW = P.load / BODY.mass;
  pose.barStyle = { len: 0.5 }; pose.barAxial = true;
  pose.padContact = add(S, mul(ud, BODY.Lu * 0.63));
  pose.armJoints = ['shoulder', 'elbow'];
  pose.boxes = [
    box([0, 0.46, 0], [0.42, 0.08, 0.42]),
    boxAlong(add(pose.padContact, [0, -0.06, -0.025]), ud, [0.42, BODY.Lu * 0.95, 0.07]),
    box([0, 0.24, 0], [0.1, 0.45, 0.1], 0, 'frame'),
  ];
  return pose;
}

function preacherReactions(pose, P, W, out) {
  const S = pose.R.shoulder, C = pose.padContact;
  let moment = 0;
  for (const f of out) if (f.region === 'upper' || f.region === 'fore')
    moment += cross(sub(f.p, S), f.F)[0];
  const arm = cross(sub(C, S), [0, 1, 0])[0];
  const N = Math.max(0, -moment / arm);
  if (N === 0 && moment > 0.01) pose.warn.push('上臂離開牧師椅墊，接觸反力無法平衡');
  out.push({ p: C, F: [0, N, 0], region: 'upper' });
  const seat = [0, 1, 2].map((axis) => -out.reduce((sum, f) => sum + f.F[axis], 0));
  out.push({ p: pose.R.hip, F: seat, region: 'pelvis' });
  pose.support = { pad: [0, N, 0], seat };
}

function inclineDbCurlPose(P, e) {
  const recl = rad(90 - P.backAngle);
  const pose = seatedBase(-recl, 0.52, 0.52);
  pose.girdle = { ret: rad(8), elev: rad(-4) };
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  pose.R.shoulder = S;
  const ud = norm([0.24, -0.97, 0]);
  const n = [0, 0, 1];
  const E = add(S, mul(ud, BODY.Lu));
  const ef = rad(lerp(15, P.topFlex, 1 - e));
  const H = add(E, mul(add(mul(ud, Math.cos(ef)), mul(n, Math.sin(ef))), BODY.Lf));
  fixedArm(pose, E, H);
  pose.bar = [0, H[1], H[2]]; pose.barStyle = 'none'; pose.barAxial = true;
  pose.barW = 2 * P.load / BODY.mass; pose.gripAxis = [1, 0, 0];
  pose.dumbbells = pairDumbbells(H, pose.gripAxis, P.load);
  pose.armJoints = ['shoulder', 'elbow'];
  pose.boxes = [box([0, 0.45, 0.02], [0.43, 0.08, 0.43]),
    boxAlong(add(add(pose.Pc, mul(pose.u, 0.34)), mul(pose.f, -0.13)), pose.u, [0.38, 0.74, 0.08]),
    box([0, 0.23, 0], [0.11, 0.44, 0.12], 0, 'frame')];
  return pose;
}

function dbFrontRaisePose(P, e) {
  const t = 1 - e, a = rad(lerp(8, P.topHeight, t)), ef = rad(P.elbowBend);
  const pose = standingHands(P, {
    kap: rad(5), lean: rad(3), girdle: { ret: rad(lerp(0, 5, t)), elev: rad(lerp(-4, 10, t)) },
    barW: 2 * P.load / BODY.mass, barAxial: false,
    pole: (tf, r) => [0, 1, 0],
    barAt: (tf, S) => {
      const ud = norm(add(add(mul(tf.u, -Math.cos(a)), mul(tf.f, Math.sin(a))), mul(tf.lat, 0.08)));
      const bend = add(mul(tf.u, Math.sin(a)), mul(tf.f, Math.cos(a)));
      const E = add(S, mul(ud, BODY.Lu));
      return { elbow: E, bar: add(E, mul(add(mul(ud, Math.cos(ef)), mul(bend, Math.sin(ef))), BODY.Lf)) };
    },
  });
  fixedArm(pose, pose.r.elbow, pose.r.bar);
  pose.barStyle = 'none'; pose.barAxial = false;
  pose.gripAxis = [1, 0, 0]; pose.dumbbells = pairDumbbells(pose.R.hand, pose.gripAxis, P.load);
  pose.armJoints = ['shoulder', 'elbow'];
  return pose;
}

// ---------- 高腳杯深蹲 ----------
// 下肢小腿曲線與 squatPose 共用；前側負重策略偏移 -0.08，與前蹲一致。
// 單顆啞鈴垂直捧於胸骨前方（距軀幹軸 21 cm），雙手於上端片下方承托、手肘自然垂於胸側。
function gobletPoseAt(P, e) {
  const w = lerp(0.13, 0.34, P.stance), tau = rad(lerp(8, 38, P.stance));
  const toe = [Math.sin(tau), 0, Math.cos(tau)];
  const { flat: flatShank } = freeSquatShankAngle(P, e, -0.08);
  const flatA = [w, BODY.ankleH, -0.07], foot = squatHeelFoot(P, flatA, toe);
  const thS = flatShank + (foot?.a || 0) * heelShankShare * e + (P._dTh || 0);
  const gam = rad(lerp(70, 118, P.depth)) * e;
  const A = foot?.ankle || flatA;
  let Ls = BODY.Ls, Lt = BODY.Lt, K, Hy, Hz;
  for (let i = 0; i < 4; i++) {
    const Ky = A[1] + Ls * Math.cos(thS), Kz = A[2] + Ls * Math.sin(thS);
    Hy = Ky + Lt * Math.cos(gam); Hz = Kz - Lt * Math.sin(gam);
    const Kx = w + (P.kneePath === 'toes' ? (Kz - A[2]) * Math.tan(tau) : 0);
    K = [Kx, Ky, Kz];
    Ls = Math.sqrt(Math.max(0.01, BODY.Ls ** 2 - (Kx - w) ** 2));
    Lt = Math.sqrt(Math.max(0.01, BODY.Lt ** 2 - (Kx - BODY.hipHalf) ** 2));
  }
  const Pc = [0, Hy, Hz];
  const girdle = { ret: rad(10), elev: rad(-4) };
  const dl = shoulderLocal(girdle);
  const dbW = P.load / BODY.mass;
  const build = (phi) => {
    const u = [0, Math.cos(phi), Math.sin(phi)];
    const tf = trunkFrame(Pc, u);
    const dbC = add(add(Pc, mul(u, 0.40)), mul(tf.f, 0.22));
    dbC[0] = 0;
    const S = toWorld(tf, dl);
    // 雙手托在垂直啞鈴上端片下方（握點距中線 6.8 cm、高於啞鈴中心 5.5 cm）
    const H = [0.068, dbC[1] + 0.055, dbC[2]];
    const arm = { R: {} };
    const pole = norm(add(mul(tf.u, -1), [0.35, 0, 0.45]));
    const armOk = armChain(arm, S, H, pole);
    return { tf, dbC, arm, armOk };
  };
  const pose = { R: {}, warn: [], ok: true };
  pose.R.hip = [BODY.hipHalf, Hy, Hz]; pose.R.knee = K; pose.R.ankle = A;
  const comz = (phi) => {
    const { tf, dbC, arm } = build(phi);
    const pz = { R: { hip: pose.R.hip, knee: K, ankle: A, shoulder: arm.R.shoulder, elbow: arm.R.elbow, hand: arm.R.hand }, Pc: tf.Pc, u: tf.u, toeDir: toe };
    if (foot) applySquatHeel(pz, foot);
    return systemComZ(pz, dbC, dbW);
  };
  let phi;
  if (comz(0) >= 0) phi = 0;
  else if (comz(rad(85)) < 0) { phi = rad(85); pose.ok = false; pose.conflict = '重心無法維持在腳掌中段：軀幹已前傾到極限'; }
  else {
    let lo = 0, hi = rad(85);
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (comz(mid) < 0) lo = mid; else hi = mid; }
    phi = (lo + hi) / 2;
  }
  const { tf, dbC, arm, armOk } = build(phi);
  if (!armOk) { pose.ok = false; pose.conflict = '手臂無法托住胸前啞鈴'; }
  Object.assign(pose, tf);
  pose.phi = phi;
  legChain(pose, A, toe, pose.R.hip);
  applySquatHeel(pose, foot);
  pose.R.knee = K;
  recordSquatKneePath(pose);
  pose.girdle = girdle;
  Object.assign(pose.R, arm.R);
  pose.armPole = arm.armPole;
  pose.R.grip = pose.R.hand;
  pose.gripAxis = [0, 0, 1];
  pose.bar = dbC;
  pose.barStyle = 'none';
  pose.barAxial = false;
  pose.barW = dbW;
  pose.dbLoadPt = [pose.R.hand[0], dbC[1], dbC[2]];
  pose.dbRegion = 'fore';
  pose.dbForceLine = false; // 下肢深蹲力線沿用站姿垂直線（從胸前啞鈴至地面）
  pose.dumbbells = [{ c: dbC, axis: [0, 1, 0], kg: P.load }];
  pose.heelTiltRad = foot?.a || 0;
  pose.cop = [w, 0, 0];
  if (deg(phi) > 55) pose.warn.push('軀幹前傾較大（' + Math.round(deg(phi)) + '°）：股骨相對長的身材較容易如此；可加寬站距、墊高鞋跟或降低深度');
  return pose;
}

// 自體重量動作的全身矢狀面重心。各項係數與 forcesOf 使用同一份節段質量。
function bodyweightCenter(pose, P, assist = 0) {
  const R = pose.R;
  const points = [
    ...segmentPoints(pose).map(([p, m]) => [p, m]),
    [pose.loadPt, (P.load || 0) / (2 * BODY.mass)],
    [pose.kneePad || R.knee, -assist / (2 * BODY.mass)],
  ];
  const mass = points.reduce((s, [, m]) => s + m, 0);
  const z = points.reduce((s, [p, m]) => s + p[2] * m, 0) / mass;
  return { mass, z };
}

function pushupPose(P, e) {
  // 20 cm 墊高與撐起時肩部高於支撐面 58 cm 都是示範幾何，並非文獻量測值。
  const platformH = 0.2, topShoulderAboveSurface = 0.58;
  const handH = P.elevation === 'hands' ? platformH : 0;
  const footH = P.elevation === 'feet' ? platformH : 0;
  const ankle = [0.14, BODY.ankleH + footH, -1.0];
  // 最低點肩部高於手部支撐面 27 cm；腕關節中心高於支撐面 8 cm，也屬示範幾何。
  const shoulderY = handH + lerp(topShoulderAboveSurface, 0.27, e);
  const bodyReach = BODY.Lt + BODY.Ls + BODY.Ltr - 0.02;
  const shoulderZ = (y) => ankle[2] + Math.sqrt(bodyReach ** 2 - (y - ankle[1]) ** 2);
  const shoulder = [0, shoulderY, shoulderZ(shoulderY)];
  const u = norm(sub(shoulder, [0, ankle[1], ankle[2]]));
  const hip = sub(shoulder, mul(u, BODY.Ltr));
  hip[1] += P.pelvis;
  const pose = { R: {}, warn: [], ok: true, ...trunkFrame(hip, u) };
  pose.girdle = { ret: rad(lerp(-6, 8, e)), elev: rad(-4) };
  if (!legChain(pose, ankle, [0, 0, -1], [BODY.hipHalf, hip[1], hip[2]])) {
    pose.ok = false; pose.conflict = '腳尖與骨盆距離超出腿長';
  }
  const S = toWorld(pose, shoulderLocal(pose.girdle));
  // 用撐起時的實際肩關節中心當手位零點；手掌全程固定，不隨肩關節前後移動。
  const topShoulder = [0, handH + topShoulderAboveSurface, shoulderZ(handH + topShoulderAboveSurface)];
  const topU = norm(sub(topShoulder, [0, ankle[1], ankle[2]]));
  const topHip = sub(topShoulder, mul(topU, BODY.Ltr));
  topHip[1] += P.pelvis;
  const topFrame = trunkFrame(topHip, topU);
  const topS = toWorld(topFrame, shoulderLocal({ ret: rad(-6), elev: rad(-4) }));
  const H = [0.167 * P.grip, handH + 0.08, topS[2] + P.handFwd];
  const a = rad(P.flare);
  if (!armChain(pose, S, H, [Math.sin(a), 0, -Math.cos(a)])) {
    pose.ok = false; pose.conflict = '手掌與肩膀距離超出手臂長';
  }
  pose.handContact = [H[0], handH + 0.02, H[2]];
  pose.footContact = [pose.R.toe[0], footH + 0.02, pose.R.toe[2]];
  pose.loadPt = add(pose.Pc, mul(pose.u, 0.25));
  pose.bar = [0, H[1], H[2]]; pose.barStyle = 'none'; pose.barW = P.load / BODY.mass;
  pose.armJoints = ['shoulder', 'elbow'];
  pose.boxes = [];
  if (footH) pose.boxes.push(box([0, footH / 2, pose.footContact[2]], [0.5, footH, 0.4], 0, 'frame'));
  if (handH) pose.boxes.push(box([0, handH / 2, H[2]], [0.7, handH, 0.4], 0, 'frame'));
  return pose;
}

// 固定握點後，以節段質量和外力求矢狀面平衡；徒手懸垂由平衡反求軀幹角。
function suspendedPose(P, e, type) {
  const assisted = type === 'assistpullup';
  const handY = 2.35, handX = 0.167 * P.width, handZ = 0;
  let shoulderY = lerp(2.17, 1.77, e);
  const girdle = { ret: rad(lerp(10, -5, e)), elev: rad(lerp(-8, 16, e)) };
  const make = (phi, shift = 0) => {
    const u = [0, Math.cos(phi), Math.sin(phi)];
    const sl = shoulderLocal(girdle);
    // 徒手：肩落在握線下方，腿相對軀幹後收；軀幹傾角由全身平衡決定。
    // 輔助機：固定膝墊在握線前 5 cm，以髖的平移滿足含膝墊反力的力矩平衡。
    const hip = assisted
      ? [0, shoulderY - BODY.Ltr * u[1], shift]
      : [0, shoulderY - (u[1] * sl[1] - u[2] * sl[2]), (P.diagShoulderOffset || 0) - (u[2] * sl[1] + u[1] * sl[2])];
    const pose = { R: {}, warn: [], ok: true, ...trunkFrame(hip, u), girdle };
    const S = toWorld(pose, sl), H = [handX, handY, handZ];
    if (assisted) {
      const kneeZ = 0.05, dz = kneeZ - hip[2];
      const kneeY = hip[1] - Math.sqrt(Math.max(0.01, BODY.Lt ** 2 - dz ** 2));
      const ankle = [0.14, kneeY - Math.sqrt(BODY.Ls ** 2 - 0.12 ** 2), kneeZ - 0.12];
      pose.R.hip = [BODY.hipHalf, hip[1], hip[2]];
      pose.R.knee = [0.12, kneeY, kneeZ]; pose.R.ankle = ankle;
      pose.R.toe = [ankle[0], ankle[1] - 0.048, ankle[2] - 0.19];
      pose.R.heel = [ankle[0], ankle[1] - 0.048, ankle[2] + 0.06];
      pose.toeDir = [0, 0, -1];
      if (Math.abs(dz) >= BODY.Lt) { pose.ok = false; pose.conflict = '骨盆與固定膝墊距離超出大腿長'; }
    } else {
      const legScale = (BODY.Ls + BODY.Lt) / (DEFAULT_BODY.Ls + DEFAULT_BODY.Lt);
      const legAngle = phi + rad(15 + P.lean);
      const ankle = [0.14, hip[1] - 0.7 * legScale * Math.cos(legAngle), hip[2] - 0.7 * legScale * Math.sin(legAngle)];
      if (!legChain(pose, ankle, [0, 0, -1], [BODY.hipHalf, hip[1], hip[2]])) {
        pose.ok = false; pose.conflict = '腿部姿勢超出可達範圍';
      }
    }
    const pole = P.grip === 'sup' ? [0.5, 0, 1] : [1, 0, 0.1];
    if (!armChain(pose, S, H, pole)) {
      pose.ok = false; pose.conflict = '手臂長度無法到達固定握點';
    }
    pose.loadPt = [BODY.hipHalf / 2, hip[1], hip[2]];
    if (assisted) pose.kneePad = pose.R.knee;
    return pose;
  };
  const balance = () => {
    let lo = assisted ? -0.45 : rad(-45), hi = assisted ? 0.45 : rad(45);
    for (let i = 0; i < 34; i++) {
      const mid = (lo + hi) / 2;
      const z = bodyweightCenter(make(assisted ? -rad(P.lean) : mid, assisted ? mid : 0), P, assisted ? P.assist : 0).z;
      if ((z > handZ) === assisted) hi = mid;
      else lo = mid;
    }
    return make(assisted ? -rad(P.lean) : (lo + hi) / 2, assisted ? (lo + hi) / 2 : 0);
  };
  let pose = balance();
  // 單槓固定在 2.35 m；底點肩高由臂長決定，姿勢改變後重新平衡。
  const S = pose.R.shoulder, H = [handX, handY, handZ];
  const horizontal = Math.hypot(H[0] - S[0], H[2] - S[2]);
  const maxReach = BODY.Lu + BODY.Lf - 0.005;
  if (horizontal < maxReach) {
    shoulderY += e * (H[1] - S[1] - Math.sqrt(maxReach ** 2 - horizontal ** 2));
    pose = balance();
  }
  if (Math.abs(bodyweightCenter(pose, P, assisted ? P.assist : 0).z - handZ) > 0.002) {
    pose.warn.push('重心未落在手部支撐線，懸垂姿勢不穩');
  }
  pose.handContact = pose.R.hand;
  pose.bar = [0, handY, handZ];
  pose.barW = (P.load || 0) / BODY.mass;
  pose.armJoints = ['shoulder', 'elbow'];
  pose.barStyle = { len: Math.max(1.2, 2 * handX + 0.18) };
  pose.supinated = P.grip === 'sup';
  pose.boxes = [
    ...[-1, 1].map((s) => box([s * 0.75, handY / 2, -0.4], [0.055, handY, 0.055], 0, 'frame')),
    ...[-1, 1].map((s) => box([s * 0.75, 0.025, -0.4], [0.35, 0.05, 0.5], 0, 'frame')),
    ...[-1, 1].map((s) => box([s * 0.75, handY, -0.2], [0.055, 0.055, 0.45], 0, 'frame')),
  ];
  if (assisted) {
    pose.boxes.push(box([0, pose.R.knee[1] - 0.065, pose.R.knee[2]], [0.46, 0.1, 0.34]));
    pose.boxes.push(box([0, (pose.R.knee[1] - 0.1) / 2, -0.4], [0.09, pose.R.knee[1] - 0.1, 0.09], 0, 'frame'));
    pose.boxes.push(box([0, pose.R.knee[1] - 0.1, -0.175], [0.09, 0.06, 0.45], 0, 'frame'));
  }
  return pose;
}
// 雙槓閉鏈：兩手固定，肩後伸決定上臂方向，前臂傾角由重心平衡決定。
function dipsPose(P, e) {
  const hand = [0.32, 1.18, 0];
  const lean = rad(P.lean);
  // 50° 是無負重主動肩後伸常模的近似值；預設 depth=0.6 到此角。
  const extension = rad(5 + (15 + 50 * P.depth) * e);
  const girdle = { ret: rad(lerp(-5, 9, e)), elev: rad(-5) };
  const sl = shoulderLocal(girdle);
  const upperYZ = Math.sqrt(Math.max(0, BODY.Lu ** 2 - (hand[0] - sl[0]) ** 2));
  const worldAngle = extension + lean;
  const make = (foreTilt) => {
    const E = [hand[0], hand[1] + BODY.Lf * Math.cos(foreTilt), hand[2] - BODY.Lf * Math.sin(foreTilt)];
    const Sy = E[1] + upperYZ * Math.cos(worldAngle);
    const Sz = E[2] + upperYZ * Math.sin(worldAngle);
    const u = [0, Math.cos(lean), Math.sin(lean)];
    const hip = [0, Sy - u[1] * sl[1] + u[2] * sl[2], Sz - u[2] * sl[1] - u[1] * sl[2]];
    const pose = { R: {}, warn: [], ok: true, ...trunkFrame(hip, u), girdle };
    const ankle = [0.14, hip[1] - 0.62 * (BODY.Ls + BODY.Lt), hip[2] - lerp(0.12, 0.32, e) * BODY.heightM / DEFAULT_BODY.heightM];
    if (!legChain(pose, ankle, [0, 0, -1], [BODY.hipHalf, hip[1], hip[2]])) {
      pose.ok = false; pose.conflict = '腿部姿勢超出可達範圍';
    }
    pose.R.shoulder = toWorld(pose, sl);
    pose.R.elbow = E; pose.R.hand = hand;
    pose.armPole = [0, 0, -1];
    pose.loadPt = [BODY.hipHalf / 2, hip[1], hip[2]];
    return pose;
  };
  let lo = rad(-20), hi = rad(50);
  for (let i = 0; i < 34; i++) {
    const mid = (lo + hi) / 2;
    if (bodyweightCenter(make(mid), P).z > hand[2]) lo = mid;
    else hi = mid;
  }
  const pose = make((lo + hi) / 2);
  if (Math.abs(bodyweightCenter(pose, P).z - hand[2]) > 0.025)
    pose.warn.push('重心未落在手部支撐線，懸垂姿勢不穩');
  if (P.depth > 0.6 && e > 0.9)
    pose.warn.push('肩後伸超過約 50° 主動常模，請依個人活動度調整下放深度');
  pose.handContact = hand;
  pose.bar = [0, hand[1], hand[2]]; pose.barW = (P.load || 0) / BODY.mass;
  pose.barStyle = 'none'; pose.armJoints = ['shoulder', 'elbow'];
  pose.boxes = [
    ...[-1, 1].map((s) => box([s * hand[0], hand[1], -0.04], [0.055, 0.055, 0.85], 0, 'frame')),
    ...[-1, 1].map((s) => box([s * hand[0], hand[1] / 2, -0.34], [0.065, hand[1], 0.065], 0, 'frame')),
  ];
  return pose;
}
function pullupPose(P, e) { return suspendedPose(P, e, P.assist === undefined ? 'pullup' : 'assistpullup'); }

export function solvePose(lift, P, e) {
  const pose = LIFTS[lift].pose(P, e);
  if (!pose.ok) pose.warn.push(`姿勢無法成立：${pose.conflict || '器械或身體位置超出可及範圍'}，請調整姿勢或器材設定`);
  if (pose.armOk === false && !pose.warn.some((w) => w.includes('手臂無法')))
    pose.warn.push('手臂無法到達握點，請調整站位或握距');
  pose.lift = lift;
  pose.body = BODY;
  if (LIFTS[lift].dofs.includes('elbExt')) {
    // MoBL-ARMS pro_sup 的 0° 是中立位；右前臂旋前為正。
    const grip = P.supin || (typeof P.grip === 'string' ? P.grip : null);
    const neutral = grip ? ['neutral', 'v'].includes(grip)
      : ['dips', 'dbpress', 'dbreversefly', 'latraise', 'cablefly', 'pecdeck'].includes(lift);
    pose.foreRot = neutral ? 0 : grip === 'sup' ? rad(-80) : rad(80);
    pose.supinated = pose.foreRot < rad(-40);
  }
  return pose;
}

// 檢查整個軌跡是否成立
export function validate(lift, P) {
  for (let i = 0; i <= 12; i++) {
    const p = solvePose(lift, P, i / 12);
    if (!p.ok) return p.conflict || '姿勢不成立';
  }
  return null;
}

// ---------- 力學分析 ----------
// 外力：各動作的 loads() 只負責器材（槓、接觸力），身體重量與地面反作用力共用
function barOnTrunkLoads(pose, P, W, out) {
  out.push({ p: [BODY.hipHalf * 0.5, pose.bar[1], pose.bar[2]], F: [0, -(pose.barW * W) / 2, 0], region: 'trunk' });
}

function barInHandsLoads(pose, P, W, out) {
  const R = pose.R, barHalf = (pose.barW * W) / 2;
  out.push({ p: R.hand, F: [0, -barHalf, 0], region: 'fore' });
  // 槓貼著腿時，腿把槓往前頂住，手臂不必自己撐住往前的角度
  const dz = R.hand[2] - R.shoulder[2], dy = R.shoulder[1] - R.hand[1];
  const touch = clamp(1 - P.barDist / 0.15, 0, 1);
  const Fc = Math.max(0, (dz * barHalf) / Math.max(0.2, dy)) * touch;
  const Fi = Fc + (P.pullIn || 0) * 0.08 * W;
  out.push({ p: R.hand, F: [0, 0, Fi], region: 'fore' });
  // 槓壓在腿上的反作用力
  const by = pose.bar[1];
  let pt, region;
  if (by <= R.knee[1]) { const t = (by - R.ankle[1]) / (R.knee[1] - R.ankle[1]); pt = lerpV(R.ankle, R.knee, clamp(t, 0, 1)); region = 'shank'; }
  else { const t = (by - R.knee[1]) / (R.hip[1] - R.knee[1]); pt = lerpV(R.knee, R.hip, clamp(t, 0, 1)); region = 'thigh'; }
  out.push({ p: pt, F: [0, 0, -Fi], region });
}

function handBarLoads(pose, P, W, out) {
  const F = [0, -(pose.barW * W) / 2, 0];
  if (pose.barAxial) minimizeAxialMoment(pose, F, -F[1] * 0.5);
  out.push({ p: pose.R.hand, F, region: 'fore' });
}

function benchLoads(pose, P, W, out) {
  out.push({ p: pose.R.hand, F: [0, -(pose.barW * W) / 2, 0], region: 'fore' });
  if (P.pullApart > 0) out.push({ p: pose.R.hand, F: [-P.pullApart * 0.12 * W, 0, 0], region: 'fore' });
}

function bodyweightLoads(pose, P, W, out) {
  if (P.load > 0) out.push({ p: pose.loadPt, F: [0, -P.load * G / 2, 0], region: pose.loadRegion || 'trunk' });
  if (P.assist > 0) out.push({ p: pose.kneePad, F: [0, P.assist * G / 2, 0], region: 'thigh', ext: true });
}

function pushupReactions(pose, P, W, out) {
  // 假設掌根、腳尖的水平接觸力皆為零：外力僅有重力，所以不需摩擦。
  // 由腳尖取矩求手反力，再用垂直力平衡求腳反力；左右各承擔一半。
  const footZ = pose.footContact[2], handZ = pose.handContact[2];
  const totalFy = out.reduce((s, f) => s + f.F[1], 0);
  const moment = -out.reduce((s, f) => s + (f.p[2] - footZ) * f.F[1], 0);
  const handFy = moment / (handZ - footZ), footFy = -totalFy - handFy;
  if (handFy < 0 || footFy < 0) pose.warn.push('手或腳會離開支撐面');
  const hand = [0, handFy, 0], foot = [0, footFy, 0];
  out.push({ p: pose.handContact, F: hand, region: 'fore' }, { p: pose.footContact, F: foot, region: 'foot' });
  pose.support = { hand, foot }; pose.cop = pose.footContact;
  pose.forceLine = { p: pose.handContact, d: [0, 1, 0], is3d: true };
}

function handSupportReactions(pose, P, W, out) {
  // 單一手部支撐線：姿勢求解已使含負重、膝墊的總重心與固定握點同一 Z。
  // 雙槓各手獨立承重；引體的剛體單槓另容許雙手沿槓互推／互拉。
  const Fy = -out.reduce((s, f) => s + f.F[1], 0);
  const F = [0, Fy, 0];
  if (pose.barStyle !== 'none') minimizeAxialMoment(pose, F, Fy * 0.5);
  out.push({ p: pose.handContact, F, region: 'fore' });
  pose.support = { hand: F, knee: P.assist ? [0, P.assist * G / 2, 0] : null };
  pose.forceLine = { p: pose.handContact, d: [0, 1, 0], is3d: true };
}

// 啞鈴共用負重：兩手各自承受自己那顆啞鈴的重力，不套用剛體槓 minimizeAxialMoment（barAxial = false）。
// 作用點在握把中心（pose.dbLoadPt || pose.R.grip || pose.R.hand）；
// 雙啞鈴時 pose.barW = 2 × 每顆重 / BODY.mass，右半身受力 = 每顆重 × G；
// 單顆雙手捧（高腳杯深蹲）時 pose.barW = 啞鈴重 / BODY.mass，右半身受力一半。
function dumbbellLoads(pose, P, W, out) {
  const p = pose.dbLoadPt || pose.R.grip || pose.R.hand;
  const region = pose.dbRegion || 'fore';
  out.push({ p, F: [0, -(pose.barW * W) / 2, 0], region });
  if (pose.dbForceLine !== false) pose.forceLine = { p, d: [0, -1, 0], is3d: true };
}
// 雙手共握同一顆啞鈴可沿握把互推／互拉，與獨立雙啞鈴的接觸不同。
function sharedDumbbellLoads(pose, P, W, out) {
  handBarLoads(pose, P, W, out);
  pose.forceLine = { p: pose.dbLoadPt || pose.R.hand, d: [0, -1, 0], is3d: true };
}

function coronalFootForce(hip, cop, verticalForce) {
  return ((hip[0] - cop[0]) / Math.max(0.3, hip[1] - cop[1])) * verticalForce;
}

export function forcesOf(pose, P, lift) {
  const L = LIFTS[lift];
  const W = BODY.mass * G;
  const R = pose.R, out = [];
  const wt = (p, frac, region) => out.push({ p, F: [0, -frac * W, 0], region });
  // 半身（右側）；seated：坐在器械上，身體重量照算，但由椅墊／靠墊支撐（不算地面反作用力）
  if (L.ground || L.seated) {
    for (const [p, m, region] of segmentPoints(pose)) wt(p, m, region);
  } else {
    for (const [p, m, region] of segmentPoints(pose)) if (region === 'upper' || region === 'fore') wt(p, m, region);
  }
  L.loads(pose, P, W, out);
  if (L.reactions) L.reactions(pose, P, W, out);
  else if (L.ground) {
    // 地面反作用力：力矩平衡決定壓力中心；只有重力時 = 系統重心正下方
    // ext：器械／滑輪施加的外力（可能有水平分量，例如滑輪往前拉），水平分量由腳底摩擦平衡
    const fy = pose.floorY || 0;
    let SFy = 0, Sz = 0, Sy = 0, SFz = 0;
    for (const f of out) {
      if (f.ext || f.F[1] < 0) { SFy += f.F[1]; Sz += f.p[2] * f.F[1]; }
      if (f.ext) { Sy += (f.p[1] - fy) * f.F[2]; SFz += f.F[2]; }
    }
    const m = -SFy;
    const cop = [pose.R.ankle[0], fy, (Sz - Sy) / SFy];
    pose.cop = cop;
    const [rear, front] = pose.supportSpan || [R.heel[2], R.toe[2]];
    if (cop[2] < rear - 0.02) pose.warn.push('重心落在腳跟後方，會往後倒');
    else if (cop[2] > front + 0.02) pose.warn.push('重心落在腳尖前方，會往前倒');
    // 水平分量讓力線在額狀面通過髖關節（雙腳站立時髖外展力矩最小）
    const hip = pose.R.hip;
    const grf = [coronalFootForce(hip, cop, m), m, -SFz];
    if (P.kneesOut > 0) grf[0] -= P.kneesOut * 0.1 * W;
    out.push({ p: cop, F: grf, region: 'foot' });
  }
  return out;
}

function musMoment(forces, J, regions) {
  let M = [0, 0, 0];
  for (const f of forces) if (regions.includes(f.region)) M = add(M, cross(sub(f.p, J), f.F));
  return neg(M);
}

export function forearmAxialDemand(forces, elbow, hand) {
  return dot(musMoment(forces, elbow, ['fore']), norm(sub(hand, elbow)));
}

function jointAngles(pose) {
  const R = pose.R, q = {};
  const angIn = (v, down, fwd) => Math.atan2(dot(v, fwd), dot(v, down));
  const mu = neg(pose.u);
  if (R.hip && R.knee && R.ankle) {
    const t = sub(R.knee, R.hip), s = sub(R.ankle, R.knee);
    q.hipFlex = angIn(t, mu, pose.f);
    q.hipAbd = Math.asin(clamp(dot(norm(t), pose.lat), -1, 1));
    q.kneeFlex = Math.acos(clamp(dot(norm(t), norm(s)), -1, 1));
    const su = neg(s);
    // footUp：腳底的法線（往踝的方向）；平踩地面時 = 正上方
    q.ankleDorsi = Math.atan2(dot(su, pose.toeDir), pose.footUp ? dot(su, pose.footUp) : su[1]);
  }
  const h = norm(sub(R.elbow, R.shoulder)), fo = norm(sub(R.hand, R.elbow));
  const down = neg(pose.u), forward = dot(h, pose.f), lateral = dot(h, pose.lat);
  q.shElev = Math.acos(clamp(dot(h, down), -1, 1));
  q.shPlane = Math.atan2(lateral, forward);
  // 文獻的矢狀面屈曲角：先把上臂投影到軀幹矢狀面，再由垂臂方向量角。
  q.shFlex = Math.atan2(forward, dot(h, down));
  q.shFwd = q.shElev * Math.cos(q.shPlane);
  q.shSide = q.shElev * Math.sin(q.shPlane);
  // 從軀幹向下軸平行運送參考方向；屈肘時由前臂決定上臂軸旋。
  const k = cross(down, h), den = 1 + dot(down, h);
  const refF = den > 1e-5 ? add(add(pose.f, cross(k, pose.f)), mul(cross(k, cross(k, pose.f)), 1 / den)) : pose.f;
  const refS = cross(h, refF);
  const forePlane = sub(fo, mul(h, dot(fo, h)));
  const pole = pose.armPole || pose.f;
  const ref = len(forePlane) > 0.04 ? forePlane : sub(pole, mul(h, dot(pole, h)));
  q.elbFlex = Math.acos(clamp(dot(h, fo), -1, 1));
  q.foreRot = pose.foreRot || 0;
  // 全域軸旋置信權重：手肘接近伸直時前臂投影極短，軸旋無法可靠辨認；
  // 由 15°→60° 線性改為 15°→110° smoothstep 以消除肩推（8.54°→2.07°）、直立划船（8.44°→2.48°）與寬握划船（5.46°→1.21°）的軸旋步長跳動；
  // 影響所有屈肘含肩動作的 q.shRot 與軸旋肌肉長度代理，對划船、彎舉、下拉前四名排名無變動。
  const rotPhase = clamp((q.elbFlex - rad(15)) / rad(95), 0, 1);
  const rotConfidence = rotPhase * rotPhase * (3 - 2 * rotPhase);
  q.shRot = Math.atan2(dot(ref, refS), dot(ref, refF)) * rotConfidence;
  q.dof = {
    hipExt: -(q.hipFlex || 0), hipAbd: q.hipAbd || 0, kneeExt: -(q.kneeFlex || 0), ankPF: -(q.ankleDorsi || 0),
    trunkExt: pose.trunkExt || 0, shFwd: q.shFwd, shSide: q.shSide, shRot: q.shRot, elbExt: -q.elbFlex, foreRot: q.foreRot, scRet: pose.girdle?.ret || 0, scElev: pose.girdle?.elev || 0,
  };
  return q;
}

function solveLinear(K, b) {
  const n = b.length, A = K.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = A[r][c] / d;
      for (let k2 = c; k2 <= n; k2++) A[r][k2] -= k * A[c][k2];
    }
  }
  return A.map((r, i) => r[n] / (r[i] || 1e-12));
}

export function analyze(lift, P, e) {
  const pose = solvePose(lift, P, e);
  const forces = forcesOf(pose, P, lift);
  if (BALANCE_LIFTS.has(lift) && pose.cop && pose.R.heel && pose.R.toe) {
    const actual = (pose.cop[2] - footMidZ(pose)) * 100;
    const target = Number(P.balanceCm) || 0;
    if (Math.abs(actual - target) > 1) {
      pose.warn.push(`重心設定 ${target.toFixed(1)} cm 無法達到，實際偏移 ${actual.toFixed(1)} cm（正值偏腳尖）`);
    }
  }
  const R = pose.R, L = LIFTS[lift];
  const dofs = L.dofs, has = (d) => dofs.includes(d);
  const dem = {};
  let shoulderMoment = 0, shoulderPhysical = null;
  if (has('hipExt') || has('hipAbd')) {
    const Mh = musMoment(forces, R.hip, ['foot', 'shank', 'thigh']);
    if (has('hipExt')) dem.hipExt = dot(Mh, norm(cross(neg(pose.u), neg(pose.f))));
    if (has('hipAbd')) dem.hipAbd = dot(Mh, pose.hipAbdAxis || norm(cross(neg(pose.u), pose.lat)));
  }
  // 深蹲的膝屈伸軸跟隨膝路徑；踝軸仍跟腳掌。缺少脛股軸旋，扭轉量僅作幾何代理。
  const fx = pose.hinge || ((pose.kneeDir || pose.toeDir) && norm(cross([0, 1, 0], pose.kneeDir || pose.toeDir)));
  if (has('kneeExt')) {
    const Mk = musMoment(forces, R.knee, ['foot', 'shank']);
    dem.kneeExt = dot(Mk, neg(fx));
  }
  if (has('ankPF')) {
    const Ma = musMoment(forces, R.ankle, ['foot']);
    dem.ankPF = dot(Ma, pose.hinge || norm(cross(pose.toeDir, [0, -1, 0])));
  }
  if (has('trunkExt')) {
    const L5 = add(pose.Pc, mul(pose.u, lumbarOffsetM(lumbarPoint)));
    const Mu = musMoment(forces, L5, ['trunk', 'upper', 'fore']);
    dem.trunkExt = dot(Mu, norm(cross(pose.u, neg(pose.f)))); // 肌肉作用在上半身的伸展力矩
  }
  if (has('shFwd')) {
    const Ms = musMoment(forces, R.shoulder, ['upper', 'fore']);
    shoulderMoment = len(Ms);
    const qShoulder = jointAngles(pose), axes = shoulderAxes(qShoulder);
    const worldAxis = (v) => add(add(mul(pose.lat, v[0]), mul(pose.u, v[1])), mul(pose.f, v[2]));
    const basis = shoulderBasis(qShoulder);
    shoulderPhysical = [basis.elev, basis.hadd, basis.long].map((axis) => dot(Ms, worldAxis(axis)));
    dem.shFwd = dot(Ms, worldAxis(axes.fwd));
    if (has('shSide')) dem.shSide = dot(Ms, worldAxis(axes.side));
    if (has('shRot')) dem.shRot = dot(Ms, norm(sub(R.elbow, R.shoulder)));
  }
  if (has('elbExt')) {
    const Me = musMoment(forces, R.elbow, ['fore']);
    const fx = cross(sub(R.elbow, R.shoulder), sub(R.hand, R.elbow));
    dem.elbExt = len(fx) < 1e-5 ? 0 : dot(Me, neg(norm(fx)));
    // 接近伸直時，把肘往伸直方向壓的力矩由骨性卡榫（鷹嘴）承受，不需要屈肌
    const ef = Math.acos(clamp(dot(norm(sub(R.elbow, R.shoulder)), norm(sub(R.hand, R.elbow))), -1, 1));
    if (dem.elbExt < 0) dem.elbExt *= clamp((deg(ef) - 8) / 17, 0, 1);
  }
  if (has('elbExt')) {
    // 外力的軸向分量仍記錄；固定／共握物體的接觸反力偶由下方反算。
    dem.foreRot = forearmAxialDemand(forces, R.elbow, R.hand);
  }
  if (has('scRet')) {
    // 手臂的負荷經肩關節傳到肩胛，再由肩胛肌群固定在軀幹上：力矩取在胸鎖關節
    const SCJ = toWorld(pose, girdleForBody().scj);
    const Mg = musMoment(forces, SCJ, ['upper', 'fore']);
    dem.scRet = dot(Mg, pose.u);
    dem.scElev = dot(Mg, pose.f);
  }

  const q = jointAngles(pose);
  const muscles = liftMuscles(lift);
  // 保留 dem.shFwd／shSide 的廣義座標語意供介面與關節快照；肌肉平衡改用
  // 同一胸廓正交基底的外力矩與三維力臂，避免高上舉時 sinc(t) 壓縮方程。
  // 未列 shRot 的動作仍由固定的軸旋自由度承受長軸反力矩。
  // 單一 shFwd 自由度（硬舉）仍代表原本的旋轉向量切向軸；只有雙軸同時存在
  // 才能做可逆的二維基底轉換。shRot 若存在，已是正交長軸的物理分量。
  const shoulderFrame = has('shFwd') && has('shSide') ? shoulderBasis(q) : null;
  const balanceDofs = dofs.map((d) => shoulderFrame ? ({ shFwd: 'shElev3d', shSide: 'shHadd3d', shRot: 'shLong3d' }[d] || d) : d);
  const balanceDemand = balanceDofs.map((d) => {
    if (d === 'shElev3d') return shoulderPhysical[0];
    if (d === 'shHadd3d') return shoulderPhysical[1];
    if (d === 'shLong3d') return shoulderPhysical[2];
    return dem[d] || 0;
  });
  // 偏好與共同收縮
  const pref = Object.fromEntries(muscles.map((m) => [m.id, 1]));
  for (const p of L.params) {
    if (p.mech !== 'C') continue;
    const v = P[p.key] || 0;
    for (const id of p.pref[0]) for (const m of muscles) if (m.id === id || m.group === id) pref[m.id] *= Math.pow(3, -v);
    for (const id of p.pref[1]) for (const m of muscles) if (m.id === id || m.group === id) pref[m.id] *= Math.pow(3, v);
  }
  const lb = Object.fromEntries(muscles.map((m) => [m.id, 0]));
  if (P.brace && lb.ra !== undefined) lb.ra = 0.3 * P.brace;
  L.lowerBounds?.(P, lb);
  // 拆分不變的努力成本：同群同活化時，Σ aᵢ²/prefᵢ = a²/pref群組。
  // F群組只計本動作參與求解的子部位；膝屈時含 bfsh，只有髖伸時不含不跨髖的 bfsh。
  for (const id of Object.keys(MUSCLE_GROUPS)) {
    const children = muscles.filter((m) => m.group === id);
    if (!children.length) continue;
    const groupF = children.reduce((sum, m) => sum + m.F, 0);
    for (const m of children) pref[m.id] *= groupF / m.F;
  }

  // 由力臂定義 r(θ) = -∂L/∂θ，對隨角度變化的力臂沿自由度區間積分 ΔL = -∫ r(θ) dθ，
  // 避免端點力臂劇烈變化時以 r(q)·(q - q_ref) 放大位移與被動張力。
  const DOF_ANGLE_MAP = {
    hipExt: ['hipFlex', -1], kneeExt: ['kneeFlex', -1], ankPF: ['ankleDorsi', -1],
    shFwd: ['shFwd', 1], shSide: ['shSide', 1], shRot: ['shRot', 1], elbExt: ['elbFlex', -1], foreRot: ['foreRot', 1],
  };
  const qSample = { ...q };
  const integrateArm = (armFn, key, sign, lo, hi) => {
    const dq = hi - lo;
    if (!dq) return 0;
    const N = 8, step = dq / N, prev = qSample[key];
    let sum = 0;
    for (let k = 0; k < N; k++) {
      qSample[key] = sign * (lo + (k + 0.5) * step);
      if (key === 'shFwd' || key === 'shSide') {
        qSample.shElev = Math.hypot(qSample.shFwd, qSample.shSide);
        qSample.shPlane = Math.atan2(qSample.shSide, qSample.shFwd);
        qSample.shFlex = Math.atan2(Math.sin(qSample.shElev) * Math.cos(qSample.shPlane), Math.cos(qSample.shElev));
      }
      sum += armFn(qSample);
    }
    qSample[key] = prev;
    if (key === 'shFwd' || key === 'shSide') {
      qSample.shElev = q.shElev;
      qSample.shPlane = q.shPlane;
      qSample.shFlex = q.shFlex;
    }
    return -(sum / N) * dq;
  };
  const dofDisplacement = (arm, d) => {
    if (!arm) return 0;
    const q0 = DOF_REF[d] ?? 0, q1 = q.dof[d] ?? q0, dq = q1 - q0;
    if (!dq) return 0;
    if (typeof arm !== 'function') return -arm * dq;
    const mapped = DOF_ANGLE_MAP[d];
    if (!mapped) return -arm(q) * dq;
    const [key, sign] = mapped;
    // 跨越 0° 時拆兩段積分，避免分段力臂在 0° 附近產生數值誤差
    return (q0 < 0) !== (q1 < 0)
      ? integrateArm(arm, key, sign, q0, 0) + integrateArm(arm, key, sign, 0, q1)
      : integrateArm(arm, key, sign, q0, q1);
  };

  // 肩部雙軸（shFwd、shSide）沿上臂單位球面大圓路徑積分 ΔL = -∫ v(h(s))·ω ds，
  // 不依賴旋轉向量 180° 分支，避免肩推鎖死附近因 shFwd/shSide 快速換號造成長度擺動。
  const humerusDir = (x, y) => {
    const t = Math.hypot(x, y), c = t < 1e-8 ? 1 : x / t, sn = t < 1e-8 ? 0 : y / t;
    return [Math.sin(t) * sn, -Math.cos(t), Math.sin(t) * c];
  };
  const hRef = has('shFwd') && has('shSide') ? humerusDir(DOF_REF.shFwd, DOF_REF.shSide) : null;
  const hNow = hRef ? humerusDir(q.shFwd, q.shSide) : null;
  const shAxis = hRef ? cross(hRef, hNow) : null;
  const shSin = shAxis ? len(shAxis) : 0;
  const shAng = hRef ? Math.atan2(shSin, clamp(dot(hRef, hNow), -1, 1)) : 0;
  const shW = shAng > 1e-7 && shSin > 1e-9 ? mul(shAxis, 1 / shSin) : null;

  const info = muscles.map((m) => {
    const shVec = m.arms.shFwd?.shoulderVec;
    const v = shoulderFrame && shVec ? shVec(q) : null;
    const arms = balanceDofs.map((d) => {
      if (d === 'shElev3d') return v ? dot(v, shoulderFrame.elev) : 0;
      if (d === 'shHadd3d') return v ? dot(v, shoulderFrame.hadd) : 0;
      const a = m.arms[d === 'shLong3d' ? 'shRot' : d];
      return typeof a === 'function' ? a(q) : a || 0;
    });
    let displacement = 0;
    if (shVec && hRef) {
      if (shW) {
        const N = 10;
        let sum = 0;
        for (let k = 0; k < N; k++) {
          const a = ((k + 0.5) / N) * shAng, ca = Math.cos(a), sa = Math.sin(a);
          const hs = add(mul(hRef, ca), mul(cross(shW, hRef), sa));
          qSample.shElev = Math.acos(clamp(-hs[1], -1, 1));
          qSample.shPlane = Math.atan2(hs[0], hs[2]);
          qSample.shFlex = Math.atan2(hs[2], -hs[1]);
          sum += dot(shVec(qSample), shW);
        }
        qSample.shElev = q.shElev; qSample.shPlane = q.shPlane; qSample.shFlex = q.shFlex;
        displacement += -(sum / N) * shAng;
      }
      dofs.forEach((d) => { if (d !== 'shFwd' && d !== 'shSide') displacement += dofDisplacement(m.arms[d], d); });
    } else {
      dofs.forEach((d) => { displacement += dofDisplacement(m.arms[d], d); });
    }
    // optDofs：不分析力矩、但關節角度仍影響肌肉長度（例如坐姿腿彎舉時髖屈曲拉長膕繩肌）
    for (const d of L.optDofs || []) displacement += dofDisplacement(m.arms[d], d);
    const geometry = FIBER_GEOMETRY[m.id];
    // 剛性肌腱：Lmt0=Lt+Lf cos(alpha)，Lf_now≈(Lmt0+ΔLmt-Lt)/cos(alpha)。
    // 羽狀角暫固定在最佳長度值；此值用於診斷，尚未求解腱伸長與羽狀角隨收縮變化。
    const rigidFiberLength = geometry
      ? (geometry[0] + m.Lf * Math.cos(geometry[1]) + displacement - geometry[0]) / (m.Lf * Math.cos(geometry[1]))
      : null;
    const legacyLength = 1 + displacement / (m.Lmt || m.Lf);
    const l = legacyLength;
    // 採 Thelen2003Muscle 的 Gaussian 形式與 KshapeActive=0.45，輸入仍是現有 Lmt 長度代理，尚非真實纖維長。
    const fl = Math.exp(-((l - 1) ** 2) / 0.45);
    const pas = l <= 1.15 ? 0 : Math.min(0.8, 0.5 * ((l - 1.15) / 0.45) ** 2);
    const Feff = m.F * fl;
    return { m, arms, l, lRigid: rigidFiberLength, pas, A: arms.map((r) => r * Feff), F: m.F };
  });
  const b0 = balanceDemand.map((d, j) => d - info.reduce((s, x) => s + x.pas * x.F * x.arms[j], 0));
  const act = Object.fromEntries(info.map((x) => [x.m.id, 0]));
  const fixed = new Set();
  for (let it = 0; it < 80; it++) {
    const free = info.filter((x) => !fixed.has(x.m.id));
    const b = b0.map((v, j) => v - info.filter((x) => fixed.has(x.m.id)).reduce((s, x) => s + act[x.m.id] * x.A[j], 0));
    const n = balanceDofs.length;
    const K = Array.from({ length: n }, () => Array(n).fill(0));
    let tr = 0;
    for (const x of free) {
      const p = pref[x.m.id];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) K[i][j] += p * x.A[i] * x.A[j];
    }
    for (let i = 0; i < n; i++) tr += K[i][i];
    for (let i = 0; i < n; i++) K[i][i] += 1e-7 * tr + 1e-9;
    const lam = solveLinear(K, b);
    const want = (x) => pref[x.m.id] * x.A.reduce((s, v, i) => s + v * lam[i], 0);
    for (const x of free) act[x.m.id] = want(x);
    // 一次只固定最違反下限的一條；收斂後檢查是否有該釋放的
    let worst = null, wv = -1e-9;
    for (const x of free) { const d = act[x.m.id] - lb[x.m.id]; if (d < wv) { wv = d; worst = x; } }
    if (worst) { act[worst.m.id] = lb[worst.m.id]; fixed.add(worst.m.id); continue; }
    let rel = null, rv = 1e-9;
    for (const x of info) if (fixed.has(x.m.id)) { const d = want(x) - lb[x.m.id]; if (d > rv) { rv = d; rel = x; } }
    if (rel) { fixed.delete(rel.m.id); continue; }
    break;
  }
  const mus = {};
  for (const x of info) {
    const a = Math.max(0, act[x.m.id]);
    mus[x.m.id] = { a, p: x.pas, s: Math.min(a, 1.5) + x.pas, force: x.F * (a * Math.exp(-((x.l - 1) ** 2) / 0.45) + x.pas), l: x.l, lRigid: x.lRigid, len: x.l > 1.12 ? '拉長' : x.l < 0.9 ? '縮短' : '中段' };
  }
  // 合群值僅供一般視圖與既有研究檢查；求解器只使用上面的獨立子部位。
  for (const id of Object.keys(MUSCLE_GROUPS)) {
    const children = info.filter((x) => x.m.group === id);
    if (!children.length) continue;
    const F = children.reduce((s, x) => s + x.F, 0);
    const weighted = (key) => children.reduce((s, x) => s + x.F * mus[x.m.id][key], 0) / F;
    const l = weighted('l');
    mus[id] = { a: weighted('a'), p: weighted('p'), s: weighted('s'),
      force: children.reduce((s, x) => s + mus[x.m.id].force, 0), l, lRigid: null,
      len: l > 1.12 ? '拉長' : l < 0.9 ? '縮短' : '中段' };
  }
  // 關節負擔
  const rom = {};
  if (has('hipExt') && deg(q.hipFlex) > ROM_HINTS.hipFlex) rom.hip = '髖屈曲接近模型提示線';
  if (has('kneeExt') && deg(q.kneeFlex) > ROM_HINTS.kneeFlex) rom.knee = '膝屈曲高於常模參考值，按個人活動度複查';
  if (has('ankPF') && deg(q.ankleDorsi) > ROM_HINTS.ankleDorsi) rom.ankle = '踝背屈高於負重常模參考值，按個人活動度複查';
  if (has('shFwd') && Math.abs(deg(q.shPlane)) > ROM_HINTS.shPlane) rom.shoulder = '上臂伸到身後，留意肩前側';
  if (has('elbExt') && deg(q.elbFlex) > ROM_HINTS.elbFlex) rom.elbow = '肘屈曲高於主動常模參考值，按個人活動度複查';
  if (has('shFwd') && deg(q.shElev) > (Math.abs(deg(q.shPlane)) < 45 ? ROM_HINTS.shFlex : ROM_HINTS.shAbd)) rom.shoulder = '舉臂高於主動常模參考值，按個人活動度複查';
  const joints = {};
  if (has('hipExt')) joints.hip = Math.hypot(dem.hipExt, dem.hipAbd || 0);
  if (has('kneeExt')) joints.knee = Math.abs(dem.kneeExt);
  if (has('ankPF')) joints.ankle = Math.abs(dem.ankPF);
  if (has('trunkExt')) joints.lumbar = Math.abs(dem.trunkExt);
  if (has('shFwd')) joints.shoulder = shoulderMoment;
  if (has('elbExt')) joints.elbow = Math.abs(dem.elbExt);
  if (has('scRet')) joints.scap = Math.hypot(dem.scRet, dem.scElev);
  const forearmContactMoment = has('elbExt') && !has('foreRot')
    ? dem.foreRot - info.reduce((sum, x) => sum + mus[x.m.id].force * (x.m.arms.foreRot?.(q) || 0), 0)
    : 0;
  // 未求解軸旋的肩動作仍有完整三維外力矩：長軸外力矩與肌肉軸向扭矩分開列出，
  // 差額 constraint 是固定軸旋所需的約束／被動反力矩（未驗證，不是肌肉輸出）。
  // 若 shRot 參與求解，constraint 僅是數值殘差。
  let shoulderLong = null;
  if (shoulderFrame) {
    // liftMuscles 會移除未列自由度的力臂；肌肉軸向扭矩須用原肌肉的實際軸向作用。
    const muscle = info.reduce((sum, x) => {
      const arm = MUSCLE_BY_ID[x.m.id].arms.shRot;
      return sum + mus[x.m.id].force * (typeof arm === 'function' ? arm(q) : arm || 0);
    }, 0);
    shoulderLong = { external: shoulderPhysical[2], muscle, constraint: shoulderPhysical[2] - muscle };
  }
  return { pose, dem, q, mus, joints, rom, forearmContactMoment, shoulderLong };
}

export function peakAnalysis(lift, P, n = 20) {
  const peak = {}; const jpeak = {};
  for (let i = 0; i <= n; i++) {
    const r = analyze(lift, P, i / n);
    for (const [k, v] of Object.entries(r.mus)) {
      if (!peak[k] || v.s > peak[k].s) peak[k] = { ...v };
    }
    for (const [k, v] of Object.entries(r.joints)) jpeak[k] = Math.max(jpeak[k] || 0, v);
  }
  return { mus: peak, joints: jpeak };
}
