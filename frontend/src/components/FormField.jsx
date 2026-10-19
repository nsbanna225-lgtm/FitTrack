import { useId, useState } from 'react';
export default function FormField({ label, hint, type = 'text', ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  return <div className="form-field">
    <label htmlFor={id}>{label}</label>
    <div className={password ? 'password-input' : ''}>
      <input id={id} type={password && visible ? 'text' : type} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {password && <button className="password-toggle" type="button" onClick={() => setVisible(!visible)} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? 'Hide' : 'Show'}</button>}
    </div>
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>;
}
