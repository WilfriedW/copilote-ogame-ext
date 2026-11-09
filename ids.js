var OG_BUILD = {1:'metal', 2:'crystal', 3:'deut', 4:'solar', 12:'fusion', 14:'robot', 15:'nanite', 21:'shipyard', 22:'smetal', 23:'scrystal', 24:'sdeut', 31:'lab'};

var OG_TECH = {106:'espionage', 108:'computer', 109:'weapons', 110:'shielding', 111:'armour', 113:'energy', 114:'hyper', 115:'combustion', 117:'impulse', 118:'hyperdrive', 120:'laser', 121:'ion', 122:'plasma', 123:'irn', 124:'astro'};

/* Bâtiments de forme de vie, relevés sur le jeu. Les Humains occupent la
   série 111xx ; les autres races ont leur propre série, à relever de même
   plutôt qu'à deviner — un identifiant inventé pointerait sur le mauvais
   bâtiment sans rien signaler. */
var OG_LF_BUILD = {
  11101:'Secteur résidentiel', 11102:'Ferme biosphérique', 11103:'Centre de recherche',
  11104:'Académie des sciences', 11105:'Centre de neurocalibrage', 11106:'Fusion à haute énergie',
  11107:'Réserve alimentaire', 11108:'Extraction par fusion', 11109:'Tour d\'habitation',
  11110:'Laboratoire de biotechnologie', 11111:'Métropolis', 11112:'Bouclier planétaire'
};

var OG_SHIPS = {202:'sc', 203:'lc', 204:'lf', 205:'hf', 206:'cr', 207:'bs', 208:'col', 209:'rec', 210:'pr', 211:'bb', 213:'ds', 215:'bc', 218:'rp', 219:'pf'};

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
