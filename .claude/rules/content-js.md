---
paths:
  - "content.js"
  - "masque.js"
  - "masque-conf.js"
  - "config/**"
---

# Code qui tourne dans la page du jeu

- Lire le DOM du jeu, ne jamais déclencher d'événement (`click`, `submit`, `dispatchEvent`), ne jamais remplir un champ du jeu.
- Seules écritures permises : les marquages et masquages déjà prévus (classes, éléments ajoutés par le Copilote, préfixés).
- Aucune requête `fetch`/XHR vers le serveur du jeu au nom du joueur.
- La page ne modifie pas l'état du panneau : elle **demande** dans le stockage (ex. `prioAsk`), le panneau reste le seul écrivain.
- Tout sélecteur du jeu va dans `config/hide-selectors.json` ou une constante nommée : le jeu change ses classes sans prévenir.
- Chaque changement ici a son test dans `test/page.js`.
