---
name: juridique
description: Use when a website gains or changes a form, a booking or checkout flow, analytics, an ad pixel, an embedded video or map, or marketing e-mails (newsletter, abandoned cart), or when touching or auditing its legal pages — mentions légales, CGV, conditions, confidentialité, RGPD, cookies, bannière, consentement, rétractation, médiateur. Says what the site must show, and what never to add.
---

# juridique — ce qu'un site affiche, selon ce qu'il fait

Le minimum légal retenu par l'utilisateur, vérifié le 2026-11-04 (Legifrance, CNIL, Service
Public). Rien d'autre sans sa demande ; un risque nouveau se signale une fois, au bilan, sans issue.

## Jamais

Des obligations écartées par décision : ni proposées, ni auditées, ni remontées en issue. Un
constat de relecture sur l'une d'elles, ou sur une obligation absente du tableau, s'écarte sans
être remonté.

- le médiateur de la consommation ;
- la fonction de rétractation en ligne ;
- garder la version des CGV acceptée par chaque client ;
- l'accord préalable à une relance de panier : le lien d'arrêt dans chaque mail suffit.

## Selon ce que fait le site

Les cas se cumulent.

| Si le site… | Il affiche |
| --- | --- |
| existe | mentions légales : éditeur, SIRET, directeur de la publication, adresse, téléphone, e-mail ; hébergeur : nom, adresse, téléphone ; une section données personnelles |
| mesure son audience avec Umami | rien de plus : pas de bannière |
| a un formulaire | près du bouton, une ligne : à quoi servent les données |
| pose un traceur (pixel publicitaire, Google Analytics, vidéo ou carte intégrée) | une bannière, « Tout refuser » au même niveau que « Tout accepter » ; le traceur se charge après l'accord |
| réserve un service à prix fixe, même payé sur place | des conditions liées au parcours, en page ou en section des mentions légales : prix, annulation, rétractation 14 j |
| vend en ligne | CGV (prix, livraison, retours, rétractation 14 j), confidentialité, mail de commande ; un bouton qui dit qu'on paie (« Commander et payer », « Payer 49 € ») |
| envoie une newsletter | une case non cochée avant le premier envoi, sauf à un client qui a déjà acheté ; un lien de désinscription dans chaque mail |
| relance un panier abandonné | un lien d'arrêt dans chaque mail |

Templates, quand le dépôt en a : `@shared/legal` (mentions d'une vitrine), `@modules/legal` (CGV,
confidentialité d'un e-commerce).
