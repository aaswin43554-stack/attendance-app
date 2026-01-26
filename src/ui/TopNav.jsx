import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { resetDemo } from "../services/storage";

export default function TopNav() {
  const nav = useNavigate();
  const loc = useLocation();

  const go = (path) => nav(path);

  return (
    <header className="nav">
      <div className="navInner">
        <div className="brand">
          tronXlabs <small>• Attendance Beta</small>
        </div>

        <div className="navLinks">
          <button className="chip" onClick={() => go("/employee/login")}>
            Employee
          </button>
          <button className="chip" onClick={() => go("/admin/login")}>
            Admin
          </button>
          <button
            className="chip"
            onClick={() => {
              resetDemo();
              // stay on same page but refresh UI
              nav(loc.pathname, { replace: true });
            }}
          >
            Reset
          </button>
          <button className="cta" onClick={() => go("/employee/login")}>
            Get Started
          </button>
        </div>
      </div>
    </header>
  );
}
