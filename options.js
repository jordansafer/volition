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
  $("advanced-mode").checked = data.advancedMode || false;

  renderList("blocklist", data.blocklist || [], "block");
  renderList("allowlist", data.allowlist || [], "allow");

  $("save-key").addEventListener("click", saveKey);
  $("add-block").addEventListener("click", () => addDomain("block"));
  $("add-allow").addEventListener("click", () => addDomain("allow"));
  $("advanced-mode").addEventListener("change", saveAdvancedMode);
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