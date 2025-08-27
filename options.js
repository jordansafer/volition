document.addEventListener("DOMContentLoaded", init);

function $(id) {
  return document.getElementById(id);
}

async function init() {
  const data = await chrome.storage.local.get([
    "openaiApiKey",
    "blocklist",
    "allowlist",
    "advancedMode",
    "negotiationPrompt",
    "classificationPrompt",
    "openaiModel", // legacy single model
    "openaiTextModel",
    "openaiVisionModel",
    "customTextModel",
    "customVisionModel",
    "customEndpoint",
    "tokenLimit"
  ]);

  $("api-key").value = data.openaiApiKey || "";
  if (!data.openaiApiKey) {
    $("key-status").textContent = "⚠️ No API key saved – chat will not work.";
    $("key-status").style.color = "#cc0000";
  }
  $("advanced-mode").checked = data.advancedMode || false;

  // Handle text model selection
  const textModel = data.openaiTextModel || data.openaiModel || "gpt-3.5-turbo";
  const isCustomText = !["gpt-3.5-turbo", "gpt-4o-mini", "gpt-4o", "gpt-o3"].includes(textModel);
  if (isCustomText) {
    $("text-model-select").value = "other";
    $("custom-text-model").value = textModel;
    $("custom-text-model").style.display = "inline-block";
  } else {
    $("text-model-select").value = textModel;
  }

  // Handle vision model selection  
  const visionModel = data.openaiVisionModel || "gpt-4o-mini";
  const isCustomVision = !["gpt-4o-mini", "gpt-4o", "gpt-o3"].includes(visionModel);
  if (isCustomVision) {
    $("vision-model-select").value = "other";
    $("custom-vision-model").value = visionModel;
    $("custom-vision-model").style.display = "inline-block";
  } else {
    $("vision-model-select").value = visionModel;
  }

  $("custom-endpoint").value = data.customEndpoint || "";
  $("token-limit").value = data.tokenLimit || 300;
  $("neg-prompt").value = data.negotiationPrompt || "";
  $("class-prompt").value = data.classificationPrompt || "";

  renderList("blocklist", data.blocklist || [], "block");
  renderList("allowlist", data.allowlist || [], "allow");

  $("save-key").addEventListener("click", saveKey);
  $("add-block").addEventListener("click", () => addDomain("block"));
  $("add-allow").addEventListener("click", () => addDomain("allow"));
  $("advanced-mode").addEventListener("change", saveAdvancedMode);
  $("text-model-select").addEventListener("change", handleTextModelChange);
  $("vision-model-select").addEventListener("change", handleVisionModelChange);
  $("custom-text-model").addEventListener("input", saveCustomTextModel);
  $("custom-vision-model").addEventListener("input", saveCustomVisionModel);
  $("custom-endpoint").addEventListener("input", saveCustomEndpoint);
  $("token-limit").addEventListener("input", saveTokenLimit);
  $("save-prompts").addEventListener("click", savePrompts);
  $( "test-key" ).addEventListener("click", testKey);
}

function renderList(listId, items, type) {
  const ul = $(listId);
  ul.innerHTML = "";
  
  // Sort items alphabetically
  const sortedItems = [...items].sort((a, b) => {
    const domainA = typeof a === "string" ? a : a.domain;
    const domainB = typeof b === "string" ? b : b.domain;
    return domainA.toLowerCase().localeCompare(domainB.toLowerCase());
  });
  
  if (sortedItems.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-list";
    li.textContent = "No domains added yet";
    ul.appendChild(li);
    return;
  }
  
  sortedItems.forEach((entry) => {
    const domain = typeof entry === "string" ? entry : entry.domain;
    const expiresAt = typeof entry === "object" && entry.expiresAt ? entry.expiresAt : null;
    const li = document.createElement("li");
    
    const domainSpan = document.createElement("span");
    domainSpan.className = "domain-text";
    domainSpan.textContent = domain + (expiresAt ? ` (expires ${formatExpiry(expiresAt)})` : "");
    
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.innerHTML = "×";
    removeBtn.title = "Remove domain";
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
  if (diff <= 0) return "expired";
  const minutes = Math.round(diff / 60000);
  if (minutes >= 60) {
    const hrs = Math.round(minutes / 60);
    return `in ${hrs}h`;
  }
  return `in ${minutes}m`;
}

async function saveKey() {
  const key = $("api-key").value.trim();
  await chrome.storage.local.set({ openaiApiKey: key });
  $("key-status").textContent = "Saved!";
  $("key-status").style.color = "#28a745";
  setTimeout(() => ($("key-status").textContent = ""), 1500);
}

async function saveTextModel() {
  const model = $("text-model-select").value;
  await chrome.storage.local.set({ openaiTextModel: model });
}

async function saveVisionModel() {
  const model = $("vision-model-select").value;
  await chrome.storage.local.set({ openaiVisionModel: model });
}

function handleTextModelChange() {
  const selectedValue = $("text-model-select").value;
  const customInput = $("custom-text-model");
  
  if (selectedValue === "other") {
    customInput.style.display = "inline-block";
    customInput.focus();
  } else {
    customInput.style.display = "none";
    saveTextModel();
  }
}

function handleVisionModelChange() {
  const selectedValue = $("vision-model-select").value;
  const customInput = $("custom-vision-model");
  
  if (selectedValue === "other") {
    customInput.style.display = "inline-block";
    customInput.focus();
  } else {
    customInput.style.display = "none";
    saveVisionModel();
  }
}

async function saveCustomTextModel() {
  const customModel = $("custom-text-model").value.trim();
  if (customModel) {
    await chrome.storage.local.set({ openaiTextModel: customModel });
  }
}

async function saveCustomVisionModel() {
  const customModel = $("custom-vision-model").value.trim();
  if (customModel) {
    await chrome.storage.local.set({ openaiVisionModel: customModel });
  }
}

async function saveCustomEndpoint() {
  const endpoint = $("custom-endpoint").value.trim();
  await chrome.storage.local.set({ customEndpoint: endpoint });
}

async function saveTokenLimit() {
  const tokenLimit = $("token-limit").value;
  await chrome.storage.local.set({ tokenLimit: tokenLimit });
}

async function addDomain(type) {
  const inputId = type === "block" ? "new-block-domain" : "new-allow-domain";
  const listKey = type === "block" ? "blocklist" : "allowlist";
  const oppositeListKey = type === "block" ? "allowlist" : "blocklist";
  const domain = $(inputId).value.trim();
  if (!domain) return;

  const data = await chrome.storage.local.get([listKey, oppositeListKey]);
  const list = data[listKey] || [];
  const oppositeList = data[oppositeListKey] || [];
  
  // Only check for exact duplicates in the same list
  const exists = list.some((e) => (typeof e === "string" ? e : e.domain) === domain);
  if (exists) {
    alert(`"${domain}" is already in the ${type}list.`);
    $(inputId).value = "";
    return;
  }

  // Only remove from blocklist when adding PERMANENT allowlist entries
  // (Manual additions via options are always permanent with expiresAt: null)
  let updatedOppositeList = oppositeList;
  if (type === "allow") {
    // Adding to allowlist - remove from blocklist if it exists
    const blockExists = oppositeList.some((e) => (typeof e === "string" ? e : e.domain) === domain);
    if (blockExists) {
      updatedOppositeList = oppositeList.filter((e) => (typeof e === "string" ? e : e.domain) !== domain);
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
    const domainA = typeof a === "string" ? a : a.domain;
    const domainB = typeof b === "string" ? b : b.domain;
    return domainA.toLowerCase().localeCompare(domainB.toLowerCase());
  });

  updatedOppositeList.sort((a, b) => {
    const domainA = typeof a === "string" ? a : a.domain;
    const domainB = typeof b === "string" ? b : b.domain;
    return domainA.toLowerCase().localeCompare(domainB.toLowerCase());
  });

  // Save both lists
  await chrome.storage.local.set({ 
    [listKey]: list,
    [oppositeListKey]: updatedOppositeList
  });
  
  $(inputId).value = "";
  
  // Refresh both lists
  renderList(listKey, list, type);
  const oppositeType = type === "block" ? "allow" : "block";
  renderList(oppositeListKey, updatedOppositeList, oppositeType);
}

async function removeDomain(type, domain) {
  const listKey = type === "block" ? "blocklist" : "allowlist";
  const data = await chrome.storage.local.get([listKey]);
  const list = (data[listKey] || []).filter((d) => (typeof d === "string" ? d : d.domain) !== domain);
  await chrome.storage.local.set({ [listKey]: list });
  renderList(listKey, list, type);
}

async function saveAdvancedMode() {
  await chrome.storage.local.set({ advancedMode: $("advanced-mode").checked });
}

async function savePrompts() {
  const negotiationPrompt = $("neg-prompt").value;
  const classificationPrompt = $("class-prompt").value;
  await chrome.storage.local.set({ negotiationPrompt, classificationPrompt });
  $("prompt-status").textContent = "Prompts saved!";
  setTimeout(() => ($("prompt-status").textContent = ""), 1500);
}

async function testKey() {
  const key = $("api-key").value.trim();
  if (!key) {
    $("key-status").textContent = "Please enter a key first.";
    $("key-status").style.color = "#cc0000";
    return;
  }

  $("test-key").disabled = true;
  $("key-status").textContent = "Testing…";
  $("key-status").style.color = "#666";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a ping responder." },
          { role: "user", content: "ping" }
        ],
        max_tokens: 1
      })
    });

    const data = await res.json();
    if (res.ok && data.choices && data.choices.length) {
      $("key-status").textContent = "✓ Key works!";
      $("key-status").style.color = "#2e7d32";
    } else {
      throw new Error(data.error?.message || "Unknown response");
    }
  } catch (err) {
    $("key-status").textContent = "Error: " + err.message;
    $("key-status").style.color = "#cc0000";
  } finally {
    $("test-key").disabled = false;
  }
} 