#!/bin/sh
# Ce que Chrome charge, et rien d'autre. « Charger l'extension non empaquetée »
# sur le dossier du dépôt lui fait compter tout ce qui s'y trouve — l'historique
# git, les tests, les docs, les plans : quinze mégaoctets pour un demi-méga de
# code. On lui donne `dist/`, qui ne contient que les dix fichiers du manifeste.
# La liste est gardée par un test : test/run.js refuse qu'un fichier chargé par
# le manifeste ou par sidepanel.html manque ici.
set -e
cd "$(dirname "$0")"
FICHIERS="manifest.json background.js boot.js ids.js content.js app.js sidepanel.html panel.css icon32.png icon128.png"
rm -rf dist && mkdir dist
cp $FICHIERS dist/
rm -f copilote-ogame.zip
(cd dist && zip -qr ../copilote-ogame.zip .)
du -sh dist copilote-ogame.zip
