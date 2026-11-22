import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  LIFTS, JOINT_NAMES, MODEL_VERSION, MUSCLES, MUSCLE_BY_ID, MACHINES, pulleyDivisor,
  defaultParams, analyze, peakAnalysis, validate, liftMuscles,
} from './biomech.js';
import { Rig, heatColor, diffColor, lengthColor, loadBones } from './rig.js';
import { CATALOG, CATEGORIES, EQUIPMENT, MUSCLE_SHORT, matchEntry } from './catalog.js';
import { sampleCurve, buildCurve } from './curve.js';
import { getSourceInfo } from './sources.js';

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined) e.append(k);
  return e;
};

// ---------- 狀態 ----------
const LS_KEY = 'mm.presets.v1';
const loadPresets = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } };
const savePresets = () => localStorage.setItem(LS_KEY, JSON.stringify(presets));
let presets = loadPresets();
const prefs = JSON.parse(localStorage.getItem('mm.state.v1') || '{}');

const state = {
  lift: LIFTS[prefs.lift] ? prefs.lift : 'squat',
  params: Object.fromEntries(Object.keys(LIFTS).map((k) => [k, defaultParams(k)])),
  t: 0, playing: true, speed: 1,
  layers: { muscles: true, skeleton: true, forceLine: true, joints: true, overlay: false, labels: true },
  colorMode: 'total', peak: false,
  diff: false,
  selJoint: 'all',
  tab: 'adjust',
  view: 'oblique',
  sourcesOpen: false,
  baseline: prefs.baseline || {}, // lift -> preset id（無 = 內建預設）
  ab: { A: null, B: null, side: false, showing: 'A' },
};
Object.assign(state.layers, prefs.layers || {});
const persist = () => localStorage.setItem('mm.state.v1', JSON.stringify({ lift: state.lift, baseline: state.baseline, layers: state.layers }));

const P = () => state.params[state.lift];
const baselineParams = (lift = state.lift) => {
  const id = state.baseline[lift];
  const p = id && presets.find((x) => x.id === id);
  return p ? p.params : defaultParams(lift);
};
const baselineName = (lift = state.lift) => {
  const id = state.baseline[lift];
  const p = id && presets.find((x) => x.id === id);
  return p ? p.name : '內建健美式標準';
};

// ---------- 3D ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1eee8);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 1; controls.maxDistance = 7;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.7));
const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 4, 3); scene.add(dl);
const grid = new THREE.GridHelper(4, 16, 0xbdb7ab, 0xd9d4ca); scene.add(grid);
// 臥推椅：椅背沿軀幹方向（可上斜），座墊保持水平
const PAD = new THREE.MeshStandardMaterial({ color: 0x6b4f3f, roughness: 0.8 });
const FRAME = new THREE.MeshStandardMaterial({ color: 0x60646c });
// 機架（滑軌、滑輪柱、滑台）：半透明，側面視角時不擋住身體
const GLASS = new THREE.MeshStandardMaterial({ color: 0x60646c, transparent: true, opacity: 0.22, depthWrite: false });
const UNIT = new THREE.BoxGeometry(1, 1, 1);
function makeBench() {
  const g = new THREE.Group();
  g.userData = { back: new THREE.Mesh(UNIT, PAD), seat: new THREE.Mesh(UNIT, PAD), post: new THREE.Mesh(UNIT, FRAME), leg: new THREE.Mesh(UNIT, FRAME), base: new THREE.Mesh(UNIT, FRAME) };
  g.add(...Object.values(g.userData));
  scene.add(g);
  return g;
}
const vadd = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
function updateBench(g, pose) {
  const b = pose.bench;
  g.visible = !!b;
  if (!b) return;
  const { back, seat, post, leg, base } = g.userData;
  // 椅背上緣貼著背部（骨盆中心往背側 5 cm），沿軀幹從臀下 10 cm 延伸到頭部
  const top = vadd(b.Pc, b.f, -0.05);
  const c = vadd(vadd(top, b.f, -0.03), b.u, 0.29);
  back.position.set(...c);
  back.scale.set(0.3, 0.06, 0.78);
  back.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(...b.u));
  const hinge = vadd(top, b.u, -0.1);
  const seatLen = Math.max(0.1, 1.04 - hinge[2]);
  seat.position.set(0, hinge[1] - 0.03, hinge[2] + seatLen / 2);
  seat.scale.set(0.3, 0.06, seatLen);
  const sy = hinge[1] - 0.06;
  const legZ = hinge[2] + seatLen / 2;
  leg.position.set(0, sy / 2, legZ); leg.scale.set(0.14, sy, Math.max(0.1, seatLen - 0.14));
  // 椅背立柱：頂端貼齊斜板下緣最低點（靠近座墊側邊緣），避免上斜時立柱插入椅背
  const postD = 0.08;
  const postZ = c[2] - 0.02;
  const zFront = postZ + postD / 2;
  const py = Math.max(0.05, c[1] + (-0.03 - (zFront - c[2]) * b.f[2]) / Math.max(0.25, b.f[1]));
  post.position.set(0, py / 2, postZ); post.scale.set(0.1, py, postD);
  // 地面連桿：把前腳與椅背立柱接在一起
  const zMin = Math.min(postZ - postD / 2, legZ - 0.07), zMax = Math.max(postZ + postD / 2, legZ + Math.max(0.1, seatLen - 0.14) / 2);
  base.position.set(0, 0.02, (zMin + zMax) / 2); base.scale.set(0.18, 0.04, zMax - zMin);
}
const benchGroup = makeBench();
// 硬舉用的墊高台（赤字）與墊塊（墊高拉）
const PROP = new THREE.MeshStandardMaterial({ color: 0x9a8b72, roughness: 0.9 });
const CABLE = new THREE.LineBasicMaterial({ color: 0x30343b });
function makeProps() {
  const g = new THREE.Group();
  g.userData = { plat: new THREE.Mesh(UNIT, PROP), blkL: new THREE.Mesh(UNIT, PROP), blkR: new THREE.Mesh(UNIT, PROP), boxes: [], cables: [] };
  g.add(g.userData.plat, g.userData.blkL, g.userData.blkR);
  scene.add(g);
  return g;
}
function updateProps(g, pose) {
  const { plat, blkL, blkR, boxes, cables } = g.userData;
  // 器械：pose.boxes = [{ c: 中心, s: 尺寸, rx/ry/rz: 轉角, mat: 'pad' | 'frame' | 'glass' }]
  const bl = pose.boxes || [];
  bl.forEach((bx, i) => {
    let m = boxes[i];
    if (!m) { m = new THREE.Mesh(UNIT, PAD); boxes.push(m); g.add(m); }
    m.material = bx.mat === 'frame' ? FRAME : bx.mat === 'glass' ? GLASS : PAD;
    m.position.set(...bx.c); m.scale.set(...bx.s); m.rotation.set(bx.rx || 0, bx.ry || 0, bx.rz || 0);
    m.visible = true;
  });
  for (let i = bl.length; i < boxes.length; i++) boxes[i].visible = false;
  // 鋼索：pose.cables = [[a, b], ...]
  const cl = pose.cables || [];
  cl.forEach(([a, b], i) => {
    let ln = cables[i];
    if (!ln) { ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), CABLE); cables.push(ln); g.add(ln); }
    ln.geometry.setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    ln.visible = true;
  });
  for (let i = cl.length; i < cables.length; i++) cables[i].visible = false;
  plat.visible = !!pose.platform;
  if (pose.platform) {
    const { h, x, z } = pose.platform;
    plat.position.set(0, h / 2, z); plat.scale.set(2 * x + 0.3, h, 0.5);
  }
  for (const [m, sx] of [[blkL, -1], [blkR, 1]]) {
    m.visible = !!pose.blocks;
    if (pose.blocks) { const { h, z } = pose.blocks; m.position.set(sx * 0.81, h / 2, z); m.scale.set(0.2, h, 0.4); }
  }
}
const propsA = makeProps(), propsB = makeProps();

const rigA = new Rig(scene);
const rigB = new Rig(scene);
const ghost = new Rig(scene, { ghost: true });
const benchB = makeBench();

const VIEWS = {
  oblique: ['斜角', (c) => [c[0] + 1.9, c[1] + 0.7, c[2] + 2.3]],
  side: ['側面', (c) => [c[0] + 3.1, c[1] + 0.1, c[2]]],
  top: ['上方', (c) => [c[0] + 0.01, c[1] + 3.2, c[2] + 0.01]],
  feet: ['腳側', (c) => [c[0], c[1] + 0.4, c[2] + 3.1]],
  head: ['頭側', (c) => [c[0], c[1] + 0.4, c[2] - 3.1]],
};
function viewCenter() {
  const L = LIFTS[state.lift];
  const base = L.viewCenter ? [...L.viewCenter] : L.supine ? (P().surface === 'floor' ? [0, 0.3, 0.35] : [0, 0.65, 0.35]) : [0, 0.8, 0];
  if (state.ab.side) base[0] = 0;
  return base;
}
function setView(v) {
  state.view = v;
  const c = viewCenter();
  let pos = VIEWS[v][1](c);
  // 臥推：「腳側」「頭側」沿身體長軸；站姿動作：腳側 = 正前方、頭側 = 正後上方
  if (!LIFTS[state.lift].supine && v === 'head') pos = [c[0], c[1] + 2.4, c[2] - 1.6];
  const k = (state.ab.side ? 1.45 : 1) * (LIFTS[state.lift].viewScale || 1) * Math.max(1, 0.95 / Math.max(0.3, camera.aspect));
  pos = pos.map((x, i) => c[i] + (x - c[i]) * k);
  camera.position.set(...pos);
  controls.target.set(...c);
  controls.update();
  renderViews();
}

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  if (state.view) setView(state.view);
}
new ResizeObserver(resize).observe(canvas.parentElement);

// 點選關節
const ray = new THREE.Raycaster();
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const valid = new Set(LIFTS[state.lift].params.map((p) => p.joint));
  const hits = ray.intersectObjects(rigA.pickers.filter((g) => valid.has(g.userData.joint)), false);
  if (hits.length) {
    state.selJoint = hits[0].object.userData.joint;
    state.tab = 'adjust';
    renderTabs(); renderPanel();
  }
});

// ---------- 計算快取 ----------
let peakCache = { key: '', A: null, base: null, B: null };
const pkey = (lift, p) => lift + JSON.stringify(p);
function getPeak(lift, p) {
  const k = pkey(lift, p);
  if (!getPeak.c) getPeak.c = new Map();
  if (!getPeak.c.has(k)) { if (getPeak.c.size > 30) getPeak.c.clear(); getPeak.c.set(k, peakAnalysis(lift, p)); }
  return getPeak.c.get(k);
}

// ---------- UI：上方動作 ----------
// 上方：目前動作按鈕；點開是分類清單
function currentName() {
  const m = matchEntry(state.lift, P());
  return m ? m.name : LIFTS[state.lift].name + '（自訂）';
}
function renderLifts() {
  $('#liftName').textContent = currentName();
}

const RECENT_KEY = 'mm.recent.v1';
const recent = (() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } })();
const picker = { q: '', equip: 'all' };

// 每個變化式的主要肌群：用內建參數算整個動作峰值，取作用在主要活動關節、且達第一名一半以上的前四名（第一次打開清單時才算）
const tagCache = new Map();
function muscleTags(c, forSearch = false) {
  if (!c.lift) return '';
  if (!tagCache.has(c.id)) {
    const pk = peakAnalysis(c.lift, { ...defaultParams(c.lift), ...c.set }, 12).mus;
    const mv = LIFTS[c.lift].moving;
    const names = [], wide = [];
    let top = 0;
    for (const [id, v] of Object.entries(pk).sort((a, b) => b[1].s - a[1].s)) {
      if (mv && !Object.keys(MUSCLE_BY_ID[id].arms).some((k) => mv.includes(k))) continue;
      const n = MUSCLE_SHORT[id];
      if (!n) continue;
      top = top || v.s;
      if (v.s < 0.3 * top) break;
      if (!wide.includes(n)) wide.push(n); // 搜尋用：達第一名 30% 以上
      if (v.s >= 0.5 * top && names.length < 4 && !names.includes(n)) names.push(n); // 顯示用：50% 以上、最多四個
    }
    tagCache.set(c.id, { show: names.join('・'), all: wide.join(' ') });
  }
  return tagCache.get(c.id)[forSearch ? 'all' : 'show'];
}

function pickEntry(c) {
  if (c.planned) { toast(c.name + '：規劃中，尚未推出'); return; }
  const base = { ...state.params[c.lift], ...c.set };
  // 目前參數加上變化式不成立時，改用內建預設＋變化式
  state.params[c.lift] = validate(c.lift, base) ? { ...defaultParams(c.lift), ...c.set } : base;
  const i = recent.indexOf(c.id);
  if (i >= 0) recent.splice(i, 1);
  recent.unshift(c.id);
  recent.length = Math.min(recent.length, 4);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  $('#picker').close();
  switchLift(c.lift);
}

function renderPicker() {
  const box = $('#pickerBody'); box.innerHTML = '';
  const cur = matchEntry(state.lift, P());
  const q = picker.q.trim().toLowerCase();
  const catName = Object.fromEntries(CATEGORIES), eqName = Object.fromEntries(EQUIPMENT);
  const hit = (c) => {
    if (picker.equip !== 'all' && c.equip !== picker.equip) return false;
    if (!q) return true;
    const hay = [c.name, ...(c.alias || []), catName[c.cat], eqName[c.equip], c.planned ? '' : muscleTags(c, true)].join(' ').toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  };
  const item = (c) => el('button', {
    class: 'pick' + (c.planned ? ' planned' : '') + (cur && cur.id === c.id ? ' on' : ''),
    onclick: () => pickEntry(c),
  },
  el('span', { class: 'nm' }, c.name),
  el('span', { class: 'eq' }, eqName[c.equip]),
  el('span', { class: 'mu' }, c.planned ? '即將推出' : muscleTags(c)));

  if (!q && picker.equip === 'all' && recent.length) {
    const rs = recent.map((id) => CATALOG.find((c) => c.id === id)).filter((c) => c && !c.planned);
    if (rs.length) {
      box.append(el('div', { class: 'pgrp' }, '最近使用'));
      box.append(el('div', { class: 'row recent' }, rs.map((c) => el('button', { class: 'chip sm' + (cur && cur.id === c.id ? ' on' : ''), onclick: () => pickEntry(c) }, c.name))));
    }
  }
  let n = 0;
  for (const [k, name] of CATEGORIES) {
    const list = CATALOG.filter((c) => c.cat === k && hit(c));
    if (!list.length) continue;
    n += list.length;
    box.append(el('div', { class: 'pgrp' }, name));
    list.forEach((c) => box.append(item(c)));
  }
  if (!n) box.append(el('div', { class: 'muted', style: 'padding:16px 4px' }, '找不到符合的動作。'));
}

function openPicker() {
  const dlg = $('#picker');
  const search = $('#pickerSearch');
  search.value = picker.q;
  const eq = $('#pickerEquip'); eq.innerHTML = '';
  for (const [k, n] of [['all', '全部'], ...EQUIPMENT]) {
    eq.append(el('button', { class: 'chip sm' + (picker.equip === k ? ' on' : ''), onclick: () => { picker.equip = k; openPicker(); } }, n));
  }
  renderPicker();
  if (!dlg.open) dlg.showModal();
}
$('#liftBtn').onclick = openPicker;
$('#pickerSearch').addEventListener('input', (e) => { picker.q = e.target.value; renderPicker(); });
$('#pickerClose').onclick = () => $('#picker').close();
$('#picker').addEventListener('click', (e) => { if (e.target.id === 'picker') e.target.close(); }); // 點背景關閉
function switchLift(k) {
  state.lift = k; state.selJoint = 'all'; state.ab = { A: null, B: null, side: false, showing: 'A' };
  persist(); renderAll(); setView(state.view);
}
function renderViews() {
  const box = $('#views'); box.innerHTML = '';
  for (const [k, [n]] of Object.entries(VIEWS)) box.append(el('button', { class: 'chip' + (state.view === k ? ' on' : ''), onclick: () => setView(k) }, n));
}

// ---------- 播放 ----------
const playBtn = $('#playBtn'), scrub = $('#scrub');
playBtn.onclick = () => { state.playing = !state.playing; playBtn.textContent = state.playing ? '❚❚' : '▶'; };
scrub.oninput = () => { state.t = +scrub.value; state.playing = false; playBtn.textContent = '▶'; };
$('#topBtn').onclick = () => { state.t = 0; scrub.value = 0; state.playing = false; playBtn.textContent = '▶'; };
$('#botBtn').onclick = () => { state.t = 0.5; scrub.value = 0.5; state.playing = false; playBtn.textContent = '▶'; };
$('#speedBtn').onclick = (e) => { state.speed = state.speed === 1 ? 0.5 : state.speed === 0.5 ? 0.25 : 1; e.target.textContent = state.speed + '×'; };

// ---------- 提示 ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2200);
  navigator.vibrate?.(60);
}

// ---------- 分頁 ----------
const TABS = [['adjust', '調整'], ['data', '數據'], ['layers', '圖層'], ['compare', '比較'], ['save', '存檔']];
function renderTabs() {
  const n = $('#tabs'); n.innerHTML = '';
  for (const [k, name] of TABS) n.append(el('button', { class: state.tab === k ? 'on' : '', onclick: () => { state.tab = k; renderTabs(); renderPanel(); } }, name));
}

function fmtVal(p, v) {
  if (p.type === 'select') return p.options.find((o) => o[0] === v)?.[1];
  if (p.mech === 'B') return Math.round(v * 100) + '%';
  if (p.mech === 'C') return v === 0 ? '中立' : (v < 0 ? p.left.replace('偏', '') : p.right.replace('偏', '')) + ' ' + Math.round(Math.abs(v) * 100) + '%';
  if (p.fmt === 'cm') return Math.round(v * 100) + ' cm';
  if (p.fmt === 'dec2') return Number(v).toFixed(2);
  if (p.unit) return v + p.unit;
  if (p.key === 'grip') return v.toFixed(2) + '×';
  if (p.key === 'dom') return v < 0.4 ? p.left : v > 0.6 ? p.right : '均衡';
  return Math.round(v * 100) + '%';
}

const CAM_HINTS = {
  legext: {
    human: '中段點依 Marginson & Eston (2001) 等之等長測量內插（峰值於膝屈 60°–80°，近伸直端大幅下降）；0° 與 115° 為外插。',
    comm_desc: '端點比例依 Folland & Morris (2008) 商用機極值（100°→80° +2.5%、60°→20° −20.5%），中間點為插值假設。',
    comm_asc: '端點比例依 Folland & Morris (2008) 商用機極值（100°→80° +22.2%、60°→20° +37.6%），中間點為插值假設。',
    flat: '全程維持固定相對力矩（0.90），作為等力矩基準。',
    gravity: '無凸輪槓桿＋配重，阻力隨小腿水平分量變化（接近伸直端最大）。',
  },
  legcurl: {
    human: '趨勢與範圍依 Kulig (1984)、Onishi (2002)、Beyer (2019)，逐點為取中值（拉長端 15°–30° 最重、深屈端較輕）；已知限制：坐姿與俯臥目前共用同一表。',
    comm_asc: '示意用上升型凸輪（假設，非實測；Folland & Morris 2008 只量腿伸機），設定彎曲收縮端（90° 附近）阻力較高。',
    flat: '全程維持固定相對力矩（0.90），作為等力矩基準。',
    gravity: '無凸輪槓桿＋配重，阻力隨小腿水平分量變化。',
  },
};

function paramHint(p, v) {
  if (p.key === 'pulleyRatio') {
    const M = MACHINES[state.lift];
    if (!M?.stackKg) return null;
    const div = pulleyDivisor(v);
    const handKg = +(M.stackKg / div).toFixed(1);
    return M.dualStack
      ? `單側示範配重片 ${M.stackKg} kg（${v} 滑輪比）→ 單手實際拉力 ${handKg} kg`
      : `示範配重片 ${M.stackKg} kg（${v} 滑輪比）→ 手上實際拉力 ${handKg} kg`;
  }
  if (p.key === 'cam') return CAM_HINTS[state.lift]?.[v] || null;
  if (p.key === 'friction') {
    return '預設 0 為準靜態參考；設定 μ 時代表向心階段的上限（sinθ + μcosθ），離心時為 sinθ − μcosθ。';
  }
  if (p.key === 'railAngle') {
    if (v === '7') return '參考 Hammer Strength 7° 傾斜軌道（面對斜軌站立，起立時槓微往後帶）。';
    if (v === '-7') return '背對 7° 斜軌站立，下蹲時槓往身體後方移動。';
    return '0° 垂直滑軌（力量訓練／健力房常見規格）。';
  }
  return null;
}

function setParam(p, raw, input) {
  const params = P();
  const old = params[p.key];
  const v = p.type === 'select' ? raw : +raw;
  params[p.key] = v;
  const err = validate(state.lift, params);
  if (err) {
    params[p.key] = old;
    if (input) input.value = old;
    toast('無法成立：' + err);
    return false;
  }
  renderLifts();
  return true;
}

function paramControl(p) {
  const params = P();
  const v = params[p.key];
  const valEl = el('span', { class: 'v' }, fmtVal(p, v));
  const hint = paramHint(p, v);
  if (p.type === 'select') {
    return el('div', { class: 'ctl' },
      el('div', { class: 'hd' }, el('span', {}, p.label)),
      el('div', { class: 'row' }, p.options.map(([k, n]) => el('button', {
        class: 'chip sm' + (v === k ? ' on' : ''),
        onclick: () => { if (setParam(p, k)) { renderPanel(); if (p.key === 'surface') setView(state.view); } },
      }, n))),
      hint ? el('div', { class: 'param-hint' }, hint) : null);
  }
  const input = el('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: v });
  input.addEventListener('input', () => { if (setParam(p, input.value, input)) valEl.textContent = fmtVal(p, P()[p.key]); });
  input.addEventListener('dblclick', () => { P()[p.key] = p.def; input.value = p.def; valEl.textContent = fmtVal(p, p.def); });
  return el('div', { class: 'ctl' },
    el('div', { class: 'hd' }, el('span', {}, p.label), valEl),
    input,
    el('div', { class: 'ends' }, el('span', {}, p.left), el('span', {}, p.right)),
    hint ? el('div', { class: 'param-hint' }, hint) : null);
}

const MECH = { A: '姿勢／軌跡（看得到）', B: '等長用力（看不到，力矩改變）', C: '協同肌偏好（看不到，總力矩不變）' };

function sourcesBlock() {
  const entry = matchEntry(state.lift, P());
  const info = getSourceInfo(state.lift, entry?.id);
  const details = el('details', { class: 'sources-box', open: state.sourcesOpen || false },
    el('summary', {},
      el('span', { class: 'src-title' }, '假設與參考來源'),
      el('span', { class: `src-badge src-${info.badge.kind}` }, info.badge.text)),
    el('div', { class: 'src-body' },
      el('div', { class: 'src-hd' }, '模型假設'),
      el('ul', { class: 'src-list' }, info.assumptions.map((txt) => el('li', {}, txt))),
      el('div', { class: 'src-hd' }, '與文獻趨勢比對'),
      info.trends.length
        ? info.trends.map((t) => el('div', { class: 'src-trend' },
          el('div', { class: 'src-trend-top' },
            el('span', { class: 'src-pill ' + (t.pass ? 'pass' : 'fail') }, t.pass ? '一致' : '不一致'),
            el('span', { class: 'src-ev' }, t.evidenceLabel)),
          el('div', { class: 'src-trend-cmp' }, t.compare),
          el('div', { class: 'src-trend-meta' }, `預期：${t.expected}｜模型：${t.model}`),
          el('div', { class: 'src-trend-meta' }, `依據：${t.ref}`)))
        : el('p', { class: 'src-empty' }, info.trendNote || '尚無自動化趨勢比對項目。'),
      el('div', { class: 'src-hd' }, '參考文獻與資料來源'),
      info.refs.length
        ? el('ol', { class: 'src-refs' }, info.refs.map((r) => el('li', {},
          `${r.authors}${r.year ? ` (${r.year})` : ''}. ${r.title}${/[?!？]$/.test(r.title) ? ' ' : '. '}${r.venue}`,
          r.url ? el('a', { class: 'src-link', href: r.url, target: '_blank', rel: 'noopener noreferrer' }, `${r.tag || '連結'} ↗`) : null)))
        : el('p', { class: 'src-empty' }, '尚無已查證之直接研究文獻。')));
  details.addEventListener('toggle', () => { state.sourcesOpen = details.open; });
  return details;
}

function renderAdjust(box) {
  const L = LIFTS[state.lift];
  const joints = [...new Set(L.params.map((p) => p.joint))];
  box.append(el('div', { class: 'row' },
    el('button', { class: 'chip sm' + (state.selJoint === 'all' ? ' on' : ''), onclick: () => { state.selJoint = 'all'; renderPanel(); } }, '全部'),
    joints.map((j) => el('button', { class: 'chip sm' + (state.selJoint === j ? ' on' : ''), onclick: () => { state.selJoint = j; renderPanel(); } }, JOINT_NAMES[j]))));
  if (state.selJoint === 'all') box.append(el('div', { class: 'muted', style: 'margin:-4px 0 6px' }, '提示：直接點 3D 上的關節，只顯示該關節的滑桿。'));
  const shown = L.params.filter((p) => state.selJoint === 'all' || p.joint === state.selJoint);
  for (const m of ['A', 'B', 'C']) {
    const ps = shown.filter((p) => p.mech === m);
    if (!ps.length) continue;
    box.append(el('div', { class: 'sec' }, `${m}. ${MECH[m]}`));
    ps.forEach((p) => box.append(paramControl(p)));
  }
  box.append(el('div', { class: 'note' }, el('b', {}, '內建健美式標準：'), L.standardNote));
  box.append(el('div', { class: 'row', style: 'margin-top:10px' },
    el('button', { class: 'chip sm', onclick: () => { state.params[state.lift] = defaultParams(state.lift); renderPanel(); } }, '回到內建預設')));
  box.append(sourcesBlock());
}

let dataBox = null;
// ---------- 全行程曲線 ----------
let curveChart = null, curveKey = '', curveMode = 'joints', curveWrap = null;
function curveSection() {
  const key = curveMode + pkey(state.lift, P());
  if (key !== curveKey || !curveWrap) {
    const L = LIFTS[state.lift];
    const data = sampleCurve(pkey(state.lift, P()), state.lift, P(), analyze);
    curveChart = buildCurve({
      mode: curveMode, data, lift: state.lift, L, jointNames: JOINT_NAMES,
      muscleName: (id) => MUSCLE_SHORT[id] || MUSCLE_BY_ID[id].name.replace(/（.*）/, ''),
      muscleOrder: MUSCLES.map((m) => m.id), liftSet: new Set(liftMuscles(state.lift).map((m) => m.id)),
    });
    curveWrap = el('div', {},
      el('div', { class: 'sec' }, '整個動作的變化（100%＝整個動作中最高的那一刻；圓點＝目前位置）'),
      el('div', { class: 'row' }, [['joints', '關節力矩（物理）'], ['muscles', '主要肌肉（估計）']].map(([k, n]) => el('button', {
        class: 'chip sm' + (curveMode === k ? ' on' : ''), onclick: () => { curveMode = k; updateData(true); },
      }, n))),
      curveChart.el);
    curveKey = key;
  }
  if (cur) curveChart.setE(cur.e);
  return curveWrap;
}
function renderData(box) {
  dataBox = el('div');
  box.append(dataBox);
  box.append(sourcesBlock());
  updateData(true);
}

function renderLayers(box) {
  const tg = (k, name) => {
    const i = el('input', { type: 'checkbox' }); i.checked = !!state.layers[k];
    i.onchange = () => { state.layers[k] = i.checked; persist(); };
    return el('label', { class: 'toggle' }, el('span', {}, name), i);
  };
  box.append(el('div', { class: 'sec' }, '圖層'));
  box.append(tg('muscles', '肌肉熱力圖'), tg('skeleton', '骨架'), tg('forceLine', '力線與力臂'), tg('joints', '關節負擔（圓圈大小）'), tg('labels', '文字標籤'));
  box.append(el('div', { class: 'sec' }, '肌肉顏色代表'));
  const modes = [['total', '受力（主動＋被動）'], ['active', '只看主動'], ['passive', '只看被動（拉伸）'], ['length', '肌肉長度']];
  box.append(el('div', { class: 'row' }, modes.map(([k, n]) => el('button', {
    class: 'chip sm' + (state.colorMode === k ? ' on' : ''), onclick: () => { state.colorMode = k; renderPanel(); },
  }, n))));
  box.append(el('div', { class: 'sec' }, '數值取自'));
  box.append(el('div', { class: 'row' },
    el('button', { class: 'chip sm' + (!state.peak ? ' on' : ''), onclick: () => { state.peak = false; renderPanel(); } }, '目前這一幀'),
    el('button', { class: 'chip sm' + (state.peak ? ' on' : ''), onclick: () => { state.peak = true; renderPanel(); } }, '整個動作的峰值')));
  box.append(el('div', { class: 'note' }, '關節圓圈：青色＝力矩需求（越大越重），紫色＝接近活動度末端。'));
}

function renderCompare(box) {
  box.append(el('div', { class: 'sec' }, '比較基準'));
  const sel = el('select', {}, el('option', { value: '' }, '內建健美式標準'),
    presets.filter((p) => p.lift === state.lift).map((p) => el('option', { value: p.id }, p.name)));
  sel.value = state.baseline[state.lift] || '';
  sel.onchange = () => { state.baseline[state.lift] = sel.value || null; persist(); };
  box.append(el('div', { class: 'row' }, sel));
  const tg = (get, set, name) => {
    const i = el('input', { type: 'checkbox' }); i.checked = get();
    i.onchange = () => { set(i.checked); renderPanel(); };
    return el('label', { class: 'toggle' }, el('span', {}, name), i);
  };
  box.append(tg(() => state.layers.overlay, (v) => { state.layers.overlay = v; persist(); }, '疊上標準（半透明骨架）'));
  box.append(tg(() => state.diff, (v) => { state.diff = v; }, '差異熱力圖（紅＝增加、藍＝減少）'));

  box.append(el('div', { class: 'sec' }, 'A／B 對比'));
  const ab = state.ab;
  const desc = (x) => (x ? x.name : '未設定');
  box.append(el('div', { class: 'note' }, `A：${desc(ab.A)}　B：${desc(ab.B)}`));
  box.append(el('div', { class: 'row', style: 'margin-top:8px' },
    el('button', { class: 'chip sm', onclick: () => { ab.A = { name: '目前設定 ' + time(), params: { ...P() } }; renderPanel(); } }, '目前設為 A'),
    el('button', { class: 'chip sm', onclick: () => { ab.B = { name: '目前設定 ' + time(), params: { ...P() } }; renderPanel(); } }, '目前設為 B')));
  const pick = el('select', {}, el('option', { value: '' }, '從已存設定或標準選 B…'),
    el('option', { value: '__base' }, '內建健美式標準'),
    presets.filter((p) => p.lift === state.lift).map((p) => el('option', { value: p.id }, p.name)));
  pick.onchange = () => {
    if (pick.value === '__base') ab.B = { name: '內建健美式標準', params: defaultParams(state.lift) };
    else { const p = presets.find((x) => x.id === pick.value); if (p) ab.B = { name: p.name, params: { ...p.params } }; }
    renderPanel();
  };
  box.append(el('div', { class: 'row' }, pick));
  const ready = ab.A && ab.B;
  box.append(el('div', { class: 'row' },
    el('button', { class: 'chip sm' + (ab.side ? ' on' : ''), disabled: !ready, onclick: () => { ab.side = !ab.side; if (ab.side) state.params[state.lift] = { ...ab.A.params }; setView(state.view); renderPanel(); } }, '並排顯示'),
    el('button', { class: 'chip sm', disabled: !ready, onclick: () => {
      ab.showing = ab.showing === 'A' ? 'B' : 'A';
      state.params[state.lift] = { ...ab[ab.showing].params };
      toast(`切換到 ${ab.showing}：${ab[ab.showing].name}`);
      renderPanel();
    } }, `A↔B 切換（目前 ${ab.showing}）`)));
  if (!ready) box.append(el('div', { class: 'muted' }, '先設定 A 與 B 兩組。並排時左邊是目前設定（A），右邊是 B，兩邊熱力圖用同一把尺。'));
}
const time = () => new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

function renderSave(box) {
  const name = el('input', { type: 'text', placeholder: '設定名稱，例如「深蹲 偏髖」' });
  box.append(el('div', { class: 'row' }, name, el('button', {
    class: 'chip on', onclick: () => {
      const n = name.value.trim() || `${LIFTS[state.lift].name} ${time()}`;
      presets.unshift({ id: crypto.randomUUID?.() || String(Date.now()), name: n, lift: state.lift, params: { ...P() },
        layers: { ...state.layers }, view: state.view, modelVersion: MODEL_VERSION, created: Date.now() });
      savePresets(); toast('已存檔：' + n); renderPanel();
    },
  }, '存檔')));
  box.append(el('div', { class: 'muted' }, '只存參數，不存計算結果；每次打開都重新計算。資料存在這支手機的瀏覽器裡。'));
  const list = presets.filter((p) => p.lift === state.lift);
  box.append(el('div', { class: 'sec' }, `已存的${LIFTS[state.lift].name}設定（${list.length}）`));
  if (!list.length) box.append(el('div', { class: 'muted' }, '還沒有存檔。'));
  for (const p of list) {
    const isBase = state.baseline[state.lift] === p.id;
    box.append(el('div', { class: 'preset' },
      el('div', { class: 'nm' }, p.name, isBase ? el('div', { class: 'base' }, '比較基準') : null),
      el('button', { class: 'chip sm', onclick: () => {
        state.params[state.lift] = { ...defaultParams(state.lift), ...p.params };
        if (p.layers) Object.assign(state.layers, p.layers);
        if (p.view) setView(p.view);
        toast('已載入：' + p.name);
      } }, '載入'),
      el('button', { class: 'chip sm', onclick: () => { state.baseline[state.lift] = isBase ? null : p.id; persist(); renderPanel(); } }, isBase ? '取消基準' : '設為基準'),
      el('button', { class: 'chip sm', onclick: () => {
        if (!confirm(`刪除「${p.name}」？`)) return;
        presets = presets.filter((x) => x.id !== p.id);
        if (isBase) state.baseline[state.lift] = null;
        savePresets(); persist(); renderPanel();
      } }, '刪除')));
  }
}

function renderPanel() {
  const box = $('#panel'); box.innerHTML = ''; dataBox = null;
  renderLifts();
  ({ adjust: renderAdjust, data: renderData, layers: renderLayers, compare: renderCompare, save: renderSave })[state.tab](box);
}
function renderAll() {
  renderLifts(); renderViews(); renderTabs(); renderPanel();
  $('#botBtn').textContent = LIFTS[state.lift].bottomLabel;
  $('#topBtn').textContent = LIFTS[state.lift].topLabel || '頂點';
}

// ---------- 每幀 ----------
let last = performance.now(), dataTick = 0, cur = null;
const easeE = (t) => 0.5 - 0.5 * Math.cos(2 * Math.PI * t);

function muscleValues(res, peak) {
  const src = peak ? peak.mus : res.mus;
  const out = {};
  for (const [id, m] of Object.entries(src)) {
    out[id] = state.colorMode === 'active' ? Math.min(m.a, 1.5) : state.colorMode === 'passive' ? m.p : state.colorMode === 'length' ? m.l : m.s;
  }
  return out;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.playing) { state.t = (state.t + (dt * state.speed) / 3.2) % 1; scrub.value = state.t; }
  const lift = state.lift;
  const e = easeE(state.t);
  const params = P();
  const res = analyze(lift, params, e);
  const needBase = state.diff || state.layers.overlay;
  const bParams = baselineParams();
  const base = needBase ? analyze(lift, bParams, e) : null;
  const side = state.ab.side && state.ab.B;
  const resB = side ? analyze(lift, state.ab.B.params, e) : null;
  const peakA = state.peak ? getPeak(lift, params) : null;
  const peakBase = state.peak && state.diff ? getPeak(lift, bParams) : null;
  const peakB = state.peak && side ? getPeak(lift, state.ab.B.params) : null;

  const set = new Set(liftMuscles(lift).map((m) => m.id));
  const vA = muscleValues(res, peakA);
  const vB = resB ? muscleValues(resB, peakB) : null;
  const vBase = base ? muscleValues(base, peakBase) : null;
  // 用整個動作的峰值當固定尺度（不再每一幀重新縮放，避免頂點附近小數值被放大成滿色）
  let maxV = 1e-6;
  const pkVals = [muscleValues(null, getPeak(lift, params))];
  if (side) pkVals.push(muscleValues(null, getPeak(lift, state.ab.B.params)));
  for (const id of set) for (const v of [vA, vB, ...pkVals]) if (v) maxV = Math.max(maxV, v[id] || 0);

  const colorsFor = (v) => {
    const c = {};
    for (const id of set) {
      if (state.diff && vBase && state.colorMode !== 'length') {
        const ref = Math.max(vBase[id] || 0, 0.15 * Math.max(...[...set].map((k) => vBase[k] || 0)));
        c[id] = diffColor(((v[id] || 0) - (vBase[id] || 0)) / (ref || 1));
      } else if (state.colorMode === 'length') c[id] = lengthColor(v[id]);
      else c[id] = heatColor((v[id] || 0) / maxV);
    }
    return c;
  };
  const jointNorm = (r, pk) => {
    const src = pk ? pk.joints : r.joints;
    const m = Math.max(1e-6, ...Object.values(getPeak(lift, r === resB ? state.ab.B.params : params).joints));
    return Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v / m]));
  };
  const armLines = (r) => {
    const R = r.pose.R, out = [];
    if (LIFTS[lift].supine) {
      for (const k of ['shoulder', 'elbow']) out.push([k, R[k], [R.hand[0], R[k][1], R.hand[2]]]);
    } else {
      const L5 = [0, ...[1, 2].map((i) => r.pose.Pc[i] + r.pose.u[i] * 0.05)];
      const lz = r.pose.lineZ ?? r.pose.bar[2]; // 力線：預設是槓的垂直線；臀推等用腳底壓力中心
      const fl = r.pose.forceLine; // 器械／滑輪：力臂 = 關節到外力作用線的垂直距離
      const foot = (p) => {
        if (!fl) return [p[0], p[1], lz];
        if (fl.is3d) {
          const v = [p[0] - fl.p[0], p[1] - fl.p[1], p[2] - fl.p[2]];
          const n2 = fl.d[0] ** 2 + fl.d[1] ** 2 + fl.d[2] ** 2 || 1;
          const k = (v[0] * fl.d[0] + v[1] * fl.d[1] + v[2] * fl.d[2]) / n2;
          return [fl.p[0] + fl.d[0] * k, fl.p[1] + fl.d[1] * k, fl.p[2] + fl.d[2] * k];
        }
        const v = [0, p[1] - fl.p[1], p[2] - fl.p[2]], dd = [0, fl.d[1], fl.d[2]], n2 = dd[1] ** 2 + dd[2] ** 2 || 1;
        const k = (v[1] * dd[1] + v[2] * dd[2]) / n2;
        return [p[0], fl.p[1] + dd[1] * k, fl.p[2] + dd[2] * k];
      };
      const js = r.pose.armJoints || ['hip', 'knee', 'ankle', 'lumbar'];
      for (const [k, p] of [['hip', R.hip], ['knee', R.knee], ['ankle', R.ankle], ['lumbar', L5], ['shoulder', R.shoulder], ['elbow', R.elbow]]) if (js.includes(k) && p) out.push([k, p, foot(p)]);
    }
    return out;
  };

  const offA = side ? -0.85 : 0;
  rigA.group.position.x = offA; ghost.group.position.x = offA; benchGroup.position.x = offA;
  const aLinesA = armLines(res);
  rigA.update(res.pose, {
    layers: state.layers, colors: colorsFor(vA), jointLoad: jointNorm(res, peakA), rom: res.rom, liftSet: set,
    armLines: aLinesA.map((x) => [x[1], x[2]]),
  });
  ghost.setVisible(!!(state.layers.overlay && base));
  if (base) ghost.update(base.pose);
  rigB.setVisible(!!side);
  updateBench(benchGroup, res.pose);
  if (side) updateBench(benchB, resB.pose); else benchB.visible = false;
  propsA.position.x = offA; updateProps(propsA, res.pose);
  propsB.visible = !!side;
  if (side) {
    updateProps(propsB, resB.pose);
    rigB.group.position.x = 0.85; benchB.position.x = 0.85; propsB.position.x = 0.85;
    rigB.update(resB.pose, {
      layers: state.layers, colors: colorsFor(vB), jointLoad: jointNorm(resB, peakB), rom: resB.rom, liftSet: set,
      armLines: armLines(resB).map((x) => [x[1], x[2]]),
    });
  }
  controls.update();
  renderer.render(scene, camera);

  // 標籤
  cur = { res, base, vA, vBase, maxV, peakA, set, e };
  curveChart?.setE(e);
  drawLabels(res, aLinesA, vA, maxV, set, offA, side ? { resB, vB } : null);
  drawLegend();
  if (++dataTick % 6 === 0) { updateData(); drawWarns(res); }
  requestAnimationFrame(frame);
}

const lblBox = $('#labels');
const lblPool = [];
function project(p, offX = 0) {
  const v = new THREE.Vector3(p[0] + offX, p[1], p[2]).project(camera);
  const r = canvas.getBoundingClientRect();
  return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height, v.z < 1];
}
// 標籤名稱：去括號後若會撞名（例如胸大肌中下胸與上胸），保留完整名稱
const LABEL_NAME = (() => {
  const cnt = {};
  for (const m of MUSCLES) { const k = m.name.replace(/（.*）/, ''); cnt[k] = (cnt[k] || 0) + 1; }
  return Object.fromEntries(MUSCLES.map((m) => {
    const k = m.name.replace(/（.*）/, '');
    return [m.id, cnt[k] > 1 ? m.name : k];
  }));
})();
function drawLabels(res, aLines, vA, maxV, set, offA, B) {
  let i = 0;
  const placed = [];
  const put = (p, text, cls, off = 0) => {
    const [x, y, vis] = project(p, off);
    if (!vis) return;
    if (placed.some(([px, py]) => Math.abs(px - x) < 88 && Math.abs(py - y) < 24)) return;
    placed.push([x, y]);
    let d = lblPool[i];
    if (!d) { d = el('div', { class: 'lbl' }); lblBox.append(d); lblPool.push(d); }
    d.className = 'lbl ' + cls; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.display = '';
    i++;
  };
  if (state.layers.labels) {
    for (const [k, msg] of Object.entries(res.rom)) {
      const p = k === 'lumbar' ? res.pose.Pc : res.pose.R[k];
      if (p) put(p, msg, 'rom', offA);
    }
    if (state.layers.forceLine) {
      const is3d = !!res.pose.forceLine?.is3d;
      const lens = aLines.map(([, a, b]) => (is3d ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : Math.hypot(a[0] - b[0], a[2] - b[2])));
      const m = Math.max(1e-6, ...lens);
      aLines.forEach(([k, a, b], j) => {
        if (lens[j] < 0.01) return;
        put([(a[0] + b[0]) / 2, is3d ? (a[1] + b[1]) / 2 : a[1], (a[2] + b[2]) / 2], `${JOINT_NAMES[k]} 力臂 ${Math.round((lens[j] / m) * 100)}%`, 'arm', offA);
      });
    }
    if (state.layers.muscles && state.colorMode !== 'length' && !state.diff) {
      const top = [...set].sort((a, b) => (vA[b] || 0) - (vA[a] || 0)).slice(0, 2);
      for (const id of top.filter((k) => (vA[k] || 0) / maxV > 0.08)) {
        const mesh = rigA.muscles[id][0];
        const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion).multiplyScalar(mesh.scale.y / 2);
        const p = mesh.position.clone().add(dir);
        put([p.x, p.y, p.z], `${LABEL_NAME[id]} ${Math.round(((vA[id] || 0) / maxV) * 100)}%`, 'mus', offA);
      }
    }
    if (B) {
      put([0, 2.05, 0], 'A　目前設定', 'mus', -0.85);
      put([0, 2.05, 0], 'B　' + state.ab.B.name, 'mus', 0.85);
    }
  }
  for (; i < lblPool.length; i++) lblPool[i].style.display = 'none';
}

function drawLegend() {
  const lg = $('#legend');
  const mode = state.diff ? 'diff' : state.colorMode;
  if (lg.dataset.mode === mode) return;
  lg.dataset.mode = mode;
  const grad = {
    diff: 'linear-gradient(90deg,#3b82f6,#c3c5cc,#ef4444)',
    length: 'linear-gradient(90deg,#2563eb,#c3c5cc,#16a34a)',
  }[mode] || 'linear-gradient(90deg,#c3c5cc,#f6d55c,#f28c28,#d7301f,#8b0000)';
  const ends = { diff: ['減少', '增加'], length: ['縮短', '拉長'] }[mode] || ['0', '100%'];
  lg.innerHTML = '';
  lg.append(el('span', {}, ends[0]), el('span', { class: 'bar', style: `background:${grad}` }), el('span', {}, ends[1]));
}

function drawWarns(res) {
  const w = $('#warns'); w.innerHTML = '';
  for (const m of res.pose.warn) w.append(el('span', {}, m));
}

function updateData(force) {
  if (!dataBox || !cur) { if (force && dataBox) setTimeout(() => updateData(true), 50); return; }
  const { res, vA, vBase, maxV, set, peakA } = cur;
  const src = peakA ? peakA.mus : res.mus;
  const box = dataBox; box.innerHTML = '';
  box.append(curveSection());
  const showDiff = state.diff && vBase;
  box.append(el('div', { class: 'sec' }, `肌肉受力（模型估計，${state.peak ? '整個動作峰值' : '目前這一幀'}；100%＝整個動作中最高的那一刻）`));
  box.append(el('div', { class: 'legendrow' }, el('span', {}, el('i', { style: 'background:#f28c28' }), '主動'), el('span', {}, el('i', { style: 'background:#a78bfa' }), '被動（拉伸）')));
  const list = el('div', { class: 'mlist', style: 'margin-top:8px' });
  const ids = [...set].sort((a, b) => (src[b].s) - (src[a].s));
  const pkS = getPeak(state.lift, P()).mus;
  const maxS = Math.max(1e-6, ...ids.map((id) => Math.max(src[id].s, pkS[id] ? pkS[id].s : 0)));
  for (const id of ids) {
    const m = src[id];
    let right = Math.round((m.s / maxS) * 100) + '%';
    if (showDiff) {
      const b = (cur.base && (state.peak ? getPeak(state.lift, baselineParams()).mus[id] : cur.base.mus[id])) || { s: 0 };
      const ref = Math.max(b.s, 0.05);
      const d = Math.round(((m.s - b.s) / ref) * 100);
      right = (d > 0 ? '+' : '') + d + '%';
    }
    const tagCls = m.len === '拉長' ? 'tag long' : m.len === '縮短' ? 'tag short' : 'tag';
    list.append(el('div', { class: 'it' },
      el('span', { class: 'nm' }, MUSCLE_BY_ID[id].name),
      el('span', { class: 'pc', style: showDiff ? `color:${right.startsWith('+') ? '#dc2626' : right.startsWith('-') ? '#2563eb' : ''}` : '' }, right),
      el('span', { class: tagCls }, m.len),
      el('div', { class: 'track' },
        el('i', { style: `width:${(Math.min(m.a, 1.5) / maxS) * 100}%;background:#f28c28` }),
        el('i', { style: `width:${(m.p / maxS) * 100}%;background:#a78bfa` }))));
  }
  box.append(list);
  if (showDiff) box.append(el('div', { class: 'muted' }, `差異＝跟「${baselineName()}」相比的增減。`));
  const joints = peakA ? peakA.joints : res.joints;
  const jm = Math.max(1e-6, ...Object.values(getPeak(state.lift, P()).joints));
  box.append(el('div', { class: 'sec' }, '關節力矩需求（物理計算；100%＝整個動作中最高的那一刻）'));
  const jl = el('div', { class: 'mlist' });
  for (const [k, v] of Object.entries(joints).sort((a, b) => b[1] - a[1])) {
    jl.append(el('div', { class: 'it' },
      el('span', { class: 'nm' }, JOINT_NAMES[k] + (res.rom[k] ? '　⚠ ' + res.rom[k] : '')),
      el('span', { class: 'pc' }, Math.round((v / jm) * 100) + '%'),
      el('span', { class: 'tag' }, ''),
      el('div', { class: 'track' }, el('i', { style: `width:${(v / jm) * 100}%;background:#0891b2` }))));
  }
  box.append(jl);
  if (LIFTS[state.lift].dofs.includes('shRot')) box.append(el('div', { class: 'muted' }, '肩部數值合併上臂前舉、側舉與內外旋的力矩需求。'));
  box.append(el('div', { class: 'note', style: 'margin-top:10px' }, '只顯示比例，不顯示公斤或牛頓。模型不涵蓋代謝灼熱感、疲勞、延遲性痠痛與個人神經控制。教學用途，非傷害診斷。'));
}

// ---------- 啟動 ----------
$('#infoBtn').onclick = () => $('#info').showModal();
$('#ver').textContent = MODEL_VERSION;
renderAll();
resize();
setView('oblique');
requestAnimationFrame(frame);
loadBones().then((b) => { rigA.attachBones(b); rigB.attachBones(b); }).catch((e) => console.warn('骨骼載入失敗', e));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

if (import.meta.env.DEV) window.__mm = { state, setView, camera, controls, rigA, renderPanel: () => renderAll(), pick: (id) => pickEntry(CATALOG.find((c) => c.id === id)) };
