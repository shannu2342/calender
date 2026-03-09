# Backend (Express + Prokerala Integration)

Backend API for Panchang, Kundali, Matchmaking, Muhurat, chatbot utilities, and server-side caching.

## Run Locally

```bash
npm install
npm run prokerala:verify
npm start
```

Default URL: `http://localhost:5000`

## Required Environment Variables

Set these in `backend/.env`:

```env
PORT=5000
PROKERALA_CLIENT_ID=your_client_id
PROKERALA_CLIENT_SECRET=your_client_secret
PROKERALA_TOKEN_URL=https://api.prokerala.com/token
PROKERALA_BASE_URL=https://api.prokerala.com/v2
DEFAULT_TZ_OFFSET=+05:30
```

Notes:
- Prokerala access token is fetched automatically via OAuth2 client credentials.
- Do not store a static access token in `.env`.

## Key Endpoints

- `GET /api/astrology/panchang`
- `GET /api/astrology/festivals`
- `POST /api/astrology/kundali`
- `POST /api/astrology/matchmaking`
- `POST /api/astrology/muhurat`
- `GET /api/astrology/cache/stats`
- `POST /api/astrology/cache/cleanup`
- `POST /api/chatbot`
- `POST /api/translate/batch`

## Caching

- SQLite DB path: `backend/data/panchang_cache.db`
- TTL via `PANCHANG_CACHE_TTL_DAYS`
- Optional pre-seeding via `node scripts/seedCache.js`

## More Docs

- Full project guide: `../README.md`
- Deployment guide: `DEPLOYMENT.md`
- Seed script guide: `scripts/README.md`
