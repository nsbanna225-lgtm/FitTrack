import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function ForgotPasswordPage() {
  return <section className="auth-card">
    <span className="page-symbol"><Icon name="shield" /></span><p className="eyebrow">ACCOUNT RECOVERY</p>
    <h1 tabIndex="-1">Need a fresh start?</h1><p className="auth-subtitle">Password recovery by email is not available yet. We cannot send you a reset link at this time.</p>
    <div className="info-panel"><strong>Still signed in?</strong><p>You can change your password from Account security using your current password.</p></div>
    <Link className="primary-button" to="/login">Back to sign in<Icon name="arrow" /></Link>
  </section>;
}
