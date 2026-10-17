# Ribbon factions and supporter category

Date: 2026-10-16

## Goal

A player should see at a glance which faction a ribbon belongs to (US Forces, Wehrmacht, Commonwealth, Panzer Elite, global), and supporter ribbons get a category of their own. The SVG files are grouped in a folder per category.

Out of scope: more variety between ribbons of the same faction. The centre patterns stay exactly as they are.

## Decisions

- Faction marking: wide national edge stripes on both ends (option A in the visual comparison), about three times wider than now. No emblems.
- Existing supporter ribbons `ribbon-401` to `ribbon-408` form the Supporter category. No new supporter ribbons.
- Every `ribbon-NNN` keeps its number, category, centre pattern, devices and title. Rewards in PocketBase keep their ribbon key, so no migration is needed.

## 1. Generator and assets (`packages/shared-assets`)

`scripts/generate-ribbons.mjs`:

- Replace each category's `edge` with the national edge below. Widths are in ribbon units (the ribbon is 70 wide). The 0.4 dark divider stays.

  | Category | Folder | Edge, outside → in |
  |---|---|---|
  | US Forces | `americans/` | navy 4.8, white 1.3, red 2.6, white 1.3 |
  | Wehrmacht | `wehrmacht/` | black 3.5, white 2.2, red 4.2 |
  | Commonwealth | `british/` | khaki 4.8, crimson 2.6, navy 1.9 |
  | Panzer Elite | `panzer_elite/` | black 4.8, rose 2.2, black 1.3, rose 1 |
  | Global | `global/` | gold 4.8, white 1.3 |
  | Supporter | `supporter/` | burgundy 4.8, gold 1.9 |

- The edge does not use the RNG. The seed and the order of RNG calls stay unchanged, so every centre comes out the same. `layout()` scales the centre into the space between the wider edges.
- Write each SVG to `ribbons/<faction key>/ribbon-NNN.svg`. The number stays global and unique across folders. Before writing, delete the old `ribbon-*.svg` files in `ribbons/` and in each category folder.
- `ribbons.json` stays in `ribbons/`. `file` becomes the path relative to `ribbons/` (`americans/ribbon-001.svg`). Every other field (`id`, `title`, `faction`, `raceId`, `pattern`, `stripes`, `device`, `series`, `level`) stays the same.

Check: compare the old and new manifest with `file` ignored. Every other field must be identical.

## 2. Loading

- `packages/app/src/lib/utils/ribbons.ts` and `packages/website/src/lib/utils/media/ribbons.ts` glob `shared-assets/ribbons/**/*.svg`.
- `ribbonsFrom` (`packages/ui/src/reward/ribbon.ts`) matches a manifest entry to a glob URL by the path after `ribbons/`. The key stays the basename without `.svg` (`ribbon-042`).
- `website/src/lib/server/services/subscriptions.ts` (`cardRibbons`) and `pocketbase/scripts/seed-rewards.mjs` read the manifest. Check both for any use of `file` as a bare name.
- The API check `^ribbon-\d{3}$` stays.

## 3. Supporter category (`packages/ui/src/reward`)

- `RibbonManifestEntry` and `Ribbon` get `faction` (the manifest key: `americans`, `wehrmacht`, `british`, `panzer_elite`, `global`, `supporter`).
- New type `RewardCategory = 0 | 1 | 2 | 3 | 'global' | 'supporter'`. `REWARD_FACTION_ORDER` becomes `REWARD_CATEGORY_ORDER`: `[0, 1, 2, 3, 'global', 'supporter']`.
- `rewardRaceId` becomes `rewardCategory(reward, ribbon)`:
  1. It returns `'supporter'` when a condition uses `supporter_active` or `supporter_months`, or when the ribbon's faction is `supporter`.
  2. Otherwise it uses the current rule: one condition faction, else the ribbon's `raceId`.
  3. If neither applies, it returns `'global'`.
- `catalog.ts` `CatalogEntry.raceId` becomes `category`.
- `reward-catalog.svelte` (wiki), `reward-icons.svelte` (profile rack) and `reward-ribbon-field.svelte` (admin picker) group by category. The Supporter tab/section/group comes after Global. Labels: `t(getRaceLabel(id))` for factions, `t('Global')`, and `t('Supporter')` (already in en/es/ko).
- Search all users of `rewardRaceId`, `REWARD_FACTION_ORDER`, `FACTION_ORDER` and `CatalogEntry.raceId`, and update each one.
- The layout follows the flush-border rules. An empty Supporter section is not rendered.

## 4. Other

- Changeset `.changeset/<adjective>-<noun>.md`: `@company-of-heroes/shared-assets`, `@company-of-heroes/ui`, `@company-of-heroes/app` and `@company-of-heroes/website` patch, with `enhance; clearer faction ribbons and a separate supporter category`.
- `POLICY.md`: no change (no change to how data is handled).
- Add `.superpowers/` to `.gitignore`.
- No tests (project rule).

## Verification

- Manifest diff as above. Look at a sample of ribbons from each category.
- `pnpm check` for ui, app and website.
- `svelte-autofixer` on every edited `.svelte` file.
- Website dev:
  - `/wiki/rewards`: all tabs including Supporter.
  - A profile with ribbons.
  - The admin ribbon picker in the app.
  - Ribbons load, and each section closes with exactly one border line.
