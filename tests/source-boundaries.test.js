import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const appSource = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');
const mainSource = fs.readFileSync(path.join(ROOT, 'src/main.jsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8');
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('application source contains no external network or storage routes', () => {
  const joined = [appSource, mainSource].join('\n').toLowerCase();
  for (const forbidden of [
    'fetch(',
    'xmlhttprequest',
    'websocket',
    'eventsource',
    'localstorage',
    'sessionstorage',
    'indexeddb',
    'navigator.sendbeacon',
  ]) {
    assert.equal(joined.includes(forbidden), false, `forbidden capability found: ${forbidden}`);
  }
});

test('cue rows remain semantic buttons inside an ordered score', () => {
  assert.match(appSource, /<ol className="cue-score"/);
  assert.match(appSource, /<li[\s\S]*className=\{`cue-row/);
  assert.match(appSource, /className="cue-select"/);
  assert.match(appSource, /aria-current=\{cue\.runState === 'current'/);
});

test('readiness and filter controls expose pressed state', () => {
  const pressedCount = (appSource.match(/aria-pressed=/g) ?? []).length;
  assert.ok(pressedCount >= 4);
  assert.match(appSource, /role="status"/);
  assert.match(appSource, /aria-live="polite"/);
});

test('responsive inspector rules do not alter wide desktop structure', () => {
  assert.match(cssSource, /@media \(min-width: 761px\) and \(max-width: 980px\)/);
  assert.match(cssSource, /@media \(max-width: 760px\)/);
  assert.match(cssSource, /\.app-shell--detail-open \.inspector/);
  assert.match(cssSource, /\.app-shell--detail-open \.score-panel/);
  assert.match(appSource, /Return to cue score/);
});

test('reduced-motion behavior removes authored motion rather than hiding content', () => {
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /transition-duration: 0\.01ms !important/);
  assert.match(cssSource, /animation-duration: 0\.01ms !important/);
  assert.equal(cssSource.includes('display: none !important'), false);
});

test('no-JavaScript fallback names the local fixture boundary', () => {
  assert.match(indexSource, /JavaScript is required for this local cue-desk test/);
  assert.match(indexSource, /No production system or network service has failed/);
});

test('React composition uses one reducer-style state owner for cue interactions', () => {
  assert.match(appSource, /useReducer\(appReducer, initialState\)/);
  assert.equal(appSource.includes('useState('), false);
});
