import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveShortLink } from "../api";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
export function ShortLinkRedirect() {
    const { code = "" } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!code) {
            setError("Missing short link code.");
            return;
        }
        let cancelled = false;
        resolveShortLink(code)
            .then((res) => {
            if (cancelled)
                return;
            navigate(`/exam/${encodeURIComponent(res.subject)}/${encodeURIComponent(res.examId)}`, { replace: true });
        })
            .catch((err) => {
            if (cancelled)
                return;
            setError(err?.message ?? "Short link not found.");
        });
        return () => {
            cancelled = true;
        };
    }, [code, navigate]);
    return (_jsx(PageShell, { maxWidth: "md", className: "py-8", children: _jsxs(Card, { className: "space-y-3", children: [_jsx("div", { className: "text-base font-semibold text-text", children: "Opening exam…" }), _jsx("div", { className: "text-sm text-textMuted", children: error ?? "If nothing happens, the short link may be invalid." }), error ? (_jsx(Button, { type: "button", variant: "secondary", onClick: () => navigate("/"), children: "Go home" })) : null] }) }));
}
