/* ---------- la vocation d'une planète ----------
   Ce que chaque planète produit le mieux selon son terrain (`terrainRates`,
   `vocations`, `vocWhy`), ce qui manque à l'empire (`besoinEmpire`), et
   les mines et foreuses qui rapportent le plus vite au prix de cet empire
   (`rankUpgrades`).

   Module du plan du jour (issue #49). Ce module emprunte encore à app.js
   la production et les stocks : ce cycle-là est toléré tant qu'app.js
   existe, et rien n'y est lu au chargement. */
import {
  B, levelCost, crawlerMax, CRAWLER_COST, POS_BONUS_M, POS_BONUS_C
} from '../core/formules.js';
import { buildTime } from '../core/serveur.js';
import { mse, production } from '../economie/production.js';
import { shipReqOk, shipTime } from '../flotte/coques.js';
import { S } from '../core/etat.js';
import { planetRef } from '../core/format.js';
import { parseC } from '../flotte/vaisseaux.js';
/**
 * Ce que vaut une ressource à la marge, pour cet empire-là, par rapport à son cours.
 *
 * Le ratio d'échange dit ce qu'une ressource vaut AU TROC. Lu comme des
 * quantités, il dit donc aussi le mélange qu'il faudrait produire pour n'avoir
 * jamais à troquer. Un empire qui produit plus que sa part de métal n'en tire
 * pas le prix du livre : il l'empile dans un hangar, ou il le brade. Un niveau
 * de mine se juge sur ce que la ressource vaut ici, pas sur son cours.
 *
 * Bornes à 0,5 et 2 : un écart de mélange corrige un classement, il ne le
 * retourne pas. Sans elles, une planète sans synthétiseur ferait valoir son
 * deutérium cent fois son métal et toutes les cartes diraient « deutérium ».
 * @returns {number[]} trois facteurs, 1 chacun quand le mélange est sur sa cible
 *
 * ponytail: relu à chaque appel de `rankUpgrades`, donc O(planètes²) sur une
 * journée simulée — 19 ms à 54 ms pour douze planètes. Sans mémo parce que les
 * niveaux bougent PENDANT la simulation et qu'un mélange figé en tête de
 * journée mentirait le soir. À passer en paramètre depuis les appelants si le
 * panneau devient lent.
 */
export function besoinEmpire(){
  const r = S.settings.ratio, som = r[0]+r[1]+r[2], P = [0,0,0];
  for(const p of S.planets){ const pr = production(p); P[0]+=pr.m; P[1]+=pr.c; P[2]+=pr.d; }
  /* Un deutérium net négatif — la fusion en brûle plus que le synthétiseur n'en
     sort — n'est pas une part nulle : c'est le manque le plus franc qui soit,
     donc le facteur haut. */
  const tot = P.reduce((a,x)=>a+Math.max(0,x), 0);
  if(!(tot > 0)) return [1,1,1];
  return P.map((x,i) => x > 0 ? Math.min(Math.max((r[i]/som)/(x/tot), .5), 2) : 2);
}
/** Comme `mse`, mais au prix que ces ressources ont pour cet empire-là. */
export function mseW(m,c,d,w){ const r=S.settings.ratio; return m*w[0] + c*w[1]*r[0]/r[1] + d*w[2]*r[0]/r[2]; }

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
  const nu = Object.assign({}, p, {gid:null, crawlers:0, sats:0, eAdj:0, pAdj:null});
  const ov = {metal:TERRAIN_LVL, crystal:TERRAIN_LVL, deut:TERRAIN_LVL, fusion:0, crawlers:0, solar:p.b.solar};
  /* Assez de centrales pour que rien ne soit bridé : un terrain se mesure à
     plein régime, sinon il dirait l'énergie posée plutôt que le sol. Même
     boucle bornée que rankUpgrades. */
  let pr = production(nu, ov), garde = 0;
  while(pr.factor < 1 && garde++ < 200){ ov.solar++; pr = production(nu, ov); }
  return {m:pr.m, c:pr.c, d:pr.d};
}
export const VOC_KEYS = ['metal', 'crystal', 'deut'];
const VOC_RATE = {metal:'m', crystal:'c', deut:'d'};
export const VOC_NOM = {metal:'Métal', crystal:'Cristal', deut:'Deutérium'};
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
export function vocations(){
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
/** Les prochains niveaux de mine et les foreuses d'une planète, du plus vite amorti au plus lent. */
export function rankUpgrades(p){
  const base = production(p), baseV = mse(base.m, base.c, base.d), out=[];
  /* Deux lectures du même pas. `payback` reste au cours du ratio : c'est le
     chiffre que la carte affiche et que le joueur peut refaire de tête, et il
     ne doit pas bouger parce qu'une autre planète a monté une mine. `score`
     est le même calcul au prix que ces ressources ont dans CET empire, et
     c'est lui qui classe. Les séparer est tout l'objet : le classement suit
     le besoin, l'affichage reste vérifiable. */
  const w = besoinEmpire(), baseW = mseW(base.m, base.c, base.d, w);
  const scoreOf = (pr, cost, gain) => {
    const g = mseW(pr.m, pr.c, pr.d, w) - baseW;
    return (gain > 0 && g > 0) ? mseW(...cost, w)/g : Infinity;
  };
  for(const k of ['metal','crystal','deut']){
    const ov = {[k]:p.b[k]+1}; let cost = levelCost(B[k], p.b[k]+1), extra=0;
    let pr = production(p, ov);
    while(pr.factor<1 && extra<15){ extra++; ov.solar = p.b.solar+extra; const sc=levelCost(B.solar, p.b.solar+extra); cost=cost.map((x,i)=>x+sc[i]); pr=production(p,ov); }
    const gain = mse(pr.m,pr.c,pr.d)-baseV;
    out.push({key:k, lvl:p.b[k]+1, extraSolar:extra, cost, gain, payback: gain>0 ? mse(...cost)/gain : Infinity, score:scoreOf(pr,cost,gain), time:buildTime(k,p.b[k]+1,p)});
  }
  if(base.factor<1){
    const pr = production(p,{solar:p.b.solar+1}), cost=levelCost(B.solar,p.b.solar+1), gain=mse(pr.m,pr.c,pr.d)-baseV;
    out.push({key:'solar', lvl:p.b.solar+1, extraSolar:0, cost, gain, payback: gain>0?mse(...cost)/gain:Infinity, score:scoreOf(pr,cost,gain), time:buildTime('solar',p.b.solar+1,p)});
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
              payback: gain>0 ? mse(...cost)/gain : Infinity, score:scoreOf(pr,cost,gain), time:shipTime('crawl', n, p)});
  }
  return out.sort((a,b)=>a.score-b.score);
}
