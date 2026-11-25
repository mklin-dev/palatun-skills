# Démarrer ou régler un projet

Lu à la création d'un projet, pour l'aligner sur le socle ou régler son tsconfig, son lint ou
ses hooks git. Les règles de tous les jours : `SKILL.md`.

## Le socle

Ce que chaque projet porte ; un écart s'écrit dans son `AGENTS.md`, avec sa raison.

- **TypeScript strict** : § TypeScript — config.
- **Le lint commun** : § ESLint.
- **Prettier**, dès qu'un humain écrit aussi dans le dépôt : son éditeur et l'agent sortent le
  même format, et un diff ne montre que le vrai changement.
- **Les hooks git** : celui de commit partout, celui de push sauf là où le push met en ligne
  (§ Hooks git).
- **Le paquet** de ce skill, et l'`AGENTS.md` : § La doc du projet.
- **Un script `verif`** dans `package.json` (typecheck, lint, tests, `format:check` s'il y a
  Prettier, et `sh .agents/skills/conventions-ts/scripts/check-agents.sh` là où le paquet est
  installé) : la vérif d'avant PR tient en une commande, le même nom partout. La CI garde une
  étape par commande (`ci-setup`).
- **La CI** : skill `ci-setup`. **Les dépendances** (Dependabot, actions épinglées) :
  `references/pnpm-securite.md`.
- **Le merge** : squash seul et branche effacée au merge (GitHub → Settings → General → Pull
  Requests) : un commit par PR sur la base, le titre de la PR pour sujet ; un dépôt sans
  collaborateur, son message : « Pull request title and description » (`PR_BODY`), le pourquoi
  écrit une fois (skill `git-commit`).

## TypeScript — config

En plus de `strict` (défaut depuis TS 6), activer dans `tsconfig.json` :

- **`noUncheckedIndexedAccess: true`**.
- **`erasableSyntaxOnly: true` + `verbatimModuleSyntax: true`** : `tsc` refuse `enum` (→ `as
  const` et une union de littéraux) et exige `import type`.

Garde-fous :
- Garder `moduleResolution: bundler`, défaut de Next et d'Expo : `node` est déprécié en TS 6 et
  supprimé en TS 7, `nodenext` vise Node, pas un bundler.
- La version de `typescript` : `SKILL.md` § Dépendances & sécurité.

## ESLint

**Le lint de référence**, le même dans chaque projet : le preset du framework
(`eslint-config-next` ou `eslint-config-expo`), puis `eslint.mjs`, dans le dossier de ce skill,
puis les blocs du projet :

```js
import { conventions } from '@palatun/conventions-ts/eslint';

export default [
  ...preset,
  ...conventions({ dir: import.meta.dirname, type: 'next' }),
  ...blocsDuProjet,
];
```

`conventions({ dir, src, type, allow })` : ses options, leur sens et leurs défauts, dans la
JSDoc de `conventions()` (`eslint.mjs`) ; l'arbre de chaque `type` : `archi.md` § Squelette,
`api.md` § Squelette. `dir` : jamais `process.cwd()` ; `type` : le verrou 3, `../` refusé hors
d'`api`, et en `api` les verrous de tRPC (`api.md` § Verrous, 1, 4 et 5) ; `allow` : chaque chemin
avec sa raison dans l'`AGENTS.md` du projet.

Le code serveur ajoute, après `conventions()`, `...comportement({ dir: import.meta.dirname })`
(`dir` comme lui) ; ce qu'il tient : `api.md` § Verrous, 6. Ses règles typées veulent le typed
linting.

Un `eslint.config` en CommonJS l'importe par `require()` (Node ≥ 22.12). Un dépôt qui l'importe
installe le paquet (§ La doc du projet).

`eslint.mjs` porte ce qui est identique partout ; les plugins du preset suffisent, sauf pour
l'arbre, les noms et les directives, que le paquet apporte (`eslint-plugin-boundaries`,
`eslint-plugin-check-file`, `@eslint-community/eslint-plugin-eslint-comments`) :
- **les verrous 1 et 2** d'`archi.md` § Règle d'import et verrou ;
- **avec `type`** : l'arbre (son message ne se règle pas : l'`AGENTS.md` du projet y renvoie,
  § La doc du projet), les noms (`SKILL.md` § Nommage), le verrou 3, `../` hors du dossier et, en `next`,
  Cloudflare hors d'un `lib/` (`web.md` § Cloudflare dans lib) ; `../` permis en `api` (sa raison :
  `structure()`, `eslint.mjs`) ;
- **les promesses orphelines**, en `error` : du typed linting en cherry-pick, tout le preset
  type-checked étant bruyant ; `onSubmit={handleSubmit(…)}` de React Hook Form passe tel quel, un
  handler `async` nu reste interdit par `SKILL.md` § TypeScript — règles, sans lint, et
  `useEffect(async…)`, `tsc` le refuse ;
- **les imports de type** (autofix) : `verbatimModuleSyntax` laisse dans le JS émis une classe
  importée pour son seul type ;
- **`react/no-unescaped-entities` coupée** : JSX échappe au runtime ; apostrophes en clair.

Restent au projet, après `conventions()` :
- **le verrou 3 sans `type`** (`no-restricted-imports`) ; avec `type`, seulement ce que sa stack
  y ajoute, comme les paquets de l'API pris en type seul (`api.md` § Verrous, 2) ;
- **`@tanstack/query/prefer-query-options` en `error`** s'il a TanStack Query : deux `queryFn` sur
  une même clé corrompent le cache sans erreur TS ;
- **un bouton est une primitive** : `react/forbid-elements` interdit l'élément natif (`button`,
  `Pressable` et les `Touchable*`) hors du dossier des primitives ; un cas légitime porte son
  `eslint-disable-next-line` et sa raison ;
- **son réglage du typed linting**, s'il en a un (`projectService: { allowDefaultProject }`
  pour un `.ts` hors tsconfig) : `conventions()` pose `projectService: true` et
  `tsconfigRootDir: dir`, et le dernier bloc gagne ;
- un écart, dans son `AGENTS.md` § Conventions, avec sa raison.

`react-hooks` recommended (règles du Compiler incluses) vient des deux presets ; à la main hors
d'eux, sans `eslint-plugin-react-compiler` en plus.

**Une règle qui s'active corrige ses violations dans la même PR**, sans gel
(`eslint-suppressions.json`) : une dette gelée ne se résorbe pas.

## Hooks git

Des contrôles rapides du code touché, branchés par
`"prepare": "git config core.hooksPath .githooks || true"` dans le `package.json`. Ils se
contournent (`--no-verify`) : la vérif d'avant PR et la CI restent la barrière.

**`pre-commit`** : le `.githooks/pre-commit` du dépôt, exécutable, lance `hooks/pre-commit`, dans
le dossier de ce skill, et saute sans le paquet (un worktree pas encore installé) ; ses réglages
se posent devant l'`exec`, seulement si le projet s'écarte du défaut :

```sh
#!/bin/sh
hook="$(git rev-parse --show-toplevel)/.agents/skills/conventions-ts/hooks/pre-commit"
[ -e "$hook" ] || { echo "pre-commit : conventions-ts absent (pnpm install), sauté." >&2; exit 0; }
HOOK_PATHS='src scripts' exec sh "$hook"
```

- **Le périmètre**, celui de `pnpm lint` et `pnpm format:check` : les fichiers indexés, liens
  symboliques exclus. ESLint ne voit que ceux sous `HOOK_PATHS` (des dossiers ; défaut : tout le
  dépôt) et d'une extension de `HOOK_EXTS` (défaut : `hooks/pre-commit`) ; Prettier,
  tous (`HOOK_FORMAT=all`, défaut, `.prettierignore` décide), ou les seuls fichiers d'ESLint
  (`HOOK_FORMAT=lint`) quand le dépôt ne formate qu'eux.
- Il lance ESLint sans warning, puis Prettier `--check` si le projet l'a, sur la version
  indexée ; il ne réécrit et n'installe rien. Le détail : `hooks/pre-commit` et `hooks/env.sh`.

**`pre-push`** : `hooks/pre-push`, lancé de même par le `.githooks/pre-push` du dépôt, refuse à
tous un push direct sur `main`, `git push --no-verify` en sortie ; un dépôt privé sur un compte
GitHub Free n'a pas de protection de branche. Un dépôt qui pousse sur sa branche par défaut par
choix (mis en ligne par le push) ne le branche pas.

```sh
#!/bin/sh
hook="$(git rev-parse --show-toplevel)/.agents/skills/conventions-ts/hooks/pre-push"
[ -e "$hook" ] || { echo "pre-push : conventions-ts absent (pnpm install), sauté." >&2; exit 0; }
exec sh "$hook" "$@"
```

Un typecheck au `pre-push` est un choix du projet, écrit dans son `AGENTS.md` : il est lent, et
un hook qui casse finit contourné.

## La doc du projet

Seul sur un dépôt, le skill installé sur le poste suffit, tant que son lint n'importe pas
`eslint.mjs` : la CI n'a pas le poste, ce dépôt installe alors le paquet. Un dépôt où d'autres
développent sur ces conventions l'installe aussi : `@palatun/conventions-ts` en devDependency,
le même d'un dépôt à l'autre, jamais retouché (une équipe qui a ses propres règles ne le reçoit
pas), et l'exclusion de `@palatun/*` du délai de pnpm dans son `pnpm-workspace.yaml`
(`references/pnpm-securite.md`, `minimumReleaseAge`). Deux
liens relatifs le donnent aux agents : `.agents/skills/conventions-ts` →
`node_modules/@palatun/conventions-ts`, `.claude/rules/conventions-ts.md` → son `SKILL.md` ; sans
`pnpm install`, ni le skill, ni la règle, ni les hooks. `verif-feature` et les autres skills de
consigne arrivent par un plugin Claude Code partagé, déclaré dans `.claude/settings.json` : ce
qui est propre au projet va dans son `AGENTS.md`, § Conventions (les écarts aux règles) et § Flow
(sa vérification).

```text
projet/
├── AGENTS.md                         ce que le code ne dit pas, § Conventions et § Flow compris
├── DESIGN.md                         s'il a une interface : son style, ses primitives s'il en a
├── docs/                             comment le système marche, un sujet par fichier
├── .agents/skills/                   les skills du projet, au chemin standard (release, grille)
│   └── conventions-ts/         →     dépôt partagé : lien vers node_modules/@palatun/conventions-ts
├── .claude/skills/<x>          →     lien vers .agents/skills/<x>, sauf conventions-ts
├── .claude/settings.json             dépôt partagé : le plugin des skills de consigne
├── .claude/rules/conventions-ts.md → dépôt partagé : lien vers son SKILL.md, injecté à la
│                                     lecture d'un .ts, d'un package.json ou d'un tsconfig
├── .github/pull_request_template.md  sa section « Vérif » reçoit le bilan de verif-feature
└── lint + hooks git                  ce qui fait respecter les règles, pour tout le monde
                                      (preset, puis eslint.mjs du skill : § ESLint)
```

`AGENTS.md`, dans cet ordre :

```markdown
# <projet>

> Ce fichier pilote l'agent. Le système (structure, hébergement, déploiement) vit dans `docs/`.

## Projet

<ce que c'est, pour qui, en trois lignes>

## Commandes

<install · un test seul · `verif` (typecheck, lint, format, tests) · build>

## Organisation

Par feature, selon `conventions-ts` (`archi.md`). Invariants, en trois à cinq lignes, tenus par
le lint :
- une feature n'importe jamais une autre ; le commun monte dans components/, hooks/, stores/
  ou lib/ ;
- le partagé n'importe ni features/ ni app/ ; seul l'accès aux données parle à la base.
<avec `type` : « un fichier refusé par `boundaries/no-unknown-files` sort de l'arbre :
`conventions-ts` (`archi.md` § Squelette), et nos `allow` dans `eslint.config` »>
<avec une API maison : « Feature de référence : `<feature>` » (`api.md` § Squelette)>

## Conventions

<dépôt partagé : « règles de code : `.agents/skills/conventions-ts/` » ; avec une interface :
« UI : lire `DESIGN.md`, réutiliser `components/ui/` ; une primitive qui ne convient pas se
modifie, jamais doublée » ; puis chaque écart au skill, avec sa raison>

## Pièges

<ce qui trompe dans le code : un vieux motif à ne pas recopier, un dossier mort en apparence>

## Flow

Avant une PR : `verif-feature`.
<si besoin, lues par verif-feature : À risque (les chemins sensibles du projet) · En plus (une
étape propre, une grille par exemple : le skill ou la doc, et l'étape qui la lance)>

## Docs et skills

<docs/<sujet>.md · les skills du projet · dépôt partagé : la puce des skills de consigne,
reprise d'un dépôt qui l'a>
```

- **Court** : 200 lignes au plus, au-delà l'agent suit moins bien (Anthropic) ; tenu, avec la
  chaîne de Codex, par `scripts/check-agents.sh`. Une règle d'un
  seul paquet va dans l'`AGENTS.md` de ce paquet (monorepo) ou dans `docs/` ; pas d'`AGENTS.md`
  par feature.
- **Rien de ce que le code, le lint ou un skill dit déjà**, ni flow perso (un flow d'équipe,
  oui) : les règles de ce skill ne se recopient pas dans `AGENTS.md`, le skill les porte.
  Restent les invariants de § Organisation et les écarts du projet.
- **Dépôt partagé** : la règle `.claude/rules/conventions-ts.md` injecte `SKILL.md` (pas de lien
  `.claude/skills/` pour lui : il arriverait deux fois). Une version qui change le code (lint,
  hooks, scripts) monte tout de suite, une PR par dépôt (`pnpm update @palatun/conventions-ts`) ;
  une version de doc seule, et un oubli, arrivent par la PR de Dependabot, relue et mergée par un
  humain (`references/pnpm-securite.md`, réglage 4).
- **Une procédure** (release, vérif d'une PR) est un skill du projet dans `.agents/skills/`
  (le chemin standard), avec un lien dans `.claude/skills/` ; à effet de bord (release, déploiement) :
  `disable-model-invocation: true` (Claude), sinon l'agent peut la lancer seul.
- **`AGENTS.md` seul**, jamais de `CLAUDE.md` à côté : pour Claude Code, un `CLAUDE.md` masque
  l'`AGENTS.md` (avant Claude Code 2.1.281, une session sans télémétrie ne lit que `CLAUDE.md` : mettre
  Claude Code à jour).
  Codex coupe sans prévenir une chaîne d'`AGENTS.md` trop longue (`scripts/check-agents.sh`).
- **`DESIGN.md`**, un par interface (à la racine, ou dans son app d'un monorepo), sur l'un des
  deux gabarits de `flow-design` (§ 0) : un site, tokens en tête ; une app à primitives maison,
  leur catalogue et ses recettes d'écran, tokens restés dans le code.
- Une feature trop riche pour quelques lignes (sous-domaines, socle commun) a sa carte dans
  `docs/<feature>.md`, citée depuis § Docs et skills.
- Jamais d'`ARCHITECTURE.md` ni d'arborescence fichier par fichier : le code la montre, elle
  dérive. Un `docs/<sujet>.md` se cite par son chemin, jamais en `@import` : Codex ne le connaît
  pas (`scripts/check-agents.sh`).
- Un renvoi vers ce skill nomme son fichier et sa section (`conventions-ts, api.md § Verrous`) :
  le même script refuse une section qui n'existe plus, dans les docs comme dans le code, hors
  d'un dossier `migrations/`.
- Vérifier un `AGENTS.md` : `/doctor prompt-audit` (consignes contradictoires, périmées, fichier
  cité absent).
