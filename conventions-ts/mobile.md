# Architecture — mobile (Expo Router)

Le propre au mobile (iOS, Android et web dans une même app). Le commun (squelette, rangement,
imports, verrous) : `archi.md`.

**Backend par défaut : Supabase direct + RLS, sans API maison.** Une API externe ne change que
`<entité>.api.ts` (un `fetch` au lieu du SDK) ; notre API maison (Hono + tRPC) change davantage
(clés, session, erreurs) : `api.md`.

## Règles d'or

1. **Route = réexport nu** : `app/posts/[id].tsx` exporte
   `features/posts/PostDetailScreen.tsx`. Un écran par route, zéro hook, zéro requête.
2. **L'écran ne touche jamais le client** : il consomme des `queryOptions` ou un hook. Le verrou 3
   permet le SDK dans `*.api.ts`, `lib/supabase.ts` et `lib/auth/` seulement.
3. **`staleTime` explicite** (`SKILL.md` § TanStack Query).
4. **Largeur mesurée, jamais `Platform.OS`**, pour décider d'un layout.
5. **Natif d'abord** : vérifier `@expo/ui` avant d'installer une lib UI.
6. **New Architecture obligatoire** : une dépendance native qui ne la supporte pas est morte.
7. **Zéro valeur visuelle hors du thème** : pas un hex, pas un `fontSize` dans un écran.

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
- **`@react-navigation/*` interdit** : Expo Router l'a forké, passer par `expo-router/*`. Deux
  copies coexisteraient sans erreur de build. Ne jamais couper le check du bundler pour passer.
- Suffixes `.ios` / `.android` / `.web` / `.native` réservés à une implémentation qui diffère
  vraiment, **hors de `src/app`** (une route exige sa version universelle), avec un `.d.ts`
  frère. Un petit écart : `Platform.select`.
- Une feature coupée par un flag garde chacune de ses routes (redirection vers l'accueil).
- Deep-link = fonction pure testable : payload `unknown` → `Href | null`, repli en cascade,
  feature flags consultés. Jamais d'écran cassé.
- Push : module en import dynamique dans un effet, derrière une gate (web, Expo Go). Le tap qui a
  ouvert l'app n'arrive pas au listener → `getLastNotificationResponseAsync()` en plus.

## Données

Deux fichiers par entité, dans la feature :

```ts
// features/posts/posts.api.ts — fonctions Supabase pures, Row BRUTE, testables hors React
export async function listPosts(orgId: string) {
  const { data, error } = await supabase
    .from('posts').select(POST_COLUMNS)
    .eq('organization_id', orgId)        // la RLS isole le TENANT, pas l'org ACTIVE
    .order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return data
}

// features/posts/posts.queries.ts — clés + queryOptions + mutationOptions
export const postsKeys = {
  all: ['posts'] as const,                   // sans orgId : l'invalidation par préfixe balaie tout
  list: (orgId: string) => [...postsKeys.all, orgId] as const,
}
export const postsQueries = {
  list: (orgId: string | undefined) => queryOptions({
    queryKey: postsKeys.list(orgId ?? 'none'),
    // `enabled` et une garde, jamais `orgId!` ; pas `skipToken` : tirer pour rafraîchir (refetch)
    // ne relance pas une query sautée par lui (vu sur @tanstack/query-core 5)
    queryFn: () => (orgId ? listPosts(orgId) : Promise.resolve([])),
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  }),
}
export const createPostMutation = () => mutationOptions({
  mutationFn: createPost,                    // de posts.api.ts
  onSettled: () => queryClient.invalidateQueries({ queryKey: postsKeys.all }),
})
```

- **`queryOptions` est l'abstraction** : l'écran fait `useQuery(postsQueries.list(orgId))`. Un
  hook (`use-posts.ts`) seulement s'il combine plusieurs choses, comme l'organisation active et
  la requête.
- Paliers de `staleTime` : `archi.md` § Fraîcheur ; polling : `references/react-details.md` ;
  règles de TanStack : `SKILL.md` § TanStack Query.
- Clés : `all` sans dimension, dérivés qui spreadent `...keys.all`, jamais une string en dur ;
  les mutations invalident la racine. Invalider une autre feature = importer sa factory de clés :
  seule exception à l'isolation, permanente, un `eslint-disable-next-line` motivé sur l'import. Plusieurs services d'un domaine qui s'invalident entre eux : un module de clés sans
  import de valeur, sinon un cycle produit des `undefined` à l'init, en silence.
- Écriture : `.select().maybeSingle()` puis `if (!row) throw new BusinessRuleError(…)`. **Zéro
  ligne = refus RLS, jamais un faux succès.** `.single()` pour l'insert seul ; `.maxAffected(n)`
  borne par le haut sans prouver qu'une ligne a bougé.
- Liste, panne, ce qui va jusqu'à l'écran : `archi.md` § Lectures.
- On ne fait pas : de mapper camelCase (la Row va jusqu'au JSX), d'envelope `{ success, data }`.
- Fichiers : bucket privé, chemin `{org}/{domaine}/{id}/{fichier}` avec la RLS sur le 1er
  segment ; la colonne stocke le chemin, re-signé à la lecture ; la signature ne throw pas
  (icône de repli) et a une version batch. Clé de cache image stable : le chemin + `#<updated_at>`.
  Upload en `ArrayBuffer`, jamais en `Blob` (RN le sérialise en 0 octet).

### Réseau et hors ligne

```text
queryFn ──► erreur ──► classifieur isolé ──┬─► retry ?        (TanStack)
                                           ├─► toast ?        (mutations, refetch de fond)
                                           ├─► Sentry ?       (queries)
                                           └─► repli hors ligne ?
```

- **Classifieur réseau isolé, sans import** (chargé avant Sentry), source unique des 4 branches :
  le client PostgREST ne rejette pas un fetch échoué, il le mappe en erreur à `code` vide.
- Ordre de tri : métier > réseau > auth > erreur base mappée > le reste (= bug : toast +
  capture). `BusinessRuleError` et `P0001` sont des refus métier : toast tel quel, jamais Sentry.
- Canal unique : `MutationCache.onError` toaste, sauf `meta: { errorHandledLocally: true }` ;
  `QueryCache.onError` : `SKILL.md` § TanStack Query. Hors ligne, les relances sont en pause : pas de rafale.
- `networkMode: 'offlineFirst'` sur les queries, `'online'` sur les mutations (pause et rejeu à
  la reconnexion) ; `retry` en fonction qui coupe sur erreur déterministe ;
  `refetchOnWindowFocus: false`.
- `onlineManager` sur NetInfo **en natif seulement** ; `focusManager` sur `AppState` ; branchés
  une fois, dans `lib/query-client`.
- `QueryBoundary` dans cet ordre : erreur sans données > en pause > chargement > contenu. Sans le
  cas `isPaused`, une query en pause reste `isPending` : skeleton infini.
- Persistance : `persistQueryClient` + un persister sur le storage, avec **`gcTime ≥ maxAge`** et
  un **`buster`** (hash de build). Pas de persister par query. Garder les mutations après un kill
  d'app : un cran explicite, optionnel.
- Écran non focalisé : prop `subscribed` de `useQuery` couplée à `useIsFocused()`, jamais
  `enabled` (qui vide l'état).
- Erreur d'Edge Function normalisée : message tiré du body, 4xx → `BusinessRuleError`, 5xx →
  `Error`.

## Auth et session

- `getClaims()` au boot + `onAuthStateChange` ; sur erreur transitoire, **on ne déconnecte pas** :
  on garde l'état courant et on lève le loading.
- `startAutoRefresh` / `stopAutoRefresh` sur `AppState` en natif, enregistrés une seule fois.
- La session vit dans un Context React, pas dans un store.
- Un champ d'identité chargeable a un statut tri-état (`loading | ready | error`) : `null` seul
  est ambigu et donne un spinner infini ou un écran blanc.
- **À la déconnexion** : `queryClient.clear()` et purge des clés de storage du namespace de l'app,
  sinon une query key sans userId fuit au compte suivant.
- Storage de session : l'adapter officiel, pas de chiffrement maison (3 dépendances et du crypto
  pour une session courte, révocable côté serveur). Chiffrer est une exception à justifier ; le
  ciphertext porte alors un préfixe de version (`v1:`) ; une valeur sans préfixe se lit telle
  quelle.
- Clé embarquée : la clé publishable, jamais un secret.
- 🩺 « La policy RLS est bonne mais l'app ne voit rien » → vérifier les GRANT d'abord.

## UI plateforme

- Modules sortis du core RN, jamais importés de `react-native` : `SafeAreaView`, `Picker`,
  `WebView`, l'`AsyncStorage` legacy. `expo-av` est mort (→ `expo-audio` / `expo-video`).
- Storage clé-valeur : `expo-sqlite/kv-store`.
- Une seule primitive `Sheet` dans `components/ui/`. `Modal` hors popovers natifs, `Alert.alert`
  et `window.confirm` interdits (no-op ou hors thème en navigateur) → un `ConfirmDialog`.
- Pas de `SafeAreaProvider` (Expo Router le fournit) ; les primitives lisent
  `useSafeAreaInsets()`.
- Thème : tokens sémantiques ; paires « soft » plutôt que des opacités à la main. Sans
  `colorScheme` synchronisé, `dark:` est du code mort : l'interdire.
- Une famille d'icônes par projet ; chaque primitive de `components/ui/` citée dans `DESIGN.md`,
  vérifié par un test.
- ⚠️ React Compiler + Reanimated : le compiler hisse les fonctions de `useDerivedValue` hors du
  worklet (« Tried to synchronously call a non-worklet function on the UI thread ») →
  `'use no memo'` en tête du fichier d'animation, avec un commentaire.

## Tests, build et EAS

- `render()` de RNTL est async, l'`await` est obligatoire ; du texte hors `<Text>` lève.
- Avant un `.test.ts` colocalisé, lire le `testMatch` de jest : s'il ne vise que `__tests__/`, le
  test ne tourne jamais. Alias `@/` remappé à la main (`moduleNameMapper`) ; mêmes `exclude`
  dans tsc, eslint et jest.
- E2E : Maestro, 3 ou 4 parcours critiques, optionnel.
- `runtimeVersion` en policy `fingerprint` ; le numéro de build vit chez EAS
  (`ci-setup/expo-eas.md`). Env validé par Zod en CI (`ci-setup/check.md`).
- 3 profils EAS, pas plus : `preview` porte la config, `development` et `production` l'héritent par
  `extends`. Secrets hors du dépôt, jamais en `EXPO_PUBLIC_`.
- Sentry, plateforme seulement : init native, wrapper metro d'Expo (sans lui, pas de Debug ID),
  plugin dans la config, intégration Expo Router ; le reste → `SKILL.md`.

## Non-défauts assumés

| On ne fait pas | Pourquoi |
| --- | --- |
| Local-first (LiveStore, TanStack DB, Legend State…) | outillage pas mûr, selon Expo |
| MMKV | prebuild + dépendance native ; `expo-sqlite/kv-store` suffit |
| Detox | Maestro est le seul E2E documenté par Expo |
| Optimistic par défaut | rollback complexe pour un gain rare |
