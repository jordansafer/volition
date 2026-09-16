const DEFAULT_BLOCKLIST = [
  "facebook.com",
  "twitter.com", 
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "reddit.com",
  "cnn.com",
  "foxnews.com",
  "nytimes.com"
];
const DEFAULT_REALLY_BAD_SITES = ["facebook.com", "reddit.com", "youtube.com"];
const FREE_NEGOTIATION_URL = "https://volition-ai-backend-9691w9.v2.appdeploy.ai/api/negotiate";

async function getAIProvider() {
  const { aiProvider } = await chrome.storage.local.get(["aiProvider"]);
  if (typeof aiProvider === "undefined") {
    await chrome.storage.local.set({ aiProvider: "free" });
    return "free";
  }
  return aiProvider;
}

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  await getAIProvider();
  const data = await chrome.storage.local.get();
  if (typeof data.reallyBadSites === "undefined") {
    await chrome.storage.local.set({ reallyBadSites: DEFAULT_REALLY_BAD_SITES });
  }
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

// Check if a domain matches a pattern (supports wildcards)
function domainMatches(domain, pattern) {
  // Exact match
  if (domain === pattern) return true;
  
  // Wildcard subdomain match: pattern "example.com" matches "sub.example.com"
  if (domain.endsWith('.' + pattern)) return true;
  
  return false;
}

// Find the most specific matching rule from a list
function findBestMatch(domain, ruleList) {
  let bestMatch = null;
  let bestSpecificity = -1;
  
  for (const rule of ruleList) {
    const rulePattern = typeof rule === "string" ? rule : rule.domain;
    
    if (domainMatches(domain, rulePattern)) {
      // Calculate specificity: more dots = more specific
      const specificity = rulePattern.split('.').length;
      if (specificity > bestSpecificity) {
        bestMatch = rule;
        bestSpecificity = specificity;
      }
    }
  }
  
  return bestMatch;
}

async function blockTab(tabId, originalUrl) {
  const redirect = chrome.runtime.getURL("blocked.html?original=" + encodeURIComponent(originalUrl));
  chrome.tabs.update(tabId, { url: redirect });
}

async function classifyDomain(domain) {
  // Automatic classification is a BYO feature; never use a saved key in Free mode.
  if (await getAIProvider() !== "openai") return false;
  const { openaiApiKey, classificationPrompt, customEndpoint, openaiTextModel } = await chrome.storage.local.get([
    "openaiApiKey",
    "classificationPrompt",
    "customEndpoint",
    "openaiTextModel"
  ]);
  if (!openaiApiKey) return false; // default allow when no key set

  const apiEndpoint = customEndpoint || "https://api.openai.com/v1/chat/completions";
  const model = openaiTextModel || "gpt-3.5-turbo";

  const defaultPrompt =
    `You are an automated website-focus reviewer. Your goal is to help users stay productive. You must answer with exactly ONE word: BLOCK or ALLOW (uppercase). BLOCK if the site is likely to distract from focused work, including but not limited to:
• Social media (Facebook, Twitter/X, Instagram, TikTok, Reddit, LinkedIn)
• Video streaming or endless-scroll entertainment (YouTube, Netflix, Twitch)
• News, finance-news, tabloids, or opinion (CNN, NYTimes, WSJ, FoxNews, CNBC, Bloomberg, etc.)
• Meme or humour sites
• Gaming or sports highlights
• Gaming sites, MMO forums, or game launchers

Additional rules:
• Block social media, scrolling, and news sites by default.
• Allow search engines, scientific portals, and reference databases by default.
• Block blogs by default.
• For other domains, decide which category they are closest to and apply the corresponding rule.`;
  const systemPrompt = classificationPrompt
    ? `${defaultPrompt}\n\nUser override directives:\n${classificationPrompt}`
    : defaultPrompt;
  const userPrompt = `Should access to \"${domain}\" be blocked? Respond with BLOCK or ALLOW.`;

  try {
    // Use max_completion_tokens for newer models that require it
    const requestBody = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    };
    const completionsModels = ["gpt-o3", "o1", "gpt-5"];
    const needsCompletionTokens = completionsModels.some(modelName => model.includes(modelName));
    
    if (needsCompletionTokens) {
      requestBody.max_completion_tokens = 50;
    } else {
      requestBody.max_tokens = 1;
    }

    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + openaiApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
    
    // Track API usage
    const tokensUsed = data.usage?.total_tokens || 0;
    await trackApiUsage(model, 'classification', tokensUsed);
    
    return answer === "BLOCK";
  } catch (err) {
    console.error("Classification error", err);
    return false;
  }
}

async function handleUrl(tabId, url) {
  const domain = getDomain(url);
  if (!domain) return;

  const { blocklist = [], allowlist = [], advancedMode = false,
    reallyBadSites = DEFAULT_REALLY_BAD_SITES, pauseUntil, pauseMode
  } = await chrome.storage.local.get([
    "blocklist",
    "allowlist",
    "advancedMode", "reallyBadSites", "pauseUntil", "pauseMode"
  ]);

  if (typeof pauseUntil === "number" && pauseUntil > Date.now()) {
    // Legacy pauses without a mode retain their original complete-pause behavior.
    if (pauseMode === "partial" && findBestMatch(domain, reallyBadSites)) {
      await blockTab(tabId, url);
    }
    return;
  }

  const normalizedAllow = allowlist.map((d) =>
    typeof d === "string" ? { domain: d, expiresAt: null } : d
  );

  // Find the best matches from both lists
  let allowMatch = findBestMatch(domain, normalizedAllow);
  let blockMatch = findBestMatch(domain, [...blocklist, ...reallyBadSites].map(d => typeof d === "string" ? d : d.domain));

  // Check for expired allowlist entries
  if (allowMatch && allowMatch.expiresAt && Date.now() > allowMatch.expiresAt) {
    // Remove expired entry
    await chrome.storage.local.set({
      allowlist: normalizedAllow.filter((e) => e.domain !== allowMatch.domain)
    });
    // Treat as if no allow match
    allowMatch = null;
  }

  // Calculate specificity for comparison (after expiry check)
  const allowSpecificity = allowMatch ? allowMatch.domain.split('.').length : -1;
  const blockSpecificity = blockMatch ? blockMatch.split('.').length : -1;

  // Determine action based on specificity
  if (allowSpecificity > blockSpecificity) {
    // Allow rule is more specific, allow access
    await injectTimer(tabId, allowMatch.expiresAt);
    return;
  } else if (blockSpecificity > allowSpecificity) {
    // Block rule is more specific, block access
    await blockTab(tabId, url);
    return;
  } else if (allowMatch && blockMatch) {
    // Same specificity, allow access until expiry
    await injectTimer(tabId, allowMatch.expiresAt);
    return;
  } else if (allowMatch) {
    // Only allow rule exists
    await injectTimer(tabId, allowMatch.expiresAt);
    return;
  } else if (blockMatch) {
    // Only block rule exists
    await blockTab(tabId, url);
    return;
  }

  // No explicit rules, use advanced mode if enabled
  if (advancedMode && await getAIProvider() === "openai") {
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
    /^https?:\/\//.test(tab.url) // only process http/https pages
  ) {
    handleUrl(tabId, tab.url);
  }
});

async function trackApiUsage(model, type, tokens) {
  const data = await chrome.storage.local.get(["apiUsageStats", "apiUsageHistory"]);
  const stats = data.apiUsageStats || {};
  const history = data.apiUsageHistory || [];
  
  // Update model stats
  if (!stats[model]) {
    stats[model] = {
      totalCalls: 0,
      totalTokens: 0,
      chatCalls: 0,
      classificationCalls: 0
    };
  }
  
  stats[model].totalCalls += 1;
  stats[model].totalTokens += tokens || 0;
  
  if (type === 'chat') {
    stats[model].chatCalls += 1;
  } else if (type === 'classification') {
    stats[model].classificationCalls += 1;
  }
  
  // Add to history (keep last 100 entries)
  history.push({
    timestamp: Date.now(),
    model,
    type,
    tokens: tokens || 0
  });
  
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }
  
  await chrome.storage.local.set({
    apiUsageStats: stats,
    apiUsageHistory: history
  });
}

async function chatWithGPT(messages) {
  const provider = await getAIProvider();
  if (provider === "free") {
    const res = await fetch(FREE_NEGOTIATION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });
    if (!res.ok) {
      throw new Error(`Volition Free is unavailable (HTTP ${res.status}). Please try again later or choose My OpenAI API key in Settings.`);
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Volition Free returned an invalid response. Please try again later.");
    }
    if (data.error) throw new Error(`Volition Free: ${data.error.message || data.error}`);
    const rawReply = data.reply ?? data.choices?.[0]?.message;
    const reply = typeof rawReply === "string" ? { role: "assistant", content: rawReply } : rawReply;
    if (!reply || typeof reply.content !== "string" || !reply.content.trim()) {
      throw new Error("Volition Free returned no reply. Please try again later.");
    }
    await trackApiUsage("Volition Free", "chat", data.usage?.total_tokens || 0);
    return { reply: { ...reply, role: "assistant" }, model: "Volition Free" };
  }
  if (provider !== "openai") throw new Error("Choose a valid AI mode in Settings.");
  const {
    openaiApiKey,
    openaiTextModel,
    openaiVisionModel,
    customEndpoint,
    tokenLimit
  } = await chrome.storage.local.get([
    "openaiApiKey",
    "openaiTextModel",
    "openaiVisionModel",
    "customEndpoint",
    "tokenLimit"
  ]);

  const textModel = openaiTextModel || "gpt-3.5-turbo";
  let visionModel = openaiVisionModel || null;
  const apiEndpoint = customEndpoint || "https://api.openai.com/v1/chat/completions";
  const maxTokens = parseInt(tokenLimit) || 300;
  
  if (!openaiApiKey) {
    throw new Error("My OpenAI API key mode is selected, but no API key is saved. Add your key in Settings or select Volition Free.");
  }

  let modelToUse = textModel;
  const containsImage = messages.some((m) => {
    if (typeof m.content === "string") return /data:image\//.test(m.content);
    if (Array.isArray(m.content)) {
      return m.content.some((part) => part.type === "image_url");
    }
    return false;
  });
  if (containsImage) {
    if (!visionModel) {
      // fallback: if user hasn't set vision model, upgrade based on text model heuristic
      visionModel = textModel.startsWith("gpt-3.5") ? "gpt-4o-mini" : textModel;
    }
    modelToUse = visionModel;
  }

  // Use max_completion_tokens for newer models that require it
  const requestBody = { model: modelToUse, messages };
  const completionsModels = ["gpt-o3", "o1", "gpt-5"];
  const needsCompletionTokens = completionsModels.some(model => modelToUse.includes(model));
  
  if (needsCompletionTokens) {
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.max_tokens = maxTokens;
  }

  console.log("Making API request:", { model: modelToUse, endpoint: apiEndpoint, tokenParam: needsCompletionTokens ? "max_completion_tokens" : "max_tokens" });

  const res = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + openaiApiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("API Error Response:", errText);
    throw new Error("API error: " + errText);
  }

  const data = await res.json();
  console.log("API Response:", data);
  
  const message = data.choices?.[0]?.message;
  if (!message) {
    console.error("No message in response:", data);
    throw new Error("No choices returned from API");
  }
  
  // Track API usage
  const tokensUsed = data.usage?.total_tokens || 0;
  await trackApiUsage(modelToUse, 'chat', tokensUsed);
  
  return { reply: message, model: modelToUse };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "chatgpt") {
    (async () => {
      try {
        const result = await chatWithGPT(message.messages);
        sendResponse(result);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // keep the channel open
  }

  if (message.type === "allow_domain") {
    (async () => {
      const { domain, durationMinutes, expiresAt } = message;
      const { allowlist = [], blocklist = [] } = await chrome.storage.local.get(["allowlist", "blocklist"]);
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

      // If this is an unlimited allow (permanent), remove the exact domain from blocklist
      let updatedBlocklist = blocklist;
      if (finalExpires === null) {
        updatedBlocklist = (blocklist || []).filter((e) => (typeof e === "string" ? e : e.domain) !== domain);
      }

      await chrome.storage.local.set({ allowlist: normalized, blocklist: updatedBlocklist });
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
