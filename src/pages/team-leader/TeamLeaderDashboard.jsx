import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Toast from "../../ui/Toast";
import { getSession } from "../../services/storage";
import { createAttendance, createTeamLeaderBulkAttendance } from "../../services/attendance";
import { supabase, getEmployeesByLeader, getAllAttendanceRecords } from "../../services/supabase";
import { logout } from "../../services/auth";
import { useLanguage } from "../../context/LanguageContext";
import { formatBangkokTime, getBangkokYMD, parseISO } from "../../utils/date";
import Sidebar from "../../ui/Sidebar";

export default function TeamLeaderDashboard() {
    const nav = useNavigate();
    const session = getSession();
    const { t } = useLanguage();

    const [employees, setEmployees] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState("");
    const [allRecords, setAllRecords] = useState([]);
    const [now, setNow] = useState(new Date());
    const [activeTab, setActiveTab] = useState("overview");

    const me = useMemo(() => {
        if (!session.userId) return null;
        return {
            id: session.userId,
            email: session.userId,
            name: session.userName || "Team Leader"
        };
    }, [session.userId, session.userName]);

    const myStatus = useMemo(() => {
        if (!me) return { status: t('statusNotWorking'), latest: null };
        const myRecords = allRecords
            .filter((r) => r.userName === me.name)
            .sort((a, b) => parseISO(b.time) - parseISO(a.time));
        const latest = myRecords[0];
        if (!latest) return { status: t('statusNotWorking'), latest: null };
        return { status: latest.type === "checkin" ? t('statusWorking') : t('statusNotWorking'), latest };
    }, [me, allRecords, t]);

    async function fetchData() {
        if (!session.userId) return;
        try {
            const [managed, records] = await Promise.all([
                getEmployeesByLeader(session.userId),
                getAllAttendanceRecords()
            ]);
            setEmployees(managed);
            setAllRecords(records);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            setToast("Error fetching team data");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();

        // Set up Realtime Subscriptions
        const tlChannel = supabase.channel(`tl_dashboard_${session.userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
                console.log("🔄 Realtime: Team attendance change, refreshing...");
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
                // Refresh if a user's manager changed to/from this leader
                const old = payload.old;
                const next = payload.new;
                if (old?.managed_by === session.userId || next?.managed_by === session.userId) {
                    console.log("🔄 Realtime: Team member change, refreshing...");
                    fetchData();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(tlChannel);
        };
    }, [session.userId]);

    // Local ticker for UI clocks (timer)
    useEffect(() => {
        const ticker = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(ticker);
    }, []);

    const handleMyAction = async (type) => {
        if (!me) return;
        setBusy(true);
        try {
            await createAttendance({ userId: me.id, type, userName: me.name });
            setToast(type === "checkin" ? t('toastCheckedIn') : t('toastCheckedOut'));
            fetchData(); // Refresh to catch new record
        } catch (error) {
            console.error("Personal action failed:", error);
            setToast("Error: " + (error.message || "Action failed"));
        } finally {
            setBusy(false);
            setTimeout(() => setToast(""), 3000);
        }
    };
    const getLatestStatus = (userName) => {
        const userRecords = allRecords
            .filter((r) => r.userName === userName)
            .sort((a, b) => parseISO(b.time) - parseISO(a.time));

        const latest = userRecords[0];
        if (!latest) return { status: t('statusNotWorking'), latest: null };
        return { status: latest.type === "checkin" ? t('statusWorking') : t('statusNotWorking'), latest };
    };

    const handleBulkAction = async (type) => {
        if (selectedIds.length === 0) {
            setToast("Select at least one employee");
            return;
        }

        setBusy(true);
        try {
            const selectedEmployees = employees.filter(emp => selectedIds.includes(emp.id));
            await createTeamLeaderBulkAttendance({
                leaderId: session.userId,
                leaderName: session.userName || "Team Leader",
                type,
                selectedEmployees
            });

            setToast(`Successfully ${type === 'checkin' ? 'checked in' : 'checked out'} ${selectedIds.length} employees.`);
            setSelectedIds([]);

            // Refresh status
            const records = await getAllAttendanceRecords();
            setAllRecords(records);
        } catch (error) {
            console.error("Bulk action failed:", error);
            setToast("Error: " + (error.message || "Action failed"));
        } finally {
            setBusy(false);
            setTimeout(() => setToast(""), 3000);
        }
    };

    const onLogout = () => {
        logout();
        nav("/login");
    };

    const toggleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(employees.map(emp => emp.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const navItems = [
        { id: "overview", label: t('overview') || "Overview", icon: "📊" },
        { id: "team", label: t('teamManagement') || "Team", icon: "👥" }
    ];

    return (
        <div className="dashboard-layout">
            <Sidebar 
                title="Team Leader"
                items={navItems} 
                activeItem={activeTab} 
                onChange={setActiveTab} 
            />
            <main className="dashboard-content">
                {activeTab === "overview" && (
                    <section className="single" style={{ animation: "fadeIn 0.3s ease" }}>
                        <Card
                            title={`${t('hello')}, ${session.userName || "Team Leader"}`}
                            subtitle="Team Leader Dashboard"
                            right={
                                <div style={{ textAlign: "right" }}>
                                    <div className="row">
                                        <span className="pill">
                                            <span className="dot" style={{ background: myStatus.status === t('statusWorking') ? "var(--ok)" : "#cbd5e1" }} />
                                            <span>{myStatus.status === t('statusWorking') ? t('statusWorking') : t('statusNotWorking')}</span>
                                        </span>
                                        <button onClick={onLogout} className="btn-icon">{t('logout')}</button>
                                    </div>
                                    {myStatus.status === t('statusWorking') && myStatus.latest && (
                                        <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--ok)", marginTop: "4px" }}>
                                            {(() => {
                                                const start = parseISO(myStatus.latest.time);
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
                                    <button
                                        className="btn btnOk"
                                        disabled={busy}
                                        onClick={() => handleMyAction("checkin")}
                                    >
                                        {t('checkin')}
                                    </button>
                                    <button
                                        className="btn btnDanger"
                                        disabled={busy}
                                        onClick={() => handleMyAction("checkout")}
                                    >
                                        {t('checkout')}
                                    </button>
                                </div>
                            </div>
                        </Card>
                    </section>
                )}

                {activeTab === "team" && (
                    <section className="single" style={{ animation: "fadeIn 0.3s ease" }}>
                        <Card title="Team Management" subtitle="Manage attendance for your assigned team members">
                            <div className="item" style={{ background: "#f8fafc", marginBottom: 20 }}>
                                <h3 className="title" style={{ fontSize: 16 }}>Bulk Action</h3>
                                <p className="muted small">Capture one location and timestamp for multiple employees at once.</p>

                                <div className="row mt12" style={{ gap: 12 }}>
                                    <button
                                        className="btn btnOk"
                                        disabled={busy || selectedIds.length === 0}
                                        onClick={() => handleBulkAction("checkin")}
                                    >
                                        Check In Selected ({selectedIds.length})
                                    </button>
                                    <button
                                        className="btn btnDanger"
                                        disabled={busy || selectedIds.length === 0}
                                        onClick={() => handleBulkAction("checkout")}
                                    >
                                        Check Out Selected ({selectedIds.length})
                                    </button>
                                </div>
                            </div>

                            <div className="hr" />

                            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 className="title" style={{ fontSize: 15, margin: 0 }}>My Team</h3>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>
                                    <input
                                        type="checkbox"
                                        checked={employees.length > 0 && selectedIds.length === employees.length}
                                        onChange={toggleSelectAll}
                                    />
                                    Select All
                                </label>
                            </div>

                            <div className="list">
                                {loading ? (
                                    <div className="muted small text-center">Loading team members...</div>
                                ) : employees.length === 0 ? (
                                    <div className="muted small text-center">No employees assigned to you.</div>
                                ) : employees.map((u) => {
                                    const st = getLatestStatus(u.name);
                                    const isSelected = selectedIds.includes(u.id);
                                    const dotColor = st.status === t('statusWorking') ? "var(--ok)" : "#cbd5e1";

                                    return (
                                        <div
                                            key={u.id}
                                            className={"item " + (isSelected ? "selected" : "")}
                                            style={{ cursor: "pointer" }}
                                            onClick={() => toggleSelect(u.id)}
                                        >
                                            <div className="row" style={{ justifyContent: "space-between" }}>
                                                <div className="row" style={{ gap: 12 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => { }} // handled by parent div onClick
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <div>
                                                        <div style={{ fontWeight: 900 }}>{u.name}</div>
                                                        <div className="muted small">{u.email}</div>
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
