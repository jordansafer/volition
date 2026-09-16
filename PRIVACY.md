# Volition – Privacy Policy

_Last updated: 2026-09-16_

Volition ("the Extension") stores settings in your browser and sends negotiation requests to the provider you select.

## 1. Information We Collect
Negotiation requests include the blocked URL, conversation, prompts, and any image proofs and proof-history context included in the conversation.

The only data handled are:

| Data | Where stored | Purpose | Shared with |
|------|--------------|---------|-------------|
| Your OpenAI API key (optional) | `chrome.storage.local` | Authenticates BYO requests | Sent only to OpenAI or your configured endpoint in BYO mode; never to Volition Free |
| Conversations, image proofs, and proof-history context | Conversation in memory; proof history in local storage | Provide negotiation | Volition Free hosted backend, or OpenAI / your custom endpoint in BYO mode |
| Block-list / allow-list / settings | `chrome.storage.local` | Configure the extension | **Never** |

## 2. How We Use Information
Data is used **only** to:
1. Decide whether to block or allow a site.
2. Facilitate your conversation with OpenAI’s ChatGPT models.

We do **not** use analytics, advertising, or any third-party trackers.

## 3. Data Sharing
Volition Free sends negotiation content to `https://volition-free-api-jordansafers-projects.vercel.app/api/negotiate` for AI processing. My OpenAI API key mode sends requests directly to OpenAI or your configured endpoint. Automatic domain classification is available only in BYO mode. The extension does not use analytics or advertising trackers.

## 4. Data Retention & Deletion
Uninstalling the extension or clearing Chrome’s extension data deletes locally stored settings and proof history. This does not delete content already sent to a provider. Remote processing and retention depend on the selected service; the extension cannot enforce remote deletion.

## 5. Security
Chrome’s extension storage is sandboxed per user profile. All network requests use TLS 1.2+. No remote code is executed.

## 6. Children’s Privacy
The Extension is not directed to children under 13 and does not knowingly collect information from children.

---

© 2024 Volition. All rights reserved.
