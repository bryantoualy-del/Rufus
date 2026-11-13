# Rufus Companion V2

En Combat, choisis l’arme équipée et son projectile, puis appuie sur **Tirer**. Le jet consomme une munition et conserve le flux Touché/Raté. Un raté conserve la dépense. **Annuler la dernière action** restitue la munition et l’économie du tir. Les boutons + et − permettent les corrections de stock.

La roue dentée ouvre l’éditeur. Les quatre catégories spéciales démarrent à zéro. Avec le MJ, configure la compatibilité, les dégâts et les effets de table. Les dégâts supplémentaires acceptent un nombre ou une formule simple telle que `2d6+1`. Les dés propres à un projectile sont lancés une fois sur un touché, y compris sur un critique. Les dés de l’attaque native conservent leurs règles de critique. Le joueur lit au MJ les dégâts supplémentaires, le DD, la durée et les effets affichés. Le Mode Libre conserve les messages RPG Connect existants. Le mode guidé conserve son tir natif.

Le JSON **Munitions** transporte les profils et les stocks. L’export complet de Rufus les inclut également. Les anciens inventaires gardent leurs quantités. Aucun repos ne recharge les munitions. L’arc standard est traité comme un arc court (+7, 1d6+3), visible une fois équipé.

Après une première ouverture en ligne sur le même navigateur, le cache local permet de recharger Combat et de continuer hors connexion. Le jet social chiffré reste local. L’animation 3D des dés sociaux conserve sa dépendance CDN préexistante.

## Recette

- `node --test tests/*.test.cjs`
- `node e2e/level11-smoke.mjs` et `node e2e/rufus-v2.mjs` avec Playwright. Utiliser `E2E_BROWSER=webkit` pour WebKit.
- Le scénario reproductible utilise une connexion simulée avec les messages v5 existants. Un essai de bout en bout avec le serveur RPG Connect lancé localement a aussi vérifié l’invitation, la connexion et le tir spécial en Mode Libre. Les captures utilisent le viewport iPad Air 5 paysage (1180 × 820).

## Retour arrière

Exporter la sauvegarde complète depuis Journal → Sauvegarde. Avant fusion, garder `main` à sa version publiée. Après fusion, rétablir `22a59f4` via un revert de la PR. Les PV, ressources et stocks ordinaires restent dans la sauvegarde existante. Conserver l’export V2 pour restaurer profils et stocks spéciaux lors d’une réinstallation.

[Combat avant](docs/rufus-v2/Rufus-iPad-avant.jpg) · [Combat V2](docs/rufus-v2/Rufus-iPad-apres.jpg)
