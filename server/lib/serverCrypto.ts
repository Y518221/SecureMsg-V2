import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const KEY = process.env.MASTER_ENCRYPTION_KEY 
  ? Buffer.from(process.env.MASTER_ENCRYPTION_KEY, "hex") 
  : crypto.randomBytes(32); // Fallback for dev, but will lose data on restart if not set

export function encryptServer(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptServer(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(":");
    if (!ivHex || !encrypted) return encryptedText; // Not encrypted or old data
    
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    console.error("Server decryption failed:", e);
    return encryptedText; // Return original if decryption fails (e.g. old plain text data)
  }
}
