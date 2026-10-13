# Volition ground rules

These are explicit user requirements. Follow them for every future change.

1. All text in the live extension must be paired with an adjacent HTML or JavaScript comment containing exactly `verbatim keep text`. This includes labels, headings, placeholders, accessible names, tooltips, model labels, status/error messages, confirmations, generated HTML/SVG text, and text templates. User-entered values and model/provider replies must remain unmodified; annotate their rendering sites too.
2. Do not add, rewrite, rename, or remove live extension text. Only reuse text that was already present and marked `verbatim keep text` before the new change. Adding that comment to newly invented copy does not authorize the copy. Metadata in package.json, extension/store descriptions, and external marketing material may be written separately.
3. Promo video must show actual live extension use in a browser with the real extension loaded. Do not use generated slides, HTML slide stages, reconstructed product screens, mocked Chrome APIs, substituted AI replies, or held/frozen approval flows as the video. Record genuine navigation, typing, requests, replies, opening the allowed site, and countdown behavior. Disclose any live service failure rather than simulating success.
4. Preserve existing UI wording, controls, and section order. Visual changes may improve CSS, spacing, colors, type size, responsiveness, and image assets while keeping the approved text verbatim. Do not introduce unrelated behavior changes or UX artifacts.
5. Do not publish or submit Chrome Web Store changes automatically. Supply the extension package and store assets for manual review/upload.

The frozen existing-text inventory in tests/extension-text-baseline.json and its validation test enforce the wording rule. Do not update that inventory to bypass the restriction; a change to approved live text requires an explicit new user instruction.

## Repository workflow

Commit and push completed, validated repository changes. Respect `.gitignore`: keep generated extension ZIPs, `dist/`, dependencies, credentials, and local reference screenshots out of Git. Track the final store artwork, live promo footage, source, documentation, and tests. Push the branch without release tags; tag pushes trigger Chrome Web Store submission and require explicit publishing authorization.
