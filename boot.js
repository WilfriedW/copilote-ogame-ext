window.__mem = {};
window.LS = {
  getItem: k => (k in window.__mem ? window.__mem[k] : null),
  /* L'écriture est asynchrone : son échec (quota, extension rechargée pendant
     que le panneau est ouvert) n'arrive jamais au try/catch de save(). Sans ce
     relais, le panneau continue d'afficher la case cochée que rien n'a gardée. */
  setItem: (k, v) => {
    window.__mem[k] = v;
    try { chrome.storage.local.set({ ['ls:' + k]: v }).catch(e => window.__saveFailed && window.__saveFailed(e)); }
    catch (e) { window.__saveFailed ? window.__saveFailed(e) : null; throw e; }
  }
};
chrome.storage.local.get(null, d => {
  for (const [k, v] of Object.entries(d)) if (k.startsWith('ls:')) window.__mem[k.slice(3)] = v;
  window.__game = d.game || null;
  window.__api = d.api || null;
  // les demandes de la page du jeu ne portent pas le préfixe « ls: » : sans ceci, app.js ne les voit jamais
  window.__prioAsk = d.prioAsk || null;
  /* Ce qui est ouvert ou fermé se lit avant le premier dessin : lu après,
     chaque carte s'ouvrirait fermée puis se rouvrirait sous les yeux. */
  window.__uiState = d.uiState || null;
  window.__uiSeen = d.uiSeen || null;
  /* L'historique des débordements de hangar (sept jours) : il dit si monter
     le hangar se justifie. Propre à cette machine, comme l'état des volets. */
  window.__surplusLog = d.surplusLog || null;
  // l'onglet de carte choisi par vue (mode onglets), propre à cette machine
  window.__cardTab = d.cardTab || null;
  /* Le mode des heures (serveur ou locale) se lit avant le premier dessin :
     lu après, le panneau s'ouvrirait une fraction de seconde dans l'autre. */
  const go = () => {
    const s = document.createElement('script');
    s.src = 'app.js';
    document.body.appendChild(s);
  };
  /* Les règles du moteur se lisent avant app.js, qui les consulte dès son
     premier rendu. Un fichier illisible ne bloque pas le panneau : il tourne
     avec le moteur d'avant, et l'en-tête le dit. Une seule erreur, ici. */
  // Hors extension (page de démonstration, harnais) il n'y a pas de fichier à lire, et rien à signaler.
  const regles = !(chrome.runtime && chrome.runtime.getURL && typeof fetch === 'function')
    ? Promise.resolve().then(() => { window.__rules = null; })
    : fetch(chrome.runtime.getURL('rules.json'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { window.__rules = j; })
      .catch(e => { window.__rules = null; console.error('Copilote : rules.json illisible, le moteur tourne sans réglages de règles', e); });
  const heures = new Promise(ok => {
    /* Et la disposition des cartes (empilées ou en onglets), pour la même
       raison : lue après, le panneau s'ouvrirait empilé puis sauterait. */
    try { chrome.storage.sync.get(['timeMode', 'cardLayout', 'masque'], v => { window.__timeMode = (v && v.timeMode) || null; window.__cardLayout = (v && v.cardLayout) || null; window.__masque = (v && v.masque) || null; ok(); }); }
    catch (e) { ok(); }
  });
  Promise.all([regles, heures]).then(go, go);
});
