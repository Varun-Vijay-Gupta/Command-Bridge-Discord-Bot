# AI Notes — CommandBridge

This document records architectural decisions, AI-assisted development notes, and guidance for future contributors or AI agents working on this codebase.

## Project Overview

CommandBridge is a Discord Interactions API gateway with an admin dashboard. It does **not** use a WebSocket-based Discord bot (`discord.js` gateway). Instead, Discord sends HTTP POST requests to `/api/interactions` when users invoke slash commands.

## Key Architectural Decisions

### 1. Interactions API over Gateway Bot

**Why:** The prompt explicitly required Interactions API without WebSocket. This means:
- No persistent connection to Discord
- Serverless-friendly (Render free tier works)
- Discord POSTs to our endpoint; we respond synchronously (within 3s) or defer

**Trade-off:** Cannot listen to message events, member joins, etc. Only handles registered interaction types (commands, buttons, modals).

### 2. Raw Body for Signature Verification

Discord signs the raw request body with Ed25519. Express's `express.json()` middleware parses and discards the raw body. Solution:

```typescript
// app.ts — interactions route uses express.raw() first
app.use('/api/interactions', express.raw({ type: 'application/json' }), rawBodyMiddleware, interactionsRouter);
app.use(express.json()); // all other routes
```

The `tweetnacl` library verifies: `nacl.sign.detached.verify(timestamp + body, signature, publicKey)`.

### 3. Duplicate Interaction Prevention

Discord may retry interactions on timeout. We use a unique constraint on `interactionId` in PostgreSQL:

```prisma
interactionId String @unique
```

On duplicate, return an ephemeral "already processed" message without re-executing logic.

### 4. Deferred Responses

Discord requires a response within 3 seconds. For `/report` (simulated slow processing) and any command exceeding 2.5s:

1. Respond immediately with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5)
2. Process asynchronously
3. Send follow-up via webhook: `POST /webhooks/{app_id}/{interaction_token}`

### 5. Database Schema Design

- **Admin** — single-tenant admin auth (JWT)
- **DiscordServer** — multi-server support, linked to admin
- **CommandRule** — per-server, per-command configuration (enabled, mirror, AI tagging)
- **InteractionLog** — full audit trail with request/response payloads
- **FailureLog** — retry history with stack traces
- **AppSettings** — singleton for webhook URL and AI provider (secrets still in env)

### 6. Real-Time Updates via SSE

Stretch goal implemented with Server-Sent Events instead of WebSockets:
- Simpler than WebSocket for one-way server→client push
- Works through Render/Vercel proxies
- `GET /api/settings/events` with JWT auth
- Frontend `useSse` hook reconnects on failure

### 7. AI Integration (Stretch)

Optional Groq/Gemini for command summarization and tagging:
- Triggered per-command via `autoTagEnabled` flag
- Runs after command completion (non-blocking to Discord response)
- Free tier APIs: Groq `llama-3.1-8b-instant`, Gemini `gemini-2.0-flash`

## File Map for Common Tasks

| Task | Files to Edit |
|------|---------------|
| Add a slash command | `backend/scripts/register-commands.json`, `backend/src/services/interaction.service.ts` (`executeCommand`) |
| Change interaction response format | `backend/src/utils/discord.ts`, `interaction.service.ts` |
| Add admin API endpoint | `backend/src/routes/`, register in `app.ts` |
| Add dashboard page | `frontend/src/pages/`, route in `App.tsx`, nav in `Layout.tsx` |
| Change database schema | `backend/prisma/schema.prisma` → `npx prisma migrate dev` |
| Configure mirroring | `backend/src/services/mirror.service.ts` |

## Environment Variables Reference

See `.env.example` for the complete list. Critical ones:

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `DISCORD_PUBLIC_KEY` | Ed25519 verification | Developer Portal → General Information |
| `DISCORD_APPLICATION_ID` | App ID for webhooks | Developer Portal → General Information |
| `DISCORD_BOT_TOKEN` | Register commands, follow-ups | Developer Portal → Bot → Token |
| `DATABASE_URL` | Neon PostgreSQL | neon.tech console |
| `JWT_SECRET` | Admin auth tokens | Generate random 32+ chars |

## Discord Setup Checklist

1. Create application at discord.com/developers
2. Create bot, copy token
3. Enable **Message Content Intent** (not required for interactions, but good practice)
4. Set Interactions Endpoint URL to your deployed `/api/interactions`
5. Register slash commands: `npx tsx scripts/register-commands.ts [guildId]`
6. Invite bot with `applications.commands` scope
7. Connect server in admin dashboard with Guild ID

## Testing Locally

1. Start backend: `cd backend && npm run dev`
2. Expose with ngrok: `ngrok http 3001`
3. Set Interactions Endpoint to ngrok URL + `/api/interactions`
4. Use slash commands in Discord
5. Watch logs in dashboard (SSE) or terminal

## Known Limitations

- **No OAuth2 guild discovery** — admin manually enters Guild ID (could add Discord OAuth as future work)
- **Retry is logical only** — re-executes command logic but cannot re-send to Discord (token expires after 15 min)
- **AI tagging is best-effort** — parsing LLM JSON output may fail gracefully
- **Render free tier** — cold starts may cause first interaction to timeout; consider paid tier for production

## Deployment Notes

### Render
- Uses `render.yaml` blueprint
- `prisma migrate deploy` runs on start
- Health check at `/api/settings/health`
- Set `FRONTEND_URL` to Vercel domain for CORS

### Vercel
- Root directory: `frontend`
- `VITE_API_URL` must be set at build time
- SPA routing via `vercel.json` rewrites

### Neon
- Use pooled connection string for serverless if needed
- Enable `?sslmode=require` in connection string

## Future Improvements

- Discord OAuth2 for automatic guild listing
- Command registration UI (instead of CLI script)
- Webhook signature verification for mirror callbacks
- Redis for interaction dedup cache (faster than DB lookup)
- Prometheus metrics endpoint
- E2E tests with mocked Discord signatures

## AI Agent Instructions

When modifying this codebase:

1. **Never expose secrets** — env vars only, mask in API responses
2. **Preserve raw body middleware** — breaking signature verification breaks all Discord interactions
3. **Respond to PING** — Discord validates endpoint with type 1; must return type 1
4. **Match existing patterns** — Zod validation, asyncHandler, Prisma queries, winston logging
5. **Run `npm run build`** in both packages before considering work complete
6. **Update this file** if you make significant architectural changes
