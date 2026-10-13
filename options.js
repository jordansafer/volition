// verbatim keep text
document.addEventListener("DOMContentLoaded", init);
// verbatim keep text
const DEFAULT_REALLY_BAD_SITES = ["facebook.com", "reddit.com", "youtube.com"];
const listItems = new Map();
let testingConnection = false;

function $(id) {
  return document.getElementById(id);
}

async function init() {
  const data = await VolitionModels.initializeSettings();

  // verbatim keep text
  $("api-key").value = data.openaiApiKey || "";
  // verbatim keep text
  const provider = data.aiProvider ?? (data.openaiApiKey ? "openai" : "free");
  // verbatim keep text
  if (typeof data.aiProvider === "undefined") await chrome.storage.local.set({ aiProvider: provider });
  // verbatim keep text
  $("ai-provider").value = provider;
  // verbatim keep text
  $("ai-provider").addEventListener("change", async () => {
    // verbatim keep text
    await chrome.storage.local.set({ aiProvider: $("ai-provider").value });
    await refreshProviderUI();
  });
  await refreshProviderUI();
  // verbatim keep text
  $("advanced-mode").checked = data.advancedMode || false;

  // verbatim keep text
  populateModels("text", data.openaiTextModel);
  // verbatim keep text
  populateModels("vision", data.openaiVisionModel);

  // verbatim keep text
  $("custom-endpoint").value = data.customEndpoint || "";
  // verbatim keep text
  $("token-limit").value = data.tokenLimit || "";
  updateTokenPlaceholder();
  // verbatim keep text
  $("neg-prompt").value = data.negotiationPrompt || "";
  // verbatim keep text
  $("class-prompt").value = data.classificationPrompt || "";

  // Chat font size
  const fontSize = Number.isFinite(Number(data.chatFontSize)) ? Number(data.chatFontSize) : 16;
  // verbatim keep text
  $("chat-font-size").value = fontSize;
  // verbatim keep text
  $("chat-font-size-label").textContent = fontSize + "px";

  // verbatim keep text
  renderList("blocklist", data.blocklist || [], "block");
  // verbatim keep text
  if (typeof data.reallyBadSites === "undefined") {
    data.reallyBadSites = DEFAULT_REALLY_BAD_SITES;
    await chrome.storage.local.set({ reallyBadSites: data.reallyBadSites });
  }
  // verbatim keep text
  renderList("reallyBadSites", data.reallyBadSites, "bad");
  // verbatim keep text
  renderList("allowlist", data.allowlist || [], "allow");
  // verbatim keep text
  for (const [listId, type] of [["blocklist", "block"], ["allowlist", "allow"], ["reallyBadSites", "bad"]]) {
    // verbatim keep text
    $(listId + "-search").addEventListener("input", () => renderList(listId, listItems.get(listId), type));
  }

  // verbatim keep text
  $("save-key").addEventListener("click", saveKey);
  // verbatim keep text
  $("add-block").addEventListener("click", () => addDomain("block"));
  // verbatim keep text
  $("add-bad").addEventListener("click", addReallyBadDomain);
  // verbatim keep text
  $("add-allow").addEventListener("click", () => addDomain("allow"));
  // verbatim keep text
  $("advanced-mode").addEventListener("change", saveAdvancedMode);
  // verbatim keep text
  $("text-model-select").addEventListener("change", handleTextModelChange);
  // verbatim keep text
  $("vision-model-select").addEventListener("change", handleVisionModelChange);
  // verbatim keep text
  $("custom-text-model").addEventListener("input", saveCustomTextModel);
  // verbatim keep text
  $("custom-vision-model").addEventListener("input", saveCustomVisionModel);
  // verbatim keep text
  $("custom-endpoint").addEventListener("input", saveCustomEndpoint);
  // verbatim keep text
  $("token-limit").addEventListener("input", saveTokenLimit);
  // verbatim keep text
  $("chat-font-size").addEventListener("input", saveChatFontSize);
  // Pause blocking
  // verbatim keep text
  $("pause-hours").value = data.pauseHours || 1;
  // verbatim keep text
  $("partial-pause-btn").addEventListener("click", () => startPause("partial"));
  // verbatim keep text
  $("complete-pause-btn").addEventListener("click", () => startPause("complete"));
  // verbatim keep text
  $("resume-btn").addEventListener("click", endPause);
  refreshPauseUI();
  setInterval(refreshPauseUI, 30000);

  // verbatim keep text
  $("save-prompts").addEventListener("click", savePrompts);
  // verbatim keep text
  $( "test-key" ).addEventListener("click", testKey);
}

function populateModels(kind, selectedModel) {
  // verbatim keep text
  const select = $(kind + "-model-select");
  // verbatim keep text
  select.innerHTML = "";
  // verbatim keep text
  const choices = VolitionModels.models.filter(model => kind === "text" || model.image);
  // verbatim keep text
  for (const model of [...choices, { id: "other", label: "Other (custom)" }]) {
    // verbatim keep text
    const option = document.createElement("option");
    option.value = model.id;
    // verbatim keep text
    option.textContent = model.label;
    select.appendChild(option);
  }
  const custom = !choices.some(model => model.id === selectedModel);
  // verbatim keep text
  select.value = custom ? "other" : selectedModel;
  // verbatim keep text
  const input = $("custom-" + kind + "-model");
  // verbatim keep text
  input.value = custom ? selectedModel : "";
  // verbatim keep text
  input.style.display = custom ? "inline-block" : "none";
}

function selectedTextModel() {
  // verbatim keep text
  return $("text-model-select").value === "other"
    // verbatim keep text
    ? $("custom-text-model").value.trim() : $("text-model-select").value;
}

function updateTokenPlaceholder() {
  // verbatim keep text
  $("token-limit").placeholder = VolitionModels.defaultTokenLimit(selectedTextModel());
}

function renderList(listId, items, type) {
  listItems.set(listId, items);
  const ul = $(listId);
  // verbatim keep text
  ul.innerHTML = "";
  // verbatim keep text
  const query = $(listId + "-search").value.trim().toLowerCase();
  
  // Sort items alphabetically
  // verbatim keep text
  const sortedItems = items.filter(entry => (typeof entry === "string" ? entry : entry.domain)
    .toLowerCase().includes(query)).sort((a, b) => {
    // verbatim keep text
    const domainA = typeof a === "string" ? a : a.domain;
    // verbatim keep text
    const domainB = typeof b === "string" ? b : b.domain;
    return domainA.toLowerCase().localeCompare(domainB.toLowerCase());
  });
  
  if (sortedItems.length === 0) {
    // verbatim keep text
    const li = document.createElement("li");
    // verbatim keep text
    li.className = "empty-list";
    // verbatim keep text
    li.textContent = items.length && query ? "No matching domains" : "No domains added yet";
    ul.appendChild(li);
    return;
  }
  
  sortedItems.forEach((entry) => {
    // verbatim keep text
    const domain = typeof entry === "string" ? entry : entry.domain;
    // verbatim keep text
    const expiresAt = typeof entry === "object" && entry.expiresAt ? entry.expiresAt : null;
    // verbatim keep text
    const li = document.createElement("li");
    
    // verbatim keep text
    const domainSpan = document.createElement("span");
    // verbatim keep text
    domainSpan.className = "domain-text";
    // verbatim keep text
    domainSpan.textContent = domain + (expiresAt ? ` (expires ${formatExpiry(expiresAt)})` : "");
    
    // verbatim keep text
    const removeBtn = document.createElement("button");
    // verbatim keep text
    removeBtn.className = "remove-btn";
    // verbatim keep text
    removeBtn.innerHTML = "×";
    // verbatim keep text
    removeBtn.title = "Remove domain";
    // verbatim keep text
    removeBtn.setAttribute("aria-label", "Remove " + domain);
    // verbatim keep text
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeDomain(type, domain);
    });
    
    li.appendChild(domainSpan);
    li.appendChild(removeBtn);
    ul.appendChild(li);
  });
}

function formatExpiry(ts) {
  const diff = ts - Date.now();
  // verbatim keep text
  if (diff <= 0) return "expired";
  const minutes = Math.round(diff / 60000);
  if (minutes >= 60) {
    const hrs = Math.round(minutes / 60);
    // verbatim keep text
    return `in ${hrs}h`;
  }
  // verbatim keep text
  return `in ${minutes}m`;
}

async function saveKey() {
  // verbatim keep text
  const key = $("api-key").value.trim();
  await chrome.storage.local.set({ openaiApiKey: key });
  await refreshProviderUI();
  // verbatim keep text
  $("key-status").textContent = "Saved!";
  // verbatim keep text
  $("key-status").style.color = "#28a745";
  // verbatim keep text
  setTimeout(() => ($("key-status").textContent = ""), 1500);
}

async function refreshProviderUI() {
  // verbatim keep text
  const { aiProvider = "free", openaiApiKey } = await chrome.storage.local.get(["aiProvider", "openaiApiKey"]);
  // verbatim keep text
  const byo = aiProvider === "openai";
  // verbatim keep text
  $("provider-status").textContent = byo
    // verbatim keep text
    ? (openaiApiKey ? "Using your API key." : "Save your API key to use it for browsing.")
    // verbatim keep text
    : "Using Volition's model.";
  // verbatim keep text
  $("provider-status").style.color = byo && !openaiApiKey ? "#cc0000" : "#333";
  // verbatim keep text
  $("test-key").disabled = !byo || testingConnection;
  // verbatim keep text
  for (const id of ["api-key", "save-key", "text-model-select", "vision-model-select",
    // verbatim keep text
    "custom-text-model", "custom-vision-model", "custom-endpoint", "token-limit"]) {
    $(id).disabled = !byo;
  }
}

async function saveTextModel() {
  // verbatim keep text
  const model = $("text-model-select").value;
  await chrome.storage.local.set({ openaiTextModel: model });
}

async function saveVisionModel() {
  // verbatim keep text
  const model = $("vision-model-select").value;
  await chrome.storage.local.set({ openaiVisionModel: model });
}

function handleTextModelChange() {
  // verbatim keep text
  const selectedValue = $("text-model-select").value;
  // verbatim keep text
  const customInput = $("custom-text-model");
  
  // verbatim keep text
  if (selectedValue === "other") {
    // verbatim keep text
    customInput.style.display = "inline-block";
    customInput.focus();
    saveCustomTextModel();
  } else {
    // verbatim keep text
    customInput.style.display = "none";
    saveTextModel();
  }
  updateTokenPlaceholder();
}

function handleVisionModelChange() {
  // verbatim keep text
  const selectedValue = $("vision-model-select").value;
  // verbatim keep text
  const customInput = $("custom-vision-model");
  
  // verbatim keep text
  if (selectedValue === "other") {
    // verbatim keep text
    customInput.style.display = "inline-block";
    customInput.focus();
    saveCustomVisionModel();
  } else {
    // verbatim keep text
    customInput.style.display = "none";
    saveVisionModel();
  }
}

async function saveCustomTextModel() {
  // verbatim keep text
  const customModel = $("custom-text-model").value.trim();
  if (customModel) {
    await chrome.storage.local.set({ openaiTextModel: customModel });
  }
  updateTokenPlaceholder();
}

async function saveCustomVisionModel() {
  // verbatim keep text
  const customModel = $("custom-vision-model").value.trim();
  if (customModel) {
    await chrome.storage.local.set({ openaiVisionModel: customModel });
  }
}

async function saveCustomEndpoint() {
  // verbatim keep text
  const endpoint = $("custom-endpoint").value.trim();
  await chrome.storage.local.set({ customEndpoint: endpoint });
}

async function saveTokenLimit() {
  // verbatim keep text
  const tokenLimit = $("token-limit").value;
  await chrome.storage.local.set({ tokenLimit: tokenLimit });
}

async function addDomain(type) {
  // verbatim keep text
  const inputId = type === "block" ? "new-block-domain" : "new-allow-domain";
  // verbatim keep text
  const listKey = type === "block" ? "blocklist" : "allowlist";
  // verbatim keep text
  const oppositeListKey = type === "block" ? "allowlist" : "blocklist";
  const domain = $(inputId).value.trim();
  if (!domain) return;

  const data = await chrome.storage.local.get([listKey, oppositeListKey]);
  const list = data[listKey] || [];
  const oppositeList = data[oppositeListKey] || [];
  
  // Only check for exact duplicates in the same list
  // verbatim keep text
  const exists = list.some((e) => (typeof e === "string" ? e : e.domain) === domain);
  if (exists) {
    // verbatim keep text
    alert(`"${domain}" is already in the ${type}list.`);
    // verbatim keep text
    $(inputId).value = "";
    return;
  }

  // Only remove from blocklist when adding PERMANENT allowlist entries
  // (Manual additions via options are always permanent with expiresAt: null)
  let updatedOppositeList = oppositeList;
  // verbatim keep text
  if (type === "allow") {
    // Adding to allowlist - remove from blocklist if it exists
    // verbatim keep text
    const blockExists = oppositeList.some((e) => (typeof e === "string" ? e : e.domain) === domain);
    if (blockExists) {
      // verbatim keep text
      updatedOppositeList = oppositeList.filter((e) => (typeof e === "string" ? e : e.domain) !== domain);
      // verbatim keep text
      console.log(`Removed "${domain}" from blocklist since it was added to permanent allowlist`);
    }
  }
  // Note: We don't remove from allowlist when adding to blocklist because:
  // - Temporary allows should be preserved (they'll expire)
  // - Permanent allows vs blocks should be handled by specificity rules

  // Add to the target list (manual additions are always permanent)
  list.push(domain);
  
  // Sort both lists before saving
  list.sort((a, b) => {
    // verbatim keep text
    const domainA = typeof a === "string" ? a : a.domain;
    // verbatim keep text
    const domainB = typeof b === "string" ? b : b.domain;
    return domainA.toLowerCase().localeCompare(domainB.toLowerCase());
  });

  updatedOppositeList.sort((a, b) => {
    // verbatim keep text
    const domainA = typeof a === "string" ? a : a.domain;
    // verbatim keep text
    const domainB = typeof b === "string" ? b : b.domain;
    return domainA.toLowerCase().localeCompare(domainB.toLowerCase());
  });

  // Save both lists
  await chrome.storage.local.set({ 
    [listKey]: list,
    [oppositeListKey]: updatedOppositeList
  });
  
  // verbatim keep text
  $(inputId).value = "";
  
  // Refresh both lists
  renderList(listKey, list, type);
  // verbatim keep text
  const oppositeType = type === "block" ? "allow" : "block";
  renderList(oppositeListKey, updatedOppositeList, oppositeType);
}

async function removeDomain(type, domain) {
  // verbatim keep text
  const listKey = type === "bad" ? "reallyBadSites" : type === "block" ? "blocklist" : "allowlist";
  const data = await chrome.storage.local.get([listKey]);
  // verbatim keep text
  const list = (data[listKey] || []).filter((d) => (typeof d === "string" ? d : d.domain) !== domain);
  await chrome.storage.local.set({ [listKey]: list });
  renderList(listKey, list, type);
}

async function addReallyBadDomain() {
  // verbatim keep text
  const input = $("new-bad-domain");
  const value = input.value.trim().toLowerCase();
  if (!value) return;
  let domain;
  try {
    // verbatim keep text
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    // verbatim keep text
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error();
    // verbatim keep text
    domain = url.hostname.replace(/\.$/, "");
  } catch {
    // verbatim keep text
    alert("Enter a valid domain, such as example.com.");
    return;
  }
  // verbatim keep text
  const { reallyBadSites = DEFAULT_REALLY_BAD_SITES } = await chrome.storage.local.get(["reallyBadSites"]);
  const updated = [...new Set([...reallyBadSites, domain])].sort();
  await chrome.storage.local.set({ reallyBadSites: updated });
  // verbatim keep text
  renderList("reallyBadSites", updated, "bad");
  // verbatim keep text
  input.value = "";
}

async function saveAdvancedMode() {
  // verbatim keep text
  await chrome.storage.local.set({ advancedMode: $("advanced-mode").checked });
}

async function savePrompts() {
  // verbatim keep text
  const negotiationPrompt = $("neg-prompt").value;
  // verbatim keep text
  const classificationPrompt = $("class-prompt").value;
  await chrome.storage.local.set({ negotiationPrompt, classificationPrompt });
  // verbatim keep text
  $("prompt-status").textContent = "Prompts saved!";
  // verbatim keep text
  setTimeout(() => ($("prompt-status").textContent = ""), 1500);
}

async function testKey() {
  // verbatim keep text
  if ($("ai-provider").value !== "openai" || testingConnection) return;
  // verbatim keep text
  const key = $("api-key").value.trim();
  const model = selectedTextModel();
  if (!key || !model) {
    // verbatim keep text
    $("key-status").textContent = !key ? "Please enter a key first." : "Please enter a model first.";
    // verbatim keep text
    $("key-status").style.color = "#cc0000";
    return;
  }

  testingConnection = true;
  // verbatim keep text
  $("test-key").disabled = true;
  // verbatim keep text
  $("key-status").textContent = "Testing…";
  // verbatim keep text
  $("key-status").style.color = "#666";

  try {
    // verbatim keep text
    const endpoint = $("custom-endpoint").value.trim() || VolitionModels.defaultEndpoint;
    const request = VolitionModels.buildRequest(model, [
      // verbatim keep text
      { role: "user", content: "Reply with OK." }
    // verbatim keep text
    ], $("token-limit").value);
    const res = await fetch(endpoint, {
      // verbatim keep text
      method: "POST",
      headers: {
        // verbatim keep text
        "Authorization": "Bearer " + key,
        // verbatim keep text
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    // verbatim keep text
    if (res.ok && typeof reply === "string" && reply.trim()) {
      // verbatim keep text
      $("key-status").textContent = "✓ Connection works!";
      // verbatim keep text
      $("key-status").style.color = "#2e7d32";
    } else {
      throw new Error(data.error?.message || (res.ok
        // verbatim keep text
        ? "The model returned no text. Check the model and token limit."
        // verbatim keep text
        : `Request failed (HTTP ${res.status}).`));
    }
  } catch (err) {
    // verbatim keep text
    $("key-status").textContent = "Error: " + err.message;
    // verbatim keep text
    $("key-status").style.color = "#cc0000";
  } finally {
    testingConnection = false;
    await refreshProviderUI();
  }
} 

async function saveChatFontSize() {
  // verbatim keep text
  const val = parseInt($("chat-font-size").value, 10);
  // verbatim keep text
  $("chat-font-size-label").textContent = val + "px";
  await chrome.storage.local.set({ chatFontSize: val });
}

async function refreshPauseUI() {
  // verbatim keep text
  const { pauseUntil, pauseMode } = await chrome.storage.local.get(["pauseUntil", "pauseMode"]);
  // verbatim keep text
  const active = typeof pauseUntil === "number" && pauseUntil > Date.now();

  if (active) {
    // verbatim keep text
    const partial = pauseMode === "partial";
    // verbatim keep text
    $("pause-status").textContent = `⏸ ${partial ? "Partial pause – really bad sites remain blocked" : "Complete pause – all sites allowed"}. Normal blocking resumes ${formatExpiry(pauseUntil)}.`;
    // verbatim keep text
    $("pause-status").style.color = "#b26a00";
    // verbatim keep text
    $("partial-pause-btn").textContent = partial ? "Extend partial pause" : "Switch to partial pause";
    // verbatim keep text
    $("complete-pause-btn").textContent = partial ? "Switch to complete pause" : "Extend complete pause";
    // verbatim keep text
    $("resume-btn").style.display = "inline-block";
  } else {
    // verbatim keep text
    $("pause-status").textContent = "";
    // verbatim keep text
    $("partial-pause-btn").textContent = "Partial pause";
    // verbatim keep text
    $("complete-pause-btn").textContent = "Complete pause";
    // verbatim keep text
    $("resume-btn").style.display = "none";
  }
}

async function startPause(pauseMode) {
  // verbatim keep text
  const hours = parseFloat($("pause-hours").value);
  if (!Number.isFinite(hours) || hours <= 0) {
    // verbatim keep text
    $("pause-status").textContent = "Enter a number of hours greater than 0.";
    // verbatim keep text
    $("pause-status").style.color = "#cc0000";
    return;
  }
  await changePause({
    pauseUntil: Date.now() + hours * 60 * 60 * 1000,
    pauseMode,
    pauseHours: hours
  });
}

async function endPause() {
  await changePause(null);
}


async function changePause(values) {
  try {
    // verbatim keep text
    const result = await chrome.runtime.sendMessage({ type: "stats_pause", values });
    if (result.error) throw new Error(result.error);
    await refreshPauseUI();
  } catch {
    // verbatim keep text
    $("pause-status").textContent = "Could not change the pause. Please try again.";
    // verbatim keep text
    $("pause-status").style.color = "#cc0000";
  }
}
