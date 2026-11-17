// ---------- Player's Handbook (2014) subclasses that aren't in the SRD ----------
// Feature names and levels with short summaries in our own words; the full rules text is in the Player's Handbook.
const PHB_SUBCLASSES = [
  ["Barbarian", "Path of the Totem Warrior", [
    [3, "Spirit Seeker", "You can cast beast sense and speak with animals, but only as rituals."],
    [3, "Totem Spirit", "Pick a totem animal for your rage. Bear: while raging, resistance to all damage except psychic. Eagle: while raging, opportunity attacks against you have disadvantage and you can Dash as a bonus action. Wolf: while raging, your allies have advantage on melee attacks against enemies within 5 feet of you."],
    [6, "Aspect of the Beast", "A lasting gift from a totem animal. Bear: double carrying capacity and advantage on Strength checks to push, pull, lift or break. Eagle: see clearly up to a mile, and dim light doesn't hinder your Perception. Wolf: track at a fast pace and move stealthily at a normal pace."],
    [10, "Spirit Walker", "You can cast commune with nature, but only as a ritual."],
    [14, "Totemic Attunement", "Another totem boon while raging. Bear: hostile creatures within 5 feet have disadvantage attacking anyone but you. Eagle: you can fly at your walking speed (you fall if you end your turn in the air). Wolf: when you hit with a melee attack, use a bonus action to knock a Large or smaller target prone."]]],
  ["Bard", "College of Valor", [
    [3, "Bonus Proficiencies", "You gain proficiency with medium armour, shields and martial weapons."],
    [3, "Combat Inspiration", "A creature with your Bardic Inspiration die can add it to a weapon damage roll, or to its AC against one attack after seeing the roll."],
    [6, "Extra Attack", "You can attack twice when you take the Attack action."],
    [14, "Battle Magic", "When you use your action to cast a bard spell, you can make one weapon attack as a bonus action."]]],
  ["Cleric", "Knowledge Domain", [
    [1, "Domain Spells", "Always prepared: 1st command, identify · 3rd augury, suggestion · 5th nondetection, speak with dead · 7th arcane eye, confusion · 9th legend lore, scrying."],
    [1, "Blessings of Knowledge", "Learn two languages, and gain proficiency in two of Arcana, History, Nature or Religion, with your proficiency bonus doubled for them."],
    [2, "Channel Divinity: Knowledge of the Ages", "Gain proficiency with one skill or tool of your choice for 10 minutes."],
    [6, "Channel Divinity: Read Thoughts", "Read the surface thoughts of a creature within 60 feet that fails a Wisdom save, and you can then cast suggestion on it without a spell slot."],
    [8, "Potent Spellcasting", "Add your Wisdom modifier to the damage of your cleric cantrips."],
    [17, "Visions of the Past", "Meditate to see glimpses of an object's past owners or of events that happened in the area around you."]]],
  ["Cleric", "Light Domain", [
    [1, "Domain Spells", "Always prepared: 1st burning hands, faerie fire · 3rd flaming sphere, scorching ray · 5th daylight, fireball · 7th guardian of faith, wall of fire · 9th flame strike, scrying."],
    [1, "Bonus Cantrip", "You learn the light cantrip."],
    [1, "Warding Flare", "As a reaction, flash light at an attacker within 30 feet to give its attack disadvantage. Uses equal to your Wisdom modifier per long rest."],
    [2, "Channel Divinity: Radiance of the Dawn", "Dispel magical darkness within 30 feet; hostile creatures there make a Constitution save or take 2d10 + your cleric level radiant damage (half on a success)."],
    [6, "Improved Flare", "You can use Warding Flare when a creature attacks someone else within 30 feet of you."],
    [8, "Potent Spellcasting", "Add your Wisdom modifier to the damage of your cleric cantrips."],
    [17, "Corona of Light", "For a minute you shine bright light 60 feet around you, and enemies in it have disadvantage on saves against your fire and radiant spells."]]],
  ["Cleric", "Nature Domain", [
    [1, "Domain Spells", "Always prepared: 1st animal friendship, speak with animals · 3rd barkskin, spike growth · 5th plant growth, wind wall · 7th dominate beast, grasping vine · 9th insect plague, tree stride."],
    [1, "Acolyte of Nature", "Learn one druid cantrip, and gain proficiency in Animal Handling, Nature or Survival."],
    [1, "Bonus Proficiency", "You gain proficiency with heavy armour."],
    [2, "Channel Divinity: Charm Animals and Plants", "Beasts and plant creatures within 30 feet that fail a Wisdom save are charmed by you for a minute."],
    [6, "Dampen Elements", "As a reaction, give yourself or a creature within 30 feet resistance to acid, cold, fire, lightning or thunder damage from one hit."],
    [8, "Divine Strike", "Once per turn, a weapon hit deals an extra 1d8 cold, fire or lightning damage (2d8 from 14th level)."],
    [17, "Master of Nature", "As a bonus action, command animals and plants you've charmed."]]],
  ["Cleric", "Tempest Domain", [
    [1, "Domain Spells", "Always prepared: 1st fog cloud, thunderwave · 3rd gust of wind, shatter · 5th call lightning, sleet storm · 7th control water, ice storm · 9th destructive wave, insect plague."],
    [1, "Bonus Proficiencies", "You gain proficiency with martial weapons and heavy armour."],
    [1, "Wrath of the Storm", "As a reaction when a creature within 5 feet hits you, it takes 2d8 lightning or thunder damage (Dexterity save for half). Uses equal to your Wisdom modifier per long rest."],
    [2, "Channel Divinity: Destructive Wrath", "When you deal lightning or thunder damage, deal the maximum instead of rolling."],
    [6, "Thunderbolt Strike", "When you deal lightning damage to a Large or smaller creature, you can push it up to 10 feet away."],
    [8, "Divine Strike", "Once per turn, a weapon hit deals an extra 1d8 thunder damage (2d8 from 14th level)."],
    [17, "Stormborn", "You have a flying speed equal to your walking speed when you aren't underground or indoors."]]],
  ["Cleric", "Trickery Domain", [
    [1, "Domain Spells", "Always prepared: 1st charm person, disguise self · 3rd mirror image, pass without trace · 5th blink, dispel magic · 7th dimension door, polymorph · 9th dominate person, modify memory."],
    [1, "Blessing of the Trickster", "Touch a willing creature to give it advantage on Stealth checks for an hour."],
    [2, "Channel Divinity: Invoke Duplicity", "Create an illusory double of yourself for a minute (concentration). You can cast spells from its space, and have advantage on attacks against a creature you and it are both within 5 feet of."],
    [6, "Channel Divinity: Cloak of Shadows", "Become invisible until the end of your next turn."],
    [8, "Divine Strike", "Once per turn, a weapon hit deals an extra 1d8 poison damage (2d8 from 14th level)."],
    [17, "Improved Duplicity", "Invoke Duplicity makes up to four doubles."]]],
  ["Cleric", "War Domain", [
    [1, "Domain Spells", "Always prepared: 1st divine favor, shield of faith · 3rd magic weapon, spiritual weapon · 5th crusader's mantle, spirit guardians · 7th freedom of movement, stoneskin · 9th flame strike, hold monster."],
    [1, "Bonus Proficiencies", "You gain proficiency with martial weapons and heavy armour."],
    [1, "War Priest", "When you take the Attack action, make one weapon attack as a bonus action. Uses equal to your Wisdom modifier per long rest."],
    [2, "Channel Divinity: Guided Strike", "Add +10 to one of your attack rolls after seeing the roll."],
    [6, "Channel Divinity: War God's Blessing", "As a reaction, add +10 to an attack roll made by a creature within 30 feet."],
    [8, "Divine Strike", "Once per turn, a weapon hit deals an extra 1d8 damage of the weapon's type (2d8 from 14th level)."],
    [17, "Avatar of Battle", "Resistance to bludgeoning, piercing and slashing damage from nonmagical weapons."]]],
  ["Druid", "Circle of the Moon", [
    [2, "Combat Wild Shape", "Wild Shape as a bonus action. While transformed, spend a spell slot as a bonus action to regain 1d8 hit points per slot level."],
    [2, "Circle Forms", "Wild Shape into beasts up to CR 1; from 6th level, up to your druid level divided by 3 (rounded down). The usual limits on swimming and flying forms still apply."],
    [6, "Primal Strike", "Your attacks in beast form count as magical."],
    [10, "Elemental Wild Shape", "Spend two uses of Wild Shape to become an air, earth, fire or water elemental."],
    [14, "Thousand Forms", "You can cast alter self at will."]]],
  ["Fighter", "Battle Master", [
    [3, "Combat Superiority", "Learn three manoeuvres and gain four superiority dice (d8s) to fuel them; regain them on a short rest. More manoeuvres at 7th, 10th and 15th level, and a fifth and sixth die at 7th and 15th."],
    [3, "Student of War", "Gain proficiency with one type of artisan's tools."],
    [7, "Know Your Enemy", "Study a creature for a minute to learn how it compares to you in two characteristics (ability scores, AC, hit points, level)."],
    [10, "Improved Combat Superiority", "Your superiority dice become d10s."],
    [15, "Relentless", "When you roll initiative with no superiority dice left, you regain one."],
    [18, "Improved Combat Superiority", "Your superiority dice become d12s."]]],
  ["Fighter", "Eldritch Knight", [
    [3, "Spellcasting", "You learn wizard spells, mostly abjuration and evocation, using Intelligence. A third caster."],
    [3, "Weapon Bond", "Bond with up to two weapons: you can't be disarmed of them and can summon one to your hand as a bonus action."],
    [7, "War Magic", "When you use your action to cast a cantrip, make one weapon attack as a bonus action."],
    [10, "Eldritch Strike", "A creature you hit with a weapon has disadvantage on its next save against your spells before the end of your next turn."],
    [15, "Arcane Charge", "When you use Action Surge, you can teleport up to 30 feet."],
    [18, "Improved War Magic", "When you use your action to cast a spell, make one weapon attack as a bonus action."]]],
  ["Monk", "Way of Shadow", [
    [3, "Shadow Arts", "Spend 2 ki to cast darkness, darkvision, pass without trace or silence. You also learn minor illusion."],
    [6, "Shadow Step", "As a bonus action, teleport up to 60 feet from dim light or darkness to dim light or darkness, with advantage on your next melee attack that turn."],
    [11, "Cloak of Shadows", "As an action in dim light or darkness, become invisible until you attack, cast a spell or step into bright light."],
    [17, "Opportunist", "As a reaction, attack a creature within 5 feet of you when someone else hits it."]]],
  ["Monk", "Way of the Four Elements", [
    [3, "Disciple of the Elements", "Learn Elemental Attunement and one elemental discipline, spending ki to create elemental effects and cast elemental spells."],
    [6, "Extra Elemental Discipline", "Learn another elemental discipline, and you may swap one you know."],
    [11, "Extra Elemental Discipline", "Learn another elemental discipline, and you may swap one you know."],
    [17, "Extra Elemental Discipline", "Learn another elemental discipline, and you may swap one you know."]]],
  ["Paladin", "Oath of the Ancients", [
    [3, "Oath Spells", "Always prepared: 3rd ensnaring strike, speak with animals · 5th misty step, moonbeam · 9th plant growth, protection from energy · 13th ice storm, stoneskin · 17th commune with nature, tree stride."],
    [3, "Channel Divinity", "Nature's Wrath: spectral vines restrain a creature that fails a Strength or Dexterity save. Turn the Faithless: fey and fiends within 30 feet that fail a Wisdom save are turned."],
    [7, "Aura of Warding", "You and friendly creatures within 10 feet have resistance to damage from spells (30 feet from 18th level)."],
    [15, "Undying Sentinel", "Once per long rest, drop to 1 hit point instead of 0. You also stop showing signs of age."],
    [20, "Elder Champion", "Transform for a minute: regain 10 hit points at the start of each turn, cast paladin spells with a casting time of 1 action as a bonus action, and enemies within 10 feet have disadvantage on saves against your paladin spells and Channel Divinity."]]],
  ["Paladin", "Oath of Vengeance", [
    [3, "Oath Spells", "Always prepared: 3rd bane, hunter's mark · 5th hold person, misty step · 9th haste, protection from energy · 13th banishment, dimension door · 17th hold monster, scrying."],
    [3, "Channel Divinity", "Abjure Enemy: a creature within 60 feet makes a Wisdom save or is frightened with speed 0 for a minute. Vow of Enmity: advantage on attacks against one creature for a minute."],
    [7, "Relentless Avenger", "After you hit with an opportunity attack, move up to half your speed without provoking opportunity attacks."],
    [15, "Soul of Vengeance", "When the target of your Vow of Enmity attacks, make a melee attack against it as a reaction."],
    [20, "Avenging Angel", "Transform for an hour: wings give you a 60-foot flying speed, and an aura of menace can frighten enemies within 30 feet."]]],
  ["Ranger", "Beast Master", [
    [3, "Ranger's Companion", "Gain a beast companion of CR 1/4 or lower that adds your proficiency bonus to its AC, attacks, damage and proficient saves and skills. It acts on your command (an action)."],
    [7, "Exceptional Training", "Command your companion to Dash, Disengage, Dodge or Help as a bonus action, and its attacks count as magical."],
    [11, "Bestial Fury", "Your companion can attack twice when you command it to Attack."],
    [15, "Share Spells", "A spell you cast on yourself can also affect your companion if it's within 30 feet."]]],
  ["Rogue", "Assassin", [
    [3, "Bonus Proficiencies", "You gain proficiency with the disguise kit and the poisoner's kit."],
    [3, "Assassinate", "Advantage on attacks against creatures that haven't taken a turn yet in combat, and any hit against a surprised creature is a critical hit."],
    [9, "Infiltration Expertise", "Spend seven days and 25 gp to build a convincing false identity."],
    [13, "Impostor", "After studying someone for three hours, mimic their speech, writing and behaviour."],
    [17, "Death Strike", "When you hit a surprised creature, it makes a Constitution save or takes double damage."]]],
  ["Rogue", "Arcane Trickster", [
    [3, "Spellcasting", "You learn wizard spells, mostly enchantment and illusion, using Intelligence. A third caster."],
    [3, "Mage Hand Legerdemain", "Your mage hand is invisible and can stow or take objects, pick locks and disarm traps at range."],
    [9, "Magical Ambush", "If you're hidden when you cast a spell, the target has disadvantage on its save."],
    [13, "Versatile Trickster", "As a bonus action, use your mage hand to distract a creature within 5 feet of it, giving you advantage on attacks against it this turn."],
    [17, "Spell Thief", "As a reaction when a spell targets you, try to steal it: you can cast it yourself for 8 hours, and the caster can't for that time."]]],
  ["Sorcerer", "Wild Magic", [
    [1, "Wild Magic Surge", "After you cast a sorcerer spell of 1st level or higher, the DM can have you roll a d20; on a 1, roll on the Wild Magic Surge table."],
    [1, "Tides of Chaos", "Gain advantage on one attack, check or save. You get it back after a long rest, or when the DM has you roll for a surge."],
    [6, "Bend Luck", "As a reaction, spend 2 sorcery points to add or subtract 1d4 from another creature's attack, check or save."],
    [14, "Controlled Chaos", "When you roll on the Wild Magic Surge table, roll twice and pick either result."],
    [18, "Spell Bombardment", "Once per turn, when a damage die rolls its highest number, roll it again and add it."]]],
  ["Warlock", "The Archfey", [
    [1, "Expanded Spell List", "Added to your warlock spells: 1st faerie fire, sleep · 2nd calm emotions, phantasmal force · 3rd blink, plant growth · 4th dominate beast, greater invisibility · 5th dominate person, seeming."],
    [1, "Fey Presence", "Creatures in a 10-foot cube from you make a Wisdom save or are charmed or frightened (your choice) until the end of your next turn. Once per short rest."],
    [6, "Misty Escape", "When you take damage, use your reaction to turn invisible and teleport up to 60 feet. Once per short rest."],
    [10, "Beguiling Defenses", "You can't be charmed, and you can turn a charm attempt back on the creature that made it."],
    [14, "Dark Delirium", "Charm or frighten a creature within 60 feet for a minute (concentration) while it believes it's lost in a misty realm. Once per short rest."]]],
  ["Warlock", "The Great Old One", [
    [1, "Expanded Spell List", "Added to your warlock spells: 1st dissonant whispers, Tasha's hideous laughter · 2nd detect thoughts, phantasmal force · 3rd clairvoyance, sending · 4th dominate beast, Evard's black tentacles · 5th dominate person, telekinesis."],
    [1, "Awakened Mind", "Speak telepathically to any creature within 30 feet you can see."],
    [6, "Entropic Ward", "As a reaction, give an attack against you disadvantage; if it misses, you have advantage on your next attack against that creature. Once per short rest."],
    [10, "Thought Shield", "Your thoughts can't be read, you have resistance to psychic damage, and a creature that deals psychic damage to you takes the same amount."],
    [14, "Create Thrall", "Touch an incapacitated humanoid to charm it until a remove curse ends it, and speak to it telepathically."]]],
  ["Wizard", "School of Abjuration", [
    [2, "Abjuration Savant", "Copying abjuration spells into your spellbook costs half the gold and time."],
    [2, "Arcane Ward", "Casting an abjuration spell creates a ward with hit points equal to twice your wizard level plus your Intelligence modifier that soaks damage for you, and recharges as you cast more abjuration spells."],
    [6, "Projected Ward", "As a reaction, your Arcane Ward absorbs damage for a creature within 30 feet."],
    [10, "Improved Abjuration", "Add your proficiency bonus to ability checks made as part of abjuration spells (such as counterspell and dispel magic)."],
    [14, "Spell Resistance", "Advantage on saves against spells and resistance to their damage."]]],
  ["Wizard", "School of Conjuration", [
    [2, "Conjuration Savant", "Copying conjuration spells into your spellbook costs half the gold and time."],
    [2, "Minor Conjuration", "Conjure a nonmagical object up to 3 feet on a side and 10 pounds that lasts an hour."],
    [6, "Benign Transposition", "Teleport up to 30 feet, or swap places with a willing Small or Medium creature. Usable again after a long rest or casting a conjuration spell."],
    [10, "Focused Conjuration", "Taking damage can't break your concentration on a conjuration spell."],
    [14, "Durable Summons", "Creatures you summon or create with conjuration spells gain 30 temporary hit points."]]],
  ["Wizard", "School of Divination", [
    [2, "Divination Savant", "Copying divination spells into your spellbook costs half the gold and time."],
    [2, "Portent", "After a long rest, roll two d20s and keep them; you can replace any attack, check or save you can see with one of them."],
    [6, "Expert Divination", "Casting a divination spell of 2nd level or higher regains a lower-level spell slot."],
    [10, "The Third Eye", "As an action, gain darkvision, ethereal sight, the ability to read any language, or see invisibility until your next rest."],
    [14, "Greater Portent", "Roll three d20s for Portent instead of two."]]],
  ["Wizard", "School of Enchantment", [
    [2, "Enchantment Savant", "Copying enchantment spells into your spellbook costs half the gold and time."],
    [2, "Hypnotic Gaze", "As an action, charm a creature within 5 feet that fails a Wisdom save, leaving it incapacitated with speed 0 while you keep it up."],
    [6, "Instinctive Charm", "As a reaction when a creature within 30 feet attacks you, it makes a Wisdom save or must attack the nearest other creature instead."],
    [10, "Split Enchantment", "A single-target enchantment spell can target a second creature."],
    [14, "Alter Memories", "A creature you charm doesn't realise it was charmed, and you can make it forget some of its time charmed."]]],
  ["Wizard", "School of Illusion", [
    [2, "Illusion Savant", "Copying illusion spells into your spellbook costs half the gold and time."],
    [2, "Improved Minor Illusion", "You learn minor illusion, and can make it produce a sound and an image at the same time."],
    [6, "Malleable Illusions", "Use an action to change a lasting illusion you've cast."],
    [10, "Illusory Self", "As a reaction, an illusory double makes one attack against you miss. Once per short rest."],
    [14, "Illusory Reality", "Make one inanimate, nonmagical object in your illusion real for a minute."]]],
  ["Wizard", "School of Necromancy", [
    [2, "Necromancy Savant", "Copying necromancy spells into your spellbook costs half the gold and time."],
    [2, "Grim Harvest", "When you kill with a spell, regain hit points equal to twice its level (three times for necromancy spells)."],
    [6, "Undead Thralls", "Animate dead raises one extra corpse, and your undead gain extra hit points and add your proficiency bonus to their weapon damage."],
    [10, "Inured to Undeath", "Resistance to necrotic damage, and your hit point maximum can't be reduced."],
    [14, "Command Undead", "Take control of an undead creature that fails a Charisma save."]]],
  ["Wizard", "School of Transmutation", [
    [2, "Transmutation Savant", "Copying transmutation spells into your spellbook costs half the gold and time."],
    [2, "Minor Alchemy", "Spend 10 minutes to temporarily turn one material (wood, stone, iron, copper or silver) into another."],
    [6, "Transmuter's Stone", "Make a stone that gives its holder darkvision, extra speed, Constitution save proficiency, or resistance to an energy type."],
    [10, "Shapechanger", "Cast polymorph on yourself without a spell slot to become a beast of CR 1 or lower. Once per short rest."],
    [14, "Master Transmuter", "Destroy your stone to transmute an object, cure ailments, raise the dead, or make someone younger."]]]
];

// Full names for the SRD subclasses (the SRD data calls them "Life", "Lore" and so on), and their spell lists.
const SRD_SUB_NAMES = { Berserker: "Path of the Berserker", Lore: "College of Lore", Life: "Life Domain", Land: "Circle of the Land", Champion: "Champion", "Open Hand": "Way of the Open Hand", Devotion: "Oath of Devotion", Hunter: "Hunter", Thief: "Thief", Draconic: "Draconic Bloodline", Fiend: "The Fiend", Evocation: "School of Evocation" };
const SRD_SUB_SPELLS = {
  Life: [1, "Domain Spells", "Always prepared: 1st bless, cure wounds · 3rd lesser restoration, spiritual weapon · 5th beacon of hope, revivify · 7th death ward, guardian of faith · 9th mass cure wounds, raise dead."],
  Devotion: [3, "Oath Spells", "Always prepared: 3rd protection from evil and good, sanctuary · 5th lesser restoration, zone of truth · 9th beacon of hope, dispel magic · 13th freedom of movement, guardian of faith · 17th commune, flame strike."],
  Fiend: [1, "Expanded Spell List", "Added to your warlock spells: 1st burning hands, command · 2nd blindness/deafness, scorching ray · 3rd fireball, stinking cloud · 4th fire shield, wall of fire · 5th flame strike, hallow."]
};
function phbSubclassDocs(now) {
  const out = [];
  for (const [cls, d] of Object.entries(SRD_CLASS_FEATS)) for (const sub of d.subs || []) {
    const best = new Map();
    d.f.filter(f => f.sub === sub).forEach(f => { const k = featKey(f.n); const cur = best.get(k); if (!cur || f.lv > cur.lv) best.set(k, f); });
    const features = [...(SRD_SUB_SPELLS[sub] ? [{ n: SRD_SUB_SPELLS[sub][1], lv: SRD_SUB_SPELLS[sub][0], d: SRD_SUB_SPELLS[sub][2] }] : []), ...[...best.values()].map(f => ({ n: f.n, lv: f.lv, d: f.d || "" }))].sort((a, b) => a.lv - b.lv);
    out.push({ title: SRD_SUB_NAMES[sub] || sub, type: "subclass", tags: [], body: "", source: "SRD 5.1 (2014)", created: now, updated: now, subclass: { cls, alias: sub, features } });
  }
  for (const [cls, name, feats] of PHB_SUBCLASSES)
    out.push({ title: name, type: "subclass", tags: [], body: "*From the Player's Handbook. These are short summaries; the book has the full rules.*", source: "Player's Handbook (summary)", created: now, updated: now,
      subclass: { cls, features: feats.map(([lv, n, d]) => ({ n, lv, d })) } });
  return out;
}
