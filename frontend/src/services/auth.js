import api from './api.js';

export const authApi = {
  registrationOptions: () => api.get('/auth/registration-options', { publicRequest: true }),
  login: (body) => api.post('/auth/login', body, { publicRequest: true }),
  register: (body) => api.post('/auth/register', body, { publicRequest: true }),
  me: () => api.get('/auth/me'),
  updateProfile: (body) => api.patch('/auth/me', body),
  logout: () => api.post('/auth/logout'),
  async changePassword(body) {
    try { return await api.post('/auth/change-password', body, { verifyUnauthorized: true }); }
    catch (error) {
      // A wrong current password is also 401. Verify the session before clearing it.
      if (error.response?.status === 401) await api.get('/auth/me');
      throw error;
    }
  },
  forgotPassword: (body) => api.post('/auth/forgot-password', body, { publicRequest: true }),
  resetPassword: (body) => api.post('/auth/reset-password', body, { publicRequest: true }),
};

