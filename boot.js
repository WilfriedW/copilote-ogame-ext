window.__mem = {};
window.LS = {
  getItem: k => (k in window.__mem ? window.__mem[k] : null),
  setItem: (k, v) => { window.__mem[k] = v; chrome.storage.local.set({ ['ls:' + k]: v }); }
};
chrome.storage.local.get(null, d => {
  for (const [k, v] of Object.entries(d)) if (k.startsWith('ls:')) window.__mem[k.slice(3)] = v;
  window.__game = d.game || null;
  window.__api = d.api || null;
  const s = document.createElement('script');
  s.src = 'app.js';
  document.body.appendChild(s);
});
