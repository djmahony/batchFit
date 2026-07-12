import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, type User } from '@/lib/api';
import { deleteToken, getToken, setToken } from '@/lib/token-storage';

type AuthContextValue = {
  /** The signed-in user, or null when logged out. */
  user: User | null;
  /** True while the stored session is being restored on launch. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the session on launch: with a stored token, fetch the current user;
  // if the token is missing/expired/invalid, drop it and start logged out.
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const res = await api.me(token);
          setUser(res.user);
        }
      } catch {
        await deleteToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await setToken(res.token);
    setUser(res.user);
  };

  const register = async (email: string, password: string) => {
    const res = await api.register(email, password);
    await setToken(res.token);
    setUser(res.user);
  };

  const signOut = async () => {
    await deleteToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
