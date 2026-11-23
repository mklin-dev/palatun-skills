# Sentry : setup erreurs seulement

> Lu avant d'écrire ou de modifier `Sentry.init`, sur renvoi de `SKILL.md` § Observabilité — Sentry.

Setup erreurs-seulement (pas d'APM payant) :

```ts
Sentry.init({
  dsn: env.SENTRY_DSN,      // posé dans l'env de PROD seulement (hébergeur, EAS) ; absent = no-op
  enabled: process.env.NODE_ENV === 'production', // Expo : !__DEV__ — filet si un poste a le DSN
  dataCollection: { userInfo: false, cookies: false, httpBodies: [] /* … */ },
                             // SDK 11 (@sentry/nextjs, @sentry/node) : sendDefaultPii n'existe plus, et sans dataCollection le SDK COLLECTE utilisateur,
                             // IP, cookies, en-têtes et corps. Objet complet, typé par `satisfies`, dans une constante
                             // partagée (SENTRY_DATA_COLLECTION). SDK sur core 10 (@sentry/react-native 7) : sendDefaultPii: false.
  // PAS de tracesSampleRate : 0 n'éteint que l'envoi, l'instrumentation tournerait quand même.
  // Sans la clé, aucun span créé.
})
```

- **Production seulement** : jamais de DSN dans un `.env` local. Un `next build && next start` local tourne en `production` et passerait le filet `enabled` ; un poste de dev avec DSN envoie. Pour tester en local : un build de prod (`next build && next start`) avec le DSN posé dans le shell **au build** (`NEXT_PUBLIC_` est inliné) ; un `next dev` n'envoie rien, par construction. Variante : un `if` autour de l'init quand d'autres branchements en dépendent.
- Toute clé absente est volontaire : ne rien ajouter. Replay/profiling sont opt-in — ne pas les ajouter suffit.
- **`setUser({ id })`** — jamais email ni PII.
- API Node (`@sentry/node` 11) : l'init se charge par `node --import ./instrument.mjs`, plus par
  `--require` ; Hono : `@sentry/hono`, `honoIntegration` est retiré ; tRPC : `api.md` § Erreurs.
- Les 4xx attendues ne remontent pas (bruit) ; les 5xx / inattendues, oui.
