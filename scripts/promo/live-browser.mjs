import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export class CDP {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map(); this.listeners = new Map(); this.errors = [];
    ws.addEventListener('message', event => {
      const m = JSON.parse(event.data);
      if (m.id) { this.pending.get(m.id)?.(m); this.pending.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') this.errors.push(m.params.exceptionDetails);
      for (const listener of this.listeners.get(m.method) || []) listener(m.params);
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    return new CDP(ws);
  }
  on(event, listener) {
    this.listeners.set(event, [...(this.listeners.get(event) || []), listener]);
  }
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, m => m.error ? reject(Error(JSON.stringify(m.error))) : resolve(m.result));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  async wait(expression, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (await this.evaluate(expression)) return; } catch (error) {
        if (!/context|frame|navigat/i.test(error.message)) throw error;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw Error('Timed out: ' + expression);
  }
  async navigate(url) { return this.call('Page.navigate', { url }); }
  async screenshot(file) {
    const { data } = await this.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(file, Buffer.from(data, 'base64'));
  }
  async click(selector) {
    const point = await this.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await this.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await this.call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await this.call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  }
  async type(text, delay = 35) {
    for (const char of text) { await this.call('Input.insertText', { text: char }); await new Promise(r => setTimeout(r, delay)); }
  }
  close() { this.ws.close(); }
}

export async function launch(root) {
  const chrome = process.argv.find(a => a.startsWith('--chrome='))?.slice(9);
  if (!chrome) throw Error('Pass --chrome=/absolute/path/to/chrome');
  const profile = process.argv.find(a => a.startsWith('--profile='))?.slice(10) || await fs.mkdtemp(path.join(os.tmpdir(), 'volition-live-'));
  const port = Number(process.env.PROMO_CDP_PORT || 19334);
  const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--enable-unsafe-extension-debugging', `--load-extension=${root}`, `--disable-extensions-except=${root}`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  const id = crypto.createHash('sha256').update(root).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, n => String.fromCharCode(97 + parseInt(n, 16)));
  let targets;
  for (let i = 0; i < 150; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.some(t => t.url.startsWith(`chrome-extension://${id}/`))) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  if (!targets?.some(t => t.url.startsWith(`chrome-extension://${id}/`))) { child.kill(); throw Error('Real extension failed to load'); }
  const page = await CDP.connect(targets.find(t => t.type === 'page' && t.url === 'about:blank').webSocketDebuggerUrl);
  await page.call('Page.enable'); await page.call('Runtime.enable');
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
  return { page, id, profile, close() { page.close(); child.kill(); } };
}
