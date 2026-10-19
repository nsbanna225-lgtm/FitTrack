import { useEffect, useState } from 'react';
import { fetchHealth } from '../services/health.js';

export function useServerHealth() {
  const [status, setStatus] = useState('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setStatus('checking');
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetchHealth(controller.signal)
      .then(() => { if (active) setStatus('online'); })
      .catch(() => { if (active) setStatus('offline'); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  return { status, retry: () => setAttempt((value) => value + 1) };
}
