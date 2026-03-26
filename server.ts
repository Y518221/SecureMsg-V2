import express from "express";
import { createServer as createViteServer } from "vite";
import authRoutes from "./server/routes/authRoutes";
import messageRoutes from "./server/routes/messageRoutes";
import groupRoutes from "./server/routes/groupRoutes";
import { supabase } from "./server/lib/supabase";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

import { encryptServer } from "./server/lib/serverCrypto";

// Bot Logic (Simplified for Supabase)
const BOTS = [
  { id: "00000000-0000-0000-0000-000000000001", secure_id: "SECURE-BOT-999", username: "Support Bot" }
];

async function ensureBots() {
  try {
    // Remove legacy extra bot if it exists.
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

// Vite Middleware
async function startServer() {
  // Check for required environment variables
  const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MASTER_ENCRYPTION_KEY'];
  const missing = requiredEnv.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`CRITICAL: Missing environment variables: ${missing.join(', ')}`);
    console.error("The application may fail to interact with Supabase.");
  }

  await ensureBots();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(3000, "0.0.0.0");
}

startServer();
