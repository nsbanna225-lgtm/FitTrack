import api from './api.js';
export const membershipApi = {
  createPlan: fields => api.post('/memberships/plans',fields),
  updatePlan: (id,fields) => api.patch(`/memberships/plans/${id}`,fields),
  enroll: (id,fields) => api.post(`/memberships/members/${id}`,fields),
  renew: (id,fields) => api.post(`/memberships/members/${id}/renew`,fields),
};
export const money = (amount,currency='INR') => new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(amount/100);
export const calendarDate = value => new Date(value).toLocaleDateString('en',{dateStyle:'medium',timeZone:'UTC'});
export function parsePrice(value) {
  if (!/^(0|[1-9][0-9]{0,6})(\.[0-9]{1,2})?$/.test(value)) throw new Error('Enter a price with up to two decimal places.');
  const [whole,fraction=''] = value.split('.');
  const price = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (price > 100000000) throw new Error('Price must not exceed ₹10,00,000.');
  return price;
}
