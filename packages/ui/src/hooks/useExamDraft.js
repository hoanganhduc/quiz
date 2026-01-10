import { useCallback, useEffect, useMemo, useState } from "react";
const DEFAULT_DRAFT = {
    subject: "discrete-math",
    title: "",
    composition: [{ topic: "", level: "basic", n: 1 }],
    autoSeed: true,
    seed: "",
    policy: {
        authMode: "optional",
        requireViewCode: false,
        requireSubmitCode: false,
        solutionsMode: "after_submit",
        timeLimitMinutes: undefined,
        versioningMode: "fixed",
        shuffleQuestions: false,
        shuffleChoices: false
    },
    codesEnabled: false,
    codes: [],
    expiresEnabled: false,
    expiresAtLocal: "",
    visibility: "private"
};
function normalizeCodes(codes) {
    const trimmed = codes.map((code) => code.trim()).filter(Boolean);
    return Array.from(new Set(trimmed));
}
export function useExamDraft() {
    const [draft, setDraft] = useState({ ...DEFAULT_DRAFT });
    const [errors, setErrors] = useState({});
    const [warnings, setWarnings] = useState([]);
    const normalizedRequestBody = useMemo(() => {
        const composition = draft.composition
            .map((row) => ({
            topic: row.topic.trim(),
            level: row.level,
            n: Number.isFinite(row.n) ? Math.trunc(row.n) : row.n
        }))
            .filter((row) => row.topic.length > 0 && row.n >= 1);
        const body = {
            subject: draft.subject,
            composition,
            policy: draft.policy,
            visibility: draft.visibility
        };
        if (draft.title.trim()) {
            body.title = draft.title.trim();
        }
        if (!draft.autoSeed && draft.seed.trim()) {
            body.seed = draft.seed.trim();
        }
        const normalizedCodes = normalizeCodes(draft.codes);
        if (draft.codesEnabled && normalizedCodes.length > 0) {
            body.codes = normalizedCodes;
        }
        if (draft.expiresEnabled && draft.expiresAtLocal) {
            const date = new Date(draft.expiresAtLocal);
            if (!Number.isNaN(date.getTime())) {
                body.expiresAt = date.toISOString();
            }
        }
        return body;
    }, [draft]);
    const validate = useCallback(() => {
        const nextErrors = {};
        const nextWarnings = [];
        if (!draft.subject) {
            nextErrors["subject"] = "Subject is required.";
        }
        if (draft.composition.length === 0) {
            nextErrors["composition"] = "Add at least one composition row.";
        }
        let total = 0;
        let basicCount = 0;
        let advancedCount = 0;
        draft.composition.forEach((row, idx) => {
            const topic = row.topic.trim();
            if (!topic) {
                nextErrors[`composition.${idx}.topic`] = "Topic is required.";
            }
            if (row.level !== "basic" && row.level !== "advanced") {
                nextErrors[`composition.${idx}.level`] = "Level must be basic or advanced.";
            }
            if (!Number.isInteger(row.n) || row.n < 1) {
                nextErrors[`composition.${idx}.n`] = "N must be an integer >= 1.";
            }
            if (Number.isInteger(row.n) && row.n > 0) {
                total += row.n;
                if (row.level === "basic")
                    basicCount += row.n;
                if (row.level === "advanced")
                    advancedCount += row.n;
            }
        });
        if (total <= 0) {
            nextErrors["composition.total"] = "Total questions must be greater than zero.";
        }
        if (total > 200) {
            nextWarnings.push(`Large exam size (${total} questions). Consider splitting into smaller exams for reliability.`);
        }
        if (!draft.autoSeed && !draft.seed.trim()) {
            nextErrors["seed"] = "Seed is required when auto-generate is disabled.";
        }
        if (draft.expiresEnabled) {
            if (!draft.expiresAtLocal) {
                nextErrors["expiresAt"] = "Expiration time is required.";
            }
            else {
                const date = new Date(draft.expiresAtLocal);
                if (Number.isNaN(date.getTime())) {
                    nextErrors["expiresAt"] = "Expiration time is invalid.";
                }
                else if (date.getTime() <= Date.now()) {
                    nextErrors["expiresAt"] = "Expiration must be in the future.";
                }
            }
        }
        if (!draft.policy.authMode) {
            nextErrors["policy.authMode"] = "Auth mode is required.";
        }
        if (!draft.policy.solutionsMode) {
            nextErrors["policy.solutionsMode"] = "Solutions mode is required.";
        }
        const normalizedCodes = normalizeCodes(draft.codes);
        if ((draft.policy.requireViewCode || draft.policy.requireSubmitCode) && normalizedCodes.length === 0) {
            nextWarnings.push("Access codes are required by policy but the code list is empty. Students will not be blocked.");
        }
        if (draft.policy.versionCount !== undefined &&
            (!Number.isInteger(draft.policy.versionCount) ||
                draft.policy.versionCount < 2 ||
                draft.policy.versionCount > 50)) {
            nextErrors["policy.versionCount"] = "Version count must be an integer between 2 and 50.";
        }
        if (draft.policy.timeLimitMinutes !== undefined &&
            (!Number.isInteger(draft.policy.timeLimitMinutes) ||
                draft.policy.timeLimitMinutes < 1 ||
                draft.policy.timeLimitMinutes > 300)) {
            nextErrors["policy.timeLimitMinutes"] = "Time limit must be an integer between 1 and 300 minutes.";
        }
        if (draft.policy.shuffleChoices && draft.policy.solutionsMode !== "never") {
            nextWarnings.push("Shuffled choices may make letter-referenced solutions harder to read.");
        }
        if (basicCount === 0 && advancedCount > 0) {
            nextWarnings.push("No basic questions selected. Ensure students are ready for advanced-only exams.");
        }
        setErrors(nextErrors);
        setWarnings(nextWarnings);
        return Object.keys(nextErrors).length === 0;
    }, [draft]);
    useEffect(() => {
        validate();
    }, [validate]);
    const reset = useCallback(() => {
        setDraft({ ...DEFAULT_DRAFT });
        setErrors({});
        setWarnings([]);
    }, []);
    return {
        draft,
        setDraft,
        errors,
        warnings,
        normalizedRequestBody,
        validate,
        reset
    };
}
