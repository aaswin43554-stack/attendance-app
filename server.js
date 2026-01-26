import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

// Only load .env locally (Render uses Environment Variables, no .env file)
if (process.env.NODE_ENV !== "production") {
  const dotenv = await import("dotenv");
  dotenv.default.config();
}

const app = express();
const PORT = process.env.PORT || 10000;

// Support both names (recommended: set GOOGLE_SHEETS_API_URL in Render)
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

// Proxy endpoint
app.post("/api/sheets", async (req, res) => {
  try {
    if (!GOOGLE_SHEETS_API_URL) {
      return res.status(500).json({
        error: "Google Sheets URL not configured (set GOOGLE_SHEETS_API_URL)",
      });
    }

    const response = await fetch(GOOGLE_SHEETS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();

    // Return JSON if possible, else return text
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

// ✅ Serve Vite build
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// ✅ SPA fallback (NO app.get("*") or "/*")
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") return next();
  return res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📊 Google Sheets API configured: ${GOOGLE_SHEETS_API_URL ? "Yes" : "No"}`
  );
});
