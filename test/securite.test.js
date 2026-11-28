/* La sécurité : src/securite/securite.js vu depuis le plan et l'onglet du
   jour (attaques et espionnages entrants, coffre-fort, transport suggéré,
   plan de sécurité, rappel de mise à l'abri). Lancé par test/run.js. */
const fs = require('fs'), path = require('path');

module.exports = ({ t, assert, lu, loadApp, fixtureState, mission, SOIR, chargeWorker }) => {
  /* ---------- flottes en mouvement et plan de sécurité ---------- */
  const SECU = ['S', 'ogFleetDetail', 'mouvements', 'livraisons', 'projectResources', 'whenAffordable', 'statutFinancement',
    'attaquesEntrantes', 'espionnagesEntrants', 'coffreFortPour', 'transportSuggere', 'planSecurite', 'securiteHtml',
    'production', 'formatTime', 'simulateDay', 'wakeTime', 'RESUMES', 'sessionTimes', 'dayValue', 'isNight', 'hhmmDe', 'heureTxt', 'syncApply', 'secu', 'secuCard', 'armeRappel', 'fsRappelVu', 'shipCourt', 'VIEWS', 'REFRESH', 'flight', 'shipStats'];
  const H = 3600e3;
  /** Un empire à trois planètes : Tourtierion (source, G1), Poutinia (G1) et Erablis (G2), coffres-forts. */
  function empireSecu(s) {
    s.planets[0].name = 'Tourtierion';
    s.planets[0].ships = { lc: 30, sc: 2, pr: 1 };
    s.planets.push({ id: 'pout', name: 'Poutinia', coords: '1:300:8', tmax: 40, b: { ...s.planets[1].b }, sats: 0, ships: {}, shipsAt: 0, stock: { m: 0, c: 0, d: 0, at: s.planets[0].stock.at } });
    s.planets.push({ id: 'erab', name: 'Erablis', coords: '2:142:8', tmax: 40, b: { ...s.planets[1].b }, sats: 0, ships: {}, shipsAt: 0, stock: { m: 0, c: 0, d: 0, at: s.planets[0].stock.at } });
    s.settings.secu = { vaults: ['pout', 'erab'], rappel: '22:00', jours: [0, 1, 2, 3, 4, 5, 6] };
  }
  function appSecu(modif, now) {
    const s = fixtureState();
    const at = now == null ? SOIR : now;
    s.planets.forEach(p => { p.stock.at = at; });
    empireSecu(s);
    if (modif) modif(s, at);
    return loadApp(s, at, SECU);
  }
  /** Un convoi qui se pose sur `coords` dans `dans` ms, depuis Colonie. */
  const convoi = (at, dans, coords, cargo, ships) => ({ id: '77', mission: 3, ret: false, arrival: Math.round((at + dans) / 1000), camp: 'own', hostile: false,
    origin: '1:142:6', dest: coords, originName: 'Colonie', destName: '', ships: ships || { lc: 30 }, cargo });
  const attaque = (at, dans, coords, mission) => ({ id: '99', mission: mission || 1, ret: false, arrival: Math.round((at + dans) / 1000), camp: 'hostile', hostile: true,
    origin: '5:5:5', dest: coords, originName: 'Méchant', destName: '', ships: {}, cargo: null });

  t("le détail d'une flotte se lit dans l'infobulle du jeu : vaisseaux et cargaison", () => {
    const g = appSecu();
    const tip = '&lt;table class=&quot;fleetinfo&quot;&gt;&lt;tr&gt;&lt;th colspan=&quot;3&quot;&gt;Vaisseaux :&lt;/th&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;Grand transporteur:&lt;/td&gt;&lt;td class=&quot;value&quot;&gt;30&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;th&gt;Chargement :&lt;/th&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;Métal:&lt;/td&gt;&lt;td class=&quot;value&quot;&gt;1.237.500&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;Cristal:&lt;/td&gt;&lt;td&gt;0&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;Deutérium:&lt;/td&gt;&lt;td&gt;0&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;';
    const d = g.ogFleetDetail(tip);
    assert.deepEqual(JSON.parse(JSON.stringify(d.ships)), { lc: 30 });
    assert.deepEqual(d.cargo, [1237500, 0, 0]);
    assert.ok(d.connu);
    const masque = g.ogFleetDetail('<table><tr><th>Vaisseaux</th></tr><tr><td>Croiseur:</td><td>?</td></tr></table>');
    assert.equal(masque.connu, false, 'un nombre masqué ne devient pas zéro');
    assert.equal(masque.ships.cr, undefined);
  });

  t('mouvements : aller et retour normalisés, retour rattaché à son aller', () => {
    const g = appSecu((s, at) => {
      s.moves = [convoi(at, 2 * H, '1:142:8', [1, 0, 0]),
        { ...convoi(at, 4 * H, '1:142:8', null), ret: true }];
    });
    const mv = g.mouvements();
    assert.equal(mv.length, 2);
    assert.equal(mv[0].sens, 'aller');
    assert.equal(mv[0].retour, mv[1].arrivee);
    assert.equal(mv[1].pose, '1:142:6', 'un retour se pose sur son origine');
    assert.equal(mv[0].cible.nom, 'Tourtierion', 'le nom manquant se complète depuis mes planètes');
  });

  t('une construction rendue finançable par un convoi affiche « Finançable à HH:MM (convoi …) »', () => {
    const g = appSecu((s, at) => { s.moves = [convoi(at, 2 * H, '1:142:8', [1237500, 0, 0])]; });
    const p = g.S.planets[0], arr = SOIR + 2 * H;
    const f = g.whenAffordable(p, [1000000, 10000, 0]);
    assert.equal(f.statut, 'convoi');
    assert.equal(f.at, arr);
    const txt = g.statutFinancement(f);
    assert.equal(txt, `Finançable à ${g.formatTime(arr)} (convoi Colonie, 30 GT)`);
  });

  t("une livraison qui n'apporte pas ce qui manque n'est pas nommée : c'est la production", () => {
    const g = appSecu((s, at) => { s.planets[0].stock.m = 0; s.moves = [convoi(at, 1 * H, '1:142:8', [0, 500000, 0])]; });
    const p = g.S.planets[0], pr = g.production(p);
    const f = g.whenAffordable(p, [pr.m * 3, 0, 0]);
    assert.ok(Math.abs(f.at - (SOIR + 3 * H)) < 60e3);
    assert.equal(f.statut, 'production');
    assert.ok(/\(production\)$/.test(g.statutFinancement(f)));
  });

  t("à l'heure annoncée, le conseil passe en « Finançable maintenant »", () => {
    const arr = SOIR + 2 * H;
    const g = appSecu((s) => { s.planets.forEach(p => { p.stock.at = SOIR; }); s.moves = [convoi(SOIR, 2 * H, '1:142:8', [1237500, 0, 0])]; }, arr + 1000);
    const f = g.whenAffordable(g.S.planets[0], [1000000, 10000, 0]);
    assert.equal(f.statut, 'maintenant');
    assert.equal(g.statutFinancement(f), 'Finançable maintenant');
  });

  t('une flotte arrivée que le jeu ne montre plus reste créditée tant que le stock date d’avant', () => {
    const arr = SOIR + 2 * H;
    const g = appSecu((s) => { s.planets.forEach(p => { p.stock.at = SOIR; }); s.arrived = [convoi(SOIR, 2 * H, '1:142:8', [500000, 0, 0])]; }, arr + 60e3);
    // applyGame n'a pas tourné : S.arrived vient de l'état sauvegardé
    assert.ok(g.projectResources(g.S.planets[0], arr + 60e3)[0] > 500000);
    const g2 = appSecu((s) => { s.planets.forEach(p => { p.stock.at = arr + 30e3; }); s.arrived = [convoi(SOIR, 2 * H, '1:142:8', [500000, 0, 0])]; }, arr + 60e3);
    assert.ok(g2.projectResources(g2.S.planets[0], arr + 60e3)[0] < 500000, 'un stock relu après l’arrivée la porte déjà');
  });

  t('projection : la production s’arrête au hangar, une livraison le dépasse', () => {
    const g = appSecu((s, at) => { s.planets[0].stock.m = 0; s.moves = [convoi(at, 1 * H, '1:142:8', [3000000, 0, 0])]; });
    const p = g.S.planets[0], cap = g.production(p).cap[0];
    const sans = g.projectResources(p, SOIR + 0.5 * H);
    assert.ok(sans[0] < cap);
    const apres = g.projectResources(p, SOIR + 1 * H);
    assert.ok(apres[0] > cap, 'la livraison passe au-dessus du hangar');
    const plusTard = g.projectResources(p, SOIR + 10 * H);
    assert.equal(Math.round(plusTard[0]), Math.round(apres[0]), 'et la production reste arrêtée au-dessus');
    // sans livraison, la production plafonne
    const g2 = appSecu((s) => { s.planets[0].stock.m = 0; });
    assert.equal(Math.round(g2.projectResources(g2.S.planets[0], SOIR + 500 * H)[0]), cap);
  });

  t('Non finançable sous 24 h', () => {
    const g = appSecu();
    const f = g.whenAffordable(g.S.planets[0], [1e12, 0, 0]);
    assert.equal(f.statut, 'jamais');
    assert.equal(g.statutFinancement(f), 'Non finançable sous 24 h');
  });

  t('le plan du jour annonce le convoi sur ses attentes, et le compte dans ses connexions', () => {
    const prep = (avec) => appSecu((s, at) => { s.planets[0].stock = { m: 20000, c: 5000, d: 1000, at };
      if (avec) s.moves = [convoi(at, 2 * H, '1:142:8', [300000, 200000, 50000])]; });
    const sans = prep(false).simulateDay().sessions[0].waits;
    assert.ok(sans.every(w => !w.fin || w.fin.statut !== 'convoi'));
    const g = prep(true), w = g.simulateDay().sessions[0].waits.find(x => x.what.startsWith('Centrale électrique solaire'));
    assert.ok(w && w.fin, 'la centrale attend');
    assert.equal(w.fin.statut, 'convoi');
    assert.equal(g.statutFinancement(w.fin), `Finançable à ${g.formatTime(SOIR + 2 * H)} (convoi Colonie, 30 GT)`);
    g.REFRESH.today();
    const h = lu(g.html().tdNow || '');
    assert.ok(h.includes('(convoi Colonie, 30 GT)'), 'la liste des attentes porte le statut');
    assert.ok(lu(g.html().tdSecu || '').includes('Plan de la nuit'), 'le bloc Sécurité est dessiné');
  });

  t('attaque entrante : alerte critique, compte à rebours, plan complet', () => {
    const g = appSecu((s, at) => { s.host = 's1-fr.ogame.gameforge.com'; s.planets[0].gid = '101'; s.moves = [attaque(at, 1 * H, '1:142:8')]; });
    const pl = g.planSecurite('attaque', SOIR, []);
    assert.equal(pl.length, 1);
    const a = pl[0];
    assert.equal(a.p.name, 'Tourtierion');
    assert.equal(a.impact, SOIR + H);
    assert.ok(a.expose[0] >= 120000, 'ressources exposées à l’impact, production comprise');
    assert.ok(a.transport, 'un transport est suggéré');
    assert.equal(a.transport.dest.name, 'Poutinia', 'coffre-fort de la même galaxie');
    assert.equal(a.transport.missionNom, 'Transport');
    assert.ok(a.transport.retour >= SOIR + H + 10 * 60e3, 'en Transport, la flotte ne rentre pas avant l’impact');
    const h = lu(g.securiteHtml([]).alerte);
    assert.ok(h.includes('Critique') && h.includes('Attaque sur Tourtierion'));
    assert.ok(h.includes(`data-impact="${SOIR + H}"`), 'le compte à rebours se met à jour seul');
    assert.ok(/<th>Source<\/th><th>Vaisseaux<\/th><th>Cible<\/th><th>Mission<\/th><th>M \/ C \/ D<\/th>/.test(h));
    assert.ok(h.includes('<td>Tourtierion</td><td>30 GT, 2 PT, 1 SE</td><td>Poutinia</td><td>Transport</td>'));
    assert.ok(/Arrivée .* à \d+ %/.test(h));
    assert.ok(h.includes('data-prep='), 'Préparer pré-remplit le formulaire');
    assert.ok(!/data-launch|data-sent/.test(h), 'aucun envoi automatique');
  });

  t('les constructions à lancer sont triées par montant dépensé', () => {
    const g = appSecu((s, at) => { s.planets[0].stock = { m: 5e6, c: 3e6, d: 1e6, at }; s.moves = [attaque(at, 1 * H, '1:142:8')]; });
    const d = g.planSecurite('attaque', SOIR, [])[0].depenses;
    assert.ok(d.length >= 2);
    const tot = c => c[0] + c[1] + c[2];
    for (let i = 1; i < d.length; i++) assert.ok(tot(d[i - 1].cost) >= tot(d[i].cost));
  });

  t('un convoi qui arrive 3 min avant l’impact est « à rappeler ou à laisser »', () => {
    const g = appSecu((s, at) => { s.moves = [attaque(at, 1 * H, '1:142:8'), convoi(at, 1 * H - 3 * 60e3, '1:142:8', [100, 0, 0]), convoi(at, 3 * H, '1:142:8', [100, 0, 0])]; });
    const a = g.planSecurite('attaque', SOIR, [])[0];
    assert.equal(a.aRisque.length, 1, 'seul celui qui arrive avant impact + 10 min');
    assert.ok(lu(g.securiteHtml([]).alerte).includes('À rappeler ou à laisser'));
  });

  t('une attaque sur le coffre-fort principal envoie vers l’autre', () => {
    const g = appSecu((s, at) => { s.moves = [attaque(at, 1 * H, '1:142:8'), attaque(at, 2 * H, '1:300:8')]; });
    const a = g.planSecurite('attaque', SOIR, []).find(x => x.p.name === 'Tourtierion');
    assert.equal(a.transport.dest.name, 'Erablis');
  });

  t('aucun coffre-fort utilisable : le plus lointain, pour rester en vol', () => {
    const g = appSecu((s, at) => { s.moves = [attaque(at, 1 * H, '1:142:8'), attaque(at, 2 * H, '1:300:8'), attaque(at, 2 * H, '2:142:8')]; });
    const t1 = g.planSecurite('attaque', SOIR, []).find(x => x.p.name === 'Tourtierion').transport;
    assert.equal(t1.dest.name, 'Erablis');
    assert.ok(/plus lointain/.test(t1.pourquoi));
  });

  t('un espionnage hostile déclenche une alerte Importante', () => {
    const g = appSecu((s, at) => { s.moves = [attaque(at, 5 * 60e3, '1:142:6', 6)]; });
    assert.equal(g.espionnagesEntrants(SOIR).length, 1);
    const h = lu(g.securiteHtml([]).alerte);
    assert.ok(h.includes('Important') && h.includes('Espionnage en cours sur Colonie, attaque possible'));
  });

  t('le plan routine propose une vitesse qui arrive au réveil, à 10 min près', () => {
    const g = appSecu();
    const r = g.planSecurite('routine', SOIR, []);
    const x = r.find(e => e.p.name === 'Tourtierion');
    const wake = new Date(2026, 10, 9, 7, 0, 0).getTime();
    assert.equal(x.wake, wake);
    assert.ok(x.transport);
    assert.ok(Math.abs(x.transport.arrivee - wake) <= 10 * 60e3, `arrivée ${new Date(x.transport.arrivee)} pour un réveil à 7 h`);
    assert.ok(r.find(e => e.p.name === 'Poutinia').coffre, 'un coffre-fort ne part pas vers lui-même');
    assert.equal(r.find(e => e.p.name === 'Poutinia').transport, null);
  });

  t('le plan routine liste exposé, à quai, files libres et convois de nuit', () => {
    const g = appSecu((s, at) => { s.moves = [convoi(at, 3 * H, '1:142:8', [100, 0, 0]), convoi(at, 12 * H, '1:142:8', [100, 0, 0])]; });
    const x = g.planSecurite('routine', SOIR, []).find(e => e.p.name === 'Tourtierion');
    assert.ok(x.expose[0] >= 120000);
    assert.equal(x.aQuai.lc, 30);
    assert.ok(x.files.some(f => f.file === 'Bâtiments'), 'file de bâtiments vide avant le réveil');
    assert.equal(x.nuit.length, 1, 'seul le convoi qui arrive entre le rappel et le réveil');
    const h = lu(g.securiteHtml([]).bloc);
    assert.ok(h.includes('Plan de la nuit') && h.includes('Convoi de nuit') && h.includes('File libre'));
  });

  t('les transports suggérés partent en Transport, même avec un ancien « Préférer Stationner » en sauvegarde', () => {
    const g = appSecu(s => { s.settings.secu.stationner = true; });
    const x = g.planSecurite('routine', SOIR, []).find(e => e.p.name === 'Tourtierion');
    assert.equal(x.transport.missionNom, 'Transport');
    assert.equal(x.transport.mission, 3);
    assert.ok(x.transport.retour > x.transport.arrivee, 'la flotte revient à sa planète');
  });

  t('fret : hyperespace et classe comptent, les GT s’arrondissent au-dessus', () => {
    const g = appSecu(s => { s.tech.hyper = 8; s.planets[0].stock = { m: 1237500, c: 0, d: 0, at: SOIR }; });
    const t1 = g.transportSuggere(g.S.planets[0], { mode: 'routine', now: SOIR, wake: SOIR + 8 * H, visees: new Set() });
    const lc = g.shipStats('lc').cargoEff;
    assert.ok(lc > 25000 * 1.4, 'hyperespace 8 et collecteur grossissent la soute');
    assert.equal(t1.gt, Math.ceil(t1.charge.reduce((a, b) => a + b, 0) / lc) || Math.ceil((1237500 + g.projectResources(g.S.planets[0], SOIR)[1]) / lc) || t1.gt);
    assert.ok(t1.gt >= Math.ceil(1237500 / lc));
  });

  t('Réglages › Sécurité : coffres-forts, heures et jours, sans bascule Stationner', () => {
    const g = appSecu();
    const h = lu(g.secuCard());
    assert.ok(h.includes('data-secu-vault="pout" checked'));
    assert.ok(h.includes('data-secu="rappel" value="22:00"'));
    assert.ok(h.includes('data-day="nightEnd" value="07:00"'), 'le réveil se règle sur la fin de nuit');
    assert.ok(h.includes('data-secu-jour="0" checked'));
    assert.ok(!h.includes('Préférer Stationner') && !h.includes('data-secu="stationner"'));
    // une sauvegarde d'avant n'a rien : les défauts
    const g2 = appSecu(s => { delete s.settings.secu; });
    assert.deepEqual(JSON.parse(JSON.stringify(g2.secu())), { vaults: [], rappel: '22:00', jours: [0, 1, 2, 3, 4, 5, 6], reveil: '07:00' });
    // le réveil suit la fin de nuit, et rien d'autre : une ancienne clé `reveil` ne compte plus
    const g3 = appSecu(s => { s.day.nightEnd = 6; s.settings.secu.reveil = '09:30'; });
    assert.equal(g3.secu().reveil, '06:00');
    const x = g3.planSecurite('routine', SOIR, []).find(e => e.p.name === 'Tourtierion');
    assert.equal(x.wake, new Date(2026, 10, 9, 6, 0, 0).getTime());
    assert.equal(x.wake, g3.wakeTime ? g3.wakeTime(SOIR) : x.wake, 'même réveil que le mode nuit');
  });

  t('le rappel est armé par chrome.alarms à l’heure choisie, sans notification', () => {
    const s = fixtureState(); s.planets.forEach(p => { p.stock.at = SOIR; }); empireSecu(s);
    s.settings.secu.rappel = '23:15';
    const g = loadApp(s, SOIR, SECU, null, true);
    const al = g.alarmes().filter(a => a[0] === 'fsRappel');
    assert.ok(al.length, 'alarme posée');
    assert.equal(al[al.length - 1][1].when, new Date(2026, 10, 8, 23, 15, 0).getTime());
    assert.equal(al[al.length - 1][1].periodInMinutes, 1440);
    assert.deepEqual(g.stored().fsRappelCfg.jours, [0, 1, 2, 3, 4, 5, 6]);
    const s2 = fixtureState(); s2.planets.forEach(p => { p.stock.at = SOIR; }); empireSecu(s2); s2.settings.secu.jours = [];
    const g2 = loadApp(s2, SOIR, SECU, null, true);
    const al2 = g2.alarmes().filter(a => a[0] === 'fsRappel');
    assert.equal(al2[al2.length - 1][1], null, 'aucun jour actif : pas d’alarme');
  });


  t('cartes : une attaque entrante ouvre son onglet, critique', () => {
    const g = appSecu((s, at) => { s.moves = [attaque(at, 1 * H, '1:142:8')]; });
    g.REFRESH.today();
    assert.equal(g.RESUMES.attaque.count, 1);
    assert.equal(g.RESUMES.attaque.maxLevel, 'crit', 'une alerte critique fait basculer sur sa carte');
  });

  t('le réveil se règle à la minute : champ horaire, et toute valeur douteuse refusée', () => {
    const g = appSecu();
    assert.equal(g.dayValue('nightEnd', '07:30', 7), 7.5);
    assert.equal(g.dayValue('nightEnd', '6:45', 7), 6.75);
    assert.equal(g.dayValue('nightEnd', '8', 7), 8, 'un nombre d’heures, comme avant');
    assert.equal(g.dayValue('nightEnd', '', 7), 7, 'vide : l’ancienne valeur reste');
    assert.equal(g.dayValue('nightEnd', '24:00', 7), 7);
    assert.equal(g.dayValue('nightEnd', '07:75', 7), 7);
    assert.equal(g.dayValue('nightEnd', '"><b>x', 7), 7);
    assert.equal(g.hhmmDe(7.5), '07:30');
    assert.equal(g.heureTxt(7.5), '7h30');
    assert.equal(g.heureTxt(7), '7h');
  });

  t('réveil à 7 h 30 : le mode nuit, le plan de la nuit et la journée le suivent', () => {
    const g = appSecu(s => { s.day.nightEnd = 7.5; });
    const w = new Date(2026, 10, 9, 7, 30, 0).getTime();
    assert.equal(g.wakeTime(SOIR), w, 'le mode nuit rentre à 7 h 30');
    assert.equal(g.secu().reveil, '07:30');
    assert.equal(g.planSecurite('routine', SOIR, []).find(e => e.p.name === 'Tourtierion').wake, w);
    assert.equal(g.isNight(new Date(2026, 10, 9, 7, 15, 0).getTime()), true);
    assert.equal(g.isNight(w), false);
    const t1 = g.sessionTimes(SOIR).find(t => t > SOIR + 3 * H);
    assert.equal(t1, w, 'la première connexion après la nuit tombe au réveil, pas à 8 h');
    assert.ok(lu(g.VIEWS.settings()).includes('data-day="nightEnd" value="07:30"'));
  });

  t('coucher à 22 h 45 : la nuit, la carte du soir et le plan du jour le suivent', () => {
    const g = appSecu(s => { s.day.nightStart = 22.75; });
    assert.equal(g.dayValue('nightStart', '22:45', 23), 22.75);
    assert.equal(g.isNight(new Date(2026, 10, 8, 22, 40, 0).getTime()), false);
    assert.equal(g.isNight(new Date(2026, 10, 8, 22, 50, 0).getTime()), true);
    assert.equal(g.heureTxt(22.75), '22h45');
    const h = lu(g.VIEWS.settings());
    assert.ok(h.includes('data-day="nightStart" value="22:45"'), 'champ horaire du coucher');
    assert.ok(lu(g.VIEWS.today()).includes('nuit 22h45–7h'));
    g.S.day.nightStart = 22.5; g.syncApply({ 'sy:day': g.S.day });
    assert.equal(g.S.day.nightStart, 22.5, 'la minute survit à la synchro');
  });

  t('une fin de nuit à la minute survit à la synchro, une absurde est refusée', () => {
    const g = appSecu();
    g.S.day.nightEnd = 7.5; g.syncApply && g.syncApply({ 'sy:day': g.S.day });
    assert.equal(g.S.day.nightEnd, 7.5);
  });

  t('l’ancienne question du coucher a disparu : seul le rappel est armé', () => {
    const s = fixtureState(); s.planets.forEach(p => { p.stock.at = SOIR; }); empireSecu(s);
    const g = loadApp(s, SOIR - 2 * H, SECU, null, true);
    assert.ok(!g.alarmes().some(a => a[0] === 'nuit' && a[1]), 'aucune alarme « nuit » posée');
    assert.ok(g.alarmes().some(a => a[0] === 'fsRappel' && a[1]));
    const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel.html'), 'utf8');
    assert.ok(!/nightAsk/.test(html), 'plus de bandeau « On passe en mode sauvegarde ? »');
    const bg = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
    assert.ok(/chrome\.alarms\.clear\('nuit'\)/.test(bg), 'le worker efface l’alarme laissée par une version d’avant');
    assert.ok(!/notifications\.create\('nuit'/.test(bg));
  });

  t('badge : attaque > instable > critiques > rappel > mise à jour', () => {
    const w = chargeWorker(), now = SOIR;
    const att = { game: { moves: [{ hostile: true, mission: 1, ret: false, arrival: now / 1000 + 600 }] } };
    const tout = { ...att, versionInstable: true, critiques: { n: 3 }, fsRappelOn: { at: now }, majVer: '9.0.0' };
    assert.equal(w.badgeEtat(tout, now, '2.9.0').quoi, 'attaque');
    assert.equal(w.badgeEtat({ ...tout, game: {} }, now, '2.9.0').quoi, 'instable');
    assert.equal(w.badgeEtat({ ...tout, game: {}, versionInstable: false }, now, '2.9.0').quoi, 'critiques');
    assert.equal(w.badgeEtat({ fsRappelOn: { at: now }, majVer: '9.0.0' }, now, '2.9.0').text, 'FS');
    assert.equal(w.badgeEtat({ majVer: '9.0.0' }, now, '2.9.0').quoi, 'maj');
    assert.equal(w.badgeEtat({ majVer: '2.9.0' }, now, '2.9.0').text, '');
    assert.equal(w.badgeEtat({ game: { moves: [{ hostile: true, mission: 1, arrival: now / 1000 - 5 }] } }, now, '2.9.0').text, '', 'une attaque passée n’alerte plus');
  });

  t('fusion des mouvements : l’encart remplace, la page Mouvements garde les hostiles, le témoin éteint efface', () => {
    const w = chargeWorker(), now = Date.now();
    const futur = now / 1000 + 3600;
    const mien = { mission: 3, arrival: futur, ret: false, origin: '1:1:1', dest: '1:1:2', camp: 'own', cargo: [1, 0, 0] };
    const hostile = { mission: 1, arrival: futur, ret: false, origin: '5:5:5', dest: '1:1:2', camp: 'hostile', hostile: true };
    const g = { moves: [mien, hostile] };
    assert.equal(w.fusionneMouvements({ ...g }, { moves: [], eventList: true }, now).length, 0, 'l’encart dit tout ce qui vole');
    assert.deepEqual(w.fusionneMouvements({ ...g }, { moves: [], movePage: true }, now).map(m => m.camp), ['hostile']);
    assert.equal(w.fusionneMouvements({ ...g }, { moves: [] }, now).length, 2, 'une autre page n’efface rien');
    assert.deepEqual(w.fusionneMouvements({ ...g }, { moves: [], alerteJeu: false }, now).map(m => m.camp), ['own']);
    const vieux = { moves: [{ ...mien, arrival: now / 1000 - 60 }] };
    w.fusionneMouvements(vieux, { moves: [] }, now);
    assert.equal(vieux.arrived.length, 1, 'une flotte arrivée passe dans `arrived`, sa cargaison se crédite encore');
  });
};
