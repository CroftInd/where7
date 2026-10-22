import {readFileSync} from 'node:fs';
import {contentIssues,duplicateDestinations,reviewCandidates,planBuffer} from '../lib/content-quality.ts';
import {continentFor} from '../lib/continents.ts';
const path=process.argv[2];
if(!path)throw Error('Usage: npm run content:audit -- /path/to/catalog.json (array of database rows or Challenge objects)');
const rows=JSON.parse(readFileSync(path,'utf8'));
if(!Array.isArray(rows))throw Error('Catalog must be a JSON array.');
const challenges=rows.map(c=>({...c,countryIso3:(c.countryIso3||c.country_iso3||'').trim(),publishDate:c.publishDate||c.publish_date||null,reviewStatus:c.reviewStatus||c.review_status||'draft'}));
const reports=challenges.map(c=>({id:c.id,issues:contentIssues(c)}));
console.log(JSON.stringify({auditedAt:new Date().toISOString(),challenges:challenges.length,countries:new Set(challenges.map(c=>c.countryIso3)).size,
 continents:[...new Set(challenges.map(c=>continentFor(c.countryIso3)))].filter(Boolean),
 duplicateDestinations:duplicateDestinations(challenges),
 genericClueChallenges:reports.filter(r=>r.issues.some(i=>i.code==='generic_clue')).length,
 equivalentChoiceChallenges:reports.filter(r=>r.issues.some(i=>i.code==='equivalent_choices')).length,
 missingEvidenceStages:reports.reduce((n,r)=>n+r.issues.filter(i=>i.code==='place_evidence').length,0),
 approvedCurrent:challenges.filter(c=>c.reviewStatus==='approved').length,
 reviewBatch:reviewCandidates(challenges).map(c=>({id:c.id,country:c.countryIso3,continent:continentFor(c.countryIso3)})),
 approvedProposal:planBuffer(challenges,new Date(Date.now()+86400000).toISOString().slice(0,10)),
 issues:reports},null,2));
