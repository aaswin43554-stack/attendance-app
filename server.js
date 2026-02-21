import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";

// Force IPv4 for SMTP connections to avoid ENETUNREACH on IPv6-only environments
dns.setDefaultResultOrder("ipv4first");

// --- HYPER-ROBUST ENVIRONMENT LOADING ---
import { config } from "dotenv";
config();
config({ path: ".env.local" });
config({ path: ".env.production" });

const app = express();
const PORT = process.env.PORT || 3000;

// DIAGNOSTICS
console.log("="?.repeat(50));
console.log("🚀 SERVER STARTUP DIAGNOSTICS");
console.log("📍 Node Version:", process.version);
console.log("📍 Environment:", process.env.NODE_ENV || "development");
console.log("="?.repeat(50));

const getSheetsUrl = () => {
  const directMatch = process.env.GOOGLE_SHEETS_API_URL || process.env.VITE_GOOGLE_SHEETS_API_URL;
  if (directMatch) return directMatch;
  const fuzzyKey = Object.keys(process.env).find(k =>
    (k.toUpperCase().includes("SHEETS") && k.toUpperCase().includes("URL")) ||
    (k.toUpperCase().includes("GAS") && k.toUpperCase().includes("URL"))
  );
  return fuzzyKey ? process.env[fuzzyKey] : null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const otpStore = new Map(); // Memory fallback

// --- SUPABASE BACKEND CLIENT (Admin access for OTPs) ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Supabase Admin initialized for OTP management");
  } catch (err) {
    console.warn("⚠️ Could not initialize Supabase Admin:", err.message);
  }
}

/**
 * Configure Resend Email Helper
 */
async function sendEmailViaResend(email, otp) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "TronX Labs <onboarding@resend.dev>",
      to: [email],
      subject: "Verification Code - TronX Labs",
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; color: #1e293b;">
          <h2>Verification Code</h2>
          <div style="background: #f8fafc; padding: 24px; text-align: center; border-radius: 12px;">
            <span style="font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="margin-top: 16px;">This code expires in 10 minutes.</p>
        </div>
      `,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Resend API error");
  return data;
}

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "1.3.0-resend" });
});

/**
 * Proxy endpoints
 */
app.post("/api/sheets", async (req, res) => {
  try {
    const currentUrl = getSheetsUrl();
    if (!currentUrl) return res.status(500).json({ error: "GAS URL not set" });
    const response = await fetch(currentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    try { return res.json(JSON.parse(text)); } catch { return res.send(text); }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/notify", async (req, res) => {
  try {
    const { action, email, name, password } = req.body;
    if (action === "resetPassword") {
      const currentUrl = getSheetsUrl();
      if (currentUrl) {
        fetch(currentUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sendResetEmail", email, name, password }),
        }).catch(() => { });
      }
      return res.json({ success: true, message: "Reset instructions sent." });
    }
    res.status(400).json({ error: "Invalid notify action" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send notification" });
  }
});

/**
 * Generate and Send OTP
 */
app.post("/api/send-otp", async (req, res) => {
  const startTime = Date.now();
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, error: "Email required" });

  const cleanEmail = email.trim().toLowerCase();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  console.log(`[AUTH] [START] Request for ${cleanEmail}`);

  try {
    // 1. SAVE OTP TO SUPABASE
    if (supabaseAdmin) {
      const { error: dbErr } = await supabaseAdmin
        .from("otps")
        .upsert({ email: cleanEmail, otp, expires: expiresAt });
      if (dbErr) {
        console.error(`[AUTH] DB Store Error:`, dbErr.message);
        otpStore.set(cleanEmail, { otp, expires: expiresAt });
      }
    } else {
      otpStore.set(cleanEmail, { otp, expires: expiresAt });
    }

    let emailSent = false;
    let deliveryMethod = "Resend";

    // 2. PRIMARY: RESEND API
    try {
      await sendEmailViaResend(cleanEmail, otp);
      console.log(`[AUTH] Success via Resend inside ${Date.now() - startTime}ms`);
      emailSent = true;
    } catch (resendErr) {
      console.warn(`[AUTH] Resend failed, trying fallback SMTP: ${resendErr.message}`);
      deliveryMethod = "SMTP";
      try {
        const user = process.env.EMAIL_USER || "rtarunkumar3112@gmail.com";
        const pass = process.env.EMAIL_PASS || "brtzcxgyasptsfmz";
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: { user, pass },
          lookup: (hostname, options, callback) => dns.lookup(hostname, { family: 4 }, callback),
          tls: { rejectUnauthorized: false }
        });

        await Promise.race([
          transporter.sendMail({
            from: `"TronX Labs Support" <${user}>`,
            to: cleanEmail,
            subject: "Verification Code - TronX Labs",
            html: `<p>Your code: <b>${otp}</b></p>`
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP Timeout")), 15000))
        ]);
        console.log(`[AUTH] Success via SMTP inside ${Date.now() - startTime}ms`);
        emailSent = true;
      } catch (smtpErr) {
        console.error(`[AUTH] SMTP also failed:`, smtpErr.message);
      }
    }

    // 3. NON-BLOCKING GAS LOGGING
    const currentUrl = getSheetsUrl();
    if (currentUrl) {
      fetch(currentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendOTP", email: cleanEmail, otp: otp }),
      }).catch(() => { });
    }

    if (!emailSent) return res.status(500).json({ ok: false, error: "Delivery failed" });

    res.json({
      ok: true,
      success: true,
      message: "OTP sent",
      duration: Date.now() - startTime,
      method: deliveryMethod
    });
  } catch (error) {
    console.error("[AUTH] Fatal Error:", error);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Internal error" });
  }
});

/**
 * Verify OTP
 */
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ ok: false, error: "Email and OTP required" });

  const cleanEmail = email.trim().toLowerCase();

  try {
    let storedOtp = null;
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin.from("otps").select("*").eq("email", cleanEmail).single();
      if (data) storedOtp = data;
    }
    if (!storedOtp) storedOtp = otpStore.get(cleanEmail);

    if (!storedOtp) return res.status(400).json({ ok: false, error: "No OTP found" });
    if (Date.now() > storedOtp.expires) {
      if (supabaseAdmin) await supabaseAdmin.from("otps").delete().eq("email", cleanEmail);
      otpStore.delete(cleanEmail);
      return res.status(400).json({ ok: false, error: "OTP has expired" });
    }
    if (storedOtp.otp !== otp) return res.status(400).json({ ok: false, error: "Invalid code" });

    if (supabaseAdmin) await supabaseAdmin.from("otps").delete().eq("email", cleanEmail).catch(() => { });
    otpStore.delete(cleanEmail);

    res.json({ ok: true, message: "OTP verified" });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Verification failed" });
  }
});

// Serve static build
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") return next();
  return res.sendFile(path.join(distPath, "index.html"));
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is listening at http://localhost:${PORT}`);
});

process.on("uncaughtException", (err) => console.error("💥 Uncaught Exception:", err));
process.on("unhandledRejection", (reason, p) => console.error("💥 Unhandled Rejection at:", p, "reason:", reason));
