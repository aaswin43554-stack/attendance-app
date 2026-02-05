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
 * Parses a date string and ensures it's treated as UTC if no timezone is provided.
 * This prevents browsers from interpreting DB timestamps as local time.
 * 
 * @param {string|Date} dateVal - Date string or object
 * @returns {Date} Parsed Date object
 */
export function parseISO(dateVal) {
    if (dateVal instanceof Date) return dateVal;
    if (!dateVal) return new Date();

    let str = String(dateVal);
    // If no timezone info, treat as UTC
    if (!str.includes('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(str)) {
        str = str.replace(' ', 'T') + 'Z';
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Returns a YYYY-MM-DD string representing the date in Bangkok timezone.
 * 
 * @param {Date} date 
 * @returns {string} 
 */
export function getBangkokYMD(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(date);
    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Gets the current time in Bangkok as an ISO string
 * @deprecated Use getNetworkTime() for more reliability
 * @returns {string} ISO string
 */
export function getBangkokISO() {
    return new Date().toISOString();
}
