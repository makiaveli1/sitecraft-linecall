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

test('fixture begins with 32 chronological cues and Q012 current', () => {
  assert.equal(CUES.length, 32);
  assert.equal(CUES.find((cue) => cue.runState === 'current')?.id, 'cue-012');
  for (let index = 1; index < CUES.length; index += 1) {
    assert.ok(CUES[index].number > CUES[index - 1].number);
  }
});

test('department filtering keeps chronology intact', () => {
  const state = {
    ...createInitialState(CUES),
    departments: ['audio', 'video'],
  };
  const visible = filterCues(CUES, state);
  assert.ok(visible.length > 0);
  assert.ok(visible.every((cue) => ['audio', 'video'].includes(cue.department)));
  for (let index = 1; index < visible.length; index += 1) {
    assert.ok(visible[index].number > visible[index - 1].number);
  }
});

test('query filtering matches cue content without replacing score state', () => {
  const state = {
    ...createInitialState(CUES),
    query: 'audience mic',
  };
  const visible = filterCues(CUES, state);
  assert.deepEqual(
    visible.map((cue) => cue.id),
    ['cue-020', 'cue-024'],
  );
});

test('readiness updates only the named cue', () => {
  const state = createInitialState(CUES);
  const next = appReducer(state, {
    type: 'SET_READINESS',
    cueId: 'cue-012',
    readiness: 'ready',
  });
  assert.equal(next.readiness['cue-012'], 'ready');
  assert.equal(next.readiness['cue-013'], 'pending');
});

test('selection does not change current show cue', () => {
  const state = createInitialState(CUES);
  const next = appReducer(state, {
    type: 'SELECT_CUE',
    cueId: 'cue-020',
  });
  assert.equal(next.selectedCueId, 'cue-020');
  assert.equal(getSequenceContext(CUES).current?.id, 'cue-012');
});

test('arrow movement stays inside visible cue ids', () => {
  const visibleIds = ['cue-002', 'cue-004', 'cue-006'];
  assert.equal(nextVisibleCueId(visibleIds, 'cue-004', 1), 'cue-006');
  assert.equal(nextVisibleCueId(visibleIds, 'cue-004', -1), 'cue-002');
  assert.equal(nextVisibleCueId(visibleIds, 'cue-006', 1), 'cue-006');
  assert.equal(nextVisibleCueId(visibleIds, 'missing', 1), 'cue-002');
});

test('hold and recovery states are reversible', () => {
  const initial = createInitialState(CUES);
  const held = appReducer(initial, { type: 'TOGGLE_HOLD' });
  assert.equal(held.hold, true);
  const resumed = appReducer(held, { type: 'TOGGLE_HOLD' });
  assert.equal(resumed.hold, false);

  const errored = appReducer(initial, { type: 'SIMULATE_ERROR' });
  assert.equal(errored.dataState, 'error');
  const recovered = appReducer(errored, { type: 'RECOVER_DATA' });
  assert.equal(recovered.dataState, 'ready');
});
