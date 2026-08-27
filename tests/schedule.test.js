import test from 'node:test';
import assert from 'node:assert/strict';

import { CUES } from '../src/data.js';
import {
  applyRetimePlan,
  compareRetimeStrategies,
  createSchedule,
  findScheduleConflicts,
  previewSegmentRetime,
} from '../src/schedule.js';

function freshSchedule() {
  return createSchedule(CUES);
}

test('baseline schedule has no deterministic conflicts', () => {
  assert.deepEqual(findScheduleConflicts(freshSchedule()), []);
});

test('stale revision fails closed before producing changes', () => {
  const plan = previewSegmentRetime({
    schedule: freshSchedule(),
    revision: 3,
    expectedRevision: 2,
    segmentId: 'qa',
    offsetSeconds: 2,
    mode: 'ripple_after',
  });

  assert.equal(plan.status, 'blocked');
  assert.equal(plan.reason, 'stale_revision');
  assert.deepEqual(plan.changes, []);
});

test('human-locked opening cue blocks any plan that would move it', () => {
  const plan = previewSegmentRetime({
    schedule: freshSchedule(),
    revision: 1,
    expectedRevision: 1,
    segmentId: 'opening',
    offsetSeconds: 2,
    mode: 'segment_only',
  });

  assert.equal(plan.status, 'blocked');
  assert.equal(plan.reason, 'human_lock');
  assert.equal(plan.lockedCueId, 'cue-014');
});

test('segment-only Q&A delay is blocked when it breaks chronology', () => {
  const plan = previewSegmentRetime({
    schedule: freshSchedule(),
    revision: 1,
    expectedRevision: 1,
    segmentId: 'qa',
    offsetSeconds: 2,
    mode: 'segment_only',
  });

  assert.equal(plan.status, 'blocked');
  assert.equal(plan.reason, 'schedule_conflict');
  assert.ok(plan.conflicts.some((conflict) => conflict.type === 'chronology'));
});

test('ripple-after Q&A delay creates a safe exact plan', () => {
  const schedule = freshSchedule();
  const plan = previewSegmentRetime({
    schedule,
    revision: 1,
    expectedRevision: 1,
    segmentId: 'qa',
    offsetSeconds: 2,
    mode: 'ripple_after',
  });

  assert.equal(plan.status, 'ready');
  assert.equal(plan.reason, null);
  assert.equal(plan.changes.length, 13);
  assert.equal(plan.changes[0].cueId, 'cue-020');
  assert.equal(plan.changes.at(-1).cueId, 'cue-032');
  assert.deepEqual(plan.conflicts, []);

  const applied = applyRetimePlan(schedule, plan);
  assert.equal(applied.find((cue) => cue.id === 'cue-020').timecode, '00:24');
  assert.equal(applied.find((cue) => cue.id === 'cue-032').timecode, '00:47');
  assert.equal(applied.find((cue) => cue.id === 'cue-014').timecode, '00:15');
  assert.deepEqual(findScheduleConflicts(applied), []);
});

test('hard out rejects an otherwise chronological ripple', () => {
  const plan = previewSegmentRetime({
    schedule: freshSchedule(),
    revision: 1,
    expectedRevision: 1,
    segmentId: 'panel',
    offsetSeconds: 8,
    mode: 'ripple_after',
  });

  assert.equal(plan.status, 'blocked');
  assert.ok(plan.conflicts.some((conflict) => conflict.type === 'hard_out'));
});


test('counterfactual planner recommends the safe ripple strategy for Q&A delay', () => {
  const comparison = compareRetimeStrategies({
    schedule: freshSchedule(),
    revision: 1,
    expectedRevision: 1,
    segmentId: 'qa',
    offsetSeconds: 2,
  });

  assert.equal(comparison.status, 'ready');
  assert.equal(comparison.recommendedMode, 'ripple_after');
  const segmentOnly = comparison.options.find((option) => option.mode === 'segment_only');
  const ripple = comparison.options.find((option) => option.mode === 'ripple_after');
  assert.equal(segmentOnly.status, 'blocked');
  assert.ok(segmentOnly.conflicts.some((conflict) => conflict.type === 'chronology'));
  assert.equal(ripple.status, 'ready');
  assert.equal(ripple.changedCueCount, 13);
});
