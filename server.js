import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// 1. Initialize Express & Constants
const app = express();
const PORT = process.env.PORT || 10000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Load Environment Variables
config({ path: ".env.local" });
config(); // Fallback to .env

console.log("="?.repeat(50));
console.log("🚀 BULLETPROOF SERVER STARTUP");
console.log(`[SYS] Environment: ${process.env.NODE_ENV || 'development'}`);

// 3. Critical Startup Validation
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error(`❌ CRITICAL ERROR: The following environment variables are MISSING: ${missing.join(", ")}`);
  if (process.env.NODE_ENV === "production") {
    throw new Error(`CRITICAL: Missing required environment variables: ${missing.join(", ")}`);
  }
}

// 4. Supabase Admin Initialisation
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log(`[SYS] Supabase URL: ${supabaseUrl}`);
console.log(`[SYS] Supabase Service Role Active: ${isServiceRole}`);
console.log("="?.repeat(50));

// 5. Middleware Setup
app.use(cors({
  origin: ["http://localhost:5173", "https://attendance-app-i868.onrender.com"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Internal Helpers
const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

const resetRateLimits = new Map();
function isRateLimited(email) {
  const now = Date.now();
  const limit = 5; // relax to 5 per hour for testing
  const timeframe = 60 * 60 * 1000;
  const history = resetRateLimits.get(email) || [];
  const recentRequests = history.filter(time => now - time < timeframe);
  if (recentRequests.length >= limit) return true;
  recentRequests.push(now);
  resetRateLimits.set(email, recentRequests);
  return false;
}

// --- ROUTES ---

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    db: !!supabaseAdmin,
    isServiceRole,
    resend: !!process.env.RESEND_API_KEY
  });
});

/**
 * CUSTOM OTP PASSWORD RESET FLOW
 */

// A. Request Reset OTP
app.post("/api/auth/request-reset", async (req, res) => {
  const { email: rawEmail } = req.body;
  const cleanEmail = normalizeEmail(rawEmail);

  console.log(`[REQ_RESET] Incoming request for email: "${cleanEmail}" (Raw: "${rawEmail}")`);

  if (!cleanEmail) return res.status(400).json({ ok: false, error: "Email is required" });

  // 1. Check Env Vars & Client Config
  if (!process.env.RESEND_API_KEY) {
    console.error("[REQ_RESET] ERROR: RESEND_API_KEY is not defined.");
    return res.status(500).json({ ok: false, error: "Email service not configured (Missing API Key)" });
  }
  if (!supabaseAdmin) {
    console.error("[REQ_RESET] ERROR: supabaseAdmin client not initialized.");
    return res.status(500).json({ ok: false, error: "Database service not initialized" });
  }

  if (isRateLimited(cleanEmail)) {
    console.warn(`[REQ_RESET] Rate limit hit for ${cleanEmail}`);
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again in an hour." });
  }

  // Generate secure 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  try {
    // 2. Verify user exists
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .single();

    if (user) {
      console.log(`[REQ_RESET] User found: ${user.id}. Storing OTP record...`);

      // 3. Store in public.password_resets
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
        console.error(`[REQ_RESET] DB UPSERT FAILED for ${cleanEmail}:`, upsertErr);
        return res.status(500).json({ ok: false, error: "DB insert failed: Could not store reset record" });
      }

      // 4. Send via Resend
      const apiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL || "TronX Labs <no-reply@resend.dev>";

      console.log(`[REQ_RESET] Sending email via Resend to ${cleanEmail}...`);
      const emailResult = await fetch("https://api.resend.com/emails", {
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

      if (!emailResult.ok) {
        const errorData = await emailResult.json().catch(() => ({}));
        console.error(`[REQ_RESET] Resend API Error (${emailResult.status}):`, errorData);
        return res.status(500).json({ ok: false, error: `Email send failed: ${errorData.message || emailResult.statusText}` });
      }

      console.log(`[REQ_RESET] SUCCESS: Reset OTP sent to ${cleanEmail}`);
    } else {
      console.log(`[REQ_RESET] WARN: Email ${cleanEmail} not found in users table. Returning silent success.`);
    }

    // Generic success for security
    return res.json({ ok: true, message: "If an account exists, a reset code has been sent." });
  } catch (err) {
    console.error(`[REQ_RESET] UNEXPECTED FATAL ERROR:`, err);
    return res.status(500).json({ ok: false, error: `Internal error: ${err.message}` });
  }
});

// B. Verify OTP and Reset Password
app.post("/api/auth/verify-reset", async (req, res) => {
  const { email: rawEmail, otp, newPassword } = req.body;
  const cleanEmail = normalizeEmail(rawEmail);

  if (!cleanEmail || !otp || !newPassword) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
  }

  console.log(`[DEBUG-VERIFY] Attempt for: "${cleanEmail}"`);

  try {
    // 1. Fetch record
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from("password_resets")
      .select("*")
      .eq("email", cleanEmail)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchErr) {
      console.error(`[DEBUG-VERIFY] DB FETCH ERROR:`, fetchErr);
      return res.status(500).json({ ok: false, error: "Database error" });
    }

    if (!rows || rows.length === 0) {
      console.error(`[DEBUG-VERIFY] NO ROWS FOUND for ${cleanEmail}`);
      return res.status(400).json({ ok: false, error: "No reset request found for this email" });
    }

    const reset = rows[0];
    const now = new Date();
    const expiryDate = new Date(reset.expires_at);

    if (now > expiryDate) {
      console.warn(`[DEBUG-VERIFY] CODE EXPIRED. Now > Expiry`);
      return res.status(400).json({ ok: false, error: "Reset code has expired." });
    }

    if (reset.attempts >= 5) {
      console.warn(`[DEBUG-VERIFY] MAX ATTEMPTS HIT.`);
      return res.status(403).json({ ok: false, error: "Too many failed attempts." });
    }

    // 2. Hash Verification
    const isMatch = await bcrypt.compare(String(otp).trim(), reset.otp_hash);
    if (!isMatch) {
      console.log(`[DEBUG-VERIFY] OTP MISMATCH`);
      await supabaseAdmin
        .from("password_resets")
        .update({ attempts: reset.attempts + 1 })
        .eq("email", cleanEmail);
      return res.status(400).json({ ok: false, error: "Invalid verification code" });
    }

    console.log(`[DEBUG-VERIFY] OTP VALID. Updating Auth Password...`);

    // 3. User Update (Admin API)
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;

    const targetUser = users.find(u => normalizeEmail(u.email) === cleanEmail);
    if (!targetUser) {
      console.error(`[DEBUG-VERIFY] User not found in auth system`);
      return res.status(404).json({ ok: false, error: "User not found in auth system" });
    }

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: newPassword
    });

    if (authErr) {
      console.error(`[DEBUG-VERIFY] AUTH UPDATE FAILED:`, authErr.message);
      throw authErr;
    }

    // 4. Cleanup
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
 * 6. STATIC ASSETS & SPA ROUTING
 */
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// Fallback all other non-API routes to index.html for SPA support
// This middleware-based approach avoids PathErrors on newer Express versions
app.use((req, res, next) => {
  // If the request is for an API route or health check that wasn't handled, return 404
  if (req.path.startsWith("/api") || req.path === "/health") {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // Otherwise, serve index.html for SPA routing support
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      // If index.html is missing (e.g. build failed), don't crash the server
      res.status(404).send("Frontend build not found. Please run 'npm run build'.");
    }
  });
});

// 7. START SERVER
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Bulletproof Server listening on port ${PORT}`);
  console.log(`🚀 Service ready at http://0.0.0.0:${PORT}`);
});
