# Architecture — API maison (Hono + tRPC)

Une API servie à un client qui n'est pas un serveur (app Expo, front web). Le commun (squelette,
rangement, imports, verrous) : `archi.md` ; le client mobile : `mobile.md` § Derrière notre
API ; le socle (auth, serveur, journal et Sentry, jobs, fichiers), lu à la création et pour
l'infra : `references/api-socle.md`.

**Quand** : le backend d'une app mobile reste Supabase direct (`mobile.md`) ; une API maison
quand Supabase est exclu, hébergeur européen exigé ou sous-traitant américain refusé. Elle tourne
alors sur le VPS, pas sur Workers (skill `infra` : `choisir-hebergement.md`, `vps/stack.md`
§ Clients publics).

## Ce que contient une bonne API

La liste à tenir ; le comment vit dans la section citée (« socle » : `references/api-socle.md` ;
« mobile » : `mobile.md`).

| Axe | Exigence | Où |
| --- | --- | --- |
| Contrat | typé de bout en bout, sans génération | § La stack |
| | changements additifs ; une version minimale de l'app, imposée par l'API | § Versions installées de l'app |
| Données | chaque requête filtrée par org ; hors de l'org, `NOT_FOUND` | § Accès aux données |
| | l'input validé et borné ; un `update` limité à ses champs | § Accès aux données |
| | la sortie en colonnes nommées ; une liste paginée par curseur | § Accès aux données |
| | un `create` rejoué ne crée pas de doublon | § Accès aux données |
| | une action sensible laisse une ligne d'audit | § Accès aux données |
| Auth | session Better Auth par cookie, durées écrites | socle § Auth |
| | un droit = une permission, posée par la base de procédure | § Procédures |
| | le compte se supprime depuis l'app ; un compte de test pour les stores | socle § Auth |
| Débit et coût | une limite par IP de confiance et par adresse ; un plafond par action coûteuse | socle § Auth, § Serveur |
| Robustesse | tout borné dans le temps : SQL, transaction, appel sortant | socle § Serveur |
| | une panne lève ; un refus a son code | § Erreurs |
| Cache | dans l'app (TanStack) ; l'API répond `no-store` | mobile § Derrière notre API, socle § Serveur |
| Observabilité | un seul module vers le journal et Sentry, les 5xx seuls, avec release et contexte | socle § Observabilité |
| Exploitation | jobs en base, nés dans la transaction ; fichiers par URL présignée | socle § Jobs, § Fichiers |
| | build bundlé, image sans root, arrêt propre, `/health` | socle § Serveur |
| Preuve | isolation, accès, droits, arbre et noms tenus par des tests | § Tests |

## La stack

| Rôle | Outil | Pourquoi |
| --- | --- | --- |
| Serveur HTTP | Hono sur Node (`@hono/node-server`) | porte l'auth et tRPC ; le même code tourne sur Workers |
| Contrat | tRPC v11 | le contrat typé le plus utilisé ; types de bout en bout, sans génération |
| Base | Drizzle + `pg` | `web.md` § 🅑 (connexion, migrations, schéma) |
| Auth | Better Auth en lib | `web.md` § 🅑 ; plugin Expo officiel |
| Validation | Zod v4 | `SKILL.md` § Zod |
| Jobs | pg-boss | file et cron dans la base de l'API, sans Redis (socle § Jobs) |

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
  exige, et avec l'`id`, que l'app envoie (§ Accès aux données) :
  `createInsertSchema(posts).omit({ orgId: true, createdAt: true }).required({ id: true })` ;
  l'org vient d'`actor`, jamais de l'input (vu sur drizzle-zod 0.8).
- L'app Expo dans le monorepo : `mobile.md` § Tests, build et EAS.

`packages/api/src` : un dossier par ressource, un fichier par action, presque rien à la racine :

```text
packages/api/src/
├── index.ts  root.ts  workers.ts   les exports du paquet, appRouter (une clé par feature), socle § Jobs
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
- **Un droit = une base de plus**, empilée sur `orgProcedure` : elle vérifie une permission
  (`requirePermission({ member: ['update'] })`) contre les rôles du contrôle d'accès du plugin
  `organization` (`ac`), pour chacun des rôles de `ctx.actor.role`, séparés par des virgules.
  Jamais l'égalité d'un rôle (`role === 'admin'` refuse l'`owner` et un `admin,member`), jamais un
  `if` sur le rôle dans un handler.
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
- Chaque chaîne et chaque tableau de l'input porte un `.max()`, un `limit` compris (OWASP
  API4:2023).
- L'input d'un `update` liste ses champs (`.pick()`), jamais le schéma entier : sinon `role`,
  `status` ou `ownerId` passent (OWASP API3:2023).
- **Une liste se pagine par curseur** : l'input porte `cursor` (la clé de tri du dernier élément)
  et `limit`, la réponse `{ items, nextCursor }`, triée sur une clé stable (`createdAt`, puis
  `id`) : la forme que lit `useInfiniteQuery`. Un `offset` saute ou répète une ligne quand la
  liste bouge.
- **Un `create` porte l'`id` généré par l'app** (`z.uuid()`) : rejoué après une coupure
  (`mobile.md` § Réseau et hors ligne), il retombe sur la même ligne (`onConflictDoNothing`, puis
  relecture filtrée par org : `web.md` § 🅑).
- **Une action sensible laisse une ligne d'audit** (membres, rôles, invitations, suppressions,
  exports) : qui, quoi, sur quel objet, quand, dans quelle org, en ID seulement ; écrite par le
  `.data.ts`, dans la transaction de l'action.
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
| App sous la version minimale | `PRECONDITION_FAILED` | 412 |
| Limite de débit ou plafond atteint | `TOO_MANY_REQUESTS` | 429 |
| Le reste : un bug | `INTERNAL_SERVER_ERROR` | 500 |

- Le message d'une `TRPCError` levée part tel quel à l'app : écrit pour l'utilisateur, dans la
  langue de l'UI.
- `errorFormatter` : en prod, le message d'une `INTERNAL_SERVER_ERROR` est remplacé par un
  générique (tRPC ne masque rien de lui-même) ; un `BAD_REQUEST` de Zod porte `data.zodError`
  (`z.flattenError`) (vu sur @trpc/server 11).
- Dans une feature : jamais un `try/catch` qui capture puis relève (l'`onError` de tRPC capture
  déjà) ; un `catch` qui avale une erreur pour continuer (un rollback, un envoi de mail) appelle
  `reportError`. Le journal et Sentry : `references/api-socle.md` § Observabilité.

## Versions installées de l'app

Une version des stores reste installée après une mise en prod de l'API, et aucun type ne la voit
(pratique courante, rien d'officiel côté tRPC) :

- Changements additifs seulement : un champ d'input nouveau est optionnel ; une procédure qui
  change de forme devient une nouvelle procédure.
- **L'API impose une version minimale** : l'app native envoie sa version à chaque requête
  (en-tête `x-app-version`, `nativeApplicationVersion` d'`expo-application`) ; un middleware de
  `publicProcedure` la compare à `MIN_APP_VERSION` (env) et lève `PRECONDITION_FAILED` en
  dessous, et l'app affiche un écran de mise à jour qui ne se ferme pas. Sans en-tête (le web,
  toujours à jour) : rien.
- Retirer une procédure ou un champ : quand la version minimale exigée de l'app dépasse la
  dernière qui s'en sert.
- Le transformer (superjson) se choisit au départ et ne change plus : une app installée sans lui
  casse.

## Tests

- Une procédure se teste par `createCaller` (Vitest), avec un contexte construit à la main, sans
  requête, sur une vraie base.
- **Deux tests d'isolation par entité** : l'objet d'une autre org rend `NOT_FOUND`, en lecture
  comme en écriture ; la liste de l'org A ne contient pas l'objet de B.
- Une mutation qui crée un job (`references/api-socle.md` § Jobs) : le setup lance
  `boss.start()` et `createQueues()`, jamais `startWorkers()`, qui consommerait le job ; le test
  le lit par `boss.findJobs(file)` (vu sur pg-boss 12).
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
- **Un test tient l'accès** : il appelle chaque procédure de
  `appRouter._def.procedures` par `createCaller`, sans session ni input, et exige
  `UNAUTHORIZED`, sauf une liste `PUBLIC` écrite dans le test. Rougissent : une procédure neuve
  sur `publicProcedure`, et une qui valide son input avant l'auth (`.input()` posé avant la base
  protégée), qui répondrait `BAD_REQUEST` à un inconnu.
- **Un test tient les droits** (OWASP API5:2023) : chaque procédure d'une base de permission,
  appelée par un `member` sans cette permission, rend `FORBIDDEN`.

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
   - `console` et `@sentry/*` hors de `src/lib/observability/` (`references/api-socle.md`
     § Observabilité) ;
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
| Cache serveur (Redis, Valkey) | une instance : le cache vit dans l'app ; le débit et les files, en base |
| MFA par défaut | l'OTP par mail suffit ; un client qui l'exige l'ajoute (plugin `twoFactor`) |
| Certificate pinning | il casse à la rotation des certificats ; l'OWASP le déconseille |
| Attestation de l'app (App Attest, Play Integrity) | seulement sur un abus constaté |
| OpenTelemetry | Sentry suffit ; il ne sert qu'avec un pipeline à soi |
