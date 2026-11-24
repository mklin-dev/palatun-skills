---
name: conventions-ts
description: >-
  Use when writing or reviewing TypeScript or React code, or starting or touching a Next.js or
  Expo app or an API (Hono, tRPC): TS config, ESLint, Zod, components, hooks, data fetching, cache, forms, tests, dates,
  Sentry, dependencies, a project's AGENTS.md, or the Definition of Done. Not needed outside
  code.
paths:
  - "**/*.{ts,tsx}"
  - "**/package.json"
  - "**/tsconfig*.json"
---

# Conventions TS / React — tous projets

L'`AGENTS.md` du projet prime sur ce fichier quand l'écart est assumé et documenté.
Un piège qui dépend d'une version porte `(vu sur <paquet> <majeure>)`, un fait sans paquet
`(vérifié le AAAA-MM-JJ)` ; sans marqueur, la règle est censée durer.

## Les fichiers du skill

Ici, le langage du quotidien. À côté (`~/.claude/skills/conventions-ts/`, sinon
`.agents/skills/conventions-ts/` du dépôt), à lire avant d'agir : `archi.md` (app, version
majeure, fichiers, données) · `web.md` / `mobile.md` (la plateforme : auth, cache, UI) · `api.md` (une API maison : Hono, tRPC) ·
`setup.md` (socle, tsconfig, lint, hooks, `AGENTS.md` et docs d'un projet) · `references/` (Sentry, pnpm, socle d'une API, cas rares de React) · `sources.md` (d'où
vient chaque règle). Un renvoi vers un autre skill ne vaut que là où il est installé.

## Nommage

- Dossiers et fichiers en `kebab-case` (`drone-card.tsx`) ; constantes `UPPER_SNAKE`.
- Sauf le point d'entrée d'une feature, en PascalCase (`<Feature>Template.tsx`,
  `<Feature>Screen.tsx`) : `archi.md` § Où je mets ce fichier.

## TypeScript — règles

- **`any` interdit**, sauf en typage avancé (génériques contraints), par
  `eslint-disable-next-line` ciblé et commenté.
- **`satisfies`** pour un objet littéral ou une config, plutôt que `as Foo` ou `: Foo` : il garde
  l'inférence.
- **Un handler (`onClick`, `onSubmit`) n'est pas une fonction `async` nue** : il appelle une
  fonction qui gère l'erreur (le lint ne voit pas ce cas ; les autres promesses orphelines, si).
- **`as` interdit**, sauf `as const` et une conversion imposée par une lib ; narrower par un type
  guard `is`.
- **`readonly T[]` / `Readonly<T>` sur ce qu'on reçoit** (prop, paramètre), ciblé : `.push` ou
  `.sort` mute les données de l'appelant sans changer la référence, donc sans re-render.

## ESLint

- **`react-hooks/exhaustive-deps`, jamais coupé** : un disable fait sauter en silence la
  compilation de tout le composant par le Compiler. Ajouter la dépendance, `useEffectEvent` pour
  une valeur lue sans relancer l'effet (jamais pour une valeur qui doit le relancer), ou
  restructurer ; en dernier recours, un
  `eslint-disable-next-line` ciblé, sa raison après `--` (une paire `eslint-disable` /
  `eslint-enable` serrée sur le tableau de dépendances, s'il porte une alerte par ligne).
- **`@typescript-eslint/no-unused-vars`, jamais désactivé** non plus : souvent du vrai code mort.
- Le lint commun (`eslint.mjs`, dans le dossier de ce skill) et ce qui reste au projet :
  `setup.md` § ESLint.

## Validation runtime

- **Variables d'environnement** : schéma Zod `.parse()` au boot dans `env.ts`, importé en premier ;
  y crasher est voulu. `.env` jamais commité, `.env.schema` versionné si besoin.
- **Entrées non maîtrisées** (body HTTP, réponse API, params d'URL, storage) : typées `unknown` +
  `safeParse`. `parse` réservé au boot.

## Zod (v4)

- Erreurs : **`z.treeifyError(err)` / `z.flattenError(err)`** ; `err.flatten()` et `err.format()`
  sont dépréciées.
- **RHF et un schéma à `transform`, `default` ou `coerce`** : aucun générique (l'inférence part
  du `resolver`), ou les trois, `useForm<z.input<typeof s>, unknown, z.output<typeof s>>`. Un seul
  épingle input et output sur le même type et casse les `defaultValues`.
- **Schéma inline par défaut**, extrait en `.schema.ts` seulement si ≥ 2 consommateurs.

## Dates

- Un **instant** se stocke en `timestamptz` / ISO UTC. Une **date sans heure** (naissance, échéance)
  se stocke en `date` et se manipule en string `YYYY-MM-DD` — jamais via `new Date("2026-09-02")`,
  qui parse en UTC et décale d'un jour selon le fuseau.
- Pas de Temporal : pas Baseline, absent d'Hermes (vérifié le 2026-10-26).

## Composants

- **Cohésion avant nombre de lignes** : un composant d'une responsabilité de 250 lignes bat trois
  composants couplés de 50. Découper sur deux responsabilités mêlées ou une répétition.
- Écran ou onglet masqué dont l'état doit survivre (scroll, saisie) : `<Activity>`, ses pièges
  dans `references/react-details.md`.

## useEffect

- Réservé à la **synchronisation avec un système externe** (DOM, abonnement, timer, lib tierce),
  jamais pour fetcher.

## TanStack Query (état serveur côté client)

- **Web Next : pas par défaut** ; seulement pour un vrai besoin client (rafraîchir un bloc, liste
  infinie, cache partagé), jamais une Server Action dans une `queryFn` (elles partent en série).
- **React Native** : TanStack Query **est** la couche de cache ; gabarit et hors ligne :
  `mobile.md` § Données.
- Clés : une factory `queryOptions()` par feature, jamais une string de clé en dur ailleurs.
- **`staleTime` explicite** sur chaque query, pris dans `archi.md` § Fraîcheur (défaut 0 : refetch à chaque
  montage).
- **Erreurs** : `QueryCache.onError` global, Sentry dédupliqué par query ; toast seulement si des
  données sont déjà en cache (refetch de fond raté).
- Prefetch, `signal`, polling, `staleTime: 'static'`, paramètre `options` :
  `references/react-details.md`.

## Mémoïsation (React Compiler actif)

- Compiler actif partout (web et mobile) : **pas de `useMemo`, `useCallback` ni `React.memo` par
  défaut**.
- Exceptions : référence stable exigée par une lib non React ou par une dépendance d'effet ; une
  mémo existante reste (l'enlever change la sortie compilée).
- `finally` non compilé, `incompatible-library`, `'use no memo'` : `references/react-details.md`.

## Formulaires

- **React Hook Form + `zodResolver`**, web et mobile, schéma partagé : `<form action>` et
  `useActionState` n'existent pas en React Native, un défaut unique évite deux implémentations.
- Validation serveur, autorisation et canal de soumission : `web.md` § Actions et
  surface publique.

## Tests

- Co-localisés dans la feature (`__tests__/` ou `<fichier>.test.ts(x)`), jamais un arbre `tests/`
  à la racine. Vitest côté web, jest-expo côté mobile.

## Observabilité — Sentry

Avant de toucher à Sentry (`init`, `setUser`, envoi d'erreurs) : lire
`references/sentry.md`, dans le dossier de ce skill.

## Dépendances & sécurité

- **Dépôt déployé en production** : sa config pnpm et Dependabot (checklist, PR, routine, pièges
  pnpm 11) dans `references/pnpm-securite.md`, dans le dossier de ce skill ; sa CI : `ci-setup`.
- **`typescript` épinglé en `~6.0.3`** (vu sur typescript-eslint 8) : `latest` est TS 7, que le peer de
  typescript-eslint refuse (`< 6.1.0`) ; une montée de dépendances le garde, jusqu'à ce que ce
  peer accepte TS 7.

## Definition of Done

**Source unique** : les skills et les checklists des projets la citent sans la recopier.

1. `tsc --noEmit` passe (sortie visible).
2. `lint` passe **sans warning** (`--max-warnings 0`, sortie visible) : `exhaustive-deps`,
   `incompatible-library` et `unsupported-syntax` sont en `warn` (vu sur eslint-plugin-react-hooks 7).
3. `test` passe (sortie visible) ; sans test sur le chemin touché, le dire.
4. `build` passe (sortie visible).
5. Diff relu.

Les commandes de 1 à 4 : l'`AGENTS.md` du projet, § Commandes (sinon ses vérifications).
