// src/utils/fetchRates.js
import axios from "axios";
import { load } from "cheerio";
import NodeCache from "node-cache";

// Cache data for 10 minutes
const cache = new NodeCache({ stdTTL: 600 });

export async function fetchRates() {
  const cached = cache.get("kahawapay_rates");
  if (cached) return cached;

  try {
    const url = "https://www.centralbank.go.ke/rates/forex-exchange-rates/";
    const { data: html } = await axios.get(url);
    const $ = load(html);

    const rates = {};
    $("table tbody tr").each((_, el) => {
      const cells = $(el).find("td");
      const currency = $(cells[0]).text().trim();
      const rate = $(cells[1]).text().trim().replace(/,/g, "");
      if (currency && rate && !isNaN(rate)) {
        rates[currency] = parseFloat(rate);
      }
    });

    const data = {
      rates,
      fetchedAt: new Date().toISOString(),
    };

    cache.set("kahawapay_rates", data);
    return data;
  } catch (err) {
    console.error("Error fetching CBK rates:", err.message);
    throw new Error("Failed to fetch CBK exchange rates");
  }
}
