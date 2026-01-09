function normalizeBase(apiBase) {
    return apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
}
async function parseError(res) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        const body = await res.json().catch(() => null);
        const message = typeof body?.message === "string" ? body.message : res.statusText || "Request failed";
        return { status: res.status, message, body };
    }
    const text = await res.text().catch(() => "");
    return { status: res.status, message: text || res.statusText || "Request failed" };
}
export async function createExam(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/exams`, {
        method: "POST",
        headers: {
            ...(params.adminToken ? { Authorization: `Bearer ${params.adminToken}` } : {}),
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(params.body)
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function healthCheck(apiBase) {
    const base = normalizeBase(apiBase);
    const res = await fetch(`${base}/health`, { method: "GET" });
    if (!res.ok) {
        return { ok: false, error: await parseError(res) };
    }
    return { ok: true };
}
