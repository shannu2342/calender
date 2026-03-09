# Deployment Guide

## Prerequisites

1. **GitHub Repository** - Push your code to GitHub
2. **Prokerala API Credentials** - Get your API keys from [Prokerala](https://www.prokerala.com/)


## Environment Variables Required

Create these environment variables in your deployment platform:

### For Backend (Render/Vercel)

```
# Server
PORT=5000

# Prokerala API Credentials (get from https://www.prokerala.com/)
PROKERALA_CLIENT_ID=your_client_id_here
PROKERALA_CLIENT_SECRET=your_client_secret_here

# Important:
# Do NOT set PROKERALA_ACCESS_TOKEN manually.
# Backend auto-fetches OAuth token from https://api.prokerala.com/token
# using the client_credentials flow.

# Optional: Failover credentials (if you have multiple API keys)
# PROKERALA_CLIENT_ID_2=...
# PROKERALA_CLIENT_SECRET_2=...

# Default timezone
DEFAULT_TZ_OFFSET=+05:30

# Cache Settings
# For Vercel: Set to 0 (stateless) or use Redis below
# For Render: 30 days works fine with persistent disk
PANCHANG_CACHE_TTL_DAYS=30

# Optional: Redis for production (recommended for 1 lakh+ users)
# REDIS_URL=redis://...
```

---

## Option 1: Deploy to Render (Recommended for SQLite)

### Steps:

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add server-side caching for panchang API"
   git push origin main
   ```

2. **Create Render Account**:
   - Go to [render.com](https://render.com)
   - Connect your GitHub repository

3. **Create Web Service**:
   - Name: `panchang-backend`
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment: `Node`

4. **Add Environment Variables**:
   - Add all required environment variables in the Render dashboard
   - Important: Add `PROKERALA_CLIENT_ID` and `PROKERALA_CLIENT_SECRET`

5. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment to complete

6. **Verify Prokerala OAuth flow locally (recommended before deploy)**:
   ```bash
   cd backend
   npm run prokerala:verify
   ```
   This validates that your `PROKERALA_CLIENT_ID` and `PROKERALA_CLIENT_SECRET`
   can fetch an access token and make an authenticated API request.

**Note**: Render provides persistent disk storage, so SQLite caching will persist between deployments.

---

## Option 2: Deploy to Vercel

### For Backend (Serverless Functions)

Vercel's serverless functions have ephemeral filesystem - the SQLite database won't persist between invocations. For production with 1 lakh users, **use Redis** instead.

### Steps:

1. **Push to GitHub**

2. **Configure Vercel**:
   - Create `vercel.json` in backend folder (see below)

3. **Use Redis for Caching** (recommended):
   - Create free Redis instance at [Upstash](https://upstash.com/)
   - Add `REDIS_URL` environment variable

### Backend vercel.json:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server.js"
    }
  ]
}
```

---

## Option 3: Use Redis for Production (Recommended for Scale)

For 1 lakh+ users, use Redis instead of SQLite for better performance and persistence.

### Install Redis:
```bash
npm install ioredis
```

### Update Cache Service:

The current implementation uses SQLite which works for:
- Single server deployments
- Render with persistent disk

For multi-server/Vercel production, consider switching to Redis.

---

## Testing Your Deployment

1. **Test the API**:
   ```bash
   curl "https://your-backend-url.onrender.com/api/astrology/panchang?date=2026-02-19&lat=17.3934&lng=78.4706"
   ```

2. **Test Cache** (second request should be faster):
   ```bash
   curl "https://your-backend-url.onrender.com/api/astrology/cache/stats"
   ```

3. **Verify Response** includes `_meta` field:
   ```json
   {
     "status": "ok",
     "data": { ... },
     "_meta": {
       "cached": true,
       "cacheAge": 30,
       "accessCount": 5
     }
   }
   ```

---

## Production Checklist

- [ ] Set up environment variables in deployment platform
- [ ] Test API rate limiting (make multiple requests)
- [ ] Monitor cache hit rate with `/api/astrology/cache/stats`
- [ ] Set up alerts for Prokerala API quota
- [ ] Consider Redis for high-traffic production

---

## Troubleshooting

### "ECONNREFUSED" Error
- Check that your Prokerala credentials are set correctly
- Verify the API endpoint is accessible

### Cache Not Working
- Check database file permissions (for SQLite)
- Verify `PANCHANG_CACHE_TTL_DAYS` is set

### Rate Limiting Still Occurring
- Increase cache TTL: `PANCHANG_CACHE_TTL_DAYS=90`
- Add more Prokerala credentials for failover
