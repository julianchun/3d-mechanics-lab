"""由 docs/research/results/scapular-arms-data.json 的 TSM 映射 B 擬合係數產生產品肩帶力臂。

執行：python3 tools/scapular_arms_product.py [--check]
不需要 TSM／OpenSim 環境；係數本身的重現流程見 docs/research/scapular-arms.md「重現」。
第一步輸出 lat、pecs、pecc；第二步加入其餘肩胛胸廓肌（uptrap、midrhom＝產品 midtrap、lowtrap、serr、pmin、levscap；midtrap／rhom 供 DAS3 實驗組分束使用）。
"""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / "docs" / "research" / "results" / "scapular-arms-data.json"
OUTPUT = ROOT / "src" / "scapular-arms.js"
IDS = ("lat", "pecs", "pecc", "uptrap", "midrhom", "lowtrap", "serr", "pmin", "levscap", "midtrap", "rhom")


def r6(v):
    return float(f"{v:.6g}")


def render(data):
    fit = data["fit_B_deg2"]
    if fit["source"] != "B" or fit["degree"] != 2:
        raise SystemExit("資料檔不是映射 B 二次擬合")
    lines = [
        "// 由 tools/scapular_arms_product.py 自 docs/research/results/scapular-arms-data.json 產生，請勿手改。",
        "// 來源：Seth TSM 肩胛胸廓模型（ComputationalBiomechanicsLab/rmr-solver 的 TSM_subject_noWeight.osim，工具固定提交 399e5bc，",
        "// 模型 SHA-256 c357e61e…c7a9ff），映射 B（肩胛貼胸廓的可行位移）；以 78 個上臂方向格點求力臂後，對 h=[外側,上,前] 二次擬合。",
        "// 單位 m；每個鍵 [scElev 係數, scRet 係數]，單項式順序同 exps。TSM 受試者較小（上臂 0.247 m 對產品 0.287 m），力臂未做體型縮放。",
    ]
    for g in IDS:
        e, r = fit["groups"][g]["scElev"], fit["groups"][g]["scRet"]
        lines.append(f"// {g}：訓練 RMS scElev {e['train_rms_mm']:.1f}／scRet {r['train_rms_mm']:.1f} mm，"
                     f"產品姿勢樣本外 RMS {e['val_rms_mm']:.1f}／{r['val_rms_mm']:.1f} mm（最大 {e['val_max_mm']:.1f}／{r['val_max_mm']:.1f}）。")
    lines.append(f"export const SCAPULAR_ARMS_EXP = {json.dumps(fit['exps'])};")
    lines.append("export const SCAPULAR_ARMS_TSM_B = {")
    for g in IDS:
        c = fit["groups"][g]
        lines.append(f"  {g}: {json.dumps([[r6(x) for x in c['scElev']['coef_m']], [r6(x) for x in c['scRet']['coef_m']]])},")
    lines.append("};")
    lines += [
        "// axis：0 = scElev（上提＋）、1 = scRet（後收＋）；q 需有 shElev、shPlane（rad）。",
        "export function scapularArmTsm(id, axis, q) {",
        "  const t = q.shElev, p = q.shPlane;",
        "  const h = [Math.sin(t) * Math.sin(p), -Math.cos(t), Math.sin(t) * Math.cos(p)];",
        "  return SCAPULAR_ARMS_TSM_B[id][axis].reduce((sum, c, i) => {",
        "    const [a, b, d] = SCAPULAR_ARMS_EXP[i];",
        "    return sum + c * h[0] ** a * h[1] ** b * h[2] ** d;",
        "  }, 0);",
        "}",
    ]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = render(json.load(open(DATA)))
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != expected:
            raise SystemExit("src/scapular-arms.js 與 scapular-arms-data.json 不一致")
        print("肩帶力臂產生檔一致")
    else:
        OUTPUT.write_text(expected)
        print(OUTPUT)
