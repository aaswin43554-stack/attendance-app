import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// --- HYPER-ROBUST ENVIRONMENT LOADING ---
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // Fallback to .env

// Critical Startup Validation
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"];
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ CRITICAL ERROR: Missing environment variable: ${key}`);
    if (process.env.NODE_ENV === "production") {
      throw new Error(`CRITICAL: Missing required environment variable ${key}`);
    }
  }
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // MUST use service_role for admin tasks
const isServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const { createClient } = await import("@supabase/supabase-js");
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log(`[SYS] Supabase Admin Initialized. Service Role: ${isServiceRole}`);

// Helper for strict email normalization
const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

// Simple in-memory rate limiting (Resets on server restart)
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

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    db: !!supabaseAdmin,
    isServiceRole,
    resend: !!process.env.RESEND_API_KEY
  });
});

/**
 * CUSTOM OTP PASSWORD RESET FLOW
 */

// 1. Request Reset OTP
app.post("/api/auth/request-reset", async (req, res) => {
  const { email: rawEmail } = req.body;
  const cleanEmail = normalizeEmail(rawEmail);

  if (!cleanEmail) return res.status(400).json({ ok: false, error: "Email is required" });
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Database not configured" });

  console.log(`[DEBUG-RESET] Request for: "${rawEmail}" -> Normalized: "${cleanEmail}"`);

  if (isRateLimited(cleanEmail)) {
    console.warn(`[DEBUG-RESET] Rate limit hit for ${cleanEmail}`);
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again in an hour." });
  }

  // Generate secure 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  try {
    // 1. Verify user exists in public.users
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .single();

    if (user) {
      console.log(`[DEBUG-RESET] User found: ${user.id}. Storing OTP...`);

      // 2. Store in public.password_resets
      const { error: upsertErr } = await supabaseAdmin
        .from("password_resets")
        .upsert({
          email: cleanEmail,
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempts: 0,
          created_at: now.toISOString()
        }, { onConflict: 'email' });

      if (upsertErr) {
        console.error(`[DEBUG-RESET] DB UPSERT FAILED:`, upsertErr);
        throw upsertErr;
      }

      // 3. Send via Resend
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
              <p style="font-size: 13px; color: #64748b; text-align: center;">If you didn't request a password reset, please ignore this email.</p>
            </div>
          `,
        }),
      });
      console.log(`[DEBUG-RESET] Email sent successfully to ${cleanEmail}`);
    } else {
      console.log(`[DEBUG-RESET] Email ${cleanEmail} not found in users table. Silent success.`);
    }

    return res.json({ ok: true, message: "If an account exists, a reset code has been sent." });
  } catch (err) {
    console.error(`[DEBUG-RESET] EXCEPTION:`, err.message);
    return res.status(500).json({ ok: false, error: "Failed to process reset request" });
  }
});

// 2. Verify OTP and Reset Password
app.post("/api/auth/verify-reset", async (req, res) => {
  const { email: rawEmail, otp, newPassword } = req.body;
  const cleanEmail = normalizeEmail(rawEmail);

  if (!cleanEmail || !otp || !newPassword) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
  }

  console.log(`[DEBUG-VERIFY] Attempt for: "${cleanEmail}" (Raw: "${rawEmail}")`);

  try {
    // STEP 1: Fetch rows WITHOUT filter for debugging
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from("password_resets")
      .select("*")
      .eq("email", cleanEmail)
      .order("created_at", { ascending: false })
      .limit(5);

    if (fetchErr) {
      console.error(`[DEBUG-VERIFY] DB FETCH ERROR:`, fetchErr);
      return res.status(500).json({ ok: false, error: "Database error" });
    }

    if (!rows || rows.length === 0) {
      console.error(`[DEBUG-VERIFY] NO ROWS FOUND for ${cleanEmail}. Check if public.password_resets has the entry.`);
      return res.status(400).json({ ok: false, error: "No reset request found for this email" });
    }

    const reset = rows[0];
    const now = new Date();
    const expiryDate = new Date(reset.expires_at);

    console.log(`[DEBUG-VERIFY] Row found. Created: ${reset.created_at}, Expires: ${reset.expires_at}, Now: ${now.toISOString()}`);

    // Expiry Check
    if (now > expiryDate) {
      console.warn(`[DEBUG-VERIFY] EXPIRED. Now > Expiry`);
      return res.status(400).json({ ok: false, error: "Reset code has expired. Please request a new one." });
    }

    // Lockout Check
    if (reset.attempts >= 5) {
      console.warn(`[DEBUG-VERIFY] LOCKOUT. Attempts: ${reset.attempts}`);
      return res.status(403).json({ ok: false, error: "Too many failed attempts. Request a new code." });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(String(otp).trim(), reset.otp_hash);
    if (!isMatch) {
      console.log(`[DEBUG-VERIFY] OTP MISMATCH`);
      await supabaseAdmin
        .from("password_resets")
        .update({ attempts: reset.attempts + 1 })
        .eq("email", cleanEmail);
      return res.status(400).json({ ok: false, error: "Invalid verification code" });
    }

    console.log(`[DEBUG-VERIFY] OTP VALID. Updating Supabase Auth password...`);

    // STEP 2: Update password using Admin API
    // We first need the auth user ID. supabaseAdmin.auth.admin.listUsers is the only way by email.
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;

    const targetUser = users.find(u => normalizeEmail(u.email) === cleanEmail);
    if (!targetUser) {
      console.error(`[DEBUG-VERIFY] User found in public.users but MISSING in auth.users?`);
      return res.status(404).json({ ok: false, error: "User not found in auth system" });
    }

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: newPassword
    });

    if (authErr) {
      console.error(`[DEBUG-VERIFY] AUTH UPDATE FAILED:`, authErr.message);
      throw authErr;
    }

    // STEP 3: Cleanup
    await supabaseAdmin
      .from("password_resets")
      .delete()
      .eq("email", cleanEmail);

    console.log(`[DEBUG-VERIFY] SUCCESS for ${cleanEmail}`);
    return res.json({ ok: true, message: "Password updated successfully!" });
  } catch (err) {
    console.error(`[DEBUG-VERIFY] EXCEPTION:`, err.message);
    return res.status(500).json({ ok: false, error: "System error during password reset" });
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
