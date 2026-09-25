# Chrome Web Store listing copy

This file is the repository source for the English listing text. The extension ZIP supplies the manifest name and summary. The detailed description and privacy fields live in the Chrome Web Store Developer Dashboard and must be updated there manually before pushing a release tag. Tag pushes automatically upload and submit the ZIP for review; the workflow does not sync Dashboard text or assets. Review existing screenshots and video in the Dashboard for consistency as well.

## Extension name / Store title

Volition — AI Website Blocker & Focus Tool

## Short name in Chrome

Volition

## Summary / manifest description

AI website blocker that makes you explain why you need access. It can grant temporary access when needed.

## Detailed description

Volition is an AI website blocker that helps you focus by blocking distracting sites. When you open a blocked website, Volition asks why you need access. Explain your goal and the AI may approve temporary access. A countdown appears on temporarily allowed pages, and Volition checks access expiry as you browse. The AI can also approve unlimited access for sites it considers productive.

Use Volition's hosted AI service or connect your own OpenAI API key. With your own key, requests go directly from the extension to OpenAI, or to a compatible endpoint you configure. With the hosted service, requests pass through the Volition backend to OpenAI.

Edit your block and allow lists, pause blocking for a chosen time, and optionally enable AI classification for sites outside your lists. Classification is off by default.

Privacy: AI requests can include the blocked page's full URL, your conversation, custom prompts, proof images you choose to upload, and recent approval summaries. Approval history and settings are stored in your browser. The Volition backend has no database or file persistence for requests, but errors may be logged; Vercel and OpenAI handle data under their own policies. See the privacy policy for details.

The extension's access to website URLs lets it compare hostnames with your lists and redirect blocked sites. It also injects a countdown on temporarily allowed pages. It does not scrape page text or automatically capture screenshots.

## Dashboard privacy / permission disclosure notes

The `<all_urls>` host permission supports URL and hostname checks for blocking and a countdown injected on temporarily allowed pages. It is not used to read arbitrary page content. The `tabs` permission supports tab navigation and redirection; `storage` holds settings, lists, approval history, and usage records locally. The `scripting` permission injects the countdown. AI message contents go to OpenAI directly in own-key mode (or to the user-configured compatible endpoint) and through the Volition backend to OpenAI in hosted mode. Check the current Dashboard privacy declarations against [PRIVACY.md](../PRIVACY.md) before submission.
