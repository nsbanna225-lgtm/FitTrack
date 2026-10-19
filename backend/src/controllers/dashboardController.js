import { getAdminDashboard } from '../services/dashboardService.js';

export async function adminDashboard(_req, res) {
  res.json(await getAdminDashboard());
}
