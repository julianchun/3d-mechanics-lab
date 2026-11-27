"""DAS3 肩關節直線弦力臂診斷；不含 OpenSim 包覆及肩胛節律。

執行：python3 tools/das3_chords.py --plane flex --angle 45
角度為上臂相對胸廓下垂軸；每條跨盂肱肌只取靠近關節的首段弦。
"""

import argparse
import math
import xml.etree.ElementTree as ET

from das3_params import MODEL, parse
from shoulder_arms import Model, I3, mmul, mT, mvec, rot_axis, vadd, vsub, vmul, vcross, vdot, vnorm


def pose(model, q, body):
    cache = {"thorax": (I3, [0, 0, 0])}

    def get(name):
        if name not in cache:
            joint = model.joints[name]
            parent_R, parent_p = get(joint["parent"])
            turn = I3
            for coordinate, axis in joint["rot"]:
                turn = mmul(turn, rot_axis(axis, q.get(coordinate, 0)))
            local_R = mmul(mmul(joint["R"], turn), mT(joint["cR"]))
            local_p = vsub(joint["t"], mvec(local_R, joint["ct"]))
            cache[name] = (mmul(parent_R, local_R), vadd(parent_p, mvec(parent_R, local_p)))
        return cache[name]

    return get(body)


def locate(model, q, point):
    R, p = pose(model, q, point["body"])
    return vadd(p, mvec(R, point["location_m"]))


def solve(model, defaults, target):
    q = defaults.copy()
    best = (float("inf"), 0, 0)
    # GH_y、GH_z 決定肱骨長軸方向；GH_yy 保持模型預設。
    for y_deg in range(-180, 181, 15):
        for z_deg in range(-150, 151, 15):
            q["GH_y"], q["GH_z"] = math.radians(y_deg), math.radians(z_deg)
            R, _ = pose(model, q, "humerus_r")
            d = vsub(mvec(R, [0, -1, 0]), target)
            cost = vdot(d, d)
            if cost < best[0]:
                best = (cost, q["GH_y"], q["GH_z"])
    _, y, z = best
    for step_deg in (5, 1, 0.2, 0.04):
        step = math.radians(step_deg)
        for _ in range(20):
            choices = []
            for dy, dz in ((0, 0), (step, 0), (-step, 0), (0, step), (0, -step)):
                q["GH_y"], q["GH_z"] = y + dy, z + dz
                R, _ = pose(model, q, "humerus_r")
                d = vsub(mvec(R, [0, -1, 0]), target)
                choices.append((vdot(d, d), y + dy, z + dz))
            cost, ny, nz = min(choices)
            if ny == y and nz == z:
                break
            y, z = ny, nz
    q["GH_y"], q["GH_z"] = y, z
    R, _ = pose(model, q, "humerus_r")
    d = vsub(mvec(R, [0, -1, 0]), target)
    if math.sqrt(vdot(d, d)) > 0.01:
        raise ValueError("DAS3 上臂方向無法對齊指定姿勢")
    return q


def moment(model, q, muscle, axis):
    points = muscle["path"]
    for i in range(len(points) - 1):
        if points[i]["body"] != "humerus_r" and points[i + 1]["body"] == "humerus_r":
            origin = locate(model, q, points[i])
            insertion = locate(model, q, points[i + 1])
            scap_R, scap_p = pose(model, q, "scapula_r")
            center = vadd(scap_p, mvec(scap_R, [0.002, -0.023, -0.0439]))
            line = vnorm(vsub(origin, insertion))
            return 1000 * vdot(vcross(vsub(insertion, center), line), axis)
    return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--plane", choices=["flex", "abd"], required=True)
    parser.add_argument("--angle", type=float, required=True)
    args = parser.parse_args()
    root = ET.parse(args.model).getroot()
    model = Model(root)
    defaults = {c.attrib["name"]: float(c.findtext("default_value")) for c in root.iter("Coordinate") if c.findtext("default_value")}
    t = math.radians(args.angle)
    target = [0, -math.cos(t), -math.sin(t)] if args.plane == "flex" else [math.sin(t), -math.cos(t), 0]
    q = solve(model, defaults, target)
    axis = [1, 0, 0] if args.plane == "flex" else [0, 0, 1]
    groups = {}
    for muscle in parse(args.model):
        value = moment(model, q, muscle, axis)
        if value is None:
            continue
        key = muscle["id"].rstrip("_0123456789")
        groups.setdefault(key, []).append((muscle["F_N"], value))
    print(f"DAS3 直線弦 {args.plane} {args.angle:g}°；GH_y={q['GH_y']:.4f}, GH_z={q['GH_z']:.4f} rad")
    for key, values in groups.items():
        force = sum(f for f, _ in values)
        mean = sum(f * value for f, value in values) / force
        print(f"{key:16} {mean:7.1f} mm")
