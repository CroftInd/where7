import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {xpFromScore,levelFromXp,rankFromLevel} from '../lib/ranks.ts';
test('XP never goes below zero and uses server score',()=>{assert.equal(xpFromScore(1750),175);assert.equal(xpFromScore(-10),0)});
test('levels start at one and cap at one hundred',()=>{assert.equal(levelFromXp(0),1);assert.equal(levelFromXp(1e9),100)});
test('rank names reflect milestones',()=>{assert.equal(rankFromLevel(1),'Newcomer');assert.equal(rankFromLevel(100),'Globemaster')});
