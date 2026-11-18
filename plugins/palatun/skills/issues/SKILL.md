---
name: issues
description: "Use when creating, splitting, grouping, updating or closing GitHub issues — « crée une issue », « découpe en tickets », « fais une epic », « il y a trop d'issues », a project of several PRs, sub-issues, labels, `Closes #N`; or a multi-PR chantier the team tracks outside GitHub without a ticket, kept in a local plan like an epic. Not for Jira tickets."
---

# issues — les issues GitHub d'un projet

Une issue dit ce qu'une PR doit livrer et quand c'est fini. Moins il y en a, mieux on les suit.

## Créer

- **Sur accord de l'utilisateur** (le oui d'un plan suffit) ; la tenir à jour et la fermer : libre.
- **À jour**, pour qu'une session neuve reprenne sans le chat : à chaque point d'étape d'un
  chantier pas fini, son corps dit les décisions prises en route et la prochaine étape ; l'epic, sa
  « Prochaine étape » au lancement de chaque sous-issue. Le corps, pas un commentaire :
  `gh issue view` sans terminal n'en montre que le nombre, et chacun notifie qui suit le dépôt.
  Sans issue (une retouche) : la description de sa PR.
- Un fix fait tout de suite : pas d'issue, la PR suffit.
- **Une issue = une PR.** La PR porte `Closes #N` dans sa description : l'issue se ferme au merge
  sur la branche par défaut. Une PR qui ne tient pas tout le « Fini quand » : le reste part dans
  une issue neuve avant le merge. Un lot (le même geste sur plusieurs unités) : son issue liste
  les unités, sa PR les livre toutes.
- Titre en clair. Corps, dans cet ordre :
  - le besoin et ce qu'il faut, avec l'approche retenue et pourquoi si un choix l'a tranchée ;
  - **« Fini quand »** : des critères qu'on vérifie (une commande, un écran, un test), pas une
    intention ;
  - **les fichiers pressentis**, revérifiés dans le code au lancement ; une `task` n'en a pas ;
  - **`## Todo`**, en dernier : les étapes, ou les unités d'un lot ; une issue créée d'avance le
    reçoit au lancement.
- **Un seul label** : `bug` (ça casse), `enhancement` (feature, amélioration), `task` (un geste
  humain sans code, fermé à la main ou par l'automate qui l'a ouvert), `epic`. Pas de jalon.

## Epic

- Un chantier de plusieurs PR : une issue `[EPIC] <sujet>`, label `epic`, **sans PR à elle**,
  jamais de `Closes #<epic>`. Son corps : l'objectif, les décisions, puis
  « Prochaine étape : … ».
- Chaque partie connue est une **sous-issue native**, une PR chacune ou un lot :
  `gh api -X POST repos/<o>/<r>/issues/<epic>/sub_issues -F sub_issue_id=<id>`, où `<id>` vient de
  `gh api repos/<o>/<r>/issues/<n> --jq .id` (pas le numéro). Une issue d'un autre dépôt du même
  propriétaire peut être sous-issue.
- **Deux niveaux au plus** : l'epic et ses parties. Une partie trop grosse se coupe en d'autres
  sous-issues de la même epic, jamais en sous-sous-issues : ni lots intermédiaires, ni
  micro-tickets numérotés (1.1, 1.2). Une partie = ce qu'une PR livre.

## Sans ticket : le plan local

- Un chantier de plusieurs PR que l'équipe suit hors de GitHub (Jira…) sans lui avoir ouvert de
  ticket, ou sur demande : pas d'issue, un plan local, `docs/superpowers/plans/<chantier>.md`,
  ignoré par git (`.gitignore` de l'équipe, sinon `.git/info/exclude`) ; sans date dans le nom : un
  plan daté de plus d'une semaine passe pour un plan fini oublié.
- Tenu comme une epic, sous le même accord : en tête « Fini quand » et « Prochaine étape » ; puis
  une ligne par partie (ce qu'une PR livre) avec son état, vérifié sur sa PR, sa branche et sa PR ;
  les décisions datées dessous. À jour comme une epic (§ Créer, puce « À jour »).
- Fini : ses décisions durables passent dans la doc du projet, puis il part, avec son registre
  `.superpowers/sdd/<chantier>/` s'il en a un, sur le mot `supprime` (git ne les suit pas).

## Fermer, abandonner, regrouper

- Au merge, par `Closes`. L'epic se ferme avec sa dernière sous-issue, sauf une epic née d'un
  audit : elle se ferme quand les mêmes audits, rejoués, ne sortent plus aucun constat vérifié.
- Abandon : `gh issue close <n> --reason "not planned" --comment "<une phrase>"`.
- Trop d'issues : les critères des petites passent dans la partie qui les absorbe, puis elles se
  ferment `not planned` avec « Repris dans #M ».
- Avant de dire qu'une issue est finie : relire son « Fini quand » et la preuve de chaque ligne.
