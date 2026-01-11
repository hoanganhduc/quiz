import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteTemplate, deleteExam, getAdminExam, importExams, importTemplates, listExams, listTemplates, updateTemplate, createTemplate, cloneExam, createExamShortLink } from "../../api/admin";
import { AdminAuthGate } from "../../components/admin/AdminAuthGate";
import { PageShell } from "../../components/layout/PageShell";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Badge } from "../../components/ui/Badge";
import { Select } from "../../components/ui/Select";
import { formatDateTime } from "../../utils/time";
function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
function formatDate(value) {
    if (!value)
        return "—";
    return formatDateTime(value);
}
function buildExamLink(exam) {
    const rawBase = import.meta.env.VITE_BASE_URL ?? "/";
    const trimmed = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
    const base = trimmed === "/" ? "" : trimmed;
    return `${window.location.origin}${base}/#/exam/${encodeURIComponent(exam.subject)}/${encodeURIComponent(exam.examId)}`;
}
export function AdminExamsPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState("exams");
    const [notice, setNotice] = useState(null);
    const [examList, setExamList] = useState([]);
    const [examLoading, setExamLoading] = useState(false);
    const [examError, setExamError] = useState(null);
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [examQuery, setExamQuery] = useState("");
    const [examImportMode, setExamImportMode] = useState("keep");
    const [selectedExamIds, setSelectedExamIds] = useState([]);
    const [templateList, setTemplateList] = useState([]);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [templateError, setTemplateError] = useState(null);
    const [templateName, setTemplateName] = useState("");
    const [templateJson, setTemplateJson] = useState("");
    const [editingTemplate, setEditingTemplate] = useState(null);
    const apiBase = sessionStorage.getItem("admin_api_base") ?? import.meta.env.VITE_API_BASE ?? "";
    const filteredExams = useMemo(() => {
        const q = examQuery.trim().toLowerCase();
        if (!q)
            return examList;
        return examList.filter((item) => item.examId.toLowerCase().includes(q));
    }, [examList, examQuery]);
    const allSelected = filteredExams.length > 0 && filteredExams.every((item) => selectedExamIds.includes(item.examId));
    const refreshExams = async () => {
        if (!apiBase) {
            setExamError("API Base URL is required.");
            return;
        }
        setExamLoading(true);
        setExamError(null);
        try {
            const res = await listExams({ apiBase, includeDeleted });
            setExamList(res.items ?? []);
            setSelectedExamIds((prev) => prev.filter((id) => res.items?.some((item) => item.examId === id)));
        }
        catch (err) {
            setExamError(err?.message ?? "Failed to load exams");
        }
        finally {
            setExamLoading(false);
        }
    };
    const refreshTemplates = async () => {
        if (!apiBase) {
            setTemplateError("API Base URL is required.");
            return;
        }
        setTemplateLoading(true);
        setTemplateError(null);
        try {
            const res = await listTemplates({ apiBase });
            setTemplateList(res.items ?? []);
        }
        catch (err) {
            setTemplateError(err?.message ?? "Failed to load templates");
        }
        finally {
            setTemplateLoading(false);
        }
    };
    useEffect(() => {
        if (tab === "exams") {
            void refreshExams();
        }
        else {
            void refreshTemplates();
        }
    }, [tab, includeDeleted]);
    const handleExportExam = async (examId) => {
        try {
            const res = await getAdminExam({ apiBase, examId });
            downloadJson(`exam-${examId}.json`, res.exam);
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Export failed" });
        }
    };
    const handleDeleteExam = async (examId, mode) => {
        const confirmText = mode === "hard"
            ? "Delete permanently? This cannot be undone."
            : "Soft delete this exam? Students will no longer access it.";
        if (!window.confirm(confirmText))
            return;
        try {
            await deleteExam({ apiBase, examId, mode });
            setNotice({ tone: "success", text: mode === "hard" ? "Exam deleted permanently." : "Exam soft-deleted." });
            await refreshExams();
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Delete failed" });
        }
    };
    const handleImportExams = async (file) => {
        if (!apiBase) {
            setNotice({ tone: "error", text: "API Base URL is required." });
            return;
        }
        if (!file)
            return;
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const items = Array.isArray(json) ? json : [json];
            const res = await importExams({ apiBase, items, mode: examImportMode === "overwrite" ? "overwrite" : undefined });
            const okCount = res.results.filter((item) => item.ok).length;
            const errorCount = res.results.length - okCount;
            const detail = errorCount ? ` (${errorCount} failed)` : "";
            setNotice({ tone: errorCount ? "warn" : "success", text: `Imported ${okCount} exams${detail}.` });
            await refreshExams();
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Import failed" });
        }
    };
    const handleExportTemplate = (template) => {
        downloadJson(`template-${template.templateId}.json`, template);
    };
    const handleSaveTemplate = async () => {
        const name = templateName.trim();
        if (!name) {
            setTemplateError("Template name is required.");
            return;
        }
        if (!apiBase) {
            setTemplateError("API Base URL is required.");
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(templateJson);
        }
        catch {
            setTemplateError("Template JSON must be valid.");
            return;
        }
        try {
            const record = await createTemplate({ apiBase, name, template: parsed });
            setTemplateList((prev) => [record, ...prev]);
            setTemplateName("");
            setTemplateJson("");
            setNotice({ tone: "success", text: "Template created." });
        }
        catch (err) {
            setTemplateError(err?.message ?? "Create failed");
        }
    };
    const handleUpdateTemplate = async () => {
        if (!editingTemplate)
            return;
        const name = templateName.trim();
        if (!name) {
            setTemplateError("Template name is required.");
            return;
        }
        if (!apiBase) {
            setTemplateError("API Base URL is required.");
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(templateJson);
        }
        catch {
            setTemplateError("Template JSON must be valid.");
            return;
        }
        try {
            const record = await updateTemplate({
                apiBase,
                templateId: editingTemplate.templateId,
                name,
                template: parsed
            });
            setTemplateList((prev) => prev.map((item) => (item.templateId === record.templateId ? record : item)));
            setEditingTemplate(null);
            setTemplateName("");
            setTemplateJson("");
            setNotice({ tone: "success", text: "Template updated." });
        }
        catch (err) {
            setTemplateError(err?.message ?? "Update failed");
        }
    };
    const handleDeleteTemplate = async (template) => {
        if (!apiBase) {
            setTemplateError("API Base URL is required.");
            return;
        }
        if (!window.confirm("Delete this template?"))
            return;
        try {
            await deleteTemplate({ apiBase, templateId: template.templateId });
            setTemplateList((prev) => prev.filter((item) => item.templateId !== template.templateId));
            setNotice({ tone: "success", text: "Template deleted." });
        }
        catch (err) {
            setTemplateError(err?.message ?? "Delete failed");
        }
    };
    const handleImportTemplates = async (file) => {
        if (!apiBase) {
            setNotice({ tone: "error", text: "API Base URL is required." });
            return;
        }
        if (!file)
            return;
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const items = Array.isArray(json) ? json : [json];
            const payload = items.map((item) => ({
                name: item.name,
                template: item.template ?? item
            }));
            await importTemplates({ apiBase, items: payload });
            setNotice({ tone: "success", text: "Templates imported." });
            await refreshTemplates();
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Import failed" });
        }
    };
    const beginEditTemplate = (template) => {
        setEditingTemplate(template);
        setTemplateName(template.name);
        setTemplateJson(JSON.stringify(template.template, null, 2));
    };
    const toggleExamSelected = (examId) => {
        setSelectedExamIds((prev) => (prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId]));
    };
    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedExamIds([]);
            return;
        }
        setSelectedExamIds(filteredExams.map((item) => item.examId));
    };
    const handleBulkDelete = async (mode) => {
        if (!selectedExamIds.length)
            return;
        if (!apiBase) {
            setNotice({ tone: "error", text: "API Base URL is required." });
            return;
        }
        const confirmText = mode === "hard"
            ? `Delete permanently ${selectedExamIds.length} exams? This cannot be undone.`
            : `Soft delete ${selectedExamIds.length} exams? Students will no longer access them.`;
        if (!window.confirm(confirmText))
            return;
        try {
            const results = await Promise.allSettled(selectedExamIds.map((examId) => deleteExam({ apiBase, examId, mode })));
            const failed = results.filter((item) => item.status === "rejected").length;
            if (failed) {
                setNotice({ tone: "warn", text: `${selectedExamIds.length - failed} deleted. ${failed} failed.` });
            }
            else {
                setNotice({ tone: "success", text: "Bulk delete completed." });
            }
            await refreshExams();
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Bulk delete failed" });
        }
    };
    const handleCloneExam = async (examId) => {
        if (!apiBase) {
            setNotice({ tone: "error", text: "API Base URL is required." });
            return;
        }
        try {
            const res = await cloneExam({ apiBase, examId });
            setNotice({ tone: "success", text: `Duplicated exam as ${res.examId}.` });
            await refreshExams();
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Duplicate failed" });
        }
    };
    const handleCopyExamLink = async (exam) => {
        try {
            await navigator.clipboard.writeText(buildExamLink(exam));
            setNotice({ tone: "success", text: "Copied exam link." });
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Copy failed" });
        }
    };
    const handleCopyShortLink = async (exam) => {
        if (!apiBase) {
            setNotice({ tone: "error", text: "API Base URL is required." });
            return;
        }
        try {
            const res = await createExamShortLink({ apiBase, examId: exam.examId });
            await navigator.clipboard.writeText(res.shortUrl);
            setNotice({ tone: "success", text: "Copied short link." });
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Short link failed" });
        }
    };
    return (_jsx(AdminAuthGate, { children: _jsxs(PageShell, { maxWidth: "6xl", className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-text", children: "Exams & Templates" }), _jsx("p", { className: "text-sm text-textMuted", children: "Manage exams and reusable templates." })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsx(Button, { type: "button", onClick: () => navigate("/admin/exams/new"), children: "Create exam" }) })] }), notice ? _jsx(Alert, { tone: notice.tone, children: notice.text }) : null, _jsx("div", { className: "flex flex-wrap items-center gap-2", children: _jsxs("div", { className: "inline-flex items-center gap-1 rounded-lg bg-muted p-1 border border-border", children: [_jsx(Button, { type: "button", size: "sm", variant: tab === "exams" ? "primary" : "ghost", onClick: () => setTab("exams"), children: "Exams" }), _jsx(Button, { type: "button", size: "sm", variant: tab === "templates" ? "primary" : "ghost", onClick: () => setTab("templates"), children: "Templates" })] }) }), tab === "exams" ? (_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { value: examQuery, onChange: (e) => setExamQuery(e.target.value), placeholder: "Search exam ID..." }), _jsxs(Select, { value: includeDeleted ? "all" : "active", onChange: (e) => setIncludeDeleted(e.target.value === "all"), children: [_jsx("option", { value: "active", children: "Active only" }), _jsx("option", { value: "all", children: "Include deleted" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Select, { value: examImportMode, onChange: (e) => setExamImportMode(e.target.value), children: [_jsx("option", { value: "keep", children: "Import keep existing" }), _jsx("option", { value: "overwrite", children: "Import overwrite" })] }), _jsxs("label", { className: "text-xs text-textMuted", children: ["Import exams", _jsx(Input, { type: "file", accept: "application/json", onChange: (e) => handleImportExams(e.target.files?.[0] ?? null) })] }), _jsx(Button, { type: "button", variant: "secondary", onClick: refreshExams, children: "Refresh" })] })] }), selectedExamIds.length ? (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs", children: [_jsxs("div", { children: [selectedExamIds.length, " selected"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => handleBulkDelete("soft"), children: "Bulk delete" }), _jsx(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => handleBulkDelete("hard"), children: "Bulk delete permanently" })] })] })) : null, examError ? _jsx(Alert, { tone: "error", children: examError }) : null, examLoading ? (_jsx("div", { className: "text-sm text-textMuted", children: "Loading exams..." })) : filteredExams.length ? (_jsx("div", { className: "space-y-2 text-sm", children: filteredExams.map((exam) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [_jsx("input", { type: "checkbox", className: "mt-1 h-4 w-4", checked: selectedExamIds.includes(exam.examId), onChange: () => toggleExamSelected(exam.examId), "aria-label": `Select ${exam.examId}` }), _jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-mono text-xs", children: exam.examId }), _jsx(Badge, { tone: exam.visibility === "public" ? "info" : "muted", children: exam.visibility === "public" ? "Public" : "Private" }), exam.deletedAt ? _jsx(Badge, { tone: "warn", children: "Deleted" }) : null, exam.hasSubmissions ? _jsx(Badge, { tone: "info", children: "Taken" }) : null] }), _jsxs("div", { className: "text-xs text-textMuted", children: ["Created ", formatDate(exam.createdAt), " \u00B7 Expires ", formatDate(exam.expiresAt)] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => handleCloneExam(exam.examId), children: "Duplicate" }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => handleCopyExamLink(exam), children: "Copy link" }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => handleCopyShortLink(exam), children: "Copy short link" }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => navigate(`/admin/exams/new?edit=${exam.examId}`), children: "Edit" }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => handleExportExam(exam.examId), children: "Export" }), _jsx(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => handleDeleteExam(exam.examId, "soft"), children: "Delete" }), _jsx(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => handleDeleteExam(exam.examId, "hard"), children: "Delete permanently" })] })] }, exam.examId))) })) : (_jsx("div", { className: "text-sm text-textMuted", children: "No exams found." })), filteredExams.length ? (_jsxs("div", { className: "flex items-center gap-2 text-xs text-textMuted", children: [_jsx("input", { type: "checkbox", className: "h-4 w-4", checked: allSelected, onChange: toggleSelectAll }), "Select all filtered exams"] })) : null] })) : (_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "Templates" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("label", { className: "text-xs text-textMuted", children: ["Import templates", _jsx(Input, { type: "file", accept: "application/json", onChange: (e) => handleImportTemplates(e.target.files?.[0] ?? null) })] }), _jsx(Button, { type: "button", variant: "secondary", onClick: refreshTemplates, children: "Refresh" })] })] }), templateError ? _jsx(Alert, { tone: "error", children: templateError }) : null, _jsxs(Card, { padding: "sm", className: "space-y-3", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: editingTemplate ? "Edit template" : "Create template" }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", children: "Name" }), _jsx(Input, { value: templateName, onChange: (e) => setTemplateName(e.target.value), placeholder: "Template name" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", children: "Template JSON" }), _jsx(Textarea, { rows: 4, value: templateJson, onChange: (e) => setTemplateJson(e.target.value), placeholder: '{"subject":"discrete-math","composition":[...],"policy":{...}}' })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", onClick: editingTemplate ? handleUpdateTemplate : handleSaveTemplate, children: editingTemplate ? "Update template" : "Create template" }), editingTemplate ? (_jsx(Button, { type: "button", variant: "ghost", onClick: () => {
                                                setEditingTemplate(null);
                                                setTemplateName("");
                                                setTemplateJson("");
                                            }, children: "Cancel" })) : null] })] }), templateLoading ? (_jsx("div", { className: "text-sm text-textMuted", children: "Loading templates..." })) : templateList.length ? (_jsx("div", { className: "space-y-2 text-sm", children: templateList.map((template) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium text-text", children: template.name }), _jsxs("div", { className: "text-xs text-textMuted", children: ["Updated ", formatDate(template.updatedAt ?? template.createdAt)] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => beginEditTemplate(template), children: "Edit" }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => handleExportTemplate(template), children: "Export" }), _jsx(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => handleDeleteTemplate(template), children: "Delete" })] })] }, template.templateId))) })) : (_jsx("div", { className: "text-sm text-textMuted", children: "No templates found." }))] }))] }) }));
}
