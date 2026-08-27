import test from 'node:test';
import assert from 'node:assert/strict';

import { getLinecallToolDefinitions, registerLinecallWebMCP } from '../src/webmcp.js';

function nextTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function installModelContext() {
  const tools = new Map();

  globalThis.document = {
    modelContext: {
      registerTool(tool, { signal } = {}) {
        tools.set(tool.name, tool);
        signal?.addEventListener('abort', () => tools.delete(tool.name), { once: true });
        return Promise.resolve();
      },
      async getTools() {
        return [...tools.values()].map(({ name, description, inputSchema, annotations }) => ({
          name,
          description,
          inputSchema,
          annotations,
        }));
      },
    },
  };

  return tools;
}

const APPLY_TOOL = 'linecall_apply_approved_retime';

test('apply capability stays hidden until the human approves an exact plan', async () => {
  const originalDocument = globalThis.document;
  const registered = installModelContext();
  let status = null;

  try {
    const cleanup = registerLinecallWebMCP(
      { current: {} },
      (nextStatus) => {
        status = nextStatus;
      },
    );

    await nextTick();

    assert.equal(getLinecallToolDefinitions().length, 5, 'The catalogue still defines all five domain tools.');
    assert.equal(registered.size, 4, 'Only currently usable tools should be exposed before approval.');
    assert.equal(registered.has(APPLY_TOOL), false);
    assert.equal(status?.status, 'registered');
    assert.equal(status?.toolCount, 4);
    assert.equal(status?.discoveredToolCount, 4);
    assert.equal(status?.browserVerified, true);
    assert.equal(status?.approvedApplyAvailable, false);
    assert.match(status?.message ?? '', /apply capability stays hidden until the human approves/i);

    cleanup();
    assert.equal(registered.size, 0, 'Abort cleanup must withdraw the active WebMCP surface.');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('human approval exposes the one-time apply capability and teardown withdraws it', async () => {
  const originalDocument = globalThis.document;
  const registered = installModelContext();
  let status = null;

  try {
    const cleanup = registerLinecallWebMCP(
      { current: {} },
      (nextStatus) => {
        status = nextStatus;
      },
      { allowApprovedRetime: true },
    );

    await nextTick();

    assert.equal(registered.size, 5);
    assert.equal(registered.has(APPLY_TOOL), true);
    assert.equal(status?.status, 'registered');
    assert.equal(status?.toolCount, 5);
    assert.equal(status?.discoveredToolCount, 5);
    assert.equal(status?.browserVerified, true);
    assert.equal(status?.approvedApplyAvailable, true);
    assert.match(status?.message ?? '', /approved-plan apply capability is available/i);

    cleanup();
    assert.equal(registered.size, 0, 'Once approval is cleared or consumed, effect cleanup withdraws apply authority.');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
