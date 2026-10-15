import { map, unit, upgrade } from './links.mjs';

const GR = 'https://www.gamereplays.org/companyofheroes/portals.php?show=page&name=';

export const GENERAL = [
	{
		key: 'mechanics',
		category: 'general',
		title: 'Core mechanics: cover, suppression, retreat and veterancy',
		excerpt:
			'What green, yellow and red cover really do, how suppression works, when to retreat and how each faction earns veterancy.',
		body: `Most fights in Company of Heroes are decided before the first shot: by where your squads stand and when you pull them out.

## Cover

When you move a squad, the ground shows its cover:

- **Green (heavy):** sandbags, stone walls, wrecks, tank traps, rubble.
- **Yellow (light):** craters, low walls, bushes, wooden fences, ditches.
- **Red (negative):** open fields and roads.

For the standard rifles, SMGs and machine guns, the game files give these multipliers on the target:

| Target position | Accuracy | Damage | Suppression |
|---|---|---|---|
| Heavy cover | ×0.5 | ×0.5 | ×0.1 |
| Light cover | ×0.5 | ×1.0 | ×0.5 |
| Open ground | ×1.25 | ×1.25 | ×1.0 |
| Negative cover | ×1.25 | ×1.25 | ×1.5 |

A squad in heavy cover takes roughly a quarter to a sixth of the damage it would take in the open, and is almost impossible to suppress.

## What beats cover

- **Grenades** ignore heavy and light cover and do double damage to garrisons.
- **Flamethrowers** do extra damage against heavy cover.
- **Snipers** ignore heavy and light cover.
- Every unit page on the wiki lists its own cover values, for example the ${unit('Riflemen', 'rifleman-squad')} or the ${unit('MG42', 'wh-heavy-machine-gun-section')}.

## Suppression and pinning

A suppressed squad crawls and fires slowly. Keep it under fire and it becomes **pinned**: it cannot move or shoot, only retreat. Heavy cover makes squads recover from suppression much faster; negative cover makes it slower. Attack machine guns from outside their firing arc.

## Retreat

- Retreat is the **T** key. Retreating squads move faster and take less damage, but they are not immune.
- Retreat when a squad is below about half strength, when an SMG squad or armoured car gets behind you, or when the enemy is focusing that squad.
- Retreat along a line that keeps cover between you and the enemy, and avoid roads.
- Under machine-gun fire, give the order just before a burst ends.
- **Shift+T** queues the retreat after the current order, for example after a grenade.

## Veterancy

Each faction earns it differently:

- **US:** from kills.
- **Wehrmacht:** bought per unit class at the Kampfkraft Centre.
- **British:** only officers and the command tank earn veterancy.
- **Panzer Elite:** from shared kills, choosing an offensive or defensive bonus at each rank.

A veteran squad you keep alive is worth far more than a fresh one. Give the killing blow on a vehicle to a durable squad, not a fragile anti-tank crew.

## Garrisons

Stone buildings are good, wooden ones poor. Windows decide where a garrison can shoot, and every building has blind spots where an enemy can throw grenades without return fire. Don't put several squads in one building: they all suffer when it collapses.

## Tanks

Keep the front of your tanks toward the enemy: rear armour is much weaker. Reverse out of a fight with short back steps rather than turning around. Tanks drive faster on roads and slower through heavy cover.`
	},
	{
		key: 'resources',
		category: 'general',
		title: 'Resources and territory: income, upkeep and cut-offs',
		excerpt:
			'What each point is worth, how upkeep eats your manpower, how cut-offs work and how to stop floating resources.',
		body: `## What each point is worth

From the current game data:

| Point | Income per minute | Capture time |
|---|---|---|
| Low fuel or munitions | +5 | 20 s |
| Medium fuel or munitions | +11 | 30 s |
| High fuel or munitions | +16 | 40 s |
| Strategic point | no resource | 15 s |
| Victory point | no resource | 20 s |

Every sector you hold also adds a little manpower. An Observation Post raises a point's income further.

## Manpower and upkeep

Manpower comes in over time, but every unit beyond a small army costs upkeep, and the bigger your army, the slower manpower comes in. Spend it: hundreds of manpower in the bank are units you are not using. The US can lower upkeep with ${upgrade('Level 1 Production', 'allies-resource-upgrade')}.

## Territory and cut-offs

A sector only pays out while it connects to your base through your own territory. Capturing one linking point cuts off every sector behind it; cut-off sectors flash on the minimap. Cutting off enemy points is often worth more than capturing them, and connected territory also raises your population cap.

## Which points first

- Early on, fuel and munitions matter more than victory points.
- One unit is enough to capture a point; stacking several invites artillery.
- Never capture under fire unless you are a second from finishing.

## Floating

Floating means letting a resource pile up.

- **Manpower:** never float it in the early or mid game.
- **Munitions:** spend them on mines unless you are saving for a big doctrine ability.
- **Fuel:** spend it on tech, veterancy or vehicles.`
	},
	{
		key: 'micro',
		category: 'general',
		title: 'Micro tips that win fights',
		excerpt:
			'Shift-queueing, attack-move, rally points, mines, capwalking and pulling back the squad the enemy is focusing.',
		body: `## Shift-queueing

- Queue captures on the tactical map: hold **Shift** and right-click each point.
- Steer flanks around obstacles with a few queued waypoints.
- Lay barbed wire in segments, and mines one at a time rather than in a line: a line goes off all at once.
- Always end a queue in cover, never standing on the point.

## Rally points

Set each production building's rally point to heavy cover near the front, and move it as the front moves.

## Attack-move

Press **A** and click the ground beside cover. The squad stops and fires when enemies come into range instead of running past them.

## Capwalking

Start a capture, then queue the next point: one man walks on while the rest finish the first point. The timing takes practice.

## Pull back the focused squad

When the enemy focuses one of your squads, pull just that squad back. If they chase, you have the advantage; if they stop, send it back in. This works best at long range.

## Mines

Move right after laying a mine, so a bunched-up squad does not give it away. Mines on common roads and flank routes are cheap insurance. You can even fake a mine by deliberately bunching a squad.

## Grenades

Grenades ignore cover, so save them for squads in heavy cover, garrisons and squads hiding in a building's blind spot.

## Snipers

Leave a pause between shots, and move after firing if an enemy sniper could be around.

## Idle units

Use idle Engineers and Pioneers to capture enemy points behind the line or to build wire and sandbags. It splits your opponent's attention.

## Pursuit

Finishing one fleeing squad is worth more than damaging several. Check your own retreat paths before you attack.

## Hotkeys

**T** retreat, **R** reinforce, **A** attack, **G** attack ground, **H** halt. **Ctrl** plus a number creates a control group; give each tank its own number.`
	},
	{
		key: 'maps',
		category: 'general',
		title: 'Map guide: the popular 1v1 maps',
		excerpt:
			'Resources, key points and what to watch for on Angoville, Semois, Langres, Wrecked Train, Beaux Lowlands and more.',
		body: `Point counts below come from the current map data on the wiki.

## ${map('Angoville', 'angoville-2p')}

Close house fighting in the east, open fields in the west. Two high fuel points and four high munitions points make it a resource-rich map. The cut-off points near each base are key spots to stall with a squad in heavy cover. Holding at least one high fuel point decides your early vehicle timing. The south start is often pinned by an MG in the nearby houses.

## ${map('Semois', 'semois-2p')}

A symmetric map: winning means the centre plus one more victory point. Each side's medium fuel point near its base is safe income; take the guaranteed medium munitions point before the high one. The church and houses are strong MG positions; from the north, flank the church using the house that blocks its line of sight. The early Axis base pin is a known Semois tactic.

## ${map('Langres', 'langres-2p')}

Resources and victory points sit close together. Mine the central crossroads. Two victory points plus two medium fuel points is a winning position. An MG in the house on the high munitions point can pin the south start.

## ${map('Wrecked Train', 'wrecked-train-2p')}

A large map with many low fuel points: retreating squads take a long time to walk back. Play three lanes, and cut the enemy's fuel rather than camping the centre victory point early. It is hard for the British against a fast-teching Panzer Elite.

## ${map('Beaux Lowlands', 'beaux-lowlands-2p')}

A wide map with four medium fuel points. Aim for a side and a half: two victory points and three fuel points. The farmhouse is a good MG spot. Early Marder rushes are common here.

## ${map('Sturzdorf', 'sturzdorf-2p')}

The most uneven map for resources: one side has the munitions, the other the fuel. The high fuel point on the right is crucial.

## ${map('Duclair', 'duclair-2p')}

A balanced favourite. Fuel sits in the outer corners and munitions near the centre victory point.

## ${map('Lyon', 'lyon-2p')}

A large, low-fuel map with many small points and slow, campy games.`
	},
	{
		key: 'improve',
		category: 'general',
		title: 'How to improve: replays, habits and what to look for',
		excerpt:
			'Why to play automatch against people, how to review your replays and the mistakes to look for in every game.',
		body: `## The right practice

- Play automatch against people rather than against the AI.
- Learn the basics in 1v1 before you play a lot of team games.
- Review your losses more than your wins.
- Keep a short list of mistakes you keep making and fix one at a time.
- Ask stronger players to look at your replays.

## What to look for in a replay

- How many resources you floated.
- Idle units.
- Squads you lost while retreating.
- Fights you started in red cover.
- Points you captured under fire.
- When your first vehicle came out compared to your opponent's.
- Cut-offs you missed.

Watch top players' replays once you understand the mechanics. Copy their build and capture orders as a loose outline, not a script. In almost every loss, a pile-up of small mistakes matters more than bad luck.

## Replay files

Replays are saved as \`.rec\` files in \`Documents/My Games/Company of Heroes Relaunch/Playback\`. They break after a game patch, because a replay only stores the commands. The companion app's replay pages let you browse and share your games without digging through that folder.`
	},
	{
		key: 'glossary',
		category: 'general',
		title: 'Company of Heroes glossary',
		excerpt:
			'Blob, float, cut-off, decap, wipe, kite, snare and the other words you will hear in community games and guides.',
		body: `- **Blob:** units moving in a tight group. Easy prey for MGs, artillery, flamethrowers and grenades.
- **Float:** unspent resources piling up.
- **Cut-off:** capturing a linking point so the enemy's sectors behind it stop paying out.
- **Decap:** neutralising an enemy point without finishing your own capture.
- **Back-cap / ninja cap:** capturing points behind the enemy's front line.
- **Capwalking:** one man walks to the next point while the rest of the squad finishes the capture.
- **Wipe:** a whole squad killed at once, including its veterancy.
- **Vet:** veterancy.
- **Pin / base pin:** an MG or other units locking the enemy inside their base.
- **Suppressed / pinned:** the two levels of suppression.
- **Green / yellow / red cover:** heavy, light and negative cover.
- **Crit:** a random critical hit on a vehicle, soldier or building.
- **Kite:** attacking while pulling back, to stay out of the enemy's effective range.
- **Snare:** an infantry ability that damages or slows a vehicle, like ${upgrade('Sticky bombs', 'armory-use-stickybomb')}.
- **Spam:** mass production of one unit.
- **BO:** build order.
- **Call-in / off-map:** units or strikes brought in by a doctrine.
- **OP:** an Observation Post, or "overpowered".
- **Sweepers:** Engineers or Pioneers with minesweepers.`
	}
];
