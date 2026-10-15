import { building, commander, unit, upgrade } from './links.mjs';

export const US_FORCES = [
	{
		key: 'us-opening',
		category: 'us-forces/1v1',
		title: 'US Forces 1v1 opening: Barracks into four Riflemen',
		excerpt:
			'The opening that is rarely wrong: two Engineers, a forward Barracks, four Riflemen, and when to try the single-Engineer gambit or a Jeep.',
		body: `The US starts with the best early infantry in the game. A standard opening turns that into map control before the Axis can tech up.

## The default build

1. Your first ${unit('Engineers', 'engineer-infantry')} build the ${building('Barracks', 'barracks')} (160 manpower, 15 fuel) while the Headquarters queues a second Engineer squad.
2. Both Engineer squads capture points.
3. Start a ${unit('Riflemen', 'rifleman-squad')} squad (270 manpower) the moment the Barracks finishes, and keep producing until you have four.

Community guides call this the most balanced US opening: it is rarely wrong.

## Where to put the Barracks

Build it as far forward as you safely can. A forward Barracks means fresh squads reach the fight sooner and retreating squads come back faster. Top players do not build it at the back of their base.

## Capture order

Take the middle of the map first, where you contest the enemy. Points near your base can be captured later by squads walking back from a retreat. Riflemen capture faster than Engineers, Volksgrenadiers or Pioneers, so let them do the contested points. Fuel is a little more important than munitions early on.

## How Riflemen fight

- Up close they beat ${unit('Volksgrenadiers', 'volksgrenadier-squad')}; at long range, unupgraded Volks win.
- Do not charge Volks that sit still in cover. Do charge Volks that are capturing, moving or building wire.
- Two Riflemen squads usually beat one Volks squad with a Motorcycle, but lose to two Volks with a Motorcycle.

## The single-Engineer gambit

Skip the second Engineers and put that manpower into an earlier second Riflemen squad. The two squads can jump the first Volksgrenadiers before a second Axis unit arrives. It is risky: an early MG42 shuts it down, and you have no spare Engineers for flamethrowers or mines later.

## The Jeep

The ${unit('Jeep', 'jeep-squad')} (220 manpower) is worth it only as your first unit, when it can harass Pioneers and spot snipers. Built later it is mostly wasted. Reverse it away from fire, and remember it cannot cross wooden fences or barbed wire. Opinions differ: some guides skip it, others love it against Panzer Elite, whose Panzer Grenadiers have no Panzerfausts.

## Engineers as fighters

At 50 munitions, give your healthiest Engineer squad an ${upgrade('M2 Flamethrower', 'allies-m2-flamethrower')}. It turns them into a combat squad that clears garrisons and squads in cover.

## Common mistakes

- Losing one of your first three Riflemen squads: you lose the manpower and its veterancy.
- Bunching squads together so one MG pins them all.
- Holding less than half the map after the opening.`,
		translations: {
			ko: {
				title: '미군 1v1 오프닝: 병영 후 소총병 네 분대',
				excerpt: '거의 틀리지 않는 오프닝: 공병 두 분대, 전진 병영, 소총병 네 분대.',
				body: `미군은 게임에서 가장 강한 초반 보병으로 시작합니다. 표준 오프닝으로 추축군이 기술을 올리기 전에 맵을 장악하세요.

## 기본 빌드

1. 첫 ${unit('공병', 'engineer-infantry')}이 ${building('병영', 'barracks')}을 짓는 동안 본부에서 두 번째 공병을 생산합니다.
2. 두 공병 분대가 거점을 점령합니다.
3. 병영이 완성되면 바로 ${unit('소총병', 'rifleman-squad')}을 생산해 네 분대까지 늘립니다.

## 병영 위치

안전한 한도에서 최대한 앞에 지으세요. 새 분대가 더 빨리 전선에 도착하고, 후퇴한 분대도 더 빨리 돌아옵니다.

## 흔한 실수

- 처음 세 소총병 분대 중 하나를 잃는 것.
- 분대를 뭉쳐서 기관총 하나에 모두 제압당하는 것.`
			}
		}
	},
	{
		key: 'us-upgrades',
		category: 'us-forces/1v1',
		title: 'When to buy BARs, Mk2 Grenades and Sticky bombs',
		excerpt:
			'Which Barracks research to buy first against each enemy tech, and how to use each one.',
		body: `The ${building('Barracks', 'barracks')} researches three upgrades for all your ${unit('Riflemen', 'rifleman-squad')}. Buying them in the right order for the matchup matters more than buying all three.

## The three upgrades

- ${upgrade('M1918 BAR', 'weapon-package-bar')} (200 manpower, 60 fuel): two BARs per squad and the Suppression Fire ability. Best at medium range.
- ${upgrade('Mk2 Grenades', 'armory-throw-grenade')} (100 manpower, 40 fuel), then munitions per throw: flushes MGs out of cover and buildings.
- ${upgrade('Sticky bombs', 'armory-use-stickybomb')} (80 manpower, 25 fuel), then munitions per throw: your infantry answer to armoured cars and halftracks.

## Which one first

- **Wehrmacht going infantry (Grenadiers, MG42s):** BARs first, grenades later.
- **Wehrmacht going light armour (Puma, StuG):** sticky bombs first.
- **Panzer Elite:** grenades before BARs, because Panzer Elite has fast anti-tank that punishes an expensive BAR investment.

Guides disagree on grenades against the Wehrmacht: some call them the weakest opening tech, others buy them before BARs. Watch out for a double-sniper Wehrmacht if you delay BARs.

## The timed BAR flank

Set up four Riflemen and two flamethrower Engineers for an attack, and start the BAR research so it finishes a few seconds after the fight begins. The enemy commits to a fight he thinks he can win, and then your BARs arrive.

## Using BARs

- Keep your distance from SMG and assault-rifle squads; close in on rifle-armed squads.
- Suppression Fire works much better at short and medium range than at long range, and two squads using it together suppress twice as fast.
- It does nothing against garrisoned units or units under the Wehrmacht's For the Fatherland.

## Using grenades

Charge into the enemy's cover and throw while the rest of the squad keeps moving. Against buildings, throw at the short side with fewer windows; a grenade at the door can catch a squad as it leaves.

## Using sticky bombs

Throw at vehicles driving toward you; never chase them across open ground. A mine plus two sticky bombs kills an armoured car. Veteran Riflemen throw them from further away.

## The mistake to avoid

Buying early BARs and then not attacking. You spend the fuel and manpower and fall behind on your next tier.`
	},
	{
		key: 'us-wsc',
		category: 'us-forces/1v1',
		title: 'Weapons Support Center play: sniper, mortar and .30 cal',
		excerpt:
			'When the Weapons Support Center is worth it, a sniper-first build, and how to use the US support weapons.',
		body: `The ${building('Weapons Support Center', 'support-weapons')} (180 manpower, 15 fuel) builds the ${unit('Sniper', 'sniper-squad')}, the ${unit('Mortar Team', 'us-mortar-section')} and the ${unit('Heavy Machine Gun Team', 'us-heavy-machine-gun-section')}.

## Barracks first or Support Center first

The community consensus is that the Barracks first is the safer choice almost every time. A Support Center first can pay off hugely, but usually loses. US machine guns and mortars have shorter range than their Axis counterparts, so they support Riflemen rather than replace them.

The Support Center is worth considering against a strong Krieg Barracks Wehrmacht (Grenadiers, Pak 38s, Panzerschrecks). Build it after your third Riflemen squad, never after the second.

## A sniper-first build

1. Engineers build the Barracks.
2. Exactly three Riflemen.
3. Pull back the Engineers nearest your base to build the Support Center.
4. A sniper, then a Triage Center.
5. A mortar and a machine gun: the machine gun first against lots of Volks, the mortar first against a medic bunker.
6. A ${building('Supply Yard', 'us-quarter-master')}, then an ${unit('M10', 'm10-tank-destroyer')} or ${unit('M18 Hellcat', 'm18-hellcat')} as soon as possible.

## Using the sniper

The sniper (340 manpower) kills almost any Wehrmacht soldier with one shot. Fire three or four shots, then pull back for a few seconds: each shot makes it visible for a little longer. Keep Riflemen or flamethrower Engineers nearby, because Motorcycles and Scout Cars hunt snipers. Expect about a minute and a half of free sniping before an enemy counter-sniper shows up.

## The machine gun and the mortar

- The .30 cal is weaker than the MG42 and often needs two bursts to suppress. Use it to protect your sniper or mortar.
- The US mortar has less range than the Wehrmacht one. Always use its barrage, and shell the medic bunker before the enemy brings his own mortar.

## When not to build it

Once the enemy reaches the Sturm Armory, put your resources into sticky bombs, 57mm guns or tanks instead. In 2v2, even a Support Center player still needs a Barracks and Riflemen.`
	},
	{
		key: 'us-tech',
		category: 'us-forces/1v1',
		title: 'US tech: Supply Yard, Motor Pool, Tank Depot and the M8',
		excerpt:
			'When to build each US vehicle building, how the M8 rush works and how to use Shermans and tank destroyers.',
		body: `Every US vehicle comes from two buildings that both need the ${building('Supply Yard', 'us-quarter-master')} (100 manpower, 50 fuel). The Supply Yard itself needs the Barracks or the Weapons Support Center.

## The Supply Yard upgrades

- ${upgrade('Level 1 Production', 'allies-resource-upgrade')} (150 manpower, 50 fuel) lowers the upkeep of your army.
- ${upgrade('Level 2 Production', 'allies-resource-upgrade-advanced')} lowers it further.

They only pay off while you have a big army in the field. Buy them in long games, not when you need a vehicle now.

## Motor Pool

The ${building('Motor Pool', 'motorpool')} (240 manpower, 45 fuel) builds the ${unit('M8 Armored Car', 'm8-greyhound-squad')}, the ${unit('M1 57mm Anti Tank Gun', 'm1-57mm-at-squad')}, the ${unit('M3 Halftrack', 'm3-halftrack-squad')} and the ${unit('T17', 't17-armoured-car-squad')}.

A typical timing: the Supply Yard at 50 fuel, the Motor Pool with the next 45, and the M8 (280 manpower, 30 fuel) right away if you have the fuel. If you have been pushed off the map and have little fuel, build a 57mm first.

## The M8

- ${upgrade('Armor Skirts', 'allies-m8-armour-upgrade')} (50 munitions) make it nearly immune to small arms. Buy them before the ${upgrade('.50 cal gunner', 'allies-50cal-m8-greyhound')}.
- Stay just outside Panzerfaust range; two or three fausts or Pak shots kill it.
- Bring a minesweeper Engineer: one Teller mine can kill it.
- Only rush the side of the base with the Pak 38 if you get there before the Pak is built.

The T17 fires much faster but has no skirts and dies to two Panzerfausts. Most guides prefer the M8 against the Wehrmacht.

## Tank Depot

The ${building('Tank Depot', '2nd-motorpool')} (350 manpower, 90 fuel) builds the ${unit('M4 Sherman', 'm4-sherman-squad')}, the ${unit('M10', 'm10-tank-destroyer')}, the ${unit('M18 Hellcat', 'm18-hellcat')} and the Crocodile.

- A fresh Sherman is about even with a fresh Panzer IV and loses to a veteran one. It barely scratches Panthers and Tigers.
- The M10 and Hellcat share the same gun. Use them in pairs against the side armour, and circle slow-turreted Panthers while a 57mm supports.
- The ${upgrade('76mm gun', 'armory-76mm-upgrade')} (200 manpower, 50 fuel) upgrades every Sherman; some players only buy it with the Armor Company.

## Which one first

The Barracks into Motor Pool route, with a fast M8, is the standard light-vehicle path. Skipping both and relying on Airborne for anti-tank rarely works in the late game.`
	},
	{
		key: 'us-vs-pe',
		category: 'us-forces/1v1',
		title: 'US vs Panzer Elite: stalling, M8 timing and mines',
		excerpt:
			'Why the US skips the Weapons Support Center against Panzer Elite, and how to beat G43 Panzer Grenadiers.',
		body: `Panzer Elite plays very differently from the Wehrmacht: small, expensive squads, fast light vehicles and no Panzerfausts on its basic infantry.

## The opening

Skip the Weapons Support Center and go for the ${building('Supply Yard', 'us-quarter-master')} and ${building('Motor Pool', 'motorpool')} quickly. Until your vehicles arrive, ${unit('Riflemen', 'rifleman-squad')} stall and harass rather than trade. Riflemen capture faster than Panzer Grenadiers: if Panzer Elite takes one side of the map, take the other.

## Fighting Panzer Grenadiers

- ${unit('Panzer Grenadiers', 'panzer-grenadier-squad')} with G43s beat early Riflemen. Stay in heavy cover, focus the weakest squad, and retreat early.
- Flamethrower Engineers beat small Panzer Elite squads.
- Panzer Elite infantry is expensive and slow to reinforce, so one wiped squad hurts them a lot.
- The ${unit('Jeep', 'jeep-squad')} can kite Panzer Grenadiers and kill the Kettenkrad.

## The M8 timing

Get the ${unit('M8 Armored Car', 'm8-greyhound-squad')} out fast; many guides call it the best counter to most Panzer Elite units. But never send it in without Riflemen and a 57mm behind it: the Light AT Halftrack's Treadbreaker and Teller mines are what kill M8s. Circle a lone Marder outside its narrow firing arc. M8s cannot fight Panzer IVs or Panthers.

## Mines

Mine your base entrances and the roads. The Panzer Elite Infantry Halftrack suppresses Riflemen quickly in the open; Riflemen inside buildings take almost nothing from it.

## Doctrine

- Many players pick the ${commander('Airborne Company', 'allied-airborne-tree')} against Panzer Elite: the Paradrop AT Gun, Recoilless Rifles and the Strafing Run on groups of Panzer Grenadiers.
- Others prefer the ${commander('Infantry Company', 'allied-infantry-tree')} with lots of mines.

## Late game

Keep producing 57mm guns against Panzer IVs and halftracks, keep Riflemen next to the guns, and keep mining.`
	},
	{
		key: 'us-doctrines',
		category: 'us-forces/2v2',
		title: 'US doctrines: Infantry, Airborne or Armor Company',
		excerpt:
			'What each US company brings, which abilities are worth the command points, and when each one wins.',
		body: `Community rankings for 1v1 usually put the Airborne Company first, the Infantry Company second and the Armor Company last. The Armor Company is rated much higher in team games and very long games.

## Infantry Company

The ${commander('Infantry Company', 'allied-infantry-tree')}:

- ${upgrade('Rangers', 'allied-infantry-01')} call in ${unit('Rangers', 'ranger-team')}: elite infantry with bazookas, good against light armour and assault-rifle squads.
- ${upgrade('Off-Map Artillery Support', 'allied-infantry-11')} breaks bunkers and dug-in positions.
- The ${upgrade('105mm Howitzer', 'allied-infantry-12')} unlocks the ${unit('M2 105mm Howitzer', 'm2a1-105mm-howitzer-squad')}. Surround it with buildings, put sandbags in front, spread two of them apart and mine the approaches.
- The company is weak against tanks.

## Airborne Company

The ${commander('Airborne Company', 'allied-airborne-tree')}:

- ${upgrade('Paratroopers', 'allied-airborne-00')} drop ${unit('Airborne', 'airborne-infantry')} anywhere you can see. They reinforce anywhere unless retreating or garrisoned.
- The ${upgrade('Paradrop AT Gun', 'allied-airborne-01')} lands a 57mm right where you need it, so you can skip the Motor Pool for anti-tank.
- ${upgrade('Supply Drops', 'allied-airborne-02')} give munitions and fuel.
- ${upgrade('Air Recon', 'allied-airborne-10')} finds Pak 38s and snipers; the ${upgrade('Strafing Run', 'allied-airborne-11')} hits groups of infantry.

## Armor Company

The ${commander('Armor Company', 'allied-armor-tree')}:

- ${upgrade('Fast Deployment', 'allied-armor-10')} makes a light-vehicle rush with M8s and the Quad halftrack much stronger.
- The ${upgrade('M26 Pershing', 'allied-armor-02')} beats Tigers and most vehicles, but not the King Tiger.
- The ${upgrade('Calliope Rocket Launcher', 'allied-armor-01')} is far more valuable in team games than in 1v1.

## Double US in 2v2

- **Player one (Infantry Company):** one Engineer, four Riflemen, BARs, then sticky bombs against Panzer Elite or a Supply Yard against infantry spam.
- **Player two (Armor Company):** two Engineers, rush the Motor Pool, Fast Deployment, an M8, then the Quad and 57mm guns, later the Calliope or Pershing.
- Push together with the early M8 and Quad before the enemy has an answer.`
	}
];
