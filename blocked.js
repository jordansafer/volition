const params = new URLSearchParams(window.location.search);
const originalUrl = params.get("original");

const siteInfo = document.getElementById("site-info");
const chatWindow = document.getElementById("chat-window");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const imageUpload = document.getElementById("image-upload");

siteInfo.textContent = `You attempted to visit ${originalUrl}`;

const conversation = [
  {
    role: "system",
    content: `You are a strict but fair productivity assistant. Engage the user in negotiation to grant temporary access to the requested site. If their reason is legitimate, you may APPROVE. Otherwise DENY or set CONDITIONS. Respond conversationally and include "APPROVED" or "DENIED" clearly when you reach a decision.

When approving, explicitly state the allowed time, e.g. 'APPROVED for 5 minutes', 'APPROVED for 2 hours', or 'APPROVED unlimited'. Use whole numbers.`
  }
];

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
  div.className = role;
  div.textContent = `${role === "user" ? "You" : "GPT"}: ${content}`;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

sendBtn.addEventListener("click", async () => {
  const text = userInput.value.trim();
  if (!text && !imageUpload.files[0]) return;

  if (text) {
    conversation.push({ role: "user", content: text });
    appendMessage("user", text);
  }

  if (imageUpload.files[0]) {
    const file = imageUpload.files[0];
    const base64 = await fileToBase64(file);
    conversation.push({
      role: "user",
      content: [
        { type: "text", text: "Proof image:" },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
      ]
    });
    appendMessage("user", "[Image uploaded]");
    imageUpload.value = "";
  }

  userInput.value = "";
  sendBtn.disabled = true;
  appendMessage("assistant", "[Thinking…]");
  const loadingIndex = chatWindow.children.length - 1;

  const response = await chrome.runtime.sendMessage({
    type: "chatgpt",
    messages: conversation
  });

  sendBtn.disabled = false;

  if (response.error) {
    chatWindow.children[loadingIndex].remove();
    appendMessage("assistant", "Error: " + response.error);
    return;
  }

  chatWindow.children[loadingIndex].remove();

  if (response.reply && response.reply.content) {
    const reply = response.reply;
    conversation.push(reply);
    appendMessage("assistant", reply.content);

    if (reply.content.toLowerCase().includes("approved")) {
      const domain = new URL(originalUrl).hostname;
      const durationMs = parseDuration(reply.content);
      const expiresAt = durationMs ? Date.now() + durationMs : null;
      await chrome.runtime.sendMessage({ type: "allow_domain", domain, expiresAt });
      window.location.href = originalUrl;
    }
  } else {
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
        resolve(dataUrl.split(",")[1]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
} 