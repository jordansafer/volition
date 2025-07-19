# GPT Focus Blocker – Privacy Policy

_Last updated: 2024-07-19_

GPT Focus Blocker ("the Extension") runs entirely in your browser. We take privacy seriously and follow the Chrome Web Store **User Data Policy**.

## 1. Information We Collect
The Extension **does not** collect, log, or transmit any personal information such as name, email address, browsing history, or cookies.

The only data handled are:

| Data | Where stored | Purpose | Shared with |
|------|--------------|---------|-------------|
| Your OpenAI API key (optional) | `chrome.storage.local` (encrypted at rest by Chrome) | Authenticates your prompts with OpenAI | **Never** |
| Prompts & replies exchanged with ChatGPT | In-memory during each chat | Provide the negotiation feature | Sent **directly** to `api.openai.com` via HTTPS using your own key |
| Block-list / allow-list / settings | `chrome.storage.local` | Configure the extension | **Never** |

## 2. How We Use Information
Data is used **only** to:
1. Decide whether to block or allow a site.
2. Facilitate your conversation with OpenAI’s ChatGPT models.

We do **not** use analytics, advertising, or any third-party trackers.

## 3. Data Sharing
We share **nothing** with anyone.
When you send a prompt, the content is transmitted straight to OpenAI servers under your account; it never touches our servers.

## 4. Data Retention & Deletion
All data lives locally in your browser profile.
Uninstalling the extension or clearing Chrome’s extension data permanently deletes it.

## 5. Security
Chrome’s extension storage is sandboxed per user profile. All network requests use TLS 1.2+. No remote code is executed.

## 6. Children’s Privacy
The Extension is not directed to children under 13 and does not knowingly collect information from children.

## 7. Contact
Questions? Email **you@example.com**.

---

© 2024 GPT Focus Blocker. All rights reserved. 