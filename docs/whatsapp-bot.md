# Logistock WhatsApp bot (feature branch only)

## Architecture
- Official Meta WhatsApp Cloud API; no unofficial WhatsApp Web session.
- Webhook: `/api/whatsapp/webhook` (Meta GET verification and signed POST inbound text).
- Daily template sender: `/api/whatsapp/daily` (protected by Vercel `CRON_SECRET`).
- Supabase is accessed server-side with service-role credentials; never expose these in NEXT_PUBLIC_ variables.
- Authorized inbound senders and daily recipients come from `WHATSAPP_ALLOWED_NUMBERS` (comma-delimited country codes with no '+', e.g. 905xxxxxxxxx).
- Commands: `RAPOR`, `MESAI`, `KARGO`, `TRANSFER`, `YARDIM`.

## Environment variables (Vercel, server-side)
```
WHATSAPP_VERIFY_TOKEN=<random webhook challenge token>
WHATSAPP_APP_SECRET=<Meta application secret>
WHATSAPP_ACCESS_TOKEN=<Meta system-user token>
WHATSAPP_PHONE_NUMBER_ID=<Meta business phone number ID>
WHATSAPP_GRAPH_VERSION=v25.0
WHATSAPP_ALLOWED_NUMBERS=905xxxxxxxxx,905yyyyyyyyy
WHATSAPP_DAILY_TEMPLATE_NAME=logistock_daily_report
WHATSAPP_TEMPLATE_LANGUAGE=tr
CRON_SECRET=<strong random secret>
```

Existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be configured.

## Meta setup
1. Create Meta Developer business app and configure WhatsApp Cloud API / WABA / sender number.
2. Set callback URL to `https://YOUR_DOMAIN/api/whatsapp/webhook`, and same verify token as env; subscribe to `messages`.
3. Create, submit and get approval for a message template named `logistock_daily_report` with one body placeholder `{{1}}` for the summary. WhatsApp template limits/review constraints apply; for long reports prefer a compact template with a link to a secured report.
4. Get prior opt-in from recipients; limit numbers to internal authorized staff, as HR data is confidential.
5. Configure an HTTPS production deployment and environment secrets. Schedule `/api/whatsapp/daily` via Vercel Cron with `0 18 * * *` (21:00 Istanbul) only after test and authorization. Vercel Cron scheduling, plan limits and delivery retries must be checked.
6. Test webhook verification, signature rejection, command handling and Meta sandbox messages before enabling scheduled delivery.

## Important pre-production work
- Add a durable inbound `wamid` deduplication table; Meta can retry webhooks. Without it, duplicate replies are possible.
- Add a durable outbound report dispatch table/idempotency lock to avoid duplicate scheduled reports and log delivery results without leaking personal message contents.
- Optionally create report functions for *shipping actually handed to a courier* and transfer scan-audit completion. Current cargo metrics distinguish record count from scan count and explicitly do not claim delivery.
- Ensure report texts, error logs and phone data follow local privacy requirements (KVKK).
- Do not merge to `main` or enable cron before completing Meta configuration and tests.

## Current status
The feature branch contains the report/API groundwork; nothing is deployed and no message is sent automatically. Database schema and production environment are unchanged.
