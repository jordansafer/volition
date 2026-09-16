const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(initial = {}, file = 'background.js') {
  const state = structuredClone(initial);
  const requests = [];
  const elements = {};
  const s = { state, requests, elements, response: { reply: { role: 'assistant', content: 'APPROVED for 5 minutes' } } };
  const context = vm.createContext({
    URL, console, Date, setTimeout() {}, setInterval() {},
    document: {
      addEventListener() {},
      getElementById(id) { return elements[id] ||= { value: '', style: {}, textContent: '', handlers: {}, appendChild() {}, addEventListener(event, fn) { this.handlers[event] = fn; } }; },
      createElement() { return { appendChild() {}, addEventListener() {} }; }
    },
    async fetch(url, options) {
      requests.push({ url, ...options });
      return { ok: !s.status, status: s.status || 200, async json() { return s.response; }, async text() { return 'error'; } };
    },
    chrome: {
      storage: { local: {
        async get() { return structuredClone(state); },
        async set(data) { Object.assign(state, structuredClone(data)); },
        async remove(keys) { for (const key of [].concat(keys)) delete state[key]; }
      } },
      runtime: { onInstalled: { addListener(fn) { s.install = fn; } }, onMessage: { addListener() {} } },
      tabs: { onUpdated: { addListener() {} } },
      action: { onClicked: { addListener() {} } }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  s.context = context;
  return s;
}
const messages = [
  { role: 'system', content: 'Existing prompt and proof history' },
  { role: 'user', content: [{ type: 'text', text: 'Image proof' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }] }
];
test('Free sends unchanged messages and image proof, never the saved key or BYO settings', async () => {
  const s = setup({ aiProvider: 'free', openaiApiKey: 'secret-test-key', customEndpoint: 'https://custom.example', openaiTextModel: 'custom-model' });
  const result = await s.context.chatWithGPT(messages);
  assert.equal(s.requests[0].url, 'https://volition-free-api-jordansafers-projects.vercel.app/api/negotiate');
  assert.deepEqual(JSON.parse(s.requests[0].body), { messages });
  assert.equal(s.requests[0].headers.Authorization, undefined);
  assert.ok(!JSON.stringify(s.requests).includes('secret-test-key'));
  assert.equal(result.reply.content, 'APPROVED for 5 minutes');
  assert.equal(s.state.openaiApiKey, 'secret-test-key');
  assert.equal(await s.context.classifyDomain('example.com'), false);
  assert.equal(s.requests.length, 1);
});
test('new and existing users default to persisted Free, regardless of a saved key', async () => {
  for (const initial of [{}, { openaiApiKey: 'retained-key' }]) {
    const s = setup(initial);
    await s.install();
    assert.equal(s.state.aiProvider, 'free');
    assert.equal(s.state.openaiApiKey, initial.openaiApiKey);
    await s.context.chatWithGPT(messages);
    assert.equal(s.requests[0].headers.Authorization, undefined);
  }
});
test('BYO preserves custom endpoint, text/vision models, token limits, and authorization', async () => {
  const s = setup({ aiProvider: 'openai', openaiApiKey: 'test-key', customEndpoint: 'https://custom.example/chat', openaiTextModel: 'my-text', openaiVisionModel: 'gpt-5', tokenLimit: '900' });
  s.response = { choices: [{ message: { role: 'assistant', content: 'Reply' } }] };
  await s.context.chatWithGPT([{ role: 'user', content: 'hello' }]);
  await s.context.chatWithGPT(messages);
  assert.equal(s.requests[0].url, 'https://custom.example/chat');
  assert.equal(s.requests[0].headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.parse(s.requests[0].body).model, 'my-text');
  assert.equal(JSON.parse(s.requests[0].body).max_tokens, 900);
  assert.equal(JSON.parse(s.requests[1].body).model, 'gpt-5');
  assert.equal(JSON.parse(s.requests[1].body).max_completion_tokens, 900);
  assert.deepEqual(JSON.parse(s.requests[1].body).messages, messages);
});
test('BYO without a key gives a settings error and sends no request', async () => {
  const s = setup({ aiProvider: 'openai' });
  await assert.rejects(s.context.chatWithGPT(messages), /no API key is saved.*Settings/);
  assert.equal(s.requests.length, 0);
  assert.equal(s.state.aiProvider, 'openai');
});
test('Free accepts compatible replies and reports HTTP, backend, and malformed reply errors', async () => {
  const s = setup({ aiProvider: 'free' });
  for (const reply of [{ reply: 'Hello' }, { choices: [{ message: { role: 'assistant', content: 'Hello' } }] }]) {
    s.response = reply;
    assert.equal((await s.context.chatWithGPT(messages)).reply.content, 'Hello');
  }
  s.status = 403;
  await assert.rejects(s.context.chatWithGPT(messages), /Volition Free.*HTTP 403/);
  s.status = 0;
  s.response = { error: { message: 'Rate limit' } };
  await assert.rejects(s.context.chatWithGPT(messages), /Rate limit/);
  s.response = {};
  await assert.rejects(s.context.chatWithGPT(messages), /no reply/);
});
test('settings switch freely while retaining key and show missing-key error only in BYO', async () => {
  const s = setup({ openaiApiKey: 'retained-key' }, 'options.js');
  await s.context.init();
  assert.equal(s.state.aiProvider, 'free');
  assert.equal(s.elements['test-key'].disabled, true);
  for (const mode of ['openai', 'free', 'openai']) {
    s.elements['ai-provider'].value = mode;
    await s.elements['ai-provider'].handlers.change();
    assert.equal(s.state.aiProvider, mode);
    assert.equal(s.state.openaiApiKey, 'retained-key');
  }
  delete s.state.openaiApiKey;
  await s.context.refreshProviderUI();
  assert.match(s.elements['provider-status'].textContent, /requires a saved API key/);
  s.state.aiProvider = 'free';
  await s.context.refreshProviderUI();
  assert.match(s.elements['provider-status'].textContent, /No API key required/);
  await s.context.testKey();
  assert.equal(s.requests.length, 0);
});
