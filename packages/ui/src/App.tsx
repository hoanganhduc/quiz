import { useEffect, useState } from "react";
import { getSession, Session } from "./api";
import { AppRouter } from "./router";

function useSessionState() {
  const [session, setSession] = useState<Session | null>(null);
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
  return (
    <AppRouter session={session} setSession={setSession} />
  );
}
