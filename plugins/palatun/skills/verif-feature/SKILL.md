---
name: verif-feature
description: Use when a feature, fix or branch is finished, before a PR or merge, or when asked to check the work — « vérifie la feature », « code review », « audit avant merge », « audit complet », « tout est bon et clean », « pas de superflu », « passe qualité », « montre l'avant/après ». Proves the work with the project's own commands, reviews it on three axes (project rules, spec and bugs, cleanup) with a fresh reviewer whose findings a second agent tries to refute, then fixes and reports. Not for a spec or a plan before code exists, nor a whole-project audit (the project's own skill, like `audit-feature`).
---

# verif-feature — vérifier avant PR ou merge

Prouver au lieu d'affirmer, à la taille du travail :
`① préparer → ② simplifier → ③ prouver → ④ relire → ⑤ corriger → bilan`.

| Taille | ② et ④ relire | ④ contre-vérifier |
| --- | --- | --- |
| Retouche (le diff se dit en une phrase) | dans la session | ❌ |
| Sans logique nouvelle (déplacé, renommé, doc, config) | dans la session, signatures, props et imports neufs | ❌ |
| Feature, gros chantier, ou **chemin à risque quelle que soit la taille** | ② dans la session, ④ par un relecteur neuf | ✅ |

③ tourne toujours. Un chemin à risque : auth, RLS ou SQL, secrets, migration de données ; tout
fichier qui règle l'agent (`AGENTS.md`, `CLAUDE.md`, `SKILL.md`, définitions d'agents, settings,
hooks, règles Codex) ; workflows CI ; plus la ligne `À risque` de la § Flow du projet.

**Lecture seule** — la branche d'un autre (une relecture), ou une demande seule de vérifier
(« vérifie », « code review », « audit ») : le passage entier, mais rien ne s'écrit d'office.
La base se merge sur une tête détachée (`git switch --detach`), jamais sur la branche
vérifiée, et la session revient sur la branche à la fin (`git switch -`) ; simplifications,
fixes, mise à jour de la branche et description de sa PR vont au bilan en propositions,
appliquées sur la demande de l'utilisateur, sur la branche. Avant un push sur la branche
d'un autre, `git fetch` : sa pointe a bougé depuis la vérif → arrêt, le dire (un travail de son
auteur passerait sous le tien).

## ① Préparer

1. **L'`AGENTS.md` du projet prime** (ou celui d'un dossier parent) : ses commandes (§ Commandes),
   et dans sa § Flow deux lignes optionnelles, `À risque` (chemins sensibles en plus) et
   `En plus` (une étape propre, une grille par exemple, et l'étape qui la lance).
2. **Ce qui a commandé le diff** : design, spec, plan, ticket, ou le symptôme d'un bug ; une PR :
   les issues qu'elle ferme (`gh pr view --json closingIssuesReferences`, puis `gh issue view`).
   Le copier en `spec.md` dans le dossier de travail ; inconnu : le demander en une ligne.
   Pourquoi : sans référence, « conforme » ne veut rien dire, et les agents ne lisent pas le chat.
3. **`scripts/prepare.sh <dossier de travail> [base] [-- chemins du lot]`**, le dossier hors du
   dépôt (le scratchpad sous Claude, `mktemp -d` ailleurs) : base (par défaut celle d'`origin`),
   retard, périmètre (commits, travail en cours, non suivis), `verif.diff`, `commits.txt`,
   chemins à risque (`risque.txt`, à compléter par la ligne `À risque`). Une PR sur une autre
   base (`develop`) : la donner en 2e argument. Un changement d'une autre session dans l'arbre :
   passer les chemins du lot après `--`, il reste hors revue et intact. Retard non nul : merger
   la base (ou rebaser, si la § Git du projet le dit) avant ③, car une preuve sur une branche en
   retard ne prouve pas ce qui sera mergé ; conflit : arrêt, le dire. Lot vide : s'arrêter.

## ② Simplifier

Dans la session, sur les lignes du lot, contre l'axe 3 de `references/relecture.md` : appliqué sur
sa branche, proposé en lecture seule ; hors du lot, la retouche se propose. `/simplify` reste à la
demande : il lance 4 agents en parallèle et applique toujours ses retouches.

## ③ Prouver — toujours

D'abord relancer `prepare.sh` : ② et le merge de la base ont changé le diff, et la preuve comme la
relecture doivent porter sur ce qui sera mergé. ③ ne touche pas l'arbre : ④ lit ce même diff.

1. **Les tests touchés d'abord**, dans `verif.diff` : assertions retirées, cas supprimés, `skip`,
   attendus modifiés. ❌ si une régression est masquée ou si un comportement requis perd sa
   couverture ; une suppression redondante ou un attendu conforme à la demande n'est pas un défaut.
2. **Les commandes**, sortie dans `verif.out` : celles de la CI du projet (lint, types, tests,
   build ; jamais un déploiement) et celles de son `AGENTS.md` ; sinon, pour du TypeScript,
   `conventions-ts` § Definition of Done ; aucune : le dire au bilan. Un workflow touché :
   actionlint puis zizmor. La ligne `En plus` tourne là où elle le dit. Pourquoi : la CI confirme,
   elle ne trouve pas.
3. **Le vrai comportement** : UI → un navigateur piloté (`playwright-cli`), preuve par les
   données (texte de la page, réseau, contenu envoyé), les attendus écrits rejoués, un rendu
   changé en avant/après (`references/avant-apres.md`), le motion relu (web : `review-animations` ;
   Expo : les tokens de motion du projet), et la liste « à tester » pour l'humain (geste →
   attendu). CLI ou API → commande et sortie, en local ou en test. RLS ou SQL → pgTAP s'il existe,
   sinon la requête sous le rôle permis et le rôle refusé, en local ou dans `begin … rollback`,
   jamais sur la prod. Une écriture distante ou une donnée réelle chez un tiers exige
   l'autorisation de cette action ; sans elle, la preuve manquante va au bilan.
4. **Un bug** : son test montré rouge avant le fix, vert après. Pas vu rouge dans la session : la
   base extraite dans un dossier neuf hors du dépôt (`git archive <base> | tar -x -C <neuf>`), le
   test de la branche recopié, il échoue sur l'assertion du bug.

## ④ Relire

Rien ne bouge dans l'arbre jusqu'au retour du vérificateur.

**Dans la session** (retouche, sans logique nouvelle) : `references/relecture.md`, sur les lignes
du lot, avec les règles (`AGENTS.md`, conventions, `DESIGN.md` de l'interface touchée) ; seuls les
constats que la session confirme en relisant le code passent en ⑤.

**Relecteur neuf** (feature, gros chantier, chemin à risque) : l'agent `adversarial-reviewer`
s'il existe, sinon un sous-agent neuf au modèle `opus`, à qui le brief interdit d'écrire. Il
reçoit le chemin absolu de `references/relecture.md`, du dossier de travail (`verif.diff`,
`commits.txt`, `spec.md`, `verif.out`) et des règles (`AGENTS.md`, conventions, `DESIGN.md` de
l'interface touchée, règles globales). Une étape `En plus` peut fournir son propre brief : il
remplace `references/relecture.md`, et le vérificateur tourne quand même.
Pas le `/code-review` intégré : il ne reçoit ni spec ni messages de commit (le texte qui le suit
est une cible), ses constats ne sont vérifiés qu'en `max`, et il vise un nombre minimum de
constats ; il reste un second avis sur les bugs, à la demande.

**Puis contre-vérifier** ses constats bloquants et importants, en un lot (aucun : pas de
vérificateur) : un second sous-agent neuf au modèle `opus`, avec le chemin absolu de
`references/contre-verification.md`, le dossier de travail et l'arbre que le relecteur a lu ; à
son retour, `git status` : un fichier qu'il aurait laissé dans le dépôt se retire avant ⑤. Les
agents tournent l'un après l'autre, jamais ensemble.
Pourquoi : un relecteur trouve toujours quelque chose, et un faux constat corrigé coûte un fix et
une régression possible ; un vérificateur séparé est le seul moyen dont un gain de précision est
mesuré.

Lancés en fond : le reste avance (la PR si les règles l'ouvrent, la CI) ; tant qu'ils ne sont pas
revenus, le bilan dit « À faire avant de merger : relecture en cours », et un bilan de clôture
suit leur retour. Un seul tour ; une seconde relecture, sur demande. Pas de sous-agent possible :
relire soi-même avec les deux briefs, et le bilan le dit.

## ⑤ Corriger

Sur sa branche, hors lecture seule, un seul lot : les constats bloquants et importants `CONFIRMED`
; un bug : son test rouge d'abord. Après un design ou un plan approuvé, les lignes que la branche a
écrites se corrigent sans redemander ; tout le reste (ligne plus ancienne, autre fichier,
comportement que personne n'a demandé, `PLAUSIBLE`, `Nit:`, « à trancher ») va au bilan, numéroté,
et l'utilisateur choisit. Puis ③ relancée, et le diff du fix (`git diff` depuis l'état relu) relu
une fois dans la session contre `references/relecture.md`. Pourquoi : un fix non relu est du code
que personne n'a vérifié.

## Le bilan

Écrit en entier dans `bilan.md`, au dossier de travail. Le chat en garde tout, sauf trois
choses qui restent dans le fichier : les preuves des exigences prouvées, les écartés et les
`Nit:` ; il donne le chemin de `bilan.md` avant la dernière ligne. `bilan.md` commence par le
texte du chat, mot pour mot, puis le reste, numéroté à la suite : « le 3 » vise le même point
des deux côtés. Pourquoi : le lecteur décroche devant un bloc, et ce qui demande une action,
une décision ou porte un risque reste sous ses yeux.

Le bilan d'une retouche ou d'un diff sans logique nouvelle ne compte que les points 1, 2, 3
(s'il y a un constat), 8 et 9.

1. **Le verdict** en premier : ✅ prêt · ⚠️ prêt avec réserves · ❌ pas prêt.
2. **Chaque exigence et sa preuve** : prouvée (la commande ou la capture) ou non prouvée (pourquoi).
3. **Les constats retenus** : ❌ puis ⚠️, `fichier:ligne` et impact ; puis `PLAUSIBLE`, « à
   trancher » (options et recommandation) et `Nit:`. Un constat confirmé qu'un test, un lint ou
   une règle aurait évité : le garde-fou proposé, jamais écrit d'office.
4. **Les écartés** : réfutés, préexistants, hors du lot, déclinés par le relecteur ; une ligne
   chacun.
5. **Ce qui a été simplifié, sauté** (avec la raison), et les arbitrages pris à la place de
   l'utilisateur, avec leur coût s'ils sont faux.
6. **Le rayon d'impact** : migration, interface publique, client déjà installé, geste irréversible.
7. **La planche avant/après** d'un rendu changé, son chemin.
8. **Sur sa propre PR**, si le modèle de PR du projet a une section « Vérif » : le contenu de
   `bilan.md` dans cette section seule (`gh pr view <n> --json body`, puis
   `gh pr edit <n> --body-file`).
9. **La dernière ligne** : « À faire avant de merger : … », chaque point avec sa raison, ou
   « Rien à faire avant de merger » ; la forme que fixent les règles de l'utilisateur, s'il en a.

Le skill s'arrête là.
