# Dépendances & sécurité — runbook pnpm

> Une procédure, pas une convention de code : `SKILL.md` § Dépendances & sécurité y renvoie.

## Checklist — dépôt déployé en production

Tout dépôt déployé en production. Un dépôt jamais déployé : rien d'exigé.

| # | Où | Réglage |
| --- | --- | --- |
| 1 | Settings → Advanced Security | Dependabot alerts **On**, Dependabot malware alerts **On** |
| 2 | Settings → Advanced Security | Security updates **On** : une PR de faille dès l'avis publié, testée par la CI de PR (skill `ci-setup`, règle 6) ; pas de Renovate |
| 3 | Bouton Watch du repo | Custom → **Security alerts** coché (sans watch, aucun mail) |
| 4 | `.github/dependabot.yml` | **présent**, `npm` (un bloc par workspace pnpm) et `github-actions` : PR groupées, au mois (`interval: monthly` ; une faille npm n'attend pas, réglage 2), cooldown 7 jours, `mineures` fusionnée seule si verte, `a-revoir` pour un humain ; rien ne fusionne seul là où un merge met en ligne ; `@palatun/*` dans `a-revoir`, jamais fusionné seul (le paquet s'exécute au commit de chaque développeur) |
| 5 | Tous les workflows | actions épinglées par SHA complet, version en commentaire (`@<sha> # v7.0.1`), montées par Dependabot `github-actions` |
| 6 | `pnpm-workspace.yaml` | `trustPolicy: no-downgrade` + `trustPolicyIgnoreAfter: 43200` ; chaque `overrides` / `audit.ignore` commenté |
| 7 | Compte GitHub → Settings → Notifications | **Actions** : email, workflows en échec seulement (sinon un workflow rouge passe en silence) ; **Dependabot alerts: New vulnerabilities** : email ; digest hebdo — une fois pour tous les repos |

Pas d'`audit.yml` là où les alertes Dependabot sont actives : elles remplacent le `pnpm audit` de
la CI. Sans elles (un dépôt d'équipe qui ne les active pas) : `audit.yml`, skill `ci-setup`
(`deps-audit.md`).

Vérifier un repo sans ouvrir l'UI (sauf les points 3 et 7, invisibles par l'API : REST `subscription` répond 404 et
GraphQL `viewerSubscription` null sur un Watch Custom réglé) :
`gh api repos/<o>/<r>/vulnerability-alerts -i` (204 = on) · `gh api "repos/<o>/<r>/dependabot/alerts?state=open"`.

**Non couvert, en connaissance de cause** : secrets poussés dans le code (secret scanning payant sur un repo privé) ;
failles des actions GitHub (une action épinglée par SHA n'a plus d'alerte) → seule sa montée de version par Dependabot
les rattrape.

## Routine

- **Chaque mois, ou dès qu'une alerte tombe** (une PR ou un commit par repo) :
  0. Chaque `audit.ignore` « aucun correctif publié » : `npm view <pkg> version` ; le correctif est sorti → retirer
     l'entrée et le monter (étape 1).
     Tenter de retirer chaque `overrides` de sécurité : supprimer la ligne, `pnpm install`, `pnpm audit`. Propre →
     il part (le parent a remonté sa version) ; sinon la remettre. Un override n'est jamais permanent.
  1. `pnpm audit --fix update` (prend la **plus petite** version corrigée). ⚠️ Repo à `catalog:` :
     il réécrit aussi des `package.json` (`catalog:` → version en dur) et monte des deps directes sans
     faille → tout annuler, passer par `pnpm update <paquet>` si le parent accepte la version
     corrigée, sinon par l'étape 3.
  2. Supprimer le bloc `minimumReleaseAgeExclude` qu'il ajoute au `pnpm-workspace.yaml`.
  3. Ce qui reste : le parent fige la version **exacte** (eas-cli : joi, nanoid, tar… ; miniflare : undici) → `overrides:` scopé par majeure, raison en commentaire.
  4. Correctif seulement en **majeure** (maplibre 5 → 6) : ce n'est pas un fix, c'est un chantier avec build et contrôle
     visuel. Dans l'outillage, sans risque pour l'app : classer l'alerte en *tolerable risk* avec sa raison
     (`gh api -X PATCH repos/<o>/<r>/dependabot/alerts/<n> -f state=dismissed -f dismissed_reason=tolerable_risk
     -f dismissed_comment=…`), sinon elle reste ouverte à vie et noie les nouvelles. High/critical en dépendance de
     prod : aussi dans `audit.ignore`, lu par le `pnpm audit` de l'étape 5.
     **Aucun correctif publié** (l'avis annonce une version absente du registre : `npm view <pkg> versions`) : même
     traitement, raison datée en commentaire, à retirer dès qu'il sort.
  5. `pnpm install`, `pnpm audit`, puis la vérif du repo (tests, build) avant de pousser.
- Workspace pnpm séparé = même geste dans son dossier.

## Détails et pièges

- Une faille acceptée : `audit.ignore` dans `pnpm-workspace.yaml` (pnpm ≥ 11.16 ; avant :
  `auditConfig.ignoreGhsas`), justifiée en commentaire. Jamais `--ignore-unfixable` (pnpm 11) : il
  sort toujours en 0 et réécrit le yaml, le garde-fou ne tombe jamais. Détail : `ci-setup`
  (`deps-audit.md`), s'il est installé. En plus : `audit.ignore` et
  `auditConfig.ignoreGhsas` présents ensemble → `auditConfig` ignoré avec un avertissement ; `pnpm audit --ignore
  <GHSA>` écrit encore l'ancienne clé : ne pas s'en servir.
- Un sous-workspace avec son propre `packageManager` garde SA version de pnpm : bumper les deux.
- **Supply-chain** (`trustPolicy`) :
  - Tourne à la résolution d'une version (`add`, `update`, `audit --fix`) et, **depuis pnpm 11.21 (« Verifying lockfile
    against supply-chain policies »)**, à chaque `install` sur le lockfile entier — les
    entrées de moins de 30 j seulement.
  - Compare par **date de publication, pas semver** : sans `IgnoreAfter`, un patch de vieille ligne publié après des
    versions à provenance (`semver@6.3.1`) est un faux positif ; 30 j = la fenêtre où un takeover compte.
  - `ERR_PNPM_TRUST_DOWNGRADE` sur un bump → lire l'historique des attestations du paquet (`_npmUser.trustedPublisher`,
    `dist.attestations` par version sur `registry.npmjs.org/<pkg>`). Régression sur **plusieurs** releases = l'éditeur a
    abandonné trusted publishing → `trustPolicyExclude` (glob `"@scope/*"` accepté), raison en commentaire. Régression
    **isolée** = le signal qu'on cherche : ne pas bumper, vérifier.
  - Sonder une version dans un dossier scratch : supprimer son lockfile entre deux passes, sinon un
    lockfile déjà à jour ne résout rien et rend un « OK » trompeur.
  - **`minimumReleaseAge`**, même vérification (pnpm 11.21, rien dans le yaml : délai de 24 h) : une entrée publiée depuis moins de 24 h fait échouer tout install neuf
    (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`), donc tous les builds de prod, sans alerte, jusqu'à 24 h après sa
    publication. Merger un bump de la veille après ce délai.
- **Overrides pnpm 11** : le champ `pnpm` de `package.json` est ignoré en silence (« Already up to
  date », même `--force`) → `overrides:` du `pnpm-workspace.yaml` du bon workspace. Scoper par
  majeure (`'path-to-regexp@0.1.12': 0.1.13`) ou par parent (`'miniflare>sharp': ^0.35.4`),
  jamais hors de la plage majeure attendue par le parent.
- `pnpm audit` lit la même base que Dependabot (GitHub Advisory) : chiffres identiques.
