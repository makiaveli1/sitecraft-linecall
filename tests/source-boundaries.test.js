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
const hereNowWorkflowSource = fs.readFileSync(path.join(ROOT, '.github/workflows/here-now-deploy.yml'), 'utf8');
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
  for (const required of [
    '"spaMode": true',
    "['index.html', 1366]",
    "['assets/index-RivNE00x.css', 126906]",
    "['assets/index-n8WEWzvN.js', 271115]",
    "['linecall-authority-keyart.svg', 5587]",
    'linecall-authority-keyart.svg|image/svg+xml',
    "- 'src/**'",
    "- 'public/**'",
    "- 'index.html'",
    "- 'package.json'",
    "- 'package-lock.json'",
    "- 'vite.config.js'",
    'HERENOW_API_KEY: ${{ secrets.HERENOW_API_KEY }}',
    'LINECALL_SITE_SLUG: grassy-lotus-7dr8',
    'https://here.now/api/v1/publish/${LINECALL_SITE_SLUG}',
    'if [[ "$persistence" != "permanent" ]]; then',
    "deploymentMode: 'owned-update'",
    'Refusing to create a replacement anonymous site.',
  ]) {
    assert.ok(hereNowWorkflowSource.includes(required), `Missing exact here.now claimed-site contract: ${required}`);
  }
  assert.equal(hereNowWorkflowSource.includes('claimCiphertext'), false, 'Claimed-site updates must not mint or encrypt another claim URL');
  assert.equal(hereNowWorkflowSource.includes('CLAIM_PUBLIC_KEY_B64'), false, 'Claimed-site updates must not depend on the old anonymous-claim key');

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

test('site visual assets stay controlled, licensed, base-aware, and bounded', () => {
  for (const forbidden of ['<video', '<canvas', '<iframe']) {
    assert.equal(combinedSource.includes(forbidden), false, `${forbidden} is outside the current site contract`);
  }
  for (const asset of ['linecall-authority-keyart.svg']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'public', asset)), `Missing repository-owned visual asset: ${asset}`);
    assert.ok(siteSource.includes(`assetHref('${asset}')`), `${asset} must resolve through the Vite-base-aware asset helper`);
  }
  assert.ok(siteSource.includes('export function assetHref('), 'Public visual assets must respect the configured Vite base path');
  assert.equal(siteSource.includes('src="/linecall-'), false, 'Key art must not hard-code a domain-root asset path');

  const imageSources = ['linecall-authority-keyart.svg'];
  assert.deepEqual(
    [...new Set(imageSources)].sort(),
    ['linecall-authority-keyart.svg'],
    'Only the retained LINECALL authority key-art asset may ship as a local client image',
  );

  const remoteUrls = [...siteSource.matchAll(/https?:\/\/[^"']+/g)].map((match) => match[0]);
  assert.deepEqual(
    [...new Set(remoteUrls)].sort(),
    ['https://github.com/makiaveli1/sitecraft-linecall'],
    'Only the public source repository may be linked from the client site',
  );

  const remoteMediaUrls = [...cssSource.matchAll(/https:\/\/images\.unsplash\.com\/[^\")]+/g)].map((match) => match[0]);
  assert.equal(remoteMediaUrls.length, 5, 'The site should use only the three approved photographs across intentional responsive/background variants.');
  const approvedPhotoIds = [
    'photo-1761618291331-535983ae4296',
    'photo-1709731192032-5b67e7f7f4c5',
    'photo-1786155458201-9554cdde897e',
  ];
  assert.deepEqual(
    [...new Set(remoteMediaUrls.map((url) => approvedPhotoIds.find((id) => url.includes(id)) || 'UNAPPROVED'))].sort(),
    [...approvedPhotoIds].sort(),
    'Remote photography must stay inside the explicit three-image LINECALL allowlist',
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

test('site architecture is route-based instead of one long-scroll page', () => {
  for (const route of ['/', '/product', '/demo', '/trust']) {
    assert.ok(appSource.includes(`'${route}'`), `Missing first-class route: ${route}`);
  }
  for (const component of ['<HomePage', '<ProductPage', '<DemoProductBar', '<TrustPage', '<NotFoundPage', '<SiteFooter']) {
    assert.ok(appSource.includes(component) || siteSource.includes(component), `Missing route component boundary: ${component}`);
  }

  assert.ok(siteSource.includes('When the show moves, LINECALL finds the time.'));
  assert.ok(siteSource.includes('A second caller for the timing problem, not the show.'));
  assert.ok(siteSource.includes('Live timing control'));
  assert.ok(siteSource.includes('Useful because the agent cannot quietly become the operator.'));
  assert.ok(siteSource.includes('4 → 5 → 4'));
  assert.ok(siteSource.includes('Agent can'));
  assert.ok(siteSource.includes('Agent cannot'));
  assert.ok(siteSource.includes('Three ways into the run.'));
  assert.ok(siteSource.includes('className="pressure-chain"'));
  assert.ok(siteSource.includes('className="hero-live-card"'));
  assert.ok(siteSource.includes('className="product-lab__instrument"'), 'Product route must retain its timing-laboratory instrument');
  assert.ok(siteSource.includes('className="demo-product-bar"'), 'Live desk must render product chrome instead of the marketing navigation');
  assert.ok(appSource.includes('className={`demo-scenario-console'), 'Live desk must expose the guided pressure-test console');
  assert.ok(appSource.includes('data-demo-action="start"'), 'Live desk must expose a real guided-demo start action');
  assert.ok(appSource.includes('className={`demo-decision-dock'), 'Live desk must pin one guided decision surface during review');
  assert.ok(appSource.includes('data-demo-decision-action="approve"'), 'Live desk must expose the human approval only through the guided decision dock');
  assert.ok(appSource.includes('WHAT TO LOOK AT'), 'Live desk must tell the operator where the projected consequence is visible');
  assert.ok(appSource.includes('cue-row--preview-shift'), 'Previewed timing changes must become visible inside the cue score');
  assert.equal(appSource.includes("document.querySelector('.agent-plan button"), false, 'Agent evidence panel must not own a competing approval action');
  assert.equal(appSource.includes('<DemoHero'), false, 'Live desk must not retain the old marketing masthead');
  assert.ok(siteSource.includes('className="trust-vault__cycle"'), 'Trust route must retain its 4→5→4 permission-vault opening');
  assert.ok(siteSource.includes('className="proof-ledger"'), 'Trust route must retain its executable proof ledger');

  assert.ok(appSource.includes("pathname === '/demo'"), 'The full cue desk must render only on the dedicated demo route');
  assert.ok(appSource.includes("pathname === '/product'"));
  assert.ok(appSource.includes("pathname === '/trust'"));
  assert.ok(appSource.includes('import.meta.env.BASE_URL'), 'Route resolution must respect the configured Vite base path');
  assert.ok(siteSource.includes('routeHref('), 'Internal navigation must be generated through the base-aware route helper');
  assert.ok(cssSource.includes('.wow-hero'));
  assert.ok(cssSource.includes('.route-gallery'));
  assert.ok(cssSource.includes('.product-chapter'));
  assert.ok(cssSource.includes('.trust-art-section'));
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
