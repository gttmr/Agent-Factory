import { useCallback, useEffect, useState } from "react";

const NAME_KEY = "agent-factory:author-name";
const ROLE_KEY = "agent-factory:author-role";
const VALID_ROLES = ["developer", "business", "reviewer", "unknown"] as const;
export type AuthorRole = (typeof VALID_ROLES)[number];

function readName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function readRole(): AuthorRole {
  if (typeof window === "undefined") return "unknown";
  try {
    const raw = window.localStorage.getItem(ROLE_KEY);
    if (raw && (VALID_ROLES as readonly string[]).includes(raw)) return raw as AuthorRole;
  } catch {}
  return "unknown";
}

export function useAuthor() {
  const [name, setNameState] = useState<string>(() => readName());
  const [role, setRoleState] = useState<AuthorRole>(() => readRole());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(NAME_KEY, name);
    } catch {}
  }, [name]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ROLE_KEY, role);
    } catch {}
  }, [role]);

  const setName = useCallback((value: string) => setNameState(value), []);
  const setRole = useCallback((value: AuthorRole) => setRoleState(value), []);

  return { name, role, setName, setRole };
}
