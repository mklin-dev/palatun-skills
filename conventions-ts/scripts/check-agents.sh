#!/bin/sh
# La doc des agents d'un projet (setup.md § La doc du projet), joué par `pnpm verif` et la CI :
#   sh .agents/skills/conventions-ts/scripts/check-agents.sh
# Copié avec le skill, jamais retouché dans un dépôt ; un contrôle propre au projet vit dans son
# script à lui, qui appelle celui-ci.
set -eu
cd "$(git rev-parse --show-toplevel)"
fail=0
err() { echo "❌ $1"; fail=1; }

# Les fichiers du dépôt, suivis ou non, sans les ignorés (node_modules, worktrees) ; un chemin
# accentué en clair, découpé aux seuls sauts de ligne, jamais développé en motif.
fichiers=$(git -c core.quotePath=false ls-files --cached --others --exclude-standard)
agents=$(printf '%s\n' "$fichiers" | grep -E '(^|/)AGENTS\.md$' || true)
# Un CLAUDE.md ignoré par git échappe à la liste, mais Claude Code le lit : les ignorés aussi.
claudes=$({ printf '%s\n' "$fichiers"; git -c core.quotePath=false ls-files -oi --exclude-standard --directory; } |
  grep -E '(^|/)CLAUDE\.md$' || true)
IFS='
'
set -f

[ -f AGENTS.md ] || err "AGENTS.md manquant à la racine"

for f in $agents; do
  [ -f "$f" ] || continue
  # 200 lignes au plus : au-delà, l'agent suit moins bien.
  n=$(awk 'END { print NR }' "$f")
  [ "$n" -le 200 ] || err "$f : $n lignes (plafond 200)"
  # Codex ne connaît pas l'import @chemin.md : un chemin se cite entre backticks.
  if grep -qE '(^|[[:space:]])@(~|\.|/|[A-Za-z])[^[:space:]`]*\.md' "$f"; then
    err "$f : import @chemin.md (citer le chemin entre backticks)"
  fi
  # Codex lit la chaîne, de la racine au dossier, et coupe sans prévenir au-delà de 32 KiB.
  total=0
  d=$(dirname "$f")
  while :; do
    [ -f "$d/AGENTS.md" ] && total=$((total + $(wc -c < "$d/AGENTS.md")))
    [ "$d" != . ] || break
    d=$(dirname "$d")
  done
  [ "$total" -le 32768 ] || err "$f : chaîne d'AGENTS.md à $total o (plafond Codex 32768)"
done
# Un CLAUDE.md masque l'AGENTS.md pour Claude Code : AGENTS.md seul, partout.
for c in $claudes; do
  err "$c : interdit, AGENTS.md seul"
done
set +f

# Chaque skill du projet a son lien Claude ; conventions-ts, sa règle injectée à la place.
for d in .agents/skills/*/; do
  [ -d "$d" ] || continue
  n=$(basename "$d")
  [ -f "$d/SKILL.md" ] || err "$d sans SKILL.md"
  if [ "$n" = conventions-ts ]; then
    { [ -L .claude/rules/conventions-ts.md ] && [ -f .claude/rules/conventions-ts.md ]; } ||
      err ".claude/rules/conventions-ts.md : lien vers ../../.agents/skills/conventions-ts/SKILL.md attendu"
    { [ ! -e .claude/skills/conventions-ts ] && [ ! -L .claude/skills/conventions-ts ]; } ||
      err ".claude/skills/conventions-ts à retirer : sa règle l'injecte déjà"
    continue
  fi
  { [ -L ".claude/skills/$n" ] && [ -f ".claude/skills/$n/SKILL.md" ]; } ||
    err ".claude/skills/$n : lien vers ../../.agents/skills/$n attendu"
done
for d in .claude/skills/*/; do
  [ -d "$d" ] || continue
  d=${d%/}
  [ -L "$d" ] || err "$d est une copie : la déplacer dans .agents/skills/ et la lier"
done

[ "$fail" -eq 0 ] && echo "✅ doc des agents conforme"
exit "$fail"
