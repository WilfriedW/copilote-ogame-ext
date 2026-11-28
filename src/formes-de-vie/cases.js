/* ---------- les cases de forme de vie ----------
   Ce qui désigne une case et la nomme (`lfIds`, `lfCle`, `lfIdPour`,
   `lfNom`, `lfNomConnu`, `LF_NAMES`, `LF_ROLE`), et les rangs que l'empire a
   relevés (`poseLfCles`).

   Module de domaine (issue #49). Il est sous les formes de vie et sous les
   priorités, qui en ont besoin toutes les deux : les priorités ne peuvent pas
   importer les formes de vie, qui les importent déjà. Il n'emprunte rien à
   app.js. */
import { S } from '../core/etat.js';
import { REGLES, aSoi } from '../regles/moteur.js';

/* Noms relevés sur le jeu ; le panneau de détail en apporte d'autres au fil
   des visites, et ceux-là priment puisqu'ils viennent de la partie en cours. */
/* Les noms par défaut viennent de rules.json, toutes races confondues : un nom
   lu dans le jeu les remplace (lfNom), et le fichier corrige ce qui a changé
   sans toucher au code. */
export const LF_NAMES = Object.assign({}, ...Object.values(REGLES.lifeforms || {})
  .flatMap(r => [r && r.buildings, r && r.research]).filter(x => x && typeof x === 'object'));

/** Le nom d'une case quand quelqu'un le connaît : le jeu, puis le cache, puis le fichier. */
export function lfNomConnu(p, id){
  const v = ((p || {}).lf || {})[id] || {};
  return v.nom || v.name || (aSoi(S.lfNoms, id) ? S.lfNoms[id] : null) || LF_NAMES[id] || null;
}
/* Le nom d'une case. Celui du relevé d'abord : il vient de la partie en cours,
   et le jeu peut le traduire autrement que notre table. */
export function lfNom(p, id){
  return lfNomConnu(p, id) || ('Forme de vie ' + id);
}
/* La case de cette planète à ce rang, ou rien : l'espèce diffère d'une planète
   à l'autre, et le jeu n'ouvre pas tous les rangs d'un coup. */
export function lfIdPour(p, cle){ return lfIds(p).find(id => lfCle(id) === cle); }
/* Les rangs que l'empire a relevés, les bâtiments avant les recherches —
   'lfbuilding' passe avant 'lfresearch' dans l'ordre des lettres. */
export function poseLfCles(){
  return [...new Set(S.planets.flatMap(p => lfIds(p).map(lfCle)))]
    .sort((a, b) => a.split(':')[0].localeCompare(b.split(':')[0]) || +a.split(':')[1] - +b.split(':')[1]);
}
/* Une case de forme de vie se désigne par son rang dans sa file, et non par
   son identifiant : le jeu range les cases dans le même ordre chez chaque
   espèce, et c'est ce rang qui se pose sur tout l'empire — chaque planète
   recevant la case de son espèce à elle. Sans cela, un empire à deux espèces
   donnait deux entrées pour la même ligne de la liste, et il fallait poser
   deux fois.
   Le rang seul ne suffit pas : chaque espèce occupe deux séries, les bâtiments
   puis les recherches, et le rang 1 existe dans les deux. La file entre donc
   dans la clé. */
export const lfCle = id => lfQueue(id) + ':' + (+id % 100);
/** Les identifiants de case de forme de vie relevés sur une planète. Pas de
    tri : une clé entière s'énumère déjà en ordre croissant, et c'est l'ordre
    du jeu — les trier à nouveau serait une ligne qui ne fait rien. */
export function lfIds(p){
  return Object.keys((p || {}).lf || {}).map(Number).filter(id=>Number.isInteger(id) && id >= 11000);
}
/* Les cinq premiers rangs ont le même rôle chez les quatre espèces. Les
   suivants, non — et ça se vérifie, ça ne se suppose pas.

   Deux sources, apportées par le joueur le 26/11/2026. Le guide d'Always For
   Keyboard (27/02/2024) nomme les trois premiers rôles et donne les quatre
   noms de chacun :
     Hébergement  — Secteur résidentiel (Humains) / Enclave stoïque (Roctas) /
                    Refugium (Kaeleshs) / Chaîne de production (Mécas)
     Nourriture   — Ferme biosphérique / Culture du cristal /
                    Condensateur d'antimatière / Usine de fusion de cellules
     Technologies — Centre de recherche / Centre technologique runique /
                    Salle à vortex / Centre de recherche en robotique
   La page officielle de Gameforge (gameforge.com/fr-FR/games/ogame-formes-vie)
   donne les douze bâtiments des Mécas et des Kaeleshs dans l'ordre, chacun
   avec ce qu'il fait. Alignés rang par rang, les rangs 4 et 5 disent la même
   chose des deux : « entraîne les T1 en T2 », puis « entraîne les T2 en T3 »
   (Update Network / Halls of Realisation, puis Quantum Computer Centre /
   Forum of Transcendence). Chez les Humains ce sont l'Académie des sciences
   et le Centre de neurocalibrage, aux mêmes rangs.

   À partir du rang 6, les deux listes divergent : le rang 6 réduit le temps de
   construction des navires chez les Mécas et la consommation de nourriture
   chez les Kaeleshs ; le rang 9 augmente la population chez les premiers et le
   nombre de cases de la planète chez les seconds. Il n'y a donc pas de rôle
   commun à nommer au-delà de 5, et ces rangs gardent les noms que le relevé
   leur connaît — ne pas « compléter » cette table de mémoire.

   Le rang ne se devine pas plus que les rôles : il se lit du nom humain dans
   OG_LF_BUILD, que le relevé a posé — « Secteur résidentiel » y est 11101,
   donc le rang 1. */
export const LF_ROLE = {1:'Hébergement', 2:'Nourriture', 3:'Technologies',
                 4:'Population T1 → T2', 5:'Population T2 → T3'};
