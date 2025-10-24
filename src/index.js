// kahawapay-backend/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import sequelize from "./db.js";

// Routers
import authRoutes from "./routes/auth.js";
import userTxRouter from "./routes/transactions.user.js";        // /api/transactions -> /preview, /
import guestTxRouter from "./routes/transactions.guest.js";      // /api/transactions -> /guest/preview, /guest
import statusRoutes from "./routes/transactions.status.js";      // /api/transactions/guest/complete etc (mounted at /api)
import adminRoutes from "./routes/admin.transactions.js";        // /api/admin/*
import settingsRoutes from "./routes/settings.js";               // /api/settings/*
import exchangeRatesRoutes from "./routes/exchangeRates.js";     // /api/settings/exchange-rates/*
import walletRoutes from "./routes/wallet.js";                   // /api/wallet/*

dotenv.config();
// Put right after const app = express();
const WHOAMI = {
  app: "kahawapay-backend:index.js",
  sha: process.env.RENDER_GIT_COMMIT || "local-dev",
  node: process.version,
  startedAt: new Date().toISOString(),
};
console.log("BOOT:", WHOAMI);

app.get("/__whoami", (_req, res) => res.json(WHOAMI));
const app = express();

/* -----------------------------
   Global middleware
----------------------------- */

// CORS (allow list via env or allow all if unset)
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  })
);

app.use(express.json());

// 🔎 Log every request (helps verify what reaches Node in prod)
app.use((req, _res, next) => {
  console.log("REQ", req.method, req.originalUrl);
  next();
});

// 🧪 TEMP sanity route: proves Node sees this exact path
// Remove after confirming guest preview works end-to-end.
app.post("/api/transactions/guest/preview", (req, res) => {
  res.json({
    ok: true,
    reached: "index.js temp /api/transactions/guest/preview",
  });
});

// Disable caching globally (place BEFORE routes)
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

/* -----------------------------
   Healthcheck & route inspector
----------------------------- */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// 🔎 List registered routes (debug). Remove after debugging.
app.get("/__routes", (_req, res) => {
  const out = [];
  const stack = app._router?.stack || [];
  const walk = (prefix, layer) => {
    if (layer.route?.path) {
      const methods = Object.keys(layer.route.methods)
        .map((m) => m.toUpperCase())
        .join(",");
      out.push(`${methods} ${prefix}${layer.route.path}`);
    } else if (layer.name === "router" && layer.handle?.stack) {
      // Infer base from regexp for common prefixes
      const rx = layer.regexp?.toString() || "";
      const base =
        rx.includes("\\/api\\/transactions") ? "/api/transactions" :
        rx.includes("\\/api\\b") ? "/api" :
        "";
      layer.handle.stack.forEach((l) => walk(base, l));
    }
  };
  stack.forEach((l) => walk("", l));
  res.json({ routes: out });
});

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

// Transactions — definitive mounts
// Final paths provided by these routers:
//  - POST /api/transactions/preview          (logged-in preview)
//  - POST /api/transactions                  (logged-in create)
//  - POST /api/transactions/guest/preview    (guest preview)
//  - POST /api/transactions/guest            (guest create)
app.use("/api/transactions", userTxRouter);
app.use("/api/transactions", guestTxRouter);

// Guest status/complete callbacks (router defines e.g. /transactions/guest/complete)
app.use("/api", statusRoutes);

// Admin
app.use("/api/admin", adminRoutes);

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
   Debug: list registered routes to console
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
