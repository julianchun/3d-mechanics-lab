"""把 TSM 肩帶力臂（方案 B 或 A）在上臂方向格點上的值，擬合成上臂單位向量 h 的多項式（沿用 src/shoulder-arms.js 的
shoulderFitScap 形式：h = [sinθ·sinφ（外側）, −cosθ（上）, sinθ·cosφ（前）]，單項式 x^i y^j z^k），並以各姿勢（不在格點內的產品姿勢）做樣本外驗證。
用法：python3 tools/research/fit_scap_arms.py --grid g0.json g1.json --check A.json B.json --axis-source B --deg 2 --json-out fits.json
"""
import argparse
import itertools
import json
import math

import numpy as np

from build_scap_tables import TSM_GROUPS, tsm_group


def exps(deg):
    return [(i, j, k) for i in range(deg + 1) for j in range(deg + 1 - i) for k in range(deg + 1 - i - j)]


def h_of(theta_deg, phi_deg):
    t, p = math.radians(theta_deg), math.radians(phi_deg)
    return [math.sin(t) * math.sin(p), -math.cos(t), math.sin(t) * math.cos(p)]


def design(samples, E):
    return np.array([[h[0] ** a * h[1] ** b * h[2] ** c for a, b, c in E] for h in samples])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--grid", nargs="+", required=True)
    ap.add_argument("--check", nargs="+", required=True)
    ap.add_argument("--source", choices=("A", "B"), default="B")
    ap.add_argument("--deg", type=int, default=2)
    ap.add_argument("--ridge", type=float, default=1e-4)
    ap.add_argument("--json-out")
    ap.add_argument("--js-out", help="輸出與 src/shoulder-arms.js 的 SHOULDER_SCAP_FITS 同格式（[scElev 係數, scRet 係數]，h 為 [外側, 上, 前]）的片段；只供檢視，不寫入 src/")
    a = ap.parse_args()
    key = f"{a.source}_arms_m"
    train, F = [], None
    for path in a.grid:
        d = json.load(open(path))
        F = d["F_N"]
        for en in d["entries"]:
            train += en["samples"]
    test = []
    for path in a.check:
        d = json.load(open(path))
        for en in d["entries"]:
            test += [dict(s, _id=en["id"]) for s in en["samples"]]
    E = exps(a.deg)
    Xt = design([h_of(s["arm_elevation_deg"], s["arm_plane_deg"]) for s in train], E)
    Xv = design([h_of(s["arm_elevation_deg"], s["arm_plane_deg"]) for s in test], E)
    out = {"degree": a.deg, "exps": E, "source": a.source, "groups": {}}
    print(f"訓練 {len(train)} 格，驗證 {len(test)} 個產品姿勢；來源方案 {a.source}；單位 mm")
    print("群組.軸       訓練RMS 訓練max 驗證RMS 驗證max 值域(min..max)")
    for g, members in TSM_GROUPS.items():
        for ai, axis in enumerate(("scElev", "scRet")):
            y = np.array([1000 * tsm_group(F, s[key][axis], members) for s in train])
            yv = np.array([1000 * tsm_group(F, s[key][axis], members) for s in test])
            A = Xt.T @ Xt + a.ridge * np.eye(len(E))
            c = np.linalg.solve(A, Xt.T @ y)
            rt, rv = Xt @ c - y, Xv @ c - yv
            print(f"{g:8s}{axis:7s} {np.sqrt(np.mean(rt**2)):7.1f} {np.abs(rt).max():7.1f} {np.sqrt(np.mean(rv**2)):7.1f} {np.abs(rv).max():7.1f}  {y.min():6.0f}..{y.max():6.0f}")
            out["groups"].setdefault(g, {})[axis] = {"coef_m": (c / 1000).tolist(), "train_rms_mm": float(np.sqrt(np.mean(rt**2))),
                                                      "val_rms_mm": float(np.sqrt(np.mean(rv**2))), "val_max_mm": float(np.abs(rv).max())}
    if a.js_out and a.deg == 2:
        r6 = lambda v: float(f"{v:.6g}")
        body = ",\n".join(f"  {g}: [{json.dumps([r6(x) for x in v['scElev']['coef_m']])}, {json.dumps([r6(x) for x in v['scRet']['coef_m']])}]"
                          for g, v in out["groups"].items())
        open(a.js_out, "w").write("// 研究用片段（deg 2，與 SHOULDER_FIT_EXP.sc 同單項式順序）；單位 m\nexport const SHOULDER_SCAP_FITS_TSM = {\n" + body + ",\n};\n")
    if a.json_out:
        json.dump(out, open(a.json_out, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
