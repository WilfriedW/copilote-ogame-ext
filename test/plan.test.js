/* Le plan du jour : src/plan/ vu depuis les priorités du joueur (pose,
   ordre, paliers, priorité de recherche) et la pose d'un niveau visé sur
   toutes les planètes. Lancé par test/run.js. */
module.exports = ({ t, assert, app, lu, SOIR, prioLabo, prePlasma, POSE }) => {
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

  t('un prérequis bâtiment devient le pas de la priorité', () => {
    /* Les Nanites demandent Robots 10, la mère en a 6 : la priorité monte Robots,
       épargne pour lui, et la carte dit d'où vient ce chantier. Avant, elle
       attendait un niveau que personne ne construisait. */
    const p = app(s => { s.prio = [{kind:'b', pid:'mere', k:'nanite', lvl:1}]; }).simulateDay();
    const g = p.sessions[0].goals.filter(x => x.key.startsWith('prio:'));
    assert.equal(g.length, 1, 'elle épargne');
    assert.match(g[0].key, /robot/, 'pour le prérequis : ' + g[0].key);
    const dit = p.sessions[0].acts.concat(p.sessions[0].waits).map(x => x.why || '').join(' ');
    assert.match(dit, /Nanites 1 en priorité/, dit);
    assert.match(dit, /Robots 10/, dit);
  });

  t('prioAvant remonte la chaîne jusqu\'au niveau constructible', () => {
    const g = app();
    // Terraformeur demande Nanites 1, qui demande Robots 10 : c'est Robots le pas.
    assert.deepEqual(g.prioAvant(g.S.planets[0], 'terra'), {k:'robot', lvl:10});
    assert.deepEqual(g.prioAvant(g.S.planets[0], 'nanite'), {k:'robot', lvl:10});
    assert.equal(g.prioAvant(g.S.planets[0], 'robot'), null, 'rien ne manque sous Robots');
    assert.equal(g.prioAvant(g.S.planets[0], 'metal'), null, 'une mine n\'a aucun prérequis');
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

  /* ---------- poser un niveau visé sur toutes les planètes ---------- */


  t('la carte montre une ligne par planète, avec son niveau actuel', () => {
    const g = app(POSE('metal', 43));
    const l = g.poseLignes();
    assert.equal(l.length, 2);
    assert.deepEqual(l.map(x => x.actuel), [14, 4]);
    assert.deepEqual(l.map(x => x.agit), [true, true]);
  });

  t('une planète décochée pour un bâtiment reste cochée pour les autres', () => {
    const g = app(POSE('metal', 43, {metal: ['colo']}));
    assert.deepEqual(g.poseLignes().map(x => x.coche), [true, false]);
    g.S.ui.pose.k = 'lab';
    assert.deepEqual(g.poseLignes().map(x => x.coche), [true, true]);
  });

  t("une planète déjà au-dessus du niveau visé n'agit pas", () => {
    const g = app(POSE('metal', 10));
    assert.deepEqual(g.poseLignes().map(x => x.agit), [false, true]);
  });

  t('une priorité déjà posée se voit avant la pose', () => {
    const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:50}]; POSE('metal', 43)(s); });
    const l = g.poseLignes();
    assert.equal(l[0].deja, 50);
    assert.equal(l[1].deja, null);
  });

  t("un id resté dans les décochées après l'oubli d'une planète ne gêne rien", () => {
    const g = app(POSE('metal', 43, {metal: ['disparue']}));
    assert.deepEqual(g.poseLignes().map(x => x.coche), [true, true]);
  });

  t('un bâtiment inconnu retombe sur la mine de métal au lieu de lever', () => {
    const g = app(POSE('__proto__', 43));
    assert.equal(g.poseK(), 'metal');
    assert.equal(g.poseLignes()[0].actuel, 14);
  });

  t('sur un empire d\'une seule planète, la carte rend une seule ligne', () => {
    // Zéro planète ne se teste pas : sample() en crée une, le panneau interdit de
    // retirer la dernière, et coloSystem() (app.js:2131) lève sans elle.
    const g = app(s => { s.planets = [s.planets[0]]; POSE('metal', 43)(s); });
    assert.deepEqual(g.poseLignes().map(x => x.pid), ['mere']);
  });

  t('poser écrit une priorité par planète cochée', () => {
    const g = app(POSE('metal', 43));
    assert.equal(g.posePartout(), 2);
    assert.equal(g.prioLvl('b', 'mere', 'metal'), 43);
    assert.equal(g.prioLvl('b', 'colo', 'metal'), 43);
  });

  t('une planète décochée ne reçoit rien', () => {
    const g = app(POSE('metal', 43, {metal: ['colo']}));
    assert.equal(g.posePartout(), 1);
    assert.equal(g.prioLvl('b', 'colo', 'metal'), '');
  });

  t("un niveau visé vide ne pose rien et n'efface rien", () => {
    const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:50}]; POSE('metal', '')(s); });
    assert.equal(g.posePartout(), 0);
    assert.equal(g.prioLvl('b', 'mere', 'metal'), 50);
  });

  t('une planète déjà au-dessus garde la priorité qu\'elle avait', () => {
    const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:50}]; POSE('metal', 10)(s); });
    assert.equal(g.posePartout(), 1, 'la colonie seule');
    assert.equal(g.prioLvl('b', 'mere', 'metal'), 50, 'la mère n\'est pas effacée');
  });

  t('la carte nomme chaque planète et compte ce qu\'elle va poser', () => {
    const g = app(POSE('metal', 43, {metal: ['colo']}));
    const h = lu(g.poseBloc());
    assert.ok(h.includes('Planète mère'));
    assert.ok(h.includes('Colonie'));
    assert.ok(/Poser sur 1 planète/.test(h), h);
  });

  t('la carte dit quand une planète vise déjà plus haut', () => {
    const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:50}]; POSE('metal', 43)(s); });
    assert.ok(lu(g.poseBloc()).includes('déjà visé 50'));
  });

  t('la carte est dans Recherche / Cibles', () => {  // ENH-75 : elle a quitté Empire
    const g = app(POSE('metal', 43));
    assert.ok(lu(g.VIEWS.niveaux()).includes('Cible sur plusieurs planètes'));
  });

  t('le bouton de la carte pose vraiment', () => {
    const g = app(POSE('metal', 43, {metal: ['colo']}));
    g.click('view', { closest: sel => (sel === '[data-posego]' ? { dataset: { posego: '1' } } : null) });
    assert.equal(g.prioLvl('b', 'mere', 'metal'), 43);
    assert.equal(g.prioLvl('b', 'colo', 'metal'), '', 'la décochée reste intacte');
  });
};
