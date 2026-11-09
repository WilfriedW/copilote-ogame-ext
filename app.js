
const APP_VERSION = '1.9.0';
const KEY = 'ogame-copilot-v1';
document.getElementById('appVer').textContent = 'v' + APP_VERSION;

const B = {
  metal:   {n:'Mine de métal', c:[60,15,0], f:1.5},
  crystal: {n:'Mine de cristal', c:[48,24,0], f:1.6},
  deut:    {n:'Synthétiseur de deutérium', c:[225,75,0], f:1.5},
  solar:   {n:'Centrale électrique solaire', c:[75,30,0], f:1.5},
  fusion:  {n:'Centrale électrique de fusion', c:[900,360,180], f:1.8, req:{b:{deut:5}, t:{energy:3}}},
  robot:   {n:'Usine de robots', c:[400,120,200], f:2},
  shipyard:{n:'Chantier spatial', c:[400,200,100], f:2, req:{b:{robot:2}}},
  lab:     {n:'Laboratoire de recherche', c:[200,400,200], f:2},
  nanite:  {n:'Usine de nanites', c:[1e6,5e5,1e5], f:2, req:{b:{robot:10}, t:{computer:10}}},
  smetal:  {n:'Hangar de métal', c:[1000,0,0], f:2},
  scrystal:{n:'Hangar de cristal', c:[1000,500,0], f:2},
  sdeut:   {n:'Réservoir de deutérium', c:[1000,1000,0], f:2},
};
const B_SHORT = {metal:'Métal',crystal:'Cristal',deut:'Deut.',solar:'Solaire',fusion:'Fusion',robot:'Robots',shipyard:'Chantier',lab:'Labo',nanite:'Nanites',smetal:'Hangar M',scrystal:'Hangar C',sdeut:'Réserv. D'};

const T = {
  energy:    {n:'Technologie Énergie', c:[0,800,400], f:2, req:{lab:1}},
  laser:     {n:'Technologie Laser', c:[200,100,0], f:2, req:{lab:1,t:{energy:2}}},
  ion:       {n:'Technologie Ions', c:[1000,300,100], f:2, req:{lab:4,t:{laser:5,energy:4}}},
  hyper:     {n:'Technologie Hyperespace', c:[0,4000,2000], f:2, req:{lab:7,t:{energy:5,shielding:5}}},
  plasma:    {n:'Technologie Plasma', c:[2000,4000,1000], f:2, req:{lab:4,t:{energy:8,laser:10,ion:5}}},
  combustion:{n:'Réacteur à combustion', c:[400,0,600], f:2, req:{lab:1,t:{energy:1}}},
  impulse:   {n:'Réacteur à impulsion', c:[2000,4000,600], f:2, req:{lab:2,t:{energy:1}}},
  hyperdrive:{n:'Propulsion hyperespace', c:[10000,20000,6000], f:2, req:{lab:7,t:{hyper:3}}},
  espionage: {n:'Technologie Espionnage', c:[200,1000,200], f:2, req:{lab:3}},
  computer:  {n:'Technologie Ordinateur', c:[0,400,600], f:2, req:{lab:1}},
  astro:     {n:'Astrophysique', c:[4000,8000,4000], f:1.75, req:{lab:3,t:{espionage:4,impulse:3}}},
  irn:       {n:'Réseau de recherche intergalactique', c:[240000,400000,160000], f:2, req:{lab:10,t:{computer:8,hyper:8}}},
  weapons:   {n:'Technologie Armes', c:[800,200,0], f:2, req:{lab:4}},
  shielding: {n:'Technologie Bouclier', c:[200,600,0], f:2, req:{lab:6,t:{energy:3}}},
  armour:    {n:'Protection des vaisseaux', c:[1000,0,0], f:2, req:{lab:2}},
};

const SHIPS = {
  sc:  {n:'Petit transporteur', cargo:5000, speed:5000, drive:'combustion', fuel:10, transporter:true},
  lc:  {n:'Grand transporteur', cargo:25000, speed:7500, drive:'combustion', fuel:50, transporter:true},
  pf:  {n:'Éclaireur', cargo:10000, speed:12000, drive:'hyperdrive', fuel:300},
  lf:  {n:'Chasseur léger', cargo:50, speed:12500, drive:'combustion', fuel:20},
  hf:  {n:'Chasseur lourd', cargo:100, speed:10000, drive:'impulse', fuel:75},
  cr:  {n:'Croiseur', cargo:800, speed:15000, drive:'impulse', fuel:300},
  bs:  {n:'Vaisseau de bataille', cargo:1500, speed:10000, drive:'hyperdrive', fuel:500},
  bc:  {n:'Traqueur', cargo:750, speed:10000, drive:'hyperdrive', fuel:250},
  bb:  {n:'Bombardier', cargo:500, speed:4000, drive:'impulse', fuel:700},
  ds:  {n:'Destructeur', cargo:2000, speed:5000, drive:'hyperdrive', fuel:1000},
  rp:  {n:'Faucheur', cargo:10000, speed:7000, drive:'hyperdrive', fuel:1100},
  rec: {n:'Recycleur', cargo:20000, speed:2000, drive:'combustion', fuel:300},
  col: {n:'Vaisseau de colonisation', cargo:7500, speed:2500, drive:'impulse', fuel:1000},
  pr:  {n:'Sonde d\'espionnage', cargo:0, speed:100000000, drive:'combustion', fuel:1},
};
const DRIVE_BONUS = {combustion:.1, impulse:.2, hyperdrive:.3};

const EXPO_CAPS = [[1e4,40000],[1e5,500000],[1e6,1200000],[5e6,1800000],[25e6,2400000],[50e6,3000000],[75e6,3600000],[1e8,4200000],[Infinity,5000000]];
const EXPO_LABELS = ['< 10 000','< 100 000','< 1 M','< 5 M','< 25 M','< 50 M','< 75 M','< 100 M','≥ 100 M'];

function sample(){
  return {
    v:1, sample:true,
    settings:{eco:1, fleet:1, cls:'collector', geo:false, eng:false, ratio:[3,2,1], top1:0, colCargo:true},
    tech:Object.fromEntries(Object.keys(T).map(k=>[k,0])),
    planets:[newPlanet('Planète mère','1:1:8',40,{metal:1})],
    plan:[],
    fleetCalc:{from:'1:1:8', to:'1:2:8', pct:100, ships:{sc:1}},
    expo:{pf:true},
    ui:{tool:'colony'},
    day:{interval:90, nightStart:23, nightEnd:7, horizon:24, focus:'ecocol'},
    lf:{found:['humans','rocktal']},
    roles:{}, raid:null, raids:{},
    daily:{done:{}},
    colo:{from:0, objective:'balanced', bonus:0, target:'', kit:'std', tr:'sc', built:false, fields:'', fpos:''},
  };
}
function newPlanet(name, coords, tmax, b){
  const lv = Object.fromEntries(Object.keys(B).map(k=>[k,0]));
  return {id:Math.random().toString(36).slice(2,9), name, coords, tmax, b:Object.assign(lv,b||{}), sats:0, stock:{m:500,c:500,d:0,at:Date.now()}};
}

let S;
try{ S = JSON.parse(LS.getItem(KEY)) || sample(); }catch(e){ S = sample(); }
S = Object.assign(sample(), S);
S.tech = Object.assign(sample().tech, S.tech);
S.day = Object.assign(sample().day, S.day);
S.ui = Object.assign(sample().ui, S.ui);
S.lf = Object.assign(sample().lf, S.lf);
S.roles = S.roles || {}; S.raids = S.raids || {};
S.daily = Object.assign(sample().daily, S.daily);
function save(){ try{ LS.setItem(KEY, JSON.stringify(S)); }catch(e){} }

const IS_EXT = !!(window.chrome && window.chrome.runtime && window.chrome.runtime.id);
let API = window.__api || null;
/* ---------- formatting ---------- */
const nf = new Intl.NumberFormat('fr-FR');
function fmt(n){ if(!isFinite(n)) return '∞'; const a=Math.abs(n); if(a>=1e9) return (n/1e9).toFixed(2).replace('.',',')+' G'; if(a>=1e6) return (n/1e6).toFixed(2).replace('.',',')+' M'; if(a>=1e5) return (n/1e3).toFixed(0)+' k'; return nf.format(Math.round(n)); }
function dur(sec){ if(!isFinite(sec)) return 'jamais'; sec=Math.max(0,Math.round(sec)); const d=Math.floor(sec/86400), h=Math.floor(sec%86400/3600), m=Math.floor(sec%3600/60), s=sec%60; if(d) return `${d}j ${h}h`; if(h) return `${h}h ${String(m).padStart(2,'0')}m`; if(m) return `${m}m ${String(s).padStart(2,'0')}s`; return `${s}s`; }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function costHtml(c){ return `<span class="cost"><span class="c-m">${fmt(c[0])}</span><span class="c-c">${fmt(c[1])}</span><span class="c-d">${fmt(c[2])}</span></span>`; }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,1800); }

/* ---------- game formulas ---------- */
/** Cost of one level of a building or research. */
function levelCost(def, L){
  const k = Math.pow(def.f, L-1);
  return def.c.map(x => def===T.astro ? Math.round(x*k/100)*100 : Math.floor(x*k));
}
/** Cumulative cost from level `from` (exclusive) to `to` (inclusive). */
function rangeCost(def, from, to){ const t=[0,0,0]; for(let L=from+1; L<=to; L++){ const c=levelCost(def,L); t[0]+=c[0]; t[1]+=c[1]; t[2]+=c[2]; } return t; }
/** Building time in seconds for a level on a given planet. */
function buildTime(key, L, p){
  const c = levelCost(B[key], L);
  const lowLvl = (key==='nanite') ? 1 : Math.max(4 - L/2, 1);
  const h = (c[0]+c[1]) / (2500 * lowLvl * (1+p.b.robot) * Math.pow(2,p.b.nanite) * S.settings.eco);
  return Math.max(1, h*3600);
}
/**
 * Comment désigner une planète sans ambiguïté.
 * OGame nomme « Colonie » toutes les colonies par défaut : tant que le nom est
 * unique on l'affiche seul, sinon on ajoute les coordonnées.
 * @param {object} p planète
 * @returns {string}
 */
function planetRef(p){
  if(!p) return '';
  const homonyme = S.planets.filter(x=>x.name===p.name).length > 1;
  return homonyme && p.coords ? `${p.name} [${p.coords}]` : p.name;
}
/** La planète au meilleur laboratoire : c'est de là qu'on lance une recherche. */
function labPlanet(){ return S.planets.reduce((a,p)=>(!a || p.b.lab>a.b.lab) ? p : a, null); }
function labLevel(){ return Math.max(0, ...S.planets.map(p=>p.b.lab)); }
/** Research time in seconds. */
function researchTime(key, L){
  const c = levelCost(T[key], L);
  let h = (c[0]+c[1]) / (1000 * (1+labLevel()) * S.settings.eco);
  if(S.settings.cls==='explorer') h *= .75;
  return Math.max(1, h*3600);
}
function storageCap(L){ return 5000*Math.floor(2.5*Math.exp(20*L/33)); }

/** Hourly production and energy balance for a planet, with optional level overrides. */
function production(p, ov){
  const b = Object.assign({}, p.b, ov||{}), s=S.settings, e=S.settings.eco, t=S.tech;
  const g = L => L*Math.pow(1.1,L);
  let eProd = Math.floor(20*g(b.solar)) + Math.floor(30*b.fusion*Math.pow(1.05+0.01*t.energy, b.fusion)) + p.sats*Math.max(1,Math.floor(p.tmax/4+20));
  let eBonus = 1 + (s.cls==='collector'?.1:0) + (s.eng?.1:0);
  eProd = Math.floor(eProd*eBonus) + (p.eAdj||0);
  const eCons = Math.ceil(10*g(b.metal)) + Math.ceil(10*g(b.crystal)) + Math.ceil(20*g(b.deut));
  const factor = eCons===0 ? 1 : Math.min(1, eProd/eCons);
  const common = (s.cls==='collector'?.25:0) + (s.geo?.1:0);
  const pos = (parseC(p.coords)||[])[2]||0, posM = POS_BONUS_M[pos]||0, posC = POS_BONUS_C[pos]||0;
  const m = 30*e + 30*g(b.metal)*e*factor*(1 + .01*t.plasma + common + posM);
  const c = 15*e + 20*g(b.crystal)*e*factor*(1 + .0066*t.plasma + common + posC);
  const dRaw = 10*g(b.deut)*(1.44 - .004*p.tmax)*e*factor*(1 + .0033*t.plasma + common);
  const dFus = 10*g(b.fusion)*e;
  return {m, c, d:dRaw - dFus, eProd, eCons, eBal:eProd-eCons, factor,
          cap:[storageCap(b.smetal), storageCap(b.scrystal), storageCap(b.sdeut)]};
}
function mse(m,c,d){ const r=S.settings.ratio; return m + c*r[0]/r[1] + d*r[0]/r[2]; }
function stockNow(p){
  const pr = production(p), h = (Date.now()-p.stock.at)/36e5;
  return [Math.min(Math.max(p.stock.m, pr.cap[0]), p.stock.m + pr.m*h),
          Math.min(Math.max(p.stock.c, pr.cap[1]), p.stock.c + pr.c*h),
          Math.min(Math.max(p.stock.d, pr.cap[2]), p.stock.d + pr.d*h)];
}
/** Seconds until `cost` is affordable on planet p. */
function waitFor(p, cost){
  const st = stockNow(p), pr = production(p), rates=[pr.m,pr.c,pr.d];
  let w = 0;
  for(let i=0;i<3;i++){ const miss = cost[i]-st[i]; if(miss>0){ if(cost[i]>pr.cap[i] && i<3) return {sec:Infinity, storage:i}; w = Math.max(w, rates[i]>0 ? miss/rates[i]*3600 : Infinity); } }
  return {sec:w};
}
function reqOk(req, p){
  const miss=[];
  if(!req) return miss;
  if(req.lab && labLevel()<req.lab) miss.push(`Labo ${req.lab}`);
  if(req.b) for(const [k,v] of Object.entries(req.b)) if(!p || p.b[k]<v) miss.push(`${B_SHORT[k]} ${v}`);
  if(req.t) for(const [k,v] of Object.entries(req.t)) if(S.tech[k]<v) miss.push(`${T[k].n.replace('Technologie ','')} ${v}`);
  return miss;
}

/** Ranks next building upgrades on a planet by payback time. */
function rankUpgrades(p){
  const base = production(p), baseV = mse(base.m, base.c, base.d), out=[];
  for(const k of ['metal','crystal','deut']){
    const ov = {[k]:p.b[k]+1}; let cost = levelCost(B[k], p.b[k]+1), extra=0;
    let pr = production(p, ov);
    while(pr.factor<1 && extra<15){ extra++; ov.solar = p.b.solar+extra; const sc=levelCost(B.solar, p.b.solar+extra); cost=cost.map((x,i)=>x+sc[i]); pr=production(p,ov); }
    const gain = mse(pr.m,pr.c,pr.d)-baseV;
    out.push({key:k, lvl:p.b[k]+1, extraSolar:extra, cost, gain, payback: gain>0 ? mse(...cost)/gain : Infinity, time:buildTime(k,p.b[k]+1,p)});
  }
  if(base.factor<1){
    const pr = production(p,{solar:p.b.solar+1}), cost=levelCost(B.solar,p.b.solar+1), gain=mse(pr.m,pr.c,pr.d)-baseV;
    out.push({key:'solar', lvl:p.b.solar+1, extraSolar:0, cost, gain, payback: gain>0?mse(...cost)/gain:Infinity, time:buildTime('solar',p.b.solar+1,p)});
  }
  return out.sort((a,b)=>a.payback-b.payback);
}

/* ---------- fleet formulas ---------- */
function parseC(s){ const m=String(s).trim().match(/^(\d+)\s*:\s*(\d+)\s*:\s*(\d+)$/); return m ? m.slice(1).map(Number) : null; }
function distance(a,b){
  if(a[0]!==b[0]) return 20000*Math.abs(a[0]-b[0]);
  if(a[1]!==b[1]){ let d = Math.abs(a[1]-b[1]); const sv = API && API.server; if(sv && sv.donutSystem) d = Math.min(d, sv.systems - d); return 2700 + 95*d; }
  if(a[2]!==b[2]) return 1000 + 5*Math.abs(a[2]-b[2]);
  return 5;
}
/** Effective drive, speed and fuel of a ship given current research. */
function shipStats(k){
  const sh = Object.assign({}, SHIPS[k]), t=S.tech;
  if(k==='sc' && t.impulse>=5){ sh.speed=10000; sh.drive='impulse'; sh.fuel=20; }
  if(k==='bb' && t.hyperdrive>=8){ sh.speed=5000; sh.drive='hyperdrive'; sh.fuel=1000; }
  if(k==='rec'){ if(t.hyperdrive>=15){ sh.speed=6000; sh.drive='hyperdrive'; sh.fuel=900; } else if(t.impulse>=17){ sh.speed=4000; sh.drive='impulse'; sh.fuel=600; } }
  sh.speedEff = sh.speed*(1 + t[sh.drive]*DRIVE_BONUS[sh.drive] + ((sh.transporter && S.settings.cls==='collector') ? 1 : 0));
  sh.cargoEff = Math.floor(sh.cargo*(1 + .05*t.hyper + ((sh.transporter && S.settings.cls==='collector' && S.settings.colCargo) ? .25 : 0)));
  return sh;
}
function flight(from, to, ships, pct){
  const a=parseC(from), b=parseC(to); if(!a||!b) return null;
  const list = Object.entries(ships).filter(([,n])=>n>0).map(([k,n])=>({...shipStats(k),k,n}));
  if(!list.length) return null;
  const D = distance(a,b), V = Math.min(...list.map(s=>s.speedEff)), fs=S.settings.fleet;
  const secs = (10 + 35000/(pct/10)*Math.sqrt(10*D/V))/fs;
  let cons = 0;
  for(const s of list){ const spd = 35000/(secs*fs - 10)*Math.sqrt(D*10/s.speedEff); cons += s.n*s.fuel*D/35000*Math.pow(spd/10+1,2); }
  return {D, V, secs:Math.round(secs), fuel:Math.round(cons)+1, cargo:list.reduce((x,s)=>x+s.n*s.cargoEff,0), slowest:SHIPS[list.find(s=>s.speedEff===V).k].n};
}

/* ---------- views ---------- */
const view = document.getElementById('view');
let tab = 'today';
try{ tab = LS.getItem(KEY+'-tab') || 'today'; }catch(e){}
if(!['today','empire','tools','settings'].includes(tab)) tab='today';

function header(){
  const s=S.settings;
  document.getElementById('uniBadge').textContent = `${S.syncAt ? 'synchro ' + new Date(S.syncAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) + ' · ' : 'en attente du jeu · '}éco x${s.eco} · flotte x${s.fleet} · ${({collector:'Collecteur',general:'Général',explorer:'Explorateur',none:'Sans classe'})[s.cls]}`;
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.tab===tab)));
}
function render(){ header(); view.innerHTML = VIEWS[tab](); bind(); refresh(); }
function refresh(){ (REFRESH[tab]||(()=>{}))(); header(); }

/* ---------- advice ---------- */
const MILESTONES = [
  {t:'b', k:'lab', lvl:1, why:'Débloque toutes les recherches.'},
  {t:'t', k:'energy', lvl:1, why:'Premier prérequis de presque tout l\'arbre technologique.'},
  {t:'b', k:'robot', lvl:2, why:'Accélère les constructions et débloque le chantier spatial.'},
  {t:'b', k:'shipyard', lvl:2, why:'Nécessaire au petit transporteur.'},
  {t:'t', k:'combustion', lvl:2, why:'Débloque le petit transporteur : fleetsave et pillage.'},
  {t:'t', k:'espionage', lvl:2, why:'Sondes d\'espionnage pour repérer les joueurs inactifs.'},
  {t:'t', k:'computer', lvl:2, why:'Un slot de flotte supplémentaire par niveau.'},
  {t:'b', k:'lab', lvl:3, why:'Requis pour Astrophysique.'},
  {t:'t', k:'impulse', lvl:3, why:'Requis pour Astrophysique.'},
  {t:'t', k:'espionage', lvl:4, why:'Requis pour Astrophysique.'},
  {t:'t', k:'astro', lvl:1, why:'Première colonie et premières expéditions.'},
];
function milestoneDone(m){ return m.t==='t' ? S.tech[m.k]>=m.lvl : S.planets[0] && S.planets[0].b[m.k]>=m.lvl; }
function milestoneLabel(m){ return m.t==='t' ? `${T[m.k].n} ${m.lvl}` : `${B[m.k].n} ${m.lvl}`; }
function milestoneMissing(m){ return m.t==='t' ? reqOk(T[m.k].req, null) : reqOk(B[m.k].req, S.planets[0]); }

/** Builds a prioritized action list from the current state. */
function adviceList(){
  const out = [];
  S.planets.forEach((p,i)=>{
    const pr = production(p), st = stockNow(p), r = rankUpgrades(p);
    const where = S.planets.length>1 ? ` sur ${p.name}` : '';
    if(pr.factor<1){
      const best = r[0];
      out.push({sev:'bad', what:`Rétablir l'énergie${where}`, why:`Tes mines tournent à ${Math.round(pr.factor*100)} %. ${best ? `Le plus rentable : ${B_SHORT[best.key]} ${best.lvl}${best.extraSolar?` avec solaire ${p.b.solar+best.extraSolar}`:''}.` : 'Monte la centrale solaire.'}`});
    }
    ['m','c','d'].forEach((x,k)=>{
      const rate=[pr.m,pr.c,pr.d][k], name=['Hangar de métal','Hangar de cristal','Réservoir de deutérium'][k], bk=['smetal','scrystal','sdeut'][k];
      if(st[k]>=pr.cap[k]*0.98) out.push({sev:'bad', what:`${name} plein${where}`, why:`La production de ${['métal','cristal','deutérium'][k]} est arrêtée. Dépense ou monte ${name} ${p.b[bk]+1}.`});
      else if(rate>0 && (pr.cap[k]-st[k])/rate<8) out.push({sev:'warn', what:`${name} plein dans ${dur((pr.cap[k]-st[k])/rate*3600)}${where}`, why:`Prévois ${name} ${p.b[bk]+1} avant une longue absence.`});
    });
    const best = r.find(u=>u.payback<Infinity);
    if(best && pr.factor>=1){
      const w = waitFor(p, best.cost);
      out.push({sev:'info', what:`Construire ${B_SHORT[best.key]} ${best.lvl}${best.extraSolar?` puis solaire ${p.b.solar+best.extraSolar}`:''}${where}`, why:`Meilleur amortissement de tes mines : ${dur(best.payback*3600)}. ${w.sec===0?'Tu peux le lancer maintenant.':w.storage!=null?'Hangar trop petit pour ce coût.':`Payable dans ${dur(w.sec)}.`}`});
    }
  });
  const next = MILESTONES.filter(m=>!milestoneDone(m));
  const ready = next.find(m=>!milestoneMissing(m).length);
  if(ready) out.push({sev:'info', what:`${ready.t==='t'?'Rechercher':'Construire'} ${milestoneLabel(ready)}`, why:`${ready.why} Étape ${MILESTONES.indexOf(ready)+1} sur ${MILESTONES.length} du début de partie.`});
  else if(next[0]) out.push({sev:'warn', what:`Prochaine étape : ${milestoneLabel(next[0])}`, why:`Il manque : ${milestoneMissing(next[0]).join(', ')}.`});
  const maxPl = 1 + Math.ceil(S.tech.astro/2);
  if(S.tech.astro && S.planets.length<maxPl) out.push({sev:'info', what:`Coloniser (${S.planets.length}/${maxPl} planètes)`, why:'Chaque colonie ajoute une production complète. Prépare-la dans l\'onglet Colonie : position, vaisseaux et ressources à emporter.'});
  S.plan.forEach(it=>{
    const p = it.type==='b' ? S.planets[it.p] : S.planets[0]; if(!p) return;
    const from = it.type==='b' ? p.b[it.k] : S.tech[it.k]; if(from>=it.lvl) return;
    const def = it.type==='b' ? B[it.k] : T[it.k], c = levelCost(def, from+1), miss = it.type==='b'?reqOk(def.req,p):reqOk(def.req,null);
    if(!miss.length && waitFor(p,c).sec===0) out.push({sev:'good', what:`Plan : lancer ${def.n} ${from+1}`, why:'Les ressources sont disponibles.'});
  });
  if(!(S.timers||[]).some(t=>t.kind==='t' && !t.done)) out.push({sev:'warn', what:'Aucune recherche suivie', why:'Si une recherche tourne dans le jeu, ajoute un minuteur pour être prévenu à la fin. Sinon, lances-en une : le labo ne doit jamais rester à l\'arrêt.'});
  const importFresh = !S.syncAt || (S.lastImport||0) >= S.syncAt - 60000;
  (importFresh ? (S.lastAlerts||[]) : []).forEach(a=>{ if(/file vide|arr[eê]t/i.test(a)) out.push({sev:'warn', what:a, why:'Signalé par le dernier import de la Vue empire. Une file vide, c\'est du temps de production perdu.'}); });
  out.push({sev:'info', what:'Avant de te déconnecter', why:'Dépense tes ressources ou mets-les à l\'abri (fleetsave), surtout une fois sorti de la protection débutant.'});
  const order = {bad:0, warn:1, good:2, info:3};
  return out.sort((a,b)=>order[a.sev]-order[b.sev]);
}
const SEV_LABEL = {bad:'Urgent', warn:'Attention', good:'Prêt', info:'Conseillé'};

/* ---------- timers ---------- */
S.timers = S.timers || [];
/** Parses an OGame countdown like "1j 2h 13m 5s", "2h13m", "01:13:05" into seconds. */
function parseLeft(txt){
  const t = norm(txt).replace(/,/g,' ');
  if(/^\s*\d+(:\d{1,2}){1,2}\s*$/.test(t)){ const p=t.trim().split(':').map(Number); return p.length===3 ? p[0]*3600+p[1]*60+p[2] : p[0]*60+p[1]; }
  let sec=0, hit=false;
  const re=/(\d+)\s*(sem|w|j|d|h|m(?!s)|min|s)/g; let m;
  while((m=re.exec(t))){ hit=true; const v=+m[1]; sec += v*({sem:604800,w:604800,j:86400,d:86400,h:3600,m:60,min:60,s:1}[m[2]]); }
  if(!hit && /^\s*\d+\s*$/.test(t)) return +t*60;
  return hit ? sec : null;
}
function timerOptions(){
  const r = Object.keys(T).map(k=>`<option value="t:${k}">${T[k].n} ${S.tech[k]+1}</option>`).join('');
  const b = S.planets.map((p,i)=>`<optgroup label="Bâtiments · ${esc(p.name)}">${Object.keys(B).map(k=>`<option value="b:${i}:${k}">${B[k].n} ${p.b[k]+1}</option>`).join('')}</optgroup>`).join('');
  return `<optgroup label="Recherche">${r}</optgroup>${b}<optgroup label="Autre"><option value="x:fleet">Retour de flotte</option><option value="x:expo">Retour d'expédition</option><option value="x:other">Autre</option></optgroup>`;
}
function timerLabel(tm){
  if(tm.kind==='t') return `${T[tm.k].n} ${tm.lvl}`;
  if(tm.kind==='b'){ const p=S.planets[tm.p]; return `${B[tm.k].n} ${tm.lvl}${p&&S.planets.length>1?` · ${p.name}`:''}`; }
  return tm.label || ({fleet:'Retour de flotte',expo:'Retour d\'expédition',other:'Minuteur'})[tm.k];
}
let audioCtx = null;
function unlockAudio(){ try{ audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }catch(e){} }
function chime(){
  if(!audioCtx) return;
  try{ const t0=audioCtx.currentTime; [0,.22,.44,.9,1.12,1.34].forEach((d,i)=>{ const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type='sine'; o.frequency.value=[660,880,1100][i%3]; g.gain.setValueAtTime(.0001,t0+d); g.gain.exponentialRampToValueAtTime(.25,t0+d+.02); g.gain.exponentialRampToValueAtTime(.0001,t0+d+.2); o.connect(g).connect(audioCtx.destination); o.start(t0+d); o.stop(t0+d+.22); }); }catch(e){}
}
const baseTitle = document.title;
let flashT = null;
function flashTitle(msg){ clearInterval(flashT); let on=false; flashT=setInterval(()=>{ document.title = (on=!on) ? `Terminé : ${msg}` : baseTitle; },1000); }
const alertQueue = [];
/** Shows a full-screen pulsing alert that stays until dismissed. */
function showBigAlert(label){
  alertQueue.push(label);
  const box = document.getElementById('bigAlert');
  document.getElementById('bigAlertMsg').innerHTML = alertQueue.map(esc).join('<br>');
  box.hidden = false;
}
/** Hides every finished timer up to now. */
function ackFinished(){ S.ackBefore = Date.now(); save(); renderTimers(); }
document.getElementById('bigAlertOk').addEventListener('click', ()=>{ alertQueue.length = 0; document.getElementById('bigAlert').hidden = true; stopFlash(); ackFinished(); });
function stopFlash(){ clearInterval(flashT); flashT=null; document.title=baseTitle; }
window.addEventListener('focus', stopFlash);
document.addEventListener('pointerdown', ()=>{ unlockAudio(); stopFlash(); });
/** Completes a timer: bumps the matching level, rings and notifies. */
function finishTimer(tm){
  tm.done = true;
  if(tm.kind==='t' && S.tech[tm.k] < tm.lvl) S.tech[tm.k] = tm.lvl;
  if(tm.kind==='x' && tm.k==='colship') S.colo.built = true;
  if(tm.kind==='x' && tm.k==='sats' && S.planets[tm.p] && !tm.game) S.planets[tm.p].sats += tm.n||0;
  if(tm.kind==='x' && tm.k==='shipyard' && tm.ships && S.planets[tm.p] && !tm.game){ const pl=S.planets[tm.p]; pl.ships=pl.ships||{}; for(const [k,n] of Object.entries(tm.ships)) pl.ships[k]=(pl.ships[k]||0)+n; }
  if(tm.kind==='b'){ const p=S.planets[tm.p]; if(p && p.b[tm.k] < tm.lvl) p.b[tm.k] = tm.lvl; }
  save(); chime(); flashTitle(timerLabel(tm));
  const extHandles = tm.game && window.chrome && chrome.runtime && chrome.runtime.id;
  if(!extHandles) showBigAlert(timerLabel(tm));
}
function tickTimers(){
  const now = Date.now(); let changed=false;
  for(const tm of S.timers){ if(!tm.done && tm.end<=now){ finishTimer(tm); changed=true; } }
  const list = document.getElementById('tmList');
  if(list){
    if(changed || list.dataset.count !== String(visibleTimers().length)) renderTimers();
    else S.timers.forEach(tm=>{ const el=document.getElementById('cd-'+tm.id); if(el && !tm.done) el.textContent = clock((tm.end-now)/1000); });
  }
  if(changed && tab==='today') REFRESH.today();
}
function clock(sec){ sec=Math.max(0,Math.round(sec)); const d=Math.floor(sec/86400), h=Math.floor(sec%86400/3600), m=Math.floor(sec%3600/60), s=sec%60; return (d?d+'j ':'') + `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
/** Timers still worth showing: running, or finished but not yet acknowledged. */
function visibleTimers(){ return S.timers.filter(t=>!(t.done || t.end<=Date.now()) || t.end > (S.ackBefore||0)); }
function renderTimers(){
  const list = document.getElementById('tmList'); if(!list) return;
  const sorted = visibleTimers().sort((a,b)=>(a.done-b.done)||(a.end-b.end));
  list.dataset.count = String(sorted.length);
  list.innerHTML = sorted.length ? sorted.map(tm=>`<li class="${tm.done?'done':''}"><div><div>${esc(timerLabel(tm))}</div><div class="note">fin à ${new Date(tm.end).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}${new Date(tm.end).toDateString()!==new Date().toDateString()?' le '+new Date(tm.end).toLocaleDateString('fr-FR'):''}</div></div>
    <div class="row" style="gap:8px"><span class="cd" id="cd-${tm.id}">${tm.done?'Terminé':clock((tm.end-Date.now())/1000)}</span><button class="btn sm ghost" data-tmrm="${tm.id}">${tm.done?'OK':'Annuler'}</button></div></li>`).join('')
    : `<li><div class="note">Aucun minuteur. Copie le compte à rebours affiché dans le jeu, colle-le ici et lance.</div></li>`;
}

/* ---------- colonization ---------- */
const POS = [null,
  {min:96, avg:134, max:172, t:240, bonus:'+40 % cristal', astro:8},
  {min:104,avg:140, max:176, t:190, bonus:'+30 % cristal', astro:6},
  {min:112,avg:147, max:182, t:140, bonus:'+20 % cristal', astro:4},
  {min:118,avg:163, max:208, t:90,  bonus:'', astro:1},
  {min:133,avg:182, max:232, t:80,  bonus:'', astro:1},
  {min:146,avg:194, max:242, t:70,  bonus:'+17 % métal', astro:1},
  {min:152,avg:200, max:248, t:60,  bonus:'+23 % métal', astro:1},
  {min:156,avg:204, max:252, t:50,  bonus:'+35 % métal', astro:1},
  {min:150,avg:198, max:246, t:40,  bonus:'+23 % métal', astro:1},
  {min:142,avg:187, max:232, t:30,  bonus:'+17 % métal', astro:1},
  {min:136,avg:173, max:210, t:20,  bonus:'', astro:1},
  {min:125,avg:156, max:186, t:10,  bonus:'', astro:1},
  {min:114,avg:143, max:172, t:-30, bonus:'', astro:4},
  {min:100,avg:134, max:168, t:-70, bonus:'', astro:6},
  {min:90, avg:127, max:164, t:-110,bonus:'', astro:8},
];
const POS_BONUS_M = {6:.17, 7:.23, 8:.35, 9:.23, 10:.17};
const POS_BONUS_C = {1:.40, 2:.30, 3:.20};
const COL_SHIP_COST = [10000, 20000, 10000];
const KITS = {
  none: {n:'Aucun', lv:{}},
  light:{n:'Léger', lv:{metal:5, crystal:4, deut:2, solar:5}},
  std:  {n:'Standard', lv:{metal:8, crystal:6, deut:4, solar:8, robot:2}},
  fast: {n:'Rapide', lv:{metal:12, crystal:10, deut:6, solar:12, robot:4, shipyard:2}},
  big:  {n:'Avancé', lv:{metal:15, crystal:13, deut:9, solar:15, robot:6, shipyard:4}},
};
const OBJECTIVES = {
  balanced:{n:'Équilibré', w:{prod:.5, fields:.5}},
  metal:   {n:'Métal', w:{metal:.75, fields:.25}},
  deut:    {n:'Deutérium', w:{deut:.7, fields:.3}},
  big:     {n:'Grande planète', w:{fields:.8, prod:.2}},
};
/** Index of a planet that already has a colony ship docked, or -1. */
function colShipAt(){ return S.planets.findIndex(p=>((p.ships||{}).col||0)>0); }
/** True when a colonize mission is already flying or was marked as sent. */
function colSentNow(){ return (S.moves||[]).some(m=>m.mission===7 && !m.ret && m.arrival*1000>Date.now()) || !!(S.colo.sentAt && Date.now()-S.colo.sentAt<48*3600e3 && !S.planets.some(p=>((p.ships||{}).col||0)>0 && (p.shipsAt||0)>S.colo.sentAt)); }
function colBuilt(){ return !!S.colo.built || colShipAt()>=0; }
function maxPlanets(){ return 1 + Math.floor((S.tech.astro+1)/2); }
function coloFrom(){ const i = colShipAt(); return S.planets[i>=0 ? i : S.colo.from] || S.planets[0]; }
function coloSystem(){ const c = parseC(coloFrom().coords) || [1,1,8]; return c; }
/** Simulated hourly output of a colony at each position, using the departure planet's mine levels. */
function rankPositions(){
  const dp = coloFrom(), [g,sy] = coloSystem(), o = OBJECTIVES[S.colo.objective] || OBJECTIVES.balanced, bonus = +S.colo.bonus || 0;
  const rows = [];
  for(let pos=1; pos<=15; pos++){
    const P = POS[pos];
    const fake = {coords:`${g}:${sy}:${pos}`, tmax:P.t, sats:0, b:Object.assign({}, dp.b)};
    const pr = production(fake);
    rows.push({pos, P, fields:P.avg+bonus, min:P.min+bonus, max:P.max+bonus, m:pr.m, c:pr.c, d:pr.d, v:mse(pr.m,pr.c,pr.d), ok:S.tech.astro>=P.astro});
  }
  const mx = k => Math.max(...rows.map(r=>r[k]), 1);
  const M = {prod:mx('v'), metal:mx('m'), deut:mx('d'), fields:mx('fields')};
  for(const r of rows){
    r.score = (o.w.prod||0)*r.v/M.prod + (o.w.metal||0)*r.m/M.metal + (o.w.deut||0)*r.d/M.deut + (o.w.fields||0)*r.fields/M.fields;
  }
  const ranked = rows.filter(r=>r.ok).sort((a,b)=>b.score-a.score);
  ranked.forEach((r,i)=>r.rank=i+1);
  return rows;
}
function bestPosition(){ const r = rankPositions().filter(x=>x.ok).sort((a,b)=>b.score-a.score)[0]; return r ? r.pos : 8; }
function coloTarget(){ if(parseC(S.colo.target)) return S.colo.target; const c = API && API.planets ? colonyCandidates()[0] : null; if(c) return c.coords; const [g,sy] = coloSystem(); return `${g}:${sy}:${bestPosition()}`; }
/** Starter kit cost and the fleet that delivers it. */
function coloFleet(){
  const dp = coloFrom(), kit = KITS[S.colo.kit] || KITS.std, target = coloTarget();
  const kitCost = [0,0,0];
  for(const [k,L] of Object.entries(kit.lv)){ const c = rangeCost(B[k], 0, L); kitCost[0]+=c[0]; kitCost[1]+=c[1]; kitCost[2]+=c[2]; }
  const col = shipStats('col'), tr = shipStats(S.colo.tr);
  const total = kitCost[0]+kitCost[1]+kitCost[2];
  const inCol = Math.min(total, col.cargoEff);
  const f = total ? inCol/total : 0;
  const colLoad = kitCost.map(x=>Math.floor(x*f));
  const rest = kitCost.map((x,i)=>x-colLoad[i]);
  const restSum = rest[0]+rest[1]+rest[2];
  const n = restSum>0 ? Math.ceil(restSum/tr.cargoEff) : 0;
  const leg1 = flight(dp.coords, target, {col:1}, 100);
  const leg2 = n ? flight(dp.coords, target, {[S.colo.tr]:n}, 100) : null;
  const fuel = (leg1 ? leg1.fuel : 0) + (leg2 ? leg2.fuel*2 : 0);
  const ship = colBuilt() ? [0,0,0] : COL_SHIP_COST;
  const need = [ship[0]+kitCost[0], ship[1]+kitCost[1], ship[2]+kitCost[2]+fuel];
  const shipTime = colBuilt() ? 0 : (COL_SHIP_COST[0]+COL_SHIP_COST[1]) / (2500*(1+dp.b.shipyard)*Math.pow(2,dp.b.nanite)*S.settings.eco) * 3600;
  return {dp, kit, kitCost, colLoad, rest, n, tr, col, leg1, leg2, fuel, need, shipTime, target, wait:waitFor(dp, need)};
}
/** Verdict on a freshly colonized planet's size. */
function coloVerdict(fields, pos){
  const P = POS[pos]; if(!P || !fields) return null;
  const avg = P.avg + (+S.colo.bonus||0), r = fields/avg;
  if(r >= 1) return {sev:'good', t:'Garde-la', why:`${fields} cases, au-dessus de la moyenne de la position ${pos} (${avg}).`};
  if(r >= .88) return {sev:'warn', t:'Correcte', why:`${fields} cases pour une moyenne de ${avg}. Garde-la si tu ne veux pas perdre de temps.`};
  return {sev:'bad', t:'Trop petite : recolonise', why:`${fields} cases pour une moyenne de ${avg}. Abandonne-la avant d'y construire et renvoie un vaisseau (coût ${fmt(COL_SHIP_COST[0])} M, ${fmt(COL_SHIP_COST[1])} C, ${fmt(COL_SHIP_COST[2])} D).`};
}

/** Expedition fleet from the ships at dock: cargo up to the find cap, plus a pathfinder and a probe if available. */
function expoFleet(avail){
  avail = avail || {};
  const s = S.settings, pf = (avail.pf||0) > 0 ? 1 : 0;
  const cap = EXPO_CAPS[s.top1][1]*s.eco*(s.cls==='explorer'?1.5:1)*(pf?2:1);
  let need = Math.max(0, cap - (pf ? shipStats('pf').cargoEff : 0));
  const lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
  const lc = Math.min(avail.lc||0, Math.ceil(need/lcC)); need -= lc*lcC;
  const sc = need>0 ? Math.min(avail.sc||0, Math.ceil(need/scC)) : 0;
  if(!lc && !sc) return null;
  const ships = {}; if(lc) ships.lc=lc; if(sc) ships.sc=sc; if(pf) ships.pf=1; if((avail.pr||0)>0) ships.pr=1;
  return {ships, cap, cargo: lc*lcC + sc*scC + (pf?shipStats('pf').cargoEff:0)};
}
const SHIP_PLURAL = {sc:'petits transporteurs', lc:'grands transporteurs', pf:'éclaireurs', lf:'chasseurs légers', hf:'chasseurs lourds', cr:'croiseurs', bs:'vaisseaux de bataille', bc:'traqueurs', bb:'bombardiers', ds:'destructeurs', rp:'faucheurs', rec:'recycleurs', col:'vaisseaux de colonisation', pr:"sondes d'espionnage"};
function shipList(ships){ return Object.entries(ships||{}).filter(([,n])=>n>0).map(([k,n])=>`${n} ${n>1 ? SHIP_PLURAL[k] : SHIPS[k].n.toLowerCase()}`).join(', '); }

/* ---------- daily planner ---------- */
const ROADMAPS = {
  ecocol:[['impulse',3,'c'],['astro',3,'c'],['computer',2],['espionage',4],['energy',8],['laser',10],['ion',5],['plasma',4],['astro',5],['computer',6],['plasma',8],['astro',7]],
  eco:[['energy',8],['laser',10],['ion',5],['plasma',6],['impulse',3],['astro',3],['computer',4],['plasma',10]],
  fleet:[['combustion',6,'c'],['impulse',3,'c'],['espionage',4],['computer',6],['astro',4],['hyper',3],['hyperdrive',2],['impulse',5],['astro',6],['energy',8]],
};
const FOCUS = {ecocol:'Économie + colonie', eco:'Économie pure', fleet:'Flotte et expéditions'};
const hm = ms => { const d=new Date(ms), today=new Date(); const t=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); return d.toDateString()===today.toDateString() ? t : (new Date(today.getTime()+864e5).toDateString()===d.toDateString() ? 'demain '+t : d.toLocaleDateString('fr-FR',{weekday:'short'})+' '+t); };
function isNight(ms){ const d=new Date(ms), h=d.getHours()+d.getMinutes()/60, a=+S.day.nightStart, b=+S.day.nightEnd; if(a===b) return false; return a>b ? (h>=a || h<b) : (h>=a && h<b); }
/** Connection times over the planning horizon, skipping the night window. */
function sessionTimes(now){
  const out=[now], end=now+(+S.day.horizon||24)*3600e3, step=Math.max(15,+S.day.interval||90)*60e3;
  let t=now;
  while(out.length<80){
    t+=step;
    if(isNight(t)){ const d=new Date(t); d.setMinutes(0,0,0); let g=0; while(isNight(d.getTime()) && g<30){ d.setHours(d.getHours()+1); g++; } t=d.getTime(); }
    if(t>end) break;
    out.push(t);
  }
  return out;
}
/** Next actionable step toward a research target, or the lab level it waits for. */
function resolveTech(k, lvl, depth){
  if(S.tech[k]>=lvl || depth>6) return null;
  const req = T[k].req || {};
  if(req.t) for(const [rk,rl] of Object.entries(req.t)){ const r = resolveTech(rk, rl, depth+1); if(r) return r; }
  if(req.lab && labLevel()<req.lab) return {lab:req.lab};
  return {k, lvl:S.tech[k]+1};
}
function nextResearch(){
  let labNeed = 0; const list = [];
  for(const [k,l,flag] of ROADMAPS[S.day.focus] || ROADMAPS.ecocol){
    const r = resolveTech(k, l, 0); if(!r) continue;
    if(r.lab){ labNeed = Math.max(labNeed, r.lab); continue; }
    if(!list.some(x=>x.k===r.k)) list.push({k:r.k, lvl:r.lvl, crit:flag==='c'});
  }
  return {list, labNeed, k:list[0]&&list[0].k, lvl:list[0]&&list[0].lvl};
}
/**
 * Une colonie qui déborde et n'a aucun transporteur doit pouvoir en construire.
 * Sinon chaque rapatriement commence par un vol à vide depuis la planète
 * d'accueil. Ne s'emploie que sur les planètes simulées, qui portent `st`.
 * @param {object} p planète simulée
 * @param {object} hub planète d'accueil
 * @returns {boolean}
 */
function needsOwnCargo(p, hub){
  if(!hub || p === hub) return false;
  if(((p.ships||{}).lc||0) + ((p.ships||{}).sc||0) > 0) return false;
  // `transferAt` est posé dès qu'un rapatriement part de cette planète : c'est
  // le fait durable. Le stock, lui, vient d'être vidé par ce rapatriement —
  // le tester seul ne renverrait jamais vrai.
  if(p.transferAt) return true;
  const cap = production(p).cap;
  return [0,1,2].some(j => p.st[j] > cap[j]*0.7);
}
/** Building candidates for a simulated planet, most urgent first. */
function pickBuildings(p, ctx){
  const pr = production(p), iv = ctx.iv, rates=[pr.m,pr.c,pr.d], sk=['smetal','scrystal','sdeut'], out=[];
  const add = (k, why)=>{ if(!out.some(o=>o.k===k)) out.push({k, lvl:p.b[k]+1, why}); };
  const ranked = rankUpgrades(p).filter(u=>u.payback<Infinity);
  const satsSoon = p.satPending && p.satPending > ctx.T;
  if(pr.factor<1 && !satsSoon) add('solar', 'Énergie négative : tes mines tournent au ralenti');
  for(let j=0;j<3;j++) if(rates[j]>0 && p.st[j]+rates[j]*iv*2 >= pr.cap[j]*.98) add(sk[j], 'Hangar plein avant ta prochaine connexion');
  const best = ranked[0];
  if(best){ const bc = best.extraSolar ? levelCost(B.solar,p.b.solar+1) : levelCost(B[best.key],best.lvl); for(let j=0;j<3;j++) if(bc[j]>pr.cap[j]) add(sk[j], 'Hangar trop petit pour la suite'); }
  for(const g of ctx.goals||[]) if(g.p===p) for(let j=0;j<3;j++) if(g.cost[j]>pr.cap[j]) add(sk[j], `Hangar trop petit pour ${g.label}`);
  if(ctx.wantColony && p===ctx.dep && p.b.shipyard<4){
    if(p.b.robot<2) add('robot', 'Prérequis du chantier spatial');
    else add('shipyard', 'Prérequis du vaisseau de colonisation');
  }
  if(ctx.labNeed && p===ctx.labP && p.b.lab<ctx.labNeed && !ctx.researchRunning) add('lab', 'Débloque la recherche suivante');
  if(needsOwnCargo(p, ctx.hub) && p.b.shipyard < 2){
    if(p.b.robot < 2) add('robot', 'Prérequis du chantier spatial');
    else add('shipyard', 'Pour que cette colonie ait ses propres transporteurs');
  }
  const robotTarget = Math.min(10, Math.floor(Math.max(p.b.metal,p.b.crystal)/2));
  if(p.b.robot < robotTarget && best){ const rc = levelCost(B.robot,p.b.robot+1); if(mse(...rc) <= 3*mse(...best.cost)) add('robot', 'Accélère toutes les constructions'); }
  for(const u of ranked.slice(0,2)){
    if(u.extraSolar && satsSoon) add(u.key, `Meilleur rendement, énergie fournie par les satellites`);
    else if(u.extraSolar) add('solar', `Énergie pour ${B_SHORT[u.key]} ${u.lvl}`);
    else add(u.key, `Meilleur rendement : amorti en ${dur(u.payback*3600)}`);
  }
  return out;
}
/** Simulates the day: production, queues, and what to launch at each connection. */
function simulateDay(){
  const now = Date.now(), real = {tech:S.tech, planets:S.planets};
  const target = coloTarget(), colFlight = (coloFleet().leg1||{}).secs || 0;
  const P = S.planets.map((p,i)=>({i, name:p.name, coords:p.coords, tmax:p.tmax, sats:p.sats, b:Object.assign({},p.b), ships:Object.assign({},p.ships||{}), st:stockNow(p), bq:now, bqKey:null, sq:now}));
  const expoBusy = [];
  const fleetReturns = (S.timers||[]).filter(t=>t.kind==='x' && (t.k==='fleet'||t.k==='expo') && !t.done && t.end>now).map(t=>t.end).sort((a,b)=>a-b);
  const sim = {tech:Object.assign({},S.tech), rq:now, ev:[], colShip:colBuilt(), colReady:colBuilt()?now:Infinity, colSent:colSentNow(), rSince:{}, away:{}, fleetFreeAt: fleetReturns[0] || now+30*60e3};
  const busy = [];
  for(const t of S.timers||[]){
    if(t.done || t.end<=now) continue;
    if(t.kind==='t' && T[t.k]){ sim.rq=Math.max(sim.rq,t.end); busy.push({q:'Recherche · '+planetRef(labPlanet()), what:timerLabel(t), end:t.end}); sim.ev.push({at:t.end, fn:()=>{ sim.tech[t.k]=Math.max(sim.tech[t.k],t.lvl); }}); }
    else if(t.kind==='b' && P[t.p]){ const p=P[t.p]; p.bq=Math.max(p.bq,t.end); p.bqKey=t.k; busy.push({q:'Bâtiment · '+planetRef(p), what:timerLabel(t), end:t.end}); sim.ev.push({at:t.end, fn:()=>{ p.b[t.k]=Math.max(p.b[t.k],t.lvl); }}); }
    else if(t.kind==='x' && t.k==='expo'){ expoBusy.push(t.end); busy.push({q:'Flotte', what:timerLabel(t), end:t.end}); if(t.manual && t.ships && P[t.p]){ const p=P[t.p]; for(const [k,n] of Object.entries(t.ships)) p.ships[k]=Math.max(0,(p.ships[k]||0)-n); sim.ev.push({at:t.end, fn:()=>{ for(const [k,n] of Object.entries(t.ships)) p.ships[k]=(p.ships[k]||0)+n; }}); } }
    else if(t.kind==='x' && t.k==='fleet'){ busy.push({q:'Flotte', what:timerLabel(t), end:t.end}); if(t.manual && t.ships && P[t.p]){ const p=P[t.p]; for(const [k,n] of Object.entries(t.ships)) p.ships[k]=Math.max(0,(p.ships[k]||0)-n); sim.ev.push({at:t.end, fn:()=>{ for(const [k,n] of Object.entries(t.ships)) p.ships[k]=(p.ships[k]||0)+n; }}); } }
    else if(t.kind==='x' && (t.k==='shipyard' || t.queue==='shipyard') && P[t.p]){ const p=P[t.p]; p.sq=Math.max(p.sq,t.end); busy.push({q:'Chantier spatial · '+planetRef(p), what:timerLabel(t), end:t.end}); if(t.manual && t.ships) sim.ev.push({at:t.end, fn:()=>{ for(const [k,n] of Object.entries(t.ships)) p.ships[k]=(p.ships[k]||0)+n; }}); }
    else if(t.kind==='x' && t.k==='sats' && P[t.p]){ const p=P[t.p]; p.sq=Math.max(p.sq,t.end); p.satPending=t.end; busy.push({q:'Chantier spatial · '+planetRef(p), what:timerLabel(t), end:t.end}); sim.ev.push({at:t.end, fn:()=>{ p.sats+=t.n||0; p.satPending=0; }}); }
    else if(t.kind==='x' && t.k==='colship'){ const p=P[+S.colo.from]||P[0]; p.sq=t.end; sim.colShip=true; sim.colReady=t.end; busy.push({q:'Chantier spatial', what:'Vaisseau de colonisation', end:t.end}); }
  }
  const iv = Math.max(15,+S.day.interval||90)/60;
  S.tech = sim.tech; S.planets = P;
  try{
    const startV = P.reduce((a,p)=>{ const r=production(p); return a+mse(r.m,r.c,r.d); },0);
    const accrue = (a,b)=>{ if(b<=a) return; const h=(b-a)/36e5; for(const p of P){ const pr=production(p); [pr.m,pr.c,pr.d].forEach((r,j)=>{ if(r>0 && p.st[j]>=pr.cap[j]) return; p.st[j] = r>0 ? Math.min(pr.cap[j], p.st[j]+r*h) : Math.max(0, p.st[j]+r*h); }); } };
    let cur = now;
    const advance = to=>{ sim.ev.sort((x,y)=>x.at-y.at); while(sim.ev.length && sim.ev[0].at<=to){ const e=sim.ev.shift(); accrue(cur, Math.max(cur,e.at)); cur=Math.max(cur,e.at); e.fn(); } accrue(cur,to); cur=Math.max(cur,to); };
    const can = (p,c,res)=>c.every((x,j)=>p.st[j]-x >= (res?res[j]:0)-1e-6);
    const pay = (p,c)=>c.forEach((x,j)=>p.st[j]-=x);
    const missOf = (p,c)=>c.map((x,j)=>Math.max(0,Math.ceil(x-p.st[j])));
    const wait = (p,c)=>{ const pr=production(p), r=[pr.m,pr.c,pr.d]; let w=0; for(let j=0;j<3;j++){ const miss=c[j]-p.st[j]; if(miss>0){ if(c[j]>pr.cap[j]) return Infinity; w=Math.max(w, r[j]>0?miss/r[j]*3600:Infinity); } } return w; };
    const sessions = [];
    let goals = [];
    const RES = ['métal','cristal','deutérium'];
    const reserveOf = (p, Tm, skip)=>{ const pr=production(p), r=[pr.m,pr.c,pr.d], out=[0,0,0]; for(const g of goals){ if(g.p!==p || g===skip) continue; const h=Math.max(0,(g.deadline-Tm)/3600e3); g.cost.forEach((x,j)=>out[j]+=Math.max(0, x - r[j]*h)); } return out; };
    const setGoal = (key, label, cost, p, Tm)=>{
      let g = goals.find(x=>x.key===key);
      if(g) return g;
      const w = wait(p, cost); if(!isFinite(w)) return null;
      const pr=production(p), r=[pr.m,pr.c,pr.d];
      let bott=0, worst=-1; cost.forEach((x,j)=>{ const t = x>p.st[j] ? (x-p.st[j])/Math.max(r[j],1e-9) : 0; if(t>worst){ worst=t; bott=j; } });
      g = {key, label, cost, p, deadline: Tm + w*1000 + iv*3600e3, res:RES[bott], since:Tm};
      goals.push(g); return g;
    };
    const dropGoal = key=>{ goals = goals.filter(g=>g.key!==key); };
    for(const Tm of sessionTimes(now)){
      advance(Tm);
      const acts=[], waits=[], soft=[];
      const softRes = p=>{ const pr=production(p), r=[pr.m,pr.c,pr.d], out=[0,0,0]; for(const x of soft){ if(x.p!==p || !(x.eta<=3*3600)) continue; x.cost.forEach((c,j)=>out[j]+=Math.max(0, c - r[j]*(x.eta/3600+iv))); } return out; };
      const labP = P.reduce((a,p)=>p.b.lab>a.b.lab?p:a, P[0]);
      const dep = P[colShipAt()>=0 ? colShipAt() : Math.min(+S.colo.from||0, P.length-1)];
      const wantColony = S.day.focus!=='eco' && P.length < maxPlanets() && !sim.colSent;
      const nr = nextResearch();
      if(nr.labNeed && labP.b.lab<nr.labNeed && labP.bq<=Tm && sim.rq<=Tm){
        const c = levelCost(B.lab, labP.b.lab+1);
        if(can(labP,c,reserveOf(labP,Tm))){ pay(labP,c); const d=buildTime('lab',labP.b.lab+1,labP), L=labP.b.lab+1, pp=labP; pp.bq=Tm+d; pp.bqKey='lab'; sim.ev.push({at:Tm+d, fn:()=>{ pp.b.lab=Math.max(pp.b.lab,L); }}); acts.push({q:'Bâtiment · '+planetRef(pp), what:`${B.lab.n} ${L}`, why:'Débloque la recherche suivante', cost:c, dur:d, end:Tm+d, kind:'b', k:'lab', lvl:L, p:pp.i}); }
      }
      const labBusy = labP.bq>Tm && labP.bqKey==='lab';
      const launchR = (R, why)=>{ const c=levelCost(T[R.k],R.lvl); pay(labP,c); const d=researchTime(R.k,R.lvl), k=R.k, L=R.lvl; sim.rq=Tm+d; sim.ev.push({at:Tm+d, fn:()=>{ sim.tech[k]=Math.max(sim.tech[k],L); }}); acts.push({q:'Recherche · '+planetRef(labP), what:`${T[k].n} ${L}`, why, cost:c, dur:d, end:Tm+d, kind:'t', k, lvl:L, p:labP.i}); };
      const tryResearch = phase=>{
        if(sim.rq>Tm || !nr.k || labBusy) return;
        const R = nr.list[0], key='t:'+R.k+R.lvl, c = levelCost(T[R.k],R.lvl), mine = goals.find(g=>g.key===key);
        if(phase==='pre' && !R.crit && !mine) return;
        const sr = phase==='post' ? softRes(labP) : [0,0,0], rr = reserveOf(labP,Tm,mine).map((x,j)=>x+sr[j]);
        if(can(labP,c,rr)){ launchR(R, mine ? `Économisée depuis ${hm(mine.since)}` : ''); dropGoal(key); delete sim.rSince[key]; return; }
        if(!sim.rSince[key]) sim.rSince[key] = Tm;
        const starving = Tm - sim.rSince[key] >= Math.max(4, 4*iv)*3600e3;
        const g = (R.crit || starving || mine) ? setGoal(key, `${T[R.k].n} ${R.lvl}`, c, labP, Tm) : null;
        if(phase==='pre') return;
        waits.push({q:'Recherche · '+planetRef(labP), what:`${T[R.k].n} ${R.lvl}`, eta:wait(labP,c), miss:missOf(labP,c)});
        for(const F of nr.list.slice(1)){
          const fd = researchTime(F.k,F.lvl);
          if(g && Tm+fd*1000 > g.deadline) continue;
          if(can(labP, levelCost(T[F.k],F.lvl), reserveOf(labP,Tm).map((x,j)=>x+sr[j]))){ launchR(F, `En attendant ${T[R.k].n} ${R.lvl}`); break; }
        }
      };
      tryResearch('pre');
      if(wantColony && !sim.colShip && sim.tech.impulse>=3 && dep.b.shipyard>=4 && dep.sq<=Tm && !(dep.bq>Tm && dep.bqKey==='shipyard')){
        const c = COL_SHIP_COST, key='ship:col', mine = goals.find(g=>g.key===key);
        if(can(dep,c,reserveOf(dep,Tm,mine))){ pay(dep,c); dropGoal(key); const d=(c[0]+c[1])/(2500*(1+dep.b.shipyard)*Math.pow(2,dep.b.nanite)*S.settings.eco)*3600; dep.sq=Tm+d; sim.colShip=true; sim.colReady=Tm+d; acts.push({q:'Chantier spatial · '+planetRef(dep), what:'1 Vaisseau de colonisation', why:'', cost:c, dur:d, end:Tm+d, kind:'ship'}); }
        else { setGoal(key, 'le vaisseau de colonisation', c, dep, Tm); waits.push({q:'Chantier spatial', what:'Vaisseau de colonisation', eta:wait(dep,c), miss:missOf(dep,c)}); }
      }
      if(wantColony && sim.colShip && sim.colReady<=Tm){ sim.colSent=true; acts.push({q:'Flotte · '+planetRef(dep), what:`Envoyer le vaisseau de colonisation vers ${target}`, why:`Kit ${KITS[S.colo.kit]?KITS[S.colo.kit].n.toLowerCase():''} : détail dans Outils › Colonie`, dur:colFlight, end:Tm+colFlight, kind:'fleet'}); }
      const hubP = P[Math.min(hubIndex(), P.length-1)];
      if(P.length>1) for(const q of P){
        if(q===hubP || (q.transferAt||0)>Tm) continue;
        const pr = production(q), want = [0,0,0];
        for(const g of goals) if(g.p===hubP) g.cost.forEach((x,j)=>want[j]=Math.max(want[j], x-hubP.st[j]));
        pr.cap.forEach((cap,j)=>{ if(q.st[j] > cap*.7) want[j] = Math.max(want[j], q.st[j]-cap*.3); });
        const keep = (()=>{ const c = pickBuildings(q, {T:Tm, iv, goals:[]})[0]; return c ? levelCost(B[c.k],c.lvl) : [0,0,0]; })();
        const amt = want.map((w,j)=>Math.max(0, Math.min(w, q.st[j]-keep[j])));
        const sum = amt[0]+amt[1]+amt[2]; if(sum < 5000) continue;
        const own = (q.ships.lc||0)+(q.ships.sc||0) > 0, src = own ? q : hubP, lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
        let left = sum; const lc = Math.min(src.ships.lc||0, Math.ceil(left/lcC)); left -= lc*lcC; const sc = left>0 ? Math.min(src.ships.sc||0, Math.ceil(left/scC)) : 0;
        if(!lc && !sc) continue;
        const ships = {}; if(lc) ships.lc=lc; if(sc) ships.sc=sc;
        const fl = flight(q.coords, hubP.coords, ships, 100); if(!fl) continue;
        const cap = lc*lcC + sc*scC, k = Math.min(1, cap/sum), sent = amt.map(x=>Math.floor(x*k));
        const legs = own ? 1 : 2, arrive = Tm + legs*fl.secs*1000, back = own ? Tm + 2*fl.secs*1000 : arrive;
        sent.forEach((x,j)=>q.st[j]-=x); q.st[2] = Math.max(0, q.st[2]-fl.fuel); q.transferAt = back;
        for(const [kk,n] of Object.entries(ships)) src.ships[kk]-=n;
        sim.ev.push({at:arrive, fn:()=>{ sent.forEach((x,j)=>hubP.st[j]+=x); }});
        sim.ev.push({at:back, fn:()=>{ for(const [kk,n] of Object.entries(ships)) src.ships[kk]=(src.ships[kk]||0)+n; }});
        // Une mission Transporter part toujours de la planète où est la flotte.
        // Sans transporteur sur la colonie, la première mission va donc À VIDE
        // de la planète d'accueil vers la colonie : c'est elle qu'on annonce,
        // et le minuteur prévient quand les vaisseaux s'y posent.
        const charge = `${fmt(sent[0])} M, ${fmt(sent[1])} C, ${fmt(sent[2])} D`;
        const aller = Tm + fl.secs*1000;
        acts.push(own
          ? {q:'Flotte · '+planetRef(q), what:`Rapatrier vers ${planetRef(hubP)} : ${charge}`,
             why:`${shipList(ships)} déjà sur place · mission Transporter · arrivée vers ${hm(arrive)}`,
             dur:(arrive-Tm)/1000, end:arrive, kind:'transfer', ships, p:src.i}
          : {q:'Flotte · '+planetRef(hubP), what:`Envoie ${shipList(ships)} vers ${planetRef(q)}`,
             why:`À vide : il n'y a aucun transporteur sur ${planetRef(q)}. Mission Transporter, arrivée vers ${hm(aller)}. Tu les renvoies ensuite chargés de ${charge}, retour vers ${hm(arrive)}.`,
             dur:(aller-Tm)/1000, end:aller, kind:'transfer', ships, p:src.i});
      }
      const fsl = fleetSlots(), fleetFull = fsl && fsl[0]>=fsl[1] && Tm < sim.fleetFreeAt;
      const maxExpo = fleetFull ? 0 : Math.max((S.slots && S.slots.expo ? S.slots.expo[1] : 0), Math.floor(Math.sqrt(sim.tech.astro)) + (S.settings.cls==='explorer'?2:0));
      for(let guard=0; guard<3 && expoBusy.filter(e=>e>Tm).length < maxExpo; guard++){
        const cands = P.map(p=>({p, f:expoFleet(p.ships)})).filter(x=>x.f).sort((a,b)=>b.f.cargo-a.f.cargo);
        if(!cands.length) break;
        const {p, f} = cands[0], [g,sy] = parseC(p.coords)||[1,1,1], tgt = `${g}:${sy}:16`;
        const fl = flight(p.coords, tgt, f.ships, 100); if(!fl) break;
        const total = 2*fl.secs + 3600, fuel = fl.fuel*2, c=[0,0,fuel];
        const dRate = Math.max(1, production(p).d), smallFuel = p.st[2] >= fuel && fuel/dRate*3600 <= 15*60;
        if(!smallFuel && !can(p,c,reserveOf(p,Tm))){ waits.push({q:'Flotte · '+planetRef(p), what:'Expédition', eta:wait(p,c), miss:missOf(p,c)}); break; }
        pay(p,c);
        for(const [k,n] of Object.entries(f.ships)){ p.ships[k]-=n; sim.away[k]=(sim.away[k]||0)+n; }
        const ret = Tm + total*1000, out = Object.assign({}, f.ships);
        expoBusy.push(ret);
        sim.ev.push({at:ret, fn:()=>{ for(const [k,n] of Object.entries(out)){ p.ships[k]=(p.ships[k]||0)+n; sim.away[k]-=n; } }});
        acts.push({q:'Flotte · '+planetRef(p), what:'Expédition : '+shipList(f.ships), why:`vers ${tgt}, retour vers ${hm(ret)} · ${fmt(fuel)} deut · soute ${fmt(f.cargo)} pour ${fmt(f.cap)} max`, cost:c, dur:total, end:ret, kind:'expo', ships:out, p:p.i});
      }
      for(const p of P){
        if(p.b.shipyard<1 || p.sq>Tm) continue;
        if(wantColony && p===dep && !sim.colShip && sim.tech.impulse>=3 && p.b.shipyard>=4) continue;
        const pr = production(p), best = rankUpgrades(p).find(u=>u.payback<Infinity);
        const satE = Math.max(1,Math.floor(p.tmax/4+20)) * (1 + (S.settings.cls==='collector'?.1:0) + (S.settings.eng?.1:0));
        let need = pr.factor<1 ? pr.eCons-pr.eProd : 0;
        if(best && best.extraSolar){ const after = production(p,{[best.key]:best.lvl}); need = Math.max(need, after.eCons-after.eProd); }
        if(need<=0) continue;
        const n = Math.ceil(need/satE) + 1, c = [0, 2000*n, 500*n];
        const solarAlt = rangeCost(B.solar, p.b.solar, p.b.solar + Math.max(1, best ? best.extraSolar : 1));
        if(mse(...c) >= mse(...solarAlt)) continue;
        if(can(p,c,reserveOf(p,Tm))){
          pay(p,c); const d = n*2000/(2500*(1+p.b.shipyard)*Math.pow(2,p.b.nanite)*S.settings.eco)*3600, pp=p;
          pp.sq=Tm+d; pp.satPending=Tm+d; sim.ev.push({at:Tm+d, fn:()=>{ pp.sats+=n; pp.satPending=0; }});
          acts.push({q:'Chantier spatial · '+planetRef(p), what:`${n} Satellites solaires`, why:`+${Math.round(n*satE)} énergie, ${Math.round(mse(...solarAlt)/Math.max(1,mse(...c)))}x moins cher que la centrale`, cost:c, dur:d, end:Tm+d, kind:'sats', n, p:p.i});
        } else { const e=wait(p,c); soft.push({p, cost:c, eta:e}); waits.push({q:'Chantier spatial · '+planetRef(p), what:`${n} Satellites solaires`, eta:e, miss:missOf(p,c)}); }
      }
      for(const p of P){
        if(p.bq>Tm) continue;
        const cands = pickBuildings(p, {T:Tm, iv, wantColony, dep, labNeed:nr.labNeed, labP, researchRunning:sim.rq>Tm, goals, hub:hubP});
        if(!cands.length) continue;
        const res = reserveOf(p,Tm);
        const ch = cands.find(x=>can(p, levelCost(B[x.k],x.lvl), res));
        if(ch){ const c=levelCost(B[ch.k],ch.lvl); pay(p,c); const d=buildTime(ch.k,ch.lvl,p), k=ch.k, L=ch.lvl; p.bq=Tm+d; p.bqKey=k; sim.ev.push({at:Tm+d, fn:()=>{ p.b[k]=Math.max(p.b[k],L); }}); acts.push({q:'Bâtiment · '+planetRef(p), what:`${B[k].n} ${L}`, why:ch.why, cost:c, dur:d, end:Tm+d, kind:'b', k, lvl:L, p:p.i}); }
        else { const w=cands.map(x=>({x, eta:wait(p,levelCost(B[x.k],x.lvl))})).sort((a,b)=>a.eta-b.eta)[0]; waits.push({q:'Bâtiment · '+planetRef(p), what:`${B[w.x.k].n} ${w.x.lvl}`, eta:w.eta, held:res.some(x=>x>0), miss:missOf(p,levelCost(B[w.x.k],w.x.lvl))}); soft.push({p, cost:levelCost(B[w.x.k],w.x.lvl), eta:w.eta}); }
      }
      // Chaque planète qui a un chantier peut construire : le hub pour la soute
      // de l'empire, une colonie pour ses propres transporteurs.
      for(const p of P){
        const estHub = p === hubP;
        if(p.b.shipyard>=2 && p.sq<=Tm){
          const total = k=>P.reduce((a,q)=>a+(q.ships[k]||0),0) + (sim.away[k]||0);
          const pr = P.reduce((a,q)=>{ const r=production(q); return a+mse(r.m,r.c,r.d); },0);
          const cap = EXPO_CAPS[S.settings.top1][1]*S.settings.eco*(total('pf')>0?2:1);
          const cargoTarget = Math.min(cap, pr*6), lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
          const cargoNow = total('lc')*lcC + total('sc')*scC;
          const big = shipReqOk('lc',p) ? 'lc' : 'sc', unitC = big==='lc'?lcC:scC;
          const wants = [];
          if(estHub && shipReqOk('pr',p) && total('pr')<5) wants.push({k:'pr', n:5-total('pr'), why:'Sondes pour espionner les inactifs avant de les piller'});
          if(estHub && shipReqOk(big,p) && cargoNow < cargoTarget){ const miss = Math.ceil((cargoTarget-cargoNow)/unitC); wants.push({k:big, n:Math.max(1, Math.ceil(miss/4)), why:`Soute pour expéditions et pillages : ${fmt(cargoNow)} sur ${fmt(cargoTarget)} visés`}); }
          if(estHub && shipReqOk('pf',p) && total('pf')<1) wants.push({k:'pf', n:1, why:'Un éclaireur double les gains des expéditions'});
          // Une colonie compte SA soute, pas celle de l'empire : sinon la flotte
          // du hub suffit toujours et aucune colonie ne s'équipe jamais.
          if(needsOwnCargo(p, hubP) && shipReqOk(big,p)){
            const mien = (p.ships.lc||0)*lcC + (p.ships.sc||0)*scC;
            const r = production(p), besoin = (r.m + r.c + r.d) * 6;
            if(mien < besoin){
              const miss = Math.min(10, Math.max(1, Math.ceil((besoin-mien)/unitC)));
              wants.unshift({k:big, n:miss, why:`Transporteurs à demeure : cette colonie rapatrie sans attendre une flotte venue d'ailleurs`});
            }
          }
          const res = reserveOf(p,Tm).map((x,j)=>x+softRes(p)[j]);
          for(const w of wants){
            const c = SHIP_COST[w.k], afford = Math.min(...c.map((x,j)=>x>0 ? Math.floor((p.st[j]-res[j])/x) : Infinity));
            const n = Math.min(w.n, afford); if(n<1) continue;
            const cost = c.map(x=>x*n), d = shipTime(w.k,n,p), k=w.k;
            pay(p,cost); p.sq = Tm+d; sim.ev.push({at:Tm+d, fn:()=>{ p.ships[k]=(p.ships[k]||0)+n; }});
            acts.push({q:'Chantier spatial · '+planetRef(p), what:'Construire '+shipList({[k]:n}), why:w.why, cost, dur:d, end:Tm+d, kind:'shipbuild', ships:{[k]:n}, p:p.i});
            break;
          }
        }
      }
      tryResearch('post');
      sessions.push({T:Tm, acts, waits, goals:goals.map(g=>({key:g.key, label:g.label, deadline:g.deadline, res:g.res}))});
    }
    const end = now + (+S.day.horizon||24)*3600e3;
    advance(end);
    const endV = P.reduce((a,p)=>{ const r=production(p); return a+mse(r.m,r.c,r.d); },0);
    const ups = [];
    P.forEach((p,i)=>{ for(const k of Object.keys(B)){ const a=real.planets[i].b[k], b=p.b[k]; if(b>a) ups.push(`${B_SHORT[k]} ${a}→${b}${P.length>1?' ('+p.name+')':''}`); } });
    for(const k of Object.keys(T)){ const a=real.tech[k], b=sim.tech[k]; if(b>a) ups.push(`${T[k].n.replace('Technologie ','')} ${a}→${b}`); }
    return {now, sessions, busy, startV, endV, ups};
  } finally { S.tech = real.tech; S.planets = real.planets; }
}
function actHtml(a, withBtn){
  const m = [a.cost ? costHtml(a.cost) : '', a.dur ? `<span class="mono">${dur(a.dur)}</span>` : '', a.end ? `<span>fin ${hm(a.end)}</span>` : '', a.why ? `<span>${esc(a.why)}</span>` : ''].filter(Boolean).join('');
  let btn = '';
  if(withBtn && a.kind==='fleet') btn = `<button class="btn sm" data-sent="1">Envoyé</button>`;
  else if(withBtn) btn = `<button class="btn sm primary" data-launch='${esc(JSON.stringify({kind:a.kind,k:a.k,lvl:a.lvl,p:a.p,n:a.n,ships:a.ships,cost:a.cost,coords:a.coords,dur:Math.round(a.dur),what:a.what}))}'>Lancé</button>`;
  return `<li><div><div class="q">${esc(a.q)}</div><div class="w">${esc(a.what)}</div></div>${btn||'<span></span>'}<div class="m">${m}</div></li>`;
}

/* ---------- mise à l'abri ---------- */
/* Vitesses proposées par le jeu, de la plus rapide à la plus lente. */
const FS_SPEEDS = [100,90,80,70,60,50,40,30,20,10];
/* En dessous, un vol coûte plus qu'il ne protège. */
const FS_MIN = 10000;

/** Fin de la prochaine nuit, ou null si la fenêtre est vide. */
function wakeTime(now){
  const a = +S.day.nightStart, b = +S.day.nightEnd;
  if(a === b) return null;
  const s = new Date(now); s.setHours(a,0,0,0); if(s.getTime() <= now) s.setDate(s.getDate()+1);
  const e = new Date(s); e.setHours(b,0,0,0); if(e.getTime() <= s.getTime()) e.setDate(e.getDate()+1);
  return e.getTime();
}

/**
 * Ce qu'il faut envoyer en l'air avant de dormir.
 * Charge la planète la plus exposée dans ses transporteurs et choisit la
 * vitesse la plus rapide qui fait quand même rentrer la flotte après ton
 * réveil : plus c'est lent, plus c'est sûr, mais plus tu attends au matin.
 * @param {number} now horodatage courant
 * @returns {object|null} {from, ships, dest, mission, pct, back, fuel, load, cargo}
 */
function fleetsavePlan(now){
  const wake = wakeTime(now);
  if(!wake) return null;

  const load = p => { const st = stockNow(p); return st[0]+st[1]+st[2]; };
  const from = S.planets.slice().sort((a,b)=>load(b)-load(a))[0];
  if(!from) return null;
  const need = load(from);
  if(need < FS_MIN) return null;

  const ships = {}; let cargo = 0;
  for(const k of ['lc','sc']){
    const have = (from.ships||{})[k] || 0, unit = shipStats(k).cargoEff;
    if(!have || !unit || cargo >= need) continue;
    const n = Math.min(have, Math.ceil((need-cargo)/unit));
    if(n>0){ ships[k] = n; cargo += n*unit; }
  }
  if(!Object.keys(ships).length) return null;

  // Vers une autre planète si tu en as une, sinon une expédition : elle garde
  // la flotte en l'air aussi bien, et ne demande pas de destination amie.
  const other = S.planets.find(p => p !== from && p.coords);
  const c = parseC(from.coords);
  const dest = other ? other.coords : (c ? `${c[0]}:${c[1]}:16` : null);
  if(!dest) return null;

  let pct = null, back = null, fuel = 0;
  for(const s of FS_SPEEDS){
    const fl = flight(from.coords, dest, ships, s);
    if(!fl) continue;
    const b = now + 2*fl.secs*1000;
    if(b > wake){ pct = s; back = b; fuel = fl.fuel; break; }
  }
  if(back == null){
    const fl = flight(from.coords, dest, ships, 10);
    if(!fl) return null;
    pct = 10; back = now + 2*fl.secs*1000; fuel = fl.fuel;
  }
  return {from, ships, dest, mission: other ? 'transport' : 'expedition',
          pct, back, fuel, load: need, cargo};
}

/* ---------- daily missions ---------- */
const LIFEFORMS = {humans:{n:'Humains', why:'polyvalents'}, rocktal:{n:'Roctas', why:'mineurs : production et bâtiments moins chers'}, mechas:{n:'Mécas', why:'vaisseaux et chantier spatial'}, kaelesh:{n:'Kaeleshs', why:'expéditions et recherche'}};
function bestLifeform(){
  const f = S.lf.found || ['humans'];
  const pref = S.day.focus==='fleet' ? ['mechas','kaelesh','rocktal','humans'] : ['rocktal','humans','mechas','kaelesh'];
  return pref.find(k=>f.includes(k)) || 'humans';
}
/** Fleet slots [used, max] from the last sync, or null. */
function fleetSlots(){ return S.slots && S.slots.fleet && S.syncAt && Date.now()-(S.slots.at||S.syncAt) < 3*3600e3 ? S.slots.fleet : null; }
function freeExpoSlots(){
  const max = Math.max((S.slots && S.slots.expo ? S.slots.expo[1] : 0), Math.floor(Math.sqrt(S.tech.astro)) + (S.settings.cls==='explorer'?2:0));
  const busy = (S.timers||[]).filter(t=>t.kind==='x' && t.k==='expo' && !t.done && t.end>Date.now()).length;
  return Math.max(0, max - busy);
}
/** Context-aware to-do items that sit outside the build and research queues. */
function dailyMissions(){
  const now = Date.now(), out = [], h = new Date(now).getHours();
  const target = coloTarget(), lf = LIFEFORMS[bestLifeform()];
  const colMove = (S.moves||[]).find(m=>m.mission===7 && !m.ret && m.arrival*1000>now);
  if(colMove) out.push({id:'colo-fly', info:true, q:'Colonie', every:24, sev:'info', what:`Colonisation en route vers ${colMove.dest||coloTarget()}`, why:`Arrivée vers ${hm(colMove.arrival*1000)}. Prépare le kit et la forme de vie ${lf.n}.`, how:['Garde des transporteurs libres pour le kit.', 'À l\'arrivée, relève le nombre de cases et saisis-le dans Outils › Colonie.']});
  if(!colMove && S.colo.sentAt && now - S.colo.sentAt < 12*3600e3 && !S.colo.fields){
    out.push({id:'colo-eval', q:'Colonie', every:24, sev:'warn', what:'Évaluer ta nouvelle colonie', why:'Dès son arrivée, vérifie sa taille avant d\'y construire quoi que ce soit.',
      how:['Vue d\'ensemble de la colonie : relève le nombre de cases.', 'Outils › Colonie › Après l\'arrivée : saisis-le pour savoir si tu la gardes.', `Choisis la forme de vie ${lf.n}, puis envoie les transporteurs du kit (mission Transporter).`]});
  }
  const fs = fleetSlots();
  if(fs && fs[0]>=fs[1]) out.push({id:'fleetslots', info:true, q:'Flotte', every:3, sev:'warn', what:`Emplacements de flotte pleins (${fs[0]}/${fs[1]})`, why:'Chaque mission en vol (découvertes comprises) prend un emplacement. Aucune expédition possible avant un retour.', how:['Attends le premier retour (Mouvements de flotte).', 'Garde 1 emplacement libre pour les expéditions : envoie un peu moins de découvertes à la fois.', `Technologie Ordinateur ${S.tech.computer+1} ajoute un emplacement.`]});
  const _unused = S.planets.some(p=>((p.ships||{}).sc||0)+((p.ships||{}).lc||0)>0);
  out.push({id:'discovery', q:'Exploration', every:24, sev:'info', what:'Missions de découverte (formes de vie)', why:`Elles rapportent des artefacts et de nouvelles races. Trouvées : ${(S.lf.found||[]).map(k=>LIFEFORMS[k].n).join(', ')}.${S.artefacts!=null?` Artefacts : ${fmt(S.artefacts)}.`:''}`,
    how:['Galaxie : bouton <b>Découverte</b> en haut, ou icône ADN violette sur une ligne.', 'Fais-en sur plusieurs systèmes : le nombre par jour est limité.', 'Une race trouvée ? Coche-la dans Réglages › Formes de vie pour que Copilote en tienne compte.']});
  if(S.artefacts!=null && S.artefacts>=200) out.push({id:'artefacts', q:'Formes de vie', every:24, sev:'good', what:`${fmt(S.artefacts)} artefacts : choisis une technologie de forme de vie`, why:'Au palier 1, 200 artefacts permettent de choisir précisément la technologie d\'un slot au lieu du tirage aléatoire.', how:['Forme de vie › Recherche : sur un slot libre, choisis la technologie voulue.', 'Attention : changer un slot déjà pris oblige à réinitialiser tout le palier.']});
  if(IS_EXT && S.syncAt && now - S.syncAt < 3600e3){
    const lfq = q => (S.timers||[]).some(t=>t.queue===q && !t.done && t.end>now);
    if(!lfq('lfbuilding')) out.push({id:'lfb', q:'Formes de vie', every:2, sev:'warn', what:'File des bâtiments de forme de vie vide', why:'Le plan ne gère pas cette file : pense à la remplir toi-même.', how:['Menu Forme de vie : lance le bâtiment le moins cher qui augmente ta production.']});
    if(!lfq('lfresearch')) out.push({id:'lfr', q:'Formes de vie', every:2, sev:'info', what:'Recherche de forme de vie à l\'arrêt ?', why:'Si un slot est débloqué, lance sa recherche : elle tourne en parallèle de la recherche classique.', how:['Forme de vie › Recherche : « Sélectionner » prend la technologie de ta race, « Aléatoire » pioche parmi tes races découvertes.']});
  }
  const occ = API && API.planets ? occupied() : null;
  if(occ && parseC(S.colo.target) && occ.has(S.colo.target) && occ.get(S.colo.target)!==S.me && !colSentNow()){ const alt = colonyCandidates()[0]; out.unshift({id:'colo-taken', q:'Colonie', every:6, sev:'bad', what:`${S.colo.target} est déjà occupée`, why:alt?`Meilleure position libre proche : ${alt.coords} (${alt.bonus||'pas de bonus'}, ~${alt.fields} cases).`:'Choisis une autre position dans Outils › Cibles.', how:['Outils › Cibles › Où coloniser : clique sur Choisir pour changer la destination.']}); }
  const rt = raidTargets().filter(r=>!r.outlaw && !(S.raids[r.coords] && now-S.raids[r.coords].at<6*3600e3)).slice(0,3);
  if(S.raid && S.raid.safe && (S.raid.m||S.raid.c||S.raid.d)) out.unshift({id:'raid-go', q:'Pillage', every:1, sev:'good', what:`Pillage de ${S.raid.coords} prêt`, why:'Les ressources sont saisies et la cible est sans défense : lance-le depuis Outils › Cibles.', how:['Outils › Cibles : vérifie la flotte proposée, puis envoie-la en mission Attaquer.', 'Clique sur Lancé pour suivre le retour.']});
  if(rt.length) out.push({id:'raid', q:'Pillage', every:12, sev:'good', what:`Espionner ${rt.length>1?'ces inactifs':'cet inactif'} : ${rt.map(r=>r.coords).join(', ')}`, why:`Inactifs proches et moins forts que toi : pas d'avertissement hors-la-loi. Détail dans Outils › Cibles.`, how:['Galaxie : clique sur l\'œil de la ligne pour envoyer une sonde.', 'Rapport sans flotte ni défense et avec des ressources : mission Attaquer, assez de soute pour la moitié de son stock.']});
  else out.push({id:'inactive', q:'Pillage', every:24, sev:'info', what:'Repérer des inactifs à piller', why:'Les joueurs marqués (i) ou (I) ne se défendent plus. À piller dès qu\'ils sont dans ta tranche de points.',
    how:['Galaxie : parcours ton système et les voisins, note les noms gris (i)/(I).', 'Espionne-les. Si le jeu affiche « joueur plus puissant », réponds <b>Non</b> : tu perdrais ta protection pendant 7 jours.', 'Sans flotte ni défense et avec des ressources : mission Attaquer avec assez de soute.']});
  const ns = +S.day.nightStart, nd = new Date(now); nd.setHours(ns,0,0,0); if(nd.getTime() <= now) nd.setDate(nd.getDate()+1);
  const nightAt = nd.getTime() - 3600e3;
  if(!isNight(now) && nightAt - now <= (+S.day.horizon||24)*3600e3){
    const fs = fleetsavePlan(now);
    const m = {id:'night', q:'Sécurité', at:nightAt, every:24, sev:'warn',
      what:`Avant la nuit (${ns} h) : mettre tes ressources à l'abri`,
      why:'Une planète pleine pendant ton sommeil est une cible.',
      how:['Dépense tout ce que tu peux (files longues, satellites).', 'Envoie le reste avec tes transporteurs en mission longue (transport vers une colonie à vitesse 10 %, ou expédition).', 'Au réveil, rappelle ou récupère la flotte.']};
    if(fs){
      m.what = `Avant la nuit (${ns} h) : envoie ${shipList(fs.ships)} vers ${fs.dest}`;
      m.why = `${fmt(fs.load)} ressources à l'abri sur ${fs.from.name}. Une planète pleine pendant ton sommeil est une cible.`;
      m.how = [
        'Dépense d\'abord ce que tu peux : lance une construction longue et une recherche.',
        `Charge le reste dans ${shipList(fs.ships)} sur ${esc(fs.from.name)}, destination ${fs.dest}, mission ${fs.mission==='transport'?'Transporter':'Expédition'}.`,
        `Règle la vitesse sur ${fs.pct} % : la flotte rentre vers ${hm(fs.back)}, après ton réveil. Coût : ${fmt(fs.fuel)} deutérium.`
      ];
    }
    out.push(m);
  }
  return out;
}
function missionDone(m){ const d = S.daily.done[m.id]; return d && (Date.now() - d) < m.every*3600e3 && (m.every<24 || new Date(d).toDateString()===new Date().toDateString()); }

/* ---------- targets from the official OGame API ---------- */
function sysDiff(a, b){ let d = Math.abs(a-b); const sv = API && API.server; if(sv && sv.donutSystem) d = Math.min(d, sv.systems - d); return d; }
function wrapSys(x){ const n = (API && API.server && API.server.systems) || 499; return ((x-1)%n+n)%n+1; }
let _occ = null, _occKey = null;
function occupied(){ const k = API && API.at && API.at.universe; if(_occKey!==k){ _occ = new Map((API.planets||[]).map(([c,pl])=>[c,pl])); _occKey = k; } return _occ; }
function myScore(){ return S.me && API && API.scores && API.scores[S.me] ? API.scores[S.me][0] : null; }
function isInactive(st){ return /[iI]/.test(st||'') && !/[vb]/.test(st||''); }
function isActive(st){ return !/[iIvb]/.test(st||''); }
/** Free colony slots near home, ranked by position value, distance and neighbourhood. */
function colonyCandidates(){
  if(!API || !API.planets) return [];
  const home = parseC(coloFrom().coords); if(!home) return [];
  const occ = occupied(), me = myScore() || 0, bonus = (API.server && API.server.bonusFields) || 0, R = 15;
  const posScore = {}; rankPositions().forEach(r=>posScore[r.pos]=r);
  const maxScore = Math.max(...Object.values(posScore).map(r=>r.score), 1e-9);
  const out = [];
  for(let d=-R; d<=R; d++){
    const sys = wrapSys(home[1]+d), neigh = {strong:0, active:0, inactive:0};
    for(let q=1;q<=15;q++){ const pl = occ.get(`${home[0]}:${sys}:${q}`); if(!pl || pl===S.me) continue; const P = API.players[pl]||['','']; const sc = (API.scores[pl]||[0])[0]; if(isInactive(P[1])) neigh.inactive++; else if(isActive(P[1])){ neigh.active++; if(sc > Math.max(me*5, 10000)) neigh.strong++; } }
    for(let pos=1; pos<=15; pos++){
      const r = posScore[pos]; if(!r || !r.ok) continue;
      const coords = `${home[0]}:${sys}:${pos}`; if(occ.has(coords)) continue;
      const dist = Math.abs(d), score = .75*r.score/maxScore + .25*(1-dist/R) - .04*neigh.strong + .02*Math.min(neigh.inactive,3);
      out.push({coords, pos, dist, fields:r.P.avg+bonus, bonus:r.P.bonus, neigh, score});
    }
  }
  return out.sort((a,b)=>b.score-a.score);
}
/** Inactive planets near home, attackable first, then the ones that would trigger the outlaw warning. */
function raidTargets(){
  if(!API || !API.planets || !API.players) return [];
  const home = parseC(coloFrom().coords); if(!home) return [];
  const me = myScore(), out = [];
  for(const [coords, pl] of API.planets){
    const c = parseC(coords); if(!c || c[0]!==home[0]) continue;
    const P = API.players[pl]; if(!P || !isInactive(P[1])) continue;
    const dist = sysDiff(c[1], home[1]); if(dist>30) continue;
    const sc = (API.scores && API.scores[pl] || [0])[0], outlaw = me!=null && sc > me;
    out.push({coords, name:P[0], status:P[1], score:sc, dist, outlaw, longInactive:/I/.test(P[1]), value: sc*(/I/.test(P[1])?1.3:1)/(1+dist/8)});
  }
  return out.sort((a,b)=>(a.outlaw-b.outlaw) || (b.value-a.value));
}
/** Nearby systems ranked by how many positions were not explored in the last week. */
function exploreSystems(){
  const home = parseC(coloFrom().coords); if(!home) return [];
  const ex = S.explored || {}, now = Date.now(), out = [];
  for(let d=0; d<=6; d++) for(const sgn of d ? [-1,1] : [1]){
    const sys = wrapSys(home[1]+sgn*d); let left = 0;
    for(let q=1;q<=15;q++){ const t = ex[`${home[0]}:${sys}:${q}`]; if(!t || now-t > 7*864e5) left++; }
    out.push({sys:`${home[0]}:${sys}`, left, dist:d});
  }
  return out.filter(x=>x.left>0).slice(0,6);
}

/* ---------- fleet building, roles, raids ---------- */
const SHIP_COST = {sc:[2000,2000,0], lc:[6000,6000,0], pr:[0,1000,0], pf:[8000,15000,8000]};
const SHIP_REQ = {sc:{b:{shipyard:2}, t:{combustion:2}}, lc:{b:{shipyard:4}, t:{combustion:6}}, pr:{b:{shipyard:3}, t:{combustion:3, espionage:2}}, pf:{b:{shipyard:5}, t:{hyperdrive:2}}};
function shipReqOk(k, p){ const r = SHIP_REQ[k]; return Object.entries(r.b).every(([b,l])=>p.b[b]>=l) && Object.entries(r.t).every(([t,l])=>S.tech[t]>=l); }
function shipTime(k, n, p){ const c = SHIP_COST[k]; return n*(c[0]+c[1])/(2500*(1+p.b.shipyard)*Math.pow(2,p.b.nanite)*S.settings.eco)*3600; }
const ROLES = {hub:'Centre (recherche, flotte)', mines:'Mines', deut:'Deutérium', crystal:'Cristal et énergie'};
function hubIndex(){ let best=0; S.planets.forEach((p,i)=>{ if(p.b.lab+p.b.shipyard > S.planets[best].b.lab+S.planets[best].b.shipyard) best=i; }); return best; }
function autoRole(p, i){ if(i===hubIndex()) return 'hub'; const pos=(parseC(p.coords)||[])[2]||8; return pos>=13 ? 'deut' : pos<=3 ? 'crystal' : 'mines'; }
function roleOf(p, i){ return (S.roles||{})[p.id] || autoRole(p, i); }
/** Parses metal, crystal and deuterium from a pasted espionage report. */
function parseReport(txt){
  const num = label=>{ const m = String(txt).match(new RegExp(label+'\\s*:?\\s*(\\d[\\d.,]*)\\s*(Mn|M|k|K)?', 'i')); if(!m) return null; const suf = m[2]||''; if(/m/i.test(suf)) return Math.round(parseFloat(m[1].replace(/\./g,'').replace(',','.'))*1e6); if(/k/i.test(suf)) return Math.round(parseFloat(m[1].replace(/\./g,'').replace(',','.'))*1e3); return +m[1].replace(/[.,]/g,'') || 0; };
  return [num('M[ée]tal'), num('Cristal'), num('Deut[ée]rium')];
}
/** Fleet and outcome for a raid on the selected target. */
function raidPlan(){
  const r = S.raid; if(!r) return null;
  const home = S.planets[hubIndex()], res = [+r.m||0, +r.c||0, +r.d||0];
  const rate = S.settings.cls==='explorer' ? .75 : .5, loot = res.map(x=>Math.floor(x*rate)), need = loot[0]+loot[1]+loot[2];
  const av = home.ships||{}, lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
  let left = need; const lc = Math.min(av.lc||0, Math.ceil(left/lcC)); left -= lc*lcC; const sc = left>0 ? Math.min(av.sc||0, Math.ceil(left/scC)) : 0; left -= sc*scC;
  const ships = {}; if(lc) ships.lc = lc; if(sc) ships.sc = sc;
  const fl = (lc||sc) ? flight(home.coords, r.coords, ships, 100) : null;
  const cargo = lc*lcC + sc*scC, got = Math.min(need, cargo), fuel = fl ? fl.fuel*2 : 0;
  return {home, loot, need, ships, fl, cargo, got, fuel, short: Math.max(0,left), net: got - fuel*S.settings.ratio[0]/S.settings.ratio[2]};
}

const VIEWS = {
today(){
  const d=S.day;
  return `<section class="panel">
    <div class="card"><div class="row spread"><h2>Maintenant</h2><span class="note" id="tdStamp"></span></div><div id="tdNow"></div></div>
    <div id="tdAlerts"></div>
    <div class="card"><div class="row spread"><h2>Ta journée</h2><span class="note">${esc(FOCUS[d.focus]||'')} · toutes les ${d.interval} min · nuit ${d.nightStart}h–${d.nightEnd}h <button class="btn sm ghost" data-goto="settings">Modifier</button></span></div><div id="tdDay"></div></div>
    <div class="card"><div class="row spread"><h2>Minuteurs</h2><button class="btn sm ghost" id="tmSound">Tester le son</button></div>
      <ul class="timers" id="tmList"></ul>
      <details><summary class="note">Ajouter un minuteur à la main</summary>
        <div class="timer-form" style="margin-top:8px">
          <label class="f">Quoi<select id="tmWhat">${timerOptions()}</select></label>
          <label class="f">Temps restant (copié du jeu)<input id="tmLeft" placeholder="2h 13m 05s"></label>
          <button class="btn primary" id="tmAdd">Lancer</button>
        </div>
      </details>
    </div>
  </section>`;
},
empire(){ return `<div class="panel">${VIEWS.planets()}${VIEWS.research()}</div>`; },
explore(){
  if(!IS_EXT) return `<div class="card"><h2>Cibles</h2><p class="note">Cette partie utilise les données publiques officielles d'OGame. Elle ne fonctionne que dans l'extension Copilote.</p></div>`;
  const a = API, ok = a && a.planets && a.players;
  const age = k => a && a.at && a.at[k] ? hm(a.at[k]) : '–';
  return `<section class="panel">
    <div class="card"><div class="row spread"><h2>Données de l'univers</h2><button class="btn sm ghost" data-apirefresh="1">Actualiser</button></div>
      <p class="note">${ok ? `${fmt(a.planets.length)} planètes, ${fmt(Object.keys(a.players).length)} joueurs. Classement mis à jour à ${age('scores')}, univers à ${age('universe')}. Les positions libres peuvent dater de quelques jours : vérifie toujours dans Galaxie.` : (a && a.error ? `Erreur de téléchargement : ${esc(a.error)}.` : 'Téléchargement en cours… ouvre une page du jeu si rien ne vient.')}${myScore()!=null ? ` Tes points : <b>${fmt(myScore())}</b>.` : ''}</p>
    </div>
    <div class="card"><h2>Où coloniser</h2><div id="exColo"></div></div>
    ${S.raid ? `<div class="card"><div class="row spread"><h2>Pillage de ${esc(S.raid.coords)}</h2><button class="btn sm ghost" data-raidclose="1">Fermer</button></div>
      <p class="note">${esc(S.raid.name||'')} · 1. Espionne la cible depuis Galaxie. 2. Colle le rapport ici ou saisis ses ressources. 3. Vérifie qu'il n'a ni flotte ni défense.</p>
      <textarea id="rdPaste" data-raid="paste" placeholder="Colle ici le rapport d'espionnage (texte)"></textarea>
      <div class="grid tight">
        <label class="f">Métal<input id="rdM" type="number" min="0" data-raid="m" value="${S.raid.m||0}"></label>
        <label class="f">Cristal<input id="rdC" type="number" min="0" data-raid="c" value="${S.raid.c||0}"></label>
        <label class="f">Deutérium<input id="rdD" type="number" min="0" data-raid="d" value="${S.raid.d||0}"></label>
      </div>
      <label class="row" style="gap:8px"><input id="rdSafe" type="checkbox" data-raid="safe" ${S.raid.safe?'checked':''} style="width:auto"> <span>Le rapport ne montre ni flotte ni défense</span></label>
      <div id="rdPlan"></div>
    </div>` : ''}
    <div class="card"><h2>Qui piller</h2><div id="exRaid"></div></div>
    <div class="card"><h2>Où explorer</h2><div id="exExplore"></div></div>
  </section>`;
},
tools(){
  const sub = S.ui.tool || 'colony';
  return `<section class="panel"><div class="seg" role="tablist">${[['explore','Cibles'],['colony','Colonie'],['fleet','Flotte'],['plan','Objectifs']].map(([k,l])=>`<button role="tab" data-tool="${k}" aria-selected="${sub===k}">${l}</button>`).join('')}</div>${VIEWS[sub]()}</section>`;
},
advice(){
  return `<section class="panel">
    <div class="card"><div class="row spread"><h2>Minuteurs</h2><button class="btn sm ghost" id="tmSound">Tester le son</button></div>
      <div class="timer-form">
        <label class="f">Quoi<select id="tmWhat">${timerOptions()}</select></label>
        <label class="f">Temps restant (copié du jeu)<input id="tmLeft" placeholder="2h 13m 05s"></label>
        <button class="btn primary" id="tmAdd">Lancer</button>
      </div>
      <ul class="timers" id="tmList"></ul>
      <p class="note">Garde l'onglet Copilote ouvert : à la fin, un bandeau vert apparaît en haut de la page jusqu'à ce que tu cliques, avec un son si ton ordinateur en a. Le niveau de la recherche ou du bâtiment est alors augmenté automatiquement.</p>
    </div>
    <div class="card"><div class="row spread"><h2>À faire maintenant</h2><span class="note" id="advStamp"></span></div><ul class="advice" id="advList"></ul>
    <p class="note">Calculé à partir de tes niveaux saisis ou importés. Garde-les à jour pour des conseils justes.</p></div>
  </section>`;
},
planets(){
  return `<section class="panel">
    ${S.sample ? `<div class="example">Données d'exemple : remplace-les par tes niveaux réels (planète mère, mine de métal 1). Les cases se sauvegardent dans ce navigateur.</div>` : ''}
    ${`<details class="card" id="impBox"><summary>Importer depuis la Vue empire <span class="note">${IS_EXT?'optionnel':''}</span></summary>
      <p class="note">${IS_EXT?'L\'extension lit déjà tes niveaux sur les pages Ressources, Installations et Recherche de chaque planète. L\'import met à jour toutes tes planètes d\'un coup. ':''}Dans OGame, ouvre la <b>Vue empire</b>, clique sur le favori du script, puis colle ici (Ctrl+V n'importe où sur cette page fonctionne aussi).</p>
      <textarea id="impText" aria-label="JSON exporté par le script" placeholder='{"exportedAt": ..., "planets": [...]}'></textarea>
      <div class="row"><button class="btn primary" id="impGo">Importer</button><span class="note" id="impMsg">${S.lastImport?`Dernier import : ${new Date(S.lastImport).toLocaleString('fr-FR')}`:''}</span></div>
      <div id="impReport"></div>
    </details>`}
    <div class="card"><div class="row spread"><h2>Empire · production / heure</h2><span id="empireFactor"></span></div><div class="res" id="empireRes"></div></div>
    ${S.planets.map((p,i)=>`
    <div class="card" data-pi="${i}">
      <div class="planet-head">
        <input id="pn-${p.id}" data-p="name" value="${esc(p.name)}" aria-label="Nom de la planète">
        <input id="pc-${p.id}" class="coords" data-p="coords" value="${esc(p.coords)}" aria-label="Coordonnées" placeholder="1:1:8">
        <input id="pt-${p.id}" class="temp" type="number" data-p="tmax" value="${p.tmax}" aria-label="Température max (°C)" title="Température max en °C (vue d'ensemble)">
        <span class="note">°C max</span>
        ${S.planets.length>1?`<button class="btn sm ghost" data-del="${i}">Retirer</button>`:''}
      </div>
      <div class="res" id="pres-${i}"></div>
      <div class="row" style="gap:8px"><span class="note">Rôle</span><select id="prole-${p.id}" data-role="${p.id}" style="width:auto">${Object.entries(ROLES).map(([k,l])=>`<option value="${k}" ${roleOf(p,i)===k?'selected':''}>${l}${autoRole(p,i)===k?' (conseillé)':''}</option>`).join('')}</select></div>
      <p class="note" id="pfleet-${i}" style="margin:0"></p>
      <details><summary class="note">Niveaux des bâtiments et stock</summary>
      <div class="grid tight" style="margin-top:8px">
        ${Object.keys(B).map(k=>`<label class="f">${B_SHORT[k]}<input id="pb-${p.id}-${k}" type="number" min="0" data-b="${k}" value="${p.b[k]}"></label>`).join('')}
        <label class="f">Satellites<input id="ps-${p.id}" type="number" min="0" data-p="sats" value="${p.sats}"></label>
      </div>
      <div class="grid tight" style="margin-top:8px">
          <label class="f">Métal<input id="sm-${p.id}" type="number" data-s="m" value="${Math.round(stockNow(p)[0])}"></label>
          <label class="f">Cristal<input id="sc-${p.id}" type="number" data-s="c" value="${Math.round(stockNow(p)[1])}"></label>
          <label class="f">Deutérium<input id="sd-${p.id}" type="number" data-s="d" value="${Math.round(stockNow(p)[2])}"></label>
      </div><p class="note" style="margin-top:6px">Le stock avance tout seul avec ta production. Recale-le quand tu dépenses.</p>
      </details>
    </div>`).join('')}
    <div class="row"><button class="btn" id="addPlanet">Ajouter une colonie</button>
    <span class="note" id="colonyNote"></span></div>
  </section>`;
},
build(){
  return `<section class="panel">
    <div class="card"><h2>Prochaine construction</h2>
    <p class="note">Classement par <b>temps d'amortissement</b> : combien d'heures la nouvelle production met à rembourser le coût, en équivalent métal (ratio ${S.settings.ratio.join(':')}). Si une mine fait passer l'énergie en négatif, le coût de la centrale solaire nécessaire est ajouté.</p></div>
    ${S.planets.map((p,i)=>`<div class="card"><div class="row spread"><h3>${esc(p.name)} <span class="uni">[${esc(p.coords)}]</span></h3><span id="bf-${i}"></span></div><div id="br-${i}"></div><div id="bw-${i}"></div></div>`).join('')}
    <div class="card"><h2>Infrastructure</h2><p class="note">Pas d'amortissement chiffré : ces bâtiments accélèrent ou débloquent. Repères courants : robots 2 tôt (chantier spatial), labo pour la recherche, robots 10 puis nanites à moyen terme.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Planète</th><th>Bâtiment</th><th class="n">Niv.</th><th>Coût</th><th class="n">Durée</th><th class="n">Dispo dans</th><th></th></tr></thead><tbody id="infra"></tbody></table></div></div>
  </section>`;
},
research(){
  return `<details class="card"><summary>Recherches <span class="note">labo niveau <b id="labLv"></b></span></summary>
    <div class="tbl-wrap"><table><thead><tr><th>Technologie</th><th class="n">Niv.</th><th>Coût prochain niv.</th><th class="n">Durée</th><th>État</th><th></th></tr></thead><tbody>
    ${Object.keys(T).map(k=>`<tr><td>${T[k].n}</td><td class="n"><input id="t-${k}" type="number" min="0" data-t="${k}" value="${S.tech[k]}"></td><td id="tc-${k}"></td><td class="n" id="tt-${k}"></td><td id="ts-${k}"></td><td><button class="btn sm" data-addt="${k}">+ Objectif</button></td></tr>`).join('')}
    </tbody></table></div>
  </details>`;
},
fleet(){
  const ex=S.expo, fc=S.fleetCalc;
  return `<section class="panel">
    <div class="card"><h2>Taille d'expédition</h2>
      <div class="grid">
        <label class="f">Points du n°1 de l'univers<select id="top1" data-set="top1">${EXPO_LABELS.map((l,i)=>`<option value="${i}" ${S.settings.top1==i?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="f">Éclaireur dans la flotte<select id="expoPf" data-expo="pf"><option value="1" ${ex.pf?'selected':''}>Oui</option><option value="0" ${!ex.pf?'selected':''}>Non</option></select></label>
      </div>
      <div class="res" id="expoOut"></div>
      <p class="note" id="expoNote"></p>
    </div>
    <div class="card"><h2>Temps de vol et carburant</h2>
      <div class="grid">
        <label class="f">Départ<input id="fFrom" data-fc="from" value="${esc(fc.from)}" placeholder="1:1:8"></label>
        <label class="f">Arrivée<input id="fTo" data-fc="to" value="${esc(fc.to)}" placeholder="1:2:8"></label>
        <label class="f">Vitesse<select id="fPct" data-fc="pct">${[100,90,80,70,60,50,40,30,20,10].map(v=>`<option ${fc.pct==v?'selected':''}>${v}</option>`).join('')}</select></label>
      </div>
      <div class="grid tight">${Object.keys(SHIPS).map(k=>`<label class="f">${SHIPS[k].n}<input id="fs-${k}" type="number" min="0" data-ship="${k}" value="${fc.ships[k]||0}"></label>`).join('')}</div>
      <div class="res" id="flightOut"></div>
      <p class="note">Pour un aller-retour, double la durée et le carburant. Une expédition ajoute son temps de stationnement (1 h par défaut) et un peu de carburant de maintien non compté ici.</p>
    </div>
    <div class="card"><h2>Vaisseaux avec tes technologies</h2><div class="tbl-wrap"><table><thead><tr><th>Vaisseau</th><th>Propulsion</th><th class="n">Vitesse</th><th class="n">Soute</th></tr></thead><tbody id="shipTbl"></tbody></table></div></div>
  </section>`;
},
colony(){
  const c = S.colo;
  return `<section class="panel">
    <div class="card"><div class="row spread"><h2>Prêt à coloniser ?</h2><span id="coSlots"></span></div>
      <div class="grid">
        <label class="f">Planète de départ<select id="coFrom" data-colo="from">${S.planets.map((p,i)=>`<option value="${i}" ${+c.from===i?'selected':''}>${esc(p.name)} [${esc(p.coords)}]</option>`).join('')}</select></label>
        <label class="f">Vaisseau de colonisation<select id="coBuilt" data-colo="built"><option value="0" ${!colBuilt()?'selected':''}>À construire</option><option value="1" ${colBuilt()?'selected':''}>Déjà construit${colShipAt()>=0?' (vu dans ta flotte)':''}</option></select></label>
      </div>
      <ul class="advice" id="coReq"></ul>
    </div>
    <div class="card"><h2>Choisir la position</h2>
      <div class="grid">
        <label class="f">Objectif<select id="coObj" data-colo="objective">${Object.entries(OBJECTIVES).map(([k,o])=>`<option value="${k}" ${c.objective===k?'selected':''}>${o.n}</option>`).join('')}</select></label>
        <label class="f">Cases bonus de l'univers<input id="coBonus" type="number" min="0" data-colo="bonus" value="${c.bonus}"></label>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>#</th><th class="n">Pos.</th><th>Cases (min–max)</th><th class="n">Temp.</th><th>Bonus</th><th class="n">Éq. métal/h</th><th class="n">Deut/h</th><th></th></tr></thead><tbody id="coPos"></tbody></table></div>
      <p class="note">Production simulée avec les niveaux de mines de ta planète de départ, à la température moyenne de chaque position. Les positions grisées demandent plus d'Astrophysique. Vérifie dans <b>Galaxie</b> que la position est libre ; sinon, essaie le même numéro dans un système voisin.</p>
    </div>
    <div class="card"><h2>Flotte et ressources à emporter</h2>
      <div class="grid">
        <label class="f">Destination<input id="coTarget" data-colo="target" value="${esc(c.target)}" placeholder="${esc(coloTarget())}"></label>
        <label class="f">Kit de démarrage<select id="coKit" data-colo="kit">${Object.entries(KITS).map(([k,o])=>`<option value="${k}" ${c.kit===k?'selected':''}>${o.n}</option>`).join('')}</select></label>
        <label class="f">Transporteurs<select id="coTr" data-colo="tr"><option value="sc" ${c.tr==='sc'?'selected':''}>Petits</option><option value="lc" ${c.tr==='lc'?'selected':''}>Grands</option></select></label>
      </div>
      <div id="coFleet"></div>
    </div>
    <div class="card"><h2>Après l'arrivée</h2>
      <div class="grid">
        <label class="f">Cases de la nouvelle planète<input id="coFields" type="number" min="1" data-colo="fields" value="${esc(c.fields)}" placeholder="ex. 187"></label>
        <label class="f">Position<input id="coFpos" type="number" min="1" max="15" data-colo="fpos" value="${esc(c.fpos)}" placeholder="${(parseC(coloTarget())||[])[2]||''}"></label>
      </div>
      <div id="coEval"></div>
      <ol class="note" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
        <li>Choisis la forme de vie de la colonie (Humains, comme ta planète mère, tant que tu n'en as pas découvert d'autre).</li>
        <li>Envoie les transporteurs du kit en mission <b>Transporter</b>, une fois la colonie créée.</li>
        <li>Ordre de construction : solaire, puis métal et cristal en alternance, deutérium ensuite, robots 2 dès que possible.</li>
        <li>L'extension ajoute la colonie toute seule dès que tu la visites dans le jeu.</li>
      </ol>
    </div>
  </section>`;
},
plan(){
  return `<section class="panel">
    <div class="card"><h2>Ajouter un objectif</h2>
      <div class="grid">
        <label class="f">Planète<select id="plP">${S.planets.map((p,i)=>`<option value="${i}">${esc(p.name)}</option>`).join('')}</select></label>
        <label class="f">Bâtiment<select id="plB">${Object.keys(B).map(k=>`<option value="${k}">${B[k].n}</option>`).join('')}</select></label>
        <label class="f">Niveau visé<input id="plL" type="number" min="1" value="5"></label>
      </div>
      <div class="row"><button class="btn primary" id="plAdd">Ajouter au plan</button><span class="note">Les recherches s'ajoutent depuis Empire, section Recherches.</span></div>
    </div>
    <div class="card"><div class="row spread"><h2>Plan</h2><span class="note" id="plTot"></span></div><ul class="list" id="plList"></ul></div>
  </section>`;
},
settings(){
  const s=S.settings, d=S.day;
  return `<section class="panel">
    <div class="card"><h2>Plan du jour</h2>
      <div class="grid">
        <label class="f">Priorité<select id="dFocus" data-day="focus">${Object.entries(FOCUS).map(([k,l])=>`<option value="${k}" ${d.focus===k?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="f">Je me connecte toutes les<select id="dInt" data-day="interval">${[30,60,90,120,180].map(v=>`<option value="${v}" ${+d.interval===v?'selected':''}>${v} min</option>`).join('')}</select></label>
        <label class="f">Nuit : de (heure)<input id="dNs" type="number" min="0" max="23" data-day="nightStart" value="${d.nightStart}"></label>
        <label class="f">à (heure)<input id="dNe" type="number" min="0" max="23" data-day="nightEnd" value="${d.nightEnd}"></label>
        <label class="f">Horizon<select id="dHz" data-day="horizon">${[12,24,48].map(v=>`<option value="${v}" ${+d.horizon===v?'selected':''}>${v} h</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="card"><h2>Formes de vie découvertes</h2>
      <div class="chips">${Object.entries(LIFEFORMS).map(([k,l])=>`<label class="pill ${S.lf.found.includes(k)?'good':'info'}" style="cursor:pointer;padding:6px 12px"><input type="checkbox" data-lf="${k}" ${S.lf.found.includes(k)?'checked':''} style="width:auto;margin-right:6px">${l.n}</label>`).join('')}</div>
      <p class="note">Copilote s'en sert pour te conseiller la forme de vie de tes colonies.</p>
    </div>
    <div class="card"><h2>Univers</h2>
      <div class="grid">
        <label class="f">Vitesse économie<input id="sEco" type="number" min="1" step="1" data-set="eco" value="${s.eco}"></label>
        <label class="f">Vitesse flotte (pacifique)<input id="sFleet" type="number" min="1" step="1" data-set="fleet" value="${s.fleet}"></label>
        <label class="f">Classe<select id="sCls" data-set="cls">${[['collector','Collecteur'],['general','Général'],['explorer','Explorateur'],['none','Aucune']].map(([v,l])=>`<option value="${v}" ${s.cls===v?'selected':''}>${l}</option>`).join('')}</select></label>
      </div>
      <p class="note">Tu ne connais pas la vitesse : elle est affichée sur la liste des univers au moment de te connecter, et dans les infos du serveur. Si ta production réelle (onglet Ressources) ne correspond pas à l'onglet Empire, c'est le premier réglage à vérifier.</p>
    </div>
    <div class="card"><h2>Bonus</h2>
      <div class="grid">
        <label class="f">Géologue (+10 % production)<select id="sGeo" data-set="geo"><option value="0" ${!s.geo?'selected':''}>Non</option><option value="1" ${s.geo?'selected':''}>Oui</option></select></label>
        <label class="f">Ingénieur (+10 % énergie)<select id="sEng" data-set="eng"><option value="0" ${!s.eng?'selected':''}>Non</option><option value="1" ${s.eng?'selected':''}>Oui</option></select></label>
        <label class="f">Collecteur : +25 % soute transporteurs<select id="sColCargo" data-set="colCargo"><option value="1" ${s.colCargo?'selected':''}>Oui</option><option value="0" ${!s.colCargo?'selected':''}>Non</option></select></label>
        <label class="f">Ratio d'échange M:C:D<input id="sRatio" data-set="ratio" value="${s.ratio.join(':')}"></label>
      </div>
    </div>
    <div class="card"><h2>Sauvegarde</h2>
      <p class="note">Tes données restent dans ce navigateur. Copie-les pour les garder ailleurs ou les passer sur un autre appareil.</p>
      <textarea id="ioText" aria-label="Données JSON" placeholder="Colle ici une sauvegarde pour l'importer"></textarea>
      <div class="row"><button class="btn" id="ioCopy">Copier mes données</button><button class="btn" id="ioImport">Importer</button><button class="btn ghost" id="ioReset">Réinitialiser…</button><span class="note" id="ioMsg"></span></div>
    </div>
    <div class="card"><h2>Fiabilité des calculs</h2>
      <p class="note">Formules communautaires (wiki OGame, forum officiel). Production, coûts et temps de vol sont stables depuis des années. Moins sûrs : la production de deutérium (formule des univers récents, dépend de la température max), la durée des bâtiments de niveau 1 à 5, et les plafonds d'expédition. Compare une fois avec ton jeu et ajuste les réglages si besoin.</p>
    </div>
  </section>`;
},
};

const gauge = (k,cls,label,v,sub) => `<div class="gauge"><span class="k"><i class="bg-${cls}"></i>${label}</span><span class="v c-${cls}">${v}</span>${sub?`<span class="s">${sub}</span>`:''}</div>`;
function factorPill(f){ return f>=1 ? `<span class="pill good">Énergie OK</span>` : `<span class="pill ${f<.8?'bad':'warn'}">Rendement ${Math.round(f*100)} %</span>`; }

const REFRESH = {
today(){
  const plan = simulateDay(), s0 = plan.sessions[0];
  const nowParts = [];
  const missions = dailyMissions().filter(m=>!missionDone(m));
  const timed = missions.filter(m=>m.at && m.at > plan.now), slotMs = new Map();
  for(const m of timed){ let host = null; for(const x of plan.sessions) if(x.T <= m.at) host = x; if(host && host!==s0){ if(!slotMs.has(host)) slotMs.set(host, []); slotMs.get(host).push(m); } else m.at = 0; }
  const nowMs = missions.filter(m=>!m.info && !(m.at && m.at > plan.now && [...slotMs.values()].some(l=>l.includes(m))));
  const infoMs = missions.filter(m=>m.info);
  const taskHtml = m=>`<li class="task"><div><div class="q">${esc(m.q||'À faire')}</div><div class="w">${esc(m.what)}</div></div><button class="btn sm" data-done="${m.id}">Fait</button><div class="m"><span>${esc(m.why)}</span></div><details class="how"><summary>Comment faire</summary><ol>${m.how.map(x=>`<li>${x}</li>`).join('')}</ol></details></li>`;
  if(s0.acts.length || nowMs.length) nowParts.push(`<ul class="acts">${s0.acts.map(a=>actHtml(a,true)).join('')}${nowMs.map(taskHtml).join('')}</ul>`);
  const RN = ['métal','cristal','deutérium'];
  const missTxt = w => { const parts = (w.miss||[]).map((x,j)=>x>0?`${fmt(x)} ${RN[j]}`:'').filter(Boolean); return parts.length ? 'Il manque '+parts.join(' · ') : ''; };
  if(s0.waits.length) nowParts.push(`<ul class="acts">${s0.waits.map(w=>`<li class="wait"><div><div class="q">${esc(w.q)}</div><div class="w">${esc(w.what)}</div></div><span class="pill warn">${isFinite(w.eta)?'ressources réunies vers '+hm(plan.now+w.eta*1000):'hangar trop petit'}</span><div class="m">${esc(missTxt(w))}${isFinite(w.eta)?` <span>(dans ${dur(w.eta)})</span>`:''}</div></li>`).join('')}</ul>`);
  if(plan.busy.length || infoMs.length) nowParts.push(`<ul class="acts">${plan.busy.map(b=>`<li class="busy"><div><div class="q">${esc(b.q)} · en cours</div><div class="w">${esc(b.what)}</div></div><span class="mono note">fin ${hm(b.end)}</span></li>`).join('')}${infoMs.map(m=>`<li class="busy"><div><div class="q">${esc(m.q)} · info</div><div class="w">${esc(m.what)}</div></div><span></span><div class="m">${esc(m.why)}</div></li>`).join('')}</ul>`);
  const nextS = plan.sessions.slice(1).find(x=>x.acts.length);
  if(!s0.acts.length && !nowMs.length) nowParts.unshift(`<p class="note">Rien à lancer pour l'instant.${nextS?` Prochaine action à <b>${hm(nextS.T)}</b>.`:''}</p>`);
  document.getElementById('tdNow').innerHTML = nowParts.join('') + `<p class="note"><b>Lancé</b> ou <b>Fait</b> quand c'est fait dans le jeu : le plan se recalcule.${IS_EXT?'':' Si une file est déjà occupée dans le jeu, ajoute son minuteur.'}</p>`;
  const alerts = adviceList().filter(a=>(a.sev==='bad'||a.sev==='warn') && !/Aucune recherche suivie|Prochaine étape/.test(a.what));
  document.getElementById('tdAlerts').innerHTML = alerts.length ? `<div class="card"><h2>Alertes</h2><ul class="advice">${alerts.map(a=>`<li><span class="pill ${a.sev}">${SEV_LABEL[a.sev]}</span><span class="what">${esc(a.what)}</span><span class="why">${esc(a.why)}</span></li>`).join('')}</ul></div>` : '';
  const later = plan.sessions.slice(1).filter(x=>x.acts.length || slotMs.has(x));
  const slot = x=>`<div class="slot"><div class="time">${hm(x.T)}<small>dans ${dur((x.T-plan.now)/1000)}</small></div><ul class="acts">${x.acts.map(a=>actHtml(a,false)).join('')}${(slotMs.get(x)||[]).map(taskHtml).join('')}</ul></div>`;
  const gain = plan.startV>0 ? (plan.endV/plan.startV-1)*100 : 0;
  const phases = [], horizonEnd = plan.now + (+S.day.horizon||24)*3600e3;
  for(const x of plan.sessions){ const key = x.goals.map(g=>g.key).join('|') || 'free'; const last = phases[phases.length-1]; if(last && last.key===key) continue; if(last) last.to = x.T; phases.push({key, from:x.T, to:horizonEnd, goals:x.goals}); }
  const nightStartAfter = t=>{ const d = new Date(t); d.setHours(+S.day.nightStart,0,0,0); if(d.getTime() <= t) d.setDate(d.getDate()+1); return d.getTime(); };
  for(const ph of phases){ const n = nightStartAfter(ph.from); if(n < ph.to) ph.to = n; }
  const launchedAt = label => { for(const x of plan.sessions) if(x.acts.some(a=>a.what===label || (label==='le vaisseau de colonisation' && a.kind==='ship'))) return x.T; return null; };
  const phaseHtml = ph => {
    if(ph.key==='free') return `<li><span class="pill good">Soutenu</span><span class="what">${hm(ph.from)} → ${hm(ph.to)}</span><span class="why">Rien de gros à financer : dépense tout à chaque connexion, mines et bâtiments à la chaîne.</span></li>`;
    const txt = ph.goals.map(g=>{ const at = launchedAt(g.label); return `on garde le ${g.res} pour ${g.label}${at?`, lancement vers ${hm(at)}`:''}`; }).join(' ; ');
    return `<li><span class="pill warn">Tempo</span><span class="what">${hm(ph.from)} → ${hm(ph.to)}</span><span class="why">${esc(txt.charAt(0).toUpperCase()+txt.slice(1))}. Les bâtiments n'utilisent que le surplus. Bon moment pour la flotte : expéditions, espionnage d'inactifs.</span></li>`;
  };
  const strategy = `<ul class="advice" style="margin-bottom:14px">${phases.slice(0,5).map(phaseHtml).join('')}</ul>`;
  document.getElementById('tdDay').innerHTML = strategy + (later.length
    ? `<div class="tl">${later.slice(0,6).map(slot).join('')}</div>${later.length>6?`<details style="margin-top:12px"><summary class="note">Voir les ${later.length-6} connexions suivantes</summary><div class="tl" style="margin-top:12px">${later.slice(6).map(slot).join('')}</div></details>`:''}`
    : `<p class="note">Aucune action prévue sur la période : tes files sont occupées ou tes ressources trop faibles.</p>`)
    + `<div class="sumline" style="margin-top:14px"><span class="pill good">Production ${gain>=0?'+':''}${gain.toFixed(1).replace('.',',')} %</span><span class="note">en ${S.day.horizon} h, de ${fmt(plan.startV)} à ${fmt(plan.endV)} éq. métal/h</span></div>`
    + (plan.ups.length ? `<p class="note" style="margin-top:6px">${esc(plan.ups.join(' · '))}</p>` : '')
    + `<p class="note" style="margin-top:6px">Connexions sans action masquées. Hors plan : formes de vie, flotte, défense. Avant une longue absence, dépense ou mets tes ressources à l'abri.</p>`;
  renderTimers();
  document.getElementById('tdStamp').textContent = S.syncAt ? `synchro ${hm(S.syncAt)}` : (S.lastImport ? `import ${hm(S.lastImport)}` : '');
},
empire(){ REFRESH.planets(); REFRESH.research(); },
tools(){ REFRESH[S.ui.tool||'colony'](); },
explore(){
  const el = document.getElementById('exColo'); if(!el || !API || !API.planets) return;
  const cand = colonyCandidates().slice(0,8), tgt = coloTarget();
  const col = shipStats('col'), home = coloFrom().coords;
  el.innerHTML = cand.length ? `<div class="tbl-wrap"><table><thead><tr><th>Coordonnées</th><th>Cases</th><th>Bonus</th><th class="n">Vol</th><th>Voisins</th><th></th></tr></thead><tbody>${cand.map(c=>{ const f = flight(home, c.coords, {col:1}, 100); return `<tr><td class="mono">${c.coords}</td><td class="mono">~${c.fields}</td><td>${c.bonus?`<span class="pill info">${c.bonus}</span>`:''}</td><td class="n">${f?dur(f.secs):'–'}</td><td class="note">${c.neigh.strong?`<span class="pill warn">${c.neigh.strong} fort${c.neigh.strong>1?'s':''}</span> `:''}${c.neigh.active} actif${c.neigh.active>1?'s':''}${c.neigh.inactive?` · ${c.neigh.inactive} inactif${c.neigh.inactive>1?'s':''}`:''}</td><td><button class="btn sm ${c.coords===tgt?'primary':''}" data-cotarget="${c.coords}">${c.coords===tgt?'Choisie':'Choisir'}</button></td></tr>`; }).join('')}</tbody></table></div><p class="note">Positions libres accessibles avec ton Astrophysique, à 15 systèmes au plus. Classement : valeur de la position (${esc((OBJECTIVES[S.colo.objective]||OBJECTIVES.balanced).n.toLowerCase())}), distance, puis voisinage (moins de joueurs forts, des inactifs à piller).</p>` : '<p class="note">Aucune position libre trouvée à proximité.</p>';

  const raids = raidTargets(), safe = raids.filter(r=>!r.outlaw).slice(0,8), risky = raids.filter(r=>r.outlaw).slice(0,4);
  const sc = shipStats('sc');
  const row = r=>{ const f = flight(home, r.coords, {sc:1}, 100), last = S.raids[r.coords]; return `<tr><td class="mono">${r.coords}</td><td>${esc(r.name)} <span class="note">(${esc(r.status)})</span></td><td class="n">${fmt(r.score)}</td><td class="n">${f?dur(f.secs):'–'}</td><td>${r.outlaw?'<span class="pill bad">plus fort que toi</span>':r.longInactive?'<span class="pill good">inactif longue durée</span>':'<span class="pill info">inactif</span>'}${last?` <span class="note">pillé ${hm(last.at)}</span>`:''}</td><td>${r.outlaw?'':`<button class="btn sm" data-raidprep="${r.coords}" data-raidname="${esc(r.name)}">Préparer</button>`}</td></tr>`; };
  document.getElementById('exRaid').innerHTML = (safe.length||risky.length) ? `<div class="tbl-wrap"><table><thead><tr><th>Coordonnées</th><th>Joueur</th><th class="n">Points</th><th class="n">Vol PT</th><th></th><th></th></tr></thead><tbody>${safe.map(row).join('')}${risky.length?`<tr><td colspan="6" class="note">À éviter tant que tu as ta protection (avertissement « joueur plus puissant ») :</td></tr>${risky.map(row).join('')}`:''}</tbody></table></div><p class="note">Points = taille de son économie, donc ce que tu peux espérer piller. Espionne avant d'attaquer : il faut ni flotte ni défense. Si le jeu refuse l'attaque, c'est la protection débutant.</p>` : '<p class="note">Aucun inactif repéré dans un rayon de 30 systèmes.</p>';

  const rp = raidPlan(), rpEl = document.getElementById('rdPlan');
  if(rp && rpEl){
    const okShips = Object.keys(rp.ships).length>0;
    rpEl.innerHTML = rp.need<=0 ? '<p class="note">Saisis les ressources du rapport pour calculer la flotte.</p>' : `<div class="res">${gauge('m','m','Butin possible',fmt(rp.need),`${S.settings.cls==='explorer'?'75':'50'} % du stock`)}${gauge('c','c','Ramené',fmt(rp.got),okShips?shipList(rp.ships):'aucun transporteur')}${gauge('d','d','Carburant',fmt(rp.fuel),'aller-retour')}${gauge('e','e','Vol',rp.fl?dur(rp.fl.secs):'–','aller')}</div>
      ${!S.raid.safe ? '<p class="pill warn" style="margin-top:8px">Coche la case seulement si le rapport ne montre ni flotte ni défense. Sinon, ne l\'attaque pas.</p>' : ''}
      ${rp.short>0 ? `<p class="note">Il te manque ${fmt(rp.short)} de soute à ${esc(rp.home.name)} : le reste attendra un second passage.</p>` : ''}
      ${S.raid.safe && okShips && rp.net>0 ? `<ul class="acts" style="margin-top:8px">${actHtml({q:'Flotte · '+rp.home.name, what:`Attaquer ${S.raid.coords} avec ${shipList(rp.ships)}`, why:`Galaxie ou Flotte → ${S.raid.coords} → mission Attaquer · retour vers ${hm(Date.now()+2*rp.fl.secs*1000)}`, cost:[0,0,rp.fuel], dur:2*rp.fl.secs, end:Date.now()+2*rp.fl.secs*1000, kind:'raid', ships:rp.ships, p:hubIndex(), coords:S.raid.coords}, true)}</ul>` : ''}`;
  }
  const ex = exploreSystems();
  document.getElementById('exExplore').innerHTML = `<ul class="advice">${ex.map(x=>`<li><span class="pill info">${x.left} pos.</span><span class="what">Système ${x.sys}</span><span class="why">${x.dist===0?'Ton système':`À ${x.dist} système${x.dist>1?'s':''}`} : ${x.left} position${x.left>1?'s':''} pas explorée${x.left>1?'s':''} depuis 7 jours.</span></li>`).join('')}</ul><p class="note">Missions de découverte : bouton Découverte dans Galaxie. Copilote retient les positions explorées quand il voit tes missions dans Mouvements de flotte. Pour les expéditions, alterne la position 16 de systèmes voisins si les résultats baissent.</p>`;
},
advice(){
  const list = adviceList();
  document.getElementById('advList').innerHTML = list.map(a=>`<li><span class="pill ${a.sev==='info'?'info':a.sev}">${SEV_LABEL[a.sev]}</span><span class="what">${esc(a.what)}</span><span class="why">${esc(a.why)}</span></li>`).join('');
  renderTimers();
  document.getElementById('advStamp').textContent = S.lastImport ? `Import du ${new Date(S.lastImport).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}` : '';
},
planets(){
  let tm=0,tc=0,td=0, worst=1;
  S.planets.forEach((p,i)=>{
    const pr=production(p); tm+=pr.m; tc+=pr.c; td+=pr.d; worst=Math.min(worst,pr.factor);
    const st=stockNow(p), full = i2 => { const r=[pr.m,pr.c,pr.d][i2]; return r>0 && st[i2]<pr.cap[i2] ? `plein dans ${dur((pr.cap[i2]-st[i2])/r*3600)}` : (st[i2]>=pr.cap[i2]?'hangar plein':''); };
    document.getElementById('pres-'+i).innerHTML =
      gauge('m','m','Métal',fmt(pr.m),full(0)) + gauge('c','c','Cristal',fmt(pr.c),full(1)) + gauge('d','d','Deutérium',fmt(pr.d),full(2)) +
      gauge('e','e','Énergie',(pr.eBal>=0?'+':'')+fmt(pr.eBal), `${fmt(pr.eProd)} produits / ${fmt(pr.eCons)}${p.eAdj<0?` · dont ${fmt(p.eAdj)} formes de vie`:''}`);
    const fl = document.getElementById('pfleet-'+i); if(fl){ const l = shipList(p.ships); fl.innerHTML = l ? `<b>Flotte à quai :</b> ${esc(l)}` : (IS_EXT ? 'Flotte inconnue : ouvre la page Flotte du jeu sur cette planète.' : ''); }
  });
  document.getElementById('empireRes').innerHTML = gauge('m','m','Métal',fmt(tm),fmt(tm*24)+' / jour')+gauge('c','c','Cristal',fmt(tc),fmt(tc*24)+' / jour')+gauge('d','d','Deutérium',fmt(td),fmt(td*24)+' / jour')+gauge('e','e','Planètes',S.planets.length,`max ${1+Math.ceil(S.tech.astro/2)} (Astro ${S.tech.astro})`);
  document.getElementById('empireFactor').innerHTML = factorPill(worst);
  document.getElementById('colonyNote').textContent = S.tech.astro ? '' : 'Les colonies demandent Astrophysique 1.';
},
build(){
  S.planets.forEach((p,i)=>{
    const pr=production(p), r=rankUpgrades(p);
    document.getElementById('bf-'+i).innerHTML = factorPill(pr.factor);
    document.getElementById('br-'+i).innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Construire</th><th>Coût total</th><th class="n">Gain éq. métal/h</th><th class="n">Amorti en</th><th class="n">Durée</th><th class="n">Dispo dans</th><th></th></tr></thead><tbody>${
      r.map((u,j)=>{ const w=waitFor(p,u.cost); return `<tr><td class="rank">${j+1}</td><td>${B_SHORT[u.key]} ${u.lvl}${u.extraSolar?` <span class="pill warn">+ solaire ${p.b.solar+u.extraSolar}</span>`:''}</td><td>${costHtml(u.cost)}</td><td class="n">${fmt(u.gain)}</td><td class="n">${dur(u.payback*3600)}</td><td class="n">${dur(u.time)}</td><td class="n">${w.storage!=null?'<span class="pill bad">hangar trop petit</span>':w.sec===0?'<span class="pill good">maintenant</span>':dur(w.sec)}</td><td><button class="btn sm" data-addb="${i}:${u.key}:${u.lvl}">+ Plan</button></td></tr>`; }).join('')
    }</tbody></table></div>`;
    const warn=[]; const st=stockNow(p);
    ['m','c','d'].forEach((x,k)=>{ const rate=[pr.m,pr.c,pr.d][k]; if(rate>0 && pr.cap[k]/rate<8) warn.push(`<span class="pill warn">${['Hangar de métal','Hangar de cristal','Réservoir'][k]} plein en moins de 8 h</span>`); });
    if(pr.factor<1) warn.push(`<span class="pill bad">Énergie négative : monte la centrale solaire avant toute mine</span>`);
    document.getElementById('bw-'+i).innerHTML = warn.length?`<div class="row">${warn.join('')}</div>`:'';
  });
  document.getElementById('infra').innerHTML = S.planets.flatMap((p,i)=>['robot','shipyard','lab','nanite','fusion','smetal','scrystal','sdeut'].map(k=>{
    const L=p.b[k]+1, c=levelCost(B[k],L), miss=reqOk(B[k].req,p), w=waitFor(p,c);
    return `<tr><td>${esc(p.name)}</td><td>${B[k].n}</td><td class="n">${L}</td><td>${costHtml(c)}</td><td class="n">${dur(buildTime(k,L,p))}</td><td class="n">${miss.length?`<span class="pill bad">requiert ${miss.join(', ')}</span>`:w.storage!=null?'<span class="pill bad">hangar trop petit</span>':w.sec===0?'<span class="pill good">maintenant</span>':dur(w.sec)}</td><td><button class="btn sm" data-addb="${i}:${k}:${L}">+ Plan</button></td></tr>`;
  })).join('');
},
research(){
  document.getElementById('labLv').textContent = labLevel();
  for(const k of Object.keys(T)){
    const L=S.tech[k]+1, miss=reqOk(T[k].req, null);
    document.getElementById('tc-'+k).innerHTML = costHtml(levelCost(T[k],L));
    document.getElementById('tt-'+k).textContent = dur(researchTime(k,L));
    document.getElementById('ts-'+k).innerHTML = miss.length?`<span class="pill bad">${miss.join(', ')}</span>`:`<span class="pill good">disponible</span>`;
  }
},
fleet(){
  const s=S.settings, cap = EXPO_CAPS[s.top1][1]*s.eco*(s.cls==='explorer'?1.5:1)*(S.expo.pf?2:1);
  const lc=shipStats('lc'), sc=shipStats('sc'), pf=shipStats('pf');
  const need = Math.max(0, cap - (S.expo.pf?pf.cargoEff:0));
  const nExp = Math.floor(Math.sqrt(S.tech.astro)) + (s.cls==='explorer'?2:0);
  document.getElementById('expoOut').innerHTML =
    gauge('m','m','Métal max',fmt(cap)) + gauge('c','c','Cristal max',fmt(cap*2/3)) + gauge('d','d','Deut. max',fmt(cap/3)) +
    gauge('e','e','Grands transp.',nf.format(Math.ceil(need/lc.cargoEff)),`ou ${nf.format(Math.ceil(need/sc.cargoEff))} petits`);
  document.getElementById('expoNote').innerHTML = `Une expédition trouve au mieux ces montants, plafonnés par la soute libre de la flotte. Expéditions simultanées : <b>${nExp}</b>${S.tech.astro?'':' (il faut Astrophysique 1)'}. Le bonus Éclaireur (x2) et Explorateur (x1,5) viennent de sources communautaires.`;
  const fc=S.fleetCalc, f=flight(fc.from, fc.to, fc.ships, fc.pct);
  document.getElementById('flightOut').innerHTML = f ?
    gauge('e','e','Aller',dur(f.secs),`distance ${fmt(f.D)}`) + gauge('d','d','Carburant',fmt(f.fuel),'deutérium, aller') + gauge('c','c','Soute',fmt(f.cargo)) + gauge('m','m','Vitesse',fmt(f.V),'vaisseau le plus lent')
    : `<p class="note" style="grid-column:1/-1">Coordonnées au format 1:234:8 et au moins un vaisseau.</p>`;
  document.getElementById('shipTbl').innerHTML = Object.keys(SHIPS).map(k=>{ const x=shipStats(k); return `<tr><td>${x.n}</td><td>${({combustion:'Combustion',impulse:'Impulsion',hyperdrive:'Hyperespace'})[x.drive]}</td><td class="n">${fmt(x.speedEff)}</td><td class="n">${fmt(x.cargoEff)}</td></tr>`; }).join('');
},
colony(){
  const dp = coloFrom(), maxPl = maxPlanets(), free = S.planets.length < maxPl;
  document.getElementById('coSlots').innerHTML = `<span class="pill ${free?'good':'bad'}">${S.planets.length}/${maxPl} planètes</span>`;
  const F = coloFleet(), req = [];
  const nextAstro = S.tech.astro + (S.tech.astro%2===0 ? 1 : 2);
  req.push(free ? {sev:'good', what:'Emplacement libre', why:`Astrophysique ${S.tech.astro} : ${maxPl} planètes possibles.`}
                : {sev:'bad', what:`Rechercher Astrophysique ${nextAstro}`, why:'Toutes tes planètes sont utilisées.', add:`t:astro`});
  if(S.tech.impulse>=3) req.push({sev:'good', what:'Réacteur à impulsion 3', why:'Prérequis du vaisseau de colonisation.'});
  else { let t=0; for(let L=S.tech.impulse+1; L<=3; L++) t+=researchTime('impulse',L); req.push({sev:'bad', what:`Réacteur à impulsion ${S.tech.impulse} → 3`, why:`Coût ${fmt(rangeCost(T.impulse,S.tech.impulse,3).reduce((a,b)=>a+b,0))} au total, environ ${dur(t)} de recherche.`, add:'t:impulse'}); }
  if(dp.b.shipyard>=4) req.push({sev:'good', what:`Chantier spatial 4 sur ${dp.name}`, why:'Prérequis du vaisseau de colonisation.'});
  else req.push({sev:'bad', what:`Chantier spatial ${dp.b.shipyard} → 4 sur ${dp.name}`, why:`Coût total : ${fmt(rangeCost(B.shipyard,dp.b.shipyard,4).reduce((a,b)=>a+b,0))} ressources.`, add:`b:${S.colo.from}:shipyard`});
  const w = F.wait;
  req.push({sev: w.sec===0 ? 'good' : w.storage!=null ? 'bad' : 'warn',
    what: colBuilt() ? 'Ressources du kit et carburant' : 'Ressources du vaisseau, du kit et carburant',
    why: `${w.sec===0 ? 'Disponibles maintenant.' : w.storage!=null ? 'Un hangar est trop petit pour ce total.' : `Disponibles dans ${dur(w.sec)}.`}${colBuilt() ? '' : ` Construction du vaisseau : ${dur(F.shipTime)}.`}`});
  document.getElementById('coReq').innerHTML = req.map(r=>`<li><span class="pill ${r.sev==='info'?'info':r.sev}">${({good:'OK',warn:'Bientôt',bad:'À faire'})[r.sev]}</span><span class="what">${esc(r.what)}${r.add?` <button class="btn sm" data-coadd="${r.add}">+ Plan</button>`:''}</span><span class="why">${esc(r.why)}</span></li>`).join('');

  const rows = rankPositions(), tgtPos = (parseC(coloTarget())||[])[2];
  document.getElementById('coPos').innerHTML = rows.map(r=>`<tr style="${r.ok?'':'opacity:.45'}">
    <td class="rank">${r.ok && r.rank<=3 ? r.rank : ''}</td><td class="n">${r.pos}</td>
    <td class="mono">${r.fields} <span class="note">(${r.min}–${r.max})</span></td><td class="n">${r.P.t} °C</td>
    <td>${r.P.bonus?`<span class="pill ${/métal/.test(r.P.bonus)?'info':'good'}">${r.P.bonus}</span>`:''}</td>
    <td class="n">${fmt(r.v)}</td><td class="n">${fmt(r.d)}</td>
    <td>${r.ok ? `<button class="btn sm ${r.pos===tgtPos?'primary':''}" data-copos="${r.pos}">${r.pos===tgtPos?'Choisie':'Choisir'}</button>` : `<span class="note">Astro ${r.P.astro}</span>`}</td></tr>`).join('');

  const L1 = F.leg1, L2 = F.leg2;
  document.getElementById('coFleet').innerHTML = `
    <div class="res">
      ${gauge('m','m','Métal du kit',fmt(F.kitCost[0]))}${gauge('c','c','Cristal du kit',fmt(F.kitCost[1]))}${gauge('d','d','Deut. du kit',fmt(F.kitCost[2]),`+ ${fmt(F.fuel)} de carburant`)}
      ${gauge('e','e','Arrivée du kit', L1 ? dur(L1.secs + (L2?L2.secs:0)) : '–', 'après le départ')}
    </div>
    <ul class="list">
      <li><div><div><b>1. Vaisseau de colonisation</b> vers ${esc(F.target)}, mission Coloniser</div>
        <div class="row" style="gap:10px"><span class="note">Charge :</span>${costHtml(F.colLoad)}<span class="note mono">vol ${L1?dur(L1.secs):'–'} · ${L1?fmt(L1.fuel):'–'} deut</span></div></div></li>
      ${F.n ? `<li><div><div><b>2. ${F.n} ${F.n>1?F.tr.n.toLowerCase().replace('transporteur','transporteurs'):F.tr.n.toLowerCase()}</b>, mission Transporter, dès que la colonie existe</div>
        <div class="row" style="gap:10px"><span class="note">Charge :</span>${costHtml(F.rest)}<span class="note mono">vol ${L2?dur(L2.secs):'–'} · ${L2?fmt(L2.fuel*2):'–'} deut aller-retour</span></div></div></li>`
        : `<li><div class="note">Tout le kit tient dans le vaisseau de colonisation (soute ${fmt(F.col.cargoEff)}).</div></li>`}
    </ul>
    <p class="note">Les transporteurs partent après l'arrivée du vaisseau : on ne peut pas transporter vers une position encore vide. Le kit ${esc(F.kit.n.toLowerCase())} couvre ${Object.entries(F.kit.lv).map(([k,l])=>`${B_SHORT[k]} ${l}`).join(', ') || 'aucun bâtiment'}. Carburant estimé.</p>`;

  const fpos = +S.colo.fpos || (parseC(coloTarget())||[])[2], v = coloVerdict(+S.colo.fields, fpos);
  document.getElementById('coEval').innerHTML = v ? `<ul class="advice"><li><span class="pill ${v.sev}">${v.t}</span><span class="what">Position ${fpos}</span><span class="why">${esc(v.why)}</span></li></ul>` : '';
},
plan(){
  const tot=[0,0,0]; let tTime=0;
  const items = S.plan.map((it,i)=>{
    let name, cost, time, from;
    if(it.type==='b'){ const p=S.planets[it.p]; if(!p) return ''; from=p.b[it.k]; cost=rangeCost(B[it.k],from,it.lvl); time=0; for(let L=from+1;L<=it.lvl;L++) time+=buildTime(it.k,L,p); name=`${B[it.k].n} ${it.lvl} · ${esc(p.name)}`; }
    else { from=S.tech[it.k]; cost=rangeCost(T[it.k],from,it.lvl); time=0; for(let L=from+1;L<=it.lvl;L++) time+=researchTime(it.k,L); name=`${T[it.k].n} ${it.lvl}`; }
    const done = from>=it.lvl;
    cost.forEach((x,j)=>tot[j]+=x); tTime+=time;
    return `<li><div><div>${name} ${done?'<span class="pill good">atteint</span>':''}</div>${done?'':`<div class="row" style="gap:12px">${costHtml(cost)}<span class="mono note">${dur(time)}</span></div>`}</div>
      <div class="row" style="gap:6px"><button class="btn sm ghost" data-up="${i}" aria-label="Monter">↑</button><button class="btn sm ghost" data-rm="${i}">Retirer</button></div></li>`;
  });
  document.getElementById('plList').innerHTML = items.join('') || `<li><div class="note">Aucun objectif. Ajoute un bâtiment ci-dessus, ou utilise « + Plan » dans Construire et Recherche.</div></li>`;
  const pm = S.planets.reduce((a,p)=>{ const r=production(p); return [a[0]+r.m,a[1]+r.c,a[2]+r.d]; },[0,0,0]);
  const hrs = Math.max(...tot.map((x,j)=>pm[j]>0?x/pm[j]:(x>0?Infinity:0)));
  document.getElementById('plTot').innerHTML = `${costHtml(tot)} <span class="mono">· ${dur(tTime)} de chantier · ${dur(hrs*3600)} de production</span>`;
},
};

/* ---------- events ---------- */
function bind(){
  view.querySelectorAll('[data-role]').forEach(el=>el.addEventListener('change',()=>{ S.roles[el.dataset.role]=el.value; save(); refresh(); }));
  view.querySelectorAll('[data-raid]').forEach(el=>el.addEventListener(el.type==='checkbox'?'change':'input',()=>{ if(!S.raid) return; const k=el.dataset.raid; if(k==='paste'){ const r=parseReport(el.value); if(r.some(x=>x!=null)){ S.raid.m=r[0]||0; S.raid.c=r[1]||0; S.raid.d=r[2]||0; save(); render(); } return; } S.raid[k] = el.type==='checkbox' ? el.checked : (+el.value||0); save(); REFRESH.explore(); }));
  view.querySelectorAll('[data-lf]').forEach(el=>el.addEventListener('change',()=>{ const k=el.dataset.lf, f=new Set(S.lf.found); el.checked ? f.add(k) : f.delete(k); S.lf.found=[...f]; save(); render(); }));
  view.querySelectorAll('[data-day]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k = el.dataset.day; S.day[k] = k==='focus' ? el.value : Math.max(0, parseInt(el.value)||0); save(); refresh();
  }));
  view.querySelectorAll('[data-colo]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k = el.dataset.colo;
    S.colo[k] = k==='built' ? el.value==='1' : (k==='from'||k==='bonus') ? (+el.value||0) : el.value.trim();
    save(); refresh();
  }));

  view.querySelectorAll('[data-pi]').forEach(card=>{
    const p = S.planets[+card.dataset.pi];
    card.querySelectorAll('input[data-b]').forEach(el=>el.addEventListener('input',()=>{ p.b[el.dataset.b]=Math.max(0,parseInt(el.value)||0); changed(); }));
    card.querySelectorAll('input[data-p]').forEach(el=>el.addEventListener('input',()=>{ const k=el.dataset.p; p[k] = (k==='tmax'||k==='sats') ? (parseInt(el.value)||0) : el.value; changed(); }));
    card.querySelectorAll('input[data-s]').forEach(el=>el.addEventListener('input',()=>{ const st=stockNow(p); p.stock={m:st[0],c:st[1],d:st[2],at:Date.now()}; p.stock[el.dataset.s]=parseFloat(el.value)||0; changed(); }));
  });
  view.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ S.planets.splice(+b.dataset.del,1); S.plan=S.plan.filter(x=>x.type!=='b'||x.p<S.planets.length); save(); render(); }));
  on('addPlanet','click',()=>{ S.planets.push(newPlanet('Colonie '+S.planets.length,'1:1:'+(S.planets.length+4),20,{})); S.sample=false; save(); render(); });
  view.querySelectorAll('input[data-t]').forEach(el=>el.addEventListener('input',()=>{ S.tech[el.dataset.t]=Math.max(0,parseInt(el.value)||0); changed(); }));
  view.querySelectorAll('[data-addt]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.addt; S.plan.push({type:'t',k,lvl:S.tech[k]+1}); save(); toast('Ajouté au plan'); }));
  view.querySelectorAll('[data-set]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k=el.dataset.set, s=S.settings;
    if(k==='ratio'){ const r=el.value.split(':').map(Number); if(r.length===3 && r.every(x=>x>0)) s.ratio=r; }
    else if(k==='cls') s.cls=el.value;
    else if(['geo','eng','colCargo'].includes(k)) s[k]=el.value==='1';
    else s[k]=Math.max(k==='top1'?0:1, parseFloat(el.value)||0);
    changed();
  }));
  view.querySelectorAll('[data-expo]').forEach(el=>el.addEventListener('change',()=>{ S.expo.pf=el.value==='1'; changed(); }));
  view.querySelectorAll('[data-fc]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ S.fleetCalc[el.dataset.fc] = el.dataset.fc==='pct'?+el.value:el.value.trim(); changed(); }));
  view.querySelectorAll('[data-ship]').forEach(el=>el.addEventListener('input',()=>{ S.fleetCalc.ships[el.dataset.ship]=Math.max(0,parseInt(el.value)||0); changed(); }));
  on('plAdd','click',()=>{ const pi=+document.getElementById('plP').value, k=document.getElementById('plB').value, lvl=Math.max(1,parseInt(document.getElementById('plL').value)||1); S.plan.push({type:'b',p:pi,k,lvl}); save(); refresh(); toast('Ajouté au plan'); });
  on('ioCopy','click',()=>{ const txt=JSON.stringify(S); const ta=document.getElementById('ioText'); ta.value=txt;
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>msg('Copié dans le presse-papiers')).catch(()=>{ ta.select(); msg('Sélectionné : copie-le manuellement'); }); });
  on('ioImport','click',()=>{ try{ const d=JSON.parse(document.getElementById('ioText').value); if(!d.planets||!d.settings) throw 0; S=Object.assign(sample(),d); S.sample=false; save(); render(); toast('Données importées'); }catch(e){ msg('Texte invalide : colle une sauvegarde complète'); } });
  on('ioReset','click',e=>{ const b=e.currentTarget; if(b.dataset.armed){ S=sample(); save(); render(); toast('Réinitialisé'); } else { b.dataset.armed='1'; b.textContent='Confirmer la réinitialisation'; b.classList.remove('ghost'); } });
}
view.addEventListener('click',e=>{
  const ab=e.target.closest('[data-addb]'); if(ab){ const [p,k,l]=ab.dataset.addb.split(':'); S.plan.push({type:'b',p:+p,k,lvl:+l}); save(); toast('Ajouté au plan'); }
  const rm=e.target.closest('[data-rm]'); if(rm){ S.plan.splice(+rm.dataset.rm,1); save(); refresh(); }
  const up=e.target.closest('[data-up]'); if(up){ const i=+up.dataset.up; if(i>0){ [S.plan[i-1],S.plan[i]]=[S.plan[i],S.plan[i-1]]; save(); refresh(); } }
});
view.addEventListener('click', e=>{
  const cp = e.target.closest('[data-copos]');
  if(cp){ const [g,sy] = coloSystem(); S.colo.target = `${g}:${sy}:${cp.dataset.copos}`; save(); render(); return; }
  const ca = e.target.closest('[data-coadd]');
  if(ca){
    const [kind,a,c] = ca.dataset.coadd.split(':');
    if(kind==='t') S.plan.push({type:'t', k:a, lvl: a==='impulse' ? 3 : S.tech[a] + (S.tech[a]%2===0?1:2)});
    else S.plan.push({type:'b', p:+a, k:c, lvl:4});
    save(); toast('Ajouté au plan');
  }
});
view.addEventListener('click', e=>{
  const dn = e.target.closest('[data-done]'); if(dn){ S.daily.done[dn.dataset.done] = Date.now(); save(); refresh(); toast('Bien joué'); return; }
  const rpp = e.target.closest('[data-raidprep]'); if(rpp){ S.raid = {coords:rpp.dataset.raidprep, name:rpp.dataset.raidname, m:0, c:0, d:0, safe:false}; save(); render(); return; }
  const rpc = e.target.closest('[data-raidclose]'); if(rpc){ S.raid = null; save(); render(); return; }
  const ct = e.target.closest('[data-cotarget]'); if(ct){ S.colo.target = ct.dataset.cotarget; save(); render(); toast('Destination de colonie mise à jour'); return; }
  const ar = e.target.closest('[data-apirefresh]'); if(ar){ try{ chrome.runtime.sendMessage({type:'apiRefresh', force:true}); }catch(err){} toast('Actualisation demandée'); return; }
  const tl = e.target.closest('[data-tool]'); if(tl){ S.ui.tool = tl.dataset.tool; save(); render(); return; }
  const go = e.target.closest('[data-goto]'); if(go){ tab = go.dataset.goto; try{ LS.setItem(KEY+'-tab',tab); }catch(err){} render(); return; }
  const sent = e.target.closest('[data-sent]'); if(sent){ S.colo.sentAt = Date.now(); S.colo.built = false; save(); refresh(); toast('Colonisation en route'); return; }
  const la = e.target.closest('[data-launch]');
  if(la){
    const a = JSON.parse(la.dataset.launch), tm = {id:Math.random().toString(36).slice(2,8), manual:true, end:Date.now()+a.dur*1000, done:false};
    if(a.kind==='t'){ tm.kind='t'; tm.k=a.k; tm.lvl=a.lvl; }
    else if(a.kind==='b'){ tm.kind='b'; tm.p=a.p; tm.k=a.k; tm.lvl=a.lvl; }
    else if(a.kind==='shipbuild'){ tm.kind='x'; tm.k='shipyard'; tm.ships=a.ships; tm.p=a.p; tm.label=a.what; }
    else if(a.kind==='transfer' || a.kind==='raid'){ tm.kind='x'; tm.k='fleet'; tm.ships=a.ships; tm.p=a.p; tm.label=a.kind==='raid' ? `Retour du pillage ${a.coords}` : 'Arrivée du rapatriement'; }
    else if(a.kind==='expo'){ tm.kind='x'; tm.k='expo'; tm.ships=a.ships; tm.p=a.p; tm.label="Retour d'expédition"; }
    else if(a.kind==='sats'){ tm.kind='x'; tm.k='sats'; tm.n=a.n; tm.p=a.p; tm.label=a.what; }
    else { tm.kind='x'; tm.k='colship'; tm.label='Vaisseau de colonisation'; }
    const p = S.planets[a.p] || S.planets[+S.colo.from] || S.planets[0];
    const cost = a.cost || COL_SHIP_COST;
    const st = stockNow(p); p.stock = {m:Math.max(0,st[0]-cost[0]), c:Math.max(0,st[1]-cost[1]), d:Math.max(0,st[2]-cost[2]), at:Date.now()};
    if(a.kind==='raid'){ S.raids[a.coords] = {at:Date.now()}; S.raid = null; }
    S.timers.push(tm); save(); a.kind==='raid' ? render() : refresh(); toast(`Suivi : ${a.what}`);
  }
});
function on(id,ev,fn){ const el=document.getElementById(id); if(el) el.addEventListener(ev,fn); }
function msg(t){ const m=document.getElementById('ioMsg'); if(m) m.textContent=t; }
function changed(){ S.sample=false; save(); refresh(); }

/* ---------- import from the Empire-view bookmarklet ---------- */
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const MATCH_B = [
  ['metal',[['mine','metal']]], ['crystal',[['mine','crist'],['mine','crystal']]], ['deut',[['synth','deut']]],
  ['solar',[['centrale','solaire'],['solar','plant']]], ['fusion',[['fusion']]], ['robot',[['robot']]],
  ['shipyard',[['chantier'],['shipyard']]], ['lab',[['laboratoire'],['research','lab']]], ['nanite',[['nanite']]],
  ['smetal',[['hangar','metal'],['metal','storage']]], ['scrystal',[['hangar','crist'],['crystal','storage']]], ['sdeut',[['reservoir','deut'],['deuterium','tank']]],
];
const MATCH_T = [
  ['irn',[['reseau'],['intergalactic']]], ['hyperdrive',[['propulsion','hyper'],['hyperspace','drive']]], ['hyper',[['hyperespace'],['hyperspace']]],
  ['energy',[['energ']]], ['laser',[['laser']]], ['plasma',[['plasma']]],
  ['combustion',[['combustion']]], ['impulse',[['impulsion'],['impulse']]], ['espionage',[['espionnage'],['espionage']]],
  ['computer',[['ordinateur'],['computer']]], ['astro',[['astro']]], ['weapons',[['arme'],['weapon']]],
  ['shielding',[['bouclier'],['shield']]], ['armour',[['protection'],['armour']]], ['ion',[['ion']]],
];
const MATCH_S = [['sc',[['petit','transp'],['small','cargo']]], ['lc',[['grand','transp'],['large','cargo']]], ['lf',[['chasseur','leger'],['light','fighter']]], ['hf',[['chasseur','lourd'],['heavy','fighter']]], ['cr',[['croiseur'],['cruiser']]], ['bs',[['bataille'],['battleship']]], ['col',[['colonisation'],['colony']]], ['rec',[['recycl']]], ['pr',[['sonde'],['probe']]], ['bb',[['bombard']]], ['ds',[['destructeur'],['destroyer']]], ['bc',[['traqueur'],['battlecruiser']]], ['rp',[['faucheur'],['reaper']]], ['pf',[['eclaireur'],['pathfinder']]]];
/** Returns the internal key matching a translated game label, or null. */
function matchKey(label, table){ const n=norm(label); for(const [k,alts] of table) if(alts.some(a=>a.every(w=>n.includes(w)))) return k; return null; }
const lvlOf = v => typeof v==='object' && v ? +v.lvl||0 : +v||0;
function tempMax(t){ const nums=String(t??'').match(/-?\d+/g); return nums ? Math.max(...nums.map(Number)) : null; }

/** Applies a bookmarklet export to the state; returns a report. */
function importEmpire(d){
  if(!d || !Array.isArray(d.planets)) throw new Error('format');
  const rep = {planets:0, unknown:new Set(), techs:0, alerts:[].concat(d.alerts||[])};
  const at = Date.now();
  const kept = [];
  for(const src of d.planets){
    const coords = String(src.coords||'').replace(/[\[\]\s]/g,'');
    let p = S.planets.find(x=>x.coords===coords) || newPlanet(src.name||'Planète', coords, 20, {});
    p.name = src.name || p.name; p.coords = coords;
    const tm = tempMax(src.temp); if(tm!=null) p.tmax = tm;
    for(const grp of ['supply','station']) for(const [label,v] of Object.entries(src[grp]||{})){
      const k = matchKey(label, MATCH_B); if(k) p.b[k]=lvlOf(v); else rep.unknown.add(label);
    }
    for(const [label,v] of Object.entries(src.ships||{})){ if(/satellite|solar sat/i.test(norm(label))){ p.sats = lvlOf(v); continue; } const k = matchKey(label, MATCH_S); if(k){ p.ships = p.ships||{}; p.ships[k] = lvlOf(v); } }
    if(src.res) p.stock = {m:+src.res.metal||0, c:+src.res.crystal||0, d:+src.res.deut||0, at};
    if(src.energy && src.energy.balance != null){ p.eAdj = 0; p.eAdj = +src.energy.balance - production(p).eBal; }
    (src.alerts||[]).forEach(a=>rep.alerts.push(`${src.name} : ${a}`));
    kept.push(p); rep.planets++;
  }
  for(const [label,v] of Object.entries(d.research||{})){
    const k = matchKey(label, MATCH_T); if(k){ S.tech[k]=lvlOf(v); rep.techs++; } else rep.unknown.add(label);
  }
  S.plan = S.plan.map(it=>{ if(it.type!=='b') return it; const old=S.planets[it.p]; const ni=kept.indexOf(old); return ni<0?null:{...it,p:ni}; }).filter(Boolean);
  S.planets = kept; S.sample = false; S.lastImport = at;
  S.lastAlerts = rep.alerts.map(a=>String(a).replace(/[\p{Extended_Pictographic}\uFE0F]/gu,'').trim());
  save();
  return rep;
}
function runImport(text){
  let rep;
  try{ rep = importEmpire(JSON.parse(text)); }
  catch(e){ toast('Import impossible : colle le JSON complet copié par le script'); return false; }
  if(tab!=='empire'){ tab='empire'; }
  render();
  const unk=[...rep.unknown].filter(l=>!/graviton|terraform|depot|silo|lune|lunar|phalange|phalanx|porte|jump|dock|alliance|missile/i.test(norm(l)));
  const repEl = document.getElementById('impReport'); if(!repEl){ toast('Empire importé'); return true; }
  repEl.innerHTML =
    `<div class="row"><span class="pill good">${rep.planets} planète(s)</span><span class="pill good">${rep.techs} recherche(s)</span>${unk.length?`<span class="pill warn">Non reconnus : ${unk.map(esc).join(', ')}</span>`:''}</div>`+
    (rep.alerts.length?`<ul class="list" style="margin-top:8px">${rep.alerts.map(a=>`<li><div>${esc(a)}</div></li>`).join('')}</ul>`:'');
  const ib = document.getElementById('impBox'); if(ib) ib.open = true;
  toast('Empire importé');
  return true;
}
document.addEventListener('paste', e=>{
  if(e.target.closest && e.target.closest('input,textarea:not(#impText)')) return;
  const t = (e.clipboardData||window.clipboardData).getData('text');
  if(t && t.includes('"planets"') && t.trim().startsWith('{')){ e.preventDefault(); runImport(t); }
});
view.addEventListener('click', e=>{ if(e.target.id==='impGo') runImport(document.getElementById('impText').value); });
document.getElementById('tabs').addEventListener('click',e=>{ const b=e.target.closest('button[data-tab]'); if(!b) return; tab=b.dataset.tab; try{ LS.setItem(KEY+'-tab',tab); }catch(err){} render(); });
view.addEventListener('click', e=>{
  if(e.target.id==='tmSound'){ unlockAudio(); chime(); }
  if(e.target.id==='tmAdd'){
    unlockAudio();
    const sec = parseLeft(document.getElementById('tmLeft').value);
    if(sec==null || sec<=0){ toast('Durée non reconnue : colle par exemple 2h 13m 05s'); return; }
    const [kind,a,b] = document.getElementById('tmWhat').value.split(':');
    const tm = {id:Math.random().toString(36).slice(2,8), kind, end:Date.now()+sec*1000, done:false};
    if(kind==='t'){ tm.k=a; tm.lvl=S.tech[a]+1; }
    else if(kind==='b'){ tm.p=+a; tm.k=b; tm.lvl=S.planets[+a].b[b]+1; }
    else tm.k=a;
    S.timers.push(tm); save(); document.getElementById('tmLeft').value=''; renderTimers(); toast(`Minuteur lancé : ${clock(sec)}`);
  }
  const rmT = e.target.closest('[data-tmrm]');
  if(rmT){ S.timers = S.timers.filter(t=>t.id!==rmT.dataset.tmrm); save(); stopFlash(); renderTimers(); }
});
setInterval(tickTimers, 1000);
setInterval(()=>{ if(tab==='today'||tab==='empire') REFRESH[tab](); }, 30000);


/* ---------- live sync from the extension ---------- */
/** Merges the game state collected by the content script into the panel state. */
function applyGame(g){
  if(!g) return;
  const m = g.meta || {};
  if(m.playerId) S.me = m.playerId;
  S.explored = g.explored || S.explored || {};
  if(m.eco) S.settings.eco = m.eco;
  if(m.fleet) S.settings.fleet = m.fleet;
  if(m.cls) S.settings.cls = m.cls;
  Object.assign(S.tech, g.tech || {});
  const ids = (g.order && g.order.length) ? g.order : Object.keys(g.planets || {});
  const kept = [];
  for(const id of ids){
    const gp = (g.planets || {})[id]; if(!gp) continue;
    let p = S.planets.find(x=>x.gid===id) || S.planets.find(x=>!x.gid && x.coords===gp.coords);
    if(!p) p = (S.sample && kept.length===0) ? S.planets[0] : newPlanet(gp.name||'Planète', gp.coords||'', gp.tmax ?? 20, {});
    p.gid = id;
    if(gp.name) p.name = gp.name;
    if(gp.coords) p.coords = gp.coords;
    if(gp.tmax != null) p.tmax = gp.tmax;
    Object.assign(p.b, gp.b || {});
    if(gp.sats != null) p.sats = gp.sats;
    if(gp.energy != null){ p.eAdj = 0; p.eAdj = gp.energy - production(p).eBal; }
    if(gp.ships){ p.ships = Object.assign({}, gp.ships); p.shipsAt = gp.shipsAt || 0; }
    if(gp.stock && gp.stock.m != null && gp.stock.at !== p.stockGameAt){ p.stock = {...gp.stock}; p.stockGameAt = gp.stock.at; }
    kept.push(p);
  }
  if(kept.length){
    S.plan = S.plan.map(it=>{ if(it.type!=='b') return it; const ni = kept.indexOf(S.planets[it.p]); return ni<0 ? null : {...it, p:ni}; }).filter(Boolean);
    S.planets = kept;
  }
  S.timers = (S.timers || []).filter(t=>!t.game);
  for(const t of (g.timers || [])){
    const tm = {id:'g'+t.end+(t.techId||t.type)+(t.planetId||''), game:true, queue:t.type, end:t.end*1000, done:t.end*1000 <= Date.now()};
    const pi = S.planets.findIndex(p=>p.gid===t.planetId);
    if(OG_TECH[t.techId]){ tm.kind='t'; tm.k=OG_TECH[t.techId]; tm.lvl=S.tech[tm.k]+1; }
    else if(OG_BUILD[t.techId] && pi>=0){ tm.kind='b'; tm.p=pi; tm.k=OG_BUILD[t.techId]; tm.lvl=S.planets[pi].b[tm.k]+1; }
    else if(t.type==='fleet'){ tm.kind='x'; tm.k = /exp/i.test(t.label) ? 'expo' : 'fleet'; tm.label = t.label; }
    else { tm.kind='x'; tm.k = t.type==='shipyard' ? 'shipyard' : 'other'; tm.p = pi; tm.label = t.label + (pi>=0 && S.planets.length>1 ? ` · ${S.planets[pi].name}` : ''); }
    S.timers.push(tm);
  }
  S.timers = S.timers.filter(t=>t.game || !t.manual || !S.timers.some(g=>g.game && !g.done && g.kind===t.kind && g.k===t.k && (g.kind!=='b' || g.p===t.p)));
  S.moves = g.moves || [];
  if(g.artefacts != null) S.artefacts = g.artefacts;
  if(g.slots) S.slots = g.slots;
  S.sample = false;
  S.syncAt = g.at || Date.now();
  save();
  const a = document.activeElement;
  const typing = a && view.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
  typing ? refresh() : render();
}
render();
if(window.__game) applyGame(window.__game);
chrome.storage.onChanged.addListener((ch, area)=>{ if(area==='local' && ch.game) applyGame(ch.game.newValue); if(area==='local' && ch.api){ API = ch.api.newValue; if(tab==='tools' && S.ui.tool==='explore') render(); } });

/* ---------- one alert, one acknowledgment ---------- */
/** In the extension, every alert goes through the background so a single "OK" clears them all. */
function showBigAlert(label){
  try { chrome.runtime.sendMessage({type:'alert', text:label}); } catch(e) {}
}
function mirrorAlerts(items){
  const box = document.getElementById('bigAlert');
  if(!items || !items.length){ if(!box.hidden) ackFinished(); box.hidden = true; stopFlash(); return; }
  document.getElementById('bigAlertMsg').innerHTML = items.map(esc).join('<br>');
  box.hidden = false;
}
document.getElementById('bigAlertOk').addEventListener('click', ()=>chrome.storage.local.set({pendingAlerts: []}));
chrome.storage.local.get('pendingAlerts', d=>mirrorAlerts(d.pendingAlerts));
chrome.storage.onChanged.addListener((ch, area)=>{ if(area==='local' && ch.pendingAlerts) mirrorAlerts(ch.pendingAlerts.newValue); });
