import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Toast from "../../ui/Toast";
import { getSession } from "../../services/storage";
import { createAttendance } from "../../services/attendance";
import { getUserAttendanceRecords } from "../../services/supabase";
import { logout } from "../../services/auth";
import LocationMap from "../../ui/LocationMap";
import { formatBangkokTime } from "../../utils/date";

/* -------------------- helpers for monthly summary -------------------- */
function ymdFromISO(iso) {
  return String(iso).slice(0, 10); // "YYYY-MM-DD"
}

function getWorkingDaysInMonth(year, month) {
  // month: 1-12, exclude Sundays (0)
  const daysInMonth = new Date(year, month, 0).getDate();
  let working = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0) working++;
  }
  return working;
}

function buildMonthlySummary(records, year, month) {
  // present = unique dates with checkin
  const presentSet = new Set();

  for (const r of records || []) {
    if (!r?.time) continue;

    const dt = new Date(r.time);
    if (Number.isNaN(dt.getTime())) continue;

    if (dt.getFullYear() !== year) continue;
    if (dt.getMonth() + 1 !== month) continue;

    if (r.type === "checkin") {
      presentSet.add(ymdFromISO(r.time));
    }
  }

  const presentDays = presentSet.size;
  const totalWorkingDays = getWorkingDaysInMonth(year, month);
  const absentDays = Math.max(totalWorkingDays - presentDays, 0);

  return { presentDays, absentDays, totalWorkingDays };
}

function MonthYearPicker({ month, year, setMonth, setYear }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select
        className="btn btnGhost small"
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
      >
        <option value={1}>Jan</option>
        <option value={2}>Feb</option>
        <option value={3}>Mar</option>
        <option value={4}>Apr</option>
        <option value={5}>May</option>
        <option value={6}>Jun</option>
        <option value={7}>Jul</option>
        <option value={8}>Aug</option>
        <option value={9}>Sep</option>
        <option value={10}>Oct</option>
        <option value={11}>Nov</option>
        <option value={12}>Dec</option>
      </select>

      <input
        className="btn btnGhost small"
        style={{ width: 90 }}
        type="number"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
      />
    </div>
  );
}
/* ------------------------------------------------------------------- */

export default function EmployeeDashboard() {
  const nav = useNavigate();
  const session = getSession();

  // userId is the email
  const me = useMemo(() => {
    if (!session.userId) return null;
    return {
      id: session.userId,
      email: session.userId,
      name: session.userName || "Employee",
    };
  }, [session.userId, session.userName]);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [year, setYear] = useState(now.getFullYear());

  const [toast, setToast] = useState("");
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState({ status: "Not working", latest: null });
  const [busy, setBusy] = useState(false);
  const [showMaps, setShowMaps] = useState({}); // track which logs have map visible

  const [summary, setSummary] = useState({
    presentDays: 0,
    absentDays: 0,
    totalWorkingDays: 0,
  });

  const refresh = async () => {
    if (!me) return;
    try {
      // IMPORTANT: your function currently uses me.name
      const records = await getUserAttendanceRecords(me.id); // email
      // monthly summary computed from ALL records
      setSummary(buildMonthlySummary(records, year, month));

      // show only recent logs in UI
      setLogs((records || []).slice(0, 10));

      const latest = records?.[0];
      if (!latest) {
        setStatus({ status: "Not working", latest: null });
      } else {
        setStatus({
          status: latest.type === "checkin" ? "Working" : "Not working",
          latest,
        });
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, month, year]);

  const doAction = async (type) => {
    if (!me) return;
    setBusy(true);
    try {
      console.log("🔄 Starting", type, "for user:", me.name);
      await createAttendance({ userId: me.id, type, userName: me.name });
      console.log("✅", type, "successful");
      setToast(type === "checkin" ? "Checked in." : "Checked out.");
      await refresh();
    } catch (error) {
      console.error("❌ Error during", type, ":", error.message);
      console.error("Full error:", error);
      setToast(
        "❌ " + (error.message || "Location permission needed (use HTTPS or localhost).")
      );
    } finally {
      setBusy(false);
      setTimeout(() => setToast(""), 2200);
    }
  };

  const onLogout = () => {
    logout();
    nav("/login");
  };

  return (
    <main className="page">
      <section className="grid">
        <Card
          title={`Hello, ${me?.name || "Employee"}`}
          subtitle={me ? `${me.email}` : ""}
          right={
            <span className="pill" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span
                className="dot"
                style={{
                  background:
                    status.status === "Working" ? "var(--ok)" : "#cbd5e1",
                }}
              />
              <span>{status.status}</span>

              <button className="btn btnGhost small" onClick={onLogout}>
                Logout
              </button>
            </span>
          }
        >
          {/* ✅ Monthly summary section */}
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span className="pill">
                <b>Present:</b>&nbsp;{summary.presentDays}
              </span>
              <span className="pill">
                <b>Absent:</b>&nbsp;{summary.absentDays}
              </span>
              <span className="pill">
                <b>Working Days:</b>&nbsp;{summary.totalWorkingDays}
              </span>
            </div>

            <MonthYearPicker
              month={month}
              year={year}
              setMonth={setMonth}
              setYear={setYear}
            />
          </div>

          <div className="row">
            <button
              className="btn btnOk"
              disabled={busy}
              onClick={() => doAction("checkin")}
            >
              Check-in
            </button>
            <button
              className="btn btnDanger"
              disabled={busy}
              onClick={() => doAction("checkout")}
            >
              Check-out
            </button>
          </div>

          <div className="hr" />

          <h3 className="title" style={{ fontSize: 15, margin: "0 0 10px 0" }}>
            Recent Logs
          </h3>

          <div className="list">
            {logs.length === 0 ? (
              <div className="muted small">No logs yet. Press Check-in.</div>
            ) : (
              logs.map((r) => (
                <div className="item" key={r.id} style={{ cursor: "default" }}>
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {r.type === "checkin" ? "Check-in" : "Check-out"}{" "}
                        <span className="muted2" style={{ fontWeight: 700 }}>
                          • {formatBangkokTime(r.time)}
                        </span>
                      </div>

                      {showMaps[r.id] ? (
                        <LocationMap
                          lat={parseFloat(r.lat)}
                          lng={parseFloat(r.lng)}
                          address={r.address}
                          height="180px"
                        />
                      ) : (
                        <div className="mt10">
                          <button
                            className="btn btnGhost small"
                            onClick={() =>
                              setShowMaps((p) => ({ ...p, [r.id]: true }))
                            }
                          >
                            Show Map
                          </button>
                        </div>
                      )}
                      <div className="muted small" style={{ marginTop: 8 }}>
                        {r.address || "(address unavailable)"}
                      </div>
                    </div>
                    <div className="muted2 small" style={{ textAlign: "right" }}>
                      <div className="mono">{r.device?.platform || ""}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="Tip" subtitle="Use mobile GPS for best location accuracy.">
          <div className="muted small">
            If permission is blocked, check-in/out will fail.
          </div>
        </Card>
      </section>

      <Toast message={toast} />
    </main>
  );
}