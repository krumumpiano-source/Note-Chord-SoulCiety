/***********************************************
 *  Note Chord SoulCiety — UTILITIES
 ***********************************************/

function getSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
}

function getSS_() {
  var id = getSpreadsheetId_();
  if (!id) throw new Error("Please run initApp() first");
  return SpreadsheetApp.openById(id);
}

function getOrCreateSheet_(name, headers) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
  }
  return sheet;
}

function uuid_() { return Utilities.getUuid(); }
function now_()  { return new Date().toISOString(); }

function hashPassword_(pw, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pw, Utilities.Charset.UTF_8);
  var h = "";
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i] < 0 ? raw[i] + 256 : raw[i];
    h += (b < 16 ? "0" : "") + b.toString(16);
  }
  return h;
}

function jsonOk_(data) {
  return ContentService.createTextOutput(JSON.stringify({success:true, data:data}))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr_(msg, code) {
  return ContentService.createTextOutput(JSON.stringify({success:false, error:msg, code:code||400}))
    .setMimeType(ContentService.MimeType.JSON);
}

function getRows_(sheetName) {
  var sheet;
  try { sheet = getSS_().getSheetByName(sheetName); } catch(e) { return []; }
  if (!sheet) return [];
  var lr = sheet.getLastRow();
  if (lr < 2) return [];
  var cols = sheet.getLastColumn();
  var hdr = sheet.getRange(1, 1, 1, cols).getValues()[0];
  var dat = sheet.getRange(2, 1, lr - 1, cols).getValues();
  var rows = [];
  for (var i = 0; i < dat.length; i++) {
    var o = {};
    for (var j = 0; j < hdr.length; j++) o[hdr[j]] = dat[i][j];
    o._row = i + 2;
    rows.push(o);
  }
  return rows;
}
