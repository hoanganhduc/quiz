import { z } from "zod";
const DraftSchema = z.object({
    version: z.literal("v1"),
    examId: z.string(),
    versionId: z.string(),
    savedAtISO: z.string(),
    answers: z.record(z.string(), z.union([z.enum(["A", "B", "C", "D", "E"]), z.array(z.string())]))
});
export function makeDraftKey(examId, versionId) {
    return `quiz:draft:v1:${examId}:${versionId}`;
}
export function loadDraft(examId, versionId) {
    try {
        const raw = localStorage.getItem(makeDraftKey(examId, versionId));
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        const draft = DraftSchema.parse(parsed);
        return draft;
    }
    catch {
        return null;
    }
}
export function saveDraft(examId, versionId, answers) {
    try {
        const payload = {
            version: "v1",
            examId,
            versionId,
            savedAtISO: new Date().toISOString(),
            answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v]))
        };
        localStorage.setItem(makeDraftKey(examId, versionId), JSON.stringify(payload));
    }
    catch {
        // ignore storage errors
    }
}
export function clearDraft(examId, versionId) {
    try {
        localStorage.removeItem(makeDraftKey(examId, versionId));
    }
    catch {
        // ignore storage errors
    }
}
