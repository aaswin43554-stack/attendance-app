import React from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "../services/storage";

export default function TopNav() {
  const nav = useNavigate();

  const go = (path) => nav(path);

  // Your app uses session.type: "employee" | "admin"
  const s = getSession();
  const isLoggedIn = s?.type === "employee" || s?.type === "admin";

  return (
    <header className="nav">
      <div className="navInner">
        <div className="brand">
          tronXlabs <small>• Attendance Beta</small>
        </div>

        <div className="navLinks">
          {/* ✅ Show Employee/Admin only BEFORE login */}
          {!isLoggedIn && (
            <button className="chip" onClick={() => go("/login")}>
              Login
            </button>
          )}

          {/* ✅ Removed: Reset + Get Started */}
        </div>
      </div>
    </header>
  );
}
