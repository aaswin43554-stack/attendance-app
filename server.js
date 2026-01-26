import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_SHEETS_API_URL = process.env.VITE_GOOGLE_SHEETS_API_URL;

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
        error: "Google Sheets URL not configured",
      });
    }

    // Forward the request to Google Apps Script
    const response = await fetch(GOOGLE_SHEETS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error proxying request to Google Sheets:", error);
    res.status(500).json({
      error: error.message || "Failed to reach Google Sheets",
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Google Sheets API configured: ${GOOGLE_SHEETS_API_URL ? "Yes" : "No"}`);
});
