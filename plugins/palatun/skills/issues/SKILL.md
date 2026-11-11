---
name: issues
description: "Use when creating, splitting, grouping, updating or closing GitHub issues — « crée une issue », « découpe en tickets », « fais une epic », « il y a trop d'issues », a project of several PRs, sub-issues, labels, `Closes #N`. Not for Jira tickets."
---

# issues — les issues GitHub d'un projet

Une issue dit ce qu'une PR doit livrer et quand c'est fini. Moins il y en a, mieux on les suit.

## Créer

- **Sur accord de l'utilisateur** (le oui d'un plan suffit) ; la tenir à jour et la fermer : libre.
- Un fix fait tout de suite : pas d'issue, la PR suffit.
- **Une issue = une PR.** La PR porte `Closes #N` dans sa description : l'issue se ferme au merge
  sur la branche par défaut. Un lot (le même geste sur plusieurs unités) : son issue liste les
  unités, une PR ferme les siennes.
- Titre en clair. Corps : le besoin, ce qu'il faut, puis **« Fini quand »**, des critères qu'on
  vérifie (une commande, un écran, un test), pas une intention.
- **Un seul label** : `bug` (ça casse), `enhancement` (feature, amélioration), `task` (un geste
  humain sans code, fermé à la main), `epic`. Pas de jalon.

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

## Fermer, abandonner, regrouper

- Au merge, par `Closes`. L'epic se ferme avec sa dernière sous-issue, sauf une epic née d'un
  audit : elle se ferme quand les mêmes audits, rejoués, ne sortent plus aucun constat vérifié.
- Abandon : `gh issue close <n> --reason "not planned" --comment "<une phrase>"`.
- Trop d'issues : les critères des petites passent dans la partie qui les absorbe, puis elles se
  ferment `not planned` avec « Repris dans #M ».
- Avant de dire qu'une issue est finie : relire son « Fini quand » et la preuve de chaque ligne.
