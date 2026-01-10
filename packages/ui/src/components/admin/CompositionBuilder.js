import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
const defaultPresetTopics = ["logic", "sets", "graphs"];
export function CompositionBuilder({ composition, onChange, errors = {}, bankStats }) {
    const totals = useMemo(() => {
        const total = composition.reduce((sum, row) => sum + (Number.isInteger(row.n) ? row.n : 0), 0);
        const basic = composition.reduce((sum, row) => sum + (row.level === "basic" && Number.isInteger(row.n) ? row.n : 0), 0);
        const advanced = composition.reduce((sum, row) => sum + (row.level === "advanced" && Number.isInteger(row.n) ? row.n : 0), 0);
        return { total, basic, advanced };
    }, [composition]);
    const topics = bankStats?.topics.length ? bankStats.topics : defaultPresetTopics;
    const presets = [
        {
            label: "Balanced 30",
            rows: [
                { topic: topics[0] || "topic-a", level: "basic", n: 12 },
                { topic: topics[1] || "topic-b", level: "basic", n: 8 },
                { topic: topics[2] || "topic-c", level: "advanced", n: 10 }
            ]
        },
        {
            label: "Advanced 20",
            rows: [
                { topic: topics[0] || "topic-a", level: "advanced", n: 10 },
                { topic: topics[1] || "topic-b", level: "advanced", n: 10 }
            ]
        }
    ];
    const updateRow = (idx, patch) => {
        onChange(composition.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
    };
    const removeRow = (idx) => {
        onChange(composition.filter((_, i) => i !== idx));
    };
    const addRow = () => {
        onChange([...composition, { topic: "", level: "basic", n: 1 }]);
    };
    return (_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Composition" }), _jsx("p", { className: "text-sm text-textMuted", children: "Define topics, levels, and counts." })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Badge, { tone: "info", children: ["Total ", totals.total] }), _jsxs(Badge, { tone: "success", children: ["Basic ", totals.basic] }), _jsxs(Badge, { tone: "warn", children: ["Advanced ", totals.advanced] })] })] }), errors["composition"] ? (_jsx(Alert, { tone: "error", children: errors["composition"] })) : null, errors["composition.total"] ? (_jsx(Alert, { tone: "error", children: errors["composition.total"] })) : null, _jsx("div", { className: "space-y-3", children: composition.map((row, idx) => {
                    const available = bankStats?.counts[row.topic]?.[row.level];
                    const overLimit = typeof available === "number" && row.n > available;
                    return (_jsxs("div", { className: "grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-textMuted", htmlFor: `composition-${idx}-topic`, children: "Topic" }), _jsx(Input, { id: `composition-${idx}-topic`, value: row.topic, list: "topic-suggestions", hasError: Boolean(errors[`composition.${idx}.topic`]), onChange: (e) => updateRow(idx, { topic: e.target.value }), placeholder: "sets", "aria-describedby": errors[`composition.${idx}.topic`] ? `composition-${idx}-topic-error` : undefined }), errors[`composition.${idx}.topic`] ? (_jsx("p", { className: "text-xs text-error", role: "alert", id: `composition-${idx}-topic-error`, children: errors[`composition.${idx}.topic`] })) : null] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-textMuted", htmlFor: `composition-${idx}-level`, children: "Level" }), _jsxs(Select, { id: `composition-${idx}-level`, value: row.level, hasError: Boolean(errors[`composition.${idx}.level`]), onChange: (e) => updateRow(idx, { level: e.target.value }), "aria-describedby": errors[`composition.${idx}.level`] ? `composition-${idx}-level-error` : undefined, children: [_jsx("option", { value: "basic", children: "Basic" }), _jsx("option", { value: "advanced", children: "Advanced" })] }), errors[`composition.${idx}.level`] ? (_jsx("p", { className: "text-xs text-error", role: "alert", id: `composition-${idx}-level-error`, children: errors[`composition.${idx}.level`] })) : null] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-textMuted", htmlFor: `composition-${idx}-n`, children: "N" }), _jsx(Input, { id: `composition-${idx}-n`, type: "number", min: 1, value: row.n, hasError: Boolean(errors[`composition.${idx}.n`]), onChange: (e) => updateRow(idx, { n: Number(e.target.value) }), "aria-describedby": errors[`composition.${idx}.n`] ? `composition-${idx}-n-error` : undefined }), errors[`composition.${idx}.n`] ? (_jsx("p", { className: "text-xs text-error", role: "alert", id: `composition-${idx}-n-error`, children: errors[`composition.${idx}.n`] })) : null, overLimit ? (_jsxs("p", { className: "text-xs text-warn", children: ["Bank has only ", available, " matching questions for this topic/level."] })) : null] }), _jsx("div", { className: "flex items-end", children: _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => removeRow(idx), children: "Remove" }) })] }, `${row.topic}-${idx}`));
                }) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: addRow, children: "Add row" }), presets.map((preset) => (_jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => onChange(preset.rows), children: preset.label }, preset.label)))] }), _jsx("datalist", { id: "topic-suggestions", children: bankStats?.topics.map((topic) => (_jsx("option", { value: topic }, topic))) })] }));
}
