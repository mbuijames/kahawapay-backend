// src/routes/rates.js
import express from "express";
import fetch from "node-fetch"; // or global fetch if Node 18+
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// GET /api/rates
router.get("/api/rates", async (req, res) => {
  try {
    const response = await fetch(process.env.RATES_API_URL);
    if (!response.ok) throw new Error("Failed to fetch rates");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
