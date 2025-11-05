// src/utils/fetchRates.js
import axios from "axios";
import { load } from "cheerio";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 600 }); // cache 10 minutes

function pick(values, candidates) {
  for (const c of candidates) {
    if (values[c] !== undefined) return values[c];
  }
  return null;
}

function findFirstNumberInText(text) {
  if (!text) return null;
  const m = text.replace(/\u00A0/g, " ").match(/[\d]{1,3}(?:[,]\d{3})*(?:\.\d+)?|[\d]+(?:\.\d+)?/);
  if (!m) return null;
  return parseFloat(m[0].replace(/,/g, ""));
}

export async function fetchRates() {
  // return cached if still fresh
  const cached = cache.get("kahawapay_rates");
  if (cached) return cached;

  try {
    // 1) Bitcoin from CoinGecko
    let bitcoinUsd = null;
    try {
      const btcRes = await axios.get(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        { timeout: 10000 }
      );
      bitcoinUsd = btcRes?.data?.bitcoin?.usd ?? null;
    } catch (e) {
      console.warn("fetchRates: CoinGecko failed:", e.message);
    }

    // 2) CBK forex table
    const cbkUrl = "https://www.centralbank.go.ke/rates/forex-exchange-rates/";
    const { data: html } = await axios.get(cbkUrl, { timeout: 15000, headers: { "User-Agent": "kahawapay/1.0" } });
    const $ = load(html);

    // gather rows - tolerant to small layout changes
    let rows = $("table tbody tr");
    if (!rows.length) {
      // fallback: any table that contains 'US Dollar'
      $("table").each((_, t) => {
        const text = $(t).text();
        if (/US\s*Dollar/i.test(text) && rows.length === 0) {
          rows = $(t).find("tbody tr");
        }
      });
    }
    if (!rows.length) rows = $("tr");

    const rates = {};
    rows.each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 0) return;
      const nameRaw = $(tds[0]).text().trim();
      const name = nameRaw.replace(/\s+/g, " ");
      let val = null;
      if (tds.length >= 2) {
        val = findFirstNumberInText($(tds[1]).text());
      }
      if (val === null) {
        val = findFirstNumberInText($(tr).text());
      }
      if (name && val !== null && !Number.isNaN(val)) {
        rates[name] = val;
      }
    });

    // pick legacy-friendly values (try multiple possible labels)
    const kes = pick(rates, ["US Dollar", "US Dollar (USD)", "US Dollar (KES)", "USD", "US DOLLAR"]);
    const ugx = pick(rates, ["Uganda Shilling", "UGX", "Uganda Shilling (UGX)"]);
    const tzs = pick(rates, ["Tanzanian Shilling", "Tanzania Shilling", "TZS"]);
    const inr = pick(rates, ["Indian Rupee", "INR", "Indian Rupee (INR)"]);

    // Build response matching original KahawaPayHero expectations
    const result = {
      // bitcoin fields (hero checks btc_usd then bitcoinUsd)
      btc_usd: bitcoinUsd,
      bitcoinUsd: bitcoinUsd,

      // legacy FX keys and alternate keys
      kesUsd: kes ?? null,
      kes_per_usd: kes ?? null,

      ugxUsd: ugx ?? null,
      ugx_per_usd: ugx ?? null,

      tzsUsd: tzs ?? null,
      tzs_per_usd: tzs ?? null,

      inrUsd: inr ?? null,
      inr_per_usd: inr ?? null,

      // keep lastUpdated / fetched_at variants the hero checks
      lastUpdated: new Date().toISOString(),
      fetched_at: new Date().toISOString(),

      // full map for potential future use
      rates,

      source: "Central Bank of Kenya",
    };

    cache.set("kahawapay_rates", result);
    console.log("✅ fetchRates: parsed", Object.keys(rates).length, "entries. kesUsd:", result.kesUsd);
    return result;
  } catch (err) {
    console.error("❌ fetchRates error:", err && err.message ? err.message : err);
    // if cached value exists return it (graceful fallback)
    const last = cache.get("kahawapay_rates");
    if (last) {
      console.warn("↪ fetchRates: returning last cached rates due to error");
      return last;
    }
    throw new Error("Failed to fetch exchange rates");
  }
}
