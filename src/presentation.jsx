import React from 'react';

import { DEFAULT_CONSTRAINTS, SEGMENTS } from './schedule.js';

function cueNumber(cue) {
  return cue ? String(cue.number).padStart(3, '0') : '—';
}

function segmentState(segment, currentCueNumber) {
  if (!currentCueNumber) return 'upcoming';
  if (currentCueNumber > segment.endCue) return 'complete';
  if (currentCueNumber >= segment.startCue && currentCueNumber <= segment.endCue) return 'current';
  return 'upcoming';
}

export function ProductLead({ showMeta, revision, hold, onToggleHold }) {
  return (
    <header className="app-header command-header">
      <div className="brand-block command-brand">
        <span className="brand-mark" aria-hidden="true">
          <span>LC</span>
          <i />
        </span>
        <div className="command-brand__copy">
          <p className="eyebrow">Production run · live cue desk</p>
          <h2>LINECALL</h2>
          <p className="product-promise">
            Agent explores the timing. Deterministic rules verify it. You decide what moves.
          </p>
        </div>
      </div>

      <div className="show-identity command-show-identity">
        <span className="show-identity__label">{hold ? 'Run held' : 'On Air'}</span>
        <strong>{showMeta.title}</strong>
        <span>{showMeta.room} · R{revision}</span>
      </div>

      <button
        className={`hold-control ${hold ? 'hold-control--active' : ''}`}
        type="button"
        onClick={onToggleHold}
      >
        <span className="hold-control__state">{hold ? 'HOLD' : 'RUN'}</span>
        <span>{hold ? 'Resume run' : 'Place run on hold'}</span>
      </button>
    </header>
  );
}

export function ShowPulse({ schedule, sequence, revision, hold }) {
  const currentCueNumber = sequence.current?.number ?? null;
  const currentIndex = schedule.findIndex((cue) => cue.id === sequence.current?.id);
  const progress = currentIndex < 0 || schedule.length < 2
    ? 0
    : Math.min(100, Math.max(0, (currentIndex / (schedule.length - 1)) * 100));
  const currentSegment = SEGMENTS.find(
    (segment) => currentCueNumber >= segment.startCue && currentCueNumber <= segment.endCue,
  );

  return (
    <section className={`show-pulse ${hold ? 'show-pulse--hold' : ''}`} aria-label="Live show pulse">
      <div className="show-pulse__intro">
        <div className="live-signal" data-state={hold ? 'hold' : 'run'}>
          <span className="live-signal__dot" aria-hidden="true" />
          <span>{hold ? 'Run held' : 'On Air'}</span>
        </div>
        <p>
          LINECALL keeps one source of truth for the run while the agent explores timing changes around it.
        </p>
      </div>

      <div className="show-pulse__now">
        <span className="eyebrow">Now</span>
        <div className="show-pulse__cue-id">Q{cueNumber(sequence.current)}</div>
        <div className="show-pulse__cue-copy">
          <strong>{sequence.current?.label ?? 'No current cue'}</strong>
          <span>{sequence.current?.instruction ?? 'The run is waiting for a current cue.'}</span>
        </div>
        <time>{sequence.current?.timecode ?? '—'}</time>
      </div>

      <div className="show-pulse__next">
        <span className="eyebrow">Next</span>
        <strong>Q{cueNumber(sequence.next)} · {sequence.next?.label ?? 'No next cue'}</strong>
        <span>{sequence.next?.instruction ?? 'No upcoming cue is available.'}</span>
      </div>

      <div className="show-pulse__meta">
        <div>
          <span className="eyebrow">Segment</span>
          <strong>{currentSegment?.label ?? 'Run complete'}</strong>
        </div>
        <div>
          <span className="eyebrow">Hard out</span>
          <strong>{DEFAULT_CONSTRAINTS.hardOut}</strong>
        </div>
        <div>
          <span className="eyebrow">Revision</span>
          <strong>R{revision}</strong>
        </div>
      </div>

      <div className="segment-track" aria-label="Show segment progression">
        <div className="segment-track__line" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <ol>
          {SEGMENTS.map((segment) => {
            const state = segmentState(segment, currentCueNumber);
            return (
              <li
                key={segment.id}
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span aria-hidden="true" />
                <strong>{segment.label}</strong>
                <small>Q{String(segment.startCue).padStart(3, '0')}–Q{String(segment.endCue).padStart(3, '0')}</small>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
