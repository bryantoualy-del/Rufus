# RPG Connect V5 — Table Libre

Branche coordonnée : `feat/rpg-connect-v5-table-libre`. Livraison à valider avec les sept autres dépôts de la Compagnie Créole. Aucun module de Pilot20 n’est modifié.

## Contrat

- Mode de session Table Libre par défaut sur serveur V5 ; Guidé garde le fonctionnement historique.
- État personnel local prioritaire ; seuls identité, PV, PV temporaires, CA, états, concentration et réaction remontent au groupe. Les jets, ressources, attaques et journaux personnels restent locaux.
- Encounter conserve l’initiative, les ennemis, le marqueur de tour et son journal d’interventions. Les PV/CA ennemis nécessitent une divulgation explicite du MJ.
- Les corrections du marqueur ne déclenchent pas de début de tour. Les débuts mécaniques utilisent la révision canonique du participant, avec déduplication persistée.
- Les salles serveur restent en mémoire, comme avant : un redémarrage serveur nécessite de recréer les invitations ; les données personnelles restent persistées sur chaque appareil.

## Interface et règles

L’onglet Groupe réutilise les capacités natives par sélecteur ; aucun second moteur de combat. La modale de choix d’alliés reste réservée aux capacités qui l’utilisent. Chaque joueur ne dispose que de l’éditeur de son propre état. La réaction de la barre se corrige librement dans les deux sens.

Les contours d’économie ne remplacent ni les fonds ni les formes des boutons. Les conditions de réaction inconnues du logiciel peuvent être confirmées par une case facultative « Déclencheur confirmé à la table » pour afficher la surbrillance ; cette case ne conditionne jamais l’utilisation de la capacité. Le vert émeraude provisoire est `#10b981`, à confronter à la référence visuelle MJ.

## Validation

Recette et audit centralisés dans `bryantoualy-del/Encounter`, `docs/RPG-CONNECT-V5-AUDIT.md` et `audit/v5-local.test.cjs`.

Contrôles locaux : 348 tests de régression Encounter, 7 tests serveur canonique, 7 parcours DOM (six HTML réels + sept applications connectées au vrai serveur). Riposte, Esquive instinctive, Bouclier, Protection, correction de réaction, ordre mixte, confidentialité ennemie, restauration et journal sont exercés.

**Validation visuelle non acquise.** Aucun navigateur exécutable disponible localement ; téléchargement Playwright invalide. Les tests DOM ne constituent pas une preuve de rendu Safari/iPad. Conserver la PR en brouillon, ne pas fusionner/déployer avant les captures et leur revue.
