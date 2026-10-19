import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import FormMessage from '../components/FormMessage.jsx';
import { authApi } from '../services/auth.js';
import { passwordError, errorMessage } from '../utils/auth.js';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get('token') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const problem = passwordError(fields.password);
    if (problem || fields.password !== fields.confirmPassword) { setError(problem || 'Your passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await authApi.resetPassword({ token, password: fields.password }); setDone(true); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  const validToken = /^[a-f0-9]{64}$/.test(token);
  return <section className="auth-card"><p className="eyebrow">ACCOUNT RECOVERY</p><h1 tabIndex="-1">A new password.</h1>
    {done ? <><FormMessage success>Your password has been reset. Sign in with your new password.</FormMessage><Link className="primary-button" to="/login">Back to sign in</Link></> : !validToken ? <><p className="auth-subtitle">This reset link is missing or invalid. Password recovery by email is not available yet.</p><Link className="primary-button" to="/login">Back to sign in</Link></> : <>
      <p className="auth-subtitle">Choose a strong password you have not used before.</p>
      <form onSubmit={submit} aria-busy={busy}><FormMessage>{error}</FormMessage>
        <FormField label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} hint="At least 12 characters, up to 72 UTF-8 bytes." disabled={busy} />
        <FormField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} disabled={busy} />
        <button className="primary-button" disabled={busy}>{busy ? 'Updating password…' : 'Reset password'}</button>
      </form></>}
  </section>;
}
