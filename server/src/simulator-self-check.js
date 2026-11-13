import assert from 'node:assert/strict';
import { dueActions, parseModelJson, validateActionPlan } from './simulator.js';

const time='2026-11-13T00:00:00.000Z';
const shy={activity_json:JSON.stringify({postMode:'story_only',postIntervalHours:null,storyIntervalHours:24,dmInitiation:'only_after_contact'}),
  post_due_at:null,story_due_at:time,dm_due_at:null,engagement_due_at:null,last_contact_at:null,last_dm_at:null};
assert.deepEqual(dueActions(shy,Date.parse(time)),['story']);
assert.ok(dueActions({...shy,last_contact_at:time},Date.parse(time)).includes('dm'));
assert.ok(!dueActions({...shy,last_contact_at:time,last_dm_at:time},Date.parse(time)).includes('dm'));

assert.deepEqual(parseModelJson('```json\n{"assignments":[]}\n```'),{assignments:[]});
const due=new Map([['u0001',new Set(['like','dm'])]]);
assert.deepEqual(validateActionPlan({assignments:[{personaId:'u0001',kind:'like',targetId:'p1'}]},due,
  {posts:new Set(['p1']),accounts:new Set(['u0002']),blocked:new Set()}),
[{personaId:'u0001',kind:'like',targetId:'p1'}]);
assert.throws(()=>validateActionPlan({assignments:[{personaId:'u0001',kind:'like',targetId:'unknown'}]},due,
  {posts:new Set(['p1']),accounts:new Set(['u0002']),blocked:new Set()}),/unknown post/);
assert.throws(()=>validateActionPlan({assignments:[]},due,
  {posts:new Set(),accounts:new Set(),blocked:new Set()}),/assign every selected persona/);
console.log('Simulator self-check passed.');
