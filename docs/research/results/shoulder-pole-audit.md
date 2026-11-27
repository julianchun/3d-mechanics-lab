# 肩部正交平衡：63 項全程稽核

舊版為診斷提交 `3fc54ce`（與修正前 main 的力學相同）；新版為本次正交基底求解。重現單一版本：`node tools/audit-shoulder-pole.mjs`。每項掃描 `e=0, 0.025, …, 1` 共 41 點。排名採一般視圖肌群 `s` 的全程峰值；超載點是任一肌群或單條肌肉主動活化 `a>1` 的行程點，每點只算一次。完整子部位峰值由稽核工具的 `aPeaks` 輸出。

一般肌群超載點合計 **264 → 264**，單條肌肉超載點 **277 → 277**；63 項中只有反手引體的前四名次序變動，其餘排名與超載點數不變。原 `joint-moments.json` 的所有肩部廣義力矩保持原語意與四位小數值。

| 清單項目 | 舊前四名 | 新前四名 | 肌群 a>1 點（舊→新） | 單條 a>1 點（舊→新） |
| --- | --- | --- | ---: | ---: |
| squat-high | gmax, erec, vasti, hams | gmax, erec, vasti, hams | 0→0 | 0→0 |
| squat-low | gmax, erec, vasti, hams | gmax, erec, vasti, hams | 0→0 | 0→0 |
| front-squat | erec, gmax, vasti, hams | erec, gmax, vasti, hams | 0→0 | 0→0 |
| goblet-squat | gmax, erec, vasti, hams | gmax, erec, vasti, hams | 0→0 | 0→0 |
| smith-squat | vasti, gmax, erec, ra | vasti, gmax, erec, ra | 0→0 | 0→0 |
| leg-press | vasti, gmax, hams, gmed | vasti, gmax, hams, gmed | 0→0 | 0→0 |
| hack-squat | vasti, erec, gmax, rf | vasti, erec, gmax, rf | 0→0 | 0→0 |
| deadlift | lat, erec, gmax, hams | lat, erec, gmax, hams | 5→5 | 5→5 |
| deficit-dl | lat, erec, gmax, hams | lat, erec, gmax, hams | 8→8 | 8→8 |
| block-pull | erec, lat, gmax, hams | erec, lat, gmax, hams | 0→0 | 0→0 |
| sumo | lat, erec, gmax, vasti | lat, erec, gmax, vasti | 0→0 | 0→0 |
| rdl | erec, gmax, hams, lat | erec, gmax, hams, lat | 0→0 | 0→0 |
| good-morning | erec, hams, gmax, addmag | erec, hams, gmax, addmag | 0→0 | 0→0 |
| hip-thrust | gmax, erec, hams, gmed | gmax, erec, hams, gmed | 0→0 | 0→0 |
| back-extension | erec, gmax, hams, ra | erec, gmax, hams, ra | 0→0 | 0→0 |
| glute-bridge | gmax, erec, gmed, vasti | gmax, erec, gmed, vasti | 0→0 | 0→0 |
| bench | pecs, adelt, trilat, brach | pecs, adelt, trilat, brach | 0→0 | 0→0 |
| incline-bench | adelt, mdelt, pecs, trilat | adelt, mdelt, pecs, trilat | 0→0 | 0→0 |
| cg-bench | trilat, pecs, adelt, trilong | trilat, pecs, adelt, trilong | 0→0 | 0→0 |
| floor-press | pecs, adelt, trilat, pecc | pecs, adelt, trilat, pecc | 0→0 | 0→0 |
| db-bench | pecs, adelt, mdelt, trilat | pecs, adelt, mdelt, trilat | 0→0 | 0→0 |
| db-bench-incline | mdelt, adelt, pecs, trilat | mdelt, adelt, pecs, trilat | 0→0 | 0→0 |
| pushup | trilat, pecs, adelt, mdelt | trilat, pecs, adelt, mdelt | 0→0 | 0→0 |
| pushup-feet | trilat, pecs, adelt, mdelt | trilat, pecs, adelt, mdelt | 0→0 | 0→0 |
| pushup-hands | trilat, pecs, adelt, lat | trilat, pecs, adelt, lat | 0→0 | 0→0 |
| chest-press | pecs, trilat, adelt, pecc | pecs, trilat, adelt, pecc | 0→0 | 0→0 |
| pec-deck | pecs, brach, bic, adelt | pecs, brach, bic, adelt | 0→0 | 0→0 |
| reverse-deck | pdelt, mdelt, infra, lat | pdelt, mdelt, infra, lat | 40→40 | 40→40 |
| machine-press | adelt, mdelt, infra, uptrap | adelt, mdelt, infra, uptrap | 0→0 | 0→0 |
| cable-fly-high | pecs, brach, infra, bic | pecs, brach, infra, bic | 0→0 | 0→0 |
| cable-fly-mid | brach, pecs, infra, bic | brach, pecs, infra, bic | 0→0 | 0→0 |
| cable-fly-low | brach, bic, pecs, adelt | brach, bic, pecs, adelt | 0→0 | 0→0 |
| ohp | adelt, trilat, uptrap, mdelt | adelt, trilat, uptrap, mdelt | 0→0 | 0→0 |
| db-press | mdelt, uptrap, adelt, tmaj | mdelt, uptrap, adelt, tmaj | 0→0 | 0→0 |
| dips | pecs, lat, tmaj, corb | pecs, lat, tmaj, corb | 41→41 | 41→41 |
| dips-upright | pecs, lat, tmaj, corb | pecs, lat, tmaj, corb | 41→41 | 41→41 |
| row | erec, mdelt, midtrap, uptrap | erec, mdelt, midtrap, uptrap | 0→0 | 0→0 |
| row-sup | erec, mdelt, midtrap, uptrap | erec, mdelt, midtrap, uptrap | 0→0 | 0→0 |
| cable-row | erec, brach, lat, midtrap | erec, brach, lat, midtrap | 0→0 | 0→0 |
| cable-row-wide | midtrap, erec, mdelt, uptrap | midtrap, erec, mdelt, uptrap | 0→0 | 0→0 |
| db-reverse-fly | pdelt, mdelt, midtrap, trilat | pdelt, mdelt, midtrap, trilat | 6→6 | 6→6 |
| uprow | infra, uptrap, brach, mdelt | infra, uptrap, brach, mdelt | 0→0 | 0→0 |
| pulldown | lat, pecs, ra, infra | lat, pecs, ra, infra | 0→0 | 0→0 |
| pulldown-sup | lat, infra, mdelt, ra | lat, infra, mdelt, ra | 0→0 | 0→0 |
| pullup | lat, pdelt, mdelt, pecs | lat, pdelt, mdelt, pecs | 41→41 | 41→41 |
| pullup-wide | lat, pdelt, pecs, mdelt | lat, pdelt, pecs, mdelt | 41→41 | 41→41 |
| chinup | mdelt, brach, lat, adelt | mdelt, lat, brach, adelt | 41→41 | 41→41 |
| assist-pullup | lat, brach, mdelt, pecs | lat, brach, mdelt, pecs | 0→0 | 0→0 |
| assist-chinup | brach, lat, adelt, mdelt | brach, lat, adelt, mdelt | 0→0 | 8→8 |
| leg-ext | vasti, rf, gas, hams | vasti, rf, gas, hams | 0→0 | 0→0 |
| calf-raise-standing | sol, gas, ta | sol, gas, ta | 0→0 | 0→0 |
| calf-raise-seated | sol, gas, ta | sol, gas, ta | 0→0 | 0→0 |
| hip-abduction | gmed, addmag, gmax, addl | gmed, addmag, gmax, addl | 0→0 | 0→0 |
| hip-adduction | addmag, addl, gmax, gmed | addmag, addl, gmax, gmed | 0→0 | 0→0 |
| leg-curl | hams, gas, vasti, rf | hams, gas, vasti, rf | 0→0 | 0→0 |
| lying-leg-curl | hams, gas, vasti, rf | hams, gas, vasti, rf | 0→0 | 0→0 |
| pushdown | trilat, lat, trilong, infra | trilat, lat, trilong, infra | 0→0 | 0→0 |
| curl | adelt, bic, brach, uptrap | adelt, bic, brach, uptrap | 0→0 | 0→0 |
| reverse-curl | adelt, bic, brach, uptrap | adelt, bic, brach, uptrap | 0→0 | 0→0 |
| lat-raise | mdelt, uptrap, adelt, infra | mdelt, uptrap, adelt, infra | 0→0 | 0→0 |
| db-curl | adelt, brach, infra, bic | adelt, brach, infra, bic | 0→0 | 5→5 |
| hammer-curl | adelt, brach, bic, infra | adelt, brach, bic, infra | 0→0 | 0→0 |
| shrug | uptrap, adelt, infra, erec | uptrap, adelt, infra, erec | 0→0 | 0→0 |

## 重點數值

| 動作 | 肌肉或指標 | 舊 → 新 |
| --- | --- | ---: |
| pullup | pdelt 峰值 a | 2.2773 → 2.2853 |
| pullup-wide | pdelt 峰值 a | 1.4728 → 1.4737 |
| chinup | pdelt 峰值 a | 0.9845 → 1.0127 |
| chinup | mdelt 峰值 a | 1.4053 → 1.4282 |
| chinup | lat 峰值 a | 1.2975 → 1.3020 |
| ohp | adelt 峰值 a | 0.6225 → 0.6254 |
| db-press | mdelt 峰值 a | 0.4622 → 0.4622 |
| lat-raise | mdelt 峰值 a | 0.6433 → 0.6433 |
| pulldown | lat 峰值 a | 0.9627 → 0.9627 |
| pulldown-sup | lat 峰值 a | 0.7276 → 0.7276 |
| incline-bench | mdelt 峰值 a | 0.6446 → 0.6446 |
| db-bench-incline | mdelt 峰值 a | 0.7429 → 0.7429 |

5 點回歸快照共 315 幀：`shElev<90°` 的單條肌肉最大 `|Δa|=0.000062`（俯身啞鈴反向飛鳥頂點後三角肌）；`shElev≥90°` 最大 `|Δa|=0.028214`（反手引體底點後三角肌）。全部 2040 筆關節需求的四位小數快照逐項相同；新原始值對舊四位小數值的最大圓整偏差約 `0.00005 N·m`。

正握引體底點的後三角肌峰值未下降（2.2773→2.2853）；正交平衡證明其超載主要與現有水平內收需求及力臂／有效能力有關，不能再以「投影只剩 1 mm」作為唯一解釋。反手引體前兩群由中三角、肱肌變成中三角、背闊肌，原排名規則通過；其後三角肌峰值反而由 0.9845 升至 1.0127，已列入已知超載。

未列 `shRot` 的動作仍有三維長軸力矩，`shoulderLongReaction` 是固定軸旋所需的剩餘偶矩；正握、寬握、反手引體底點分別約 −26.55、−26.66、−33.76 N·m。這不參與肩肌活化最佳化，亦未有被動組織或握把偶矩資料驗證。列 `shRot` 的肩推／下拉等姿勢此值接近 0，已由肌肉平衡。
