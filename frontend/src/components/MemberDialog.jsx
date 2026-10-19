import { useEffect, useId, useRef } from 'react';
export default function MemberDialog({ title, busy, close, children }) {
  const dialog = useRef(null);
  const heading = useId();
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  return <dialog ref={dialog} className="member-dialog" aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) close(); }}><div className="member-dialog-heading"><h2 id={heading}>{title}</h2><button type="button" className="secondary-button" onClick={close} disabled={busy} aria-label="Close dialog">Close</button></div>{children}</dialog>;
}
