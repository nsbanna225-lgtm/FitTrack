export const measurements = [
  ['weightKg', 'Weight (kg)', 1, 500], ['heightCm', 'Height (cm)', 30, 250],
  ['waistCm', 'Waist (cm)', 1, 300], ['chestCm', 'Chest (cm)', 1, 300], ['hipsCm', 'Hips (cm)', 1, 300],
];
export function progressPayload(values, version) {
  return { day: values.day, notes: values.notes, ...Object.fromEntries(measurements.map(([key]) => [key, values[key] === '' ? null : Number(values[key])])), ...(version ? { expectedVersion: version } : {}) };
}
export function chartPoints(rows, metric) {
  const values = rows.filter(row => Number.isFinite(row[metric]));
  if (!values.length) return { points: [], min: null, max: null };
  const min = Math.min(...values.map(row => row[metric])), max = Math.max(...values.map(row => row[metric]));
  const first = Date.parse(values[0].day), last = Date.parse(values.at(-1).day);
  return { min, max, points: values.map(row => ({ day: row.day, value: row[metric],
    x: first === last ? 320 : 60 + (Date.parse(row.day) - first) / (last - first) * 520,
    y: min === max ? 110 : 180 - (row[metric] - min) / (max - min) * 140 })) };
}
