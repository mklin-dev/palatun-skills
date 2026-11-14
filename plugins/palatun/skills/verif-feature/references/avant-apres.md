# Avant/après d'une interface

Toute PR qui change le rendu d'un écran, design ou pas ; « montre l'avant/après » seul : cette
page, sans le reste du skill.
Pourquoi : un rendu se relit en image, et une paire alignée montre l'écart qu'une description
cache.

1. L'écran visible en 390×844 et 1440×900, à l'échelle 1 (ni `--hires` ni `--device`), jamais
   `--full-page` : `playwright-cli screenshot --filename=<dossier de travail>/avant-<écran>-<largeur>.png`
   (`apres-…` de l'autre côté). Mêmes états des deux côtés (variante, connecté ou non, étape d'un
   parcours), et `scrollIntoView()` sur l'élément changé avant chaque capture.
2. « Avant » : la version en ligne de la base pour une page publique ; derrière une connexion ou
   sans version en ligne, demander. Un écart venu d'une autre PR pas encore en ligne se dit dans
   la légende. Écran neuf : les « après » seuls, sans planche.
3. Ce qui change se mesure sur l'« après », au même défilement que sa capture :
   `playwright-cli --raw eval "(() => { const r = document.querySelector('<sélecteur>').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(' '); })()"`.
4. `scripts/planche.sh`, dans le dossier du skill (usage en tête du script) : un cadre numéroté
   par rectangle mesuré, puis une planche avant | après par largeur ; un écran inchangé le dit
   dans la légende.
5. Relire la planche. Sa propre PR la porte (`gh pr create … --attach`, ou `gh pr comment <n>
   --attach` si elle est ouverte) ; en lecture seule : le chemin local au bilan.
