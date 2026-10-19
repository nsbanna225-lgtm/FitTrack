import { Link } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { homeFor } from '../utils/auth.js';
export default function ErrorPage({ forbidden = false }) {
  const { user } = useAuth();
  return <div className="error-page"><Brand /><main><p className="eyebrow">{forbidden ? '403 / ACCESS RESTRICTED' : '404 / PAGE NOT FOUND'}</p><h1 tabIndex="-1">{forbidden ? 'A different workspace.' : 'A small detour.'}</h1><p>{forbidden ? 'This page is reserved for a different account role. Your workspace is waiting for you.' : 'We couldn’t find that page. Let’s get you back on track.'}</p><Link className="primary-button" to={user ? homeFor(user.role) : '/'}>{user ? 'Go to my workspace' : 'Back to FitTrack'}</Link></main></div>;
}
