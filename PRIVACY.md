# Volition – Privacy Policy

_Last updated: 2026-09-17_

Volition blocks distracting websites and uses AI to negotiate access. Settings and access records are stored in your browser. AI features send information to the service selected in Settings.

## Free mode and data sharing

New installations without a saved API key default to Volition Free. Existing saved mode choices are preserved; upgrades with a saved key but no mode retain BYO mode.

Free requests are sent over HTTPS to:
`https://volition-free-api-jordansafers-projects.vercel.app/api/negotiate`

When you send a negotiation message, the extension sends the current conversation, including:

- The full URL of the blocked page, including any path, query string, or fragment present in that URL.
- Your messages, previous AI replies, built-in instructions, and your custom negotiation and classification prompts.
- Images you choose to upload, converted to JPEG with a maximum dimension of 256 pixels, plus their dimensions and a file modification timestamp (or current time).
- Descriptions and timestamps from up to 20 previous approvals, included as context to avoid repeating tasks. These descriptions can contain information about your activities.

If you enable advanced classification (off by default), unmatched website hostnames and the classification instructions are sent to the selected service to decide whether to block or allow them. This does not send the visited page's body or the entire blocklist. Ordinary list matching and pauses do not require AI requests.

The Free service is hosted on Vercel. Its handler validates the supplied messages and forwards their role and text/image content to OpenAI's Chat Completions API using the `gpt-4o-mini` model and a server-side API key. URLs, prompts, approval summaries, and image metadata embedded in the messages are included. The extension does not send your saved API key, an account ID, a tracking ID, or a device fingerprint. The handler does not add the visitor's IP address or incoming HTTP headers to the model request. It returns the assistant's text, model name, and usage counts to the extension.

The backend handler has no database or file writes and does not explicitly log successful requests, prompts, images, or replies. It processes these in memory. On an OpenAI request failure, it writes the full error object to the server console; the contents depend on the error and are not sanitized by the handler. This is error logging, not routine logging of conversation text.

Network requests expose connection information such as the source IP address and HTTP request metadata to the receiving infrastructure. Vercel supports request/runtime logs that can contain paths, timestamps, status codes, request identifiers, and application console output, including the error logging above. Using Vercel does not by itself establish that request bodies are logged. Actual platform logging fields, IP-derived processing, log drains, and retention require checking the Vercel project/account settings; the supplied configuration only sets the function duration. See [Vercel runtime logs](https://vercel.com/docs/logs/runtime). OpenAI's processing and retention are separate from the backend handler's lack of application storage.

## Optional BYO API-key mode

In **My OpenAI API key** mode, your key is stored in `chrome.storage.local` in your browser profile. Negotiation and classification requests go directly from the extension to `https://api.openai.com/v1/chat/completions`, or to the custom compatible endpoint you configure. They do not pass through the Volition Free backend.

The selected endpoint receives the key in an Authorization header, the relevant messages described above, and model/token settings. The **Test** button sends your entered key and a short test prompt directly to OpenAI, even if a custom endpoint is configured. Testing is disabled in Free mode. Switching modes does not delete the key. The custom endpoint controls who receives it; use only a service you trust.

## Local extension data

The extension stores the following in `chrome.storage.local` (not Chrome sync storage):

- Blocklist, allowlist, really-bad-sites list, and access expiry timestamps. Automatic classification may add domains to the lists.
- Selected AI mode, optional API key, models, custom endpoint, token limit, custom prompts, classification toggle, chat font size, and pause mode/duration/expiry.
- Up to 20 approval records: URL/domain, approval time and duration/expiry, model label, a short AI response excerpt, whether an image was supplied, and its timestamp when applicable. Raw proof images are not saved in this history.
- Usage totals by model/service and up to 100 recent API activity records containing timestamps, request type, model/service, and token counts. These statistics are local; there is no analytics upload in the extension code.

The ongoing conversation and uploaded image data are held in the blocked page's memory and sent again with subsequent messages in that conversation. The extension does not save full transcripts or raw images to local storage. Approval excerpts and URLs do persist as described above. Diagnostic console messages can include AI replies, errors, domains, and endpoint/model information; browser developer tools may retain those messages during debugging.

## Analytics, cookies, and website access

The extension code contains no advertising, tracking SDK, remote analytics, account registration, fingerprinting, or cookie-reading/writing functionality. It reads tab URLs to enforce blocking and injects a countdown display on temporarily allowed pages. It does not scrape website text or automatically capture screenshots; image proofs are selected by you. This describes the extension code, not a guarantee about hosting or provider logs or their separate websites.

## Retention and deletion

Settings and lists remain until changed or the extension's local data is cleared. The history limits above remove the oldest records when new ones are added. **Reset statistics** clears usage totals and API activity history, but does not clear approval history, settings, or keys. You can remove your key by saving an empty key field. Uninstalling the extension or clearing its local data removes locally stored records. Expired access rules are checked during browsing; expiry does not necessarily immediately erase every stored timestamp.

Deleting local data does not delete previously transmitted requests or remote logs. Remote storage, retention, training use, and deletion controls depend on the Volition backend, Vercel, OpenAI, or your chosen provider; the extension cannot enforce remote deletion. No fixed remote retention period or zero-retention guarantee has been verified from this repository.

## Security

The built-in Free and OpenAI endpoints use HTTPS. A custom endpoint is user-configurable and is not restricted by the extension to HTTPS; choose HTTPS to protect transmitted messages and keys. Chrome isolates extension storage, but the extension does not add encryption to stored API keys. Do not include information in URLs, messages, or proof images that you do not want sent to the selected service. AI replies are treated as data; the extension does not download or execute AI-generated code.
