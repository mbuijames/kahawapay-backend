// src/middleware/auth.js
import jwt from "jsonwebtoken";

function verifyToken(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return { error: "Missing token" };
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return { error: "Invalid token format" };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { decoded };
  } catch (err) {
    return { error: "Invalid or expired token" };
  }
}

// ✅ Require a valid JWT (user or admin)
export function requireAuth(req, res, next) {
  const { decoded, error } = verifyToken(req);
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log("❌ requireAuth error:", error);
    }
    return res.status(401).json({ error });
  }
  req.user = decoded;
  if (process.env.NODE_ENV !== "production") {
    console.log("✅ requireAuth decoded:", decoded);
  }
  next();
}

// ✅ Optional JWT (guests allowed)
export function optionalAuth(req, res, next) {
  const { decoded, error } = verifyToken(req);
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("⚠️ optionalAuth invalid token:", error);
    }
    req.user = null;
    return next();
  }
  req.user = decoded;
  if (process.env.NODE_ENV !== "production") {
    console.log("ℹ️ optionalAuth decoded:", decoded);
  }
  next();
}

// ✅ Require admin role
export function requireAdmin(req, res, next) {
  const { decoded, error } = verifyToken(req);
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log("❌ requireAdmin error:", error);
    }
    return res.status(401).json({ error });
  }

  if (decoded.role !== "admin") {
    if (process.env.NODE_ENV !== "production") {
      console.log("🚫 Forbidden, not admin:", decoded);
    }
    return res.status(403).json({ error: "Forbidden: Admins only" });
  }

  req.user = decoded;
  if (process.env.NODE_ENV !== "production") {
    console.log("✅ requireAdmin decoded:", decoded);
  }
  next();
}
