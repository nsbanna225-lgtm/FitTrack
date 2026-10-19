import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice } from '../src/services/memberships.js';
test('plan prices convert exactly to paise without rounding excess precision',()=>{
  assert.equal(parsePrice('0'),0);assert.equal(parsePrice('0.29'),29);assert.equal(parsePrice('1299.5'),129950);assert.equal(parsePrice('1000000.00'),100000000);
  for(const value of ['-1','1.001','1e3','NaN','1000000.01','','01','1,000'])assert.throws(()=>parsePrice(value));
});
