import test from 'node:test';
import assert from 'node:assert/strict';

import { CUES } from '../src/data.js';
import {
  appReducer,
  createInitialState,
  filterCues,
  getSequenceContext,
  nextVisibleCueId,
} from '../src/state.js';

test('initial state selects the declared current cue and all readiness starts pending', () => {
  const state = createInitialState(CUES);
  const context = getSequenceContext(CUES);

  assert.equal(context.current?.id, 'cue-012');
  assert.equal(context.next?.id, 'cue-013');
  assert.equal(state.selectedCueId, 'cue-012');
  assert.equal(state.hold, false);
  assert.equal(state.dataState, 'ready');
  assert.deepEqual(state.departments, []);
  assert.equal(state.query, '');
  assert.ok(Object.values(state.readiness).every((value) => value === 'pending'));
});

test('department filtering preserves original chronological cue order', () => {
  let state = createInitialState(CUES);
  state = appReducer(state, { type: 'TOGGLE_DEPARTMENT', department: 'audio' });

  const visible = filterCues(CUES, state);
  assert.ok(visible.length > 0);
  assert.ok(visible.every((cue) => cue.department === 'audio'));

  const numbers = visible.map((cue) => cue.number);
  const sorted = [...numbers].sort((a, b) => a - b);
  assert.deepEqual(numbers, sorted);
});

test('cue-text search can reach a no-results state and clearing restores the full score', () => {
  let state = createInitialState(CUES);
  state = appReducer(state, { type: 'SET_QUERY', query: 'definitely-not-a-cue' });
  assert.equal(filterCues(CUES, state).length, 0);

  state = appReducer(state, { type: 'CLEAR_FILTERS' });
  assert.equal(filterCues(CUES, state).length, CUES.length);
  assert.equal(state.query, '');
  assert.deepEqual(state.departments, []);
});

test('search and filter changes do not duplicate the separate live action announcement', () => {
  const initial = createInitialState(CUES);
  const baselineAnnouncement = initial.announcement;
  let state = appReducer(initial, { type: 'TOGGLE_DEPARTMENT', department: 'audio' });
  assert.equal(state.announcement, baselineAnnouncement);
  state = appReducer(state, { type: 'SET_QUERY', query: 'host' });
  assert.equal(state.announcement, baselineAnnouncement);
  state = appReducer(state, { type: 'CLEAR_FILTERS' });
  assert.equal(state.announcement, baselineAnnouncement);
});

test('readiness change updates only the requested cue', () => {
  const initial = createInitialState(CUES);
  const state = appReducer(initial, {
    type: 'SET_READINESS',
    cueId: 'cue-013',
    readiness: 'ready',
  });

  assert.equal(state.readiness['cue-013'], 'ready');
  assert.equal(state.readiness['cue-012'], 'pending');
  assert.equal(initial.readiness['cue-013'], 'pending');
});

test('hold and resume preserve selection, filters, query, and readiness', () => {
  let state = createInitialState(CUES);
  state = appReducer(state, { type: 'SELECT_CUE', cueId: 'cue-018' });
  state = appReducer(state, { type: 'TOGGLE_DEPARTMENT', department: 'lighting' });
  state = appReducer(state, { type: 'SET_QUERY', query: 'speaker' });
  state = appReducer(state, {
    type: 'SET_READINESS',
    cueId: 'cue-018',
    readiness: 'check',
  });

  const beforeHold = state;
  const held = appReducer(state, { type: 'TOGGLE_HOLD' });
  assert.equal(held.hold, true);
  assert.equal(held.selectedCueId, beforeHold.selectedCueId);
  assert.deepEqual(held.departments, beforeHold.departments);
  assert.equal(held.query, beforeHold.query);
  assert.deepEqual(held.readiness, beforeHold.readiness);

  const resumed = appReducer(held, { type: 'TOGGLE_HOLD' });
  assert.equal(resumed.hold, false);
  assert.equal(resumed.selectedCueId, beforeHold.selectedCueId);
  assert.deepEqual(resumed.readiness, beforeHold.readiness);
});

test('visible-cue movement respects filtered IDs, focused cue, and list bounds', () => {
  const visibleIds = ['cue-003', 'cue-007', 'cue-011', 'cue-014'];

  assert.equal(nextVisibleCueId(visibleIds, 'cue-007', 1), 'cue-011');
  assert.equal(nextVisibleCueId(visibleIds, 'cue-007', -1), 'cue-003');
  assert.equal(nextVisibleCueId(visibleIds, 'cue-003', -1), 'cue-003');
  assert.equal(nextVisibleCueId(visibleIds, 'cue-014', 1), 'cue-014');
  assert.equal(nextVisibleCueId(visibleIds, 'cue-999', 1), 'cue-003');

  const initial = createInitialState(CUES);
  assert.equal(initial.selectedCueId, 'cue-012');
  const movedFromFocusedCue = appReducer(initial, {
    type: 'MOVE_SELECTION',
    visibleIds,
    fromCueId: 'cue-007',
    delta: 1,
  });
  assert.equal(movedFromFocusedCue.selectedCueId, 'cue-011');
});

test('simulated error recovers and reset restores canonical initial state', () => {
  const initial = createInitialState(CUES);
  let state = appReducer(initial, { type: 'TOGGLE_HOLD' });
  state = appReducer(state, { type: 'SET_QUERY', query: 'host' });
  state = appReducer(state, { type: 'SELECT_CUE', cueId: 'cue-013' });
  state = appReducer(state, { type: 'SIMULATE_ERROR' });

  assert.equal(state.dataState, 'error');
  const recovered = appReducer(state, { type: 'RECOVER_DATA' });
  assert.equal(recovered.dataState, 'ready');

  const reset = appReducer(recovered, { type: 'RESET', initialState: initial });
  const { announcement: _initialAnnouncement, ...initialComparable } = initial;
  const { announcement: resetAnnouncement, ...resetComparable } = reset;

  assert.deepEqual(resetComparable, initialComparable);
  assert.equal(resetAnnouncement, 'LINECALL demo run reset to its initial state.');
});
