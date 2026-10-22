import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,validateImportedPlace,inspectChallenge,auditStudio} from '../lib/studio.ts';
import source from '../data/challenges.json' with {type:'json'};
test('CSV parser supports quoted commas, quotes and line breaks',()=>{
 const csv='level,name,lat,lng,clue,source,iso3\n0,"Test, City",45,12,"A place with ""history"", hills",https://example.org,FRA';
 const rows=parseCsv(csv);assert.equal(rows[0].name,'Test, City');assert.equal(rows[0].clue,'A place with "history", hills');
 const p=validateImportedPlace(rows[0]);assert.equal(p.errors.length,0);assert.equal(p.place?.published,false);
});
test('import rejects injected rows and malformed coordinates',()=>{
 assert.throws(()=>parseCsv('level,name\n0,"unterminated'));
 const q=validateImportedPlace({name:'ABC',level:'6',lat:'200',lng:'0',clue:'Not enough',source:'http://test.org'},0);
 assert(q.errors.some(x=>x.includes('latitude')));assert(q.errors.some(x=>x.includes('HTTPS')));
});
test('audit catches stages with insufficient candidate choices',()=>{
 const candidate=structuredClone(source[0]);candidate.stages[2].choices=candidate.stages[2].choices.slice(0,4);
 const c=candidate as never;
 const faults=inspectChallenge(c);assert(faults.some(x=>x.includes('five')));
 const summary=auditStudio([{...(c as object),status:'published'} as never],[]);
 assert.equal(summary.invalid.length,1);
});
