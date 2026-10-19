import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartPoints, progressPayload } from '../src/utils/progress.js';
test('progress form preserves optional blanks as null and includes edit version', () => {
  assert.deepEqual(progressPayload({ day: '2026-01-01', notes: 'Note', weightKg: '80.5', heightCm: '', waistCm: '90', chestCm: '', hipsCm: '' }, 3),
    { day: '2026-01-01', notes: 'Note', weightKg: 80.5, heightCm: null, waistCm: 90, chestCm: null, hipsCm: null, expectedVersion: 3 });
});
test('chart handles empty, missing, single and constant values without invalid coordinates', () => {
  assert.equal(chartPoints([], 'bmi').points.length, 0);
  assert.equal(chartPoints([{ day: '2026-01-01', bmi: null }], 'bmi').points.length, 0);
  const points = chartPoints([{ day: '2026-01-01', bmi: 20 }, { day: '2026-01-02', bmi: null }, { day: '2026-01-03', bmi: 20 }], 'bmi').points;
  assert.deepEqual(points.map(p => p.y), [110, 110]);
  assert.equal(chartPoints([{ day: '2026-01-01', bmi: 20 }], 'bmi').points[0].x, 320);
});
test('chart spaces measurements by elapsed days and maps value range correctly', () => {
  const { points } = chartPoints([{ day: '2026-01-01', weightKg: 80 }, { day: '2026-01-02', weightKg: 75 }, { day: '2026-01-11', weightKg: 70 }], 'weightKg');
  assert.deepEqual(points.map(p => p.x), [60, 112, 580]);
  assert.deepEqual(points.map(p => p.y), [40, 110, 180]);
});
