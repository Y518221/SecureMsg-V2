# SecureMsg - Backend Deployment Guide

## Problem Analysis

Your frontend was getting a 404 error when calling `POST https://securemsg-34jy.onrender.com/api/auth/login` because:

1. **Missing CORS headers** - Cross-origin requests need proper CORS configuration
2. **Incorrect middleware ordering** - API routes need to be registered before static file serving
3. **Missing build command** - The production build wasn't running on Render
4. **Missing NODE_ENV** - The environment variable wasn't set, so the app wasn't serving from the dist folder

## What Was Fixed

### 1. Enhanced CORS Support (server.ts)
```typescript
// Added CORS middleware that allows requests from any origin
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
```

### 2. Correct Middleware Ordering
Proper order in Express:
1. Body parsing (express.json)
2. CORS headers
3. Logging
4. **API routes** ← Must be before static files
5. Health check endpoint
6. Static file serving
7. SPA catch-all fallback ← Must be last

### 3. Better Error Handling & Logging
- Added request logging to debug routing issues
- Added error handling middleware
- Health check endpoint at `/api/health`
- Better console output for server startup

### 4. Updated Frontend API Service (src/services/api.ts)
- Automatic API base URL detection
- Proper Content-Type headers
- Better error logging with console messages

## Deployment to Render

### Step 1: Update Environment Variables on Render

1. Go to your Render service: https://dashboard.render.com/services/your-service
2. Go to **Environment** tab
3. Add these environment variables:
   - `NODE_ENV` = `production`
   - `SUPABASE_URL` = Your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` = Your service role key
   - `MASTER_ENCRYPTION_KEY` = Your encryption key
   - `JWT_SECRET` = Your JWT secret
   - `GEMINI_API_KEY` = Your Gemini API key

### Step 2: Verify Build & Start Commands

1. Go to **Settings** tab on Render dashboard
2. Set **Build Command** to:
   ```
   npm install && npm run build
   ```
3. Set **Start Command** to:
   ```
   npm start
   ```

### Step 3: Redeploy

1. Click **Manual Deploy** or push code to trigger auto-deploy
2. Watch the deployment logs in the Render dashboard
3. Look for:
   ```
   ╔════════════════════════════════════════╗
   ║  SecureMsg Server Ready                ║
   ║  Port: 3000                            ║
   ║  Environment: PROD                     ║
   ║  API: http://0.0.0.0:3000/api          ║
   ╚════════════════════════════════════════╝
   ```

### Step 4: Test the API

After deployment, test with curl:
```bash
curl -X POST https://securemsg-34jy.onrender.com/api/health

# Should respond with:
# {"status":"ok","timestamp":"2026-04-20T..."}
```

Then test login:
```bash
curl -X POST https://securemsg-34jy.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'
```

## File Changes Summary

### Modified Files:
- **server.ts** - Added CORS, logging, better error handling, proper middleware ordering
- **src/services/api.ts** - Added API base URL detection and better logging
- **.env.example** - Template for environment variables
- **render.yaml** - Render deployment configuration

## Local Development Testing

Before deploying, test locally:

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Run in production mode (this is what Render does)
NODE_ENV=production npm start
```

Then test:
```bash
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

## Troubleshooting

### Still getting 404?

1. **Check Render logs**: Dashboard → Logs tab
2. **Check if build ran**: Look for "vite build" output in logs
3. **Verify environment variables**: Dashboard → Environment tab
4. **Check dist folder exists**: The build must create `dist/index.html`

### Common Issues:

**"Cannot find module 'dist'"**
- The build didn't run. Make sure build command is: `npm install && npm run build`

**CORS error in browser console**
- It's actually a different error - the new CORS middleware will allow the request through

**502 Bad Gateway**
- Server crashed. Check logs for error messages
- Verify all required environment variables are set

**API route returns 404 but health check works**
- This shouldn't happen with the new code. Check if you're calling the right URL

## Summary of Routes

Your API now has:

```
POST   /api/auth/login          - User login
POST   /api/auth/register       - User registration
GET    /api/auth/me             - Get current user (requires auth)
GET    /api/health              - Health check (no auth required)

POST   /api/messages/*          - Message routes
POST   /api/groups/*            - Group routes
```

Test `/api/health` first to verify the server is running!
