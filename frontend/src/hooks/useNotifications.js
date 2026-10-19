import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import api from '../services/api.js';
import { errorMessage } from '../utils/auth.js';
export const notificationsChanged = () => window.dispatchEvent(new Event('fittrack:notifications'));
export default function useNotifications(path) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const key = `${user.id}:${path}`;
  const [state, setState] = useState({ key, data: null, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const { data } = await api.get(path, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ key, data, loading: false, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setState({ key, data: null, loading: false, error: errorMessage(error) });
      } finally { pending = false; }
    }
    setState({ key, data: null, loading: true, error: '' });
    void load();
    const timer = setInterval(load, 60000);
    window.addEventListener('focus', load);
    window.addEventListener('fittrack:notifications', refresh);
    document.addEventListener('visibilitychange', load);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('fittrack:notifications', refresh); document.removeEventListener('visibilitychange', load); };
  }, [key, path, pathname, revision, refresh]);
  return { ...(state.key === key ? state : { data: null, loading: true, error: '' }), refresh };
}
