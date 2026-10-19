import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/auth.js';
import { useAuth } from '../hooks/useAuth.js';
import FormField from '../components/FormField.jsx';
import FormMessage from '../components/FormMessage.jsx';
import Icon from '../components/Icon.jsx';
import { errorMessage, passwordError } from '../utils/auth.js';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    authApi.registrationOptions().then(({ data }) => { if (active) setOptions(data); })
      .catch(err => { if (active) setError(errorMessage(err)); });
    return () => { active = false; };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy || !options) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const problem = passwordError(fields.password);
    if (problem || fields.password !== fields.confirmPassword) { setError(problem || 'Your passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      await register({ name: fields.name.trim(), email: fields.email.trim(), password: fields.password, role: fields.role });
      navigate('/login', { replace: true });
    }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <section className="auth-card">
    <p className="eyebrow">A FRESH START</p><h1 tabIndex="-1">Start your journey.</h1><p className="auth-subtitle">Create your account. Make progress your own.</p>
    <form onSubmit={submit} aria-busy={busy}>
      <FormMessage>{error}</FormMessage>
      <FormField label="Full name" name="name" autoComplete="name" placeholder="Your full name" required minLength={2} maxLength={80} disabled={busy} />
      <FormField label="Email address" name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} disabled={busy} />
      <FormField label="Password" name="password" type="password" autoComplete="new-password" placeholder="Create a strong password" hint="Use at least 12 characters, up to 72 UTF-8 bytes." required minLength={12} disabled={busy} />
      <FormField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Enter your password again" required minLength={12} disabled={busy} />
      <div className="form-field">
        <label htmlFor="register-role">Role</label>
        <select id="register-role" className="login-role" name="role" defaultValue="member" required disabled={busy || !options}>
          {(options?.roles || ['member']).map(role => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}
        </select>
      </div>
      <button className="primary-button" disabled={busy || !options}>{busy ? 'Creating account…' : 'Create account'}<Icon name="arrow" /></button>
    </form>
    <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    <p className="auth-footnote">{options?.demo ? 'College demo: choose Member, Trainer or Admin for your demo account.' : 'Trainer and admin accounts are provided by your administrator.'}</p>
  </section>;
}
