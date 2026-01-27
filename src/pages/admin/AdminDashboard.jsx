import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import { getAllUsers, getAllAttendanceRecords } from "../../services/supabase";
import { logoutAdmin } from "../../services/auth";
import { getSession } from "../../services/storage";

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const session = getSession();

  // ✅ redirect if admin not logged in
  useEffect(() => {
    // adjust this check if your admin session key is different
    if (!session?.adminId) {
      nav("/admin/login");
    }
  }, [session?.adminId, nav]);

  const [selectedId, setSelectedId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // ✅ Precompute logs by username (fast)
  const logsByUser = useMemo(() => {
    const map = new Map();
    for (const r of allRecords) {
      const key = r.userName || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    // sort each user logs by time desc
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(b.time) - new Date(a.time));
      map.set(k, arr);
    }
    return map;
  }, [allRecords]);

  const getLatestStatus = (user) => {
    const arr = logsByUser.get(user?.name || "") || [];
    const latest = arr[0];
    if (!latest) return { status: "Not working", latest: null };
    return {
      status: latest.type === "checkin" ? "Working" : "Not working",
      latest,
    };
  };

  const selected = employees.find((e) => e.id === selectedId) || null;
  const selectedLogs = selected ? logsByUser.get(selected.name) || [] : [];

  const workingCount = useMemo(() => {
    return employees.filter((u) => getLatestStatus(u).status === "Working").length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, logsByUser]);

  const toggleSelect = (id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const onLogout = () => {
    logoutAdmin();
    nav("/admin/login");
  };

  return (
    <main className="page">
      <section className="single">
        <Card
          title="Admin Dashboard"
          subtitle="Click an employee to view details. Click again to minimize."
          right={
            <div className="row">
              <span className="pill">
                <span className="dot" style={{ background: "var(--ok)" }} />{" "}
                {workingCount} Working
              </span>
              <span className="pill">
                <span className="dot" style={{ background: "#cbd5e1" }} />{" "}
                {employees.length} Total
              </span>
              <button className="btn btnGhost" onClick={onLogout}>
                Logout
              </button>
            </div>
          }
        >
          <div className="adminGrid">
            <div>
              <h3 className="title" style={{ fontSize: 15, margin: "0 0 10px 0" }}>
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
                    const latestTime = st.latest ? fmt(st.latest.time) : "—";
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
                              {u.name}{" "}
                              <span className="muted2" style={{ fontWeight: 700 }}>
                                ({u.email})
                              </span>
                            </div>
                            <div className="muted small">Last: {latestTime}</div>
                          </div>

                          <span className="pill">
                            <span className="dot" style={{ background: dotColor }} />
                            <span>{st.status}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <h3 className="title" style={{ fontSize: 15, margin: "0 0 10px 0" }}>
                Details
              </h3>

              {!selected ? (
                <div className="muted small">
                  Select an employee to view latest location and logs.
                </div>
              ) : (
                <>
                  {(() => {
                    const st = getLatestStatus(selected);
                    const latest = st.latest;

                    return (
                      <div className="item" style={{ cursor: "default" }}>
                        <div style={{ fontWeight: 950, fontSize: 16 }}>{selected.name}</div>
                        <div className="muted small">
                          {selected.email}
                          {selected.phone ? " • " + selected.phone : ""}
                        </div>

                        <div className="hr" />

                        <div className="row" style={{ justifyContent: "space-between" }}>
                          <span className="pill">
                            <span
                              className="dot"
                              style={{
                                background: st.status === "Working" ? "var(--ok)" : "#cbd5e1",
                              }}
                            />
                            <span>{st.status}</span>
                          </span>

                          <span className="pill">
                            <span className="muted2">Last:</span>{" "}
                            <span>{latest ? fmt(latest.time) : "—"}</span>
                          </span>
                        </div>

                        {latest ? (
                          <>
                            <div className="hr" />
                            <div className="muted small">
                              <b>Latest {latest.type}</b>
                            </div>
                            <div className="muted mono">
                              lat:{Number(latest.lat).toFixed(6)} lng:
                              {Number(latest.lng).toFixed(6)}
                            </div>
                            <div className="muted small">
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
                                • {fmt(r.time)}
                              </span>
                            </div>
                            <div className="muted mono">
                              lat:{Number(r.lat).toFixed(6)} lng:
                              {Number(r.lng).toFixed(6)}
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
