import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
import './styles/auth.css';
import './styles/analytics.css';
import './styles/attendance.css';
import './styles/dashboard.css';
import './styles/members.css';
import './styles/memberships.css';
import './styles/notifications.css';
import './styles/payments.css';
import './styles/progress.css';
import './styles/sessions.css';
import './styles/workouts.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);

import './styles/responsive.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/service-worker.js').catch(error => console.error('FitTrack service worker registration failed.', error));
  });
}

