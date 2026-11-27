// Murray 1995 大體量測圖讀點；由 tools/forearm_measured.py 與 tools/data/murray-1995-digitized.json 產生。
// 圖 4/6 為男性標本、圖 5 為女性標本；單位 m。外插與兩次讀點差見資料檔。
export const MEASURED_ELBOW_DEG = [20,40,60,80,100,120];
export const MEASURED_ROT_DEG = [-60,-40,-20,0,20,40];
export const MEASURED_ELBOW_NEUTRAL = {"brachialis":[0.012917,0.017222,0.021944,0.027083,0.031528,0.036111],"brachioradialis":[0.010972,0.026944,0.040417,0.049583,0.055139,0.055972],"pronatorTeres":[0.012361,0.015278,0.018194,0.02,0.023472,0.021528]};
export const MEASURED_BICEPS_ELBOW = {"supinated":[0.022074,0.035239,0.041622,0.042553,0.038963,0.025931],"neutral":[0.02008,0.028723,0.034508,0.037367,0.036104,0.030984],"pronated":[0.017952,0.023271,0.030585,0.036303,0.037035,0.031848]};
export const MEASURED_ROT_85 = {"biceps":[-0.011029,-0.01114,-0.010956,-0.010147,-0.008934,-0.007353],"pronatorTeres":[0.006103,0.007426,0.007794,0.007574,0.006765,0.005147],"brachioradialis":[0.002059,0.002096,0.001801,0.001324,0.000551,-7.4e-05]};
export const BICEPS_ROT_45_TO_85 = 0.663717;
