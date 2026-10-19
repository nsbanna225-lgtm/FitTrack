import { useState } from 'react';
import FormField from './FormField.jsx';
import FormMessage from './FormMessage.jsx';
import MemberDialog from './MemberDialog.jsx';
import { memberApi } from '../services/members.js';
import { trainerApi } from '../services/trainers.js';
import { errorMessage, passwordError } from '../utils/auth.js';
export default function MemberAccountForm({ member, close, saved, kind = 'member' }) {
  const accountApi = kind === 'trainer' ? trainerApi : memberApi;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!member && passwordError(values.password)) { setError(passwordError(values.password)); return; }
    setBusy(true); setError('');
    try {
      if (member) await accountApi.update(member.id, values);
      else await accountApi.create(values);
      saved();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <MemberDialog title={member ? `Edit ${kind} account` : `Add a ${kind}`} close={close} busy={busy}><form onSubmit={submit} aria-busy={busy}><FormMessage>{error}</FormMessage><fieldset disabled={busy}>
    <FormField label="Full name" name="name" defaultValue={member?.name || ''} required minLength={2} maxLength={80} autoComplete="off" />
    <FormField label="Email address" name="email" type="email" defaultValue={member?.email || ''} required maxLength={254} autoComplete="off" />
    <FormField label="Phone number" name="phone" type="tel" defaultValue={member?.phone || ''} maxLength={25} />
    {!member && <FormField label="Initial password" name="password" type="password" autoComplete="new-password" required minLength={12} hint="At least 12 characters, up to 72 UTF-8 bytes. Share securely; the account owner can change it after signing in." />}
    {member && <p className="member-note">Saving an email address signs this account out of existing sessions.</p>}
    <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : member ? 'Save account' : `Create ${kind}`}</button>
  </fieldset></form></MemberDialog>;
}
