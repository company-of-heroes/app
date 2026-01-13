/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3080897202")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  '1' as id,\n  (\n    SELECT\n      json_group_array(\n        json_object(\n          'profile_id', sub.profile_id,\n          'alias', sub.alias\n        )\n      )\n    FROM (\n      SELECT\n        json_extract(player.value, '$.profile.profile_id') as profile_id,\n        MAX(json_extract(player.value, '$.profile.alias')) as alias\n      FROM matches l, json_each(l.players) as player\n      WHERE json_extract(player.value, '$.profile.profile_id') IS NOT NULL\n      GROUP BY json_extract(player.value, '$.profile.profile_id')\n    ) as sub\n  ) as players,\n  (\n    SELECT\n      json_group_array(sub.map)\n    FROM (\n      SELECT DISTINCT\n        map\n      FROM matches\n    ) as sub\n  ) as maps,\n  (\n    SELECT\n      json_group_array(sub.user)\n    FROM (\n      SELECT DISTINCT\n        user\n      FROM matches\n    ) as sub\n  ) as users"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3080897202")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  '1' as id,\n  (\n    SELECT\n      json_group_array(\n        json_object(\n          'profile_id', json_extract(sub.value, '$.profile.profile_id'),\n          'alias', json_extract(sub.value, '$.profile.alias')\n        )\n      )\n    FROM (\n      SELECT DISTINCT\n        player.value\n      FROM matches l, json_each(l.players) as player\n      WHERE json_extract(player.value, '$.profile.profile_id') IS NOT NULL\n    ) as sub\n  ) as players,\n  (\n    SELECT\n      json_group_array(sub.map)\n    FROM (\n      SELECT DISTINCT\n        map\n      FROM matches\n    ) as sub\n  ) as maps,\n  (\n    SELECT\n      json_group_array(sub.user)\n    FROM (\n      SELECT DISTINCT\n        user\n      FROM matches\n    ) as sub\n  ) as users"
  }, collection)

  return app.save(collection)
})
