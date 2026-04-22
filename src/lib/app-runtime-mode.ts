function normalizeMode(raw: string | undefined | null): "dev" | "prod" {
  const t = raw?.trim().toLowerCase();
  return t === "dev" ? "dev" : "prod";
}

/** From `MIDAS_RUNTIME_MODE`. Defaults to prod when unset. */
export function getEnvRuntimeMode(): "dev" | "prod" {
  return normalizeMode(process.env.MIDAS_RUNTIME_MODE);
}

export function isEnvDevRuntime(): boolean {
  return getEnvRuntimeMode() === "dev";
}

/** Server has an OpenAI key (EOD AI month review). */
export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Server has TradingEconomics key (EOD economic calendar). */
export function isTradingEconomicsConfigured(): boolean {
  return Boolean(
    process.env.TRADING_ECONOMICS_API_KEY?.trim() ||
      process.env.TRADINGECONOMICS_API_KEY?.trim(),
  );
}
