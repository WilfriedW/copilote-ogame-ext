/* ---------- les constats du moteur sur l'empire ----------
   Les évaluateurs que les règles de rules.json appellent par leur condition
   (`EVAL.energyBalance`, `EVAL.nextLevelCost`, `EVAL.queueEmpty`,
   `EVAL.researchIdle`, `EVAL.mineBalanceTarget`, `EVAL.nanitesLagging`,
   `EVAL.fieldsFree`, `EVAL.labNetworkGap`, `EVAL.colonySlotFree`,
   `EVAL.researchElsewhere`, `EVAL.techBelow`…), et `rechercheAilleurs`, qui ne
   sert qu'à eux.

   Domaine de l'issue #49. Ce module ne fait que s'inscrire dans `EVAL` au
   chargement : app.js l'importe pour cela seul. Il lit le plan du jour, les
   chantiers et la production, et emprunte encore à app.js la colonisation et
   `rankUpgrades`, appelés et jamais lus au chargement. */
import { colSentNow, maxPlanets, coloFrom } from '../colonisation/colonisation.js';
import { S } from '../core/etat.js';
import { B, B_SHORT, T, levelCost } from '../core/formules.js';
import { hyperCargoPct } from '../core/serveur.js';
import {
  fileDe, enCours, fileBat, mineEnRetard, signe, naniteRetard,
  robotsOuNanites, laboEnRetard, labOkPour, profilVise
} from '../economie/chantiers.js';
import { production, stockNow, upLabel } from '../economie/production.js';
import { planeteRecherche, labPlanet, reqOk } from '../economie/centre.js';
import { rechercheEnCours, nextResearch, casesBasses } from './journee.js';
import { energyOptions, energyLine } from './missions.js';
import { prios } from './priorites.js';
import { rankUpgrades } from './vocations.js';
import { EVAL, HANGARS } from '../regles/moteur.js';
import { aSoi } from '../regles/fichier.js';
/* L'option satellites est respectée par energyOptions : un satellite écarté
   ne sort pas comme la solution, il se dit à part dans planetAlerts. */
EVAL.energyBalance = p => {
  const pr = production(p);
  if(!(pr.factor < 1)) return [];
  const ok = energyOptions(p).filter(o => o.prete), best = ok[0];
  return [{valeur:0, repond:{kinds:['b', 'sats'], ks:['solar', 'fusion']},
    vars:{pct:Math.round(pr.factor * 100), quoi:best ? best.label : B.solar.n,
      options:best ? `Le moins cher par point d'énergie : ${energyLine(best)}.${ok.length > 1 ? ` Sinon ${ok.slice(1).map(energyLine).join(', ')}.` : ''}`
        : 'Monte la centrale solaire.'}}];
};
/* Le meilleur pas du classement ne tient pas dans le hangar : le plan monte le
   hangar d'abord (pickBuildings). Sans cette règle l'attente serait infinie et
   setGoal la tairait, d'où son verrou. */
EVAL.nextLevelCost = p => {
  const best = rankUpgrades(p).filter(u => u.payback < Infinity && B[u.key])[0];
  if(!best) return [];
  const pr = production(p), bc = best.extraSolar ? levelCost(B.solar, p.b.solar + 1) : levelCost(B[best.key], best.lvl), out = [];
  for(let j = 0; j < 3; j++) if(bc[j] > pr.cap[j]){
    const [name, bk] = HANGARS[j];
    out.push({valeur:`${best.key}${best.lvl}:${j}`, cost:levelCost(B[bk], p.b[bk] + 1), repond:{kinds:['b'], ks:[bk]},
      vars:{mine:upLabel(best), hangar:name, niveau:p.b[bk]}});
  }
  return out;
};
/* La mine conseillée ferait passer l'énergie en négatif : la centrale d'abord,
   et son prix est compté dans celui de la mine (rankUpgrades). */
EVAL.nextMineEnergy = p => {
  const u = rankUpgrades(p).filter(x => x.payback < Infinity && B[x.key]).slice(0, 2).find(x => x.extraSolar);
  if(!u || p.satPending) return [];
  return [{valeur:`${u.key}${u.lvl}`, cost:levelCost(B.solar, p.b.solar + 1), repond:{kinds:['b', 'sats'], ks:['solar']},
    vars:{mine:`${B_SHORT[u.key]} ${u.lvl}`, niveau:p.b.solar}}];
};
/* La valeur du constat est la fin du dernier chantier connu : une file revidée
   plus tard est une autre occurrence, et un « Ignorer » d'hier ne la cache pas. */
EVAL.queueEmpty = p => {
  const l = fileDe(p, fileBat);
  if(l.some(enCours)) return [];
  return [{valeur:l.reduce((m, t) => Math.max(m, +t.end || 0), 0), repond:{kinds:['b']}, vars:{}}];
};
EVAL.researchIdle = p => {
  const lab = planeteRecherche();
  if(!lab || lab.id !== p.id || !(p.b.lab >= 1)) return [];
  const l = (S.timers || []).filter(t => t && (t.kind === 't' || (t.kind === 'x' && t.queue === 'research')));
  if(l.some(enCours)) return [];
  return [{valeur:l.reduce((m, t) => Math.max(m, +t.end || 0), 0), repond:{kinds:['t'], partout:true}, vars:{}}];
};
EVAL.mineBalanceTarget = p => {
  const r = mineEnRetard(p); if(!r) return [];
  return [{valeur:`${r.k}:${r.cible}:${r.actuel}`, cost:levelCost(B[r.k], p.b[r.k] + 1), repond:{kinds:['b'], ks:[r.k]},
    vars:{cible:signe(r.cible), actuel:signe(r.actuel), mine:B[r.k].n, niveau:p.b[r.k], position:r.position,
      style:(PROFILS.styles[S.profil.style] || {}).n || ''}}];
};
EVAL.nanitesLagging = p => {
  const r = naniteRetard(p); if(!r) return [];
  return [{valeur:`${r.n}:${r.max}`, cost:levelCost(B.nanite, r.n + 1), repond:{kinds:['b'], ks:['nanite']}, vars:{niveau:r.n, max:r.max}}];
};
EVAL.nanitesOverRobots = p => {
  const pr = prios().find(x => x.kind === 'b' && x.pid === p.id && x.k === 'robot');
  const r = pr && robotsOuNanites(p, (p.b.robot || 0) + 1);
  return r ? [{valeur:`${r.robots}:${r.nanite}`, cost:levelCost(B.nanite, r.nanite), vars:r}] : [];
};
EVAL.fieldsFree = p => {
  const l = casesBasses(p); if(l == null) return [];
  const manque = reqOk(B.terra.req, p);
  return [{valeur:l, cost:manque.length ? null : levelCost(B.terra, (p.b.terra || 0) + 1), repond:{kinds:['b'], ks:['terra']},
    vars:{libres:l, pris:p.cases.pris, max:p.cases.max, niveau:p.b.terra || 0,
      terra:manque.length ? `Le Terraformeur en ajouterait, mais il demande ${manque.join(', ')}.` : 'Le Terraformeur en ajoute à chaque niveau.'}}];
};
EVAL.labNetworkGap = p => {
  if(rechercheEnCours()) return [];
  const r = laboEnRetard(p); if(!r) return [];
  return [{valeur:`${r.niveau}:${r.centre}`, cost:levelCost(B.lab, r.niveau + 1), repond:{kinds:['b'], ks:['lab']}, vars:r}];
};
EVAL.colonySlotFree = p => {
  const f = coloFrom();
  if(!f || f.id !== p.id || S.planets.length >= maxPlanets() || colSentNow()) return [];
  return [{valeur:`${S.planets.length}/${maxPlanets()}`, repond:{kinds:['ship', 'fleet'], partout:true},
    vars:{planetes:S.planets.length, max:maxPlanets(), astro:S.tech.astro,
      note:S.day.focus === 'eco' ? ' Avec « Économie pure », le plan ne colonise pas de lui-même : c\'est à toi de lancer le vaisseau.' : ''}}];
};
/* La recherche de tête, impayable au centre, payable ici avec un labo qui
   remplit le prérequis. Une seule planète le dit : la première qui peut. */
function rechercheAilleurs(){
  const lab = labPlanet(); if(!lab || rechercheEnCours()) return null;
  const R = nextResearch().list[0]; if(!R) return null;
  const c = levelCost(T[R.k], R.lvl), peut = q => { const st = stockNow(q); return c.every((x, j) => x <= st[j]); };
  if(peut(lab)) return null;
  const q = S.planets.find(x => x.id !== lab.id && labOkPour(R.k, x) && peut(x));
  return q ? {R, c, q} : null;
}
EVAL.researchElsewhere = p => {
  const r = rechercheAilleurs(); if(!r || r.q.id !== p.id) return [];
  return [{valeur:`${r.R.k}${r.R.lvl}`, cost:r.c, repond:{kinds:['t'], partout:true},
    vars:{recherche:`${T[r.R.k].n} ${r.R.lvl}`, depuis:p.name}}];
};
EVAL.techBelow = (p, prm, r) => {
  const lab = labPlanet();
  if(!lab || lab.id !== p.id || !aSoi(T, r.tech) || !profilVise(r)) return [];
  const n = S.tech[r.tech] || 0;
  if(!(n < prm.niveauCible)) return [];
  return [{valeur:String(n), cost:levelCost(T[r.tech], n + 1), repond:{kinds:['t'], partout:true, tk:r.tech},
    vars:{niveau:n, cible:prm.niveauCible, style:(PROFILS.styles[S.profil.style] || {}).n || '', pct:hyperCargoPct()}}];
};
