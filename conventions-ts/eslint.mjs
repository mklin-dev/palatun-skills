// Le lint commun de conventions-ts : ce qui est identique dans chaque projet (setup.md § ESLint).
// Copié avec le skill, jamais retouché dans un dépôt ; ce qui est propre au projet (verrou 3,
// TanStack Query, réglage du typed linting, bouton) reste dans son eslint.config, après
// conventions().
//
// Aucun plugin importé ici : `import`, `@typescript-eslint` et `react` viennent du preset
// (eslint-config-next ou eslint-config-expo), résolveur des alias `@/` compris.
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const VERROU = "conventions-ts, archi.md § Règle d'import et verrou";
const PARTAGE = ['components', 'hooks', 'stores', 'utils', 'lib'];

/**
 * @param {{ dir: string, src?: string }} options
 *   dir : le dossier de l'eslint.config qui appelle conventions() (import.meta.dirname, ou
 *   __dirname en CommonJS), qui porte `src/` et son tsconfig. Une config partagée par plusieurs
 *   apps le reçoit de chacune : process.cwd() change selon qui lance ESLint (éditeur, hook).
 *   src : le dossier qui porte app/, features/ et le partagé ; `.` pour un projet resté à la
 *   racine (archi.md § Squelette).
 */
export function conventions({ dir, src = 'src' } = {}) {
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

  const zones = [
    // Verrou 1 : une zone par feature, générée depuis le disque.
    ...features.map((f) => ({
      target: sous(`features/${f}`),
      from: sous('features'),
      except: [`./${f}`],
      message: `une feature n'importe pas une autre ; le commun monte dans le partagé (${VERROU})`,
    })),
    // Verrou 2 : le sens unique.
    {
      target: PARTAGE.map(sous),
      from: [sous('features'), sous('app')],
      message: `le partagé n'importe ni features/ ni app/ (${VERROU})`,
    },
    {
      target: sous('lib'),
      from: ['components', 'hooks', 'stores'].map(sous),
      message: `lib/ n'importe que lib/, utils/ et des paquets (${VERROU})`,
    },
    {
      target: sous('features'),
      from: sous('app'),
      message: `une feature n'importe jamais app/ (${VERROU})`,
    },
  ];
  // À la racine, les seuls dossiers de l'app : ni les scripts ni les configs.
  const sources = src === '.' ? `{app,features,${PARTAGE.join(',')}}` : src;

  return [
    {
      name: 'conventions-ts/verrous',
      files: [`${sources}/**/*.{ts,tsx,js,jsx,mjs,cjs}`],
      rules: { 'import/no-restricted-paths': ['error', { basePath: dir, zones }] },
    },
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
