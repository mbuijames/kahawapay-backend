import jwt from "jsonwebtoken";

export default function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || req.headers.Authorization;
    if (!hdr || !hdr.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    const token = hdr.slice(7).trim();

    if (process.env.ALLOW_DEV_TOKEN === "true" && token === "dev") {
      req.user = { id: 1, email: "admin@kahawapay.com", role: "admin", devToken: true };
      return next();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "JWT_SECRET not set" });

    const payload = jwt.verify(token, secret);
    if (!payload?.id) return res.status(401).json({ error: "Invalid token payload" });

    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    console.error("requireAuth error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
