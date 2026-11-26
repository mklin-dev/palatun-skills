---
name: issues
description: "Use when creating, splitting, grouping, updating or closing GitHub issues — « crée une issue », « découpe en tickets », « fais une epic », « il y a trop d'issues », a project of several PRs, sub-issues, labels, `Closes #N`; or a multi-PR chantier the team tracks outside GitHub without a ticket, kept in a local plan like an epic. Not for Jira tickets."
---

# issues — les issues GitHub d'un projet

Une issue dit ce qu'une PR doit livrer et quand c'est fini. Moins il y en a, mieux on les suit.

## Créer

- **Sur accord de l'utilisateur** (le oui d'un plan suffit) ; la tenir à jour et la fermer :
  libre.
- Un fix fait tout de suite : pas d'issue, la PR suffit.
- **Une issue = une PR**, qui porte `Closes #N` dans sa description : l'issue se ferme au merge
  sur la branche par défaut. Une PR qui ne tient pas tout le « Fini quand » : le reste part dans
  une issue neuve avant le merge. Un lot (le même geste sur plusieurs unités) : son issue liste
  les unités, sa PR les livre toutes ; un audit qui sort plusieurs gestes en fait autant de lots.
- **Le moins de PR possible** : chacune coûte un flow entier (vérif, relecture, merge). Le design
  ne coupe que pour un autre dépôt, une publication à part (chaque version d'un paquet coûte une
  montée par dépôt), un chemin à risque à isoler du reste, ou une PR qui ne se relit plus d'une
  passe : au-delà d'environ 400 lignes prévues (hors tests, fichiers générés, déplacements,
  renommages, fichiers supprimés). Une coupe : plusieurs issues, une PR chacune, à la suite (3 ou
  plus : § Epic) ; un lot, par unités. Sauf un lot de docs seules (un tri, des renvois) : une PR,
  une doc par commit, quelle que soit sa taille.
- Titre en clair. Corps, dans cet ordre :
  - le besoin et ce qu'il faut, avec l'approche retenue et pourquoi si un choix l'a tranchée ;
  - **« Fini quand »** : des critères qu'on vérifie (une commande, un écran, un test), pas une
    intention ;
  - **les fichiers pressentis**, revérifiés dans le code au lancement ; une `task` n'en a pas ;
  - **`## Todo`**, en dernier : les étapes, ou les unités d'un lot ; une ligne = un commit, avec sa
    preuve : les tests qu'elle touche, le test vu rouge d'un bug, la commande ou l'écran ; une
    issue créée d'avance la reçoit au lancement.
  - Ni la Todo ni le « Fini quand » ne demandent la suite entière ou une suite e2e
    entière : `verif-feature` les passe une fois, en fin de branche.
- **Un seul label** : `bug` (ça casse), `enhancement` (feature, amélioration), `task` (un geste
  humain sans code, fermé à la main ou par l'automate qui l'a ouvert), `epic`. Pas de jalon.

## Tenir à jour

- **Entre le lancement et le merge, rien** : les décisions prises en route vont dans la
  description de la PR.
- **Au merge** : l'issue, `Closes` la ferme sur la branche par défaut ; sur une autre base, à la
  main si son « Fini quand » est tenu ; une sous-issue d'epic : la « Prochaine étape » de l'epic
  nomme la partie suivante, qui s'enchaîne ; la dernière : § Fermer, abandonner, regrouper ; le
  plan local : la ligne de la partie et sa « Prochaine étape », de retour au checkout principal ;
  la dernière : § Sans ticket, puce Fini.
- **Un chantier qui s'arrête avant son merge** (pause, autre sujet) : le corps de son issue, ou
  la description de sa PR sans issue, dit les décisions prises et la prochaine étape, pour
  qu'une session neuve reprenne sans le chat.
- **Le corps, pas un commentaire** : `gh issue view` sans terminal ne montre que leur nombre, et
  chacun notifie qui suit le dépôt.

## Epic

- Un chantier d'au moins 3 PR prévues au départ (moins : une issue, puis une neuve pour le
  reste ; une epic de thème : sur demande) : une issue `[EPIC] <sujet>`, label `epic`, **sans PR
  à elle**, jamais de `Closes #<epic>`. Son corps : l'objectif, le design, les décisions, puis
  « Prochaine étape : … ».
- Chaque partie : sa sous-issue et sa `## Todo`, son worktree, sa PR ; la suivante part de la
  branche par défaut, après le merge de la précédente, sans nouvel accord (celui de l'epic les
  couvre).
- Chaque partie connue est une **sous-issue native**, une PR chacune ou un lot :
  `gh api -X POST repos/<o>/<r>/issues/<epic>/sub_issues -F sub_issue_id=<id>`, où `<id>` vient de
  `gh api repos/<o>/<r>/issues/<n> --jq .id` (pas le numéro) ; un autre dépôt du même
  propriétaire est admis.
- **Deux niveaux au plus** : l'epic et ses parties. Une partie trop grosse se coupe en d'autres
  sous-issues de la même epic, jamais en sous-sous-issues : ni lots intermédiaires, ni
  micro-tickets numérotés (1.1, 1.2). Une partie = ce qu'une PR livre.

## Sans ticket : le plan local

- Un chantier de plusieurs PR que l'équipe suit hors de GitHub (Jira…) sans lui avoir ouvert de
  ticket, ou sur demande : un plan local, `docs/superpowers/plans/<chantier>.md`, au checkout
  principal, écrit hors de tout worktree (il survit à ceux des parties), ignoré par git
  (`.gitignore` de l'équipe, sinon `.git/info/exclude`) ; sans date dans le nom (daté, il passe
  vite pour un plan fini oublié).
- Tenu comme une epic, sous le même accord : en tête « Fini quand » et « Prochaine étape » ; puis
  une ligne par partie avec son état, vérifié sur sa branche et sa PR ; les décisions datées
  dessous.
- Fini : ses décisions durables passent dans la doc du projet, puis il part sur le mot
  `supprime` (git ne le suit pas).

## Fermer, abandonner, regrouper

- L'epic se ferme avec sa dernière sous-issue ; née d'un audit, quand les mêmes audits, rejoués,
  ne sortent plus aucun constat vérifié.
- Abandon : `gh issue close <n> --reason "not planned" --comment "<une phrase>"`.
- Trop d'issues : les critères des petites passent dans la partie qui les absorbe, puis elles se
  ferment `not planned` avec « Repris dans #M ».
- Avant de dire qu'une issue est finie : relire son « Fini quand » et la preuve de chaque ligne.
