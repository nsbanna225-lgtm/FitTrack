import { useId, useState } from 'react';
import { chartPoints } from '../utils/progress.js';
const metrics = { weightKg: 'Weight (kg)', bmi: 'BMI (kg/m²)', waistCm: 'Waist (cm)', chestCm: 'Chest (cm)', hipsCm: 'Hips (cm)' };
export default function ProgressChart({ rows }) {
  const [metric, setMetric] = useState('weightKg');
  const title = useId();
  const { points, min, max } = chartPoints(rows, metric);
  return <section className="member-panel progress-chart"><h2>Measurement trends</h2>
    <label>Chart measurement<select value={metric} onChange={e => setMetric(e.target.value)}>{Object.entries(metrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    {!points.length ? <p>No {metrics[metric].toLowerCase()} values recorded in this period.</p> : <>
      <svg viewBox="0 0 640 230" role="img" aria-labelledby={title}><title id={title}>{metrics[metric]} from {points[0].day} to {points.at(-1).day}. Range {min} to {max}. Values in the table below.</title>
        <path d="M60 25 V190 H585" fill="none" stroke="currentColor" opacity=".3"/>
        <text x="8" y={min === max ? 114 : 44}>{max}</text>{min !== max && <text x="8" y="184">{min}</text>}
        <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3"/>
        {points.map(p => <circle key={p.day} cx={p.x} cy={p.y} r="4" fill="currentColor"><title>{p.day}: {p.value}</title></circle>)}
        <text x="60" y="217">{points[0].day}</text><text x="580" y="217" textAnchor="end">{points.at(-1).day}</text>
      </svg><p className="member-note">Measured dates only; lines connect recorded values. Vertical scale follows this metric’s range. Missing values are omitted.</p>
      <details><summary>View chart values ({points.length})</summary><div className="progress-table" role="region" aria-label="Progress chart values" tabIndex="0"><table><caption>{metrics[metric]} · selected period</caption><thead><tr><th scope="col">Date (UTC)</th><th scope="col">{metrics[metric]}</th></tr></thead><tbody>{points.map(p => <tr key={p.day}><td>{p.day}</td><td>{p.value}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>;
}

