const TIMEZONE_STORAGE_KEY = "ui.defaultTimezone";
const TIMEZONE_EVENT = "timezonechange";
let cachedTimezone: string | null = null;
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
export function setCachedTimezone(timezone: string | null): void {
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
export async function initDefaultTimezone(fetcher: () => Promise<string | null>): Promise<void> {
    try {
        const tz = await fetcher();
        if (tz)
            setCachedTimezone(tz);
    }
    catch {
        // best-effort only
    }
}
export function listTimezones(): string[] {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
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
  if (!unique.includes("UTC")) unique.unshift("UTC");
  return unique;
}
export function formatDateTime(value: string | number | Date): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return String(value);
    const tz = getCachedTimezone();
    return d.toLocaleString(undefined, tz ? { timeZone: tz } : undefined);
}
export function onTimezoneChange(handler: () => void): () => void {
    if (typeof window === "undefined")
        return () => { };
    const listener = () => handler();
    window.addEventListener(TIMEZONE_EVENT, listener);
    return () => window.removeEventListener(TIMEZONE_EVENT, listener);
}
