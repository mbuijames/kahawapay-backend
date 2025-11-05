// src/utils/fetchRates.js
// Plain JS (ESM) version — safe to run with Node + esbuild (no TypeScript syntax)

const DEFAULT_API = (process.env.VITE_RATES_API_URL || "https://kahawapay-backend.onrender.com").replace(/\/$/, "");
const ENDPOINT = `${DEFAULT_API}/api/rates`;

/**
 * fetchRates({ baseUrl }) -> returns a normalized object:
 * { rates: { ... }, fetchedAt: string|null, source: string|null, raw: any }
 */
export async function fetchRates({ baseUrl } = {}) {
  const url = (baseUrl || ENDPOINT).replace(/\/$/, "");
  try {
    // use global fetch (Node 18+ or polyfilled by bundler). If unavailable, swap to node-fetch/axios.
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) throw new Error("unexpected HTML response (wrong host)");
    const json = await res.json();

    const normalized = {
      rates: (json?.rates || json?.data || {}) ,
      fetchedAt: (json?.fetchedAt || json?.lastUpdated || json?.fetched_at) ?? new Date().toISOString(),
      source: json?.source ?? null,
      raw: json,
    };
    return normalized;
  } catch (err) {
    throw new Error(err && err.message ? err.message : String(err));
  }
}
