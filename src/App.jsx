import React, { useEffect, useMemo, useReducer, useRef } from 'react';

import { CUES, SHOW_META } from './data.js';
import { ShowPulse } from './presentation.jsx';
import { SEGMENTS, compareRetimeStrategies, createRunSnapshot, previewSegmentRetime } from './schedule.js';
import {
  DEPARTMENTS,
  appReducer,
  createInitialState,
  filterCues,
  getSequenceContext,
  nextVisibleCueId,
} from './state.js';
import { registerLinecallWebMCP } from './webmcp.js';
import {
  DemoProductBar,
  HomePage,
  NotFoundPage,
  ProductPage,
  SiteFooter,
  SiteNav,
  TrustPage,
} from './site.jsx';

const DEPARTMENT_LABELS = {
  stage: 'Stage',
  audio: 'Audio',
  lighting: 'Lighting',
  video: 'Video',
};

const READINESS_LABELS = {
  pending: 'Pending',
  ready: 'Ready',
  check: 'Check',
};

function cueNumber(cue) {
  return String(cue.number).padStart(3, '0');
}

function readinessNext(value) {
  if (value === 'pending') return 'ready';
  if (value === 'ready') return 'check';
  return 'pending';
}

function RunStateLabel({ cue }) {
  if (cue.runState === 'current') return <span className="run-state run-state--current">Now</span>;
  if (cue.runState === 'complete') return <span className="run-state">Done</span>;
  return <span className="run-state">Up</span>;
}

function CueRow({
  cue,
  readiness,
  selected,
  segmentLabel,
  previewChange,
  onSelect,
  onMove,
  onQuickReadiness,
  registerButton,
}) {
  return (
    <li
      className={`cue-row ${selected ? 'cue-row--selected' : ''} ${segmentLabel ? 'cue-row--segment-start' : ''} ${previewChange ? 'cue-row--preview-shift' : ''} cue-row--${cue.runState}`}
      data-department={cue.department}
    >
      <span className="cue-rail" aria-hidden="true" />
      <button
        ref={(node) => registerButton(cue.id, node)}
        className="cue-select"
        type="button"
        aria-current={cue.runState === 'current' ? 'step' : undefined}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={onMove}
      >
        <span className="cue-number">Q{cueNumber(cue)}</span>
        <time className="cue-time" dateTime={`PT${cue.timecode.replace(':', 'M')}S`}>
          {cue.timecode}
        </time>
        <span className="cue-copy">
          {segmentLabel ? <span className="cue-segment-label">{segmentLabel}</span> : null}
          <span className="cue-label">{cue.label}</span>
          <span className="cue-instruction">{cue.instruction}</span>
          {previewChange ? (
            <span className="cue-preview-shift" aria-label={`Preview moves cue ${cueNumber(cue)} from ${previewChange.from} to ${previewChange.to}`}>
              <b>PREVIEW</b><code>{previewChange.from} → {previewChange.to}</code>
            </span>
          ) : null}
          {cue.locked ? <span className="cue-lock-note">Human lock</span> : null}
        </span>
        <span className="cue-department" data-department={cue.department}>
          {DEPARTMENT_LABELS[cue.department]}
        </span>
        <RunStateLabel cue={cue} />
      </button>
      <button
        className={`readiness-chip readiness-chip--${readiness}`}
        type="button"
        onClick={onQuickReadiness}
        aria-label={`Cue ${cueNumber(cue)} readiness: ${READINESS_LABELS[readiness]}. Change readiness.`}
      >
        {READINESS_LABELS[readiness]}
      </button>
    </li>
  );
}

function CueInspector({ cue, readiness, onReadiness, onToggleLock, onClose, headingRef, unavailable = false }) {
  if (unavailable) {
    return (
      <aside className="inspector inspector--empty" aria-label="Cue detail unavailable">
        <p className="eyebrow">Cue detail</p>
        <h2>Run data unavailable</h2>
        <p>Restore the demo run before relying on cue detail or readiness controls.</p>
      </aside>
    );
  }

  if (!cue) {
    return (
      <aside className="inspector inspector--empty" aria-label="Cue detail">
        <p className="eyebrow">Cue detail</p>
        <h2>Select a cue</h2>
        <p>Open any cue to inspect its call, department, readiness, and human lock state.</p>
      </aside>
    );
  }

  return (
    <aside className="inspector" aria-labelledby="cue-detail-title">
      <div className="inspector-topline">
        <div>
          <p className="eyebrow">Selected cue</p>
          <p className="inspector-cue-id">Q{cueNumber(cue)} · {cue.timecode}</p>
        </div>
        <button className="detail-back" type="button" onClick={onClose}>
          Return to cue score
        </button>
      </div>

      <h2 id="cue-detail-title" ref={headingRef} tabIndex="-1">
        {cue.label}
      </h2>
      <p className="inspector-department">
        <span className="department-mark" data-department={cue.department} aria-hidden="true" />
        {DEPARTMENT_LABELS[cue.department]}
      </p>
      <p className="inspector-instruction">{cue.instruction}</p>
      {cue.notes ? <p className="inspector-notes">{cue.notes}</p> : null}

      <fieldset className="readiness-control">
        <legend>Readiness</legend>
        <div className="segmented-control">
          {Object.entries(READINESS_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={readiness === value}
              className={readiness === value ? 'is-active' : ''}
              onClick={() => onReadiness(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="human-boundary">
        <div>
          <p className="eyebrow">Human authority</p>
          <strong>{cue.locked ? 'Agent timing changes blocked' : 'Agent timing changes allowed after approval'}</strong>
        </div>
        <button
          type="button"
          className={cue.locked ? 'lock-control lock-control--active' : 'lock-control'}
          onClick={onToggleLock}
        >
          {cue.locked ? 'Unlock cue' : 'Lock cue'}
        </button>
      </div>

      <dl className="cue-facts">
        <div>
          <dt>Sequence state</dt>
          <dd>{cue.runState === 'current' ? 'Current cue' : cue.runState === 'complete' ? 'Completed' : 'Upcoming'}</dd>
        </div>
        <div>
          <dt>Segment</dt>
          <dd>{cue.segment}</dd>
        </div>
      </dl>
    </aside>
  );
}

function AgentCollaborationPanel({
  webmcp,
  revision,
  preview,
  comparison,
  approvedPlanId,
  receipts,
}) {
  const statusLabel = webmcp.status === 'registered'
    ? webmcp.browserVerified
      ? `${webmcp.toolCount} tools browser-verified`
      : `${webmcp.toolCount} tools registered`
    : webmcp.status === 'unsupported'
      ? 'Browser support needed'
      : webmcp.status === 'error'
        ? 'Registration error'
        : 'Checking…';

  return (
    <section className="agent-panel" aria-labelledby="agent-panel-title">
      <div className="agent-panel__heading">
        <div className="agent-panel__title-copy">
          <p className="eyebrow">Your intelligent second caller</p>
          <h2 id="agent-panel-title">Ask LINECALL to solve the timing</h2>
          <p className="agent-panel__lede">
            Describe the problem in the browser chat. LINECALL reads the run, compares safe options, and shows the exact cue changes before anything moves.
          </p>
        </div>
        <div className="agent-panel__status" data-status={webmcp.status}>
          <span aria-hidden="true" />
          {statusLabel}
        </div>
      </div>

      <div className="agent-panel__facts">
        <div>
          <span className="eyebrow">Schedule revision</span>
          <strong>R{revision}</strong>
        </div>
        <div>
          <span className="eyebrow">Agent authority</span>
          <strong>Inspect · compare · preview</strong>
        </div>
        <div>
          <span className="eyebrow">Human boundary</span>
          <strong>Locks + exact timing approval</strong>
        </div>
        <div>
          <span className="eyebrow">WebMCP proof</span>
          <strong>
            {webmcp.browserVerified
              ? `Discovered ${webmcp.discoveredToolCount}/${webmcp.toolCount}`
              : webmcp.status === 'registered'
                ? 'Tools registered'
                : 'Pending'}
          </strong>
        </div>
      </div>

      <ol className="decision-rail" aria-label="LINECALL timing authority path">
        <li>
          <span aria-hidden="true">1</span>
          <div><strong>Agent compares</strong><small>Counterfactual timing options</small></div>
        </li>
        <li>
          <span aria-hidden="true">2</span>
          <div><strong>Rules verify</strong><small>Locks · chronology · hard out</small></div>
        </li>
        <li>
          <span aria-hidden="true">3</span>
          <div><strong>Human approves</strong><small>Exact plan + schedule revision</small></div>
        </li>
        <li>
          <span aria-hidden="true">4</span>
          <div><strong>Agent applies once</strong><small>Revision advances; apply capability closes</small></div>
        </li>
      </ol>

      {comparison ? (
        <section className="strategy-comparison" aria-labelledby="strategy-comparison-title">
          <div className="strategy-comparison__heading">
            <div>
              <p className="eyebrow">Decision trace · deterministic rules</p>
              <h3 id="strategy-comparison-title">Two timing strategies checked</h3>
            </div>
            <span className={`strategy-verdict strategy-verdict--${comparison.status}`}>
              {comparison.recommendedMode
                ? `${comparison.recommendedMode === 'ripple_after' ? 'Ripple downstream' : 'Segment only'} recommended`
                : 'No safe strategy'}
            </span>
          </div>
          <div className="strategy-comparison__options">
            {comparison.options.map((option) => {
              const isRecommended = option.mode === comparison.recommendedMode;
              const detail = option.lockedCueId
                ? `Human lock ${option.lockedCueId.replace('cue-', 'Q')}`
                : option.conflicts?.[0]?.message ?? 'All active constraints satisfied.';
              return (
                <article
                  key={option.mode}
                  className={`strategy-option strategy-option--${option.status}${isRecommended ? ' is-recommended' : ''}`}
                >
                  <div className="strategy-option__topline">
                    <strong>{option.mode === 'ripple_after' ? 'Ripple downstream' : 'Segment only'}</strong>
                    <span>{option.status === 'ready' ? 'Safe' : 'Blocked'}</span>
                  </div>
                  <p>{detail}</p>
                  <small>{option.changedCueCount} exact cue change{option.changedCueCount === 1 ? '' : 's'}</small>
                  {isRecommended ? <em>Recommended by deterministic constraints</em> : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {preview ? (
        <article className={`agent-plan agent-plan--${preview.status}`} aria-live="polite">
          <div className="agent-plan__topline">
            <div>
              <p className="eyebrow">Agent plan</p>
              <h3>{preview.segmentLabel ?? 'Retime request'}</h3>
            </div>
            {preview.planId ? <code>{preview.planId}</code> : null}
          </div>
          <p>{preview.message}</p>

          {preview.changes?.length ? (
            <ol className="agent-plan__changes">
              {preview.changes.slice(0, 5).map((change) => (
                <li key={change.cueId}>
                  <strong>Q{String(change.cueNumber).padStart(3, '0')}</strong>
                  <span>{change.label}</span>
                  <code>{change.from} → {change.to}</code>
                </li>
              ))}
              {preview.changes.length > 5 ? (
                <li className="agent-plan__more">+ {preview.changes.length - 5} more exact cue changes</li>
              ) : null}
            </ol>
          ) : null}

          {preview.conflicts?.length ? (
            <ul className="agent-plan__conflicts">
              {preview.conflicts.map((conflict, index) => (
                <li key={`${conflict.type}-${conflict.cueId}-${index}`}>{conflict.message}</li>
              ))}
            </ul>
          ) : null}

          <div className="agent-plan__handoff">
            <span>{approvedPlanId === preview.planId ? 'APPROVAL RECORDED' : 'REVIEW EVIDENCE'}</span>
            <p>
              {approvedPlanId === preview.planId
                ? 'This exact plan is approved. The pinned decision bar controls the one guarded apply.'
                : 'These details explain the recommendation. The pinned decision bar controls the human decision.'}
            </p>
          </div>
          {approvedPlanId === preview.planId ? (
            <p className="agent-plan__approval">Approval is bound to this plan ID and revision. The agent can apply it once.</p>
          ) : null}
        </article>
      ) : (
        <div className="agent-brief">
          <div className="agent-brief__copy">
            <p className="eyebrow">Try it now</p>
            <strong>Tell LINECALL what changed in the show.</strong>
            <span>Use normal language in the browser chat. LINECALL will reason over this exact run and stop before consequential timing moves.</span>
          </div>
          <div className="agent-brief__steps" aria-label="How to use LINECALL with an agent">
            <div><span>01</span><strong>Ask</strong><small>Describe the timing problem.</small></div>
            <div><span>02</span><strong>Review</strong><small>See safe options and exact cue changes.</small></div>
            <div><span>03</span><strong>Approve</strong><small>Open a one-time apply window only if the plan is right.</small></div>
          </div>
          <blockquote>
            “Audience Q&amp;A needs to start two seconds later. Find the safest way to absorb the delay without breaking the run, and show me the exact change before anything moves.”
          </blockquote>
        </div>
      )}

      {receipts.length ? (
        <div className="agent-receipt">
          <p className="eyebrow">Latest receipt</p>
          <strong>{receipts[0].summary}</strong>
          <span>{receipts[0].changedCueCount} cues · {receipts[0].source} · R{receipts[0].revision}</span>
        </div>
      ) : null}
    </section>
  );
}

function DemoScenarioConsole({
  revision,
  preview,
  comparison,
  approvedPlanId,
  receipts,
  onStart,
}) {
  const latestReceipt = receipts[0] ?? null;
  const applied = Boolean(latestReceipt && revision > 1);
  const approved = Boolean(preview?.status === 'ready' && approvedPlanId === preview.planId);
  const ready = preview?.status === 'ready';
  const activeStep = applied ? 4 : approved ? 3 : ready ? 2 : 1;
  const safeOption = comparison?.options?.find((option) => option.status === 'ready') ?? null;
  const blockedOption = comparison?.options?.find((option) => option.status === 'blocked') ?? null;
  const changedCueCount = preview?.changes?.length ?? latestReceipt?.changedCueCount ?? 0;

  const stepClass = (step) => activeStep > step ? 'is-complete' : activeStep === step ? 'is-current' : '';

  return (
    <section className={`demo-scenario-console ${applied ? 'is-applied' : approved ? 'is-approved' : ready ? 'is-preview' : 'is-idle'}`} id="demo-scenario" aria-labelledby="demo-scenario-title">
      <div className="demo-scenario-console__top">
        <div>
          <p className="eyebrow">Guided pressure test</p>
          <h2 id="demo-scenario-title">Make Audience Q&amp;A two seconds late.</h2>
          <p>Watch LINECALL compare two futures, light up every cue that would move, stop for your approval, then advance the run from R1 to R2.</p>
        </div>
        <div className="demo-scenario-console__state" aria-live="polite">
          <small>CURRENT STATE</small>
          <strong>{applied ? `R${revision} · APPLIED` : approved ? 'APPROVED · APPLY OPEN' : ready ? `${changedCueCount} CUES · PREVIEW` : `R${revision} · READY`}</strong>
        </div>
      </div>

      <ol className="demo-scenario-rail" aria-label="Guided LINECALL scenario progress">
        <li className={stepClass(1)}><span>01</span><div><strong>Pressure</strong><small>Q&amp;A +2 seconds</small></div></li>
        <li className={stepClass(2)}><span>02</span><div><strong>Compare + preview</strong><small>Two futures · exact cue impact</small></div></li>
        <li className={stepClass(3)}><span>03</span><div><strong>Human approval</strong><small>One plan · one revision</small></div></li>
        <li className={stepClass(4)}><span>04</span><div><strong>R2 receipt</strong><small>Apply once · authority closes</small></div></li>
      </ol>

      <div className="demo-scenario-visual">
        <div className="demo-scenario-visual__request">
          <span>LIVE CHANGE</span>
          <strong>Q&amp;A</strong>
          <b>+2s</b>
          <small>Audience interaction needs two more seconds.</small>
        </div>

        <div className="demo-scenario-visual__fork" aria-label="Timing strategy comparison">
          <article className={blockedOption ? 'is-blocked' : ''}>
            <span>FUTURE A</span>
            <strong>Segment only</strong>
            <b>{blockedOption ? 'BLOCKED' : '—'}</b>
            <small>{blockedOption?.conflicts?.[0]?.message ?? 'Waiting for the pressure test.'}</small>
          </article>
          <article className={safeOption ? 'is-safe' : ''}>
            <span>FUTURE B</span>
            <strong>Ripple downstream</strong>
            <b>{safeOption ? 'SAFE' : '—'}</b>
            <small>{safeOption ? `${safeOption.changedCueCount} cues move together and active constraints stay satisfied.` : 'Waiting for the pressure test.'}</small>
          </article>
        </div>

        <div className="demo-impact-map" aria-label="Previewed downstream cue impact">
          <div className="demo-impact-map__heading"><span>DOWNSTREAM IMPACT</span><b>{changedCueCount || '—'} cues</b></div>
          <div className="demo-impact-map__nodes">
            {preview?.changes?.length ? preview.changes.map((change, index) => (
              <span key={change.cueId} style={{ '--impact-index': index }} title={`${change.label}: ${change.from} to ${change.to}`}>
                Q{String(change.cueNumber).padStart(3, '0')}
              </span>
            )) : Array.from({ length: 13 }, (_, index) => <span key={index} className="is-placeholder">{String(index + 1).padStart(2, '0')}</span>)}
          </div>
          <small>{ready ? 'Every highlighted cue below shows its projected time before the live run changes.' : applied ? 'The approved projection is now the live R2 schedule.' : 'Run the pressure test to reveal the exact cue chain.'}</small>
        </div>
      </div>

      <div className="demo-scenario-console__action">
        {!ready && !applied ? (
          <button type="button" className="demo-scenario-primary" data-demo-action="start" onClick={onStart}>Run the +2s pressure test</button>
        ) : (
          <div className="demo-scenario-console__handoff" aria-live="polite">
            <span>{applied ? 'R2 IS LIVE' : approved ? 'APPROVAL RECORDED' : 'LOOK AT THE CYAN CUE SHIFTS'}</span>
            <p>
              {applied
                ? latestReceipt?.summary ?? 'The approved plan was applied once and the run advanced.'
                : approved
                  ? 'The exact plan is approved. The pinned decision bar now exposes one guarded apply to R2.'
                  : 'LINECALL has moved your view to the first affected cue. Nothing has changed yet; cyan rows are the proposal.'}
            </p>
          </div>
        )}
        {!ready && !applied ? <p>This uses the real deterministic planner on the current run. No prerecorded animation.</p> : null}
      </div>
    </section>
  );
}

function DemoDecisionDock({
  revision,
  preview,
  approvedPlanId,
  receipts,
  onApprove,
  onApply,
  onDismiss,
  onReset,
}) {
  const latestReceipt = receipts[0] ?? null;
  const applied = Boolean(latestReceipt && revision > 1);
  const approved = Boolean(preview?.status === 'ready' && approvedPlanId === preview.planId);
  const ready = preview?.status === 'ready';
  if (!ready && !applied) return null;

  const changedCueCount = preview?.changes?.length ?? latestReceipt?.changedCueCount ?? 0;
  const state = applied ? 'applied' : approved ? 'approved' : 'review';
  const step = applied ? '04 / 04 · R2 LIVE' : approved ? '03 / 04 · HUMAN APPROVED' : '02 / 04 · REVIEW PROJECTION';
  const title = applied
    ? `${changedCueCount} cue changes are now live in R${revision}.`
    : approved
      ? 'This exact plan is approved. One guarded apply is open.'
      : `${changedCueCount} cue times are projected to move.`;
  const detail = applied
    ? 'The preview became the live schedule and the one-time apply authority closed.'
    : approved
      ? 'Nothing else can be substituted. Apply this plan once to create R2.'
      : 'Cyan rows are proposed times only. Unchanged controls are dimmed so you can inspect the consequence before approving it.';

  return (
    <section className={`demo-decision-dock is-${state}`} aria-label="Guided demo decision" aria-live="polite">
      <div className="demo-decision-dock__signal" aria-hidden="true" />
      <div className="demo-decision-dock__copy">
        <span>{step}</span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <div className="demo-decision-dock__legend" aria-label="Cue preview legend">
        {!applied ? <><span className="is-projected">CYAN = PROPOSED</span><span>GREY = UNCHANGED</span></> : <span className="is-live">R{revision} = LIVE</span>}
      </div>
      <div className="demo-decision-dock__actions">
        {!approved && !applied ? (
          <>
            <button type="button" className="demo-decision-primary" data-demo-decision-action="approve" onClick={onApprove}>Approve {changedCueCount}-cue plan</button>
            <button type="button" className="demo-decision-secondary" onClick={onDismiss}>Dismiss</button>
          </>
        ) : approved ? (
          <button type="button" className="demo-decision-primary" data-demo-decision-action="apply" onClick={onApply}>Apply approved plan → R2</button>
        ) : (
          <button type="button" className="demo-decision-secondary" data-demo-decision-action="reset" onClick={onReset}>Reset demo to R1</button>
        )}
      </div>
    </section>
  );
}

export function App() {
  const initialState = useMemo(() => createInitialState(CUES), []);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const stateRef = useRef(state);
  const webmcpApiRef = useRef(null);
  const cueButtons = useRef(new Map());
  const inspectorHeadingRef = useRef(null);
  const scoreHeadingRef = useRef(null);
  const shouldFocusInspector = useRef(false);

  stateRef.current = state;

  const visibleCues = useMemo(
    () => filterCues(state.schedule, state),
    [state.schedule, state.departments, state.query],
  );
  const visibleIds = useMemo(() => visibleCues.map((cue) => cue.id), [visibleCues]);
  const selectedCue = state.schedule.find((cue) => cue.id === state.selectedCueId) ?? null;
  const sequence = useMemo(() => getSequenceContext(state.schedule), [state.schedule]);
  const retimeComparison = useMemo(() => {
    const preview = state.retimePreview;
    if (!preview?.segmentId || !Number.isInteger(preview.offsetSeconds)) return null;
    return compareRetimeStrategies({
      schedule: state.schedule,
      revision: state.revision,
      expectedRevision: preview.expectedRevision ?? preview.revision ?? state.revision,
      segmentId: preview.segmentId,
      offsetSeconds: preview.offsetSeconds,
    });
  }, [state.schedule, state.revision, state.retimePreview]);
  const previewChangesByCueId = useMemo(
    () => new Map((state.retimePreview?.changes ?? []).map((change) => [change.cueId, change])),
    [state.retimePreview],
  );

  webmcpApiRef.current = {
    getSnapshot() {
      return createRunSnapshot(stateRef.current);
    },
    compareRetime({ segmentId, offsetSeconds, expectedRevision }) {
      const current = stateRef.current;
      return compareRetimeStrategies({
        schedule: current.schedule,
        revision: current.revision,
        expectedRevision,
        segmentId,
        offsetSeconds,
      });
    },
    previewRetime({ segmentId, offsetSeconds, mode, expectedRevision }) {
      const current = stateRef.current;
      const plan = previewSegmentRetime({
        schedule: current.schedule,
        revision: current.revision,
        expectedRevision,
        segmentId,
        offsetSeconds,
        mode,
      });
      dispatch({ type: 'SET_RETIME_PREVIEW', plan });
      return {
        ...plan,
        humanApprovalRequired: plan.status === 'ready',
        nextAction: plan.status === 'ready'
          ? 'Ask the human operator to approve this exact plan in LINECALL before applying it.'
          : 'Revise the plan to satisfy the reported constraint before asking for approval.',
      };
    },
    applyApprovedRetime({ planId, expectedRevision }) {
      const current = stateRef.current;
      if (expectedRevision !== current.revision) {
        return {
          status: 'blocked',
          reason: 'stale_revision',
          currentRevision: current.revision,
          message: 'The schedule changed after this plan was created. Read the run again.',
        };
      }
      const plan = current.retimePreview;
      if (!plan || plan.planId !== planId || plan.revision !== expectedRevision) {
        return {
          status: 'blocked',
          reason: 'plan_mismatch',
          message: 'That exact preview is no longer active. Preview the change again.',
        };
      }
      if (current.approvedPlanId !== planId) {
        return {
          status: 'blocked',
          reason: 'human_approval_required',
          planId,
          message: 'The human operator has not approved this exact plan in LINECALL.',
        };
      }
      dispatch({ type: 'APPLY_RETIME_PLAN', plan });
      return {
        status: 'applied',
        planId,
        previousRevision: current.revision,
        newRevision: current.revision + 1,
        changedCueCount: plan.changes.length,
        message: 'Approved plan applied once. Read the run again before proposing another timing change.',
      };
    },
    setReadiness({ cueId, readiness, expectedRevision }) {
      const current = stateRef.current;
      if (expectedRevision !== current.revision) {
        return {
          status: 'blocked',
          reason: 'stale_revision',
          currentRevision: current.revision,
        };
      }
      if (!current.schedule.some((cue) => cue.id === cueId)) {
        return { status: 'blocked', reason: 'unknown_cue', cueId };
      }
      dispatch({ type: 'SET_READINESS', cueId, readiness });
      return { status: 'applied', cueId, readiness, revision: current.revision };
    },
  };

  useEffect(() => registerLinecallWebMCP(
    webmcpApiRef,
    (status) => dispatch({ type: 'SET_WEBMCP_STATUS', status }),
    { allowApprovedRetime: Boolean(state.approvedPlanId) },
  ), [state.approvedPlanId]);

  useEffect(() => {
    if (state.detailOpen && shouldFocusInspector.current) {
      shouldFocusInspector.current = false;
      inspectorHeadingRef.current?.focus();
    }
  }, [state.detailOpen, state.selectedCueId]);

  function registerCueButton(cueId, node) {
    if (node) cueButtons.current.set(cueId, node);
    else cueButtons.current.delete(cueId);
  }

  function selectCue(cueId, event) {
    const detailBecomesSeparateView = window.matchMedia('(max-width: 980px)').matches;
    shouldFocusInspector.current = event?.detail === 0 && detailBecomesSeparateView;
    dispatch({ type: 'SELECT_CUE', cueId, openDetail: true });
  }

  function moveCueSelection(event, cueId) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const targetId = nextVisibleCueId(visibleIds, cueId, delta);
    if (!targetId) return;
    dispatch({ type: 'MOVE_SELECTION', visibleIds, fromCueId: cueId, delta });
    cueButtons.current.get(targetId)?.focus();
  }

  function closeDetail() {
    const returnId = state.selectedCueId;
    dispatch({ type: 'CLOSE_DETAIL' });
    window.requestAnimationFrame(() => {
      cueButtons.current.get(returnId)?.focus();
    });
  }

  function updateReadiness(cueId, readiness) {
    dispatch({ type: 'SET_READINESS', cueId, readiness });
  }

  function recoverFixtureData() {
    dispatch({ type: 'RECOVER_DATA' });
    window.requestAnimationFrame(() => {
      scoreHeadingRef.current?.focus();
    });
  }

  function resetFixture() {
    dispatch({ type: 'RESET', initialState });
  }

  function startGuidedScenario() {
    const current = stateRef.current;
    const comparison = compareRetimeStrategies({
      schedule: current.schedule,
      revision: current.revision,
      expectedRevision: current.revision,
      segmentId: 'qa',
      offsetSeconds: 2,
    });
    const mode = comparison.recommendedMode ?? 'ripple_after';
    const plan = previewSegmentRetime({
      schedule: current.schedule,
      revision: current.revision,
      expectedRevision: current.revision,
      segmentId: 'qa',
      offsetSeconds: 2,
      mode,
    });
    dispatch({ type: 'SET_RETIME_PREVIEW', plan });
  }

  function applyGuidedScenario() {
    const current = stateRef.current;
    const plan = current.retimePreview;
    if (!plan || current.approvedPlanId !== plan.planId) return;
    webmcpApiRef.current?.applyApprovedRetime({
      planId: plan.planId,
      expectedRevision: current.revision,
    });
  }

  const activeFilterCount = state.departments.length + (state.query.trim() ? 1 : 0);
  const routeBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  const rawPathname = routeBase && window.location.pathname.startsWith(routeBase)
    ? window.location.pathname.slice(routeBase.length) || '/'
    : window.location.pathname;
  const pathname = rawPathname === '/'
    ? '/'
    : rawPathname.replace(/\/+$/, '') || '/';
  const guidedPreviewReady = state.retimePreview?.status === 'ready';
  const guidedPreviewApproved = Boolean(guidedPreviewReady && state.approvedPlanId === state.retimePreview.planId);
  const guidedApplied = Boolean(state.receipts[0] && state.revision > 1);
  const guidedFocusClass = guidedApplied
    ? 'app-shell--guided-applied'
    : guidedPreviewApproved
      ? 'app-shell--guided-approved'
      : guidedPreviewReady
        ? 'app-shell--guided-review'
        : 'app-shell--guided-idle';
  const validRoutes = new Set(['/', '/product', '/demo', '/trust']);
  const routeMeta = {
    '/': {
      title: 'LINECALL — Human-Controlled AI for Live Production',
      description: 'LINECALL helps live-event teams solve timing changes with an AI agent while deterministic rules verify the plan and the human operator keeps final authority.',
    },
    '/product': {
      title: 'Product — LINECALL',
      description: 'See how LINECALL combines one authoritative run, counterfactual timing analysis, deterministic rules, and human approval.',
    },
    '/demo': {
      title: 'Live Desk — LINECALL',
      description: 'Operate the real LINECALL cue desk and explore its WebMCP-powered live-production timing workflow.',
    },
    '/trust': {
      title: 'Trust + Proof — LINECALL',
      description: 'Inspect LINECALL’s 4 → 5 → 4 authority lifecycle, deterministic safety boundary, browser proof, and agent eval contract.',
    },
  };
  const meta = routeMeta[pathname] ?? {
    title: 'Not Found — LINECALL',
    description: 'This LINECALL route is not in the run of show.',
  };

  useEffect(() => {
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
  }, [meta.description, meta.title]);

  useEffect(() => {
    if (pathname !== '/demo' || !guidedPreviewReady || guidedPreviewApproved) return;
    const target = document.querySelector('.cue-row--preview-shift');
    if (!target) return;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    target.querySelector('.cue-select')?.focus({ preventScroll: true });
  }, [pathname, guidedPreviewReady, guidedPreviewApproved, state.retimePreview?.planId]);

  return (
    <div className={`site-shell ${pathname === '/demo' ? 'site-shell--product-demo' : ''}`} id="top">
      {pathname === '/demo' ? (
        <DemoProductBar
          revision={state.revision}
          webmcp={state.webmcp}
          showTitle={SHOW_META.title}
          hold={state.hold}
          onToggleHold={() => dispatch({ type: 'TOGGLE_HOLD' })}
          onReset={resetFixture}
        />
      ) : (
        <SiteNav webmcp={state.webmcp} currentPath={pathname} />
      )}

      <main className={`site-main ${pathname === '/demo' ? 'site-main--product-demo' : ''}`} id="site-main" tabIndex="-1">
        {pathname === '/' && (
          <HomePage
            showMeta={SHOW_META}
            sequence={sequence}
            revision={state.revision}
            webmcp={state.webmcp}
            cueCount={state.schedule.length}
          />
        )}

        {pathname === '/product' && (
          <ProductPage sequence={sequence} revision={state.revision} />
        )}

        {pathname === '/trust' && (
          <TrustPage webmcp={state.webmcp} cueCount={state.schedule.length} />
        )}

        {pathname === '/demo' && (
          <section className="site-demo site-demo--route site-demo--product" id="live-demo" aria-labelledby="live-demo-title">
            <div className={`app-shell app-shell--product-demo ${guidedFocusClass} ${state.detailOpen ? 'app-shell--detail-open' : ''} ${state.hold ? 'app-shell--hold' : ''}`}>
              <div className="demo-command-deck">
                <DemoScenarioConsole
                  revision={state.revision}
                  preview={state.retimePreview}
                  comparison={retimeComparison}
                  approvedPlanId={state.approvedPlanId}
                  receipts={state.receipts}
                  onStart={startGuidedScenario}
                />

                <ShowPulse
                  schedule={state.schedule}
                  sequence={sequence}
                  revision={state.revision}
                  hold={state.hold}
                />
              </div>

              <AgentCollaborationPanel
                webmcp={state.webmcp}
                revision={state.revision}
                preview={state.retimePreview}
                comparison={retimeComparison}
                approvedPlanId={state.approvedPlanId}
                receipts={state.receipts}
              />

              <DemoDecisionDock
                revision={state.revision}
                preview={state.retimePreview}
                approvedPlanId={state.approvedPlanId}
                receipts={state.receipts}
                onApprove={() => dispatch({ type: 'APPROVE_RETIME_PREVIEW' })}
                onApply={applyGuidedScenario}
                onDismiss={() => dispatch({ type: 'DISMISS_RETIME_PREVIEW' })}
                onReset={resetFixture}
              />

              <div className="workspace" id="linecall-main" tabIndex="-1">
        <section className="score-panel" aria-labelledby="score-title">
          {guidedPreviewReady && !guidedApplied ? (
            <div className="demo-review-banner" id="demo-review-anchor" role="status">
              <div>
                <span>WHAT TO LOOK AT</span>
                <strong>{state.retimePreview.changes.length} cyan cue rows are the proposed schedule.</strong>
                <small>Read each old → new time. Nothing has moved yet; unchanged cues are intentionally muted.</small>
              </div>
              <b>PROJECTION ONLY</b>
            </div>
          ) : null}
          <div className="score-heading">
            <div>
              <p className="eyebrow">Run of show</p>
              <h2 id="score-title" ref={scoreHeadingRef} tabIndex="-1">Cue score</h2>
            </div>
            <p className="result-count" role="status">
              {visibleCues.length} of {state.schedule.length} cues
              {activeFilterCount ? ` · ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : ''}
            </p>
          </div>

          <div className="filter-bar" aria-label="Cue filters">
            <label className="cue-search">
              <span>Search cues</span>
              <input
                type="search"
                value={state.query}
                placeholder="Cue, note, time…"
                onChange={(event) => dispatch({ type: 'SET_QUERY', query: event.target.value })}
              />
            </label>
            <div className="department-filters" aria-label="Departments">
              {DEPARTMENTS.map((department) => (
                <button
                  key={department}
                  type="button"
                  data-department={department}
                  aria-pressed={state.departments.includes(department)}
                  onClick={() => dispatch({ type: 'TOGGLE_DEPARTMENT', department })}
                >
                  <span className="department-mark" data-department={department} aria-hidden="true" />
                  {DEPARTMENT_LABELS[department]}
                </button>
              ))}
            </div>
            <button
              className="clear-filters"
              type="button"
              disabled={!activeFilterCount}
              onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}
            >
              Clear filters
            </button>
          </div>

          {state.dataState === 'error' ? (
            <section className="fixture-error" role="alert" aria-labelledby="fixture-error-title">
              <p className="eyebrow">Demo data fault</p>
              <h3 id="fixture-error-title">Cue data is temporarily unavailable</h3>
              <p>A simulated fault is active. The run timing and operator locks have not changed.</p>
              <div className="button-row">
                <button type="button" onClick={recoverFixtureData}>
                  Restore run data
                </button>
                <button type="button" className="button-secondary" onClick={resetFixture}>
                  Reset demo run
                </button>
              </div>
            </section>
          ) : visibleCues.length === 0 ? (
            <section className="empty-state" aria-labelledby="no-results-title">
              <p className="eyebrow">No matching cues</p>
              <h3 id="no-results-title">The score is intact; the current filters hide every cue.</h3>
              <p>Clear the department filters or search text to return to the full chronological run.</p>
              <button type="button" onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}>
                Show all cues
              </button>
            </section>
          ) : (
            <ol className="cue-score" id="cue-score" aria-label="Chronological cue score">
              {visibleCues.map((cue, index) => {
                const previousCue = visibleCues[index - 1];
                const segmentLabel = index === 0 || previousCue?.segment !== cue.segment
                  ? SEGMENTS.find((segment) => segment.id === cue.segment)?.label ?? cue.segment
                  : '';

                return (
                  <CueRow
                    key={cue.id}
                    cue={cue}
                    readiness={state.readiness[cue.id]}
                    selected={cue.id === state.selectedCueId}
                    segmentLabel={segmentLabel}
                    previewChange={previewChangesByCueId.get(cue.id) ?? null}
                    registerButton={registerCueButton}
                    onSelect={(event) => selectCue(cue.id, event)}
                    onMove={(event) => moveCueSelection(event, cue.id)}
                    onQuickReadiness={() =>
                      updateReadiness(cue.id, readinessNext(state.readiness[cue.id]))
                    }
                  />
                );
              })}
            </ol>
          )}
        </section>

        <CueInspector
          cue={selectedCue}
          readiness={selectedCue ? state.readiness[selectedCue.id] : 'pending'}
          onReadiness={(readiness) => selectedCue && updateReadiness(selectedCue.id, readiness)}
          onToggleLock={() => selectedCue && dispatch({ type: 'TOGGLE_CUE_LOCK', cueId: selectedCue.id })}
          onClose={closeDetail}
          headingRef={inspectorHeadingRef}
          unavailable={state.dataState === 'error'}
        />
      </div>

      <footer className="fixture-footer">
        <details>
          <summary>Demo resilience controls</summary>
          <p>Exercise recovery states without changing the run timing, revision, or operator locks.</p>
          <div className="button-row">
            <button type="button" onClick={() => dispatch({ type: 'SIMULATE_ERROR' })}>
              Simulate data fault
            </button>
            <button type="button" className="button-secondary" onClick={resetFixture}>
              Reset demo run
            </button>
          </div>
        </details>
              </footer>
            </div>
          </section>
        )}

        {!validRoutes.has(pathname) && <NotFoundPage />}
      </main>

      {pathname !== '/demo' ? <SiteFooter /> : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </p>
    </div>
  );
}
