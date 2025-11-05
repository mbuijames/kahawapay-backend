// src/utils/fetchRates.js
import axios from "axios";
import { load } from "cheerio";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 600 }); // Cache 10 min

export async function fetchRates() {
  const cached = cache.get("kahawapay_rates");
  if (cached) return cached;

  try {
    const url = "https://www.centralbank.go.ke/rates/forex-exchange-rates/";
    const { data: html } = await axios.get(url);
    const $ = load(html);

    const rates = {};
    $("table tbody tr").each((_, row) => {
      const cols = $(row).find("td");
      if (cols.length >= 2) {
        const currency = $(cols[0]).text().trim();
        const value = parseFloat($(cols[1]).text().trim().replace(/,/g, ""));
        if (currency && !isNaN(value)) {
          rates[currency] = value;
        }
      }
    });

    // Keep JSON structure similar to before to avoid frontend errors
    const data = {
      kesUsd: rates["US Dollar"] || null,
      ugxUsd: rates["Uganda Shilling"] || null,
      tzsUsd: rates["Tanzania Shilling"] || null,
      inrUsd: rates["Indian Rupee"] || null,
      bitcoinUsd: null, // removed CoinGecko (keep key for safety)
      allRates: rates, // new: all currencies for future use
      lastUpdated: new Date().toISOString(),
    };

    cache.set("kahawapay_rates", data);
    return data;
  } catch (err) {
    console.error("Failed to fetch CBK rates:", err.message);
    throw new Error("Failed to fetch exchange rates from CBK");
  }
}
