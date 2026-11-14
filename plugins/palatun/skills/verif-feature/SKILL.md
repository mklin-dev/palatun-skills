---
name: verif-feature
description: Use when a feature, fix or branch is finished, before a PR or merge, or when asked to check the work — « vérifie la feature », « code review », « audit avant merge », « audit complet », « tout est bon et clean », « pas de superflu », « passe qualité », « montre l'avant/après ». Proves it by project commands and a cross-checked fresh review. Not for a spec or plan before code, nor a project audit.
---

# verif-feature — vérifier avant PR ou merge

Prouver au lieu d'affirmer, à la taille du travail :
`① préparer → ② simplifier → ③ prouver → ④ relire → ⑤ corriger → bilan`.

| Taille | ④ relire | ④ contre-vérifier |
| --- | --- | --- |
| Retouche (le diff se dit en une phrase), ou sans logique nouvelle (déplacé, renommé, doc, config) | dans la session ; sans logique nouvelle : signatures, props et imports neufs | ❌ |
| Feature, gros chantier, ou **chemin à risque quelle que soit la taille** | par un relecteur neuf | ✅ |

Un chemin à risque : auth, droits (RLS) ou SQL, secrets, migration de données ; tout fichier qui
règle l'agent (`AGENTS.md`, `CLAUDE.md`, `SKILL.md`, définitions d'agents, settings, hooks, règles
Codex, `.mcp.json`, manifeste de plugin) ; la CI ; plus la ligne `À risque` du projet.
`risque.txt` (①) en relève les chemins connus, pas tous.

**Lecture seule** — la branche d'un autre, ou une demande seule de vérifier (« vérifie », « code
review », « audit ») : le passage entier, mais rien ne s'écrit d'office. La base se merge sur une
tête détachée (`git switch --detach`), jamais sur la branche vérifiée, et la session revient sur
la branche à la fin (`git switch -`) ; simplifications, fixes, mise à jour de la branche et
description de sa PR vont au bilan en propositions, appliquées sur demande. Avant un push sur la
branche d'un autre, `git fetch` : sa pointe a bougé depuis la vérif → arrêt, le dire (un travail
de son auteur passerait sous le tien).

## ① Préparer

1. **L'`AGENTS.md` du projet prime** (ou celui d'un dossier parent) : ses commandes (§ Commandes),
   et dans sa § Flow deux lignes optionnelles, `À risque` (chemins sensibles en plus) et
   `En plus` (une étape propre, une grille par exemple, et l'étape qui la lance).
2. **Ce qui a commandé le diff** : design, spec, plan, ticket, ou le symptôme d'un bug ; une PR :
   les issues qu'elle ferme (`gh pr view --json closingIssuesReferences`, puis `gh issue view`).
   Le copier en `spec.md` dans le dossier de travail ; inconnu : le demander en une ligne.
   Pourquoi : sans référence, « conforme » ne veut rien dire, et les agents ne lisent pas le chat.
3. **`scripts/prepare.sh <dossier> [base] [-- chemins du lot]`**, le dossier hors du dépôt (le
   scratchpad sous Claude, `mktemp -d` ailleurs) ; `[base]` : celle de la PR si ce n'est pas la
   branche par défaut (`develop`) ; après `--` : les chemins du lot quand une autre session a un
   changement dans l'arbre (il reste hors revue et intact). Retard non nul : merger la base (ou
   rebaser, si la § Git du projet le dit) avant ③, car une preuve sur une branche en retard ne
   prouve pas ce qui sera mergé ; conflit : arrêt, le dire. Lot vide : s'arrêter.

## ② Simplifier

Dans la session, sur les lignes du lot, contre l'axe 3 de `references/relecture.md` : appliqué sur
sa branche, sauf les odeurs de code (proposées) ; en lecture seule ou hors du lot, proposé.
`/simplify` reste à la demande : il lance 4 agents et applique toujours ses retouches.

## ③ Prouver — toujours

D'abord relancer `prepare.sh` : ② et le merge de la base ont changé le diff, et la preuve comme la
relecture portent sur ce qui sera mergé. De là au retour du vérificateur (④), l'arbre ne bouge
pas : relecteur et vérificateur lisent ce diff.

1. **Les tests touchés d'abord**, dans `verif.diff` : assertions retirées, cas supprimés, `skip`,
   attendus modifiés. ❌ si une régression est masquée ou si un comportement requis perd sa
   couverture ; une suppression redondante ou un attendu conforme à la demande n'est pas un défaut.
2. **Les commandes**, sortie dans `verif.out` : celles de la CI du projet (lint, types, tests,
   build ; jamais un déploiement) et celles de son `AGENTS.md` ; sinon, pour du TypeScript,
   `conventions-ts` § Definition of Done ; aucune : le dire au bilan. Un workflow touché :
   actionlint puis zizmor. Pourquoi : la CI confirme, elle ne trouve pas.
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

Les règles, pour la session comme pour le relecteur : `AGENTS.md`, conventions, `DESIGN.md` de
l'interface touchée, règles globales.

**Dans la session** (retouche, sans logique nouvelle) : `references/relecture.md`, sur les lignes
du lot, avec les règles ; seuls les constats que la session confirme en relisant le code passent
en ⑤.

**Relecteur neuf** (feature, gros chantier, chemin à risque) : l'agent `adversarial-reviewer`
s'il existe, sinon un sous-agent neuf au modèle `opus`, à qui le brief interdit d'écrire. Il
reçoit le chemin absolu de `references/relecture.md`, du dossier de travail (`verif.diff`,
`commits.txt`, `spec.md`, `verif.out`) et des règles. Une étape `En plus` peut fournir son propre
brief : il remplace `references/relecture.md`, et le vérificateur tourne quand même. Pas le
`/code-review` intégré : il ne reçoit ni spec ni messages de commit (le texte qui le suit est une
cible), ne vérifie ses constats qu'en `max` et vise un nombre minimum de constats ; à la demande,
un second avis sur les bugs, en plus du relecteur.

**Puis contre-vérifier** ses constats bloquants et importants, en un lot (pas les `Nit:` : une
erreur y coûte peu ; aucun constat : pas de vérificateur) : un second sous-agent neuf au modèle
`opus`, avec le chemin absolu de `references/contre-verification.md`, le dossier de travail et
l'arbre que le relecteur a lu ; à son retour, `git status` : un fichier qu'il aurait laissé dans
le dépôt se retire avant ⑤.
Pourquoi : un relecteur trouve toujours quelque chose, et un faux constat corrigé coûte un fix et
une régression possible ; un vérificateur séparé est le seul moyen dont un gain de précision est
mesuré.

Lancés en fond : le reste avance (la PR si les règles l'ouvrent, la CI), et un bilan de clôture
suit leur retour. Un seul tour ; une seconde relecture, sur demande. Pas de sous-agent possible :
relire soi-même avec les deux briefs, et le bilan le dit.

## ⑤ Corriger

Sur sa branche, hors lecture seule, en un lot : les constats bloquants et importants `CONFIRMED`
sur des lignes que la branche a écrites ; un bug : son test rouge d'abord. Le reste (ligne plus
ancienne, autre fichier, comportement que personne n'a demandé, `PLAUSIBLE`, `Nit:`, « à
trancher ») va au bilan, numéroté ; l'utilisateur choisit. Puis ③ relancée, et le diff du fix
(`git diff` depuis l'état relu) relu une fois dans la session contre `references/relecture.md`.
Pourquoi : un fix non relu est du code que personne n'a vérifié.

## Le bilan

`bilan.md`, au dossier de travail, numéroté d'un bout à l'autre, fini par la ligne « À faire
avant de merger » du chat ; une rubrique vide saute.

1. **Le verdict** (✅ prêt · ⚠️ prêt avec réserves · ❌ pas prêt) et ce qui change pour
   l'utilisateur.
2. **Chaque exigence et sa preuve** : prouvée (la commande ou la capture) ou non prouvée (pourquoi).
3. **Les constats retenus** : ❌ puis ⚠️, `fichier:ligne` et impact ; puis `PLAUSIBLE`, « à
   trancher » (options et recommandation) et `Nit:`. Un constat confirmé qu'un test, un lint ou une
   règle aurait évité : le garde-fou proposé, jamais écrit d'office.
4. **Les écartés**, une ligne chacun : réfutés, préexistants, hors du lot, déclinés.
5. **Simplifié, sauté** (et pourquoi), **arbitré** à la place de l'utilisateur (et le coût si
   c'est faux).
6. **Le rayon d'impact** : migration, interface publique, client déjà installé, geste irréversible.
7. **À tester** (geste → attendu), et le chemin de la planche avant/après.

Sur sa propre PR dont le modèle a une section « Vérif » : `bilan.md` dans cette section seule
(`gh pr view <n> --json body`, puis `gh pr edit <n> --body-file`).

**Le chat, trois points au plus**, sans raconter la méthode (relecteur, vérificateur, tests vus
rouges), sauf une étape qui a échoué :
1. le verdict en icône, et ce qui change pour l'utilisateur, en une phrase ;
2. ce qui lui reste sans bloquer le merge (tester, regarder, un risque à connaître : non prouvé,
   sauté, arbitré à sa place, `PLAUSIBLE`), chaque point en quelques mots ; rien : le point saute ;
3. le chemin de `bilan.md`, puis « À faire avant de merger : … », chaque point avec sa raison
   (« relecture en cours » tant qu'un agent n'est pas revenu), ou « Rien à faire avant de
   merger » ; la forme des règles de l'utilisateur, s'il en a.

Pourquoi : le lecteur décroche devant un bloc ; ce qui demande une action, une décision ou porte
un risque reste sous ses yeux, par son numéro.

Le skill s'arrête là.
