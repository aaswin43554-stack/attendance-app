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
const GOOGLE_SHEETS_API_URL = process.env.VITE_GOOGLE_SHEETS_API_URL;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the Vite build output
app.use(express.static(path.join(__dirname, "dist")));

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
        error: "Google Sheets URL not configured",
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
          text ? `: ${text.slice(0, 300)}` : ""
        }`
      );
    }

    // Apps Script sometimes returns non-json; handle safely
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (error) {
    console.error("Error proxying request to Google Sheets:", error);
    res.status(500).json({
      error: error?.message || "Failed to reach Google Sheets",
    });
  }
});

// SPA fallback (Express 5 safe): serve index.html for non-API, non-health GET routes
app.get(/^(?!\/api)(?!\/health).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(
    `📊 Google Sheets API configured: ${GOOGLE_SHEETS_API_URL ? "Yes" : "No"}`
  );
});