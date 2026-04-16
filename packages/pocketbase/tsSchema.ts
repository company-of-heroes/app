export interface Users {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: '_pb_users_auth_'
    /**
     * |               |         |
     * | ------------- | ------- |
     * | type          | `text`  |
     * | min           | `1`     |
     * | min           | `255`   |
     * | current value | `users` |
     */
    collectionName: 'users' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `password` |
     * | hidden   | `true`     |
     * | required | `true`     |
     * | min      | `8`        |
     * | max      | `71`       |
     */
    password: string
    /**
     * |                     |                   |
     * | ------------------- | ----------------- |
     * | type                | `text`            |
     * | hidden              | `true`            |
     * | required            | `true`            |
     * | min                 | `30`              |
     * | max                 | `60`              |
     * | autogeneratePattern | `[a-zA-Z0-9]{50}` |
     */
    tokenKey: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `email` |
     * | hidden   | `false` |
     * | required | `true`  |
     */
    email: string
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    emailVisibility: boolean
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    verified: boolean
    /**
     * |           |                                                                       |
     * | --------- | --------------------------------------------------------------------- |
     * | type      | `file(single)`                                                        |
     * | hidden    | `false`                                                               |
     * | required  | `false`                                                               |
     * | protected | `false`                                                               |
     * | maxSize   | `0`                                                                   |
     * | mimeTypes | `image/jpeg`, `image/png`, `image/svg+xml`, `image/gif`, `image/webp` |
     */
    avatar: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `false` |
     * | max      | `255`   |
     */
    name: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `0`     |
     * | required | `false` |
     */
    steamIds: any
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `0`     |
     * | required | `false` |
     */
    meta: any
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `date`  |
     * | hidden   | `false` |
     * | required | `false` |
     */
    lastLogin: string
    /**
     * |          |                  |
     * | -------- | ---------------- |
     * | type     | `select(single)` |
     * | hidden   | `false`          |
     * | required | `false`          |
     */
    role: 'admin' | 'moderator'
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    created: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updated: string
}

export interface Lobbies {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_1574334436'
    /**
     * |               |           |
     * | ------------- | --------- |
     * | type          | `text`    |
     * | min           | `1`       |
     * | min           | `255`     |
     * | current value | `lobbies` |
     */
    collectionName: 'lobbies' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |                |                    |
     * | -------------- | ------------------ |
     * | type           | `relation(single)` |
     * | hidden         | `false`            |
     * | required       | `true`             |
     * | collectionId   | `_pb_users_auth_`  |
     * | collectionName | `users`            |
     * | cascadeDelete  | `false`            |
     */
    user: string
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    isRanked: boolean
    /**
     * |          |          |
     * | -------- | -------- |
     * | type     | `number` |
     * | hidden   | `false`  |
     * | required | `true`   |
     * | onlyInt  | `false`  |
     */
    sessionId: number
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `true`  |
     * | max      | `5000`  |
     */
    title: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `true`  |
     * | max      | `5000`  |
     */
    map: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `0`     |
     * | required | `true`  |
     */
    players: any
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `0`     |
     * | required | `false` |
     */
    result: any
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    needsResult: boolean
    /**
     * |           |                |
     * | --------- | -------------- |
     * | type      | `file(single)` |
     * | hidden    | `false`        |
     * | required  | `false`        |
     * | protected | `false`        |
     * | maxSize   | `50000000`     |
     */
    replay: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    createdAt: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updatedAt: string
}

export interface Replays {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_3644265509'
    /**
     * |               |           |
     * | ------------- | --------- |
     * | type          | `text`    |
     * | min           | `1`       |
     * | min           | `255`     |
     * | current value | `replays` |
     */
    collectionName: 'replays' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `true`  |
     * | max      | `5000`  |
     */
    title: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `true`  |
     * | max      | `5000`  |
     */
    filename: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `true`  |
     * | max      | `5000`  |
     */
    mapFilename: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `true`  |
     * | max      | `5000`  |
     */
    mapName: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `date`  |
     * | hidden   | `false` |
     * | required | `false` |
     */
    gameDate: string
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    isRanked: boolean
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    isVpGame: boolean
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    isRandomStart: boolean
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    isHighResources: boolean
    /**
     * |          |          |
     * | -------- | -------- |
     * | type     | `number` |
     * | hidden   | `false`  |
     * | required | `false`  |
     * | onlyInt  | `false`  |
     */
    vpCount: number
    /**
     * |          |          |
     * | -------- | -------- |
     * | type     | `number` |
     * | hidden   | `false`  |
     * | required | `true`   |
     * | onlyInt  | `false`  |
     */
    durationInSeconds: number
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `0`     |
     * | required | `true`  |
     */
    players: any
    /**
     * |          |           |
     * | -------- | --------- |
     * | type     | `json`    |
     * | hidden   | `false`   |
     * | maxSize  | `5242880` |
     * | required | `false`   |
     */
    messages: any
    /**
     * |           |                |
     * | --------- | -------------- |
     * | type      | `file(single)` |
     * | hidden    | `false`        |
     * | required  | `true`         |
     * | protected | `false`        |
     * | maxSize   | `52428800`     |
     */
    file: string
    /**
     * |                |                    |
     * | -------------- | ------------------ |
     * | type           | `relation(single)` |
     * | hidden         | `false`            |
     * | required       | `false`            |
     * | collectionId   | `_pb_users_auth_`  |
     * | collectionName | `users`            |
     * | cascadeDelete  | `false`            |
     */
    createdBy: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    createdAt: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updatedAt: string
}

export interface LobbyAggregation {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_1750043174'
    /**
     * |               |                     |
     * | ------------- | ------------------- |
     * | type          | `text`              |
     * | min           | `1`                 |
     * | min           | `255`               |
     * | current value | `lobby_aggregation` |
     */
    collectionName: 'lobby_aggregation' | (string & {})
    /**
     * |          |               |
     * | -------- | ------------- |
     * | type     | `text`        |
     * | hidden   | `false`       |
     * | required | `true`        |
     * | max      | `5000`        |
     * | pattern  | `^[a-z0-9]+$` |
     */
    id: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `1`     |
     * | required | `false` |
     */
    USER: any
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `1`     |
     * | required | `false` |
     */
    players: any
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `1`     |
     * | required | `false` |
     */
    maps: any
}

export interface ReplayAggregation {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_3632852221'
    /**
     * |               |                      |
     * | ------------- | -------------------- |
     * | type          | `text`               |
     * | min           | `1`                  |
     * | min           | `255`                |
     * | current value | `replay_aggregation` |
     */
    collectionName: 'replay_aggregation' | (string & {})
    /**
     * |          |               |
     * | -------- | ------------- |
     * | type     | `text`        |
     * | hidden   | `false`       |
     * | required | `true`        |
     * | max      | `5000`        |
     * | pattern  | `^[a-z0-9]+$` |
     */
    id: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `1`     |
     * | required | `false` |
     */
    user: any
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `1`     |
     * | required | `false` |
     */
    players: any
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `1`     |
     * | required | `false` |
     */
    maps: any
}

export interface LobbyAggregationCommunity {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_3080897202'
    /**
     * |               |                               |
     * | ------------- | ----------------------------- |
     * | type          | `text`                        |
     * | min           | `1`                           |
     * | min           | `255`                         |
     * | current value | `lobby_aggregation_community` |
     */
    collectionName: 'lobby_aggregation_community' | (string & {})
    /**
     * |          |               |
     * | -------- | ------------- |
     * | type     | `text`        |
     * | hidden   | `false`       |
     * | required | `true`        |
     * | max      | `5000`        |
     * | pattern  | `^[a-z0-9]+$` |
     */
    id: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `1`     |
     * | required | `false` |
     */
    players: any
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `1`     |
     * | required | `false` |
     */
    maps: any
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `1`     |
     * | required | `false` |
     */
    users: any
}

export interface Chat {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_1116771610'
    /**
     * |               |        |
     * | ------------- | ------ |
     * | type          | `text` |
     * | min           | `1`    |
     * | min           | `255`  |
     * | current value | `chat` |
     */
    collectionName: 'chat' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |                |                    |
     * | -------------- | ------------------ |
     * | type           | `relation(single)` |
     * | hidden         | `false`            |
     * | required       | `true`             |
     * | collectionId   | `_pb_users_auth_`  |
     * | collectionName | `users`            |
     * | cascadeDelete  | `false`            |
     */
    user: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `false` |
     * | max      | `500`   |
     */
    message: string
    /**
     * |                |                       |
     * | -------------- | --------------------- |
     * | type           | `relation (multiple)` |
     * | hidden         | `false`               |
     * | required       | `false`               |
     * | collectionId   | `pbc_3073759650`      |
     * | collectionName | `attachments`         |
     * | cascadeDelete  | `false`               |
     * | maxSelect      | `999`                 |
     */
    attachments: string[]
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    created: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updated: string
}

export interface Attachments {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_3073759650'
    /**
     * |               |               |
     * | ------------- | ------------- |
     * | type          | `text`        |
     * | min           | `1`           |
     * | min           | `255`         |
     * | current value | `attachments` |
     */
    collectionName: 'attachments' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `true`  |
     * | max      | `5000`  |
     */
    type: string
    /**
     * |           |                  |
     * | --------- | ---------------- |
     * | type      | `file(single)`   |
     * | hidden    | `false`          |
     * | required  | `true`           |
     * | protected | `false`          |
     * | maxSize   | `0`              |
     * | thumbs    | `300x0`, `500x0` |
     */
    file: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    created: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updated: string
}

export interface ChatRooms {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_2204944285'
    /**
     * |               |              |
     * | ------------- | ------------ |
     * | type          | `text`       |
     * | min           | `1`          |
     * | min           | `255`        |
     * | current value | `chat_rooms` |
     */
    collectionName: 'chat_rooms' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |                |                       |
     * | -------------- | --------------------- |
     * | type           | `relation (multiple)` |
     * | hidden         | `false`               |
     * | required       | `false`               |
     * | collectionId   | `_pb_users_auth_`     |
     * | collectionName | `users`               |
     * | cascadeDelete  | `true`                |
     * | maxSelect      | `9999`                |
     */
    members: string[]
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    created: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updated: string
}

export interface ChatMessages {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_102036695'
    /**
     * |               |                 |
     * | ------------- | --------------- |
     * | type          | `text`          |
     * | min           | `1`             |
     * | min           | `255`           |
     * | current value | `chat_messages` |
     */
    collectionName: 'chat_messages' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |                |                    |
     * | -------------- | ------------------ |
     * | type           | `relation(single)` |
     * | hidden         | `false`            |
     * | required       | `true`             |
     * | collectionId   | `_pb_users_auth_`  |
     * | collectionName | `users`            |
     * | cascadeDelete  | `false`            |
     */
    sender: string
    /**
     * |          |               |
     * | -------- | ------------- |
     * | type     | `text`        |
     * | hidden   | `false`       |
     * | required | `true`        |
     * | max      | `5000`        |
     * | pattern  | `^[a-z0-9]+$` |
     */
    chatRoom: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `false` |
     * | max      | `5000`  |
     */
    text: string
    /**
     * |                |                       |
     * | -------------- | --------------------- |
     * | type           | `relation (multiple)` |
     * | hidden         | `false`               |
     * | required       | `false`               |
     * | collectionId   | `pbc_3073759650`      |
     * | collectionName | `attachments`         |
     * | cascadeDelete  | `false`               |
     * | maxSelect      | `999`                 |
     */
    attachments: string[]
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    created: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updated: string
}

export interface Comments {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_533777971'
    /**
     * |               |            |
     * | ------------- | ---------- |
     * | type          | `text`     |
     * | min           | `1`        |
     * | min           | `255`      |
     * | current value | `comments` |
     */
    collectionName: 'comments' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `true`  |
     * | max      | `5000`  |
     */
    text: string
    /**
     * |                |                    |
     * | -------------- | ------------------ |
     * | type           | `relation(single)` |
     * | hidden         | `false`            |
     * | required       | `true`             |
     * | collectionId   | `_pb_users_auth_`  |
     * | collectionName | `users`            |
     * | cascadeDelete  | `false`            |
     */
    sender: string
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    isDeleted: boolean
    /**
     * |                |                       |
     * | -------------- | --------------------- |
     * | type           | `relation (multiple)` |
     * | hidden         | `false`               |
     * | required       | `false`               |
     * | collectionId   | `_pb_users_auth_`     |
     * | collectionName | `users`               |
     * | cascadeDelete  | `false`               |
     * | maxSelect      | `999`                 |
     */
    likes: string[]
    /**
     * |                |                       |
     * | -------------- | --------------------- |
     * | type           | `relation (multiple)` |
     * | hidden         | `false`               |
     * | required       | `false`               |
     * | collectionId   | `_pb_users_auth_`     |
     * | collectionName | `users`               |
     * | cascadeDelete  | `false`               |
     * | maxSelect      | `999`                 |
     */
    dislikes: string[]
    /**
     * |                |                       |
     * | -------------- | --------------------- |
     * | type           | `relation (multiple)` |
     * | hidden         | `false`               |
     * | required       | `false`               |
     * | collectionId   | `_pb_users_auth_`     |
     * | collectionName | `users`               |
     * | cascadeDelete  | `false`               |
     * | maxSelect      | `999`                 |
     */
    mentions: string[]
    /**
     * |                |                    |
     * | -------------- | ------------------ |
     * | type           | `relation(single)` |
     * | hidden         | `false`            |
     * | required       | `false`            |
     * | collectionId   | `pbc_533777971`    |
     * | collectionName | `comments`         |
     * | cascadeDelete  | `false`            |
     */
    parent: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    created: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updated: string
}

export interface LobbyComments {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_673294823'
    /**
     * |               |                  |
     * | ------------- | ---------------- |
     * | type          | `text`           |
     * | min           | `1`              |
     * | min           | `255`            |
     * | current value | `lobby_comments` |
     */
    collectionName: 'lobby_comments' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |                |                    |
     * | -------------- | ------------------ |
     * | type           | `relation(single)` |
     * | hidden         | `false`            |
     * | required       | `true`             |
     * | collectionId   | `pbc_1574334436`   |
     * | collectionName | `lobbies`          |
     * | cascadeDelete  | `true`             |
     */
    lobby: string
    /**
     * |                |                    |
     * | -------------- | ------------------ |
     * | type           | `relation(single)` |
     * | hidden         | `false`            |
     * | required       | `true`             |
     * | collectionId   | `pbc_533777971`    |
     * | collectionName | `comments`         |
     * | cascadeDelete  | `true`             |
     */
    comment: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    created: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updated: string
}

export interface LobbiesLive {
    /**
     * |      |        |
     * | ---- | ------ |
     * | type | `text` |
     * | min  | `1`    |
     * | min  | `100`  |
     */
    collectionId: 'pbc_908767333'
    /**
     * |               |                |
     * | ------------- | -------------- |
     * | type          | `text`         |
     * | min           | `1`            |
     * | min           | `255`          |
     * | current value | `lobbies_live` |
     */
    collectionName: 'lobbies_live' | (string & {})
    /**
     * |                     |                |
     * | ------------------- | -------------- |
     * | type                | `text`         |
     * | hidden              | `false`        |
     * | required            | `true`         |
     * | min                 | `15`           |
     * | max                 | `15`           |
     * | pattern             | `^[a-z0-9]+$`  |
     * | autogeneratePattern | `[a-z0-9]{15}` |
     */
    id: string
    /**
     * |                |                    |
     * | -------------- | ------------------ |
     * | type           | `relation(single)` |
     * | hidden         | `false`            |
     * | required       | `true`             |
     * | collectionId   | `_pb_users_auth_`  |
     * | collectionName | `users`            |
     * | cascadeDelete  | `false`            |
     */
    user: string
    /**
     * |        |         |
     * | ------ | ------- |
     * | type   | `bool`  |
     * | hidden | `false` |
     */
    isRanked: boolean
    /**
     * |          |          |
     * | -------- | -------- |
     * | type     | `number` |
     * | hidden   | `false`  |
     * | required | `true`   |
     * | onlyInt  | `false`  |
     */
    sessionId: number
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `text`  |
     * | hidden   | `false` |
     * | required | `true`  |
     * | max      | `5000`  |
     */
    map: string
    /**
     * |          |         |
     * | -------- | ------- |
     * | type     | `json`  |
     * | hidden   | `false` |
     * | maxSize  | `0`     |
     * | required | `true`  |
     */
    players: any
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `false`    |
     */
    createdAt: string
    /**
     * |          |            |
     * | -------- | ---------- |
     * | type     | `autodate` |
     * | hidden   | `false`    |
     * | onCreate | `true`     |
     * | onUpdate | `true`     |
     */
    updatedAt: string
}


/**
 * Commented-out back-relations are what will be inferred by pocketbase-ts from the forward relations.
 *
 * The "UNIQUE index constraint" case is automatically handled by this hook,
 * but if you want to make a back-relation non-nullable, you can uncomment it and remove the "?".
 *
 * See [here](https://github.com/satohshi/pocketbase-ts#back-relations) for more information.
 */
export type Schema = {
    users: {
        type: Users
        relations: {
            // lobbies_via_user?: Lobbies[]
            // replays_via_createdBy?: Replays[]
            // chat_via_user?: Chat[]
            // chat_rooms_via_members?: ChatRooms[]
            // chat_messages_via_sender?: ChatMessages[]
            // comments_via_sender?: Comments[]
            // comments_via_likes?: Comments[]
            // comments_via_dislikes?: Comments[]
            // comments_via_mentions?: Comments[]
            lobbies_live_via_user?: LobbiesLive
        }
    }
    lobbies: {
        type: Lobbies
        relations: {
            user: Users
            // lobby_comments_via_lobby?: LobbyComments[]
        }
    }
    replays: {
        type: Replays
        relations: {
            createdBy?: Users
        }
    }
    lobby_aggregation: {
        type: LobbyAggregation
    }
    replay_aggregation: {
        type: ReplayAggregation
    }
    lobby_aggregation_community: {
        type: LobbyAggregationCommunity
    }
    chat: {
        type: Chat
        relations: {
            user: Users
            attachments?: Attachments[]
        }
    }
    attachments: {
        type: Attachments
        relations: {
            // chat_via_attachments?: Chat[]
            // chat_messages_via_attachments?: ChatMessages[]
        }
    }
    chat_rooms: {
        type: ChatRooms
        relations: {
            members?: Users[]
        }
    }
    chat_messages: {
        type: ChatMessages
        relations: {
            sender: Users
            attachments?: Attachments[]
        }
    }
    comments: {
        type: Comments
        relations: {
            sender: Users
            likes?: Users[]
            dislikes?: Users[]
            mentions?: Users[]
            parent?: Comments
            // comments_via_parent?: Comments[]
            // lobby_comments_via_comment?: LobbyComments[]
        }
    }
    lobby_comments: {
        type: LobbyComments
        relations: {
            lobby: Lobbies
            comment: Comments
        }
    }
    lobbies_live: {
        type: LobbiesLive
        relations: {
            user: Users
        }
    }
}

