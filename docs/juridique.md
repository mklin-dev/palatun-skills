[← Accueil](../README.md)

# ⚖️ juridique

Le minimum légal d'un site, ni plus ni moins : Claude regarde ce que fait le site et en déduit ce
qu'il doit afficher.

> [!TIP]
> Se lance quand le site gagne ou change un formulaire, une réservation, un paiement, de
> l'analytics, un pixel, une vidéo ou une carte intégrée, une newsletter ou une relance de panier ;
> ou quand on touche une page légale (mentions, CGV, confidentialité, cookies, consentement).

## Selon ce que fait le site

Les cas se cumulent.

| Si le site… | Il affiche |
| --- | --- |
| 🌐 existe | mentions légales : éditeur, SIRET, directeur de la publication, adresse, téléphone, e-mail ; hébergeur : nom, adresse, téléphone ; une section données personnelles |
| 📊 mesure son audience avec Umami | rien de plus : pas de bannière |
| 📝 a un formulaire | près du bouton, une ligne : à quoi servent les données |
| 🍪 pose un traceur (pixel publicitaire, Google Analytics, vidéo ou carte intégrée) | une bannière, « Tout refuser » au même niveau que « Tout accepter » ; le traceur se charge après l'accord |
| 📅 réserve un service à prix fixe, même payé sur place | des conditions liées au parcours, en page ou dans les mentions légales : prix, annulation, rétractation 14 j |
| 🛒 vend en ligne | CGV (prix, livraison, retours, rétractation 14 j), confidentialité, mail de commande ; un bouton qui dit qu'on paie (« Commander et payer », « Payer 49 € ») |
| 📨 envoie une newsletter | une case non cochée avant le premier envoi, sauf à un client qui a déjà acheté ; un lien de désinscription dans chaque mail |
| 🔁 relance un panier abandonné | un lien d'arrêt dans chaque mail |

> [!CAUTION]
> **Jamais**, ni proposé, ni audité, ni remonté en issue : le médiateur de la consommation ; la
> fonction de rétractation en ligne ; garder la version des CGV acceptée par chaque client ;
> l'accord préalable à une relance de panier (le lien d'arrêt suffit).

Vérifié le 2026-11-04 (Legifrance, CNIL, Service Public).

Templates, quand le dépôt en a : `@shared/legal` (mentions d'une vitrine), `@modules/legal` (CGV,
confidentialité d'un e-commerce).
