# conventions-ts — sources

Relevées du 2026-10-26 au 2026-11-25. « § X » seul renvoie au `SKILL.md`. Une règle liée à une
version (son marqueur : `SKILL.md`) ou qui tranche contre l'usage cite sa source ici ; la
vérifier avant de rouvrir la règle.

| Règle | Où dans le skill | Source |
| --- | --- | --- |
| `typescript` en `~6.0.3` | § Dépendances & sécurité | https://registry.npmjs.org/typescript · https://typescript-eslint.io/users/dependency-versions/ · https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/ |
| `moduleResolution: node`, `strict` par défaut | `setup.md` § TypeScript — config | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ · https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ |
| `enum`, `import type` | `setup.md` § TypeScript — config | https://www.typescriptlang.org/tsconfig/#erasableSyntaxOnly |
| Disable d'`exhaustive-deps` | § ESLint | tarball `eslint-plugin-react-hooks@7.1.1` (`DEFAULT_ESLINT_SUPPRESSIONS`) · https://oxc.rs/docs/guide/usage/linter/rules/react/rule-suppression |
| `useEffect(async…)` | `setup.md` § ESLint | https://typescript-eslint.io/rules/no-misused-promises/ · essai local TS 6.0.3, `@types/react` 19 |
| `react-hooks` des presets | `setup.md` § ESLint | tarball `eslint-config-next@16.4.3` `dist/index.js` · https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md |
| Règles du Compiler en `warn` | § Definition of Done | tarball `eslint-plugin-react-hooks@7.1.1` |
| Erreurs Zod | § Zod (v4) | https://zod.dev/error-formatting · https://zod.dev/v4/changelog |
| Temporal | § Dates | https://github.com/web-platform-dx/web-features/blob/main/features/temporal.yml.dist · https://github.com/facebook/hermes/blob/main/doc/Features.md |
| `<Activity hidden>` | `references/react-details.md` | https://react.dev/reference/react/Activity · https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents |
| Mémo manuelle | § Mémoïsation (React Compiler actif) | https://react.dev/learn/react-compiler/introduction |
| `try` non compilé | `references/react-details.md` | tarball `babel-plugin-react-compiler@1.0.0` `dist/index.js` (« Support ThrowStatement inside of try/catch », « Support value blocks… within a try/catch statement ») |
| `queryClient.query()` | `references/react-details.md` | https://github.com/TanStack/query/releases/tag/%40tanstack%2Fquery-core%405.102.0 |
| `'static'`, `refetchInterval` | `references/react-details.md` | https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults |
| `signal` et `cancelQueries` | `references/react-details.md` | `@tanstack/query-core@5.105.0` `src/retryer.ts:167-191` · https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation |
| Server Actions en série | § TanStack Query | https://nextjs.org/docs/app/guides/server-actions#sequential-dispatch-on-the-client |
| jest-expo, Vitest | § Tests | https://docs.expo.dev/develop/unit-testing/ · https://nextjs.org/docs/app/guides/testing |
| Routes seules dans `app/` | `archi.md` § Squelette | https://docs.expo.dev/router/basics/core-concepts/ · https://github.com/expo/expo/tree/main/templates/expo-template-default/src |
| Découpage par feature (Next) | `archi.md` § Squelette | https://nextjs.org/docs/app/getting-started/project-structure |
| Sens unique, pas de barrel | `archi.md` § Règle d'import et verrou | https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md · https://tkdodo.eu/blog/please-stop-using-barrel-files |
| Verrou sous ESLint 10 | `archi.md` § Règle d'import et verrou | https://github.com/import-js/eslint-plugin-import · https://eslint.org/docs/v9.x/use/core-concepts/glossary |
| Kebab-case (usage majoritaire) | § Nommage | https://expo.dev/blog/expo-app-folder-structure-best-practices · https://ui.shadcn.com/docs/components-json |
| `server-only`, action mince | `web.md` § Données, § Actions | https://nextjs.org/docs/app/guides/data-security |
| `proxy.ts` | `web.md` § Fichiers propres au web | https://nextjs.org/docs/app/api-reference/file-conventions/proxy |
| `use()` | `web.md` § Rendu | https://react.dev/reference/react/use |
| Refus en valeur de retour, `<Suspense>` | `web.md` § Erreurs et chargement | https://nextjs.org/docs/app/getting-started/error-handling · https://nextjs.org/docs/app/guides/streaming |
| `captureException`, `onRequestError` | `web.md` § Erreurs et chargement | https://docs.sentry.io/platforms/javascript/guides/nextjs/capturing-errors · https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation |
| `enabled` plutôt que `skipToken` | `mobile.md` § Données | `@tanstack/query-core@5.104.5` `build/modern/utils.js:302` · https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries |
| `queryOptions` comme abstraction | `mobile.md` § Données | https://tkdodo.eu/blog/creating-query-abstractions · https://tanstack.com/query/latest/docs/framework/react/guides/query-options |
| Factory de clés | `mobile.md` § Données | https://tkdodo.eu/blog/effective-react-query-keys |
| Suffixes de plateforme | `mobile.md` § Routes et navigation | https://docs.expo.dev/router/advanced/platform-specific-modules/ |
| `onlineManager`, `focusManager` | `mobile.md` § Réseau et hors ligne | https://tanstack.com/query/latest/docs/framework/react/react-native |
| Monorepo à la 2ᵉ app | `archi.md` § Interdits | https://docs.expo.dev/guides/monorepos/ · https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository |
| Ni arborescence ni `AGENTS.md` par feature | `setup.md` § La doc du projet | https://arxiv.org/html/2602.11988 · https://code.claude.com/docs/en/best-practices · https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html · https://agents.md/ |
| `router.refresh()` | `web.md` § Données | https://nextjs.org/docs/app/api-reference/functions/use-router |
| `generateStaticParams` | `web.md` § Cache | https://nextjs.org/docs/app/api-reference/functions/generate-static-params |
| Profils `cacheLife` | `archi.md` § Fraîcheur | https://nextjs.org/docs/app/api-reference/functions/cacheLife |
| 200 lignes, procédures en skills, `disable-model-invocation` | `setup.md` § La doc du projet | https://code.claude.com/docs/en/best-practices · https://code.claude.com/docs/en/memory · https://code.claude.com/docs/en/skills |
| `CLAUDE.md` masque `AGENTS.md`, `/doctor prompt-audit` | `setup.md` § La doc du projet | https://code.claude.com/docs/en/memory |
| Codex : 32 KiB | `setup.md` § La doc du projet | https://github.com/openai/codex/issues/36371 · https://developers.openai.com/codex/guides/agents-md |
| tRPC plutôt qu'oRPC | `api.md` § La stack | https://api.npmjs.org/downloads/point/2026-10-01:2026-10-31/@trpc/server · https://api.npmjs.org/downloads/point/2026-10-01:2026-10-31/@orpc/server |
| Forme create-t3-turbo, figée | `api.md` § Squelette | https://github.com/t3-oss/create-t3-turbo · `gh api repos/t3-oss/create-t3-turbo/commits/main` |
| Contexte qui ne lève pas, middlewares | `api.md` § Procédures | https://trpc.io/docs/server/authorization |
| `createCaller` | `api.md` § Procédures, § Tests | https://trpc.io/docs/server/server-side-calls |
| Codes, message, `errorFormatter` | `api.md` § Erreurs | https://trpc.io/docs/server/error-handling |
| Pas `trpcMiddleware`, `onError` du handler | `references/api-socle.md` § Observabilité | tarball `@sentry/core@11.12.0` `build/esm/trpc.js` · https://trpc.io/docs/server/error-handling · tarball `@hono/trpc-server@0.4.2` `dist/index.js` (`...rest` transmis) |
| Objet d'une autre org (API1:2023) | `api.md` § Accès aux données | https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/ |
| Exemple tRPC des `queryOptions` | `mobile.md` § Données | https://trpc.io/docs/client/tanstack-react-query/usage |
| `@trpc/tanstack-react-query` | `mobile.md` § Données | https://trpc.io/docs/client/tanstack-react-query/setup · https://trpc.io/docs/client/react |
| Better Auth sur Hono | `references/api-socle.md` § Auth | https://better-auth.com/docs/integrations/hono |
| Changements additifs | `api.md` § Versions installées de l'app | https://dev.to/hirodeath/sharing-trpc-v11-types-between-nextjs-and-expo-a-real-world-indie-web-ios-setup-3067 |
| `allowTypeImports` | `api.md` § Verrous | https://typescript-eslint.io/rules/no-restricted-imports/ |
| Montées groupées | `api.md` § La stack | https://better-auth.com/blog/security-release-2026-11-03 · `npm view @trpc/client@11.28.0 peerDependencies` |
| CLI `auth` | `references/api-socle.md` § Auth | `npm view @better-auth/cli deprecated` · `npm view auth dist-tags` · https://better-auth.com/docs/concepts/cli |
| Plugins de Better Auth | `references/api-socle.md` § Auth | https://better-auth.com/docs/plugins/email-otp · https://better-auth.com/docs/plugins/organization · https://better-auth.com/docs/plugins/bearer |
| Lien tRPC | `mobile.md` § Derrière notre API | https://trpc.io/docs/client/links/httpBatchStreamLink · https://trpc.io/docs/client/links/httpBatchLink |
| RLS contournée | `api.md` § Accès aux données | https://www.postgresql.org/docs/current/ddl-rowsecurity.html · https://orm.drizzle.team/docs/rls |
| Middlewares Hono, arrêt propre | `references/api-socle.md` § Serveur | https://hono.dev/docs/middleware/builtin/cors · https://hono.dev/docs/getting-started/nodejs |
| Taille d'un envoi présigné | `references/api-socle.md` § Fichiers | https://github.com/scaleway/docs-content/blob/main/pages/object-storage/api-cli/post-object.mdx |
| Le comportement au lint | `api.md` § Verrous, 6 | https://arxiv.org/abs/2604.09409 · https://arxiv.org/abs/2610.06193 |
| Un module vers le journal et Sentry | `references/api-socle.md` § Observabilité | https://github.com/formbricks/formbricks (`reportApiError`) · https://docs.sentry.io/platforms/javascript/guides/hono/manual-setup/ |
| Sentry sur Hono et tRPC, `onUnhandledRejection` | `references/api-socle.md` § Observabilité, `references/sentry.md` | tarballs `@sentry/server-utils@11.17.0` (`integrations/hono/`) et `@sentry/node@11.17.0` (`integrations/onunhandledrejection.js`) · tarball `@sentry/hono@11.17.0` (`node/sdk.js`, `node/middleware.js`) · tarball `@hono/trpc-server@0.4.2` |
| pino, `DrizzleQueryError` | `references/api-socle.md` § Serveur | https://github.com/pinojs/pino/blob/main/docs/web.md · tarballs `drizzle-orm@0.45.4` (`errors.js`) et `drizzle-orm@1.0.0-rc.6` (`errors.js`, `pg-core/session.js`) |
| `strict-type-checked` | `setup.md` § ESLint | https://typescript-eslint.io/users/configs/#strict-type-checked · tarball `@typescript-eslint/eslint-plugin@8.72.2` `dist/configs/flat/strict-type-checked.js` |
| Règles de `comportement()` | `api.md` § Verrous, 6 | https://eslint.org/docs/latest/rules/no-restricted-globals · https://eslint.org/docs/latest/rules/preserve-caught-error · https://typescript-eslint.io/rules/only-throw-error/ · https://typescript-eslint.io/rules/return-await/ · https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/require-description.html |
| `onAPIError: { throw: true }` | `references/api-socle.md` § Observabilité | https://www.better-auth.com/docs/reference/options (`onAPIError`) · un test de la route d'auth sur Hono, rouge sans l'option |
| `member` refusé (API5:2023) | `api.md` § Tests | https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/ |
| Sentry 11 : `dataCollection`, `--import`, `@sentry/hono` | `references/sentry.md`, `references/api-socle.md` § Observabilité | https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md |
| `createInsertSchema` | `api.md` § Squelette | tarball `drizzle-zod@0.8.3` `index.mjs` · tarball `drizzle-orm@1.0.0-rc.5` `zod/schema.js` (`optional`) |
| Erreur `pg` dans `cause`, 500 hors `TRPCError` | `api.md` § Accès aux données | tarballs `drizzle-orm@0.45.4` et `drizzle-orm@1.0.0-rc.5` (`errors.js`) · https://github.com/trpc/trpc/blob/main/packages/server/src/unstable-core-do-not-import/error/TRPCError.ts |
| `BAD_REQUEST` de Zod, `data.httpStatus` | `api.md` § Erreurs | https://github.com/trpc/trpc/blob/main/packages/server/src/unstable-core-do-not-import/middleware.ts · tarball `zod@4.6.7` `v4/core/errors.js` |
| `getCookie()` sur web | `mobile.md` § Derrière notre API | tarball `@better-auth/expo@1.7.23` `dist/client.js:628-629` · tarball `expo-secure-store@58.0.3` `build/ExpoSecureStore.web.js` · tarball `better-auth@1.7.22` `client/config.mjs` |
| Invitation, `disableSignUp` | `references/api-socle.md` § Auth | tarball `better-auth@1.7.22` `plugins/organization/routes/crud-invites.mjs` · `plugins/email-otp/routes.mjs` |
| Lot tRPC, `maxBatchSize` | `references/api-socle.md` § Serveur | https://github.com/trpc/trpc/blob/main/packages/client/src/links/httpBatchLink.ts · https://trpc.io/docs/client/links/httpBatchLink |
| Plugin `import`, import non résolu | `api.md` § Verrous | https://github.com/import-js/eslint-plugin-import/blob/main/src/index.js · tarball `eslint-plugin-import@2.32.0` `lib/rules/no-restricted-paths.js` |
| `csrf()` de Hono | `references/api-socle.md` § Auth | https://hono.dev/docs/middleware/builtin/csrf · tarball `hono@4.13.18` `dist/middleware/csrf/index.js` · tarball `better-auth@1.7.26` `dist/api/middlewares/origin-check.mjs` |
| Refus journalisés (ASVS 16.3) | `references/api-socle.md` § Observabilité | https://github.com/OWASP/ASVS/tree/master/5.0/en (16.3) |
| Nom de fichier généré | `references/api-socle.md` § Fichiers | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html |
| Une query function lève | `api.md` § Accès aux données | https://tanstack.com/query/v5/docs/framework/react/guides/query-functions |
| `clear()` | `mobile.md` § Derrière notre API | https://tanstack.com/query/v5/docs/reference/QueryClient |
| Relances de tRPC | `mobile.md` § Derrière notre API | https://trpc.io/docs/client/links/retryLink |
| Client Better Auth d'Expo | `references/api-socle.md` § Auth, `mobile.md` § Auth et session | https://better-auth.com/docs/integrations/expo · https://better-auth.com/docs/concepts/typescript |
| `generateId: 'uuid'` | `references/api-socle.md` § Auth | https://better-auth.com/docs/concepts/database |
| Org active | `references/api-socle.md` § Auth | https://better-auth.com/docs/plugins/organization |
| Safari (ITP) | `references/api-socle.md` § Auth | https://better-auth.com/docs/concepts/cookies |
| `NODE_ENV` | `references/api-socle.md` § Serveur | https://trpc.io/docs/server/error-handling · tarball `better-auth@1.7.23` `dist/context/create-context.mjs` |
| Bornes de l'input, plafonds (API4:2023) | `api.md` § Accès aux données | https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/ |
| `_def.procedures`, `_def.type` | `api.md` § Tests | tarball `@trpc/server@11.28.1` `src/unstable-core-do-not-import/router.ts` (`procedures[newPath]`), `procedure.ts` (`type`) |
| Un fichier par procédure, SQL à part | `api.md` § Squelette | https://github.com/documenso/documenso/tree/main/packages/trpc/server · https://github.com/calcom/cal.com/tree/main/packages/trpc/server · https://github.com/midday-ai/midday/tree/main/apps/api/src |
| Feature de référence | `api.md` § Squelette | https://www.thoughtworks.com/radar/techniques/anchoring-coding-agents-to-a-reference-application · https://code.claude.com/docs/en/best-practices |
| pg-boss plutôt que BullMQ | `api.md` § La stack, `references/api-socle.md` § Jobs | https://api.npmjs.org/downloads/point/last-week/pg-boss · https://api.npmjs.org/downloads/point/last-week/bullmq |
| pg-boss : transaction, files, relances, rétention, `tz`, `stop` | `references/api-socle.md` § Jobs, § Serveur, `api.md` § Tests | tarball `pg-boss@12.38.2` `dist/adapters/drizzle.d.ts`, `dist/manager.js` (`Queue … does not exist`), `dist/types.d.ts` (`retryBackoff`), `dist/timekeeper.js` (`tz`), `dist/index.js` (`stop`) |
| `pg_cron` absent | `references/api-socle.md` § Jobs | https://github.com/docker-library/postgres/blob/master/18/trixie/Dockerfile |
| `stop_grace_period` | `references/api-socle.md` § Serveur | https://docs.docker.com/reference/compose-file/services/#stop_grace_period |
| Suppression du compte | `references/api-socle.md` § Auth | https://developer.apple.com/support/offering-account-deletion-in-your-app/ · https://support.google.com/googleplay/android-developer/answer/13327111 · https://better-auth.com/docs/concepts/users-accounts |
| Compte de test, `generateOTP` | `references/api-socle.md` § Auth | https://developer.apple.com/app-store/review/guidelines/ (2.1) · https://support.google.com/googleplay/android-developer/answer/15748846 · tarball `better-auth@1.7.28` `dist/plugins/email-otp/otp-token.mjs` |
| OTP : durée, `storeOTP` | `references/api-socle.md` § Auth | https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md (6.5.5) · tarball `better-auth@1.7.28` `dist/plugins/email-otp/index.mjs` |
| Session : durée maximale, `cookieCache` | `references/api-socle.md` § Auth | https://better-auth.com/docs/concepts/session-management · https://github.com/better-auth/better-auth/security/advisories/GHSA-fvxx-76fc-893x |
| Rate limit de Better Auth | `references/api-socle.md` § Auth | tarball `better-auth@1.7.28` `dist/api/rate-limiter/index.mjs` · https://better-auth.com/docs/concepts/rate-limit |
| Rôles multiples, permission plutôt que rôle | `api.md` § Procédures | tarball `better-auth@1.7.28` `dist/plugins/organization/roles.mjs` · https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html |
| `update` en liste blanche (API3:2023) | `api.md` § Accès aux données | https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/ |
| Pagination par curseur | `api.md` § Accès aux données | https://trpc.io/docs/client/tanstack-react-query/usage |
| `create` rejoué | `api.md` § Accès aux données | https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ |
| Journal d'audit | `api.md` § Accès aux données | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html · https://github.com/OWASP/ASVS/tree/master/5.0/en (16.3) |
| Hook `after` | `api.md` § Accès aux données | https://better-auth.com/docs/concepts/hooks |
| Version minimale de l'app | `api.md` § Versions installées de l'app | https://clerk.com/changelog/2026-11-03-minimum-app-version · https://docs.expo.dev/versions/latest/sdk/application/ |
| `no-store`, CSP de `secureHeaders` | `references/api-socle.md` § Serveur | https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html · tarball `hono@4.13.21` `dist/middleware/secure-headers/secure-headers.js` |
| Délais de Postgres et de `pg` | `references/api-socle.md` § Serveur | https://www.postgresql.org/docs/current/runtime-config-client.html · https://node-postgres.com/apis/client |
| Build et image | `references/api-socle.md` § Serveur | https://nodejs.org/api/typescript.html · https://turborepo.dev/docs/guides/tools/docker · https://github.com/AmanVarshney01/create-better-t-stack |
| Contexte, `withIsolationScope`, `release` | `references/api-socle.md` § Observabilité | https://docs.sentry.io/platforms/javascript/guides/node/enriching-events/scopes/ · https://docs.sentry.io/platforms/javascript/guides/node/configuration/releases/ |
| Traces, propagation, `databaseQueryData` | `references/sentry.md` | https://sentry.io/pricing/ · tarball `@sentry/react-native@8.36.0` `dist/js/tracing/reactnativetracing.js` · tarball `@sentry/core@11.17.0` `build/types/types/datacollection.d.ts` |
| Push sans Expo | `references/api-socle.md` § Jobs | https://docs.expo.dev/push-notifications/sending-notifications-custom/ |
| Pinning, attestation | `api.md` § Non-défauts assumés | https://cheatsheetseries.owasp.org/cheatsheets/Pinning_Cheat_Sheet.html · https://github.com/OWASP/maswe (MASWE-0056) |
