# Minimal Working Express Backend Example for Render

This is a complete working example showing the proper structure for your SecureMsg backend deployment on Render.

## Key Principles

1. **Middleware Order Matters**
   - Body parsing first
   - CORS headers second  
   - API routes third
   - Static files fourth
   - Catch-all SPA route last

2. **Environment Detection**
   - Check `NODE_ENV === "production"` to determine serving strategy
   - On Render, set `NODE_ENV=production` in environment variables

3. **Proper Logging**
   - Log all incoming requests in development
   - Log startup configuration
   - Log errors with context

4. **Port Binding**
   - Bind to `0.0.0.0:PORT` not `localhost`
   - Render sets the PORT environment variable

## Complete server.ts Example

```typescript
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import authRoutes from "./server/routes/authRoutes";
import messageRoutes from "./server/routes/messageRoutes";
import groupRoutes from "./server/routes/groupRoutes";
import { supabase } from "./server/lib/supabase";
import { encryptServer } from "./server/lib/serverCrypto";

const app = express();
const isDev = process.env.NODE_ENV !== "production";
const PORT = Number(process.env.PORT) || 3000;

// ============================================
// MIDDLEWARE - ORDER IS CRITICAL
// ============================================

// 1. Body parsing (MUST be first)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. CORS Headers (MUST be before API routes)
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 3. Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ============================================
// API ROUTES (MUST be before static files)
// ============================================

console.log('[SERVER] Registering API routes...');
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================
// BOT INITIALIZATION
// ============================================

const BOTS = [
  { 
    id: "00000000-0000-0000-0000-000000000001", 
    secure_id: "SECURE-BOT-999", 
    username: "Support Bot" 
  }
];

async function ensureBots() {
  try {
    const legacyBotId = "00000000-0000-0000-0000-000000000002";
    await supabase.from("users").delete().eq("id", legacyBotId);

    const botRows = BOTS.map(b => ({
      id: b.id,
      secure_id: b.secure_id,
      username: encryptServer(b.username),
    }));
    
    const { error } = await supabase
      .from("users")
      .upsert(botRows, { onConflict: "id" });
    
    if (error) console.error("Error upserting bots:", error);
  } catch (e) {
    console.error("ensureBots failed:", e);
  }
}

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[ERROR]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  console.log(`[SERVER] Starting in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode...`);
  
  // Validate required environment variables
  const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MASTER_ENCRYPTION_KEY'];
  const missing = requiredEnv.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`[ERROR] Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  await ensureBots();

  if (isDev) {
    // ============================================
    // DEVELOPMENT MODE: Use Vite dev server
    // ============================================
    console.log('[SERVER] Setting up Vite dev middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // ============================================
    // PRODUCTION MODE: Serve static files
    // ============================================
    console.log('[SERVER] Serving static files from dist folder...');
    const distPath = path.resolve("dist");
    console.log('[SERVER] dist folder path:', distPath);
    
    // Serve all static files from dist
    app.use(express.static(distPath));
    
    // 4. SPA CATCH-ALL (MUST be last)
    // Redirect all non-API routes to index.html for client-side routing
    app.get("*", (req, res) => {
      console.log(`[SPA] Serving index.html for route: ${req.path}`);
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  // Start listening
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║  SecureMsg Server Ready                ║`);
    console.log(`║  Port: ${PORT.toString().padEnd(31)}║`);
    console.log(`║  Environment: ${(isDev ? 'DEV' : 'PROD').padEnd(27)}║`);
    console.log(`║  API: http://0.0.0.0:${PORT}/api     ║`);
    console.log(`╚════════════════════════════════════════╝\n`);
  });
}

// Start the server and handle errors
startServer().catch(err => {
  console.error("[FATAL]", err);
  process.exit(1);
});
```

## Frontend API Service Example

```typescript
// src/services/api.ts - Determine API base URL dynamically
const getApiBase = () => {
  // In development or on same origin, use relative URLs
  if (!window.location.hostname.includes('onrender.com') && 
      !window.location.hostname.includes('vercel.app')) {
    return '';
  }
  // On Render/production, explicitly use the origin
  return window.location.origin;
};

const API_BASE = getApiBase();

const buildUrl = (path: string): string => {
  return `${API_BASE}${path}`;
};

export const api = {
  async post(url: string, body: any, token?: string) {
    const fullUrl = buildUrl(url);
    console.log('[API POST]', fullUrl);
    
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const text = await res.text();
      let errorMsg = "Request failed";
      try {
        const data = JSON.parse(text);
        errorMsg = data.error || data.message || errorMsg;
      } catch (e) {
        errorMsg = text || errorMsg;
      }
      console.error('[API ERROR]', fullUrl, res.status, errorMsg);
      throw new Error(errorMsg);
    }
    return res.json();
  }
};
```

## package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch --tsconfig tsconfig.server.json server.ts",
    "start": "tsx --tsconfig tsconfig.server.json server.ts",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist"
  }
}
```

## Render Dashboard Configuration

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Environment Variables:**
- `NODE_ENV` = `production`
- `PORT` = (automatically set by Render, default 3000)
- `SUPABASE_URL` = your-url
- `SUPABASE_SERVICE_ROLE_KEY` = your-key
- `MASTER_ENCRYPTION_KEY` = your-key
- `JWT_SECRET` = your-secret
- `GEMINI_API_KEY` = your-key

## Testing the Deployment

### Local Test (Production Build)
```bash
npm run build
NODE_ENV=production npm start

# Test in another terminal
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

### After Deploying to Render
```bash
# Test health endpoint
curl https://securemsg-34jy.onrender.com/api/health

# Test login endpoint
curl -X POST https://securemsg-34jy.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Test frontend loads
curl https://securemsg-34jy.onrender.com
```

## Why This Works

1. **Routes are registered before static files** - Express will match `/api/*` routes before serving static files
2. **CORS headers are set before routes** - Browsers receive proper CORS headers for cross-origin requests
3. **SPA catch-all is last** - Client-side routes like `/chat` or `/settings` get handled by React Router
4. **Proper PORT binding** - Listening on `0.0.0.0` makes the service accessible from outside the container
5. **Environment-based serving** - Dev mode uses Vite, production serves from dist folder
6. **Comprehensive logging** - You can see exactly what's happening from Render logs

## Common Mistakes to Avoid

❌ **Wrong middleware order:**
```typescript
// DON'T DO THIS - static files first will catch /api routes
app.use(express.static("dist"));
app.use("/api/auth", authRoutes);
```

❌ **Missing NODE_ENV:**
```typescript
// This will fail - NODE_ENV is undefined
if (process.env.NODE_ENV === "production") // undefined !== "production"
```

❌ **Binding to localhost:**
```typescript
// DON'T - Render can't access localhost
app.listen(3000, "localhost");
```

✅ **Correct:**
```typescript
// Right - Bind to 0.0.0.0 so Render can access it
app.listen(PORT, "0.0.0.0", () => { ... });
```
