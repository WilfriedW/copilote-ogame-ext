#!/bin/sh
# Ce que Chrome charge, et rien d'autre. « Charger l'extension non empaquetée »
# sur le dossier du dépôt lui fait compter tout ce qui s'y trouve — l'historique
# git, les tests, les docs, les plans : quinze mégaoctets pour un demi-méga de
# code. On lui donne `dist/`, qui ne contient que les fichiers du manifeste.
# La liste est gardée par un test : test/run.js refuse qu'un fichier chargé par
# le manifeste, par sidepanel.html ou par panel.css manque ici.
set -e
cd "$(dirname "$0")"
FICHIERS="README.md manifest.json background.js boot.js ids.js content.js app.js sidepanel.html panel.css icon32.png icon128.png oxanium.woff2 plex-sans.woff2 jetbrains-mono.woff2"
rm -rf dist && mkdir dist
cp $FICHIERS dist/
rm -f copilote-ogame.zip
(cd dist && zip -qr ../copilote-ogame.zip .)

# Le zip qu'on donne n'emporte pas la clé, `dist/` la garde.
#
# `key` fixe l'identifiant de l'extension : sans elle, Chrome le calcule depuis
# le chemin du dossier chargé, donc il diffère d'un poste à l'autre — et le
# stockage local est rangé par identifiant. Elle est là pour que le Mac et le PC
# chargent la même extension et pas deux extensions jumelles aux données
# séparées. `dist/` la garde pour cette raison.
#
# Mais la clé est à ce compte-ci. Un joueur à qui on donne le zip hériterait du
# même identifiant : son installation serait un clone de la nôtre, pas la
# sienne. Rien ne fuite — la moitié privée n'est pas dans le dépôt et le
# stockage reste par profil — mais il n'a aucune raison de porter notre
# identité. On remplace donc son manifeste par le même sans cette ligne ; Chrome
# lui calculera son identifiant depuis son propre chemin.
TMP=$(mktemp -d)
ZIP="$PWD/copilote-ogame.zip"
grep -v '"key"' manifest.json > "$TMP/manifest.json"
(cd "$TMP" && zip -q "$ZIP" manifest.json)
rm -rf "$TMP"

du -sh dist copilote-ogame.zip
