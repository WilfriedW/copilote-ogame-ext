---
name: Anomalie (ISS)
about: Quelque chose ne marche pas comme prévu
title: "ISS-<numéro> "
labels: bug
---

<!-- Titre : ISS-<numéro de l'issue> + description courte. Le numéro est connu une fois l'issue créée : ajuste le titre juste après. -->

## Objectif
Une ou deux phrases : ce qui doit marcher à nouveau, et pourquoi c'est gênant.

## Constat

* Ce qui se passe
* Ce qui devrait se passer
* Capture d'écran si possible
* Version du Copilote (Réglages) et page du jeu concernée

## Reproduction

1. Situation de départ
2. Action
3. Résultat obtenu

## Recoupement avec l'existant

* Code concerné (fichier, fonction), cause probable si connue
* Issue ou PR qui a pu l'introduire

## Comportement attendu

* Où, quand, quoi

## Critères d'acceptation

* [ ] Le scénario de reproduction donne le résultat attendu
* [ ] Un test garde le cas (il échoue sans le correctif)
* [ ] Aucune action de jeu déclenchée (lecture seule)
* [ ] Pas d'erreur console
* [ ] `node test/run.js` passe ; `APP_VERSION` et `manifest.json` montés ensemble

## Hors périmètre

* Ce que le correctif ne traite pas

## Pistes techniques

* Fichiers ou fonctions à toucher
* Points de vigilance

## Liens

* Issues liées (#numéro)
