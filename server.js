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
// Note: Backend requires SUPABASE_SERVICE_ROLE_KEY!
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// STARTUP DIAGNOSTICS
console.log("="?.repeat(50));
console.log("🚀 BULLETPROOF SERVER STARTUP");
console.log("Mode: Client-side Native Reset Preferred");
if (!SUPABASE_URL) console.warn("⚠️ WARNING: SUPABASE_URL missing");
if (!SUPABASE_KEY) console.warn("ℹ️ INFO: SUPABASE_SERVICE_ROLE_KEY missing (Backend OTP disabled)");
if (!process.env.RESEND_API_KEY) console.warn("ℹ️ INFO: RESEND_API_KEY missing (Backend Email disabled)");
console.log("="?.repeat(50));

/**
 * Initialize Supabase Admin Client
 */
let supabaseAdmin = null;
const initSupabase = async () => {
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("✅ Supabase Admin initialized successfully");
    } catch (err) {
      console.error("❌ Failed to init Supabase Admin:", err.message);
    }
  }
};
await initSupabase();

/**
 * Resend Email API Helper (8s Hard Timeout)
 */
async function sendEmailViaResend(email, otp) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY missing. Set it in Render Environment Variables.");

  const fromEmail = process.env.RESEND_FROM_EMAIL || "TronX Labs <no-reply@resend.dev>";

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
        from: fromEmail,
        to: [email],
        subject: "Verification Code - TronX Labs",
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; color: #1e293b; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="text-align: center; color: #3b82f6;">Verify Your Identity</h2>
            <p>Use the code below to complete your password reset request. This code will expire in 10 minutes.</p>
            <div style="background: #f8fafc; padding: 32px; text-align: center; border-radius: 12px; margin: 24px 0;">
              <span style="font-size: 42px; font-weight: bold; color: #1e293b; letter-spacing: 12px;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; text-align: center;">This is an automated message. If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `Resend Error: ${response.status}`);
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
  res.json({
    status: "ok",
    db: !!supabaseAdmin,
    resend: !!process.env.RESEND_API_KEY
  });
});

/**
 * OTP ENDPOINTS
 */

// 1. Generate and Send OTP
app.post("/api/auth/send-reset-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, error: "Email is required" });
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Database not configured. Check SUPABASE_URL and SERVICE_ROLE_KEY." });

  const cleanEmail = email.trim().toLowerCase();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = hashOTP(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  console.log(`[AUTH] Generating OTP for ${cleanEmail}`);

  try {
    // Save to Supabase (Upsert to handle re-sends)
    const { error: dbErr } = await supabaseAdmin
      .from("password_reset_otps")
      .upsert({
        email: cleanEmail,
        otp_hash: hashedOtp,
        expires_at: expiresAt
      }, { onConflict: 'email' });

    if (dbErr) throw new Error(`Database Error: ${dbErr.message}`);

    // Send via Resend with timeout
    await sendEmailViaResend(cleanEmail, otp);

    return res.json({ ok: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error(`[AUTH] OTP Error:`, error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// 2. Verify OTP
app.post("/api/auth/verify-reset-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ ok: false, error: "Email and OTP are required" });
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Database not configured" });

  const cleanEmail = email.trim().toLowerCase();
  const hashedInput = hashOTP(otp.trim());

  try {
    const { data, error } = await supabaseAdmin
      .from("password_reset_otps")
      .select("*")
      .eq("email", cleanEmail)
      .single();

    if (error || !data) return res.status(400).json({ ok: false, error: "No valid code found for this email" });

    // Expiry check
    if (new Date() > new Date(data.expires_at)) {
      await supabaseAdmin.from("password_reset_otps").delete().eq("email", cleanEmail);
      return res.status(400).json({ ok: false, error: "Code has expired. Please request a new one." });
    }

    // Hash check
    if (data.otp_hash !== hashedInput) {
      return res.status(400).json({ ok: false, error: "Incorrect verification code" });
    }

    // Success: Delete code
    await supabaseAdmin.from("password_reset_otps").delete().eq("email", cleanEmail).catch(() => { });

    return res.json({ ok: true, message: "Identity verified" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Verification system error" });
  }
});

/**
 * LEGACY FALLBACKS
 */
app.post("/api/send-otp", (req, res) => res.redirect(307, "/api/auth/send-reset-otp"));
app.post("/api/verify-otp", (req, res) => res.redirect(307, "/api/auth/verify-reset-otp"));

// Static File Serving (Dist)
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA Routing
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") return next();
  return res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 TronX Bulletproof Server listening on port ${PORT}`);
});
