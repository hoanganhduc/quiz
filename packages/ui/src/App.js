import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getSession } from "./api";
import { AppRouter } from "./router";
function useSessionState() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        getSession()
            .then((s) => setSession(s))
            .catch(() => setSession(null))
            .finally(() => setLoading(false));
    }, []);
    return { session, setSession, loading };
}
export function App() {
    const { session, setSession } = useSessionState();
    return (_jsx(AppRouter, { session: session, setSession: setSession }));
}
