#!/usr/bin/env bash
# ③ point 1 : ce qui fait taire un test ou un contrôle, dans le diff de la branche (travail en
# cours compris, non suivis exclus) contre sa base. Signale sans bloquer :
#   - un fichier de test supprimé (un test déplacé ou renommé n'en est pas un) ;
#   - une ligne ajoutée qui saute un test (`skip`, `skipTest`, `.skip(`, `xit(`,
#     `pytest.mark.skip`) ou fait taire le lint ou les types (`noqa`, `eslint-disable`,
#     `@ts-ignore`, `@ts-expect-error`, `type: ignore`), hors `.md`.
# La session ne juge que ce qu'il signale, et les attendus modifiés, qu'aucun motif ne voit.
# Usage : garde.sh <base>, depuis le dépôt (`origin/main`, ou la base de la PR).
# Sortie : une ligne par signalement, puis le compte ; code 0, sauf git en échec (2).
set -uo pipefail

base=${1:?usage : garde.sh <base>}
cd "$(git rev-parse --show-toplevel)" || exit 2
mb=$(git merge-base "$base" HEAD) || exit 2
g() { git -c core.quotePath=false "$@"; }
echo "base       $base ($(git rev-parse --short "$mb"))"

supprimes=$(g diff --name-only --diff-filter=D -M "$mb") || exit 2
tests=$(printf '%s\n' "$supprimes" | grep -E \
  '(^|/)(tests?|__tests__|spec)/|(^|/)test_[^/]*\.py$|_test\.(py|go)$|\.(test|spec)\.[cm]?[jt]sx?$' \
  | sed 's/^/test supprimé    /')

diff=$(g diff -U0 --no-color --no-ext-diff -M "$mb") || exit 2
lignes=$(printf '%s\n' "$diff" | awk '
  # `+++` : un en-tête avant le premier `@@` du fichier ; après lui, une ligne ajoutée.
  /^diff --git / { entete = 1; next }
  entete && /^\+\+\+ / { fichier = ($0 == "+++ /dev/null") ? "" : substr($0, 7); next }
  /^@@ / { entete = 0; split($3, n, ","); ligne = substr(n[1], 2) + 0; next }
  /^\+/ {
    texte = substr($0, 2)
    if (fichier != "" && fichier !~ /\.md$/) {
      motif = ""
      if (texte ~ /[@.]skip(Test|If|Unless|if)?([^A-Za-z0-9_]|$)/ ||
          texte ~ /(^|[^A-Za-z0-9_.])x(it|describe|test)\(/) motif = "test sauté"
      else if (texte ~ /(#|:)[ \t]*noqa/) motif = "noqa"
      else if (texte ~ /eslint-disable/) motif = "eslint-disable"
      else if (texte ~ /@ts-(ignore|expect-error)/) motif = "ts-ignore"
      else if (texte ~ /type:[ \t]*ignore/) motif = "type: ignore"
      if (motif != "") {
        sub(/^[ \t]+/, "", texte)
        printf "%-16s %s:%d  %s\n", motif, fichier, ligne, texte
      }
    }
    ligne++
  }')

n=0
for bloc in "$tests" "$lignes"; do
  [ -n "$bloc" ] || continue
  printf '%s\n' "$bloc"
  n=$((n + $(printf '%s\n' "$bloc" | wc -l)))
done
if [ "$n" -eq 0 ]; then echo "garde      rien à signaler"; else echo "garde      $n signalé(s), à juger"; fi
