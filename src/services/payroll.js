import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Stable unique key per employee.
 * Real employees  → their lowercase email
 * Virtual workers → "worker_<name_slug>"
 */
export function empKey(emp) {
  return emp.email && emp.email !== "Worker"
    ? emp.email.toLowerCase()
    : `worker_${emp.name.replace(/\s+/g, "_").toLowerCase()}`;
}

// ─── Rates ──────────────────────────────────────────────────────────────────

/**
 * Fetch all payroll rates from Supabase.
 * Returns { [employee_key]: { rate: number, type: string } }
 */
export async function getPayrollRates() {
  const { data, error } = await supabase
    .from("payroll_rates")
    .select("employee_key, rate, rate_type");

  if (error) throw error;

  const map = {};
  (data || []).forEach((row) => {
    map[row.employee_key] = { rate: Number(row.rate), type: row.rate_type };
  });
  return map;
}

/**
 * Upsert pay rates for every employee in the list.
 * Falls back to the Express proxy if direct Supabase is blocked.
 */
export async function savePayrollRates(employees, tempRates) {
  const records = employees.map((emp) => {
    const key = empKey(emp);
    const v = tempRates[key] || {};
    return {
      employee_key: key,
      employee_name: emp.name,
      employee_email: emp.email,
      rate_type: v.type || "hourly",
      rate: parseFloat(v.rate) || 0,
      updated_at: new Date().toISOString(),
    };
  });

  try {
    const { error } = await supabase
      .from("payroll_rates")
      .upsert(records, { onConflict: "employee_key" });

    if (error) throw error;
  } catch (err) {
    if (err.message?.includes("fetch") || err.message?.includes("Failed")) {
      const res = await fetch(`${BACKEND_URL}/api/payroll/save-rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Proxy: failed to save rates");
    } else {
      throw err;
    }
  }
}

// ─── Config (global deductions) ─────────────────────────────────────────────

/**
 * Fetch global deduction settings (single row, id=1).
 */
export async function getPayrollConfig() {
  const { data, error } = await supabase
    .from("payroll_config")
    .select("late_login_deduction, early_logout_deduction")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;

  return {
    lateLogin: Number(data?.late_login_deduction ?? 0),
    earlyLogout: Number(data?.early_logout_deduction ?? 0),
  };
}

/**
 * Upsert global deduction settings.
 * Falls back to Express proxy if blocked.
 */
export async function savePayrollConfig(lateLogin, earlyLogout) {
  const payload = {
    id: 1,
    late_login_deduction: lateLogin,
    early_logout_deduction: earlyLogout,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from("payroll_config")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;
  } catch (err) {
    if (err.message?.includes("fetch") || err.message?.includes("Failed")) {
      const res = await fetch(`${BACKEND_URL}/api/payroll/save-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lateLogin, earlyLogout }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Proxy: failed to save config");
    } else {
      throw err;
    }
  }
}
