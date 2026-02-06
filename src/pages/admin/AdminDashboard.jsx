import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import { getAllUsers, getAllAttendanceRecords } from "../../services/supabase";
import { logout } from "../../services/auth";
import LocationMap from "../../ui/LocationMap";

import { formatBangkokTime, parseISO, getBangkokYMD, getBangkokTimeParts } from "../../utils/date";

import AttendanceCalendar from "../../ui/AttendanceCalendar";

export default function AdminDashboard() {
  const nav = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    async function fetchData() {
      try {
        const [users, records] = await Promise.all([
          getAllUsers(),
          getAllAttendanceRecords()
        ]);

        const employeesList = users
          .filter((u) => u.role === "employee")
          .sort((a, b) => a.name.localeCompare(b.name));

        setEmployees(employeesList);
        setAllRecords(records);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Timer to refresh "current session" every 10 seconds
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  const getLatestStatus = (user) => {
    const userRecords = allRecords
      .filter((r) => r.userName === user.name)
      .sort((a, b) => parseISO(b.time) - parseISO(a.time));

    const latest = userRecords[0];
    if (!latest) return { status: "Not working", latest: null };
    return { status: latest.type === "checkin" ? "Working" : "Not working", latest };
  };

  const calculateTodayStats = (userName) => {
    const todayYMD = getBangkokYMD(new Date());

    const todayRecords = allRecords
      .filter((r) => {
        if (r.userName !== userName) return false;
        const d = parseISO(r.time);
        return getBangkokYMD(d) === todayYMD;
      })
      .sort((a, b) => parseISO(a.time) - parseISO(b.time));

    let totalMs = 0;
    let activeStartTime = null;
    let isLateLogin = false;
    let isEarlyLogout = false;
    let firstCheckin = null;
    let lastCheckout = null;

    todayRecords.forEach((r) => {
      if (r.type === "checkin") {
        const time = parseISO(r.time);
        if (!firstCheckin) {
          firstCheckin = time;
          const { hours, minutes } = getBangkokTimeParts(time);
          if (hours > 10 || (hours === 10 && minutes > 0)) {
            isLateLogin = true;
          }
        }
        activeStartTime = time;
      } else if (r.type === "checkout" && activeStartTime) {
        const time = parseISO(r.time);
        lastCheckout = time;
        totalMs += time - activeStartTime;
        activeStartTime = null;
      }
    });

    if (activeStartTime) {
      totalMs += now - activeStartTime;
    } else if (lastCheckout) {
      const { hours } = getBangkokTimeParts(lastCheckout);
      if (hours < 18) {
        isEarlyLogout = true;
      }
    }

    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);

    return {
      totalTime: `${hours}h ${minutes}m ${seconds}s`,
      isActive: !!activeStartTime,
      ms: totalMs,
      isLateLogin,
      isEarlyLogout
    };
  };

  const getUserLogs = (userName) => {
    return allRecords
      .filter((r) => r.userName === userName)
      .sort((a, b) => new Date(b.time) - new Date(a.time));
  };

  const workingCount = useMemo(() => {
    return employees.filter(u => getLatestStatus(u).status === "Working").length;
  }, [employees, allRecords]);

  const selected = employees.find((e) => e.id === selectedId) || null;
  const selectedLogs = selected ? getUserLogs(selected.name) : [];

  const toggleSelect = (id) => {
    setSelectedId((prev) => (prev === id ? null : id)); // click again -> minimize
  };

  const onLogout = () => {
    logout();
    nav("/login");
  };

  const downloadCSV = () => {
    const headers = ["Name", "Email", "Date", "Time", "Type", "Address", "Platform"];
    const rows = allRecords.map(r => {
      const { hours, minutes, seconds } = getBangkokTimeParts(r.time);
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      return [
        r.userName,
        r.userEmail || "",
        getBangkokYMD(parseISO(r.time)),
        timeStr,
        r.type,
        `"${(r.address || "").replace(/"/g, '""')}"`,
        r.device?.platform || ""
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_export_${getBangkokYMD(new Date())}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="page">
      <section className="single">
        <Card
          title="Admin Dashboard"
          subtitle="Click an employee to view details. Click again to minimize."
          right={
            <div className="row">
              <span className="pill"><span className="dot" style={{ background: "var(--ok)" }} /> {workingCount} Working</span>
              <span className="pill"><span className="dot" style={{ background: "#cbd5e1" }} /> {employees.length} Total</span>
              <button onClick={downloadCSV} className="btn-icon" style={{ marginLeft: 12, background: "var(--primary)", color: "white" }}>Export CSV</button>
              <button onClick={onLogout} className="btn-icon" style={{ marginLeft: 8 }}>Logout</button>
            </div>
          }
        >
          <div className="adminGrid">
            <div>
              <h3 className="title" style={{ fontSize: 15, margin: "0 0 10px 0" }}>Employees</h3>

              <div className="list">
                {loading ? (
                  <div className="muted small">Loading employees...</div>
                ) : employees.length === 0 ? (
                  <div className="muted small">No employees yet.</div>
                ) : employees.map((u) => {
                  const st = getLatestStatus(u);
                  const latestTime = st.latest ? formatBangkokTime(st.latest.time) : "—";
                  const dotColor = st.status === "Working" ? "var(--ok)" : "#cbd5e1";

                  return (
                    <div
                      key={u.id}
                      className={"item " + (selectedId === u.id ? "selected" : "")}
                      onClick={() => toggleSelect(u.id)}
                    >
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {u.name} <span className="muted2" style={{ fontWeight: 700 }}>({u.email})</span>
                          </div>
                          <div className="muted small">Last: {latestTime}</div>
                          <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                            {calculateTodayStats(u.name).isLateLogin && (
                              <span className="pill" style={{ background: "#fee2e2", color: "#991b1b", fontSize: "10px", padding: "2px 6px" }}>Late Login</span>
                            )}
                            {calculateTodayStats(u.name).isEarlyLogout && (
                              <span className="pill" style={{ background: "#fef3c7", color: "#92400e", fontSize: "10px", padding: "2px 6px" }}>Early Logout</span>
                            )}
                          </div>
                        </div>
                        <span className="pill">
                          <span className="dot" style={{ background: dotColor }} />
                          <span>{st.status}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="title" style={{ fontSize: 15, margin: "0 0 10px 0" }}>Details</h3>

              {!selected ? (
                <div className="muted small">Select an employee to view latest location and logs.</div>
              ) : (
                <>
                  {(() => {
                    const st = getLatestStatus(selected);
                    const latest = st.latest;
                    const stats = calculateTodayStats(selected.name);

                    return (
                      <div className="item" style={{ cursor: "default", borderLeft: stats.isActive ? "4px solid var(--ok)" : "none" }}>
                        <div style={{ fontWeight: 950, fontSize: 16 }}>{selected.name}</div>
                        <div className="muted small">
                          {selected.email}{selected.phone ? " • " + selected.phone : ""}
                        </div>

                        <div className="hr" />

                        <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
                          <div>
                            <div className="muted small" style={{ fontWeight: 700, marginBottom: 4 }}>Today's Working Hours</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: 900, color: stats.isActive ? "var(--ok)" : "var(--text)" }}>
                              {stats.totalTime}
                            </div>
                            {stats.isActive && <div className="muted2 small">Active Session Running...</div>}
                            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                              {stats.isLateLogin && (
                                <div className="pill" style={{ background: "#fee2e2", color: "#991b1b", fontWeight: "bold" }}>
                                  ⚠️ Late Login (After 10:00)
                                </div>
                              )}
                              {stats.isEarlyLogout && (
                                <div className="pill" style={{ background: "#fef3c7", color: "#92400e", fontWeight: "bold" }}>
                                  ⚠️ Early Logout (Before 18:00)
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span className="pill" style={{ marginBottom: 4, display: "inline-flex" }}>
                              <span className="dot" style={{ background: st.status === "Working" ? "var(--ok)" : "#cbd5e1" }} />
                              <span>{st.status}</span>
                            </span>
                            <div className="muted small">Last: {latest ? formatBangkokTime(latest.time) : "—"}</div>
                          </div>
                        </div>

                        {latest ? (
                          <>
                            <div className="hr" />
                            <div className="muted small"><b>Latest {latest.type}</b></div>
                            <LocationMap
                              lat={latest.lat}
                              lng={latest.lng}
                              address={latest.address}
                              height="200px"
                            />
                            <div className="muted small" style={{ marginTop: 8 }}>{latest.address || "(address unavailable)"}</div>
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

                  <div className="list">
                    {selectedLogs.slice(0, 25).map((r) => (
                      <div key={r.id} className="item" style={{ cursor: "default" }}>
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 900 }}>
                              {r.type === "checkin" ? "Check-in" : "Check-out"}{" "}
                              <span className="muted2" style={{ fontWeight: 700 }}>• {formatBangkokTime(r.time)}</span>
                            </div>
                            <div className="muted mono">lat:{Number(r.lat).toFixed(6)} lng:{Number(r.lng).toFixed(6)}</div>
                            <div className="muted small">{r.address || "(address unavailable)"}</div>
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

          <AttendanceCalendar employees={employees} allRecords={allRecords} />
        </Card>
      </section>
    </main>
  );
}
