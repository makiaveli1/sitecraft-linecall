import React, { useEffect, useMemo, useReducer, useRef } from 'react';

import { CUES, SHOW_META } from './data.js';
import { compareRetimeStrategies, createRunSnapshot, previewSegmentRetime } from './schedule.js';
import {
  DEPARTMENTS,
  appReducer,
  createInitialState,
  filterCues,
  getSequenceContext,
  nextVisibleCueId,
} from './state.js';
import { registerLinecallWebMCP } from './webmcp.js';

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
  onSelect,
  onMove,
  onQuickReadiness,
  registerButton,
}) {
  return (
    <li
      className={`cue-row ${selected ? 'cue-row--selected' : ''} cue-row--${cue.runState}`}
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
          <span className="cue-label">{cue.label}</span>
          <span className="cue-instruction">{cue.instruction}</span>
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
        <p className="eyebrow">Cue inspector</p>
        <h2>Fixture unavailable</h2>
        <p>Restore the local test data before relying on cue detail or readiness controls.</p>
      </aside>
    );
  }

  if (!cue) {
    return (
      <aside className="inspector inspector--empty" aria-label="Cue detail">
        <p className="eyebrow">Cue inspector</p>
        <h2>No cue selected</h2>
        <p>Select a visible cue to review its instruction and readiness.</p>
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
  onApprove,
  onDismiss,
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
        <div>
          <p className="eyebrow">Human + agent control plane</p>
          <h2 id="agent-panel-title">WebMCP collaboration</h2>
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
          <strong>Preview first</strong>
        </div>
        <div>
          <span className="eyebrow">Human boundary</span>
          <strong>Locks + exact approval</strong>
        </div>
        <div>
          <span className="eyebrow">Browser proof</span>
          <strong>
            {webmcp.browserVerified
              ? `Discovered ${webmcp.discoveredToolCount}/${webmcp.toolCount}`
              : webmcp.status === 'registered'
                ? 'Registration only'
                : 'Pending'}
          </strong>
        </div>
      </div>

      <ol className="decision-rail" aria-label="LINECALL timing authority path">
        <li>
          <span aria-hidden="true">1</span>
          <div><strong>Agent compares</strong><small>Counterfactual options</small></div>
        </li>
        <li>
          <span aria-hidden="true">2</span>
          <div><strong>Rules verify</strong><small>Locks · chronology · hard out</small></div>
        </li>
        <li>
          <span aria-hidden="true">3</span>
          <div><strong>Human approves</strong><small>Exact plan + revision</small></div>
        </li>
        <li>
          <span aria-hidden="true">4</span>
          <div><strong>Agent applies</strong><small>Once, with receipt</small></div>
        </li>
      </ol>

      {comparison ? (
        <section className="strategy-comparison" aria-labelledby="strategy-comparison-title">
          <div className="strategy-comparison__heading">
            <div>
              <p className="eyebrow">Deterministic decision trace</p>
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

          <div className="button-row">
            {preview.status === 'ready' ? (
              <button
                type="button"
                onClick={onApprove}
                disabled={approvedPlanId === preview.planId}
              >
                {approvedPlanId === preview.planId ? 'Exact plan approved' : 'Approve this exact plan'}
              </button>
            ) : null}
            <button type="button" className="button-secondary" onClick={onDismiss}>
              Dismiss preview
            </button>
          </div>
          {approvedPlanId === preview.planId ? (
            <p className="agent-plan__approval">Approval is bound to this plan ID and revision. The agent can apply it once.</p>
          ) : null}
        </article>
      ) : (
        <div className="agent-brief">
          <div className="agent-brief__copy">
            <p className="eyebrow">Operator brief</p>
            <strong>Give the agent a real timing problem, not a button to click.</strong>
            <span>It can inspect the run, compare alternatives, and prepare an exact plan. Timing still cannot move until you approve it.</span>
          </div>
          <blockquote>
            “Audience Q&amp;A needs to start two seconds later. Find the safest way to absorb the delay without breaking the run, and show me the exact change first.”
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

export function App() {
  const initialState = useMemo(() => createInitialState(CUES), []);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const stateRef = useRef(state);
  const webmcpApiRef = useRef(null);
  const cueButtons = useRef(new Map());
  const inspectorHeadingRef = useRef(null);
  const scoreHeadingRef = useRef(null);
  const shouldFocusInspector = useRef(false);
  const didPositionInitialCue = useRef(false);

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
  ), []);

  useEffect(() => {
    if (didPositionInitialCue.current || !state.selectedCueId) return;
    didPositionInitialCue.current = true;
    if (window.scrollY > 1) return;
    const selectedButton = cueButtons.current.get(state.selectedCueId);
    if (!selectedButton) return;
    const rect = selectedButton.getBoundingClientRect();
    const outsideViewport = rect.bottom <= 0 || rect.top >= window.innerHeight;
    if (outsideViewport) {
      selectedButton.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    }
  }, [state.selectedCueId]);

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

  const activeFilterCount = state.departments.length + (state.query.trim() ? 1 : 0);

  return (
    <div className={`app-shell ${state.detailOpen ? 'app-shell--detail-open' : ''} ${state.hold ? 'app-shell--hold' : ''}`}>
      <header className="app-header">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">LC</span>
          <div>
            <p className="eyebrow">{SHOW_META.mode}</p>
            <h1>LINECALL</h1>
          </div>
        </div>
        <div className="show-identity">
          <strong>{SHOW_META.title}</strong>
          <span>{SHOW_META.room}</span>
        </div>
        <button
          className={`hold-control ${state.hold ? 'hold-control--active' : ''}`}
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE_HOLD' })}
        >
          <span className="hold-control__state">{state.hold ? 'HOLD' : 'RUN'}</span>
          <span>{state.hold ? 'Resume local run' : 'Place local run on hold'}</span>
        </button>
      </header>

      <section className={`run-strip ${state.hold ? 'run-strip--hold' : ''}`} aria-label="Run status">
        <div className="run-strip__mode">
          <span className="eyebrow">Run status</span>
          <strong>{state.hold ? 'Local rehearsal held' : 'Local rehearsal running'}</strong>
        </div>
        <div className="run-context">
          <div>
            <span className="eyebrow">Now</span>
            <strong>Q{sequence.current ? cueNumber(sequence.current) : '—'}</strong>
            <span>{sequence.current?.label ?? 'No current cue'}</span>
          </div>
          <div>
            <span className="eyebrow">Next</span>
            <strong>Q{sequence.next ? cueNumber(sequence.next) : '—'}</strong>
            <span>{sequence.next?.label ?? 'No next cue'}</span>
          </div>
        </div>
      </section>

      <AgentCollaborationPanel
        webmcp={state.webmcp}
        revision={state.revision}
        preview={state.retimePreview}
        comparison={retimeComparison}
        approvedPlanId={state.approvedPlanId}
        receipts={state.receipts}
        onApprove={() => dispatch({ type: 'APPROVE_RETIME_PREVIEW' })}
        onDismiss={() => dispatch({ type: 'DISMISS_RETIME_PREVIEW' })}
      />

      <main className="workspace" id="linecall-main" tabIndex="-1">
        <section className="score-panel" aria-labelledby="score-title">
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
              <p className="eyebrow">Local fixture error</p>
              <h3 id="fixture-error-title">Cue data is temporarily unavailable</h3>
              <p>This is a deliberate local test state. No production service or network request failed.</p>
              <div className="button-row">
                <button type="button" onClick={recoverFixtureData}>
                  Restore fixture data
                </button>
                <button type="button" className="button-secondary" onClick={resetFixture}>
                  Reset fixture
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
              {visibleCues.map((cue) => (
                <CueRow
                  key={cue.id}
                  cue={cue}
                  readiness={state.readiness[cue.id]}
                  selected={cue.id === state.selectedCueId}
                  registerButton={registerCueButton}
                  onSelect={(event) => selectCue(cue.id, event)}
                  onMove={(event) => moveCueSelection(event, cue.id)}
                  onQuickReadiness={() =>
                    updateReadiness(cue.id, readinessNext(state.readiness[cue.id]))
                  }
                />
              ))}
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
      </main>

      <footer className="fixture-footer">
        <details>
          <summary>Forward-test fixture tools</summary>
          <p>These controls exist only to test recovery and reset states. They do not represent production actions.</p>
          <div className="button-row">
            <button type="button" onClick={() => dispatch({ type: 'SIMULATE_ERROR' })}>
              Simulate data error
            </button>
            <button type="button" className="button-secondary" onClick={resetFixture}>
              Reset fixture
            </button>
          </div>
        </details>
      </footer>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </p>
    </div>
  );
}
