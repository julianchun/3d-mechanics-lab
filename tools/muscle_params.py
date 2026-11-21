"""從固定版本的 OpenSim 模型重算肌力、纖維長與簡化髖路徑力臂。

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
    source, names = GROUPS[key]
    els = [models[source][name] for name in names.split()]
    forces = [float(el.findtext("max_isometric_force")) for el in els]
    lengths = [float(el.findtext("optimal_fiber_length")) for el in els]
    tendons = [float(el.findtext("tendon_slack_length")) for el in els]
    force = sum(forces)
    return (force,
            sum(f * l for f, l in zip(forces, lengths)) / force,
            sum(f * (l + t) for f, l, t in zip(forces, lengths, tendons)) / force)


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
    source, names = GROUPS[key]
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
    for key in GROUPS:
        force, length, total_length = group_values(models, key)
        extras = ""
        if key in ("gmax", "addmag", "addl", "ilio"):
            extras += " hipExt@0/45/90=" + "/".join(f"{hip_arm(models, key, math.radians(deg), 'flex'):.4f}" for deg in (0, 45, 90))
        if key in ("gmax", "gmed", "addmag", "addl"):
            extras += f" hipAbd@0={hip_arm(models, key, 0, 'abd'):.4f}"
        print(f"{key:10s} F={force:.1f} Lf={length:.4f} Lmt={total_length:.4f}{extras}")
