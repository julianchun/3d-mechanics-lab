"""把 TSM（方案 A／B）、DAS3 與產品現值的肩帶力臂彙整成各姿勢的比較表（Markdown）與 JSON。

用法：python3 tools/research/build_scap_tables.py --poses /tmp/t44-poses.json --tsm A.json B.json --das3 d.json \\
        --md-out tables.md --json-out summary.json
群組以各束 TSM／DAS3 最大等長力 F 加權（TSM 的 F 見輸出的 F_N）。單位 mm；正＝上提／後收（產品 scElev／scRet 符號）。
"""
import argparse
import json

# 產品群組 ← TSM 肌束
TSM_GROUPS = {
    "lat": ["LatissimusDorsi_S", "LatissimusDorsi_M", "LatissimusDorsi_I"],
    "pecs": ["PectoralisMajorThorax_I", "PectoralisMajorThorax_M"],
    "pecc": ["PectoralisMajorClavicle_S"],
    "pmin": ["PectoralisMinor"],
    "uptrap": ["TrapeziusScapula_S", "TrapeziusClavicle_S"],
    "midtrap": ["TrapeziusScapula_M"],
    "rhom": ["Rhomboideus_S", "Rhomboideus_I"],
    "midrhom": ["TrapeziusScapula_M", "Rhomboideus_S", "Rhomboideus_I"],   # 產品舊參數的「斜方肌中束／菱形肌」合併群
    "lowtrap": ["TrapeziusScapula_I"],
    "levscap": ["LevatorScapulae"],
    "serr": ["SerratusAnterior_S", "SerratusAnterior_M", "SerratusAnterior_I"],
}
# 產品現值（舊參數組）：肌群 id → 產品 MUSCLES id；DAS3 組才有的項目用固定常數（src/biomech.js）
PRODUCT_ID = {"lat": "lat", "pecs": "pecs", "uptrap": "uptrap", "midrhom": "midtrap", "lowtrap": "lowtrap", "serr": "serr"}
PRODUCT_DAS3_CONST = {"rhom": (-0.010, 0.037), "levscap": (0.043, -0.005), "pmin": (-0.075, -0.039)}
# DAS3 群組 ← 產品群組（DAS3 的 groups 鍵見 tools/das3_product.py）
DAS3_MAP = {"lat": ["latUpper", "latLower"], "pecs": ["pecSternal", "pecAbdominal"], "pecc": ["pecc"], "pmin": ["pmin"],
            "uptrap": ["uptrap"], "midtrap": ["midtrapPart"], "midrhom": ["midtrapPart", "rhomboid"], "rhom": ["rhomboid"], "lowtrap": ["lowtrap"],
            "levscap": ["levscap"], "serr": ["serrUpper", "serrLower"]}
DAS3_GROUP_F = None


def tsm_group(F, arms, members):
    ms = [m for m in members if m in arms]
    return sum(F[m] * arms[m] for m in ms) / sum(F[m] for m in ms)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--poses", required=True)
    ap.add_argument("--tsm", nargs="+", required=True)
    ap.add_argument("--das3", nargs="*", default=[])
    ap.add_argument("--das3-model", default="tools/data/das3.osim")
    ap.add_argument("--only", help="逗號分隔的 id@e，只輸出這些姿勢的表")
    ap.add_argument("--md-out")
    ap.add_argument("--json-out")
    a = ap.parse_args()
    poses = {en["id"]: {round(s["e"], 4): s for s in en["samples"]} for en in json.load(open(a.poses))["entries"]}
    tsm, F = {}, None
    for path in a.tsm:
        d = json.load(open(path))
        F = d["F_N"]
        for en in d["entries"]:
            for s in en["samples"]:
                tsm[(en["id"], round(s["e"], 4))] = s
    das3 = {}
    for path in a.das3:
        d = json.load(open(path))
        for en in d["entries"]:
            for s in en["samples"]:
                das3[(en["id"], round(s["e"], 4))] = s
    # DAS3 群組 F
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from das3_params import parse
    from das3_product import GROUPS
    el = {i["id"]: i["F_N"] for i in parse(a.das3_model)}
    gF = {g: sum(el[i] for i in ids) for g, ids in GROUPS.items()}
    summary = {}
    lines = []
    for key in sorted(tsm):
        pid, e = key
        s = tsm[key]
        pa = poses[pid][e]["product_arms"]
        rec = {"arm_elevation_deg": s["arm_elevation_deg"], "arm_plane_deg": s["arm_plane_deg"], "clipped": s["clipped"],
               "dem_product_Nm": s["product_dem_Nm"], "Q_ext_A_Nm": s["Q_ext_A_Nm"], "Q_ext_B_Nm": s["Q_ext_B_Nm"], "groups": {}}
        for g, members in TSM_GROUPS.items():
            row = {}
            for axis in ("scElev", "scRet"):
                row[f"tsmB_{axis}"] = 1000 * tsm_group(F, s["B_arms_m"][axis], members)
                row[f"tsmA_{axis}"] = 1000 * tsm_group(F, s["A_arms_m"][axis], members)
                if key in das3 and g in DAS3_MAP:
                    ds = das3[key]["group_arms_m"]
                    ms = [m for m in DAS3_MAP[g] if m in ds]
                    row[f"das3_{axis}"] = 1000 * sum(gF[m] * ds[m][axis] for m in ms) / sum(gF[m] for m in ms)
                if g in PRODUCT_ID and PRODUCT_ID[g] in pa and axis in pa[PRODUCT_ID[g]]:
                    row[f"prod_{axis}"] = 1000 * pa[PRODUCT_ID[g]][axis]
                elif g in PRODUCT_ID and PRODUCT_ID[g] in pa:
                    row[f"prod_{axis}"] = 0.0
                elif g in PRODUCT_DAS3_CONST:
                    row[f"prodDAS3set_{axis}"] = 1000 * PRODUCT_DAS3_CONST[g][0 if axis == "scElev" else 1]
            rec["groups"][g] = row
        summary[f"{pid}@{e}"] = rec
    if a.json_out:
        json.dump(summary, open(a.json_out, "w"), ensure_ascii=False, indent=1)
    out = []
    f1 = lambda v: "—" if v is None else f"{v:+.0f}"
    pick = set(a.only.split(",")) if a.only else None
    for k, rec in summary.items():
        if pick and k not in pick:
            continue
        out.append(f"\n#### {k}（上舉 {rec['arm_elevation_deg']:.0f}°、平面 {rec['arm_plane_deg']:.0f}°{'，節律夾界' if rec['clipped'] else ''}）\n")
        out.append("| 肌群 | 產品現值 scElev／scRet | TSM-B | TSM-A | DAS3-A |")
        out.append("|---|---:|---:|---:|---:|")
        for g, r in rec["groups"].items():
            if g in ("midtrap", "rhom", "pecc"):
                continue
            prod = r.get("prod_scElev", r.get("prodDAS3set_scElev")), r.get("prod_scRet", r.get("prodDAS3set_scRet"))
            cell = lambda pre: f"{f1(r.get(pre + '_scElev'))}／{f1(r.get(pre + '_scRet'))}"
            out.append(f"| {g} | {f1(prod[0])}／{f1(prod[1])} | {cell('tsmB')} | {cell('tsmA')} | {cell('das3')} |")
    if a.md_out:
        open(a.md_out, "w").write("\n".join(out) + "\n")
    else:
        print("\n".join(out))


if __name__ == "__main__":
    main()
