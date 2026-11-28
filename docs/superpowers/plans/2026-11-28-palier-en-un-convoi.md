# ENH-70 : livrer le palier d'une cible d'installation en un seul convoi

Issue : #70. Branche : `enh-70-palier-en-un-convoi`.

## Le filtre qui tait la carte (critère 1)

Reproduit sur la fixture des tests : colonie à Robots 6, cible Robots 10, la
mère a 500 k M / 200 k C / 250 k D et 10 GT.

- Session 0 : une carte « Rapatrier vers Colonie : 16 600 M, 3 680 C, 12 300 D »,
  motif « épargne pour Robots 7 ». Le montant est `levelCost(robot, 7) − stock`,
  parce que l'objectif posé par la boucle des priorités (`prio:colo:robot7`)
  ne porte que le coût du pas (`prioStep`), et que `want` se calcule sur
  `g.cost` (`simulateDay`, boucle des rapatriements).
- Sessions suivantes : plus aucune carte. La mère porte `transferAt` jusqu'au
  retour de ses transporteurs, et quand elle est libre, la colonie a déjà de
  quoi payer le pas suivant ou est en chantier : `want` vaut 0, `sum < 5000`,
  la boucle passe (`continue`) sans rien dire.

Il n'y a donc pas un filtre unique, mais deux causes qui se cumulent :
`want` borné au pas, et `sum < 5000` / `transferAt` qui taisent la suite.

## Ce qui change

### 1. Le coût restant du palier (`src/plan/palier.js`, nouveau)

Fonctions pures, testables sans simulation :

- `palierDe(p, but, mode)` : `{k, de, a, cost}`. `de` = niveau courant de
  `p.b[k]`, `a` = niveau visé (`but.lvl`, déjà résolu par `prios()` entre
  `lvl` et `puis`, ou le prérequis choisi par `prioAvant`). En mode `niveau`,
  `a = de + 1`. `cost = rangeCost(B[k], de, a)`.
- `besoinPalier(cost, libre, prod, heures, cap)` : par ressource,
  `max(0, cost − libre − prod × heures)`, plafonné en mode `palier` à ce que
  le hangar de la destination peut loger (`cap − libre`). Rend aussi les
  indices plafonnés, pour l'avertissement `debordeTexte`.
- `choisirSources(besoin, cands, ratio)` : `cands` = `{q, libre[3], soute,
  dist, fuel}`. Règle de l'issue :
  1. les sources qui couvrent seules tout le besoin (stock libre et soute),
     la plus proche puis la moins chère en deutérium ;
  2. sinon la paire qui couvre le plus (au ratio du joueur), à couverture
     égale le moins de deutérium, la plus grosse part en premier ;
  3. au plus 2 sources.

### 2. La boucle des priorités (`simulateDay`)

Rien ne change pour l'épargne locale : la clé `prio:<pid>:<k><lvl>` et
l'objectif du pas restent tels quels (nettoyage, `prioEtat`). On ajoute sur
l'objectif un champ `g.palier = {k, de, a, cost, cible}` quand le pas est le
bâtiment visé lui-même (pas un détour par un hangar). `cible` est la phrase
du joueur : « Usine de robots 6 → 10 ».

### 3. La boucle des rapatriements

Avant la boucle par source, une passe par destination, dans l'ordre de pose
(`rang`) :

1. Pour chaque objectif qui porte un `palier` : besoin = coût du palier −
   stock libre de la destination (hors `reserveOf` des autres objectifs) −
   cargaisons déjà en route vers elle (vols réels `q.liv` et convois simulés
   de cette journée) − production jusqu'à l'arrivée.
2. Candidats : les autres planètes libres (`transferAt`), avec
   `libre = stock − keep` (le même `keep` qu'aujourd'hui : prochain chantier
   + réserves) et les vaisseaux de `flotteLibre(q)` (ni kit d'expédition, ni
   réserve de GT), via `soutePour`.
3. `choisirSources` choisit 1 ou 2 sources ; chaque convoi est une carte
   `kind:'transfer'`, mission 3, au format actuel, avec le titre « Transporter
   X M, Y C, Z D vers <planète> » et la raison « De quoi monter Usine de
   robots 6 → 10. » (la cible du joueur, jamais le pas).
4. La destination est marquée servie : la boucle par source ne lui envoie
   plus rien à cette session (`destOf` la saute).
5. Sous `SURPLUS_MIN`, rien. Si le besoin existe mais qu'aucun emplacement de
   flotte n'est libre, ou qu'aucune source n'a de transporteur libre : une
   ligne d'attente le dit (« Transport pour Robots 10 prêt, mais aucun
   emplacement de flotte libre avant HH:MM »).
6. Le secours d'une planète bridée garde sa précédence : la passe palier
   tourne après lui pour les sources qu'il a prises.

### 4. Retenir ce qui a été livré

Une fois le palier livré, la destination doit le garder pour les niveaux 8, 9
et 10 : sinon le pas suivant ne retient que le prix de Robots 8 et le reste
part dans une mine. `reserveOf` ajoute, pour un objectif qui porte un palier
déjà servi, le coût restant du palier (sans déduire la production). C'est la
seule retouche à `reserveOf`.

### 5. Les garde-fous

- Hangar : plafonné à 100 % en mode `palier`, la carte avertit
  (`debordeTexte`).
- Nuit : à la dernière session avant la nuit (`isNight(Tm + intervalle)`), on
  ne livre que le niveau suivant, et la carte dit pourquoi.

### 6. Réglage

`S.day.livraison` : `palier` (défaut) ou `niveau`, menu « Livraison d'une
cible » dans Réglages › Profil et plan du jour (il n'existe pas de section
« Priorités » dans les Réglages).

### 7. Bloc « Tes priorités »

`prioEtat` reçoit, pour la priorité servie, la phrase « Transport depuis
<planète> : de quoi monter Usine de robots 6 → 10. »

## Tests prévus (`test/run.js`, d'abord rouges)

- [ ] `palierDe` / `besoinPalier` : Robots 6 → 10 = 384 000 / 115 200 /
      192 000, moins stock et production ; mode `niveau` = prix de Robots 7.
- [ ] `choisirSources` : une source qui couvre seule l'emporte même plus
      loin qu'une paire ; sinon 2 au plus, la plus grosse part en premier.
- [ ] Plan : cible Robots 10, mère riche → une seule carte Transport depuis la
      mère, montant du palier, texte « Robots 6 → 10 », jamais « Robots 7 ».
- [ ] Trois planètes, B couvre tout, C a 100 k : seule B envoie, C rien vers A.
- [ ] Aucune ne couvre : 2 cartes au plus, la première la plus grosse.
- [ ] La source garde son prochain chantier et ses réserves ; kit d'expédition
      et réserve de GT restent à quai.
- [ ] Aucun emplacement libre : ligne d'attente, pas de silence.
- [ ] Hangar trop petit : avertissement et plafond.
- [ ] Dernière session avant la nuit : niveau suivant seulement.
- [ ] Robots à 10, cible Nanites 1, Ordinateur 10 : carte pour Nanites 1.
      Ordinateur 9 : pas de carte, ligne d'attente qui nomme Ordinateur 10.
- [ ] La session suivante ne renvoie pas un second convoi pour un palier en
      route.

Chaque test validé par mutation.

## Fichiers touchés

`src/plan/palier.js` (nouveau), `src/plan/journee.js`, `src/plan/surplus.js`
(exporter `flotteLibre`, `soutePour`), `src/vues/reglages.js`,
`src/core/etat.js` (défaut `livraison`), `test/run.js`, `app.js` et
`manifest.json` (version 2.21.0 au dernier commit).

## Hors périmètre

Comme l'issue : recherches, formes de vie, convois échelonnés sur plusieurs
sessions, construction de transporteurs. Une source sans transporteur à elle
n'est pas candidate (pas de détour Stationner depuis le hub pour un palier).
