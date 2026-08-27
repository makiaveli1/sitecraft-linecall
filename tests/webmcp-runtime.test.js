import test from 'node:test';
import assert from 'node:assert/strict';

import { getLinecallToolDefinitions, registerLinecallWebMCP } from '../src/webmcp.js';

function nextTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('WebMCP registration can be rediscovered through the browser model context', async () => {
  const originalDocument = globalThis.document;
  const registered = [];
  let status = null;

  globalThis.document = {
    modelContext: {
      registerTool(tool) {
        registered.push(tool);
        return Promise.resolve();
      },
      async getTools() {
        return registered.map(({ name, description, inputSchema, annotations }) => ({
          name,
          description,
          inputSchema,
          annotations,
        }));
      },
    },
  };

  try {
    const cleanup = registerLinecallWebMCP(
      { current: {} },
      (nextStatus) => {
        status = nextStatus;
      },
    );

    await nextTick();

    assert.equal(registered.length, getLinecallToolDefinitions().length);
    assert.equal(status?.status, 'registered');
    assert.equal(status?.browserVerified, true);
    assert.equal(status?.discoveredToolCount, 5);
    assert.match(status?.message ?? '', /rediscovered through document\.modelContext\.getTools/);

    cleanup();
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('preview is an idempotent state-changing tool, not a read-only tool', () => {
  const preview = getLinecallToolDefinitions().find(
    (tool) => tool.name === 'linecall_preview_segment_retime',
  );

  assert.equal(preview.annotations.readOnlyHint, false);
  assert.equal(preview.annotations.destructiveHint, false);
  assert.equal(preview.annotations.idempotentHint, true);
  assert.equal(preview.annotations.untrustedContentHint, true);
});
