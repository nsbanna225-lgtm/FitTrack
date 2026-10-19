import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import Icon from '../components/Icon.jsx';

const content = {
  admin: { title: 'Bring your community together.', text: 'Your admin account is ready. Start by reviewing your profile and account security.', upcoming: ['Member management', 'Memberships & payments', 'Business insights'] },
  trainer: { title: 'Inspire the next step.', text: 'Your trainer account is ready. Make sure your profile is up to date before your next chapter begins.', upcoming: [] },
  member: { title: 'Make progress your own.', text: 'Your member account is ready. Take a moment to complete your profile and make yourself at home.', upcoming: [] },
};
export default function WorkspaceHomePage() {
  const { user } = useAuth();
  const copy = content[user.role];
  return <>
    <div className="page-heading"><p className="eyebrow">YOUR SPACE TO GROW</p><h1 tabIndex="-1">Welcome, {user.name.split(' ')[0]}.</h1><p>A fresh start. A little intention. A stronger everyday.</p></div>
    <section className="workspace-welcome"><div><span className="welcome-kicker">LET’S GET YOU SETTLED</span><h2>{copy.title}</h2><p>{copy.text}</p><Link to={`/${user.role}/profile`} className="light-button">Review my profile<Icon name="arrow" /></Link></div><div className="welcome-orbit" aria-hidden="true"><i /><i /><i /><span>f.</span></div></section>
    <div className="account-cards"><Link className="account-card" to={`/${user.role}/notifications`}><span className="card-icon"><Icon name="bell" /></span><div><h2>Your notifications</h2><p>Read booking updates and reminders.</p></div><Icon name="arrow" /></Link><Link className="account-card" to={`/${user.role}/progress`}><span className="card-icon"><Icon name="grid" /></span><div><h2>Fitness progress</h2><p>Measurements, charts, notes, and workout completion.</p></div><Icon name="arrow" /></Link>{user.role === 'member' && <Link className="account-card" to="/member/attendance"><span className="card-icon"><Icon name="check" /></span><div><h2>Your attendance</h2><p>Check in today and view your attendance dashboard.</p></div><Icon name="arrow" /></Link>}<Link className="account-card" to={`/${user.role}/workouts`}><span className="card-icon"><Icon name="check" /></span><div><h2>Your workouts</h2><p>View workout plans and exercise completion.</p></div><Icon name="arrow" /></Link><Link className="account-card" to={`/${user.role}/sessions`}><span className="card-icon"><Icon name="grid" /></span><div><h2>Your sessions</h2><p>View your schedule and manage upcoming sessions.</p></div><Icon name="arrow" /></Link>
      <Link className="account-card" to={`/${user.role}/profile`}><span className="card-icon"><Icon name="user" /></span><div><h2>Your profile</h2><p>Keep your name and contact details up to date.</p></div><Icon name="arrow" /></Link>
      <Link className="account-card" to={`/${user.role}/security`}><span className="card-icon"><Icon name="shield" /></span><div><h2>Account security</h2><p>A strong password is a good place to start.</p></div><Icon name="arrow" /></Link>
    </div>
    {!!copy.upcoming.length && <section className="coming-section"><div><p className="eyebrow">LOOKING AHEAD</p><h2>More ways to move forward.</h2><p>Your fitness tools are on the way. They’ll appear here as they become available.</p></div><ul>{copy.upcoming.map((item) => <li key={item}><span>{item}</span><small>Coming soon</small></li>)}</ul></section>}
  </>;
}
