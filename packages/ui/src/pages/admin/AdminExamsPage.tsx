import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteTemplate,
  deleteExam,
  getAdminExam,
  importExams,
  importTemplates,
  listExams,
  listTemplates,
  restoreExam,
  updateTemplate,
  createTemplate,
  cloneExam,
  createExamShortLink,
  type AdminExamSummary,
  type ExamTemplateRecord
} from "../../api/admin";
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
import { ExamListItem } from "../../components/ExamListItem";

type Notice = { tone: "success" | "error" | "warn" | "info"; text: string };

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return formatDateTime(value);
}

function buildExamLink(exam: AdminExamSummary): string {
  const rawBase = import.meta.env.VITE_BASE_URL ?? "/";
  const trimmed = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
  const base = trimmed === "/" ? "" : trimmed;
  return `${window.location.origin}${base}/#/exam/${encodeURIComponent(exam.subject)}/${encodeURIComponent(exam.examId)}`;
}

export function AdminExamsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"exams" | "templates">("exams");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [examList, setExamList] = useState<AdminExamSummary[]>([]);
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [examQuery, setExamQuery] = useState("");
  const [examImportMode, setExamImportMode] = useState<"keep" | "overwrite">("keep");
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);

  const [templateList, setTemplateList] = useState<ExamTemplateRecord[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateJson, setTemplateJson] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<ExamTemplateRecord | null>(null);

  const apiBase = sessionStorage.getItem("admin_api_base") ?? import.meta.env.VITE_API_BASE ?? "";

  const filteredExams = useMemo(() => {
    const q = examQuery.trim().toLowerCase();
    if (!q) return examList;
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
    } catch (err: any) {
      setExamError(err?.message ?? "Failed to load exams");
    } finally {
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
    } catch (err: any) {
      setTemplateError(err?.message ?? "Failed to load templates");
    } finally {
      setTemplateLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "exams") {
      void refreshExams();
    } else {
      void refreshTemplates();
    }
  }, [tab, includeDeleted]);

  const handleExportExam = async (examId: string) => {
    try {
      const res = await getAdminExam({ apiBase, examId });
      downloadJson(`exam-${examId}.json`, res.exam);
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Export failed" });
    }
  };

  const handleDeleteExam = async (examId: string, mode: "soft" | "hard") => {
    const confirmText =
      mode === "hard"
        ? "Delete permanently? This cannot be undone."
        : "Soft delete this exam? Students will no longer access it.";
    if (!window.confirm(confirmText)) return;
    try {
      await deleteExam({ apiBase, examId, mode });
      setNotice({ tone: "success", text: mode === "hard" ? "Exam deleted permanently." : "Exam soft-deleted." });
      await refreshExams();
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Delete failed" });
    }
  };

  const handleImportExams = async (file: File | null) => {
    if (!apiBase) {
      setNotice({ tone: "error", text: "API Base URL is required." });
      return;
    }
    if (!file) return;
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
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Import failed" });
    }
  };

  const handleExportTemplate = (template: ExamTemplateRecord) => {
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
    let parsed: ExamTemplateRecord["template"];
    try {
      parsed = JSON.parse(templateJson);
    } catch {
      setTemplateError("Template JSON must be valid.");
      return;
    }
    try {
      const record = await createTemplate({ apiBase, name, template: parsed });
      setTemplateList((prev) => [record, ...prev]);
      setTemplateName("");
      setTemplateJson("");
      setNotice({ tone: "success", text: "Template created." });
    } catch (err: any) {
      setTemplateError(err?.message ?? "Create failed");
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    const name = templateName.trim();
    if (!name) {
      setTemplateError("Template name is required.");
      return;
    }
    if (!apiBase) {
      setTemplateError("API Base URL is required.");
      return;
    }
    let parsed: ExamTemplateRecord["template"];
    try {
      parsed = JSON.parse(templateJson);
    } catch {
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
    } catch (err: any) {
      setTemplateError(err?.message ?? "Update failed");
    }
  };

  const handleDeleteTemplate = async (template: ExamTemplateRecord) => {
    if (!apiBase) {
      setTemplateError("API Base URL is required.");
      return;
    }
    if (!window.confirm("Delete this template?")) return;
    try {
      await deleteTemplate({ apiBase, templateId: template.templateId });
      setTemplateList((prev) => prev.filter((item) => item.templateId !== template.templateId));
      setNotice({ tone: "success", text: "Template deleted." });
    } catch (err: any) {
      setTemplateError(err?.message ?? "Delete failed");
    }
  };

  const handleImportTemplates = async (file: File | null) => {
    if (!apiBase) {
      setNotice({ tone: "error", text: "API Base URL is required." });
      return;
    }
    if (!file) return;
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
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Import failed" });
    }
  };

  const beginEditTemplate = (template: ExamTemplateRecord) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateJson(JSON.stringify(template.template, null, 2));
  };

  const toggleExamSelected = (examId: string) => {
    setSelectedExamIds((prev) => (prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedExamIds([]);
      return;
    }
    setSelectedExamIds(filteredExams.map((item) => item.examId));
  };

  const handleBulkDelete = async (mode: "soft" | "hard") => {
    if (!selectedExamIds.length) return;
    if (!apiBase) {
      setNotice({ tone: "error", text: "API Base URL is required." });
      return;
    }
    const confirmText =
      mode === "hard"
        ? `Delete permanently ${selectedExamIds.length} exams? This cannot be undone.`
        : `Soft delete ${selectedExamIds.length} exams? Students will no longer access them.`;
    if (!window.confirm(confirmText)) return;
    try {
      const results = await Promise.allSettled(selectedExamIds.map((examId) => deleteExam({ apiBase, examId, mode })));
      const failed = results.filter((item) => item.status === "rejected").length;
      if (failed) {
        setNotice({ tone: "warn", text: `${selectedExamIds.length - failed} deleted. ${failed} failed.` });
      } else {
        setNotice({ tone: "success", text: "Bulk delete completed." });
      }
      await refreshExams();
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Bulk delete failed" });
    }
  };

  const handleCloneExam = async (examId: string) => {
    if (!apiBase) {
      setNotice({ tone: "error", text: "API Base URL is required." });
      return;
    }
    try {
      const res = await cloneExam({ apiBase, examId });
      setNotice({ tone: "success", text: `Duplicated exam as ${res.examId}.` });
      await refreshExams();
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Duplicate failed" });
    }
  };

  const handleCopyExamLink = async (exam: AdminExamSummary) => {
    try {
      await navigator.clipboard.writeText(buildExamLink(exam));
      setNotice({ tone: "success", text: "Copied exam link." });
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Copy failed" });
    }
  };

  const handleCopyShortLink = async (exam: AdminExamSummary) => {
    if (!apiBase) {
      setNotice({ tone: "error", text: "API Base URL is required." });
      return;
    }
    try {
      const res = await createExamShortLink({ apiBase, examId: exam.examId });
      await navigator.clipboard.writeText(res.shortUrl);
      setNotice({ tone: "success", text: "Copied short link." });
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Short link failed" });
    }
  };

  const handleOpenExam = (exam: AdminExamSummary) => {
    const url = buildExamLink(exam);
    window.open(url, "_blank");
  };

  const handleRestoreExam = async (examId: string) => {
    if (!apiBase) {
      setNotice({ tone: "error", text: "API Base URL is required." });
      return;
    }
    try {
      await restoreExam({ apiBase, examId });
      setNotice({ tone: "success", text: "Exam restored." });
      await refreshExams();
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Restore failed" });
    }
  };

  return (
    <AdminAuthGate>
      <PageShell maxWidth="6xl" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text">Exams & Templates</h1>
            <p className="text-sm text-textMuted">Manage exams and reusable templates.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => navigate("/admin/exams/new")}>
              Create exam
            </Button>
          </div>
        </div>

        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1 border border-border">
            <Button type="button" size="sm" variant={tab === "exams" ? "primary" : "ghost"} onClick={() => setTab("exams")}>
              Exams
            </Button>
            <Button type="button" size="sm" variant={tab === "templates" ? "primary" : "ghost"} onClick={() => setTab("templates")}>
              Templates
            </Button>
          </div>
        </div>

        {tab === "exams" ? (
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Input
                  value={examQuery}
                  onChange={(e) => setExamQuery(e.target.value)}
                  placeholder="Search exam ID..."
                />
                <Select value={includeDeleted ? "all" : "active"} onChange={(e) => setIncludeDeleted(e.target.value === "all")}>
                  <option value="active">Active only</option>
                  <option value="all">Include deleted</option>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Select value={examImportMode} onChange={(e) => setExamImportMode(e.target.value as "keep" | "overwrite")}>
                  <option value="keep">Import keep existing</option>
                  <option value="overwrite">Import overwrite</option>
                </Select>
                <label className="text-xs text-textMuted">
                  Import exams
                  <Input type="file" accept="application/json" onChange={(e) => handleImportExams(e.target.files?.[0] ?? null)} />
                </label>
                <Button type="button" variant="secondary" onClick={refreshExams}>
                  Refresh
                </Button>
              </div>
            </div>

            {selectedExamIds.length ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                <div>{selectedExamIds.length} selected</div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleBulkDelete("soft")}>
                    Bulk delete
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleBulkDelete("hard")}>
                    Bulk delete permanently
                  </Button>
                </div>
              </div>
            ) : null}

            {examError ? <Alert tone="error">{examError}</Alert> : null}
            {examLoading ? (
              <div className="text-sm text-textMuted">Loading exams...</div>
            ) : filteredExams.length ? (
              <div className="space-y-2 text-sm">
                {filteredExams.map((exam) => (
                  <div key={exam.examId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={selectedExamIds.includes(exam.examId)}
                        onChange={() => toggleExamSelected(exam.examId)}
                        aria-label={`Select ${exam.examId}`}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={buildExamLink(exam)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-indigo-600 hover:underline"
                          >
                            {exam.examId}
                          </a>
                          <Badge tone={exam.visibility === "public" ? "info" : "muted"}>
                            {exam.visibility === "public" ? "Public" : "Private"}
                          </Badge>
                          {exam.deletedAt ? <Badge tone="warn">Deleted</Badge> : null}
                          {exam.hasSubmissions ? <Badge tone="info">Taken</Badge> : null}
                        </div>
                        <div className="text-xs text-textMuted">
                          Created {formatDate(exam.createdAt)} · Expires {formatDate(exam.expiresAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => handleCloneExam(exam.examId)}>
                        Duplicate
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => handleCopyExamLink(exam)}>
                        Copy link
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => handleCopyShortLink(exam)}>
                        Copy short link
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => handleOpenExam(exam)}>
                        Open
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => navigate(`/admin/exams/new?edit=${exam.examId}`)}>
                        Edit
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => handleExportExam(exam.examId)}>
                        Export
                      </Button>
                      {exam.deletedAt ? (
                        <Button type="button" size="sm" variant="secondary" onClick={() => handleRestoreExam(exam.examId)}>
                          Restore
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleDeleteExam(exam.examId, "soft")}>
                        Delete
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleDeleteExam(exam.examId, "hard")}>
                        Delete permanently
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-textMuted">No exams found.</div>
            )}
            {filteredExams.length ? (
              <div className="flex items-center gap-2 text-xs text-textMuted">
                <input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={toggleSelectAll} />
                Select all filtered exams
              </div>
            ) : null}
          </Card>
        ) : (
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-text">Templates</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-textMuted">
                  Import templates
                  <Input type="file" accept="application/json" onChange={(e) => handleImportTemplates(e.target.files?.[0] ?? null)} />
                </label>
                <Button type="button" variant="secondary" onClick={refreshTemplates}>
                  Refresh
                </Button>
              </div>
            </div>

            {templateError ? <Alert tone="error">{templateError}</Alert> : null}

            <Card padding="sm" className="space-y-3">
              <div className="text-sm font-semibold text-text">{editingTemplate ? "Edit template" : "Create template"}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Name</label>
                  <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Template JSON</label>
                  <Textarea
                    rows={4}
                    value={templateJson}
                    onChange={(e) => setTemplateJson(e.target.value)}
                    placeholder='{"subject":"discrete-math","composition":[...],"policy":{...}}'
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={editingTemplate ? handleUpdateTemplate : handleSaveTemplate}>
                  {editingTemplate ? "Update template" : "Create template"}
                </Button>
                {editingTemplate ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateName("");
                      setTemplateJson("");
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </Card>

            {templateLoading ? (
              <div className="text-sm text-textMuted">Loading templates...</div>
            ) : templateList.length ? (
              <div className="space-y-2 text-sm">
                {templateList.map((template) => (
                  <div key={template.templateId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium text-text">{template.name}</div>
                      <div className="text-xs text-textMuted">Updated {formatDate(template.updatedAt ?? template.createdAt)}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => beginEditTemplate(template)}>
                        Edit
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => handleExportTemplate(template)}>
                        Export
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleDeleteTemplate(template)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-textMuted">No templates found.</div>
            )}
          </Card>
        )}
      </PageShell>
    </AdminAuthGate>
  );
}
