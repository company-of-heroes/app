/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1750043174")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\nu.user AS id,\nu.user,\n(\nSELECT json_group_array(\njson_object(\n'profile_id', json_extract(sub.value, '$.profile.profile_id'),\n'alias', json_extract(sub.value, '$.profile.alias')\n)\n)\nFROM (\nSELECT DISTINCT player.value AS value\nFROM lobbies l, json_each(l.players) AS player\nWHERE l.user = u.user\nAND json_extract(player.value, '$.profile.profile_id') IS NOT NULL\n) sub\n) AS players,\n(\nSELECT json_group_array(map_sub.map)\nFROM (\nSELECT DISTINCT map\nFROM lobbies\nWHERE user = u.user AND map IS NOT NULL\n) map_sub\n) AS maps\nFROM (\nSELECT DISTINCT user\nFROM lobbies\nWHERE user IS NOT NULL\n) u"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1750043174")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  p.user as id,\n  p.user,\n  p.players,\n  m.maps\nFROM\n  (\n    -- 1. Existing logic: Unique Players\n    SELECT\n      sub.user,\n      json_group_array(\n        json_object(\n          'profile_id', json_extract(sub.value, '$.profile.profile_id'),\n          'alias', json_extract(sub.value, '$.profile.alias')\n        )\n      ) as players\n    FROM (\n      SELECT DISTINCT\n        l.user,\n        player.value\n      FROM lobbies l, json_each(l.players) as player\n      WHERE json_extract(player.value, '$.profile.profile_id') IS NOT NULL\n    ) as sub\n    GROUP BY sub.user\n  ) as p\nLEFT JOIN\n  (\n    -- 2. New logic: Unique Maps\n    SELECT\n      sub.user,\n      json_group_array(sub.map) as maps\n    FROM (\n      SELECT DISTINCT\n        user,\n        map\n      FROM lobbies\n    ) as sub\n    GROUP BY sub.user\n  ) as m\nON p.user = m.user"
  }, collection)

  return app.save(collection)
})
