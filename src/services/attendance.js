import { getAttendance, setAttendance } from "./storage";
import { getCurrentPosition, reverseGeocode, deviceInfo } from "./geo";
import { recordAttendance, getUserAttendanceRecords } from "./supabase";
import { getNetworkTime } from "../utils/date";

export async function latestStatusFor(userName) {
  try {
    const rows = await getUserAttendanceRecords(userName);
    const latest = rows[0];
    if (!latest) return { status: "Not working", latest: null };
    return { status: latest.type === "checkin" ? "Working" : "Not working", latest };
  } catch (error) {
    console.error("Error in latestStatusFor:", error);
    return { status: "Not working", latest: null };
  }
}

export async function getUserLogs(userName) {
  try {
    return await getUserAttendanceRecords(userName);
  } catch (error) {
    console.error("Error in getUserLogs:", error);
    return [];
  }
}

export async function createAttendance({ userId, type, userName }) {
  const pos = await getCurrentPosition();
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const address = await reverseGeocode(lat, lng);

  const record = {
    id: "a_" + Math.random().toString(16).slice(2) + Date.now().toString(16),
    userId,
    userName,
    type, // checkin / checkout
    time: await getNetworkTime(),
    lat,
    lng,
    address,
    device: deviceInfo(),
  };

  // Save to localStorage
  const rows = getAttendance();
  rows.push(record);
  setAttendance(rows);

  // Also save to Supabase
  try {
    console.log("🔄 Saving attendance record...");
    await recordAttendance({
      id: record.id,
      userName: userName || "Unknown",
      type: record.type,
      time: record.time,
      address: record.address || "Location unavailable",
      lat: record.lat,
      lng: record.lng,
      device: JSON.stringify(record.device),
    });
    console.log("✅ Attendance saved successfully!");
  } catch (error) {
    console.error("⚠️ Could not save to Supabase:", error.message);
    // Still saved to localStorage, so continue
  }
}
