import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getLinecallToolDefinitions } from '../src/webmcp.js';

test('LINECALL exposes a small focused WebMCP surface', () => {
  const tools = getLinecallToolDefinitions();
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      'linecall_get_run_snapshot',
      'linecall_compare_retime_options',
      'linecall_preview_segment_retime',
      'linecall_apply_approved_retime',
      'linecall_set_cue_readiness',
    ],
  );
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[0].annotations.untrustedContentHint, true);
  assert.equal(tools[1].annotations.readOnlyHint, true);
  assert.equal(tools[1].annotations.untrustedContentHint, true);
  assert.equal(tools[2].annotations.readOnlyHint, false);
  assert.equal(tools[2].annotations.idempotentHint, true);
  assert.equal(tools[2].annotations.untrustedContentHint, true);
  assert.equal(tools[3].annotations.readOnlyHint, false);
});

test('mutating retime tool requires exact plan and revision', () => {
  const tool = getLinecallToolDefinitions().find(
    (candidate) => candidate.name === 'linecall_apply_approved_retime',
  );
  assert.deepEqual(tool.inputSchema.required, ['plan_id', 'expected_revision']);
  assert.equal(tool.inputSchema.additionalProperties, false);
});

test('source uses the current document.modelContext WebMCP registration API', async () => {
  const source = await readFile(new URL('../src/webmcp.js', import.meta.url), 'utf8');
  assert.match(source, /document\.modelContext\.registerTool/);
  assert.doesNotMatch(source, /navigator\.modelContext\.registerTool/);
});
