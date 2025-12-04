import express from "express";
import { fetchRates } from "../utils/fetchRates.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const data = await fetchRates();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
