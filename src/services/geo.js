export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.warn("⚠️ Geolocation not available, using mock location");
      return resolve({
        coords: {
          latitude: 28.6139,
          longitude: 77.2090,
          accuracy: 10
        }
      });
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("✅ Real GPS location:", position.coords);
        resolve(position);
      },
      (error) => {
        console.warn("❌ GPS Error:", error.message);
        console.log("📍 Using mock location as fallback");
        resolve({
          coords: {
            latitude: 28.6139,
            longitude: 77.2090,
            accuracy: 10
          }
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    return data.display_name || "";
  } catch {
    return "";
  }
}

export function deviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || "",
    language: navigator.language || "",
  };
}
