---
name: issues
description: "Use when creating, splitting, grouping, updating or closing GitHub issues — « crée une issue », « découpe en tickets », « fais une epic », « il y a trop d'issues », a project of several PRs, sub-issues, labels, `Closes #N`; or a multi-PR chantier the team tracks outside GitHub without a ticket, kept in a local plan like an epic. Not for Jira tickets."
---

# issues — les issues GitHub d'un projet

Une issue dit ce qu'un chantier doit livrer et quand c'est fini. Moins il y en a, mieux on les
suit.

Un mot, un sens : une **partie** est un groupe de commits relu à son tour dans une PR ; les
unités d'une epic ou d'un plan local sont des **PR**.

## Créer

- **Sur accord de l'utilisateur** (le oui d'un plan suffit) ; la tenir à jour et la fermer :
  libre.
- Un fix fait tout de suite : pas d'issue, la PR suffit.
- **Un chantier = une issue = une PR**, qui porte `Closes #N` dans sa description : l'issue se
  ferme au merge sur la branche par défaut. Ses parties vivent dans sa `## Todo`, pas en
  sous-issues ; chacune passe `verif-feature` juste après avoir été codée. Une PR qui ne tient pas
  tout le « Fini quand » : le reste part dans une issue neuve avant le merge.
- **Un lot** : le même geste sur plusieurs unités, son issue les liste, sa PR les livre toutes ;
  un audit qui sort plusieurs gestes en fait autant de lots. Plusieurs petites issues sans lien
  peuvent aussi partager une PR, un commit chacune et un `Closes` pour chacune.
- **Une partie se relit d'une passe** : environ 400 lignes prévues au plus (hors tests, fichiers
  générés, déplacements, renommages, fichiers supprimés) ; au-delà, une partie de plus. Sauf un
  lot de docs seules (un tri, des renvois) : une doc par commit, quelle que soit sa taille.
- **Plusieurs PR seulement** pour un autre dépôt, une publication à part (chaque version d'un
  paquet coûte une montée par dépôt) ou un chemin à risque à isoler du reste : chacune coûte un
  flow entier (PR, CI, merge, rangement). Plusieurs PR : § Epic.
- Titre en clair. Corps, dans cet ordre :
  - le besoin et ce qu'il faut, avec l'approche retenue et pourquoi si un choix l'a tranchée ;
  - **« Fini quand »** : des critères qu'on vérifie (une commande, un écran, un test), pas une
    intention ;
  - **les fichiers pressentis**, revérifiés dans le code au lancement ; une `task` n'en a pas ;
  - **`## Todo`**, en dernier : les étapes, ou les unités d'un lot ; plusieurs parties : un titre
    gras par partie (`**Partie A — …**`), avec son « fini quand » ; une ligne = un commit, avec
    sa preuve : les tests qu'elle touche, le test vu rouge d'un bug, la commande ou l'écran ; une
    issue créée d'avance la reçoit au lancement.
  - Ni la Todo ni le « Fini quand » ne demandent la suite entière ou une suite e2e
    entière : `verif-feature` les passe, à chaque partie.
- **Un seul label** : `bug` (ça casse), `enhancement` (feature, amélioration), `task` (un geste
  humain sans code, fermé à la main ou par l'automate qui l'a ouvert), `epic`. Pas de jalon.

## Tenir à jour

- **Entre le lancement et le merge, rien** : les décisions prises en route vont dans la
  description de la PR ; l'avancement des parties se lit dans `git log`.
- **Au merge** : l'issue, `Closes` la ferme sur la branche par défaut ; sur une autre base, à la
  main si son « Fini quand » est tenu ; une sous-issue d'epic : la « Prochaine étape » de l'epic
  nomme la PR suivante, qui s'enchaîne ; la dernière : § Fermer, abandonner, regrouper ; le
  plan local : la ligne de la PR et sa « Prochaine étape », de retour au checkout principal ;
  la dernière : § Sans ticket, puce Fini.
- **Un chantier qui s'arrête avant son merge** (pause, autre sujet) : le corps de son issue, ou
  la description de sa PR sans issue, dit les décisions prises et la prochaine étape, pour
  qu'une session neuve reprenne sans le chat.
- **Le corps, pas un commentaire** : `gh issue view` sans terminal ne montre que leur nombre, et
  chacun notifie qui suit le dépôt.

## Epic

- Un chantier qui demande plusieurs PR (§ Créer, dernière puce ; une epic de thème : sur
  demande) : une issue `[EPIC] <sujet>`, label `epic`, **sans PR à elle**, jamais de
  `Closes #<epic>`. Son corps : l'objectif, le design, les décisions, puis « Prochaine étape : … ».
- Chaque PR : sa sous-issue et sa `## Todo`, ses parties comprises ; la suivante part de la
  branche par défaut, après le merge de la précédente, sans nouvel accord (celui de l'epic les
  couvre).
- Chaque PR connue est une **sous-issue native** :
  `gh api -X POST repos/<o>/<r>/issues/<epic>/sub_issues -F sub_issue_id=<id>`, où `<id>` vient de
  `gh api repos/<o>/<r>/issues/<n> --jq .id` (pas le numéro) ; un autre dépôt du même
  propriétaire est admis.
- **Deux niveaux au plus** : l'epic et ses sous-issues, une par PR ; jamais de sous-sous-issues,
  ni de micro-tickets numérotés (1.1, 1.2) : une PR trop grosse prend des parties de plus.

## Sans ticket : le plan local

- Un chantier de plusieurs PR que l'équipe suit hors de GitHub (Jira…) sans lui avoir ouvert de
  ticket, ou sur demande : un plan local, `docs/superpowers/plans/<chantier>.md`, au checkout
  principal, écrit hors de tout worktree (il survit à ceux de ses PR), ignoré par git
  (`.gitignore` de l'équipe, sinon `.git/info/exclude`) ; sans date dans le nom (daté, il passe
  vite pour un plan fini oublié).
- Tenu comme une epic, sous le même accord : en tête « Fini quand » et « Prochaine étape » ; puis
  une ligne par PR avec son état, vérifié sur sa branche et sur GitHub ; les décisions datées
  dessous.
- Fini : ses décisions durables passent dans la doc du projet, puis il part sur le mot
  `supprime` (git ne le suit pas).

## Fermer, abandonner, regrouper

- L'epic se ferme avec sa dernière sous-issue ; née d'un audit, quand les mêmes audits, rejoués,
  ne sortent plus aucun constat vérifié.
- Abandon : `gh issue close <n> --reason "not planned" --comment "<une phrase>"`.
- Trop d'issues : les critères des petites passent dans l'issue qui les absorbe, puis elles se
  ferment `not planned` avec « Repris dans #M ».
- Avant de dire qu'une issue est finie : relire son « Fini quand » et la preuve de chaque ligne.
