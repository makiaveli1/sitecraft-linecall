# LINECALL

**A live production control surface where people keep authority and agents help reason about the run.**

LINECALL is a WebMCP-powered run-of-show application for live events. It gives an AI agent a small semantic tool surface for reading production state, comparing schedule changes, preparing exact retiming plans, and updating cue readiness, while the human operator keeps control of locks and final timing approval.

This project is being built for the 2026 OpenAI WebMCP Challenge.

## Why WebMCP is a strong fit

Live production work is time-sensitive, stateful, and risky to automate through generic clicks. A useful agent needs to understand concepts such as the current cue, production segments, hard-out limits, human locks, schedule revisions, and whether a proposed timing change is safe.

LINECALL exposes those concepts directly through WebMCP rather than asking an agent to infer them from the DOM.

The result is a collaboration model with distinct responsibilities:

- **Agent:** inspect state, compare alternatives, prepare exact changes, explain blockers, and update low-risk readiness state.
- **Deterministic schedule engine:** own chronology, spacing, hard-out, revision, and lock checks.
- **Human operator:** own cue locks and approve the exact retiming plan before schedule mutation.

The agent cannot unlock a human-owned cue and cannot approve its own retiming plan.

## WebMCP tool surface

LINECALL defines five imperative WebMCP tools with `document.modelContext.registerTool`, but deliberately exposes only the four currently usable capabilities before human approval. The exact-plan apply tool appears only while a matching operator approval is active, then is withdrawn after use or invalidation:

| Tool | Purpose | Changes state? |
| --- | --- | --- |
| `linecall_get_run_snapshot` | Read the current run, revision, locks, readiness, and constraints | No |
| `linecall_compare_retime_options` | Compare segment-only and downstream-ripple strategies before choosing a plan | No |
| `linecall_preview_segment_retime` | Prepare and visibly stage an exact cue-level retiming plan | Yes, preview state only |
| `linecall_apply_approved_retime` | Apply only the exact human-approved plan at the expected revision | Yes |
| `linecall_set_cue_readiness` | Set a cue to pending, ready, or check | Yes |

Tool definitions use strict JSON schemas, explicit revision preconditions, and WebMCP annotations. Operator-authored schedule data is marked with `untrustedContentHint` where it can be returned to an agent.

## The core demo

Ask the agent:

> The audience Q&A needs to start two seconds later. Find the safest way to absorb that delay without breaking the run, and show me the exact change before anything moves.

LINECALL can then support this sequence:

1. The agent reads schedule revision R1.
2. It compares `segment_only` with `ripple_after`.
3. `segment_only` is rejected because it breaks chronology.
4. `ripple_after` is safe and produces an exact 13-cue change set.
5. LINECALL shows the proposed cue changes to the operator.
6. The operator clicks **Approve this exact plan**.
7. Only then can the agent apply the exact plan ID at R1.
8. The schedule advances to R2 and LINECALL leaves a visible receipt.

A second trust test asks the agent to move the Opening sequence. Cue Q014 is human-locked, so the plan is blocked. There is intentionally no agent tool for removing that lock.

## Browser-visible WebMCP proof

LINECALL does more than report that registration code ran. When the browser exposes `document.modelContext.getTools()`, the collaboration panel verifies the currently active capability set. The expected surface is four tools before timing approval, five only while an exact approved retime is actionable, and four again after that one-time authority is consumed or invalidated. The UI distinguishes:

- tools registered;
- tools browser-verified through discovery; and
- unsupported / unavailable WebMCP environments.

For local Chrome testing, use Chrome 149 or later with `chrome://flags/#enable-webmcp-testing` enabled, then inspect the page with the Model Context Tool Inspector. The WebMCP Challenge also supports testing through ChatGPT's in-app browser.

## Safety model

Retiming follows a preview-and-approve flow:

- every timing plan is bound to the current schedule revision;
- stale revisions fail closed;
- locked cues cannot be moved;
- hard-out and chronology violations block the plan;
- approval is bound to an exact deterministic plan ID;
- the apply capability is not exposed to the browser until that exact human approval exists;
- applying or invalidating the plan withdraws that one-time capability and advances the revision, preventing replay;
- the agent has no capability for removing human locks;
- successful retimes produce a visible receipt.

The schedule engine, not the language model, decides whether the exact proposed timing changes satisfy deterministic constraints.

## Agent evals

`evals/webmcp-agent-cases.json` contains challenge-focused cases for:

- direct run inspection;
- indirect safe-retiming reasoning;
- compare -> preview -> human stop ordering;
- approved-plan application;
- human-lock refusal;
- absence of an agent unlock capability;
- readiness mutation; and
- an unrelated request where no LINECALL tool should be selected.

`tests/webmcp-evals.test.js` validates that expected calls reference real tools and use arguments accepted by the actual tool schemas.

## Verification

The current local challenge build has passed the registered PC Bridge verification workflow with:

- **29/29 tests passing**;
- a production Vite build;
- a real Chromium production-build rendering and interaction test;
- deterministic scheduling safety tests;
- WebMCP contract tests;
- WebMCP runtime registration/discovery tests;
- agent-eval contract tests; and
- exact-state verification, meaning the project did not change while the verification run was executing.

Browser screenshots and reports generated by automated Chromium tests default to a unique operating-system temporary directory so the evidence process cannot mutate or invalidate the project being verified. Set `LINECALL_BROWSER_EVIDENCE_DIR` when intentionally collecting persistent browser evidence.

## Challenge provenance

LINECALL existed before the WebMCP Challenge as a React run-of-show interface. The challenge copy was created on **2026-08-27** from the pre-existing public project `makiaveli1/sitecraft-linecall`.

The WebMCP extension added during the challenge includes the semantic tool surface, deterministic retiming engine, schedule revisions, human locks, exact-plan approval, receipts, browser discovery proof, and WebMCP-specific evals.

See [`CHALLENGE.md`](./CHALLENGE.md) for the detailed dated work ledger and the explicit pre-existing/new-work boundary.

## Install and run

Requirements: a current Node.js installation and npm.

```bash
npm ci
npm run dev
```

Production build:

```bash
npm run build
```

Run the full test suite:

```bash
npm test
```

## Project structure

```text
.
├── src/
│   ├── App.jsx          # operator UI + human/agent collaboration surface
│   ├── schedule.js      # deterministic timing and constraint engine
│   ├── state.js         # application state, approval, locks, receipts
│   └── webmcp.js        # WebMCP tool definitions and registration
├── evals/               # agent tool-selection / ordering cases
├── tests/               # deterministic, WebMCP, and Chromium evidence tests
├── CHALLENGE.md          # dated competition work ledger
├── LICENSE               # MIT
├── vite.config.js
├── package.json
└── package-lock.json
```

## Technology

- React 19
- Vite
- modern CSS
- WebMCP Imperative API
- Node's built-in test runner
- Chrome DevTools Protocol for browser evidence

No OpenAI API key is required for the core application. WebMCP is the browser-level contract between LINECALL and a compatible agent.

## License

MIT. See [`LICENSE`](./LICENSE).
