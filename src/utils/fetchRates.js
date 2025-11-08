// server/utils/fetchRates.js   <-- server-only (Node), exports named `fetchRates`
import axios from 'axios';
import { load } from 'cheerio';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600 });

function safeNumber(s) {
  if (s === null || s === undefined) return null;
  const cleaned = String(s).replace(/[^0-9.\-]/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export async function fetchRates() {
  const cached = cache.get('kahawapay_rates');
  if (cached) return cached;

  const out = {
    bitcoinUsd: null,
    kesUsd: null,
    ugxUsd: null,
    tzsUsd: null,
    inrUsd: null,
    lastUpdated: new Date().toISOString(),
    source: 'server-scraper',
    raw: {}
  };

  try {
    // BTC (CoinGecko)
    try {
      const btcRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { timeout: 10000 });
      out.bitcoinUsd = safeNumber(btcRes?.data?.bitcoin?.usd ?? null);
      out.raw.btc = btcRes.data;
    } catch (e) {
      console.warn('[fetchRates] coinGecko error', e?.message || e);
    }

    // KES (CBK) - heuristic extraction
    try {
      const cbkRes = await axios.get('https://www.centralbank.go.ke/rates/forex-exchange-rates/', { timeout: 15000 });
      out.raw.cbk = cbkRes.data.slice(0, 2000);
      const $ = load(cbkRes.data);
      const usdRow = $('table tbody tr').filter((i, el) => $(el).text().toLowerCase().includes('us dollar')).first();
      const kesText = usdRow.length ? usdRow.find('td').last().text() : null;
      out.kesUsd = safeNumber(kesText);
    } catch (e) {
      console.warn('[fetchRates] CBK error', e?.message || e);
    }

    // UGX (BOU)
    try {
      const bouRes = await axios.get('https://www.bou.or.ug/bou/rates_statistics/statistics/exchange_rates.html', { timeout: 15000 });
      out.raw.bou = bouRes.data.slice(0, 2000);
      const $b = load(bouRes.data);
      const ugxRow = $b('table tbody tr').filter((i, el) => $b(el).text().toLowerCase().includes('us dollar')).first();
      out.ugxUsd = safeNumber(ugxRow.length ? ugxRow.find('td').eq(1).text() : null);
    } catch (e) {
      console.warn('[fetchRates] BOU error', e?.message || e);
    }

    // TZS (BOT)
    try {
      const botRes = await axios.get('https://www.bot.go.tz/', { timeout: 15000 });
      out.raw.bot = botRes.data.slice(0, 2000);
      const $bot = load(botRes.data);
      const tMatch = $bot('body').text().match(/US Dollar\s*([\d,\.]+)/);
      out.tzsUsd = safeNumber(tMatch ? tMatch[1] : null);
    } catch (e) {
      console.warn('[fetchRates] BOT error', e?.message || e);
    }

    // INR (RBI)
    try {
      const rbiRes = await axios.get('https://rbi.org.in/', { timeout: 15000 });
      out.raw.rbi = rbiRes.data.slice(0, 2000);
      const $r = load(rbiRes.data);
      const iMatch = $r('body').text().match(/1 USD = ([\d\.]+)/);
      out.inrUsd = safeNumber(iMatch ? iMatch[1] : null);
    } catch (e) {
      console.warn('[fetchRates] RBI error', e?.message || e);
    }

    out.lastUpdated = new Date().toISOString();
    cache.set('kahawapay_rates', out);
    return out;
  } catch (err) {
    console.error('[fetchRates] unexpected error', err && err.stack ? err.stack : err);
    throw err;
  }
}
