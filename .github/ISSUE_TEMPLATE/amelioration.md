---
name: Amélioration (ENH)
about: Une nouvelle fonction ou un changement de comportement voulu
title: "ENH-<numéro> "
labels: enhancement
---

<!-- Titre : ENH-<numéro de l'issue> + description courte. Le numéro est connu une fois l'issue créée : ajuste le titre juste après. -->

## Objectif
Une ou deux phrases : ce que le joueur pourra faire, et pourquoi.

## Contexte

* Ce qui se passe aujourd'hui, et ce qui pose problème
* Exemple concret tiré du jeu si possible

## Recoupement avec l'existant

* Ce qui existe déjà dans le code (fichier, fonction, issue ou PR)
* Ce qui reste à faire dans cette issue

## Comportement attendu

* Où : panneau, onglet, page du jeu, Réglages
* Quand : chargement de page, changement de planète, fin de construction, clic
* Quoi : comportement détaillé, point par point

## Règles de calcul
Formules, seuils, ordre de priorité, valeurs par défaut (et lesquelles sont paramétrables).

## Données d'entrée
| Donnée | Source | Exemple |
|---|---|---|
| | | |

## Critères d'acceptation

* [ ] Critère vérifiable 1
* [ ] Critère vérifiable 2
* [ ] Aucune action de jeu déclenchée (lecture seule)
* [ ] Aucune navigation automatique : toute page ouverte part d'un clic du joueur
* [ ] Fonctionne au changement de planète sans rechargement
* [ ] Pas d'erreur console
* [ ] `node test/run.js` passe ; `APP_VERSION` et `manifest.json` montés ensemble

## Hors périmètre

* Ce que l'issue ne fait pas (v2 possible)

## Contraintes

* Lecture seule, pas d'appel réseau vers des serveurs tiers
* Performance : pas de ralentissement perceptible de la page du jeu
* Langue de l'UI : français

## Pistes techniques

* Fichiers ou fonctions à créer ou à réutiliser
* Points de vigilance

## Comment tester

1. Situation de départ
2. Action
3. Résultat attendu

## Liens

* Wiki, documentation, issues liées (#numéro)
