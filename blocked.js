const params = new URLSearchParams(window.location.search);
const originalUrl = params.get("original");

const siteInfo = document.getElementById("site-info");
const chatWindow = document.getElementById("chat-window");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const imageUpload = document.getElementById("image-upload");
const modelInfo = document.getElementById("model-info");
let currentModel = null;

siteInfo.textContent = `You attempted to visit ${originalUrl}`;

const TODAY = new Date().toISOString().split('T')[0];

// store default prompt
const DEFAULT_SYSTEM_PROMPT = `You are a strict but fair productivity assistant. Engage the user in negotiation to grant temporary access to the requested site. If their reason is legitimate, you may APPROVE. Otherwise DENY or set CONDITIONS. Respond conversationally and include "APPROVED" or "DENIED" clearly when you reach a decision.

Today is ${TODAY}. When the user uploads a proof image you will receive an ISO timestamp (e.g., 2024-07-20T15:30:00Z) and the resolution in the preceding text message. Use that timestamp to verify recency.

---- Site Classification Policy ----
• Block social media, scrolling feeds, news sites, blogs, gaming sites and sports-highlight pages by default.
• Allow search engines, scientific portals, and reference databases by default.
• For any other domain, decide which category it is closest to and apply the corresponding rule.  If clearly "always allow" (e.g., google.com) you should immediately respond with "APPROVED unlimited" without demanding proof.

---- Negotiation Guidelines ----
---- Access Decision Options (select exactly one) ----
1. Case 1 – Mis-classified/Productive: The site is genuinely productive and should ALWAYS be allowed. Respond immediately with "APPROVED unlimited".
2. Case 2 – Work-Related Task: The user has a legitimate work need. Grant only the time required to accomplish that work. DO NOT ask for photo evidence.
3. Case 3 – Productive Personal Task on Social Media: The user is using a normally distracting site for a productive but non-work purpose (e.g., selling items on Facebook Marketplace). Request and validate CLEAR photo proof of the task, then grant up to 30 minutes.
4. Case 4 – Destress / Leisure / Wasting Time: The user seeks a break or provides a weak justification. Require a photo demonstrating incremental progress on an external goal (apply the *little-one-step* principle). After valid proof, grant only 5–10 minutes of access.

Always choose exactly one of these four cases and follow its specific rules before producing your decision.

Be VERY strict. Unless there is a clear work use-case you must discover the user's real priorities or life tasks.
Ask for evidence of a *little-one-step* via a photo— the smallest concrete action showing initial progress (e.g., put on one sock if depressed ➜ next step could be running shoe ➜ then shorts, etc.).  Before assigning, check proof history so you never repeat the same task.

When you approve a proof image: Start your reply with a single concise sentence describing exactly what you observed in the photo, then write a newline, then the line containing 'APPROVED for X minutes' (or 'APPROVED unlimited'). This lets the extension store that first sentence as proof history.

No matter which category a site falls under — including social media and other entertainment-only sites — you must ALWAYS offer the user a concrete path to limited access: assign a *single, incremental productive step* (as above) and, upon receiving valid photo proof, grant exactly 5–10 minutes of access. Never deny outright without first providing this option.

After valid NEW proof grant only 5–10 minutes (pick a single value) and stand firm—no high-ball negotiations. Always specify:
1. Exact task (cannot be something already done).
2. Exact photo required so the user can prove it.
When you approve, include a separate line exactly in the format: 'APPROVED for <number> <unit>' (e.g., 'APPROVED for 30 seconds', 'APPROVED for 5 minutes', 'APPROVED for 2 hours') or 'APPROVED unlimited'. This line must follow the photo description and uses the same time units you can grant (seconds, minutes, hours, days, weeks).

If the user refuses tasks or fails to provide proof, deny access.
-----------------------------------`;

const conversation = [
  {
    role: "system",
    content: DEFAULT_SYSTEM_PROMPT
  },
  {
    role: "user",
    content: `I am attempting to visit: ${originalUrl}`
  }
];

// merge override
chrome.storage.local.get(["negotiationPrompt", "classificationPrompt"], (res) => {
  if (res.negotiationPrompt) {
    conversation[0].content = `${DEFAULT_SYSTEM_PROMPT}\n\nUser override directives:\n${res.negotiationPrompt}`;
  }
  if (res.classificationPrompt) {
    conversation[0].content += `\n\nAdditional site-classification override directives:\n${res.classificationPrompt}`;
  }
});

chrome.storage.local.get(["openaiApiKey"], (d) => {
  if (!d.openaiApiKey) {
    modelInfo.textContent = "⚠️ API key not set – open Settings to add it.";
    modelInfo.style.color = "#cc0000";
  }
});

// fetch history
let proofHistory = [];
chrome.storage.local.get(["proofHistory"], (res) => {
  proofHistory = Array.isArray(res.proofHistory) ? res.proofHistory : [];
  if (proofHistory.length) {
    const lines = proofHistory
      .slice(-20)
      .reverse()
      .map((e, idx) => `${idx + 1}. ${e.desc} (timestamp ${e.timestamp})`)
      .join("\n");
    conversation[0].content += `\n\nPrevious proof history (most recent first, max 20):\n${lines}`;
  }
});

let lastImageMeta = null; // {timestamp, desc}

function parseDuration(text) {
  const lower = text.toLowerCase();
  if (/unlimited|indefinite|permanent/.test(lower)) return null;

  const secMatch = lower.match(/(\d+)\s*(second|seconds|sec|secs)/);
  if (secMatch) return parseInt(secMatch[1], 10) * 1000;

  const minMatch = lower.match(/(\d+)\s*(minute|min|minutes)/);
  if (minMatch) return parseInt(minMatch[1], 10) * 60 * 1000;

  const hrMatch = lower.match(/(\d+)\s*(hour|hours|hr|hrs)/);
  if (hrMatch) return parseInt(hrMatch[1], 10) * 60 * 60 * 1000;

  const dayMatch = lower.match(/(\d+)\s*(day|days)/);
  if (dayMatch) return parseInt(dayMatch[1], 10) * 24 * 60 * 60 * 1000;

  const weekMatch = lower.match(/(\d+)\s*(week|weeks)/);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7 * 24 * 60 * 60 * 1000;

  return 60 * 60 * 1000; // fallback 1 hour in ms
}

function appendMessage(role, content) {
  const div = document.createElement("div");
  div.className = `bubble ${role === "user" ? "user-msg" : "assistant-msg"}`;
  div.textContent = content;
  div.dir = "auto";
  if (/[  -  ]/.test(content)) {
    // leave as textContent already
  }
  // Detect Hebrew characters and tag for stronger font styling
  if (/[ 90-\u05FF]/.test(content)) {
    div.classList.add("he-text");
  }
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Toggle Hebrew styling on textarea as user types
userInput.addEventListener("input", () => {
  if (/[\u0590-\u05FF]/.test(userInput.value)) {
    userInput.classList.add("he-text");
  } else {
    userInput.classList.remove("he-text");
  }
});

sendBtn.addEventListener("click", async () => {
  const text = userInput.value.trim();
  if (!text && !imageUpload.files[0]) return;

  if (text) {
    conversation.push({ role: "user", content: text });
    appendMessage("user", text);
  }

  if (imageUpload.files[0]) {
    const file = imageUpload.files[0];
    const imgData = await fileToBase64(file);
    const ts = new Date(file.lastModified || Date.now()).toISOString();
    lastImageMeta = { timestamp: ts, desc: "(pending)" };
    conversation.push({
      role: "user",
      content: [
        { type: "text", text: `Proof image (timestamp ${ts}, ${imgData.width}×${imgData.height})` },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imgData.data}` } }
      ]
    });
    appendMessage("user", "[Image uploaded]");
    imageUpload.value = "";
    document.getElementById("upload-label").textContent = "📷 Upload Image";
  }

  userInput.value = "";
  sendBtn.disabled = true;
  appendMessage("assistant", "[Thinking…]");
  const loadingIndex = chatWindow.children.length - 1;

  const response = await chrome.runtime.sendMessage({
    type: "chatgpt",
    messages: conversation
  });

  console.log("Received response:", response);
  sendBtn.disabled = false;

  if (response.error) {
    console.error("Response error:", response.error);
    chatWindow.children[loadingIndex].remove();
    appendMessage("assistant", "Error: " + response.error);
    return;
  }

  chatWindow.children[loadingIndex].remove();

  if (response.reply && response.reply.content) {
    console.log("Processing reply:", response.reply);
    const reply = response.reply;
    if (response.model) {
       currentModel = response.model;
       modelInfo.textContent = `Model: ${currentModel}`;
       modelInfo.style.color = "#666";
     }
    conversation.push(reply);
    appendMessage("assistant", reply.content);

    if (reply.content.toLowerCase().includes("approved")) {
      let domain = null;
      try {
        domain = new URL(originalUrl).hostname;
      } catch (_) {}

      const durationMs = parseDuration(reply.content);
      const expiresAt = durationMs ? Date.now() + durationMs : null;

      // Build proof entry (always record one, with or without image)
      const firstSentence = reply.content.split(/\n/)[0].trim();
      const baseEntry = {
        timestamp: new Date().toISOString(),
        url: originalUrl,
        domain: domain || null,
        approvedMs: durationMs || null,
        approvedUntil: expiresAt || null,
        model: currentModel || null,
        hadImage: !!lastImageMeta,
        desc: (firstSentence.replace(/^APPROVED[^:]*:?/i, "").trim().substring(0, 140) || "User task completed")
      };

      if (lastImageMeta) {
        // Merge any prior image metadata (e.g., upload timestamp)
        baseEntry.imageTimestamp = lastImageMeta.timestamp;
      }

      proofHistory.push(baseEntry);
      while (proofHistory.length > 20) proofHistory.shift();
      chrome.storage.local.set({ proofHistory });
      lastImageMeta = null;

      if (domain) {
        await chrome.runtime.sendMessage({ type: "allow_domain", domain, expiresAt });
      }
      window.location.href = originalUrl;
    }
  } else {
    console.warn("Unexpected response structure:", response);
    if (response && typeof response === 'object') {
      // Try to extract any content from the response
      const content = response.content || response.message?.content || response.choices?.[0]?.message?.content;
      if (content) {
        console.log("Found content in alternative structure:", content);
        appendMessage("assistant", content);
        return;
      }
    }
    appendMessage("assistant", "Sorry, I didn't receive a response. Please try again.");
  }
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

if (!chrome.runtime) {
  appendMessage("assistant", "Extension context not available. Make sure this page is opened via the extension.");
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 256; // stronger downscale
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        resolve({ data: dataUrl.split(",")[1], width: canvas.width, height: canvas.height });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

imageUpload.addEventListener("change",()=>{
  if(imageUpload.files[0]){
    document.getElementById("upload-label").textContent="Image selected✔";
  } else {
    document.getElementById("upload-label").textContent="📷 Upload Image";
  }
}); 