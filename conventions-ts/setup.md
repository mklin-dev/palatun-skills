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
- **La copie** de ce skill, et l'`AGENTS.md` : § La doc du projet.
- **Un script `verif`** dans `package.json` (typecheck, lint, tests, `format:check` s'il y a
  Prettier, et `sh .agents/skills/conventions-ts/scripts/check-agents.sh` là où le skill est
  copié) : la vérif d'avant PR tient en une commande, le même nom partout. La CI garde une
  étape par commande (`ci-setup`).
- **La CI** : skill `ci-setup`. **Les dépendances** (Dependabot, actions épinglées) :
  `references/pnpm-securite.md`.
- **Le merge** : squash seul et branche effacée au merge (GitHub → Settings → General → Pull
  Requests) : un commit par PR sur la base, le titre de la PR pour sujet.

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
import { conventions } from './.agents/skills/conventions-ts/eslint.mjs';

export default [...preset, ...conventions({ dir: import.meta.dirname }), ...blocsDuProjet];
```

`conventions({ dir })` : `dir` = `import.meta.dirname` (`__dirname` en CommonJS), jamais
`process.cwd()` ; `src: '.'` pour un projet sans `src/` (`archi.md` § Squelette). Le détail :
la JSDoc de `conventions()`, dans `eslint.mjs`.

Un `eslint.config` en CommonJS l'importe par `require()` (Node ≥ 22.12). Un dépôt qui l'importe
porte la copie du skill (§ La doc du projet).

`eslint.mjs` porte ce qui est identique partout, sans plugin (ceux du preset suffisent) :
- **les verrous 1 et 2** d'`archi.md` § Règle d'import et verrou ;
- **`@typescript-eslint/no-floating-promises` + `no-misused-promises` en `error`** : promesse
  orpheline. Typed linting (`projectService`), en cherry-pick : tout le preset type-checked est
  bruyant. `checksVoidReturn.attributes: false`, la forme courante : `onSubmit={handleSubmit(…)}`
  de React Hook Form passe tel quel, et un handler `async` nu reste interdit par `SKILL.md`
  § TypeScript — règles, sans lint. `useEffect(async…)`, lui, `tsc` le refuse ;
- **`@typescript-eslint/consistent-type-imports`** (autofix) : `verbatimModuleSyntax` laisse dans
  le JS émis une classe importée pour son seul type. `typeof import('…')` reste permis
  (`disallowTypeAnnotations: false`) : c'est la forme des mocks, `importOriginal<typeof import('…')>()` ;
- **`react/no-unescaped-entities` coupée** : JSX échappe au runtime ; apostrophes en clair.

Restent au projet, après `conventions()` :
- **le verrou 3** (`no-restricted-imports`) : ses paquets interdits dépendent de sa stack ;
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

**`pre-commit`** : le `.githooks/pre-commit` du dépôt, exécutable, tient en une ligne qui lance
`hooks/pre-commit`, dans le dossier de ce skill ; ses réglages se posent devant l'`exec`,
seulement si le projet s'écarte du défaut :

```sh
#!/bin/sh
HOOK_PATHS='src scripts' exec sh "$(git rev-parse --show-toplevel)/.agents/skills/conventions-ts/hooks/pre-commit"
```

- **Le périmètre**, celui de `pnpm lint` et `pnpm format:check` : les fichiers indexés, liens
  symboliques exclus. ESLint ne voit que ceux sous `HOOK_PATHS` (des dossiers ; défaut : tout le
  dépôt) et d'une extension de `HOOK_EXTS` (défaut : `ts tsx mts cts js jsx mjs cjs`) ; Prettier,
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
exec sh "$(git rev-parse --show-toplevel)/.agents/skills/conventions-ts/hooks/pre-push" "$@"
```

Un typecheck au `pre-push` est un choix du projet, écrit dans son `AGENTS.md` : il est lent, et
un hook qui casse finit contourné.

## La doc du projet

Seul sur un dépôt, le skill installé sur le poste suffit, tant que son lint n'importe pas
`eslint.mjs` : la CI n'a pas le poste, ce dépôt porte alors la copie. Un dépôt où d'autres
développent sur ces conventions porte une copie de ce skill, la même d'un dépôt à l'autre,
jamais retouchée (une équipe qui a ses propres règles n'en reçoit pas) ; `verif-feature` et les
autres skills de consigne arrivent par un plugin Claude Code partagé, déclaré dans
`.claude/settings.json`, sans copie : ce
qui est propre au projet va dans son `AGENTS.md`, § Conventions (les écarts aux règles) et § Flow
(sa vérification).

```text
projet/
├── AGENTS.md                         ce que le code ne dit pas, § Conventions et § Flow compris
├── DESIGN.md                         s'il a une interface : son style, ses primitives s'il en a
├── docs/                             comment le système marche, un sujet par fichier
├── .agents/skills/                   les skills du projet, au chemin standard (release, grille)
│   └── conventions-ts/               dépôt partagé : copie exacte de ce skill
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
  oui) : les règles de ce skill ne se recopient pas dans `AGENTS.md`, la copie du skill les porte.
  Restent les invariants de § Organisation et les écarts du projet.
- **Dépôt partagé** : la copie dans son `.prettierignore` (une copie ne se reformate pas) ; la règle
  `.claude/rules/conventions-ts.md` injecte `SKILL.md` (pas de lien `.claude/skills/` pour lui :
  il arriverait deux fois). La mettre à jour : une PR qui la recopie.
- **Une procédure** (release, vérif d'une PR) est un skill du projet dans `.agents/skills/`
  (le chemin standard), avec un lien dans `.claude/skills/` ; à effet de bord (release, déploiement) :
  `disable-model-invocation: true` (Claude), sinon l'agent peut la lancer seul.
- **`AGENTS.md` seul**, jamais de `CLAUDE.md` à côté : pour Claude Code, un `CLAUDE.md` masque
  l'`AGENTS.md` (une version ancienne, sans télémétrie, ne lit que `CLAUDE.md` : la mettre à jour).
  Codex coupe sans prévenir au-delà de 32 KiB cumulés sur la chaîne d'`AGENTS.md`.
- **`DESIGN.md`**, un par interface (à la racine, ou dans son app d'un monorepo), sur l'un des
  deux gabarits de `flow-design` (§ 0) : un site, tokens en tête ; une app à primitives maison,
  leur catalogue et ses recettes d'écran, tokens restés dans le code.
- Une feature trop riche pour quelques lignes (sous-domaines, socle commun) a sa carte dans
  `docs/<feature>.md`, citée depuis § Docs et skills.
- Jamais d'`ARCHITECTURE.md` ni d'arborescence fichier par fichier : le code la montre, elle
  dérive. Un `docs/<sujet>.md` se cite par son chemin, jamais en `@import`.
- Vérifier un `AGENTS.md` : `/doctor prompt-audit` (consignes contradictoires, périmées, fichier
  cité absent).
