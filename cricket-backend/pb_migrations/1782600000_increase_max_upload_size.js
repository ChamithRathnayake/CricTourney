/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Update news collection photos max size to 30MB
  const newsCol = app.findCollectionByNameOrId("news");
  const photosField = newsCol.fields.getByName("photos");
  if (photosField) {
    photosField.maxSize = 31457280; // 30 MB
  }
  app.save(newsCol);

  // 2. Update players collection photo max size to 30MB
  const playersCol = app.findCollectionByNameOrId("players");
  const photoField = playersCol.fields.getByName("photo");
  if (photoField) {
    photoField.maxSize = 31457280; // 30 MB
  }
  app.save(playersCol);

  // 3. Update teams collection logo max size to 30MB
  const teamsCol = app.findCollectionByNameOrId("teams");
  const logoField = teamsCol.fields.getByName("logo");
  if (logoField) {
    logoField.maxSize = 31457280; // 30 MB
  }
  app.save(teamsCol);
}, (app) => {
  // Rollback changes (revert to 5MB)
  const newsCol = app.findCollectionByNameOrId("news");
  const photosField = newsCol.fields.getByName("photos");
  if (photosField) {
    photosField.maxSize = 5242880;
  }
  app.save(newsCol);

  const playersCol = app.findCollectionByNameOrId("players");
  const photoField = playersCol.fields.getByName("photo");
  if (photoField) {
    photoField.maxSize = 5242880;
  }
  app.save(playersCol);

  const teamsCol = app.findCollectionByNameOrId("teams");
  const logoField = teamsCol.fields.getByName("logo");
  if (logoField) {
    logoField.maxSize = 5242880;
  }
  app.save(teamsCol);
});
