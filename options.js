document.addEventListener("DOMContentLoaded", init);

function $(id) {
  return document.getElementById(id);
}

async function init() {
  const data = await chrome.storage.local.get([
    "openaiApiKey",
    "blocklist",
    "allowlist",
    "advancedMode"
  ]);

  $("api-key").value = data.openaiApiKey || "";
  if (!data.openaiApiKey) {
    $("key-status").textContent = "⚠️ No API key saved – chat will not work.";
    $("key-status").style.color = "#cc0000";
  }
  $("advanced-mode").checked = data.advancedMode || false;

  renderList("blocklist", data.blocklist || [], "block");
  renderList("allowlist", data.allowlist || [], "allow");

  $("save-key").addEventListener("click", saveKey);
  $("add-block").addEventListener("click", () => addDomain("block"));
  $("add-allow").addEventListener("click", () => addDomain("allow"));
  $("advanced-mode").addEventListener("change", saveAdvancedMode);
  $( "test-key" ).addEventListener("click", testKey);
}

function renderList(listId, items, type) {
  const ul = $(listId);
  ul.innerHTML = "";
  items.forEach((domain) => {
    const li = document.createElement("li");
    li.textContent = domain;
    li.style.cursor = "pointer";
    li.title = "Click to remove";
    li.addEventListener("click", () => removeDomain(type, domain));
    ul.appendChild(li);
  });
}

async function saveKey() {
  const key = $("api-key").value.trim();
  await chrome.storage.local.set({ openaiApiKey: key });
  $("key-status").textContent = "Saved!";
  setTimeout(() => ($("key-status").textContent = ""), 1500);
}

async function addDomain(type) {
  const inputId = type === "block" ? "new-block-domain" : "new-allow-domain";
  const listKey = type === "block" ? "blocklist" : "allowlist";
  const domain = $(inputId).value.trim();
  if (!domain) return;

  const data = await chrome.storage.local.get([listKey]);
  const list = data[listKey] || [];
  if (!list.includes(domain)) {
    list.push(domain);
    await chrome.storage.local.set({ [listKey]: list });
  }
  $(inputId).value = "";
  renderList(listKey, list, type);
}

async function removeDomain(type, domain) {
  const listKey = type === "block" ? "blocklist" : "allowlist";
  const data = await chrome.storage.local.get([listKey]);
  const list = (data[listKey] || []).filter((d) => d !== domain);
  await chrome.storage.local.set({ [listKey]: list });
  renderList(listKey, list, type);
}

async function saveAdvancedMode() {
  await chrome.storage.local.set({ advancedMode: $("advanced-mode").checked });
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