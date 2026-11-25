# API maison — le socle

> Lu à la création d'une API et pour son infra (auth, serveur, journal et Sentry, jobs,
> fichiers), sur renvoi d'`api.md`. Le quotidien d'une feature : `api.md`. Les organisations,
> les jobs et les fichiers ne se posent que si l'app en a ; le reste vaut pour toute API.

## Auth

- `packages/auth` : Better Auth, adapter Drizzle, tables dans la base (`references/base.md`).
  - `advanced.database.generateId: 'uuid'` avant le premier `generate` : Better Auth écrit des ID
    en texte par défaut, et une FK vers une PK `uuid` casserait.
  - Schéma : `pnpm dlx auth@<version de better-auth> generate` (le CLI suit sa ligne ;
    `@better-auth/cli` est déprécié), puis `drizzle-kit generate` et `migrate`.
- Monté par Hono sur `/api/auth/*`, avant tRPC ; CORS enregistré avant les routes, sur
  `/api/auth/*` et `/api/trpc/*` (l'app web y envoie son cookie), origine explicite,
  `credentials: true`, la même origine dans `trustedOrigins`.
- CSRF : `csrf({ origin })` de Hono sur `/api/trpc/*`, avec l'origine du CORS. Il refuse un
  formulaire envoyé d'un autre site, que le CORS laisse partir ; Better Auth vérifie déjà
  l'origine de ses propres routes (vu sur hono 4.13 et better-auth 1.7).
- App web et API sous le même domaine parent (`app.` et `api.`) : Safari (ITP) bloque le cookie
  d'un autre domaine.
- Expo : plugin `expo()` côté serveur ; `trustedOrigins` porte `<scheme>://`, `exp://` en dev
  seulement.
- L'app crée son client : `createAuthClient` de `better-auth/react`, avec
  `expoClient({ scheme, storagePrefix, storage: SecureStore })` et les plugins client
  (`emailOTPClient` ; `organizationClient` avec des organisations) ; les champs du serveur par
  `inferAdditionalFields<typeof auth>()`, `auth` importé en type.
- OTP par mail : plugin `emailOTP`, l'envoi par `sendVerificationOTP`. Il crée le compte
  inconnu : l'inscription est ouverte. Une app sur invitation (plugin `organization`) la garde
  ouverte aussi : une invitation ne crée pas de compte et son acceptation exige une session,
  `disableSignUp: true` bloquerait l'invité ; `databaseHooks.user.create.before` y refuse une
  adresse sans invitation en attente (vu sur better-auth 1.7).
- Avec des organisations : plugin `organization` (tables `organization`, `member`, `invitation`).
  `orgProcedure` lit `session.activeOrganizationId`, puis relit la ligne `member` ; un droit :
  `api.md` § Procédures. L'org active se pose à la création de la session
  (`databaseHooks.session.create.before`) : sinon `null` jusqu'à `organization.setActive`, et
  chaque `orgProcedure` rend `FORBIDDEN`.
- Durées écrites dans la config : l'OTP `expiresIn: 600` au plus (10 min, ASVS), stocké haché
  (`storeOTP: 'hashed'` ; en clair par défaut) ; la session, `expiresIn` et `updateAge`
  (glissante), plus une durée maximale que `requireSession` vérifie sur `session.createdAt` :
  Better Auth n'en a pas. Pas de `session.cookieCache` : une session révoquée resterait valide
  jusqu'à son `maxAge`.
- Rate limit intégré : en prod seulement, sur les routes d'auth, `storage: 'database'` (en
  mémoire, il se perd au redémarrage). Il compte par IP et par chemin, et lit `X-Forwarded-For`,
  que le client forge : `ipAddressHeaders` nomme l'en-tête que le proxy écrase
  (`cf-connecting-ip` derrière Cloudflare), et le port de l'API n'écoute que le proxy (vu sur
  better-auth 1.7). Il ne compte rien par adresse : `sendVerificationOTP` plafonne les envois
  par adresse et par heure, comptés en base.
- **Le compte se supprime depuis l'app** (Apple et Google Play l'exigent) :
  `user.deleteUser.enabled` ; sans mot de passe, Better Auth exige une session de moins d'un jour
  (`freshAge`) ou une confirmation par mail (`sendDeleteAccountVerification`). `beforeDelete`
  règle ce que le compte laisse : une org dont il est le seul owner, ses fichiers, ses jobs.
- **Un compte de test pour la review des stores** (Apple et Google Play l'exigent) : une adresse
  posée par env (`REVIEW_EMAIL`), avec ses données de démo ; `generateOTP` lui rend un code fixe
  (`REVIEW_OTP`, un secret) et `sendVerificationOTP` ne lui envoie rien.
- Pas le plugin `bearer` : la doc le réserve aux API sans cookies.

## Serveur

- Routes : `/api/auth/*`, `/api/trpc/*` (`@hono/trpc-server`), `/health`, les webhooks ; tout le
  reste est une procédure. Middlewares : `cors`, `bodyLimit`, `requestId`, `secureHeaders` avec
  une CSP fermée (`default-src 'none'; frame-ancestors 'none'` : il n'en pose aucune), et
  `Cache-Control: no-store` sur `/api/*` : une réponse authentifiée ne se garde nulle part (OWASP
  API8:2023).
- **Tout est borné dans le temps.** Le pool de l'API porte `statement_timeout` (10 s),
  `idle_in_transaction_session_timeout` (10 s) et `connectionTimeoutMillis` (5 s), que `pg` ne
  pose pas ; pas celui de pg-boss, dont les jobs durent plus. Chaque appel sortant (S3, mail,
  push) porte un `AbortSignal.timeout()` et ne suit pas de redirection.
- Une action qui coûte (mail, push, URL d'envoi de fichier) a un plafond par propriétaire et par
  jour, compté en base ; au-delà, `TOO_MANY_REQUESTS` (OWASP API4:2023).
- `NODE_ENV` exigé par le schéma d'`env.ts`, `production` sur le VPS : sans lui, tRPC renvoie la
  pile d'appels, et le rate limit de Better Auth comme Sentry sont coupés.
- **Le journal : pino**, dans le module de § Observabilité. Un logger enfant par requête porte
  l'identifiant de `requestId()`, l'utilisateur et l'org en ID seulement ; jamais une valeur SQL,
  un en-tête, un corps ni une adresse. Une `DrizzleQueryError` recopie les valeurs de la requête
  dans son message (`params: …`, vu sur drizzle-orm 0.45 ; en 1.0, seulement avec
  `paramsInErrors`) : le même nettoyage sert le journal et le `beforeSend` de Sentry.
- Un webhook vérifie sa signature sur le corps brut (`await c.req.text()`), avant tout parse.
- Une limite de débit par procédure est un middleware tRPC sur sa base, jamais un middleware
  Hono posé sur un chemin : un lot (`/api/trpc/a,b?batch=1`) y échappe ; sa clé : l'utilisateur,
  sinon l'IP de confiance. `maxBatchSize` borne la taille d'un lot.
- **Le build** : `apps/api` se bundle (tsdown, paquets du workspace embarqués, `instrument.ts` en
  entrée à part) : Node seul ne résout pas les alias `@/…` des paquets. L'image :
  `turbo prune api --docker`, l'install sur `out/json`, puis `out/full` et le build ; elle tourne
  sans root et porte `SENTRY_RELEASE`.
- Arrêt propre, sur `SIGTERM` et `SIGINT` : `server.close()`, puis, dans son rappel et dans cet
  ordre, `boss.stop()`, `pool.end()`, `closeSentry()` et `process.exit(0)`. Les requêtes en cours
  finissent, puis les jobs en cours (30 s au plus, vu sur pg-boss 12), puis le pool ferme, puis
  Sentry vide sa file (sans lui, les derniers événements se perdent).
- Le compose de l'API porte `stop_grace_period: 40s` : Docker tue à 10 s par défaut, et un job
  coupé resterait `active` 15 min avant sa relance (vérifié le 2026-11-14).

## Observabilité

- **Un seul chemin vers le journal et Sentry : `packages/api/src/lib/observability/`**, exporté
  par un sous-chemin (`@<scope>/api/observability`) : le logger (§ Serveur), l'init de Sentry,
  `reportError(error, contexte)`, qui journalise, retire les valeurs sensibles, puis capture, et
  `closeSentry`. Le lint tient l'import du SDK et `console` hors de lui (`api.md` § Verrous, 6) ; un
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
  - l'`onError` de Hono, pour les routes hors tRPC, Better Auth compris, au même seuil (≥ 500 :
    une `HTTPException` 4xx est un refus) ;
  - l'écouteur `error` de pg-boss et chaque handler de job (§ Jobs) ;
  - un `catch` qui avale une erreur pour continuer (un rollback, un envoi de mail).
- **Les refus vont au journal, pas à Sentry** : une ligne par requête (chemin, statut, durée,
  user et org en ID), et l'`onError` de tRPC journalise en `warn` chaque refus (401, 403, 429),
  qu'un lot cache derrière son statut. Une connexion ratée, un droit refusé ou une rafale se
  retrouvent ainsi (ASVS 16.3).
- **Chaque événement porte son contexte**, posé par le module sur le scope de la requête :
  `setUser({ id })`, les tags `org_id`, `request_id`, `app_version` et `trpc.path` (toutes les
  erreurs tRPC partagent la transaction de `/api/trpc/*`). La `release` est le SHA du commit,
  `SENTRY_RELEASE` posé au build de l'image : sans elle, Sentry ne voit ni régression ni correctif
  livré. Un job tourne dans `withIsolationScope`, sinon son contexte déborde sur le suivant.
- Le reste, exception non capturée et rejet non géré, revient aux intégrations du SDK.
- Le middleware Hono de Sentry ne voit pas une erreur de tRPC : `@hono/trpc-server` rend la
  réponse lui-même (vu sur @sentry/hono 11.17). L'`onError` de tRPC reste le seul point.
- Pas `trpcMiddleware`, qui capture aussi les refus et joint l'input selon `dataCollection` (vu sur
  @sentry/core 11). L'init : `references/sentry.md`.

## Jobs

- Un travail hors requête (envoi de push, purge, rappel planifié) : pg-boss, dans la base de
  l'API. Ni Redis, ni `pg_cron`, absent de l'image `postgres` officielle (vérifié le 2026-11-14).
- Push : Expo Push par défaut ; quand le projet refuse un sous-traitant américain de plus, FCM
  et APNs en direct (`getDevicePushTokenAsync` côté app).
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
- **Le job porte des ID** (le propriétaire, `postId`), jamais l'objet ni une donnée
  personnelle : sa donnée reste en base 7 jours après la fin (vu sur pg-boss 12). Le handler
  (`<feature>.jobs.ts`) relit par une fonction du `.data.ts` qui prend le propriétaire du job à
  la place d'`actor`. Un travail sur tous les propriétaires (une purge) : une fonction du
  `.data.ts` nommée pour (`purgeExpired…`), que seul un `.jobs.ts` appelle.
- Une relance rejoue le job : son handler supporte de passer deux fois (une ligne marquée
  traitée).
- Le planifié : `boss.schedule(file, cron, data, { tz: 'Europe/Paris' })` ; sans `tz`, le cron
  suit l'UTC (vu sur pg-boss 12).

## Fichiers

- Le fichier ne passe pas par tRPC. Une procédure vérifie l'objet chez son propriétaire,
  **génère la clé** (`{propriétaire}/{domaine}/{id}/{uuid}`) et rend l'URL présignée
  (`@aws-sdk/s3-request-presigner`). L'app envoie au S3, puis confirme : une seconde procédure
  contrôle que la clé reçue est bien de celles générées pour cet objet et que le fichier existe
  (`HeadObject`), puis l'écrit sur la ligne. Écrite à la présignature, elle pointerait sur un
  fichier absent après un envoi raté. L'app ne choisit jamais de chemin (OWASP : un nom de
  fichier généré par l'application).
- La lecture re-signe la clé stockée ; le format d'envoi : `mobile.md` § Données.
- Un PUT présigné ne borne pas la taille : une POST policy avec `content-length-range` quand
  elle compte. Le bucket porte sa règle CORS pour le web.
