import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// --- HYPER-ROBUST ENVIRONMENT LOADING ---
import { config } from "dotenv";
config();
config({ path: ".env.local" });
config({ path: ".env.production" });

const app = express();
const PORT = process.env.PORT || 3000;

// GLOBAL CONSTANTS FOR ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    console.error("❌ Supabase Admin Init Error:", err.message);
  }
}

/**
 * Resend Email API Helper (8s Hard Timeout)
 */
async function sendEmailViaResend(email, otp) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY missing");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "TronX Labs <no-reply@resend.dev>",
        to: [email],
        subject: "Verification Code - TronX Labs",
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; color: #1e293b; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="text-align: center;">Verification Code</h2>
            <p>Use the code below to verify your identity. This code expires in 10 minutes.</p>
            <div style="background: #f8fafc; padding: 24px; text-align: center; border-radius: 12px; margin: 20px 0;">
              <span style="font-size: 36px; font-weight: bold; color: #3b82f6; letter-spacing: 10px;">${otp}</span>
            </div>
            <p style="font-size: 12px; color: #64748b; text-align: center;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Resend API error");
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Hashing Helper (SHA-256)
 */
const hashOTP = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "2.0.0-bulletproof" });
});

/**
 * OTP ENDPOINTS (STRICT IMPLEMENTATION)
 */

// Generate and Send OTP
app.post("/api/auth/send-reset-otp", async (req, res) => {
  const startTime = Date.now();
  const { email } = req.body;

  if (!email) return res.status(400).json({ ok: false, error: "Email required" });
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Database not configured" });

  const cleanEmail = email.trim().toLowerCase();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = hashOTP(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  console.log(`[AUTH] [OTP-SEND] Request for ${cleanEmail}`);

  try {
    // 1. Store hashed OTP in Supabase
    const { error: dbErr } = await supabaseAdmin
      .from("password_reset_otps")
      .upsert({ email: cleanEmail, otp_hash: hashedOtp, expires_at: expiresAt });

    if (dbErr) throw new Error(`DB Error: ${dbErr.message}`);

    // 2. Send via Resend with 8s timeout
    await sendEmailViaResend(cleanEmail, otp);

    console.log(`[AUTH] [OTP-SUCCESS] Sent in ${Date.now() - startTime}ms`);
    return res.json({ ok: true, message: "OTP sent successfully" });

  } catch (error) {
    console.error(`[AUTH] [OTP-ERROR]`, error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Verify OTP
app.post("/api/auth/verify-reset-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ ok: false, error: "Email and OTP required" });
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Database not configured" });

  const cleanEmail = email.trim().toLowerCase();
  const hashedInput = hashOTP(otp);

  try {
    const { data, error } = await supabaseAdmin
      .from("password_reset_otps")
      .select("*")
      .eq("email", cleanEmail)
      .single();

    if (error || !data) return res.status(400).json({ ok: false, error: "Invalid or expired code" });

    // Check expiry
    if (new Date() > new Date(data.expires_at)) {
      await supabaseAdmin.from("password_reset_otps").delete().eq("email", cleanEmail);
      return res.status(400).json({ ok: false, error: "Code has expired" });
    }

    // Check hash match
    if (data.otp_hash !== hashedInput) return res.status(400).json({ ok: false, error: "Incorrect code" });

    // Success: Delete the code after use
    await supabaseAdmin.from("password_reset_otps").delete().eq("email", cleanEmail).catch(() => { });

    return res.json({ ok: true, message: "OTP verified" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Verification failed" });
  }
});

/**
 * LEGACY FALLBACKS (Redirects to new endpoints)
 */
app.post("/api/send-otp", (req, res) => {
  console.log("[LEGACY] Redirecting /api/send-otp -> /api/auth/send-reset-otp");
  res.redirect(307, "/api/auth/send-reset-otp");
});

app.post("/api/verify-otp", (req, res) => {
  console.log("[LEGACY] Redirecting /api/verify-otp -> /api/auth/verify-reset-otp");
  res.redirect(307, "/api/auth/verify-reset-otp");
});

// Serve frontend static build
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback for routing
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") return next();
  return res.sendFile(path.join(distPath, "index.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Bulletproof Server listening at http://localhost:${PORT}`);
});

process.on("uncaughtException", (err) => console.error("💥 Uncaught Exception:", err));
process.on("unhandledRejection", (reason) => console.error("💥 Unhandled Rejection:", reason));
