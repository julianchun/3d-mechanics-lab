// 由 tools/scapular_arms_product.py 自 docs/research/results/scapular-arms-data.json 產生，請勿手改。
// 來源：Seth TSM 肩胛胸廓模型（ComputationalBiomechanicsLab/rmr-solver 的 TSM_subject_noWeight.osim，工具固定提交 399e5bc，
// 模型 SHA-256 c357e61e…c7a9ff），映射 B（肩胛貼胸廓的可行位移）；以 78 個上臂方向格點求力臂後，對 h=[外側,上,前] 二次擬合。
// 單位 m；每個鍵 [scElev 係數, scRet 係數]，單項式順序同 exps。TSM 受試者較小（上臂 0.247 m 對產品 0.287 m），力臂未做體型縮放。
// lat：訓練 RMS scElev 2.4／scRet 4.7 mm，產品姿勢樣本外 RMS 3.0／4.4 mm（最大 14.3／19.4）。
// pecs：訓練 RMS scElev 2.5／scRet 1.5 mm，產品姿勢樣本外 RMS 4.1／2.9 mm（最大 18.8／8.2）。
// pecc：訓練 RMS scElev 1.1／scRet 1.3 mm，產品姿勢樣本外 RMS 2.6／2.9 mm（最大 7.0／6.9）。
export const SCAPULAR_ARMS_EXP = [[0, 0, 0], [0, 0, 1], [0, 0, 2], [0, 1, 0], [0, 1, 1], [0, 2, 0], [1, 0, 0], [1, 0, 1], [1, 1, 0], [2, 0, 0]];
export const SCAPULAR_ARMS_TSM_B = {
  lat: [[-0.0930667, -0.0160923, -0.0314138, -0.00543293, 0.00304077, -0.0299374, -0.0167718, -0.00309016, 0.0103467, -0.0317156], [-0.00529874, 0.0528612, 0.00831679, -0.0162257, -0.0233568, -0.00026692, -0.00628709, -0.0128117, 0.0113346, -0.0133486]],
  pecs: [[-0.0244377, -0.0183528, -0.0143598, -0.00759215, 0.00213515, -0.00616999, -0.00442191, 0.00834923, 0.00627981, -0.00390795], [-0.0320706, -0.00284549, -0.00745019, 0.00456068, -0.00324224, -0.0141557, -0.0120375, 0.000309355, 0.00106588, -0.0104647]],
  pecc: [[0.00308266, 0.00350527, 0.00312467, -0.00619059, -0.00250926, -0.00441776, -0.000162635, -0.00306148, 0.0108823, 0.00437575], [-0.0144136, -0.0119146, -0.00510952, -0.0105723, 0.00168391, -0.00579031, -0.00972826, 0.00204773, 0.000902035, -0.00351374]],
};
// axis：0 = scElev（上提＋）、1 = scRet（後收＋）；q 需有 shElev、shPlane（rad）。
export function scapularArmTsm(id, axis, q) {
  const t = q.shElev, p = q.shPlane;
  const h = [Math.sin(t) * Math.sin(p), -Math.cos(t), Math.sin(t) * Math.cos(p)];
  return SCAPULAR_ARMS_TSM_B[id][axis].reduce((sum, c, i) => {
    const [a, b, d] = SCAPULAR_ARMS_EXP[i];
    return sum + c * h[0] ** a * h[1] ** b * h[2] ** d;
  }, 0);
}
