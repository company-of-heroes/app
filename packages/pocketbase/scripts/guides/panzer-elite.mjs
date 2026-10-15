import { building, commander, map, unit, upgrade } from './links.mjs';

export const PANZER_ELITE = [
	{
		key: 'pe-opening',
		category: 'panzer-elite/1v1',
		title: 'Panzer Elite 1v1 openings: Kampfgruppe or Logistik first',
		excerpt:
			'How many Panzer Grenadiers to build, which first building to pick, and three proven build orders against the US.',
		body: `Panzer Elite has small, expensive squads and fast light vehicles. Every squad counts: losing one early hurts more than for any other faction.

## The core of every opening

- Build two to five ${unit('Panzer Grenadiers', 'panzer-grenadier-squad')} (255 manpower). Most guides settle on about four or five.
- Use the ${unit('Kettenkrad', 'recon-squad')} or the ${unit('Schwimmwagen', 'panzer-elite-schwimmwagen')} to capture fuel.
- Give early squads the ${upgrade('Gewehr 43 Package', 'panzer-elite-squad-g43-package')} (50 munitions) when your munitions allow.
- Never trade the Kettenkrad for a point. It is also your mine detector: Panzer Elite has no minesweeper.

## Kampfgruppe or Logistik first

- The ${building('Kampfgruppe Kompanie', 'kampfgruppe-kompanie')} (220 manpower, 20 fuel) is stronger in a straight fight: the ${unit('Infantry Halftrack', '250-light-halftrack-squad')}, the ${unit('Mortar Halftrack', '250-mortar-halftrack-squad')} and anti-tank infantry.
- The ${building('Logistik Kompanie', 'logistik-kompanie')} (220 manpower, 20 fuel) techs faster without fuel-hungry units and helps against early US infantry masses.

Either one unlocks the second tier: the ${building('Panzer-Jager Kommand', 'panzerjager-kommand')} and the ${building('Panzer-Support Kommand', 'panzer-artillerie-kommand')}.

## Build 1: double Infantry Halftrack

1. Two Panzer Grenadiers; the Kettenkrad captures fuel.
2. G43s on both squads.
3. The Kampfgruppe Kompanie, then two Infantry Halftracks.
4. Two more Panzer Grenadiers without upgrades (one more against the British).
5. ${upgrade('Advanced Repair', 'upgrade-advanced-repair')} only against the US.

**Against US BARs:** follow up with the Panzer-Jager Kommand, an ${unit('Armored Car', '222-armored-car-squad')} and MP44s on one squad, then a second Armored Car. **Against a US Motor Pool:** G43s on every squad, then the Panzer-Support Kommand and a ${unit('Light AT Halftrack', '250-sniper-halftrack-squad')}.

## Build 2: the five-minute Armored Car

The Kettenkrad captures fuel while about four Panzer Grenadiers fight near the enemy's fuel points. At 75 fuel, retreat one squad to build the Panzer-Jager Kommand and get the Armored Car out to kite Riflemen.

## Build 3: the relentless Logistik build

1. Four or five Panzer Grenadiers with as many G43s as possible.
2. ${upgrade('Defensive Operations', 'upgrade-regeneration')} for healing and ${upgrade('Incendiary Grenades', 'upgrade-incendiary-grenade')}.
3. The Logistik Kompanie, then the Panzer-Support Kommand for one or two Light AT Halftracks: one if BARs come before an M8, two if no BARs appear.
4. ${upgrade('Increase Squad Sizes', 'upgrade-squad-size')}, then the Panzer-Jager Kommand for one or two Armored Cars.

## Don't follow a build blindly

Experienced players warn against rigid build orders. Read your opponent, and save Incendiary Grenades for British trenches and US garrisons: thrown at a squad in the open, it just walks away.`
	},
	{
		key: 'pe-vet',
		category: 'panzer-elite/1v1',
		title: 'Panzer Elite veterancy and upgrades: offensive or defensive',
		excerpt:
			'How Panzer Elite veterancy works, which bonus to pick at each rank, and which upgrades are worth buying.',
		body: `Panzer Elite does not buy veterancy like the Wehrmacht. Units earn it from kills, and also share in the kills of nearby allies. At each rank you choose, for free, an **offensive** or a **defensive** bonus. Until you choose, the rank gives nothing.

## How it is earned

Kill experience is shared with friendly units nearby, so squads that fight together level up together. A lone unit only earns its own kills.

## What the bonuses do

- **Offensive:** better accuracy, faster reload and cooldowns, more penetration.
- **Defensive, infantry:** less damage and suppression taken, more health and slow healing.
- **Defensive, vehicles:** the first level is the strongest: harder to hit, more health and more speed. Take defensive first on vehicles.
- The Kettenkrad, Schwimmwagen, Munitions Halftrack, Vampire Halftrack and Bergetiger cannot choose: they always get the defensive bonus.

## Recommended picks

- Standard Panzer Grenadiers and Tank Busters: offensive, offensive, defensive.
- G43 squads: all offensive. MP44 squads: all defensive.
- Most vehicles: defensive first, then offensive.
- The Jagdpanther, Infantry Halftrack and a late Scout Car: all defensive.

## The upgrades

- ${upgrade('Increase Squad Sizes', 'upgrade-squad-size')} (160 manpower, 25 fuel): needed against snipers, BARs and Rangers. A four-man Panzer Grenadier squad matches a US Riflemen squad.
- ${upgrade('Anti Tank Grenades', 'upgrade-at-grenade')} (150 manpower, 20 fuel): they miss moving vehicles, so disable the vehicle first.
- ${upgrade('Kampfgruppe Kompanie Upgrade', 'struktur-armaments-upgrade')} (160 manpower, 35 fuel): unlocks the ${upgrade('Panzerschreck', 'panzer-elite-squad-anti-tank-package')} on Panzer Grenadiers.
- ${upgrade('Field Craft', 'upgrade-capture-rate')}: faster capturing, mostly useful late.
- ${upgrade('Veteran Sergeant', 'upgrade-vet-sgt')}: only if you get suppressed a lot.
- ${upgrade('Group Zeal', 'upgrade-mob-bonus')}: for large infantry groups, but those are easy targets for artillery and strafing runs.
- ${upgrade('Advanced Repair', 'upgrade-advanced-repair')}: only if your vehicles keep dying; long repairs tie up your Panzer Grenadiers.

Every source agrees on one thing: don't buy every upgrade. Pick the ones your army needs.

## G43 or MP44

The G43 is for long range and suppressive volley fire; the ${upgrade('MP44', 'panzer-elite-squad-mp44-package')} is for close range and fighting on the move.`
	},
	{
		key: 'pe-logistik',
		category: 'panzer-elite/1v1',
		title: 'Logistik support vehicles: Munitions Halftrack, Vampire and Scout Car',
		excerpt:
			'How to use the Munitions Halftrack, when the Vampire Halftrack pays off, and what the Scout Car is for.',
		body: `The ${building('Logistik Kompanie', 'logistik-kompanie')} builds three support vehicles that do not fight much themselves but make the rest of your army stronger.

## Munitions Halftrack

Infantry and vehicles near the ${unit('Munitions Halftrack', '251-heavy-halftrack-squad')} (200 manpower) recharge their munition abilities much faster. That means more Anti Tank Grenades, more Treadbreakers and more focus fire. Some players call it the most underrated Panzer Elite unit. It does not speed up artillery barrages. Keep it with your Mortar Halftrack.

## Vampire Halftrack

Lock the ${unit("Funkwagen 'Vampire' Halftrack", '250-vampire-halftrack-squad')} (220 manpower) down in an enemy sector and it diverts part of that sector's income to you. While locked down it cannot move, but it cloaks and gets tougher. It also reveals nearby enemy infantry through the fog of war, but not units in buildings, AT guns or vehicles.

When it is worth it:

- After your third or fourth Panzer Grenadier squad, not after the first or second.
- To protect a lead, not to come back from behind.
- On high-income points, never on low ones.
- Drive it in early and unseen: driving over bushes or fences gives its path away.

In 2v2, a Vampire in the British starting sector is strong. Pull it back when a Recon Element comes near. Players disagree on how useful it is in 1v1.

## Scout Car

The ${unit('Scout Car', '221-armoured-car-squad')} (220 manpower) is a recon and flanking vehicle with an all-round MG42. It is good at hunting British Lieutenants and snipers. With the ${upgrade('Logistik Upgrade', 'panzer-elite-221-secure-package')} it can hold a sector in the late game.`
	},
	{
		key: 'pe-tier2',
		category: 'panzer-elite/1v1',
		title: 'Panzer-Jager Kommand or Panzer-Support Kommand',
		excerpt:
			'Which second-tier building to pick, and how to use the Armored Car, Marder III, Light AT Halftrack and Panzer IV.',
		body: `Both second-tier buildings cost 220 manpower and 30 fuel and need the Kampfgruppe or Logistik Kompanie.

## Panzer-Jager Kommand

Pick the ${building('Panzer-Jager Kommand', 'panzerjager-kommand')} against infantry-heavy US play (BARs, lots of Riflemen) and snipers. It builds:

- the ${unit('Armored Car', '222-armored-car-squad')} (255 manpower, 25 fuel): kites Riflemen and kills snipers. Stay at maximum range from garrisons, and never fight infantry in heavy cover with it;
- the ${unit('Marder III', 'marderiii-squad')} (300 manpower, 40 fuel): strong penetration. Use it like an anti-tank gun: set it up, spread out and let the enemy come to you. Its first shots on the move tend to miss;
- ${unit('Assault Grenadiers', 'tankbuster-anti-infantry-squad')}, and the ${upgrade('Jager Kommand Upgrade', 'gebaude-light-arms-upgrade')} that unlocks MP44s.

## Panzer-Support Kommand

Pick the ${building('Panzer-Support Kommand', 'panzer-artillerie-kommand')} against a US Motor Pool or an early M8. It builds:

- the ${unit('Light AT Halftrack', '250-sniper-halftrack-squad')} (260 manpower, 15 fuel): its Treadbreaker immobilises a vehicle so a Marder or Panzerschrecks can finish it. It only wins straight fights against light vehicles;
- the ${unit('Bergetiger', 'bergetiger-squad')}: repairs fast and can recover destroyed vehicles, allied ones too, while the wreck still exists. Worth more in 2v2 and larger games;
- after the ${upgrade('Support Kommand Upgrade', 'gebaude-heavy-arms-upgrade')}: the ${unit('Panzer IV Infantry Support Tank', 'panzer-iv-squad-stubby')} (420 manpower, 60 fuel), strong against infantry, and the ${unit('Hotchkiss', 'hotchkiss-squad')}, which can carry a ${upgrade('Walking Stuka', 'panzer-elite-hotchkiss-stuka')} for artillery without a doctrine.

## The Panther Battlegroup

${upgrade('Activate Panther Battlegroup', 'axis-pe-panther-battlegroup')} needs the Kampfgruppe, Jager Kommand and Support Kommand upgrades. It unlocks the ${unit('Panther', 'pe-panther-squad')}, the strongest Panzer Elite tank.

## Opinions differ

A fast Panzer IV used to be seen as very strong; other players skip it as too expensive for how long it takes to get. Decide by how much fuel you have.`
	},
	{
		key: 'pe-doctrines',
		category: 'panzer-elite/team-games',
		title: 'Panzer Elite doctrines: Tank Destroyer, Luftwaffe or Scorched Earth',
		excerpt:
			'What each Panzer Elite doctrine is for, the abilities that matter, and which one to pick per matchup.',
		body: `Don't lock in a doctrine at the start of the game: read your opponent first. In analysed games, Tank Destroyer Tactics was picked about seven times in ten.

## Tank Destroyer Tactics

${commander('Tank Destroyer Tactics', 'pe-tank-destroyer-tree')}:

- ${upgrade('Teller Mines', 'pe-tank-destroyer-00')} are the strongest anti-tank mines in the game. They usually kill an M8 and immobilise a Stuart.
- The ${upgrade('Hetzer', 'pe-tank-destroyer-01')} calls in a ${unit('Hetzer', 'hetzer-squad')}. Against the British, only the Firefly can get through its front armour.
- ${upgrade('Double Infantry AT Efforts', 'pe-tank-destroyer-02')} gives your squads two Panzerschrecks.
- ${upgrade('Tank Awareness', 'pe-tank-destroyer-10')} shows enemy vehicles through the fog of war; ${upgrade('APCR Rounds', 'pe-tank-destroyer-11')} improve penetration.
- The ${upgrade('Jagdpanther', 'pe-tank-destroyer-12')} is excellent against tanks but weak against infantry.

## Luftwaffe Tactics

${commander('Luftwaffe Tactics', 'pe-luftwaffe-support-tree')}:

- ${upgrade('Fallschirmjager Infiltration', 'pe-luftwaffe-support-00')} brings ${unit('Fallschirmjager', 'panzer-falschirmjager')}: cheaper to reinforce than Panzer Grenadiers, cloaked in cover, with a Panzerfaust.
- ${upgrade('Luftwaffe Ground Forces', 'pe-luftwaffe-support-10')} lets you build the Flakvierling and the ${unit('88mm Flak', 'pe-88-flak-squad')}, the only Panzer Elite emplacements. Mortars and snipers punish their crews.
- The ${upgrade('Henschel Combat Air Patrol', 'pe-luftwaffe-support-02')} finishes off damaged tanks.

## Scorched Earth Tactics

${commander('Scorched Earth Tactics', 'pe-scorched-earth-tree')}:

- ${upgrade('Booby Trap Building', 'pe-scorched-earth-00')} and ${upgrade('Booby Trap Strategic Point', 'pe-scorched-earth-01')} are the most important abilities.
- ${upgrade('Roadblocks', 'pe-scorched-earth-10')} give heavy cover you can remove at will.
- The ${upgrade('Hummel', 'pe-scorched-earth-12')} is the best tool against infantry blobs.
- No anti-tank abilities: you rely on Marders and Panzerschrecks. Best for long games and against British bases.

## Quick picks

- Against the British: Tank Destroyer, often a halftrack rush into an early Hetzer.
- Against US infantry spam: Luftwaffe or Scorched Earth.
- Against Airborne blobs: Scorched Earth artillery.`
	},
	{
		key: 'pe-matchups',
		category: 'panzer-elite/1v1',
		title: 'Panzer Elite vs US and British: rules of thumb',
		excerpt:
			'How to handle Engineers, Riflemen, MGs, snipers and the M8, and the mistakes that lose Panzer Elite games.',
		body: `## Against the US

- **Engineers:** Panzer Grenadiers can chase them off, but avoid close fights; two Engineer squads beat one Panzer Grenadier squad. Kill flamethrower Engineers first.
- **Riflemen:** kite them with an early Armored Car, or fight at maximum range with more G43 squads. Plan on about two Panzer Grenadier squads per Riflemen squad, three to force a retreat. Never push Riflemen in cover.
- **Machine guns:** the ${unit('Mortar Halftrack', '250-mortar-halftrack-squad')} kills them safely. Otherwise flank from two sides.
- **Snipers:** any fast vehicle; the ${unit('Infantry Halftrack', '250-light-halftrack-squad')} or ${unit('Scout Car', '221-armoured-car-squad')} is cheaper than the Armored Car. Losing the vehicle to kill a sniper is still worth it.
- **M8, Jeep and M3:** Treadbreaker, then keep your distance; Teller mines; Panzerschreck squads in an Infantry Halftrack. Anti Tank Grenades alone miss moving vehicles.
- **What the US will try:** kiting with the Jeep, focusing your weakest squad, a fast M8 and cutting off your fuel. Use cover, split your army so you don't lose the other side of the map, and delay the M8.

## Against the British

- Open with the Mortar Halftrack and incendiary rounds against the first trench.
- Fight one British squad at a time, and hunt the Lieutenant with a Scout Car or Infantry Halftrack.
- Use the Kettenkrad to cut off sectors so the Field Support Truck cannot set up.
- Use Incendiary Grenades on trenches and Panzerschrecks on emplacements. Axis troops take extra damage inside British trenches: consider destroying trenches you capture.

## Panzer Elite weaknesses to remember

No minesweeper, no smoke, and healing only through Defensive Operations.

## The most common mistakes

- Halftracks in front of your infantry, or vehicles without infantry.
- Panzer Grenadiers bunched on a point.
- Even trades in the open against the US or British in the mid and late game.
- Ignoring strafing runs once Airborne appears.
- Thinking a halftrack protects its passengers from flamethrowers or snipers.
- Using Marders to attack.`
	},
	{
		key: 'pe-team',
		category: 'panzer-elite/team-games',
		title: 'Panzer Elite in team games',
		excerpt:
			'A double Panzer Elite plan, splitting roles with a teammate and what works best in victory-point games.',
		body: `## Double Panzer Elite

A well-known 2v2 plan where both players pick Tank Destroyer Tactics:

- **Player one:** three Panzer Grenadiers, the Kampfgruppe Kompanie, two Infantry Halftracks, another squad, the Panzer-Jager Kommand and a Marder. Takes Incendiary Grenades, APCR Rounds and Tank Awareness.
- **Player two:** three Panzer Grenadiers, the Kampfgruppe Kompanie, a Mortar Halftrack, the Panzer-Support Kommand, a Light AT Halftrack and a Panzer IV. Skips fuel-costly upgrades and can take a Hetzer when short on fuel.

Agree on the plan and a backup before you load in, especially against British emplacements.

## Capturing on team maps

On ${map('Duclair', 'duclair-4p')}, send Kettenkrads to the fuel points on each flank and Panzer Grenadiers to the middle.

## What gets better in team games

- The ${unit('Bergetiger', 'bergetiger-squad')} can recover allied wrecks too.
- The Vampire Halftrack in a British starting sector really hurts that player.
- Hummels and 88mm Flaks give sector control in victory-point games.

## Victory-point games

- Booby-trap the points.
- Scorch or disable the middle victory point, then hold it with artillery.
- Use Kettenkrads to spot for the 88mm Flak.`
	}
];
