import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('lapa-logout', onLogout);
    return () => window.removeEventListener('lapa-logout', onLogout);
  }, []);

  const finish = (d) => { setToken(d.token); setUser(d.user); return d.user; };
  const login = useCallback((email, password) => api.post('/auth/login', { email, password }).then(finish), []);
  const register = useCallback((data) => api.post('/auth/register', data).then(finish), []);
  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
