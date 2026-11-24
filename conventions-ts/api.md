# Architecture — API maison (Hono + tRPC)

Une API servie à un client qui n'est pas un serveur (app Expo, front web). Le commun (squelette,
rangement, imports, verrous) : `archi.md` ; le client mobile : `mobile.md`.

**Quand** : le backend d'une app mobile reste Supabase direct (`mobile.md`) ; une API maison
quand Supabase est exclu, hébergeur européen exigé ou sous-traitant américain refusé. Elle tourne
alors sur le VPS, pas sur Workers (skill `infra` : `choisir-hebergement.md`, `vps/stack.md`
§ Clients publics).

## La stack

| Rôle | Outil | Pourquoi |
| --- | --- | --- |
| Serveur HTTP | Hono sur Node (`@hono/node-server`) | porte l'auth et tRPC ; le même code tourne sur Workers |
| Contrat | tRPC v11 | le contrat typé le plus utilisé ; types de bout en bout, sans génération |
| Base | Drizzle + `pg` | `web.md` § 🅑 (connexion, migrations, schéma) |
| Auth | Better Auth en lib | `web.md` § 🅑 ; plugin Expo officiel |
| Validation | Zod v4 | `SKILL.md` § Zod |
| Jobs | pg-boss | file et cron dans la base de l'API, sans Redis (§ Jobs) |

- Montent ensemble, à la dernière de leur ligne : les `@trpc/*` (peers exacts) ; `better-auth`,
  `@better-auth/*` et le CLI `auth`, qui publient souvent des correctifs de sécurité.
- Node : la LTS active.

## Squelette

```text
apps/
├── mobile/      l'app Expo (mobile.md)
└── api/         Hono : monte Better Auth, tRPC, la santé et les webhooks, rien d'autre
packages/
├── api/         tRPC, l'arbre ci-dessous
├── auth/        config Better Auth, serveur seulement (l'app crée son client)
├── db/          schéma Drizzle, client, migrations SQL commitées
└── validators/  schémas Zod lus par l'app ET l'API (formulaire et input)
```

- La forme vient de create-t3-turbo ; ses versions, figées depuis 2025-12, ne se copient pas
  (vérifié le 2026-11-13).
- Le monorepo est permis : deux apps partagent le type du routeur (`archi.md` § Interdits).
- Un schéma Zod qui sert une seule procédure reste inline, dans son fichier d'action ; partagé
  par plusieurs, dans le `lib/` de la feature. `packages/validators` n'importe
  jamais `packages/db` (l'app le lit) : ses schémas s'écrivent en Zod.
- Un schéma inline de l'API qui suit une table se dérive sans la colonne de tenant, que la table
  exige : `createInsertSchema(posts).omit({ id: true, orgId: true, createdAt: true })` ; l'org
  vient d'`actor`, jamais de l'input (vu sur drizzle-zod 0.8).
- L'app Expo dans le monorepo : `mobile.md` § Tests, build et EAS.

`packages/api/src` : un dossier par ressource, un fichier par action, presque rien à la racine :

```text
packages/api/src/
├── index.ts  root.ts  workers.ts   les exports du paquet, appRouter (une clé par feature), § Jobs
├── trpc/                           le socle : trpc.ts (contexte, bases de procédure), l'identité,
│                                   l'appartenance, le helper SQL, l'aide des tests
├── lib/<sujet>/                    les adaptateurs : storage/ (S3), mail/, push/, jobs/
└── features/<feature>/             même nom que la feature de l'app
    ├── <feature>.router.ts         l'assemblage seul
    ├── <action>.ts                 une action de l'entité principale : input, base, handler
    ├── <feature>.data.ts           leur SQL, partagé entre actions
    ├── <ressource>/                une sous-ressource : ses <action>.ts, son .data.ts, ses tests
    └── lib/                        ce qui n'est pas une action : Zod partagé, formes, logique pure
```

- **Le lint tient cet arbre** en liste blanche (`type: 'api'`, § Verrous, 3) ; le code fait foi.
- **La clé suit le chemin** : kebab-case sur le disque, camelCase en clé (`members/set-role.ts`
  → `team.members.setRole`) ; l'export, seul dans son fichier, reprend la clé
  (`teamMembersSetRole`) ; le verbe seul, le dossier dit la ressource. Un test le tient (§ Tests).
- **Deux niveaux au plus** sous une feature. Une feature de moins de 6 procédures sans ressource
  naturelle garde ses actions à sa racine ; ses ressources reprennent les sous-features de l'app.
- Les suffixes gardent leur rôle (`.data.ts`, `.jobs.ts`, `.test.ts`, `.db.test.ts`) : un nom nu
  est toujours une action. Ni `index.ts` de re-export, ni alias.
- Le SQL reste hors du fichier d'action, dans le `.data.ts` de sa ressource : le verrou 3
  d'`archi.md` repose sur ce suffixe, et une requête sert souvent plusieurs actions.
- Le lint commun isole chaque feature comme une feature d'app, et `lib/` comme le partagé
  (§ Verrous).
- Un projet né avant cet arbre (2026-11-22) le garde jusqu'à son propre passage, une feature par
  commit, la feature de référence d'abord.
- **La feature de référence** : l'`AGENTS.md` du projet en nomme une, complète (routeur,
  actions, `.data.ts`, tests ; côté app, `.queries.ts`) ; une nouvelle feature la copie. Une
  règle du projet qui change la corrige dans la même PR ; en écart avec ce skill, le skill prime,
  et la feature se corrige dans la PR qui le voit.

## Procédures

```ts
// packages/api/src/trpc/trpc.ts — `t` reste privé : en sortent le routeur, ces bases et `TRPCError`
const t = initTRPC.context<Context>().create({ transformer: superjson, errorFormatter })
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = publicProcedure.use(requireSession)  // UNAUTHORIZED
export const orgProcedure = protectedProcedure.use(requireMember)      // FORBIDDEN, pose ctx.actor

// packages/api/src/features/posts/by-id.ts — une procédure, l'export d'après sa clé
export const postsById = orgProcedure
  .input(z.object({ id: z.uuid() }))
  .query(({ ctx, input }) => getPost(ctx.db, ctx.actor, input.id))

// packages/api/src/features/posts/create.ts
export const postsCreate = orgProcedure
  .input(createPostSchema)                    // de packages/validators : le formulaire le lit
  .mutation(({ ctx, input }) => createPost(ctx.db, ctx.actor, input))

// packages/api/src/features/posts/posts.router.ts — l'assemblage seul
export const postsRouter = {
  list: postsList,
  byId: postsById,
  create: postsCreate,
} satisfies TRPCRouterRecord
```

- **`t` n'est pas exporté** : aucun `t.` hors de `trpc/trpc.ts`, et un `initTRPC` ailleurs, le
  verrou 1 ci-dessous le refuse (§ Verrous). Le choix de la bonne base reste à la relecture.
- **Le contexte lit la session sans jamais lever** (`auth.api.getSession({ headers })`) : le
  refus vient du middleware de la procédure.
- **L'org et l'identité arrivent par `ctx.actor`**, posé par `orgProcedure` depuis l'appartenance
  relue en base ; jamais un `organizationId` ni un `userId` dans un input (`web.md` § Données).
- Un rôle de plus (admin) = une base de plus, empilée sur `orgProcedure` ; jamais un `if` sur le
  rôle dans un handler.
- `query` lit, `mutation` écrit. Noms : `list`, `byId`, `create`, `update`, `delete`, puis un
  verbe métier (`close`, `cancel`) ; jamais `get`, `fetch` ni `all`. Un test le tient (§ Tests).
- **Le handler tient en un appel** à l'accès aux données ; une règle métier qui exige une
  requête vit dans le `.data.ts` ou en base. Le lint le tient (§ Verrous, 4).
- **Une procédure n'en appelle jamais une autre** : `createCaller` y rejoue contexte,
  middlewares et validation ; la logique commune devient une fonction.

## Accès aux données

- `<entité>.data.ts` : la connexion en 1er paramètre, `actor` en 2e, `tx` seul dans une
  transaction (`web.md` § Données, § 🅑).
- **Chaque requête filtre par `actor.orgId`, `byId` compris** : lire l'objet d'une autre org par
  son ID est le risque n° 1 des API (OWASP API1:2023). Hors de l'org, l'objet rend `NOT_FOUND`,
  jamais `FORBIDDEN`, qui confirmerait qu'il existe.
- **Les colonnes renvoyées sont une constante nommée** (`db.select(POST_COLUMNS)`, `columns`
  en requête relationnelle) : `db.select()` nu renvoie toutes les colonnes, et la réponse passe
  la frontière serveur → app comme une page web (`archi.md` § Lectures).
- Un `limit` venu de l'input porte un `.max()` (OWASP API4:2023).
- **Une panne lève**, jamais le `{ failed: true }` du web : une query qui le recevrait le
  prendrait pour un succès vide, mis en cache. tRPC rend l'erreur, TanStack relance. Le
  `.data.ts` ne rattrape que pour traduire un refus (ci-dessous).
- Une règle métier écrite en SQL (fonction, trigger, contrainte) reste en base et s'y teste ;
  le `.data.ts` l'appelle par `db.execute(sql\`…\`)`.
- **Son refus remonte traduit** : le `.data.ts` lit le code de `err.cause` (Drizzle enveloppe
  l'erreur `pg`), `P0001` → `UNPROCESSABLE_CONTENT` avec le message de l'exception, `23505` →
  `CONFLICT`, et relance le reste. Sinon tRPC en fait un 500 : bug pour l'app, Sentry (vu sur
  drizzle-orm 0.45).
- RLS : pas par réflexe (`web.md` § 🅑). Une base qui la garde (reprise de Supabase) : l'API se
  connecte sans superuser ni `BYPASSRLS`, qui la contournent toujours, et sans posséder les
  tables (sinon `FORCE ROW LEVEL SECURITY`). Dans la transaction de la requête :
  `set local role authenticated` et `set_config('request.jwt.claims', …, true)`, que les policies
  de Supabase lisent.

## Erreurs

| Cas | Code tRPC | HTTP |
| --- | --- | --- |
| Input mal formé (Zod) | `BAD_REQUEST` | 400 |
| Pas de session | `UNAUTHORIZED` | 401 |
| Rôle insuffisant | `FORBIDDEN` | 403 |
| Objet absent ou d'une autre org | `NOT_FOUND` | 404 |
| Doublon (contrainte unique) | `CONFLICT` | 409 |
| Refus métier (déjà clôturée, quota) | `UNPROCESSABLE_CONTENT` | 422 |
| Le reste : un bug | `INTERNAL_SERVER_ERROR` | 500 |

- Le message d'une `TRPCError` levée part tel quel à l'app : écrit pour l'utilisateur, dans la
  langue de l'UI.
- `errorFormatter` : en prod, le message d'une `INTERNAL_SERVER_ERROR` est remplacé par un
  générique (tRPC ne masque rien de lui-même) ; un `BAD_REQUEST` de Zod porte `data.zodError`
  (`z.flattenError`) (vu sur @trpc/server 11).
- **Un seul chemin vers le journal et Sentry : `packages/api/src/lib/observability/`**, exporté
  par un sous-chemin (`@<scope>/api/observability`) : le logger (§ Serveur), l'init de Sentry,
  `reportError(error, contexte)`, qui journalise, retire les valeurs sensibles, puis capture, et
  `closeSentry`. Le lint tient l'import du SDK et `console` hors de lui (§ Verrous, 6) ; un
  second `lib/observability/`, dans un autre paquet, il ne le voit pas : la relecture le refuse.
  - `apps/api` l'importe : `src/instrument.ts`, chargé par `node --import`, appelle son init ;
    puis le middleware Sentry en tête de l'app (`sentry(app)`, réexporté par le module),
    l'`onError` de Hono, le logger, `closeSentry` à l'arrêt.
  - Un paquet plus bas ne l'importe jamais (`packages/api` importe `db`, l'inverse ferait un
    cycle) : `packages/db` reçoit un rappel de qui crée le pool (`createPool(url, { onError })`),
    `packages/auth` lève vers l'`onError` de Hono (`onAPIError: { throw: true }` ; sans lui,
    Better Auth avale ses erreurs, vu sur better-auth 1.7).
- `reportError` n'est appelé que par :
  - l'`onError` du handler tRPC, pour tout statut ≥ 500 (`getHTTPStatusCodeFromError`), pas
    l'`INTERNAL_SERVER_ERROR` seul : un 503 levé est aussi une panne ;
  - l'`onError` de Hono, pour les routes hors tRPC, Better Auth compris ;
  - l'écouteur `error` de pg-boss et chaque handler de job (§ Jobs) ;
  - un `catch` qui avale une erreur pour continuer (un rollback, un envoi de mail).
- Le reste, exception non capturée et rejet non géré, revient aux intégrations du SDK. Jamais un
  `try/catch` par procédure qui capture puis relève : l'`onError` de tRPC capture déjà, et
  l'événement partirait deux fois.
- Le middleware Hono de Sentry ne voit pas une erreur de tRPC : `@hono/trpc-server` rend la
  réponse lui-même (vu sur @sentry/hono 11.17). L'`onError` de tRPC reste le seul point.
- Pas `trpcMiddleware`, qui capture aussi les refus et joint l'input selon `dataCollection` (vu sur
  @sentry/core 11). L'init : `references/sentry.md`.
- Côté app, le classifieur de `mobile.md` § Réseau et hors ligne lit `error.data?.httpStatus`
  d'une `TRPCClientError` : absent → réseau ; 401 → déconnexion, sans toast ; 400 → erreurs par
  champ (`data.zodError`), jamais le `message`, qui est le JSON des issues ; autre 4xx → refus,
  toast du message, sans Sentry ni `retry` ; 500 et plus → bug (vu sur @trpc/client 11).

## Côté app

- `lib/trpc.ts` : `createTRPCOptionsProxy<AppRouter>`, `httpBatchLink`, superjson.
  - Natif : `async headers()` qui **attend** `authClient.getCookie()` (asynchrone), avec
    `credentials: 'omit'` (doc Better Auth).
  - Web (la même app) : `headers` sans `getCookie()`, qui y rejette (expo-secure-store n'existe
    pas sur web) ; le navigateur porte le cookie : `credentials: 'include'` par le `fetch` du
    lien (vu sur @better-auth/expo 1.7).
  - `maxURLLength` explicite (2083, l'exemple de la doc) et `maxItems` ≤ le `maxBatchSize` du
    serveur : infinis par défaut, un gros lot rendrait un 400 (vu sur @trpc/client 11).
  - Pas `httpBatchStreamLink` : aucune procédure ne stream, et React Native lui demande des
    polyfills.
- Le proxy remplace `<entité>.api.ts`. `<entité>.queries.ts` garde le `staleTime` :
  `list: () => trpc.posts.list.queryOptions(undefined, { staleTime: 5 * 60_000 })`.
- Les clés viennent de tRPC ; une mutation invalide la racine de sa feature,
  `queryClient.invalidateQueries(trpc.posts.pathFilter())`. Invalider une autre feature passe
  par le même proxy, sans l'exception d'import (`mobile.md` § Données).
- **Les clés tRPC n'ont ni org ni user** : au changement d'org (`organization.setActive`) et à la
  déconnexion (`authClient.signOut()` d'abord, sinon un écran monté relance sa query),
  `queryClient.clear()` et la purge du persister.
- Input inconnu au rendu : `enabled`, pas `skipToken` (`mobile.md` § Données), contre l'exemple
  de la doc tRPC.
- Session : `authClient.useSession()`, le hook de Better Auth, remplace le Context de `mobile.md`
  § Auth et session ; y tombent aussi `getClaims`, l'auto-refresh et la clé publishable.

## Auth

- `packages/auth` : Better Auth, adapter Drizzle, tables dans la base (`web.md` § 🅑).
  - `advanced.database.generateId: 'uuid'` avant le premier `generate` : Better Auth écrit des ID
    en texte par défaut, et une FK vers une PK `uuid` casserait.
  - Schéma : `pnpm dlx auth@<version de better-auth> generate` (le CLI suit sa ligne ;
    `@better-auth/cli` est déprécié), puis `drizzle-kit generate` et `migrate`.
- Monté par Hono sur `/api/auth/*`, avant tRPC ; CORS enregistré avant les routes, sur
  `/api/auth/*` et `/api/trpc/*` (l'app web y envoie son cookie), origine explicite,
  `credentials: true`, la même origine dans `trustedOrigins`.
- App web et API sous le même domaine parent (`app.` et `api.`) : Safari (ITP) bloque le cookie
  d'un autre domaine.
- Expo : plugin `expo()` côté serveur ; `trustedOrigins` porte `<scheme>://`, `exp://` en dev
  seulement.
- L'app crée son client : `createAuthClient` de `better-auth/react`, avec
  `expoClient({ scheme, storagePrefix, storage: SecureStore })` et les plugins client
  (`emailOTPClient`, `organizationClient`) ; les champs du serveur par
  `inferAdditionalFields<typeof auth>()`, `auth` importé en type.
- OTP par mail : plugin `emailOTP`, l'envoi par `sendVerificationOTP`. Il crée le compte
  inconnu. Une invitation du plugin `organization` ne crée pas de compte et son acceptation
  exige une session : `disableSignUp: true` bloquerait l'invité. L'inscription reste ouverte, et
  `databaseHooks.user.create.before` refuse une adresse sans invitation en attente (vu sur
  better-auth 1.7).
- Multi-tenant : plugin `organization` (tables `organization`, `member`, `invitation`).
  `orgProcedure` lit `session.activeOrganizationId`, puis relit la ligne `member` ; un droit
  fin : `auth.api.hasPermission`. L'org active se pose à la création de la session
  (`databaseHooks.session.create.before`) : sinon `null` jusqu'à `organization.setActive`, et
  chaque `orgProcedure` rend `FORBIDDEN`.
- Rate limit intégré : en prod seulement, en mémoire (perdu au redémarrage), sur les routes
  d'auth. Il lit `X-Forwarded-For`, que le client forge : derrière un proxy, `ipAddressHeaders`
  (son en-tête, `cf-connecting-ip` chez Cloudflare) ou `trustedProxies` (vu sur better-auth 1.7).
- Pas le plugin `bearer` : la doc le réserve aux API sans cookies.

## Serveur

- Routes : `/api/auth/*`, `/api/trpc/*` (`@hono/trpc-server`), `/health`, les webhooks ; tout le
  reste est une procédure. Middlewares : `cors`, `bodyLimit`, `secureHeaders`, `requestId`.
- `NODE_ENV` exigé par le schéma d'`env.ts`, `production` sur le VPS : sans lui, tRPC renvoie la
  pile d'appels, et le rate limit de Better Auth comme Sentry sont coupés.
- **Le journal : pino**, dans le module de § Erreurs. Un logger enfant par requête porte
  l'identifiant de `requestId()`, l'utilisateur et l'org en ID seulement ; jamais une valeur SQL,
  un en-tête, un corps ni une adresse. Une `DrizzleQueryError` recopie les valeurs de la requête
  dans son message (`params: …`, vu sur drizzle-orm 0.45 ; en 1.0, seulement avec
  `paramsInErrors`) : le même nettoyage sert le journal et le `beforeSend` de Sentry.
- Un webhook vérifie sa signature sur le corps brut (`await c.req.text()`), avant tout parse.
- Une limite de débit par procédure est un middleware tRPC sur sa base, jamais un middleware
  Hono posé sur un chemin : un lot (`/api/trpc/a,b?batch=1`) y échappe. `maxBatchSize` borne la
  taille d'un lot.
- Arrêt propre, sur `SIGTERM` et `SIGINT` : `server.close()`, puis, dans son rappel et dans cet
  ordre, `boss.stop()`, `pool.end()`, `closeSentry()` et `process.exit(0)`. Les requêtes en cours
  finissent, puis les jobs en cours (30 s au plus, vu sur pg-boss 12), puis le pool ferme, puis
  Sentry vide sa file (sans lui, les derniers événements se perdent).
- Le compose de l'API porte `stop_grace_period: 40s` : Docker tue à 10 s par défaut, et un job
  coupé resterait `active` 15 min avant sa relance (vérifié le 2026-11-14).

## Jobs

- Un travail hors requête (envoi de push, purge, rappel planifié) : pg-boss, dans la base de
  l'API. Ni Redis, ni `pg_cron`, absent de l'image `postgres` officielle (vérifié le 2026-11-14).
- `packages/api/src/lib/jobs/jobs.ts` porte l'instance, sans import de feature, et son écouteur
  `boss.on('error', (e) => reportError(e))` : sans lui, une coupure de la base tue le
  process, routes HTTP comprises.
- `src/workers.ts`, comme `root.ts` les routeurs, exporte deux fonctions (vu sur pg-boss 12) :
  - `createQueues()` : `createQueue` puis `updateQueue`, avec les mêmes options (`retryLimit`,
    `retryBackoff`) : `createQueue` ignore celles d'une file qui existe, et `send` lève sur une
    file absente ;
  - `startWorkers()` : `boss.work` et `boss.schedule`. Chaque handler capture son erreur
    (`reportError`), puis la lève à nouveau : un job qui échoue ne prévient personne
    d'autre, et l'erreur levée garde ses relances.
- Au démarrage : `await boss.start()`, `await createQueues()`, `startWorkers()`, puis `serve()`.
- **Le job naît dans la transaction de l'écriture qui le cause**, dans le `.data.ts`, qui porte
  aussi le nom de la file et le type de sa donnée :
  `boss.send(file, data, { db: fromDrizzle(tx, sql) })`. Annulée, pas de job ; validée, il part
  même si le process tombe juste après (vu sur pg-boss 12).
- **Le job porte des ID** (`orgId`, `postId`), jamais l'objet ni une donnée personnelle : sa
  donnée reste en base 7 jours après la fin (vu sur pg-boss 12). Le handler
  (`<feature>.jobs.ts`) relit par une fonction du `.data.ts` qui prend l'`orgId` du job à la
  place d'`actor`. Un travail sur toutes les orgs (une purge) : une fonction du `.data.ts` nommée
  pour (`purgeExpired…`), que seul un `.jobs.ts` appelle.
- Une relance rejoue le job : son handler supporte de passer deux fois (une ligne marquée
  traitée).
- Le planifié : `boss.schedule(file, cron, data, { tz: 'Europe/Paris' })` ; sans `tz`, le cron
  suit l'UTC (vu sur pg-boss 12).

## Fichiers

- Le fichier ne passe pas par tRPC. Une procédure vérifie l'objet dans l'org, **génère la clé**
  (`{orgId}/{domaine}/{id}/{uuid}`), l'écrit sur la ligne et rend l'URL présignée
  (`@aws-sdk/s3-request-presigner`). L'app envoie au S3 et ne transmet jamais de chemin (OWASP :
  un nom de fichier généré par l'application).
- La lecture re-signe la clé stockée ; le format d'envoi : `mobile.md` § Données.
- Un PUT présigné ne borne pas la taille : une POST policy avec `content-length-range` quand
  elle compte. Le bucket porte sa règle CORS pour le web.

## Versions installées de l'app

Une version des stores reste installée après une mise en prod de l'API, et aucun type ne la voit
(pratique courante, rien d'officiel côté tRPC) :

- Changements additifs seulement : un champ d'input nouveau est optionnel ; une procédure qui
  change de forme devient une nouvelle procédure.
- Retirer une procédure ou un champ : quand la version minimale exigée de l'app dépasse la
  dernière qui s'en sert.
- Le transformer (superjson) se choisit au départ et ne change plus : une app installée sans lui
  casse.

## Tests

- Une procédure se teste par `createCaller` (Vitest), avec un contexte construit à la main, sans
  requête, sur une vraie base.
- **Deux tests d'isolation par entité** : l'objet d'une autre org rend `NOT_FOUND`, en lecture
  comme en écriture ; la liste de l'org A ne contient pas l'objet de B.
- Une mutation qui crée un job (§ Jobs) : le setup lance `boss.start()` et `createQueues()`,
  jamais `startWorkers()`, qui consommerait le job ; le test le lit par `boss.findJobs(file)`
  (vu sur pg-boss 12).
- **Un test tient le vocabulaire** (§ Procédures) : il parcourt `appRouter._def.procedures`
  (chaque procédure à plat, `posts.list` ; sans `lazy()` dans `root.ts`, dont les procédures n'y
  entrent qu'une fois chargées), vérifie que la liste n'est pas vide, puis liste les
  fautives : un nom dont le premier mot est `get`, `fetch` ou `all` (`getById`, pas `allocate`) ;
  un `list` ou `byId` dont `_def.type` n'est pas `query` ; un `create`, `update` ou `delete` qui
  n'est pas une `mutation` (vu sur @trpc/server 11).
- **Un test tient l'arbre** (§ Squelette), sans base : il parcourt `features/**/<nom nu>.ts` hors
  de `lib/`, importe chaque fichier, exige un seul export, nommé d'après son chemin, et le même
  objet que `appRouter._def.procedures['<chemin>']` (tRPC y range la procédure elle-même) ; puis
  chaque procédure de la table a son fichier. Rougissent : une action orpheline, une procédure
  écrite dans le routeur, une clé qui ne suit plus son fichier.
- **Un test tient l'accès** (OWASP API5:2023) : il appelle chaque procédure de
  `appRouter._def.procedures` par `createCaller`, sans session ni input, et exige
  `UNAUTHORIZED`, sauf une liste `PUBLIC` écrite dans le test. Rougissent : une procédure neuve
  sur `publicProcedure`, et une qui valide son input avant l'auth (`.input()` posé avant la base
  protégée), qui répondrait `BAD_REQUEST` à un inconnu.

## Verrous

Au lint, les trois d'`archi.md` (le 3 : `drizzle-orm` et `pg` hors de `packages/db` et
`*.data.ts`) ; en plus :

1. `@trpc/server` en valeur : `src/trpc/trpc.ts` seulement ; les actions y prennent leur base et
   `TRPCError`, le type `TRPCRouterRecord` reste libre (`allowTypeImports`).
2. Dans `apps/mobile`, `@<scope>/api` et `@<scope>/auth` en type seulement (`allowTypeImports`
   de `@typescript-eslint/no-restricted-imports`), `@<scope>/db` jamais ; `@/lib/trpc` dans
   `*.queries.ts` et `lib/` seulement (le proxy tient lieu de SDK : `mobile.md` § Règles d'or).
3. Les features de `packages/api` : `conventions({ dir: import.meta.dirname, type: 'api' })`
   dans son `eslint.config`, comme une app (`eslint.mjs`). Sans preset Next ou Expo, poser avant lui
   `typescript-eslint`, `eslint-plugin-import` (`flatConfigs.typescript`) et
   `eslint-import-resolver-typescript` (`settings: { 'import/resolver': { typescript: true } }`) :
   sans plugin, le lint refuse de tourner ; sans résolveur, un import `@/…` passe le verrou en
   silence.
4. La forme du handler, dans chaque fichier d'action (tout `.ts` d'une feature hors `.data.ts`,
   tests, `.jobs.ts` et `lib/`) : l'argument de `.query()` ou `.mutation()` est une flèche dont
   le corps est un appel, sans `ctx.db` (`no-restricted-syntax`). Les bases de procédure ne
   s'importent ni dans un `.data.ts` ni dans un `lib/` : une procédure née là, réexportée par
   son fichier d'action, passerait le test de l'arbre et échapperait à cette forme.
5. `src/trpc/` n'importe aucune feature (`import/no-restricted-paths`) : le chemin d'une requête
   ne dépend d'aucune d'elles.
6. Le comportement, dans le lint de chaque paquet du serveur (`apps/api`, `packages/*`) :
   `...comportement({ dir: import.meta.dirname })` après `conventions()` (`eslint.mjs`) :
   - `console` et `@sentry/*` hors de `src/lib/observability/` (§ Erreurs) ;
   - une valeur levée est une `Error` (`only-throw-error`, `prefer-promise-reject-errors`) ; une
     `Error` native levée dans un bloc `catch` garde sa cause, `catch {}` sans paramètre compris
     (`preserve-caught-error`) ; un `return` de promesse dans un `try` est attendu
     (`return-await`) ;
   - ni `catch` vide (un commentaire le justifie), ni `catch` qui relève seul, ni `.catch` qui
     ignore l'erreur (`() => …` sans paramètre, ou un corps vide) ;
   - chaque directive `eslint-disable` nomme sa règle et porte sa raison (`-- pourquoi`) ; une
     directive qui ne coupe plus rien rougit. Un repli voulu (`.catch(() => '')` sur un corps
     lu pour le journal) porte la sienne.
   - Restent à la relecture : la cause d'une `TRPCError` ou d'une erreur levée dans un
     `.catch()`, `.catch(noop)`, `.then(ok, () => {})`, un paramètre d'erreur lu nulle part.

Un verrou se vise par un chemin : un fichier déplacé sans le suivre le perd, et le lint reste
vert. Un déplacement prouve les siens : les règles actives de chaque fichier avant et après
(`ESLint.calculateConfigForFile`), puis une violation volontaire par verrou, montrée rouge.

## Non-défauts assumés

| On ne fait pas | Pourquoi |
| --- | --- |
| oRPC | le même service que tRPC, en moins répandu |
| NestJS | décorateurs et injection : plus de code par endpoint, pour une structure que tRPC et les verrous donnent |
| REST à la main (Hono seul, Express) | rien ne type le contrat entre l'app et l'API |
