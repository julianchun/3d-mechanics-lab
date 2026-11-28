"""以 OpenSim 4.6 參考長度（feat/scapula-tsm 的 tools/data/opensim-ref）核對 TSM 在三個獨立肩胛座標上的力臂，
並把 OpenSim 與本工具的座標力臂各自經 dq/dθ 映射到產品兩軸（方案 B），比較映射後的差。

用法：/tmp/t44-py/bin/python tools/research/check_scap_arms_opensim.py --tsm-tools /tmp/t44-tsm/tools \\
        --ref /tmp/t44-tsm/tools/data/opensim-ref --osim <TSM_subject_noWeight.osim> [--output out.json]
參考姿勢是 10 個產品姿勢（見 poses.json）；每個姿勢有 base 與七座標各 ±1e-4 rad 共 15 組完整座標（含 AC 重組後的從屬角）。
"""
import argparse
import json
import os
import pathlib
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scap_arms_tsm as sat  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tsm-tools", required=True)
    ap.add_argument("--ref", required=True)
    ap.add_argument("--osim", required=True)
    ap.add_argument("--output")
    a = ap.parse_args()
    sat.load_tools(a.tsm_tools)
    from tsm_scapula import TSM, TSM_SHA256
    model = TSM(pathlib.Path(a.osim).read_bytes(), all_muscles=True)
    ref_dir = pathlib.Path(a.ref)
    poses = json.loads((ref_dir / "poses.json").read_text())
    ref = json.loads((ref_dir / "run.out").read_text().split("@@RESULT@@", 1)[1].split("@@END@@", 1)[0])
    assert ref["model_sha256"] == TSM_SHA256
    names = sorted(sat.SCAP_BUNDLES)
    h = poses["h"]
    COORDS = ("scapula_abduction", "scapula_elevation", "scapula_upward_rot", "plane_elv", "shoulder_elv", "axial_rot", "elbow_flexion")
    scj = np.asarray(model.sc_parent_t, float)
    rows = []
    for p, r in zip(poses["poses"], ref["poses"]):
        model.paths.warm_cache = {}
        base = next(v for v in p["vectors"] if v["tag"] == "base")["coords"]
        independent = np.array([base[k] for k in COORDS[:3]])
        gh = [base[k] for k in COORDS[3:6]]
        q = [*independent, base["scapula_winging"]]
        clav = [base["clav_prot"], base["clav_elev"]]
        calc = {}
        for v in p["vectors"]:
            c = v["coords"]
            X = model.transforms([c[k] for k in COORDS[:3]] + [c["scapula_winging"]], [c["clav_prot"], c["clav_elev"]],
                                 [c[k] for k in COORDS[3:6]], c[COORDS[6]])
            calc[v["tag"]] = {n: model.paths.length(n, c, X) for n in names}
        exp = {v["tag"]: v["L"] for v in r["rows"]}
        arm_os = {n: [-(exp[c + "+"][n] - exp[c + "-"][n]) / (2 * h) for c in COORDS[:3]] for n in names}
        arm_us = {n: [-(calc[c + "+"][n] - calc[c + "-"][n]) / (2 * h) for c in COORDS[:3]] for n in names}
        len_err = max(abs(calc[t][n] - exp[t][n]) for t in calc for n in names) * 1000
        mapping, _ = sat.mapping_to_tsm(model, independent, gh, base["elbow_flexion"], q, clav, scj)
        for n in names:
            row = {"lift": p["lift"], "e": p["e"], "muscle": n, "coord_arm_opensim_mm": [1000 * x for x in arm_os[n]],
                   "coord_arm_ours_mm": [1000 * x for x in arm_us[n]]}
            for k in sat.AXES:
                row[f"{k}_B_opensim_mm"] = 1000 * float(np.dot(arm_os[n], mapping[k][0]))
                row[f"{k}_B_ours_mm"] = 1000 * float(np.dot(arm_us[n], mapping[k][0]))
            rows.append(row)
        print(p["lift"], p["e"], f"最大長度差 {len_err:.3f} mm", flush=True)
    worst = {}
    for x in rows:
        w = worst.setdefault(x["muscle"], [0, 0, 0])
        w[0] = max(w[0], max(abs(a_ - b_) for a_, b_ in zip(x["coord_arm_opensim_mm"], x["coord_arm_ours_mm"])))
        for i, k in enumerate(sat.AXES):
            w[1 + i] = max(w[1 + i], abs(x[f"{k}_B_opensim_mm"] - x[f"{k}_B_ours_mm"]))
    print("muscle                       max|Δ座標力臂|  max|Δ scElev(B)|  max|Δ scRet(B)|  (mm)")
    for n, w in sorted(worst.items()):
        print(f"{n:28s} {w[0]:8.3f}   {w[1]:8.3f}   {w[2]:8.3f}")
    if a.output:
        json.dump({"rows": rows, "worst_mm": worst}, open(a.output, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
