// 全行程曲線：把整個動作（頂點 → 最低點）每個位置的關節力矩需求或肌肉受力畫成折線，標出目前位置
// 顏色跟著關節／肌肉走（固定對應，不依排名），≤ 4 條線時線尾直接標名稱，另有圖例與數值表

const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const JOINT_ORDER = ['hip', 'knee', 'ankle', 'lumbar', 'shoulder', 'elbow', 'scap'];
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

// 肌肉顏色：依解剖順序（MUSCLES 的順序，不是受力排名）依序取前 4 個色槽（已驗證相鄰可分辨）
function muscleColors(ids, order) {
  const out = {};
  [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)).forEach((id, i) => { out[id] = PALETTE[i]; });
  return out;
}

const cache = new Map();
// 取樣整個動作；回傳 { xs, joints: {k: [..]}, mus: {id: [..]} }
export function sampleCurve(key, lift, params, analyze, n = 24) {
  if (cache.has(key)) return cache.get(key);
  const xs = [], joints = {}, mus = {};
  for (let i = 0; i <= n; i++) {
    const e = i / n, r = analyze(lift, params, e);
    xs.push(e);
    for (const [k, v] of Object.entries(r.joints)) (joints[k] ||= []).push(v);
    for (const [k, v] of Object.entries(r.mus)) (mus[k] ||= []).push(v.s);
  }
  const out = { xs, joints, mus };
  if (cache.size > 40) cache.clear();
  cache.set(key, out);
  return out;
}

// series: [{ id, name, color, ys }]，ys 已正規化到 0～1
function lineChart({ series, topLabel, bottomLabel, yLabel }) {
  const W = 340, H = 168, L = 34, R = series.length <= 4 ? 78 : 10, T = 10, B = 28;
  const pw = W - L - R, ph = H - T - B;
  const n = series[0]?.ys.length || 2;
  const X = (i) => L + (i / (n - 1)) * pw, Y = (v) => T + (1 - Math.min(1.05, v)) * ph;
  const wrap = document.createElement('div');
  wrap.className = 'curve';
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': yLabel + '在整個動作中的變化' });
  // 格線與軸（淡）
  for (const v of [0, 0.5, 1]) {
    s.append(svg('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), class: v === 0 ? 'axis' : 'grid' }));
    const t = svg('text', { x: L - 6, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }); t.textContent = Math.round(v * 100) + '%'; s.append(t);
  }
  const tl = svg('text', { x: L, y: H - 8, class: 'tick' }); tl.textContent = topLabel; s.append(tl);
  const bl = svg('text', { x: L + pw, y: H - 8, class: 'tick', 'text-anchor': 'end' }); bl.textContent = bottomLabel; s.append(bl);
  // 折線
  for (const se of series) {
    const d = se.ys.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    s.append(svg('path', { d, fill: 'none', stroke: se.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  }
  // 線尾直接標名稱（≤ 4 條），避免重疊
  if (series.length <= 4) {
    const ends = series.map((se) => ({ se, y: Y(se.ys[n - 1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 12);
    for (const { se, y } of ends) {
      const t = svg('text', { x: L + pw + 6, y: y + 4, class: 'dl' }); t.textContent = se.name; s.append(t);
    }
  }
  // 目前位置：垂直線＋各線上的點（外圈留白）
  const cur = svg('g');
  const curLine = svg('line', { y1: T, y2: T + ph, class: 'cur' });
  cur.append(curLine);
  const dots = series.map((se) => { const c = svg('circle', { r: 4.5, fill: se.color, stroke: '#fff', 'stroke-width': 2 }); cur.append(c); return c; });
  s.append(cur);
  // 滑鼠移入：十字準線＋提示
  const hov = svg('line', { y1: T, y2: T + ph, class: 'hov', visibility: 'hidden' });
  s.append(hov);
  const hit = svg('rect', { x: L, y: 0, width: pw, height: H, fill: 'transparent' });
  s.append(hit);
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true;
  const at = (i) => series.map((se) => [se, se.ys[i]]).sort((a, b) => b[1] - a[1]);
  hit.addEventListener('pointermove', (ev) => {
    const r = s.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((x - L) / pw) * (n - 1))));
    hov.setAttribute('x1', X(i)); hov.setAttribute('x2', X(i)); hov.setAttribute('visibility', 'visible');
    tip.innerHTML = '';
    const hd = document.createElement('div'); hd.className = 'th';
    hd.textContent = i === 0 ? topLabel : i === n - 1 ? bottomLabel : `行程 ${Math.round((i / (n - 1)) * 100)}%`;
    tip.append(hd);
    for (const [se, v] of at(i)) {
      const row = document.createElement('div');
      const sw = document.createElement('i'); sw.style.background = se.color;
      const nm = document.createElement('span'); nm.textContent = se.name;
      const vv = document.createElement('b'); vv.textContent = Math.round(v * 100) + '%';
      row.append(sw, nm, vv); tip.append(row);
    }
    tip.hidden = false;
    const px = (X(i) / W) * r.width;
    tip.style.left = Math.min(px + 10, r.width - 150) + 'px';
  });
  hit.addEventListener('pointerleave', () => { hov.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  wrap.append(s, tip);
  // 圖例（永遠顯示）
  const lg = document.createElement('div'); lg.className = 'clegend';
  for (const se of series) {
    const it = document.createElement('span');
    const sw = document.createElement('i'); sw.style.background = se.color;
    it.append(sw, se.name); lg.append(it);
  }
  wrap.append(lg);
  // 數值表（每 25%）
  const det = document.createElement('details'); det.className = 'ctable';
  const sm = document.createElement('summary'); sm.textContent = '數值表'; det.append(sm);
  const tb = document.createElement('table');
  const cols = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (n - 1)));
  const hr = document.createElement('tr'); hr.append(document.createElement('th'));
  for (const i of cols) { const th = document.createElement('th'); th.textContent = i === 0 ? topLabel : i === n - 1 ? bottomLabel : Math.round((i / (n - 1)) * 100) + '%'; hr.append(th); }
  tb.append(hr);
  for (const se of series) {
    const tr = document.createElement('tr'); const th = document.createElement('th'); th.textContent = se.name; tr.append(th);
    for (const i of cols) { const td = document.createElement('td'); td.textContent = Math.round(se.ys[i] * 100) + '%'; tr.append(td); }
    tb.append(tr);
  }
  det.append(tb); wrap.append(det);
  return {
    el: wrap,
    setE(e) {
      const fx = e * (n - 1), i0 = Math.floor(fx), i1 = Math.min(n - 1, i0 + 1), f = fx - i0;
      const x = L + e * pw;
      curLine.setAttribute('x1', x); curLine.setAttribute('x2', x);
      series.forEach((se, k) => { dots[k].setAttribute('cx', x); dots[k].setAttribute('cy', Y(se.ys[i0] * (1 - f) + se.ys[i1] * f)); });
    },
  };
}

// mode: 'joints' | 'muscles'
export function buildCurve({ mode, data, lift, L, jointNames, muscleName, muscleOrder, liftSet }) {
  const topLabel = L.topLabel || '頂點', bottomLabel = L.bottomLabel;
  let series;
  if (mode === 'joints') {
    const ks = JOINT_ORDER.filter((k) => data.joints[k]);
    const m = Math.max(1e-6, ...ks.flatMap((k) => data.joints[k]));
    // 太小（峰值 < 8%）的關節不畫，避免一堆貼著 0 的線
    series = ks.filter((k) => Math.max(...data.joints[k]) / m >= 0.08)
      .map((k) => ({ id: k, name: jointNames[k], color: PALETTE[JOINT_ORDER.indexOf(k)], ys: data.joints[k].map((v) => v / m) }));
  } else {
    const ids = Object.keys(data.mus).filter((id) => !liftSet || liftSet.has(id));
    const peak = (id) => Math.max(...data.mus[id]);
    const top = ids.sort((a, b) => peak(b) - peak(a)).slice(0, 4);
    const m = Math.max(1e-6, ...top.map(peak));
    const col = muscleColors(top, muscleOrder);
    series = top.map((id) => ({ id, name: muscleName(id), color: col[id], ys: data.mus[id].map((v) => v / m) }));
  }
  return lineChart({ series, topLabel, bottomLabel, yLabel: mode === 'joints' ? '關節力矩需求' : '肌肉受力' });
}
