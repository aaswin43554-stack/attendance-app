import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Toast from "../../ui/Toast";
import { getSession, getUsers } from "../../services/storage";
import { createAttendance } from "../../services/attendance";
import { supabase, getUserAttendanceRecords } from "../../services/supabase";
import { logout } from "../../services/auth";
import { useLanguage } from "../../context/LanguageContext";
import LocationMap from "../../ui/LocationMap";

import { formatBangkokTime, parseISO } from "../../utils/date";
import Sidebar from "../../ui/Sidebar";

export default function EmployeeDashboard() {
  const nav = useNavigate();
  const session = getSession();
  const { t } = useLanguage();
  const [now, setNow] = useState(new Date());

  // Get user info from session (userId is the email)
  const me = useMemo(() => {
    if (!session.userId) return null;
    return {
      id: session.userId,
      email: session.userId,
      name: session.userName || "Employee"
    };
  }, [session.userId, session.userName]);

  const [toast, setToast] = useState("");
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState({ status: "Not working", latest: null });
  const [busy, setBusy] = useState(false);
  const [showMaps, setShowMaps] = useState({}); // track which logs have map visible
  const [activeTab, setActiveTab] = useState("overview");

  const refresh = async () => {
    if (!me) return;
    try {
      const records = await getUserAttendanceRecords(me.name);
      setLogs(records.slice(0, 10));

      const latest = records[0];
      if (!latest) {
        setStatus({ status: "Not working", latest: null });
      } else {
        setStatus({
          status: latest.type === "checkin" ? "Working" : "Not working",
          latest
        });
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  useEffect(() => {
    refresh();

    if (me?.name) {
      // Set up Realtime Subscription for this user's attendance
      const channel = supabase.channel(`employee_realtime_${me.name}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
          // Check if the change is relevant to this user
          const newRec = payload.new;
          if (newRec.userName === me.name || newRec.userName.includes(`via ${me.name}`)) {
            console.log("🔄 Realtime: Own attendance change, refreshing...");
            refresh();
          }
        })
        .subscribe();

      // Local ticker for UI clocks (timer)
      const ticker = setInterval(() => setNow(new Date()), 1000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(ticker);
      };
    }
  }, [me?.id, me?.name]);

  const doAction = async (type) => {
    if (!me) return;
    setBusy(true);
    try {
      console.log("🔄 Starting", type, "for user:", me.name);
      await createAttendance({ userId: me.id, type, userName: me.name });
      console.log("✅", type, "successful");
      setToast(type === "checkin" ? t('toastCheckedIn') : t('toastCheckedOut'));
      refresh();
    } catch (error) {
      console.error("❌ Error during", type, ":", error.message);
      setToast("❌ " + (error.message || "Location permission needed."));
    } finally {
      setBusy(false);
      setTimeout(() => setToast(""), 2200);
    }
  };

  const onLogout = () => {
    logout();
    nav("/login");
  };

  const navItems = [
    { id: "overview", label: t('overview') || "Dashboard", icon: "🏠" },
    { id: "workers", label: t('workerAttendance') || "Workers", icon: "👷" },
    { id: "logs", label: t('recentLogs') || "Logs", icon: "📋" }
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar 
        title="Employee Portal"
        items={navItems} 
        activeItem={activeTab} 
        onChange={setActiveTab} 
      />
      <main className="dashboard-content">
        {activeTab === "overview" && (
          <section className="single" style={{ animation: "fadeIn 0.3s ease" }}>
            <Card
              title={`${t('hello')}, ${me?.name || "Employee"}`}
              subtitle={me ? `${me.email}${me.phone ? " • " + me.phone : ""}` : ""}
              right={
                <div style={{ textAlign: "right" }}>
                  <div className="row">
                    <span className="pill">
                      <span className="dot" style={{ background: status.status === "Working" ? "var(--ok)" : "#cbd5e1" }} />
                      <span>{status.status === "Working" ? t('statusWorking') : t('statusNotWorking')}</span>
                    </span>
                    <button onClick={onLogout} className="btn-icon">{t('logout')}</button>
                  </div>
                  {status.status === "Working" && status.latest && (
                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--ok)", marginTop: "4px" }}>
                      {(() => {
                        const start = parseISO(status.latest.time);
                        const diffMs = now - start;
                        const h = Math.floor(diffMs / 3600000);
                        const m = Math.floor((diffMs % 3600000) / 60000);
                        const s = Math.floor((diffMs % 60000) / 1000);
                        return `${h}h ${m}m ${s}s`;
                      })()}
                    </div>
                  )}
                </div>
              }
            >
              <div className="item" style={{ background: "rgba(37, 99, 235, 0.05)", marginBottom: 20, borderLeft: "4px solid var(--primary)" }}>
                <h3 className="title" style={{ fontSize: 16 }}>Personal Attendance</h3>
                <p className="muted small">Record your own check-in and check-out status.</p>
                <div className="row mt12">
                  <button className="btn btnOk" disabled={busy} onClick={() => doAction("checkin")}>{t('checkin')}</button>
                  <button className="btn btnDanger" disabled={busy} onClick={() => doAction("checkout")}>{t('checkout')}</button>
                </div>
              </div>
            </Card>

            <div className="mt12">
              <Card title={t('tipTitle')} subtitle={t('tipSubtitle')}>
                <div className="muted small">{t('tipDescription')}</div>
              </Card>
            </div>
          </section>
        )}

        {activeTab === "workers" && (
          <section className="single" style={{ animation: "fadeIn 0.3s ease" }}>
            <Card title={t('workerAttendance')} subtitle="Manage attendance for virtual workers">
              <div className="row" style={{ gap: 10, marginBottom: 15 }}>
                <div style={{ flex: 1 }}>
                  <label className="muted small">{t('startWorkerId')}</label>
                  <input
                    type="number"
                    className="input"
                    value={workerConfig?.start || ""}
                    onChange={e => setWorkerConfig(p => ({ ...p, start: e.target.value }))}
                    placeholder="e.g. 1"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="muted small">{t('endWorkerId')}</label>
                  <input
                    type="number"
                    className="input"
                    value={workerConfig?.end || ""}
                    onChange={e => setWorkerConfig(p => ({ ...p, end: e.target.value }))}
                    placeholder="e.g. 10"
                  />
                </div>
              </div>

              {(workerIds && workerIds.length > 0) ? (
                <>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedWorkers.length === workerIds.length}
                        onChange={e => setSelectedWorkers(e.target.checked ? [...workerIds] : [])}
                      />
                      <span className="small font-bold">{t('selectAll')} ({workerIds.length})</span>
                    </label>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        className="btn btnOk small"
                        disabled={busy || selectedWorkers.length === 0}
                        onClick={() => doWorkerAction("checkin")}
                      >
                        {t('checkin')}
                      </button>
                      <button
                        className="btn btnDanger small"
                        disabled={busy || selectedWorkers.length === 0}
                        onClick={() => doWorkerAction("checkout")}
                      >
                        {t('checkout')}
                      </button>
                    </div>
                  </div>

                  <div className="list" style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", padding: 10, borderRadius: 8 }}>
                    {workerIds.map(id => (
                      <label key={id} className="item" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={selectedWorkers.includes(id)}
                            onChange={e => {
                              if (e.target.checked) setSelectedWorkers(p => [...p, id]);
                              else setSelectedWorkers(p => p.filter(x => x !== id));
                            }}
                          />
                          <span>{t('workerLabel')} {id}</span>
                        </div>
                        <span className="pill small">
                          <span className="dot" style={{ background: workerStatus[id] ? "var(--ok)" : "#cbd5e1" }} />
                          <span style={{ fontSize: 11 }}>{workerStatus[id] ? t('statusWorking') : t('statusNotWorking')}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <div className="muted small" style={{ textAlign: "center", padding: 20, background: "#f8fafc", borderRadius: 8 }}>
                  {t('noWorkersInRange')}
                </div>
              )}
            </Card>
          </section>
        )}

        {activeTab === "logs" && (
          <section className="single" style={{ animation: "fadeIn 0.3s ease" }}>
            <Card title={t('recentLogs')} subtitle="History of your recent checkins and checkouts">
              <div className="list">
                {logs.length === 0 ? (
                  <div className="muted small">{t('noLogs')}</div>
                ) : logs.map((r) => (
                  <div className="item" key={r.id} style={{ cursor: "default" }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          {r.userName?.includes("Worker") ? r.userName : (r.type === "checkin" ? t('checkin') : t('checkout'))}{" "}
                          <span className="muted2" style={{ fontWeight: 700 }}>• {formatBangkokTime(r.time)}</span>
                        </div>
                        {r.userName?.includes("Worker") && (
                          <div className="muted extra-small" style={{ fontSize: 11 }}>{r.type === "checkin" ? t('checkin') : t('checkout')}</div>
                        )}

                        {showMaps[r.id] ? (
                          <LocationMap
                            lat={parseFloat(r.lat)}
                            lng={parseFloat(r.lng)}
                            address={r.address}
                            height="180px"
                          />
                        ) : (
                          <div className="mt10">
                            <button className="btn btnGhost small" onClick={() => setShowMaps(p => ({ ...p, [r.id]: true }))}>
                              {t('showMap')}
                            </button>
                          </div>
                        )}
                        <div className="muted small" style={{ marginTop: 8 }}>{r.address || t('addressUnavailable')}</div>
                      </div>
                      <div className="muted2 small" style={{ textAlign: "right" }}>
                        <div className="mono">{r.device?.platform || ""}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Toast message={toast} />
    </div>
  );
}
