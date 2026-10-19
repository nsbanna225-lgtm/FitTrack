import { useServerHealth } from '../hooks/useServerHealth.js';

export default function ServerStatus() {
  const { status, retry } = useServerHealth();
  const labels = { checking: 'Checking server…', online: 'Backend connected', offline: 'Backend unavailable' };
  return (
    <div className="server-status">
      <span className={`status-label ${status}`} role="status"><i aria-hidden="true" />{labels[status]}</span>
      <button onClick={retry} disabled={status === 'checking'}>Check connection <span aria-hidden="true">↗</span></button>
    </div>
  );
}
