// server/routes/rates.js
import express from 'express';
import { fetchRates } from '../utils/fetchRates.js';
const router = express.Router();

router.get("/api/rates", async (req, res) => {
  try {
    const data = await fetchRatesServer();
    res.json({
      rates: {
        "US Dollar": data.kesUsd,
        "Uganda Shilling": data.ugxUsd,
        "Tanzanian Shilling": data.tzsUsd,
        "Indian Rupee": data.inrUsd,
        bitcoinUsd: data.bitcoinUsd,
      },
      fetchedAt: data.lastUpdated,
      source: data.source,
    });
  } catch (err) {
    res.status(502).json({ error: "failed to fetch rates" });
  }
});

export default router;
