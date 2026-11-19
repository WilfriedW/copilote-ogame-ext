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
  const s = document.createElement('script');
  s.src = 'app.js';
  document.body.appendChild(s);
});
