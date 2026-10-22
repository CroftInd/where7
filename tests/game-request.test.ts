import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCurrentRequest,GameConflict,utcDay,nextDailyReset} from '../lib/game-request.ts';
import {guess,newSession,publicGame,useHint} from '../lib/engine.ts';
import {gameEvent,transitionEvents} from '../lib/game-events.ts';
import seeds from '../data/challenges.json' with {type:'json'};
import type {Challenge} from '../lib/types.ts';
const challenge=seeds.find(c=>c.id==='london') as Challenge;
const day='2026-10-22';
const request=(s:ReturnType<typeof newSession>)=>({challengeId:s.challengeId,stage:s.stage,version:s.version,dailyDate:day});

test('retrying a wrong guess is stale even though the stage did not advance',()=>{
  const initial=newSession('london','daily');const body=request(initial);
  assert.doesNotThrow(()=>assertCurrentRequest(body,initial,day));
  const saved=guess(initial,challenge,'Canada');
  assert.equal(saved.stage,initial.stage);
  assert.throws(()=>assertCurrentRequest(body,saved,day),e=>e instanceof GameConflict&&e.code==='STALE_SESSION');
  assert.equal(saved.guesses,1);
});
test('a hint or another tab invalidates the old confirmation',()=>{
  const s=newSession('london','daily');const hinted=useHint(s);
  assert.throws(()=>assertCurrentRequest(request(s),hinted,day),GameConflict);
  assert.doesNotThrow(()=>assertCurrentRequest(request(hinted),hinted,day));
});
test('missing, invalid and mismatched versions cannot spend a chance',()=>{
  const s=newSession('london','practice');
  for(const version of [undefined,-1,'0',0.5,NaN,Infinity])
    assert.throws(()=>assertCurrentRequest({...request(s),version},s,day),GameConflict);
  assert.throws(()=>assertCurrentRequest({...request(s),challengeId:'nyc'},s,day),GameConflict);
});
test('daily screens cannot submit into the next UTC day, including a repeated puzzle',()=>{
  const s=newSession('london','daily');
  assert.throws(()=>assertCurrentRequest(request(s),s,'2026-10-23'),e=>e instanceof GameConflict&&e.code==='DAILY_CHANGED');
  assert.equal(utcDay(new Date('2026-10-22T23:59:59.999Z')),day);
  assert.equal(utcDay(new Date('2026-10-23T00:00:00.000Z')),'2026-10-23');
  assert.equal(nextDailyReset('2026-12-31'),'2027-01-01T00:00:00.000Z');
});
test('public state includes version but no locked answer',()=>{
  const s=guess(newSession('london','daily'),challenge,'Canada');
  const result=publicGame(s,challenge,true);
  assert.equal(result.version,1);assert.equal(result.hearts,6);
  assert(!JSON.stringify(result).includes(challenge.stages[6].answer));
});
test('events distinguish accepted wrong guesses from rejected requests without place data',()=>{
  const s=newSession('london','daily');const wrong=guess(s,challenge,'Canada');
  assert.deepEqual(transitionEvents(s,wrong),['game_started','guess_accepted']);
  const correct=guess(s,challenge,challenge.stages[0].answer);
  assert.deepEqual(transitionEvents(s,correct),['game_started','guess_accepted','stage_reached']);
  const event=gameEvent('guess_accepted',wrong,'opaque-session',day);
  const serialized=JSON.stringify(event);
  for(const privateValue of ['Canada','london','United Kingdom','answer','clue','guest_key'])assert(!serialized.includes(privateValue));
});
test('completion and abandonment events happen only on transitions',()=>{
  let s=newSession('london','practice');
  for(let i=0;i<6;i++)s=guess(s,challenge,challenge.stages[i].answer);
  const finished=guess(s,challenge,challenge.stages[6].answer);
  assert.deepEqual(transitionEvents(s,finished),['guess_accepted','stage_reached','game_completed']);
  assert.deepEqual(transitionEvents(finished,finished),[]);
  assert.deepEqual(transitionEvents(s,{...s,status:'abandoned'}),['game_abandoned']);
});
