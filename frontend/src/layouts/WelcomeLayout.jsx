import { Link } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { homeFor } from '../utils/auth.js';
export default function WelcomeLayout({ children }) {
  const { user } = useAuth();
  return <div className="site-shell">
    <header className="site-header"><Brand /><span className="header-label">ADVANCED FITNESS MANAGEMENT</span>
      <nav className="landing-actions" aria-label="Account navigation">{user ? <Link className="nav-join" to={homeFor(user.role)}>My workspace ↗</Link> : <><Link to="/login">Sign in</Link><Link className="nav-join" to="/register">Join FitTrack ↗</Link></>}</nav>
    </header><main>{children}</main><footer><span>FitTrack · Built for a stronger everyday.</span><span>KEEP SHOWING UP.</span></footer>
  </div>;
}
