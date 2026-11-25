#!/bin/sh
# La doc des agents d'un projet (setup.md § La doc du projet), joué par `pnpm verif` et la CI :
#   sh .agents/skills/conventions-ts/scripts/check-agents.sh
# Publié avec le skill (le paquet), jamais retouché dans un dépôt ; un contrôle propre au projet
# vit dans son script à lui, qui appelle celui-ci.
set -eu
# Le paquet, là où ce script vit : ses fichiers disent quelles sections existent.
paquet=$(cd "$(dirname "$0")/.." && pwd)
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

# Un renvoi vers le paquet (`conventions-ts, api.md § Verrous`) nomme une section qui existe : le
# paquet bouge, le dépôt qui le cite l'apprend ici. Lu dans tout fichier texte, sur chaque ligne
# qui dit `conventions-ts` : un fichier du paquet, nu, sous `references/` ou sous
# `conventions-ts/`, puis ` § ` et le titre, entier, abrégé ou coupé par la fin de la ligne.
# `docs/api.md § …` reste au projet ; la forme inversée (« § Auth de `api.md` ») n'est pas lue.
# Une migration appliquée ne se retouche pas : un dossier `migrations/` n'est pas lu.
# `grep -I` (GNU, BSD) saute les binaires ; sans lui, le dire plutôt que de ne rien lire.
printf 'x\n' | grep -qI x 2>/dev/null || err "grep sans l'option -I : renvois vers conventions-ts non lus"
cites=$(printf '%s\n' "$fichiers" | grep -vE '(^|/)(conventions-ts(/|\.md$)|migrations/)' |
  tr '\n' '\0' |
  xargs -0 grep -lI 'conventions-ts' 2>/dev/null || true)
if [ -n "$cites" ]; then
  # Dans une variable : un awk qui échoue arrête le script (set -e), jamais un vert à tort.
  # shellcheck disable=SC2086 # un chemin par ligne : IFS le découpe, set -f l'empêche de se développer
  casses=$(awk -v paquet="$paquet" '
    function existe(f,   l, r) { r = (getline l < f) >= 0; close(f); return r }
    # L apostrophe typographique vaut la droite.
    function droit(t) { gsub(/’/, "\047", t); return t }
    # Les titres, et les débuts de puce en gras, qui servent aussi d ancre ; un bloc de code
    # (un gabarit) n en porte pas.
    function charge(f,   l, code) {
      if (f in lus) return
      lus[f] = 1
      while ((getline l < f) > 0) {
        if (l ~ /^```/) { code = !code; continue }
        if (code) continue
        if (l ~ /^#+ /) sub(/^#+ +/, "", l)
        else if (l ~ /^(- |[0-9]+\. )?\*\*[^*]+\*\*/) { sub(/^(- |[0-9]+\. )?\*\*/, "", l); sub(/\*\*.*$/, "", l) }
        else continue
        titres[f, ++n[f]] = droit(l)
      }
      close(f)
    }
    /conventions-ts/ {
      reste = droit($0)
      while (match(reste, /(conventions-ts\/)?(references\/)?[A-Za-z][A-Za-z-]*\.md`? § /)) {
        jeton = substr(reste, RSTART, RLENGTH)
        # Le paquet nommé juste avant (`conventions-ts, references/x.md`) : le fichier est le sien.
        proche = substr(reste, 1, RSTART - 1) ~ /conventions-ts`?[,:]? ?\(?`?$/
        avant = RSTART > 1 ? substr(reste, RSTART - 1, 1) : ""
        reste = substr(reste, RSTART + RLENGTH)
        lie = sub(/^conventions-ts\//, "", jeton)
        if (!lie && avant ~ /[A-Za-z0-9_.\/-]/) continue
        sub(/`? § $/, "", jeton)
        f = paquet "/" jeton
        if (!existe(f) && jeton !~ /\//) f = paquet "/references/" jeton
        if (!existe(f)) {
          # Nu, le fichier peut être au projet (`AGENTS.md § Git`), et un `references/` à un autre
          # skill : seul un chemin du paquet parle.
          if (lie || (proche && jeton ~ /^references\//)) print FILENAME ":" FNR " : " jeton ", absent du paquet conventions-ts"
          continue
        }
        charge(f)
        court = reste
        sub(/[);,.].*$/, "", court); sub(/ :.*$/, "", court); sub(/ +$/, "", court)
        ok = 0
        for (i = 1; i <= n[f]; i++) {
          t = titres[f, i]
          if (index(reste, t) == 1 || (court != "" && index(t, court) == 1)) { ok = 1; break }
        }
        if (!ok) print FILENAME ":" FNR " : " jeton " § " court ", section absente du paquet conventions-ts"
      }
    }' $cites)
  for e in $casses; do
    err "$e"
  done
fi
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
