// server/routes/rates.js
import express from 'express';
import { fetchRates } from '../utils/fetchRates.js'; // relative to server/routes

const router = express.Router();

router.get('/api/rates', async (req, res) => {
  try {
    const data = await fetchRates();

    // Normalize payload expected by frontend:
    const payload = {
      // numeric properties frontend may look for
      btc_usd: data.bitcoinUsd ?? null,
      kes_per_usd: data.kesUsd ?? null,
      ugx_per_usd: data.ugxUsd ?? null,
      tzs_per_usd: data.tzsUsd ?? null,
      inr_per_usd: data.inrUsd ?? null,
      // rates map (keep both human-friendly and raw)
      rates: {
        'US Dollar': data.kesUsd ?? null,
        'Uganda Shilling': data.ugxUsd ?? null,
        'Tanzanian Shilling': data.tzsUsd ?? null,
        'Indian Rupee': data.inrUsd ?? null,
        bitcoinUsd: data.bitcoinUsd ?? null,
      },
      fetchedAt: data.lastUpdated,
      source: data.source ?? 'server-scraper',
      raw: process.env.NODE_ENV !== 'production' ? data.raw : undefined,
    };

    res.json(payload);
  } catch (err) {
    console.error('[/api/rates] fetch failed', err && err.stack ? err.stack : err);
    res.status(502).json({ error: 'failed to fetch rates' });
  }
});

export default router;
