import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Client Configuration
 * Handles all database operations for users and attendance records
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "❌ Supabase credentials missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("✅ Supabase client initialized");

/* -------------------- helpers -------------------- */
function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeDevice(device) {
  if (device == null) return null;
  if (typeof device === "string") return device;
  try {
    return JSON.stringify(device);
  } catch {
    return String(device);
  }
}

function mapDeviceField(row) {
  if (!row) return row;
  return {
    ...row,
    device: typeof row.device === "string" ? safeJsonParse(row.device) : row.device,
  };
}
/* ------------------------------------------------- */

// ============ USER AUTHENTICATION ============

export async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) throw new Error(`Database error: ${error.message}`);
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching users from Supabase:", error.message);
    throw new Error("Failed to fetch users from database: " + error.message);
  }
}

export async function addUser(user) {
  try {
    const { error } = await supabase.from("users").insert([
      {
        email: String(user.email || "").toLowerCase(),
        password: user.pass,
        name: user.name,
        phone: user.phone || "",
        role: user.role,
        createdAt: new Date().toISOString(),
      },
    ]);

    if (error) throw new Error(error.message);
    return true;
  } catch (error) {
    console.error("❌ Error adding user to Supabase:", error.message);
    throw new Error(error.message || "Failed to create user");
  }
}

export async function userExists(email) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("email")
      .eq("email", String(email || "").toLowerCase())
      .single();

    // PGRST116 = 0 rows
    if (error && error.code !== "PGRST116") throw error;
    return !!data;
  } catch (error) {
    console.error("❌ Error checking user existence:", error);
    throw error;
  }
}

export async function getUserByEmailAndPassword(email, password) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", String(email || "").toLowerCase())
      .eq("password", password)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data || null;
  } catch (error) {
    console.error("❌ Error finding user:", error);
    throw error;
  }
}

export async function getUserByEmail(email) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", String(email || "").toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data || null;
  } catch (error) {
    console.error("❌ Error finding user by email:", error);
    throw error;
  }
}

// ============ ATTENDANCE TRACKING ============

/**
 * Record attendance (check-in or check-out) to Supabase
 * expected keys:
 * userId(email), userName, type(checkin/checkout), time, lat, lng, address, device
 */
export async function recordAttendance(attendanceRecord) {
  try {
    const clean = {
      ...attendanceRecord,
      userId: attendanceRecord.userId
        ? String(attendanceRecord.userId).toLowerCase()
        : attendanceRecord.userId,
      time: attendanceRecord.time || new Date().toISOString(),
      device: normalizeDevice(attendanceRecord.device),
    };

    const { error } = await supabase.from("attendance").insert([clean]);
    if (error) throw error;

    return true;
  } catch (error) {
    console.error("❌ Error recording attendance:", error.message);
    throw new Error("Failed to record attendance: " + error.message);
  }
}

/**
 * ✅ Get attendance records for ONE user (by email/userId)
 */
export async function getUserAttendanceRecords(userId) {
  try {
    const uid = String(userId || "").toLowerCase();
    if (!uid) return [];

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("userId", uid)
      .order("time", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDeviceField);
  } catch (error) {
    console.error("Error fetching attendance records:", error.message);
    throw new Error("Failed to fetch attendance records");
  }
}

/**
 * ✅ Admin Monthly Summary (Present/Absent/Working Days)
 * presentDays = unique check-in dates in that month
 * absentDays = (Mon-Sat working days) - presentDays
 */
export async function getEmployeeMonthlySummary(userId, year, month) {
  try {
    const uid = String(userId || "").toLowerCase();
    if (!uid) return { presentDays: 0, absentDays: 0, totalWorkingDays: 0 };

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const { data, error } = await supabase
      .from("attendance")
      .select("time,type")
      .eq("userId", uid)
      .gte("time", start.toISOString())
      .lte("time", end.toISOString());

    if (error) throw error;

    const presentSet = new Set(
      (data || [])
        .filter((r) => r.type === "checkin")
        .map((r) => String(r.time).slice(0, 10))
    );

    const presentDays = presentSet.size;

    // Mon-Sat working days (exclude Sunday)
    const daysInMonth = new Date(year, month, 0).getDate();
    let totalWorkingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month - 1, d).getDay(); // 0 Sunday
      if (day !== 0) totalWorkingDays++;
    }

    const absentDays = Math.max(totalWorkingDays - presentDays, 0);

    return { presentDays, absentDays, totalWorkingDays };
  } catch (error) {
    console.error("Error fetching monthly summary:", error.message);
    throw new Error("Failed to fetch monthly summary");
  }
}

/**
 * Get all attendance records for a specific date (Bangkok timezone)
 */
export async function getAttendanceByDate(date) {
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid date");

    const bangkokDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d); // YYYY-MM-DD

    const startOfDay = new Date(`${bangkokDay}T00:00:00.000+07:00`);
    const endOfDay = new Date(`${bangkokDay}T23:59:59.999+07:00`);

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .gte("time", startOfDay.toISOString())
      .lte("time", endOfDay.toISOString())
      .order("time", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDeviceField);
  } catch (error) {
    console.error("Error fetching attendance by date:", error.message);
    throw error;
  }
}

/**
 * Get attendance records for all users
 */
export async function getAllAttendanceRecords() {
  try {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .order("time", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDeviceField);
  } catch (error) {
    console.error("Error fetching all attendance records:", error.message);
    throw error;
  }
}