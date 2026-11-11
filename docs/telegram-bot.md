# Logistock Telegram bot — development branch

Uses the official free Telegram Bot API for a small (3-4 person) trusted recipient list.
Do not enable Paid Broadcasts in BotFather. Telegram API has free rate limits; services such as Vercel and Supabase have usage quotas.

## Security / configuration
Server-side environment variables:
- `TELEGRAM_BOT_TOKEN` — obtain via Telegram @BotFather; never paste into chat or commit.
- `TELEGRAM_ALLOWED_CHAT_IDS` — comma separated numeric chat IDs of 3–4 approved recipients, all must have started the bot.
- `TELEGRAM_WEBHOOK_SECRET` — random string for Telegram setWebhook secret_token.
- `TELEGRAM_ATTENDANCE_WEBHOOK_SECRET` — independent random secret for Supabase Database Webhook header `x-logistock-event-secret`.
- `CRON_SECRET` — strong random string, only if scheduling the daily report.
- Existing `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Telegram setup
1. Message @BotFather and run /newbot. Store the token in Vercel environment secrets.
2. Every recipient opens the bot and taps Start; use getUpdates before enabling the webhook to obtain individual chat IDs, or a private temporary discovery workflow. Restrict chat IDs to your chosen recipients.
3. Set the webhook using Telegram's `setWebhook`, URL `https://YOUR-DOMAIN/api/telegram/webhook`, secret_token matching TELEGRAM_WEBHOOK_SECRET, and allowed_updates=["message"].
4. Test /yardim, /mesai, /kargo, /transfer, /rapor. Unknown or unauthorized chats are ignored.
5. Run the SQL migration for `telegram_notification_events` using the normal production migration process; ensure no anon/authenticated permissions.
6. Supabase Dashboard > Database > Webhooks > new webhook: `public.attendance`, INSERT and UPDATE, HTTP POST URL `https://YOUR-DOMAIN/api/telegram/attendance-event`, header `x-logistock-event-secret` set to TELEGRAM_ATTENDANCE_WEBHOOK_SECRET. This is NOT created automatically; never point production DB to preview deployments.
7. Webhook sends only new real check-ins and null→timestamp check-outs within two minutes of event time, excluding leave rows and automatic closures. It ignores later manual revisions and historical records.
8. Optional: after testing, schedule GET `/api/telegram/daily` via Vercel Cron, with `0 18 * * *` for 21:00 Istanbul (UTC+3). Configure scheduling in vercel.json only when ready; check current Vercel plan quota.

## Operational notes
- Deduplication table is required before enabling the attendance webhook. It prevents duplicate events on retry; a partial failure may need manual re-delivery, and failed events are not automatically retried.
- Delivery should eventually use an outbox with per-recipient statuses if exactly-once delivery matters.
- Reports include personal employee names and times; keep recipients restricted and comply with KVKK, including informing staff and applying appropriate retention policies.
- Current KARGO report distinguishes cargo records from scans and does not claim courier handoff without source evidence.
- Transfer report compares sent/received quantities and statuses but does not prove an independently witnessed physical count.
- No production DB or Vercel settings were modified, no Telegram token or recipients configured, and no notifications are live.
