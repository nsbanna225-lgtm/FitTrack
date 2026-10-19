import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell.jsx';
import Brand from '../components/Brand.jsx';
import Icon from '../components/Icon.jsx';
import FormMessage from '../components/FormMessage.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { errorMessage } from '../utils/auth.js';

function Navigation({ role, close }) {
  return <nav className="workspace-nav" aria-label="Workspace navigation">
    <p>YOUR WORKSPACE</p>
    <NavLink end to={`/${role}`} onClick={close}><Icon name="grid" />{role === 'admin' ? 'Dashboard' : 'Overview'}</NavLink>
    {role === 'admin' && <NavLink to="/admin/members" onClick={close}><Icon name="user" />Members</NavLink>}
    {role === 'admin' && <NavLink to="/admin/analytics" onClick={close}><Icon name="grid" />Analytics</NavLink>}
    {role === 'admin' && <NavLink to="/admin/trainers" onClick={close}><Icon name="user" />Trainers</NavLink>}
    {role === 'admin' && <><NavLink to="/admin/membership-plans" onClick={close}><Icon name="shield"/>Membership plans</NavLink><NavLink to="/admin/memberships" onClick={close}><Icon name="check"/>Memberships</NavLink></>}
    {role === 'member' && <NavLink to="/member/membership" onClick={close}><Icon name="shield"/>My membership</NavLink>}
    <NavLink to={`/${role}/profile`} onClick={close}><Icon name="user" />My profile</NavLink>
    {role !== 'trainer' && <NavLink to={`/${role}/attendance`} onClick={close}><Icon name="check" />Attendance</NavLink>}
    {role !== 'trainer' && <NavLink to={`/${role}/payments`} onClick={close}><Icon name="shield" />Payments</NavLink>}
    <NavLink to={`/${role}/sessions`} onClick={close}><Icon name="grid" />Sessions</NavLink>
    <NavLink to={`/${role}/progress`} onClick={close}><Icon name="grid" />Fitness progress</NavLink>
    <NavLink to={`/${role}/workouts`} onClick={close}><Icon name="check" />Workouts</NavLink>
    <NavLink to={`/${role}/notifications`} onClick={close}><Icon name="bell" />Notifications</NavLink>
    <NavLink to={`/${role}/security`} onClick={close}><Icon name="shield" />Account security</NavLink>
  </nav>;
}
export default function RoleLayout({ role, title, tagline }) {
  const { user, logout, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const dialog = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const focusedPath = useRef(null);
  const location = useLocation();
  useEffect(() => {
    const viewport = window.matchMedia('(min-width: 801px)');
    const closeOnDesktop = () => { if (viewport.matches) dialog.current?.close(); };
    viewport.addEventListener('change', closeOnDesktop);
    return () => viewport.removeEventListener('change', closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!checking && focusedPath.current !== location.pathname) {
      document.getElementById('workspace-main')?.focus({ preventScroll: true });
      focusedPath.current = location.pathname;
    }
  }, [checking, location.pathname]);
  async function checkProfile() {
    setChecking(true); setError('');
    try { await refreshProfile(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setChecking(false); }
  }
  useEffect(() => { void checkProfile(); }, [location.pathname]);
  async function signOut() {
    if (busy) return;
    setBusy(true); setError('');
    try { await logout(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <div className={`workspace role-${role}`}>
    <a className="skip-link" href="#workspace-main">Skip to content</a>
    <aside className="workspace-sidebar"><Brand /><span className="workspace-label">{title}</span>
      <Navigation role={role} /><div className="sidebar-note"><span className="small-spark">✳</span><strong>Small steps.<br />Lasting progress.</strong><p>{tagline}</p></div>
      <button className="signout-button" onClick={signOut} disabled={busy}><Icon name="logout" />{busy ? 'Signing out…' : 'Sign out'}</button>
    </aside>
    <dialog id="workspace-navigation" aria-label={`${title} navigation`} className="mobile-dialog" ref={dialog} onClose={() => setMenuOpen(false)} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="mobile-dialog-header"><Brand /><button className="icon-button" onClick={() => dialog.current.close()} aria-label="Close navigation"><Icon name="close" /></button></div>
      <span className="workspace-label">{title}</span><Navigation role={role} close={() => dialog.current.close()} />
      <button className="signout-button" onClick={() => { dialog.current.close(); void signOut(); }} disabled={busy}><Icon name="logout" />Sign out</button>
    </dialog>
    <div className="workspace-body">
      <header className="workspace-header"><div className="workspace-breadcrumb"><button className="icon-button mobile-menu-button" aria-label="Open navigation" aria-haspopup="dialog" aria-controls="workspace-navigation" aria-expanded={menuOpen} onClick={() => { dialog.current.showModal(); setMenuOpen(true); }}><Icon name="menu" /></button><span>Workspace <b>/</b> <strong>{title}</strong></span></div>
        <div className="account-summary"><NotificationBell/><span className="role-badge">{role}</span><span className="account-name">{user.name}</span><span className="avatar" aria-hidden="true">{initials}</span></div>
      </header>
      <main className="workspace-content" id="workspace-main" tabIndex={-1}>
        {error && <div className="workspace-error"><FormMessage>{error}</FormMessage><button className="secondary-button" onClick={checkProfile} disabled={checking}>Retry connection</button></div>}
        {checking ? <div className="loading-panel" role="status"><span className="spinner" />Loading your workspace…</div> : <Outlet />}
      </main>
      <footer className="workspace-footer"><span>FitTrack · Built for a stronger everyday.</span><span>KEEP SHOWING UP.</span></footer>
    </div>
  </div>;
}
