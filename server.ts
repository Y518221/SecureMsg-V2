import express from "express";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "path";
import { createServer as createViteServer } from "vite";
import authRoutes from "./server/routes/authRoutes.js";
import messageRoutes from "./server/routes/messageRoutes.js";
import groupRoutes from "./server/routes/groupRoutes.js";
import { supabase } from "./server/lib/supabase.js";
import { encryptServer } from "./server/lib/serverCrypto.js";

const app = express();
const isDev = process.env.NODE_ENV !== "production";
const requestedPort = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// Middleware - Order matters!
// 1. Body parsing middleware (must be first to parse JSON)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 2. CORS middleware (enable cross-origin requests from frontend)
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// 3. Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 4. API Routes (must be before static file serving)
console.log("[SERVER] Registering API routes...");
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Bot Logic (Simplified for Supabase)
const BOTS = [
  { id: "00000000-0000-0000-0000-000000000001", secure_id: "SECURE-BOT-999", username: "Support Bot" },
];

async function ensureBots() {
  try {
    const legacyBotId = "00000000-0000-0000-0000-000000000002";
    await supabase.from("users").delete().eq("id", legacyBotId);

    const botRows = BOTS.map((b) => ({
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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[ERROR]", err);
  res.status(500).json({ error: "Internal server error" });
});

// Main server setup
async function startServer() {
  console.log(`[SERVER] Starting in ${isDev ? "DEVELOPMENT" : "PRODUCTION"} mode...`);
  const httpServer = createHttpServer(app);

  // Check for required environment variables
  const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MASTER_ENCRYPTION_KEY"];
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[ERROR] Missing environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  await ensureBots();

  if (isDev) {
    console.log("[SERVER] Setting up Vite dev middleware...");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve dist folder
    console.log("[SERVER] Serving static files from dist folder...");
    const distPath = path.resolve("dist");
    console.log("[SERVER] dist folder path:", distPath);

    app.use(express.static(distPath));

    // 5. SPA Fallback (must be last - catch-all route)
    app.get("*", (req, res) => {
      console.log(`[SPA] Serving index.html for route: ${req.path}`);
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const activePort = await listenWithFallback(httpServer, requestedPort);
  const address = formatAddress(HOST, activePort);

  console.log("\n+------------------------------------------+");
  console.log("|  SecureMsg Server Ready                  |");
  console.log(`|  Port: ${activePort.toString().padEnd(33)}|`);
  console.log(`|  Environment: ${(isDev ? "DEV" : "PROD").padEnd(26)}|`);
  console.log(`|  API: ${`${address}/api`.padEnd(34)}|`);
  console.log("+------------------------------------------+\n");
}

async function listenWithFallback(server: ReturnType<typeof createHttpServer>, port: number) {
  const maxAttempts = isDev ? 10 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidatePort = port + attempt;
    try {
      return await listen(server, candidatePort);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "EADDRINUSE" || attempt === maxAttempts - 1) {
        throw error;
      }

      console.warn(`[SERVER] Port ${candidatePort} is already in use. Trying ${candidatePort + 1}...`);
    }
  }

  return port;
}

function listen(server: ReturnType<typeof createHttpServer>, port: number) {
  return new Promise<number>((resolve, reject) => {
    const cleanup = () => {
      server.off("error", onError);
      server.off("listening", onListening);
    };
    const onError = (error: NodeJS.ErrnoException) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      const address = server.address() as AddressInfo | string | null;
      resolve(typeof address === "object" && address ? address.port : port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, HOST);
  });
}

function formatAddress(host: string, port: number) {
  const hostname = host === "0.0.0.0" ? "localhost" : host;
  return `http://${hostname}:${port}`;
}

startServer().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
