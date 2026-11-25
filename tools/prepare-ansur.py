"""從 ANSUR II 公開 CSV 擷取同一受試者的節段代理比例。

用法：python3 tools/prepare-ansur.py male.csv female.csv
欄位為外觀標記，不是模型關節中心；轉換與校正見 docs/research/methods.md。
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

KEYS = ('Ls', 'Lt', 'Ltr', 'Lu', 'Lf', 'hipHalf', 'shHalf', 'ankleH')


def read_rows(filename):
    raw = Path(filename).read_bytes()
    rows = []
    for row in csv.DictReader(raw.decode('latin1').splitlines()):
        try:
            n = lambda key: float(row[key])
            stature = n('stature')
            values = (
                n('lateralfemoralepicondyleheight') - n('lateralmalleolusheight'),
                n('trochanterionheight') - n('lateralfemoralepicondyleheight'),
                n('acromialheight') - n('trochanterionheight'),
                n('acromionradialelength'),
                n('forearmhandlength') - 0.5 * n('handlength'),
                n('bicristalbreadth') / 2,
                n('biacromialbreadth') / 2,
                n('lateralmalleolusheight'),
            )
            if stature < 1200 or any(v <= 0 for v in values):
                continue
            rows.append([round(v / stature, 6) for v in values])
        except (KeyError, ValueError):
            continue
    return rows, hashlib.sha256(raw).hexdigest()


if len(sys.argv) != 3:
    raise SystemExit(__doc__)
male, male_hash = read_rows(sys.argv[1])
female, female_hash = read_rows(sys.argv[2])
if len(male) != 4082 or len(female) != 1986:
    raise SystemExit(f'受試者數不符：男性 {len(male)}、女性 {len(female)}')
out = {'source': 'ANSUR II 2012 public CSV', 'keys': KEYS,
       'sha256': {'male': male_hash, 'female': female_hash},
       'male': male, 'female': female}
dest = Path(__file__).resolve().parents[1] / 'validation/anthropometry/ansur-ii-ratios.json'
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, separators=(',', ':')) + '\n')
print(f'{dest}: 男性 {len(male)}、女性 {len(female)}；{dest.stat().st_size} bytes')
