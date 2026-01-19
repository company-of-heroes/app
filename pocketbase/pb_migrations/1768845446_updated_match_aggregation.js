/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1750043174")

  // update collection data
  unmarshal({
    "name": "lobby_aggregation",
    "viewQuery": "SELECT\n  p.user as id,\n  p.user,\n  p.players,\n  m.maps\nFROM\n  (\n    -- 1. Existing logic: Unique Players\n    SELECT\n      sub.user,\n      json_group_array(\n        json_object(\n          'profile_id', json_extract(sub.value, '$.profile.profile_id'),\n          'alias', json_extract(sub.value, '$.profile.alias')\n        )\n      ) as players\n    FROM (\n      SELECT DISTINCT\n        l.user,\n        player.value\n      FROM lobbies l, json_each(l.players) as player\n      WHERE json_extract(player.value, '$.profile.profile_id') IS NOT NULL\n    ) as sub\n    GROUP BY sub.user\n  ) as p\nLEFT JOIN\n  (\n    -- 2. New logic: Unique Maps\n    SELECT\n      sub.user,\n      json_group_array(sub.map) as maps\n    FROM (\n      SELECT DISTINCT\n        user,\n        map\n      FROM lobbies\n    ) as sub\n    GROUP BY sub.user\n  ) as m\nON p.user = m.user"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1750043174")

  // update collection data
  unmarshal({
    "name": "match_aggregation",
    "viewQuery": "SELECT\n  p.user as id,\n  p.user,\n  p.players,\n  m.maps\nFROM\n  (\n    -- 1. Existing logic: Unique Players\n    SELECT\n      sub.user,\n      json_group_array(\n        json_object(\n          'profile_id', json_extract(sub.value, '$.profile.profile_id'),\n          'alias', json_extract(sub.value, '$.profile.alias')\n        )\n      ) as players\n    FROM (\n      SELECT DISTINCT\n        l.user,\n        player.value\n      FROM matches l, json_each(l.players) as player\n      WHERE json_extract(player.value, '$.profile.profile_id') IS NOT NULL\n    ) as sub\n    GROUP BY sub.user\n  ) as p\nLEFT JOIN\n  (\n    -- 2. New logic: Unique Maps\n    SELECT\n      sub.user,\n      json_group_array(sub.map) as maps\n    FROM (\n      SELECT DISTINCT\n        user,\n        map\n      FROM matches\n    ) as sub\n    GROUP BY sub.user\n  ) as m\nON p.user = m.user"
  }, collection)

  return app.save(collection)
})
