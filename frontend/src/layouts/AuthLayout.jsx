import { Link, Outlet } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import Icon from '../components/Icon.jsx';

export default function AuthLayout() {
  return <div className="auth-layout">
    <aside className="auth-story">
      <Brand light />
      <div className="auth-story-copy"><p className="eyebrow">MAKE ROOM FOR PROGRESS</p><h2>Your next<br />chapter.<br /><em>A stronger you.</em></h2><p>A place for your ambition, your people, and the small steps that make a difference.</p></div>
      <div className="auth-track" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="auth-story-footer"><span>ONE STEP. EVERY DAY.</span><Icon name="arrow" /></div>
    </aside>
    <div className="auth-main">
      <header className="auth-topbar"><Link to="/" className="back-link">← Back to FitTrack</Link><span>YOUR FITNESS. CONNECTED.</span></header>
      <main className="auth-form-area" id="main-content"><Outlet /></main>
      <footer className="auth-footer">FitTrack · Built for a stronger everyday.</footer>
    </div>
  </div>;
}
