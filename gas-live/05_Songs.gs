/***********************************************
 *  Note Chord SoulCiety — SONGS
 ***********************************************/

function handleGetPdf_(token, fileId) {
  var sess = verifyUser_(token);
  if (!sess) return jsonErr_("กรุณาเข้าสู่ระบบ", 401);
  if (!fileId) return jsonErr_("Missing fileId");
  try {
    var file = DriveApp.getFileById(fileId);
    var mime = file.getMimeType();
    var blob = file.getBlob();
    var base64 = Utilities.base64Encode(blob.getBytes());
    return jsonOk_({ content: base64, mimeType: mime });
  } catch(e) {
    return jsonErr_("ไม่สามารถโหลดไฟล์ได้: " + e.message);
  }
}

function handleListSongs_() {
  var sheet;
  try { sheet = getSS_().getSheetByName(SH_SONGS); } catch(e) { return jsonErr_("initApp not run"); }
  if (!sheet) return jsonErr_("No songs sheet");
  var lr = sheet.getLastRow();
  if (lr < 2) return jsonOk_({songs:[], total:0});
  var d = sheet.getRange(2, 1, lr-1, 2).getValues();
  var songs = [];
  for (var i = 0; i < d.length; i++) {
    if (d[i][0] && d[i][1]) songs.push({name: d[i][0].toString().trim(), url: d[i][1].toString().trim()});
  }
  return jsonOk_({songs: songs, total: songs.length});
}
