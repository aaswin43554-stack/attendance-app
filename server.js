import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";

// Force IPv4 for SMTP connections to avoid ENETUNREACH on IPv6-only environments
dns.setDefaultResultOrder("ipv4first");

// Load .env only in local development
if (process.env.NODE_ENV !== "production") {
  const dotenv = await import("dotenv");
  dotenv.default.config({ path: ".env.local" }); // Load from .env.local
}

const app = express();
const PORT = process.env.PORT || 3000;

console.log("📍 Server Port:", PORT);
console.log("📧 Email User Configured:", process.env.EMAIL_USER ? "Yes" : "No");

// Use GOOGLE_SHEETS_API_URL in Render (recommended).
// Keep VITE_GOOGLE_SHEETS_API_URL as fallback so existing code still works.
const GOOGLE_SHEETS_API_URL =
  process.env.GOOGLE_SHEETS_API_URL || process.env.VITE_GOOGLE_SHEETS_API_URL;

// __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors()); // In production, Render often handles this, but explicit is safer
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "1.2.0-ultimate" });
});

/**
 * Proxy endpoint for Google Sheets API
 */
app.post("/api/sheets", async (req, res) => {
  try {
    if (!GOOGLE_SHEETS_API_URL) {
      return res.status(500).json({
        error:
          "Google Sheets URL not configured. Set GOOGLE_SHEETS_API_URL in Render Environment Variables.",
      });
    }

    const response = await fetch(GOOGLE_SHEETS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();

    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (error) {
    console.error("Error proxying request to Google Sheets:", error);
    res.status(500).json({
      error: error.message || "Failed to reach Google Sheets",
    });
  }
});

/**
 * Proxy endpoint for notifications (Email/SMS)
 */
app.post("/api/notify", async (req, res) => {
  try {
    const { action, email, phone, name, password } = req.body;

    if (action === "resetPassword") {
      if (GOOGLE_SHEETS_API_URL) {
        await fetch(GOOGLE_SHEETS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sendResetEmail",
            email,
            name,
            password,
          }),
        });
      }
      console.log(`[NOTIFY] Password reset sent to ${email} and ${phone}`);
      return res.json({ success: true, message: "Reset instructions sent." });
    }

    res.status(400).json({ error: "Invalid notify action" });
  } catch (error) {
    console.error("Notification error:", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// In-memory storage for OTPs
const otpStore = new Map();

/**
 * Configure Nodemailer Transporter
 * Falls back to hardcoded credentials if environment variables are missing
 */
const createTransporter = () => {
  const user = process.env.EMAIL_USER || "rtarunkumar3112@gmail.com";
  const pass = process.env.EMAIL_PASS || "brtzcxgyasptsfmz";

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use STARTTLS
    auth: { user, pass },
    connectionTimeout: 15000, // 15s timeout
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
};

/**
 * Generate and Send OTP via Nodemailer
 */
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const cleanEmail = email.trim().toLowerCase();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP for 10 minutes
    otpStore.set(cleanEmail, {
      otp,
      expires: Date.now() + 10 * 60 * 1000
    });

    console.log(`[AUTH] Generating OTP for ${cleanEmail}: ${otp}`);

    // Attempt to send email
    try {
      const mailOptions = {
        from: `"TronX Labs Support" <${process.env.EMAIL_USER || "rtarunkumar3112@gmail.com"}>`,
        to: cleanEmail,
        subject: "Your Verification Code - TronX Labs",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <h2 style="color: #1e293b; text-align: center; margin-bottom: 8px;">Verification Code</h2>
            <p style="color: #64748b; text-align: center; font-size: 16px;">Use the code below to reset your password.</p>
            <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
              <span style="font-size: 42px; font-weight: bold; color: #3b82f6; letter-spacing: 12px; font-family: monospace;">${otp}</span>
            </div>
            <p style="color: #94a3b8; font-size: 14px; text-align: center;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
          </div>
        `,
      };

      const transporter = createTransporter();
      await transporter.sendMail(mailOptions);
      console.log(`[AUTH] Styled OTP sent to ${cleanEmail}`);
    } catch (mailError) {
      console.error("❌ Email Sending Failed:", mailError.message);
      return res.status(500).json({ error: `Failed to send email: ${mailError.message}. Check SMTP configuration.` });
    }

    res.json({ success: true, message: "OTP verification code sent to your email." });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Verify OTP
 */
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

  const cleanEmail = email.trim().toLowerCase();
  const stored = otpStore.get(cleanEmail);

  if (!stored) return res.status(400).json({ error: "No OTP found. Please request a new one." });
  if (Date.now() > stored.expires) {
    otpStore.delete(cleanEmail);
    return res.status(400).json({ error: "OTP has expired." });
  }
  if (stored.otp !== otp) return res.status(400).json({ error: "Invalid OTP code." });

  // Clear OTP after successful verification
  otpStore.delete(cleanEmail);
  res.json({ success: true, message: "OTP verified" });
});

// ✅ Serve Vite build output (dist)
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// ✅ SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") return next();
  return res.sendFile(path.join(distPath, "index.html"));
});

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is listening at http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is busy.`);
  } else {
    console.error("❌ Server Error:", err);
  }
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
});
