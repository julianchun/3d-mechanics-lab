// 懸垂與雙槓的矢狀面靜力診斷；每列是左右對稱半身合計。
import { CATALOG } from '../src/catalog.js';
import { analyze, defaultParams, forcesOf, BODY } from '../src/biomech.js';

const ids = new Set(['pullup', 'pullup-wide', 'chinup', 'assist-pullup', 'assist-chinup', 'dips', 'dips-upright']);
const rows = [];
for (const item of CATALOG.filter((c) => ids.has(c.id))) {
  const P = { ...defaultParams(item.lift), ...item.set };
  for (let i = 0; i <= 20; i++) {
    const e = i / 20;
    const r = analyze(item.lift, P, e);
    const hand = r.pose.handContact;
    const forces = forcesOf(r.pose, P, item.lift);
    const nonHand = forces.filter((f) => f.p !== hand || f.region !== 'fore' || f.F[1] < 0);
    const totalY = nonHand.reduce((sum, f) => sum + f.F[1], 0);
    const momentY = nonHand.reduce((sum, f) => sum + f.p[2] * f.F[1], 0);
    const effectiveCenterZ = momentY / totalY;
    const coupleX = 2 * nonHand.reduce((sum, f) => sum + (f.p[2] - hand[2]) * f.F[1], 0);
    // 若缺口全交由握把力偶承擔，肩部每側需額外平衡此力偶的一半。
    const shoulderCoupleX = -coupleX / 2;
    const handFy = r.pose.support.hand[1];
    const shoulderHandMomentX = (hand[2] - r.pose.R.shoulder[2]) * handFy;
    rows.push({ id: item.id, e, centerOffsetCm: +(100 * (effectiveCenterZ - hand[2])).toFixed(3),
      coupleNm: +coupleX.toFixed(3), shoulderCoupleNm: +shoulderCoupleX.toFixed(3),
      shoulderHandMomentNm: +shoulderHandMomentX.toFixed(3), shoulderMomentNm: +r.joints.shoulder.toFixed(3),
      kneePadZ: r.pose.kneePad?.[2] ?? null, kneeFy: r.pose.support.knee?.[1] ?? 0,
      torsoDeg: +(Math.atan2(r.pose.u[2], r.pose.u[1]) * 180 / Math.PI).toFixed(2),
      ok: r.pose.ok, warn: r.pose.warn });
  }
}
console.log(JSON.stringify({ bodyKg: BODY.mass, convention: 'Z 正向為身體前方；力偶為雙側合計，正值繞 +X。', rows }, null, 2));
