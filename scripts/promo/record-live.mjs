// Records the real extension loaded in Chrome, with genuine network replies.
// No fixtures, interception, overlays, substituted responses, or slide rendering.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { launch } from './live-browser.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'docs/promo');
await fs.mkdir(output, { recursive: true });
const ffmpeg = process.argv.find(arg => arg.startsWith('--ffmpeg='))?.slice(9);
if (!ffmpeg) throw Error('Pass --ffmpeg=/absolute/path/to/ffmpeg');
const browser = await launch(root), page = browser.page;
const audit = { kind: 'Continuous recording of actual extension usage', extensionId: browser.id, start: new Date().toISOString(), events: [] };
const event = (action, detail = {}) => {
  const entry = { seconds: started ? Number(((Date.now() - started) / 1000).toFixed(2)) : 0, action, ...detail };
  audit.events.push(entry); console.log(JSON.stringify(entry));
};
const pause = ms => new Promise(r => setTimeout(r, ms));
let started, frame, tick, recording, encoder, encoderDone, encoderError, pending = Promise.resolve();
async function begin() {
  encoder = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', '24', '-i', 'pipe:0', '-an', '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'volition-live-demo.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  encoder.on('error', error => { encoderError = error; });
  encoderDone = once(encoder, 'exit');
  page.on('Page.screencastFrame', ({ data, sessionId }) => {
    frame = Buffer.from(data, 'base64');
    page.call('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await page.call('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  for (let i = 0; i < 100 && !frame; i++) await pause(50);
  if (!frame) throw Error('Chrome supplied no screencast frames');
  started = Date.now(); recording = true;
  tick = setInterval(() => {
    if (!recording || !frame || encoderError) return;
    const current = frame;
    pending = pending.then(async () => { if (!encoder.stdin.write(current)) await once(encoder.stdin, 'drain'); });
  }, 1000 / 24);
}
async function stop() {
  recording = false; clearInterval(tick);
  if (!encoder) return;
  await page.call('Page.stopScreencast').catch(() => {});
  await pending; encoder.stdin.end();
  const [code] = await encoderDone;
  if (encoderError || code !== 0) throw encoderError || Error(`FFmpeg exited ${code}`);
}
async function scrollTo(selector) {
  // Standard wheel input; no DOM or UI content is altered.
  for (let i = 0; i < 20; i++) {
    const rect = await page.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {top:r.top,bottom:r.bottom}})()`);
    if (rect.top >= 100 && rect.bottom <= 650) return;
    const delta = rect.top < 100 ? rect.top - 130 : Math.min(400, rect.bottom - 620);
    await page.call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 1140, y: 500, deltaY: delta, deltaX: 0 });
    await pause(350);
  }
}
try {
  await page.navigate(`chrome-extension://${browser.id}/options.html`);
  await page.wait('document.readyState === "complete" && document.querySelector("#blocklist li")');
  const manifest = await page.evaluate('chrome.runtime.getManifest()');
  if (!manifest.name.startsWith('Volition')) throw Error('Wrong extension loaded');
  event('Verified real loaded extension', { name: manifest.name, version: manifest.version });
  await begin();
  await pause(2000);
  await scrollTo('#new-block-domain');
  event('Add website using actual blocklist controls');
  await page.click('#new-block-domain'); await page.type('news.ycombinator.com', 65);
  await page.click('#add-block'); await pause(900);
  await scrollTo('#blocklist-search');
  event('Search actual blocklist');
  await page.click('#blocklist-search'); await page.type('ycombinator', 100); await pause(1800);
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace' });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace' });
  await pause(700);
  event('Navigate to real blocked website');
  await page.navigate('https://news.ycombinator.com/');
  await page.wait('location.protocol === "chrome-extension:" && location.pathname === "/blocked.html"', 60000);
  event('Actual blocker redirected the visit');
  await pause(1800);
  await page.screenshot(path.join(output, 'blocked-live-1920x1080.png'));
  await page.click('#user-input');
  await page.type('I am recording Volition’s product demo for its Chrome Web Store listing. I need Hacker News access for 30 seconds to verify the temporary-access countdown and automatic reblocking. This is a work-related software test.', 24);
  await pause(1000);
  await page.screenshot(path.join(output, 'request-live-1920x1080.png'));
  await page.click('#send-btn');
  event('Sent genuine request through Volition hosted service');
  await page.wait('location.protocol !== "chrome-extension:" || (!document.getElementById("send-btn")?.disabled && document.querySelector(".assistant-msg"))', 90000);
  let result = await page.evaluate('({url:location.href,reply:document.querySelector(".assistant-msg")?.textContent})');
  // The real page renders a reply before its async grant completes and navigation starts.
  if (result.url.startsWith('chrome-extension://') && result.reply?.toLowerCase().includes('approved')) {
    await page.wait('location.protocol !== "chrome-extension:"', 15000);
    result = await page.evaluate('({url:location.href})');
  }
  if (result.url.startsWith('chrome-extension://')) {
    audit.actualReply = result.reply;
    throw Error('Live model did not grant access; no approval will be fabricated. Reply: ' + result.reply);
  }
  event('Real AI grant opened requested website', { hostname: new URL(result.url).hostname });
  await page.wait('Boolean(document.getElementById("focus-timer-overlay"))', 60000);
  event('Actual injected countdown visible', { text: await page.evaluate('document.getElementById("focus-timer-overlay").textContent') });
  await pause(4000);
  await page.screenshot(path.join(output, 'timed-access-live-1920x1080.png'));
  // Keep recording the real countdown and expiry; no instant fake success scene.
  await page.wait('location.protocol === "chrome-extension:" && location.pathname === "/blocked.html"', 65000);
  event('Temporary access expired and website was blocked again');
  await pause(2400);
  await page.navigate(`chrome-extension://${browser.id}/stats.html`);
  await page.wait('Boolean(document.querySelector("#daily-chart svg"))');
  await pause(2000);
  const stats = await page.evaluate('chrome.storage.local.get(["proofHistory","apiUsageHistory","dailyStatistics"]).then(d=>({approvals:d.proofHistory?.length,calls:d.apiUsageHistory?.length,dailyBuckets:Object.keys(d.dailyStatistics?.days||{}).length,remainingAccess:undefined}))');
  event('Actual usage statistics', stats);
  audit.complete = true;
  await stop();
  // Capture store screenshots from the same genuine extension session, outside the movie.
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await page.navigate(`chrome-extension://${browser.id}/options.html`);
  await page.wait('document.readyState==="complete" && document.querySelector("#ai-provider")');
  await scrollTo('#blocklist-search');
  await pause(500); await page.screenshot(path.join(output, '03-settings.png'));
  await page.navigate(`chrome-extension://${browser.id}/stats.html`);
  await page.wait('Boolean(document.querySelector("#daily-chart svg"))');
  await pause(500); await page.screenshot(path.join(output, '04-statistics.png'));
  await page.navigate(`chrome-extension://${browser.id}/blocked.html?original=https%3A%2F%2Fnews.ycombinator.com%2F`);
  await page.wait('document.readyState==="complete" && document.getElementById("send-btn")');
  await pause(500); await page.screenshot(path.join(output, '01-blocked.png'));
  await page.click('#user-input');
  await page.type('I need 30 seconds on Hacker News to test Volition’s countdown for this product demo.', 1);
  await page.screenshot(path.join(output, '02-request.png'));
  event('Store screenshots captured from actual extension session');
} catch (error) {
  audit.complete = false; audit.error = error.message;
  await stop().catch(stopError => { audit.encoderError = stopError.message; });
  console.error(error); process.exitCode = 1;
} finally {
  audit.end = new Date().toISOString();
  await fs.writeFile(path.join(output, 'recording-log.json'), JSON.stringify(audit, null, 2) + '\n');
  browser.close();
}
