import numpy as np, re, os
ROOT = os.environ.get('BP3D', '/tmp/bp3d')
OBJ = ROOT + '/partof_BP3D_4.0_obj_99'
EL = {}
for line in open(ROOT + '/partof_element_parts.txt', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) >= 3 and p[0].startswith('FMA'):
        EL.setdefault(p[1], set()).add(p[2])

def load(fj):
    vs, fs = [], []
    for line in open(f'{OBJ}/{fj}.obj'):
        if line.startswith('v '):
            vs.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('f '):
            fs.append([int(x.split('/')[0]) - 1 for x in line.split()[1:4]])
    return np.array(vs, dtype=np.float64), np.array(fs, dtype=np.int64)

def load_parts(names):
    ids = set()
    for n in names:
        if n not in EL: raise KeyError(n)
        ids |= EL[n]
    V, F, off = [], [], 0
    for fj in sorted(ids):
        v, f = load(fj)
        V.append(v); F.append(f + off); off += len(v)
    return np.concatenate(V), np.concatenate(F)
