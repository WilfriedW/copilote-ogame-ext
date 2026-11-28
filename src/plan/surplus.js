/* ---------- les ressources en trop ----------
   Les deux règles du moteur sur le stockage (`storageRatio`, `storageEta`),
   et ce que le plan propose quand un hangar déborde : dépenser sur place ce
   qu'il juge déjà utile, envoyer l'excédent là où il manque, sinon monter le
   hangar (`solutionsSurplus`, `surplusListe`). `debordeA` et
   `autreCibleAvecPlace` disent à la sécurité où ranger ce qui part le soir.

   Domaine de l'issue #49. Il lit le plan du jour (projection, livraisons,
   dépenses payables) sans que le plan le lise : ce qui sert aux deux vit
   dans src/economie/debordements.js. */
import { S } from '../core/etat.js';
import { fmt, fmtK, majus } from '../core/format.js';
import { T, levelCost } from '../core/formules.js';
import { planetById } from '../core/planetes.js';
import { buildTime } from '../core/serveur.js';
import { dur, formatTime } from '../core/temps.js';
import { DEF, defsOf, defPropositions } from '../defense/defense.js';
import { labOkPour } from '../economie/chantiers.js';
import { pertesParHeure, hangarSiJustifie } from '../economie/debordements.js';
import { production, mse, NOM_RES, stockNow } from '../economie/production.js';
import { labPlanet } from '../economie/centre.js';
import { expoRes, expoFleet } from '../flotte/expeditions.js';
import { parseC, distance, shipStats, flight, shipList } from '../flotte/vaisseaux.js';
import {
  rechercheEnCours, depensesPayables, nextResearch, livraisons,
  projectResources, cardKey, refused
} from './journee.js';
import { EVAL, regleActive, regleParam, HANGARS, constatsVus } from '../regles/moteur.js';
/* ---------- les règles du moteur : stockage ---------- */
/* Au plafond, la production s'arrête. Ce qui la relance, dans l'ordre :
   dépenser sur place ce que le plan juge déjà utile, sinon envoyer l'excédent
   là où il manque, sinon — et seulement si le débordement revient — monter le
   hangar (solutionsSurplus). Baisser la production n'est jamais une réponse :
   c'est la perte même qu'on cherche à éviter. */
EVAL.storageRatio = (p, prm) => {
  const pr = production(p), st = stockNow(p), out = [];
  for(let k = 0; k < 3; k++){
    if(!(st[k] >= pr.cap[k] * prm.seuil)) continue;
    const [name, bk] = HANGARS[k], sol = solutionsSurplus(p, k, null)[0] || null;
    out.push({valeur:k, cost:sol && sol.cost ? sol.cost : null,
      repond:sol && sol.type === 'hangar' ? {kinds:['b'], ks:[bk]} : {kinds:['b']},
      vars:Object.assign(surplusVars(p, k, st, pr), {hangar:name, niveau:p.b[bk], montee:dur(buildTime(bk, p.b[bk] + 1, p)),
        quoi:sol ? sol.what : 'Un transport', depense:solutionPhrase(sol, k)})});
  }
  return out;
};
/* Le plafond qui approche : par la production, avec un délai qui couvre au
   moins `heures` ; ou par une livraison — un retour d'expédition ne se
   détourne pas, et il peut remplir le hangar d'un coup. Les livraisons
   comptent sur 24 h : la plus lointaine est celle qu'on peut encore préparer. */
EVAL.storageEta = (p, prm) => {
  const pr = production(p), st = stockNow(p), rates = [pr.m, pr.c, pr.d], out = [];
  const plein = regleParam('RES_STORAGE_FULL', 'seuil', .98), now = Date.now();
  const livs = livraisons(p).filter(l => l.at > now && l.at <= now + 24 * 3600e3);
  for(let k = 0; k < 3; k++){
    if(st[k] >= pr.cap[k] * plein) continue;
    const [name, bk] = HANGARS[k], mont = buildTime(bk, p.b[bk] + 1, p);
    let dans = rates[k] > 0 ? (pr.cap[k] - st[k]) / rates[k] * 3600 : Infinity, cause = '';
    if(!(dans < Math.max(prm.heures, mont / 3600) * 3600)) dans = Infinity;
    const l = livs.find(x => x.cargo[k] > 0 && projectResources(p, x.at)[k] >= pr.cap[k] * plein);
    if(l && (l.at - now) / 1000 < dans){
      dans = (l.at - now) / 1000;
      const v = l.mv || {}, de = (v.sens === 'retour' ? v.cible : v.origine) || {};
      cause = (v.mission === 15 ? `Retour d'expédition à ${formatTime(l.at)}` : `Convoi ${de.nom || de.coords || ''} à ${formatTime(l.at)}`.replace('  ', ' '))
        + ` : +${fmt(l.cargo[k])} ${NOM_RES[k]}. `;
    }
    if(!isFinite(dans)) continue;
    const sol = solutionsSurplus(p, k, null)[0] || null;
    out.push({valeur:k, cost:sol && sol.cost ? sol.cost : null,
      repond:sol && sol.type === 'hangar' ? {kinds:['b'], ks:[bk]} : null,
      vars:Object.assign(surplusVars(p, k, st, pr), {hangar:name, niveau:p.b[bk], dans:dur(dans), montee:dur(mont), cause,
        quoi:sol ? sol.what : 'Un transport', depense:solutionPhrase(sol, k), secs:dans})});
  }
  return out;
};
/** Les variables communes aux deux règles de hangar. */
function surplusVars(p, k, st, pr){
  const l = pertesParHeure(p, k, pr), e = st[k] - pr.cap[k];
  return {ressource:NOM_RES[k], Ressource:majus(NOM_RES[k]), pertes:`${fmtK(l.res)} ${NOM_RES[k]}/h`,
    excedent:e > 0 ? `${fmt(e)} au-dessus de la capacité (${fmt(pr.cap[k])})` : `${Math.floor(st[k] / pr.cap[k] * 100)} % de la capacité (${fmt(pr.cap[k])})`};
}
/** La première solution en une phrase, pour le texte de la règle. */
function solutionPhrase(s, k){
  if(!s) return `Rien d'utile n'est finançable ici avec le ${NOM_RES[k]} : envoie-le là où il manque.`;
  if(s.type === 'depense') return `${s.what} : ${fmt(s.cost[k])} de ${NOM_RES[k]} d'un coup, pour une dépense utile — pas un achat pour vider.`;
  if(s.type === 'transfert') return `Envoie ${fmt(s.charge[k])} de ${NOM_RES[k]} à ${s.dest.name} : ${s.pour}.`;
  return `${s.what} : ${s.pourquoi}.`;
}
export var SURPLUS_REGLES = ['RES_STORAGE_FULL', 'RES_STORAGE_SOON'];

/**
 * Ce que le plan met de côté sur `p` au début de la journée : la même règle
 * que `reserveOf` dans simulateDay — le coût d'un objectif, moins ce que la
 * production y apporte d'ici son échéance.
 */
function reservePlan(plan, p){
  const s0 = plan && plan.sessions && plan.sessions[0], out = [0, 0, 0], pi = S.planets.indexOf(p);
  if(!s0 || pi < 0) return out;
  const pr = production(p), r = [pr.m, pr.c, pr.d];
  for(const g of s0.goals || []){
    if(g.p !== pi || !g.cost) continue;
    const h = Math.max(0, (g.deadline - s0.T) / 3600e3);
    g.cost.forEach((x, j) => { out[j] += Math.max(0, x - r[j] * h); });
  }
  return out;
}
/**
 * Ce qui, sur `p`, est déjà utile au plan : ses chantiers, cases de forme de
 * vie, vaisseaux et défenses, qu'ils partent aujourd'hui ou attendent ; les
 * recherches du plan quand cette planète peut les payer (son labo est le
 * centre, ou RECH_FUND_ELSEWHERE la laisse payer) ; les pièces que le modèle
 * de défense réclame. Sans plan — une règle se lit avant lui — les mines,
 * centrales, cases de forme de vie et recherches payables ici.
 * Jamais un achat « pour vider » : les puits de PUITS n'y sont pas.
 * @returns {{kind:string, what:string, cost:number[], depuis?:boolean}[]}
 */
function utilesSurPlace(p, plan, dispo, k){
  const out = [], pi = S.planets.indexOf(p), lab = labPlanet(), rech = rechercheEnCours();
  const ici = lab && lab.id === p.id, ailleurs = !ici && regleActive('RECH_FUND_ELSEWHERE');
  const rechOk = t => !rech && T[t] && (ici || (ailleurs && labOkPour(t, p)));
  if(plan){
    for(const x of plan.sessions || []) for(const a of (x.acts || []).concat(x.waits || [])){
      if(!a || !Array.isArray(a.cost)) continue;
      if(a.kind === 't'){ if(rechOk(a.k)) out.push({kind:'t', what:a.what, cost:a.cost, depuis:!ici}); }
      else if(a.p === pi && ['b', 'lf', 'def', 'shipbuild'].includes(a.kind)) out.push({kind:a.kind, what:a.what, cost:a.cost});
    }
  } else {
    for(const d of depensesPayables(p, k, dispo)) if(!d.puits && d.kind !== 't') out.push(d);
    if(!rech) for(const t of (nextResearch().list || []).slice(0, 3)) if(rechOk(t.k)) out.push({kind:'t', what:`${T[t.k].n} ${t.lvl}`, cost:levelCost(T[t.k], t.lvl), depuis:!ici});
  }
  /* Un lot de défense du modèle : autant de pièces que le stock libre en
     paie, jamais plus que ce qui manque au palier. Page Défense jamais lue :
     rien, on doublerait ce qui existe. */
  const props = defsOf(p) ? defPropositions(p) : null;
  for(const l of (props && props.ordre) || []){
    const u = DEF[l.k].c, n = Math.min(l.manque, ...u.map((x, j) => x > 0 ? Math.floor(Math.max(0, dispo[j]) / x) : Infinity));
    if(n >= 1 && !refused(cardKey('def', p.id, l.k))) out.push({kind:'def', what:`Construire ${shipList({[l.k]:n})}`, cost:u.map(x => x * n)});
  }
  return out;
}
/**
 * La dépense utile qui vide le plus la ressource en trop, payable maintenant
 * sur `p` après les réserves du plan. Le choix se fait sur la part de la
 * ressource dans le prix (au ratio du joueur) : on veut vider le cristal, pas
 * le métal qui manque peut-être ailleurs.
 */
function depenseSurPlace(p, k, plan){
  const st = stockNow(p), res = reservePlan(plan, p), dispo = st.map((x, j) => x - res[j]), ratio = S.settings.ratio || [3, 2, 1];
  const part = c => c[k] * ratio[0] / ratio[k] / Math.max(1e-9, mse(...c));
  const vus = new Set(), cands = [];
  for(const c of utilesSurPlace(p, plan, dispo, k)){
    if(vus.has(c.what) || !(c.cost[k] > 0) || !c.cost.every((x, j) => x <= dispo[j] + 1e-6)) continue;
    vus.add(c.what); cands.push(c);
  }
  /* La part décide, mais pas seule : 1 000 de cristal dans une sonde, c'est
     du cristal pur et ça ne vide rien quand 2 M dépassent. Une dépense qui
     absorbe au moins un dixième de l'excédent (au-dessus de 90 %) passe
     devant ; sous le plafond, toutes se valent. */
  const exces = Math.max(0, st[k] - 0.9 * production(p).cap[k]), pese = c => c.cost[k] >= 0.1 * exces ? 1 : 0;
  cands.sort((a, b) => pese(b) - pese(a) || part(b.cost) - part(a.cost) || b.cost[k] - a.cost[k]);
  const c = cands[0];
  if(!c) return null;
  const quoi = c.kind === 't' ? `Lancer ${c.what}${c.depuis && S.planets.length > 1 ? ` depuis ${p.name}` : ''}` : c.kind === 'def' || /^Construire /.test(c.what) ? c.what : `Lancer ${c.what}`;
  return {type:'depense', kind:c.kind, what:quoi, cost:c.cost};
}

/** Les transporteurs que `p` peut prêter : ni le kit d'expédition, ni la réserve de GT (expoRes). */
function flotteLibre(p){
  const sh = {lc:(p.ships || {}).lc || 0, sc:(p.ships || {}).sc || 0};
  sh.lc = Math.max(0, sh.lc - expoRes(p));
  const kit = expoFleet(p.ships, p);
  if(kit) for(const k of ['lc', 'sc']) sh[k] = Math.max(0, sh[k] - (kit.ships[k] || 0));
  return sh;
}
/** Les transporteurs libres pour lever `amount`, les grands d'abord. */
function soutePour(libres, amount){
  const ships = {};
  let cargo = 0;
  for(const k of ['lc', 'sc']){
    const u = shipStats(k).cargoEff, n = Math.min(libres[k] || 0, u ? Math.ceil(Math.max(0, amount - cargo) / u) : 0);
    if(n > 0){ ships[k] = n; cargo += n * u; }
  }
  return ships;
}
/** Le moins qu'un transfert vaille : sous ce tonnage, le vol coûte plus d'attention qu'il ne rend. */
var SURPLUS_MIN = 5000;
/**
 * Ce que chaque planète attend de cette ressource : ce qui manque aux
 * éléments du plan qu'elle bloque (« En attente de ressources »), et à ses
 * objectifs. La planète de recherche y est par ses recherches en attente.
 * @returns {Map<number, {besoin:number, pour:string[]}>} par indice de planète
 */
function besoinsDe(plan, k){
  const out = new Map(), s0 = plan && plan.sessions && plan.sessions[0];
  if(!s0) return out;
  const note = (i, x, what) => {
    if(!(x > 0) || !S.planets[i]) return;
    const e = out.get(i) || {besoin:0, pour:[]};
    e.besoin = Math.max(e.besoin, x);
    if(what && !e.pour.includes(what)) e.pour.push(what);
    out.set(i, e);
  };
  for(const w of s0.waits || []) if(w.miss) note(w.p, w.miss[k], w.what);
  for(const g of s0.goals || []) if(g.cost && S.planets[g.p]) note(g.p, g.cost[k] - stockNow(S.planets[g.p])[k], g.label);
  return out;
}
/** Ce qui se pose encore sur `q` après `at` : la place d'aujourd'hui est la place de toute la journée. */
function livreApres(q, at, k){ return livraisons(q).filter(l => l.at > at).reduce((a, l) => a + (l.cargo[k] || 0), 0); }
/**
 * L'excédent de `p` envoyé à une planète qui en manque et qui a la place.
 * La quantité est le plus petit de : ce qui ramène `p` sous 90 %, le besoin
 * de la cible, sa place libre jusqu'à 95 %, la soute des transporteurs libres.
 * Cible : le plus gros besoin, puis la plus proche.
 * @returns {object|null} au format de transportHtml, plus `pour` et `besoin`
 */
function transfertVersBesoin(p, k, plan){
  const pr = production(p), st = stockNow(p), cp = parseC(p.coords), pi = S.planets.indexOf(p);
  const exces = st[k] - 0.9 * pr.cap[k];
  if(!cp || !(exces >= SURPLUS_MIN)) return null;
  const libres = flotteLibre(p);
  if(!libres.lc && !libres.sc) return null;
  const now = Date.now(), cands = [];
  for(const [i, b] of besoinsDe(plan, k)){
    const q = S.planets[i];
    if(i === pi || !q || !parseC(q.coords) || refused(cardKey('transfer', p.id, q.coords))) continue;
    let ships = soutePour(libres, Math.min(exces, b.besoin)), fl = flight(p.coords, q.coords, ships, 100);
    if(!fl) continue;
    const arrivee = now + fl.secs * 1000, cq = production(q).cap[k];
    const place = 0.95 * cq - projectResources(q, arrivee)[k] - livreApres(q, arrivee, k);
    const qte = Math.floor(Math.min(exces, b.besoin, place, fl.cargo, k === 2 ? st[2] - fl.fuel : Infinity));
    if(qte < SURPLUS_MIN) continue;
    /* La flotte retaillée à la quantité : moins de vaisseaux, moins de deutérium. */
    ships = soutePour(libres, qte); fl = flight(p.coords, q.coords, ships, 100) || fl;
    const charge = [0, 0, 0]; charge[k] = Math.min(qte, fl.cargo);
    cands.push({q, b, ships, fl, charge, arrivee:now + fl.secs * 1000, d:distance(cp, parseC(q.coords))});
  }
  cands.sort((a, b) => b.b.besoin - a.b.besoin || a.d - b.d);
  const c = cands[0];
  if(!c) return null;
  const pour = `${c.b.pour.slice(0, 2).join(', ')} y attend${c.b.pour.length > 1 ? 'ent' : ''} ${fmt(c.b.besoin)} de ${NOM_RES[k]}`;
  return {type:'transfert', what:`Transférer ${fmt(c.charge[k])} de ${NOM_RES[k]} vers ${c.q.name}`, p, pi, ships:c.ships, dest:c.q,
    mission:3, missionNom:'Transport', pct:100, depart:now, arrivee:c.arrivee, retour:c.arrivee + c.fl.secs * 1000, fuel:c.fl.fuel,
    charge:c.charge, pour, besoin:c.b.besoin, pourquoi:`${majus(pour)}, et la place pour la recevoir.`, note:'Kit d\'expédition et réserve de GT laissés à quai.', gt:0};
}
/**
 * Jusqu'à trois solutions pour une ressource au plafond, dans l'ordre :
 * dépenser sur place, transférer vers un besoin, monter le hangar. Sans plan
 * (une règle se lit avant lui), pas de transfert : les besoins sont ceux du plan.
 */
function solutionsSurplus(p, k, plan){
  const out = [], d = depenseSurPlace(p, k, plan);
  if(d) out.push(d);
  const t = plan ? transfertVersBesoin(p, k, plan) : null;
  if(t) out.push(t);
  const h = hangarSiJustifie(p, k);
  if(h) out.push(h);
  return out.slice(0, 3);
}

/**
 * Les ressources qu'une cargaison ferait passer au-dessus du hangar de `q` à
 * son arrivée : la livraison n'est pas plafonnée, la production si — elle
 * s'arrête tant que le stock reste au-dessus.
 * @returns {number[]} indices de ressource
 */
export function debordeA(q, cargo, at){
  if(!q || !q.stock || !cargo) return [];
  const pr = production(q), proj = projectResources(q, at);
  return [0, 1, 2].filter(j => cargo[j] > 0 && proj[j] + cargo[j] > pr.cap[j]);
}
/** Une autre de mes planètes qui prendrait cette cargaison sous 95 % de ses hangars, la plus proche. */
export function autreCibleAvecPlace(from, cargo, at, exclus){
  const c = parseC(from && from.coords);
  if(!c) return null;
  return S.planets.filter(q => q !== from && !(exclus || []).includes(q) && q.stock && parseC(q.coords)).filter(q => {
    const pr = production(q), proj = projectResources(q, at);
    return [0, 1, 2].every(j => !(cargo[j] > 0) || proj[j] + cargo[j] <= 0.95 * pr.cap[j]);
  }).sort((a, b) => distance(c, parseC(a.coords)) - distance(c, parseC(b.coords)))[0] || null;
}

/**
 * Les ressources au plafond, ou qui vont l'atteindre, une ligne par planète et
 * ressource, la plus coûteuse en production perdue d'abord (en équivalent
 * métal au ratio du joueur). Lit les constats du plan : une règle éteinte ou
 * un constat ignoré n'y est pas.
 */
export function surplusListe(plan){
  const cs = constatsVus((plan && plan.constats) || []).filter(c => c.regle === 'RES_STORAGE_FULL' || c.regle === 'RES_STORAGE_SOON');
  const vus = new Set(), out = [];
  for(const c of cs){
    const p = planetById(c.pid), k = c.valeur, cle = `${c.pid}:${k}`;
    if(!p || ![0, 1, 2].includes(k) || vus.has(cle)) continue;
    vus.add(cle);
    const pr = production(p), st = stockNow(p), l = pertesParHeure(p, k, pr);
    out.push({c, p, k, plein:c.regle === 'RES_STORAGE_FULL', st, cap:pr.cap[k], pertes:l, solutions:solutionsSurplus(p, k, plan)});
  }
  /* Un plafond atteint passe devant un plafond à venir ; à état égal, la
     perte horaire décide. */
  return out.sort((a, b) => (b.plein - a.plein) || b.pertes.eqM - a.pertes.eqM);
}
