# Architecture — web (Next.js App Router)

Le propre au web. Le commun (squelette, rangement, imports, verrous) : `archi.md` ; la base
(connexion, migrations, schéma, auth, fichiers) : `references/base.md`.

**Le site Next est le seul client de sa base** (Postgres + Drizzle) : il lit et écrit par l'accès
aux données et les Server Actions. Une app Expo lit ses données par l'API maison (`api.md`),
jamais par la base. Le front consomme une API externe déjà existante : la fonction qui l'appelle
prend la place de `<entité>.data.ts`, le reste ne bouge pas.

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
Le lint commun (`type: 'next'`, `setup.md` § ESLint) refuse `cloudflare:*` et
`@opennextjs/cloudflare` hors d'un `lib/`.

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

- Pas de try/catch par écran : le tableau est le filet. Deux exceptions, le catch d'une lecture
  (§ Données) et celui au bord d'une action (§ Actions) : ils avalent l'erreur, donc l'envoient
  eux-mêmes à Sentry.
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
  try {
    const rows = await db.select(INVOICE_COLUMNS).from(invoices)
      .where(eq(invoices.orgId, actor.orgId))
      .orderBy(desc(invoices.createdAt), desc(invoices.id)).limit(100)  // archi.md § Lectures
    return { invoices: rows.map(toInvoice), failed: false }
  } catch (error) {
    Sentry.captureException(error)             // avalée ici, donc envoyée ici
    return { invoices: [], failed: true }      // panne ≠ vide
  }
}
```

- Seuls `*.data.ts` et `lib/db/` parlent à la base (verrou 3 d'`archi.md` ; Better Auth, dans
  `lib/auth/`, y passe par son adapter) ; ils portent `import 'server-only'` et vérifient
  l'autorisation. Le lint voit l'ORM, pas une requête écrite sur la connexion reçue : hors d'un
  `.data.ts` ou de `lib/db/`, elle reste à la relecture.
- **L'org et l'identité arrivent par `actor`**, rendu par une garde de `lib/auth/` depuis la
  session, jamais par `params` ni par le client : sinon une URL ouvre un IDOR.
- **La connexion arrive en 1er paramètre**, jamais fabriquée sur place : c'est ce qui le rend
  testable sans mock de module.
- **Une lecture en panne** (`archi.md` § Lectures), côté consommateur : Server Component →
  `throw` avant tout `notFound()` ; endpoint → message générique.
- **Le DTO se construit par un littéral annoté champ par champ, jamais par spread** : le
  contrôle des propriétés excédentaires de TS ne s'exerce que sur un littéral direct.
- La liste des colonnes lues est une constante nommée, à un seul endroit. Jamais `db.select()`
  nu, qui lit toutes les colonnes.

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
'use server'                        // ⚠️ expose tous les exports de ce fichier
export async function updateInvoice(input: unknown) {
  const actor = await requireManager()               // 1. autorisation (garde, early-return)
  if (!actor.ok) return { error: 'Accès refusé' }
  const parsed = invoiceSchema.safeParse(input)      // 2. validation (<entité>.schema.ts)
  if (!parsed.success) return { error: 'Données invalides' }
  // 3. règle métier nécessitant une requête
  const res = await updateInvoiceRow(await getDb(), actor, parsed.data)  // 4. accès aux données
  if (res.failed) return { error: 'Enregistrement impossible' }       // 5. traduction
  refresh()                                                           // 6. revalidation (next/cache)
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
- **Rien n'est caché par défaut.** `'use cache'` (option `cacheComponents`, que `create-next-app`
  active) se lit dans la doc de la version installée avant d'en dépendre ; vinext ne le gère
  qu'en partie : `npx vinext check`, sinon couper l'option. Jamais de secret en clé ni en tag ;
  un scope caché ne lit ni cookies, ni headers, ni searchParams, même par un helper, et l'erreur
  peut passer le build.
- Ce qui doit être frais à chaque requête : `<Suspense>` + un composant non caché, jamais un
  cache à durée courte.
- **Le cache Next seulement sur une lecture sans dimension utilisateur** : une lecture par
  utilisateur ou par org mise en cache servirait les lignes de l'un à un autre. Pour elle :
  `cache()` de React dans un même rendu, + le streaming.

## Auth et sécurité

```text
proxy.ts               redirection optimiste par cookie  → confort, jamais une sécurité
action / handler       session + droits revérifiés       → la frontière
accès aux données      dernier filet, filtre par actor   → même si le handler se trompe
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
