/**
 * Client-side encryption utilities using Web Crypto API
 */

const ITERATIONS = 100000;
const KEY_LEN = 256;

export async function deriveKey(password: string, salt: string) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LEN },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(data: string, key: CryptoKey) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(data)
  );

  return {
    content: b64Encode(new Uint8Array(encrypted)),
    iv: b64Encode(iv),
  };
}

export async function decryptData(encryptedB64: string, ivB64: string, key: CryptoKey) {
  const encrypted = b64Decode(encryptedB64);
  const iv = b64Decode(ivB64);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    throw new Error("Decryption failed. Invalid key or corrupted data.");
  }
}

function b64Encode(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function b64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSalt() {
  return b64Encode(window.crypto.getRandomValues(new Uint8Array(16)));
}
