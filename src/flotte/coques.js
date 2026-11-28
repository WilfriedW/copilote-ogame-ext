/* ---------- les coques et le chantier ----------
   Ce que coûte un vaisseau (`SHIP_COST`), ce qu'il demande pour se construire
   (`SHIP_REQ`, `shipReqOk`) et le temps qu'il prend au chantier (`shipTime`).

   Domaine de l'issue #49. La défense y recopie ses pièces à son chargement
   (src/defense/defense.js) : elle lit `shipReqOk`, et l'inverse fermerait une
   boucle. Le vaisseau de colonisation vit ici pour la même raison. */
import { S } from '../core/etat.js';
import { CRAWLER_COST } from '../core/formules.js';
import { ecoSpeed } from '../core/serveur.js';

/* Le vaisseau de colonisation : sans ses kits, qui restent à la colonisation. */
export const COL_SHIP_COST = [10000, 20000, 10000];
/* Le copilote ne proposera jamais de construire une coque de combat — le wiki
   dit le marché mauvais des deux côtés, et la demande de flotte l'a écrit une
   fois pour toutes. Leurs coûts sont ici pour une seule raison : le tir de lune
   les lit. Les débris valent 30 % du métal et du cristal détruits, donc chiffrer
   un tir demande le coût de ce qui meurt, et rien d'autre ne les lit. */
export const SHIP_COST = {
  sc:[2000,2000,0],   lc:[6000,6000,0],      pr:[0,1000,0],         pf:[8000,15000,8000],
  lf:[3000,1000,0],   hf:[6000,4000,0],      cr:[20000,7000,2000],  bs:[45000,15000,0],
  bc:[30000,40000,15000], bb:[50000,25000,15000], ds:[60000,50000,15000],
  rp:[85000,55000,20000], rec:[10000,6000,2000], col:COL_SHIP_COST,
  crawl:CRAWLER_COST};
export const SHIP_REQ = {sc:{b:{shipyard:2}, t:{combustion:2}}, lc:{b:{shipyard:4}, t:{combustion:6}}, pr:{b:{shipyard:3}, t:{combustion:3, espionage:2}}, pf:{b:{shipyard:5}, t:{hyperdrive:2}}, crawl:{b:{shipyard:5}, t:{combustion:4, armour:4, laser:4}}};
export function shipReqOk(k, p){ const r = SHIP_REQ[k]; return Object.entries(r.b).every(([b,l])=>p.b[b]>=l) && Object.entries(r.t).every(([t,l])=>S.tech[t]>=l); }
export function shipTime(k, n, p){ const c = SHIP_COST[k]; return n*(c[0]+c[1])/(2500*(1+p.b.shipyard)*Math.pow(2,p.b.nanite)*ecoSpeed())*3600; }
