# Logistock Telegram — Supabase-native free-tier deployment

Status: Supabase Edge Function `logistock-telegram` ACTIVE, database triggers installed, webhook activated. Notifications are sent only to authorized chats; recipient must not have blocked the bot.

## Cost and hosting
- Telegram Bot API standard `sendMessage` only, with `allow_paid_broadcast:false`. No paid broadcast.
- Supabase Edge Functions Free quota is 500,000 monthly invocations; if exceeded, Free plan service may pause. Monitor project usage.
- Vercel Hobby has a non-commercial use restriction, so production Telegram notifications use Supabase only, not Vercel Hobby.
- No subscription or paid service was enabled.

## One-time secure setup
1. Supabase project `pbqzbakmxrdumaeamymd` > Edge Functions > Secrets.
2. Add **only** `LOGISTOCK_TELEGRAM_BOT_TOKEN` = token created by @BotFather. This value MUST stay out of GitHub and chat.
3. The other secrets and authorized chat IDs are generated and stored in the service-only table `public.telegram_runtime_config` (RLS enabled). Initially authorized: a single test chat ID.
4. Administrator requests a one-time activation using the random `setup_secret` from this private table. GET `https://pbqzbakmxrdumaeamymd.supabase.co/functions/v1/logistock-telegram?setup=ONE_TIME_SETUP_SECRET` sets Telegram's webhook and commands, marks the setup key consumed, and sends the initial confirmation message. Never publish the setup URL.
5. Check a real /mesai command, then make a genuine attendance INSERT or actual check-out UPDATE in normal app workflow and verify that it sends a notification exactly once.
6. Add further approved chat IDs in `telegram_runtime_config.allowed_chat_ids`, only after each person opens the bot and consents. Do not authorize arbitrary user IDs.

## Commands
- `/mesai`: today's names and check-in/out, including cross-midnight departures. Auto-closures and leave rows not counted as exits.
- `/kargo`: daily sessions, operators, scanned count, completion.
- `/sonokutmalar`: last 15 daily cargo scans with operator, carrier and barcode.
- `/transfer`: today's created transfers and picker assignment where stored.
- `/sonsayimlar`: last 15 transfer scans, identifying operator by profile.
- `/rapor`: mesai + cargo + transfer.
- `/yardim`: command help.

## Automatic alerts (simplified 2026-11-11)
- `attendance`: successful real check-in and real check-out, person and Türkiye-local time; no leave records or synthetic midnight closures.
- `cargo_sessions`: **only on INSERT/start**. Send initiating employee's name, carrier, and local start time. No cargo completion or individual barcode activity messages.
- `transfers`: **only on the first UPDATE changing status to `Tamamlandi`**. Send transfer code, recorded picker employee's name (if available), and local completion-event time. Picker is not necessarily the user who clicked completion; avoid claiming that.
- `cargo_logs` and `scan_logs`: Telegram DB triggers removed; no periodic 5-minute activity alerts.
- Status reports and scan details remain available **on request** through `/kargo`, `/sonokutmalar`, `/transfer`, and `/sonsayimlar`.
- Only the three database triggers `logistock_telegram_attendance`, `logistock_telegram_cargo_sessions`, and `logistock_telegram_transfers` remain. Test requests for old activity events return `{ok:true,ignored:true}`.

Security: Telegram validates secret header and allowed chat IDs; database events have an independent secret; no anon/authenticated access to private settings. Private person-level reports and scan barcodes should only be shared with approved managers, consistent with staff notification and KVKK obligations.

Caveat: Event idempotency is per event rather than recipient; a failed recipient delivery may require an explicit retry/outbox improvement for lossless delivery. With 3–4 recipients and small event volume the standard Telegram free API is suitable, but network reliability is not guaranteed.

GitHub feature branch: `feature/telegram-report-bot`. Vercel main unchanged.
