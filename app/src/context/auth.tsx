import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, ApiError, type User } from '@/lib/api';
import { deleteToken, getToken, setToken } from '@/lib/token-storage';

type AuthContextValue = {
  /** The signed-in user, or null when logged out. */
  user: User | null;
  /** Bearer token for authenticated API calls, or null when logged out. */
  token: string | null;
  /** True while the stored session is being restored on launch. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Replace the cached user after the API returns an updated one (e.g. onboarding). */
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the session on launch: with a stored token, fetch the current user;
  // if the token is missing/expired/invalid, drop it and start logged out.
  useEffect(() => {
    (async () => {
      try {
        const stored = await getToken();
        if (stored) {
          const res = await api.me(stored);
          setUser(res.user);
          setTokenState(stored);
        }
      } catch (err) {
        // Only drop the token when the API rejected it (401 expired/invalid, or
        // 404 account gone). A network failure (status 0) or server error just
        // means we couldn't check — keep the session for the next launch.
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          await deleteToken();
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await setToken(res.token);
    setUser(res.user);
    setTokenState(res.token);
  };

  const register = async (email: string, password: string) => {
    const res = await api.register(email, password);
    await setToken(res.token);
    setUser(res.user);
    setTokenState(res.token);
  };

  const signOut = async () => {
    await deleteToken();
    setUser(null);
    setTokenState(null);
  };

  const updateUser = (next: User) => setUser(next);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, register, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
