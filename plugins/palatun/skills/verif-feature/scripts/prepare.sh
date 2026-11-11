#!/usr/bin/env bash
# Prépare une passe de verif-feature : base, retard, périmètre, diff, commits, chemins à risque.
# Usage : prepare.sh <dossier-de-travail> [base] [-- chemins du lot…]
# N'écrit que dans le dossier de travail ; ne merge rien (la décision reste au skill, point ①).
set -euo pipefail

# Les chemins à risque génériques (SKILL.md, tableau des tailles) ; la ligne `À risque` de
# l'AGENTS.md du projet s'y ajoute à la main. Une seule ligne : un test la lit.
RISQUE='(^|/)(migrations?|policies|secrets?)/|(^|/)auth[./]|(^|/)skills/.*\.md$|(^|/)skills/[^/]+/hooks/|\.sql$|(^|/)\.env|(^|/)\.github/workflows/|(^|/)(AGENTS|CLAUDE|SKILL)\.md$|(^|/)\.?claude/|(^|/)\.?codex/|(^|/)agents/[^/]+\.md$|\.rules$|(^|/)\.githooks/|(^|/)settings[^/]*\.json$'

die() { echo "❌ $*" >&2; exit 1; }

[ $# -ge 1 ] || die "usage : prepare.sh <dossier-de-travail> [base] [-- chemins du lot…]"
mkdir -p "$1"
work=$(cd "$1" && pwd)
shift
base=''
if [ $# -gt 0 ] && [ "$1" != "--" ]; then base=$1; shift; fi
[ "${1:-}" = "--" ] && shift
filtre=$#      # 0 : tout l'arbre
# Les chemins du lot sont relatifs au dossier courant : on les ramène à la racine, où tout se lit.
prefixe=$(git rev-parse --show-prefix)
chemins=()
for c in "$@"; do case $c in /*) chemins+=("$c") ;; *) chemins+=("$prefixe$c") ;; esac; done

# Depuis la racine : `ls-files --others` ne liste sinon que le sous-dossier courant.
cd "$(git rev-parse --show-toplevel)"
base=${base:-$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)}
git fetch -q origin 2>/dev/null || echo "⚠️ fetch impossible : base lue telle qu'en local" >&2
# `develop` local peut être en retard : sa version distante, si elle existe, fait foi.
case $base in origin/*) ;; *) git rev-parse -q --verify "origin/$base" >/dev/null && base=origin/$base ;; esac
git rev-parse -q --verify "$base" >/dev/null || die "base introuvable : $base (la donner en 2e argument)"
mb=$(git merge-base "$base" HEAD) || die "aucun ancêtre commun avec $base (clone superficiel ?)"
retard=$(git rev-list --count "HEAD..$base")

# Le périmètre : les commits de la branche et le travail en cours, plus les non suivis.
# `git status` seul ne voit pas les commits : une branche toute commitée n'est pas un lot vide.
# `core.quotePath=false` et `-z` : un nom accentué reste un nom, pas une chaîne échappée.
g() { git -c core.quotePath=false "$@"; }
{ g diff --name-only "$mb" -- ${chemins[@]+"${chemins[@]}"}; g ls-files --others --exclude-standard -- ${chemins[@]+"${chemins[@]}"}; } \
  | sort -u > "$work/perimetre.txt"

g diff "$mb" -- ${chemins[@]+"${chemins[@]}"} > "$work/verif.diff"
while IFS= read -r -d '' f; do
  [ -f "$f" ] || { echo "⚠️ non suivi illisible : $f" >&2; continue; }
  g diff --no-index -- /dev/null "$f" >> "$work/verif.diff" || [ $? -eq 1 ]  # 1 = différences
done < <(git ls-files -z --others --exclude-standard -- ${chemins[@]+"${chemins[@]}"})

# Les messages de commit : un témoignage que la relecture confronte au code.
git log --format='%h %s%n%b' "$mb..HEAD" > "$work/commits.txt"

grep -E "$RISQUE" "$work/perimetre.txt" > "$work/risque.txt" || true

n=$(grep -c . "$work/perimetre.txt" || true)
echo "base       $base ($(git rev-parse --short "$mb"))"
echo "retard     $retard commit(s)$([ "$retard" -gt 0 ] && echo ' → merger la base avant de prouver')"
echo "périmètre  $n fichier(s), $(wc -l < "$work/verif.diff") lignes de diff$([ "$filtre" -gt 0 ] && echo ' (filtré)')"
echo "commits    $(git rev-list --count "$mb..HEAD")"
echo "à risque   $(grep -c . "$work/risque.txt" || true) fichier(s), plus la ligne À risque du projet"
if [ "$n" -eq 0 ]; then echo "⚠️ lot vide : rien à vérifier"; fi
echo "fichiers   $work/{perimetre.txt,verif.diff,commits.txt,risque.txt}"
