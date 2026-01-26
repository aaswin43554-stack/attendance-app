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

// ============ USER AUTHENTICATION ============

/**
 * Get all users from Supabase
 */
export async function getAllUsers() {
  try {
    console.log("📥 Fetching users from Supabase...");

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("❌ Supabase users fetch error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("✅ Users fetched successfully:", data?.length || 0, "users");
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching users from Supabase:", error.message);
    console.error("Full error:", error);
    throw new Error("Failed to fetch users from database: " + error.message);
  }
}

/**
 * Add new user to Supabase
 */
export async function addUser(user) {
  try {
    console.log("➕ Adding new user:", user.email);

    const { data, error } = await supabase.from("users").insert([
      {
        email: user.email,
        password: user.pass,
        name: user.name,
        phone: user.phone || "",
        role: user.role,
        createdAt: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("❌ Error adding user:", error);
      throw new Error(error.message);
    }

    console.log("✅ User created successfully:", user.email);
    return true;
  } catch (error) {
    console.error("❌ Error adding user to Supabase:", error.message);
    throw new Error(error.message || "Failed to create user");
  }
}

/**
 * Check if user with email exists
 */
export async function userExists(email) {
  try {
    console.log("🔍 Checking if user exists:", email);

    const { data, error } = await supabase
      .from("users")
      .select("email")
      .eq("email", email.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("❌ Error checking user existence:", error);
      throw error;
    }

    const exists = !!data;
    console.log(exists ? "⚠️ User exists" : "✅ User does not exist");
    return exists;
  } catch (error) {
    console.error("❌ Error checking user existence:", error);
    throw error;
  }
}

/**
 * Get user by email and password
 */
export async function getUserByEmailAndPassword(email, password) {
  try {
    console.log("🔐 Authenticating user:", email);

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("password", password)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("❌ Auth error:", error);
      throw error;
    }

    if (data) {
      console.log("✅ User authenticated:", data.name);
    } else {
      console.log("❌ Invalid credentials");
    }

    return data || null;
  } catch (error) {
    console.error("❌ Error finding user:", error);
    throw error;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email) {
  try {
    console.log("👤 Fetching user:", email);

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("❌ Error finding user:", error);
      throw error;
    }

    if (data) {
      console.log("✅ User found:", data.name);
    } else {
      console.log("❌ User not found");
    }

    return data || null;
  } catch (error) {
    console.error("❌ Error finding user by email:", error);
    throw error;
  }
}

// ============ ATTENDANCE TRACKING ============

/**
 * Record attendance (check-in or check-out) to Supabase
 */
export async function recordAttendance(attendanceRecord) {
  try {
    console.log("📤 Sending to Supabase:", attendanceRecord);

    const { data, error } = await supabase
      .from("attendance")
      .insert([attendanceRecord]);

    if (error) {
      console.error("❌ Supabase Error:", error);
      throw error;
    }

    console.log("✅ Successfully saved to Supabase:", data);
    return true;
  } catch (error) {
    console.error("❌ Error recording attendance:", error.message);
    console.error("Full error object:", error);
    throw new Error("Failed to record attendance: " + error.message);
  }
}

/**
 * Get all attendance records for a user from Supabase
 */
export async function getUserAttendanceRecords(userName) {
  try {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("userName", userName)
      .order("time", { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      device: typeof r.device === 'string' ? JSON.parse(r.device) : r.device
    }));
  } catch (error) {
    console.error("Error fetching attendance records:", error.message);
    throw new Error("Failed to fetch attendance records");
  }
}

/**
 * Get all attendance records for a specific date
 */
export async function getAttendanceByDate(date) {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .gte("time", startOfDay.toISOString())
      .lte("time", endOfDay.toISOString())
      .order("time", { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      device: typeof r.device === 'string' ? JSON.parse(r.device) : r.device
    }));
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
    return (data || []).map(r => ({
      ...r,
      device: typeof r.device === 'string' ? JSON.parse(r.device) : r.device
    }));
  } catch (error) {
    console.error("Error fetching all attendance records:", error.message);
    throw error;
  }
}
