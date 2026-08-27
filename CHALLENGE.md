# LINECALL WebMCP Challenge Work Ledger

## Competition boundary

This challenge folder was created on 2026-08-27 from the pre-existing public LINECALL application in `makiaveli1/sitecraft-linecall`.

The original project remains preserved separately from this challenge branch. The public pre-challenge baseline is `makiaveli1/sitecraft-linecall` at commit `c84cb79ebce4975826b37aa4d63044555674d1f3`.

Only the WebMCP-specific extension work performed after the WebMCP Challenge opened on 2026-08-25 is challenge work. The original run-of-show interface, React application shell, and prior SITECRAFT fixture work predate the competition.

## Challenge concept

LINECALL is becoming an agent-native live-production control surface. A human operator owns critical authority boundaries while an agent can inspect structured run-of-show state, compare timing strategies, preview deterministic retiming plans, update low-risk readiness state, and apply only the exact timing plan that the human approved.

This is intentionally different from giving an agent generic DOM-click access. The agent receives a narrow semantic tool surface designed around the real job.

The collaboration model is:

1. The agent reads the current run and revision.
2. The agent compares counterfactual timing strategies before choosing one.
3. LINECALL deterministically checks chronology, spacing, hard-out, revision, and human-lock constraints.
4. The agent can stage an exact cue-level preview.
5. The operator reviews and approves that exact plan in the visible interface.
6. Only the approved plan ID at the matching revision can be applied.
7. Successful schedule mutation advances the revision and leaves a visible receipt.

Human cue locks are not exposed as an agent tool. An agent cannot unlock a cue or approve its own plan.

## WebMCP work added on 2026-08-27

### Agent tool surface

Defined five imperative WebMCP tools with `document.modelContext.registerTool`, while dynamically exposing only the currently usable subset to the browser. Four tools are available before timing approval; `linecall_apply_approved_retime` is registered only while an exact operator-approved plan is active, then withdrawn after use or invalidation:

- `linecall_get_run_snapshot`
- `linecall_compare_retime_options`
- `linecall_preview_segment_retime`
- `linecall_apply_approved_retime`
- `linecall_set_cue_readiness`

The surface is deliberately small. Timing mutation uses explicit `plan_id` and `expected_revision` preconditions.

### Tool trust annotations

The WebMCP contract was audited against the current Chrome guidance.

- Snapshot and counterfactual comparison use the standardized `readOnlyHint` because they do not change state.
- `linecall_preview_segment_retime` is correctly marked state-changing because it changes visible collaboration state even though it does not alter cue timing.
- The contract now uses only annotations defined by the current WebMCP specification: `readOnlyHint` and `untrustedContentHint`.
- Tools that can return operator-authored schedule content use `untrustedContentHint`.
- The apply tool remains an explicit mutation, is hidden until exact human approval exists, and is withdrawn after the approved action is consumed or invalidated.

### Deterministic scheduling engine

Added:

- schedule revisions;
- named production segments;
- human-owned cue locks;
- hard-out enforcement;
- chronology validation;
- same-department minimum spacing validation;
- segment-only and downstream-ripple retiming modes;
- counterfactual strategy comparison;
- deterministic exact plan IDs;
- stale-revision rejection;
- visible exact-plan approval; and
- one-time application receipts.

### Human + agent interface

Added an in-product WebMCP collaboration surface showing:

- WebMCP registration state;
- current schedule revision;
- agent authority model;
- human authority boundary;
- exact proposed cue changes;
- deterministic conflicts;
- human approval state;
- latest applied-change receipt;
- per-cue human lock controls; and
- browser-level tool discovery status.

When `document.modelContext.getTools()` is available, LINECALL checks whether the currently active capability set can be rediscovered and distinguishes browser-verified discovery from registration-only state. The expected lifecycle is four tools before approval, five while an exact approved retime is actionable, and four again after that one-time authority is consumed or invalidated.

### WebMCP agent evals

Added `evals/webmcp-agent-cases.json` with seven challenge-focused cases:

1. direct current-run inspection;
2. indirect safe Q&A retiming;
3. application of an already human-approved exact plan;
4. refusal to move a human-locked opening cue;
5. absence of an agent capability to remove a human lock;
6. cue-readiness mutation; and
7. an unrelated weather request where no LINECALL tool should be selected.

The indirect Q&A case encodes the intended sequence:

`get snapshot -> compare strategies -> preview safe strategy -> stop for human approval`

It explicitly forbids applying the timing change before approval.

`tests/webmcp-evals.test.js` verifies that expected calls reference real registered tool names and that their arguments conform to the actual tool schemas.

### Browser and verification hardening

The Chromium evidence test originally wrote screenshots and reports into the project while the verification workflow was fingerprinting that same project. It also treated the entire project tree as production-build input. That made a passing test capable of invalidating its own verification receipt.

This was corrected so that:

- production freshness checks watch actual build inputs (`src`, `index.html`, `package-lock.json`, and `vite.config.js`);
- automated Chromium artifacts default to a unique operating-system temporary directory;
- `LINECALL_BROWSER_EVIDENCE_DIR` can be set when persistent evidence collection is intentional; and
- normal verification does not mutate the project under verification.

## Current verification evidence

Latest registered PC Bridge `verify` workflow:

- status: **passed**;
- tests: **29/29 passed**;
- failures: **0**;
- skips: **0**;
- real Chromium production-build rendering and interaction test: **passed**;
- deterministic schedule safety tests: **passed**;
- WebMCP tool-contract tests: **passed**;
- WebMCP registration/discovery runtime-contract tests: **passed**;
- WebMCP agent-eval contract tests: **passed**;
- exact project state remained stable for the full verification run.

The production Vite build also passes.

Important evidence boundary: the automated runtime test proves our `registerTool`/`getTools` integration logic against a controlled browser-model-context stub, and the Chromium suite proves the real production UI in Chrome. A separate attended run in a WebMCP-enabled browser is still required before claiming end-to-end live WebMCP agent proof.

## Demo path

The strongest current judge demo combines failure, reasoning, human authority, and successful recovery:

1. Ask the agent to inspect LINECALL.
2. Ask: “The audience Q&A needs to start two seconds later. Find the safest way to absorb that delay without breaking the run, and show me the exact change before anything moves.”
3. The agent compares `segment_only` with `ripple_after`.
4. LINECALL deterministically rejects `segment_only` because it breaks chronology.
5. `ripple_after` is safe and produces an exact 13-cue change set.
6. The agent stages that exact plan and stops at the human boundary.
7. The operator clicks **Approve this exact plan**.
8. The agent applies the exact plan ID at revision R1.
9. The timeline reflows to R2 and LINECALL leaves a visible receipt.
10. Ask the agent to move the Opening sequence. Cue Q014 blocks the change because it is human-locked, and no WebMCP unlock tool exists.

This demonstrates that the agent is not merely operating the interface. It is collaborating through a domain-specific capability contract while deterministic rules and human authority constrain what can actually happen.

## Submission requirements already addressed locally

- Existing-project boundary documented with a dated baseline and challenge ledger.
- `document.modelContext.registerTool` implementation present in source.
- Open-source `LICENSE` file added at repository root.
- Installation, implementation, test, and judge-testing guidance promoted into the main README.

## Remaining competition work

Highest priority:

1. Deploy the freshly verified default `main` production `dist/` to a permanent HTTPS site and confirm WebMCP discovery on that exact deployment. `main` now contains the verified challenge release while `webmcp-challenge` remains as an explicit provenance branch from the pre-challenge baseline.
2. Run the deployed app in ChatGPT's WebMCP-capable in-app browser or Chrome 149+ with WebMCP enabled and capture genuine tool discovery + execution evidence, including the 4 -> 5 -> 4 approval-gated capability lifecycle.
3. Run the seven natural-language eval prompts through the Model Context Tool Inspector / compatible agent and record observed call sequences, failures, and prompt/tool-description refinements.
4. Perform a final attended visual review of the deployed frontend and fix only issues supported by fresh evidence.
5. Finalize submission copy and a public YouTube demo under three minutes.

Do not claim the challenge goal complete until live WebMCP execution, public provenance, deployment, and submission assets are verified.
