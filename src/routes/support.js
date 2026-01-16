import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

router.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"KahawaPay Support" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `New Customer Message - ${name}`,
      html: `
        <h3>New Message from Website Chat</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b><br/>${message}</p>
      `
    });

    res.json({ success: true });
  } catch (error) {
    console.error("EMAIL ERROR FULL:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // 🔒 Validation: email and message are required
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email is required." });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"KahawaPay Support" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `New Customer Message - ${name || "Anonymous"}`,
      html: `
        <h3>New Message from Website Chat</h3>
        <p><b>Name:</b> ${name || "Not provided"}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b><br/>${message}</p>
      `
    });

    res.json({ success: true });
  } catch (error) {
    console.error("EMAIL ERROR FULL:", error);
    res.status(500).json({ error: error.message });
  }
});
export default router;

