// src/middleware/security.js
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";

const FRONTENDS = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// If not set, allow localhost dev by default
const ALLOWED = FRONTENDS.length ? FRONTENDS : ["http://localhost:5173"];

export function applySecurity(app) {
  // CORS — allow only your frontends
  app.use(cors({
    origin: (origin, cb) => {
      // allow same-origin / curl / Postman with no Origin
      if (!origin) return cb(null, true);
      if (ALLOWED.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: false,
  }));

  // Helmet — secure headers + strict CSP
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "connect-src": ["'self'", ...ALLOWED],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Generic write limiter (protects settings/transactions)
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Auth limiter (protects login/register)
  const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/auth", authLimiter);
  app.use("/api/transactions", writeLimiter);
  app.use("/api/settings", writeLimiter);
}
