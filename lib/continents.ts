export const CONTINENTS={
 Europe:['AUT','BEL','CHE','CZE','DEU','DNK','ESP','FIN','FRA','GBR','GRC','HUN','IRL','ITA','NLD','NOR','POL','PRT','SWE','TUR'],
 Asia:['ARE','CHN','IDN','IND','JPN','KOR','MYS','NPL','SGP','THA','VNM'],
 Africa:['EGY','ETH','KEN','MAR','ZAF'],
 'North America':['CAN','MEX','USA'],
 'South America':['ARG','BRA','CHL','COL','PER'],
 Oceania:['AUS','NZL']
} as const;
export type Continent=keyof typeof CONTINENTS;
export const continentFor=(iso:string):Continent|null=>{
 const code=iso.trim().toUpperCase();
 return (Object.keys(CONTINENTS) as Continent[]).find(c=>(CONTINENTS[c] as readonly string[]).includes(code))||null;
};
