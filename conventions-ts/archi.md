# Architecture — organiser une app par feature

Une app web (Next.js) ou mobile (Expo) se range par feature, partout pareil. Ce fichier porte le
commun ; le propre à la plateforme vit à côté, lu seul :

- **Next.js** → `web.md` · **Expo** → `mobile.md` · **API maison** → `api.md`.
- Le `AGENTS.md` du projet prime : un écart s'y écrit avec sa raison (`setup.md` § La doc du
  projet).

**Versions** — au bootstrap ou avant une version majeure (Next, SDK Expo), vérifier les breaking changes (`npm view`, docs officielles, context7).
La doc Expo Router se cherche par SDK, jamais par version de package.

## Geste — nouvelle feature

1. Lire le `AGENTS.md` du projet : § Organisation et § Conventions (ses écarts au modèle).
2. `features/<feature>/` + son point d'entrée ; « ça disparaîtrait avec la feature ? » décide
   de tout le reste (§ Où je mets ce fichier).
3. La route dans `app/` reste mince : elle importe le point d'entrée (§ Règle d'import).
4. Les données : le gabarit de la plateforme (`web.md` § Données ; `mobile.md` § Données). Pas
   de try/catch par écran : un filet global trie l'attendu (message à l'utilisateur) et
   l'imprévu (Sentry) : `web.md` § Erreurs et chargement, `mobile.md` § Réseau et hors ligne.
5. Le lint passe (§ Règle d'import et verrou), puis la Definition of Done (`SKILL.md`).

## Squelette

```text
src/
├── app/          routes uniquement : segments, layouts, chargement, erreur
├── features/
│   └── <feature>/   point d'entrée + seulement les sous-dossiers qui ont du contenu :
│                    components/  hooks/  lib/ (logique pure de la feature)
├── components/   UI partagée par ≥ 2 features ; ui/ = primitives
├── hooks/        hooks partagés par ≥ 2 features
├── stores/       état client global (thème, préférences), jamais de données serveur
└── lib/          helpers purs partagés, un fichier par sujet ; enveloppes d'une lib ou
                  d'une ressource : db/ (web), le proxy tRPC (mobile), auth/, env,
                  query-client, storage, erreurs
```

- Le lint tient cet arbre en liste blanche, l'intérieur d'une feature compris, quand le projet
  déclare son `type` ; son propre s'y ajoute par `allow` (`setup.md` § ESLint). Le code fait foi
  (`arbre()`, dans `eslint.mjs`).
- Un nouveau projet part du gabarit officiel, donc de `src/` (`@/*` → `./src/*`). Un projet
  existant à la racine ne migre pas : l'alias suffit, et le lint commun le prend par `src: '.'`
  (`setup.md` § ESLint).
- Un projet qui a déjà un `utils/` le garde et y range ses nouveaux helpers purs ; le lint
  commun le compte dans le partagé, et son arbre l'admet par `allow: ['utils']`.

## Où je mets ce fichier

```text
Ce code disparaîtrait-il avec la feature ?
├── oui → features/<feature>/
└── non → combien de features le consomment ?
    ├── ≥ 2, de l'UI           → components/ (ui/ si primitive générique)
    ├── ≥ 2, un hook React     → hooks/
    ├── état client global     → stores/
    └── ≥ 2, un helper pur,
        ou enveloppe une lib   → lib/
```

- Noms : `SKILL.md` § Nommage. Un suffixe dit le rôle, préfixé par l'entité :

| Rôle | Web | Mobile |
| --- | --- | --- |
| Point d'entrée de la route | `<Feature>Template.tsx` | `<Feature>Screen.tsx` |
| Accès aux données | `<entité>.data.ts` | aucun fichier : le proxy tRPC |
| Fonctions serveur / requêtes | `<entité>.actions.ts` | `<entité>.queries.ts` |
| Schéma Zod partagé | `<entité>.schema.ts` | `<entité>.schema.ts` |

- Un état client propre à une feature : `use-<feature>-store.ts` dans la feature. Un projet
  existant garde ses noms : c'est un écart, déclaré une fois.

## Règle d'import et verrou

- `app/` importe le partagé et, d'une feature, son point d'entrée seul (web : aussi son
  `.data.ts`, pour `generateMetadata`). Une feature importe le partagé, jamais `app/`.
- **Une feature n'importe jamais une autre feature.** Le commun monte dans le partagé.
- Le partagé n'importe jamais `features/` ni `app/` ; `lib/` n'importe que `lib/` (et `utils/`,
  là où il reste) et des paquets.
- `@/…` dès qu'on sort du dossier courant ; `./` entre voisins immédiats. Pas de barrel
  `index.ts` : on importe le fichier par son chemin.

**Trois verrous au lint**, sinon la règle dérive, écrits une fois pour tous les projets dans
`eslint.mjs`, à côté de ce fichier (`setup.md` § ESLint). Les deux premiers tirent toujours ; le
troisième vient avec `type`, qui refuse aussi `../` en `expo` et en `next` :

1. les features isolées : un dossier créé dans `src/features/` entre seul dans le verrou ;
2. le sens unique de la liste ci-dessus ; une route ne prend d'une feature ni ses `components/`,
   ni ses `hooks/`, ni son `lib/` ;
3. l'accès aux données : la base (`drizzle-orm`, `pg` ; `drizzle-orm/zod` à part, qui tire un
   schéma d'une table) dans les `*.data.ts` seulement, et
   `lib/db/` côté web ; la connexion, passée en paramètre, s'importe partout ; côté app, le proxy de l'API (`@trpc/client`,
   `@trpc/tanstack-react-query`, `@/lib/trpc`) dans les `*.queries.ts` et `lib/` seulement ; les
   tests restent libres. Sans `type`, le projet l'écrit lui-même, par `no-restricted-imports` :
   une exception y est un bloc qui **répète tous les motifs** (point suivant).

- `eslint.mjs` s'appuie sur le plugin `import` des presets : son peer dit ESLint 9, ses verrous
  tirent sous ESLint 10 (vu sur eslint-plugin-import 2).
- En flat config, deux blocs qui posent la même règle **ne fusionnent pas** : le dernier qui
  matche remplace. Un motif transverse se réplique dans chaque bloc, sinon il disparaît, lint vert.
- Le bloc le plus large d'abord, les exceptions ensuite ; vérifier ce qui s'applique à un fichier
  par `eslint --print-config <fichier>`, pas en relisant la config.
- Un test d'architecture seulement pour ce que le lint ne voit pas (route légère, `staleTime`) :
  il liste les fichiers fautifs, après avoir vérifié que chaque regex trouve quelque chose.

## Interdits

- Les couches sans lecteur : `repositories/`, `use-cases/`, `gateways/`, `adapters/`, `ports/`,
  un `services/` ou un `validations/` global sous `lib/`.
- Un composant métier dans `components/` ; une redirection (proxy, garde de nav) ou un groupe de
  routes `(…)` pris pour une sécurité : le serveur garde ses contrôles.
- Un monorepo avant qu'une deuxième app partage vraiment du code ; ensuite `apps/` + `packages/`.

## Données, partout pareil

### Fraîcheur

Quatre paliers, choisis par ce que coûte une donnée périmée ; chaque plateforme les écrit à sa
façon :

| Palier | Exemple | Web (Next) | Mobile (TanStack) |
| --- | --- | --- | --- |
| Référence | contenu public, catalogue | statique, sinon `cacheLife('hours')` ¹ | `staleTime` 30 min |
| Standard | listes métier | `cacheLife('minutes')` ¹, sinon rendu frais | 5 min |
| Volatile | état, tableau de bord | rendu frais, `router.refresh()` | 30 à 60 s |
| Écriture qui en dépend | stock avant commande | rendu frais, relu dans l'action | `0` |

- ¹ Web : ce que le cache Next a le droit de garder : `web.md` § Cache. Rafraîchir sans
  écriture : `web.md` § Données.

### Lectures

- **Types inférés, sans génération** : du schéma Drizzle côté serveur, du routeur tRPC côté
  app ; Zod pour les entrées seules.
- **Liste** : `orderBy()` sur une clé stable + `limit()` explicite, sinon ordre instable et
  troncature silencieuse.
- **Une panne n'est pas un vide**, à la forme de la plateforme : le web rend un objet avec un
  drapeau `failed` (le Server Component décide au rendu, sans relance côté client) ; le mobile
  lève l'erreur (TanStack relance, garde la donnée en cache et la classe).
- **Ce qui va jusqu'à l'écran** : le serveur construit un objet champ par champ (la donnée passe
  la frontière serveur → navigateur ou app : une colonne lue en trop part dans la page ou la
  réponse) ; l'app mobile garde l'objet que l'API rend, sans mapper (`api.md` § Accès aux
  données).

### TanStack Query

Ses règles, du code de tous les jours : `SKILL.md` § TanStack Query ; les cas rares :
`references/react-details.md`.
