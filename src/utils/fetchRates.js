/* -------------------------------------------------------------------------- */
// File: src/utils/fetchRates.js
// Small, robust client for /api/rates on your backend.
// Exports: fetchRates() -> returns { btc_usd, kes_per_usd, ugx_per_usd, rates, source, lastUpdated, fetched_at }


export async function fetchRates({ baseUrl } = {}) {
// allow override by param or env var
const API_BASE = baseUrl || import.meta.env.VITE_RATES_API_URL || 'https://kahawapay-backend.onrender.com';
const url = `${API_BASE.replace(/\/$/, '')}/api/rates`;


// small helper — parse and normalise
const safeParse = (v) => {
if (v === null || v === undefined) return null;
if (typeof v === 'number') return v;
// strip non-digit except dot and minus
const cleaned = String(v).replace(/[\u00A0\s,]+/g, ' ').replace(/[^0-9.\-]/g, '');
const n = parseFloat(cleaned);
return Number.isFinite(n) ? n : null;
};


const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);
try {
const res = await fetch(url, { signal: controller.signal });
clearTimeout(timeout);
if (!res.ok) {
throw new Error(`Rates API ${res.status} ${res.statusText}`);
}
const payload = await res.json();


// tolerate different shapes from backend
const out = {
btc_usd: safeParse(payload.btc_usd ?? payload.bitcoinUsd ?? (payload.rates && payload.rates.bitcoin) ?? null),
kes_per_usd: safeParse(payload.kes_per_usd ?? payload.kesUsd ?? (payload.rates && payload.rates['KES/USD']) ?? null),
ugx_per_usd: safeParse(payload.ugx_per_usd ?? payload.ugxUsd ?? (payload.rates && payload.rates['UGX/USD']) ?? null),
inr_per_usd: safeParse(payload.inr_per_usd ?? payload.inrUsd ?? null),
tzs_per_usd: safeParse(payload.tzs_per_usd ?? payload.tzsUsd ?? null),
rates: payload.rates ?? {},
source: payload.source ?? null,
lastUpdated: payload.lastUpdated ?? payload.fetched_at ?? payload.date ?? null,
raw: payload,
};


// if everything numeric is null, throw so callers can show error
const hasNumeric = ['btc_usd', 'kes_per_usd', 'ugx_per_usd', 'inr_per_usd', 'tzs_per_usd'].some(k => out[k] !== null);
if (!hasNumeric) {
// don't crash — but surface a helpful error
console.warn('fetchRates: no numeric values parsed from backend', payload);
// still return the parsed object so UI can show source/timestamps
}
