const DB_KEYS = {
  ATT: "tronxlabs_attendance_v5",
  SESS: "tronxlabs_session_v5",
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * User management is now handled by Supabase via supabase.js
 */
export function getUsers() {
  console.warn("getUsers() should use supabase.js - calling getAllUsers()");
  return [];
}
export function setUsers(users) {
  console.warn("setUsers() should use supabase.js - calling addUser()");
}

// Local attendance storage (for offline capability)
export function getAttendance() {
  return loadJSON(DB_KEYS.ATT, []);
}
export function setAttendance(rows) {
  saveJSON(DB_KEYS.ATT, rows);
}

// Session management
export function getSession() {
  return loadJSON(DB_KEYS.SESS, { type: null, userId: null });
}
export function setSession(sess) {
  saveJSON(DB_KEYS.SESS, sess);
}

export function resetDemo() {
  localStorage.removeItem(DB_KEYS.ATT);
  localStorage.removeItem(DB_KEYS.SESS);
}
