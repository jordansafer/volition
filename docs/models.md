# Model settings

Reviewed against official model documentation on 2026-09-28.

Volition uses Chat Completions for text negotiation, optional hostname classification, and uploaded image-proof review. The image model needs image **input** and text output; image-generation-only models are not suitable. Hostname classification does not perform a web search.

## Current choices

| API model ID | Use in Volition | Official reference |
| --- | --- | --- |
| `gpt-6-luna` | Default for new text and image model settings; medium reasoning | [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) |
| `gpt-6-sol` | Text and image input | [GPT-6 Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) |

The two suggested choices display their exact API IDs: `gpt-6-luna ($)` (default) and `gpt-6-sol ($$)`. Cost markers are broad relative tiers based on standard short-context token rates, checked against [official pricing](https://developers.openai.com/api/docs/pricing) on 2026-09-29: Luna $0.10/$0.50 and Sol $2/$10 per million input/output tokens. Actual charges depend on usage and provider. Existing saved Astra or GPT-5.4 Mini IDs remain available through the custom field.

Model and endpoint availability depend on the user's provider/account. The hosted Volition backend has its own model configuration and is not changed by the extension's model menus.

## Compatibility

- Keep existing storage keys and connection values (`free` and `openai`) for compatibility; Settings displays these as **Volition** and **My API key**.
- Existing saved model IDs, keys, endpoints, prompts, and token limits are retained. Upgrades pin previously implicit model defaults so a new default does not silently change existing users' requests.
- `gpt-3.5-turbo`, `gpt-4o-mini`, `gpt-4o`, and `gpt-o3` remain selectable with **(legacy)** labels. Here “legacy” means an older Volition menu choice, not necessarily provider deprecation. `gpt-o3` is preserved exactly as the old menu stored it; this does not claim it is a valid OpenAI model ID.
- Unknown saved IDs remain in the custom model field. Selecting a modern model is an explicit user choice.
- Settings, connection testing, and the service worker share the same request builder. IDs matching supported GPT-5/6 and o-series patterns use `max_completion_tokens`; unrecognized IDs use `max_tokens`. Existing substring matching is retained for custom and provider-prefixed IDs. GPT-6 Luna explicitly uses medium reasoning. Other model IDs keep their provider's reasoning default.
- A saved token limit takes precedence. Otherwise reasoning models receive 4096 tokens and other models 300. Reasoning consumes this budget as well as the visible answer; see [token counting](https://developers.openai.com/api/docs/guides/token-counting). An empty answer is reported as an error rather than a successful connection or a classification that permanently allows the site.
- **Test connection** uses the current form values, including a custom endpoint, and checks for a nonempty text response. It does not save an unsaved key or silently retry against another provider.
