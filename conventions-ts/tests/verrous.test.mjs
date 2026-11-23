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
import { conventions } from '../eslint.mjs';

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
