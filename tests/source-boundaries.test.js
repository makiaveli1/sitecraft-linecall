import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');
const dataSource = fs.readFileSync(path.join(ROOT, 'src/data.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(ROOT, 'src/main.jsx'), 'utf8');
const siteSource = fs.readFileSync(path.join(ROOT, 'src/site.jsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8');
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const viteSource = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
const pagesWorkflowSource = fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
const combinedSource = [appSource, dataSource, mainSource, siteSource, cssSource, indexSource].join('\n').toLowerCase();

test('declared dependency surface stays intentionally small and reproducible', () => {
  assert.deepEqual(packageJson.dependencies, {
    react: '19.2.8',
    'react-dom': '19.2.8',
  });
  assert.deepEqual(packageJson.devDependencies, {
    '@vitejs/plugin-react': '6.0.5',
    vite: '8.2.1',
  });
  assert.equal(packageJson.scripts.build, 'vite build');
  assert.equal(packageJson.scripts['build:pages'], 'vite build --mode pages');
  assert.ok(viteSource.includes("base: mode === 'pages' ? '/sitecraft-linecall/' : '/'"));
  assert.ok(pagesWorkflowSource.includes('workflow_dispatch:'));
  assert.equal(/^\s*push:/m.test(pagesWorkflowSource), false, 'Pages fallback must stay manual-only');
  for (const required of [
    'contents: read',
    'pages: write',
    'id-token: write',
    'actions/checkout@v6',
    'actions/setup-node@v4',
    'actions/configure-pages@v5',
    'actions/upload-pages-artifact@v4',
    'actions/deploy-pages@v4',
    'npm ci',
    'npm run build:pages',
    'path: ./dist',
  ]) {
    assert.ok(pagesWorkflowSource.includes(required), `Missing Pages fallback contract: ${required}`);
  }

  const forbiddenPackages = [
    'react-router',
    'react-router-dom',
    'redux',
    '@reduxjs/toolkit',
    'zustand',
    'jotai',
    'recoil',
    'framer-motion',
    'gsap',
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    'tailwindcss',
    '@mui/material',
    'antd',
    'chakra-ui',
  ];
  const declared = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  for (const name of forbiddenPackages) {
    assert.equal(declared[name], undefined, `${name} must not enter revision 2 without a contract change`);
  }
});

test('site ships no image, video, canvas, iframe, or unapproved remote surface', () => {
  for (const forbidden of ['<img', '<video', '<canvas', '<iframe']) {
    assert.equal(combinedSource.includes(forbidden), false, `${forbidden} is outside the current site contract`);
  }
  const remoteUrls = [...siteSource.matchAll(/https?:\/\/[^"']+/g)].map((match) => match[0]);
  assert.deepEqual(
    [...new Set(remoteUrls)].sort(),
    [
      'https://developer.chrome.com/docs/ai/webmcp',
      'https://github.com/makiaveli1/sitecraft-linecall',
    ].sort(),
    'Only the public source repository and official WebMCP documentation may be linked from the client site',
  );
  assert.equal(combinedSource.includes('webgl'), false);
  assert.equal(combinedSource.includes('three.js'), false);
});

test('application keeps the semantic and accessibility hooks declared by the contract', () => {
  for (const required of [
    'aria-live="polite"',
    'aria-pressed=',
    'aria-current=',
    '<ol className="cue-score"',
    'type="search"',
    'prefers-reduced-motion',
    'button:focus-visible',
    '@media (max-width: 760px)',
    '@media (max-width: 390px)',
  ]) {
    assert.ok(
      appSource.includes(required) || cssSource.includes(required),
      `Missing required first-pass hook: ${required}`,
    );
  }
  assert.ok(indexSource.includes('href="#site-main"'));
  assert.ok(appSource.includes('id="site-main" tabIndex="-1"'));
  assert.ok(appSource.includes('id="linecall-main" tabIndex="-1"'));
  assert.ok(indexSource.includes('<noscript>'));
  assert.ok(indexSource.includes('JavaScript is required for the LINECALL cue desk.'));
});

test('site architecture explains the product before the live cue desk', () => {
  assert.equal((siteSource.match(/<h1/g) ?? []).length, 1, 'The React site should have exactly one primary heading');
  assert.ok(siteSource.includes('Run the show. Let the agent solve the timing.'));
  assert.ok(siteSource.includes('LINECALL helps a live-event team keep the show on time.'));
  assert.ok(siteSource.includes('You decide whether anything moves.'));
  assert.ok(siteSource.includes('4 → 5 → 4'));
  assert.ok(siteSource.includes('Agent can'));
  assert.ok(siteSource.includes('Agent cannot'));
  for (const required of [
    '<SiteNav',
    '<SiteHero',
    '<ProductMeaningSection',
    '<HowItWorksSection',
    'id="live-demo"',
    '<SafetySection',
    '<ProofSection',
    '<FinalCallToAction',
    '<SiteFooter',
  ]) {
    assert.ok(appSource.includes(required) || siteSource.includes(required), `Missing site architecture boundary: ${required}`);
  }
  assert.ok(cssSource.includes('.site-hero'));
  assert.ok(cssSource.includes('.site-section--how'));
  assert.ok(cssSource.includes('.site-section--safety'));
});

test('source retains cue-score language and avoids generic dashboard/card framing', () => {
  assert.ok(appSource.includes('Cue score'));
  assert.ok(appSource.includes('Run of show'));
  assert.ok(appSource.includes('Now'));
  assert.ok(appSource.includes('Next'));
  assert.ok(dataSource.includes("mode: 'Production demo'"));

  for (const forbidden of [
    'kpi-card',
    'analytics-card',
    'dashboard-grid',
    'kanban',
    'local run',
    'rehearsal',
  ]) {
    assert.equal(combinedSource.includes(forbidden), false);
  }
});

test('no permanent timer or animation loop is introduced', () => {
  assert.equal(combinedSource.includes('setinterval('), false);
  assert.equal(combinedSource.includes('settimeout('), false);
  const rafCalls = (combinedSource.match(/requestanimationframe\(/g) ?? []).length;
  assert.ok(
    rafCalls <= 2,
    'Only the two bounded focus-handoff animation frames are allowed: detail return and fixture recovery',
  );
});
