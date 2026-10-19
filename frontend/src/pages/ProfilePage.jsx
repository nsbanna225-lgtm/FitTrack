import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import FormField from '../components/FormField.jsx';
import FormMessage from '../components/FormMessage.jsx';
import { errorMessage } from '../utils/auth.js';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError(''); setSaved(false);
    try { await updateProfile({ name: fields.name.trim(), phone: fields.phone.trim() }); setSaved(true); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><p className="eyebrow">THE PERSON BEHIND THE PROGRESS</p><h1 tabIndex="-1">My profile.</h1><p>Your details, all in one place.</p></div>
    <div className="settings-grid"><section className="settings-panel"><h2>Personal information</h2><p className="section-description">Keep your profile current so your community can get to know you.</p>
      <form key={user.updatedAt} onSubmit={submit} aria-busy={busy}><FormMessage>{error}</FormMessage><FormMessage success>{saved ? 'Your profile has been saved.' : ''}</FormMessage>
        <FormField label="Full name" name="name" autoComplete="name" defaultValue={user.name} required minLength={2} maxLength={80} disabled={busy} />
        <FormField label="Phone number (optional)" name="phone" type="tel" autoComplete="tel" defaultValue={user.phone} maxLength={25} disabled={busy} />
        <FormField label="Email address" type="email" value={user.email} readOnly hint="Your email is used to sign in and cannot be changed here." />
        <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form></section>
      <aside className="settings-aside"><span className="role-badge">{user.role}</span><h2>Your FitTrack account</h2><dl><dt>Member since</dt><dd>{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(user.createdAt))}</dd><dt>Account access</dt><dd>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</dd></dl><p>Your account role is managed by an administrator.</p></aside>
    </div></>;
}
