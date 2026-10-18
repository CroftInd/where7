export const xpFromScore = (score:number) => Math.max(0, Math.floor(score/10));
export const levelFromXp = (xp:number) => Math.min(100,1+Math.floor(Math.sqrt(Math.max(0,xp)/10)));
export const rankFromLevel = (level:number) => level>=100?'Globemaster':level>=90?'World Legend':level>=75?'Atlas Sage':level>=60?'Master Cartographer':level>=45?'Pathfinder Elite':level>=30?'Trailblazer':level>=20?'Navigator':level>=10?'Explorer':level>=5?'Wayfinder':'Newcomer';
