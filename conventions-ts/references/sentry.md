# Sentry : les erreurs, et les traces vers notre API

> Lu avant d'écrire ou de modifier `Sentry.init`, sur renvoi de `SKILL.md` § Observabilité — Sentry.

Les erreurs partout ; un échantillon de traces là seulement où une app parle à notre API
(`api.md`), pour relier une erreur de l'app à sa requête :

```ts
Sentry.init({
  dsn: env.SENTRY_DSN,      // posé dans l'env de PROD seulement (hébergeur, EAS) ; absent = no-op
  enabled: process.env.NODE_ENV === 'production', // Expo : !__DEV__ — filet si un poste a le DSN
  dataCollection: { userInfo: false, cookies: false, httpBodies: [] /* … */ },
                             // SDK 11 (@sentry/nextjs, @sentry/node) : sendDefaultPii n'existe plus, et sans dataCollection le SDK COLLECTE utilisateur,
                             // IP, cookies, en-têtes et corps. Objet complet, typé par `satisfies`, dans une constante
                             // partagée (SENTRY_DATA_COLLECTION). SDK encore sur core 10 (@sentry/react-native 8, vu sur
                             // core 10.78) : sendDefaultPii: false.
  // App et API maison seulement : tracesSampleRate: 0.1. Ailleurs, PAS la clé : 0 n'éteint que
  // l'envoi, l'instrumentation tournerait quand même ; sans la clé, aucun span créé.
})
```

- **Les traces**, app et API maison :
  - Côté app, `tracePropagationTargets: [<URL de l'API>]` : par défaut, les en-têtes de trace
    partent vers tout hôte, S3 compris (vu sur @sentry/react-native 8). Le CORS de l'API, s'il
    liste ses en-têtes, porte `sentry-trace` et `baggage`.
  - Côté API, `databaseQueryData: false` dans `dataCollection` : sinon les spans emportent les
    valeurs des requêtes SQL (vu sur @sentry/core 11).

- **L'organisation en région de données UE** (Francfort), fixée à sa création et jamais changée
  ensuite : événements, sourcemaps et sauvegardes y restent ; comptes, réglages et support
  restent aux États-Unis (vérifié le 2026-11-24). Le contrat de traitement (DPA) signé, Seer (l'IA
  de Sentry) coupé.
- **Production seulement** : jamais de DSN dans un `.env` local. Un `next build && next start`
  local tourne en `production` et passerait le filet `enabled` ; un poste de dev avec DSN envoie.
  Pour tester en local : un build de prod (`next build && next start`) avec le DSN posé dans le
  shell **au build** (`NEXT_PUBLIC_` est inliné) ; un `next dev` n'envoie rien, par construction.
  Variante : un `if` autour de l'init quand d'autres branchements en dépendent.
- Hors de `dataCollection`, une clé absente est volontaire : ne rien ajouter. Replay et profiling
  sont opt-in : ne pas les ajouter suffit. Dans `dataCollection` (SDK 11), l'inverse : une clé
  absente collecte, chaque catégorie s'écrit.
- **`setUser({ id })`** — jamais email ni PII.
- API Node : le chargement de l'init, `references/api-socle.md` § Observabilité.
  - Hono : `init` et le middleware `sentry(app)` viennent de `@sentry/hono/node`, pas de
    `@sentry/node`. Cet init retire l'intégration Hono automatique : sans le middleware, Hono
    n'est plus instrumenté (vu sur @sentry/hono 11.17).
  - `onUnhandledRejectionIntegration({ mode: 'strict' })` : par défaut (`warn`), un rejet non
    géré est capturé mais le process continue, quand Node seul sort (vu sur @sentry/node 11.17).
- Ce qui remonte, les 5xx et l'inattendu, pas les refus : l'API, `references/api-socle.md`
  § Observabilité ; le web, `web.md` § Erreurs et chargement ; le mobile, `mobile.md` § Derrière
  notre API (tRPC).
