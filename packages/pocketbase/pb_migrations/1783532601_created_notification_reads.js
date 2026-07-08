/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    createRule: 'user = @request.auth.id',
    deleteRule: 'user = @request.auth.id',
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
        cascadeDelete: false,
        collectionId: '_pb_users_auth_',
        hidden: false,
        id: 'relation_read_user',
        maxSelect: 1,
        minSelect: 0,
        name: 'user',
        presentable: false,
        required: true,
        system: false,
        type: 'relation'
      },
      {
        cascadeDelete: true,
        collectionId: 'pbc_1847263910',
        hidden: false,
        id: 'relation_read_notif',
        maxSelect: 1,
        minSelect: 0,
        name: 'notification',
        presentable: false,
        required: true,
        system: false,
        type: 'relation'
      },
      {
        hidden: false,
        id: 'autodate_read_at',
        name: 'readAt',
        onCreate: true,
        onUpdate: false,
        presentable: false,
        system: false,
        type: 'autodate'
      }
    ],
    id: 'pbc_2958374621',
    indexes: [
      'CREATE UNIQUE INDEX `idx_notif_reads_user_notif` ON `notification_reads` (`user`, `notification`)'
    ],
    listRule: 'user = @request.auth.id',
    name: 'notification_reads',
    system: false,
    type: 'base',
    updateRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id'
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_2958374621');

  return app.delete(collection);
});
