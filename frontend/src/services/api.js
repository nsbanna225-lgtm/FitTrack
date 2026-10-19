import axios from 'axios';
import { sessionStore } from './sessionStore.js';

const api = axios.create({ baseURL: '/api', timeout: 12000 });
api.interceptors.request.use((config) => {
  const session = sessionStore.getSnapshot();
  if (!config.publicRequest && session.token) {
    if (session.expiresAt <= Date.now()) {
      sessionStore.expireIfCurrent(session.token);
      return Promise.reject(new axios.CanceledError('Session expired.'));
    }
    config.headers.Authorization = `Bearer ${session.token}`;
    config.sessionToken = session.token;
  }
  return config;
});
api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !error.config?.verifyUnauthorized) sessionStore.expireIfCurrent(error.config?.sessionToken);
  return Promise.reject(error);
});
export default api;

