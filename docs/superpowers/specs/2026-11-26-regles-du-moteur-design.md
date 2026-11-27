# Copilote OGame — Les règles du moteur : ce qui cloche se dit, et le plan y répond

Document de conception, 26 novembre 2026. Projet.

## Intention

L'issue « Conseils et alertes » demande un catalogue de règles — stockage
plein, file vide, labo à l'arrêt, données de forme de vie manquantes — décrites
dans un `rules.json`, chacune activable, avec un badge pour les critiques.

Lue telle quelle, elle construit un second moteur : un bloc « Conseils », un
onglet « Conseils », un tri à lui, un bouton « Ignorer » à lui. Le copilote a
déjà un moteur, et il a été décidé le 8 novembre qu'il n'y en aurait qu'un :
**une seule file** (`comment-ca-marche.md` § 2.2). Le tri, « la seule chose
que le joueur ne sait pas faire », ne se fait pas à deux endroits.

Et le moteur fait déjà une bonne moitié du catalogue, souvent mieux que
l'issue ne le décrit :

- le stockage plein et bientôt plein sont **deux secours** de `pickBuildings`
  (`app.js:3395`) et deux alertes de `planetAlerts` (`app.js:2412`) ;
- l'énergie négative est un secours (`app.js:3389`) et une alerte qui respecte
  déjà l'option satellites (`energyOptions`, `satsOk`, `app.js:4552`) ;
- la mine que le hangar ne peut pas contenir fait déjà sortir le hangar
  (`app.js:3441`) ;
- l'énergie du prochain niveau est déjà comptée dans son prix (`extraSolar`,
  `app.js:3456`) ;
- la colonie disponible a sa mission (`colomax`) et son chemin dans le plan
  (`wantColony`) ;
- les données de forme de vie manquantes ont leurs deux missions (`lfb`,
  `lfr`, `app.js:5093`) et leurs phrases (`prioLfEtat`, `app.js:726`).

Ce qui manque n'est donc pas un moteur, c'est trois choses :

1. **Une description des règles hors du code**, que le joueur active, désactive
   et règle sans attendre une version de l'extension.
2. **Les règles du catalogue que le moteur ne connaît pas** : nanites, champs
   à 10, équilibre métal-cristal, labo à l'arrêt, recherche finançable
   ailleurs, race et noms des formes de vie.
3. **Un niveau** — critique, important, conseil — qui ordonne, et qui compte
   sur l'icône.

**Le point de départ, et la règle de tout ce document : une règle ne fait
pas qu'informer, elle agit sur le moteur.** Elle fait naître une carte que la
simulation paie, elle en suspend d'autres, ou elle donne son niveau à une carte
que le plan sort déjà. Une règle qui ne ferait qu'écrire une phrase à côté du
plan, c'est `S.plan` (commit `be101c4`, « rien ne la lisait »), et on sait
comment ça finit.

## Objectifs

- Chaque règle du catalogue v1 a sa place dans le moteur : un candidat qu'elle
  pousse, une file qu'elle suspend, une carte qu'elle marque, ou une alerte
  quand le plan n'a rien à proposer.
- Les règles sont décrites dans `rules.json` : niveau, seuils, textes,
  source, statut. En changer une ne touche pas au code.
- Le joueur active, désactive et règle chaque règle dans Réglages. Le choix
  suit d'un poste à l'autre.
- Un ordre unique : niveau, puis poids du profil, puis ordre du fichier.
- Le badge de l'icône compte les critiques.
- La race de chaque planète est connue, et les règles de forme de vie
  s'appliquent selon elle ; sans elle, elles se suspendent **et le disent**.
- Les noms des formes de vie sont ceux du jeu, sinon ceux du fichier.

## Non-objectifs

- **Un onglet « Conseils ».** Le bloc des alertes d'Aujourd'hui
  (`tdAlerts`, `app.js:7299`) devient le bloc des conseils, et il se déplie sur
  l'empire. Un cinquième onglet serait le tableau de bord que le 8 novembre a
  défait.
- **Un second tri.** Les cartes du plan gardent l'ordre de la simulation ; le
  niveau ne fait que départager l'affichage d'une même connexion (voir plus
  bas).
- **Un nouveau type de condition sans code.** Ajouter une règle d'un type qui
  existe, ou changer un seuil, ne demande rien. Une condition d'un type neuf
  demande son évaluateur, une fonction de plus dans `app.js`. Promettre
  l'inverse serait promettre un interpréteur.
- **Un `core/formulas.js`.** Les formules vivent dans `app.js` (`levelCost`,
  `production`, `storageCap`, `rankUpgrades`) et le harnais de test les charge
  de là. Les sortir est un chantier à part, qui ne change aucun conseil.
- **La rentabilité, la défense, la flotte, un plan sur plusieurs jours**,
  comme le dit l'issue.
- **Modéliser la population.** Le jeu dit « population trop faible » sur une
  case (`lfState`, `ids.js:106`) ; il ne dit pas si c'est la nourriture ou le
  logement qui manque. Voir FDV_FOOD_LIMIT plus bas.

## Anti-objectifs

Des échecs, même si le code marche :

- **Une règle qui signale sans que le plan bouge.** « Stockage plein » en rouge
  au-dessus d'un plan qui propose une mine impayable : le joueur lit deux
  copilotes qui se contredisent.
- **Deux textes pour le même fait.** Le hangar plein dit aujourd'hui sa phrase
  deux fois, une dans `planetAlerts`, une dans `pickBuildings`. Une règle de
  plus en ferait trois.
- **Un conseil de forme de vie faux.** Une race devinée, un nom inventé, un
  identifiant déduit d'un préfixe non vérifié : `ids.js:5` l'a déjà écrit, « un
  identifiant inventé pointerait sur la mauvaise technologie sans rien
  signaler ».
- **Une règle désactivée qui casse la simulation.** Couper « mine bloquée par
  le hangar » ferait attendre le plan, à l'infini, une mine qui ne tient pas
  dans le hangar : `setGoal` refuse l'attente infinie et rend `null`
  (`app.js:3568`), et la carte disparaîtrait sans un mot.
- **Un « Ignorer » qui oublie pour toujours.** C'est ce que fait « Non »
  aujourd'hui, et c'est juste pour une carte de plan. Pour une alerte, le
  joueur veut ne plus la voir *cette fois*, pas ne plus jamais être prévenu.
- **Un badge qui ment panneau fermé.** Le panneau calcule ; le service worker
  affiche. Un compte figé au dernier rendu dirait « 2 » pendant des heures.
- **Un domaine de poids 0 qui masque une carte que la simulation a payée.**
  Le code le refuse explicitement (`app.js:4147`) : « une étape cachée serait
  une étape que le plan a pourtant payée, et ses chiffres ne tomberaient
  plus ».

## Contraintes

- **Lecture seule.** Le copilote pose des liens, il ne clique pas
  (`app.js:224`). « Scanner » est un lien `data-go`, comme le reste.
- **Le plan est recalculé à chaque rendu** (`simulateDay`, `app.js:3462`), sur
  des copies : `S.planets` et `S.tech` y sont remplacés jusqu'au `finally`
  (`app.js:4153`). Tout ce qui écrit dans l'état réel se fait hors de la
  simulation — même règle que `prios()`.
- **Une planète se désigne par son id local** (ADR 0001), et l'id local est
  tiré au sort sur chaque poste. Ce qui voyage entre postes voyage en `gid`,
  comme les priorités (`prioOut`, `app.js:8253`) et la campagne lune.
- **`chrome.storage.sync` est déjà le canal** de `settings`, `daily`, `lf`,
  `profil` (`SYNC_KEYS`, `app.js:8243`), avec son quota de 8 Ko par clé.
- **`boot.js` charge `app.js` après le stockage** : c'est le seul endroit où
  une lecture asynchrone peut précéder le premier rendu.
- **Le harnais concatène `ids.js`, `profils.js`, `app.js`**
  (`test/harness.js:103`) et ne connaît ni `fetch` ni `chrome.runtime`.
- **Le profil a dix catégories, pas quatre domaines** (`PROFILS.cats`) ; et les
  formes de vie n'en ont aucune, exprès (`profils.js:82`) : elles ont leur
  propre réglage, `LF_MODE`.
- **Évaluation en moins de 50 ms pour 10 planètes**, hors simulation.
- **Le badge est déjà pris** : `showAlertWindow` y écrit le nombre de files
  finies (`background.js:398`), et l'issue Versions le réclame aussi.

## Approches

### Où vit une règle

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Dans le moteur : chaque type de condition a un point d'entrée** (un candidat de `pickBuildings`, un pas de la feuille de route, une file de forme de vie, une carte du plan, une alerte) | une seule file, un seul tri, et une règle qui agit | chaque évaluateur doit savoir où il entre |
| Un évaluateur à part, qui lit l'état et rend une liste de conseils | c'est ce que l'issue décrit, et le plus simple à écrire | c'est le second moteur : il dirait « monte le hangar » pendant que le plan, qui ne l'a pas lu, propose une mine |

### Comment `rules.json` arrive au code

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Un vrai `rules.json`, lu par `boot.js` avant `app.js`** et posé dans `window.__rules` ; le harnais le lit avec `fs` | le nom que l'issue demande ; un fichier que n'importe quel éditeur valide | `fetch(chrome.runtime.getURL(…))` en plus dans `boot.js`, et une ligne dans le harnais |
| Un `regles.js` en `var REGLES = {…}`, comme `profils.js` | aucun chargement asynchrone | ce n'est pas du JSON : une virgule de trop casse tout le panneau au lieu de la seule lecture des règles |

### Ce que fait « Ignorer »

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Une entrée qui tombe dès que le constat disparaît, et au bout de 24 h** | « jusqu'à ce que la condition change » se lit au sens propre : la file se remplit, l'entrée part ; elle se revide, l'alerte revient | il faut nettoyer au rendu, sur l'état réel |
| La clé `ruleId + planète + valeur` seule, sans nettoyage | ce que suggère l'issue | une file vide, remplie, revidée garde la même valeur (« vide ») : l'alerte resterait cachée — l'exact contraire du test de l'issue |
| Réutiliser « Non » | aucun code neuf | « Non » oublie pour toujours, et c'est voulu pour une carte du plan |

## Ce qui est décidé

### Les mots

**Une règle** est une entrée de `rules.json`. Ce qu'elle trouve sur une planète,
à un instant, est **un constat** : `{regle, pid, niveau, valeur, vars}`. Le
moteur fait d'un constat une de ces quatre choses, et seulement celles-là :

| Effet | Ce que ça fait | Exemple |
| --- | --- | --- |
| **pousser** | ajoute un candidat que la simulation paie comme un autre | INST_NANITES_LAGGING pousse « Nanites +1 » dans `pickBuildings` |
| **marquer** | donne son niveau à une carte que le plan sort déjà | INST_QUEUE_EMPTY marque la carte bâtiment de la planète « Critique » |
| **suspendre** | retire des candidats tant qu'une donnée manque | FDV_DATA_MISSING retire la planète de `lfPass` |
| **signaler** | une ligne du bloc des conseils, quand le plan n'a rien à proposer qui y réponde | RECH_LAB_IDLE sans recherche finançable nulle part |

Un constat qui pousse ou marque *et* que le plan sert ne s'affiche pas une
seconde fois en alerte : la carte est sa réponse. Il ne reste en alerte que
s'il n'a pas de réponse dans la première connexion — c'est la cure du
doublon d'aujourd'hui entre `planetAlerts` et `pickBuildings`.

Les mots vont au glossaire : *règle*, *constat*, et les quatre effets.

### Le niveau

Trois niveaux, et un seul vocabulaire dans tout le panneau. `SEV_LABEL`
(`app.js:2430`) devient :

```
bad: 'Critique', warn: 'Important', info: 'Conseil', good: 'Prêt'
```

Les cartes et les missions qui portent déjà un `sev` gardent leur valeur ;
seul le mot change. Deux vocabulaires — « Urgent » ici, « Critique » là — se
liraient comme deux échelles.

### Le fichier

`rules.json` à la racine de l'extension (à côté de `profils.js`, qui joue le
même rôle pour le profil), déclaré dans `web_accessible_resources` s'il le
faut pour `fetch`.

```json
{
  "version": 1,
  "regles": [
    {
      "id": "RES_STORAGE_FULL",
      "domaine": "ressources",
      "cat": "stock",
      "niveau": "critique",
      "condition": "storageRatio",
      "parametres": { "seuil": 0.98 },
      "effet": "pousser",
      "message": "{hangar} plein sur {planete}",
      "action": "{depense}",
      "raison": "La production de {ressource} est arrêtée.",
      "source": "https://ogame.fandom.com/wiki/Buildings",
      "statut": "valide",
      "actif_par_defaut": true,
      "verrou": false
    }
  ],
  "mineBalance": {
    "byStyle":    { "mineur": 2, "turtle": 2, "raideur": 1, "fleeter": 1, "explorateur": 1 },
    "byPosition": { "1-3": -1, "4-5": 0, "6-10": 1, "11-15": 0 }
  },
  "lifeforms": { "…": "voir plus bas" }
}
```

Quatre champs de plus que l'issue, et chacun pour une raison :

- **`cat`** : la catégorie du profil (`PROFILS.cats`). `domaine` sert au filtre
  du joueur ; `cat` sert au poids. Les deux ne se recouvrent pas — « stockage »
  et « mines et énergie » sont deux poids différents dans le même domaine
  « ressources ». Une règle de forme de vie n'a pas de `cat` : elle pèse le
  poids neutre, et `LF_MODE` « Ne pas s'en occuper » la coupe, comme il coupe
  déjà les cartes de forme de vie.
- **`effet`** : un des quatre. L'évaluateur sait où il entre ; le fichier dit
  ce que la règle a le droit d'y faire.
- **`raison`** : la ligne « pourquoi » que l'issue demande sur chaque élément.
- **`verrou`** : la règle ne se désactive pas, parce que la simulation en a
  besoin pour rester vraie. Vrai pour RES_MINE_BLOCKED_BY_STORAGE et
  RES_ENERGY_NEXT_MINE. Réglages la montre, case grisée, avec la phrase qui dit
  pourquoi. Le joueur peut toujours changer son niveau et son texte.

Les textes acceptent `{variable}` et `{variable+1}`, rien d'autre. Une variable
inconnue reste écrite telle quelle, et un test le vérifie : un trou visible vaut
mieux qu'une phrase qui ment.

**Le fichier se lit dans `boot.js`**, avant `app.js` : `fetch` de l'URL de
l'extension, `JSON.parse`, `window.__rules`. Un fichier illisible écrit **une**
erreur dans la console, et le panneau tourne avec le moteur d'avant — les
secours et les cartes existent sans `rules.json`, ils perdent seulement leurs
réglages. Les alertes nées d'une règle, elles, se taisent : leur texte vit dans
le fichier. L'en-tête le dit (« règles illisibles : le
moteur tourne sans réglages »). Le harnais lit le fichier avec `fs` et le pose
au même endroit.

### Ce que le joueur règle

```
S.settings.regles = { "INST_FIELDS_LOW": { "on": true, "p": { "seuil": 15 } } }
```

Dans `settings`, donc dans `chrome.storage.sync` sans une ligne de plus. Ne s'y
écrit que ce qui s'écarte du fichier : un fichier mis à jour change les seuils
de qui ne les a pas touchés.

**Ce qui vise une planète reste sur la planète**, sur ce poste : `p.regOff`
(« pas de Terraformeur sur mon coffre-fort ») et `p.race` (la correction
manuelle). C'est le choix déjà fait pour le modèle de défense par planète
(§ 6.12) : un id local ne voyage pas, et un `gid` peut manquer.

### L'ordre

Pour le bloc des conseils, et seulement pour lui :

1. le niveau ;
2. `poidsCat(cat)` (`app.js:6704`) ;
3. le rang dans `rules.json`.

**Un poids 0 coupe la règle avant la simulation, pas après.** Une règle dont
la catégorie pèse 0 n'est pas évaluée : elle ne pousse rien, donc la
simulation ne paie rien, donc rien n'est caché qu'elle aurait payé. C'est la
seule lecture de « un domaine de poids 0 est masqué » qui ne contredise pas
`app.js:4147`.

Les cartes du plan d'une même connexion gardent leur tri par poids
(`app.js:4151`) : **le niveau se lit sur la carte, il ne la déplace pas.**
L'ordre d'une connexion dit déjà ce que le joueur a réglé — « recherche avant
les bâtiments », « formes de vie avant tout » — et une file vide, critique sur
presque toutes les cartes de bâtiment, renverserait ces deux réglages. (Décidé
à l'implémentation de la vague 1 : un test existant le gardait.)

### Les constats se calculent sur l'état réel, une fois par rendu

`constats()` lit `S.planets` et `S.tech` réels, sans simulation, et rend la
liste. `simulateDay` l'appelle **avant** de remplacer l'état (au même endroit
que `planetAlerts`, `app.js:3536`, et pour la même raison : « ce sont les
ennuis d'aujourd'hui, pas ceux prévus »), puis fait passer chaque constat à son
point d'entrée.

Le badge, lui, n'a pas besoin du plan : il compte les constats critiques. Donc
`constats()` est appelée aussi à chaque `applyGame` (`app.js:8078`) — c'est
« à chaque mise à jour des données », fin de chantier et retour de flotte
compris — et publie son compte. C'est ce qui permet de tenir les 50 ms : la
simulation n'est pas dans le compte.

### Les règles, une par une

**Existe** : le moteur le fait, la règle ne fait que le brancher sur
`rules.json` (niveau, seuil, texte, case à cocher). **Neuf** : à écrire.

#### Ressources

| Règle | État | Effet et point d'entrée | Ce qui change |
| --- | --- | --- | --- |
| RES_STORAGE_FULL | existe | pousser : le plus gros chantier productif payable (`app.js:3414`) ; signaler s'il n'y en a pas | le `.98` devient `seuil`. L'issue dit 100 % ; le relevé arrondit, et 98 % est ce que le jeu appelle plein. La phrase de `planetAlerts` et celle du plan n'en font plus qu'une |
| RES_STORAGE_SOON | existe | pousser : le hangar (`app.js:3421`) | deux délais existent et ne se confondent pas : *quand construire* le hangar (`lead`, dans le plan) et *quand prévenir* (`max(8 h, montée)`, dans l'alerte). Seul le second devient `heures`, défaut 8. L'issue dit 24 h : c'est un seuil, le joueur le monte |
| RES_ENERGY_NEGATIVE | existe | pousser : la centrale (`app.js:3389`), ou les satellites selon `satsOk` | rien que le branchement. L'option satellites est déjà respectée, et l'alerte dit déjà quand une option écartée aurait été moins chère |
| RES_ENERGY_NEXT_MINE | existe | pousser : « Énergie pour X » (`extraSolar`, `app.js:3456`) | **verrou** : sans elle, le plan monterait une mine qui fait passer l'énergie en négatif |
| RES_MINE_BLOCKED_BY_STORAGE | existe | pousser : « Hangar trop petit pour la suite » (`app.js:3441`) | **verrou** : sans elle, l'attente de la mine est infinie et `setGoal` la tait |
| RES_MINE_BALANCE | **neuf** | pousser : la mine en retard, candidat forcé, avant le classement | voir plus bas |

**RES_MINE_BALANCE.** Cible = `byStyle[S.profil.style] + byPosition[position]`,
lus dans le fichier, jamais saisis. Si `métal − cristal < cible`, la mine de
cristal est en avance : la mine de métal devient candidate ; si
`métal − cristal > cible + 1`, l'inverse. La tolérance d'un niveau évite
qu'une planète oscille d'une mine à l'autre à chaque session.

Elle entre **comme les robots** (`app.js:3453`) : un candidat forcé avant le
classement par amortissement, mais seulement s'il ne coûte pas plus de
`facteurCout` fois le meilleur pas du classement (défaut 2, les robots
prennent 3). Sans ce garde, une règle « conseil » réécrirait le classement que
le copilote a construit pour juger — et un Mineur en position 8 n'achèterait
plus jamais de cristal sur une planète qui en manque.

La carte dit la cible et l'écart, comme l'issue le veut : « Cible métal −
cristal : +3, actuel : +1 ». Et elle dit aussi ce que dit déjà `mineWhy`
(`app.js:3349`) quand le besoin de l'empire tire dans l'autre sens : deux
raisons contraires, dites, valent mieux qu'une qui fait taire l'autre.

#### Installations

| Règle | État | Effet et point d'entrée | Ce qui change |
| --- | --- | --- | --- |
| INST_QUEUE_EMPTY | **neuf** | marquer : la carte bâtiment de cette planète dans la première connexion ; signaler s'il n'y en a pas, avec la ligne d'attente (« ressources réunies vers 14 h 10 ») | la carte existe déjà : c'est le plan. La règle lui donne son niveau et la fait compter au badge. Désactivée, la carte reste — c'est une carte du plan — mais elle n'est plus critique et ne compte plus |
| INST_NANITES_OVER_ROBOTS | **neuf** | signaler, sur la carte | le plan ne propose jamais de robots au-delà de 10 (`robotTarget`, `app.js:3452`) : ce cas ne naît que d'une **priorité** du joueur. Le copilote obéit, et chiffre : « Nanites 1 coûte X et divise le temps par 2 ; Robots 11 le divise par 12/11. » Il ne remplace pas la priorité |
| INST_NANITES_LAGGING | **neuf** | pousser : « Nanites +1 », candidat forcé avec le garde de coût des robots | les nanites ne sortent aujourd'hui que comme puits d'un hangar plein ou par priorité |
| INST_FIELDS_LOW | partiel | pousser : le Terraformeur, si ses prérequis sont là ; sinon signaler | `planetAlerts` ne parle qu'à 0 et 1 case libre (`app.js:2410`). Le seuil devient `seuil`, défaut 10. Désactivable par planète (`p.regOff`). Les deux alertes à 0 et 1 restent : elles disent un mur, pas une pratique |
| INST_LAB_NETWORK | **neuf** | pousser : le labo de la planète en retard, si aucune recherche ne tourne | seulement avec le Réseau (`S.tech.irn > 0`) et seulement pour un labo qui compte dans `labEffectif` (`app.js:1503`). Le plan ne conseille toujours pas d'acheter le Réseau (§ 2.7). `statut: a_valider` : le niveau minimum d'un labo qui compte n'est pas sourcé |

#### Recherche

| Règle | État | Effet et point d'entrée | Ce qui change |
| --- | --- | --- | --- |
| RECH_LAB_IDLE | **neuf** | marquer : la carte recherche de la première connexion ; signaler sinon | même mécanique qu'INST_QUEUE_EMPTY, sur `rechercheEnCours()` (`app.js:2323`) |
| RECH_FUND_ELSEWHERE | **neuf** | pousser : la recherche, payée par une autre planète | voir plus bas |
| RECH_ASTRO_COLONY | existe | marquer : la carte du vaisseau de colonisation, ou la mission `colomax` | « Économie pure » ne colonise pas de lui-même (§ 4) : la règle le respecte, et le dit sur sa ligne plutôt que de le contredire |
| RECH_PLASMA_MINER | **neuf** | pousser : `[plasma, cible]` en tête d'une copie de la feuille de route, sans le drapeau `'c'` | le chemin est celui des priorités de recherche (spec du 18 novembre) : `resolveTech` remonte les prérequis tout seul. Sans `'c'`, elle n'épargne pas : elle passe à son tour, en premier |
| RECH_HYPERSPACE_CARGO | **neuf** | pousser : `[hyper, cible]`, même chemin | condition : focus `expo` ou style explorateur. Le « +5 % par niveau » se lit de `hyperCargoPct()` (`app.js:838`), qui vient du serveur |

**RECH_FUND_ELSEWHERE.** Aujourd'hui la recherche ne se paie que sur le
centre (`labP`, `app.js:3589`). Le jeu la laisse lancer depuis n'importe
quelle planète dont le labo remplit le prérequis. Quand le centre ne peut pas
payer la recherche de tête et qu'une autre planète le peut, avec
`reqOk(T[k].req, autre)` vide, `tryResearch` la lance de là : la simulation
paie sur cette planète, et la carte dit « depuis X ». Deux réserves :

- **le prérequis est une propriété de la planète** (§ 2.7) : on teste le labo
  de l'autre planète, pas `labEffectif` ;
- **la durée** se calcule sur le labo de la planète qui lance, Réseau compris
  s'il y en a un. Si le constructeur ne peut pas la tenir juste, la carte ne
  promet pas de durée plutôt que d'en promettre une fausse.

#### Formes de vie : la race, les noms, et ce qui manque

**La race d'une planète** se lit dans cet ordre, et le premier qui répond
gagne :

1. `p.race`, posée à la main dans Réglages ;
2. le préfixe des identifiants de ses cases (`p.lf`), d'après
   `lifeforms.<race>.idPrefix` dans `rules.json` ;
3. le nom d'un bâtiment du tableau de production, comme aujourd'hui
   (`speciesOf`, `app.js:4486`).

**Le préfixe est à vérifier, et deux sources se contredisent.** L'issue
propose 111 / 121 / 131 / 141. Le commentaire d'`ids.js:49` suppose 111 / 113 /
115 / 117 (« 113xx/114xx pour la suivante »). `lfQueue` donne la même file dans
les deux cas — centaine impaire, bâtiment — donc rien n'a encore cassé, mais
une race déduite du mauvais préfixe le serait. Les préfixes vont dans le
fichier avec `statut: a_valider`, et **une race déduite du préfixe qui
contredit le nom lu n'est pas une race** : c'est un constat FDV_DATA_MISSING
« race contradictoire », et les règles de forme de vie se suspendent. Le
commentaire d'`ids.js` se corrige le jour où le jeu a tranché.

**Les noms.** Trois sources, la plus fraîche d'abord :

1. le nom lu dans le jeu, sur n'importe quelle planète (`v.nom`, que
   `lfMerge` garde déjà, `app.js:1134`), ou sur la page Encyclopédie ;
2. le nom de `rules.json` ;
3. rien — et « rien » est une donnée manquante, pas « Forme de vie 12103 ».

Les noms lus vont dans `S.lfNoms = {id: nom}`, **hors** de `SYNC_KEYS` : la
liste se recompose sur chaque poste à la première visite, et elle n'a rien à
faire dans le quota de 8 Ko. `OG_LF_BUILD` et `OG_LF_TECH` quittent `ids.js`
pour `rules.json` : une seule table de noms par défaut. `lfQueue` reste dans
`ids.js`, parce que `content.js` s'en sert.

**Ce qui manque**, par planète, et ce que chaque manque suspend :

| Manque | Ce qui se suspend | Page que « Scanner » ouvre |
| --- | --- | --- |
| race inconnue, ou contradictoire | toutes les règles de forme de vie de la planète, et `lfPass` pour elle | Formes de vie de la planète |
| nom inconnu d'une case de la planète | les règles qui la nomment (habitat, nourriture, base) | Formes de vie de la planète ; Encyclopédie de la race si la race n'y est pas débloquée |
| niveau illisible (`v.lvl` non fini) | cette case, dans `lfPass` et dans les règles | Formes de vie de la planète |
| prix inconnu | rien de neuf : `lfCandidates` l'écarte déjà (`app.js:1190`) | inchangé : les missions `lfb` / `lfr` |

FDV_DATA_MISSING **remplace** les missions `lfb` et `lfr` (`app.js:5093`) au
lieu de s'ajouter à elles : le même manque, dit une fois, au niveau
« Important », avec le détail (« Noms des recherches Rocta inconnus »). Les
phrases de `prioLfEtat` restent, elles parlent d'une priorité.

**« Scanner »** est un lien `data-go` vers la page — le même chemin que toutes
les cartes. Le joueur clique ; `content.js` lit la page à son chargement et
envoie son instantané, comme il le fait déjà ; `applyGame` met les noms en
cache, recalcule les constats, et le constat tombe ou se raccourcit tout seul.
Rien ne navigue sans clic. Le relevé « Actualiser » fait déjà ce tour pour les
pages Formes de vie (`RELEVE_PAGES`, `app.js:1981`) ; il ne prend pas
l'Encyclopédie, qui ne sert qu'à une race qu'on n'a pas.

**« Rescanner »**, dans Réglages : vide `S.lfNoms`, les noms gardés sur les
cases et la race *déduite* — jamais `p.race`, qui est une décision du joueur.
Les constats repartent au rendu suivant.

#### Formes de vie : les règles

| Règle | État | Effet et point d'entrée | Ce qui change |
| --- | --- | --- | --- |
| FDV_DATA_MISSING | partiel | suspendre + signaler | ci-dessus |
| FDV_QUEUE_EMPTY | **neuf** | marquer : la carte de forme de vie de la première connexion ; signaler sinon | sur les minuteurs `x` de file `lfbuilding`, comme `prioLfEtat` les lit (`app.js:739`) |
| FDV_RESEARCH_IDLE | **neuf** | idem, file `lfresearch` | seulement si une case de bâtiment est lue sur la planète : avant, l'arbre n'existe pas (`app.js:5095`) |
| FDV_FOOD_LIMIT et FDV_HOUSING_LIMIT | partiel | pousser : la base de la race en tête de `lfCandidates`, nourriture d'abord | le jeu ne dit que « population trop faible » (`lfState`). Les deux règles **n'en font qu'une** en v1, FDV_POP_LIMIT, et elle fait ce que fait déjà le bouton des paliers (`lfPosePaliers`, `app.js:6544`) : la nourriture, puis le logement. Les deux d'origine restent dans le fichier, `actif_par_defaut: false`, en attendant que le relevé lise la nourriture et la population |
| FDV_BASE_FIRST | partiel | pousser : la base en tête de `lfCandidates`, tant qu'elle est sous `niveau` et qu'une case de rang 6 ou plus est la candidate | `LF_PALIER` (`app.js:6533`) quitte le code pour `parametres` |

La base d'une race se lit dans `lifeforms.<race>.base` ; à défaut, la règle
d'aujourd'hui (`lfPopNourriture`, `app.js:6534`) : les cases `01` et `02` de la
série, que le wiki documente pour les quatre races. Une race sans base connue
suspend ces trois règles, et FDV_DATA_MISSING le dit.

Les règles propres à une race (ordre des bâtiments avancés, recherches clés)
arrivent `statut: a_valider` et ne sortent qu'avec cette mention.

### Ce que le panneau montre

**Le bloc des conseils**, à la place du bloc « Alertes » d'Aujourd'hui : les
trois constats les plus prioritaires **de la planète ouverte dans le jeu**
(`S.cur`, le `gid` que `applyGame` reprend du jeu à chaque instantané,
`app.js:8188` — donc au changement de planète, sans recharger), puis « Voir tout (N) ».
Déplié, il montre l'empire entier et quatre filtres : domaine, niveau,
planète, « Données manquantes ». Les filtres vivent dans `S.ui`, sur ce poste.

Chaque ligne porte ce que l'issue demande : niveau, domaine, message, action
avec son coût et « payable maintenant » ou non (le même `can` que la
simulation, sur `stockNow`), la raison, le lien vers la source, la mention
« à valider ». Et un bouton « Ignorer ».

**Un constat que le plan sert n'y est pas** (voir « Les mots ») : la carte du
plan, marquée de son niveau, est sa réponse. Le bloc n'est pas une seconde
liste des mêmes choses.

**« Ignorer »** pose `S.daily.ign[clé] = horodatage`, avec la clé
`regle|gid|valeur` (`gid`, parce que `daily` voyage). L'entrée tombe :

- dès qu'un rendu sur l'état réel ne trouve plus ce constat — la condition a
  changé ;
- ou 24 h après.

Le nettoyage se fait au rendu, hors simulation, et seulement quand le relevé
est là (`IS_EXT` et des données de jeu) : sur les données d'exemple, aucun
constat n'existe, et tout serait effacé. Ignorer ne change rien au plan : le
constat ignoré pousse et suspend comme avant, il ne s'affiche simplement plus
et ne compte plus au badge.

**Réglages › Règles** : une ligne par règle, dans l'ordre du fichier, groupées
par domaine — case à cocher, niveau, seuils, mention « à valider », case
grisée et sa raison pour une règle à verrou. Sous chaque planète dans Empire,
les règles qu'on peut couper pour elle. Et le bouton « Rescanner ».

**La race**, dans Réglages › Formes de vie : une ligne par planète, la race
lue, d'où elle vient (« lue sur la page », « déduite des identifiants », « à
la main »), et une liste pour la corriger. Choisir une race à la main déplace
aussitôt l'habitat et la nourriture visés, puisqu'ils se lisent de la race.

### Le badge

Le panneau publie, à chaque calcul des constats,
`chrome.storage.local.critiques = {n, at}`. Le service worker compose le badge
à partir de ce qu'il sait, dans l'ordre de l'issue :

1. version instable (issue Versions) ;
2. constats critiques, en rouge, leur nombre ;
3. files finies (`pendingAlerts`, comme aujourd'hui), leur nombre ;
4. mise à jour disponible.

Rien quand tout est à zéro.

**Les files finies restent**, et c'est la réponse au badge qui ment panneau
fermé. Une file qui finit pendant que le panneau est fermé, c'est une file
vide, donc un critique — mais seul le service worker le sait, par son alarme.
Le compte des critiques porte son heure : plus vieux que la dernière fin de
file, il cède la place au compte des files finies au lieu de l'écraser.

## Écarts à l'issue, dits

- Pas d'onglet « Conseils » : le bloc d'Aujourd'hui se déplie sur l'empire.
- Un poids 0 coupe la règle avant la simulation, il ne cache pas une carte
  payée.
- RES_STORAGE_FULL à 98 %, RES_STORAGE_SOON à 8 h : les seuils du moteur, que
  le joueur change.
- FDV_FOOD_LIMIT et FDV_HOUSING_LIMIT réunies en FDV_POP_LIMIT tant que le
  relevé ne lit pas la nourriture.
- Deux règles à verrou, qui ne se désactivent pas.
- Une condition d'un type neuf demande son évaluateur.
- Pas de `core/formulas.js`.

## Ce qui reste au constructeur

- L'URL de la page Encyclopédie d'une race, et ce que `content.js` doit y lire
  (titre ou infobulle) : à relever sur le jeu, pas à deviner.
- Le préfixe des séries de forme de vie des Rocta, Mécas et Kaeleshs, à relever
  sur le jeu ; puis corriger le commentaire d'`ids.js:49`.
- Le texte de chaque règle dans `rules.json`, dans la langue du projet, et la
  source de chacune.
- La valeur de condition de chaque constat, pour la clé d'« Ignorer » : celle
  qui change quand la situation change (le stock arrondi au million ne fait pas
  l'affaire, il ferait réapparaître l'alerte à chaque minute).
- La durée d'une recherche lancée hors du centre, ou la décision de ne pas
  l'afficher.
- La phrase « Hors plan : formes de vie » (`app.js:7327`), fausse depuis que
  les formes de vie sont dans le plan.
- La place des filtres dans le bloc déplié.
- Les tests, dans `test/run.js` :
  - `rules.json` se parse, chaque règle a un évaluateur, chaque `cat` existe
    dans `PROFILS.cats`, chaque `effet` est un des quatre ;
  - planète sans chantier : la carte bâtiment de la première connexion est
    marquée Critique, et `critiques.n` vaut 1 ;
  - INST_QUEUE_EMPTY désactivée : la carte reste, sans niveau, et le compte
    tombe à 0 ;
  - cristal à 18,5 M pour 18 M : RES_STORAGE_FULL, une seule phrase dans tout
    le panneau ;
  - prochaine mine de cristal plus chère que le hangar : le hangar sort,
    et la règle ne se décoche pas ;
  - recherche à l'arrêt, impayable au centre et payable ailleurs : la carte
    part de l'autre planète ;
  - Mineur, position 8, métal 28 et cristal 27 : « Cible +3, actuel +1 », et la
    mine de métal est candidate ; en Raideur, la cible passe à +2 ;
  - la mine d'équilibre plus chère que deux fois le meilleur pas du classement
    ne passe pas devant lui ;
  - une catégorie de poids 0 : la règle ne pousse rien, et la simulation ne
    paie rien pour elle ;
  - race forcée à la main : l'habitat et la nourriture suivent ;
  - race déduite du préfixe qui contredit le nom lu : FDV_DATA_MISSING, et
    `lfPass` saute la planète ;
  - cache des noms vidé : FDV_DATA_MISSING sur chaque planète, règles de forme
    de vie suspendues ; noms remis par un instantané : le constat tombe ;
  - race Rocta sans données : « Noms Rocta inconnus », et le lien mène à
    l'Encyclopédie ;
  - seuil INST_FIELDS_LOW à 15 dans le fichier : le conseil sort à 14 cases
    libres ;
  - « Ignorer », file remplie, file revidée : le constat revient ; ignoré
    25 h plus tôt : il revient aussi ;
  - `rules.json` illisible : une erreur, le plan d'avant, aucune autre ;
  - `constats()` sur dix planètes en moins de 50 ms.
