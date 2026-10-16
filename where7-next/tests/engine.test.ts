import test from 'node:test';
import assert from 'node:assert/strict';
import {guess,newSession,normalized,publicGame,useHint,validateChallenge} from '../lib/engine.ts';
import originals from '../data/challenges.json' with {type:'json'};
import type {Challenge} from '../lib/types.ts';
const challenge=originals.find(c=>c.id==='london') as Challenge;
test('exactly seven perfect guesses reach the building and win',()=>{
  let s=newSession('london','daily');
  for(let i=0;i<7;i++){s=guess(s,challenge,challenge.stages[i].answer);assert.equal(s.guesses,i+1);assert.equal(s.stage,i+1)}
  assert.equal(s.status,'won');assert.equal(s.guesses,7);assert.equal(s.history.every(v=>v.correct),true);
  assert.equal(publicGame(s,challenge,true).current,null);
  assert.throws(()=>guess(s,challenge,'anything'));
});
test('one wrong guess locks the building even after six correct answers',()=>{
  let s=newSession('london','daily');
  s=guess(s,challenge,'Canada');assert.equal(s.stage,0);assert.equal(s.guesses,1);
  for(let i=0;i<6;i++)s=guess(s,challenge,challenge.stages[i].answer);
  assert.equal(s.guesses,7);assert.equal(s.stage,6);assert.equal(s.status,'lost');
  assert.equal(publicGame(s,challenge,false).current,null);
  assert(!publicGame(s,challenge,false).path.includes('10 Downing Street'));
});
test('seven wrong guesses exhaust hearts without progression',()=>{
  let s=newSession('london','practice');for(let i=0;i<7;i++)s=guess(s,challenge,'Canada');
  assert.equal(s.status,'lost');assert.equal(s.stage,0);assert.equal(s.score,0);assert.equal(publicGame(s,challenge,true).hearts,0);
});
test('hints do not cost hearts, but reduce correct-stage points',()=>{
  let s=newSession('london','practice');s=useHint(s);s=useHint(s);
  assert.equal(s.guesses,0);assert.deepEqual(s.hints,[0]);
  s=guess(s,challenge,'United Kingdom');assert.equal(s.score,875);
});
test('canonical map aliases are recognised',()=>{
  assert.equal(normalized('United States of America'),normalized('United States'));
  assert.equal(normalized('UK'),normalized('United Kingdom'));
});
test('invalid or out-of-stage guesses rejected',()=>{
  let s=newSession('london','practice');s=guess(s,challenge,'United Kingdom');
  assert.throws(()=>guess(s,challenge,'Atlantis'));
  assert.throws(()=>guess(s,challenge,'London'));
});
test('authoring validation catches missing sources and answer choices',()=>{
  const c=structuredClone(challenge);c.stages[5].source='';c.stages[6].choices=[];
  const result=validateChallenge(c);assert.equal(result.valid,false);
  if(!result.valid)assert(result.errors.length>=2);
});
test('both bundled challenges satisfy authoring schema',()=>{
  for(const c of originals){const result=validateChallenge(c);assert.equal(result.valid,true,JSON.stringify(result));}
});
test('wrong guesses cannot ever reveal a future-stage statement',()=>{
  let s=newSession('london','daily');
  for(let i=0;i<3;i++)s=guess(s,challenge,'Canada');
  const view=publicGame(s,challenge,false);
  assert.equal(view.stage,0);assert.equal(view.current?.clue,challenge.stages[0].clue);
  assert(!JSON.stringify(view).includes(challenge.stages[6].clue));
});
test('playing sessions do not expose future answers or clue evidence URLs',()=>{
  const s=newSession('nyc','daily');
  const ny=originals.find(c=>c.id==='nyc') as Challenge;
  const payload=JSON.stringify(publicGame(s,ny,false));
  assert(!payload.includes('Empire State Building'));
  assert(!payload.includes('esbnyc.com'));
  assert(!payload.includes('One Vanderbilt'));
});
