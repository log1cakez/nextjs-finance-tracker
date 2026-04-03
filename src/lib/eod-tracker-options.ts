/** Labels + pill colors for EOD Tracker (aligned with your UI reference). */

export const EOD_SESSION_OPTIONS = [
  "New York",
  "Pre-NY",
  "London lull",
  "London",
  "Frankfurt",
  "Asia",
] as const;

export const EOD_TIMEFRAME_EOF_OPTIONS = [
  "M15 Wedge",
  "M15 Bearish",
  "M15 Bullish",
  "4H Bearish",
  "4H Bullish",
  "Daily Bearish",
  "Daily Bullish",
] as const;

export const EOD_POI_OPTIONS = [
  "Swept Session LQ",
  "LQ",
  "IDM",
  "Extreme",
  "Chain",
  "Sweepless Flip",
  "Flip",
] as const;

export const EOD_TREND_OPTIONS = [
  "Pro",
  "Continuation",
  "Scale-In",
  "Wedge",
  "Reversal",
  "Counter",
] as const;

export const EOD_POSITION_OPTIONS = ["Short", "Long"] as const;

export const EOD_RISK_TYPE_OPTIONS = ["Least agg.", "Aggressive", "Risk Entry"] as const;

export const EOD_RESULT_OPTIONS = [
  "Data",
  "EOD",
  "Front Run",
  "Win",
  "Loss",
  "Break Even",
] as const;

export const EOD_RRR_OPTIONS = [
  "above 50",
  "+40",
  "+30",
  "+20",
  "+10",
  "below 10",
] as const;

export const EOD_ENTRY_TF_OPTIONS = ["1m", "5m", "15m", "30m", "1H", "4H", "Daily"] as const;

export type EodPillTone =
  | "blue"
  | "purple"
  | "violet"
  | "amber"
  | "brown"
  | "red"
  | "green"
  | "grey"
  | "slate"
  | "pink"
  | "cyan"
  | "emerald";

/** Map each option label to a tone (used for Tailwind pill classes). */
const SESSION_TONE: Record<(typeof EOD_SESSION_OPTIONS)[number], EodPillTone> = {
  "New York": "blue",
  "Pre-NY": "purple",
  "London lull": "amber",
  London: "brown",
  Frankfurt: "red",
  Asia: "grey",
};

const TF_EOF_TONE: Partial<Record<string, EodPillTone>> = {
  "M15 Wedge": "grey",
  "M15 Bearish": "red",
  "M15 Bullish": "blue",
  "4H Bearish": "red",
  "4H Bullish": "blue",
  "Daily Bearish": "red",
  "Daily Bullish": "blue",
};

const POI_TONE: Partial<Record<string, EodPillTone>> = {
  "Swept Session LQ": "violet",
  LQ: "red",
  IDM: "blue",
  Extreme: "brown",
  Chain: "green",
  "Sweepless Flip": "slate",
  Flip: "grey",
};

const TREND_TONE: Partial<Record<string, EodPillTone>> = {
  Pro: "blue",
  Continuation: "pink",
  "Scale-In": "purple",
  Wedge: "grey",
  Reversal: "brown",
  Counter: "red",
};

const POSITION_TONE: Partial<Record<string, EodPillTone>> = {
  Short: "red",
  Long: "green",
};

const RISK_TONE: Partial<Record<string, EodPillTone>> = {
  "Least agg.": "blue",
  Aggressive: "brown",
  "Risk Entry": "red",
};

const RESULT_TONE: Partial<Record<string, EodPillTone>> = {
  Data: "violet",
  EOD: "grey",
  "Front Run": "blue",
  Win: "green",
  Loss: "red",
  "Break Even": "slate",
};

const RRR_TONE: Partial<Record<string, EodPillTone>> = {
  "above 50": "violet",
  "+40": "brown",
  "+30": "amber",
  "+20": "purple",
  "+10": "grey",
  "below 10": "emerald",
};

const ENTRY_TF_TONE: Partial<Record<string, EodPillTone>> = {
  "1m": "red",
  "5m": "amber",
  "15m": "blue",
  "30m": "cyan",
  "1H": "purple",
  "4H": "brown",
  Daily: "grey",
};

export function getEodOptionTone(field: string, value: string): EodPillTone {
  switch (field) {
    case "weekday":
      return "grey";
    case "session":
      return SESSION_TONE[value as keyof typeof SESSION_TONE] ?? "grey";
    case "timeframeEof":
      return TF_EOF_TONE[value] ?? "grey";
    case "poi":
      return POI_TONE[value] ?? "grey";
    case "trend":
      return TREND_TONE[value] ?? "grey";
    case "position":
      return POSITION_TONE[value] ?? "grey";
    case "riskType":
      return RISK_TONE[value] ?? "grey";
    case "result":
      return RESULT_TONE[value] ?? "grey";
    case "rrr":
      return RRR_TONE[value] ?? "grey";
    case "entryTf":
      return ENTRY_TF_TONE[value] ?? "grey";
    default:
      return "grey";
  }
}

const toneClass: Record<EodPillTone, string> = {
  blue: "bg-blue-600/30 text-blue-100 border-blue-500/45",
  purple: "bg-purple-600/30 text-purple-100 border-purple-500/45",
  violet: "bg-violet-600/30 text-violet-100 border-violet-500/45",
  amber: "bg-amber-600/30 text-amber-100 border-amber-500/45",
  brown: "bg-amber-900/40 text-amber-50 border-amber-700/50",
  red: "bg-red-600/30 text-red-100 border-red-500/45",
  green: "bg-emerald-600/30 text-emerald-100 border-emerald-500/45",
  grey: "bg-zinc-600/30 text-zinc-100 border-zinc-500/45",
  slate: "bg-slate-600/35 text-slate-100 border-slate-500/45",
  pink: "bg-pink-700/35 text-pink-50 border-pink-600/45",
  cyan: "bg-cyan-600/30 text-cyan-50 border-cyan-500/45",
  emerald: "bg-emerald-800/40 text-emerald-50 border-emerald-700/45",
};

export function eodPillClass(tone: EodPillTone, opts?: { wrap?: boolean }): string {
  const layout = opts?.wrap
    ? "inline-block max-w-full whitespace-normal break-words align-top"
    : "inline-flex";
  return `${layout} rounded border px-2 py-0.5 ${toneClass[tone]}`;
}
