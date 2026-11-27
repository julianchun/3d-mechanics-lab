"""從 Murray 1995 兩次圖讀點重建前臂力臂：python3 tools/forearm_measured.py [--check]。"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools/data/murray-1995-digitized.json'
OUTPUT = ROOT / 'src/forearm-measured.js'

def render():
    data = json.loads(SOURCE.read_text())
    graphs = data['graphs']
    def arm(name, label):
        graph = graphs[name]
        axis = graph['axis']
        cm_px = (axis['y0px'] - axis['y2cmPx']) / 2 if 'y2cmPx' in axis else (axis['y0px'] - axis['y5cmPx']) / 5 if 'y5cmPx' in axis else axis['y0px'] - axis['y1cmPx']
        rows = {}
        for muscle, readings in graph['series'].items():
            a, b = readings['firstYPx'], readings['secondYPx']
            if len(a) != len(graph['anglesDeg']) or len(a) != len(b):
                raise ValueError(f'{name}/{muscle}: 讀點數與角度不符')
            rows[muscle] = [round((axis['y0px'] - (x + y) / 2) / cm_px / 100, 6) for x, y in zip(a, b)]
        return f'export const {label} = ' + json.dumps(rows, separators=(',', ':')) + ';\n'
    table = data['table3_biceps_peak_supination_cm']
    ratio = round(table['female45'] / table['female85'], 6)
    return ('// Murray 1995 大體量測圖讀點；由 tools/forearm_measured.py 與 tools/data/murray-1995-digitized.json 產生。\n'
            '// 圖 4/6 為男性標本、圖 5 為女性標本；單位 m。外插與兩次讀點差見資料檔。\n'
            'export const MEASURED_ELBOW_DEG = [20,40,60,80,100,120];\n'
            'export const MEASURED_ROT_DEG = [-60,-40,-20,0,20,40];\n'
            + arm('fig4_male_elbow_neutral', 'MEASURED_ELBOW_NEUTRAL')
            + arm('fig6_male_biceps_elbow', 'MEASURED_BICEPS_ELBOW')
            + arm('fig5_female_forearm_85', 'MEASURED_ROT_85')
            + f'export const BICEPS_ROT_45_TO_85 = {ratio};\n')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    expected = render()
    if args.check:
        if OUTPUT.read_text() != expected:
            raise SystemExit('src/forearm-measured.js 與圖讀點資料不一致')
        print('Murray 1995 力臂表一致')
    else:
        OUTPUT.write_text(expected)
        print(OUTPUT)
