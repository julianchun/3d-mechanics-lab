import * as THREE from 'three';
import { add, sub, mul, norm, cross, dot, len, MUSCLES, BODY, DEFAULT_BODY, girdleForBody, girdleMatrix, MODEL_VERSION } from './biomech.js';

const T = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const mirror = (p) => [-p[0], p[1], p[2]];
const Y = new THREE.Vector3(0, 1, 0);

// 肌肉附著點（右側）：[段, 沿骨比例 t, 外側偏移, 前側偏移]，r = 視覺粗細
const ATTACH = {
  vasti: { a: ['thigh', 0.22, 0.01, 0.045], b: ['shank', 0.05, 0, 0.045], r: 0.05 },
  rf: { a: ['hip', 0.25, 0.02, 0.06], b: ['shank', 0.04, 0, 0.05], r: 0.028 },
  bflh: { a: ['hip', -0.25, 0.035, -0.06], b: ['shank', 0.12, 0.038, -0.035], r: 0.025 },
  semis: { a: ['hip', -0.25, -0.035, -0.06], b: ['shank', 0.14, -0.043, -0.035], r: 0.032 },
  bfsh: { a: ['thigh', 0.48, 0.055, -0.018], b: ['shank', 0.12, 0.045, -0.035], r: 0.018 },
  gmaxUpper: { a: ['trunk', 0.13, 0.048, -0.11], b: ['thigh', 0.16, 0.055, -0.03], r: 0.033 },
  gmaxLower: { a: ['trunk', -0.02, 0.025, -0.12], b: ['thigh', 0.30, 0.045, -0.035], r: 0.048 },
  gmedFront: { a: ['hip', 0.55, 0.075, 0.022], b: ['thigh', 0.05, 0.075, 0.022], r: 0.024 },
  gmedBack: { a: ['hip', 0.55, 0.078, -0.026], b: ['thigh', 0.06, 0.075, -0.026], r: 0.026 },
  addmagIsch: { a: ['hip', -0.30, -0.045, -0.07], b: ['thigh', 0.69, -0.035, -0.03], r: 0.023 },
  addmagOther: { a: ['hip', -0.17, -0.055, 0.005], b: ['thigh', 0.73, -0.035, 0.01], r: 0.030 },
  addl: { a: ['hip', -0.08, -0.08, 0.04], b: ['thigh', 0.45, -0.035, 0.01], r: 0.026 },
  ilio: { a: ['trunk', 0.3, 0.04, 0.02], b: ['thigh', 0.08, -0.02, 0.02], r: 0.026 },
  gas: { a: ['thigh', 0.92, 0, -0.04], b: ['shank', 1.0, 0, -0.065], r: 0.036 },
  sol: { a: ['shank', 0.2, 0.01, -0.03], b: ['shank', 1.0, 0, -0.06], r: 0.03 },
  ta: { a: ['shank', 0.1, 0.015, 0.025], b: ['shank', 1.05, 0, 0.06], r: 0.02 },
  erec: { a: ['trunk', 0.0, 0.035, -0.07], b: ['trunk', 0.85, 0.04, -0.06], r: 0.035 },
  ra: { a: ['trunk', 0.05, 0.04, 0.1], b: ['trunk', 0.7, 0.05, 0.13], r: 0.026 },
  pecs: { a: ['trunk', 0.72, 0.03, 0.12], b: ['upper', 0.18, 0, 0.02], r: 0.045 },
  pecSternal: { a: ['trunk', 0.72, 0.03, 0.12], b: ['upper', 0.18, 0, 0.02], r: 0.039 },
  pecAbdominal: { a: ['trunk', 0.48, 0.04, 0.11], b: ['upper', 0.18, 0, 0.015], r: 0.018 },
  pecc: { a: ['sh', 0.12, -0.09, 0.07], b: ['upper', 0.16, 0, 0.025], r: 0.03 },
  adelt: { a: ['sh', 0.12, 0.015, 0.04], b: ['upper', 0.42, 0, 0.022], r: 0.032 },
  pdelt: { a: ['sh', 0.12, 0.005, -0.05], b: ['upper', 0.42, 0, -0.022], r: 0.03 },
  lat: { a: ['trunk', 0.25, 0.1, -0.06], b: ['upper', 0.14, 0, 0.012], r: 0.042 },
  latUpper: { a: ['trunk', 0.48, 0.09, -0.07], b: ['upper', 0.14, 0, 0.012], r: 0.029 },
  latLower: { a: ['trunk', 0.16, 0.09, -0.06], b: ['upper', 0.14, 0, 0.012], r: 0.029 },
  trilong: { a: ['sh', -0.12, -0.01, -0.04], b: ['fore', -0.04, 0, -0.03], r: 0.026 },
  trilat: { a: ['upper', 0.3, 0.012, -0.03], b: ['fore', -0.04, 0, -0.03], r: 0.03 },
  bicLong: { a: ['sh', 0.08, 0.027, 0.025], b: ['fore', 0.12, 0.02, 0.022], r: 0.022 },
  bicShort: { a: ['sh', 0.07, -0.035, 0.037], b: ['fore', 0.12, -0.012, 0.025], r: 0.020 },
  brachialis: { a: ['upper', 0.49, 0.001, 0.012], b: ['fore', 0.11, 0.0, 0.01], r: 0.024 },
  brachioradialis: { a: ['upper', 0.46, 0.035, 0.008], b: ['fore', 0.36, 0.04, 0.01], r: 0.016 },
  pronatorTeres: { a: ['upper', 0.89, -0.024, 0.012], b: ['fore', 0.38, 0.024, 0.012], r: 0.016 },
  pronatorQuadratus: { a: ['fore', 0.74, -0.017, 0.008], b: ['fore', 0.87, 0.018, 0.008], r: 0.012 },
  supinator: { a: ['fore', 0.04, 0.020, -0.015], b: ['fore', 0.30, 0.020, 0.014], r: 0.013 },
  tmaj: { a: ['sh', -0.7, -0.07, -0.07], b: ['upper', 0.13, -0.005, 0.0], r: 0.024 },
  corb: { a: ['sh', 0.05, -0.04, 0.05], b: ['upper', 0.45, -0.012, 0.005], r: 0.014 },
  infra: { a: ['sh', -0.3, -0.08, -0.075], b: ['upper', 0.05, 0.01, -0.02], r: 0.026 },
  infraPart: { a: ['sh', -0.3, -0.08, -0.075], b: ['upper', 0.05, 0.01, -0.02], r: 0.023 },
  tmin: { a: ['sh', -0.62, -0.09, -0.075], b: ['upper', 0.05, 0.01, -0.02], r: 0.015 },
  supsp: { a: ['sh', 0.02, -0.04, -0.025], b: ['upper', 0.04, 0.015, -0.015], r: 0.018 },
  subsc: { a: ['sh', -0.3, -0.08, -0.035], b: ['upper', 0.05, -0.01, 0.015], r: 0.022 },
  mdelt: { a: ['sh', 0.1, 0.035, 0], b: ['upper', 0.42, 0.016, 0], r: 0.034 },
  midtrap: { a: ['trunk', 0.84, 0.01, -0.085], b: ['sh', -0.12, -0.1, -0.075], r: 0.03 },
  midtrapPart: { a: ['trunk', 0.84, 0.01, -0.085], b: ['sh', -0.12, -0.1, -0.075], r: 0.022 },
  rhomboid: { a: ['trunk', 0.73, 0.01, -0.07], b: ['sh', -0.55, -0.09, -0.07], r: 0.02 },
  levscap: { a: ['trunk', 1.12, 0.02, -0.05], b: ['sh', -0.60, -0.08, -0.055], r: 0.016 },
  pmin: { a: ['trunk', 0.76, 0.06, 0.08], b: ['sh', -0.25, -0.09, 0.01], r: 0.017 },
  uptrap: { a: ['trunk', 1.13, 0.025, -0.05], b: ['sh', 0.08, -0.05, -0.02], r: 0.03 },
  lowtrap: { a: ['trunk', 0.6, 0.01, -0.09], b: ['sh', -0.12, -0.09, -0.075], r: 0.024 },
  serr: { a: ['trunk', 0.62, 0.12, 0.06], b: ['sh', -0.35, -0.09, -0.05], r: 0.026 },
  serrUpper: { a: ['trunk', 0.80, 0.12, 0.06], b: ['sh', -0.35, -0.09, -0.05], r: 0.018 },
  serrLower: { a: ['trunk', 0.45, 0.12, 0.06], b: ['sh', -0.65, -0.09, -0.05], r: 0.021 },
};

export function frames(pose) {
  const R = pose.R;
  const seg = (a, b, antRef) => {
    const d = norm(sub(b, a));
    let ant = sub(antRef, mul(d, dot(antRef, d)));
    if (len(ant) < 1e-4) ant = sub(pose.f, mul(d, dot(pose.f, d)));
    ant = norm(ant);
    // 外側軸 = 前方 × 骨軸（固定手性）。不可依 x 正負翻轉：翻轉會讓骨頭變成鏡像（拇指、小指對調）
    const lat = norm(cross(ant, d));
    return { a, b, ant, lat };
  };
  const armAnt = mul(pose.armPole || pose.f, -1);
  // 腿的前方：由膝關節鉸鏈軸決定（大腿接近水平時，用腳尖方向會失效）
  const hinge = pose.hinge || norm(cross([0, 1, 0], pose.toeDir));
  const legSeg = (a, b) => {
    const d = norm(sub(b, a));
    const ant = norm(cross(d, hinge));
    const lat = norm(cross(ant, d));
    return { a, b, ant, lat };
  };
  return {
    trunk: { a: pose.Pc, b: pose.SC, ant: pose.f, lat: [1, 0, 0] },
    hip: { a: R.hip, b: add(R.hip, mul(pose.u, 0.2)), ant: pose.f, lat: [1, 0, 0] },
    sh: { a: R.shoulder, b: add(R.shoulder, mul(pose.u, 0.2)), ant: pose.f, lat: [1, 0, 0] },
    thigh: legSeg(R.hip, R.knee),
    shank: legSeg(R.knee, R.ankle),
    upper: seg(R.shoulder, R.elbow, armAnt),
    fore: seg(R.elbow, R.hand, armAnt),
  };
}
const attachPt = (F, s) => {
  const f = F[s[0]];
  return add(add(add(f.a, mul(sub(f.b, f.a), s[1])), mul(f.lat, s[2])), mul(f.ant, s[3]));
};

function spindleGeometry() {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const y = i / 16;
    const r = 0.22 + 0.78 * Math.pow(Math.sin(Math.PI * y), 0.8);
    pts.push(new THREE.Vector2(r, y));
  }
  pts[0].x = 0.001; pts[16].x = 0.001;
  return new THREE.LatheGeometry(pts, 14);
}
const SPINDLE = spindleGeometry();
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
const SPH = new THREE.SphereGeometry(1, 16, 12);

function place(mesh, a, b, r) {
  const va = T(a), vb = T(b);
  const d = vb.clone().sub(va);
  const l = d.length() || 1e-4;
  mesh.position.copy(va);
  mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(l));
  mesh.scale.set(r, l, r);
}

const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);
const _m = new THREE.Matrix4();

// 讀取 BodyParts3D 骨骼（tools/build_bones.py 產生）
export async function loadBones(base = './') {
  const v = '?v=' + MODEL_VERSION; // 骨骼檔跟程式一起換版，避免瀏覽器快取到舊檔
  const meta = await (await fetch(base + 'bones.json' + v)).json();
  const buf = await (await fetch(base + 'bones.bin' + v)).arrayBuffer();
  const pos = new Float32Array(buf, 0, meta._.posBytes / 4);
  const idx = new Uint32Array(buf, meta._.posBytes);
  const geos = {};
  for (const [name, m] of Object.entries(meta)) {
    if (name === '_') continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.slice(m.pos, m.pos + m.nPos * 3), 3));
    g.setIndex(new THREE.BufferAttribute(idx.slice(m.idx, m.idx + m.nIdx), 1));
    g.computeVertexNormals();
    geos[name] = g;
  }
  // 頭頸：把軀幹網格在第七頸椎以上（局部 y > NECK.y）切出來，讓頭可以繞頸部屈曲（例如臀橋時頭貼地）
  const tg = geos.trunk, tp = tg.attributes.position.array, ti = tg.index.array;
  const up = (k) => tp[3 * k + 1] > NECK.y;
  const head = [], body = [];
  for (let i = 0; i < ti.length; i += 3) (up(ti[i]) && up(ti[i + 1]) && up(ti[i + 2]) ? head : body).push(ti[i], ti[i + 1], ti[i + 2]);
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', tg.attributes.position);
  hg.setAttribute('normal', tg.attributes.normal);
  hg.setIndex(head);
  tg.setIndex(body);
  geos.head = hg;
  return { geos, meta };
}

// 頸部轉軸（軀幹局部座標，單位 = 軀幹長）：第七頸椎椎體附近
const NECK = { y: 1.075, z: -0.06 };

export class Rig {
  constructor(scene, { ghost = false } = {}) {
    this.ghost = ghost;
    this.group = new THREE.Group();
    scene.add(this.group);
    const boneMat = ghost
      ? new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.25, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: 0xc9bb9c, roughness: 0.6, metalness: 0.0 });
    this.boneMat = boneMat;
    this.bones = [];
    const B = (a, b, r) => { const m = new THREE.Mesh(CYL, boneMat); this.group.add(m); this.bones.push({ m, a, b, r }); };
    for (const s of ['R', 'L']) {
      B(`${s}.hip`, `${s}.knee`, 0.028); B(`${s}.knee`, `${s}.ankle`, 0.024); B(`${s}.heel`, `${s}.toe`, 0.022);
      B(`${s}.ankle`, `${s}.toe`, 0.016); B(`${s}.shoulder`, `${s}.elbow`, 0.024); B(`${s}.elbow`, `${s}.hand`, 0.02);
      B(`SC`, `${s}.shoulder`, 0.016); B(`Pc`, `${s}.hip`, 0.024);
    }
    B('Pc', 'SC', 0.03);
    this.jointsVis = [];
    for (const k of ['R.hip', 'L.hip', 'R.knee', 'L.knee', 'R.ankle', 'L.ankle', 'R.shoulder', 'L.shoulder', 'R.elbow', 'L.elbow', 'R.hand', 'L.hand']) {
      const m = new THREE.Mesh(SPH, boneMat); this.group.add(m); this.jointsVis.push({ m, k });
    }
    const torsoMat = ghost ? boneMat : new THREE.MeshStandardMaterial({ color: 0x8c8270, transparent: true, opacity: 0.12, roughness: 0.7, depthWrite: false });
    this.rib = new THREE.Mesh(SPH, torsoMat); this.group.add(this.rib);
    // 拱背時以胸廓隆起代理顯示觸胸高度；真實骨架仍無逐節胸椎形變。
    this.archChest = new THREE.Mesh(SPH, new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.75, transparent: true, opacity: 0.78, depthWrite: false }));
    this.group.add(this.archChest);
    this.pelvis = new THREE.Mesh(SPH, torsoMat); this.group.add(this.pelvis);
    this.head = new THREE.Mesh(SPH, ghost ? boneMat : new THREE.MeshStandardMaterial({ color: 0xc4b89f, roughness: 0.6 }));
    this.group.add(this.head);

    // 槓鈴
    const barMat = ghost ? boneMat : new THREE.MeshStandardMaterial({ color: 0x7d8591, metalness: 0.7, roughness: 0.3 });
    const plateMat = ghost ? boneMat : new THREE.MeshStandardMaterial({ color: 0x4b5160, roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0.14, depthWrite: false });
    this.bar = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.2, 12), barMat); shaft.rotation.z = Math.PI / 2;
    this.bar.add(shaft);
    this.shaft = shaft; this.plates = [];
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.07, 32), plateMat);
      p.rotation.z = Math.PI / 2; p.position.x = sx * 0.78; this.bar.add(p);
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 28), plateMat);
      p2.rotation.z = Math.PI / 2; p2.position.x = sx * 0.84; this.bar.add(p2);
      this.plates.push(p, p2);
    }
    this.group.add(this.bar);

    if (!ghost) {
      this.muscles = {};
      for (const m of MUSCLES) {
        const mk = () => {
          const mat = new THREE.MeshStandardMaterial({ color: 0xc3c5cc, roughness: 0.55, transparent: true, opacity: 0.9 });
          const mesh = new THREE.Mesh(SPINDLE, mat);
          mesh.userData.muscle = m.id;
          this.group.add(mesh);
          return mesh;
        };
        this.muscles[m.id] = [mk(), mk()];
      }
      // 關節負擔標記
      this.loadMarks = {};
      for (const k of ['hip', 'knee', 'ankle', 'lumbar', 'shoulder', 'elbow']) {
        const mk = () => {
          const g = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: 0x0891b2, transparent: true, opacity: 0.35, depthWrite: false }));
          this.group.add(g); return g;
        };
        this.loadMarks[k] = k === 'lumbar' ? [mk()] : [mk(), mk()];
      }
      // 點選用的隱形球
      this.pickers = [];
      for (const k of ['hip', 'knee', 'ankle', 'lumbar', 'shoulder', 'elbow', 'hand', 'bar', 'scap']) {
        const g = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ visible: false }));
        g.userData.joint = k; g.scale.setScalar(0.09); this.group.add(g); this.pickers.push(g);
      }
      // 力線
      const lineMat = new THREE.LineBasicMaterial({ color: 0xd97706 });
      this.forceLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat);
      this.group.add(this.forceLine);
      this.armLines = [];
      for (let i = 0; i < 5; i++) {
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
          new THREE.LineDashedMaterial({ color: 0xd97706, dashSize: 0.02, gapSize: 0.015 }));
        this.group.add(l); this.armLines.push(l);
      }
    }
  }

  setVisible(v) { this.group.visible = v; }

  attachBones({ geos, meta }) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.65, metalness: 0, side: THREE.DoubleSide });
    this.boneMeshes = {};
    this.hand = meta._.handRig ? new HandRig(meta._.handRig) : null;
    const handParts = this.hand ? ['ulna', 'radius', 'hand', ...this.hand.segNames] : [];
    for (const name of ['thigh', 'patella', 'shank', 'foot', 'upper', 'trunk', 'head', 'scapula', ...handParts]) {
      const mk = () => { const m = new THREE.Mesh(geos[name], mat); m.matrixAutoUpdate = false; this.group.add(m); return m; };
      this.boneMeshes[name] = name === 'trunk' || name === 'head' ? [mk()] : [mk(), mk()];
    }
    // 真實骨骼取代簡化幾何
    for (const b of this.bones) b.m.visible = false;
    this.bones = this.bones.filter((b) => { if (b.a === 'Pc' || b.a === 'SC') { this.group.remove(b.m); return false; } this.group.remove(b.m); return false; });
    for (const j of this.jointsVis) this.group.remove(j.m);
    this.jointsVis = [];
    for (const o of [this.rib, this.pelvis, this.head]) this.group.remove(o);
  }

  placeBones(pose, F, show, displayFrames = null) {
    const body = pose.body || BODY;
    const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const set = (arr, origin, lat, dir, ant, L, width = L) => {
      _m.makeBasis(V(lat).multiplyScalar(width), V(dir).multiplyScalar(L), V(ant).multiplyScalar(L)).setPosition(V(origin));
      arr[0].matrix.copy(_m);
      if (arr[1]) arr[1].matrix.multiplyMatrices(MIRROR, _m);
      for (const m of arr) { m.matrixWorldNeedsUpdate = true; m.visible = show; }
    };
    for (const k of ['thigh', 'shank', 'upper']) {
      const f = F[k];
      const L = len(sub(f.b, f.a));
      set(this.boneMeshes[k], f.a, f.lat, norm(sub(f.b, f.a)), f.ant, L);
      if (displayFrames && k !== 'upper') {
        for (const [i, side] of ['R', 'L'].entries()) {
          const v = displayFrames[side][k];
          _m.makeBasis(V(v.lat).multiplyScalar(len(sub(v.b, v.a))), V(norm(sub(v.b, v.a))).multiplyScalar(len(sub(v.b, v.a))), V(v.ant).multiplyScalar(len(sub(v.b, v.a)))).setPosition(V(v.a));
          this.boneMeshes[k][i].matrix.copy(i ? new THREE.Matrix4().multiplyMatrices(MIRROR, _m) : _m);
          this.boneMeshes[k][i].matrixWorldNeedsUpdate = true;
        }
      }
    }
    if (this.hand) {
      // 前臂＋手：尺骨跟著前臂座標；橈骨繞旋前軸轉；手掌與手指去握槓
      const f = F.fore;
      _m.makeBasis(T(f.lat), T(norm(sub(f.b, f.a))), T(f.ant)).multiplyScalar(len(sub(f.b, f.a))).setPosition(T(f.a));
      _m.elements[15] = 1;
      const grip = pose.supinated ? -1 : 1; // 右手：正握時小指在外側（+x）
      const barPt = pose.R.grip || [pose.R.hand[0], pose.bar[1], pose.bar[2]];
      const out = this.hand.solve(_m, barPt, grip, pose.R.wrist, pose.gripAxis, pose.foreRot);
      const put = (name, M) => {
        const arr = this.boneMeshes[name];
        arr[0].matrix.copy(M);
        arr[1].matrix.multiplyMatrices(MIRROR, M);
        for (const m of arr) { m.matrixWorldNeedsUpdate = true; m.visible = show; }
      };
      for (const [name, M] of Object.entries(out)) put(name, M);
    }
    // 腳：footUp = 腳底法線（往踝）；平踩地面時 = 正上方（腿推機、腿伸機時腳掌是斜的）
    const t = pose.toeDir, fu = pose.footUp || [0, 1, 0];
    set(this.boneMeshes.foot, pose.R.ankle, norm(cross(fu, t)), fu, t, len(sub(pose.R.knee, pose.R.ankle)));
    if (displayFrames) {
      for (const [i, side] of ['R', 'L'].entries()) {
        const v = pose.visualLegs[side];
        const L = len(sub(v.knee, v.ankle));
        _m.makeBasis(V(norm(cross(fu, t))).multiplyScalar(L), V(fu).multiplyScalar(L), V(t).multiplyScalar(L)).setPosition(V(v.ankle));
        this.boneMeshes.foot[i].matrix.copy(i ? new THREE.Matrix4().multiplyMatrices(MIRROR, _m) : _m);
        this.boneMeshes.foot[i].matrixWorldNeedsUpdate = true;
      }
    }
    set(this.boneMeshes.trunk, pose.Pc, [1, 0, 0], norm(sub(pose.SC, pose.Pc)), pose.f,
      len(sub(pose.SC, pose.Pc)), DEFAULT_BODY.Ltr * body.shHalf / DEFAULT_BODY.shHalf);
    const trunkM = this.boneMeshes.trunk[0].matrix;
    // 頭：繞頸部轉軸屈曲（pose.neckFlex，正 = 下巴往胸口）
    const nf = pose.neckFlex || 0;
    const headM = this.boneMeshes.head[0];
    headM.matrix.copy(trunkM).multiply(new THREE.Matrix4().makeTranslation(0, NECK.y, NECK.z))
      .multiply(new THREE.Matrix4().makeRotationX(nf)).multiply(new THREE.Matrix4().makeTranslation(0, -NECK.y, -NECK.z));
    headM.matrixWorldNeedsUpdate = true; headM.visible = show;
    // 肩帶：繞胸鎖關節旋轉（後收／上提），肩關節跟著移動
    const g = girdleMatrix(pose.girdle || { ret: 0, elev: 0 });
    const c = girdleForBody(body).scj.map((v, i) => v / (i === 0 ? DEFAULT_BODY.Ltr * body.shHalf / DEFAULT_BODY.shHalf : body.Ltr));
    const rot = new THREE.Matrix4().set(g[0][0], g[0][1], g[0][2], 0, g[1][0], g[1][1], g[1][2], 0, g[2][0], g[2][1], g[2][2], 0, 0, 0, 0, 1);
    const loc = new THREE.Matrix4().makeTranslation(c[0], c[1], c[2]).multiply(rot).multiply(new THREE.Matrix4().makeTranslation(-c[0], -c[1], -c[2]));
    const [sR, sL] = this.boneMeshes.scapula;
    sR.matrix.multiplyMatrices(trunkM, loc);
    sL.matrix.multiplyMatrices(MIRROR, sR.matrix);
    // 髕骨：屈膝時沿股骨溝往下、往後滑（約為脛骨轉角的 70%）
    const th = F.thigh, sh = F.shank;
    const kf = Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(th.b, th.a)), norm(sub(sh.b, sh.a))))));
    const pl = new THREE.Matrix4().makeTranslation(0, 1, 0).multiply(new THREE.Matrix4().makeRotationX(-0.7 * kf)).multiply(new THREE.Matrix4().makeTranslation(0, -1, 0));
    const [pR, pL] = this.boneMeshes.patella;
    pR.matrix.multiplyMatrices(this.boneMeshes.thigh[0].matrix, pl);
    pL.matrix.multiplyMatrices(MIRROR, pR.matrix);
    if (displayFrames) {
      for (const [i, side] of ['R', 'L'].entries()) {
        const thigh = displayFrames[side].thigh, shank = displayFrames[side].shank;
        const flex = Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(thigh.b, thigh.a)), norm(sub(shank.b, shank.a))))));
        const patellaLocal = new THREE.Matrix4().makeTranslation(0, 1, 0).multiply(new THREE.Matrix4().makeRotationX(-0.7 * flex)).multiply(new THREE.Matrix4().makeTranslation(0, -1, 0));
        this.boneMeshes.patella[i].matrix.copy(this.boneMeshes.thigh[i].matrix).multiply(patellaLocal);
      }
    }
    for (const m of [sR, sL, pR, pL]) { m.matrixWorldNeedsUpdate = true; m.visible = show; }
  }

  get(pose, key) {
    if (key === 'Pc') return pose.Pc;
    if (key === 'SC') return pose.SC;
    const [s, j] = key.split('.');
    const p = pose.visualLegs?.[s]?.[j] || pose.R[j];
    return s === 'R' ? p : mirror(p);
  }

  update(pose, opt = {}) {
    const body = pose.body || BODY;
    const heightScale = body.heightM / DEFAULT_BODY.heightM;
    const trunkScale = body.Ltr / DEFAULT_BODY.Ltr;
    const { layers = {}, colors = {}, jointLoad = {}, rom = {}, liftSet = null, armLines = [] } = opt;
    const showSkel = layers.skeleton !== false;
    for (const b of this.bones) {
      b.m.visible = showSkel;
      place(b.m, this.get(pose, b.a), this.get(pose, b.b), b.r);
    }
    for (const j of this.jointsVis) {
      j.m.visible = showSkel;
      j.m.position.copy(T(this.get(pose, j.k)));
      j.m.scale.setScalar(0.032);
    }
    const ribC = add(pose.Pc, mul(pose.u, 0.36 * trunkScale));
    this.rib.position.copy(T(ribC));
    this.rib.quaternion.setFromUnitVectors(Y, T(pose.u));
    this.rib.scale.set(0.15 * body.shHalf / DEFAULT_BODY.shHalf, 0.2 * trunkScale, 0.11 * heightScale);
    this.pelvis.position.copy(T(add(pose.Pc, mul(pose.u, 0.03))));
    this.pelvis.quaternion.copy(this.rib.quaternion);
    this.pelvis.scale.set(0.16 * body.hipHalf / DEFAULT_BODY.hipHalf, 0.09 * heightScale, 0.1 * heightScale);
    this.head.position.copy(T(add(pose.SC, mul(pose.u, 0.23 * heightScale))));
    this.head.scale.set(0.085 * heightScale, 0.11 * heightScale, 0.1 * heightScale);
    this.rib.visible = showSkel; this.pelvis.visible = false;
    if (pose.chestArch && showSkel) {
      const { touch, lift } = pose.chestArch;
      const ry = 0.04 * heightScale + 0.7 * lift;
      this.archChest.position.set(0, touch[1] - ry, touch[2]);
      this.archChest.scale.set(0.17 * body.shHalf / DEFAULT_BODY.shHalf, ry, 0.15 * heightScale);
      this.archChest.visible = true;
    } else this.archChest.visible = false;
    this.bar.position.copy(T(pose.bar));
    // 器械：barStyle = 'none'（沒有槓）或 { len }（短握把、沒有槓片）
    const bs = pose.barStyle;
    this.bar.visible = bs !== 'none';
    for (const pl of this.plates) pl.visible = !bs;
    this.shaft.scale.y = bs && bs.len ? bs.len / 2.2 : 1;

    if (this.ghost) return;
    const F = frames(pose);
    const displayFrames = pose.visualLegs ? Object.fromEntries(['R', 'L'].map((side) =>
      [side, frames({ ...pose, R: { ...pose.R, ...pose.visualLegs[side] } })])) : null;
    if (this.boneMeshes) this.placeBones(pose, F, showSkel, displayFrames);
    for (const m of MUSCLES) {
      const at = ATTACH[m.id];
      const pa = attachPt(displayFrames?.R || F, at.a), pb = attachPt(displayFrames?.R || F, at.b);
      const la = attachPt(displayFrames?.L || F, at.a), lb = attachPt(displayFrames?.L || F, at.b);
      const [mr, ml] = this.muscles[m.id];
      const c = colors[m.id];
      const inLift = !liftSet || liftSet.has(m.id);
      for (const [mesh, A, Bp] of [[mr, pa, pb], [ml, mirror(la), mirror(lb)]]) {
        mesh.visible = layers.muscles !== false;
        place(mesh, A, Bp, at.r);
        if (c && inLift) { mesh.material.color.copy(c); mesh.material.opacity = 0.9; mesh.material.emissive?.setRGB(c.r * 0.08, c.g * 0.08, c.b * 0.08); }
        else { mesh.material.color.setHex(0xc3c5cc); mesh.material.opacity = inLift ? 0.9 : 0.35; mesh.material.emissive?.setRGB(0, 0, 0); }
      }
    }
    // 關節負擔
    const R = pose.R;
    const jp = { hip: R.hip, knee: R.knee, ankle: R.ankle, shoulder: R.shoulder, elbow: R.elbow, lumbar: add(pose.Pc, mul(pose.u, 0.05)) };
    for (const [k, arr] of Object.entries(this.loadMarks)) {
      const v = jointLoad[k];
      const show = layers.joints && v !== undefined;
      arr.forEach((g, i) => {
        g.visible = !!show;
        if (!show) return;
        const footJoint = pose.visualLegs?.[i === 0 ? 'R' : 'L']?.[k];
        const p = footJoint ? (i === 0 ? footJoint : mirror(footJoint)) : (i === 0 ? jp[k] : mirror(jp[k]));
        g.position.copy(T(k === 'lumbar' ? add(p, mul(pose.f, -0.12)) : p));
        g.scale.setScalar(0.035 + 0.045 * v);
        g.material.color.setHex(rom[k] ? 0xc026d3 : 0x0891b2);
        g.material.opacity = 0.18 + 0.3 * v;
      });
    }
    // 點選
    const pk = { ...jp, hand: R.hand, bar: pose.bar, scap: add(add(R.shoulder, mul(pose.f, -0.08)), [-0.07, 0, 0]) };
    for (const g of this.pickers) g.position.copy(T(pk[g.userData.joint]));
    // 力線
    const fl = layers.forceLine;
    this.forceLine.visible = !!fl;
    this.armLines.forEach((l, i) => {
      const a = armLines[i];
      l.visible = !!fl && !!a;
      if (l.visible) { l.geometry.setFromPoints([T(a[0]), T(a[1])]); l.computeLineDistances(); }
    });
    if (fl) {
      // 力線：臀推等兩點支撐的動作畫腳底反作用力（從壓力中心往上），其他畫槓的垂直線
      const grf = pose.lineZ !== undefined && pose.cop;
      const base = pose.supine ? R.hand : grf ? pose.cop : pose.bar;
      let top = [base[0], grf ? 0.75 : base[1] + 0.35, base[2]];
      let bot = [base[0], pose.supine ? base[1] - 0.25 : grf ? base[1] : 0, base[2]];
      // 器械／滑輪：沿外力方向畫（pose.forceLine = { p, d }）
      if (pose.forceLine) { const { p, d } = pose.forceLine; top = add(p, mul(d, -0.45)); bot = add(p, mul(d, 0.45)); }
      this.forceLine.geometry.setFromPoints([T(top), T(bot)]);
    }
  }
}

// ---------- 手：旋前、手腕、手指包覆槓 ----------
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const deg2rad = Math.PI / 180;
// 前臂旋轉範圍（從完全旋後算起）：旋前約 165°、旋後再多 5°
// 槓在掌心的斜角範圍與手腕尺偏目標（握力抓握時手腕自然略尺偏）
const GAMMA_MIN = -35 * deg2rad, GAMMA_MAX = 30 * deg2rad, ULN_TARGET = 5 * deg2rad;
const PSI_MIN = -165 * deg2rad, PSI_MAX = 5 * deg2rad, PSI_WRAP = 60 * deg2rad;
// 線段 pq 到直線（點 c、單位方向 u）的最短距離
function segLineDist(p, q, c, u) {
  const d = q.clone().sub(p), w = p.clone().sub(c);
  const a = d.dot(d), b = d.dot(u), e = w.dot(u), dd = d.dot(w);
  const den = a - b * b; // u 為單位向量
  let s = den > 1e-12 ? (b * e - dd) / den : 0;
  s = Math.max(0, Math.min(1, s));
  const x = p.clone().addScaledVector(d, s).sub(c);
  return x.sub(u.clone().multiplyScalar(x.dot(u))).length();
}
export class HandRig {
  constructor(h) {
    this.W = V3(h.W); this.G = V3(h.G); this.t = V3(h.t).normalize(); this.palmN = V3(h.palmN).normalize();
    this.p0 = V3(h.pro[0]); this.k = V3(h.pro[1]).sub(this.p0).normalize();
    this.digits = h.digits.map((d) => ({
      segs: d.segs, joints: d.joints.map(V3), tip: V3(d.tip), axis: d.axis && V3(d.axis).normalize(),
      lim: d.lim.map(([a, b]) => [a * deg2rad, b * deg2rad]),
    }));
    this.segNames = this.digits.flatMap((d) => d.segs);
    this.mcp = this.digits.slice(1).reduce((a, d) => a.add(d.joints[0]), new THREE.Vector3()).multiplyScalar(1 / 4);
    this.gamma = 0;
    this.pd = this.G.clone().sub(this.mcp);
    this.palmPts = [this.W, ...this.digits.map((d) => d.joints[0])]; // 手腕、拇指腕掌關節、四個掌骨頭 // 掌側偏移（槓中心離掌骨頭連線的距離）
    this.psi = -Math.PI * 0.8;
    this.out = Object.fromEntries(['ulna', 'radius', 'hand', ...this.segNames].map((n) => [n, new THREE.Matrix4()]));
  }
  // 局部座標裡繞「通過 p、方向 a」的軸轉 th
  static rotAbout(p, a, th) {
    return new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationAxis(a, th)).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
  }
  // 給定槓在掌心的斜角 gamma：求手掌朝向 Q 與橈骨旋前角 psi，回傳手腕的尺偏角
  palm(ctx, gamma) {
    const { out } = this;
    const { foreM, Fn, Finv, B, grip, F0 } = ctx;
    // 槓在手上的方向：垂直手軸、往掌骨頭連線（小指側較近端，約斜 23°）偏 gamma
    const h = this.mcp.clone().sub(this.W).normalize();
    const tp = this.t.clone().addScaledVector(h, -this.t.dot(h)).normalize();
    const tLoc = tp.multiplyScalar(Math.cos(gamma)).addScaledVector(h, Math.sin(gamma) * Math.sign(this.t.dot(h))).normalize();
    const proj = (v, ax) => v.clone().addScaledVector(ax, -v.dot(ax)).normalize();
    const radiusAt = (psi) => out.radius.copy(foreM).multiply(HandRig.rotAbout(this.p0, this.k, psi));
    let Q = new THREE.Matrix4();
    for (let it = 0; it < 3; it++) {
      // 1) 橈骨旋前 psi（0 = 解剖姿勢的完全旋後，負值 = 旋前）
      radiusAt(this.psi);
      const W = this.W.clone().applyMatrix4(out.radius);
      // 槓在掌心的深度：依手腕到槓的實際距離，從掌根（s≈0.4）滑到掌骨頭（s=1）
      const D = B.distanceTo(W) / ctx.L;
      const m = this.mcp.clone().sub(this.W), qa = m.lengthSq(), qb = 2 * m.dot(this.pd), qc = this.pd.lengthSq() - D * D;
      const sP = Math.max(0.4, Math.min(1.1, (-qb + Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc))) / (2 * qa)));
      const uLoc = m.multiplyScalar(sP).add(this.pd);
      this.pocket = sP;
      // 2) 手掌：槓沿 tLoc 斜躺在掌心；W 到槓的垂足方向對齊
      const a2 = tLoc.clone().applyMatrix3(Fn).normalize();
      const a1 = uLoc.clone().applyMatrix3(Fn); a1.addScaledVector(a2, -a1.dot(a2)).normalize();
      const v2 = ctx.axis.clone().multiplyScalar(grip);
      const v1 = B.clone().sub(W); v1.addScaledVector(v2, -v1.dot(v2)).normalize();
      const A = new THREE.Matrix4().makeBasis(a1, a2, a1.clone().cross(a2));
      const Vb = new THREE.Matrix4().makeBasis(v1, v2, v1.clone().cross(v2));
      Q = Vb.multiply(A.transpose()); // 純旋轉，把前臂方向的手轉到握槓方向
      // 3) 需要的旋前角：讓橈骨遠端的掌側方向跟手掌一致
      const nW = this.palmN.clone().applyMatrix3(Fn).applyMatrix4(Q).normalize();
      const n1 = proj(nW.clone().applyMatrix3(Finv), this.k), n0 = proj(this.palmN, this.k);
      let psi = Math.atan2(n0.clone().cross(n1).dot(this.k), n0.dot(n1));
      if (psi > PSI_WRAP) psi -= 2 * Math.PI;
      this.psiWant = psi;
      this.psi = this.targetPsi === null ? Math.max(PSI_MIN, Math.min(PSI_MAX, psi)) : this.targetPsi;
      if (this.psi !== psi) {
        // 超過前臂旋轉範圍：手掌沿著 W→槓 的軸轉回來，槓更斜地躺在掌心
        const nR = this.palmN.clone().applyMatrix4(new THREE.Matrix4().makeRotationAxis(this.k, this.psi)).applyMatrix3(Fn).normalize();
        const p0 = proj(nW, v1), p1 = proj(nR, v1);
        Q.premultiply(new THREE.Matrix4().makeRotationAxis(v1, Math.atan2(p0.clone().cross(p1).dot(v1), p0.dot(p1))));
      }
    }
    radiusAt(this.psi);
    const W = this.W.clone().applyMatrix4(out.radius);
    out.hand.makeTranslation(W.x, W.y, W.z).multiply(Q).multiply(F0)
      .multiply(new THREE.Matrix4().makeTranslation(-this.W.x, -this.W.y, -this.W.z));
    return this.wrist();
  }
  // 手腕角度（相對橈骨、解剖姿勢為 0）：ext = 背伸、uln = 尺偏，單位 rad
  wrist() {
    const rel = this.out.radius.clone().invert().multiply(this.out.hand);
    const h0 = this.mcp.clone().sub(this.W).normalize();
    const h1 = this.mcp.clone().applyMatrix4(rel).sub(this.W.clone().applyMatrix4(rel)).normalize();
    const tp = this.t.clone().addScaledVector(h0, -this.t.dot(h0)).normalize();
    const pn = this.palmN.clone().addScaledVector(h0, -this.palmN.dot(h0)).addScaledVector(tp, -this.palmN.dot(tp)).normalize();
    return { ext: Math.atan2(-h1.dot(pn), h1.dot(h0)), uln: Math.atan2(h1.dot(tp), h1.dot(h0)) };
  }
  solve(foreM0, barPt, grip, wristPt, gripAxis = null, foreRot = null) {
    const { out } = this;
    // 畫面零點採完全旋後；力學零點採旋前／旋後中立，兩端對齊約 165° 手掌活動範圍。
    this.targetPsi = foreRot === null || foreRot === undefined ? null
      : Math.max(PSI_MIN, Math.min(PSI_MAX, -(foreRot + 80 * deg2rad) * 165 / 160));
    const axis = gripAxis ? V3(gripAxis).normalize() : new THREE.Vector3(1, 0, 0);
    const mk = (fm) => {
      const L = new THREE.Vector3().setFromMatrixColumn(fm, 0).length();
      const Fn = new THREE.Matrix3().setFromMatrix4(fm).multiplyScalar(1 / L); // 正交（行列式可能為 -1）
      return { foreM: fm, L, Fn, Finv: Fn.clone().transpose(), B: V3(barPt), grip, axis, F0: fm.clone().setPosition(0, 0, 0) };
    };
    // 前臂旋前時橈骨遠端（手腕）會繞尺骨頭轉開好幾公分；把整支前臂繞肘關節轉一點，讓手腕回到該在的位置
    // （力學模型的握點固定在尺骨座標，沒有跟著旋前移動）
    const E = new THREE.Vector3().setFromMatrixPosition(foreM0);
    const place = (Wd) => {
      let fm = foreM0.clone(), c = mk(fm);
      for (let it = 0; it < 3; it++) {
        this.palm(c, this.gamma);
        const Wa = this.W.clone().applyMatrix4(out.radius);
        const q = new THREE.Quaternion().setFromUnitVectors(Wa.sub(E).normalize(), Wd.clone().sub(E).normalize());
        fm = new THREE.Matrix4().makeTranslation(E.x, E.y, E.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
          .multiply(new THREE.Matrix4().makeTranslation(-E.x, -E.y, -E.z)).multiply(fm);
        c = mk(fm);
      }
      return c;
    };
    let Wd = wristPt ? V3(wristPt) : this.W.clone().applyMatrix4(foreM0);
    if (wristPt) {
      // 手腕折彎的握法：手腕可以在「離肘 Lw、離槓 Lh」的一圈上任選。力學給的位置只是參考，
      // 這裡挑前臂旋轉、手腕角度都在活動範圍內的那一點（不然手會被扭成不可能的角度）
      const B0 = V3(barPt), ax = B0.clone().sub(E), dd = ax.length(); ax.normalize();
      const Lw = Wd.distanceTo(E), Lh = Wd.distanceTo(B0);
      const a = (Lw * Lw - Lh * Lh + dd * dd) / (2 * dd), r = Math.sqrt(Math.max(0, Lw * Lw - a * a));
      const c0 = E.clone().addScaledVector(ax, a);
      const u1 = Wd.clone().sub(c0); u1.addScaledVector(ax, -u1.dot(ax)).normalize();
      const u2 = ax.clone().cross(u1);
      const at = (th) => c0.clone().addScaledVector(u1, r * Math.cos(th)).addScaledVector(u2, r * Math.sin(th));
      const save = [this.psi, this.gamma];
      const cost = (th) => {
        [this.psi, this.gamma] = save;
        const c = place(at(th));
        let w = this.palm(c, this.gamma);
        // 槓在掌心的斜角可以吸收一部分偏移：估一個 gamma 再算一次
        const g = Math.max(GAMMA_MIN, Math.min(GAMMA_MAX, this.gamma + (w.uln - ULN_TARGET) / 1.2));
        w = this.palm(c, g);
        const over = (x, lo, hi) => (x < lo ? lo - x : x > hi ? x - hi : 0);
        // 手掌（拇指根、各掌骨頭）不能穿進槓：骨軸離槓中心至少 22 mm
        let clip = 0;
        for (const p of this.palmPts) {
          const v = p.clone().applyMatrix4(out.hand).sub(B0); v.x = 0;
          clip += Math.max(0, 0.022 - v.length());
        }
        return 40 * clip + 3 * Math.abs(this.psiWant - this.psi) + over(w.uln, -20 * deg2rad, 30 * deg2rad) * 2
          + over(w.ext, -10 * deg2rad, 70 * deg2rad) * 2 + 0.3 * Math.abs(th) / Math.PI;
      };
      let best = 0, bc = Infinity;
      for (let k = -8; k < 8; k++) { const th = (k * Math.PI) / 8, v = cost(th); if (v < bc) { bc = v; best = th; } }
      for (const step of [Math.PI / 16, Math.PI / 32]) {
        for (const th of [best - step, best + step]) { const v = cost(th); if (v < bc) { bc = v; best = th; } }
      }
      [this.psi, this.gamma] = save;
      Wd = at(best);
      this.wristTheta = best;
    }
    const ctx = place(Wd);
    const foreM = ctx.foreM;
    out.ulna = foreM;
    const L = ctx.L, B = ctx.B;
    // 槓在掌心的斜角 gamma：讓手腕尺偏接近 ULN_TARGET（割線法，從上一幀的值開始）
    const clampG = (g) => Math.max(GAMMA_MIN, Math.min(GAMMA_MAX, g));
    let g0 = clampG(this.gamma), f0 = this.palm(ctx, g0).uln - ULN_TARGET;
    let g1 = clampG(g0 + (f0 > 0 ? 6 : -6) * deg2rad), f1 = this.palm(ctx, g1).uln - ULN_TARGET;
    for (let it = 0; it < 4 && Math.abs(f1) > 1.5 * deg2rad && Math.abs(f1 - f0) > 1e-6; it++) {
      const g2 = clampG(g1 - (f1 * (g1 - g0)) / (f1 - f0));
      if (g2 === g1) break;
      g0 = g1; f0 = f1; g1 = g2; f1 = this.palm(ctx, g1).uln - ULN_TARGET;
    }
    this.gamma = g1;
    this.wristAng = this.palm(ctx, g1);
    // 4) 手指：在手的局部座標裡，一節一節往掌側彎，直到碰到槓
    const inv = out.hand.clone().invert();
    const c = B.clone().applyMatrix4(inv);
    const u = B.clone().add(ctx.axis).applyMatrix4(inv).sub(c).normalize();
    const R = 0.023 / L; // 槓半徑 14 mm + 手指掌側軟組織 9 mm
    for (const d of this.digits) {
      let M = new THREE.Matrix4(); // 累積的局部轉動
      const pts = [...d.joints, d.tip];
      for (let i = 0; i < d.segs.length; i++) {
        const p = pts[i].clone().applyMatrix4(M), q0 = pts[i + 1].clone().applyMatrix4(M);
        let ax;
        if (d.axis) ax = d.axis.clone().transformDirection(M);
        else {
          // 拇指：在垂直槓的平面內、往槓的方向捲（從另一側包住槓）
          const w = p.clone().sub(c); w.addScaledVector(u, -w.dot(u)).negate();
          ax = u.clone().multiplyScalar(Math.sign(q0.clone().sub(p).cross(w).dot(u)) || 1);
        }
        const [lo, hi] = d.lim[i];
        const distAt = (th) => segLineDist(p, q0.clone().sub(p).applyAxisAngle(ax, th).add(p), c, u);
        let th = hi;
        if (distAt(lo) <= R) {
          let best = -1;
          for (let x = lo; x <= hi + 1e-6; x += 5 * deg2rad) { const dd = distAt(x); if (dd > best) { best = dd; th = x; } }
        } else {
          let prev = lo;
          for (let x = lo + 3 * deg2rad; x <= hi + 1e-6; x += 3 * deg2rad) {
            if (distAt(x) <= R) {
              let a = prev, b = x;
              for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (distAt(m) <= R) b = m; else a = m; }
              th = a; break;
            }
            prev = x;
          }
        }
        M = HandRig.rotAbout(p, ax, th).multiply(M);
        out[d.segs[i]].copy(out.hand).multiply(M);
      }
    }
    return out;
  }
}

// 熱力色階（inferno 風格）
const HEAT = [[0, 0xc3c5cc], [0.25, 0xf6d55c], [0.5, 0xf28c28], [0.75, 0xd7301f], [1, 0x8b0000]].map(([t, c]) => [t, new THREE.Color(c)]);
export function heatColor(v) {
  v = Math.max(0, Math.min(1, v));
  for (let i = 1; i < HEAT.length; i++) {
    if (v <= HEAT[i][0]) {
      const [t0, c0] = HEAT[i - 1], [t1, c1] = HEAT[i];
      return c0.clone().lerp(c1, (v - t0) / (t1 - t0));
    }
  }
  return HEAT[HEAT.length - 1][1].clone();
}
const DNEG = new THREE.Color(0x3b82f6), DZ = new THREE.Color(0xc3c5cc), DPOS = new THREE.Color(0xef4444);
export function diffColor(v) { // v ∈ [-1, 1]
  v = Math.max(-1, Math.min(1, v));
  return v < 0 ? DZ.clone().lerp(DNEG, -v) : DZ.clone().lerp(DPOS, v);
}
const LS = new THREE.Color(0x2563eb), LM = new THREE.Color(0xc3c5cc), LL = new THREE.Color(0x16a34a);
export function lengthColor(l) {
  if (l < 1) return LM.clone().lerp(LS, Math.min(1, (1 - l) / 0.2));
  return LM.clone().lerp(LL, Math.min(1, (l - 1) / 0.35));
}
