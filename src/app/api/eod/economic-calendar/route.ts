import { auth } from "@/auth";
import { isEnvDevRuntime } from "@/lib/app-runtime-mode";

export const runtime = "nodejs";

type TradingEconomicsCalendarItem = {
  CalendarId?: string | number;
  Date?: string;
  Country?: string;
  Currency?: string;
  Symbol?: string;
  Category?: string;
  Event?: string;
  Actual?: string;
  Previous?: string;
  Forecast?: string;
  Importance?: number | string;
  URL?: string;
};

function sanitizeLimit(raw: string | null): number {
  const n = Number(raw ?? "");
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(5, Math.trunc(n)));
}

function sanitizeImportance(raw: string | null): "1" | "2" | "3" {
  if (raw === "1" || raw === "2" || raw === "3") return raw;
  return "3";
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const apiKey =
    process.env.TRADING_ECONOMICS_API_KEY?.trim() ||
    process.env.TRADINGECONOMICS_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Economic calendar needs TRADING_ECONOMICS_API_KEY on the server. Add it to .env.local and restart.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const limit = sanitizeLimit(url.searchParams.get("limit"));
  const importance = sanitizeImportance(url.searchParams.get("importance"));

  const teUrl = new URL("https://api.tradingeconomics.com/calendar");
  teUrl.searchParams.set("c", apiKey);
  teUrl.searchParams.set("f", "json");
  teUrl.searchParams.set("importance", importance);

  const fetchCalendar = async (credential: string) => {
    teUrl.searchParams.set("c", credential);
    const res = await fetch(teUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const raw = await res.text();
    return { ok: res.ok, status: res.status, raw };
  };

  let upstream = await fetchCalendar(apiKey);
  let sourceCredential: "configured" | "guest" = "configured";
  if (!upstream.ok && isEnvDevRuntime()) {
    const fallback = await fetchCalendar("guest:guest");
    if (fallback.ok) {
      upstream = fallback;
      sourceCredential = "guest";
    }
  }

  if (!upstream.ok) {
    return Response.json(
      {
        error: "TradingEconomics API returned an error.",
        detail: upstream.raw.slice(0, 500) || undefined,
        upstreamStatus: upstream.status,
      },
      { status: 502 },
    );
  }

  let body: TradingEconomicsCalendarItem[] = [];
  try {
    body = JSON.parse(upstream.raw) as TradingEconomicsCalendarItem[];
  } catch {
    return Response.json(
      {
        error: "TradingEconomics response was not valid JSON.",
      },
      { status: 502 },
    );
  }
  const events = (Array.isArray(body) ? body : [])
    .filter((row) => typeof row?.Event === "string" && typeof row?.Date === "string")
    .sort((a, b) => {
      const ad = new Date(a.Date ?? "").getTime();
      const bd = new Date(b.Date ?? "").getTime();
      return ad - bd;
    })
    .slice(0, limit)
    .map((row) => ({
      id: String(row.CalendarId ?? ""),
      date: row.Date ?? "",
      country: row.Country ?? "",
      currency: row.Currency ?? "",
      symbol: row.Symbol ?? "",
      category: row.Category ?? "",
      event: row.Event ?? "",
      actual: row.Actual ?? "",
      previous: row.Previous ?? "",
      forecast: row.Forecast ?? "",
      importance: Number(row.Importance ?? 0) || 0,
      url: row.URL ?? "",
    }));

  return Response.json({
    events,
    fetchedAt: new Date().toISOString(),
    importance,
    sourceCredential,
  });
}
