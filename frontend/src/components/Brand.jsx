import { Link } from 'react-router-dom';
export default function Brand({ light = false }) {
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="FitTrack home"><span className="brand-mark" aria-hidden="true">f.</span>FitTrack<span className="brand-dot">®</span></Link>;
}
