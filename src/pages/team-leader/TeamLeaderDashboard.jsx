import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Toast from "../../ui/Toast";
import { getSession } from "../../services/storage";
import { getEmployeesByLeader, getAllAttendanceRecords } from "../../services/supabase";
import { createTeamLeaderBulkAttendance } from "../../services/attendance";
import { logout } from "../../services/auth";
import { useLanguage } from "../../context/LanguageContext";
import { formatBangkokTime, getBangkokYMD, parseISO } from "../../utils/date";

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

    useEffect(() => {
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
        fetchData();
    }, [session.userId]);

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

    return (
        <main className="page">
            <section className="single">
                <Card
                    title={`${t('hello')}, ${session.userName || "Team Leader"}`}
                    subtitle="Team Leader Dashboard • Shared Device Mode"
                    right={
                        <div className="row">
                            <button onClick={onLogout} className="btn-icon">{t('logout')}</button>
                        </div>
                    }
                >
                    <div className="item" style={{ background: "#f8fafc", marginBottom: 20 }}>
                        <h3 className="title" style={{ fontSize: 16 }}>Team Management</h3>
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

            <Toast message={toast} />
        </main>
    );
}
