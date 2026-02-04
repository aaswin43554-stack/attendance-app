import React, { useEffect, useMemo, useState } from "react";
import { getSession } from "./services/storage";
function getMonthOptions() {
  return [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
}

export default function EmployeeDashboard() {
  const session = getSession();

  // 🔁 change this based on how you store employee id in session
  const employeeId =
    session?.employeeId || session?.id || session?.userId || session?.email;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const monthNames = useMemo(() => getMonthOptions(), []);

  useEffect(() => {
    if (!employeeId) {
      setError("Employee id not found in session.");
      return;
    }

    async function loadSummary() {
      try {
        setLoading(true);
        setError("");

        // If you deploy in Render, this relative URL is perfect:
        const res = await fetch(
          `/api/attendance/summary?employeeId=${encodeURIComponent(
            employeeId
          )}&month=${month}&year=${year}`
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load summary");

        setSummary(data);
      } catch (e) {
        setError(e.message);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [employeeId, month, year]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>Employee Dashboard</h2>

      {/* Month filter */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label>
          Month:&nbsp;
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {monthNames.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Year:&nbsp;
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ width: 90 }}
          />
        </label>
      </div>

      {/* Summary cards */}
      {loading && <div>Loading attendance summary...</div>}
      {error && (
        <div style={{ color: "crimson", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {summary && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Card title="Present Days" value={summary.presentDays} />
          <Card title="Absent Days" value={summary.absentDays} />
          <Card title="Total Marked Days" value={summary.totalMarkedDays} />
        </div>
      )}

      {/* your existing dashboard content can stay below */}
      <div style={{ marginTop: 24 }}>
        {/* Existing content here */}
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 16,
        minWidth: 180,
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: 13, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
        {value ?? 0}
      </div>
    </div>
  );
}