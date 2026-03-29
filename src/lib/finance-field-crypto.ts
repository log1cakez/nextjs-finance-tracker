import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Same env as transaction payloads: one app key + per-user AAD.
 * Encrypts finance fields at rest (except category names and user name/email).
 */
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const STRING_VERSION = 1;
const JSON_VERSION = 1;

/** Plaintext string fields (account name, recurring name, etc.) */
const TEXT_PREFIX = "fn1:";
/** JSON blobs (lending row, payment row) */
const JSON_PREFIX = "fj1:";

function getKey(): Buffer {
  const raw = process.env.TRANSACTIONS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "TRANSACTIONS_ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) {
    return decoded;
  }
  return scryptSync(raw, "finance-field-crypto-v1", 32);
}

function seal(userId: string, utf8: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const enc = Buffer.concat([cipher.update(utf8, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function open(userId: string, b64: string): string {
  const key = getKey();
  const buf = Buffer.from(b64, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted finance field");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  decipher.setAAD(Buffer.from(userId, "utf8"));
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function encryptFinancePlaintext(userId: string, plain: string): string {
  const body = JSON.stringify({ v: STRING_VERSION, s: plain });
  return TEXT_PREFIX + seal(userId, body);
}

/** Legacy DB rows store raw UTF-8 without prefix. */
export function decryptFinancePlaintext(userId: string, stored: string): string {
  if (!stored.startsWith(TEXT_PREFIX)) {
    return stored;
  }
  const inner = open(userId, stored.slice(TEXT_PREFIX.length));
  const obj = JSON.parse(inner) as { v?: number; s?: string };
  if (obj.v !== STRING_VERSION || typeof obj.s !== "string") {
    throw new Error("Malformed encrypted finance text");
  }
  return obj.s;
}

export function encryptFinanceObject(userId: string, data: unknown): string {
  const body = JSON.stringify({ v: JSON_VERSION, d: data });
  return JSON_PREFIX + seal(userId, body);
}

export function decryptFinanceObject<T>(userId: string, stored: string): T {
  if (!stored.startsWith(JSON_PREFIX)) {
    throw new Error("Expected encrypted finance object");
  }
  const inner = open(userId, stored.slice(JSON_PREFIX.length));
  const obj = JSON.parse(inner) as { v?: number; d?: unknown };
  if (obj.v !== JSON_VERSION) {
    throw new Error("Unsupported finance object version");
  }
  return obj.d as T;
}

/** True if this string was written by encryptFinancePlaintext. */
export function isEncryptedFinancePlaintext(stored: string): boolean {
  return stored.startsWith(TEXT_PREFIX);
}

export function isEncryptedFinanceObject(stored: string): boolean {
  return stored.startsWith(JSON_PREFIX);
}
