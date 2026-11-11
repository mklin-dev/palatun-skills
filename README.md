# palatun-skills

Le catalogue du plugin Claude Code `palatun` : les skills partagés des projets PALATUN
(`verif-feature`, `juridique`, `issues`).

**Ne rien modifier ici.** Ce dépôt est un miroir : les skills s'écrivent dans `setupator`
(`home/ia/skills/`), puis `apps/palatun-skills/sync.sh` les recopie et commite.

## Installer

Un projet qui déclare le plugin dans son `.claude/settings.json` le propose à l'ouverture : accepter.
À la main :

```
/plugin marketplace add mklin-dev/palatun-skills
/plugin install palatun@palatun-skills
```

Mettre à jour : `/plugin marketplace update palatun-skills`, puis `/plugin update palatun@palatun-skills`.
