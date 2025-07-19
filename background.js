const DEFAULT_BLOCKLIST = [
  "facebook.com",
  "www.facebook.com",
  "twitter.com",
  "www.twitter.com",
  "instagram.com",
  "www.instagram.com",
  "youtube.com",
  "www.youtube.com",
  "tiktok.com",
  "www.tiktok.com",
  "reddit.com",
  "www.reddit.com",
  "news.ycombinator.com",
  "cnn.com",
  "www.cnn.com",
  "foxnews.com",
  "www.foxnews.com",
  "nytimes.com",
  "www.nytimes.com"
];

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get();
  if (!data.blocklist) {
    await chrome.storage.local.set({ blocklist: DEFAULT_BLOCKLIST });
  }
  if (!data.allowlist) {
    await chrome.storage.local.set({ allowlist: [] });
  }
  if (typeof data.advancedMode === "undefined") {
    await chrome.storage.local.set({ advancedMode: false });
  }
});

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function blockTab(tabId, originalUrl) {
  const redirect = chrome.runtime.getURL("blocked.html?original=" + encodeURIComponent(originalUrl));
  chrome.tabs.update(tabId, { url: redirect });
}

async function classifyDomain(domain) {
  const { openaiApiKey } = await chrome.storage.local.get(["openaiApiKey"]);
  if (!openaiApiKey) return false; // default allow when no key set

  const systemPrompt =
    `You are an automated website-focus reviewer. Your goal is to help users stay productive. You must answer with exactly ONE word: BLOCK or ALLOW (uppercase). BLOCK if the site is likely to distract from focused work, including but not limited to:
• Social media (Facebook, Twitter/X, Instagram, TikTok, Reddit, LinkedIn)
• Video streaming or endless-scroll entertainment (YouTube, Netflix, Twitch)
• News, finance-news, tabloids, or opinion (CNN, NYTimes, WSJ, FoxNews, CNBC, Bloomberg, etc.)
• Meme or humour sites
• Gaming or sports highlights

ALLOW only when the domain is clearly work-related or a neutral tool (e.g. documentation, StackOverflow, github.com, docs.google.com). When unsure, prefer BLOCK.`;
  const userPrompt = `Should access to \"${domain}\" be blocked? Respond with BLOCK or ALLOW.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + openaiApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1
      })
    });
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
    return answer === "BLOCK";
  } catch (err) {
    console.error("Classification error", err);
    return false;
  }
}

async function handleUrl(tabId, url) {
  const domain = getDomain(url);
  if (!domain) return;

  const { blocklist = [], allowlist = [], advancedMode = false } = await chrome.storage.local.get([
    "blocklist",
    "allowlist",
    "advancedMode"
  ]);

  const normalizedAllow = allowlist.map((d) =>
    typeof d === "string" ? { domain: d, expiresAt: null } : d
  );

  const allowEntry = normalizedAllow.find((e) => e.domain === domain);
  if (allowEntry) {
    if (allowEntry.expiresAt && Date.now() > allowEntry.expiresAt) {
      // expired, remove
      await chrome.storage.local.set({
        allowlist: normalizedAllow.filter((e) => e.domain !== domain)
      });
      // fall through to block check
    } else {
      await injectTimer(tabId, allowEntry.expiresAt);
      return; // allowed
    }
  }

  if (blocklist.includes(domain)) {
    await blockTab(tabId, url);
    return;
  }

  if (advancedMode) {
    const shouldBlock = await classifyDomain(domain);
    if (shouldBlock) {
      await chrome.storage.local.set({ blocklist: [...blocklist, domain] });
      await blockTab(tabId, url);
    } else {
      const newAllow = { domain, expiresAt: null };
      await chrome.storage.local.set({ allowlist: [...normalizedAllow, newAllow] });
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    !tab.url.startsWith("chrome-extension://")
  ) {
    handleUrl(tabId, tab.url);
  }
});

async function chatWithGPT(messages) {
   const { openaiApiKey, openaiModel = "gpt-3.5-turbo" } = await chrome.storage.local.get([
     "openaiApiKey",
     "openaiModel"
   ]);
   if (!openaiApiKey) {
     throw new Error("No API key set in options.");
   }

  let modelToUse = openaiModel;
  const containsImage = messages.some((m) => {
    if (typeof m.content === "string") return /data:image\//.test(m.content);
    if (Array.isArray(m.content)) {
      return m.content.some((part) => part.type === "image_url");
    }
    return false;
  });
  if (containsImage && modelToUse.startsWith("gpt-3.5")) {
    modelToUse = "gpt-4o-mini"; // auto-upgrade for vision
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + openaiApiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: modelToUse, messages, max_tokens: 300 })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("OpenAI API error: " + errText);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("No choices returned from OpenAI");
  }
  return message;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "chatgpt") {
    (async () => {
      try {
        const reply = await chatWithGPT(message.messages);
        sendResponse({ reply });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // keep the channel open
  }

  if (message.type === "allow_domain") {
    (async () => {
      const { domain, durationMinutes, expiresAt } = message;
      const { allowlist = [] } = await chrome.storage.local.get(["allowlist"]);
      // Normalize existing allowlist entries to objects
      const normalized = allowlist.map((d) =>
        typeof d === "string" ? { domain: d, expiresAt: null } : d
      );
      const finalExpires = typeof expiresAt === "number" ? expiresAt : (durationMinutes ? Date.now() + durationMinutes * 60 * 1000 : null);
      const existingIndex = normalized.findIndex((e) => e.domain === domain);
      if (existingIndex === -1) {
        normalized.push({ domain, expiresAt: finalExpires });
      } else {
        normalized[existingIndex].expiresAt = finalExpires;
      }
      await chrome.storage.local.set({ allowlist: normalized });
      sendResponse({ status: "ok" });
    })();
    return true;
  }

  if (message.type === "expire_allow") {
    (async () => {
      const { domain, tabId } = message;
      const useTabId = tabId || (sender.tab ? sender.tab.id : null);
      const { allowlist = [] } = await chrome.storage.local.get(["allowlist"]);
      const updated = (allowlist || []).filter((e) => {
        if (typeof e === "string") return e !== domain;
        return e.domain !== domain;
      });
      await chrome.storage.local.set({ allowlist: updated });
      // force re-check of current tab to block
      if (useTabId !== null) {
        const tab = await chrome.tabs.get(useTabId);
        if (tab && tab.url) {
          handleUrl(useTabId, tab.url);
        }
      }
      sendResponse({ status: "expired" });
    })();
    return true;
  }
});

async function injectTimer(tabId, expiresAt) {
  if (!expiresAt) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      func: (end) => {
        if (window.__focusTimerInjected) return;
        window.__focusTimerInjected = true;
        const div = document.createElement("div");
        div.id = "focus-timer-overlay";
        div.style.cssText =
          "position:fixed;top:6px;right:6px;background:rgba(0,0,0,0.6);color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;z-index:2147483647;font-family:Arial, sans-serif;";
        document.body.appendChild(div);

        function update() {
          const ms = end - Date.now();
          if (ms <= 0) {
            div.textContent = "0s";
            chrome.runtime.sendMessage({ type: 'expire_allow', domain: location.hostname });
            setTimeout(() => location.reload(), 500);
            return;
          }
          const minutes = Math.floor(ms / 60000);
          const hours = Math.floor(minutes / 60);
          const secs = Math.floor((ms % 60000) / 1000);

          let text;
          if (hours >= 1) {
            text = hours + "h";
          } else if (minutes >= 5) {
            text = minutes + "m";
          } else if (minutes >= 1) {
            text = "a few minutes";
          } else if (secs > 10) {
            text = secs + "s";
          } else {
            text = secs + "s";
          }
          div.textContent = text;
          setTimeout(update, ms > 60000 ? 60000 : 1000);
        }
        update();
      },
      args: [expiresAt]
    });
  } catch (err) {
    console.error("injectTimer error", err);
  }
}

// Open options page when the user clicks the extension icon
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
}); 