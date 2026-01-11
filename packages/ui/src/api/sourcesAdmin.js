const API_BASE = import.meta.env.VITE_API_BASE;
async function request(path, init) {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        ...init
    });
    if (!res.ok) {
        const body = await res.text();
        const err = new Error(body || `Request failed: ${res.status}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    if (init?.parseJson === false) {
        return undefined;
    }
    return (await res.json());
}
export async function getSources() {
    return request("/admin/sources");
}
export async function putSources(config) {
    return request("/admin/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    });
}
export async function listSecrets() {
    return request("/admin/secrets");
}
export async function putSecret(name, value) {
    await request(`/admin/secrets/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
        parseJson: false
    });
}
export async function deleteSecret(name) {
    await request(`/admin/secrets/${encodeURIComponent(name)}`, {
        method: "DELETE",
        parseJson: false
    });
}
export async function testSource(sourceId) {
    return request("/admin/sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId })
    });
}
export async function uploadSourceZip(form) {
    return request("/admin/sources/upload", {
        method: "POST",
        body: form
    });
}
export async function getR2Usage() {
    return request("/admin/r2/usage");
}
export async function triggerCiBuild(opts) {
    return request("/admin/ci/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts && (opts.ref || opts.forceRegen) ? opts : {})
    });
}
export async function getCiStatus(ref) {
    const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return request(`/admin/ci/status${qs}`);
}
export async function setDefaultTimezone(timezone) {
    return request("/admin/settings/timezone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone })
    });
}
export async function clearBanks(subject) {
    return request("/admin/banks/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subject ? { subject } : {})
    });
}
export async function setDefaultTimeFormat(format) {
    return request("/admin/settings/timeformat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format })
    });
}
