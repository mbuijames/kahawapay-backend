// src/utils/fetchRates.js
// Frontend (browser) helper — calls backend /api/rates and normalizes shape

export async function fetchRates({ baseUrl } = {}) {
  const envBase = import.meta.env.VITE_RATES_API_URL || '';
  const API_BASE = (baseUrl ?? envBase).replace?.(/\/$/, '') || '';
  const url = API_BASE ? `${API_BASE}/api/rates` : '/api/rates';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Rates API ${res.status} ${res.statusText} ${text ? '- ' + text.slice(0, 200) : ''}`);
    }
    const json = await res.json();

    // Normalize into expected fields
    const normalized = {
      btc_usd: json.btc_usd ?? json.bitcoinUsd ?? (json.rates && json.rates.bitcoinUsd) ?? null,
      kes_per_usd: json.kes_per_usd ?? json.kesUsd ?? (json.rates && (json.rates['US Dollar'] ?? json.rates['KES'])) ?? null,
      ugx_per_usd: json.ugx_per_usd ?? json.ugxUsd ?? (json.rates && json.rates['Uganda Shilling']) ?? null,
      tzs_per_usd: json.tzs_per_usd ?? json.tzsUsd ?? (json.rates && json.rates['Tanzanian Shilling']) ?? null,
      inr_per_usd: json.inr_per_usd ?? json.inrUsd ?? (json.rates && json.rates['Indian Rupee']) ?? null,
      rates: json.rates ?? {},
      source: json.source ?? null,
      lastUpdated: json.fetchedAt ?? json.fetched_at ?? json.lastUpdated ?? null,
      raw: json,
    };

    return normalized;
  } catch (err) {
    clearTimeout(timeout);
    if (err && err.name === 'AbortError') throw new Error('Rates request timed out');
    throw new Error(err && err.message ? err.message : 'Failed to fetch rates');
  }
}
