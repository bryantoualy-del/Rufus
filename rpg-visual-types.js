/* Visual reference for D&D damage and conditions. Does not change protocol IDs. */
(function(root) {
  'use strict';
  const damageTypes = [
    {"id": "bludgeoning", "name_fr": "Contondant", "filename_256": "degats_contondant.png", "filename_64": "degats_contondant_64.png"},
    {"id": "piercing", "name_fr": "Perforant", "filename_256": "degats_perforant.png", "filename_64": "degats_perforant_64.png"},
    {"id": "slashing", "name_fr": "Tranchant", "filename_256": "degats_tranchant.png", "filename_64": "degats_tranchant_64.png"},
    {"id": "fire", "name_fr": "Feu", "filename_256": "degats_feu.png", "filename_64": "degats_feu_64.png"},
    {"id": "cold", "name_fr": "Froid", "filename_256": "degats_froid.png", "filename_64": "degats_froid_64.png"},
    {"id": "lightning", "name_fr": "Foudre", "filename_256": "degats_foudre.png", "filename_64": "degats_foudre_64.png"},
    {"id": "thunder", "name_fr": "Tonnerre", "filename_256": "degats_tonnerre.png", "filename_64": "degats_tonnerre_64.png"},
    {"id": "acid", "name_fr": "Acide", "filename_256": "degats_acide.png", "filename_64": "degats_acide_64.png"},
    {"id": "poison", "name_fr": "Poison", "filename_256": "degats_poison.png", "filename_64": "degats_poison_64.png"},
    {"id": "necrotic", "name_fr": "Nécrotique", "filename_256": "degats_necrotique.png", "filename_64": "degats_necrotique_64.png"},
    {"id": "radiant", "name_fr": "Radiant", "filename_256": "degats_radiant.png", "filename_64": "degats_radiant_64.png"},
    {"id": "psychic", "name_fr": "Psychique", "filename_256": "degats_psychique.png", "filename_64": "degats_psychique_64.png"},
    {"id": "force", "name_fr": "Force", "filename_256": "degats_force.png", "filename_64": "degats_force_64.png"},
  ];
  const conditions = [
    ["blinded", "Aveuglé", "Aveugle", ["aveugle"]],
    ["charmed", "Charmé", "Charme", []],
    ["deafened", "Assourdi", "Assourdi", []],
    ["frightened", "Effrayé", "Effraye", ["terrorise"]],
    ["grappled", "Agrippé", "Agrippe", ["empoigne"]],
    ["incapacitated", "Neutralisé", "Incapacite", ["incapacite", "incapacite_d_agir", "incapable_d_agir"]],
    ["invisible", "Invisible", "Invisible", []],
    ["paralyzed", "Paralysé", "Paralyse", []],
    ["petrified", "Pétrifié", "Petrifie", []],
    ["poisoned", "Empoisonné", "Empoisonne", []],
    ["prone", "À terre", "A_terre", []],
    ["restrained", "Entravé", "Entrave", []],
    ["stunned", "Étourdi", "Etourdi", []],
    ["unconscious", "Inconscient", "Inconscient", []],
    ["exhaustion", "Épuisement", "Epuise", ["epuise", "exhausted"]],
  ];
  const normalize = value => String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const damageByName = new Map(damageTypes.flatMap(entry => [
    [entry.id, entry], [normalize(entry.name_fr), entry],
  ]));
  const conditionByName = new Map(conditions.flatMap(([id, label, file, aliases]) => {
    const entry = {id, label, file};
    return [id, normalize(label), ...aliases].map(key => [key, entry]);
  }));
  function damage(value) {
    const key = normalize(value);
    return damageByName.get(key) ?? damageByName.get(key.replace(/s$/, '')) ?? null;
  }
  function condition(value) {
    return conditionByName.get(normalize(value)) ?? null;
  }
  function damageIcon(value, size = 28) {
    const entry = damage(value);
    if (!entry) return null;
    const icon = root.document.createElement('img');
    icon.className = 'rpg-damage-icon';
    icon.src = './assets/icons/damage/' + entry.filename_256;
    icon.width = icon.height = size;
    icon.alt = entry.name_fr;
    icon.title = entry.name_fr;
    return icon;
  }
  root.RPGVisualTypes = Object.freeze({damage, damageIcon, condition});
})(typeof window !== 'undefined' ? window : globalThis);
