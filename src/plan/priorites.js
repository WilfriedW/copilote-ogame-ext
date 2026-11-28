/* ---------- les priorités ----------
   Ce que le joueur a posé comme priorité (`prios`, `priosLf`, `prioOf`), son
   nettoyage et son renvoi vers la page du jeu (`prioClean`, `prioDrain`), le
   niveau visé et ce qui est déjà atteint (`prioLvl`, `prioActuel`,
   `prioPalier`), et la pose depuis le panneau (`prioPose`, `poseK`,
   `poseLignes`, `prioRetire`…), ainsi que les focus du profil (`FOCUS`).

   Module de domaine (issue #49), le premier du plan du jour. Le nom qu'une
   pose donne à un rang (`poseNom`) vit ici ; ce qui nomme et désigne les
   cases vient de `src/formes-de-vie/cases.js`, pas des formes de vie, qui
   importent déjà ce module. Le rendu (`prioHtml`, `prioRangHtml`) reste
   dans app.js. Ce module
   emprunte encore à app.js ce qu'il lit : ce cycle-là est toléré tant
   qu'app.js existe, et rien n'y est lu au chargement. */
import { lfCle, lfIds, LF_ROLE, lfNom, lfIdPour, poseLfCles } from '../formes-de-vie/cases.js';
import { S } from '../core/etat.js';
import { num } from '../core/format.js';
import { B, B_SHORT, T } from '../core/formules.js';
import { planetById } from '../core/planetes.js';
import { IS_EXT } from '../core/serveur.js';
import { labPlanet } from '../economie/centre.js';
import { save } from '../synchro/synchro.js';

/* Une priorité est ce que le joueur pose : un bâtiment ou une recherche, avec
   le niveau qu'il vise. Elle ne se périme pas, elle s'accomplit — dès que le
   niveau est atteint, ou que la planète n'existe plus, elle cesse de compter.
   Aucune écriture ici : prios() se rappelle à chaque rendu, et c'est prioClean()
   qui décide du stockage.
   Une recherche ne se range pas sur une planète, elle part du centre : on lui
   donne le pid de labPlanet() à la lecture et jamais au stockage, sinon un
   centre que le joueur déplace laisserait la priorité visée sur l'ancien. */
/* Un palier en deux temps. Le joueur veut « les deux à 21, et seulement après
   la population à 41 » : une priorité ne portait qu'un niveau, elle en porte
   maintenant deux. Tant que `lvl` n'est pas atteint c'est lui la cible ; une
   fois atteint, `puis` prend le relais. Rien d'autre ne change : tout ce qui
   lit une priorité — le plan, le bloc, le champ d'Empire, la tuile du jeu —
   reçoit la cible du moment et n'a pas à connaître l'étape. */
function prioCible(e, actuel){
  return (Number.isInteger(e.puis) && e.puis > e.lvl && actuel >= e.lvl) ? e.puis : e.lvl;
}
export function prios(){
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const out = [];
  for(const e of (Array.isArray(S.prio) ? S.prio : [])){
    if(!e || !Number.isInteger(e.lvl) || e.lvl <= 0) continue;
    if(e.kind === 'b'){
      const p = own(B, e.k) ? planetById(e.pid) : null;
      if(!p) continue;
      const actuel = p.b[e.k] || 0, cible = prioCible(e, actuel);
      if(cible > actuel) out.push({kind:'b', pid:p.id, k:e.k, lvl:cible});
    }else if(e.kind === 't'){
      const p = own(T, e.k) ? labPlanet() : null;
      if(p && e.lvl > (S.tech[e.k] || 0)) out.push({kind:'t', pid:p.id, k:e.k, lvl:e.lvl});
    }
  }
  return out;
}
/* Les cases de forme de vie ont leur propre lecture, et prios() ne les rend
   jamais : la boucle des objectifs lit T[pr.k].n — T[11101] n'existe pas, elle
   lèverait — et réserve la planète à la première priorité posée, toutes espèces
   confondues : une case de forme de vie volerait son tour à un Labo 10 posé
   après elle, qui attendrait alors un tour qui ne vient jamais.
   Une case absente du relevé compte pour 0 et la priorité reste : le joueur
   pose depuis la page de la forme de vie, et sa demande peut passer avant que
   le relevé suivant n'arrive. L'écarter en silence serait la pire issue. */
export function priosLf(){
  const out = [];
  for(const e of (Array.isArray(S.prio) ? S.prio : [])){
    if(!e || e.kind !== 'lf' || !Number.isInteger(e.lvl) || e.lvl <= 0) continue;
    if(!Number.isInteger(e.k) || e.k < 11000) continue;
    const p = planetById(e.pid);
    if(!p) continue;
    const actuel = ((p.lf || {})[e.k] || {}).lvl || 0, cible = prioCible(e, actuel);
    if(cible > actuel) out.push({pid:p.id, k:e.k, lvl:cible});
  }
  return out;
}
/* La première posée sur la planète est celle qui agit ; les suivantes
   attendent leur tour, dans l'ordre où le joueur les a posées. */
export function prioOf(pid){ return prios().find(x => x.pid === pid) || null; }
/* Ne réécrit que si une entrée tombe : render() passe ici à chaque rendu, et
   une écriture de stockage par rendu serait payée pour rien. */
export function prioClean(){
  /* Sans planète, labPlanet() est null et toute recherche paraît morte : or une
     recherche n'appartient à aucune planète, et un empire vidé (import tronqué)
     ne doit pas emporter ce que le joueur a posé. Pas d'empire, rien à compacter. */
  if(!S.planets.length) return;
  /* Une priorité reçue d'un autre poste désigne sa planète par le gid tant que
     le relevé d'ici ne l'a pas nommée. Elle ne vise aucune planète connue, donc
     prios() ne la rend pas — mais elle n'est pas morte pour autant : la jeter
     ici la renverrait effacée au poste qui l'a posée. */
  const attend = e => e && e.gid != null;
  const vivantes = prios().concat(priosLf().map(x => ({kind:'lf', pid:x.pid, k:x.k, lvl:x.lvl})));
  if(vivantes.length + S.prio.filter(attend).length === S.prio.length) return;
  /* prios() et priosLf() sont deux files : on les remet dans l'ordre de pose
     d'origine, qui seul arbitre la précédence. */
  const clef = x => x.kind + ':' + (x.kind === 't' ? '' : x.pid) + ':' + x.k;
  const vivante = new Set(vivantes.map(clef));
  /* On garde l'entrée telle qu'elle est rangée, et non celle que prios() vient
     de rendre : celle-ci porte la cible du moment, pas le palier, et la
     recopier effacerait le second niveau au premier nettoyage venu. */
  S.prio = S.prio.filter(e => e && (attend(e) || vivante.has(clef(e))));
  save();
}

/* La page du jeu ne peut pas écrire S.prio : elle demande, en ajoutant à une
   liste du stockage, et le panneau — seul écrivain — la vide ici. La liste est
   une file : le panneau peut être fermé pendant que le joueur pose trois
   priorités de suite.
   Une demande dont la planète n'est pas encore relevée (une lune, une colonie
   jamais parcourue) n'est jamais jetée : la rendre, c'est la garder, et la
   garder nommée est ce qui évite de perdre en silence ce que le joueur a
   voulu. Seul le temps l'emporte : au-delà de 24 h, plus rien ne la réclamera.
   Le gid est une valeur de frontière : traduit en id local ici, jamais gardé. */
export const PRIO_ATTENTE = 24*3600*1000;
/* Le niveau 0 est un ordre : « retire cette priorité ». C'est la page, là où le
   joueur a formé son intention (champ vidé, ou niveau saisi au courant ou
   au-dessous), qui l'envoie : le panneau lit une intention, il ne la déduit pas
   d'une comparaison de niveaux. Un retrait reste un retrait à quelque moment
   qu'on l'applique, y compris rejoué après avoir attendu sa planète.
   Un niveau positif qui n'est plus au-dessus du courant est une demande
   satisfaite : le jeu a donné ce qu'elle voulait, on l'abandonne sans rien
   toucher — la lire comme un retrait effacerait ce que le joueur a posé. */
function prioDrain(liste){
  const gardees = new Map();
  for(const d of (Array.isArray(liste) ? liste : [])){
    if(!d || typeof d !== 'object') continue;
    const gid = String(d.gid), tech = String(d.tech), lvl = d.lvl;
    // « __proto__ » & co ne sont pas des suites de chiffres : jamais une clé
    if(!/^\d+$/.test(gid) || !/^\d+$/.test(tech) || !Number.isInteger(lvl) || lvl < 0) continue;
    const id = +tech;
    const pose = (kind, pid, k) => { if(lvl === 0 || lvl > prioActuel(kind, pid, k)) prioPose(kind, pid, k, lvl); };
    if(Object.prototype.hasOwnProperty.call(OG_TECH, id)){ pose('t', null, OG_TECH[id]); continue; }
    const kind = Object.prototype.hasOwnProperty.call(OG_BUILD, id) ? 'b' : id >= 11000 ? 'lf' : null;
    if(!kind) continue; // 33 (Terraformeur) a un niveau dans le jeu, pas dans le moteur
    const p = S.planets.find(x => x.gid != null && String(x.gid) === gid);
    if(p){ pose(kind, p.id, kind === 'b' ? OG_BUILD[id] : id); continue; }
    const at = Number.isFinite(d.at) ? d.at : Date.now();
    if(Date.now() - at > PRIO_ATTENTE) continue;
    // une seule par tuile, la dernière : même règle que pour une demande placée, que prioPose écrase sur place
    const clef = gid + ':' + id;
    gardees.delete(clef);
    gardees.set(clef, {gid, tech: id, nom: typeof d.nom === 'string' ? d.nom.slice(0, 80) : '', lvl, at});
  }
  return [...gardees.values()];
}
/* Les demandes qui attendent leur planète, pour le bloc des priorités. */
export function prioDemandes(){ return Array.isArray(S.prioAsk) ? S.prioAsk : []; }
/* Posées sur l'autre poste, sur une planète que celui-ci n'a pas encore
   relevée : elles désignent leur planète par le gid, donc prios() ne les rend
   pas et le champ d'Empire reste vide. prioClean les garde — les jeter
   renverrait effacé au poste qui les a posées —, mais rien ne les montrait.
   Une priorité qu'on garde sans la dire est une priorité perdue pour le joueur. */
export function prioAttend(){ return (S.prio || []).filter(e => e && e.gid != null && Number.isInteger(e.lvl) && e.lvl > 0); }
/* Ce qui était gardé repasse avec ce qui arrive : une planète peut avoir été
   relevée entre-temps. */
export function prioRecoit(neuves){
  // les gardées d'abord, les fraîches ensuite : sur une même tuile, la dernière demandée l'emporte
  S.prioAsk = prioDrain(prioDemandes().concat(Array.isArray(neuves) ? neuves : []));
}

/* Une entrée se reconnaît à ce qu'elle vise : le bâtiment sur sa planète, ou la
   recherche — qui ne porte pas de pid. */
function prioIdx(kind, pid, k){
  return (S.prio || []).findIndex(e => e && e.kind === kind && e.k === k && (kind === 't' || e.pid === pid));
}
/** Le jeu a-t-il réellement lu les niveaux de cette planète ? Seul `bLu`
    l'atteste, posé par le relevé quand il rend une grille. Partout ailleurs —
    hors extension, planète jamais visitée, planète seulement nommée — le
    joueur doit pouvoir taper ses niveaux. Là où le jeu les lit, les taper ne
    servirait à rien : le prochain relevé les réécrit. */
export function lvLu(p){ return IS_EXT && !!p.bLu; }

/** Combien de priorités le joueur a posées sur cette planète, bâtiments et
    formes de vie confondus : une case de forme de vie est une priorité comme
    une autre. Les recherches en sont exclues — `prios()` les range sous la
    planète du labo, mais elles se visent dans la carte des recherches. */
export function prioCount(pid){
  return prios().filter(x => x.kind === 'b' && x.pid === pid).length
       + priosLf().filter(x => x.pid === pid).length;
}

export function prioLvl(kind, pid, k){
  const e = (kind === 'lf' ? priosLf().map(x => ({kind:'lf', pid:x.pid, k:x.k, lvl:x.lvl})) : prios()).find(x => x.kind === kind && x.k === k && (kind === 't' || x.pid === pid));
  /* `lvl` vient de `S.prio`, donc d'une sauvegarde : un nombre, ou la case vide. */
  return e && Number.isFinite(Number(e.lvl)) ? Number(e.lvl) : '';
}
/* Le joueur écrit un niveau visé. L'ordre de pose arbitre la précédence : une
   correction met donc l'entrée à jour sur place, et seule une priorité neuve
   prend la fin de la liste. Un champ vidé, ou un niveau déjà atteint, retire :
   « viser » ce qu'on a ne demande rien au plan. */
function prioActuel(kind, pid, k){
  return kind === 't' ? (S.tech[k] || 0)
    : kind === 'lf' ? (((planetById(pid) || {lf:{}}).lf || {})[k] || {}).lvl || 0
    : ((planetById(pid) || {b:{}}).b[k] || 0);
}
export function prioPose(kind, pid, k, raw){
  /* Une tuile se lit d'un attribut du DOM, donc en chaîne : stockée telle quelle,
     priosLf() — qui exige un entier — ne la retrouverait jamais et la priorité
     s'évanouirait sans un mot. On convertit ici, une fois, pour tous les appelants. */
  /* Le motif et non Number() seul : '', null et [] valent 0, et '0x2B4D' vaut
     11085 — une tuile crédible mais fausse, que le plan servirait. Même borne que
     priosLf() : on ne range que ce que l'accesseur saura relire. */
  if(kind === 'lf'){ if(!/^\d+$/.test(String(k)) || +k < 11000) return; k = +k; }
  const lvl = parseInt(raw), i = prioIdx(kind, pid, k);
  const actuel = prioActuel(kind, pid, k);
  if(!(lvl > actuel)){ if(i >= 0) S.prio.splice(i, 1); return; }
  /* Le joueur corrige le champ : il reprend la barre, et le second palier
     n'a plus lieu d'être. Le laisser ferait repartir la case toute seule vers
     un niveau qu'il vient justement de refuser. */
  if(i >= 0){ S.prio[i].lvl = lvl; delete S.prio[i].puis; }
  else S.prio.push(kind === 't' ? {kind, k, lvl} : {kind, pid, k, lvl});
}
/* Un palier se pose par le même chemin que tout le reste, puis reçoit son
   second niveau. Si le premier est déjà atteint, le second est la seule cible
   qui reste : prioPose refuserait le premier sans rien dire. */
export function prioPalier(kind, pid, k, lvl, puis){
  const actuel = prioActuel(kind, pid, k);
  if(actuel >= lvl){ if(Number.isInteger(puis)) prioPose(kind, pid, k, puis); return; }
  prioPose(kind, pid, k, lvl);
  const i = prioIdx(kind, pid, k);
  if(i >= 0 && Number.isInteger(puis) && puis > lvl) S.prio[i].puis = puis;
}
/* Le joueur veut « mine de métal 43 » sur tout l'empire, sauf sur la planète
   qui ne sert qu'à la logistique. Poser la même priorité dix fois, une tuile
   après l'autre, est le geste que cette carte remplace — elle n'invente rien,
   elle appelle prioPose autant de fois qu'il y a de planètes cochées.
   Les décochées se rangent par bâtiment, et non en une seule liste de
   planètes : décocher la logistique pour la mine ne doit pas la décocher pour
   le labo, qu'on veut peut-être partout. */
/** L'état de la carte, rendu sûr à chaque accès. `appliqueSauvegarde` remplace
    S.ui en entier par celui du fichier : une sauvegarde d'avant cette carte
    n'a pas de `pose`, et la fusion par clé du chargement ne repasse jamais.
    Tout passe donc par ici, lectures comprises — sans quoi la carte se dessine
    et ne retient plus rien, sans un mot. */
function poseEtat(){
  const u = S.ui.pose || (S.ui.pose = {k:'metal', lvl:'', hors:{}});
  if(!u.hors || typeof u.hors !== 'object') u.hors = {};
  return u;
}
export function poseK(){
  const k = poseEtat().k;
  /* hasOwnProperty et non `in` : « __proto__ » appartient à tout objet, et une
     sauvegarde abîmée ferait lire p.b['__proto__'] — jamais un niveau. */
  if(Object.prototype.hasOwnProperty.call(B, k)) return k;
  /* Une case de forme de vie se désigne par son rang, et seulement si l'empire
     l'a relevé : un rang inventé viserait une case qui n'existe nulle part, et
     la carte poserait dans le vide. La comparaison se fait sur une liste
     construite du relevé, jamais sur un objet — « __proto__ » appartient à
     tout objet et passerait un `in`. */
  return poseLfCles().includes(k) ? k : 'metal';
}
/* Ce que la liste écrit sur un rang : les noms que le relevé lui connaît, une
   fois chacun — « Secteur résidentiel / Enclave de méditation » pour un empire
   à deux espèces. Pas de nom de rôle à la place : au-delà du logement et de la
   nourriture, documentés chez les quatre espèces, le jeu ne donne pas le même
   rôle au même rang, et un intitulé inventé ferait croire le contraire. */
export function poseNom(k){
  if(poseKind(k) === 'b') return B[k].n;
  const noms = new Set();
  for(const p of S.planets) for(const id of lfIds(p)) if(lfCle(id) === k) noms.add(lfNom(p, id));
  const vus = [...noms].join(' / ') || k;
  /* Les trois rôles communs devant les noms, quand le rang en a un. Les
     recherches n'en ont pas : leur rang 1 est « Ambassadeurs intergalactiques »,
     pas l'hébergement. */
  const role = k.startsWith('lfbuilding:') ? LF_ROLE[+k.split(':')[1]] : null;
  return role ? `${role} — ${vus}` : vus;
}
/* Le genre de la case en cours : 'lf' pour un rang de forme de vie, 'b' sinon. */
export function poseKind(k){ return /^lf(building|research):\d+$/.test(k) ? 'lf' : 'b'; }
/* Le niveau que le joueur vise, ou NaN tant qu'il n'a rien tapé. */
export function poseVise(){ return parseInt(poseEtat().lvl); }
/* Les planètes décochées pour ce bâtiment. Array.isArray et non `|| []` : une
   sauvegarde retouchée à la main peut mettre n'importe quoi là, et un
   `.includes` qui lève fige l'onglet Empire entier au prochain rendu. */
function poseHors(k){ const h = poseEtat().hors[k]; return Array.isArray(h) ? h : []; }
/** Ce que la pose ferait, planète par planète, dans l'ordre de l'empire.
    `agit` est la seule chose que posePartout et le bouton regardent. Trois
    raisons de ne pas agir, et la carte les montre toutes les trois : la
    planète est décochée ; son niveau est déjà là ; elle vise déjà aussi haut
    ou plus haut. Ce dernier cas est le plus important — poser 43 sur une
    planète qui visait 50 abaisserait ce que le joueur a posé à la main, et
    rien ici ne se défait. */
export function poseLignes(){
  const k = poseK(), kind = poseKind(k), hors = poseHors(k), vise = poseVise();
  return S.planets.map(p => {
    /* Le rang se résout ici, et c'est tout le mécanisme : chaque planète
       reçoit la case de son espèce à elle. Une planète dont l'espèce n'ouvre
       pas ce rang, ou qui n'a rien relevé, n'en a aucune — et ne reçoit rien
       plutôt qu'une priorité qui ne correspond à rien chez elle. */
    const id = kind === 'b' ? k : lfIdPour(p, k), ici = id != null;
    /* num() et non `|| 0` : un niveau venu d'une sauvegarde abîmée est une
       chaîne, et la carte l'interpole sans esc comme tout niveau du panneau. */
    const actuel = ici ? num(prioActuel(kind, p.id, id)) : 0, coche = !hors.includes(p.id);
    const brut = ici ? prioLvl(kind, p.id, id) : '', deja = brut === '' ? null : brut;
    /* Le nom que cette planète-là donne à sa case : sur un empire à deux
       espèces, la ligne doit dire ce qu'elle va recevoir, pas l'intitulé du
       rang. */
    const quoi = !ici ? '' : kind === 'b' ? B_SHORT[k] : lfNom(p, id);
    return {pid: p.id, name: p.name, coords: p.coords, id, quoi, actuel, deja, coche, ici,
            agit: ici && coche && vise > actuel && !(deja != null && deja >= vise),
            /* Ce que le retrait emporterait. Il ne regarde pas le niveau visé :
               on défait une pose, on ne la compare pas. */
            retire: ici && coche && deja != null};
  });
}
/** Pose le niveau visé sur les planètes cochées, et rend combien en ont reçu.
    Seules les lignes qui agissent passent par prioPose : pour lui, un niveau
    qui n'est pas au-dessus de l'actuel est un retrait. Lui donner les autres —
    une planète déjà arrivée, ou le champ laissé vide — effacerait d'un clic
    tout ce que le joueur a posé tuile par tuile. */
export function posePartout(){
  const k = poseK(), kind = poseKind(k), lvl = poseVise(), agissent = poseLignes().filter(x => x.agit);
  for(const x of agissent) prioPose(kind, x.pid, x.id, lvl);
  return agissent.length;
}
/** Défaire. La carte posait sur huit planètes d'un clic et demandait huit
    clics droits dans le jeu pour revenir en arrière : un essai — « je mets 10
    pour voir » — coûtait une tournée complète.
    C'est un geste à part, nommé, et non un niveau plus bas qu'on taperait :
    poser n'abaisse jamais, sans quoi un objectif tapé de travers effacerait en
    silence ce que le joueur a réglé tuile par tuile. Ici il demande le
    retrait, il voit sur combien de planètes, et chaque ligne nomme déjà ce
    qu'elle vise. Rendu : combien de priorités sont parties. */
export function poseRetireTout(){
  const k = poseK(), kind = poseKind(k), cibles = poseLignes().filter(x => x.retire);
  for(const x of cibles){ const i = prioIdx(kind, x.pid, x.id); if(i >= 0) S.prio.splice(i, 1); }
  return cibles.length;
}
/** Pourquoi le bouton est à zéro, quand il l'est. Sans cette phrase, le joueur
    voit une planète au niveau 12 sous un objectif de 21 et un bouton éteint :
    il en conclut que la carte est cassée, alors qu'elle a déjà fait le travail
    — cette planète-là vise déjà 21, et les sept autres sont plus haut. Rien
    d'autre à l'écran ne porte ce compte : chaque ligne dit son propre cas, et
    il faut les relire une à une pour s'en convaincre.
    Une raison par planète, et la première qui s'applique : décochée l'emporte
    sur tout le reste — c'est un choix du joueur, pas un état du jeu. */
export function poseRien(){
  const l = poseLignes(), vise = poseVise();
  /* Avant qu'un objectif soit tapé, il n'y a rien à justifier : la carte est
     seulement au repos. */
  if(!(vise > 0) || l.some(x => x.agit)) return '';
  const n = f => l.filter(f).length;
  const hors = n(x => !x.coche), absent = n(x => x.coche && !x.ici);
  const haut = n(x => x.coche && x.ici && x.actuel >= vise);
  const deja = n(x => x.coche && x.ici && x.actuel < vise && x.deja != null && x.deja >= vise);
  const bouts = [];
  /* « 3 visent déjà 1 » était faux quand elles visent 10 : l'objectif tapé
     n'est pas celui qu'elles portent, il est seulement plus bas. */
  if(haut) bouts.push(`${haut} planète${haut>1?'s':''} déjà à ce niveau ou plus haut`);
  if(deja) bouts.push(`${deja} vise${deja>1?'nt':''} déjà aussi haut`);
  if(hors) bouts.push(`${hors} décochée${hors>1?'s':''}`);
  if(absent) bouts.push(`${absent} sans cette case`);
  return bouts.length ? `Rien à poser : ${bouts.join(', ')}.` : '';
}
/* Cocher et décocher, hors du gestionnaire : la carte est le seul écrivain de
   sa propre mémoire, et c'est ici qu'un test peut la prendre. */
export function poseCoche(pid, coche){
  const k = poseK(), sans = new Set(poseHors(k));
  coche ? sans.delete(pid) : sans.add(pid);
  poseEtat().hors[k] = [...sans];
}
/* Le bâtiment choisi, ou le niveau tapé. Un niveau qui n'est pas un entier
   positif vide le champ plutôt que d'y laisser un 0 : zéro est un retrait pour
   prioPose, et la carte ne retire jamais rien. */
export function poseChamp(quoi, valeur){
  const u = poseEtat(), n = parseInt(valeur);
  if(quoi === 'lvl') u.lvl = n > 0 ? n : '';
  else u.k = valeur;
}
/** Le rang d'une priorité dans la file de sa planète — « rang 2 sur 3 » —, et
    rien quand elle y est seule : un « rang 1 sur 1 » sur chaque ligne ne dirait
    que ce que l'absence des autres dit déjà.
    « Elle attend son tour, derrière Mine de métal 43 » ne nomme que celle qui
    agit : à trois, le joueur ne savait pas s'il était deuxième ou dernier.
    Deux files par planète, jamais une seule. Les bâtiments et les recherches
    partagent la leur — une recherche se range sur le centre et y prend le tour
    —, les cases de forme de vie ont la leur, qui ne gèle pas la planète. */
export function prioOrdre(kind, pid, k){
  const file = (kind === 'lf' ? priosLf() : prios()).filter(x => x.pid === pid);
  if(file.length < 2) return null;
  const i = file.findIndex(x => x.k === k);
  return i < 0 ? null : {i, n: file.length};
}
/** Faire passer une priorité devant les autres de sa planète.
    L'ordre de pose arbitre tout — le tour, les rapatriements — et ne se
    corrigeait que par un retrait suivi d'une nouvelle pose, qui perdait le
    second palier au passage et renvoyait la priorité en fin de file de toute
    façon. Ici l'entrée se déplace, entière.
    Devant sa propre file seulement : un bâtiment et une case de forme de vie
    ne se disputent pas le tour, et passer devant l'autre ne voudrait rien
    dire. Une recherche appartient à la file du centre, comme pour le tour. */
export function prioDevant(ref){
  /* Même prudence que prioRetire : une référence mal encodée lève URIError, et
     ce qui lève dans le gestionnaire de clic le tue sans un mot. */
  let kind, a, b;
  try{ [kind, a, b] = String(ref).split('|').map(decodeURIComponent); }catch(e){ return; }
  const i = kind === 't' ? prioIdx('t', null, a) : kind === 'lf' ? prioIdx('lf', a, +b) : kind === 'b' ? prioIdx('b', a, b) : -1;
  if(i < 0) return;
  const centre = (labPlanet() || {}).id;
  const file = x => (x.kind === 'lf' ? 'lf' : 'plan') + ':' + (x.kind === 't' ? centre : x.pid);
  const mienne = file(S.prio[i]);
  const j = S.prio.findIndex(x => x && file(x) === mienne);
  if(j < 0 || j >= i) return;
  S.prio.splice(j, 0, S.prio.splice(i, 1)[0]);
}
/* Ce qu'une ligne du bloc ajoute quand un second palier attend derrière. */
export function prioSuite(kind, pid, k, lvl){
  const e = (S.prio || []).find(x => x && x.kind === kind && x.k === k && (kind === 't' || x.pid === pid));
  return e && Number.isInteger(e.puis) && e.puis > lvl ? `, puis ${e.puis}` : '';
}
/* Chaque ligne du bloc porte sa propre référence — espèce et identité —, jamais
   un rang : le bloc mêle trois listes (prios, priosLf, demandes gardées), et un
   rang de l'une désignerait n'importe quoi dans l'autre. Les morceaux passent
   par encodeURIComponent : la référence voyage dans un attribut HTML, et un
   identifiant venu du jeu ne doit pas pouvoir y casser un guillemet. */
export const prioRef = (...parts) => parts.map(x => encodeURIComponent(String(x == null ? '' : x))).join('|');
export function prioRetire(ref){
  /* Une référence mal encodée lève URIError, et ce qui lève dans le gestionnaire
     de clic le tue sans un mot : ni save() ni render(). On ne retire rien. */
  let kind, a, b;
  try{ [kind, a, b] = String(ref).split('|').map(decodeURIComponent); }catch(e){ return; }
  if(kind === 'ask'){
    const i = prioDemandes().findIndex(d => String(d.gid) === a && String(d.tech) === b);
    if(i >= 0) S.prioAsk.splice(i, 1);
    return;
  }
  if(kind === 'gid'){
    const i = (S.prio || []).findIndex(e => e && e.gid != null && String(e.gid) === a && String(e.k) === b);
    if(i >= 0) S.prio.splice(i, 1);
    return;
  }
  const i = kind === 't' ? prioIdx('t', null, a) : kind === 'lf' ? prioIdx('lf', a, +b) : kind === 'b' ? prioIdx('b', a, b) : -1;
  if(i >= 0) S.prio.splice(i, 1);
}

export const FOCUS = {equi:'Équilibré', ecocol:'Économie + colonie', eco:'Économie pure', fleet:'Flotte et expéditions', raid:'Pillage d\'inactifs'};
/* Place de la recherche dans la journée. Par défaut elle prend son tour : elle
   ne met de côté que ce que la feuille de route juge critique, ou ce qu'elle
   attend depuis trop longtemps. « Avant les bâtiments » rend critique la tête
   de liste — elle passe devant les chantiers et pose aussitôt sa réserve, donc
   les bâtiments de la planète du labo s'effacent et les colonies rapatrient
   vers elle. */
/* Les deux plans où une expédition ou un pillage de plus compte autant qu'un
   niveau de mine : leurs plafonds — expéditions simultanées, emplacements de
   flotte — doublent la feuille de route au lieu d'attendre leur tour. */
export const FOCUS_FLOTTE = {fleet:1, equi:1, raid:1};
