"""將固定版 DAS3 元素 F／Lf／Lt／羽狀角按產品可分辨肌束合併。

執行：python3 tools/das3_product.py [--check]
肌束界線及未建模自由度見 docs/research/shoulder-params.md。
"""

import argparse
import json
from pathlib import Path

from das3_params import MODEL, parse

OUTPUT = Path(__file__).parent.parent / "src" / "das3-shoulder.js"


def seq(prefix, first, last):
    return [f"{prefix}_{i}" if i < 10 else f"{prefix}{i}" for i in range(first, last + 1)]


GROUPS = {
    "pecSternal": seq("pect_maj_t", 2, 6),
    "pecAbdominal": seq("pect_maj_t", 1, 1),
    "pecc": seq("pect_maj_c", 1, 2),
    "latUpper": seq("lat_dorsi", 1, 3),
    "latLower": seq("lat_dorsi", 4, 6),
    "adelt": seq("delt_clav", 1, 4),
    "mdelt": seq("delt_scap", 4, 11),
    "pdelt": seq("delt_scap", 1, 3),
    "midtrapPart": seq("trap_scap", 6, 8),
    "rhomboid": seq("rhomboid", 1, 5),
    "uptrap": seq("trap_scap", 1, 5) + seq("trap_clav", 1, 2),
    "lowtrap": seq("trap_scap", 9, 11),
    "serrUpper": seq("serr_ant", 7, 12),
    "serrLower": seq("serr_ant", 1, 6),
    "levscap": seq("lev_scap", 1, 2),
    "pmin": seq("pect_min", 1, 4),
    "tmaj": seq("ter_maj", 1, 4),
    "corb": seq("coracobr", 1, 3),
    "infraPart": seq("infra", 1, 6),
    "tmin": seq("ter_min", 1, 3),
    "supsp": seq("supra", 1, 4),
    "subsc": seq("subscap", 1, 11),
    "trilong": seq("tric_long", 1, 4),
    "bicLong": ["bic_l"],
    "bicShort": seq("bic_b", 1, 2),
}


def build():
    source = {item["id"]: item for item in parse(MODEL)}
    out = {}
    for name, ids in GROUPS.items():
        children = [source[id] for id in ids]
        force = sum(item["F_N"] for item in children)
        out[name] = {
            "F": force,
            "Lf": round(sum(item["F_N"] * item["Lf_m"] for item in children) / force, 8),
            "Lt": round(sum(item["F_N"] * item["Lt_m"] for item in children) / force, 8),
            "alpha": round(sum(item["F_N"] * item["pennation_rad"] for item in children) / force, 8),
            "elements": ids,
        }
    return out


def render(data):
    return ("// 由 tools/das3_product.py 自固定版 tools/data/das3.osim 產生，請勿手改。\n"
            "// F 單位 N；Lf/Lt 單位 m；alpha 單位 rad。路徑與來源 ID 保留在元素表。\n"
            "export const DAS3_SHOULDER = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = render(build())
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != expected:
            raise SystemExit("src/das3-shoulder.js 與 DAS3 來源不一致")
        print("DAS3 產生檔一致")
    else:
        OUTPUT.write_text(expected)
        print(OUTPUT)
