/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    createRule: '@request.auth.role = "admin" || @request.auth.role = "moderator"',
    deleteRule:
      '@request.auth.role = "admin" || @request.auth.role = "moderator" || createdBy = @request.auth.id',
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
        id: 'text_title_notif',
        max: 200,
        min: 1,
        name: 'title',
        pattern: '',
        presentable: true,
        primaryKey: false,
        required: true,
        system: false,
        type: 'text'
      },
      {
        autogeneratePattern: '',
        hidden: false,
        id: 'text_body_notif',
        max: 10000,
        min: 1,
        name: 'body',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: true,
        system: false,
        type: 'text'
      },
      {
        hidden: false,
        id: 'bool_target_all',
        name: 'targetAll',
        presentable: false,
        required: false,
        system: false,
        type: 'bool'
      },
      {
        cascadeDelete: false,
        collectionId: '_pb_users_auth_',
        hidden: false,
        id: 'relation_recipients',
        maxSelect: 999,
        minSelect: 0,
        name: 'recipients',
        presentable: false,
        required: false,
        system: false,
        type: 'relation'
      },
      {
        cascadeDelete: false,
        collectionId: '_pb_users_auth_',
        hidden: false,
        id: 'relation_created_by',
        maxSelect: 1,
        minSelect: 0,
        name: 'createdBy',
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
    id: 'pbc_1847263910',
    indexes: [],
    listRule:
      '@request.auth.id != "" && (targetAll = true || recipients.id ?= @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "moderator")',
    name: 'notifications',
    system: false,
    type: 'base',
    updateRule:
      '@request.auth.role = "admin" || @request.auth.role = "moderator" || createdBy = @request.auth.id',
    viewRule:
      '@request.auth.id != "" && (targetAll = true || recipients.id ?= @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "moderator")'
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_1847263910');

  return app.delete(collection);
});
