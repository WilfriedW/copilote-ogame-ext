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
  const regles = fetch(chrome.runtime.getURL('rules.json'))
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(j => { window.__rules = j; })
    .catch(e => { window.__rules = null; console.error('Copilote : rules.json illisible, le moteur tourne sans réglages de règles', e); });
  const heures = new Promise(ok => {
    try { chrome.storage.sync.get('timeMode', v => { window.__timeMode = (v && v.timeMode) || null; ok(); }); }
    catch (e) { ok(); }
  });
  Promise.all([regles, heures]).then(go, go);
});
