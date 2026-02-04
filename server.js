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
 * ✅ NEW: Monthly attendance summary for Employee Dashboard
 * GET /api/attendance/summary?employeeId=EMP001&month=2&year=2026
 *
 * This endpoint calls the existing Google Sheets proxy URL (same backend target),
 * then calculates present/absent counts for the given employee + month.
 */
app.get("/api/attendance/summary", async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;

    if (!employeeId || !month || !year) {
      return res.status(400).json({
        error: "employeeId, month, year required",
      });
    }

    if (!GOOGLE_SHEETS_API_URL) {
      return res.status(500).json({
        error:
          "Google Sheets URL not configured. Set GOOGLE_SHEETS_API_URL in Render Environment Variables.",
      });
    }

    // build date range
    const m = String(month).padStart(2, "0");
    const startDate = `${year}-${m}-01`;
    const endDateObj = new Date(Number(year), Number(month), 0); // last day of month
    const endDate = endDateObj.toISOString().slice(0, 10);

    /**
     * ✅ IMPORTANT:
     * I don't know your exact Google Sheets payload format.
     * So we do 2 things:
     * 1) We call the Sheets API with the same body pattern you already use.
     * 2) We try to extract rows in a flexible "AUTO" way.
     *
     * If you share your dashboard fetch body (or response sample),
     * I will make it 100% exact.
     */

    // ---- Call the Google Sheets API (via URL) directly here ----
    // You can adjust this "body" to match your existing client usage.
    const proxyResponse = await fetch(GOOGLE_SHEETS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // You might already send something like { action: "getAttendance" } from frontend.
        // Keep it generic for now:
        action: "getAttendance",
      }),
    });

    const text = await proxyResponse.text();
    let sheetJson;
    try {
      sheetJson = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error:
          "Sheets API did not return JSON. Please check GOOGLE_SHEETS_API_URL response.",
        raw: text,
      });
    }

    // ---- Extract rows flexibly ----
    // Common possibilities:
    // 1) { data: [...] }
    // 2) { values: [...] }
    // 3) array directly [...]
    const rows =
      (Array.isArray(sheetJson) && sheetJson) ||
      sheetJson.data ||
      sheetJson.values ||
      sheetJson.rows ||
      [];

    if (!Array.isArray(rows)) {
      return res.status(500).json({
        error: "Unexpected Sheets response format (rows not array).",
        sample: sheetJson,
      });
    }

    // ---- Normalize + filter rows ----
    // We assume each row has: employeeId, date, status
    // But keys might be different. We'll try multiple key names.
    const pick = (obj, keys) => {
      for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
      }
      return undefined;
    };

    const filtered = rows
      .map((r) => {
        // If r is array, we can't map without header info.
        // We'll handle only object rows here.
        if (Array.isArray(r)) return null;

        const emp = pick(r, ["employee_id", "employeeId", "empId", "id"]);
        const date = pick(r, ["date", "Date", "attendance_date"]);
        const status = pick(r, ["status", "Status", "attendance", "present"]);

        return { emp, date, status };
      })
      .filter(Boolean)
      .filter((r) => String(r.emp) === String(employeeId))
      .filter((r) => r.date >= startDate && r.date <= endDate);

    // ---- Count ----
    const presentDays = filtered.filter((r) =>
      String(r.status).toLowerCase().includes("present")
    ).length;

    const absentDays = filtered.filter((r) =>
      String(r.status).toLowerCase().includes("absent")
    ).length;

    return res.json({
      employeeId,
      month: Number(month),
      year: Number(year),
      presentDays,
      absentDays,
      totalMarkedDays: filtered.length,
      range: { startDate, endDate },
      note:
        "If counts are 0, share the Sheets response sample so I can map correct keys.",
    });
  } catch (error) {
    console.error("Error generating attendance summary:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate summary",
    });
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