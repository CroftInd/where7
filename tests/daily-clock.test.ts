import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyCountdown,nextGmtMidnight} from '../lib/daily-clock.ts';
test('daily countdown ticks to zero at GMT midnight without negative values',()=>{
 const reset='2026-10-23T00:00:00.000Z';
 assert.equal(dailyCountdown(reset,Date.parse('2026-10-22T00:00:00Z')),'24:00:00');
 assert.equal(dailyCountdown(reset,Date.parse('2026-10-22T22:57:56Z')),'01:02:04');
 assert.equal(dailyCountdown(reset,Date.parse('2026-10-22T23:59:59.500Z')),'00:00:01');
 assert.equal(dailyCountdown(reset,Date.parse(reset)),'00:00:00');
 assert.equal(dailyCountdown(reset,Date.parse(reset)+1000),'00:00:00');
});
test('GMT reset stays at 00:00 UTC across UK daylight saving changes and year rollover',()=>{
 for(const day of ['2026-03-29','2026-10-25','2026-07-01'])assert.equal(nextGmtMidnight(Date.parse(day+'T12:00:00+01:00')),new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString());
 assert.equal(nextGmtMidnight(Date.parse('2026-12-31T23:59:59Z')),'2027-01-01T00:00:00.000Z');
});
