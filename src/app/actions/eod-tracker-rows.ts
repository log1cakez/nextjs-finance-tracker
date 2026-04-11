"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { eodTrackerRows, eodTradingAccounts, users } from "@/db/schema";
import {
  EOD_ENTRY_TF_OPTIONS,
  EOD_POI_OPTIONS,
  EOD_POSITION_OPTIONS,
  EOD_RESULT_OPTIONS,
  EOD_RISK_TYPE_OPTIONS,
  EOD_RRR_OPTIONS,
  EOD_SESSION_OPTIONS,
  EOD_TIMEFRAME_EOF_OPTIONS,
  EOD_TREND_OPTIONS,
} from "@/lib/eod-tracker-options";
import { openTradingCents, persistTradingCents } from "@/lib/eod-money-crypto";
import { getSessionUserId } from "@/lib/session";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingRowsTable(error: unknown): boolean {
  const msg = errorText(error).toLowerCase();
  const e = error as { cause?: { code?: string } };
  return (
    e?.cause?.code === "42P01" ||
    (msg.includes("eod_tracker_row") &&
      (msg.includes("does not exist") || msg.includes("relation")))
  );
}

function isMissingUserForeignKey(error: unknown): boolean {
  const msg = errorText(error).toLowerCase();
  const e = error as { cause?: { code?: string; detail?: string } };
  const code = e?.cause?.code;
  const detail = (e?.cause?.detail ?? "").toLowerCase();
  if (code === "23503") {
    return (
      detail.includes("user") ||
      detail.includes("user_id") ||
      msg.includes("eod_tracker_row_user_id")
    );
  }
  return (
    msg.includes("23503") &&
    (msg.includes("eod_tracker_row_user_id") || msg.includes("violates foreign key"))
  );
}

/** Missing `notion_url` (or related 0021 migration) on `eod_tracker_row`. */
function needsEodNotionUrlMigration(error: unknown): boolean {
  const msg = errorText(error).toLowerCase();
  const e = error as { cause?: { code?: string } };
  if (msg.includes("notion_url") && (msg.includes("does not exist") || msg.includes("unknown"))) {
    return true;
  }
  return e?.cause?.code === "42703" && msg.includes("eod_tracker_row");
}

function parseJsonStringArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) {
      return [];
    }
    return v.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function parseLegacyTimeToken(token: string): string | null {
  const t = token.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  const m24 = t.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) {
    return `${m24[1].padStart(2, "0")}:${m24[2]}`;
  }
  const m12 = t.match(/^(\d{1,2})(?::([0-5]\d))?(am|pm)$/);
  if (!m12) return null;
  const hRaw = Number(m12[1]);
  if (hRaw < 1 || hRaw > 12) return null;
  const mm = (m12[2] ?? "00").padStart(2, "0");
  let h24 = hRaw % 12;
  if (m12[3] === "pm") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${mm}`;
}

function normalizeTimeRange(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const parts = v.split(/\s*[-–—]\s*/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) {
    return parseLegacyTimeToken(parts[0]) ?? v;
  }
  const start = parseLegacyTimeToken(parts[0]);
  const end = parseLegacyTimeToken(parts[1]);
  if (!start || !end) return v;
  return `${start}-${end}`;
}

async function ensureSessionUserRow(userId: string): Promise<{ ok: true } | { error: string }> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { error: "Your session is missing an email. Sign out and sign in again." };
  }
  await getDb()
    .insert(users)
    .values({
      id: userId,
      email,
      name: session?.user?.name ?? null,
      image: session?.user?.image ?? null,
    })
    .onConflictDoNothing({ target: users.id });
  return { ok: true };
}

const optionalFrom = <T extends readonly string[]>(list: T) =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (v === "") return true;
      return v
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean)
        .every((x) => (list as readonly string[]).includes(x));
    }, "Invalid value");

const multiFrom = <T extends readonly string[]>(list: T) =>
  z
    .array(z.string())
    .refine((xs) => xs.every((x) => (list as readonly string[]).includes(x)), "Invalid tag");

const createPayloadSchema = z.object({
  tradeDate: z.string().min(1, "Pick a date"),
  session: optionalFrom(EOD_SESSION_OPTIONS),
  timeframeEof: multiFrom(EOD_TIMEFRAME_EOF_OPTIONS),
  poi: multiFrom(EOD_POI_OPTIONS),
  trend: optionalFrom(EOD_TREND_OPTIONS),
  position: optionalFrom(EOD_POSITION_OPTIONS),
  riskType: optionalFrom(EOD_RISK_TYPE_OPTIONS),
  result: multiFrom(EOD_RESULT_OPTIONS),
  rrr: optionalFrom(EOD_RRR_OPTIONS),
  timeRange: z.string(),
  entryTf: optionalFrom(EOD_ENTRY_TF_OPTIONS),
  remarks: z.string().max(5000),
  notionUrl: z
    .string()
    .max(2000)
    .refine((v) => {
      const t = v.trim();
      if (!t) return true;
      try {
        const u = new URL(t);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "Notion link must be a valid http(s) URL or empty"),
  tradingAccountId: z.string().uuid().nullish(),
  netPnlCents: z.number().int().nullish(),
});

export type EodTrackerRow = {
  id: string;
  tradingAccountId: string | null;
  netPnlCents: number | null;
  /** Joined label for exports and dashboard table; null when unassigned. */
  tradingAccountName: string | null;
  tradeDate: string;
  session: string;
  timeframeEof: string[];
  poi: string[];
  trend: string;
  position: string;
  riskType: string;
  result: string[];
  rrr: string;
  timeRange: string;
  entryTf: string;
  remarks: string;
  notionUrl: string;
  createdAt: string;
  updatedAt: string;
};

export async function listEodTrackerRows(): Promise<EodTrackerRow[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  try {
    const rows = await getDb()
      .select({
        id: eodTrackerRows.id,
        tradingAccountId: eodTrackerRows.tradingAccountId,
        netPnlCents: eodTrackerRows.netPnlCents,
        netPnlPayload: eodTrackerRows.netPnlPayload,
        tradeDate: eodTrackerRows.tradeDate,
        session: eodTrackerRows.session,
        timeframeEofJson: eodTrackerRows.timeframeEofJson,
        poiJson: eodTrackerRows.poiJson,
        trend: eodTrackerRows.trend,
        position: eodTrackerRows.position,
        riskType: eodTrackerRows.riskType,
        resultJson: eodTrackerRows.resultJson,
        rrr: eodTrackerRows.rrr,
        timeRange: eodTrackerRows.timeRange,
        entryTf: eodTrackerRows.entryTf,
        remarks: eodTrackerRows.remarks,
        notionUrl: eodTrackerRows.notionUrl,
        createdAt: eodTrackerRows.createdAt,
        updatedAt: eodTrackerRows.updatedAt,
        tradingAccountName: eodTradingAccounts.name,
      })
      .from(eodTrackerRows)
      .leftJoin(eodTradingAccounts, eq(eodTrackerRows.tradingAccountId, eodTradingAccounts.id))
      .where(eq(eodTrackerRows.userId, userId))
      .orderBy(desc(eodTrackerRows.updatedAt));
    const mapped = rows.map((r) => ({
      id: r.id,
      tradingAccountId: r.tradingAccountId ?? null,
      netPnlCents: openTradingCents(userId, r.netPnlPayload, r.netPnlCents),
      tradingAccountName: r.tradingAccountName ?? null,
      tradeDate: r.tradeDate.toISOString(),
      session: r.session,
      timeframeEof: parseJsonStringArray(r.timeframeEofJson),
      poi: parseJsonStringArray(r.poiJson),
      trend: r.trend,
      position: r.position,
      riskType: r.riskType,
      result: parseJsonStringArray(r.resultJson),
      rrr: r.rrr,
      timeRange: r.timeRange,
      entryTf: r.entryTf,
      remarks: r.remarks,
      notionUrl: r.notionUrl,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
    // Auto-convert legacy time strings (e.g. "10pm-2:30am") into canonical HH:MM-HH:MM.
    const toFix = mapped.filter((r) => normalizeTimeRange(r.timeRange) !== r.timeRange);
    if (toFix.length > 0) {
      await Promise.all(
        toFix.map((r) =>
          getDb()
            .update(eodTrackerRows)
            .set({ timeRange: normalizeTimeRange(r.timeRange), updatedAt: new Date() })
            .where(and(eq(eodTrackerRows.id, r.id), eq(eodTrackerRows.userId, userId))),
        ),
      );
      return mapped.map((r) => ({ ...r, timeRange: normalizeTimeRange(r.timeRange) }));
    }
    return mapped;
  } catch (error) {
    if (isMissingRowsTable(error)) {
      return [];
    }
    if (needsEodNotionUrlMigration(error)) {
      throw new Error(
        "EOD table is missing column notion_url. Run `npm run db:migrate` or `npm run db:push`, then refresh.",
      );
    }
    throw error;
  }
}

/**
 * Loads EOD rows for export (Excel). Does not mutate the database for legacy time formats;
 * normalized times appear only in the export payload.
 */
export async function getEodTrackerRowsForExcel(userId: string): Promise<EodTrackerRow[]> {
  try {
    const rows = await getDb()
      .select({
        id: eodTrackerRows.id,
        tradingAccountId: eodTrackerRows.tradingAccountId,
        netPnlCents: eodTrackerRows.netPnlCents,
        netPnlPayload: eodTrackerRows.netPnlPayload,
        tradeDate: eodTrackerRows.tradeDate,
        session: eodTrackerRows.session,
        timeframeEofJson: eodTrackerRows.timeframeEofJson,
        poiJson: eodTrackerRows.poiJson,
        trend: eodTrackerRows.trend,
        position: eodTrackerRows.position,
        riskType: eodTrackerRows.riskType,
        resultJson: eodTrackerRows.resultJson,
        rrr: eodTrackerRows.rrr,
        timeRange: eodTrackerRows.timeRange,
        entryTf: eodTrackerRows.entryTf,
        remarks: eodTrackerRows.remarks,
        notionUrl: eodTrackerRows.notionUrl,
        createdAt: eodTrackerRows.createdAt,
        updatedAt: eodTrackerRows.updatedAt,
        tradingAccountName: eodTradingAccounts.name,
      })
      .from(eodTrackerRows)
      .leftJoin(eodTradingAccounts, eq(eodTrackerRows.tradingAccountId, eodTradingAccounts.id))
      .where(eq(eodTrackerRows.userId, userId))
      .orderBy(desc(eodTrackerRows.updatedAt));

    return rows.map((r) => ({
      id: r.id,
      tradingAccountId: r.tradingAccountId ?? null,
      netPnlCents: openTradingCents(userId, r.netPnlPayload, r.netPnlCents),
      tradingAccountName: r.tradingAccountName ?? null,
      tradeDate: r.tradeDate.toISOString(),
      session: r.session,
      timeframeEof: parseJsonStringArray(r.timeframeEofJson),
      poi: parseJsonStringArray(r.poiJson),
      trend: r.trend,
      position: r.position,
      riskType: r.riskType,
      result: parseJsonStringArray(r.resultJson),
      rrr: r.rrr,
      timeRange: normalizeTimeRange(r.timeRange),
      entryTf: r.entryTf,
      remarks: r.remarks,
      notionUrl: r.notionUrl,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch (error) {
    if (isMissingRowsTable(error)) {
      return [];
    }
    if (needsEodNotionUrlMigration(error)) {
      throw new Error(
        "EOD table is missing column notion_url. Run `npm run db:migrate` or `npm run db:push`, then refresh.",
      );
    }
    throw error;
  }
}

function tradeDateFromInput(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return new Date();
  }
  return new Date(`${isoDate}T12:00:00.000Z`);
}

export type CreateEodRowInput = z.infer<typeof createPayloadSchema>;

export async function createEodTrackerRowWithData(
  input: CreateEodRowInput,
): Promise<{ id: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const parsed = createPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const d = parsed.data;
  const pnl = persistTradingCents(userId, d.netPnlCents ?? null);
  const values = {
    userId,
    tradeDate: tradeDateFromInput(d.tradeDate),
    tradingAccountId: d.tradingAccountId ?? null,
    netPnlCents: pnl.netPnlCents,
    netPnlPayload: pnl.netPnlPayload,
    session: d.session,
    timeframeEofJson: JSON.stringify(d.timeframeEof),
    poiJson: JSON.stringify(d.poi),
    trend: d.trend,
    position: d.position,
    riskType: d.riskType,
    resultJson: JSON.stringify(d.result),
    rrr: d.rrr,
    timeRange: normalizeTimeRange(d.timeRange),
    entryTf: d.entryTf,
    remarks: d.remarks.trim(),
    notionUrl: d.notionUrl.trim(),
  };

  const insert = async () =>
    getDb().insert(eodTrackerRows).values(values).returning({ id: eodTrackerRows.id });

  try {
    const [inserted] = await insert();
    if (!inserted) {
      return { error: "Could not create row" };
    }
    revalidatePath("/eod-tracker");
    return { id: inserted.id };
  } catch (error) {
    if (isMissingUserForeignKey(error)) {
      const ensured = await ensureSessionUserRow(userId);
      if ("error" in ensured) {
        return ensured;
      }
      try {
        const [inserted] = await insert();
        if (!inserted) {
          return { error: "Could not create row" };
        }
        revalidatePath("/eod-tracker");
        return { id: inserted.id };
      } catch {
        return {
          error:
            "Your session does not match this database (user record is missing). Sign out and sign in again, or point the app at the same database where your account exists.",
        };
      }
    }
    if (isMissingRowsTable(error)) {
      return {
        error:
          "EOD row table is missing or out of date. Run `npm run db:push` (or `npm run db:migrate`) then refresh.",
      };
    }
    if (needsEodNotionUrlMigration(error)) {
      return {
        error:
          "Database needs the latest EOD migration (notion_url). Run `npm run db:migrate` or `npm run db:push`, then try again.",
      };
    }
    throw error;
  }
}

export async function updateEodTrackerRowWithData(
  rowId: string,
  input: CreateEodRowInput,
): Promise<{ ok: true } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const parsed = createPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }
  const d = parsed.data;
  const pnl = persistTradingCents(userId, d.netPnlCents ?? null);
  try {
    const updated = await getDb()
      .update(eodTrackerRows)
      .set({
        tradeDate: tradeDateFromInput(d.tradeDate),
        tradingAccountId: d.tradingAccountId ?? null,
        netPnlCents: pnl.netPnlCents,
        netPnlPayload: pnl.netPnlPayload,
        session: d.session,
        timeframeEofJson: JSON.stringify(d.timeframeEof),
        poiJson: JSON.stringify(d.poi),
        trend: d.trend,
        position: d.position,
        riskType: d.riskType,
        resultJson: JSON.stringify(d.result),
        rrr: d.rrr,
        timeRange: normalizeTimeRange(d.timeRange),
        entryTf: d.entryTf,
        remarks: d.remarks.trim(),
        notionUrl: d.notionUrl.trim(),
        updatedAt: new Date(),
      })
      .where(and(eq(eodTrackerRows.id, rowId), eq(eodTrackerRows.userId, userId)))
      .returning({ id: eodTrackerRows.id });
    if (updated.length === 0) {
      return { error: "Row not found" };
    }
    revalidatePath("/eod-tracker");
    return { ok: true };
  } catch (error) {
    if (needsEodNotionUrlMigration(error)) {
      return {
        error:
          "Database needs the latest EOD migration (notion_url). Run `npm run db:migrate` or `npm run db:push`, then try again.",
      };
    }
    throw error;
  }
}

export async function deleteEodTrackerRow(rowId: string): Promise<{ ok: true } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  await getDb()
    .delete(eodTrackerRows)
    .where(and(eq(eodTrackerRows.id, rowId), eq(eodTrackerRows.userId, userId)));
  revalidatePath("/eod-tracker");
  return { ok: true };
}

