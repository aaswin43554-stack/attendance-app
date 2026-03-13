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

  return (
    <main className="page">
      <section className="grid">
        <Card
          title={`${t('hello')}, ${me?.name || "Employee"}`}
          subtitle={me ? `${me.email}${me.phone ? " • " + me.phone : ""}` : ""}
          right={
            <div style={{ textAlign: "right" }}>
              <span className="pill">
                <span className="dot" style={{ background: status.status === "Working" ? "var(--ok)" : "#cbd5e1" }} />
                <span>{status.status === "Working" ? t('statusWorking') : t('statusNotWorking')}</span>
              </span>
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
          <div className="row">
            <button className="btn btnOk" disabled={busy} onClick={() => doAction("checkin")}>{t('checkin')}</button>
            <button className="btn btnDanger" disabled={busy} onClick={() => doAction("checkout")}>{t('checkout')}</button>
          </div>

          <div className="hr" />

          <h3 className="title" style={{ fontSize: 15, margin: "0 0 10px 0" }}>{t('recentLogs')}</h3>

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

        <Card title={t('tipTitle')} subtitle={t('tipSubtitle')}>
          <div className="muted small">{t('tipDescription')}</div>
        </Card>
      </section>

      <Toast message={toast} />
    </main>
  );
}
