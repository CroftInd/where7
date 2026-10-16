const fs=require("fs");
function point(name,lat,lng){return {name,type:"point",lat,lng}};function box(name,s,w,n,e){return {name,type:"box",bounds:[[s,w],[n,e]]}};function shape(name,coords){return {name,type:"poly",coords}};function road(name,coords){return {name,type:"road",coords}};function circlePoint(name,lat,lng){return {name,type:"building",lat,lng}};
const P={
  nyc:{id:'nyc',country:'United States',names:['United States','New York','New York City','Manhattan','Midtown','Fifth Avenue','Empire State Building'],
    clues:[
      "This country has 50 states and its federal capital is Washington, D.C.",
      'This state contains the Adirondack Mountains and the American side of Niagara Falls.',
      'This city has five boroughs: Manhattan, Brooklyn, Queens, the Bronx and Staten Island.',
      'Most of this borough lies on the island between the Hudson and East rivers.',
      'This central Manhattan neighbourhood includes Times Square and the Theater District.',
      'This north–south Manhattan avenue meets West 34th Street beside the Empire State Building.',
      'This Art Deco skyscraper was completed in 1931 and has 102 storeys.'
    ],
    hints:['Its flag contains 50 stars.','The state has the same name as its biggest city.','It is nicknamed the Big Apple.','Central Park lies within this borough.','Its name refers to its position in Manhattan.','The avenue is named with an ordinal number.','Its initials are ESB.'],
    views:[{center:[20,-24],zoom:2.2},{bounds:[[24,-125],[50,-66]],max:5},{bounds:[[40.35,-79.9],[45.35,-71.4]],max:8},{bounds:[[40.48,-74.28],[40.95,-73.68]],max:11},{bounds:[[40.692,-74.041],[40.852,-73.915]],max:13},{bounds:[[40.729,-74.015],[40.779,-73.945]],max:14},{bounds:[[40.738,-73.998],[40.759,-73.970]],max:17}]},
  london:{id:'london',country:'United Kingdom',names:['United Kingdom','England','London','City of Westminster','Westminster','Whitehall','10 Downing Street'],
    clues:[
      'This sovereign country consists of England, Scotland, Wales and Northern Ireland.',
      'This constituent country contains Manchester, Birmingham and the UK capital, London.',
      'The River Thames runs through this city, which is home to Tower Bridge.',
      'This central London borough contains Buckingham Palace and the Palace of Westminster.',
      'This neighbourhood contains Westminster Abbey and Parliament Square.',
      'This London road runs from Trafalgar Square towards Parliament Street past government offices.',
      'This numbered address on Downing Street is the official residence and office of the UK prime minister.'
    ],
    hints:['Its flag is the Union Jack.','Its flag displays the red Cross of St George.','Look for the UK capital.','It is also known as a city within London.','The Palace of Westminster stands here.','Its name is associated with the British civil service.','The address begins with the number 10.'],
    views:[{center:[20,-24],zoom:2.2},{bounds:[[49.7,-9.3],[59.2,2.2]],max:6},{bounds:[[49.7,-6.0],[56.0,2.1]],max:8},{bounds:[[51.28,-.49],[51.68,.28]],max:11},{bounds:[[51.472,-.24],[51.555,-.055]],max:13},{bounds:[[51.496,-.158],[51.519,-.108]],max:15},{bounds:[[51.4988,-.134],[51.509,-.119]],max:18}]}
};
// Published references for the included example clues; custom authors may add their own.
P.nyc.iso='USA';P.london.iso='GBR';
P.nyc.sources=[
'https://www.usa.gov/states-and-territories',
'https://www.iloveny.com/places-to-go/adirondacks/',
'https://www.nyc.gov/site/planning/about/borough-offices.page',
'https://www.nyc.gov/site/planning/about/borough-offices.page',
'https://www.nyctourism.com/neighborhoods/midtown/',
'https://www.esbnyc.com/visit',
'https://www.esbnyc.com/about/history'];
P.london.sources=[
'https://www.gov.uk/government/how-government-works',
'https://www.visitengland.com/',
'https://www.visitlondon.com/',
'https://www.westminster.gov.uk/',
'https://www.westminster-abbey.org/',
'https://www.visitlondon.com/things-to-do/place/281729-whitehall',
'https://www.gov.uk/government/organisations/prime-ministers-office-10-downing-street/about'];

const GEO={
nyc:{
  2:[point('New York City',40.7128,-74.006),point('Buffalo',42.8864,-78.8784),point('Rochester',43.1566,-77.6088),point('Albany',42.6526,-73.7562),point('Syracuse',43.0481,-76.1474),point('Yonkers',40.9312,-73.8988),point('Ithaca',42.444,-76.5019)],
  3:[
    shape('Manhattan',[[40.699,-74.018],[40.715,-74.015],[40.738,-74.010],[40.764,-73.998],[40.788,-73.975],[40.809,-73.959],[40.829,-73.945],[40.870,-73.928],[40.876,-73.92],[40.842,-73.933],[40.798,-73.954],[40.771,-73.967],[40.748,-73.973],[40.717,-73.977],[40.704,-73.989]]),
    shape('Brooklyn',[[40.571,-74.045],[40.591,-74.03],[40.647,-74.03],[40.698,-73.991],[40.744,-73.952],[40.739,-73.917],[40.703,-73.888],[40.662,-73.858],[40.615,-73.852],[40.575,-73.89]]),
    shape('Queens',[[40.543,-73.96],[40.59,-73.87],[40.62,-73.75],[40.7,-73.71],[40.79,-73.7],[40.805,-73.76],[40.777,-73.854],[40.74,-73.9],[40.71,-73.96],[40.645,-73.95]]),
    shape('Bronx',[[40.786,-73.933],[40.805,-73.93],[40.869,-73.912],[40.917,-73.899],[40.915,-73.768],[40.852,-73.764],[40.806,-73.83]]),
    shape('Staten Island',[[40.487,-74.24],[40.53,-74.253],[40.62,-74.209],[40.651,-74.143],[40.63,-74.057],[40.578,-74.065],[40.519,-74.1]])
  ],
  4:[
    box('Midtown',40.742,-73.997,40.767,-73.966),
    box('Chelsea',40.735,-74.015,40.753,-73.996),box('SoHo',40.718,-74.003,40.732,-73.99),
    box('Upper East Side',40.768,-73.97,40.794,-73.95),box('Tribeca',40.714,-74.014,40.725,-74.003),
    box('Financial District',40.701,-74.02,40.714,-74.005),box('Lower East Side',40.715,-73.99,40.738,-73.975),
    box('Greenwich Village',40.727,-74.011,40.74,-73.994)
  ],
  5:[
    road('Fifth Avenue',[[40.735,-73.993],[40.744,-73.988],[40.752,-73.983],[40.759,-73.978],[40.766,-73.973]]),
    road('Sixth Avenue',[[40.734,-73.999],[40.744,-73.994],[40.752,-73.988],[40.764,-73.98]]),
    road('Broadway',[[40.737,-73.996],[40.743,-73.992],[40.752,-73.987],[40.764,-73.982]]),
    road('Madison Avenue',[[40.737,-73.989],[40.744,-73.984],[40.755,-73.976],[40.765,-73.969]]),
    road('Park Avenue',[[40.741,-73.984],[40.749,-73.978],[40.757,-73.971],[40.766,-73.964]]),
    road('Seventh Avenue',[[40.735,-74.002],[40.745,-73.995],[40.754,-73.989],[40.764,-73.981]])
  ],
  6:[
    circlePoint('Empire State Building',40.748441,-73.985664),circlePoint("Macy's Herald Square",40.75025,-73.9886),
    circlePoint('New York Public Library',40.7532,-73.9822),circlePoint('One Vanderbilt',40.7529,-73.9786),
    circlePoint('Flatiron Building',40.7411,-73.9897),circlePoint('500 Fifth Avenue',40.7538,-73.9802),
    circlePoint('Madison Square Garden',40.7505,-73.9934)
  ]
},
london:{
  1:[
    shape('England',[[55.81,-2.0],[55.4,-1.48],[54.85,-1.36],[54.59,-1.15],[53.9,-.13],[53.66,.10],[53.15,.22],[52.96,.40],[52.4,1.62],[51.98,1.62],[51.42,1.36],[50.92,1.41],[50.72,.82],[50.72,-.95],[50.58,-1.84],[50.48,-2.76],[50.61,-3.50],[50.32,-4.01],[50.07,-5.04],[50.13,-5.68],[50.41,-5.04],[50.72,-4.19],[51.16,-3.34],[51.55,-2.69],[51.89,-2.74],[52.24,-2.76],[52.65,-3.03],[53.16,-3.03],[53.43,-3.05],[53.66,-3.36],[54.19,-3.66],[54.64,-3.61],[54.84,-3.12],[55.02,-3.1],[55.48,-2.65]]),
    shape('Scotland',[[55.81,-2],[55.48,-2.65],[55.02,-3.1],[54.95,-3.2],[55.25,-4.97],[55.65,-5.53],[56.35,-6.13],[57.13,-6.56],[57.69,-5.76],[58.2,-5.14],[58.6,-4.42],[58.65,-3.02],[58.2,-2.32],[57.35,-1.76],[56.4,-2.64]]),
    shape('Wales',[[53.43,-3.05],[53.38,-4.38],[52.91,-4.72],[52.25,-4.69],[51.72,-5.23],[51.37,-4.29],[51.56,-2.69],[51.89,-2.74],[52.24,-2.76],[52.65,-3.03],[53.16,-3.03]]),
    shape('Northern Ireland',[[55.19,-6.9],[55.28,-6.05],[54.98,-5.45],[54.55,-5.48],[54.02,-6.06],[54.08,-7.45],[54.39,-8.1],[54.8,-7.7]])
  ],
  2:[point('London',51.5074,-.1278),point('Manchester',53.4808,-2.2426),point('Birmingham',52.4862,-1.8904),point('Liverpool',53.4084,-2.9916),point('Leeds',53.8008,-1.5491),point('Bristol',51.4545,-2.5879),point('Oxford',51.752,-1.2577),point('Newcastle',54.9783,-1.6178),point('Norwich',52.6309,1.2974)],
  3:[box('City of Westminster',51.48,-.195,51.539,-.107),box('Camden',51.531,-.193,51.573,-.114),box('Kensington and Chelsea',51.477,-.231,51.528,-.171),box('Lambeth',51.415,-.14,51.502,-.098),box('Southwark',51.448,-.118,51.512,-.043),box('City of London',51.508,-.113,51.524,-.073),box('Islington',51.527,-.126,51.574,-.074),box('Hackney',51.53,-.09,51.572,-.019)],
  4:[box('Westminster',51.496,-.143,51.509,-.116),box('Mayfair',51.505,-.159,51.517,-.14),box('Soho',51.511,-.14,51.518,-.128),box("St James's",51.502,-.143,51.51,-.129),box('Pimlico',51.483,-.144,51.499,-.125),box('Covent Garden',51.51,-.128,51.517,-.116),box('Belgravia',51.492,-.166,51.503,-.145)],
  5:[road('Whitehall',[[51.5072,-.1278],[51.505,-.1267],[51.5029,-.1258]]),road('Parliament Street',[[51.5029,-.1258],[51.5012,-.1256]]),road('Downing Street',[[51.50348,-.1282],[51.50347,-.1259]]),road('Horse Guards Road',[[51.5071,-.1293],[51.5048,-.1293],[51.502,-.1285]]),road('Northumberland Avenue',[[51.5077,-.1241],[51.506,-.1199]]),road('Great George Street',[[51.5017,-.1275],[51.5016,-.1353]]),road('Victoria Street',[[51.4966,-.143],[51.4996,-.134],[51.5009,-.129]])],
  6:[circlePoint('10 Downing Street',51.50336,-.12765),circlePoint('HM Treasury',51.50225,-.1261),circlePoint('Cabinet Office',51.5047,-.1269),circlePoint('Horse Guards',51.50475,-.1278),circlePoint('Banqueting House',51.50495,-.1259),circlePoint('Admiralty House',51.50595,-.1269),circlePoint('Portcullis House',51.5009,-.1255)]
}};



fs.writeFileSync("data/original-data.json",JSON.stringify({P,GEO},null,2));