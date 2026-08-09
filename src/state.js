export const DEPARTMENTS = ['stage', 'audio', 'lighting', 'video'];
export const READINESS = ['pending', 'ready', 'check'];

export function createInitialState(cues) {
  const currentCue = cues.find((cue) => cue.runState === 'current') ?? cues[0] ?? null;
  return {
    selectedCueId: currentCue?.id ?? null,
    departments: [],
    query: '',
    readiness: Object.fromEntries(cues.map((cue) => [cue.id, 'pending'])),
    hold: false,
    dataState: 'ready',
    detailOpen: false,
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
      cue.label,
      cue.instruction,
      cue.notes,
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
      return {
        ...state,
        readiness: {
          ...state.readiness,
          [action.cueId]: action.readiness,
        },
        announcement: `Cue ${humanCueNumber(action.cueId)} readiness set to ${action.readiness}.`,
      };
    case 'TOGGLE_HOLD':
      return {
        ...state,
        hold: !state.hold,
        announcement: state.hold
          ? 'Local rehearsal run resumed.'
          : 'Local rehearsal run placed on hold.',
      };
    case 'SIMULATE_ERROR':
      return {
        ...state,
        dataState: 'error',
        detailOpen: false,
        announcement: 'Fixture data error simulated.',
      };
    case 'RECOVER_DATA':
      return {
        ...state,
        dataState: 'ready',
        announcement: 'Fixture data restored.',
      };
    case 'RESET':
      return {
        ...action.initialState,
        announcement: 'LINECALL fixture reset to its initial state.',
      };
    default:
      return state;
  }
}
