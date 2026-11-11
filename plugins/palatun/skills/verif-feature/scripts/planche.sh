#!/bin/sh
# planche.sh — l'avant/après d'une interface (verif-feature, `references/avant-apres.md`), avec ImageMagick.
#
#   planche.sh cadre <entrée.png> <sortie.png> <n> <x> <y> <largeur> <hauteur>
#       un cadre fin numéroté autour du rectangle mesuré (getBoundingClientRect de l'« après »)
#   planche.sh monte <sortie.png> <légende> <avant1.png> <après1.png> [<avant2.png> <après2.png> …]
#       une largeur par appel : les paires côte à côte, avant à gauche, une ligne par écran, la
#       légende dessous (une ligne par numéro, séparées par « \n ») ; chaque image porte son nom
set -eu

die() { echo "planche.sh : $*" >&2; exit 2; }
# ImageMagick 7 (`magick`), sinon 6 (`convert`, `montage`).
if command -v magick >/dev/null 2>&1; then IM=magick MONTAGE='magick montage'
elif command -v convert >/dev/null 2>&1 && command -v montage >/dev/null 2>&1; then IM=convert MONTAGE=montage
else die "ImageMagick introuvable (magick, ou convert et montage)"
fi
COULEUR='#e11d48'

case "${1:-}" in
cadre)
  [ $# -eq 8 ] || die "cadre <entrée.png> <sortie.png> <n> <x> <y> <largeur> <hauteur>"
  entree=$2 sortie=$3 n=$4 x=$5 y=$6 w=$7 h=$8
  [ "$w" -gt 0 ] && [ "$h" -gt 0 ] || die "cadre : rectangle vide (${w}×${h}), élément masqué à cette largeur ?"
  taille=$($IM "$entree" -format '%w %h' info:)
  iw=${taille% *} ih=${taille#* }
  [ "$x" -lt "$iw" ] && [ "$y" -lt "$ih" ] && [ $((x + w)) -gt 0 ] && [ $((y + h)) -gt 0 ] \
    || die "cadre : rectangle hors de l'image (${iw}×${ih}) : capture et mesure au même défilement ?"
  x0=$((x - 6)); y0=$((y - 6)); x1=$((x + w + 6)); y1=$((y + h + 6))
  [ "$x0" -lt 1 ] && x0=1
  [ "$y0" -lt 1 ] && y0=1
  [ "$x1" -gt $((iw - 2)) ] && x1=$((iw - 2))
  [ "$y1" -gt $((ih - 2)) ] && y1=$((ih - 2))
  # Le numéro au-dessus du cadre ; sans la place, dessous ; sans la place non plus, dedans.
  ly=$((y0 - 6))
  if [ "$ly" -lt 20 ]; then ly=$((y1 + 22)); [ "$ly" -gt "$ih" ] && ly=$((y0 + 24)); fi
  $IM "$entree" -fill none -stroke "$COULEUR" -strokewidth 2 \
    -draw "rectangle $x0,$y0 $x1,$y1" \
    -stroke none -fill "$COULEUR" -pointsize 20 -annotate "+$((x0 + 4))+$ly" "$n" "$sortie"
  ;;
monte)
  [ $# -ge 5 ] || die "monte <sortie.png> <légende> <avant.png> <après.png> [<avant.png> <après.png> …]"
  [ $((($# - 3) % 2)) -eq 0 ] || die "monte : les images vont par paires, avant puis après"
  sortie=$2 legende=$3
  shift 3
  # Une paire = un « avant » puis un « après » (noms de verif-feature, `references/avant-apres.md`).
  i=0
  for f in "$@"; do
    nom=$(basename "$f")
    if [ $((i % 2)) -eq 0 ]; then
      case $nom in *avant*) ;; *) die "monte : $nom en position « avant »" ;; esac
    else
      case $nom in *apres*|*après*) ;; *) die "monte : $nom en position « après »" ;; esac
    fi
    i=$((i + 1))
  done
  tmp=$(mktemp "${TMPDIR:-/tmp}/planche.XXXXXX")
  trap 'rm -f "$tmp"' EXIT
  $MONTAGE -label '%t' -pointsize 18 "$@" -tile 2x -geometry +24+16 "png:$tmp"
  $IM "png:$tmp" -background white -fill '#222' -pointsize 22 \
    label:"$(printf '%b' "$legende")" -gravity west -append "$sortie"
  ;;
*)
  die "planche.sh cadre … | planche.sh monte … (usage en tête du fichier)"
  ;;
esac
