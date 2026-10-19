import api from './api.js';
export const trainerApi = {
  create: fields => api.post('/trainers', fields),
  update: (id, fields) => api.patch(`/trainers/${id}`, fields),
  profile: (id, fields) => api.patch(`/trainers/${id}/profile`, fields),
  archive: id => api.delete(`/trainers/${id}`),
  restore: id => api.post(`/trainers/${id}/restore`),
};
