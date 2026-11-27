"""由 MoBL-ARMS（Saul et al. 2015，固定 commit）肌肉路徑點系統性計算肩部力臂，並擬合成本模型的肩座標函數。

執行：python3 tools/shoulder_arms.py [--osim MoBL檔案] [--seth TSM檔案] [--js src/shoulder-arms.js] [--json 輸出.json]

只用標準函式庫（不需要 OpenSim）。步驟：
1. 讀取 `MOBL_ARMS_41.osim` 的關節鏈（胸廓→鎖骨→肩胛→肱骨）、肩胛節律耦合（CoordinateCouplerConstraint）、
   肌肉路徑點（含 ConditionalPathPoint、MovingPathPoint）與包覆面（球、橢球、圓柱）。
2. 依本模型肩座標 `shElev`（θ，上臂離軀幹向下軸的角度）、`shPlane`（φ，0＝前舉、90°＝側舉）與 `shRot`（ψ，上臂軸旋，
   以由垂臂平行運送的前方為零；MoBL 的 Y-X-Y 尤拉序列在 shoulder_rot=0 時正好等於這個參考）放置肱骨；
   肩胛與鎖骨依 MoBL 的節律固定在該上舉角，只轉動肱骨（盂肱關節），以中央差分求 −∂L/∂q，
   再用三個座標的角速度矩陣反解出三維力臂向量 m（相對盂肱中心，`r = −dL/dα` 沿任意轉軸 ω 等於 m·ω）。
3. 對起點在胸廓的肌肉（胸大肌、背闊肌），另以「離開胸廓的那一段力線」對胸鎖關節求肩帶力臂
   `r_axis = (p − p_SC) × u · axis`：scElev 軸＝前方、scRet 軸＝上方（與 biomech.js 的 dem.scElev／dem.scRet 一致）。
4. 以 F 加權合併成本模型的肌群，對上臂方向單位向量 h 與 ψ 做最小平方多項式擬合，輸出 `src/shoulder-arms.js`。
5. 另讀 Seth TSM 的斜方肌／菱形肌／前鋸肌九束路徑點，放入同一節律姿勢，繞胸鎖中心的兩個等效軸
   做中央差分，按來源 F 合群後擬合肩帶力臂。

限制（如實記錄於 docs/research/muscle-params.md）：
- 包覆面採簡化演算法：球與橢球以「通過兩端點與中心的平面」求切線與弧（橢球先仿射縮放成單位球；仿射變換保留切線），
   圓柱以截面圓切線＋螺旋展開；象限限制只在直線與包覆面相交時啟用。這不是 OpenSim 的逐行實作，
  OpenSim 的橢球演算法不同；torus（Delt3、INFSP 兩個）未實作：Delt3 只作用在兩個肩胛點之間（不影響盂肱力臂），
  INFSP torus 位於棘下窩起點附近，影響應小但未驗證。
- MoBL 的肩胛節律是單一上舉角的固定耦合（de Groot & Brand），本模型另有 scRet/scElev，故力臂只取節律位置。
- 沒有 OpenSim 可交叉驗算；以文獻量測量級檢查（見 docs）。超過 120 mm 的尖峰樣本不納入擬合。
- MoBL 沒有斜方肌、菱形肌、前鋸肌的主動肌束；另讀 Seth 模型路徑，將其胸廓／鎖骨／肩胛局部點放到 MoBL 剛體節律位置。
- Seth 肩胛肌束的力臂以繞胸鎖中心旋轉鎖骨與肩胛的虛功求得；這是本模型兩個等效軸的近似，尚未以 OpenSim 驗證。
"""

import argparse
import json
import math
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

URL = "https://raw.githubusercontent.com/CEINMS-RT/UpperLimbModel/459e2ebbf47acb72b0ecbc59950a2d0a983d28db/MOBL_ARMS_41.osim"
SETH_URL = "https://raw.githubusercontent.com/ComputationalBiomechanicsLab/rmr-solver/b47b06cd23c872e69f92687270e47d4c560bb14b/OpenSim%20Models/for%20RMR%20solver/TSM_subject_noWeight.osim"

# 本模型肌群 ← MoBL 肌肉
GROUPS = {
    "adelt": ["DELT1"],
    "mdelt": ["DELT2"],
    "pdelt": ["DELT3"],
    "pecc": ["PECM1"],
    "pecs": ["PECM2", "PECM3"],
    "lat": ["LAT1", "LAT2", "LAT3"],
    "tmaj": ["TMAJ"],
    "infra": ["INFSP", "TMIN"],
    "subsc": ["SUBSC"],
    "corb": ["CORB"],
    "supsp": ["SUPSP"],
}
THORAX_ORIGIN = {"pecc", "pecs", "lat"}
SCAP_GROUPS = {
    "midtrap": ["TrapeziusScapula_M", "Rhomboideus_S", "Rhomboideus_I"],
    "uptrap": ["TrapeziusScapula_S", "TrapeziusClavicle_S"],
    "lowtrap": ["TrapeziusScapula_I"],
    "serr": ["SerratusAnterior_I", "SerratusAnterior_M", "SerratusAnterior_S"],
}


# ---------------- 向量／矩陣 ----------------
def vadd(a, b): return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
def vsub(a, b): return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
def vmul(a, s): return [a[0] * s, a[1] * s, a[2] * s]
def vdot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def vcross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def vlen(a): return math.sqrt(vdot(a, a))
def vnorm(a):
    l = vlen(a) or 1.0
    return [a[0] / l, a[1] / l, a[2] / l]
def mmul(A, B): return [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
def mvec(A, v): return [vdot(A[i], v) for i in range(3)]
def mT(A): return [[A[j][i] for j in range(3)] for i in range(3)]
I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]


def rot_axis(axis, ang):
    x, y, z = vnorm(axis)
    c, s = math.cos(ang), math.sin(ang)
    C = 1 - c
    return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
            [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
            [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]


def body_xyz(a):  # OpenSim 的 body-fixed X-Y-Z
    return mmul(mmul(rot_axis([1, 0, 0], a[0]), rot_axis([0, 1, 0], a[1])), rot_axis([0, 0, 1], a[2]))


def nums(t): return [float(x) for x in t.split()]


# ---------------- 函數 ----------------
class Func:
    def __init__(self, el):
        self.kind = el.tag
        if el.tag in ("SimmSpline", "PiecewiseLinearFunction", "NaturalCubicSpline"):
            self.x = nums(el.findtext("x"))
            self.y = nums(el.findtext("y"))
            if el.tag != "PiecewiseLinearFunction" and len(self.x) > 2:
                self._spline()
        elif el.tag == "Constant":
            self.x, self.y = [0.0], [float(el.findtext("value"))]
        else:
            raise ValueError("unsupported function " + el.tag)

    def _spline(self):  # 自然三次樣條（SimmSpline 端點條件略有不同；三點以內差異很小）
        x, y = self.x, self.y
        n = len(x)
        h = [x[i + 1] - x[i] for i in range(n - 1)]
        al = [0.0] * n
        for i in range(1, n - 1):
            al[i] = 3 / h[i] * (y[i + 1] - y[i]) - 3 / h[i - 1] * (y[i] - y[i - 1])
        l, mu, z = [1.0] * n, [0.0] * n, [0.0] * n
        for i in range(1, n - 1):
            l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1]
            mu[i] = h[i] / l[i]
            z[i] = (al[i] - h[i - 1] * z[i - 1]) / l[i]
        c, b, d = [0.0] * n, [0.0] * (n - 1), [0.0] * (n - 1)
        for j in range(n - 2, -1, -1):
            c[j] = z[j] - mu[j] * c[j + 1]
            b[j] = (y[j + 1] - y[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3
            d[j] = (c[j + 1] - c[j]) / (3 * h[j])
        self.coef = (b, c, d)

    def __call__(self, t):
        x, y = self.x, self.y
        if len(x) == 1:
            return y[0]
        if not hasattr(self, "coef"):
            if t <= x[0]:
                i = 0
            elif t >= x[-1]:
                i = len(x) - 2
            else:
                i = max(k for k in range(len(x) - 1) if x[k] <= t)
            return y[i] + (y[i + 1] - y[i]) * (t - x[i]) / (x[i + 1] - x[i])
        b, c, d = self.coef
        if t < x[0]:
            return y[0] + b[0] * (t - x[0])
        if t > x[-1]:
            n = len(x) - 1
            dx = x[n] - x[n - 1]
            slope = b[n - 1] + 2 * c[n - 1] * dx + 3 * d[n - 1] * dx * dx
            return y[n] + slope * (t - x[n])
        i = max(k for k in range(len(x) - 1) if x[k] <= t)
        dx = t - x[i]
        return y[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx ** 3


# ---------------- 模型 ----------------
class Model:
    def __init__(self, root):
        self.joints = {}
        for js in root.iter("JointSet"):
            for j in js.find("objects"):
                frames = {f.attrib["name"]: f for f in j.iter("PhysicalOffsetFrame")}
                pname = j.findtext("socket_parent_frame")
                cname = j.findtext("socket_child_frame")
                pf, cf = frames[pname], frames[cname]
                parent = pf.findtext("socket_parent").split("/")[-1]
                child = cf.findtext("socket_parent").split("/")[-1]
                tas = []
                for ta in j.iter("TransformAxis"):
                    if ta.attrib["name"].startswith("rotation"):
                        tas.append(((ta.findtext("coordinates") or "").strip(), nums(ta.findtext("axis"))))
                self.joints[child] = dict(
                    name=j.attrib["name"], parent=parent,
                    t=nums(pf.findtext("translation")), R=body_xyz(nums(pf.findtext("orientation"))),
                    ct=nums(cf.findtext("translation")), cR=body_xyz(nums(cf.findtext("orientation"))),
                    rot=tas)
        self.couplers = []
        for cs in root.iter("ConstraintSet"):
            for c in cs.find("objects"):
                if c.tag != "CoordinateCouplerConstraint":
                    continue
                f = c.find("coupled_coordinates_function")[0]
                self.couplers.append((c.findtext("independent_coordinate_names").strip(),
                                      c.findtext("dependent_coordinate_name").strip(), Func(f)))
        self.wraps = {}
        for b in root.iter("Body"):
            wo = b.find("WrapObjectSet")
            if wo is None:
                continue
            for w in wo.find("objects"):
                d = dict(kind=w.tag, body=b.attrib["name"], R=body_xyz(nums(w.findtext("xyz_body_rotation"))),
                         t=nums(w.findtext("translation")), quadrant=(w.findtext("quadrant") or "all").strip())
                if w.findtext("radius"):
                    d["radius"] = float(w.findtext("radius"))
                if w.findtext("dimensions"):
                    d["dims"] = nums(w.findtext("dimensions"))
                self.wraps[w.attrib["name"]] = d
        self.muscles = {}
        for el in root.iter():
            if not el.tag.endswith("Muscle") or el.find("max_isometric_force") is None:
                continue
            gp = el.find("GeometryPath")
            pts = []
            for pp in gp.find("PathPointSet").find("objects"):
                body = pp.findtext("socket_parent_frame").split("/")[-1]
                if pp.tag == "PathPoint":
                    pts.append(dict(kind="fixed", body=body, loc=nums(pp.findtext("location"))))
                elif pp.tag == "ConditionalPathPoint":
                    pts.append(dict(kind="cond", body=body, loc=nums(pp.findtext("location")),
                                    coord=pp.findtext("socket_coordinate").split("/")[-1], range=nums(pp.findtext("range"))))
                elif pp.tag == "MovingPathPoint":
                    fs = []
                    for ax in "xyz":
                        fs.append((pp.findtext(f"socket_{ax}_coordinate").split("/")[-1], Func(pp.find(f"{ax}_location")[0])))
                    pts.append(dict(kind="moving", body=body, funcs=fs))
            wraps = []
            pw = gp.find("PathWrapSet")
            if pw is not None:
                for w in pw.iter("PathWrap"):
                    rg = nums(w.findtext("range") or "-1 -1")
                    wraps.append((w.findtext("wrap_object").strip(), int(rg[0]), int(rg[1])))
            self.muscles[el.attrib["name"]] = dict(F=float(el.findtext("max_isometric_force")), pts=pts, wraps=wraps)

    # 依肩上舉角求所有座標（節律）
    def coords(self, elv_angle, shoulder_elv, shoulder_rot, rhythm_elv=None):
        q = {"elv_angle": elv_angle, "shoulder_elv": shoulder_elv, "shoulder_rot": shoulder_rot}
        q["elbow_flexion"] = math.radians(90)
        rq = {"elv_angle": elv_angle, "shoulder_elv": shoulder_elv if rhythm_elv is None else rhythm_elv}
        for ind, dep, f in self.couplers:
            if ind in rq and dep.startswith(("sternoclavicular", "unrotscap", "acromioclavicular", "unrothum")):
                q[dep] = f(rq[ind])
        for ind, dep, f in self.couplers:
            if dep == "shoulder1_r2":
                q[dep] = f(elv_angle)
        return q

    def transforms(self, q):
        """回傳各剛體在胸廓座標的 (R, p)。"""
        out = {"thorax": (I3, [0.0, 0.0, 0.0])}

        def get(body):
            if body in out:
                return out[body]
            j = self.joints[body]
            Rp, pp = get(j["parent"])
            Rs = I3
            for cname, axis in j["rot"]:
                ang = q.get(cname, 0.0) if cname else 0.0
                Rs = mmul(Rs, rot_axis(axis, ang))
            # X_parent_child = T(parent offset) · R(spatial) · inv(T(child offset))
            Rpc = mmul(mmul(j["R"], Rs), mT(j["cR"]))
            ppc = vsub(j["t"], mvec(Rpc, j["ct"]))
            R = mmul(Rp, Rpc)
            p = vadd(pp, mvec(Rp, ppc))
            out[body] = (R, p)
            return out[body]

        for b in ("clavicle", "scapula", "humerus"):
            get(b)
        return out


# ---------------- 包覆 ----------------
def circle_wrap_2d(P, S, R, side):
    """2D：圓心原點半徑 R。side=+1 逆時針繞、-1 順時針繞。回傳 (切點1角, 切點2角, 弧角) 或 None。"""
    dP, dS = math.hypot(*P), math.hypot(*S)
    if dP <= R or dS <= R:
        return None
    aP, aS = math.atan2(P[1], P[0]), math.atan2(S[1], S[0])
    tP, tS = math.acos(R / dP), math.acos(R / dS)
    if side > 0:
        t1 = aP + tP
        t2 = aS - tS
        arc = (t2 - t1) % (2 * math.pi)
    else:
        t1 = aP - tP
        t2 = aS + tS
        arc = (t1 - t2) % (2 * math.pi)
    if arc > 2 * math.pi - 1e-9:
        arc = 0.0
    return t1, t2, arc


def seg_hits_circle(P, S, R):
    d = [S[0] - P[0], S[1] - P[1]]
    L2 = d[0] ** 2 + d[1] ** 2
    t = 0.0 if L2 < 1e-18 else max(0.0, min(1.0, -(P[0] * d[0] + P[1] * d[1]) / L2))
    c = [P[0] + d[0] * t, P[1] + d[1] * t]
    return math.hypot(*c) < R, c


def quad_axis(quadrant):
    if quadrant == "all":
        return None
    sign = -1 if quadrant.startswith("-") else 1
    return "xyz".index(quadrant[-1]), sign


def wrap_planar(P, S, R, quad, center_dims=None, nseg=10):
    """在通過原點、P、S 的平面上繞半徑 R 的圓；quad 為 (軸, 正負) 或 None。回傳中間點列表或 None（不包覆）。"""
    e1 = vnorm(P)
    n = vcross(P, S)
    if vlen(n) < 1e-12:
        n = vcross(e1, [0, 0, 1]) if abs(e1[2]) < 0.9 else vcross(e1, [1, 0, 0])
    n = vnorm(n)
    e2 = vcross(n, e1)
    P2 = [vdot(P, e1), vdot(P, e2)]
    S2 = [vdot(S, e1), vdot(S, e2)]
    hit, closest = seg_hits_circle(P2, S2, R)
    cands = []
    for side in (+1, -1):
        r = circle_wrap_2d(P2, S2, R, side)
        if r is None:
            return None
        t1, t2, arc = r
        mid = t1 + side * arc / 2
        mid3 = vadd(vmul(e1, R * math.cos(mid)), vmul(e2, R * math.sin(mid)))
        pts = []
        for k in range(nseg + 1):
            a = t1 + side * arc * k / nseg
            pts.append(vadd(vmul(e1, R * math.cos(a)), vmul(e2, R * math.sin(a))))
        cands.append((arc, mid3, pts))
    if quad is None:
        if not hit:
            return None
        return min(cands, key=lambda c: c[0])[2]
    ax, sg = quad
    ok = [c for c in cands if c[1][ax] * sg > 0]
    if not ok:
        return None
    c3 = vadd(vmul(e1, closest[0]), vmul(e2, closest[1]))
    if hit:
        return min(ok, key=lambda c: c[0])[2]
    return None


def apply_wrap(w, A, B, wR, wp):
    """A、B 為胸廓座標；w 為包覆面；wR, wp 為包覆面所屬剛體的姿態。回傳插入點列表（胸廓座標）或 None。"""
    Rw = mmul(wR, w["R"])
    pw = vadd(wp, mvec(wR, w["t"]))
    toL = lambda x: mvec(mT(Rw), vsub(x, pw))
    toG = lambda x: vadd(pw, mvec(Rw, x))
    P, S = toL(A), toL(B)
    quad = quad_axis(w["quadrant"])
    kind = w["kind"]
    if kind == "WrapSphere":
        pts = wrap_planar(P, S, w["radius"], quad)
        return None if pts is None else [toG(x) for x in pts]
    if kind == "WrapEllipsoid":
        d = w["dims"]
        sc = lambda x: [x[0] / d[0], x[1] / d[1], x[2] / d[2]]
        us = lambda x: [x[0] * d[0], x[1] * d[1], x[2] * d[2]]
        pts = wrap_planar(sc(P), sc(S), 1.0, quad)
        return None if pts is None else [toG(us(x)) for x in pts]
    if kind == "WrapCylinder":
        R = w["radius"]
        P2, S2 = P[:2], S[:2]
        hit, closest = seg_hits_circle(P2, S2, R)
        cands = []
        for side in (+1, -1):
            r = circle_wrap_2d(P2, S2, R, side)
            if r is None:
                return None
            t1, t2, arc = r
            mid = t1 + side * arc / 2
            cands.append((arc, [R * math.cos(mid), R * math.sin(mid)], t1, side))
        if quad is None:
            if not hit:
                return None
            arc, _, t1, side = min(cands, key=lambda c: c[0])
        else:
            ax, sg = quad
            if ax == 2:
                return None
            ok = [c for c in cands if c[1][ax] * sg > 0]
            if not ok or not hit:
                return None
            arc, _, t1, side = min(ok, key=lambda c: c[0])
        # 螺旋展開：z 依平面路徑長線性內插
        T1 = [R * math.cos(t1), R * math.sin(t1)]
        t2 = t1 + side * arc
        T2 = [R * math.cos(t2), R * math.sin(t2)]
        l1 = math.hypot(T1[0] - P2[0], T1[1] - P2[1])
        la = R * arc
        l2 = math.hypot(S2[0] - T2[0], S2[1] - T2[1])
        tot = l1 + la + l2
        pts = []
        n = 10
        for k in range(n + 1):
            a = t1 + side * arc * k / n
            s = l1 + la * k / n
            z = P[2] + (S[2] - P[2]) * s / tot
            pts.append(toG([R * math.cos(a), R * math.sin(a), z]))
        return pts
    return None  # WrapTorus 未實作


class PathCalc:
    def __init__(self, model):
        self.m = model

    def path(self, name, q, X, active=None):
        """回傳 (點列表（胸廓座標）, 每點所屬剛體, active)。"""
        mus = self.m.muscles[name]
        pts, bodies, orig = [], [], []
        act = []
        for i, p in enumerate(mus["pts"]):
            if p["kind"] == "cond":
                on = p["range"][0] <= q[p["coord"]] <= p["range"][1] if active is None else active[i]
                act.append(on)
                if not on:
                    continue
                loc = p["loc"]
            elif p["kind"] == "moving":
                act.append(True)
                loc = [f(q[c]) for c, f in p["funcs"]]
            else:
                act.append(True)
                loc = p["loc"]
            R, o = X[p["body"]]
            pts.append(vadd(o, mvec(R, loc)))
            bodies.append(p["body"])
            orig.append(i + 1)
        # 包覆：每個包覆面只繞一個線段（取長度增加最少者），插入點供後續包覆使用
        seq = [(pt, b, o) for pt, b, o in zip(pts, bodies, orig)]
        for wname, r0, r1 in mus["wraps"]:
            w = self.m.wraps.get(wname)
            if w is None or w["kind"] == "WrapTorus":
                continue
            wR, wp = X[w["body"]]
            best = None
            for i in range(len(seq) - 1):
                a, b = seq[i], seq[i + 1]
                oa = a[2]
                ob = b[2] if b[2] != a[2] else a[2] + 1
                if r0 > 0 and not (oa >= r0 and ob <= r1):
                    continue
                ins = apply_wrap(w, a[0], b[0], wR, wp)
                if ins is None:
                    continue
                L0 = vlen(vsub(b[0], a[0]))
                L1 = vlen(vsub(ins[0], a[0])) + sum(vlen(vsub(ins[k + 1], ins[k])) for k in range(len(ins) - 1)) + vlen(vsub(b[0], ins[-1]))
                if best is None or L1 - L0 < best[0]:
                    best = (L1 - L0, i, ins)
            if best:
                _, i, ins = best
                seq = seq[: i + 1] + [(x, "wrap:" + w["body"], seq[i][2]) for x in ins] + seq[i + 1:]
        return seq, act

    def length(self, name, q, X, active=None):
        seq, _ = self.path(name, q, X, active)
        return sum(vlen(vsub(seq[k + 1][0], seq[k][0])) for k in range(len(seq) - 1))


# ---------------- 本模型座標 ----------------
# OpenSim 胸廓：X 前、Y 上、Z 右；本模型：X 右、Y 上、Z 前。位置 p_ours = P p_os；
# 力臂（擬向量，以分量叉積定義）m_ours = −P m_os。
def to_ours(v): return [v[2], v[1], v[0]]
def moment_to_ours(m): return [-m[2], -m[1], -m[0]]


def humerus_axis_os(model, elv_angle, shoulder_elv):
    q = model.coords(elv_angle, shoulder_elv, 0.0)
    X = model.transforms(q)
    R, o = X["humerus"]
    elbow = vadd(o, mvec(R, [0.0061, -0.2904, -0.0123]))
    return vnorm(vsub(elbow, o))


def solve_mobl_angles(model, theta, phi):
    """找 MoBL (elv_angle, shoulder_elv) 使肱骨方向（肩→肘）等於本模型 (θ, φ)。"""
    target = [math.sin(theta) * math.sin(phi), -math.cos(theta), math.sin(theta) * math.cos(phi)]  # 本模型
    t_os = [target[2], target[1], target[0]]
    ea, se = math.pi / 2 - phi, theta
    for _ in range(30):
        h = humerus_axis_os(model, ea, se)
        err = vsub(h, t_os)
        if vlen(err) < 1e-10:
            break
        eps = 1e-6
        J = []
        for d in ((eps, 0), (0, eps)):
            h2 = humerus_axis_os(model, ea + d[0], se + d[1])
            J.append(vmul(vsub(h2, h), 1 / eps))
        # 最小平方 2x2
        a11, a12, a22 = vdot(J[0], J[0]), vdot(J[0], J[1]), vdot(J[1], J[1])
        b1, b2 = -vdot(J[0], err), -vdot(J[1], err)
        det = a11 * a22 - a12 * a12
        if abs(det) < 1e-14:
            break
        ea += (a22 * b1 - a12 * b2) / det
        se += (a11 * b2 - a12 * b1) / det
    return ea, se


def vee(Rd):  # 小旋轉矩陣 → 旋轉向量
    return [(Rd[2][1] - Rd[1][2]) / 2, (Rd[0][2] - Rd[2][0]) / 2, (Rd[1][0] - Rd[0][1]) / 2]


def moment_arms(model, pc, theta, phi, psi=0.0, names=None):
    """回傳 {肌肉: dict(m=盂肱力臂向量(本模型), sc=[scElev, scRet] 或 None)}。肩胛固定在節律位置。"""
    ea, se = solve_mobl_angles(model, theta, phi)
    rot = psi  # MoBL shoulder_rot（以 Y-X-Y 序列，0 等於平行運送參考）；正值方向於下方換算
    base = model.coords(ea, se, rot)
    X0 = model.transforms(base)
    h_os = vnorm(vsub(vadd(X0["humerus"][1], mvec(X0["humerus"][0], [0.0061, -0.2904, -0.0123])), X0["humerus"][1]))
    eps = 1e-5
    keys = ["elv_angle", "shoulder_elv", "shoulder_rot"]
    W = []
    Xs = {}
    for k in keys:
        for sgn in (+1, -1):
            qq = dict(base)
            qq[k] = base[k] + sgn * eps
            if k == "elv_angle":
                qq["shoulder1_r2"] = -qq["elv_angle"]
            Xs[(k, sgn)] = (qq, model.transforms(qq))  # 肩胛座標維持 base（節律位置不動）
        Rp, Rm = Xs[(k, 1)][1]["humerus"][0], Xs[(k, -1)][1]["humerus"][0]
        Rd = mmul(vsub_m(Rp, Rm), mT(X0["humerus"][0]))
        W.append(vmul(vee(Rd), 1 / (2 * eps)))
    out = {}
    names = names or list(model.muscles)
    for n in names:
        _, act = pc.path(n, base, X0)
        g = []
        for k in keys:
            Lp = pc.length(n, Xs[(k, 1)][0], Xs[(k, 1)][1], act)
            Lm = pc.length(n, Xs[(k, -1)][0], Xs[(k, -1)][1], act)
            g.append(-(Lp - Lm) / (2 * eps))
        m_os = solve3(W, g)  # W[i]·m = g[i]
        res = dict(m=moment_to_ours(m_os))
        # 胸廓起點：離開胸廓的力線對胸鎖關節的力矩
        seq, _ = pc.path(n, base, X0, act)
        sc = None
        for i in range(len(seq) - 1):
            a_tx = seq[i][1] in ("thorax", "wrap:thorax")
            b_tx = seq[i + 1][1] in ("thorax", "wrap:thorax")
            if a_tx != b_tx:
                p_arm, p_tx = (seq[i + 1][0], seq[i][0]) if a_tx else (seq[i][0], seq[i + 1][0])
                u = vnorm(vsub(p_tx, p_arm))  # 肌力拉向胸廓
                SC = model.joints["clavicle"]["t"]
                mo = moment_to_ours(vcross(vsub(p_arm, SC), u))
                sc = [mo[2], mo[1]]  # scElev 軸＝前方 Z、scRet 軸＝上方 Y（本模型分量）
                break
        res["sc"] = sc
        out[n] = res
    return out, to_ours(h_os)


def scap_moment_arms(mobl, pc, theta, phi, psi, names):
    """把 Seth 胸廓／肩胛路徑點放入 MoBL 節律姿勢，求本模型肩帶兩軸 −∂L/∂角。"""
    ea, se = solve_mobl_angles(mobl, theta, phi)
    q = mobl.coords(ea, se, psi)
    X = mobl.transforms(q)
    SC = mobl.joints["clavicle"]["t"]

    def moved(axis, angle):
        Rmove = rot_axis(axis, angle)
        out = dict(X)
        for body in ("clavicle", "scapula"):
            R, p = X[body]
            out[body] = (mmul(Rmove, R), vadd(SC, mvec(Rmove, vsub(p, SC))))
        return out

    eps = 1e-5
    axes = ([-1, 0, 0], [0, -1, 0])  # 本模型 +scElev/+scRet，映回 MoBL 的反射座標
    shifts = [(moved(axis, eps), moved(axis, -eps)) for axis in axes]
    return {name: [-(pc.length(name, q, xp) - pc.length(name, q, xm)) / (2 * eps)
                   for xp, xm in shifts] for name in names}


def vsub_m(A, B): return [[A[i][j] - B[i][j] for j in range(3)] for i in range(3)]


def solve3(W, g):
    A = [list(W[i]) + [g[i]] for i in range(3)]
    for c in range(3):
        p = max(range(c, 3), key=lambda r: abs(A[r][c]))
        A[c], A[p] = A[p], A[c]
        for r in range(3):
            if r != c:
                f = A[r][c] / A[c][c]
                for k in range(c, 4):
                    A[r][k] -= f * A[c][k]
    return [A[i][3] / A[i][i] for i in range(3)]


# ---------------- 擬合 ----------------
def monomials(h, deg):
    x, y, z = h
    out = []
    for i in range(deg + 1):
        for j in range(deg + 1 - i):
            for k in range(deg + 1 - i - j):
                out.append(x ** i * y ** j * z ** k)
    return out


def exps(deg):
    return [(i, j, k) for i in range(deg + 1) for j in range(deg + 1 - i) for k in range(deg + 1 - i - j)]


def lstsq(rows, ys, ridge=1e-6):
    n = len(rows[0])
    A = [[0.0] * n for _ in range(n)]
    b = [0.0] * n
    for r, y in zip(rows, ys):
        for i in range(n):
            b[i] += r[i] * y
            for j in range(n):
                A[i][j] += r[i] * r[j]
    for i in range(n):
        A[i][i] += ridge
    M = [A[i] + [b[i]] for i in range(n)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        for r in range(n):
            if r != c and M[r][c] != 0:
                f = M[r][c] / M[c][c]
                for k in range(c, n + 1):
                    M[r][k] -= f * M[c][k]
    return [M[i][n] / M[i][i] for i in range(n)]


def load_root(path):
    if path:
        return ET.parse(path).getroot()
    with urllib.request.urlopen(URL) as r:
        return ET.fromstring(r.read())


def load_seth(path):
    if path:
        root = ET.parse(path).getroot()
    else:
        with urllib.request.urlopen(SETH_URL) as response:
            root = ET.fromstring(response.read())
    names = {name for group in SCAP_GROUPS.values() for name in group}
    # TSM 其餘肌肉含本工具不需要的 MultiplierFunction 移動點，先只保留肩胛九束。
    for obj in root.iter("objects"):
        for el in list(obj):
            if el.tag.endswith("Muscle") and el.attrib.get("name") not in names:
                obj.remove(el)
    return root


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osim")
    ap.add_argument("--seth")
    ap.add_argument("--json")
    ap.add_argument("--js")
    ap.add_argument("--table", action="store_true")
    a = ap.parse_args()
    model = Model(load_root(a.osim))
    pc = PathCalc(model)
    scap_model = Model(load_seth(a.seth))
    scap_pc = PathCalc(scap_model)
    names = sorted({n for g in GROUPS.values() for n in g})
    scap_names = sorted({n for g in SCAP_GROUPS.values() for n in g})
    # 取樣：上舉 5°～165°、平面 −60°～180°、軸旋 −45°～+45°；更大軸旋需外插（見 docs）
    samples = []
    for th in range(5, 170, 10):
        for ph in range(-60, 181, 15):
            for ps in (-45, 0, 45):
                res, h = moment_arms(model, pc, math.radians(th), math.radians(ph), math.radians(ps), names)
                scap = scap_moment_arms(model, scap_pc, math.radians(th), math.radians(ph), math.radians(ps), scap_names)
                samples.append(dict(theta=th, phi=ph, psi=ps, h=h, res=res, scap=scap))
    groups = {}
    for gname, members in GROUPS.items():
        F = [model.muscles[n]["F"] for n in members]
        gs = []
        for s in samples:
            m = [sum(Fi * s["res"][n]["m"][k] for Fi, n in zip(F, members)) / sum(F) for k in range(3)]
            sc = None
            if gname in THORAX_ORIGIN:
                sc = [sum(Fi * (s["res"][n]["sc"] or [0, 0])[k] for Fi, n in zip(F, members)) / sum(F) for k in range(2)]
            gs.append(dict(theta=s["theta"], phi=s["phi"], psi=s["psi"], h=s["h"], m=m, sc=sc))
        groups[gname] = dict(F=sum(F), members=members, samples=gs)
    scap_groups = {}
    for gname, members in SCAP_GROUPS.items():
        F = [scap_model.muscles[n]["F"] for n in members]
        gs = []
        for s in samples:
            arms = [sum(Fi * s["scap"][n][k] for Fi, n in zip(F, members)) / sum(F) for k in range(2)]
            gs.append(dict(theta=s["theta"], phi=s["phi"], psi=s["psi"], h=s["h"], sc=arms))
        scap_groups[gname] = dict(F=sum(F), members=members, samples=gs)
    if a.json:
        with open(a.json, "w") as f:
            json.dump(dict(shoulder=groups, scapula=scap_groups), f)
    DEG, DEG_PSI, DEG_SC = 3, 2, 2
    fits = {}
    for gname, g in groups.items():
        rows, rows_sc = [], []
        usable = [s for s in g["samples"] if vlen(s["m"]) <= 0.12]
        for s in usable:
            ps = math.radians(s["psi"])
            base = monomials(s["h"], DEG)
            rows.append(base + [ps * v for v in monomials(s["h"], DEG_PSI)])
            rows_sc.append(monomials(s["h"], DEG_SC))
        coef = []
        rms = []
        for k in range(3):
            ys = [s["m"][k] for s in usable]
            c = lstsq(rows, ys)
            coef.append(c)
            rms.append(math.sqrt(sum((sum(ci * ri for ci, ri in zip(c, r)) - y) ** 2 for r, y in zip(rows, ys)) / len(ys)))
        fit = dict(m=coef, rms=rms, used=len(usable), rejected=len(g["samples"]) - len(usable))
        if gname in THORAX_ORIGIN:
            fit["sc"] = [lstsq(rows_sc, [s["sc"][k] for s in usable]) for k in range(2)]
        fits[gname] = fit
        print(f"{gname:6s} F={g['F']:.1f} 樣本={len(usable)}/{len(g['samples'])} 擬合 RMS (mm) x={rms[0]*1000:.2f} y={rms[1]*1000:.2f} z={rms[2]*1000:.2f}", file=sys.stderr)
    scap_fits = {}
    for gname, g in scap_groups.items():
        usable = [s for s in g["samples"] if all(abs(v) <= 0.20 for v in s["sc"])]
        rows = [monomials(s["h"], DEG_SC) for s in usable]
        coef = [lstsq(rows, [s["sc"][k] for s in usable]) for k in range(2)]
        rms = [math.sqrt(sum((sum(ci * ri for ci, ri in zip(coef[k], row)) - s["sc"][k]) ** 2
                             for row, s in zip(rows, usable)) / len(usable)) for k in range(2)]
        scap_fits[gname] = dict(sc=coef, rms=rms, used=len(usable), rejected=len(g["samples"]) - len(usable))
        print(f"{gname:7s} Seth F={g['F']:.1f} 樣本={len(usable)}/{len(g['samples'])} 擬合 RMS (mm) elev={rms[0]*1000:.2f} ret={rms[1]*1000:.2f}", file=sys.stderr)
    if a.js:
        write_js(a.js, fits, scap_fits, DEG, DEG_PSI, DEG_SC)
    if a.table:
        print_table(groups)


def print_table(groups):
    def proj(m, th, ph):
        t, p = math.radians(th), math.radians(ph)
        c, s, ct, st = math.cos(p), math.sin(p), math.cos(t), math.sin(t)
        e_elev = [-c, 0, s]
        e_hadd = [-ct * s, -st, -ct * c]
        h = [st * s, -ct, st * c]
        return vdot(m, e_elev), vdot(m, e_hadd), vdot(m, h)
    for gname, g in groups.items():
        print(f"## {gname}  (rElev / rHadd / rRot, mm；ψ=0)")
        for s in g["samples"]:
            if s["psi"] != 0 or s["phi"] not in (0, 45, 90, 135, 180, -45) or s["theta"] not in (5, 35, 65, 95, 125, 155):
                continue
            e, hd, r = proj(s["m"], s["theta"], s["phi"])
            sc = "" if s["sc"] is None else f"  scElev {s['sc'][0]*1000:6.1f} scRet {s['sc'][1]*1000:6.1f}"
            print(f"  θ={s['theta']:3d} φ={s['phi']:4d}: {e*1000:6.1f} {hd*1000:6.1f} {r*1000:6.1f}{sc}")


def write_js(path, fits, scap_fits, deg, deg_psi, deg_sc):
    r6 = lambda v: float(f"{v:.6g}")
    lines = [
        "// 由 tools/shoulder_arms.py 自動產生，請勿手改：MoBL-ARMS（MOBL_ARMS_41.osim，commit 459e2eb）路徑點計算的肩部力臂擬合。",
        "// m(h, ψ)：相對盂肱中心的三維力臂向量（本模型座標 X 右、Y 上、Z 前；單位 m），",
        "// h 為上臂（肩→肘）單位向量，ψ 為上臂軸旋（rad）；m = Σ c·x^i y^j z^k ＋ ψ Σ d·x^i y^j z^k。",
        "// sc：胸廓肌對胸鎖關節的 [scElev, scRet] 診斷投影；與本模型肩胛座標不等價，未接入出力。",
        "// scap：Seth TSM 肩胛肌束放入 MoBL 節律姿勢後，對本模型兩個胸鎖等效軸的虛功擬合。",
        f"export const SHOULDER_FIT_DEG = {{ m: {deg}, psi: {deg_psi}, sc: {deg_sc} }};",
        f"export const SHOULDER_FIT_EXP = {json.dumps({'m': exps(deg), 'psi': exps(deg_psi), 'sc': exps(deg_sc)})};",
        "export const SHOULDER_FITS = {",
    ]
    for g, f in fits.items():
        m = [[r6(v) for v in c] for c in f["m"]]
        s = f"  {g}: {{ m: {json.dumps(m)}"
        if "sc" in f:
            s += f", sc: {json.dumps([[r6(v) for v in c] for c in f['sc']])}"
        s += " },"
        lines.append(s)
    lines.append("};")
    lines.append("export const SHOULDER_SCAP_FITS = {")
    for g, fit in scap_fits.items():
        lines.append(f"  {g}: {json.dumps([[r6(v) for v in c] for c in fit['sc']])},")
    lines.append("};")
    lines += [
        "const dotPoly = (coefs, powers, h) => coefs.reduce((sum, c, i) => {",
        "  const [a, b, d] = powers[i];",
        "  return sum + c * h[0] ** a * h[1] ** b * h[2] ** d;",
        "}, 0);",
        "export function shoulderFitVector(id, q) {",
        "  const fit = SHOULDER_FITS[id];",
        "  const t = q.shElev, p = q.shPlane, psi = q.shRot || 0;",
        "  const h = [Math.sin(t) * Math.sin(p), -Math.cos(t), Math.sin(t) * Math.cos(p)];",
        "  return fit.m.map((coefs) => dotPoly(coefs.slice(0, SHOULDER_FIT_EXP.m.length), SHOULDER_FIT_EXP.m, h)",
        "    + psi * dotPoly(coefs.slice(SHOULDER_FIT_EXP.m.length), SHOULDER_FIT_EXP.psi, h));",
        "}",
        "export function shoulderFitScap(id, axis, q) {",
        "  const t = q.shElev, p = q.shPlane;",
        "  const h = [Math.sin(t) * Math.sin(p), -Math.cos(t), Math.sin(t) * Math.cos(p)];",
        "  const coefs = SHOULDER_SCAP_FITS[id]?.[axis] || SHOULDER_FITS[id].sc[axis];",
        "  return dotPoly(coefs, SHOULDER_FIT_EXP.sc, h);",
        "}",
    ]
    with open(path, "w") as fh:
        fh.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
