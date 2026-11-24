# T17b 鞋跟條件對齊的單獨影響

本表只比較 `validation/gorsic-2020.json` 增加 `heelHeight=3` 前後；產品平底預設與 T17 的 63 項快照維持 `IDENTICAL`。條件已在提交 `72461a3` 獨立記錄，之後才重算。未更動任何容許範圍。單位依各筆原始驗證資料：角度為 °，正規化力矩為 Nm/(kg·m)，Hutchison 力矩為 Nm。

可比較指標 **9/16 → 10/16**；唯一狀態變化為 Goršič 背蹲軀幹角 `fail → pass`。Goršič 十筆模型值皆變，其他 21 筆完全不變。Goršič 背蹲髖、下背與前蹲髖、下背仍高於原文。

| 指標 | 原模型 | 鞋跟條件 | 差 | 狀態 |
|---|---:|---:|---:|---|
| `gorsic-2020/straight-back/trunk` | 53.7454 | 48.5632 | -5.1822 | fail → pass |
| `gorsic-2020/straight-back/lumbar` | 2.4791 | 2.2714 | -0.2077 | fail → fail |
| `gorsic-2020/straight-back/hip` | 1.4026 | 1.2873 | -0.1153 | fail → fail |
| `gorsic-2020/straight-back/knee` | 0.4884 | 0.6019 | +0.1135 | pass → pass |
| `gorsic-2020/straight-back/ankle` | 0.3434 | 0.3061 | -0.0373 | pass → pass |
| `gorsic-2020/straight-front/trunk` | 38.0364 | 33.0861 | -4.9503 | pass → pass |
| `gorsic-2020/straight-front/lumbar` | 2.4669 | 2.2665 | -0.2004 | fail → fail |
| `gorsic-2020/straight-front/hip` | 1.3580 | 1.2436 | -0.1144 | fail → fail |
| `gorsic-2020/straight-front/knee` | 0.5322 | 0.6447 | +0.1125 | pass → pass |
| `gorsic-2020/straight-front/ankle` | 0.3434 | 0.3061 | -0.0373 | pass → pass |
| `gullett-2009/back/peak-knee` | 1.4769 | 1.4769 | +0.0000 | pass → pass |
| `gullett-2009/front/peak-knee` | 1.4145 | 1.4145 | +0.0000 | fail → fail |
| `hutchison-2019/steel-back/peak-hip` | 379.0693 | 379.0693 | +0.0000 | exploratory → exploratory |
| `hutchison-2019/steel-back/peak-knee` | 123.9391 | 123.9391 | +0.0000 | exploratory → exploratory |
| `hutchison-2019/steel-back/peak-ankle` | 94.0900 | 94.0900 | +0.0000 | exploratory → exploratory |
| `larsen-2021/high-narrow/trunk` | 45.6002 | 45.6002 | +0.0000 | pass → pass |
| `larsen-2021/high-narrow/hip` | 140.5602 | 140.5602 | +0.0000 | definition-mismatch → definition-mismatch |
| `larsen-2021/high-narrow/knee` | 125.8757 | 125.8757 | +0.0000 | consistency-check → consistency-check |
| `larsen-2021/high-narrow/ankle` | 31.1200 | 31.1200 | +0.0000 | definition-mismatch → definition-mismatch |
| `larsen-2021/high-wide/trunk` | 34.6092 | 34.6092 | +0.0000 | fail → fail |
| `larsen-2021/high-wide/hip` | 129.5692 | 129.5692 | +0.0000 | definition-mismatch → definition-mismatch |
| `larsen-2021/high-wide/knee` | 121.5503 | 121.5503 | +0.0000 | consistency-check → consistency-check |
| `larsen-2021/high-wide/ankle` | 28.8046 | 28.8046 | +0.0000 | definition-mismatch → definition-mismatch |
| `larsen-2021/low-narrow/trunk` | 57.9069 | 57.9069 | +0.0000 | pass → pass |
| `larsen-2021/low-narrow/hip` | 152.8669 | 152.8669 | +0.0000 | definition-mismatch → definition-mismatch |
| `larsen-2021/low-narrow/knee` | 123.9522 | 123.9522 | +0.0000 | consistency-check → consistency-check |
| `larsen-2021/low-narrow/ankle` | 29.1777 | 29.1777 | +0.0000 | definition-mismatch → definition-mismatch |
| `larsen-2021/low-wide/trunk` | 45.1973 | 45.1973 | +0.0000 | pass → pass |
| `larsen-2021/low-wide/hip` | 140.1573 | 140.1573 | +0.0000 | definition-mismatch → definition-mismatch |
| `larsen-2021/low-wide/knee` | 119.7009 | 119.7009 | +0.0000 | consistency-check → consistency-check |
| `larsen-2021/low-wide/ankle` | 26.6784 | 26.6784 | +0.0000 | definition-mismatch → definition-mismatch |

[原文方法與表 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC8106690/)報鞋跟高 3 cm，未報前掌厚度或跟趾落差。產品參數定義為**相對前掌的高度差**；本次把原文的絕對高度當 3 cm 落差，屬有方向的幾何代理，可能高估腳掌傾斜，故不能宣稱鞋類條件精確一致。其他三篇未提供可換算的跟趾落差；Hutchison 僅知有鞋，Larsen 與 Gullett 的原文沒有報鞋類，維持平底模型預設並標出未知。

## T17c：鞋跟分配比例敏感度

自由深蹲與高腳杯深蹲將鞋跟造成的足板角按 `HEEL_SHANK_SHARE` 分給小腿前傾，其餘作為相對腳掌踝背屈的減少量；產品預設仍為 **0.5**。這是未經同條件實測的姿勢策略假設。下表用 `npm run test:heel-sweep` 重算：只改此比例，維持 Goršič 的 3 cm 代理鞋跟、研究值、槓重、姿勢條件和原容許範圍。

| 小腿前傾比例 | 背蹲軀幹 °（37.9±12） | 背蹲髖伸 Nm/(kg·m)（0.93±0.30） | 前蹲髖伸 Nm/(kg·m)（0.89±0.30） | 可比較通過 |
|---:|---:|---:|---:|---:|
| 0 | 52.09 失敗 | 1.367 失敗 | 1.322 失敗 | 9/16 |
| 0.25 | 50.29 失敗 | 1.327 失敗 | 1.283 失敗 | 9/16 |
| **0.5（預設）** | **48.56 通過** | **1.287 失敗** | **1.244 失敗** | **10/16** |
| 0.75 | 46.91 通過 | 1.248 失敗 | 1.205 失敗 | 10/16 |
| 1 | 45.31 通過 | 1.209 通過 | 1.167 通過 | 12/16 |

因此目前 **10/16 的摘要依賴 0.5 假設**：其中背蹲軀幹角一筆是「假設敏感的通過」，比例降至約 **0.3054** 以下會失敗。另兩筆會翻轉的是背蹲髖伸（約 ≥0.8660 通過）和前蹲髖伸（約 ≥0.8470 通過），在預設比例均失敗。邊界由 0.01 間距掃描後二分求得，判定使用驗證器四位小數模型值；`validation/results.json` 的 `assumptionSensitive.passRange` 留下可機讀範圍，`src/validation-status.json` 的 `assumptionSensitivePass` 記錄敏感通過筆數。背／前蹲腰背伸力矩在 0–1 的全部 0.01 掃描點均失敗；五個表列比例的模型範圍分別為 2.1312–2.4149、2.1314–2.4045 Nm/(kg·m)。

[Lu 等，2022，Bioengineering 9(7):301](https://doi.org/10.3390/bioengineering9070301)觀察到墊高時踝背屈角下降，男性受試者的膝力矩與做功增加。這只支持影響方向；0–1 是本模型「足板角如何分配」的假設範圍，研究沒有量得此係數，更不支持固定 **0.5**。Goršič 的鞋跟絕對高度與模型跟趾落差仍未精確對齊，不能把較高通過數當成校準目標。
