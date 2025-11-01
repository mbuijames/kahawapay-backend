// src/utils/fetchRates.js
import axios from "axios";
import { load } from "cheerio";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 600 }); // cache for 10 minutes

export async function fetchRates() {
  const cached = cache.get("kahawapay_rates");
  if (cached) return cached;

  try {
    // --- Bitcoin price (USD) from CoinGecko ---
    const btcRes = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );
    const bitcoinUsd = btcRes?.data?.bitcoin?.usd ?? null;

    // --- KES/USD from CBK ---
    let kesRate = null;
    try {
      const cbkRes = await axios.get("https://www.centralbank.go.ke/rates/forex-exchange-rates/");
      const $cbk = load(cbkRes.data);
      // Attempt a few selector strategies, tolerant to layout changes
      const cbkCells = $cbk("table tbody tr td");
      if (cbkCells.length >= 2) {
        const txt = cbkCells.eq(1).text().trim().replace(/,/g, "");
        const n = Number(txt);
        if (!Number.isNaN(n)) kesRate = n;
      }
    } catch (e) {
      // ignore and fallback later
      console.warn("CBK parse failed:", e.message);
    }
    if (kesRate === null) kesRate = 127.0; // fallback default

    // --- UGX/USD from BoU ---
    let ugxRate = null;
    try {
      const bouRes = await axios.get("https://www.bou.or.ug/bou/rates_statistics/statistics/exchange_rates.html");
      const $bou = load(bouRes.data);
      // find row containing 'US Dollar' (tolerant)
      $bou("tr").each((i, tr) => {
        const text = $bou(tr).text();
        if (/US\s*Dollar/i.test(text) && /UGX/i.test(text)) {
          const nums = text.match(/[\d,]+\.\d+|[\d,]+/g);
          if (nums && nums.length) {
            const candidate = nums.sort((a, b) => b.length - a.length)[0].replace(/,/g, "");
            const n = Number(candidate);
            if (!Number.isNaN(n)) ugxRate = n;
          }
        }
      });
    } catch (e) {
      console.warn("BoU parse failed:", e.message);
    }
    if (ugxRate === null) ugxRate = 3440;

    // --- TZS/USD from BoT ---
    let tzsRate = null;
    try {
      const botRes = await axios.get("https://www.bot.go.tz/ExchangeRate/excRates");
      const $bot = load(botRes.data);
      $bot("tr").each((i, tr) => {
        const t = $bot(tr).text();
        if (/\bUSD\b/i.test(t)) {
          const nums = t.match(/[\d,]+\.\d+|[\d,]+/g);
          if (nums && nums.length) {
            tzsRate = Number(nums[0].replace(/,/g, ""));
          }
        }
      });
    } catch (e) {
      console.warn("BoT parse failed:", e.message);
    }
    if (tzsRate === null) tzsRate = 2457;

    // --- INR/USD from RBI ---
    let inrRate = null;
    try {
      const rbiRes = await axios.get("https://www.rbi.org.in/");
      const $rbi = load(rbiRes.data);
      const bodyText = $rbi("body").text();
      const inrMatch = bodyText.match(/1\s*USD\s*=\s*([\d,]+\.\d+|[\d,]+)/i);
      if (inrMatch && inrMatch[1]) {
        inrRate = Number(inrMatch[1].replace(/,/g, ""));
      }
    } catch (e) {
      console.warn("RBI parse failed:", e.message);
    }
    if (inrRate === null) inrRate = 88.8;

    const data = {
      bitcoinUsd,
      kesUsd: kesRate,
      ugxUsd: ugxRate,
      tzsUsd: tzsRate,
      inrUsd: inrRate,
      lastUpdated: new Date().toISOString(),
    };

    cache.set("kahawapay_rates", data);
    return data;
  } catch (err) {
    console.error("Rate fetch error:", err && err.message ? err.message : err);
    throw new Error("Failed to fetch exchange rates");
  }
}
