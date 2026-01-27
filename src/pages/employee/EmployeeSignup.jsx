import React from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "../../services/storage";
import { logoutEmployee, logoutAdmin } from "../../services/auth"; // if you don't have logoutAdmin, remove it

export default function Header() {
  const nav = useNavigate();
  const session = getSession();

  // Update these checks based on how you store admin session
  const employeeLoggedIn = !!session?.userId;
  const adminLoggedIn = !!session?.adminId;
  const loggedIn = employeeLoggedIn || adminLoggedIn;

  const onLogout = () => {
    if (adminLoggedIn && typeof logoutAdmin === "function") {
      logoutAdmin();
      nav("/admin/login");
      return;
    }
    logoutEmployee();
    nav("/employee/login");
  };

  return (
    <header className="topbar">
      <div className="brand">
        <b>tronXlabs</b> <span className="muted2">• Attendance Beta</span>
      </div>

      <div className="topActions">
        {/* BEFORE LOGIN: show Employee/Admin */}
        {!loggedIn && (
          <>
            <button className="btn btnGhost" onClick={() => nav("/employee/login")}>
              Employee
            </button>
            <button className="btn btnGhost" onClick={() => nav("/admin/login")}>
              Admin
            </button>
          </>
        )}

        {/* AFTER LOGIN: hide Employee/Admin and show Logout */}
        {loggedIn && (
          <button className="btn btnPrimary" onClick={onLogout}>
            Logout
          </button>
        )}

        {/* REMOVED: Reset + Get Started */}
      </div>
    </header>
  );
}
