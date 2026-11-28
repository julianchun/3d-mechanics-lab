"""產生以上臂方向（上舉 θ、上舉平面 φ）為格點的姿勢檔，格式同 export-scap-poses.mjs（無外力），供擬合力臂的姿勢函數。
上舉平面 0° = 前舉、90° = 側舉、>90° = 手臂在身後（伸展）、<0° = 水平內收過身體中線。TSM 節律只涵蓋 φ 0–90°、θ 0–150°，
範圍外由節律夾界（見 docs/research/scapular-arms.md 的不確定度）。
用法：python3 tools/research/make_grid_poses.py 輸出.json
"""
import json
import math
import sys

THETAS = [0] + list(range(15, 166, 15))
PHIS = [-30, 0, 30, 60, 90, 120, 150]


def sample(theta, phi):
    t, p = math.radians(theta), math.radians(phi)
    u = [math.sin(t) * math.cos(p), -math.cos(t), math.sin(t) * math.sin(p)]
    return {"e": float(f"{theta}.{(phi + 30) // 30}"), "arm_unit_os": u, "fore_unit_os": u, "arm_elevation_deg": float(theta),
            "arm_plane_deg": float(phi), "upper_length_m": 0.287, "fore_length_m": 0.332, "external_forces_os": [],
            "dem_scElev_Nm": None, "dem_scRet_Nm": None}


def main():
    samples = [sample(0, 0)] + [sample(t, p) for t in THETAS[1:] for p in PHIS]
    for s in samples:     # 以 theta、phi 唯一標記
        s["e"] = round(s["arm_elevation_deg"] * 1000 + s["arm_plane_deg"], 3)
    json.dump({"entries": [{"id": "grid", "samples": samples}]}, open(sys.argv[1], "w"))
    print(len(samples), "格")


if __name__ == "__main__":
    main()
