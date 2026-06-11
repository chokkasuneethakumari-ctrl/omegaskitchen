import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { api, clearToken, getToken, setToken, User } from "@/src/api/client";

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export type LoginResult =
  | { kind: "ok"; user: User }
  | { kind: "2fa"; twofaToken: string };

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<LoginResult>;
  verify2fa(twofaToken: string, code: string): Promise<User>;
  register(data: RegisterData): Promise<User>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  deleteAccount(): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await api<User>("/auth/me");
          setUser(me);
        }
      } catch {
        await clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const res = await api<{
        token?: string;
        user?: User;
        twofa_required?: boolean;
        twofa_token?: string;
      }>("/auth/login", { method: "POST", body: { email, password } });
      if (res.twofa_required && res.twofa_token) {
        return { kind: "2fa", twofaToken: res.twofa_token };
      }
      await setToken(res.token!);
      setUser(res.user!);
      return { kind: "ok", user: res.user! };
    },
    [],
  );

  const verify2fa = useCallback(async (twofaToken: string, code: string) => {
    const res = await api<{ token: string; user: User }>("/auth/2fa/verify", {
      method: "POST",
      body: { twofa_token: twofaToken, code },
    });
    await setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: data,
    });
    await setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await api("/auth/change-password", {
        method: "POST",
        body: { current_password: currentPassword, new_password: newPassword },
      });
    },
    [],
  );

  const deleteAccount = useCallback(async () => {
    await api("/auth/me", { method: "DELETE" });
    await clearToken();
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, verify2fa, register, changePassword, deleteAccount, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
