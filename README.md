# CommandBridge

A production-ready full-stack web application for managing Discord slash commands via the **Interactions API** (no WebSocket bot). Admins authenticate, connect Discord servers, configure command behavior, and monitor interactions in real time.

## Architecture

```
┌─────────────┐     REST/SSE      ┌──────────────┐     Interactions API    ┌─────────┐
│   React     │ ◄──────────────► │   Express    │ ◄──────────────────────► │ Discord │
│  Dashboard  │                   │   Backend    │                          │         │
│  (Vercel)   │                   │  (Render)    │                          └─────────┘
└─────────────┘                   └──────┬───────┘
                                         │
                                    ┌────▼────┐
                                    │  Neon   │
                                    │ Postgres│
                                    └─────────┘
```

## Features

- **Discord Interactions API** — Ed25519 signature verification, PING/PONG, duplicate prevention
- **Slash Commands** — `/report` (deferred, buttons, modals) and `/status` (embed + refresh button)
- **Deferred Responses** — Auto-defer when processing exceeds 3 seconds
- **Webhook Mirroring** — Mirror notifications to Slack or Discord webhooks
- **Admin Dashboard** — Auth, live logs (SSE), command rules, failure/retry history, server settings
- **AI Auto-Tagging** — Optional Groq or Gemini summarization/tagging (stretch goal)
- **Multi-Server Support** — Connect and manage multiple Discord guilds

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19, Vite, TypeScript          |
| Backend  | Node.js, Express, TypeScript        |
| Database | PostgreSQL (Neon) + Prisma ORM      |
| Auth     | JWT + bcrypt                        |
| Deploy   | Vercel (frontend), Render (backend) |

## Quick Start

### Prerequisites

- Node.js 20+
- A [Discord Application](https://discord.com/developers/applications) with a bot
- A [Neon](https://neon.tech) PostgreSQL database (free tier)

### 1. Clone and Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cp .env.example backend/.env
# Edit backend/.env with your values
```

Create `frontend/.env.local`:
```
VITE_API_URL=/api
```

### 3. Set Up Database

```bash
cd backend
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Register Slash Commands

```bash
cd backend
npx tsx scripts/register-commands.ts
# Or for a specific guild (instant):
npx tsx scripts/register-commands.ts YOUR_GUILD_ID
```

### 5. Configure Discord Interactions Endpoint

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. Go to your application → **General Information** → copy **Public Key** and **Application ID**
2. Go to **Bot** → copy the **Token**
3. Go to **General Information** → **Interactions Endpoint URL**:
   - Local (with ngrok): `https://your-ngrok-url.ngrok.io/api/interactions`
   - Production: `https://your-api.onrender.com/api/interactions`

### 6. Run Locally

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Open http://localhost:5173 and sign in with the seeded admin credentials.

For local Discord testing, expose your backend with ngrok:
```bash
ngrok http 3001
```

## Deployment

### Backend (Render)

1. Push to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Use the `render.yaml` blueprint or configure manually:
   - **Build Command:** `cd backend && npm install && npx prisma generate && npm run build`
   - **Start Command:** `cd backend && npx prisma migrate deploy && npm start`
   - Set all environment variables from `.env.example`
4. Copy the Render URL and set it as the Discord Interactions Endpoint

### Frontend (Vercel)

1. Import the repo on [Vercel](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   - `VITE_API_URL` = `https://your-api.onrender.com/api`
4. Update `FRONTEND_URL` on Render to your Vercel URL

### Database (Neon)

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string to `DATABASE_URL`
3. Run migrations: `npx prisma migrate deploy`

## API Reference

### Public

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| POST   | `/api/interactions`   | Discord interactions webhook   |
| GET    | `/api/settings/health`| Health check                   |

### Protected (Bearer JWT)

| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| POST   | `/api/auth/login`               | Admin login              |
| GET    | `/api/auth/me`                  | Current admin            |
| GET    | `/api/servers`                  | List connected servers   |
| POST   | `/api/servers`                  | Connect a server         |
| PATCH  | `/api/servers/:id`              | Update server settings   |
| GET    | `/api/commands/:serverId`       | List command rules       |
| PATCH  | `/api/commands/:serverId/:name` | Update command rule      |
| GET    | `/api/logs`                     | Interaction logs         |
| GET    | `/api/logs/stats`               | Dashboard statistics     |
| POST   | `/api/logs/:id/retry`           | Retry failed interaction |
| GET    | `/api/settings/events`          | SSE live updates         |
| PATCH  | `/api/settings`                 | Update app settings      |

## Slash Commands

### `/report`
Submit a report with title, description, and optional severity (low/medium/high/critical).

- Deferred response for long processing
- Interactive **Acknowledge** and **Open Form** buttons
- Modal form for detailed submissions

### `/status`
Check CommandBridge system status.

- Returns an embed with uptime, server info, and response channel
- **Refresh** button for live updates

## Security

- All secrets stored in environment variables, never exposed to the client
- Discord Ed25519 signature verification on every interaction
- JWT authentication for admin routes
- Rate limiting on API endpoints
- Helmet security headers
- CORS restricted to frontend origin
- Webhook URLs masked in API responses

## Project Structure

```
├── backend/
│   ├── prisma/          # Schema, migrations, seed
│   ├── scripts/         # Command registration
│   └── src/
│       ├── config/      # Env, database, logger
│       ├── middleware/   # Auth, validation, errors
│       ├── routes/      # REST + interactions endpoints
│       ├── services/    # Business logic
│       └── utils/       # Discord, JWT helpers
├── frontend/
│   └── src/
│       ├── api/         # API client
│       ├── components/  # Layout, shared UI
│       ├── context/     # Auth context
│       ├── hooks/       # SSE hook
│       └── pages/       # Dashboard pages
├── .env.example
├── AI_NOTES.md
├── render.yaml
└── README.md
```

## License

MIT
