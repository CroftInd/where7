import json,statistics
from pathlib import Path
base=Path(__file__).resolve().parent.parent
source=json.loads((base/'data/original-data.json').read_text())
P,GEO=source['P'],source['GEO']
labels=['Country','State / Region','City','Area','District','Street','Building']
region_fallback={
 'nyc':[('New York',42.94,-75.52),('California',36.78,-119.42),('Texas',31,-99),('Florida',28.5,-82),('Pennsylvania',41,-77.5),('Massachusetts',42.3,-71.8),('Ohio',40.4,-82.7),('Vermont',44.0,-72.7),('New Jersey',40.1,-74.5)],
 'london':[('England',52.65,-1.5),('Scotland',56.8,-4),('Wales',52.1,-3.6),('Northern Ireland',54.7,-6.5)]
}
country_coords={'nyc':[-98.5,39.5],'london':[-2.5,54.1]}
def point_for(row):
 t=row['type'];kind='street' if t=='road' else 'landmark' if t=='building' else 'place'
 if 'lat' in row:lat,lng=row['lat'],row['lng']
 elif 'bounds' in row:
  b=row['bounds'];lat=(b[0][0]+b[1][0])/2;lng=(b[0][1]+b[1][1])/2
 else:
  coords=row.get('coords') or [[0,0]]
  lat=statistics.mean(v[0] for v in coords);lng=statistics.mean(v[1] for v in coords)
 return {'id':row['name'].lower().replace(' ','-').replace('/','-').replace("'",''),'name':row['name'],'lat':round(lat,6),'lng':round(lng,6),'kind':kind}
challenges=[]
for key in ('london','nyc'):
 p=P[key];view=p['views'];stages=[]
 for i in range(7):
  v=view[i];bounds=v.get('bounds')
  if bounds:
   center=[(bounds[0][1]+bounds[1][1])/2,(bounds[0][0]+bounds[1][0])/2]
   zoom={'0':1.3,'1':4,'2':7,'3':10,'4':12,'5':14,'6':16}.get(str(i),5)
  else:
   center=[v['center'][1],v['center'][0]];zoom=v.get('zoom',2)
  if i==0: options=[]
  elif i==1: options=[{'id':name.lower().replace(' ','-'),'name':name,'lat':lat,'lng':lng,'kind':'region'} for name,lat,lng in region_fallback[key]]
  else:options=[point_for(v) for v in GEO[key].get(str(i),[])]
  stages.append({'level':i,'label':labels[i], 'clue':p['clues'][i], 'hint':p['hints'][i], 'source':p['sources'][i],
        'answer':p['names'][i], 'center':center, 'zoom':zoom, 'selection':'country' if i==0 else 'region' if i==1 else 'markers',
        'choices':options})
 challenges.append({'id':key,'title':('Westminster Mystery' if key=='london' else 'Manhattan Mystery'),
     'description':'Seven clues lead to a world-famous landmark.', 'countryIso3':p['iso'], 'status':'published',
     'publishDate':None, 'difficulty':'standard', 'stages':stages, 'builtIn':True})
(base/'data/challenges.json').write_text(json.dumps(challenges,indent=2,ensure_ascii=False))
print('Created',len(challenges),'seed challenges; each has', len(challenges[0]['stages']),'stages')
