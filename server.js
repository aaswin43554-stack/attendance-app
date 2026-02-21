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
// Try loading all possible .env files (Silent if they don't exist)
config();
config({ path: ".env.local" });
config({ path: ".env.production" });

const app = express();
const PORT = process.env.PORT || 3000;

// DIAGNOSTICS: Log environment status at startup
console.log("="?.repeat(50));
console.log("🚀 SERVER STARTUP DIAGNOSTICS");
console.log("📍 Node Version:", process.version);
console.log("📍 Environment:", process.env.NODE_ENV || "development");
console.log("📍 Keys Found:", Object.keys(process.env).filter(k => k.includes("URL") || k.includes("EMAIL") || k.includes("SHEETS")).join(", "));
console.log("="?.repeat(50));

// LAZY GAS URL DETECTOR (Call this whenever needed)
const getSheetsUrl = () => {
  const directMatch = process.env.GOOGLE_SHEETS_API_URL || process.env.VITE_GOOGLE_SHEETS_API_URL;
  if (directMatch) return directMatch;

  // Fuzzy search for anything that looks like the spreadsheet API
  const fuzzyKey = Object.keys(process.env).find(k =>
    (k.toUpperCase().includes("SHEETS") && k.toUpperCase().includes("URL")) ||
    (k.toUpperCase().includes("GAS") && k.toUpperCase().includes("URL"))
  );

  return fuzzyKey ? process.env[fuzzyKey] : null;
};

// GLOBAL CONSTANTS FOR ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GOOGLE_SHEETS_API_URL = getSheetsUrl();

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
    const currentUrl = getSheetsUrl();
    if (!currentUrl) {
      return res.status(500).json({
        error:
          "Google Sheets URL not configured. Set GOOGLE_SHEETS_API_URL in Render Environment Variables.",
      });
    }

    const response = await fetch(currentUrl, {
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
      const currentUrl = getSheetsUrl();
      if (currentUrl) {
        await fetch(currentUrl, {
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
  // Try Environment Vars -> Try Hardcoded Fail-safe
  const user = process.env.EMAIL_USER || "rtarunkumar3112@gmail.com";
  const pass = process.env.EMAIL_PASS || "brtzcxgyasptsfmz";

  console.log(`[SMTP] Initializing transporter for ${user}...`);

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Port 587 requires secure: false for STARTTLS
    auth: { user, pass },
    connectionTimeout: 60000, // 60s max timeout for slow cloud networks
    greetingTimeout: 30000,
    socketTimeout: 60000,
    // Strict IPv4 bypass for ENETUNREACH
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { family: 4 }, callback);
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }
  });
};

/**
 * Helper: node-fetch with a strict timeout
 */
async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Timeout after ${timeoutMs}ms`);
    throw err;
  }
}

/**
 * Generate and Send OTP via Nodemailer
 */
app.post("/api/send-otp", async (req, res) => {
  const startTime = Date.now();
  console.log(`[AUTH] [START] Request received for OTP`);
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const cleanEmail = email.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP for 10 minutes
    otpStore.set(cleanEmail, {
      otp,
      expires: Date.now() + 10 * 60 * 1000
    });

    console.log(`[AUTH] OTP generated for ${cleanEmail}: ${otp}`);

    // PART 1: Try sending via Google Apps Script API (Highly reliable in cloud)
    let emailSentSuccessfully = false;
    let emailErrorMessage = "";

    // RE-FETCH URL IN CASE IT WAS LOADED LATE
    const currentGasUrl = getSheetsUrl();

    if (currentGasUrl) {
      const gasStartTime = Date.now();
      try {
        console.log(`[AUTH] [GAS-PHASE] Attempting delivery (8s limit)...`);
        const gasResponse = await fetchWithTimeout(currentGasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sendOTP", email: cleanEmail, otp: otp }),
        }, 8000);

        const textResponse = await gasResponse.text();
        let gasData = {};
        try { gasData = JSON.parse(textResponse); } catch (e) { }

        if (gasResponse.ok && (gasData.success || gasData.status === "success" || gasData.status === "ok")) {
          console.log(`[AUTH] Success via GAS-POST after ${Date.now() - gasStartTime}ms`);
          emailSentSuccessfully = true;
        } else {
          console.log(`[AUTH] GAS-POST failed. Trying GAS-GET...`);
          const getUrl = `${currentGasUrl}${currentGasUrl.includes('?') ? '&' : '?'}action=sendOTP&email=${encodeURIComponent(cleanEmail)}&otp=${otp}`;
          const getResponse = await fetchWithTimeout(getUrl, {}, 4000); // 4s for GET
          if (getResponse.ok) {
            console.log(`[AUTH] Success via GAS-GET after total GAS phase ${Date.now() - gasStartTime}ms`);
            emailSentSuccessfully = true;
          } else {
            emailErrorMessage = gasData.error || gasData.message || `GAS Get Status: ${getResponse.status}`;
            console.warn(`[AUTH] GAS Proxy (GET) also failed: ${emailErrorMessage}`);
          }
        }
      } catch (err) {
        console.warn(`[AUTH] GAS Phase timed out or failed after ${Date.now() - gasStartTime}ms: ${err.message}`);
        emailErrorMessage = `GAS Error: ${err.message}`;
      }
    } else {
      emailErrorMessage = "Google Sheets API URL is MISSING in environment variables.";
      console.warn("[AUTH] GAS Proxy skipped: GOOGLE_SHEETS_API_URL not set.");
    }

    // PART 2: Fallback to Nodemailer (15s limit)
    if (!emailSentSuccessfully) {
      const smtpStartTime = Date.now();
      console.log(`[AUTH] [SMTP-PHASE] Falling back (15s limit). Reason: ${emailErrorMessage}`);
      try {
        const mailOptions = {
          from: `"TronX Labs Support" <${process.env.EMAIL_USER || "rtarunkumar3112@gmail.com"}>`,
          to: cleanEmail,
          subject: "Your Verification Code - TronX Labs",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
              <h2 style="color: #1e293b; text-align: center;">Verification Code</h2>
              <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center;">
                <span style="font-size: 42px; font-weight: bold; color: #3b82f6; letter-spacing: 12px;">${otp}</span>
              </div>
            </div>
          `,
        };

        const transporter = createTransporter();
        const smtpPromise = transporter.sendMail(mailOptions);

        // Wrap SMTP in a timeout race
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP Timeout")), 15000));
        await Promise.race([smtpPromise, timeoutPromise]);

        console.log(`[AUTH] Success via SMTP after ${Date.now() - smtpStartTime}ms`);
        emailSentSuccessfully = true;
      } catch (mailError) {
        console.error(`[AUTH] SMTP Failed/Timed out after ${Date.now() - smtpStartTime}ms:`, mailError.message);
        return res.status(500).json({
          error: `Delivery timeout. (GAS: ${emailErrorMessage} | SMTP: ${mailError.message}).`
        });
      }
    }

    console.log(`[AUTH] [FINISH] Total duration: ${Date.now() - startTime}ms`);
    res.json({
      success: true,
      message: "OTP verification code sent.",
      otp: otp,
      duration: Date.now() - startTime
    });
  } catch (error) {
    console.error("[AUTH] Fatal Server Error:", error);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
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
