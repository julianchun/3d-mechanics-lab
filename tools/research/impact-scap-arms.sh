#!/usr/bin/env bash
# 在 /tmp 複本上試算：把 fit_scap_arms.py 的 TSM 肩帶力臂擬合代入 tools/diagnose-shoulder-issues.mjs 的敏感度流程，
# 不修改本儲存庫的 src/ 與診斷工具。用法：tools/research/impact-scap-arms.sh fits.json [--only=pullup] > out.json
set -euo pipefail
FIT=$(realpath "$1"); shift
SRC=$(cd "$(dirname "$0")/../.." && pwd)
SIM=${SIM_DIR:-/tmp/t44-sim}
rm -rf "$SIM"; mkdir -p "$SIM"
cp -r "$SRC/src" "$SRC/tools" "$SRC/package.json" "$SIM/"
ln -s "$SRC/node_modules" "$SIM/node_modules"
node - "$SIM/tools/diagnose-shoulder-issues.mjs" <<'JS'
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const anchor = "    add1('背闊／胸大肌肩胛力臂=幾何'";
if (!s.includes(anchor)) throw new Error('找不到插入點');
const inject = `
    {
      const fit = JSON.parse(readFileSync(process.env.TSM_FIT, 'utf8'));
      const MAP = { lat: 'lat', pecs: 'pecs', uptrap: 'uptrap', midtrap: 'midrhom', lowtrap: 'lowtrap', serr: 'serr' };
      const poly = (c, h) => fit.exps.reduce((sum, [i, j, k], n) => sum + c[n] * h[0] ** i * h[1] ** j * h[2] ** k, 0);
      const tsmFn = (ids) => (fr) => {
        const q = fr.sys.q, t = q.shElev, p = q.shPlane, h = [Math.sin(t) * Math.sin(p), -Math.cos(t), Math.sin(t) * Math.cos(p)];
        return Object.fromEntries(fr.sys.info.filter((x) => ids.includes(x.id) && MAP[x.id]).map((x) =>
          [x.id, { scElev: poly(fit.groups[MAP[x.id]].scElev.coef_m, h), scRet: poly(fit.groups[MAP[x.id]].scRet.coef_m, h) }]));
      };
      add1('TSM肩胛臂：背闊+胸大肌', { armOverrideFn: tsmFn(['lat', 'pecs']) });
      add1('TSM肩胛臂：僅背闊', { armOverrideFn: tsmFn(['lat']) });
      add1('TSM肩胛臂：全部肩帶肌', { armOverrideFn: tsmFn(['lat', 'pecs', 'uptrap', 'midtrap', 'lowtrap', 'serr']) });
    }
`;
s = s.replace(anchor, inject + anchor);
fs.writeFileSync(f, s);
JS
cd "$SIM"
TSM_FIT="$FIT" node tools/diagnose-shoulder-issues.mjs --json "$@"
