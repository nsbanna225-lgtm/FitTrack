import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import FormField from '../components/FormField.jsx';
import FormMessage from '../components/FormMessage.jsx';
import Icon from '../components/Icon.jsx';
import { errorMessage } from '../utils/auth.js';

export default function LoginPage() {
  const { login, notice } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try { await login({ email: fields.email.trim(), password: fields.password, role: fields.role }); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <section className="auth-card">
    <p className="eyebrow">GOOD TO SEE YOU AGAIN</p><h1 tabIndex="-1">Welcome back.</h1><p className="auth-subtitle">Sign in and pick up where you left off.</p>
    <FormMessage success>{notice}</FormMessage>
    <form onSubmit={submit} aria-busy={busy}>
      <FormMessage>{error}</FormMessage>
      <FormField label="Email address" name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} disabled={busy} />
      <FormField label="Password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required disabled={busy} />
      <div className="form-link-row"><Link to="/forgot-password">Forgot password?</Link></div>
      <div className="form-field">
        <label htmlFor="login-role">Login as</label>
        <select id="login-role" className="login-role" name="role" defaultValue="member" required disabled={busy}>
          <option value="member">Member</option>
          <option value="trainer">Trainer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<Icon name="arrow" /></button>
    </form>
    <p className="auth-switch">New to FitTrack? <Link to="/register">Create an account</Link></p>
    <p className="auth-footnote"><Icon name="shield" />For your security, refreshing the page signs you out.</p>
  </section>;
}
