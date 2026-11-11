# Logistock Telegram — Supabase-native free-tier deployment

Status: Supabase Edge Function `logistock-telegram` deployed. Database triggers and private configuration tables installed but notifications remain disabled until one-time activation.

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

## Event alerts
- `attendance` INSERT check-in, UPDATE null->timestamp check-out. Avoid historic edits, leave rows, synthetic midnight closures.
- `cargo_sessions` start, completed.
- `cargo_logs` barcode activity no more often than once every five minutes per session.
- `transfers` creation, status/picker change.
- `scan_logs` successful counting activity no more often than once every five minutes per transfer.
- All event types ignore out-of-date synthetic/historical rows for attendance and cargo. Transfer state is not proof of physical count completion.

Security: Telegram validates secret header and allowed chat IDs; database events have an independent secret; no anon/authenticated access to private settings. Private person-level reports and scan barcodes should only be shared with approved managers, consistent with staff notification and KVKK obligations.

Caveat: Event idempotency is per event rather than recipient; a failed recipient delivery may require an explicit retry/outbox improvement for lossless delivery. With 3–4 recipients and small event volume the standard Telegram free API is suitable, but network reliability is not guaranteed.

GitHub feature branch: `feature/telegram-report-bot`. Vercel main unchanged.
