import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { errorMessage } from '../utils/auth.js';
export default function useResource(path) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ path, data: null, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ path, data: null, loading: true, error: '' });
    api.get(path, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setState({ path, data, loading: false, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ path, data: null, loading: false, error: errorMessage(error) });
    });
    return () => controller.abort();
  }, [path, version]);
  return { ...(state.path === path ? state : { data: null, loading: true, error: '' }), refresh: () => setVersion(value => value + 1) };
}
