<!-- Fichier lu au début de chaque session Claude Code. Le garder sous 150 lignes :
     les procédures vont dans .claude/skills/, les règles par fichier dans .claude/rules/,
     les règles sans exception dans les hooks de .claude/settings.json. -->

# Copilote OGame

Extension Chrome MV3 en **lecture seule** : elle lit les pages d'OGame et dit au
joueur quoi faire ensuite. Elle ne clique jamais, n'envoie jamais rien au jeu.
Deux joueurs la développent, chacun avec ses sessions Claude Code.

## Règles du projet

- **Lecture seule.** Aucune action de jeu, aucune requête au serveur du jeu au nom
  du joueur, aucune navigation qui ne parte pas d'un clic du joueur. Risque de
  bannissement : en cas de doute, on ne le fait pas.
- **Aucun appel réseau vers un tiers.** Seule l'API publique d'OGame
  (`serverData.xml`, `players.xml`, `universe.xml`, `highscore.xml`) est lue.
- **Aucune dépendance, aucun outil de compilation** : JavaScript brut, modules ES.
  Pas de `package.json`.
- **Français** pour l'interface, les commentaires, les commits et les PR.
  Un commentaire dit *pourquoi*, jamais *quoi*.
- **Une planète se désigne par son `id` local** (ADR `docs/adr/0001-identite-de-planete.md`).
  Le `gid` du jeu n'apparaît qu'aux frontières.
- **Pas de seuil, durée ou ratio en dur** quand il peut vivre dans `rules.json`
  ou dans les Réglages.

## Vocabulaire

`GLOSSARY.md` fait foi. Pièges fréquents :
- Une **cible** dans une issue (niveau visé par le joueur) est une **priorité**
  dans le code (`S.prio`, `prios()`).
- Outils › **Cibles** désigne les cibles de **pillage** (`explore`, `raidTargets`) :
  rien à voir.

## Commandes

```sh
node test/run.js      # toutes les vérifications, environ 1 minute ; doit passer à chaque commit
./pack.sh             # construit dist/, le dossier que Chrome charge
```

La CI relance `node test/run.js` sur chaque PR. Un hook bloque tout `git push`
quand les tests échouent ou que la cible est `main`.

## Où vit le code

- `app.js` : le panneau. **En cours de découpage vers `src/`** (issue #49) :
  avant d'ajouter une fonction dans `app.js`, regarder si son domaine a un module.
- `src/core` (état, formules, temps), `src/plan` (plan du jour, priorités, nuit,
  missions, vocations), `src/flotte`, `src/defense`, `src/formes-de-vie`,
  `src/regles` (moteur de règles), `src/securite`, `src/meteo.js`, `src/vues`
  (navigation, en-tête, un fichier par onglet).
- `content.js` : lecture des pages du jeu (règles dans `.claude/rules/content-js.md`).
- `background.js`, `boot.js` : service worker et démarrage.
- `rules.json` : règles du moteur et leurs paramètres.
- `test/run.js` (moteur), `test/page.js` (`content.js` contre un DOM réduit).
- `docs/superpowers/specs/` et `plans/` : conception et plans des grosses évolutions.

## Façon de travailler

- **Traiter une issue** : suivre le skill `traiter-issue` (`.claude/skills/traiter-issue/`).
- **Créer une issue** : `/creer-issue`, avec les modèles de `.github/ISSUE_TEMPLATE/`.
  Titre `ISS-<n> …` (anomalie, label `bug`) ou `ENH-<n> …` (amélioration,
  label `enhancement`), `<n>` étant le numéro GitHub.
- **Une issue = une branche = une PR.** Branche `enh-<n>-<sujet>` ou `iss-<n>-<sujet>`,
  partie de `origin/main` à jour. Titre de PR `ENH-<n> : …`, corps avec `Closes #<n>`.
- **Tests d'abord**, validés par mutation (saboter le code, voir le test échouer,
  remettre le code). Les vérifications existantes ne se modifient pas pour faire
  passer un changement.
- **Gros changement** : un plan dans `docs/superpowers/plans/`, validé avant de coder.
- **Version** : `APP_VERSION` (`app.js`) et `"version"` (`manifest.json`) montés
  ensemble, **une seule fois, au dernier commit de la PR**, après rebase sur `main`.
  Correctif : patch. Amélioration : mineure.
- **Doute ou contradiction** entre l'issue et le code : s'arrêter et demander,
  plutôt que choisir seul.

## Travailler à plusieurs sans conflits

- **Fichiers chauds** : `app.js`, `panel.css`, `sidepanel.html`, `rules.json`,
  `manifest.json`. Deux branches qui touchent la même zone ne tournent pas en
  parallèle : on les enchaîne ou on les regroupe.
- **Issues d'interface** (onglets, en-tête, cartes) : en série.
  **Issues de moteur** (plan, transports, règles) : en parallèle si elles ne
  touchent pas les mêmes fonctions.
- **Pendant le découpage d'`app.js` (#49)** : pas de nouvelle branche sur `app.js`
  avant la fusion de l'étape en cours.
- Sessions en parallèle : une par worktree (`claude -w <branche>`).
- Rebaser sur `main` (`git rebase origin/main`), ne jamais fusionner `main` dans une branche.

## Ne pas faire

- Pousser sur `main`, forcer un push, réécrire l'historique de `main`.
- Écrire dans le DOM du jeu autre chose que les marquages prévus par `content.js`.
- Lancer une navigation, un envoi de flotte ou un clic à la place du joueur.
- Ajouter une bibliothèque, un bundler ou un `package.json`.

## Notes personnelles

Chacun peut ajouter ses préférences locales dans `CLAUDE.local.md` (ignoré par git).
