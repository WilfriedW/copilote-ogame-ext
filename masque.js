/* Masquer la publicité, le bandeau Gameforge et la barre de chat.

   Lancé à document_start, avant que la page ait un corps. Rien n'est retiré
   du DOM : trois classes sur <html> — cp-hide-pub, cp-hide-bandeau,
   cp-hide-chat — et masque.css, que Chrome a posée avant ce script, fait le
   reste en display:none. Le jeu garde donc tous ses nœuds, et ses scripts qui
   les cherchent les trouvent.

   Le clignotement. Les choix du joueur se lisent dans chrome.storage, qui
   répond de façon asynchrone. Pour qu'un élément masqué n'apparaisse jamais
   le temps de cette lecture, <html> porte cp-masque-attente dès la première
   ligne : la feuille cache alors tout ce qui peut l'être, et on ne lève
   l'attente qu'une fois les classes posées. Lecture seule : aucun clic, aucun
   envoi, aucun appel réseau. */
(function (racineGlobale) {
  const CLES = ['pub', 'bandeau', 'chat'];

  /** Les trois choix, ramenés à des booléens ; tout ce qui manque vaut
      « masqué » — la valeur par défaut, la même que dans le panneau. Un choix
      enregistré à false, lui, reste visible. */
  function normalise(m) {
    const o = {};
    for (const k of CLES) o[k] = !m || m[k] === undefined ? true : !!m[k];
    return o;
  }

  /** « 1 message », « 3 messages ». */
  const libelle = n => n + (n > 1 ? ' messages' : ' message');

  /**
   * Démarre le masquage sur un document.
   * @param {{doc:Document, chrome:object, conf:object, win?:object, MO?:Function}} env
   */
  function demarre(env) {
    const { doc, chrome } = env;
    const conf = env.conf || {};
    const win = env.win || {};
    const MO = env.MO || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
    const html = doc.documentElement;
    const chatConf = conf.chat || {};
    const RACINE = (chatConf.racine || []).join(',');
    const COMPTEUR = (chatConf.compteur || []).join(',');
    const LIGNE = (chatConf.ligne || []).join(',');

    let etat = normalise(null);
    /* Le chat rouvert d'un clic sur la pastille, jusqu'au prochain changement
       de page : l'interrupteur, lui, ne bouge pas. */
    let chatVu = false;
    let lignes = 0, compteLignes = false, obs = null, prevu = null;

    html.classList.add('cp-masque-attente');
    /* Un garde-fou : si le stockage ne répondait jamais, la page ne doit pas
       rester amputée. Trois secondes, bien après tout premier dessin. */
    const garde = setTimeout(() => html.classList.remove('cp-masque-attente'), 3000);

    /** L'extension a été rechargée : ce script parle à un contexte mort. */
    const mort = () => { try { return !chrome.runtime || !chrome.runtime.id; } catch (e) { return true; } };

    function applique() {
      for (const k of CLES) html.classList.toggle('cp-hide-' + k, etat[k] && !(k === 'chat' && chatVu));
      veille();
    }

    /* ---------- la pastille du chat ---------- */

    function pastille() { return doc.getElementById('cp-pastille-chat'); }
    function retirePastille() { const p = pastille(); if (p) p.remove(); }

    /** Les non-lus que le jeu écrit lui-même, s'il les écrit. */
    function nonLus() {
      if (!COMPTEUR) return 0;
      let n = 0;
      doc.querySelectorAll(COMPTEUR).forEach(e => { n += parseInt((e.textContent || '').replace(/\D+/g, ''), 10) || 0; });
      return n;
    }

    function montre() {
      prevu = null;
      if (mort()) { if (obs) obs.disconnect(); return; }
      if (!etat.chat || chatVu) { retirePastille(); return; }
      const n = Math.max(nonLus(), lignes);
      if (!n) { retirePastille(); return; }
      if (!doc.body) return;
      let p = pastille();
      if (!p) {
        p = doc.createElement('button');
        p.id = 'cp-pastille-chat';
        p.type = 'button';
        p.addEventListener('click', () => {
          chatVu = true;
          retirePastille();
          applique();
        });
        doc.body.appendChild(p);
      }
      const t = libelle(n);
      if (p.textContent !== t) p.textContent = t;
      p.title = 'Nouveau message dans le chat masqué : clique pour l\'afficher jusqu\'à la prochaine page';
      p.setAttribute('aria-label', t + ' dans le chat masqué. Afficher le chat');
    }
    /* Les pages du jeu bougent sans cesse — chaque compte à rebours réécrit
       son texte à la seconde. On regroupe donc : un seul recompte par salve. */
    const plus = () => { if (!prevu) prevu = setTimeout(montre, 250); };

    /** Une ligne de message ajoutée dans la barre de chat. */
    function compte(muts) {
      if (!compteLignes || !LIGNE) return 0;
      let n = 0;
      for (const m of muts) for (const x of m.addedNodes) {
        if (x.nodeType !== 1) continue;
        const dedans = !RACINE || (x.closest && x.closest(RACINE));
        if (!dedans) continue;
        if (x.matches && x.matches(LIGNE)) n++;
        else if (x.querySelectorAll) n += x.querySelectorAll(LIGNE).length;
      }
      return n;
    }

    function veille() {
      const voulu = etat.chat && !chatVu && !!MO;
      if (!voulu) {
        if (obs) { obs.disconnect(); obs = null; }
        lignes = 0;
        retirePastille();
        return;
      }
      if (obs) return;
      obs = new MO(muts => {
        if (mort()) { obs && obs.disconnect(); return; }
        lignes += compte(muts);
        plus();
      });
      obs.observe(html, { childList: true, subtree: true, characterData: true });
      plus();
    }

    /* L'historique du chat se remplit avec la page : ces lignes-là sont
       anciennes. On ne compte que celles qui arrivent après. */
    const ouvreCompte = () => setTimeout(() => { compteLignes = true; }, 1500);
    if (doc.readyState === 'complete') ouvreCompte();
    else (win.addEventListener ? win : doc).addEventListener('load', ouvreCompte);

    /* ---------- les choix du joueur ---------- */

    let vu = false;
    function prends(m) {
      const neuf = normalise(m);
      // le joueur rebascule le chat : le clic sur la pastille ne tient plus
      if (neuf.chat !== etat.chat) chatVu = false;
      etat = neuf;
      applique();
    }
    function fini() {
      clearTimeout(garde);
      html.classList.remove('cp-masque-attente');
    }

    try {
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === 'sync' && ch.masque) { vu = true; prends(ch.masque.newValue); }
      });
      chrome.storage.sync.get('masque', v => {
        /* Jamais réglé : normalise(undefined) masque les trois, la valeur
           par défaut. Rien n'est écrit : le défaut n'écrase aucun choix. */
        if (!vu) prends(v && v.masque);
        fini();
      });
    } catch (e) { fini(); }

    return {
      etat: () => Object.assign({}, etat),
      chatVu: () => chatVu,
      montre,
      ajouteLignes: n => { lignes += n; },
      ouvreCompte: () => { compteLignes = true; },
      compte
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { demarre, normalise, libelle, CLES };
  } else if (!racineGlobale.__cpMasque) {
    racineGlobale.__cpMasque = true;
    /* Réinjecté après un rechargement de l'extension : la pastille de
       l'ancienne instance appartient à un contexte mort, on la retire. */
    const vieille = document.getElementById('cp-pastille-chat');
    if (vieille) vieille.remove();
    demarre({ doc: document, chrome, conf: racineGlobale.__cpMasqueConf || {}, win: window });
  }
})(typeof self !== 'undefined' ? self : this);
