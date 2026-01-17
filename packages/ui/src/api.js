const API_BASE = import.meta.env.VITE_API_BASE;
if (!API_BASE) {
    console.warn("VITE_API_BASE is not set; API calls will fail.");
}
const SESSION_KEY = "quiz_session_v2";
function saveSessionToken(token) {
    localStorage.setItem(SESSION_KEY, token);
}
export function getSessionToken() {
    return localStorage.getItem(SESSION_KEY);
}
export function clearSessionToken() {
    localStorage.removeItem(SESSION_KEY);
}
// Check if there's a session token in the URL fragment (passed by backend for local IP redirects)
// The fragment might look like #session=TOKEN or #/route?session=TOKEN
const hash = window.location.hash;
if (hash.includes("session=")) {
    const parts = hash.split("session=");
    if (parts.length > 1) {
        const tokenPart = parts[1].split("&")[0];
        if (tokenPart) {
            saveSessionToken(tokenPart);
            // Clean up the session bit from the hash while preserving the route
            let nextHash = hash.replace(new RegExp(`[?&]session=${tokenPart}`), "");
            // If it was just #session=TOKEN, replace it
            nextHash = nextHash.replace(new RegExp(`#session=${tokenPart}`), "#/");
            // Update hash without triggering a full page reload if possible
            if (window.history.pushState) {
                window.history.pushState(null, "", window.location.pathname + window.location.search + nextHash);
            }
            else {
                window.location.hash = nextHash;
            }
        }
    }
}
export async function apiFetch(path, init) {
    const token = getSessionToken();
    const headers = new Headers(init?.headers);
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        ...init,
        headers
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
    }
    if (init?.parseJson === false) {
        return undefined;
    }
    return (await res.json());
}
export async function getSession() {
    const data = await apiFetch("/auth/me");
    return data.session;
}
export async function logout() {
    await apiFetch("/auth/logout", { method: "POST", parseJson: false });
    clearSessionToken();
}
export async function loginGoogle(idToken) {
    const data = await apiFetch("/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
    });
    return data.user;
}
export async function loginAnonymous() {
    await apiFetch("/auth/anonymous", {
        method: "POST",
        parseJson: false
    });
}
export async function getExamConfig(examId) {
    return apiFetch(`/exam/${examId}/config`);
}
export async function getExamBank(examId, code) {
    const url = new URL(`${API_BASE}/exam/${examId}/bank`);
    if (code)
        url.searchParams.set("code", code);
    const token = getSessionToken();
    const headers = code ? { "X-Quiz-Code": code } : {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url.toString(), {
        credentials: "include",
        headers
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }
    return (await res.json());
}
export async function submitExam(examId, answers, code) {
    return apiFetch(`/exam/${examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(code ? { "X-Quiz-Code": code } : {}) },
        body: JSON.stringify(code ? { answers, code } : { answers })
    });
}
export function githubLoginUrl(currentUrl) {
    return `${API_BASE}/auth/github/start?redirect=${encodeURIComponent(currentUrl)}`;
}
export function githubLinkUrl(currentUrl) {
    return `${API_BASE}/auth/github/start?mode=link&redirect=${encodeURIComponent(currentUrl)}`;
}
export function googleLoginUrl(currentUrl) {
    const params = new URLSearchParams({ redirect: currentUrl });
    return `${API_BASE}/auth/google/start?${params.toString()}`;
}
export function googleLinkUrl(currentUrl) {
    const params = new URLSearchParams({ mode: "link", redirect: currentUrl });
    return `${API_BASE}/auth/google/start?${params.toString()}`;
}
export async function getUserSubmissions(cursor, includeDeleted = false) {
    const q = new URLSearchParams();
    if (cursor)
        q.set("cursor", cursor);
    if (includeDeleted)
        q.set("includeDeleted", "1");
    const query = q.toString();
    return apiFetch(`/me/submissions${query ? "?" + query : ""}`);
}
export async function batchDeleteMySubmissions(submissionIds) {
    return apiFetch(`/me/submissions/batch-delete`, {
        method: "POST",
        body: JSON.stringify({ submissionIds })
    });
}
export async function batchRestoreMySubmissions(submissionIds) {
    return apiFetch(`/me/submissions/batch-restore`, {
        method: "POST",
        body: JSON.stringify({ submissionIds })
    });
}
export async function batchHardDeleteMySubmissions(submissionIds) {
    return apiFetch(`/me/submissions/batch-hard-delete`, {
        method: "POST",
        body: JSON.stringify({ submissionIds })
    });
}
export async function getSubmissionDetail(submissionId) {
    const data = await apiFetch(`/me/submissions/${submissionId}`);
    return data.submission;
}
export async function listAdminSubmissions(cursor, limit) {
    const q = new URLSearchParams();
    if (cursor)
        q.set("cursor", cursor);
    if (limit)
        q.set("limit", String(limit));
    const query = q.toString();
    return apiFetch(`/admin/submissions${query ? "?" + query : ""}`);
}
export async function batchDeleteSubmissions(submissionIds) {
    return apiFetch(`/admin/submissions/batch-delete`, {
        method: "POST",
        body: JSON.stringify({ submissionIds })
    });
}
export async function batchRestoreSubmissions(submissionIds) {
    return apiFetch(`/admin/submissions/batch-restore`, {
        method: "POST",
        body: JSON.stringify({ submissionIds })
    });
}
export async function batchHardDeleteSubmissions(submissionIds) {
    return apiFetch(`/admin/submissions/batch-hard-delete`, {
        method: "POST",
        body: JSON.stringify({ submissionIds })
    });
}
export async function listPublicExams() {
    return apiFetch("/public/exams");
}
export async function resolveShortLink(code) {
    return apiFetch(`/public/short/${encodeURIComponent(code)}`);
}
export async function getDefaultTimezone() {
    const res = await apiFetch("/settings/timezone");
    return res.timezone ?? null;
}
export async function getDefaultTimeFormat() {
    const res = await apiFetch("/settings/timeformat");
    return res.format ?? null;
}
