# Poser une priorité depuis le jeu, et sur les formes de vie

> Conception. Suite de `2026-11-18-priorites-du-joueur-design.md`, dont les
> décisions restent en vigueur sauf là où ce document les étend.

## Intention

Le joueur se balade dans le jeu. Il voit que son labo est niveau 7 et qu'il
veut 10. Aujourd'hui, pour le dire au copilote, il doit quitter la page,
ouvrir le panneau, aller sous **Empire**, déplier un volet replié, trouver la
ligne, saisir le niveau. Six gestes et une liste à dérouler « très peu
visible » — ses mots. La fonctionnalité existe et personne ne la trouve.

Elle doit se poser **là où il regarde** : sur la tuile elle-même, dans la page
du jeu, d'un clic droit.

Et elle doit couvrir **les formes de vie**. Le plan les construit déjà, mais le
joueur n'a aucun moyen de dire que le bâtiment d'habitation passe devant le
bâtiment de nourriture.

## Ce qui existe déjà, et ce qui manque vraiment

Trois pièces sont posées, et une quatrième manque — cette version du document
corrige ce que la première affirmait à tort.

1. **La page sait dessiner un niveau visé sur une tuile.** Deux formes
   existent : sur la tuile du jeu, une pastille `copilote-tag` « → 10 »
   (`content.js:2136`-`2154`) ; sous la peau, une pastille `cp-cible`
   cliquable sur chaque carte (`content.js:1510`-`1524`). Le dessin est là.

2. **Mais ce qu'elles affichent n'est pas une cible portée par la tuile.**
   C'est ce que le plan fait **à cette session** : `skin` est bâti par
   `gameSkin(s0.acts, …)` (`app.js:3885`) et `hints = planHints(acts)`
   (`app.js:562`). Une priorité qui épargne sans être encore payable part dans
   `waits`, pas dans `acts` : elle ne produit aucun repère, la pastille du jeu
   est retirée (`content.js:2138`-`2142`) et celle de la peau n'est jamais
   dessinée (`content.js:1510`). **Il faut donc un second canal**, et c'est le
   vrai manque de ce travail. Voir « Ce que la page reçoit ».

3. **Une tuile se lit entièrement** : `content.js:1397`-`1415` ramasse par
   tuile son identifiant, son nom dans la langue du joueur, son niveau
   courant, et si elle se **compte** au lieu de se monter (`content.js:1402`).

4. **Le clic est déjà écouté par délégation** : un seul écouteur sur
   `document`, qui remonte à `li.technology[data-technology]`
   (`content.js:2241`) — « le jeu refait sa liste de tuiles à tout bout de
   champ, et un écouteur par tuile mourrait avec elle ». Rien n'écoute
   `contextmenu` aujourd'hui.

Côté formes de vie, le relevé et la simulation sont faits : `content.js:112`
lit le niveau, l'état et le prix de chaque case ; `p.lf` les porte ;
`app.js:2339` les monte dans la simulation ; `lfMerge` (`app.js:4354`) les
fusionne à l'import. Il manque **la voix du joueur**, et elle seule.

## Objectifs

1. Un clic droit sur une tuile, dans la page du jeu, pose ou retire une
   priorité — avec ou sans la peau, sur toutes les pages à tuiles.
2. Le niveau se saisit dans le même geste, préréglé au niveau suivant : on
   valide d'un Entrée quand ce niveau suffit.
3. Les cases de forme de vie acceptent une priorité, et le plan la respecte
   dans sa file.
4. Le geste se voit : la tuile dit immédiatement ce qu'elle porte, et dit
   aussi pourquoi quand elle refuse.

## Non-objectifs

- Les tuiles qui se **comptent** — vaisseaux, défenses, foreuses, satellites.
  Une priorité est un niveau visé ; un nombre de vaisseaux est autre chose.
- **Recherche des formes de vie** (`lfresearch`) : ses cases n'affichent pas
  de niveau (`content.js:604`). Sans niveau courant, aucune cible à comparer.
- Les bâtiments que le moteur ne modélise pas : Terraformeur, Dépôt de
  ravitaillement, Dock spatial, Silo de missiles, Graviton. `OG_BUILD`
  (`ids.js:1`) en tient douze, et ceux-là n'y sont pas — ils ont pourtant un
  niveau affiché. Ils sont refusés, et le refus se voit (voir « Qui refuse »).
- Les lunes : le panneau n'en modélise aucune.
- Réordonner la liste des priorités à la main. L'ordre de pose arbitre, comme
  décidé la veille.
- Remplacer les champs sous Empire. Ils restent : ils sont le seul moyen de
  poser sur une planète où l'on ne se trouve pas.

## Anti-objectifs

Ce qui ferait de ce travail un échec même en marchant :

1. **Un clic droit volé.** Le menu contextuel du navigateur est un outil du
   joueur. Il ne disparaît que sur une tuile que nous traitons vraiment —
   jamais ailleurs, jamais « au cas où ».
2. **Un geste silencieux.** Un clic droit qui pose sans que la tuile le
   montre, ou qui refuse sans dire pourquoi, est pire que pas de geste : le
   joueur croit avoir parlé. Cela vaut aussi pour une demande que le panneau
   reçoit et ne sait pas placer.
3. **Une priorité posée sur un niveau deviné.** Une tuile dont on ne lit pas
   le niveau courant ne reçoit rien.
4. **Une priorité de forme de vie qui affame les mines.** Une case
   d'habitation ne produit ni métal, ni cristal, ni deutérium : lui donner la
   réserve dure d'une planète coûterait de la production à chaque heure pour un
   gain qui ne rembourse pas.
5. **Une priorité de forme de vie qui tue une priorité de bâtiment.** La règle
   « une seule priorité agit par planète » de la veille est aveugle aux
   espèces (`app.js:2078`) : une case d'habitation y prendrait le rang et le
   Labo 10 posé ensuite attendrait un tour qui ne vient jamais.

## Contraintes

- Rien à installer, aucune dépendance, aucun cadriciel. JavaScript brut.
- `content.js` n'écrit dans la page du jeu que ce qui lui appartient. Le champ
  de saisie est le nôtre, posé sur la tuile, retiré après.
- **ADR 0001** : une planète se désigne par son `id` local, jamais par son
  rang, son nom ou son `gid`. La page ne connaît que le `gid` ; la traduction
  se fait dans le panneau, où vit `S.planets`.
- Les deux côtés sont testables et doivent l'être : `test/run.js` pour le
  moteur, `test/page.js` pour la page (il exécute `content.js` contre un DOM
  réduit, avec `document.addEventListener` / `dispatchEvent` réels,
  `test/page.js:300`).
- Le panneau peut être fermé pendant que le joueur clique.
- **Les tests de la veille restent verts sans être touchés.** Les 610
  vérifications existantes décrivent le comportement voulu ; une refonte des
  accesseurs qui les réécrirait en masse serait le signe d'une erreur de
  conception, pas d'un progrès.

## Approches considérées

**A. Un vrai menu contextuel dessiné par nous** — « monter d'un niveau », « +5 »,
« retirer ». Écarté : un menu est une liste de choix figés, et le joueur veut
un nombre (« 10 »), pas un incrément.

**B. Le clic droit pose directement niveau + 1, et reclique pour monter.** Le
plus court à écrire. Écarté : « labo 7 → 10 » demande trois clics droits, et
rien ne dit où l'on en est entre deux.

**C. Le clic droit ouvre un champ sur la tuile, préréglé au niveau suivant.**
Retenu — c'est le choix du joueur. Un geste, un nombre quand on en veut un,
Entrée seul quand le niveau suivant suffit. Et le champ affiche la priorité
déjà posée, donc il sert aussi à la relire et à la retirer.

## Ce qui est décidé

### Le geste

Un écouteur `contextmenu` unique sur `document`, par délégation. **Deux
sélecteurs, pas un** : la carte de la peau est un `div` `.cp-case`
(`content.js:1487`) posé en premier enfant du conteneur du jeu
(`content.js:1566`), donc jamais descendante d'un `li.technology` —
`closest('li.technology')` ne l'atteindra jamais. La résolution essaie donc :

- `li.technology[data-technology]` — la tuile du jeu ;
- `.cp-case[data-technology]` — la carte de la peau, à qui l'on ajoute
  l'attribut au moment du dessin.

Si aucune des deux ne répond, **l'événement n'est pas touché** : le menu du
navigateur s'ouvre normalement.

Sur une tuile retenue, un champ de saisie apparaît sur la tuile, prérempli :
la priorité déjà posée s'il y en a une, sinon **niveau courant + 1**. Le
contenu est sélectionné, le focus est dedans.

- **Entrée** valide ce qu'il y a dans le champ.
- **Échap** ou la perte du focus annule, sans rien changer.
- **Vider le champ**, ou saisir un niveau au niveau courant ou au-dessous,
  **retire** la priorité — c'est déjà le contrat de `prioPose`
  (`app.js:205`) : `lvl > actuel` faux, l'entrée est retirée.

### Qui refuse, et où

**La page refuse, pas le panneau.** `ids.js` est chargé dans le script de
contenu : il y connaît `OG_BUILD`, `OG_TECH` et le seuil `11000`. Une tuile est
retenue si, et seulement si :

1. elle a un **niveau courant lisible** — ce qui écarte d'un coup les tuiles
   qui se comptent et les cases de `lfresearch` ; et
2. son identifiant est **modélisé** — dans `OG_BUILD`, dans `OG_TECH`, ou
   `>= 11000`.

Sinon : pas de champ, et une brève infobulle sur place dit laquelle des deux
raisons s'applique. Refuser dans la page est ce qui tient l'anti-objectif 2 :
un refus décidé dans le panneau serait invisible depuis la tuile.

Reste un cas que la page ne peut pas juger : **une planète que le panneau ne
connaît pas** (une lune, une colonie jamais relevée). La demande part, et si
le panneau ne sait pas la placer, elle apparaît dans « Tes priorités » comme
demande en attente, avec le nom de la tuile — jamais jetée en silence. Une
demande que rien ne réclame au bout de 24 h disparaît.

### Ce qui part de la page

Le script de contenu ne touche pas à `S.prio`. Il **demande**, dans une clé à
lui :

```
prioAsk = [ { gid: '33701234', tech: 31, nom: 'Laboratoire de recherche',
              lvl: 10, at: 1763... }, … ]
```

Une **liste**, pas un objet : le panneau peut être fermé, et trois clics droits
de suite ne doivent pas s'écraser l'un l'autre. Le `nom` voyage pour que le
panneau puisse nommer une demande qu'il ne sait pas placer.

Le panneau la vide. Deux points à ne pas croire acquis, contrairement à ce que
la première version de ce document disait :

- `boot.js:13` lit bien tout le stockage, mais ne passe à `app.js` que les
  clés préfixées `ls:`, plus `d.game` et `d.api` (`boot.js:13`-`16`). `prioAsk`
  n'arrive pas tout seul : il faut une ligne, là ou dans le démarrage de
  `app.js`.
- `app.js:4431` écoute `storage.onChanged` pour `game` et `api` : `prioAsk` s'y
  ajoute.

Pour chaque demande : traduire, `prioPose`, puis effacer la clé, sauvegarder,
redessiner.

*Plafond assumé* : deux écrivains sur une clé, l'un qui ajoute et l'autre qui
vide. Dans le pire des cas un clic droit est perdu — jamais une liste de
priorités corrompue, puisque `S.prio` garde un seul écrivain, le panneau.

### Ce que la page reçoit

Un second canal, publié à côté de `hints` par `gameSkin` :

```
skin.prio = { [gid]: { [tuile]: niveau } }
```

Bâti depuis les accesseurs de priorités, **pas depuis `acts`** : c'est ce que
le joueur a posé, payable ou non, servi cette session ou non. Il survit au
panneau fermé, puisque `skin` reste en stockage et que la page le relit au
chargement (`content.js:2212`).

La tuile marque alors **deux choses différentes, différemment** :

- la cible du plan (`hints`), comme aujourd'hui ;
- **ta priorité** (`skin.prio`), dans une autre teinte, avec son infobulle :
  « Ta priorité : niveau 10. Clic droit pour la changer. »

Quand les deux portent sur la même tuile, c'est la priorité qui s'affiche :
elle est la cause, le plan n'en est que l'effet.

**Et l'écho immédiat.** Entre le clic droit et la réponse du panneau, la page
ne sait rien. Elle lit donc ses propres demandes en attente dans `prioAsk` et
les affiche comme des priorités, en marquant qu'elles ne sont pas confirmées.
Sans cet écho, un clic droit resterait sans effet visible pendant une seconde
ou plus — panneau fermé, indéfiniment. C'est l'anti-objectif 2.

### La traduction, côté panneau

| Identifiant de tuile | Priorité posée |
|---|---|
| `OG_BUILD[id]` (`ids.js:1`) | `{kind:'b', pid, k}` — `pid` = la planète dont le `gid` est celui de la demande |
| `OG_TECH[id]` | `{kind:'t', k}` — sans `pid` : une recherche vise le centre |
| `id >= 11000` | `{kind:'lf', pid, k:id}` — nouvelle espèce |

### La nouvelle espèce `lf`, et sa file à part

**`prios()` ne rend pas les `lf`.** C'est la décision la plus structurante de ce
document, et elle est imposée par l'anti-objectif 5. `prios()` alimente la
boucle des objectifs, où :

- `cible` fait `pr.kind === 'b' ? B_SHORT[pr.k] : T[pr.k].n` (`app.js:2074`) —
  `T[11101]` n'existe pas, c'est une exception immédiate ;
- `prioVus` réserve la planète au premier posé, toutes espèces confondues
  (`app.js:2078`) ;
- `prioStep` lit `B[pr.k]` (`app.js:1794`) ;
- et `nextResearch` fait `prioOf(labPlanet().id)` puis
  `mienne.kind === 't' ? mienne : null` (`app.js:1635`) : une case de forme de
  vie première sur le centre annulerait en silence l'insertion en tête de
  feuille de route d'une priorité de recherche posée ensuite.

Donc : **une seule liste `S.prio`** — un seul ordre de pose, une seule clé de
stockage, un seul « Retirer » — et **deux lectures** :

- `prios()` : `b` et `t`, inchangée. Les 610 vérifications de la veille restent
  vraies mot pour mot, et la boucle des objectifs n'est pas touchée.
- `priosLf()` : les `lf` seules. Vivante tant que
  `(p.lf[k] || {}).lvl || 0 < lvl`, mêmes gardes que les deux autres — niveau
  entier positif, planète qui répond, case que le relevé connaît.

Une planète peut donc porter **un objectif de bâtiment et une priorité de forme
de vie en même temps** : ils ne jouent pas dans la même file et ne se disputent
pas la réserve.

### Ce que le plan en fait

**Une priorité de forme de vie passe en tête de sa file.** `lfCandidates`
(`app.js:528`) classe aujourd'hui : les cases qui augmentent une production
d'abord, la moins chère ensuite. Habitation et nourriture n'augmentent aucune
des trois ressources — elles tombent toutes deux dans « la moins chère », et
c'est le prix qui tranche. La priorité se glisse devant la règle de production,
avec sa phrase : « Tu l'as mise en priorité. »

Elle ne pose **pas** d'objectif, **pas** de réserve dure, et ne déplace **pas**
les formes de vie devant les bâtiments : `lfMode` (`app.js:1550`) continue de
décider cela, et le joueur le règle déjà dans Réglages.

**Ce que « en tête » coûte vraiment**, et que la première version de ce
document passait sous silence : l'appelant ne regarde que la tête
(`const ch = lfCandidates(p, q)[0]`, `app.js:2329`). Une priorité plus chère
que la case que le prix aurait choisie fait donc **attendre toute la file**
jusqu'à ce qu'elle soit payable, et l'attente pousse une réserve molle
(`soft.push`, `app.js:2344`).

C'est le comportement d'aujourd'hui pour n'importe quelle case en tête : rien
de neuf dans la mécanique, seulement une tête qui peut être plus chère. Et la
réserve molle est bornée — vérifié : le chemin des bâtiments calcule sa réserve
avec `reserveOf(p,Tm)` seul (`app.js:2357` et `2364`), **sans** `softRes`. Tes
mines ne ralentissent pas. Ce qu'une case prioritaire en attente peut ralentir,
c'est la recherche sur cette planète en phase tardive (`app.js:2028`) et les
vaisseaux (`app.js:2451`).

**On ne tombe pas sur la case suivante.** Ce serait rendre la priorité
inopérante dans le seul cas qui a motivé la demande : une habitation chère
contre une nourriture bon marché, où le prix gagnerait toujours.

**Une case que le relevé ne sait pas chiffrer est acceptée quand même.**
`lfCandidates` écarte toute case sans prix ni durée (`app.js:532`), et ce prix
n'arrive que lorsque le joueur ouvre le panneau de détail dans le jeu
(`content.js:109`-`111`). Juste après un clic droit, c'est donc l'état normal.
Refuser la pose serait punir le joueur d'un relevé qu'il n'a pas encore fait :
la priorité est enregistrée, et « Tes priorités » dit la seule chose à faire —
« pas encore chiffrée : ouvre-la dans le jeu ». Même traitement pour une case
`state:'locked'`, avec son propre mot.

### Ce que ça montre

L'anti-objectif 2 impose quatre choses, non négociables :

1. **La tuile distingue ta priorité de la cible du plan** — deux teintes, deux
   infobulles (voir « Ce que la page reçoit »).
2. **Le bloc « Tes priorités » accueille les lignes `lf`**, avec le nom de la
   case donné par le jeu, et l'état qui s'applique : elle passe en tête, elle
   attend le tour de sa file (en nommant le réglage `lfMode`), elle n'est pas
   encore chiffrée, elle est verrouillée.
3. **Les demandes que le panneau n'a pas su placer** y figurent aussi, nommées.
4. **Le refus dans la page parle** : pas de niveau à viser, ou tuile que le
   copilote ne modélise pas.

### Le volet sous Empire

Il reste, inchangé dans sa mécanique. Seul son texte d'accueil change : le bloc
« Tes priorités » vide nomme **d'abord le clic droit dans le jeu**, et le volet
ensuite, comme le moyen de poser sur une planète où l'on n'est pas.

## Ce qui reste au constructeur

- Le dessin exact du champ sur la tuile : taille, position, teinte. La tuile
  est petite ; la peau a ses variables de couleur (`--cp-accent`, `--cp-bon`).
- La forme exacte des deux marquages (priorité du joueur / cible du plan), et
  celle de l'écho non confirmé.
- Le mot exact de chaque phrase, dans la voix du projet.
- Le nom et la forme exacte de la clé de demande, `prioAsk` n'étant qu'un nom,
  et le choix entre `boot.js` et le démarrage de `app.js` pour la lire.
- Comment `test/page.js` capture les écritures de stockage : son
  `chrome.storage.local.set` est aujourd'hui un vide (`test/page.js:314`), et un
  test du clic droit a besoin de le lire. Un helper `clicDroit(id)` à côté du
  `clic(id)` existant (`test/page.js:457`) est le chemin naturel.
- L'ordre des tâches, et où couper.
