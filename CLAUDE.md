# Copilote OGame — consignes pour Claude Code

Extension Chrome MV3 en **lecture seule** : elle lit les pages d'OGame et dit au
joueur quoi faire ensuite. Elle ne clique jamais, n'envoie jamais rien au jeu.
Deux joueurs l'utilisent et la font évoluer, chacun avec ses sessions Claude Code.

## Règles non négociables

- **Lecture seule.** Aucune action de jeu, aucune requête vers le serveur du jeu
  au nom du joueur, aucune navigation qui ne parte pas d'un clic du joueur.
  Risque de bannissement : en cas de doute, on ne le fait pas.
- **Aucun appel réseau vers un tiers.** Seule l'API publique d'OGame
  (`serverData.xml`, `players.xml`, `universe.xml`, `highscore.xml`) est lue.
- **Aucune dépendance, aucun outil de compilation.** JavaScript brut, modules ES.
- **Français** pour l'interface, les commentaires, les messages de commit et les PR.
  Un commentaire dit *pourquoi*, jamais *quoi*.
- **ADR 0001** (`docs/adr/0001-identite-de-planete.md`) : une planète se désigne
  par son `id` local. Le `gid` du jeu n'apparaît qu'aux frontières.
- **Vocabulaire** : `GLOSSARY.md` fait foi. Une « cible » dans une issue
  (niveau visé par le joueur) est une **priorité** dans le code (`S.prio`).
  Ne pas la confondre avec les cibles de pillage (Outils › Cibles).

## Commandes

```sh
node test/run.js      # toutes les vérifications ; doit passer à chaque commit
./pack.sh             # construit dist/, le dossier que Chrome charge
```

La CI (`.github/workflows/tests.yml`) relance `node test/run.js` sur chaque PR.

## Où vit le code

- `app.js` : le panneau (état, moteur du plan, rendu). **En cours de découpage**
  vers `src/` (issue #49) : avant d'ajouter une fonction dans `app.js`, vérifier
  si son domaine a déjà un module (`src/core`, `src/flotte`, `src/defense`,
  `src/regles`, `src/securite`, `src/meteo.js`).
- `content.js` : lecture des pages du jeu et marquages sur les tuiles.
- `background.js`, `boot.js` : service worker et démarrage.
- `rules.json` : règles du moteur et leurs paramètres. Pas de seuil en dur dans
  le code quand il peut vivre ici.
- `test/` : `run.js` (moteur), `page.js` (content.js contre un DOM réduit).
- `docs/superpowers/specs/` et `plans/` : conception et plans des grosses évolutions.

## Une issue, de bout en bout

1. **Lire l'issue en entier**, sections « Recoupement avec l'existant » et
   « Pistes techniques » comprises. Vérifier les numéros de ligne cités : ils
   vieillissent vite pendant le découpage d'`app.js`.
2. **Partir de `main` à jour** : `git fetch origin && git switch -c <branche> origin/main`.
   - Branche : `enh-70-transport-palier`, `iss-72-onglet-journee`.
   - Une issue = une branche = un worktree = une session.
3. **Regarder les PR ouvertes** (`gh pr list`) et les fichiers qu'elles touchent.
   Si une PR ouverte modifie les mêmes zones, s'arrêter et le dire avant de coder.
4. **Gros changement** (plusieurs fichiers, nouveau comportement) : écrire d'abord
   un plan dans `docs/superpowers/plans/AAAA-MM-JJ-<sujet>.md`, le faire valider.
5. **Tests d'abord** : écrire le test qui échoue, puis le code. Chaque test est
   validé par mutation : saboter le code gardé, vérifier que le test échoue,
   remettre le code. Les vérifications existantes ne se modifient pas pour
   faire passer un changement : si l'une casse, c'est la conception qui est fautive.
6. **Petits commits**, chacun avec `node test/run.js` vert.
7. **Avant d'ouvrir la PR** : `git fetch origin && git rebase origin/main`, tests,
   puis **monter la version une seule fois**, dans un dernier commit :
   `APP_VERSION` (`app.js`) et `"version"` (`manifest.json`) ensemble.
   Correctif → patch (2.20.1), amélioration → mineure (2.21.0).
8. **PR** : titre `ENH-70 : <ce que ça change>` ou `ISS-72 : <ce que ça corrige>`,
   corps avec `Closes #70`, ce qui change pour le joueur, et comment le tester.
   Une PR = une issue. Si la PR attend et que `main` bouge, rebaser et
   remonter la version au-dessus de celle de `main`.

## Travailler à plusieurs sans conflits

- **Fichiers chauds** : `app.js`, `panel.css`, `sidepanel.html`, `rules.json`,
  `manifest.json`. Deux branches qui touchent la même zone d'un fichier chaud
  ne tournent pas en parallèle : on les enchaîne, ou on les regroupe.
- **Issues d'interface** (onglets, en-tête, cartes) : en série, ou sur une seule
  branche avec un commit par issue.
- **Issues de moteur** (calcul du plan, transports, règles) : peuvent avancer en
  parallèle des issues d'interface si elles ne touchent pas les mêmes fonctions.
- **Pendant le découpage d'`app.js` (#49)** : pas de nouvelle branche qui touche
  `app.js` avant que l'étape en cours soit fusionnée. Sinon chaque fonction
  déplacée devient un conflit.
- **La version** est la source de conflit la plus fréquente : elle ne se monte
  qu'au dernier commit de la PR, jamais dans les commits intermédiaires.
- Rebaser souvent sur `main` ; ne jamais fusionner `main` dans une branche.

## Issues

- Titre : `ISS-<numéro> <description courte>` pour une anomalie,
  `ENH-<numéro> <description courte>` pour une amélioration. Le numéro est celui
  de GitHub : on crée l'issue, puis on ajuste le titre.
- Label : `bug` pour ISS, `enhancement` pour ENH.
- Corps : le modèle du projet (Objectif, Contexte, Recoupement avec l'existant,
  Comportement attendu, Règles de calcul, Données d'entrée, Critères
  d'acceptation, Hors périmètre, Contraintes, Pistes techniques, Comment tester, Liens).
- Captures d'écran : sur la branche `issue-assets`, dossier `captures/`,
  nommées `issue-<numéro>-<sujet>.png`.

## Ne pas faire

- Ajouter une bibliothèque, un bundler ou un `package.json`.
- Écrire dans le DOM du jeu autre chose que les marquages déjà prévus par `content.js`.
- Lancer une navigation, un envoi de flotte ou un clic à la place du joueur.
- Coder un seuil, une durée ou un ratio en dur quand il peut vivre dans `rules.json`
  ou dans les Réglages.
- Pousser directement sur `main`.
