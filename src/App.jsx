import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { formatBangkokTime, parseISO, getBangkokYMD, getBangkokTimeParts } from "./utils/date";

import TopNav from "./ui/TopNav";
import AttendanceCalendar from "./ui/AttendanceCalendar";
import { LanguageProvider } from "./context/LanguageContext";

import Login from "./pages/Login";
import EmployeeSignup from "./pages/employee/EmployeeSignup";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";

import AdminDashboard from "./pages/admin/AdminDashboard";
import TeamLeaderDashboard from "./pages/team-leader/TeamLeaderDashboard";
import ForgotPassword from "./pages/ForgotPassword";

import { getSession } from "./services/storage";

function RequireEmployee({ children }) {
  const s = getSession();
  if (s.type !== "employee") return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const s = getSession();
  if (s.type !== "admin") return <Navigate to="/login" replace />;
  return children;
}

function RequireTeamLeader({ children }) {
  const s = getSession();
  if (s.type !== "team_leader") return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const session = getSession(); // ✅ read session once for TopNav

  return (
    <LanguageProvider>
      <TopNav session={session} /> {/* ✅ pass session */}
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/employee/signup" element={<EmployeeSignup />} />
        <Route
          path="/employee/dashboard"
          element={
            <RequireEmployee>
              <EmployeeDashboard />
            </RequireEmployee>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />

        <Route
          path="/team-leader/dashboard"
          element={
            <RequireTeamLeader>
              <TeamLeaderDashboard />
            </RequireTeamLeader>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LanguageProvider>
  );
}
