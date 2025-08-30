# Volition

A Chrome extension that blocks distracting websites and forces you to **negotiate with ChatGPT** before providing timed access.

Install the [Chrome Extension](https://chromewebstore.google.com/detail/volition/iempmfmcjgjdpmobhlaookjjjmbfiaeh)

![Screenshot of blocked page](./docs/screenshot-blocked.png)


https://github.com/user-attachments/assets/055eda97-531b-4805-ae42-cb8f8837ab73


---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| Default block-list | Ships with major social, news, and video sites pre-blocked. |
| ChatGPT negotiation | When you attempt to visit a blocked site, you must convince ChatGPT (via your own API key) to grant access. |
| Timed overrides | ChatGPT can grant 10 s, 5 min, 2 h, or unlimited access. A badge shows time remaining; the page re-blocks automatically. |
| Advanced auto-review | Unknown domains are sent to ChatGPT for quick **BLOCK / ALLOW** classification. |
| Proof with images | Upload a (down-sampled) screenshot/photo to prove you completed a task; ChatGPT reviews it (vision model required). |
| Model selector | gpt-3.5-turbo, gpt-4o-mini, gpt-4o, or gpt-o3. |
| Fully local data | API key and settings stay in `chrome.storage.local`; no trackers, no analytics. |

---

## 🚀 Quick Start (Unpacked)

1. Clone the repo and install dependencies (only for build tools):
   ```bash
   git clone https://github.com/jordansafer/volition.git
   cd volition
   ```
2. Load in Chrome:
   1. Visit `chrome://extensions`.
   2. Enable **Developer mode**.
   3. Click **Load unpacked** → select the project folder.
3. Click the toolbar icon → **Options**.
4. Paste your OpenAI API key and (optionally) test it.
5. Start browsing—blocked sites will redirect to the negotiation screen.

---

## 📦 Build for the Chrome Web Store

```
npm run build   # or just:  bash dist.sh
```
This script creates a **dist/** directory without the Git repo and makes `volition-dist.zip`, ready for upload.

---

## 🛠️ Development Notes

* Background logic is in `background.js` (service-worker).  
* UI pages: `options.html` / `blocked.html`.
* Icons: `icons/volition_logo.png` (source) → PNGs (16/32/48/128).
* Privacy policy is in [PRIVACY.md](./PRIVACY.md).

### NPM scripts (optional)
| Script | Purpose |
|--------|---------|
| `npm run lint` | Run ESLint on JS files. |
| `npm run build` | Generates `dist/` & zip. |

---

## 🔒 Privacy & Data

See [PRIVACY.md](./PRIVACY.md).  In short: all data remains local; the extension only talks to `api.openai.com` with your key.

---

## ❓ FAQ

### If other focus extensions have not worked for you, because you always end up disabling them or switching to another device where the extension is not setup.
How Volition approaches this: Similar to delayed gratification, you can always get through, so there is never a reason to disable/switch. Unlike delayed gratification, you can work with an LLM, adjust the prompt, etc, to get granular time limited to approval to sites you need, when you need them.

### If you have trouble breaking tasks into steps, or getting started on things.
How Volition approaches this: LLM forces you to spend a couple minutes on a task, with a concrete deliverable, before accessing your distracting site. You get your inertia, you get access to the site you wanted, and the LLM gives time limited access to disrupt any scroll cycle. It's a win-win-win.

### If you find new distracting sites that aren't in your site blocker.
How Volition approaches this: The LLM reviews every new URL you visit, and determines whether the site is distracting. You can customize the prompt to help the LLM make more granular determinations that work best for you.

### If you are concerned about privacy.
The LLM endpoint is customizable, so you can provide your own LLM, this is recommended as the most private option. If you are using the default endpoint (OpenAI), Volition only ever sends: (1) the URL you visit and (2) your chat with the LLM to the endpoint. The code is fully opensource, so you can review the exact behavior and contents that are transmitted, the content of the pages you visit will never be accessed.

### If you are concerned about cost.
LLMs across company and tiers are at a variety of price points, so you can adjust the model to your pricepoint. Some LLM offerings, like Gemini flash models, are offered for free. Please be aware that these free offerings may train on your data (data privacy concern tradeoff), as your data can become the product for the company. If you prefer a cheap but data private model, consider a paid, cheap model.

Also, if you haven't tried other focus blockers, here are some great ones! Personally, I find delayed gratification blockers to be a step above traditional time blockers in terms of effectiveness. Although also personally, I made Volition for myself to address some limitations of delayed gratification, so this is what I currently use.

| Name | Type |
|------|------|
| [One Sec](https://oneseclabs.com/) | Delayed Gratification |
| Dopanope | Delayed Gratification |
| [RescueTime](https://www.rescuetime.com/) | Traditional Time/Productivity Tracker |
| [LeechBlock](https://www.proginosko.com/leechblock/) | Traditional Site Blocker |
| StayFocusd | Traditional Site Blocker |
| [ScreenZen](https://screenzen.co/) | Mobile (iOS/Android) |
| [Apple Parental Controls](https://support.apple.com/HT201304) | Mobile (iOS) |

---

## 📄 License

MIT © 2025
