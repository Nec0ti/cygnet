import assert from 'node:assert/strict';
import { openStore, writeSettings } from './store.js';
import { compareExperiment, createExperiment, ensureExperimentSchema, finishExperiment, getExperiment, listExperiments, replayEvents } from './experiments.js';

const db = openStore(':memory:');
try {
  ensureExperimentSchema(db);
  const account = db.prepare(`INSERT INTO accounts(id,name,username,created_at,is_human) VALUES(?,?,?,?,?)`);
  account.run('human','Human','human','2026-01-01T00:00:00.000Z',1);
  account.run('a1','A One','aone','2026-01-01T00:00:00.000Z',0);
  account.run('a2','A Two','atwo','2026-01-01T00:00:00.000Z',0);
  account.run('b1','B One','bone','2026-01-01T00:00:00.000Z',0);
  const event = db.prepare('INSERT INTO events(id,actor_id,type,payload,created_at) VALUES(?,?,?,?,?)');
  event.run('old','a1','post.created','{}','2026-03-01T00:00:00.000Z');

  const experiment = createExperiment(db,{label:'Reply tone',cohortA:['a1','a2'],cohortB:['b1'],now:'2026-04-01T00:00:00.000Z'});
  assert.equal(experiment.settings.maxActivePersonas,10);
  assert.throws(()=>createExperiment(db,{label:'overlap',cohortA:['a1'],cohortB:['a1']}),/must not overlap/);
  assert.throws(()=>createExperiment(db,{label:'human',cohortA:['human'],cohortB:['b1']}),/unique AI profile IDs/);
  assert.throws(()=>createExperiment(db,{label:'missing',cohortA:['missing'],cohortB:['b1']}),/existing AI profile/);

  event.run('evt-1','a1','post.created','{}','2026-04-02T12:00:00.000Z');
  event.run('evt-2','a2','message.sent','{}','2026-04-02T12:00:00.000Z');
  event.run('evt-3','b1','post.created','{}','2026-04-02T13:00:00.000Z');
  writeSettings(db,{speedMultiplier:2});
  const finished = finishExperiment(db,experiment.id,'2026-04-03T00:00:00.000Z');
  assert.equal(finished.settings.speedMultiplier,1);
  assert.equal(listExperiments(db).length,1);
  assert.equal(getExperiment(db,experiment.id).finishedAt,'2026-04-03T00:00:00.000Z');
  event.run('after','a1','post.created','{}','2026-04-04T00:00:00.000Z');
  assert.throws(()=>finishExperiment(db,experiment.id),/already finished/);
  const compared = compareExperiment(db,experiment.id);
  assert.equal(compared.cohorts.a.totalEvents,2);
  assert.equal(compared.cohorts.a.eventsPerAccount,1);
  assert.equal(compared.cohorts.b.events['post.created'],1);
  assert.deepEqual(replayEvents(db,{from:'2026-04-02T00:00:00.000Z',to:'2026-04-03T00:00:00.000Z'}).map((row)=>row.id),['evt-1','evt-2','evt-3']);
  assert.throws(()=>replayEvents(db,{from:'bad',to:'2026-04-03'}),/valid from\/to range/);
  console.log('Experiment cohorts and read-only replay self-check passed.');
} finally {
  db.close();
}
