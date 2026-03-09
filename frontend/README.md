# Frontend (React + Vite)

UI for Panchang calendar, astrology pages, festivals, chatbot integration, and utilities.

## Run Locally

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5173`

## Environment

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

If not set, frontend uses `/api` and relies on Vite proxy.

## Build

```bash
npm run build
npm run preview
```

## Main App Routes

- `/` Home
- `/month-view`
- `/festivals`
- `/my-tithi`
- `/hindu-time`
- `/compass`
- `/sankalp-mantra`
- `/about`, `/info`, `/settings`
- `/astrology`, `/kundali`, `/matchmaking`, `/muhurat`, `/panchang`

## More Docs

- Full project guide: `../README.md`
