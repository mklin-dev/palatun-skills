<img src="docs/img/banniere.svg" alt="palatun : les skills Claude Code partagés par les projets de l'équipe" width="100%">

<p align="center">
<a href="docs/verif-feature.md"><img src="docs/img/carte-verif-feature.svg" alt="verif-feature : prouver qu'une branche est prête avant la PR ou le merge" width="32%"></a>
<a href="docs/juridique.md"><img src="docs/img/carte-juridique.svg" alt="juridique : ce qu'un site doit afficher, selon ce qu'il fait" width="32%"></a>
<a href="docs/issues.md"><img src="docs/img/carte-issues.svg" alt="issues : créer, découper, regrouper et fermer les issues GitHub" width="32%"></a>
</p>

## Où ils interviennent

<img src="docs/img/flow.svg" alt="Le flow d'une feature : l'issue (issues), le code, la vérif (verif-feature), la PR, le merge ; juridique pendant le code" width="100%">

Claude les charge seul quand ta demande s'y prête ; pour en forcer un : `/palatun:<skill>`.

## Installer

Un projet qui déclare le plugin le propose à l'ouverture de Claude Code : accepter. À la main :

```
/plugin marketplace add mklin-dev/palatun-skills
/plugin install palatun@palatun-skills
```

Mettre à jour : `/plugin marketplace update palatun-skills`, puis `/plugin update palatun@palatun-skills`.

<details>
<summary>Déclarer le plugin dans un projet</summary>

Dans son `.claude/settings.json`, commité :

```json
{
  "extraKnownMarketplaces": {
    "palatun-skills": { "source": { "source": "github", "repo": "mklin-dev/palatun-skills" } }
  },
  "enabledPlugins": { "palatun@palatun-skills": true }
}
```

</details>

## Modifier un skill

**Ne rien modifier ici** : ce dépôt est régénéré ; une correction se demande à l'auteur du plugin.
