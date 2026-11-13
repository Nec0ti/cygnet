import assert from 'node:assert/strict';
import { CodexRunner, findThreadId, parseJsonEvents } from './codex-runner.mjs';

const events = parseJsonEvents('{"type":"thread.started","thread_id":"thread-123"}\nnot-json\n{"type":"done"}');
assert.equal(events.length, 2);
assert.equal(findThreadId(events), 'thread-123');
const runner = new CodexRunner({ maxConcurrent: 20 });
assert.equal(runner.maxConcurrent, 10);
await assert.rejects(() => runner.runPersona({ age: 15, systemMd: 'Age: 15', task: 'say hi' }), /valid persona age/);
console.log('Codex runner self-check passed');
