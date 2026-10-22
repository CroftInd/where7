import type {Challenge} from './types.ts';
import {contentIssues} from './content-quality.ts';
export type ImportedPlace={name:string;level:number;parent_id:string|null;clue:string;hint:string;source:string;lat:number;lng:number;iso3:string|null;published:boolean};
export type StudioAudit={total:number;published:number;validPublished:number;invalid:{id:string;title:string;issues:string[]}[];totalPlaces:number;completePaths:number;orphanedNodes:number};
export type GeoNode={id:string;parent_id:string|null;level:number;published:boolean};
export const CSV_COLUMNS=['level','name','parent_id','lat','lng','clue','hint','source','iso3','published'] as const;
export function parseCsv(input:string):Record<string,string>[]{
 if(input.length>750_000)throw Error('CSV is too large (maximum 750 KB).');
 const lines:string[][]=[];let row:string[]=[],field='',quoted=false,endedQuote=false;
 const content=input.replace(/^\uFEFF/,'');
 for(let i=0;i<content.length;i++){
  const ch=content[i];
  if(quoted){if(ch==='"'){if(content[i+1]==='"'){field+='"';i++}else{quoted=false;endedQuote=true}}else field+=ch;continue;}
  if(ch==='"'){if(field.length||endedQuote)throw Error('Unescaped quote in CSV');quoted=true;continue}
  if(ch===','){row.push(field.trim());field='';endedQuote=false;continue}
  if(ch==='\n'||ch==='\r'){if(ch==='\r'&&content[i+1]==='\n')i++;row.push(field.trim());if(row.some(c=>c!==''))lines.push(row);row=[];field='';endedQuote=false;continue}
  if(endedQuote&&ch!==' '&&ch!=='\t')throw Error('Unexpected characters after closing quote');
  field+=ch;
 }
 if(quoted)throw Error('Unclosed quoted CSV cell');
 row.push(field.trim());if(row.some(c=>c!==''))lines.push(row);
 if(lines.length<2)return [];
 const headers=lines.shift()!.map(x=>x.toLowerCase().trim());
 if(headers.some(x=>!CSV_COLUMNS.includes(x as (typeof CSV_COLUMNS)[number])))throw Error('CSV contains an unknown column.');
 if(new Set(headers).size!==headers.length)throw Error('CSV contains duplicate headers.');
 if(!['name','level','lat','lng','clue','source'].every(x=>headers.includes(x)))throw Error('CSV must contain name, level, lat, lng, clue and source columns.');
 if(lines.length>100)throw Error('Import a maximum of 100 locations per batch.');
 return lines.map((values,i)=>{
  if(values.length!==headers.length)throw Error('Row '+(i+2)+' has an unexpected number of cells.');
  return Object.fromEntries(headers.map((header,n)=>[header,values[n]]));
 });
}
export function validateImportedPlace(value:Record<string,string>,i=0):{place:ImportedPlace|null;errors:string[]}{
 const errors:string[]=[],level=Number(value.level),lat=Number(value.lat),lng=Number(value.lng);
 if(!Number.isInteger(level)||level<0||level>6)errors.push('level must be 0–6');
 if(!value.name?.trim()||value.name.trim().length<2||value.name.length>120)errors.push('name must be 2–120 characters');
 if(!Number.isFinite(lat)||lat<-90||lat>90||value.lat==='')errors.push('invalid latitude');
 if(!Number.isFinite(lng)||lng<-180||lng>180||value.lng==='')errors.push('invalid longitude');
 if(!value.clue?.trim()||value.clue.trim().length<10||value.clue.length>600)errors.push('clue must be 10–600 characters');
 let url:URL|null=null;try{url=new URL(value.source||'');}catch{}
 if(url?.protocol!=='https:')errors.push('source must be an HTTPS URL');
 const id=value.parent_id?.trim()||null;
 if(level>0&&!/^[0-9a-f-]{36}$/i.test(id||''))errors.push('non-country rows require an existing parent UUID');
 if(level===0&&!/^[A-Za-z]{3}$/.test(value.iso3?.trim()||''))errors.push('country rows require ISO3');
 if(value.published&& !['true','false','1','0','yes','no'].includes(value.published.toLowerCase()))errors.push('invalid published value');
 if(errors.length)return {place:null,errors:errors.map(e=>'Row '+(i+2)+': '+e)};
 return {place:{name:value.name.trim(),level,parent_id:level===0?null:id,clue:value.clue.trim(),hint:(value.hint||'').trim(),source:value.source.trim(),lat,lng,iso3:level===0?(value.iso3||'').trim().toUpperCase():null,published:['true','1','yes'].includes((value.published||'false').toLowerCase())},errors:[]};
}
export function inspectChallenge(c:Challenge):string[]{
 return contentIssues(c,{requireEvidence:false}).filter(issue=>issue.severity==='error').map(issue=>(issue.stage===null?'':`Stage ${issue.stage+1}: `)+issue.message);
}
export function auditStudio(challenges:Challenge[],nodes:GeoNode[]):StudioAudit{
 const invalid=challenges.filter(c=>c.status==='published').map(c=>({id:c.id,title:c.title,issues:inspectChallenge(c)})).filter(x=>x.issues.length);
 const ids=new Set(nodes.map(n=>n.id));
 const completePaths=nodes.filter(n=>{if(n.level!==6||!n.published)return false;let cur:GeoNode|undefined=n;for(let l=6;l>=0;l--){if(!cur||cur.level!==l||!cur.published)return false;cur=nodes.find(p=>p.id===cur?.parent_id)}return cur===undefined}).length;
 return {total:challenges.length,published:challenges.filter(c=>c.status==='published').length,validPublished:challenges.filter(c=>c.status==='published').length-invalid.length,invalid,totalPlaces:nodes.length,completePaths,orphanedNodes:nodes.filter(n=>n.level>0&&(!n.parent_id||!ids.has(n.parent_id))).length};
}
