// kahawapay-backend/src/db.js
import { Sequelize } from "sequelize";
import pg from "pg";            // ensure pg is installed
import dotenv from "dotenv";

dotenv.config();

const DB_URL_RAW = process.env.DATABASE_URL;
if (!DB_URL_RAW) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

// --- helpers ---
const norm = (v) => (v || "").toString().trim().toLowerCase();
const isTruthy = (v) => ["true", "require", "on", "1", "yes"].includes(norm(v));
const isFalsy  = (v) => ["false", "disable", "off", "0", "no"].includes(norm(v));

/**
 * SSL logic (final):
 * Priority order to decide SSL:
 * 1) Explicit env override: DB_SSL or FORCE_DB_SSL
 * 2) If URL contains sslmode=require  => SSL on
 * 3) If host is localhost/127.0.0.1   => SSL off
 * 4) If host contains "internal"      => SSL off (e.g., *.internal.render.com)
 * 5) NODE_ENV=production              => SSL on, else off
 */
let urlObj;
try { urlObj = new URL(DB_URL_RAW); } catch { /* ignore, handled below */ }

const host = urlObj?.hostname || "";
const hasInternalHost = /internal/i.test(host);
const isLocalHost = host === "localhost" || host === "127.0.0.1";

// Env overrides (accept both names)
const envOverride = norm(process.env.DB_SSL) || norm(process.env.FORCE_DB_SSL);

// Step 1: explicit env
let wantSSL;
if (isTruthy(envOverride)) {
  wantSSL = true;
} else if (isFalsy(envOverride)) {
  wantSSL = false;
} else {
  // Step 2: URL param check
  const urlHasRequire = /\bsslmode=require\b/i.test(DB_URL_RAW);

  // Step 3/4/5: derive from context
  if (urlHasRequire) wantSSL = true;
  else if (isLocalHost) wantSSL = false;
  else if (hasInternalHost) wantSSL = false;
  else wantSSL = (process.env.NODE_ENV || "").toLowerCase() === "production";
}

// If we DON'T want SSL but URL has ?sslmode=require, strip it to avoid lib forcing SSL
const DB_URL = wantSSL
  ? DB_URL_RAW
  : DB_URL_RAW.replace(/([?&])sslmode=require(&?)/i, (_m, p1, p2) => {
      // remove the pair and fix dangling & or ?
      if (p1 === "?" && p2 === "&") return "?";
      return p2 === "&" ? p1 : "";
    });

const sequelize = new Sequelize(DB_URL, {
  dialect: "postgres",
  dialectModule: pg,
  logging: (process.env.NODE_ENV || "").toLowerCase() === "production" ? false : console.log,
  benchmark: (process.env.NODE_ENV || "").toLowerCase() !== "production",
  dialectOptions: wantSSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

// Log minimal connection info without secrets
const safeUrl = (() => {
  try {
    const u = new URL(DB_URL);
    const dbname = u.pathname.replace("/", "") || "";
    return `${u.protocol}//${u.hostname}:${u.port || "5432"}/${dbname}`;
  } catch {
    return "[hidden]";
  }
})();
console.log(`🔌 Connecting to Postgres: ${safeUrl} (SSL: ${wantSSL ? "on" : "off"})`);

export default sequelize;
