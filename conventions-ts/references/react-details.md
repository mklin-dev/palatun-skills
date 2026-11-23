# React et TanStack Query — les cas rares

Les règles du quotidien sont dans `SKILL.md`. Ici, ce qui ne sert qu'au cas nommé : à lire avant d'y
toucher.

## Écran ou onglet masqué dont l'état doit survivre

- Scroll, saisie : `<Activity mode="hidden">`. ⚠️ Ses Effects sont nettoyés, puis recréés au retour ;
  sur le web, son DOM reste, donc un `<video>` masqué joue encore sans cleanup. Next avec
  `cacheComponents` le fait déjà par route (vu sur next 16).

## React Compiler

- ⚠️ Une fonction avec `finally` n'est pas compilée, sans avertissement (règle `todo` coupée,
  vu sur eslint-plugin-react-hooks 7) ; le `try/catch` simple l'est.
- `react-hooks/incompatible-library` signale une lib que le Compiler ne suit pas : `watch()` de
  React Hook Form → `useWatch`.
- Sortie de secours : `'use no memo'` en tête de fonction, avec un commentaire qui dit pourquoi.

## TanStack Query

- Une abstraction ne prend pas de paramètre `options` : étaler au point d'appel,
  `useQuery({ ...xOptions(), select })`.
- **Prefetch** : `queryClient.query(xOptions()).catch(noop)` (5.102.0) ; `prefetchQuery` et
  `fetchQuery` sont dépréciées, `ensureQueryData` devient `query({ ...options, staleTime:
  'static' })` (vu sur @tanstack/react-query 5, retrait à la v6).
- ⚠️ `staleTime: 'static'` est insensible à `invalidateQueries` : `Infinity` si l'invalidation
  manuelle doit marcher.
- Passer le `signal` de la `queryFn` à `fetch` : sans lui, `cancelQueries` annule côté cache mais
  la requête réseau continue.
- **Polling** : palier volatile seulement (`archi.md` § Fraîcheur), jamais sous 60 s ;
  `refetchInterval` ignore `staleTime` ; l'arrêter en retournant `false`, pas par
  `enabled: false`, qui coupe aussi l'invalidation et le refetch.
