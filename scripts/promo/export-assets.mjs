// Store-only brand artwork and real extension screenshots; never used as movie frames.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './live-browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/promo');
const png=(await fs.readFile(path.join(root,'icons/icon128.png'))).toString('base64');
const svg=(w,h,marquee)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#203967"/><stop offset="1" stop-color="#316ed5"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><circle cx="${w*.88}" cy="${h*.75}" r="${h*.63}" fill="none" stroke="#8dbafb" opacity=".2"/><circle cx="${w*.88}" cy="${h*.75}" r="${h*.43}" fill="none" stroke="#8dbafb" opacity=".2"/><image href="data:image/png;base64,${png}" x="${marquee?1040:28}" y="${marquee?160:29}" width="${marquee?230:64}" height="${marquee?230:64}"/><text x="${marquee?90:112}" y="${marquee?240:77}" fill="white" font-family="Arial,sans-serif" font-size="${marquee?108:42}" font-weight="700" letter-spacing="-2">Volition</text><text x="${marquee?96:32}" y="${marquee?320:159}" fill="#dbeaff" font-family="Arial,sans-serif" font-size="${marquee?38:29}" font-weight="500">AI Website Blocker</text><text x="${marquee?96:33}" y="${marquee?371:202}" fill="#b4d0f7" font-family="Arial,sans-serif" font-size="${marquee?29:23}">&amp; Focus Tool</text></svg>`;
for(const [file,w,h,large]of [['store-tile-440x280',440,280,false],['marquee-1400x560',1400,560,true]])await fs.writeFile(path.join(out,file+'.svg'),svg(w,h,large));
const browser=await launch(root),page=browser.page;
try{
 for(const [file,w,h]of [['store-tile-440x280',440,280],['marquee-1400x560',1400,560]]){
  await page.call('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
  await page.navigate(pathToFileURL(path.join(out,file+'.svg')).href);
  await page.wait('document.readyState==="complete" && document.documentElement.tagName==="svg"');
  await new Promise(r=>setTimeout(r,300));
  await page.screenshot(path.join(out,file+'.png'));
 }
 await page.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await page.navigate(`chrome-extension://${browser.id}/blocked.html?original=https%3A%2F%2Fnews.ycombinator.com%2F`);
 await page.wait('document.readyState==="complete" && document.querySelector("#send-btn")');
 await new Promise(r=>setTimeout(r,300));
 await page.click('#user-input');await page.type('I need 30 seconds on Hacker News to test Volition’s countdown for this product demo.',1);
 await page.screenshot(path.join(out,'02-request.png'));
 // Confirm real mobile layout keeps every original control without horizontal overflow.
 await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await new Promise(r=>setTimeout(r,300));
 if(await page.evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Mobile overflow');
 await page.screenshot(path.join(out,'blocked-mobile.png'));
 await page.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await page.navigate(`chrome-extension://${browser.id}/options.html`);
 await page.wait('document.readyState==="complete" && document.querySelector("#blocklist")');
 const top=await page.evaluate('document.querySelector("#blocklist").closest("section").getBoundingClientRect().top');
 await page.call('Input.dispatchMouseEvent',{type:'mouseWheel',x:1140,y:400,deltaX:0,deltaY:top-32});
 await new Promise(r=>setTimeout(r,500));
 await page.screenshot(path.join(out,'03-settings.png'));
 console.log('Store artwork and actual request/mobile screenshots exported. No movie frames rendered.');
}finally{browser.close()}
