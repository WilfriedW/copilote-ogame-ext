/* Les expéditions : src/flotte/expeditions.js vu depuis le plan du jour
   (plafond, cadre de points et de fret, journal des retours, place unique,
   vols en cours lus dans le jeu). Lancé par test/run.js. */
const { runPage } = require('./page');

module.exports = ({ t, assert, app, lu, JOUR, SOIR, flotteDExpedition }) => {
  /* ---------- le plafond des expéditions ---------- */

  const expeditions = g => g.simulateDay().sessions[0].acts.filter(a => a.kind === 'expo');

  t('le nombre d\'expéditions affiché par le jeu l\'emporte sur la formule', () => {
    // Astrophysique 9 ferait croire à trois expéditions ; le jeu en annonce deux,
    // et c'est lui qui refuse la troisième.
    const g = app(s => { flotteDExpedition(s); s.tech.astro = 9;
      s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR }; }, JOUR);
    assert.equal(expeditions(g).length, 2);
  });

  t('pas plus d\'expéditions que d\'emplacements de flotte libres', () => {
    // Une expédition occupe aussi un emplacement de flotte : trois proposées sur
    // un seul emplacement libre, c'est « Nombre maximal de flottes atteint ».
    const g = app(s => { flotteDExpedition(s); s.tech.astro = 9;
      s.slots = { fleet: [8, 9], expo: [0, 3], at: JOUR }; }, JOUR);
    assert.equal(expeditions(g).length, 1);
  });

  t('au plafond, le plan dit quelle recherche l\'augmente', () => {
    const g = app(s => { flotteDExpedition(s); s.tech.astro = 8;
      s.slots = { fleet: [0, 9], expo: [2, 2], at: JOUR }; }, JOUR);
    const m = g.dailyMissions().find(x => x.id === 'expomax');
    assert.ok(m, 'la carte du plafond existe');
    assert.ok(/Astrophysique 9/.test(m.why + m.how.join(' ')),
      'elle nomme le niveau qui débloque la troisième : ' + m.why);
  });

  t('la flotte au sol dans le plafond : aucune carte de plafond', () => {
    const g = app(s => { s.planets[0].ships = { pr: 4 }; s.planets[1].ships = {};
      s.syncAt = JOUR; s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR }; }, JOUR);
    assert.ok(!g.dailyMissions().find(x => x.id === 'expomax'),
      'sans transporteur, rien à débloquer');
  });

  t('feuille de route épuisée : Astrophysique entre dans le plan pour les expéditions', () => {
    const g = app(s => {
      flotteDExpedition(s);
      s.day.focus = 'fleet';
      // toute la feuille de route « flotte » est derrière lui, sauf Astrophysique
      Object.assign(s.tech, { combustion: 6, impulse: 5, espionage: 4, computer: 6,
        hyper: 3, hyperdrive: 2, energy: 8, astro: 8 });
      s.planets[0].b = Object.assign({}, s.planets[0].b, { lab: 10 });
      s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR };
    }, JOUR);
    const j = g.simulateDay();
    const rech = j.sessions.flatMap(x => x.acts).filter(a => a.kind === 't')
      .concat(j.sessions.flatMap(x => x.waits).filter(w => /Recherche/.test(w.q)));
    assert.ok(rech.some(a => /Astrophysique/.test(a.what)),
      'Astrophysique est proposée ou attendue : ' + (rech.map(a => a.what).join(', ') || 'rien'));
  });

  t('la carte du plafond dit d\'où vient le chiffre', () => {
    // Sans ce témoin, « je ne vois pas de changement » est indécidable : le
    // plafond lu dans le jeu et le plafond déduit d'Astrophysique donnent la
    // même carte, mais seul le premier prouve que la page a été lue.
    const lu = app(s => { flotteDExpedition(s); s.tech.astro = 8;
      s.slots = { fleet: [3, 9], expo: [1, 2], at: JOUR }; }, JOUR);
    const m = lu.dailyMissions().find(x => x.id === 'expomax');
    assert.ok(/1\/2/.test(m.why), 'le chiffre lu dans le jeu : ' + m.why);
    assert.ok(/3\/9/.test(m.why), 'et les emplacements de flotte : ' + m.why);

    const deduit = app(s => { flotteDExpedition(s); s.tech.astro = 8; s.slots = null; }, JOUR);
    const d = deduit.dailyMissions().find(x => x.id === 'expomax');
    assert.ok(/Astrophysique/.test(d.why) && !/\d\/\d/.test(d.why),
      'sans lecture du jeu, la carte le dit au lieu d\'inventer un chiffre : ' + d.why);
  });

  t('le plafond lu hier vaut toujours aujourd\'hui', () => {
    // Le nombre d'expéditions simultanées ne change qu'avec Astrophysique : le
    // jeter au bout de trois heures ramenait le plan à la formule, c'est-à-dire
    // au bug. Seul le nombre d'expéditions *en cours* se périme.
    const g = app(s => { flotteDExpedition(s); s.tech.astro = 9;
      s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR - 20 * 3600e3 }; }, JOUR);
    assert.equal(expeditions(g).length, 2, 'toujours deux, pas la formule');
  });

  t('les expéditions déjà en vol sont comptées sur les mouvements du jeu', () => {
    // Le jeu dit « Expéditions 2/2 » et liste deux vols (mission 15), mais un
    // seul retour avait un minuteur. Le plan en déduisait un emplacement libre
    // et proposait une troisième expédition que le jeu refuse.
    const g = app(s => {
      flotteDExpedition(s);
      s.tech.astro = 4;
      s.slots = { fleet: [4, 7], expo: [2, 2], at: JOUR };
      const r1 = Math.floor(JOUR / 1000) + 4 * 3600, r2 = r1 + 600;
      s.moves = [
        { arrival: r1 - 1200, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: false },
        { arrival: r1, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: true },
        { arrival: r2 - 1200, dest: '1:92:16', mission: 15, origin: '1:142:6', ret: false },
        { arrival: r2, dest: '1:92:16', mission: 15, origin: '1:142:6', ret: true }
      ];
      // un seul des deux retours a son minuteur : c'est le cas réel
      s.timers = [{ id: 'g1', game: true, queue: 'fleet', end: r1 * 1000, done: false,
        kind: 'x', k: 'expo', label: "Retour d'expédition" }];
    }, JOUR);
    assert.equal(expeditions(g).length, 0,
      'les deux emplacements sont pris jusqu\'au premier retour');
  });

  t('un retour compté une seule fois, minuteur et mouvement confondus', () => {
    // Le minuteur du jeu porte l'heure d'arrivée du mouvement : les additionner
    // bloquerait une expédition que le joueur peut lancer.
    const g = app(s => {
      flotteDExpedition(s);
      s.tech.astro = 4;
      s.slots = { fleet: [1, 7], expo: [1, 2], at: JOUR };
      const r = Math.floor(JOUR / 1000) + 4 * 3600;
      s.moves = [
        { arrival: r - 1200, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: false },
        { arrival: r, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: true }
      ];
      s.timers = [{ id: 'g1', game: true, queue: 'fleet', end: r * 1000, done: false,
        kind: 'x', k: 'expo', label: "Retour d'expédition" }];
    }, JOUR);
    assert.equal(expeditions(g).length, 1, 'un emplacement reste libre');
  });

  t('expéditions à moitié vides : des transporteurs, pas de la recherche', () => {
    // Deux emplacements, deux flottes, mais chacune très loin de la soute qu'une
    // expédition peut ramener : un emplacement de plus ne rapporterait rien.
    // Dire « fais Astrophysique » ici enverrait le joueur dépenser pour rien.
    const g = app(s => {
      s.settings.eco = 8;               // soute utile par expédition très haute
      s.tech.astro = 4;
      s.planets[0].ships = { lc: 2 };
      s.planets[1].ships = { sc: 21 };
      s.syncAt = JOUR;
      s.slots = { fleet: [2, 7], expo: [2, 2], at: JOUR };
    }, JOUR);
    const c = g.dailyMissions().find(x => x.id === 'expocargo');
    assert.ok(c, 'la carte existe');
    assert.ok(/transporteur/i.test(c.how.join(' ')), 'elle envoie au chantier : ' + c.how.join(' '));
    assert.ok(!g.dailyMissions().find(x => x.id === 'expomax'),
      'et pas en même temps celle qui réclame Astrophysique');
  });

  t('soutes pleines : c\'est bien le plafond qui limite', () => {
    // Même plafond, mais des flottes qui saturent la soute : là, un emplacement
    // de plus rapporte vraiment, et c'est Astrophysique qu'il faut.
    const g = app(s => {
      s.settings.eco = 1;
      s.tech.astro = 4;
      s.planets[0].ships = { lc: 40 };
      s.planets[1].ships = {};
      s.syncAt = JOUR;
      s.slots = { fleet: [0, 7], expo: [0, 2], at: JOUR };
    }, JOUR);
    assert.ok(g.dailyMissions().find(x => x.id === 'expomax'), 'la carte du plafond');
    assert.ok(!g.dailyMissions().find(x => x.id === 'expocargo'), 'pas celle des soutes');
  });

  /* ---------- recopier sans jouer à sa place ---------- */

  t('une expédition porte sa destination', () => {
    const g = app(s => { flotteDExpedition(s); s.tech.astro = 4;
      s.slots = { fleet: [0, 7], expo: [0, 2], at: JOUR }; }, JOUR);
    const e = expeditions(g)[0];
    assert.ok(e, 'une expédition est proposée');
    assert.ok(/^\d+:\d+:16$/.test(e.dest || ''), 'la destination voyage avec l\'action : ' + e.dest);
  });

  /* ---------- le framework d'expédition ---------- */

  /* Un univers déjà gros : tranche 4, donc 12 000 points de plafond et une
     trouvaille maximale de 2,4 M. C'est là que le framework a quelque chose à
     composer — dans un univers neuf, la trouvaille borne tout. */
  const GROS = s => { s.settings.top1 = 4; s.host = 's1-fr.ogame.gameforge.com'; };
  /* Une planète de flotte : de quoi atteindre le plafond, et le deutérium du vol. */
  const FLOTTE = (s, over) => {
    GROS(s);
    s.planets[0].gid = '101'; s.planets[1].gid = '102';
    s.planets[0].ships = Object.assign({ pr: 4, pf: 2, rp: 3, ds: 2, bs: 60, lc: 200, lf: 300 }, over);
    s.planets[0].stock = { m: 2000000, c: 1500000, d: 3000000, at: JOUR };
    s.planets[1].ships = {};
    s.syncAt = JOUR;
    s.slots = { fleet: [0, 9], expo: [0, 3], at: JOUR };
    s.tech.astro = 9;
  };

  t("les points d'un vaisseau sont ceux de l'énoncé", () => {
    // Le calcul témoin de la demande : 1 Faucheur + 1 sonde + 40 vaisseaux de
    // bataille + 200 grands transporteurs = 24 705.
    const g = app(GROS, JOUR);
    assert.equal(g.expoPoints({ rp: 1, pr: 1, bs: 40, lc: 200 }), 24705);
  });

  t("la composition suit l'ordre du framework", () => {
    const g = app(FLOTTE, JOUR);
    const f = g.expoFleet(g.S.planets[0].ships, g.S.planets[0]);
    assert.ok(f, 'une flotte se compose');
    assert.equal(f.ships.pr, 1, 'une seule sonde');
    assert.equal(f.ships.pf, 1, 'un seul éclaireur');
    assert.equal(f.ships.rp, 1, 'un seul gros vaisseau, et le plus avancé : ' + JSON.stringify(f.ships));
    assert.ok(!f.ships.ds, 'pas de deuxième gros vaisseau : ' + JSON.stringify(f.ships));
    assert.ok(f.ships.lc > 0, 'des grands transporteurs pour le fret');
  });

  t('le fret visé se déduit du plafond de points et du facteur', () => {
    const g = app(GROS, JOUR);
    assert.equal(g.expoPts(), 12000, 'tranche 4 : 12 000 points');
    // 12 000 points x 200 ressources x éco x1
    assert.equal(g.expoFret(), 2400000);
    const h = app(s => { GROS(s); s.settings.expoFret = 100; }, JOUR);
    assert.equal(h.expoFret(), 1200000, 'le facteur est un réglage, pas une loi');
  });

  t("le plafond de points n'est jamais dépassé de plus de cinq pour cent", () => {
    const g = app(FLOTTE, JOUR);
    const f = g.expoFleet(g.S.planets[0].ships, g.S.planets[0]);
    assert.ok(f.pts <= f.ptsCap * g.EXPO_MARGE,
      f.pts + ' points pour un plafond de ' + f.ptsCap + ' : au-delà, du deut brûlé pour rien');
    assert.ok(f.plein, 'et il est bien atteint : ' + f.pts + '/' + f.ptsCap);
  });

  t("la réserve de grands transporteurs n'est jamais prise", () => {
    // 279 au sol, 250 réservés : l'expédition ne peut en toucher que 29.
    const g = app(s => { FLOTTE(s, { lc: 279 }); s.settings.expoRes = 250; }, JOUR);
    const f = g.expoFleet(g.S.planets[0].ships, g.S.planets[0]);
    assert.ok((f.ships.lc || 0) <= 29, (f.ships.lc || 0) + ' grands transporteurs pris sur 29 disponibles');
  });

  t("une réserve par planète l'emporte sur le réglage général", () => {
    const g = app(s => { FLOTTE(s, { lc: 279 }); s.settings.expoRes = 0; s.planets[0].expoRes = 279; }, JOUR);
    const f = g.expoFleet(g.S.planets[0].ships, g.S.planets[0]);
    assert.ok(!f, 'plus un seul transporteur disponible, donc aucune expédition depuis là');
  });

  t('sans transporteur hors réserve, la planète sort des candidates', () => {
    // La deuxième planète reçoit la flotte, la première est entièrement réservée.
    const g = app(s => {
      FLOTTE(s);
      s.planets[1].ships = { pr: 1, pf: 1, rp: 1, bs: 40, lc: 100 };
      s.planets[1].stock = { m: 0, c: 0, d: 3000000, at: JOUR };
      s.planets[0].expoRes = 1000;
    }, JOUR);
    const c = g.expoCandidats(JOUR);
    assert.ok(c.length, 'une candidate reste');
    assert.equal(c[0].p.name, 'Colonie', "et c'est celle qui a des transporteurs libres");
  });

  t('la meilleure planète sort en premier, avec deux alternatives', () => {
    const g = app(s => {
      FLOTTE(s);
      // deux autres planètes, plus loin de la 16 et sans éclaireur
      s.planets.push({ id: 'p3', name: 'Troisième', coords: '1:300:1', tmax: 40,
        b: s.planets[1].b, sats: 0, ships: { pr: 1, rp: 1, bs: 40, lc: 150 }, shipsAt: 0,
        stock: { m: 0, c: 0, d: 3000000, at: JOUR } });
      s.planets.push({ id: 'p4', name: 'Quatrième', coords: '1:400:2', tmax: 40,
        b: s.planets[1].b, sats: 0, ships: { pr: 1, bs: 40, lc: 150 }, shipsAt: 0,
        stock: { m: 0, c: 0, d: 3000000, at: JOUR } });
    }, JOUR);
    const prop = g.expoPropose(JOUR, 1);
    assert.equal(prop.length, 1, 'un emplacement, une recommandation');
    assert.equal(prop[0].p.name, 'Planète mère', 'la mieux classée : ' + prop[0].p.name);
    assert.equal(prop[0].alts.length, 2, 'et deux alternatives affichées');
  });

  t('un emplacement libre sur trois : une seule recommandation', () => {
    const g = app(s => { FLOTTE(s); s.slots = { fleet: [2, 9], expo: [2, 3], at: JOUR }; }, JOUR);
    const e = g.expoEtat(JOUR);
    assert.equal(e.max, 3);
    assert.equal(e.pris, 2);
    assert.equal(e.libres, 1);
    assert.equal(g.expoPropose(JOUR, e.libres).length, 1);
  });

  t('le bloc compte les emplacements et dit quand le prochain rentre', () => {
    const r = Math.floor(JOUR / 1000) + 4 * 3600 + 12 * 60;
    const g = app(s => {
      FLOTTE(s);
      s.slots = { fleet: [2, 9], expo: [2, 2], at: JOUR };
      s.moves = [{ arrival: r, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: true }];
    }, JOUR);
    const h = lu(g.expoHtml().html);
    assert.match(h, /2 utilisés \/ 2 disponibles/, 'le compteur : ' + h.slice(0, 200));
    assert.match(h, /Prochain retour dans 4h 12m/, 'et le prochain retour : ' + h.slice(0, 300));
  });

  t("un emplacement libre, et le bloc dit qu'elle est prête", () => {
    const g = app(FLOTTE, JOUR);
    const h = lu(g.expoHtml().html);
    assert.match(h, /Prête maintenant/, h.slice(0, 200));
  });

  t('Préparer porte la planète, les vaisseaux, la destination et la mission', () => {
    const g = app(FLOTTE, JOUR);
    const h = lu(g.expoHtml().html);
    const m = h.match(/data-prep="([^"]+)"/);
    assert.ok(m, 'le bouton Préparer porte un lien : ' + h.slice(0, 400));
    const url = m[1];
    assert.match(url, /component=fleetdispatch/);
    assert.match(url, /cp=101/, 'la bonne planète : ' + url);
    assert.match(url, /mission=15/, 'mission Expédition : ' + url);
    assert.match(url, /galaxy=1&system=142&position=16/, 'la position 16 de son système : ' + url);
    assert.match(url, /am\d+=\d+/, 'et les vaisseaux : ' + url);
  });

  t("le bloc ne lance rien : il dit que l'envoi reste au joueur", () => {
    const g = app(FLOTTE, JOUR);
    const h = lu(g.expoHtml().html);
    assert.match(h, /L'envoi reste à toi/, h.slice(-400));
    // et la durée s'annonce comme une visée, pas comme un champ déjà réglé :
    // le nom du paramètre de stationnement n'a jamais été relu dans le jeu
    assert.match(h, /exploration visée/, h.slice(0, 600));
    assert.match(h, /durée d'exploration est à choisir dans le jeu/, h.slice(-400));
  });

  t('trois expéditions vers un système, et le plan va voir ailleurs', () => {
    const g = app(s => {
      FLOTTE(s);
      // une colonie équivalente dans un autre système, un peu moins bien placée
      s.planets[1].coords = '1:200:8';
      s.planets[1].ships = { pr: 1, pf: 1, rp: 1, bs: 40, lc: 150 };
      s.planets[1].stock = { m: 0, c: 0, d: 3000000, at: JOUR };
      s.expoLog = [1, 2, 3].map(i => ({ cle: 'c' + i, at: JOUR + i, sys: '1:142', de: '' }));
    }, JOUR);
    const c = g.expoCandidats(JOUR);
    assert.equal(c[0].sys, '1:200',
      "trois envois vers 1:142 en 24 h : on part d'ailleurs. Classé : " +
      c.map(x => x.sys + ' ' + x.score.toFixed(2)).join(', '));
  });

  t('un envoi vieux de plus de vingt-quatre heures ne pèse plus', () => {
    const g = app(s => {
      FLOTTE(s);
      s.expoLog = [1, 2, 3].map(i => ({ cle: 'c' + i, at: JOUR - 30 * 3600e3 - i, sys: '1:142', de: '' }));
    }, JOUR);
    assert.equal(g.expoVus('1:142', JOUR), 0, 'le malus a expiré');
  });

  t("deux emplacements libres ne visent pas deux fois le même système", () => {
    const g = app(s => {
      FLOTTE(s);
      s.planets[1].coords = '1:200:8';
      s.planets[1].ships = { pr: 1, pf: 1, rp: 1, bs: 40, lc: 150 };
      s.planets[1].stock = { m: 0, c: 0, d: 3000000, at: JOUR };
      s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR };
    }, JOUR);
    const prop = g.expoPropose(JOUR, 2);
    assert.equal(prop.length, 2, 'deux recommandations');
    assert.notEqual(prop[0].sys, prop[1].sys, 'et deux systèmes : ' + prop.map(x => x.sys).join(', '));
  });

  t("aucune planète au plafond : le bloc le dit et propose quand même", () => {
    // Deux grands transporteurs et une sonde : le plafond de 12 000 points est
    // hors d'atteinte. Se taire enverrait le joueur chercher pourquoi.
    const g = app(s => {
      GROS(s);
      s.planets[0].gid = '101';
      s.planets[0].ships = { lc: 2, pr: 1 };
      s.planets[0].stock = { m: 0, c: 0, d: 500000, at: JOUR };
      s.planets[1].ships = {};
      s.syncAt = JOUR; s.tech.astro = 4;
      s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR };
    }, JOUR);
    const h = lu(g.expoHtml().html);
    assert.match(h, /plafond non atteint/, 'le bloc le dit : ' + h.slice(0, 600));
    assert.match(h, /data-prep=/, 'et propose tout de même la meilleure composition possible');
  });

  t('le deutérium du vol manque : la planète passe derrière', () => {
    const g = app(s => {
      FLOTTE(s);
      s.planets[0].stock = { m: 0, c: 0, d: 10, at: JOUR };
      s.planets[1].coords = '1:200:8';
      s.planets[1].ships = { pr: 1, pf: 1, rp: 1, bs: 40, lc: 150 };
      s.planets[1].stock = { m: 0, c: 0, d: 3000000, at: JOUR };
    }, JOUR);
    const c = g.expoCandidats(JOUR);
    assert.equal(c[0].p.name, 'Colonie', 'celle qui peut payer son carburant : ' + c[0].p.name);
    assert.ok(c.every(x => x.deut), 'et aucune insolvable ne reste quand une autre tient');
  });

  t('une heure par défaut, plus long quand le joueur est parti', () => {
    const g = app(FLOTTE, JOUR);
    assert.equal(g.expoDuree(1200, JOUR), 1, 'de jour, une heure');
    // mode nuit armé et retour à 6 h : la flotte doit voler pendant l'absence
    const n = app(s => { FLOTTE(s); s.day.night = true; s.day.backHour = 6; }, JOUR);
    assert.ok(n.expoDuree(1200, JOUR) > 1,
      'de nuit, la plus longue qui rentre avant le retour : ' + n.expoDuree(1200, JOUR));
  });

  t('un réglage absurde ne passe pas le chargement', () => {
    // `expoSain` tourne au démarrage ET dans `sainEtat` : une clé validée
    // seulement là arriverait telle quelle au premier rendu.
    const g = app(s => { GROS(s); s.settings.expoFret = 'très gros'; s.settings.expoRes = -5;
      s.settings.expoHold = 99; s.expoLog = 'pas une liste'; }, JOUR);
    assert.equal(g.S.settings.expoFret, 200, 'le facteur retombe sur sa valeur de départ');
    assert.equal(g.S.settings.expoRes, 0);
    assert.equal(g.S.settings.expoHold, 1);
    assert.ok(Array.isArray(g.S.expoLog), "et l'historique est une liste");
  });

  t('le plan du jour et le bloc proposent la même planète', () => {
    // Deux classements différents sur deux écrans voisins, et c'est le panneau
    // qui a l'air de se contredire : ils trient par le même `expoScore`.
    // Une seule planète capable, exprès : le plan simule la journée, donc il
    // compte les transporteurs qu'un convoi — qu'il recommande lui-même —
    // aura quittés, et le bloc, qui lit la flotte au sol d'aujourd'hui, ne les
    // compte pas. Sur deux planètes à l'égalité, l'écart se voit.
    const g = app(s => {
      FLOTTE(s);
      s.slots = { fleet: [0, 9], expo: [0, 1], at: JOUR };
    }, JOUR);
    const bloc = g.expoPropose(JOUR, 1)[0];
    const act = g.simulateDay().sessions[0].acts.find(a => a.kind === 'expo');
    assert.ok(bloc && act, 'les deux proposent une expédition');
    assert.equal(act.dest, bloc.tgt, 'la même destination : ' + act.dest + ' vs ' + bloc.tgt);
    assert.equal(act.p, bloc.i, 'et la même planète de départ');
  });

  t("l'historique se remplit sur les retours lus dans le jeu", () => {
    const r = Math.floor(JOUR / 1000) + 3600;
    const g = app(FLOTTE, JOUR);
    // c'est le relevé du jeu qui porte les mouvements, pas la synchro entre postes
    g.applyGame({ meta: {}, planets: {}, moves: [
      { arrival: r - 1200, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: false },
      { arrival: r, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: true }
    ] });
    assert.equal(g.S.expoLog.length, 1, "un vol, une entrée : l'aller et le retour ne comptent qu'une fois");
    assert.equal(g.S.expoLog[0].sys, '1:88');
    // relu une seconde fois, la même page ne doit rien ajouter
    g.applyGame({ meta: {}, planets: {}, moves: [{ arrival: r, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: true }] });
    assert.equal(g.S.expoLog.length, 1, 'et la relecture ne double pas le compte');
  });

  /* ---------- le journal des expéditions ---------- */

  const ENVOI = { pr: 1, pf: 1, rp: 1, bs: 40, lc: 200 };
  const T0 = Math.floor(JOUR / 1000);
  /* Un aller vers 1:150:16 qui arrive dans dix minutes, un retour deux heures
     plus tard : lu à `lu` (ms), avec la flotte et la soute du moment. */
  const vol = (ret, arrival, ships, cargo, lu) => ({ arrival, dest: '1:150:16', mission: 15, origin: '1:142:8', ret,
    ships, cargo, lu: lu == null ? JOUR : lu, detailConnu: true });
  const ALLER = T0 + 600, RETOUR = T0 + 600 + 7200;

  t("un retour lu après l'événement donne cargaison, carburant et durée", () => {
    const g = app(FLOTTE, JOUR);
    g.expoJournal([vol(false, ALLER, ENVOI, [0, 0, 0]), vol(true, RETOUR, ENVOI, [0, 0, 0])], JOUR, 0);
    assert.equal(g.S.expoLog.length, 1, "l'aller et le retour font une seule expédition");
    assert.ok(!g.expoConnue(g.S.expoLog[0]), "un retour lu avant l'événement n'est pas un résultat");
    // relu pendant le vol retour : 3,2 M de cristal
    const apres = RETOUR * 1000 - 600e3;
    g.expoJournal([vol(true, RETOUR, ENVOI, [0, 3200000, 0], apres)], apres, 0);
    const e = g.S.expoLog[0];
    assert.ok(g.expoConnue(e), 'résultat connu');
    assert.deepEqual(e.cargaison, [0, 3200000, 0]);
    assert.deepEqual(e.envoi.ships, ENVOI, "l'envoi vient de l'aller");
    assert.ok(e.carburant > 0, 'carburant aller-retour : ' + e.carburant);
    assert.ok(e.duree > 7200e3, 'durée de la mission : ' + e.duree);
    assert.equal(e.evenement, 'ressources');
    assert.equal(e.sys, '1:150', 'le malus de système lit toujours sys');
    assert.equal(e.at, RETOUR * 1000, 'et at reste l\'heure du retour');
  });

  t('un croiseur de plus au retour est trouvé, dix VB de moins sont perdus', () => {
    const g = app(FLOTTE, JOUR);
    g.expoJournal([vol(false, ALLER, ENVOI, [0, 0, 0])], JOUR, 0);
    g.expoJournal([vol(true, RETOUR, Object.assign({}, ENVOI, { cr: 1, bs: 30 }), [0, 0, 0], RETOUR * 1000 - 60e3)], RETOUR * 1000 - 60e3, 0);
    const e = g.S.expoLog[0];
    assert.deepEqual(e.trouves, { cr: 1 });
    assert.deepEqual(e.pertes, { bs: 10 });
    assert.equal(e.evenement, 'pertes', 'les pertes priment sans rapport lu');
    assert.deepEqual(Array.from(g.expoValeur(e.pertes)), [450000, 150000, 0], 'coût de 10 VB');
  });

  t('sans envoi connu, trouvés et pertes restent vides', () => {
    const g = app(FLOTTE, JOUR);
    g.expoJournal([vol(true, RETOUR, ENVOI, [100, 0, 0], RETOUR * 1000 - 60e3)], RETOUR * 1000 - 60e3, 0);
    const e = g.S.expoLog[0];
    assert.ok(g.expoConnue(e));
    assert.equal(e.envoi, null);
    assert.equal(e.trouves, null);
    assert.equal(e.pertes, null);
    assert.deepEqual(e.retour.ships, ENVOI, 'les vaisseaux sont gardés tels quels');
  });

  t("faute d'aller vu, la composition préparée sert d'envoi", () => {
    const g = app(s => { FLOTTE(s); s.expoPrep = [{ de: '1:142:8', dest: '1:150:16', ships: ENVOI, at: JOUR - 60e3 }]; }, JOUR);
    g.expoJournal([vol(true, RETOUR, Object.assign({}, ENVOI, { cr: 1 }), [0, 0, 0], RETOUR * 1000 - 60e3)], RETOUR * 1000, 0);
    const e = g.S.expoLog[0];
    assert.equal(e.envoi.src, 'prep');
    assert.deepEqual(e.trouves, { cr: 1 });
  });

  t("un retard qui déplace l'heure du retour ne crée pas une deuxième expédition", () => {
    const g = app(FLOTTE, JOUR);
    g.expoJournal([vol(false, ALLER, ENVOI, [0, 0, 0]), vol(true, RETOUR, ENVOI, [0, 0, 0])], JOUR, 0);
    const tard = RETOUR + 3600;
    g.expoJournal([vol(true, tard, ENVOI, [0, 0, 0], tard * 1000 - 600e3)], tard * 1000 - 600e3, 0);
    assert.equal(g.S.expoLog.length, 1);
    assert.equal(g.S.expoLog[0].retour.at, tard * 1000);
  });

  t("une flotte qui ne revient pas une heure après l'heure prévue est perdue", () => {
    const g = app(FLOTTE, JOUR);
    g.expoJournal([vol(false, ALLER, ENVOI, [0, 0, 0])], JOUR, 0);
    const e = g.S.expoLog[0];
    const prevu = e.at;
    g.expoJournal([], prevu + 30 * 60e3, 0);
    assert.ok(!e.perdue, 'une demi-heure de retard ne suffit pas');
    g.expoJournal([], prevu + 61 * 60e3, 0);
    assert.ok(e.perdue, 'flotte perdue');
    assert.equal(e.evenement, 'perdue');
    assert.deepEqual(e.pertes, ENVOI, 'toute la flotte comptée en pertes');
  });

  t("un retour vu puis disparu de la liste des vols est une flotte perdue, pas un retour manqué", () => {
    const g = app(FLOTTE, JOUR);
    g.expoJournal([vol(false, ALLER, ENVOI, [0, 0, 0]), vol(true, RETOUR, ENVOI, [0, 0, 0])], JOUR, 0);
    const e = g.S.expoLog[0];
    // jamais relu ensuite, l'heure passe : on ne sait pas, on ne conclut pas
    g.expoJournal([], RETOUR * 1000 + 2 * 3600e3, 0);
    assert.ok(!e.perdue && !g.expoConnue(e), 'un retour simplement pas relu reste inconnu');
    // relu : la liste complète des vols, après l'événement, ne le montre plus
    const h = app(FLOTTE, JOUR);
    h.expoJournal([vol(false, ALLER, ENVOI, [0, 0, 0]), vol(true, RETOUR, ENVOI, [0, 0, 0])], JOUR, 0);
    const liste = RETOUR * 1000 - 300e3;
    h.expoJournal([], liste, liste);
    h.expoJournal([], RETOUR * 1000 + 2 * 3600e3, liste);
    assert.ok(h.S.expoLog[0].perdue, 'trou noir : le retour a disparu');
  });

  t("le rapport ouvert donne le type d'événement, un texte inconnu donne « autre »", () => {
    const g = app(FLOTTE, JOUR);
    g.expoJournal([vol(false, ALLER, ENVOI, [0, 0, 0])], JOUR, 0);
    g.expoJournal([vol(true, RETOUR, Object.assign({}, ENVOI, { bs: 30 }), [0, 0, 0], RETOUR * 1000 - 60e3)], RETOUR * 1000, 0);
    const e = g.S.expoLog[0];
    const evt = RETOUR * 1000 - 3000e3;
    assert.equal(g.expoMessages([{ id: '77', at: evt, coords: '1:150:16', texte: 'Votre flotte a été attaquée par des pirates.' }]), 1);
    assert.equal(e.evenement, 'pirates');
    // relu, le même message ne compte pas deux fois
    assert.equal(g.expoMessages([{ id: '77', at: evt, coords: '1:150:16', texte: 'pirates' }]), 0);
    assert.equal(g.expoEvtDe('Un texte que personne ne reconnaît'), 'autre');
    assert.equal(g.expoEvtDe("L'expédition s'est approchée trop près d'un trou noir"), 'trounoir');
    assert.equal(g.expoEvtDe('Votre expédition a rapporté 120.000 Métal collecté'), 'ressources');
    assert.equal(g.expoEvtDe('Votre expédition rentre avec du retard'), 'retard');
    // un autre système ne prend pas le rapport
    assert.equal(g.expoMessages([{ id: '78', at: evt, coords: '1:151:16', texte: 'pirates' }]), 0);
  });

  /** n expéditions connues, chacune avec ce que `f(i)` ramène. */
  const journal = (n, f, ships) => Array.from({ length: n }, (_, i) => ({
    cle: 'x' + i, at: JOUR - (n - i) * 3600e3, sys: '1:' + (100 + i % 5), de: '1:142:8', dest: '1:' + (100 + i % 5) + ':16',
    envoi: { ships: ships || ENVOI, at: 0, src: 'aller' },
    retour: { at: JOUR - (n - i) * 3600e3, ships: ships || ENVOI, cargo: f(i), lu: 0, final: true },
    cargaison: f(i), trouves: {}, pertes: {}, carburant: 1000, duree: 2 * 3600e3, evenement: 'ressources' }));

  t("les statistiques portent sur les cinquante dernières et l'affichent", () => {
    const g = app(s => { FLOTTE(s); s.expoLog = journal(60, () => [1000, 500, 0]); }, JOUR);
    const st = g.expoStats(g.S.expoLog);
    assert.equal(st.n, 50);
    assert.deepEqual(st.res, [1000, 500, 0]);
    // (1000 + 500×1,5 − 1000×3) / 2 h = −625 /h : le carburant compte
    assert.equal(Math.round(st.rendement), -625);
    assert.ok(st.parPlanete['1:142:8'], 'par planète de départ');
    assert.ok(Object.keys(st.parSollicitation).length, 'par sollicitation du système');
    assert.match(lu(g.expoStatsHtml()), /Sur <b>50 expéditions<\/b>/);
  });

  t('le rendement retire la valeur des pertes', () => {
    const g = app(s => { FLOTTE(s); s.expoLog = journal(1, () => [0, 0, 0]); s.expoLog[0].pertes = { bs: 10 }; s.expoLog[0].carburant = 0; }, JOUR);
    // 10 VB = 450 000 M + 150 000 C = 675 000 éq. métal, sur 2 h
    assert.equal(Math.round(g.expoStats(g.S.expoLog).rendement), -337500);
  });

  t('pas de proposition à neuf expéditions, une à la dixième', () => {
    // 200 GT + reste = 25 000 points env. ; 140 par point → 3,5 M ramenés
    const pts = 1 * 5 + 115 + 700 + 40 * 300 + 200 * 60;
    const g9 = app(s => { FLOTTE(s); s.expoLog = journal(9, () => [0, 140 * pts, 0]); }, JOUR);
    assert.equal(g9.expoFretPropose(g9.S.expoLog, 200).prop, null);
    assert.equal(g9.expoCalibHtml(), '');
    const g = app(s => { FLOTTE(s); s.expoLog = journal(10, () => [0, 140 * pts, 0]); }, JOUR);
    const p = g.expoFretPropose(g.S.expoLog, 200);
    assert.equal(p.prop, 140);
    assert.ok(p.montre);
    assert.match(lu(g.expoCalibHtml()), /Tes 10 dernières expéditions à ressources suggèrent un facteur de <b>140<\/b> \(réglage actuel : 200\)/);
    assert.equal(g.S.settings.expoFret, 200, 'rien ne change sans clic');
  });

  t('« Appliquer » met le réglage à la proposition, « Ignorer » masque la carte', () => {
    const pts = 1 * 5 + 115 + 700 + 40 * 300 + 200 * 60;
    const g = app(s => { FLOTTE(s); s.expoLog = journal(10, () => [0, 140 * pts, 0]); }, JOUR);
    const bouton = attr => ({ closest: sel => (sel === '[' + attr + ']' ? { dataset: { [attr === 'data-fretapply' ? 'fretapply' : 'fretignore']: '140' } } : null) });
    g.click('view', bouton('data-fretignore'));
    assert.equal(g.S.expo.fretIgnore, 140);
    assert.equal(g.S.settings.expoFret, 200, 'ignorer ne change pas le réglage');
    assert.equal(g.expoCalibHtml(), '', 'la carte se tait');
    g.click('view', bouton('data-fretapply'));
    assert.equal(g.S.settings.expoFret, 140, 'appliquer, si');
  });

  t("un écart de moins de dix pour cent ne propose rien, « Ignorer » tient jusqu'au prochain écart", () => {
    const pts = 1 * 5 + 115 + 700 + 40 * 300 + 200 * 60;
    const g = app(s => { FLOTTE(s); s.expoLog = journal(12, () => [0, 190 * pts, 0]); }, JOUR);
    assert.ok(!g.expoFretPropose(g.S.expoLog, 200).montre, '190 contre 200 : 5 %');
    const h = app(s => { FLOTTE(s); s.expoLog = journal(12, () => [0, 140 * pts, 0]); s.expo.fretIgnore = 145; }, JOUR);
    assert.ok(!h.expoFretPropose(h.S.expoLog, 200).montre, 'ignorée à 145 : 140 ne revient pas');
    h.S.expo.fretIgnore = 100;
    assert.ok(h.expoFretPropose(h.S.expoLog, 200).montre, 'ignorée à 100 : 140 revient');
  });

  t('la médiane, pas la moyenne : une trouvaille exceptionnelle ne déplace rien', () => {
    const pts = 1 * 5 + 115 + 700 + 40 * 300 + 200 * 60;
    const g = app(s => { FLOTTE(s); s.expoLog = journal(11, i => [0, (i === 5 ? 5000 : 140) * pts, 0]); }, JOUR);
    assert.equal(g.expoFretPropose(g.S.expoLog, 200).prop, 140);
  });

  t('des soutes pleines la plupart du temps : la carte parle de borne basse', () => {
    const ships = { pr: 1, lc: 10 };
    const g = app(s => { FLOTTE(s); s.expoLog = journal(10, () => [0, 0, 0], ships); }, JOUR);
    const plein = 10 * 25000 * 1.25 * 1; // soute effective des GT, collecteur, sans hyper
    g.S.expoLog.forEach(e => { e.cargaison = [plein, 0, 0]; e.retour.cargo = e.cargaison; });
    const p = g.expoFretPropose(g.S.expoLog, 200);
    assert.ok(p.pleines, JSON.stringify(p));
    assert.match(lu(g.expoCalibHtml()), /borne basse/);
  });

  t("l'historique garde les deux cents dernières", () => {
    const g = app(s => { FLOTTE(s); s.expoLog = journal(200, () => [1, 0, 0]); }, JOUR);
    const plusVieille = g.S.expoLog[0].cle;
    g.expoJournal([vol(true, RETOUR, ENVOI, [0, 0, 0])], JOUR, 0);
    assert.equal(g.S.expoLog.length, 200);
    assert.ok(!g.S.expoLog.some(e => e.cle === plusVieille), 'la plus ancienne disparaît');
  });

  t('le malus de système compte toujours les nouvelles entrées', () => {
    const g = app(FLOTTE, JOUR);
    for (let i = 0; i < 3; i++) g.expoJournal([vol(false, ALLER + i * 60, ENVOI, [0, 0, 0]), vol(true, RETOUR + i * 60, ENVOI, [0, 0, 0])].map(m => Object.assign(m, { origin: '1:142:' + (6 + i) })), JOUR, 0);
    assert.equal(g.S.expoLog.length, 3);
    assert.equal(g.expoVus('1:150', JOUR), 3);
  });

  t("une entrée abîmée d'une sauvegarde ne casse pas les statistiques", () => {
    const g = app(s => { FLOTTE(s); s.expoLog = journal(3, () => [1, 0, 0]); s.expoLog[0].envoi = 'cassé'; s.expoLog[1].retour.ships = { zz: 4, lc: 'x' }; s.expoLog[2].evenement = '<b>'; }, JOUR);
    assert.equal(g.S.expoLog[0].envoi, null);
    assert.deepEqual(g.S.expoLog[1].retour.ships, {});
    assert.equal(g.S.expoLog[2].evenement, 'autre');
    assert.doesNotThrow(() => g.expoStatsHtml());
  });

  t('la page Messagerie publie les rapports d\'expédition, et rien d\'autre', () => {
    const HEURE_SRV = { epoch: 1794988642, horloge: '18.11.2026 08:57:22', arrivees: [] };
    const r = runPage({ skin: null, search: '?page=ingame&component=messages', heures: HEURE_SRV, msgsJeu: [
      { id: 'msg-901', titre: "Résultat de l'expédition [1:150:16]", date: '18.11.2026 08:50:00', texte: 'Des pirates ont attaqué.' },
      { id: '902', titre: 'Rapport d\'espionnage de Truc [1:150:8]', date: '18.11.2026 08:51:00', texte: 'Métal 1000' }] });
    const snap = r.envois().find(m => m.type === 'snapshot').data;
    assert.equal(snap.expoMsgs.length, 1, JSON.stringify(snap.expoMsgs));
    assert.equal(snap.expoMsgs[0].id, '901');
    assert.equal(snap.expoMsgs[0].coords, '1:150:16');
    // 08:50:00 au serveur à UTC+1 : 07:50:00 UTC
    assert.equal(snap.expoMsgs[0].at, Date.UTC(2026, 10, 18, 7, 50, 0));
    assert.ok(/pirates/.test(snap.expoMsgs[0].texte));
    const ailleurs = runPage({ skin: null, search: '?page=ingame&component=overview', heures: HEURE_SRV });
    assert.equal(ailleurs.envois().find(m => m.type === 'snapshot').data.expoMsgs, null, 'hors messagerie, rien n\'est lu');
  });

  t('sans Astrophysique, le bloc le dit au lieu de proposer', () => {
    const g = app(s => { FLOTTE(s); s.tech.astro = 0; s.slots = null; }, JOUR);
    const h = lu(g.expoHtml().html);
    assert.match(h, /Astrophysique 1/, h);
    assert.ok(!/data-prep=/.test(h), 'et ne propose rien');
  });

  /* ---------- une seule place pour l'expédition ---------- */

  t("la carte d'expédition ne se dessine plus dans la liste des actions", () => {
    // Elle a son bloc, qui la compte, la compose et la prépare. Dans la liste
    // d'à côté, elle se lisait deux fois — et parfois avec deux planètes.
    const g = app(FLOTTE, JOUR);
    g.REFRESH.today();
    const now = lu(g.html().tdNow || '');
    assert.ok(!/Expédition\s*:/.test(now), 'la liste des actions se tait : ' + now.slice(0, 400));
    assert.match(lu(g.html().expoBloc || ''), /data-prep=/, 'et le bloc, lui, propose');
  });

  t("le plan garde l'expédition dans son modèle, et la page du jeu la porte", () => {
    // Invisible dans le panneau ne veut pas dire oubliée : le plan lui réserve
    // son deutérium et sort ses vaisseaux, et c'est sur l'écran de flotte du jeu
    // que la ligne sert encore.
    const g = app(FLOTTE, JOUR);
    const s0 = g.simulateDay().sessions[0];
    const exp = s0.acts.filter(a => a.kind === 'expo');
    assert.ok(exp.length, 'le plan la simule toujours');
    assert.ok(exp[0].cost[2] > 0, 'et lui réserve son carburant : ' + JSON.stringify(exp[0].cost));
    assert.ok(!g.actsVus(s0).some(a => a.kind === 'expo'), 'mais le panneau ne la dessine pas');
    const col = g.colonneData(s0.acts, [], []);
    assert.ok(col.some(x => /Expédition/.test(x.what)), 'la colonne du jeu la garde : ' +
      col.map(x => x.what).join(' | '));
  });

  t("« Lancé » du bloc porte la planète, la flotte, le carburant et la durée", () => {
    const g = app(FLOTTE, JOUR);
    const h = lu(g.expoHtml().html);
    const m = h.match(/data-launch='([^']+)'/);
    assert.ok(m, 'le bouton existe : ' + h.slice(0, 500));
    const a = JSON.parse(lu(m[1]));
    assert.equal(a.kind, 'expo');
    assert.ok(a.pid, 'une planète identifiée');
    assert.ok(a.ships && Object.keys(a.ships).length, 'la flotte');
    assert.ok(a.cost[2] > 0 && a.cost[0] === 0, 'le carburant, et rien d\'autre : ' + JSON.stringify(a.cost));
    assert.ok(a.dur > 3600, 'la durée couvre le vol et le stationnement : ' + a.dur);
  });

  t('une expédition lancée ne se repropose pas avec les mêmes vaisseaux', () => {
    // Le minuteur du « Lancé » porte sa flotte : sans la déduire, le bloc
    // renvoyait les mêmes transporteurs sur l'emplacement d'après.
    const g = app(s => {
      FLOTTE(s);
      s.slots = { fleet: [1, 9], expo: [1, 3], at: JOUR };
      s.timers = [{ id: 'x1', manual: true, at: JOUR, end: JOUR + 4 * 3600e3, done: false,
        kind: 'x', k: 'expo', pid: 'mere', ships: { lc: 190, rp: 3, pf: 2 },
        label: "Retour d'expédition" }];
    }, JOUR);
    const sol = g.expoAuSol(JOUR);
    assert.equal(sol[0].lc, 10, 'dix grands transporteurs restent au sol : ' + sol[0].lc);
    assert.ok(!sol[0].rp && !sol[0].pf, 'et plus de faucheur ni d\'éclaireur : ' + JSON.stringify(sol[0]));
    const prop = g.expoPropose(JOUR, 2);
    assert.ok(prop.every(x => (x.f.ships.lc || 0) <= 10),
      'aucune proposition ne rengage les vaisseaux partis : ' + JSON.stringify(prop.map(x => x.f.ships)));
  });

  t('emplacements de flotte pleins : le bloc ne propose rien et dit pourquoi', () => {
    // Proposer un « Préparer » que le jeu refusera, c'est envoyer cliquer sur rien.
    const g = app(s => { FLOTTE(s); s.slots = { fleet: [9, 9], expo: [0, 3], at: JOUR }; }, JOUR);
    const e = g.expoEtat(JOUR);
    assert.equal(e.libres, 3, 'les emplacements d\'expédition sont bien libres');
    assert.equal(e.lancables, 0, 'mais rien ne peut partir');
    const h = lu(g.expoHtml().html);
    assert.match(h, /Emplacements de flotte pleins \(9\/9\)/, h.slice(0, 400));
    assert.ok(!/data-prep=/.test(h), 'et aucune recommandation : ' + h.slice(0, 400));
  });

  t("une connexion dont la seule action était une expédition ne se compte plus", () => {
    // Le résumé annonçait « N connexions avec quelque chose à lancer » en comptant
    // une carte que la liste ne montre plus.
    const g = app(FLOTTE, JOUR);
    // le seul endroit où se décide ce que le panneau dessine
    assert.deepEqual(g.actsVus({ acts: [{ kind: 'expo' }, { kind: 'b' }, { kind: 't' }] }).map(a => a.kind),
      ['b', 't'], "actsVus laisse tout passer sauf l'expédition");
    const j = g.simulateDay();
    assert.ok(j.sessions.some(x => x.acts.some(a => a.kind === 'expo')),
      'la journée simulée en contient bien');
    assert.ok(!j.sessions.some(x => g.actsVus(x).some(a => a.kind === 'expo')),
      'et aucune connexion n\'en dessine');
  });

  t('un rapatriement porte sa destination et sa charge', () => {
    const g = app(s => {
      const c = s.planets[1];
      c.b = Object.assign({}, c.b, { metal: 14, crystal: 12, solar: 18, shipyard: 2 });
      c.ships = { lc: 10 };
      c.stock = { m: 90000, c: 60000, d: 9000, at: JOUR };
    }, JOUR);
    const r = g.simulateDay().sessions[0].acts.find(a => a.kind === 'transfer' && a.res);
    assert.ok(r, 'un rapatriement chargé est proposé');
    assert.ok(/^\d+:\d+:\d+$/.test(r.dest || ''), 'vers des coordonnées : ' + r.dest);
    assert.ok(r.res[0] > 0, 'avec le métal à saisir : ' + JSON.stringify(r.res));
  });

  t('les pastilles donnent ce qu\'il faut retaper, découpé comme les champs du jeu', () => {
    const h = app().copyChips({ ships: { sc: 21 }, dest: '1:79:16', res: [4200, 0, 0] });
    assert.ok(/data-copy="21"/.test(h), 'le nombre de vaisseaux : ' + h);
    // Le jeu a trois champs de coordonnées : une pastille par champ, sinon le
    // collage ne tombe pas dans le bon.
    assert.ok(/data-copy="1"/.test(h), 'la galaxie : ' + h);
    assert.ok(/data-copy="79"/.test(h), 'le système : ' + h);
    assert.ok(/data-copy="16"/.test(h), 'la position : ' + h);
    assert.ok(/data-copy="4200"/.test(h), 'le métal, en chiffres bruts : ' + h);
    assert.ok(!/4 200|4 200/.test(h), 'jamais d\'espace dans une valeur à coller : ' + h);
  });

  t('rien à recopier pour un bâtiment : pas de pastille', () => {
    assert.equal(app().copyChips({ kind: 'b', k: 'metal', lvl: 20, cost: [1, 2, 3] }), '');
  });

  t('une pastille s\'annonce comme un bouton qui copie', () => {
    // Posées à côté des étiquettes de planète, qui ne cliquent pas, les
    // pastilles passaient pour de simples libellés : le joueur ne savait pas
    // qu'elles étaient cliquables.
    const h = app().copyChips({ res: [0, 0, 8957] });
    assert.ok(/aria-label="Copier 8957"/.test(h), 'elle dit ce qu\'elle fait : ' + h);
    assert.ok(/⧉/.test(h), 'et le montre à l\'œil : ' + h);
  });

  t('les pastilles ont leur propre ligne, annoncée', () => {
    // Mêlées au gris des métadonnées, elles passaient pour des libellés. Une
    // ligne à elles, avec son intitulé, dit ce qu'on peut en faire.
    const h = app().copyChips({ res: [0, 0, 8957] });
    assert.ok(/class="cp"/.test(h), 'une ligne à part : ' + h);
    assert.ok(/À recopier/.test(h), 'qui s\'annonce : ' + h);
  });

  /* ---------- les expéditions en vol se lisent dans le jeu ---------- */

  /* Les actions du passage en cours. La lecture « Expéditions 2/2 » ne vaut que
     trois heures : plus tard dans la journée simulée, le plan reprend la main et
     propose à nouveau — c'est voulu. La carte qui ment est celle de maintenant. */
  const actes = g => g.simulateDay().sessions[0].acts;

  t('deux expéditions en vol lues dans le jeu : aucune carte d\'expédition', () => {
    const g = app(s => {
      s.planets[0].ships = { lc: 30 };
      s.slots = { expo: [2, 2], fleet: [2, 9], at: SOIR };
      s.syncAt = SOIR;
      s.tech.astro = 4;
    }, SOIR);
    assert.ok(!actes(g).some(a => a.kind === 'expo'), 'le plan ne propose aucune expédition');
  });

  t('le compte lu est rendu tel quel quand le plafond a baissé', () => {
    const g = app(s => {
      s.planets[0].ships = { lc: 30 };
      s.slots = { expo: [5, 2], fleet: [5, 9], at: SOIR };
      s.syncAt = SOIR;
      s.tech.astro = 4;
    }, SOIR);
    assert.equal(g.expoInFlight().n, 5);
    assert.ok(!actes(g).some(a => a.kind === 'expo'), 'et le plan se tait quand même');
  });

  /* Avant la 1.25, `slots` était enregistré sans heure de lecture. Se rabattre
     sur `syncAt`, qui avance à chaque synchronisation, rendrait ce chiffre
     éternellement frais : le panneau se tairait sur les expéditions jusqu'à la
     prochaine ouverture de la page de flotte. */
  t('un réglage enregistré avant la 1.25 ne fige pas le compte', () => {
    const g = app(s => { s.slots = { expo: [2, 2], fleet: [2, 9] }; s.syncAt = SOIR; }, SOIR);
    assert.equal(g.expoInFlight(), null, 'sans heure de lecture, on ne compte pas');
  });

  /* Le chiffre vient d'une expression régulière sur le texte d'une page du jeu,
     où des chaînes écrites par d'autres joueurs s'affichent. Un nombre absurde y
     arriverait tôt ou tard ; il sert de borne de boucle, donc il se borne. */
  t('un compte absurde est ramené à une borne tenable', () => {
    const g = app(s => { s.slots = { expo: [1e9, 2], fleet: [1, 9], at: SOIR }; s.syncAt = SOIR; }, SOIR);
    assert.ok(g.expoInFlight().n <= 32, 'borné : ' + g.expoInFlight().n);
  });

  t('un compte illisible vaut zéro, pas NaN', () => {
    const g = app(s => { s.slots = { expo: ['beaucoup', 2], fleet: [1, 9], at: SOIR }; s.syncAt = SOIR; }, SOIR);
    assert.equal(g.expoInFlight().n, 0);
  });

  t('sans lecture de la page de flotte, les expéditions restent proposées', () => {
    const g = app(s => { s.planets[0].ships = { lc: 30 }; s.tech.astro = 4; delete s.slots; }, SOIR);
    assert.equal(g.expoInFlight(), null, 'rien de lu');
    assert.ok(actes(g).some(a => a.kind === 'expo'), 'le plan propose quand même');
  });

  t('une lecture de plus de trois heures ne compte plus', () => {
    const vieux = SOIR - 4 * 3600e3;
    const g = app(s => { s.slots = { expo: [2, 2], fleet: [2, 9], at: vieux }; s.syncAt = vieux; }, SOIR);
    assert.equal(g.expoInFlight(), null, 'la lecture est périmée');
  });

  t('les expéditions reviennent quand la lecture a expiré', () => {
    const g = app(s => {
      s.planets[0].ships = { lc: 30 };
      s.slots = { expo: [2, 2], fleet: [0, 9], at: SOIR - 4 * 3600e3 };
      s.syncAt = SOIR - 4 * 3600e3;
      s.tech.astro = 4;
    }, SOIR);
    assert.ok(actes(g).some(a => a.kind === 'expo'), 'le plan reprend la main');
  });

  t('la carte des expéditions dit à quelle heure le chiffre a été lu', () => {
    // assez de transporteurs pour remplir plus d'expéditions que le plafond :
    // c'est ce qui fait sortir la carte qui porte la provenance du chiffre
    const g = app(s => {
      s.planets[0].ships = { lc: 400 };
      s.slots = { expo: [1, 1], fleet: [1, 9], at: SOIR };
      s.syncAt = SOIR;
    }, SOIR);
    const c = g.dailyMissions().find(m => m.id === 'expomax');
    assert.ok(c, 'la carte du plafond d\'expéditions sort');
    assert.ok(/lu dans le jeu à \d/.test(c.why), 'elle porte l\'heure de la lecture : ' + c.why);
  });
};
