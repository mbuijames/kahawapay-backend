// kahawapay-backend/src/middleware/requireAuth.js
import jwt from "jsonwebtoken";

/**
 * Require a valid JWT for protected routes.
 * - Skips OPTIONS requests (CORS preflight).
 * - Supports "Authorization: Bearer <token>" (case-insensitive).
 * - Optional cookie fallback: req.cookies.token (enable with cookie-parser).
 * - Returns consistent JSON errors (never empty bodies).
 */
export default function requireAuth(req, res, next) {
  // Allow CORS preflights to pass through without auth
  if (req.method === "OPTIONS") return next();

  try {
    // Get header in a case-insensitive way
    const hdr = req.headers.authorization || req.headers.Authorization || "";
    let token = null;

    if (/^bearer\s+/i.test(hdr)) {
      token = hdr.slice(7).trim(); // after "Bearer "
    }

    // Optional cookie fallback (only if you use cookies + cookie-parser)
    if (!token && req.cookies?.token) {
      token = String(req.cookies.token).trim();
    }

    // Dev bypass: ALLOW_DEV_TOKEN=true with token "dev"
    if (process.env.ALLOW_DEV_TOKEN === "true" && token === "dev") {
      req.user = { id: 1, email: "admin@kahawapay.com", role: "admin", devToken: true };
      return next();
    }

    if (!token) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="kahawapay"');
      return res.status(401).json({ error: "Authentication required" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "Server misconfiguration: JWT_SECRET not set" });
    }

    // Small clock tolerance helps with minor clock skew
    const payload = jwt.verify(token, secret, { clockTolerance: 5 });
    if (!payload?.id) {
      res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = { id: payload.id, email: payload.email, role: payload.role };
    return next();
  } catch (err) {
    console.error("requireAuth verify error:", err.message);
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
