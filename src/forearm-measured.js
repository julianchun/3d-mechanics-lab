// Murray 1995 大體量測圖讀點；由 tools/forearm_measured.py 與 tools/data/murray-1995-digitized.json 產生。
// 圖 4/6 為男性標本、圖 5 為女性標本；單位 m。外插與兩次讀點差見資料檔。
export const MEASURED_ELBOW_DEG = [20,40,60,80,100,120];
export const MEASURED_ROT_DEG = [-60,-40,-20,0,20,40];
export const MEASURED_ELBOW_NEUTRAL = {"brachialis":[0.012917,0.017222,0.020417,0.023611,0.027361,0.030278],"brachioradialis":[0.011944,0.025,0.035972,0.045417,0.0525,0.055972],"pronatorTeres":[0.013194,0.015278,0.017778,0.019861,0.022361,0.025278]};
export const MEASURED_BICEPS_ELBOW = {"supinated":[0.020811,0.031117,0.039495,0.042553,0.03996,0.026529],"neutral":[0.020745,0.027593,0.034176,0.036636,0.036968,0.030053],"pronated":[0.017686,0.023005,0.029122,0.035572,0.036436,0.030652]};
export const MEASURED_ROT_85 = {"biceps":[-0.010772,-0.011103,-0.010993,-0.010515,-0.009007,-0.00739],"pronatorTeres":[0.006066,0.007941,0.009485,0.009412,0.008456,0.005551],"brachioradialis":[0.002059,0.002096,0.001838,0.001287,0.000625,-0.000147]};
export const BICEPS_ROT_45_TO_85 = 0.663717;
