# T29 肩部參數資料取得紀錄

本目錄保留固定版本的原始模型與來源紀錄。T29b 改以 DAS3 的模型參數作為肩部 F／Lf／Lt 的單一來源；原 T29 階段 0 的缺口仍保留紀錄。

| 資料 | 來源與下載網址 | SHA-256 | 授權／使用範圍 | 核對結果 |
|---|---|---|---|---|
| `das3.osim` | [DAS3 儲存庫](https://github.com/dasproject/DAS3/tree/d6f2ff0d49ada37bd6c3c1edbacc101ea8d9af92/model)，commit `d6f2ff0d49ada37bd6c3c1edbacc101ea8d9af92`；[原始檔](https://raw.githubusercontent.com/dasproject/DAS3/d6f2ff0d49ada37bd6c3c1edbacc101ea8d9af92/model/das3.osim) | `65371c112f5a2f77aeac51cea1042f33a6ceb11b81255fb8347e5041429e1a17` | 儲存庫 [Apache-2.0](https://github.com/dasproject/DAS3/blob/d6f2ff0d49ada37bd6c3c1edbacc101ea8d9af92/LICENSE)；授權文字存於 `DAS3-LICENSE`。 | `tools/das3_params.py` 解析 138 條 `Schutte1993Muscle_Deprecated` 元素的 F、Lf、Lt、羽狀角與路徑點；`tools/das3_chords.py` 提供簡化直線弦診斷。肩胛—胸廓接觸力在 C／Matlab 中，不在此檔，不作本任務輸入。 |
| `nikooyan-2011-supplement.doc` | [Nikooyan 等 2011 論文頁](https://link.springer.com/article/10.1007/s11517-011-0839-7)；[Springer 補充檔原址](https://static-content.springer.com/esm/art%3A10.1007%2Fs11517-011-0839-7/MediaObjects/11517_2011_839_MOESM1_ESM.doc) | `8a1e1c6b5f38ef488ff2ce7f85855116879036913cdc4ba7683c1e659e24e007` | 論文頁標示 CC BY-NC 2.0；補充檔沒有另列授權。保留原始檔並註明出處，商業重用授權未查證。 | 以 `antiword` 展開全文；表 A1/A2 只列**肘部**的肌肉起止點、PCSA、質量與最佳纖維長，沒有肩部肌束表。 |
| Klein Breteler 等 1999 | [TU Delft 紀錄](https://repository.tudelft.nl/record/uuid:3f4ffbf8-a381-4013-920f-9b0b3d4b89ef)；[出版社頁面](https://www.sciencedirect.com/science/article/pii/S0021929099001220)；DOI `10.1016/S0021-9290(99)00122-0` | 未取得檔案 | Elsevier 版權；未取得可再散布授權。 | TU Delft 紀錄傳回 403，出版社提供摘要與部分內文，但原表／完整肩部逐束 PCSA 未取得。出版社稱完整資料原置於 `http://www-mr.wbmt.tudelft.nl/shoulder/morph_data`；目前未取得該資料。 |
| Klein Breteler 1996 肩部解剖內部報告 | [TU Delft 舊站 Wayback 存檔](https://web.archive.org/web/20220308031056/http://homepage.tudelft.nl/g6u61/repository/shoulder/files_to_link/Klein_Breteler_1996.pdf) | `5bf991747d998f75de361e4ba10d7513be70dd2bf3e93aab352ff5863aefcd95` | 未查到授權；只在本機暫存核對，未放入儲存庫。 | 95 頁影像掃描，無可擷取文字；尚未完成逐格雙重校對，不能當作 1999 原表已取得。 |
| Ackland 等 2008 | [PubMed／PMC](https://pubmed.ncbi.nlm.nih.gov/18691376/)；[出版社 Table 1](https://onlinelibrary.wiley.com/doi/10.1111/j.1469-7580.2008.00965.x)；DOI `10.1111/j.1469-7580.2008.00965.x` | 未下載檔案 | 出版社／PMC 頁面未確認可再散布授權；不存複本。 | Table 1 有 18 個肩部子區域在肩胛平面、額狀面及前舉的極值力臂與角度，可做部分點位比較；完整曲線只在圖中。 |

**原 T29 關卡結論：** Ackland 的表格有可用數字，但 Nikooyan 補充檔僅提供肘部資料，Klein Breteler 1999 的肩部原表尚未取得。T29b 改用可讀、可重算的 DAS3 模型參數；這不是已核對原始大體表格的替代證明。DAS3 每條元素與原始 PCSA 逐條對應及 F 換算比張力仍**未查證**。
