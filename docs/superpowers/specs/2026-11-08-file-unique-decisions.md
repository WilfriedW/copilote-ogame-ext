# File unique — journal des décisions

Les décisions prises pendant l'implémentation là où le plan ou la conception
étaient ambigus ou faux, chacune avec ce qu'elle coûte si elle est mauvaise.
Repris du ledger d'exécution, qui vivait hors du dépôt.



Pre-flight (interfaces partagées) :
- T1 Action/rankActions → T3 collect : champs `blocked`, `cost`, `launch`, `confirm`, `how`, `snoozeHours`, `id` tous présents dans la forme Action. OK.
- T2 project() → T3 : T3 construit des littéraux `{now, first:{acts,waits,goals}, busy}`. Conforme. OK.
- T3/T4/T5 → T6 : conflit. `collect(plan, missions, now)` ne prend pas les actions neuves.
  Ruling: T6 concatène — `rankActions([...collect(...), fleetsaveAction(...), recycleAction(...), freshnessAction(...)].filter(Boolean), now)` — garde `collect` dédié à l'adaptation des sources existantes — coût si faux : un site d'appel.
- T1 départage par `blocked.secs` vs T3 qui produit `{kind:'storage'}` sans `secs` : « absent = 0 » ferait passer un blocage insoluble devant une attente de 10 min.
  Ruling: la clé de tri vaut Infinity pour `kind==='storage'`, calculée dans le comparateur et jamais écrite sur l'objet — le test de T3 qui interdit un Infinity sur l'action reste vrai — coût si faux : ordre inversé entre deux lignes bloquées.

Task 1: Ruling: `next` exclut aussi `banner`, pas seulement `now` — les deux sont rendus dans leur propre bloc, les laisser dans `next` les afficherait en double — coût si faux : une ligne manquante dans Ensuite.
Task 1: complete (commits 45c881c..e5d188c, tests: node test/run.js → 8 vérifications passées)

Task 2: Ruling: la capture de référence passe de la console Chrome à un harnais Node (test/harness.js, DOM factice + horloge figée) — une copie manuelle n'est ni répétable ni vérifiable, le harnais protège la projection pendant les six tâches suivantes — coût si faux : le harnais diverge du vrai navigateur et donne une fausse assurance.
Task 2: Ruling: le bloc « Ta journée » de REFRESH.today est vidé dès maintenant (frise, phases, slotMs, nextS) — il lisait uniquement plan.sessions, que la tâche supprime, et le code ne compilerait pas sinon — anticipe une partie de la tâche 8 — coût si faux : rien, la tâche 6 réécrit ce rendu.
Task 2: complete (commits e5d188c..94cd9a4, tests: node test/run.js → 10 vérifications passées)

Task 3: Ruling: `loss` n'est PAS posé sur les actions de construction, alors que la spec cite « une file de construction vide » dans la règle 1 — la projection n'émet une construction que si la file est libre, donc toutes le seraient et le rang 0 deviendrait le cas normal, ce que l'anti-objectif « une file si longue qu'il faut la trier » interdit ; `loss` reste aux pertes exceptionnelles (slot d'expédition libre, hangar saturé, mission `bad`, emplacements de flotte pleins) — coût si faux : une file de construction libre se retrouve derrière une expédition au lieu de devant.
Task 3: Ruling: famille `chantier` ajoutée à la liste de la spec pour les actions du chantier spatial et les transferts — les ranger dans `expedition` fausserait la mémoire d'apprentissage, qui est indexée par famille — coût si faux : une étiquette de plus à mapper à l'affichage.
Task 3: Ruling: le test du hangar trop petit visait `next[0]`, il vise maintenant `banner` — une perte bloquée va au bandeau par le ruling de la tâche 1, le code est conforme à la spec — coût si faux : aucun, l'intention du test (aucun Infinity sur l'action) est préservée.
Task 3: complete (commits 94cd9a4..5571c48, tests: node test/run.js → 18 vérifications passées)

Task 4: Ruling: l'objet `night` gagne `startMs` en plus du `endMs` du plan — sans l'instant de début, la règle « dans l'heure qui précède la nuit » dépend du fuseau de la machine et le test n'est pas déterministe ; `start`/`end` restent pour le libellé — coût si faux : un champ de plus à construire côté appelant.
Task 4: Ruling: `nightWindow(now)` est extraite dans app.js dès maintenant, à la place du calcul que portait la mission `night` supprimée — c'est son héritier naturel et la tâche 6 en a besoin — coût si faux : aucun, la tâche 6 l'aurait écrite.
Task 4: Ruling: sans deuxième planète, la mise à l'abri passe par une expédition vers la position 16 du système — renvoyer null laisserait sans réponse le joueur le plus exposé, qui n'a qu'une planète — coût si faux : la durée d'expédition estimée par `stats` est approximative, la flotte peut rentrer un peu avant le réveil.
Task 4: complete (commits 5571c48..8c9ccb2, tests: node test/run.js → 26 vérifications passées)

Task 5: Ruling: la ligne d'accueil du premier démarrage sort même quand `hasBlockedSource` est faux — sans aucune donnée, toutes les sources se taisent, donc aucune ne peut signaler qu'elle attend : la condition ne s'appliquerait jamais et l'écran resterait vide — coût si faux : une ligne affichée à un joueur qui n'en avait pas besoin, une fois.
Task 5: complete (commits 8c9ccb2..a226346, tests: node test/run.js → 32 vérifications passées)

Task 6: Ruling: l'identifiant d'une action issue d'une mission redevient `m.id` brut au lieu de `famille:slug(id)` — le bouton « C'est fait » écrit S.daily.done[id] et missionDone relit S.daily.done[m.id] : un identifiant préfixé cassait la mise en sommeil — coût si faux : collision si une action non-mission prenait le même identifiant, ce qu'aucune ne fait (les autres sont préfixées par leur famille).
Task 6: Ruling: l'onglet `today` est renommé `queue` dans sidepanel.html et dans l'état sauvegardé dès maintenant, alors que la tâche 8 porte la réduction des onglets — la vue a changé de nom, laisser l'ancienne clé aurait rendu l'extension inutilisable entre les deux tâches — coût si faux : aucun, la tâche 8 reprend ce fichier.
Task 6: Ruling: la vérification manuelle en navigateur du brief est remplacée par deux tests de rendu de bout en bout sous le harnais, dont la capacité à échouer a été prouvée en cassant seenOf — je n'ai pas accès au Chrome de l'utilisateur, et un test répétable vaut mieux qu'un coup d'œil — coût si faux : le harnais ne voit ni la mise en page ni le CSS, qui restent à vérifier à l'œil.
Task 6: complete (commits a226346..9caf426, tests: node test/run.js → 34 vérifications passées)

Task 7: Ruling: S.learned est amorcé à {colonisation:1, formevie:1} et non {colonisation:0, formevie:0} comme l'écrit le brief — 0 est faux en JavaScript, shouldExpand aurait donc rouvert l'explication de ces deux familles alors que la spec les dit déjà faites une fois — coût si faux : aucun, 1 vaut « connu depuis toujours ».
Task 7: Ruling: les deux boutons portent `data-family`, lu par `learn()` — sans lui le gestionnaire ne sait pas quelle famille marquer, et l'identifiant d'une mission ne contient plus sa famille depuis le ruling de la tâche 6 — coût si faux : un attribut de plus dans le HTML.
Task 7: complete (commits 9caf426..92c54d2, tests: node test/run.js → 40 vérifications passées)

Task 8: Ruling: `adviceList`, `MILESTONES` et `SEV_LABEL` sont supprimés et non recâblés dans la file — leurs jalons de début de partie doublonnent ce que ROADMAPS/nextResearch et pickBuildings produisent déjà, et les garder sans destination aurait laissé du code mort — coût si faux : le joueur perd le fil « étape N sur 11 », à réintroduire comme source de la file si ça manque.
Task 8: Ruling: `VIEWS.build` entre dans Empire aux côtés de planets et research, comme le prévoit le tableau du plan — le classement par amortissement est ce qui explique à un débutant POURQUOI une mine est conseillée — coût si faux : une carte de plus dans Empire, qui est censé rester de la consultation.
Task 8: Ruling: ouvrir une ligne déclenche `render()` et non `REFRESH.queue()` — les champs des anciens outils injectés dans le volet ne sont câblés que par `bind()`, qui ne tourne qu'au rendu complet — coût si faux : un rendu complet à chaque ouverture, perceptible seulement si la file devient très longue.
Task 8: Ruling: `S.ui` disparaît avec la navigation Outils qu'il servait — coût si faux : aucun, plus rien ne le lisait.
Task 8: complete (commits 92c54d2..be101c4, tests: node test/run.js → 42 vérifications passées)

Final: relecture de branche par sous-agent (modèle le plus capable), verdict « pas prêt à fusionner » : 4 critiques, 10 importantes, 11 mineures.
Final: re-notation par effet — I7 (openId jamais libéré, classement gelé définitivement) relevée d'Importante à Critique ; mineure 4 (CSS de « Comment faire » orphelin, explications non mises en forme) relevée en Importante car elle touche la fonctionnalité d'apprentissage à chaque première fois ; mineure 11 (version) traitée car l'interface change entièrement.
Final: fixed C1 bind() avant refresh() — test « une action bloquée ne propose pas de bouton inerte » + « installation vierge » RED→GREEN, suite 52/52
Final: fixed C2 ligne dépliée recréée à chaque instantané — rendu gelé tant que openId est posé, suite 52/52
Final: fixed C3 pile de corvées à l'installation vierge — test « la file n'affiche que la ligne d'accueil » RED→GREEN, suite 52/52
Final: fixed C4 recyclage branché sur S.timers au lieu de S.moves — tests de recycleAction RED→GREEN, suite 52/52
Final: fixed I1 payback transmis par pickBuildings — test « une amélioration de mine porte son amortissement » RED→GREEN
Final: fixed I2, I3, I4, I5, I6, I7, I8, I9, I10 — tests de contenu RED→GREEN, suite 52/52
Final: Ruling: le court-circuit de la ligne d'accueil ne s'applique que si S.sample — la première version masquait tout l'écran d'un empire saisi à la main mais jamais synchronisé, cas réel du joueur qui tape ses niveaux ; ailleurs la ligne se classe comme une perte et occupe le bandeau — coût si faux : un joueur en données d'exemple ne voit rien d'autre, ce que la spec demande.
Final: Ruling: le harnais de test expose html() et les tests vérifient le contenu rendu, pas seulement l'absence d'exception — la relecture a montré que doesNotThrow laissait passer trois critiques sur quatre — coût si faux : aucun, les assertions portent sur ce que le joueur voit.
Final: minor (deferred): gestionnaires data-goto et data-sent sans producteur, plus un listener de clic vide
Final: minor (deferred): freeExpoSlots n'est plus appelé
Final: minor (deferred): famille espionnage déclarée mais jamais émise ; MISSION_FAMILY['Sécurité'] sans mission ; blocked.kind 'miss' documenté mais jamais construit
Final: minor (deferred): seenOf prend le maximum sur les planètes, donc visiter une planète rend « fraîches » les autres (le cas « jamais vue » est corrigé, pas celui-là)
Final: minor (deferred): fleetsaveAction lit p.stock brut au lieu de stockNow(p), et n'a pas de seuil minimal de ressources
Final: minor (deferred): les étapes how sont injectées sans échappement (volontaire pour les <b> des missions, mais fleetsaveAction y interpole des coordonnées)
Final: minor (deferred): FAMILY_LABEL porte 11 étiquettes là où la spec en décrit quatre ou cinq
Final: minor (deferred): REFRESH.fleet et REFRESH.colony n'ont pas de garde null comme REFRESH.explore
Final: minor (deferred): S.plan et S.ui restent dans l'état sauvegardé des anciens utilisateurs (code nettoyé, données non)
