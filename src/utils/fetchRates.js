// src/utils/fetchRates.js
import axios from "axios";
import * as cheerio from "cheerio";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 600 }); // cache 10 minutes

export async function fetchRates() {
  const cached = cache.get("kahawapay_rates");
  if (cached) return cached;

  try {
    const url = "https://www.centralbank.go.ke/rates/forex-exchange-rates/";
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const rows = $("table tbody tr");
    const rates = {};

    rows.each((_, row) => {
      const tds = $(row).find("td");
      const currency = $(tds[0]).text().trim();
      const rate = parseFloat($(tds[1]).text().trim().replace(/,/g, ""));
      if (currency && !isNaN(rate)) {
        rates[currency] = rate;
      }
    });

    const data = {
      kesUsd: rates["US Dollar"] || null,
      ugxUsd: rates["Uganda Shilling"] || null,
      tzsUsd: rates["Tanzanian Shilling"] || rates["Tanzania Shilling"] || null,
      inrUsd: rates["Indian Rupee"] || null,
      bitcoinUsd: null, // still provided for frontend compatibility
      allRates: rates,
      lastUpdated: new Date().toISOString(),
    };

    cache.set("kahawapay_rates", data);
    console.log("✅ CBK rates fetched successfully:", Object.keys(rates).length, "currencies.");
    return data;
  } catch (err) {
    console.error("❌ Failed to fetch CBK rates:", err.message);
    throw new Error("Failed to fetch exchange rates from CBK");
  }
}
