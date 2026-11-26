# Architecture — mobile (Expo Router)

Le propre au mobile (iOS, Android et web dans une même app). Le commun (squelette, rangement,
imports, verrous) : `archi.md`.

**Backend : notre API (Hono + tRPC, `api.md`).** L'app la lit par le proxy tRPC (§ Derrière
notre API) ; une API externe déjà existante ne change que le contenu de `<entité>.queries.ts`
(§ Données).

## Règles d'or

1. **Route = réexport nu** : `app/posts/[id].tsx` exporte
   `features/posts/PostDetailScreen.tsx`. Un écran par route, zéro hook, zéro requête.
2. **L'écran ne touche jamais le client** : il consomme des `queryOptions` ou un hook. Le verrou 3
   permet le proxy (`@/lib/trpc`) dans `*.queries.ts` et `lib/` seulement (`api.md` § Verrous, 2).
3. **Largeur mesurée, jamais `Platform.OS`**, pour décider d'un layout.
4. **Zéro valeur visuelle hors du thème** : pas un hex, pas un `fontSize` dans un écran.

## Routes et navigation

- Un seul `_layout.tsx` racine sert iOS, Android et web ; pas de `_layout.web.tsx`.
- Auth = `<Stack.Protected guard={…}>` empilés dans ce layout, jamais une redirection par
  écran ; c'est un masquage client (`archi.md` § Interdits).
- `unstable_settings = { anchor: '(tabs)' }` sur le Stack racine : sans lui, un deep-link vers un
  écran secondaire n'a rien dessous et le retour sort de l'app.
- **La nav est de la donnée** : `components/navigation/nav-config.ts`, sans JSX, sans hook, sans
  `Platform.OS`, sans breakpoint en dur ; le layout des tabs se génère en la mappant ; `href`
  typé (`Href`).
- Shell adaptatif piloté par la largeur mesurée (un iPad en split-screen est étroit) ; seuils
  dans un module de constantes, lus par un hook. Tabs natives par défaut, tab bar JS seulement si
  le shell est adaptatif.
- **`@react-navigation/*` interdit** : passer par `expo-router/*` ; ne jamais couper le check du
  bundler pour passer.
- Suffixes `.ios` / `.android` / `.web` / `.native` réservés à une implémentation qui diffère
  vraiment ; une route garde sa version universelle. Un petit écart : `Platform.select`.
- Deep-link = fonction pure testable : payload `unknown` → `Href | null`, repli en cascade,
  feature flags consultés. Jamais d'écran cassé.
- Push : module en import dynamique dans un effet, derrière une gate (web, Expo Go). Le tap qui a
  ouvert l'app n'arrive pas au listener → `getLastNotificationResponse()` en plus (vu sur
  expo-notifications 58).

## Données

Un fichier par entité, dans la feature : ses `queryOptions`, tirées du proxy tRPC (`lib/trpc.ts`,
§ Derrière notre API). C'est l'intégration que tRPC recommande pour un projet neuf
(`@trpc/tanstack-react-query`) : le proxy rend les `queryOptions`, les clés et les types.

```ts
// features/posts/posts.queries.ts — les queryOptions et mutationOptions de l'entité
export const postsQueries = {
  list: () => trpc.posts.list.queryOptions(undefined, { staleTime: 5 * 60_000 }),
  // input inconnu au rendu : `enabled` et une garde, jamais `id!` ; pas `skipToken`, que montre
  // la doc tRPC : tirer pour rafraîchir (refetch) ne relance pas une query sautée par lui
  // (vu sur @tanstack/query-core 5)
  byId: (id: string | undefined) =>
    trpc.posts.byId.queryOptions({ id: id ?? '' }, { enabled: !!id, staleTime: 5 * 60_000 }),
}
export const createPostMutation = () => trpc.posts.create.mutationOptions({
  onSettled: () => queryClient.invalidateQueries(trpc.posts.pathFilter()),
})
```

- **`queryOptions` est l'abstraction** : l'écran fait `useQuery(postsQueries.list())`. Un
  hook (`use-posts.ts`) seulement s'il combine plusieurs choses, comme deux requêtes, ou une
  requête et un état de l'écran.
- Paliers de `staleTime` : `archi.md` § Fraîcheur ; polling : `references/react-details.md` ;
  règles de TanStack : `SKILL.md` § TanStack Query.
- **Les clés viennent de tRPC**, jamais écrites à la main ; une mutation invalide la racine de sa
  feature (`trpc.posts.pathFilter()`). Invalider une autre feature passe par le même proxy, sans
  import entre features.
- Liste, panne, ce qui va jusqu'à l'écran : `archi.md` § Lectures.
- On ne fait pas de fichier d'appels à côté (`<entité>.api.ts`) : le proxy en tient lieu.
- Une API externe déjà existante : ses `queryOptions` s'écrivent à la main dans le même
  `<entité>.queries.ts`, autour d'un `fetch`, clés en factory (`SKILL.md` § TanStack Query).
- Fichiers (`references/api-socle.md` § Fichiers) : envoi en `ArrayBuffer`, jamais en `Blob` (RN
  le sérialise en 0 octet) ; une URL signée qui manque rend une icône de repli, sans lever ; clé
  de cache image stable : la clé du fichier + `#<updated_at>`.

### Réseau et hors ligne

- **Classifieur réseau isolé, sans import** (chargé avant Sentry), source unique du `retry`, du
  toast, de Sentry et du repli hors ligne ;
  ce qu'il lit d'une erreur de l'API : § Derrière notre API.
- Ordre de tri : réseau > auth > refus (4xx) > le reste (= bug : toast + capture). Un refus se
  toaste tel quel, jamais Sentry.
- Canal unique : `MutationCache.onError` toaste, sauf `meta: { errorHandledLocally: true }` ;
  `QueryCache.onError` : `SKILL.md` § TanStack Query. Hors ligne, les relances sont en pause : pas de rafale.
- `networkMode: 'offlineFirst'` sur les queries, `'online'` sur les mutations (pause et rejeu à
  la reconnexion) ; `retry` en fonction qui coupe sur erreur déterministe ;
  `refetchOnWindowFocus: false`.
- `onlineManager` sur NetInfo **en natif seulement** ; `focusManager` sur `AppState` ; branchés
  une fois.
- `QueryBoundary` dans cet ordre : erreur sans données > en pause > chargement > contenu. Sans le
  cas `isPaused`, une query en pause reste `isPending` : skeleton infini.
- Persistance : `persistQueryClient`, réglé selon sa doc (`gcTime`, `buster`) ; pas de persister
  par query.

## Auth et session

- La session se lit par `authClient.useSession()`, le hook de Better Auth : ni Context maison, ni
  store. Sur une erreur transitoire (réseau), **on ne déconnecte pas** : on garde l'état courant ;
  seul un 401 déconnecte (§ Derrière notre API).
- Un champ d'identité chargeable a un statut tri-état (`loading | ready | error`) : `null` seul
  est ambigu et donne un spinner infini ou un écran blanc.
- **À la déconnexion** : `authClient.signOut()` d'abord (sinon un écran monté relance sa query),
  puis `queryClient.clear()` et la purge du persister et des clés de storage du namespace de
  l'app, sinon une query key sans userId fuit au compte suivant.
- Storage de session : SecureStore, par le plugin Expo de Better Auth ; pas de chiffrement maison
  par-dessus.

## Derrière notre API (tRPC)

Le client de l'API maison (`api.md`) ; le gabarit d'une entité : § Données.

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
- Le cache vit dans l'app, aux paliers d'`archi.md` § Fraîcheur ; l'API répond `no-store`
  (`references/api-socle.md` § Serveur).
- **Les clés tRPC n'ont ni org ni user** : à la déconnexion (§ Auth et session) comme au
  changement d'org (`organization.setActive`), `queryClient.clear()` et la purge du persister.
- Côté app, le classifieur de § Réseau et hors ligne lit `error.data?.httpStatus`
  d'une `TRPCClientError` : absent → réseau ; 401 → déconnexion, sans toast ; 412 → écran de mise
  à jour (`api.md` § Versions installées de l'app) ; 400 → erreurs par champ (`data.zodError`), jamais le
  `message`, qui est le JSON des issues ; autre 4xx → refus, toast du message, sans Sentry ni
  `retry` ; 500 et plus → bug (vu sur @trpc/client 11).

## UI plateforme

- Une seule primitive `Sheet` dans `components/ui/`. `Modal` hors popovers natifs, `Alert.alert`
  et `window.confirm` interdits (no-op ou hors thème en navigateur) → un `ConfirmDialog`.
- Les primitives lisent `useSafeAreaInsets()`.
- Thème : tokens sémantiques ; paires « soft » plutôt que des opacités à la main. Sans
  `colorScheme` synchronisé, `dark:` est du code mort : l'interdire.
- Une famille d'icônes par projet ; chaque primitive de `components/ui/` citée dans `DESIGN.md`,
  vérifié par un test.

## Tests, build et EAS

- Mêmes `exclude` dans tsc, eslint et jest.
- E2E : Maestro, 3 ou 4 parcours critiques, optionnel.
- `runtimeVersion` en policy `fingerprint` si l'app a expo-updates (OTA) ; le numéro de build vit chez EAS
  (`ci-setup/expo-eas.md`). Env validé par Zod en CI (`ci-setup/check.md`).
- Secrets hors du dépôt, jamais en `EXPO_PUBLIC_`.
- Sentry, plateforme seulement : init native, wrapper metro d'Expo (sans lui, pas de Debug ID),
  plugin dans la config, intégration Expo Router ; le reste → `SKILL.md`.

## Non-défauts assumés

| On ne fait pas | Pourquoi |
| --- | --- |
| Local-first (LiveStore, TanStack DB, Legend State…) | outillage pas mûr, selon Expo |
| MMKV | prebuild + dépendance native ; AsyncStorage suffit |
| Detox | Maestro est le seul E2E documenté par Expo |
| Optimistic par défaut | rollback complexe pour un gain rare |
