import api from './api.js';
export async function fetchHealth(signal) {
  const { data } = await api.get('/health', { signal, publicRequest: true });
  if (data.status !== 'ok') throw new Error('Unexpected health response');
  return data;
}
