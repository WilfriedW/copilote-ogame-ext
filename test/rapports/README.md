# Rapports d'espionnage de test

Ce que l'analyseur doit savoir lire. Leur provenance décide de ce qu'ils prouvent.

- **`faible.txt` — réel.** Transcrit d'une capture du jeu du 18 novembre 2026,
  fournie par le joueur : un rapport où l'espionnage était trop faible pour
  montrer autre chose que les ressources. Il prouve les titres de section, la
  phrase par laquelle le jeu avoue n'avoir rien vu, et l'accent grave que le jeu
  emploie à la place de l'apostrophe.
- **`complet.txt`, `nue.txt` — construits.** Le joueur n'avait aucun rapport
  montrant une flotte ou une défense. Ils fixent les *règles* — section lue,
  section vide, libellé inconnu — et non le vocabulaire : le format exact d'une
  ligne d'objet n'a jamais été vu.

C'est pourquoi l'analyseur se replie toujours sur « inconnu ». Un libellé mal
orthographié ne peut pas produire un « sans défense » : « nue » exige une
section vide, qu'aucune faute de vocabulaire ne fabrique. Le jour où un vrai
rapport complet arrive, il remplace `complet.txt` et corrige la table d'un mot.

## Rapports d'expédition

Aucun vrai rapport d'expédition n'a encore été relevé. Le vocabulaire de
`EXPO_MOTS` (app.js) est **construit** : des mots-clés (pirates, trou noir,
marchand, retard…) et non des phrases du jeu. La règle est la même que pour
l'espionnage : un texte qui ne contient aucun mot connu donne « autre », jamais
une supposition. Le jour où de vrais rapports arrivent, ils s'ajoutent ici et
les tests les lisent.
