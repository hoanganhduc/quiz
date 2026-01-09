import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useEffect, useMemo, useState } from "react";
const STORAGE_KEY = "ui.theme";
function readStoredTheme() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
    }
    catch {
        return "system";
    }
}
function prefersDark() {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}
function resolveTheme(theme) {
    if (theme === "system")
        return prefersDark() ? "dark" : "light";
    return theme;
}
function applyResolvedTheme(resolved) {
    document.documentElement.classList.toggle("dark", resolved === "dark");
}
export const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
    // Initialize synchronously so the first client render uses the correct resolved theme.
    const initialTheme = readStoredTheme();
    const [theme, setThemeState] = useState(initialTheme);
    const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(initialTheme));
    useEffect(() => {
        const nextResolved = resolveTheme(theme);
        setResolvedTheme(nextResolved);
        applyResolvedTheme(nextResolved);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        }
        catch {
            // ignore
        }
    }, [theme]);
    useEffect(() => {
        if (theme !== "system")
            return;
        const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
        if (!mql)
            return;
        const onChange = () => {
            const nextResolved = resolveTheme("system");
            setResolvedTheme(nextResolved);
            applyResolvedTheme(nextResolved);
        };
        if ("addEventListener" in mql)
            mql.addEventListener("change", onChange);
        else
            mql.addListener(onChange);
        return () => {
            if ("removeEventListener" in mql)
                mql.removeEventListener("change", onChange);
            else
                mql.removeListener(onChange);
        };
    }, [theme]);
    const value = useMemo(() => {
        return {
            theme,
            setTheme: setThemeState,
            resolvedTheme
        };
    }, [theme, resolvedTheme]);
    return _jsx(ThemeContext.Provider, { value: value, children: children });
}
