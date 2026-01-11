const TIMEZONE_STORAGE_KEY = "ui.defaultTimezone";
const TIME_FORMAT_STORAGE_KEY = "ui.defaultTimeFormat";
const TIMEZONE_EVENT = "timezonechange";
const TIME_FORMAT_EVENT = "timeformatchange";
const DEFAULT_TIME_FORMAT = "ddmmyyyy";
let cachedTimezone = null;
let cachedTimeFormat = null;
export function getCachedTimezone() {
    if (cachedTimezone)
        return cachedTimezone;
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (stored) {
        cachedTimezone = stored;
        return stored;
    }
    return null;
}
export function setCachedTimezone(timezone) {
    cachedTimezone = timezone && timezone.trim() ? timezone.trim() : null;
    if (cachedTimezone) {
        localStorage.setItem(TIMEZONE_STORAGE_KEY, cachedTimezone);
    }
    else {
        localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(TIMEZONE_EVENT, { detail: cachedTimezone }));
    }
}
export async function initDefaultTimezone(fetcher) {
    try {
        const tz = await fetcher();
        if (tz)
            setCachedTimezone(tz);
    }
    catch {
        // best-effort only
    }
}
export function getCachedTimeFormat() {
    if (cachedTimeFormat)
        return cachedTimeFormat;
    const stored = localStorage.getItem(TIME_FORMAT_STORAGE_KEY);
    if (stored) {
        cachedTimeFormat = stored;
        return stored;
    }
    return null;
}
export function setCachedTimeFormat(format) {
    cachedTimeFormat = format && format.trim() ? format.trim() : null;
    if (cachedTimeFormat) {
        localStorage.setItem(TIME_FORMAT_STORAGE_KEY, cachedTimeFormat);
    }
    else {
        localStorage.removeItem(TIME_FORMAT_STORAGE_KEY);
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(TIME_FORMAT_EVENT, { detail: cachedTimeFormat }));
    }
}
export async function initDefaultTimeFormat(fetcher) {
    try {
        const fmt = await fetcher();
        if (fmt)
            setCachedTimeFormat(fmt);
        else
            setCachedTimeFormat(DEFAULT_TIME_FORMAT);
    }
    catch {
        // best-effort only
    }
}
export function listTimezones() {
    const supportedValuesOf = Intl.supportedValuesOf;
    const supported = supportedValuesOf ? supportedValuesOf("timeZone") : null;
    const fallback = [
        "UTC",
        "Etc/UTC",
        "Asia/Ho_Chi_Minh",
        "Asia/Bangkok",
        "Asia/Tokyo",
        "Asia/Seoul",
        "Asia/Shanghai",
        "Europe/London",
        "Europe/Paris",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles"
    ];
    const tzs = Array.isArray(supported) && supported.length ? supported : fallback;
    const merged = [...fallback, ...tzs];
    const unique = Array.from(new Set(merged));
    if (!unique.includes("UTC"))
        unique.unshift("UTC");
    return unique;
}
const TIME_FORMAT_OPTIONS = [
    {
        id: "ddmmyyyy",
        label: "dd/mm/yyyy hh:mm:ss z",
        description: "Day-first 24-hour clock with timezone"
    },
    {
        id: "mmddyyyy",
        label: "mm/dd/yyyy hh:mm:ss z",
        description: "Month-first (US-style) date with 24-hour clock"
    },
    {
        id: "iso",
        label: "yyyy-mm-dd hh:mm:ss z",
        description: "ISO-style date with 24-hour clock"
    }
];
function getDateParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        hour12: false,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: timeZone ?? undefined,
        timeZoneName: "short"
    });
    const parts = formatter.formatToParts(date);
    const lookup = {};
    for (const part of parts) {
        if (part.type !== "literal" && part.type !== "dayPeriod") {
            lookup[part.type] = part.value;
        }
    }
    return {
        day: lookup.day ?? "",
        month: lookup.month ?? "",
        year: lookup.year ?? "",
        hour: lookup.hour ?? "",
        minute: lookup.minute ?? "",
        second: lookup.second ?? "",
        timeZoneName: lookup.timeZoneName ?? timeZone ?? ""
    };
}
export function listTimeFormats() {
    return TIME_FORMAT_OPTIONS;
}
export function getTimeFormatLabel(id) {
    return TIME_FORMAT_OPTIONS.find((option) => option.id === id)?.label ?? TIME_FORMAT_OPTIONS[0].label;
}
export function getTimeFormatById(id) {
    return TIME_FORMAT_OPTIONS.find((option) => option.id === id) ?? TIME_FORMAT_OPTIONS[0];
}
function formatWithOption(formatId, date, timeZone) {
    const { day, month, year, hour, minute, second, timeZoneName } = getDateParts(date, timeZone ?? undefined);
    switch (formatId) {
        case "mmddyyyy":
            return `${month}/${day}/${year} ${hour}:${minute}:${second} ${timeZoneName}`.trim();
        case "iso":
            return `${year}-${month}-${day} ${hour}:${minute}:${second} ${timeZoneName}`.trim();
        case "ddmmyyyy":
        default:
            return `${day}/${month}/${year} ${hour}:${minute}:${second} ${timeZoneName}`.trim();
    }
}
export function formatDateTime(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return String(value);
    const tz = getCachedTimezone();
    const formatId = getCachedTimeFormat() ?? DEFAULT_TIME_FORMAT;
    return formatWithOption(formatId, d, tz);
}
export function onTimezoneChange(handler) {
    if (typeof window === "undefined")
        return () => { };
    const listener = () => handler();
    window.addEventListener(TIMEZONE_EVENT, listener);
    return () => window.removeEventListener(TIMEZONE_EVENT, listener);
}
export function onTimeFormatChange(handler) {
    if (typeof window === "undefined")
        return () => { };
    const listener = () => handler();
    window.addEventListener(TIME_FORMAT_EVENT, listener);
    return () => window.removeEventListener(TIME_FORMAT_EVENT, listener);
}
