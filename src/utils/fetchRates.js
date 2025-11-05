// src/utils/fetchRates.js
import axios from "axios";
import { load } from "cheerio";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

function pick(values, candidates) {
  for (const c of candidates) {
    if (values[c] !== undefined) return values[c];
  }
  return null;
}

export async function fetchRates() {
  const cached = cache.get("kahawapay_rates");
  if (cached) return cached;

  try {
    const cbkUrl = "https://www.centralbank.go.ke/rates/forex-exchange-rates/";
    const { data: html } = await axios.get(cbkUrl, { timeout: 15000 });
    const $ = load(html);

    // Parse the CBK table rows into a map: { "US Dollar": 127.5, ... }
    const rates = {};
    $("table tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const name = $(tds[0]).text().trim();
        const raw = $(tds[1]).text().trim().replace(/,/g, "");
        const val = parseFloat(raw);
        if (name && !Number.isNaN(val)) {
          rates[name] = val;
        }
      }
    });

    // Provide legacy-friendly fields (try a few possible labels)
    const kesUsd = pick(rates, ["US Dollar", "US Dollar (KES)", "USD"]);
    const ugxUsd = pick(rates, ["Uganda Shilling", "UGX"]);
    const tzsUsd = pick(rates, ["Tanzanian Shilling", "Tanzania Shilling", "TZS"]);
    const inrUsd = pick(rates, ["Indian Rupee", "INR"]);
    const data = {
      // Legacy keys (keep these for compatibility)
      kesUsd: kesUsd ?? null,
      ugxUsd: ugxUsd ?? null,
      tzsUsd: tzsUsd ?? null,
      inrUsd: inrUsd ?? null,
      bitcoinUsd: null, // kept for frontend safety (we removed CoinGecko)
      // New shape
      rates,                 // full map of parsed CBK rows
      fetchedAt: new Date().toISOString(),
      source: "Central Bank of Kenya",
    };

    cache.set("kahawapay_rates", data);
    console.log("✅ fetchRates: returned", Object.keys(rates).length, "rates");
    return data;
  } catch (err) {
    console.error("❌ fetchRates error:", err && err.message ? err.message : err);
    // if cache exists return old cached data instead of throwing (graceful fallback)
    const last = cache.get("kahawapay_rates");
    if (last) {
      console.warn("↪ Returning last cached rates due to fetch error");
      return last;
    }
    // no cached data -> throw so route returns 500
    throw new Error("Failed to fetch CBK exchange rates");
  }
}
