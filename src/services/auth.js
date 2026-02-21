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
    // Check if email already exists
    const exists = await userExists(e);
    if (exists) throw new Error("Email already exists.");

    // Add user to Google Sheet
    const user = {
      id: crypto.randomUUID(), // Generate a valid UUID for Supabase primary keys
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

export async function resetPassword(email) {
  const e = email.trim().toLowerCase();
  try {
    // We still check if the user exists in our DB first
    const user = await getUserByEmail(e);
    if (!user) throw new Error("No account found with this email.");
    return user;
  } catch (error) {
    throw new Error(error.message || "Reset failed");
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
    // We update the password directly in your custom users table
    // (Bypassing Supabase Auth since we used our own OTP logic)
    await updateUserPassword(email, newPass);
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
