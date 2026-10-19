import api from './api.js';
export const memberApi = {
  create: fields => api.post('/members', fields),
  update: (id, fields) => api.patch(`/members/${id}`, fields),
  profile: (id, fields) => api.patch(`/members/${id}/profile`, fields),
  archive: id => api.delete(`/members/${id}`),
  restore: id => api.post(`/members/${id}/restore`),
};
