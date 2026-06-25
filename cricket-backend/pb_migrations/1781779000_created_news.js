/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_news_12345",
    "name": "news",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "indexes": [],
    "fields": [
      {
        "id": "text3208210256",
        "name": "id",
        "type": "text",
        "system": true,
        "required": true,
        "presentable": false,
        "primaryKey": true,
        "autogeneratePattern": "[a-z0-9]{15}",
        "pattern": "^[a-z0-9]+$"
      },
      {
        "id": "text_headline",
        "name": "headline",
        "type": "text",
        "system": false,
        "required": true,
        "presentable": true
      },
      {
        "id": "text_description",
        "name": "description",
        "type": "text",
        "system": false,
        "required": false,
        "presentable": false
      },
      {
        "id": "file_photos",
        "name": "photos",
        "type": "file",
        "system": false,
        "required": false,
        "presentable": false,
        "maxSelect": 10,
        "maxSize": 5242880,
        "mimeTypes": [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp"
        ],
        "protected": false,
        "thumbs": []
      },
      {
        "id": "autodate2990389176",
        "name": "created",
        "type": "autodate",
        "system": false,
        "onCreate": true,
        "onUpdate": false,
        "presentable": false
      },
      {
        "id": "autodate3332085495",
        "name": "updated",
        "type": "autodate",
        "system": false,
        "onCreate": true,
        "onUpdate": true,
        "presentable": false
      }
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_news_12345");

  return app.delete(collection);
})
