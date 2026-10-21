import type {MetadataRoute} from 'next';
export default function sitemap():MetadataRoute.Sitemap{
 const home='https://www.where7.world';
 return ['','explore','arcade','social','rewards','leaderboard','stats','plus'].map(p=>({
  url:home+(p?'/'+p:''),lastModified:new Date(),
  changeFrequency:p?'weekly':'daily',priority:p?0.6:1
 }));
}
