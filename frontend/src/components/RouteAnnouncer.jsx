import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  useEffect(() => {
    const label = /^\/(admin|trainer|member)\/workouts\/assignments\/[a-f0-9]{24}$/i.test(pathname) ? 'Workout details' : /^\/admin\/members\/[a-f0-9]{24}$/i.test(pathname) ? 'Member profile' : pathname.split('/').filter(Boolean).at(-1) || 'Home';
    document.title = `${label.replaceAll('-', ' ')} | FitTrack`;
    window.scrollTo(0, 0);
    document.querySelector('main h1')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
