"""以 Seth TSM 肌束路徑計算產品肩帶兩軸（scElev／scRet）的肌肉力臂。

依賴 feat/scapula-tsm 分支的 TSM 工具（tsm_scapula／tsm_coupled／tsm_wrap／tsm_cylinder／tsm_rhythm 與節律資料）；
該分支不合併，請另開 worktree：
    git worktree add /tmp/t44-tsm 399e5bc            # feat/scapula-tsm 的固定提交
    python3 -m venv /tmp/t44-py && /tmp/t44-py/bin/pip install numpy==2.5.5 scipy==1.18.1
    node tools/research/export-scap-poses.mjs /tmp/t44-poses.json
    /tmp/t44-py/bin/python tools/research/scap_arms_tsm.py --tsm-tools /tmp/t44-tsm/tools \\
        --osim /tmp/t44-tsm/tools/data/opensim-ref/TSM_subject_noWeight.osim \\
        --poses /tmp/t44-poses.json --output /tmp/t44-tsm-arms.json

座標與符號（右手系 TSM 胸廓：X 前、Y 上、Z 右）：
- 產品 scElev＋ ＝ 右肩上提 ＝ 繞 −X 轉（ω_elev = (−1,0,0)）；產品 scRet＋ ＝ 右肩後收 ＝ 繞 −Y 轉（ω_ret = (0,−1,0)）。
- 方案 A（剛體繞胸鎖關節）：鎖骨、肩胛、肱骨、前臂、手整體繞胸鎖關節轉 θ，不要求肩胛貼著胸廓；與產品
  需求（手臂外力對胸鎖關節的力矩）定義一致。r = −dL/dθ。
- 方案 B（可行位移）：把方案 A 的位移場投影到 TSM 三個獨立肩胛座標（外展、上提、上旋；其餘由 AC 閉鏈重組，
  肱骨隨肩胛、盂肱角固定）後再求 r_B ＝ Σ r_q·(dq/dθ)，肩胛保持貼在胸廓橢球上。
"""
import argparse
import json
import math
import os
import sys

import numpy as np


def load_tools(path):
    sys.path.insert(0, path)
    global tsm_scapula, tsm_coupled
    import tsm_scapula  # noqa: F401
    import tsm_coupled  # noqa: F401


# 起點在胸廓／脊柱而止點在肩胛、鎖骨或肱骨的束；盂肱以遠肌束對方案 A 的力臂恆為 0
SCAP_BUNDLES = {
    "LatissimusDorsi_S", "LatissimusDorsi_M", "LatissimusDorsi_I", "PectoralisMajorThorax_I", "PectoralisMajorThorax_M",
    "PectoralisMajorClavicle_S", "PectoralisMinor", "LevatorScapulae", "Rhomboideus_S", "Rhomboideus_I",
    "SerratusAnterior_S", "SerratusAnterior_M", "SerratusAnterior_I", "TrapeziusClavicle_S", "TrapeziusScapula_S",
    "TrapeziusScapula_M", "TrapeziusScapula_I",
}  # 大圓肌（肩胛→肱骨）兩端同隨肩胛移動，肩帶兩軸力臂恆為 0（有限差分驗證），且有肱骨包覆面，端點虛功法不適用，故不列入
AXES = {"scElev": np.array([-1.0, 0, 0]), "scRet": np.array([0, -1.0, 0])}
MOVING = ("clavicle", "scapula", "humerus", "ulna", "radius", "hand")


def rot(axis, ang):
    a = np.asarray(axis, float)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K


def rigid_rotated(X, scj, axis, ang):
    """方案 A：把 MOVING 剛體整體繞胸鎖關節 scj 轉 ang。"""
    Rm = rot(axis, ang)
    out = dict(X)
    for b in MOVING:
        if b in X:
            R, p = X[b]
            out[b] = (Rm @ np.asarray(R), np.asarray(scj) + Rm @ (np.asarray(p) - scj))
    return out


def lengths(model, names, coord, X):
    return {n: model.paths.length(n, coord, X) for n in names}


def endpoint_arms(model, names, coord, X, velocity, paths=None, geometry=None):
    """端點虛功：r = −dL/dq = Σ（路徑點朝相鄰點的單位向量 · 該點速度）。每束只需解一次包覆路徑。
    velocity(body, 點座標) → 該點在胸廓座標的速度；胸廓包覆面固定，包覆曲面上的點不計（與 tsm_scapula.constrained_arms_endpoint 相同做法）。"""
    out = {}
    paths = paths or model.paths
    geometry = geometry or model.geometry
    for n in names:
        if any(geometry.wraps[w]["body"] != "thorax" for w, *_ in geometry.muscles[n]["wraps"] if w in geometry.wraps):
            raise ValueError(f"{n} 有非胸廓的包覆面，端點虛功不適用，請改用有限差分")
        path, _ = paths.path(n, coord, X)
        total = 0.0
        for i, item in enumerate(path):
            point, body = np.asarray(item[0]), item[1]
            if body.startswith("wrap:"):
                continue
            pull = np.zeros(3)
            for j in (i - 1, i + 1):
                if 0 <= j < len(path):
                    d = np.asarray(path[j][0]) - point
                    pull += d / np.linalg.norm(d)
            total += float(pull @ velocity(body, point))
        out[n] = total
    return out


def arms_rigid_endpoint(model, names, coord, X, scj):
    """方案 A 的端點虛功版（解析，不做有限差分）。"""
    res = {}
    for key, ax in AXES.items():
        res[key] = endpoint_arms(model, names, coord, X,
                                 lambda body, p, ax=ax: np.cross(ax, p - scj) if body in MOVING else np.zeros(3))
    return res


def arms_rigid(model, names, coord, X, scj, eps):
    out = {}
    for key, ax in AXES.items():
        lp = lengths(model, names, coord, rigid_rotated(X, scj, ax, +eps))
        lm = lengths(model, names, coord, rigid_rotated(X, scj, ax, -eps))
        out[key] = {n: -(lp[n] - lm[n]) / (2 * eps) for n in names}
    return out


def scap_pose_vector(model, X, scj):
    """肩胛剛體的位移描述：盂肱中心位置與框架。"""
    R, p = X["scapula"]
    return np.asarray(model.gh_t) @ np.asarray(R).T + np.asarray(p), np.asarray(R)


def mapping_to_tsm(model, independent, gh, elbow, q, clav, scj, eps=1e-5, w_rot=0.10):
    """求 dq/dθ（三個獨立肩胛座標）：以肩胛剛體位移（盂肱中心位置＋旋轉×w_rot）做最小平方。
    回傳 {軸: (dq3, 殘差比)}；殘差比＝無法由貼胸廓位移達成的位移佔方案 A 位移的比例。"""
    from tsm_coupled import state
    X0 = state(model, independent, gh, elbow, [q[3], *clav])[3]
    c0, R0 = scap_pose_vector(model, X0, scj)
    cols = []
    for k in range(3):
        qp, qm = independent.copy(), independent.copy()
        qp[k] += eps
        qm[k] -= eps
        sp = state(model, qp, gh, elbow, [q[3], *clav])
        sm = state(model, qm, gh, elbow, [q[3], *clav])
        cp, Rp = scap_pose_vector(model, sp[3], scj)
        cm, Rm = scap_pose_vector(model, sm[3], scj)
        dR = (Rp - Rm) @ R0.T / (2 * eps)
        w = np.array([dR[2, 1], dR[0, 2], dR[1, 0]])
        cols.append(np.r_[(cp - cm) / (2 * eps), w_rot * w])
    J = np.array(cols).T                       # 6x3
    out = {}
    for key, ax in AXES.items():
        target = np.r_[np.cross(ax, c0 - scj), w_rot * ax]      # 方案 A：肩胛的線／角速度
        dq, *_ = np.linalg.lstsq(J, target, rcond=None)
        res = np.linalg.norm(J @ dq - target) / np.linalg.norm(target)
        out[key] = (dq, float(res))
    return out, J


def arms_coordinates(model, names, independent, gh, elbow, q, clav, eps=1e-5):
    """三個獨立肩胛座標的 −∂L/∂q（AC 重新組裝、盂肱角固定）。"""
    from tsm_coupled import state
    out = {n: [] for n in names}
    for k in range(3):
        qp, qm = independent.copy(), independent.copy()
        qp[k] += eps
        qm[k] -= eps
        sp = state(model, qp, gh, elbow, [q[3], *clav])
        sm = state(model, qm, gh, elbow, [q[3], *clav])
        for n in names:
            out[n].append(-(model.paths.length(n, sp[4], sp[3]) - model.paths.length(n, sm[4], sm[3])) / (2 * eps))
    return out


def external_generalized(model, sample, X, scj):
    """手臂外力對兩個肩帶軸的廣義力（方案 A 的剛體位移；力作用點依 point_map 映到 TSM 骨段）。"""
    from tsm_coupled import point_map
    res = {k: 0.0 for k in AXES}
    pts = []
    for f in sample["external_forces_os"]:
        p = point_map(sample, f, X, model)
        F = np.asarray(f["F_N"])
        pts.append((p, F))
        for k, ax in AXES.items():
            res[k] += float(np.dot(np.cross(ax, p - scj), F))
    return res, pts


def arms_coordinates_endpoint(model, names, independent, gh, elbow, q, clav, X0, coord, eps=1e-5):
    """三個獨立肩胛座標的 −∂L/∂q 端點虛功版（AC 重新組裝、盂肱角固定）。"""
    from tsm_coupled import state
    out = {n: [] for n in names}
    for k in range(3):
        qp, qm = independent.copy(), independent.copy()
        qp[k] += eps
        qm[k] -= eps
        Xp = state(model, qp, gh, elbow, [q[3], *clav])[3]
        Xm = state(model, qm, gh, elbow, [q[3], *clav])[3]

        def vel(body, p, Xp=Xp, Xm=Xm):
            R0, o0 = (np.asarray(v) for v in X0[body])
            local = R0.T @ (p - o0)
            (Rp, op), (Rm, om) = ((np.asarray(v) for v in Xp[body]), (np.asarray(v) for v in Xm[body]))
            return ((Rp @ local + op) - (Rm @ local + om)) / (2 * eps)
        r = endpoint_arms(model, names, coord, X0, vel)
        for n in names:
            out[n].append(r[n])
    return out


def process(model, coeff, sample, eps, names, fd=False):
    from tsm_coupled import rhythm, fit_humerus, state
    independent, q, clav, gap, clipped = rhythm(model, coeff, sample)
    fitted, fit_err = fit_humerus(model, independent, q, clav, sample)
    gh, elbow = fitted[:3], fitted[3]
    q, clav, gap, X, coord = state(model, independent, gh, elbow)
    scj = np.asarray(model.sc_parent_t, float)
    model.paths.warm_cache = {}
    A = arms_rigid(model, names, coord, X, scj, eps) if fd else arms_rigid_endpoint(model, names, coord, X, scj)
    Qext, _ = external_generalized(model, sample, X, scj)
    mapping, J = mapping_to_tsm(model, independent, gh, elbow, q, clav, scj)
    coordarms = (arms_coordinates(model, names, independent, gh, elbow, q, clav) if fd else
                 arms_coordinates_endpoint(model, names, independent, gh, elbow, q, clav, X, coord, eps))
    B = {k: {n: float(np.dot(coordarms[n], mapping[k][0])) for n in names} for k in AXES}
    # 外力在三個獨立座標的廣義力（用於方案 B 的需求）
    Qq = []
    for k in range(3):
        qp, qm = independent.copy(), independent.copy()
        qp[k] += eps
        qm[k] -= eps
        sp = state(model, qp, gh, elbow, [q[3], *clav])
        sm = state(model, qm, gh, elbow, [q[3], *clav])
        s = 0.0
        for f in sample["external_forces_os"]:
            s += float(np.dot((tsm_coupled.point_map(sample, f, sp[3], model) - tsm_coupled.point_map(sample, f, sm[3], model)) / (2 * eps), f["F_N"]))
        Qq.append(s)
    QB = {k: float(np.dot(Qq, mapping[k][0])) for k in AXES}
    return {
        "clipped": bool(clipped), "gh_fit_error_deg": fit_err, "ac_gap_mm": gap * 1000,
        "independent_deg": np.degrees(independent).tolist(), "gh_rad": [float(x) for x in gh], "elbow_rad": float(elbow),
        "scj_thorax_m": scj.tolist(),
        "A_arms_m": A, "B_arms_m": B,
        "Q_ext_A_Nm": Qext, "Q_ext_B_Nm": QB, "Q_ext_q_Nm": Qq,
        "dq_dtheta": {k: mapping[k][0].tolist() for k in AXES},
        "mapping_residual": {k: mapping[k][1] for k in AXES},
        "coord_arms_m": coordarms,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tsm-tools", required=True, help="feat/scapula-tsm 的 tools 目錄")
    ap.add_argument("--osim", required=True)
    ap.add_argument("--poses", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--ids", help="逗號分隔的清單項目")
    ap.add_argument("--e", help="逗號分隔的 e 值（預設全部九點）")
    ap.add_argument("--eps", type=float, default=1e-5)
    ap.add_argument("--fd", action="store_true", help="改用完整路徑長度的有限差分（慢約 20 倍），供核對端點虛功")
    ap.add_argument("--all-bundles", action="store_true", help="含盂肱／手臂肌束（預設只算跨胸廓—肩帶的 18 束）")
    ap.add_argument("--rhythm-offset-deg", default="0,0,0", help="對三個獨立肩胛座標加的偏移（度），做姿勢敏感度")
    a = ap.parse_args()
    load_tools(a.tsm_tools)
    from tsm_scapula import TSM, TSM_SHA256
    raw = open(a.osim, "rb").read()
    model = TSM(raw, all_muscles=True)
    rd = json.load(open(os.path.join(a.tsm_tools, "data", "tsm-rhythm.json")))
    assert rd["model_sha256"] == TSM_SHA256
    coeff = np.asarray(rd["coefficients_deg"])
    off = np.radians([float(x) for x in a.rhythm_offset_deg.split(",")])
    if np.any(off):                                   # 把偏移直接加進節律輸出
        orig = tsm_coupled.rhythm

        def shifted(m, c, s):
            ind, q, clav, gap, clip = orig(m, c, s)
            ind = ind + off
            q, clav, gap = m.assemble(ind.tolist())
            return ind, q, clav, gap, clip
        tsm_coupled.rhythm = shifted
    names = sorted(model.names) if a.all_bundles else sorted(n for n in model.names if n in SCAP_BUNDLES)
    F = {n: model.geometry.muscles[n]["F"] for n in names}
    src = json.load(open(a.poses))
    ids = a.ids.split(",") if a.ids else None
    es = [float(x) for x in a.e.split(",")] if a.e else None
    out = {"tsm_model_sha256": TSM_SHA256, "F_N": F, "bundles": names, "entries": []}
    for entry in src["entries"]:
        if ids and entry["id"] not in ids:
            continue
        rows = []
        for s in entry["samples"]:
            if es is not None and not any(abs(s["e"] - x) < 1e-6 for x in es):
                continue
            r = process(model, coeff, s, a.eps, names, a.fd)
            r["e"] = s["e"]
            r["arm_elevation_deg"], r["arm_plane_deg"] = s["arm_elevation_deg"], s["arm_plane_deg"]
            r["product_dem_Nm"] = {"scElev": s["dem_scElev_Nm"], "scRet": s["dem_scRet_Nm"]}
            rows.append(r)
            print(entry["id"], s["e"], "clip" if r["clipped"] else "", "A lat(mm)",
                  [round(1000 * r["A_arms_m"][k]["LatissimusDorsi_M"], 1) for k in AXES],
                  "B", [round(1000 * r["B_arms_m"][k]["LatissimusDorsi_M"], 1) for k in AXES], flush=True)
        out["entries"].append({"id": entry["id"], "samples": rows})
    json.dump(out, open(a.output, "w"), ensure_ascii=False)


if __name__ == "__main__":
    main()
