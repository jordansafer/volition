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
    content:
      "You are a strict but fair productivity assistant. Engage the user in negotiation to grant temporary access to the requested site. If their reason is legitimate, you may APPROVE. Otherwise DENY or set CONDITIONS. Respond conversationally and include \"APPROVED\" or \"DENIED\" clearly when you reach a decision."
  }
];

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
      content: `User uploaded image as proof: data:${file.type};base64,${base64}`
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
      await chrome.runtime.sendMessage({ type: "allow_domain", domain });
      window.location.href = originalUrl;
    }
  } else {
    appendMessage("assistant", "Sorry, I didn't receive a response. Please try again.");
  }
});

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
} 