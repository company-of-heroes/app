import { building, commander, unit, upgrade } from './links.mjs';

export const BRITISH = [
	{
		key: 'cw-trucks',
		category: 'british-commonwealth/1v1',
		title: 'How the British truck system works',
		excerpt:
			'Moving the Headquarters Command Truck, the officer tech chain, and where to set up so your income keeps flowing.',
		body: `British buildings are trucks. They drive to a spot, set up, and only then produce units. Most British mistakes come from moving them at the wrong time.

## The Headquarters Command Truck

The ${unit('Headquarters Command Truck', 'hq-squad')} is a mobile building. It has to be set up to produce units, and **your income from every sector stops while it is driving**. Setting it up in a sector also gives that sector a bonus, like an Observation Post.

## The tech chain

- The ${unit('Lieutenant', 'lieutenant')} (250 manpower, 15 fuel) unlocks the ${unit('Field Support Truck', 'soldiers-hq-squad')} (185 manpower, 30 fuel).
- The Field Support Truck builds ${unit('Sappers', 'sapper-squad')}, the ${unit('Captain', 'captain')} (300 manpower, 35 fuel) and the ${unit('Stuart', 'stuart-squad')}.
- The Captain unlocks the ${unit('Armor Command Truck', 'armoured-hq-squad')} (205 manpower, 65 fuel), which builds the ${unit('Cromwell', 'cromwell-squad')}, the Cromwell Command Tank and the ${unit('Sherman Firefly', 'sherman-firefly-squad')}.

## When to move the Headquarters

The standard move: your starting ${unit('Infantry Section', 'tommy-squad')} captures the sector where the truck will park, and the truck packs up after your second unit, usually the Lieutenant. In an analysis of 135 top-player games, almost nine in ten moved after the second unit. Move no later than the third.

Build the Lieutenant first: Infantry Sections built before the truck moves walk very slowly through neutral and enemy territory.

## Where to set it up

- A medium or high munitions point is the classic spot.
- Some players prefer the highest fuel point, or a key point that one machine-gun emplacement and a nearby mortar can defend.

## The Field Support Truck

Call it once you have about four units on the field. While it is being built, the Headquarters can build nothing else, so calling it too early hurts. On low-fuel maps like Wrecked Train or Beaux Lowlands, build an extra Infantry Section or a mortar pit first.

## Truck upgrades

- ${upgrade('Speed Governors', 'commonwealth-building-speed-upgrade')} (150 manpower, 10 fuel) make your trucks much faster when they relocate.
- ${upgrade('Secured Resourcing', 'commonwealth-building-economy-upgrade')} (250 manpower, 25 fuel) increases the income of the sector the truck stands in.

## Retreat logistics

Squads retreat to the Headquarters, which sits near the front once it has moved, so damaged squads come back quickly. The Captain gives you a second retreat point.`
	},
	{
		key: 'cw-opening',
		category: 'british-commonwealth/1v1',
		title: 'British 1v1 openings: Lieutenant, Infantry Sections and the Bren Carrier',
		excerpt:
			'What top players build first, the first upgrade on each Infantry Section, and how to use the Stuart and Cromwell.',
		body: `## The first unit

Almost every top British player opens with the ${unit('Lieutenant', 'lieutenant')}. Capture with him early, then bring him back to your infantry, and never lose him: British infantry fights much worse without its officer.

## A typical first tier

Lieutenant, ${unit('Infantry Section', 'tommy-squad')}, move the Headquarters, a ${unit('Bren Carrier', 'bren-carrier-squad')} or another Infantry Section, one more Infantry Section, then the Field Support Truck.

## The Bren Carrier

The Bren Carrier (280 manpower, 10 fuel) was built in about three of four top games.

- Strong against Motorcycles, Pioneers, ungarrisoned MG42s and groups of Grenadiers.
- Falls off around minute seven or eight, once Axis anti-tank is out. Some top players prefer a third Infantry Section instead.
- Against Panzer Elite, opinions split: some skip it because halftracks focus it down, others build it against the Kettenkrad and Schwimmwagen.
- **Bren in Bren:** a Bren Carrier carrying an Infantry Section with a Bren gun, so the troops keep firing while the carrier repairs itself.

## The first Infantry Section upgrade

- ${upgrade('Rifle Grenades', 'commonwealth-sgt-rifle-grenade')} (75 munitions) against the Wehrmacht.
- ${upgrade('Bren Light Machine Gun', 'commonwealth-sgt-bren-package')} (75 munitions) against Panzer Elite.
- ${upgrade('Recon Element', 'commonwealth-sgt-recon-team')} (35 munitions) adds detection and long sight.

## The Field Support Truck

Most players build the ${unit('Captain', 'captain')} first to rush a ${unit('Stuart', 'stuart-squad')} (280 manpower, 45 fuel). Others build ${unit('Sappers', 'sapper-squad')} first. Give Sappers ${upgrade('Expert Engineers', 'commonwealth-sgt-expert-engineer')} when you have a Bren Carrier or Stuart to repair, or a ${upgrade('PIAT', 'commonwealth-sgt-piat-package')} against a fast enemy vehicle rush.

## The Stuart

It hits hardest when it arrives early. Use it against groups of infantry, halftracks, and Panzer Elite units that are being repaired. Keep it off the main roads and repair it often. Do not trade it head-on: losing it wastes 45 fuel. Against the Wehrmacht, an early Stuart only works with strong map control, because Pak 38s, Panzerschrecks and Panzerfausts kill it fast.

## The third tier

- The ${unit('Cromwell', 'cromwell-squad')} (400 manpower, 70 fuel) is usually first. Two are fine; three or more is too many.
- The ${unit('Cromwell Command Tank', 'command-tank-squad')} unlocks the Firefly and buffs nearby tanks. Keep it behind the line.
- The ${unit('Sherman Firefly', 'sherman-firefly-squad')} (450 manpower, 100 fuel) is your answer to Hetzers, Jagdpanthers and the King Tiger. It is thin-skinned, so keep it on the flanks.`
	},
	{
		key: 'cw-officers',
		category: 'british-commonwealth/1v1',
		title: 'Officers and emplacements: when they are worth building',
		excerpt:
			'What the Lieutenant and Captain do, which emplacements top players actually build, and the Sim City trap.',
		body: `## The Lieutenant

Nearby infantry is more accurate and a little faster. With veterancy he gains Heroic Charge, a short burst of speed and suppression resistance that leaves your troops exhausted afterwards. He can ride in a Bren Carrier and still give his bonus. Keep him just behind the front.

## The Captain

Infantry in his sector takes less suppression and less damage and slowly heals. His Victor Target ability makes all your artillery fire on one scouted spot. Experienced players call him the most misused British unit in 1v1: capture rear sectors with him early, then fight next to the Lieutenant, or park him by your emplacements as a forward retreat point.

## What top players actually build

In an analysis of 135 top games:

- the ${building('Casualty Clearing Station', 'casualty-clearing-station')} (180 manpower, 15 fuel) appeared in about seven of ten games;
- the ${building('3" Mortar Emplacement', 'mortar-gun-nest')} and the ${building('17 Pounder', 'anti-tank-gun-nest')} were the most built emplacements;
- the ${building('Bofors', 'bofors-gun-nest')} and the ${building('25 Pounder', 'cw-howitzer-gun-nest')} appeared in about one game in five; the ${building('Vickers emplacement', 'cw-machine-gun-nest')} almost never.

## Each emplacement

- **Mortar emplacement (280 manpower):** build it early against the Wehrmacht to break MG42 pins and drive MGs out of houses. Nearly useless against Panzer Elite halftracks. Motorcycles kill it while it is being built.
- **17 Pounder (280 manpower, 25 fuel):** the British answer to having no early anti-tank, but it delays your third tier. Skip it if the Wehrmacht spends its fuel on veterancy instead of vehicles.
- **Bofors (280 manpower, 15 fuel):** good against light vehicles and short-range infantry; slow to build.
- **25 Pounder (450 manpower, 75 fuel):** mainly worth it with the Royal Canadian Artillery. Build it far back, and never more than two artillery pieces.
- **Vickers emplacement:** weak in 1v1, better on busy routes and bridges in team games.

## Trenches

Trenches are a short-term tool. Don't camp expensive Infantry Sections in them: flamethrowers kill everything inside. A trench started to about ten percent makes good Motorcycle bait.

## The Sim City trap

Top players build emplacements because they need them, not as a plan. Clusters of unsupported emplacements invite V1 rockets, flamethrower Pioneers and Walking Stukas. Scuttle rear emplacements to free up population.`
	},
	{
		key: 'cw-doctrines',
		category: 'british-commonwealth/2v2',
		title: 'British doctrines: Commandos, Engineers or Artillery',
		excerpt:
			'Which British support regiment to pick, the abilities worth the command points, and what each one counters.',
		body: `When top players picked a British doctrine, the Royal Commandos were chosen about three times in four, the Royal Engineers second. Royal Canadian Artillery was rarely used in 1v1, but is strong in team games. Scout your opponent before you commit.

## Royal Commandos

The ${commander('Royal Commandos Support', 'royal-commando-tree')}:

- ${upgrade('Glider-borne Commandos', 'royal-commandos-00')} land a ${building('Glider', 'glider')} that builds ${unit('Commandos', 'commando-squad')}. Their smoke makes them invisible and clears suppression; their demolition charge can be placed anywhere.
- The ${upgrade('Tetrarch Tank', 'royal-commandos-01')} is a niche answer to light vehicles.
- ${upgrade('Radio Triangulation Detectors', 'royal-commandos-10')} and ${upgrade('Ultra Decryption', 'royal-commandos-11')} give intelligence and reveal cloaked Stormtroopers.

## Royal Engineers

The ${commander('Royal Engineers Support', 'royal-engineer-tree')}:

- The ${upgrade('Churchill Infantry Tank', 'royal-engineers-10')} calls in a ${unit('Churchill', 'churchill-squad')} for manpower only: strong front armour, slow, and it crushes tank traps. Pick it on fuel-starved maps or against fast Pumas and StuGs. It cannot beat a Hetzer head-on.
- ${upgrade('Improved Emplacements', 'royal-engineers-00')} make your emplacements much tougher.
- ${upgrade('Hull Down', 'royal-engineers-01')} digs a tank in. Good on Fireflies, bad on the Crocodile, whose flamer only fires forward.
- The doctrine has few munition abilities, so spend munitions on Expert Engineer Sappers, mines and wire.

## Royal Canadian Artillery

The ${commander('Royal Artillery Support', 'royal-canadian-artillery-tree')}:

- ${upgrade('Forward Observation Officers', 'royal-canadian-artillery-00')} let the Lieutenant and Captain call in artillery.
- ${upgrade('Creeping Barrage', 'royal-canadian-artillery-01')} needs a 25 Pounder or Priest.
- ${upgrade('Supercharge Artillery Rounds', 'royal-canadian-artillery-10')} give your artillery, mortar emplacements included, more range.
- Strongest against a defensive Wehrmacht with medic bunkers and Paks.

## The other side's choice

Against the Wehrmacht, top British players faced Blitzkrieg about half the time. Against Panzer Elite, about two in three games were Tank Destroyer Tactics, which you can recognise by the Kettenkrad's icon.`
	},
	{
		key: 'cw-matchups',
		category: 'british-commonwealth/2v2',
		title: 'British vs Wehrmacht and vs Panzer Elite',
		excerpt:
			'What each Axis doctrine throws at the British, and how to answer halftrack rushes, Marders and Hetzers.',
		body: `## Against the Wehrmacht

Be aggressive early. Infantry Sections, the Bren Carrier and a mortar emplacement are hard for the Wehrmacht to handle. Your biggest threat is fire: flamethrower Pioneers, Nebelwerfers and Walking Stukas burn out trenches and emplacements.

- **Blitzkrieg:** cloaked ${unit('Stormtroopers', 'stormtrooper-squad')} with Panzerschrecks will hunt your trucks and anti-tank. Use Sapper mines and wire, and Radio Triangulation if you picked the Commandos.
- **Terror:** the King Tiger is coming. Have at least one 17 Pounder and one ${unit('Sherman Firefly', 'sherman-firefly-squad')}, and don't cluster trucks and emplacements where a V1 can hit them all.
- **Defensive:** keep trucks and emplacements out of the 88mm Flak's line of sight.

Common Wehrmacht plays to expect:

- An MG42 pinning your Headquarters with Motorcycle support. Get out of the pin quickly.
- A sniper. Each lost man costs an Infantry Section dearly to reinforce; the Recon Element's marksman shot answers snipers and MG gunners.
- Motorcycles hunting your Lieutenant, and Panzerfausts saved for the Bren Carrier and Stuart.

## Against Panzer Elite

- **Halftrack rush:** keep Bren munitions ready and part-built trenches near your Headquarters, with an upgraded Bren Carrier and Infantry Sections in front. Kill the halftracks first, then the Panzer Grenadiers repairing them. Rush the Stuart and use the Casualty Clearing Station if you are pinned.
- **Tank Destroyer Tactics:** expect Teller mines, then a Hetzer. Repair the Stuart often and keep it off roads. Build a quick 17 Pounder or circle with a Cromwell. Churchills lose to Hetzers.
- **Marder rush:** the signs are no fuel spending, no halftracks and Scout Cars. Answer with PIAT Sappers, a 17 Pounder near your base, or a Churchill.
- **Luftwaffe:** upgraded Fallschirmjäger out-fight British infantry up close.
- **Scorched Earth:** booby traps catch officers and Infantry Sections; scout points before you capture them.`
	},
	{
		key: 'cw-team',
		category: 'british-commonwealth/2v2',
		title: 'British in team games and the most common mistakes',
		excerpt:
			'Pairing the British with a US ally, artillery in team games, and the mistakes that lose British games.',
		body: `## Playing next to a US ally

- Your recon Infantry Section captures the Headquarters sector and builds a mortar emplacement and a Casualty Clearing Station straight away, while the Lieutenant captures.
- Park the Headquarters next to your American ally so you can share each other's healing.
- The ally's first Riflemen guard your mortar; your mortar shells the MG42s that pin your ally.
- In the mid game: the Field Support Truck, Sappers with Expert Engineers, a 25 Pounder, the Captain and a Stuart. A Bofors helps against armoured-car spam.
- Keep the Captain a full screen away from your base as a retreat point that dodges Nebelwerfer fire on the Headquarters.

## Artillery in team games

The Royal Canadian Artillery, 25 Pounders and Vickers emplacements are all stronger in team games than in 1v1. With two or more artillery pieces, the Captain's Victor Target concentrates their fire. Even so, an artillery-only, passive game usually loses.

## The most common British mistakes

- Building a Sim City and sitting in base while the enemy out-techs you.
- Losing the Lieutenant or the Stuart early.
- Leading attacks with your officers.
- Moving Bren squads and expecting them to fire: the Bren only fires when the squad stops.
- Standing still under mortar or artillery fire.
- Fighting Hetzers head-on.
- Building emplacements in the middle of an attack, or without protection.
- More than two artillery pieces, or three or more Cromwells.

## How to improve

Watch your replays with the fog of war on, play the same map from both starting positions, and after each game check your tech speed, how aggressive you were and which fights you chose.`
	}
];
