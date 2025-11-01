// src/routes/rates.js
import express from "express";
import { fetchRates } from "./utils/fetchRates.js";

const router = express.Router();

// GET /api/rates
router.get("/", async (req, res) => {
  try {
    const rates = await fetchRates();
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch exchange rates" });
  }
});

export default router;
