import { applyRetimePlan, createSchedule } from './schedule.js';

export const DEPARTMENTS = ['stage', 'audio', 'lighting', 'video'];
export const READINESS = ['pending', 'ready', 'check'];

export function createInitialState(cues) {
  const schedule = createSchedule(cues);
  const currentCue = schedule.find((cue) => cue.runState === 'current') ?? schedule[0] ?? null;
  return {
    schedule,
    revision: 1,
    selectedCueId: currentCue?.id ?? null,
    departments: [],
    query: '',
    readiness: Object.fromEntries(schedule.map((cue) => [cue.id, 'pending'])),
    hold: false,
    dataState: 'ready',
    detailOpen: false,
    retimePreview: null,
    approvedPlanId: null,
    receipts: [],
    webmcp: {
      supported: false,
      status: 'checking',
      toolCount: 0,
      message: 'Checking browser WebMCP support…',
    },
    announcement: currentCue
      ? `Current cue ${String(currentCue.number).padStart(3, '0')} selected.`
      : 'No cue is selected.',
  };
}

export function filterCues(cues, state) {
  const query = state.query.trim().toLocaleLowerCase();
  return cues.filter((cue) => {
    const departmentMatch =
      state.departments.length === 0 || state.departments.includes(cue.department);
    if (!departmentMatch) return false;
    if (!query) return true;
    const haystack = [
      cue.id,
      String(cue.number),
      cue.timecode,
      cue.department,
      cue.segment,
      cue.label,
      cue.instruction,
      cue.notes,
      cue.locked ? 'locked human lock' : '',
    ]
      .join(' ')
      .toLocaleLowerCase();
    return haystack.includes(query);
  });
}

export function getSequenceContext(cues) {
  const currentIndex = cues.findIndex((cue) => cue.runState === 'current');
  return {
    current: currentIndex >= 0 ? cues[currentIndex] : null,
    next: currentIndex >= 0 ? cues[currentIndex + 1] ?? null : cues[0] ?? null,
  };
}

export function nextVisibleCueId(visibleIds, selectedCueId, delta) {
  if (visibleIds.length === 0) return null;
  const currentIndex = visibleIds.indexOf(selectedCueId);
  if (currentIndex < 0) return visibleIds[0];
  const targetIndex = Math.min(
    visibleIds.length - 1,
    Math.max(0, currentIndex + delta),
  );
  return visibleIds[targetIndex];
}

function humanCueNumber(cueId) {
  const number = String(cueId ?? '').replace('cue-', '');
  return number || 'unknown';
}

function receiptForPlan(plan, revision) {
  return {
    id: `receipt-r${revision}-${plan.planId}`,
    revision,
    planId: plan.planId,
    summary: `${plan.segmentLabel} moved ${plan.offsetSeconds > 0 ? '+' : ''}${plan.offsetSeconds}s using ${plan.mode === 'ripple_after' ? 'ripple' : 'segment-only'} mode.`,
    changedCueCount: plan.changes.length,
    source: 'WebMCP agent + human approval',
  };
}

export function appReducer(state, action) {
  switch (action.type) {
    case 'SELECT_CUE':
      return {
        ...state,
        selectedCueId: action.cueId,
        detailOpen: action.openDetail ?? true,
        announcement: `Cue ${humanCueNumber(action.cueId)} selected.`,
      };
    case 'MOVE_SELECTION': {
      const cueId = nextVisibleCueId(
        action.visibleIds ?? [],
        action.fromCueId ?? state.selectedCueId,
        action.delta ?? 0,
      );
      if (!cueId || cueId === state.selectedCueId) return state;
      return {
        ...state,
        selectedCueId: cueId,
        detailOpen: false,
        announcement: `Cue ${humanCueNumber(cueId)} selected.`,
      };
    }
    case 'CLOSE_DETAIL':
      return {
        ...state,
        detailOpen: false,
        announcement: 'Returned to cue score.',
      };
    case 'TOGGLE_DEPARTMENT': {
      const exists = state.departments.includes(action.department);
      const departments = exists
        ? state.departments.filter((item) => item !== action.department)
        : [...state.departments, action.department];
      return {
        ...state,
        departments,
        detailOpen: false,
      };
    }
    case 'CLEAR_FILTERS':
      return {
        ...state,
        departments: [],
        query: '',
        detailOpen: false,
      };
    case 'SET_QUERY':
      return {
        ...state,
        query: action.query ?? '',
        detailOpen: false,
      };
    case 'SET_READINESS':
      if (!READINESS.includes(action.readiness)) return state;
      if (!state.schedule.some((cue) => cue.id === action.cueId)) return state;
      return {
        ...state,
        readiness: {
          ...state.readiness,
          [action.cueId]: action.readiness,
        },
        announcement: `Cue ${humanCueNumber(action.cueId)} readiness set to ${action.readiness}.`,
      };
    case 'TOGGLE_CUE_LOCK': {
      const schedule = state.schedule.map((cue) =>
        cue.id === action.cueId ? { ...cue, locked: !cue.locked } : cue,
      );
      const cue = schedule.find((item) => item.id === action.cueId);
      if (!cue) return state;
      return {
        ...state,
        schedule,
        revision: state.revision + 1,
        retimePreview: null,
        approvedPlanId: null,
        announcement: `Cue ${humanCueNumber(action.cueId)} ${cue.locked ? 'locked for agent changes' : 'unlocked'}.`,
      };
    }
    case 'SET_RETIME_PREVIEW':
      return {
        ...state,
        retimePreview: action.plan,
        approvedPlanId: null,
        announcement: action.plan?.status === 'ready'
          ? 'Agent retime preview is ready for human review.'
          : 'Agent retime preview was blocked by schedule constraints.',
      };
    case 'APPROVE_RETIME_PREVIEW':
      if (!state.retimePreview || state.retimePreview.status !== 'ready') return state;
      return {
        ...state,
        approvedPlanId: state.retimePreview.planId,
        announcement: 'Exact retime plan approved. The agent may now apply it once.',
      };
    case 'DISMISS_RETIME_PREVIEW':
      return {
        ...state,
        retimePreview: null,
        approvedPlanId: null,
        announcement: 'Agent retime preview dismissed.',
      };
    case 'APPLY_RETIME_PLAN': {
      const plan = action.plan;
      if (!plan || plan.status !== 'ready') return state;
      if (state.approvedPlanId !== plan.planId) return state;
      if (plan.revision !== state.revision) return state;
      const nextRevision = state.revision + 1;
      return {
        ...state,
        schedule: applyRetimePlan(state.schedule, plan),
        revision: nextRevision,
        retimePreview: null,
        approvedPlanId: null,
        receipts: [receiptForPlan(plan, nextRevision), ...state.receipts].slice(0, 5),
        announcement: `${plan.segmentLabel} retime applied. Schedule revision ${nextRevision}.`,
      };
    }
    case 'SET_WEBMCP_STATUS':
      return {
        ...state,
        webmcp: action.status,
      };
    case 'TOGGLE_HOLD':
      return {
        ...state,
        hold: !state.hold,
        announcement: state.hold
          ? 'Run resumed.'
          : 'Run placed on hold.',
      };
    case 'SIMULATE_ERROR':
      return {
        ...state,
        dataState: 'error',
        detailOpen: false,
        announcement: 'Demo data fault simulated.',
      };
    case 'RECOVER_DATA':
      return {
        ...state,
        dataState: 'ready',
        announcement: 'Run data restored.',
      };
    case 'RESET':
      return {
        ...action.initialState,
        webmcp: state.webmcp,
        announcement: 'LINECALL demo run reset to its initial state.',
      };
    default:
      return state;
  }
}
