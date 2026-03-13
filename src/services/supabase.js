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
        id: user.id, // Ensure ID is passed
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

/**
 * Update user password
 */
export async function updateUserPassword(email, newPassword) {
  try {
    console.log("🔐 Updating password for:", email);

    const { data, error } = await supabase
      .from("users")
      .update({ password: newPassword })
      .eq("email", email.toLowerCase());

    if (error) {
      console.error("❌ Error updating password:", error);
      throw error;
    }

    console.log("✅ Password updated successfully");
    return true;
  } catch (error) {
    console.error("❌ Error updating user password:", error);
    throw error;
  }
}

/**
 * Update user role
 */
export async function updateUserRole(email, role) {
  try {
<<<<<<< HEAD
    if (!email || !role) {
      console.error("❌ Missing params for updateRole:", { email, role });
      throw new Error("Missing email or role for update");
    }

    console.log(`📤 Updating role for ${email} to ${role}...`);

    const { data, error } = await supabase
      .from("users")
      .update({ role })
      .eq("email", email.toLowerCase())
      .select();

    if (error) {
      console.error("❌ Supabase update error:", error);
      throw error;
    }

    console.log("✅ Role updated in DB:", data);
    return true;
  } catch (error) {
    if (error.message === "Failed to fetch" || error.message.includes("fetch")) {
      console.warn("💡 Caught 'Failed to fetch'. This is likely a CORS, Adblocker, or Firewall issue blocking PATCH requests.");
      console.log("🔄 Attempting to update role via backend proxy...");
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
      const proxyRes = await fetch(`${backendUrl}/api/update-user-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role })
      });
      
      if (!proxyRes.ok) {
        const errText = await proxyRes.text();
        throw new Error(`Proxy update failed: ${errText}`);
      }
      return true;
    }
    console.error("❌ Error updating role:", error.message || error);
=======
    const { data, error } = await supabase
      .from("users")
      .update({ role })
      .eq("email", email.toLowerCase());

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("❌ Error updating role:", error);
>>>>>>> e686269b2721cd109499271ae76dc0e37d67115f
    throw error;
  }
}

/**
 * Assign employee to a team leader
 */
export async function assignEmployeeToLeader(employeeEmail, leaderEmail) {
  try {
<<<<<<< HEAD
    if (!employeeEmail) throw new Error("Missing employee email");

    console.log(`📤 Assigning ${employeeEmail} to manager ${leaderEmail || "None"}...`);

    const { data, error } = await supabase
      .from("users")
      .update({ managed_by: leaderEmail })
      .eq("email", employeeEmail.toLowerCase())
      .select();

    if (error) {
      console.error("❌ Supabase assignment error:", error);
      throw error;
    }

    console.log("✅ Manager assigned in DB:", data);
    return true;
  } catch (error) {
    if (error.message === "Failed to fetch" || error.message.includes("fetch")) {
      console.warn("💡 Caught 'Failed to fetch'. This is likely a CORS, Adblocker, or Firewall issue blocking PATCH requests.");
      console.log("🔄 Attempting to assign manager via backend proxy...");
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
      const proxyRes = await fetch(`${backendUrl}/api/assign-manager`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: employeeEmail, managerEmail: leaderEmail })
      });
      
      if (!proxyRes.ok) {
        const errText = await proxyRes.text();
        throw new Error(`Proxy update failed: ${errText}`);
      }
      return true;
    }
    console.error("❌ Error assigning employee:", error.message || error);
=======
    const { data, error } = await supabase
      .from("users")
      .update({ managed_by: leaderEmail })
      .eq("email", employeeEmail.toLowerCase());

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("❌ Error assigning employee:", error);
>>>>>>> e686269b2721cd109499271ae76dc0e37d67115f
    throw error;
  }
}

/**
 * Get all employees managed by a team leader
 */
export async function getEmployeesByLeader(leaderEmail) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("managed_by", leaderEmail.toLowerCase())
      .eq("role", "employee")
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching managed employees:", error);
    throw error;
  }
}

// ============ ATTENDANCE TRACKING ============

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
 * Record multiple attendance records in a single batch
 */
export async function recordBatchAttendance(records) {
  try {
    console.log(`📤 Sending batch of ${records.length} to Supabase...`);
    const { data, error } = await supabase
      .from("attendance")
      .insert(records);

    if (error) {
      console.error("❌ Supabase Batch Error:", error);
      throw error;
    }

    console.log("✅ Successfully saved batch to Supabase");
    return true;
  } catch (error) {
    console.error("❌ Error recording batch attendance:", error.message);
    throw new Error("Failed to record batch attendance: " + error.message);
  }
}

/**
 * Get all attendance records for a user from Supabase
 */
export async function getUserAttendanceRecords(userName) {
  try {
    // Fetch records for the user OR workers managed by the user
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .or(`userName.eq."${userName}",userName.ilike."Worker % (via ${userName})%"`)
      .order("time", { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      // If userId is missing (old records or worker records), try to derive it or use a default
      userId: r.userId || (r.userName.includes(" (via ") ? r.userName.replace(/\s+/g, '_') : userName),
      device: typeof r.device === 'string' ? JSON.parse(r.device) : r.device
    }));
  } catch (error) {
    console.error("Error fetching attendance records:", error.message);
    throw new Error("Failed to fetch attendance records");
  }
}

/**
 * Get all attendance records for a specific date (handled in Bangkok timezone)
 */
export async function getAttendanceByDate(date) {
  try {
    // Create Date objects for start and end of day in Bangkok
    // We target the date provided, but shifted to Bangkok's perspective
    const d = new Date(date);

    // Start of day in Bangkok
    const startOfDay = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    startOfDay.setHours(0, 0, 0, 0);

    // End of day in Bangkok
    const endOfDay = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    endOfDay.setHours(23, 59, 59, 999);

    // Convert back to UTC for the query
    // This part is tricky because toLocaleString might not be the most reliable for conversion back to UTC
    // A better way is using Intl.DateTimeFormat parts or manually calculating offset
    // For now, let's keep it simple as the DB records are ISO UTC.

    // Actually, simpler approach for "Today" queries often needed in Apps:
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
