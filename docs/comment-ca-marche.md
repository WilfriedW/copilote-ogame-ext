# Copilote OGame — comment il marche, pourquoi, et tous ses réglages

Revue du 20 novembre 2026, version 1.53.36, complétée le 24 novembre pour
l'onglet Outils › Lune (1.53.63). Écrit pour être lu sans ouvrir le
code. Trois questions : qu'est-ce qu'il fait, est-ce taillé pour toi seul, et
qu'est-ce qui cloche dans Réglages.

---

## 1. En une page

Le Copilote est une extension Chrome/Edge qui ouvre un panneau à droite de la
page OGame. Il **lit** les pages du jeu, en tire un modèle de ton empire, et
répond en permanence à une seule question : **qu'est-ce que je fais là, tout de
suite ?**

Il ne clique jamais à ta place. Il ne remplit aucun champ. Il ne sort aucune
donnée de ton navigateur — sauf un appel à l'API publique de ton univers (le
classement, que tout le monde peut lire) sans aucun identifiant.

Quatre onglets :

| Onglet | Ce qu'on y trouve |
|---|---|
| **Aujourd'hui** | La ou les actions à lancer maintenant, les alertes, la journée à venir heure par heure, les minuteurs |
| **Empire** | Production par planète, niveaux de tous les bâtiments, niveaux visés, recherches, le centre |
| **Outils** | Cibles (inactifs à piller, positions libres, systèmes à explorer) · Colonie · Flotte (calculatrice) |
| **Réglages** | Plan du jour, formes de vie, univers, bonus, page du jeu, sauvegarde |

---

## 2. Les décisions qui façonnent tout le reste

### 2.1 Lecture seule, par principe

Le copilote lit et conseille. Il n'envoie aucune flotte, ne lance aucun
chantier, ne remplit aucun formulaire. Quand une carte demande de retaper un
chiffre dans le jeu, elle te le donne en pastille cliquable (⧉) que **tu**
colles. Le commentaire du code est explicite : remplir les champs « serait
jouer à sa place, et c'est ce qui fait bannir un compte ».

Conséquence visible : chaque carte a un bouton **Lancé** ou **Fait** que tu
cliques toi-même. C'est comme ça que le plan apprend qu'une file est occupée.

Une exception, et elle ne joue pas à ta place : une carte qui demande d'envoyer
une flotte se marque **Fait** toute seule dès que le jeu montre ce mouvement
dans tes mouvements de flotte. Le copilote ne fait que lire ce que tu as déjà
fait — te le faire reconfirmer d'un clic, c'est te demander de répéter ce qu'il
voit. L'expédition en est exclue : rien ne la distingue d'une expédition
ordinaire, et la confondre éteindrait la carte du soir sans rien mettre à
l'abri.

### 2.2 Une seule file, pas un tableau de bord

La décision fondatrice (8 novembre) : l'appli savait déjà calculer
l'amortissement d'une mine, la flotte d'expédition, les positions libres, les
inactifs à portée — et rangeait chaque calcul derrière son propre onglet. Le
tri, « c'est-à-dire la seule chose que le joueur ne sait pas faire », restait à
ta charge.

Donc : **toutes les familles d'action se classent dans la même file** —
bâtiments, recherches, expéditions, espionnage, pillage, colonisation, formes de
vie, défense, mise à l'abri. Et chaque ligne dit ce qui la bloque : payable,
dans 1 h 10, manque 12 k métal.

### 2.3 Tout passe par une simulation de la journée

C'est le cœur. À chaque affichage, le copilote **rejoue ta journée** :

1. Il copie ton empire (niveaux, stocks, flotte, files en cours).
2. Il découpe le temps en **connexions** : maintenant, puis toutes les
   *N* minutes (ton réglage), en sautant ta nuit, jusqu'à l'**horizon**
   (12, 24 ou 48 h).
3. À chaque connexion il fait avancer la production, puis essaie dans cet
   ordre : laboratoire si une recherche l'attend → **tes priorités** →
   recherche critique → vaisseau de colonisation → rapatriements entre planètes
   → expéditions → satellites solaires → formes de vie → bâtiments →
   transporteurs / sondes / défense → recherche « s'il reste de quoi ».
4. Ce qui n'est pas payable devient une ligne **« En attente de ressources »**
   avec l'heure à laquelle les ressources seront réunies.

En sortie : les cartes de maintenant, la frise des connexions suivantes, et le
gain de production attendu sur l'horizon (« Production +4,2 % en 24 h »).

**Ce que ça implique** : le plan ne se « recalcule » pas quand tu cliques, il
est recalculé *en entier à chaque rendu*. Rien n'est stocké. C'est pour ça
qu'un changement de réglage prend effet immédiatement — mais aussi pour ça
qu'il n'y a aucune trace de « ce que le plan avait dit hier ».

### 2.4 Le juge, c'est l'amortissement

Pour choisir quoi construire, le copilote classe les améliorations par **temps
d'amortissement** : combien coûte le niveau (en équivalent métal, selon ton
ratio d'échange) divisé par ce qu'il rapporte en plus par heure. La centrale
solaire que le niveau oblige à monter est comptée dans son prix. Les foreuses
sont dans le même classement, à côté des mines.

**Mais le cours n'est pas le prix.** Le ratio d'échange dit ce qu'une ressource
vaut au troc. Lu comme des quantités, il dit donc aussi le mélange qu'il
faudrait produire pour n'avoir jamais à troquer : avec 3:2:1, trois de métal
pour deux de cristal pour un de deutérium. Un empire qui produit plus que sa
part de métal n'en tire pas le prix du livre — il l'empile dans un hangar, ou
il le brade. Le classement en tient compte : chaque ressource reçoit un
**facteur de besoin**, borné entre 0,5 et 2, et c'est à ce prix-là que les
mines sont comparées.

C'est ce qui fait que la mine de métal cesse de revenir sur une planète à
cristal quand ton empire déborde déjà de métal. Le mélange produit, sa cible et
les trois facteurs se lisent en haut de l'onglet **Empire**, sous la production
de l'empire.

Deux choses ne bougent pas pour autant :

- **Le chiffre affiché sur la carte** reste l'amortissement au cours du ratio,
  celui que tu peux refaire de tête. Le besoin change l'**ordre**, pas le
  chiffre — sinon une mine montée sur une autre planète ferait bouger une durée
  que tu venais de lire.
- **Le délai de retour d'une colonie** (Outils › Colonie) reste mesuré au cours
  aussi : il compare des *positions* entre elles, et une comparaison demande une
  règle fixe.

Le bonus de position de la planète, lui, n'a pas besoin d'être rajouté : il est
déjà dans la production, donc déjà dans l'amortissement. Une planète en
position 1 voit son cristal crédité de +40 % avant même le classement. La carte
le dit maintenant en clair, au lieu de laisser deviner.

Deux secours passent **devant** le classement, parce qu'ils coûtent de la
production à chaque heure :

- énergie négative → la centrale ou les satellites,
- hangar bientôt plein → le hangar.

Et quelques candidats forcés : le labo quand une recherche l'attend, les robots
quand ils sont trop en retard sur les mines, le chantier quand une colonie a
besoin de ses propres transporteurs.

### 2.5 Tes priorités dominent le moteur

Dans **Empire**, chaque bâtiment et chaque recherche a un petit champ « → » :
le **niveau visé**. Tu peux aussi faire un clic droit sur une tuile dans le
jeu. C'est ce que le glossaire appelle une **priorité**.

Une priorité **gèle l'épargne de sa planète** jusqu'à ce qu'elle soit payable.
Les règles, qui expliquent beaucoup de comportements :

- **Une seule priorité agit par planète** à la fois ; les suivantes
  « attendent leur tour », dans l'ordre où tu les as posées. Deux réserves sur
  une planète la gèleraient deux fois plus longtemps.
- Elle passe **derrière les deux secours** (énergie, hangar) et **devant tout
  le classement par amortissement**.
- Tant qu'une priorité épargne sur une planète, **le moteur ne s'offre plus
  d'objectif à lui** : la recherche critique et le vaisseau de colonisation
  attendent leur tour, et leur ligne le dit.
- L'ordre de pose décide aussi **où vont les rapatriements** : la première
  posée reçoit, les suivantes ne font que la nourrir.
- Une priorité de recherche ne saute pas les prérequis : le plan épargne pour
  le **palier lançable** (Laser 1), pas pour la cible lointaine (Plasma 12).
- Le bloc des priorités dit, pour chacune, ce que le plan en fait **à cette
  session** : « elle avance », « elle épargne pour X », « rien ne part pour
  elle », « elle attend son tour derrière Y ». Pas une déduction : l'état réel.

### 2.6 Une planète n'est jamais désignée par son nom ni ses coordonnées

Décision archivée (`docs/adr/0001-identite-de-planete.md`). Nom, coordonnées,
identifiant de jeu et rang dans la liste peuvent tous changer, manquer ou se
répéter. Chaque planète porte donc un **identifiant propre au copilote**, et
tout ce qui est enregistré (plan, minuteurs, priorités, départ de colonie) ne
porte que celui-là.

La conséquence qui compte : un identifiant qui ne répond plus ne désigne
**aucune** planète. On ne crédite personne. L'inverse d'un rang, qui a toujours
l'air valide et désigne la voisine en silence.

### 2.7 Le centre

Dès deux planètes, le copilote désigne un **centre** : la planète qui porte le
labo et le chantier. Règles reprises du wiki : la plus grande, pas la mère
(dont le nombre de cases est borné), **et aucun centre si tu joues flotte**
(tes planètes doivent rester dispersées).

Seul le labo décide du centre, jamais le chantier : un centre posé ailleurs
ferait repayer un labo déjà payé. Tant qu'aucun labo n'existe, c'est le nombre
de cases qui tranche. Tu peux forcer le choix avec la case « Centre ».

**Un seul labo compte, celui du centre.** La durée d'une recherche se calcule
sur lui seul (`labLevel()`), pas sur le plus haut de l'empire et pas sur une
somme — le code dit pourquoi : annoncer le maximum « ferait promettre une durée
que le jeu ne tiendra pas ». Si tu as des labos sur toutes tes planètes, leurs
niveaux sont relevés et affichés, mais **ils n'entrent dans aucun calcul** ; ils
ne servent qu'à désigner le centre, tant que tu ne l'as pas forcé.

**Sauf avec le Réseau de recherche intergalactique.** C'est la techno qui fait
compter les autres labos, et elle est désormais modélisée. Deux niveaux de labo
coexistent donc, et il ne faut pas les confondre :

| | Ce qu'il décide | Ce qu'il vaut |
|---|---|---|
| `labLevel()` | ce qui est **débloqué** | le labo du centre, seul |
| `labEffectif()` | la **vitesse** d'une recherche | labo du centre + les N meilleurs labos des autres planètes, N = niveau du Réseau |

Le Réseau **n'aide jamais à remplir un prérequis** : un prérequis est une
propriété de la planète. C'est la raison pour laquelle les deux rôles sont
séparés — ils passaient par la même fonction, et c'est pour ça que les labos
des autres planètes ne servaient à rien.

L'onglet Empire affiche les deux dès qu'il y a un Réseau : « labo niveau 12 ·
réseau 22 ». Sur un centre à 12 et une colonie à 10, Plasma 1 passe de 28 min à
16 min.

Deux choses restent incertaines, faute de source lisible (le wiki fandom
répond 402) : un éventuel **niveau minimum** pour qu'un labo compte, et le sort
des **lunes**. Le copilote somme les N plus hauts tels quels, et le commentaire
du code le dit. Choix assumé par ailleurs : **le plan ne conseille pas** de
monter le Réseau — aucune feuille de route ne contient `irn`. Il le compte
quand tu l'as, il ne te pousse pas à l'acheter.

### 2.8 La défense se compte par type

Le glossaire est net : la défense ne protège pas la planète, elle **rend le
pillage non rentable**. Et « un tas d'un seul type est gratuit à percer » — le
croiseur dévore les lanceurs de missiles, le destructeur les lasers légers, et
aucun des deux ne peut rien contre l'autre. Donc le copilote compte chaque type
séparément, et construit d'abord la chair à canon (lanceurs + lasers légers),
puis les canons du moins cher au plus cher.

Une planète **sans aucune défense** passe devant tout : c'est le cas où le raid
est gratuit pour l'attaquant. Au-dessus de zéro, elle se complète en dernier,
par paquets qui valent au moins une tournée de production.

### 2.9 Il faut jouer en français

Le copilote lit le texte des pages. Le tableau de production, les slots de
flotte, les expéditions et les artéfacts sont **attendus en français**. Dans
une autre langue, les niveaux et les files continuent de marcher, mais ces
quatre-là restent vides **sans rien dire**.

### 2.10 Quand on ne sait pas, on le dit

Un fil rouge dans tout le code. Exemples :

- Un rapport d'espionnage qui ne montre pas la défense donne « ton rapport ne
  montre pas sa défense », pas « il n'a pas de défense ».
- Un chantier qui a sorti un lot dont le jeu n'a pas dit le nombre marque la
  planète comme « floue » : le plan ne propose plus de vaisseaux dessus.
- Une planète dont la page Défense n'a jamais été lue ne reçoit aucune
  proposition de défense — ce serait doubler ce qui existe déjà.
- Les satellites sont écartés sur une planète sans défense vue, avec
  l'explication (« un satellite part en débris au premier raid »).

---

## 3. Comment ça marche, de la page au conseil

Quatre morceaux :

```
page OGame ──> content.js ──> background.js ──> app.js (panneau)
  (le jeu)      lit & peint    fusionne, sonne   modèle, simule, affiche
                     ^                                    |
                     └────────── repères, bande ──────────┘
```

**`content.js`** (2 500 lignes) tourne dans la page du jeu. Il fait deux choses :

- il **lit** : niveaux des tuiles, files en cours, stocks, flotte, défense,
  formes de vie, mouvements de flotte, slots d'expédition, classe, artéfacts.
  Il envoie un instantané toutes les 5 secondes, seulement quand quelque chose
  a changé ;
- il **repeint** : il surligne la tuile que le plan conseille, pose une bande
  en bas de page, une colonne de repères, les heures du serveur dans ton
  fuseau, et un champ « niveau visé » sur chaque tuile (clic droit). Aucun
  clic, aucun envoi : ce sont des repères.

**`background.js`** (le service worker) fusionne les instantanés dans un état
de jeu unique, programme les **alarmes** de fin de file, affiche les
notifications système, n'allume l'icône et le panneau que sur les onglets
OGame, et réinjecte le script de page quand l'extension a été rechargée.

**`app.js`** (5 000 lignes) est le panneau. Il contient le modèle du jeu
(coûts, temps de construction, production, vol, soute), la simulation de la
journée, les missions quotidiennes, et tout l'affichage. Il écrit son état dans
le stockage local sous la clé `ogame-copilot-v1`.

**Le bouton « Actualiser »** (en haut, visible seulement quand le relevé a plus
de 10 minutes) fait le tour complet : il enchaîne, pour chaque planète, les
pages Ressources → Paramétrage de production → Chantier → Défense →
Installations → Formes de vie, puis Recherche et Mouvements une seule fois, et
te ramène où tu étais. L'ordre est **par page et non par planète** : un relevé
interrompu à moitié rend un empire cohérent sur ce qu'il a lu (tous les stocks,
puis toutes les flottes) au lieu de deux planètes complètes et six muettes.

**Deux postes** se synchronisent par le stockage de l'extension : réglages,
plan du jour, formes de vie, pillages et missions faites sont partagés.

---

## 4. Est-ce centré sur tes priorités, ou ton ami peut-il l'utiliser ?

### La réponse courte

**Le copilote est généraliste dans son moteur, et taillé pour un débutant qui
monte une économie dans son réglage par défaut.** Un ami qui veut jouer mineur
peut l'utiliser tel quel, avec un réglage à changer (« Priorité → Économie
pure ») et deux choses qu'il devra ignorer.

### Ce qui est générique

Tout le modèle : coûts, production, température, bonus de position, formes de
vie, vol, soute, amortissement, défense par type, hangars, centre, vocations de
planète. Aucun de ces calculs ne suppose un style de jeu.

Les **quatre priorités** (Réglages › Plan du jour) changent vraiment la
feuille de route des recherches :

| Priorité | Feuille de route des recherches | Colonise de lui-même ? | Centre ? |
|---|---|---|---|
| **Équilibré** (défaut) | Espionnage 4 → Impulsion 3 → Astro 3 → Ordinateur 4 → Combustion 6 → Astro 5 → Énergie 8 → Laser 10 → Ion 5 → Plasma 4 → … | oui | oui |
| **Économie + colonie** | Impulsion 3 → Astro 3 → Ordinateur 2 → Espionnage 4 → Astro 5 → Astro 7 → Énergie 8 → Laser 10 → Ion 5 → Plasma 4 → … | oui | oui |
| **Économie pure** | Énergie 8 → Laser 10 → Ion 5 → **Plasma 6** → Impulsion 3 → Astro 3 → Ordinateur 4 → Plasma 10 | **non** | oui |
| **Flotte et expéditions** | Combustion 6 → Impulsion 3 → Espionnage 4 → Ordinateur 6 → Astro 4 → Hyperespace 3 → Propulsion hyper. 2 → … | oui | **non** |

« Économie pure » est exactement le profil mineur : Plasma le plus vite
possible (son bonus porte sur toutes les planètes), et le plan ne construit
jamais le vaisseau de colonisation de lui-même. Si ton ami colonise quand même,
il le fait à la main et le copilote suit.

### Ce qui est taillé pour toi (débutant, économie, 2026)

- **Le bloc « Début de partie »** : onze jalons figés, de « Labo 1 » à
  « Astrophysique 1 », avec le pourquoi de chacun. Il s'efface tout seul une
  fois les onze franchis. Pour un joueur avancé, c'est du bruit pendant une
  journée, puis plus rien.
- **Le ton des explications** : « le premier pilleur repart avec la moitié de
  ton stock sans rien perdre », « si le jeu refuse l'attaque, c'est la
  protection débutant ». Le document de conception l'assume : « l'extension
  n'est pas son tableau de bord, elle est sa connaissance du jeu ».
- **Le rythme supposé** : l'onglet ouvert toute la journée, des bips qui te
  ramènent. Les minuteurs et les notifications sont construits là-dessus.
- **Le défaut « Équilibré »** et la classe par défaut **Collecteur**.

### Les deux choses qu'un mineur devra ignorer

1. **Les cartes de flotte ne se coupent pas.** Pillage d'inactifs, espionnage,
   expéditions, missions de découverte : il n'y a **aucun réglage** pour les
   éteindre. Même en « Économie pure », le plan propose des expéditions dès
   qu'il y a des transporteurs libres, et l'onglet Outils › Cibles liste les
   inactifs. Le seul recours est le bouton **« Non »** sur chaque carte, qui la
   met de côté jusqu'à ce qu'on la remette (Réglages › Sauvegarde). C'est par
   carte, pas par famille.
2. **La mise à l'abri du soir** s'affiche dès que la nuit approche, quel que
   soit le style. Pour un mineur paisible dans un univers calme, c'est une
   carte de plus chaque soir. Elle disparaît si on met nuit début = nuit fin
   (voir § 5.4), mais on perd alors toute la notion de nuit.

Le **mode nuit** (bouton 🌙 de l'en-tête, ou Réglages › Plan du jour › « Mise à
l'abri ») vide le plan et ne laisse que la sécurité. C'est l'inverse du besoin
ici.

**Depuis la v1.55, il se propose tout seul.** Une heure avant `nightStart`, une
alarme du navigateur sonne — notification avec deux boutons *Oui* / *Non*, qui
marche panneau fermé — et le panneau affiche le même bandeau. *Oui* bascule en
mode nuit et ouvre aussitôt la page de flotte déjà remplie (vaisseaux,
destination, mission) du plus gros lot ; les autres lots restent en cartes dans
Sécurité. Le **chargement des ressources et la vitesse** ne passent pas par
l'URL : le jeu ne les accepte pas en paramètre, et le copilote ne clique jamais
à ta place. *Non* classe la question pour la nuit ; elle ne revient pas avant
le lendemain.

**Et il s'éteint tout seul.** L'allumage retient l'instant où la mise à l'abri
cesse de valoir — le même `wakeTime` qui choisit la vitesse de la flotte, donc
*le plan revient quand la flotte revient* : fin de nuit pour un coucher, heure
de retour pour une absence. Au battement de trente secondes et au chargement du
panneau, le terme passé rend le mode jour, efface l'heure de retour et le dit
par un bandeau. Avant, le mode nuit ne s'éteignait qu'au clic : au matin le
joueur retrouvait un plan vide et croyait le copilote en panne. Le réveil ne se
devine pas — « il est 7 h » ne distingue pas un réveil d'une absence qui
commence.

Allumé **en pleine journée**, le mode nuit ne veut plus dire « je dors » mais
« je m'absente ». La fin de la nuit ne répondait alors plus rien d'utile : à
9 h du matin, le retour tombait au lendemain 7 h et la mise à l'abri ne
proposait que des vols de vingt-deux heures, voire rien du tout. Le réglage
**« Retour vers (heure) »** donne l'heure du retour ; laissé vide, le copilote
suppose une absence de la longueur d'une nuit. Le seuil : tant que le coucher
est plus proche qu'une nuit, c'est un coucher et la fenêtre de nuit répond ;
au-delà, c'est une absence.

### Verdict

Donner l'extension à un ami mineur : **oui**, ça marche. À lui dire :
*Réglages › Plan du jour › Priorité = Économie pure*, puis **Actualiser**. Les
trois valeurs d'univers se lisent toutes seules (§ 6.3) — qu'il jette un œil au
badge du haut pour s'en assurer. Il devra ignorer les cartes de pillage, ou les
refuser une par une.

Ce qui manquerait pour que ce soit propre : une case « je ne joue pas la
flotte » qui éteigne d'un coup pillage, espionnage et expéditions. Le moteur a
déjà la notion (`FOCUS_FLOTTE`, qui ne contient que `fleet` et `equi`), elle ne
sert aujourd'hui qu'à doubler la feuille de route, pas à masquer des cartes.

---

## 5. Réglages et Plan du jour : ce que j'ai trouvé

Tu avais raison d'avoir un doute. Les réglages **fonctionnent** — ils sont
enregistrés et le plan les utilise — mais l'écran ne te le dit pas. Voici
l'ordre d'importance.

### 5.1 Le vrai problème : Réglages ne te répondait pas — **corrigé**

Chaque onglet a une fonction de rafraîchissement, qui redessine ce qui a
changé. **L'onglet Réglages n'en avait pas.** Quand tu changeais « Priorité »,
« Horizon », « Je me connecte toutes les », « Recherche » ou « Formes de vie » :

- la valeur était bien enregistrée et le plan s'en servait ;
- mais **rien ne bougeait à l'écran de Réglages**. Pas de message, pas de
  bandeau, pas de « enregistré ».

Le seul écho était le badge en haut — et il n'affiche que vitesse économie,
vitesse flotte et classe. Donc les réglages d'Univers avaient un retour
visible, ceux du Plan du jour n'en avaient aucun. C'est exactement l'écart que
tu as ressenti.

**Corrigé** : la carte « Plan du jour » porte maintenant une ligne de résumé,
recalculée à chaque changement, qui rejoue le plan et dit ce qu'il devient :

```
Économie + colonie · toutes les 90 min · nuit 23h–7h · 11 connexions avec
quelque chose à lancer · production +49,2 % en 24 h
```

Chaque réglage y bouge quelque chose : la priorité change le premier mot,
l'intervalle change le nombre de connexions, l'horizon change le « en N h » et
le pourcentage. En mode nuit, la ligne dit que le plan est en pause au lieu
d'annoncer un gain qui ne viendra pas.

### 5.2 Trois réglages existent mais n'ont aucun contrôle

`content.js` sait faire trois choses de plus sur la page du jeu, et le panneau
sait les envoyer — mais **aucune case ne les active** dans Réglages :

| Clé | Ce que ça fait | État |
|---|---|---|
| `large` | Élargit la page du jeu à 1400 px sur les pages où le copilote conseille | inatteignable |
| `peau` | Redessine entièrement la page du jeu (menu en rail, colonne de repères, barre de ressources en texte). Le code la qualifie lui-même d'« essai » | inatteignable |
| `clair` | Thème clair de cette peau, pour ressembler au panneau | inatteignable |

Seuls **« Épurer la page du jeu »** (`lean`) et **« Masquer les menus
payants »** (`noshop`) ont un contrôle. Les trois autres restent à « non » pour
toujours, sauf en modifiant la sauvegarde à la main (Réglages › Sauvegarde ›
coller un JSON avec `"peau": true` dans `settings`).

C'est soit du travail à finir, soit du code à retirer. En l'état, un lecteur du
code croit que la fonctionnalité existe, et le joueur ne la verra jamais.

### 5.3 Les heures de nuit ne sont pas bornées

Les champs « Nuit : de » et « à » portent bien `min=0 max=23`, mais la
conversion ne garde que « au moins 0 » — **pas de plafond**. Taper 30 dans
« de » l'enregistre tel quel, et la nuit devient silencieusement 0 h → 7 h au
lieu de ce que tu voulais. Pas grave, mais pas dit.

### 5.4 Nuit début = nuit fin éteint la nuit — **dit, maintenant**

Si les deux heures sont égales, il n'y a plus de nuit du tout : les connexions
ne sautent plus rien, et surtout **la carte de mise à l'abri du soir
disparaît**. C'est utile si c'est voulu (jouer 24 h/24), c'était un piège
silencieux si c'était une faute de frappe.

La ligne de résumé (§ 5.1) affiche désormais **« aucune nuit »** au lieu de
« nuit 7h–7h », qui avait l'air d'un réglage en place. Le comportement n'a pas
changé, il se voit.

### 5.5 Deux réglages aux valeurs figées

« Je me connecte toutes les » n'offre que 30 / 60 / 90 / 120 / 180 min, et
« Horizon » que 12 / 24 / 48 h. Si une sauvegarde importée contient une autre
valeur (45 min par exemple), la liste affichera « 30 min » pendant que le plan
utilisera 45. Peu probable, mais possible.

### 5.6 Les files de forme de vie des races non-Humaines — **corrigé**

La même règle — « quelle file de jeu porte cette case de forme de vie ? » —
existait en deux versions qui ne donnaient pas la même réponse. `ids.js` tient
la règle canonique ; le service worker en portait une seconde copie, qui ne
s'accordait avec elle que sur la série des Humains.

| Identifiant | `ids.js` | l'ancienne copie du worker |
|---|---|---|
| 11101 · 11301 · 11501 · 11701 · 11901 | bâtiments | bâtiments |
| 11201 | recherche | recherche |
| **11401 · 11601 · 11801 · 12001** | **recherche** | **bâtiments** |

Le relevé lit n'importe quel identifiant ≥ 11000 sur la page vivante. Pour une
autre race, un minuteur de recherche était donc classé comme bâtiment, fusionné
avec un minuteur de bâtiment finissant à moins de 5 s près, et l'alarme du
survivant effacée : **une notification perdue, sans trace.** Le worker défère
maintenant à `lfQueue`, comme le script de page le faisait déjà.

### 5.7 Le worker pouvait mourir en silence — **corrigé**

`merge()` est appelée sans `await` ni `catch`, et déréférençait sept champs de
l'instantané sans garde. Un instantané amputé levait donc un rejet non traité
**dans le service worker** : aucune notification, aucun badge, aucune console
que le joueur ouvrira — et l'état du jeu cessait simplement d'avancer.
Pendant ce temps `applyGame`, à l'autre bout de la même charge, est défensif
partout : les deux moitiés avaient des politiques d'erreur opposées.

Les champs sont désormais comblés une fois en tête de `merge`, et l'appel
capture : ce qui casse se dit au lieu de disparaître.

### 5.8 Un commentaire périmé

Dans la lecture des demandes venues de la page, un commentaire dit que
l'identifiant 33 (Terraformeur) « a un niveau dans le jeu, pas dans le
moteur ». Ce n'est plus vrai depuis le commit qui a fait entrer le Terraformeur
et le Dock spatial dans le modèle. Le code est bon, le commentaire trompe.

### Ce qui marche, et que j'ai vérifié

- Les 770 vérifications de `node test/run.js` passent.
- Chaque changement dans Réglages appelle bien l'enregistrement.
- Les quatre valeurs de « Priorité » ont chacune leur feuille de route (aucune
  ne retombe en silence sur une autre).
- La conversion des réglages refuse un mot qui n'est pas dans la liste et garde
  l'ancienne valeur — un garde-fou explicitement commenté, posé après un bug où
  un mode ajouté à l'écran devenait 0 en silence.

---

## 6. L'intégralité des configurations

### 6.1 Réglages › Plan du jour

| Réglage | Clé | Valeurs | Défaut | Effet |
|---|---|---|---|---|
| Priorité | `day.focus` | Équilibré · Économie + colonie · Économie pure · Flotte et expéditions | **Équilibré** | Feuille de route des recherches ; « Économie pure » n'ouvre aucune colonie ; « Flotte » supprime le centre |
| Je me connecte toutes les | `day.interval` | 30 · 60 · 90 · 120 · 180 min | **90 min** | Pas de temps entre deux connexions simulées ; sert aussi à mesurer une « tournée de production » (le plus petit lot qui vaille une connexion) |
| Nuit : de | `day.nightStart` | 0–23 | **23** | Début de la fenêtre sautée par la simulation ; déclenche la mise à l'abri |
| Nuit : à | `day.nightEnd` | 0–23 | **7** | Fin de cette fenêtre ; sert à calculer la vitesse de retour de la flotte mise à l'abri |
| Recherche | `day.research` | À son tour · Avant les bâtiments | **À son tour** | « Avant » rend critique la tête de liste : elle passe devant les chantiers et pose aussitôt sa réserve |
| Formes de vie | `day.lf` | Après les bâtiments · Avant tout le reste · Ne pas s'en occuper | **Après les bâtiments** | Place des deux files de forme de vie ; « avant » ignore ce qu'un bâtiment épargne |
| Horizon | `day.horizon` | 12 · 24 · 48 h | **24 h** | Durée simulée, et période du « Production +X % » |
| Mise à l'abri (nuit, absence) | `day.night` | oui / non | **non** | Mode nuit : vide le plan, ne garde que la sécurité. Aussi sur le bouton 🌙 de l'en-tête, et proposé tout seul une heure avant `nightStart` |
| Retour vers (heure) | `day.backHour` | 0–23 ou vide | **vide** | Heure de retour d'une absence de jour ; vide = absence de la longueur d'une nuit. Ignoré quand le coucher est plus proche qu'une nuit |
| *(interne)* | `day.askedOn` | jour civil | **vide** | Le jour où la question du coucher a reçu sa réponse, pour ne pas la reposer |
| *(interne)* | `day.until` | horodatage | **0** | Instant où la mise à l'abri cesse de valoir ; passé, le mode jour revient seul |

### 6.2 Réglages › Formes de vie découvertes

| Réglage | Clé | Valeurs | Défaut |
|---|---|---|---|
| Cases à cocher | `lf.found` | Humains · Roctas · Mécas · Kaeleshs | Humains + Roctas *(données d'exemple)* |

Sert à conseiller la forme de vie d'une nouvelle colonie. Ordre de préférence :
Roctas → Humains → Mécas → Kaeleshs ; en priorité « Flotte », Mécas →
Kaeleshs → Roctas → Humains.

### 6.3 L'univers et la classe — **lus, jamais saisis**

| Fait | Clé | Valeurs | Défaut | Effet |
|---|---|---|---|---|
| Vitesse économie | `settings.eco` | entier ≥ 1 | **1** | Multiplie production, temps de chantier, gain d'expédition |
| Vitesse flotte (pacifique) | `settings.fleet` | entier ≥ 1 | **1** | Divise les temps de vol |
| Classe | `settings.cls` | Collecteur · Général · Explorateur · Aucune | **Collecteur** | Collecteur : +25 % production de base, bonus foreuses, +25 % soute ; Explorateur : +50 % expédition, débloque l'Éclaireur |

Aucun champ ne les saisit : chaque page du jeu les déclare dans son en-tête
(`ogame-universe-speed`, `ogame-universe-speed-fleet-peaceful`,
`ogame-player-characterclass-id`) et le copilote les reprend telles quelles ;
les deux vitesses sont de toute façon écrasées par `serverData.xml` dès que
l'API répond (voir Outils › Serveur). Le badge en haut du panneau les affiche
(`éco x1 · flotte x1 · Collecteur`) : c'est là qu'on vérifie. Un badge vide
veut dire que le jeu n'a pas encore été ouvert — et alors **tout l'onglet
Empire est faux**.

### 6.4 Réglages › Bonus

| Réglage | Clé | Valeurs | Défaut | Effet |
|---|---|---|---|---|
| Géologue | `settings.geo` | oui / non | **non** | +10 % production |
| Ingénieur | `settings.eng` | oui / non | **non** | +10 % énergie |
| Foreuses en surcharge 150 % | `settings.crawlerOverload` | oui / non | **non** | Moitié plus de bonus, énergie doublée. À régler comme dans le jeu |
| Collecteur : +25 % soute | `settings.colCargo` | oui / non | **oui** | Soute effective des transporteurs |
| Ratio d'échange M:C:D | `settings.ratio` | trois entiers > 0 | **3:2:1** | Convertit tout en « équivalent métal » : c'est **l'unité de tous les classements** (amortissement, valeur de butin, valeur de défense) |

Le ratio est le réglage le plus silencieusement puissant : changer 3:2:1 en
2:1:1 change l'ordre de toutes les recommandations de mines. Il sert deux fois
depuis le facteur de besoin (§ 2.4) : comme cours pour convertir, et comme
**mélange cible** pour juger ce que ta production a en trop ou en moins.

### 6.5 Réglages › Allure du panneau

| Réglage | Clé | Valeurs | Défaut | Effet |
|---|---|---|---|---|
| Thème | `settings.skin` | `relief` / `domaine` / `hud` / `arcade` | **relief** | L'habillage du panneau |

- **Relief** — la palette d'origine en volume : dégradé et ombre sous chaque
  carte, titre à l'accent, jauges teintées à la couleur de leur ressource.
  Seule peau qui suit le thème clair du système ; les trois autres sont sombres.
- **Une couleur par page** — chaque onglet sa teinte : ambre pour Aujourd'hui,
  cyan pour Empire, violet pour Outils, vert pour Réglages. `--accent` suit, donc
  onglets et boutons changent avec la page.
- **Console de bord** — fond quadrillé, angles coupés, chiffres en mono qui
  luisent, diode devant chaque titre. Rien d'arrondi.
- **Arcade** — fond violet en dégradés, grands rayons, boutons épais qui
  s'enfoncent au clic.

La peau se pose sur `<html>` (`data-skin`), l'onglet courant à côté
(`data-page`, dont seule « une couleur par page » se sert) : aucune vue ne sait
qu'une peau existe, et c'est ce qui la fait valoir sur **toutes** les pages,
écran de relevé et bandeaux d'alerte compris. Tout tient dans `panel.css`.

### 6.6 Réglages › Page du jeu

| Réglage | Clé | Valeurs | Défaut | Effet |
|---|---|---|---|---|
| Épurer la page du jeu | `settings.lean` | oui / non | **non** | Retire barre Gameforge, en-tête, pied de page, pub ; fond sombre, menu plus grand |
| Masquer les menus payants | `settings.noshop` | oui / non | **non** | Marchand, Mess des officiers, boutiques |
| *(sans contrôle)* | `settings.large` | — | **non** | Page du jeu élargie à 1400 px |
| *(sans contrôle)* | `settings.peau` | — | **non** | Peau complète de la page du jeu (« un essai ») |
| *(sans contrôle)* | `settings.clair` | — | **non** | Thème clair de cette peau |

Allure seulement : ni le panneau ni les calculs ne changent.

### 6.7 Réglages › Sauvegarde

| Action | Ce qu'elle fait |
|---|---|
| **Copier mes données** | Met tout l'état en JSON dans le presse-papiers et dans la zone de texte. **C'est la seule copie de tes réglages** : à faire avant de désinstaller ou de changer de machine |
| **Importer** | Remplace l'état par un JSON collé (refusé s'il n'a ni `planets` ni `settings`) |
| **Réinitialiser…** | Remet les données d'exemple. Demande confirmation (deux clics) |
| **Remettre les cartes refusées** | Apparaît seulement s'il y a des « Non » en mémoire. Les remet toutes d'un coup |

### 6.8 Outils › Flotte

| Réglage | Clé | Valeurs | Défaut | Effet |
|---|---|---|---|---|
| Points du n°1 de l'univers | `settings.top1` | 9 tranches, de « < 10 000 » à « ≥ 100 M » | **< 10 000** | Plafond de trouvaille d'une expédition. **Devient inutile** dès que l'API publique a répondu : le classement donne le vrai chiffre, et l'écran le dit |
| Éclaireur dans la flotte | `expo.pf` | oui / non | **oui** | Double le plafond d'expédition (bonus communautaire, à vérifier en jeu) |
| Départ / Arrivée / Vitesse / nombre par vaisseau | `fleetCalc` | coordonnées, 100→10 %, entiers | 1:1:8 → 1:2:8, 100 %, 1 petit transporteur | Calculatrice de temps de vol et carburant. N'influence rien d'autre |

### 6.9 Outils › Colonie

| Réglage | Clé | Valeurs | Défaut | Effet |
|---|---|---|---|---|
| Planète de départ | `colo.fromId` | une planète | *(aucune)* | Sert au **classement des positions**. Ne décide plus où le vaisseau se construit : c'est le centre |
| Vaisseau de colonisation | `colo.built` | À construire / Déjà construit | **À construire** | Détecté tout seul s'il est vu dans ta flotte |
| Objectif | `colo.objective` | Équilibré · Métal · Deutérium · Grande planète | **Équilibré** | Pondère production / nombre de cases dans le classement des positions |
| Cases bonus de l'univers | `colo.bonus` | entier ≥ 0 | **0** | Cases offertes par l'univers, ajoutées à l'estimation |
| Destination | `colo.target` | coordonnées | *(proposée)* | Cible du vol. Se remplit aussi d'un clic depuis Outils › Cibles |
| Kit de démarrage | `colo.kit` | Aucun · Léger · Standard · Rapide · Avancé | **Standard** | Niveaux visés sur la colonie, donc ressources à emporter. Standard = mine métal 8, cristal 6, deut 4, solaire 8, robots 2 |
| Transporteurs | `colo.tr` | Petits / Grands | **Petits** | Type utilisé pour chiffrer le kit |
| Cases de la nouvelle planète | `colo.fields` | entier ≥ 1 | *(vide)* | À relever après l'arrivée, pour savoir si la colonie vaut d'être gardée |
| Position | `colo.fpos` | 1–15 | *(déduite)* | Idem, pour la température et les bonus |

### 6.10 Outils › Lune

| Réglage | Clé | Valeurs | Défaut | Effet |
|---|---|---|---|---|
| Planète visée | `moonCalc.pid` | une planète | *(ton centre)* | Celle qui reçoit le tir : c'est sa défense qu'on chiffre et sa flotte qu'on avertit de sortir |
| Ce qu'il envoie | `moonCalc.ship` | un des 14 vaisseaux | **Chasseur léger** | Décide le coût d'une coque, donc les débris qu'elle laisse |
| Combien | `moonCalc.n` | entier ≥ 0 | **0** | À 0, la carte ne sort aucun chiffre et demande le nombre |
| Chance visée | `moonCalc.viser` | 1 à 20 | **12** | Sert à la jauge inverse « pour X %, N vaisseaux ». 20 est le plafond du jeu |
| Son niveau de Bouclier | `moonCalc.bou` | entier ≥ 0 | *(le tien)* | Celui de ton camarade : il monte le bouclier de ses vaisseaux, donc baisse ce que ta défense tue |
| Débris de ton univers | `settings.debris` | 30 · 40 · 50 · 60 · 70 | **30** | En pourcent, un fait du serveur. À lire dans les paramètres de ton univers : il change le nombre de vaisseaux jusqu'à 2,3 fois |

Les cinq premiers **suivent sur ton autre poste** avec l'état du mode, dès que
ta planète visée porte un identifiant de jeu — voir la section suivante. Le
sixième suit de toute façon, c'est un réglage d'univers.

Rien dans cette carte n'influence le plan du jour ni quoi que ce soit d'autre :
c'est une calculatrice, comme Outils › Flotte. Le **mode lune**, lui, s'en sert
pour parler dans Aujourd'hui — section suivante.

### 6.11 Outils › Lune — le mode

Un interrupteur 🌑 dans Aujourd'hui, voisin du 🌙 du mode nuit. Tant qu'il est
allumé, les cartes du tir passent devant le reste du plan. Ses quatre champs
vivent dans Outils › Lune et non dans la carte, parce que la zone « Maintenant »
se réécrit toutes les 30 secondes et perdrait une saisie en cours de frappe.

| Réglage | Clé | Valeurs | Défaut | Effet |
|---|---|---|---|---|
| *(l'interrupteur 🌑)* | `lune.on` | oui / non | **non** | Allume le mode. Les cartes `Lune` sortent, et celle du tir **échappe au filtre du mode nuit** : un impact à 2 h du matin reste dit. Les autres attendent le réveil |
| Heure d'impact du prochain tir | `lune.impact` | date et heure | *(vide)* | Décide laquelle des quatre cartes sort. Dans l'heure qui précède, la carte passe **devant les chantiers** |
| Sa planète | `lune.rendu.coords` | coordonnées | *(vide)* | Où part le tir que tu rends |
| Chasseurs légers par tir rendu | `lune.rendu.n` | entier ≥ 0 | **0** | Ce que **ton camarade** demande. Le copilote ne voit pas sa défense et ne peut pas le calculer |
| Tirs promis | `lune.rendu.dus` | entier ≥ 0 | **0** | La dette. `lune.rendu.faits` compte ceux déjà envoyés |

Le compteur de tirs reçus, `lune.tirs`, est tenu **par planète** et avance quand
tu réponds « Pas cette fois ». Un « Lune ! » le remet à zéro et éteint le mode :
une campagne réussie ne lègue pas son compteur à la suivante.

**La campagne entière suit d'un poste à l'autre** : l'interrupteur, l'heure
d'impact, le compteur de tirs, la dette, et les réglages de la carte dont le
mode dépend. Elle voyage en **identifiants de jeu**, les seuls que tes deux
postes nomment pareil — tes identifiants de planète, eux, sont tirés au sort
sur chaque machine.

Deux garde-fous, et ils comptent. **Rien ne part** si une planète nommée dans
la campagne n'a pas encore d'identifiant de jeu : mieux vaut ne rien envoyer
qu'un paquet que l'autre poste lirait de travers. Et **rien n'est appliqué** si
la planète visée est inconnue sur le poste d'arrivée — sans cette règle, la
carte t'aurait dit d'évacuer ta planète mère pour un tir visant une colonie.

Un compteur dont la planète n'est pas encore relevée ici n'est pas perdu : il
attend le prochain échange, comme une priorité dans le même cas.

**Quatre choses que ce mode ne fait pas**, et chacune pour une raison :

- **Il ne voit pas l'attaque arriver.** `content.js` lit tes propres mouvements
  de flotte, jamais la boîte d'événements du jeu. C'est toi qui saisis l'heure.
- **Il n'affirme jamais que ta flotte est sortie.** `S.moves` ne porte aucun
  compte de vaisseaux, et le relevé au sol peut dater d'avant le départ. Un faux
  « elle est dehors » coûterait les millions que la carte existe pour sauver —
  c'est pourquoi la carte d'avant-impact n'a pas de bouton.
- **Il ne met pas les chasseurs du tir rendu dans ton plan.** La carte donne le
  nombre, le coût et la durée de chantier ; tu lances le chantier. Faire entrer
  des vaisseaux de combat dans l'arbitrage du plan demande ses propres garde-fous.

### 6.12 Empire — par planète

| Champ | Valeurs | Effet |
|---|---|---|
| Nom | texte | Affichage seulement |
| Coordonnées | `g:s:p` | Distances, bonus de position, température moyenne, liens Galaxie |
| °C max | entier | Production de deutérium, énergie des satellites |
| **Centre** | case à cocher, une seule planète | Force le centre. Décoche les autres. Absent si une seule planète ou priorité « Flotte » |
| 17 niveaux de bâtiment | entiers ≥ 0 | Métal, Cristal, Deut., Solaire, Fusion, Robots, Chantier, Labo, Nanites, Hangar M, Hangar C, Réserv. D, Dépôt, Silo, Terraformeur, Dock |
| **17 niveaux visés** (champ « → ») | entier ≥ 1, ou vide pour retirer | **Priorité** : le plan épargne pour l'atteindre (§ 2.5) |
| Satellites | entier ≥ 0 | Énergie |
| Stock Métal / Cristal / Deutérium | entiers | Avance tout seul avec la production ; à recaler quand tu dépenses hors du plan |

Dépôt de ravitaillement, Silo, Terraformeur et Dock ne produisent ni ne
stockent : **le classement par amortissement ne les propose jamais de
lui-même**. Ils sont là pour que tu puisses les viser.

### 6.13 Empire — recherches

15 technologies, chacune avec son **niveau** et son **niveau visé** : Énergie,
Laser, Ions, Hyperespace, Plasma, Combustion, Impulsion, Propulsion
hyperespace, Espionnage, Ordinateur, Astrophysique, Réseau intergalactique,
Armes, Bouclier, Protection des vaisseaux.

### 6.14 Réglages implicites (par clic, pas par formulaire)

| Geste | Où | Ce que ça règle |
|---|---|---|
| **Non** sur une carte | Aujourd'hui | Met cette carte de côté indéfiniment (`daily.no`) |
| **Fait** sur une carte | Aujourd'hui | Marque la mission faite pour sa période (1 h à 24 h selon la mission) |
| Flotte partie dans le jeu | mouvements de flotte | Marque **Fait** la carte qui demandait ce mouvement (partie d'une de tes planètes, même destination, même mission ; Transporter et Stationner se valent, l'expédition est exclue) |
| **Lancé** sur une action | Aujourd'hui | Crée un minuteur et débite le stock de la planète |
| Clic droit sur une tuile | page du jeu | Pose ou retire une priorité. Attend sa planète jusqu'à 24 h si elle n'a pas encore été relevée |
| Replier / déplier une carte | Aujourd'hui | Mémorisé (`ui.fold`) |
| Onglet d'Outils | Outils | Mémorisé (`ui.tool`) |

### 6.15 Ce qui n'est pas réglable — les choix figés

À connaître, parce que ce sont eux qui décident quand aucun réglage ne parle :

| Constante | Valeur | Rôle |
|---|---|---|
| Feuilles de route | 4 listes figées | § 4, tableau des priorités |
| Jalons de début de partie | 11, de Labo 1 à Astro 1 | Bloc « Début de partie » |
| Ordre de construction de la défense | lanceurs → lasers légers → petit bouclier → laser lourd → ions → Gauss → grand bouclier → plasma | Chair à canon d'abord |
| Fraîcheur du relevé | 10 min | Au-delà, le bouton « Actualiser » apparaît |
| Attente d'une demande orpheline | 24 h | Priorité posée sur une planète pas encore relevée |
| Horizon d'amortissement d'une colonie | 7 jours | Verdict « ça valait le coup » |
| Validité d'une lecture de slots d'expédition | 3 h | Au-delà, on repasse sur Astrophysique |
| Validité d'une lecture de formes de vie | 7 jours | Avant de redemander d'ouvrir la page |
| Minimum pour une mise à l'abri | 10 000 ressources | En dessous, le vol coûte plus qu'il ne protège |
| Énergie d'une foreuse | 50 | Comptée dans son amortissement |
| Niveaux de mines simulés pour la vocation | 20 | Pour comparer les terrains à armes égales |
| Objectif de robots | la moitié de la plus haute mine, plafonné à 10 | Candidat forcé si trop en retard |
| Objectif de soute de l'empire | 6 h de production, plafonné au gain max d'expédition | Déclenche les transporteurs |
| Sondes au centre | 5 | Pour espionner les inactifs |
| Seuil de rapatriement | 5 000 ressources, ou hangar à plus de 70 % | En dessous, aucun vol |

### 6.16 Fiabilité annoncée des calculs

Le panneau le dit lui-même, dernière carte de Réglages : les formules viennent
du wiki et du forum officiel. **Stables** : production, coûts, temps de vol.
**Moins sûrs** : la production de deutérium (formule des univers récents,
dépend de la température max), la durée des bâtiments de niveau 1 à 5, et les
plafonds d'expédition. À comparer une fois avec ton jeu.

---

## 7. Ce que je ferais ensuite, par ordre

~~Donner un retour visible à la carte « Plan du jour »~~ — fait (§ 5.1).
~~Modéliser le Réseau de recherche intergalactique~~ — fait (§ 2.7).

1. **Vérifier le prérequis du Réseau** (§ 2.7) : la table du copilote demande
   Labo 10, la page officielle de Gameforge dit 12. À lire dans le jeu.
2. **Trancher sur `peau` / `large` / `clair`** (§ 5.2) : les exposer, ou les
   retirer. C'est le plus gros morceau : du code écrit que personne ne verra.
3. **Une case « je ne joue pas la flotte »** (§ 4) pour que l'extension soit
   donnable à un mineur sans mode d'emploi.
4. **Borner les heures de nuit** à 0–23 à l'enregistrement (§ 5.3). Le résumé
   rend maintenant la bêtise visible, il ne l'empêche pas.
5. **Corriger le commentaire du Terraformeur** (§ 5.8).
