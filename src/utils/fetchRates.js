// src/utils/fetchRates.ts
// Minimal TypeScript conversion of your fetch helper used by the hero.
// Named export `fetchRates` to match the component import.

export type RatesPayload = {
  rates?: Record<string, number | string>;
  fetchedAt?: string;
  fetched_at?: string;
  lastUpdated?: string;
  source?: string;
  [k: string]: any;
};

export type RatesNormalized = {
  rates: Record<string, number | string>;
  fetchedAt: string | null;
  source?: string | null;
  raw?: any;
};

const DEFAULT_API = (import.meta.env.VITE_RATES_API_URL || "https://kahawapay-backend.onrender.com").replace(/\/$/, "");
const ENDPOINT = `${DEFAULT_API}/api/rates`;

export async function fetchRates({ baseUrl }: { baseUrl?: string } = {}): Promise<RatesNormalized> {
  const url = (baseUrl || ENDPOINT).replace(/\/$/, "");
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) throw new Error("unexpected HTML response (wrong host)");
    const json = (await res.json()) as RatesPayload;

    const normalized: RatesNormalized = {
      rates: (json?.rates || json?.data || {}) as Record<string, number | string>,
      fetchedAt: (json?.fetchedAt || json?.lastUpdated || json?.fetched_at) ?? new Date().toISOString(),
      source: json?.source ?? null,
      raw: json,
    };
    return normalized;
  } catch (err: unknown) {
    // rethrow as Error to simplify upstream handling
    throw new Error((err as Error)?.message ?? String(err));
  }
}
