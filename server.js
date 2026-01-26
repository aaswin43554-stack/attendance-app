import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// IMPORTANT:
// Your frontend uses VITE_GOOGLE_SHEETS_API_URL in Vite,
// but on the server you should ideally use a server env like GOOGLE_SHEETS_API_URL.
// We'll support BOTH so it works either way.
const GOOGLE_SHEETS_API_URL =
  process.env.GOOGLE_SHEETS_API_URL || process.env.VITE_GOOGLE_SHEETS_API_URL;

// For __dirname in ES Modules
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
 * Forwards requests to Google Apps Script without CORS issues
 */
app.post("/api/sheets", async (req, res) => {
  try {
    if (!GOOGLE_SHEETS_API_URL) {
      return res.status(500).json({
        error:
          "Google Sheets URL not configured. Set GOOGLE_SHEETS_API_URL (recommended) or VITE_GOOGLE_SHEETS_API_URL in Render env vars.",
      });
    }

    const response = await fetch(GOOGLE_SHEETS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Google Sheets API returned ${response.status}${
          text ? ` - ${text}` : ""
        }`
      );
    }

    // Some Apps Script responses might not be JSON if misconfigured.
    // Try JSON first, fallback to text.
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    } else {
      const data = await response.text();
      return res.send(data);
    }
  } catch (error) {
    console.error("Error proxying request to Google Sheets:", error);
    res.status(500).json({
      error: error.message || "Failed to reach Google Sheets",
    });
  }
});

/**
 * Serve the Vite build (frontend)
 * This fixes: "Cannot GET /"
 */
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback (must be AFTER API routes)
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Start server (MUST listen on process.env.PORT for Render)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📊 Google Sheets API configured: ${GOOGLE_SHEETS_API_URL ? "Yes" : "No"}`
  );
});
