"""從固定版本 OpenSim 模型重算肌力、纖維／肌腱參數與簡化髖路徑力臂。

執行：python3 tools/muscle_params.py
僅用標準函式庫；不會將上游的大型模型檔寫進專案。
"""

import math
import urllib.request
import xml.etree.ElementTree as ET


SOURCES = {
    "R": "https://raw.githubusercontent.com/opensim-org/opensim-models/d9b05d470b1a481c222372c85b75772faf8f7792/Models/Rajagopal/Rajagopal2016.osim",
    "U": "https://raw.githubusercontent.com/CEINMS-RT/UpperLimbModel/459e2ebbf47acb72b0ecbc59950a2d0a983d28db/MOBL_ARMS_41.osim",
}

# 清單只計右側；雙側在本專案由鏡像表示，不在此處加倍。
GROUPS = {
    "vasti": ("R", "vasint_r vaslat_r vasmed_r"),
    "rf": ("R", "recfem_r"),
    "hams": ("R", "bflh_r semimem_r semiten_r"),
    "gmax": ("R", "glmax1_r glmax2_r glmax3_r"),
    "gmed": ("R", "glmed1_r glmed2_r glmed3_r"),
    "addmag": ("R", "addmagDist_r addmagIsch_r addmagMid_r addmagProx_r"),
    "addl": ("R", "addlong_r addbrev_r"),
    "ilio": ("R", "iliacus_r psoas_r"),
    "gas": ("R", "gaslat_r gasmed_r"),
    "sol": ("R", "soleus_r"),
    "ta": ("R", "tibant_r"),
    "pecs": ("U", "PECM2 PECM3"),
    "pecc": ("U", "PECM1"),
    "adelt": ("U", "DELT1"),
    "pdelt": ("U", "DELT3"),
    "lat": ("U", "LAT1 LAT2 LAT3"),
    "trilong": ("U", "TRIlong"),
    "trilat": ("U", "TRIlat TRImed"),
    "bic": ("U", "BIClong BICshort"),
    "brach": ("U", "BRA BRD"),
    "tmaj": ("U", "TMAJ"),
    "corb": ("U", "CORB"),
    "infra": ("U", "INFSP TMIN"),
    "subsc": ("U", "SUBSC"),
    "mdelt": ("U", "DELT2"),
}

# 教學上可獨立求解的子部位；數字只從上面的固定版本模型讀取。
SUBGROUPS = {
    "vaslat": ("R", "vaslat_r"), "vasmed": ("R", "vasmed_r"), "vasint": ("R", "vasint_r"),
    "bflh": ("R", "bflh_r"),
    "semis": ("R", "semimem_r semiten_r"),
    "bfsh": ("R", "bfsh_r"),
    "gmaxUpper": ("R", "glmax1_r"),
    "gmaxLower": ("R", "glmax2_r glmax3_r"),
    "gmedFront": ("R", "glmed1_r"),
    "gmedBack": ("R", "glmed2_r glmed3_r"),
    "addmagIsch": ("R", "addmagIsch_r"),
    "addmagOther": ("R", "addmagDist_r addmagMid_r addmagProx_r"),
    "addlong": ("R", "addlong_r"), "addbrev": ("R", "addbrev_r"),
    "iliacus": ("R", "iliacus_r"), "psoas": ("R", "psoas_r"),
    "gaslat": ("R", "gaslat_r"), "gasmed": ("R", "gasmed_r"),
    "tricepsLat": ("U", "TRIlat"), "tricepsMed": ("U", "TRImed"),
    "bicLong": ("U", "BIClong"),
    "bicShort": ("U", "BICshort"),
    "brachialis": ("U", "BRA"),
    "brachioradialis": ("U", "BRD"),
    "pronatorTeres": ("U", "PT"),
    "pronatorQuadratus": ("U", "PQ"),
    "supinator": ("U", "SUP"),
}

# 跨膝肌的中立脛骨原點：Walker knee 的股骨／脛骨 offset 相減；僅供直線弦診斷。
TIBIA_NEUTRAL = (-0.00000046, -0.4044252, -0.00126526)


def hamstring_hip_chord(el, angle):
    points = [(p.findtext("socket_parent_frame"), p.findtext("location"))
              for p in el.findall(".//PathPointSet/objects/*")]
    proximal = next(tuple(map(float, loc.split())) for frame, loc in points if frame and frame.endswith("/pelvis") and loc)
    distal = next(tuple(map(float, loc.split())) for frame, loc in points if frame and frame.endswith("/tibia_r") and loc)
    distal = tuple(distal[i] + TIBIA_NEUTRAL[i] for i in range(3))
    c, s = math.cos(angle), math.sin(angle)
    moved = (distal[0] * c - distal[1] * s, distal[0] * s + distal[1] * c, distal[2])
    return math.dist(proximal, tuple(HIP_CENTER[i] + moved[i] for i in range(3)))


def hamstring_hip_arm(models, key, angle):
    source, names = SUBGROUPS[key]
    pairs = []
    for name in names.split():
        el = models[source][name]
        f = float(el.findtext("max_isometric_force"))
        h = 0.0001
        arm = (hamstring_hip_chord(el, angle + h) - hamstring_hip_chord(el, angle - h)) / (2 * h)
        pairs.append((f, arm))
    return sum(f * r for f, r in pairs) / sum(f for f, _ in pairs)


# MoBL-ARMS 肘屈角 45° 的兩路徑點直線弦；沒有包覆曲面，不拿深屈端外插。
ELBOW_CENTER = (0.0061, -0.2904, -0.0123)
ELBOW_AXIS = (0.04940001, 0.03660001, 0.99810825)
RADIUS_OFFSET = (0.0004, -0.011503, 0.019999)


def elbow_chord(el, angle):
    points = [(p.findtext("socket_parent_frame"), p.findtext("location"))
              for p in el.findall(".//PathPointSet/objects/*")]
    prox = next(tuple(map(float, loc.split())) for frame, loc in reversed(points) if frame and frame.endswith("/humerus") and loc)
    frame, loc = next((frame, loc) for frame, loc in points if frame and (frame.endswith("/ulna") or frame.endswith("/radius")) and loc)
    dist = tuple(map(float, loc.split()))
    if frame.endswith("/radius"):
        dist = tuple(dist[i] + RADIUS_OFFSET[i] for i in range(3))
    c, s = math.cos(angle), math.sin(angle)
    dot = sum(ELBOW_AXIS[i] * dist[i] for i in range(3))
    cross = (ELBOW_AXIS[1] * dist[2] - ELBOW_AXIS[2] * dist[1],
             ELBOW_AXIS[2] * dist[0] - ELBOW_AXIS[0] * dist[2],
             ELBOW_AXIS[0] * dist[1] - ELBOW_AXIS[1] * dist[0])
    moved = tuple(ELBOW_CENTER[i] + c * dist[i] + s * cross[i] + (1 - c) * dot * ELBOW_AXIS[i] for i in range(3))
    return math.dist(prox, moved)


def elbow_arm(models, key, angle):
    source, names = (GROUPS | SUBGROUPS)[key]
    pairs = []
    for name in names.split():
        el = models[source][name]
        f = float(el.findtext("max_isometric_force"))
        h = 0.0001
        pairs.append((f, (elbow_chord(el, angle + h) - elbow_chord(el, angle - h)) / (2 * h)))
    return sum(f * r for f, r in pairs) / sum(f for f, _ in pairs)


def read_models():
    out = {}
    for key, url in SOURCES.items():
        with urllib.request.urlopen(url) as response:
            root = ET.fromstring(response.read())
        out[key] = {
            el.attrib["name"]: el
            for el in root.iter()
            if el.tag.endswith("Muscle") and el.find("max_isometric_force") is not None
        }
    return out


def group_values(models, key):
    source, names = (GROUPS | SUBGROUPS)[key]
    els = [models[source][name] for name in names.split()]
    forces = [float(el.findtext("max_isometric_force")) for el in els]
    lengths = [float(el.findtext("optimal_fiber_length")) for el in els]
    tendons = [float(el.findtext("tendon_slack_length")) for el in els]
    pennations = [float(el.findtext("pennation_angle_at_optimal")) for el in els]
    force = sum(forces)
    return (force,
            sum(f * l for f, l in zip(forces, lengths)) / force,
            sum(f * (l + t) for f, l, t in zip(forces, lengths, tendons)) / force,
            sum(f * t for f, t in zip(forces, tendons)) / force,
            sum(f * a for f, a in zip(forces, pennations)) / force)


# Rajagopal 右髖中心，取自 hip_r/pelvis_offset translation；髖屈曲軸是 Z。
HIP_CENTER = (-0.056276, -0.07849, 0.07726)


def hip_chord_length(el, angle, axis):
    points = []
    for point in el.findall(".//PathPointSet/objects/*"):
        loc = point.findtext("location")
        frame = point.findtext("socket_parent_frame")
        if loc and frame:
            points.append((frame.split("/")[-1], tuple(map(float, loc.split()))))
    proximal = next((p for frame, p in reversed(points) if frame == "pelvis"), None)
    distal = next((p for frame, p in points if frame == "femur_r"), None)
    if proximal is None or distal is None:
        return None
    x, y, z = distal
    c, s = math.cos(angle), math.sin(angle)
    moved = (x * c - y * s, x * s + y * c, z) if axis == "flex" else (x, y * c - z * s, y * s + z * c)
    return math.dist(proximal, tuple(HIP_CENTER[i] + moved[i] for i in range(3)))


def hip_arm(models, key, angle, axis):
    source, names = (GROUPS | SUBGROUPS)[key]
    assert source == "R"
    pairs = []
    for name in names.split():
        el = models[source][name]
        h = 0.0001
        lp = hip_chord_length(el, angle + h, axis)
        lm = hip_chord_length(el, angle - h, axis)
        if lp is not None:
            pairs.append((float(el.findtext("max_isometric_force")), (lp - lm) / (2 * h)))
    return sum(f * r for f, r in pairs) / sum(f for f, _ in pairs)


if __name__ == "__main__":
    models = read_models()
    for key in GROUPS | SUBGROUPS:
        force, length, total_length, tendon, pennation = group_values(models, key)
        extras = ""
        if key in ("gmax", "addmag", "addl", "ilio", "gmaxUpper", "gmaxLower", "gmedFront", "gmedBack", "addmagIsch", "addmagOther"):
            extras += " hipExt@0/45/90=" + "/".join(f"{hip_arm(models, key, math.radians(deg), 'flex'):.4f}" for deg in (0, 45, 90))
        if key in ("gmax", "gmed", "addmag", "addl", "gmaxUpper", "gmaxLower", "gmedFront", "gmedBack", "addmagIsch", "addmagOther"):
            extras += f" hipAbd@0={hip_arm(models, key, 0, 'abd'):.4f}"
        if key in ("bflh", "semis"):
            extras += " hipExtChord@0/45/90=" + "/".join(f"{hamstring_hip_arm(models, key, math.radians(deg)):.4f}" for deg in (0, 45, 90))
        if key in ("bicLong", "bicShort", "brachialis", "brachioradialis", "tricepsLat", "tricepsMed"):
            extras += f" elbowChord@45={elbow_arm(models, key, math.radians(45)):.4f}"
        print(f"{key:10s} F={force:.1f} Lf={length:.4f} Lmt={total_length:.4f} Lt={tendon:.4f} alpha={pennation:.4f}{extras}")
