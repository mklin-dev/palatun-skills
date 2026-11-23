# Architecture — web (Next.js App Router)

Le propre au web. Le commun (squelette, rangement, imports, verrous) : `archi.md`.

## Choisir le mode

**La question qui tranche : un client non serveur (navigateur, mobile) touche-t-il la base ?**

| | 🅐 Supabase direct | 🅑 Postgres / Neon + Drizzle |
| --- | --- | --- |
| Quand | oui, ou base partagée avec un mobile, ou realtime / storage / auth clés en main | non, l'app web est le seul client |
| Autorisation | RLS en base + garde dans chaque endpoint | dans l'accès aux données + garde dans chaque endpoint |
| Cache Next | aucun (le client lit les cookies) | possible sur les lectures sans dimension utilisateur |
| Migrations | outillage Supabase | `drizzle-kit` |

Même en 🅐, le front web lit et écrit par l'accès aux données et les Server Actions : l'accès
direct ne sert qu'au mobile et au realtime. Les deux modes écrivent donc le même code. Le front
consomme une API externe déjà existante : la fonction qui l'appelle prend la place de
`<entité>.data.ts`, le reste ne bouge pas.

## Fichiers propres au web

- La doc de la version installée : `node_modules/next/dist/docs/` (celle de l'app, en monorepo), à
  lire avant de coder du Next ;
  `agentRules: false` dans `next.config`, sinon `next dev` lancé sous un agent écrit un `AGENTS.md`
  et un `CLAUDE.md` dans l'app (vu sur next 16).
- `proxy.ts` et `instrumentation.ts` vivent au niveau de `app/` : **dans** `src/` si le projet en
  a un (laissés à la racine, ils ne sont jamais chargés, sans erreur), à la racine sinon.
  `proxy.ts` remplace `middleware.ts`, déprécié : même code, export `proxy`.
- `app/api/<ressource>/route.ts` : la surface HTTP publique (rare).
- `'use server'` en tête d'un `*.actions.ts`, jamais inline dans un composant : le suffixe dit
  au lecteur que chaque export est un endpoint public. L'inventaire ne se fie pas au nom, qu'un
  écart peut changer : `git grep --untracked -lE "['\"]use server['\"]" -- '*.ts' '*.tsx'` et
  `git ls-files -co --exclude-standard '*/route.ts'`, à relire avant d'en ajouter un. Sans
  ancre `^` : une action inline sur une ligne compte aussi, un commentaire coûte une lecture.

### Cloudflare dans lib

Tout code applicatif qui touche Cloudflare (connexion à la base, stockage, tout import de
`cloudflare:workers`) vit dans `lib/` ; les pages et les Server Actions restent du Next
standard. Passer de Workers à un VPS tient alors en une PR (déduction) : `lib/` réécrit,
`wrangler.jsonc`, `vite.config.ts`, `worker/index.ts` et `public/_headers` retirés.
Le verrou `no-restricted-imports` bannit `cloudflare:workers` hors de `lib/`.

## Rendu

- `params` et `searchParams` sont des promesses : les `await`.
- `use()` lit une promesse venue d'un Server Component ou mise en cache, jamais un `fetch` créé
  au rendu.
- **`app/` compose, il ne décide pas.** Dès qu'une projection résout un choix, filtre, applique
  un repli ou porte un drapeau d'échec, elle descend dans un module pur de la feature. Le chrome
  de layout dans `app/` reste légitime.

## Erreurs et chargement

| Cas | Quoi | Sentry |
| --- | --- | --- |
| Refus attendu (droits, saisie, échec prévu) | valeur de retour `{ error }`, affichée | ❌ |
| Imprévu côté serveur (page, action, route, proxy) | rien : `onRequestError` l'envoie | ✅ |
| Imprévu au rendu | `error.tsx` par section, bouton « Réessayer » | ✅ `captureException` |
| Layout racine cassé | `global-error.tsx`, avec son `<html>` et son `<body>` | ✅ `captureException` |
| Contenu absent | `notFound()` → `not-found.tsx` | ❌ |
| Une partie attend sa donnée | `<Suspense>` au plus près, avec son squelette | — |
| Rien à montrer sans donnée | `loading.tsx` : squelette de la page | — |

- Pas de try/catch par écran : le tableau est le filet. Seule exception, le catch au bord d'une
  action (§ Actions) : il avale l'erreur, donc l'envoie lui-même à Sentry.
- `error.tsx` et `global-error.tsx` appellent `Sentry.captureException` dans un `useEffect` :
  une erreur attrapée par une boundary n'arrive pas seule à Sentry.
- `<Suspense>` par défaut : la frontière naît dans le Server Component qui attend, et le nœud
  descend en prop. `loading.tsx` remplace toute la page, à garder pour celle qui n'a rien sans
  ses données. Exception : une page prérendue servie par vinext sur Workers n'en a pas, sa
  coquille de chargement serait rendue à chaque préchargement.
- Squelette : `<feature>-skeleton.tsx` dans la feature, à la forme du contenu (rien ne saute à
  l'arrivée) ; ni spinner plein écran, ni squelette générique.

## Données

L'accès aux données vit dans la feature : `features/<f>/<entité>.data.ts`. Ce que plusieurs
features lisent monte dans `lib/db/<entité>.ts`. Les deux suivent la même forme :

```ts
// features/invoices/invoices.data.ts
import 'server-only'          // ← 1re ligne, toujours

export type InvoicesRead = { invoices: Invoice[]; failed: boolean }

export async function listInvoices(db: Db, actor: Actor): Promise<InvoicesRead> {
  const { data, error } = await db.from('invoices').select(SAFE_COLUMNS).eq('org_id', actor.orgId)
    .order('created_at', { ascending: false }).limit(100)  // liste : archi.md § Lectures
  if (error) return { invoices: [], failed: true }        // panne ≠ vide
  return { invoices: data.map(toInvoice), failed: false }
}
```

- Seuls `*.data.ts` et `lib/db/` parlent à la base (verrou 3 d'`archi.md`, avec `lib/auth/`
  pour le client de session) ; ils portent `import 'server-only'` et vérifient l'autorisation.
- **L'org et l'identité arrivent par `actor`**, rendu par une garde de `lib/auth/` depuis la
  session, jamais par `params` ni par le client : sinon, en 🅑 sans RLS, une URL ouvre un IDOR.
- **La connexion arrive en 1er paramètre**, jamais fabriquée sur place : c'est ce qui le rend
  testable sans mock de module.
- **Une lecture en panne** (`archi.md` § Lectures), côté consommateur : Server Component →
  `throw` avant tout `notFound()` ; endpoint → message générique.
- **Le DTO se construit par un littéral annoté champ par champ, jamais par spread** : le
  contrôle des propriétés excédentaires de TS ne s'exerce que sur un littéral direct.
- La liste des colonnes lues est une constante nommée, à un seul endroit. Jamais `select('*')`.

### Rafraîchir sans écriture

- Une page qui doit suivre l'état (tableau de bord) : un petit composant client appelle
  `router.refresh()` (`next/navigation`) au retour sur l'onglet (`visibilitychange`), et au
  besoin sur un intervalle d'au moins 60 s tant que l'onglet est visible. Les Server Components
  relisent leurs données ; l'état client (sélection, scroll) reste.
- Un bouton « Rafraîchir » fait le même appel.
- TanStack Query : `SKILL.md` § TanStack Query.
- Après une écriture : la revalidation de l'action (§ Actions), jamais un `router.refresh()`
  côté client.

## Actions et surface publique

| | Server Action | Route Handler |
| --- | --- | --- |
| Mutation depuis **son propre** front | ✅ le défaut | ❌ |
| Webhook, OAuth callback, appel d'un tiers | ❌ | ✅ |
| Réponse non HTML (fichier, flux), travail parallèle | ❌ | ✅ |

Ne jamais fetcher son propre Route Handler depuis un Server Component : on appelle la donnée.

`features/<f>/<entité>.actions.ts` porte toutes les fonctions `'use server'` de l'entité, dans
cet ordre strict :

```ts
'use server'                        // ⚠️ expose TOUS les exports de ce fichier
export async function updateInvoice(input: unknown) {
  const actor = await requireManager()               // 1. autorisation (garde, early-return)
  if (!actor.ok) return { error: 'Accès refusé' }
  const parsed = invoiceSchema.safeParse(input)      // 2. validation (<entité>.schema.ts)
  if (!parsed.success) return { error: 'Données invalides' }
  // 3. règle métier nécessitant une requête
  const res = await updateInvoiceRow(await getDb(), actor, parsed.data)  // 4. accès aux données
  if (res.failed) return { error: 'Enregistrement impossible' }       // 5. traduction
  updateTag(`invoices:${actor.orgId}`)                                // 6. revalidation
  return {}                                                           // 7. retour
}
```

- **Les gardes vivent dans `lib/auth/`, sans directive** : un helper posé dans un fichier
  `'use server'` deviendrait lui-même un endpoint appelable. Il rend une union discriminée.
- **L'IDOR ne se ferme pas au schéma** : prendre un ID + le changement, puis relire le reste
  depuis la session. Un `user_id` ne vient jamais du client.
- Les arguments sont désérialisés depuis le navigateur : typés `unknown`, `typeof` testé avant
  tout. Un objet `{ toString: () => '<uuid valide>' }` passe un test naïf.
- **Les refus attendus reviennent en `{ error }`** ; un throw imprévu rejette la promesse côté
  client et l'error boundary efface la saisie. D'où un catch au bord, qui appelle
  `unstable_rethrow` en premier (pour ne pas avaler une redirection), envoie l'erreur à Sentry,
  puis rend un message générique.
- `<form action={fn}>` se réinitialise à la fin de la transition, résultat ignoré : un
  formulaire pré-rempli passe par `onSubmit`.
- Lecture au clic (`'use server'` qui lit) : un état `loaded` distinct de `loading`, un
  `requestId` pour ignorer une réponse tardive, la garde `if (!loaded) return` dans la
  soumission. Les Server Functions partent en série : à réserver aux données sensibles.
- Revalidation : `updateTag` dans une Server Action (même réponse HTTP) · `revalidateTag(tag,
  profil)` depuis un webhook ou un Route Handler · `refresh()` de `next/cache` dans une Server
  Action pour rafraîchir le routeur. **Jamais avant un retour d'erreur.**

## Cache

- Les paliers (référence, standard, volatile, écriture) : `archi.md` § Fraîcheur.
- **Page statique** pour un contenu qui ne change qu'au déploiement (vitrine, page de marque) :
  `generateStaticParams` sur la route dynamique, rendu au build, servi par le CDN.
- **Rien n'est caché par défaut** : `cacheComponents` dans la config (avec `partialPrefetching:
  true`, sinon un warning), puis `'use cache'` dans chaque scope, avec un `cacheLife` explicite ;
  jamais de secret en clé ni en tag.
- `'use cache'` remplace `unstable_cache`, sauf pour une donnée qui doit survivre à un
  déploiement.
- ⚠️ Un scope caché ne peut pas lire cookies, headers ni searchParams, même via un helper appelé
  plus bas, et l'erreur peut passer le build.
- Ce qui doit être frais à chaque requête : `<Suspense>` + un composant non caché, jamais un
  cache à durée courte.
- ⚠️ vinext ne gère `'use cache'` qu'en partie, alors que `create-next-app` active
  `cacheComponents` : `npx vinext check` avant d'en dépendre, sinon couper l'option. En prod,
  brancher son adaptateur KV et/ou CDN (cache en mémoire par défaut).
- 🅐 **aucun cache Next** : une lecture filtrée par RLS mise en cache servirait les lignes d'un
  utilisateur à un autre. À la place : `cache()` de React dans un même rendu, + le streaming.
- 🅑 cache possible sur les seules lectures sans dimension utilisateur.

## Auth et sécurité

```text
proxy.ts               redirection OPTIMISTE par cookie  → confort, jamais une sécurité
action / handler       session + droits revérifiés       → LA frontière
RLS (🅐) / données (🅑)  dernier filet                    → même si le handler se trompe
```

- Le proxy n'est pas un gate : les Server Functions sont des POST sur la route qui les utilise,
  un matcher ne les couvre pas. Il reste léger : redirections, rewrites, lecture de cookie ; ni
  requête base, ni appel externe.
  Matcher à exclusion explicite (assets, images, statiques).
- `import 'server-only'` en tête de tout module qui touche un secret ou une clé serveur, pas
  seulement les données : son import côté client casse le build. `NEXT_PUBLIC_*` part dans le
  bundle client : jamais un secret.
- Headers à coût nul : `X-Content-Type-Options: nosniff`, `Referrer-Policy`, et les 4 directives
  CSP sans nonce (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`). Un CSP à nonce force le rendu dynamique de toutes les pages : vitrine →
  CSP statique ; app à données personnelles → nonce, en assumant le coût.
- **Plusieurs instances** (VPS, répliques) : la clé de chiffrement des Server Actions a la même
  valeur partout, sinon « Failed to find Server Action » aléatoire, en prod seulement. Déclarer
  aussi les origines autorisées derrière un reverse-proxy.

## 🅐 Supabase direct

- Cookies : `getAll()` / `setAll()` seulement. ⚠️ `setAll` reçoit un 2e argument lors d'un
  refresh, qui doit être appliqué à la réponse : l'oublier fait fuiter une session via le CDN.
- **`getClaims()` établit l'identité, jamais `getSession()`** côté serveur ; l'envelopper dans
  `cache()` de React.
- Deux clients serveur, jamais interchangeables : celui des Server Components et Actions écrit
  dans `next/headers` (try/catch vide : écrire pendant le rendu jette), celui du proxy écrit dans
  la réponse. Le second ne se construit pas depuis le premier. **Rien entre la création du client
  et la lecture des claims**, sinon des déconnexions aléatoires.
- Le rôle applicatif vient d'une table, jamais des métadonnées utilisateur (que l'utilisateur peut
  écrire). L'utilisateur n'écrit jamais sa propre ligne de rôle (sinon il s'élève) ; la fonction,
  le schéma et les GRANT : skill `supabase`, s'il est installé.
- « RLS activée » ≠ « bornée » : sous une policy `using (is_admin())` sans clause de ligne, le
  `.eq()` du code est la seule borne, et un test y est obligatoire. RLS et GRANT sont deux
  contrôles distincts.
- « Côté serveur, donc client privilégié puis filtre en JS » contourne la RLS : le client
  privilégié reste banni (`archi.md`, verrou 3).
- Clés publishable / secret sur les nouveaux projets, signature asymétrique du JWT.
- Storage : le chemin est le bornage, dérivé des claims, jamais du formulaire ; bucket privé + URL
  signée ; le type se lit dans les octets, jamais dans le type déclaré (un SVG annoncé PNG est un
  XSS stocké) ; la colonne stocke le chemin.

## 🅑 Postgres / Neon + Drizzle

- Connexion selon l'hébergement :
  - **Workers** : Hyperdrive + `pg`, un client par requête (workerd réserve l'I/O au contexte
    d'une requête) ; Hyperdrive reçoit la chaîne directe de
    Neon (pooling décoché), rôle dédié, binding par `import { env } from 'cloudflare:workers'`.
    ⚠️ Hyperdrive cache les SELECT 60 s : `wrangler hyperdrive update <id> --caching-disabled`,
    sauf choix écrit. Ni Postgres.js avec Drizzle, ni le driver serverless de Neon.
  - **VPS (Node)** : un Pool TCP au niveau module (sur l'URL poolée seulement si la base reste
    sur Neon), `max` explicite, `pool.on('error')` obligatoire
    (sinon crash du process), garde `globalThis` pour le hot-reload. Base sur le VPS plutôt que
    Neon : chaque requête paierait l'aller-retour (skill `infra`).
- `drizzle-kit` et les scripts prennent l'URL directe ; `.env` chargé explicitement hors Next.
- Auth : Better Auth en lib, adapter Drizzle, tables dans la base du projet (un `pg_dump`
  l'emporte). **Pas l'auth gérée par Neon**, même GA en UE : ni plugins, ni
  hooks, ni options, et elle lie l'app à Neon ; ne pas la re-proposer. Sur Workers, le hachage de
  Better Auth peut dépasser les 10 ms de CPU de l'offre gratuite (déduction) → Workers Paid.
- Fichiers : R2, bucket en juridiction `eu` (choisie à la création) ; mêmes règles que le storage 🅐.
- Migrations : `push` en local seulement ; partagé → `generate` + `migrate`, SQL commité, script
  `db:migrate` réellement appelé.
- Schéma : PK `uuid` générée en base, timestamps avec timezone, `onDelete: cascade`, colonne de
  tenant sur chaque table métier, unicité préfixée par le tenant, FK indexées. Une contrainte
  unique sur une colonne nullable n'empêche rien (deux NULL passent).
- Idempotence : la contrainte unique en base garantit le non-doublon ;
  `insert().onConflictDoNothing({ target }).returning()` puis relire si vide. Dans une
  transaction, seulement l'objet de transaction.
- RLS pas par réflexe : sans client non serveur, elle duplique la logique d'accès. Data API
  inutilisée → la couper.
- Derrière un pooler en mode transaction, pas de prepared statements (panne en prod seulement).

## UI et styles

- Tailwind CSS-first : un `@import`, la config dans `@theme`. ⚠️ Un fichier de config JS n'est
  plus auto-détecté : sans directive `@config` explicite, il est ignoré et les tokens
  disparaissent.
- shadcn : pas de commande de mise à jour ; `add <composant> --diff` puis `--overwrite`, git en
  filet, pas d'outil maison. La primitive se fige à l'init : pas de migration de primitive sur un
  projet vivant. `lib/utils.ts` (`cn()`) reste où l'outil l'écrit.
- Images sous vinext / Workers : le binding Cloudflare Images remplace Sharp (compteur de
  variantes par compte, aucun cache, `formats` jamais lu, `public/_headers` obligatoire).
  `next dev` (Sharp) ne montre pas le rendu réel : une image se juge sur le Worker déployé.
  vinext refuse une qualité d'image non déclarée : déclarer celles qu'on utilise.

## Tests et observabilité

- Un Server Component async ne se teste pas en unitaire → E2E. Se testent : schémas, fonctions
  pures, l'accès aux données (connexion injectée), composants client.
- Alias `server-only` / `client-only` vers un module vide dans la config de test.
- Observabilité : instrumentation client, serveur (`register` et `onRequestError`),
  `global-error.tsx`, wrapper de build pour les sourcemaps ; le reste → `SKILL.md`.
