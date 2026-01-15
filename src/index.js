// kahawapay-backend/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";


import sequelize from "./db.js";

// Routers

import authRoutes from "./routes/auth.js";
import transactionRoutes from "./routes/transactions.js";          // user + general tx
import guestRoutes from "./routes/transactions.guest.js";          // POST /guest
import statusRoutes from "./routes/transactions.status.js";        // guest complete/status
import adminRoutes from "./routes/admin.transactions.js";          // /api/admin/*
import settingsRoutes from "./routes/settings.js";                 // /api/settings/*
import exchangeRatesRoutes from "./routes/exchangeRates.js";       // /api/settings/exchange-rates/*
import walletRoutes from "./routes/wallet.js";                     // /api/wallet/*
import ratesRouter from "./routes/rates.js";
// If you really need the “simple” guest tx route, keep it. If not, remove the import & mounting.
// import guestTxSimpleRoutes from "./routes/guest.tx.simple.js";

dotenv.config();

const app = express();

/* -----------------------------
   Global middleware
----------------------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/rates", ratesRouter);
app.use(ratesRouter);
app.use("/api/support", supportRoutes);

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
app.use("/api/transactions", guestRoutes);       // adds POST /guest etc.
app.use("/api", statusRoutes);                   // e.g. /api/transactions/guest/complete

// Admin
app.use("/api/admin", adminRoutes);

// Optional: “simple” guest route (avoid overlapping with guestRoutes)
// app.use("/api", guestTxSimpleRoutes);

/* -----------------------------
   Root
----------------------------- */
app.get("/", (_req, res) => {
  res.send("✅ KahawaPay Backend is running");
});

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
function listRoutes(app) {
  console.log("📌 Registered routes:");
  app._router.stack.forEach((middleware) => {
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
