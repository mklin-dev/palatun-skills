// Le contrôle de la doc des agents (scripts/check-agents.sh), joué dans un dépôt posé sur le
// disque : un renvoi vers une section du paquet qui n'existe pas doit rougir, les autres non.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const PAQUET = path.resolve(import.meta.dirname, '..');

/** Un dépôt conforme, avec le paquet lié comme dans un projet, plus `fichiers`. */
function depot(fichiers) {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-agents-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(path.join(dir, '.agents/skills'), { recursive: true });
  mkdirSync(path.join(dir, '.claude/rules'), { recursive: true });
  symlinkSync(PAQUET, path.join(dir, '.agents/skills/conventions-ts'));
  symlinkSync(
    '../../.agents/skills/conventions-ts/SKILL.md',
    path.join(dir, '.claude/rules/conventions-ts.md'),
  );
  for (const [f, contenu] of Object.entries({ 'AGENTS.md': '# Projet\n', ...fichiers })) {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    writeFileSync(path.join(dir, f), contenu);
  }
  return dir;
}

/** Le code de sortie et la sortie du script, lancé comme un projet le lance. */
function controle(dir) {
  const r = spawnSync('sh', ['.agents/skills/conventions-ts/scripts/check-agents.sh'], {
    cwd: dir,
    encoding: 'utf8',
  });
  return { code: r.status, sortie: r.stdout + r.stderr };
}

test('renvois : une section du paquet qui existe passe, sous toutes les formes de citation', () => {
  const dir = depot({
    'docs/a.md': [
      'Apostrophe typographique : `.agents/skills/conventions-ts/archi.md` § Règle d’import et verrou.',
      'Coupé en fin de ligne (`.agents/skills/conventions-ts/archi.md` § Où je',
      'mets ce fichier).',
      'Titre abrégé : conventions-ts, `mobile.md` § Derrière notre API ; et le socle,',
      'conventions-ts `api-socle.md` § Serveur). Un point : `conventions-ts/api.md` § Verrous, 6.',
      'Le doc du projet, du même nom : conventions-ts, api.md § Erreurs ; docs/api.md § Chez nous.',
      'Un fichier qui n’est pas du paquet : conventions-ts, AGENTS.md § Git.',
    ].join('\n'),
    'src/a.ts': '// (conventions-ts, references/sentry.md § Les traces)\nexport {};\n',
    // Le references/ d'un autre skill, sur une ligne qui nomme aussi le paquet : pas le nôtre.
    'docs/b.md': 'Le brief : `references/relecture.md` § Format (verif-feature) ; le code : conventions-ts.\n',
    'docs/api.md': '## Chez nous\n\nSans mention du paquet : `api.md` § Rien de tel.\n',
    // Une migration appliquée ne se retouche plus : pas lue.
    'supabase/migrations/1.sql': '-- (conventions-ts, api.md § Une section partie)\nselect 1;\n',
  });
  const { code, sortie } = controle(dir);
  assert.equal(code, 0, sortie);
});

test('renvois : une section partie du paquet rougit, avec le fichier et la ligne', () => {
  const dir = depot({
    'docs/a.md': 'Ligne saine.\nVoir conventions-ts, api.md § Une section partie ; et la suite.\n',
    'src/b.ts': '// conventions-ts/web.md § Choisir le mode\nexport {};\n',
    'docs/c.md': 'Voir `.agents/skills/conventions-ts/absent.md` § Rien.\n',
    // Hors des docs et du code : une image, un jeu de données.
    Dockerfile: '# (conventions-ts, api.md § Serveur)\nFROM scratch\n',
    'db/seed.sql': '-- (`conventions-ts/api.md` § Jobs)\nselect 1;\n',
    // Un fichier parti du paquet, cité par son dossier.
    'docs/d.md': 'Voir conventions-ts, references/parti.md § Rien.\n',
    // Un titre du gabarit d’AGENTS.md, dans un bloc de code de setup.md : pas une section.
    'docs/e.md': 'Voir conventions-ts, setup.md § Organisation.\n',
  });
  const { code, sortie } = controle(dir);
  assert.equal(code, 1, sortie);
  assert.match(sortie, /docs\/a\.md:2 : api\.md § Une section partie/);
  assert.match(sortie, /src\/b\.ts:1 : web\.md § Choisir le mode/);
  assert.match(sortie, /docs\/c\.md:1 : absent\.md/);
  assert.match(sortie, /Dockerfile:1 : api\.md § Serveur/);
  assert.match(sortie, /db\/seed\.sql:1 : api\.md § Jobs/);
  assert.match(sortie, /docs\/d\.md:1 : references\/parti\.md/);
  assert.match(sortie, /docs\/e\.md:1 : setup\.md § Organisation/);
  assert.equal(sortie.match(/❌/g).length, 7, sortie);
});

test('renvois : un awk qui échoue arrête le contrôle, jamais un vert', () => {
  // Un renvoi sain : seul l'échec d'awk peut faire sortir le script autrement qu'à 0.
  const dir = depot({ 'docs/a.md': 'Voir conventions-ts, api.md § Verrous.\n' });
  const faux = path.join(dir, 'bin');
  mkdirSync(faux);
  writeFileSync(path.join(faux, 'awk'), '#!/bin/sh\ncase "$*" in *paquet=*) exit 2 ;; esac\nexec /usr/bin/awk "$@"\n', { mode: 0o755 });
  const r = spawnSync('sh', ['.agents/skills/conventions-ts/scripts/check-agents.sh'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${faux}:${process.env.PATH}` },
  });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /✅/);
});
