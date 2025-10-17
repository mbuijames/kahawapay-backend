// src/routes/transactions.js
import express from "express";
import userRoutes from "./transactions.user.js";
import guestRoutes from "./transactions.guest.js";
import adminRoutes from "./transactions.admin.js";

const router = express.Router();

router.use("/", userRoutes);   // POST /api/transactions  (auth user)
router.use("/", guestRoutes);  // POST /api/transactions/guest  (guest)
router.use("/", adminRoutes);  // /all, /:id/mark-paid, etc

export default router;
