import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTINENTS,continentFor} from '../lib/continents.ts';
import {awardAnswer,chooseArcadeQuestions,publicQuestion,isExpired,expiresAt} from '../lib/arcade.ts';
import seeds from '../data/challenges.json' with {type:'json'};
test('every atlas continent category is known',()=>{assert.equal(continentFor('FRA'),'Europe');assert.equal(continentFor('CAN'),'North America');assert.equal(continentFor('NZL'),'Oceania');assert(Object.keys(CONTINENTS).length===6)});
test('time attack never sends answers to the client',()=>{
 const c=structuredClone(seeds[0]);
 c.status='published';c.stages.slice(1).forEach(s=>s.choices=s.choices.slice(0,5));
 const rows=chooseArcadeQuestions([c as never],()=>0.2);
 assert(rows.length<=1);
 if(rows.length){const payload=JSON.stringify(publicQuestion(rows[0]));assert(!payload.includes('"answer"'));assert.equal(awardAnswer(rows[0],rows[0].answer),100);assert.equal(awardAnswer(rows[0],'not a place'),0)}
});
test('timer expires using the server clock',()=>{const x=expiresAt('2026-10-21T00:00:00Z');assert.equal(x,'2026-10-21T00:03:00.000Z');assert(isExpired(x,new Date('2026-10-21T00:03:01Z')))});
