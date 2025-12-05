// src/utils/fetchRates.js
// Frontend (browser) helper — calls backend /api/rates and normalizes shape

export async function fetchRates({ baseUrl } = {}) {
  const envBase = import.meta.env.VITE_RATES_API_URL || '';
  const API_BASE = (baseUrl ?? envBase).replace?.(/\/$/, '') || '';
  const url = API_BASE ? `${API_BASE}/api/rates` : '/api/rates';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      credentials: "same-origin",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Rates API ${res.status} - ${text}`);
    }

    const json = await res.json();

    return {
      rates: json.rates ?? [],
      source: json.source ?? "unknown",
      lastUpdated: json.lastUpdated ?? null,
    };

  } catch (err) {
    clearTimeout(timeout);
    throw new Error(err?.message || "Failed to fetch rates");
  }
}
