import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import {
  getAllUsers,
  getAllAttendanceRecords,
  getEmployeeMonthlySummary,
} from "../../services/supabase";
import { logout } from "../../services/auth";
import LocationMap from "../../ui/LocationMap";
import { formatBangkokTime } from "../../utils/date";

export default function AdminDashboard() {
  const nav = useNavigate();

  const [selectedId, setSelectedId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Month/Year filter for summary
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [year, setYear] = useState(now.getFullYear());

  // ✅ Selected employee monthly summary
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [users, records] = await Promise.all([
          getAllUsers(),
          getAllAttendanceRecords(),
        ]);

        const employeesList = (users || [])
          .filter((u) => u.role === "employee")
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setEmployees(employeesList);
        setAllRecords(records || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const selected = employees.find((e) => e.id === selectedId) || null;

  // ✅ Use userId/email to get logs (name duplicates avoid)
  const getUserLogs = (user) => {
    if (!user) return [];
    const email = String(user.email || "").toLowerCase();
    return allRecords
      .filter((r) => String(r.userId || "").toLowerCase() === email)
      .sort((a, b) => new Date(b.time) - new Date(a.time));
  };

  const selectedLogs = selected ? getUserLogs(selected) : [];

  const getLatestStatus = (user) => {
    const logs = getUserLogs(user);
    const latest = logs[0];
    if (!latest) return { status: "Not working", latest: null };
    return {
      status: latest.type === "checkin" ? "Working" : "Not working",
      latest,
    };
  };

  const workingCount = useMemo(() => {
    return employees.filter((u) => getLatestStatus(u).status === "Working")
      .length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, allRecords]);

  const toggleSelect = async (id) => {
    // click again -> minimize
    const nextId = selectedId === id ? null : id;
    setSelectedId(nextId);

    // reset summary panel if minimized
    if (nextId === null) {
      setMonthlySummary(null);
      setSummaryError("");
      return;
    }

    // Load summary for newly selected employee
    const emp = employees.find((e) => e.id === nextId);
    if (!emp) return;

    await loadMonthlySummary(emp.email, year, month);
  };

  const loadMonthlySummary = async (employeeEmail, y, m) => {
    try {
      setSummaryLoading(true);
      setSummaryError("");
      const s = await getEmployeeMonthlySummary(employeeEmail, y, m);
      setMonthlySummary(s);
    } catch (e) {
      console.error(e);
      setMonthlySummary(null);
      setSummaryError(e.message || "Failed to load summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  // when month/year changes and employee selected -> reload summary
  useEffect(() => {
    if (!selected) return;
    loadMonthlySummary(selected.email, year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, selectedId]);

  const onLogout = () => {
    logout();
    nav("/login");
  };

  return (
    <main className="page">
      <section className="single">
        <Card
          title="Admin Dashboard"
          subtitle="Click an employee to view details. Click again to minimize."
          right={
            <div className="row" style={{ alignItems: "center", gap: 10 }}>
              <span className="pill">
                <span className="dot" style={{ background: "var(--ok)" }} />{" "}
                {workingCount} Working
              </span>
              <span className="pill">
                <span className="dot" style={{ background: "#cbd5e1" }} />{" "}
                {employees.length} Total
              </span>

              <button className="btn btnGhost small" onClick={onLogout}>
                Logout
              </button>
            </div>
          }
        >
          <div className="adminGrid">
            {/* LEFT: Employees */}
            <div>
              <h3
                className="title"
                style={{ fontSize: 15, margin: "0 0 10px 0" }}
              >
                Employees
              </h3>

              <div className="list">
                {loading ? (
                  <div className="muted small">Loading employees...</div>
                ) : employees.length === 0 ? (
                  <div className="muted small">No employees yet.</div>
                ) : (
                  employees.map((u) => {
                    const st = getLatestStatus(u);
                    const latestTime = st.latest
                      ? formatBangkokTime(st.latest.time)
                      : "—";
                    const dotColor =
                      st.status === "Working" ? "var(--ok)" : "#cbd5e1";

                    return (
                      <div
                        key={u.id}
                        className={
                          "item " + (selectedId === u.id ? "selected" : "")
                        }
                        onClick={() => toggleSelect(u.id)}
                      >
                        <div
                          className="row"
                          style={{ justifyContent: "space-between" }}
                        >
                          <div>
                            <div style={{ fontWeight: 900 }}>
                              {u.name}{" "}
                              <span
                                className="muted2"
                                style={{ fontWeight: 700 }}
                              >
                                ({u.email})
                              </span>
                            </div>
                            <div className="muted small">Last: {latestTime}</div>
                          </div>
                          <span className="pill">
                            <span
                              className="dot"
                              style={{ background: dotColor }}
                            />
                            <span>{st.status}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT: Details */}
            <div>
              <h3
                className="title"
                style={{ fontSize: 15, margin: "0 0 10px 0" }}
              >
                Details
              </h3>

              {!selected ? (
                <div className="muted small">
                  Select an employee to view present/absent summary, latest
                  location and logs.
                </div>
              ) : (
                <>
                  {/* Header card */}
                  {(() => {
                    const st = getLatestStatus(selected);
                    const latest = st.latest;

                    return (
                      <div className="item" style={{ cursor: "default" }}>
                        <div style={{ fontWeight: 950, fontSize: 16 }}>
                          {selected.name}
                        </div>
                        <div className="muted small">
                          {selected.email}
                          {selected.phone ? " • " + selected.phone : ""}
                        </div>

                        <div className="hr" />

                        <div
                          className="row"
                          style={{ justifyContent: "space-between" }}
                        >
                          <span className="pill">
                            <span
                              className="dot"
                              style={{
                                background:
                                  st.status === "Working"
                                    ? "var(--ok)"
                                    : "#cbd5e1",
                              }}
                            />
                            <span>{st.status}</span>
                          </span>

                          <span className="pill">
                            <span className="muted2">Last:</span>{" "}
                            <span>
                              {latest ? formatBangkokTime(latest.time) : "—"}
                            </span>
                          </span>
                        </div>

                        {/* ✅ Monthly summary section */}
                        <div className="hr" />

                        <div
                          className="row"
                          style={{
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <span className="pill">
                              <b>Month:</b>&nbsp;{month}/{year}
                            </span>

                            {summaryLoading ? (
                              <span className="pill">Loading summary...</span>
                            ) : summaryError ? (
                              <span className="pill" style={{ color: "crimson" }}>
                                {summaryError}
                              </span>
                            ) : monthlySummary ? (
                              <>
                                <span className="pill">
                                  <b>Present:</b>&nbsp;{monthlySummary.presentDays}
                                </span>
                                <span className="pill">
                                  <b>Absent:</b>&nbsp;{monthlySummary.absentDays}
                                </span>
                                <span className="pill">
                                  <b>Working Days:</b>&nbsp;{monthlySummary.totalWorkingDays}
                                </span>
                              </>
                            ) : (
                              <span className="pill">No summary</span>
                            )}
                          </div>

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
                        </div>

                        {/* Latest map */}
                        {latest ? (
                          <>
                            <div className="hr" />
                            <div className="muted small">
                              <b>Latest {latest.type}</b>
                            </div>
                            <LocationMap
                              lat={latest.lat}
                              lng={latest.lng}
                              address={latest.address}
                              height="200px"
                            />
                            <div className="muted small" style={{ marginTop: 8 }}>
                              {latest.address || "(address unavailable)"}
                            </div>
                            <div className="muted2 small" style={{ marginTop: 6 }}>
                              <b>Device:</b> {latest.device?.platform || ""}
                            </div>
                          </>
                        ) : (
                          <div className="muted small">No logs yet.</div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="hr" />

                  {/* Logs */}
                  <div className="list">
                    {selectedLogs.slice(0, 25).map((r) => (
                      <div key={r.id} className="item" style={{ cursor: "default" }}>
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
                            <div className="muted mono">
                              lat:{Number(r.lat).toFixed(6)} lng:{Number(r.lng).toFixed(6)}
                            </div>
                            <div className="muted small">
                              {r.address || "(address unavailable)"}
                            </div>
                          </div>
                          <div className="muted2 small" style={{ textAlign: "right" }}>
                            <div className="mono">{r.device?.platform || ""}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}