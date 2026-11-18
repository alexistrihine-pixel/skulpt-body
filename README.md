<p align="center">
  <img src="./assets/images/icon.png" alt="Logo Skulpt Body" width="112" />
</p>

<h1 align="center">Skulpt Body</h1>

<p align="center">
  Carnet de musculation pour Android, basé sur <a href="https://github.com/skulptapp/skulpt">Skulpt</a>.<br />
  Gratuit, sans compte, sans pub : tes données restent sur ton téléphone.
</p>

<p align="center">
  <a href="https://github.com/alexistrihine-pixel/skulpt-body/releases/latest/download/skulpt.apk"><img src="https://img.shields.io/badge/Download_APK-Android-b49cff?style=for-the-badge&logo=android&logoColor=black&labelColor=b49cff" alt="Download APK (Android)" height="48" /></a>
</p>

<p align="center">
  <a href="https://github.com/alexistrihine-pixel/skulpt-body/releases/latest"><img src="https://img.shields.io/github/v/release/alexistrihine-pixel/skulpt-body?label=derni%C3%A8re%20version&color=6035e6" alt="Dernière version" /></a>
  &nbsp;
  <a href="./LICENSE"><img src="https://img.shields.io/badge/licence-GPL--3.0-22c55e" alt="Licence GPL-3.0" /></a>
</p>

<p align="center">
  <img src="./docs/screenshots/01-accueil.png" alt="Accueil : semaine en cours et prochaine séance" width="200" />
  <img src="./docs/screenshots/03-seance.png" alt="Séance en cours avec le chrono de repos" width="200" />
  <img src="./docs/screenshots/06-series.png" alt="Séries par semaine et par groupe musculaire" width="200" />
  <img src="./docs/screenshots/08-poids.png" alt="Courbe de poids avec tendance" width="200" />
</p>

<p align="center"><sub>Captures faites avec des données de démonstration.</sub></p>

## Installer

1. Sur ton téléphone Android, touche **Download APK** ci-dessus.
2. Ouvre le fichier téléchargé et autorise l'installation d'applis inconnues si Android le demande. Si Play Protect propose d'analyser l'appli, choisis « Ne pas envoyer » puis « Installer quand même ».
3. C'est prêt. Pour mettre à jour, refais la même chose : la nouvelle version s'installe par-dessus et garde tes séances.

Le détail de chaque version est dans les [Releases](https://github.com/alexistrihine-pixel/skulpt-body/releases).

## Fonctionnalités

### Accueil

- La semaine en cours en haut, avec les jours où tu t'es entraîné.
- **Prochaine séance** : le programme que tu as fait il y a le plus longtemps, avec son nombre d'exercices, de séries et sa durée estimée, et un bouton pour la lancer.
- Tes séances prévues et terminées, rangées par semaine.

### Séance en cours

<p>
  <img src="./docs/screenshots/03-seance.png" alt="Séance en cours" width="220" />
  <img src="./docs/screenshots/04-pave.png" alt="Pavé numérique intégré" width="220" />
</p>

- Tous les exercices de la séance sur une seule page, chacun avec son tableau de séries : numéro, **précédent** (ce que tu as fait la dernière fois), kg, répétitions et un bouton ✓ par série.
- **Fourchettes de répétitions** (par exemple 6-8) affichées dans la case tant que tu n'as rien saisi.
- **Pavé numérique intégré** : +1 / −1, passage au champ suivant, et la touche ✓ sur le dernier champ valide la série.
- **Chrono de repos** ancré en bas de l'écran, lancé automatiquement à chaque série validée, avec −15 s / +15 s et « Passer ». La durée par défaut et le démarrage auto se règlent dans Réglages › Minuteur de repos.
- Durée, volume total et séries faites sur la séance en haut ; « Terminer » toujours accessible.
- Types de séries (échauffement, travail, dégressive, échec), séries en temps ou en distance, supersets et circuits.
- **Notes par exercice et par salle** : pratique quand tu t'entraînes dans deux salles aux machines différentes.

### Séances (programmes)

<p>
  <img src="./docs/screenshots/02-seances.png" alt="Onglet Séances" width="220" />
</p>

- Tes programmes (Upper, Lower, Push…) avec leurs exercices, leurs séries, leurs fourchettes de répétitions et la date de la dernière fois.
- Une touche pour lancer la séance, pré-remplie avec tes charges.

### Résultats

<p>
  <img src="./docs/screenshots/05-resultats.png" alt="Calendrier des séances" width="220" />
  <img src="./docs/screenshots/06-series.png" alt="Séries par groupe musculaire" width="220" />
  <img src="./docs/screenshots/07-biceps.png" alt="Détail du biceps par chef" width="220" />
  <img src="./docs/screenshots/08-poids.png" alt="Courbe de poids" width="220" />
</p>

- **Calendrier** des jours d'entraînement et **résumé d'activité** (temps passé à la salle, comparé au mois précédent).
- **Séries par semaine** en anneaux, sur la semaine dernière ou en moyenne sur 6 semaines. Touche un groupe (Bras) pour voir ses muscles, puis un muscle marqué › (Biceps) pour voir chaque chef (chef long, chef court, brachial). Muscle principal = 1 série, secondaire = ½.
- **Courbe de poids** (et de masse grasse) sur 1 mois, 3 mois, 6 mois, 1 an ou tout, avec une ligne de tendance sur 7 jours. Reste appuyé sur la courbe pour lire une pesée.
- Statistiques globales : semaines et jours d'entraînement, heures, séances, volume, séries, répétitions.

### Exercices

<p>
  <img src="./docs/screenshots/09-exercices.png" alt="Liste des exercices" width="220" />
  <img src="./docs/screenshots/10-progression.png" alt="Progression d'un exercice" width="220" />
</p>

- Ta bibliothèque d'exercices, rangée par groupe musculaire, avec recherche.
- Muscles principaux et secondaires détaillés jusqu'aux chefs et faisceaux (faisceau claviculaire, chef long du triceps…).
- Fiche de chaque exercice : **progression** du 1RM estimé, historique des séances, records et statistiques.

### Réglages

<p>
  <img src="./docs/screenshots/11-couleurs.png" alt="Choix des couleurs" width="220" />
</p>

- **Couleurs** : violet par défaut, 5 autres palettes sombres ou la tienne (Réglages › Thème).
- Thème clair, sombre ou celui du système ; unités kg/lb ; langue ; sons et vibrations.
- Tout en français. Les données sont stockées sur le téléphone : pas de compte, pas de synchronisation, pas de pub.

## Crédits et licence

Ce fork n'est ni affilié ni soutenu par l'équipe Skulpt : merci aux auteurs d'origine. Comme l'original, il est distribué sous licence [GPL-3.0](./LICENSE) ; le code de chaque APK est celui du tag de la release.

Certaines fonctionnalités s'inspirent d'applications de suivi existantes, dont Hevy. Hevy est une marque de ses propriétaires ; ce projet n'est ni affilié ni soutenu par Hevy.

Pour les développeurs : le README d'origine (architecture, commandes, build) est dans [README.upstream.md](./README.upstream.md).
