"""以固定版 DAS3（das3.osim）肌肉路徑計算產品肩帶兩軸（scElev／scRet）的肌肉力臂（方案 A：剛體繞胸鎖關節）。

DAS3 的鎖骨＋肩胛＋肱骨本來就是由胸鎖關節（SC）為根的串聯，沒有胸廓接觸約束，所以「整條上肢繞 SC 剛體轉動」
是它的原生虛位移，與產品的需求定義一致。DAS3 檔不含肩胛節律，姿勢由 TSM 肩胛／鎖骨方位的「相對於休息姿勢的增量」
映入 DAS3 的 SC／AC 座標（兩模型座標系以 C 對映；休息姿勢取各自的垂臂預設）。

依賴：feat/scapula-tsm 的 tools（Model、PathCalc、包覆與節律）；用法見 scap_arms_tsm.py 開頭。
"""
import argparse
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, HERE)

# TSM 胸廓（X 前、Y 上、Z 右）→ DAS3 胸廓（X 右、Y 上、Z 後）
C = np.array([[0, 0, 1.0], [0, 1, 0], [-1.0, 0, 0]])
MOVING = ["clavicle_1", "clavicle_2", "clavicle_r", "scapula_1", "scapula_2", "scapula_r",
          "humerus_1", "humerus_2", "humerus_r", "ulna_r", "radius_r", "hand_r"]
AXES_TSM = {"scElev": np.array([-1.0, 0, 0]), "scRet": np.array([0, -1.0, 0])}
SC_COORDS = ("SC_y", "SC_z", "SC_x")
AC_COORDS = ("AC_y", "AC_z", "AC_x")


def rot(axis, ang):
    a = np.asarray(axis, float)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K


def build(tsm_tools, osim):
    sys.path.insert(0, tsm_tools)
    import shoulder_arms as sa
    import tsm_scapula as ts
    from das3_params import parse
    from das3_product import GROUPS
    root = ET.parse(osim).getroot()
    for ta in root.iter("TransformAxis"):          # 常數軸沒有 coordinates 子元素；補空字串供通用解析器使用
        if ta.find("coordinates") is None:
            ET.SubElement(ta, "coordinates").text = ""
    model = sa.Model(root)
    for el in root.iter("Schutte1993Muscle_Deprecated"):
        gp = el.find("GeometryPath")
        pts = [dict(kind="fixed", body=pp.findtext("socket_parent_frame").split("/")[-1], loc=sa.nums(pp.findtext("location")))
               for pp in gp.find("PathPointSet").find("objects")]
        wraps = []
        pw = gp.find("PathWrapSet")
        if pw is not None:
            for w in pw.iter("PathWrap"):
                rg = sa.nums(w.findtext("range") or "-1 -1")
                wraps.append((w.findtext("wrap_object").strip(), int(rg[0]), int(rg[1])))
        model.muscles[el.attrib["name"]] = dict(F=float(el.findtext("max_isometric_force")), pts=pts, wraps=wraps)
    defaults = {c.attrib["name"]: float(c.findtext("default_value")) for c in root.iter("Coordinate") if c.findtext("default_value")}
    paths = ts.TSMPathCalc(model)
    paths.warm_cache = {}
    return sa, ts, model, paths, defaults, {i["id"]: i for i in parse(osim)}, GROUPS


def body_poses(sa, model, q, bodies):
    cache = {"thorax": (sa.I3, [0.0, 0.0, 0.0])}

    def get(name):
        if name not in cache:
            j = model.joints[name]
            Rp, pp = get(j["parent"])
            Rs = sa.I3
            for c, ax in j["rot"]:
                Rs = sa.mmul(Rs, sa.rot_axis(ax, q.get(c, 0.0) if c else 0.0))
            Rl = sa.mmul(sa.mmul(j["R"], Rs), sa.mT(j["cR"]))
            pl = sa.vsub(j["t"], sa.mvec(Rl, j["ct"]))
            cache[name] = (sa.mmul(Rp, Rl), sa.vadd(pp, sa.mvec(Rp, pl)))
        return cache[name]
    return {b: get(b) for b in bodies}


def solve_scapula(sa, model, defaults, R_clav_target, R_scap_target):
    """以最小平方使 clavicle_r／scapula_r 的方位等於目標（DAS3 胸廓座標）。"""
    from scipy.optimize import least_squares
    q = dict(defaults)

    def res(x):
        qq = dict(q)
        qq.update(zip(SC_COORDS, x[:3]))
        qq.update(zip(AC_COORDS, x[3:]))
        X = body_poses(sa, model, qq, ("clavicle_r", "scapula_r"))
        return np.r_[(np.asarray(X["clavicle_r"][0]) - R_clav_target).ravel(), (np.asarray(X["scapula_r"][0]) - R_scap_target).ravel()]

    x0 = [defaults[c] for c in SC_COORDS + AC_COORDS]
    fit = least_squares(res, x0, xtol=1e-12, ftol=1e-12)
    q.update(zip(SC_COORDS + AC_COORDS, fit.x))
    return q, float(np.linalg.norm(fit.fun))


def solve_gh(sa, model, q, target):
    from scipy.optimize import least_squares

    def res(x):
        qq = dict(q)
        qq["GH_y"], qq["GH_z"] = x
        R, _ = body_poses(sa, model, qq, ("humerus_r",))["humerus_r"]
        return np.asarray(R) @ np.array([0, -1.0, 0]) - target
    best = None
    for y0 in (-1.5, 0, 1.5):
        for z0 in (-1.0, 0, 1.0):
            f = least_squares(res, [y0, z0], xtol=1e-12, ftol=1e-12)
            if best is None or np.linalg.norm(f.fun) < np.linalg.norm(best.fun):
                best = f
    q = dict(q)
    q["GH_y"], q["GH_z"] = best.x
    return q, float(np.linalg.norm(best.fun))


def rotated(X, pivot, axis, ang):
    Rm = rot(axis, ang)
    out = dict(X)
    for b in MOVING:
        if b in X:
            R, p = X[b]
            out[b] = (Rm @ np.asarray(R), np.asarray(pivot) + Rm @ (np.asarray(p) - pivot))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tsm-tools", required=True)
    ap.add_argument("--tsm-osim", required=True)
    ap.add_argument("--das3", default=os.path.join(HERE, "..", "data", "das3.osim"))
    ap.add_argument("--poses", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--ids")
    ap.add_argument("--e")
    ap.add_argument("--eps", type=float, default=1e-5)
    a = ap.parse_args()
    sys.path.insert(0, a.tsm_tools)
    import tsm_coupled as tc
    import tsm_scapula as ts
    sa, ts, model, paths, defaults, elements, GROUPS = build(a.tsm_tools, a.das3)
    from scap_arms_tsm import endpoint_arms
    tsm = ts.TSM(open(a.tsm_osim, "rb").read(), all_muscles=False)
    rd = json.load(open(os.path.join(a.tsm_tools, "data", "tsm-rhythm.json")))
    coeff = np.asarray(rd["coefficients_deg"])
    pivot = np.asarray(model.joints["clavicle_1"]["t"], float)
    F = {n: m["F"] for n, m in model.muscles.items()}
    use = sorted(n for n in model.muscles if n.rstrip("_0123456789").rstrip("_") in
                 ("lat_dorsi", "pect_maj_t", "pect_maj_c", "pect_min", "lev_scap", "rhomboid", "trap_scap", "trap_clav", "serr_ant", "ter_maj"))
    # 休息姿勢：TSM 節律在上舉 0° 的肩胛／鎖骨方位；DAS3 為檔案預設
    ind0 = np.radians(coeff[0])   # basis(0,0)=[1,0,...]：截距列即上舉 0° 的休息姿勢
    q0, clav0, _ = tsm.assemble(ind0.tolist())
    X0 = tsm.transforms(q0, clav0)
    Rc0, Rs0 = np.asarray(X0["clavicle"][0]), np.asarray(X0["scapula"][0])
    Xd0 = body_poses(sa, model, defaults, ("clavicle_r", "scapula_r"))
    Rcd0, Rsd0 = np.asarray(Xd0["clavicle_r"][0]), np.asarray(Xd0["scapula_r"][0])
    src = json.load(open(a.poses))
    ids = a.ids.split(",") if a.ids else None
    es = [float(x) for x in a.e.split(",")] if a.e else None
    out = {"F_N": F, "entries": [], "pivot_thorax_m": pivot.tolist()}
    for entry in src["entries"]:
        if ids and entry["id"] not in ids:
            continue
        rows = []
        for s in entry["samples"]:
            if es is not None and not any(abs(s["e"] - x) < 1e-6 for x in es):
                continue
            independent, q, clav, gap, clipped = tc.rhythm(tsm, coeff, s)
            X = tsm.transforms(q, clav)
            Rc, Rs = np.asarray(X["clavicle"][0]), np.asarray(X["scapula"][0])
            dC, dS = Rc @ Rc0.T, Rs @ Rs0.T                      # 胸廓座標的方位增量
            qd, err_s = solve_scapula(sa, model, defaults, C @ dC @ C.T @ Rcd0, C @ dS @ C.T @ Rsd0)
            qd, err_g = solve_gh(sa, model, qd, C @ np.asarray(s["arm_unit_os"]))
            Xd = body_poses(sa, model, qd, [b for b in MOVING + ["thorax"] if b in model.joints or b == "thorax"])
            paths.warm_cache = {}
            res = {}
            movers = set(MOVING)
            fixed_wrap = [n for n in use if all(model.wraps[w]["body"] == "thorax" for w, *_ in model.muscles[n]["wraps"] if w in model.wraps)]
            fd_names = [n for n in use if n not in fixed_wrap]       # 有肱骨圓柱包覆面（背闊肌、胸大肌）改用有限差分
            for key, ax in AXES_TSM.items():
                axd = C @ ax
                res[key] = endpoint_arms(None, fixed_wrap, {}, Xd, lambda body, p, axd=axd: np.cross(axd, p - pivot) if body in movers else np.zeros(3),
                                         paths=paths, geometry=model)
                lp = {n: paths.length(n, {}, rotated(Xd, pivot, axd, +a.eps)) for n in fd_names}
                lm = {n: paths.length(n, {}, rotated(Xd, pivot, axd, -a.eps)) for n in fd_names}
                res[key].update({n: -(lp[n] - lm[n]) / (2 * a.eps) for n in fd_names})
            groups = {}
            for g, members in GROUPS.items():
                ms = [m for m in members if m in res["scElev"]]
                if ms:
                    groups[g] = {k: sum(F[m] * res[k][m] for m in ms) / sum(F[m] for m in ms) for k in res}
            gh = np.asarray(Xd["scapula_r"][1]) + np.asarray(Xd["scapula_r"][0]) @ np.array([0.0, 0.0, 0.0])
            rows.append({"e": s["e"], "clipped": bool(clipped), "orientation_fit_error": err_s, "gh_fit_error": err_g,
                         "arms_m": res, "group_arms_m": groups, "scapula_origin_m": gh.tolist(),
                         "hand_dist_from_pivot_m": float(np.linalg.norm(np.asarray(Xd["hand_r"][1]) - pivot)),
                         "q": {k: qd[k] for k in SC_COORDS + AC_COORDS + ("GH_y", "GH_z", "GH_yy")}})
            print(entry["id"], s["e"], "lat", {k: round(1000 * g, 1) for k, g in groups.get("latUpper", {}).items()}, flush=True)
        out["entries"].append({"id": entry["id"], "samples": rows})
    json.dump(out, open(a.output, "w"), ensure_ascii=False)


if __name__ == "__main__":
    main()
