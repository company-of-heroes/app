import { building, commander, unit, upgrade } from './links.mjs';

export const WEHRMACHT = [
	{
		key: 'wh-vs-us-opening',
		category: 'wehrmacht/1v1',
		title: 'Wehrmacht vs US: opening and tech path',
		excerpt:
			'How to survive the US early-game push, read whether BARs or an M8 are coming, and get to Panzer Command on time.',
		body: `Against the US the first ten minutes belong to the Americans: ${unit('Riflemen', 'rifleman-squad')} are cheaper than your infantry and win close fights. Your job is to trade space for time, keep your squads alive and reach the tanks that let you take the map back.

## The opening

Most competitive players open in one of two ways:

- **Standard:** 2 ${unit('Pioneers', 'pioneer-squad')} and a ${unit('Volksgrenadiers', 'volksgrenadier-squad')} squad from the ${building('Wehrmacht Quarters', 'basic-support')} (220 manpower, 15 fuel), followed by an ${unit('MG42', 'wh-heavy-machine-gun-section')}.
- **MG first:** one Pioneer squad builds the Quarters, the first unit is an MG42 that caps the nearest one or two points, then a ${unit('Motorcycle', 'motorcycle-squad')}.

Whichever you pick, build the Quarters forward rather than deep in your base. The MG42 needs to reach the centre before the second Riflemen squad does.

## The first two minutes

The US often skips its second Engineers to get two Riflemen squads out early and jump your lone Volksgrenadiers. That leaves you a short window, about 15 seconds, to get a second unit to the fight. If your Volks are alone against two squads, retreat them: a squad you keep is worth more than one point.

The Motorcycle is not a fighter. Use it to:

- spot where the Riflemen come from, so the MG42 is facing the right way when they arrive;
- push a capping Engineer or Riflemen squad off a point by driving through it;
- find the enemy sniper.

## Reading the US plan

Count what you see by minute six or seven:

- **BARs** (200 manpower, 60 fuel) or a ${building('Weapons Support Center', 'support-weapons')}: an infantry game is coming. Add a second MG42 and get to the ${building('Krieg Barracks', 'platoon-support-building')}.
- **No BARs and no Support Center:** the US is saving fuel for an ${unit('M8 Armored Car', 'm8-greyhound-squad')}. It can arrive around minute seven. Mine the roads and get a ${unit('Pak 38', '50mm-pak38')} out as soon as the Krieg Barracks is up.
- **A sniper:** answer with a Motorcycle or a sniper of your own.

## The tech path

- ${upgrade('Escalate to Skirmish Phase', 'phase-2')} costs 200 manpower and 35 fuel. Start it almost the moment you have the fuel, and make sure you can afford the Krieg Barracks right after.
- The common route is T1, T2, then straight to ${upgrade('Escalate to Battle Phase', 'phase-4')} for the ${building('Panzer Command', 'battalion-support-building')}. The ${building('Sturm Armory', 'company-support-building')} is often built later for a ${unit('Nebelwerfer', '150mm-nebelwerfer')}.
- Jumping from T1 straight past T2 only works if you hold most of the fuel.

## Your first tank

- Shermans on the field: build a ${unit('Panther', 'wh-panther-squad')} first.
- Motor Pool units and lots of infantry: an ${unit('Ostwind', 'ostwind-flak-panzer-squad')} first.
- A ${unit('Panzer IV', 'panzer-iv-squad')} is a good second or third tank against the US.

## Economy

Community guides aim for roughly 23 fuel per minute in 1v1; below 20 the Wehrmacht falls behind. An Observation Post on a medium or high fuel point pays for itself quickly. Avoid even one-for-one trades in the mid game: US units are cheaper to replace than yours.`,
		translations: {
			es: {
				title: 'Wehrmacht contra EE. UU.: apertura y ruta tecnológica',
				excerpt:
					'Cómo sobrevivir a la presión inicial estadounidense, leer si vienen BAR o un M8 y llegar a tiempo al Mando Panzer.',
				body: `Contra EE. UU. los primeros diez minutos son de los americanos: los ${unit('Fusileros', 'rifleman-squad')} son más baratos que tu infantería y ganan a corta distancia. Tu trabajo es cambiar espacio por tiempo y mantener vivas tus escuadras.

## La apertura

- **Estándar:** 2 escuadras de ${unit('Pioneros', 'pioneer-squad')} y unos ${unit('Volksgrenadiers', 'volksgrenadier-squad')} desde el ${building('Cuartel de la Wehrmacht', 'basic-support')}, seguidos de una ${unit('MG42', 'wh-heavy-machine-gun-section')}.
- **MG primero:** la MG42 captura uno o dos puntos y luego sale una ${unit('Motocicleta', 'motorcycle-squad')}.

## Leer el plan americano

- **BAR o Centro de Apoyo:** viene una partida de infantería; añade otra MG42.
- **Ni BAR ni Centro de Apoyo:** prepárate para un ${unit('M8', 'm8-greyhound-squad')} hacia el minuto siete; mina las carreteras y saca un ${unit('Pak 38', '50mm-pak38')}.

## Ruta tecnológica

${upgrade('Fase de Escaramuza', 'phase-2')} (200 de mano de obra, 35 de combustible) en cuanto puedas, luego directo a la ${upgrade('Fase de Batalla', 'phase-4')}. Contra Shermans, el primer tanque es un ${unit('Panther', 'wh-panther-squad')}.`
			}
		}
	},
	{
		key: 'wh-vs-brit',
		category: 'wehrmacht/1v1',
		title: 'Wehrmacht vs British: snipers, bikes and the Pak creep',
		excerpt:
			'Why the Wehrmacht opens differently against the British, how to bleed Infantry Sections with a sniper, and when to bring Paks forward.',
		body: `The British play slowly: expensive ${unit('Infantry Sections', 'tommy-squad')}, officers, trenches and emplacements. You will not out-fight them head-on early, so you bleed them and take the map while they dig in.

## A different opening

- Build 3 ${unit('Pioneers', 'pioneer-squad')}. The first builds the ${building('Wehrmacht Quarters', 'basic-support')}; the other two capture and do not help build.
- Get a ${unit('Motorcycle', 'motorcycle-squad')} the moment the Quarters finishes.
- Give one Pioneer squad a ${upgrade('Flammenwerfer 42', 'axis-flammenwerfer42-flamethrower')} (50 munitions).
- Aim for 2 Motorcycles, 2 ${unit('MG42s', 'wh-heavy-machine-gun-section')} and a ${unit('Sniper', 'sniper')}, then the ${upgrade('Skirmish Phase', 'phase-2')}.
- Build ${unit('Volksgrenadiers', 'volksgrenadier-squad')} mainly to re-crew weapons, or if the British open with two Bren Carriers.

## The sniper does the damage

British infantry is expensive to reinforce, so every man your sniper removes hurts. Target the ${unit('Lieutenant', 'lieutenant')} first: British infantry fights much worse without its officer. Watch for Recon Elements and the ${unit('Bren Carrier', 'bren-carrier-squad')}, the two things that hunt snipers.

## What the Motorcycle does here

- Hunts the Lieutenant.
- Kills a Bren Carrier when an MG42 supports it.
- Interrupts emplacements while the British are still building them.
- Repair it whenever it drops below half health.

## Fighting Infantry Sections

Keep two or three Volksgrenadier squads together; two can beat one Infantry Section, one cannot. Never take an even fight without better cover than the British squad has. Fire Panzerfausts in pairs at a Bren Carrier from mid range.

## The Pak creep

When the British bring a ${unit('Stuart', 'stuart-squad')} or a ${unit('Cromwell', 'cromwell-squad')}, or dig in hard, build the ${building('Krieg Barracks', 'platoon-support-building')}, a ${unit('Grenadiers', 'grenadier-squad')} squad and two ${unit('Pak 38s', '50mm-pak38')}. Move the Paks forward behind your MG42 and sniper, one step at a time, and stagger them so one 25 Pounder barrage cannot hit both. Holding half the map this way is a good result.

## Late game

At Panzer Command, the first tank is usually a ${unit('Panther', 'wh-panther-squad')}. Two Panthers beat most British armour. Against Commandos or heavy infantry, an ${unit('Ostwind', 'ostwind-flak-panzer-squad')} first is the better pick. Most guides advise against relying on the Panzer IV against Cromwells and Fireflies.`
	},
	{
		key: 'wh-mg42',
		category: 'wehrmacht/1v1',
		title: 'Holding the line: MG42, Volksgrenadiers and the medic bunker',
		excerpt:
			'Kill zones, capping from sandbags, MP40 or Kar98 Volks, and whether the medic bunker is worth it.',
		body: `The ${unit('MG42', 'wh-heavy-machine-gun-section')} is what lets the Wehrmacht hold ground against cheaper US infantry. It only works with the right units around it.

## Never alone

An MG42 without infantry beside it is a free kill. Keep ${unit('Volksgrenadiers', 'volksgrenadier-squad')}, ${unit('Grenadiers', 'grenadier-squad')} or a flamethrower ${unit('Pioneer', 'pioneer-squad')} squad on its flanks, and use barbed wire on the routes it cannot cover.

## Build a kill zone

Wire and mines should push attackers into the MG's arc. After you suppress a squad and it retreats, move the gun a little: good players will not walk into the same arc twice.

## Capping from cover

Pioneers can build two or three sandbags next to a point in a few seconds. Capture from inside them, and wire the enemy side so they cannot use your sandbags.

## Kar98 or MP40 Volks

- **Kar98 (default):** best with the MG42. They lose nothing firing at suppressed targets. Fight Riflemen at long range; Riflemen win up close.
- **${upgrade('MP40', 'axis-squad-item-volksgrenadier-smg')}** (50 munitions, needs the Skirmish Phase): strong at point-blank range against plain Riflemen, Airborne, snipers and mortar crews. Weak against BARs, Rangers and garrisons, and less accurate on the move.

## The medic bunker

The medic bunker heals your infantry and turns casualties into free Grenadier squads. Feed it with two or more Volks squads and leapfrog bunkers forward as you take ground.

Not everyone agrees it is worth the cost. Some strong players skip it as a luxury, and US guides tell American players to destroy it on sight with mortars, off-map artillery or flamethrowers. Build it when you are holding a position, not while you are short on anti-tank.

## Against BARs

Buy Infantry veterancy at the ${building('Kampfkraft Centre', 'wh-quarter-master')}: at level two Grenadiers get elite armour. Watch for flamethrowers, which do extra damage to elite armour.

## Defensive Doctrine as a multiplier

The ${commander('Defensive Doctrine', 'axis-defense-tree')} makes a held line much harder to break. ${upgrade('For the Fatherland!', 'axis-defense-00')} makes your units in your own territory much tougher for a short time, and ${upgrade('Fortify the Perimeter', 'axis-defense-01')} strengthens your bunkers and Observation Posts.`
	},
	{
		key: 'wh-at',
		category: 'wehrmacht/1v1',
		title: 'Anti-tank timings: from the M8 to the Cromwell',
		excerpt:
			'Mines, Panzerfausts, the Pak 38, Panzerschrecks, the Puma and the StuG: what to use against each Allied vehicle.',
		body: `Most Wehrmacht losses start with a vehicle you were not ready for. Plan your anti-tank before it arrives.

## Mines first

A single mine can kill an unskirted ${unit('M8 Armored Car', 'm8-greyhound-squad')} or a fresh ${unit('T17', 't17-armoured-car-squad')}. Mine roads, chokepoints and the area outside your base entrance. Lay them one at a time and spaced apart, so one blast does not set off the rest.

## Keep munitions for Panzerfausts

Your Volksgrenadiers' Panzerfausts are the cheapest way to finish a light vehicle:

- a T17 needs one or two;
- a skirted M8 needs two or three.

Only fire when you can finish the target, ideally from its side or rear. Spending every munition on mines leaves you without fausts.

## The Pak 38

The ${unit('Pak 38', '50mm-pak38')} from the ${building('Krieg Barracks', 'platoon-support-building')} kills a skirted M8 in two or three shots. Camouflage it once it is in position: the first shot from cover is much more accurate. Set it to hold fire so it does not reveal itself shooting infantry, and keep it behind an MG42 or bunker.

## Pak plus Panzerschreck

Pair the Pak with a ${unit('Grenadiers', 'grenadier-squad')} squad carrying an ${upgrade('RPzB 54 Panzerschreck', 'axis-squad-item-panzerschreck')} (75 munitions). The Pak does the damage; the Panzerschreck squad chases down damaged vehicles and stops them circling the gun. Panzerschrecks miss at long range, so close in before firing. Never rely on them as your only anti-tank.

## Your own light armour

- The ${unit('Sdkfz 234 Armored Car', 'sdkfz-234-armoured-car-squad')} with the ${upgrade('Puma 50mm Gun', 'axis-squad-item-50mm-puma')} is the only fast, offensive answer to an M8. It needs a bit more fuel than the M8.
- The ${unit('Stug IV', 'stug-iv-squad')} is cost-effective against Shermans and M10s thanks to its front armour, but it has no turret: keep its front toward the enemy.
- The ${unit('Geschutzwagen', 'geschutzwagen-squad')} hits hard at long range but needs a spotter and loses to AT guns. Many players prefer the StuG.

## When to go straight for a Panther

Shermans or a Cromwell on the field mean your first Panzer Command unit should be a ${unit('Panther', 'wh-panther-squad')}. A ${unit('Panzer IV', 'panzer-iv-squad')} is fine against Shermans; against M10s, Panthers and Panzerschrecks work better.`
	},
	{
		key: 'wh-doctrines',
		category: 'wehrmacht/2v2',
		title: 'Choosing a Wehrmacht doctrine: Defensive, Blitzkrieg or Terror',
		excerpt:
			'What each doctrine is good at, which abilities matter and which one to pick against US and British opponents.',
		body: `Don't commit to a doctrine before it helps you. Wait until one of its units or abilities clearly answers what your opponent is doing.

## Blitzkrieg Doctrine

The ${commander('Blitzkrieg Doctrine', 'axis-blitzkrieg-tree')} is the aggressive choice.

- ${upgrade('Infantry Assault Team', 'axis-blitzkrieg-00')} brings ${unit('Stormtroopers', 'stormtrooper-squad')}: cloaked infantry. Give your first squad a Panzerschreck to answer an early M8.
- ${upgrade('Assault Grenadiers', 'axis-blitzkrieg-10')} adds a grenade attack that breaks MG nests and groups of infantry.
- ${upgrade('Blitzkrieg Assault!', 'axis-blitzkrieg-11')} speeds up and strengthens your army for a short time: use it for a big flank or the final push on a victory point.
- Skipping the Krieg Barracks and going straight to the Sturm Armory works best with Blitzkrieg.
- Many players prefer it against the British.

## Terror Doctrine

The ${commander('Terror Doctrine', 'axis-propaganda-tree')} is built for long games of 25 minutes and more.

- ${upgrade('Propaganda War', 'axis-propaganda-01')} makes enemy infantry in an area retreat: use it to save a tank or break a big group.
- ${upgrade('Firestorm', 'axis-propaganda-11')} and the ${upgrade('V1 Rocket Attack', 'axis-propaganda-12')} destroy groups, emplacements and 17 pounders. Aim the V1 where the army will be, not where it is.
- The ${upgrade('King Tiger', 'axis-propaganda-02')} is a single, extremely tough tank. Calling it in costs you manpower income for a few minutes, and fast tanks can still circle it.
- Krieg Barracks Grenadiers with Terror is often called the most stable, least risky Wehrmacht plan. Many players pick it against the US.

## Defensive Doctrine

The ${commander('Defensive Doctrine', 'axis-defense-tree')} is strongest in the mid game.

- ${upgrade('Registered Artillery', 'axis-defense-11')} has to be called on your own point or structure, which makes it ideal for defending victory points.
- ${upgrade('Rocket Artillery', 'axis-defense-12')} is best against AT guns, weapon teams and retreat paths, and weaker against British emplacements.
- The ${upgrade('88mm Flak 36', 'axis-defense-02')} stops tank pushes and aircraft.

## Quick picks

- Against the US: Terror or Defensive.
- Against Royal Engineers (Churchills): Defensive.
- Against Commandos or Royal Artillery: Terror or Blitzkrieg.`
	},
	{
		key: 'wh-vet',
		category: 'wehrmacht/2v2',
		title: 'Kampfkraft Centre veterancy and the late-game army',
		excerpt:
			'Which veterancy to buy first, what each level unlocks, and how to build a late-game Wehrmacht army.',
		body: `Wehrmacht units do not earn veterancy in combat. You buy it per unit class at the ${building('Kampfkraft Centre', 'wh-quarter-master')}, which needs the ${building('Wehrmacht Quarters', 'basic-support')}.

## The four branches

- **Infantry:** ${upgrade('Veteran Infantry Squads', 'veteran-infantry-1')}, ${upgrade('Crack Infantry', 'veteran-infantry-2')}, ${upgrade('Elite Infantry', 'veteran-infantry-3')}.
- **Support weapons:** ${upgrade('Veteran Support Units', 'veteran-support-1')}, ${upgrade('Crack Support Units', 'veteran-support-2')}, ${upgrade('Elite Support Units', 'veteran-support-3')}.
- **Vehicles:** ${upgrade('Veteran Vehicles', 'veteran-vehicle-1')}, ${upgrade('Crack Vehicles', 'veteran-vehicle-2')}, ${upgrade('Elite Vehicles', 'veteran-vehicle-3')}.
- **Tanks:** ${upgrade('Veteran Tanks', 'veteran-tank-1')}, ${upgrade('Crack Tank Crew', 'veteran-tank-2')}, ${upgrade('Elite Tanks', 'veteran-tank-3')}.

## What to buy first

- Infantry level one is very cost-effective, but never buy it if it delays your anti-tank.
- Tank level one is worth it even for your first tank.
- Some top players only start buying veterancy once Panzer Command is up.

## Notable effects

- Tank level two adds a pintle MG; level three adds armour skirts.
- Support level one makes the ${unit('MG42', 'wh-heavy-machine-gun-section')} much more accurate.
- Each level speeds up the ${unit('Nebelwerfer', '150mm-nebelwerfer')} barrage.

## The late-game army

- Two veteran ${unit('Panthers', 'wh-panther-squad')} and an ${unit('Ostwind', 'ostwind-flak-panzer-squad')} form the usual core.
- Keep a ${unit('Sniper', 'sniper')} for spotting and for killing repairing Sappers and Engineers.
- ${unit("Knight's Cross Holders", 'knights-cross-holder')} are strong against Infantry Sections and weaker against BARs and Rangers. Use them to flank and chase retreating squads.
- The ${upgrade('Walking Stuka', 'axis-halftrack-stuka')} on the ${unit('Sdkfz 251 Halftrack', 'halftrack-squad')} is the best answer to British emplacements and big infantry groups. Fire two, wait, then fire the third to catch the repairing Sappers.
- Spend spare munitions on mines and doctrine abilities rather than letting them pile up.`
	},
	{
		key: 'wh-team',
		category: 'wehrmacht/team-games',
		title: 'Wehrmacht in team games: double Wehrmacht and supporting Panzer Elite',
		excerpt:
			'How to split roles with a Wehrmacht or Panzer Elite teammate, and why double Wehrmacht teams lose.',
		body: `In team games the Wehrmacht is at its best when two players agree on roles before the game starts.

## Double Wehrmacht

- **Player one (Defensive):** extra ${unit('Pioneers', 'pioneer-squad')} to cap, then several ${unit('MG42s', 'wh-heavy-machine-gun-section')} and flamethrower Pioneers. Support veterancy, straight to Panzer Command, Observation Posts, medic bunkers and an ${upgrade('88mm Flak', 'axis-defense-02')}.
- **Player two (Terror):** fast Wehrmacht Quarters, ${unit('Volksgrenadiers', 'volksgrenadier-squad')} and ${unit('Snipers', 'sniper')}, then the Krieg Barracks with Panzerschreck ${unit('Grenadiers', 'grenadier-squad')}, a second ${unit('Pak 38', '50mm-pak38')} and a ${unit('mortar', 'wh-mortar-section')}, then Walking Stukas and tanks.
- On large maps, aim for about 30 fuel per minute.

## What works together

- MG42s suppress while flamethrowers burn.
- A bunker next to the 88mm Flak lets you re-crew it cheaply.
- Walking Stukas answer enemy artillery.

## Why double Wehrmacht teams lose

Weak footholds early, too little fuel, late anti-tank, careless MG42s, lost snipers, and attacking the British mortar pit too late.

## Supporting a Panzer Elite teammate

- Early: Pioneers, a ${unit('Motorcycle', 'motorcycle-squad')}, several MG42s, one Volks and a Sniper.
- At T2, build a repair bunker early so your Pioneers are free, and skip the medic bunker.
- Then one or two Paks, a mortar and Grenadiers, followed by Walking Stukas and Panzer Command.

## Small things that add up

- Salvage every wreck with Pioneers, including Commando gliders.
- Buy infantry veterancy on low-fuel maps and tank veterancy on high-fuel maps.`
	}
];
