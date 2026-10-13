# Volition live promo and store assets

The rejected redesign and slideshow have been removed. The extension retains its pre-promo wording, controls and section order. Cosmetic styling is in `presentation.css`; the countdown keeps its original text and has a larger badge. `AGENTS.md` records the user's ground rules, and the text inventory/annotation tests protect the approved strings.

## Actual recorded use

`volition-live-demo.mp4` is the complete browser recording. Chrome loaded the real extension in a dedicated temporary profile. The recording shows adding Hacker News through Settings, searching the list, opening the real website, the actual block redirect, typing a work-related test request, a genuine request through Volition's hosted service, a 30-second AI grant, the actual countdown, expiry/reblocking and real usage statistics.

`volition-promo.mp4` is the same continuous footage with the leading 12 seconds of Settings setup removed. It starts on the actual blocked page and runs through the real request, timed access, expiry and statistics. There are no generated slides, reconstructed screens, mocked Chrome APIs, intercepted replies, held approvals, title cards, added product copy, or invented statistics. The request text is ordinary user input; extension wording is unchanged. The video has no voiceover or music. It is a 1920×1080 H.264 MP4 at 24 fps, about 48 seconds long.

The genuine request was for this software test. It is not a promise that other reasons are always approved. Hacker News was selected because it was accessible to the recording browser; the earlier YouTube take encountered its bot sign-in challenge and is not supplied as the final promo. `recording-log.json` records the verified browser events and wall-clock timings. The single API call and approval shown in Statistics are actual events from that recording session.

## Upload files

| Developer Dashboard / YouTube field | File |
| --- | --- |
| Small promotional tile | `store-tile-440x280.png` |
| Optional marquee tile | `marquee-1400x560.png` |
| Screenshot 1 | `01-blocked.png` (1280×800) |
| Screenshot 2 | `02-request.png` (1280×800) |
| Screenshot 3 | `03-settings.png` (1280×800) |
| Screenshot 4 | `04-statistics.png` (1280×800) |
| YouTube thumbnail | `video-thumbnail-1920x1080.png` |
| Video to upload to YouTube | `volition-promo.mp4` |

The screenshots show the real installed extension, without rewritten UI or fabricated replies. Screenshot 2 shows an unsent user request, rather than freezing a fleeting approval screen. The thumbnail is a frame from the actual recording. The promotional tile and marquee are separate store artwork, using the Volition mark and existing category language; they never appear as video frames or as new extension text.

Upload the MP4 to your YouTube account and paste its URL into the Chrome Web Store video field. Upload the numbered screenshots, tile and optional marquee separately in the Developer Dashboard, alongside the matching extension package. Suggested YouTube title: **Volition — AI Website Blocker & Focus Tool**. Suggested description: **See Volition in use: a blocked website, a real AI access request, temporary access, and automatic reblocking.** Include the existing store install link. No upload or submission is automated here. See [Chrome image requirements](https://developer.chrome.com/docs/webstore/images) and [listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing).

The bundle is `docs/volition-store-assets.zip`. Canonical repository assets (`docs/volition_demo.mp4`, `docs/screenshot-blocked.png`, `docs/screenshot-settings.png`, `docs/screenshot-countdown.png`) also point to this new recording and its real captures.

## Reproduce

Requires Node 24, Chrome/Chromium with unpacked-extension support, FFmpeg with libx264, Python with Pillow, and network access to the real website and Volition hosted service.

```sh
node scripts/promo/record-live.mjs --chrome=/absolute/path/to/chrome --ffmpeg=/absolute/path/to/ffmpeg
node scripts/promo/export-assets.mjs --chrome=/absolute/path/to/chrome
python3 scripts/promo/finish-assets.py --ffmpeg=/absolute/path/to/ffmpeg
```

The recorder uses a dedicated temporary browser profile, never the user's normal profile. `PROMO_CDP_PORT` changes its default port, 19334. The artwork exporter can resume the dedicated recording profile with `--profile=/path/to/that/profile` when recapturing Settings with the actual configured list. It never creates movie frames. The recorder fails and reports the real reply if the live service does not grant access; do not replace that failure with a fake success. Live responses and timings can vary. The final supplied recording was independently checked through countdown expiry and reblocking.
