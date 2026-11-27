// ===== The Rooms tab: #gen-<camp>/rooms =====
// Every room the building generator makes, by building: an example of it cut from a real generated building (its walls,
// doors and furniture as they'd be on the tabletop), what the room is for, and what's in it. 🎲 for another example.

// What a room is for. Looked up by "type:Name" first, then the first pattern that matches its name, then its kind.
const GEN_ROOM_TYPE_INFO = {
  "guildbranch:Guild hall": "The heart of the Guild branch: a big seating hall where adventurers wait, plan and drink between contracts. The quest boards hang on the walls with the open contracts pinned up; take one down and carry it to the quest desk at the back.",
  "guildhall:Guild hall": "The great quest hall of the Guild's city house: rows of tables for parties waiting on contracts, quest boards along the walls, and at the back the reception with its quest and parcel desks, open to the hall so you walk straight from the board to the counter.",
  "guildbranch:Reception": "Open to the guild hall with no wall between: two desks, one for quests (register with the Guild, sign up a party, take a contract off the board and have it assigned to you) and one for parcels (weigh, pay and hand over a package for the familiar post). The parcel store is right behind.",
  "guildhall:Reception": "Open to the great hall with no wall between: the quest desk, where adventurers register, sign their parties up and take on contracts from the boards, and the parcel desk, where letters too big for a transponder and packages are weighed and paid for the familiar post.",
  "guildbranch:Meeting room": "A room to hire by the hour: a party plans its next quest round the table, or two parties meet to arrange a joint exercise, away from the noise of the hall.",
  "guildhall:Meeting room": "A room to hire by the hour: a party plans its next quest round the table, or several parties meet to arrange a joint exercise, away from the noise of the hall.",
  "guildbranch:Guild bar": "A tavern that partners with the Guild runs the bar here, open onto the hall: ale and food for the adventurers waiting on contracts, and a cut for the Guild.",
  "guildhall:Guild bar": "A tavern that partners with the Guild runs the bar here, open onto the great hall: ale and food for the adventurers waiting on contracts, and a cut for the Guild.",
  "guildbranch:Guild kitchen": "The partner tavern's kitchen behind the bar, feeding the hall.", "guildhall:Guild kitchen": "The partner tavern's kitchen behind the bar, feeding the great hall.",
  "guildbranch:Parcel store": "Right behind the parcel desk: packages weighed and paid for wait on the shelves here for a licensed familiar to carry them.",
  "guildhall:Parcel store": "Right behind the parcel desk: packages weighed and paid for wait on the shelves here for a licensed familiar to carry them.",
  "guildbranch:Handlers' room": "The familiar handlers' room: perches for the familiars between runs, and the handlers who load them and send them off.",
  "guildhall:Handlers' room": "The familiar handlers' room: perches for the familiars between runs, and the handlers who load them and send them off.",
  "guildhall:Post clerks' room": "The clerks of the familiar post keep the books here: what went where, by which familiar, and what's owed.",
  "guildbranch:Sealed vault": "Locked and windowless: magic items and valuable parcels waiting for a licensed familiar, never left on the open shelves.",
  "guildhall:Sealed vault": "Locked and windowless: magic items and valuable parcels waiting for a licensed familiar, never left on the open shelves.",
  "relaypost:Public counter": "Where the town sends and collects letters to and from other cities: written letters are taken in here and passed to the relay crystal, and arriving ones are handed out.",
  "cityhall:Council chamber": "Where the city's council sits with the noble mayor or duke: the town's laws, taxes and quarrels are settled here.",
  "relaypost:Tower room": "Up the relay tower: the height lets the crystal reach the next city's relay.",
  "bathhouse:Tub room": "Wooden tubs for a private bath, the hot water carried in by the bath-keeper.",
  "mint:Sorting room": "New coins and blanks are sorted, counted and bagged here.",
  "gaol:Work room": "Where prisoners who can work earn their keep: picking oakum, beating hemp.",
  "gaol:Press room": "A grim room where the gaolers question stubborn prisoners.",
  "stable:Aisle": "The walk between the stalls, where the horses are led in and out.",
  "bakehouse:Oven room": "The bread ovens, fired with wood before each bake.",
  "apothecary:Grinding room": "Herbs, roots and minerals are ground into powders here.",
  "apothecary:Still room": "Where cordials, medicines and sweet waters are distilled.",
  // The keep (Dryrones castles)
  "keep:Forebuilding": "The keep's entrance: a covered stair and guard post in front of the door, so the way in can be held.",
  "keep:Screens passage": "The cross-passage at the low end of the great hall, behind its screen: the way in from the forebuilding, with the kitchen, buttery and pantry off it.",
  "keep:Great hall": "The banquet hall: the lord's high table on the dais at the far end, long tables down the room for the household and guests, banners of the family's arms. Feasts, audiences and the lord's justice.",
  "keep:Kitchen": "The castle kitchen: heat plates set with fire glyphs instead of open hearths, so no smoke, and work tables for the cooks feeding the whole household.",
  "keep:Buttery": "The drink store off the screens passage: ale and wine casks, served out to the hall.",
  "keep:Pantry": "The bread store off the screens passage, and the table linen and salt.",
  "keep:Guard hall": "Where the household's soldiers eat, wait and keep their weapons. In a small keep the pulley hoist stands here, to haul stores up between the floors.",
  "keep:Lift hall": "The foot of the lift well: the stone platform carved underneath with a levitation pattern, fed straight from the mana station below. Touch a floor's glyph on its control pillar and it rises. Only an attuned household sigil works it; in a siege the ward room locks it at the bottom.",
  "keep:Gallery": "The gallery round the lift shaft on each floor: the rooms of the floor open off it. Banners, family statues and lamps line it, and the stairs climb beside the shaft.",
  "keep:Waystone room": "A permanent circle linked to the capital, its pattern three shapes each made of sequences. Kept in its own warded room behind the guard hall, with no other way in: anyone who comes through arrives under the guards' eyes.",
  "keep:Steward's room": "The steward runs the estate and the household: the rents, the stores, the servants.",
  "keep:Chamberlain's room": "The chamberlain runs the lord's private rooms and who gets to see the lord.",
  "keep:Muniment room": "The family's charters, deeds and tax rolls, locked away.",
  "keep:Chapel": "The household's chapel, with its altar and pews.",
  "keep:Great chamber": "Where the lord receives important guests and does business in private, warmed by a glyph set into the floor.",
  "keep:Lord's bedchamber": "The lord's own room, warmed by a glyph in the floor, with a cleansing basin and a speaking crystal to the rest of the castle.",
  "keep:Wardrobe": "The lord's clothes and valuables, beside the bedchamber.",
  "keep:Lady's bower": "The lady's private rooms.",
  "keep:Council chamber": "Where the lord meets the officers of the household and the nobles of the lands; a living map of the lord's lands on the table, fed by the relay.",
  "keep:Study": "The lord's own study: spellbooks and treatises from the university, a warded case for the family's sealed books.",
  "keep:Magical workshop": "Where the lord practises and experiments: a casting circle chalked on the floor, reagents, a crystal bench. Plain stone, because magic goes wrong.",
  "keep:Library": "The castle library: university texts, the family's own spell records, maps.",
  "keep:Ward room": "The heart of the castle's defences: the ward sequences for every tower and wall laid out on the table, gauges showing their strength. In a siege the lord or the court mage strengthens a ward from here, and can lock the lift.",
  "keep:Guest chamber": "A bedchamber for a visiting noble.",
  "keep:Imbuement workshop": "The richest lords keep a master smith: an imbuement station to weave the patterns that make magic items, to make and mend the family's heirlooms.",
  "keep:Court mage's study": "The household mage's own study: adviser, warder and healer to the lord.",
  "keep:Court mage's chamber": "The household mage's bedchamber.",
  "keep:Observatory": "At the top of the keep: star-glasses and a chart table, for star charts and calculation.",
  "keep:Heirloom gallery": "The family's magic items on show behind warded glass: weapons, regalia, the founder's implement.",
  "keep:Spell vault": "Locked and warded: the family's sealed spellbooks and texts too dangerous to leave in the library.",
  "keep:Schoolroom": "Noble children learn magic young: a tutor teaches them here before they go to the university.",
  "keep:Tutor's chamber": "The children's tutor-mage lives here.",
  "keep:Undercroft": "The vaulted stores under the hall: grain, salted meat, wine, arms. A frost glyph in the floor keeps the meat.",
  "keep:Well chamber": "The castle's well, so it can hold out under siege.",
  "keep:Mana station": "The castle's own bleed node: storage cores fill with the household's excess mana, and feed the wards on the walls, the lamps and the lift.",
  "keep:Core vault": "Charged cores in store, locked away.",
  "keep:Treasury": "The lord's coin and plate behind iron doors.",
  "keep:Guardroom": "The gaolers' room at the foot of the stairs into the prison: the keys, a table, the watch.",
  "keep:Cells": "Prison cells: a pallet, a bucket, shackles.",
  "keep:Oubliette": "A pit cell reached only through a grate in the floor above, for prisoners to be forgotten.",
  "keep:Family crypt": "The family's tombs.",
  "keep:Sally passage": "A hidden tunnel out beyond the walls: for messengers, raids on besiegers, or escape.",
  "keep:North hall": "One arm of the great keep's cross of halls, open to the lift hall at the crossing: four broad halls meet at the lift, as at Chambord.",
  "keep:South hall": "One arm of the great keep's cross of halls, open to the lift hall at the crossing.",
  "keep:East hall": "One arm of the great keep's cross of halls, open to the lift hall at the crossing.",
  "keep:West hall": "One arm of the great keep's cross of halls, open to the lift hall at the crossing; the way in from the great hall.",
  "keep:North gallery": "Upstairs in the great keep, one arm of the cross of halls, open to the gallery round the lift: banners, statues, a table for waiting guests.",
  "keep:South gallery": "Upstairs in the great keep, one arm of the cross of halls, open to the gallery round the lift.",
  "keep:Heir's chamber": "The bedchamber of the lord's heir.",
  "keep:Lady's closet": "The lady's small private sitting room, beside her bower.",
  "keep:Vestry": "Where the chapel's vestments, plate and books are kept.",
  "keep:Stair foot": "The foot of the stairs into the lower vaults.",
  "keep:Cellar stairs": "The passage at the foot of the stairs into the undercroft.",
  "temple:Nave": "Where the townsfolk stand or sit for worship, looking towards the altar at the far end.",
};
const GEN_ROOM_INFO = [
  // The Guild and magic (Dryrones)
  [/^Familiar roost/, "Where the Guild's licensed familiars rest between runs: rows of perches, feed and water."],
  [/^Familiar infirmary/, "Nesting boxes for familiars that are hurt, sick or worn out from a long flight."],
  [/^(Licensing office)/, "Where the Guild licenses adventurers, familiars and magic workers, and checks that a licence is good."],
  [/^Wardens' office|^Warden's office/, "The office of the wardens who keep watch over the town's defences and wards."],
  [/^Wardens' muster room/, "Where the Guild's wardens gather before a patrol or a call-out: benches, weapons, the maps of the wards."],
  [/^Wardens' quarters/, "Bunks for the wardens on duty."],
  [/^Transport office/, "Arranges the Guild's transport: escorts, carriages and the long familiar routes."],
  [/^(Branch master's office|Guild master's office)/, "The office of the master who runs this house of the Guild."],
  [/^Masters' (meeting|council) room/, "Where the Guild's masters meet to run the house and settle its business."],
  [/^Records (hall|room)/, "The Guild's records: who is licensed, which contracts were taken and by whom, what was paid."],
  [/^Guild (strong room|vault)/, "The Guild's money and anything too valuable to leave out."],
  [/^Relay crystal chamber/, "The relay crystal: letters between cities are sent and received through it, a city at a time."],
  [/^Receiving room|^Sorting room/, "Where letters come off the relay and are sorted for the town, or for the next relay on."],
  [/^Registry/, "The registry of transponders: whose crystal is whose, so letters find their owners."],
  [/^Operator/, "For the crystal operators, who keep the relay running day and night."],
  [/^Control room/, "Where the keepers watch the gauges of the bleed tower and turn the flow of mana up or down."],
  [/^(Core store|Deep core store|Core cellar)/, "Storage cores, charged with excess mana, stacked and locked away."],
  [/^Venting room/, "If the stores fill up, excess mana is let out here safely, before it can build up into a mana disaster."],
  [/^Collector chamber/, "The collector at the top of the tower draws the natural mana out of the air before it can build up."],
  [/^Ward-feed room/, "Where the tower's mana feeds the town's wards and the lines out to the node houses."],
  [/^Keepers'? (workshop|room|lodge)|^Linesman's store/, "For the keepers who run the bleed tower and mend the lines."],
  [/^Transponder shop/, "Sells transponders, the telepathic crystals that call and send letters, and mends them."],
  [/^Attunement booth/, "A quiet booth where a new transponder learns its owner's mind."],
  [/^Crystal workshop/, "Where crystals are cut, set and mended."],
  [/^Core & adaptor shop/, "Sells adaptors for people with little mana of their own, and the small cores that run household things."],
  [/^Fitting room/, "Where an adaptor is fitted to its owner, or clothes to a customer."],
  [/^Charging room/, "Spent cores are topped up with mana here."],
  // The trades and households, one by one
  [/^Quenching pool/, "A trough of water to quench hot iron and harden it."],
  [/^Armoury/, "Weapons and armour, racked and ready."],
  [/^Apothecary$/, "Herbs and medicines are made up here for the sick."],
  [/^Saw shed/, "An open shed where the timber is sawn."],
  [/^(Glove room|Cooperage|Cobbling room)/, "A workshop for one of the town's trades: gloves, barrels or shoes."],
  [/^Beadle's room/, "For the beadle, who keeps order in the hall and runs the council's errands."],
  [/^Infirmarer's room/, "The infirmarer, who runs the care of the sick, works and sleeps here."],
  [/dormitory$/, "A long room of beds."],
  [/^(Yard gate|Mint gate)/, "The guarded gateway into the yard, for carts in and out."],
  [/^Comptroller's office/, "The comptroller checks the weight and purity of the coin and keeps the mint's books."],
  [/^Engraver's room/, "The dies for striking coins are cut here."],
  [/^Moneyers' chamber/, "The moneyers, who strike the coins, rest and keep their tools here."],
  [/^(Owner's room|Apothecary's chamber|Miller's room|Master's room)/, "The bedroom of the owner or master of the house."],
  [/^Undercroft/, "A vaulted room under the hall, for stores or for trade."],
  [/^(Grain|Wine) hall/, "A merchants' hall where goods are shown, weighed and stored for sale."],
  // Halls and living rooms
  [/^(Great hall|Hall|Common hall|Master's hall|Miller's hall|Keeper's hall|Warden's hall)$/, "The main room of the house: meals, guests, the household's business, the fire."],
  [/^Common room/, "The tavern's main room: the bar, tables and benches, the fire, the noise."],
  [/^Tap room/, "A smaller drinking room off the bar."],
  [/^(Parlour|Great parlour|Court parlour|Governor's parlour|Mayor's parlour)/, "A private sitting room to talk business or receive guests away from the hall."],
  [/^Solar/, "The family's private room upstairs, with the best light: to sit, sew, read and sleep."],
  [/^(Living room|Main room|Cottage)$/, "Where the household lives: cooking, eating, working and often sleeping, round the hearth."],
  [/^(Chamber|Chambers|Best chamber|Great chamber|Inner chamber|Master's chamber|Miller's chamber|Keeper's chamber|Warden's chamber|Governor's chamber|Bedroom|Upper room|Inner room)$/, "A bedroom, and somewhere private to keep clothes and valuables."],
  [/^(Guest (room|chamber)|Lodger's room|Bridal suite|Private room)/, "A room for a guest or paying lodger to sleep."],
  [/(Garret|garret|Sleeping loft)/, "A cramped room under the roof for servants, apprentices or children to sleep."],
  [/^Nursery/, "Where the children sleep and are looked after."],
  // Service
  [/^(Kitchen|Cook's room|Oven room|Scullery)/, "Where the food is cooked and the pots washed."],
  [/^(Buttery|Bar store|Wine store|Wine cellar|Wine vault|Beer cellar)/, "Where the drink is kept: casks of ale and wine."],
  [/^(Pantry|Larder|Cold store|Cool store|Cold cellar|Salting room|Still room|Dairy)/, "Where food is kept, salted, cooled or preserved."],
  [/^(Screens passage|Cross-passage|Entry|Entrance|Entrance hall|Entry passage|Side passage|Yard passage|Stair hall|Gate passage|Carriage way|Bath passage|Cell passage|Ward passage)/, "A way through: from the door to the hall and the service rooms, to keep the draughts and the traffic out of the rooms."],
  [/^(Privy|Garderobe|Closet)/, "The privy."],
  [/^(Washhouse|Linen room|Wardrobe)/, "Washing, mending and keeping the household's linen and clothes."],
  [/^Brewhouse/, "Where the ale is brewed."],
  [/^(Cellar|Root cellar|Store|Storeroom|Storage|Storage floor|Stock room|Stock cellar|Service room|Loft store|Back room)$/, "Storage: food, fuel, stock and things not needed every day."],
  [/store$|Store$/, "Storage for the trade's materials and goods."],
  [/^(Coal hole|Woodstore|Wood store|Fuel store)/, "Fuel for the fires."],
  [/^Butler's room|^Steward's room|^Chamberlain's office/, "For the servant who runs the household: the stores, the plate and the accounts."],
  // Shops and trades
  [/^(Shop|Shop floor|Back shop)$/, "Where customers come in to buy: goods on show and a counter."],
  [/^(Workshop|Work room|Workroom)$/, "Where the trade's work is done: benches, tools and materials."],
  [/shop$/, "Where the trade's goods are made or shown and sold to customers."],
  [/^(Forge|Smith's room)/, "The smith's forge: the hearth, the anvil, the quench."],
  [/^(Counting (house|room)|Tally room|Ledger room|Clerk's|Clerks'|Office|Factor's room)/, "Where the accounts are kept, money is counted and the business is written up."],
  [/^(Strong ?room|Treasury|Treasure vault|Vault|Exchequer|Pyx chamber|Plate room|Masterwork vault)/, "A locked room for money, plate and anything valuable."],
  [/^(Warehouse|Weigh house|Weigh room|Weighing room)/, "Goods are stored, checked and weighed here."],
  [/^(Kneading room|Bread shop|Flour store|Baker's room)/, "The bakehouse's work: flour, kneading, the ovens and the loaves."],
  [/^(Hoist|Crane) loft/, "The hoist under the roof lifts goods from the carts up to the floors below."],
  [/^Cart bay/, "Room for carts to pull in out of the weather and be loaded."],
  [/^(Mill room|Wheel pit|Grinding room|Bin loft|Sack store)/, "Part of the mill's works: the wheel, the stones, the hoist and the grain bins."],
  [/^(Stables|Stall|Tack room|Ostler's room|Groom's|Hayloft|Feed loft|Feed store|Hay store)/, "For the horses: stalls, feed, tack and the people who look after them."],
  [/^(Byre|Cattle bay|Hay bay|Corn bay|Straw bay|Threshing floor|Cart bay|Aisle)/, "Farm work and livestock: bays for crops and animals, the threshing floor."],
  [/^(Slaughterhouse|Blanching room|Dye vats|Dipping room|Tub room|Loom room|Cutting room|Press room|Kiln room|Coining house|Melting house|Assay)/, "A workroom for one stage of the trade."],
  // Church
  [/^(Nave|North aisle|South aisle|Crossing|North transept|South transept)/, "Where the people stand for worship, looking to the altar."],
  [/^(Choir|Chancel|Presbytery|North choir aisle|South choir aisle|Sanctum|Sanctuary)/, "The holy end of the church: the altar, and the stalls where the clergy sing the services."],
  [/^(Chapel|Lady chapel|Antechapel|Shrine)/, "A chapel or shrine with its own altar, for prayer and private masses."],
  [/^(Vestry|Sacristy)/, "Where the vestments, plate and books for the services are kept, and the clergy robe."],
  [/^Robing room/, "Where robes are kept and put on before a service or a sitting of the court."],
  [/^(Chapter house|Chapter vestibule)/, "Where the clergy meet to run the church's business."],
  [/^(Crypt|Ossuary|Reliquary|Mortuary)/, "For the dead: tombs, bones and holy relics."],
  [/^(Priest's|Chaplain's|Hermit's cell|Confessional)/, "For the priest: to live, pray or hear confession."],
  [/tower$/, "The base of a tower: bells above, or a stair to the top."],
  // Civic, prison, hospital
  [/^(Court room|Mayor's court|Jury room|Recorder's room|Muniment room|Aldermen's chamber)/, "The city's justice and records: the court, the jury, the charters."],
  [/^(Cell|Common ward|Condemned|Felons'|Debtors'|Lock-up|Dungeon|Cage|Master's-side room)/, "Where prisoners are held."],
  [/^(Turnkey|Keeper's (room|lodge)|Guard|Watch room|Porter's lodge|Gate chamber|Portcullis chamber|Serjeants' room|Captain's room)/, "For the guards, porters or gaolers who watch the doors."],
  [/^(Warden's room|Warden's chamber)/, "The bedroom of the warden who runs the house."],
  [/(\bward$|Infirmary|Hospital)/i, "Beds for the sick, the old or the poor, with the brothers or sisters who look after them."],
  [/^(Almsfolk|Alms|Almsman|Almswoman|Covered walk)/, "Rooms for the almsfolk, old or poor people kept by charity."],
  [/^(Bath|Tub room|Men's bath|Women's bath|Hot room|Steam room|Sweating room|Plunge pool|Changing|Rest chamber|Cistern|Barber's room)/, "Part of the bathhouse: changing, sweating, bathing and resting."],
  [/^(Library|Study|Master's study|Hidden study|Archive|Registry hall)/, "Books, records and somewhere quiet to read and write."],
  [/^(Meeting room|Council chamber|Feast hall|Livery hall)/, "Where people gather to meet, decide and eat together."],
  [/^(Market arcade|Toll booth|Toll office|Exchange hall|Money-changers' hall|Pawn counter|Changer's chamber)/, "Trade and money: stalls, tolls, exchange."],
  [/^(Timber|Salt|Spice|Cloth|Wool|Merchants') hall/, "A merchants' hall where goods are shown, weighed and stored for sale."],
  [/(hall)$/, "A large hall for the house's business, its meetings and feasts."],
  [/^Stone floor/, "The millstones turn here, grinding the grain into flour."],
  [/^(Drying loft|Timber loft)/, "An airy loft under the roof where timber, hides or cloth are laid out to dry."],
  [/^Furnace room/, "The furnace: metal melted, glass worked or the house heated."],
  [/^(Gambling den|Fighting pit|Smuggler|Black-market|Disguise room|Forbidden shrine|Secret)/, "Something the owners would rather nobody found."],
];
const GEN_ROOM_KIND_INFO = { living: "Where the household lives and works.", bed: "Somewhere to sleep.", kitchen: "Where the food is cooked.", store: "Storage.", cellar: "Storage below ground, cool and dark.", shop: "Where customers come in to buy.", work: "Where the work is done.", forge: "A hot workroom with a hearth.", tavern: "Drink and company.", hall: "A large hall for gatherings.", office: "An office for business and writing.", meet: "Where people meet.", library: "Books and records.", temple: "For worship.", sanctum: "A holy place.", bath: "For bathing.", pit: "A pit for fighting.", vault: "A locked room for valuables.", privy: "The privy.", passage: "A way through.", mana: "A room of the mana works.", roost: "For familiars.", relay: "Part of the relay.", cell: "A cell.", market: "Open trade.", ward: "Beds for the sick.", loft: "A loft under the roof.", furnace: "A hot room with a furnace." };
function genRoomInfo(type, rm) { const t = GEN_ROOM_TYPE_INFO[type + ":" + rm.n]; if (t) return t;
  for (const [re, d] of GEN_ROOM_INFO) if (d && re.test(rm.n)) return d; return GEN_ROOM_KIND_INFO[rm.k] || ""; }

// Find the rooms of a building type: generate a few of each size and keep, for each room name, a handful of examples.
const GENR = { type: "guildbranch", q: "", cache: new Map(), pick: {}, bld: new Map() };
function genRoomsOf(type) { if (GENR.cache.has(type)) return GENR.cache.get(type);
  const T = genType(type), rooms = new Map(); let quiet = 0;
  for (let sd = 1; sd <= 14 && quiet < 3; sd++) { let fresh = 0;
    for (const size of ["medium", "large", "small"]) { const o = { type, seed: sd * 101 + 7, size, floors: "auto", cellar: sd % 2 ? "yes" : "auto", shape: "auto", porch: "auto" }; let B;
      try { B = genBuilding(o); } catch (e) { continue; } if (!B || B.ok === false) continue;
      B.levels.forEach(L => L.rooms.forEach((rm, i) => { if (rm.porch || (rm.circ && rm.n !== "Cellar stairs") || rm.n === "Landing" || rm.n === "Cellar stairs") return;
        if (!rooms.has(rm.n)) { rooms.set(rm.n, { n: rm.n, k: rm.k, ex: [], floors: new Set(), entry: 0, area: 0 }); fresh++; } const e = rooms.get(rm.n); e.floors.add(L.level); if (rm.entry && L.level === 0) e.entry = 1; e.area = Math.max(e.area, rm.w * rm.h);
        if (e.ex.length < 8) e.ex.push({ o, level: L.level, i, furn: (L.furn || []).filter(f => f.room === i).length }); })); }
    quiet = fresh ? 0 : quiet + 1; }
  // Best examples first: furnished, then by a medium size.
  // (Ground floor first, then upstairs, then the cellar.)
  const fk = e => { const f = Math.min(...[...e.floors].map(l => l < 0 ? 99 : l)); return f; };
  const list = [...rooms.values()].map(e => Object.assign(e, { ex: e.ex.sort((a, b) => (b.furn > 0) - (a.furn > 0)) })).map((e, i) => [e, i]).sort((a, b) => fk(a[0]) - fk(b[0]) || b[0].entry - a[0].entry || b[0].area - a[0].area || a[1] - b[1]).map(x => x[0]);
  GENR.cache.set(type, list); return list; }
function genRoomsBuilding(o) { const k = JSON.stringify(o); if (!GENR.bld.has(k)) { if (GENR.bld.size > 40) GENR.bld.clear(); GENR.bld.set(k, { B: genBuilding(o), img: new Map() }); } return GENR.bld.get(k); }
// One example, cut out of its building: the floor (and walls on top), the room's furniture, a little of the walls round it.
function genRoomCrop(ex, big) {
  const hold = genRoomsBuilding(ex.o), B = hold.B, L = B.levels.find(l => l.level === ex.level), rm = L && L.rooms[ex.i]; if (!rm) return "";
  const lib = genFurnLib(), byId = new Map(lib.map(a => [a.id, a])), TW = B.W + GEN_PAD * 2, TH = B.H + GEN_PAD * 2, m = 0.6;
  const img = part => { const k = ex.level + part; if (!hold.img.has(k)) hold.img.set(k, genUrl(genFloorSvg(B, L, false, ex.o.seed, false, part))); return hold.img.get(k); };
  const u0 = rm.x + GEN_PAD - m, v0 = rm.y + GEN_PAD - m, cw = rm.w + 2 * m, ch = rm.h + 2 * m, pc = (a, b) => (a / b * 100).toFixed(3) + "%";
  const full = (src, cls) => `<img class="${cls}" src="${src}" alt="" style="left:${pc(-u0, cw)};top:${pc(-v0, ch)};width:${pc(TW, cw)};height:${pc(TH, ch)}">`;
  const furn = (L.furn || []).filter(f => f.room === ex.i).map(f => { const a = byId.get(f.a); if (!a) return ""; const x = f.x + f.w / 2 - a.w / 2, y = f.y + f.h / 2 - a.h / 2;
    return `<img class="grmf" src="${esc(a.src)}" alt="" title="${esc(a.name)}" style="left:${pc(x + GEN_PAD - u0, cw)};top:${pc(y + GEN_PAD - v0, ch)};width:${pc(a.w, cw)};height:${pc(a.h, ch)}${f.k ? `;transform:rotate(${f.k * 90}deg)` : ""}">`; }).join("");
  return `<div class="grmcrop${big ? " big" : ""}" style="aspect-ratio:${cw} / ${ch};width:min(100%, ${big ? `calc(65vh * ${(cw / ch).toFixed(4)})` : (220 * cw / ch).toFixed(1) + "px"})">${full(img("base"), "grmbase")}${furn}${full(img("top"), "grmtop")}</div>`;
}
function genRoomPieces(ex) { const B = genRoomsBuilding(ex.o).B, L = B.levels.find(l => l.level === ex.level), lib = genFurnLib(), byId = new Map(lib.map(a => [a.id, a])), n = new Map();
  (L.furn || []).filter(f => f.room === ex.i).forEach(f => { const a = byId.get(f.a); const nm = a ? a.name : f.a; n.set(nm, (n.get(nm) || 0) + 1); });
  return [...n.entries()].map(([nm, c]) => c > 1 ? `${c} × ${nm.toLowerCase()}` : nm.toLowerCase()).join(", "); }
const genRoomFloorName = lv => lv < 0 ? "cellar" : lv === 0 ? "ground floor" : lv === 1 ? "upper floor" : `floor ${lv + 1}`;
const GENR_GROUPS = [["village", "Village"], ["", "Town"], ["magic", "Magic"], ["city", "City"], ["castle", "Castle"]];
function genRoomsView(camp, back) {
  const types = GEN_BUILDINGS.filter(t => t.id !== "custom" && (t.plan || t.ground)), T = genType(GENR.type);
  let rooms = []; try { rooms = genRoomsOf(T.id); } catch (e) { console.warn(e); }
  const q = GENR.q.trim().toLowerCase(), shown = rooms.filter(e => !q || e.n.toLowerCase().includes(q) || genRoomInfo(T.id, e).toLowerCase().includes(q));
  const card = e => { const at = (GENR.pick[T.id + ":" + e.n] || 0) % e.ex.length, ex = e.ex[at], B = genRoomsBuilding(ex.o).B, rm = B.levels.find(l => l.level === ex.level).rooms[ex.i], pcs = genRoomPieces(ex);
    return `<article class="gfcard grmcard"><button type="button" class="grmpic" data-act="grmbig" data-n="${esc(e.n)}" title="See it bigger">${genRoomCrop(ex)}</button><div class="gfbody">
      <div class="grmhead"><strong>${esc(e.n)}</strong>${e.ex.length > 1 ? `<button type="button" class="btn ghost small" data-act="grmroll" data-n="${esc(e.n)}" title="Another example">🎲</button>` : ""}</div>
      <span class="muted small">${rm.w} × ${rm.h} squares · ${[...e.floors].sort((a, b) => a - b).map(genRoomFloorName).join(", ")} · in a ${esc((B.F.shapeName || T.name).toLowerCase())}</span>
      <p class="grmdesc">${esc(genRoomInfo(T.id, e)) || `<span class="muted">No description yet.</span>`}</p>
      <p class="small grmpcs">${pcs ? `<b>Furniture:</b> ${esc(pcs)}` : `<span class="muted">Not furnished in this example.</span>`}</p></div></article>`; };
  return `<section class="page"><a href="#gen-${esc(camp)}" class="vback">← Generator</a>
    <h1>Rooms</h1><p class="muted">Every room the building generator makes, building by building: an example cut out of a real generated building, what it's for and what's in it. 🎲 shows another example; click a picture to see it bigger. Change what goes in a room in <a href="#gen-${esc(camp)}/furniture">Furniture</a>.</p>
    ${GENR_GROUPS.map(([g, label]) => { const ts = types.filter(t => (t.group || "") === g); return ts.length ? `<div class="grmgroup"><span class="muted small">${label}</span><div class="gentags">${ts.map(t => `<button class="chip${t.id === T.id ? " on" : ""}" data-act="grmtype" data-v="${esc(t.id)}">${t.icon || ""} ${esc(t.name)}</button>`).join("")}</div></div>` : ""; }).join("")}
    <div class="gftools"><input type="search" id="grm-q" placeholder="Find a room in the ${esc(T.name.toLowerCase())}…" value="${esc(GENR.q)}" class="grow"></div>
    <p class="grmabout"><strong>${T.icon || ""} ${esc(T.name)}</strong> <span class="muted">${esc(T.blurb || "")}</span></p>
    <div class="gfgrid grmgrid">${shown.map(card).join("") || `<p class="muted">No rooms match.</p>`}</div></section>`;
}
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-act^=grm]"); if (!b) return; const a = b.dataset.act;
  if (a === "grmtype") { GENR.type = b.dataset.v; GENR.q = ""; render(); return; }
  if (a === "grmroll") { const k = GENR.type + ":" + b.dataset.n; GENR.pick[k] = (GENR.pick[k] || 0) + 1; render(); return; }
  if (a === "grmbig") { const e = genRoomsOf(GENR.type).find(x => x.n === b.dataset.n); if (!e) return; const ex = e.ex[(GENR.pick[GENR.type + ":" + e.n] || 0) % e.ex.length], T = genType(GENR.type), pcs = genRoomPieces(ex);
    openModal(`<h2>${esc(e.n)} <small class="muted">${esc(T.name)}</small></h2>${genRoomCrop(ex, true)}<p class="grmdesc">${esc(genRoomInfo(T.id, e))}</p>${pcs ? `<p class="small"><b>Furniture:</b> ${esc(pcs)}</p>` : ""}<div class="acts"><button class="btn ghost" type="button" data-act="closemodal">Close</button></div>`); return; }
});
document.addEventListener("input", ev => { if (ev.target && ev.target.id === "grm-q") { GENR.q = ev.target.value; const pos = ev.target.selectionStart; render(); const el = document.getElementById("grm-q"); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } } } });
