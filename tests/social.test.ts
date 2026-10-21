import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidHandle,sortPair,rankings,periodStart,spoilerFreeShare,tierFor} from '../lib/social.ts';
test('handles and friend IDs are normalized before storage',()=>{
 assert(isValidHandle('atlas_explorer'));assert(!isValidHandle('A B'));assert(!isValidHandle('ab'));
 assert.deepEqual(sortPair('b','a'),['a','b']);
});
test('competitive rankings count one saved daily result per day',()=>{
 const players=[{user_id:'a',handle:'atlas',discoverable:true,show_on_public_boards:true},{user_id:'b',handle:'bora',discoverable:true,show_on_public_boards:true}];
 const base={mode:'daily',guesses:7,stage:5,perfect:false,finished_at:'2026-10-21T13:00:00Z'};
 const rows=[{...base,guest_key:'a',challenge_id:'2026-10-21:sample',score:300},{...base,guest_key:'a',challenge_id:'2026-10-21:other',score:700},{...base,guest_key:'b',challenge_id:'2026-10-20:sample',score:350},{...base,guest_key:'b',challenge_id:'practice',mode:'practice',score:9999}];
 const r=rankings(rows,players,'weekly','2026-10-21');
 assert.equal(r[0].handle,'atlas');assert.equal(r[0].score,700);assert.equal(r[0].days,1);assert.equal(r[1].score,350);
});
test('seasons and weeks use UTC boundaries',()=>{assert.equal(periodStart('2026-11-01','monthly'),'2026-11-01');assert.equal(periodStart('2026-10-21','weekly'),'2026-10-19');assert.equal(tierFor(35000),'Diamond')});
test('result shares never include future answers',()=>{
 const s=spoilerFreeShare(2,3,1200,[{stage:0,correct:true},{stage:1,correct:false},{stage:1,correct:true}],'2026-10-21');
 assert(s.includes('🟩🟨⬛'));assert(s.includes('www.where7.world'));assert(!s.includes('Eiffel'));
});
