/* =====================================================================================
   OMNIVERSE REGION - world definition (pure data + pure functions, no THREE, no DOM).
   Hierarchy:  REGION -> CITY -> DISTRICT (one per 8x8-block sector) -> NEIGHBOURHOOD -> LOT -> LANDMARK
   Everything is a deterministic function of block coordinates, so a chunk that streams out and back in
   (or a landmark you return to) is rebuilt identically. Missions can reference ids:
        WORLDDEF.landmark('bellwood_general')  ->  {id,name,type,bx,bz,li,kind,x,z,district,hood}
        WORLDDEF.locate(x,z)                   ->  {district,hood,type,landmark?}
   ===================================================================================== */
(function(){
const PITCH=80, LOT_OFF=12;
function hash3(a,b,c){ let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul(c|0,2147483629))|0; h=Math.imul(h^(h>>>15),2246822519); h=Math.imul(h^(h>>>13),3266489917); return (h^(h>>>16))>>>0; }
const sectorOf=(bx,bz)=>[Math.floor((bx+4)/8),Math.floor((bz+4)/8)];

const REGION='OMNIVERSE REGION', CITY='BELLWOOD';

/* District TYPE = how the lots are composed (see MIX). Each named district has a type plus a pool of neighbourhood names. */
const HOODS={
  downtown:['Central Square','Ironworks Row','Lantern Plaza','Glass Mile'],
  civic:['Civic Center','Courthouse Green','Hospital Hill'],
  commercial:['Commerce Row','Station Quarter','Market Crossing','Exchange Street'],
  suburb:['Maple Hollow','Fairview','Cedar Heights','Willow Park','Brookside','Oakridge'],
  wealthy:['Crown Heights','Silverlake Estates','Highgrove'],
  oldtown:['Old Westside','Tanner\'s Alley','Little Market','Rivet Lane','Chandler Street'],
  industrial:['East Works','Forge Yards','Kiln Road','Powerline Flats'],
  harbor:['Southport','Dockside','Container Row','Tideway Yards'],
  parkland:['Greenway','Hollow Creek Park','Pinewood'],
  rural:['Outer Fields','Hollow Creek','Stonebridge Farms','Northgate Road'],
  village:['Millbrook','Crossroads','Little Haven'],
};
/* District display name by type (what the ENTERING banner shows) */
const DNAME={downtown:'DOWNTOWN',civic:'CIVIC CENTER',commercial:'COMMERCIAL DISTRICT',suburb:'NORTHSIDE',wealthy:'NORTHSIDE HEIGHTS',oldtown:'WESTSIDE',industrial:'EAST DISTRICT',harbor:'SOUTH DISTRICT',parkland:'PARKLANDS',rural:'OUTSKIRTS',village:'OUTSKIRTS'};

/* Lot-kind mix per district type (weights). Kinds are implemented in the main script's LOT BUILDERS. */
const MIX={
  downtown:  {tower:30,office:18,apartment:8,restaurant:7,cornershop:7,parkgarage:8,plaza:9,parking:5,bank:4,kiosklot:4},
  civic:     {school:2,office:16,plaza:16,park:10,parking:12,apartment:8,restaurant:8,cornershop:6,bank:6,stripmall:6,parkgarage:6,playground:6},
  commercial:{stripmall:18,supermarket:9,cornershop:12,restaurant:12,office:12,gasstation:6,parking:12,apartment:9,tower:4,garage:6},
  suburb:    {school:3,house:34,house2:22,duplex:9,townhouse:6,apartment:4,park:7,playground:4,cornershop:3,emptylot:7,field:4},
  wealthy:   {house2:55,park:12,emptylot:10,field:10,playground:5,duplex:4,cornershop:2,gasstation:0,house:2},
  oldtown:   {townhouse:24,cornershop:16,house:10,house2:6,market:14,apartment:8,restaurant:7,garage:6,emptylot:5,abandoned:4},
  industrial:{warehouse:26,factory:16,garage:8,utility:8,construction:8,yard:14,parking:6,office:4,abandoned:4,gasstation:3,cornershop:3},
  harbor:    {warehouse:20,containers:32,factory:6,garage:6,yard:12,parking:5,cornershop:3,emptylot:6,construction:5,gasstation:3,abandoned:3},
  parkland:  {park:34,field:22,playground:9,emptylot:10,house2:8,sports:7,cornershop:2},
  rural:     {farm:18,field:34,house2:12,house:8,emptylot:12,parkland:0,gasstation:2,cornershop:3,park:3},
  village:   {house:22,house2:16,cornershop:12,townhouse:8,farm:10,field:12,gasstation:5,emptylot:8,restaurant:4,park:3},
};

/* District assignment per sector: a coherent geography, not noise.
     centre = DOWNTOWN; ring N = CIVIC CENTER, ring E/W/S = COMMERCIAL;
     beyond: N = NORTHSIDE (suburbs/schools), E = EAST DISTRICT (industry), W = WESTSIDE (old town, markets), S = SOUTH DISTRICT (port yards);
     far out = OUTSKIRTS (farms, villages, parkland) */
let _LMSEC=null;
function _lmSectors(){ if(!_LMSEC){ _LMSEC=new Set(); LANDMARKS.forEach(l=>{ if(l.bx!==undefined){ const [a,b]=sectorOf(l.bx,l.bz); _LMSEC.add(a+','+b); } }); } return _LMSEC; }
function districtTypeOfSector(sx,sz){
  const d=Math.hypot(sx,sz); let h=hash3(sx,sz,77)%100; if(_lmSectors().has(sx+','+sz)&&h<8) h=50;   // sectors holding a landmark are never parkland
  if(d<=0.8) return 'downtown';
  if(d<=1.5) return sz<0&&Math.abs(sz)>=Math.abs(sx)?'civic':'commercial';
  if(d>3.7) return h<20?'parkland':h<34?'village':'rural';
  if(h<8) return 'parkland';
  if(Math.abs(sz)>=Math.abs(sx)) return sz<0?(h<45&&d>2.4?'wealthy':'suburb'):'harbor';
  return sx>0?'industrial':'oldtown';
}
function hoodName(type,sx,sz,bx,bz){
  const pool=HOODS[type]||HOODS.rural; const q=hash3(sx*3+(bx>>2),sz*3+(bz>>2),type.length)%pool.length; return pool[q];
}
function locateBlock(bx,bz){
  const [sx,sz]=sectorOf(bx,bz), type=districtTypeOfSector(sx,sz);
  return {type,district:DNAME[type],hood:hoodName(type,sx,sz,bx,bz),sx,sz};
}

/* ---------------- fixed landmarks: persistent identity, never regenerated differently ---------------- */
const LANDMARKS=[
  {id:'bens_house',name:'BEN\'S HOUSE',type:'home',special:true,x:-21,z:0},
  {id:'rust_bucket',name:'THE RUST BUCKET',type:'home',special:true,x:-37.4,z:7},
  {id:'bellwood_central_school',name:'BELLWOOD CENTRAL SCHOOL',type:'school',bx:0,bz:-1,li:3,kind:'school'},
  {id:'bellwood_general',name:'BELLWOOD GENERAL HOSPITAL',type:'hospital',bx:-2,bz:-6,li:0,kind:'hospital'},
  {id:'bellwood_police',name:'BELLWOOD POLICE STATION',type:'police',bx:0,bz:-6,li:1,kind:'police'},
  {id:'bellwood_fire',name:'ENGINE COMPANY 7 FIRE STATION',type:'fire',bx:2,bz:-6,li:3,kind:'fire'},
  {id:'city_hall',name:'BELLWOOD CITY HALL',type:'civic',bx:0,bz:-8,li:2,kind:'cityhall'},
  {id:'central_station',name:'BELLWOOD CENTRAL STATION',type:'station',bx:0,bz:6,li:0,kind:'trainstation'},
  {id:'commerce_mall',name:'COMMERCE ROW SUPERMARKET',type:'shop',bx:-2,bz:5,li:1,kind:'supermarket'},
  {id:'west_market',name:'WESTSIDE MARKET',type:'market',bx:-16,bz:0,li:0,kind:'market'},
  {id:'west_garage',name:'OLD TOWN GARAGE',type:'garage',bx:-15,bz:1,li:2,kind:'garage'},
  {id:'east_power',name:'EASTGATE POWER STATION',type:'power',bx:16,bz:0,li:0,kind:'utility'},
  {id:'steelworks',name:'BELLWOOD STEELWORKS',type:'factory',bx:16,bz:2,li:1,kind:'factory'},
  {id:'elementary',name:'MAPLE HOLLOW ELEMENTARY',type:'school',bx:2,bz:-14,li:1,kind:'school'},
  {id:'bellwood_field',name:'BELLWOOD FIELD',type:'sports',bx:2,bz:-14,li:0,kind:'sports'},
  {id:'north_park',name:'NORTHSIDE PARK',type:'park',bx:0,bz:-15,li:0,kind:'playground'},
  {id:'container_yard',name:'SOUTHPORT CONTAINER YARD',type:'port',bx:0,bz:14,li:0,kind:'containers'},
  {id:'hollow_farm',name:'HOLLOW CREEK FARM',type:'farm',bx:30,bz:0,li:0,kind:'farm'},
  {id:'highway_gas',name:'CROSSROADS GAS & GO',type:'gas',bx:-30,bz:2,li:3,kind:'gasstation'},
  {id:'build_site',name:'GLASS MILE CONSTRUCTION SITE',type:'construction',bx:-2,bz:-2,li:3,kind:'construction'},
];
const LM_BY_LOT=new Map();
LANDMARKS.forEach(l=>{
  if(l.kind){ const s=l; const cx=l.bx*PITCH+((l.li&1)?LOT_OFF:-LOT_OFF), cz=l.bz*PITCH+((l.li&2)?LOT_OFF:-LOT_OFF); l.x=cx; l.z=cz; LM_BY_LOT.set(l.bx+','+l.bz+','+l.li,l); }
  const lb=l.bx!==undefined?locateBlock(l.bx,l.bz):null; l.district=lb?lb.district:'DOWNTOWN'; l.hood=lb?lb.hood:'Central Square';
});

window.WORLDDEF={
  REGION,CITY,PITCH,MIX,HOODS,DNAME,LANDMARKS,
  typeOfBlock:(bx,bz)=>locateBlock(bx,bz).type,
  locateBlock,
  landmarkAtLot:(bx,bz,li)=>LM_BY_LOT.get(bx+','+bz+','+li)||null,
  landmark:id=>LANDMARKS.find(l=>l.id===id)||null,
  /* what is here? (world coordinates) */
  locate(x,z){
    const bx=Math.round(x/PITCH), bz=Math.round(z/PITCH), b=locateBlock(bx,bz); let lm=null, bd=1e9;
    for(const l of LANDMARKS){ const d=Math.hypot(l.x-x,l.z-z); if(d<bd){ bd=d; lm=l; } }
    return {district:b.district,hood:b.hood,type:b.type,landmark:bd<45?lm:null,landmarkDist:bd};
  },
  /* weighted kind pick; r in [0,1) */
  pickKind(type,r,sub){
    const m=MIX[type]||MIX.suburb; let tot=0; for(const k in m) tot+=m[k]; let t=r*tot; for(const k in m){ t-=m[k]; if(t<0) return k; } return 'house';
  },
};
})();
