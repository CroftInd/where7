import {levelFromXp,rankFromLevel} from './ranks.ts';

export type Completion={challenge_id:string;mode:string;score:number;guesses:number;stage:number;perfect:boolean;finished_at:string|null};
export type Claim={reward_key:string;xp:number;claimed_at:string;shield_granted?:boolean};
export type Shield={protected_date:string};
export type Mission={key:string;title:string;description:string;target:number;progress:number;xp:number;earned:boolean;claimed:boolean;kind:'daily'|'weekly';shield:boolean};
export type CalendarDay={date:string;status:'done'|'shield'|'missed'|'future'|'today'|'empty'};
export type Progression={date:string;weekStart:string;profile:{xp:number;level:number;rank:string;progressPct:number;xpToNext:number;flair:string};daily:Mission[];weekly:Mission[];calendar:CalendarDay[];streak:{current:number;best:number;shields:number;canProtectYesterday:boolean;yesterday:string};achievements:{id:string;title:string;description:string;earned:boolean;tier:'bronze'|'silver'|'gold'|'legend';icon:string}[];availableXp:number;claimedTodayXp:number;dailyCompleted:boolean;todayScore:number;todayStages:number;nextReset:string};

export const isoDay=(date:Date)=>date.toISOString().slice(0,10);
export function shiftDay(date:string,offset:number){const ms=Date.parse(`${date}T12:00:00Z`);return isoDay(new Date(ms+offset*86400000));}
export function weekMonday(day:string){const d=new Date(`${day}T12:00:00Z`);const weekday=(d.getUTCDay()+6)%7;return shiftDay(day,-weekday);}
export function dayForCompletion(row:Completion){
  if(row.mode!=='daily'||!row.finished_at)return null;
  const scoped=row.challenge_id.match(/^(\d{4}-\d{2}-\d{2}):/);
  if(scoped&&isoDay(new Date(`${scoped[1]}T12:00:00Z`))===scoped[1])return scoped[1];
  // Compatibility with historic results created before daily-scoped IDs.
  return isoDay(new Date(row.finished_at));
}
export function dailySummary(rows:Completion[],today:string){
  const byDay=new Map<string,Completion>();
  for(const r of rows){
    const day=dayForCompletion(r);if(!day||day>today)continue;
    const current=byDay.get(day);
    if(!current||r.stage>current.stage||(r.stage===current.stage&&r.score>current.score))byDay.set(day,r);
  }
  return byDay;
}
export function computeStreak(done:Set<string>,covered:Set<string>,today:string){
  const days=[...new Set([...done,...covered])].filter(x=>x<=today).sort();
  const active=new Set(days);
  let current=0,day=active.has(today)?today:shiftDay(today,-1);
  for(let i=0;i<5000&&active.has(day);i++){current++;day=shiftDay(day,-1);}
  let best=0,run=0,previous='';
  for(const d of days){run=previous&&shiftDay(previous,1)===d?run+1:1;best=Math.max(best,run);previous=d;}
  return {current,best};
}
export function buildProgression(rows:Completion[],claims:Claim[],protections:Shield[],today:string,xp:number):Progression{
  const byDay=dailySummary(rows,today);
  const completed=new Set(byDay.keys());
  const shieldDays=new Set(protections.filter(x=>x.protected_date<=today).map(x=>x.protected_date));
  const claimed=new Set(claims.map(x=>x.reward_key));
  const monday=weekMonday(today);
  const weekRows=[...byDay.entries()].filter(([d])=>d>=monday&&d<=today).map(([,r])=>r);
  const todayRow=byDay.get(today);
  const points=weekRows.reduce((v,r)=>v+r.stage,0);
  const num=weekRows.length;
  const make=(kind:'daily'|'weekly',suffix:string,title:string,description:string,progress:number,target:number,earnedXp:number,shield=false):Mission=>{
    const key=`${kind==='daily'?'d':'w'}:${kind==='daily'?today:monday}:${suffix}`;
    return {key,title,description,target,progress:Math.min(target,Math.max(0,progress)),xp:earnedXp,earned:progress>=target,claimed:claimed.has(key),kind,shield};
  };
  const daily=[
    make('daily','finish','Take the first step','Finish today’s official expedition',todayRow?1:0,1,40),
    make('daily','discover','Trail finder','Discover at least three places in today’s expedition',todayRow?.stage||0,3,60),
    make('daily','precision','Steady compass','Reach three places without a wrong guess',todayRow&&todayRow.stage>=3&&todayRow.guesses===todayRow.stage?1:0,1,80)
  ];
  const weekly=[
    make('weekly','three','Frequent flyer','Complete three different daily expeditions this week',num,3,120),
    make('weekly','twelve','Map maker','Discover twelve places across daily expeditions this week',points,12,160),
    make('weekly','five','Seven-day spirit','Complete five different daily expeditions this week',num,5,200,true)
  ];
  const earnedTokens=claims.filter(c=>c.reward_key.endsWith(':five')&&c.reward_key.startsWith('w:')&&c.shield_granted).length;
  const shields=Math.max(0,Math.min(2,earnedTokens-protections.length));
  const yesterday=shiftDay(today,-1);
  const streak=computeStreak(completed,shieldDays,today);
  const canProtectYesterday=shields>0&&!completed.has(yesterday)&&!shieldDays.has(yesterday)
    &&completed.has(shiftDay(yesterday,-1)); // No consecutive shield days.
  const mondayCalendar=weekMonday(shiftDay(today,-34));
  const calendar=Array.from({length:42},(_,i)=>{
    const date=shiftDay(mondayCalendar,i);const status:CalendarDay['status']=date>today?'future':completed.has(date)?'done':shieldDays.has(date)?'shield':date===today?'today':date<shiftDay(today,-34)?'empty':'missed';
    return {date,status};
  });
  const all=[...daily,...weekly];
  const stageTotal=[...byDay.values()].reduce((n,r)=>n+r.stage,0);
  const perfect=[...byDay.values()].filter(r=>r.perfect).length;
  const achievements=[
    {id:'first',title:'First Footsteps',description:'Finish one daily expedition',earned:completed.size>=1,tier:'bronze',icon:'footprints'},
    {id:'trail',title:'Pathfinder',description:'Discover 25 locations',earned:stageTotal>=25,tier:'bronze',icon:'map-pin'},
    {id:'streak3',title:'Three-Day Trail',description:'Maintain a 3-day streak',earned:streak.best>=3,tier:'bronze',icon:'flame'},
    {id:'five',title:'Frequent Explorer',description:'Complete 5 daily expeditions',earned:completed.size>=5,tier:'silver',icon:'compass'},
    {id:'perfect',title:'Flawless Navigator',description:'Complete all 7 stages perfectly',earned:perfect>=1,tier:'gold',icon:'sparkles'},
    {id:'streak7',title:'Week Wanderer',description:'Maintain a 7-day streak',earned:streak.best>=7,tier:'silver',icon:'calendar-check'},
    {id:'twenty',title:'Seasoned Cartographer',description:'Complete 20 daily expeditions',earned:completed.size>=20,tier:'gold',icon:'map'},
    {id:'hundred',title:'Atlas Architect',description:'Discover 100 locations',earned:stageTotal>=100,tier:'gold',icon:'globe'},
    {id:'level10',title:'Explorer Rank',description:'Reach level 10',earned:levelFromXp(xp)>=10,tier:'silver',icon:'award'},
    {id:'level30',title:'Trailblazer Elite',description:'Reach level 30',earned:levelFromXp(xp)>=30,tier:'gold',icon:'star'},
    {id:'streak30',title:'Unstoppable',description:'Maintain a 30-day streak',earned:streak.best>=30,tier:'legend',icon:'crown'},
    {id:'level100',title:'Globemaster',description:'Reach level 100',earned:levelFromXp(xp)>=100,tier:'legend',icon:'trophy'}
  ] as const;
  const level=levelFromXp(xp),lower=10*(level-1)**2,upper=10*level**2;
  const flair=level>=75?'Celestial Atlas':level>=45?'Aurora Frame':level>=30?'Golden Compass':level>=20?'Ocean Explorer':level>=10?'Emerald Trail':level>=5?'Bronze Compass':'Explorer';
  return {date:today,weekStart:monday,profile:{xp,level,rank:rankFromLevel(level),progressPct:level>=100?100:Math.max(0,Math.min(100,Math.round((xp-lower)/(upper-lower)*100))),xpToNext:level>=100?0:Math.max(0,upper-xp),flair},daily,weekly,calendar,streak:{...streak,shields,canProtectYesterday,yesterday},achievements:achievements.map(a=>({...a})),availableXp:all.filter(x=>x.earned&&!x.claimed).reduce((x,m)=>x+m.xp,0),claimedTodayXp:daily.filter(x=>x.claimed).reduce((x,m)=>x+m.xp,0),dailyCompleted:!!todayRow,todayScore:todayRow?.score||0,todayStages:todayRow?.stage||0,nextReset:`${shiftDay(today,1)}T00:00:00.000Z`};
}
