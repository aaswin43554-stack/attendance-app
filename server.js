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
const PORT = Number(process.env.PORT) || 10000;

// Use GOOGLE_SHEETS_API_URL in Render (recommended).
// Keep VITE_GOOGLE_SHEETS_API_URL as fallback so existing code still works.
const GOOGLE_SHEETS_API_URL =
  process.env.GOOGLE_SHEETS_API_URL || process.env.VITE_GOOGLE_SHEETS_API_URL;

// __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health check (Render-friendly)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
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
      body: JSON.stringify(req.body ?? {}),
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();

    // Pass through status code from upstream (often useful for debugging)
    res.status(response.status);

    // Return JSON if upstream is JSON OR if it parses cleanly
    if (contentType.includes("application/json")) {
      try {
        return res.json(JSON.parse(raw));
      } catch {
        // upstream lied about JSON; fall back to text
        return res.type("text/plain").send(raw);
      }
    }

    // Try JSON parse anyway (some apps scripts return JSON without proper header)
    try {
      return res.json(JSON.parse(raw));
    } catch {
      return res.type("text/plain").send(raw);
    }
  } catch (error) {
    console.error("Error proxying request to Google Sheets:", error);
    return res.status(500).json({
      error: error?.message || "Failed to reach Google Sheets",
    });
  }
});

// Serve Vite build output (dist)
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath, { index: false }));

// SPA fallback (only for non-API routes)
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") return next();
  return res.sendFile(path.join(distPath, "index.html"));
});

// Start server (Render requires listening on process.env.PORT)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📊 Google Sheets API configured: ${GOOGLE_SHEETS_API_URL ? "Yes" : "No"}`
  );
});
