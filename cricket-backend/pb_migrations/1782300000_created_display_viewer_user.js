/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  const record = new Record(collection);
  
  record.setEmail("display@crictourney.online");
  record.setPassword("display123");
  record.set("name", "LED Scoreboard Display");
  record.set("emailVisibility", true);
  record.setVerified(true);
  
  return app.save(record);
}, (app) => {
  try {
    const record = app.findAuthRecordByEmail("users", "display@crictourney.online");
    return app.delete(record);
  } catch (_) {
    return null;
  }
});
