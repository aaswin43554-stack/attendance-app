export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Geolocation is not supported by this browser."));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { accuracy } = position.coords;
        console.log("✅ GPS location acquired. Accuracy:", accuracy, "meters");

        if (accuracy > 1000) {
          console.warn("⚠️ Low accuracy detected (>1km). This might be IP-based location.");
        }

        resolve(position);
      },
      (error) => {
        let msg = "Failed to get location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = "Location permission denied. Please enable GPS and allow access.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg = "Location information is unavailable. Check your GPS signal.";
            break;
          case error.TIMEOUT:
            msg = "Location request timed out. Try again in an open area.";
            break;
        }
        console.error("❌ GPS Error:", msg, error);
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout to 15s
        maximumAge: 0   // Force fresh location
      }
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
