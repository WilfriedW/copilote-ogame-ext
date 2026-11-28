---
name: creer-issue
description: Créer une issue GitHub du Copilote au bon format (titre ISS-/ENH-, label, modèle du dépôt, recoupement avec le code). À utiliser quand on demande de créer, rédiger ou ouvrir une issue, une anomalie ou une demande d'amélioration.
disable-model-invocation: true
---

# Créer une issue

1. **Type** : anomalie (ça ne marche pas comme prévu) → `ISS`, label `bug`, modèle `.github/ISSUE_TEMPLATE/anomalie.md`. Amélioration (nouveau comportement) → `ENH`, label `enhancement`, modèle `.github/ISSUE_TEMPLATE/amelioration.md`.
2. **Recouper avec le code** avant d'écrire : chercher les fonctions concernées, les issues et PR liées (`gh issue list --state all --search "<mots>"`). Remplir « Recoupement avec l'existant » avec des noms de fonctions et de fichiers, pas seulement des numéros de ligne.
3. **Signaler les angles morts** dans « Pistes techniques › Points de vigilance » : effets de bord, erreurs console probables, réglages à conserver, conflits avec d'autres issues.
4. **Créer**, puis ajuster le titre avec le numéro obtenu :
   ```sh
   n=$(gh api repos/{owner}/{repo}/issues -f title="ENH tmp" -F body=@corps.md -f "labels[]=enhancement" --jq .number)
   gh api -X PATCH repos/{owner}/{repo}/issues/$n -f title="ENH-$n <description courte>"
   ```
5. **Capture d'écran** : la pousser sur la branche `issue-assets`, dossier `captures/`, nom `issue-<n>-<sujet>.png`, et l'afficher dans le corps avec l'URL `raw.githubusercontent.com/<owner>/<repo>/issue-assets/captures/…`.
6. Rendre le lien de l'issue et les décisions laissées ouvertes.
