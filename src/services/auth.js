import { getUsers, setUsers, setSession } from "./storage";
import {
  supabase,
  addUser,
  getUserByEmailAndPassword,
  getUserByEmail,
  updateUserPassword,
  userExists,
} from "./supabase";

/**
 * Supabase Authentication
 * - User data stored in Supabase database
 * - Passwords stored securely in database (consider hashing in production)
 * - Sessions managed via localStorage
 */

export async function signupEmployee({ name, phone, email, pass }) {
  if (!name || !email || !pass || !phone) throw new Error("Please fill name, phone, email, password.");

  const e = email.trim().toLowerCase();

  try {
    // Check if email already exists in custom DB
    const exists = await userExists(e);
    if (exists) throw new Error("Email already exists.");

    // 1. Create user in Supabase Auth (for future password resets)
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: e,
      password: pass,
      options: {
        data: { name: name.trim() }
      }
    });

    if (authErr) {
      // If user already exists in Auth but not in our DB, we might want to handle it, 
      // but for now we'll just throw the error.
      throw new Error(authErr.message);
    }

    // 2. Add user to custom table
    const user = {
      id: authData.user?.id || crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim(),
      email: e,
      pass,
      role: "employee",
      createdAt: new Date().toISOString(),
    };

    await addUser(user);
    return user;
  } catch (error) {
    throw new Error(error.message || "Signup failed");
  }
}

export async function resetPasswordLookup(email) {
  const e = email.trim().toLowerCase();
  try {
    // We still check if the user exists in our DB first
    const user = await getUserByEmail(e);
    if (!user) throw new Error("No account found with this email.");
    return user;
  } catch (error) {
    throw new Error(error.message || "Email lookup failed");
  }
}

/**
 * Native Supabase Auth Reset Flow with Backend Fallback & Logging
 */
export async function requestPasswordReset(email) {
  const e = email.trim().toLowerCase();
  console.log("🚀 Initiating password reset for:", e);

  try {
    // 1. Primary: Try native Supabase client-side reset
    const { data, error } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: "https://attendance-app-i868.onrender.com/reset-password",
    });

    if (error) {
      console.warn("⚠️ Supabase Native Reset Error:", error.message);
      // Don't throw yet, try fallback
    } else {
      console.log("✅ Supabase reported success for native reset request.");
      // We still fall back or alert user because often it returns success but doesn't send
      // But for now, if no error, we'll assume it worked unless we want to force fallback.
      return data;
    }
  } catch (err) {
    console.error("❌ Exception in native reset:", err.message);
  }

  // 2. Fallback: Trigger backend recovery link via Resend
  console.log("🔄 Attempting backend fallback...");
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
  const endpoint = `${apiBaseUrl}/api/auth/send-recovery-link`.replace(/([^:])\/\//g, '$1/');

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Fallback failed: ${response.status}`);
    }

    console.log("✅ Fallback recovery link sent successfully.");
    return result;
  } catch (fallbackErr) {
    console.error("❌ Fallback system also failed:", fallbackErr.message);
    throw new Error(`Auth Error: All reset attempts failed. ${fallbackErr.message}`);
  }
}

/**
 * Custom OTP Reset Flow
 */
/**
 * Custom OTP Reset Flow (Production Robust Version)
 */
export async function requestCustomOTPReset(email) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
  const endpoint = `${apiBaseUrl}/api/auth/request-reset`.replace(/([^:])\/\//g, '$1/');
  const cleanEmail = String(email || "").trim().toLowerCase();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || "Failed to request reset code");
    }
    return data;
  } catch (err) {
    console.error("❌ requestCustomOTPReset Error:", err);
    throw err;
  }
}

export async function verifyCustomOTPReset(email, otp, newPassword) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
  const endpoint = `${apiBaseUrl}/api/auth/verify-reset`.replace(/([^:])\/\//g, '$1/');
  const cleanEmail = String(email || "").trim().toLowerCase();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        otp: String(otp).trim(),
        newPassword
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || "Verification failed");
    }
    return data;
  } catch (err) {
    console.error("❌ verifyCustomOTPReset Error:", err);
    throw err;
  }
}

export async function verifyLastPassword(email, lastPass) {
  try {
    const user = await getUserByEmailAndPassword(email, lastPass);
    if (!user) return false;
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Sends a custom OTP via our backend server
 */
/**
 * Generate and Send OTP (Bulletproof Production Version)
 */
export async function sendOTP(email) {
  // Use VITE_API_BASE_URL if provided (preferred for Render/Vercel)
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";

  // Endpoint suffix
  const endpoint = `${apiBaseUrl}/api/auth/send-reset-otp`.replace(/([^:])\/\//g, '$1/');
  console.log("🚀 Requesting OTP from:", endpoint);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || `Server error: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("❌ sendOTP Error:", error);
    throw new Error(`OTP Error: ${error.message}`);
  }
}

/**
 * Verifies the hashed OTP (Bulletproof Production Version)
 */
export async function verifyOTPCode(email, otp) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
  const endpoint = `${apiBaseUrl}/api/auth/verify-reset-otp`.replace(/([^:])\/\//g, '$1/');

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        otp: otp.trim()
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || "Invalid or expired code");
    }

    return true; // Return true as expected by the existing frontend logic
  } catch (error) {
    console.error("❌ verifyOTPCode Error:", error);
    throw new Error(error.message);
  }
}

/**
 * Updates the password directly in the 'users' table
 */
export async function updatePassword(email, newPass) {
  try {
    // 1. Update in custom users table (for fallback/legacy logic)
    await updateUserPassword(email, newPass);

    // 2. If we are in a session (e.g. from recovery link), update Supabase Auth too
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) console.error("Supabase Auth update error:", error.message);
    }

    return true;
  } catch (error) {
    throw new Error(error.message || "Failed to update password");
  }
}

export async function loginEmployee({ email, pass }) {
  const e = email.trim().toLowerCase();

  try {
    const user = await getUserByEmailAndPassword(e, pass);
    if (!user) throw new Error("Invalid credentials.");

    if (user.role !== "employee") {
      throw new Error("Invalid credentials.");
    }

    setSession({ type: "employee", userId: user.email, userName: user.name });
    return {
      id: user.email,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    throw new Error(error.message || "Invalid credentials.");
  }
}

export function logoutEmployee() {
  setSession({ type: null, userId: null });
}

/**
 * Admin Login
 * Admins are stored in Supabase with role="admin"
 */
export async function loginAdmin({ email, pass }) {
  const e = email.trim().toLowerCase();

  try {
    const user = await getUserByEmailAndPassword(e, pass);
    if (!user) throw new Error("Invalid admin credentials.");

    if (user.role !== "admin") {
      throw new Error("Invalid admin credentials.");
    }

    setSession({ type: "admin", userId: user.email, userName: user.name });
    return {
      id: user.email,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    throw new Error(error.message || "Invalid admin credentials.");
  }
}

export async function login({ email, pass }) {
  const e = email.trim().toLowerCase();

  try {
    const user = await getUserByEmailAndPassword(e, pass);
    if (!user) throw new Error("Invalid credentials.");

    setSession({ type: user.role, userId: user.email, userName: user.name });
    return {
      id: user.email,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    throw new Error(error.message || "Invalid credentials.");
  }
}

export function logout() {
  setSession({ type: null, userId: null });
}
