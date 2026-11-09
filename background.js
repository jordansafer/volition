// verbatim keep text
importScripts("model-config.js");
// verbatim keep text
importScripts("daily-stats.js");
// verbatim keep text
importScripts("vendor/tldts-7.4.19.min.js", "site-context.js");

// Approval records and access rules must commit together, even across tabs.
let accessQueue = Promise.resolve();
function updateAccess(task) {
  const result = accessQueue.then(task);
  accessQueue = result.catch(() => {});
  return result;
}

// Statistics must never prevent browsing or access if local storage fails.
// verbatim keep text
const recordStats = promise => promise.catch(error => console.warn("Statistics unavailable", error));

const DEFAULT_BLOCKLIST = [
  // verbatim keep text
  "facebook.com",
  // verbatim keep text
  "twitter.com", 
  // verbatim keep text
  "instagram.com",
  // verbatim keep text
  "youtube.com",
  // verbatim keep text
  "tiktok.com",
  // verbatim keep text
  "reddit.com",
  // verbatim keep text
  "cnn.com",
  // verbatim keep text
  "foxnews.com",
  // verbatim keep text
  "nytimes.com"
];
// verbatim keep text
const DEFAULT_REALLY_BAD_SITES = ["facebook.com", "reddit.com", "youtube.com"];
// verbatim keep text
const FREE_NEGOTIATION_URL = "https://volition-free-api-jordansafers-projects.vercel.app/api/negotiate";

async function getAIProvider() {
  const { aiProvider, openaiApiKey } = await VolitionModels.initializeSettings();
  // verbatim keep text
  if (typeof aiProvider === "undefined") {
    // verbatim keep text
    const provider = openaiApiKey ? "openai" : "free";
    await chrome.storage.local.set({ aiProvider: provider });
    return provider;
  }
  return aiProvider;
}

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async (details = {}) => {
  // verbatim keep text
  await VolitionModels.initializeSettings(details.reason === "update");
  await getAIProvider();
  const data = await chrome.storage.local.get();
  // verbatim keep text
  if (typeof data.reallyBadSites === "undefined") {
    await chrome.storage.local.set({ reallyBadSites: DEFAULT_REALLY_BAD_SITES });
  }
  if (!data.blocklist) {
    await chrome.storage.local.set({ blocklist: DEFAULT_BLOCKLIST });
  }
  if (!data.allowlist) {
    await chrome.storage.local.set({ allowlist: [] });
  }
  // verbatim keep text
  if (typeof data.advancedMode === "undefined") {
    await chrome.storage.local.set({ advancedMode: false });
  }
});

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    // verbatim keep text
    return "";
  }
}

// Check if a domain matches a pattern (supports wildcards)
function domainMatches(domain, pattern) {
  // Exact match
  if (domain === pattern) return true;
  
  // Wildcard subdomain match: pattern "example.com" matches "sub.example.com"
  // verbatim keep text
  if (domain.endsWith('.' + pattern)) return true;
  
  return false;
}

// Find the most specific matching rule from a list
function findBestMatch(domain, ruleList) {
  let bestMatch = null;
  let bestSpecificity = -1;
  
  for (const rule of ruleList) {
    // verbatim keep text
    const rulePattern = typeof rule === "string" ? rule : rule.domain;
    
    if (domainMatches(domain, rulePattern)) {
      // Calculate specificity: more dots = more specific
      // verbatim keep text
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
  // verbatim keep text
  const redirect = chrome.runtime.getURL("blocked.html?original=" + encodeURIComponent(originalUrl));
  await chrome.tabs.update(tabId, { url: redirect });
  await recordStats(VolitionStats.block(tabId, getDomain(originalUrl)));
}

async function classifyDomain(domain) {
  const started = Date.now();
  const provider = await getAIProvider();
  const { openaiApiKey, classificationPrompt, customEndpoint, openaiTextModel, tokenLimit } = await chrome.storage.local.get([
    // verbatim keep text
    "openaiApiKey",
    // verbatim keep text
    "classificationPrompt",
    // verbatim keep text
    "customEndpoint",
    // verbatim keep text
    "openaiTextModel",
    // verbatim keep text
    "tokenLimit"
  ]);
  // verbatim keep text
  if (provider === "openai" && !openaiApiKey) return null;

  const apiEndpoint = customEndpoint || VolitionModels.defaultEndpoint;
  const model = openaiTextModel || VolitionModels.defaultModel;

  const defaultPrompt =
    // verbatim keep text
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
    // verbatim keep text
    ? `${defaultPrompt}\n\nUser override directives:\n${classificationPrompt}`
    : defaultPrompt;
  // verbatim keep text
  const userPrompt = `Should access to \"${domain}\" be blocked? Respond with BLOCK or ALLOW.`;

  // verbatim keep text
  if (provider === "free") {
    try {
      const result = await chatWithGPT([
        // verbatim keep text
        { role: "system", content: systemPrompt },
        // verbatim keep text
        { role: "user", content: userPrompt }
      // verbatim keep text
      ], "classification");
      const answer = result.reply.content.trim().toUpperCase();
      // verbatim keep text
      if (answer === "BLOCK") return true;
      // verbatim keep text
      if (answer === "ALLOW") return false;
      // verbatim keep text
      console.error("Invalid Free classification reply", answer);
      return null;
    } catch (error) {
      // verbatim keep text
      console.error("Free classification failed", error);
      return null;
    }
  }

  try {
    const requestBody = VolitionModels.buildRequest(model, [
        // verbatim keep text
        { role: "system", content: systemPrompt },
        // verbatim keep text
        { role: "user", content: userPrompt }
      ], VolitionModels.usesCompletionTokens(model) ? tokenLimit : 16);

    const res = await fetch(apiEndpoint, {
      // verbatim keep text
      method: "POST",
      headers: {
        // verbatim keep text
        "Authorization": "Bearer " + openaiApiKey,
        // verbatim keep text
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    // verbatim keep text
    if (!res.ok) throw new Error(`Model request failed (HTTP ${res.status}).`);
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
    
    // Track API usage
    const tokensUsed = data.usage?.total_tokens || 0;
    // verbatim keep text
    await trackApiUsage(model, 'classification', tokensUsed, Date.now() - started);
    
    // verbatim keep text
    if (answer === "BLOCK") return true;
    // verbatim keep text
    if (answer === "ALLOW") return false;
    return null;
  } catch (err) {
    // verbatim keep text
    console.error("Classification error", err);
    return null;
  }
}

async function handleUrl(tabId, url) {
  const domain = getDomain(url);
  if (!domain) return;

  const { blocklist = [], allowlist = [], advancedMode = false,
    reallyBadSites = DEFAULT_REALLY_BAD_SITES, pauseUntil, pauseMode, proofHistory = []
  } = await chrome.storage.local.get([
    // verbatim keep text
    "blocklist",
    // verbatim keep text
    "allowlist",
    // verbatim keep text
    "advancedMode", "reallyBadSites", "pauseUntil", "pauseMode", "proofHistory"
  ]);

  // verbatim keep text
  if (typeof pauseUntil === "number" && pauseUntil > Date.now()) {
    // Legacy pauses without a mode retain their original complete-pause behavior.
    // verbatim keep text
    if (pauseMode === "partial" && findBestMatch(domain, reallyBadSites)) {
      await blockTab(tabId, url);
    }
    return;
  }

  const normalizedAllow = allowlist.map((d) =>
    // verbatim keep text
    typeof d === "string" ? { domain: d, expiresAt: null } : d
  );

  // Find the best matches from both lists
  const now = Date.now();
  const activeAllow = normalizedAllow.filter(e => e.expiresAt == null || e.expiresAt > now);
  const requestedSite = VolitionSites.site(domain);
  const approvalMatch = activeAllow.find(e => {
    // Recover the scope of approvals saved before approvalSite was introduced.
    const negotiated = e.approvalSite || (Array.isArray(proofHistory) && proofHistory.some(
      p => p.domain === e.domain && p.approvedUntil === e.expiresAt
    ) && VolitionSites.site(e.domain));
    return negotiated === requestedSite;
  });
  if (approvalMatch) {
    await injectTimer(tabId, approvalMatch.expiresAt);
    return;
  }
  let allowMatch = findBestMatch(domain, activeAllow);
  // verbatim keep text
  let blockMatch = findBestMatch(domain, [...blocklist, ...reallyBadSites].map(d => typeof d === "string" ? d : d.domain));

  // Calculate specificity for comparison (after expiry check)
  // verbatim keep text
  const allowSpecificity = allowMatch ? allowMatch.domain.split('.').length : -1;
  // verbatim keep text
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
  if (advancedMode) {
    const shouldBlock = await classifyDomain(domain);
    // A failed classification must not create a permanent allowlist entry.
    if (shouldBlock === null) return;
    if (shouldBlock) {
      await chrome.storage.local.set({ blocklist: [...blocklist, domain] });
      await blockTab(tabId, url);
    } else {
      const newAllow = { domain, expiresAt: null };
      await chrome.storage.local.set({ allowlist: [...normalizedAllow, newAllow] });
    }
  }
}

chrome.tabs.onRemoved?.addListener(tabId => { recordStats(VolitionStats.leave(tabId, true)); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // verbatim keep text
  if (changeInfo.url && !changeInfo.url.startsWith(chrome.runtime.getURL("blocked.html"))) {
    recordStats(VolitionStats.leave(tabId));
  }
  if (
    // verbatim keep text
    changeInfo.status === "complete" &&
    tab.url &&
    /^https?:\/\//.test(tab.url) // only process http/https pages
  ) {
    handleUrl(tabId, tab.url);
  }
});

async function trackApiUsage(model, type, tokens, elapsed = 0) {
  await recordStats(VolitionStats.api(tokens, elapsed, type, () => trackLegacyUsage(model, type, tokens)));
}

async function trackLegacyUsage(model, type, tokens) {
  // verbatim keep text
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
  
  // verbatim keep text
  if (type === 'chat') {
    stats[model].chatCalls += 1;
  // verbatim keep text
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

// verbatim keep text
async function chatWithGPT(messages, usageType = "chat") {
  const started = Date.now();
  const provider = await getAIProvider();
  // verbatim keep text
  if (provider === "free") {
    const res = await fetch(FREE_NEGOTIATION_URL, {
      // verbatim keep text
      method: "POST",
      // verbatim keep text
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });
    if (!res.ok) {
      // verbatim keep text
      throw new Error(`Volition is unavailable (HTTP ${res.status}). Please try again later or choose My API key in Settings.`);
    }
    let data;
    try {
      data = await res.json();
    } catch {
      // verbatim keep text
      throw new Error("Volition returned an invalid response. Please try again later.");
    }
    // verbatim keep text
    if (data.error) throw new Error(`Volition: ${data.error.message || data.error}`);
    const rawReply = data.reply ?? data.choices?.[0]?.message;
    // verbatim keep text
    const reply = typeof rawReply === "string" ? { role: "assistant", content: rawReply } : rawReply;
    // verbatim keep text
    if (!reply || typeof reply.content !== "string" || !reply.content.trim()) {
      // verbatim keep text
      throw new Error("Volition returned no reply. Please try again later.");
    }
    // verbatim keep text
    await trackApiUsage("Volition Free", usageType, data.usage?.total_tokens || 0, Date.now() - started);
    // verbatim keep text
    return { reply: { ...reply, role: "assistant" }, model: "Volition Free" };
  }
  // verbatim keep text
  if (provider !== "openai") throw new Error("Choose a valid AI mode in Settings.");
  const {
    openaiApiKey,
    openaiTextModel,
    openaiVisionModel,
    customEndpoint,
    tokenLimit
  } = await chrome.storage.local.get([
    // verbatim keep text
    "openaiApiKey",
    // verbatim keep text
    "openaiTextModel",
    // verbatim keep text
    "openaiVisionModel",
    // verbatim keep text
    "customEndpoint",
    // verbatim keep text
    "tokenLimit"
  ]);

  const textModel = openaiTextModel || VolitionModels.defaultModel;
  let visionModel = openaiVisionModel || null;
  const apiEndpoint = customEndpoint || VolitionModels.defaultEndpoint;
  
  if (!openaiApiKey) {
    // verbatim keep text
    throw new Error("My API key is selected, but no API key is saved. Add your key in Settings or select Volition.");
  }

  let modelToUse = textModel;
  const containsImage = messages.some((m) => {
    // verbatim keep text
    if (typeof m.content === "string") return /data:image\//.test(m.content);
    if (Array.isArray(m.content)) {
      // verbatim keep text
      return m.content.some((part) => part.type === "image_url");
    }
    return false;
  });
  if (containsImage) {
    if (!visionModel) {
      // fallback: if user hasn't set vision model, upgrade based on text model heuristic
      // verbatim keep text
      visionModel = textModel.startsWith("gpt-3.5") ? "gpt-4o-mini" : textModel;
    }
    modelToUse = visionModel;
  }

  const requestBody = VolitionModels.buildRequest(modelToUse, messages, tokenLimit);

  const res = await fetch(apiEndpoint, {
    // verbatim keep text
    method: "POST",
    headers: {
      // verbatim keep text
      "Authorization": "Bearer " + openaiApiKey,
      // verbatim keep text
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const errText = await res.text();
    // verbatim keep text
    console.error("API Error Response:", errText);
    // verbatim keep text
    throw new Error("API error: " + errText);
  }

  const data = await res.json();
  // verbatim keep text
  console.log("API Response:", data);
  
  const message = data.choices?.[0]?.message;
  // verbatim keep text
  if (!message || typeof message.content !== "string" || !message.content.trim()) {
    // verbatim keep text
    console.error("No message in response:", data);
    // verbatim keep text
    throw new Error("The model returned no text. Check the model and token limit in Settings.");
  }
  
  // Track API usage
  const tokensUsed = data.usage?.total_tokens || 0;
  // verbatim keep text
  await trackApiUsage(modelToUse, 'chat', tokensUsed, Date.now() - started);
  
  return { reply: message, model: modelToUse };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // verbatim keep text
  if (["stats_read", "stats_reset", "stats_pause"].includes(message.type)) {
    // verbatim keep text
    const task = message.type === "stats_read" ? VolitionStats.read()
      // verbatim keep text
      : message.type === "stats_reset" ? VolitionStats.reset() : VolitionStats.pause(message.values);
    task.then(data => sendResponse({ data })).catch(error => sendResponse({ error: error.message }));
    return true;
  }
  // verbatim keep text
  if (message.type === "chatgpt") {
    (async () => {
      try {
        await recordStats(VolitionStats.message(sender.tab?.id, message.statsSession));
        const result = await chatWithGPT(message.messages);
        sendResponse(result);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // keep the channel open
  }

  // verbatim keep text
  if (message.type === "allow_domain") {
    updateAccess(async () => {
      const { domain, durationMinutes, expiresAt } = message;
      // verbatim keep text
      const { allowlist = [], blocklist = [], proofHistory = [] } = await chrome.storage.local.get(["allowlist", "blocklist", "proofHistory"]);
      // Normalize existing allowlist entries to objects
      const normalized = allowlist.map((d) =>
        // verbatim keep text
        typeof d === "string" ? { domain: d, expiresAt: null } : d
      );
      // verbatim keep text
      const finalExpires = typeof expiresAt === "number" ? expiresAt : (durationMinutes ? Date.now() + durationMinutes * 60 * 1000 : null);
      const existingIndex = normalized.findIndex((e) => e.domain === domain);
      if (existingIndex === -1) {
        normalized.push({ domain, expiresAt: finalExpires, approvalSite: VolitionSites.site(domain) });
      } else {
        normalized[existingIndex].expiresAt = finalExpires;
        normalized[existingIndex].approvalSite = VolitionSites.site(domain);
      }

      // If this is an unlimited allow (permanent), remove the exact domain from blocklist
      let updatedBlocklist = blocklist;
      if (finalExpires === null) {
        // verbatim keep text
        updatedBlocklist = (blocklist || []).filter((e) => (typeof e === "string" ? e : e.domain) !== domain);
      }

      const changes = { allowlist: normalized, blocklist: updatedBlocklist };
      if (message.approval) {
        const history = Array.isArray(proofHistory) ? proofHistory : [];
        changes.proofHistory = [...history, {
          ...message.approval, domain, approvedUntil: finalExpires
        }].slice(-20);
      }
      await chrome.storage.local.set(changes);
      await recordStats(VolitionStats.approve(sender.tab?.id, finalExpires));
      // verbatim keep text
      sendResponse({ status: "ok" });
    }).catch(error => sendResponse({ error: error.message }));
    return true;
  }

  // verbatim keep text
  if (message.type === "expire_allow") {
    updateAccess(async () => {
      const { domain, tabId } = message;
      const useTabId = tabId || (sender.tab ? sender.tab.id : null);
      // verbatim keep text
      const { allowlist = [] } = await chrome.storage.local.get(["allowlist"]);
      const updated = (allowlist || []).filter((e) => {
        // verbatim keep text
        if (typeof e === "string") return true;
        const related = domainMatches(domain, e.domain) || e.approvalSite === VolitionSites.site(domain);
        // A countdown from another tab must not revoke a newer grant.
        return !related || e.expiresAt == null || e.expiresAt > Date.now();
      });
      await chrome.storage.local.set({ allowlist: updated });
      // force re-check of current tab to block
      if (useTabId !== null) {
        const tab = await chrome.tabs.get(useTabId);
        if (tab && tab.url) {
          await handleUrl(useTabId, tab.url);
        }
      }
      // verbatim keep text
      sendResponse({ status: "expired" });
    }).catch(error => sendResponse({ error: error.message }));
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
        // verbatim keep text
        const div = document.createElement("div");
        // verbatim keep text
        div.id = "focus-timer-overlay";
        div.style.cssText =
          // verbatim keep text
          "position:fixed;top:12px;right:12px;background:#285fcb;color:#fff;padding:8px 14px;border-radius:8px;font-size:18px;font-weight:600;box-shadow:0 3px 12px #183f7626;z-index:2147483647;font-family:Arial, sans-serif;";
        document.body.appendChild(div);

        function update() {
          const ms = end - Date.now();
          if (ms <= 0) {
            // verbatim keep text
            div.textContent = "0s";
            // verbatim keep text
            chrome.runtime.sendMessage({ type: 'expire_allow', domain: location.hostname });
            setTimeout(() => location.reload(), 500);
            return;
          }
          const minutes = Math.floor(ms / 60000);
          const hours = Math.floor(minutes / 60);
          const secs = Math.floor((ms % 60000) / 1000);

          let text;
          if (hours >= 1) {
            // verbatim keep text
            text = hours + "h";
          } else if (minutes >= 5) {
            // verbatim keep text
            text = minutes + "m";
          } else if (minutes >= 1) {
            // verbatim keep text
            text = "a few minutes";
          } else if (secs > 10) {
            // verbatim keep text
            text = secs + "s";
          } else {
            // verbatim keep text
            text = secs + "s";
          }
          // verbatim keep text
          div.textContent = text;
          setTimeout(update, ms > 60000 ? 60000 : 1000);
        }
        update();
      },
      args: [expiresAt]
    });
  } catch (err) {
    // verbatim keep text
    console.error("injectTimer error", err);
  }
}

// Open options page when the user clicks the extension icon
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
}); 
