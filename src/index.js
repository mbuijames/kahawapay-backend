// kahawapay-backend/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import ratesRoutes from "./routes/rates.js";

import sequelize from "./db.js";

// Routers
import authRoutes from "./routes/auth.js";
import transactionRoutes from "./routes/transactions.js";     // user + general tx
import guestRoutes from "./routes/transactions.guest.js";     // POST /guest + /guest/preview
import statusRoutes from "./routes/transactions.status.js";   // guest complete/status (mounted at /api)
import adminRoutes from "./routes/admin.transactions.js";     // /api/admin/*
import settingsRoutes from "./routes/settings.js";            // /api/settings/*
import exchangeRatesRoutes from "./routes/exchangeRates.js";  // /api/settings/exchange-rates/*
import walletRoutes from "./routes/wallet.js";                // /api/wallet/*

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -----------------------------
   Global middleware
----------------------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable caching globally (place BEFORE routes)
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

/* -----------------------------
   Healthcheck
----------------------------- */
app.get("/api/health", (req, res) => res.json({ ok: true }));

/* -----------------------------
   Routes (each mounted ONCE)
----------------------------- */
// Auth
app.use("/api/auth", authRoutes);

// Settings
app.use("/api/settings", settingsRoutes);
app.use("/api/settings/exchange-rates", exchangeRatesRoutes);

// Wallet
app.use("/api/wallet", walletRoutes);

// Transactions
app.use("/api/transactions", transactionRoutes); // general/user tx routes
app.use("/api/transactions", guestRoutes);       // adds /guest and /guest/preview
app.use("/api", statusRoutes);                   // e.g. /api/transactions/guest/complete

// Public exchange rates endpoint
app.use("/api/rates", ratesRoutes);

// Admin
app.use("/api/admin", adminRoutes);

/* -----------------------------
   Root
----------------------------- */
app.get("/", (_req, res) => {
  res.send("✅ KahawaPay Backend is running");
});

/* -----------------------------
   OPTIONAL: Serve SPA from backend
   (Only if you deploy the frontend build with this service.)
   Keep this AFTER all /api routes so it can't swallow them.
----------------------------- */
// Uncomment ONLY if the backend should serve your built frontend.
// import fs from "fs";
// const distDir = path.join(__dirname, "../frontend/dist");
// if (fs.existsSync(distDir)) {
//   app.use(express.static(distDir));
//   app.get("*", (req, res, next) => {
//     if (req.path.startsWith("/api/")) return next(); // let API routes handle it
//     res.sendFile(path.join(distDir, "index.html"));
//   });
// }

/* -----------------------------
   DB connect
----------------------------- */
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    if (process.env.NODE_ENV === "development") {
      await sequelize.sync({ alter: true });
      console.log("✅ Models synchronized (dev mode)");
    } else {
      console.log("🚫 Skipping auto-sync (production mode)");
    }
  } catch (err) {
    console.error("❌ DB connection error:", err.message);
  }
})();

/* -----------------------------
   Debug: list registered routes
----------------------------- */
function listRoutes(appInstance) {
  console.log("📌 Registered routes:");
  appInstance._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods)
        .map((m) => m.toUpperCase())
        .join(", ");
      console.log(`   ${methods.padEnd(10)} ${middleware.route.path}`);
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler) => {
        const route = handler.route;
        if (route) {
          const methods = Object.keys(route.methods)
            .map((m) => m.toUpperCase())
            .join(", ");
          console.log(`   ${methods.padEnd(10)} ${route.path}`);
        }
      });
    }
  });
}
listRoutes(app);

/* -----------------------------
   Start server
----------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
