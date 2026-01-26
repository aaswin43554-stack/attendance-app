import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TopNav from "./ui/TopNav";

import EmployeeLogin from "./pages/employee/EmployeeLogin";
import EmployeeSignup from "./pages/employee/EmployeeSignup";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";

import { getSession } from "./services/storage";

function RequireEmployee({ children }) {
  const s = getSession();
  if (s.type !== "employee") return <Navigate to="/employee/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const s = getSession();
  if (s.type !== "admin") return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <TopNav />
      <Routes>
        <Route path="/" element={<Navigate to="/employee/login" replace />} />

        <Route path="/employee/login" element={<EmployeeLogin />} />
        <Route path="/employee/signup" element={<EmployeeSignup />} />
        <Route
          path="/employee/dashboard"
          element={
            <RequireEmployee>
              <EmployeeDashboard />
            </RequireEmployee>
          }
        />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
