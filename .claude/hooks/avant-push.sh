#!/bin/sh
# Garde-fou avant chaque `git push` lancé par Claude : jamais sur main, et jamais avec des tests rouges.
entree=$(cat)
commande=$(printf '%s' "$entree" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.command)||"")})')
dossier=$(printf '%s' "$entree" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write(j.cwd||"")})')
cd "${dossier:-$CLAUDE_PROJECT_DIR}" || exit 0

branche=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
case "$commande" in
  *" main"*|*":main"*|*"HEAD:main"*)
    echo "Push vers main refusé : passe par une branche et une PR." >&2; exit 2 ;;
esac
if [ "$branche" = "main" ]; then
  echo "Tu es sur main : crée une branche (enh-<n>-… ou iss-<n>-…) avant de pousser." >&2; exit 2
fi

if ! sortie=$(node test/run.js 2>&1); then
  echo "Push bloqué : node test/run.js échoue." >&2
  printf '%s\n' "$sortie" | tail -40 >&2
  exit 2
fi
exit 0
