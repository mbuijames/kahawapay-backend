// server/utils/fetchRates.server.js
// Server-side: axios + cheerio + node-cache
import axios from "axios";
import cheerio from "cheerio";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

export async function fetchRatesServer() {
  const cached = cache.get("kahawapay_rates");
  if (cached) return cached;

  try {
    // BTC USD
    const btcRes = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    const bitcoinUsd = btcRes.data?.bitcoin?.usd ?? null;

    // KES per USD (example — adapt selectors)
    const cbkRes = await axios.get("https://www.centralbank.go.ke/rates/forex-exchange-rates/");
    const $cbk = cheerio.load(cbkRes.data);
    // You MUST inspect the actual CBK table and pick the correct selector
    const kesRateText = $cbk("table tbody tr").filter((i, el) =>
      $cbk(el).text().toLowerCase().includes("us dollar")
    ).first().find("td").last().text();
    const kesUsd = kesRateText ? parseFloat(kesRateText.replace(/,/g, "")) : null;

    // UGX example (adapt selector)
    const bouRes = await axios.get("https://www.bou.or.ug/bou/rates_statistics/statistics/exchange_rates.html");
    const $bou = cheerio.load(bouRes.data);
    const ugxText = $bou("table tbody tr").filter((i, el) => $bou(el).text().includes("US Dollar")).first().find("td").eq(1).text();
    const ugxUsd = ugxText ? parseFloat(ugxText.replace(/,/g, "")) : null;

    // TZS example (adapt)
    const botRes = await axios.get("https://www.bot.go.tz/");
    const $bot = cheerio.load(botRes.data);
    const ttzMatch = $bot("body").text().match(/US Dollar\\s*([\\d,\\.]+)/);
    const tzsUsd = ttzMatch ? parseFloat(ttzMatch[1].replace(/,/g, "")) : null;

    // INR example
    const rbiRes = await axios.get("https://rbi.org.in/");
    const $rbi = cheerio.load(rbiRes.data);
    const inrMatch = $rbi("body").text().match(/1 USD = ([\\d\\.]+)/);
    const inrUsd = inrMatch ? parseFloat(inrMatch[1]) : null;

    const data = {
      bitcoinUsd,
      kesUsd,
      ugxUsd,
      tzsUsd,
      inrUsd,
      lastUpdated: new Date().toISOString(),
      source: "server-scraper",
    };

    cache.set("kahawapay_rates", data);
    return data;
  } catch (err) {
    console.error("Rate fetch error:", err);
    throw new Error("Unable to fetch rates on server");
  }
}
