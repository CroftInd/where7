import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {buildProgression,computeStreak,dailySummary,dayForCompletion,shiftDay,weekMonday,type Completion} from '../lib/progression.ts';
const r=(date:string,stage=4,guesses=stage,mode='daily'):Completion=>({challenge_id:`${date}:tour-${date}`,mode,score:stage*700,guesses,stage,perfect:stage===7&&guesses===7,finished_at:`${date}T23:00:00Z`});
test('ISO weekdays roll over at Monday UTC, including new year',()=>{
 assert.equal(weekMonday('2026-10-21'),'2026-10-19');assert.equal(weekMonday('2027-01-01'),'2026-12-28');assert.equal(shiftDay('2026-12-31',1),'2027-01-01');
});
test('only completed official daily results count, never practice or incomplete',()=>{
 const rows=[r('2026-10-21',4),r('2026-10-21',7,9,'practice'),{...r('2026-10-20'),finished_at:null}];
 const p=buildProgression(rows,[],[],'2026-10-21',0);
 assert.equal(p.dailyCompleted,true);assert.equal(p.todayStages,4);assert.equal(p.weekly[0].progress,1);
 assert.equal(p.daily[0].earned,true);assert.equal(p.daily[1].earned,true);assert.equal(p.daily[2].earned,true);
});
test('precision mission requires no incorrect attempts',()=>{
 const p=buildProgression([r('2026-10-21',4,5)],[],[],'2026-10-21',0);
 assert.equal(p.daily[2].earned,false);assert.equal(p.daily[2].progress,0);
});
test('daily results are grouped by challenge day not completion timestamp',()=>{
 const late={...r('2026-10-20'),finished_at:'2026-10-21T00:03:00Z'};
 assert.equal(dayForCompletion(late),'2026-10-20');
 assert.equal(buildProgression([late],[],[],'2026-10-21',0).daily[0].earned,false);
});
test('weekly totals count unique days, and shield reward requires five days',()=>{
 const rows=[r('2026-10-19',3),r('2026-10-20',3),r('2026-10-21',3),r('2026-10-22',3),r('2026-10-23',3)];
 const p=buildProgression(rows,[],[],'2026-10-23',0);
 assert.equal(p.weekly[0].earned,true);assert.equal(p.weekly[1].earned,true);assert.equal(p.weekly[2].earned,true);assert.equal(p.weekly[2].shield,true);
 assert.equal(p.weekly[2].xp,200);
 assert.equal(p.weekly[0].claimed,false);
});
test('claims are idempotently reflected as collected, without repeat XP',()=>{
 const rows=[r('2026-10-21',4)];
 const claims=[{reward_key:'d:2026-10-21:finish',xp:40,claimed_at:'2026-10-21T10:00:00Z'}];
 const p=buildProgression(rows,claims,[],'2026-10-21',40);
 assert.equal(p.daily[0].claimed,true);assert.equal(p.availableXp,140);assert.equal(p.claimedTodayXp,40);
});
test('streak shield can only save yesterday with a prior real completion',()=>{
 const today='2026-10-21';const rows=[r('2026-10-19')];
 const claims=[{reward_key:'w:2026-10-12:five',xp:200,claimed_at:'2026-10-16T14:00:00Z',shield_granted:true}];
 const p=buildProgression(rows,claims,[],today,500);
 assert.equal(p.streak.canProtectYesterday,true);
 assert.equal(p.streak.shields,1);
 const protectedP=buildProgression(rows,claims,[{protected_date:'2026-10-20'}],today,500);
 assert.equal(protectedP.streak.current,2);
 assert.equal(protectedP.streak.canProtectYesterday,false);
 assert.equal(protectedP.streak.shields,0);
});
test('shields never support two missed days in a row and wallet is capped',()=>{
 const claims=Array.from({length:4},(_,i)=>({reward_key:`w:2026-09-${String(i*7+1).padStart(2,'0')}:five`,xp:200,claimed_at:'2026-10-01T10:00:00Z',shield_granted:true}));
 const p=buildProgression([r('2026-10-18')],claims,[{protected_date:'2026-10-19'}],'2026-10-21',700);
 assert.equal(p.streak.shields,2);
 assert.equal(p.streak.canProtectYesterday,false);
});
test('streak length remains correct across shield days and previous-day delay',()=>{
 const done=new Set(['2026-10-16','2026-10-17','2026-10-19']);
 const shield=new Set(['2026-10-18']);
 assert.deepEqual(computeStreak(done,shield,'2026-10-20'),{current:4,best:4});
});
test('level cosmetic titles are earned using actual server XP',()=>{
 const p=buildProgression([],[],[],'2026-10-21',9000);
 assert.equal(p.profile.level,31);assert.equal(p.profile.flair,'Golden Compass');
 assert.equal(p.achievements.find(x=>x.id==='level30')?.earned,true);
});
test('calendar has exactly six weeks and maps statuses',()=>{
 const p=buildProgression([r('2026-10-21')],[],[],'2026-10-21',0);
 assert.equal(p.calendar.length,42);assert.equal(p.calendar[0].date,weekMonday(p.calendar[0].date));
 assert.equal(p.calendar.find(x=>x.date==='2026-10-21')?.status,'done');
});
