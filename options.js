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
    "openaiVisionModel"
  ]);

  $("api-key").value = data.openaiApiKey || "";
  if (!data.openaiApiKey) {
    $("key-status").textContent = "⚠️ No API key saved – chat will not work.";
    $("key-status").style.color = "#cc0000";
  }
  $("advanced-mode").checked = data.advancedMode || false;

  $("text-model-select").value = data.openaiTextModel || data.openaiModel || "gpt-3.5-turbo";
  $("vision-model-select").value = data.openaiVisionModel || "gpt-4o-mini";

  $("neg-prompt").value = data.negotiationPrompt || "";
  $("class-prompt").value = data.classificationPrompt || "";

  renderList("blocklist", data.blocklist || [], "block");
  renderList("allowlist", data.allowlist || [], "allow");

  $("save-key").addEventListener("click", saveKey);
  $("add-block").addEventListener("click", () => addDomain("block"));
  $("add-allow").addEventListener("click", () => addDomain("allow"));
  $("advanced-mode").addEventListener("change", saveAdvancedMode);
  $("text-model-select").addEventListener("change", saveTextModel);
  $("vision-model-select").addEventListener("change", saveVisionModel);
  $("save-prompts").addEventListener("click", savePrompts);
  $( "test-key" ).addEventListener("click", testKey);
}

function renderList(listId, items, type) {
  const ul = $(listId);
  ul.innerHTML = "";
  items.forEach((entry) => {
    const domain = typeof entry === "string" ? entry : entry.domain;
    const expiresAt = typeof entry === "object" && entry.expiresAt ? entry.expiresAt : null;
    const li = document.createElement("li");
    li.textContent = domain + (expiresAt ? ` (expires ${formatExpiry(expiresAt)})` : "");
    li.style.cursor = "pointer";
    li.title = "Click to remove";
    li.addEventListener("click", () => removeDomain(type, domain));
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

async function addDomain(type) {
  const inputId = type === "block" ? "new-block-domain" : "new-allow-domain";
  const listKey = type === "block" ? "blocklist" : "allowlist";
  const domain = $(inputId).value.trim();
  if (!domain) return;

  const data = await chrome.storage.local.get([listKey]);
  const list = data[listKey] || [];
  const exists = list.some((e) => (typeof e === "string" ? e : e.domain) === domain);
  if (!exists) {
    list.push(domain);
  }
  $(inputId).value = "";
  renderList(listKey, list, type);
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