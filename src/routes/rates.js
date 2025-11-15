import express from "express";
import { fetchRates } from "../utils/fetchRates.js";

const router = express.Router();

router.get("/api/rates", async (req, res) => {
  try {
    const data = await fetchRates();

    res.json({
      rates: {
        usd: data.kesUsd,
        ugx: data.ugxUsd,
        tzs: data.tzsUsd,
        inr: data.inrUsd,
        btc: data.bitcoinUsd
      },
      fetchedAt: data.lastUpdated,
      source: data.source
    });

  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "failed to fetch rates" });
  }
});

export default router;
