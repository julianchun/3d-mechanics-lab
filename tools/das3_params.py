"""讀取固定版 DAS3 OpenSim 模型的肌肉參數與路徑點。

執行：python3 tools/das3_params.py [--model tools/data/das3.osim] [--json]
原始檔、版本、授權與使用限制見 tools/data/README.md。
"""

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path

MODEL = Path(__file__).parent / "data" / "das3.osim"


def parse(model):
    root = ET.parse(model).getroot()
    elements = []
    for muscle in root.iter("Schutte1993Muscle_Deprecated"):
        path = []
        for point in muscle.findall("./GeometryPath/PathPointSet/objects/*"):
            path.append({
                "type": point.tag,
                "body": point.findtext("socket_parent_frame").split("/")[-1],
                "location_m": [float(x) for x in point.findtext("location").split()],
            })
        elements.append({
            "id": muscle.attrib["name"],
            "F_N": float(muscle.findtext("max_isometric_force")),
            "Lf_m": float(muscle.findtext("optimal_fiber_length")),
            "Lt_m": float(muscle.findtext("tendon_slack_length")),
            "pennation_rad": float(muscle.findtext("pennation_angle_at_optimal")),
            "path": path,
        })
    if len(elements) != 138 or len({item["id"] for item in elements}) != 138:
        raise ValueError("DAS3 應有 138 條不重複肌肉元素")
    return elements


def summary(elements):
    groups = {}
    for item in elements:
        key = item["id"].rstrip("_0123456789")
        groups.setdefault(key, []).append(item)
    for key, children in groups.items():
        force = sum(item["F_N"] for item in children)
        weighted = lambda name: sum(item["F_N"] * item[name] for item in children) / force
        print(f"{key:16} {len(children):2} {force:7.1f} "
              f"{weighted('Lf_m'):.4f} {weighted('Lt_m'):.4f} {weighted('pennation_rad'):.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=MODEL)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    elements = parse(args.model)
    if args.json:
        print(json.dumps(elements, ensure_ascii=False, indent=2))
    else:
        print("group             n     F_N   Lf_m   Lt_m alpha_rad")
        summary(elements)
