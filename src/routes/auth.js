// src/routes/auth.js
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import User from "../models/User.js";
import requireAuth from "../middleware/requireAuth.js";
import nodemailer from "nodemailer";

const router = express.Router();

/* ---------------------------
   Helpers
--------------------------- */
function assertJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
}

function signFinalJWT(user) {
  assertJwtSecret();
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function signTemp2FAToken(user) {
  assertJwtSecret();
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, temp2fa: true },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
}


/* ---------------------------
   REGISTER (PUBLIC) WITH OTP
--------------------------- */
router.post("/register", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    email = String(email || "").trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "User already exists" });
    }

    // 1. Create user
    const user = await User.create({
      email,
      password,
      role: "user",
      is_guest: false
    });

    // 2. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Save OTP in DB
    await sequelize.query(
      `UPDATE public.users SET otp = :otp WHERE email = :email`,
      { replacements: { otp, email }, type: QueryTypes.UPDATE }
    );

    // 4. Send OTP via email
    await transporter.sendMail({
      from: `"KahawaPay" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your KahawaPay OTP Code",
      text: `Your OTP is ${otp}`,
    });

    return res.json({ message: "Registration successful. OTP sent." });

  } catch (err) {
    console.error("🔥 Register error:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});


/* ---------------------------
   LOGIN (PUBLIC) with 2FA gate
--------------------------- */
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    email = String(email || "").trim().toLowerCase();
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // IMPORTANT: read twofa_enabled directly from DB to avoid model/attr mismatch
    const rows = await sequelize.query(
      `SELECT id, email, role, twofa_enabled
       FROM public.users
       WHERE id = :id
       LIMIT 1`,
      { replacements: { id: user.id }, type: QueryTypes.SELECT }
    );
    const dbUser = rows[0] || { id: user.id, email: user.email, role: user.role, twofa_enabled: false };

    if (dbUser.twofa_enabled) {
      const tempToken = signTemp2FAToken(dbUser);
      return res.json({ requires2fa: true, tempToken });
    }

    const token = signFinalJWT(dbUser);
    return res.json({ token, role: dbUser.role, email: dbUser.email });
  } catch (err) {
    console.error("🔥 Login error:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

/* ---------------------------
   2FA: Setup (AUTH REQUIRED)
   - returns { otpauth_url, qr } (data URL)
--------------------------- */
router.post("/2fa/setup", requireAuth, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `KahawaPay (${req.user.email})`,
      length: 20,
    });

    await sequelize.query(
      `UPDATE public.users SET totp_secret = :s WHERE id = :id`,
      { replacements: { s: secret.base32, id: req.user.id }, type: QueryTypes.UPDATE }
    );

    const otpUrl = secret.otpauth_url;
    const qr = await QRCode.toDataURL(otpUrl);

    return res.json({ otpauth_url: otpUrl, qr });
  } catch (err) {
    console.error("2fa/setup error:", err);
    return res.status(500).json({ error: "Failed to start 2FA setup" });
  }
});

/* ---------------------------
   2FA: Verify & enable (AUTH REQUIRED)
--------------------------- */
router.post("/2fa/verify", requireAuth, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "Code required" });

    const rows = await sequelize.query(
      `SELECT totp_secret FROM public.users WHERE id = :id LIMIT 1`,
      { replacements: { id: req.user.id }, type: QueryTypes.SELECT }
    );
    const sec = rows[0]?.totp_secret;
    if (!sec) return res.status(400).json({ error: "No TOTP secret on file" });

    const ok = speakeasy.totp.verify({
      secret: sec,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!ok) return res.status(400).json({ error: "Invalid code" });

    await sequelize.query(
      `UPDATE public.users SET twofa_enabled = true WHERE id = :id`,
      { replacements: { id: req.user.id }, type: QueryTypes.UPDATE }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("2fa/verify error:", err);
    return res.status(500).json({ error: "Failed to verify 2FA code" });
  }
});

/* ---------------------------
   2FA: Complete login with code (PUBLIC)
   Body: { tempToken, code }
   Returns final { token, role, email }
--------------------------- */
router.post("/2fa/login", async (req, res) => {
  try {
    const { tempToken, code } = req.body || {};
    if (!tempToken || !code) {
      return res.status(400).json({ error: "Missing code or token" });
    }

    let payload;
    try {
      assertJwtSecret();
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    if (!payload?.temp2fa || !payload?.id) {
      return res.status(401).json({ error: "Invalid temp token" });
    }

    const rows = await sequelize.query(
      `SELECT id, email, role, totp_secret FROM public.users WHERE id = :id LIMIT 1`,
      { replacements: { id: payload.id }, type: QueryTypes.SELECT }
    );
    const u = rows[0];
    if (!u?.totp_secret) return res.status(400).json({ error: "No 2FA configured" });

    const ok = speakeasy.totp.verify({
      secret: u.totp_secret,
      encoding: "base32",
      token: code,
      window: 1,
    });
    if (!ok) return res.status(400).json({ error: "Invalid code" });

    const final = jwt.sign(
      { id: u.id, email: u.email, role: u.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    return res.json({ token: final, role: u.role, email: u.email });
  } catch (err) {
    console.error("2fa/login error:", err);
    return res.status(500).json({ error: "2FA login failed" });
  }
});

/* ---------------------------
   Forgot / Reset (PUBLIC)
--------------------------- */
router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email required" });

    const rows = await sequelize.query(
      `SELECT id FROM public.users WHERE email = :email LIMIT 1`,
      { replacements: { email: String(email).trim().toLowerCase() }, type: QueryTypes.SELECT }
    );
    const user = rows[0];
    // Do not reveal user existence
    if (!user) return res.json({ ok: true });

    const token = crypto.randomUUID();
    await sequelize.query(
      `UPDATE public.users
       SET reset_token = :t, reset_expires = now() + interval '1 hour'
       WHERE id = :id`,
      { replacements: { t: token, id: user.id }, type: QueryTypes.UPDATE }
    );

    const base = process.env.FRONTEND_BASE_URL || "http://localhost:5173";
    console.log("🔐 Password reset link:", `${base}/reset?token=${token}`);

    return res.json({ ok: true });
  } catch (err) {
    console.error("forgot error:", err);
    return res.status(500).json({ error: "Failed to request password reset" });
  }
});

router.post("/reset", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const rows = await sequelize.query(
      `SELECT id FROM public.users
       WHERE reset_token = :t AND reset_expires > now()
       LIMIT 1`,
      { replacements: { t: token }, type: QueryTypes.SELECT }
    );
    const row = rows[0];
    if (!row) return res.status(400).json({ error: "Invalid or expired token" });

    const hash = await bcrypt.hash(password, 10);
    await sequelize.query(
      `UPDATE public.users
       SET password = :p, reset_token = NULL, reset_expires = NULL
       WHERE id = :id`,
      { replacements: { p: hash, id: row.id }, type: QueryTypes.UPDATE }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("reset error:", err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

/* ---------------------------
   CHANGE PASSWORD (AUTH REQUIRED)
--------------------------- */
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const rows = await sequelize.query(
      `SELECT id, password FROM public.users WHERE id = :id LIMIT 1`,
      { replacements: { id: req.user.id }, type: QueryTypes.SELECT }
    );
    const u = rows[0];
    if (!u) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(currentPassword, u.password);
    if (!ok) return res.status(400).json({ error: "Current password is incorrect" });

    const hash = await bcrypt.hash(newPassword, 10);
    await sequelize.query(
      `UPDATE public.users SET password = :p WHERE id = :id`,
      { replacements: { p: hash, id: req.user.id }, type: QueryTypes.UPDATE }
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("change-password error:", err);
    return res.status(500).json({ error: "Failed to change password" });
  }
});

/* ---------------------------
   DISABLE 2FA (AUTH REQUIRED)
--------------------------- */
router.post("/2fa/disable", requireAuth, async (req, res) => {
  try {
    await sequelize.query(
      `UPDATE public.users SET twofa_enabled = false, totp_secret = NULL WHERE id = :id`,
      { replacements: { id: req.user.id }, type: QueryTypes.UPDATE }
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("2fa/disable error:", err);
    return res.status(500).json({ error: "Failed to disable 2FA" });
  }
});
const transporter = nodemailer.createTransport({
  host: "smtp.titan.email",
  port: 587,             // use 587 if you prefer TLS
  secure: true,          // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER, // e.g., info@kahawapay.com
    pass: process.env.EMAIL_PASS  // Titan email password
  }
});

// Test email function
async function testEmail() {
  try {
    await transporter.sendMail({
      from: `"KahawaPay" <${process.env.EMAIL_USER}>`,
      to: "mbuijames@gmail.com",
      subject: "Titan SMTP Test",
      text: "This is a test email via Titan SMTP!",
    });
    console.log("✅ Email sent successfully!");
  } catch (err) {
    console.error("❌ Email failed:", err);
  }
}

testEmail();
transporter.verify((err, success) => {
  if (err) {
    console.error("SMTP ERROR:", err);
  } else {
    console.log("SMTP OK!");
  }
});

export default router;
