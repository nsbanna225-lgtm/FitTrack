import { useEffect, useState } from 'react';
import { fetchAdminDashboard } from '../services/dashboard.js';
import { errorMessage } from '../utils/auth.js';

export default function useAdminDashboard() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ ...previous, loading: true, error: '' }));
    fetchAdminDashboard(controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false,
        error: error.response?.status === 403 ? 'Your account no longer has administrator access.' : errorMessage(error),
        ...(error.response?.status === 403 ? { data: null } : {}) }));
    });
    return () => controller.abort();
  }, [attempt]);
  return { ...state, refresh: () => setAttempt(value => value + 1) };
}
