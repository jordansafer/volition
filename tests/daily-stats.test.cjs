const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup(initial = {}) {
  let now = Date.parse('2026-09-01T23:00:00Z');
  const state = structuredClone(initial);
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({ Date: Clock, chrome: { storage: { local: {
    async get() { await Promise.resolve(); return structuredClone(state); },
    async set(values) { await Promise.resolve(); Object.assign(state, structuredClone(values)); },
    async remove(keys) { for (const key of keys) delete state[key]; }
  } } } });
  const reload = () => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'daily-stats.js'), 'utf8'), context);
  reload();
  return { state, get stats() { return context.VolitionStats; }, reload, setTime: value => { now = Date.parse(value); } };
}
test('parallel updates survive worker restart without losing counters or retaining API events', async () => {
  const s = setup();
  await Promise.all(Array.from({ length: 150 }, () => s.stats.api(12, 250, 'chat')));
  s.reload();
  await s.stats.api(5, 100, 'classification');
  const data = await s.stats.read();
  assert.equal(data.days['2026-09-01'].calls, 151);
  assert.equal(data.days['2026-09-01'].tokens, 1805);
  assert.equal(data.days['2026-09-01'].responseMs, 37600);
  assert.equal(data.days['2026-09-01'].classificationCalls, 1);
  assert.deepEqual(Object.keys(s.state), ['dailyStatistics']);
  assert.ok(JSON.stringify(data).length < 500);
});
test('90 UTC day retention includes sparse days and prunes on reading', async () => {
  const s = setup();
  for (let i = 0; i < 200; i++) {
    s.setTime(new Date(Date.parse('2026-01-01T10:00Z') + i * 86400000).toISOString());
    await s.stats.api(1, 1, 'chat');
  }
  assert.equal(Object.keys(s.state.dailyStatistics.days).length, 90);
  s.setTime('2027-01-01T00:00Z');
  assert.equal(Object.keys((await s.stats.read()).days).length, 0);
});
test('pause counts elapsed time once, splits midnight, handles extension, resume and expiry', async () => {
  const s = setup();
  await s.stats.pause({ pauseUntil: Date.parse('2026-09-02T02:00Z'), pauseMode: 'partial' });
  s.setTime('2026-09-02T00:30Z');
  let data = await s.stats.read();
  assert.equal(data.days['2026-09-01'].pausedMs, 3600000);
  assert.equal(data.days['2026-09-02'].pausedMs, 1800000);
  await s.stats.read();
  await s.stats.pause({ pauseUntil: Date.parse('2026-09-02T04:00Z'), pauseMode: 'complete' });
  s.setTime('2026-09-02T01:00Z');
  await s.stats.pause(null);
  s.setTime('2026-09-02T05:00Z');
  data = await s.stats.read();
  assert.equal(data.days['2026-09-02'].pausedMs, 3600000);
  assert.equal(s.state.pauseUntil, undefined);
  await s.stats.pause({ pauseUntil: Date.parse('2026-09-02T05:15Z') });
  s.setTime('2026-09-02T06:00Z');
  assert.equal((await s.stats.read()).days['2026-09-02'].pausedMs, 4500000);
});
test('approval consumes a negotiation once, tracks sends and bounded duration histogram', async () => {
  const s = setup();
  await s.stats.block(1, 'example.com');
  await s.stats.message(1, 'session-a');
  await s.stats.message(1, 'session-a');
  await s.stats.approve(1, Date.parse('2026-09-01T23:05Z'));
  await s.stats.approve(1, Date.parse('2026-09-01T23:05Z'));
  await s.stats.leave(1);
  await s.stats.block(1, 'example.com');
  await s.stats.message(1, 'session-b');
  await s.stats.approve(1, null);
  const row = (await s.stats.read()).days['2026-09-01'];
  assert.equal(row.approvals, 2);
  assert.equal(row.approvalMessages, 3);
  assert.equal(row.minutes, 5);
  assert.equal(row.timedApprovals, 1);
  assert.equal(row.durations.length, 11);
  assert.equal(row.durations[1], 1);
  assert.equal(row.unfinished, undefined);
  assert.equal(row.repeat, 1);
});
test('leaving, closing, reloading and inactivity finish negotiations, never bare blocked visits', async () => {
  const s = setup();
  await s.stats.block(1, 'example.com');
  await s.stats.leave(1);
  await s.stats.message(1, 'a');
  await s.stats.message(1, 'b');
  await s.stats.leave(1, true);
  await s.stats.leave(1, true);
  await s.stats.message(2, 'c');
  s.setTime('2026-09-03T00:00Z');
  const data = await s.stats.read();
  assert.equal(data.days['2026-09-01'].unfinished, 2);
  assert.equal(data.days['2026-09-02'].unfinished, 1);
  assert.equal(Object.keys(data.tabs).length, 0);
});
test('tab bookkeeping stays bounded and contains no URLs, prompts or images', async () => {
  const s = setup();
  for (let i = 0; i < 150; i++) {
    await s.stats.block(i, 'example.com');
    await s.stats.message(i, 'session-' + i);
  }
  const data = await s.stats.read();
  assert.equal(Object.keys(data.tabs).length, 100);
  assert.ok(JSON.stringify(data).length < 18000);
  assert.deepEqual(Object.keys(data.tabs[149]).sort(), ['blockedAt', 'domain', 'messages', 'session', 'updated']);
  assert.equal(data.days['2026-09-01'].blocked, 150);
});
test('reset is ordered with updates and keeps settings, approval history and only future pause time', async () => {
  const s = setup({ openaiApiKey: 'keep', proofHistory: [{ desc: 'keep' }] });
  await s.stats.pause({ pauseUntil: Date.parse('2026-09-02T02:00Z') });
  s.setTime('2026-09-02T00:00Z');
  await Promise.all([s.stats.api(10, 30, 'chat'), s.stats.reset(), s.stats.api(2, 5, 'chat')]);
  s.setTime('2026-09-02T01:00Z');
  const data = await s.stats.read();
  assert.equal(data.days['2026-09-02'].calls, 1);
  assert.equal(data.days['2026-09-02'].tokens, 2);
  assert.equal(data.days['2026-09-02'].pausedMs, 3600000);
  assert.equal(s.state.openaiApiKey, 'keep');
  assert.equal(s.state.proofHistory[0].desc, 'keep');
});
test('messages cannot extend the repeat-visit window', async () => {
  const s = setup();
  await s.stats.block(1, 'example.com');
  s.setTime('2026-09-02T22:00Z');
  await s.stats.message(1, 'a');
  s.setTime('2026-09-03T00:00Z');
  await s.stats.block(1, 'example.com');
  assert.equal((await s.stats.read()).days['2026-09-03'].repeat, undefined);
});
test('untracked navigation does not create statistics or write a new state', async () => {
  const s = setup();
  await s.stats.leave(999);
  assert.equal(s.state.dailyStatistics, undefined);
});
