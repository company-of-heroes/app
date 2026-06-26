/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  app.delete(app.findCollectionByNameOrId("pbc_673294823"));
  app.delete(app.findCollectionByNameOrId("pbc_533777971"));

  return true;
}, (app) => {
  const comments = new Collection({
    createRule: '@request.auth.id != ""',
    deleteRule: null,
    fields: [
      {
        autogeneratePattern: '[a-z0-9]{15}',
        hidden: false,
        id: 'text3208210256',
        max: 15,
        min: 15,
        name: 'id',
        pattern: '^[a-z0-9]+$',
        presentable: false,
        primaryKey: true,
        required: true,
        system: true,
        type: 'text'
      },
      {
        autogeneratePattern: '',
        hidden: false,
        id: 'text999008199',
        max: 0,
        min: 0,
        name: 'text',
        pattern: '',
        presentable: true,
        primaryKey: false,
        required: true,
        system: false,
        type: 'text'
      },
      {
        cascadeDelete: false,
        collectionId: '_pb_users_auth_',
        hidden: false,
        id: 'relation1593854671',
        maxSelect: 1,
        minSelect: 0,
        name: 'sender',
        presentable: false,
        required: true,
        system: false,
        type: 'relation'
      },
      {
        hidden: false,
        id: 'bool2382110195',
        name: 'isDeleted',
        presentable: false,
        required: false,
        system: false,
        type: 'bool'
      },
      {
        cascadeDelete: false,
        collectionId: '_pb_users_auth_',
        hidden: false,
        id: 'relation1237995133',
        maxSelect: 999,
        minSelect: 0,
        name: 'likes',
        presentable: false,
        required: false,
        system: false,
        type: 'relation'
      },
      {
        cascadeDelete: false,
        collectionId: '_pb_users_auth_',
        hidden: false,
        id: 'relation770948625',
        maxSelect: 999,
        minSelect: 0,
        name: 'dislikes',
        presentable: false,
        required: false,
        system: false,
        type: 'relation'
      },
      {
        cascadeDelete: false,
        collectionId: '_pb_users_auth_',
        hidden: false,
        id: 'relation4265177951',
        maxSelect: 999,
        minSelect: 0,
        name: 'mentions',
        presentable: false,
        required: false,
        system: false,
        type: 'relation'
      },
      {
        cascadeDelete: false,
        collectionId: 'pbc_533777971',
        hidden: false,
        id: 'relation1032740943',
        maxSelect: 1,
        minSelect: 0,
        name: 'parent',
        presentable: false,
        required: false,
        system: false,
        type: 'relation'
      },
      {
        hidden: false,
        id: 'autodate2990389176',
        name: 'created',
        onCreate: true,
        onUpdate: false,
        presentable: false,
        system: false,
        type: 'autodate'
      },
      {
        hidden: false,
        id: 'autodate3332085495',
        name: 'updated',
        onCreate: true,
        onUpdate: true,
        presentable: false,
        system: false,
        type: 'autodate'
      }
    ],
    id: 'pbc_533777971',
    indexes: [],
    listRule: '',
    name: 'comments',
    system: false,
    type: 'base',
    updateRule:
      '@request.auth.id = sender || @request.body.likes:changed = true || @request.body.dislikes:changed = true',
    viewRule: ''
  });

  app.save(comments);

  const lobbyComments = new Collection({
    createRule: '@request.auth.id != ""',
    deleteRule: null,
    fields: [
      {
        autogeneratePattern: '[a-z0-9]{15}',
        hidden: false,
        id: 'text3208210256',
        max: 15,
        min: 15,
        name: 'id',
        pattern: '^[a-z0-9]+$',
        presentable: false,
        primaryKey: true,
        required: true,
        system: true,
        type: 'text'
      },
      {
        cascadeDelete: true,
        collectionId: 'pbc_1574334436',
        hidden: false,
        id: 'relation3437516279',
        maxSelect: 1,
        minSelect: 0,
        name: 'lobby',
        presentable: false,
        required: true,
        system: false,
        type: 'relation'
      },
      {
        cascadeDelete: true,
        collectionId: 'pbc_533777971',
        hidden: false,
        id: 'relation2490651244',
        maxSelect: 1,
        minSelect: 0,
        name: 'comment',
        presentable: false,
        required: true,
        system: false,
        type: 'relation'
      },
      {
        hidden: false,
        id: 'autodate2990389176',
        name: 'created',
        onCreate: true,
        onUpdate: false,
        presentable: false,
        system: false,
        type: 'autodate'
      },
      {
        hidden: false,
        id: 'autodate3332085495',
        name: 'updated',
        onCreate: true,
        onUpdate: true,
        presentable: false,
        system: false,
        type: 'autodate'
      }
    ],
    id: 'pbc_673294823',
    indexes: [],
    listRule: '',
    name: 'lobby_comments',
    system: false,
    type: 'base',
    updateRule: null,
    viewRule: ''
  });

  return app.save(lobbyComments);
});
