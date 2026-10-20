import test from 'node:test';
import assert from 'node:assert/strict';
import {formatScore,mapCameraOffset,shouldAnimate} from '../lib/presentation.ts';
test('map camera respects desktop overlay and small screens',()=>{
 assert.deepEqual(mapCameraOffset(1200,false),[205,0]);
 assert.deepEqual(mapCameraOffset(390,false),[0,-48]);
 assert.deepEqual(mapCameraOffset(800,false),[0,0]);
 assert.deepEqual(mapCameraOffset(1200,true),[0,0]);
});
test('presentation settings never alter points and honour reduced motion',()=>{
 assert.equal(shouldAnimate(true),false);
 assert.equal(shouldAnimate(false),true);
 assert.equal(formatScore(-17),'0');
 assert.equal(formatScore(1750),'1,750');
});
