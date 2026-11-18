
const APP_VERSION = '1.50.1';
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
const B_SHORT = {crawl:'Foreuses', metal:'Métal',crystal:'Cristal',deut:'Deut.',solar:'Solaire',fusion:'Fusion',robot:'Robots',shipyard:'Chantier',lab:'Labo',nanite:'Nanites',smetal:'Hangar M',scrystal:'Hangar C',sdeut:'Réserv. D'};

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
/**
 * Tranche de plafond d'expédition. Elle dépend des points du n°1 de l'univers :
 * le classement public les donne, le réglage manuel ne sert plus que si
 * l'API n'a pas encore répondu.
 * @returns {number} indice dans EXPO_CAPS
 */
function top1Tier(){
  const sc = API && API.scores ? Object.values(API.scores) : null;
  // Le réglage manuel est relu du stockage local : il peut être hors bornes.
  const regle = Math.min(Math.max(0, Math.trunc(+S.settings.top1) || 0), EXPO_CAPS.length-1);
  if(!sc || !sc.length) return regle;
  // `reduce` et pas un spread : le classement d'un univers plein compte des
  // dizaines de milliers de joueurs, assez pour casser la pile.
  const pts = sc.reduce((m,x)=>Math.max(m, (x && x[0]) || 0), 0);
  const i = EXPO_CAPS.findIndex(([lim])=>pts < lim);
  return i<0 ? EXPO_CAPS.length-1 : i;
}
/** Trouvaille maximale d'une expédition, en équivalent métal. Estimation. */
function expoFind(pf){ return EXPO_CAPS[top1Tier()][1]*S.settings.eco*(S.settings.cls==='explorer'?1.5:1)*(pf?2:1); }

function sample(){
  return {
    v:1, sample:true,
    settings:{eco:1, fleet:1, cls:'collector', geo:false, eng:false, ratio:[3,2,1], top1:0, colCargo:true, crawlerOverload:false},
    tech:Object.fromEntries(Object.keys(T).map(k=>[k,0])),
    planets:[newPlanet('Planète mère','1:1:8',40,{metal:1})],
    fleetCalc:{from:'1:1:8', to:'1:2:8', pct:100, ships:{sc:1}},
    expo:{pf:true},
    ui:{tool:'colony', fold:{}},
    day:{interval:90, nightStart:23, nightEnd:7, horizon:24, focus:'equi', night:false},
    lf:{found:['humans','rocktal']},
    centre:null, raid:null, raids:{}, prio:[],
    daily:{done:{}, no:{}},
    colo:{fromId:null, objective:'balanced', bonus:0, target:'', kit:'std', tr:'sc', built:false, fields:'', fpos:''},
  };
}
/* Le chantier sort trois choses qui ne se rangent pas au même endroit : des
   vaisseaux, des foreuses que production() compte à part, et de la défense,
   comptée par type et par total. Chaque file le réinventait ; un seul endroit
   le dit, sinon un lot de lanceurs finit dans p.ships et ne défend rien. */
function addBuilt(p, ships){
  for(const [k,n] of Object.entries(ships||{})){
    if(k==='crawl') p.crawlers=(p.crawlers||0)+n;
    /* Le détail part du relevé, pas de rien : sur une planète dont on ne
       connaissait que le total, poser {ll:2} effacerait les lanceurs déjà au
       sol et le plan les redemanderait un par un. */
    else if(DEF[k]){ const d = Object.assign({}, defsOf(p)); d[k] = (d[k]||0)+n; p.def=(p.def||0)+n; p.defs = d; }
    else { p.ships=p.ships||{}; p.ships[k]=(p.ships[k]||0)+n; }
  }
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
S.raids = S.raids || {};
S.prio = Array.isArray(S.prio) ? S.prio : [];
migratePlanetIds();
S.daily = Object.assign(sample().daily, S.daily);
/* Une sauvegarde perdue en silence est pire qu'une erreur : l'écran montre la
   case cochée, et le rechargement suivant l'a oubliée. */
function saveFailed(e){ console.error('Copilote : sauvegarde impossible', e); try{ toast('Sauvegarde impossible : recharge le panneau'); }catch(err){} }
window.__saveFailed = saveFailed;
function save(){ try{ LS.setItem(KEY, JSON.stringify(S)); }catch(e){ saveFailed(e); } }

/* L'identité d'une planète est son id. Le rang change dès que le jeu
   réordonne, le nom se répète d'une colonie à l'autre, le gid n'existe qu'une
   fois le jeu lu : aucun des trois ne la désigne. Un id qui ne répond plus ne
   désigne aucune planète, et l'appelant le traite comme tel — il ne se rabat
   jamais sur une voisine, ce qui était la vieille faute du rang. */
function planetById(id){ return S.planets.find(p => p.id === id) || null; }
function planetIndexById(id){ return S.planets.findIndex(p => p.id === id); }

/* Ce que le joueur retire, il le retire vraiment : ici l'absence est une
   certitude et non un défaut d'appariement, donc ce qui visait cette planète
   s'en va avec elle. Ailleurs, un id muet laisse les choses en place. */
function forgetPlanet(id){
  S.planets = S.planets.filter(p => p.id !== id);
  S.timers = (S.timers || []).filter(t => t.pid !== id);
  if(S.colo.fromId === id) S.colo.fromId = null;
  if(S.centre === id) S.centre = null;
}

/* Une priorité est ce que le joueur pose : un bâtiment ou une recherche, avec
   le niveau qu'il vise. Elle ne se périme pas, elle s'accomplit — dès que le
   niveau est atteint, ou que la planète n'existe plus, elle cesse de compter.
   Aucune écriture ici : prios() se rappelle à chaque rendu, et c'est prioClean()
   qui décide du stockage.
   Une recherche ne se range pas sur une planète, elle part du centre : on lui
   donne le pid de labPlanet() à la lecture et jamais au stockage, sinon un
   centre que le joueur déplace laisserait la priorité visée sur l'ancien. */
function prios(){
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const out = [];
  for(const e of (Array.isArray(S.prio) ? S.prio : [])){
    if(!e || !Number.isInteger(e.lvl) || e.lvl <= 0) continue;
    if(e.kind === 'b'){
      const p = own(B, e.k) ? planetById(e.pid) : null;
      if(p && e.lvl > (p.b[e.k] || 0)) out.push({kind:'b', pid:p.id, k:e.k, lvl:e.lvl});
    }else if(e.kind === 't'){
      const p = own(T, e.k) ? labPlanet() : null;
      if(p && e.lvl > (S.tech[e.k] || 0)) out.push({kind:'t', pid:p.id, k:e.k, lvl:e.lvl});
    }
  }
  return out;
}
/* La première posée sur la planète est celle qui agit ; les suivantes
   attendent leur tour, dans l'ordre où le joueur les a posées. */
function prioOf(pid){ return prios().find(x => x.pid === pid) || null; }
/* Ne réécrit que si une entrée tombe : render() passe ici à chaque rendu, et
   une écriture de stockage par rendu serait payée pour rien. */
function prioClean(){
  /* Sans planète, labPlanet() est null et toute recherche paraît morte : or une
     recherche n'appartient à aucune planète, et un empire vidé (import tronqué)
     ne doit pas emporter ce que le joueur a posé. Pas d'empire, rien à compacter. */
  if(!S.planets.length) return;
  const vivantes = prios();
  if(vivantes.length === S.prio.length) return;
  S.prio = vivantes.map(x => x.kind === 't' ? {kind:'t', k:x.k, lvl:x.lvl} : x);
  save();
}

/* Les rangs enregistrés deviennent des identités. Un rang écrit hier ne
   désigne plus la même planète après un réordonnancement : il désigne la
   voisine, sans rien dire. La conversion se décide sur le type — un nombre est
   encore un rang — donc elle se rejoue sans dommage sur un état déjà converti.
   S.v ne pouvait pas servir de repère : sample() écrit v:1 et le fusionne dans
   tout état relu, converti ou non. */
function migratePlanetIds(){
  for(const p of S.planets) if(!p.id) p.id = Math.random().toString(36).slice(2,9);
  const idAt = i => (S.planets[i] || {}).id || null;
  const mue = x => { if(typeof x.p !== 'number') return x; const y = Object.assign({}, x, {pid: idAt(x.p)}); delete y.p; return y; };
  S.timers = (S.timers || []).map(mue);
  // La liste d'objectifs a disparu : rien ne la lisait. Ce qu'elle a laissé
  // dans les sauvegardes s'en va au premier chargement.
  delete S.plan;
  // Le rôle par planète aussi : il n'était lu que par son propre menu, et le
  // centre le remplace. Rien n'est perdu, puisque rien ne s'en servait.
  delete S.roles;
  if(typeof S.colo.from === 'number'){ S.colo.fromId = idAt(S.colo.from); delete S.colo.from; }
  S.v = 2;
}

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
/* Autant de couleurs que de planètes raisonnablement suivies ; au-delà, on
   boucle plutôt que de risquer deux teintes indistinguables. */
const PLANET_COLORS = 6;
/** Pastille colorée d'une planète, couleur stable sur son rang dans la liste. */
function planetTag(name){
  const i = S.planets.findIndex(p => p.name === name || planetRef(p) === name);
  return `<span class="ptag" style="--pc:var(--p${(i < 0 ? 0 : i) % PLANET_COLORS})">${esc(name)}</span>`;
}
/** Le rang de couleur d'une planète : le même que celui de sa pastille, pour
    que la page du jeu et le panneau parlent de la même planète en une seule
    teinte. Une planète inconnue n'en a pas. */
function planetHue(name){
  const i = S.planets.findIndex(p => p.name === name || planetRef(p) === name);
  return i < 0 ? null : i % PLANET_COLORS;
}
/** Étiquette « Catégorie · Planète » : la planète devient une pastille. */
function qHtml(q){
  const i = String(q || '').indexOf(' · ');
  return i < 0 ? esc(q || '') : esc(q.slice(0, i)) + ' ' + planetTag(q.slice(i + 3));
}
/* Le copilote n'ouvre que des pages du jeu : il ne remplit aucun formulaire,
   ne clique sur rien et ne lance rien à ta place. Un lien, pas un robot. */
const GO_KIND = {t:'research', ship:'shipyard', shipbuild:'shipyard', sats:'shipyard', def:'defenses',
  transfer:'fleetdispatch', fleet:'fleetdispatch', expo:'fleetdispatch', raid:'galaxy'};
const GO_MISSION = {lfb:'lfbuildings', lfr:'lfresearch', artefacts:'lfresearch',
  discovery:'galaxy', raid:'galaxy', inactive:'galaxy', 'raid-go':'galaxy', 'colo-taken':'galaxy',
  expomax:'research', expocargo:'shipyard', fleetslots:'movement', 'colo-fly':'movement', 'colo-eval':'overview', night:'fleetdispatch', defseen:'defenses', chantierlu:'shipyard'};
/* Les bâtiments se répartissent sur deux pages ; les hangars sont côté Ressources. */
const GO_FACILITIES = new Set(['robot','shipyard','lab','nanite']);

/** URL d'une page du jeu sur une planète, ou null tant que le serveur est inconnu. */
function goUrl(comp, pi){
  if(!S.host || !comp) return null;
  const gid = (S.planets[pi] || {}).gid;
  return `https://${S.host}/game/index.php?page=ingame&component=${comp}${gid ? `&cp=${gid}` : ''}`;
}
/** URL où se fait une action du plan, ou null. */
const SHIP_ID = Object.fromEntries(Object.entries(OG_SHIPS).map(([id,k])=>[k,id]));
/* Le jeu remplit lui-même son formulaire de flotte quand on arrive par un lien
   qui porte les paramètres — c'est ce que fait sa propre page Galaxie quand on
   clique l'icône d'attaque. L'extension n'écrit donc rien dans la page : elle
   ouvre un lien, le jeu fait le reste. Sans destination ni mission, rien à
   préparer, on retombe sur la page nue. */
function fleetUrl(a){
  const c = a && a.dest ? parseC(a.dest) : null;
  if(!S.host || !c || !a.mission) return null;
  const gid = (S.planets[a.p] || {}).gid;
  const q = ['page=ingame', 'component=fleetdispatch'];
  if(gid) q.push('cp='+gid);
  q.push('galaxy='+c[0], 'system='+c[1], 'position='+c[2], 'type=1', 'mission='+a.mission);
  for(const [k,n] of Object.entries(a.ships||{})) if(n>0 && SHIP_ID[k]) q.push('am'+SHIP_ID[k]+'='+n);
  return `https://${S.host}/game/index.php?${q.join('&')}`;
}
function actGo(a){
  if(!a) return null;
  const prep = fleetUrl(a); if(prep) return prep;
  if(a.kind === 'b') return goUrl(GO_FACILITIES.has(a.k) ? 'facilities' : 'supplies', a.p);
  if(a.kind === 'lf') return goUrl(lfQueue(a.id) === 'lfresearch' ? 'lfresearch' : 'lfbuildings', a.p);
  // une recherche se lance depuis la planète qui porte le laboratoire
  const pi = a.kind === 't' ? S.planets.indexOf(labPlanet()) : a.p;
  return goUrl(GO_KIND[a.kind], pi);
}
/** URL où se fait une mission du jour, ou null. */
function missionGo(m){
  if(!m) return null;
  const tag = (m.tags || [])[0];
  const prep = fleetUrl(m); if(prep) return prep;
  const url = goUrl(GO_MISSION[m.id], tag ? S.planets.findIndex(p=>planetRef(p) === tag) : centreOrHub());
  /* La page Galaxie accepte les mêmes paramètres que la page de flotte. Une
     carte qui nomme des coordonnées peut donc y mener directement, au lieu de
     déposer le joueur sur son propre système et de le laisser naviguer. Sans
     coordonnées, rien n'est ajouté : on n'invente pas une destination. */
  const c = m.coords ? parseC(m.coords) : null;
  return url && c && GO_MISSION[m.id] === 'galaxy' ? `${url}&galaxy=${c[0]}&system=${c[1]}` : url;
}
/** URL de la page Galaxie ouverte sur un système, ou null. */
function galaxyUrl(coords){
  const c = parseC(coords), url = goUrl('galaxy', centreOrHub());
  return url && c ? `${url}&galaxy=${c[0]}&system=${c[1]}` : null;
}
/* Une carte qui nomme plusieurs systèmes n'en ouvrait qu'un : le clic sur le
   corps mène au premier, et les autres coordonnées n'étaient que du texte à
   retaper. Chacune porte donc son propre lien. Serveur inconnu : la
   coordonnée reste du texte, échappé comme avant. */
function coordLink(coords){
  const url = galaxyUrl(coords);
  return url ? `<span class="go" data-go="${esc(url)}" title="Ouvrir la galaxie ${esc(coords)}">${esc(coords)}</span>` : esc(coords);
}
/** Le niveau d'Ordinateur qui ajouterait un emplacement de flotte. */
function leverFlotte(){ return `Technologie Ordinateur ${S.tech.computer+1} ajoute un emplacement de flotte.`; }
/** Attribut de lien pour une carte, vide quand on ne sait pas où l'envoyer. */
function goAttr(url){ return url ? ` data-go="${esc(url)}"` : ''; }
/* OGame n'accepte de paramètres d'URL que sur la page de flotte — c'est ce dont
   sa propre page Galaxie a besoin. Il n'existe aucun équivalent pour « monte
   Métal 21 » : le lien d'un bâtiment, d'une recherche, d'une case de forme de
   vie ou d'un chantier ouvre la bonne page, et s'arrête là. Le dire est la
   seule chose à faire ; se taire laisse attendre un formulaire rempli qui ne
   viendra jamais.

   Et il ouvre la bonne planète seulement quand l'URL porte `cp=`. Une planète
   que le jeu ne nous a pas encore nommée n'a pas d'identifiant à y mettre : le
   lien tombe alors sur celle que le jeu avait en tête. Promettre « la bonne
   planète » dans ce cas enverrait construire ailleurs un joueur qui en a
   plusieurs — le mensonge exact que cette note est censée supprimer. */
/**
 * Why a card's link cannot carry the action itself, when it cannot.
 * @param {object} a planned action
 * @returns {string} the note, empty when the game fills its own form or when
 *   there is no link at all
 */
function goNote(a){
  const url = a && !fleetUrl(a) && actGo(a);
  if(!url) return '';
  return /[?&]cp=/.test(url)
    ? 'Le lien ouvre la page sur la bonne planète : OGame ne permet pas de pré-remplir cette action.'
    : 'Le lien ouvre la page : OGame ne permet pas de pré-remplir cette action, ni de choisir la planète tant que le jeu ne l\'a pas nommée.';
}
/* Noms relevés sur le jeu ; le panneau de détail en apporte d'autres au fil
   des visites, et ceux-là priment puisqu'ils viennent de la partie en cours. */
const LF_NAMES = Object.assign({}, typeof OG_LF_BUILD !== 'undefined' ? OG_LF_BUILD : {},
  typeof OG_LF_TECH !== 'undefined' ? OG_LF_TECH : {});

/**
 * Le prix relevé vaut-il encore ? Il a été lu pour un niveau précis ; dès que
 * la case monte, il décrit un palier déjà franchi. La liste donne le niveau
 * courant à chaque visite, le panneau de détail ne se rouvre pas tout seul :
 * c'est la comparaison des deux qui dit si le chiffre est encore bon.
 * @param {object} v case relevée
 * @returns {boolean}
 */
function lfPriced(v){
  return !!(v && v.cost && v.cost.some(x=>x>0) && v.secs > 0
    && v.next === (v.lvl || 0) + 1);
}

/* Bornes de bon sens sur ce que le jeu publie : un niveau de case et un prix
   lus sur une page ne doivent jamais faire grossir la mémoire ni les calculs. */
const LF_LVL_MAX = 1000;
const LF_COST_MAX = 1e15;
/* Les coûts montent d'un niveau à l'autre. Un facteur hors de [1, 5] veut dire
   que les deux prix vus ne peuvent pas être justes ensemble (un bonus de coût a
   changé entre les deux) : on ne chiffre pas, plutôt que de chiffrer faux. */
const LF_FACTOR_MAX = 5;
/* Niveaux de prix gardés par case : deux suffisent au facteur, dix laissent de
   quoi le vérifier sans que le stockage grossisse. */
const LF_SEEN_KEEP = 10;

/**
 * Un coût lu, ramené à trois nombres finis entre 0 et LF_COST_MAX.
 * @param {number[]} c coût brut
 * @returns {number[]} [métal, cristal, deutérium]
 */
function lfClampCost(c){
  return [0,1,2].map(i => { const x = +(c || [])[i]; return Number.isFinite(x) ? Math.min(Math.max(x, 0), LF_COST_MAX) : 0; });
}

/**
 * Mémoire des prix vus d'une case : ajoute celui que vient de lire le panneau
 * de détail (prix du niveau `next`, avec l'heure de lecture) et ne garde que
 * les dix niveaux les plus hauts.
 * @param {object} prev case déjà connue (seen, seenAt), ou undefined
 * @param {object} v lecture de la case
 * @returns {{seen:object, seenAt:object}} prix {niveau:[m,c,d]} et heures {niveau:ms}
 */
function lfRemember(prev, v){
  const seen = Object.assign({}, prev && prev.seen), seenAt = Object.assign({}, prev && prev.seenAt);
  const n = Math.floor(+v.next);
  if(n >= 1 && n <= LF_LVL_MAX && Array.isArray(v.cost) && v.cost.some(x=>x>0)){ const c = lfClampCost(v.cost); /* l'heure ne bouge que si le prix est nouveau ou change */ if(!seen[n] || !seen[n].every((x,i)=>x===c[i])) seenAt[n] = Date.now(); seen[n] = c; }
  Object.keys(seen).map(Number).sort((a,b)=>b-a).slice(LF_SEEN_KEEP).forEach(k=>{ delete seen[k]; delete seenAt[k]; });
  return {seen, seenAt};
}

/**
 * Adopte la lecture d'une case sans perdre ce que les lectures précédentes
 * avaient appris : les prix vus, et la durée quand la liste n'en porte pas.
 * @param {object} prev case déjà connue, ou undefined
 * @param {object} cur lecture du jour
 * @returns {object} case fusionnée
 */
function lfMerge(prev, cur){
  const out = Object.assign({}, cur, lfRemember(prev, cur));
  if(!cur.cost && prev && prev.secs > 0 && !(cur.secs > 0)) out.secs = prev.secs;
  /* L'effet ne se lit que sur le panneau de détail, que le joueur n'ouvre
     qu'une fois : une lecture de la liste l'effacerait. */
  const eff = [0,1,2].includes(cur.eff) ? cur.eff : ([0,1,2].includes(prev && prev.eff) ? prev.eff : null);
  if(eff === null) delete out.eff; else out.eff = eff;
  return out;
}

/**
 * Prix d'une case de forme de vie à un niveau donné, lu ou estimé. Les coûts
 * suivent base × facteur^(n−1) : deux niveaux vus donnent le facteur, projeté
 * depuis le plus haut. Un prix lu à ce niveau prime toujours.
 * @param {object} v case relevée (lvl, next, cost, secs, seen)
 * @param {number} niveau niveau visé
 * @returns {{cost:number[], src:'lu'|'estimé', at?:number}|null} `at` : heure de lecture d'un prix lu ;
 *   null quand rien ne permet de chiffrer
 */
function lfCost(v, niveau){
  const n = Math.floor(+niveau);
  if(!v || !(n >= 1)) return null;
  if(lfPriced(v) && v.next === n) return {cost: lfClampCost(v.cost), src:'lu', at:(v.seenAt || {})[n]};
  const seen = v.seen || {};
  const nv = Object.keys(seen).map(Number).filter(k=>Number.isInteger(k) && k >= 1 && k <= LF_LVL_MAX).sort((a,b)=>a-b);
  if(seen[n] && lfClampCost(seen[n]).some(x=>x>0)) return {cost: lfClampCost(seen[n]), src:'lu', at:(v.seenAt || {})[n]};
  if(nv.length < 2) return null;
  const n1 = nv[nv.length-2], n2 = nv[nv.length-1];
  const c1 = lfClampCost(seen[n1]), c2 = lfClampCost(seen[n2]);
  const j = [0,1,2].find(i=>c1[i] > 0 && c2[i] > 0);
  if(j === undefined) return null;
  const f = Math.pow(c2[j]/c1[j], 1/(n2-n1));
  if(!(f >= 1 && f <= LF_FACTOR_MAX)) return null;
  const raw = c2.map(x=>Math.round(x * Math.pow(f, n-n2)));
  return raw.every(x=>Number.isFinite(x) && x <= LF_COST_MAX) ? {cost: raw, src:'estimé'} : null;
}

const LF_RES_NOM = ['métal', 'cristal', 'deutérium'];
/**
 * Cases de forme de vie proposables sur une planète : celles qui augmentent une
 * production d'abord, la moins chère ensuite.
 * Une case n'est proposable que si le jeu l'a dite constructible ET qu'on sait
 * en chiffrer le prochain niveau, lu ou estimé (`src`), avec une durée connue :
 * sans cela, on ne sait pas quand elle sera payable. À prix égal, le prix lu
 * passe devant l'estimé.
 * @param {object} p planète simulée
 * @param {string} queue lfbuilding | lfresearch
 * @returns {object[]} candidats triés
 */
function lfCandidates(p, queue){
  const libres = Object.entries(p.lf || {}).filter(([id,v]) => lfQueue(id) === queue && v && v.state !== 'locked');
  const out = libres.flatMap(([id,v]) => {
    const next = (v.lvl||0) + 1, c = lfCost(v, next);
    if(!c || !(v.secs > 0)) return [];
    return [{id:+id, cost:c.cost, src:c.src, at:c.at, secs:v.secs, next,
      eff: [0,1,2].includes(v.eff) ? v.eff : null,
      nom: v.nom || v.name || LF_NAMES[id] || 'Forme de vie'}];
  /* Une case qui produit passe devant, quel que soit son prix : son gain porte
     sur toutes les planètes et dure toute la partie, quand une case qui ne
     produit rien ne rembourse jamais. Le prix ne départage plus qu'à effet
     égal. */
  }).sort((a,b)=>(a.eff===null)-(b.eff===null) || mse(...a.cost)-mse(...b.cost) || (a.src==='lu' ? 0 : 1)-(b.src==='lu' ? 0 : 1));
  const n = out.length, u = libres.length - n;
  const reste = (u ? ` ${u} case${u>1?'s':''} pas encore chiffrée${u>1?'s':''}, non comparée${u>1?'s':''} : ouvre-${u>1?'les':'la'} dans le jeu.` : '');
  const moinsChere = `La moins chère des ${n} case${n>1?'s':''} chiffrée${n>1?'s':''} de cette file.`;
  return out.map(c => Object.assign(c, {why: (c.eff === null ? moinsChere
    : `Augmente la production de ${LF_RES_NOM[c.eff]} sur toutes les planètes : elle passe devant les cases qui ne produisent rien.`) + reste}));
}
/* Identifiants de tuile du jeu, dans l'autre sens : le plan raisonne en clés
   (« metal »), la page du jeu en numéros (« 1 »). */
const BUILD_ID = Object.fromEntries(Object.entries(OG_BUILD).map(([id,k])=>[k,id]));
const TECH_ID = Object.fromEntries(Object.entries(OG_TECH).map(([id,k])=>[k,id]));

/**
 * Traduit les actions du plan en indices à surligner dans la page du jeu.
 * Rangés par planète du jeu, puis par identifiant de tuile, la valeur étant
 * le niveau visé — la page du jeu décide comment l'écrire. Une action sans
 * tuile — une expédition, un rapatriement — n'en produit aucun, et une
 * planète que le jeu ne nous a pas encore nommée non plus : surligner au
 * hasard serait pire que ne rien surligner.
 * @param {object[]} acts actions de la session en cours
 * @returns {object} { [planetId]: { [technologyId]: niveau visé } }
 */
function planHints(acts){
  const out = {};
  const put = (p, tech, lvl)=>{
    const gid = p && p.gid;
    if(!gid || !tech || !lvl) return;
    (out[gid] = out[gid] || {})[tech] = lvl;
  };
  for(const a of acts || []){
    const p = S.planets[a.p];
    if(a.kind === 'b') put(p, BUILD_ID[a.k], a.lvl);
    else if(a.kind === 't') put(p, TECH_ID[a.k], a.lvl);
    else if(a.kind === 'lf') put(p, a.id, a.lvl);
  }
  return out;
}
/**
 * Ce que la page du jeu doit savoir des autres planètes pour proposer une
 * tournée : leur nom, le niveau de chaque tuile, le prix du niveau suivant, la
 * fin de leur file et leur stock. Rangé par planète du jeu, comme les indices :
 * une planète que le jeu n'a pas encore nommée n'a pas d'identifiant à mettre
 * dans un lien, donc elle n'est pas d'une tournée.
 * La fin de file est publiée telle quelle, passée ou non : c'est la page qui la
 * compare à l'instant où le joueur la regarde.
 * @returns {object} { [planetId]: { n, b, cost, bq, lfq, st } }
 */
function tourData(){
  const out = {};
  const fin = (p, q) => (S.timers || []).reduce((a,t)=> t.queue===q && t.pid===p.id && !t.done && t.end>a ? t.end : a, 0);
  for(const p of S.planets){
    // même garde que pour les relevés de production : « __proto__ » & co ne
    // sont jamais une planète du jeu
    if(!/^\d+$/.test(String(p.gid || ''))) continue;
    const b = {}, cost = {};
    /* Le jeu nomme toutes les planètes dès la première page lue, mais ne dit
       les niveaux que de celle qu'on regarde : les autres sont à zéro par
       défaut. Publier ce zéro enverrait monter ce qui est peut-être au niveau
       huit. Tant que rien n'a été lu ni saisi, cette planète n'a pas de niveau
       à donner — la page sait le dire. */
    if(!p.bNeuve) for(const k of Object.keys(B)){
      const id = BUILD_ID[k];
      if(!id) continue; // une clé de B sans tuile du jeu : rien à montrer
      b[id] = p.b[k] || 0;
      cost[id] = levelCost(B[k], b[id] + 1);
    }
    for(const [id, v] of Object.entries(p.lf || {})){
      const lvl = (v && v.lvl) || 0;
      b[id] = lvl;
      /* Un prix de forme de vie ne s'invente pas : il se lit sur le jeu. Un
         prix estimé reste au panneau, qui l'étiquette — une pastille qui
         grise sur une estimation ferait manquer ce qui ne manque pas. */
      const c = lfCost(v, lvl + 1);
      if(c && c.src === 'lu') cost[id] = c.cost;
    }
    out[p.gid] = {n: planetRef(p), b, cost, bq: fin(p, 'building'), lfq: fin(p, 'lfbuilding'),
                  lfr: fin(p, 'lfresearch'), at: Date.now(),
                  st: stockNow(p).map(x=>Math.round(x))};
  }
  return out;
}
/**
 * Qui peut livrer cette planète, et en combien de temps. La production locale
 * n'est pas la seule sortie : une autre planète qui a déjà le stock et des
 * transporteurs arrive souvent avant, et une livraison ignore le hangar.
 * Le temps de vol ne dépend que du vaisseau le plus lent, donc deux durées
 * suffisent — la page choisit la flotte selon ce qui manque.
 * Une mission part toujours de là où sont les vaisseaux : la colonie qui a le
 * stock n'a presque jamais de transporteur à quai, et il faut d'abord les y
 * amener à vide. C'est le cas courant, pas l'exception, donc ce vol-là compte
 * dans la durée annoncée.
 * ponytail: les vaisseaux datent de la dernière visite de leur planète, et le
 * deutérium du vol n'est pas déduit ; ajouter si ça trompe à l'usage.
 * @returns {object} { [planetId destination]: [{n, st, lc, sc, sec, out, base, cp, vers, mission}] }
 */
function donorsOf(){
  const cargoOf = p => { const sh = p.ships || {}; return (sh.lc||0)*25000 + (sh.sc||0)*5000; };
  const base = S.planets.reduce((a,p)=>(cargoOf(p) > (a ? cargoOf(a) : 0) ? p : a), null);
  if(!base || !base.coords || !cargoOf(base)) return {};
  const out = {};
  for(const dst of S.planets){
    if(!dst.gid || !dst.coords) continue;
    const list = [];
    for(const src of S.planets){
      if(src === dst || !src.coords) continue;
      const sh = src.ships || {}, own = (sh.lc||0) + (sh.sc||0) > 0;
      const from = own ? src : base;
      if(from === src && !own) continue;
      const f = from.ships || {};
      const vol = (a, b, k) => { const x = flight(a, b, {[k]:1}, 100); return x ? x.secs : 0; };
      // `cp` et la destination décrivent le premier trajet à faire : la
      // livraison elle-même quand les vaisseaux sont déjà sur place, sinon
      // l'aller à vide qui les y amène. Le jeu remplit son formulaire à
      // partir de là ; le second trajet se lance depuis la planète donneuse,
      // une fois les vaisseaux posés.
      list.push({n:src.name, st:stockNow(src).map(Math.floor), lc:f.lc||0, sc:f.sc||0,
        sec:[vol(src.coords, dst.coords, 'lc'), vol(src.coords, dst.coords, 'sc')],
        out:own ? [0,0] : [vol(from.coords, src.coords, 'lc'), vol(from.coords, src.coords, 'sc')],
        base:own ? null : from.name,
        cp:from.gid || null, vers:own ? dst.coords : src.coords, mission:own ? 3 : 4});
    }
    if(list.length) out[dst.gid] = list;
  }
  return out;
}
/**
 * Ce que la page du jeu doit afficher de notre part : les repères, les débits
 * de chaque planète, de quoi annoncer une livraison, et si le joueur a demandé
 * qu'on allège sa mise en page.
 * @param {object[]} acts actions de la session en cours
 * @returns {object} charge utile pour le script de page
 */
/**
 * Ce que le copilote a à dire sur chaque page du jeu, rangé par composant.
 * Le panneau est déjà à côté du joueur : répéter ses minuteurs et ses alertes
 * en bas de page ne lui apprend rien. Ce qu'il ne peut pas dire, c'est ce qui
 * se fait **ici**, sur la page ouverte — et c'est ce que la bande porte.
 * Le rangement se lit dans les liens que le plan produit déjà : une action qui
 * ouvre `component=defenses` est une action de la page Défense. Rien à tenir à
 * jour quand une action nouvelle apparaît.
 * Ce que le plan ne peut pas encore payer compte autant que ce qu'il lance :
 * un empire dont rien n'est payable n'a aucune action lançable, et la bande
 * serait vide partout. Ces lignes-là se grisent et portent leur date.
 * @param {object[]} acts actions de la session en cours
 * @param {object[]} [missions] missions du jour restantes
 * @param {object[]} [waits] ce que le plan attend faute de ressources
 * @returns {object} { pages: { [composant]: [{what, ou, quand, why, url, gris}] } }
 */
function bandData(acts, missions, waits){
  const pages = {};
  const pose = (url, what, ou, why, quand, gris) => {
    const c = /[?&]component=([a-z]+)/.exec(url || '');
    if(!c || !what) return;
    const l = pages[c[1]] = pages[c[1]] || [];
    // quatre lignes au plus : au-delà, la bande redevient une liste à lire
    if(l.length < 4) l.push({what, ou: ou || '', quand: quand || '', why: why || '', url,
      gris: !!gris, pc: ou ? planetHue(ou) : null});
  };
  const RES_B = ['métal', 'cristal', 'deutérium'];
  const manque = w => (w.miss || []).map((x,j)=>x>0 ? `${fmt(Math.ceil(x))} ${RES_B[j]}` : '').filter(Boolean).join(' · ');
  // le lançable d'abord, l'attendu ensuite : c'est l'ordre dans lequel on agit
  for(const a of acts || []) pose(actGo(a), a.what, (a.q || '').split(' · ')[1], a.why);
  for(const m of (missions || []).filter(x=>!x.info)) pose(missionGo(m), m.what, (m.tags || [])[0], m.why);
  for(const w of waits || []){
    const m = manque(w);
    pose(actGo(w), w.what, (w.q || '').split(' · ')[1], m ? 'Il manque ' + m : '',
      isFinite(w.eta) ? 'vers ' + hm(Date.now() + w.eta*1000) : 'à faire livrer', true);
  }
  return {pages};
}
/* La surcouche entière se recalcule avec le plan, sur Aujourd'hui. Mais deux
   réglages ne changent que l'allure de la page du jeu : les attendre là-bas
   laissait croire qu'ils ne marchaient pas. On republie donc ces deux champs
   seuls, sans toucher au reste de ce que la page a déjà. */
function pushLook(){
  if(!IS_EXT) return;
  try{ chrome.storage.local.get('skin', v => chrome.storage.local.set({
    skin: Object.assign({}, (v && v.skin) || {}, {lean: !!S.settings.lean, noshop: !!S.settings.noshop, large: !!S.settings.large,
      peau: !!S.settings.peau, clair: !!S.settings.clair})
  })); }catch(e){}
}
/* Ce que le panneau sait, mis à plat pour la colonne de droite de la page :
   les mêmes lignes qu'Aujourd'hui, sans leur mise en page. La bande, elle,
   range par page ; ici on garde l'ordre du plan — le lançable d'abord. */
function colonneData(acts, missions, waits){
  const l = [];
  const RES_B = ['métal', 'cristal', 'deutérium'];
  const manque = w => (w.miss || []).map((x,j)=>x>0 ? `${fmt(Math.ceil(x))} ${RES_B[j]}` : '').filter(Boolean).join(' · ');
  const pose = (url, what, ou, why, quand, gris) => {
    // douze lignes au plus : au-delà, la colonne redevient une liste à lire
    if(!what || l.length >= 12) return;
    l.push({what, ou: ou || '', quand: quand || '', why: why || '', url: url || '',
      gris: !!gris, pc: ou ? planetHue(ou) : null});
  };
  for(const a of acts || []) pose(actGo(a), a.what, (a.q || '').split(' · ')[1], a.why);
  for(const m of (missions || []).filter(x=>!x.info)) pose(missionGo(m), m.what, (m.tags || [])[0], m.why);
  for(const w of waits || []){
    const m = manque(w);
    pose(actGo(w), w.what, (w.q || '').split(' · ')[1], m ? 'Il manque ' + m : '',
      isFinite(w.eta) ? 'vers ' + hm(Date.now() + w.eta*1000) : 'à faire livrer', true);
  }
  return l;
}
function gameSkin(acts, missions, waits){
  // Les débits suivent les indices : la page du jeu sait lire un coût et un
  // stock, mais pas à quelle vitesse une planète produit.
  const rates = {};
  for(const p of S.planets){ if(!p.gid) continue; const pr = production(p); rates[p.gid] = [pr.m, pr.c, pr.d]; }
  /* Le nom de chaque planète et sa teinte : une action nomme souvent ses
     planètes dans sa phrase — « Ramène 34 grands transporteurs de Tarpin land
     vers Caribou Land » — et la page doit pouvoir les y reconnaître. */
  const teintes = {};
  for(const [i, p] of S.planets.entries()){
    const c = i % PLANET_COLORS;
    if(p.name) teintes[p.name] = c;
    teintes[planetRef(p)] = c;
  }
  return {hints: planHints(acts), rates, donors: donorsOf(), tour: tourData(), teintes,
          band: bandData(acts, missions, waits),
          colonne: colonneData(acts, missions, waits),
          cargo: [shipStats('lc').cargoEff, shipStats('sc').cargoEff],
          lean: !!S.settings.lean, noshop: !!S.settings.noshop, large: !!S.settings.large,
          peau: !!S.settings.peau, clair: !!S.settings.clair};
}
/* Le centre d'abord : une recherche se lance depuis une planète, et c'est son
   labo à elle qui en fixe la durée et les prérequis. Sans centre — joueur de
   flotte, planète unique — on retombe sur le plus haut labo de l'empire,
   c'est-à-dire sur le comportement d'avant. */
function labPlanet(){ return centrePlanet() || S.planets.reduce((a,p)=>(!a || p.b.lab>a.b.lab) ? p : a, null); }
/* Le labo du centre, et non plus le maximum de l'empire : les deux
   coïncidaient tant que le centre était par construction la planète du plus
   haut labo, et ils divergent dès que le joueur reprend la main. Annoncer le
   maximum ferait promettre une durée que le jeu ne tiendra pas, et lancer une
   recherche depuis un labo trop petit. */
function labLevel(){ const p = labPlanet(); return p ? (p.b.lab || 0) : 0; }
/** Research time in seconds. */
function researchTime(key, L){
  const c = levelCost(T[key], L);
  let h = (c[0]+c[1]) / (1000 * (1+labLevel()) * S.settings.eco);
  if(S.settings.cls==='explorer') h *= .75;
  return Math.max(1, h*3600);
}
function storageCap(L){ return 5000*Math.floor(2.5*Math.exp(20*L/33)); }
/**
 * Plus petit niveau de hangar dont la capacité couvre `amount`. Un hangar trop
 * petit n'interdit pas la dépense : les ressources livrées par transport
 * dépassent la capacité, seule la production locale s'arrête au plafond. Ce
 * niveau est donc une option — l'autre étant de caler la livraison juste avant.
 * @param {number} amount montant à loger
 * @returns {number} niveau de hangar
 */
function storageLevelFor(amount){ let L = 0; while(L < 40 && storageCap(L) < amount) L++; return L; }
/**
 * Lit le texte du panneau « Paramétrage de la production » publié par content.js.
 * Le texte vient de la page : tout nombre qui pourrait borner une boucle ou
 * dimensionner quoi que ce soit est borné ici (comptes à 1e6, niveaux à 999).
 * @param {string} text texte brut du panneau, une ligne par rangée, cellules séparées par des tabulations
 * @returns {object|null} la forme de S.prod[gid] (sans `at`), ou null si « Total par heure » est absent
 */
function parseProdPanel(text){
  if(typeof text !== 'string' || text.length > 20000) return null;
  const clamp = (n, hi) => Math.max(0, Math.min(hi, n));
  // « 37.297 » → 37297, « -1.554 » → -1554 ; « 2M » (troncature du jeu) et tout le reste → null
  const num = c => /^-?\d{1,3}(\.\d{3})*$|^-?\d{1,12}$/.test(c || '') ? +c.replace(/\./g, '') : null;
  const out = {at:0, factor:1, base:[0,0,0], lfBonus:[0,0,0,0], caps:[null,null,null], crawlerMax:0, energy:null, rows:[]};
  const fm = text.match(/Facteur de production\s*:\s*(\d{1,4})\s*%/i);
  if(fm) out.factor = clamp(+fm[1] / 100, 10);
  for(const line of text.split('\n').slice(0, 200)){
    const cells = line.split(/\t|\s{2,}/).map(c => c.trim()).filter(Boolean);
    if(cells.length < 2) continue;
    const label = cells[0], v = cells.slice(1, 5).map(num);
    if(/^Total par heure/i.test(label)){
      const em = (cells[4] || '').match(/^(-?[\d.]+)\/([\d.]+)$/);
      if(em) out.energy = {free:num(em[1]), prod:num(em[2])};
      out.total = true;
    }else if(/^Revenu de base/i.test(label)) out.base = v.slice(0, 3).map(x => x || 0);
    else if(/^Bonus technologique/i.test(label)) out.lfBonus = v.map(x => x || 0);
    else if(/^Capacit/i.test(label)) out.caps = v.slice(0, 3);
    else{
      const lv = label.match(/\(Niveau\s*(\d{1,4})\)/i), nb = label.match(/\(Nombre\s*:\s*(\d{1,9})(?:\s*\/\s*(\d{1,9}))?\)/i);
      const pct = (cells[5] || '').match(/^(\d{1,4})\s*%$/);
      const max = nb && nb[2] != null ? clamp(+nb[2], 1e6) : null;
      if(/^Foreuse/i.test(label) && max != null) out.crawlerMax = max;
      out.rows.push({label, lvl: lv ? clamp(+lv[1], 999) : null, n: nb ? clamp(+nb[1], 1e6) : null, max,
        v: v.map(x => x == null ? 0 : x), pct: pct ? clamp(+pct[1], 1000) : null});
    }
  }
  if(!out.total || !out.energy) return null;
  delete out.total;
  return out;
}

/**
 * Relevé du panneau de production d'une planète, clé stricte sur son gid.
 * @param {object} p planète de S.planets
 * @returns {object|undefined} undefined si cette planète n'a jamais ouvert le panneau
 */
function prodOf(p){
  const k = p && p.gid;
  return k && S.prod && Object.prototype.hasOwnProperty.call(S.prod, k) ? S.prod[k] : undefined;
}

/**
 * Foreuses utiles sur une planète : huit par niveau de mine cumulé. Au-delà,
 * une foreuse de plus ne rapporte rien.
 * @returns {number}
 */
function crawlerMax(metal, crystal, deut){ return 8*(metal+crystal+deut); }
/**
 * Bonus de production des foreuses, en fraction de la production de base :
 * +0,02 % par foreuse, ×1,5 pour un Collectionneur, ×1,5 encore en surcharge
 * à 150 % (énergie doublée), plafonné à 50 %.
 * @returns {number}
 */
function crawlerBonus(n, cls, overload){
  return Math.min(Math.max(0, n)*0.0002*(cls==='collector'?1.5:1)*(overload?1.5:1), 0.5);
}
const CRAWLER_COST = [2000, 2000, 1000];
const CRAWLER_ENERGY = 50;

/**
 * Bonus de forme de vie lu dans le panneau de production, tel que le jeu l'affiche :
 * un montant horaire fixe [m, c, d, énergie]. Rien si la lecture manque ou a plus
 * de sept jours ; chaque valeur est ramenée à un nombre fini et positif.
 * @param {object} p planète de S.planets
 * @returns {number[]|null}
 */
function lfBonusOf(p){
  const r = prodOf(p);
  if(!r || !Array.isArray(r.lfBonus) || !(Date.now() - r.at < LF_READ_TTL)) return null;
  return [0,1,2,3].map(i => { const v = Number(r.lfBonus[i]); return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1e9) : 0; });
}

/* Les trois mines, avec le coefficient d'énergie du jeu : dix par niveau pour
   le métal et le cristal, vingt pour le deutérium. */
const MINES_PCT = [[/^Mine de métal/i, 10], [/^Mine de cristal/i, 10], [/^Synthétiseur de deut/i, 20]];
/**
 * Mines bridées à la main dans le jeu, d'après le dernier relevé du panneau de
 * production : le pourcentage le plus bas, et l'énergie qu'il faudrait en plus
 * pour les remettre toutes à 100 %. Cette énergie est l'écart entre la
 * consommation pleine d'une mine (10 ou 20 × N × 1,1^N) et celle que sa ligne
 * affiche, bridage compris.
 * @param {object} p planète de S.planets
 * @returns {{min:number, extra:number}|null} null sans relevé récent ou si rien n'est bridé
 *
 * ponytail: le bridage sert à avertir, pas à chiffrer : production() compte
 * toujours les mines à 100 %, donc les débits annoncés sont optimistes tant
 * qu'elles sont bridées. À brancher sur production() si le bridage dure.
 */
function bridage(p){
  const r = prodOf(p);
  if(!r || !(Date.now() - r.at < LF_READ_TTL)) return null;
  let min = 100, extra = 0;
  for(const row of r.rows || []){
    const coef = (MINES_PCT.find(x => x[0].test(row.label)) || [])[1];
    const e = Number((row.v || [])[3]);
    // e est la consommation affichée, négative ; une ligne sans colonne énergie
    // lisible ne dit rien du bridage et ne compte pas.
    if(coef == null || row.lvl == null || !(row.pct < 100) || !Number.isFinite(e) || e > 0) continue;
    min = Math.min(min, row.pct);
    extra += Math.max(0, Math.ceil(coef*row.lvl*Math.pow(1.1, row.lvl)) + e);
  }
  return min < 100 ? {min, extra} : null;
}

/** Hourly production and energy balance for a planet, with optional level overrides. */
function production(p, ov){
  const b = Object.assign({}, p.b, ov||{}), s=S.settings, e=S.settings.eco, t=S.tech;
  const g = L => L*Math.pow(1.1,L);
  /* Une foreuse produit et consomme comme une mine : elle entre dans le même
     bilan, sinon son bonus serait gratuit et le classement la mettrait en tête
     pour de mauvaises raisons. */
  const nCraw = Math.min(Math.max(0, (ov && ov.crawlers != null) ? ov.crawlers : (p.crawlers||0)),
                         crawlerMax(b.metal, b.crystal, b.deut));
  const surcharge = p.overload != null ? p.overload : !!s.crawlerOverload;
  const craw = crawlerBonus(nCraw, s.cls, surcharge);
  let eProd = Math.floor(20*g(b.solar)) + Math.floor(30*b.fusion*Math.pow(1.05+0.01*t.energy, b.fusion)) + p.sats*Math.max(1,Math.floor(p.tmax/4+20));
  let eBonus = 1 + (s.cls==='collector'?.1:0) + (s.eng?.1:0);
  eProd = Math.floor(eProd*eBonus) + (p.eAdj||0);
  const lf = lfBonusOf(p) || [0,0,0,0];
  eProd += Math.floor(lf[3]);
  const eCons = Math.ceil(10*g(b.metal)) + Math.ceil(10*g(b.crystal)) + Math.ceil(20*g(b.deut)) + nCraw*CRAWLER_ENERGY*(surcharge?2:1);
  const factor = eCons===0 ? 1 : Math.max(0, Math.min(1, eProd/eCons));
  const common = (s.cls==='collector'?.25:0) + (s.geo?.1:0) + craw;
  const pos = (parseC(p.coords)||[])[2]||0, posM = POS_BONUS_M[pos]||0, posC = POS_BONUS_C[pos]||0;
  const m = 30*e + 30*g(b.metal)*e*factor*(1 + .01*t.plasma + common + posM) + lf[0];
  const c = 15*e + 20*g(b.crystal)*e*factor*(1 + .0066*t.plasma + common + posC) + lf[1];
  const dRaw = 10*g(b.deut)*(1.44 - .004*p.tmax)*e*factor*(1 + .0033*t.plasma + common);
  const dFus = 10*g(b.fusion)*e;
  return {m, c, d:dRaw - dFus + lf[2], eProd, eCons, eBal:eProd-eCons, factor,
          cap:[storageCap(b.smetal), storageCap(b.scrystal), storageCap(b.sdeut)]};
}
function mse(m,c,d){ const r=S.settings.ratio; return m + c*r[0]/r[1] + d*r[0]/r[2]; }

/* ---------- la vocation d'une planète ---------- */
/* Ce que le sol d'une planète lui donne de mieux ne se choisit pas : il se
   lit. Et il ne se lit qu'en comparant les planètes entre elles. Comparer les
   trois ressources d'une même planète ne dirait rien d'utile — au taux 3:2:1
   le deutérium l'emporte presque partout, et les quinze planètes seraient
   « deutérium ». Ce que le joueur cherche est une place dans son empire : LA
   planète à cristal. */
/* Niveau commun des trois mines pour la lecture de terrain. La valeur n'a pas
   d'importance tant qu'elle est la même partout et qu'elle n'est pas nulle :
   à zéro, les trois taux de deutérium valent zéro et il n'y a plus rien à
   classer. */
const TERRAIN_LVL = 20;
/**
 * Ce que le sol d'une planète donne, à niveaux égaux et sans bridage.
 * Tout ce qui n'est pas le sol est neutralisé : la centrale de fusion, dont la
 * consommation est retranchée du deutérium et qui se construit ; les foreuses
 * et les satellites, qui se construisent aussi ; et le bonus de forme de vie,
 * un forfait lu sur le jeu qui périme au bout de sept jours — le laisser
 * entrer ferait changer une vocation toute seule le jour de la péremption.
 * Il sort en privant la copie de son `gid`, la clé par laquelle `prodOf` le
 * retrouve.
 * @param {object} p planète
 * @returns {{m:number, c:number, d:number}|null} null quand les coordonnées ne
 *   se lisent pas : l'inconnu se dit, il ne se devine pas.
 */
function terrainRates(p){
  if(!p || !parseC(p.coords)) return null;
  const nu = Object.assign({}, p, {gid:null, crawlers:0, sats:0, eAdj:0});
  const ov = {metal:TERRAIN_LVL, crystal:TERRAIN_LVL, deut:TERRAIN_LVL, fusion:0, crawlers:0, solar:p.b.solar};
  /* Assez de centrales pour que rien ne soit bridé : un terrain se mesure à
     plein régime, sinon il dirait l'énergie posée plutôt que le sol. Même
     boucle bornée que rankUpgrades. */
  let pr = production(nu, ov), garde = 0;
  while(pr.factor < 1 && garde++ < 200){ ov.solar++; pr = production(nu, ov); }
  return {m:pr.m, c:pr.c, d:pr.d};
}
const VOC_KEYS = ['metal', 'crystal', 'deut'];
const VOC_RATE = {metal:'m', crystal:'c', deut:'d'};
const VOC_NOM = {metal:'Métal', crystal:'Cristal', deut:'Deutérium'};
/** La raison d'une vocation, en clair. Une vocation sans raison ne se conteste
    pas, donc ne se croit pas — et une raison doit rester vraie : pas de compte
    de planètes, qui laisserait dehors celles dont on ne sait rien, et pas de
    superlatif pour une seule quand deux le partagent.
    @param {object} p la planète
    @param {string} k la ressource
    @param {object[]} tenants toutes les planètes premières sur cette ressource */
function vocWhy(p, k, tenants){
  const pos = (parseC(p.coords) || [])[2] || 0;
  if(k === 'deut'){
    const autres = tenants.filter(x => x !== p);
    return `${p.tmax} °C, la plus froide de ton empire`
      + (autres.length ? ` à égalité avec ${autres.map(planetRef).join(', ')}` : '');
  }
  const b = (k === 'metal' ? POS_BONUS_M : POS_BONUS_C)[pos] || 0;
  return b ? `position ${pos}, +${Math.round(b*100)} % de ${k === 'metal' ? 'métal' : 'cristal'}`
           : `position ${pos}`;
}
/**
 * Quelle planète est première de l'empire sur quelle ressource.
 * Une ressource sur laquelle toutes les planètes se valent ne donne de
 * vocation à personne : rien ne les distingue, et en désigner une au hasard
 * donnerait une raison fausse. Une planète peut n'être première nulle part, ou
 * première sur deux ressources — les deux sont des informations vraies. Un
 * empire d'une seule planète comparable n'a rien à comparer.
 * @returns {object} par id de planète : {keys:string[], why:string}
 */
function vocations(){
  const out = {}, lus = [];
  for(const p of S.planets){
    const r = terrainRates(p);
    if(r) lus.push({p, r});
    else out[p.id] = {keys:[], why:'vocation inconnue'};
  }
  if(lus.length < 2) return out;
  const tenants = {};
  for(const k of VOC_KEYS){
    const f = VOC_RATE[k], vals = lus.map(x => x.r[f]);
    const max = Math.max(...vals), min = Math.min(...vals);
    /* Pas de dispersion, pas de vocation : POS_BONUS_C ne couvre que les
       positions 1 à 3, donc un empire sans planète en 1, 2 ou 3 n'a pas de
       planète à cristal, et le copilote le dit au lieu d'en sacrer une. */
    if(!(max - min > Math.abs(max)*1e-9)) continue;
    tenants[k] = lus.filter(x => x.r[f] === max).map(x => x.p);
    for(const q of tenants[k]) (out[q.id] || (out[q.id] = {keys:[], why:''})).keys.push(k);
  }
  for(const x of lus){
    const e = out[x.p.id];
    if(e) e.why = e.keys.map(k => vocWhy(x.p, k, tenants[k])).join(' · ');
  }
  return out;
}
function stockNow(p){
  const pr = production(p), h = (Date.now()-p.stock.at)/36e5;
  return [Math.min(Math.max(p.stock.m, pr.cap[0]), p.stock.m + pr.m*h),
          Math.min(Math.max(p.stock.c, pr.cap[1]), p.stock.c + pr.c*h),
          Math.min(Math.max(p.stock.d, pr.cap[2]), p.stock.d + pr.d*h)];
}
/**
 * Délai avant que `cost` soit payable sur la planète p.
 * Un coût plus grand qu'un hangar n'est pas impossible : la production locale
 * s'y arrête, pas une livraison. `small` nomme alors les deux sorties — le
 * niveau de hangar qui logerait le montant, ou un transport calé juste avant.
 * @returns {{sec:number, storage?:number, small?:object[]}}
 */
function waitFor(p, cost){
  const st = stockNow(p), pr = production(p), rates=[pr.m,pr.c,pr.d], sk=['smetal','scrystal','sdeut'];
  let w = 0; const small = [];
  for(let i=0;i<3;i++){
    if(cost[i] > pr.cap[i]) small.push({res:i, k:sk[i], lvl:storageLevelFor(cost[i])});
    const miss = cost[i]-st[i];
    if(miss>0) w = Math.max(w, rates[i]>0 ? miss/rates[i]*3600 : Infinity);
  }
  return small.length ? {sec:Infinity, storage:small[0].res, small} : {sec:w};
}
/** Les hangars à atteindre, nommés : « Hangar C 5 ». */
function storageShort(w){ return (w.small||[]).map(x=>`${B_SHORT[x.k]} ${x.lvl}`).join(' et '); }
/** La phrase complète, avec l'autre sortie. */
function storageNote(w){
  const l = storageShort(w);
  return l ? `Hangar trop petit : ${l}, ou fais arriver le transport juste avant de lancer — une livraison n'est pas plafonnée.`
           : 'Hangar trop petit pour ce coût.';
}
function reqOk(req, p){
  const miss=[];
  if(!req) return miss;
  if(req.lab && labLevel()<req.lab) miss.push(`Labo ${req.lab}`);
  if(req.b) for(const [k,v] of Object.entries(req.b)) if(!p || p.b[k]<v) miss.push(`${B_SHORT[k]} ${v}`);
  if(req.t) for(const [k,v] of Object.entries(req.t)) if(S.tech[k]<v) miss.push(`${T[k].n.replace('Technologie ','')} ${v}`);
  return miss;
}

/** Le libellé d'une option du classement : une mine a un niveau, les foreuses un nombre. */
function upLabel(u){ return u.key==='crawl' ? `${u.n} foreuse${u.n>1?'s':''} (${u.lvl} en tout)` : `${B_SHORT[u.key]} ${u.lvl}`; }
/** Ranks next building upgrades and crawlers on a planet by payback time. */
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
  /* Les foreuses sont une dépense productive comme une autre : elles se classent
     par amortissement, à côté des mines. Aujourd'hui loin derrière ; elles
     passeront devant quand un niveau de mine coûtera assez cher. */
  const cmax = crawlerMax(p.b.metal, p.b.crystal, p.b.deut), have = p.crawlers||0;
  if(have < cmax && shipReqOk('crawl', p)){
    const n = Math.max(1, Math.min(cmax-have, Math.ceil(cmax/10)));
    // Cinquante d'énergie par foreuse : comme pour une mine, la centrale qu'elles
    // obligent à monter fait partie de leur prix.
    const ov = {crawlers:have+n}; let cost = CRAWLER_COST.map(x=>x*n), extra = 0;
    let pr = production(p, ov);
    while(pr.factor<1 && extra<15){ extra++; ov.solar = p.b.solar+extra; const sc=levelCost(B.solar, p.b.solar+extra); cost=cost.map((x,i)=>x+sc[i]); pr=production(p,ov); }
    const gain = mse(pr.m,pr.c,pr.d)-baseV;
    out.push({key:'crawl', n, lvl:have+n, extraSolar:extra, cost, gain,
              payback: gain>0 ? mse(...cost)/gain : Infinity, time:shipTime('crawl', n, p)});
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
/**
 * Ce qu'une flotte peut vraiment emporter : le carburant voyage dans la soute,
 * donc il en sort. Sans ça le copilote annonce un butin, une mise à l'abri ou
 * un kit de colonie que la flotte ne peut pas charger.
 * @param {number} cargo soute brute
 * @param {number} fuel plein du trajet, aller-retour compris quand il y en a un
 * @returns {number}
 */
const souteUtile = (cargo, fuel) => Math.max(0, cargo - fuel);
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
  const fuel = Math.round(cons)+1;
  return {D, V, secs:Math.round(secs), fuel, cargo:souteUtile(list.reduce((x,s)=>x+s.n*s.cargoEff,0), fuel), slowest:SHIPS[list.find(s=>s.speedEff===V).k].n};
}

/* ---------- views ---------- */
const view = document.getElementById('view');
let tab = 'today';
/* Un panneau latéral est étroit : tout déplié, Aujourd'hui se lit en trois
   écrans de défilement. Les sections qui ne servent pas à chaque passage se
   replient donc, et se souviennent : le panneau se redessine à chaque plan, et
   une section rouverte à chaque dessin ne resterait jamais fermée. L'état vit
   dans S.ui.fold, par nom, pas par rang — l'ordre des sections change. */
function fold(name, def){
  const v = (S.ui.fold||{})[name];
  return (v==null ? def : v) ? ' open' : '';
}
try{ tab = LS.getItem(KEY+'-tab') || 'today'; }catch(e){}
if(!['today','empire','tools','settings'].includes(tab)) tab='today';

function header(){
  const s=S.settings;
  document.getElementById('uniBadge').textContent = `${S.syncAt ? 'synchro ' + new Date(S.syncAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) + ' · ' : 'en attente du jeu · '}éco x${s.eco} · flotte x${s.fleet} · ${({collector:'Collecteur',general:'Général',explorer:'Explorateur',none:'Sans classe'})[s.cls]}`;
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.tab===tab)));
}
function render(){ prioClean(); header(); view.innerHTML = VIEWS[tab](); bind(); refresh(); }
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

/** Ce qui ne va pas sur une planète, maintenant, quoi que fassent ses files.
    Volontairement séparée de pickBuildings : celle-là choisit quoi construire
    et se tait dès qu'une file est occupée ou que des satellites arrivent, ce
    qui est juste pour choisir et faux pour avertir. */
function planetAlerts(p){
  const out = [], pr = production(p), st = stockNow(p), r = rankUpgrades(p);
  const where = S.planets.length>1 ? ` sur ${p.name}` : '';
  if(pr.factor<1){
    const best = r[0];
    out.push({sev:'bad', what:`Rétablir l'énergie${where}`, why:`Tes mines tournent à ${Math.round(pr.factor*100)} %. ${best ? `Le plus rentable : ${B_SHORT[best.key]} ${best.lvl}${best.extraSolar?` avec solaire ${p.b.solar+best.extraSolar}`:''}.` : 'Monte la centrale solaire.'}`});
  }
  if(pr.factor<1 && p.b.shipyard>=1 && !p.def)
    out.push({sev:'warn', what:`Satellites écartés${where}`, why:'Ils coûteraient moins cher que la centrale, mais un satellite part en débris au premier raid et l\'énergie retombe avec lui. Je n\'en propose que sur une planète défendue : ouvre une fois la page Défense pour que je voie la tienne, ou monte la centrale.'});
  /* Le jeu dit son énergie libre mines bridées ; le moteur les compte à 100 %.
     La marge est donc ce qui resterait une fois le bridage levé. */
  const br = bridage(p);
  if(br){
    const marge = Math.round(pr.eBal - br.extra);
    if(marge >= 0) out.push({sev:'good', what:`Remonter les mines à 100 %${where}`, why:`Tu les as bridées à ${br.min} %. L'énergie suffit de nouveau : il en resterait ${marge} de libre une fois les mines remontées.`});
    else if(pr.factor>=1) out.push({sev:'warn', what:`Mines bridées à ${br.min} %${where}`, why:`Il manque ${-marge} d'énergie pour les remonter à 100 %. Monte la centrale solaire, je te dirai quand les remonter.`});
  }
  ['m','c','d'].forEach((x,k)=>{
    const rate=[pr.m,pr.c,pr.d][k], name=['Hangar de métal','Hangar de cristal','Réservoir de deutérium'][k], bk=['smetal','scrystal','sdeut'][k];
    if(st[k]>=pr.cap[k]*0.98) out.push({sev:'bad', what:`${name} plein${where}`, why:`La production de ${['métal','cristal','deutérium'][k]} est arrêtée. Dépense ou monte ${name} ${p.b[bk]+1}.`});
    // Huit heures, et non l'intervalle de connexion : l'avertissement sert
    // à prévoir le hangar avant une longue absence, pas avant la prochaine
    // connexion. Le garde sur le débit évite une durée infinie.
    else if(rate>0 && (pr.cap[k]-st[k])/rate<8) out.push({sev:'warn', what:`${name} plein dans ${dur((pr.cap[k]-st[k])/rate*3600)}${where}`, why:`Prévois ${name} ${p.b[bk]+1} avant une longue absence.`});
  });
  return out;
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
  const b = S.planets.map(p=>`<optgroup label="Bâtiments · ${esc(p.name)}">${Object.keys(B).map(k=>`<option value="b:${p.id}:${k}">${B[k].n} ${p.b[k]+1}</option>`).join('')}</optgroup>`).join('');
  return `<optgroup label="Recherche">${r}</optgroup>${b}<optgroup label="Autre"><option value="x:fleet">Retour de flotte</option><option value="x:expo">Retour d'expédition</option><option value="x:other">Autre</option></optgroup>`;
}
function timerLabel(tm){
  if(tm.kind==='t') return `${T[tm.k].n} ${tm.lvl}`;
  if(tm.kind==='b'){ const p=planetById(tm.pid); return `${B[tm.k].n} ${tm.lvl}${p&&S.planets.length>1?` · ${p.name}`:''}`; }
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
  /* Un id muet — la planète n'a pas été appariée au dernier relevé : le
     minuteur sonne et prévient, mais rien ne se crédite. Un niveau à ressaisir
     se rattrape ; un niveau posé sur la voisine, non. */
  const cible = planetById(tm.pid);
  if(tm.kind==='x' && tm.k==='sats' && cible && !tm.game) cible.sats += tm.n||0;
  if(tm.kind==='x' && tm.k==='shipyard' && tm.ships && cible && !tm.game) addBuilt(cible, tm.ships);
  if(tm.kind==='b' && cible && cible.b[tm.k] < tm.lvl) cible.b[tm.k] = tm.lvl;
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
  /* Replié, le titre tient tout ce qu'on venait vérifier : combien tournent et
     lequel finit le premier. */
  const sum = document.getElementById('tmSum');
  if(sum){
    const fini = sorted.filter(t=>t.done).length, cours = sorted.filter(t=>!t.done);
    sum.textContent = fini ? `${fini} terminé${fini>1?'s':''}`
      : cours.length ? `${cours.length} en cours · le premier dans ${dur((cours[0].end-Date.now())/1000)}`
      : 'aucun';
  }
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
/* Un vaisseau déjà à quai est un fait et passe devant tout ; sinon la colonie
   part du centre, puisque c'est lui que le plan fait construire. Deux leviers
   se contredisaient : le plan sortait le vaisseau du centre et annonçait la
   durée de vol de la planète du select, cent systèmes plus loin. */
function coloFrom(){ const i = colShipAt(); return (i>=0 ? S.planets[i] : centrePlanet() || planetById(S.colo.fromId)) || S.planets[0]; }
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
/* Tant qu'on ignore le vaisseau, le trajet et les semaines de mines qu'il faut
   pour qu'une colonie produise, « amorti en moins d'un jour » est un slogan.
   Au-delà de cet horizon un niveau de mine n'est plus ce que la colonie a de
   plus pressé : elle commence à rendre ce qu'elle a coûté. */
const COLO_HORIZON_H = 7*24;
/**
 * Délai de retour d'une colonie, en heures, simulé au lieu d'être supposé :
 * construction du vaisseau, trajet, puis montée des mines au même classement
 * que pour une planète existante, et enfin le temps qu'il faut à sa production
 * pour rendre la mise de départ.
 * @param {number} [pos] position visée ; par défaut celle de la cible choisie
 * @returns {{hours:number, ramp:number, upfront:number, rate:number, b:object}|null}
 */
function colonyPayback(pos){
  const F = coloFleet();
  const p = pos || (parseC(F.target) || [])[2] || bestPosition();
  const P = POS[p]; if(!P) return null;
  const b = Object.assign(Object.fromEntries(Object.keys(B).map(k=>[k,0])), F.kit.lv);
  const colo = {coords:`1:1:${p}`, tmax:P.t, sats:0, b};
  const upfront = mse(...F.need);
  // Avant la première ressource : le vaisseau se construit, puis il vole.
  let h = (F.shipTime + (F.leg1 ? F.leg1.secs : 0)) / 3600;
  for(let step = 0; step < 200; step++){
    const pr = production(colo), rate = mse(pr.m, pr.c, pr.d);
    if(rate <= 0) return null;
    const u = rankUpgrades(colo).find(x => B[x.key] && x.payback < COLO_HORIZON_H);
    if(!u) break;
    // Elle paie son niveau suivant avec sa propre production, puis le monte.
    h += mse(...u.cost)/rate + u.time/3600;
    colo.b[u.key] = u.lvl;
    if(u.extraSolar) colo.b.solar += u.extraSolar;
  }
  const pr = production(colo), rate = mse(pr.m, pr.c, pr.d);
  if(rate <= 0) return null;
  return {hours: h + upfront/rate, ramp: h, upfront, rate, b:colo.b};
}
/** Le délai de retour d'une colonie, dit en une phrase, ou rien si incalculable. */
function coloPaybackTxt(){
  const cp = colonyPayback(); if(!cp) return '';
  return `Simulé : ${fmt(cp.upfront)} éq. de mise (vaisseau, kit, carburant), `
    + `${dur(cp.ramp*3600)} pour que ses mines montent toutes seules jusqu'à ${fmt(cp.rate)} éq./h, `
    + `et la mise est rendue en ${dur(cp.hours*3600)} en tout.`;
}
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
  const cap = expoFind(pf);
  let need = Math.max(0, cap - (pf ? shipStats('pf').cargoEff : 0));
  const lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
  const lc = Math.min(avail.lc||0, Math.ceil(need/lcC)); need -= lc*lcC;
  const sc = need>0 ? Math.min(avail.sc||0, Math.ceil(need/scC)) : 0;
  if(!lc && !sc) return null;
  const ships = {}; if(lc) ships.lc=lc; if(sc) ships.sc=sc; if(pf) ships.pf=1; if((avail.pr||0)>0) ships.pr=1;
  return {ships, cap, cargo: lc*lcC + sc*scC + (pf?shipStats('pf').cargoEff:0)};
}
const SHIP_PLURAL = {crawl:'foreuses', sc:'petits transporteurs', lc:'grands transporteurs', pf:'éclaireurs', lf:'chasseurs légers', hf:'chasseurs lourds', cr:'croiseurs', bs:'vaisseaux de bataille', bc:'traqueurs', bb:'bombardiers', ds:'destructeurs', rp:'faucheurs', rec:'recycleurs', col:'vaisseaux de colonisation', pr:"sondes d'espionnage"};
/* DEF complète ces deux tables avec les noms de la défense. */
const SHIP_ONE = {crawl:'foreuse'};
function shipList(ships){ return Object.entries(ships||{}).filter(([,n])=>n>0).map(([k,n])=>`${n} ${n>1 ? SHIP_PLURAL[k] : SHIPS[k] ? SHIPS[k].n.toLowerCase() : SHIP_ONE[k] || SHIP_PLURAL[k]}`).join(', '); }

/* ---------- daily planner ---------- */
/* Ce que chaque recherche rapporte, en une proposition qui se compose : « …, qui
   ajoute 1 % de métal… ». Le joueur voyait « Technologie Énergie 8 » sans rien
   d'autre, donc sans moyen de savoir que c'est un péage ni vers quoi il mène. */
const T_EFFET = {
  energy:    'ouvre les recherches suivantes',
  laser:     'ouvre les recherches suivantes',
  ion:       'ouvre les recherches suivantes',
  hyper:     'ouvre la propulsion hyperespace',
  plasma:    'ajoute 1 % de métal, 0,66 % de cristal et 0,33 % de deutérium sur toutes tes planètes à la fois',
  // Un niveau d'Astrophysique n'ajoute pas une expédition : il faut un carré
  // parfait. Le dire, parce que c'est exactement ce que le joueur croit.
  astro:     'ouvre une planète de plus un palier sur deux ; les expéditions simultanées, elles, n\'augmentent qu\'aux carrés parfaits (9, 16…)',
  computer:  'ajoute un emplacement de flotte par niveau',
  espionage: 'rend les rapports d\'espionnage plus complets',
  combustion:'ajoute 10 % de vitesse aux vaisseaux à combustion, transporteurs compris',
  impulse:   'ajoute 20 % de vitesse aux vaisseaux à impulsion',
  hyperdrive:'ajoute 30 % de vitesse aux vaisseaux à hyperespace',
  irn:       'ajoute les laboratoires de tes autres planètes à la vitesse de recherche',
};
/* Celles-ci ne font rien par elles-mêmes. On les traverse pour trouver la
   destination réelle d'un péage, au lieu de renvoyer le joueur vers un autre
   péage. */
const T_PEAGE = {energy:1, laser:1, ion:1, hyper:1};
const majus = s => s.charAt(0).toUpperCase() + s.slice(1);

/** Vrai si `k` exige `need`, directement ou par ses prérequis. */
function requiresTech(k, need, d){
  const rt = (T[k].req || {}).t || {};
  if(rt[need]) return true;
  return d < 6 && Object.keys(rt).some(x => requiresTech(x, need, d+1));
}
/** Première recherche utile, plus loin dans la feuille de route, qui exige `k`. */
function roadmapGoal(rm, i){
  for(let j = i+1; j < rm.length; j++)
    if(!T_PEAGE[rm[j][0]] && requiresTech(rm[j][0], rm[i][0], 0)) return rm[j];
  return null;
}
/**
 * Amortissement d'un niveau de recherche, en heures, ou null si la recherche ne
 * produit rien. Les bâtiments annoncent le leur depuis toujours ; la recherche,
 * jamais, alors que le modèle connaît déjà le bonus de Plasma. Les guides
 * répètent « Plasma d'abord » ; seul le chiffre dit si c'est vrai ici.
 * @param {string} k clé de recherche
 * @param {number} lvl niveau visé
 * @returns {number|null} heures de production pour rembourser le niveau
 */
function techPayback(k, lvl){
  if(k !== 'plasma' || !S.planets.length) return null;
  // Le gain est linéaire en Plasma : on le mesure sur un niveau, à bâtiments
  // égaux. `production` ne sait pas surcharger la recherche, d'où l'aller-retour.
  const garde = S.tech.plasma;
  const total = t => { S.tech.plasma = t; let m=0,c=0,d=0;
    for(const p of S.planets){ const pr = production(p); m+=pr.m; c+=pr.c; d+=pr.d; }
    return mse(m, c, d); };
  let gain;
  try { gain = total(garde + 1) - total(garde); } finally { S.tech.plasma = garde; }
  return gain > 0 ? mse(...levelCost(T[k], lvl)) / gain : null;
}
/** Niveau d'Astrophysique qui autorisera une planète de plus. */
function astroForPlanet(){ return S.tech.astro + (S.tech.astro % 2 ? 2 : 1); }

const ROADMAPS = {
  /* Ne pas prioriser ne veut pas dire tout mener de front : le joueur n'a
     qu'un labo, qu'une file par planète et qu'une poignée d'emplacements de
     flotte. L'équilibre se fait donc sur les paliers qui servent deux piliers
     à la fois, et nulle part ailleurs. Espionnage ouvre le pillage et
     Astrophysique ; Ordinateur donne les emplacements que se partagent
     pillages et expéditions ; Astrophysique ajoute une planète, et une
     expédition simultanée aux carrés parfaits ; Combustion ramène les
     transporteurs plus vite, donc fait tourner les deux ; Plasma porte sur
     toutes les planètes à la fois. Peu de paliers critiques : ce sont eux qui
     mettent les ressources de côté, et un plan qui épargne tout le temps ne
     construit plus de mines ni de formes de vie. */
  equi:[['espionage',4,'c'],['impulse',3,'c'],['astro',3,'c'],['computer',4],['combustion',6],['astro',5,'c'],['energy',8],['laser',10],['ion',5],['plasma',4],['computer',6],['astro',7,'c'],['plasma',8],['astro',9]],
  /* Une planète de plus bat n'importe quelle recherche à ce stade : Astrophysique
     5 coûte 262 500 éq. et ouvre une production entière, quand la chaîne vers
     Plasma 4 coûte 785 800 pour 4 020/h. Plasma reste l'objectif de long terme,
     et chaque colonie le rend plus rentable — son bonus porte sur toutes les
     planètes. D'où le rythme : Astro 5 puis colonie, Astro 6 et 7 puis colonie,
     Astro 8 et 9 puis colonie. */
  ecocol:[['impulse',3,'c'],['astro',3,'c'],['computer',2],['espionage',4],['astro',5,'c'],['astro',7,'c'],['energy',8],['laser',10],['ion',5],['plasma',4],['astro',9],['computer',6],['plasma',8]],
  eco:[['energy',8],['laser',10],['ion',5],['plasma',6],['impulse',3],['astro',3],['computer',4],['plasma',10]],
  fleet:[['combustion',6,'c'],['impulse',3,'c'],['espionage',4],['computer',6],['astro',4],['hyper',3],['hyperdrive',2],['impulse',5],['astro',6],['energy',8]],
};
/* Place des formes de vie dans la journée. Par défaut elles passent après les
   bâtiments et s'effacent devant ce qu'un chantier proche épargne. */
const LF_MODE = {after:'Après les bâtiments', first:'Avant tout le reste', off:'Ne pas s\'en occuper'};
function lfMode(){ return LF_MODE[S.day.lf] ? S.day.lf : 'after'; }

const FOCUS = {equi:'Équilibré', ecocol:'Économie + colonie', eco:'Économie pure', fleet:'Flotte et expéditions'};
/* Place de la recherche dans la journée. Par défaut elle prend son tour : elle
   ne met de côté que ce que la feuille de route juge critique, ou ce qu'elle
   attend depuis trop longtemps. « Avant les bâtiments » rend critique la tête
   de liste — elle passe devant les chantiers et pose aussitôt sa réserve, donc
   les bâtiments de la planète du labo s'effacent et les colonies rapatrient
   vers elle. */
/* Les deux plans où une expédition ou un pillage de plus compte autant qu'un
   niveau de mine : leurs plafonds — expéditions simultanées, emplacements de
   flotte — doublent la feuille de route au lieu d'attendre leur tour. */
const FOCUS_FLOTTE = {fleet:1, equi:1};
const RESEARCH_MODE = {normal:'À son tour', first:'Avant les bâtiments'};
function researchMode(){ return RESEARCH_MODE[S.day.research] ? S.day.research : 'normal'; }
/**
 * Ce qu'un réglage de journée vaut, d'après son contrôle. Les modes sont des
 * mots d'une liste fermée, tout le reste est un nombre d'heures ou de minutes.
 * La liste des modes se lit dans les tables : un mode ajouté à l'écran sans
 * être ajouté ici était converti en nombre, donc en 0, et le réglage ne
 * prenait jamais — en silence.
 * @param {string} k clé du réglage
 * @param {string} v valeur lue dans le contrôle
 * @param {*} prev valeur en place, gardée si le mot n'est pas de la liste
 */
function dayValue(k, v, prev){
  const t = {focus:FOCUS, lf:LF_MODE, research:RESEARCH_MODE}[k];
  return t ? (t[v] ? v : prev) : Math.max(0, parseInt(v) || 0);
}
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
/**
 * Pourquoi lancer ce niveau : l'étape, la destination du péage, l'effet qu'on
 * finira par toucher et, quand il se chiffre, l'amortissement.
 * @param {{k:string,lvl:number}} r prochain niveau réellement lançable
 * @param {string} k recherche visée par la feuille de route
 * @param {number} l niveau visé par la feuille de route
 * @param {Array|null} goal entrée de feuille de route que ce péage dessert
 * @returns {string}
 */
function techWhy(r, k, l, goal){
  const bouts = [];
  if(r.k !== k) bouts.push(`Prérequis pour ${T[k].n} ${l}`);
  else if(r.lvl < l) bouts.push(`Étape vers ${T[k].n} ${l}`);
  if(goal) bouts.push(`${bouts.length ? 'prérequis' : 'Prérequis'} de ${T[goal[0]].n} ${goal[1]}`);
  const effet = T_EFFET[goal ? goal[0] : k];
  let out = bouts.join(', ');
  out = out ? (effet ? `${out}, qui ${effet}.` : out+'.') : (effet ? majus(effet)+'.' : '');
  /* L'amortissement de l'étape en cours quand elle produit ; sinon celui du
     premier niveau de la destination, qui est la seule raison de payer le
     péage. Sans ce chiffre, « Énergie 8 » ne se compare à aucune mine. */
  const pb = techPayback(r.k, r.lvl);
  if(pb) return `${out} Amorti en ${dur(pb*3600)}.`.trim();
  const g = goal && goal[0] !== r.k ? techPayback(goal[0], S.tech[goal[0]]+1) : null;
  return g ? `${out} Son premier niveau s'amortira en ${dur(g*3600)}.`.trim() : out;
}
function nextResearch(){
  let labNeed = 0; const list = [];
  /* La priorité du joueur se glisse en tête d'une copie de la feuille de route,
     avec le drapeau critique, et tout le reste suit tout seul : `resolveTech`
     remonte les prérequis et le labo qui manque, `crit` met l'épargne en route
     par le chemin que `tryResearch` a déjà. Une copie, jamais la table
     elle-même : `ROADMAPS` est lue à chaque session de chaque prévision.
     C'est `prioOf` qui arbitre, pas le `kind` : une priorité de bâtiment posée
     avant sur le centre tient le rang, et la recherche attend son tour. */
  const mienne = prioOf((labPlanet() || {}).id);
  const prio = mienne && mienne.kind === 't' ? mienne : null;
  const rm = prio ? [[prio.k, prio.lvl, 'c']].concat(ROADMAPS[S.day.focus] || ROADMAPS.ecocol)
    : (ROADMAPS[S.day.focus] || ROADMAPS.ecocol);
  rm.forEach(([k,l,flag], i)=>{
    const mien = !!prio && i === 0;
    /* Ordre de priorité : un emplacement de planète libre se colonise avant de
       payer le palier suivant. Tant qu'il en reste un, Astrophysique n'ajoute
       rien que la colonie n'apporte déjà — c'est quand ils sont tous pris que
       le palier passe en tête, plus bas. Une Astrophysique que le joueur a
       posée, elle, ne se saute pas : le copilote obéit sans juger, et une
       priorité sautée serait muette. */
    if(!mien && k==='astro' && S.tech.astro >= 1 && S.day.focus !== 'eco' && S.planets.length < maxPlanets()) return;
    const r = resolveTech(k, l, 0); if(!r) return;
    if(r.lab){ labNeed = Math.max(labNeed, r.lab); return; }
    const pourquoi = techWhy(r, k, l, roadmapGoal(rm, i));
    if(!list.some(x=>x.k===r.k)) list.push({k:r.k, lvl:r.lvl, crit:flag==='c', prio:mien,
      why:mien ? `Tu as mis ${T[k].n} ${l} en priorité. ${pourquoi}`.trim() : pourquoi});
  });
  /* Les deux plafonds que le joueur touche tous les jours ont chacun leur
     recherche. La feuille de route cesse de parler d'Astrophysique dès qu'on l'a
     dépassée : plus rien ne dit alors comment envoyer une expédition de plus. */
  const plafonds = [];
  /* Le plafond des planètes vient en premier : passé le dernier palier
     d'Astrophysique de la feuille de route, plus rien ne disait comment en
     gagner une, et une colonie vaut plus que n'importe quelle recherche. Son
     texte remplace l'effet générique ; les plafonds suivants le complètent. En
     économie pure le plan ne colonise pas, donc ne rien promettre ici : le
     conseil s'en charge, sans engager le plan. */
  if(S.day.focus !== 'eco' && S.tech.astro && S.planets.length >= maxPlanets())
    plafonds.push(['astro', `Autorisera une ${maxPlanets()+1}ᵉ planète : une production complète, soit des dizaines de fois ce qu'ajoute un niveau de Plasma, pour trois fois moins cher. D'où sa place en tête. Les expéditions simultanées, elles, n'augmenteront qu'au niveau ${astroForExpo()}.`, true]);
  if(expoWanted() > expoCap()){
    const cap = expoCap(), need = astroForExpo();
    plafonds.push(['astro', need === S.tech.astro+1
      ? `Fait passer de ${cap} à ${cap+1} expéditions simultanées.`
      : `Étape vers Astrophysique ${need}, qui donnera une ${cap+1}ᵉ expédition simultanée.`]);
  }
  const fsl = fleetSlots();
  if(fsl && fsl[0] >= fsl[1]) plafonds.push(['computer', 'Un emplacement de flotte de plus : tes missions se marchent dessus.']);
  /* `tete` : ce plafond ne se range pas derrière la feuille de route, il la
     double. Une planète de plus vaut une production entière, quand les
     recherches qu'elle doublait ne font que grossir les mines existantes —
     attendre la fin de la chaîne vers Plasma revenait à payer trois fois le
     prix pour dix fois moins. */
  /* `garde` : la place que le joueur a prise. Un plafond « tête » double la
     feuille de route, mais pas une priorité — `tryResearch` ne regarde que
     `list[0]`, donc l'unshift de l'Astrophysique rendait la priorité inerte, et
     muette. Le copilote obéit, et il chiffre : ce que le plafond écarté coûte se
     dit sur la carte de la priorité, parce que la recherche repoussée n'a aucune
     ligne à elle — au-delà de `list[0]`, rien ne s'affiche. */
  const garde = (list[0] || {}).prio ? 1 : 0;
  for(const [k, why, tete] of plafonds){
    const r = resolveTech(k, S.tech[k]+1, 0); if(!r) continue;
    if(r.lab){ labNeed = Math.max(labNeed, r.lab); continue; }
    const w = r.k === k ? why : `Prérequis pour ${T[k].n}.`;
    const deja = list.find(x=>x.k===r.k);
    // Aujourd'hui le seul plafond « tête » est celui des planètes : son prix,
    // c'est la planète de plus qui attend.
    if(tete && garde && !(deja && deja.prio))
      list[0].why += ` Une planète de plus attend : tu as mis ${T[prio.k].n} ${prio.lvl} devant.`;
    // Les deux raisons sont vraies : le plafond s'ajoute à celle de la feuille
    // de route au lieu de l'écraser ou d'être perdu.
    if(deja){
      // Un plafond « tête » dit déjà, en plus précis, ce que disait l'effet
      // générique de la feuille de route : il le remplace au lieu de le répéter.
      // Sauf sur la carte de la priorité, qui dit d'abord qu'elle en est une.
      deja.why = tete && !deja.prio ? w : (deja.why ? deja.why+' '+w : w);
      const at = list.indexOf(deja);
      if(tete && at > garde){ deja.crit = true; list.splice(at, 1); list.splice(garde, 0, deja); }
      continue;
    }
    // Derrière ce que la feuille de route juge critique, et devant le reste
    // seulement quand les expéditions sont la stratégie choisie.
    const i = tete ? garde : (FOCUS_FLOTTE[S.day.focus] ? list.findIndex(x=>!x.crit) : -1);
    list.splice(i<0 ? list.length : i, 0, {k:r.k, lvl:r.lvl, crit:!!tete, why:w});
  }
  if(researchMode()==='first' && list[0]) list[0].crit = true;
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
/**
 * Un chantier qui a sorti un lot que le copilote n'a pas relu : il ne connaît
 * plus ni la flotte au sol, ni la défense, ni les satellites de cette planète,
 * et la file peut encore tourner derrière le lot qu'il a vu — le jeu n'annonce
 * que le premier. Tant que la page ne l'a pas redit, on ne propose rien à ce
 * chantier plutôt que de doubler ce qui existe déjà.
 * Une planète dont aucun lot n'a jamais été vu reste claire : le compte peut
 * être vieux, rien ne dit qu'il est faux.
 * @param {object} p planète
 * @returns {boolean}
 */
function chantierFlou(p){
  if(!p || (p.b||{}).shipyard < 1) return false;
  return (p.flotteFloue||0) > (p.shipsAt||0) || (p.defFloue||0) > (p.defsAt||0);
}
/* ---------- ce qu'une priorité demande à une planète ---------- */
/* Le copilote obéit, et il chiffre. Une priorité que rien n'empêche devient un
   objectif ; une priorité qui ne peut rien faire doit le dire, parce qu'une
   priorité muette est exactement ce qui a tué le plan manuel. Ces trois
   fonctions sont les trois phrases qu'elle a le droit de prononcer. */
/**
 * Les prérequis qui manquent, mis en mots. Résoudre la chaîne n'est pas le
 * travail d'une priorité : « Nanites 1 » demande Robots 10, elle le dit et
 * elle attend, elle ne décide pas de monter Robots pour autant.
 * Ne lit que `p.b` et `S.tech` : elle sert aussi bien sur une planète réelle
 * que sur une copie de simulateDay, et les deux ne portent pas le stock sous
 * le même nom.
 * @param {object} p planète, réelle ou simulée
 * @param {string} k bâtiment visé
 * @returns {string} la phrase, ou '' quand la priorité est jouable
 */
function prioBloque(p, k){
  const miss = reqOk((B[k]||{}).req, p);
  return miss.length ? `${B[k].n} demande ${miss.join(' et ')} : ta priorité attend que ce soit là.` : '';
}
/**
 * Ce qu'il faut construire sur `p` maintenant pour cette priorité.
 * Le coût du prochain niveau peut dépasser ce qu'un hangar de la planète peut
 * loger : la production s'y arrête, l'attente devient infinie et `setGoal`
 * rendrait `null` — la priorité disparaîtrait sans un mot. Elle ne disparaît
 * pas, elle fait un pas de côté et commence par le hangar.
 * Le test ne peut pas passer par `waitFor`, qui lit `p.stock` : les copies de
 * `simulateDay` portent `st`. Il se fait donc sur `production(p).cap`, et le
 * `{small:[…]}` qu'attend `storageNote` se reconstruit avec `storageLevelFor`.
 * Une recherche y passe aussi : Plasma 12 coûte 8,2 M de cristal, soit un
 * Hangar C 11, et le silence de `setGoal` serait le même. Son pas, lui, n'est
 * pas « le niveau suivant du bâtiment » mais celui que `resolveTech` a choisi,
 * donc son coût est donné de l'extérieur.
 * @param {object} p planète simulée
 * @param {{kind:string, k:string, lvl:number}} pr la priorité du joueur ; `lvl`
 *   est le niveau visé, celui qui se dit sur la carte
 * @param {number[]} [cost] coût du pas à payer, quand ce n'est pas celui du
 *   niveau suivant du bâtiment visé
 * @returns {{k:string, lvl:number, why:string}|null} null pour une recherche
 *   qui tient dans les hangars : elle suit alors son propre chemin, la feuille
 *   de route, et n'a rien à construire ici.
 */
function prioStep(p, pr, cost){
  const cap = production(p).cap, sk = ['smetal','scrystal','sdeut'], bat = pr.kind === 'b';
  const suivant = (p.b[pr.k]||0)+1, c = bat ? levelCost(B[pr.k], suivant) : cost;
  const vise = `Tu as mis ${bat ? B_SHORT[pr.k] : T[pr.k].n} ${pr.lvl} en priorité.`;
  for(let j=0;j<3;j++) if(c[j] > cap[j]){
    const L = storageLevelFor(c[j]);
    return {k:sk[j], lvl:L, why:`${vise} ${storageNote({small:[{res:j, k:sk[j], lvl:L}]})}`};
  }
  return bat ? {k:pr.k, lvl:suivant, why:vise} : null;
}
/**
 * Laquelle des trois ressources n'arrivera jamais ici, et pourquoi. C'est ce
 * que `setGoal` tait quand il rend `null` : soit la planète ne produit pas
 * cette ressource et n'en a pas en réserve, soit le montant est plus grand que
 * ce que ses hangars peuvent loger — et un hangar ne se remplit pas au-delà de
 * son plafond, seule une livraison n'est pas plafonnée.
 * @param {object} p planète simulée
 * @param {number[]} cost le coût que personne ne pourra réunir
 * @returns {string}
 */
function prioRien(p, cost){
  const pr = production(p), r = [pr.m, pr.c, pr.d], noms = ['métal','cristal','deutérium'];
  for(let j=0;j<3;j++){
    if(cost[j] <= p.st[j]) continue;
    if(cost[j] > pr.cap[j]) return `Il en faut ${fmt(cost[j])} de ${noms[j]} d'un seul coup, plus que ${planetRef(p)} ne peut en loger : seule une livraison par transport, calée juste avant, les y amènera.`;
    if(r[j] <= 0) return `${planetRef(p)} ne produit pas de ${noms[j]} et n'en a pas en réserve : rien ne l'y amènera tout seul.`;
  }
  return '';
}

/** Building candidates for a simulated planet, most urgent first. */
function pickBuildings(p, ctx){
  const pr = production(p), iv = ctx.iv, rates=[pr.m,pr.c,pr.d], sk=['smetal','scrystal','sdeut'], out=[];
  /* `libre` : ce candidat-là ne se voit pas opposer la réserve de la priorité.
     Les deux chantiers de secours protègent la production qui paie la
     priorité, et la priorité ne peut pas s'interdire à elle-même de dépenser
     ce qu'elle a mis de côté. */
  const add = (k, why, libre)=>{ if(!out.some(o=>o.k===k)) out.push({k, lvl:p.b[k]+1, why, libre:!!libre}); };
  const ranked = rankUpgrades(p).filter(u=>u.payback<Infinity && B[u.key]);
  const satsSoon = p.satPending && p.satPending > ctx.T;
  if(pr.factor<1 && !satsSoon) add('solar', 'Énergie négative : tes mines tournent au ralenti', true);
  for(let j=0;j<3;j++) if(rates[j]>0 && p.st[j]+rates[j]*iv*2 >= pr.cap[j]*.98) add(sk[j], 'Hangar plein avant ta prochaine connexion', true);
  /* La priorité du joueur passe ici : derrière les deux secours — une mine au
     ralenti coûte de la production à chaque heure, une priorité repoussée ne
     coûte que du temps — et devant tout le classement par amortissement, qui
     est tout l'objet de la manœuvre. Le labo, lui, n'a aucun amortissement en
     production et n'entre dans aucun classement : un candidat forcé est le
     seul chemin par lequel « Labo 10 » peut sortir. */
  /* `ctx.prio` est le pas que la priorité a retenu, déjà calculé par
     `prioStep` : la boucle des priorités l'a choisi avant toute cette session,
     et pour une recherche l'appelant est le seul à connaître le coût du niveau
     à payer. */
  if(ctx.prio){
    const pas = ctx.prio, deja = out.find(o=>o.k===pas.k);
    // Un secours qui vise déjà ce bâtiment y va un niveau à la fois, et c'est
    // le même pas : les deux raisons sont vraies, elles s'ajoutent.
    if(deja){ deja.why = deja.why ? `${deja.why}. ${pas.why}` : pas.why; deja.prio = true; }
    else out.push({k:pas.k, lvl:pas.lvl, why:pas.why, libre:true, prio:true});
  }
  const best = ranked[0];
  if(best){ const bc = best.extraSolar ? levelCost(B.solar,p.b.solar+1) : levelCost(B[best.key],best.lvl); for(let j=0;j<3;j++) if(bc[j]>pr.cap[j]) add(sk[j], 'Hangar trop petit pour la suite'); }
  for(const g of ctx.goals||[]) if(g.p===p) for(let j=0;j<3;j++) if(g.cost[j]>pr.cap[j]) add(sk[j], `Hangar trop petit pour ${g.label}`);
  if(ctx.wantColony && p===ctx.dep && p.b.shipyard<4){
    if(p.b.robot<2) add('robot', 'Prérequis du chantier spatial.' + centreNote());
    else add('shipyard', 'Prérequis du vaisseau de colonisation.' + centreNote());
  }
  if(ctx.labNeed && p===ctx.labP && p.b.lab<ctx.labNeed && !ctx.researchRunning) add('lab', POURQUOI_LABO + centreNote());
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
  /* La copie porte l'id de sa planète : plus bas, `S.planets` est remplacé par
     cette liste, et sans id le centre choisi par le joueur devenait
     introuvable — `centreIndex()` retombait en silence sur le choix
     automatique pour tout le reste de la journée simulée. */
  const now = Date.now(), real = {tech:S.tech, planets:S.planets};
  const target = coloTarget(), colFlight = (coloFleet().leg1||{}).secs || 0;
  const P = S.planets.map((p,i)=>({i, id:p.id, name:p.name, coords:p.coords, tmax:p.tmax, sats:p.sats, b:Object.assign({},p.b), ships:Object.assign({},p.ships||{}), st:stockNow(p), bq:now, bqKey:null, sq:now, flou:chantierFlou(p), lf:Object.assign({},p.lf||{}), lfq:{lfbuilding:now, lfresearch:now}, gid:p.gid, crawlers:p.crawlers, overload:p.overload, def:p.def, defs:p.defs ? Object.assign({},p.defs) : p.defs}));
  const expoBusy = [];
  const fleetReturns = (S.timers||[]).filter(t=>t.kind==='x' && (t.k==='fleet'||t.k==='expo') && !t.done && t.end>now).map(t=>t.end).sort((a,b)=>a-b);
  const sim = {tech:Object.assign({},S.tech), rq:now, ev:[], colShip:colBuilt(), colReady:colBuilt()?now:Infinity, colSent:colSentNow(), rSince:{}, away:{}};
  const busy = [];
  for(const t of S.timers||[]){
    if(t.done || t.end<=now) continue;
    const pi = planetIndexById(t.pid);
    if(t.kind==='t' && T[t.k]){ sim.rq=Math.max(sim.rq,t.end); busy.push({q:'Recherche · '+planetRef(labPlanet()), what:timerLabel(t), end:t.end}); sim.ev.push({at:t.end, fn:()=>{ sim.tech[t.k]=Math.max(sim.tech[t.k],t.lvl); }}); }
    else if(t.kind==='b' && P[pi]){ const p=P[pi]; p.bq=Math.max(p.bq,t.end); p.bqKey=t.k; busy.push({q:'Bâtiment · '+planetRef(p), what:timerLabel(t), end:t.end}); sim.ev.push({at:t.end, fn:()=>{ p.b[t.k]=Math.max(p.b[t.k],t.lvl); }}); }
    else if(t.kind==='x' && t.k==='expo'){ expoBusy.push(t.end); busy.push({q:'Flotte', what:timerLabel(t), end:t.end}); if(t.manual && t.ships && P[pi]){ const p=P[pi]; for(const [k,n] of Object.entries(t.ships)) p.ships[k]=Math.max(0,(p.ships[k]||0)-n); sim.ev.push({at:t.end, fn:()=>{ for(const [k,n] of Object.entries(t.ships)) p.ships[k]=(p.ships[k]||0)+n; }}); } }
    else if(t.kind==='x' && t.k==='fleet'){ busy.push({q:'Flotte', what:timerLabel(t), end:t.end}); if(t.manual && t.ships && P[pi]){ const p=P[pi]; for(const [k,n] of Object.entries(t.ships)) p.ships[k]=Math.max(0,(p.ships[k]||0)-n); sim.ev.push({at:t.end, fn:()=>{ for(const [k,n] of Object.entries(t.ships)) p.ships[k]=(p.ships[k]||0)+n; }}); } }
    else if(t.kind==='x' && t.k!=='sats' && (t.k==='shipyard' || t.queue==='shipyard') && P[pi]){ const p=P[pi]; p.sq=Math.max(p.sq,t.end); busy.push({q:'Chantier spatial · '+planetRef(p), what:timerLabel(t), end:t.end}); if(t.manual && t.ships) sim.ev.push({at:t.end, fn:()=>addBuilt(p, t.ships)}); }
    else if(t.kind==='x' && (t.queue==='lfbuilding' || t.queue==='lfresearch') && P[pi]){ const p=P[pi]; p.lfq[t.queue]=Math.max(p.lfq[t.queue],t.end); busy.push({q:'Forme de vie · '+planetRef(p), what:timerLabel(t), end:t.end}); }
    else if(t.kind==='x' && t.k==='sats' && P[pi]){ const p=P[pi]; p.sq=Math.max(p.sq,t.end); p.satPending=t.end; busy.push({q:'Chantier spatial · '+planetRef(p), what:timerLabel(t), end:t.end}); sim.ev.push({at:t.end, fn:()=>{ p.sats+=t.n||0; p.satPending=0; }}); }
    else if(t.kind==='x' && t.k==='colship'){ const p=P[planetIndexById(S.colo.fromId)]||P[0]; p.sq=t.end; sim.colShip=true; sim.colReady=t.end; busy.push({q:'Chantier spatial', what:'Vaisseau de colonisation', end:t.end}); }
  }
  /* Les expéditions en vol, prises sur les mouvements de flotte du jeu
     (mission 15, trajet de retour). Les compter sur les seuls minuteurs les
     sous-comptait : un retour sans minuteur et le plan voyait un emplacement
     libre là où le jeu affichait « Expéditions 2/2 », donc proposait une
     expédition de plus qu'il n'en existe. Le minuteur du jeu porte l'heure
     d'arrivée du mouvement, d'où le dédoublonnage — après la boucle, pour que
     ce que les minuteurs ont posé soit déjà là. */
  for(const m of S.moves||[]){
    if(m.mission !== 15 || !m.ret) continue;
    const fin = m.arrival*1000;
    if(fin > now && !expoBusy.includes(fin)) expoBusy.push(fin);
  }
  /* Un rapatriement parti dans le jeu sans passer par « Lancé » : le plan n'en
     savait rien et reproposait la même carte à chaque passage, comme si le
     joueur n'avait rien fait. Les mouvements de flotte le disent — Transporter
     et Stationner, trajet aller ou retour — et la planète d'où partent les
     vaisseaux n'a plus de rapatriement à faire tant qu'ils volent.
     Les mouvements ne disent pas combien de vaisseaux partent : la flotte à
     quai reste donc comptée comme présente. C'est la carte qui cesse de
     revenir, pas la soute qui se déduit. */
  for(const m of S.moves||[]){
    if(m.mission !== 3 && m.mission !== 4) continue;
    const fin = m.arrival*1000; if(fin <= now) continue;
    const depart = m.ret ? m.dest : m.origin;
    const i = S.planets.findIndex(p => p.coords === depart);
    if(i >= 0 && P[i]) P[i].transferAt = Math.max(P[i].transferAt||0, fin);
  }
  /* Le chiffre que le jeu affiche lui-même — « Expéditions 2/2 » — complète ce
     que les minuteurs et les mouvements ont donné. Eux connaissent l'heure de
     retour, lui ne connaît qu'un nombre : il passe donc en dernier, et ses
     entrées expirent quand la lecture cesse d'être fiable. Sans ça, le plan
     proposait une expédition de plus que le jeu n'en accepte dès que le joueur
     n'ouvrait pas la page Mouvements de flotte. */
  const expoRead = expoInFlight();
  if(expoRead) while(expoBusy.length < expoRead.n) expoBusy.push(expoRead.at + EXPO_READ_TTL);
  const iv = Math.max(15,+S.day.interval||90)/60;
  // Les alertes se lisent sur l'état réel, avant que la simulation ne prenne
  // la place de S.planets : ce sont les ennuis d'aujourd'hui, pas ceux prévus.
  // Trié par sévérité, l'ordre des planètes conservé à sévérité égale : sans
  // cela un Urgent de la deuxième planète se lit sous un Attention de la
  // première, et le joueur à quatre planètes balaie la carte de travers.
  const alerts = S.planets.flatMap(p=>planetAlerts(p)).sort((a,b)=>(a.sev==='bad'?0:1)-(b.sev==='bad'?0:1));
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
    const reserveOf = (p, Tm, skip, only)=>{ const pr=production(p), r=[pr.m,pr.c,pr.d], out=[0,0,0]; for(const g of goals){ if(g.p!==p || g===skip || (only && g!==only)) continue; const h=Math.max(0,(g.deadline-Tm)/3600e3); g.cost.forEach((x,j)=>out[j]+=Math.max(0, x - r[j]*h)); } return out; };
    /* Les objectifs qui retiennent quelque chose sur la planète, nommés : le
       joueur qui voit une carte attendre doit pouvoir lire pour quoi la
       planète épargne. `skip` est celui que la carte sert elle-même, qui ne
       la retient pas. */
    const heldByOf = (p, Tm, skip)=>goals.filter(g=>g.p===p && g!==skip && reserveOf(p,Tm,null,g).some(x=>x>0)).map(g=>g.label).join(' et ');
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
    /* `reserveOf` somme les objectifs d'une même planète : deux réserves la
       gèlent entière, jusqu'à ce que les deux soient payables. Tant qu'une
       priorité du joueur épargne ici, le moteur ne s'en donne donc pas un
       second de son propre chef — la recherche critique et le vaisseau de
       colonisation attendent leur tour, et leur ligne d'attente le dit. */
    const epargnePrio = p => goals.some(g=>g.p===p && g.key.startsWith('prio:'));
    for(const Tm of sessionTimes(now)){
      advance(Tm);
      const acts=[], waits=[], soft=[];
      /* Tout ce qu'un bâtiment de cette planète est en train de réunir, sans
         limite de délai : ce que la production n'aura pas couvert d'ici là. */
      const softAll = p=>{ const pr=production(p), r=[pr.m,pr.c,pr.d], out=[0,0,0]; for(const x of soft){ if(x.p!==p) continue; x.cost.forEach((c,j)=>out[j]+=Math.max(0, c - r[j]*(x.eta/3600+iv))); } return out; };
      const softRes = p=>{ const pr=production(p), r=[pr.m,pr.c,pr.d], out=[0,0,0]; for(const x of soft){ if(x.p!==p || !(x.eta<=3*3600)) continue; x.cost.forEach((c,j)=>out[j]+=Math.max(0, c - r[j]*(x.eta/3600+iv))); } return out; };
      const labP = P[centreIndex()] || P.reduce((a,p)=>p.b.lab>a.b.lab?p:a, P[0]);
      /* D'où part la colonie : un vaisseau déjà à quai est un fait et passe
         devant tout ; sinon c'est le centre, parce que c'est lui qui porte le
         chantier de l'empire. `S.colo.fromId` garde ses autres usages — le
         classement des positions part toujours de là — mais il ne décide plus
         où le vaisseau se construit : le centre est désormais le seul levier,
         au lieu de deux qui pouvaient se contredire. */
      const dep = P[colShipAt()>=0 ? colShipAt() : centreIndex()] || P[planetIndexById(S.colo.fromId)] || P[0];
      const wantColony = S.day.focus!=='eco' && P.length < maxPlanets() && !sim.colSent;
      const nr = nextResearch();
      if(nr.labNeed && labP.b.lab<nr.labNeed && labP.bq<=Tm && sim.rq<=Tm){
        const c = levelCost(B.lab, labP.b.lab+1);
        if(can(labP,c,reserveOf(labP,Tm))){ pay(labP,c); const d=buildTime('lab',labP.b.lab+1,labP), L=labP.b.lab+1, pp=labP; pp.bq=Tm+d; pp.bqKey='lab'; sim.ev.push({at:Tm+d, fn:()=>{ pp.b.lab=Math.max(pp.b.lab,L); }}); acts.push({q:'Bâtiment · '+planetRef(pp), what:`${B.lab.n} ${L}`, why:POURQUOI_LABO + centreNote(), cost:c, dur:d, end:Tm+d, kind:'b', k:'lab', lvl:L, p:pp.i}); }
      }
      const labBusy = labP.bq>Tm && labP.bqKey==='lab';
      /* « Devant, seule » : rien ne s'empile sur une planète où une priorité du
         joueur épargne. L'objectif d'une priorité de recherche porte la clé
         `t:`, comme n'importe quelle recherche, donc `epargnePrio` ne le
         reconnaît pas à sa clé — et un labo occupé peut retarder sa pose d'une
         session ou deux, le temps qu'un objectif spontané s'installe et n'en
         reparte plus, puisque rien ne le lâche avant qu'il soit payé. La
         question se pose donc à la priorité elle-même. `tryResearch`, lui,
         continue de n'interroger que `epargnePrio` : c'est lui qui pose
         l'objectif de cette priorité, il ne peut pas se l'interdire. */
      const prioDevant = p => epargnePrio(p) || (p === labP && !!(nr.list[0] || {}).prio);
      const launchR = (R, why)=>{ const c=levelCost(T[R.k],R.lvl); pay(labP,c); const d=researchTime(R.k,R.lvl), k=R.k, L=R.lvl; sim.rq=Tm+d; sim.ev.push({at:Tm+d, fn:()=>{ sim.tech[k]=Math.max(sim.tech[k],L); }}); acts.push({q:'Recherche · '+planetRef(labP), what:`${T[k].n} ${L}`, why: [why, R.why].filter(Boolean).join(' '), cost:c, dur:d, end:Tm+d, kind:'t', k, lvl:L, p:labP.i}); };
      const tryResearch = phase=>{
        if(sim.rq>Tm || !nr.k || labBusy) return;
        const R = nr.list[0], key='t:'+R.k+R.lvl, c = levelCost(T[R.k],R.lvl), mine = goals.find(g=>g.key===key);
        if(phase==='pre' && !R.crit && !mine) return;
        const sr = phase==='post' ? softRes(labP) : [0,0,0], rr = reserveOf(labP,Tm,mine).map((x,j)=>x+sr[j]);
        if(can(labP,c,rr)){ launchR(R, mine ? `Économisée depuis ${hm(mine.since)}` : ''); dropGoal(key); delete sim.rSince[key]; return; }
        if(!sim.rSince[key]) sim.rSince[key] = Tm;
        const starving = Tm - sim.rSince[key] >= Math.max(4, 4*iv)*3600e3;
        /* `mine` d'abord : un objectif déjà posé se retrouve, même sous une
           priorité — et c'est lui que pose une priorité de recherche, qu'une
           règle lue trop largement tuerait. */
        const g = (mine || ((R.crit || starving) && !epargnePrio(labP))) ? setGoal(key, `${T[R.k].n} ${R.lvl}`, c, labP, Tm) : null;
        if(phase==='pre') return;
        const held = heldByOf(labP, Tm, g);
        waits.push({q:'Recherche · '+planetRef(labP), what:`${T[R.k].n} ${R.lvl}`, eta:wait(labP,c), held:!!held, heldBy:held, miss:missOf(labP,c), kind:'t', k:R.k, p:labP.i});
        for(const F of nr.list.slice(1)){
          const fd = researchTime(F.k,F.lvl);
          if(g && Tm+fd*1000 > g.deadline) continue;
          if(can(labP, levelCost(T[F.k],F.lvl), reserveOf(labP,Tm).map((x,j)=>x+sr[j]))){ launchR(F, `En attendant ${T[R.k].n} ${R.lvl}`); break; }
        }
      };
      /* Les priorités du joueur, avant tout le reste de la session. Avant,
         parce que `reserveOf` fait ensuite le travail tout seul : la recherche
         et le chantier ne partiront que s'il reste de quoi les payer au-delà
         de ce que la priorité met de côté.
         Dans l'ordre de pose, et pas dans celui de `P` : `destOf` envoie les
         rapatriements de l'empire vers le premier objectif du tableau, donc
         cet ordre-là décide qui, de deux planètes qui épargnent, reçoit les
         transports. Il était sans conséquence tant que les deux seuls
         objectifs vivaient au même endroit ; il devient l'arbitre.
         `prios()` lit ici l'empire simulé — S.planets est P : une priorité que
         la journée a déjà atteinte cesse d'elle-même d'épargner, au lieu de
         geler la planète jusqu'au bout de l'horizon. */
      /* `prioPas` : le pas que la boucle a retenu, par planète, pour que la
         boucle des bâtiments en fasse un candidat forcé sans le recalculer —
         elle n'a pas de quoi le faire pour une recherche, dont le coût ne se
         lit pas dans `B`. Rien ne bouge entre les deux : `prioStep` ne lit que
         les niveaux de la planète, et aucun chantier n'aboutit d'ici là. */
      const prioVus = new Set(), prioClefs = new Set(), prioPas = new Map();
      for(const pr of prios()){
        // La première posée sur la planète agit, les suivantes attendent leur
        // tour : deux réserves sur une planète ne s'ajouteraient que pour la
        // geler deux fois plus longtemps. La règle ignore les `kind`.
        if(prioVus.has(pr.pid)) continue;
        prioVus.add(pr.pid);
        const pp = P.find(x=>x.id===pr.pid); if(!pp) continue;
        /* Une priorité de recherche part par la feuille de route, et ne vient ici
           que pour le hangar : son coût peut dépasser ce que le centre loge, et
           alors `setGoal` rendrait null — l'épargne ne commencerait jamais et
           rien ne le dirait. Le pas qu'elle paie est celui que `nextResearch` a
           résolu, prérequis compris, et pas le niveau que le joueur a visé :
           épargner pour Plasma 12 quand il reste Laser 1 à faire demanderait un
           hangar des mois trop tôt. */
        const R = pr.kind === 't' ? nr.list[0] : null;
        if(pr.kind === 't' && !(R && R.prio)) continue;
        // Les prérequis d'une recherche ne sont pas une impasse : `resolveTech`
        // les remonte et le pas lançable est l'un d'eux.
        const bloque = pr.kind === 'b' ? prioBloque(pp, pr.k) : '';
        if(bloque){
          waits.push({q:'Bâtiment · '+planetRef(pp), what:`${B[pr.k].n} ${(pp.b[pr.k]||0)+1}`, why:bloque, eta:Infinity, miss:[0,0,0], kind:'b', k:pr.k, p:pp.i});
          continue;
        }
        const pas = prioStep(pp, pr, R ? levelCost(T[R.k], R.lvl) : null);
        if(!pas) continue;
        prioPas.set(pp.id, pas);
        const c = levelCost(B[pas.k], pas.lvl);
        /* La clé porte le pas, comme celle d'une recherche porte son niveau :
           quand la cible du moment avance, l'objectif d'hier est remplacé au
           lieu de tenir une réserve calculée pour un prix qui n'est plus. */
        const key = `prio:${pr.pid}:${pas.k}${pas.lvl}`;
        const g = setGoal(key, `${B_SHORT[pas.k]} ${pas.lvl}`, c, pp, Tm);
        if(g){
          prioClefs.add(key);
          /* Une échéance dit « quand on pense pouvoir payer », et `setGoal` ne
             la calcule qu'à la première pose. Une priorité vit des jours : la
             nuit passe, l'échéance expire, `h` retombe à zéro et `reserveOf`
             retient d'un coup le coût entier, pour tout le reste de l'horizon.
             La planète gèle alors pour une cible qui n'a pas bougé. L'échéance
             se recalcule donc à chaque session, comme au premier passage.
             `since`, lui, ne bouge pas : c'est depuis là qu'on économise.
             Les autres genres d'objectifs vivent une session ou deux et sont
             lâchés au lancement : ils gardent leur échéance d'origine. */
          const w = wait(pp, c);
          if(isFinite(w)) g.deadline = Tm + w*1000 + iv*3600e3;
        }
        else waits.push({q:'Bâtiment · '+planetRef(pp), what:`${B[pas.k].n} ${pas.lvl}`, why:prioRien(pp, c), eta:Infinity, miss:missOf(pp,c), kind:'b', k:pas.k, p:pp.i});
      }
      // Ce que le joueur a retiré, ou que la journée a atteint, ne doit plus
      // rien retenir : sans ce ménage la réserve survivrait à sa cible.
      for(const g of goals.slice()) if(g.key.startsWith('prio:') && !prioClefs.has(g.key)) dropGoal(g.key);
      tryResearch('pre');
      if(wantColony && !sim.colShip && sim.tech.impulse>=3 && dep.b.shipyard>=4 && dep.sq<=Tm && !(dep.bq>Tm && dep.bqKey==='shipyard')){
        const c = COL_SHIP_COST, key='ship:col', mine = goals.find(g=>g.key===key);
        if(can(dep,c,reserveOf(dep,Tm,mine))){ pay(dep,c); dropGoal(key); const d=(c[0]+c[1])/(2500*(1+dep.b.shipyard)*Math.pow(2,dep.b.nanite)*S.settings.eco)*3600; dep.sq=Tm+d; sim.colShip=true; sim.colReady=Tm+d; acts.push({q:'Chantier spatial · '+planetRef(dep), what:'1 Vaisseau de colonisation', why:'', cost:c, dur:d, end:Tm+d, kind:'ship', p:dep.i}); }
        else { if(!prioDevant(dep)) setGoal(key, 'le vaisseau de colonisation', c, dep, Tm); waits.push({q:'Chantier spatial', what:'Vaisseau de colonisation', eta:wait(dep,c), miss:missOf(dep,c), kind:'ship', p:dep.i}); }
      }
      if(wantColony && sim.colShip && sim.colReady<=Tm && !refused(moveKey('fleet', (real.planets[dep.i]||{}).id, target))){ sim.colSent=true; acts.push({q:'Flotte · '+planetRef(dep), what:`Envoyer le vaisseau de colonisation vers ${target}`, why:`Kit ${KITS[S.colo.kit]?KITS[S.colo.kit].n.toLowerCase():''} : détail dans Outils › Colonie`, dur:colFlight, end:Tm+colFlight, kind:'fleet', p:dep.i, dest:target, mission:7, ships:{col:1}}); }
      const hubP = P[centreIndex()] || P[Math.min(hubIndex(), P.length-1)];
      /* Ce qu'il manque à chaque planète pour son prochain chantier, relevé une
         fois avant le premier envoi : c'est ce manque qui fait d'elle une
         destination. */
      const manqueDe = new Map(P.map(d=>{ const c = pickBuildings(d, {T:Tm, iv, goals:[]})[0]; return [d, c ? levelCost(B[c.k],c.lvl).map((x,j)=>Math.max(0, x-d.st[j])) : [0,0,0]]; }));
      /* Une planète bridée faute d'énergie et sans de quoi payer sa centrale
         perd de la production à chaque heure, et rien ne l'en sortait : les
         objectifs ne naissent que de la recherche et du vaisseau de
         colonisation, tous deux sur la principale, donc tout transport
         remontait vers elle. Une colonie qui vient de perdre ses centrales
         n'attirait rien et le joueur devait y penser seul. Elle passe devant
         un objectif d'épargne : une recherche repoussée ne coûte que du temps,
         une mine au ralenti coûte de la production à chaque heure. Pas de
         manque, pas de livraison — une planète bridée qui a le cristal
         reconstruit toute seule. */
      const bridees = P.filter(d=>production(d).factor<1 && mse(...manqueDe.get(d))>0)
        .sort((a,b)=>mse(...manqueDe.get(b))-mse(...manqueDe.get(a)));
      /* Un transport va sinon vers la planète qui attend : celle qui porte un
         objectif, le hub seulement à défaut. Viser le hub en dur laissait la
         planète du meilleur labo épargner pour une recherche sans jamais rien
         recevoir dès qu'elle n'était pas aussi celle du meilleur chantier :
         `hubIndex` classe sur labo + chantier, la recherche se paie sur le
         labo seul. */
      const destOf = q => bridees.find(d=>d!==q) || (goals.find(g => g.p !== q) || {}).p || hubP;
      /* Un rapatriement occupe un emplacement de flotte, exactement comme une
         expédition : les deux puisent dans le même compte. Le laisser hors du
         compte faisait proposer un envoi que le jeu refuse d'un « Nombre
         maximal de flottes atteint », alors que le copilote connaît les
         flottes déjà en vol. Les retours connus rendent la place le moment
         venu ; emplacements inconnus, on en suppose assez, comme avant. */
      const fsl = fleetSlots();
      let libres = fsl ? Math.max(0, fsl[1]-fsl[0]) + fleetReturns.filter(e=>e<=Tm).length : 3;
      const maxExpo = expoCap(sim.tech.astro);
      /* Une expédition rapporte plus qu'un rapatriement, qui ne fait que
         déplacer ce qu'on a déjà : tant qu'une expédition est possible, le
         dernier emplacement lui revient. */
      const garde = expoBusy.filter(e=>e>Tm).length < maxExpo && P.some(p=>expoFleet(p.ships)) ? 1 : 0;
      if(P.length>1) for(const q of P){
        const dst = destOf(q);
        if(libres-garde<=0) break;
        if(q===dst || (q.transferAt||0)>Tm) continue;
        const pr = production(q), want = [0,0,0];
        for(const g of goals) if(g.p===dst) g.cost.forEach((x,j)=>want[j]=Math.max(want[j], x-dst.st[j]));
        /* Le manque d'une planète bridée est un besoin comme un objectif : sans
           lui ici, la destination changeait et rien ne partait. */
        const secours = bridees.includes(dst);
        if(secours) manqueDe.get(dst).forEach((x,j)=>want[j]=Math.max(want[j], x));
        pr.cap.forEach((cap,j)=>{ if(q.st[j] > cap*.7) want[j] = Math.max(want[j], q.st[j]-cap*.3); });
        const keep = (()=>{ const c = pickBuildings(q, {T:Tm, iv, goals:[]})[0]; return c ? levelCost(B[c.k],c.lvl) : [0,0,0]; })();
        const amt = want.map((w,j)=>Math.max(0, Math.min(w, q.st[j]-keep[j])));
        const sum = amt[0]+amt[1]+amt[2]; if(sum < 5000) continue;
        const own = (q.ships.lc||0)+(q.ships.sc||0) > 0, src = own ? q : hubP, lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
        if(refused(moveKey('transfer', (real.planets[src.i]||{}).id, (own?dst:q).coords))) continue;
        let left = sum; const lc = Math.min(src.ships.lc||0, Math.ceil(left/lcC)); left -= lc*lcC; const sc = left>0 ? Math.min(src.ships.sc||0, Math.ceil(left/scC)) : 0;
        if(!lc && !sc) continue;
        const ships = {}; if(lc) ships.lc=lc; if(sc) ships.sc=sc;
        const fl = flight(q.coords, dst.coords, ships, 100); if(!fl) continue;
        // L'aller à vide part du chantier, pas de la destination : les deux
        // trajets cessent d'être symétriques dès que la cible n'est pas le hub.
        const flOut = own ? null : flight(src.coords, q.coords, ships, 100);
        if(!own && !flOut) continue;
        const cap = lc*lcC + sc*scC, k = Math.min(1, cap/sum), sent = amt.map(x=>Math.floor(x*k));
        // Un Transporter revient toujours à son point de départ, donc un trajet
        // de plus que l'aller chargé — et après un Stationner ce point de départ
        // est la colonie : les vaisseaux y restent, la principale ne les revoit pas.
        const aller = Tm + (own ? 0 : flOut.secs*1000);
        const arrive = aller + fl.secs*1000, back = arrive + fl.secs*1000;
        sent.forEach((x,j)=>q.st[j]-=x); q.st[2] = Math.max(0, q.st[2]-fl.fuel); q.transferAt = back;
        for(const [kk,n] of Object.entries(ships)) src.ships[kk]-=n;
        sim.ev.push({at:arrive, fn:()=>{ sent.forEach((x,j)=>dst.st[j]+=x); }});
        sim.ev.push({at:back, fn:()=>{ for(const [kk,n] of Object.entries(ships)) q.ships[kk]=(q.ships[kk]||0)+n; }});
        // Une mission part toujours de la planète où est la flotte. Sans
        // transporteur sur la colonie, il faut d'abord l'y amener À VIDE — en
        // Stationner, pas en Transporter : Transporter repartirait tout seul
        // et les vaisseaux ne seraient plus là pour charger. C'est ce premier
        // trajet qu'on annonce, et le minuteur prévient quand ils se posent.
        const charge = `${fmt(sent[0])} M, ${fmt(sent[1])} C, ${fmt(sent[2])} D`;
        const motif = secours ? `${planetRef(dst)} tourne au ralenti faute d'énergie et n'a pas de quoi payer sa centrale · ` : '';
        acts.push(own
          ? {q:'Flotte · '+planetRef(q), what:`Rapatrier vers ${planetRef(dst)} : ${charge}`,
             why:`${motif}${shipList(ships)} déjà sur place · mission Transporter · arrivée vers ${hm(arrive)}`,
             dur:(arrive-Tm)/1000, end:arrive, kind:'transfer', ships, p:src.i, dest:dst.coords, res:sent, mission:3}
          : {q:'Flotte · '+planetRef(src), what:`Envoie ${shipList(ships)} vers ${planetRef(q)}`,
             why:`${motif}À vide : il n'y a aucun transporteur sur ${planetRef(q)}. Mission Stationner, arrivée vers ${hm(aller)}. Tu lances ensuite depuis ${planetRef(q)} un Transporter chargé de ${charge} vers ${planetRef(dst)}, arrivée vers ${hm(arrive)} — il repart à vide, ces vaisseaux restent basés sur ${planetRef(q)}.`,
             dur:(aller-Tm)/1000, end:aller, kind:'transfer', ships, p:src.i, dest:q.coords, mission:4});
        libres--;
      }
      for(let lance=0; lance<Math.min(3, libres) && expoBusy.filter(e=>e>Tm).length < maxExpo; lance++){
        const expoTgt = p => { const [g,sy] = parseC(p.coords)||[1,1,1]; return `${g}:${sy}:16`; };
        const cands = P.map(p=>({p, f:expoFleet(p.ships)})).filter(x=>x.f && !refused(moveKey('expo', (real.planets[x.p.i]||{}).id, expoTgt(x.p)))).sort((a,b)=>b.f.cargo-a.f.cargo);
        if(!cands.length) break;
        const {p, f} = cands[0], tgt = expoTgt(p);
        const fl = flight(p.coords, tgt, f.ships, 100); if(!fl) break;
        const total = 2*fl.secs + 3600, fuel = fl.fuel*2, c=[0,0,fuel];
        const dRate = Math.max(1, production(p).d), smallFuel = p.st[2] >= fuel && fuel/dRate*3600 <= 15*60;
        if(!smallFuel && !can(p,c,reserveOf(p,Tm))){ waits.push({q:'Flotte · '+planetRef(p), what:'Expédition', eta:wait(p,c), miss:missOf(p,c), kind:'expo', p:p.i}); break; }
        pay(p,c);
        for(const [k,n] of Object.entries(f.ships)){ p.ships[k]-=n; sim.away[k]=(sim.away[k]||0)+n; }
        const ret = Tm + total*1000, out = Object.assign({}, f.ships);
        expoBusy.push(ret);
        sim.ev.push({at:ret, fn:()=>{ for(const [k,n] of Object.entries(out)){ p.ships[k]=(p.ships[k]||0)+n; sim.away[k]-=n; } }});
        acts.push({q:'Flotte · '+planetRef(p), what:'Expédition : '+shipList(f.ships), why:`vers ${tgt}, retour vers ${hm(ret)} · ${fmt(fuel)} deut · soute ${fmt(f.cargo)} pour ${fmt(f.cap)} max`, cost:c, dur:total, end:ret, kind:'expo', ships:out, p:p.i, dest:tgt, mission:15});
      }
      for(const p of P){
        if(p.b.shipyard<1 || p.sq>Tm) continue;
        /* Un lot sorti du chantier sans être relu : on ne sait plus combien de
           satellites tournent, donc on n'en propose pas d'autres. */
        if(p.flou) continue;
        /* Le prix n'est pas le seul critère : un satellite ne se répare pas,
           il part en débris au premier raid et l'énergie retombe le jour où on
           en a le plus besoin. Sans défense vue sur la planète, la centrale —
           qui ne se pille pas — l'emporte quelle que soit la différence de
           prix. planetAlerts dit pourquoi. */
        if(!p.def) continue;
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
        } else { const e=wait(p,c); soft.push({p, cost:c, eta:e}); waits.push({q:'Chantier spatial · '+planetRef(p), what:`${n} Satellites solaires`, eta:e, miss:missOf(p,c), kind:'sats', p:p.i}); }
      }
      // Les deux files de forme de vie sont indépendantes de la file des
      // bâtiments : elles tournent en parallèle, mais puisent au même stock.
      // Passées avant, elles servent les premières et ignorent ce qu'un
      // bâtiment épargne ; passées après, elles s'effacent devant lui.
      const lfPass = devant=>{
        /* ponytail: le coût en énergie d'une case non encore construite n'est pas
           lu sur la page du jeu ; on se contente du bilan actuel. À remplacer par
           la consommation lue dans l'infobulle quand le lecteur la relèvera. */
        if(lfMode()==='off') return;
        for(const p of P) for(const q of ['lfbuilding','lfresearch']){
          if(p.lfq[q]>Tm) continue;
          const ch = lfCandidates(p, q)[0]; if(!ch) continue;
          // softRes ne retient que les chantiers de moins de trois heures : c'est
          // le bon arbitrage pour la flotte, qui part et revient. Pour les
          // formes de vie, « après les bâtiments » doit valoir aussi pour une
          // centrale à six heures, sinon le réglage ne protège presque rien.
          const res = devant ? reserveOf(p,Tm)
            : reserveOf(p,Tm).map((x,j)=>x+softAll(p)[j]);
          if(can(p, ch.cost, res)){
            pay(p, ch.cost); p.lfq[q] = Tm + ch.secs*1000;
            const id = ch.id, lvl = ch.next;
            sim.ev.push({at:Tm + ch.secs*1000, fn:()=>{ if(p.lf[id]) p.lf[id] = Object.assign({}, p.lf[id], {lvl, cost:null}); }});
            acts.push({q:'Forme de vie · '+planetRef(p), what:`${ch.nom} ${ch.next}`, why:ch.why, src:ch.src, at:ch.at, cost:ch.cost, dur:ch.secs, end:Tm+ch.secs*1000, kind:'lf', id:ch.id, lvl:ch.next, p:p.i});
          } else {
            const eta = wait(p, ch.cost);
            waits.push({q:'Forme de vie · '+planetRef(p), what:`${ch.nom} ${ch.next}${ch.src==='estimé' ? ' (prix et durée estimés)' : ''}`, src:ch.src, eta, held:res.some(x=>x>0), heldBy:heldByOf(p,Tm), miss:missOf(p, ch.cost), kind:'lf', id:ch.id, p:p.i});
            soft.push({p, cost:ch.cost, eta});
          }
        }
      };
      /* Une case de forme de vie consomme de l'énergie comme une mine. Tant que
         la planète est en négatif, la passer devant revient à payer un bâtiment
         dont la production est déjà bridée : la centrale d'abord. */
      if(lfMode()==='first') lfPass(true);
      for(const p of P){
        if(p.bq>Tm) continue;
        const gPrio = goals.find(g=>g.p===p && g.key.startsWith('prio:'));
        const cands = pickBuildings(p, {T:Tm, iv, wantColony, dep, labNeed:nr.labNeed, labP, researchRunning:sim.rq>Tm, goals, hub:hubP, prio:gPrio ? prioPas.get(p.id) : null});
        if(!cands.length) continue;
        const res = reserveOf(p,Tm);
        /* La réserve se calcule par candidat, et pas une fois pour la liste :
           un candidat impayable en tête bloquait tous les suivants, donc une
           réserve de priorité qui rend la centrale de secours impayable
           empêchait la planète de construire quoi que ce soit — ni le secours,
           ni la priorité, et pour aussi longtemps que l'épargne dure. Ce que
           la réserve retient, ce sont les mines du classement. */
        const ch = cands.find(x=>can(p, levelCost(B[x.k],x.lvl), x.libre ? reserveOf(p,Tm,gPrio) : res));
        if(ch){ const c=levelCost(B[ch.k],ch.lvl); pay(p,c); const d=buildTime(ch.k,ch.lvl,p), k=ch.k, L=ch.lvl; p.bq=Tm+d; p.bqKey=k; sim.ev.push({at:Tm+d, fn:()=>{ p.b[k]=Math.max(p.b[k],L); }}); acts.push({q:'Bâtiment · '+planetRef(p), what:`${B[k].n} ${L}`, why:ch.why, cost:c, dur:d, end:Tm+d, kind:'b', k, lvl:L, p:p.i}); }
        else { const w=cands.map(x=>({x, eta:wait(p,levelCost(B[x.k],x.lvl))})).sort((a,b)=>a.eta-b.eta)[0];
          // `held` dira un jour « retenu : tu épargnes pour Labo 10 », et un
          // candidat que la réserve ne regarde pas ne doit pas le dire à tort.
          waits.push({q:'Bâtiment · '+planetRef(p), what:`${B[w.x.k].n} ${w.x.lvl}`, eta:w.eta, held:(w.x.libre ? reserveOf(p,Tm,gPrio) : res).some(x=>x>0), heldBy:heldByOf(p,Tm,w.x.libre ? gPrio : null), miss:missOf(p,levelCost(B[w.x.k],w.x.lvl)), kind:'b', k:w.x.k, p:p.i}); soft.push({p, cost:levelCost(B[w.x.k],w.x.lvl), eta:w.eta}); }
        /* Une priorité qui n'a pas été servie cette session le dit elle-même.
           Elle n'est que le troisième candidat : un secours payable à chaque
           session la mangeait l'une après l'autre sans qu'une seule ligne le
           dise, et la ligne d'attente ci-dessus ne parle que du candidat le
           plus proche, qui n'est pas elle. L'attente se mesure après le
           paiement du chantier retenu : c'est de là que le joueur repart. */
        const lePas = cands.find(x=>x.prio);
        if(lePas && lePas !== ch && !waits.some(x=>x.p===p.i && x.k===lePas.k)){
          const c = levelCost(B[lePas.k], lePas.lvl);
          waits.push({q:'Bâtiment · '+planetRef(p), what:`${B[lePas.k].n} ${lePas.lvl}`, why:lePas.why, eta:wait(p,c), held:reserveOf(p,Tm,gPrio).some(x=>x>0), heldBy:heldByOf(p,Tm,gPrio), miss:missOf(p,c), kind:'b', k:lePas.k, p:p.i});
        }
      }
      if(lfMode()==='after') lfPass(false);
      // Chaque planète qui a un chantier peut construire : le hub pour la soute
      // de l'empire, une colonie pour ses propres transporteurs.
      for(const p of P){
        const estHub = p === hubP;
        /* `flou` : le chantier a sorti un lot dont le jeu n'a pas dit le
           nombre. Proposer ici reviendrait à compter sur une flotte et une
           défense d'avant le lot — c'est ce qui faisait revenir « 10 grands
           transporteurs » à chaque plan. */
        if(p.b.shipyard>=1 && p.sq<=Tm && !p.flou){
          const total = k=>P.reduce((a,q)=>a+(q.ships[k]||0),0) + (sim.away[k]||0);
          const pr = P.reduce((a,q)=>{ const r=production(q); return a+mse(r.m,r.c,r.d); },0);
          const cap = expoFind(total('pf')>0);
          const cargoTarget = Math.min(cap, pr*6), lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
          const cargoNow = total('lc')*lcC + total('sc')*scC;
          const big = shipReqOk('lc',p) ? 'lc' : 'sc', unitC = big==='lc'?lcC:scC;
          const wants = [];
          if(estHub && shipReqOk('pr',p) && total('pr')<5) wants.push({k:'pr', n:5-total('pr'), why:'Sondes pour espionner les inactifs avant de les piller'});
          /* Les foreuses ne passent par le chantier que si le classement les met
             devant les mines : sinon elles prendraient la place d'un niveau de
             mine moins cher au gain. */
          /* Classement calculé une fois, et comparé par clé : deux appels à
             rankUpgrades rendent deux jeux d'objets neufs, donc l'égalité de
             référence qui gardait cette ligne n'était jamais vraie et aucune
             foreuse n'a jamais été proposée. */
          const rk = rankUpgrades(p), cw = rk[0] && rk[0].key==='crawl' ? rk[0] : null;
          if(cw) wants.unshift({k:'crawl', n:cw.n, why:`Meilleur amortissement de cette planète : ${dur(cw.payback*3600)}`});
          if(estHub && shipReqOk(big,p) && cargoNow < cargoTarget){ const miss = Math.ceil((cargoTarget-cargoNow)/unitC); wants.push({k:big, n:Math.max(1, Math.ceil(miss/4)), why:`Soute pour expéditions et pillages : ${fmt(cargoNow)} sur ${fmt(cargoTarget)} visés`}); }
          /* L'Éclaireur est donné pour exclusif à l'Explorateur par les pages
             Gameforge : le proposer à un Collectionneur envoyait vers un
             chantier qui ne l'affiche pas. */
          if(estHub && S.settings.cls==='explorer' && shipReqOk('pf',p) && total('pf')<1) wants.push({k:'pf', n:1, why:'Un éclaireur double les gains des expéditions (bonus communautaire, à vérifier en jeu)'});
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
          /* La défense n'entrait jamais dans le plan : mines, transporteurs,
             satellites, et une planète pleine restait une ferme gratuite. Elle
             passe par le même chantier et la même file que les vaisseaux, donc
             par les mêmes wants : ce qui la rendait absente, c'est qu'aucun ne
             la demandait.
             Aucune défense du tout passe devant tout le reste — c'est le cas où
             le raid est gratuit pour l'attaquant. Au-dessus de zéro elle se
             complète en dernier, avec ce que le chantier a de libre.
             def valant null, la page Défense n'a jamais été lue : proposer
             reviendrait à doubler ce qui existe déjà. dailyMissions le réclame. */
          /* Une planète nue se complète d'un coup : le raid y est gratuit.
             Au-dessus de zéro, par paquets d'au moins une tournée de
             production : un laser à l'unité vaudrait une connexion pour
             cinquante secondes de chantier. La cible monte avec les mines, donc
             un écart trop petit n'est pas perdu — il attend d'en valoir la
             peine pendant que le plan passe à la pièce suivante. */
          const lotDe = k => Math.max(1, Math.ceil(tournee(p)/mse(...DEF[k].c)));
          const besoin = defNeed(p, p.def ? lotDe : null);
          if(besoin){
            const d = DEF[besoin.k], pourquoi = DEF_POURQUOI[besoin.k];
            const n = p.def ? (d.un ? 1 : Math.min(besoin.n, Math.max(lotDe(besoin.k), Math.ceil(besoin.n/4)))) : besoin.n;
            const w = {k:besoin.k, n,
              why:p.def
                ? `${d.un ? `Aucun ${d.o} sur une planète qui en mérite un` : `${besoin.have} ${besoin.have>1?d.p:d.o} sur ${besoin.cible} vis${besoin.cible>1?'és':'é'}`} : ${pourquoi}`
                : `Aucune défense : le premier pilleur repart avec la moitié de ton stock sans rien perdre. Visé ici : ${shipList(besoin.mix.cible)}, de quoi valoir la moitié d'une nuit de production. Elle te rend non rentable, pas invulnérable : le stock, lui, se protège en vol.`};
            p.def ? wants.push(w) : wants.unshift(w);
          }
          const res = reserveOf(p,Tm).map((x,j)=>x+softRes(p)[j]);
          for(const w of wants){
            const c = SHIP_COST[w.k], afford = Math.min(...c.map((x,j)=>x>0 ? Math.floor((p.st[j]-res[j])/x) : Infinity));
            const n = Math.min(w.n, afford); if(n<1) continue;
            const cost = c.map(x=>x*n), d = shipTime(w.k,n,p), k=w.k;
            /* Un lot plus petit qu'une tournée de production ne vaut pas la
               connexion : personne ne revient toutes les vingt secondes pour un
               laser. Le reliquat reste au stock et sort en paquet la fois
               d'après. Un lot qui termine ce qui était visé passe quand même. */
            if(n < w.n && mse(...cost) < tournee(p)) continue;
            // La foreuse se compte à part, comme le fait la lecture du jeu :
            // production() et rankUpgrades() lisent p.crawlers, jamais la flotte.
            pay(p,cost); p.sq = Tm+d; sim.ev.push({at:Tm+d, fn:()=>addBuilt(p, {[k]:n})});
            const estDef = !!DEF[k];
            acts.push({q:(estDef?'Défense · ':'Chantier spatial · ')+planetRef(p), what:'Construire '+shipList({[k]:n}), why:w.why, cost, dur:d, end:Tm+d, kind:estDef?'def':'shipbuild', ships:{[k]:n}, p:p.i});
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
    return {now, sessions, busy, startV, endV, ups, alerts};
  } finally { S.tech = real.tech; S.planets = real.planets; }
}
/* Les valeurs à retaper dans le jeu, en pastilles cliquables. Le presse-papier
   reste du côté du joueur : c'est lui qui colle, l'extension ne remplit aucun
   champ — ce serait jouer à sa place, et c'est ce qui fait bannir un compte.
   Les coordonnées sont découpées comme les trois champs du jeu. */
function copyChips(a){
  const out = [];
  // Ce que le lien fait remplir par le jeu n'a pas à être retapé ; les
  // ressources, elles, restent à saisir à la main.
  if(!fleetUrl(a)){
    for(const [k,n] of Object.entries((a && a.ships) || {})) if(n>0) out.push([SHIPS[k] ? SHIPS[k].n : SHIP_PLURAL[k] || k, String(n)]);
    const c = a && a.dest ? parseC(a.dest) : null;
    if(c) [['galaxie',c[0]],['système',c[1]],['position',c[2]]].forEach(x=>out.push([x[0], String(x[1])]));
  }
  const RES = ['métal','cristal','deutérium'];
  ((a && a.res) || []).forEach((x,j)=>{ if(x>0) out.push([RES[j], String(Math.floor(x))]); });
  if(!out.length) return '';
  return `<div class="cp"><span class="cpl">À recopier</span>` + out.map(([l,v])=>`<button class="chip" data-copy="${esc(v)}" aria-label="Copier ${esc(v)}" title="Copier ${esc(v)}">${esc(l)} <b>${esc(v)}</b><span class="ci" aria-hidden="true">⧉</span></button>`).join('') + `</div>`;
}
/* Une carte dit d'abord quoi faire, ce que ça coûte et quand c'est fini : le
   reste — pourquoi cette action, d'où viennent les chiffres, ce que le lien
   fait vraiment — se lit à la demande derrière le ⓘ. Ces phrases restent
   vraies et atteignables ; les empiler sur la carte les rendait illisibles.
   Le ⓘ se pose sur la ligne du type de carte, son texte s'ouvre sous la carte :
   un <details> ne sait pas séparer son résumé de son corps, d'où ce repli à la
   main. `button` est déjà exclu du clic qui ouvre le jeu : le ⓘ ne navigue pas. */
let whyN = 0;
/** @returns {string[]} [le bouton ⓘ, le texte replié] — vides s'il n'y a rien à dire. */
function whyParts(parts){
  const p = parts.filter(Boolean);
  if(!p.length) return ['', ''];
  const id = 'why' + (++whyN);
  return [`<button class="i" type="button" aria-expanded="false" aria-controls="${id}" aria-label="Pourquoi cette action">ⓘ</button>`,
    `<div class="why" id="${id}" hidden>${p.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`];
}
function actHtml(a, withBtn){
  const [wi, wb] = whyParts([a.why,
    a.src==='estimé' ? 'Prix et durée estimés d\'après les niveaux déjà vus, pas lus sur le jeu ; la durée est probablement sous-estimée.' : a.src==='lu' && a.at ? `Prix lu à ${hm(a.at)}.` : '',
    goNote(a)]);
  const m = [a.cost ? costHtml(a.cost) : '', a.dur ? `<span class="mono">${dur(a.dur)}</span>` : '', a.end ? `<span>fin ${hm(a.end)}</span>` : '', copyChips(a)].filter(Boolean).join('');
  let btn = '';
  if(withBtn && a.kind==='fleet') btn = `<button class="btn sm" data-sent="1">Envoyé</button>`;
  else if(withBtn) btn = `<button class="btn sm primary" data-launch='${esc(JSON.stringify({kind:a.kind,k:a.k,lvl:a.lvl,pid:(S.planets[a.p]||{}).id,n:a.n,id:a.id,ships:a.ships,cost:a.cost,coords:a.coords,dur:Math.round(a.dur),what:a.what}))}'>Lancé</button>`;
  if(withBtn && NO_KINDS[a.kind]) btn = `<span class="btns">${btn}${noBtn(moveKey(a.kind, (S.planets[a.p]||{}).id, a.dest))}</span>`;
  return `<li${goAttr(actGo(a))}><div><div class="q">${qHtml(a.q)}${wi}</div><div class="w">${esc(a.what)}</div></div>${btn||'<span></span>'}${m?`<div class="m">${m}</div>`:''}${wb}</li>`;
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
/** Ce qu'une planète a au sol, en soute. */
function cargoCap(p){ return ['lc','sc'].reduce((a,k)=>a + ((p.ships||{})[k]||0)*shipStats(k).cargoEff, 0); }
/** Ce qui dort sur une planète, les trois ressources additionnées. */
function fsLoad(p){ const st = stockNow(p); return st[0]+st[1]+st[2]; }
/**
 * Les transporteurs à prendre sur cette planète pour lever `amount` de soute.
 * Les grands d'abord : moins de vaisseaux, un seul temps de vol.
 * @returns {object} {ships, cargo} — cargo plafonné par ce qui est au sol
 */
function pickCargo(p, amount){
  const ships = {}; let cargo = 0;
  for(const k of ['lc','sc']){
    const have = (p.ships||{})[k] || 0, unit = shipStats(k).cargoEff;
    if(!have || !unit || cargo >= amount) continue;
    const n = Math.min(have, Math.ceil((amount-cargo)/unit));
    if(n>0){ ships[k] = n; cargo += n*unit; }
  }
  return {ships, cargo};
}

/* Codes de mission du jeu, et leur nom dans le client français. */
const FS_MISSION = {deployment:4, espionage:6, expedition:15};
const FS_MISSION_N = {deployment:'Stationner', espionage:'Espionner', expedition:'Expédition'};

/**
 * La mise à l'abri d'une seule planète, avec ce qu'elle a sur place.
 *
 * Le wiki OGame ne laisse pas le choix sur le seul cas que l'extension
 * connaisse, celui du joueur sans lune : la seule mise à l'abri sûre est un
 * DÉPLOIEMENT d'une de tes planètes vers une autre. Transport, recyclage et
 * attaque se voient à la phalange, et dès que le retour commence il n'y a plus
 * rien à faire ; un déploiement rappelé est la seule mission vers une planète
 * qu'une phalange ne voie pas. L'extension proposait un Transporter, que le
 * wiki range parmi les suicides.
 *
 * Un déploiement ne vole qu'à l'aller : la vitesse se cale donc pour qu'il
 * ARRIVE après le réveil, et non pour qu'il revienne. Les ressources passent
 * la nuit en vol et se posent quand le joueur est là pour les dépenser.
 *
 * Sans seconde planète : espionnage vers la position 16, aller-retour, les
 * ressources reviennent avec la flotte — il y faut une sonde. À défaut une
 * expédition, que le wiki ne compte pas parmi les mises à l'abri, mais qui
 * vaut mieux que laisser le stock au sol.
 *
 * ponytail: pas de lune, pas de champ de débris, pas de portée de phalange —
 * l'extension n'en lit aucun. Le déploiement de lune à lune, que le wiki met
 * en tête, demanderait d'abord que le modèle connaisse les lunes.
 */
function fsFor(p, now, wake){
  const need = fsLoad(p);
  if(need < FS_MIN) return null;
  const {ships, cargo} = pickCargo(p, need);
  if(!Object.keys(ships).length) return null;
  const c = parseC(p.coords); if(!c) return null;

  /* Les candidats, dans l'ordre de préférence du wiki : un déploiement vers une
     de tes planètes d'abord, puis la position 16 d'un système choisi pour son
     temps de vol — « choose the system according to flight time ». Le système
     d'à côté ne suffit pas : entre deux planètes voisines, même à 10 %, un
     déploiement se pose avant le réveil, et un aller-retour sur place garde la
     flotte en l'air jusqu'au milieu de la matinée. */
  const essais = [];
  for(const q of S.planets) if(q !== p && q.coords) essais.push({mode:'deployment', dest:q.coords});
  const rond = (p.ships||{}).pr > 0 ? 'espionage' : 'expedition';
  for(const d of [0, 20, 50, 100, 200, 300]) essais.push({mode:rond, dest:`${c[0]}:${((c[1] - 1 + d) % 499) + 1}:16`});

  /* Pour une destination donnée, plus lent veut dire plus tard : les crans qui
     tiennent forment la fin de la liste. On s'arrête donc aux trois premiers,
     ce qui borne aussi le nombre d'appels à flight(). */
  const bons = [];
  for(const e of essais){
    const flotte = e.mode === 'espionage' ? Object.assign({pr:1}, ships) : ships;
    const trajets = e.mode === 'deployment' ? 1 : 2;
    const hold = e.mode === 'expedition' ? 3600e3 : 0;
    let pris = 0;
    for(const pct of FS_SPEEDS){
      if(pct === 100 || pris >= 3) continue;   // 100 % : le vol le plus court, donc le plus facile à chronométrer
      const fl = flight(p.coords, e.dest, flotte, pct); if(!fl) continue;
      const fin = now + trajets*fl.secs*1000 + hold;
      if(fin > wake){ bons.push({mode:e.mode, dest:e.dest, ships:flotte, pct, fl, fin, oneWay:trajets===1}); pris++; }
    }
  }
  if(!bons.length) return null;

  /* On veut revenir le plus tôt possible APRÈS le réveil : plus tôt veut dire
     moins de matinée sans flotte, et un système proche veut dire moins de
     deutérium. Six heures de battement au-delà du réveil, sinon le « plus sûr »
     devient une flotte indisponible toute la journée. */
  const tot = x => x.fin;
  const serre = bons.filter(x=>x.fin < wake + 6*3600e3);
  const pool = serre.length ? serre : bons;
  const dep = pool.filter(x=>x.mode==='deployment').sort((a,b)=>tot(a)-tot(b));
  const alt = pool.filter(x=>x.mode!=='deployment').sort((a,b)=>tot(a)-tot(b));
  /* Le déploiement d'abord dès qu'il tient : c'est le seul qui se rappelle, et
     un déploiement rappelé est la seule mission vers une planète qu'une
     phalange ne voie pas. Les autres, une fois le retour commencé, ne laissent
     plus rien à faire. */
  const choix = dep.length ? dep : alt;
  // « Avoid using the same speed each time you fleetsave » : le cran change avec
  // le jour, pas à chaque rafraîchissement, sinon le plan se contredirait.
  const ch = choix[new Date(now).getDate() % Math.min(3, choix.length)];
  return {from:p, ships:ch.ships, dest:ch.dest, mission:ch.mode, oneWay:ch.oneWay, pct:ch.pct,
          arrive: now + ch.fl.secs*1000, back: ch.fin, fuel:ch.fl.fuel,
          load:need, cargo:souteUtile(cargo, ch.fl.fuel*(ch.oneWay?1:2))};
}

/**
 * Ce qu'il faut envoyer en l'air avant de dormir, planète par planète.
 * Ne regardait que la planète la plus chargée, et n'utilisait que SES
 * vaisseaux : à force de rapatriements les transporteurs finissent stationnés
 * sur les colonies, la principale se retrouvait pleine et sans soute, et la
 * fonction rendait null — la carte du soir retombait sur un conseil général
 * pendant que la planète la plus riche passait la nuit à découvert.
 * Chaque planète part donc avec ce qu'elle a ; `rest` porte les autres lots,
 * et cargoGaps() dit où est la flotte quand elle manque.
 * @returns {object|null} le plus gros lot protégeable, plus `rest`
 */
function fleetsavePlan(now){
  const wake = wakeTime(now);
  if(!wake) return null;
  const lots = S.planets.map(p=>fsFor(p, now, wake)).filter(Boolean)
    .sort((a,b)=>Math.min(b.load,b.cargo) - Math.min(a.load,a.cargo));
  if(!lots.length) return null;
  return Object.assign({}, lots[0], {rest:lots.slice(1)});
}

/**
 * Les planètes dont la soute au sol ne lèvera pas ce qui dort dessus, et où
 * sont les transporteurs qui manquent. C'est l'inventaire : sans lui, « mes
 * grands transporteurs sont tous sur les colonies » reste invisible.
 * @returns {Array<object>} {p, load, cargo, manque, ailleurs:[{p, dispo}]}
 */
function cargoGaps(){
  /* Un donneur ne prête que son surplus : ce qu'il a en soute moins ce qu'il
     devra lever lui-même le soir. Sinon le conseil déplace le trou. */
  const dispo = S.planets.map(p=>({p, cargo:cargoCap(p), dispo:Math.max(0, cargoCap(p) - pickCargo(p, fsLoad(p)).cargo)}));
  const out = [];
  for(const {p, cargo} of dispo){
    const load = fsLoad(p);
    if(load < FS_MIN || cargo >= load) continue;
    const manque = load - cargo;
    const libres = dispo.filter(x=>x.p!==p && x.dispo>0).sort((a,b)=>b.dispo-a.dispo);
    /* Le surplus d'un donneur ne se prête qu'une fois. Compté en entier pour
       chaque colonie, il promettait la même soute à toutes : cinq cartes
       « Ramène 1 grand transporteur de la même planète », et dès le premier
       rapatriement lancé les autres s'évanouissaient, sans que rien ne dise
       que le besoin, lui, restait. Ce qui est promis ici est donc retenu là. */
    out.push({p, load, cargo, manque, ailleurs: libres.map(x=>({p:x.p, dispo:x.dispo}))});
    if(libres[0]) libres[0].dispo = Math.max(0, libres[0].dispo - manque);
  }
  return out;
}

/* ---------- daily missions ---------- */
const LIFEFORMS = {humans:{n:'Humains', why:'polyvalents'}, rocktal:{n:'Roctas', why:'mineurs : production et bâtiments moins chers'}, mechas:{n:'Mécas', why:'vaisseaux et chantier spatial'}, kaelesh:{n:'Kaeleshs', why:'expéditions et recherche'}};
/* Bâtiments de forme de vie, par espèce. Relevé sur la partie du joueur le
   12 novembre 2026 ; un seul bâtiment reconnu nomme l'espèce, et un bâtiment
   au niveau 0 figure quand même dans le panneau. À compléter au fil des relevés. */
const LF_BUILDINGS = {
  humans: ['Centre de recherche'],
  rocktal: ['Centre technologique runique'],
  mechas: ['Centre de recherche en robotique']
};
/**
 * Espèce d'une planète déduite des libellés de bâtiments d'un relevé de panneau
 * ("Nom (Niveau N)"). La présence du bâtiment suffit, son niveau n'y change rien.
 * @param {object} r relevé de prodOf
 * @returns {string|null} clé de LIFEFORMS, null si aucun bâtiment connu
 */
function speciesOf(r){
  const rows = r && Array.isArray(r.rows) ? r.rows : [];
  const names = rows.map(x => String((x && x.label) || '').replace(/\s*\(Niveau\s*\d+\)\s*$/i, '').trim().toLowerCase());
  return Object.keys(LF_BUILDINGS).find(k => LF_BUILDINGS[k].some(n => names.includes(n.toLowerCase()))) || null;
}
/**
 * Espèce d'une planète d'après son relevé, s'il a moins de sept jours.
 * @param {object} p planète de S.planets
 * @returns {string|null}
 */
function speciesOfPlanet(p){
  const r = prodOf(p);
  return r && Date.now() - r.at < LF_READ_TTL ? speciesOf(r) : null;
}
/**
 * Espèces installées sur au moins une planète, d'après les relevés récents.
 * @returns {string[]}
 */
function readLifeforms(){
  return [...new Set(S.planets.map(speciesOfPlanet).filter(Boolean))];
}
/**
 * Espèces connues du compte : celles cochées dans les réglages (découvertes)
 * plus celles lues sur les planètes (installées, donc découvertes). Une lecture
 * s'ajoute à la coche, elle n'en retire jamais.
 * @returns {string[]}
 */
function foundLifeforms(){
  return [...new Set([...(S.lf.found || ['humans']), ...readLifeforms()])];
}
/**
 * Pastilles des réglages : une espèce lue sur une planète s'affiche sans case,
 * les autres restent à cocher.
 * @returns {string}
 */
function lfSettingsHtml(){
  const lues = readLifeforms();
  return Object.entries(LIFEFORMS).map(([k,l]) => lues.includes(k)
    ? `<span class="pill good" style="padding:6px 12px">${l.n} · lue sur tes planètes</span>`
    : `<label class="pill ${S.lf.found.includes(k)?'good':'info'}" style="cursor:pointer;padding:6px 12px"><input type="checkbox" data-lf="${k}" ${S.lf.found.includes(k)?'checked':''} style="width:auto;margin-right:6px">${l.n}</label>`).join('');
}
function bestLifeform(){
  const f = foundLifeforms();
  const pref = S.day.focus==='fleet' ? ['mechas','kaelesh','rocktal','humans'] : ['rocktal','humans','mechas','kaelesh'];
  return pref.find(k=>f.includes(k)) || 'humans';
}
/**
 * Fleet slots [used, max] from the last sync, or null.
 * Le chiffre lu date de la dernière page de flotte ouverte ; une mission
 * lancée depuis occupe un emplacement que ce chiffre ignore. Le copilote la
 * connaît — c'est son minuteur —, alors il la compte. La prochaine lecture la
 * contient à son tour : le dédoublonnage se fait sur l'heure.
 */
function fleetSlots(){
  if(!(S.slots && S.slots.fleet && S.syncAt && Date.now()-(S.slots.at||S.syncAt) < 3*3600e3)) return null;
  const [pris, max] = S.slots.fleet, lu = S.slots.at || S.syncAt, now = Date.now();
  const depuis = (S.timers||[]).filter(t=>t.kind==='x' && (t.k==='fleet' || t.k==='expo')
    && t.manual && !t.done && t.end>now && t.at>lu).length;
  return [Math.min(max, pris+depuis), max];
}
/* How long a reading of the in-flight expedition count stays trustworthy.
   The cap is never expired by expoCap(), because it only moves with
   Astrophysics; the number in flight does move on its own, so it needs its
   own guard. Never expiring it would silence the panel for the rest of the
   day after a single "2/2", which costs as much trust as the lie it fixes. */
const EXPO_READ_TTL = 3*3600e3;
/* Le bonus de forme de vie lu dans le panneau décrit les niveaux du moment :
   au-delà de sept jours on le laisse, mieux vaut sous-estimer que décrire un
   empire qui n'existe plus. */
const LF_READ_TTL = 7*86400e3;
/* Le chiffre vient d'une expression régulière sur le texte d'une page du jeu,
   où s'affichent des chaînes écrites par d'autres joueurs, et il sert de borne
   de boucle. Un nombre absurde y gèlerait le panneau. Le jeu ne dépasse pas une
   poignée d'expéditions simultanées ; trente-deux laisse toute la marge utile
   et tient dans n'importe quel cas. */
const EXPO_MAX_READ = 32;
/**
 * Expeditions in flight, as last read on the game's fleet page.
 * @returns {{n:number, at:number}|null} count and reading time, or null when
 *   nothing fresh enough has been read.
 */
function expoInFlight(){
  if(!(S.slots && S.slots.expo)) return null;
  /* L'heure de la lecture, et rien d'autre. Se rabattre sur `syncAt` comme le
     fait fleetSlots() rendrait éternellement frais un `slots` enregistré avant
     la 1.25, quand l'heure n'était pas estampillée : le panneau se tairait sur
     les expéditions jusqu'à la prochaine ouverture de la page de flotte. */
  const at = S.slots.at;
  const n = Math.min(Math.max(0, Math.floor(Number(S.slots.expo[0]) || 0)), EXPO_MAX_READ);
  return at && Date.now()-at < EXPO_READ_TTL ? {n, at} : null;
}
/* Expéditions simultanées. Le chiffre du jeu fait foi quand il est frais : la
   formule ne sert plus qu'à prévoir ce qu'un niveau d'Astrophysique y
   ajouterait. La prendre au maximum des deux faisait proposer une expédition
   que le jeu refusait. */
function expoCap(astro){
  const f = a => Math.floor(Math.sqrt(Math.max(0, a))) + (S.settings.cls==='explorer' ? 2 : 0);
  /* Pas de péremption sur ce chiffre : le nombre d'expéditions simultanées ne
     bouge qu'avec Astrophysique. Seul le nombre d'expéditions en cours se périme,
     et il ne sert pas ici. Le jeter au bout de trois heures ramenait le plan à
     la formule dès que le joueur n'avait pas rouvert la page Flotte. */
  const lu = S.slots && S.slots.expo && S.slots.expo[1] > 0;
  const base = lu ? S.slots.expo[1] : f(S.tech.astro);
  return Math.max(0, base + f(astro == null ? S.tech.astro : astro) - f(S.tech.astro));
}
/** Niveau d'Astrophysique qui donnera une expédition simultanée de plus. */
function astroForExpo(){ return Math.pow(Math.floor(Math.sqrt(Math.max(0, S.tech.astro)))+1, 2); }
/* Expéditions que la flotte au sol pourrait remplir, plafond ignoré. Comptées
   jusqu'à douze : au-delà, seul « plus que le plafond » compte. */
function expoWanted(){
  let n = 0;
  for(const p of S.planets){
    const reste = Object.assign({}, p.ships);
    while(n < 12){
      const f = expoFleet(reste); if(!f) break;
      for(const [k,c] of Object.entries(f.ships)) reste[k] = (reste[k]||0) - c;
      n++;
    }
  }
  return n;
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
  const nExp = expoCap(), veut = expoWanted();
  /* D'où vient le plafond, en clair : lu sur la page de flotte, ou déduit
     d'Astrophysique faute de l'avoir lue. Sans ça, les deux cas donnent la même
     carte et « rien n'a changé » est indécidable. */
  /* L'heure de la lecture, et pas seulement le chiffre : il ne vaut que trois
     heures, et le joueur doit pouvoir juger si celui-ci est encore d'actualité. */
  const sExp = S.slots && S.slots.expo
    ? `lu dans le jeu à ${hm(S.slots.at || S.syncAt)} : ${S.slots.expo[0]}/${S.slots.expo[1]}` : null;
  const sFl = fs ? `emplacements de flotte ${fs[0]}/${fs[1]}` : null;
  const source = sExp ? ` (${[sExp, sFl].filter(Boolean).join(`, `)})` : ` (déduit d'Astrophysique ${S.tech.astro} : la page de flotte n'a pas encore été lue)`;
  const flottes = S.planets.map(p=>expoFleet(Object.assign({}, p.ships))).filter(Boolean);
  /* Une expédition ne rapporte jamais plus que la soute envoyée. Quand toutes
     les flottes sont loin de ce plafond, un emplacement de plus ne rapporte
     rien : réclamer Astrophysique enverrait dépenser pour rien. Ce sont des
     transporteurs qu'il manque. */
  if(veut <= nExp && nExp >= 1 && flottes.length && flottes.every(f=>f.cargo < f.cap*0.7)){
    const best = flottes.reduce((a,f)=>f.cargo>a.cargo?f:a);
    const manque = Math.ceil((best.cap-best.cargo)/shipStats('lc').cargoEff);
    out.push({id:'expocargo', info:true, q:'Exploration', every:24, sev:'warn',
      what:`Tes expéditions partent à ${Math.round(best.cargo/best.cap*100)} % de leur soute utile`,
      why:`Une expédition ne rapporte jamais plus que la soute envoyée : ${fmt(best.cargo)} embarqués pour ${fmt(best.cap)} ramenables. Un emplacement de plus n'y changerait rien — des transporteurs, si.`,
      how:[`Chantier spatial : environ ${manque} grands transporteurs de plus pour saturer une expédition.`,
        `Astrophysique n'ajoute un emplacement qu'au niveau ${astroForExpo()} : inutile tant que les soutes repartent à moitié vides.`,
        'Les transporteurs servent aussi au rapatriement et à la mise à l'+"'"+'abri du soir.']});
  }
  /* Le plafond des planètes, là où le joueur lit son plan. Le conseil de l'onglet
     Suivi le disait déjà, mais personne ne va l'y chercher — et une colonie vaut
     plus que n'importe quelle recherche de la feuille de route. */
  if(S.tech.astro && S.planets.length >= maxPlanets()){
    const need = astroForPlanet(), c = rangeCost(T.astro, S.tech.astro, need);
    out.push({id:'colomax', info:true, q:'Colonie', every:24, sev:'warn',
      what:`Plafond atteint : ${maxPlanets()} planètes`,
      why:`Astrophysique ${need} en autoriserait une ${maxPlanets()+1}ᵉ, pour ${fmt(c[0])} métal, ${fmt(c[1])} cristal et ${fmt(c[2])} deutérium. Une colonie ajoute une production complète : aucune recherche ne rapporte autant. ${coloPaybackTxt()}`,
      how:[`Recherche : Astrophysique ${S.tech.astro+1}${need>S.tech.astro+1 ? ` (le palier utile est ${need})` : ''}.`,
        'Puis prépare la colonie dans l\'onglet Cibles › Colonie : position, vaisseaux et ressources à emporter.',
        S.day.focus==='eco' ? 'En « Économie pure » le plan ne colonise pas de lui-même : passe en « Économie + colonie » pour qu\'il s\'en charge.' : 'Le plan construira le vaisseau de colonisation de lui-même.']});
  }
  if(veut > nExp) out.push({id:'expomax', info:true, q:'Exploration', every:12, sev:'warn',
    what:`Plafond atteint : ${nExp} expédition${nExp>1?'s':''} à la fois`,
    why:`Ta flotte au sol en remplirait au moins ${veut}. Le nombre d'expéditions simultanées ne dépend que d'Astrophysique : ${nExp+1} à partir du niveau ${astroForExpo()}.${source}`,
    how:[`Recherche : Astrophysique ${S.tech.astro+1}${astroForExpo()>S.tech.astro+1 ? ` (le palier utile est ${astroForExpo()})` : ''}.`,
      `Astrophysique ${astroForPlanet()} ajouterait aussi un emplacement de colonie.`,
      'En attendant, les transporteurs en trop servent au rapatriement ou à la mise à l'+"'"+'abri du soir.']});
  /* Le taux 3:2:1 sert déjà de pondération partout ; il sert aussi à échanger.
     Quand une seule ressource retient la prochaine recherche et qu'une autre
     dort en quantité, le Marchand débloque la file sans attendre la production. */
  const NOMS_RES = ['métal', 'cristal', 'deutérium'];
  const nr0 = nextResearch(), labP0 = labPlanet();
  if(nr0.k && labP0 && !nr0.labNeed){
    const c = levelCost(T[nr0.k], nr0.lvl), st = stockNow(labP0), r = S.settings.ratio;
    const manque = [0,1,2].filter(j=>c[j] > st[j]);
    if(manque.length === 1){
      const j = manque[0], besoin = c[j] - st[j];
      // Ce qu'il faudrait céder d'une autre ressource, au taux réglé.
      const source = [0,1,2].filter(k=>k!==j && st[k] - (c[k]||0) > 0)
        .map(k=>({k, donne: besoin * r[k] / r[j], reste: st[k] - (c[k]||0)}))
        .filter(x=>x.reste >= x.donne).sort((a,b)=>b.reste-a.reste)[0];
      if(source) out.push({id:'merchant', info:true, q:'Marchand', every:6, sev:'good',
        what:`Échanger du ${NOMS_RES[source.k]} contre du ${NOMS_RES[j]} pour lancer ${T[nr0.k].n} ${nr0.lvl}`,
        why:`Il manque ${fmt(besoin)} de ${NOMS_RES[j]} sur ${labP0.name}, et ${fmt(source.reste)} de ${NOMS_RES[source.k]} y dorment. Au taux ${r.join(':')}, ${fmt(source.donne)} suffisent.`,
        how:['Marchand › Échange de ressources : choisis la ressource à céder, puis celle à recevoir.',
          'Le taux du Marchand dépend de ton antimatière : vérifie qu\'il reste proche de ton taux réglé avant de valider.',
          'Sans antimatière, fais venir la ressource manquante depuis une colonie.']});
    }
  }
  /* Une découverte prend un emplacement de flotte comme n'importe quelle autre
     mission. Tous pris, le bouton Découverte de la Galaxie est gris et dit
     « Nombre maximal de flottes atteint » : proposer la carte quand même, c'est
     envoyer le joueur cliquer sur rien. La carte des emplacements pleins, elle,
     sort déjà plus haut et explique quoi faire. */
  if(!(fs && fs[0] >= fs[1])){
    /* Les quatre races trouvées, il n'y a plus rien à découvrir de ce côté :
       promettre « de nouvelles races » et renvoyer vers les cases à cocher,
       c'est faire cliquer pour rien celui qui a déjà tout. Restent les
       artefacts, qui font tourner les technologies de forme de vie. */
    const trouvees = foundLifeforms(), toutes = trouvees.length === Object.keys(LIFEFORMS).length;
    out.push({id:'discovery', q:'Exploration', every:24, sev:'info', what:'Missions de découverte (formes de vie)', why:`${toutes ? 'Tu as les quatre races : elles ne rapportent plus que des artefacts.' : 'Elles rapportent des artefacts et de nouvelles races.'} Chacune occupe un emplacement de flotte jusqu'à son retour.${fs?` Il t'en reste ${fs[1]-fs[0]} sur ${fs[1]}.`:''}${toutes?'':` Trouvées : ${trouvees.map(k=>LIFEFORMS[k].n).join(', ')}.`}${S.artefacts!=null?` Artefacts : ${fmt(S.artefacts)}.`:''}`,
      how:['Galaxie : bouton <b>Découverte</b> en haut, ou icône ADN violette sur une ligne.', 'Fais-en sur plusieurs systèmes : le nombre par jour est limité.', 'Garde un emplacement libre pour tes expéditions : elles rapportent plus.']
        .concat(toutes ? [] : ['Une race trouvée qui n\'est pas encore lue sur tes planètes ? Coche-la dans Réglages › Formes de vie pour que Copilote en tienne compte.'])
        // Un seul emplacement libre : la prochaine découverte bloque les expéditions.
        .concat(fs && fs[1]-fs[0] <= 1 ? [leverFlotte()] : [])});
  }
  /* Choisir la technologie d'un slot, c'est lancer la recherche de forme de
     vie qui va avec : toutes les files occupées, le jeu n'en prend pas une de
     plus. Le copilote le sait, il vient d'en lancer une. Aucune case de
     recherche lue nulle part : on ne sait rien, la carte sort comme avant. */
  const lfrP = S.planets.filter(p=>Object.keys(p.lf||{}).some(id=>lfQueue(id)==='lfresearch'));
  const lfrLibre = !lfrP.length || lfrP.some(p=>!(S.timers||[]).some(t=>t.queue==='lfresearch' && t.pid===p.id && !t.done && t.end>now));
  if(lfrLibre && S.artefacts!=null && S.artefacts>=200) out.push({id:'artefacts', q:'Formes de vie', every:24, sev:'good', what:`${fmt(S.artefacts)} artefacts : choisis une technologie de forme de vie`, why:'Au palier 1, 200 artefacts permettent de choisir précisément la technologie d\'un slot au lieu du tirage aléatoire.', how:['Forme de vie › Recherche : sur un slot libre, choisis la technologie voulue.', 'Attention : changer un slot déjà pris oblige à réinitialiser tout le palier.']});
  if(IS_EXT && S.syncAt && now - S.syncAt < 3600e3){
    // Trois situations, trois messages : page jamais ouverte, page lue mais
    // aucun prix affiché, ou tout est su — et alors c'est le plan qui parle.
    // Un prix ne s'obtient qu'en ouvrant une case : le jeu ne l'affiche pas
    // dans la liste.
    const lfState = (p, q) => {
      const cases = Object.entries(p.lf || {}).filter(([id])=>lfQueue(id)===q);
      // Page déjà ouverte et vide : la file demande un bâtiment que le joueur
      // n'a pas encore. Rien à relever, donc rien à lui rappeler.
      if(!cases.length) return {need:(p.lfSeen||{})[q] ? null : 'page', n:0};
      const libres = cases.filter(([,v])=>v && v.state !== 'locked');
      if(lfCandidates(p, q).length) return {need:null, n:cases.length};
      return {need: libres.length ? 'prix' : null, n:cases.length};
    };
    const lfCard = (q, id, quoi, page) => {
      if(lfMode()==='off') return;
      const vus = S.planets.map(p=>({p, st:lfState(p,q)})).filter(x=>x.st.need);
      if(!vus.length) return;
      const page0 = vus.filter(x=>x.st.need==='page').map(x=>planetRef(x.p));
      const prix = vus.filter(x=>x.st.need==='prix');
      const quoiFaire = page0.length
        ? `Ouvre ${page} sur ${page0.join(', ')}, puis clique une case.`
        : `Clique une case ${quoi} sur ${prix.map(x=>planetRef(x.p)).join(', ')}.`;
      out.push({id, q:'Formes de vie', every:12, sev:'info', tags:vus.map(x=>planetRef(x.p)),
        what:quoiFaire,
        why:`${vus.map(x=>`${planetRef(x.p)} : ${x.st.n ? `${x.st.n} case${x.st.n>1?'s':''} lue${x.st.n>1?'s':''}, aucun prix` : 'page jamais ouverte'}`).join(' · ')}. Le prix n'apparaît qu'en ouvrant une case ; sans lui le copilote ne sait pas quand tu pourras la payer.`,
        how:['Ouvre la page sur cette planète, puis clique une case.',
          'Le copilote lit le niveau, le prix et la durée affichés par le jeu.',
          'Ensuite elle entre dans le plan comme une mine, avec le « il manque » et l\'heure.']});
    };
    lfCard('lfbuilding', 'lfb', 'de bâtiment', 'les bâtiments de forme de vie');
    lfCard('lfresearch', 'lfr', 'de recherche', 'les recherches de forme de vie');
  }
  /* Tant que la page Défense n'a pas été ouverte une fois, def vaut null et le
     copilote ignore ce qui protège la planète : il ne peut ni compléter la
     défense sans doubler ce qui existe, ni trancher entre satellites et
     centrale. Un clic contre un raid. */
  const aveugles = S.planets.filter(p=>p.def == null && p.b.shipyard>=1);
  if(aveugles.length) out.push({id:'defseen', q:'Sécurité', every:24, sev:'warn',
    what:aveugles.length>1 ? `Ouvrir la page Défense (${aveugles.length} planètes)` : `Ouvrir la page Défense sur ${planetRef(aveugles[0])}`,
    why:`Sans elle, le copilote ne sait pas ce qui te protège : il ne propose ni défense ni satellites. Une planète sans défense rend la moitié de son stock au premier pilleur, et lui ne perd rien.`,
    how:['Ouvre Défense sur chaque planète : le copilote lit chaque type au passage.', `Il ajoute ensuite les pièces manquantes au plan, avec leur prix et leur durée.`]});
  /* Le jeu nomme ce que son chantier construit, jamais combien, et sa file
     n'annonce que le lot en cours. Après un lot, le copilote ne sait donc plus
     ce qui est au sol : il se tait sur ce chantier au lieu de reproposer ce qui
     vient d'en sortir. Une page relue le rend bavard aussitôt. */
  const flous = S.planets.filter(p=>chantierFlou(p));
  if(flous.length) out.push({id:'chantierlu', q:'Chantier', every:6, sev:'warn', tags:flous.map(planetRef),
    what:flous.length>1 ? `Ouvrir la page Chantier spatial (${flous.length} planètes)` : `Ouvrir la page Chantier spatial sur ${planetRef(flous[0])}`,
    why:`Ton chantier a sorti un lot que le copilote n'a pas relu : le jeu dit ce qu'il construit, jamais combien. Tant que la page n'est pas rouverte, il ne propose ni vaisseau, ni défense, ni satellite ${flous.length>1?'sur ces planètes':'sur cette planète'} — il doublerait ce que tu viens de construire.`,
    how:['Ouvre Chantier spatial sur la planète : le copilote recompte tout au passage.', 'La page Flotte fait aussi l\'affaire pour les vaisseaux ; la page Défense pour la défense.', 'Les cartes de chantier reviennent aussitôt, avec les bons nombres.']});
  const occ = API && API.planets ? occupied() : null;
  if(occ && parseC(S.colo.target) && occ.has(S.colo.target) && occ.get(S.colo.target)!==S.me && !colSentNow()){ const alt = colonyCandidates()[0]; out.unshift({id:'colo-taken', q:'Colonie', every:6, sev:'bad', coords:S.colo.target, what:`${S.colo.target} est déjà occupée`, why:alt?`Meilleure position libre proche : ${alt.coords} (${alt.bonus||'pas de bonus'}, ~${alt.fields} cases).`:'Choisis une autre position dans Outils › Cibles.', how:['Outils › Cibles › Où coloniser : clique sur Choisir pour changer la destination.']}); }
  // Chaque sonde occupe un emplacement de flotte jusqu'à son retour : en
  // proposer plus que d'emplacements libres, c'est envoyer le joueur sur un
  // « Nombre maximal de flottes atteint ». Emplacements inconnus : on en
  // suppose assez, comme avant.
  /* Une cible déjà espionnée ne revient pas le lendemain : sans ça le plan
     répète les trois meilleures coordonnées tant qu'on ne les pille pas. */
  const dejaVu = r => { const l = S.raids[r.coords]; return !!l && now-l.at < (l.probe?24:6)*3600e3; };
  const rtAll = raidTargets().filter(r=>!r.outlaw && !dejaVu(r));
  const libres = fs ? Math.max(0, fs[1]-fs[0]) : 3, rt = rtAll.slice(0, Math.min(3, libres));
  if(S.raid && S.raid.safe && !raidPlan().stale && (S.raid.m||S.raid.c||S.raid.d)) out.unshift({id:'raid-go', q:'Pillage', every:1, sev:'good', coords:S.raid.coords, what:`Pillage de ${S.raid.coords} prêt`, why:'Les ressources sont saisies et la cible est sans défense : lance-le depuis Outils › Cibles.', how:['Outils › Cibles : vérifie la flotte proposée, puis envoie-la en mission Attaquer.', 'Clique sur Lancé pour suivre le retour.']});
  /* Plus de cibles que d'emplacements : ce n'est pas la chasse qui manque,
     c'est la place. Le dire sans nommer ce qui la donne laisse le joueur
     devant un constat. */
  /* L'œil de la Galaxie n'ouvre pas de formulaire : il envoie les sondes
     déjà au sol. Sans sonde, le jeu répond « Vous n'avez pas sélectionné de
     vaisseaux » et le joueur cherche l'erreur chez lui. On ne le sait qu'une
     fois le chantier lu : sinon p.ships est vide sans rien prouver. */
  const vuesChantier = S.planets.filter(p=>p.shipsAt);
  const sansSonde = vuesChantier.length > 0 && !vuesChantier.some(p=>((p.ships||{}).pr||0) > 0);
  const bride = rtAll.length > rt.length;
  if(rt.length) out.push({id:'raid', q:'Pillage', every:12, sev:'good', coords:rt[0].coords, mark:rt.map(r=>r.coords), what:`Espionner ${rt.length>1?'ces inactifs':'cet inactif'} : ${rt.map(r=>r.coords).join(', ')}`, whatHtml:`Espionner ${rt.length>1?'ces inactifs':'cet inactif'} : ${rt.map(r=>coordLink(r.coords)).join(', ')}`, why:`Inactifs proches et moins forts que toi : pas d'avertissement hors-la-loi.${bride?` ${rtAll.length} repérés, mais ${libres} emplacement${libres>1?'s':''} de flotte libre${libres>1?'s':''}.`:''} Détail dans Outils › Cibles.`, how:[sansSonde ? 'Aucune sonde au sol : construis-en au chantier spatial avant d\'espionner. L\'œil de la Galaxie envoie les sondes déjà là, sinon le jeu répond « Vous n\'avez pas sélectionné de vaisseaux ».' : 'Galaxie : clique sur l\'œil de la ligne pour envoyer une sonde.', 'Un chiffre ou une étoile dans sa ligne : les minutes depuis la dernière activité sur la planète. Sur un inactif, c\'est le plus souvent la sonde d\'un autre pilleur — le stock sera maigre.', 'Chaque sonde occupe un emplacement de flotte jusqu\'à son retour.', 'Rapport sans flotte ni défense et avec des ressources : mission Attaquer, assez de soute pour la moitié de son stock.'].concat(bride ? [leverFlotte()] : [])});
  else if(!rtAll.length) out.push({id:'inactive', q:'Pillage', every:24, sev:'info', what:'Repérer des inactifs à piller', why:'Les joueurs marqués (i) ou (I) ne se défendent plus. À piller dès qu\'ils sont dans ta tranche de points.',
    how:['Galaxie : parcours ton système et les voisins, note les noms gris (i)/(I).', 'Espionne-les. Si le jeu affiche « joueur plus puissant », réponds <b>Non</b> : tu perdrais ta protection pendant 7 jours.', 'Sans flotte ni défense et avec des ressources : mission Attaquer avec assez de soute.']});
  const ns = +S.day.nightStart, nd = new Date(now); nd.setHours(ns,0,0,0); if(nd.getTime() <= now) nd.setDate(nd.getDate()+1);
  const nightAt = nd.getTime() - 3600e3;
  /* Un rapatriement laisse les transporteurs stationnés là où ils ont chargé —
     c'est voulu, un Transporter repartirait seul et ne serait plus là pour la
     charge suivante. Mais rien ne les ramenait : au bout de quelques colonies,
     toute la soute dort sur les colonies et la planète la plus riche passe la
     nuit pleine, sans un vaisseau pour lever quoi que ce soit. L'inventaire le
     dit, cette carte le répare. */
  for(const g of cargoGaps()){
    const don = g.ailleurs[0]; if(!don) continue;
    const {ships, cargo} = pickCargo(don.p, Math.min(g.manque, don.dispo));
    if(!Object.keys(ships).length) continue;
    const fl = flight(don.p.coords, g.p.coords, ships, 100); if(!fl) continue;
    const arrive = now + fl.secs*1000;
    const tard = arrive > nightAt + 3600e3;
    out.push({id:'cargo-split:'+g.p.id, q:'Sécurité', every:12, sev:tard?'warn':'bad',
      what:`Ramène ${shipList(ships)} de ${planetRef(don.p)} vers ${planetRef(g.p)}`,
      ships, dest:g.p.coords, mission:4, p:S.planets.indexOf(don.p),
      why:`${planetRef(g.p)} garde ${fmt(g.load)} de ressources et ${g.cargo ? `seulement ${fmt(g.cargo)} de soute au sol` : 'aucun transporteur'} : ce soir, il n'y a rien pour les mettre à l'abri. ${fmt(don.dispo)} de soute libre dorment sur ${planetRef(don.p)}.`,
      /* taskHtml pose `how` tel quel dans innerHTML — c'est ce qui fait rendre
         le <b> — alors que what et why passent par esc(). Tout ce qui vient de
         la page du jeu s'échappe donc ici à la main. */
      how:['Mission <b>Stationner</b>, pas Transporter : un Transporter repartirait seul et les vaisseaux ne seraient plus là au coucher.',
        `${dur(fl.secs)} de vol, ${fmt(fl.fuel)} deutérium${tard ? ` — arrivée vers ${hm(arrive)}, après le début de la nuit. Pour cette nuit-là, dépense le stock sur place.` : `, arrivée vers ${hm(arrive)}, avant la nuit.`}`,
        `Il te restera ${fmt(cargo)} de soute à demeure sur ${esc(planetRef(g.p))} : garde-la là, c'est elle qui part chaque soir.`]});
  }
  if(S.day.night || (!isNight(now) && nightAt - now <= (+S.day.horizon||24)*3600e3)){
    const fs = fleetsavePlan(now);
    const m = {id:'night', q:'Sécurité', at:nightAt, every:24, sev:'warn',
      what:`Avant la nuit (${ns} h) : mettre tes ressources à l'abri`,
      why:'Une planète pleine pendant ton sommeil est une cible.',
      how:['Dépense tout ce que tu peux (files longues, satellites).', 'Envoie le reste avec tes transporteurs en mission longue (transport vers une colonie à vitesse 10 %, ou expédition).', 'Au réveil, rappelle ou récupère la flotte.']};
    if(fs){
      m.what = `Avant la nuit (${ns} h) : envoie ${shipList(fs.ships)} en mission ${FS_MISSION_N[fs.mission]} vers ${fs.dest}`;
      m.ships = fs.ships; m.dest = fs.dest; m.p = S.planets.indexOf(fs.from);
      m.mission = FS_MISSION[fs.mission];
      m.why = `${fmt(fs.load)} ressources à l'abri sur ${fs.from.name}. Une flotte en vol ne peut pas être détruite ; ce qui dort au sol se fait prendre.`;
      m.how = [
        'Dépense d\'abord ce que tu peux : lance une construction longue et une recherche.',
        `Charge <b>tout</b> le stock dans ${shipList(fs.ships)} sur ${esc(fs.from.name)}, destination ${esc(fs.dest)}, mission ${FS_MISSION_N[fs.mission]}. Ne laisse rien de valeur au sol.`,
        `Règle la vitesse sur ${fs.pct} % — c'est la seule chose que le lien ne prépare pas, et elle change d'un jour à l'autre exprès : une routine se chronomètre. ${fs.oneWay ? `La flotte se pose vers ${hm(fs.arrive)}` : `La flotte rentre vers ${hm(fs.back)}`}, après ton réveil. Coût : ${fmt(fs.fuel)} deutérium.`
      ];
      /* Le pourquoi de la méthode, et pas seulement le quoi : c'est lui qui
         évite au joueur de « simplifier » en Transporter le soir où il est
         pressé. */
      if(fs.mission === 'deployment') m.how.push(`Sois en ligne <b>avant l'arrivée</b> : si une attaque se présente, <b>rappelle</b> le déploiement. Un déploiement rappelé est la seule mission vers une planète qu'une phalange ne voie pas — c'est ce qui en fait la seule mise à l'abri sûre tant que tu n'as pas de lune. Un Transporter, lui, se voit, et une fois le retour commencé tu ne peux plus rien.`);
      else if(fs.mission === 'espionage') m.how.push(`La sonde fait la mission : sans elle le jeu refuse l'ordre. La flotte revient chargée, rien ne se pose ailleurs. Dès que tu auras une deuxième planète, le déploiement sera plus sûr : lui se rappelle.`);
      else m.how.push(`L'expédition est un pis-aller : elle garde la flotte en l'air, mais peut te coûter des vaisseaux et le wiki ne la compte pas parmi les mises à l'abri. Garde une sonde au sol et tu pourras partir en Espionner vers la position 16 ; une deuxième planète te donnera le déploiement.`);
      for(const r of fs.rest||[]) m.how.push(`Puis depuis ${esc(planetRef(r.from))} : ${shipList(r.ships)} vers ${esc(r.dest)}, mission ${r.mission==='transport'?'Transporter':'Expédition'} à ${r.pct} %, chargés de ${fmt(Math.min(r.load, r.cargo))} — retour vers ${hm(r.back)}.`);
    }
    /* La mise à l'abri protège la flotte et ce qu'elle emporte, pas les planètes
       qu'elle laisse derrière : elles produisent huit heures de plus. Les nommer,
       parce que c'est exactement ce que le pilleur d'inactifs vient chercher. */
    const nuit = (+S.day.nightEnd - +S.day.nightStart + 24) % 24 || 8;
    /* Ce que la mise à l'abri emporte ne reste pas exposé. Le compter quand
       même annonçait au joueur qu'il laissait derrière lui le stock qu'on
       venait de lui dire de charger : sur une planète vidée, il ne reste que
       la production de la nuit. */
    const emporte = new Map();
    if(fs) for(const r of [fs].concat(fs.rest||[])) emporte.set(r.from, Math.min(r.load, r.cargo));
    const exposees = S.planets.map(p=>{
      const pr = production(p), st = stockNow(p);
      const part = (emporte.get(p)||0) / Math.max(1, st[0]+st[1]+st[2]);
      const reste = st.map(x=>x*Math.max(0, 1-part));
      const fin = [0,1,2].map(j=>Math.min(pr.cap[j], reste[j] + [pr.m,pr.c,pr.d][j]*nuit));
      return {p, eq: mse(fin[0], fin[1], fin[2])};
    }).filter(x=>x.eq > 50000).sort((a,b)=>b.eq-a.eq);
    /* Une planète sans donneur n'a pas de carte « Ramène… » : l'envoyer la
       chercher serait l'envoyer vers rien. Elle est nommée à part, avec le
       seul geste qui lui reste. */
    const trous = cargoGaps(), ligne = x=>`${esc(planetRef(x.p))} (${fmt(x.load)}, il manque ${fmt(x.manque)} de soute)`;
    const aides = trous.filter(x=>x.ailleurs[0]), seules = trous.filter(x=>!x.ailleurs[0]);
    if(aides.length) m.how.push(`Sans soute pour les lever : ${aides.map(ligne).join(', ')}. Les cartes « Ramène… » disent d'où la faire venir.`);
    if(seules.length) m.how.push(`Sans soute pour les lever, et plus rien à emprunter : ${seules.map(ligne).join(', ')}. Toute la soute libre de l'empire est déjà promise ailleurs — il faut en construire sur place.`);
    if(exposees.length) m.how.push(`Resteront exposés au matin : ${exposees.map(x=>`${esc(planetRef(x.p))} (~${fmt(x.eq)} éq.)`).join(', ')}. ${exposees[0].p.def == null ? 'Ouvre la page Défense pour que le plan monte ce qu\'il faut.' : `Le plan monte ${esc(planetRef(exposees[0].p))} à ${esc(defMixList(exposees[0].p))} : à ce prix-là, percer coûte plus cher qu'emporter.`}`);
    out.push(m);
  }
  /* Les files vides relevées par le dernier import de la Vue empire. Le garde
     se lit dans l'autre sens : dès que l'extension a lu le jeu plus récemment
     que l'import, c'est elle qui sait, et un vieux relevé ne doit pas ressortir. */
  const importFresh = !S.syncAt || (S.lastImport||0) >= S.syncAt - 60000;
  if(importFresh) for(const a of S.lastAlerts||[]){
    if(!/file vide|arr[eê]t/i.test(a)) continue;
    out.push({id:'empty-queue-'+norm(a).replace(/[^a-z0-9]+/g,'-'), info:true, q:'Empire', every:24, sev:'warn',
      what:a, why:'Signalé par le dernier import de la Vue empire. Une file vide, c\'est du temps de production perdu.',
      how:['Ouvre la planète concernée et lance une construction ou une recherche.',
           'Réimporte la Vue empire pour que le relevé se mette à jour.']});
  }
  /* Mode nuit : le joueur va dormir. Seule la rubrique Sécurité parle de
     mettre les ressources à l'abri ; tout le reste attendra le réveil. */
  return S.day.night ? out.filter(m=>m.q === 'Sécurité') : out;
}
/* Le copilote ne voit pas ce que le joueur décide dans le jeu : une carte qu'il
   a choisi de ne pas suivre revient au plan suivant, et au suivant — cinq fois
   la même, et le panneau ne sert plus à rien. « Non » la met donc de côté, et
   elle y reste : rien ne la ramène dans le dos du joueur. C'est lui qui la
   remet, d'un bouton, sous les cartes d'Aujourd'hui comme dans Réglages. */
/* Seuls les mouvements : une construction disparaît dès « Lancé », elle n'a
   rien à refuser. */
const NO_KINDS = {transfer:1, expo:1, fleet:1};
/* Ce qui identifie un mouvement d'un plan au suivant : d'où, vers où, de quel
   genre. L'identifiant de la planète, pas son rang : le rang change dès qu'on
   oublie une planète, et la simulation échange S.planets contre ses copies, qui
   n'en portent aucun — d'où l'identifiant passé par l'appelant. */
function moveKey(kind, pid, dest){ return `${kind}:${pid||''}:${dest||''}`; }
function refused(key){ return !!S.daily.no[key]; }
/** Combien de cartes sont mises de côté en ce moment. */
function noCount(){ return Object.keys(S.daily.no).length; }
function noBtn(key){ return `<button class="btn sm ghost" data-no="${esc(key)}" title="Ne plus proposer ça">Non</button>`; }
/** Le bouton qui remet toutes les cartes refusées — vide s'il n'y en a aucune. */
function noRestore(){
  const n = noCount();
  return n ? `<button class="btn sm ghost" data-noclear="1">Remettre ${n} carte${n>1?'s':''} refusée${n>1?'s':''}</button>` : '';
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
/* Un tas d'un seul type ne défend rien, quelle que soit la somme dépensée :
   le croiseur tire dix fois par lanceur de missiles et pas une fois par laser
   léger, le destructeur l'inverse. Les deux ensemble, et aucune des deux
   flottes ne fait l'affaire. Au-dessus, les gros canons sont la seule chose
   qui abîme un gros vaisseau, et le bouclier est le point de bouclier le
   moins cher du jeu, sans tir rapide de personne contre lui.
   Les proportions sont celles des stratégies de début de partie du wiki
   OGame, rapportées à une unité de chair à canon (`per`) ; `un` marque ce qui
   ne se construit qu'une fois, à partir de tant de chair à canon au sol.
   Coûts, prérequis et tirs rapides relevés sur le wiki.
   ponytail: pas de missiles — ils demandent un silo que le copilote ne lit
   pas ; et les proportions restent celles du début de partie, celles de la fin
   supposeraient que le joueur voie passer des étoiles de la mort. */
const DEF = {
  rl: {n:'Lanceur de missiles', o:'lanceur de missiles',   p:'lanceurs de missiles',  c:[2000,0,0],          per:'fodder', r:{b:{shipyard:1}, t:{}}},
  ll: {n:'Laser léger',         o:'laser léger',           p:'lasers légers',         c:[1500,500,0],        per:'fodder', r:{b:{shipyard:2}, t:{laser:3}}},
  sd: {n:'Petit bouclier',      o:'petit bouclier',        p:'petits boucliers',      c:[10000,10000,0],     un:20,        r:{b:{shipyard:1}, t:{shielding:2}}},
  hl: {n:'Laser lourd',         o:'laser lourd',           p:'lasers lourds',         c:[6000,2000,0],       per:1/10,     r:{b:{shipyard:4}, t:{energy:3, laser:6}}},
  ic: {n:'Artillerie à ions',   o:'artillerie à ions',     p:'artilleries à ions',    c:[5000,3000,0],       per:1/20,     r:{b:{shipyard:4}, t:{ion:4}}},
  gc: {n:'Canon de Gauss',      o:'canon de Gauss',        p:'canons de Gauss',       c:[20000,15000,2000],  per:1/50,     r:{b:{shipyard:6}, t:{weapons:3, energy:6, shielding:1}}},
  ld: {n:'Grand bouclier',      o:'grand bouclier',        p:'grands boucliers',      c:[50000,50000,0],     un:100,       r:{b:{shipyard:6}, t:{shielding:6}}},
  pt: {n:'Lanceur de plasma',   o:'lanceur de plasma',     p:'lanceurs de plasma',    c:[50000,50000,30000], per:1/100,    r:{b:{shipyard:8}, t:{plasma:7}}},
};
/* L'ordre de construction : la chair à canon d'abord, elle protège le reste et
   c'est elle que la masse rend dissuasive ; les canons ensuite, du moins cher
   au plus cher. Le même ordre que le wiki fait suivre au joueur. */
const DEF_ORDER = ['rl','ll','sd','hl','ic','gc','ld','pt'];
/* Ce que chaque pièce apporte, en une proposition qui se compose. Sans ça le
   joueur lit « 4 canons de Gauss » sans savoir ce qu'ils arrêtent. */
const DEF_POURQUOI = {
  rl: 'du métal pur, aucune recherche : la masse qui encaisse les tirs',
  ll: 'le croiseur dévore les lanceurs de missiles et ne peut rien contre les lasers légers, le destructeur l\'inverse : les deux ensemble, et aucune des deux flottes ne fait l\'affaire',
  hl: 'balaie les chasseurs légers que les pilleurs mettent devant, pour que les gros canons tirent sur les gros vaisseaux',
  ic: 'cinq cents points de bouclier chacune, le double de tout le reste : ce qui absorbe',
  gc: 'le premier canon qui abîme un vaisseau de bataille ; seule une étoile de la mort a un tir rapide contre lui',
  pt: 'le seul canon que personne ne survole : aucun vaisseau n\'a de tir rapide contre lui',
  sd: 'soixante-quinze points de bouclier par millier dépensé, sept fois tout le reste, et personne n\'a de tir rapide contre lui',
  ld: 'dix mille points de bouclier d\'un bloc, sans tir rapide de personne',
};
const SHIP_COST = {sc:[2000,2000,0], lc:[6000,6000,0], pr:[0,1000,0], pf:[8000,15000,8000], crawl:CRAWLER_COST};
const SHIP_REQ = {sc:{b:{shipyard:2}, t:{combustion:2}}, lc:{b:{shipyard:4}, t:{combustion:6}}, pr:{b:{shipyard:3}, t:{combustion:3, espionage:2}}, pf:{b:{shipyard:5}, t:{hyperdrive:2}}, crawl:{b:{shipyard:5}, t:{combustion:4, armour:4, laser:4}}};
/* La défense passe par le même chantier, la même file et les mêmes wants que
   les vaisseaux : un seul endroit la nomme et la tarife. */
for(const [k,d] of Object.entries(DEF)){ SHIP_COST[k] = d.c; SHIP_REQ[k] = d.r; SHIP_PLURAL[k] = d.p; SHIP_ONE[k] = d.o; }
function shipReqOk(k, p){ const r = SHIP_REQ[k]; return Object.entries(r.b).every(([b,l])=>p.b[b]>=l) && Object.entries(r.t).every(([t,l])=>S.tech[t]>=l); }
function shipTime(k, n, p){ const c = SHIP_COST[k]; return n*(c[0]+c[1])/(2500*(1+p.b.shipyard)*Math.pow(2,p.b.nanite)*S.settings.eco)*3600; }
/* Le relevé d'avant ne donnait qu'un total et le comptait en lanceurs : on lui
   laisse ce sens plutôt que de le jeter, sinon une défense déjà construite
   disparaît le jour de la mise à jour et le plan la redemande. */
const defsOf = p => p.defs || (p.def == null ? null : {rl:p.def});
/** Chair à canon au sol, les deux types confondus comme le fait le wiki. */
const defFodder = have => (have.rl||0) + (have.ll||0);
/**
 * Le mélange que cette planète mérite, et ce qu'il coûte.
 * Ce que le pilleur d'inactifs vient chercher, c'est la production accumulée
 * pendant la plus longue absence de la journée — la nuit — et il en emporte la
 * moitié. Une défense qui vaut cette moitié-là lui coûte plus cher à percer
 * qu'elle ne rapporte : il passe à la planète suivante. Contre une vraie flotte
 * elle ne tient pas, rien ne tient, et c'est la mise à l'abri qui sert.
 * La cible suit donc la production, pas le stock : un stock se vide, une mine
 * continue de remplir.
 * Le budget s'achète par paquets, pas par pièces : une unité de chair à canon
 * traîne sa part de gros canons, et c'est ce paquet qu'on paie. Ce que le
 * joueur n'a pas encore les moyens de chercher sort du paquet, et son budget
 * repart dans ce qui reste.
 * @param {object} p planète
 * @returns {{n:number, cible:object, types:string[]}|null} null si même le
 *   lanceur de missiles est hors de portée
 */
function defMix(p){
  const types = DEF_ORDER.filter(k=>shipReqOk(k,p));
  const chair = types.filter(k=>DEF[k].per==='fodder');
  if(!chair.length) return null;
  const poids = k => DEF[k].per==='fodder' ? 1/chair.length : DEF[k].per;
  const paquet = types.filter(k=>DEF[k].per).reduce((a,k)=>a + poids(k)*mse(...DEF[k].c), 0);
  const nuit = (+S.day.nightEnd - +S.day.nightStart + 24) % 24 || 8;
  const pr = production(p);
  const butin = mse(pr.m, pr.c, pr.d) * nuit / 2;
  const n = Math.max(1, Math.ceil(butin / paquet));
  const cible = {};
  /* Le bouclier ne rejoint le mélange qu'à partir de la taille où le wiki le
     place : annoncé plus tôt, il promet une pièce qui coûte dix fois toute la
     défense visée et que le plan ne proposera jamais. */
  for(const k of types) cible[k] = DEF[k].un ? (n >= DEF[k].un ? 1 : 0) : Math.ceil(n * poids(k));
  return {n, cible, types};
}
/**
 * Combien de chair à canon cette planète mérite, les deux types confondus.
 * @param {object} p planète
 * @returns {number} 0 si rien n'est constructible
 */
function defTarget(p){ const m = defMix(p); return m ? m.n : 0; }
/**
 * La pièce qui manque le plus tôt dans l'ordre de construction, ou null quand
 * le mélange est au complet. Une pièce à la fois : le chantier n'en sort
 * qu'une, et un plan qui réclame tout d'un coup ne se lit pas.
 * @param {object} p planète
 * @returns {{k:string, n:number, cible:number, have:number, mix:object}|null}
 */
function defNeed(p, lot){
  const mix = defMix(p), have = defsOf(p);
  if(!mix || !have) return null;
  const chair = defFodder(have);
  for(const k of DEF_ORDER){
    if(!mix.cible[k]) continue;
    /* Un bouclier ne se construit qu'une fois, et pas sur une planète nue :
       il protège ce qui tire, il ne remplace rien. */
    if(DEF[k].un){ if(chair >= DEF[k].un && !(have[k] > 0)) return {k, n:1, cible:1, have:0, mix}; continue; }
    const manque = mix.cible[k] - (have[k]||0);
    /* Un écart plus petit qu'un lot ne vaut pas la connexion : on passe à la
       pièce suivante. Le plancher ne dépasse jamais la cible, sinon une petite
       planète dont toute la défense coûte moins d'une tournée n'en aurait
       jamais. */
    if(manque > 0 && (!lot || manque >= Math.min(lot(k), mix.cible[k]))) return {k, n:manque, cible:mix.cible[k], have:have[k]||0, mix};
  }
  return null;
}
/** Le mélange visé en clair : « 120 lanceurs de missiles, 120 lasers légers… ». */
function defMixList(p){ const m = defMix(p); return m ? shipList(m.cible) : ''; }
/** Ce que cette planète produit entre deux connexions, en métal. */
function tournee(p){ const r = production(p); return mse(r.m, r.c, r.d) * Math.max(15,+S.day.interval||90)/60; }
function hubIndex(){ let best=0; S.planets.forEach((p,i)=>{ if(p.b.lab+p.b.shipyard > S.planets[best].b.lab+S.planets[best].b.shipyard) best=i; }); return best; }
/* ---------- le centre ---------- */
/* La planète où vivent le labo et le chantier. Le wiki l'appelle Vault Planet
   et dit ce qu'on y fait : « should build most of your fleets, defenses, and
   do most of the research ». Il en donne aussi les trois règles, et ce sont
   elles qu'on applique ici : c'est la plus grande planète ; ce n'est pas la
   planète mère, dont le nombre de cases est borné ; et un joueur de flotte
   n'en veut pas, ses planètes devant rester dispersées.
   Ce que ça corrige : `labP` prenait la planète au plus haut labo, donc, sur
   un empire neuf où toutes sont à zéro, la première de la liste — la mère.
   Le premier labo de la partie atterrissait par accident et y restait, la
   règle se nourrissant d'elle-même. */
/** L'index du centre dans S.planets, ou -1 quand l'empire n'en a pas. */
function centreIndex(auto){
  const P = S.planets;
  /* Une planète seule n'est le centre de rien, et le joueur de flotte n'en
     veut pas : dans les deux cas tout le reste retombe sur l'ancien
     comportement. */
  if(P.length < 2 || S.day.focus === 'fleet') return -1;
  if(!auto && S.centre){ const i = planetIndexById(S.centre); if(i >= 0) return i; }
  /* Les cases décident tant que rien n'est bâti, le bâti décide ensuite : un
     bâtiment payé est payé, et en déplacer un coûterait tout ce qu'il a déjà
     coûté. Le centre ne bouge donc jamais de lui-même. */
  /* Seul le labo décide. Le chantier n'a aucune prétention sur le centre : le
     laisser derrière ne coûte rien, puisqu'une colonie monte le sien dès
     qu'elle en a besoin. Le labo, lui, est suivi par `labP` et `labLevel()` :
     un centre posé ailleurs ferait repayer un labo déjà payé, et c'est le pire
     conseil que le copilote puisse donner. Le faire décider par le chantier
     faisait exactement ça — une colonie au chantier plus haut que le labo de
     la mère emportait la recherche — et faisait bouger le centre tout seul au
     premier chantier de transporteur. */
  const cases = p => ((POS[(parseC(p.coords)||[])[2]] || {}).avg) || 0;
  const pose = P.some(p => (p.b.lab||0) > 0);
  const note = p => pose ? (p.b.lab||0) : cases(p);
  const valeur = p => { const r = production(p); return mse(r.m, r.c, r.d); };
  let best = 0;
  for(let i = 1; i < P.length; i++){
    const a = note(P[i]), b = note(P[best]);
    /* À note égale la production départage ; à production égale, l'index le
       plus grand l'emporte, c'est-à-dire une colonie plutôt que la mère. */
    if(a > b || (a === b && valeur(P[i]) >= valeur(P[best]))) best = i;
  }
  return best;
}
/** L'index du centre, ou celui que `hubIndex` désignait avant lui : les liens
    de page n'ont besoin que d'une planète, et sans centre rien ne change. */
function centreOrHub(){ const i = centreIndex(); return i >= 0 ? i : hubIndex(); }
/** L'index de la planète qui porte la plus grosse soute — la même mesure que
    `donorsOf` pour choisir sa base. 0 quand aucune n'a de transporteur. */
function cargoHomeIndex(){
  const cargo = p => (((p.ships||{}).lc)||0)*25000 + (((p.ships||{}).sc)||0)*5000;
  let best = 0;
  S.planets.forEach((p,i)=>{ if(cargo(p) > cargo(S.planets[best])) best = i; });
  return best;
}
/** Ce qu'on ajoute à la raison d'un bâtiment d'empire : pourquoi là et pas
    ailleurs. Vide quand l'empire n'a pas de centre. */
/* La même phrase sur la carte du plan et sur celle de pickBuildings : écrite
   deux fois, elles auraient dérivé. */
const POURQUOI_LABO = 'Débloque la recherche suivante.';
function centreNote(){ return centreIndex() >= 0 ? ' Ton centre : c\'est de là que partent tes recherches et tes vaisseaux.' : ''; }
/** Le centre, ou null. */
function centrePlanet(){ const i = centreIndex(); return i >= 0 ? S.planets[i] : null; }
/** Pourquoi le copilote a désigné cette planète, ou '' quand c'est le joueur
    qui l'a désignée : une raison qu'on n'a pas donnée ne se conteste pas. */
function centreWhy(){
  const i = centreIndex();
  /* Elle ne se tait que si le joueur a choisi autrement que le conseil :
     confirmer le conseil ne doit pas faire disparaître sa raison au moment
     même où il est d'accord avec elle. */
  if(i < 0 || i !== centreIndex(true)) return '';
  const p = S.planets[i];
  if((p.b.lab||0) > 0) return `elle porte déjà le labo ${p.b.lab} : le déplacer coûterait tout ce qu'il a coûté`;
  const pos = (parseC(p.coords) || [])[2], avg = ((POS[pos] || {}).avg) || 0;
  return avg ? `position ${pos}, ${avg} cases en moyenne : un centre est d'abord de la place` : '';
}
/** Parses metal, crystal and deuterium from a pasted espionage report. */
function parseReport(txt){
  const num = label=>{ const m = String(txt).match(new RegExp(label+'\\s*:?\\s*(\\d[\\d.,]*)\\s*(Mn|M|k|K)?', 'i')); if(!m) return null; const suf = m[2]||''; if(/m/i.test(suf)) return Math.round(parseFloat(m[1].replace(/\./g,'').replace(',','.'))*1e6); if(/k/i.test(suf)) return Math.round(parseFloat(m[1].replace(/\./g,'').replace(',','.'))*1e3); return +m[1].replace(/[.,]/g,'') || 0; };
  return [num('M[ée]tal'), num('Cristal'), num('Deut[ée]rium')];
}
/** Fleet and outcome for a raid on the selected target. */
function raidPlan(){
  const r = S.raid; if(!r) return null;
  /* Un rapport vieillit : la cible produit, et surtout elle peut avoir été
     pillée entre-temps. Au-delà de deux heures il ne décrit plus rien. */
  const stale = !r.at || Date.now()-r.at > 2*3600e3;
  /* Un raid se compose avec les transporteurs posés sur la planète de départ :
     la bonne planète est donc celle qui les a, pas celle qui porte une charge.
     Un centre désigné à la main sur une colonie neuve donnerait sinon un plan
     de raid sans vaisseaux, et il le dirait en silence. */
  const home = S.planets[cargoHomeIndex()], res = [+r.m||0, +r.c||0, +r.d||0];
  const rate = S.settings.cls==='explorer' ? .75 : .5, loot = res.map(x=>Math.floor(x*rate)), need = loot[0]+loot[1]+loot[2];
  const av = home.ships||{}, lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
  let left = need; const lc = Math.min(av.lc||0, Math.ceil(left/lcC)); left -= lc*lcC; const sc = left>0 ? Math.min(av.sc||0, Math.ceil(left/scC)) : 0; left -= sc*scC;
  const ships = {}; if(lc) ships.lc = lc; if(sc) ships.sc = sc;
  const fl = (lc||sc) ? flight(home.coords, r.coords, ships, 100) : null;
  const fuel = fl ? fl.fuel*2 : 0, cargo = souteUtile(lc*lcC + sc*scC, fuel), got = Math.min(need, cargo);
  return {home, loot, need, ships, fl, cargo, got, fuel, stale, short: Math.max(0,left), net: got - fuel*S.settings.ratio[0]/S.settings.ratio[2]};
}

/* Un outil retiré laisse son nom dans les réglages du joueur : on ne demande à
   VIEWS que ce qu'il sait encore dessiner. */
const TOOLS = [['explore','Cibles'],['colony','Colonie'],['fleet','Flotte']];
function toolTab(){ return TOOLS.some(([k])=>k===S.ui.tool) ? S.ui.tool : 'colony'; }

/** Ce que la carte du centre dit sous la case : le risque que le wiki nomme,
    et ce qu'un centre sans labo laisse derrière lui. Vide ailleurs. */
function centreNoteHtml(p, i, ci){
  return i === ci ? `Un espionnage montre où tu bases ta flotte : mets-la à l'abri comme ailleurs.${labLaisse(p)}` : '';
}
/** La vocation d'une planète, en une pastille et sa raison. Rien à dire est
    aussi une information : rien ne distingue cette planète des autres. */
function vocHtml(v){
  if(!v) return `<span class="note">${S.planets.length < 2
    ? 'Une seule planète : rien à comparer pour l\'instant.'
    : 'Pas de vocation marquée : son sol ne la distingue d\'aucune autre.'}</span>`;
  const nom = v.keys.length ? v.keys.map(k=>VOC_NOM[k]).join(' et ') : 'Vocation inconnue';
  return `<span class="pill info">${nom}</span>${v.why?`<span class="note">${esc(v.why)}</span>`:''}`;
}
/** Ce qu'un centre sans labo laisse derrière lui. Le copilote obéit au joueur,
    mais il ne lui cache pas qu'un labo déjà payé ne suivra pas. */
function labLaisse(p){
  const autre = S.planets.filter(x=>x!==p).reduce((a,x)=>(!a || (x.b.lab||0)>(a.b.lab||0)) ? x : a, null);
  if(!autre || (autre.b.lab||0) <= (p.b.lab||0)) return '';
  return ` Le labo ${autre.b.lab} de ${esc(planetRef(autre))} ne suit pas : repartir d'un labo 1 ici coûterait ${fmt(mse(...rangeCost(B.lab, 0, autre.b.lab)))} en équivalent métal.`;
}
const VIEWS = {
/* Ce que le joueur vient chercher, c'est la carte à suivre maintenant : elle
   seule reste dépliée. Le reste — la journée qui vient, les minuteurs — se
   replie, en disant dans son titre ce qu'il contient, pour qu'on sache s'il
   vaut la peine d'être ouvert. */
today(){
  const d=S.day;
  return `<section class="panel">
    <div class="card"><div class="row spread"><h2>Maintenant</h2><div class="row" style="gap:8px"><span class="note" id="tdStamp"></span><button class="btn sm ${d.night?'primary':'ghost'}" id="dayNight">${d.night?'☀️ Mode jour':'🌙 Mode nuit'}</button></div></div><div id="tdNow"></div></div>
    <div id="tdAlerts"></div>
    <details class="card"${fold('journee', false)}><summary data-fold="journee">Ta journée <span class="note" id="tdDaySum"></span></summary>
      <p class="note">${esc(FOCUS[d.focus]||'')} · toutes les ${d.interval} min · nuit ${d.nightStart}h–${d.nightEnd}h <button class="btn sm ghost" data-goto="settings">Modifier</button></p>
      <div id="tdDay"></div>
    </details>
    <details class="card"${fold('minuteurs', true)}><summary data-fold="minuteurs">Minuteurs <span class="note" id="tmSum"></span></summary>
      <ul class="timers" id="tmList"></ul>
      <details><summary class="note">Ajouter un minuteur à la main</summary>
        <div class="timer-form" style="margin-top:8px">
          <label class="f">Quoi<select id="tmWhat">${timerOptions()}</select></label>
          <label class="f">Temps restant (copié du jeu)<input id="tmLeft" placeholder="2h 13m 05s"></label>
          <button class="btn primary" id="tmAdd">Lancer</button>
        </div>
      </details>
      <div class="row"><button class="btn sm ghost" id="tmSound">Tester le son</button></div>
    </details>
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
  const sub = toolTab();
  return `<section class="panel"><div class="seg" role="tablist">${TOOLS.map(([k,l])=>`<button role="tab" data-tool="${k}" aria-selected="${sub===k}">${l}</button>`).join('')}</div>${VIEWS[sub]()}</section>`;
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
    ${(()=>{ const voc = vocations(), ci = centreIndex(), auto = centreIndex(true); return S.planets.map((p,i)=>`
    <div class="card" data-pi="${i}">
      <div class="planet-head">
        <input id="pn-${p.id}" data-p="name" value="${esc(p.name)}" aria-label="Nom de la planète">
        <input id="pc-${p.id}" class="coords" data-p="coords" value="${esc(p.coords)}" aria-label="Coordonnées" placeholder="1:1:8">
        <input id="pt-${p.id}" class="temp" type="number" data-p="tmax" value="${p.tmax}" aria-label="Température max (°C)" title="Température max en °C (vue d'ensemble)">
        <span class="note">°C max</span>
        ${S.planets.length>1?`<button class="btn sm ghost" data-del="${i}">Retirer</button>`:''}
      </div>
      <div class="res" id="pres-${i}"></div>
      <div class="row" style="gap:8px" id="pvoc-${i}">${vocHtml(voc[p.id])}</div>
      <div class="row" style="gap:8px">${ci<0
        ? `<span class="note">${S.day.focus==='fleet'
            ? 'Stratégie flotte : pas de centre, tes planètes doivent rester dispersées.'
            : 'Un centre se choisit entre plusieurs planètes.'}</span>`
        : `<label class="f" style="width:auto"><input id="pcentre-${p.id}" type="checkbox" data-centre="${p.id}" ${i===ci?'checked':''}> Centre${auto===i?' (conseillé)':''}</label>${i===ci&&centreWhy()?`<span class="note">${esc(centreWhy())}</span>`:''}`}</div>
      <p class="note" style="margin:0" id="pctrn-${i}">${centreNoteHtml(p, i, ci)}</p>
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
    </div>`).join(''); })()}
    <div class="row"><button class="btn" id="addPlanet">Ajouter une colonie</button>
    <span class="note" id="colonyNote"></span></div>
  </section>`;
},
research(){
  return `<details class="card"><summary>Recherches <span class="note">labo niveau <b id="labLv"></b></span></summary>
    <div class="tbl-wrap"><table><thead><tr><th>Technologie</th><th class="n">Niv.</th><th>Coût prochain niv.</th><th class="n">Durée</th><th>État</th></tr></thead><tbody>
    ${Object.keys(T).map(k=>`<tr><td>${T[k].n}</td><td class="n"><input id="t-${k}" type="number" min="0" data-t="${k}" value="${S.tech[k]}"></td><td id="tc-${k}"></td><td class="n" id="tt-${k}"></td><td id="ts-${k}"></td></tr>`).join('')}
    </tbody></table></div>
  </details>`;
},
fleet(){
  const ex=S.expo, fc=S.fleetCalc;
  return `<section class="panel">
    <div class="card"><h2>Taille d'expédition</h2>
      <div class="grid">
        <label class="f">Points du n°1 de l'univers<select id="top1" data-set="top1">${EXPO_LABELS.map((l,i)=>`<option value="${i}" ${S.settings.top1==i?'selected':''}>${l}</option>`).join('')}</select>${API && API.scores ? `<span class="note">Lu dans le classement public : ${EXPO_LABELS[top1Tier()]}. Ce réglage ne sert plus.</span>` : '<span class="note">Sera lu dans le classement public dès que l\'extension aura joint l\'API du serveur.</span>'}</label>
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
        <label class="f">Planète de départ${centreIndex()>=0?`<span class="note">Ton centre, ${esc(planetRef(centrePlanet()))}, sort le vaisseau tant qu'il en est le centre.</span>`:''}<select id="coFrom" data-colo="fromId">${S.planets.map(p=>`<option value="${p.id}" ${c.fromId===p.id?'selected':''}>${esc(p.name)} [${esc(p.coords)}]</option>`).join('')}</select></label>
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
settings(){
  const s=S.settings, d=S.day;
  return `<section class="panel">
    <div class="card"><h2>Plan du jour</h2>
      <div class="grid">
        <label class="f">Priorité<select id="dFocus" data-day="focus">${Object.entries(FOCUS).map(([k,l])=>`<option value="${k}" ${d.focus===k?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="f">Je me connecte toutes les<select id="dInt" data-day="interval">${[30,60,90,120,180].map(v=>`<option value="${v}" ${+d.interval===v?'selected':''}>${v} min</option>`).join('')}</select></label>
        <label class="f">Nuit : de (heure)<input id="dNs" type="number" min="0" max="23" data-day="nightStart" value="${d.nightStart}"></label>
        <label class="f">à (heure)<input id="dNe" type="number" min="0" max="23" data-day="nightEnd" value="${d.nightEnd}"></label>
        <label class="f">Recherche<select id="dRes" data-day="research">${Object.entries(RESEARCH_MODE).map(([k,l])=>`<option value="${k}" ${researchMode()===k?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="f">Formes de vie<select id="dLf" data-day="lf">${Object.entries(LF_MODE).map(([k,l])=>`<option value="${k}" ${lfMode()===k?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="f">Horizon<select id="dHz" data-day="horizon">${[12,24,48].map(v=>`<option value="${v}" ${+d.horizon===v?'selected':''}>${v} h</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="card"><h2>Formes de vie découvertes</h2>
      <div class="chips">${lfSettingsHtml()}</div>
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
        <label class="f">Foreuses en surcharge 150 %<select id="sOver" data-set="crawlerOverload"><option value="0" ${!s.crawlerOverload?'selected':''}>Non</option><option value="1" ${s.crawlerOverload?'selected':''}>Oui</option></select><span class="note">Moitié plus de bonus, énergie doublée. À régler comme dans le jeu.</span></label>
        <label class="f">Collecteur : +25 % soute transporteurs<select id="sColCargo" data-set="colCargo"><option value="1" ${s.colCargo?'selected':''}>Oui</option><option value="0" ${!s.colCargo?'selected':''}>Non</option></select></label>
        <label class="f">Ratio d'échange M:C:D<input id="sRatio" data-set="ratio" value="${s.ratio.join(':')}"></label>
      </div>
    </div>
    <div class="card"><h2>Page du jeu</h2>
      <div class="grid">
        <label class="f">Épurer la page du jeu<select id="sLean" data-set="lean"><option value="1" ${s.lean?'selected':''}>Oui</option><option value="0" ${!s.lean?'selected':''}>Non</option></select><span class="note">La barre Gameforge, l'en-tête, le pied de page et la bannière publicitaire s'en vont ; la photo de fond laisse place à un aplat sombre, et le menu du jeu grossit d'un septième. La page du jeu, elle, n'est pas touchée.</span></label>
        <label class="f">Masquer les menus payants<select id="sNoShop" data-set="noshop"><option value="1" ${s.noshop?'selected':''}>Oui</option><option value="0" ${!s.noshop?'selected':''}>Non</option></select><span class="note">Les entrées jaunes du menu du jeu : Marchand, Mess des officiers, les deux boutiques.</span></label>
      </div>
      <p class="note">Deux réglages d'allure, qui ne touchent ni aux calculs ni au plan. Ils agissent sur la page du jeu, pas sur ce panneau.</p>
    </div>
    <div class="card"><h2>Sauvegarde</h2>
      <p class="note">Tes données restent dans ce navigateur. Copie-les pour les garder ailleurs ou les passer sur un autre appareil.</p>
      <textarea id="ioText" aria-label="Données JSON" placeholder="Colle ici une sauvegarde pour l'importer"></textarea>
      <div class="row"><button class="btn" id="ioCopy">Copier mes données</button><button class="btn" id="ioImport">Importer</button><button class="btn ghost" id="ioReset">Réinitialiser…</button><span class="note" id="ioMsg"></span></div>
      ${noCount() ? `<div class="row" style="margin-top:8px">${noRestore()}<span class="note">Un « Non » met la carte de côté jusqu'à ce que tu la remettes.</span></div>` : ''}
    </div>
    <div class="card"><h2>Fiabilité des calculs</h2>
      <p class="note">Formules communautaires (wiki OGame, forum officiel). Production, coûts et temps de vol sont stables depuis des années. Moins sûrs : la production de deutérium (formule des univers récents, dépend de la température max), la durée des bâtiments de niveau 1 à 5, et les plafonds d'expédition. Compare une fois avec ton jeu et ajuste les réglages si besoin.</p>
    </div>
  </section>`;
},
};

const gauge = (k,cls,label,v,sub) => `<div class="gauge"><span class="k"><i class="bg-${cls}"></i>${label}</span><span class="v c-${cls}">${v}</span>${sub?`<span class="s">${sub}</span>`:''}</div>`;
function factorPill(f){ return f>=1 ? `<span class="pill good">Énergie OK</span>` : `<span class="pill ${f<.8?'bad':'warn'}">Rendement ${Math.round(f*100)} %</span>`; }
/* Les foreuses sont invisibles dans le jeu une fois posées : cette pastille est
   le seul endroit qui dise combien en profitent encore, et ce qu'elles ajoutent.
   La surcharge se lit sur la planète quand elle y est connue, comme le fait
   production() — sinon le pourcentage contredirait les jauges d'à côté. */
function crawlerPill(p){
  const max = crawlerMax(p.b.metal, p.b.crystal, p.b.deut); if(!max) return '';
  const have = p.crawlers||0, over = p.overload != null ? p.overload : S.settings.crawlerOverload;
  const pct = (crawlerBonus(Math.min(have,max), S.settings.cls, over)*100).toFixed(1).replace('.',',');
  return `<div class="wide"><span class="pill ${have>=max?'good':'info'}">Foreuses ${fmt(have)} / ${fmt(max)} utiles · +${pct} %</span></div>`;
}

const REFRESH = {
today(){
  const plan = simulateDay(), s0 = plan.sessions[0], night = !!S.day.night;
  /* Mode nuit : ni construction ni recherche à lancer, le panneau ne doit
     montrer que la mise à l'abri. Le plan est recalculé à chaque passage,
     le vider ici ne perd rien. */
  if(night) for(const x of plan.sessions){ x.acts = []; x.waits = []; }
  const nowParts = [];
  const missions = dailyMissions().filter(m=>!missionDone(m) && !refused('m:'+m.id));
  /* La page du jeu surligne ce que le plan recommande et pose la bande du bas.
     Elle n'en fait rien d'autre : aucun clic, aucun envoi, ce sont des repères.
     Publié ici, après les missions, parce que la bande les porte. */
  if(IS_EXT) try{ chrome.storage.local.set({skin: gameSkin(s0.acts, missions, s0.waits)}); }catch(e){}
  const timed = missions.filter(m=>m.at && m.at > plan.now), slotMs = new Map();
  for(const m of timed){ let host = null; for(const x of plan.sessions) if(x.T <= m.at) host = x; if(host && host!==s0){ if(!slotMs.has(host)) slotMs.set(host, []); slotMs.get(host).push(m); } else m.at = 0; }
  const nowMs = missions.filter(m=>!m.info && !(m.at && m.at > plan.now && [...slotMs.values()].some(l=>l.includes(m))));
  const infoMs = missions.filter(m=>m.info);
  const taskHtml = m=>{
    const [wi, wb] = whyParts([m.why]), meta = (m.tags||[]).map(planetTag).join('') + copyChips(m);
    return `<li class="task"${goAttr(missionGo(m))}><div><div class="q">${qHtml(m.q||'À faire')}${wi}</div><div class="w">${m.whatHtml || esc(m.what)}</div></div><span class="btns"><button class="btn sm" data-done="${m.id}"${m.mark?` data-mark="${m.mark.join(',')}"`:''}>Fait</button>${noBtn('m:'+m.id)}</span>${meta?`<div class="m">${meta}</div>`:''}${wb}<details class="how"><summary>Comment faire</summary><ol>${m.how.map(x=>`<li>${x}</li>`).join('')}</ol></details></li>`;
  };
  if(s0.acts.length || nowMs.length) nowParts.push(`<ul class="acts">${s0.acts.map(a=>actHtml(a,true)).join('')}${nowMs.map(taskHtml).join('')}</ul>`);
  const RN = ['métal','cristal','deutérium'];
  const missTxt = w => { const parts = (w.miss||[]).map((x,j)=>x>0?`${fmt(x)} ${RN[j]}`:'').filter(Boolean); return parts.length ? 'Il manque '+parts.join(' · ') : ''; };
  if(s0.waits.length) nowParts.push(`<details${fold('attente', false)}><summary class="note" data-fold="attente">En attente de ressources (${s0.waits.length})</summary><ul class="acts" style="margin-top:6px">${s0.waits.map(w=>`<li class="wait"><div><div class="q">${qHtml(w.q)}</div><div class="w">${esc(w.what)}</div></div><span class="pill warn">${isFinite(w.eta)?'ressources réunies vers '+hm(plan.now+w.eta*1000):'à faire livrer, ou agrandir le hangar'}</span><div class="m">${esc(missTxt(w))}${isFinite(w.eta)?` <span>(dans ${dur(w.eta)})</span>`:''}</div>${w.heldBy?`<div class="m">Retenu : tu épargnes pour ${esc(w.heldBy)}.</div>`:''}</li>`).join('')}</ul></details>`);
  if(plan.busy.length || infoMs.length) nowParts.push(`<details${fold('encours', false)}><summary class="note" data-fold="encours">Déjà en cours (${plan.busy.length + infoMs.length})</summary><ul class="acts" style="margin-top:6px">${plan.busy.map(b=>`<li class="busy"><div><div class="q">${qHtml(b.q)} · en cours</div><div class="w">${esc(b.what)}</div></div><span class="mono note">fin ${hm(b.end)}</span></li>`).join('')}${infoMs.map(m=>`<li class="busy"><div><div class="q">${qHtml(m.q)} · info</div><div class="w">${esc(m.what)}</div></div><span></span><div class="m">${(m.tags||[]).map(planetTag).join('')}${esc(m.why)}</div></li>`).join('')}</ul></details>`);
  const nextS = plan.sessions.slice(1).find(x=>x.acts.length);
  if(!s0.acts.length && !nowMs.length) nowParts.unshift(`<p class="note">Rien à lancer pour l'instant.${nextS?` Prochaine action à <b>${hm(nextS.T)}</b>.`:''}</p>`);
  const aide = `<details${fold('aide', false)}><summary class="note" data-fold="aide">Comment lire ces cartes</summary><p class="note" style="margin-top:6px"><b>Lancé</b> ou <b>Fait</b> quand c'est fait dans le jeu : le plan se recalcule. <b>Non</b> met la carte de côté jusqu'à ce que tu la remettes. Une carte de flotte ouvre le formulaire du jeu déjà préparé ; les valeurs marquées ⧉ se copient d'un clic.${IS_EXT?'':' Si une file est déjà occupée dans le jeu, ajoute son minuteur.'}</p></details>`;
  const remets = noCount() ? `<div class="row">${noRestore()}</div>` : '';
  document.getElementById('tdNow').innerHTML = nowParts.join('') + aide + remets;
  const alerts = plan.alerts;
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
  /* Où en est le début de partie. Le compte est le nombre de jalons franchis,
     qui peuvent l'être dans le désordre : on peut tenir Astrophysique sans
     Ordinateur 2. « Prochaine étape » est le premier non franchi dans l'ordre
     de la liste, celui qui ouvre la suite. Le bloc s'efface de lui-même une
     fois les onze acquis. */
  const mDone = MILESTONES.filter(m=>milestoneDone(m)).length, mNext = MILESTONES.find(m=>!milestoneDone(m));
  const mMiss = mNext ? milestoneMissing(mNext) : [];
  const debut = mNext ? `<ul class="advice" style="margin-bottom:14px"><li><span class="pill info">Début de partie · ${mDone} / ${MILESTONES.length}</span><span class="what">Prochaine étape : ${esc(milestoneLabel(mNext))}</span><span class="why">${mMiss.length?`Il manque : ${esc(mMiss.join(', '))}. `:''}${esc(mNext.why)}</span></li></ul>` : '';
  document.getElementById('tdDay').innerHTML = night ? `<p class="note">Mode nuit : seule la mise à l'abri compte. Le plan du jour revient dès que tu repasses en mode jour.</p>` : debut + strategy + (later.length
    ? `<div class="tl">${later.slice(0,6).map(slot).join('')}</div>${later.length>6?`<details style="margin-top:12px"><summary class="note">Voir les ${later.length-6} connexions suivantes</summary><div class="tl" style="margin-top:12px">${later.slice(6).map(slot).join('')}</div></details>`:''}`
    : `<p class="note">Aucune action prévue sur la période : tes files sont occupées ou tes ressources trop faibles.</p>`)
    + `<div class="sumline" style="margin-top:14px"><span class="pill good">Production ${gain>=0?'+':''}${gain.toFixed(1).replace('.',',')} %</span><span class="note">en ${S.day.horizon} h, de ${fmt(plan.startV)} à ${fmt(plan.endV)} éq. métal/h</span></div>`
    + (plan.ups.length ? `<p class="note" style="margin-top:6px">${esc(plan.ups.join(' · '))}</p>` : '')
    + `<p class="note" style="margin-top:6px">Connexions sans action masquées. Hors plan : formes de vie, flotte, défense. Avant une longue absence, dépense ou mets tes ressources à l'abri.</p>`;
  renderTimers();
  document.getElementById('tdStamp').textContent = S.syncAt ? `synchro ${hm(S.syncAt)}` : (S.lastImport ? `import ${hm(S.lastImport)}` : '');
  document.getElementById('tdDaySum').textContent = night ? 'mode nuit'
    : `${later.length} connexion${later.length>1?'s':''} à venir · production ${gain>=0?'+':''}${gain.toFixed(1).replace('.',',')} % en ${S.day.horizon} h`;
},
empire(){ REFRESH.planets(); REFRESH.research(); },
tools(){ REFRESH[toolTab()](); },
explore(){
  const el = document.getElementById('exColo'); if(!el || !API || !API.planets) return;
  const cand = colonyCandidates().slice(0,8), tgt = coloTarget();
  const col = shipStats('col'), home = coloFrom().coords;
  el.innerHTML = cand.length ? `<div class="tbl-wrap"><table><thead><tr><th>Coordonnées</th><th>Cases</th><th>Bonus</th><th class="n">Vol</th><th>Voisins</th><th></th></tr></thead><tbody>${cand.map(c=>{ const f = flight(home, c.coords, {col:1}, 100); return `<tr><td class="mono">${c.coords}</td><td class="mono">~${c.fields}</td><td>${c.bonus?`<span class="pill info">${c.bonus}</span>`:''}</td><td class="n">${f?dur(f.secs):'–'}</td><td class="note">${c.neigh.strong?`<span class="pill warn">${c.neigh.strong} fort${c.neigh.strong>1?'s':''}</span> `:''}${c.neigh.active} actif${c.neigh.active>1?'s':''}${c.neigh.inactive?` · ${c.neigh.inactive} inactif${c.neigh.inactive>1?'s':''}`:''}</td><td><button class="btn sm ${c.coords===tgt?'primary':''}" data-cotarget="${c.coords}">${c.coords===tgt?'Choisie':'Choisir'}</button></td></tr>`; }).join('')}</tbody></table></div><p class="note">Positions libres accessibles avec ton Astrophysique, à 15 systèmes au plus. Classement : valeur de la position (${esc((OBJECTIVES[S.colo.objective]||OBJECTIVES.balanced).n.toLowerCase())}), distance, puis voisinage (moins de joueurs forts, des inactifs à piller).</p>` : '<p class="note">Aucune position libre trouvée à proximité.</p>';

  const raids = raidTargets(), safe = raids.filter(r=>!r.outlaw).slice(0,8), risky = raids.filter(r=>r.outlaw).slice(0,4);
  const sc = shipStats('sc');
  const row = r=>{ const f = flight(home, r.coords, {sc:1}, 100), last = S.raids[r.coords]; return `<tr><td class="mono">${r.coords}</td><td>${esc(r.name)} <span class="note">(${esc(r.status)})</span></td><td class="n">${fmt(r.score)}</td><td class="n">${f?dur(f.secs):'–'}</td><td>${r.outlaw?'<span class="pill bad">plus fort que toi</span>':r.longInactive?'<span class="pill good">inactif longue durée</span>':'<span class="pill info">inactif</span>'}${last?` <span class="note">${last.probe?'espionné':'pillé'} ${hm(last.at)}</span>`:''}</td><td>${r.outlaw?'':`<button class="btn sm" data-raidprep="${r.coords}" data-raidname="${esc(r.name)}">Préparer</button>`}</td></tr>`; };
  document.getElementById('exRaid').innerHTML = (safe.length||risky.length) ? `<div class="tbl-wrap"><table><thead><tr><th>Coordonnées</th><th>Joueur</th><th class="n">Points</th><th class="n">Vol PT</th><th></th><th></th></tr></thead><tbody>${safe.map(row).join('')}${risky.length?`<tr><td colspan="6" class="note">À éviter tant que tu as ta protection (avertissement « joueur plus puissant ») :</td></tr>${risky.map(row).join('')}`:''}</tbody></table></div><p class="note">Points = taille de son économie, donc ce que tu peux espérer piller. Espionne avant d'attaquer : il faut ni flotte ni défense. Si le jeu refuse l'attaque, c'est la protection débutant.</p>` : '<p class="note">Aucun inactif repéré dans un rayon de 30 systèmes.</p>';

  const rp = raidPlan(), rpEl = document.getElementById('rdPlan');
  if(rp && rpEl){
    const okShips = Object.keys(rp.ships).length>0;
    rpEl.innerHTML = rp.need<=0 ? '<p class="note">Saisis les ressources du rapport pour calculer la flotte.</p>' : `<div class="res">${gauge('m','m','Butin possible',fmt(rp.need),`${S.settings.cls==='explorer'?'75':'50'} % du stock`)}${gauge('c','c','Ramené',fmt(rp.got),okShips?shipList(rp.ships):'aucun transporteur')}${gauge('d','d','Carburant',fmt(rp.fuel),'aller-retour')}${gauge('e','e','Vol',rp.fl?dur(rp.fl.secs):'–','aller')}</div>
      ${!S.raid.safe ? '<p class="pill warn" style="margin-top:8px">Coche la case seulement si le rapport ne montre ni flotte ni défense. Sinon, ne l\'attaque pas.</p>' : ''}
      ${rp.stale && rp.need>0 ? '<p class="pill bad" style="margin-top:8px">Rapport périmé (plus de 2 h) : réespionne avant d\'attaquer, le stock a changé.</p>' : ''}
      ${rp.short>0 ? `<p class="note">Il te manque ${fmt(rp.short)} de soute à ${esc(rp.home.name)} : le reste attendra un second passage.</p>` : ''}
      ${S.raid.safe && !rp.stale && okShips && rp.net>0 ? `<ul class="acts" style="margin-top:8px">${actHtml({q:'Flotte · '+rp.home.name, what:`Attaquer ${S.raid.coords} avec ${shipList(rp.ships)}`, why:`Galaxie ou Flotte → ${S.raid.coords} → mission Attaquer · retour vers ${hm(Date.now()+2*rp.fl.secs*1000)}`, cost:[0,0,rp.fuel], dur:2*rp.fl.secs, end:Date.now()+2*rp.fl.secs*1000, kind:'raid', ships:rp.ships, p:cargoHomeIndex(), coords:S.raid.coords, dest:S.raid.coords, mission:1}, true)}</ul>` : ''}`;
  }
  const ex = exploreSystems();
  document.getElementById('exExplore').innerHTML = `<ul class="advice">${ex.map(x=>`<li><span class="pill info">${x.left} pos.</span><span class="what">Système ${x.sys}</span><span class="why">${x.dist===0?'Ton système':`À ${x.dist} système${x.dist>1?'s':''}`} : ${x.left} position${x.left>1?'s':''} pas explorée${x.left>1?'s':''} depuis 7 jours.</span></li>`).join('')}</ul><p class="note">Missions de découverte : bouton Découverte dans Galaxie. Copilote retient les positions explorées quand il voit tes missions dans Mouvements de flotte. Pour les expéditions, alterne la position 16 de systèmes voisins si les résultats baissent.</p>`;
},
planets(){
  let tm=0,tc=0,td=0, worst=1;
  const voc = vocations(), ci = centreIndex();
  S.planets.forEach((p,i)=>{
    const pr=production(p); tm+=pr.m; tc+=pr.c; td+=pr.d; worst=Math.min(worst,pr.factor);
    const st=stockNow(p), full = i2 => { const r=[pr.m,pr.c,pr.d][i2]; return r>0 && st[i2]<pr.cap[i2] ? `plein dans ${dur((pr.cap[i2]-st[i2])/r*3600)}` : (st[i2]>=pr.cap[i2]?'hangar plein':''); };
    document.getElementById('pres-'+i).innerHTML =
      gauge('m','m','Métal',fmt(pr.m),full(0)) + gauge('c','c','Cristal',fmt(pr.c),full(1)) + gauge('d','d','Deutérium',fmt(pr.d),full(2)) +
      gauge('e','e','Énergie',(pr.eBal>=0?'+':'')+fmt(pr.eBal), `${fmt(pr.eProd)} produits / ${fmt(pr.eCons)}${p.eAdj<0?` · dont ${fmt(p.eAdj)} formes de vie`:''}`) +
      crawlerPill(p);
    const fl = document.getElementById('pfleet-'+i); if(fl){ const l = shipList(p.ships); fl.innerHTML = l ? `<b>Flotte à quai :</b> ${esc(l)}` : (IS_EXT ? 'Flotte inconnue : ouvre la page Flotte du jeu sur cette planète.' : ''); }
    /* La vocation et la note du centre suivent les coordonnées, la température
       et les niveaux qu'on tape dans la carte : sans ça elles restaient
       périmées jusqu'au prochain rendu complet. On ne réécrit que du texte —
       la case du centre garde son écouteur, qu'un innerHTML emporterait. */
    const vq = document.getElementById('pvoc-'+i); if(vq) vq.innerHTML = vocHtml(voc[p.id]);
    const cn = document.getElementById('pctrn-'+i); if(cn) cn.innerHTML = centreNoteHtml(p, i, ci);
  });
  document.getElementById('empireRes').innerHTML = gauge('m','m','Métal',fmt(tm),fmt(tm*24)+' / jour')+gauge('c','c','Cristal',fmt(tc),fmt(tc*24)+' / jour')+gauge('d','d','Deutérium',fmt(td),fmt(td*24)+' / jour')+gauge('e','e','Planètes',S.planets.length,`max ${1+Math.ceil(S.tech.astro/2)} (Astro ${S.tech.astro})`);
  document.getElementById('empireFactor').innerHTML = factorPill(worst);
  document.getElementById('colonyNote').textContent = S.tech.astro ? '' : 'Les colonies demandent Astrophysique 1.';
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
  const s=S.settings, cap = expoFind(S.expo.pf);
  const lc=shipStats('lc'), sc=shipStats('sc'), pf=shipStats('pf');
  const need = Math.max(0, cap - (S.expo.pf?pf.cargoEff:0));
  const nExp = expoCap();
  document.getElementById('expoOut').innerHTML =
    gauge('m','m','Métal max',fmt(cap)) + gauge('c','c','Cristal max',fmt(cap*2/3)) + gauge('d','d','Deut. max',fmt(cap/3)) +
    gauge('e','e','Grands transp.',nf.format(Math.ceil(need/lc.cargoEff)),`ou ${nf.format(Math.ceil(need/sc.cargoEff))} petits`);
  document.getElementById('expoNote').innerHTML = `<b>Estimation.</b> Les seuils publiés datent d'avant la version 7 du jeu ; le plafond ci-dessus est une borne haute, pas une promesse. Une expédition ne rapporte jamais plus que la soute envoyée. Plafond calé sur les points du n°1 (${EXPO_LABELS[top1Tier()]}${API && API.scores ? ', lus dans le classement public' : ', réglage manuel'}). Expéditions simultanées : <b>${nExp}</b>${S.tech.astro?'':' (il faut Astrophysique 1)'}. Les bonus Éclaireur (×2) et Explorateur (×1,5) viennent de sources communautaires.`;
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
                : {sev:'bad', what:`Rechercher Astrophysique ${nextAstro}`, why:'Toutes tes planètes sont utilisées.'});
  if(S.tech.impulse>=3) req.push({sev:'good', what:'Réacteur à impulsion 3', why:'Prérequis du vaisseau de colonisation.'});
  else { let t=0; for(let L=S.tech.impulse+1; L<=3; L++) t+=researchTime('impulse',L); req.push({sev:'bad', what:`Réacteur à impulsion ${S.tech.impulse} → 3`, why:`Coût ${fmt(rangeCost(T.impulse,S.tech.impulse,3).reduce((a,b)=>a+b,0))} au total, environ ${dur(t)} de recherche.`}); }
  if(dp.b.shipyard>=4) req.push({sev:'good', what:`Chantier spatial 4 sur ${dp.name}`, why:'Prérequis du vaisseau de colonisation.'});
  else req.push({sev:'bad', what:`Chantier spatial ${dp.b.shipyard} → 4 sur ${dp.name}`, why:`Coût total : ${fmt(rangeCost(B.shipyard,dp.b.shipyard,4).reduce((a,b)=>a+b,0))} ressources.`});
  const w = F.wait;
  req.push({sev: w.sec===0 ? 'good' : w.storage!=null ? 'bad' : 'warn',
    what: colBuilt() ? 'Ressources du kit et carburant' : 'Ressources du vaisseau, du kit et carburant',
    why: `${w.sec===0 ? 'Disponibles maintenant.' : w.storage!=null ? storageNote(w) : `Disponibles dans ${dur(w.sec)}.`}${colBuilt() ? '' : ` Construction du vaisseau : ${dur(F.shipTime)}.`}`});
  document.getElementById('coReq').innerHTML = req.map(r=>`<li><span class="pill ${r.sev==='info'?'info':r.sev}">${({good:'OK',warn:'Bientôt',bad:'À faire'})[r.sev]}</span><span class="what">${esc(r.what)}</span><span class="why">${esc(r.why)}</span></li>`).join('');

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
    ${(()=>{ const cp = colonyPayback(); return cp ? `<p class="note">Délai de retour simulé : <b>${dur(cp.hours*3600)}</b>. ${fmt(cp.upfront)} éq. de mise, ${dur(cp.ramp*3600)} pour que ses mines montent toutes seules jusqu'à ${fmt(cp.rate)} éq./h, puis ce temps-là pour rendre la mise. La montée s'arrête quand plus aucun niveau ne s'amortit en moins de ${dur(COLO_HORIZON_H*3600)}.</p>` : ''; })()}
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
};

/* ---------- events ---------- */
function bind(){
  /* Un centre et un seul : cocher ici décoche ailleurs, et comme le choix
     déplace le « (conseillé) » des autres cartes et tout le plan, la vue se
     redessine au lieu de se rafraîchir. */
  view.querySelectorAll('[data-centre]').forEach(el=>el.addEventListener('change',()=>{ S.centre = el.checked ? el.dataset.centre : null; save(); render(); }));
  view.querySelectorAll('[data-raid]').forEach(el=>el.addEventListener(el.type==='checkbox'?'change':'input',()=>{ if(!S.raid) return; const k=el.dataset.raid; if(k==='paste'){ const r=parseReport(el.value); if(r.some(x=>x!=null)){ S.raid.m=r[0]||0; S.raid.c=r[1]||0; S.raid.d=r[2]||0; S.raid.at=Date.now(); save(); render(); } return; } S.raid[k] = el.type==='checkbox' ? el.checked : (+el.value||0); if(k!=='safe') S.raid.at=Date.now(); save(); REFRESH.explore(); }));
  view.querySelectorAll('[data-lf]').forEach(el=>el.addEventListener('change',()=>{ const k=el.dataset.lf, f=new Set(S.lf.found); el.checked ? f.add(k) : f.delete(k); S.lf.found=[...f]; save(); render(); }));
  view.querySelectorAll('[data-day]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k = el.dataset.day; S.day[k] = dayValue(k, el.value, S.day[k]); save(); refresh();
  }));
  view.querySelectorAll('[data-colo]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k = el.dataset.colo;
    S.colo[k] = k==='built' ? el.value==='1' : k==='bonus' ? (+el.value||0) : el.value.trim();
    save(); refresh();
  }));

  view.querySelectorAll('[data-pi]').forEach(card=>{
    const p = S.planets[+card.dataset.pi];
    card.querySelectorAll('input[data-b]').forEach(el=>el.addEventListener('input',()=>{ p.b[el.dataset.b]=Math.max(0,parseInt(el.value)||0); delete p.bNeuve; changed(); }));
    card.querySelectorAll('input[data-p]').forEach(el=>el.addEventListener('input',()=>{ const k=el.dataset.p; p[k] = (k==='tmax'||k==='sats') ? (parseInt(el.value)||0) : el.value; changed(); }));
    card.querySelectorAll('input[data-s]').forEach(el=>el.addEventListener('input',()=>{ const st=stockNow(p); p.stock={m:st[0],c:st[1],d:st[2],at:Date.now()}; p.stock[el.dataset.s]=parseFloat(el.value)||0; changed(); }));
  });
  view.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ const p=S.planets[+b.dataset.del]; if(p) forgetPlanet(p.id); save(); render(); }));
  on('dayNight','click',()=>{ S.day.night = !S.day.night; save(); render(); });
  on('addPlanet','click',()=>{ S.planets.push(newPlanet('Colonie '+S.planets.length,'1:1:'+(S.planets.length+4),20,{})); S.sample=false; save(); render(); });
  view.querySelectorAll('input[data-t]').forEach(el=>el.addEventListener('input',()=>{ S.tech[el.dataset.t]=Math.max(0,parseInt(el.value)||0); changed(); }));
  view.querySelectorAll('[data-set]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k=el.dataset.set, s=S.settings;
    if(k==='ratio'){ const r=el.value.split(':').map(Number); if(r.length===3 && r.every(x=>x>0)) s.ratio=r; }
    else if(k==='cls') s.cls=el.value;
    else if(['geo','eng','colCargo','lean','noshop','large','peau','clair','crawlerOverload'].includes(k)) s[k]=el.value==='1';
    else s[k]=Math.max(k==='top1'?0:1, parseFloat(el.value)||0);
    changed();
    if(k==='lean' || k==='noshop' || k==='large' || k==='peau' || k==='clair') pushLook();
  }));
  view.querySelectorAll('[data-expo]').forEach(el=>el.addEventListener('change',()=>{ S.expo.pf=el.value==='1'; changed(); }));
  view.querySelectorAll('[data-fc]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ S.fleetCalc[el.dataset.fc] = el.dataset.fc==='pct'?+el.value:el.value.trim(); changed(); }));
  view.querySelectorAll('[data-ship]').forEach(el=>el.addEventListener('input',()=>{ S.fleetCalc.ships[el.dataset.ship]=Math.max(0,parseInt(el.value)||0); changed(); }));
  on('ioCopy','click',()=>{ const txt=JSON.stringify(S); const ta=document.getElementById('ioText'); ta.value=txt;
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>msg('Copié dans le presse-papiers')).catch(()=>{ ta.select(); msg('Sélectionné : copie-le manuellement'); }); });
  on('ioImport','click',()=>{ try{ const d=JSON.parse(document.getElementById('ioText').value); if(!d.planets||!d.settings) throw 0; S=Object.assign(sample(),d); S.sample=false; save(); render(); toast('Données importées'); }catch(e){ msg('Texte invalide : colle une sauvegarde complète'); } });
  on('ioReset','click',e=>{ const b=e.currentTarget; if(b.dataset.armed){ S=sample(); save(); render(); toast('Réinitialisé'); } else { b.dataset.armed='1'; b.textContent='Confirmer la réinitialisation'; b.classList.remove('ghost'); } });
}
// Un clic sur la carte ouvre la page du jeu. Les boutons gardent leur rôle :
// « Lancé » et « Fait » ne doivent jamais faire changer de page par surprise.
view.addEventListener('click', e=>{
  // « Comment faire » se lit sans partir : seul le corps de la carte navigue.
  if(e.target.closest('button, a, summary, input, select, .how')) return;
  // `closest` rend le plus proche : une coordonnée liée l'emporte sur la carte.
  const li = e.target.closest('[data-go]'); if(!li) return;
  const url = li.dataset.go;
  if(IS_EXT) chrome.runtime.sendMessage({type:'go', url});
  else window.open(url, '_blank', 'noopener');
});
view.addEventListener('click', e=>{
  const cp = e.target.closest('[data-copos]');
  if(cp){ const [g,sy] = coloSystem(); S.colo.target = `${g}:${sy}:${cp.dataset.copos}`; save(); render(); return; }
});
view.addEventListener('click', e=>{
  // Le ⓘ de la ligne du type ouvre son texte, posé plus bas dans la carte.
  const wq = e.target.closest('button.i');
  if(wq){
    const body = document.getElementById(wq.getAttribute('aria-controls'));
    if(body){ body.hidden = !body.hidden; wq.setAttribute('aria-expanded', String(!body.hidden)); }
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if(cp){
    const v = cp.dataset.copy;
    // Le presse-papier, pas le champ : c'est le joueur qui colle.
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject())
      .then(()=>toast('Copié : '+v)).catch(()=>toast('Copie impossible : '+v));
    return;
  }
  const dn = e.target.closest('[data-done]'); if(dn){ S.daily.done[dn.dataset.done] = Date.now();
    // Fait sur un espionnage : les cibles nommées sortent de la liste pour un jour.
    if(dn.dataset.mark) dn.dataset.mark.split(',').forEach(c=>{ S.raids[c] = {at:Date.now(), probe:true}; }); save(); refresh(); toast('Bien joué'); return; }
  const no = e.target.closest('[data-no]'); if(no){ S.daily.no[no.dataset.no] = Date.now(); save(); refresh(); toast('Mis de côté'); return; }
  const nc = e.target.closest('[data-noclear]'); if(nc){ S.daily.no = {}; save(); render(); toast('Cartes refusées remises'); return; }
  const sm = e.target.closest('summary[data-fold]');
  // Le repli bascule tout seul : on ne note que l'état où il va.
  if(sm){ (S.ui.fold = S.ui.fold || {})[sm.dataset.fold] = !sm.parentElement.open; save(); return; }
  const rpp = e.target.closest('[data-raidprep]'); if(rpp){ S.raid = {coords:rpp.dataset.raidprep, name:rpp.dataset.raidname, m:0, c:0, d:0, safe:false}; save(); render(); return; }
  const rpc = e.target.closest('[data-raidclose]'); if(rpc){ S.raid = null; save(); render(); return; }
  const ct = e.target.closest('[data-cotarget]'); if(ct){ S.colo.target = ct.dataset.cotarget; save(); render(); toast('Destination de colonie mise à jour'); return; }
  const ar = e.target.closest('[data-apirefresh]'); if(ar){ try{ chrome.runtime.sendMessage({type:'apiRefresh', force:true}); }catch(err){} toast('Actualisation demandée'); return; }
  const tl = e.target.closest('[data-tool]'); if(tl){ S.ui.tool = tl.dataset.tool; save(); render(); return; }
  const go = e.target.closest('[data-goto]'); if(go){ tab = go.dataset.goto; try{ LS.setItem(KEY+'-tab',tab); }catch(err){} render(); return; }
  const sent = e.target.closest('[data-sent]'); if(sent){ S.colo.sentAt = Date.now(); S.colo.built = false; save(); refresh(); toast('Colonisation en route'); return; }
  const la = e.target.closest('[data-launch]');
  if(la){
    const a = JSON.parse(la.dataset.launch), tm = {id:Math.random().toString(36).slice(2,8), manual:true, at:Date.now(), end:Date.now()+a.dur*1000, done:false};
    if(a.kind==='t'){ tm.kind='t'; tm.k=a.k; tm.lvl=a.lvl; }
    else if(a.kind==='b'){ tm.kind='b'; tm.pid=a.pid; tm.k=a.k; tm.lvl=a.lvl; }
    else if(a.kind==='shipbuild' || a.kind==='def'){ tm.kind='x'; tm.k='shipyard'; tm.ships=a.ships; tm.pid=a.pid; tm.label=a.what; }
    else if(a.kind==='transfer' || a.kind==='raid'){ tm.kind='x'; tm.k='fleet'; tm.ships=a.ships; tm.pid=a.pid; tm.label=a.kind==='raid' ? `Retour du pillage ${a.coords}` : 'Arrivée du rapatriement'; }
    else if(a.kind==='expo'){ tm.kind='x'; tm.k='expo'; tm.ships=a.ships; tm.pid=a.pid; tm.label="Retour d'expédition"; }
    else if(a.kind==='sats'){ tm.kind='x'; tm.k='sats'; tm.n=a.n; tm.pid=a.pid; tm.label=a.what; }
    else if(a.kind==='lf'){ tm.kind='x'; tm.k='other'; tm.queue=lfQueue(a.id); tm.pid=a.pid; tm.label=a.what; }
    else { tm.kind='x'; tm.k='colship'; tm.label='Vaisseau de colonisation'; }
    /* Sans planète identifiée, personne n'est débité : c'était le dernier
       endroit où un rang périmé faisait payer la voisine. Le minuteur part
       quand même — le joueur a bien lancé quelque chose. */
    const p = planetById(a.pid);
    const cost = a.cost || COL_SHIP_COST;
    if(p){ const st = stockNow(p); p.stock = {m:Math.max(0,st[0]-cost[0]), c:Math.max(0,st[1]-cost[1]), d:Math.max(0,st[2]-cost[2]), at:Date.now()}; }
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
/* L'import de la Vue empire donne la défense par libellé : sans cette table il
   ne resterait qu'un total, et le plan proposerait des lasers par-dessus des
   lasers. « Lanceur de plasma » avant « lanceur de missiles » : les deux
   contiennent « lanceur ». */
const MATCH_DEF = [
  ['pt',[['lanceur','plasma'],['plasma','turret']]], ['rl',[['lanceur','missile'],['rocket','launcher']]],
  ['ll',[['laser','leger'],['light','laser']]], ['hl',[['laser','lourd'],['heavy','laser']]],
  ['gc',[['gauss']]], ['ic',[['ion']]],
  ['sd',[['petit','bouclier'],['small','shield']]], ['ld',[['grand','bouclier'],['large','shield']]],
];
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
      const k = matchKey(label, MATCH_B); if(k){ p.b[k]=lvlOf(v); delete p.bNeuve; } else rep.unknown.add(label);
    }
    for(const [label,v] of Object.entries(src.ships||{})){ if(/satellite|solar sat/i.test(norm(label))){ p.sats = lvlOf(v); continue; } const k = matchKey(label, MATCH_S); if(k){ p.ships = p.ships||{}; p.ships[k] = lvlOf(v); } }
    if(src.defense){
      p.def = Object.values(src.defense).reduce((a,v)=>a+lvlOf(v),0);
      const d = {};
      for(const [label,v] of Object.entries(src.defense)){ const k = matchKey(label, MATCH_DEF); if(k) d[k] = lvlOf(v); else rep.unknown.add(label); }
      p.defs = d;
    }
    if(src.res) p.stock = {m:+src.res.metal||0, c:+src.res.crystal||0, d:+src.res.deut||0, at};
    if(src.energy && src.energy.balance != null){ p.eAdj = 0; p.eAdj = +src.energy.balance - production(p).eBal; }
    (src.alerts||[]).forEach(a=>rep.alerts.push(`${src.name} : ${a}`));
    kept.push(p); rep.planets++;
  }
  for(const [label,v] of Object.entries(d.research||{})){
    const k = matchKey(label, MATCH_T); if(k){ S.tech[k]=lvlOf(v); rep.techs++; } else rep.unknown.add(label);
  }
  S.planets = kept;
  S.sample = false; S.lastImport = at;
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
    else if(kind==='b'){ const p=planetById(a); if(!p) return; tm.pid=a; tm.k=b; tm.lvl=p.b[b]+1; }
    else tm.k=a;
    S.timers.push(tm); save(); document.getElementById('tmLeft').value=''; renderTimers(); toast(`Minuteur lancé : ${clock(sec)}`);
  }
  const rmT = e.target.closest('[data-tmrm]');
  if(rmT){ S.timers = S.timers.filter(t=>t.id!==rmT.dataset.tmrm); save(); stopFlash(); renderTimers(); }
});
setInterval(tickTimers, 1000);
setInterval(()=>{ if(tab==='today'||tab==='empire') REFRESH[tab](); else publieLePlan(); }, 30000);
/** Recalcule le plan du jour pour la page du jeu, sans rien afficher.
    `today` le publie en se dessinant ; ailleurs, c'est à nous de le faire.
    Le dessin qui suit la publication écrit dans des éléments de l'onglet
    Aujourd'hui, absents : il échoue, et c'est sans conséquence — la page a
    déjà reçu ce qu'elle attendait. */
function publieLePlan(){
  if(!IS_EXT || tab === 'today') return;
  try{ REFRESH.today(); }catch(e){}
}


/**
 * Cale le solde d'énergie d'une planète sur celui que le panneau de production
 * affiche. Même mesure que les deux autres lectures : on remet eAdj à zéro pour
 * que production() rende le solde du moteur seul, et l'écart est ce qu'il ne
 * sait pas expliquer (la consommation des formes de vie déjà bâties, notamment).
 * Sans effet si la planète est inconnue, la lecture a plus de sept jours ou
 * l'énergie libre est illisible. Une lecture ne cale qu'une fois (eAdjAt) : le
 * panneau et les niveaux viennent de la même visite, et une relecture plus tard
 * effacerait le coût des niveaux montés depuis.
 * @param {object|undefined} p planète de S.planets
 */
function calePlanete(p){
  const r = prodOf(p);
  const free = r && r.energy && r.energy.free;
  if(!Number.isFinite(free) || !(Date.now() - r.at < LF_READ_TTL) || p.eAdjAt === r.at) return;
  p.eAdjAt = r.at;
  p.eAdj = 0;
  p.eAdj = Math.min(Math.max(free, -1e9), 1e9) - production(p).eBal;
}

/* ---------- live sync from the extension ---------- */
/** Merges the game state collected by the content script into the panel state. */
function applyGame(g){
  if(!g) return;
  const m = g.meta || {};
  if(m.playerId) S.me = m.playerId;
  if(m.host) S.host = m.host;
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
    if(!p){
      p = (S.sample && kept.length===0) ? S.planets[0] : newPlanet(gp.name||'Planète', gp.coords||'', gp.tmax ?? 20, {});
      // révélée par la liste du jeu : elle a un nom, pas encore de niveaux
      if(p !== S.planets[0]) p.bNeuve = 1;
    }
    p.gid = id;
    if(gp.name) p.name = gp.name;
    if(gp.coords) p.coords = gp.coords;
    if(gp.lf){ const lf = Object.assign({}, p.lf); for(const [k,v] of Object.entries(gp.lf)) lf[k] = lfMerge(lf[k], v); p.lf = lf; }
    if(gp.lfSeen) p.lfSeen = Object.assign({}, p.lfSeen, gp.lfSeen);
    if(gp.tmax != null) p.tmax = gp.tmax;
    Object.assign(p.b, gp.b || {});
    if(gp.b && Object.keys(gp.b).length) delete p.bNeuve; // ses niveaux sont lus
    if(gp.sats != null) p.sats = gp.sats;
    if(gp.crawlers != null) p.crawlers = gp.crawlers;
    if(gp.def != null) p.def = gp.def;
    if(gp.defs) p.defs = Object.assign({}, gp.defs);
    if(gp.defsAt) p.defsAt = gp.defsAt;
    if(gp.energy != null){ p.eAdj = 0; p.eAdj = gp.energy - production(p).eBal; }
    if(gp.ships){ p.ships = Object.assign({}, gp.ships); p.shipsAt = gp.shipsAt || 0; }
    if(gp.stock && gp.stock.m != null && gp.stock.at !== p.stockGameAt){ p.stock = {...gp.stock}; p.stockGameAt = gp.stock.at; }
    kept.push(p);
  }
  if(kept.length) S.planets = kept;
  S.timers = (S.timers || []).filter(t=>!t.game);
  for(const t of (g.timers || [])){
    const tm = {id:'g'+t.end+(t.techId||t.type)+(t.planetId||''), game:true, queue:t.type, end:t.end*1000, done:t.end*1000 <= Date.now()};
    const pi = S.planets.findIndex(p=>p.gid===t.planetId);
    if(OG_TECH[t.techId]){ tm.kind='t'; tm.k=OG_TECH[t.techId]; tm.lvl=S.tech[tm.k]+1; }
    else if(OG_BUILD[t.techId] && pi>=0){ tm.kind='b'; tm.pid=S.planets[pi].id; tm.k=OG_BUILD[t.techId]; tm.lvl=S.planets[pi].b[tm.k]+1; }
    else if(t.type==='fleet'){ tm.kind='x'; tm.k = /exp/i.test(t.label) ? 'expo' : 'fleet'; tm.label = t.label; }
    else {
      tm.kind='x'; tm.k = t.type!=='shipyard' ? 'other' : +t.techId===212 ? 'sats' : 'shipyard';
      tm.techId = t.techId || null;
      tm.pid = (S.planets[pi]||{}).id;
      tm.label = t.label + (pi>=0 && S.planets.length>1 ? ` · ${S.planets[pi].name}` : '');
      /* Le jeu nomme ce que son chantier sort, jamais combien : « Grand
         transporteur » peut en valoir un ou cent, et sa file enchaîne les lots
         sans annoncer les suivants. On retient donc l'heure du lot : le compte
         au sol ne vaut que jusque-là, et `chantierFlou` fait taire ce chantier
         jusqu'à ce que la page le redise. Sans ça, le copilote reproposait ce
         qui était déjà en construction, et la carte disparaissait au clic — au
         moment où la page relue lui apprenait la vérité. */
      if(t.type==='shipyard' && S.planets[pi]){
        const q = S.planets[pi], id = +t.techId || 0, def = id>=400 && id<500;
        if(!def) q.flotteFloue = Math.max(q.flotteFloue||0, tm.end);
        if(def || !id) q.defFloue = Math.max(q.defFloue||0, tm.end);
      }
    }
    S.timers.push(tm);
  }
  S.timers = S.timers.filter(t=>t.game || !t.manual || !S.timers.some(g=>g.game && !g.done && g.kind===t.kind && g.k===t.k && (g.kind!=='b' || g.pid===t.pid)));
  S.moves = g.moves || [];
  /* Une sonde en vol vaut un « Fait » : la cible sort de la liste sans clic.
     Mission 6 = espionnage ; le jeu la montre tant qu'elle n'est pas rentrée. */
  for(const m of S.moves) if(m.mission===6 && !m.ret && m.dest) S.raids[m.dest] = {at:Date.now(), probe:true};
  if(g.artefacts != null) S.artefacts = g.artefacts;
  if(g.slots) S.slots = g.slots;
  if(g.prod && typeof g.prod === 'object'){
    S.prod = S.prod || {};
    for(const [gid, e] of Object.entries(g.prod)){
      if(!/^\d+$/.test(gid)) continue; // « __proto__ » & co : jamais une clé
      const r = e && parseProdPanel(e.text);
      if(r){ r.at = +e.at || 0; S.prod[gid] = r; calePlanete(S.planets.find(x=>x.gid===gid)); }
    }
  }
  S.sample = false;
  S.syncAt = g.at || Date.now();
  save();
  const a = document.activeElement;
  const typing = a && view.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
  typing ? refresh() : render();
}
render();
/* Et à l'ouverture du panneau : le réglage peut avoir été posé avant que la
   page sache l'écouter, auquel cas aucun changement de sélecteur ne viendra
   plus jamais le lui dire. */
pushLook();
/* Ce que la page du jeu affiche vient du plan, et le plan ne se publie que
   depuis l'onglet Aujourd'hui. Un panneau rouvert sur Réglages laissait donc
   la page avec le plan d'avant — et rien ne le disait. On le recalcule pour
   elle, même quand on regarde ailleurs : le dessin ne doit pas dépendre de
   l'onglet ouvert. */
publieLePlan();
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
