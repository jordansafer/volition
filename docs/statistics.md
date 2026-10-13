# Daily statistics

The statistics page offers 12 metrics and 7/30/90-day views. Dates use UTC. History starts when the new collector first runs; old truncated activity/approval histories are not backfilled as complete days. The first and current days may be partial. Zero means no counted events; a dash means no measurement (pre-collection dates or an average with no samples).

`dailyStatistics` in local extension storage holds at most 90 date buckets. Each bucket contains fixed numeric counters and an 11-element duration histogram, never individual events, prompts, images, URLs, model IDs or site lists. All writes go through one service-worker queue, including reset and the existing API totals/history update. Failed statistics writes do not prevent blocking, model replies, or approvals.

At most 100 tab entries keep a hostname (253 characters maximum), conversation ID (64 characters maximum), send count and timestamp. They support negotiation outcomes and repeat counts. Closed tabs are removed. Entries inactive for 24 hours are finalized at the timeout date and pruned on the next operation. If more than 100 tabs need tracking, the oldest bookkeeping entry is discarded without inventing an outcome; session metrics may undercount in that case. Tab IDs and conversation IDs are internal local bookkeeping and are not transmitted.

- **Blocked visits:** successful redirects to the blocked page.
- **Access approvals:** actual negotiated grants, counted once per tracked conversation, including unlimited grants.
- **Session approval rate:** approvals divided by approvals plus unfinished negotiations, on the date each finishes. This is not an AI denial/acceptance classifier.
- **Temporary minutes granted:** sum of time granted; excludes unlimited grants and does not measure browsing time.
- **Typical access duration:** estimated median using fixed upper bounds of 1, 5, 15, 30, 60, 120, 240, 480, 1440 and 10080 minutes. The two middle bucket bounds are averaged for even sample counts. If either middle value is in the overflow bucket, the display says Beyond range. Unlimited grants are excluded.
- **Unfinished negotiations:** at least one send, followed by navigating away, tab closure, starting a fresh conversation, or 24 hours without another send. Errors/retries are included; this does not imply the AI denied access. Reloads are recognized when the new conversation sends its first message. Closing Chrome is not necessarily a tab-close event; stale entries expire on the next operation.
- **Messages before approval:** average send actions (including image submissions and retries) per approved conversation.
- **Repeat blocked visits in a tab:** a block on the same hostname as that tab's previous block within 24 hours, while its bookkeeping entry survives. New tabs start fresh.
- **Time paused:** elapsed wall-clock milliseconds under partial or complete pause, split at UTC midnight; includes browser downtime. Renewing or changing pause mode cannot double-count the overlap. Existing pauses start contributing when the collector starts. Reset begins a fresh accounting interval.
- **AI requests / tokens / response time:** successful chat and classification requests; connection tests and failed requests are excluded. Token counts depend on provider reports (missing usage contributes zero). Response time includes setup, network and response decoding, but excludes statistics writes.

The optional site filter is not included: daily history has no per-site dimension. This keeps the aggregate schema fixed regardless of how many sites are visited.

The existing approval history (20 records) and API history (100 records) retain their prior limits. Reset clears daily statistics, tab bookkeeping, API totals and API history; it preserves approval history, settings and keys. Retention pruning runs on collection/read, not via a new background timer or permission.
