import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import FormField from '../components/FormField.jsx';
import FormMessage from '../components/FormMessage.jsx';
import { errorMessage, passwordError } from '../utils/auth.js';
import Icon from '../components/Icon.jsx';

export default function SecurityPage() {
  const { changePassword } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const problem = passwordError(fields.newPassword);
    if (problem || fields.newPassword !== fields.confirmPassword) { setError(problem || 'Your passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await changePassword({ currentPassword: fields.currentPassword, newPassword: fields.newPassword }); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><p className="eyebrow">KEEP YOUR ACCOUNT YOURS</p><h1 tabIndex="-1">Account security.</h1><p>A little care goes a long way.</p></div>
    <div className="settings-grid"><section className="settings-panel"><h2>Change password</h2><p className="section-description">You’ll be signed out on all devices after your password changes.</p><form onSubmit={submit} aria-busy={busy}><FormMessage>{error}</FormMessage>
      <FormField label="Current password" name="currentPassword" type="password" autoComplete="current-password" required disabled={busy} />
      <FormField label="New password" name="newPassword" type="password" autoComplete="new-password" required minLength={12} hint="At least 12 characters, up to 72 UTF-8 bytes." disabled={busy} />
      <FormField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} disabled={busy} />
      <button className="primary-button" disabled={busy}>{busy ? 'Updating password…' : 'Update password'}</button>
    </form></section><aside className="settings-aside"><span className="card-icon"><Icon name="shield" /></span><h2>A stronger password</h2><p>Try a memorable phrase made of several unrelated words. Use a unique password for FitTrack.</p><p>Sessions last 15 minutes. Refreshing or closing this page signs you out of this browser.</p></aside></div>
  </>;
}
