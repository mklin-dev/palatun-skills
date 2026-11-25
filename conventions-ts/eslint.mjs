// Le lint commun de conventions-ts : ce qui est identique dans chaque projet (setup.md § ESLint).
// Publié dans le paquet @palatun/conventions-ts, jamais retouché dans un dépôt ; ce qui est propre
// au projet (TanStack Query, réglage du typed linting, bouton, le verrou 3 d'un projet sans
// `type`) reste dans son eslint.config, après conventions().
//
// `import`, `@typescript-eslint` et `react` viennent du preset (eslint-config-next ou
// eslint-config-expo), résolveur des alias `@/` compris ; l'arbre et les noms, des deux plugins du
// paquet, posés seulement avec `type`, comme le verrou 3, et en `api` les verrous de tRPC (api.md § Verrous, 1, 4 et
// 5). Le code serveur ajoute comportement() : le journal, Sentry,
// les erreurs levées et les directives.
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Les plugins se chargent à l'appel de structure() ou de comportement() seulement : un dépôt qui
// importe ce fichier à sa source, sans installer le paquet ni ses dépendances, garde les seuls
// verrous d'import.
const charger = createRequire(import.meta.url);

let plugin;
/**
 * Les règles natives, sous des noms à nous : en config plate, deux blocs qui posent la même règle
 * ne fusionnent pas (archi.md § Règle d'import et verrou), et les projets posent déjà
 * `no-restricted-imports` (et sa version `@typescript-eslint`) pour leur verrou 3,
 * `no-restricted-syntax` pour leurs formes : sous l'un de ces noms, le dernier bloc effacerait
 * l'autre, lint vert. Un seul objet : deux objets déclarés sous le même nom de plugin font échouer
 * ESLint.
 */
function local() {
  if (plugin) return plugin;
  const natives = charger('eslint/use-at-your-own-risk').builtinRules;
  const directives = charger('@eslint-community/eslint-plugin-eslint-comments').rules;
  plugin = {
    meta: { name: 'conventions-ts' },
    rules: {
      'no-restricted-imports': natives.get('no-restricted-imports'),
      acces: natives.get('no-restricted-imports'),
      console: natives.get('no-restricted-globals'),
      sentry: natives.get('no-restricted-imports'),
      catch: natives.get('no-restricted-syntax'),
      trpc: natives.get('no-restricted-syntax'),
      handler: natives.get('no-restricted-syntax'),
      bases: natives.get('no-restricted-imports'),
      'require-description': directives['require-description'],
      'no-unlimited-disable': directives['no-unlimited-disable'],
    },
  };
  return plugin;
}

const VERROU = "conventions-ts, archi.md § Règle d'import et verrou";
const VERROU_API = 'conventions-ts, api.md § Verrous';
const NOMMAGE = 'conventions-ts, SKILL.md § Nommage';
const PARTAGE = ['components', 'hooks', 'stores', 'utils', 'lib'];
const EXT = '{ts,tsx,js,jsx,mjs,cjs}';
// Ce qu'une feature range sous elle (archi.md § Squelette).
const DEDANS = '{components,hooks,lib}';

const PARENT = {
  regex: '^\\.\\.(/|$)',
  message: `hors du dossier courant, importer par @/ (${VERROU})`,
};
const CLOUDFLARE = {
  regex: '^(cloudflare:|@opennextjs/cloudflare(/|$))',
  message: 'Cloudflare reste dans un lib/ (conventions-ts, web.md § Cloudflare dans lib)',
};

// Verrou 3 : ce qui parle à la base ou à l'API, et les seuls fichiers qui le peuvent (depuis
// src/). Les paquets nus, et pour le proxy son alias ; la connexion (`@/lib/db`) se passe en
// paramètre, donc s'importe partout.
const base = (ou) => ({
  // `drizzle-orm/zod` tire un schéma d'une table sans toucher la base (api.md § Squelette).
  regex: '^(drizzle-orm(?!/zod(/|$))|pg)(/|$)',
  message: `la base (drizzle-orm, pg) seulement dans un .data.ts${ou} (${VERROU}, 3)`,
});
const ACCES = {
  next: {
    patterns: [base(' ou lib/db/')],
    permis: [`**/*.data.${EXT}`, 'lib/db/**'],
  },
  api: {
    patterns: [base('')],
    permis: [`**/*.data.${EXT}`],
  },
  expo: {
    patterns: [
      {
        regex: '^(@trpc/client|@trpc/tanstack-react-query|@/lib/trpc)(/|$)',
        message: `le proxy tRPC seulement dans un .queries.ts ou lib/ : un écran prend des queryOptions (${VERROU}, 3)`,
      },
    ],
    permis: [`**/*.queries.${EXT}`, 'lib/**'],
  },
};

// Les fichiers de convention de Next dans app/ (doc Next 16, § File-system conventions).
const NEXT_APP =
  '{page,layout,loading,error,global-error,global-not-found,not-found,forbidden,unauthorized,' +
  'template,default,route,opengraph-image,twitter-image,icon,apple-icon,sitemap,robots,manifest}';

/**
 * L'arbre d'un type, en motifs depuis src/ (archi.md § Squelette, api.md § Squelette) : un
 * fichier qu'aucun motif ne couvre est refusé. `utils/`, là où il reste, entre par `allow` : sa
 * présence sur le disque ne prouve rien, le premier fichier qu'on y pose le crée.
 */
function arbre(type) {
  const partage = '{components,hooks,stores,lib}/**';
  // __tests__/ : les tests co-localisés (SKILL.md § Tests).
  const dedans = '{components,hooks,lib,__tests__}/**';
  if (type === 'expo') {
    return [partage, 'app/**', 'features/*/*', `features/*/${dedans}`];
  }
  if (type === 'next') {
    // Une feature `layout` : la mise en page monte dans components/layout/. `!(layout)` seul
    // refuserait aussi `layouts/` (picomatch n'ancre la négation qu'en fin de motif).
    const feature = 'features/{!(layout),layout?*}';
    return [
      partage,
      `app/**/${NEXT_APP}.${EXT}`,
      'app/**/_*/**',
      '{instrumentation,instrumentation-client,proxy}.ts',
      'sentry.*.config.ts',
      `${feature}/*`,
      `${feature}/${dedans}`,
    ];
  }
  // api : deux niveaux au plus sous une feature, la ressource et ses fichiers.
  return [
    '{index,root,workers}.ts',
    '*.test.ts',
    '{trpc,lib}/**',
    'features/*/*',
    'features/*/*/*',
    'features/*/lib/**',
  ];
}

/**
 * @param {{ dir: string, src?: string, type?: 'expo' | 'next' | 'api', allow?: string[] }} options
 *   dir : le dossier de l'eslint.config qui appelle conventions() (import.meta.dirname, ou
 *   __dirname en CommonJS), qui porte `src/` et son tsconfig. Une config partagée par plusieurs
 *   apps le reçoit de chacune : process.cwd() change selon qui lance ESLint (éditeur, hook).
 *   src : le dossier qui porte app/, features/ et le partagé ; `.` pour un projet resté à la
 *   racine (archi.md § Squelette).
 *   type : l'arbre du projet en liste blanche, ses noms en kebab-case, `../` refusé, et le
 *   verrou 3 (la base dans les `*.data.ts`, le proxy tRPC dans les `*.queries.ts` : ACCES) ; sans
 *   lui, les seuls verrous 1 et 2.
 *   allow : les chemins propres au projet, depuis src/ (un dossier ou un motif), chacun avec sa
 *   raison dans la doc du projet.
 */
export function conventions({ dir, src = 'src', type, allow = [] } = {}) {
  if (type !== undefined && !['expo', 'next', 'api'].includes(type)) {
    throw new Error(`conventions-ts : type ${type} inconnu (expo, next ou api).`);
  }
  if (allow.length && !type) {
    throw new Error("conventions-ts : allow complète l'arbre d'un type ; sans type, aucun arbre.");
  }
  // À la racine, `app/` témoigne du bon dossier : `.` existerait partout, même pour un mauvais dir.
  const temoin = src === '.' ? 'app' : src;
  if (!dir || !existsSync(path.join(dir, temoin))) {
    throw new Error(
      `conventions-ts : ${dir}/${temoin} introuvable. dir = le dossier de l'eslint.config qui ` +
        "appelle conventions() : import.meta.dirname, ou __dirname en CommonJS ; src: '.' pour " +
        'un projet sans src/.',
    );
  }
  const sous = (d) => (src === '.' ? `./${d}` : `./${src}/${d}`);
  const racine = path.join(dir, src, 'features');
  const features = existsSync(racine)
    ? readdirSync(racine, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  // Le sens unique ne vise que les dossiers présents : un verrou sur un dossier absent ne tire
  // jamais et reste vert ; un dossier créé plus tard entre seul au prochain lint.
  const presents = (dossiers) =>
    dossiers.filter((d) => existsSync(path.join(dir, src, d))).map(sous);
  const sens = (target, from, message) =>
    target.length && from.length ? [{ target, from, message }] : [];

  const zones = [
    // Verrou 1 : une zone par feature, générée depuis le disque.
    ...features.map((f) => ({
      target: sous(`features/${f}`),
      from: sous('features'),
      except: [`./${f}`],
      message: `une feature n'importe pas une autre ; le commun monte dans le partagé (${VERROU})`,
    })),
    // Verrou 2 : le sens unique.
    ...sens(
      presents(PARTAGE),
      presents(['features', 'app']),
      `le partagé n'importe ni features/ ni app/ (${VERROU})`,
    ),
    ...sens(
      presents(['lib']),
      presents(['components', 'hooks', 'stores']),
      `lib/ n'importe que lib/, utils/ et des paquets (${VERROU})`,
    ),
    ...sens(
      presents(['features']),
      presents(['app']),
      `une feature n'importe jamais app/ (${VERROU})`,
    ),
    // Une route prend le point d'entrée d'une feature ou d'un de ses sous-domaines, jamais ce
    // qu'elle range dedans. Des motifs : la règle exige alors que tout `from` en soit un.
    ...sens(
      presents(['app']),
      presents(['features']).flatMap((f) => [`${f}/*/${DEDANS}/**`, `${f}/*/*/${DEDANS}/**`]),
      `une route prend d'une feature son point d'entrée, pas ses components/, hooks/ ni lib/ (${VERROU})`,
    ),
    // api, verrou 5 : le chemin d'une requête ne dépend d'aucune feature.
    ...(type === 'api'
      ? sens(
          presents(['trpc']),
          presents(['features']),
          `src/trpc/ n'importe aucune feature : le socle sert toutes les features (${VERROU_API}, 5)`,
        )
      : []),
  ];
  // À la racine, les seuls dossiers de l'app : ni les scripts ni les configs.
  const sources = src === '.' ? `{app,features,${PARTAGE.join(',')}}` : src;
  const fichiers = `${sources}/**/*.${EXT}`;

  return [
    {
      name: 'conventions-ts/verrous',
      files: [fichiers],
      // Aucune zone (un projet neuf, sans aucun des dossiers) : la règle refuse une liste vide.
      rules: zones.length
        ? { 'import/no-restricted-paths': ['error', { basePath: dir, zones }] }
        : {},
    },
    ...(type ? structure({ dir, src, type, allow, fichiers }) : []),
    {
      name: 'conventions-ts/promesses-et-types',
      files: ['**/*.{ts,tsx}'],
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: dir } },
      rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': [
          'error',
          { checksVoidReturn: { attributes: false } },
        ],
        // `typeof import('…')` reste permis : c'est la forme des mocks Vitest et Jest.
        '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
      },
    },
    {
      name: 'conventions-ts/jsx',
      files: ['**/*.{jsx,tsx}'],
      rules: { 'react/no-unescaped-entities': 'off' },
    },
  ];
}

/** Les blocs d'un type : l'arbre, les noms, les imports (archi.md § Règle d'import et verrou). */
function structure({ dir, src, type, allow, fichiers }) {
  const boundaries = charger('eslint-plugin-boundaries');
  const checkFile = charger('eslint-plugin-check-file');
  const S = src === '.' ? '' : `${src}/`;
  const propres = allow.flatMap((a) => {
    const p = a.replace(/\/+$/, '');
    return [p, `${p}/**`];
  });
  // Les déclarations de types (`*.d.ts`) à la racine de src/, dans tous les types.
  const motifs = [...arbre(type), '*.d.ts', ...propres];
  // api : pas de `../` refusé. Un paquet qui exporte ses sources n'a pas d'alias `@/` : le client
  // qui importe ses types le résoudrait chez lui (vu sur TypeScript 6).
  const imports = { expo: [PARENT], next: [PARENT, CLOUDFLARE], api: [] }[type];
  return [
    {
      // Un fichier hors de l'arbre est refusé ; le message de boundaries ne se règle pas : la
      // ligne de l'AGENTS.md du projet renvoie vers son arbre.
      name: 'conventions-ts/arbre',
      files: [fichiers],
      plugins: { boundaries },
      settings: {
        'boundaries/root-path': dir,
        'boundaries/files': motifs.map((m) => ({ category: 'arbre', pattern: `${S}${m}` })),
      },
      rules: { 'boundaries/no-unknown-files': 'error' },
    },
    {
      // check-file lit les chemins depuis le dossier courant : des motifs en `**/`, le bloc
      // borne la portée. app/ suit les noms imposés par le routeur.
      name: 'conventions-ts/noms',
      files: [fichiers],
      ignores: [`${S}app/**`],
      plugins: { 'check-file': checkFile },
      rules: {
        'check-file/filename-naming-convention': [
          'error',
          { [`**/*.${EXT}`]: 'KEBAB_CASE' },
          {
            ignoreMiddleExtensions: true,
            errorMessage: `{{ target }} : un nom en kebab-case (${NOMMAGE})`,
          },
        ],
        'check-file/folder-naming-convention': [
          'error',
          { '**/': 'KEBAB_CASE' },
          {
            ignoreWords: ['__tests__'],
            errorMessage: `{{ target }}/ : un nom en kebab-case (${NOMMAGE})`,
          },
        ],
      },
    },
    {
      // Le point d'entrée d'une route, en PascalCase (archi.md § Où je mets ce fichier), à la
      // racine d'une feature ou d'un de ses sous-domaines.
      name: 'conventions-ts/noms-point-d-entree',
      files: [`${S}features/**/*{Screen,Template}.tsx`],
      plugins: { 'check-file': checkFile },
      rules: {
        'check-file/filename-naming-convention': [
          'error',
          { '**/*.tsx': 'PASCAL_CASE' },
          { errorMessage: `{{ target }} : le point d'entrée en PascalCase (${NOMMAGE})` },
        ],
      },
    },
    ...(imports.length
      ? [
          {
            name: 'conventions-ts/imports',
            files: [fichiers],
            plugins: { 'conventions-ts': local() },
            rules: { 'conventions-ts/no-restricted-imports': ['error', { patterns: imports }] },
          },
        ]
      : []),
    {
      // Sous son nom à lui : le bloc des imports (`../`, Cloudflare) ne l'efface pas, ni le
      // verrou 3 qu'un projet garderait. Les tests simulent ou lisent la base.
      name: 'conventions-ts/acces',
      files: [fichiers],
      ignores: [
        ...ACCES[type].permis.map((p) => `${S}${p}`),
        `**/*.test.${EXT}`,
        '**/__tests__/**',
      ],
      plugins: { 'conventions-ts': local() },
      rules: { 'conventions-ts/acces': ['error', { patterns: ACCES[type].patterns }] },
    },
    ...(type === 'api' ? trpc({ S, fichiers }) : []),
    // Dans un lib/, Cloudflare est permis : le bloc répète le reste des motifs.
    ...(type === 'next'
      ? [
          {
            name: 'conventions-ts/imports-lib',
            files: [[fichiers, '**/lib/**']],
            plugins: { 'conventions-ts': local() },
            rules: { 'conventions-ts/no-restricted-imports': ['error', { patterns: [PARENT] }] },
          },
        ]
      : []),
  ];
}

// `@trpc/server` importé ou réexporté en valeur ; `import type` reste libre, `@trpc/server/http`
// aussi. Un fichier hors du parseur de TypeScript n'a pas d'`importKind` : tout y est valeur.
const TRPC_VALEUR =
  ":matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, ImportExpression)[source.value='@trpc/server']:not([importKind='type'], [exportKind='type'])";
const HANDLER = `un handler tient en un appel à son .data.ts, ({ ctx, input }) => fn(ctx.db, ctx.actor, input), sans bloc ni requête sur ctx.db ; une règle qui exige du code vit dans le .data.ts (${VERROU_API}, 4)`;
const HANDLER_FORMES = [
  // L'argument de `.query()` ou `.mutation()` : une flèche au corps d'un appel, rien d'autre.
  "CallExpression[callee.property.name=/^(query|mutation)$/] > :not(ArrowFunctionExpression[body.type='CallExpression']).arguments",
  // `ctx.db.select()`, `ctx['db'].execute()` : la connexion se passe au `.data.ts`, sans plus.
  "MemberExpression[object.type='MemberExpression'][object.object.name='ctx']:matches([object.property.name='db'], [object.property.value='db'])",
  // `({ ctx: { db } }) => db.select()` : le même accès, déstructuré.
  "ObjectPattern > Property:matches([key.name='db'], [key.value='db'])",
];

/**
 * Les verrous de tRPC (api.md § Verrous, 1 et 4) ; le 5, `trpc/` sans feature, est une zone de
 * conventions(). Des règles natives sous des noms à nous, comme local() l'explique.
 */
function trpc({ S, fichiers }) {
  const plugins = { 'conventions-ts': local() };
  return [
    {
      name: 'conventions-ts/trpc',
      files: [fichiers],
      ignores: [`${S}trpc/trpc.ts`],
      plugins,
      rules: {
        'conventions-ts/trpc': [
          'error',
          {
            selector: TRPC_VALEUR,
            message: `@trpc/server en valeur seulement dans src/trpc/trpc.ts : une action y prend sa base et TRPCError ; un type s'importe par import type (${VERROU_API}, 1)`,
          },
        ],
      },
    },
    {
      // Chaque fichier d'action : tout fichier d'une feature hors du SQL, des tests, des jobs et
      // de lib/ ; le routeur en est, il n'assemble que des actions.
      name: 'conventions-ts/handler',
      files: [`${S}features/**/*.${EXT}`],
      ignores: [`${S}**/*.{data,jobs,test}.${EXT}`, `${S}features/*/lib/**`],
      plugins,
      rules: {
        'conventions-ts/handler': [
          'error',
          ...HANDLER_FORMES.map((selector) => ({ selector, message: HANDLER })),
        ],
      },
    },
    {
      // Une procédure née ailleurs, puis réexportée par son fichier d'action, passerait le test de
      // l'arbre hors de la forme du handler. `TRPCError` et le type `Actor` restent libres.
      name: 'conventions-ts/bases',
      files: [`${S}**/*.{data,jobs}.${EXT}`, `${S}**/lib/**`],
      plugins,
      rules: {
        'conventions-ts/bases': [
          'error',
          {
            patterns: [
              {
                group: ['**/trpc/trpc', '**/trpc/trpc.*'],
                importNamePattern: '^(\\w+Procedure|createTRPCRouter)$',
                message: `une procédure naît dans son fichier d'action, jamais dans un .data.ts, un .jobs.ts ni un lib/ (${VERROU_API}, 4)`,
              },
            ],
          },
        ],
      },
    },
  ];
}

const OBSERVABILITE = 'lib/observability';
const JOURNAL = `le journal et Sentry passent par src/${OBSERVABILITE}/ (conventions-ts, references/api-socle.md § Observabilité)`;
// Un `.catch` qui ne lit pas l'erreur (`() => undefined`, `() => ''`) ou ne fait rien
// (`(e) => {}`) : la promesse rejetée s'éteint sans trace. Échappent au sélecteur, et restent à la
// relecture : `.catch(noop)`, `.then(ok, () => {})`, un paramètre lu nulle part.
const CATCH_MUET =
  "CallExpression[callee.property.name='catch'] > :function:matches([params.length=0], [body.type='BlockStatement'][body.body.length=0])";

/**
 * Les règles de comportement du code serveur (api.md § Verrous, 6), après conventions() dans le
 * lint de chaque paquet du serveur : le journal et Sentry par le seul `lib/observability/` du
 * paquet, une valeur levée est une `Error` (sa cause gardée dans un bloc `catch`), ni `catch`
 * vide ni `.catch` qui ignore l'erreur, une directive `eslint-disable` nomme sa règle, porte sa
 * raison et sert.
 * @param {{ dir: string, src?: string }} options comme conventions().
 */
export function comportement({ dir, src = 'src' } = {}) {
  if (!dir || !existsSync(path.join(dir, src))) {
    throw new Error(`conventions-ts : ${dir}/${src} introuvable (dir : comme conventions()).`);
  }
  const plugins = { 'conventions-ts': local() };
  const fichiers = `${src}/**/*.${EXT}`;
  return [
    {
      name: 'conventions-ts/journal',
      files: [fichiers],
      ignores: [`${src}/${OBSERVABILITE}/**`],
      plugins,
      rules: {
        // `checkGlobalObject` : `globalThis.console` aussi, que `no-console` laisse passer.
        'conventions-ts/console': [
          'error',
          { globals: [{ name: 'console', message: JOURNAL }], checkGlobalObject: true },
        ],
        'conventions-ts/sentry': [
          'error',
          { patterns: [{ group: ['@sentry/*'], message: JOURNAL }] },
        ],
      },
    },
    {
      name: 'conventions-ts/erreurs',
      files: [`${src}/**/*.{ts,tsx}`],
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: dir } },
      rules: {
        // Une chaîne ou un objet levé perd sa pile. Un `unknown` se relève tel quel : l'erreur
        // attrapée, ou celle qu'un traducteur reçoit et ne traduit pas.
        '@typescript-eslint/only-throw-error': ['error', { allowThrowingAny: false }],
        '@typescript-eslint/prefer-promise-reject-errors': 'error',
        // Un `return promesse` dans un `try` échappe à son `catch` ; ailleurs, libre.
        '@typescript-eslint/return-await': ['error', 'error-handling-correctness-only'],
      },
    },
    {
      name: 'conventions-ts/catch',
      files: [fichiers],
      plugins,
      rules: {
        // Une `Error` native levée dans un bloc `catch` garde sa cause, `catch {}` sans paramètre
        // compris. Le rappel d'un `.catch()` et une classe maison (`TRPCError`) lui échappent.
        'preserve-caught-error': ['error', { requireCatchParameter: true }],
        'no-useless-catch': 'error',
        // Un `catch` vide se justifie par un commentaire, qui le rend non vide.
        'no-empty': 'error',
        'conventions-ts/catch': [
          'error',
          {
            selector: CATCH_MUET,
            message:
              "un .catch lit l'erreur, puis la rapporte ou la relève avec sa cause ; un repli voulu porte sa directive et sa raison (conventions-ts, api.md § Verrous, 6)",
          },
        ],
      },
    },
    {
      name: 'conventions-ts/directives',
      files: [fichiers],
      plugins,
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: {
        'conventions-ts/require-description': 'error',
        'conventions-ts/no-unlimited-disable': 'error',
      },
    },
  ];
}
