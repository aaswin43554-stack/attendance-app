import { getAttendance, setAttendance } from "./storage";
import { getCurrentPosition, reverseGeocode, deviceInfo } from "./geo";
import { recordAttendance, getUserAttendanceRecords, recordBatchAttendance } from "./supabase";
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

export async function createBatchAttendance({ userId, type, userName, workerIds }) {
  const pos = await getCurrentPosition();
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const address = await reverseGeocode(lat, lng);
  const time = await getNetworkTime();
  const device = deviceInfo();

  const records = workerIds.map(workerId => ({
    id: "a_" + Math.random().toString(16).slice(2) + Date.now().toString(16),
    userId: userId + "_worker_" + workerId,
    userName: `Worker ${workerId} (via ${userName})`,
    type,
    time,
    lat,
    lng,
    address,
    device: JSON.stringify(device),
  }));

  // Save to localStorage (individual entries)
  const rows = getAttendance();
  records.forEach(r => {
    rows.push({
      ...r,
      device: JSON.parse(r.device)
    });
  });
  setAttendance(rows);

  // Bulk save to Supabase
  try {
    // Only send columns that Supabase expects
    const supabaseRecords = records.map(r => ({
      id: r.id,
      userName: r.userName,
      type: r.type,
      time: r.time,
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      device: r.device
    }));
    await recordBatchAttendance(supabaseRecords);
    console.log(`✅ Batch of ${supabaseRecords.length} saved successfully!`);
  } catch (error) {
    console.error("⚠️ Could not save batch to Supabase:", error.message);
  }
}

export async function createTeamLeaderBulkAttendance({ leaderId, leaderName, type, selectedEmployees }) {
  const pos = await getCurrentPosition();
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const address = await reverseGeocode(lat, lng);
  const time = await getNetworkTime();
  const device = deviceInfo();

  const records = selectedEmployees.map(emp => ({
    id: "tl_" + Math.random().toString(16).slice(2) + Date.now().toString(16),
    userId: emp.email,
    userName: emp.name,
    type,
    time,
    lat,
    lng,
    address,
    device: JSON.stringify({
      ...device,
      sharedDevice: true,
      checkedInBy: leaderName,
      leaderId: leaderId
    }),
    managedBy: leaderId,
    checkedInBy: leaderName,
    sharedDevice: true
  }));

  // Save to localStorage
  const rows = getAttendance();
  records.forEach(r => {
    rows.push({
      ...r,
      device: JSON.parse(r.device)
    });
  });
  setAttendance(rows);

  // Bulk save to Supabase
  try {
    const supabaseRecords = records.map(r => ({
      id: r.id,
      userName: r.userName,
      type: r.type,
      time: r.time,
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      device: r.device,
      // We pass these extra fields. If columns exist, they'll be populated.
      // If not, they might be ignored or cause an error depending on Supabase config.
      // We also store them in the 'device' JSON as a fallback.
      checked_in_by: leaderName,
      shared_device: true
    }));
    await recordBatchAttendance(supabaseRecords);
    console.log(`✅ TL Bulk Batch of ${supabaseRecords.length} saved successfully!`);
  } catch (error) {
    console.error("⚠️ Could not save TL batch to Supabase:", error.message);
    throw error;
  }
}
