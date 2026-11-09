const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(initial = {}) {
  const state = structuredClone(initial);
  const elements = {};
  const requests = [];
  const approvals = [];
  function element() {
    return {
      value: '', files: [], children: [], style: {}, handlers: {},
      classList: { add() {}, remove() {} },
      addEventListener(event, fn) { this.handlers[event] = fn; },
      appendChild(child) { this.children.push(child); child.remove = () => this.children.splice(this.children.indexOf(child), 1); }
    };
  }
  const s = { state, elements, requests, approvals, reply: 'DENIED. Please provide new proof.' };
  const context = vm.createContext({
    URL, URLSearchParams, Date, crypto: { randomUUID: () => 'session' }, console: { log() {}, warn() {}, error() {} },
    window: { location: { search: '?original=https%3A%2F%2Fwww.facebook.com%2F' } },
    document: { getElementById(id) { return elements[id] ||= element(); }, createElement: element },
    chrome: {
      storage: {
        local: { async get(keys, callback) { const data = structuredClone(state); callback?.(data); return data; } },
        onChanged: { addListener() {} }
      },
      runtime: { async sendMessage(message) {
        if (message.type === 'chatgpt') {
          requests.push(structuredClone(message));
          return { reply: { role: 'assistant', content: s.reply }, model: 'Volition Free' };
        }
        approvals.push(structuredClone(message));
        if (s.approvalRejection) throw Error(s.approvalRejection);
        return s.approvalError ? { error: s.approvalError } : { status: 'ok' };
      } }
    }
  });
  for (const file of ['vendor/tldts-7.4.19.min.js', 'site-context.js', 'blocked.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  s.context = context;
  s.send = async text => { elements['user-input'].value = text; await elements['send-btn'].handlers.click(); };
  return s;
}

function historyFrom(s, index = 0) {
  const prompt = s.requests[index].messages[0].content;
  return prompt.split('\n').filter(line => /^\d+\. \{/.test(line))
    .map(line => JSON.parse(line.replace(/^\d+\. /, '').replace(/ \(timestamp [^)]*\)$/, '')));
}

test('every negotiation send refreshes the newest 20 approvals with sites, durations, expiry and proof', async () => {
  const now = Date.now();
  const history = Array.from({ length: 22 }, (_, i) => ({
    domain: 'facebook.com', url: 'https://facebook.com/',
    desc: `Completed step ${i}`, timestamp: new Date(now - (22 - i) * 600000).toISOString(),
    approvedMs: 300000, approvedUntil: now - (22 - i) * 600000 + 300000
  }));
  const s = setup({ proofHistory: history, negotiationPrompt: 'Custom negotiation', classificationPrompt: 'Custom classification' });
  await s.send('Facebook again, please');
  const entries = historyFrom(s);
  assert.equal(entries.length, 20);
  assert.equal(entries[0].desc, 'Completed step 21');
  assert.equal(entries[19].desc, 'Completed step 2');
  assert.equal(entries[0].domain, 'facebook.com');
  assert.equal(entries[0].site, 'facebook.com');
  assert.equal(entries[0].sameSiteAsRequest, true);
  assert.equal(entries[0].approvedMs, 300000);
  assert.equal(entries[0].approvedUntil, history[21].approvedUntil);
  assert.equal(entries[0].timestamp, history[21].timestamp);
  assert.equal(entries[0].active, false);
  assert.equal(entries[0].remainingMs, 0);
  const fresh = { domain: 'open.spotify.com', desc: 'Work music', timestamp: new Date(now).toISOString(), approvedMs: 1800000, approvedUntil: now + 1800000 };
  s.state.proofHistory.push(fresh);
  await s.send('Another message');
  const updated = historyFrom(s, 1);
  assert.equal(updated[0].domain, 'open.spotify.com');
  assert.equal(updated[0].site, 'spotify.com');
  assert.equal(updated[0].sameSiteAsRequest, false);
  assert.equal(updated[0].active, true);
  assert.ok(updated[0].remainingMs > 1700000 && updated[0].remainingMs <= 1800000);
  const prompt = s.requests[1].messages[0].content;
  assert.equal(prompt.match(/Previous proof history/g).length, 1);
  assert.ok(prompt.includes('Custom negotiation') && prompt.includes('Custom classification'));
  assert.equal(s.requests[0].messages.at(-1).content, 'Facebook again, please');
  assert.equal(s.requests[1].messages.at(-2).content, s.reply);
  assert.equal(s.approvals.length, 0);
});

test('old proof-only records remain context without inventing unlimited access', async () => {
  const s = setup({ proofHistory: [
    { desc: 'Old proof', timestamp: '2026-01-01T00:00:00Z' },
    { url: 'https://accounts.spotify.com/login', desc: 'Work', approvedMs: null, approvedUntil: null }
  ] });
  await s.send('Please');
  const entries = historyFrom(s);
  assert.equal(entries[0].site, 'spotify.com');
  assert.equal(entries[0].unlimited, true);
  assert.equal(entries[0].active, true);
  assert.equal(entries[1].desc, 'Old proof');
  assert.equal(entries[1].unlimited, false);
  assert.equal(entries[1].active, false);
});

test('references to a past approval do not accidentally grant a repeat request', async () => {
  for (const reply of [
    'I approved Facebook for 5 minutes earlier. DENIED until you provide new proof.',
    'Previously APPROVED for 5 minutes. Please complete a new step.',
    'Not approved. DENIED.',
    'You asked for 30 minutes, but I cannot approve that.',
    'APPROVED for 0 minutes'
  ]) {
    const s = setup();
    s.reply = reply;
    await s.send('Again');
    assert.equal(s.approvals.length, 0, reply);
    assert.equal(s.context.window.location.href, undefined);
  }
});

test('an actual decision saves its duration and proof reason before opening the site', async () => {
  const s = setup();
  s.reply = 'You completed the next step after your earlier 5 minute break.\nAPPROVED for 30 minutes';
  const before = Date.now();
  await s.send('Proof of my next step');
  const grant = s.approvals[0];
  assert.equal(grant.domain, 'www.facebook.com');
  assert.equal(grant.approval.approvedMs, 1800000);
  assert.equal(grant.approval.desc, s.reply.split('\n')[0]);
  assert.ok(grant.expiresAt >= before + 1800000 && grant.expiresAt <= Date.now() + 1800000);
  assert.equal(s.context.window.location.href, 'https://www.facebook.com/');
});

test('failed approval persistence keeps the blocked page and shows the existing error text', async () => {
  const s = setup();
  s.reply = 'APPROVED unlimited';
  s.approvalError = 'Disk full';
  await s.send('Work');
  assert.equal(s.approvals[0].expiresAt, null);
  assert.equal(s.context.window.location.href, undefined);
  assert.equal(s.elements['chat-window'].children.at(-1).textContent, 'Error: Disk full');
});

test('history storage failures send no incomplete context and leave Send available', async () => {
  const s = setup();
  s.context.chrome.storage.local.get = async () => { throw Error('Storage unavailable'); };
  await s.send('Work');
  assert.equal(s.requests.length, 0);
  assert.equal(s.elements['send-btn'].disabled, false);
  assert.equal(s.elements['chat-window'].children.at(-1).textContent, 'Error: Storage unavailable');
});

test('approval messaging failures keep the blocked page and show the existing error text', async () => {
  const s = setup();
  s.reply = 'APPROVED for 5 minutes';
  s.approvalRejection = 'Service worker unavailable';
  await s.send('Work');
  assert.equal(s.context.window.location.href, undefined);
  assert.equal(s.elements['chat-window'].children.at(-1).textContent, 'Error: Service worker unavailable');
});
