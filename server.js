import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// NOTE: This is a server-side env var; keeping your name as-is,
// but in production it's better to use GOOGLE_SHEETS_API_URL (no VITE_)
const GOOGLE_SHEETS_API_URL = process.env.VITE_GOOGLE_SHEETS_API_URL;

// Middleware
app.use(cors());
app.use(express.json());

// Health check (put before SPA catch-all)
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
      return res.status(500).json({ error: "Google Sheets URL not configured" });
    }

    const response = await fetch(GOOGLE_SHEETS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Google Sheets API returned ${response.status} ${text}`);
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Error proxying request to Google Sheets:", error);
    return res.status(500).json({
      error: error?.message || "Failed to reach Google Sheets",
    });
  }
});

// Serve static files from the Vite build output
app.use(express.static(path.join(__dirname, "dist")));

/**
 * SPA catch-all
 * Express v5 does NOT accept "/*" wildcard patterns.
 * Use the named splat: "/{*splat}"
 * Also avoid capturing /api routes.
 */
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(
    `📊 Google Sheets API configured: ${GOOGLE_SHEETS_API_URL ? "Yes" : "No"}`
  );
});