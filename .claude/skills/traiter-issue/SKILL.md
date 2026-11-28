---
name: traiter-issue
description: Traiter une issue GitHub du Copilote de bout en bout (lecture, branche, plan, tests, code, version, PR). À utiliser quand on demande de traiter, implémenter, corriger ou développer une issue ISS-<n> ou ENH-<n>, ou un numéro d'issue.
---

# Traiter une issue

## 1. Comprendre
- `gh issue view <n> --comments` : lire l'issue en entier, commentaires compris.
- Vérifier chaque référence de code citée (fichier, fonction) : `app.js` est en cours de découpage vers `src/`, les numéros de ligne vieillissent vite. Chercher par nom de fonction.
- Si l'issue contredit le code ou une autre issue, s'arrêter et poser la question avant d'écrire du code.

## 2. Vérifier qu'on peut démarrer
- `gh pr list` : lister les PR ouvertes et les fichiers qu'elles touchent (`gh pr diff <pr> --name-only`).
- Si une PR ouverte touche la même zone d'un fichier chaud (`app.js`, `panel.css`, `sidepanel.html`, `rules.json`), le dire et attendre sa fusion, ou proposer de travailler par-dessus sa branche.

## 3. Partir de main à jour
```sh
git fetch origin
git switch -c enh-<n>-<sujet-court> origin/main   # ou iss-<n>-…
```
Une issue = une branche. En parallèle d'une autre session : la lancer dans un worktree (`claude -w enh-<n>`).

## 4. Planifier
- Petit correctif (un fichier, un comportement) : annoncer le plan en 3 à 5 lignes et continuer.
- Sinon : écrire `docs/superpowers/plans/AAAA-MM-JJ-<sujet>.md` (tâches cochables, fichiers touchés, tests prévus) et le faire valider avant de coder.

## 5. Tests d'abord
- Écrire le test qui échoue (`test/run.js` pour le moteur, `test/page.js` pour `content.js`), le voir échouer.
- Écrire le code, voir le test passer.
- Mutation : saboter le code gardé, vérifier que le test échoue, remettre le code.
- Ne jamais modifier une vérification existante pour faire passer un changement : si elle casse, revoir la conception, ou demander.

## 6. Coder
- Un commit par étape, `node test/run.js` vert à chacun.
- Commentaires en français, qui disent pourquoi. JSDoc sur les fonctions exportées.
- Seuils et durées dans `rules.json` ou les Réglages, pas en dur.

## 7. Finir
```sh
git fetch origin && git rebase origin/main
node test/run.js
```
- Monter la version **une seule fois, dans le dernier commit** : `APP_VERSION` (`app.js`) et `"version"` (`manifest.json`), au-dessus de celle de `main`. Correctif : patch. Amélioration : mineure.
- Relire le diff complet (`git diff origin/main`) : rien hors périmètre, pas de code mort, pas de `console.log` de débogage.
- Cocher dans la PR chaque critère d'acceptation de l'issue, avec la preuve (test, capture, étape manuelle).

## 8. PR
```sh
git push -u origin <branche>
gh pr create --title "ENH-<n> : <ce qui change>" --body "Closes #<n> …"
```
Corps : ce qui change pour le joueur, critères d'acceptation cochés, comment tester, points à vérifier en revue.
