"""由 ANSUR II 公開 CSV 推導髂嵴高度相對大轉子高度（髖中心代理）的身高比例。

用法：python3 tools/derive-lumbar-point.py male.csv female.csv
欄位：iliocristaleheight、trochanterionheight、stature（皆 mm）。
輸出平均與標準差；src/biomech.js 的 LUMBAR_POINTS.iliacCrest 取四捨五入到 4 位的平均。
不使用任何驗證研究的數值。
"""
import csv
import hashlib
import statistics
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit(__doc__)
for sex, filename in zip(('male', 'female'), sys.argv[1:]):
    raw = Path(filename).read_bytes()
    ratios, mm = [], []
    for row in csv.DictReader(raw.decode('latin1').splitlines()):
        try:
            d = float(row['iliocristaleheight']) - float(row['trochanterionheight'])
            stature = float(row['stature'])
        except (KeyError, ValueError):
            continue
        if stature < 1200 or d <= 0:
            continue
        ratios.append(d / stature)
        mm.append(d)
    print(f'{sex}: n={len(ratios)} sha256={hashlib.sha256(raw).hexdigest()[:16]} '
          f'比例平均={statistics.mean(ratios):.4f} SD={statistics.stdev(ratios):.4f} '
          f'差距 mm 平均={statistics.mean(mm):.1f} SD={statistics.stdev(mm):.1f}')
