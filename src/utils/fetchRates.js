// src/utils/fetchRates.js
import axios from "axios";
import { load } from "cheerio";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

export async function fetchRates() {
  const cached = cache.get("kahawapay_rates");
  if (cached) return cached;

  try {
    // Fetch from CBK official site
    const cbkUrl = "https://www.centralbank.go.ke/rates/forex-exchange-rates/";
    const res = await axios.get(cbkUrl);
    const $ = load(res.data);

    const rates = {};
    $("table tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      const currency = $(tds[0]).text().trim();
      const rateText = $(tds[1]).text().trim().replace(/,/g, "");
      const rate = parseFloat(rateText);
      if (currency && !isNaN(rate)) {
        rates[currency] = rate;
      }
    });

    const data = {
      source: "Central Bank of Kenya",
      fetchedAt: new Date().toISOString(),
      rates,
    };

    cache.set("kahawapay_rates", data);
    return data;
  } catch (err) {
    console.error("❌ Error fetching CBK rates:", err.message);
    throw new Error("Failed to fetch CBK exchange rates");
  }
}
