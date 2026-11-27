/* node config/masque-css.js — réécrit masque.css et masque-conf.js depuis hide-selectors.json.

   La feuille part avec le manifeste (`css` d'un content script à
   document_start) : Chrome la pose avant que la page ait un seul nœud, donc
   avant le premier dessin. Une feuille déclarée là est un fichier figé — elle
   ne peut pas lire le JSON elle-même. D'où cette étape : le JSON reste le seul
   endroit à corriger quand Gameforge renomme un bloc, et ce script en tire la
   feuille. pack.sh le relance à chaque paquet, et un test refuse un
   masque.css qui ne correspond plus au JSON. */
const fs = require('fs'), path = require('path');

const CLES = ['pub', 'bandeau', 'chat'];

/**
 * La feuille entière, tirée de la configuration.
 * @param {object} conf le contenu de hide-selectors.json
 * @returns {string}
 */
function cssDe(conf) {
  const l = ['/* Écrit par config/masque-css.js depuis config/hide-selectors.json : ne pas modifier à la main. */'];
  const tous = [];
  for (const k of CLES) {
    const c = conf[k] || {};
    const sels = c.masquer || [];
    tous.push(...sels);
    if (sels.length) l.push(sels.map(s => `html.cp-hide-${k} ${s}`).join(',\n') + '{display:none !important}');
    for (const [s, decl] of Object.entries(c.recaler || {}))
      l.push(`html.cp-hide-${k} ${s}{${decl}}`);
  }
  /* L'attente : tant que masque.js n'a pas lu les choix du joueur — quelques
     millisecondes, avant le premier dessin —, tout ce qui pourrait être masqué
     l'est. Un élément qui doit rester visible arrive donc un instant plus tard ;
     un élément masqué, lui, ne clignote jamais. */
  if (tous.length) l.push(tous.map(s => `html.cp-masque-attente ${s}`).join(',\n') + '{display:none !important}');
  l.push(`#cp-pastille-chat{position:fixed;right:12px;bottom:12px;z-index:9500;
padding:5px 11px;border:1px solid #28335a;border-radius:999px;background:#101a2b;color:#e4edff;
font:600 12px/1.3 Arial,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5)}
#cp-pastille-chat:hover,#cp-pastille-chat:focus-visible{background:#16203a;outline:2px solid #8aa9ff;outline-offset:1px}`);
  return l.join('\n') + '\n';
}

/**
 * Ce que masque.js doit savoir du chat pour guetter ses messages, en script :
 * listé avant lui dans le manifeste, il est lu de façon synchrone, sans fetch
 * ni ressource exposée à la page.
 * @param {object} conf
 * @returns {string}
 */
function confDe(conf) {
  const c = conf.chat || {};
  const chat = { racine: c.racine || [], compteur: c.compteur || [], ligne: c.ligne || [] };
  return '/* Écrit par config/masque-css.js depuis config/hide-selectors.json : ne pas modifier à la main. */\n'
    + 'self.__cpMasqueConf = ' + JSON.stringify({ chat }, null, 2) + ';\n';
}

if (require.main === module) {
  const racine = path.join(__dirname, '..');
  const conf = JSON.parse(fs.readFileSync(path.join(__dirname, 'hide-selectors.json'), 'utf8'));
  fs.writeFileSync(path.join(racine, 'masque.css'), cssDe(conf));
  fs.writeFileSync(path.join(racine, 'masque-conf.js'), confDe(conf));
}

module.exports = { cssDe, confDe, CLES };
