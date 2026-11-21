# 從 BodyParts3D（CC BY 4.0）抽出骨骼，簡化並轉成各肢段的局部座標
# BP3D 座標：mm，z 向上，-x = 身體右側，-y = 前方
import numpy as np, json, struct, fast_simplification as fs
from bp3d_common import load_parts, EL

RIGHT = np.array([-1.0, 0, 0]); ANT = np.array([0, -1.0, 0]); UP = np.array([0, 0, 1.0])

def sphere_fit(P):
    A = np.c_[2 * P, np.ones(len(P))]; b = (P ** 2).sum(1)
    c = np.linalg.lstsq(A, b, rcond=None)[0]
    return c[:3]

def simplify(V, F, target):
    if len(F) <= target: return V, F
    v, f = fs.simplify(V.astype(np.float32), F.astype(np.int32), target_reduction=1 - target / len(F))
    return v.astype(np.float64), f

fem, femF = load_parts(['right femur'])
z1 = fem[:, 2].max()
top = fem[fem[:, 2] > z1 - 60]
head_pts = top[top[:, 0] > top[:, 0].max() - 45]   # 右股骨的內側 = x 較大
hipR = sphere_fit(head_pts)
kneeR = fem[fem[:, 2] < fem[:, 2].min() + 25].mean(0); kneeR[2] = fem[:, 2].min() + 12
tib, _ = load_parts(['right tibia']); fib, _ = load_parts(['right fibula'])
mm = tib[tib[:, 2].argmin()]; lm = fib[fib[:, 2].argmin()]
ankleR = (mm + lm) / 2; ankleR[2] += 12
hum, _ = load_parts(['right humerus'])
ht = hum[hum[:, 2] > hum[:, 2].max() - 45]
shR = sphere_fit(ht[ht[:, 0] > ht[:, 0].max() - 35])
elbR = hum[hum[:, 2] < hum[:, 2].min() + 20].mean(0); elbR[2] = hum[:, 2].min() + 10
# 手：腕骨＋掌骨＋指骨；握點（力學用）= 第 2～5 掌骨頭，手指在 rig.js 依槓的位置包覆
HAND = ['right ' + n for n in ['trapezoid', 'scaphoid', 'lunate', 'triquetral', 'pisiform', 'trapezium', 'capitate', 'hamate',
        'first metacarpal bone', 'second metacarpal bone', 'third metacarpal bone', 'fourth metacarpal bone', 'fifth metacarpal bone']]
HAND_PALM = HAND[:8] + HAND[9:]  # 拇指掌骨另外一段（可繞腕掌關節轉）
FING = ['index finger', 'middle finger', 'ring finger', 'little finger']
DIGIT_PARTS = {'t0': 'right first metacarpal bone', 't1': 'proximal phalanx of right thumb', 't2': 'distal phalanx of right thumb'}
for i, f in enumerate(FING):
    for j, ph in enumerate(['proximal', 'middle', 'distal']):
        DIGIT_PARTS[f'f{i}{j}'] = f'{ph} phalanx of right {f}'
mc, _ = load_parts(['right ' + n + ' metacarpal bone' for n in ['second', 'third', 'fourth', 'fifth']])
gripR = mc[mc[:, 2] < mc[:, 2].min() + 15].mean(0)
foot, _ = load_parts(['right foot'])
toeR = foot[foot[:, 1].argmin()]
sole = foot[:, 2].min()
hipC = hipR * np.array([0, 1, 1]); shC = shR * np.array([0, 1, 1])
skull, _ = load_parts(['skull'])
height = skull[:, 2].max() - sole

m = lambda a, b: float(np.linalg.norm(a - b)) / 1000
dims = dict(height=height / 1000, Lt=m(hipR, kneeR), Ls=m(kneeR, ankleR), Ltr=m(hipC, shC), Lu=m(shR, elbR), Lf=m(elbR, gripR),
            hipHalf=abs(hipR[0]) / 1000, shHalf=abs(shR[0]) / 1000, ankleH=(ankleR[2] - sole) / 1000,
            toeFwd=float(ankleR[1] - toeR[1]) / 1000)
print(json.dumps(dims, indent=1))

def frame(origin, distal, antRef):
    ax = distal - origin; L = np.linalg.norm(ax); ax /= L
    an = antRef - ax * (antRef @ ax); an /= np.linalg.norm(an)
    lat = np.cross(ax, an)
    if lat @ RIGHT < 0: lat = -lat
    return origin, L, np.stack([lat, ax, an])

FORE = frame(elbR, gripR, ANT)
groups = {
    'thigh': (['right femur'], frame(hipR, kneeR, ANT), 3000),
    'patella': (['right patella'], frame(hipR, kneeR, ANT), 400),
    'shank': (['right tibia', 'right fibula'], frame(kneeR, ankleR, ANT), 3000),
    'upper': (['right humerus'], frame(shR, elbR, ANT), 2500),
    # 前臂拆成尺骨（隨肘屈伸）、橈骨（可繞旋前軸轉）、手掌與 14 節指骨；全部存在前臂座標
    'ulna': (['right ulna'], FORE, 2400),
    'radius': (['right radius'], FORE, 2400),
    'hand': (HAND_PALM, FORE, 2600),
    **{k: ([n], FORE, 160) for k, n in DIGIT_PARTS.items()},
    # 腳：原點在踝，y = 向上，z = 往腳尖（水平），長度單位 = 小腿長
    'foot': (['right foot'], (ankleR, np.linalg.norm(kneeR - ankleR), np.stack([RIGHT, UP, ANT])), 5000),
    'trunk': (['right hip bone', 'left hip bone', 'sacrum', 'vertebral column', 'rib cage', 'sternum', 'skull',
               ], frame(hipC, shC, ANT), 26000),
    'scapula': (['right scapula', 'right clavicle'], frame(hipC, shC, ANT), 3000),
}
# 胸鎖關節（鎖骨內側端）：肩帶的旋轉中心
clav, _ = load_parts(['right clavicle'])
scj = clav[clav[:, 0] > clav[:, 0].max() - 10].mean(0)
o, L, R = frame(hipC, shC, ANT)
toLocal = lambda p: ((p - o) @ R.T) / 1000
print('SCJ local m', toLocal(scj).round(4), 'shoulderR local m', toLocal(shR).round(4), 'Ltr', L / 1000)

def joint(a_names, b_names):
    # 兩塊骨頭最接近處的中點 ≈ 關節中心
    A, _ = load_parts(a_names); B, _ = load_parts(b_names)
    d = np.sqrt(((A[:, None, :] - B[None, :, :]) ** 2).sum(-1))
    da, db = d.min(1), d.min(0)
    return (A[da < da.min() + 4].mean(0) + B[db < db.min() + 4].mean(0)) / 2
def tip(names, from_pt):
    V, _ = load_parts(names); d = np.linalg.norm(V - from_pt, axis=1)
    return V[d > d.max() - 2].mean(0)
fo, fL, fR = FORE
loc = lambda p: (((np.asarray(p) - fo) @ fR.T) / fL).tolist()
vloc = lambda v: (np.asarray(v) @ fR.T).tolist()
rad_, _ = load_parts(['right radius']); uln, _ = load_parts(['right ulna'])
radHead = rad_[rad_[:, 2] > rad_[:, 2].max() - 8].mean(0)
ulnHead = uln[uln[:, 2] < uln[:, 2].min() + 12].mean(0)
W = joint(['right radius'], ['right scaphoid', 'right lunate'])
MCP = [joint([f'right {o} metacarpal bone'], [f'proximal phalanx of right {f}']) for o, f in zip(['second', 'third', 'fourth', 'fifth'], FING)]
t = MCP[3] - MCP[0]; t /= np.linalg.norm(t)
dist = np.mean(MCP, 0) - W
palmN = np.cross(t, dist); palmN /= np.linalg.norm(palmN)
if palmN @ ANT < 0: palmN = -palmN
PALM_D = 26.0  # 槓中心在掌骨頭掌側 26 mm（槓半徑 14 mm + 掌側軟組織）
digits = []
th = ['right first metacarpal bone', 'proximal phalanx of right thumb', 'distal phalanx of right thumb']
tj = [joint(['right trapezium'], th[:1]), joint(th[:1], th[1:2]), joint(th[1:2], th[2:3])]
digits.append(dict(segs=['t0', 't1', 't2'], joints=[loc(p) for p in tj], tip=loc(tip(th[2:], tj[2])), axis=None,
                   lim=[[-75, 35], [-60, 60], [-50, 80]]))
for i, f in enumerate(FING):
    ph = [f'{p} phalanx of right {f}' for p in ['proximal', 'middle', 'distal']]
    js = [MCP[i], joint(ph[:1], ph[1:2]), joint(ph[1:2], ph[2:3])]
    mcd = js[0] - W; mcd /= np.linalg.norm(mcd)
    ax = np.cross(mcd, palmN); ax /= np.linalg.norm(ax)
    digits.append(dict(segs=[f'f{i}0', f'f{i}1', f'f{i}2'], joints=[loc(p) for p in js], tip=loc(tip(ph[2:], js[2])),
                       axis=vloc(ax), lim=[[-60, 90], [-50, 105], [-40, 80]]))
handRig = dict(W=loc(W), G=loc(np.mean(MCP, 0) + palmN * PALM_D), t=vloc(t), palmN=vloc(palmN),
               pro=[loc(radHead), loc(ulnHead)], digits=digits)
print('W', np.round(loc(W), 3), 'G', np.round(handRig['G'], 3), 'palmN', np.round(handRig['palmN'], 3), 't', np.round(handRig['t'], 3))
pos_all, idx_all, meta = [], [], {}
po = io = 0
for name, (parts, (o, L, R), target) in groups.items():
    V, F = load_parts(parts)
    V, F = simplify(V, F, target)
    loc = ((V - o) @ R.T) / L
    meta[name] = dict(pos=po, nPos=len(loc), idx=io, nIdx=int(F.size), L=L / 1000)
    pos_all.append(loc.astype(np.float32).ravel()); idx_all.append(F.astype(np.uint32).ravel())
    po += loc.size; io += F.size
    print(name, len(V), len(F))
pos = np.concatenate(pos_all); idx = np.concatenate(idx_all)
meta['_'] = dict(posBytes=pos.nbytes, handRig=handRig, attribution='BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International', dims=dims)
with open('../public/bones.bin', 'wb') as f: f.write(pos.tobytes()); f.write(idx.tobytes())
json.dump(meta, open('../public/bones.json', 'w'), ensure_ascii=False, indent=1)
