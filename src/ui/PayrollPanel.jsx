import React, { useState, useMemo, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { parseISO, getBangkokYMD, getBangkokTimeParts } from "../utils/date";
import {
  empKey,
  getPayrollRates,
  savePayrollRates,
  getPayrollConfig,
  savePayrollConfig,
} from "../services/payroll";
import "./PayrollPanel.css";

const fmt = (n) =>
  "$" + Number(n).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Count Mon–Fri days in a given month (0-indexed). */
function countWorkingDays(year, month) {
  const total = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// localStorage cache helpers (fallback when Supabase is unavailable)
function cacheGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function cacheSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export default function PayrollPanel({ employees, allRecords, workSettings }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // ── Remote state ─────────────────────────────────────────────────────────
  const [rates, setRates] = useState(() => cacheGet("payroll_rates_v2", {}));
  const [deductions, setDeductions] = useState(() =>
    cacheGet("payroll_deductions_v2", { lateLogin: 0, earlyLogout: 0 })
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState("loading"); // "loading" | "ok" | "error"
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tempRates, setTempRates] = useState({});
  const [tempDed, setTempDed] = useState({ lateLogin: 0, earlyLogout: 0 });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long" });

  // ── Load from Supabase on mount ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoadStatus("loading");
    try {
      const [fetchedRates, fetchedConfig] = await Promise.all([
        getPayrollRates(),
        getPayrollConfig(),
      ]);
      setRates(fetchedRates);
      setDeductions(fetchedConfig);
      cacheSet("payroll_rates_v2", fetchedRates);
      cacheSet("payroll_deductions_v2", fetchedConfig);
      setLoadStatus("ok");
    } catch (err) {
      console.error("Payroll load error:", err);
      // Stay on cached data; surface a warning
      setLoadStatus(err.message?.includes("does not exist") ? "setup" : "error");
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Open editor: pre-populate from current rates ──────────────────────────
  const openEditor = () => {
    const tr = {};
    employees.forEach((emp) => {
      const k = empKey(emp);
      tr[k] = rates[k] ? { ...rates[k] } : { rate: "", type: "hourly" };
    });
    setTempRates(tr);
    setTempDed({ ...deductions });
    setShowEditor(true);
  };

  // ── Save: write to Supabase then update local state ───────────────────────
  const saveEditor = async () => {
    setSaving(true);
    try {
      await Promise.all([
        savePayrollRates(employees, tempRates),
        savePayrollConfig(
          parseFloat(tempDed.lateLogin) || 0,
          parseFloat(tempDed.earlyLogout) || 0,
        ),
      ]);

      // Normalise types after save
      const cleaned = {};
      employees.forEach((emp) => {
        const k = empKey(emp);
        if (tempRates[k]) {
          cleaned[k] = { rate: parseFloat(tempRates[k].rate) || 0, type: tempRates[k].type };
        }
      });
      const cleanDed = {
        lateLogin: parseFloat(tempDed.lateLogin) || 0,
        earlyLogout: parseFloat(tempDed.earlyLogout) || 0,
      };

      setRates(cleaned);
      setDeductions(cleanDed);
      cacheSet("payroll_rates_v2", cleaned);
      cacheSet("payroll_deductions_v2", cleanDed);

      toast.success("Payroll rates saved to database");
      setShowEditor(false);
    } catch (err) {
      console.error("Payroll save error:", err);
      toast.error("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Payroll calculation (derived from attendance records) ─────────────────
  const payrollData = useMemo(() => {
    return employees.map((emp) => {
      const key = empKey(emp);

      const empRecords = allRecords
        .filter((r) => {
          if (r.userName !== emp.name) return false;
          const ymd = getBangkokYMD(parseISO(r.time));
          const [ry, rm] = ymd.split("-").map(Number);
          return ry === year && rm - 1 === month;
        })
        .sort((a, b) => parseISO(a.time) - parseISO(b.time));

      const config =
        workSettings?.[emp.name] ||
        workSettings?.["default"] ||
        { start: "10:00", end: "18:00" };
      const [limitStartH, limitStartM] = config.start.split(":").map(Number);
      const [limitEndH, limitEndM] = config.end.split(":").map(Number);

      let totalMs = 0;
      let activeStart = null;
      let lateCount = 0;
      let earlyCount = 0;
      const presentDays = new Set();

      empRecords.forEach((r) => {
        const d = parseISO(r.time);
        if (r.type === "checkin") {
          presentDays.add(getBangkokYMD(d));
          activeStart = d;
          const { hours, minutes } = getBangkokTimeParts(d);
          if (hours > limitStartH || (hours === limitStartH && minutes > limitStartM))
            lateCount++;
        } else if (r.type === "checkout" && activeStart) {
          totalMs += d - activeStart;
          activeStart = null;
          const { hours, minutes } = getBangkokTimeParts(d);
          if (hours < limitEndH || (hours === limitEndH && minutes < limitEndM))
            earlyCount++;
        }
      });

      const totalHours = totalMs / 3600000;
      const daysPresent = presentDays.size;
      const empRate = rates[key] || { rate: 0, type: "hourly" };

      const workingDaysInMonth = countWorkingDays(year, month);

      let grossPay = 0;
      if (empRate.type === "hourly") {
        grossPay = totalHours * empRate.rate;
      } else if (empRate.type === "daily") {
        grossPay = daysPresent * empRate.rate;
      } else {
        // Pro-rated monthly: pay only for days actually worked
        grossPay = workingDaysInMonth > 0
          ? (daysPresent / workingDaysInMonth) * empRate.rate
          : 0;
      }

      const deductionAmt =
        lateCount * (deductions.lateLogin || 0) +
        earlyCount * (deductions.earlyLogout || 0);
      const netPay = Math.max(0, grossPay - deductionAmt);

      return { emp, key, daysPresent, totalHours, rateType: empRate.type, rate: empRate.rate, grossPay, deductionAmt, netPay, lateCount, earlyCount, workingDaysInMonth };
    });
  }, [employees, allRecords, year, month, rates, deductions, workSettings]);

  const totalGross = payrollData.reduce((s, r) => s + r.grossPay, 0);
  const totalDed   = payrollData.reduce((s, r) => s + r.deductionAmt, 0);
  const totalNet   = payrollData.reduce((s, r) => s + r.netPay, 0);

  // ── Excel Export ──────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // ── Sheet 1: Payroll Summary ──────────────────────────────────────────
    const summaryRows = [
      ["TronX Labs — Payroll Report"],
      [`Period: ${monthName} ${year}`],
      [`Generated: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} (Bangkok)`],
      [],
      ["Employee", "Email", "Role", "Days Present", "Working Days", "Total Hours",
       "Rate Type", "Rate ($)", "Gross Pay ($)", "Deductions ($)", "Net Pay ($)",
       "Late Logins", "Early Logouts"],
      ...payrollData.map((r) => [
        r.emp.name,
        r.emp.email,
        r.emp.role || "—",
        r.daysPresent,
        r.rateType === "monthly" ? r.workingDaysInMonth : "—",
        parseFloat(r.totalHours.toFixed(2)),
        r.rateType.charAt(0).toUpperCase() + r.rateType.slice(1),
        r.rate,
        parseFloat(r.grossPay.toFixed(2)),
        parseFloat(r.deductionAmt.toFixed(2)),
        parseFloat(r.netPay.toFixed(2)),
        r.lateCount,
        r.earlyCount,
      ]),
      [],
      ["", "", "", "", "", "", "", "TOTALS →",
       parseFloat(totalGross.toFixed(2)),
       parseFloat(totalDed.toFixed(2)),
       parseFloat(totalNet.toFixed(2)),
      ],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1["!cols"] = [
      { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 13 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Payroll Summary");

    // ── Per-employee daily detail sheets ──────────────────────────────────
    payrollData.forEach(({ emp, daysPresent, totalHours, rateType, rate, grossPay, deductionAmt, netPay, lateCount, earlyCount, workingDaysInMonth }) => {
      const config = workSettings?.[emp.name] || workSettings?.["default"] || { start: "10:00", end: "18:00" };
      const [limitStartH, limitStartM] = config.start.split(":").map(Number);
      const [limitEndH, limitEndM] = config.end.split(":").map(Number);

      // Filter & sort this employee's records for the selected month
      const empRecords = allRecords
        .filter((r) => {
          if (r.userName !== emp.name) return false;
          const ymd = getBangkokYMD(parseISO(r.time));
          const [ry, rm] = ymd.split("-").map(Number);
          return ry === year && rm - 1 === month;
        })
        .sort((a, b) => parseISO(a.time) - parseISO(b.time));

      // Group by Bangkok date → first checkin, last checkout
      const dayMap = {};
      empRecords.forEach((r) => {
        const d = parseISO(r.time);
        const ymd = getBangkokYMD(d);
        if (!dayMap[ymd]) dayMap[ymd] = { checkin: null, checkout: null };
        if (r.type === "checkin" && !dayMap[ymd].checkin) dayMap[ymd].checkin = d;
        if (r.type === "checkout") dayMap[ymd].checkout = d;
      });

      // Build sheet rows
      const rateLabel = rate > 0
        ? `$${Number(rate).toLocaleString()} / ${rateType}`
        : "Not set";
      const empRows = [
        [`Employee: ${emp.name}`],
        [`Email: ${emp.email || "—"}`],
        [`Role: ${emp.role || "—"}`],
        [`Period: ${monthName} ${year}`],
        [`Rate: ${rateLabel}${rateType === "monthly" ? ` (pro-rated: ${daysPresent}/${workingDaysInMonth} working days)` : ""}`],
        [`Scheduled Hours: ${config.start} – ${config.end} (Bangkok)`],
        [],
        ["Date", "Day", "Check-in", "Check-out", "Hours Worked", "Late Login?", "Early Logout?", "Status"],
      ];

      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, month, d).getDay();
        const dayName = DAY_NAMES[dow];
        const isWeekend = dow === 0 || dow === 6;
        const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const rec = dayMap[ymd];

        let checkinStr = "—";
        let checkoutStr = "—";
        let hoursWorked = "—";
        let lateFlag = "—";
        let earlyFlag = "—";
        let status = isWeekend ? "Weekend" : "Absent";

        if (rec?.checkin) {
          const { hours, minutes } = getBangkokTimeParts(rec.checkin);
          checkinStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
          lateFlag = (hours > limitStartH || (hours === limitStartH && minutes > limitStartM)) ? "Yes" : "No";
          status = "Present";
        }
        if (rec?.checkout) {
          const { hours, minutes } = getBangkokTimeParts(rec.checkout);
          checkoutStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
          earlyFlag = (hours < limitEndH || (hours === limitEndH && minutes < limitEndM)) ? "Yes" : "No";
        }
        if (rec?.checkin && rec?.checkout) {
          const ms = rec.checkout - rec.checkin;
          hoursWorked = parseFloat((ms / 3600000).toFixed(2));
          status = "Present";
        } else if (rec?.checkin && !rec?.checkout) {
          status = "Present (no checkout)";
        }

        empRows.push([ymd, dayName, checkinStr, checkoutStr, hoursWorked, lateFlag, earlyFlag, status]);
      }

      empRows.push([]);
      empRows.push(["TOTALS", "", "", "",
        parseFloat(totalHours.toFixed(2)),
        `${lateCount} late login(s)`,
        `${earlyCount} early logout(s)`,
        `${daysPresent} day(s) present`,
      ]);
      empRows.push([]);
      empRows.push(["Gross Pay ($)", parseFloat(grossPay.toFixed(2))]);
      empRows.push(["Total Deductions ($)", `-${parseFloat(deductionAmt.toFixed(2))}`]);
      empRows.push(["Net Pay ($)", parseFloat(netPay.toFixed(2))]);

      const wsEmp = XLSX.utils.aoa_to_sheet(empRows);
      wsEmp["!cols"] = [
        { wch: 13 }, { wch: 7 }, { wch: 11 }, { wch: 12 },
        { wch: 14 }, { wch: 13 }, { wch: 15 }, { wch: 24 },
      ];

      // Sheet name: max 31 chars, strip Excel-invalid characters
      const sheetName = emp.name.replace(/[:\\/?\*\[\]]/g, "").substring(0, 31);
      XLSX.utils.book_append_sheet(wb, wsEmp, sheetName);
    });

    // ── Sheet: Deduction Settings ─────────────────────────────────────────
    const dedRows = [
      ["Deduction Settings"],
      [],
      ["Type", "Amount ($)"],
      ["Late Login deduction", deductions.lateLogin],
      ["Early Logout deduction", deductions.earlyLogout],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(dedRows);
    ws2["!cols"] = [{ wch: 24 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Deduction Settings");

    // ── Sheet: Pay Rates ──────────────────────────────────────────────────
    const rateRows = [
      ["Employee Pay Rates"],
      [],
      ["Employee", "Email", "Rate Type", "Rate ($)"],
      ...payrollData.map((r) => [
        r.emp.name,
        r.emp.email,
        r.rateType.charAt(0).toUpperCase() + r.rateType.slice(1),
        r.rate,
      ]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(rateRows);
    ws3["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Pay Rates");

    XLSX.writeFile(wb, `payroll_${year}_${String(month + 1).padStart(2, "0")}_${monthName}.xlsx`);
  };

  const noRatesSet = Object.keys(rates).length === 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="pr-container">

      {/* ── Header ── */}
      <div className="pr-header">
        <div className="pr-title-group">
          <h3 className="pr-title">Payroll</h3>
        </div>
        <div className="pr-controls">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="btn-nav">←</button>
          <span className="month-label">{monthName} {year}</span>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="btn-nav">→</button>
          <button onClick={openEditor} className="btn btnGhost pr-btn" disabled={loadStatus === "loading"}>
            ⚙ Rates & Deductions
          </button>
          <button onClick={exportExcel} className="btn btnPrimary pr-btn">↓ Export Excel</button>
          <button onClick={loadData} className="btn btnGhost pr-btn pr-refresh" title="Refresh from database">↻</button>
        </div>
      </div>

      {/* ── Status banners ── */}
      {loadStatus === "loading" && (
        <div className="pr-banner pr-banner-info">
          <span className="pr-spinner" /> Loading payroll data from database…
        </div>
      )}
      {loadStatus === "error" && (
        <div className="pr-banner pr-banner-warn">
          ⚠ Could not reach database — showing cached data. <button className="pr-link" onClick={loadData}>Retry</button>
        </div>
      )}
      {loadStatus === "setup" && (
        <div className="pr-banner pr-banner-warn">
          ⚠ Payroll tables not found in Supabase. Run the SQL setup below, then <button className="pr-link" onClick={loadData}>retry</button>.
          <details className="pr-sql-details">
            <summary>Show setup SQL</summary>
            <pre className="pr-sql">{SETUP_SQL}</pre>
          </details>
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="pr-summary">
        <div className="pr-stat">
          <span className="pr-stat-label">Gross Payroll</span>
          <span className="pr-stat-value">{fmt(totalGross)}</span>
        </div>
        <div className="pr-stat pr-stat-danger">
          <span className="pr-stat-label">Total Deductions</span>
          <span className="pr-stat-value">-{fmt(totalDed)}</span>
        </div>
        <div className="pr-stat pr-stat-ok">
          <span className="pr-stat-label">Net Payroll</span>
          <span className="pr-stat-value">{fmt(totalNet)}</span>
        </div>
        <div className="pr-stat">
          <span className="pr-stat-label">Employees</span>
          <span className="pr-stat-value">{employees.length}</span>
        </div>
      </div>

      {/* ── Deduction settings badge ── */}
      {(deductions.lateLogin > 0 || deductions.earlyLogout > 0) && (
        <div className="pr-ded-badge">
          Deductions active — Late login: <strong>${deductions.lateLogin}/occurrence</strong>
          {" · "}Early logout: <strong>${deductions.earlyLogout}/occurrence</strong>
        </div>
      )}

      {/* ── Rate & Deduction Editor ── */}
      {showEditor && (
        <div className="pr-editor">
          <h4 className="pr-editor-title">Pay Rates & Deductions</h4>

          <div className="pr-deduction-grid">
            <div>
              <label>Late login deduction ($ per occurrence)</label>
              <input type="number" min="0" step="0.01"
                value={tempDed.lateLogin}
                onChange={(e) => setTempDed((p) => ({ ...p, lateLogin: e.target.value }))}
              />
            </div>
            <div>
              <label>Early logout deduction ($ per occurrence)</label>
              <input type="number" min="0" step="0.01"
                value={tempDed.earlyLogout}
                onChange={(e) => setTempDed((p) => ({ ...p, earlyLogout: e.target.value }))}
              />
            </div>
          </div>

          <div className="pr-rate-scroll">
            <table className="pr-rate-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Pay Type</th>
                  <th>Rate ($)</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const k = empKey(emp);
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="pr-rate-name">{emp.name}</div>
                        <div className="pr-rate-email">{emp.email}</div>
                      </td>
                      <td>
                        <select className="pr-type-select"
                          value={tempRates[k]?.type || "hourly"}
                          onChange={(e) =>
                            setTempRates((p) => ({ ...p, [k]: { ...p[k], type: e.target.value } }))
                          }
                        >
                          <option value="hourly">Hourly ($/hr)</option>
                          <option value="daily">Daily ($/day)</option>
                          <option value="monthly">Monthly ($/month)</option>
                        </select>
                      </td>
                      <td>
                        <input type="number" min="0" step="0.01" className="pr-rate-input"
                          placeholder="e.g. 25.00"
                          value={tempRates[k]?.rate ?? ""}
                          onChange={(e) =>
                            setTempRates((p) => ({ ...p, [k]: { ...p[k], rate: e.target.value } }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pr-editor-actions">
            <button className="btn btnPrimary" onClick={saveEditor} disabled={saving}>
              {saving ? "Saving…" : "Save to Database"}
            </button>
            <button className="btn btnGhost" onClick={() => setShowEditor(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Empty hint ── */}
      {noRatesSet && !showEditor && loadStatus !== "loading" && (
        <div className="pr-hint">
          No pay rates configured yet. Click <strong>⚙ Rates & Deductions</strong> to set rates — they'll be saved to Supabase and shared across all admin sessions.
        </div>
      )}

      {/* ── Payroll Table ── */}
      <div className="pr-table-wrap">
        <table className="pr-table">
          <thead>
            <tr>
              <th className="col-name">Employee</th>
              <th className="col-num">Days</th>
              <th className="col-num">Hours</th>
              <th className="col-rate">Rate</th>
              <th className="col-money">Gross</th>
              <th className="col-money">Deductions</th>
              <th className="col-money">Net Pay</th>
              <th className="col-flags">Flags</th>
            </tr>
          </thead>
          <tbody>
            {loadStatus === "loading" ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="pr-skeleton-row">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="pr-skeleton" /></td>
                  ))}
                </tr>
              ))
            ) : payrollData.length === 0 ? (
              <tr>
                <td colSpan="8" className="pr-empty">No employee data for this month.</td>
              </tr>
            ) : (
              payrollData.map((row) => (
                <tr key={row.emp.id} className={row.daysPresent === 0 ? "pr-row-absent" : ""}>
                  <td className="col-name">
                    <div className="pr-emp-name">{row.emp.name}</div>
                    <div className="pr-emp-email">{row.emp.email}</div>
                  </td>
                  <td className="col-num">{row.daysPresent}</td>
                  <td className="col-num">{row.totalHours.toFixed(1)}h</td>
                  <td className="col-rate">
                    {row.rate === 0
                      ? <span className="pr-badge pr-badge-unset">Not set</span>
                      : row.rateType === "monthly"
                        ? <span className="pr-badge pr-badge-rate" title={`Pro-rated: ${row.daysPresent} of ${row.workingDaysInMonth} working days`}>
                            ${Number(row.rate).toLocaleString()}/mo
                            <span className="pr-prorated">
                              {row.daysPresent}/{row.workingDaysInMonth} days
                            </span>
                          </span>
                        : <span className="pr-badge pr-badge-rate">
                            ${Number(row.rate).toLocaleString()}/{row.rateType === "hourly" ? "hr" : "day"}
                          </span>
                    }
                  </td>
                  <td className="col-money">{fmt(row.grossPay)}</td>
                  <td className="col-money pr-ded">
                    {row.deductionAmt > 0 ? `-${fmt(row.deductionAmt)}` : <span className="muted2">—</span>}
                  </td>
                  <td className="col-money pr-net">{fmt(row.netPay)}</td>
                  <td className="col-flags">
                    {row.lateCount > 0 && <span className="pr-flag pr-flag-late">{row.lateCount} late</span>}
                    {row.earlyCount > 0 && <span className="pr-flag pr-flag-early">{row.earlyCount} early out</span>}
                    {row.lateCount === 0 && row.earlyCount === 0 && row.daysPresent > 0 && (
                      <span className="pr-flag pr-flag-ok">✓ On time</span>
                    )}
                    {row.daysPresent === 0 && <span className="pr-flag pr-flag-absent">No attendance</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {loadStatus !== "loading" && (
            <tfoot>
              <tr className="pr-tfoot">
                <td colSpan="4"><strong>Total — {payrollData.length} employee{payrollData.length !== 1 ? "s" : ""}</strong></td>
                <td className="col-money"><strong>{fmt(totalGross)}</strong></td>
                <td className="col-money pr-ded"><strong>{totalDed > 0 ? `-${fmt(totalDed)}` : "—"}</strong></td>
                <td className="col-money pr-net"><strong>{fmt(totalNet)}</strong></td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// SQL shown to the admin when tables are missing
const SETUP_SQL = `-- Run this once in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS payroll_rates (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_key text        NOT NULL UNIQUE,
  employee_name text       NOT NULL,
  employee_email text,
  rate_type    text        NOT NULL DEFAULT 'hourly'
                           CHECK (rate_type IN ('hourly','daily','monthly')),
  rate         numeric(10,2) NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_config (
  id                    integer PRIMARY KEY DEFAULT 1,
  late_login_deduction  numeric(10,2) NOT NULL DEFAULT 0,
  early_logout_deduction numeric(10,2) NOT NULL DEFAULT 0,
  updated_at            timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO payroll_config (id, late_login_deduction, early_logout_deduction)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;`;
