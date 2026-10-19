import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { homeFor, safeReturnPath } from '../utils/auth.js';

export default function ProtectedRoute({ role }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
export function GuestRoute() {
  const { user } = useAuth();
  const location = useLocation();
  return user ? <Navigate to={location.pathname === '/login' ? homeFor(user.role) : safeReturnPath(location.state?.from, user.role)} replace /> : <Outlet />;
}

