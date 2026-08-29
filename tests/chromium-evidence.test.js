import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SITE = path.join(ROOT, 'src');
const ENTRY = path.join(ROOT, 'index.html');
const EVIDENCE = process.env.LINECALL_BROWSER_EVIDENCE_DIR
  ? path.resolve(process.env.LINECALL_BROWSER_EVIDENCE_DIR)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'linecall-chromium-evidence-'));
const REPORT = path.join(EVIDENCE, 'chromium-evidence-report.json');
const CONTACT_SHEET = path.join(EVIDENCE, 'contact-sheet.html');
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashDirectory(directory) {
  const digest = crypto.createHash('sha256');
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        digest.update(path.relative(directory, full).split(path.sep).join('/'));
        digest.update('\0');
        digest.update(fs.readFileSync(full));
        digest.update('\0');
      }
    }
  };
  walk(directory);
  return digest.digest('hex');
}

function newestMtime(directory) {
  let newest = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) newest = Math.max(newest, fs.statSync(full).mtimeMs);
    }
  };
  walk(directory);
  return newest;
}

function findChrome() {
  return CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? null;
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => resolve(port));
    });
  });
}

function contentType(filePath) {
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  }[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

async function startDistServer() {
  const port = await freePort();
  const requests = [];
  const server = http.createServer((req, res) => {
    const rawPath = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
    const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
    const candidate = path.resolve(DIST, relative);
    if (!candidate.startsWith(`${path.resolve(DIST)}${path.sep}`) && candidate !== path.resolve(DIST, 'index.html')) {
      res.writeHead(404).end();
      return;
    }
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
      res.writeHead(404).end();
      return;
    }
    const body = fs.readFileSync(candidate);
    requests.push({ path: rawPath, bytes: body.length });
    res.writeHead(200, {
      'Content-Type': contentType(candidate),
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
    });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    port,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitForDevtools(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // Chrome is still starting.
    }
    await sleep(100);
  }
  throw new Error('Chrome DevTools target did not become available.');
}

class CDP {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${JSON.stringify(message.error)}`));
      else pending.resolve(message.result ?? {});
    });
  }

  call(method, params = {}, timeoutMs = 10000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        method,
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try { this.socket?.close(); } catch { /* ignore cleanup errors */ }
  }
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const result = await cdp.call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function waitForApp(cdp) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const ready = await evaluate(cdp, `document.readyState === 'complete' && !!document.querySelector('.app-shell')`);
    if (ready) return;
    await sleep(80);
  }
  throw new Error('LINECALL application did not become ready.');
}

async function navigate(cdp, url) {
  await cdp.call('Page.navigate', { url });
  await waitForApp(cdp);
  await sleep(180);
}

async function screenshot(cdp, filename) {
  const result = await cdp.call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const bytes = Buffer.from(result.data, 'base64');
  const target = path.join(EVIDENCE, filename);
  fs.writeFileSync(target, bytes);
  return {
    file: filename,
    bytes: bytes.length,
    sha256: hashBuffer(bytes),
  };
}

async function pointerClick(cdp, selector) {
  const point = await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return null;
    node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  assert.ok(point, `Missing click target: ${selector}`);
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await sleep(120);
}

async function pressKey(cdp, key, code = key) {
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
  await sleep(100);
}

async function snapshot(cdp) {
  return await evaluate(cdp, `(() => {
    const doc = document.documentElement;
    const selectedRow = document.querySelector('.cue-row--selected');
    const selectedRect = selectedRow?.getBoundingClientRect() ?? null;
    const currentRow = [...document.querySelectorAll('.cue-row')].find((row) => row.querySelector('.run-state--current')) ?? null;
    const currentRect = currentRow?.getBoundingClientRect() ?? null;
    const inspector = document.querySelector('.inspector');
    const score = document.querySelector('.score-panel');
    const search = document.querySelector('input[type="search"]');
    const agentPanel = document.querySelector('.agent-panel');
    const productLead = document.querySelector('.command-header');
    const showPulse = document.querySelector('.show-pulse');
    const segmentTrack = document.querySelector('.segment-track');
    const segmentLine = segmentTrack?.querySelector('.segment-track__line');
    const currentSegment = segmentTrack?.querySelector('li[data-state="current"]');
    const currentSegmentMarker = currentSegment?.querySelector(':scope > span');
    const currentSegmentLabel = currentSegment?.querySelector('strong');
    const segmentLineRect = segmentLine?.getBoundingClientRect() ?? null;
    const currentSegmentLabelRect = currentSegmentLabel?.getBoundingClientRect() ?? null;
    const decisionRail = document.querySelector('.decision-rail');
    const agentBrief = document.querySelector('.agent-brief');
    const active = document.activeElement;
    const rowNumbers = [...document.querySelectorAll('.cue-number')].map((node) => node.textContent.trim());
    const rowDepartments = [...document.querySelectorAll('.cue-row')].map((row) => row.dataset.department);
    const visible = (rect) => !!rect && rect.bottom > 0 && rect.top < innerHeight;
    const fullyInsideX = (node) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return rect.left >= -0.5 && rect.right <= innerWidth + 0.5;
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scroll: { x: scrollX, y: scrollY, width: doc.scrollWidth, height: doc.scrollHeight },
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      selectedCue: selectedRow?.querySelector('.cue-number')?.textContent.trim() ?? null,
      selectedVisible: visible(selectedRect),
      selectedRect: selectedRect ? { top: selectedRect.top, bottom: selectedRect.bottom, left: selectedRect.left, right: selectedRect.right } : null,
      currentCue: currentRow?.querySelector('.cue-number')?.textContent.trim() ?? null,
      currentVisible: visible(currentRect),
      inspectorTitle: inspector?.querySelector('h2')?.textContent.trim() ?? null,
      inspectorDisplay: inspector ? getComputedStyle(inspector).display : null,
      scoreDisplay: score ? getComputedStyle(score).display : null,
      detailOpen: document.querySelector('.app-shell')?.classList.contains('app-shell--detail-open') ?? false,
      hold: document.querySelector('.app-shell')?.classList.contains('app-shell--hold') ?? false,
      resultText: document.querySelector('.result-count')?.textContent.trim() ?? null,
      readiness: selectedRow?.querySelector('.readiness-chip')?.textContent.trim() ?? null,
      rowNumbers,
      rowDepartments,
      rowCount: rowNumbers.length,
      cueRowsInsideX: [...document.querySelectorAll('.cue-row')].every((row) => fullyInsideX(row)),
      searchInsideX: fullyInsideX(search),
      agentPanelInsideX: fullyInsideX(agentPanel),
      productLeadVisible: visible(productLead?.getBoundingClientRect() ?? null),
      showPulseVisible: visible(showPulse?.getBoundingClientRect() ?? null),
      segmentTrackInsideX: fullyInsideX(segmentTrack),
      currentSegmentAria: currentSegment?.getAttribute('aria-current') ?? null,
      currentSegmentLabel: currentSegmentLabel?.textContent.trim() ?? null,
      currentSegmentMarkerWidth: currentSegmentMarker?.getBoundingClientRect().width ?? 0,
      segmentRailClearsLabel: !!segmentLineRect && !!currentSegmentLabelRect && segmentLineRect.bottom < currentSegmentLabelRect.top,
      agentPanelVisible: visible(agentPanel?.getBoundingClientRect() ?? null),
      decisionStepCount: decisionRail?.querySelectorAll('li').length ?? 0,
      decisionText: decisionRail?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      agentBriefVisible: !!agentBrief && getComputedStyle(agentBrief).display !== 'none',
      agentBriefText: agentBrief?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      activeElement: {
        tag: active?.tagName ?? null,
        id: active?.id ?? null,
        className: String(active?.className ?? ''),
        text: active?.textContent?.trim().slice(0, 80) ?? null,
      },
      runningAnimations: document.getAnimations().filter((animation) => animation.playState === 'running').length,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  })()`);
}

function writeContactSheet(entries) {
  const cards = entries.map((entry) => `
    <figure>
      <img src="${entry.file}" alt="${entry.label}">
      <figcaption>${entry.label}</figcaption>
    </figure>`).join('\n');
  fs.writeFileSync(CONTACT_SHEET, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LINECALL Chromium evidence</title><style>
body{margin:0;padding:24px;background:#202224;color:#f3f3ef;font:14px system-ui,sans-serif}h1{margin:0 0 20px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}figure{margin:0;background:#101112;border:1px solid #555;padding:10px}img{display:block;width:100%;height:300px;object-fit:contain;background:white}figcaption{padding-top:8px;color:#d8d8d2;font-weight:700}
</style></head><body><h1>LINECALL — Chromium evidence</h1><main>${cards}</main></body></html>`, 'utf8');
}

const EVIDENCE_FIXTURE_REVISION = 1;
const VIEWPORTS = [
  { label: 'wide', width: 1366, height: 768 },
  { label: 'intermediate', width: 900, height: 800 },
  { label: 'mobile390', width: 390, height: 848 },
  { label: 'exact320', width: 320, height: 848 },
];

test('production build renders and behaves across real Chromium viewport states', { timeout: 90000 }, async (t) => {
  if (typeof WebSocket === 'undefined' || typeof fetch === 'undefined') {
    t.skip('This Node runtime does not expose the built-in WebSocket/fetch APIs needed for local CDP evidence.');
    return;
  }
  const chrome = findChrome();
  if (!chrome) {
    t.skip('Google Chrome/Chromium is not installed on this host.');
    return;
  }
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    t.skip('No production dist exists yet. Run the declared build before browser evidence.');
    return;
  }

  const sourceNewest = Math.max(
    newestMtime(SITE),
    fs.statSync(ENTRY).mtimeMs,
    fs.statSync(path.join(ROOT, 'package-lock.json')).mtimeMs,
    fs.statSync(path.join(ROOT, 'vite.config.js')).mtimeMs,
  );
  const distIndexMtime = fs.statSync(path.join(DIST, 'index.html')).mtimeMs;
  assert.ok(distIndexMtime >= sourceNewest, 'Production dist is older than the current source; rebuild before collecting browser evidence.');
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browserVersion = spawnSync(chrome, ['--version'], { encoding: 'utf8' }).stdout.trim();
  const server = await startDistServer();
  const debugPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'linecall-chrome-'));
  const chromeProcess = spawn(chrome, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    '--enable-precise-memory-info',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let cdp;
  const captures = [];
  const report = {
    schema_version: '1.0',
    fixture: 'LINECALL — Live Production Cue Desk',
    browser: browserVersion,
    platform: process.platform,
    production_build_identity: hashDirectory(DIST),
    evidence_fixture_revision: EVIDENCE_FIXTURE_REVISION,
    execution: 'native local headless Chrome controlled through Chrome DevTools Protocol; production dist served by a local Node HTTP server',
    passed: false,
    cases: {},
    interactions: {},
    limitations: [
      'The 390 and 320 CSS-pixel cases are responsive desktop-Chromium viewports, not physical touch-device evidence.',
      'Headless Chromium proves layout/runtime behaviour but does not replace attended visual judgement of the visible browser.',
      'Reduced-motion in this run is Chromium media emulation, not the owner operating system preference.',
      'Localhost removes real network latency; no field Core Web Vitals or representative-device performance claim is made.',
      'Pointer input is dispatched through Chrome DevTools; it is real browser pointer handling but not physical-device touch evidence.',
    ],
  };

  try {
    const target = await waitForDevtools(debugPort);
    cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Network.enable');
    await cdp.call('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.call('Performance.enable');
    const url = `http://127.0.0.1:${server.port}/`;

    for (const viewport of VIEWPORTS) {
      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.call('Emulation.setEmulatedMedia', { media: '', features: [] });
      await navigate(cdp, url);
      const state = await snapshot(cdp);
      assert.equal(state.horizontalOverflow, false, `${viewport.label}: horizontal page overflow`);
      assert.equal(state.cueRowsInsideX, true, `${viewport.label}: cue row escaped the viewport`);
      assert.equal(state.searchInsideX, true, `${viewport.label}: search input escaped the viewport`);
      assert.equal(state.agentPanelInsideX, true, `${viewport.label}: WebMCP collaboration surface escaped the viewport`);
      assert.equal(state.decisionStepCount, 4, `${viewport.label}: authority rail must expose all four collaboration steps`);
      assert.match(state.decisionText, /Agent compares.*Rules verify.*Human approves.*Agent applies/s, `${viewport.label}: authority rail lost its collaboration sequence`);
      assert.equal(state.agentBriefVisible, true, `${viewport.label}: operator briefing must be visible before agent action`);
      assert.match(state.agentBriefText, /Audience Q&A needs to start two seconds later/i, `${viewport.label}: judge-facing demo prompt is missing`);
      assert.equal(state.selectedCue, 'Q012', `${viewport.label}: initial selected cue drifted`);
      assert.equal(state.currentCue, 'Q012', `${viewport.label}: declared current cue drifted`);
      assert.equal(state.scroll.y, 0, `${viewport.label}: first load must preserve the judge-facing top of the cue desk`);
      assert.equal(state.productLeadVisible, true, `${viewport.label}: product lead is missing from the first viewport`);
      assert.equal(state.showPulseVisible, true, `${viewport.label}: live Now/Next pulse is missing from the first viewport`);
      assert.equal(state.segmentTrackInsideX, true, `${viewport.label}: show progression rail escaped the viewport`);
      assert.equal(state.currentSegmentAria, 'step', `${viewport.label}: current show segment lost its semantic current-step marker`);
      assert.equal(state.currentSegmentLabel, 'Opening sequence', `${viewport.label}: current show segment label drifted`);
      assert.ok(state.currentSegmentMarkerWidth >= 10, `${viewport.label}: current show-segment marker is too weak to read at a glance`);
      assert.equal(state.segmentRailClearsLabel, true, `${viewport.label}: progression rail collides with its segment label`);
      if (viewport.width >= 900) {
        assert.equal(state.agentPanelVisible, true, `${viewport.label}: WebMCP collaboration story should begin in the first viewport`);
      }
      if (viewport.width > 980) {
        assert.notEqual(state.inspectorDisplay, 'none', 'Wide view must keep the selected-cue inspector visible.');
      } else {
        assert.equal(state.inspectorDisplay, 'none', `${viewport.label}: inspector should not cover the score before selection.`);
      }
      const shot = await screenshot(cdp, `${viewport.label}-initial.png`);
      captures.push({ ...shot, label: `${viewport.label} · initial` });
      report.cases[viewport.label] = { initial: state, screenshot: shot };
    }

    // Wide keyboard navigation, readiness, filters/search and hold preservation.
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await navigate(cdp, url);
    await evaluate(cdp, `document.querySelector('.cue-row--selected .cue-select').focus(); true`);
    await pressKey(cdp, 'ArrowDown', 'ArrowDown');
    let state = await snapshot(cdp);
    assert.equal(state.selectedCue, 'Q013', 'ArrowDown must move cue selection to Q013.');
    assert.ok(state.activeElement.text?.includes('Q013'), 'ArrowDown must move browser focus with cue selection.');
    await pointerClick(cdp, '.cue-row--selected .readiness-chip');
    state = await snapshot(cdp);
    assert.equal(state.readiness, 'Ready', 'Pointer readiness change did not reach Ready.');
    await pointerClick(cdp, '.hold-control');
    state = await snapshot(cdp);
    assert.equal(state.hold, true, 'Hold control did not enter hold state.');
    assert.equal(state.selectedCue, 'Q013', 'Hold must preserve cue selection.');
    assert.equal(state.readiness, 'Ready', 'Hold must preserve readiness.');
    await pointerClick(cdp, '.hold-control');
    await pointerClick(cdp, '.department-filters button[data-department="audio"]');
    state = await snapshot(cdp);
    assert.ok(state.rowCount > 0, 'Audio filter unexpectedly hid every cue.');
    assert.ok(state.rowDepartments.every((department) => department === 'audio'), 'Audio filter exposed another department.');
    await evaluate(cdp, `document.querySelector('input[type="search"]').focus(); true`);
    await cdp.call('Input.insertText', { text: 'no-such-cue-zzzz' });
    await sleep(140);
    assert.ok(await evaluate(cdp, `!!document.querySelector('.empty-state')`), 'Search did not reach the declared no-results state.');
    await pointerClick(cdp, '.empty-state button');
    state = await snapshot(cdp);
    assert.equal(state.rowCount, 32, 'No-results recovery did not restore the full cue score.');
    const wideInteractionShot = await screenshot(cdp, 'wide-interaction-restored.png');
    captures.push({ ...wideInteractionShot, label: 'wide · keyboard/readiness/filter recovery' });

    await pointerClick(cdp, '.fixture-footer summary');
    await pointerClick(cdp, '.fixture-footer .button-row button:first-child');
    assert.ok(await evaluate(cdp, `!!document.querySelector('.fixture-error[role="alert"]')`), 'Simulated fixture error did not reach the rendered error state.');
    const errorShot = await screenshot(cdp, 'wide-fixture-error.png');
    captures.push({ ...errorShot, label: 'wide · deliberate local fixture error' });
    await pointerClick(cdp, '.fixture-error .button-row button:first-child');
    assert.equal(await evaluate(cdp, `!!document.querySelector('.fixture-error')`), false, 'Fixture recovery left the rendered error state active.');
    assert.equal(await evaluate(cdp, `document.activeElement?.id`), 'score-title', 'Fixture recovery did not return focus to the restored cue score.');
    await pointerClick(cdp, '.fixture-footer .button-row button:nth-child(2)');
    state = await snapshot(cdp);
    assert.equal(state.selectedCue, 'Q012', 'Fixture reset did not restore the canonical selected cue.');
    assert.equal(state.readiness, 'Pending', 'Fixture reset did not restore canonical readiness.');
    assert.equal(state.hold, false, 'Fixture reset did not restore running state.');
    report.interactions.wide = { restored: state, screenshot: wideInteractionShot, error_screenshot: errorShot };

    // Production-app WebMCP collaboration rehearsal through a minimal standards-shaped test shim.
    // This proves LINECALL's registration -> preview -> human approval -> apply UI loop in real Chromium.
    // It is not evidence that this Chrome build exposes the native experimental WebMCP implementation.
    await cdp.call('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const tools = new Map();
        Object.defineProperty(document, 'modelContext', {
          configurable: true,
          value: {
            __tools: tools,
            registerTool(definition, options = {}) {
              tools.set(definition.name, definition);
              options.signal?.addEventListener?.('abort', () => tools.delete(definition.name), { once: true });
              return Promise.resolve();
            },
            async getTools() {
              return [...tools.values()].map(({ execute, ...definition }) => definition);
            },
          },
        });
      })();`,
    });
    await navigate(cdp, url);
    const toolsReadyDeadline = Date.now() + 5000;
    while (Date.now() < toolsReadyDeadline) {
      const registeredCount = await evaluate(cdp, `document.modelContext?.__tools?.size ?? 0`);
      if (registeredCount === 4) break;
      await sleep(80);
    }
    assert.equal(await evaluate(cdp, `document.modelContext?.__tools?.size ?? 0`), 4, 'WebMCP rehearsal shim did not receive the four pre-approval LINECALL tools.');
    assert.equal(
      await evaluate(cdp, `document.modelContext?.__tools?.has('linecall_apply_approved_retime') ?? false`),
      false,
      'Apply authority was exposed before human approval.',
    );
    assert.match(
      await evaluate(cdp, `document.querySelector('.agent-panel__status')?.textContent.trim() ?? ''`),
      /4 tools browser-verified/i,
      'WebMCP browser discovery status did not reflect the four active pre-approval tools.',
    );

    const previewResult = await evaluate(cdp, `(async () => {
      const tool = document.modelContext.__tools.get('linecall_preview_segment_retime');
      return await tool.execute({
        segment_id: 'qa',
        offset_seconds: 2,
        mode: 'ripple_after',
        expected_revision: 1,
      });
    })()`, true);
    assert.equal(previewResult.status, 'ready', 'WebMCP rehearsal preview did not produce a ready plan.');
    assert.equal(previewResult.changes.length, 13, 'WebMCP rehearsal preview drifted from the expected 13 exact cue changes.');
    await sleep(180);

    const previewUi = await evaluate(cdp, `(() => ({
      comparisonVisible: !!document.querySelector('.strategy-comparison'),
      blockedOption: document.querySelector('.strategy-option--blocked')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      recommendedOption: document.querySelector('.strategy-option.is-recommended')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      planText: document.querySelector('.agent-plan')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      approvalButton: document.querySelector('.agent-plan button:not(.button-secondary)')?.textContent.trim() ?? '',
    }))()`);
    assert.equal(previewUi.comparisonVisible, true, 'WebMCP retime preview did not render the deterministic comparison surface.');
    assert.match(previewUi.blockedOption, /Segment only.*Blocked/i, 'Blocked segment-only strategy is not visible to the operator.');
    assert.match(previewUi.recommendedOption, /Ripple downstream.*Safe.*Recommended by deterministic constraints/i, 'Safe recommended ripple strategy is not visibly explained.');
    assert.match(previewUi.planText, /Audience Q&A.*13/i, 'Exact Q&A plan is not visibly staged for human review.');
    assert.match(previewUi.approvalButton, /Approve this exact plan/i, 'Human approval control is not visible for the ready plan.');
    const previewShot = await screenshot(cdp, 'wide-webmcp-preview.png');
    captures.push({ ...previewShot, label: 'wide · WebMCP rehearsal preview + decision trace' });

    await pointerClick(cdp, '.agent-plan button:not(.button-secondary)');
    assert.match(
      await evaluate(cdp, `document.querySelector('.agent-plan__approval')?.textContent.trim() ?? ''`),
      /Approval is bound to this plan ID and revision/i,
      'Human approval did not become visibly bound to the exact plan.',
    );
    const approvalCapabilityDeadline = Date.now() + 5000;
    while (Date.now() < approvalCapabilityDeadline) {
      const applyAvailable = await evaluate(cdp, `document.modelContext?.__tools?.has('linecall_apply_approved_retime') ?? false`);
      if (applyAvailable) break;
      await sleep(80);
    }
    assert.equal(
      await evaluate(cdp, `document.modelContext?.__tools?.size ?? 0`),
      5,
      'Human approval did not expand the active WebMCP surface to five tools.',
    );
    assert.equal(
      await evaluate(cdp, `document.modelContext?.__tools?.has('linecall_apply_approved_retime') ?? false`),
      true,
      'Human approval did not expose the exact-plan apply capability.',
    );

    const applyResult = await evaluate(cdp, `(async () => {
      const tool = document.modelContext.__tools.get('linecall_apply_approved_retime');
      return await tool.execute({
        plan_id: ${JSON.stringify(previewResult.planId)},
        expected_revision: 1,
      });
    })()`, true);
    assert.equal(applyResult.status, 'applied', 'Approved WebMCP rehearsal plan was not applied.');
    assert.equal(applyResult.newRevision, 2, 'Applied WebMCP rehearsal plan did not advance schedule revision to R2.');
    const withdrawnCapabilityDeadline = Date.now() + 5000;
    while (Date.now() < withdrawnCapabilityDeadline) {
      const applyAvailable = await evaluate(cdp, `document.modelContext?.__tools?.has('linecall_apply_approved_retime') ?? false`);
      if (!applyAvailable) break;
      await sleep(80);
    }
    assert.equal(
      await evaluate(cdp, `document.modelContext?.__tools?.size ?? 0`),
      4,
      'One-time apply authority was not withdrawn after execution.',
    );
    assert.equal(
      await evaluate(cdp, `document.modelContext?.__tools?.has('linecall_apply_approved_retime') ?? false`),
      false,
      'Apply capability remained exposed after the approved plan was consumed.',
    );
    await sleep(180);

    const appliedUi = await evaluate(cdp, `(() => {
      const cueTime = (number) => [...document.querySelectorAll('.cue-row')]
        .find((row) => row.querySelector('.cue-number')?.textContent.trim() === number)
        ?.querySelector('.cue-time')?.textContent.trim() ?? null;
      return {
        receipt: document.querySelector('.agent-receipt')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        revision: [...document.querySelectorAll('.agent-panel__facts strong')][0]?.textContent.trim() ?? '',
        cue020: cueTime('Q020'),
        cue032: cueTime('Q032'),
        previewGone: !document.querySelector('.agent-plan'),
      };
    })()`);
    assert.match(appliedUi.receipt, /Audience Q&A moved \+2s.*13 cues.*R2/i, 'Applied WebMCP rehearsal did not leave a complete visible receipt.');
    assert.equal(appliedUi.revision, 'R2', 'Visible schedule revision did not advance to R2.');
    assert.equal(appliedUi.cue020, '00:24', 'Q020 did not visibly move to 00:24 after approved retime.');
    assert.equal(appliedUi.cue032, '00:47', 'Q032 did not visibly move to 00:47 after approved retime.');
    assert.equal(appliedUi.previewGone, true, 'Applied preview remained active after one-time execution.');
    const appliedShot = await screenshot(cdp, 'wide-webmcp-applied.png');
    captures.push({ ...appliedShot, label: 'wide · approved WebMCP rehearsal applied + receipt' });
    report.interactions.webmcp_rehearsal = {
      evidence_kind: 'real Chromium production app with injected document.modelContext contract shim',
      native_webmcp_claimed: false,
      preview_result: previewResult,
      preview_ui: previewUi,
      preview_screenshot: previewShot,
      apply_result: applyResult,
      applied_ui: appliedUi,
      applied_screenshot: appliedShot,
    };

    // Skip-link keyboard purpose.
    await navigate(cdp, url);
    await evaluate(cdp, `document.querySelector('.skip-link').focus(); true`);
    await pressKey(cdp, 'Enter', 'Enter');
    const skipState = await snapshot(cdp);
    assert.equal(skipState.activeElement.id, 'linecall-main', 'Skip link did not move focus to the cue-desk main region.');
    report.interactions.skip_link = skipState.activeElement;

    // Narrow pointer selection opens a real secondary detail view and return restores list + focus.
    for (const viewport of [{ label: 'mobile390', width: 390, height: 848 }, { label: 'exact320', width: 320, height: 848 }]) {
      await cdp.call('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
      await navigate(cdp, url);
      await pointerClick(cdp, '.cue-row--selected .cue-select');
      await sleep(220);
      const detailState = await snapshot(cdp);
      assert.equal(detailState.detailOpen, true, `${viewport.label}: cue selection did not open the detail composition.`);
      assert.equal(detailState.scoreDisplay, 'none', `${viewport.label}: cue score remained visible behind the detail view.`);
      assert.notEqual(detailState.inspectorDisplay, 'none', `${viewport.label}: inspector did not become visible.`);
      assert.equal(detailState.horizontalOverflow, false, `${viewport.label}: detail view introduced horizontal overflow.`);
      const detailShot = await screenshot(cdp, `${viewport.label}-detail.png`);
      captures.push({ ...detailShot, label: `${viewport.label} · selected cue detail` });
      await pointerClick(cdp, '.detail-back');
      await sleep(120);
      const returnedState = await snapshot(cdp);
      assert.equal(returnedState.detailOpen, false, `${viewport.label}: return action did not restore cue score.`);
      assert.notEqual(returnedState.scoreDisplay, 'none', `${viewport.label}: cue score did not return.`);
      assert.ok(returnedState.activeElement.text?.includes('Q012'), `${viewport.label}: return action did not restore focus to selected cue.`);
      report.interactions[viewport.label] = { detail: { ...detailState, screenshot: detailShot }, returned: returnedState };
    }

    // Reduced-motion composition at 390 CSS px.
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 848, deviceScaleFactor: 1, mobile: false });
    await cdp.call('Emulation.setEmulatedMedia', {
      media: '',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await navigate(cdp, url);
    await pointerClick(cdp, '.cue-row--selected .cue-select');
    await sleep(40);
    const reduced = await snapshot(cdp);
    assert.equal(reduced.reducedMotion, true, 'Chromium reduced-motion emulation was not active.');
    assert.equal(reduced.detailOpen, true, 'Reduced motion must preserve detail navigation.');
    assert.equal(reduced.runningAnimations, 0, 'Reduced-motion detail view still has a running animation.');
    const reducedShot = await screenshot(cdp, 'mobile390-reduced-detail.png');
    captures.push({ ...reducedShot, label: '390 · reduced-motion detail' });
    report.interactions.reduced_motion = { state: reduced, screenshot: reducedShot };

    // Script-disabled fallback is an honest static error frame, not a fake functional application.
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 320, height: 848, deviceScaleFactor: 1, mobile: false });
    await cdp.call('Emulation.setEmulatedMedia', { media: '', features: [] });
    await cdp.call('Emulation.setScriptExecutionDisabled', { value: true });
    await cdp.call('Page.navigate', { url });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const ready = await evaluate(cdp, `document.readyState === 'complete'`);
      if (ready) break;
      await sleep(80);
    }
    const noJs = await evaluate(cdp, `(() => {
      const fallback = document.querySelector('.no-js-fallback');
      const doc = document.documentElement;
      return {
        visible: !!fallback && getComputedStyle(fallback).display !== 'none',
        heading: fallback?.querySelector('h1')?.textContent.trim() ?? null,
        appMounted: !!document.querySelector('.app-shell'),
        horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      };
    })()`);
    assert.equal(noJs.visible, true, 'Script-disabled fallback is not visible.');
    assert.match(noJs.heading ?? '', /JavaScript is required/i);
    assert.equal(noJs.appMounted, false, 'Script-disabled state must not pretend the React application mounted.');
    assert.equal(noJs.horizontalOverflow, false, 'Script-disabled 320px fallback overflows horizontally.');
    const noJsShot = await screenshot(cdp, 'exact320-no-js.png');
    captures.push({ ...noJsShot, label: '320 · JavaScript-disabled fallback' });
    report.interactions.no_js = { state: noJs, screenshot: noJsShot };
    await cdp.call('Emulation.setScriptExecutionDisabled', { value: false });

    const perf = await cdp.call('Performance.getMetrics');
    report.performance_metrics = Object.fromEntries((perf.metrics ?? []).map((item) => [item.name, item.value]));
    report.request_summary = {
      count: server.requests.length,
      bytes_served: server.requests.reduce((sum, request) => sum + request.bytes, 0),
      external_requests: server.requests.filter((request) => !request.path.startsWith('/')),
    };
    report.findings = {
      initial_first_viewport: Object.fromEntries(Object.entries(report.cases).map(([label, entry]) => [label, {
        scrollY: entry.initial.scroll.y,
        productLeadVisible: entry.initial.productLeadVisible,
        showPulseVisible: entry.initial.showPulseVisible,
        agentPanelVisible: entry.initial.agentPanelVisible,
        selectedCue: entry.initial.selectedCue,
        selectedVisible: entry.initial.selectedVisible,
      }])),
    };
    report.passed = true;
    writeContactSheet(captures);
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');
  } finally {
    if (cdp) {
      try { await cdp.call('Browser.close', {}, 1200); } catch { /* close best-effort */ }
      cdp.close();
    }
    if (chromeProcess.exitCode === null) {
      chromeProcess.kill('SIGKILL');
      await Promise.race([
        new Promise((resolve) => chromeProcess.once('exit', resolve)),
        sleep(1500),
      ]);
    }
    server.closeAllConnections?.();
    await server.close();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
