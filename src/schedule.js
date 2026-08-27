export const SEGMENTS = [
  { id: 'preshow', label: 'Pre-show', startCue: 1, endCue: 11 },
  { id: 'opening', label: 'Opening sequence', startCue: 12, endCue: 19 },
  { id: 'qa', label: 'Audience Q&A', startCue: 20, endCue: 29 },
  { id: 'panel', label: 'Panel transition', startCue: 30, endCue: 32 },
];

export const DEFAULT_CONSTRAINTS = {
  hardOut: '00:50',
  minimumDepartmentGapSeconds: 1,
};

export function parseTimecode(value) {
  const match = /^(\d{2,}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) throw new Error(`Invalid timecode: ${value}`);
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isInteger(minutes) || seconds < 0 || seconds > 59) {
    throw new Error(`Invalid timecode: ${value}`);
  }
  return minutes * 60 + seconds;
}

export function formatTimecode(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function segmentForCue(cue) {
  return SEGMENTS.find(
    (segment) => cue.number >= segment.startCue && cue.number <= segment.endCue,
  ) ?? null;
}

export function createSchedule(cues) {
  return cues.map((cue) => ({
    ...cue,
    segment: cue.segment ?? segmentForCue(cue)?.id ?? 'other',
    locked: Boolean(cue.locked),
  }));
}

export function findScheduleConflicts(schedule, constraints = DEFAULT_CONSTRAINTS) {
  const conflicts = [];
  let previousSeconds = -1;

  for (const cue of schedule) {
    const seconds = parseTimecode(cue.timecode);
    if (seconds < previousSeconds) {
      conflicts.push({
        type: 'chronology',
        cueId: cue.id,
        message: `${cue.id} would occur before an earlier cue in the score.`,
      });
    }
    previousSeconds = Math.max(previousSeconds, seconds);
  }

  const byDepartment = new Map();
  for (const cue of schedule) {
    const seconds = parseTimecode(cue.timecode);
    const prior = byDepartment.get(cue.department);
    if (prior && seconds - prior.seconds < constraints.minimumDepartmentGapSeconds) {
      conflicts.push({
        type: 'department_gap',
        cueId: cue.id,
        relatedCueId: prior.cue.id,
        message: `${cue.department} cues ${prior.cue.id} and ${cue.id} are too close together.`,
      });
    }
    byDepartment.set(cue.department, { cue, seconds });
  }

  const hardOutSeconds = parseTimecode(constraints.hardOut);
  const finalCue = schedule.at(-1);
  if (finalCue && parseTimecode(finalCue.timecode) > hardOutSeconds) {
    conflicts.push({
      type: 'hard_out',
      cueId: finalCue.id,
      message: `The run would finish after the ${constraints.hardOut} hard out.`,
    });
  }

  return conflicts;
}

function planId({ revision, segmentId, offsetSeconds, mode }) {
  const sign = offsetSeconds < 0 ? 'm' : 'p';
  return `retime-r${revision}-${segmentId}-${sign}${Math.abs(offsetSeconds)}-${mode}`;
}

export function previewSegmentRetime({
  schedule,
  revision,
  expectedRevision = revision,
  segmentId,
  offsetSeconds,
  mode = 'segment_only',
  constraints = DEFAULT_CONSTRAINTS,
}) {
  if (expectedRevision !== revision) {
    return {
      status: 'blocked',
      reason: 'stale_revision',
      expectedRevision,
      currentRevision: revision,
      message: 'The run changed after the agent read it. Refresh before planning again.',
      changes: [],
      conflicts: [],
    };
  }

  const segment = SEGMENTS.find((item) => item.id === segmentId);
  if (!segment) {
    return {
      status: 'blocked',
      reason: 'unknown_segment',
      message: `Unknown segment: ${segmentId}`,
      changes: [],
      conflicts: [],
    };
  }

  const delta = Number(offsetSeconds);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 600) {
    return {
      status: 'blocked',
      reason: 'invalid_offset',
      message: 'Offset must be a non-zero whole number of seconds between -600 and 600.',
      changes: [],
      conflicts: [],
    };
  }

  if (!['segment_only', 'ripple_after'].includes(mode)) {
    return {
      status: 'blocked',
      reason: 'invalid_mode',
      message: `Unsupported retime mode: ${mode}`,
      changes: [],
      conflicts: [],
    };
  }

  const segmentIndexes = schedule
    .map((cue, index) => ({ cue, index }))
    .filter(({ cue }) => cue.segment === segmentId);

  if (segmentIndexes.length === 0) {
    return {
      status: 'blocked',
      reason: 'empty_segment',
      message: `No cues belong to ${segment.label}.`,
      changes: [],
      conflicts: [],
    };
  }

  const firstIndex = segmentIndexes[0].index;
  const moveIndexes = mode === 'ripple_after'
    ? schedule.map((_, index) => index).filter((index) => index >= firstIndex)
    : segmentIndexes.map(({ index }) => index);

  const lockedCue = moveIndexes
    .map((index) => schedule[index])
    .find((cue) => cue.locked);

  if (lockedCue) {
    return {
      status: 'blocked',
      reason: 'human_lock',
      message: `${lockedCue.id} (${lockedCue.label}) is human-locked and cannot move.`,
      lockedCueId: lockedCue.id,
      changes: [],
      conflicts: [],
    };
  }

  const moveSet = new Set(moveIndexes);
  const candidate = schedule.map((cue, index) => {
    if (!moveSet.has(index)) return { ...cue };
    return {
      ...cue,
      timecode: formatTimecode(parseTimecode(cue.timecode) + delta),
    };
  });

  const changes = schedule.flatMap((cue, index) => {
    const updated = candidate[index];
    if (updated.timecode === cue.timecode) return [];
    return [{
      cueId: cue.id,
      cueNumber: cue.number,
      label: cue.label,
      from: cue.timecode,
      to: updated.timecode,
    }];
  });

  const conflicts = findScheduleConflicts(candidate, constraints);
  const status = conflicts.length === 0 ? 'ready' : 'blocked';
  const id = planId({ revision, segmentId, offsetSeconds: delta, mode });

  return {
    planId: id,
    status,
    reason: status === 'blocked' ? 'schedule_conflict' : null,
    revision,
    expectedRevision,
    segmentId,
    segmentLabel: segment.label,
    offsetSeconds: delta,
    mode,
    changes,
    conflicts,
    message: status === 'ready'
      ? `${changes.length} cue${changes.length === 1 ? '' : 's'} can be retimed without violating current constraints.`
      : `The proposed retime creates ${conflicts.length} schedule conflict${conflicts.length === 1 ? '' : 's'}.`,
  };
}

export function compareRetimeStrategies({
  schedule,
  revision,
  expectedRevision = revision,
  segmentId,
  offsetSeconds,
  constraints = DEFAULT_CONSTRAINTS,
}) {
  const options = ['segment_only', 'ripple_after'].map((mode) =>
    previewSegmentRetime({
      schedule,
      revision,
      expectedRevision,
      segmentId,
      offsetSeconds,
      mode,
      constraints,
    }),
  );

  const ranked = [...options].sort((left, right) => {
    const leftReady = left.status === 'ready' ? 0 : 1;
    const rightReady = right.status === 'ready' ? 0 : 1;
    if (leftReady !== rightReady) return leftReady - rightReady;
    if ((left.conflicts?.length ?? 0) !== (right.conflicts?.length ?? 0)) {
      return (left.conflicts?.length ?? 0) - (right.conflicts?.length ?? 0);
    }
    return (left.changes?.length ?? 0) - (right.changes?.length ?? 0);
  });

  const best = ranked[0] ?? null;
  const readyOptions = options.filter((option) => option.status === 'ready');

  return {
    status: readyOptions.length ? 'ready' : 'blocked',
    revision,
    segmentId,
    offsetSeconds,
    options: options.map((option) => ({
      mode: option.mode,
      status: option.status,
      reason: option.reason,
      message: option.message,
      changedCueCount: option.changes?.length ?? 0,
      conflicts: option.conflicts ?? [],
      lockedCueId: option.lockedCueId ?? null,
      planId: option.planId ?? null,
    })),
    recommendedMode: best?.status === 'ready' ? best.mode : null,
    recommendation: best?.status === 'ready'
      ? `${best.mode === 'ripple_after' ? 'Ripple downstream cues' : 'Move only the selected segment'}: it satisfies the current deterministic constraints with ${best.changes.length} cue changes.`
      : 'No currently evaluated strategy can satisfy the active locks and timing constraints.',
  };
}

export function applyRetimePlan(schedule, plan) {
  if (!plan || plan.status !== 'ready') return schedule;
  const byId = new Map(plan.changes.map((change) => [change.cueId, change]));
  return schedule.map((cue) => {
    const change = byId.get(cue.id);
    return change ? { ...cue, timecode: change.to } : cue;
  });
}

export function createRunSnapshot(state) {
  return {
    revision: state.revision,
    hold: state.hold,
    hardOut: DEFAULT_CONSTRAINTS.hardOut,
    segments: SEGMENTS.map((segment) => ({ ...segment })),
    cues: state.schedule.map((cue) => ({
      id: cue.id,
      number: cue.number,
      timecode: cue.timecode,
      department: cue.department,
      segment: cue.segment,
      label: cue.label,
      readiness: state.readiness[cue.id],
      locked: cue.locked,
      runState: cue.runState,
    })),
    conflicts: findScheduleConflicts(state.schedule),
    approval: state.approvedPlanId
      ? { approvedPlanId: state.approvedPlanId }
      : null,
  };
}
