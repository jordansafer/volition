const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(initial = {}, file = 'background.js') {
  const state = structuredClone(initial);
  const requests = [];
  const elements = {};
  function element() {
    return {
      value: '', style: {}, textContent: '', handlers: {}, children: [], attributes: {},
      set innerHTML(value) { this.children = []; this.html = value; },
      get innerHTML() { return this.html || ''; },
      appendChild(child) { this.children.push(child); },
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() {},
      addEventListener(event, fn) { this.handlers[event] = fn; }
    };
  }
  const s = { state, requests, elements, response: { reply: { role: 'assistant', content: 'APPROVED for 5 minutes' } } };
  const context = vm.createContext({
    URL, console, Date, setTimeout() {}, setInterval() {},
    document: {
      addEventListener() {},
      getElementById(id) { return elements[id] ||= element(); },
      createElement: element
    },
    async fetch(url, options) {
      requests.push({ url, ...options });
      return { ok: !s.status, status: s.status || 200, async json() { return s.response; }, async text() { return 'error'; } };
    },
    importScripts(file) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    },
    chrome: {
      storage: { local: {
        async get() { return structuredClone(state); },
        async set(data) { Object.assign(state, structuredClone(data)); },
        async remove(keys) { for (const key of [].concat(keys)) delete state[key]; }
      } },
      runtime: { onInstalled: { addListener(fn) { s.install = fn; } }, onMessage: { addListener(fn) { s.message = fn; } }, getURL: value => value },
      tabs: { onUpdated: { addListener(fn) { s.tabUpdated = fn; } }, onRemoved: { addListener(fn) { s.tabRemoved = fn; } }, update() {} },
      action: { onClicked: { addListener() {} } }
    }
  });
  if (file === 'options.js') {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'model-config.js'), 'utf8'), context);
  }
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
  assert.equal(s.requests.length, 1);
});
test('new users default to Free; legacy key users retain BYO; explicit modes persist', async () => {
  for (const initial of [{}, { openaiApiKey: 'retained-key' }]) {
    const s = setup(initial);
    await s.install();
    assert.equal(s.state.aiProvider, initial.openaiApiKey ? 'openai' : 'free');
    assert.equal(s.state.openaiApiKey, initial.openaiApiKey);
  }
  const explicit = setup({ aiProvider: 'free', openaiApiKey: 'retained-key' });
  await explicit.install();
  assert.equal(explicit.state.aiProvider, 'free');
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
  await assert.rejects(s.context.chatWithGPT(messages), /Volition.*HTTP 403/);
  s.status = 0;
  s.response = { error: { message: 'Rate limit' } };
  await assert.rejects(s.context.chatWithGPT(messages), /Rate limit/);
  s.response = {};
  await assert.rejects(s.context.chatWithGPT(messages), /no reply/);
});
test('settings switch freely while retaining key and show missing-key error only in BYO', async () => {
  const s = setup({ openaiApiKey: 'retained-key' }, 'options.js');
  await s.context.init();
  assert.equal(s.state.aiProvider, 'openai');
  assert.equal(s.elements['test-key'].disabled, false);
  for (const mode of ['openai', 'free', 'openai']) {
    s.elements['ai-provider'].value = mode;
    await s.elements['ai-provider'].handlers.change();
    assert.equal(s.state.aiProvider, mode);
    assert.equal(s.state.openaiApiKey, 'retained-key');
  }
  delete s.state.openaiApiKey;
  await s.context.refreshProviderUI();
  assert.match(s.elements['provider-status'].textContent, /Save your API key.*browsing/);
  s.state.aiProvider = 'free';
  await s.context.refreshProviderUI();
  assert.match(s.elements['provider-status'].textContent, /Using Volition's model/);
  s.elements['ai-provider'].value = 'free';
  await s.context.testKey();
  assert.equal(s.requests.length, 0);
});

test('new installations use Luna medium for text and images without changing provider routing', async () => {
  const s = setup();
  await s.install({ reason: 'install' });
  assert.equal(s.state.aiProvider, 'free');
  assert.equal(s.state.openaiTextModel, 'gpt-6-luna');
  assert.equal(s.state.openaiVisionModel, 'gpt-6-luna');
  s.state.aiProvider = 'openai';
  s.state.openaiApiKey = 'test-key';
  s.response = { choices: [{ message: { role: 'assistant', content: 'OK' } }] };
  await s.context.chatWithGPT([{ role: 'user', content: 'hello' }]);
  await s.context.chatWithGPT(messages);
  for (const request of s.requests) {
    const body = JSON.parse(request.body);
    assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(body.model, 'gpt-6-luna');
    assert.equal(body.reasoning_effort, 'medium');
    assert.equal(body.max_completion_tokens, 4096);
    assert.equal(body.max_tokens, undefined);
  }
  assert.deepEqual(JSON.parse(s.requests[1].body).messages, messages);
});

test('upgrades preserve explicit and implicit models, custom IDs, and saved settings', async () => {
  for (const initial of [
    {},
    { openaiApiKey: 'key' },
    { openaiTextModel: 'gpt-4o', openaiVisionModel: 'gpt-o3' },
    { openaiModel: 'legacy-custom' },
    { openaiTextModel: 'custom-text', openaiVisionModel: 'custom-image', customEndpoint: 'https://example.com/api', tokenLimit: '750', negotiationPrompt: 'keep me' }
  ]) {
    const s = setup(initial);
    await s.install({ reason: 'update' });
    for (const [key, value] of Object.entries(initial)) assert.deepEqual(s.state[key], value);
    const text = initial.openaiTextModel || initial.openaiModel || 'gpt-3.5-turbo';
    const image = initial.openaiVisionModel || (text.startsWith('gpt-3.5') ? 'gpt-4o-mini' : text);
    assert.equal(s.state.openaiTextModel, text);
    assert.equal(s.state.openaiVisionModel, image);
    const before = structuredClone(s.state);
    await s.install({ reason: 'update' });
    assert.deepEqual(s.state, before, 'migration must be idempotent');
  }
});

test('settings retain legacy selections and unknown custom IDs while offering new models', async () => {
  for (const model of ['gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o', 'gpt-o3', 'my-provider/model-v2']) {
    const s = setup({ aiProvider: 'openai', openaiTextModel: model, openaiVisionModel: 'custom-image' }, 'options.js');
    await s.context.init();
    assert.equal(s.state.openaiTextModel, model);
    assert.equal(s.context.selectedTextModel(), model);
    assert.equal(s.elements['custom-vision-model'].value, 'custom-image');
    const textOptions = s.elements['text-model-select'].children;
    const imageOptions = s.elements['vision-model-select'].children;
    assert.ok(textOptions.some(option => option.value === 'gpt-6-luna'));
    assert.ok(imageOptions.some(option => option.value === 'gpt-6-luna'));
    assert.ok(textOptions.find(option => option.value === 'gpt-o3').textContent.endsWith('(legacy)'));
  }
});

test('connection test sends current form values only to the configured endpoint without saving the key', async () => {
  const s = setup({ aiProvider: 'openai', openaiApiKey: 'saved-key', openaiTextModel: 'gpt-4o' }, 'options.js');
  await s.context.init();
  s.elements['api-key'].value = 'unsaved-test-key';
  s.elements['custom-endpoint'].value = ' https://custom.example/chat/completions ';
  s.elements['text-model-select'].value = 'other';
  s.elements['custom-text-model'].value = 'custom-chat';
  s.elements['token-limit'].value = '1200';
  s.response = { choices: [{ message: { content: 'OK' } }] };
  await s.context.testKey();
  assert.equal(s.requests.length, 1);
  assert.equal(s.requests[0].url, 'https://custom.example/chat/completions');
  assert.equal(s.requests[0].headers.Authorization, 'Bearer unsaved-test-key');
  const body = JSON.parse(s.requests[0].body);
  assert.equal(body.model, 'custom-chat');
  assert.equal(body.max_tokens, 1200);
  assert.equal(s.state.openaiApiKey, 'saved-key');
  assert.match(s.elements['key-status'].textContent, /Connection works/);
});

test('connection test uses the Luna request schema and never falls back after a custom endpoint error', async () => {
  const s = setup({}, 'options.js');
  await s.context.init();
  s.elements['ai-provider'].value = 'openai';
  await s.elements['ai-provider'].handlers.change();
  s.elements['api-key'].value = 'test-key';
  s.elements['custom-endpoint'].value = 'https://custom.example/chat';
  s.status = 401;
  s.response = { error: { message: 'Invalid API key' } };
  await s.context.testKey();
  assert.equal(s.requests.length, 1);
  assert.equal(s.requests[0].url, 'https://custom.example/chat');
  const body = JSON.parse(s.requests[0].body);
  assert.equal(body.model, 'gpt-6-luna');
  assert.equal(body.reasoning_effort, 'medium');
  assert.equal(body.max_completion_tokens, 4096);
  assert.match(s.elements['key-status'].textContent, /Invalid API key/);
  assert.equal(s.elements['test-key'].disabled, false);
  s.status = 0;
  s.response = { choices: [{ message: { content: '' }, finish_reason: 'length' }] };
  await s.context.testKey();
  assert.match(s.elements['key-status'].textContent, /returned no text/);
  assert.equal(s.requests.length, 2);
});

test('connection test with a blank endpoint uses the default URL and rejects missing custom models', async () => {
  const s = setup({}, 'options.js');
  await s.context.init();
  s.elements['ai-provider'].value = 'openai';
  await s.elements['ai-provider'].handlers.change();
  s.elements['api-key'].value = 'test-key';
  s.elements['custom-endpoint'].value = '   ';
  s.response = { choices: [{ message: { content: 'OK' } }] };
  await s.context.testKey();
  assert.equal(s.requests[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(JSON.parse(s.requests[0].body).model, 'gpt-6-luna');
  s.elements['text-model-select'].value = 'other';
  s.elements['custom-text-model'].value = '';
  await s.context.testKey();
  assert.equal(s.requests.length, 1);
  assert.match(s.elements['key-status'].textContent, /enter a model/);
});

test('known reasoning IDs remain compatible when a provider prefixes a saved custom model', async () => {
  const s = setup({ aiProvider: 'openai', openaiApiKey: 'key', customEndpoint: 'https://provider.example/chat', openaiTextModel: 'provider/gpt-5-mini', tokenLimit: '900' });
  s.response = { choices: [{ message: { content: 'OK' } }] };
  await s.context.chatWithGPT([{ role: 'user', content: 'hello' }]);
  const body = JSON.parse(s.requests[0].body);
  assert.equal(body.model, 'provider/gpt-5-mini');
  assert.equal(body.max_completion_tokens, 900);
  assert.equal(body.max_tokens, undefined);
});

test('Luna classification has reasoning headroom and failure cannot create a permanent allow', async () => {
  const s = setup({ aiProvider: 'openai', openaiApiKey: 'key', openaiTextModel: 'gpt-6-luna', advancedMode: true });
  s.response = { choices: [{ message: { content: 'BLOCK' } }] };
  await s.context.handleUrl(1, 'https://blocked.example');
  assert.deepEqual(s.state.blocklist, ['blocked.example']);
  const request = JSON.parse(s.requests[0].body);
  assert.equal(request.reasoning_effort, 'medium');
  assert.equal(request.max_completion_tokens, 4096);
  for (const [status, response] of [
    [401, { error: { message: 'Bad key' } }],
    [200, { choices: [{ message: { content: '' } }] }],
    [200, { choices: [{ message: { content: 'Unexpected answer' } }] }]
  ]) {
    s.status = status === 200 ? 0 : status;
    s.response = response;
    await s.context.handleUrl(1, 'https://unknown.example');
    assert.equal(s.state.allowlist, undefined);
  }
  s.state.openaiApiKey = '';
  const requestCount = s.requests.length;
  await s.context.handleUrl(1, 'https://another.example');
  assert.equal(s.requests.length, requestCount);
  assert.equal(s.state.allowlist, undefined);
});

test('site searches filter case-insensitively, preserve expiry records, and remove only the chosen domain', async () => {
  const expiresAt = Date.now() + 600000;
  const initial = { blocklist: ['YouTube.com', 'reddit.com'], allowlist: [{ domain: 'work.example', expiresAt }, 'docs.example'], reallyBadSites: ['facebook.com'] };
  const s = setup(initial, 'options.js');
  await s.context.init();
  const visible = id => s.elements[id].children.map(li => li.children[0]?.textContent || li.textContent);
  s.elements['blocklist-search'].value = ' YOUTUBE ';
  s.elements['blocklist-search'].handlers.input();
  assert.deepEqual(visible('blocklist'), ['YouTube.com']);
  assert.deepEqual(s.state.blocklist, initial.blocklist);
  s.elements['allowlist-search'].value = 'work';
  s.elements['allowlist-search'].handlers.input();
  assert.equal(visible('allowlist').length, 1);
  assert.match(visible('allowlist')[0], /^work\.example \(expires /);
  assert.deepEqual(s.state.allowlist, initial.allowlist);
  await s.context.removeDomain('allow', 'work.example');
  assert.deepEqual(s.state.allowlist, ['docs.example']);
  assert.deepEqual(visible('allowlist'), ['No matching domains']);
  s.elements['allowlist-search'].value = '';
  s.elements['allowlist-search'].handlers.input();
  assert.deepEqual(visible('allowlist'), ['docs.example']);
  s.elements['reallyBadSites-search'].value = 'no-match';
  s.elements['reallyBadSites-search'].handlers.input();
  assert.deepEqual(visible('reallyBadSites'), ['No matching domains']);
  assert.deepEqual(s.state.reallyBadSites, initial.reallyBadSites);
});

test('Free classifies unknown sites, respects custom prompts, and never transmits a stored key', async () => {
  for (const decision of ['BLOCK', 'ALLOW']) {
    const s = setup({ aiProvider: 'free', openaiApiKey: 'secret-test-key', advancedMode: true, classificationPrompt: 'Custom classification directive' });
    s.response = { reply: { role: 'assistant', content: decision } };
    await s.context.handleUrl(1, 'https://example.com');
    assert.equal(s.requests.length, 1);
    assert.ok(!JSON.stringify(s.requests).includes('secret-test-key'));
    assert.match(JSON.parse(s.requests[0].body).messages[0].content, /Custom classification directive/);
    if (decision === 'BLOCK') assert.deepEqual(s.state.blocklist, ['example.com']);
    else assert.equal(s.state.allowlist[0].domain, 'example.com');
    assert.equal(s.state.apiUsageStats['Volition Free'].classificationCalls, 1);
  }
});

test('failed Free classification does not permanently allow an unknown site', async () => {
  for (const status of [0, 503]) {
    const s = setup({ aiProvider: 'free', advancedMode: true });
    s.status = status;
    s.response = { reply: 'Unexpected prose' };
    await s.context.handleUrl(1, 'https://example.com');
    assert.equal(s.state.allowlist, undefined);
    assert.equal(s.state.blocklist, undefined);
  }
});

test('background events collect blocking, negotiated grants, unfinished sessions and reset without changing access', async () => {
  const s = setup({ aiProvider: 'free' });
  const send = message => new Promise(resolve => s.message(message, { tab: { id: 8 } }, resolve));
  await s.context.blockTab(8, 'https://example.com/private-path');
  await send({ type: 'chatgpt', messages, statsSession: 'a' });
  const expiry = Date.now() + 300000;
  const result = await send({ type: 'allow_domain', domain: 'example.com', expiresAt: expiry });
  assert.equal(result.status, 'ok');
  assert.equal(s.state.allowlist[0].expiresAt, expiry);
  s.tabUpdated(8, { url: 'https://example.com' }, {});
  await send({ type: 'stats_read' });
  let row = Object.values(s.state.dailyStatistics.days)[0];
  assert.equal(row.blocked, 1);
  assert.equal(row.approvals, 1);
  assert.equal(row.calls, 1);
  assert.equal(row.unfinished, undefined);
  await send({ type: 'chatgpt', messages, statsSession: 'b' });
  s.tabRemoved(8);
  await send({ type: 'stats_read' });
  row = Object.values(s.state.dailyStatistics.days)[0];
  assert.equal(row.unfinished, 1);
  assert.ok(!JSON.stringify(s.state.dailyStatistics).includes('private-path'));
  await send({ type: 'stats_reset' });
  assert.deepEqual(s.state.dailyStatistics.days, {});
  assert.deepEqual(s.state.apiUsageStats, {});
  assert.equal(s.state.allowlist[0].expiresAt, expiry);
});

test('pause messages update the original settings and surface persistence failures in settings', async () => {
  const s = setup();
  const send = message => new Promise(resolve => s.message(message, {}, resolve));
  const until = Date.now() + 60000;
  await send({ type: 'stats_pause', values: { pauseUntil: until, pauseMode: 'partial', pauseHours: 1 } });
  assert.equal(s.state.pauseUntil, until);
  assert.equal(s.state.pauseMode, 'partial');
  await send({ type: 'stats_pause', values: null });
  assert.equal(s.state.pauseUntil, undefined);
  const settings = setup({}, 'options.js');
  settings.context.chrome.runtime.sendMessage = async () => ({ error: 'Storage unavailable' });
  await settings.context.changePause(null);
  assert.match(settings.elements['pause-status'].textContent, /Could not change/);
});
