# V2.3 — Lot 1 — Rufus

Branche : `fix/v23-lot1-reliability`. Ni fusion ni déploiement.

## Correctifs
Une écriture refusée laisse la partie jouable en mémoire et conserve la dernière sauvegarde. Une alerte persistante signale les modifications non enregistrées ; l'action suivante peut réessayer l'écriture. Un export de secours conserve la chaîne originale et la dernière chaîne dont l'écriture a échoué. Ce fichier de diagnostic n'est pas le format d'import natif : utiliser l'export natif pour les transferts ordinaires.

Une sauvegarde illisible est conservée à l'identique. Les écritures automatiques et la publication de cet état de remplacement vers RPG Connect sont bloquées. Une restauration explicite valide reste nécessaire. Aucune migration globale ni modification des ressources du personnage.

## Validation locale
Tests Node existants réussis. Chromium : chargement, modification des PV via le bridge natif, rechargement, injection QuotaExceededError, maintien de la partie et de l'original, téléchargement de secours, reprise des écritures et sauvegarde corrompue au démarrage.

Commande : `node e2e/storage-reliability.mjs` depuis ce dépôt ; Playwright installé dans le dépôt ou son parent. `E2E_BROWSER=webkit` sélectionne WebKit. Un workflow dédié exécute les deux moteurs. Les résultats CI doivent être consultés ; aucune recette physique iPad/iPhone revendiquée.

## Limites
Ce correctif ne transforme pas localStorage en base transactionnelle multi-onglets. Il ne peut garantir une sauvegarde lorsque le navigateur refuse toutes les écritures ; l'alerte et l'export rendent cet échec explicite. L'arrêt forcé du navigateur avant une sauvegarde réussie peut perdre les changements en mémoire.
