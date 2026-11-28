/* ---------- les formules du jeu ----------
   Tables des bâtiments (B) et des recherches (T), et les calculs qui n'en
   dépendent que d'elles : coût d'un niveau ou d'une plage, capacité des
   hangars, foreuses, satellites, bonus de position.

   Module du noyau (issue #49) : il n'importe rien et ne lit pas l'état `S`.
   Tout ce qui a besoin des réglages du joueur (vitesse de l'univers, classe,
   ratio d'échange) reste à côté de l'état, pas ici. Déplacé d'app.js tel
   quel : aucune formule n'a changé. */

export const B = {
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
  /* Ni l'un ni l'autre ne produit ni ne stocke : le classement par amortissement
     ne les propose jamais de lui-même. Ils sont ici pour que le joueur puisse
     les viser au clic droit, et que le plan sache ce que coûte le pas. */
  depot:   {n:'Dépôt de ravitaillement', c:[20000,40000,0], f:2},
  silo:    {n:'Silo de missiles', c:[20000,20000,1000], f:2, req:{b:{shipyard:1}}},
  terra:   {n:'Terraformeur', c:[0,50000,100000], f:2, req:{b:{nanite:1}, t:{energy:12}}},
  /* Seul bâtiment à quintupler d'un niveau à l'autre. Ses conditions ne sont
     pas relevées : mieux vaut ne rien annoncer qu'annoncer un chantier faux. */
  dock:    {n:'Dock spatial', c:[200,0,50], f:5},
};

export const B_SHORT = {crawl:'Foreuses', metal:'Métal',crystal:'Cristal',deut:'Deut.',solar:'Solaire',fusion:'Fusion',robot:'Robots',shipyard:'Chantier',lab:'Labo',nanite:'Nanites',smetal:'Hangar M',scrystal:'Hangar C',sdeut:'Réserv. D',depot:'Dépôt',silo:'Silo',terra:'Terraf.',dock:'Dock'};

export const T = {
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

/** Cost of one level of a building or research. */
export function levelCost(def, L){
  const k = Math.pow(def.f, L-1);
  return def.c.map(x => def===T.astro ? Math.round(x*k/100)*100 : Math.floor(x*k));
}

/** Cumulative cost from level `from` (exclusive) to `to` (inclusive). */
export function rangeCost(def, from, to){ const t=[0,0,0]; for(let L=from+1; L<=to; L++){ const c=levelCost(def,L); t[0]+=c[0]; t[1]+=c[1]; t[2]+=c[2]; } return t; }

export function storageCap(L){ return 5000*Math.floor(2.5*Math.exp(20*L/33)); }

/**
 * Plus petit niveau de hangar dont la capacité couvre `amount`. Un hangar trop
 * petit n'interdit pas la dépense : les ressources livrées par transport
 * dépassent la capacité, seule la production locale s'arrête au plafond. Ce
 * niveau est donc une option — l'autre étant de caler la livraison juste avant.
 * @param {number} amount montant à loger
 * @returns {number} niveau de hangar
 */
export function storageLevelFor(amount){ let L = 0; while(L < 40 && storageCap(L) < amount) L++; return L; }

/**
 * Foreuses utiles sur une planète : huit par niveau de mine cumulé. Au-delà,
 * une foreuse de plus ne rapporte rien.
 * @returns {number}
 */
export function crawlerMax(metal, crystal, deut){ return 8*(metal+crystal+deut); }

/**
 * Bonus de production des foreuses, en fraction de la production de base :
 * +0,02 % par foreuse, ×1,5 pour un Collectionneur, ×1,5 encore en surcharge
 * à 150 % (énergie doublée), plafonné à 50 %.
 * @returns {number}
 */
export function crawlerBonus(n, cls, overload){
  return Math.min(Math.max(0, n)*0.0002*(cls==='collector'?1.5:1)*(overload?1.5:1), 0.5);
}

export const CRAWLER_COST = [2000, 2000, 1000];

export const CRAWLER_ENERGY = 50;

/* Le prix d'un satellite solaire, qui ne dépend de rien. */
export const SAT_COST = [0, 2000, 500];

/* Les trois mines, avec le coefficient d'énergie du jeu : dix par niveau pour
   le métal et le cristal, vingt pour le deutérium. */
export const MINES_PCT = [[/^Mine de métal/i, 10], [/^Mine de cristal/i, 10], [/^Synthétiseur de deut/i, 20]];

export const POS_BONUS_M = {6:.17, 7:.23, 8:.35, 9:.23, 10:.17};

export const POS_BONUS_C = {1:.40, 2:.30, 3:.20};

/**
 * Énergie que rend un satellite solaire, qui ne tient qu'à la température.
 * Formule du wiki : (température max + 140) / 6, arrondie vers le bas. Les
 * bonus de classe et d'officier n'y sont pas — `production` les applique à la
 * production d'énergie entière, satellites compris.
 * @param {number} tmax température maximale de la planète
 * @returns {number} énergie par satellite
 */
export function satEnergy(tmax){ return Math.max(1, Math.floor(((+tmax || 0) + 140) / 6)); }
/** Les quinze positions d'un système : cases (min, moyenne, max), température
    du milieu de la fourchette, bonus de production et niveau d'astrophysique
    qu'il faut pour les atteindre. */
export const POS = [null,
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
