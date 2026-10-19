import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import useNotifications from '../hooks/useNotifications.js';
import Icon from './Icon.jsx';
export default function NotificationBell() {
  const { user } = useAuth();
  const { data, error, loading } = useNotifications('/notifications/unread');
  const label = error ? 'Notifications, count unavailable' : loading ? 'Notifications, loading count' : `Notifications, ${data?.unread ?? 0} unread`;
  return <Link to={`/${user.role}/notifications`} className="notification-bell" aria-label={label} title={label}><Icon name="bell"/>{error ? <span aria-hidden="true">!</span> : !!data?.unread && <span aria-hidden="true">{data.unread > 99 ? '99+' : data.unread}</span>}</Link>;
}

