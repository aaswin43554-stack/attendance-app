/**
 * Formats an ISO date string into Bangkok time (Asia/Bangkok)
 * using a 24-hour format: DD MMM YYYY, HH:mm
 * 
 * @param {string} iso - ISO date string
 * @returns {string} Formatted date string
 */
export function formatBangkokTime(iso) {
    if (!iso) return "—";
    try {
        let dateToParse = iso;

        // If it's a string from a database that might have stripped the 'Z' or offset
        // and doesn't contain any timezone info, we force it to be treated as UTC
        if (typeof iso === 'string' && !iso.includes('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(iso)) {
            // Replace space with T for ISO compliance and append Z
            dateToParse = iso.replace(' ', 'T') + 'Z';
        }

        const date = new Date(dateToParse);

        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.error("Invalid date encountered:", iso);
            return iso;
        }

        return new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Bangkok",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(date).replace(",", "");
    } catch (error) {
        console.error("Error formatting Bangkok time:", error);
        return iso;
    }
}

/**
 * Fetches the current time from a network service (WorldTimeAPI)
 * to ensure accuracy regardless of the client's system clock.
 * Falls back to local system time if the network request fails.
 * 
 * @returns {Promise<string>} ISO date string
 */
export async function getNetworkTime() {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

        const res = await fetch("https://worldtimeapi.org/api/timezone/Asia/Bangkok", {
            signal: controller.signal
        });
        clearTimeout(id);

        if (res.ok) {
            const data = await res.json();
            // Using unixtime (seconds) and converting to milliseconds for JS Date
            // This ensures we get a clean UTC ISO string regardless of offsets
            const date = new Date(data.unixtime * 1000);
            const iso = date.toISOString();
            console.log("🌐 Network time fetched (UTC):", iso);
            return iso;
        }
        throw new Error("Network time response not OK");
    } catch (error) {
        console.warn("⚠️ Network time unavailable, falling back to local clock:", error.message);
        return new Date().toISOString();
    }
}

/**
 * Gets the current time in Bangkok as an ISO string
 * @deprecated Use getNetworkTime() for more reliability
 * @returns {string} ISO string
 */
export function getBangkokISO() {
    return new Date().toISOString();
}
