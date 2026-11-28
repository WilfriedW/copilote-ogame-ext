/* ---------- le tir de lune ----------
   Ce qu'il faut détruire pour tenter une lune, et ce que ça coûte : la coque
   d'un vaisseau (`luneCoque`), le taux de débris du serveur (`moonDf`), ce que
   la défense de la cible tue (`luneDefense`, `luneMorts`), la chance du tir
   (`luneTir`), le nombre de vaisseaux pour la chance visée
   (`luneVaisseaux`), la facture (`luneFacture`) et la flotte déjà au sol
   (`luneFlotteAuSol`).

   Domaine de l'issue #49. Il lit le noyau, la flotte et la défense, et
   emprunte encore `SHIP_COST` à app.js, lu à l'appel et jamais au
   chargement. */
import { LUNE_DF, S } from '../core/etat.js';
import { srv } from '../core/serveur.js';
import { DEF, defsOf } from '../defense/defense.js';
import { SHIPS } from './vaisseaux.js';
import { SHIP_COST } from '../../app.js';

/* ---------- le tir de lune ---------- */

/* Un tir de lune se chiffre avant de partir, et il se chiffre exactement : la
   chance est linéaire en débris, donc 1 % coûte le même poids de vaisseaux que
   le tir soit gros ou petit. Les débris valent 30 % du métal et du cristal des
   vaisseaux détruits — jamais le deutérium, et la défense détruite n'en produit
   aucun. Chaque 100 000 de débris donne 1 % de chance, jusqu'à 20 % à 2 M.

   Le plancher est dur, et c'est la règle, pas une prudence de notre part :
   « Any time a large battle occurs leaving more than 100k debris behind, the
   owner of the planet where the battle took place receives a moonchance »
   (wiki/Moonchance). Sous 100 000, le combat ne tire rien du tout.

   Le taux de débris, lui, est un réglage d'univers : le wiki donne des univers
   à 30, 40, 50, 60 et 70 %, et à 70 % il faut 715 chasseurs légers au lieu de
   1 667. Le coder en dur surestimerait la facture jusqu'à 2,3 fois, ce qu'aucune
   note ne rattrape — d'où le `df`, en pourcent, que la carte demande au joueur.

   L'arithmétique reste entière : `pct * 1e7 / (df * v)` plutôt que de passer
   par `df / 100`, qui n'est pas exact en binaire et ferait monter un plafond
   d'une unité au mauvais moment. */

/** La coque d'un vaisseau : son métal plus son cristal. Les seize lignes du
    wiki le vérifient sans exception, donc aucune table ne la porte. */
function luneCoque(k){ const c = SHIP_COST[k] || [0, 0, 0]; return c[0] + c[1]; }

/** Ce qu'un tir de `n` vaisseaux `k` laisse derrière lui, et ce qu'il vaut. */
export function luneTir(k, n, df = LUNE_DF){
  const v = luneCoque(k), debris = df * Math.max(0, n) * v / 100;
  /* « more than 100k debris » : 100 000 pile ne donne rien. Le plafond, lui,
     est atteint à 2 M pile — le tableau du wiki y pose 5 000 sondes. */
  return {v, debris, chance: debris <= 1e5 ? 0 : Math.min(20, debris / 1e5)};
}

/** Le nombre de vaisseaux `k` qu'il faut faire mourir pour viser `pct`. */
export function luneVaisseaux(k, pct, df = LUNE_DF){
  const v = luneCoque(k);
  if(!v) return 0;
  let n = Math.ceil(Math.min(20, Math.max(1, pct)) * 1e7 / (df * v));
  /* Tomber pile sur 100 000 ne donne rien : il en faut un de plus. */
  if(df * n * v / 100 <= 1e5) n++;
  return n;
}

/** Ce qu'une lune coûte en espérance, et ce que le recyclage des tirs ratés
    rend. Le tir qui réussit consomme son champ de débris, d'où `tirs - 1`.
    Elle refait le tir elle-même : une chance et un nombre de vaisseaux passés
    séparément pourraient ne pas parler du même tir. */
export function luneFacture(k, n, df = LUNE_DF){
  const t = luneTir(k, n, df);
  if(!t.chance) return null;
  const tirs = Math.ceil(100 / t.chance), c = SHIP_COST[k] || [0, 0, 0];
  return {chance: t.chance, tirs, m: tirs * n * c[0], c: tirs * n * c[1],
          deut: tirs * n * c[2], recupere: (tirs - 1) * t.debris};
}

/** Ce que la flotte posée sur une planète vaut en métal et en cristal, pour
    l'avertissement : elle mourrait avec le tir, et à la charge du joueur.
    `null` quand la flotte n'a jamais été relevée — un zéro inventé ferait
    passer pour sûr un tir qui coûte des millions. */
export function luneFlotteAuSol(p){
  const sh = (p || {}).ships;
  if(!sh) return null;
  let m = 0, c = 0;
  for(const k of Object.keys(SHIPS)){
    const n = Math.max(0, sh[k] || 0), cost = SHIP_COST[k] || [0, 0, 0];
    m += n * cost[0];
    c += n * cost[1];
  }
  return {m, c};
}

/** Le taux de débris de l'univers, en pourcent. Le serveur le publie, donc
    c'est lui qui tranche : le réglage manuel ne sert plus qu'en secours, hors
    extension ou avant la première réponse de l'API. Il reste dans S.settings à
    côté des vitesses, et passe ainsi d'un poste à l'autre par la synchro. */
export function moonDf(){ const d = srv('debrisFactor', null); return d != null ? Math.max(1, d*100) : Math.max(1, +(S.settings.debris) || LUNE_DF); }

/** Ce qui meurt vraiment d'un envoi de `n` vaisseaux `k` sur la planète `p` :
    les survivants rentrent chez l'attaquant et ne font pas de débris. `tues`
    vaut `null` quand la défense n'a jamais été relevée — on suppose alors que
    tout meurt, et l'appelant le dit plutôt que d'inventer un plafond.

    La carte Lune passe par ici : c'est la combinaison qui décide de la
    chance, et elle n'avait pas à vivre en ligne dans un rafraîchissement
    d'affichage. */
export function luneMorts(p, k, n, bouLvl = 0){
  const d = luneDefense(p, k, bouLvl), v = luneCoque(k);
  const tues = d && v ? Math.floor(d.tue / v) : null;
  return {tues, morts: tues == null ? n : Math.min(n, tues)};
}

/** Ce que la défense d'une planète tue en six manches, en métal+cristal, donc
    directement comparable à ce qu'un tir fait mourir. C'est le seul chiffre
    estimé de la carte Lune, et la note le nomme comme tel.

    Deux écarts assumés, qui tirent en sens contraires. La règle d'explosion
    n'est pas comptée — dès que la coque passe sous 70 %, chaque tir reçu a une
    chance de faire sauter la pièce, ce qui tue plus vite que la somme des
    dégâts : on sous-estime. Le rebond non plus — un tir sous 1 % du bouclier
    de la cible ne fait rien : on surestime, mais sans portée ici, où le plus
    faible des tirs vaut 80 contre des boucliers de 10 à 700.

    Les clés se lisent sur DEF, jamais sur p.defs : une clé venue du stockage
    ne doit pas pouvoir compter. Et p.defs == null veut dire « jamais relevée »,
    jamais zéro — on passe par defsOf lui-même, qui sait aussi lire l'ancienne
    forme où seul p.def existe, et pour la même raison : annoncer
    qu'une défense inconnue tue mille chasseurs ferait brûler une flotte.

    Le +5 % par niveau d'Armes et de Bouclier vient du wiki, pas de la revue. */
function luneDefense(p, k, bouLvl = 0){
  const have = p && defsOf(p);
  if(!have) return null;
  let brut = 0, tirs = 0;
  for(const j of Object.keys(DEF)){
    const n = Math.max(0, have[j] || 0);
    brut += n * DEF[j].a;
    tirs += n;
  }
  const puissance = brut * (1 + .05 * Math.max(0, S.tech.weapons || 0));
  const bou = ((SHIPS[k] || {}).bou || 0) * (1 + .05 * Math.max(0, bouLvl));
  return {puissance, tirs, tue: Math.max(0, 6 * puissance - 6 * tirs * bou)};
}
