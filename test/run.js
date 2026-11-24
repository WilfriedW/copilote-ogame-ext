/* node test/run.js — vérifie la mise à l'abri.
   Pas de framework : app.js reste un script classique chargé par la page, et on
   l'évalue ici comme le ferait le navigateur, avec un DOM factice. */
/* Les heures se vérifient dans un fuseau choisi : Tahiti, onze heures
   derrière un serveur européen, l'écart du joueur de cette extension. */
process.env.TZ = 'Pacific/Tahiti';
const assert = require('assert');
const { loadApp, fixtureState } = require('./harness');
const { runPage } = require('./page');

/** Le HTML tel que le joueur le lit : les entités redeviennent des caractères.
    esc() échappe l'apostrophe depuis qu'un attribut à apostrophes s'y cassait. */
const lu = h => String(h).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

let passed = 0;
const failures = [];
function t(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push([name, e]); }
}

/* 22 h 30 : la nuit commence à 23 h et finit à 7 h dans l'état de test. */
const SOIR = new Date(2026, 10, 8, 22, 30, 0).getTime();
const REVEIL = new Date(2026, 10, 9, 7, 0, 0).getTime();

/** Charge l'application avec un état modifié à la volée. */
function app(modifier, now, api, ext, prioAsk) {
  const s = fixtureState();
  // le stock avance tout seul depuis sa date : on le cale sur l'instant du test
  s.planets.forEach(p => { p.stock.at = now == null ? SOIR : now; });
  if (modifier) modifier(s);
  return loadApp(s, now == null ? SOIR : now, ['fleetsavePlan', 'dailyMissions', 'S', 'shipList', 'flight', 'REFRESH', 'simulateDay', 'planetRef', 'qHtml', 'actGo', 'goUrl', 'lfSecs', 'lfRes', 'lfQueue', 'planHints', 'prioHints', 'gameSkin', 'etaSecs', 'hms', 'copyChips', 'missionGo', 'nextResearch', 'techPayback', 'maxPlanets', 'finishTimer', 'planetAlerts', 'storageCap', 'storageLevelFor', 'crawlerMax', 'crawlerBonus', 'levelCost', 'rangeCost', 'mse', 'fmt', 'T', 'POS_BONUS_M', 'expoCap', 'expoInFlight', 'goNote', 'actHtml', 'waitFor', 'raidPlan', 'production', 'rankUpgrades', 'colonyPayback', 'coloFleet', 'parseProdPanel', 'prodOf', 'bridage', 'applyGame', 'lfCost', 'lfCandidates', 'speciesOf', 'speciesOfPlanet', 'foundLifeforms', 'bestLifeform', 'lfSettingsHtml', 'lfMerge', 'lfEffect', 'dayValue', 'defTarget', 'defMix', 'defNeed', 'defMixList', 'cargoGaps', 'cargoCap', 'pickCargo', 'planetById', 'forgetPlanet', 'migratePlanetIds', 'tourData', 'B', 'B_SHORT', 'terrainRates', 'vocations', 'besoinEmpire', 'mineWhy', 'centreIndex', 'centrePlanet', 'centreWhy', 'labLevel', 'labPlanet', 'labEffectif', 'researchTime', 'reqOk', 'galaxyUrl', 'cargoHomeIndex', 'VIEWS', 'coloFrom', 'raidTargets', 'parseReport', 'applyReport', 'prios', 'prioOf', 'prioClean', 'prioStep', 'prioBloque', 'prioRien', 'pickBuildings', 'prioHtml', 'prioPose', 'prioRetire', 'prioLvl', 'priosLf', 'prioDrain', 'prioDemandes', 'esc', 'prioPalier', 'prioCible', 'lfPosePaliers', 'lfPopNourriture', 'LF_PALIER', 'syncOut', 'syncApply', 'releveAge', 'releveEtapes', 'FRAIS_MS', 'scanEtat', 'lfChiffree', 'lfMetEnCommun', 'chantierFlou', 'chantierARelire', 'view', 'bind', 'appliqueSauvegarde', 'SHIPS', 'DEF', 'SHIP_COST', 'COL_SHIP_COST', 'luneTir', 'luneVaisseaux', 'luneFacture', 'luneDefense', 'luneFlotteAuSol'], api, ext, prioAsk);
}

/* ---------- fraîcheur du relevé ---------- */

/** Deux planètes que le jeu nomme, sur un serveur connu. */
const RELEVE = s => { s.host = 's1-fr.ogame.gameforge.com'; s.planets[0].gid = '101'; s.planets[1].gid = '102'; };
/** Un relevé assez vieux pour que le bouton sorte. */
const PERIME = s => { s.planets.forEach(p => { p.stock.at = SOIR - 42 * 60e3; }); };

t('un relevé du jour même est frais, le bouton reste caché', () => {
  const g = app();
  assert.ok(g.releveAge() <= g.FRAIS_MS, 'les stocks de la fixture sont calés sur maintenant');
});

t("c'est la planète la moins souvent vue qui donne l'âge", () => {
  const g = app(s => { s.planets[1].stock.at = SOIR - 42 * 60e3; });
  assert.ok(g.releveAge() > g.FRAIS_MS);
  assert.equal(Math.round(g.releveAge() / 60e3), 42);
});

t("une planète que le jeu vient de révéler rend tout l'empire périmé", () => {
  // bNeuve : nommée par la liste du jeu, aucun niveau lu, stock inventé à maintenant
  const g = app(s => { RELEVE(s); s.planets[1].bNeuve = 1; });
  assert.ok(g.releveAge() > g.FRAIS_MS, 'le bouton doit sortir après une colonisation');
});

t("une planète relevée depuis ne périme plus l'empire", () => {
  const g = app(RELEVE);
  assert.ok(g.releveAge() <= g.FRAIS_MS);
});

t('sans serveur connu, aucun relevé à proposer', () => {
  const g = app(s => { s.planets.forEach(p => { p.gid = '101'; }); });
  assert.deepEqual(g.releveEtapes(), []);
});

t('une planète que le jeu ne nomme pas ne fait pas étape', () => {
  const g = app(s => { RELEVE(s); delete s.planets[1].gid; });
  assert.deepEqual([...new Set(g.releveEtapes().map(e => e.gid))], ['101']);
});

t('le relevé va page par page, pas planète par planète', () => {
  // arrêté à moitié, il rend un empire cohérent sur ce qu'il a lu
  const g = app(RELEVE);
  const e = g.releveEtapes();
  assert.deepEqual(e.slice(0, 4).map(x => `${x.page}:${x.gid}`),
    ['supplies:101', 'supplies:102', 'resourcesettings:101', 'resourcesettings:102']);
});

t('chaque page porte son domaine, et une seule fois par planète', () => {
  const g = app(RELEVE);
  const e = g.releveEtapes();
  for (const page of ['supplies', 'resourcesettings', 'shipyard', 'defenses', 'facilities']) {
    assert.equal(e.filter(x => x.page === page).length, 2, page);
  }
  assert.ok(e[0].url.includes('component=supplies') && e[0].url.includes('cp=101'), e[0].url);
});

t('le relevé passe par le paramétrage de la production de chaque planète', () => {
  // sans lui, facteur, bonus de forme de vie et foreuses ne se rafraîchissent jamais
  const g = app(RELEVE);
  const e = g.releveEtapes().filter(x => x.page === 'resourcesettings');
  assert.deepEqual(e.map(x => x.gid), ['101', '102']);
  assert.ok(e[0].url.includes('component=resourcesettings'), e[0].url);
});

t("le relevé reprend le lien du jeu vers le paramétrage, planète changée", () => {
  // selon la version, cette page s'ouvre par `page=` et non par `component=` :
  // on ne devine pas l'adresse, on reprend celle que la page affiche
  const g = app(s => { RELEVE(s); s.prodUrl = 'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings&cp=101'; });
  const e = g.releveEtapes().filter(x => x.page === 'resourcesettings');
  assert.deepEqual(e.map(x => x.url), [
    'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings&cp=101',
    'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings&cp=102']);
});

t("un lien illisible ne prive pas le relevé de sa page", () => {
  const g = app(s => { RELEVE(s); s.prodUrl = 'pas une adresse'; });
  const e = g.releveEtapes().filter(x => x.page === 'resourcesettings');
  assert.equal(e.length, 2);
  assert.ok(e[0].url.includes('component=resourcesettings'), e[0].url);
});

t('sans forme de vie jamais lue, le relevé ne va pas les attendre', () => {
  const g = app(RELEVE);
  assert.deepEqual(g.releveEtapes().filter(e => e.page.startsWith('lf')), []);
});

t("le menu du jeu suffit : un poste neuf relève les formes de vie sans qu'on lui en ouvre une", () => {
  /* Avoir des formes de vie est un fait du compte, pas du poste. Sur un second
     ordinateur, rien n'a encore été vu : le relevé sautait leurs pages et le
     panneau réclamait une ouverture à la main. */
  const g = app(s => { RELEVE(s); s.lfMenu = true; });
  const e = g.releveEtapes();
  assert.equal(e.filter(x => x.page === 'lfbuildings').length, 2);
  assert.equal(e.filter(x => x.page === 'lfresearch').length, 2);
});

t("un univers sans formes de vie ne les relève pas", () => {
  const g = app(s => { RELEVE(s); s.lfMenu = false; });
  assert.deepEqual(g.releveEtapes().filter(e => e.page.startsWith('lf')), []);
});

t("une page déjà relevée ici garde sa place, quoi que dise le menu", () => {
  // le menu ne fait qu'ajouter : une forme reconnue autrement n'est jamais perdue
  const g = app(s => { RELEVE(s); s.lfMenu = false; s.planets[0].lfSeen = { lfbuilding: SOIR }; });
  assert.equal(g.releveEtapes().filter(e => e.page === 'lfbuildings').length, 2);
});

t("le relevé ouvre lui-même une case non chiffrée, par un lien", () => {
  /* Le prix n'apparaît que dans le panneau de détail ; le jeu accepte openTech
     dans ses URL, donc le relevé l'ouvre sans rien cliquer dans la page. */
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } };
  });
  const e = g.releveEtapes().find(x => x.page === 'lfbuildings' && x.gid === '101');
  assert.ok(e.url.includes('openTech=11101'), e.url);
});

t("l'arrêt qui part chercher une case la nomme", () => {
  // sans ça, il ne peut pas savoir si la page lui a rendu ce qu'il demandait
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } };
  });
  const e = g.releveEtapes().find(x => x.page === 'lfbuildings' && x.gid === '101');
  assert.equal(e.tuile, '11101');
});

t("une case n'est tenue pour chiffrée qu'avec son prix et sa durée", () => {
  /* Le jeu charge le prix après la page : repartir sur le premier instantané,
     c'est repartir avant le prix — et aucune case n'était jamais chiffrée. */
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } };
  });
  assert.equal(g.lfChiffree('101', '11101'), false, 'niveau seul : pas de prix');
  g.S.planets[0].lf[11101] = { lvl: 3, state: 'ok', next: 4, cost: [100, 50, 0] };
  assert.equal(g.lfChiffree('101', '11101'), false, 'prix sans durée : incomplet');
  g.S.planets[0].lf[11101].secs = 600;
  assert.equal(g.lfChiffree('101', '11101'), true);
  // un arrêt qui ne demandait rien n'attend rien
  assert.equal(g.lfChiffree('101', null), true);
});

t("une case déjà chiffrée n'est pas rouverte", () => {
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok', next: 4, cost: [100, 50, 0], secs: 600 } };
  });
  const e = g.releveEtapes().find(x => x.page === 'lfbuildings' && x.gid === '101');
  assert.ok(!e.url.includes('openTech'), e.url);
});

t("une case verrouillée ne vaut pas la peine d'être ouverte", () => {
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 0, state: 'locked' } };
  });
  const e = g.releveEtapes().find(x => x.page === 'lfbuildings' && x.gid === '101');
  assert.ok(!e.url.includes('openTech'), e.url);
});

t("la file de recherche a sa propre case à ouvrir", () => {
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' }, 11201: { lvl: 1, state: 'ok' } };
  });
  const e = g.releveEtapes().filter(x => x.gid === '101' && x.page.startsWith('lf'));
  const parPage = Object.fromEntries(e.map(x => [x.page, x.url]));
  assert.ok(parPage.lfbuildings.includes('openTech=11101'), parPage.lfbuildings);
  assert.ok(parPage.lfresearch.includes('openTech=11201'), parPage.lfresearch);
});

t("une forme de vie déjà vue ramène ses deux pages par planète", () => {
  const g = app(s => { RELEVE(s); s.planets[0].lfSeen = { lfbuilding: SOIR }; });
  const e = g.releveEtapes();
  assert.equal(e.filter(x => x.page === 'lfbuildings').length, 2);
  assert.equal(e.filter(x => x.page === 'lfresearch').length, 2);
});

t('recherche et mouvements ferment le relevé, une fois chacun', () => {
  const g = app(RELEVE);
  const e = g.releveEtapes();
  assert.deepEqual(e.slice(-2).map(x => x.page), ['research', 'movement']);
  assert.equal(e.filter(x => x.page === 'research').length, 1);
});

t('le bouton du haut lance le relevé', () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  const go = g.sent().filter(m => m.type === 'scan');
  assert.equal(go.length, 1, 'le premier arrêt part au clic');
  assert.ok(go[0].url.includes('cp=101'), go[0].url);
});

t('le bouton se montre en rouge, et seulement quand il se montre', () => {
  // il ne sort que si le plan se fie à des chiffres périmés : il doit se voir
  const frais = app(RELEVE, SOIR, null, true);
  assert.ok(frais.el('majBtn').hidden, 'rien à relever');
  assert.ok(!frais.el('majBtn').classList.contains('bad'));
  const vieux = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  assert.ok(!vieux.el('majBtn').hidden);
  assert.ok(vieux.el('majBtn').classList.contains('bad'));
});

t("le relevé ne navigue pas l'onglet du joueur : il demande le sien", () => {
  // sinon sa page de jeu clignote page après page sous ses yeux
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  assert.deepEqual(g.sent().filter(m => m.type === 'go'), [],
    "aucun message qui déplacerait l'onglet du joueur");
});

t("l'écran du relevé prend la place du contenu, et montre ce qui reste", () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  const h = g.html().view;
  assert.ok(/Relevé en cours/.test(h), h.slice(0, 200));
  assert.ok(/0 \/ \d+/.test(h), 'le compteur est là');
  assert.ok(/ressources/.test(h) && /production/.test(h), 'les pages sont nommées');
});

t("un arrêt qui va chercher une case a plus de temps qu'une page simple", () => {
  /* Il attend deux réponses du jeu : la page, puis le panneau de détail qu'il
     charge à part. Les planètes les plus lentes expiraient là. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  const simple = +/const RELEVE_DELAI = (\d+);/.exec(src)[1];
  const avecCase = +/const RELEVE_DELAI_CASE = (\d+);/.exec(src)[1];
  assert.ok(avecCase > simple, avecCase + ' doit dépasser ' + simple);
  assert.ok(/setTimeout\(\(\)=>fin\(true\), tuile \? RELEVE_DELAI_CASE : RELEVE_DELAI\)/.test(src),
    'le choix du délai doit suivre la présence d\'une case à chercher');
});

t("l'écran sépare la page lue de la page muette", () => {
  /* Une page qui n'a rien renvoyé a coûté le délai entier pour rien : c'est
     elle qui fait traîner un relevé, et il faut pouvoir la montrer du doigt. */
  const g = app(RELEVE, SOIR, null, true);
  assert.equal(g.scanEtat(5, 3, undefined), 'attente');
  assert.equal(g.scanEtat(3, 3, undefined), 'encours');
  assert.equal(g.scanEtat(1, 3, {muet:false, ms:420}), 'lu');
  assert.equal(g.scanEtat(1, 3, {muet:true, ms:4000}), 'muet');
  // un arrêt terminé dont le compte rendu manque passe pour lu, pas pour muet
  assert.equal(g.scanEtat(0, 3, undefined), 'lu');
});

t("l'écran dit le temps écoulé", () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  assert.ok(/écoulée/.test(g.html().view), g.html().view.slice(0, 400));
});

t("un clic sur un onglet rend la main avant la fin du relevé", () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  assert.ok(/Relevé en cours/.test(g.html().view));
  g.click('tabs', { closest: sel => (sel === 'button[data-tab]' ? { dataset: { tab: 'empire' } } : null) });
  assert.ok(!/Relevé en cours/.test(g.html().view), "l'écran s'est baissé");
});

t("le clic sur une carte, lui, amène bien l'onglet devant", () => {
  const g = app(RELEVE, SOIR, null, true);
  // une carte telle que la poignée déléguée la voit : porteuse de data-go
  const carte = { dataset: { go: g.goUrl('supplies', 0) } };
  carte.closest = sel => (sel === '[data-go]' ? carte : null);
  g.click('view', carte);
  const go = g.sent().filter(m => m.type === 'go');
  assert.equal(go.length, 1);
  assert.ok(!go[0].discret, 'un clic du joueur veut son onglet devant lui');
});

t('le bouton annonce sa progression et devient le bouton d\'arrêt', () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  const b = g.click('majBtn');
  assert.ok(/^Arrêter \(0\/\d+\)$/.test(b.textContent), b.textContent);
  // rappuyer arrête : le relevé ne repart pas, et le joueur est ramené
  g.click('majBtn');
  assert.equal(b.textContent, 'Actualiser');
});

/* ---------- ce qu'il y a à envoyer ---------- */

t('sans transporteur à quai, rien à proposer', () => {
  const g = app(s => { s.planets[0].ships = { pr: 4 }; });
  assert.equal(g.fleetsavePlan(SOIR), null);
});

/** Une colonie assez loin pour qu'un déploiement couvre la nuit. */
const loin = s => { s.planets[1].coords = '1:260:6'; };

t('avec des transporteurs, la flotte, la destination et l\'arrivée sont nommées', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30, sc: 6 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs, 'un plan est proposé');
  assert.ok(fs.ships.lc > 0, 'des grands transporteurs sont choisis');
  assert.equal(fs.dest, '1:260:6', 'vers l\'autre planète');
  // Le wiki : sans lune, le déploiement est la seule mise à l'abri sûre, parce
  // qu'un déploiement rappelé est invisible à la phalange. Un Transporter se
  // voit, et une fois le retour commencé il n'y a plus rien à faire.
  assert.equal(fs.mission, 'deployment');
  assert.ok(fs.oneWay, 'un déploiement ne vole qu\'à l\'aller');
  assert.ok(fs.arrive === fs.back, 'il n\'y a pas de retour à attendre');
  assert.ok(fs.arrive > REVEIL, 'la flotte se pose après le réveil, pour pouvoir être rappelée');
});

t('la soute embarque tout le stock quand elle le peut', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs.cargo >= fs.load, 'soute ' + fs.cargo + ' pour ' + fs.load + ' à sauver');
});

t('la vitesse retenue fait arriver après le réveil, et jamais à 100 %', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(SOIR + g.flight('1:142:8', fs.dest, fs.ships, fs.pct).secs * 1000 > REVEIL,
    'à ' + fs.pct + ' %, la flotte se pose après le réveil');
  // « Avoid sending your fleets at 100% speed » : à 100 % le vol est le plus
  // court connu, donc le plus facile à chronométrer.
  assert.ok(fs.pct < 100, 'le cran 100 % est écarté, il est trop prévisible');
});

t('la vitesse ne reste pas la même tous les soirs', () => {
  // « Avoid using the same speed each time you fleetsave. » Elle change avec le
  // jour, et pas à chaque rafraîchissement : le plan ne doit pas se contredire
  // dans la même journée.
  const vu = new Set();
  for (let j = 0; j < 6; j++) {
    const soir = new Date(2026, 10, 8 + j, 22, 30, 0).getTime();
    const g = app(s => { loin(s); s.planets[0].ships = { lc: 30 }; }, soir);
    vu.add(g.fleetsavePlan(soir).pct);
  }
  assert.ok(vu.size > 1, 'la même vitesse six soirs de suite : ' + [...vu]);
  const soir = new Date(2026, 10, 8, 22, 30, 0).getTime();
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30 }; }, soir);
  assert.equal(g.fleetsavePlan(soir).pct, g.fleetsavePlan(soir + 60000).pct,
    'dans la même journée, la vitesse ne bouge pas');
});

t('le déploiement dit pourquoi, pas seulement quoi', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30 }; });
  const how = g.dailyMissions().find(m => m.id === 'night').how.join(' ');
  assert.match(how, /rappelle/i, 'le rappel est l\'intérêt de la méthode : ' + how);
  assert.match(how, /phalange/i, 'et ce qu\'il évite');
});

/* ---------- quand se taire ---------- */

t('rien à sauver : pas de proposition', () => {
  const g = app(s => {
    s.planets[0].ships = { lc: 30 };
    s.planets.forEach(p => { p.stock = { m: 300, c: 200, d: 0, at: SOIR }; });
  });
  assert.equal(g.fleetsavePlan(SOIR), null);
});

t('fenêtre de nuit dégénérée : pas de calcul, pas de boucle', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; s.day.nightStart = 7; s.day.nightEnd = 7; });
  assert.equal(g.fleetsavePlan(SOIR), null);
});

/* ---------- une seule planète ---------- */

t('une seule planète mais une sonde : espionnage vers la position 16', () => {
  // Deuxième méthode du wiki, et la seule qui ramène les ressources avec la
  // flotte : rien ne se pose sur une planète qu'on laisserait exposée.
  const g = app(s => {
    s.planets = [s.planets[0]];
    s.planets[0].ships = { lc: 20, pr: 1 };
  });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs, 'un plan est proposé');
  assert.equal(fs.mission, 'espionage');
  assert.match(fs.dest, /^1:\d+:16$/, 'la position 16 d\'un système choisi sur le temps de vol');
  assert.equal(fs.ships.pr, 1, 'la sonde part : sans elle le jeu refuse l\'ordre');
  assert.ok(!fs.oneWay && fs.back > REVEIL, 'aller-retour, de retour après le réveil');
});

t('ni deuxième planète ni sonde : l\'expédition, en le disant', () => {
  const g = app(s => {
    s.planets = [s.planets[0]];
    s.planets[0].ships = { lc: 20 };
  });
  const fs = g.fleetsavePlan(SOIR);
  assert.equal(fs.mission, 'expedition');
  assert.match(fs.dest, /^1:\d+:16$/);
  const how = g.dailyMissions().find(m => m.id === 'night').how.join(' ');
  assert.match(how, /pis-aller/, 'le pis-aller est annoncé comme tel : ' + how);
});

/* ---------- ce que le joueur lit ---------- */

t('le rappel du soir nomme la flotte au lieu de rester vague', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  const nuit = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(nuit, 'le rappel existe le soir');
  assert.ok(/transporteur/.test(nuit.how.join(' ')), 'les étapes nomment la flotte');
  assert.ok(/1:\d+:(6|16)\b/.test(nuit.how.join(' ')), 'et la destination : ' + nuit.how.join(' '));
});

t('ce que la flotte emporte n\'est plus compté comme exposé au matin', () => {
  // Annoncer « resteront exposés : 237 k » juste après avoir dit de charger ces
  // 237 k, c'est se contredire dans la même carte.
  const pleine = g => g.dailyMissions().find(m => m.id === 'night').how.join(' ');
  assert.ok(!/Resteront exposés/.test(pleine(app(s => { s.planets[0].ships = { lc: 30 }; }))),
    'la soute suffit : il ne reste que la production de la nuit');
  const court = pleine(app(s => { s.planets[0].ships = { lc: 1 }; }));
  assert.match(court, /Resteront exposés/, 'un seul transporteur ne lève pas 198 000 : ' + court);
});

t('sans transporteur, le rappel reste utile mais générique', () => {
  const g = app(s => { s.planets[0].ships = {}; });
  const nuit = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(nuit, 'le rappel existe toujours');
  assert.ok(/Dépense/.test(nuit.how.join(' ')), 'il conseille au moins de dépenser');
});

/* ---------- le retour de l'écran Réglages ---------- */

t('l\'écran Réglages dit ce que le plan du jour devient', () => {
  const g = app(s => { s.day.focus = 'eco'; s.day.horizon = 48; });
  g.REFRESH.settings();
  const txt = g.html().daySum || '';
  assert.ok(/Économie pure/.test(txt), 'la priorité choisie est nommée : ' + txt);
  assert.ok(/en 48 h/.test(txt), 'l\'horizon choisi est dit : ' + txt);
  assert.ok(/production [+-]/.test(txt), 'le plan recalculé se voit : ' + txt);
});

t('deux heures de nuit égales s\'annoncent comme aucune nuit', () => {
  // Sinon le résumé disait « nuit 7h–7h », qui a l'air d'un réglage en place
  // alors que plus rien n'est sauté et que la mise à l'abri a disparu.
  const g = app(s => { s.day.nightStart = 7; s.day.nightEnd = 7; });
  g.REFRESH.settings();
  const txt = g.html().daySum || '';
  assert.ok(/aucune nuit/.test(txt), 'le résumé doit le dire : ' + txt);
});

t('en mode nuit l\'écran Réglages ne promet aucun plan', () => {
  const g = app(s => { s.day.night = true; });
  g.REFRESH.settings();
  assert.ok(/[Mm]ode nuit/.test(g.html().daySum || ''), 'le résumé dit la pause');
});

t('l\'onglet Aujourd\'hui affiche les pastilles de planète', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  g.REFRESH.today();
  const html = g.html().tdNow || '';
  assert.ok(/class="ptag"/.test(html),
    'les étiquettes doivent porter la pastille : ' + html.slice(0, 300));
});

/* ---------- savoir où aller ---------- */

const JOUR = new Date(2026, 10, 8, 14, 0, 0).getTime();

/** Trois planètes, dont deux colonies au nom par défaut identique. */
function troisPlanetes(s) {
  s.planets[0].b.lab = 8;
  s.planets.push({ id: 'c2', name: 'Colonie', coords: '1:201:9', tmax: 48,
    b: Object.assign({}, s.planets[1].b, { metal: 5, lab: 2 }), sats: 0, ships: {}, shipsAt: 0,
    stock: { m: 8000, c: 5000, d: 800, at: JOUR } });
}

t('deux colonies du même nom se distinguent par leurs coordonnées', () => {
  const g = app(troisPlanetes, JOUR);
  const files = g.simulateDay().sessions[0].acts.map(a => a.q)
    .filter(q => /Colonie/.test(q));
  assert.ok(files.length >= 2, 'au moins deux actions sur une planète nommée Colonie');
  assert.equal(new Set(files).size, files.length,
    'étiquettes identiques pour deux planètes différentes : ' + files.join(' / '));
  assert.ok(files.every(q => /\[\d+:\d+:\d+\]/.test(q)), 'chacune porte ses coordonnées');
});

t('un nom unique reste affiché sans coordonnées', () => {
  const g = app(null, JOUR);
  const mere = g.simulateDay().sessions[0].acts.map(a => a.q).find(q => /Planète mère/.test(q));
  assert.ok(mere, 'une action sur la planète mère');
  assert.ok(!/\[/.test(mere), 'pas de coordonnées inutiles : ' + mere);
});

t('une recherche dit sur quelle planète la lancer', () => {
  const g = app(troisPlanetes, JOUR);
  const s0 = g.simulateDay().sessions[0];
  const rech = s0.acts.concat(s0.waits).find(x => /Recherche/.test(x.q));
  assert.ok(rech, 'une recherche est proposée');
  assert.ok(/Planète mère/.test(rech.q),
    'la recherche se lance depuis le meilleur laboratoire, ici Planète mère : ' + rech.q);
});

t('planetRef ne plante pas sans planète', () => {
  const g = app(null, JOUR);
  assert.equal(g.planetRef(null), '');
});

/* ---------- rapatrier des ressources ---------- */

/** La colonie déborde, mais toute la flotte est sur la planète mère. */
function flotteAuHub(s) {
  s.planets[1].stock = { m: 60000, c: 40000, d: 5000, at: JOUR };
  s.planets[1].ships = {};
  s.planets[0].ships = { lc: 10, sc: 5 };
}

/** La colonie a ses propres transporteurs. */
function flotteSurPlace(s) {
  s.planets[1].stock = { m: 60000, c: 40000, d: 5000, at: JOUR };
  s.planets[1].ships = { lc: 6 };
  s.planets[0].ships = { sc: 2 };
}

const transfert = g => g.simulateDay().sessions[0].acts.find(a => a.kind === 'transfer');

t('un rapatriement refusé ne revient pas dans le plan', () => {
  const g = app(flotteSurPlace, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  const key = `transfer:${g.S.planets[a.p].id}:${a.dest}`;
  g.S.daily.no[key] = JOUR;
  assert.ok(!transfert(g), 'après un Non, le plan ne le repropose plus');
  // Un refus ne s'évapore pas : seul le joueur le défait, d'un bouton.
  g.S.daily.no[key] = JOUR - 400 * 24 * 3600e3;
  assert.ok(!transfert(g), 'le temps ne ramène pas une carte refusée');
  g.S.daily.no = {};
  assert.ok(transfert(g), 'remise, elle revient');
});

/* Le joueur fait ses rapatriements dans le jeu, pas en cliquant « Lancé » ici.
   Sans lire les mouvements de flotte, le plan reproposait la même carte comme
   si rien n'était parti. */
t('un rapatriement déjà parti dans le jeu ne se repropose pas', () => {
  const g = app(flotteSurPlace, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  const depart = g.S.planets[a.p].coords;
  g.S.moves = [{ mission: 3, ret: false, arrival: (JOUR + 2 * 3600e3) / 1000, origin: depart, dest: '1:1:8' }];
  assert.ok(!transfert(g), 'les mouvements de flotte suffisent, sans « Lancé »');
});

t('sans vaisseau sur la colonie, l\'action se passe là où est la flotte', () => {
  const g = app(flotteAuHub, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  assert.ok(/Planète mère/.test(a.q),
    'l\'étiquette doit désigner la planète d\'où partent les vaisseaux : ' + a.q);
  assert.ok(!/^Flotte · Colonie/.test(a.q),
    'surtout pas la colonie, où il n\'y a aucun vaisseau');
});

t('le texte dit qu\'il faut d\'abord envoyer les vaisseaux à vide', () => {
  const g = app(flotteAuHub, JOUR);
  const a = transfert(g);
  assert.ok(/vers Colonie/.test(a.what),
    'la première mission va vers la colonie : ' + a.what);
  assert.ok(/vide/.test(a.what + a.why),
    'et elle part à vide : ' + a.why);
});

t('le trajet à vide est un Stationner, pas un Transporter', () => {
  const g = app(flotteAuHub, JOUR);
  const a = transfert(g);
  // Une mission Transporter revient toute seule à vide : les vaisseaux ne
  // seraient plus là pour charger. Seul Stationner les laisse sur place.
  assert.ok(/Stationner/.test(a.why), 'la mission aller doit être Stationner : ' + a.why);
  assert.ok(!/Mission Transporter/.test(a.why),
    'Transporter repartirait tout seul : ' + a.why);
});

t('le texte dit que les transporteurs resteront basés sur la colonie', () => {
  const g = app(flotteAuHub, JOUR);
  const a = transfert(g);
  // Le Transporter de retour repart de la colonie : il y revient à vide.
  // La principale ne les récupère pas ; il faut que le joueur le sache
  // avant de dégarnir sa flotte d'expédition.
  assert.ok(/basés sur Colonie|restent sur Colonie|reviendront sur Colonie/.test(a.why),
    'le texte doit dire où ils vivront désormais : ' + a.why);
});

t('avec ses propres vaisseaux, la colonie envoie directement', () => {
  const g = app(flotteSurPlace, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  assert.ok(/Colonie/.test(a.q), 'l\'action se passe sur la colonie : ' + a.q);
  assert.ok(/Rapatrier vers Planète mère/.test(a.what), a.what);
});

/* ---------- la recherche attire les ressources ---------- */

/* Le meilleur labo sur la colonie, le meilleur chantier sur la mère : la
   recherche se paie donc là où le hub n'est pas. */
function laboSurLaColonie(s) {
  s.day.focus = 'fleet';            // la feuille de route ouvre sur Combustion 5, critique
  s.planets[1].b.lab = 6;           // labo de la colonie devant celui de la mère (5)
  s.planets[1].stock = { m: 2000, c: 1000, d: 200, at: JOUR };
  s.planets[0].ships = { lc: 10, sc: 5 };
}

t('le rapatriement vise la planète du labo, pas le hub', () => {
  const g = app(laboSurLaColonie, JOUR);
  const a = g.simulateDay().sessions[0].acts
    .find(x => x.kind === 'transfer' && /Planète mère/.test(x.q));
  assert.ok(a, 'la mère envoie vers la colonie qui épargne pour la recherche');
  assert.equal(a.dest, '1:142:6', 'destination : la colonie, où est le labo');
  assert.ok(/Rapatrier vers Colonie/.test(a.what), a.what);
});

t('sans objectif ailleurs, le rapatriement vise toujours le hub', () => {
  const g = app(flotteSurPlace, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  assert.equal(a.dest, '1:142:8', 'destination : la planète mère');
});

/* ---------- livrer une planète qui ne produit plus ---------- */

/* La colonie vient de perdre ses centrales : ses mines tournent au ralenti et
   elle n'a pas le cristal pour reconstruire. Le manque est chez elle, et
   aucun objectif n'y est attaché. */
function colonieSansEnergie(s) {
  s.planets[1].b = Object.assign({}, s.planets[1].b,
    { metal: 14, crystal: 12, deut: 10, solar: 12 });
  s.planets[1].stock = { m: 0, c: 0, d: 0, at: JOUR };
  s.planets[1].ships = {};
  s.planets[0].ships = { lc: 10, sc: 5 };
}

t('une planète bridée faute d\'énergie se fait livrer sa centrale', () => {
  const g = app(colonieSansEnergie, JOUR);
  const a = g.simulateDay().sessions[0].acts
    .find(x => x.kind === 'transfer' && /Planète mère/.test(x.q));
  assert.ok(a, 'la mère livre la colonie bridée');
  assert.equal(a.dest, '1:142:6', 'destination : la colonie qui manque d\'énergie');
  assert.ok(a.res && a.res[1] > 0, 'du cristal part : ' + JSON.stringify(a && a.res));
  assert.ok(/ralenti/.test(a.why), 'le texte dit pourquoi : ' + a.why);
});

t('« Avant les bâtiments » rend la tête de liste critique', () => {
  assert.equal(app(null, JOUR).nextResearch().list[0].crit, false,
    'à son tour, la tête de liste n\'est pas critique');
  const g = app(s => { s.day.research = 'first'; }, JOUR);
  assert.equal(g.nextResearch().list[0].crit, true);
});

t('« Avant les bâtiments » fait passer la recherche devant les chantiers', () => {
  const ordre = g => {
    const acts = g.simulateDay().sessions[0].acts;
    return [acts.findIndex(a => a.kind === 't'), acts.findIndex(a => a.kind === 'b')];
  };
  const [tNorm, bNorm] = ordre(app(null, JOUR));
  assert.ok(tNorm > bNorm && bNorm >= 0, 'à son tour, le bâtiment passe devant');
  const [tFirst, bFirst] = ordre(app(s => { s.day.research = 'first'; }, JOUR));
  assert.ok(tFirst >= 0 && tFirst < bFirst, 'en « avant les bâtiments », la recherche ouvre la session');
});

/* ---------- les formes de vie dans le plan ---------- */

/* Relevé sur le jeu : Secteur résidentiel 25 sur la planète mère. */
const CASE_OK = { lvl: 24, state: 'ok', next: 25, cost: [13911, 3974, 0], secs: 1834,
  nom: 'Secteur résidentiel' };
const vieSur = (lf, modif) => app(s => {
  s.planets[0].lf = lf;
  if (modif) modif(s);
}, SOIR);
const premierLf = g => g.simulateDay().sessions[0].acts.find(a => a.kind === 'lf');

t('une case de forme de vie payable entre dans le plan', () => {
  const a = premierLf(vieSur({ 11101: CASE_OK }));
  assert.ok(a, 'elle doit être proposée comme une construction ordinaire');
  assert.deepEqual(a.cost, [13911, 3974, 0], 'au prix que le jeu affiche');
  assert.equal(a.dur, 1834, 'et à la durée que le jeu affiche');
  assert.ok(/Secteur résidentiel 25/.test(a.what), a.what);
});

t('une case trop ch\u00e8re \u00e0 l\'instant T devient une attente, pas un silence', () => {
  // « Pas assez de ressources » décrit la seconde où le joueur a vu la page.
  // Le plan, lui, sait quand le stock sera là : c'est tout son intérêt.
  const g = vieSur({ 11101: { ...CASE_OK, state: 'short', cost: [400000, 0, 0] } });
  const w = g.simulateDay().sessions[0].waits.find(x => /Secteur résidentiel/.test(x.what));
  assert.ok(w, 'elle doit figurer en attente');
  assert.ok(w.miss[0] > 0, 'avec ce qui manque : ' + JSON.stringify(w.miss));
});

t('une case de forme de vie ne passe pas devant un b\u00e2timent qui attend', () => {
  // Les deux files sont indépendantes, mais le stock est commun. Une case à
  // 20 000 métal vide ce que la mine met de côté : elle doit s'effacer, comme
  // le chantier spatial le fait déjà.
  const g = app(s => {
    // la centrale de la planète mère est à moins d'une heure de ses ressources
    s.planets[0].stock = { m: 20000, c: 8000, d: 1000, at: SOIR };
    s.planets[0].lf = { 11101: { ...CASE_OK, cost: [20000, 0, 0], secs: 60 } };
  }, SOIR);
  const s0 = g.simulateDay().sessions[0];
  const mere = w => /Planète mère/.test(w.q);
  assert.ok(s0.waits.some(w => mere(w) && /Centrale/.test(w.what)),
    'la centrale de la planète mère doit bien être en attente');
  assert.ok(!s0.acts.some(a => a.kind === 'lf'),
    'la forme de vie ne doit pas prendre le stock que la centrale économise');
  assert.ok(s0.waits.some(w => mere(w) && /Secteur résidentiel/.test(w.what)),
    'elle attend son tour au lieu de disparaître');
});

/* Le même décor que le test précédent : la centrale de la planète mère est
   à moins d'une heure de ses ressources, et une case coûte tout le métal. */
const disputeStock = s => {
  s.planets[0].stock = { m: 20000, c: 8000, d: 1000, at: SOIR };
  s.planets[0].lf = { 11101: { ...CASE_OK, cost: [20000, 0, 0], secs: 60 } };
};

t('\u00ab apr\u00e8s les b\u00e2timents \u00bb vaut aussi pour un b\u00e2timent lointain', () => {
  // La centrale de la planète mère est à six heures de son compte. Le joueur
  // qui a choisi « après les bâtiments » n'a pas demandé « après ceux de la
  // prochaine heure » : une case ne doit pas lui manger cette épargne.
  const g = app(s => {
    s.planets[0].stock = { m: 20000, c: 4000, d: 1000, at: SOIR };
    s.planets[0].lf = { 11101: { ...CASE_OK, cost: [20000, 0, 0], secs: 60 } };
  }, SOIR);
  const s0 = g.simulateDay().sessions[0];
  assert.ok(s0.waits.some(w => /Planète mère/.test(w.q) && /Centrale/.test(w.what)),
    'la centrale attend bien');
  assert.ok(!s0.acts.some(a => a.kind === 'lf'),
    'la case ne doit pas passer devant : ' + s0.acts.map(a => a.what).join(', '));
});

t('r\u00e9gl\u00e9es en priorit\u00e9, les formes de vie passent devant', () => {
  const g = app(s => { disputeStock(s); s.day.lf = 'first'; }, SOIR);
  assert.ok(g.simulateDay().sessions[0].acts.some(a => a.kind === 'lf'),
    'le joueur a demandé qu\'elles passent en premier');
});

t('d\u00e9sactiv\u00e9es, elles dispara\u00eessent compl\u00e8tement', () => {
  const g = app(s => { disputeStock(s); s.day.lf = 'off'; s.syncAt = SOIR; }, SOIR, null, true);
  const s0 = g.simulateDay().sessions[0];
  assert.ok(!s0.acts.some(a => a.kind === 'lf'), 'rien de proposé');
  assert.ok(!s0.waits.some(w => /Secteur résidentiel/.test(w.what)), 'rien en attente');
  // et surtout plus de rappel d'aller relever les pages : il ne servirait à rien
  assert.ok(!g.dailyMissions().some(m => m.id === 'lfb' || m.id === 'lfr'),
    'ni de rappel de relevé');
});

t('un prix relev\u00e9 pour un niveau d\u00e9pass\u00e9 n\'est plus utilis\u00e9', () => {
  // le joueur a monté la case deux fois depuis : le prix lu alors ne vaut
  // plus rien, et l'afficher annoncerait un niveau déjà construit.
  const g = vieSur({ 11101: { ...CASE_OK, lvl: 26, next: 25 } });
  const s0 = g.simulateDay().sessions[0];
  assert.ok(!s0.acts.some(a => a.kind === 'lf'), 'pas de prix périmé dans le plan');
  assert.ok(!s0.waits.some(x => /Secteur résidentiel/.test(x.what)), 'ni en attente');
});

t('un prix p\u00e9rim\u00e9 fait redemander une case', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { ...CASE_OK, lvl: 26, next: 25 } }; });
  }, SOIR, null, true);
  const m = g.dailyMissions().find(x => x.id === 'lfb');
  assert.ok(m && /Clique une case/.test(m.what), 'il redemande le prix : ' + (m && m.what));
});

t('une page visit\u00e9e sans aucune case ne se r\u00e9clame plus', () => {
  // la recherche de forme de vie demande un bâtiment : tant qu'il manque,
  // la page est vide. Rien à relever, donc rien à rappeler.
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lfSeen = { lfresearch: SOIR }; });
  }, SOIR, null, true);
  assert.ok(!g.dailyMissions().some(x => x.id === 'lfr'),
    'le copilote est passé, il n\'y avait rien : il se tait');
});

t('une case verrouill\u00e9e par un pr\u00e9requis reste exclue', () => {
  // « Prérequis non remplis » n'est pas une question de ressources : aucune
  // attente ne la débloquera, l'annoncer serait un faux espoir.
  const g = vieSur({ 11101: { ...CASE_OK, state: 'locked' } });
  const s0 = g.simulateDay().sessions[0];
  assert.ok(!s0.acts.some(a => a.kind === 'lf'), 'pas proposée');
  assert.ok(!s0.waits.some(x => /Secteur résidentiel/.test(x.what)), 'pas en attente non plus');
});

t('page lue mais aucun prix : la carte demande d\'ouvrir une case', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { lvl: 24, state: 'short' } }; });
  }, SOIR, null, true);
  const m = g.dailyMissions().find(x => x.id === 'lfb');
  assert.ok(m, 'le copilote connaît les niveaux mais pas les prix : il doit le dire');
  assert.ok(/case/.test(m.what + m.why),
    'et demander d\'ouvrir une case, pas de relever la page : ' + m.what);
  assert.ok(/1 case/.test(m.why), 'en disant ce qu\'il a déjà lu : ' + m.why);
});

t('une case verrouill\u00e9e n\'est pas propos\u00e9e', () => {
  const a = premierLf(vieSur({ 11104: { lvl: 0, state: 'locked' } }));
  assert.ok(!a, 'un prérequis manquant n\'est pas une action');
});

t('sans prix connu, le copilote demande d\'ouvrir la page une fois', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { lvl: 24, state: 'ok' } }; });
  }, SOIR, null, true);
  assert.ok(!premierLf(g), 'on ne propose pas ce qu\'on ne sait pas chiffrer');
  const m = g.dailyMissions().find(x => x.id === 'lfb');
  assert.ok(m && /Clique une case/.test(m.what),
    'il demande d\'ouvrir une case : ' + (m && m.what));
});

t('la carte ne r\u00e9clame plus rien quand tout est trop cher', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { ...CASE_OK, state: 'short' } }; });
  }, SOIR, null, true);
  assert.ok(!g.dailyMissions().some(m => m.id === 'lfb'),
    'le joueur n\'a pas de quoi : le lui rappeler toutes les deux heures ne sert à rien');
});

/* ---------- lire les formes de vie sur la page ---------- */

t('chaque identifiant tombe dans la bonne file', () => {
  const g = app();
  // relevé : 111xx bâtiments des Humains, 112xx leurs recherches
  assert.equal(g.lfQueue(11101), 'lfbuilding', 'Secteur résidentiel');
  assert.equal(g.lfQueue(11201), 'lfresearch', 'Ambassadeurs intergalactiques');
  // la race suivante décale de deux séries
  assert.equal(g.lfQueue(11301), 'lfbuilding');
  assert.equal(g.lfQueue(11401), 'lfresearch');
});

t('la durée de production se lit au format du jeu', () => {
  const g = app();
  assert.equal(g.lfSecs('PT30M34S'), 1834, 'relevé sur Secteur résidentiel 25');
  assert.equal(g.lfSecs('PT1H2M3S'), 3723);
  assert.equal(g.lfSecs('PT45S'), 45);
  assert.equal(g.lfSecs(null), 0, 'pas de durée affichée : on ne devine pas');
});

t('chaque ligne de coût est rangée dans la bonne ressource', () => {
  const g = app();
  assert.equal(g.lfRes('resource metal icon sufficient tooltip'), 0);
  assert.equal(g.lfRes('resource crystal icon insufficient tooltip'), 1);
  assert.equal(g.lfRes('resource deuterium icon tooltip'), 2);
  // une classe inconnue ne doit pas atterrir dans le métal par défaut
  assert.equal(g.lfRes('resource energy icon'), -1);
});

/* ---------- ce que le script pose sur la page du jeu ---------- */

/* Relevé sur la page Recherche : Astrophysique 5, cristal insuffisant. */
const ASTRO = {
  planetId: '33657643',
  costs: [
    { cls: 'resource metal icon sufficient tooltip js_hideTipOnMobile', value: 37515 },
    { cls: 'resource crystal icon insufficient tooltip js_hideTipOnMobile', value: 75031 },
    { cls: 'resource deuterium icon sufficient tooltip js_hideTipOnMobile', value: 37515 }
  ],
  stock: [709703, 36384, 48432]
};
const SKIN = { hints: {}, rates: { '33657643': [12000, 6000, 3000] }, lean: false };

t('la page annonce le d\u00e9lai de la ressource qui manque', () => {
  // 75 031 - 36 384 = 38 647 cristal à 6 000/h
  assert.equal(runPage({ ...ASTRO, skin: SKIN }).eta, 'Payable dans 6h 27m');
});

t('la ligne sort de la bo\u00eete de co\u00fbt, qui la rognait', () => {
  const r = runPage({ ...ASTRO, skin: SKIN });
  assert.equal(r.etaParent, 'technologydetails',
    'posée dans .costs, elle était créée mais invisible');
});

t('rien \u00e0 annoncer quand tout est pay\u00e9', () => {
  assert.equal(runPage({ ...ASTRO, skin: SKIN, stock: [999999, 999999, 999999] }).eta, null);
});

t('sans d\u00e9bit connu, pas de d\u00e9lai invent\u00e9', () => {
  const r = runPage({ ...ASTRO, skin: { hints: {}, rates: {}, lean: false } });
  assert.equal(r.eta, null, 'le panneau n\'a pas publié ce débit');
});

t('une production nulle est annonc\u00e9e comme telle', () => {
  const r = runPage({ ...ASTRO, skin: { hints: {}, rates: { '33657643': [12000, 0, 3000] }, lean: false } });
  assert.ok(/Hors de port\u00e9e/.test(r.eta), r.eta);
});

/* Une planète voisine qui a le stock et les transporteurs : deux grands
   transporteurs couvrent les 38 647 cristal, et le vol dure 10 minutes. */
const DONNEUR = {
  ...SKIN,
  donors: { '33657643': [{ n: 'Caribou', st: [500000, 100000, 50000], lc: 2, sc: 0, sec: [600, 900] }] },
  cargo: [25000, 5000]
};

t('une livraison plus rapide que la production est propos\u00e9e', () => {
  const r = runPage({ ...ASTRO, skin: DONNEUR });
  assert.ok(/Payable dans 6h 27m/.test(r.eta), r.eta);
  assert.ok(/Ou fais livrer .*cristal depuis Caribou : 2 GT, 10m de vol/.test(r.eta), r.eta);
});

t('l\'aller \u00e0 vide est compt\u00e9 et nomm\u00e9', () => {
  const loin = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], out: [1200, 1500], base: 'Planète mère' }] } };
  const r = runPage({ ...ASTRO, skin: loin });
  // 600 de vol chargé + 1 200 à vide = 30 minutes en tout
  assert.ok(/2 GT, 30m de vol — à envoyer d'abord à vide depuis Planète mère/.test(r.eta), r.eta);
});

t('le t\u00e9moin dit qui peut livrer', () => {
  const d = runPage({ ...ASTRO, skin: DONNEUR }).dataset.copilote;
  assert.ok(/donneurs=Caribou:2GT\+0PT/.test(d), d);
  // une charge d'avant la livraison se reconnaît, au lieu de passer pour un
  // empire sans donneur
  const vieux = runPage({ ...ASTRO, skin: SKIN }).dataset.copilote;
  assert.ok(/donneurs=charge ancienne/.test(vieux), vieux);
});

t('une livraison plus lente se dit, sans se faire passer pour mieux', () => {
  // Le joueur tranche : lui seul sait ce que sa flotte a d'autre à faire.
  const lent = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], sec: [40000, 50000] }] } };
  const r = runPage({ ...ASTRO, skin: lent });
  assert.ok(/Payable dans 6h 27m/.test(r.eta), r.eta);
  assert.ok(/^Livraison plus lente que ta production : 38.647 cristal depuis Caribou/m.test(r.eta), r.eta);
});

t('la ligne revient d\u00e8s que le jeu refait son panneau', () => {
  // Le jeu reconstruit le détail à chaque tuile ouverte : attendre le tour de
  // garde suivant laissait la ligne absente jusqu'à cinq secondes, et elle
  // passait pour capricieuse.
  const r = runPage({ ...ASTRO, skin: DONNEUR });
  assert.ok(r.eta, 'elle est là au chargement');
  r.efface();
  assert.equal(r.read().eta, null, 'le jeu vient de l\'emporter');
  r.secousse();
  assert.ok(/Payable dans 6h 27m/.test(r.read().eta), 'elle revient sans attendre');
});

t('la ligne m\u00e8ne au formulaire de flotte, d\u00e9j\u00e0 rempli', () => {
  const pret = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], cp: '33601', vers: '1:142:8', mission: 3 }] } };
  const r = runPage({ ...ASTRO, skin: pret });
  // Mêmes paramètres que les liens du panneau : le jeu remplit son formulaire.
  assert.ok(/component=fleetdispatch/.test(r.etaLink), r.etaLink);
  assert.ok(/cp=33601/.test(r.etaLink), 'on part de la planète qui donne');
  assert.ok(/galaxy=1&system=142&position=8/.test(r.etaLink), r.etaLink);
  assert.ok(/mission=3/.test(r.etaLink), 'Transporter');
  assert.ok(/am203=2/.test(r.etaLink), 'les deux grands transporteurs retenus');
  assert.equal(r.etaLinkText, '→ préparer la livraison');
});

t('sans transporteur sur place, le lien fait d\'abord l\'aller \u00e0 vide', () => {
  const vide = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], out: [1200, 1500], base: 'Planète mère', cp: '33601', vers: '1:142:6', mission: 4 }] } };
  const r = runPage({ ...ASTRO, skin: vide });
  assert.ok(/mission=4/.test(r.etaLink), 'Stationner : sinon la flotte repart aussitôt');
  assert.ok(/galaxy=1&system=142&position=6/.test(r.etaLink), 'vers la planète qui donne, pas vers ici');
  assert.equal(r.etaLinkText, '→ envoyer les transporteurs');
});

t('une donneuse sans identifiant de jeu ne pose pas de lien', () => {
  // avant la synchro, viser « cp=null » enverrait sur la mauvaise planète
  const r = runPage({ ...ASTRO, skin: DONNEUR });
  assert.equal(r.etaLink, null, 'pas de cp publié : pas de lien');
  assert.ok(/Ou fais livrer/.test(r.eta), 'la phrase reste');
});

t('le t\u00e9moin nomme la raison du silence', () => {
  const vide = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], st: [500000, 100, 50000] }] } };
  assert.ok(/livraison=stock/.test(runPage({ ...ASTRO, skin: vide }).dataset.copilote));
  const court = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], lc: 1, sc: 0 }] } };
  assert.ok(/livraison=soute trop petite/.test(runPage({ ...ASTRO, skin: court }).dataset.copilote));
  assert.ok(/livraison=aucune donneuse/.test(runPage({ ...ASTRO, skin: { ...DONNEUR, donors: {} } }).dataset.copilote));
  assert.ok(/livraison=rien ne manque/.test(runPage({ ...ASTRO, skin: DONNEUR, stock: [999999, 999999, 999999] }).dataset.copilote));
  // et quand elle parle, le témoin porte la durée retenue
  assert.ok(/livraison=10m/.test(runPage({ ...ASTRO, skin: DONNEUR }).dataset.copilote));
});

t('un donneur qui n\'a pas le stock ne livre rien', () => {
  const vide = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], st: [500000, 100, 50000] }] } };
  assert.equal(runPage({ ...ASTRO, skin: vide }).eta, 'Payable dans 6h 27m');
});

t('une soute trop petite ne livre rien', () => {
  const court = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], lc: 1, sc: 0 }] } };
  assert.equal(runPage({ ...ASTRO, skin: court }).eta, 'Payable dans 6h 27m');
});

t('sans d\u00e9bit connu, la livraison parle quand m\u00eame', () => {
  // Le hangar ou une production nulle arrêtent la production locale, pas une
  // livraison : c'est justement là qu'elle vaut d'être dite.
  const r = runPage({ ...ASTRO, skin: { ...DONNEUR, rates: {} } });
  assert.ok(/^Ou fais livrer /.test(r.eta), r.eta);
});

t('le t\u00e9moin d\'\u00e9tat dit ce que la page a re\u00e7u', () => {
  const d = runPage({ ...ASTRO, skin: SKIN }).dataset.copilote;
  assert.ok(/debits=33657643/.test(d), d);
  assert.ok(/ici=33657643/.test(d), d);
});

/* ---------- la tournée d'une tuile, dans la page du jeu ---------- */

const TOUR = { hints: {}, rates: {}, lean: false, tour: {
  '33657643': { n: 'Planète mère', b: { '21': 4 }, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] },
  '102': { n: 'Colonie', b: { '21': 2 }, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] },
  '103': { n: 'Lune bleue', b: {}, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] }
} };
const ARRIVEE = { skin: TOUR, tiles: ['21'], search: '?page=ingame&component=facilities&openTech=21' };

/** Les pastilles par nom de planète : l'ordre a son propre test. */
const pins = r => Object.fromEntries(r.map(x => [x.txt.split(' · ')[0], x]));

t('la barre liste les planètes et ouvre la même tuile ailleurs', () => {
  const r = runPage(ARRIVEE).tour;
  assert.equal(r.length, 3);
  assert.equal(pins(r)['Colonie'].txt, 'Colonie · 2 → 3');
  assert.equal(pins(r)['Colonie'].href,
    '/game/index.php?page=ingame&component=facilities&cp=102&openTech=21');
});

t('les pastilles suivent l\'identifiant de planète, pas le hasard', () => {
  // L'ordre vient de JS : des clés entières se parcourent en croissant, ce qui
  // range les planètes par ancienneté — stable d'une page à l'autre.
  assert.deepEqual(runPage(ARRIVEE).tour.map(x => x.txt.split(' · ')[0]),
    ['Colonie', 'Lune bleue', 'Planète mère']);
});

t('la planète courante est marquée et n\'est pas un lien', () => {
  const p = pins(runPage(ARRIVEE).tour)['Planète mère'];
  assert.equal(p.courante, true);
  assert.equal(p.href, null);
});

t('un niveau inconnu se dit, et ne s\'invente pas', () => {
  assert.equal(pins(runPage(ARRIVEE).tour)['Lune bleue'].txt, 'Lune bleue · →');
});

t('sans tuile en main, pas de barre', () => {
  assert.deepEqual(runPage({ ...ARRIVEE, search: '?page=ingame&component=facilities' }).tour, []);
});

t('une tuile inconnue ou absurde ne produit pas de barre', () => {
  for (const q of ['openTech=9e9', 'openTech=__proto__', 'openTech=999']) {
    assert.deepEqual(runPage({ ...ARRIVEE, search: '?page=ingame&component=facilities&' + q }).tour, []);
  }
});

t('une recherche n\'ouvre pas de tournée : une seule file pour l\'empire', () => {
  const r = runPage({ ...ARRIVEE, tiles: ['124'], search: '?page=ingame&component=research&openTech=124' });
  assert.deepEqual(r.tour, []);
});

t('sans tournée publiée, pas de barre', () => {
  assert.deepEqual(runPage({ ...ARRIVEE, skin: { hints: {}, rates: {}, lean: false } }).tour, []);
});

t('seule à porter la tuile, une planète n\'ouvre pas de tournée', () => {
  const seule = { ...TOUR, tour: { '33657643': TOUR.tour['33657643'] } };
  assert.deepEqual(runPage({ ...ARRIVEE, skin: seule }).tour, []);
});

t('une secousse de la page ne duplique pas la barre', () => {
  const p = runPage(ARRIVEE);
  p.secousse();
  assert.equal(p.read().tour.length, 3);
});

const DEPART = { skin: TOUR, tiles: ['21', '1'], search: '?page=ingame&component=facilities' };

t('ouvrir une tuile ouvre la tournée', () => {
  const p = runPage(DEPART);
  assert.deepEqual(p.read().tour, []);
  p.clic('21');
  assert.equal(p.read().tour.length, 3);
});

t('ouvrir une autre tuile change de tournée', () => {
  const p = runPage(DEPART);
  p.clic('21'); p.clic('1');
  assert.deepEqual(p.read().tour, []);   // personne n'a de niveau pour la tuile 1
});

t('un clic l\'emporte sur l\'openTech de l\'arrivée', () => {
  // Arrivé par une pastille, le joueur ouvre une autre tuile : c'est elle qu'il
  // regarde. La barre qui resterait sur la précédente afficherait les niveaux
  // d'un bâtiment dont plus rien à l'écran ne parle.
  const p = runPage({ ...DEPART, search: '?page=ingame&component=facilities&openTech=21' });
  assert.equal(p.read().tour.length, 3, 'à l\'arrivée, la tournée est celle du lien');
  p.clic('1');
  assert.deepEqual(p.read().tour, []);
});

const occupee = { ...TOUR, tour: { ...TOUR.tour,
  '102': { ...TOUR.tour['102'], bq: Date.now() + 5400000 } } };
const pauvre = { ...TOUR, tour: { ...TOUR.tour,
  '102': { ...TOUR.tour['102'], cost: { '21': [1000, 500, 0] }, st: [400, 500, 0] } } };

t('une file occupée se dit, en temps restant', () => {
  const p = pins(runPage({ ...ARRIVEE, skin: occupee }).tour)['Colonie'];
  assert.equal(p.grisee, true);
  assert.ok(/file 2h/.test(p.txt), p.txt);
  assert.ok(p.href, 'grisée mais cliquable');
});

t('une file de plus d\'un jour ne se dit pas en heure du jour', () => {
  // « file jusqu'à 18:17 » pour une file qui finit demain à 18:17 se lit
  // aujourd'hui : un temps restant ne se lit jamais pour un autre.
  const longue = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], bq: Date.now() + 30.5 * 3600000 } } };
  assert.ok(/file 31h/.test(pins(runPage({ ...ARRIVEE, skin: longue }).tour)['Colonie'].txt),
    pins(runPage({ ...ARRIVEE, skin: longue }).tour)['Colonie'].txt);
});

t('un stock trop court nomme ce qui manque', () => {
  const p = pins(runPage({ ...ARRIVEE, skin: pauvre }).tour)['Colonie'];
  assert.equal(p.grisee, true);
  assert.ok(/manque 600 métal/.test(p.txt), p.txt);
});

t('un gros manque s\'écrit au millier, comme le jeu écrit ses coûts', () => {
  const gros = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], cost: { '21': [0, 176844, 0] }, st: [0, 0, 0] } } };
  const p = pins(runPage({ ...ARRIVEE, skin: gros }).tour)['Colonie'];
  assert.ok(/manque 177K cristal/.test(p.txt), p.txt);
  assert.ok(/hors de portée/.test(p.txt), p.txt);
});

t('un manque en millions se dit en millions', () => {
  const million = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], cost: { '21': [1240000, 0, 0] }, st: [0, 0, 0] } } };
  assert.ok(/manque 1.2M métal/.test(pins(runPage({ ...ARRIVEE, skin: million }).tour)['Colonie'].txt));
});

t('un coût inconnu ne fait pas manquer', () => {
  const p = pins(runPage(ARRIVEE).tour)['Colonie'];
  assert.equal(p.grisee, false);
  assert.ok(!/manque/.test(p.txt), p.txt);
});

t('une recherche de forme de vie lit sa propre file, pas celle des bâtiments', () => {
  // 112xx : par planète comme les bâtiments de forme de vie, mais pas la même
  // file. Lire `lfq` pour une recherche annonce « libre » une planète occupée.
  const lfr = { hints: {}, rates: {}, lean: false, tour: {
    '33657643': { n: 'Planète mère', b: { '11201': 3 }, cost: {}, bq: 0, lfq: 0, lfr: 0, st: [0, 0, 0] },
    '102': { n: 'Colonie', b: { '11201': 1 }, cost: {}, bq: 0, lfq: 0,
      lfr: Date.now() + 5400000, st: [0, 0, 0] }
  } };
  const r = runPage({ skin: lfr, tiles: ['11201'],
    search: '?page=ingame&component=lfresearch&openTech=11201' });
  assert.ok(/file 2h/.test(pins(r.tour)['Colonie'].txt), pins(r.tour)['Colonie'].txt);
});

t('un bâtiment de forme de vie lit toujours la file des bâtiments', () => {
  const lfb = { hints: {}, rates: {}, lean: false, tour: {
    '33657643': { n: 'Planète mère', b: { '11101': 3 }, cost: {}, bq: 0, lfq: 0, lfr: 0, st: [0, 0, 0] },
    '102': { n: 'Colonie', b: { '11101': 1 }, cost: {}, bq: 0, lfr: 0,
      lfq: Date.now() + 5400000, st: [0, 0, 0] }
  } };
  const r = runPage({ skin: lfb, tiles: ['11101'],
    search: '?page=ingame&component=lfbuildings&openTech=11101' });
  assert.ok(/file 2h/.test(pins(r.tour)['Colonie'].txt), pins(r.tour)['Colonie'].txt);
});

t('une page que le copilote ne connaît pas ne reçoit rien', () => {
  /* Le copilote ne dessine que sur les pages où ses propres liens mènent.
     Une URL forgée — ouverte depuis un message, ou nommant deux fois la page
     pour que le serveur et nous ne lisions pas la même — n'en fait pas partie,
     et il n'y a donc rien à contourner. */
  for (const q of ['component=facilities%26component%3Dfleetdispatch',
    'component=alliance&component=facilities',
    'component=facilities&component=alliance',
    'component=boutique', 'component=']) {
    const r = runPage({ ...ARRIVEE, search: '?page=ingame&' + q + '&openTech=21' });
    assert.deepEqual(r.tour, [], q);
    assert.equal(r.bande, null, q);
  }
});

t('et la page nommée par `page` compte autant que celle nommée par `component`', () => {
  const r = runPage({ ...ARRIVEE, search: '?page=alliance&openTech=21' });
  assert.deepEqual(r.tour, []);
  assert.equal(r.bande, null);
});

t('le stock publié avance avec la production entre deux envois', () => {
  // Le panneau ne republie que toutes les 30 s, et seulement ouvert sur
  // Aujourd'hui : un stock gelé grise une planète qui paie depuis une heure.
  const vieux = { hints: {}, rates: { '102': [3600, 0, 0] }, lean: false, tour: {
    '33657643': TOUR.tour['33657643'],
    '102': { n: 'Colonie', b: { '21': 2 }, cost: { '21': [1000, 0, 0] }, bq: 0, lfq: 0,
      st: [0, 0, 0], at: Date.now() - 3600000 }
  } };
  const p = pins(runPage({ ...ARRIVEE, skin: vieux }).tour)['Colonie'];
  assert.ok(!/manque/.test(p.txt), p.txt);
  assert.equal(p.grisee, false);
});

t('le témoin dit la tuile en main et le nombre de planètes reçues', () => {
  // Sans barre, le joueur ne sait pas laquelle des trois conditions manque :
  // la tournée publiée, la tuile ouverte, ou deux planètes qui la connaissent.
  assert.ok(/tournee=21:3/.test(runPage(ARRIVEE).dataset.copilote), runPage(ARRIVEE).dataset.copilote);
  const muet = runPage({ ...ARRIVEE, skin: { hints: {}, rates: {}, lean: false } });
  assert.ok(/tournee=21:0/.test(muet.dataset.copilote), muet.dataset.copilote);
  const sansTuile = runPage({ ...ARRIVEE, search: '?page=ingame&component=facilities' });
  assert.ok(/tournee=-:3/.test(sansTuile.dataset.copilote), sansTuile.dataset.copilote);
});

t('sans tuile ouverte, la barre suit celle que le copilote conseille', () => {
  const conseil = { ...TOUR, hints: { '33657643': { '21': 5 } } };
  const r = runPage({ skin: conseil, tiles: ['21'], search: '?page=ingame&component=facilities' });
  assert.equal(r.tour.length, 3, 'la barre est là dès l\'arrivée sur la page');
});

t('un conseil qui n\'est pas sur cette page n\'ouvre pas de tournée', () => {
  // Le copilote conseille la mine de métal, qui vit sur Ressources : sur
  // Installations, un lien vers cette tuile ne mènerait nulle part.
  const ailleurs = { ...TOUR, hints: { '33657643': { '1': 9 } } };
  const r = runPage({ skin: ailleurs, tiles: ['21'], search: '?page=ingame&component=facilities' });
  assert.deepEqual(r.tour, []);
});

t('une tuile ouverte l\'emporte sur le conseil', () => {
  const conseil = { ...TOUR, hints: { '33657643': { '21': 5 } },
    tour: { ...TOUR.tour, '102': { ...TOUR.tour['102'], b: { '21': 2, '1': 7 } },
      '33657643': { ...TOUR.tour['33657643'], b: { '21': 4, '1': 9 } } } };
  const p = runPage({ skin: conseil, tiles: ['21', '1'], search: '?page=ingame&component=facilities' });
  assert.equal(p.read().tour.length, 3);
  p.clic('1');
  assert.equal(pins(p.read().tour)['Colonie'].txt, 'Colonie · 7 → 8');
});

t('une pastille dit quand la planète pourra payer', () => {
  const lent = { hints: {}, rates: { '102': [1000, 0, 0] }, lean: false, tour: {
    '33657643': TOUR.tour['33657643'],
    '102': { n: 'Colonie', b: { '21': 2 }, cost: { '21': [3000, 0, 0] }, bq: 0, lfq: 0, st: [0, 0, 0] }
  } };
  const p = pins(runPage({ ...ARRIVEE, skin: lent }).tour)['Colonie'];
  assert.ok(/manque/.test(p.txt) && /payable dans 3h/.test(p.txt), p.txt);
});

t('sans production connue, la planète se dit hors de portée', () => {
  const mort = { hints: {}, rates: {}, lean: false, tour: {
    '33657643': TOUR.tour['33657643'],
    '102': { n: 'Colonie', b: { '21': 2 }, cost: { '21': [3000, 0, 0] }, bq: 0, lfq: 0, st: [0, 0, 0] }
  } };
  const p = pins(runPage({ ...ARRIVEE, skin: mort }).tour)['Colonie'];
  assert.ok(/hors de portée/.test(p.txt), p.txt);
  assert.ok(!/payable/.test(p.txt), p.txt);
});

t('une tournée mal formée ne casse pas la surcouche', () => {
  const casse = { ...TOUR, tour: { ...TOUR.tour, '104': null,
    '105': { n: 'X', b: { '21': 1 }, cost: { '21': 'beaucoup' }, bq: 0, lfq: 0, st: [0, 0, 0] } } };
  const r = runPage({ ...ARRIVEE, skin: casse });
  assert.ok(/ici=33657643/.test(r.dataset.copilote), 'la peinture va jusqu\'au bout');
});

/* ---------- la bande du bas ---------- */

const BANDE = { hints: {}, rates: {}, lean: false, tour: {}, band: { pages: {
  facilities: [{ what: 'Usine de robots 7', ou: 'Caribou Land', why: 'Accélère les constructions',
    url: '/game/index.php?page=ingame&component=facilities&cp=101' }],
  galaxy: [{ what: 'Espionner 1:140:6', ou: '', why: '',
    url: '/game/index.php?page=ingame&component=galaxy' }]
} } };

t('la bande ne se dessine pas sur les pages écrites par les joueurs', () => {
  // Alliance, messages, discussion : leur contenu vient d'autres joueurs. Elles
  // ne sont pas dans la liste des pages du copilote, donc rien ne s'y dessine.
  for (const comp of ['alliance', 'messages', 'chat', 'buddies']) {
    const r = runPage({ skin: TOUR, tiles: ['21'],
      search: '?page=ingame&component=' + comp + '&openTech=21' });
    assert.equal(r.bande, null, comp);
    assert.deepEqual(r.tour, [], comp);
  }
});

t('un bloc de cases vide ne devient pas l\'hôte de la bande', () => {
  // Une page d'alliance affiche du balisage écrit par d'autres joueurs, et il
  // vit dans le contenu du jeu : l'identifiant ne prouve donc rien. L'ancre se
  // déduit d'une vraie case, pas d'un nom.
  const r = runPage({ skin: BANDE, search: '?page=ingame&component=galaxy', casesIntruses: true });
  assert.equal(r.bandeEnTete, true, 'la bande reste en tête du contenu du jeu');
});

t('une page sans cases reçoit la bande en tête du contenu', () => {
  // Galaxie, Flotte, Vue d'ensemble : pas de bloc de cases où se glisser.
  assert.equal(runPage({ skin: BANDE, search: '?page=ingame&component=galaxy' }).bandeEnTete, true);
});

t('la bande porte ce qui se fait sur la page ouverte', () => {
  const b = runPage({ skin: BANDE, search: '?page=ingame&component=facilities' }).bande;
  assert.deepEqual(b.ici.map(x => x.txt), ['Usine de robots 7 · Caribou Land']);
  assert.equal(b.ici[0].why, 'Accélère les constructions', 'le pourquoi tient dans l\'infobulle');
  assert.ok(b.ici[0].href);
});

t('une ligne qui attend ses ressources se grise et porte sa date', () => {
  const att = { ...BANDE, band: { pages: { facilities: [{ what: 'Usine de robots 7',
    ou: 'Caribou Land', quand: 'vers 16:40', why: 'Il manque 1 000 métal',
    url: '/game/index.php?page=ingame&component=facilities&cp=101', gris: true }] } } };
  const b = runPage({ skin: att, search: '?page=ingame&component=facilities' }).bande;
  // l'heure tient en un seul morceau : espace insécable, sinon « vers » reste
  // sur la ligne de l'action et l'heure tombe toute seule à la ligne suivante
  assert.equal(b.ici[0].txt, 'Usine de robots 7 · Caribou Land ·\u00a0vers\u00a016:40');
  assert.equal(b.ici[0].grisee, true, 'ce n\'est pas lançable maintenant');
  assert.ok(b.ici[0].href, 'mais la page reste à un clic');
});

t('chaque page montre ses propres lignes', () => {
  const b = runPage({ skin: BANDE, search: '?page=ingame&component=galaxy' }).bande;
  assert.deepEqual(b.ici.map(x => x.txt), ['Espionner 1:140:6']);
});

t('une page dont le copilote n\'a rien à dire n\'a pas de bande', () => {
  assert.equal(runPage({ skin: BANDE, search: '?page=ingame&component=alliance' }).bande, null);
  assert.equal(runPage({ skin: { hints: {}, rates: {}, lean: false } }).bande, null);
});

t('la tournée et les lignes de la page tiennent dans la même bande', () => {
  const deux = { ...TOUR, band: BANDE.band };
  const r = runPage({ skin: deux, tiles: ['21'],
    search: '?page=ingame&component=facilities&openTech=21' });
  assert.equal(r.bande.ici.length, 1, 'ce qui se fait ici');
  assert.equal(r.tour.length, 3, 'et la tournée, dans la même bande');
});

t('un chiffre qui bouge met la bande à jour, il ne la repose pas', () => {
  // Les manques et les délais bougent sans arrêt : démolir la bande à chaque
  // fois, c'est la faire clignoter sous les yeux du joueur.
  const p = runPage(ARRIVEE);
  const pose = p.read().poses;
  const bouge = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], cost: { '21': [9000, 0, 0] }, st: [0, 0, 0] } } };
  p.majSkin(bouge);
  assert.equal(p.read().poses, pose, 'la même bande, mise à jour');
  assert.ok(/manque 9K métal/.test(pins(p.read().tour)['Colonie'].txt), pins(p.read().tour)['Colonie'].txt);
});

t('une planète qui entre dans la tournée repose la bande', () => {
  const p = runPage(ARRIVEE);
  const pose = p.read().poses;
  const { '103': _, ...moins } = TOUR.tour;
  p.majSkin({ ...TOUR, tour: moins });
  assert.ok(p.read().poses > pose, 'la forme a changé : on repose');
  assert.equal(p.read().tour.length, 2);
});

t('un élément de la page qui porte notre classe n\'est ni réécrit ni retiré', () => {
  // Les pages d'alliance affichent du contenu écrit par d'autres joueurs : la
  // bande ne se retrouve donc pas par sa classe, mais par ce que ce script a
  // posé lui-même.
  const r = runPage({ skin: BANDE, search: '?page=ingame&component=galaxy', intruse: true });
  assert.equal(r.bandes, 2, 'l\'intruse est restée, la nôtre s\'est ajoutée');
  assert.deepEqual(r.bande.ici.map(x => x.txt), ['Espionner 1:140:6']);
});

t('la bande se pose sous l\'illustration, quelle que soit la page', () => {
  // `#middle > .maincontent` est le squelette commun : une seule place, haute,
  // et jamais à l'intérieur d'un encadré du jeu — la page Recherche range ses
  // cases en quatre listes côte à côte, s'y glisser cassait sa mise en page.
  const quatre = runPage({ skin: TOUR, tiles: [['21', '1'], ['124', '113']],
    search: '?page=ingame&component=research&openTech=21' });
  assert.equal(quatre.bandeSousIllustration, true, 'sous l\'illustration, au-dessus des cases');
  assert.equal(quatre.tour.length, 3, 'et la tournée reste');
  assert.equal(runPage(ARRIVEE).bandeSousIllustration, true, 'même place à une seule liste');
});

t('une secousse ne duplique pas la bande', () => {
  const p = runPage({ skin: BANDE, search: '?page=ingame&component=galaxy' });
  p.secousse();
  assert.equal(p.read().bande.ici.length, 1);
});

t('le témoin dit ce que la bande a trouvé à dire', () => {
  assert.ok(/bande=1:0/.test(runPage({ skin: BANDE, search: '?page=ingame&component=galaxy' }).dataset.copilote));
  assert.ok(/bande=0:3/.test(runPage(ARRIVEE).dataset.copilote));
  assert.ok(/bande=rien/.test(runPage({ skin: BANDE, search: '?page=ingame&component=alliance' }).dataset.copilote));
});

t('une feuille de style laissée par l\'ancienne version est remplacée', () => {
  // Recharger l'extension sans recharger la page réinjecte le script : le JS
  // est neuf, le <style> de la version d'avant est toujours là. Laisser
  // l'ancien, c'était des éléments neufs sans aucun style.
  const r = runPage({ skin: BANDE, vieuxStyle: '.copilote-eta{color:red}' });
  assert.ok(/copilote-bande/.test(r.styleTxt), 'la feuille porte les règles de cette version');
  assert.equal(r.styles, 1, 'une seule feuille, pas deux');
});

/* ---------- la largeur ---------- */

const LARGE = { ...BANDE, large: true };
const marques = r => [r.large.cadre, r.large.menu, r.large.jeu, r.large.planetes].join(' ');

t('réglage éteint : la page du jeu n\'est pas touchée', () => {
  const r = runPage({ skin: BANDE });
  assert.ok(!/copilote-large/.test(r.large.racine), 'pas de classe sur la racine');
  assert.ok(!/copilote-c/.test(marques(r)), 'ni cadre ni colonne marqués');
  assert.ok(/large=éteint/.test(r.dataset.copilote), r.dataset.copilote);
});

t('réglage allumé : le cadre et ses trois colonnes sont marqués', () => {
  const r = runPage({ skin: LARGE });
  assert.ok(/copilote-large/.test(r.large.racine));
  assert.ok(/copilote-cadre/.test(r.large.cadre), 'le cadre se déduit des deux bords');
  assert.ok(/copilote-col-menu/.test(r.large.menu));
  assert.ok(/copilote-col-jeu/.test(r.large.jeu));
  assert.ok(/copilote-col-planetes/.test(r.large.planetes));
  assert.ok(/large=posé/.test(r.dataset.copilote), r.dataset.copilote);
});

t('une secousse ne remarque pas deux fois le cadre', () => {
  const r = runPage({ skin: LARGE });
  r.secousse();
  assert.equal((r.read().large.cadre.match(/copilote-cadre/g) || []).length, 1);
});

t('page que le copilote ne connaît pas : la largeur ne s\'y pose pas', () => {
  const r = runPage({ skin: LARGE, search: '?page=ingame&component=alliance' });
  assert.ok(!/copilote-large/.test(r.large.racine), 'du contenu écrit par d\'autres joueurs reste intact');
  assert.ok(!/copilote-c/.test(marques(r)));
  assert.ok(/large=hors page/.test(r.dataset.copilote), r.dataset.copilote);
});

t('sans liste de planètes, le cadre ne se déduit pas et rien ne bouge', () => {
  const r = runPage({ skin: LARGE, planetList: false });
  assert.ok(!/copilote-c/.test(marques(r)), 'tout ou rien : pas de mise en page à moitié posée');
  assert.ok(/large=sans planètes/.test(r.dataset.copilote), r.dataset.copilote);
});

t('ce qui n\'est pas une colonne prend sa propre ligne', () => {
  // le jeu range sa barre de ressources dans le cadre : dans un flanc, elle
  // se retrouvait collée au menu
  const r = runPage({ skin: LARGE });
  assert.ok(/copilote-rang/.test(r.large.haut), 'la barre du jeu barre la rangée');
  assert.ok(!/copilote-rang/.test(marques(r)), 'aucune colonne ne la prend');
});

t('la feuille porte les règles de la largeur', () => {
  assert.ok(/copilote-col-jeu/.test(runPage({ skin: LARGE }).styleTxt));
});

/* ---------- notre dessin de la page ---------- */

const AVEC_PEAU = { ...BANDE, peau: true };
const SUR_RESSOURCES = { search: '?page=ingame&component=supplies', tiles: [1, 2, 4] };

t('réglage éteint : le jeu garde sa page', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: BANDE });
  assert.ok(!r.peau.posee, 'aucun panneau');
  assert.ok(!/copilote-peau/.test(r.peau.racine), 'rien de poussé hors de l\'écran');
  assert.ok(/peau=éteinte/.test(r.dataset.copilote), r.dataset.copilote);
});

t('réglage allumé : une case dessinée par case du jeu', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.posee, 'le panneau est posé');
  assert.equal(r.peau.cases, 3, 'trois cases lues, trois cases dessinées');
  assert.ok(/copilote-peau/.test(r.peau.racine), 'la page du jeu part hors de l\'écran');
  assert.ok(/peau=posée/.test(r.dataset.copilote), r.dataset.copilote);
});

t('une case en chantier dit son temps sur la carte', () => {
  /* Le jeu l'écrit en tout petit, en blanc, sur l'image : illisible d'un
     coup d'œil. La carte le dit en bas, en clair. */
  /* L'heure est figée le temps de la mesure : sinon la milliseconde écoulée
     entre la pose et la lecture fait basculer la minute affichée. */
  const vraie = Date.now;
  Date.now = () => 1700000000000;
  let r;
  try { r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU,
    enChantier: { tech: 2, fin: 1700000000 + 5400, vise: 13 } }); }
  finally { Date.now = vraie; }
  assert.deepEqual(r.peau.chantiers, ['→ 13 · 1 h 30']);
});

t('sans chantier, aucune carte ne porte de minuteur', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.deepEqual(r.peau.chantiers, []);
});

t('les groupes du jeu restent des groupes', () => {
  /* Recherche range ses cases en quatre encadrés, le Chantier en deux :
     tout aplatir en une grille perdrait ce que le jeu dit de ses cases. */
  const r = runPage({ ...SUR_RESSOURCES, tiles: [[1, 2], [3, 4, 12]], skin: AVEC_PEAU });
  assert.equal(r.peau.grilles, 2, 'deux listes, deux grilles');
  assert.equal(r.peau.cases, 5, 'et les cinq cases');
});

t('le nom d\'une case vient du jeu, pas de notre table', () => {
  /* Notre table ne connaît que trente-quatre cases ; le jeu en nomme des
     dizaines d'autres, formes de vie comprises, et dans la langue du joueur. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.deepEqual(r.peau.noms, ['Case 1', 'Case 2', 'Case 4'],
    'l\'étiquette du jeu gagne, et son niveau entre parenthèses ne la suit pas');
});

t('le titre de la page vient du jeu', () => {
  // faute d'en-tête dans cette page de test, c'est l'entrée du menu qui mène
  // ici — dans les mots du jeu, jamais dans les nôtres
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.equal(r.peau.titre, 'Ressources');
});

t('une secousse ne repose pas le panneau', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.secousse();
  assert.equal(r.read().peau.cases, 3, 'toujours trois cases, pas six');
});

t('page à cases sans case : le contenu du jeu reste entier', () => {
  /* La peau ne sait dessiner que ce qu'elle a lu. Sans case, elle s'en tient
     au cadre — rien ne part hors de l'écran derrière un panneau absent. */
  const r = runPage({ search: '?page=ingame&component=supplies', skin: AVEC_PEAU });
  assert.ok(!r.peau.posee, 'aucun panneau');
  assert.ok(!/copilote-peau-grille/.test(r.peau.racine), 'le contenu du jeu reste en place');
  assert.ok(/peau=cadre/.test(r.dataset.copilote), r.dataset.copilote);
});

t('Galaxie prend le cadre, pas la grille', () => {
  /* Son contenu est un tableau du jeu : il reste entier, et la page reçoit
     le rail, les planètes et la colonne. */
  const r = runPage({ skin: AVEC_PEAU, tiles: [1, 2], search: '?page=ingame&component=galaxy' });
  assert.ok(!r.peau.posee, 'aucune grille');
  assert.ok(!/copilote-peau-grille/.test(r.peau.racine), 'son tableau reste en place');
  assert.ok(r.peau.rail.length > 0, 'mais le rail est là');
  assert.ok(r.peau.planetesEnHaut, 'et les planètes aussi, en haut');
  assert.ok(/peau=cadre/.test(r.dataset.copilote), r.dataset.copilote);
});

t("la page publie le lien du jeu vers le paramétrage de la production", () => {
  /* Cette adresse-là, le copilote ne la devine pas : selon la version elle
     s'ouvre par `component=` ou par `page=`. Il lit celle que la page affiche,
     mais il la reconstruit : la forme du paramètre, rien d'autre. */
  const lien = 'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings&cp=33657643';
  const r = runPage({ search: '?page=ingame&component=supplies', prodHref: lien });
  assert.equal(r.envois().find(m => m.type === 'snapshot').data.prodUrl,
    'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings');
});

t("un lien pi\u00e9g\u00e9 dans la page du jeu n'est pas suivi", () => {
  /* Le DOM contient ce que d'autres joueurs y \u00e9crivent : messages, pages
     d'alliance. Un lien qui porte le bon mot ne suffit pas \u00e0 \u00eatre cru. */
  const pieges = [
    'https://evil.example/game/index.php?page=resourceSettings',
    'https://s1-fr.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch&x=resourcesettings',
    'https://s1-fr.ogame.gameforge.com/forum/index.php?page=resourceSettings'
  ];
  for (const lien of pieges) {
    const r = runPage({ search: '?page=ingame&component=supplies', prodHref: lien });
    assert.equal(r.envois().find(m => m.type === 'snapshot').data.prodUrl, null, lien);
  }
});

t("la page dit si l'univers a des formes de vie, d'après le menu du jeu", () => {
  const avec = runPage({ search: '?page=ingame&component=supplies', menuLf: true });
  assert.strictEqual(avec.envois().find(m => m.type === 'snapshot').data.lfMenu, true);
  const sans = runPage({ search: '?page=ingame&component=supplies' });
  assert.strictEqual(sans.envois().find(m => m.type === 'snapshot').data.lfMenu, false);
});

t("le prix d'une case part dès qu'il arrive, sans attendre le battement", () => {
  /* Le jeu charge le panneau de détail après la page. Tant que son prix
     attendait le tour de garde de cinq secondes, un relevé qui laisse quatre
     secondes à une page ne le voyait jamais : il ouvrait la case et repartait
     avant qu'elle réponde. */
  const r = runPage({ search: '?page=ingame&component=lfbuildings&openTech=11101' });
  const avant = r.envois().filter(m => m.type === 'snapshot').length;
  r.detailArrive(11101, [['resource metal', 1200], ['resource crystal', 600]]);
  const envois = r.envois().filter(m => m.type === 'snapshot');
  assert.ok(envois.length > avant, "l'arrivée du panneau doit partir tout de suite");
  const lf = envois[envois.length - 1].data.lf[11101];
  assert.deepEqual(lf.cost, [1200, 600, 0]);
});

t("une secousse qui ne touche pas au panneau de détail n'envoie rien de plus", () => {
  // sinon chaque remuement de la page du jeu referait tout l'instantané
  const r = runPage({ search: '?page=ingame&component=lfbuildings' });
  const avant = r.envois().filter(m => m.type === 'snapshot').length;
  r.secousse();
  assert.equal(r.envois().filter(m => m.type === 'snapshot').length, avant);
});

t("une page sans ce lien n'en invente pas", () => {
  const r = runPage({ search: '?page=ingame&component=supplies' });
  assert.equal(r.envois().find(m => m.type === 'snapshot').data.prodUrl, null);
});

t('la page Flotte est habillée, pas redessinée', () => {
  /* Ses cases portent le champ qui dit combien de vaisseaux partent : refaire
     ce champ, ce serait refaire l'envoi. On les reconnaît à ça, et on ne fait
     que les habiller — le formulaire du jeu reste le sien. */
  const r = runPage({ skin: AVEC_PEAU, tiles: [1, 2], champsFlotte: true,
    search: '?page=ingame&component=fleetdispatch' });
  assert.ok(/cp-flotte/.test(r.peau.flotte), 'la liste est habillée');
  assert.ok(/copilote-peau-flotte/.test(r.peau.racine));
  assert.ok(!r.peau.posee, 'et le contenu du jeu reste le sien');
});

t('sans champ dans les cases, rien ne se prend pour la Flotte', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(!/cp-flotte/.test(r.peau.flotte));
  assert.ok(!/copilote-peau-flotte/.test(r.peau.racine));
});

t('Empire prend le cadre, que le copilote n\'y conseille rien', () => {
  /* Empire n'est pas une page où le copilote parle — elle n'est pas dans sa
     liste — mais le cadre, lui, n'a rien à dire : il range. */
  const r = runPage({ skin: AVEC_PEAU, search: '?page=ingame&component=empire' });
  assert.ok(/copilote-large/.test(r.peau.racine), 'la largeur vient avec le cadre');
  assert.ok(r.peau.rail.length > 0, 'et le rail aussi');
  assert.ok(!r.peau.posee, 'son tableau reste au jeu');
  assert.ok(/peau=cadre/.test(r.dataset.copilote), r.dataset.copilote);
});

t('une page hors de la peau ne reçoit rien', () => {
  // Recherche des formes de vie : des cases sans niveau ni panneau de détail
  const r = runPage({ skin: AVEC_PEAU, tiles: [1, 2], search: '?page=ingame&component=lfresearch' });
  assert.ok(!r.peau.posee);
  assert.ok(!/copilote-peau/.test(r.peau.racine));
  assert.ok(!r.peau.planetesEnHaut, 'ses planètes restent au jeu');
  assert.ok(/peau=hors page/.test(r.dataset.copilote), r.dataset.copilote);
});

t('la peau amène la largeur sur la page qu\'elle redessine', () => {
  // réglage de largeur éteint : la grille tiendrait sur trois colonnes
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(/copilote-large/.test(r.large.racine), 'la largeur vient avec');
  assert.ok(/copilote-cadre/.test(r.large.cadre));
  assert.ok(/large=posé/.test(r.dataset.copilote), r.dataset.copilote);
});

t('ailleurs, la peau n\'impose aucune largeur', () => {
  const r = runPage({ skin: AVEC_PEAU, tiles: [1, 2], search: '?page=ingame&component=lfresearch' });
  assert.ok(!/copilote-large/.test(r.large.racine), 'le réglage seul décide');
  assert.ok(/large=éteint/.test(r.dataset.copilote), r.dataset.copilote);
});

t('le panneau de détail du jeu survit à une repeinture', () => {
  /* Il est emprunté au jeu, pas recopié : le jeter avec l'ancien dessin le
     faisait disparaître de la page pour de bon, et plus aucune case ne
     s'ouvrait. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.detailDansPanneau, 'emprunté');
  // le plan change : la peau se repeint entièrement
  r.majSkin({ ...AVEC_PEAU, hints: { 33657643: { 1: 15 } } });
  assert.ok(r.read().detailDansPanneau !== false, 'toujours dans la page');
  assert.ok(r.read().peau.detailDansPanneau, 'et toujours dans le panneau');
});

t('la ligne des mouvements de flotte reste chez le jeu', () => {
  // elle ne déménage plus : la peau la fait taire, et la colonne le dit mieux
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.notifRendue, 'elle est restée à sa place');
});

t('la peau retirée, le panneau de détail rentre chez le jeu', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.scriptNeuf();
  assert.ok(r.read().peau.detailRendu, 'remis là où on l\'a pris');
});

t('une ligne dit quoi, où et quand — le pourquoi va à l\'infobulle', () => {
  /* Dans trois cents pixels, deux phrases d'explication par action noyaient
     les actions. Elles restent lisibles au survol. */
  const avec = { ...AVEC_PEAU, colonne: [{ what: 'Mine de métal 24', ou: 'Mère',
    quand: 'vers 14 h', why: 'Meilleur rendement : amorti en 6h 42m', url: 'x' }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.deepEqual(r.peau.actes, ['Mine de métal 24 | Mère · vers 14 h'],
    'le pourquoi n\'est pas dans la ligne');
});

t('les planètes nommées dans la phrase prennent leur couleur', () => {
  /* « Ramène 34 grands transporteurs de Tarpin land vers Caribou Land » ne
     met aucune planète dans son champ « où » : elles sont dans le texte, et
     c'est là qu'il faut aller les chercher. */
  const avec = { ...AVEC_PEAU, teintes: { 'Tarpin land': 3, 'Caribou Land': 0 },
    colonne: [{ what: 'Ramène 34 grands transporteurs de Tarpin land vers Caribou Land',
      ou: '', quand: '', why: '', url: '' }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.deepEqual(r.peau.actes,
    ['Ramène 34 grands transporteurs de Tarpin land vers Caribou Land | '],
    'le texte reste entier, seulement découpé');
  assert.deepEqual(r.peau.teintes, ['var(--p3)', 'var(--p0)']);
});

t('une planète garde sa couleur en passant dans la page', () => {
  /* Le panneau donne à chaque planète une teinte selon son rang ; la page
     reprend ce rang, pour qu'une planète se reconnaisse sans se lire. */
  const avec = { ...AVEC_PEAU, colonne: [
    { what: 'Mine de métal 24', ou: 'Mère', quand: '', why: '', url: '', pc: 0 },
    { what: 'Hangar 9', ou: 'P4', quand: '', why: '', url: '', pc: 3 },
    { what: 'Recherche', ou: '', quand: 'vers 14 h', why: '', url: '' }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.deepEqual(r.peau.teintes, ['var(--p0)', 'var(--p3)'],
    'une ligne sans planète n\'a pas de teinte');
});

t('tout le haut tient dans une seule bande', () => {
  /* Chaque morceau avait son cadre : six boîtes sur deux lignes au lieu
     d'une barre. La ligne du portail, elle, reste au jeu. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.deepEqual(r.peau.barre,
    ['resourcesbarcomponent', 'planetList', 'cp-bouton'],
    'ce qui monte dans la bande, et rien d\'autre');
});

t('la bande rend ses pièces quand la peau se retire', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.scriptNeuf();
  const apres = r.read();
  assert.deepEqual(apres.peau.barre, [], 'la bande est partie');
  assert.ok(apres.peau.planetesRendues, 'et les planètes sont rentrées chez le jeu');
  assert.ok(apres.peau.notifRendue, 'comme la ligne des mouvements');
});

t('le thème clair se pose et se retire avec la peau', () => {
  const clair = runPage({ ...SUR_RESSOURCES, skin: { ...AVEC_PEAU, clair: true } });
  assert.ok(/copilote-clair/.test(clair.peau.racine), 'le jour');
  const sombre = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(!/copilote-clair/.test(sombre.peau.racine), 'la nuit par défaut');
  clair.scriptNeuf();
  assert.ok(!/copilote-clair/.test(clair.read().peau.racine), 'et rien ne reste');
});

t('la feuille ne connaît plus aucune couleur en dur', () => {
  /* Deux thèmes ne tiennent que si les règles parlent de jetons. Une couleur
     écrite au milieu d'une règle serait juste dans l'un et fausse dans
     l'autre, et personne ne le verrait avant de basculer. */
  const feuille = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU }).styleTxt;
  const peau = feuille.slice(feuille.indexOf('html{--cp-fond'));
  const regles = peau.replace(/--[a-z0-9-]+:[^;}]+/g, '');
  const dures = regles.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || [];
  assert.deepEqual(dures, [], 'couleurs hors des jetons : ' + dures.join(' '));
});

t('le bouton du panneau se pose dans la rangée du haut', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.bouton, 'posé');
  r.scriptNeuf();
  assert.ok(!r.read().peau.bouton, 'et retiré quand la peau se retire');
});

t('la colonne de droite porte ce que le panneau sait', () => {
  // le joueur n'a plus d'onglet à ouvrir pour savoir quoi faire
  const avec = { ...AVEC_PEAU, colonne: [
    { what: 'Mine de métal 24', ou: 'Mère', quand: 'vers 14 h 10', why: '', url: 'x?component=supplies' },
    { what: 'Hangar 9', ou: 'P2', quand: '', why: 'Il manque 48K cristal', url: '', gris: true }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.equal(r.peau.colonne, 2, 'une ligne par action');
  assert.deepEqual(r.peau.cartes, ["aujourd'hui"], 'une seule carte : rien à faire sur cette page');
});

t('ce qui se fait ici a sa propre carte', () => {
  /* La page d'abord, la journée ensuite : le joueur lit la première carte
     et agit, sans trier ce qui le concerne ici de ce qui l'attend ailleurs. */
  const avec = { ...AVEC_PEAU,
    band: { pages: { supplies: [{ what: 'Mine de métal 24', ou: 'Mère', quand: 'vers 14 h', why: '', url: 'x' }] } },
    colonne: [{ what: 'Hangar 9', ou: 'P2', quand: '', why: '', url: '' }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.deepEqual(r.peau.cartes, ['à faire ici', "aujourd'hui"]);
  assert.equal(r.peau.colonne, 2);
});

t('rien à faire : pas de colonne vide', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.equal(r.peau.colonne, 0, 'une colonne sans ligne ne se pose pas');
});

t('les planètes montent sur la ligne du haut', () => {
  /* Dans un flanc étroit, six lignes obligeaient à défiler pour en atteindre
     une ; en haut, elles tiennent sur une ligne, chacune à un clic. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.planetesEnHaut, 'la liste du jeu est sur la rangée du haut');
  assert.ok(/copilote-planetes-haut/.test(r.peau.racine), 'son flanc peut se fermer');
});

t('la peau retirée, les planètes retournent chez le jeu', () => {
  // la liste appartient au jeu : la garder laisserait sa page sans planètes
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.scriptNeuf();
  const apres = r.read();
  assert.ok(apres.peau.planetesRendues, 'remise là où on l\'a prise');
  assert.ok(!/copilote-planetes-haut/.test(apres.peau.racine));
});

t('sans peau, le flanc des planètes reste au jeu', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: BANDE });
  assert.ok(!r.peau.planetesEnHaut);
  assert.ok(r.peau.planetesRendues, 'elles n\'ont pas bougé');
});

t('le rail range les pages par familles', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU }).peau.rail;
  // par préfixe : le lien porte aussi sa touche
  const i = n => r.findIndex(x => x.startsWith(n));
  assert.ok(i('cp-fam:construire') >= 0 && i('cp-lien:Ressources') > i('cp-fam:construire'),
    'Ressources est sous « construire »');
  assert.ok(i('cp-fam:voler') < i('cp-lien:Galaxie'), 'Galaxie est sous « voler »');
  // une page qu'aucune famille ne connaît tombe à la fin, elle ne disparaît pas
  assert.ok(i('cp-fam:autres') >= 0 && i('cp-lien:Nouveauté') > i('cp-fam:autres'),
    'la page inconnue est sous « autres »');
});

t('chaque page du rail dit sa touche', () => {
  // la lettre est à nous, l'adresse vient du menu du jeu
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU }).peau.rail;
  assert.ok(r.includes('cp-lien:Ressources[R]'), r.join(' | '));
  assert.ok(r.includes('cp-lien:Galaxie[G]'));
  // une page qu'on ne connaît pas garde son lien, sans touche
  assert.ok(r.includes('cp-lien:Nouveauté'));
});

t('un menu sans libellé ne devient pas un rail vide', () => {
  // sans rail, le joueur n'aurait plus de quoi quitter la page : on laisse
  // alors le menu du jeu en place, même sous la peau
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU, menuMuet: true });
  assert.equal(r.peau.rail.length, 0, 'aucun rail');
  assert.ok(!/copilote-rail-hote/.test(r.large.menu), 'le menu du jeu reste');
  assert.ok(!r.peau.planetesEnHaut, 'et les planètes ne déménagent pas');
});

t('un script plus neuf arrive : l\'ancien se retire', () => {
  /* Recharger l'extension sans recharger la page laisse l'ancien script en
     vie dans son monde : son observateur bat encore. Sans retrait, le joueur
     voyait deux panneaux et deux bandes se répondre. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.posee, 'posé avant');
  r.scriptNeuf();
  const apres = r.read();
  assert.ok(!apres.peau.posee, 'le panneau est retiré');
  assert.ok(!/copilote-peau|copilote-large/.test(apres.peau.racine), 'les classes partent');
  assert.equal(apres.bandes, 0, 'la bande aussi');
});

t('retiré, l\'ancien script ne redessine plus', () => {
  // son observateur continue de battre : une secousse ne doit rien reposer
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.scriptNeuf();
  r.secousse();
  assert.ok(!r.read().peau.posee, 'rien ne revient');
});

t('la feuille porte les règles de la peau', () => {
  assert.ok(/copilote-peau-panneau/.test(runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU }).styleTxt));
});

/* ---------- ouvrir la bonne page du jeu ---------- */

/** Un empire synchronisé : on connaît le serveur et l'identifiant des planètes. */
const relie = s => {
  s.host = 's199-fr.ogame.gameforge.com';
  s.planets[0].gid = '33601';
  s.planets[1].gid = '33602';
};

t('une mine renvoie sur la page Ressources de sa planète', () => {
  const g = app(relie);
  assert.equal(g.actGo({ kind: 'b', k: 'metal', p: 1 }),
    'https://s199-fr.ogame.gameforge.com/game/index.php?page=ingame&component=supplies&cp=33602');
});

t('le plan se traduit en indices pour la page du jeu', () => {
  const g = app(relie);
  const h = g.planHints([
    { kind: 'b', k: 'metal', lvl: 9, p: 1 },
    { kind: 't', k: 'astro', lvl: 4, p: 0 },
    { kind: 'lf', id: 11101, lvl: 25, p: 0 },
    { kind: 'expo', p: 0 }
  ]);
  // Rangés par planète du jeu, puis par identifiant de tuile, et la valeur est
  // le niveau visé : la page du jeu décide comment l'écrire dans ses tuiles.
  assert.equal(h['33602']['1'], 9, 'la mine de métal porte l\'identifiant 1');
  assert.equal(h['33601']['124'], 4, 'Astrophysique porte le 124');
  assert.equal(h['33601']['11101'], 25);
  assert.deepEqual(Object.keys(h['33601']).sort(), ['11101', '124'],
    'une expédition n\'a pas de tuile à surligner');
});

t('le d\u00e9lai se d\u00e9duit du manque et du d\u00e9bit', () => {
  const g = app();
  assert.equal(g.etaSecs(0, 1000), 0, 'rien ne manque : c\'est payable tout de suite');
  assert.equal(g.etaSecs(2000, 1000), 7200, '2 000 manquants à 1 000/h');
  // une production nulle ou négative n'y arrivera jamais : il faut le dire
  // plutôt que d'afficher un délai rassurant et faux.
  assert.equal(g.etaSecs(2000, 0), Infinity);
  assert.equal(g.etaSecs(2000, -50), Infinity);
});

t('le d\u00e9lai s\'\u00e9crit en heures et minutes', () => {
  const g = app();
  assert.equal(g.hms(7200), '2h 00m');
  // arrondi vers le haut : le bouton doit être cliquable avant l'heure dite
  assert.equal(g.hms(90), '2m');
  assert.equal(g.hms(30), '1m');
  assert.equal(g.hms(Infinity), 'jamais à ce rythme');
});

t('les d\u00e9bits de chaque plan\u00e8te partent vers la page', () => {
  const g = app(relie);
  const r = g.gameSkin([]).rates;
  assert.ok(r['33601'] && r['33601'][0] > 0, 'la planète mère produit du métal');
  assert.equal(r['33601'].length, 3, 'métal, cristal, deutérium');
});

t('un r\u00e9glage de mode reste un mot, les autres des nombres', () => {
  const g = app();
  // Le piège : un mode converti en nombre vaut 0, et le réglage ne prend
  // jamais sans que rien ne le dise.
  assert.equal(g.dayValue('research', 'first', 'normal'), 'first');
  assert.equal(g.dayValue('lf', 'off', 'after'), 'off');
  assert.equal(g.dayValue('focus', 'eco', 'ecocol'), 'eco');
  // un mot hors liste ne remplace pas ce qui est en place
  assert.equal(g.dayValue('research', 'nawak', 'first'), 'first');
  assert.equal(g.dayValue('interval', '90', 60), 90);
  assert.equal(g.dayValue('nightStart', '-3', 23), 0);
});

t('les donneurs voyagent avec les d\u00e9bits', () => {
  const g = app(relie);
  // La mère a les transporteurs : c'est elle qui peut livrer la colonie.
  const d = g.gameSkin([]).donors['33602'];
  assert.ok(d && d.length, 'personne ne peut livrer la colonie');
  assert.equal(d[0].n, 'Planète mère');
  assert.ok(d[0].sec[0] > 0 && d[0].sec[1] > 0, 'un temps de vol par type de transporteur');
  assert.ok(d[0].st[0] > 0, 'son stock de métal voyage aussi');
  // La colonie n'a aucun transporteur à quai, et c'est le cas courant : elle
  // donne quand même, avec l'aller à vide depuis la planète qui les porte.
  const vers = g.gameSkin([]).donors['33601'];
  assert.ok(vers && vers.length, 'une colonie sans transporteur doit pouvoir donner');
  assert.equal(vers[0].n, 'Colonie');
  assert.equal(vers[0].base, 'Planète mère', 'la flotte vient de là');
  assert.ok(vers[0].out[0] > 0 && vers[0].out[1] > 0, 'le vol à vide est chiffré');
  assert.ok(vers[0].lc > 0, 'les vaisseaux comptés sont ceux de la base');
  assert.equal(d[0].base, null, 'la mère a les siens sur place : pas d\'aller à vide');
  assert.deepEqual(d[0].out, [0, 0]);
});

t('la soute publi\u00e9e est celle des transporteurs', () => {
  const g = app(relie);
  const c = g.gameSkin([]).cargo;
  assert.ok(c[0] >= 25000 && c[1] >= 5000, c.join('/'));
});

t('le panneau publie bien la charge utile en se rendant', () => {
  // Le tout est dans un try/catch pour ne jamais casser l'affichage : donc
  // une erreur ici serait silencieuse, et la page resterait vide sans
  // qu'aucune alerte ne le dise. D'où ce test de bout en bout.
  const g = app(relie, SOIR, null, true);
  g.REFRESH.today();
  const skin = g.stored().skin;
  assert.ok(skin, 'rien n\'a été publié : la page du jeu n\'aurait aucun repère');
  assert.ok(skin.rates['33601'], 'les débits de la planète mère');
  assert.ok(Object.keys(skin.hints).length, 'au moins un repère à poser');
});

t('l\'\u00e9puration du jeu est \u00e9teinte par d\u00e9faut', () => {
  // On ne touche pas à l'affichage du jeu sans que le joueur l'ait demandé.
  const g = app(relie);
  assert.equal(g.gameSkin([]).lean, false);
});

t('une fois demand\u00e9e, l\'\u00e9puration part avec les indices', () => {
  const g = app(s => { relie(s); s.settings.lean = true; });
  const skin = g.gameSkin([{ kind: 'b', k: 'metal', lvl: 9, p: 1 }]);
  assert.equal(skin.lean, true);
  assert.equal(skin.hints['33602']['1'], 9, 'les indices voyagent dans le même envoi');
});

t('sans plan\u00e8te connue du jeu, aucun indice', () => {
  // avant la première synchro il n'y a pas d'identifiant : surligner au
  // hasard vaudrait mieux ne rien surligner du tout.
  const g = app();
  assert.deepEqual(g.planHints([{ kind: 'b', k: 'metal', lvl: 9, p: 0 }]), {});
});

/* ---------- la tournée d'une tuile ---------- */

/** Deux planètes nommées par le jeu, chantier 4 et 0. */
const nommees = s => { s.planets[0].gid = '101'; s.planets[1].gid = '102'; };

t('la tournée donne le nom, le niveau et le coût du niveau suivant', () => {
  const g = app(nommees);
  const t1 = g.tourData();
  assert.equal(t1['101'].n, 'Planète mère');
  assert.equal(t1['101'].b['21'], 4);            // chantier spatial
  assert.deepEqual(t1['101'].cost['21'], g.levelCost(g.B.shipyard, 5));
  assert.equal(t1['102'].b['21'], 0);
});

t('une planète que le jeu n\'a pas nommée est absente', () => {
  assert.deepEqual(Object.keys(app(s => { s.planets[0].gid = '101'; }).tourData()), ['101']);
});

t('la fin de file de bâtiment est publiée, par planète', () => {
  const g = app(s => { nommees(s); s.timers = [
    { id: 'a', game: true, queue: 'building', kind: 'b', k: 'metal', lvl: 15, pid: 'mere', end: SOIR + 600000 },
    { id: 'b', game: true, queue: 'lfbuilding', kind: 'x', k: 'other', label: 'Case de vie', pid: 'colo', end: SOIR + 900000 }
  ]; });
  const t1 = g.tourData();
  assert.equal(t1['101'].bq, SOIR + 600000);
  assert.equal(t1['101'].lfq, 0);
  assert.equal(t1['102'].lfq, SOIR + 900000);
});

t('une clé de planète hostile ne crée pas de pastille', () => {
  const g = app(s => { nommees(s); s.planets[1].gid = '__proto__'; });
  assert.deepEqual(Object.keys(g.tourData()), ['101']);
});

t('la file des recherches de forme de vie part à part', () => {
  const g = app(s => { nommees(s); s.timers = [
    { id: 'c', game: true, queue: 'lfresearch', kind: 'x', k: 'other', label: 'Étude', pid: 'mere', end: SOIR + 1200000 }
  ]; });
  assert.equal(g.tourData()['101'].lfr, SOIR + 1200000);
  assert.equal(g.tourData()['101'].lfq, 0);
});

t('une planète que la synchro vient de révéler ne publie aucun niveau', () => {
  // Le jeu nomme toutes les planètes dès la première page lue, mais ne dit les
  // niveaux que de celle qu'on regarde : les autres sont à zéro par défaut, et
  // « 0 → 1 » enverrait monter ce qui est peut-être au niveau 8.
  const g = app(nommees);
  g.applyGame({ meta: { host: 's1.ogame.gameforge.com' }, planets: {
    '101': { name: 'Planète mère', coords: '1:142:8', b: { metal: 14 } },
    '999': { name: 'Colonie neuve', coords: '1:142:3' }
  } });
  const t1 = g.tourData();
  assert.equal(t1['101'].b['1'], 14, 'la planète lue publie ses niveaux');
  assert.deepEqual(t1['999'].b, {}, 'la planète jamais lue n\'en publie aucun');
  assert.deepEqual(t1['999'].cost, {});
});

t('un prix de forme de vie estimé ne voyage pas comme un fait', () => {
  const g = app(s => { nommees(s);
    s.planets[0].lf = { '11101': { lvl: 3, seen: { 1: [100, 50, 0], 2: [200, 100, 0] } } }; });
  const e = g.tourData()['101'];
  assert.equal(e.b['11101'], 3, 'le niveau, lui, est connu');
  assert.equal(e.cost['11101'], undefined, 'un prix estimé ne grise personne');
});

t('le plan se range par page du jeu', () => {
  const g = app(relie);
  const pages = g.gameSkin([
    { kind: 'b', k: 'metal', lvl: 9, p: 1, what: 'Mine de métal 9',
      why: 'Première en amortissement', q: 'Bâtiment · Colonie' },
    { kind: 'def', p: 0, what: 'Construire 12 Lanceurs de missiles', q: 'Défense · Planète mère' }
  ]).band.pages;
  assert.equal(pages.supplies[0].what, 'Mine de métal 9');
  assert.equal(pages.supplies[0].ou, 'Colonie', 'la planète se dit, le lien n\'est pas lisible');
  assert.equal(pages.supplies[0].why, 'Première en amortissement');
  assert.ok(/cp=33602/.test(pages.supplies[0].url), pages.supplies[0].url);
  assert.equal(pages.defenses[0].what, 'Construire 12 Lanceurs de missiles');
});

t('une mission du jour se range sur la page où elle se fait', () => {
  const pages = app(relie).gameSkin([],
    [{ id: 'raid', q: 'Pillage', what: 'Espionner 1:140:6', how: [] }]).band.pages;
  assert.equal(pages.galaxy[0].what, 'Espionner 1:140:6');
});

t('quatre lignes au plus par page : au-delà, la bande redevient une liste', () => {
  const acts = [1, 2, 3, 4, 5, 6].map(n => ({ kind: 'b', k: 'metal', lvl: n, p: 0,
    what: 'Mine de métal ' + n, q: 'Bâtiment · Planète mère' }));
  assert.equal(app(relie).gameSkin(acts).band.pages.supplies.length, 4);
});

t('ce que le plan attend faute de ressources se dit aussi, avec sa date', () => {
  // Un empire dont rien n'est payable n'a aucune action lançable : sans les
  // attentes, la bande serait vide sur toutes les pages.
  const waits = [{ kind: 'b', k: 'metal', p: 1, q: 'Bâtiment · Colonie',
    what: 'Mine de métal 9', eta: 3600, miss: [1000, 0, 0] }];
  const l = app(relie).gameSkin([], [], waits).band.pages.supplies[0];
  assert.equal(l.what, 'Mine de métal 9');
  assert.equal(l.ou, 'Colonie');
  assert.ok(/vers \d\d:\d\d/.test(l.quand), l.quand);
  assert.equal(l.gris, true, 'une attente se grise : ce n\'est pas lançable');
  assert.ok(/manque 1 ?000 métal/.test(l.why.replace(/\u202f|\u00a0/g, ' ')), l.why);
});

t('une attente que la production ne comblera pas se dit à livrer', () => {
  const waits = [{ kind: 'b', k: 'metal', p: 1, q: 'Bâtiment · Colonie',
    what: 'Mine de métal 9', eta: Infinity, miss: [1000, 0, 0] }];
  assert.equal(app(relie).gameSkin([], [], waits).band.pages.supplies[0].quand, 'à faire livrer');
});

t('le lançable passe devant ce qui attend', () => {
  const acts = [{ kind: 'b', k: 'metal', lvl: 9, p: 0, what: 'Mine de métal 9', q: 'Bâtiment · Mère' }];
  const waits = [{ kind: 'b', k: 'crystal', p: 1, q: 'Bâtiment · Colonie',
    what: 'Mine de cristal 8', eta: 3600, miss: [0, 500, 0] }];
  const pages = app(relie).gameSkin(acts, [], waits).band.pages;
  assert.deepEqual(pages.supplies.map(l => l.what), ['Mine de métal 9', 'Mine de cristal 8']);
});

t('sans action ni mission, aucune page n\'a de ligne', () => {
  assert.deepEqual(app(relie).gameSkin([]).band.pages, {});
});

t('la tournée voyage dans le skin', () => {
  assert.ok(app(nommees).gameSkin([]).tour['101']);
});

t('une case de forme de vie renvoie sur sa propre file', () => {
  const g = app(relie);
  assert.ok(/component=lfbuildings/.test(g.actGo({ kind: 'lf', id: 11101, p: 0 })));
  assert.ok(/component=lfresearch/.test(g.actGo({ kind: 'lf', id: 11201, p: 0 })));
});

t('un labo renvoie sur Installations, pas sur Ressources', () => {
  const g = app(relie);
  assert.ok(/component=facilities/.test(g.actGo({ kind: 'b', k: 'lab', p: 0 })),
    'le laboratoire est une installation : ' + g.actGo({ kind: 'b', k: 'lab', p: 0 }));
});

t('une recherche renvoie sur la planète qui porte le labo', () => {
  // le labo est sur la planète mère dans l'état de test
  const g = app(relie);
  const url = g.actGo({ kind: 't', k: 'astro' });
  assert.ok(/component=research/.test(url), url);
  assert.ok(/cp=33601/.test(url), 'la recherche se lance depuis le labo : ' + url);
});

t('sans synchronisation, aucune carte n\'est cliquable', () => {
  // le serveur n'est connu qu'après un passage dans le jeu : inventer une URL
  // enverrait le joueur sur un univers qui n'est pas le sien.
  const g = app();
  assert.equal(g.actGo({ kind: 'b', k: 'metal', p: 0 }), null);
});

t('chaque lien dit sur quelle planète aller', () => {
  const g = app(relie);
  g.REFRESH.today();
  const liens = (g.html().tdNow || '').match(/data-go="[^"]*"/g) || [];
  assert.ok(liens.length, 'des liens sont attendus');
  // sans cp=, le jeu ouvre la page de la planète couramment sélectionnée :
  // le joueur se retrouve au bon endroit sur la mauvaise planète.
  const sansPlanete = liens.filter(l => !/cp=\d+/.test(l));
  assert.deepEqual(sansPlanete, [], 'liens sans planète : ' + sansPlanete.join(' '));
});

t('la carte des bâtiments de forme de vie pointe sur lfbuildings', () => {
  // Relevé sur le jeu : les bâtiments sont au pluriel, la recherche au
  // singulier. Un nom approchant ouvre la vue d'ensemble sans rien signaler.
  const g = app(s => { relie(s); s.syncAt = SOIR; s.timers = []; }, SOIR, null, true);
  assert.ok(g.dailyMissions().some(m => m.id === 'lfb'), 'la carte des bâtiments doit exister');
  g.REFRESH.today();
  const rendu = g.html().tdNow || '';
  assert.ok(/component=lfbuildings&amp;cp=/.test(rendu),
    'le lien des bâtiments de forme de vie : ' + (rendu.match(/component=lf\w+/g) || []).join(' '));
  assert.ok(/component=lfresearch&amp;cp=/.test(rendu),
    'le lien de la recherche de forme de vie : ' + (rendu.match(/component=lf\w+/g) || []).join(' '));
});

t('les cartes rendues portent leur lien', () => {
  const g = app(relie);
  g.REFRESH.today();
  assert.ok(/data-go="https:\/\/s199-fr/.test(g.html().tdNow || ''),
    'au moins une carte doit \u00eatre cliquable');
});

/* ---------- savoir sur quelle planète agir ---------- */

/** Mode extension, synchro fraîche, et une file de forme de vie au choix. */
const avecFiles = timers => app(s => { s.syncAt = SOIR; s.timers = timers; }, SOIR, null, true);
const mission = (g, id) => g.dailyMissions().find(m => m.id === id);

t('le rel\u00e9v\u00e9 n\'est r\u00e9clam\u00e9 que pour les plan\u00e8tes jamais vues', () => {
  // la mère est relevée, prix compris ; la colonie n'a jamais été ouverte
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets[0].lf = { 11101: { lvl: 24, state: 'ok', next: 25, cost: [13911, 3974, 0], secs: 1834 },
      11201: { lvl: 1, state: 'ok', next: 2, cost: [5000, 5000, 0], secs: 900 } };
  }, SOIR, null, true);
  const m = g.dailyMissions().find(x => x.id === 'lfb');
  assert.ok(m, 'la colonie reste à relever');
  assert.deepEqual(m.tags, ['Colonie'], 'et elle seule : ' + JSON.stringify(m.tags));
});

t('une fois tout relev\u00e9, plus aucune carte de forme de vie', () => {
  const vue = { 11101: { lvl: 24, state: 'ok', next: 25, cost: [13911, 3974, 0], secs: 1834 },
    11201: { lvl: 1, state: 'ok', next: 2, cost: [5000, 5000, 0], secs: 900 } };
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { ...vue }; });
  }, SOIR, null, true);
  // le plan s'en charge d\u00e9sormais : le rappel n'a plus de raison d'\u00eatre
  assert.ok(!g.dailyMissions().some(x => x.id === 'lfb' || x.id === 'lfr'),
    'le plan a pris le relais');
});

t('l\'étiquette met la planète en pastille colorée', () => {
  const g = app();
  assert.ok(/class="ptag"/.test(g.qHtml('Bâtiment · Colonie')),
    'la planète doit être une pastille : ' + g.qHtml('Bâtiment · Colonie'));
  // la couleur suit le rang de la planète : elle ne bouge pas d'une carte à l'autre
  assert.ok(/--pc:var\(--p0\)/.test(g.qHtml('Bâtiment · Planète mère')));
  assert.ok(/--pc:var\(--p1\)/.test(g.qHtml('Bâtiment · Colonie')));
  assert.equal(g.qHtml('Flotte'), 'Flotte', 'sans planète, rien à colorer');
});

/* ---------- espionner coûte un emplacement de flotte ---------- */

/** Trois inactifs plus faibles que moi, dans mon système. */
const INACTIFS = {
  planets: [['1:140:6', 'a'], ['1:145:10', 'b'], ['1:138:6', 'c']],
  players: { a: ['Alpha', 'i'], b: ['Beta', 'i'], c: ['Gamma', 'I'], moi: ['Moi', ''] },
  scores: { a: [900], b: [800], c: [700], moi: [5000] }
};
const avecSlots = (used, max) => app(s => {
  s.me = 'moi';
  s.syncAt = SOIR;
  s.slots = { fleet: [used, max], at: SOIR };
}, SOIR, INACTIFS);
const espionnage = g => g.dailyMissions().find(m => m.id === 'raid');

t('emplacements de flotte pleins : aucun espionnage proposé', () => {
  const g = avecSlots(8, 8);
  // Chaque sonde prend un emplacement : la mission échouerait avec
  // « Nombre maximal de flottes atteint ».
  assert.ok(!espionnage(g), 'rien à espionner sans emplacement libre');
  assert.ok(!g.dailyMissions().find(m => m.id === 'inactive'),
    'et surtout pas « repérer des inactifs » : ils sont déjà repérés');
});

t('un seul emplacement libre : une seule cible proposée', () => {
  const m = espionnage(avecSlots(7, 8));
  assert.ok(m, 'un espionnage reste possible');
  assert.equal((m.what.match(/\d+:\d+:\d+/g) || []).length, 1,
    'une seule cible tient dans l\'emplacement libre : ' + m.what);
});

t('assez d\'emplacements : les trois cibles sont proposées', () => {
  const m = espionnage(avecSlots(2, 8));
  assert.ok(m, 'un espionnage est proposé');
  assert.equal((m.what.match(/\d+:\d+:\d+/g) || []).length, 3, m.what);
});

t('chaque cible d\'espionnage porte le lien de sa galaxie', () => {
  // Le clic sur la carte n'ouvrait que le premier système : les autres
  // coordonnées n'étaient que du texte à retaper dans le jeu.
  const g = app(s => { relie(s); s.me = 'moi'; s.syncAt = SOIR; s.slots = { fleet: [2, 8], at: SOIR }; }, SOIR, INACTIFS);
  const m = espionnage(g);
  const liens = [...m.whatHtml.matchAll(/data-go="([^"]+)"/g)].map(x => x[1].replace(/&amp;/g, '&'));
  assert.equal(liens.length, 3, 'une cible sans lien : ' + m.whatHtml);
  for (const c of m.what.match(/\d+:\d+:\d+/g)) {
    const [ga, sy] = c.split(':');
    assert.ok(liens.some(u => u.includes('component=galaxy') && u.includes(`galaxy=${ga}&system=${sy}`)),
      `${c} ne mène pas à sa galaxie : ` + JSON.stringify(liens));
  }
  assert.ok(m.whatHtml.includes(m.what.split(' : ')[0]), 'le texte de la carte est conservé : ' + m.whatHtml);
});

t('serveur inconnu : la coordonnée reste du texte échappé', () => {
  const m = espionnage(avecSlots(2, 8));
  assert.ok(!/data-go/.test(m.whatHtml), 'un lien est fabriqué sans serveur : ' + m.whatHtml);
  assert.ok(!/</.test(m.whatHtml), 'du balisage sort quand même : ' + m.whatHtml);
});

t('une sonde en vol retire sa cible, sans cliquer sur Fait', () => {
  const g = avecSlots(2, 8);
  assert.ok(/1:140:6/.test(espionnage(g).what), 'elle est proposée au départ');
  g.applyGame({ planets: {}, timers: [], moves: [{ mission: 6, ret: false, arrival: SOIR / 1000 + 600, origin: '1:140:1', dest: '1:140:6' }] });
  assert.ok(!/1:140:6/.test(espionnage(g).what), 'sonde partie : la cible sort de la liste');
});

t('une cible espionnée hier ne revient pas aujourd\'hui', () => {
  const g = app(s => {
    s.me = 'moi';
    s.syncAt = SOIR;
    s.slots = { fleet: [2, 8], at: SOIR };
    // « Fait » sur l'espionnage marque les cibles : elles sortent pour 24 h.
    s.raids = { '1:140:6': { at: SOIR - 3600e3, probe: true } };
  }, SOIR, INACTIFS);
  const m = espionnage(g);
  assert.ok(m, 'les autres inactifs restent à espionner');
  assert.ok(!/1:140:6/.test(m.what), 'déjà espionnée il y a une heure : ' + m.what);
  // et elle redevient proposable une fois le rapport périmé
  const apres = app(s => {
    s.me = 'moi';
    s.syncAt = SOIR;
    s.slots = { fleet: [2, 8], at: SOIR };
    s.raids = { '1:140:6': { at: SOIR - 25 * 3600e3, probe: true } };
  }, SOIR, INACTIFS);
  assert.ok(/1:140:6/.test(espionnage(apres).what), 'après 24 h, on la réespionne');
});

t('sans sonde au sol, la consigne dit d\'en construire', () => {
  const chantier = ships => app(s => {
    s.me = 'moi';
    s.syncAt = SOIR;
    s.slots = { fleet: [2, 8], at: SOIR };
    s.planets[0].shipsAt = SOIR;
    s.planets[0].ships = ships;
  }, SOIR, INACTIFS);
  // L'œil de la Galaxie envoie les sondes déjà au sol : sans sonde, le jeu
  // répond « Vous n'avez pas sélectionné de vaisseaux » et la consigne ment.
  assert.ok(/chantier spatial/.test(espionnage(chantier({ sc: 4 })).how[0]),
    espionnage(chantier({ sc: 4 })).how[0]);
  assert.ok(/Galaxie/.test(espionnage(chantier({ pr: 3 })).how[0]),
    'avec des sondes, on retourne à la Galaxie');
  // chantier jamais ouvert : on ne sait rien, on ne prétend rien
  assert.ok(/Galaxie/.test(espionnage(avecSlots(2, 8)).how[0]),
    'sans relevé du chantier, la consigne ne change pas');
});

t('la liste espionnée part avec la carte', () => {
  const m = espionnage(avecSlots(2, 8));
  assert.deepEqual(m.mark, ['1:140:6', '1:138:6', '1:145:10'].filter(c => m.what.includes(c)),
    'les coordonnées marquées sont celles affichées : ' + JSON.stringify(m.mark));
});

/* ---------- des transporteurs à demeure sur les colonies ---------- */

/** Une colonie qui produit bien, déborde, et n'a ni chantier ni vaisseau. */
function colonieSansFlotte(s) {
  const c = s.planets[1];
  // solaire large : l'énergie ne doit pas masquer ce qu'on teste
  c.b = Object.assign({}, c.b, { metal: 12, crystal: 10, deut: 8, solar: 20, robot: 2, shipyard: 0, smetal: 2, scrystal: 2 });
  c.ships = {};
  c.stock = { m: 70000, c: 50000, d: 9000, at: JOUR };
  s.planets[0].ships = { lc: 10, sc: 5 };
  s.planets[0].stock = { m: 200000, c: 150000, d: 40000, at: JOUR };
}

const surColonie = (g, motif) => g.simulateDay().sessions[0].acts
  .filter(a => /Colonie/.test(a.q) && motif.test(a.what));

t('une colonie qui déborde sans chantier se voit proposer un chantier spatial', () => {
  const g = app(colonieSansFlotte, JOUR);
  const bati = surColonie(g, /Chantier spatial|Usine de robots/);
  assert.ok(bati.length, 'rien de proposé pour équiper la colonie : '
    + g.simulateDay().sessions[0].acts.map(a => a.q + ' → ' + a.what).join(' / '));
});

t('une colonie équipée construit ses propres transporteurs', () => {
  const g = app(s => { colonieSansFlotte(s); s.planets[1].b.shipyard = 2; }, JOUR);
  const flotte = surColonie(g, /transporteur/);
  assert.ok(flotte.length, 'aucun transporteur construit sur la colonie');
  assert.ok(/Chantier spatial · Colonie/.test(flotte[0].q), flotte[0].q);
});

t('la planète principale garde sa logique habituelle', () => {
  const g = app(colonieSansFlotte, JOUR);
  const s0 = g.simulateDay().sessions[0];
  const mere = s0.acts.filter(a => /Planète mère/.test(a.q));
  assert.ok(mere.length, 'la planète mère a toujours des actions');
});

/* ---------- le plafond des expéditions ---------- */

/** Une flotte au sol capable de remplir plusieurs expéditions d'un coup. */
function flotteDExpedition(s) {
  s.planets[0].ships = { lc: 20, pr: 1 };
  s.planets[0].stock = { m: 2000000, c: 1500000, d: 800000, at: JOUR };
  s.planets[1].ships = {};
  s.syncAt = JOUR;
}
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

/* ---------- laisser le jeu remplir son propre formulaire ---------- */

t('une expédition ouvre la page de flotte déjà préparée par le jeu', () => {
  // Le jeu remplit son formulaire quand on arrive par un lien qui porte les
  // paramètres : c'est ce que fait sa propre page Galaxie. L'extension n'écrit
  // rien dans la page — elle ouvre un lien, le jeu fait le reste.
  const u = app(relie).actGo({ kind: 'expo', p: 1, dest: '1:79:16', mission: 15,
    ships: { sc: 21, pr: 1 } });
  assert.ok(/component=fleetdispatch/.test(u), u);
  assert.ok(/[?&]cp=33602(&|$)/.test(u), 'depuis la bonne planète : ' + u);
  assert.ok(/[?&]galaxy=1&system=79&position=16/.test(u), 'vers la bonne case : ' + u);
  assert.ok(/[?&]mission=15(&|$)/.test(u), 'en expédition : ' + u);
  assert.ok(/[?&]am202=21(&|$)/.test(u) && /[?&]am210=1(&|$)/.test(u),
    'avec les vaisseaux comptés : ' + u);
});

t('un rapatriement part en Transporter, un vol à vide en Stationner', () => {
  const g = app(s => {
    relie(s);
    const c = s.planets[1];
    c.b = Object.assign({}, c.b, { metal: 14, crystal: 12, solar: 18, shipyard: 2 });
    c.ships = { lc: 10 };
    c.stock = { m: 90000, c: 60000, d: 9000, at: JOUR };
  }, JOUR);
  const r = g.simulateDay().sessions[0].acts.find(a => a.kind === 'transfer' && a.res);
  assert.ok(r, 'un rapatriement est proposé');
  assert.equal(r.mission, 3, 'mission Transporter');
  assert.ok(/mission=3(&|$)/.test(g.actGo(r)), g.actGo(r));
});

t('sans destination, le lien reste la simple page de flotte', () => {
  assert.equal(app(relie).actGo({ kind: 'fleet', p: 0 }),
    'https://s199-fr.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch&cp=33601');
});

t('la mise à l\'abri du soir ouvre aussi un formulaire préparé', () => {
  const g = app(s => { relie(s); loin(s); s.planets[0].ships = { lc: 30 }; });
  const n = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(n, 'le rappel du soir existe');
  const u = g.missionGo(n);
  assert.ok(/component=fleetdispatch/.test(u) && /am203=/.test(u), 'avec la flotte : ' + u);
  assert.ok(/mission=4(&|$)/.test(u), 'en Stationner — le déploiement, seule mise à l\'abri sûre sans lune : ' + u);
  assert.ok(/position=6(&|$)/.test(u), 'vers la colonie : ' + u);
});

t('le vaisseau de colonisation part en mission Coloniser', () => {
  const g = app(s => {
    relie(s);
    s.colo.target = '1:142:9';
    s.colo.built = true;
    s.planets[0].ships = { col: 1, lc: 4 };
  }, JOUR);
  const a = g.simulateDay().sessions.flatMap(x => x.acts)
    .find(x => /colonisation/.test(x.what) && x.kind === 'fleet');
  assert.ok(a, 'l\'envoi est proposé');
  assert.ok(/mission=7(&|$)/.test(g.actGo(a) || ''), g.actGo(a));
  assert.ok(/galaxy=1&system=142&position=9/.test(g.actGo(a) || ''), g.actGo(a));
});

t('ce que le lien prépare ne se retape pas', () => {
  // Vaisseaux et coordonnées arrivent remplis par le jeu : les proposer en
  // plus à la copie, c'est du bruit. Les ressources, elles, restent à saisir.
  const g = app(relie);
  const h = g.copyChips({ kind: 'transfer', p: 1, dest: '1:142:8', mission: 3,
    ships: { lc: 3 }, res: [4200, 0, 0] });
  assert.ok(!/galaxie|système|position/.test(h), 'plus de coordonnées : ' + h);
  assert.ok(!/Grand transporteur/.test(h), 'plus de vaisseaux : ' + h);
  assert.ok(/data-copy="4200"/.test(h), 'mais toujours le métal : ' + h);
});

t('sans lien préparé, tout reste copiable', () => {
  // Au chantier spatial il n\'y a pas de formulaire de flotte à préparer :
  // la quantité se tape à la main.
  const h = app(relie).copyChips({ kind: 'ship', p: 0, ships: { lc: 3 } });
  assert.ok(/Grand transporteur/.test(h) && /data-copy="3"/.test(h), h);
});

/* ---------- le Réseau de recherche intergalactique ---------- */

/* Centre forcé sur la mère, labo 5, et un plus gros labo sur la colonie : sans
   ça le centre se déplacerait sur le plus haut labo et il n'y aurait plus rien
   à relier. C'est aussi le cas qui compte — un centre au petit labo qui
   récupère le gros d'à côté. */
const RESEAU = (irn, labColo) => app(s => {
  s.centre = 'mere'; s.tech.irn = irn; s.planets[1].b.lab = labColo;
});
/** Une voisine de plus, labo donné, avec son propre stock. */
const voisine = (s, id, pos, lab) => s.planets.push(Object.assign({}, s.planets[1], {
  id, coords: '1:142:' + pos, b: Object.assign({}, s.planets[1].b, {lab}),
  stock: Object.assign({}, s.planets[1].stock)
}));

t('sans Réseau, seul le labo du centre compte', () => {
  const g = RESEAU(0, 9);
  assert.equal(g.labLevel(), 5, 'le labo du centre');
  assert.equal(g.labEffectif(), 5,
    'un labo 9 sur la colonie ne doit rien ajouter tant que le Réseau est à zéro');
});

t('le Réseau ajoute les meilleurs labos des autres planètes', () => {
  const g = RESEAU(1, 9);
  assert.equal(g.labLevel(), 5, 'le labo qui débloque ne bouge pas');
  assert.equal(g.labEffectif(), 14, '5 + 9 : Réseau 1 relie le meilleur labo d\'à côté');
});

t('le Réseau ne relie que N labos, N étant son niveau', () => {
  // Trois voisines à 7, 9 et 8 : au niveau 2, les deux meilleures seulement.
  const g = app(s => {
    s.centre = 'mere'; s.tech.irn = 2; s.planets[1].b.lab = 7;
    voisine(s, 'c2', 5, 9);
    voisine(s, 'c3', 4, 8);
  });
  assert.equal(g.labEffectif(), 22, '5 + 9 + 8, et pas le 7 de la troisième');
});

t('le Réseau raccourcit la recherche, sans toucher ce qui la débloque', () => {
  const sans = RESEAU(0, 9), avec = RESEAU(1, 9);
  const t0 = sans.researchTime('energy', 1), t1 = avec.researchTime('energy', 1);
  assert.ok(t1 < t0, `la durée doit baisser : ${t0} puis ${t1}`);
  // (1+5) contre (1+14) : le rapport des dénominateurs, à l'arrondi près
  assert.ok(Math.abs(t0 / t1 - 15 / 6) < .01, `rapport attendu 2,5, obtenu ${t0 / t1}`);
});

t('le Réseau n\'aide jamais à remplir un prérequis de labo', () => {
  /* Le piège de la modélisation : un prérequis est une propriété de la
     planète. Avec un labo effectif de 14, Nanites ne doit pas paraître
     débloquée alors que le labo du centre est à 5. */
  const g = RESEAU(1, 9);
  assert.equal(g.labEffectif(), 14, 'le labo effectif dépasse bien le seuil');
  assert.deepEqual(g.reqOk({lab:10}), ['Labo 10'],
    'le prérequis doit rester manquant : le Réseau accélère, il ne débloque pas');
});

t('le Réseau n\'est pas conseillé de lui-même', () => {
  // Choix assumé : on le compte quand le joueur l'a, on ne le pousse pas.
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  const feuilles = /const ROADMAPS = \{[\s\S]*?\n\};/.exec(src)[0];
  assert.ok(!/'irn'/.test(feuilles), 'aucune feuille de route ne doit contenir irn');
});

/* ---------- pourquoi cette recherche ---------- */

t('un prérequis de recherche dit vers quelle recherche il mène', () => {
  const g = app(s => { s.day.focus = 'eco'; });
  const r = g.nextResearch().list[0];
  assert.equal(r.k, 'energy', 'la feuille de route éco commence par Énergie');
  assert.ok(/Plasma/.test(r.why || ''),
    'Énergie ' + r.lvl + ' est un péage : son pourquoi doit nommer Plasma, et dit « ' + (r.why || '(rien)') + ' »');
});

t('la recherche visée dit ce qu\'elle rapporte', () => {
  const g = app(s => {
    s.day.focus = 'eco';
    Object.assign(s.tech, { energy: 8, laser: 10, ion: 5 });
    s.planets[0].b.lab = 6;
  });
  const r = g.nextResearch().list[0];
  assert.equal(r.k, 'plasma');
  assert.ok(/métal/.test(r.why || ''), 'Plasma doit annoncer son bonus de production, et dit « ' + (r.why || '(rien)') + ' »');
});

t('Plasma annonce son amortissement, chiffré sur l\'empire du joueur', () => {
  const g = app(s => {
    s.day.focus = 'eco';
    Object.assign(s.tech, { energy: 8, laser: 10, ion: 5 });
    s.planets[0].b.lab = 6;
  });
  const h = g.techPayback('plasma', 1);
  assert.ok(h > 0 && isFinite(h), 'un amortissement en heures, et non ' + h);
  assert.ok(/[Aa]morti/.test(g.nextResearch().list[0].why || ''),
    'la carte Plasma doit le dire : « ' + g.nextResearch().list[0].why + ' »');
  assert.equal(g.techPayback('energy', 8), null, 'une recherche qui ne produit rien n\'a pas d\'amortissement');
});

/* ---------- le plafond du nombre de planètes ---------- */

t('toutes les planètes prises, un conseil nomme le palier d\'Astrophysique', () => {
  const g = app(s => { s.tech.astro = 2; });
  assert.equal(g.maxPlanets(), 2, 'Astro 2 autorise deux planètes, et le joueur en a deux');
  const c = g.dailyMissions().find(m => /Astrophysique 3/.test(m.what + ' ' + m.why));
  assert.ok(c, 'aucune carte ne dit qu\'Astrophysique 3 ouvrirait une planète de plus');
});

t('en focus colonie, le plan propose le palier qui ouvre une planète', () => {
  const g = app(s => { s.day.focus = 'ecocol'; s.tech.astro = 2; });
  const r = g.nextResearch().list.find(x => x.k === 'astro');
  assert.ok(r, 'Astrophysique doit être dans la file');
  assert.ok(/3ᵉ planète/.test(r.why || ''),
    'le pourquoi doit nommer la planète gagnée, et dit « ' + (r.why || '(rien)') + ' »');
});

t('en économie pure le plan ne pousse pas vers une colonie', () => {
  const g = app(s => { s.day.focus = 'eco'; s.tech.astro = 2; });
  const r = g.nextResearch().list.find(x => x.k === 'astro');
  assert.ok(!r || !/ᵉ planète/.test(r.why || ''),
    'ce focus ne colonise pas : lui vendre une planète de plus serait incohérent');
});

t('le plafond des planètes a sa carte dans le plan du jour', () => {
  const g = app(s => { s.tech.astro = 2; });
  const c = g.dailyMissions().find(m => m.id === 'colomax');
  assert.ok(c, 'aucune carte ne dit que les deux emplacements de planète sont pris');
  assert.ok(/Astrophysique 3/.test(c.why + ' ' + c.how.join(' ')), 'elle doit nommer le palier : « ' + c.why + ' »');
  assert.ok(/\d/.test(c.why), 'et son coût');
});

t('un emplacement de planète libre, pas de carte de plafond', () => {
  const g = app(s => { s.tech.astro = 3; });
  assert.equal(g.maxPlanets(), 3, 'un emplacement reste libre');
  assert.ok(!g.dailyMissions().some(m => m.id === 'colomax'));
});

t('en économie pure la carte dit que le plan ne colonisera pas seul', () => {
  const g = app(s => { s.day.focus = 'eco'; s.tech.astro = 2; });
  const c = g.dailyMissions().find(m => m.id === 'colomax');
  assert.ok(/Économie pure/.test(c.how.join(' ')),
    'sinon le joueur attend une colonie que ce focus ne lancera jamais');
});

t('le péage chiffre ce que sa destination rapportera', () => {
  const g = app(s => { s.day.focus = 'eco'; });
  const r = g.nextResearch().list[0];
  assert.ok(/amortira/.test(r.why || ''),
    'Énergie ne produit rien : son pourquoi doit chiffrer Plasma, et dit « ' + r.why + ' »');
});

/* ---------- une planète passe avant les mines ---------- */

/** Trois planètes et Astrophysique 4 : tous les emplacements sont pris. */
function pleinDePlanetes(s) {
  s.day.focus = 'ecocol';
  s.tech.astro = 4;
  const troisieme = JSON.parse(JSON.stringify(s.planets[1]));
  troisieme.id = 'colo2'; troisieme.name = 'Colonie 2'; troisieme.coords = '1:142:4';
  s.planets.push(troisieme);
}

t('en focus colonie, le palier qui ouvre une planète passe devant la chaîne Plasma', () => {
  const g = app(pleinDePlanetes);
  assert.equal(g.maxPlanets(), 3, 'trois emplacements, trois planètes');
  const l = g.nextResearch().list;
  assert.equal(l[0].k, 'astro', 'la file commence par ' + l.map(x => x.k + ' ' + x.lvl).join(', '));
  assert.ok(l[0].crit, 'et le plan met des ressources de côté pour elle');
  assert.ok(/4ᵉ planète/.test(l[0].why || ''), 'en disant pourquoi : « ' + l[0].why + ' »');
});

t('un emplacement libre, le palier ne double personne', () => {
  const g = app(s => { s.day.focus = 'ecocol'; s.tech.astro = 4; });
  assert.ok(g.S.planets.length < g.maxPlanets(), 'il reste un emplacement');
  assert.notEqual(g.nextResearch().list[0].k, 'astro',
    'rien ne presse : la colonie se prépare, elle ne demande aucune recherche');
});

t('en économie pure le palier ne double pas la file', () => {
  const g = app(s => { pleinDePlanetes(s); s.day.focus = 'eco'; });
  const l = g.nextResearch().list;
  assert.notEqual(l[0].k, 'astro', 'ce focus ne colonise pas : la file garde son ordre');
});

/* ---------- le plan équilibré ---------- */

t('le plan équilibré colonise comme le plan colonie', () => {
  const g = app(s => { pleinDePlanetes(s); s.day.focus = 'equi'; });
  const l = g.nextResearch().list;
  assert.equal(l[0].k, 'astro', 'la file commence par ' + l.map(x => x.k + ' ' + x.lvl).join(', '));
  assert.ok(l[0].crit, 'et le plan met des ressources de côté pour elle');
});

t('le plan équilibré fait passer le plafond d\'expéditions devant la feuille de route', () => {
  // Un emplacement de colonie reste libre : Astrophysique ne double donc rien
  // pour la colonie, et la soute au sol dépasse déjà le plafond d'expéditions.
  const cadre = s => {
    flotteDExpedition(s); s.tech.astro = 4;
    s.planets[0].b = Object.assign({}, s.planets[0].b, { lab: 10 });
    Object.assign(s.tech, { espionage: 4, impulse: 3, computer: 4, combustion: 6 });
    s.slots = { fleet: [0, 9], expo: [0, 1], at: JOUR };
  };
  const file = f => app(s => { cadre(s); s.day.focus = f; }, JOUR);
  const g = file('equi'), eq = g.nextResearch().list;
  assert.ok(g.S.planets.length < g.maxPlanets(), 'le cadre laisse un emplacement de colonie libre');
  assert.equal(eq[0].k, 'astro',
    'en équilibré elle passe devant : ' + eq.map(x => x.k + ' ' + x.lvl).join(', '));
  const co = file('ecocol').nextResearch().list;
  assert.notEqual(co[0].k, 'astro',
    'en colonie elle attend son tour : ' + co.map(x => x.k + ' ' + x.lvl).join(', '));
});

t('« Équilibré » est un réglage que la journée accepte', () => {
  const g = app();
  assert.equal(g.dayValue('focus', 'equi', 'ecocol'), 'equi');
});

t('Astrophysique ne promet pas une expédition à chaque niveau', () => {
  const g = app(pleinDePlanetes);
  const w = g.nextResearch().list[0].why;
  assert.ok(/carré|9/.test(w),
    'le joueur croit qu\'un niveau d\'Astro ajoute une expédition ; le pourquoi doit dire que le palier est un carré parfait : « ' + w + ' »');
});

t('le pourquoi d\'Astrophysique ne dit pas deux fois la même chose', () => {
  const g = app(s => {
    pleinDePlanetes(s); s.tech.astro = 6; s.planets[0].b.lab = 8;
    const q = JSON.parse(JSON.stringify(s.planets[1]));
    q.id = 'colo3'; q.name = 'Colonie 3'; q.coords = '1:142:2'; s.planets.push(q);
  });
  assert.equal(g.maxPlanets(), 4, 'quatre emplacements, quatre planètes');
  const w = g.nextResearch().list[0].why;
  assert.ok(!/un palier sur deux/.test(w),
    'l\'effet générique répète le plafond, qui est plus précis : « ' + w + ' »');
  assert.ok(/planète/.test(w), 'mais la planète gagnée reste dite');
});

/* ---------- le service worker ---------- */

/* background.js n'a pas de surface de test : il lui faudrait feindre alarms,
   notifications, tabs, windows, action, sidePanel, scripting, importScripts et
   fetch, et `merge` n'est joignable qu'à travers un message. On garde donc ses
   deux défauts corrigés là où on peut : sur sa source. Même repli que les
   quatre tests qui relisent app.js. */
const SW = () => require('fs').readFileSync(require('path').join(__dirname, '..', 'background.js'), 'utf8');

/** `pageDuJeu`, découpée dans la source du worker : elle ne dépend d'aucune API de Chrome. */
const pageDuJeu = () => new Function('return ' + /function pageDuJeu[\s\S]*?\n}/.exec(SW())[0])();

t("une adresse n'est autorisée que si l'analyseur d'URL la dit du jeu", () => {
  const ok = pageDuJeu();
  assert.equal(ok('https://s1-fr.ogame.gameforge.com/game/index.php?cp=1'),
    'https://s1-fr.ogame.gameforge.com/game/index.php?cp=1');
  assert.equal(ok('https://ogame.gameforge.com/game/index.php'),
    'https://ogame.gameforge.com/game/index.php');
});

t("les adresses que l'expression régulière laissait passer sont refusées", () => {
  /* La barre oblique inversée est une barre oblique pour l'analyseur, et le
     dièse ouvre le fragment : les deux mènent chez mechant.fr alors que
     /^https:\/\/[^/]*\.ogame\.gameforge\.com\// les accepte. Un onglet y serait
     parti avec la session du joueur dans l'adresse. */
  const ok = pageDuJeu();
  for (const u of [
    'https://mechant.fr\\.ogame.gameforge.com/game/index.php',
    'https://mechant.fr#.ogame.gameforge.com/game/index.php',
    'https://mechant-ogame.gameforge.com.evil.fr/game/index.php',
    'http://s1-fr.ogame.gameforge.com/game/index.php',
    'javascript:alert(1)//.ogame.gameforge.com/',
    'pas une adresse', '', null
  ]) assert.equal(ok(u), null, u);
});

t("la navigation part de ce que l'analyseur a compris, pas de la chaîne reçue", () => {
  // sinon la vérification porte sur un texte et le navigateur en suit un autre
  const src = SW();
  assert.ok(!/chrome\.tabs\.(update|create)\([^)]*\{ url,/.test(src),
    'aucune navigation ne doit reprendre `url` tel quel');
  assert.equal((src.match(/const sur = pageDuJeu\(url\);/g) || []).length, 2,
    'goToGame et scanGo passent toutes les deux par la vérification');
});

t('la file d\'une case de forme de vie est demandée à lfQueue, jamais recalculée', () => {
  const src = SW();
  assert.ok(/id >= 11000\) return lfQueue\(id\)/.test(src),
    'le worker doit déférer à la règle canonique de ids.js');
  assert.ok(!/% 10 === 2/.test(src),
    'la seconde copie de la règle ne doit pas revenir : elle ne s\'accordait que sur les Humains');
});

t('la règle canonique range les séries paires en recherche', () => {
  /* Ce que la copie du worker se trompait à dire. Les Humains occupent 111xx
     et 112xx, la race suivante 113xx et 114xx : la centaine impaire construit,
     la paire cherche. */
  const g = app();
  for (const id of [11101, 11301, 11501, 11701, 11901, 12101])
    assert.equal(g.lfQueue(id), 'lfbuilding', id + ' est une file de bâtiments');
  for (const id of [11201, 11401, 11601, 11801, 12001])
    assert.equal(g.lfQueue(id), 'lfresearch', id + ' est une file de recherche');
});

t('un instantané amputé ne tue pas le worker en silence', () => {
  const src = SW();
  const tete = /async function merge\(s\) \{[\s\S]{0,700}?const \{ game/.exec(src);
  assert.ok(tete, 'la tête de merge doit être lisible');
  for (const champ of ['meta', 'planets', 'levels', 'stock', 'timers'])
    assert.ok(new RegExp(champ + ': s\\.' + champ + ' \\|\\|').test(tete[0]),
      's.' + champ + ' est déréférencé plus bas sans garde : il doit être comblé en tête');
  assert.ok(/merge\(msg\.data\)\s*[\r\n]*\s*\.catch\(/.test(src),
    'l\'appel doit capturer : sinon ce que merge lève est un rejet non traité, invisible');
});

/* ---------- la version ---------- */

t('app.js et manifest.json annoncent la même version', () => {
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const dansApp = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
    .match(/APP_VERSION = '([^']+)'/)[1];
  const dansManifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version;
  assert.equal(dansApp, dansManifest,
    'le panneau afficherait ' + dansApp + ' alors que Chrome a chargé ' + dansManifest);
});

t('pack.sh emporte tout ce que Chrome charge', () => {
  /* `dist/` est ce que le navigateur voit : un fichier oublié dans la liste de
     pack.sh et l'extension se charge sans lui — le panneau reste blanc, et rien
     ne le dit avant le clic. La liste se garde donc depuis les deux endroits
     qui nomment des fichiers : le manifeste et sidepanel.html. */
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const lu = f => fs.readFileSync(path.join(root, f), 'utf8');
  const liste = lu('pack.sh').match(/FICHIERS="([^"]+)"/)[1].split(/\s+/);
  const m = JSON.parse(lu('manifest.json'));
  /* Le manifeste ne dit pas tout : `app.js` n'est nommé que par boot.js, et
     `ids.js` par un `importScripts`. On relit donc chaque fichier emporté et on
     prend tout nom de fichier local qu'il cite — un nom qu'on lit dans du code
     qui part est un fichier qui doit partir avec lui. */
  const cites = liste.filter(f => /\.(js|html)$/.test(f))
    .flatMap(f => [...lu(f).matchAll(/['"]([\w-]+\.(?:js|css|html|png))['"]/g)].map(x => x[1]));
  const voulus = new Set(['manifest.json', m.background.service_worker,
    ...m.content_scripts.flatMap(c => c.js),
    ...Object.values(m.icons),
    ...m.web_accessible_resources.flatMap(r => r.resources),
    ...[...lu('sidepanel.html').matchAll(/(?:src|href)="([^":]+)"/g)].map(x => x[1]),
    ...cites]);
  for (const f of voulus)
    assert.ok(liste.includes(f), f + ' est chargé par l\'extension et pack.sh ne l\'emporte pas');
  for (const f of liste)
    assert.ok(fs.existsSync(path.join(root, f)), 'pack.sh emporte ' + f + ', qui n\'existe pas');
});

/* ---------- résultat ---------- */

/* ---------- spécification v2 : formules isolées ---------- */

t('la capacité de hangar suit la formule du jeu', () => {
  const g = app();
  assert.equal(g.storageCap(4), 140000);
  assert.equal(g.storageCap(5), 255000);
  assert.equal(g.storageCap(7), 865000);
  assert.equal(g.storageCap(8), 1590000);
});

t('Astrophysique 5 coûte 37 500 / 75 000 / 37 500, soit 262 500 éq.', () => {
  const g = app();
  assert.deepEqual(g.levelCost(g.T.astro, 5), [37500, 75000, 37500]);
  assert.equal(g.mse(37500, 75000, 37500), 262500);
});

t('la chaîne vers Plasma 4 depuis Énergie 7, Laser 7 et Ion 5 coûte 785 800 éq.', () => {
  const g = app();
  const eq = c => g.mse(c[0], c[1], c[2]);
  const total = eq(g.rangeCost(g.T.energy, 7, 8))
              + eq(g.rangeCost(g.T.laser, 7, 10))
              + eq(g.rangeCost(g.T.plasma, 0, 4));
  assert.equal(Math.round(total), 785800);
});

t('le nombre de planètes et d\'expéditions suit Astrophysique', () => {
  assert.equal(app(s => { s.tech.astro = 4; }).maxPlanets(), 3);
  assert.equal(app(s => { s.tech.astro = 5; }).maxPlanets(), 4);
  assert.equal(app(s => { s.tech.astro = 9; }).maxPlanets(), 6);
  const g = app();
  assert.equal(g.expoCap(8), 2);
  assert.equal(g.expoCap(9), 3);
});

t('le bonus de position du métal vaut 1,35 en 8 et rien en 11', () => {
  const g = app();
  assert.equal(1 + (g.POS_BONUS_M[8] || 0), 1.35);
  assert.equal(1 + (g.POS_BONUS_M[11] || 0), 1);
});

t('les foreuses utiles valent huit fois les niveaux de mine', () => {
  const g = app();
  assert.equal(g.crawlerMax(19, 16, 15), 400);
  // +0,02 % chacune, ×1,5 pour un Collectionneur, plafonné à 50 %
  assert.ok(Math.abs(g.crawlerBonus(400, 'collector', false) - 0.12) < 1e-9);
  assert.equal(g.crawlerBonus(100000, 'collector', true), 0.5);
});

/* ---------- le hangar ne bloque pas une livraison ---------- */

t('un coût au-dessus du hangar nomme le niveau qui le logerait, pas un mur', () => {
  const g = app(s => { s.planets[0].b.scrystal = 4; s.tech.astro = 6; });
  const w = g.waitFor(g.S.planets[0], g.levelCost(g.T.astro, 7));
  assert.ok(w.small && w.small.length, 'le hangar est trop petit pour la production locale');
  const c = w.small.find(x => x.k === 'scrystal');
  assert.ok(c, 'c\'est le cristal qui manque de place : ' + JSON.stringify(w.small));
  assert.equal(c.lvl, 5, 'Hangar de cristal 5 suffit (255 000 ≥ 229 800) : jamais 6');
});

t('le hangar juste assez grand ne déclenche rien', () => {
  const g = app(s => { s.planets[0].b.scrystal = 5; s.planets[0].b.smetal = 5; s.planets[0].b.sdeut = 5; s.tech.astro = 6; });
  const w = g.waitFor(g.S.planets[0], g.levelCost(g.T.astro, 7));
  assert.ok(!w.small, 'rien à agrandir : ' + JSON.stringify(w.small));
});

/* ---------- l'Éclaireur n'est pas proposé hors Explorateur ---------- */

t('un Collectionneur ne se voit jamais proposer un éclaireur', () => {
  const g = app(s => {
    s.settings.cls = 'collector';
    s.tech.hyperdrive = 2; s.tech.hyper = 3;
    s.planets[0].b.shipyard = 5;
    s.planets[0].stock = { m: 2e6, c: 2e6, d: 1e6, at: SOIR };
  });
  const acts = g.simulateDay().sessions.flatMap(x => x.acts);
  assert.ok(!acts.some(a => /éclaireur/i.test(a.what || '')),
    'le chantier d\'un Collectionneur ne l\'affiche pas');
});

/* ---------- le carburant voyage dans la soute ---------- */
/* Le plein sort de la soute : ce que la flotte emporte, c'est la soute moins le
   carburant. Compté brut, le copilote annonçait un butin qu'elle ne pouvait pas
   charger, et un vol lointain le faisait d'autant plus. */

t('la soute annoncée par un vol est nette du carburant', () => {
  const g = app();
  const pres = g.flight('1:142:8', '1:142:9', { lc: 10 }, 100);
  const loin = g.flight('1:142:8', '5:300:8', { lc: 10 }, 100);
  assert.ok(loin.fuel > pres.fuel, 'le trajet lointain coûte plus de carburant');
  // La soute du vaisseau ne change pas avec la distance : soute + plein est donc
  // constant, et ce qui reste à charger baisse avec l'éloignement.
  assert.equal(pres.cargo + pres.fuel, loin.cargo + loin.fuel);
  assert.ok(loin.cargo < pres.cargo, `${loin.cargo} contre ${pres.cargo}`);
});

t('un pillage lointain n\'emporte pas plus que sa soute moins le plein', () => {
  const g = app(s => {
    s.planets[0].ships = { lc: 2 };
    s.raid = { coords: '4:300:9', m: 60000, c: 0, d: 0, safe: true, at: SOIR - 600e3 };
  });
  const r = g.raidPlan();
  assert.ok(r.fuel > 0, 'le trajet coûte du carburant : ' + r.fuel);
  assert.ok(r.got <= 2 * 25000 - r.fuel,
    `${r.got} emportés pour ${2 * 25000 - r.fuel} de soute utile`);
});

/* ---------- un rapport d'espionnage vieillit ---------- */

t('un rapport de plus de deux heures est marqué périmé', () => {
  const vieux = app(s => { s.raid = { coords: '1:142:9', m: 50000, c: 20000, d: 0, safe: true, at: SOIR - 3 * 3600e3 }; });
  assert.equal(vieux.raidPlan().stale, true);
  const frais = app(s => { s.raid = { coords: '1:142:9', m: 50000, c: 20000, d: 0, safe: true, at: SOIR - 600e3 }; });
  assert.equal(frais.raidPlan().stale, false);
});

t('un rapport périmé ne produit aucune carte de pillage', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 50000, c: 20000, d: 0, safe: true, at: SOIR - 3 * 3600e3 }; });
  assert.ok(!g.dailyMissions().some(m => m.id === 'raid-go'),
    'on réespionne avant d\'attaquer');
});

/* ---------- lire un rapport d'espionnage ---------- */

/** Un rapport de test, tel que le joueur le collerait. */
const lire = n => require('fs').readFileSync(require('path').join(__dirname, 'rapports', n), 'utf8');

t('un rapport sans section Défense lisible rend une défense inconnue, pas nulle', () => {
  const r = app().parseReport(lire('faible.txt'));
  assert.strictEqual(r.def, null, 'le jeu a dit qu\'il n\'avait rien vu : inconnue');
  assert.strictEqual(r.fleet, null, 'la flotte aussi');
  assert.deepEqual(r.res, [0, 0, 0], 'les ressources, elles, sont là');
});

t('une section Défense sans aucune ligne vaut zéro', () => {
  const r = app().parseReport(lire('nue.txt'));
  assert.deepEqual(r.def, {}, 'lue, et vide');
  assert.deepEqual(r.fleet, {});
});

t('un rapport complet rend la flotte et la défense par type', () => {
  const r = app().parseReport(lire('complet.txt'));
  assert.equal(r.def.rl, 45, 'les lanceurs de missiles sont comptés');
  assert.equal(r.def.ll, 12);
  assert.equal(r.fleet.sc, 12, 'les petits transporteurs aussi');
  assert.equal(r.fleet.sat, 30, 'et les satellites, qui ne se battent pas');
});

t('un libellé hors vocabulaire rend la section inconnue', () => {
  const txt = lire('nue.txt').replace('Défense', 'Défense\nTourelle fantôme\n4');
  assert.strictEqual(app().parseReport(txt).def, null,
    'lu sans comprendre n\'est pas compris vide');
});

t('les lignes d\'un bâtiment ne tombent pas dans la défense qui précède', () => {
  assert.deepEqual(app().parseReport(lire('nue.txt')).def, {},
    'le titre Bâtiment ferme la section Défense');
});

t('un libellé suivi de son nombre sur la même ligne se lit aussi', () => {
  const txt = 'Défense\nLanceur de missiles 45\nCommentaires';
  assert.equal(app().parseReport(txt).def.rl, 45);
});

t('le taux de butin se lit dans l\'en-tête', () => {
  assert.equal(app().parseReport(lire('complet.txt')).loot, 0.75);
  assert.equal(app().parseReport(lire('nue.txt')).loot, 0.5);
});

t('un rapport qui ne dit pas le butin ne l\'invente pas', () => {
  assert.strictEqual(app().parseReport('Métal\n10').loot, null);
});

t('les trois ressources se lisent encore comme avant', () => {
  assert.deepEqual(app().parseReport('Métal\n1.234\nCristal\n567\nDeutérium\n89').res,
    [1234, 567, 89]);
});

t('un collage sans ressources ne rend aucune ressource', () => {
  assert.strictEqual(app().parseReport('Défense\nCommentaires').res, null);
});

/* ---------- le collage remplit la case ---------- */

/** Une cible préparée, prête à recevoir un rapport. */
const cible = (extra) => s => { s.raid = Object.assign({ coords: '1:142:9', m: 0, c: 0, d: 0, safe: false }, extra); };

t('un rapport nu coche la case', () => {
  const g = app(cible({ coords: '2:88:4' }));
  g.applyReport(lire('nue.txt'));
  assert.strictEqual(g.S.raid.safe, true, 'ni flotte ni défense : la cible est nue');
});

t('un rapport avec défense décoche la case', () => {
  const g = app(cible({ coords: '3:120:7', safe: true }));
  g.applyReport(lire('complet.txt'));
  assert.strictEqual(g.S.raid.safe, false, 'la défense lue reprend la parole du joueur');
});

t('un rapport trop faible décoche aussi, et dit que la défense est inconnue', () => {
  const g = app(cible({ coords: '1:65:12', safe: true }));
  g.applyReport(lire('faible.txt'));
  assert.strictEqual(g.S.raid.safe, false);
  assert.strictEqual(g.S.raid.def, null, 'inconnue, pas vide');
});

t('un second collage efface la défense du premier', () => {
  const g = app(cible({ coords: '3:120:7' }));
  g.applyReport(lire('complet.txt'));
  assert.equal(g.S.raid.def.rl, 45, 'le premier rapport est bien lu');
  g.applyReport('Flottes\nAucune donnée fiable n\u0060a pu être détectée pour ce type en scannant.\nDéfense\nAucune donnée fiable n\u0060a pu être détectée pour ce type en scannant.\nCommentaires');
  assert.strictEqual(g.S.raid.def, null,
    'la défense d\'hier ne se lit pas sur la cible d\'aujourd\'hui');
});

t('un collage sans ressources laisse celles qui ont été tapées', () => {
  const g = app(cible({ m: 50000 }));
  g.applyReport('Défense\nCommentaires');
  assert.equal(g.S.raid.m, 50000,
    'un chiffre tapé à la main est une information du joueur');
});

t('une flotte de satellites et de sondes ne bloque pas le pillage', () => {
  const g = app(cible({ coords: '2:88:4' }));
  g.applyReport(lire('nue.txt').replace('Flottes', 'Flottes\nSatellite solaire\n12\nSonde d`espionnage\n3'));
  assert.strictEqual(g.S.raid.safe, true, 'ni l\'un ni l\'autre ne tire');
});

t('un petit transporteur au sol, lui, bloque le pillage', () => {
  const g = app(cible({ coords: '2:88:4' }));
  g.applyReport(lire('nue.txt').replace('Flottes', 'Flottes\nPetit transporteur\n2'));
  assert.strictEqual(g.S.raid.safe, false, 'c\'est un combat, et le copilote n\'en simule aucun');
});

/* Un libellé reconnu dont le compte ne suit pas laissait la section « lue et
   vide », donc la cible « nue », alors que le mot était sous les yeux du
   joueur. Le balayage vaut mieux que six cas ponctuels : c'est l'invariant
   qu'on protège, pas une mise en page. */
t('aucun rapport mal formé ne fait passer une cible pour nue', () => {
  const mauvais = [
    'Ressources\nMétal\n200.000\nFlottes\nDéfense\nLanceur de missiles',
    'Défense\nLanceur de missiles\nLaser léger\n12\nCommentaires',
    'Défense\nLanceur de missiles\nBâtiment\nUsine de robots\n4',
    'Flottes\nCroiseur\nDéfense\nCommentaires',
    'Défense\n45 Lanceur de missiles\nCommentaires'
  ];
  for(const txt of mauvais){
    const g = app(cible());
    g.applyReport(txt);
    assert.strictEqual(g.S.raid.safe, false,
      'un compte non apparié rend la section inconnue : ' + JSON.stringify(txt));
  }
});

t('un libellé sans son compte rend la section inconnue, pas vide', () => {
  const g = app(cible());
  g.applyReport('Flottes\nDéfense\nLanceur de missiles');
  assert.strictEqual(g.S.raid.def, null, 'lu à moitié n\'est pas lu');
});

t('un collage sans ressources ne rajeunit pas le rapport', () => {
  const g = app(cible({ m: 50000, at: SOIR - 5 * 3600e3 }));
  assert.equal(g.raidPlan().stale, true, 'le rapport est bien périmé au départ');
  g.applyReport('x');
  assert.equal(g.raidPlan().stale, true,
    'taper dans la zone ne remplace pas un espionnage');
});

t('un rapport qui parle d\'une autre planète n\'est pas appliqué', () => {
  const g = app(cible({ m: 50000 }));
  g.applyReport(lire('nue.txt'));
  assert.strictEqual(g.S.raid.safe, false, 'le rapport porte [2:88:4], la cible est 1:142:9');
  assert.equal(g.S.raid.m, 50000, 'et rien n\'est écrasé');
  assert.equal(g.S.raid.mismatch, '2:88:4', 'la carte pourra le dire');
});

t('le même rapport sur la bonne cible, lui, s\'applique', () => {
  const g = app(cible({ coords: '2:88:4' }));
  g.applyReport(lire('nue.txt'));
  assert.strictEqual(g.S.raid.safe, true);
  assert.ok(!g.S.raid.mismatch);
});

t('le butin lu dans le rapport est retenu', () => {
  const g = app(cible({ coords: '3:120:7' }));
  g.applyReport(lire('complet.txt'));
  assert.equal(g.S.raid.lootSeen, 0.75);
});

/* ---------- ce que la défense vaut, face au butin ---------- */

t('la défense lue est chiffrée au prix que le copilote paie pour la sienne', () => {
  const g = app(cible({ m: 100000, at: SOIR, def: { rl: 45 } }));
  const r = g.raidPlan();
  assert.equal(r.defValue, g.mse(45 * 2000, 0, 0));
  assert.ok(/45 lanceurs de missiles/.test(r.defList), r.defList);
});

t('une défense inconnue ne se chiffre pas', () => {
  const g = app(cible({ m: 100000, at: SOIR, def: null }));
  assert.strictEqual(g.raidPlan().defValue, null);
});

t('le taux de butin lu dans le rapport remplace celui déduit de la classe', () => {
  const g = app(cible({ m: 100000, at: SOIR, lootSeen: 0.75 }));
  const r = g.raidPlan();
  assert.equal(r.rateSeen, true);
  assert.equal(r.loot[0], 75000, 'le butin suit le rapport, pas la classe');
});

t('sans butin lu, la déduction par la classe tient', () => {
  const g = app(cible({ m: 100000, at: SOIR }));
  const r = g.raidPlan();
  assert.equal(r.rateSeen, false);
  assert.equal(r.loot[0], 50000);
});

/** Le HTML que la carte de pillage écrit dans #rdPlan. */
function carteRaidHtml(extra) {
  const g = app(s => {
    s.planets[0].ships = { lc: 10 };
    cible(extra)(s);
  }, SOIR, { planets: [['1:140:8', 'p1']], players: { p1: ['Alpha', 'i'] }, scores: { p1: [1000] } });
  g.REFRESH.explore();
  return g.html().rdPlan || '';
}

t('la carte pose la comparaison et ne compose aucun pillage', () => {
  const h = carteRaidHtml({ m: 100000, at: SOIR, def: { rl: 45 }, fleet: {} });
  assert.ok(/45 lanceurs de missiles/.test(h), 'ce qui a été lu : ' + h.slice(0, 400));
  assert.ok(/70 %/.test(h), 'et ce que percer coûte vraiment');
  assert.ok(!/data-launch/.test(h), 'aucune action d\'attaque');
});

t('la carte nomme la flotte adverse sans la chiffrer', () => {
  const h = carteRaidHtml({ m: 100000, at: SOIR, def: {}, fleet: { cr: 40 } });
  assert.ok(/40 croiseurs/.test(h), 'la flotte est nommée : ' + h.slice(0, 400));
  assert.ok(!/data-launch/.test(h), 'et rien n\'est composé');
});

/* Le verdict comparait un équivalent métal à une somme brute. Sur une cible
   riche en cristal et en deutérium, il disait « trop cher » d'une défense que
   le butin payait largement. */
t('le verdict compare deux équivalents métal, pas une pomme et une poire', () => {
  const h = carteRaidHtml({ m: 80000, c: 80000, d: 40000, at: SOIR, def: { gc: 3 }, fleet: {} });
  assert.ok(/3 canons de Gauss/.test(h), 'la défense est bien lue : ' + h.slice(0, 200));
  assert.ok(!/Percer coûte plus cher/.test(h),
    '145 500 de défense contre 160 000 de butin en équivalent métal');
});

t('une cible vide dit quand même que sa défense est inconnue', () => {
  const h = carteRaidHtml({ m: 0, c: 0, d: 0, at: SOIR, def: null, fleet: null });
  assert.ok(/ne montre pas/.test(h),
    'le collage ne doit pas avoir l\'air d\'avoir échoué : ' + h.slice(0, 300));
});

t('un rapport collé sur la mauvaise cible se voit', () => {
  const h = carteRaidHtml({ m: 50000, at: SOIR, mismatch: '2:88:4' });
  assert.ok(/2:88:4/.test(h), 'la carte nomme la planète du rapport : ' + h.slice(0, 300));
  assert.ok(!/data-launch/.test(h), 'et ne compose rien');
});

t('une cible nue, elle, compose bien l\'attaque', () => {
  const h = carteRaidHtml({ m: 100000, at: SOIR, def: {}, fleet: {}, safe: true });
  assert.ok(/data-launch/.test(h), 'le bouton est là quand tout est lu et vide');
});

t('la carte dit laquelle des deux sections manque', () => {
  const h = carteRaidHtml({ m: 100000, at: SOIR, def: null, fleet: {} });
  assert.ok(/défense/i.test(h) && /sonde/i.test(h),
    'elle nomme la défense inconnue et ce qui la montrerait : ' + h.slice(0, 400));
});

/* ---------- le statut hors-la-loi s'éteint à 500 000 points ---------- */

/** Un seul inactif voisin, plus fort que le joueur, et les scores qu'on veut. */
const apiPlusFort = moi => ({
  planets: [['1:140:8', 'p1']],
  players: { p1: ['Alpha', 'i'] },
  scores: moi == null ? { p1: [900000] } : { p1: [900000], moi: [moi] }
});

t('au-dessus de 500 000 points, un inactif plus fort reste une cible', () => {
  const g = app(s => { s.me = 'moi'; }, SOIR, apiPlusFort(600000));
  assert.equal(g.raidTargets()[0].outlaw, false,
    'le statut hors-la-loi n\'a plus d\'effet passé 500 000 points');
});

t('en dessous de 500 000 points, un inactif plus fort reste écarté', () => {
  const g = app(s => { s.me = 'moi'; }, SOIR, apiPlusFort(100000));
  assert.equal(g.raidTargets()[0].outlaw, true);
});

t('score du joueur inconnu : la prudence d\'avant ne bouge pas', () => {
  const g = app(s => { s.me = null; }, SOIR, apiPlusFort(null));
  assert.equal(g.raidTargets()[0].outlaw, false,
    'sans score, rien à comparer — comme aujourd\'hui');
});

/* ---------- les foreuses entrent dans le classement ---------- */

t('les foreuses se classent avec les mines quand le chantier les permet', () => {
  const g = app(s => {
    s.planets[0].b.shipyard = 5; s.tech.combustion = 4; s.tech.armour = 4; s.tech.laser = 4;
  });
  const r = g.rankUpgrades(g.S.planets[0]);
  const cw = r.find(u => u.key === 'crawl');
  assert.ok(cw, 'les foreuses sont une option du classement');
  assert.ok(cw.payback > 0 && isFinite(cw.payback), 'avec un amortissement chiffré : ' + cw.payback);
});

/* Le jeu exige aussi Laser 4 pour la foreuse. Sans ce prérequis le plan la
   proposait, et le chantier refusait. */
t('sans Laser 4, aucune foreuse proposée', () => {
  const g = app(s => {
    s.planets[0].b.shipyard = 5; s.tech.combustion = 4; s.tech.armour = 4; s.tech.laser = 3;
  });
  assert.ok(!g.rankUpgrades(g.S.planets[0]).some(u => u.key === 'crawl'));
});

t('sans le chantier qui les construit, aucune foreuse proposée', () => {
  const g = app();
  assert.ok(!g.rankUpgrades(g.S.planets[0]).some(u => u.key === 'crawl'));
});

/* ---------- les foreuses construites comptent ---------- */
/* Le jeu n'écrit la foreuse (217) que dans `crawlers`, jamais dans la flotte :
   217 ne figure pas dans OG_SHIPS. Le code simulé doit faire pareil, sans quoi
   la production ne voit jamais les foreuses et le plan les repropose. */

t('la fin d\'un minuteur de foreuses crédite le compte, pas la flotte', () => {
  const g = app();
  const p = g.S.planets[0];
  g.finishTimer({ kind: 'x', k: 'shipyard', pid: p.id, ships: { crawl: 40 }, end: SOIR });
  assert.equal(p.crawlers, 40, 'les foreuses doivent compter');
  assert.ok(!(p.ships && p.ships.crawl), 'et ne pas atterrir dans la flotte');
});

t('un minuteur lu dans le jeu ne touche pas au compte', () => {
  const g = app();
  const p = g.S.planets[0];
  p.crawlers = 120;
  g.finishTimer({ kind: 'x', k: 'shipyard', pid: p.id, ships: { crawl: 40 }, end: SOIR, game: true });
  assert.equal(p.crawlers, 120, 'la lecture du jeu fait foi');
});

/* Mines hautes et énergie large : un niveau de mine coûte alors assez cher pour
   que les foreuses passent devant, ce que le classement sait faire depuis
   toujours — mais que la boucle du chantier comparait par identité d'objet. */
const MINES_HAUTES = armour => s => {
  const p = s.planets[0];
  Object.assign(p.b, { metal: 28, crystal: 26, deut: 24, solar: 44, shipyard: 6 });
  // Laser 4 est l'autre prérequis de la foreuse ; l'armure reste l'interrupteur.
  s.tech.laser = 4;
  s.tech.armour = armour;
  p.stock = { m: 9e7, c: 9e7, d: 9e7, at: SOIR };
};

t('une carte de foreuses est proposee quand elles sont en tete du classement', () => {
  const g = app(MINES_HAUTES(4));
  assert.equal(g.rankUpgrades(g.S.planets[0])[0].key, 'crawl',
    'préalable du test : les foreuses doivent être en tête du classement');
  const cartes = g.simulateDay().sessions.flatMap(x => x.acts).filter(a => a.ships && a.ships.crawl);
  assert.ok(cartes.length, 'aucune carte de foreuses sur tout l\'horizon');
});

t('les lots de foreuses avancent et s\'arretent au plafond', () => {
  // La preuve que le compte avance : le moteur en pose 10 % du plafond par
  // connexion, et le dernier lot est rogné pour tomber juste. Avec le compte
  // figé, il aurait reproposé le même lot sans jamais s'arrêter.
  const g = app(MINES_HAUTES(4));
  const p = g.S.planets[0];
  const max = g.crawlerMax(p.b.metal, p.b.crystal, p.b.deut);
  const lots = g.simulateDay().sessions.flatMap(x => x.acts)
    .filter(a => a.ships && a.ships.crawl).map(a => a.ships.crawl);
  assert.ok(lots.length > 1, 'le plafond se remplit en plusieurs lots');
  assert.equal(lots.reduce((a, b) => a + b, 0), max,
    'les lots doivent totaliser le plafond exactement, et donc s\'arrêter : ' + lots.join(','));
  assert.ok(lots[lots.length - 1] < lots[0], 'le dernier lot est rogné pour tomber juste');
});

t('le gain des foreuses se voit dans la journee', () => {
  // Armure 4 ouvre les foreuses, armure 0 les interdit : même planète sinon.
  const avec = app(MINES_HAUTES(4)).simulateDay();
  const sans = app(MINES_HAUTES(0)).simulateDay();
  assert.ok(avec.endV - avec.startV > sans.endV - sans.startV,
    'la journée avec foreuses doit produire plus : ' +
    Math.round(avec.endV - avec.startV) + ' contre ' + Math.round(sans.endV - sans.startV));
});

/* ---------- la pastille de foreuses ---------- */
/* Les foreuses sont invisibles dans le jeu une fois posées : la carte de
   planète est le seul endroit qui dit combien en profitent encore. */

t('la carte de planete dit combien de foreuses servent', () => {
  const g = app(s => { s.planets[0].crawlers = 120; });
  g.REFRESH.planets();
  const html = g.html()['pres-0'] || '';
  assert.ok(/120\s*\/\s*288/.test(html),
    'le compte et le plafond (8 x (14+12+10)) doivent figurer : ' + html.slice(0, 300));
});

t('la pastille de foreuses occupe toute la largeur des jauges', () => {
  // Les jauges sont une grille de quatre colonnes : posée telle quelle, la
  // pastille tiendrait dans une colonne et son texte déborderait sa bordure.
  const g = app(s => { s.planets[0].crawlers = 120; });
  g.REFRESH.planets();
  assert.ok(/class="wide"[^>]*>\s*<span class="pill/.test(g.html()['pres-0'] || ''),
    'la pastille doit être dans un bandeau pleine largeur');
});

/* L'écran Objectifs tenait une liste que rien ne lisait : le plan du jour ne
   la regardait pas. Supprimé, son nom peut rester dans les réglages du joueur
   — Outils ne doit pas s'ouvrir sur le vide. */
t('l\'onglet Objectifs n\'existe plus, et un réglage périmé retombe sur Colonie', () => {
  const g = app(s => { s.ui.tool = 'plan'; });
  assert.ok(!g.REFRESH.plan, 'plus d\'écran Objectifs');
  g.REFRESH.tools();
  assert.ok(/plan\u00e8tes/.test(g.html().coSlots || ''), 'Outils ouvre Colonie : ' + (g.html().coSlots || ''));
});

t('pas de pastille quand aucune foreuse n\'est possible', () => {
  const g = app(s => {
    Object.assign(s.planets[0].b, { metal: 0, crystal: 0, deut: 0 });
  });
  g.REFRESH.planets();
  assert.ok(!/[Ff]oreuse/.test(g.html()['pres-0'] || ''),
    'plafond nul : rien à dire');
});

/* ---------- le fil du debut de partie ---------- */

t('le bloc de progression nomme la prochaine etape', () => {
  const g = app(s => { s.planets[0].b.lab = 2; s.tech.impulse = 0; });
  g.REFRESH.today();
  const html = g.html().tdDay || '';
  assert.ok(/Prochaine étape/.test(html), 'le bloc doit être rendu : ' + html.slice(0, 300));
  assert.ok(/\d+\s*\/\s*11/.test(html), 'et porter le compte sur onze');
});

t('les jalons franchis dans le desordre comptent quand meme', () => {
  // Astro 3 est tenu, Ordinateur 2 aussi, mais le labo est à 2 : le compte
  // doit refléter ce qui est franchi, pas l'indice du premier manquant.
  const g = app(s => { s.planets[0].b.lab = 2; });
  g.REFRESH.today();
  const m = /(\d+)\s*\/\s*11/.exec(g.html().tdDay || '');
  assert.ok(m, 'le compte doit être rendu');
  assert.ok(+m[1] >= 9, 'neuf jalons au moins sont franchis ici, et non 7 : ' + (m && m[1]));
});

/* ---------- les alertes ne dependent plus d'un second moteur ---------- */
/* Elles sortaient d'adviceList, moteur parallèle que simulateDay et
   dailyMissions avaient rattrapé. Elles viennent désormais d'une passe par
   planète, sans garde de file : un bâtiment en cours ne doit rien taire. */

t('energie negative et hangar plein sont dits tous les deux', () => {
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { metal: 20, solar: 1, smetal: 0 });
    p.stock = { m: 9e9, c: 0, d: 0, at: SOIR };
  });
  const a = g.simulateDay().alerts;
  assert.ok(a.some(x => /[Éé]nergie/.test(x.what)), 'l\'énergie négative doit être dite');
  assert.ok(a.some(x => /[Hh]angar/.test(x.what)), 'le hangar plein aussi');
});

t('une construction en cours ne fait pas taire les alertes', () => {
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { metal: 20, solar: 1 });
    s.timers = [{ id: 'x', kind: 'b', p: 0, k: 'metal', lvl: 21, end: SOIR + 6 * 3600e3 }];
  });
  assert.ok(g.simulateDay().alerts.some(x => /[Éé]nergie/.test(x.what)),
    'la file occupée ne doit pas effacer l\'avertissement');
});

t('l\'alerte nomme sa planete quand il y en a plusieurs', () => {
  const g = app(s => { Object.assign(s.planets[1].b, { metal: 12, solar: 1 }); });
  const nrj = g.simulateDay().alerts.filter(x => /énergie/i.test(x.what));
  assert.ok(nrj.length > 1, 'les deux planètes manquent d\'énergie ici');
  assert.ok(nrj.some(x => /Colonie/.test(x.what)), 'la colonie doit être nommée : ' + JSON.stringify(nrj));
  assert.ok(nrj.every(x => / sur /.test(x.what)), 'chaque alerte doit dire sur quelle planète');
});

t('une ressource sans production ne donne pas d\'alerte de hangar', () => {
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { deut: 0, sdeut: 0 });
    p.stock = { m: 0, c: 0, d: 0, at: SOIR };
  });
  g.simulateDay().alerts.forEach(x => {
    assert.ok(!/Infinity|NaN/.test(x.what + x.why), 'aucun chiffre absurde : ' + x.what);
  });
});

t('un debit negatif ne donne pas d\'alerte de hangar', () => {
  // Une centrale à fusion mange plus de deutérium que le synthétiseur n'en
  // produit : le débit est négatif, et sans le garde « plein dans » diviserait
  // par ce débit et annoncerait un réservoir plein dans une durée négative.
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { deut: 1, fusion: 12, sdeut: 4 });
    p.stock = { m: 0, c: 0, d: 0, at: SOIR };
  });
  const p = g.S.planets[0];
  assert.ok(g.production(p).d < 0, 'préalable du test : le débit de deutérium doit être négatif');
  assert.ok(!g.planetAlerts(p).some(a => /[Rr]éservoir/.test(a.what)),
    'rien à dire d\'un réservoir qui se vide : ' + JSON.stringify(g.planetAlerts(p)));
});

t('les alertes urgentes passent avant les avertissements', () => {
  // La planète mère n'a qu'un hangar qui se remplit (Attention), la colonie
  // manque d'énergie (Urgent). Dans l'ordre des planètes, l'Attention sort
  // en premier : c'est le tri par sévérité qui doit le remettre dessous.
  const g = app(s => {
    s.planets[0].stock = { m: 66524, c: 0, d: 0, at: SOIR };
    Object.assign(s.planets[1].b, { metal: 12, solar: 1 });
  });
  const sevs = g.simulateDay().alerts.map(a => a.sev);
  assert.ok(sevs.includes('bad') && sevs.includes('warn'),
    'préalable du test : il faut une urgence et un avertissement, et non ' + sevs.join(','));
  assert.ok(sevs.lastIndexOf('bad') < sevs.indexOf('warn'),
    'aucun Urgent ne doit se lire sous un Attention : ' + sevs.join(','));
});

t('la carte Alertes affiche ce que le moteur produit', () => {
  // Le moteur peut continuer à produire des alertes pendant que la carte cesse
  // de les montrer : c'est la carte, pas le tableau, que voit le joueur.
  const g = app(s => {
    Object.assign(s.planets[0].b, { metal: 20, solar: 1, smetal: 0 });
    s.planets[0].stock = { m: 9e9, c: 0, d: 0, at: SOIR };
  });
  g.REFRESH.today();
  const html = g.html().tdAlerts || '';
  assert.ok(/Urgent/.test(html), 'la pastille de sévérité doit être rendue : ' + html.slice(0, 200));
  assert.ok(/[Hh]angar/.test(html), 'et le hangar plein y figurer : ' + html.slice(0, 200));
});

t('tous les jalons franchis, le bloc disparait', () => {
  const g = app(s => {
    Object.assign(s.planets[0].b, { lab: 3, robot: 2, shipyard: 2 });
    Object.assign(s.tech, { energy: 3, combustion: 4, espionage: 4, computer: 2, impulse: 3, astro: 3 });
  });
  g.REFRESH.today();
  assert.ok(!/Début de partie/.test(g.html().tdDay || ''),
    'rien à afficher quand les onze sont franchis');
});

/* ---------- le délai de retour d'une colonie est simulé ---------- */

t('une colonie ne s\'amortit pas en moins d\'un jour', () => {
  // Le plan v1 l'affirmait en comparant un coût à une production finale, sans
  // compter le vaisseau, le trajet, ni les jours de mines avant de produire.
  const g = app(s => { s.tech.astro = 4; });
  const cp = g.colonyPayback(8);
  assert.ok(cp, 'le délai se calcule');
  assert.ok(cp.hours > 24, 'bien plus d\'un jour : ' + cp.hours + ' h');
});

t('le délai compte le vaisseau et le trajet avant la première ressource', () => {
  const g = app(s => { s.tech.astro = 4; });
  const cp = g.colonyPayback(8), F = g.coloFleet();
  const avant = (F.shipTime + F.leg1.secs) / 3600;
  assert.ok(cp.ramp >= avant, 'la montée commence après le vol : ' + cp.ramp + ' < ' + avant);
  assert.ok(cp.hours > cp.ramp, 'la mise se rend après la montée');
  assert.ok(cp.rate > 0 && cp.b.metal > 0, 'la colonie finit par produire');
});

t('une position à bonus de métal rend sa mise plus vite qu\'une position froide', () => {
  const g = app(s => { s.tech.astro = 8; });
  assert.ok(g.colonyPayback(8).rate > g.colonyPayback(15).rate,
    'la position 8 (+35 % métal) produit plus que la 15');
});

/* ---------- la surcharge des foreuses se règle ---------- */

t('la surcharge augmente le bonus de moitié et double l\'énergie', () => {
  const g = app();
  assert.ok(Math.abs(g.crawlerBonus(100, 'collector', true)
                   - g.crawlerBonus(100, 'collector', false) * 1.5) < 1e-9);
  const avec = app(s => { s.settings.crawlerOverload = true; s.planets[0].crawlers = 100; });
  const sans = app(s => { s.settings.crawlerOverload = false; s.planets[0].crawlers = 100; });
  assert.equal(avec.production(avec.S.planets[0]).eCons - avec.production(avec.S.planets[0], { crawlers: 0 }).eCons,
    2 * (sans.production(sans.S.planets[0]).eCons - sans.production(sans.S.planets[0], { crawlers: 0 }).eCons),
    'cent foreuses en surcharge consomment deux fois plus');
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

/* ---------- la découverte coûte un emplacement de flotte ---------- */

/* Une mission de découverte prend un emplacement comme n'importe quelle autre.
   Proposée alors qu'ils sont tous pris, elle envoie sur un bouton gris :
   « Nombre maximal de flottes atteint ». Releve en jeu le 12 novembre, cinq
   decouvertes et deux expeditions pour sept emplacements. */
t('emplacements de flotte pleins : aucune carte de découverte', () => {
  const g = app(s => { s.slots = { expo: [2, 2], fleet: [7, 7], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  assert.ok(!g.dailyMissions().some(m => m.id === 'discovery'), 'la carte ne sort pas');
});

t('avec un emplacement libre, la découverte est proposée', () => {
  const g = app(s => { s.slots = { expo: [0, 2], fleet: [2, 7], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  assert.ok(g.dailyMissions().some(m => m.id === 'discovery'), 'la carte sort');
});

t('la carte de découverte dit ce qu\'elle coûte en emplacement', () => {
  const g = app(s => { s.slots = { expo: [0, 2], fleet: [2, 7], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(/emplacement/i.test(c.why + c.how.join(' ')), 'le coût est dit : ' + c.why);
});

/* ---------- ce qu'un lien peut préremplir, et ce qu'il ne peut pas ---------- */

const HOTE = s => { s.host = 's1-fr.ogame.gameforge.com'; };
const BATIMENT = { kind: 'b', k: 'metal', lvl: 21, p: 0, q: 'Bâtiment', what: 'Métal 21' };
const PREREMPLI = /pr[ée]-?remplir/i;

t('une carte de bâtiment dit que le lien ne préremplit rien', () => {
  const g = app(HOTE, SOIR);
  const note = g.goNote(BATIMENT);
  assert.ok(PREREMPLI.test(note), 'la note explique la limite : ' + note);
});

t('une carte de flotte ne porte pas cette note', () => {
  const g = app(HOTE, SOIR);
  assert.equal(g.goNote({ kind: 'transfer', p: 0, dest: '1:142:6', mission: 3, ships: { sc: 1 } }), '');
});

t('sans serveur connu, aucune note : il n\'y a pas de lien', () => {
  const g = app(null, SOIR);
  assert.equal(g.goNote(BATIMENT), '');
});

t('la note apparaît dans le HTML de la carte', () => {
  const g = app(HOTE, SOIR);
  assert.ok(PREREMPLI.test(g.actHtml(BATIMENT, false)));
});

t('une recherche porte la même note', () => {
  const g = app(HOTE, SOIR);
  assert.ok(PREREMPLI.test(g.goNote({ kind: 't', k: 'astro', lvl: 5, p: 0 })));
});

/* Sans identifiant de planète, le lien n'emporte pas de `cp=` : il ouvre la
   page sur la planète que le jeu avait en tête. Promettre « la bonne planète »
   enverrait construire ailleurs un joueur qui en a plusieurs. */
t('sur une planète que le jeu a nommée, la note promet la bonne planète', () => {
  const g = app(s => { HOTE(s); s.planets[0].gid = '33001'; }, SOIR);
  assert.ok(/bonne planète/.test(g.goNote(BATIMENT)));
});

t('sur une planète jamais nommée, la note ne promet pas la planète', () => {
  const g = app(HOTE, SOIR);
  const note = g.goNote(BATIMENT);
  assert.ok(PREREMPLI.test(note), 'elle dit toujours la limite');
  assert.ok(!/bonne planète/.test(note), 'mais ne promet rien de faux : ' + note);
});

t('une carte de chantier ne parle pas de bâtiment ni de recherche', () => {
  const g = app(s => { HOTE(s); s.planets[0].gid = '33001'; }, SOIR);
  const note = g.goNote({ kind: 'ship', k: 'lc', n: 5, p: 0 });
  assert.ok(PREREMPLI.test(note), 'la note sort pour un chantier aussi');
  assert.ok(!/b[âa]timent ou une recherche/i.test(note), 'sans se tromper de vocabulaire : ' + note);
});


/* ---------- le panneau de production ---------- */

/* Relevé sur Caribou Land le 12 novembre. Les nombres du jeu portent des
   points comme séparateurs de milliers, et la colonne énergie du total
   s'écrit « libre/produite ». */
const PANNEAU_CARIBOU = [
  'Facteur de production: 100%',
  'Revenu de base\t240\t120\t0\t0',
  'Mine de métal (Niveau 21)\t37.297\t0\t0\t-1.554\t100%',
  'Mine de cristal (Niveau 17)\t0\t13.748\t0\t-859\t100%',
  'Synthétiseur de deutérium (Niveau 17)\t0\t0\t7.946\t-1.718\t100%',
  'Centrale électrique solaire (Niveau 19)\t0\t0\t0\t2.324\t100%',
  'Centrale électrique de fusion (Niveau 7)\t0\t0\t-1.091\t464\t100%',
  'Centre de recherche (Niveau 2)\t0\t0\t0\t-23',
  'Satellite solaire (Nombre : 34)\t0\t0\t0\t1.190\t100%',
  'Foreuse (Nombre : 0/440)\t0\t0\t0\t0\t100%',
  'Le collecteur\t9.324\t3.437\t1.986\t397',
  'Bonus technologique de forme de vie\t96\t46\t20\t9',
  'Capacité de stockage\t2M\t255.000\t470.000\t0',
  'Total par heure:\t46.958\t17.351\t8.862\t231/4.385'
].join('\n');

t('le panneau donne le bonus de forme de vie', () => {
  const g = app(null, SOIR);
  assert.deepEqual(g.parseProdPanel(PANNEAU_CARIBOU).lfBonus, [96, 46, 20, 9]);
});

t('le panneau donne l\'énergie libre et produite', () => {
  const g = app(null, SOIR);
  assert.deepEqual(g.parseProdPanel(PANNEAU_CARIBOU).energy, { free: 231, prod: 4385 });
});

t('le panneau donne le plafond de foreuses', () => {
  const g = app(null, SOIR);
  assert.equal(g.parseProdPanel(PANNEAU_CARIBOU).crawlerMax, 440);
});

t('le panneau donne le facteur de production', () => {
  const g = app(null, SOIR);
  assert.equal(g.parseProdPanel(PANNEAU_CARIBOU).factor, 1);
});

t('une ligne de bâtiment porte son niveau et ses quatre colonnes', () => {
  const g = app(null, SOIR);
  const r = g.parseProdPanel(PANNEAU_CARIBOU).rows.find(x => /Mine de métal/.test(x.label));
  assert.equal(r.lvl, 21);
  assert.deepEqual(r.v, [37297, 0, 0, -1554]);
  assert.equal(r.pct, 100);
});

t('le revenu de base et les capacités sont lus ; « 2M » reste inconnu', () => {
  const p = app(null, SOIR).parseProdPanel(PANNEAU_CARIBOU);
  assert.deepEqual(p.base, [240, 120, 0]);
  assert.deepEqual(p.caps, [null, 255000, 470000]);
});

t('sans la ligne « Total par heure », le panneau n\'est pas là', () => {
  assert.equal(app(null, SOIR).parseProdPanel('Facteur de production: 100%\nRevenu de base\t1\t1\t0\t0'), null);
  assert.equal(app(null, SOIR).parseProdPanel(null), null);
});

t('un compte absurde est ramené au plafond', () => {
  const p = app(null, SOIR).parseProdPanel('Foreuse (Nombre : 5/99999999)\t0\t0\t0\t0\nTotal par heure:\t1\t1\t1\t0/0');
  assert.strictEqual(p.crawlerMax, 1e6);
  assert.strictEqual(p.rows[0].max, 1e6);
});

t('un compte de plus de neuf chiffres est refusé, pas repris', () => {
  const p = app(null, SOIR).parseProdPanel('Foreuse (Nombre : 5/99999999999)\t0\t0\t0\t0\nTotal par heure:\t1\t1\t1\t0/0');
  assert.strictEqual(p.rows[0].max, null);
  assert.strictEqual(p.crawlerMax, 0);
});

t('applyGame range chaque panneau sous son gid, sans toucher aux autres', () => {
  const g = app(null, SOIR);
  g.S.prod = { 33003: { at: 1, factor: 1 } };
  const bad = {};
  bad['33001'] = { text: PANNEAU_CARIBOU, at: SOIR };
  bad['33002'] = { text: 'x', at: SOIR };
  // clé littérale « __proto__ » (comme après un JSON.parse), qu'une affectation ordinaire ne créerait pas
  Object.defineProperty(bad, '__proto__', { value: { text: PANNEAU_CARIBOU, at: SOIR }, enumerable: true });
  g.applyGame({ prod: bad, planets: {}, timers: [], moves: [] });
  assert.deepEqual(g.S.prod['33001'].lfBonus, [96, 46, 20, 9]);
  assert.strictEqual(g.S.prod['33001'].at, SOIR);
  assert.ok(!('33002' in g.S.prod), 'illisible : absent');
  assert.deepEqual(g.S.prod['33003'], { at: 1, factor: 1 }, 'l\'autre planète est intacte');
  assert.deepEqual(Object.keys(g.S.prod).sort(), ['33001', '33003']);
  assert.strictEqual(Object.getPrototypeOf(g.S.prod), Object.prototype);
});

t('le panneau d\'une planète n\'en renseigne pas une autre', () => {
  const g = app(s => { s.planets[0].gid = '33001'; s.planets[1].gid = '33002'; });
  g.S.prod = { 33001: { lfBonus: [96, 46, 20, 9], at: SOIR, factor: 1 } };
  assert.deepEqual(g.prodOf(g.S.planets[0]).lfBonus, [96, 46, 20, 9]);
  assert.equal(g.prodOf(g.S.planets[1]), undefined);
  g.S.planets[1].gid = undefined;
  assert.equal(g.prodOf(g.S.planets[1]), undefined);
  g.S.planets[1].gid = 'toString';
  assert.equal(g.prodOf(g.S.planets[1]), undefined, 'pas de repli sur le prototype');
});

t('le bonus de forme de vie lu s\'ajoute \u00e0 la production', () => {
  const sans = app(s => { s.planets[0].gid = '33001'; s.planets[0].sats = 500; }, SOIR);
  const avec = app(s => {
    s.planets[0].gid = '33001'; s.planets[0].sats = 500;
    s.prod = { 33001: { lfBonus: [96, 46, 20, 9], at: SOIR, factor: 1 } };
  }, SOIR);
  const a = avec.production(avec.S.planets[0]), b = sans.production(sans.S.planets[0]);
  assert.ok(Math.abs((a.m - b.m) - 96) < 1, 'm\u00e9tal : ' + (a.m - b.m));
  assert.ok(Math.abs((a.c - b.c) - 46) < 1, 'cristal : ' + (a.c - b.c));
  assert.ok(Math.abs((a.d - b.d) - 20) < 1, 'deut\u00e9rium : ' + (a.d - b.d));
  assert.equal(a.eProd - b.eProd, 9, '\u00e9nergie dans eProd');
  assert.equal(a.eBal - b.eBal, 9);
});

t('en manque d\'\u00e9nergie, l\'\u00e9nergie du bonus relève le facteur', () => {
  const sans = app(s => { s.planets[0].gid = '33001'; }, SOIR);
  const avec = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: { lfBonus: [0, 0, 0, 9], at: SOIR, factor: 1 } };
  }, SOIR);
  const a = avec.production(avec.S.planets[0]), b = sans.production(sans.S.planets[0]);
  assert.equal(a.eProd - b.eProd, 9);
  assert.ok(a.factor > b.factor, 'facteur ' + b.factor + ' -> ' + a.factor);
});

t('le bonus lu ne touche pas une autre plan\u00e8te', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.prod = { 33001: { lfBonus: [96, 46, 20, 9], at: SOIR, factor: 1 } };
  }, SOIR);
  const sans = app(s => { s.planets[1].gid = '33002'; }, SOIR);
  assert.equal(g.production(g.S.planets[1]).m, sans.production(sans.S.planets[1]).m);
});

t('sans panneau lu, la production ne change pas', () => {
  const g = app(s => { s.planets[0].gid = '33001'; delete s.prod; }, SOIR);
  assert.ok(g.production(g.S.planets[0]).m > 0, 'le moteur garde ses formules');
});

t('une lecture de plus de sept jours est ignor\u00e9e', () => {
  const vieux = SOIR - 8 * 86400e3;
  const g = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: { lfBonus: [9999, 0, 0, 0], at: vieux, factor: 1 } };
  }, SOIR);
  const sans = app(s => { s.planets[0].gid = '33001'; }, SOIR);
  assert.ok(Math.abs(g.production(g.S.planets[0]).m - sans.production(sans.S.planets[0]).m) < 1,
    'le bonus p\u00e9rim\u00e9 n\'est pas appliqu\u00e9');
});

t('une lecture de six jours compte encore', () => {
  const g = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: { lfBonus: [500, 0, 0, 0], at: SOIR - 6 * 86400e3, factor: 1 } };
  }, SOIR);
  const sans = app(s => { s.planets[0].gid = '33001'; }, SOIR);
  assert.ok(g.production(g.S.planets[0]).m - sans.production(sans.S.planets[0]).m > 499);
});

t('un bonus illisible (non fini, n\u00e9gatif) n\'entre pas dans la production', () => {
  const g = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: { lfBonus: [NaN, -50, 'x', Infinity], at: SOIR, factor: 1 } };
  }, SOIR);
  const sans = app(s => { s.planets[0].gid = '33001'; }, SOIR);
  const a = g.production(g.S.planets[0]), b = sans.production(sans.S.planets[0]);
  assert.equal(a.m, b.m); assert.equal(a.c, b.c); assert.equal(a.d, b.d); assert.equal(a.eProd, b.eProd);
});

/** Le panneau Caribou dont la dernière cellule (énergie libre/produite) est remplacée. */
const panneauEnergie = cell => PANNEAU_CARIBOU.replace('231/4.385', cell);
/** Fait lire à applyGame un panneau pour la planète 33001 de la fixture. */
function lis(g, text, at) {
  g.S.planets[0].gid = '33001';
  g.applyGame({ prod: { 33001: { text, at } }, planets: {}, timers: [], moves: [] });
  return g.production(g.S.planets[0]);
}

t('l\'énergie lue cale le bilan de la planète, quel que soit l\'ancien eAdj', () => {
  const g = app(s => { s.planets[0].eAdj = -300; }, SOIR);
  const avant = g.production(g.S.planets[0]).eBal;
  const pr = lis(g, PANNEAU_CARIBOU, SOIR);
  assert.notEqual(avant, 231, 'la fixture ne tombe pas déjà sur 231 : le test mord');
  assert.strictEqual(pr.eBal, 231, 'le solde suit la lecture : ' + pr.eBal);
});

t('l\'écart d\'énergie se mesure sans eAdj, contre le solde', () => {
  const g = app(null, SOIR);
  lis(g, PANNEAU_CARIBOU, SOIR);
  const p = g.S.planets[0], eAdj = p.eAdj;
  p.eAdj = 0;
  assert.strictEqual(231 - g.production(p).eBal, eAdj);
});

t('une énergie libre illisible laisse eAdj intact', () => {
  const g = app(s => { s.planets[0].eAdj = -77; }, SOIR);
  lis(g, panneauEnergie('1.2.3/4.385'), SOIR);
  assert.strictEqual(g.S.planets[0].eAdj, -77);
});

t('un panneau de plus de sept jours ne cale pas le bilan', () => {
  const g = app(s => { s.planets[0].eAdj = -77; }, SOIR);
  lis(g, PANNEAU_CARIBOU, SOIR - 8 * 86400e3);
  assert.strictEqual(g.S.planets[0].eAdj, -77);
});

t('une énergie libre démesurée est bornée', () => {
  const g = app(null, SOIR);
  lis(g, panneauEnergie('999.999.999.999/4.385'), SOIR);
  assert.ok(Math.abs(g.S.planets[0].eAdj) <= 2e9, 'eAdj borné : ' + g.S.planets[0].eAdj);
});

/* Une mine bridée produit moins ; c'est un état, pas une propriété de la mine.
   Le gain du niveau suivant se calcule sur la mine à pleine marche, sinon le
   classement condamnerait pour toujours une planète à court d'énergie. */
t('un facteur sous 100 % ne se propage pas au gain du niveau suivant', () => {
  const g = app(null, SOIR);
  lis(g, panneauEnergie('-500/2.000').replace('Facteur de production: 100%', 'Facteur de production: 80%'), SOIR);
  assert.ok(g.production(g.S.planets[0]).factor < 1, 'la planète manque d\'énergie');
  const ups = g.rankUpgrades(g.S.planets[0]);
  assert.ok(ups.length, 'des montées sont proposées');
  assert.strictEqual(ups[0].key, 'solar', 'et l\'énergie passe devant : ' + ups.map(u => u.key));
});

t('le panneau donne le total horaire que le jeu affiche', () => {
  const g = app(null, SOIR);
  assert.deepEqual(g.parseProdPanel(PANNEAU_CARIBOU).perHour, [46958, 17351, 8862]);
});

t('la production lue cale les trois ressources de la planète', () => {
  // le joueur compare la carte au « Total par heure » du jeu : les deux doivent dire pareil
  const g = app(null, SOIR);
  const avant = g.production(g.S.planets[0]);
  assert.ok(Math.round(avant.m) !== 46958, 'la fixture ne tombe pas déjà dessus : le test mord');
  const pr = lis(g, PANNEAU_CARIBOU, SOIR);
  assert.deepEqual([pr.m, pr.c, pr.d].map(Math.round), [46958, 17351, 8862]);
});

t("l'écart calé est additif : une montée simulée garde tout son gain", () => {
  /* Caler ne doit pas écraser la comparaison entre deux montées : l'écart est
     un forfait, le delta d'un niveau reste celui de la formule. */
  const g = app(null, SOIR);
  const p = g.S.planets[0];
  const nu = { metal: p.b.metal + 1 };
  lis(g, PANNEAU_CARIBOU, SOIR);
  const cale = g.production(p, nu).m - g.production(p).m;
  const ecart = p.pAdj;
  p.pAdj = null; // tout le reste identique : seul le forfait tombe
  const brut = g.production(p, nu).m - g.production(p).m;
  assert.ok(ecart && ecart[0] !== 0, 'un écart a bien été posé : ' + ecart);
  assert.ok(brut > 0, 'un niveau de mine rapporte : ' + brut);
  assert.ok(Math.abs(cale - brut) < 1e-6, cale + ' vs ' + brut);
});

t("un sol se lit sans la calibration posée sur la planète", () => {
  // sinon le forfait d'une planète la ferait passer devant les autres au classement des terrains
  const g = app(null, SOIR);
  const avant = g.terrainRates(g.S.planets[0]);
  lis(g, PANNEAU_CARIBOU, SOIR);
  assert.deepEqual(g.terrainRates(g.S.planets[0]), avant);
});

t("un total par heure illisible laisse la production au moteur", () => {
  const g = app(null, SOIR);
  const sans = PANNEAU_CARIBOU.replace('Total par heure:\t46.958\t17.351\t8.862\t231/4.385',
    'Total par heure:\t2M\t17.351\t8.862\t231/4.385');
  lis(g, sans, SOIR);
  assert.strictEqual(g.S.planets[0].pAdj, undefined, 'aucun écart posé sur un total tronqué');
});

t('un même panneau relu ne gomme pas le coût d\'un niveau monté depuis', () => {
  const g = app(null, SOIR);
  lis(g, PANNEAU_CARIBOU, SOIR);
  const p = g.S.planets[0], eAdj = p.eAdj;
  p.b.metal++;
  const apres = g.production(p).eBal;
  assert.ok(apres < 231, 'le niveau coûte de l\'énergie : ' + apres);
  lis(g, PANNEAU_CARIBOU, SOIR);
  assert.strictEqual(p.eAdj, eAdj, 'eAdj inchangé à la relecture');
  assert.strictEqual(g.production(p).eBal, apres, 'le solde garde le coût du niveau');
});

t('un nouveau panneau recale de nouveau', () => {
  const g = app(null, SOIR);
  lis(g, PANNEAU_CARIBOU, SOIR);
  g.S.planets[0].b.metal++;
  lis(g, PANNEAU_CARIBOU, SOIR + 1000);
  assert.strictEqual(g.production(g.S.planets[0]).eBal, 231);
});

t('le facteur ne descend jamais sous zéro', () => {
  const g = app(null, SOIR);
  const pr = lis(g, panneauEnergie('-100.000/4.385'), SOIR);
  assert.ok(pr.eProd < 0, 'la production d\'énergie est négative : ' + pr.eProd);
  assert.strictEqual(pr.factor, 0);
  assert.ok(pr.m >= 0 && pr.c >= 0 && pr.d >= 0, 'aucune production négative');
});

t('la fenêtre de sept jours : juste dedans calibre, juste dehors non', () => {
  const dedans = app(null, SOIR);
  lis(dedans, PANNEAU_CARIBOU, SOIR - 6.9 * 86400e3);
  assert.strictEqual(dedans.production(dedans.S.planets[0]).eBal, 231);
  const dehors = app(s => { s.planets[0].eAdj = -77; }, SOIR);
  lis(dehors, PANNEAU_CARIBOU, SOIR - 7.1 * 86400e3);
  assert.strictEqual(dehors.S.planets[0].eAdj, -77);
});

t('calibrer une planète ne touche pas les autres', () => {
  const g = app(s => { s.planets[1].gid = '33001'; s.planets[0].eAdj = -77; s.planets[1].eAdj = 0; }, SOIR);
  g.S.planets[0].gid = '33009';
  g.applyGame({ prod: { 33001: { text: PANNEAU_CARIBOU, at: SOIR } }, planets: {}, timers: [], moves: [] });
  assert.strictEqual(g.S.planets[0].eAdj, -77, 'l\'autre planète est intacte');
  assert.strictEqual(g.production(g.S.planets[1]).eBal, 231, 'la bonne planète est calée');
});

t("le copilote n'ajoute aucune entrée au menu du jeu", () => {
  /* Il en recolore les entrées et cache les payantes ; il n'en pose pas. Le
     joueur a demandé le retrait de l'entrée « Mouvement de flotte », et une
     copie d'entrée de menu est de toute façon le seul endroit où le copilote
     écrivait dans la page sans l'avoir lue ailleurs. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'content.js'), 'utf8');
  assert.ok(!/copilote-menu-ajout/.test(src), "la classe de l'entrée ajoutée ne doit pas revenir");
  assert.ok(!/ajouteMouvement/.test(src), 'ni la fonction qui la posait');
  assert.ok(!/li\.after\(/.test(src), 'ni une insertion à côté d\'une entrée du menu');
});

/* ---------- un chantier flou ne se relit qu'une fois son lot au sol ---------- */

/** Une planète dont le chantier a un lot, avec son heure de sortie et la dernière lecture. */
const CHANTIER = (g, sortie, lu) => {
  const p = g.S.planets[0];
  p.b.shipyard = 4; p.flotteFloue = sortie; p.shipsAt = lu;
  p.defFloue = 0; p.defsAt = lu;
  return p;
};

t('un lot encore en route rend le chantier flou', () => {
  // le copilote ne propose rien à ce chantier : il doublerait ce qui en sort
  const g = app(null, SOIR);
  assert.equal(g.chantierFlou(CHANTIER(g, SOIR + 2 * 3600e3, SOIR)), true);
});

t("mais on ne demande pas d'aller relire une page qui n'a rien de neuf", () => {
  /* Elle dirait le même compte qu'avant : le joueur faisait le geste, rien ne
     changeait, et la carte revenait au tour suivant. */
  const g = app(null, SOIR);
  assert.equal(g.chantierARelire(CHANTIER(g, SOIR + 2 * 3600e3, SOIR)), false);
});

t('le lot au sol et jamais relu, là il faut rouvrir la page', () => {
  const g = app(null, SOIR);
  assert.equal(g.chantierARelire(CHANTIER(g, SOIR - 3600e3, SOIR - 2 * 3600e3)), true);
});

t('un lot au sol et déjà relu ne demande plus rien', () => {
  const g = app(null, SOIR);
  const p = CHANTIER(g, SOIR - 2 * 3600e3, SOIR - 60e3);
  assert.equal(g.chantierFlou(p), false);
  assert.equal(g.chantierARelire(p), false);
});

t('la défense suit la même règle que la flotte', () => {
  const g = app(null, SOIR);
  const p = g.S.planets[0];
  p.b.shipyard = 4; p.flotteFloue = 0; p.shipsAt = SOIR;
  p.defFloue = SOIR + 3600e3; p.defsAt = SOIR;
  assert.equal(g.chantierARelire(p), false, 'le lot de défense est encore en route');
  p.defFloue = SOIR - 3600e3; p.defsAt = SOIR - 2 * 3600e3;
  assert.equal(g.chantierARelire(p), true);
});

/* ---------- un prix de case appartient à l'espèce, pas à la planète ---------- */

/** Deux planètes de la même espèce : la case 11101 y coûte la même chose. */
const DEUX_LF = (g, a, b) => {
  g.S.planets[0].lf = { 11101: a };
  g.S.planets[1].lf = { 11101: b };
  g.lfMetEnCommun();
  return [g.S.planets[0].lf[11101], g.S.planets[1].lf[11101]];
};

t('le prix lu sur une planète chiffre la même case sur les autres', () => {
  /* Sans ça le copilote ne comparait que la case qu'on venait d'ouvrir, et la
     désignait forcément — quelle qu'elle soit. */
  const g = app(null, SOIR);
  const [, b] = DEUX_LF(g,
    { lvl: 3, state: 'ok', next: 4, cost: [1200, 600, 0], secs: 900, seenAt: { 4: SOIR } },
    { lvl: 3, state: 'ok' });
  assert.deepEqual(b.seen[4], [1200, 600, 0], 'la seconde planète hérite du prix');
  assert.deepEqual(g.lfCost(b, 4).cost, [1200, 600, 0]);
});

t('la lecture locale prime toujours sur celle des voisines', () => {
  const g = app(null, SOIR);
  const [a] = DEUX_LF(g,
    { lvl: 3, state: 'ok', seen: { 4: [1, 1, 1] }, seenAt: { 4: SOIR } },
    { lvl: 3, state: 'ok', next: 4, cost: [9999, 9999, 9999], secs: 900, seenAt: { 4: SOIR + 1000 } });
  assert.deepEqual(a.seen[4], [1, 1, 1], 'ce que cette planète a lu reste le sien');
});

t("deux niveaux vus sur deux planètes donnent enfin le facteur", () => {
  /* C'est le vrai gain : une seule planète ne voit qu'un niveau à la fois, et
     lfCost en demande deux pour extrapoler. */
  const g = app(null, SOIR);
  const [a] = DEUX_LF(g,
    { lvl: 3, state: 'ok', next: 4, cost: [1000, 0, 0], secs: 900, seenAt: { 4: SOIR } },
    { lvl: 5, state: 'ok', next: 6, cost: [1440, 0, 0], secs: 900, seenAt: { 6: SOIR } });
  const c = g.lfCost(a, 8);
  assert.ok(c, 'le niveau 8 se chiffre maintenant');
  assert.equal(c.src, 'estimé');
  assert.equal(c.cost[0], 2074); // 1440 × 1,2² : le facteur se lit entre les niveaux 4 et 6
});

t("la durée ne se prête qu'à une planète qui n'en a aucune", () => {
  // elle dépend du chantier de la planète autant que de la case
  const g = app(null, SOIR);
  const [a, b] = DEUX_LF(g,
    { lvl: 3, state: 'ok', secs: 300 },
    { lvl: 3, state: 'ok', next: 4, cost: [1200, 0, 0], secs: 900, seenAt: { 4: SOIR } });
  assert.equal(a.secs, 300, 'sa propre durée est gardée');
  const g2 = app(null, SOIR);
  const [c] = DEUX_LF(g2,
    { lvl: 3, state: 'ok' },
    { lvl: 3, state: 'ok', next: 4, cost: [1200, 0, 0], secs: 900, seenAt: { 4: SOIR } });
  assert.equal(c.secs, 900, 'sans durée à elle, elle emprunte');
});

t("une case que personne n'a ouverte ne reçoit rien", () => {
  const g = app(null, SOIR);
  const [a, b] = DEUX_LF(g, { lvl: 3, state: 'ok' }, { lvl: 2, state: 'ok' });
  assert.ok(!a.seen || !Object.keys(a.seen).length, 'rien à partager');
  assert.equal(g.lfCost(a, 4), null);
});

/* ---------- le prix d'une case jamais ouverte ---------- */

/* Les coûts de forme de vie suivent base × facteur^(n−1), comme le reste du
   jeu. Deux niveaux observés donnent le facteur, donc tous les autres. */
t('deux prix vus donnent le prix d\'un troisième niveau', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [1000, 500, 0], 3: [1440, 720, 0] }, lvl: 4 };
  const e = g.lfCost(v, 5);
  assert.equal(e.src, 'estimé');
  assert.ok(Math.abs(e.cost[0] - 1000 * Math.pow(1.2, 4)) < 20, 'métal : ' + e.cost[0]);
  assert.ok(Math.abs(e.cost[1] - 500 * Math.pow(1.2, 4)) < 20, 'cristal : ' + e.cost[1]);
});

t('un prix lu au bon niveau prime sur l\'estimation', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [1000, 500, 0], 3: [1440, 720, 0] }, lvl: 2, next: 3, cost: [1440, 720, 0], secs: 60 };
  assert.equal(g.lfCost(v, 3).src, 'lu');
  assert.deepEqual(g.lfCost({ seen: { 1: [1000, 500, 0], 3: [1440, 720, 0] }, lvl: 2 }, 3).cost, [1440, 720, 0]);
});

t('un seul prix vu ne permet pas d\'estimer plus haut', () => {
  const g = app(null, SOIR);
  assert.equal(g.lfCost({ seen: { 1: [1000, 500, 0] }, lvl: 3 }, 4), null);
});

t('une case jamais vue n\'est pas classée, et le panneau le dit', () => {
  const g = app(s => { s.planets[0].lf = { 11101: { lvl: 0, state: 'on' } }; }, SOIR);
  assert.equal(g.lfCost(g.S.planets[0].lf[11101], 1), null);
  assert.ok(!g.lfCandidates(g.S.planets[0], 'lfbuilding').length, 'rien à classer');
});

t('le facteur est tiré des deux niveaux les plus hauts, pas des plus bas', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [100, 0, 0], 2: [1000, 0, 0], 3: [1100, 0, 0], 4: [1210, 0, 0] } };
  assert.ok(Math.abs(g.lfCost(v, 5).cost[0] - 1331) <= 1, 'x1,1 par niveau : ' + g.lfCost(v, 5).cost[0]);
});

t('l\'estimation projette depuis le niveau le plus haut, vers le bas comme vers le haut', () => {
  const g = app(null, SOIR);
  const v = { seen: { 2: [1000, 0, 0], 4: [1440, 0, 0] } };
  assert.ok(Math.abs(g.lfCost(v, 3).cost[0] - 1200) <= 1, 'niveau 3 : ' + g.lfCost(v, 3).cost[0]);
  assert.equal(g.lfCost(v, 0), null, 'le niveau 0 n\'existe pas');
});

t('un facteur hors de [1, 5] ne chiffre pas : les deux prix ne peuvent pas être justes ensemble', () => {
  const g = app(null, SOIR);
  assert.equal(g.lfCost({ seen: { 1: [1000, 0, 0], 2: [500, 0, 0] } }, 3), null, 'à la baisse');
  assert.equal(g.lfCost({ seen: { 1: [100, 0, 0], 2: [100000, 0, 0] } }, 3), null, 'délirant');
  assert.deepEqual(g.lfCost({ seen: { 1: [1000, 0, 0], 2: [1000, 0, 0] } }, 3).cost, [1000, 0, 0], 'plat : 1 est dans les bornes');
  assert.deepEqual(g.lfCost({ seen: { 1: [100, 0, 0], 2: [500, 0, 0] } }, 3).cost, [2500, 0, 0], '5 est dans les bornes');
});

t('un prix nul au niveau bas ne sert pas de base au facteur', () => {
  const g = app(null, SOIR);
  const e = g.lfCost({ seen: { 1: [0, 100, 0], 2: [500, 200, 0] } }, 3);
  assert.ok(e && Math.abs(e.cost[1] - 400) <= 1, 'facteur 2 pris sur le cristal : ' + JSON.stringify(e));
});

t('un coût non numérique est ramené à zéro, pas propagé', () => {
  const g = app(null, SOIR);
  const e = g.lfCost({ seen: { 1: [NaN, 100, 0], 2: [NaN, 200, 0] } }, 3);
  assert.ok(e, 'estimé sur le cristal');
  assert.ok(e.cost.every(Number.isFinite), JSON.stringify(e.cost));
  assert.equal(e.cost[0], 0);
});

t('le facteur se tire du cristal quand le métal est nul, sinon rien', () => {
  const g = app(null, SOIR);
  const e = g.lfCost({ seen: { 1: [0, 100, 0], 2: [0, 120, 0] } }, 3);
  assert.ok(Math.abs(e.cost[1] - 144) <= 1, 'cristal : ' + e.cost[1]);
  assert.equal(g.lfCost({ seen: { 1: [0, 0, 0], 2: [0, 0, 0] } }, 3), null);
});

t('une estimation qui sort des bornes n\'est pas proposée', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [1000, 0, 0], 2: [1200, 0, 0] } };
  assert.equal(g.lfCost(v, 1e6), null, 'niveau absurde');
  const e = g.lfCost({ seen: { 1: [1e30, 1, 0], 2: [-5, 2, 0] } }, 3);
  assert.ok(e.cost.every(x => x >= 0 && x <= 1e15), 'bornés : ' + JSON.stringify(e.cost));
});

t('un prix vu au niveau demandé est un prix lu', () => {
  const g = app(null, SOIR);
  const e = g.lfCost({ seen: { 1: [1000, 500, 0], 3: [1440, 720, 0] }, lvl: 0 }, 3);
  assert.equal(e.src, 'lu');
  assert.deepEqual(e.cost, [1440, 720, 0]);
});

/* applyGame : ce que le jeu lit entre dans la mémoire des prix vus. */
const ouvre = (g, id, niveau, cost, secs) => g.applyGame({
  planets: { 33009: { lf: { [id]: { lvl: niveau - 1, state: 'ok', name: 'Secteur', next: niveau, cost, secs: secs == null ? 60 : secs } } } },
  timers: [], moves: [] });
const DEUX_VUS = { 1: [1000, 500, 0], 2: [1200, 600, 0] };
const avecGid = () => { const g = app(null, SOIR); g.S.planets[0].gid = '33009'; return g; };

t('ouvrir une case en mémorise le prix au niveau lu', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0]);
  assert.deepEqual(g.S.planets[0].lf[11101].seen, { 5: [1000, 500, 0] });
});

t('les prix vus survivent à une lecture de la liste, qui ne porte pas de prix', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0]);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 5, state: 'ok' } } } }, timers: [], moves: [] });
  const v = g.S.planets[0].lf[11101];
  assert.deepEqual(v.seen, { 5: [1000, 500, 0] });
  assert.equal(v.lvl, 5, 'et le niveau de la liste est adopté');
  assert.equal(v.secs, 60, 'la durée vue reste disponible pour le plan');
});

t('la mémoire garde les dix niveaux les plus hauts, ni plus ni moins', () => {
  const g = avecGid();
  for (let n = 1; n <= 10; n++) ouvre(g, 11101, n, [100 * n, 50, 0]);
  assert.deepEqual(Object.keys(g.S.planets[0].lf[11101].seen).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'dix tiennent');
  for (let n = 11; n <= 12; n++) ouvre(g, 11101, n, [100 * n, 50, 0]);
  assert.deepEqual(Object.keys(g.S.planets[0].lf[11101].seen).map(Number), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'les plus bas partent');
  ouvre(g, 11101, 1, [100, 50, 0]);
  assert.deepEqual(Object.keys(g.S.planets[0].lf[11101].seen).map(Number), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'un niveau plus bas que les dix ne rentre pas');
});

t('un niveau ou un prix absurde n\'entre pas dans la mémoire', () => {
  const g = avecGid();
  ouvre(g, 11101, 0, [100, 50, 0]);
  ouvre(g, 11101, 5, [0, 0, 0]);
  ouvre(g, 11101, 6, [1e30, -4, 0]);
  const seen = g.S.planets[0].lf[11101].seen;
  assert.deepEqual(Object.keys(seen), ['6'], 'seul le niveau 6 est gardé');
  assert.deepEqual(seen[6], [1e15, 0, 0], 'borné à l\'entrée');
});

t('deux cases ouvertes à des niveaux différents donnent une estimation à la case voisine', () => {
  const g = avecGid();
  ouvre(g, 11101, 1, [1000, 500, 0]);
  ouvre(g, 11101, 2, [1200, 600, 0]);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 2, state: 'ok' } } } }, timers: [], moves: [] });
  const e = g.lfCost(g.S.planets[0].lf[11101], 3);
  assert.equal(e.src, 'estimé');
  assert.ok(Math.abs(e.cost[0] - 1440) <= 1, 'métal : ' + e.cost[0]);
});

/* Le plan : la case qu'on vient d'ouvrir n'est plus la seule éligible. */

t('une lecture de la liste n\'hérite ni du prix ni de l\'état de la lecture précédente', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0], 60);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 4, state: 'short' } } } }, timers: [], moves: [] });
  const v = g.S.planets[0].lf[11101];
  assert.equal(v.cost, undefined);
  assert.equal(v.next, undefined);
  assert.equal(v.state, 'short');
  assert.deepEqual(v.seen, { 5: [1000, 500, 0] });
  assert.equal(v.secs, 60);
});

t('la carte dit combien de cases elle compare et combien elle ne sait pas chiffrer', () => {
  const g = vieSur({
    11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS },
    11102: { lvl: 0, state: 'ok' },
    11103: { lvl: 0, state: 'ok' },
    11104: { lvl: 0, state: 'locked' }
  });
  const a = premierLf(g);
  assert.ok(/1 case chiffrée/.test(a.why), a.why);
  assert.ok(/2 cases pas encore chiffrées/.test(a.why) && /ouvre-les/.test(a.why), 'les deux inconnues, la verrouillée non : ' + a.why);
  const tout = premierLf(vieSur({ 11101: CASE_OK }));
  assert.ok(!/pas encore chiffr/.test(tout.why), 'rien à signaler quand tout est chiffré : ' + tout.why);
});

t('la durée d\'une estimation est dite estimée, et l\'attente porte sa provenance', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } });
  assert.ok(/durée estimés/.test(g.actHtml(premierLf(g), false)), 'durée');
  const h = vieSur({ 11101: { lvl: 2, state: 'short', secs: 60, seen: { 1: [1e6, 0, 0], 2: [2e6, 0, 0] } } });
  const w = h.simulateDay().sessions[0].waits.find(x => /Secteur résidentiel/.test(x.what));
  assert.equal(w.src, 'estimé');
});

t('un prix lu porte l\'heure de sa lecture', () => {
  const g = avecGid();
  ouvre(g, 11101, 3, [1440, 720, 0], 60);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 2, state: 'ok' } } } }, timers: [], moves: [] });
  const a = g.simulateDay().sessions[0].acts.find(x => x.kind === 'lf');
  assert.equal(a.src, 'lu');
  assert.equal(a.at, g.S.planets[0].lf[11101].seenAt[3]);
  assert.ok(a.at > 0);
  assert.ok(/[Pp]rix lu à/.test(g.actHtml(a, false)));
});

/* Le ⓘ vit sur la ligne du type, son texte sous la carte : si les deux cessent
   de porter le même identifiant, le bouton n'ouvre plus rien et rien ne crie. */
t('le ⓘ ouvre bien son propre texte', () => {
  const g = app();
  const a = g.simulateDay().sessions[0].acts.find(x => x.why);
  const h = g.actHtml(a, false);
  const btn = h.match(/aria-controls="(why\d+)"/), txt = h.match(/<div class="why" id="(why\d+)"/);
  assert.ok(btn && txt, 'le ⓘ et son texte sont tous les deux posés');
  assert.equal(btn[1], txt[1], 'le bouton pointe sur son propre texte');
});

t('le prix qu\'on vient d\'ouvrir porte aussi son heure de lecture', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0], 60);
  const c = g.lfCandidates(g.S.planets[0], 'lfbuilding')[0];
  assert.equal(c.src, 'lu');
  assert.equal(c.at, g.S.planets[0].lf[11101].seenAt[5]);
  assert.ok(c.at > 0);
});

t('la mémoire des heures suit celle des prix', () => {
  const g = avecGid();
  for (let n = 1; n <= 12; n++) ouvre(g, 11101, n, [100 * n, 50, 0]);
  const v = g.S.planets[0].lf[11101];
  assert.deepEqual(Object.keys(v.seenAt), Object.keys(v.seen));
});

t('une case estimée entre dans le plan, avec sa provenance', () => {
  const a = premierLf(vieSur({ 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } }));
  assert.ok(a, 'proposée sans que son prix ait été lu à ce niveau');
  assert.equal(a.src, 'estimé');
  assert.equal(a.lvl, 3);
  assert.ok(Math.abs(a.cost[0] - 1440) <= 1, 'au prix estimé : ' + a.cost[0]);
});

t('une carte qui repose sur une estimation le dit à l\'écran', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } });
  const a = premierLf(g);
  assert.ok(/estim/i.test(g.actHtml(a, false)), 'estimation signalée');
  const lue = premierLf(vieSur({ 11101: CASE_OK }));
  assert.equal(lue.src, 'lu');
  assert.ok(!/estim/i.test(g.actHtml(lue, false)), 'un prix lu ne se dit pas estimé');
});

t('une estimation en attente le dit aussi', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'short', secs: 60, seen: { 1: [1e6, 0, 0], 2: [2e6, 0, 0] } } });
  const w = g.simulateDay().sessions[0].waits.find(x => /Secteur résidentiel/.test(x.what));
  assert.ok(w && /estim/i.test(w.what), 'attente estimée : ' + (w && w.what));
});

t('une case estimée sans durée connue n\'est pas proposée', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'ok', seen: DEUX_VUS } });
  assert.ok(!premierLf(g), 'on ne simule pas un chantier de durée nulle');
});

t('la case qu\'on vient d\'ouvrir ne verrouille plus le classement', () => {
  const g = app(s => {
    s.planets[0].lf = {
      11101: { lvl: 4, state: 'ok', next: 5, cost: [5000, 2000, 0], secs: 60, seen: { 5: [5000, 2000, 0] } },
      11102: { lvl: 2, state: 'ok', secs: 90, seen: { 1: [100, 50, 0], 2: [120, 60, 0] } }
    };
  }, SOIR);
  const c = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.deepEqual(c.map(x => x.id), [11102, 11101], 'la moins chère passe devant, ouverte ou non');
  assert.deepEqual(c.map(x => x.src), ['estimé', 'lu']);
});

/* ---------- une priorité de forme de vie prend la tête de sa file ---------- */

/* Une case lue : `next` est le niveau que le prix vise, sinon lfCost ne la
   dit pas chiffrée. */
const lfCase = (lvl, cost, over) => Object.assign({lvl, next: lvl + 1, state: 'ok', secs: 600, cost}, over);

t('une case priorisée passe devant une case plus chère à produire', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: lfCase(1, [50000, 0, 0]),
    11102: lfCase(1, [1000, 0, 0], {eff: 0}) }; });
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102, 'sans priorité, la productrice');
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:2}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l[0].id, 11101, 'avec priorité, la tienne');
  assert.match(l[0].why, /priorité/i, 'et elle dit pourquoi');
  assert.equal(l[1].id, 11102, 'la productrice reste, juste derrière');
  assert.match(l[1].why, /production de métal/, 'et garde sa propre raison');
});

t('une case priorisée qui produit le dit dans sa raison', () => {
  const g = app(s => { s.planets[0].lf = { 11102: lfCase(1, [1000, 0, 0], {eff: 0}) }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11102, lvl:2}];
  const w = g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].why;
  assert.match(w, /priorité/i);
  assert.match(w, /production de métal/, 'ce que la case fait');
});

t('deux priorités dans la même file : la première posée agit', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: lfCase(1, [50000, 0, 0]), 11102: lfCase(1, [90000, 0, 0]), 11103: lfCase(1, [1000, 0, 0]) }; });
  /* La première posée porte l'identifiant du milieu : aucun tri par k, croissant
     ou décroissant, ne retombe sur elle par hasard. */
  g.S.prio = [{kind:'lf', pid:'mere', k:11102, lvl:2}, {kind:'lf', pid:'mere', k:11101, lvl:2}, {kind:'lf', pid:'mere', k:11103, lvl:2}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l[0].id, 11102, 'la première posée, même la plus chère');
  assert.equal(l.filter(c => /priorité/i.test(c.why)).length, 1, 'une seule se dit choisie');
});

t('une case priorisée pas encore chiffrée ne prend pas la tête', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: {lvl:1, state:'ok'},                                  // ni prix ni durée
    11102: lfCase(1, [1000, 0, 0]) }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:2}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l.length, 1, 'une case sans prix n\'est pas un candidat, priorisée ou non');
  assert.equal(l[0].id, 11102);
  assert.ok(!/priorité/i.test(l[0].why), 'et la suivante ne se prétend pas choisie');
});

t('une case priorisée verrouillée ne prend pas la tête', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: lfCase(0, [1000, 0, 0], {state:'locked'}),
    11102: lfCase(1, [1000, 0, 0]) }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:1}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l.length, 1);
  assert.equal(l[0].id, 11102);
});

t('une priorité dans l\'autre file ne dérange pas celle-ci', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: lfCase(1, [1000, 0, 0]),
    11102: lfCase(1, [500, 0, 0]),
    11201: lfCase(1, [1000, 0, 0]) }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11201, lvl:2}];   // file des recherches
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l[0].id, 11102, 'le prix tranche encore');
  assert.ok(!l.some(c => /priorité/i.test(c.why)), 'aucune ne se dit choisie');
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfresearch')[0].id, 11201);
});

t('la priorité d\'une autre planète ne déplace rien ici', () => {
  const g = app(s => {
    s.planets[0].lf = {11101: lfCase(1, [9500, 0, 0]), 11102: lfCase(1, [1000, 0, 0])};
    s.planets[1].lf = {11101: lfCase(1, [50000, 0, 0])}; });
  g.S.prio = [{kind:'lf', pid:g.S.planets[1].id, k:11101, lvl:2}];
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102);
  assert.equal(g.lfCandidates(g.S.planets[1], 'lfbuilding')[0].id, 11101, 'et elle agit chez elle');
});

t('les mines ne ralentissent pas pour une case priorisée en attente', () => {
  /* Sans priorité, la case bon marché part en premier ; avec, la chère attend
     en tête dès la première session et pose sa réserve molle. Cette réserve n'entre pas dans le
     chemin des bâtiments : le plan des bâtiments est le même dans les deux cas.
     Le stock est calé près du prix : la réserve molle ne retient que le stock
     d'aujourd'hui, et un prix hors de portée (eta infinie) n'en pose aucune. */
  const lf = s => { s.day.lf = 'first'; s.planets[1].stock.m = 9400;
    s.planets[1].lf = {11101: lfCase(1, [9500, 0, 0]), 11102: lfCase(1, [1000, 0, 0])}; };
  const bat = g => g.simulateDay().sessions.map(x => x.acts.filter(a => a.kind === 'b').map(a => [a.p, a.k, a.lvl]));
  const sans = app(lf);
  const avec = app(lf);
  avec.S.prio = [{kind:'lf', pid:'colo', k:11101, lvl:2}];
  assert.equal(avec.lfCandidates(avec.S.planets[1], 'lfbuilding')[0].id, 11101);
  /* Session 0 seulement : sur la journée entière la référence attend aussi (la bon
     marché construite, la chère devient candidate), donc rien n'y distinguerait. */
  const att = g => (g.simulateDay().sessions[0].waits || []).some(w => w.kind === 'lf');
  assert.ok(!att(sans), 'sans priorité, la bon marché part : rien n\'attend en première session');
  assert.ok(att(avec), 'avec, la chère attend en tête, avant les bâtiments');
  const ref = bat(sans);
  assert.ok(ref.flat().length > 0, 'le plan de référence pose des bâtiments');
  assert.deepEqual(bat(avec), ref, 'les mêmes bâtiments, aux mêmes sessions');
});

/* Relevé sur le panneau de détail du jeu, case Technique de catalyse. */
const CATALYSE = 'Chaque avancée de la technique de catalyse augmente la production '
  + 'de deutérium sur toutes les planètes.';

t('la phrase d\'effet du jeu dit quelle production la case augmente', () => {
  const g = app(null, SOIR);
  assert.equal(g.lfEffect(CATALYSE), 2, 'deutérium');
  assert.equal(g.lfEffect('… augmente la production de métal sur toutes les planètes.'), 0);
  assert.equal(g.lfEffect('… augmente la production de cristal de cette planète.'), 1);
  // l'énergie n'est pas une ressource qu'on classe, et un texte militaire non plus
  assert.equal(g.lfEffect('… augmente la production d\'énergie.'), null);
  assert.equal(g.lfEffect('… augmente la puissance des armes.'), null);
  assert.equal(g.lfEffect(''), null);
});

t('une case qui produit passe devant une case muette moins chère', () => {
  const g = app(s => {
    s.planets[0].lf = {
      11201: { lvl: 0, state: 'ok', next: 1, cost: [100, 50, 0], secs: 60 },
      11203: { lvl: 0, state: 'ok', next: 1, cost: [29000, 17000, 3000], secs: 413, eff: 2 }
    };
  }, SOIR);
  const c = g.lfCandidates(g.S.planets[0], 'lfresearch');
  assert.deepEqual(c.map(x => x.id), [11203, 11201],
    'celle qui augmente une production d\'abord, malgré son prix');
  assert.ok(/production de deutérium/.test(c[0].why), c[0].why);
  assert.ok(/moins chère/.test(c[1].why), c[1].why);
});

t('entre deux cases qui produisent, le prix départage à nouveau', () => {
  const g = app(s => {
    s.planets[0].lf = {
      11201: { lvl: 0, state: 'ok', next: 1, cost: [9000, 5000, 0], secs: 60, eff: 0 },
      11203: { lvl: 0, state: 'ok', next: 1, cost: [29000, 17000, 3000], secs: 413, eff: 2 }
    };
  }, SOIR);
  assert.deepEqual(g.lfCandidates(g.S.planets[0], 'lfresearch').map(x => x.id), [11201, 11203]);
});

t('l\'effet lu une fois survit à une relecture de la liste', () => {
  const g = app(null, SOIR);
  const detail = { lvl: 0, state: 'ok', next: 1, cost: [29000, 17000, 3000], secs: 413, eff: 2 };
  const liste = { lvl: 0, state: 'ok' };   // la liste ne porte ni prix ni effet
  assert.equal(g.lfMerge(detail, liste).eff, 2, 'la lecture de liste efface l\'effet');
  assert.equal(g.lfMerge(undefined, liste).eff, undefined, 'rien d\'inventé sans lecture');
  assert.equal(g.lfMerge(detail, { ...liste, eff: 9 }).eff, 2, 'un rang hors bornes est refusé');
});

t('à prix égal, une option lue passe devant une option estimée', () => {
  const g = app(s => {
    s.planets[0].lf = {
      11101: { lvl: 2, state: 'ok', secs: 90, seen: { 1: [1000, 500, 0], 2: [1000, 500, 0] } },
      11102: { lvl: 0, state: 'ok', next: 1, cost: [1000, 500, 0], secs: 60 }
    };
  }, SOIR);
  const c = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.deepEqual(c.map(x => x.src), ['lu', 'estimé']);
});

t('une case dont on sait estimer le prix ne fait plus redemander d\'en ouvrir une', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } }; });
  }, SOIR, null, true);
  assert.ok(!g.dailyMissions().some(m => m.id === 'lfb'), 'plus de carte « clique une case »');
});

t('après une montée simulée, la même case reste estimable au niveau suivant', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } });
  const acts = g.simulateDay().sessions.flatMap(s => s.acts).filter(a => a.kind === 'lf');
  assert.ok(acts.length >= 2, 'plusieurs niveaux de suite : ' + acts.length);
  assert.deepEqual(acts.slice(0, 2).map(a => a.lvl), [3, 4]);
  assert.ok(acts[1].cost[0] > acts[0].cost[0], 'le prix suit la courbe');
});

t('la durée vue sert quand la liste n\'en porte pas, jamais contre une durée lue', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0], 60);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 5, state: 'ok', secs: 30 } } } }, timers: [], moves: [] });
  assert.equal(g.S.planets[0].lf[11101].secs, 30, 'la durée lue du jour prime');
  ouvre(g, 11101, 6, [1100, 500, 0], 0);
  assert.ok(!(g.S.planets[0].lf[11101].secs > 0), 'une lecture sans durée ne reprend pas l\'ancienne');
});

t('un niveau au-delà des bornes n\'est pas mémorisé', () => {
  const g = avecGid();
  ouvre(g, 11101, 5000, [100, 50, 0]);
  assert.deepEqual(g.S.planets[0].lf[11101].seen, {});
});

t('une estimation finie mais au-dessus du plafond n\'est pas proposée', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [1e14, 0, 0], 2: [2e14, 0, 0] } };
  assert.deepEqual(g.lfCost(v, 3).cost, [4e14, 0, 0]);
  assert.equal(g.lfCost(v, 6), null, '1,6e15 dépasse 1e15');
});

/** Un relevé de panneau réduit à ses libellés de bâtiments. */
const lus = (labels, at) => ({ at: at == null ? SOIR : at, factor: 1, rows: labels.map(label => ({ label })) });

t('l\'esp\u00e8ce se d\u00e9duit des b\u00e2timents lus sur la plan\u00e8te', () => {
  const g = app(null, SOIR);
  assert.equal(g.speciesOf(lus(['Centre technologique runique (Niveau 1)'])), 'rocktal');
  assert.equal(g.speciesOf(lus(['Centre de recherche (Niveau 2)'])), 'humans');
  assert.equal(g.speciesOf(lus(['Centre de recherche en robotique (Niveau 0)'])), 'mechas');
});

t('un b\u00e2timent de forme de vie au niveau 0 nomme encore l\'esp\u00e8ce', () => {
  const g = app(null, SOIR);
  assert.equal(g.speciesOf(lus(['Mine de m\u00e9tal (Niveau 21)', 'Centre de recherche en robotique (Niveau 0)'])), 'mechas');
});

t('sans b\u00e2timent de forme de vie, l\'esp\u00e8ce reste inconnue', () => {
  const g = app(null, SOIR);
  assert.equal(g.speciesOf(lus(['Mine de m\u00e9tal (Niveau 21)'])), null);
  assert.equal(g.speciesOf(lus([])), null);
  assert.equal(g.speciesOf(undefined), null);
  assert.equal(g.speciesOf({}), null);
});

t('l\'esp\u00e8ce d\'une plan\u00e8te vient de son propre relev\u00e9, et d\'un relev\u00e9 de moins de sept jours', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.prod = { 33001: lus(['Centre de recherche (Niveau 2)']), 33002: lus(['Centre technologique runique (Niveau 1)'], SOIR - 8 * 86400e3) };
  }, SOIR);
  assert.equal(g.speciesOfPlanet(g.S.planets[0]), 'humans');
  assert.equal(g.speciesOfPlanet(g.S.planets[1]), null, 'relev\u00e9 p\u00e9rim\u00e9');
});

t('une plan\u00e8te jamais lue n\'a pas d\'esp\u00e8ce', () => {
  const g = app(s => { s.planets[0].gid = '33001'; delete s.prod; }, SOIR);
  assert.equal(g.speciesOfPlanet(g.S.planets[0]), null);
});

t('les esp\u00e8ces lues sont compt\u00e9es une fois, m\u00eame sur deux plan\u00e8tes', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.lf.found = [];
    s.prod = { 33001: lus(['Centre technologique runique (Niveau 1)']), 33002: lus(['Centre technologique runique (Niveau 1)']) };
  }, SOIR);
  assert.deepEqual(g.foundLifeforms(), ['rocktal']);
});

t('sans rien de lu, la case \u00e0 cocher reste le rep\u00e8re', () => {
  const g = app(s => { s.lf.found = ['humans', 'kaelesh']; delete s.prod; }, SOIR);
  assert.deepEqual(g.foundLifeforms(), ['humans', 'kaelesh']);
});

t('la meilleure forme de vie se choisit parmi les lues et les coch\u00e9es', () => {
  const lu = app(s => {
    s.planets[0].gid = '33001'; s.lf.found = ['rocktal']; s.day.focus = 'fleet';
    s.prod = { 33001: lus(['Centre de recherche en robotique (Niveau 0)']) };
  }, SOIR);
  assert.equal(lu.bestLifeform(), 'mechas', 'une esp\u00e8ce lue est candidate');
  const garde = app(s => {
    s.planets[0].gid = '33001'; s.lf.found = ['rocktal'];
    s.prod = { 33001: lus(['Centre de recherche (Niveau 2)']) };
  }, SOIR);
  assert.equal(garde.bestLifeform(), 'rocktal', 'une lecture n\'efface pas la case');
});

t('une esp\u00e8ce lue s\'ajoute \u00e0 celles coch\u00e9es, elle n\'en retire aucune', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.lf.found = ['humans', 'kaelesh'];
    s.prod = { 33001: lus(['Centre technologique runique (Niveau 1)']) };
  }, SOIR);
  assert.deepEqual(g.foundLifeforms().slice().sort(), ['humans', 'kaelesh', 'rocktal']);
});

t('sans coche d\u00e9finie ni lecture, les Humains restent le rep\u00e8re', () => {
  const g = app(s => { s.lf.found = null; delete s.prod; }, SOIR);
  assert.deepEqual(g.foundLifeforms(), ['humans']);
});

t('un libell\u00e9 espac\u00e9 ou en minuscules nomme encore l\'esp\u00e8ce', () => {
  const g = app(null, SOIR);
  assert.equal(g.speciesOf(lus(['  CENTRE DE RECHERCHE (niveau 2) '])), 'humans');
  assert.equal(g.speciesOf(lus(['  centre de recherche en robotique (NIVEAU 0)  '])), 'mechas');
});

t('le plan du jour voit le bonus de forme de vie lu', () => {
  const jour = prod => app(s => {
    s.planets.forEach(p => { p.stock.m = 0; p.stock.c = 0; p.stock.d = 0; });
    s.planets[1].gid = '33001'; /* la colonie : c'est elle que le plan fait construire */
    if (prod) s.prod = { 33001: { lfBonus: prod, at: SOIR, factor: 1 } };
  }, SOIR).simulateDay();
  const sans = JSON.stringify(jour(null)), avec = JSON.stringify(jour([500000, 0, 0, 0]));
  assert.notStrictEqual(avec, sans, 'le plan ignore le bonus lu');
});

t('un prix relu au même niveau garde l\'heure de sa première lecture', () => {
  const tile = { lvl: 2, state: 'ok', next: 3, cost: [1440, 720, 0] };
  const a = app(null, SOIR), b = app(null, SOIR + 3 * 86400e3);
  const premiere = a.lfMerge(undefined, tile);
  const relue = b.lfMerge(premiere, tile);
  assert.equal(relue.seenAt[3], SOIR, 'l\'heure a bougé : ' + relue.seenAt[3]);
  const autre = b.lfMerge(premiere, { ...tile, cost: [2000, 720, 0] });
  assert.equal(autre.seenAt[3], SOIR + 3 * 86400e3, 'un prix différent se date à nouveau');
});

t('la limite de sept jours : 6,9 jours compte, 7 jours pile ne compte plus', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.prod = { 33001: lus(['Centre de recherche (Niveau 2)'], SOIR - 6.9 * 86400e3), 33002: lus(['Centre de recherche (Niveau 2)'], SOIR - 7 * 86400e3) };
  }, SOIR);
  assert.equal(g.speciesOfPlanet(g.S.planets[0]), 'humans');
  assert.equal(g.speciesOfPlanet(g.S.planets[1]), null);
});

t('la carte de d\u00e9couverte nomme les esp\u00e8ces lues et coch\u00e9es, et ne r\u00e9clame que le reste', () => {
  const g = app(s => {
    s.slots = { expo: [0, 2], fleet: [2, 7], at: SOIR }; s.syncAt = SOIR;
    s.planets[0].gid = '33001'; s.lf.found = ['kaelesh'];
    s.prod = { 33001: lus(['Centre technologique runique (Niveau 1)']) };
  }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(/Roctas/.test(c.why), 'lue : ' + c.why);
  assert.ok(/Kaeleshs/.test(c.why), 'coch\u00e9e : ' + c.why);
  assert.ok(/pas encore lue/i.test(c.how.join(' ')), 'la consigne ne vaut que pour ce qui n\'est pas lu');
});

t('les quatre races trouv\u00e9es, la d\u00e9couverte ne parle plus que d\'art\u00e9facts', () => {
  const g = app(s => {
    s.slots = { expo: [0, 2], fleet: [2, 7], at: SOIR }; s.syncAt = SOIR;
    s.lf.found = ['humans', 'rocktal', 'mechas', 'kaelesh'];
  }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(/quatre races/.test(c.why), 'elle le dit : ' + c.why);
  assert.ok(!/nouvelles races/.test(c.why), 'elle n\'en promet plus : ' + c.why);
  assert.ok(!/Coche-la/.test(c.how.join(' ')), 'plus rien \u00e0 cocher');
});

t('les r\u00e9glages montrent les esp\u00e8ces lues sans case \u00e0 cocher', () => {
  const g = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: lus(['Centre technologique runique (Niveau 1)']) };
  }, SOIR);
  const h = g.lfSettingsHtml();
  assert.ok(!/data-lf="rocktal"/.test(h), 'pas de case pour une esp\u00e8ce lue');
  assert.ok(/data-lf="humans"/.test(h), 'une case pour les autres');
  assert.ok(/lue sur tes plan\u00e8tes/i.test(h));
});

/* ---------- le lien d'une carte mène au bon système ---------- */

/* Trois inactifs voisins de la planète mère (1:142:8). Au-delà de trente
   systèmes, raidTargets les écarte, d'où le 140. */
const API_INACTIFS = {
  planets: [['1:140:8', 'p1'], ['1:140:7', 'p2'], ['1:140:5', 'p3']],
  players: { p1: ['Alpha', 'i'], p2: ['Beta', 'i'], p3: ['Gamma', 'i'] },
  scores: { p1: [1000], p2: [900], p3: [800] }
};
const carteRaid = g => g.dailyMissions().find(m => m.id === 'raid');

t('le lien de la carte de pillage ouvre la galaxie au bon système', () => {
  const g = app(s => { s.host = 's1-fr.ogame.gameforge.com'; }, SOIR, API_INACTIFS);
  const c = carteRaid(g);
  assert.ok(c, 'la carte de pillage sort');
  const url = g.missionGo(c);
  assert.ok(/[?&]galaxy=1(&|$)/.test(url), 'la galaxie est dans le lien : ' + url);
  assert.ok(/[?&]system=140(&|$)/.test(url), 'le système aussi : ' + url);
});

t('une carte de galaxie sans coordonnées garde son lien de page', () => {
  const g = app(s => { s.host = 's1-fr.ogame.gameforge.com'; }, SOIR);
  const url = g.missionGo({ id: 'inactive', tags: [] });
  assert.ok(/component=galaxy/.test(url), 'la page galaxie : ' + url);
  assert.ok(!/galaxy=\d/.test(url), 'sans coordonnées inventées : ' + url);
});

t('le pillage prêt mène au système de la cible', () => {
  const g = app(s => {
    s.host = 's1-fr.ogame.gameforge.com';
    s.raid = { coords: '1:140:8', safe: true, m: 50000, c: 0, d: 0, at: SOIR };
  }, SOIR, API_INACTIFS);
  const c = g.dailyMissions().find(m => m.id === 'raid-go');
  assert.ok(c, 'la carte sort');
  assert.ok(/[?&]system=140(&|$)/.test(g.missionGo(c)), 'le lien vise le bon système');
});

t('un emplacement de colonie pris mène au système concerné', () => {
  const g = app(s => {
    s.host = 's1-fr.ogame.gameforge.com';
    s.colo.target = '1:140:7';
  }, SOIR, API_INACTIFS);
  const c = g.dailyMissions().find(m => m.id === 'colo-taken');
  assert.ok(c, 'la carte sort');
  assert.ok(/[?&]system=140(&|$)/.test(g.missionGo(c)), 'le lien vise le bon système');
});

/* ---------- ce qui lève la limite ---------- */

t('quand les emplacements de flotte brident le pillage, la carte dit quoi monter', () => {
  const g = app(s => {
    s.host = 's1-fr.ogame.gameforge.com';
    s.slots = { fleet: [8, 9], expo: [0, 2], at: SOIR };
    s.syncAt = SOIR;
    s.tech.computer = 2;
  }, SOIR, API_INACTIFS);
  const c = carteRaid(g);
  assert.ok(c, 'la carte sort');
  const txt = c.why + ' ' + (c.how || []).join(' ');
  assert.ok(/Ordinateur 3/.test(txt), 'elle nomme le niveau qui débloque : ' + txt);
});

t('la découverte dit ce qui ajoute un emplacement quand il n\'en reste qu\'un', () => {
  const g = app(s => {
    s.slots = { fleet: [6, 7], expo: [0, 2], at: SOIR }; s.syncAt = SOIR; s.tech.computer = 2;
  }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(c, 'la carte sort');
  assert.ok(/Ordinateur 3/.test(c.how.join(' ')), 'le levier est nommé : ' + c.how.join(' '));
});

t('avec de la place, la découverte ne parle pas d\'Ordinateur', () => {
  const g = app(s => { s.slots = { fleet: [1, 7], expo: [0, 2], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(c && !/Ordinateur/.test(c.how.join(' ')), 'rien à lever');
});

t('sans bridage, la carte ne parle pas d\'Ordinateur', () => {
  const g = app(s => { s.host = 's1-fr.ogame.gameforge.com'; }, SOIR, API_INACTIFS);
  const c = carteRaid(g);
  const txt = c.why + ' ' + (c.how || []).join(' ');
  assert.ok(!/Ordinateur/.test(txt), 'rien à lever : ' + txt);
});

/* ---------- satellites contre centrale ---------- */

const sats = g => g.simulateDay().sessions.flatMap(x => x.acts).filter(a => a.kind === 'sats');
/* La planète mère de la fixture tourne déjà à 82 % faute d'énergie. */

t('sans défense vue sur la planète, aucun satellite proposé', () => {
  const g = app();
  assert.equal(sats(g).length, 0, 'ils partiraient en débris au premier raid');
  const a = g.planetAlerts(g.S.planets[0]).find(x => /Satellites écartés/.test(x.what));
  assert.ok(a, 'et la raison est dite');
});

t('avec une défense sur la planète, les satellites reviennent', () => {
  const g = app(s => { s.planets[0].def = 12; });
  assert.ok(sats(g).length > 0, 'la planète est défendue, le prix décide');
  assert.ok(!g.planetAlerts(g.S.planets[0]).some(x => /Satellites écartés/.test(x.what)), 'rien à expliquer');
});

/* ---------- mines bridées à la main ---------- */

/* Le panneau d'une colonie dont le métal tourne à 80 % et le deutérium à 30 %.
   Pleines, ces deux mines coûteraient 1.791 et 2.002 d'énergie : le bridage en
   économise 1.761. */
const PANNEAU_BRIDE = [
  'Facteur de production: 100%',
  'Mine de métal (Niveau 22)\t34.384\t0\t0\t-1.432\t80%',
  'Mine de cristal (Niveau 19)\t0\t18.592\t0\t-1.162\t100%',
  'Synthétiseur de deutérium (Niveau 18)\t0\t0\t2.776\t-600\t30%',
  'Total par heure:\t1\t1\t1\t39/4.000'
].join('\n');

/** La colonie, son relevé bridé en place, avec le solde d'énergie voulu. */
function bride(solde) {
  const g = app();
  const p = g.S.planets[1];
  p.gid = 'colo1';
  p.eAdj = solde - g.production(p).eBal;
  g.S.prod = { colo1: Object.assign(g.parseProdPanel(PANNEAU_BRIDE), { at: SOIR }) };
  return { g, p };
}

t('le bridage des mines est lu, avec ce qu\'il économise', () => {
  const { g, p } = bride(0);
  assert.deepEqual(g.bridage(p), { min: 30, extra: 1761 });
});

t('l\'énergie revenue, le rappel de remonter les mines', () => {
  const { g, p } = bride(1800);
  const a = g.planetAlerts(p).find(x => /Remonter les mines/.test(x.what));
  assert.ok(a, 'rien ne rappelle de les remonter : ' + JSON.stringify(g.planetAlerts(p)));
  assert.match(a.why, /bridées à 30 %/);
  assert.match(a.why, /39 de libre/, 'la marge restante est dite');
});

t('l\'énergie encore courte, le bridage est rappelé sans dire de remonter', () => {
  const { g, p } = bride(1000);
  const alerts = g.planetAlerts(p);
  assert.ok(!alerts.some(x => /Remonter les mines/.test(x.what)), 'l\'énergie ne suffit pas');
  const a = alerts.find(x => /Mines bridées/.test(x.what));
  assert.ok(a && /manque 761/.test(a.why), 'ce qui manque est chiffré : ' + JSON.stringify(a));
});

t('mines à 100 %, rien à dire', () => {
  const g = app();
  const p = g.S.planets[1];
  p.gid = 'colo1';
  g.S.prod = { colo1: Object.assign(g.parseProdPanel(PANNEAU_CARIBOU), { at: SOIR }) };
  assert.equal(g.bridage(p), null);
  assert.ok(!g.planetAlerts(p).some(x => /mines/i.test(x.what)));
});

/* ---------- la vocation d'une planète ---------- */
/* Le sol ne se choisit pas : il se lit. Et il ne se lit qu'en comparant les
   planètes entre elles — « la planète à cristal » est une place dans l'empire,
   pas une valeur absolue. */

t('la planète en 8 porte le métal, la colonie en 6 ne porte rien', () => {
  const g = app();
  const v = g.vocations();
  assert.deepEqual(v.mere.keys, ['metal', 'deut'], 'mère première sur métal et deutérium');
  assert.ok(!v.colo, 'la colonie n\'est première sur rien');
});

t('sans planète en position 1 à 3, personne ne porte le cristal', () => {
  const g = app();
  const v = g.vocations();
  assert.ok(!Object.values(v).some(x => x.keys.includes('crystal')));
});

t('une planète en position 1 porte le cristal', () => {
  const g = app(s => { s.planets[1].coords = '1:142:1'; s.planets[1].tmax = 240; });
  assert.deepEqual(g.vocations().colo.keys, ['crystal']);
});

t('une planète seule n\'a pas de vocation', () => {
  const g = app(s => { s.planets = [s.planets[0]]; });
  assert.deepEqual(g.vocations(), {});
});

t('deux planètes au même terrain n\'ont aucune vocation', () => {
  const g = app(s => { s.planets[1].coords = '1:143:8'; s.planets[1].tmax = 40; });
  assert.deepEqual(g.vocations(), {});
});

t('des coordonnées illisibles donnent une vocation inconnue, sans fausser les autres', () => {
  const g = app(s => {
    s.planets.push(Object.assign({}, s.planets[1], { id: 'perdue', coords: 'ailleurs' }));
  });
  const v = g.vocations();
  assert.deepEqual(v.perdue, { keys: [], why: 'vocation inconnue' });
  assert.deepEqual(v.mere.keys, ['metal', 'deut'], 'la mère garde sa vocation');
  assert.equal(g.terrainRates(g.S.planets[2]), null);
});

t('la vocation porte sa raison', () => {
  const g = app();
  assert.ok(/position 8/.test(g.vocations().mere.why), g.vocations().mere.why);
});

/* ---------- le centre ---------- */
/* Le wiki appelle ça une Vault Planet : la planète où vivent le labo et le
   chantier. Il dit aussi que ce n'est pas la planète mère, et c'est pourtant
   elle que le copilote prenait, parce qu'il prenait la première de la liste. */

t('le centre est la planète qui porte déjà le labo', () => {
  assert.equal(app().centrePlanet().id, 'mere');
});

t('sur un empire neuf, le centre est la planète qui a le plus de cases, pas la première', () => {
  const g = app(s => {
    s.planets[0].coords = '1:142:15'; s.planets[0].tmax = -110;
    s.planets[0].b.lab = 0; s.planets[0].b.shipyard = 0;
    s.planets[1].coords = '1:142:8'; s.planets[1].tmax = 40;
  });
  assert.equal(g.centrePlanet().id, 'colo', 'la position 8 a 204 cases, la 15 en a 127');
});

t('en stratégie flotte, il n\'y a pas de centre', () => {
  const g = app(s => { s.day.focus = 'fleet'; });
  assert.equal(g.centreIndex(), -1);
  assert.equal(g.centrePlanet(), null);
});

t('une planète seule n\'est pas un centre', () => {
  const g = app(s => { s.planets = [s.planets[0]]; });
  assert.equal(g.centreIndex(), -1);
});

t('le joueur reprend la main', () => {
  const g = app(s => { s.centre = 'colo'; });
  assert.equal(g.centrePlanet().id, 'colo');
  assert.equal(g.centreWhy(), '');
});

t('un centre qui ne répond plus retombe sur le choix automatique', () => {
  const g = app(s => { s.centre = 'disparue'; });
  assert.equal(g.centrePlanet().id, 'mere');
});

t('l\'ancien réglage de rôle est oublié au chargement', () => {
  const g = app(s => { s.roles = { mere: 'crystal' }; });
  assert.equal(g.S.roles, undefined);
});

/* ---------- la recherche part du centre ---------- */

t('la recherche part du centre, pas du plus haut labo', () => {
  const g = app(s => { s.centre = 'colo'; s.planets[1].b.lab = 2; });
  assert.equal(g.labPlanet().id, 'colo', 'la mère a le labo 5, le centre est la colonie');
});

t('la carte du labo dit pourquoi c\'est là', () => {
  const g = app(s => { s.centre = 'colo'; });
  const a = g.simulateDay().sessions.flatMap(x => x.acts).find(x => x.kind === 'b' && x.k === 'lab');
  assert.ok(a, 'un labo est proposé');
  assert.ok(/centre/i.test(a.why), 'la raison nomme le centre : ' + a.why);
});

t('le niveau de labo est celui du centre, pas le maximum de l\'empire', () => {
  const g = app(s => { s.centre = 'colo'; });
  assert.equal(g.labLevel(), 0, 'la colonie n\'a pas de labo, la mère en a 5');
});

t('sans centre, le labo reste le plus haut de l\'empire', () => {
  const g = app(s => { s.day.focus = 'fleet'; });
  assert.equal(g.labLevel(), 5);
});

/* ---------- les liens et le raid ---------- */

t('le raid part de la planète qui a les transporteurs, pas du centre', () => {
  const g = app(s => {
    s.centre = 'colo';
    s.raid = { coords: '1:142:9', m: 500000, c: 200000, d: 0, at: SOIR, safe: true };
  });
  assert.equal(g.raidPlan().home.id, 'mere', 'les transporteurs sont sur la mère');
});

t('la galaxie s\'ouvre depuis le centre', () => {
  const g = app(s => {
    s.centre = 'colo'; s.host = 's199-fr.ogame.gameforge.com';
    s.planets[0].gid = '111'; s.planets[1].gid = '222';
  });
  assert.ok(/cp=222/.test(g.galaxyUrl('1:142:9')), 'la galaxie s\'ouvre sur la colonie : ' + g.galaxyUrl('1:142:9'));
});

t('la planète du fret est celle qui porte la plus grosse soute', () => {
  const g = app(s => { s.planets[1].ships = { lc: 40 }; });
  assert.equal(g.cargoHomeIndex(), 1, '40 grands transporteurs battent 6 petits et 2 grands');
});

/* ---------- le chantier de l'empire ---------- */

t('le vaisseau de colonisation sort du centre', () => {
  const g = app(s => {
    s.centre = 'colo';
    s.planets[1].b.robot = 2; s.planets[1].b.shipyard = 4;
    s.planets[1].stock = { m: 80000, c: 80000, d: 20000, at: SOIR };
  });
  const a = g.simulateDay().sessions.flatMap(x => x.acts)
    .find(x => x.kind === 'ship' && /colonisation/i.test(x.what));
  assert.ok(a, 'un vaisseau de colonisation est proposé');
  assert.equal(a.p, 1, 'le chantier du centre sort le vaisseau');
});

t('une colonie monte son chantier pour ses propres transporteurs, centre ou pas', () => {
  const g = app(s => {
    s.centre = 'mere';
    // Sans transporteur nulle part, rien ne rapatrie : le hangar de la colonie
    // reste plein, et c'est ce qui lui fait mériter son propre chantier.
    s.planets[0].ships = {};
    Object.assign(s.planets[1].b, { robot: 2, smetal: 8, scrystal: 8, sdeut: 8 });
  });
  // Un stock aux trois quarts de la soute : au-dessus du seuil qui mérite un
  // transporteur, en dessous de celui qui réclamerait un hangar de plus.
  const cap = g.storageCap(8);
  g.S.planets[1].stock = { m: cap * 0.75, c: cap * 0.75, d: cap * 0.75, at: SOIR };
  const b = g.simulateDay().sessions.flatMap(x => x.acts).filter(x => x.kind === 'b' && x.p === 1);
  assert.ok(b.some(x => x.k === 'shipyard'), 'la règle locale survit au centre : ' + b.map(x => x.k).join(','));
});

/* ---------- la carte de planète ---------- */

t('la carte d\'une planète porte sa vocation et sa raison', () => {
  const h = app().VIEWS.planets();
  assert.ok(/[Mm]étal/.test(h) && /position 8/.test(h), 'la vocation et sa raison sont écrites');
});

t('la carte du centre dit le risque', () => {
  assert.ok(/espionnage/i.test(app().VIEWS.planets()), 'le risque du centre est dit');
});

t('un centre sans labo dit ce que le choix coûte', () => {
  const g = app(s => { s.centre = 'colo'; });
  assert.ok(/ne suit pas/.test(g.VIEWS.planets()), 'la carte annonce le labo laissé derrière');
});

t('le menu de rôle a disparu', () => {
  assert.ok(!/data-role=/.test(app().VIEWS.planets()), 'plus de menu Rôle');
});

/* ---------- ce que la relecture de branche a trouvé ---------- */

t('un chantier plus haut ailleurs ne déplace pas la recherche hors du labo', () => {
  // Le pire conseil possible : repayer un labo déjà posé. Le chantier ne doit
  // donc pas décider du centre tant qu'un labo existe quelque part.
  const g = app(s => {
    s.planets[0].b.lab = 10; s.planets[0].b.shipyard = 4;
    s.planets[1].b.shipyard = 12;
  });
  assert.equal(g.centrePlanet().id, 'mere', 'le labo 10 garde le centre');
  assert.equal(g.labLevel(), 10);
});

t('un chantier posé sur une colonie ne fait pas bouger le centre tout seul', () => {
  const neuf = s => { s.planets.forEach(p => { p.b.lab = 0; p.b.shipyard = 0; }); };
  const avant = app(neuf);
  const apres = app(s => { neuf(s); s.planets[1].b.shipyard = 1; });
  assert.equal(avant.centrePlanet().id, apres.centrePlanet().id,
    'le centre ne doit pas suivre le premier chantier de transporteur d\'une colonie');
});

t('la colonie part de la même planète que celle qui construit le vaisseau', () => {
  // `from` est un rang d'avant la migration : le laisser écraserait `fromId`.
  const g = app(s => { s.centre = 'mere'; delete s.colo.from; s.colo.fromId = 'colo'; });
  assert.equal(g.coloFrom().id, 'mere', 'sinon la durée de vol annoncée est celle d\'une autre planète');
});

t('le lien du raid ouvre la planète qui a les transporteurs', () => {
  const g = app(s => {
    s.ui.tool = 'explore'; s.host = 's199-fr.ogame.gameforge.com';
    s.planets[0].gid = '111'; s.planets[1].gid = '222';
    s.planets[0].ships = {}; s.planets[1].ships = { lc: 12 };
    s.raid = { coords: '1:142:9', m: 500000, c: 200000, d: 0, at: SOIR, safe: true };
  }, SOIR, API_INACTIFS);
  g.REFRESH.tools();
  const h = g.html().rdPlan || '';
  assert.ok(/cp=222/.test(h), 'le lien part de la colonie, qui a la soute : ' + h.slice(-400));
});

t('en stratégie flotte, la carte dit pourquoi il n\'y a pas de centre', () => {
  const h = app(s => { s.day.focus = 'fleet'; }).VIEWS.planets();
  assert.ok(!/data-centre=/.test(h), 'pas de case à cocher inerte');
  assert.ok(/dispers/i.test(h), 'la raison est dite : ' + h.slice(0, 300));
});

t('la carte du chantier du centre dit pourquoi là', () => {
  // De grands hangars loin d'être pleins : sinon la règle du hangar plein
  // gagne tous les créneaux de la colonie et le prérequis n'est jamais choisi.
  const g = app(s => {
    s.centre = 'colo';
    Object.assign(s.planets[1].b, { robot: 0, smetal: 8, scrystal: 8, sdeut: 8 });
  });
  const a = g.simulateDay().sessions.flatMap(x => x.acts)
    .find(x => x.kind === 'b' && (x.k === 'shipyard' || x.k === 'robot') && x.p === 1);
  assert.ok(a, 'un prérequis de chantier est proposé sur le centre');
  assert.ok(/centre/i.test(a.why), 'la raison nomme le centre : ' + a.why);
});

/* ---------- les détails relevés à la relecture ---------- */

t('la raison du deutérium ne promet pas un compte de planètes qu\'elle ne peut pas tenir', () => {
  const g = app(s => {
    s.planets.push(Object.assign({}, s.planets[1], { id: 'perdue', coords: 'ailleurs' }));
  });
  const why = g.vocations().mere.why;
  assert.ok(!/de tes \d+ plan/.test(why), 'pas de compte, il serait faux : ' + why);
});

t('deux planètes aussi froides se disent à égalité', () => {
  const g = app(s => {
    s.planets[1].tmax = 40;
    s.planets.push(Object.assign({}, s.planets[1], { id: 'chaude', coords: '1:142:3', tmax: 140 }));
  });
  const v = g.vocations();
  assert.ok(v.mere.keys.includes('deut') && v.colo.keys.includes('deut'), 'les deux portent le deutérium');
  assert.ok(/égalité/.test(v.mere.why), 'le superlatif se partage : ' + v.mere.why);
});

/* ---------- ce qui manque à l'empire pèse sur le classement des mines ---------- */

/** Une planète à cristal (position 1) encadrée par une mineuse à métal :
    l'empire déborde de métal, et le sol de la mère est bon pour le cristal. */
const GORGE_METAL = s => {
  s.planets[0].coords = '1:142:1';
  Object.assign(s.planets[0].b, { metal: 22, crystal: 19, deut: 19, solar: 40 });
  s.planets.push({
    id: 'mine', name: 'Mineuse', coords: '1:142:8', tmax: 40,
    b: Object.assign({}, s.planets[0].b, { metal: 30, crystal: 5, deut: 5, solar: 48 }),
    sats: 0, ships: {}, shipsAt: 0, stock: { m: 0, c: 0, d: 0, at: 0 }
  });
};

t('la ressource produite au-delà de sa part vaut moins, celle qui manque vaut plus', () => {
  const g = app(GORGE_METAL);
  const w = g.besoinEmpire();
  assert.ok(w[0] < 1, 'le métal déborde, il vaut moins que son cours : ' + w[0]);
  assert.ok(w[1] > 1 && w[2] > 1, 'cristal et deutérium manquent : ' + w.slice(1));
});

t('verser du métal dans l\'empire fait baisser le facteur du métal', () => {
  const avant = app(s => {}).besoinEmpire();
  const apres = app(GORGE_METAL).besoinEmpire();
  assert.ok(apres[0] < avant[0], `${apres[0]} doit tomber sous ${avant[0]}`);
});

t('un mélange sur sa cible ne corrige rien', () => {
  /* Le ratio lu comme des quantités : 3 de métal pour 2 de cristal pour 1 de
     deutérium. production() est trop contrainte pour viser ça pile ; on vérifie
     la formule sur un empire qui produit exactement sa cible. */
  const g = app(s => { s.settings.ratio = [1, 1, 1]; });
  const w = g.besoinEmpire.call(null);
  assert.equal(w.length, 3);
  assert.ok(w.every(x => x >= .5 && x <= 2), 'les bornes tiennent : ' + w);
});

t('les facteurs restent bornés quand une ressource manque tout à fait', () => {
  const g = app(s => { s.planets.forEach(p => { p.b.deut = 0; }); });
  const w = g.besoinEmpire();
  assert.ok(w[2] <= 2, 'un deutérium nul ne fait pas valoir la ressource cent fois : ' + w[2]);
  assert.ok(w.every(x => x >= .5), 'et rien ne tombe sous la moitié : ' + w);
});

t('l\'empire gorgé de métal fait passer la mine de cristal devant', () => {
  const g = app(GORGE_METAL);
  const p = g.S.planets[0];
  const r = g.rankUpgrades(p);
  /* Au cours du ratio seul, le métal gagnait : il coûte moins cher et son coût
     grossit moins vite. C'est la carte que le joueur voyait revenir. */
  const auCours = r.slice().sort((a, b) => a.payback - b.payback);
  assert.equal(auCours[0].key, 'metal', 'au cours, le métal gagne encore');
  assert.equal(r[0].key, 'crystal', 'au besoin de l\'empire, le cristal passe devant');
});

t('la pondération ne touche pas l\'amortissement affiché', () => {
  const nu = app(s => { s.planets[0].coords = '1:142:1'; Object.assign(s.planets[0].b, { metal: 22, crystal: 19, deut: 19, solar: 40 }); });
  const gorge = app(GORGE_METAL);
  const a = nu.rankUpgrades(nu.S.planets[0]).find(u => u.key === 'crystal');
  const b = gorge.rankUpgrades(gorge.S.planets[0]).find(u => u.key === 'crystal');
  /* Le chiffre de la carte se refait de tête : il ne doit pas bouger parce
     qu'une AUTRE planète a monté une mine. Seul l'ordre bouge. */
  assert.ok(Math.abs(a.payback - b.payback) < 1e-9, `${a.payback} ≠ ${b.payback}`);
  assert.ok(b.score < b.payback, 'le score, lui, tient compte du manque de cristal');
});

t('la carte dit ce qui manque à l\'empire et ce que le sol donne', () => {
  const g = app(GORGE_METAL);
  const why = g.mineWhy(g.S.planets[0], 'crystal');
  assert.ok(/manque de cristal/.test(why), 'le besoin se dit : ' + why);
  assert.ok(/planète à cristal/.test(why), 'la vocation se dit : ' + why);
  assert.ok(/\+40 % de cristal/.test(why), 'avec son bonus de position : ' + why);
  assert.ok(!/froide/.test(why), 'et pas la raison d\'une autre vocation : ' + why);
});

t('la carte dit aussi le cas gênant : tu en produis déjà trop', () => {
  const g = app(GORGE_METAL);
  assert.ok(/plus que ta part de métal/.test(g.mineWhy(g.S.planets[0], 'metal')),
    g.mineWhy(g.S.planets[0], 'metal'));
});

t('le classement des mines nourrit la raison de la carte', () => {
  const g = app(GORGE_METAL);
  // pickBuildings lit une planète SIMULÉE : elle porte son stock sous `st`.
  const p = Object.assign({}, g.S.planets[0], { st: [0, 0, 0] });
  const c = g.pickBuildings(p, { T: SOIR, iv: 90, goals: [] }).find(x => x.k === 'crystal');
  assert.ok(c && /manque de cristal/.test(c.why), 'la carte porte la raison : ' + (c && c.why));
});

t('l\'onglet Empire montre le mélange produit et sa cible', () => {
  const g = app(GORGE_METAL);
  g.VIEWS.planets(); g.REFRESH.planets();
  const h = lu(g.html().empireMix || '');
  assert.ok(/Mélange produit/.test(h), 'le mélange se lit : ' + h);
  assert.ok(/cible de/.test(h), 'et la cible avec : ' + h);
  assert.ok(/métal ×0\./.test(h), 'et le facteur appliqué au métal : ' + h);
});

t('le délai de retour d\'une colonie reste mesuré au cours du ratio', () => {
  /* Il compare des POSITIONS : pondérer sa montée par le manque de l'empire
     mesurerait chaque position avec une règle différente. */
  const g = app(s => { s.tech.astro = 8; GORGE_METAL(s); });
  assert.ok(g.colonyPayback(8).rate > g.colonyPayback(15).rate,
    'la position 8 (+35 % métal) produit encore plus que la 15');
});

t('la raison du centre ne disparaît pas quand le joueur confirme le conseil', () => {
  const g = app(s => { s.centre = 'mere'; });
  assert.equal(g.centreIndex(), 0);
  assert.ok(g.centreWhy(), 'confirmer le conseil ne doit pas faire taire sa raison');
});

t('retirer le centre emporte le réglage', () => {
  const g = app(s => { s.centre = 'colo'; });
  g.forgetPlanet('colo');
  assert.equal(g.S.centre, null, 'un id mort ne doit pas rester en sauvegarde');
});

t('une planète seule dit qu\'il n\'y a rien à comparer', () => {
  const h = app(s => { s.planets = [s.planets[0]]; }).VIEWS.planets();
  assert.ok(/rien à comparer/.test(h), 'le message dit la vérité : ' + h.slice(0, 300));
  assert.ok(!/aucune autre/.test(h), 'il n\'y a pas d\'autre planète dont la distinguer');
});

t('la ligne de vocation se remet à jour sans tout redessiner', () => {
  const g = app();
  g.REFRESH.planets();
  assert.ok(/[Mm]étal/.test(g.html()['pvoc-0'] || ''),
    'la vocation suit un changement de coordonnées sans attendre un rendu complet');
});

/* ---------- défense ---------- */
/* Ce qui manquait : le plan ne proposait jamais de défense, et une planète
   pleine restait une ferme gratuite. On vérifie les trois états de p.def :
   jamais lu, lu à zéro, lu au-dessus de la cible. */

/** Planète mère riche, chantier libre de la colonie, avec la défense donnée.
    `def` vaut null (page jamais ouverte), un total (ancien relevé) ou le
    détail par type. */
function defense(def, mod) {
  const g = app(s => {
    relie(s);
    s.colo.built = true;
    const p = s.planets[0];
    if (typeof def === 'number') p.def = def;
    else if (def) { p.defs = def; p.def = Object.values(def).reduce((a, n) => a + n, 0); }
    p.stock = { m: 5e6, c: 2e6, d: 1e6, at: SOIR };
    p.ships = { lc: 50, sc: 20, pr: 10 };
    if (mod) mod(s);
  });
  const plan = g.simulateDay();
  const acts = plan.sessions.flatMap(x => x.acts);
  return { g, acts, act: acts.find(a => a.kind === 'def') };
}

/** Des mines assez hautes pour mériter les deux boucliers. */
const mineuse = s => {
  const p = s.planets[0];
  p.b.metal = p.b.crystal = p.b.deut = 34;
  p.b.solar = 42;
};

/** La technologie qui débloque tout le mélange de début de partie. */
const chercheur = s => {
  Object.assign(s.tech, { laser: 6, energy: 6, ion: 4, shielding: 6, weapons: 3 });
  s.planets[0].b.shipyard = 6;
};

t('page Défense jamais ouverte : rien n\'est proposé, mais on la réclame', () => {
  const { g, act } = defense(null);
  assert.equal(act, undefined, 'sans lecture, proposer doublerait ce qui existe');
  const m = g.dailyMissions().find(x => x.id === 'defseen');
  assert.ok(m, 'la carte réclamant la page manque');
  assert.match(g.missionGo(m), /component=defenses/, 'la carte mène à la page Défense');
});

t('aucune défense : des lanceurs entrent dans le plan, sur la page Défense', () => {
  const { g, acts, act } = defense(0);
  assert.ok(act, 'aucune défense proposée : ' + JSON.stringify(acts.map(a => a.what)));
  assert.ok(act.ships.rl > 0, 'des lanceurs de missiles');
  assert.equal(act.cost[0], act.ships.rl * 2000, 'métal seul, 2 000 par lanceur');
  assert.equal(act.cost[1] + act.cost[2], 0);
  assert.match(act.what, /lanceurs de missiles/, 'nommés en clair : ' + act.what);
  assert.match(g.actGo(act), /component=defenses/, 'le lien ouvre la page Défense');
  assert.match(act.q, /^Défense · /, 'rangé sous Défense : ' + act.q);
  assert.ok(!g.dailyMissions().some(x => x.id === 'defseen'), 'la page est lue, plus rien à réclamer');
});

t('zéro défense passe devant le reste du chantier', () => {
  const { acts } = defense(0);
  const q = acts.map(a => a.q);
  const iDef = q.findIndex(x => /^Défense/.test(x)), iSh = q.findIndex(x => /^Chantier/.test(x));
  if (iSh >= 0) assert.ok(iDef < iSh, 'le raid est gratuit, la défense d\'abord : ' + q.join(' | '));
});

t('la cible suit la production, et un mélange au complet se tait', () => {
  const g = app(s => { relie(s); chercheur(s); });
  const mix = g.defMix(g.S.planets[0]);
  assert.ok(mix.n > 0, 'une planète qui produit mérite une défense');
  // Le mélange au complet, et largement : plus rien à réclamer.
  const plein = {};
  for (const [k, n] of Object.entries(mix.cible)) plein[k] = n * 5;
  assert.equal(defense(plein, chercheur).act, undefined,
    'la cible dépassée partout, on arrête');
  const { act } = defense({ rl: 1 }, chercheur);
  assert.ok(act, 'sous la cible, le plan complète');
  assert.match(act.why, /sur \d+ vis[eé]/, 'la cible est chiffrée : ' + act.why);
});

/* Le point que le wiki martèle : un tas d'un seul type est gratuit à percer.
   Le croiseur a un tir rapide de 10 sur le lanceur de missiles et rien du tout
   sur le laser léger ; le destructeur l'inverse. Le plan doit donc viser les
   deux, et le dire. */
t('un tas de lanceurs ne suffit pas : le plan vise aussi des lasers légers', () => {
  const g = app(s => { relie(s); chercheur(s); });
  const mix = g.defMix(g.S.planets[0]);
  assert.ok(mix.cible.rl > 0 && mix.cible.ll > 0, 'les deux chairs à canon : ' + JSON.stringify(mix.cible));
  assert.ok(mix.cible.hl > 0 && mix.cible.gc > 0, 'et des gros canons : ' + JSON.stringify(mix.cible));
  // 500 lanceurs, pas un laser : c'est le laser que le plan réclame.
  const { act } = defense({ rl: 500 }, chercheur);
  assert.ok(act, 'un tas d\'un seul type laisse quelque chose à faire');
  assert.ok(act.ships.ll > 0, 'des lasers légers : ' + act.what);
  assert.match(act.why, /croiseur|destructeur/, 'et on dit pourquoi : ' + act.why);
});

/* Ce qui agaçait : deux cartes d'affilée pour un laser, cinquante secondes de
   chantier chacune. Un lot vaut au moins une tournée de production, sinon il
   attend. */
t('la défense sort par paquets, jamais une pièce à la fois', () => {
  const petit = s => { chercheur(s); mineuse(s); s.planets[0].stock = { m: 2000, c: 700, d: 0, at: SOIR }; };
  const { g, acts } = defense({ rl: 500 }, petit);
  const lots = acts.filter(a => a.kind === 'def');
  assert.ok(lots.length, 'la défense manque toujours : ' + JSON.stringify(acts.map(a => a.what)));
  // La cible monte avec les mines : sans plancher, chaque tournée sortait une
  // carte pour une pièce, cinquante secondes de chantier. Les boucliers, eux,
  // sont une pièce ou rien.
  for (const a of lots)
    assert.ok(a.ships.sd || a.ships.ld || Object.values(a.ships)[0] > 1,
      'une pièce à la fois, personne ne se reconnecte pour ça : ' + a.what);
  assert.ok(lots.some(a => Object.values(a.ships)[0] > 10), 'aucun vrai paquet : ' + lots.map(a => a.what).join(' | '));
});

t('chaque pièce de défense a son prix et ses prérequis', () => {
  const g = app(s => { relie(s); chercheur(s); });
  // Relevé sur le wiki OGame : un prix faux fait mentir tout le plan.
  const { act } = defense({ rl: 500 }, chercheur);
  assert.deepEqual(act.cost, [act.ships.ll * 1500, act.ships.ll * 500, 0], JSON.stringify(act.cost));
  // Sans Laser 3, le laser léger n'existe pas et le lanceur reste seul.
  const sans = app(relie);
  assert.deepEqual(Object.keys(sans.defMix(sans.S.planets[0]).cible), ['rl'],
    'rien d\'autre n\'est à portée au départ');
});

t('le bouclier vient après la chair à canon, et une seule fois', () => {
  // Un bouclier coûte vingt-six fois un lanceur : il ne vaut la dépense qu'à
  // partir d'une planète qui produit assez pour mériter une vraie défense.
  const g = app(s => { relie(s); chercheur(s); mineuse(s); });
  const p = g.S.planets[0];
  const cible = g.defMix(p).cible;
  assert.ok(cible.sd === 1 && cible.ld === 1, 'les deux boucliers visés : ' + JSON.stringify(cible));
  p.defs = { rl: 2 };
  assert.notEqual(g.defNeed(p).k, 'sd', 'pas de bouclier sur une planète nue');
  p.defs = { rl: cible.rl, ll: cible.ll };
  assert.equal(g.defNeed(p).k, 'sd', 'de la chair à canon : le bouclier vient');
  p.defs = { rl: cible.rl, ll: cible.ll, sd: 1 };
  assert.notEqual(g.defNeed(p).k, 'sd', 'un seul petit bouclier, jamais deux');
});

t('une petite planète ne se voit pas promettre de bouclier', () => {
  // Le mélange annoncé est celui que le plan proposera : y mettre un bouclier
  // hors de prix, c'est promettre une pièce qui ne viendra jamais.
  const g = app(s => { relie(s); chercheur(s); });
  const cible = g.defMix(g.S.planets[0]).cible;
  assert.equal(cible.sd, 0, JSON.stringify(cible));
  assert.ok(!/bouclier/.test(g.defMixList(g.S.planets[0])), g.defMixList(g.S.planets[0]));
});

t('un ancien relevé ne compte qu\'un total, et ne se perd pas en route', () => {
  // Avant, le copilote ne lisait que le total : il le comptait en lanceurs.
  // Poser le premier laser ne doit pas effacer ces lanceurs.
  const { acts } = defense(300, chercheur);
  const lanceurs = acts.filter(a => a.kind === 'def' && a.ships.rl);
  const vus = acts.filter(a => a.kind === 'def').map(a => a.why).join(' | ');
  assert.ok(!/0 lanceur de missiles sur/.test(vus), 'les 300 lanceurs restent comptés : ' + vus);
  assert.equal(lanceurs.length, 0, 'et rien ne les redemande : ' + vus);
});

/* ---------- inventaire des transporteurs ---------- */
/* Le cas vécu : les rapatriements laissent la soute stationnée sur les
   colonies, et la planète la plus riche passe la nuit pleine et nue. */

/** Caribou pleine et sans un vaisseau, toute la soute sur la colonie. */
function nue(mod) {
  return app(s => {
    relie(s);
    s.planets[0].name = 'Caribou';
    s.planets[0].ships = { pr: 4 };
    s.planets[0].stock = { m: 9e5, c: 4e5, d: 7e5, at: SOIR };
    s.planets[1].ships = { lc: 40, sc: 10 };
    if (mod) mod(s);
  });
}

t('la soute partie sur la colonie est inventoriée, pas ignorée', () => {
  const g = nue();
  const trous = g.cargoGaps();
  assert.equal(trous.length, 1, 'une seule planète manque de soute : ' + JSON.stringify(trous.map(x => x.p.name)));
  assert.equal(trous[0].p.name, 'Caribou');
  assert.ok(trous[0].cargo === 0 && trous[0].manque > 0, 'le manque est chiffré');
  assert.equal(trous[0].ailleurs[0].p.name, 'Colonie', 'et on sait où est la flotte');
});

t('une carte dit de ramener les transporteurs, en Stationner', () => {
  const g = nue();
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  assert.ok(m, 'rien ne propose de ramener la soute');
  assert.match(m.what, /de Colonie vers Caribou/, m.what);
  assert.equal(m.mission, 4, 'Stationner : un Transporter repartirait seul');
  assert.match(m.how[0], /Stationner/);
  const u = g.missionGo(m);
  assert.match(u, /mission=4/, 'le lien prépare la mission : ' + u);
  assert.match(u, /cp=33602/, 'elle part de la colonie, où sont les vaisseaux : ' + u);
  assert.match(u, /am203=/, 'avec les grands transporteurs : ' + u);
});

t('le donneur garde de quoi lever sa propre charge', () => {
  const g = nue();
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  const colo = g.S.planets[1];
  const reste = { lc: (colo.ships.lc || 0) - (m.ships.lc || 0), sc: (colo.ships.sc || 0) - (m.ships.sc || 0) };
  const souteReste = g.cargoCap({ ships: reste });
  const charge = colo.stock.m + colo.stock.c + colo.stock.d;
  assert.ok(souteReste >= charge, `la colonie garde ${souteReste} de soute pour lever ${charge}`);
});

t('la mise à l\'abri protège la planète qui PEUT partir, pas seulement la plus chargée', () => {
  // Avant, elle ne regardait que la plus chargée : sans vaisseau dessus, elle
  // rendait null et la carte du soir retombait sur un conseil général.
  const fs = nue().fleetsavePlan(SOIR);
  assert.ok(fs, 'aucun plan alors que la colonie a 40 grands transporteurs');
  assert.equal(fs.from.name, 'Colonie');
});

t('chaque planète chargée a son lot, et la carte du soir les nomme tous', () => {
  const g = nue(s => { s.planets[0].ships = { lc: 40, pr: 4 }; s.planets[1].ships = { lc: 10 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs && fs.rest && fs.rest.length === 1, 'le second lot manque : ' + JSON.stringify(fs && (fs.rest || []).length));
  assert.equal(fs.from.name, 'Caribou', 'le plus gros lot protégeable passe en premier');
  const m = g.dailyMissions().find(x => x.id === 'night');
  assert.ok(m.how.some(h => /Puis depuis Colonie/.test(h)), 'le second lot n\'est pas dit : ' + JSON.stringify(m.how));
});

t('un nom de planète ne peut pas injecter de balise dans les étapes', () => {
  // taskHtml pose les lignes de `how` telles quelles dans innerHTML, pour que
  // le <b> voulu rende ; un nom de planète vient de la page du jeu.
  const g = nue(s => { s.planets[0].name = '<img src=x onerror=alert(1)>'; });
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  const how = m.how.join(' ');
  assert.ok(!/<img/.test(how), 'la balise passe telle quelle : ' + how);
  assert.match(how, /&lt;img/, 'le nom est échappé : ' + how);
});

t('la même soute n\'est promise qu\'une fois, et la colonie sans donneur est nommée', () => {
  // Avant, chaque colonie voyait tout le surplus du donneur : cinq cartes
  // « Ramène 1 grand transporteur » pour un seul transporteur libre, et dès le
  // premier rapatriement lancé les autres cartes s'évanouissaient.
  const g = app(s => {
    relie(s);
    s.planets[0].name = 'Wesh';
    s.planets[0].ships = { lc: 4, pr: 4 };
    s.planets[0].stock = { m: 5e4, c: 2e4, d: 1e4, at: SOIR };
    s.planets[1].stock = { m: 3e5, c: 1e5, d: 5e4, at: SOIR };
    const deux = JSON.parse(JSON.stringify(s.planets[1]));
    Object.assign(deux, { id: 'colo2', name: 'Lala', coords: '1:142:4', gid: '33603' });
    s.planets.push(deux);
  });
  const cartes = g.dailyMissions().filter(x => /^cargo-split/.test(x.id));
  assert.equal(cartes.length, 1, 'la même soute est promise plusieurs fois : ' + JSON.stringify(cartes.map(x => x.what)));
  const nuit = g.dailyMissions().find(x => x.id === 'night');
  assert.ok(nuit.how.some(h => /plus rien à emprunter/.test(h) && /Lala/.test(h)),
    'la colonie sans donneur n\'est pas nommée : ' + JSON.stringify(nuit.how));
});

t('soute suffisante partout : aucune carte de répartition', () => {
  const g = app(s => { relie(s); s.planets[0].ships = { lc: 40 }; s.planets[1].ships = { lc: 10 }; });
  assert.deepEqual(g.cargoGaps(), []);
  assert.ok(!g.dailyMissions().some(x => /^cargo-split/.test(x.id)));
});

/* ---------- une planète, une identité ---------- */

t('un état en rangs se convertit au chargement, et la conversion rejouée ne change rien', () => {
  const g = app(s => {
    s.timers = [{ id: 'm1', manual: true, kind: 'b', k: 'metal', lvl: 15, p: 1, end: SOIR + 36e5 }];
    s.plan = [{ type: 'b', p: 1, k: 'crystal', lvl: 13 }];
    s.colo.from = 1;
  });
  const colonie = g.S.planets[1];
  assert.equal(g.S.timers[0].pid, colonie.id);
  assert.equal(g.S.colo.fromId, colonie.id);
  assert.ok(!('p' in g.S.timers[0]), 'le rang ne traîne pas à côté de l\'identité');
  // La liste d'objectifs a disparu : ce qu'elle a laissé derrière elle aussi.
  assert.ok(!('plan' in g.S), 'rien ne reste de l\'ancienne liste');
  assert.equal(g.S.v, 2);
  const avant = JSON.stringify(g.S);
  g.migratePlanetIds();
  assert.equal(JSON.stringify(g.S), avant);
});

t('un relevé qui réordonne les planètes laisse le minuteur sur la bonne', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.timers = [{ id: 'm1', manual: true, kind: 'b', k: 'metal', lvl: 15, p: 1, end: SOIR + 36e5 }];
  });
  g.applyGame({ order: ['33002', '33001'],
    planets: { 33001: { coords: '1:142:8' }, 33002: { coords: '1:142:6' } },
    timers: [], moves: [] });
  assert.equal(g.S.planets[0].name, 'Colonie', 'le jeu dicte l\'ordre');
  assert.equal(g.planetById(g.S.timers[0].pid).name, 'Colonie');
});

t('une planète retirée emporte ce qui la visait, et rien d\'autre', () => {
  const g = app(s => {
    s.timers = [{ id: 'm1', manual: true, kind: 'b', k: 'metal', lvl: 15, p: 1, end: SOIR + 36e5 },
                { id: 'm2', manual: true, kind: 't', k: 'astro', lvl: 4, end: SOIR + 36e5 }];
    s.colo.from = 1;
  });
  g.forgetPlanet(g.S.planets[1].id);
  assert.deepEqual(g.S.planets.map(p => p.name), ['Planète mère']);
  // une recherche ne vise pas de planète : elle reste
  assert.deepEqual(g.S.timers.map(t => t.id), ['m2']);
  assert.equal(g.S.colo.fromId, null);
});

t('un id qui ne répond plus : le minuteur sonne, rien ne se crédite', () => {
  const g = app();
  const p = g.S.planets[0];
  const niveau = p.b.metal;
  g.finishTimer({ kind: 'b', pid: 'disparue', k: 'metal', lvl: niveau + 9, end: SOIR });
  assert.equal(p.b.metal, niveau, 'aucun niveau posé sur une voisine');
  g.finishTimer({ kind: 'x', k: 'sats', pid: 'disparue', n: 7, end: SOIR });
  assert.equal(p.sats, 0, 'aucun satellite non plus');
});

/* ---------- mode nuit ---------- */

/** Le soir, flotte au sol et colonie assez loin : le plan a de quoi parler. */
const dodo = s => { loin(s); s.planets[0].ships = { lc: 30, sc: 6 }; };

t('mode nuit : seules les cartes de protection restent', () => {
  const g = app(s => { dodo(s); s.day.night = true; });
  const ms = g.dailyMissions();
  assert.ok(ms.length, 'il reste des cartes');
  assert.deepEqual([...new Set(ms.map(m => m.q))], ['Sécurité'], ms.map(m => m.q).join(' · '));
  assert.ok(ms.some(m => m.id === 'night'), 'la mise à l\'abri est proposée');
});

t('mode jour : le plan garde ses autres rubriques', () => {
  const g = app(dodo);
  assert.ok(g.dailyMissions().some(m => m.q !== 'Sécurité'), 'tout ne se réduit pas à la sécurité');
});

t('mode nuit en pleine nuit : la mise à l\'abri sort quand même', () => {
  const troisH = new Date(2026, 10, 9, 3, 0, 0).getTime();
  const avec = app(s => { dodo(s); s.day.night = true; }, troisH);
  const sans = app(dodo, troisH);
  assert.ok(avec.dailyMissions().some(m => m.id === 'night'), 'le mode nuit la réclame');
  assert.ok(!sans.dailyMissions().some(m => m.id === 'night'), 'le mode jour ne la propose pas à 3 h');
});

/* ---------- une carte ne sort que si la place existe ---------- */

t('emplacements de flotte pleins : aucun rapatriement proposé', () => {
  // Le copilote connaît les flottes en vol : proposer un envoi de plus, c'est
  // envoyer le joueur sur « Nombre maximal de flottes atteint ».
  const plein = app(s => { flotteAuHub(s); s.syncAt = JOUR; s.slots = { fleet: [9, 9], at: JOUR }; }, JOUR);
  assert.ok(!transfert(plein), 'sans emplacement libre, rien à lancer');
  const libre = app(s => { flotteAuHub(s); s.syncAt = JOUR; s.slots = { fleet: [2, 9], at: JOUR }; }, JOUR);
  assert.ok(transfert(libre), 'avec de la place, le rapatriement revient');
});

t('le dernier emplacement revient à l\'expédition, pas au rapatriement', () => {
  const g = app(s => { flotteDExpedition(s); s.planets[1].stock = { m: 60000, c: 40000, d: 5000, at: JOUR };
    s.slots = { fleet: [8, 9], expo: [0, 3], at: JOUR }; }, JOUR);
  const s0 = g.simulateDay().sessions[0];
  assert.equal(s0.acts.filter(a => a.kind === 'expo').length, 1, 'l\'expédition part');
  assert.ok(!s0.acts.some(a => a.kind === 'transfer'), 'le rapatriement lui laisse la place');
});

t('une flotte lancée depuis la lecture occupe son emplacement', () => {
  // Le chiffre « Flottes 7/8 » date de la dernière page de flotte ouverte ;
  // depuis, le joueur a cliqué Lancé. Le copilote le sait : c'est son minuteur.
  const g = app(s => {
    s.me = 'moi';
    s.syncAt = SOIR;
    s.slots = { fleet: [7, 8], at: SOIR - 3600e3 };
    s.timers = [{ id: 'f1', manual: true, kind: 'x', k: 'fleet', at: SOIR - 1800e3, end: SOIR + 3600e3, done: false }];
  }, SOIR, INACTIFS);
  assert.ok(!espionnage(g), 'le huitième emplacement est pris');
  assert.ok(espionnage(avecSlots(7, 8)), 'sans cette flotte, une cible reste proposée');
});

/** Une case de recherche de forme de vie (centaine paire). */
const CASE_LFR = 11201;

t('recherche de forme de vie en cours : pas de carte des artefacts', () => {
  // Choisir la technologie d'un slot, c'est lancer la recherche qui va avec.
  const enCours = app(s => {
    s.artefacts = 461;
    s.planets[0].lf = { [CASE_LFR]: { lvl: 3, state: 'ok' } };
    s.timers = [{ id: 'l1', game: true, kind: 'x', k: 'other', queue: 'lfresearch', pid: 'mere', end: SOIR + 3600e3, done: false }];
  });
  assert.ok(!enCours.dailyMissions().some(m => m.id === 'artefacts'),
    'la file de recherche de forme de vie est occupée');
  const libre = app(s => { s.artefacts = 461; s.planets[0].lf = { [CASE_LFR]: { lvl: 3, state: 'ok' } }; });
  assert.ok(libre.dailyMissions().some(m => m.id === 'artefacts'),
    'file libre : la carte sort');
});

t('aucune case de recherche lue : la carte des artefacts sort quand même', () => {
  const g = app(s => { s.artefacts = 461; });
  assert.ok(g.dailyMissions().some(m => m.id === 'artefacts'),
    'rien de lu, rien à déduire : on ne cache pas');
});

/* ---------- un lot sorti du chantier fait taire le chantier ---------- */
/* Le jeu nomme ce que son chantier construit, jamais combien, et sa file
   n'annonce que le lot en cours. Le copilote reproposait donc ce qui était
   déjà en construction — et la carte disparaissait au clic, quand la page
   relue lui apprenait la vérité. */

/** La planète mère, défense lue, reliée au jeu sous le gid 101. */
const chantierPret = s => {
  s.planets[0].gid = '101'; s.planets[1].gid = '102';
  s.planets[0].def = 500; s.planets[0].defs = { rl: 500 };
};
/** Le jeu publie un lot en chantier sur la planète mère. */
const publieLot = (g, techId, finSecs, planetes) => g.applyGame({
  meta: { host: 's1.ogame.gameforge.com' },
  planets: planetes || { '101': {}, '102': {} },
  timers: [{ end: Math.round(JOUR / 1000) + finSecs, techId, type: 'shipyard',
    label: 'Lot', planetId: '101' }],
  moves: [], at: JOUR
});
/** Les cartes de chantier de la planète mère, sur toute la journée. */
const cartesChantier = plan => plan.sessions.flatMap(x => x.acts)
  .filter(a => a.p === 0 && ['sats', 'shipbuild', 'def'].includes(a.kind));

t('un lot en chantier fait taire vaisseaux, défense et satellites', () => {
  const avant = app(chantierPret, JOUR);
  assert.ok(cartesChantier(avant.simulateDay()).length > 0,
    'sans lot, le chantier a bien quelque chose à proposer');
  const g = app(chantierPret, JOUR);
  publieLot(g, '203', 1200);                      // grands transporteurs
  assert.deepEqual(cartesChantier(g.simulateDay()).map(a => a.what), [],
    'le nombre construit est inconnu : on ne propose rien plutôt que de doubler');
});

t('le lot en cours reste affiché comme en cours', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, '203', 1200);
  assert.ok(g.simulateDay().busy.some(b => /Chantier spatial/.test(b.q)),
    'se taire n\'est pas cacher : la file occupée se voit');
});

t('la page du chantier relue rend la parole', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, '203', 1200);
  // la page Chantier rouverte après la fin du lot : le compte au sol est le vrai
  g.applyGame({ planets: { '101': { ships: { lc: 12 }, shipsAt: JOUR + 1300e3 }, '102': {} },
    timers: [], moves: [], at: JOUR + 1300e3 });
  assert.ok(cartesChantier(g.simulateDay()).length > 0, 'le chantier reparle');
  assert.ok(!g.dailyMissions().some(m => m.id === 'chantierlu'), 'et la carte de lecture s\'efface');
});

t('un lot de défense ne se juge pas sur la lecture de la flotte', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, '401', 1200);                      // lanceurs de missiles
  // La flotte relue ne dit rien de la défense : deux pages, deux comptes.
  g.applyGame({ planets: { '101': { ships: { lc: 12 }, shipsAt: JOUR + 1300e3 }, '102': {} },
    timers: [], moves: [], at: JOUR + 1300e3 });
  assert.deepEqual(cartesChantier(g.simulateDay()).map(a => a.what), [],
    'la page Défense n\'a pas été relue depuis le lot');
});

t('un lot que le jeu ne nomme pas rend les deux comptes douteux', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, null, 1200);
  assert.deepEqual(cartesChantier(g.simulateDay()).map(a => a.what), [],
    'sans identifiant, le lot peut être vaisseau comme défense');
});

t('une planète dont aucun lot n\'a été vu reste bavarde', () => {
  const g = app(chantierPret, JOUR);
  g.applyGame({ planets: { '101': {}, '102': {} }, timers: [], moves: [], at: JOUR });
  assert.ok(cartesChantier(g.simulateDay()).length > 0,
    'un compte vieux n\'est pas un compte faux : on ne se tait pas sans raison');
});

t('la carte de lecture dit quelle page ouvrir, et laquelle', () => {
  /* Le lot est sorti il y a vingt minutes : c'est à ce moment-là, et pas
     avant, qu'aller relire la page apprend quelque chose. */
  const g = app(chantierPret, JOUR);
  publieLot(g, '203', -1200);
  const m = g.dailyMissions().find(x => x.id === 'chantierlu');
  assert.ok(m, 'une carte réclame la lecture');
  assert.ok(/Planète mère/.test(m.what), 'elle nomme la planète : ' + m.what);
  assert.ok(/shipyard/.test(g.missionGo(m)), 'et mène au chantier spatial');
});

t('des satellites annoncés par le jeu évitent une centrale de plus', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, '212', 1800);                      // satellites solaires
  const s0 = g.simulateDay().sessions[0].acts;
  assert.ok(!s0.some(a => a.kind === 'b' && a.k === 'solar'),
    'l\'énergie arrive par le chantier : pas de centrale en double');
});

/* ---------- les heures du jeu ---------- */

/* 1794988642 = mercredi 18 novembre 2026, 07 h 57 min 22 s UTC.
   Le serveur l'écrit 08:57:22 : il est à UTC+1. Le joueur est à UTC-10. */
const HEURES = {
  epoch: 1794988642, horloge: '18.11.2026 08:57:22',
  arrivees: [{ epoch: 1794988647, txt: '08:57:27' }]
};

t('une heure du jeu se relit à la montre du joueur', () => {
  const r = runPage({ skin: null, heures: HEURES });
  assert.equal(r.heures[0].txt, '21:57:27', 'onze heures de moins, la veille');
  assert.equal(r.heures[0].titre, 'heure du serveur : 08:57:27', 'et le serveur à portée de souris');
  assert.ok(/copilote-heure/.test(r.heures[0].cls), 'marquée comme traduite');
});

t('un joueur à l\'heure du serveur ne voit rien changer', () => {
  // Même instant, mais une horloge qui affiche déjà l'heure de Tahiti.
  const r = runPage({ skin: null, heures: { ...HEURES, horloge: '17.11.2026 21:57:22' } });
  assert.equal(r.heures[0].txt, '08:57:27', 'le texte du jeu reste le sien');
  assert.equal(r.heures[0].cls, 'arrivalTime', 'et rien ne le marque');
});

t('la date d\'un message se relit à la montre du joueur', () => {
  // 23.11.2026 08:20:27 au serveur (UTC+1) : 22.11.2026 21:20:27 à Tahiti.
  const r = runPage({ skin: null, heures: { ...HEURES, messages: ['23.11.2026 08:20:27'] } });
  assert.equal(r.dates[0].txt, '22.11.2026 21:20:27', 'onze heures de moins, la veille');
  assert.equal(r.dates[0].titre, 'heure du serveur : 23.11.2026 08:20:27', 'et le serveur à portée de souris');
  assert.ok(/copilote-heure/.test(r.dates[0].cls), 'marquée comme traduite');
});

t('l\'horloge du jeu garde l\'heure du serveur', () => {
  const r = runPage({ skin: null, heures: { ...HEURES, messages: ['23.11.2026 08:20:27'] } });
  assert.equal(r.horloge, HEURES.horloge, 'le repère en heure serveur ne bouge pas');
});

t('une date déjà traduite ne se décale pas à chaque passage', () => {
  /* Le script repeint plusieurs fois une même page : sans la marque, la date
     reculerait d'onze heures de plus à chaque fois. */
  const r = runPage({ skin: null, heures: { ...HEURES, messages: ['23.11.2026 08:20:27'] } });
  r.secousse();
  r.secousse();
  assert.equal(r.read().dates[0].txt, '22.11.2026 21:20:27', 'traduite une fois, pas trois');
});

t('un texte qui n\'est pas l\'heure de cet instant n\'est pas touché', () => {
  /* Le garde-fou : la cellule dit autre chose que ce que le serveur dirait
     de cet instant — une durée, un reste de compte à rebours. On passe. */
  const r = runPage({ skin: null, heures: { ...HEURES, arrivees: [{ epoch: 1794988647, txt: '12:34:56' }] } });
  assert.equal(r.heures[0].txt, '12:34:56');
  assert.equal(r.heures[0].titre, '', 'aucune infobulle posée');
});

t('sans horloge lisible, aucune heure ne bouge', () => {
  const r = runPage({ skin: null, heures: { ...HEURES, horloge: 'temps du serveur' } });
  assert.equal(r.heures[0].txt, '08:57:27');
});

/* ---------- les priorités du joueur ---------- */

t('une priorité vivante sort avec son pid résolu', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}]; });
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
});

t('une priorité atteinte ne sort plus', () => {
  // la mère est au labo 5 dans la fixture
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:5}]; });
  assert.deepEqual(g.prios(), []);
});

t('une recherche atteinte ne sort plus, une recherche à faire porte le centre', () => {
  const g = app(s => { s.prio = [{kind:'t', k:'astro', lvl:3}, {kind:'t', k:'plasma', lvl:4}]; });
  const l = g.prios();
  assert.equal(l.length, 1, 'astro 3 est déjà acquis dans la fixture');
  assert.equal(l[0].k, 'plasma');
  assert.equal(l[0].pid, g.labPlanet().id);
});

t('une priorité sur une planète oubliée est muette', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'disparue', k:'lab', lvl:10}]; });
  assert.deepEqual(g.prios(), []);
});

t('une entrée abîmée est ignorée sans exception', () => {
  const g = app(s => { s.prio = [
    {kind:'z', pid:'mere', k:'lab', lvl:10},
    {kind:'b', pid:'mere', k:'__proto__', lvl:10},
    {kind:'b', pid:'mere', k:'lab', lvl:'dix'},
    {kind:'t', k:'plasma', lvl:4}]; });
  assert.deepEqual(g.prios().map(x=>x.k), ['plasma']);
});

t('l\'ordre de pose est gardé, et prioOf rend la première de la planète', () => {
  const g = app(s => { s.prio = [
    {kind:'b', pid:'mere', k:'nanite', lvl:1},
    {kind:'b', pid:'colo', k:'metal', lvl:8},
    {kind:'b', pid:'mere', k:'lab', lvl:10}]; });
  assert.deepEqual(g.prios().map(x=>x.k), ['nanite', 'metal', 'lab']);
  assert.equal(g.prioOf('mere').k, 'nanite');
  assert.equal(g.prioOf('colo').k, 'metal');
  assert.equal(g.prioOf('absente'), null);
});

t('prioClean retire les mortes du stockage, prios n\'y touche pas', () => {
  // posé après le chargement : render() nettoie déjà ce qui arrive mort du stockage
  const g = app();
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:5}, {kind:'t', k:'plasma', lvl:4}];
  g.prios();
  assert.equal(g.S.prio.length, 2, 'prios() n\'écrit rien');
  g.prioClean();
  assert.deepEqual(g.S.prio, [{kind:'t', k:'plasma', lvl:4}]);
});

t('un empire vide n\'efface pas les recherches que le joueur a posées', () => {
  // posé après le chargement : sans planète, labPlanet() est null et prios() rend []
  const g = app();
  g.S.prio = [{kind:'t', k:'plasma', lvl:4}];
  g.S.planets = [];
  g.prioClean();
  assert.deepEqual(g.S.prio, [{kind:'t', k:'plasma', lvl:4}]);
});

/* Les cases de forme de vie : une file à part, que prios() ne voit jamais. */
t('priosLf rend les cases de forme de vie, prios ne les voit pas', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:3, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}, {kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.priosLf(), [{pid:'mere', k:11101, lvl:5}]);
  assert.deepEqual(g.prios().map(x=>x.k), ['lab'], 'prios() ignore lf');
});

t('une priorité lf atteinte n\'existe plus', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:5, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}];
  assert.deepEqual(g.priosLf(), []);
});

t('une priorité lf sur une case que le relevé ignore reste vivante, à partir de 0', () => {
  const g = app();                       // p.lf absent : le relevé n'est pas encore passé
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}];
  assert.deepEqual(g.priosLf(), [{pid:'mere', k:11101, lvl:5}]);
});

t('une priorité lf mal formée ne compte pas', () => {
  const g = app();
  g.S.prio = [{kind:'lf', pid:'mere', k:'11101', lvl:5}, {kind:'lf', pid:'mere', k:'constructor', lvl:5},
    {kind:'lf', pid:'mere', k:101, lvl:5}, {kind:'lf', pid:'mere', k:11101, lvl:5.5},
    {kind:'lf', pid:'mere', k:11101, lvl:0}, {kind:'lf', pid:'absente', k:11101, lvl:5}];
  assert.deepEqual(g.priosLf(), []);
});

t('une priorité lf meurt avec sa planète oubliée', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}];
  g.forgetPlanet('mere');
  assert.deepEqual(g.priosLf(), []);
});

t('prioPose range la tuile en nombre : une chaîne du DOM est retrouvée', () => {
  const g = app();
  g.prioPose('lf', 'mere', '11101', '5');
  assert.equal(g.prioLvl('lf', 'mere', 11101), 5);
  for(const mauvais of ['abc', '', null, [], undefined, '0x2B4D', '11101abc', 11101.5, '101', 101]){
    g.prioPose('lf', 'mere', mauvais, '5');      // pas une tuile : rien ne se pose
    assert.equal(g.S.prio.length, 1, 'rien posé pour ' + JSON.stringify(mauvais));
  }
  g.prioPose('lf', 'mere', 11102, '2');          // un nombre pose aussi
  assert.equal(g.prioLvl('lf', 'mere', 11102), 2);
});

t('prioClean garde les lf, dans l\'ordre de pose, et ne réécrit pas pour rien', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}, {kind:'b', pid:'mere', k:'lab', lvl:10}];
  const avant = JSON.stringify(g.S.prio);
  g.prioClean();
  assert.equal(JSON.stringify(g.S.prio), avant, 'rien ne tombe, donc rien ne se réécrit');
  g.S.prio.push({kind:'b', pid:'mere', k:'metal', lvl:1});   // morte : la mère est au métal 14
  g.prioClean();
  assert.deepEqual(g.S.prio, JSON.parse(avant), 'la morte tombe, les deux vivantes restent, dans leur ordre');
});

t('prioPose et prioLvl savent compter en lf', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:3, state:'ok'}}; });
  g.prioPose('lf', 'mere', 11101, '5');
  assert.equal(g.prioLvl('lf', 'mere', 11101), 5);
  g.prioPose('lf', 'mere', 11101, '3');          // au niveau actuel : retire
  assert.equal(g.prioLvl('lf', 'mere', 11101), '');
  assert.equal(g.S.prio.length, 0, 'retirée du stockage, pas seulement masquée par priosLf');
  g.prioPose('lf', 'mere', 11102, '2');          // case que le relevé ignore : pose depuis 0
  assert.equal(g.prioLvl('lf', 'mere', 11102), 2);
});

/** Une priorité de labo 10 sur la mère, qui est au labo 5 et n'a aucune raison
    de monter son labo aujourd'hui. */
const prioLabo = s => { s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}]; };

/* Sur toute la journée, et pas sur la première session : la mère de la fixture
   tourne au ralenti (facteur 0,82), donc sa centrale de secours lui prend sa
   première session — c'est exactement la précédence que vérifie plus bas « la
   centrale passe devant la priorité ». Ce qui compte est qu'aucun labo ne
   sorte jamais sans priorité, et qu'il sorte avec. */
t('sans priorité, aucune carte de labo ne sort', () => {
  const p = app().simulateDay();
  assert.ok(!p.sessions.flatMap(x => x.acts).some(a => a.kind === 'b' && a.k === 'lab'));
});

t('avec la priorité, le labo sort et porte sa raison', () => {
  const p = app(prioLabo).simulateDay();
  const a = p.sessions.flatMap(x => x.acts).find(x => x.kind === 'b' && x.k === 'lab');
  assert.ok(a, 'le labo est proposé');
  assert.equal(a.lvl, 6, 'le niveau suivant, pas le niveau visé');
  assert.match(a.why, /priorité/i);
});

t('la priorité ouvre un objectif, et la recherche n\'en ouvre pas un second', () => {
  /* Sur toute la journée, jamais sur la seule session 0 : à la première, la
     recherche ne voulait pas d'objectif de toute façon, et la règle pouvait
     disparaître sans qu'un test tombe. C'est dès la sixième session que la mère
     porterait deux réserves — celle de la priorité et celle d'Énergie 5. */
  const p = app(prioLabo).simulateDay();
  assert.ok(p.sessions.some(s => s.goals.some(x => x.key.startsWith('prio:'))),
    'la priorité épargne bien quelque part');
  for (const s of p.sessions)
    for (const x of s.goals.filter(g => g.key.startsWith('prio:')))
      assert.deepEqual(s.goals.filter(g => g.p === x.p).map(g => g.key), [x.key],
        'objectifs de la planète ' + x.p + ' : ' + s.goals.map(g => g.key).join(', '));
});

t('aucune planète ne porte deux objectifs, à aucune session', () => {
  /* La règle des deux réserves ne vaut pas que pour les priorités : `reserveOf`
     somme les objectifs d'une planète, et deux d'entre eux la gèlent jusqu'à ce
     que les deux soient payables. Un balayage, parce qu'une seule session ne
     tient rien. */
  for (const prio of [prioLabo, s => { s.prio = []; }]) {
    const p = app(prio).simulateDay();
    for (const s of p.sessions) {
      const parPlanete = {};
      for (const g of s.goals) parPlanete[g.p] = (parPlanete[g.p] || 0) + 1;
      for (const [i, n] of Object.entries(parPlanete))
        assert.equal(n, 1, `planète ${i} : ${s.goals.filter(g => g.p == i).map(g => g.key).join(' + ')}`);
    }
  }
});

/** Une priorité dont le coût dépasse les hangars : Nanites 1 demande 1 M de
    métal, très au-dessus du Hangar M 3 de la fixture. */
const prioNanite = s => { s.prio = [{kind:'b', pid:'mere', k:'nanite', lvl:1}];
  s.planets[0].b.robot = 10; s.tech.computer = 10; };

t('un coût au-dessus du hangar fait sortir le hangar, au niveau suivant', () => {
  const p = app(prioNanite).simulateDay();
  const tout = p.sessions.flatMap(x => x.acts.concat(x.waits));
  const h = tout.find(a => a.k === 'smetal');
  assert.ok(h, 'le hangar de métal est demandé');
  /* Et c'est le niveau 4, pas le niveau 8 qui logerait le million : le jeu ne
     construit un hangar qu'un niveau à la fois. Assurer sur la seule clé
     laissait passer n'importe quel niveau — c'est ce qui a caché le défaut. */
  assert.equal(h.what, 'Hangar de métal 4', 'vu : ' + h.what);
});

t('le hangar de la priorité monte d\'un niveau par session', () => {
  /* Viser d'emblée le niveau qui logerait le coût coûtait plus que le plafond
     du moment : `setGoal` rendait null, aucune réserve ne s'ouvrait, et la
     priorité se répétait sans jamais rien faire avancer. */
  const p = app(prioNanite).simulateDay();
  const vus = [...new Set(p.sessions.flatMap(x => x.acts.concat(x.waits))
    .filter(a => a.k === 'smetal').map(a => a.what))];
  assert.deepEqual(vus, ['Hangar de métal 4', 'Hangar de métal 5', 'Hangar de métal 6', 'Hangar de métal 7'],
    'vus : ' + vus.join(', '));
  assert.ok(p.sessions[0].goals.some(g => g.key === 'prio:mere:smetal4'),
    'et l\'épargne commence dès la première session : ' + p.sessions[0].goals.map(g => g.key).join(', '));
});

t('un prérequis manquant ne réserve rien et le dit', () => {
  const p = app(s => { s.prio = [{kind:'b', pid:'mere', k:'nanite', lvl:1}]; }).simulateDay();
  assert.equal(p.sessions[0].goals.filter(x => x.key.startsWith('prio:')).length, 0);
  const dit = p.sessions[0].acts.concat(p.sessions[0].waits).map(x => x.why || '').join(' ');
  assert.match(dit, /Robots 10/);
});

t('une ressource sans production le dit au lieu de disparaître', () => {
  /* La colonie n'a ni synthétiseur ni deutérium en stock : il n'y vient jamais,
     et l'usine de robots en demande. La centrale de fusion ne pouvait pas tenir
     ce rôle : elle exige le synthétiseur 5, donc une colonie qui la vise produit
     forcément du deutérium — c'est alors le prérequis qui parle, pas la
     ressource absente. */
  const p = app(s => { s.prio = [{kind:'b', pid:'colo', k:'robot', lvl:5}];
    s.planets[1].b.deut = 0; s.planets[1].stock = {m:9000, c:4000, d:0, at:0}; }).simulateDay();
  const dit = p.sessions[0].waits.map(x => (x.why || '') + ' ' + (x.what || '')).join(' ');
  assert.match(dit, /deutérium/i);
});

t('prioBloque ne lit pas le stock : elle vaut sur une planète réelle', () => {
  const g = app();
  assert.match(g.prioBloque(g.S.planets[1], 'nanite'), /Robots 10/);
  assert.equal(g.prioBloque(g.S.planets[0], 'lab'), '');
});

t('la centrale passe devant la priorité quand l\'énergie est négative', () => {
  const p = app(s => { prioLabo(s); s.planets[0].b.solar = 1; }).simulateDay();
  const a = p.sessions[0].acts.find(x => x.kind === 'b' && x.p === 0);
  assert.equal(a && a.k, 'solar', 'la centrale d\'abord');
});

t('la réserve de la priorité ne gèle pas la centrale', () => {
  /* Le secours doit être payable même quand la réserve couvre tout le stock.
     Le stock vaut donc exactement le coût de Labo 6 : la réserve ne laisse
     libre que la production de l'intervalle, environ 1 570 de métal, très
     au-dessous des 4 324 que coûte la centrale suivante. Sans la réserve
     calculée par candidat, la mère ne construit plus rien du tout — ni le
     secours, ni la priorité. Un stock plus confortable ne prouverait rien :
     `reserveOf` amortit la réserve par la production à venir, et une centrale
     à 112 de métal n'est jamais en danger. */
  const p = app(s => { prioLabo(s); s.planets[0].b.solar = 10;
    s.planets[0].stock = {m:6400, c:12800, d:6400, at:SOIR}; }).simulateDay();
  assert.ok(p.sessions[0].acts.some(a => a.kind === 'b' && a.p === 0 && a.k === 'solar'),
    'la centrale sort dès la première session');
});

t('une priorité que les secours doublent session après session le dit quand même', () => {
  /* La mère n'a plus qu'une centrale : son secours est payable à chaque
     session et passe devant, douze fois de suite. La ligne d'attente générique
     ne parle que du candidat le plus proche, qui n'est pas la priorité — sans
     une phrase à elle, le joueur lirait douze centrales et rien d'autre. */
  const p = app(s => { prioLabo(s); s.planets[0].b.solar = 1;
    s.planets[0].stock = {m:5000, c:5000, d:1000, at:0}; }).simulateDay();
  assert.ok(p.sessions[0].acts.some(a => a.k === 'solar'), 'le secours passe devant');
  assert.ok(p.sessions.every(s => s.acts.concat(s.waits)
      .some(x => x.kind === 'b' && x.k === 'lab' && /priorité/i.test(x.why || ''))),
    'et chaque session dit où en est la priorité');
});

t('l\'épargne d\'une priorité ne se referme pas sur la planète la nuit venue', () => {
  /* L'échéance d'un objectif dit quand on pense pouvoir payer, et `reserveOf`
     s'en sert pour amortir la réserve par la production d'ici là. Posée une
     fois pour toutes, elle expire pendant la nuit : `h` retombe à zéro, la
     réserve passe au coût entier, et la planète gèle pour une cible qui n'a
     pas bougé. Une priorité vit des jours, elle la recalcule à chaque session. */
  const p = app(prioLabo).simulateDay();
  for (const s of p.sessions)
    for (const g of s.goals.filter(x => x.key.startsWith('prio:')))
      assert.ok(g.deadline > s.T,
        g.key + ' : échéance dépassée de ' + ((s.T - g.deadline) / 3600e3).toFixed(1) + ' h');
});

t('la cible du moment avance, et l\'objectif avec elle', () => {
  /* La clé porte le pas, comme celle d'une recherche porte son niveau. Sans
     lui, `setGoal` rendrait l'objectif de Labo 6 avec son ancien prix une fois
     le Labo 6 construit, et la réserve épargnerait pour un prix qui n'est plus. */
  const p = app(prioLabo).simulateDay();
  const clefs = [...new Set(p.sessions.flatMap(s => s.goals.map(g => g.key)
    .filter(k => k.startsWith('prio:'))))];
  assert.deepEqual(clefs, ['prio:mere:lab6', 'prio:mere:lab7'], 'clés vues : ' + clefs.join(', '));
});

t('une priorité atteinte dans la journée rend sa réserve', () => {
  // Sans le ménage, l'objectif survivrait à sa cible et retiendrait encore,
  // son échéance passée, le coût entier jusqu'au bout de l'horizon.
  const p = app(s => { s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:6}]; }).simulateDay();
  const prioG = s => s.goals.some(g => g.key.startsWith('prio:'));
  assert.ok(p.sessions.some(prioG), 'la priorité a bien épargné');
  assert.ok(p.sessions.flatMap(s => s.acts).some(a => a.kind === 'b' && a.k === 'lab' && a.lvl === 6),
    'et le Labo 6 est posé');
  assert.ok(!prioG(p.sessions[p.sessions.length - 1]), 'elle ne retient plus rien ensuite');
});

t('sur le centre, une priorité de recherche posée avant tient le rang', () => {
  const g = app(s => { s.prio = [
    {kind:'t', k:'plasma', lvl:4},
    {kind:'b', pid:'mere', k:'lab', lvl:10}]; s.tech.energy = 8; });
  assert.equal(g.prioOf(g.labPlanet().id).kind, 't', 'la file ignore les kind');
  const p = g.simulateDay();
  assert.ok(!p.sessions[0].acts.some(a => a.kind === 'b' && a.k === 'lab'));
  // Tenir le rang n'est pas se taire : c'est la recherche qui parle, par la
  // feuille de route, et le labo attend son tour.
  assert.ok(p.sessions[0].acts.some(a => a.kind === 't' && /priorité/i.test(a.why || '')),
    'la priorité de recherche, elle, agit');
});

t('sur le centre, une priorité de bâtiment posée avant fait attendre la recherche', () => {
  // Le miroir du test ci-dessus : la file ignore les kind dans les deux sens,
  // et `prioOf` en est le seul arbitre.
  const g = app(s => { s.prio = [
    {kind:'b', pid:'mere', k:'lab', lvl:10},
    {kind:'t', k:'plasma', lvl:4}]; s.tech.energy = 8; });
  assert.ok(!/priorité/i.test(g.nextResearch().list[0].why),
    'la feuille de route garde la tête : ' + g.nextResearch().list[0].why);
});

/** Les deux priorités de la mesure : la colonie posée la première, de quoi
    remplir trois grands transporteurs, et la mère qui épargne de son côté. */
const deuxPrios = s => {
  s.planets[1].stock = {m:60000, c:30000, d:0, at:SOIR};
  s.planets[1].ships = {lc:3};
  s.prio = [{kind:'b', pid:'colo', k:'metal', lvl:12},
            {kind:'b', pid:'mere', k:'lab', lvl:10}];
};

t('deux planètes, deux priorités : les transports vont à la première posée', () => {
  const p = app(deuxPrios).simulateDay();
  const g = p.sessions[0].goals.filter(x => x.key.startsWith('prio:'));
  assert.equal(g.length, 2, 'les deux épargnent chez elles');
  assert.equal(g.find(x => x.rang === 0).label.slice(0, 5), 'Métal',
    'l\'ordre de pose décide du rang, et le rang décide de la destination');
});

t('deux priorités ne font partir aucun transport croisé', () => {
  /* Le défaut : chacune devenait la destination de l'autre. Onze vols sur
     l'horizon au lieu de deux, dont des paires simultanées — deux emplacements
     de flotte, du deutérium brûlé, et l'épargne des deux planètes vidée. */
  const g = app(deuxPrios), p = g.simulateDay();
  const ou = c => g.S.planets.findIndex(x => x.coords === c);
  for (const [i, s] of p.sessions.entries()) {
    const vols = s.acts.filter(a => a.kind === 'transfer').map(a => [a.p, ou(a.dest)]);
    for (const [de, vers] of vols)
      assert.ok(!vols.some(([d2, v2]) => d2 === vers && v2 === de),
        `session ${i} : ${vols.map(v => v.join('→')).join(' et ')}`);
  }
  assert.ok(p.sessions.some(s => s.acts.some(a => a.kind === 'transfer')),
    'et la fixture fait bien voler quelque chose');
});

t('la planète qui déborde garde la réserve de sa priorité', () => {
  /* Un hangar à 70 % déclenche le rapatriement du surplus, et il se calculait
     sans l'épargne : la planète expédiait la réserve de la priorité qu'elle
     était en train de servir. La mère déborde de métal (125 k pour 37 500 que
     la règle du surplus lui laisse) : sans sa réserve, elle en enverrait
     exactement 87 500. */
  const p = app(deuxPrios).simulateDay();
  const a = p.sessions[0].acts.find(x => x.kind === 'transfer' && x.p === 0);
  assert.ok(a, 'la mère expédie bien son surplus');
  assert.ok(a.res[0] > 0 && a.res[0] < 87500, 'métal envoyé : ' + a.res[0]);
});

/** Trois planètes : la mère, qui ne porte aucune priorité et déborde, et deux
    colonies qui en portent chacune une. La mère n'est pas bridée, sans quoi le
    secours déciderait des destinations à la place de l'ordre de pose. */
const troisPrios = s => {
  const clone = JSON.parse(JSON.stringify(s.planets[1]));
  s.planets.push(Object.assign(clone, {id:'c2', coords:'1:142:4', name:'Seconde colonie', ships:{lc:3}}));
  s.planets[1].ships = {lc:3};
  s.planets[0].b.solar = 25;
  s.planets[0].ships = {lc:20, sc:6, pr:4};
  s.prio = [{kind:'b', pid:'c2', k:'metal', lvl:12},
            {kind:'b', pid:'colo', k:'crystal', lvl:12}];
};

t('à chaque session, les rapatriements vont vers la priorité posée en premier', () => {
  /* L'ordre du tableau `goals` ne pouvait pas porter cette promesse : la clé
     d'une priorité change dès que son pas avance, et le nouvel objectif part en
     fin de tableau. La destination tournait alors d'une session à l'autre.
     Trois planètes, parce qu'à deux la question ne se pose pas : il n'y a
     qu'une autre planète où aller. */
  const p = app(troisPrios).simulateDay();
  const vols = p.sessions.flatMap((s, i) => s.acts.filter(a => a.kind === 'transfer').map(a => [i, a]));
  assert.ok(vols.length >= 2, 'des vols partent : ' + vols.length);
  assert.ok(vols.some(([i]) => i > 0), 'et pas tous à la première session');
  for (const [i, a] of vols)
    assert.equal(a.dest, '1:142:4', `session ${i} : ${a.what}`);
});

t('le bloc dit laquelle des priorités reçoit les rapatriements', () => {
  const g = app(troisPrios);
  const h = g.prioHtml();
  assert.equal((lu(h).match(/rapatriements de l'empire vont vers elle/g) || []).length, 1,
    'une seule ligne le dit : ' + h);
  assert.match(h.split('</li>')[0], /Métal 12[\s\S]*rapatriements/,
    'et c\'est celle que le joueur a posée la première');
});

t('la première priorité d\'une planète bloquée garde son rang', () => {
  /* Sur toute la journée : la session 0 ne prouve rien, la centrale de secours
     de la mère la mange. Sans le dédoublonnage par planète, la seconde se met
     à agir et le Labo sort. */
  const p = app(s => { s.prio = [
    {kind:'b', pid:'mere', k:'nanite', lvl:1},
    {kind:'b', pid:'mere', k:'lab', lvl:10}]; }).simulateDay();
  for (const [i, s] of p.sessions.entries()) {
    assert.ok(!s.acts.some(a => a.kind === 'b' && a.k === 'lab'),
      'la seconde n\'agit pas tant que la première est posée (session ' + i + ')');
    assert.ok(!s.goals.some(g => g.key.startsWith('prio:mere:lab')),
      'et elle n\'épargne pas non plus (session ' + i + ')');
  }
});

/* ---------- une priorité de recherche ---------- */

/** Les trois prérequis de Plasma, pour que le pas lançable soit Plasma lui-même
    et non un prérequis : `resolveTech` rend le premier niveau qui manque. */
const prePlasma = s => { s.tech.energy = 8; s.tech.laser = 10; s.tech.ion = 5; };

t('une priorité de recherche prend la tête de la feuille de route', () => {
  const g = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:4}]; });
  const nr = g.nextResearch();
  assert.equal(nr.list[0].k, 'energy', 'le prérequis d\'abord, par resolveTech');
  assert.ok(nr.list[0].crit);
});

t('un plafond « tête » ne double pas une priorité', () => {
  // toutes les planètes prises : Astrophysique s'unshift aujourd'hui
  const g = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:4}];
    prePlasma(s); s.tech.astro = 1; });
  assert.equal(g.nextResearch().list[0].k, 'plasma');
});

t('la priorité de recherche dit pourquoi elle est là', () => {
  const g = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:4}]; s.tech.energy = 8; });
  assert.match(g.nextResearch().list[0].why, /priorité/i);
});

t('une Astrophysique que le joueur pose ne se saute pas', () => {
  /* La feuille de route saute ses paliers d'Astrophysique tant qu'un emplacement
     de planète est libre — une colonie vaut mieux. Celui que le joueur pose, lui,
     passe quand même : le copilote obéit sans juger, et une priorité sautée
     serait muette. */
  const g = app(s => { s.prio = [{kind:'t', k:'astro', lvl:5}]; });
  const nr = g.nextResearch();
  assert.equal(nr.list[0].k, 'astro');
  assert.match(nr.list[0].why, /priorité/i);
});

t('une Astrophysique du joueur garde sa phrase, et ne s\'accuse pas de se déplacer', () => {
  /* La priorité *est* le plafond « tête » : le texte du plafond s'ajoute à sa
     phrase au lieu de l'écraser — sinon la carte perd « tu l'as mise en
     priorité » — et rien n'est déplacé, donc elle ne dit pas qu'une planète
     attend à cause d'elle. `astro 1` arme le plafond : les deux emplacements que
     ce niveau ouvre sont pris. */
  const g = app(s => { s.prio = [{kind:'t', k:'astro', lvl:5}]; s.tech.astro = 1; });
  assert.equal(g.maxPlanets(), g.S.planets.length, 'le plafond des planètes est bien armé');
  const why = g.nextResearch().list[0].why;
  assert.match(why, /priorité/i, why);
  assert.match(why, /Autorisera une/, 'le plafond s\'ajoute à la phrase de la priorité');
  assert.ok(!/attend : tu as mis/.test(why), 'et elle ne se déplace pas elle-même : ' + why);
});

t('un plafond « tête » qui n\'est pas déjà dans la liste ne passe pas devant non plus', () => {
  /* Passé le dernier palier d'Astrophysique de la feuille de route, le plafond
     des planètes n'a plus d'entrée où se fondre : il s'insère. C'est l'autre
     chemin de `garde`, et sans lui `nr.list[0]` est l'Astrophysique — la
     priorité redevient inerte, et la phrase qui dit ce qu'elle déplace s'écrit
     sur une carte que rien n'affiche. */
  const g = app(s => {
    // quatre planètes pour qu'Astrophysique 6 les ait toutes ouvertes, et un
    // plan « flotte » dont les deux paliers d'astro sont dépassés
    const clone = (id, co) => Object.assign(JSON.parse(JSON.stringify(s.planets[1])), {id, coords:co});
    s.planets.push(clone('c2', '1:142:4'), clone('c3', '1:142:5'));
    s.day.focus = 'fleet'; s.tech.astro = 6; prePlasma(s);
    s.prio = [{kind:'t', k:'plasma', lvl:4}];
  });
  assert.equal(g.maxPlanets(), g.S.planets.length, 'les emplacements sont tous pris');
  const nr = g.nextResearch();
  const vue = nr.list.map(x => x.k + ' ' + x.lvl).join(', ');
  assert.equal(nr.list[0].k, 'plasma', 'liste : ' + vue);
  assert.ok(nr.list.some(x => x.k === 'astro'), 'et le plafond est bien là, derrière : ' + vue);
});

t('la priorité de recherche dit la planète qu\'elle fait attendre', () => {
  /* Le palier d'Astrophysique chassé de la tête n'a aucune ligne à lui : au-delà
     de `list[0]`, rien de `nextResearch` ne s'affiche. C'est donc la carte de la
     priorité qui chiffre ce qu'elle coûte. */
  const g = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:4}];
    prePlasma(s); s.tech.astro = 1; });
  const nr = g.nextResearch();
  assert.match(nr.list[0].why, /planète de plus attend : tu as mis/, nr.list[0].why);
  assert.match(nr.list[0].why, /Plasma 4/, 'et elle nomme la cible que le joueur a posée');
});

t('sans centre, la priorité de recherche épargne sur le plus haut labo', () => {
  /* Plasma 5 coûte 64 k de cristal pour 60 k en caisse : l'objectif se pose au
     lieu de partir tout de suite, et il tient dans les hangars de la mère —
     c'est le cas d'à côté qui en sort. Sans priorité, la tête de la feuille de
     route est Ordinateur 3, payable et non critique : aucun objectif de
     recherche ne s'ouvrait. */
  const p = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:5}];
    prePlasma(s); s.tech.plasma = 4; }).simulateDay();
  const g = p.sessions[0].goals[0];
  assert.ok(g, 'un objectif est ouvert');
  assert.match(g.label, /Plasma/);
  assert.ok(p.sessions[0].waits.some(w => w.kind === 't' && w.p === 0),
    'et c\'est le plus haut labo qui attend');
  /* La mère est aussi la première planète : l'assertion ci-dessus passerait
     avec la règle « la première planète ». Le même cas, le labo le plus haut
     posé sur la colonie, est le seul qui distingue les deux — ses hangars et
     son stock sont montés pour que Plasma 5 y tienne, sinon c'est le hangar
     qui parlerait et plus la recherche. */
  const q = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:5}];
    prePlasma(s); s.tech.plasma = 4;
    s.planets[1].b.lab = 6; s.planets[1].b.smetal = 4;
    s.planets[1].b.scrystal = 4; s.planets[1].b.sdeut = 4;
    s.planets[1].stock = {m:20000, c:30000, d:5000, at:SOIR}; }).simulateDay();
  assert.equal(q.sessions[0].goals[0].p, 1, 'l\'objectif passe sur la colonie');
  assert.ok(q.sessions[0].waits.some(w => w.kind === 't' && w.p === 1),
    'et c\'est elle qui attend');
});

t('la priorité de recherche épargne pour le pas lançable, pas pour la cible lointaine', () => {
  /* Plasma 12 demande 8,2 M de cristal, mais il reste Laser 1 à faire, à 200 de
     métal : prendre le prix de la cible ferait épargner pour un Hangar C 11 des
     mois avant qu'il serve, et gèlerait le centre pour rien. Le pas que
     `resolveTech` a choisi est le seul prix du moment. */
  const p = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:12}];
    s.tech.energy = 8; }).simulateDay();
  assert.ok(p.sessions[0].acts.some(a => a.kind === 't' && a.k === 'laser'),
    'Laser 1 part tout de suite');
  const s0 = p.sessions[0].acts.concat(p.sessions[0].waits);
  assert.ok(!s0.some(a => ['smetal', 'scrystal', 'sdeut'].includes(a.k)),
    'et aucun hangar n\'est réclamé pour un prix qui n\'est pas encore au programme');
});

t('une priorité de recherche qui épargne n\'accepte pas un second objectif', () => {
  /* `reserveOf` additionne les objectifs d'une planète : deux réserves sur le
     centre et il n'achète plus rien jusqu'à ce que les deux soient payables.
     L'objectif d'une priorité de recherche porte la clé `t:`, pas `prio:` —
     reconnaître le joueur à la clé laissait le vaisseau de colonisation poser
     la sienne à côté. Le stock ne paie ni Plasma 5 (32 k / 64 k / 16 k) ni le
     vaisseau (10 k / 20 k / 10 k) : les deux voudraient épargner. */
  const p = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:5}];
    prePlasma(s); s.tech.plasma = 4;
    s.planets[0].stock = {m:20000, c:40000, d:5000, at:SOIR}; }).simulateDay();
  assert.deepEqual(p.sessions[0].goals.map(g => g.key), ['t:plasma5'],
    'la priorité épargne, seule');
});

t('la place de la priorité de recherche est gardée avant même qu\'elle épargne', () => {
  /* Un labo en chantier fait sortir `tryResearch` avant tout : l'objectif de la
     priorité n'est pas encore posé. Rien ne lâchant un objectif avant qu'il soit
     payé, celui que le vaisseau de colonisation poserait ici tiendrait la réserve
     pour des jours, et la priorité s'ajouterait par-dessus. La place se garde
     donc à la priorité vivante, pas à l'objectif déjà posé. */
  const p = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:5}];
    prePlasma(s); s.tech.plasma = 4;
    s.planets[0].stock = {m:20000, c:40000, d:5000, at:SOIR};
    s.timers = [{id:'b1', kind:'b', pid:'mere', k:'lab', lvl:6, end:SOIR + 3 * 3600e3}]; }).simulateDay();
  assert.deepEqual(p.sessions[0].goals.map(g => g.key), [],
    'aucun objectif ne prend la place');
});

t('une priorité de recherche trop chère pour le hangar fait sortir le hangar', () => {
  /* Plasma 6 demande 128 k de cristal, le Hangar C 3 de la mère en loge 75 k :
     `wait` rendrait Infinity, `setGoal` null, et la priorité disparaîtrait sans
     un mot. Elle fait un pas de côté et commence par le hangar. Le métal, lui,
     tient (64 k) : c'est bien le cristal qui parle. */
  const p = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:6}];
    prePlasma(s); s.tech.plasma = 5; }).simulateDay();
  const s0 = p.sessions[0];
  const h = s0.acts.concat(s0.waits).find(a => a.k === 'scrystal');
  assert.ok(h, 'le hangar de cristal est demandé dès la première session');
  // Le niveau suivant, le seul que le jeu accepte de construire depuis 3.
  assert.equal(h.what, 'Hangar de cristal 4', 'vu : ' + h.what);
  assert.match(h.why || '', /priorité/i, 'et il dit pour quelle priorité');
});

/* ---------- une carte en attente dit ce qui la retient ---------- */

/* Le Labo 6 de la mère est la priorité : son objectif épargne sur la mère, qui
   porte aussi le labo. Énergie 4 (6,4 k de cristal, 3,2 k de deutérium) est
   payable avec le stock de la fixture seul, mais pas au-delà de la réserve :
   la recherche attend à cause de la priorité, et de rien d'autre. */
t('la recherche retenue par une priorité le dit', () => {
  const w = app(prioLabo).simulateDay().sessions[0].waits.find(x => x.kind === 't');
  assert.ok(w, 'la recherche attend');
  assert.ok(w.held, 'elle est retenue');
  assert.equal(w.heldBy, 'Labo 6');
});

t('sans priorité, la même recherche part au lieu d\'attendre', () => {
  // garde de la fixture : c'est bien la réserve de la priorité qui la retenait
  const s0 = app().simulateDay().sessions[0];
  assert.ok(s0.acts.some(a => a.kind === 't' && a.k === 'energy'), 'Énergie 4 part');
  assert.ok(!s0.waits.some(x => x.kind === 't'));
});

t('une recherche qui attend le stock, sans réserve, ne nomme personne', () => {
  const w = app(s => { s.planets[0].stock = {m:0, c:0, d:0, at:SOIR}; })
    .simulateDay().sessions[0].waits.find(x => x.kind === 't');
  assert.ok(w, 'la recherche attend');
  assert.equal(w.heldBy, '');
  assert.ok(!w.held);
});

t('la recherche qui épargne pour elle-même ne se dit pas retenue par elle-même', () => {
  // Plasma 5 (64 k de cristal pour 60 k) pose son propre objectif sur la mère
  const s0 = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:5}];
    prePlasma(s); s.tech.plasma = 4; }).simulateDay().sessions[0];
  assert.deepEqual(s0.goals.map(g => g.key), ['t:plasma5'], 'l\'objectif est posé');
  const w = s0.waits.find(x => x.kind === 't');
  assert.ok(w, 'la recherche attend');
  assert.equal(w.heldBy, '');
});

t('une recherche non critique, qui n\'épargne qu\'après quatre heures, ne se nomme pas elle-même', () => {
  /* Stock vide : Énergie 4 n'est pas critique, son objectif naît pour la
     première fois en phase « post » de la session où l'attente atteint quatre
     heures — `mine` est alors encore vide. Le vaisseau de colonisation retient
     aussi la mère : lui seul doit être nommé. */
  const p = app(s => { s.planets[0].stock = {m:0, c:0, d:0, at:SOIR}; }).simulateDay();
  const i = p.sessions.findIndex(x => x.goals.some(g => g.label === 'Technologie Énergie 4'));
  assert.ok(i > 0, 'l\'objectif naît après la première session');
  const w = p.sessions[i].waits.find(x => x.kind === 't');
  assert.ok(w && w.heldBy, 'la recherche est retenue par autre chose');
  assert.ok(!/Énergie 4/.test(w.heldBy), w.heldBy);
});

t('le bâtiment retenu par la réserve d\'une priorité nomme laquelle', () => {
  // Mine de cristal 13 est retenue par la réserve du Labo 7 (4e session)
  const w = app(prioLabo).simulateDay().sessions[4].waits.find(x => x.kind === 'b' && x.k === 'crystal');
  assert.ok(w && w.held, 'la mine est retenue');
  assert.equal(w.heldBy, 'Labo 7');
});

t('la carte en attente écrit ce que la priorité retient', () => {
  const g = app(prioLabo);
  g.REFRESH.today();
  assert.match(g.html().tdNow, /Retenu : tu épargnes pour Labo 6\./);
});

t('sans retenue, la carte n\'écrit pas « Retenu »', () => {
  const g = app(s => { s.planets[0].stock = {m:0, c:0, d:0, at:SOIR}; });
  g.REFRESH.today();
  assert.ok(/class="wait"/.test(g.html().tdNow), 'des cartes attendent');
  assert.ok(!/Retenu/.test(g.html().tdNow));
});

/* ---------- le joueur pose et retire ---------- */
const prio2 = s => { s.prio = [
  {kind:'b', pid:'mere', k:'lab', lvl:10},
  {kind:'b', pid:'mere', k:'metal', lvl:20}]; };

t('la grille des niveaux porte un champ de niveau visé', () => {
  assert.match(app().VIEWS.planets(), /data-prio="lab"/);
});

t('la table des recherches porte un champ de niveau visé', () => {
  assert.match(app().VIEWS.research(), /data-prio="plasma"/);
});

t('la colonne « Visé » reste atteignable dans un volet étroit', () => {
  /* Mesuré dans le navigateur à 380 px : le nom de technologie sur une seule
     ligne prenait 231 px et repoussait la colonne au-delà du bord visible — la
     seule commande qui pose une priorité de recherche était injoignable. Le
     repli du nom tient aux deux bouts : la table le demande par sa classe, la
     feuille de style le donne. */
  assert.match(app().VIEWS.research(), /<table class="tech">/);
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'panel.css'), 'utf8');
  assert.match(css, /table\.tech td:first-child[^}]*white-space:normal[^}]*max-width/);
});

t('le champ affiche le niveau visé par la priorité posée, et seulement celui-là', () => {
  const h = app(prioLabo).VIEWS.planets();
  assert.match(h, /data-prio="lab"[^>]*value="10"/);
  assert.match(h, /data-prio="metal"[^>]*value=""/);
});

t('une priorité de la mère n\'emplit pas le champ de la colonie', () => {
  /* Même bâtiment sur deux planètes : seul le champ de la planète visée porte
     la valeur, et l'attribut data-pid dit à quelle planète il répond. */
  const h = app(prioLabo).VIEWS.planets();
  assert.equal((h.match(/data-prio="lab"[^>]*value="10"/g) || []).length, 1);
  assert.match(h, /data-pid="mere" data-prio="lab"/);
});

t('le bloc nomme la planète, la cible et celle qui attend son tour', () => {
  const h = app(prio2).prioHtml();
  assert.match(h, /Planète mère/);
  assert.match(h, /Labo 10/);
  assert.match(h, /attend son tour/);
  // Le bouton porte l'espèce et l'identité de sa ligne, plus un rang.
  assert.match(h, /data-prio-del="b\|mere\|lab"/);
  assert.match(h, /data-prio-del="b\|mere\|metal"/);
});

t('une seule attend son tour : celle qui agit dit ce que le plan en fait', () => {
  const h = app(prio2).prioHtml();
  assert.equal((h.match(/attend son tour/g) || []).length, 1);
  assert.match(h.split('</li>')[0], /Elle épargne pour Labo 6/,
    'la première dit l\'épargne que le plan a ouverte : ' + h);
});

t('une priorité que rien ne sert ne s\'annonce pas en tête', () => {
  /* L'état venait du rang dans la liste : la première de chaque planète
     annonçait qu'elle passait en premier, même quand le plan ne faisait rien
     pour elle. C'est l'anti-objectif retourné — plus le silence, mais le
     contraire du vrai. Ici le labo manque pour la recherche posée. */
  const h = app(s => { s.prio = [{kind:'t', k:'shielding', lvl:1}]; }).prioHtml();
  assert.match(h, /Laboratoire de recherche 6 manque/, h);
  assert.doesNotMatch(h, /épargne|passe en premier/i, h);
});

t('une priorité de recherche dont le labo manque le dit sur une carte', () => {
  /* `resolveTech` sait que le labo manque, la priorité n'entre alors dans
     aucune liste, et le `continue` était muet : la seule carte du jour était
     le laboratoire, que rien ne reliait à ce que le joueur avait posé. */
  const g = app(s => { s.prio = [{kind:'t', k:'shielding', lvl:1}]; });
  const w = g.simulateDay().sessions[0].waits.find(x => x.kind === 't' && x.k === 'shielding');
  assert.ok(w, 'la priorité a sa ligne d\'attente');
  assert.match(w.why, /Bouclier 1 en priorité/, w.why);
  assert.match(w.why, /Laboratoire de recherche 6 manque/, w.why);
  g.REFRESH.today();
  assert.match(g.html().tdNow, /Laboratoire de recherche 6 manque/, 'et la carte l\'écrit');
});

t('la carte d\'une priorité de recherche qui épargne dit qu\'elle en est une', () => {
  /* Sans le pourquoi sur la ligne d'attente, la seule phrase de la journée au
     sujet d'une priorité de recherche était l'heure à laquelle les ressources
     seraient réunies. */
  const g = app(s => { s.prio = [{kind:'t', k:'astro', lvl:5}]; });
  const w = g.simulateDay().sessions[0].waits.find(x => x.kind === 't');
  assert.ok(w, 'la recherche attend');
  assert.match(w.why || '', /priorité/i, 'vu : ' + w.why);
  g.REFRESH.today();
  assert.match(g.html().tdNow, /en priorité/, 'et la carte l\'écrit');
});

t('le vaisseau de colonisation repoussé par une priorité dit ce qui le retient', () => {
  /* C'est la carte que la priorité écarte le plus souvent : sans `heldBy`, le
     chantier était repoussé toute la journée sans un mot. */
  const g = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:5}];
    prePlasma(s); s.tech.plasma = 4;
    s.planets[0].stock = {m:20000, c:40000, d:5000, at:SOIR}; });
  const w = g.simulateDay().sessions[0].waits.find(x => x.kind === 'ship');
  assert.ok(w, 'le vaisseau attend');
  assert.ok(w.held, 'et il est retenu');
  assert.match(w.heldBy, /Plasma 5/, 'par la priorité : ' + w.heldBy);
});

t('render() compacte les priorités avant de dessiner', () => {
  /* Une priorité atteinte doit quitter le stockage, et `prios()` n'écrit rien :
     c'est `prioClean()`, appelé au rendu, qui le fait. Rien ne le tenait. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /function render\(\)\{\s*prioClean\(\);/);
});

t('sans aucune priorité, le bloc dit quand même où en poser une', () => {
  // Les deux champs vivent dans des volets repliés : un bloc vide était la
  // seule trace visible de la fonctionnalité, et il n'existait pas.
  const h = app().prioHtml();
  assert.ok(h, 'le bloc est rendu');
  assert.match(h, /Tes priorités/);
  assert.match(h, /Empire/, 'il nomme l\'onglet où aller');
  assert.match(h, /déplie/, 'il dit qu\'il faut déplier');
  assert.ok(!/data-prio-del/.test(h), 'et il ne propose rien à retirer');
});

t('les deux volets annoncent qu\'ils portent le niveau visé', () => {
  const g = app();
  assert.match(g.VIEWS.planets(), /Bâtiments et niveaux visés/);
  assert.match(g.VIEWS.research(), /Recherches et niveaux visés/);
});

const CSS = () => require('fs').readFileSync(require('path').join(__dirname, '..', 'panel.css'), 'utf8');

t('la case du centre tient sur une ligne, hors du gabarit des champs', () => {
  /* label.f empile un titre au-dessus d'un champ : la case y partait seule sur
     sa ligne, étirée par input{width:100%}, et son libellé tombait dessous. */
  const h = app().VIEWS.planets();
  assert.match(h, /<label class="f coche"><input id="pcentre-/);
  assert.doesNotMatch(h, /style="width:auto"><input id="pcentre-/);
  const css = CSS();
  assert.match(css, /label\.f\.coche\{[^}]*flex-direction:row/, 'la case et son libellé côte à côte');
  assert.match(css, /label\.f\.coche input\{[^}]*width:auto/, 'et la case à sa taille');
  /* La pastille de vocation et sa raison ne sont plus enfants de .row : sans
     règle propre, l'espacement de la rangée ne les atteint plus et la raison
     vient se coller à la pastille. */
  assert.match(h, /<span class="voc" id="pvoc-/);
  assert.match(css, /\.voc\{[^}]*gap:8px/, 'la raison garde ses distances');
});

t('le volet des niveaux se donne pour ce qu\'il est : un réglage qu\'on ouvre', () => {
  /* Sans classe il ne touchait aucune règle : triangle du navigateur et douze
     pixels de gris, rien qui dise qu\'on règle quelque chose derrière. */
  const h = app().VIEWS.planets();
  assert.match(h, /<details class="volet"><summary data-fold="niv:mere">/);
  /* Un render() le refermait sous les doigts du joueur : il retient son état,
     comme les volets d'Aujourd'hui. */
  const ouvert = app(s2 => { s2.ui.fold = { 'niv:mere': true }; }).VIEWS.planets();
  assert.match(ouvert, /<details class="volet" open><summary data-fold="niv:mere">/);
  const css = CSS();
  assert.match(css, /details\.volet>summary\{[^}]*cursor:pointer/);
  assert.match(css, /details\.volet>summary::after\{content:"Ouvrir \+"/, 'il dit qu\'il s\'ouvre');
  assert.match(css, /details\.volet\[open\]>summary::after\{content:"Fermer/, 'et qu\'il se ferme');
});

t('le compteur du niveau visé part du niveau en place, pas de 1', () => {
  /* Partir de 1 obligeait à retaper le niveau entier, et proposait d'abord des
     niveaux déjà atteints — que prioPose jette aussitôt. */
  const g = app(s2 => { s2.planets[0].b.lab = 5; s2.tech.plasma = 7;
    s2.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } }; });
  const h = g.VIEWS.planets();
  assert.match(h, /min="6" data-pid="mere" data-prio="lab"/, 'un bâtiment');
  assert.match(h, /min="4" data-pid="mere" data-prio="11101" data-kind="lf"/, 'une forme de vie');
  assert.match(g.VIEWS.research(), /min="8" data-prio="plasma"/, 'une recherche');
});

/* Le stock a maintenant son propre volet : son nom est le titre de ce volet,
   donc visible même fermé, et ses trois valeurs l'accompagnent. C'est plus que
   ce que le libellé en gras donnait, qui ne se voyait qu'une fois ouvert. */
t('le stock dit son nom dans le titre de son volet, et son sens juste au-dessus de sa grille', () => {
  const h = app().VIEWS.planets();
  assert.match(h, /<summary data-fold="stock:[^"]*">Stock /);
  assert.match(h, /Ce que cette planète a en magasin/);
  assert.doesNotMatch(h, /stock et niveaux visés/, 'le titre des bâtiments ne le porte toujours pas');
});

t('l\'écho de notre propre écriture ne redessine pas la vue', () => {
  /* syncApply compare au JSON, qui dépend de l'ordre des clés : reconstruite
     dans un autre ordre, notre propre priorité revenait méconnaissable du
     stockage partagé, et render() refermait le volet toutes les dix secondes. */
  const g = app(s2 => { s2.planets[0].gid = '33701';
    s2.prio = [{ kind: 'b', pid: 'mere', k: 'lab', lvl: 10 }]; });
  const avant = JSON.stringify(g.S.prio);
  g.syncApply(g.syncOut());
  assert.equal(JSON.stringify(g.S.prio), avant, 'rien à réécrire, donc rien à redessiner');
});

t('une priorité posée sur l\'autre poste ne reste pas invisible', () => {
  /* Elle désigne sa planète par le gid tant que le relevé d'ici ne l'a pas
     nommée : prios() ne la rend pas, le champ d'Empire reste vide, et jusqu'ici
     rien ne la montrait nulle part. */
  const g = app(s2 => { s2.planets[0].gid = '33701';
    s2.prio = [{ kind: 'b', k: 'lab', lvl: 10, gid: '99999' }]; });
  assert.deepEqual(g.prios(), [], 'aucune planète d\'ici ne la porte');
  const h = g.prioHtml();
  assert.match(h, /Autre poste/);
  assert.match(h, /Labo 10/);
  g.prioClean();
  assert.equal(g.S.prio.length, 1, 'et le nettoyage ne la jette pas');
});

t('une priorité venue de l\'autre poste se retire comme les autres', () => {
  const g = app(s2 => { s2.planets[0].gid = '33701';
    s2.prio = [{ kind: 'b', k: 'lab', lvl: 10, gid: '99999' }]; });
  assert.match(g.prioHtml(), /data-prio-del="gid\|99999\|lab"/);
  g.prioRetire('gid|99999|lab');
  assert.deepEqual(g.S.prio, []);
});

t('les cases de forme de vie relevées entrent dans la grille des niveaux', () => {
  const g = app(s => { s.planets[0].lf = { 11102: { lvl: 7, state: 'ok' }, 11101: { lvl: 3, state: 'ok' } }; });
  const h = g.VIEWS.planets();
  /* Dans l'ordre du jeu : les clés entières s'énumèrent en ordre croissant,
     quel que soit l'ordre où le relevé les a posées. */
  assert.ok(h.indexOf('Secteur résidentiel') < h.indexOf('Ferme biosphérique'), 'rangées par identifiant');
  assert.match(h, /Secteur résidentiel<span class="lv"><input type="number" value="3" readonly/, 'niveau relevé, non saisi');
  assert.match(h, /data-pid="mere" data-prio="11102" data-kind="lf"/, 'et son champ de niveau visé');
  /* Sous leur nom : mêlées aux bâtiments, elles étaient là sans se trouver. */
  assert.ok(h.indexOf('<b>Formes de vie</b>') < h.indexOf('Secteur résidentiel'), 'la grille porte son titre');
});

t('le champ de niveau visé d\'une forme de vie montre la priorité posée', () => {
  const g = app(s => { s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } };
    s.prio = [{ kind: 'lf', pid: 'mere', k: 11101, lvl: 6 }]; });
  assert.match(g.VIEWS.planets(), /data-prio="11101" data-kind="lf" value="6"/);
});

t('une planète dont aucune case n\'est relevée le dit au lieu de se taire', () => {
  const g = app(s => { for (const p of s.planets) p.lf = {}; });
  const h = g.VIEWS.planets();
  assert.match(h, /<b>Formes de vie<\/b> — aucune case de forme de vie relevée ici/);
  assert.doesNotMatch(h, /data-kind="lf"/, 'et pas de grille vide');
});

t('relire un niveau visé de forme de vie demande un entier, pas la chaîne du DOM', () => {
  /* Pourquoi le gestionnaire convertit : l'attribut d'une tuile se lit en
     chaîne, et priosLf() ne range que des entiers. Sans la conversion, le champ
     se viderait sous les doigts du joueur à l'instant où il pose. */
  const g = app(s => { s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } }; });
  g.prioPose('lf', 'mere', '11101', '6');
  assert.equal(g.prioLvl('lf', 'mere', 11101), 6);
  assert.equal(g.prioLvl('lf', 'mere', '11101'), '', 'la chaîne ne retrouve rien');
});

/* ---------- ce qui vient de la page du jeu est une valeur de frontière ---------- */
t('une apostrophe ne referme plus un attribut à apostrophes', () => {
  /* data-launch est écrit entre apostrophes, et « Tour d'habitation » est dans
     notre propre table de noms : le JSON s'y coupait en deux. Le bouton
     « Lancé » mourait sur la carte, et la fin du nom se lisait comme des
     attributs — un nom de planète bien choisi y posait ce qu'il voulait. */
  const g = app();
  assert.equal(g.esc("Tour d'habitation"), 'Tour d&#39;habitation');
  const charge = JSON.stringify({ what: "Tour d'habitation 5" });
  const html = `<button data-launch='${g.esc(charge)}'>Lancé</button>`;
  const dedans = html.match(/data-launch='([^']*)'/)[1];
  assert.deepEqual(JSON.parse(lu(dedans)), { what: "Tour d'habitation 5" }, 'le JSON traverse entier');
});

t('un nom relevé sur la page du jeu est plafonné, à la lecture et à la fusion', () => {
  /* Même règle que pour le nom qu'une demande apporte : ce que la page du jeu
     écrit n'a pas de longueur promise, et il finit dans le stockage. */
  const long = 'A'.repeat(500);
  const p2 = runPage({ search: '?page=ingame&component=lfbuildings', planetId: '33701',
    tiles: [12101], niveaux: { 12101: 1 }, noms: { 12101: long } });
  assert.equal(p2.envois()[0].data.lf[12101].nom.length, 80, 'à la lecture');
  assert.equal(app().lfMerge({}, { lvl: 1, nom: long }).nom.length, 80, 'et à la fusion');
});

/* ---------- le nom des cases de forme de vie ---------- */
t('le relevé nomme chaque case, pas seulement celle que le joueur a ouverte', () => {
  /* Le panneau de détail ne nomme que la case ouverte : onze sur douze
     restaient « Forme de vie 12103 » sous les yeux du joueur. Le nom est
     pourtant sur chaque tuile, dans sa langue. */
  const p = runPage({ search: '?page=ingame&component=lfbuildings', planetId: '33701',
    tiles: [12101, 12102], niveaux: { 12101: 38, 12102: 34 },
    noms: { 12101: 'Enclave de méditation', 12102: 'Ferme de cristal' } });
  const lf = p.envois()[0].data.lf;
  assert.equal(lf[12101].nom, 'Enclave de méditation');
  assert.equal(lf[12102].nom, 'Ferme de cristal', 'les douze, pas une');
});

t('un nom déjà connu survit à une lecture de liste qui ne le porte pas', () => {
  const g = app();
  const fondu = g.lfMerge({ lvl: 3, name: 'Enclave de méditation' }, { lvl: 4, state: 'ok' });
  assert.equal(fondu.nom, 'Enclave de méditation');
  assert.equal(fondu.lvl, 4, 'le niveau, lui, vient bien de la lecture fraîche');
});

t('la grille appelle les cases par leur nom quand le relevé le connaît', () => {
  const g = app(s2 => { s2.planets[0].lf = {
    12101: { lvl: 38, state: 'ok', nom: 'Enclave de méditation' },
    12103: { lvl: 4, state: 'ok' } }; });
  const h = g.VIEWS.planets();
  assert.match(h, /Enclave de méditation<span class="lv"/);
  assert.match(h, /Forme de vie 12103<span class="lv"/, 'et se rabat sur le numéro quand il l\'ignore');
});

/* ---------- les paliers de population ---------- */
/** Une planète roctas telle que le relevé la voit : la série, pas les noms. */
const vie = (lf, autres) => s2 => { s2.planets[0].lf = lf; if (autres) autres(s2); };
const CASES_1_2 = { 11101: { lvl: 0, state: 'ok' }, 11102: { lvl: 0, state: 'ok' } };

t('un palier vise le premier niveau, puis le second une fois celui-ci atteint', () => {
  const g = app(vie({ 11101: { lvl: 5, state: 'ok' } }));
  g.prioPalier('lf', 'mere', 11101, 21, 41);
  assert.equal(g.prioLvl('lf', 'mere', 11101), 21, 'tant que 21 n\'est pas atteint');
  g.S.planets[0].lf[11101].lvl = 21;
  assert.equal(g.prioLvl('lf', 'mere', 11101), 41, 'une fois 21 atteint');
  g.S.planets[0].lf[11101].lvl = 41;
  assert.deepEqual(g.priosLf(), [], 'et au bout, elle est accomplie');
});

t('le second palier survit au nettoyage', () => {
  /* prioClean recopiait l'entrée rendue — qui porte la cible du moment, pas le
     palier — à la place de l'entrée rangée. */
  const g = app(vie({ 11101: { lvl: 5, state: 'ok' }, 11102: { lvl: 1, state: 'ok' } }));
  g.prioPalier('lf', 'mere', 11101, 21, 41);
  g.prioPose('lf', 'mere', 11102, '4');
  assert.equal(g.S.prio.length, 2);
  /* La seconde s'accomplit en cours de route : le nettoyage réécrit la liste,
     et c'est là que le palier de la première se perdait. */
  g.S.planets[0].lf[11102].lvl = 4;
  g.prioClean();
  assert.equal(g.S.prio.length, 1, 'la case accomplie est partie');
  assert.equal(g.S.prio[0].puis, 41, 'le palier est toujours là');
});

t('corriger le champ à la main efface le palier', () => {
  const g = app(vie({ 11101: { lvl: 5, state: 'ok' } }));
  g.prioPalier('lf', 'mere', 11101, 21, 41);
  g.prioPose('lf', 'mere', 11101, '30');
  assert.equal(g.S.prio[0].lvl, 30);
  assert.equal(g.S.prio[0].puis, undefined, 'le joueur reprend la barre');
});

t('un premier palier déjà atteint vise directement le second', () => {
  const g = app(vie({ 11101: { lvl: 25, state: 'ok' } }));
  g.prioPalier('lf', 'mere', 11101, 21, 41);
  assert.equal(g.prioLvl('lf', 'mere', 11101), 41);
});

t('la préselection pose la nourriture avant la population', () => {
  const g = app(vie(CASES_1_2));
  assert.ok(g.lfPosePaliers(g.S.planets[0]));
  assert.deepEqual(g.S.prio.map(e => [e.k, e.lvl, e.puis]),
    [[11102, g.LF_PALIER.nourriture, undefined], [11101, g.LF_PALIER.population[0], g.LF_PALIER.population[1]]],
    'la nourriture d\'abord : l\'ordre de pose arbitre la précédence');
});

t('sans les deux premières cases relevées, aucune préselection n\'est proposée', () => {
  /* On ne devine pas un identifiant : viser la mauvaise case ne se verrait pas. */
  const g = app(vie({ 11103: { lvl: 2, state: 'ok' }, 11104: { lvl: 1, state: 'ok' } }));
  assert.equal(g.lfPopNourriture(g.S.planets[0]), null);
  assert.equal(g.lfPosePaliers(g.S.planets[0]), false);
  assert.deepEqual(g.S.prio, []);
  assert.doesNotMatch(g.VIEWS.planets(), /data-lfpaliers/, 'et pas de bouton');
});

t('le bouton des paliers paraît dès que les deux cases sont là', () => {
  const g = app(vie(CASES_1_2));
  assert.match(g.VIEWS.planets(), /data-lfpaliers="mere"/);
});

t('le bloc dit le palier qui attend derrière', () => {
  const g = app(vie({ 11101: { lvl: 5, state: 'ok', nom: 'Enclave de méditation' } }));
  g.prioPalier('lf', 'mere', 11101, 21, 41);
  assert.match(g.prioHtml(), /Enclave de méditation 21, puis 41/);
});

t('un palier voyage entre les postes sans réveiller le rendu', () => {
  const g = app(vie({ 11101: { lvl: 5, state: 'ok' } }, s2 => { s2.planets[0].gid = '33701'; }));
  g.prioPalier('lf', 'mere', 11101, 21, 41);
  const avant = JSON.stringify(g.S.prio);
  g.syncApply(g.syncOut());
  assert.equal(JSON.stringify(g.S.prio), avant, 'même forme à l\'aller qu\'au retour');
  assert.equal(g.S.prio[0].puis, 41, 'et le palier a fait le voyage');
});

t('en mode nuit le bloc reste lisible et ne promet rien', () => {
  const h = app(s => { s.day.night = true; prioLabo(s); }).prioHtml();
  assert.match(h, /Labo 10/);
  assert.match(h, /data-prio-del/);
  assert.doesNotMatch(h, /épargne|lancement|attend|passe en premier/i);
});

t('une priorité bloquée dit ce qui manque, avec la phrase de prioBloque', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'colo', k:'nanite', lvl:1}]; });
  const phrase = g.prioBloque(g.S.planets[1], 'nanite');
  assert.ok(phrase, 'la fixture doit réellement bloquer');
  assert.ok(g.prioHtml().includes(phrase));
});

t('une recherche se lit « Recherche » : elle n\'a pas de planète à nommer', () => {
  const h = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:3}]; }).prioHtml();
  assert.match(h, /Technologie Plasma 3/);
  assert.match(h, />Recherche</);
  assert.doesNotMatch(h, /Planète mère/);
});

t('Aujourd\'hui affiche le bloc sous les cartes', () => {
  const g = app(prioLabo);
  g.REFRESH.today();
  assert.match(g.html().tdNow, /Tes priorités/);
});

t('poser : une cible au-dessus du niveau s\'ajoute en fin de liste', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:20}]; });
  g.prioPose('b', 'mere', 'lab', '10');
  assert.deepEqual(g.S.prio.map(x => x.k), ['metal', 'lab']);
  assert.deepEqual(g.S.prio[1], {kind:'b', pid:'mere', k:'lab', lvl:10});
});

t('poser une recherche ne stocke pas de planète', () => {
  const g = app();
  g.prioPose('t', null, 'plasma', '4');
  assert.deepEqual(g.S.prio, [{kind:'t', k:'plasma', lvl:4}]);
});

t('corriger un niveau met à jour sur place et garde le rang', () => {
  const g = app(prio2);
  g.prioPose('b', 'mere', 'lab', '12');
  assert.deepEqual(g.S.prio.map(x => x.k + x.lvl), ['lab12', 'metal20']);
});

t('vider le champ retire la priorité', () => {
  const g = app(prio2);
  g.prioPose('b', 'mere', 'lab', '');
  assert.deepEqual(g.S.prio.map(x => x.k), ['metal']);
});

t('un niveau déjà atteint retire la priorité au lieu de la poser', () => {
  const g = app(prio2);
  g.prioPose('b', 'mere', 'lab', '5');   // le labo de la mère est à 5
  assert.deepEqual(g.S.prio.map(x => x.k), ['metal']);
  g.prioPose('b', 'mere', 'robot', '3'); // robots à 6 : rien à poser
  assert.deepEqual(g.S.prio.map(x => x.k), ['metal']);
});

t('un texte qui n\'est pas un nombre ne pose rien', () => {
  const g = app();
  g.prioPose('b', 'mere', 'lab', 'abc');
  assert.deepEqual(g.S.prio, []);
});

t('le même bâtiment sur deux planètes fait deux priorités distinctes', () => {
  const g = app();
  g.prioPose('b', 'colo', 'lab', '3');
  g.prioPose('b', 'mere', 'lab', '10');
  assert.deepEqual(g.S.prio.map(x => x.pid + x.lvl), ['colo3', 'mere10']);
  g.prioPose('b', 'mere', 'lab', '');
  assert.deepEqual(g.S.prio.map(x => x.pid + x.lvl), ['colo3']);
});

t('après une pose le champ dit la priorité, et se vide quand elle est retirée', () => {
  /* Le gestionnaire n'appelle plus render() : il réécrit lui-même le champ
     avec prioLvl. Cette valeur doit donc être juste après chaque geste. */
  const g = app();
  g.prioPose('b', 'mere', 'lab', '10');
  assert.equal(g.prioLvl('b', 'mere', 'lab'), 10);
  g.prioPose('b', 'mere', 'lab', '5');   // niveau déjà atteint : retirée
  assert.equal(g.prioLvl('b', 'mere', 'lab'), '');
  g.prioPose('t', null, 'plasma', '4');
  assert.equal(g.prioLvl('t', null, 'plasma'), 4);
  assert.equal(g.prioLvl('b', 'mere', 'plasma'), '', 'une recherche ne remplit aucun bâtiment');
});

t('le champ de niveau visé ne redessine pas la vue', () => {
  /* render() refermerait le <details> qui porte le champ. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  const i = src.indexOf("querySelectorAll('input[data-prio]')");
  const corps = src.slice(i, src.indexOf('\n  }));', i));
  assert.ok(!/render\(\)/.test(corps.replace(/\/\*[\s\S]*?\*\//g, '')), 'pas de render()');
  assert.match(corps, /el\.value = prioLvl\(/);
});

t('retirer par référence enlève la bonne entrée', () => {
  const g = app(prio2);
  g.prioRetire('b|mere|metal');
  assert.deepEqual(g.S.prio.map(x => x.k), ['lab']);
});

t('la référence du bouton désigne sa ligne même quand une entrée morte la précède', () => {
  /* Le labo atteint son niveau en cours de session : prios() l'écarte, mais
     S.prio ne se compacte qu'au rendu suivant. Le premier bouton du bloc doit
     retirer la mine, pas l'entrée morte qui la précède dans S.prio. */
  /* Posée après le chargement : le rendu de départ compacte S.prio et
     emporterait l'entrée morte avant que le test ne la voie. */
  const g = app(s => { s.prio = [
    {kind:'b', pid:'mere', k:'metal', lvl:20},
    {kind:'b', pid:'mere', k:'crystal', lvl:20}]; });
  g.S.prio.unshift({kind:'b', pid:'mere', k:'lab', lvl:4});
  g.prioRetire(/data-prio-del="([^"]+)"/.exec(g.prioHtml(g.simulateDay()))[1]);
  assert.deepEqual(g.S.prio.map(x => x.k), ['lab', 'crystal']);
});

t('le champ de niveau visé écoute change, jamais input', () => {
  /* Sur un labo 5, taper « 10 » passe par « 1 » : à l'écoute de input, la
     priorité serait jugée atteinte, retirée, puis recréée en fin de liste. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  const m = src.match(/querySelectorAll\('input\[data-prio\]'\)\.forEach\(el=>el\.addEventListener\('(\w+)'/);
  assert.ok(m, 'le champ est branché');
  assert.equal(m[1], 'change');
});

/* ---------- le canal des priorités vers la page du jeu ---------- */
t('prioHints publie ce que le joueur a posé, pas ce que le plan fait', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.prioHints(), {'33701': {31: 10}});
  assert.deepEqual(g.planHints([]), {}, 'planHints reste ce qu\'il était');
});

t('une priorité de recherche se montre sur la planète du labo, pas sur une autre', () => {
  const g = app(s => { s.planets[0].gid = '33701'; s.planets[1].gid = '33702'; });
  g.S.prio = [{kind:'t', k:'plasma', lvl:12}];
  assert.equal(g.labPlanet().id, 'mere', 'le labo de l\'échantillon est la mère');
  assert.deepEqual(g.prioHints(), {'33701': {122: 12}});
  g.S.centre = 'colo';
  assert.equal(g.labPlanet().id, 'colo');
  assert.deepEqual(g.prioHints(), {'33702': {122: 12}}, 'le centre déplacé, la pastille suit');
});

t('une priorité lf se montre sur sa planète, par son identifiant de tuile', () => {
  const g = app(s => { s.planets[0].gid = '33701'; s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:4}];
  assert.deepEqual(g.prioHints(), {'33701': {11101: 4}});
});

t('une planète que le jeu n\'a pas nommée ne publie rien', () => {
  const g = app(s => { s.planets[0].gid = null; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}, {kind:'lf', pid:'mere', k:11101, lvl:4}];
  assert.deepEqual(g.prioHints(), {});
});

t('une clé de planète hostile ne devient pas une clé du canal des priorités', () => {
  const g = app(s => { s.planets[0].gid = '__proto__'; s.planets[1].gid = '33702'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}, {kind:'lf', pid:'mere', k:11101, lvl:4},
    {kind:'b', pid:'colo', k:'lab', lvl:3}];
  const h = g.prioHints();
  assert.deepEqual(Object.keys(h), ['33702']);
  // sans garde, « __proto__ » n'ajoute aucune clé : il écrit dans le prototype
  assert.equal(Object.getPrototypeOf(h)[31], undefined);
  assert.equal(Object.getPrototypeOf(h)[11101], undefined);
  assert.equal(h[31], undefined);
});

t('deux priorités sur la même tuile : la première posée est publiée, comme le plan la sert', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:8}, {kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.prioHints(), {'33701': {31: 8}});
});

t('gameSkin porte le canal des priorités', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.gameSkin([], [], []).prio, {'33701': {31: 10}});
  assert.deepEqual(g.gameSkin([], [], []).hints, {}, 'hints ne porte pas la priorité');
});

/* ---------- le panneau reçoit les demandes de la page du jeu ---------- */
const D = (o) => Object.assign({gid:'33701', tech:31, nom:'Laboratoire', lvl:10, at:SOIR}, o);
const G = s => { s.planets[0].gid = '33701'; };

t('une demande devient une priorité de bâtiment', () => {
  const g = app(G);
  assert.deepEqual(g.prioDrain([D()]), [], 'rien ne reste en attente');
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
});

t('une demande de recherche n\'a pas besoin de planète connue', () => {
  const g = app(G);
  g.prioDrain([D({gid:'99999', tech:122, nom:'Plasma', lvl:12})]);
  assert.deepEqual(g.prios(), [{kind:'t', pid:'mere', k:'plasma', lvl:12}]);
});

t('une demande de forme de vie garde son identifiant de tuile', () => {
  const g = app(s => { G(s); s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.prioDrain([D({tech:11101, nom:'Habitation', lvl:4})]);
  assert.deepEqual(g.priosLf(), [{pid:'mere', k:11101, lvl:4}]);
});

t('une demande dont la planète est inconnue attend, et se laisse nommer', () => {
  const g = app(G);
  const reste = g.prioDrain([D({gid:'99999', nom:'Usine de robots', tech:14})]);
  assert.equal(reste.length, 1, 'gardée');
  assert.equal(reste[0].nom, 'Usine de robots', 'et nommable');
  assert.deepEqual(g.prios(), [], 'rien n\'est posé');
});

t('une demande gardée se pose dès que sa planète est relevée', () => {
  const g = app();
  const reste = g.prioDrain([D()]);
  assert.equal(reste.length, 1);
  g.S.planets[0].gid = '33701';
  assert.deepEqual(g.prioDrain(reste), []);
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
});

t('une demande gardée depuis plus de 24 h disparaît, une récente reste', () => {
  const g = app();
  assert.deepEqual(g.prioDrain([D({gid:'99999', at: SOIR - 25*3600*1000})]), []);
  assert.equal(g.prioDrain([D({gid:'99999', at: SOIR - 23*3600*1000})]).length, 1);
});

t('la liste gardée vit dans S : vide à neuf et sur un ancien état, rejouée au relevé', () => {
  const g = app(s => { delete s.prioAsk; });
  assert.deepEqual(g.prioDemandes(), []);
  assert.deepEqual(g.S.prioAsk, []);
  g.S.prioAsk = g.prioDrain([D()]);
  assert.equal(g.prioDemandes().length, 1);
  g.applyGame({planets:{'33701':{name:'Mère', coords:'1:142:8'}}, order:['33701']});
  assert.deepEqual(g.prioDemandes(), [], 'le relevé la place');
  assert.deepEqual(g.prios().map(x => x.k), ['lab']);
});

t('une demande malformée ne pose rien et ne lève pas', () => {
  const g = app(G);
  const sales = [null, undefined, 7, 'x', [], {}, D({tech:null}), D({lvl:'dix'}), D({lvl:2.5}), D({lvl:10.5}), D({lvl:'10'}), D({lvl:-3}), D({tech:'0x2B4D'}), D({tech:'11101abc'}),
    D({lvl:undefined}), D({gid:undefined}), D({gid:'__proto__'}), D({gid:'constructor'}), D({gid:'33701x'}),
    D({tech:'__proto__'}), D({tech:'constructor'}), D({tech:10999}), D({tech:50}), D({tech:0}), D({tech:41}), D({tech:105}), D({tech:125}),
    D({gid:'__proto__', tech:122}), D({gid:'__proto__', tech:11101})];
  // une à une : une entrée posée serait sinon retirée par la suivante, et le défaut passerait inaperçu
  for(const s of sales) {
    assert.deepEqual(g.prioDrain([s]), [], 'jetée : ' + JSON.stringify(s));
    assert.deepEqual(g.S.prio, [], 'rien posé pour ' + JSON.stringify(s));
  }
  const reste = g.prioDrain(sales);
  assert.equal(reste.length, 0, 'rien de ces entrées n\'est digne d\'être gardée');
  assert.deepEqual(g.prios(), []);
  assert.deepEqual(g.priosLf(), []);
  assert.deepEqual(g.S.prio, [], 'aucune priorité posée');
  // Object.keys est aveugle : « out.__proto__ = … » ne crée aucune clé propre
  for(const k of ['31', '122', '11101', 'lab', 'lvl', 'gid', 'k']) assert.equal(Object.prototype[k], undefined, 'Object.prototype.' + k);
  assert.equal(({})[31], undefined);
  assert.equal(({}).lvl, undefined);
});

t('deux demandes sur la même tuile n\'en font qu\'une, la dernière', () => {
  const g = app(G);
  g.prioDrain([D({lvl:9, at:1}), D({lvl:12, at:2})]);
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:12}]);
});

t('une demande rejouée avec la file gardée ne double rien', () => {
  const g = app(G);
  g.S.prioAsk = g.prioDrain([D({gid:'99999'})]);
  g.prioDrain([D(), D({lvl:12})]);
  g.prioDrain(g.prioDemandes());
  assert.equal(g.prios().length, 1);
  assert.equal(g.prioDemandes().length, 1);
});

/* ---------- le chemin que la demande parcourt : stockage -> écouteur -> S.prio ---------- */
t('un changement de stockage prioAsk pose la priorité puis efface la clé', () => {
  const g = app(G);
  g.fire({prioAsk: {newValue: [D()]}});
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
  assert.deepEqual(g.removed(), ['prioAsk'], 'clé effacée');
  assert.deepEqual(g.saved().prio, [{kind:'b', pid:'mere', k:'lab', lvl:10}], 'et sauvegardée : plus de copie côté page');
});

t('accueillir une demande republie le plan, même hors de l\'onglet Aujourd\'hui', () => {
  // l'onglet Empire : son rafraîchissement ne publie pas le plan, c'est le cas qui rendait la tuile muette
  const g = app(s => { G(s); s.__tab = 'empire'; }, SOIR, null, true);
  assert.equal((((g.stored().skin || {}).prio) || {})['33701'], undefined, 'pas de priorité publiée avant la demande');
  g.fire({prioAsk: {newValue: [D()]}});
  const skin = g.stored().skin;
  assert.ok(skin, 'la peau a été publiée');
  assert.equal(skin.prio['33701'][31], 10, 'avec la priorité qui vient d\'être posée');
});

t('une demande en attente placée par un relevé republie le plan, même sur l\'onglet Empire', () => {
  const g = app(s => { s.__tab = 'empire'; }, SOIR, null, true);
  g.S.prioAsk = [D()];
  assert.equal((((g.stored().skin || {}).prio) || {})['33701'], undefined);
  g.applyGame({ planets: { '33701': { coords: '1:142:8', b: { lab: 5 } } }, order: ['33701'] });
  assert.equal(g.stored().skin.prio['33701'][31], 10, 'la tuile voit la demande enfin placée');
});

t('le champ du volet Empire republie le plan après avoir posé', () => {
  /* On nomme view et bind pour attraper l'écouteur « change » du champ, puis on
     le déclenche : c'est le comportement qui est vérifié, pas la présence d'une
     ligne — REFRESH.empire ne publie rien, seul publieLePlan() après save() le fait. */
  const g = app(s => { G(s); s.__tab = 'empire'; }, SOIR, null, true);
  let change;
  const champ = { dataset: { pid: 'mere', prio: 'lab' }, value: '10', addEventListener: (ev, fn) => { if (ev === 'change') change = fn; } };
  g.view.querySelectorAll = sel => (sel === 'input[data-prio]' ? [champ] : []);
  g.bind();
  assert.ok(change, 'le champ écoute « change »');
  assert.equal((((g.stored().skin || {}).prio) || {})['33701'], undefined, 'rien de publié avant la saisie');
  change();
  assert.deepEqual(g.stored().skin.prio['33701'], { 31: 10 }, 'la tuile voit la priorité posée');
});

t('la minuterie de 30 s republie le plan aussi sur Empire', () => {
  /* setInterval est neutralisé dans le harnais : on épingle la source. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /REFRESH\[tab\]\(\);\s*publieLePlan\(\);\s*\}, 30000\)/);
});

t('le changement que provoque l\'effacement lui-même ne rejoue rien', () => {
  const g = app(G);
  g.fire({prioAsk: {newValue: [D()]}});
  g.fire({prioAsk: {oldValue: [D()]}});          // newValue absent : c'est le remove()
  assert.equal(g.prios().length, 1);
  assert.deepEqual(g.removed(), ['prioAsk'], 'effacée une seule fois');
});

t('une demande dont la planète est inconnue, livrée par l\'écouteur, est gardée dans S', () => {
  const g = app(G);
  g.fire({prioAsk: {newValue: [D({gid:'99999', nom:'Lune'})]}});
  assert.deepEqual(g.prios(), []);
  assert.equal(g.prioDemandes()[0].nom, 'Lune');
});

t('au démarrage, une demande déposée panneau fermé est drainée', () => {
  const g = app(G, null, null, false, [D({lvl:7})]);
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:7}]);
  assert.deepEqual(g.removed(), ['prioAsk']);
});

t('au démarrage sans demande, rien n\'est effacé ni posé', () => {
  const g = app(G);
  assert.deepEqual(g.removed(), []);
  assert.deepEqual(g.S.prio, []);
});

t('un changement d\'une autre clé ne touche pas aux priorités', () => {
  const g = app(G);
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}];
  g.fire({api: {newValue: null}});
  g.fire({pendingAlerts: {newValue: []}});
  g.fire({prioAsk: {newValue: [D()]}}, 'sync');   // autre zone de stockage
  assert.deepEqual(g.S.prio, [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
  assert.deepEqual(g.removed(), []);
});

t('boot.js transmet prioAsk à app.js, clé sans préfixe ls:', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'boot.js'), 'utf8');
  const win = {}, ask = [D()];
  const chrome = {storage: {local: {get(k, cb) { cb({'ls:x': '1', prioAsk: ask, game: null}); }, set() { return Promise.resolve(); }}}};
  const document = {createElement: () => ({}), body: {appendChild() {}}};
  new Function('window', 'chrome', 'document', src)(win, chrome, document);
  assert.deepEqual(win.__prioAsk, ask);
  assert.equal(win.__mem.x, '1');
});

/* ---------- une demande gardée ne devient jamais une suppression ---------- */
/* ---------- lvl 0 retire ; une demande satisfaite est abandonnée, jamais lue comme un retrait ---------- */
const TUILES = [['b', 31, {kind:'b', pid:'mere', k:'lab', lvl:20}], ['t', 122, {kind:'t', k:'plasma', lvl:20}],
  ['lf', 11101, {kind:'lf', pid:'mere', k:11101, lvl:20}]];
const base = s => { G(s); s.planets[0].lf = {11101:{lvl:2, state:'ok'}}; s.tech.plasma = 4; };  // lab 5, plasma 4, 11101 à 2
const courant = {31: 5, 122: 4, 11101: 2};

t('lvl 0, fraîche, retire la priorité (b, t, lf)', () => {
  for(const [, tech, pose] of TUILES){
    const g = app(base);
    g.S.prio = [Object.assign({}, pose)];
    g.prioDrain([D({tech, lvl:0})]);
    assert.deepEqual(g.S.prio, [], 'retirée pour la tuile ' + tech);
  }
});

t('lvl 0, gardée faute de planète, retire au rejeu une fois la planète relevée', () => {
  for(const [kind, tech, pose] of TUILES.filter(x => x[0] !== 't')){
    const g = app(base);
    g.S.prio = [Object.assign({}, pose)];
    g.S.prioAsk = g.prioDrain([D({gid:'55555', tech, lvl:0})]);
    assert.equal(g.prioDemandes().length, 1, 'gardée : ' + kind);
    assert.equal(g.S.prio.length, 1, 'et rien n\'est retiré tant que la planète manque');
    g.applyGame({planets:{'55555':{name:'Mère', coords:'1:142:8'}}, order:['55555']});
    assert.deepEqual(g.S.prio, [], 'retirée au rejeu : ' + kind);
    assert.deepEqual(g.prioDemandes(), []);
  }
});

t('une demande satisfaite est abandonnée, fraîche ou rejouée, et ne touche à rien (b, t, lf)', () => {
  for(const [, tech, pose] of TUILES){
    const g = app(base);
    g.S.prio = [Object.assign({}, pose)];
    for(const lvl of [courant[tech], courant[tech] - 1].filter(x => x > 0)){
      assert.deepEqual(g.prioDrain([D({tech, lvl})]), [], 'fraîche, abandonnée');
      assert.deepEqual(g.S.prio, [pose], 'et la priorité posée à la main reste : ' + tech + ' lvl ' + lvl);
    }
    // gardée, puis rattrapée par le niveau pendant l'attente
    g.S.prioAsk = [D({tech, lvl:courant[tech]})];
    g.applyGame({planets:{'33701':{name:'Mère', coords:'1:142:8'}}, order:['33701']});
    assert.deepEqual(g.S.prio, [pose], 'rejouée, elle ne retire rien : ' + tech);
    assert.deepEqual(g.prioDemandes(), [], 'et n\'est pas gardée plus longtemps');
  }
});

t('un niveau fraîchement relevé n\'a plus à être demandé : la demande au-dessus du courant pose', () => {
  const g = app(base);
  g.prioDrain([D({tech:31, lvl:6})]);
  assert.deepEqual(g.S.prio, [{kind:'b', pid:'mere', k:'lab', lvl:6}]);
});

t('les demandes gardées sur la même tuile se réduisent à la dernière', () => {
  const g = app();
  const reste = g.prioDrain([D({lvl:6, at:SOIR}), D({lvl:8, at:SOIR}), D({lvl:9, at:SOIR, tech:14})]);
  assert.equal(reste.length, 2);
  assert.equal(reste.find(x => x.tech === 31).lvl, 8);
  g.S.prioAsk = reste;
  g.fire({prioAsk: {newValue: [D({lvl:12})]}});
  assert.equal(g.prioDemandes().filter(x => x.tech === 31).length, 1);
  assert.equal(g.prioDemandes().find(x => x.tech === 31).lvl, 12, 'la plus récente');
});

t('une demande sans at utilisable est gardée, non expirée', () => {
  const g = app();
  for(const at of [undefined, NaN, 'hier', null, SOIR + 3600e3]){
    const reste = g.prioDrain([D({at})]);
    assert.equal(reste.length, 1, 'gardée pour at = ' + String(at));
  }
});

t('un nom démesuré est borné avant d\'entrer dans l\'état', () => {
  const g = app();
  assert.equal(g.prioDrain([D({nom:'x'.repeat(5000)})])[0].nom.length, 80);
});

/* ---------- le bloc dit aussi les formes de vie et les demandes en attente ---------- */

/* Une case lue : `next` est le niveau que le prix vise, sinon lfCost ne la dit
   pas chiffrée (lfCase, plus haut, la construit). */
const lfBloc = (cases, mode) => { const g = app(s => { s.planets[0].lf = cases; }); if(mode) g.S.day.lf = mode; return g; };
const lfHtml = (g, prio) => { g.S.prio = prio; return g.prioHtml(g.simulateDay()); };
const lf11101 = [{kind:'lf', pid:'mere', k:11101, lvl:4}];

t('le bloc nomme une priorité de forme de vie, avec le nom du jeu', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})});
  assert.match(lfHtml(g, lf11101), /Habitation 4/);
});

t('une priorité lf pas encore chiffrée dit quoi faire', () => {
  const g = lfBloc({11101: {lvl:1, state:'ok', name:'Habitation'}});
  assert.match(lfHtml(g, lf11101), /ouvre-la dans le jeu/i);
});

t('une priorité lf verrouillée le dit', () => {
  const g = lfBloc({11101: {lvl:0, state:'locked', name:'Habitation'}});
  assert.match(lfHtml(g, [{kind:'lf', pid:'mere', k:11101, lvl:1}]), /prérequis/i);
});

t('une priorité lf absente du relevé le dit, et n\'est pas « pas chiffrée »', () => {
  const h = lfHtml(lfBloc({}), lf11101);
  assert.match(h, /jamais vu cette case/);
  assert.doesNotMatch(h, /Pas encore chiffrée/);
  assert.match(h, /<span class="what">[^<]+ 4<\/span>/, 'la ligne existe, avec un nom de repli');
});

t('une priorité lf en tête de sa file le dit, et nomme le réglage', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})}, 'first');
  const h = lfHtml(g, lf11101);
  assert.match(h, /En tête de sa file/);
  assert.match(h, /Avant tout le reste/);
});

t('une priorité lf que le réglage fait passer après les bâtiments nomme ce réglage', () => {
  const g = lfBloc({11101: lfCase(1, [9e9, 0, 0], {name:'Habitation'})});
  g.S.day.lf = 'after';
  assert.match(lfHtml(g, lf11101), /après les bâtiments/i);
});

t('une priorité lf qui attend le tour d\'une autre de sa file le dit', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'}), 11102: lfCase(1, [10, 0, 0], {name:'Cuisine'})}, 'first');
  const h = lfHtml(g, [{kind:'lf', pid:'mere', k:11101, lvl:4}, {kind:'lf', pid:'mere', k:11102, lvl:4}]);
  assert.equal((h.match(/Attend son tour dans sa file/g) || []).length, 1);
  assert.match(h.split('</li>')[1], /Cuisine 4[\s\S]*Attend son tour/, 'la seconde attend');
  assert.match(h.split('</li>')[1], /Avant tout le reste/, 'et nomme le réglage');
});

t('formes de vie réglées sur « Ne pas s\'en occuper » : la ligne le dit', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})}, 'off');
  assert.match(lu(lfHtml(g, lf11101)), /Ne pas s'en occuper[^<]*n'y touche pas/);
});

// Review Focus 1, côté visible
t('une demande que le panneau n\'a pas su placer se voit', () => {
  const g = app();
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:Date.now()}]);
  const h = g.prioHtml(g.simulateDay());
  assert.match(h, /Usine de robots/);
  assert.match(h, /aucune de tes planètes/i, 'et dit ce qui manque');
});

/* Ce que esc() produit, écrit en dur : « absent du HTML brut » passerait aussi
   contre un esc() à moitié fait, ou contre une ligne qui ne rendrait plus le nom. */
const HOSTILE = '<script>alert("x")</script><img src=x onerror=alert(1)>&';
const HOSTILE_ESC = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;&amp;';

t('le nom d\'une demande, lu dans le jeu, est échappé en entier', () => {
  const g = app();
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:HOSTILE, lvl:8, at:Date.now()}]);
  const h = g.prioHtml(g.simulateDay());
  assert.ok(h.includes(`<span class="what">${HOSTILE_ESC}</span>`), h);
  assert.ok(!h.includes('<script') && !h.includes('<img') && !h.includes('"x"'), 'rien de brut');
});

t('le nom d\'une planète est échappé dans le bloc (bâtiment et forme de vie)', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})});
  g.S.planets[0].name = HOSTILE;
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}, {kind:'lf', pid:'mere', k:11101, lvl:4}];
  const h = g.prioHtml(g.simulateDay());
  assert.equal(h.split(`<span class="pill">${HOSTILE_ESC}</span>`).length, 3, 'les deux lignes');
  assert.ok(!h.includes('<script') && !h.includes('<img'));
});

t('le nom d\'une case de forme de vie lu dans le jeu est échappé', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:HOSTILE})});
  const h = lfHtml(g, lf11101);
  assert.ok(h.includes(`<span class="what">${HOSTILE_ESC} 4</span>`), h);
  assert.ok(!h.includes('<script') && !h.includes('<img'));
});

t('une demande de retrait en attente se dit retrait', () => {
  const g = app();
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:0, at:Date.now()}]);
  assert.match(g.prioHtml(g.simulateDay()), /Retrait demandé/);
});

t('Retirer enlève la bonne ligne, quelle que soit son espèce', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})});
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10},
              {kind:'lf', pid:'mere', k:11101, lvl:4},
              {kind:'t', k:'plasma', lvl:12}];
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:Date.now()}]);
  // Les références que le bloc pose sur ses boutons, relues telles quelles.
  const refs = () => [...g.prioHtml(g.simulateDay()).matchAll(/data-prio-del="([^"]+)"/g)].map(m => m[1]);
  assert.equal(refs().length, 4, 'quatre lignes, quatre boutons');
  // l'ordre du bloc : bâtiments et recherches (prios), puis formes de vie, puis demandes
  const [b, t4, l, ask] = refs();
  g.prioRetire(l);
  assert.deepEqual(g.priosLf(), [], 'la lf est partie');
  assert.equal(g.prios().length, 2, 'les deux autres priorités sont intactes');
  g.prioRetire(ask);
  assert.deepEqual(g.prioDemandes(), [], 'la demande est partie');
  assert.equal(g.prios().length, 2, 'et rien d\'autre n\'a bougé');
  g.prioRetire(t4);
  assert.deepEqual(g.prios().map(x => x.k), ['lab'], 'la recherche part, le bâtiment reste');
  g.prioRetire(b);
  assert.equal(g.prios().length, 0);
});

t('une référence périmée ou étrangère ne retire rien', () => {
  const g = app(prio2);
  g.prioRetire('lf|mere|11101'); g.prioRetire('ask|1|2'); g.prioRetire('n\'importe quoi'); g.prioRetire(0);
  assert.equal(g.S.prio.length, 2);
});

t('le bloc vide nomme le clic droit avant le volet Empire', () => {
  const h = app().prioHtml(app().simulateDay());
  assert.ok(h.indexOf('clic droit') >= 0, 'le clic droit est nommé');
  assert.ok(h.indexOf('clic droit') < h.indexOf('Empire'), 'et il vient avant');
});

t('le gestionnaire de clic passe la référence telle quelle, sans « + »', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /prioRetire\(pd\.dataset\.prioDel\)/);
});

t('une demande en attente seule suffit à remplir le bloc', () => {
  const g = app();
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:Date.now()}]);
  assert.doesNotMatch(g.prioHtml(g.simulateDay()), /Aucune pour l'instant/);
});

t('une file de forme de vie occupée ne laisse pas dire « servie »', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})}, 'first');
  g.S.timers = [{id:'l1', game:true, kind:'x', k:'other', queue:'lfbuilding', pid:'mere', end:SOIR + 20*3600e3, done:false}];
  const h = lfHtml(g, lf11101);
  assert.match(h, /file de forme de vie est occupée/);
  assert.match(h, /dans 20h 00m/, 'et dit quand');
  assert.doesNotMatch(h, /En tête de sa file|sert avant tout/);
  g.S.timers[0].pid = 'colo';
  assert.match(lfHtml(g, lf11101), /En tête de sa file/, 'le chantier d\'une autre planète ne la gêne pas');
  g.S.timers[0].pid = 'mere'; g.S.timers[0].done = true;
  assert.match(lfHtml(g, lf11101), /En tête de sa file/, 'un chantier fini non plus');
  g.S.timers[0].done = false;
  g.S.timers[0].queue = 'lfresearch';
  assert.match(lfHtml(g, lf11101), /En tête de sa file/, 'une autre file ne la gêne pas');
});

t('une référence mal encodée ne lève pas et ne retire rien', () => {
  const g = app(prio2);
  g.prioRetire('b|%|lab'); g.prioRetire('lf|%E0%A4%A|1');
  assert.equal(g.S.prio.length, 2);
});

t('le réglage des formes de vie est localisé, et la demande dit son délai', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})}, 'off');
  assert.match(lfHtml(g, lf11101), /Réglages › Plan du jour/);
  const a = app();
  a.S.prioAsk = [{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:SOIR - 3600e3}];
  assert.match(lu(a.prioHtml(a.simulateDay())), /s'efface dans 23h 00m/);
});

/* ---------- le clic droit sur une tuile ---------- */

/* Une page de ressources à une tuile : la Mine de métal au niveau 14. `niveaux`
   dit ce que le jeu écrit dans la case ; le nom vient de son étiquette. */
const SUR_MINE = { search: '?page=ingame&component=supplies', planetId: '33701', tiles: [1],
  niveaux: { 1: 14 }, noms: { 1: 'Mine de métal' } };

t('un clic droit sur une tuile à niveau demande une priorité', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20');
  const l = p.ecrit().prioAsk;
  assert.equal(l.length, 1);
  assert.deepEqual(l[0], { gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: l[0].at });
  assert.ok(l[0].at > 0, 'la demande est datée');
  assert.ok(p.menuEmpeche, 'le menu du navigateur ne s\'ouvre pas sur une tuile traitée');
});

t('le champ s\'ouvre prérempli au niveau suivant, contenu choisi, focus dedans', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, undefined, { laisse: true });
  assert.equal(p.champ.value, '15');
  assert.ok(p.champ.selectionne, 'le contenu est sélectionné');
  assert.ok(p.champ.focus_, 'le focus est dedans');
});

t('Entrée sans rien taper valide ce qui est prérempli', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1);
  assert.equal(p.ecrit().prioAsk[0].lvl, 15);
});

t('une priorité déjà posée préremplit son niveau, pas le suivant', () => {
  const p = runPage({ ...SUR_MINE, skin: { prio: { 33701: { 1: 20 } } } });
  p.clicDroit(1, undefined, { laisse: true });
  assert.equal(p.champ.value, '20');
});

t('une tuile qui se compte ne reçoit pas de priorité, et le dit', () => {
  const p = runPage({ search: '?page=ingame&component=shipyard', planetId: '33701', tiles: [212],
    niveaux: { 212: { nombre: 7 } } });
  p.clicDroit(212, '20');
  assert.equal(p.ecrit().prioAsk, undefined, 'rien n\'est demandé');
  assert.ok(!p.menuEmpeche, 'le menu du navigateur reste disponible');
  assert.match(p.refus, /niveau/i, 'la tuile dit pourquoi');
  assert.equal(p.champ, null, 'aucun champ');
});

t('une case de recherche de forme de vie, sans niveau, est refusée pour ce motif', () => {
  const p = runPage({ search: '?page=ingame&component=lfresearch', planetId: '33701', tiles: [12101] });
  p.clicDroit(12101, '3');
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.ok(!p.menuEmpeche);
  assert.match(p.refus, /niveau/i);
});

t('tout bâtiment modélisé a sa tuile et son nom court', () => {
  const g = app();
  const { OG_BUILD } = new Function(require('fs').readFileSync(require('path').join(__dirname, '..', 'ids.js'), 'utf8')
    + '; return { OG_BUILD };')();
  const tuiles = Object.values(OG_BUILD);
  /* Trois tables à tenir ensemble : une clé qui manque à l'une passe inaperçue
     jusqu'à ce que le volet Empire affiche « undefined » chez le joueur. */
  for (const k of Object.keys(g.B)) {
    assert.ok(tuiles.includes(k), k + ' n\'a pas de tuile dans OG_BUILD');
    assert.ok(g.B_SHORT[k], k + ' n\'a pas de nom court');
  }
});

t('le Dépôt et le Silo se posent au clic droit', () => {
  for (const id of [34, 44]) {
    const p = runPage({ search: '?page=ingame&component=facilities', planetId: '33701',
      tiles: [id], niveaux: { [id]: 2 } });
    p.clicDroit(id, '5');
    assert.equal(p.ecrit().prioAsk[0].lvl, 5, 'tuile ' + id);
  }
});

t('le Terraformeur et le Dock spatial ont le prix du jeu', () => {
  const g = app();
  /* Relevés sur le wiki OGame. Le Dock spatial est le seul à quintupler d'un
     niveau à l'autre : lui donner le doublement des autres le ferait paraître
     douze fois trop bon marché au niveau 4. */
  assert.deepEqual(g.levelCost(g.B.terra, 1), [0, 50000, 100000]);
  assert.deepEqual(g.levelCost(g.B.terra, 10), [0, 25600000, 51200000]);
  assert.deepEqual(g.levelCost(g.B.dock, 1), [200, 0, 50]);
  assert.deepEqual(g.levelCost(g.B.dock, 4), [25000, 0, 6250]);
  // le terraformeur demande des nanites et de l'énergie ; le dock, rien de relevé
  assert.deepEqual(g.B.terra.req, { b: { nanite: 1 }, t: { energy: 12 } });
  assert.equal(g.B.dock.req, undefined);
});

t('le Terraformeur et le Dock spatial se posent au clic droit', () => {
  for (const id of [33, 36]) {
    const p = runPage({ search: '?page=ingame&component=facilities', planetId: '33701',
      tiles: [id], niveaux: { [id]: 2 } });
    p.clicDroit(id, '5');
    assert.equal(p.ecrit().prioAsk[0].lvl, 5, 'tuile ' + id);
  }
});

t('le Dépôt de ravitaillement et le Silo de missiles ont le prix du jeu', () => {
  const g = app();
  /* Relevé sur le wiki OGame, niveau 1 puis doublement : un prix inventé ferait
     épargner la mauvaise somme sans que rien ne le signale. */
  assert.deepEqual(g.levelCost(g.B.depot, 1), [20000, 40000, 0]);
  assert.deepEqual(g.levelCost(g.B.depot, 8), [2560000, 5120000, 0]);
  assert.deepEqual(g.levelCost(g.B.silo, 1), [20000, 20000, 1000]);
  assert.deepEqual(g.levelCost(g.B.silo, 10), [10240000, 10240000, 512000]);
  // le silo demande un chantier, le dépôt ne demande rien
  assert.deepEqual(g.B.silo.req, { b: { shipyard: 1 } });
  assert.equal(g.B.depot.req, undefined);
});

t('une sauvegarde d\'avant ces bâtiments les compte à zéro, pas à « undefined »', () => {
  const g = app(s => { for (const p of s.planets) { delete p.b.depot; delete p.b.silo; } });
  assert.equal(g.S.planets[0].b.depot, 0);
  assert.equal(g.S.planets[0].b.silo, 0);
});

t('une tuile à niveau que le copilote ne modélise pas est refusée dans la page', () => {
  for (const id of [41, 42, 43]) {   // Base lunaire, Phalange, Porte de saut
    const p = runPage({ search: '?page=ingame&component=facilities', planetId: '33701', tiles: [id],
      niveaux: { [id]: 2 } });
    p.clicDroit(id, '5');
    assert.equal(p.ecrit().prioAsk, undefined, 'tuile ' + id);
    assert.ok(!p.menuEmpeche, 'tuile ' + id + ' : le menu du navigateur reste');
    assert.match(p.refus, /copilote/i, 'tuile ' + id);
    assert.doesNotMatch(p.refus, /niveau/i, 'le motif n\'est pas celui du niveau');
  }
});

t('les tuiles modélisées sont toutes acceptées : tous les bâtiments, toutes les recherches, les formes de vie', () => {
  const { OG_BUILD, OG_TECH } = new Function(require('fs').readFileSync(require('path').join(__dirname, '..', 'ids.js'), 'utf8')
    + '; return { OG_BUILD, OG_TECH };')();
  const ids = [...Object.keys(OG_BUILD), ...Object.keys(OG_TECH), 11101, 12345];
  for (const id of ids) {
    const p = runPage({ search: '?page=ingame&component=supplies', planetId: '33701', tiles: [id],
      niveaux: { [id]: 3 } });
    p.clicDroit(id, '9');
    assert.equal(p.ecrit().prioAsk[0].lvl, 9, 'tuile ' + id);
  }
});

t('Échap n\'écrit rien, et le champ part', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20', { echap: true });
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.equal(p.champ, null);
});

t('perdre le focus n\'écrit rien non plus', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20', { perdFocus: true });
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.equal(p.champ, null);
});

t('un clic droit ailleurs que sur une tuile laisse le menu du navigateur', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroitAilleurs();
  assert.ok(!p.menuEmpeche);
  assert.equal(p.ecrit().prioAsk, undefined);
});

t('deux clics droits sur la même tuile n\'empilent qu\'une demande', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '18'); p.clicDroit(1, '20');
  assert.equal(p.ecrit().prioAsk.length, 1);
  assert.equal(p.ecrit().prioAsk[0].lvl, 20);
});

t('des tuiles différentes s\'ajoutent à la liste au lieu de s\'écraser', () => {
  const p = runPage({ ...SUR_MINE, tiles: [1, 2], niveaux: { 1: 14, 2: 9 } });
  p.clicDroit(1, '20'); p.clicDroit(2, '12');
  assert.deepEqual(p.ecrit().prioAsk.map(d => [d.tech, d.lvl]), [[1, 20], [2, 12]]);
});

t('un clic droit avant que le panneau ait publié quoi que ce soit marche quand même', () => {
  const p = runPage({ ...SUR_MINE, skin: null });
  p.clicDroit(1);
  assert.equal(p.ecrit().prioAsk[0].lvl, 15);
});

t('un champ vidé demande le retrait', () => {
  const p = runPage({ ...SUR_MINE, skin: { prio: { 33701: { 1: 20 } } } });
  p.clicDroit(1, '');
  assert.equal(p.ecrit().prioAsk[0].lvl, 0);
});

t('un niveau déjà atteint demande le retrait, il ne pose pas', () => {
  for (const saisie of ['14', '3']) {
    const p = runPage({ ...SUR_MINE });
    p.clicDroit(1, saisie);
    assert.equal(p.ecrit().prioAsk[0].lvl, 0, 'saisi : ' + saisie);
  }
});

t('un retrait sur une tuile sans priorité part quand même', () => {
  const p = runPage({ ...SUR_MINE, skin: {} });
  p.clicDroit(1, '');
  assert.equal(p.ecrit().prioAsk[0].lvl, 0, 'le panneau en fera un non-événement');
});

t('un niveau juste au-dessus du courant pose', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '15');
  assert.equal(p.ecrit().prioAsk[0].lvl, 15);
});

t('une saisie qui n\'est pas un nombre ne part pas, et ne vaut pas un retrait', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '12abc');
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.match(p.refus, /nombre/i, 'la tuile dit ce qui ne va pas');
  assert.ok(p.champ, 'le champ reste, pour corriger');
});

t('sans planète lue sur la page, la tuile le dit et ne vole pas le menu', () => {
  const p = runPage({ ...SUR_MINE, planetId: '' });
  p.clicDroit(1, '20');
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.ok(!p.menuEmpeche);
  assert.match(p.refus, /planète/i);
});

t('la demande part avec l\'identifiant de planète du jeu, pour une recherche aussi', () => {
  const p = runPage({ search: '?page=ingame&component=research', planetId: '33701', tiles: [124],
    niveaux: { 124: 5 }, noms: { 124: 'Astrophysique' } });
  p.clicDroit(124, '8');
  assert.deepEqual(p.ecrit().prioAsk.map(d => [d.gid, d.tech, d.nom, d.lvl]), [['33701', 124, 'Astrophysique', 8]]);
});

t('la carte de la peau reçoit le même geste que la tuile du jeu', () => {
  const p = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  assert.ok(p.peau.posee, 'la peau est posée');
  p.clicDroit(1, '20', { carte: true });
  assert.equal(p.ecrit().prioAsk[0].lvl, 20);
  assert.equal(p.ecrit().prioAsk[0].tech, 1);
  assert.ok(p.menuEmpeche);
});

/* ---------- le clic droit : ce que la revue a repris ---------- */

t('un clic droit tombé sur un descendant de la tuile ou de la carte est résolu par délégation', () => {
  const p = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  p.clicDroit(1, '20', { dessus: true });
  assert.equal(p.ecrit().prioAsk[0].lvl, 20, 'tuile du jeu');
  const q = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  q.clicDroit(1, '21', { carte: true, dessus: true });
  assert.equal(q.ecrit().prioAsk[0].lvl, 21, 'carte de la peau');
});

t('une écriture qui échoue le dit sur la tuile, au lieu de se taire', () => {
  for (const casse of ['get', 'lastError']) {
    const log = console.error; console.error = () => {};
    let p;
    try { p = runPage({ ...SUR_MINE, stockageCasse: casse }); p.clicDroit(1, '20'); }
    finally { console.error = log; }
    assert.match(p.refus, /pas enregistré/i, casse);
    assert.equal(p.champ, null, casse + ' : le champ est fermé');
  }
});

t('le champ et le refus ne se recouvrent pas : la faute de frappe se corrige sous le message', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '12abc');
  assert.ok(p.champ && p.refus);
  // la règle propre au refus, après la règle partagée : il passe en haut, le champ reste en bas
  const refus = p.styleTxt.match(/\n\.cp-prio-refus\{[^}]*\}/)[0];
  assert.match(refus, /top:2px/);
  assert.match(refus, /bottom:auto/);
});

t('une faute corrigée puis validée ne laisse pas son reproche sur la tuile', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '12abc');
  const champ = p.champ;
  champ.value = '20';
  champ.ecoutes.keydown.forEach(fn => fn({ key: 'Enter', isTrusted: true, preventDefault() {}, stopPropagation() {} }));
  assert.equal(p.ecrit().prioAsk[0].lvl, 20);
  assert.equal(p.refus, null, 'plus de message');
});

t('la demande que la page vient de poster gagne sur le préremplissage', () => {
  // planète jamais relevée : le panneau n'a rien placé, `prio` est vide
  const p = runPage({ ...SUR_MINE, skin: {} });
  p.clicDroit(1, '20');
  p.clicDroit(1, undefined, { laisse: true });
  assert.equal(p.champ.value, '20', 'pas niveau + 1');
});

t('une demande de retrait posée l\'emporte sur la priorité du panneau', () => {
  const p = runPage({ ...SUR_MINE, skin: { prio: { 33701: { 1: 20 } } } });
  p.clicDroit(1, '');
  p.clicDroit(1, undefined, { laisse: true });
  assert.equal(p.champ.value, '15', 'plus de cible : niveau + 1');
});

t('Entrée perd son action par défaut : un formulaire autour de la tuile ne part pas', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20');
  assert.ok(p.toucheEmpechee);
});

t('un clic droit fabriqué par un script de la page n\'ouvre rien', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20', { fabrique: true });
  assert.equal(p.champ, null);
  assert.ok(!p.menuEmpeche);
  assert.equal(p.ecrit().prioAsk, undefined);
});

t('une touche Entrée fabriquée ne valide pas', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20', { synthese: true });
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.ok(p.champ, 'le champ reste ouvert');
});

t('un attribut de carte qui n\'est pas un entier ne lève rien et laisse le menu', () => {
  const p = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  p.clicDroit(1, undefined, { carte: true, laisse: true });
  // on ne peut pas réécrire la carte ici : on en fabrique une, posée dans le panneau
  assert.doesNotThrow(() => p.clicDroitCarteForgee('1"] , [x'));
  assert.ok(!p.menuEmpeche);
});

/* ---------- les deux marquages sur la tuile ---------- */

/* Deux tuiles de ressources : la 1 à 14, la 2 à 9. */
const DEUX = { search: '?page=ingame&component=supplies', planetId: '33701', tiles: [1, 2],
  niveaux: { 1: 14, 2: 9 }, noms: { 1: 'Mine de métal', 2: 'Mine de cristal' } };

t('ta priorité se marque autrement que la cible du plan', () => {
  const p = runPage({ ...DEUX, skin: { hints: { 33701: { 2: 10 } }, prio: { 33701: { 1: 20 } } } });
  const a = p.tuile(1), b = p.tuile(2);
  assert.match(a.pastille, /20/);  assert.match(a.infobulle, /ta priorité/i);
  assert.match(b.pastille, /10/);  assert.ok(!/ta priorité/i.test(b.infobulle));
  assert.notEqual(a.classe, b.classe, 'deux teintes, pas une');
  assert.ok(a.marquee && b.marquee);
});

t('sur la même tuile, la priorité passe devant la cible du plan', () => {
  const p = runPage({ ...DEUX, skin: { hints: { 33701: { 1: 15 } }, prio: { 33701: { 1: 20 } } } });
  assert.match(p.tuile(1).pastille, /20/);
  assert.match(p.tuile(1).infobulle, /ta priorité/i);
  const q = runPage({ ...DEUX, skin: { ...BANDE, peau: true, hints: { 33701: { 1: 15 } }, prio: { 33701: { 1: 20 } } } });
  assert.match(q.carte(1).pastille, /20/, 'la carte dit la même chose');
});

t('une demande pas encore confirmée se voit, et se dit non confirmée', () => {
  const p = runPage({ ...DEUX, skin: {} });
  p.clicDroit(1, '20');
  assert.match(p.tuile(1).pastille, /20/);
  assert.match(p.tuile(1).infobulle, /pas encore|en attente/i);
  assert.notEqual(p.tuile(1).classe, runPage({ ...DEUX, skin: { prio: { 33701: { 1: 20 } } } }).tuile(1).classe,
    'ni la teinte de la priorité confirmée');
});

t('la priorité disparaît de la tuile quand le panneau la retire', () => {
  const p = runPage({ ...DEUX, skin: { prio: { 33701: { 1: 20 } } } });
  assert.match(p.tuile(1).pastille, /20/);
  p.majSkin({ prio: {} });
  assert.equal(p.tuile(1).pastille, null);
  assert.ok(!p.tuile(1).marquee, 'et la tuile n\'est plus entourée');
});

t('la pastille n\'est pas reposée quand rien n\'a changé : le jeu n\'est pas remué', () => {
  // retirer puis reposer le nœud ferait sonner l'observateur, qui repeindrait, sans fin
  for (const skin of [{ prio: { 33701: { 1: 20 } } }, { hints: { 33701: { 1: 15 } } }]) {
    const p = runPage({ ...DEUX, skin });
    const n = p.tuile(1).noeud;
    assert.ok(n);
    p.secousse();
    assert.equal(p.tuile(1).noeud, n);
  }
});

t('une demande dont la tuile n\'est pas un entier ne touche aucun sélecteur', () => {
  const p = runPage({ ...DEUX, skin: {}, askAvant: [{ gid: '33701', tech: '1"] , [x', lvl: 9, at: 1 }] });
  assert.equal(p.tuile(1).pastille, null);
});

t('la pastille « pas payable » garde une couleur lisible sur son fond', () => {
  const p = runPage({ ...DEUX, skin: {} });
  for (const e of ['lancé', 'pas payable']) {
    const r = p.styleTxt.match(new RegExp('cp-cible\\[data-etat="' + e + '"\\]\\{[^}]*\\}'))[0];
    assert.match(r, /color:var\(--cp-creux\)/, e);
  }
});

t('une écriture refusée ne fait pas sonner onChanged : pas de pastille en attente', () => {
  const log = console.error; console.error = () => {};
  let p;
  try { p = runPage({ ...DEUX, skin: {}, stockageCasse: 'lastError' }); p.clicDroit(1, '20'); }
  finally { console.error = log; }
  assert.equal(p.tuile(1).pastille, null);
});

t('une priorité marquée reste après une secousse de la page', () => {
  const p = runPage({ ...DEUX, skin: { prio: { 33701: { 1: 20 } } } });
  p.secousse();
  assert.match(p.tuile(1).pastille, /20/);
});

t('la peau marque aussi la priorité, et répond au clic droit', () => {
  const p = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true, prio: { 33701: { 1: 20 } } } });
  assert.match(p.carte(1).pastille, /20/);
  assert.match(p.carte(1).infobulle, /ta priorité/i);
  p.clicDroit(1, '25', { carte: true });
  assert.equal(p.ecrit().prioAsk[0].lvl, 25, 'le second sélecteur sert ici');
});

t('la carte distingue le plan, la priorité et la demande en attente', () => {
  const plan = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true, hints: { 33701: { 1: 15 } } } }).carte(1);
  const prio = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true, prio: { 33701: { 1: 15 } } } }).carte(1);
  const q = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  q.clicDroit(1, '15', { carte: true });
  const attente = q.carte(1);
  assert.equal(new Set([plan.classe, prio.classe, attente.classe]).size, 3, 'trois teintes');
  assert.ok(!/ta priorité/i.test(plan.infobulle));
  assert.match(attente.infobulle, /pas encore/i);
});

t('la source change, le niveau non : la carte se redessine', () => {
  const p = runPage({ ...SUR_MINE, askAvant: [{ gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: 1 }],
    skin: { ...BANDE, peau: true, prio: { 33701: { 1: 20 } } } });
  const avant = p.carte(1);
  assert.match(avant.infobulle, /pas encore/i);
  p.majAsk(undefined);                       // le panneau a repris la demande
  const apres = p.carte(1);
  assert.equal(apres.pastille, avant.pastille, 'même « → 20 »');
  assert.ok(!/pas encore/i.test(apres.infobulle), 'mais plus en attente');
  assert.match(apres.infobulle, /ta priorité/i);
});

t('une demande de retrait ne fait pas une cible à 0', () => {
  const p = runPage({ ...DEUX, skin: { prio: { 33701: { 1: 20 } } } });
  p.clicDroit(1, '');
  assert.equal(p.tuile(1).pastille, null, 'plus de cible, pas « → 0 »');
  const q = runPage({ ...DEUX, skin: { hints: { 33701: { 1: 15 } }, prio: { 33701: { 1: 20 } } } });
  q.clicDroit(1, '');
  assert.match(q.tuile(1).pastille, /15/, 'la tuile retombe sur le plan');
  assert.ok(!/ta priorité/i.test(q.tuile(1).infobulle));
});

t('une peau publiée avant les priorités n\'a pas de clé prio : la tuile montre le plan', () => {
  const p = runPage({ ...DEUX, skin: { hints: { 33701: { 2: 10 } } } });
  assert.match(p.tuile(2).pastille, /10/);
  assert.equal(p.tuile(1).pastille, null);
  const q = runPage({ ...DEUX, skin: { ...BANDE, peau: true, hints: { 33701: { 2: 10 } } } });
  assert.match(q.carte(2).pastille, /10/);
});

t('la pastille suit le niveau quand la cible change sans que la tuile cesse d\'être marquée', () => {
  const p = runPage({ ...DEUX, skin: { hints: { 33701: { 2: 10 } } } });
  p.majSkin({ hints: { 33701: { 2: 12 } } });
  assert.match(p.tuile(2).pastille, /12/);
  p.majSkin({ hints: { 33701: { 2: 12 } }, prio: { 33701: { 2: 12 } } });
  assert.match(p.tuile(2).infobulle, /ta priorité/i, 'même niveau, autre source');
});

/* Le vrai `get` est asynchrone, et la peinture ne l'est pas : ces tests le
   rendent asynchrone, sinon un lecteur qui l'attendrait passerait quand même. */
t('le miroir s\'amorce par un get qui répond tard, et la page se repeint à ce moment', () => {
  const p = runPage({ ...DEUX, getDiffere: true, skin: {},
    askAvant: [{ gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: 1 }] });
  assert.equal(p.tuile(1).pastille, null, 'rien tant que le stockage n\'a pas répondu');
  p.livre();
  assert.match(p.tuile(1).pastille, /20/);
  assert.match(p.tuile(1).infobulle, /pas encore/i);
});

t('un changement arrivé avant la réponse tardive du get n\'est pas défait par elle', () => {
  const p = runPage({ ...DEUX, getDiffere: true, skin: {},
    askAvant: [{ gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: 1 }] });
  p.majAsk([{ gid: '33701', tech: 2, nom: 'Mine de cristal', lvl: 12, at: 2 }]);
  p.livre();                                   // la réponse porte l'état d'avant
  assert.match(p.tuile(2).pastille, /12/);
  assert.equal(p.tuile(1).pastille, null, 'l\'ancienne lecture n\'écrase pas le plus récent');
});

t('onChanged met le miroir à jour, et la clé vidée retire la demande', () => {
  const p = runPage({ ...DEUX, getDiffere: true, skin: {} });
  p.livre();
  p.majAsk([{ gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: 1 }]);
  assert.match(p.tuile(1).pastille, /20/);
  p.majAsk(undefined);                         // newValue absent : c'est le remove() du panneau
  assert.equal(p.tuile(1).pastille, null);
  assert.ok(!p.tuile(1).marquee);
});

t('un stockage qui lève au chargement ne casse ni la page ni le plan', () => {
  const log = console.error; console.error = () => {};
  let p;
  try { p = runPage({ ...DEUX, stockageCasse: 'get', skin: { hints: { 33701: { 2: 10 } } } }); }
  finally { console.error = log; }
  assert.match(p.tuile(2).pastille, /10/);
});

/* ---------- deux postes, un seul plan ---------- */

/** Le même empire vu par deux postes : les gid viennent du jeu, les id sont locaux. */
const poste = (un, deux) => (s) => {
  s.planets[0].id = un; s.planets[0].gid = '33701';
  s.planets[1].id = deux; s.planets[1].gid = '33801';
};

t('vers l\'autre poste part ce que le joueur décide, pas le relevé de l\'empire', () => {
  const g = app(poste('a1', 'a2'));
  const envoi = g.syncOut();
  for (const k of ['sy:settings', 'sy:day', 'sy:daily', 'sy:prio', 'sy:raids'])
    assert.ok(k in envoi, k + ' doit voyager');
  for (const k of Object.keys(envoi))
    assert.ok(!/planets|tech|timers|explored|syncAt/.test(k), k + ' se relit des pages du jeu');
});

t('une priorité voyage par le gid : l\'autre poste la pose sur sa propre planète', () => {
  const a = app(poste('a1', 'a2'));
  a.prioPose('b', 'a2', 'metal', 12);
  const envoi = a.syncOut();
  assert.deepEqual(envoi['sy:prio'], [{ kind: 'b', k: 'metal', lvl: 12, gid: '33801' }]);
  const b = app(poste('b1', 'b2'));
  b.syncApply(envoi);
  assert.deepEqual(b.S.prio, [{ kind: 'b', k: 'metal', lvl: 12, pid: 'b2' }]);
});

t('une priorité retirée sur un poste s\'en va sur l\'autre', () => {
  const g = app(poste('b1', 'b2'));
  g.prioPose('b', 'b2', 'metal', 12);
  g.syncApply({ 'sy:prio': [] });
  assert.deepEqual(g.S.prio, []);
});

t('une priorité reçue avant le relevé attend sa planète, puis s\'y pose', () => {
  const g = app(poste('b1', 'b2'));
  g.syncApply({ 'sy:prio': [{ kind: 'b', k: 'metal', lvl: 12, gid: '44000' }] });
  assert.equal(g.S.prio[0].gid, '44000', 'gardée telle quelle : cette planète est inconnue ici');
  g.applyGame({ order: ['44000'], planets: { 44000: { name: 'Colonie neuve', coords: '1:142:4', tmax: 50, b: { metal: 3 } } } });
  const p = g.S.planets.find(x => x.gid === '44000');
  assert.deepEqual(g.S.prio[0], { kind: 'b', k: 'metal', lvl: 12, pid: p.id });
});

t('une priorité sur une planète que le jeu ne nomme pas ne part pas', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.prioPose('b', 'colo', 'metal', 12);
  assert.ok(!('sy:prio' in g.syncOut()),
    'toute la liste reste à quai : envoyée sans elle, elle reviendrait effacée');
});

/* ---------- sauvegarde dans un fichier ---------- */

t("un fichier de sauvegarde se recharge tel qu'il a été écrit", () => {
  const g = app();
  const ecrit = JSON.stringify(g.S);
  g.S.planets = [];
  assert.ok(g.appliqueSauvegarde(ecrit), 'le texte vient du panneau lui-même');
  assert.equal(g.saved().planets.length, 2);
  assert.equal(g.saved().planets[0].name, 'Planète mère', 'rechargé veut dire enregistré');
});

t('« Enregistrer » écrit un save.json que le joueur place où il veut', () => {
  /* Le presse-papiers du panneau latéral échouait en silence : ce clic doit
     produire un fichier, et viser le dépôt plutôt que Téléchargements. */
  const s = fixtureState(); s.__tab = 'settings';
  const g = loadApp(s, SOIR, ['S'], null, true);
  g.click('ioSave');
  const f = g.telecharges()[0];
  assert.equal(f.filename, 'save.json');
  assert.ok(f.saveAs, 'sans la boîte de dialogue, le fichier n\'atteint pas le dépôt');
  assert.ok(/^blob:/.test(f.url));
  assert.ok(g.el('ioMsg').textContent, 'le panneau dit quoi faire du fichier');
  // « Charger » ouvre le sélecteur, et le fichier choisi est bien lu
  g.click('ioLoad');
  let lu = 0;
  const fichier = { text() { lu++; return new Promise(() => {}); } };
  (g.el('ioFile').on.change || []).forEach(fn => fn({ target: { files: [fichier], value: '' } }));
  assert.equal(lu, 1, 'le fichier choisi doit être lu');
});

t('un fichier qui n\'est pas une sauvegarde ne remplace rien', () => {
  const g = app();
  for (const txt of ['', 'pas du json', '{}', '{"planets":[]}', '{"settings":{}}'])
    assert.ok(!g.appliqueSauvegarde(txt), txt + ' ne devrait pas passer');
  assert.equal(g.S.planets.length, 2, 'l\'empire est resté en place');
});

t('un état venu d\'ailleurs ne peut pas porter de balisage', () => {
  /* Les champs des Réglages vérifient ce que le joueur tape, mais deux entrées
     les contournent : le fichier de sauvegarde et storage.sync. Les textes sont
     échappés à l'affichage ; ce qui restait à découvert, ce sont les champs tenus
     pour des nombres et donc interpolés bruts — le ratio, l'intervalle et les
     heures de nuit. */
  const g = app();
  const sain = JSON.parse(JSON.stringify(g.S));
  const piege = part => JSON.stringify(Object.assign({}, sain, part));
  const XSS = '<img src=x onerror=alert(1)>';

  // 1. le ratio, dans l'innerHTML de l'onglet Empire
  assert.ok(g.appliqueSauvegarde(piege({ settings: Object.assign({}, sain.settings, { ratio: [XSS, 2, 1] }) })),
    'le fichier reste une sauvegarde recevable : ce sont les champs seuls qui sont écartés');
  assert.deepEqual(g.saved().settings.ratio, [3, 2, 1], 'le ratio retombe sur sa valeur par défaut');
  g.VIEWS.planets(); g.REFRESH.planets();
  assert.ok(!/onerror/.test(g.html().empireMix || ''), 'rien n\'atteint l\'onglet Empire');

  // 2. l'intervalle et les heures de nuit, dans « Plan du jour » et les Réglages
  assert.ok(g.appliqueSauvegarde(piege({
    day: Object.assign({}, sain.day, { interval: XSS, nightStart: '"><b>x', nightEnd: {}, horizon: NaN, focus: XSS }),
  })));
  const d = g.saved().day;
  assert.equal(d.interval, 90, 'l\'intervalle retombe sur sa valeur par défaut');
  assert.equal(d.nightStart, 23, 'et l\'heure de début de nuit');
  assert.equal(d.nightEnd, 7, 'et celle de fin');
  assert.equal(d.horizon, 24, 'et l\'horizon');
  assert.equal(d.focus, 'equi', 'et la priorité, qui n\'est pas un nombre mais une clé connue');
  for(const h of [g.VIEWS.today(), g.VIEWS.settings()])
    assert.ok(!/onerror|"><b>/.test(h), 'ni « Plan du jour » ni les Réglages ne portent le balisage');

  // 3. storage.sync est l'autre chemin, et il ne passe pas par appliqueSauvegarde
  g.syncApply({ 'sy:day': Object.assign({}, sain.day, { nightStart: XSS }) });
  assert.equal(g.saved().day.nightStart, 23, 'l\'état reçu en synchro est écarté aussi');

  // 4. et ce que les menus des Réglages proposent traverse toujours
  assert.ok(g.appliqueSauvegarde(piege({
    settings: Object.assign({}, sain.settings, { ratio: [2, 1, 1] }),
    day: Object.assign({}, sain.day, { interval: 180, nightStart: 0, nightEnd: 6, horizon: 48, focus: 'fleet' }),
  })));
  assert.deepEqual(g.saved().settings.ratio, [2, 1, 1], 'trois nombres > 0 passent');
  assert.deepEqual(
    [g.saved().day.interval, g.saved().day.nightStart, g.saved().day.nightEnd, g.saved().day.horizon, g.saved().day.focus],
    [180, 0, 6, 48, 'fleet'], 'et les valeurs que les menus offrent ne sont pas rabotées');
});

t('aucun champ numérique d\'une sauvegarde n\'atteint un gabarit tel quel', () => {
  /* Une quarantaine d'attributs interpolent l'état sans `esc`, parce que le
     champ est tenu pour un nombre : `value`, `min`, `data-*`. `num()` est leur
     `esc()`. On vérifie qu'aucun attribut ne se referme trop tôt — le texte
     « onerror », lui, peut rester : échappé, il n'est qu'un mot. */
  const g = app();
  const sain = JSON.parse(JSON.stringify(g.S));
  const XSS = '"><img src=x onerror=alert(1)>';
  const piege = JSON.parse(JSON.stringify(sain));
  piege.tech[Object.keys(piege.tech)[0]] = XSS;
  Object.assign(piege.planets[0], { tmax: XSS, sats: XSS });
  piege.planets[0].b.metal = XSS;
  piege.raid = { coords: '1:1:1', m: XSS, c: XSS, d: XSS };
  piege.fleetCalc.ships.sc = XSS;
  piege.colo.bonus = XSS;
  piege.prio = [{ kind: 'b', pid: sain.planets[0].id, k: 'metal', lvl: XSS }];

  assert.ok(g.appliqueSauvegarde(JSON.stringify(piege)), 'le fichier reste recevable');
  for(const v of ['planets', 'research', 'settings', 'today', 'tools', 'fleet', 'moon'])
    assert.ok(!/"><img/.test(g.VIEWS[v]()), v + ' referme un attribut trop tôt');
  // et le champ montre un nombre, pas une chaîne vide ni « NaN »
  assert.match(g.VIEWS.planets(), /data-p="tmax" value="0"/);
  assert.match(g.VIEWS.research(), /data-t="energy" value="0"/);
});

t('une sauvegarde dont les identifiants sont truqués est refusée', () => {
  /* L'identifiant part dans une quinzaine d'attributs sans `esc`. Le réécrire
     obligerait à suivre le centre, la colonie, les priorités et les minuteurs
     qui le citent : le fichier est refusé en entier. */
  const g = app();
  const sain = JSON.parse(JSON.stringify(g.S));
  const XSS = '"><img src=x onerror=alert(1)>';

  const truque = JSON.parse(JSON.stringify(sain));
  truque.planets[0].id = XSS;
  assert.ok(!g.appliqueSauvegarde(JSON.stringify(truque)), 'planète truquée : refusée');

  const tmTruque = JSON.parse(JSON.stringify(sain));
  tmTruque.timers = [{ id: XSS, end: Date.now(), done: false }];
  assert.ok(!g.appliqueSauvegarde(JSON.stringify(tmTruque)), 'minuteur truqué : refusé');
  assert.equal(g.S.planets.length, 2, 'l\'empire est resté en place');

  // une sauvegarde d'avant les identifiants reste recevable, et reçoit les siens
  const vieille = JSON.parse(JSON.stringify(sain));
  vieille.planets.forEach(q => delete q.id);
  assert.ok(g.appliqueSauvegarde(JSON.stringify(vieille)), 'celle-là passe');
  assert.ok(g.saved().planets.every(q => /^[a-z0-9]{1,24}$/i.test(q.id)),
    'chaque planète repart avec un jeton : sinon tout l\'onglet s\'affiche en pn-undefined');
});

/* ---------- le tir de lune : les tables ---------- */

/** Coût et bouclier de base, relus sur ogame.fandom.com/wiki/Ships le
    24 novembre 2026. La coque n'y figure pas parce qu'elle n'a pas à y être :
    elle vaut métal + cristal, ce que les seize lignes du wiki vérifient sans
    une exception. */
const WIKI_VAISSEAUX = {
  sc:  { c: [2000, 2000, 0],        bou: 10 },
  lc:  { c: [6000, 6000, 0],        bou: 25 },
  pf:  { c: [8000, 15000, 8000],    bou: 100 },
  lf:  { c: [3000, 1000, 0],        bou: 10 },
  hf:  { c: [6000, 4000, 0],        bou: 25 },
  cr:  { c: [20000, 7000, 2000],    bou: 50 },
  bs:  { c: [45000, 15000, 0],      bou: 200 },
  bc:  { c: [30000, 40000, 15000],  bou: 400 },
  bb:  { c: [50000, 25000, 15000],  bou: 500 },
  ds:  { c: [60000, 50000, 15000],  bou: 500 },
  rp:  { c: [85000, 55000, 20000],  bou: 700 },
  rec: { c: [10000, 6000, 2000],    bou: 10 },
  col: { c: [10000, 20000, 10000],  bou: 100 },
  pr:  { c: [0, 1000, 0],           bou: 0.01 },
};

t('les quatorze vaisseaux ont le coût et le bouclier du wiki', () => {
  const g = app();
  assert.deepEqual(Object.keys(g.SHIPS).sort(), Object.keys(WIKI_VAISSEAUX).sort());
  for (const [k, w] of Object.entries(WIKI_VAISSEAUX)) {
    assert.deepEqual(g.SHIP_COST[k], w.c, 'coût de ' + k);
    assert.equal(g.SHIPS[k].bou, w.bou, 'bouclier de ' + k);
  }
});

t('le vaisseau de colonisation recoupe COL_SHIP_COST', () => {
  const g = app();
  assert.deepEqual(g.SHIP_COST.col, g.COL_SHIP_COST);
});

t('les huit attaques de défense sont celles de la revue', () => {
  const g = app();
  assert.deepEqual(['rl', 'll', 'hl', 'ic', 'gc', 'pt', 'sd', 'ld'].map(k => g.DEF[k].a),
    [80, 100, 250, 150, 1100, 3000, 1, 1]);
});

t('la coque d\'une pièce de défense vaut son métal plus son cristal', () => {
  const g = app();
  assert.deepEqual(['rl', 'll', 'hl', 'ic', 'gc', 'pt', 'sd', 'ld'].map(k => g.DEF[k].c[0] + g.DEF[k].c[1]),
    [2000, 2000, 8000, 8000, 35000, 100000, 20000, 100000]);
});

/* ---------- le tir de lune : l'arithmétique ---------- */

/** Le tableau « Probability of moon formation from ship debris » de
    ogame.fandom.com/wiki/Moon, colonnes 1 % et 20 %, relu le 24 novembre 2026.
    C'est la même fonction prouvée par une source extérieure.

    Deux cellules de ce tableau se contredisent avec celui de /wiki/Moonchance,
    qui dit 248 croiseurs et 90 bombardiers : 247 et 89 sont les plafonds
    exacts (247 × 8 100 = 2 000 700, déjà au-dessus de 2 M), Moonchance arrondit
    vers le haut. Et la ligne du chasseur léger de /wiki/Moon porte deux coquilles
    à 2 % et 16 % (166 et 1 337, là où le petit transporteur de même coque dit
    167 et 1 334) — d'où les colonnes 1 % et 20 % seules, où tout concorde. */
const WIKI_LUNE = {
  sc: [84, 1667], lc: [28, 556], lf: [84, 1667], hf: [34, 667],
  cr: [13, 247], bs: [6, 112], col: [12, 223], rec: [21, 417],
  pr: [334, 6667], bb: [5, 89], ds: [4, 61], bc: [5, 96],
};

t('le nombre de vaisseaux par chance est celui du tableau du wiki', () => {
  const g = app();
  for (const [k, [un, vingt]] of Object.entries(WIKI_LUNE)) {
    assert.equal(g.luneVaisseaux(k, 1, 30), un, k + ' à 1 %');
    assert.equal(g.luneVaisseaux(k, 20, 30), vingt, k + ' à 20 %');
  }
});

/** « Amt. for a 30/40/50/60/70 % DF » de /wiki/Moonchance : le taux de débris
    est un réglage d'univers, et le wiki en donne cinq. */
const WIKI_DF = {
  lf: { 30: 1667, 40: 1250, 50: 1000, 60: 834, 70: 715 },
  bs: { 30: 112, 40: 84, 50: 67, 60: 56, 70: 48 },
  pr: { 30: 6667, 40: 5000, 50: 4000, 60: 3334, 70: 2858 },
};

t('le taux de débris de l\'univers change le nombre de vaisseaux', () => {
  const g = app();
  for (const [k, par] of Object.entries(WIKI_DF))
    for (const [df, n] of Object.entries(par))
      assert.equal(g.luneVaisseaux(k, 20, +df), n, k + ' à 20 % sur un univers ' + df + ' %');
});

t('le taux de débris vaut 30 % quand on ne le dit pas', () => {
  const g = app();
  assert.equal(g.luneVaisseaux('lf', 20), 1667);
  assert.equal(g.luneTir('lf', 1000).debris, 1200000);
});

t('mille chasseurs légers font 1,2 M de débris et 12 % de chance', () => {
  const g = app(), r = g.luneTir('lf', 1000, 30);
  assert.equal(r.v, 4000);
  assert.equal(r.debris, 1200000);
  assert.equal(r.chance, 12);
});

t('sous 100 000 de débris, la chance est nulle', () => {
  const g = app();
  assert.equal(g.luneTir('lf', 83, 30).debris, 99600);
  assert.equal(g.luneTir('lf', 83, 30).chance, 0);
  assert.ok(g.luneTir('lf', 84, 30).chance > 1);
});

t('la chance plafonne à 20 %', () => {
  assert.equal(app().luneTir('lf', 2000, 30).chance, 20);
});

t('la chance par ressource dépensée est la même à 100 000 et à 2 M', () => {
  const g = app();
  const par = n => g.luneTir('lf', n, 30).chance / (n * 4000);
  assert.ok(Math.abs(par(84) - par(1666)) < 1e-12);
});

t('une chance visée hors bornes est ramenée dans les bornes', () => {
  const g = app();
  assert.equal(g.luneVaisseaux('lf', 50, 30), g.luneVaisseaux('lf', 20, 30));
  assert.equal(g.luneVaisseaux('lf', 0, 30), g.luneVaisseaux('lf', 1, 30));
});

t('la facture espérée compte les tirs et ce que le recyclage rend', () => {
  const g = app(), f = g.luneFacture('lf', 1000, 30);
  assert.equal(f.chance, 12);
  assert.equal(f.tirs, 9);
  assert.equal(f.m, 9 * 1000 * 3000);
  assert.equal(f.c, 9 * 1000 * 1000);
  assert.equal(f.recupere, 8 * 1200000);
});

t('un vaisseau sans coût ne sort ni débris ni NaN', () => {
  const g = app();
  assert.equal(g.luneTir('inconnu', 100, 30).debris, 0);
  assert.equal(g.luneTir('inconnu', 100, 30).chance, 0);
  assert.equal(g.luneVaisseaux('inconnu', 20, 30), 0);
  assert.equal(g.luneFacture('inconnu', 100, 30), null);
});

t('une chance nulle ne donne pas de facture', () => {
  assert.equal(app().luneFacture('lf', 83, 30), null);
});

/* ---------- le tir de lune : ce que la défense tue ---------- */

/** La défense du HQ au relevé du 24 novembre 2026, et Armes 8.
    Les tâches suivantes réemploient cette fixture. */
const HQ = s => {
  s.planets[0].defs = { rl: 3077, ll: 511, hl: 351, ic: 213, gc: 51, pt: 11, sd: 1, ld: 1 };
  s.tech.weapons = 8;
};

t('la défense du HQ tue environ un millier de chasseurs légers', () => {
  const g = app(HQ), d = g.luneDefense(g.S.planets[0], 'lf', 0);
  assert.equal(d.tirs, 4216, 'les huit pièces tirent, boucliers compris');
  assert.ok(d.puissance > 700000 && d.puissance < 715000, 'puissance : ' + d.puissance);
  assert.ok(d.tue / 4000 > 950 && d.tue / 4000 < 1050, 'chasseurs tués : ' + d.tue / 4000);
});

t('le niveau de Bouclier du camarade baisse ce qui est tué', () => {
  const g = app(HQ), p = g.S.planets[0];
  assert.ok(g.luneDefense(p, 'lf', 8).tue < g.luneDefense(p, 'lf', 0).tue);
});

t('la Technologie Armes monte ce que la défense tue', () => {
  const sans = app(s => { HQ(s); s.tech.weapons = 0; });
  const avec = app(HQ);
  assert.ok(avec.luneDefense(avec.S.planets[0], 'lf', 0).puissance
          > sans.luneDefense(sans.S.planets[0], 'lf', 0).puissance);
});

t('une défense jamais relevée ne rend aucun verdict', () => {
  const g = app(s => { HQ(s); s.planets[0].defs = null; });
  assert.equal(g.luneDefense(g.S.planets[0], 'lf', 0), null);
});

t('une défense rasée rend un verdict franc, pas un inconnu', () => {
  const g = app(s => { HQ(s); s.planets[0].defs = {}; });
  const d = g.luneDefense(g.S.planets[0], 'lf', 0);
  assert.notEqual(d, null, 'relevée et vide, ce n\'est pas inconnu');
  assert.equal(d.tue, 0);
  assert.equal(d.tirs, 0);
});

t('une clé inconnue dans la défense ne compte pour rien', () => {
  const g = app(s => { HQ(s); s.planets[0].defs = { rl: 10, __proto__: 5, zz: 99 }; });
  const d = g.luneDefense(g.S.planets[0], 'lf', 0);
  assert.equal(d.tirs, 10);
});

/* ---------- le tir de lune : la carte ---------- */

/** Le HQ, l'onglet Lune ouvert, et un tir de mille chasseurs légers. */
const LUNE = s => {
  HQ(s);
  s.ui.tool = 'moon';
  s.moonCalc = { pid: s.planets[0].id, ship: 'lf', n: 1000, bou: 0, viser: 12 };
};

t('l\'onglet Lune est dans la barre d\'Outils', () => {
  assert.ok(/Lune/.test(lu(app(LUNE).VIEWS.tools())));
});

t('la carte sort les débris, la chance et ce que la défense tue', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/1,20 M/.test(out), 'les débris : ' + out);
  assert.ok(/12 %/.test(out), 'la chance : ' + out);
  assert.ok(/999/.test(out), 'ce que la défense tue : ' + out);
  assert.ok(/chasseurs légers/i.test(out), 'le vaisseau visé est nommé : ' + out);
});

t('sans vaisseau, la carte ne sort aucun chiffre et le dit', () => {
  const g = app(s => { LUNE(s); s.moonCalc.n = 0; });
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/combien/i.test(out), out);
  assert.ok(!/%/.test(out), 'aucune chance annoncée : ' + out);
});

t('une défense jamais relevée se dit inconnue, pas nulle', () => {
  const g = app(s => { LUNE(s); s.planets[0].defs = null; });
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/jamais relevée/i.test(out), out);
  assert.ok(!/\b0 chasseurs/.test(out), 'pas de zéro inventé : ' + out);
});

t('le niveau de Bouclier proposé est celui du joueur', () => {
  const g = app(s => { LUNE(s); s.moonCalc.bou = null; s.tech.shielding = 8; });
  assert.ok(/value="8"/.test(g.VIEWS.moon()), g.VIEWS.moon().slice(0, 600));
});

t('les voyages de recycleur ne sortent que s\'il y a des recycleurs', () => {
  const avec = app(s => { LUNE(s); s.planets[0].ships = { rec: 31 }; });
  avec.REFRESH.moon();
  assert.ok(/voyage/i.test(lu(avec.html().moonOut || '')), 'avec 31 recycleurs');
  const sans = app(s => { LUNE(s); s.planets[0].ships = {}; });
  sans.REFRESH.moon();
  assert.ok(!/voyage/i.test(lu(sans.html().moonOut || '')), 'sans recycleur');
});

/* ---------- le tir de lune : les avertissements ---------- */

t('la flotte au sol est chiffrée pour l\'avertissement', () => {
  const g = app(s => { LUNE(s); s.planets[0].ships = { lf: 240, hf: 538 }; });
  assert.deepEqual(g.luneFlotteAuSol(g.S.planets[0]),
    { m: 240 * 3000 + 538 * 6000, c: 240 * 1000 + 538 * 4000 });
});

t('une flotte jamais relevée n\'invente pas un zéro', () => {
  const g = app(s => { LUNE(s); delete s.planets[0].ships; });
  assert.equal(g.luneFlotteAuSol(g.S.planets[0]), null);
});

t('la carte avertit sous le plancher et pour la flotte au sol', () => {
  const g = app(s => { LUNE(s); s.moonCalc.n = 83; s.planets[0].ships = { hf: 538 }; });
  g.REFRESH.moon();
  const note = lu(g.html().moonNote || '');
  assert.ok(/100 000/.test(note), 'le plancher : ' + note);
  assert.ok(/538/.test(note), 'la flotte au sol : ' + note);
  assert.ok(/Estimation/.test(note), 'l\'estimation est nommée : ' + note);
  assert.ok(/ne connaît pas les lunes/.test(note), 'la lune déjà là : ' + note);
});

t('au-dessus du plafond, la carte dit ce qui est perdu', () => {
  /* Défense jamais relevée : tout meurt, donc 3 000 chasseurs dépassent les
     2 M. Avec la défense du HQ, elle n'en tuerait que mille et le surplus
     n'existerait pas — c'est ce que vérifie « ce qui meurt » plus bas. */
  const g = app(s => { LUNE(s); s.moonCalc.n = 3000; s.planets[0].defs = null; });
  g.REFRESH.moon();
  const note = lu(g.html().moonNote || '');
  assert.ok(/perdu/.test(note), note);
  assert.ok(/667 morts suffisent/.test(note), 'le nombre qui suffit : ' + note);
});

t('sans flotte relevée, aucun avertissement de flotte au sol', () => {
  const g = app(s => { LUNE(s); delete s.planets[0].ships; });
  g.REFRESH.moon();
  assert.ok(!/à ta charge/.test(lu(g.html().moonNote || '')));
});

t('la note porte la règle de pushing et la facture espérée', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  const note = lu(g.html().moonNote || '');
  assert.ok(/pushing/i.test(note), 'la règle du jeu : ' + note);
  assert.ok(/Game Operator/.test(note), 'qui prévenir : ' + note);
  assert.ok(/9 tirs/.test(note), 'la facture espérée : ' + note);
});

/* ---------- le tir de lune : ce qui meurt, et rien de plus ---------- */

t('la chance se calcule sur ce qui meurt, pas sur ce qu\'il envoie', () => {
  /* 1 667 chasseurs légers, le nombre qu'il faut pour 20 % si tout meurt :
     la défense du HQ n'en tue qu'un millier, donc le tir vaut 12 %, pas 20 %. */
  const g = app(s => { LUNE(s); s.moonCalc.n = 1667; });
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/1,20 M/.test(out), 'les débris de ce qui meurt : ' + out);
  assert.ok(!/2,00 M/.test(out), 'pas ceux de ce qui part : ' + out);
  assert.ok(/12 %/.test(out), 'la chance réelle : ' + out);
});

t('une défense rasée ne promet aucune chance', () => {
  const g = app(s => { LUNE(s); s.planets[0].defs = {}; });
  g.REFRESH.moon();
  assert.ok(/0 %/.test(lu(g.html().moonOut || '')), 'aucune chance');
  const note = lu(g.html().moonNote || '');
  assert.ok(!/Facture/.test(note), 'aucune facture : ' + note);
  assert.ok(/n\'en tue aucun/.test(note), 'et la carte le dit : ' + note);
});

t('la carte dit quand la défense plafonne la chance visée', () => {
  const g = app(s => { LUNE(s); s.moonCalc.n = 1667; s.moonCalc.viser = 20; });
  g.REFRESH.moon();
  assert.ok(/plafonne/.test(lu(g.html().moonNote || '')), lu(g.html().moonNote || ''));
});

t('une défense jamais relevée suppose que tout meurt', () => {
  const g = app(s => { LUNE(s); s.planets[0].defs = null; });
  g.REFRESH.moon();
  assert.ok(/12 %/.test(lu(g.html().moonOut || '')));
});

t('la vieille forme p.def suffit à rendre un verdict de défense', () => {
  const g = app(s => { LUNE(s); delete s.planets[0].defs; s.planets[0].def = 4216; });
  assert.notEqual(g.luneDefense(g.S.planets[0], 'lf', 0), null,
    'defsOf sait lire p.def seul, luneDefense doit passer par lui');
});

t('sans vaisseau, la note se vide aussi', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  assert.ok(/Facture/.test(lu(g.html().moonNote || '')), 'posée une première fois');
  g.S.moonCalc.n = 0;
  g.REFRESH.moon();
  assert.ok(!/Facture/.test(lu(g.html().moonNote || '')), 'le tir d\'avant ne reste pas');
});

t('la règle de pushing est dite dans le bon sens', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  const note = lu(g.html().moonNote || '');
  assert.ok(/mieux classé/.test(note), note);
  assert.ok(/pushing/i.test(note) && /Game Operator/.test(note), note);
  assert.ok(!/renvoyer/.test(note), 'le risque est de ramasser, pas de renvoyer : ' + note);
});

t('la facture se dit moyenne, pas promesse', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  assert.ok(/moyenne, pas une promesse/.test(lu(g.html().moonNote || '')));
});

t('la facture compte le deutérium des coques qui en coûtent', () => {
  const g = app(), f = g.luneFacture('rp', 30, 30);
  assert.equal(f.deut, f.tirs * 30 * 20000);
  assert.equal(g.luneFacture('lf', 1000, 30).deut, 0);
});

t('le plancher exclut 100 000 pile, comme la règle le dit', () => {
  const g = app();
  assert.equal(g.luneTir('lf', 50, 50).debris, 100000);
  assert.equal(g.luneTir('lf', 50, 50).chance, 0, '« more than 100k debris »');
  assert.equal(g.luneVaisseaux('lf', 1, 50), 51, 'un vaisseau de plus pour dépasser');
});

t('le plafond inclut 2 M pile, comme le tableau du wiki', () => {
  const g = app();
  assert.equal(g.luneTir('pr', 5000, 40).debris, 2000000);
  assert.equal(g.luneTir('pr', 5000, 40).chance, 20);
  assert.equal(g.luneVaisseaux('pr', 20, 40), 5000);
});

t('une chance visée décimale est arrondie une seule fois', () => {
  const g = app(s => { LUNE(s); s.moonCalc.viser = 12.5; });
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/Pour 13 %/.test(out), 'ce qui est annoncé : ' + out);
  assert.ok(/084/.test(out), 'et le nombre qui va avec : ' + out);
});

t('un nom de planète hostile ne s\'exécute pas dans l\'avertissement', () => {
  const g = app(s => { LUNE(s); s.planets[0].name = '<b>HQ</b>'; s.planets[0].ships = { hf: 538 }; });
  g.REFRESH.moon();
  const brut = g.html().moonNote || '';
  assert.ok(/&lt;b&gt;HQ&lt;\/b&gt;/.test(brut), 'échappé comme ailleurs : ' + brut);
});

/* ---------- le tir de lune : le rangement d'après revue ---------- */

t('le taux de débris est un réglage d\'univers, donc il se synchronise', () => {
  const g = app(s => { LUNE(s); s.settings.debris = 50; });
  assert.equal(g.syncOut()['sy:settings'].debris, 50, 'il part vers l\'autre poste');
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/2,00 M/.test(out), 'la carte le lit : ' + out);
  assert.ok(!/1,20 M/.test(out), 'et pas les 30 % par défaut : ' + out);
});

t('le coût du vaisseau de colonisation n\'a qu\'une source', () => {
  const g = app();
  assert.strictEqual(g.SHIP_COST.col, g.COL_SHIP_COST, 'la même table, pas une copie');
});

t('l\'avertissement de flotte dit de quand date le relevé', () => {
  const g = app(s => { LUNE(s); s.planets[0].ships = { hf: 538 };
    s.planets[0].shipsAt = Date.now() - 3 * 24 * 3600e3; });
  g.REFRESH.moon();
  assert.ok(/relevée il y a/.test(lu(g.html().moonNote || '')), lu(g.html().moonNote || ''));
});

t('une flotte jamais datée ne se vieillit pas', () => {
  const g = app(s => { LUNE(s); s.planets[0].ships = { hf: 538 }; s.planets[0].shipsAt = 0; });
  g.REFRESH.moon();
  assert.ok(!/relevée il y a/.test(lu(g.html().moonNote || '')));
});

t('les recycleurs se ramènent après le tir, pas avant', () => {
  const g = app(s => { LUNE(s); s.planets[0].ships = { rec: 31 }; });
  g.REFRESH.moon();
  assert.ok(/après le tir/.test(lu(g.html().moonOut || '')), lu(g.html().moonOut || ''));
});

/* Un Oui/Non est une bascule : le select revenu en douce reprendrait deux
   lignes et un clic de plus, et la poignée lit `checked`, pas `value`. */
t('les réglages Oui/Non sont des bascules cochées selon le réglage', () => {
  const h = app(s => { s.settings.geo = true; s.settings.lean = false; }).VIEWS.settings();
  assert.ok(!/>Oui</.test(h), 'plus aucune liste Oui/Non');
  assert.match(h, /id="sGeo" data-set="geo" checked/);
  assert.match(h, /id="sLean" data-set="lean" >/);
  assert.match(app().VIEWS.fleet(), /id="expoPf" data-expo="pf" checked/);
});

/* ---------- les faits du serveur ---------- */

/** serverData.xml tel que le fond de tâche le range : Celestia, vitesse 8. */
const API_SERVEUR = {
  server: { name: 'Celestia', number: 284, version: '13.1.1-r5', galaxies: 5, systems: 499,
    donutGalaxy: true, donutSystem: true, speed: 8, speedFleetPeaceful: 3, debrisFactor: 0.3,
    researchDurationDivisor: 2, globalDeuteriumSaveFactor: 0.6, cargoHyperspaceTechMultiplier: 5,
    defToTF: false, marketplaceEnabled: false, bonusFields: 10 },
  at: { server: SOIR }
};

t('la carte Serveur dit les faits du serveur dans ses unités', () => {
  const h = lu(app(s => { s.ui.tool = 'server'; }, SOIR, API_SERVEUR).VIEWS.server());
  assert.ok(/Celestia/.test(h), 'le nom de l\'univers : ' + h.slice(0, 300));
  assert.ok(/×8/.test(h), 'la vitesse éco garde son ×');
  assert.ok(/30 %/.test(h), 'le taux de débris est un pourcent, pas 0,3');
  assert.ok(/Non/.test(h), 'un drapeau à zéro se lit Non, pas 0');
});

t('la carte Serveur ne montre que quatre faits par groupe, le reste replié', () => {
  /* Vingt faits d'affilée noyaient les quatre qui changent le plan. L'ordre de
     SRV_ROWS décide : les quatre premiers présents restent dehors. */
  const h = lu(app(s => { s.ui.tool = 'server'; }, SOIR, API_SERVEUR).VIEWS.server());
  const uni = h.slice(h.indexOf('L\'univers'), h.indexOf('Vitesses'));
  const dehors = uni.slice(0, uni.indexOf('<details'));
  assert.equal((dehors.match(/<li>/g) || []).length, 4, 'quatre lignes dehors : ' + dehors);
  assert.ok(/Le reste \(4\)/.test(uni), 'les autres sont comptées dans le repli : ' + uni);
  assert.ok(uni.indexOf('Celestia') > uni.indexOf('<details'), 'et le nom, qui ne sert à rien de calculé, est dedans');
});

t('les vitesses du serveur passent devant le réglage saisi', () => {
  // réglage faux exprès : ×1 au lieu des ×8 du serveur, et la recherche y est ÷2
  const faux = s => { s.settings.eco = 1; s.settings.fleet = 1; };
  const sans = app(faux).researchTime('energy', 5);
  const avec = app(faux, SOIR, API_SERVEUR).researchTime('energy', 5);
  assert.ok(Math.abs(avec - sans / 16) < 1,
    `la vitesse éco (×8) et le diviseur de recherche (÷2) s'appliquent : ${sans} / 16 ≠ ${avec}`);
});

t('le carburant suit le facteur du serveur', () => {
  const vol = g => g.flight('1:1:8', '1:5:8', { lc: 10 }, 100);
  const sans = vol(app()), avec = vol(app(null, SOIR, API_SERVEUR));
  assert.ok(Math.abs(avec.fuel - (sans.fuel - 1) * 0.6 - 1) <= 1,
    `0,6 de deutérium brûlé : ${sans.fuel} attendu à ${Math.round((sans.fuel - 1) * 0.6) + 1}, lu ${avec.fuel}`);
  assert.ok(avec.secs < sans.secs, 'et la vitesse flotte du serveur raccourcit le vol');
});

t('la carte Lune lit le taux de débris du serveur, sans rien demander', () => {
  const h = lu(app(s => { s.ui.tool = 'moon'; s.settings.debris = 50; }, SOIR, API_SERVEUR).VIEWS.moon());
  assert.ok(/<b class="mono">30 %<\/b>/.test(h), 'le taux lu remplace la liste déroulante : ' + h.slice(0, 400));
  assert.ok(!/data-set="debris"/.test(h), 'plus de réglage à saisir quand le serveur l\'a dit');
});

t('sans serveur, le réglage de débris sert encore', () => {
  const h = lu(app(s => { s.ui.tool = 'moon'; s.settings.debris = 50; }).VIEWS.moon());
  assert.ok(/data-set="debris"/.test(h), 'la liste déroulante reste tant que rien n\'est lu');
  assert.ok(/<option selected>50</.test(h) || /selected>50/.test(h), 'et elle montre le réglage du joueur');
});

t('sans données du serveur, la carte le dit au lieu de casser', () => {
  const g = app(s => { s.ui.tool = 'server'; });
  const h = lu(g.VIEWS.server());
  assert.ok(/serveur/i.test(h));
  g.REFRESH.tools();
});

/* ---------- la page Empire se lit d'un coup d'œil ---------- */

t('chaque planète est une carte repliée qui porte son nom et ses coordonnées', () => {
  const h = lu(app().VIEWS.planets());
  assert.ok(/<details class="card volet"[^>]*data-pi="0"/.test(h), h.slice(0, 600));
  assert.ok(/data-fold="pl:/.test(h), 'le repli se souvient, par planète');
});

t('les cartes de planète partent fermées, même sans clé de repli en mémoire', () => {
  const h = app(s => { s.ui.fold = {}; }).VIEWS.planets();
  assert.ok(/<details class="card volet"/.test(h), 'encore faut-il que la carte soit un volet');
  assert.ok(!/<details class="card volet"[^>]* open/.test(h));
});

t('le résumé porte la production des trois ressources, sans rien déplier', () => {
  const g = app();
  g.VIEWS.planets(); g.REFRESH.planets();
  const s = lu(g.html()['psum-0'] || '');
  const pr = g.production(g.S.planets[0]);
  assert.ok(s.includes(g.fmt(pr.m)) && s.includes(g.fmt(pr.c)) && s.includes(g.fmt(pr.d)), s);
});

t('le bouton Retirer est dans le corps, pas dans le résumé qui bascule le volet', () => {
  const h = lu(app().VIEWS.planets());
  const d = h.indexOf('<summary data-fold="pl:');
  assert.ok(d > -1, 'encore faut-il que la carte ait un résumé');
  const resume = h.slice(d, h.indexOf('</summary>', d));
  assert.ok(!/data-del=/.test(resume), 'un bouton dans le résumé ouvrirait la carte au lieu de retirer');
});


t('les niveaux lus dans le jeu ne se tapent plus', () => {
  const h = lu(app(RELEVE, SOIR, null, true).VIEWS.planets());
  assert.ok(/data-b="metal"[^>]*readonly/.test(h) || /readonly[^>]*data-b="metal"/.test(h), h.slice(0, 800));
});

t("hors extension, les niveaux restent saisissables : rien ne les relève", () => {
  const h = lu(app(RELEVE, SOIR, null, false).VIEWS.planets());
  assert.ok(/data-b="metal"/.test(h), 'la grille existe toujours');
  assert.ok(!/data-b="metal"[^>]*readonly/.test(h));
});

t('une planète que le jeu a nommée sans la visiter garde ses niveaux saisissables', () => {
  const h = lu(app(s => { RELEVE(s); s.planets[1].bNeuve = 1; }, SOIR, null, true).VIEWS.planets());
  const carte = h.slice(h.indexOf('data-pi="1"'));
  assert.ok(/data-b="metal"/.test(carte), 'la grille de la colonie existe toujours');
  assert.ok(!/data-b="metal"[^>]*readonly/.test(carte), 'bNeuve : aucun niveau lu, il faut pouvoir les taper');
});

t("sur les données d'exemple, tout se tape", () => {
  const h = lu(app(s => { s.sample = true; s.planets.forEach(p => { delete p.gid; }); }, SOIR, null, true).VIEWS.planets());
  assert.ok(/data-b="metal"/.test(h), 'la grille existe toujours');
  assert.ok(!/data-b="metal"[^>]*readonly/.test(h));
});

t("le volet des bâtiments annonce combien d'objectifs sont posés", () => {
  const g = app(s => { RELEVE(s); });
  g.prioPose('b', g.S.planets[0].id, 'metal', g.S.planets[0].b.metal + 3);
  const h = lu(g.VIEWS.planets());
  const resume = h.slice(h.indexOf('data-fold="niv:'));
  assert.ok(/1 objectif/.test(resume.slice(0, 200)), resume.slice(0, 200));
});


t("la raison d'une vocation se range derrière un volet, la pastille reste", () => {
  const h = lu(app().VIEWS.planets());
  assert.ok(/Pourquoi cette planète/.test(h), h.slice(0, 600));
  assert.ok(/id="pvoc-0"/.test(h) && /id="pvocw-0"/.test(h), 'pastille et raison sont deux trous distincts');
});

t('la note du centre est dans le volet des raisons, pas dans le passage', () => {
  const h = lu(app().VIEWS.planets());
  const i = h.indexOf('Pourquoi cette planète');
  assert.ok(i > -1 && h.indexOf('id="pctrn-0"') > i, 'pctrn doit suivre le résumé du volet');
  assert.ok(h.indexOf('id="pfleet-0"') > -1 && h.indexOf('id="pfleet-0"') < i, 'la flotte à quai est un fait court : elle reste visible');
});

t("le pavé du mélange se replie, les jauges d'empire restent", () => {
  const h = lu(app().VIEWS.planets());
  assert.ok(/Pourquoi ce classement/.test(h));
  assert.ok(/id="empireRes"/.test(h) && /id="empireFactor"/.test(h), 'les chiffres ne se replient pas');
  const i = h.indexOf('Pourquoi ce classement');
  assert.ok(h.indexOf('id="empireMix"') > i);
});

t('la raison de la vocation arrive dans son propre trou, pas dans la pastille', () => {
  const g = app();
  g.VIEWS.planets(); g.REFRESH.planets();
  const h = g.html();
  assert.ok(!/class="note"/.test(h['pvoc-0'] || '') || !/pill/.test(h['pvoc-0'] || ''),
    'la pastille ne porte plus la raison : ' + (h['pvoc-0'] || ''));
  assert.ok('pvocw-0' in h, 'REFRESH doit écrire la raison, même vide');
});


t('les stocks ont leur propre volet, hors de celui des bâtiments', () => {
  const h = lu(app().VIEWS.planets());
  const stk = h.indexOf('data-fold="stock:');
  assert.ok(stk > -1, 'un volet de stock existe');
  assert.ok(h.indexOf('data-s="m"') > stk, 'les champs de stock suivent leur propre résumé');
});

t('le résumé des stocks porte les trois valeurs, sans ouvrir', () => {
  const g = app();
  g.VIEWS.planets(); g.REFRESH.planets();
  const s = lu(g.html()['pstk-0'] || '');
  const st = g.S.planets[0].stock;
  assert.ok(s.includes(g.fmt(st.m)) && s.includes(g.fmt(st.c)) && s.includes(g.fmt(st.d)), s);
});

t('une planète sans aucune forme de vie garde son volet de stock', () => {
  const h = lu(app(s => { s.planets.forEach(p => { p.lf = {}; }); }).VIEWS.planets());
  assert.ok(/data-fold="stock:/.test(h));
  assert.ok(/aucune case de forme de vie relevée/.test(h), 'et la phrase des formes de vie tient toujours');
});


if (failures.length) {
  for (const [name, e] of failures) console.error('ÉCHEC  ' + name + '\n       ' + e.message);
  console.error('\n' + failures.length + ' échec(s), ' + passed + ' réussite(s)');
  process.exit(1);
}
console.log(passed + ' vérifications passées');
