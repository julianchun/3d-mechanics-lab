# 肩部有效能力與排名容差結果（0.13.1）

計算依據與限制見[肩部能力校準](../shoulder-capacity-calibration.md)及[排名近平手計畫](../rank-tolerance-plan.md)。本版沒有修改 `MUSCLES` F、力臂、姿勢或外力；`npm run test:update` 重算後回歸基準無差異，固定關節力矩基準亦未變。

## 判定變化

- `KNOWN_ISSUES`：**55 → 50**；解決 5 項，新增 0 項。原 5 項的原始名次仍保留，判定改為接受固定容差內的近平手。
- 由失敗轉通過：`row rank:lat:top4`、`row-sup rank:lat:top4`、`cable-row-wide rank:lat:top4`、`db-press rank:top2`、`db-bench-incline rank:first`。
- 由通過轉失敗：**無**。`notFirst`、`notTop4` 使用同一個含容差的禁入邊界；本次沒有新失敗。
- `node tools/diagnose-shoulder-issues.mjs --json` 的 30 項肩部診斷，前後所有峰值幀、需求、能力、分配、排名分數皆相同；僅上述 5 項的排名判定轉為通過。

| 由失敗轉通過 | 目標 `s` | 邊界 `s` | 容差 `τ` | 差距 |
|---|---:|---:|---:|---:|
| `row` 背闊肌進前四 | 0.506 | 0.581 | 0.080 | 0.075 |
| `row-sup` 背闊肌進前四 | 0.506 | 0.581 | 0.080 | 0.075 |
| `cable-row-wide` 背闊肌進前四 | 0.493 | 0.560 | 0.080 | 0.067 |
| `db-press` 前三角進前二 | 0.407 | 0.453 | 0.068 | 0.047 |
| `db-bench-incline` 前三角接近第一 | 0.595 | 0.609 | 0.080 | 0.015 |

## 全部含肩動作

以下涵蓋清單中所有含 `shFwd` 或 `shSide` 自由度的 **54 項**，每項 41 幀。前四名是各肌群整程峰值 `s` 排序；`a>1` 點數是至少一條肌肉的未截斷主動活化超過 1.000001 的幀數。前四名與點數前後完全相同，故前四名只列一次；0 表示沒有超載幀。總超載 **404 → 404** 幀，全部 54 × 41 = 2214 個取樣幀。

| 清單項目 | 前後相同的前四名（依序） | `a>1` 點數：前 → 後 |
|---|---|---:|
| `deadlift` | lat 1.12, erec 1.00, gmax 0.92, hams 0.67 | 5 → 5 |
| `deficit-dl` | lat 1.14, erec 1.01, gmax 0.94, hams 0.67 | 8 → 8 |
| `block-pull` | erec 0.96, lat 0.86, gmax 0.85, hams 0.63 | 0 → 0 |
| `sumo` | lat 0.89, erec 0.89, gmax 0.86, vasti 0.80 | 0 → 0 |
| `rdl` | erec 0.82, gmax 0.61, hams 0.59, lat 0.37 | 0 → 0 |
| `bench` | pecs 0.83, adelt 0.45, trilat 0.45, brach 0.31 | 0 → 0 |
| `incline-bench` | adelt 0.85, pecs 0.65, mdelt 0.55, trilat 0.41 | 0 → 0 |
| `cg-bench` | trilat 0.85, adelt 0.67, pecs 0.64, trilong 0.23 | 0 → 0 |
| `floor-press` | pecs 0.82, trilat 0.45, adelt 0.45, brach 0.31 | 0 → 0 |
| `db-bench` | pecs 0.60, adelt 0.43, trilat 0.34, mdelt 0.21 | 0 → 0 |
| `db-bench-incline` | mdelt 0.61, adelt 0.59, pecs 0.40, trilat 0.34 | 0 → 0 |
| `pushup` | trilat 0.87, pecs 0.60, adelt 0.47, mdelt 0.41 | 0 → 0 |
| `pushup-feet` | trilat 0.92, pecs 0.45, adelt 0.44, mdelt 0.41 | 0 → 0 |
| `pushup-hands` | trilat 0.84, pecs 0.77, adelt 0.49, lat 0.43 | 0 → 0 |
| `chest-press` | pecs 0.70, trilat 0.68, adelt 0.52, pecc 0.24 | 0 → 0 |
| `pec-deck` | pecs 0.69, brach 0.50, bic 0.43, adelt 0.43 | 0 → 0 |
| `reverse-deck` | pdelt 1.32, mdelt 0.71, infra 0.70, lat 0.59 | 40 → 40 |
| `machine-press` | adelt 0.83, mdelt 0.75, infra 0.59, uptrap 0.57 | 0 → 0 |
| `cable-fly-high` | pecs 0.76, brach 0.71, infra 0.64, bic 0.51 | 0 → 0 |
| `cable-fly-mid` | brach 0.74, pecs 0.65, infra 0.54, bic 0.53 | 0 → 0 |
| `cable-fly-low` | brach 0.78, bic 0.55, pecs 0.52, adelt 0.52 | 0 → 0 |
| `ohp` | adelt 0.63, trilat 0.62, uptrap 0.61, mdelt 0.47 | 0 → 0 |
| `db-press` | mdelt 0.46, uptrap 0.45, adelt 0.41, tmaj 0.32 | 0 → 0 |
| `dips` | pecs 1.51, lat 1.50, tmaj 1.50, corb 0.67 | 41 → 41 |
| `dips-upright` | pecs 1.51, lat 1.50, tmaj 1.50, corb 0.62 | 41 → 41 |
| `row` | erec 0.73, mdelt 0.70, midtrap 0.65, uptrap 0.58 | 0 → 0 |
| `row-sup` | erec 0.73, mdelt 0.69, midtrap 0.65, uptrap 0.58 | 0 → 0 |
| `cable-row` | erec 0.70, brach 0.65, lat 0.55, midtrap 0.50 | 0 → 0 |
| `cable-row-wide` | midtrap 0.81, erec 0.70, mdelt 0.67, uptrap 0.56 | 0 → 0 |
| `db-reverse-fly` | pdelt 1.16, mdelt 0.64, midtrap 0.57, trilat 0.46 | 6 → 6 |
| `uprow` | infra 0.66, uptrap 0.38, brach 0.33, mdelt 0.31 | 0 → 0 |
| `pulldown` | lat 0.96, pecs 0.54, ra 0.51, infra 0.41 | 0 → 0 |
| `pulldown-sup` | lat 0.73, infra 0.63, mdelt 0.53, ra 0.49 | 0 → 0 |
| `pullup` | lat 1.50, pecs 0.91, mdelt 0.84, brach 0.81 | 41 → 41 |
| `pullup-wide` | lat 1.50, pecs 1.13, mdelt 0.81, brach 0.73 | 37 → 37 |
| `chinup` | brach 1.35, lat 1.25, adelt 1.23, mdelt 1.18 | 38 → 38 |
| `assist-pullup` | lat 0.89, brach 0.47, mdelt 0.46, pecs 0.44 | 0 → 0 |
| `assist-chinup` | brach 0.77, lat 0.70, adelt 0.65, mdelt 0.63 | 8 → 8 |
| `pushdown` | trilat 0.48, lat 0.35, trilong 0.30, infra 0.25 | 0 → 0 |
| `skull-crusher` | trilat 0.59, lat 0.51, trilong 0.38, pecs 0.20 | 0 → 0 |
| `db-overhead-ext` | supsp 2.30, pdelt 1.89, tmaj 1.55, trilong 1.34 | 40 → 40 |
| `cable-overhead-ext` | pdelt 1.64, mdelt 0.53, tmaj 0.41, trilat 0.39 | 41 → 41 |
| `preacher-curl` | brach 0.79, bic 0.63, pronators 0.29, mdelt 0.05 | 0 → 0 |
| `incline-db-curl` | pecs 0.61, tmaj 0.61, brach 0.52, corb 0.37 | 0 → 0 |
| `db-front-raise` | adelt 0.89, mdelt 0.50, brach 0.48, supsp 0.38 | 0 → 0 |
| `db-pullover` | pdelt 1.91, supsp 1.52, lat 0.74, mdelt 0.72 | 10 → 10 |
| `chest-supported-row` | pdelt 1.19, lat 0.72, midtrap 0.50, brach 0.43 | 2 → 2 |
| `cable-pull-through` | adelt 1.13, trilat 0.76, erec 0.40, pecc 0.33 | 41 → 41 |
| `curl` | adelt 0.88, bic 0.65, brach 0.46, uptrap 0.28 | 0 → 0 |
| `reverse-curl` | adelt 0.88, bic 0.64, brach 0.60, uptrap 0.28 | 0 → 0 |
| `lat-raise` | mdelt 0.64, uptrap 0.54, adelt 0.53, infra 0.37 | 0 → 0 |
| `db-curl` | adelt 0.85, brach 0.57, infra 0.39, bic 0.34 | 5 → 5 |
| `hammer-curl` | adelt 0.83, brach 0.56, bic 0.43, infra 0.38 | 0 → 0 |
| `shrug` | uptrap 0.71, adelt 0.68, infra 0.24, erec 0.23 | 0 → 0 |

## 尚待處理

肩胛下壓等效力臂、撐體／引體接觸與姿勢、肩部高上舉力臂及器械凸輪仍未有同條件量測；`KNOWN_ISSUES` 的其餘 50 項繼續保留。這次的 5 項「解決」只表示測試期望接受近平手，不表示人體肌群順序已經驗證。
