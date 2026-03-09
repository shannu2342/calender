# Panchang Calendar + Astrology Platform

Full-stack web app for Hindu calendar workflows with:
- Panchang day/month views
- Festivals view and chatbot support
- Prokerala-powered astrology APIs (Panchang, Kundali, Matchmaking, Muhurat)
- Server-side caching for performance and quota protection

## Tech Stack

### Frontend
- React 19 + Vite
- React Router
- i18next / react-i18next
- Tailwind (configured in project)

### Backend
- Node.js + Express
- Axios for upstream API calls
- OAuth2 `client_credentials` with Prokerala
- SQLite cache using `better-sqlite3`

## Repository Structure

```text
panchang/
  backend/                  # Express API server
    controllers/            # Astrology controllers
    routes/                 # Astrology + chatbot routes
    services/               # Prokerala auth/service + SQLite cache service
    scripts/                # Cache seeding + Prokerala auth verification
    data/                   # SQLite DB and optional seed files
    .env.example            # Backend env template
    DEPLOYMENT.md           # Deployment guide
  frontend/                 # React application
    src/                    # Pages, components, API client, routing
    public/data/            # Local panchang/festival JSON assets
    .env.example            # Frontend env template
```

## How the System Works

1. Frontend calls backend endpoints (`/api/...`).
2. Backend authenticates with Prokerala using `PROKERALA_CLIENT_ID` + `PROKERALA_CLIENT_SECRET`.
3. Backend fetches access token from `https://api.prokerala.com/token` (OAuth2 client credentials flow).
4. Backend calls Prokerala with `Authorization: Bearer <token>`.
5. Panchang responses are cached in SQLite by date/location/ayanamsa/language.

You do **not** store a static Prokerala access token in `.env`.

## Prerequisites

- Node.js 18+ (recommended LTS)
- npm
- Prokerala API app credentials (`client_id`, `client_secret`)

## Local Setup (From Scratch)

### 1) Clone and install

```bash
git clone <your-repo-url>
cd panchang

cd backend
npm install

cd ../frontend
npm install
```

### 2) Configure backend env

Create `backend/.env` from `backend/.env.example` and set at least:

```env
PORT=5000
PROKERALA_CLIENT_ID=your_client_id
PROKERALA_CLIENT_SECRET=your_client_secret
PROKERALA_TOKEN_URL=https://api.prokerala.com/token
PROKERALA_BASE_URL=https://api.prokerala.com/v2
DEFAULT_TZ_OFFSET=+05:30
```

Optional:
- Add multiple credentials (`PROKERALA_CLIENT_ID_2`, `PROKERALA_CLIENT_SECRET_2`, etc.) for failover.
- Tune cache + retry env values in `backend/.env.example`.

### 3) Configure frontend env

Create `frontend/.env` from `frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

If omitted, frontend uses `/api` and Vite proxy in dev.

### 4) Verify Prokerala auth

```bash
cd backend
npm run prokerala:verify
```

Expected:
- Access token fetched
- Sample `/astrology/panchang` call succeeds

### 5) Start backend

```bash
cd backend
npm start
```

Backend runs on `http://localhost:5000`.

### 6) Start frontend

```bash
cd frontend
npm run dev
```

Frontend runs on Vite default (`http://localhost:5173`).

## Backend API Overview

Base URL (local): `http://localhost:5000`

### Astrology routes
- `GET /api/astrology/panchang`
- `GET /api/astrology/festivals`
- `POST /api/astrology/kundali`
- `POST /api/astrology/matchmaking`
- `POST /api/astrology/muhurat`
- `GET /api/astrology/cache/stats`
- `POST /api/astrology/cache/cleanup`

### Other routes
- `POST /api/chatbot` (also `POST /api/`)
- `POST /api/translate/batch`
- `POST /tts`
- `POST /schedule-notification`
- `POST /check-notification`
- `POST /check-durmuhurtham-status`

## Example API Calls

### Panchang

```bash
curl "http://localhost:5000/api/astrology/panchang?date=2026-02-20&lat=17.3934&lng=78.4706&la=en&ayanamsa=1"
```

### Kundali

```bash
curl -X POST "http://localhost:5000/api/astrology/kundali" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-02-20\",\"time\":\"10:30:00\",\"lat\":17.3934,\"lng\":78.4706,\"tzOffset\":\"+05:30\",\"ayanamsa\":1,\"la\":\"en\"}"
```

### Cache stats

```bash
curl "http://localhost:5000/api/astrology/cache/stats"
```

## Caching Design

- Backend stores Panchang API responses in `backend/data/panchang_cache.db`.
- Cache key includes date, latitude, longitude, ayanamsa, language.
- Cache TTL controlled by `PANCHANG_CACHE_TTL_DAYS` (default 30).
- Useful for reducing Prokerala calls, improving latency, and surviving temporary provider issues.

## Seed Cache (Optional)

Use when you want pre-populated data in deployment:

```bash
cd backend
node scripts/seedCache.js
```

Script generates/updates:
- `backend/data/panchang_cache.db`
- `backend/data/panchang_cache_seed.json`
- `backend/data/panchang_cache_seed.sql`

See `backend/scripts/README.md` for details.

## Frontend Routes

Main routes in `frontend/src/RouterApp.jsx`:
- `/` Home
- `/month-view`
- `/festivals`
- `/my-tithi`
- `/hindu-time`
- `/compass`
- `/sankalp-mantra`
- `/about`, `/info`, `/settings`
- `/astrology`, `/kundali`, `/matchmaking`, `/muhurat`, `/panchang`

## Deployment

- Backend deployment instructions: `backend/DEPLOYMENT.md`
- Ensure backend env vars are configured in hosting provider.
- Keep Prokerala credentials server-side only.

## Security Notes

- Never expose Prokerala client secret in frontend code.
- Never commit production `.env` files.
- Rotate credentials if accidentally exposed.

## Troubleshooting

- `PROKERALA_CREDENTIALS_MISSING`: check `backend/.env` keys.
- `PROKERALA_TOKEN_FETCH_FAILED`: verify client ID/secret pair and token URL.
- Frequent `429`: increase caching, add multiple credentials, or reduce request burst.
- Frontend API errors in dev: confirm backend is running on port 5000 and Vite proxy/env is correct.
