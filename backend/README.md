# Volition Free backend

Source recovered from the production Vercel deployment and supplied by the project owner on 2026-09-17. The three source/configuration files are preserved without behavioral changes. This directory is excluded from the Chrome extension ZIP. Saving these files does not redeploy Vercel.

The Vercel project must use this directory as its root if connected to this repository in future. `OPENAI_API_KEY` is supplied through Vercel environment settings; never commit its value.

The handler validates messages and inline images, then sends their role/content fields to OpenAI Chat Completions using `gpt-4o-mini`, `max_tokens: 350`, and `temperature: 0.2`. It has no database, file writes, analytics, cookie handling, or successful-request body/response logging. Its catch block logs the full thrown error object. Do not describe that as zero logging or assume errors can never contain sensitive details.

Vercel account settings, log retention/drains, OpenAI account data controls, and the exact installed SDK version are not captured by these files. The supplied package uses a version range and no lockfile was supplied. `vercel.json` sets only a 30-second function duration.
