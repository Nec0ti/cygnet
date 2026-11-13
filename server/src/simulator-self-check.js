import assert from 'node:assert/strict';
import { dueActions, parseModelJson, validateActionPlan, retryDelayMinutes, dmSafetyBoundary } from './simulator.js';

const time='2026-11-13T00:00:00.000Z';
const shy={activity_json:JSON.stringify({postMode:'story_only',postIntervalHours:null,storyIntervalHours:24,dmInitiation:'only_after_contact'}),
  post_due_at:null,story_due_at:time,dm_due_at:null,engagement_due_at:null,last_contact_at:null,last_dm_at:null};
assert.deepEqual(dueActions(shy,Date.parse(time)),['story']);
assert.ok(dueActions({...shy,last_contact_at:time,dm_due_at:time},Date.parse(time)).includes('dm'));
assert.ok(!dueActions({...shy,last_contact_at:time,last_dm_at:time,dm_due_at:time},Date.parse(time)).includes('dm'));
assert.deepEqual(dueActions({...shy,post_due_at:null,story_due_at:null,seen_due_at:time},Date.parse(time)),['dm']);
assert.deepEqual(dueActions({...shy,post_due_at:null,story_due_at:null,read_due_at:time},Date.parse(time)),['read']);
assert.ok(dueActions({...shy,post_due_at:null,story_due_at:null,human_reply_due_at:time},Date.parse(time)).includes('dm'));
assert.ok(!dueActions({...shy,last_contact_at:time,dm_due_at:new Date(Date.parse(time)+60_000).toISOString()},Date.parse(time)).includes('dm'));
assert.ok(dueActions({...shy,last_contact_at:time,dm_due_at:time},Date.parse(time)).includes('dm'));
assert.ok(dueActions({...shy,evade_due_at:time},Date.parse(time)).includes('evade_block'));
assert.deepEqual([0,1,2,3,4,5,6].map(retryDelayMinutes),[15,30,60,120,240,360,360]);
assert.match(dmSafetyBoundary(22,19),/Mild, non-graphic adult flirtation/);
assert.match(dmSafetyBoundary(17,19),/strictly non-sexual/);
assert.match(dmSafetyBoundary(19,null),/age is unknown/);

assert.deepEqual(parseModelJson('```json\n{"assignments":[]}\n```'),{assignments:[]});
const due=new Map([['u0001',new Set(['like','dm'])]]);
assert.deepEqual(validateActionPlan({assignments:[{personaId:'u0001',kind:'like',targetId:'p1'}]},due,
  {posts:new Set(['p1']),accounts:new Set(['u0002']),blocked:new Set()}),
[{personaId:'u0001',kind:'like',targetId:'p1'}]);
assert.throws(()=>validateActionPlan({assignments:[{personaId:'u0001',kind:'like',targetId:'unknown'}]},due,
  {posts:new Set(['p1']),accounts:new Set(['u0002']),blocked:new Set()}),/unknown post/);
assert.throws(()=>validateActionPlan({assignments:[]},due,
  {posts:new Set(),accounts:new Set(),blocked:new Set()}),/assign every selected persona/);
const evadeDue=new Map([['u0001',new Set(['evade_block'])]]);
assert.deepEqual(validateActionPlan({assignments:[{personaId:'u0001',kind:'evade_block',targetId:'human'}]},evadeDue,
  {posts:new Set(),accounts:new Set(),blocked:new Set()}),[{personaId:'u0001',kind:'evade_block',targetId:'human'}]);
assert.throws(()=>validateActionPlan({assignments:[{personaId:'u0001',kind:'evade_block',targetId:'u0002'}]},evadeDue,
  {posts:new Set(),accounts:new Set(),blocked:new Set()}),/must target the human profile/);
console.log('Simulator self-check passed.');
