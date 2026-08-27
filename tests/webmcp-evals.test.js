import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getLinecallToolDefinitions } from '../src/webmcp.js';

const evals = JSON.parse(
  await readFile(new URL('../evals/webmcp-agent-cases.json', import.meta.url), 'utf8'),
);

function assertArgumentsMatchSchema(schema, args, label) {
  assert.equal(typeof args, 'object', `${label}: arguments must be an object`);
  assert.ok(args !== null && !Array.isArray(args), `${label}: arguments must be a plain object`);

  for (const required of schema.required ?? []) {
    assert.ok(Object.hasOwn(args, required), `${label}: missing required argument ${required}`);
  }

  if (schema.additionalProperties === false) {
    const allowed = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(args)) {
      assert.ok(allowed.has(key), `${label}: unexpected argument ${key}`);
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const property = schema.properties?.[key];
    assert.ok(property, `${label}: schema missing property ${key}`);

    if (property.type === 'integer') {
      assert.ok(Number.isInteger(value), `${label}: ${key} must be an integer`);
      if (property.minimum !== undefined) assert.ok(value >= property.minimum, `${label}: ${key} below minimum`);
      if (property.maximum !== undefined) assert.ok(value <= property.maximum, `${label}: ${key} above maximum`);
    }
    if (property.type === 'string') {
      assert.equal(typeof value, 'string', `${label}: ${key} must be a string`);
      if (property.pattern) assert.match(value, new RegExp(property.pattern), `${label}: ${key} fails pattern`);
    }
    if (property.enum) {
      assert.ok(property.enum.includes(value), `${label}: ${key} must be one of ${property.enum.join(', ')}`);
    }
  }
}

test('WebMCP eval dataset only references real LINECALL tools with schema-valid arguments', () => {
  const tools = new Map(getLinecallToolDefinitions().map((tool) => [tool.name, tool]));

  for (const evalCase of evals.cases) {
    for (const call of evalCase.expectedCall) {
      const tool = tools.get(call.functionName);
      assert.ok(tool, `${evalCase.id}: unknown expected tool ${call.functionName}`);
      assertArgumentsMatchSchema(tool.inputSchema, call.arguments, `${evalCase.id}/${call.functionName}`);
    }
    for (const forbidden of evalCase.forbiddenCalls ?? []) {
      assert.ok(tools.has(forbidden), `${evalCase.id}: unknown forbidden tool ${forbidden}`);
    }
  }
});

test('safe Q&A delay eval encodes compare -> preview -> human stop boundary', () => {
  const evalCase = evals.cases.find((candidate) => candidate.id === 'safe-qa-delay-indirect');
  assert.deepEqual(
    evalCase.expectedCall.map((call) => call.functionName),
    [
      'linecall_get_run_snapshot',
      'linecall_compare_retime_options',
      'linecall_preview_segment_retime',
    ],
  );
  assert.equal(evalCase.expectedCall[2].arguments.mode, 'ripple_after');
  assert.ok(evalCase.forbiddenCalls.includes('linecall_apply_approved_retime'));
});

test('negative evals preserve human authority and avoid unrelated tool use', () => {
  const unlockCase = evals.cases.find((candidate) => candidate.id === 'no-agent-unlock-capability');
  const unrelatedCase = evals.cases.find((candidate) => candidate.id === 'unrelated-request-no-tool');

  assert.equal(
    getLinecallToolDefinitions().some((tool) => /unlock/i.test(tool.name)),
    false,
    'No agent-exposed unlock tool should exist.',
  );
  assert.equal(unrelatedCase.expectedCall.length, 0);
  assert.ok(unlockCase.forbiddenCalls.includes('linecall_apply_approved_retime'));
});
