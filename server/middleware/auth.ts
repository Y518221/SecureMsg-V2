import { supabaseAuth } from "../lib/supabase.js";

export const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.userId = user.id;
    req.authUser = user;
    next();
  } catch (e: any) {
    const code = e?.cause?.code || e?.code;
    const isNetworkFailure = code === "UND_ERR_CONNECT_TIMEOUT" || code === "ECONNRESET" || code === "ETIMEDOUT";
    if (isNetworkFailure) {
      return res.status(503).json({ error: "Auth service temporarily unavailable. Please retry." });
    }
    console.error("Auth middleware error:", e);
    return res.status(500).json({ error: "Authentication failed" });
  }
};
