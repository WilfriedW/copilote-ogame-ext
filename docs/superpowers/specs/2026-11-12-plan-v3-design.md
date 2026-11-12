# Copilote OGame — v3 : qu'il dise ce qu'il sait

Document de conception, 12 novembre 2026. Fait suite à
`2026-11-11-plan-v2.md` et au document « Copilote OGame — Plan révisé et
spécification v3 ».

## Intention

Le joueur suit le copilote sans vérifier. C'était l'objectif de la file
unique, et c'est atteint : il fait ce que le panneau lui dit. Le problème
a donc changé de nature. Un conseil faux ne coûte plus une hésitation, il
coûte une action.

Quatre symptômes relevés en jeu le 12 novembre, tous confirmés dans le
code, racontent la même histoire :

| Symptôme | Cause réelle |
| --- | --- |
| Il propose une expédition alors que le jeu affiche `Expéditions 2/2` | Le compteur du jeu est lu, mais seul le plafond est gardé ; le nombre en vol est jeté. Le plan se rabat sur la page *Mouvements de flotte*, que le joueur n'ouvre pas |
| Un lien de construction n'est pas prérempli, contrairement à un transport | OGame n'accepte des paramètres d'URL que sur `fleetdispatch`. Le copilote ouvre la bonne page et s'arrête là, sans le dire |
| Une mission de découverte renvoie « Réussite — Vaisseau d'exploration envoyé (0) » | Le copilote n'envoie rien, il ouvre la Galaxie. Le `(0)` est le nombre de vaisseaux d'exploration restants, que le panneau n'affiche nulle part |
| Il demande d'ouvrir une case de forme de vie, puis conseille de monter celle qu'on vient d'ouvrir | `lfCandidates` trie sur le prix seul (`mse(...a.cost)`), et `lfPriced` n'accepte qu'un prix lu au niveau exact — donc seule la case qu'on vient d'ouvrir est éligible. La boucle se referme sur elle-même |

Le moteur sait classer les mines par délai de retour. C'est son cœur et
il le fait bien. Tout le reste est branché à côté : les formes de vie
trient sur le prix, les expéditions comptent sur une page non ouverte,
les découvertes ne comptent rien. La v3 dit la même chose à sa manière —
« chaque bâtiment et recherche de forme de vie est une option du
catalogue, classée par délai de retour comme une mine ».

**La v3 ne consiste donc pas à ajouter dix-sept fonctions. Elle consiste
à faire dire au copilote ce qu'il sait déjà, et à faire passer tout le
reste par le même classement.**

## Objectifs

- Aucune carte ne propose une action que le jeu refusera.
- Quand le copilote ne peut pas préremplir, il le dit, au lieu de laisser
  le joueur attendre un formulaire rempli.
- Les formes de vie, les recherches et les raids sont classés par délai
  de retour, dans la même file que les mines, avec leurs prérequis et
  leur énergie dans le coût.
- Avant la nuit, le joueur sait ce qu'il expose et ce qu'il risque.
- Aucune carte de raid ne sort sans vérifier la protection et le bashing.

## Non-objectifs

- Le découpage en `src/formulas/` et `src/engine/`. Décision reprise de
  la v2 et confirmée : l'extension charge des scripts classiques par le
  manifeste ; le découpage exige un bundler ou des modules ES pour zéro
  changement de comportement. Le besoin réel derrière — des formules
  isolées et testées — est déjà tenu par `test/`.
- L'extraction de `classModifiers` dans un fichier de données. Les bonus
  Collecteur sont déjà appliqués dans le moteur, vérifié le 12 novembre :
  mines ×1,25 (`production`), énergie ×1,10, transporteurs vitesse ×2 et
  fret +25 % (`shipStats`), foreuses ×1,5 (`crawlerBonus`). Les déplacer
  ne change rien pour le joueur.
- Toute automatisation. Aucun clic simulé, aucun événement déclenché,
  aucun champ rempli, aucune requête vers les pages du jeu.

## Anti-objectifs

Ce qui ferait échouer la v3 même si tout fonctionne :

- Un conseil que le joueur suit et qui lui coûte une flotte. Un raid sur
  une cible protégée, un fleetsave à heure fixe, une planète laissée sans
  le deutérium de la retraite tactique.
- Un panneau qui redevient un tableau de bord à vérifier. Si le joueur
  doit rouvrir le jeu pour contrôler un chiffre, le chiffre n'avait pas
  sa place dans le panneau.
- Un bannissement. Les quatre garde-fous des lecteurs ne sont pas
  négociables, et un test automatisé doit les faire respecter.

## Contraintes

**Règles Gameforge.** Les rappels et minuteurs sont explicitement
autorisés ; l'espionnage de masse automatisé est interdit. Les quatre
garde-fous imposés au code :

1. Les lecteurs DOM lisent seulement : aucun clic simulé, aucun événement
   déclenché, aucune modification du DOM du jeu, aucun champ rempli.
2. Aucune requête réseau vers les pages du jeu ni avec la session du
   joueur. Seul appel autorisé : l'API publique (`/api/*.xml`), cache
   d'au moins une heure.
3. L'interface vit dans le panneau latéral ou la popup, jamais injectée
   dans la page du jeu.
4. Les actions passent par des liens préremplis (`fleetdispatch`,
   `galaxy`) que le joueur ouvre et valide lui-même.

**Données.** Aucune valeur d'univers codée en dur : tout ce que publie
`serverData.xml` est lu et mis en cache (vitesses, protection, bashing,
diviseur de recherche, bonus de cases).

**Livraison.** Un fichier = un objet, JSDoc sur chaque méthode, pas de
bandeaux de commentaires, commentaires en anglais. Numéro de version
visible dans le panneau et le manifeste, incrémenté à chaque livraison.
Cette spécification vise la **3.0.0**. Version actuelle : 1.24.0.

## Le plan, en quatre vagues

L'ordre a été arrêté avec le joueur le 12 novembre. Il va du mensonge le
moins cher à corriger au chantier dont dépendent les autres, puis à ce
qui protège une flotte, puis au reste.

### Vague 1 — qu'il arrête de mentir

Trois corrections courtes, sur des symptômes que le joueur a touchés du
doigt. Elles passent en premier parce que la confiance est ce qui fait
qu'il suit sans vérifier.

- **Expéditions en vol.** `S.slots.expo` vaut `[en vol, plafond]` et est
  lu sur la page de flotte ; seul `[1]` est consommé aujourd'hui
  (`expoCap`). Amorcer le compte des expéditions occupées avec `[0]`
  plutôt que d'attendre `S.moves`, qui ne se remplit que sur la page
  *Mouvements de flotte*. Ce chiffre se périme, contrairement au plafond :
  il est tenu pour vrai trois heures, comme `fleetSlots()`, et toute
  carte qui en dépend porte l'heure de la lecture (« expéditions 2/2, lu
  à 14 h 12 »). Passé ce délai, le plan reprend la main et le dit.
  *Décision de conception, à la relecture : ne jamais le périmer ferait
  taire le copilote pour la journée entière, ce qui abîme la confiance
  autant que le mensonge de départ.*
- **Découvertes.** Lire et afficher les vaisseaux d'exploration restants
  à côté du stock d'artefacts, déjà lu. Aucune carte de découverte quand
  il n'en reste pas. *Décision de conception : ce compteur est lu sur la
  page du jeu, jamais reconstitué à partir du « départ 50, +50 par jour »
  — une valeur d'univers calculée dans notre coin violerait la contrainte
  de données et remplacerait un mensonge par un autre. Tant qu'il n'est
  pas lu, le panneau ne gate rien et ne prétend rien.*
- **Construction.** Dire sur la carte que le lien ouvre la page de la
  bonne planète et que le jeu ne permet pas de préremplir un bâtiment.
  Limite du jeu, assumée à voix haute.

### Vague 2 — le classement unique

Le gros morceau, et celui dont dépendent les autres.

- **Lecteur de la page Ressources, en premier.** La v2 avait noté le
  calibrage observé/théorique des mines comme non fait, faute de lecteur ;
  la v3 le tient pour acquis. Il ne l'est pas. Comme toute la vague 2
  classe « par délai de retour comme une mine », ce lecteur passe devant
  le reste : production réelle par mine et capacité des hangars. Seule
  l'énergie est calibrée aujourd'hui (`p.eAdj`). *Point relevé à la
  relecture ; la place dans l'ordre est une décision de conception.*
- **Les formes de vie entrent dans le catalogue d'options**, classées par
  délai de retour comme une mine. Le coût d'une option inclut les
  bâtiments de population et de nourriture qu'elle exige. Leur
  consommation d'énergie entre dans le bilan. Un bâtiment agit sur sa
  planète, une recherche sur tout le compte.
- **Le lecteur de forme de vie relève bonus, énergie et prérequis**, pas
  seulement un prix qui périme au niveau suivant. Les valeurs sont lues
  dans les infobulles et les pages du jeu, jamais codées en dur.
- **Une case non ouverte est quand même classée, avec son prix estimé.**
  Décision du joueur, 12 novembre. Le jeu ne publie le prix d'une case
  que dans son panneau de détail ; attendre qu'il soit ouvert laisse en
  place la boucle « ouvre une case, monte cette case » qui a déclenché
  cette version. Le facteur de croissance se déduit de deux niveaux
  observés sur la même case, ou à défaut du prix périmé reporté. Chaque
  option porte donc une **provenance** — prix lu, prix estimé — qui
  traverse le catalogue, le classement et le texte de la carte : une
  estimation annoncée comme telle ne ment pas, une estimation muette si.
  La même règle vaut pour l'énergie et les prérequis d'un bâtiment pas
  encore construit, que la v2 avait notés illisibles. Une option estimée
  ne passe jamais devant une option lue à délai de retour égal.
- **Espèce par planète** déduite de la clé lue (`lifeform1` Humains,
  `lifeform2` Rock'tal, `lifeform3` Mécas, `lifeform4` Kaelesh).
- **Changement d'espèce** : le moteur le propose quand le délai de retour
  le justifie, en signalant les cases éventuellement perdues. Décision du
  joueur, 12 novembre. Le catalogue compare donc les espèces entre elles,
  pas seulement les cases de l'espèce en place.

  **Prémisse à vérifier avant de livrer cette carte** : « rien n'est
  perdu, bâtiments et recherches reviennent ». Le document v3 l'affirme
  sans source de premier rang, et il reste à établir si cela vaut par
  planète ou sur tout le compte. C'est cette phrase qui rend la
  recommandation sûre : si elle est fausse, le joueur perd
  l'investissement d'une planète sur notre conseil. Tant qu'une source
  officielle ne la confirme pas, la carte n'est pas livrée — ou elle est
  livrée en disant que le retour en arrière n'est pas garanti.
- **Niveau d'espèce** : jusqu'à 100, +1 % de bonus de recherche tous les
  dix niveaux, appliqué comme multiplicateur lu, jamais recalculé.

### Vague 3 — ce qui protège une flotte

Seul endroit où un mauvais conseil coûte une flotte et pas trois heures
de production.

- **`nightPlanner`** : fleetsave en mission Stationner vers une autre de
  tes planètes. *Décision de conception, à la relecture : Stationner est
  un aller simple, la flotte se pose et reste. Le moment calé est donc
  **l'atterrissage**, 30 à 60 minutes après le réveil, décalé de quelques
  dizaines de minutes chaque soir ; le rappel du réveil annonce cet
  atterrissage. C'est un vrai changement : `fleetsavePlan` envoie
  aujourd'hui un Transporter aller-retour et choisit la vitesse sur
  l'heure de retour. Le « retour invisible à la Phalange » du document v3
  concerne le rappel manuel d'une mission Stationner, pas une boucle
  automatique.*

  **Nuit du joueur : 22 h → 5 h 30**, donné le 12 novembre. Les réglages
  par défaut (23 h → 7 h) sont à changer. L'atterrissage visé tombe donc
  entre 6 h et 6 h 30, décalé de quelques dizaines de minutes chaque
  soir. Le rappel du réveil à 5 h 30 annonce cet atterrissage.

  **Le plan vérifie qu'un fleetsave couvre réellement la nuit.** Sept
  heures et demie, c'est long pour un aller simple entre deux planètes
  d'un même empire, surtout dans la même galaxie : à 10 % de vitesse, un
  trajet intra-système se compte en dizaines de minutes et un trajet
  intergalactique en quelques heures. Il faut donc, pour chaque flotte et
  chaque destination possible, comparer la durée de vol la plus longue
  atteignable à la durée de la nuit, et :

  - quand une destination couvre la nuit, la proposer, la plus lente
    d'abord ;
  - quand aucune ne la couvre, **le dire** plutôt que proposer un
    fleetsave qui se pose à 2 h du matin, et se rabattre sur la défense
    qui reste : dépenser ce qui peut l'être avant de dormir, et afficher
    ce qui restera exposé sur chaque colonie.

  Ce calcul n'a pas été vérifié sur les coordonnées réelles du joueur ;
  c'est la première chose à mesurer en ouvrant la vague 3, parce qu'il
  décide si la fonction principale de cette vague est utilisable telle
  quelle.

  Une expédition n'est jamais comptée
  comme une mise à l'abri. Réserve de deutérium signalée sur toute
  planète qui porte une flotte sans de quoi payer la retraite tactique
  (fuite si attaquant ≥ 5 × points, 3 × avec l'Amiral). Total laissé sur
  chaque colonie affiché avant la nuit.
- **Protection et bashing.** Aucune carte de raid avant vérification :
  cibles lues dans `players.xml` (statuts `i` ou `I`, exclure `v` et
  `b`), coordonnées via `universe.xml`, points via `highscore.xml`. Cible
  attaquable si ses points restent dans le rapport 1:10 ou dans les cent
  rangs militaires suivants. Attaquer un joueur trop fort retire la
  protection sept jours : carte bloquée avec explication. Compter les
  attaques gagnées ou nulles par cible, limite lue dans `serverData.xml`.
  Rapport d'espionnage de plus de deux heures : périmé, aucune carte.
  Valeur d'un raid : part pillable × ressources de la cible, plafonnée
  par la soute, moins le deutérium du trajet ; classé par gain net par
  heure d'emplacement de flotte, en concurrence avec les expéditions et
  les rapatriements.

  Quatre décisions de conception prises à la relecture :

  - La vérification protection/bashing s'applique **partout** où une
    cible est nommée, y compris la liste Outils › Cibles et la carte
    `raid-go` d'aujourd'hui, qui ne vérifient rien.
  - Les attaques gagnées ou nulles sont **marquées à la main** par le
    joueur : rien ne lit les rapports de combat, et aucune lecture
    automatique n'est envisageable sans franchir les garde-fous. Quand le
    compte est inconnu, la carte le dit et laisse le joueur trancher ;
    elle ne prétend jamais savoir.
  - Si `serverData.xml` ne publie pas la limite de bashing ou la fenêtre
    de protection sur cet univers, les cartes de raid **ne sont pas
    bloquées** : elles affichent que la règle n'a pas pu être lue. Coder
    une règle standard en dur violerait la contrainte de données ;
    bloquer tout rendrait la fonction inutile sur la moitié des univers.
  - **Le butin d'une cible vient d'un rapport collé, cible par cible.**
    Décision du joueur, 12 novembre. Classer plusieurs cibles par gain
    net demande le butin de plusieurs cibles, et l'espionnage de masse
    automatisé est exactement l'interdit ; estimer le butin sur les
    points du classement produirait le chiffre qui décide qu'un raid
    passe devant une expédition, sans moyen de le rendre honnête. Il faut
    donc une file de saisie là où `S.raid` ne tient qu'un rapport unique :
    plusieurs rapports vivants à la fois, chacun avec son heure de
    lecture et sa péremption à deux heures. Une cible sans rapport frais
    n'est pas classée et n'apparaît pas dans la file.
  - Le rapport 1:10 se lit sur les points totaux
    (`highscore.xml?category=1&type=0`, déjà récupéré) ; les cent rangs
    militaires suivants demandent un **second appel** au classement
    militaire, mis en cache une heure comme le reste de l'API.

### Vague 4 — le reste

Par ordre d'utilité décroissante, à réévaluer une fois la vague 3 livrée.

- **Recherche** : temps réel `(m + c) / (1 000 × vitesse × (1 + labo
  effectif)) ÷ diviseur d'univers`. Labo effectif = labo de départ plus
  les L laboratoires éligibles les plus hauts, ceux sous le niveau requis
  exclus. RRI : coût `(240 000 ; 400 000 ; 160 000) × 2^(L−1)`, utile
  jusqu'à `planètes − 1`. Le RRI n'a pas de gain de production direct :
  sa valeur est le temps gagné sur la file de recherche planifiée,
  converti en production avancée par le simulateur.
- **Colonisation** : positions atteignables par niveau d'Astrophysique,
  taille probable par position, bonus de position, température pour le
  deutérium, temps de trajet. Trois emplacements montrés. Une colonie
  sous environ 200 cases est signalée comme candidate à l'abandon.
  Avertissement, sans blocage, sur le délai de 48 h avant recolonisation
  — source unique, non vérifiée.
- **Checklist mode vacances** : aucune construction, aucune file, aucune
  recherche, aucune flotte en vol, sur toutes les planètes et lunes.
  Rappels : minimum 48 h, production arrêtée, impossible une fois une
  attaque lancée.
- **Terraformeur** (+5 cases par niveau, net +4) et comptage des cases
  libres.
- **Marchand** quand une seule ressource bloque la prochaine dépense.
- **Audit automatisé des garde-fous** : aucun `dispatchEvent`, aucun
  `click()`, aucune écriture DOM, aucun `fetch` hors `/api/`.

## Formules de référence

Reprises du document v3. Celles que la v2 couvre déjà restent
inchangées ; seules les nouvelles sont listées ici.

| Grandeur | Formule |
| --- | --- |
| Planètes max | `1 + ⌊Astro / 2⌋` |
| Positions atteignables | Astro 1 : 4–12 ; 4 : 3–13 ; 6 : 2–14 ; 8 : 1–15 |
| Expéditions max | `⌊√Astro⌋ + 1 si Amiral (+2 Explorateur)` |
| Temps de recherche (h) | `(m + c) / (1 000 × vitesse × (1 + labo effectif)) ÷ researchDurationDivisor` |
| Labo effectif (RRI L) | labo de départ + les L labos éligibles les plus hauts |
| Coût RRI | `(240 000 ; 400 000 ; 160 000) × 2^(L−1)` |
| RRI utile max | `planètes − 1` |
| Bonus position métal | pos 8 : ×1,35 ; 7 et 9 : ×1,23 ; 6 et 10 : ×1,17 |
| Bonus position cristal | pos 1 : ×1,4 ; 2 : ×1,3 ; 3 : ×1,2 |
| Terraformeur | +5 cases par niveau (net +4) |
| Phalange | portée `niveau² − 1` systèmes, 5 000 deut par scan |
| Retraite tactique | fuite si attaquant ≥ 5 × points (3 × avec l'Amiral) |
| Artefacts | une recherche d'une autre espèce coûte 200 / 400 / 600 selon le palier ; prérequis Intergalactic Envoys 1 |

Règle de calibrage inchangée : la production actuelle de chaque mine est
lue sur la page Ressources ; les formules ne calculent que le gain du
niveau suivant, multiplié par le ratio observé/théorique.

## Tests d'acceptation

Tous les tests de la v2 restent obligatoires. S'y ajoutent :

| Entrée | Attendu | Vague |
| --- | --- | --- |
| Le jeu affiche `Expéditions 2/2`, aucune page Mouvements ouverte | Aucune carte d'expédition | 1 |
| Zéro vaisseau d'exploration restant | Aucune carte de découverte ; compteur affiché | 1 |
| Carte de construction | Le texte dit que le lien ouvre la page sans préremplir | 1 |
| Case de forme de vie jamais ouverte | Classée avec un prix estimé, la carte dit « prix estimé » | 2 |
| Option estimée et option lue au même délai de retour | La lue passe devant | 2 |
| Deux soirs de suite, le même fleetsave | Deux heures d'atterrissage différentes, écart d'au moins dix minutes | 3 |
| Nuit 22 h → 5 h 30, aucune destination ne couvre 7 h 30 de vol | Aucun fleetsave proposé ; carte « dépense ce qui peut l'être » et ressources exposées | 3 |
| Bâtiment de forme de vie qui passe l'énergie sous zéro | Coût des centrales ajouté avant classement | 2 |
| Bâtiment de forme de vie exigeant population ou nourriture | Le coût des prérequis est inclus dans le délai de retour | 2 |
| Planète avec flotte, deutérium sous le coût de la retraite | Alerte « réserve de deutérium » avant la nuit | 3 |
| Fleetsave proposé deux soirs de suite | Heures d'atterrissage différentes | 3 |
| Expédition en vol au coucher | Jamais comptée comme mise à l'abri | 3 |
| Cible avec statut `v` ou hors fenêtre de protection | Aucune carte de raid, raison affichée | 3 |
| Cible déjà à la limite de bashing | Aucune carte de raid | 3 |
| Rapport de plus de 2 h | Aucune carte de raid, carte « rapport périmé » | 3 |
| Cible sans rapport collé | Jamais classée, jamais dans la file | 3 |
| Trois rapports collés, un périmé | Deux cibles classées, la troisième signalée périmée | 3 |
| `researchHours(1 600 000, labEffectif 12, vitesse 1)` | ≈ 123 h ; avec labo effectif 22 : ≈ 70 h | 4 |
| `irnCost(3)` | 960 000 / 1 600 000 / 640 000 | 4 |
| RRI proposé avec 6 planètes | Jamais au-delà du niveau 5 | 4 |
| `reachablePositions(5) / (6) / (8)` | 3–13 / 2–14 / 1–15 | 4 |
| Une file de construction active | Checklist vacances : « non disponible » + planète citée | 4 |
| Audit des lecteurs | Aucun `dispatchEvent`, `click()`, écriture DOM ni `fetch` hors `/api/` | 4 |
| `maxExpeditions(9, collector, admiral)` | 4 | — |
| Classe Collecteur, chantier lu | Aucune carte Éclaireur | — |
| Raid : 4 grands transporteurs Collecteur | Soute = 4 × 25 000 × 1,25 = 125 000 | — |

Le test de soute suppose 25 000 de fret par grand transporteur,
technologie Hyperespace ignorée ; à ajuster si le lecteur fournit la
capacité réelle.

## Ce qui est laissé au bâtisseur

- La structure interne de `app.js` : où vivent les nouvelles fonctions,
  comment le catalogue d'options est représenté, comment le simulateur de
  délai de retour absorbe les formes de vie et les raids.
- Les sélecteurs DOM de chaque lecteur, qui ne peuvent pas être devinés
  sans la page sous les yeux ; relever la page réelle avant d'écrire le
  lecteur.
- La forme exacte des cartes et leur libellé, dans la langue et le ton
  des cartes existantes.
- Le découpage des livraisons à l'intérieur d'une vague, et le numéro de
  version de chacune.
- La stratégie de cache de l'API publique au-delà du minimum d'une heure.

## Questions ouvertes

Aucune. Les trois dernières ont été tranchées le 12 novembre et sont
reportées dans les sections correspondantes.

Hors périmètre de la conception : la soumission à la revue Tolerated
Tools ne change pas ce qui est construit, seulement quand c'est envoyé.

## Sources

Document v3 du 12 novembre, qui recoupe neuf guides ogame.life avec le
Wiki et les FAQ officielles. Les pages ogame.life font la promotion d'un
serveur privé (OGameXL) ; elles servent en appui de sources officielles,
jamais seules. Les sources de la v2 restent la référence pour les
formules qu'elles couvrent.
