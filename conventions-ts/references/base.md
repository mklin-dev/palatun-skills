# La base — Postgres + Drizzle

> Lu à la création d'un projet et avant de toucher à la connexion, au schéma, aux migrations ou
> aux fichiers, sur renvoi de `web.md` et d'`api.md`. Le quotidien d'une requête : `web.md`
> § Données, `api.md` § Accès aux données.

- Connexion selon l'hébergement :
  - **Workers** : Hyperdrive + `pg`, un client par requête (workerd réserve l'I/O au contexte
    d'une requête) ; Hyperdrive reçoit la chaîne directe de
    Neon (pooling décoché), rôle dédié, binding par `import { env } from 'cloudflare:workers'`.
    ⚠️ Hyperdrive cache les SELECT 60 s : `wrangler hyperdrive update <id> --caching-disabled`,
    sauf choix écrit. Ni Postgres.js avec Drizzle, ni le driver serverless de Neon.
  - **VPS (Node)** : un Pool TCP au niveau module (sur l'URL poolée seulement si la base reste
    sur Neon), `max` explicite, `pool.on('error')` obligatoire
    (sinon crash du process), garde `globalThis` pour le hot-reload. Base sur le VPS plutôt que
    Neon : chaque requête paierait l'aller-retour (skill `infra`).
- `drizzle-kit` et les scripts prennent l'URL directe ; `.env` chargé explicitement hors Next.
- Auth : Better Auth en lib, adapter Drizzle, tables dans la base du projet (un `pg_dump`
  l'emporte). **Pas l'auth gérée par Neon**, même GA en UE : ni plugins, ni
  hooks, ni options, et elle lie l'app à Neon ; ne pas la re-proposer. Sur Workers, le hachage de
  Better Auth peut dépasser les 10 ms de CPU de l'offre gratuite (déduction) → Workers Paid.
- Fichiers : R2, bucket en juridiction `eu` (choisie à la création), privé, lu par URL signée.
  Le chemin est le bornage, dérivé de la session, jamais du formulaire ; le type se lit dans les
  octets, jamais dans le type déclaré (un SVG annoncé PNG est un XSS stocké) ; la colonne stocke
  le chemin.
- Migrations : `push` en local seulement ; partagé → `generate` + `migrate`, SQL commité, script
  `db:migrate` réellement appelé.
- Schéma : PK `uuid` générée en base, timestamps avec timezone, `onDelete: cascade`, colonne de
  tenant sur chaque table métier, unicité préfixée par le tenant, FK indexées. Une contrainte
  unique sur une colonne nullable n'empêche rien (deux NULL passent).
- Idempotence : la contrainte unique en base garantit le non-doublon ;
  `insert().onConflictDoNothing({ target }).returning()` puis relire si vide. Dans une
  transaction, seulement l'objet de transaction.
- RLS pas par réflexe : seul le serveur touche la base, elle y doublerait la logique d'accès.
  Data API inutilisée → la couper.
- Derrière un pooler en mode transaction, pas de prepared statements (panne en prod seulement).
