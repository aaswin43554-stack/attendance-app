import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import bcrypt from "bcryptjs";

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
 * CUSTOM OTP PASSWORD RESET FLOW
 * Bypasses Supabase native email delivery
 */

// Simple in-memory rate limiting (Resets on server restart, fine for this app)
const resetRateLimits = new Map();

function isRateLimited(email) {
  const now = Date.now();
  const limit = 3; // 3 requests
  const timeframe = 60 * 60 * 1000; // per hour

  const history = resetRateLimits.get(email) || [];
  const recentRequests = history.filter(time => now - time < timeframe);

  if (recentRequests.length >= limit) return true;

  recentRequests.push(now);
  resetRateLimits.set(email, recentRequests);
  return false;
}

// 1. Request Reset OTP
app.post("/api/auth/request-reset", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, error: "Email is required" });
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Database not configured" });

  const cleanEmail = email.trim().toLowerCase();

  // Rate limit check
  if (isRateLimited(cleanEmail)) {
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again in an hour." });
  }

  // Generate secure 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

  console.log(`[AUTH] Custom OTP generated for ${cleanEmail}`);

  try {
    // We ALWAYS return success for security, but we only send the email if the user exists
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .single();

    if (user) {
      // Store/Update reset record
      await supabaseAdmin
        .from("password_resets")
        .upsert({
          email: cleanEmail,
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempts: 0
        }, { onConflict: 'email' });

      // Send via Resend
      const apiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL || "TronX Labs <no-reply@resend.dev>";

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [cleanEmail],
          subject: "Your password reset code",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; color: #1e293b; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
              <h2 style="text-align: center; color: #3b82f6;">Reset Code</h2>
              <p>Your password reset code is below. This code will expire in 10 minutes.</p>
              <div style="background: #f8fafc; padding: 32px; text-align: center; border-radius: 12px; margin: 24px 0;">
                <span style="font-size: 42px; font-weight: bold; color: #1e293b; letter-spacing: 12px;">${otp}</span>
              </div>
              <p style="font-size: 13px; color: #64748b; text-align: center;">This is an automated message. If you didn't request a reset, please ignore this email.</p>
            </div>
          `,
        }),
      });
    }

    return res.json({ ok: true, message: "If an account exists, OTP has been sent." });
  } catch (err) {
    console.error(`[AUTH] Request Reset Error:`, err.message);
    return res.status(500).json({ ok: false, error: "System error processing reset request" });
  }
});

// 2. Verify OTP and Reset Password
app.post("/api/auth/verify-reset", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Find latest valid reset record
    const { data: reset, error: fetchErr } = await supabaseAdmin
      .from("password_resets")
      .select("*")
      .eq("email", cleanEmail)
      .single();

    if (fetchErr || !reset) {
      return res.status(400).json({ ok: false, error: "No reset request found for this email" });
    }

    // Expiry check
    if (new Date() > new Date(reset.expires_at)) {
      return res.status(400).json({ ok: false, error: "OTP has expired. Please request a new one." });
    }

    // Attempt lock check
    if (reset.attempts >= 5) {
      return res.status(403).json({ ok: false, error: "Too many failed attempts. Please request a new code." });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp.trim(), reset.otp_hash);

    if (!isMatch) {
      await supabaseAdmin
        .from("password_resets")
        .update({ attempts: reset.attempts + 1 })
        .eq("email", cleanEmail);
      return res.status(400).json({ ok: false, error: "Invalid verification code" });
    }

    // SUCCESS: Update Supabase User via Admin API
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserByEmail(cleanEmail, {
      password: newPassword
    });

    if (authError) {
      console.error("❌ Supabase Admin Update Error:", authError);
      throw authError;
    }

    // Cleanup: Invalidate/Delete records
    await supabaseAdmin
      .from("password_resets")
      .delete()
      .eq("email", cleanEmail);

    return res.json({ ok: true, message: "Password updated successfully." });
  } catch (err) {
    console.error(`[AUTH] Verify Reset Error:`, err.message);
    return res.status(500).json({ ok: false, error: "Failed to reset password" });
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
