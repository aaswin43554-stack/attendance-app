import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import { getAllUsers, getAllAttendanceRecords } from "../../services/supabase";
import { logout } from "../../services/auth";
import { useLanguage } from "../../context/LanguageContext";
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

  // Work hours settings
  const [workStart, setWorkStart] = useState(() => localStorage.getItem("work_start") || "10:00");
  const [workEnd, setWorkEnd] = useState(() => localStorage.getItem("work_end") || "18:00");
  const [showSettings, setShowSettings] = useState(false);

  const { t } = useLanguage();

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
    if (!latest) return { status: t('statusNotWorking'), latest: null };
    return { status: latest.type === "checkin" ? t('statusWorking') : t('statusNotWorking'), latest };
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
          const [limitH, limitM] = workStart.split(":").map(Number);
          if (hours > limitH || (hours === limitH && minutes > limitM)) {
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
      const { hours, minutes } = getBangkokTimeParts(lastCheckout);
      const [limitH, limitM] = workEnd.split(":").map(Number);
      if (hours < limitH || (hours === limitH && minutes < limitM)) {
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

  const saveWorkSettings = () => {
    localStorage.setItem("work_start", workStart);
    localStorage.setItem("work_end", workEnd);
    alert(t('settingsSaved'));
    setShowSettings(false);
  };



  const downloadCSV = () => {
    const headers = ["Name", "Email", "Date", "Time", "Type", "Address", "Platform"];

    // Create a map for quick email lookup (case-insensitive keys)
    const emailMap = {};
    employees.forEach(emp => {
      if (emp.name && emp.email) {
        emailMap[emp.name.toLowerCase()] = emp.email;
      }
    });

    const rows = allRecords.map(r => {
      const { hours, minutes, seconds } = getBangkokTimeParts(r.time);
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      // Look up email from the map (case-insensitive)
      const userEmail = emailMap[r.userName?.toLowerCase()] || "";

      return [
        r.userName,
        userEmail,
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
          title={t('adminDashboard')}
          subtitle={t('adminSubtitle')}
          right={
            <div className="row">
              <span className="pill"><span className="dot" style={{ background: "var(--ok)" }} /> {workingCount} {t('working')}</span>
              <span className="pill"><span className="dot" style={{ background: "#cbd5e1" }} /> {employees.length} {t('total')}</span>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn-icon"
                style={{ marginLeft: 12, background: showSettings ? "var(--bg)" : "white" }}
              >
                ⚙️ {t('settings')}
              </button>
              <button onClick={downloadCSV} className="btn-icon" style={{ marginLeft: 8, background: "var(--primary)", color: "white" }}>{t('exportCSV')}</button>
              <button onClick={onLogout} className="btn-icon" style={{ marginLeft: 8 }}>{t('logout')}</button>
            </div>
          }
        >
          {showSettings && (
            <div className="item" style={{ marginBottom: 20, borderTop: "2px solid var(--primary)" }}>
              <h3 className="title">{t('settings')}</h3>
              <div className="grid2" style={{ gap: 20 }}>
                <div>
                  <label>{t('workStartTime')}</label>
                  <input
                    type="time"
                    value={workStart}
                    onChange={e => setWorkStart(e.target.value)}
                  />
                </div>
                <div>
                  <label>{t('workEndTime')}</label>
                  <input
                    type="time"
                    value={workEnd}
                    onChange={e => setWorkEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="row mt12">
                <button className="btn btnPrimary" onClick={saveWorkSettings}>{t('saveSettings')}</button>
              </div>
            </div>
          )}

          <div className="adminGrid">
            <div>
              <h3 className="title" style={{ fontSize: 15, margin: "0 0 10px 0" }}>{t('employees')}</h3>

              <div className="list">
                {loading ? (
                  <div className="muted small">{t('loadingEmployees')}</div>
                ) : employees.length === 0 ? (
                  <div className="muted small">{t('noEmployees')}</div>
                ) : employees.map((u) => {
                  const st = getLatestStatus(u);
                  const latestTime = st.latest ? formatBangkokTime(st.latest.time) : "—";
                  const dotColor = st.status === t('statusWorking') ? "var(--ok)" : "#cbd5e1";

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
                          <div className="muted small">{t('last')}: {latestTime}</div>
                          <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                            {calculateTodayStats(u.name).isLateLogin && (
                              <span className="pill" style={{ background: "#fee2e2", color: "#991b1b", fontSize: "10px", padding: "2px 6px" }}>{t('lateLogin')}</span>
                            )}
                            {calculateTodayStats(u.name).isEarlyLogout && (
                              <span className="pill" style={{ background: "#fef3c7", color: "#92400e", fontSize: "10px", padding: "2px 6px" }}>{t('earlyLogout')}</span>
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
              <h3 className="title" style={{ fontSize: 15, margin: "0 0 10px 0" }}>{t('details')}</h3>

              {!selected ? (
                <div className="muted small">{t('selectEmployee')}</div>
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
                            <div className="muted small" style={{ fontWeight: 700, marginBottom: 4 }}>{t('todayWorkingHours')}</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: 900, color: stats.isActive ? "var(--ok)" : "var(--text)" }}>
                              {stats.totalTime}
                            </div>
                            {stats.isActive && <div className="muted2 small">{t('activeSession')}</div>}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                              {stats.isLateLogin && (
                                <div className="column" style={{ gap: 4 }}>
                                  <div className="pill" style={{ background: "#fee2e2", color: "#991b1b", fontWeight: "bold" }}>
                                    {t('lateLoginWarning').replace('{time}', workStart)}
                                  </div>
                                </div>
                              )}
                              {stats.isEarlyLogout && (
                                <div className="column" style={{ gap: 4 }}>
                                  <div className="pill" style={{ background: "#fef3c7", color: "#92400e", fontWeight: "bold" }}>
                                    {t('earlyLogoutWarning').replace('{time}', workEnd)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span className="pill" style={{ marginBottom: 4, display: "inline-flex" }}>
                              <span className="dot" style={{ background: st.status === t('statusWorking') ? "var(--ok)" : "#cbd5e1" }} />
                              <span>{st.status}</span>
                            </span>
                            <div className="muted small">{t('last')}: {latest ? formatBangkokTime(latest.time) : "—"}</div>
                          </div>
                        </div>

                        {latest ? (
                          <>
                            <div className="hr" />
                            <div className="muted small"><b>{t('latest')} {latest.type === "checkin" ? t('checkin') : t('checkout')}</b></div>
                            <LocationMap
                              lat={latest.lat}
                              lng={latest.lng}
                              address={latest.address}
                              height="200px"
                            />
                            <div className="muted small" style={{ marginTop: 8 }}>{latest.address || t('addressUnavailable')}</div>
                            <div className="muted2 small" style={{ marginTop: 6 }}>
                              <b>{t('device')}:</b> {latest.device?.platform || ""}
                            </div>
                          </>
                        ) : (
                          <div className="muted small">{t('noLogs')}</div>
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
                              {r.type === "checkin" ? t('checkin') : t('checkout')}{" "}
                              <span className="muted2" style={{ fontWeight: 700 }}>• {formatBangkokTime(r.time)}</span>
                            </div>
                            <div className="muted mono">lat:{Number(r.lat).toFixed(6)} lng:{Number(r.lng).toFixed(6)}</div>
                            <div className="muted small">{r.address || t('addressUnavailable')}</div>
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
