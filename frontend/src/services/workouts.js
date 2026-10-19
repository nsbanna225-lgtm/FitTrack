import api from './api.js';
export const workoutApi = {
  saveExercise: (record, body) => record ? api.put(`/workouts/exercises/${record.id}`, body) : api.post('/workouts/exercises', body),
  savePlan: (record, body) => record ? api.put(`/workouts/plans/${record.id}`, body) : api.post('/workouts/plans', body),
  assign: (plan, memberId) => api.post(`/workouts/plans/${plan.id}/assign`, { memberId, expectedVersion: plan.version }),
  complete: (assignment, itemIndex, completed) => api.patch(`/workouts/assignments/${assignment.id}/completion`, { itemIndex, completed, expectedVersion: assignment.version }),
  archive: assignment => api.post(`/workouts/assignments/${assignment.id}/archive`, { expectedVersion: assignment.version }),
};
export function workoutPrescription(row) {
  return `${row.sets} set${row.sets === 1 ? '' : 's'} · ${[row.reps ? `${row.reps} reps` : '', row.durationSeconds ? `${row.durationSeconds}s per set` : ''].filter(Boolean).join(' · ')} · ${row.restSeconds}s rest`;
}
export function planPayload(form, items, plan) {
  return { name: form.name, instructions: form.instructions, items: items.map(row => ({
    exerciseId: row.exerciseId, day: Number(row.day), sets: Number(row.sets), reps: row.reps === '' || row.reps == null ? null : Number(row.reps),
    durationSeconds: row.durationSeconds === '' || row.durationSeconds == null ? null : Number(row.durationSeconds), restSeconds: Number(row.restSeconds), instructions: row.instructions,
  })), ...(plan ? { active: form.active, expectedVersion: plan.version } : {}) };
}
