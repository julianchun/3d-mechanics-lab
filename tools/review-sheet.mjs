#!/usr/bin/env node
// 產生所有已實作動作的三視角截圖總覽（review/index.html + review/img/*.png）
// 用法：
//   node tools/review-sheet.mjs              # 自動啟動 port 5191 的 vite 開發伺服器
//   node tools/review-sheet.mjs --url http://localhost:5191/
//   node tools/review-sheet.mjs --publish    # 同步複製到 dist/review/（不重啟 4173）
//   node tools/review-sheet.mjs --port 5196 --resume  # 同一版程式中斷後沿用已完成圖片

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { CATALOG, CATEGORIES, EQUIPMENT } from '../src/catalog.js';
import { LIFTS, MUSCLE_BY_ID, MODEL_VERSION, defaultParams, analyze, peakAnalysis } from '../src/biomech.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REVIEW_DIR = path.join(ROOT, 'review');
const IMG_DIR = path.join(REVIEW_DIR, 'img');
const DEFAULT_PORT = 5191;
// 可用 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH 指定瀏覽器；沒指定時用 Playwright 自己安裝的版本
const DEFAULT_CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || null;
// 4173 是 vite preview（正式預覽站），不能拿來截圖：那裡沒有開發用的 window.__mm
const RESERVED_PORTS = new Set([4173]);

// 載入 Playwright（標準路徑，其次 NODE_PATH）
const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [
    'playwright',
    ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter).map((d) => path.join(d, 'playwright')) : []),
  ];
  for (const p of candidates) {
    try { return require(p); } catch {}
  }
  throw new Error('找不到 playwright：請先 `npm install --no-save playwright && npx playwright install chromium`，或用 NODE_PATH 指向已安裝的位置。');
}

function parseArgs(argv) {
  const opts = { url: null, port: DEFAULT_PORT, publish: false, resume: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--publish') opts.publish = true;
    else if (a === '--resume') opts.resume = true;
    else if (a === '--url' && argv[i + 1]) opts.url = argv[++i];
    else if (a.startsWith('--url=')) opts.url = a.slice(6);
    else if (a === '--port' && argv[i + 1]) opts.port = Number(argv[++i]);
    else if (a.startsWith('--port=')) opts.port = Number(a.slice(7));
    else if (a === '-h' || a === '--help') {
      console.log('用法: node tools/review-sheet.mjs [--url <URL>] [--port 5191] [--publish] [--resume]');
      process.exit(0);
    } else {
      throw new Error(`未知參數：${a}`);
    }
  }
  if (RESERVED_PORTS.has(opts.port)) throw new Error(`port ${opts.port} 保留給正式預覽站，請改用其他 port`);
  if (opts.url) {
    const u = new URL(opts.url);
    if (RESERVED_PORTS.has(Number(u.port))) throw new Error(`${opts.url} 是正式預覽站，請改用開發伺服器`);
  }
  return opts;
}

// child：自己啟動的 vite；它提早結束（例如 port 被占用）就立刻失敗，避免截到別的伺服器
async function waitForServer(url, timeoutMs = 20000, child = null) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(`vite 沒有啟動成功（exit ${child.exitCode}），port 可能已被占用`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`等待開發伺服器逾時：${url}`);
}

function startVite(port) {
  // 使用 detached 讓整個子行程群組能用負 PID 精準關閉，避免誤觸其他 vite（例如 4173）
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('exit', (code) => {
    if (code && !child._stopping) {
      console.error(`vite 意外結束 (code=${code}):\n${stderr}`);
    }
  });
  return child;
}

function stopVite(child) {
  if (!child || !child.pid) return;
  child._stopping = true;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {
    try { child.kill('SIGTERM'); } catch {}
  }
  setTimeout(() => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }, 1500).unref();
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// 將只有數值不同的同類警告合併，保留數值最大（最嚴重）的那一筆
function dedupeWarns(messages) {
  const best = new Map();
  for (const msg of messages) {
    const key = msg.replace(/\d+(?:\.\d+)?/g, '#');
    const nums = [...msg.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    const score = nums.length ? Math.max(...nums) : 0;
    const prev = best.get(key);
    if (!prev || score > prev.score) best.set(key, { msg, score });
  }
  return [...best.values()].map((x) => x.msg);
}

// 用 Node 端 biomech.js 計算峰值前四名肌肉與整個行程可能出現的警告
function analyzeItem(entry) {
  const P = { ...defaultParams(entry.lift), ...entry.set };
  const pk = peakAnalysis(entry.lift, P);
  const musEntries = Object.entries(pk.mus).sort((a, b) => b[1].s - a[1].s);
  const maxS = Math.max(1e-6, musEntries[0]?.[1].s || 0);
  const topMuscles = musEntries.slice(0, 4).map(([id, v]) => ({
    id,
    name: MUSCLE_BY_ID[id]?.name || id,
    s: v.s,
    pct: Math.round((v.s / maxS) * 100),
    len: v.len,
  }));

  // 蒐集頂點、最低點與過程中的姿勢警告與關節活動度末端提示
  const rawWarns = [];
  const romSet = new Set();
  for (let i = 0; i <= 20; i++) {
    const r = analyze(entry.lift, P, i / 20);
    for (const w of r.pose.warn) rawWarns.push(w);
    for (const msg of Object.values(r.rom)) romSet.add(msg);
  }
  return {
    topMuscles,
    modelWarns: dedupeWarns(rawWarns),
    romWarns: [...romSet],
  };
}

function buildHtml(rows, meta) {
  const eqName = Object.fromEntries(EQUIPMENT);
  const grouped = CATEGORIES.map(([catId, catLabel]) => ({
    catId,
    catLabel,
    items: rows.filter((r) => r.entry.cat === catId),
  })).filter((g) => g.items.length > 0);

  const warnCount = rows.filter((r) => r.warns.length > 0).length;

  const navLinks = grouped.map((g) =>
    `<a href="#cat-${escHtml(g.catId)}">${escHtml(g.catLabel)} <span>${g.items.length}</span></a>`
  ).join('\n      ');

  const sectionsHtml = grouped.map((g) => {
    const rowsHtml = g.items.map((r) => {
      const { entry, shots, topMuscles, warns, romWarns } = r;
      const L = LIFTS[entry.lift];
      const topLbl = L.topLabel || '頂點';
      const botLbl = L.bottomLabel || '最低點';

      const imgsHtml = shots.map((sh) => `
          <figure class="shot">
            <img src="${escHtml(sh.relPath)}" alt="${escHtml(entry.name)} ${escHtml(sh.label)}" loading="lazy" data-full="${escHtml(sh.relPath)}" data-cap="${escHtml(entry.name)} — ${escHtml(sh.label)}" />
            <figcaption>${escHtml(sh.label)}</figcaption>
          </figure>`).join('');

      const musHtml = topMuscles.map((m, idx) => `
            <li>
              <span class="rank">${idx + 1}</span>
              <span class="mname">${escHtml(m.name)}</span>
              <span class="mpct" title="張力比 s = ${m.s.toFixed(2)}">${m.pct}%</span>
              <span class="mbar"><i style="width:${m.pct}%"></i></span>
            </li>`).join('');

      const warnHtml = warns.length
        ? warns.map((w) => `<div class="warn-item">⚠ ${escHtml(w)}</div>`).join('')
        : '<div class="warn-none">無姿勢警告</div>';

      const romHtml = romWarns.length
        ? `<div class="rom-list">${romWarns.map((w) => `<span class="rom-tag">${escHtml(w)}</span>`).join('')}</div>`
        : '';

      return `
      <article class="card" id="item-${escHtml(entry.id)}" data-has-warn="${warns.length > 0 ? '1' : '0'}">
        <div class="meta">
          <div class="title-row">
            <h3>${escHtml(entry.name)}</h3>
            <span class="eq-badge">${escHtml(eqName[entry.equip] || entry.equip)}</span>
          </div>
          <div class="sub"><code>${escHtml(entry.id)}</code> · 頂點：${escHtml(topLbl)} ／ 最低點：${escHtml(botLbl)}</div>
          <div class="block">
            <div class="block-hd">峰值前四名肌肉（模型估計）</div>
            <ol class="mus-list">${musHtml}
            </ol>
          </div>
          <div class="block">
            <div class="block-hd">警告訊息</div>
            <div class="warns">${warnHtml}</div>
            ${romHtml}
          </div>
        </div>
        <div class="shots">${imgsHtml}
        </div>
      </article>`;
    }).join('\n');

    return `
    <section class="cat-sec" id="cat-${escHtml(g.catId)}">
      <h2>${escHtml(g.catLabel)} <span class="cnt">${g.items.length} 個動作</span></h2>
      ${rowsHtml}
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>動作姿勢總覽（教練檢查表）</title>
  <style>
    :root {
      --bg: #f5f3ee; --card: #ffffff; --line: #e2ddd4; --text: #1f2328; --muted: #6b7280;
      --accent: #ea7a1a; --warn-bg: #fef3c7; --warn-fg: #92400e; --rom-bg: #fae8ff; --rom-fg: #86198f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: var(--bg); color: var(--text);
      font-family: -apple-system, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif;
      font-size: 14px; line-height: 1.45;
    }
    header {
      position: sticky; top: 0; z-index: 10;
      background: rgba(245, 243, 238, 0.95); backdrop-filter: blur(6px);
      border-bottom: 1px solid var(--line); padding: 12px 20px;
    }
    .hd-top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; }
    h1 { margin: 0; font-size: 20px; }
    .stats { color: var(--muted); font-size: 12px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .nav { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; align-items: center; }
    .nav a, .filter-btn {
      text-decoration: none; color: var(--text); background: var(--card);
      border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font-size: 12px;
      cursor: pointer; font-family: inherit;
    }
    .nav a span { color: var(--muted); margin-left: 2px; }
    .nav a:hover, .filter-btn:hover { border-color: var(--accent); color: var(--accent); }
    .filter-btn.on { background: var(--accent); border-color: var(--accent); color: #fff; }
    main { max-width: 1560px; margin: 0 auto; padding: 16px 20px 48px; }
    .cat-sec { margin-bottom: 28px; scroll-margin-top: 96px; }
    .cat-sec h2 {
      margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--line);
      font-size: 17px; display: flex; align-items: baseline; gap: 8px;
    }
    .cat-sec h2 .cnt { font-size: 12px; font-weight: 400; color: var(--muted); }
    .card {
      display: grid; grid-template-columns: 300px 1fr; gap: 16px;
      background: var(--card); border: 1px solid var(--line); border-radius: 12px;
      padding: 14px; margin-bottom: 14px; align-items: start;
    }
    .card.hidden { display: none; }
    .title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .card h3 { margin: 0; font-size: 16px; }
    .eq-badge {
      font-size: 11px; color: var(--muted); border: 1px solid var(--line);
      border-radius: 999px; padding: 1px 8px; white-space: nowrap;
    }
    .sub { font-size: 12px; color: var(--muted); margin: 3px 0 10px; }
    .sub code { background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
    .block { margin-top: 10px; }
    .block-hd { font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
    .mus-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
    .mus-list li { display: grid; grid-template-columns: 16px 1fr auto; gap: 2px 6px; align-items: center; font-size: 12px; }
    .mus-list .rank { color: var(--muted); font-variant-numeric: tabular-nums; }
    .mus-list .mname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mus-list .mpct { font-variant-numeric: tabular-nums; font-weight: 600; }
    .mus-list .mbar { grid-column: 2 / 4; height: 4px; background: var(--line); border-radius: 2px; overflow: hidden; }
    .mus-list .mbar i { display: block; height: 100%; background: var(--accent); }
    .warns { display: flex; flex-direction: column; gap: 4px; }
    .warn-item {
      font-size: 12px; background: var(--warn-bg); color: var(--warn-fg);
      padding: 4px 7px; border-radius: 6px;
    }
    .warn-none { font-size: 12px; color: var(--muted); }
    .rom-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
    .rom-tag { font-size: 11px; background: var(--rom-bg); color: var(--rom-fg); padding: 2px 6px; border-radius: 4px; }
    .shots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .shot { margin: 0; background: #f1eee8; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .shot img { display: block; width: 100%; height: auto; cursor: zoom-in; }
    .shot figcaption {
      font-size: 12px; color: var(--muted); text-align: center;
      padding: 5px 6px; background: #faf9f6; border-top: 1px solid var(--line);
    }
    dialog#lb {
      padding: 12px; border: 1px solid var(--line); border-radius: 12px;
      max-width: 92vw; max-height: 92vh; background: var(--card);
    }
    dialog#lb::backdrop { background: rgba(0, 0, 0, 0.55); }
    dialog#lb img { display: block; max-width: 86vw; max-height: 80vh; width: auto; height: auto; margin: 0 auto; border-radius: 6px; }
    dialog#lb .lb-cap { text-align: center; margin-top: 8px; font-size: 13px; color: var(--text); }
    @media (max-width: 1020px) {
      .card { grid-template-columns: 1fr; }
    }
    @media (max-width: 680px) {
      .shots { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="hd-top">
      <h1>3D 動作力學 — 動作姿勢總覽</h1>
      <div class="stats">
        <span>共 ${rows.length} 個已實作動作</span>
        <span>含警告：${warnCount} 個</span>
        <span>模型版本：${escHtml(meta.modelVersion)}</span>
        <span>產生時間：${escHtml(meta.generatedAt)}</span>
      </div>
    </div>
    <nav class="nav">
      ${navLinks}
      <button type="button" class="filter-btn" id="onlyWarnBtn">只看有警告（${warnCount}）</button>
    </nav>
  </header>
  <main>
    ${sectionsHtml}
  </main>
  <dialog id="lb">
    <img id="lbImg" alt="" />
    <div class="lb-cap" id="lbCap"></div>
  </dialog>
  <script>
    const lb = document.getElementById('lb');
    const lbImg = document.getElementById('lbImg');
    const lbCap = document.getElementById('lbCap');
    document.addEventListener('click', (e) => {
      const img = e.target.closest('.shot img');
      if (img) {
        lbImg.src = img.dataset.full;
        lbCap.textContent = img.dataset.cap;
        lb.showModal();
      } else if (e.target === lb) {
        lb.close();
      }
    });
    const btn = document.getElementById('onlyWarnBtn');
    let onlyWarn = false;
    btn.addEventListener('click', () => {
      onlyWarn = !onlyWarn;
      btn.classList.toggle('on', onlyWarn);
      for (const card of document.querySelectorAll('.card')) {
        card.classList.toggle('hidden', onlyWarn && card.dataset.hasWarn !== '1');
      }
    });
  </script>
</body>
</html>
`;
}

async function waitFrames(page, n = 4) {
  await page.evaluate((count) => new Promise((resolve) => {
    let i = 0;
    const step = () => (++i >= count ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  }), n);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const items = CATALOG.filter((c) => !c.planned);
  fs.mkdirSync(IMG_DIR, { recursive: true });


  let viteProc = null;
  const targetUrl = opts.url || `http://127.0.0.1:${opts.port}/`;
  const cleanup = () => stopVite(viteProc);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });

  let browser = null;
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  try {
    if (!opts.url) {
      console.log(`啟動開發伺服器：npx vite --port ${opts.port} --strictPort`);
      viteProc = startVite(opts.port);
      await waitForServer(targetUrl, 20000, viteProc);
    } else {
      console.log(`使用現有伺服器：${targetUrl}`);
    }

    const { chromium } = loadPlaywright();
    const launchOpts = {
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    };
    const customExe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || DEFAULT_CHROMIUM;
    if (customExe && fs.existsSync(customExe)) launchOpts.executablePath = customExe;

    browser = await chromium.launch(launchOpts);
    // 一般模式在就緒後清除舊圖片；續拍只沿用同一版程式的圖片。
    if (!opts.resume) for (const f of fs.readdirSync(IMG_DIR)) {
      if (f.endsWith('.png')) fs.unlinkSync(path.join(IMG_DIR, f));
    }
    // viewport 寬 600、高 1000（#stage 為 50dvh → canvas 約 600×500）
    const context = await browser.newContext({ viewport: { width: 600, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();

    page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`);
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__mm?.pick), { timeout: 15000 });
    // 等 BodyParts3D 骨骼模型載入完成再開始截圖
    await page.waitForFunction(() => Boolean(window.__mm?.rigA?.boneMeshes), { timeout: 15000 });

    // 記錄每個 lift 的內建預設參數，避免同一 lift 的變化式切換時互相殘留參數
    const initDefaults = await page.evaluate(() => structuredClone(window.__mm.state.params));
    const canvas = page.locator('#c');

    const SHOT_SPECS = [
      { key: 'top-side', t: 0, view: 'side', label: '頂點・側面' },
      { key: 'bot-side', t: 0.5, view: 'side', label: '最低點・側面' },
      { key: 'bot-oblique', t: 0.5, view: 'oblique', label: '最低點・斜角' },
    ];

    const rows = [];
    for (let idx = 0; idx < items.length; idx++) {
      const entry = items[idx];
      const info = analyzeItem(entry);
      const shots = [];

      const missing = SHOT_SPECS.filter((spec) => !opts.resume || !fs.existsSync(path.join(IMG_DIR, `${entry.id}-${spec.key}.png`)));
      if (missing.length) {
        // 還原該動作的內建預設並切換到該清單項目
        await page.evaluate(({ id, lift, def }) => {
          const m = window.__mm;
          m.state.params[lift] = structuredClone(def);
          m.pick(id);
          m.state.playing = false;
        }, { id: entry.id, lift: entry.lift, def: initDefaults[entry.lift] });
      }

      for (const spec of SHOT_SPECS) {
        const filename = `${entry.id}-${spec.key}.png`;
        if (missing.includes(spec)) {
          await page.evaluate(({ t, view }) => {
            const m = window.__mm;
            m.state.playing = false;
            m.state.t = t;
            m.setView(view);
          }, { t: spec.t, view: spec.view });
          // 等待 2 幀確保 WebGL 畫面以新姿勢與新視角完成繪製
          await waitFrames(page, 2);
          await canvas.screenshot({ path: path.join(IMG_DIR, filename) });
        }
        shots.push({
          key: spec.key,
          label: spec.label,
          relPath: `img/${filename}`,
        });
      }

      const warns = info.modelWarns;
      rows.push({
        entry,
        shots,
        topMuscles: info.topMuscles,
        warns,
        romWarns: info.romWarns,
      });
      console.log(`[${String(idx + 1).padStart(2, ' ')}/${items.length}] ${entry.id.padEnd(16)} 完成（警告 ${warns.length}）`);
    }

    const html = buildHtml(rows, {
      modelVersion: MODEL_VERSION,
      generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    });
    fs.writeFileSync(path.join(REVIEW_DIR, 'index.html'), html, 'utf8');
    console.log(`已輸出：${path.relative(ROOT, REVIEW_DIR)}/index.html（共 ${rows.length} 個動作，${rows.length * 3} 張圖）`);

    if (opts.publish) {
      const dest = path.join(ROOT, 'dist', 'review');
      fs.rmSync(dest, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(REVIEW_DIR, dest, { recursive: true });
      console.log(`已發布到：${path.relative(ROOT, dest)}/`);
    }

    if (consoleErrors.length || pageErrors.length || failedRequests.length) {
      console.error('偵測到執行錯誤：');
      if (consoleErrors.length) console.error('  console errors:', consoleErrors);
      if (pageErrors.length) console.error('  page errors:', pageErrors);
      if (failedRequests.length) console.error('  failed requests:', failedRequests);
      process.exitCode = 1;
    } else {
      console.log('檢查完成：無 console error、無 page error。');
    }
  } finally {
    if (browser) await browser.close();
    cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
