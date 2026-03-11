/***********************************************
 *  Note Chord SoulCiety — INIT & SYNC
 ***********************************************/

function initApp() {
  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty("SPREADSHEET_ID");

  if (existingId) {
    try {
      SpreadsheetApp.openById(existingId);
      Logger.log("Spreadsheet exists: " + existingId);
    } catch (e) {
      existingId = null;
    }
  }

  if (!existingId) {
    var ss = SpreadsheetApp.create(APP_NAME + " DB");
    var file = DriveApp.getFileById(ss.getId());
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    existingId = ss.getId();
    props.setProperty("SPREADSHEET_ID", existingId);
    Logger.log("Created new Spreadsheet: " + existingId);
  }

  getOrCreateSheet_(SH_SONGS, ["name", "url"]);
  getOrCreateSheet_(SH_USERS, ["uid","email","name","password_hash","salt","status","package","created_at"]);
  getOrCreateSheet_(SH_SESSIONS, ["token","uid","email","name","role","package","created_at","expires_at"]);
  getOrCreateSheet_(SH_FAVORITES, ["uid","song_name","song_url","added_at"]);
  getOrCreateSheet_(SH_SETLISTS, ["uid","setlist_id","name","songs_json","created_at","updated_at"]);
  getOrCreateSheet_(SH_RECENT, ["uid","song_name","song_url","opened_at"]);

  var ss2 = getSS_();
  var def = ss2.getSheetByName("Sheet1") || ss2.getSheetByName("ชีต1");
  if (def && ss2.getSheets().length > 1) {
    ss2.deleteSheet(def);
  }

  syncFiles_();
  installSyncTrigger_();

  Logger.log("=== initApp DONE ===");
  Logger.log("Spreadsheet: https://docs.google.com/spreadsheets/d/" + existingId);
  Logger.log("Next: Deploy > New deployment > Web app > Anyone");
}

function syncFiles_() {
  var sheet = getOrCreateSheet_(SH_SONGS, ["name", "url"]);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 2).clearContent();

  var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var files = folder.getFiles();
  var ok = [MimeType.PDF, MimeType.JPEG, MimeType.PNG, MimeType.BMP];
  var data = [];

  while (files.hasNext()) {
    var f = files.next();
    if (ok.indexOf(f.getMimeType()) === -1) continue;
    data.push([
      f.getName().replace(/\.(pdf|jpg|jpeg|png|bmp)$/i, ""),
      "https://drive.google.com/file/d/" + f.getId() + "/preview"
    ]);
  }

  data.sort(function(a, b) { return a[0].localeCompare(b[0], "th"); });
  if (data.length > 0) sheet.getRange(2, 1, data.length, 2).setValues(data);
  PropertiesService.getScriptProperties().setProperty("lastSync", new Date().toISOString());
  Logger.log("Synced " + data.length + " files");
}

function syncIncremental_() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty("lastSync") || !props.getProperty("SPREADSHEET_ID")) { syncFiles_(); return; }

  var sheet;
  try { sheet = getSS_().getSheetByName(SH_SONGS); } catch(e) { return; }
  if (!sheet) { syncFiles_(); return; }

  var lastRow = sheet.getLastRow();
  var existing = {};
  if (lastRow > 1) {
    var v = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < v.length; i++) if (v[i][0]) existing[v[i][0]] = true;
  }

  var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var files = folder.getFiles();
  var ok = [MimeType.PDF, MimeType.JPEG, MimeType.PNG, MimeType.BMP];
  var newF = [], all = {};

  while (files.hasNext()) {
    var f = files.next();
    if (ok.indexOf(f.getMimeType()) === -1) continue;
    var url = "https://drive.google.com/file/d/" + f.getId() + "/preview";
    all[url] = true;
    if (!existing[url]) newF.push([f.getName().replace(/\.(pdf|jpg|jpeg|png|bmp)$/i, ""), url]);
  }

  for (var u in existing) { if (!all[u]) { syncFiles_(); return; } }

  if (newF.length > 0) {
    var d = [];
    if (lastRow > 1) d = sheet.getRange(2, 1, lastRow - 1, 2).getValues().filter(function(r){ return r[0]!==""; });
    d = d.concat(newF);
    d.sort(function(a,b){ return a[0].localeCompare(b[0],"th"); });
    var c = Math.max(lastRow - 1, d.length);
    sheet.getRange(2, 1, c, 2).clearContent();
    if (d.length > 0) sheet.getRange(2, 1, d.length, 2).setValues(d);
  }

  props.setProperty("lastSync", new Date().toISOString());
}

function installSyncTrigger_() {
  var t = ScriptApp.getProjectTriggers();
  for (var i = 0; i < t.length; i++) {
    if (t[i].getHandlerFunction() === "syncIncremental_") ScriptApp.deleteTrigger(t[i]);
  }
  ScriptApp.newTrigger("syncIncremental_").timeBased().everyMinutes(5).create();
  Logger.log("Trigger installed: sync every 5 min");
}
