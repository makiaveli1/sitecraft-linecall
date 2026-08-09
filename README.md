# LINECALL

LINECALL is a dense operational web application built as a SITECRAFT forward test for sustained local state, filtering, keyboard navigation, responsive list/detail transformation, and application-framework rendering.

## What it is

The fictional product is a cue desk for live-production teams. Operators work through a chronological run of show, filter cues by department, inspect details, and mark readiness without losing their place in the sequence.

The design intentionally avoids a generic dashboard-card layout. The cue score is the interface: one continuous operational timeline with an anchored inspector.

## Highlights

- React application rendered with Vite
- 32-cue local fixture spanning Stage, Audio, Lighting, and Video
- Single reducer-style state owner for filtering, selection, readiness, hold, and recovery state
- Arrow-key movement through visible cues
- Search and multi-department filtering while preserving chronological order
- Readiness cycle: Pending → Ready → Check
- Wide desktop split view, intermediate drawer inspector, and mobile list/detail composition
- Explicit loading/error/recovery fixture behaviour
- Visible keyboard focus and reduced-motion handling
- No production API, external network request, persistent storage, or service credentials

## Tech stack

- React 19
- Vite
- HTML/CSS
- Node's built-in test runner
- Optional Playwright-based Chromium evidence in the original development fixture

## Install and run

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

For the focused public-repository tests:

```bash
npm test
```

## Project structure

```text
.
├── index.html
├── src/
│   ├── App.jsx
│   ├── data.js
│   ├── main.jsx
│   ├── state.js
│   └── styles.css
├── tests/
│   ├── source-boundaries.test.js
│   └── state.test.js
├── package.json
├── vite.config.js
└── .gitignore
```

`node_modules` and built `dist` output are intentionally excluded from the repository.

## Interaction model

The app starts around cue Q012. Operators can:

1. scan the chronological score;
2. filter by department or search text;
3. select a cue and inspect its instruction;
4. change its readiness;
5. move through visible cues with the keyboard;
6. place the local rehearsal in a reversible HOLD state;
7. simulate and recover from a local fixture error.

The fixture never pretends to control a real production system.

## Responsive behaviour

On a wide display, the cue score and detail inspector stay visible together. At intermediate widths, the inspector becomes a focused drawer. On mobile, list and detail transform into separate application states rather than squeezing a desktop table into a narrow screen.

## Accessibility work

LINECALL uses semantic buttons, an ordered cue list, live announcements for important state changes, text labels alongside colour, visible focus, and reduced-motion rules. Keyboard selection and return-to-score behaviour were tested during the original SITECRAFT exercise.

This repository documents that engineering work; it is not a formal accessibility-conformance certification.

## Verification history

The original SITECRAFT development fixture passed 14 focused application/source tests, artifact-continuity checks, and real Chromium interaction review. The public repository keeps the focused source/state tests while excluding bulky internal browser-evidence artifacts.

## Why it matters

LINECALL proved that SITECRAFT can move beyond editorial websites and motion showcases into a dense, stateful application without falling back to interchangeable SaaS cards. The visual mechanism comes from the job itself: the chronological cue score.

## Status

**Portfolio / operations-app study.** Fictional production data only.

## Credits

Designed and built as part of the SITECRAFT website-system development programme.
