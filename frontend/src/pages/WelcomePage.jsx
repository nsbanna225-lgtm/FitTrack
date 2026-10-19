import WelcomeLayout from '../layouts/WelcomeLayout.jsx';
import ServerStatus from '../components/ServerStatus.jsx';

const foundations = [
  ['01', 'A connected experience', 'One workspace for members, trainers, and your fitness community.'],
  ['02', 'Room to grow', 'Manage sessions, workouts, memberships, and attendance.'],
  ['03', 'Progress with purpose', 'Track measurements, workout completion, and community trends.'],
];

export default function WelcomePage() {
  return (
    <WelcomeLayout>
      <section className="hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <p className="eyebrow"><span /> YOUR NEXT CHAPTER STARTS HERE</p>
          <h1 id="welcome-title">Fitness.<br />Connected.<br /><em>Elevated.</em></h1>
          <p className="hero-description">Bring your fitness community together. Manage memberships, book sessions, follow workouts, and track progress with FitTrack.</p>
          <ServerStatus />
          <p className="foundation-note">Sign in to your workspace or create a member account to get started.</p>
        </div>
        <div className="hero-art" role="img" aria-label="Abstract running track, representing steady progress">
          <div className="art-top"><span>CONSISTENCY IS EVERYTHING.</span><span>↗</span></div>
          <div className="track track-one" /><div className="track track-two" /><div className="track track-three" /><div className="track track-four" />
          <div className="art-bottom"><span>START STRONG.<br />KEEP MOVING.</span><span className="art-number">01<span>/DAY</span></span></div>
        </div>
      </section>
      <section className="foundation-grid" aria-label="Explore FitTrack">
        {foundations.map(([number, title, description]) => (
          <article key={number}><span className="card-number">{number} /</span><h2>{title}</h2><p>{description}</p><span className="planned">FITTRACK FEATURES</span></article>
        ))}
      </section>
    </WelcomeLayout>
  );
}

