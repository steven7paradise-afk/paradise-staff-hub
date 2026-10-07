import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shiftDeadline} from '../lib/shift-deadline';
test('deadline is 19:30 in Rome in summer and winter',()=>{assert.equal(new Date(shiftDeadline('2026-10-07')).toISOString(),'2026-10-07T17:30:00.000Z');assert.equal(new Date(shiftDeadline('2026-12-07')).toISOString(),'2026-12-07T18:30:00.000Z');});
test('deadline follows Rome daylight saving transitions',()=>{assert.equal(new Date(shiftDeadline('2026-03-29')).toISOString(),'2026-03-29T17:30:00.000Z');assert.equal(new Date(shiftDeadline('2026-10-25')).toISOString(),'2026-10-25T18:30:00.000Z');});
