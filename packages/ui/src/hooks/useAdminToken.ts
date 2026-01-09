import { useEffect, useState } from "react";

const STORAGE_KEY = "admin_token_session";

export function useAdminToken() {
  const [token, setTokenState] = useState<string>("");
  const [rememberSession, setRememberSession] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setTokenState(stored);
      setRememberSession(true);
    }
  }, []);

  const setToken = (value: string, remember = rememberSession) => {
    setTokenState(value);
    if (remember) {
      sessionStorage.setItem(STORAGE_KEY, value);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const setRemember = (remember: boolean) => {
    setRememberSession(remember);
    if (!remember) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else if (token) {
      sessionStorage.setItem(STORAGE_KEY, token);
    }
  };

  const clearToken = () => {
    setTokenState("");
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return { token, setToken, rememberSession, setRemember, clearToken };
}
