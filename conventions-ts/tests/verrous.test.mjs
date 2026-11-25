// Chaque verrou du lint commun voit rougir sa faute : un projet posé sur le disque, un fichier
// fautif, le `ruleId` et un fragment du message. Joué par le workflow de publication du miroir :
// un verrou qui ne tire plus bloque la publication.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';
import { comportement, conventions } from '../eslint.mjs';

// Ce que le preset du projet apporte (eslint-config-next ou -expo) ; les blocs qui exigent le
// parseur TypeScript ou React ne posent aucun verrou et restent hors du banc.
const PRESET = {
  plugins: { import: importPlugin },
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  settings: { 'import/resolver': { node: { extensions: ['.ts', '.tsx', '.js'] } } },
};
const HORS_BANC = new Set(['conventions-ts/promesses-et-types', 'conventions-ts/jsx']);

/** Un projet temporaire : `fichiers` = chemin → contenu ; un dossier vide finit par `/`. */
function projet(fichiers) {
  const dir = mkdtempSync(path.join(tmpdir(), 'conventions-ts-'));
  for (const [f, contenu] of Object.entries(fichiers)) {
    const cible = path.join(dir, f);
    if (f.endsWith('/')) {
      mkdirSync(cible, { recursive: true });
      continue;
    }
    mkdirSync(path.dirname(cible), { recursive: true });
    writeFileSync(cible, contenu);
  }
  return dir;
}

/** Les messages d'ESLint sur `fichier`, avec la config de `conventions(options)`. */
async function lint(dir, fichier, options = {}, apres = []) {
  const config = conventions({ dir, ...options }).filter((b) => !HORS_BANC.has(b.name));
  const eslint = new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: [PRESET, ...config, ...apres],
  });
  const [resultat] = await eslint.lintFiles([path.join(dir, fichier)]);
  return resultat.messages;
}

/** La faute attendue : une seule, de `ruleId`, dont le message contient `fragment`. */
function rougit(messages, ruleId, fragment) {
  const vus = messages.filter((m) => m.ruleId === ruleId);
  assert.equal(vus.length, 1, `${ruleId} attendue une fois : ${JSON.stringify(messages)}`);
  assert.match(vus[0].message, new RegExp(fragment));
}

const zones = (options) =>
  conventions(options).find((b) => b.name === 'conventions-ts/verrous').rules[
    'import/no-restricted-paths'
  ][1].zones;

test('verrou 1 : une feature n’importe pas une autre', async () => {
  const dir = projet({
    'src/features/a/a.ts': "import { b } from '../b/b';\nexport const a = b;\n",
    'src/features/b/b.ts': 'export const b = 1;\n',
  });
  rougit(
    await lint(dir, 'src/features/a/a.ts'),
    'import/no-restricted-paths',
    "une feature n'importe pas une autre",
  );
});

test('verrou 2 : le partagé n’importe ni features/ ni app/', async () => {
  const dir = projet({
    'src/components/c.ts': "import { b } from '../features/b/b';\nexport const c = b;\n",
    'src/features/b/b.ts': 'export const b = 1;\n',
  });
  rougit(await lint(dir, 'src/components/c.ts'), 'import/no-restricted-paths', 'le partagé n');
});

test('verrou 2 : lib/ n’importe ni components/, ni hooks/, ni stores/', async () => {
  const dir = projet({
    'src/lib/l.ts': "import { c } from '../components/c';\nexport const l = c;\n",
    'src/components/c.ts': 'export const c = 1;\n',
  });
  rougit(await lint(dir, 'src/lib/l.ts'), 'import/no-restricted-paths', "lib/ n'importe que lib/");
});

test('verrou 2 : une feature n’importe jamais app/', async () => {
  const dir = projet({
    'src/features/a/a.ts': "import { r } from '../../app/r';\nexport const a = r;\n",
    'src/app/r.ts': 'export const r = 1;\n',
  });
  rougit(
    await lint(dir, 'src/features/a/a.ts'),
    'import/no-restricted-paths',
    "une feature n'importe jamais app/",
  );
});

test('verrou 2 : une route ne prend pas l’intérieur d’une feature', async () => {
  const dir = projet({
    'src/app/dedans.ts': "import { h } from '../features/a/hooks/use-a';\nexport const r = h;\n",
    'src/app/sous-domaine.ts':
      "import { c } from '../features/a/detail/components/c';\nexport const r = c;\n",
    'src/app/entree.ts':
      "import { A } from '../features/a/AScreen';\nimport { D } from '../features/a/detail/DetailScreen';\nimport { d } from '../features/a/a.data';\nexport const r = [A, D, d];\n",
    'src/app/lib.ts': "import { l } from '../features/a/lib/l';\nexport const r = l;\n",
    'src/features/a/hooks/use-a.ts': 'export const h = 1;\n',
    'src/features/a/lib/l.ts': 'export const l = 1;\n',
    'src/features/a/detail/components/c.ts': 'export const c = 1;\n',
    'src/features/a/detail/DetailScreen.ts': 'export const D = 1;\n',
    'src/features/a/AScreen.ts': 'export const A = 1;\n',
    'src/features/a/a.data.ts': 'export const d = 1;\n',
  });
  for (const f of ['src/app/dedans.ts', 'src/app/sous-domaine.ts', 'src/app/lib.ts']) {
    rougit(await lint(dir, f), 'import/no-restricted-paths', "une route prend d'une feature");
  }
  assert.deepEqual(await lint(dir, 'src/app/entree.ts'), []);
});

test('verrous morts : le sens unique ne vise que les dossiers présents, un neuf s’allume seul', () => {
  const dir = projet({ 'src/features/a/': '', 'src/lib/': '' });
  const vises = (z) => z.flatMap((zone) => [zone.target, zone.from].flat());
  assert.deepEqual(
    vises(zones({ dir })).filter((p) => /components|hooks|stores|utils|app/.test(p)),
    [],
  );
  mkdirSync(path.join(dir, 'src/components'));
  assert.ok(vises(zones({ dir })).includes('./src/components'));
});

/** Parmi `fichiers` (créés vides), ceux où `ruleId` tire. */
async function fautifs(fichiers, ruleId, options) {
  const dir = projet(Object.fromEntries(fichiers.map((f) => [f, 'export {};\n'])));
  const vus = [];
  for (const f of fichiers) {
    const messages = await lint(dir, f, options);
    if (messages.some((m) => m.ruleId === ruleId)) vus.push(f);
  }
  return vus;
}

test('sans type : les blocs et les règles d’avant', () => {
  const dir = projet({ 'src/features/a/a.ts': '' });
  assert.deepEqual(
    conventions({ dir }).map((b) => [b.name, Object.keys(b.rules)]),
    [
      ['conventions-ts/verrous', ['import/no-restricted-paths']],
      [
        'conventions-ts/promesses-et-types',
        [
          '@typescript-eslint/no-floating-promises',
          '@typescript-eslint/no-misused-promises',
          '@typescript-eslint/consistent-type-imports',
        ],
      ],
      ['conventions-ts/jsx', ['react/no-unescaped-entities']],
    ],
  );
});

test('un type inconnu, ou allow sans type : refusés au chargement', () => {
  const dir = projet({ 'src/': '' });
  assert.throws(() => conventions({ dir, type: 'nest' }), /type nest inconnu/);
  assert.throws(() => conventions({ dir, allow: ['services'] }), /sans type, aucun arbre/);
});

const ARBRE = 'boundaries/no-unknown-files';

test('arbre expo : hors de l’arbre, refusé', async () => {
  const refuses = ['src/foo.ts', 'src/services/s.ts', 'src/features/weather/domain/d.ts'];
  const vus = await fautifs(
    [
      'src/app/(tabs)/_layout.tsx',
      'src/components/ui/button.tsx',
      'src/lib/db/client.ts',
      'src/features/weather/WeatherScreen.tsx',
      'src/features/weather/hooks/use-forecast.ts',
      ...refuses,
    ],
    ARBRE,
    { type: 'expo' },
  );
  assert.deepEqual(vus, refuses);
  const [m] = await lint(projet({ 'src/foo.ts': '' }), 'src/foo.ts', { type: 'expo' });
  assert.match(m.message, /does not match any file pattern/);
});

test('arbre next : app/ en fichiers de convention et dossiers _privés, pas de feature layout', async () => {
  const refuses = [
    'src/middleware.ts',
    'src/app/blog/columns.tsx',
    'src/features/layout/header.tsx',
  ];
  const vus = await fautifs(
    [
      'src/app/(site)/page.tsx',
      'src/app/blog/[slug]/opengraph-image.tsx',
      'src/app/_lib/fetch.ts',
      'src/app/blog/_components/card.tsx',
      'src/instrumentation.ts',
      'src/sentry.server.config.ts',
      'src/swiper.d.ts',
      'src/features/shop/ShopTemplate.tsx',
      // Seule `layout` est refusée, pas une feature dont le nom commence par elle.
      'src/features/layouts/a.ts',
      'src/features/layout-builder/components/b.tsx',
      ...refuses,
    ],
    ARBRE,
    { type: 'next' },
  );
  assert.deepEqual(vus, refuses);
});

test('arbre api : deux niveaux sous une feature, presque rien à la racine', async () => {
  const refuses = ['src/server.ts', 'src/core/c.ts', 'src/features/team/members/roles/r.ts'];
  const vus = await fautifs(
    [
      'src/root.ts',
      'src/jobs.db.test.ts',
      'src/env.d.ts',
      'src/trpc/trpc.ts',
      'src/lib/mail/send.ts',
      'src/features/team/team.router.ts',
      'src/features/team/members/list.ts',
      'src/features/team/lib/shapes/member.ts',
      ...refuses,
    ],
    ARBRE,
    { type: 'api' },
  );
  assert.deepEqual(vus, refuses);
});

test('allow et __tests__/ : le propre au projet entre dans l’arbre, utils/ compris', async () => {
  // utils/ n'entre que par allow : un dossier créé par le fichier même qu'on lint serait admis.
  const propres = ['src/services/s.ts', 'src/features/a/services/b.ts', 'src/utils/u.ts'];
  const fichiers = [...propres, 'src/features/a/__tests__/a.test.ts'];
  assert.deepEqual(await fautifs(fichiers, ARBRE, { type: 'expo' }), propres);
  assert.deepEqual(
    await fautifs(fichiers, ARBRE, {
      type: 'expo',
      allow: ['services/', 'features/*/services', 'utils'],
    }),
    [],
  );
});

test('arbre d’un projet à la racine (src: ".")', async () => {
  const vus = await fautifs(['app/page.tsx', 'features/a/a.tsx', 'features/a/x/b.ts'], ARBRE, {
    src: '.',
    type: 'next',
  });
  assert.deepEqual(vus, ['features/a/x/b.ts']);
});

test('noms : kebab-case, le point d’entrée en PascalCase, app/ libre', async () => {
  const refuses = [
    'src/components/DroneCard.tsx',
    'src/features/weather/components/WeatherCard.tsx',
    'src/features/weather/WeatherCockpit.tsx',
    'src/features/weather/weatherScreen.tsx',
  ];
  const vus = await fautifs(
    [
      'src/components/drone-card.tsx',
      'src/lib/use-store.data.ts',
      'src/features/weather/WeatherScreen.tsx',
      'src/features/interventions/briefing/CosBriefingScreen.tsx',
      'src/features/shop/ShopTemplate.tsx',
      'src/features/weather/__tests__/weather.test.ts',
      'src/app/[id].tsx',
      ...refuses,
    ],
    'check-file/filename-naming-convention',
    { type: 'expo' },
  );
  assert.deepEqual(vus, refuses);
  rougit(
    await lint(projet({ 'src/components/Drone/d.ts': '' }), 'src/components/Drone/d.ts', {
      type: 'expo',
    }),
    'check-file/folder-naming-convention',
    'Drone/ : un nom en kebab-case',
  );
});

const IMPORTS = 'conventions-ts/no-restricted-imports';

test('../ hors du dossier : refusé, même dans un lib/ et sous un verrou 3 du projet', async () => {
  const dir = projet({
    'src/features/a/a.ts':
      "import { l } from '../../lib/l';\nimport { b } from './b';\nexport const a = l + b;\n",
    'src/features/a/b.ts': 'export const b = 1;\n',
    'src/lib/l.ts': "import { m } from '../lib/m';\nexport const l = m;\n",
    'src/lib/m.ts': 'export const m = 1;\n',
  });
  rougit(await lint(dir, 'src/features/a/a.ts', { type: 'expo' }), IMPORTS, 'importer par @/');
  rougit(await lint(dir, 'src/lib/l.ts', { type: 'next' }), IMPORTS, 'importer par @/');
  // Le verrou 3 d'un projet pose `no-restricted-imports` après conventions() : il ne l'efface pas.
  const verrou3 = { rules: { 'no-restricted-imports': ['error', { paths: ['pg'] }] } };
  rougit(
    await lint(dir, 'src/features/a/a.ts', { type: 'expo' }, [verrou3]),
    IMPORTS,
    'importer par @/',
  );
  // api : un paquet qui exporte ses sources n'a pas d'alias `@/` (celui du client le
  // résoudrait chez lui) ; `../` y reste.
  const surApi = (await lint(dir, 'src/features/a/a.ts', { type: 'api' })).filter(
    (m) => m.ruleId === IMPORTS,
  );
  assert.deepEqual(surApi, []);
});

test('next : Cloudflare hors d’un lib/ refusé, permis dedans, libre en expo', async () => {
  const cf =
    "import { env } from 'cloudflare:workers';\nimport o from '@opennextjs/cloudflare';\nexport const x = [env, o];\n";
  const dir = projet({ 'src/features/a/a.ts': cf, 'src/lib/cf.ts': cf });
  const sur = async (f, type) =>
    (await lint(dir, f, { type })).filter((m) => m.ruleId === IMPORTS).map((m) => m.message);
  const surA = await sur('src/features/a/a.ts', 'next');
  assert.equal(surA.length, 2);
  assert.match(surA[0], /Cloudflare reste dans un lib/);
  assert.deepEqual(await sur('src/lib/cf.ts', 'next'), []);
  assert.deepEqual(await sur('src/features/a/a.ts', 'expo'), []);
});

// Les verrous de tRPC (`type: 'api'`) : `import type` exige le parseur de TypeScript.
async function lintApi(fichiers, fichier, apres = []) {
  const dir = projet(fichiers);
  const config = conventions({ dir, type: 'api' }).filter((b) => !HORS_BANC.has(b.name));
  const eslint = new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: [
      PRESET,
      { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
      ...config,
      ...apres,
    ],
  });
  const [resultat] = await eslint.lintFiles([path.join(dir, fichier)]);
  return resultat.messages;
}

const TRPC = 'conventions-ts/trpc';
const HANDLER = 'conventions-ts/handler';
const BASES = 'conventions-ts/bases';
const sur = (messages, ruleId) => messages.filter((m) => m.ruleId === ruleId);

const ACCES = 'conventions-ts/acces';

test('verrou 3 : la base dans les .data.ts et lib/db/ (next), les .data.ts (api), tests compris', async () => {
  const sql = "import { eq } from 'drizzle-orm';\nimport { Pool } from 'pg';\nexport const x = [eq, Pool];\n";
  const dir = projet({
    'src/features/a/a.actions.ts': "import { pgTable } from 'drizzle-orm/pg-core';\nexport const t = pgTable;\n",
    'src/features/a/a.data.ts': sql,
    'src/features/a/a.data.test.ts': sql,
    'src/lib/db/client.ts': sql,
    'src/lib/auth/session.ts': "import { eq } from 'drizzle-orm';\nexport const s = eq;\n",
    'src/features/a/pg-utils.ts': "import { p } from './pg';\nexport const u = p;\n",
    'src/features/a/pg.ts': 'export const p = 1;\n',
    // Le schéma Zod tiré d'une table n'est pas un accès à la base (api.md § Squelette).
    'src/features/a/create.ts':
      "import { createInsertSchema } from 'drizzle-orm/zod';\nexport const s = createInsertSchema;\n",
    'src/features/a/__tests__/seed.ts': sql,
  });
  for (const type of ['next', 'api']) {
    rougit(await lint(dir, 'src/features/a/a.actions.ts', { type }), ACCES, 'la base');
    for (const f of [
      'src/features/a/a.data.ts',
      'src/features/a/a.data.test.ts',
      'src/features/a/pg-utils.ts',
      'src/features/a/create.ts',
      'src/features/a/__tests__/seed.ts',
    ]) {
      assert.deepEqual(sur(await lint(dir, f, { type }), ACCES), [], `${type} ${f}`);
    }
  }
  assert.deepEqual(sur(await lint(dir, 'src/lib/db/client.ts', { type: 'next' }), ACCES), []);
  rougit(await lint(dir, 'src/lib/auth/session.ts', { type: 'next' }), ACCES, 'la base');
  assert.equal(sur(await lint(dir, 'src/lib/db/client.ts', { type: 'api' }), ACCES).length, 2);
  // Sans type, et en expo : la base n'est pas son affaire.
  assert.deepEqual(sur(await lint(dir, 'src/features/a/a.actions.ts'), ACCES), []);
  assert.deepEqual(sur(await lint(dir, 'src/features/a/a.actions.ts', { type: 'expo' }), ACCES), []);
});

test('verrou 3 : le proxy tRPC dans les .queries.ts et lib/ (expo)', async () => {
  const dir = projet({
    'src/features/a/AScreen.tsx': "import { trpc } from '@/lib/trpc';\nexport const A = trpc;\n",
    'src/features/a/hooks/use-a.ts': "import { createTRPCClient } from '@trpc/client';\nexport const h = createTRPCClient;\n",
    'src/features/a/a.queries.ts': "import { trpc } from '@/lib/trpc';\nexport const q = trpc;\n",
    'src/lib/trpc.ts':
      "import { createTRPCClient } from '@trpc/client';\nimport { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';\nexport const trpc = [createTRPCClient, createTRPCOptionsProxy];\n",
  });
  const type = 'expo';
  for (const f of ['src/features/a/AScreen.tsx', 'src/features/a/hooks/use-a.ts']) {
    rougit(await lint(dir, f, { type }), ACCES, 'le proxy tRPC');
  }
  for (const f of ['src/features/a/a.queries.ts', 'src/lib/trpc.ts']) {
    assert.deepEqual(sur(await lint(dir, f, { type }), ACCES), [], f);
  }
  assert.deepEqual(sur(await lint(dir, 'src/features/a/AScreen.tsx', { type: 'next' }), ACCES), []);
});


test('api, verrou 1 : @trpc/server en valeur dans src/trpc/trpc.ts seulement', async () => {
  const fichiers = {
    'src/trpc/trpc.ts': "import { initTRPC } from '@trpc/server';\nexport const t = initTRPC;\n",
    'src/features/posts/by-id.ts':
      "import { TRPCError } from '@trpc/server';\n" +
      "import type { TRPCRouterRecord } from '@trpc/server';\n" +
      "export { initTRPC } from '@trpc/server';\n" +
      'export const r: TRPCRouterRecord = {};\nexport const e = TRPCError;\n',
    'src/lib/observability/http.ts':
      "import { getHTTPStatusCodeFromError } from '@trpc/server/http';\n" +
      'export const s = getHTTPStatusCodeFromError;\n',
  };
  const fautes = sur(await lintApi(fichiers, 'src/features/posts/by-id.ts'), TRPC);
  assert.equal(fautes.length, 2, JSON.stringify(fautes));
  assert.match(fautes[0].message, /seulement dans src\/trpc\/trpc\.ts/);
  assert.deepEqual(sur(await lintApi(fichiers, 'src/trpc/trpc.ts'), TRPC), []);
  assert.deepEqual(sur(await lintApi(fichiers, 'src/lib/observability/http.ts'), TRPC), []);
});

test('api, verrou 4 : un handler tient en un appel, une base ne naît que dans une action', async () => {
  const base = "import { orgProcedure } from '../../trpc/trpc.ts';\n";
  const fichiers = {
    'src/trpc/trpc.ts':
      'export const orgProcedure = {} as any;\nexport const sessionProcedure = {} as any;\n' +
      'export const createTRPCRouter = {} as any;\nexport class TRPCError extends Error {}\n' +
      'export type Actor = { orgId: string };\n',
    'src/features/posts/by-id.ts':
      base +
      "import { getPost } from './posts.data.ts';\n" +
      'export const a = orgProcedure.query(async ({ ctx }) => { return getPost(ctx.db); });\n' +
      'export const b = orgProcedure.query(({ ctx }) => ctx.db.select());\n' +
      'export const c = orgProcedure.mutation(({ ctx: { db } }) => getPost(db));\n',
    'src/features/posts/list.ts':
      base +
      "import { listPosts } from './posts.data.ts';\n" +
      'export const postsList = orgProcedure.query(({ ctx, input }) => listPosts(ctx.db, ctx.actor, input));\n',
    'src/features/posts/posts.data.ts':
      "import { TRPCError, sessionProcedure, type Actor } from '../../trpc/trpc.ts';\n" +
      'export const y = sessionProcedure.query(async () => { return 1; });\n' +
      'export const getPost = (db: unknown, a?: Actor) => { if (!db) throw new TRPCError(); return a; };\n' +
      'export const listPosts = getPost;\n',
    'src/features/posts/posts.jobs.ts': base + 'export const j = orgProcedure;\n',
    'src/features/posts/lib/shapes.ts': base + 'export const s = orgProcedure;\n',
    'src/lib/mail/send.ts':
      "import { createTRPCRouter } from '../../trpc/trpc';\nexport const m = createTRPCRouter;\n",
  };
  // Un bloc du projet qui pose les règles natives après conventions() ne les efface pas.
  const projetApres = [
    {
      rules: {
        'no-restricted-syntax': ['error', 'WithStatement'],
        'no-restricted-imports': ['error', 'pg'],
      },
    },
  ];
  const handler = sur(await lintApi(fichiers, 'src/features/posts/by-id.ts', projetApres), HANDLER);
  // Une faute par forme : le bloc, la requête sur ctx.db, ctx.db déstructuré.
  assert.deepEqual(
    handler.map((m) => m.line),
    [3, 4, 5],
    JSON.stringify(handler),
  );
  assert.match(handler[0].message, /un handler tient en un appel/);
  assert.deepEqual(await lintApi(fichiers, 'src/features/posts/list.ts'), []);
  for (const f of [
    'src/features/posts/posts.data.ts',
    'src/features/posts/posts.jobs.ts',
    'src/features/posts/lib/shapes.ts',
    'src/lib/mail/send.ts',
  ]) {
    const messages = await lintApi(fichiers, f, projetApres);
    assert.deepEqual(sur(messages, HANDLER), [], f);
    rougit(messages, BASES, 'une procédure naît dans son fichier d');
  }
});

test('api, verrou 5 : src/trpc/ n’importe aucune feature', async () => {
  const fichiers = {
    'src/trpc/trpc.ts': "import { x } from '../features/posts/posts.data.ts';\nexport const y = x;\n",
    'src/features/posts/posts.data.ts': 'export const x = 1;\n',
  };
  rougit(
    await lintApi(fichiers, 'src/trpc/trpc.ts'),
    'import/no-restricted-paths',
    "src/trpc/ n'importe aucune feature",
  );
  // Hors du type api, ni la zone ni les verrous de tRPC.
  const dir = projet(fichiers);
  assert.ok(!zones({ dir, type: 'expo' }).some((z) => z.message.startsWith('src/trpc/')));
  const blocs = conventions({ dir, type: 'expo' }).map((b) => b.name);
  assert.ok(!blocs.includes(TRPC) && !blocs.includes(HANDLER) && !blocs.includes(BASES));
});

// Les règles de comportement du serveur (`comportement()`) : typées, donc sous le parseur de
// TypeScript, avec le tsconfig d'un projet.
const TSCONFIG = JSON.stringify({
  compilerOptions: { strict: true, target: 'ES2022', module: 'preserve', types: [] },
  include: ['src'],
});

/** Les messages d'ESLint sur `fichier` sous `comportement()`, suivi des blocs `apres`. */
async function lintServeur(fichiers, fichier, apres = []) {
  const dir = projet({ 'tsconfig.json': TSCONFIG, ...fichiers });
  const eslint = new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        plugins: { '@typescript-eslint': tseslint.plugin },
      },
      ...comportement({ dir }),
      ...apres,
    ],
  });
  const [resultat] = await eslint.lintFiles([path.join(dir, fichier)]);
  return resultat.messages;
}

const regles = (messages) => messages.map((m) => m.ruleId).sort();

test('comportement : console et @sentry/* seulement dans lib/observability/', async () => {
  const source =
    "import * as Sentry from '@sentry/node';\n" +
    "console.error('a');\nglobalThis.console.warn('b');\nexport const s = Sentry;\n";
  const fichiers = {
    'src/features/a/a.ts': source,
    'src/lib/observability/logger.ts': source,
  };
  const attendues = ['conventions-ts/console', 'conventions-ts/console', 'conventions-ts/sentry'];
  const dehors = await lintServeur(fichiers, 'src/features/a/a.ts');
  assert.deepEqual(regles(dehors), attendues);
  assert.match(dehors.find((m) => m.ruleId === 'conventions-ts/console').message, /observability/);
  assert.deepEqual(await lintServeur(fichiers, 'src/lib/observability/logger.ts'), []);
  // Un bloc du projet qui pose les règles natives après comportement() ne l'efface pas.
  const projetApres = {
    rules: {
      'no-restricted-globals': ['error', 'event'],
      'no-restricted-imports': ['error', 'pg'],
      'no-restricted-syntax': ['error', 'WithStatement'],
    },
  };
  assert.deepEqual(
    regles(await lintServeur(fichiers, 'src/features/a/a.ts', [projetApres])),
    attendues,
  );
});

test('comportement : une Error levée, sa cause gardée, aucun catch muet', async () => {
  const fautes = [
    'export async function f(x: unknown): Promise<number> {',
    "  if (x === 1) throw 'non';",
    "  if (x === 2) return Promise.reject('non');",
    "  try { JSON.parse(String(x)); } catch (e) { throw new Error('illisible'); }",
    "  try { JSON.parse(String(x)); } catch { throw new Error('illisible'); }",
    '  try { JSON.parse(String(x)); } catch (e) { throw e; }',
    '  try { JSON.parse(String(x)); } catch {}',
    '  await Promise.resolve().catch(() => {});',
    '  await Promise.resolve().catch(() => undefined);',
    '  await Promise.resolve().catch((e: unknown) => {});',
    '  try { return Promise.resolve(1); } finally { JSON.parse(String(x)); }',
    '}',
  ].join('\n');
  assert.deepEqual(regles(await lintServeur({ 'src/a.ts': fautes }, 'src/a.ts')), [
    '@typescript-eslint/only-throw-error',
    '@typescript-eslint/prefer-promise-reject-errors',
    '@typescript-eslint/return-await',
    'conventions-ts/catch',
    'conventions-ts/catch',
    'conventions-ts/catch',
    'no-empty',
    'no-useless-catch',
    'preserve-caught-error',
    'preserve-caught-error',
  ]);
  const juste = [
    'declare function reportError(e: unknown): void;',
    // Un traducteur d'erreur relève ce qu'il ne traduit pas (api.md § Accès aux données).
    'export function traduire(e: unknown): never { throw e; }',
    'export async function f(x: unknown): Promise<number> {',
    "  if (x === 1) throw new Error('non');",
    "  try { JSON.parse(String(x)); } catch (e) { throw new Error('illisible', { cause: e }); }",
    '  try { JSON.parse(String(x)); } catch { /* un JSON illisible vaut une absence */ }',
    '  await Promise.resolve().catch((e: unknown) => reportError(e));',
    '  try { return await Promise.resolve(1); } finally { JSON.parse(String(x)); }',
    '}',
  ].join('\n');
  assert.deepEqual(await lintServeur({ 'src/a.ts': juste }, 'src/a.ts'), []);
});

test('comportement : une directive nomme sa règle, porte sa raison et sert', async () => {
  const sur = async (source) => lintServeur({ 'src/a.ts': source }, 'src/a.ts');
  const directive = '// eslint-disable-next-line conventions-ts/console';
  assert.deepEqual(regles(await sur(`${directive}\nconsole.log(1);\n`)), [
    'conventions-ts/require-description',
  ]);
  assert.deepEqual(await sur(`${directive} -- la trace du démarrage\nconsole.log(1);\n`), []);
  assert.deepEqual(regles(await sur('/* eslint-disable -- tout le fichier */\nconsole.log(1);\n')), [
    'conventions-ts/no-unlimited-disable',
  ]);
  const inutile = await sur('// eslint-disable-next-line no-empty -- rien à couper\nexport {};\n');
  assert.equal(inutile.length, 1);
  assert.equal(inutile[0].severity, 2);
  assert.match(inutile[0].message, /Unused eslint-disable directive/);
});
