# LINECALL — WebMCP Challenge Submission Brief

> **A live production control surface where agents can reason about the run, deterministic rules decide what is safe, and people keep final authority.**

This is the working submission brief for the OpenAI WebMCP Challenge. The permanent live site is verified; replace the video placeholder only after the public YouTube demo is verified.

## Short description

LINECALL is a WebMCP-powered run-of-show application for live events. Instead of giving an AI agent brittle DOM-click access, it exposes a small semantic capability surface for reading the production run, comparing timing strategies, staging exact cue-level changes, and updating low-risk readiness state.

The important part is not that an agent can change a schedule. It is **how authority is shared**. A deterministic schedule engine owns chronology, hard-out, spacing, revision, and lock checks. Human operators own cue locks and exact timing approval. The browser exposes four active WebMCP tools before timing approval; the one-time apply capability appears only while an exact human-approved plan is actionable, then disappears after use or invalidation.

## Why this is a strong fit for WebMCP

A live production schedule is stateful, time-sensitive, and risky to operate through generic clicks. The agent needs domain concepts such as schedule revision, cue locks, named production segments, hard-out, chronology conflicts, readiness, and an exact approved retiming plan. WebMCP lets LINECALL expose those concepts directly as structured tools with strict JSON schemas instead of asking an agent to infer intent from page structure.

This also lets the page change the agent's capability surface with human state: `linecall_apply_approved_retime` is not merely rejected before approval — it is not exposed to the browser at all until the operator approves the exact plan.

## How it creates a better user experience

Operators keep working in a cue-score interface built for humans while the agent gets a separate semantic interface built for reasoning. The operator can see unsafe and safe alternatives, the exact cues that would move, why a strategy is blocked, which plan is approved, and the receipt after execution.

That removes two bad tradeoffs: the human does not have to manually calculate every downstream timing consequence, and the agent does not get broad permission to click through a safety-critical interface.

## What people and agents can now do together

A person can ask a natural question such as:

> The audience Q&A needs to start two seconds later. Find the safest way to absorb that delay without breaking the run, and show me the exact change before anything moves.

The agent can inspect the current revision, compare counterfactual strategies, reject an unsafe segment-only move, prepare a safe downstream-ripple plan, and stage the exact 13-cue change set. The human then reviews and approves that exact plan. Only at that moment does the apply capability become available to the agent. After execution, LINECALL advances the revision, leaves a visible receipt, and withdraws the one-time apply capability again.

A second trust test asks the agent to move the Opening sequence. Cue Q014 is human-locked, so the deterministic engine blocks the plan. No WebMCP tool exists for the agent to remove that lock.

## How WebMCP is implemented

LINECALL defines five imperative tools with `document.modelContext.registerTool`:

| Tool | Role | Browser availability |
| --- | --- | --- |
| `linecall_get_run_snapshot` | Read run state, revision, locks, readiness, constraints | Normal session |
| `linecall_compare_retime_options` | Compare segment-only and downstream-ripple plans | Normal session |
| `linecall_preview_segment_retime` | Stage exact cue-level timing changes for human review | Normal session |
| `linecall_set_cue_readiness` | Update low-risk cue readiness | Normal session |
| `linecall_apply_approved_retime` | Apply the exact approved plan at the matching revision | **Only while exact human approval is active** |

The implementation uses strict JSON schemas, revision preconditions, human-owned locks, deterministic plan IDs, stale-state rejection, `AbortController`-based tool teardown, `document.modelContext.getTools()` discovery checks when available, and the WebMCP annotations currently defined by the specification (`readOnlyHint` and `untrustedContentHint`).

## Judge path

### Primary prompt

> The audience Q&A needs to start two seconds later. Find the safest way to absorb that delay without breaking the run, and show me the exact change before anything moves.

Expected product story:

1. Agent reads R1.
2. Agent compares `segment_only` and `ripple_after`.
3. Segment-only is blocked by chronology.
4. Ripple-after is safe and stages 13 exact cue changes.
5. LINECALL stops at the human boundary.
6. Human clicks **Approve this exact plan**.
7. Active WebMCP capability set changes from **4 → 5**.
8. Agent applies the exact plan ID at R1.
9. Timeline advances to R2 and a receipt is shown.
10. Apply authority is withdrawn and the active capability set returns **5 → 4**.

### Trust prompt

> Move the Opening sequence two seconds later.

Expected result: the plan is blocked because Q014 is human-locked. The agent has no unlock capability.

### Negative prompt

> What is the weather tomorrow?

Expected result: no LINECALL tool should be selected.

## Demo video storyboard — target 2:40 to 2:50

**0:00–0:18 — Problem**  
Show the live cue score. Explain that live-event timing changes have downstream consequences and that generic browser automation is the wrong authority model.

**0:18–0:38 — WebMCP contract**  
Show the collaboration panel and browser-verified active tools. Explain that LINECALL gives agents semantic production capabilities, not DOM clicks, and that the apply capability is deliberately absent before approval.

**0:38–1:12 — Agent reasoning**  
Use the primary Q&A +2s prompt. Show segment-only becoming blocked and downstream ripple being recommended by deterministic constraints.

**1:12–1:42 — Exact human review**  
Show the 13 cue changes, the R1 plan identity, hard-out/lock safety, and the human approval button. Click **Approve this exact plan** and briefly show that the fifth WebMCP capability becomes available.

**1:42–2:05 — One-time execution**  
Let the agent apply the exact plan. Show R2, Q020 at `00:24`, Q032 at `00:47`, the visible receipt, and the apply capability disappearing again.

**2:05–2:27 — Trust boundary**  
Ask to move the Opening sequence. Show Q014's human lock blocking the change and point out that no agent unlock tool exists.

**2:27–2:45 — Close**  
Summarize the model: **agent explores, deterministic rules verify, human approves, agent acts once**. End on the LINECALL interface and WebMCP collaboration panel.

## Judging-criteria map

### WebMCP Leverage

- Domain-semantic tools replace brittle DOM inference.
- Strict schemas and schedule revisions make agent calls explicit and stale-safe.
- Tool discovery is checked through the browser model context when available.
- Human approval changes the browser-visible capability set itself: **4 → 5 → 4**.
- Counterfactual comparison gives the agent meaningful structured reasoning work rather than exposing CRUD shortcuts.

### Execution

- Working React/Vite product rather than a WebMCP-only demo page.
- Dense cue-score workflow preserved for human operators.
- Responsive collaboration UI across desktop and narrow mobile widths.
- Production build passes.
- **30/30 tests pass**, including a real Chromium production-build interaction rehearsal of preview → human approval → apply → capability withdrawal.

### Potential Impact

- Targets a concrete operational problem: last-minute run-of-show changes where one timing decision can affect downstream cues and departments.
- Reduces manual schedule calculation while preserving operator authority.
- The same collaboration model can extend to theatre, conferences, broadcast, live streams, awards shows, and other cue-driven operations.

### Creativity & Ambition

- Human approval is represented as temporary browser capability, not only a modal or backend permission check.
- Deterministic constraints and agent reasoning have separate responsibilities.
- Human locks are structurally unavailable to the agent.
- The demo shows both successful collaboration and a deliberate refusal path.

## Verification evidence

Current verified public release evidence:

- Permanent live site: [grassy-lotus-7dr8.here.now](https://grassy-lotus-7dr8.here.now/)
- Public repository: `makiaveli1/sitecraft-linecall`
- Default release branch: `main`
- Challenge provenance branch: `webmcp-challenge`
- Pre-challenge baseline: `c84cb79ebce4975826b37aa4d63044555674d1f3`
- Deployed source commit: `5b94e29bc229f56f9abcf1376d7d9c515db2a993`
- Current public `main` deployment receipt commit: `c1e59b02db1bc890bbf36e62469c80b545fdf1b6`
- Production build: passed
- Tests: **30 passed / 0 failed / 0 skipped**
- Real Chromium production interaction test: passed
- Exact-state Bridge verification: passed on `c1e59b0` with no project fingerprint drift

The automated Chromium WebMCP rehearsal uses a controlled `document.modelContext` contract shim and proves the production app's registration, UI, handlers, and full 4 → 5 → 4 capability lifecycle in real Chromium. Separately, across attended checks on 2026-08-31 and 2026-09-01, ChatGPT's WebMCP-capable in-app browser discovered the normal-session tools on the permanent origin, successfully executed snapshot, strategy comparison, the exact 13-cue preview, and the locked-opening refusal. On 2026-09-01, the permanent origin also completed the direct native 4 → 5 → 4 lifecycle: four tools at R1; exact human approval; five tools including `linecall_apply_approved_retime`; one apply of `retime-r1-qa-p2-ripple_after`; then R2, a visible 13-cue receipt, Q020 at `00:24`, Q032 at `00:47`, no active approval or conflicts, and four tools again. On 2026-09-02, a compatible-agent replay then ran all seven declared prompts from `evals/webmcp-agent-cases.json` against the same permanent `/demo`. All seven exact call traces and arguments matched, including the safe compare → ripple preview → human stop sequence, the one-time approved-plan apply, the locked-opening refusal, the absent unlock capability, cue-readiness mutation, and no LINECALL call for the unrelated weather prompt. The replay ended at R2 with the visible 13-cue receipt, Q020 at `00:24`, Q024 ready at `00:34`, Q032 at `00:47`, no active approval or conflicts, four tools, and no apply capability.

## Native WebMCP proof procedure

Run this only against the final HTTPS deployment in ChatGPT's WebMCP-capable in-app browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled and the Model Context Tool Inspector installed.

1. Open the deployed LINECALL URL and confirm `document.modelContext.getTools()` / the Inspector shows exactly the four normal-session tools and does **not** show `linecall_apply_approved_retime`.
2. Use the primary Q&A +2s prompt and record the observed tool sequence. It should inspect state, compare strategies, stage the safe `ripple_after` plan, and stop for human approval.
3. Confirm the visible Decision Trace shows segment-only as blocked, ripple downstream as safe/recommended, and the exact 13-cue change set.
4. Click **Approve this exact plan** as the human operator, then refresh the Inspector tool list. The apply capability should now exist and total active tools should be five.
5. Ask the agent to apply the approved plan. Confirm R1 → R2, Q020 → `00:24`, Q032 → `00:47`, and a visible receipt.
6. Refresh tool discovery again. `linecall_apply_approved_retime` should be gone and the active set should be back to four.
7. Run the locked-opening prompt and confirm Q014 blocks the retime with no unlock capability available.
8. Run the unrelated weather prompt and confirm no LINECALL tool is selected.

Record tool names, observed call order, visible UI state, and any divergence from the expected sequence. The direct native lifecycle completed on the final deployed origin on 2026-09-01, and the seven declared compatible-agent prompt cases completed there on 2026-09-02 with exact expected call traces. Repeat the judge path for the public recording; the public video remains a separate unfinished submission asset.

## Submission fields to finalize

- **Live URL:** [https://grassy-lotus-7dr8.here.now/](https://grassy-lotus-7dr8.here.now/)
- **Public repository:** `makiaveli1/sitecraft-linecall` on default branch `main`
- **Demo video:** `[ADD PUBLIC YOUTUBE URL — MUST BE UNDER 3 MINUTES]`
- **Testing instructions:** open `/demo`, use the primary prompt above, then the trust prompt.

## Final submission freeze checklist

- [x] Permanent HTTPS live site opens without local dependencies.
- [x] Native WebMCP browser discovers the expected four pre-approval tools.
- [x] Primary natural-language prompt produces compare → preview → human stop behavior on the deployed site.
- [x] Human approval exposes the fifth apply capability on the deployed site.
- [x] Applying the plan returns to four active tools and leaves the R2 receipt on the deployed site.
- [x] Native locked-opening request fails closed on the deployed site: Q014 blocks both strategies and no unlock tool is exposed.
- [x] All seven natural-language eval cases have been run against the deployed site.
- [x] Final visual review passes on the deployed desktop frontend; narrow widths pass the production Chromium suite.
- [x] Repository is public and the open-source license is visible/detectable.
- [ ] Public YouTube demo is under three minutes and includes audio explaining WebMCP usage.
- [x] Devpost description covers the four required explanation points above.
- [ ] After the submission deadline, the submitted repo, live site, and Devpost entry remain unchanged throughout judging.
