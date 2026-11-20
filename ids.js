var OG_BUILD = {1:'metal', 2:'crystal', 3:'deut', 4:'solar', 12:'fusion', 14:'robot', 15:'nanite', 21:'shipyard', 22:'smetal', 23:'scrystal', 24:'sdeut', 31:'lab', 34:'depot', 44:'silo'};

var OG_TECH = {106:'espionage', 108:'computer', 109:'weapons', 110:'shielding', 111:'armour', 113:'energy', 114:'hyper', 115:'combustion', 117:'impulse', 118:'hyperdrive', 120:'laser', 121:'ion', 122:'plasma', 123:'irn', 124:'astro'};

/* Formes de vie, relevé sur le jeu : chaque race occupe deux séries, les
   bâtiments puis les recherches. Les Humains ont 111xx et 112xx. Les séries
   des autres races restent à relever plutôt qu'à déduire — un identifiant
   inventé pointerait sur la mauvaise technologie sans rien signaler. */
var OG_LF_BUILD = {
  11101:'Secteur résidentiel', 11102:'Ferme biosphérique', 11103:'Centre de recherche',
  11104:'Académie des sciences', 11105:'Centre de neurocalibrage', 11106:'Fusion à haute énergie',
  11107:'Réserve alimentaire', 11108:'Extraction par fusion', 11109:'Tour d\'habitation',
  11110:'Laboratoire de biotechnologie', 11111:'Métropolis', 11112:'Bouclier planétaire'
};

/* Recherches des Humains. Le jeu n'affiche que les slots ouverts : cette
   liste s'arrête là où le relevé s'arrêtait, elle n'est pas complète. */
var OG_LF_TECH = {
  11201:'Ambassadeurs intergalactiques', 11202:'Extracteurs à haute performance',
  11203:'Moteurs à fusion', 11204:'Générateur de champ de camouflage'
};

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
 * les Humains, 113xx/114xx pour la suivante).
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
