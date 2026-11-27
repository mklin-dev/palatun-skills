---
name: verif-feature
description: Use when a feature, fix, branch or part of a chantier is finished, before a push, PR or merge, or when asked to check the work — « vérifie la feature », « code review », « audit avant merge », « audit complet », « tout est bon et clean », « pas de superflu », « passe qualité », « montre l'avant/après ». Not for a spec or plan before code, nor a project audit.
---

# verif-feature — vérifier avant PR ou merge

Prouver au lieu d'affirmer, à la taille du travail :
`① préparer → ② simplifier → ③ prouver ∥ ④ relire → ⑤ corriger → bilan` (∥ : en même temps).

Une passe par **partie** d'un chantier (skill `issues`), juste après l'avoir codée et commitée ;
son diff : ce qui n'est pas encore poussé (① point 3). En début de partie, avant d'en coder une
ligne : `git fetch`, puis le retard sur la base de la PR
(`git rev-list --count HEAD..origin/<base>`) ; non nul, la merger, et pousser ce merge seul si la
branche l'est déjà (mergée au milieu, le code des autres entrerait dans le diff relu) ; conflit :
arrêt, le dire (sa résolution, poussée seule, échapperait à la relecture). Une partie ne se
pousse qu'une fois relue (⑤ fait), sauvegarde comprise, sauf la dernière, ou la seule : sa PR
peut partir pendant ④. Puis § La fin du chantier.

| Taille | ④ relire | ④ contre-vérifier |
| --- | --- | --- |
| Retouche (le diff se dit en une phrase), ou sans logique nouvelle (déplacé, renommé, doc, config) | dans la session ; sans logique nouvelle : signatures, props et imports neufs | ❌ |
| Le reste, ou **chemin à risque quelle que soit la taille** | par un relecteur neuf, en fond | ✅ ce qu'aucune commande ne reproduit |

Un chemin à risque : auth, droits (RLS) ou SQL, secrets, schéma ou migration de données,
interface publique (API, paquet ou plugin publiés), la CI, la ligne `À risque` du projet, les
garde-fous de l'agent (settings, hooks, règles Codex, définitions d'agents, `.mcp.json`,
manifeste de plugin ; dans un `AGENTS.md`, `CLAUDE.md` ou `SKILL.md`, une règle qui autorise,
interdit ou supprime : mot exact, permission, suppression). `risque.txt` (①) n'en voit pas tous
les chemins. Toute autre règle, et la prose d'un skill (`SKILL.md`, `references/`) : relues dans
la session, quelle que soit la taille ; ses scripts suivent le tableau. Une règle à risque
seulement déplacée ou reformulée, sans changer ce qu'elle permet : relue dans la session aussi,
chacune retrouvée à sa nouvelle place (`grep` avant et après), si elle reste dans un fichier
chargé au moins aussi souvent ; sortie d'un fichier toujours chargé (vers une doc, une
`references/`), elle cesse de s'appliquer : relecteur neuf. Elle reste un chemin à risque pour
l'arrêt de la suite de `merge` et le rayon d'impact.

**Lecture seule** (la branche d'un autre, ou une demande seule de vérifier : « vérifie », « code
review », « audit ») : tout le passage, rien d'écrit d'office. La base se merge sur une tête
détachée (`git switch --detach`), jamais sur la branche vérifiée, puis `git switch -` ; fixes,
simplifications, mise à jour de la branche et description de sa PR : au bilan, en propositions.
Avant un push sur la branche d'un autre, `git fetch` : sa pointe a bougé depuis la vérif →
arrêt, le dire.

## ① Préparer

1. **L'`AGENTS.md` du projet prime** (ou celui d'un dossier parent) : ses commandes (§ Commandes) ;
   dans sa § Flow, deux lignes optionnelles : `À risque` (chemins sensibles en plus) et `En plus`
   (une étape propre, une grille par exemple, et l'étape qui la lance).
2. **Ce qui a commandé le diff**, copié en `spec.md` au dossier de travail (les agents ne lisent
   pas le chat) : design, spec, plan (sa « Review Focus », les `Ruling:` de son registre), ticket,
   ou symptôme d'un bug ; une PR : les issues qu'elle ferme
   (`gh pr view --json closingIssuesReferences`, puis `gh issue view`), ou sa spec
   `docs/superpowers/specs/<chantier>.md`. Inconnu : le demander en une ligne.
3. **`scripts/prepare.sh <dossier> [base] [-- chemins du lot]`** : le dossier hors du dépôt (le
   scratchpad sous Claude, `mktemp -d` ailleurs) ; `[base]` : `origin/<branche>` quand la
   partie précédente de ce chantier a été relue puis poussée ; sinon (première partie, lecture
   seule, branche d'un autre), la base de la PR si elle ne vise pas la branche par défaut
   (`develop`) ; après `--`, les chemins du lot quand une autre session
   a un changement dans l'arbre (il reste hors revue et intact). Retard non nul : merger la base
   (ou rebaser, si la § Git du projet le dit) avant ③ ; conflit : arrêt, le dire. Lot vide :
   s'arrêter.

## ② Simplifier

Dans la session, sur les lignes du lot, contre l'axe 3 de `references/relecture.md` : appliqué,
sauf les odeurs de code (proposées) ; en lecture seule ou hors du lot : proposé. `/simplify`
seulement à la demande : il lance 4 agents et applique toujours ses retouches.

## ③ Prouver — toujours

D'abord relancer `prepare.sh` (② et la base ont changé le diff) ; l'arbre ne bouge plus jusqu'au
retour du vérificateur (④). Le relecteur neuf (④) part en fond, avant les commandes ; le fix d'une
commande rouge attend la fin de ④, vérificateur compris, et passe en ⑤.

1. **Les tests touchés d'abord** : `scripts/garde.sh <base>` signale un fichier de test supprimé,
   un test sauté ajouté, un lint ou un type tus (`noqa`, `eslint-disable`, `@ts-ignore`…) ; la
   session ne juge que ses signalements, et dans `verif.diff` les attendus modifiés ou retirés
   (assertion, cas). ❌ si une régression est masquée ou si un comportement requis perd sa
   couverture ; une suppression redondante ou un attendu conforme à la demande n'est pas un défaut.
2. **Les commandes**, sortie dans `verif.out` : celles de la CI du projet (lint, types, tests,
   build ; jamais un déploiement) et de son `AGENTS.md`, par sa commande `verif` s'il en a une
   (`./verif.sh`, `pnpm verif`), jamais recopiées dans un script de la session ; sinon, en
   TypeScript, `conventions-ts` § Definition of Done ; aucune : le dire au bilan. Un workflow
   touché : actionlint puis zizmor. Un lot de docs seules (que des `.md`, aucun lu comme réglage :
   définition d'agent, output style, commande) : les commandes de docs de l'`AGENTS.md`, sinon les
   entières.
3. **Le vrai comportement** : UI → un navigateur piloté (`playwright-cli`), preuve par les données
   (texte de la page, réseau, contenu envoyé), attendus écrits rejoués, rendu changé en avant/après
   (`references/avant-apres.md`), motion relu (web : `review-animations` ; Expo : ses tokens de
   motion), liste « à tester » pour l'humain (geste → attendu). CLI ou API → commande et sortie,
   en local ou en test. RLS ou SQL → pgTAP s'il existe, sinon la requête sous le rôle permis et le
   rôle refusé, en local ou dans `begin … rollback`, jamais sur la prod. Une écriture distante ou
   une donnée réelle chez un tiers exige l'autorisation de cette action ; sans elle, la preuve
   manquante va au bilan.
4. **Un bug** : son test rouge avant le fix, vert après. Pas vu rouge dans la session : la base
   extraite dans un dossier neuf hors du dépôt (`git archive <base> | tar -x -C <neuf>`), le test
   de la branche recopié, il échoue sur l'assertion du bug.

## ④ Relire

Les règles, pour la session comme pour le relecteur : `AGENTS.md`, conventions, `DESIGN.md` de
l'interface touchée, règles globales.

**Dans la session** (retouche, sans logique nouvelle) : `references/relecture.md`, sur les lignes
du lot ; seul un constat que la session confirme en relisant le code passe en ⑤.

**Relecteur neuf** (hors retouche, chemin à risque) : l'agent `adversarial-reviewer` s'il existe,
sinon un sous-agent neuf au modèle `opus`, à qui le brief interdit d'écrire. Il reçoit les chemins
absolus de `references/relecture.md`, du dossier de travail (`verif.diff`, `commits.txt`,
`spec.md`, et `verif.out`, rempli pendant sa relecture) et des règles, plus la grille d'une étape
`En plus` qui relit (son effet : `references/relecture.md`, en tête) ; jamais un agent de plus,
et la contre-vérification reste la même. Pas le `/code-review` intégré (ni spec ni messages de
commit, constats vérifiés seulement en `max`) ; à la demande, un second avis sur les bugs.

**Au retour du relecteur**, une commande qu'il dit absente de `verif.out` tourne avant ⑤. Puis
chaque constat bloquant ou important (pas les `Nit:`) se prouve :
- **par une commande** qui le reproduit (un lint, le CLI sur l'entrée du scénario, un script
  d'essai) ; jamais une recherche de présence ou d'absence (`grep`), aveugle à un fait dit
  autrement ou rangé ailleurs. Elle vise l'arbre relu par son chemin (un outil du `PATH` peut
  lancer un autre checkout), son essai dans le dossier de travail ; sa sortie le montre : il est
  `CONFIRMED`, et elle va dans `bilan.md`. Non reproduit n'est pas réfuté : au vérificateur ;
- **par un vérificateur**, les autres, en un lot (aucun : pas de vérificateur ; jamais la session à
  sa place : seul un vérificateur séparé a un gain de précision mesuré) : un second sous-agent
  neuf au modèle `opus`, avec le chemin absolu de `references/contre-verification.md`, le dossier
  de travail et l'arbre relu.

Puis `git status` : un fichier neuf laissé dans le dépôt passe au dossier de travail (`mv`) avant
⑤, nommé au bilan ; un fichier suivi modifié : arrêt, le dire.

Pendant ces agents, le reste avance (la dernière partie : la PR, ③ vert, si les règles l'ouvrent ;
la CI) ; avant une autre partie, l'arbre attend leur retour. Un bilan de clôture suit. Un seul tour ; une seconde relecture, sur demande. Sans sous-agent
possible : relire soi-même avec les deux briefs, et le bilan le dit.

## ⑤ Corriger

Sur sa branche, hors lecture seule, en un lot : les commandes rouges de ③, et les constats
bloquants et importants `CONFIRMED` sur des lignes que la branche a écrites ; un bug : son test
rouge d'abord. Le reste (ligne plus ancienne, autre fichier, comportement non demandé,
`PLAUSIBLE`, `Nit:`, « à trancher ») : au bilan, numéroté ; l'utilisateur choisit. Puis ③
relancée, et le diff du fix (`git diff` depuis l'état relu) relu une fois dans la session contre
`references/relecture.md`, chemin à risque compris : jamais un troisième tour d'agents.

## La fin du chantier

Après la dernière partie : les commandes de ③ point 2 sur la pointe, sauf si leur dernier vert
la vaut déjà (une partie commitée avant ③ laisse un arbre propre, et la pointe n'a pas bougé
depuis) ; puis la PR et sa CI. Des commandes, pas une relecture de tout le diff.

## Le bilan

Le chat reçoit le bilan court, sans raconter la méthode, sauf une étape qui a échoué ; un agent
pas encore revenu y est en ⏳. Des règles de l'utilisateur qui fixent leur propre forme de bilan
priment :

<!-- bilan -->
1. **Une phrase d'abord** : l'état, et ce qui change pour l'utilisateur.
2. **Fait** : une ligne par PR, issue ou livrable, depuis le dernier bilan (tout le chantier
   quand l'utilisateur demande où on en est). Un échec y figure en ❌, l'erreur exacte dans un
   bloc de code.
3. **Reste** : 👤 ce que l'utilisateur décide ou fait, avec la réponse conseillée ; 👉 la
   prochaine étape de l'agent ; ⏳ ce qui tourne encore. Un point qui bloque une PR la nomme.
4. **À savoir** : ❗ un risque, une chose non prouvée, un choix fait à la place de l'utilisateur.
5. **Une liste numérotée d'un bout à l'autre**, sans arbre ; un bloc vide saute. Une PR que rien
   ne bloque (ni fix, ni décision, ni relecture en cours, ni CI rouge) : la dernière ligne le dit
   et la nomme.
6. **Le détail** (preuves, constats de relecture) vit dans la PR ou dans un fichier dont le bilan
   donne le chemin, sinon il attend la demande ; le bilan n'en garde que ce qui demande une action
   ou porte un risque, sans renvoyer à ses numéros.
<!-- /bilan -->

Le détail va dans `bilan.md`, au dossier de travail, sous les mêmes blocs :

1. **La phrase** : ✅ prêt · ❗ prêt avec réserves · ❌ pas prêt.
2. **Fait** : chaque exigence prouvée, sa preuve (commande ou capture) ; ce qui a été simplifié.
3. **Reste** : les constats retenus (❌ puis ❗, `fichier:ligne`, impact), puis `PLAUSIBLE`,
   « à trancher » (options, recommandation), `Nit:` ; un constat qu'un test, un lint ou une règle
   aurait évité : le garde-fou proposé, jamais écrit d'office ; à tester (geste → attendu) ; la
   planche avant/après.
4. **À savoir** : chaque exigence non prouvée, et pourquoi ; le rayon d'impact (migration,
   données, prod, interface publique, client déjà installé, garde-fou : mot exact, permission,
   hook, suppression ; geste irréversible), qui fait relire la PR « lentement » ; ce qui a été
   sauté ou arbitré à la place de l'utilisateur, et le coût si c'est faux ; les écartés, une ligne
   chacun (réfutés, préexistants, hors du lot, déclinés).

Sur sa propre PR dont le modèle a une section « Vérif » : le bilan court, puis `bilan.md` replié
dessous (`<details>`), dans cette section seule (`gh pr view <n> --json body`, puis
`gh pr edit <n> --body-file`).

Le skill s'arrête là.
