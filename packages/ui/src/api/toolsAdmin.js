const API_BASE = import.meta.env.VITE_API_BASE;
async function request(path, init) {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        ...init
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Request failed: ${res.status}`);
    }
    if (init?.parseJson === false) {
        return undefined;
    }
    return (await res.json());
}
export async function canvasZipToLatexTool(body) {
    return request("/admin/tools/canvas-to-latex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}
export async function latexToCanvasTool(body) {
    return request("/admin/tools/latex-to-canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}
export async function uploadToolFile(form) {
    return request("/admin/tools/upload", {
        method: "POST",
        body: form
    });
}
