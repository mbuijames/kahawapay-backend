// kahawapay-backend/src/middleware/requireAdmin.js
export default function requireAdmin(req, res, next) {
  const role = (req.user?.role || "").toLowerCase();
  if (role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
