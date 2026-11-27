var OG_BUILD = {1:'metal', 2:'crystal', 3:'deut', 4:'solar', 12:'fusion', 14:'robot', 15:'nanite', 21:'shipyard', 22:'smetal', 23:'scrystal', 24:'sdeut', 31:'lab', 33:'terra', 34:'depot', 36:'dock', 44:'silo'};

var OG_TECH = {106:'espionage', 108:'computer', 109:'weapons', 110:'shielding', 111:'armour', 113:'energy', 114:'hyper', 115:'combustion', 117:'impulse', 118:'hyperdrive', 120:'laser', 121:'ion', 122:'plasma', 123:'irn', 124:'astro'};

/* Formes de vie : chaque race occupe deux séries, ses douze bâtiments puis ses
   dix-huit recherches. Le chiffre des milliers est la race — 111xx/112xx les
   Humains, 121xx/122xx les Rock'tal, 131xx/132xx les Mécas, 141xx/142xx les
   Kaelesh (validé le 26 novembre 2026). Les noms par défaut vivent dans
   rules.json ; ceux que le jeu affiche les remplacent dès qu'une page les
   montre. */

/**
 * Délai avant d'avoir réuni ce qui manque, au débit horaire donné.
 * @param {number} manque quantité manquante
 * @param {number} parHeure production horaire
 * @returns {number} secondes, 0 si rien ne manque, Infinity si la production
 *   n'y arrivera pas
 */
function etaSecs(manque, parHeure){
  if(!(manque > 0)) return 0;
  return parHeure > 0 ? manque / parHeure * 3600 : Infinity;
}
/**
 * Délai lisible : « 2h 14m », « 7m », ou l'aveu que ça n'arrivera pas.
 * @param {number} secs secondes
 * @returns {string}
 */
function hms(secs){
  if(!isFinite(secs)) return 'jamais à ce rythme';
  // Arrondi vers le haut : mieux vaut que le bouton soit cliquable avant
  // l'heure annoncée que l'inverse.
  const h = Math.floor(secs / 3600), m = Math.ceil((secs % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${Math.max(1, m)}m`;
}

/**
 * File de jeu d'une case de forme de vie, d'après son identifiant.
 * Chaque race occupe deux séries consécutives : bâtiments puis recherches,
 * donc la centaine impaire construit et la paire cherche (111xx/112xx pour
 * les Humains, 121xx/122xx pour les Rock'tal).
 * @param {number|string} id identifiant de la case
 * @returns {string} lfbuilding | lfresearch
 */
function lfQueue(id){ return Math.floor(+id / 100) % 2 ? 'lfbuilding' : 'lfresearch'; }

/**
 * Durée ISO-8601 affichée par le jeu (« PT30M34S »), en secondes.
 * @param {string|null} iso attribut datetime
 * @returns {number} secondes, 0 si rien n'est affiché
 */
function lfSecs(iso){
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso || ''));
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}
/**
 * Rang de la ressource d'une ligne de coût, d'après ses classes.
 * @param {string} cls attribut class de la ligne
 * @returns {number} 0 métal, 1 cristal, 2 deutérium, -1 autre chose
 */
function lfRes(cls){
  const c = String(cls || '');
  return /\bmetal\b/.test(c) ? 0 : /\bcrystal\b/.test(c) ? 1 : /deuter/.test(c) ? 2 : -1;
}
/**
 * Les emplacements d'une planète, lus dans l'infobulle de sa vignette : sous le
 * nom et les coordonnées, le jeu y écrit « 12.800km (150/163) ». Rien d'autre
 * ne les publie — ni la page Ressources, ni les métadonnées de la page. Les
 * coordonnées ne peuvent pas s'y glisser : elles se séparent par des
 * deux-points.
 * Le bon sens des chiffres se juge ailleurs, dans le panneau, avec le reste de
 * ce que le jeu publie.
 * @param {string} tip texte de l'infobulle, balises retirées
 * @returns {{pris:number, max:number}|null} null si l'infobulle ne le dit pas
 */
function casesTuile(tip){
  const m = /\((\d+)\/(\d+)\)/.exec(String(tip || ''));
  return m ? { pris: +m[1], max: +m[2] } : null;
}
/**
 * L'état d'une case de forme de vie, lu dans l'infobulle de sa tuile. Le jeu y
 * écrit le nom sur la première ligne et la raison du refus sur la suivante
 * (« Académie des sciences », puis « La population est trop faible. ») : seule
 * la raison est examinée, sinon un nom qui contiendrait le mot suffirait à
 * classer la case.
 * Trois refus, et le plan ne les traite pas pareil : « pas assez de ressources »
 * est une attente qu'il sait combler en épargnant, un prérequis manquant et une
 * population trop faible sont des murs. Les confondre coûtait une carte par
 * jour sur une case que le jeu refuse — le plan ne modélise ni la population ni
 * la nourriture, il ne saura jamais de lui-même quand le mur tombe.
 * ponytail: reconnu en français seulement, comme lfEffect ; une autre langue
 * rend « ok », donc le comportement d'avant.
 * @param {string} tip attribut data-tooltip-title de la tuile
 * @returns {string} ok | short | locked | pop
 */
function lfState(tip){
  const raison = String(tip || '').split(/<br\s*\/?>|\n/i).slice(1).join(' ');
  return /population/i.test(raison) ? 'pop'
    : /pas assez/i.test(raison) ? 'short'
    : /pr[ée]requis/i.test(raison) ? 'locked' : 'ok';
}
/**
 * La ressource dont une case de forme de vie augmente la production, lue dans
 * la phrase d'effet du panneau de détail du jeu. Rien d'autre ne le dit : la
 * liste n'affiche qu'une vignette, un nom et un niveau, et le classement se
 * faisait donc au prix seul — une case qui produit passait derrière n'importe
 * quelle case militaire moins chère.
 * ponytail: on ne retient que la ressource, pas le pourcentage, que le jeu
 * n'affiche pas tant que le niveau n'est pas atteint ; et la phrase n'est
 * reconnue qu'en français, comme tout le reste du panneau.
 * @param {string} text texte du panneau de détail
 * @returns {number|null} 0 métal, 1 cristal, 2 deutérium, null si rien de lisible
 */
function lfEffect(text) {
  const t = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const m = t.match(/augmente la production (?:de |d')?(metal|cristal|deuterium)/);
  return m ? ['metal', 'cristal', 'deuterium'].indexOf(m[1]) : null;
}

var OG_SHIPS = {202:'sc', 203:'lc', 204:'lf', 205:'hf', 206:'cr', 207:'bs', 208:'col', 209:'rec', 210:'pr', 211:'bb', 213:'ds', 215:'bc', 218:'rp', 219:'pf'};

/* Défense, relevée sur le jeu : la page Défense balise ses cases comme le
   chantier, et l'ordre des identifiants suit celui des colonnes. Le total ne
   suffit pas : un tas d'un seul type est gratuit à percer — le croiseur a un
   tir rapide de 10 sur le lanceur de missiles, le destructeur de 10 sur le
   laser léger, et aucun des deux sur l'autre. Savoir lequel manque demande de
   les compter séparément. Les missiles (502, 503) ont besoin d'un silo que le
   copilote ne lit pas : ils restent dehors. */
var OG_DEF = {401:'rl', 402:'ll', 403:'hl', 404:'gc', 405:'ic', 406:'pt', 407:'sd', 408:'ld'};

var OG_MISSIONS = {1:'attaque', 2:'attaque groupée', 3:'transport', 4:'stationnement', 5:'stationnement allié', 6:'espionnage', 7:'colonisation', 8:'recyclage', 9:'destruction de lune', 15:'expédition', 18:'exploration'};

var OG_CLASS = {0:'none', 1:'collector', 2:'general', 3:'explorer'};

var OG_NAMES = {
  1:'Mine de métal', 2:'Mine de cristal', 3:'Synthétiseur de deutérium', 4:'Centrale électrique solaire', 12:'Centrale électrique de fusion',
  14:'Usine de robots', 15:'Usine de nanites', 21:'Chantier spatial', 22:'Hangar de métal', 23:'Hangar de cristal', 24:'Réservoir de deutérium',
  31:'Laboratoire de recherche', 33:'Terraformeur', 34:'Dépôt de ravitaillement', 36:'Dock spatial', 44:'Silo de missiles',
  106:'Technologie Espionnage', 108:'Technologie Ordinateur', 109:'Technologie Armes', 110:'Technologie Bouclier', 111:'Protection des vaisseaux',
  113:'Technologie Énergie', 114:'Technologie Hyperespace', 115:'Réacteur à combustion', 117:'Réacteur à impulsion', 118:'Propulsion hyperespace',
  120:'Technologie Laser', 121:'Technologie Ions', 122:'Technologie Plasma', 123:'Réseau de recherche intergalactique', 124:'Astrophysique', 199:'Technologie Graviton',
  212:'Satellite solaire', 217:'Foreuse'
};

/* Les noms de vaisseaux tels que le client français les écrit dans le détail
   d'une flotte, ramenés à leur clé. Le détail ne porte aucun identifiant :
   c'est le nom ou rien. Clés normalisées par `ogNorm` — sans accents, sans
   ponctuation — pour qu'une apostrophe typographique ou une majuscule ne
   fassent pas perdre un vaisseau. */
var OG_SHIP_NOMS = {
  'petit transporteur':'sc', 'grand transporteur':'lc', 'chasseur leger':'lf', 'chasseur lourd':'hf',
  'croiseur':'cr', 'vaisseau de bataille':'bs', 'vaisseau de colonisation':'col', 'recycleur':'rec',
  'sonde d espionnage':'pr', 'sonde despionnage':'pr', 'bombardier':'bb', 'destructeur':'ds',
  'etoile de la mort':'rip', 'traqueur':'bc', 'faucheur':'rp', 'eclaireur':'pf',
  'satellite solaire':'sat', 'foreuse':'crawl'
};
function ogNorm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

/**
 * Le détail d'une flotte, tel que le jeu l'écrit dans l'infobulle d'un
 * mouvement (encart des événements) ou dans le tableau `fleetinfo` de la page
 * Mouvements de flotte : une rangée par vaisseau sous « Vaisseaux », une par
 * ressource sous « Chargement ».
 *
 * Lu comme du texte, sans DOM : la chaîne vient de la page, on n'en construit
 * aucun élément, on n'en retient que des noms connus et des nombres.
 * Un nombre que le jeu masque (« ? » quand l'espionnage est trop faible) ne
 * devient pas zéro : la clé reste absente, et `connu` le dit.
 * @param {string} html le détail, entités déjà décodées ou non
 * @returns {{ships:Object<string,number>, cargo:number[]|null, connu:boolean}}
 */
function ogFleetDetail(html){
  const txt = String(html || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const ships = {}, cargo = [0, 0, 0];
  let section = '', vuCargo = false, connu = true;
  const nombre = v => { const s = String(v).replace(/<[^>]*>/g, '').trim(); if (!/\d/.test(s) || /\?/.test(s)) return null; const n = +s.replace(/[^\d]/g, ''); return Number.isFinite(n) ? n : null; };
  for (const m of txt.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = m[1];
    const th = row.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    if (th) { const t = ogNorm(th[1].replace(/<[^>]*>/g, ' ')); section = /vaisseau|flotte/.test(t) ? 'ships' : /chargement|cargaison|ressource/.test(t) ? 'cargo' : ''; continue; }
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1]);
    if (cells.length < 2) continue;
    const nom = ogNorm(cells[0].replace(/<[^>]*>/g, ' ')), n = nombre(cells[cells.length - 1]);
    if (section === 'cargo' || /^(metal|cristal|deuterium)$/.test(nom)) {
      const j = ['metal', 'cristal', 'deuterium'].indexOf(nom);
      if (j < 0) continue;
      vuCargo = true;
      if (n == null) connu = false; else cargo[j] = n;
    } else {
      const k = OG_SHIP_NOMS[nom];
      if (!k) continue;
      if (n == null) connu = false; else ships[k] = (ships[k] || 0) + n;
    }
  }
  return { ships, cargo: vuCargo ? cargo : null, connu };
}
