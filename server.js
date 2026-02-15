import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

// Load .env only in local development (Render uses Environment Variables)
if (process.env.NODE_ENV !== "production") {
  const dotenv = await import("dotenv");
  dotenv.default.config();
}

const app = express();
const PORT = process.env.PORT || 10000;

// Use GOOGLE_SHEETS_API_URL in Render (recommended).
// Keep VITE_GOOGLE_SHEETS_API_URL as fallback so existing code still works.
const GOOGLE_SHEETS_API_URL =
  process.env.GOOGLE_SHEETS_API_URL || process.env.VITE_GOOGLE_SHEETS_API_URL;

// __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Proxy endpoint for Google Sheets API
 * POST /api/sheets
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

    // Try JSON first, else return text
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
 * POST /api/notify
 */
app.post("/api/notify", async (req, res) => {
  try {
    const { action, email, phone, name, password } = req.body;

    if (action === "resetPassword") {
      // Forward to Google Apps Script for Email
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

      // Placeholder for SMS/n8n/Twilio
      console.log(`[NOTIFY] Password reset sent to ${email} and ${phone}`);

      return res.json({ success: true, message: "Reset instructions sent." });
    }

    res.status(400).json({ error: "Invalid notify action" });
  } catch (error) {
    console.error("Notification error:", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

/**
 * OTP endpoint
 * POST /api/otp
 */
app.post("/api/otp", async (req, res) => {
  try {
    const { email, phone } = req.body;
    console.log(`[OTP] Sending OTP to ${phone} for ${email}`);
    // Future: Integrate Twilio or n8n here
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP Error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// ✅ Serve Vite build output (dist)
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// ✅ SPA fallback WITHOUT app.get("*") or app.get("/*") (fixes your Render crash)
app.use((req, res, next) => {
  // Let API routes pass through
  if (req.path.startsWith("/api") || req.path === "/health") return next();

  // Serve the React/Vite app for all other routes
  return res.sendFile(path.join(distPath, "index.html"));
});

// Start server (Render requires listening on process.env.PORT)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📊 Google Sheets API configured: ${GOOGLE_SHEETS_API_URL ? "Yes" : "No"}`
  );
});
