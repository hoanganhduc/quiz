import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import clsx from "clsx";
import { PageShell } from "../components/layout/PageShell";
import { useTheme } from "../theme/useTheme";
export function SettingsPage() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const Option = ({ value, label }) => {
        const active = theme === value;
        return (_jsx(Button, { type: "button", size: "sm", variant: active ? "primary" : "secondary", onClick: () => setTheme(value), className: clsx("min-w-[90px]", active ? "" : "hover:bg-muted/70"), "aria-pressed": active, children: label }));
    };
    return (_jsx(PageShell, { maxWidth: "3xl", className: "space-y-4", children: _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-text", children: "Appearance" }), _jsx("p", { className: "text-sm text-textMuted", children: "Choose how the UI looks on this device." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-sm font-medium text-text", children: "Theme" }), _jsxs("div", { role: "radiogroup", "aria-label": "Theme", className: "flex flex-wrap gap-2", children: [_jsx(Option, { value: "light", label: "Light" }), _jsx(Option, { value: "dark", label: "Dark" }), _jsx(Option, { value: "system", label: "System" })] }), _jsxs("div", { className: "text-xs text-textMuted", children: ["Current: ", resolvedTheme] })] })] }) }));
}
