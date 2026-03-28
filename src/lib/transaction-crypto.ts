import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const VERSION = 1;
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

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
  return scryptSync(raw, "finance-txn-payload-v1", 32);
}

type PayloadBody = { v: number; d: string; a: number };

export function encryptTransactionPayload(
  userId: string,
  data: { description: string; amountCents: number },
): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const body: PayloadBody = {
    v: VERSION,
    d: data.description,
    a: data.amountCents,
  };
  const enc = Buffer.concat([
    cipher.update(JSON.stringify(body), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptTransactionPayload(
  userId: string,
  b64: string,
): { description: string; amountCents: number } {
  const key = getKey();
  const buf = Buffer.from(b64, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted transaction payload");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  decipher.setAAD(Buffer.from(userId, "utf8"));
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  const obj = JSON.parse(dec.toString("utf8")) as PayloadBody;
  if (obj.v !== VERSION) {
    throw new Error("Unsupported transaction payload version");
  }
  if (typeof obj.d !== "string" || typeof obj.a !== "number") {
    throw new Error("Malformed transaction payload");
  }
  return { description: obj.d, amountCents: obj.a };
}
