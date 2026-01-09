const API_BASE = import.meta.env.VITE_API_BASE;
if (!API_BASE) {
    console.warn("VITE_API_BASE is not set; API calls will fail.");
}
async function apiFetch(path, init) {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        ...init
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
    const res = await fetch(url.toString(), {
        credentials: "include",
        headers: code ? { "X-Quiz-Code": code } : undefined
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
export async function getUserSubmissions(cursor) {
    const path = cursor ? `/me/submissions?cursor=${encodeURIComponent(cursor)}` : "/me/submissions";
    return apiFetch(path);
}
export async function getSubmissionDetail(submissionId) {
    return apiFetch(`/me/submissions/${submissionId}`);
}
