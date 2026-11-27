#!/bin/sh
# Ce que Chrome charge, et rien d'autre. « Charger l'extension non empaquetée »
# sur le dossier du dépôt lui fait compter tout ce qui s'y trouve — l'historique
# git, les tests, les docs, les plans : quinze mégaoctets pour un demi-méga de
# code. On lui donne `dist/`, qui ne contient que les fichiers du manifeste.
# La liste est gardée par un test : test/run.js refuse qu'un fichier chargé par
# le manifeste, par sidepanel.html ou par panel.css manque ici.
set -e
cd "$(dirname "$0")"
FICHIERS="README.md manifest.json background.js boot.js ids.js profils.js meteo.js flotte.js rules.json content.js masque.css masque-conf.js masque.js app.js sidepanel.html panel.css icon32.png icon128.png oxanium.woff2 plex-sans.woff2 jetbrains-mono.woff2"
# La feuille du masquage et sa configuration se tirent du JSON des sélecteurs :
# un sélecteur corrigé dans config/hide-selectors.json part au prochain paquet.
node config/masque-css.js
rm -rf dist && mkdir dist
cp $FICHIERS dist/

# L'historique des versions, que Réglages › Version affiche : une ligne par
# commit, et c'est l'empreinte du commit qu'on passe à `git checkout` pour
# revenir en arrière. Une ligne par commit et non par version : le numéro est
# bourré à presque chaque fois, mais deux commits de suite peuvent porter le
# même. Ce numéro ne vit pas dans le message mais dans le manifeste, d'où le
# `git show` par ligne. Tabulé et non JSON : un sujet de commit à guillemets casserait un JSON
# écrit au shell, une tabulation, il n'en porte pas.
#
# On écrit à côté avant de remplacer, et on ne remplace que si on a obtenu
# quelque chose. Une redirection crée son fichier avant de savoir si la
# commande a de quoi le remplir : hors d'un dépôt git — une extraction par
# `git archive`, un zip dézippé — `git log` ne rend rien et la ligne laissait
# un `versions.tsv` de zéro octet, sans un mot. La carte Version affichait
# alors un historique vide comme s'il n'y avait rien à montrer. Un dépôt sans
# git doit pouvoir construire, mais pas en silence.
TSV=$(mktemp)
{ git log -n 40 --date=short --pretty=format:'%h%x09%ad%x09%s' | while IFS="$(printf '\t')" read -r h d s; do
    v=$(git show "$h:manifest.json" 2>/dev/null | sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p' | head -1)
    printf '%s\t%s\t%s\t%s\n' "${v:-?}" "$d" "$h" "$s"
  done; } > "$TSV" 2>/dev/null || :
if [ -s "$TSV" ]; then
  mv "$TSV" dist/versions.tsv
else
  rm -f "$TSV"
  echo "pack.sh : aucun historique git lisible ici, dist/versions.tsv n'est pas écrit." >&2
  echo "          La carte Version dira qu'il arrive au prochain ./pack.sh." >&2
fi
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
