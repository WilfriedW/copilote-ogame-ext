/* Qui joue, et ce qu'il veut voir en premier.

   Un mineur, un raideur et un explorateur ne cherchent pas la même chose dans
   la même liste de cartes : mines et énergie pour l'un, vitesse et soute pour
   l'autre, expéditions pour le troisième. Les poids ci-dessous disent, pour
   chaque style, ce qui passe devant (3) et ce qui ne sort pas du tout (0).

   Ils sont ici, et non dans app.js, parce que ce sont des réglages : les
   relire, les discuter et les corriger ne doit pas obliger à relire la
   logique qui les applique. Même rôle que `ids.js` pour les identifiants du
   jeu. Le fichier est chargé par `sidepanel.html` avant `boot.js`. */
var PROFILS = {
  /* Le poids d'une carte dont la catégorie n'est pas dans la table : ni
     poussée, ni écartée. C'est la place qu'elle avait avant le profil. */
  neutre: 2,

  /* Les cinq façons de jouer, telles que les guides de styles les nomment.
     `classe` est la classe du jeu qui va avec — montrée à l'étape 2 comme
     conseil, jamais imposée. `plan` est ce que le plan du jour vise alors :
     c'est le réglage « Ce que le plan vise » qui existait déjà, et que
     l'assistant pose pour que le style serve à deux choses d'un coup.
     `defense` est la clé du modèle de défense qu'il pose par défaut, dans
     `DEF_MODELES` : seul le turtle vise la tortue de fin de partie, les
     autres se contentent du framework du mineur. Les ratios, eux, restent
     dans `app.js`, là où le wiki les a mis — ici on ne nomme que le modèle.
     `plancher` est la défense minimale, en packs du modèle, que le plan fait
     tenir à chaque planète avant de monter vers le palier visé : un mineur
     reste rentable à piller tant qu'il grimpe. Réglable dans Réglages. */
  styles: {
    mineur:      {n:'Mineur',      classe:'collector', plan:'ecocol', defense:'framework', plancher:2,
      aide:'Des mines, des colonies, et de la recherche qui les fait rapporter. Rien ne décolle.'},
    turtle:      {n:'Turtle',      classe:'collector', plan:'ecocol', defense:'turtle',
      aide:'Des mines, et une défense qui coûte plus cher à percer qu\'elle ne rapporte.'},
    raideur:     {n:'Raideur',     classe:'general',   plan:'raid',   defense:'framework',
      aide:'Voir les inactifs, y aller vite, en mener plusieurs à la fois. De la soute, pas de défense.'},
    fleeter:     {n:'Fleeter',     classe:'general',   plan:'fleet',  defense:'framework',
      aide:'Une flotte de combat et les technologies qui la font gagner. Le reste la finance.'},
    explorateur: {n:'Explorateur', classe:'explorer',  plan:'fleet',  defense:'framework',
      aide:'Des expéditions, beaucoup, et la soute pour en ramener quelque chose.'},
  },

  /* Les trois classes du jeu, plus l'absence de préférence : le vide veut dire
     « prends celle que tu conseilles », et c'est elle qui sert aux calculs. */
  classes: {collector:'Collecteur', general:'Général', explorer:'Explorateur', '':'Pas de préférence'},

  activites: {
    peu:      {n:'Peu présent', aide:'Deux passages par jour. La mise à l\'abri passe avant tout le reste.'},
    regulier: {n:'Régulier',    aide:'Plusieurs passages par jour, sans y vivre.'},
    actif:    {n:'Très actif',  aide:'En ligne souvent : rien n\'est plafonné.'},
  },

  /* Les catégories dont relève une carte. Leur libellé sert à dire au joueur
     pourquoi une carte est là, ou pourquoi elle n'y est plus. */
  cats: {
    mines:   'Mines et énergie',
    stock:   'Stockage',
    infra:   'Installations',
    def:     'Défense',
    techdef: 'Techs défensives',
    techeco: 'Techs économiques',
    cargo:   'Cargos et logistique',
    combat:  'Flotte de combat',
    expo:    'Expéditions',
    espio:   'Espionnage, vitesse, emplacements',
  },

  /* 0 : jamais. 3 : prioritaire. Une ligne par style, pour qu'on puisse la
     lire d'un bloc — c'est le style qu'on change, pas la catégorie. */
  /* `infra` vaut 2 presque partout, et c'est voulu : une usine de robots, un
     labo ou un chantier servent tous les styles, personne ne les écarte. Seul
     le fleeter monte à 3, parce que le chantier et les nanites sont le goulet
     de sa flotte. Ce qui donne au joueur une vraie prise, c'est le focus :
     +2 par-dessus, donc 3 pour tout le monde quand il le coche. */
  poids: {
    mineur:      {mines:3, stock:2, infra:2, def:2, techdef:1, techeco:3, cargo:2, combat:0, expo:1, espio:1},
    turtle:      {mines:3, stock:2, infra:2, def:3, techdef:3, techeco:2, cargo:2, combat:0, expo:1, espio:1},
    raideur:     {mines:1, stock:1, infra:2, def:0, techdef:2, techeco:1, cargo:3, combat:2, expo:1, espio:3},
    fleeter:     {mines:1, stock:1, infra:3, def:1, techdef:3, techeco:1, cargo:1, combat:3, expo:1, espio:3},
    explorateur: {mines:2, stock:2, infra:2, def:1, techdef:1, techeco:2, cargo:3, combat:1, expo:3, espio:2},
  },

  /* Un focus ponctuel ne remplace pas le style : il ajoute +2 à ses
     catégories, plafonné à 3. Il reste posé jusqu'à ce que le joueur le
     retire — aucune date, aucune expiration. */
  /* Le libellé d'un focus dit ce qu'il pousse, et rien de plus. « Recherche »
     tout court laissait croire qu'il portait aussi les recherches de forme de
     vie : il ne les touche pas, elles ont leur propre réglage dans Réglages
     (« Place des formes de vie »), qui décide bien plus que l'ordre — avant
     les bâtiments, après, ou pas du tout. Deux commandes pour une même chose
     s'annuleraient l'une l'autre ; celle qui existait est la plus forte, on la
     laisse seule et on cesse de promettre à côté. */
  focus: {
    mines:     {n:'Mines',            cats:['mines']},
    stock:     {n:'Stockage',         cats:['stock']},
    infra:     {n:'Installations',    cats:['infra']},
    def:       {n:'Défense',          cats:['def']},
    expo:      {n:'Expéditions',      cats:['expo']},
    raids:     {n:'Raids',            cats:['cargo','espio']},
    combat:    {n:'Flotte de combat', cats:['combat']},
    /* `court` sert la ligne du profil, qui doit tenir sur une ligne ; `n` sert
       la case à cocher, où il y a la place de dire ce qu'on pousse. Sans les
       deux, « + Recherche (armes et économie), Expéditions » débordait du
       résumé — et c'est sur cette ligne-là que le joueur lit son profil d'un
       coup d'œil. */
    recherche: {n:'Recherche (armes et économie)', court:'Recherche', cats:['techdef','techeco']},
  },

  /* Peu présent : ce qui demande d'être en ligne au bon moment est plafonné à
     1. La soute n'en fait pas partie, c'est elle qui met les ressources à
     l'abri — la plafonner reviendrait à écarter ce qu'on veut mettre devant. */
  plafonds: {peu:{combat:1, espio:1}, regulier:{}, actif:{}},

  /* La mise à l'abri n'est pas une préférence de style : elle ne se pondère
     pas, elle se place. Chez qui passe peu, elle passe devant tout. */
  abri: {peu:4, regulier:3, actif:3},

  /* De quoi relève une carte du plan, d'après ce qu'elle construit.
     `kinds` pour les cartes qui ne portent pas de clé ; `bat` et `tech` pour
     les bâtiments et les recherches, où c'est la clé qui décide. Ce qui n'est
     listé nulle part garde son rang : un chantier spatial ou un laboratoire
     sert tous les styles. */
  actes: {
    kinds: {sats:'mines', expo:'expo', transfer:'cargo', raid:'espio', fleet:'abri', def:'def'},
    /* Un chantier se juge sur ce qu'il sort : un lot de grands transporteurs et
       un lot de chasseurs ne servent pas le même joueur. Sans cette table, la
       catégorie `combat` n'était attribuée nulle part et le 0 du mineur comme
       du turtle ne pesait sur rien. Le vaisseau de colonisation n'y est pas :
       il sort par sa propre carte, que rien ne pondère. */
    vaisseaux: {sc:'cargo', lc:'cargo', rec:'cargo', pr:'espio', pf:'expo',
      lf:'combat', hf:'combat', cr:'combat', bs:'combat', bc:'combat',
      bb:'combat', ds:'combat', rp:'combat'},
    /* Tous les bâtiments, sans exception : un test le vérifie. Les six qui
       manquaient — robot, chantier, labo, nanites, terraformeur, dock —
       restaient au poids neutre quel que soit le profil, et aucun focus ne
       pouvait les remonter. C'était invisible parce que le garde ne regardait
       que dans l'autre sens : il refusait une catégorie inutilisée, pas un
       bâtiment sans catégorie. */
    bat: {metal:'mines', crystal:'mines', deut:'mines', solar:'mines', fusion:'mines',
      smetal:'stock', scrystal:'stock', sdeut:'stock', silo:'stock', depot:'cargo',
      robot:'infra', shipyard:'infra', lab:'infra', nanite:'infra', terra:'infra', dock:'infra'},
    tech: {weapons:'techdef', shielding:'techdef', armour:'techdef',
      plasma:'techeco', energy:'techeco', astro:'techeco',
      espionage:'espio', computer:'espio', combustion:'espio', impulse:'espio', hyperdrive:'espio',
      hyper:'cargo'},
  },

  /* De quoi relève une carte à faire, d'après sa rubrique — et, pour les
     quelques-unes dont la rubrique ne suffit pas, d'après son identifiant.

     Une carte qui demande d'ouvrir une page du jeu n'est pas un conseil : elle
     remplit ce que le copilote ne sait pas encore, et ce qu'elle rapporte sert
     bien au-delà de sa rubrique. `defseen` en est l'exemple : sans la page
     Défense lue, `p.def` reste nul, et c'est lui qui commande aussi les
     satellites solaires. La ranger sous « Défense » la faisait disparaître
     chez le raideur, qui perdait du même coup son énergie la moins chère.
     Ces cartes-là gardent donc leur rubrique — « Sécurité », donc `abri` —
     et aucun style ne peut les masquer. */
  missions: {
    q: {'Sécurité':'abri', 'Lune':'abri', 'Exploration':'expo', 'Pillage':'espio',
      'Flotte':'espio', 'Colonie':'techeco', 'Chantier':'cargo'},
    id: {expocargo:'cargo'},
  },
};
