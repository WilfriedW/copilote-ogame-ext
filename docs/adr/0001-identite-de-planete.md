# L'identité d'une planète est son id local, pas celui du jeu

Une planète était désignée de cinq façons : son rang dans `S.planets`, son id
local, le `gid` du jeu, ses coordonnées, son nom. Tout ce qui est enregistré —
le plan, les minuteurs, le départ de colonie — porte désormais le seul id
local, et les quatre autres sont des projections : on les lit, on les affiche,
on parle au jeu avec, on ne désigne plus une planète avec.

## Pourquoi pas le `gid`

C'est le choix qu'on attend, puisque c'est la vérité du jeu. Il ne tient pas :
le `gid` n'existe qu'une fois le jeu lu, donc une planète d'exemple, une
planète ajoutée à la main ou un empire importé n'en ont pas. Il est en plus
partagé avec le script de page et le service worker — trois tables de stockage,
`game.order`, les deux charges utiles, et les noms d'alarme de `background.js`
le portent — donc le redéfinir ne nous appartient pas. L'id local, lui, ne
quitte jamais le panneau.

## Conséquence qui compte

Un id qui ne répond plus ne désigne aucune planète, et l'appelant doit le
traiter comme tel : le retrait d'une planète par le joueur emporte ce qui la
visait, mais partout ailleurs un id muet laisse les choses en place sans rien
créditer. C'est l'inverse d'un rang, qui a toujours l'air valide et désigne la
voisine en silence — la faute qui a motivé cette décision.

## Coût

Les champs enregistrés ont changé de nom (`p` → `pid`, `colo.from` →
`colo.fromId`) et une conversion tourne au chargement, décidée sur le type :
un nombre est encore un rang. Revenir en arrière demanderait une deuxième
conversion.
