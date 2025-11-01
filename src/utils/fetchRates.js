
// src/utils/fetchRates.js
import axios from "axios";
import cheerio from "cheerio";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 600 }); // cache for 10 minutes

export async function fetchRates() {
  const cached = cache.get("kahawapay_rates");
  if (cached) return cached;

  try {
    // --- Bitcoin price (USD) from CoinGecko ---
    const btcRes = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    const bitcoinUsd = btcRes.data.bitcoin.usd;

    // --- KES/USD from CBK ---
    const cbkRes = await axios.get("https://www.centralbank.go.ke/rates/forex-exchange-rates/");
    const $cbk = cheerio.load(cbkRes.data);
    const kesRate = parseFloat($cbk("table tbody tr td").eq(1).text()) || 127.0;

    // --- UGX/USD from BoU ---
    const bouRes = await axios.get("https://www.bou.or.ug/bou/rates_statistics/statistics/exchange_rates.html");
    const $bou = cheerio.load(bouRes.data);
    const ugxRate = parseFloat($bou("table tbody tr:contains('US Dollar') td").eq(1).text()) || 3440;

    // --- TZS/USD from BoT ---
    const botRes = await axios.get("https://www.bot.go.tz/");
    const $bot = cheerio.load(botRes.data);
    const ttzMatch = $bot("body").text().match(/US Dollar\s*([\d,]+)/);
    const tzsRate = ttzMatch ? parseFloat(ttzMatch[1].replace(/,/g, "")) : 2457;

    // --- INR/USD from RBI ---
    const rbiRes = await axios.get("https://rbi.org.in/");
    const $rbi = cheerio.load(rbiRes.data);
    const inrMatch = $rbi("body").text().match(/1 USD = ([\d.]+)/);
    const inrRate = inrMatch ? parseFloat(inrMatch[1]) : 88.8;

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
    console.error("Rate fetch error:", err.message);
