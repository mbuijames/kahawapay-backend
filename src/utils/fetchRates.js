// src/components/KahawaPayHero.jsx
import React, { useEffect, useState } from "react";

const DEFAULT_API = "https://kahawapay-backend.onrender.com";
const CACHE_KEY = "kahawapay_rates_ui_v2";
const CACHE_TTL_MS = 10 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.ts || 0) > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export default function KahawaPayHero() {
  const [data, setData] = useState(() => readCache());
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(null);

  const apiBase = (import.meta.env.VITE_RATES_API_URL || DEFAULT_API).replace(/\/$/, "");
  const endpoint = `${apiBase}/api/rates`;

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(endpoint)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        writeCache(json);
      })
      .catch((err) => {
        console.error("Failed to fetch CBK rates:", err);
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const fmt = (v) => (v ? v.toLocaleString() : "N/A");

  return (
    <div className="bg-white border-b border-gray-300 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-800 space-y-1">
          <div className="font-semibold text-lg text-brown-800">KahawaPay Bond Rates</div>

          {loading ? (
            <div className="text-gray-500 text-sm">Loading rates…</div>
          ) : error ? (
            <div className="text-red-600 text-sm">
              Failed to load rates ({error})
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
              {Object.entries(data?.rates || {}).map(([currency, rate]) => (
                <div key={currency} className="flex justify-between">
                  <span>{currency}</span>
                  <span className="font-medium">{fmt(rate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && !error && (
          <div className="text-xs text-gray-500 text-right mt-2 sm:mt-0">
            Updated:{" "}
            {data?.fetchedAt
              ? new Date(data.fetchedAt).toLocaleString()
              : "-"}
          </div>
        )}
      </div>
    </div>
  );
}
