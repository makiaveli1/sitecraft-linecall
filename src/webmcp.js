const APPLY_APPROVED_RETIME_TOOL = 'linecall_apply_approved_retime';

const TOOL_DEFINITIONS = [
  {
    name: 'linecall_get_run_snapshot',
    description: 'Use this to inspect LINECALL before making a scheduling decision. Returns the current revision, cue times, human locks, readiness, segments, hard-out, and deterministic conflicts.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'linecall_compare_retime_options',
    description: 'Use this when the user asks to move a production segment and you need to compare safe strategies before choosing one. It evaluates segment-only and downstream-ripple retiming against the same human locks, revision, chronology, department spacing, and hard-out constraints, then returns the safest currently valid option without changing the run.',
    inputSchema: {
      type: 'object',
      properties: {
        segment_id: {
          type: 'string',
          enum: ['preshow', 'opening', 'qa', 'panel'],
          description: 'The run segment to analyze.',
        },
        offset_seconds: {
          type: 'integer',
          minimum: -600,
          maximum: 600,
          description: 'Whole seconds to move the segment. Positive is later; negative is earlier.',
        },
        expected_revision: {
          type: 'integer',
          minimum: 1,
          description: 'Revision returned by linecall_get_run_snapshot.',
        },
      },
      required: ['segment_id', 'offset_seconds', 'expected_revision'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'linecall_preview_segment_retime',
    description: 'Use this before changing cue times. It previews moving one named segment and reports exact cue changes, human-lock violations, chronology conflicts, department spacing conflicts, and hard-out violations. Prefer segment_only first; use ripple_after only when downstream cues should move together.',
    inputSchema: {
      type: 'object',
      properties: {
        segment_id: {
          type: 'string',
          enum: ['preshow', 'opening', 'qa', 'panel'],
          description: 'The run segment to retime.',
        },
        offset_seconds: {
          type: 'integer',
          minimum: -600,
          maximum: 600,
          description: 'Whole seconds to move the segment. Positive is later; negative is earlier.',
        },
        mode: {
          type: 'string',
          enum: ['segment_only', 'ripple_after'],
          description: 'segment_only moves only the selected segment. ripple_after moves the selected segment and all later cues, while still respecting human locks and hard-out.',
        },
        expected_revision: {
          type: 'integer',
          minimum: 1,
          description: 'Revision returned by linecall_get_run_snapshot. The preview fails closed if it is stale.',
        },
      },
      required: ['segment_id', 'offset_seconds', 'mode', 'expected_revision'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: true,
    },
  },
  {
    name: 'linecall_apply_approved_retime',
    description: 'Use this only after the exact preview plan is visibly approved by the human operator in LINECALL. Applies that one plan only if its plan ID and revision still match. Never use this to bypass a human lock or approval.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'Exact plan ID returned by linecall_preview_segment_retime.',
        },
        expected_revision: {
          type: 'integer',
          minimum: 1,
          description: 'The schedule revision on which the approved plan was calculated.',
        },
      },
      required: ['plan_id', 'expected_revision'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'linecall_set_cue_readiness',
    description: 'Use this to update operational readiness for one cue. This never changes timing, human locks, or the run structure.',
    inputSchema: {
      type: 'object',
      properties: {
        cue_id: {
          type: 'string',
          pattern: '^cue-\\d{3}$',
          description: 'Cue ID such as cue-024.',
        },
        readiness: {
          type: 'string',
          enum: ['pending', 'ready', 'check'],
        },
        expected_revision: {
          type: 'integer',
          minimum: 1,
          description: 'Current schedule revision. Readiness updates fail closed if the agent is acting on an old schedule.',
        },
      },
      required: ['cue_id', 'readiness', 'expected_revision'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  },
];

function unsupportedResult() {
  return {
    supported: false,
    status: 'unsupported',
    toolCount: 0,
    message: 'This browser does not expose the WebMCP modelContext API.',
  };
}

export function registerLinecallWebMCP(
  apiRef,
  onStatus,
  { allowApprovedRetime = false } = {},
) {
  const modelContext = document?.modelContext;
  if (!modelContext?.registerTool) {
    const result = unsupportedResult();
    onStatus?.(result);
    return () => {};
  }

  const abortController = new AbortController();
  const activeDefinitions = TOOL_DEFINITIONS.filter(
    (definition) => allowApprovedRetime || definition.name !== APPLY_APPROVED_RETIME_TOOL,
  );

  const handlers = {
    linecall_get_run_snapshot: async () => apiRef.current.getSnapshot(),
    linecall_compare_retime_options: async ({
      segment_id: segmentId,
      offset_seconds: offsetSeconds,
      expected_revision: expectedRevision,
    }) => apiRef.current.compareRetime({ segmentId, offsetSeconds, expectedRevision }),
    linecall_preview_segment_retime: async ({
      segment_id: segmentId,
      offset_seconds: offsetSeconds,
      mode,
      expected_revision: expectedRevision,
    }) => apiRef.current.previewRetime({
      segmentId,
      offsetSeconds,
      mode,
      expectedRevision,
    }),
    linecall_apply_approved_retime: async ({
      plan_id: planId,
      expected_revision: expectedRevision,
    }) => apiRef.current.applyApprovedRetime({ planId, expectedRevision }),
    linecall_set_cue_readiness: async ({
      cue_id: cueId,
      readiness,
      expected_revision: expectedRevision,
    }) => apiRef.current.setReadiness({ cueId, readiness, expectedRevision }),
  };

  const registrations = activeDefinitions.map((definition) =>
    document.modelContext.registerTool(
      {
        ...definition,
        execute: handlers[definition.name],
      },
      { signal: abortController.signal },
    ),
  );

  Promise.all(registrations)
    .then(async () => {
      let discoveredToolCount = null;
      let browserVerified = false;
      let discoveryMessage = '';

      if (typeof modelContext.getTools === 'function') {
        try {
          const availableTools = await modelContext.getTools();
          const expectedNames = new Set(activeDefinitions.map(({ name }) => name));
          discoveredToolCount = availableTools.filter((tool) => expectedNames.has(tool.name)).length;
          browserVerified = discoveredToolCount === activeDefinitions.length;
          discoveryMessage = browserVerified
            ? ` All ${activeDefinitions.length} active LINECALL tools were rediscovered through document.modelContext.getTools().`
            : ` Browser discovery found ${discoveredToolCount} of ${activeDefinitions.length} active LINECALL tools.`;
        } catch (error) {
          discoveryMessage = ` Browser discovery check was unavailable: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      onStatus?.({
        supported: true,
        status: 'registered',
        toolCount: activeDefinitions.length,
        discoveredToolCount,
        browserVerified,
        approvedApplyAvailable: allowApprovedRetime,
        message: `${activeDefinitions.length} WebMCP tools registered for this LINECALL session. ${allowApprovedRetime ? 'The exact approved-plan apply capability is available.' : 'The apply capability stays hidden until the human approves an exact plan.'}${discoveryMessage}`,
      });
    })
    .catch((error) => {
      onStatus?.({
        supported: true,
        status: 'error',
        toolCount: 0,
        message: error instanceof Error ? error.message : String(error),
      });
    });

  return () => abortController.abort();
}

export function getLinecallToolDefinitions() {
  return TOOL_DEFINITIONS.map(({ name, description, inputSchema, annotations }) => ({
    name,
    description,
    inputSchema,
    annotations,
  }));
}
