import api from './api.js';
export const fetchAdminDashboard = (signal) => api.get('/dashboard/admin', { signal });
