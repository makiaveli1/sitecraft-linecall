# LINECALL — WebMCP Challenge Submission Brief

> **A live production control surface where agents can reason about the run, deterministic rules decide what is safe, and people keep final authority.**

This is a working submission brief for the OpenAI WebMCP Challenge. Replace the live-site and video placeholders only after those artifacts are verified.

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
- **29/29 tests pass**, including a real Chromium production-build interaction rehearsal of preview → human approval → apply → capability withdrawal.

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

Current verified challenge branch evidence:

- Public branch: `makiaveli1/sitecraft-linecall` → `webmcp-challenge`
- Pre-challenge baseline: `c84cb79ebce4975826b37aa4d63044555674d1f3`
- Current hardening commit: `4db6e514d5befa2ec4c0820f2447acb694bfd860`
- Production build: passed
- Tests: **29 passed / 0 failed / 0 skipped**
- Real Chromium production interaction test: passed
- Exact-state Bridge verification: passed with no project fingerprint drift

The automated Chromium WebMCP rehearsal uses a controlled `document.modelContext` contract shim. It proves the production app's registration, capability lifecycle, UI, and handlers in real Chromium, but it is **not** claimed as native experimental-WebMCP proof. Native proof remains a separate pre-submission gate.

## Submission fields to finalize

- **Live URL:** `[ADD ONLY AFTER VERIFIED DEPLOYMENT]`
- **Public repository:** `makiaveli1/sitecraft-linecall`, branch `webmcp-challenge`
- **Demo video:** `[ADD PUBLIC YOUTUBE URL — MUST BE UNDER 3 MINUTES]`
- **Testing instructions:** use the primary prompt above, then the trust prompt.

## Final submission freeze checklist

- [ ] Permanent HTTPS live site opens without local dependencies.
- [ ] Native WebMCP browser discovers the expected four pre-approval tools.
- [ ] Primary prompt produces compare → preview → human stop behavior.
- [ ] Human approval exposes the fifth apply capability.
- [ ] Applying the plan returns to four active tools and leaves the R2 receipt.
- [ ] Human-lock prompt fails closed.
- [ ] All seven natural-language eval cases have been run against the deployed site.
- [ ] Final visual review passes on the deployed frontend.
- [ ] Repository is public and the open-source license is visible/detectable.
- [ ] Public YouTube demo is under three minutes and includes audio explaining WebMCP usage.
- [ ] Devpost description uses the four required explanation points above.
- [ ] After the submission deadline, the submitted repo, live site, and Devpost entry remain unchanged throughout judging.
