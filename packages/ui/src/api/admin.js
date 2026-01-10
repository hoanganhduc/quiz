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
export async function getExamTemplate(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}/template`, {
        method: "GET",
        credentials: "include"
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function listExams(params) {
    const apiBase = normalizeBase(params.apiBase);
    const url = new URL(`${apiBase}/admin/exams`);
    if (params.includeDeleted)
        url.searchParams.set("includeDeleted", "1");
    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function getAdminExam(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}`, {
        method: "GET",
        credentials: "include"
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function updateExam(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params.body)
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function deleteExam(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: params.mode })
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function importExams(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/exams/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: params.items, mode: params.mode })
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function cloneExam(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}/clone`, {
        method: "POST",
        credentials: "include"
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function createExamShortLink(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}/shortlink`, {
        method: "POST",
        credentials: "include"
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function listTemplates(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/templates`, { credentials: "include" });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function createTemplate(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: params.name, template: params.template })
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function updateTemplate(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/templates/${encodeURIComponent(params.templateId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: params.name, template: params.template })
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function deleteTemplate(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/templates/${encodeURIComponent(params.templateId)}`, {
        method: "DELETE",
        credentials: "include"
    });
    if (!res.ok) {
        throw await parseError(res);
    }
}
export async function importTemplates(params) {
    const apiBase = normalizeBase(params.apiBase);
    const res = await fetch(`${apiBase}/admin/templates/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: params.items })
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function listAvailableBanks(apiBase) {
    const base = normalizeBase(apiBase);
    const res = await fetch(`${base}/admin/banks`, { credentials: "include" });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function getLatestPublicBank(apiBase, subject) {
    const base = normalizeBase(apiBase);
    const res = await fetch(`${base}/admin/banks/${encodeURIComponent(subject)}/public`, { credentials: "include" });
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
