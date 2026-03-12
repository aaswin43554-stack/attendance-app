import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Toast from "../../ui/Toast";
import { getSession, getUsers } from "../../services/storage";
import { createAttendance, createBatchAttendance } from "../../services/attendance";
import { getUserAttendanceRecords } from "../../services/supabase";
import { logout } from "../../services/auth";
import { useLanguage } from "../../context/LanguageContext";
import LocationMap from "../../ui/LocationMap";

import { formatBangkokTime } from "../../utils/date";

export default function EmployeeDashboard() {
  const nav = useNavigate();
  const session = getSession();
  const { t } = useLanguage();

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

  // Worker Attendance State
  const [workerConfig, setWorkerConfig] = useState({ start: "", end: "" });
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [workerStatus, setWorkerStatus] = useState({}); // workerId -> isWorking

  const workerIds = useMemo(() => {
    const s = parseInt(workerConfig.start);
    const e = parseInt(workerConfig.end);
    if (!isNaN(s) && !isNaN(e) && s <= e) {
      const ids = [];
      for (let i = s; i <= e; i++) ids.push(i);
      return ids;
    }
    return [];
  }, [workerConfig]);

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

      // Update worker statuses based on records
      const latestWorkerRecords = {};
      records.forEach(r => {
        if (r.userName?.startsWith("Worker ") || r.userId?.includes("_worker_")) {
          // Extract worker ID from "Worker X (via Y)" or "email_worker_X"
          let workerId = null;
          if (r.userName?.startsWith("Worker ")) {
            const match = r.userName.match(/Worker (\d+)/);
            if (match) workerId = match[1];
          } else if (r.userId?.includes("_worker_")) {
            workerId = r.userId.split("_worker_")[1];
          }

          if (workerId && !latestWorkerRecords[workerId]) {
            latestWorkerRecords[workerId] = r.type;
          }
        }
      });
      const newWorkerStatus = {};
      Object.keys(latestWorkerRecords).forEach(id => {
        newWorkerStatus[id] = latestWorkerRecords[id] === "checkin";
      });
      setWorkerStatus(newWorkerStatus);

    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  useEffect(() => { refresh(); }, [me?.id]);

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

  const doWorkerAction = async (type) => {
    if (!me || selectedWorkers.length === 0) return;
    setBusy(true);
    try {
      await createBatchAttendance({
        userId: me.id,
        type,
        userName: me.name,
        workerIds: selectedWorkers
      });
      setToast(`${type === "checkin" ? t('checkin') : t('checkout')} ${selectedWorkers.length} workers.`);
      setSelectedWorkers([]);
      refresh();
    } catch (error) {
      console.error("❌ Worker action error:", error);
      setToast("❌ " + error.message);
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
            <span className="pill">
              <span className="dot" style={{ background: status.status === "Working" ? "var(--ok)" : "#cbd5e1" }} />
              <span>{status.status === "Working" ? t('statusWorking') : t('statusNotWorking')}</span>
            </span>
          }
        >
          <div className="row">
            <button className="btn btnOk" disabled={busy} onClick={() => doAction("checkin")}>{t('checkin')}</button>
            <button className="btn btnDanger" disabled={busy} onClick={() => doAction("checkout")}>{t('checkout')}</button>
          </div>



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
