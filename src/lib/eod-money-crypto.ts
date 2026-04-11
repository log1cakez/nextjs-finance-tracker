import { decryptFinanceObject, encryptFinanceObject } from "@/lib/finance-field-crypto";

type EodCentsBlob = { c: number };

export function tradingMoneyEncryptionConfigured(): boolean {
  return Boolean(process.env.TRANSACTIONS_ENCRYPTION_KEY?.trim());
}

/** Persisted as JSON inside `encryptFinanceObject` (same envelope as other finance blobs). */
export function sealTradingCents(userId: string, cents: number): string {
  return encryptFinanceObject(userId, { c: Math.trunc(cents) } satisfies EodCentsBlob);
}

/**
 * Prefer ciphertext column; fall back to legacy integer cleartext (pre-migration / dev without key).
 */
export function openTradingCents(
  userId: string,
  payload: string | null | undefined,
  legacyCents: number | null | undefined,
): number | null {
  const p = payload?.trim();
  if (p) {
    const { c } = decryptFinanceObject<EodCentsBlob>(userId, p);
    if (typeof c !== "number" || !Number.isFinite(c)) {
      throw new Error("Invalid encrypted trading amount");
    }
    return Math.trunc(c);
  }
  if (legacyCents == null) return null;
  return legacyCents;
}

export function persistTradingCents(
  userId: string,
  cents: number | null,
): { netPnlCents: number | null; netPnlPayload: string | null } {
  if (cents === null) {
    return { netPnlCents: null, netPnlPayload: null };
  }
  if (!tradingMoneyEncryptionConfigured()) {
    return { netPnlCents: cents, netPnlPayload: null };
  }
  return { netPnlCents: null, netPnlPayload: sealTradingCents(userId, cents) };
}

export function persistInitialCapitalCents(
  userId: string,
  cents: number,
): { initialCapitalCents: number | null; initialCapitalPayload: string | null } {
  if (!tradingMoneyEncryptionConfigured()) {
    return { initialCapitalCents: cents, initialCapitalPayload: null };
  }
  return { initialCapitalCents: null, initialCapitalPayload: sealTradingCents(userId, cents) };
}

export function openInitialCapitalCents(
  userId: string,
  payload: string | null | undefined,
  legacyCents: number | null | undefined,
): number {
  const v = openTradingCents(userId, payload, legacyCents);
  return v ?? 0;
}
