# Compagnie Créole — contrat local CompanionAPI v1

Les six compagnons restent autonomes. `companion-api.js` n'ouvre aucune connexion, ne lit aucun serveur et n'expose aucun nœud DOM. Chaque dépôt fournit un `window.__CompanionBridge` qui appelle son moteur existant ; `window.CompanionAPI` expose le même contrat de données et de commandes. Charger le pont après le moteur, puis `companion-api.js` en dernier.

## API

```js
const api = window.CompanionAPI;
api.version; // 1
api.getCharacter(); // { id, name, actors: [{ id, name, owner? }] }
api.getState();     // copie, jamais une référence à l'état interne
api.damage(amount, options?);
api.heal(amount, options?);
api.setHP(value);
api.setTemporaryHP(value);
api.setResource(key, value);
api.changeResource(key, delta);
api.setRollMode('normal' | 'adv' | 'dis' | 'manual');
api.nextTurn();
api.undo();
const off = api.subscribe(event => { /* traitement local */ });
off(); // ou api.unsubscribe(callback)
```

Les méthodes `startTurn`, `endTurn`, `setConcentration`, `clearConcentration`, `addInventoryItem`, `updateInventory`, `removeInventoryItem`, `applyHitDecision(hit, attackId?)` et `applyRemoteEvent(event)` figurent aussi au contrat. Une commande inapplicable à un personnage lève une erreur explicite. `applyRemoteEvent` ne reçoit rien du réseau : il applique seulement une liste fermée de commandes locales (`hp:damage`, `hp:heal`, `hp:set`, `tempHp:set`, `resource:set`, `turn:next`, `attack:decision`) et ignore un `id` déjà traité. La future couche réseau devra authentifier et valider les commandes avant cet appel.

La commande de dégâts appelle la logique locale du personnage, notamment absorption des PV temporaires et conséquences de concentration existantes. La source de vérité reste le compagnon. `setResource` n'accepte que les clés exposées par son adaptateur, et les valeurs invalides sont rejetées. L'API n'invente pas de mécanique pour les personnages dépourvus de concentration ou de certains modes de jet.

## État normalisé

```js
{
  characterId: 'samoth', characterName: 'Samoth',
  hp: { current: 72, max: 72, temp: 0 }, ac: 14,
  turn: { number: 1, round: 1, active: 'samoth',
          action: true, bonus: true, reaction: true,
          movement: true, damage: 0 },
  concentration: null, resources: {},
  inventorySummary: [{ id: '…', name: '…', quantity: 1 }],
  statuses: [], custom: {}, updatedAt: '2026-…'
}
```

`turn.action`, `bonus`, `reaction` et `movement` signifient **disponible** (`true`), **utilisé** (`false`) ou **non suivi** (`null`). Le `custom` est propre à chaque personnage. Il n'inclut ni notes, ni PNJ, ni données Obsidian. `updatedAt` reflète le dernier changement observé par le pont local ; une sauvegarde importée peut modifier cet état au chargement sans produire un événement antérieur au chargement.

| Personnage | Données propres exposées |
| --- | --- |
| Kentaro | Spectre, phase, malédiction et cible active, cibles récentes, voile et pacte |
| Samoth | Esprit draconique sous `actors` avec `owner: samoth`, phase et économie du dragon, métamagie |
| Brack Mard | Dés de supériorité, Fougue, Second souffle, manœuvre sélectionnée |
| Rufus | Sournoise de tour et de réaction, dé psi, Linceul, Vision, Lame de feu |
| Nans | Rage, Frénésie, Volto-Fendoir, Cor, Surcharge, épuisement |
| Zéphyr | Slots, Châtiment armé, Frappe guidée, Canalisation, BINAH |

## Bus local

```js
{ id: 'nans-…', type: 'attack:pending-hit',
  characterId: 'nans', timestamp: '2026-…',
  payload: { attackId: 'nans-…', actor: 'nans' } }
```

Un `attack:rolled` porte son propre `id`, réutilisé comme `payload.attackId` dans `attack:pending-hit`, puis `attack:hit` ou `attack:miss`. Les autres événements émis par le pont sont `companion:ready`, `state:changed`, `hp:changed`, `tempHp:changed`, `resource:changed`, `inventory:changed`, `turn:started` et `undo:performed`. Chaque abonné reçoit une copie ; `window` reçoit aussi `companion:event` avec le même objet. Le pont suit les mutations au moment où le moteur persiste ou rend l'action, sans polling. Les événements de combat plus riches (`damage:dealt`, demandes de réaction, état MJ, messages ciblés) restent à documenter et brancher lorsque RPG Connect sera construit.

## Contraintes pour RPG Connect

- Un seul client réseau par compagnon ; Samoth et le Dragon partagent une connexion, avec `actor` distinct.
- Passer par les commandes et événements ; ne pas modifier le DOM ni dépendre du format localStorage.
- Dédupliquer les commandes distantes par `event.id` et rattacher les décisions MJ à `attackId`.
- Garder le mode autonome, les règles, les FX et la sauvegarde locaux.
- Ne jamais synchroniser les notes de session, PNJ ou exports Obsidian de Kentaro par défaut.

## Limites à valider en jeu

Les actions automatiques sans décision de touche (par exemple un sort à JdS) ne produisent pas `attack:pending-hit`. Les réglages manuels de ressources et les inventaires provenant de l'ancien module V3 conservent leurs sauvegardes d'origine. Le pont ne garantit pas encore une transaction distribuée entre une décision MJ et plusieurs clients : elle appartient à la future couche RPG Connect.
