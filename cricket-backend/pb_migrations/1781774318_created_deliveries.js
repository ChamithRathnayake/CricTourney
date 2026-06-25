/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3778711009",
        "help": "",
        "hidden": false,
        "id": "relation208467024",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "inning",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3072146508",
        "help": "",
        "hidden": false,
        "id": "relation4150327818",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "striker",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3072146508",
        "help": "",
        "hidden": false,
        "id": "relation1091073180",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "bawler",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number1504858978",
        "max": null,
        "min": null,
        "name": "over_number",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number2462454198",
        "max": null,
        "min": null,
        "name": "ball_number",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number2151316255",
        "max": null,
        "min": null,
        "name": "runs",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool29617685",
        "name": "is_extra",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select413373495",
        "maxSelect": 0,
        "name": "extra_type",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "None",
          "Wide",
          "No Ball",
          "Bye",
          "Leg Bye"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool1098732242",
        "name": "is_wicket",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select2249539582",
        "maxSelect": 0,
        "name": "dismissal_type",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "None",
          "Bawled",
          "Catch",
          "Run Out",
          "Stumped",
          "Hit Wicket"
        ]
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3072146508",
        "help": "",
        "hidden": false,
        "id": "relation2903403747",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "out_player",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3072146508",
        "help": "",
        "hidden": false,
        "id": "relation2475467963",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "fielder",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_2444735992",
    "indexes": [],
    "listRule": null,
    "name": "deliveries",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2444735992");

  return app.delete(collection);
})
