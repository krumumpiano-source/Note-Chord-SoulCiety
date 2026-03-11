/***********************************************
 *  Note Chord SoulCiety — Complete Backend
 *  Self-contained: สร้าง Sheet เอง + Sync + Web API + Auth
 *
 *  วิธีใช้:
 *  1. สร้างโปรเจ็กต์ใหม่ใน script.google.com
 *  2. วางโค้ดนี้ทั้งหมด → บันทึก
 *  3. รัน initApp() → อนุญาตสิทธิ์ทั้งหมด
 *  4. Deploy > New deployment > Web app
 *     - ดำเนินการในฐานะ: ฉัน (Me)
 *     - ผู้ที่สามารถเข้าถึง: ทุกคน (Anyone)
 *  5. Copy URL ไปใส่ใน js/config.js
 ***********************************************/

/* ============ CONFIG ============ */
var DRIVE_FOLDER_ID = "1v0xKLZPX_Lw13pj5YddAlXuwADd8af_K";
var ADMIN_EMAIL     = "krumum.piano@gmail.com";
var SESSION_HOURS   = 24;
var APP_NAME        = "Note Chord SoulCiety";

/* Sheet Names */
var SH_SONGS     = "songs";
var SH_USERS     = "users";
var SH_SESSIONS  = "sessions";
var SH_FAVORITES = "favorites";
var SH_SETLISTS  = "setlists";
var SH_RECENT    = "recent";

/* ============ SPREADSHEET MANAGEMENT ============ */

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

/* ============ initApp — รันครั้งเดียว ============ */

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

/* ============ FILE SYNC ============ */

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

/* ============ UTILITY ============ */

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

/* ============ WEB APP ROUTER ============ */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  var p = e ? e.parameter : {};
  switch (action) {
    case "ping":             return jsonOk_({message: APP_NAME + " API ready", time: now_()});
    case "list-songs":       return handleListSongs_();
    case "verify-session":   return handleVerifySession_(p.token);
    case "admin-list-users": return handleAdminListUsers_(p.token);
    case "get-favorites":    return handleGetFavorites_(p.token);
    case "get-setlists":     return handleGetSetlists_(p.token);
    case "get-recent":       return handleGetRecent_(p.token);
    default:                 return jsonErr_("Unknown action: " + action, 404);
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch(err) { return jsonErr_("Invalid JSON", 400); }
  var action = body.action || "";
  switch (action) {
    case "register":          return handleRegister_(body);
    case "login":             return handleLogin_(body);
    case "logout":            return handleLogout_(body);
    case "admin-approve":     return handleAdminApprove_(body);
    case "admin-reject":      return handleAdminReject_(body);
    case "admin-set-package": return handleAdminSetPackage_(body);
    case "toggle-favorite":   return handleToggleFavorite_(body);
    case "save-setlist":      return handleSaveSetlist_(body);
    case "delete-setlist":    return handleDeleteSetlist_(body);
    case "add-recent":        return handleAddRecent_(body);
    default:                  return jsonErr_("Unknown action: " + action, 404);
  }
}

/* ============ AUTH ============ */

function handleRegister_(body) {
  var email = (body.email || "").trim().toLowerCase();
  var name  = (body.name || "").trim();
  var pw    = body.password || "";
  if (!email || !name || !pw) return jsonErr_("กรุณากรอกข้อมูลให้ครบ");
  if (pw.length < 6) return jsonErr_("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");

  var users = getRows_(SH_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) return jsonErr_("อีเมลนี้ถูกใช้แล้ว");
  }

  var salt = uuid_(), hash = hashPassword_(pw, salt), uid = uuid_();
  var isAdmin = (email === ADMIN_EMAIL);

  var sheet = getOrCreateSheet_(SH_USERS, ["uid","email","name","password_hash","salt","status","package","created_at"]);
  sheet.appendRow([uid, email, name, hash, salt, isAdmin?"approved":"pending", isAdmin?"gold":"free", now_()]);

  return jsonOk_({ message: isAdmin ? "สมัครสำเร็จ! (Admin) เข้าสู่ระบบได้เลย" : "สมัครสำเร็จ! กรุณารอแอดมินอนุมัติ" });
}

function handleLogin_(body) {
  var email = (body.email || "").trim().toLowerCase();
  var pw = body.password || "";
  if (!email || !pw) return jsonErr_("กรุณากรอกอีเมลและรหัสผ่าน");

  var users = getRows_(SH_USERS), user = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) { user = users[i]; break; }
  }
  if (!user) return jsonErr_("ไม่พบบัญชีผู้ใช้นี้");
  if (hashPassword_(pw, user.salt) !== user.password_hash) return jsonErr_("รหัสผ่านไม่ถูกต้อง");
  if (user.status === "pending") return jsonErr_("บัญชีของคุณยังรอการอนุมัติจากแอดมิน");
  if (user.status === "rejected") return jsonErr_("บัญชีของคุณถูกปฏิเสธ");

  var token = uuid_(), role = (email === ADMIN_EMAIL) ? "admin" : "member";
  var exp = new Date(); exp.setHours(exp.getHours() + SESSION_HOURS);

  getOrCreateSheet_(SH_SESSIONS, ["token","uid","email","name","role","package","created_at","expires_at"])
    .appendRow([token, user.uid, user.email, user.name, role, user["package"]||"free", now_(), exp.toISOString()]);

  return jsonOk_({ token: token, user: {uid:user.uid, email:user.email, name:user.name, role:role, "package":user["package"]||"free"} });
}

function handleVerifySession_(token) {
  if (!token) return jsonErr_("ไม่มี token", 401);
  var sess = getRows_(SH_SESSIONS);
  for (var i = 0; i < sess.length; i++) {
    if (sess[i].token === token) {
      if (new Date(sess[i].expires_at) > new Date()) {
        return jsonOk_({user:{uid:sess[i].uid, email:sess[i].email, name:sess[i].name, role:sess[i].role, "package":sess[i]["package"]||"free"}});
      }
      try { getSS_().getSheetByName(SH_SESSIONS).deleteRow(sess[i]._row); } catch(e){}
      return jsonErr_("Session หมดอายุ", 401);
    }
  }
  return jsonErr_("Session ไม่ถูกต้อง", 401);
}

function handleLogout_(body) {
  var token = body.token || "";
  if (token) {
    var sess = getRows_(SH_SESSIONS);
    for (var i = sess.length-1; i >= 0; i--) {
      if (sess[i].token === token) {
        try { getSS_().getSheetByName(SH_SESSIONS).deleteRow(sess[i]._row); } catch(e){}
        break;
      }
    }
  }
  return jsonOk_({ message: "ออกจากระบบสำเร็จ" });
}

/* ============ AUTH HELPERS ============ */

function verifyAdmin_(token) {
  if (!token) return null;
  var s = getRows_(SH_SESSIONS);
  for (var i = 0; i < s.length; i++) {
    if (s[i].token === token && s[i].role === "admin" && new Date(s[i].expires_at) > new Date()) return s[i];
  }
  return null;
}

function verifyUser_(token) {
  if (!token) return null;
  var s = getRows_(SH_SESSIONS);
  for (var i = 0; i < s.length; i++) {
    if (s[i].token === token && new Date(s[i].expires_at) > new Date()) return s[i];
  }
  return null;
}

/* ============ SONGS ============ */

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

/* ============ ADMIN ============ */

function handleAdminListUsers_(token) {
  if (!verifyAdmin_(token)) return jsonErr_("ไม่ได้รับอนุญาต", 403);
  var users = getRows_(SH_USERS), list = [];
  for (var i = 0; i < users.length; i++) {
    list.push({uid:users[i].uid, email:users[i].email, name:users[i].name, status:users[i].status, "package":users[i]["package"]||"free", created_at:users[i].created_at});
  }
  return jsonOk_({users: list});
}

function handleAdminApprove_(body) {
  if (!verifyAdmin_(body.token)) return jsonErr_("ไม่ได้รับอนุญาต", 403);
  if (!body.uid) return jsonErr_("ไม่มี uid");
  var sheet = getSS_().getSheetByName(SH_USERS), users = getRows_(SH_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === body.uid) { sheet.getRange(users[i]._row, 6).setValue("approved"); return jsonOk_({message:"อนุมัติสำเร็จ"}); }
  }
  return jsonErr_("ไม่พบผู้ใช้");
}

function handleAdminReject_(body) {
  if (!verifyAdmin_(body.token)) return jsonErr_("ไม่ได้รับอนุญาต", 403);
  if (!body.uid) return jsonErr_("ไม่มี uid");
  var sheet = getSS_().getSheetByName(SH_USERS), users = getRows_(SH_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === body.uid) { sheet.getRange(users[i]._row, 6).setValue("rejected"); return jsonOk_({message:"ปฏิเสธสำเร็จ"}); }
  }
  return jsonErr_("ไม่พบผู้ใช้");
}

function handleAdminSetPackage_(body) {
  if (!verifyAdmin_(body.token)) return jsonErr_("ไม่ได้รับอนุญาต", 403);
  if (!body.uid || !body["package"]) return jsonErr_("ข้อมูลไม่ครบ");
  if (["free","silver","gold"].indexOf(body["package"]) === -1) return jsonErr_("Package ไม่ถูกต้อง");
  var sheet = getSS_().getSheetByName(SH_USERS), users = getRows_(SH_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === body.uid) { sheet.getRange(users[i]._row, 7).setValue(body["package"]); return jsonOk_({message:"เปลี่ยน package สำเร็จ"}); }
  }
  return jsonErr_("ไม่พบผู้ใช้");
}

/* ============ FAVORITES ============ */

function handleToggleFavorite_(body) {
  var sess = verifyUser_(body.token);
  if (!sess) return jsonErr_("กรุณาเข้าสู่ระบบ", 401);
  if (!body.song_name) return jsonErr_("ไม่มีชื่อเพลง");
  var sheet = getOrCreateSheet_(SH_FAVORITES, ["uid","song_name","song_url","added_at"]);
  var favs = getRows_(SH_FAVORITES);
  for (var i = 0; i < favs.length; i++) {
    if (favs[i].uid === sess.uid && favs[i].song_name === body.song_name) {
      sheet.deleteRow(favs[i]._row);
      return jsonOk_({favorited:false, message:"ลบออกจากรายการโปรดแล้ว"});
    }
  }
  sheet.appendRow([sess.uid, body.song_name, body.song_url||"", now_()]);
  return jsonOk_({favorited:true, message:"เพิ่มในรายการโปรดแล้ว"});
}

function handleGetFavorites_(token) {
  var sess = verifyUser_(token);
  if (!sess) return jsonErr_("กรุณาเข้าสู่ระบบ", 401);
  var favs = getRows_(SH_FAVORITES), list = [];
  for (var i = 0; i < favs.length; i++) {
    if (favs[i].uid === sess.uid) list.push({name:favs[i].song_name, url:favs[i].song_url});
  }
  return jsonOk_({favorites: list});
}

/* ============ SETLISTS ============ */

function handleSaveSetlist_(body) {
  var sess = verifyUser_(body.token);
  if (!sess) return jsonErr_("กรุณาเข้าสู่ระบบ", 401);
  var name = (body.name||"").trim();
  if (!name) return jsonErr_("กรุณาตั้งชื่อ setlist");

  var sheet = getOrCreateSheet_(SH_SETLISTS, ["uid","setlist_id","name","songs_json","created_at","updated_at"]);
  var sid = body.setlist_id || "";

  if (sid) {
    var rows = getRows_(SH_SETLISTS);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].uid === sess.uid && rows[i].setlist_id === sid) {
        sheet.getRange(rows[i]._row, 3).setValue(name);
        sheet.getRange(rows[i]._row, 4).setValue(body.songs_json||"[]");
        sheet.getRange(rows[i]._row, 6).setValue(now_());
        return jsonOk_({setlist_id:sid, message:"อัพเดท setlist สำเร็จ"});
      }
    }
  }

  sid = uuid_();
  sheet.appendRow([sess.uid, sid, name, body.songs_json||"[]", now_(), now_()]);
  return jsonOk_({setlist_id:sid, message:"สร้าง setlist สำเร็จ"});
}

function handleGetSetlists_(token) {
  var sess = verifyUser_(token);
  if (!sess) return jsonErr_("กรุณาเข้าสู่ระบบ", 401);
  var rows = getRows_(SH_SETLISTS), list = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].uid === sess.uid) list.push({setlist_id:rows[i].setlist_id, name:rows[i].name, songs_json:rows[i].songs_json, created_at:rows[i].created_at, updated_at:rows[i].updated_at});
  }
  return jsonOk_({setlists: list});
}

function handleDeleteSetlist_(body) {
  var sess = verifyUser_(body.token);
  if (!sess) return jsonErr_("กรุณาเข้าสู่ระบบ", 401);
  if (!body.setlist_id) return jsonErr_("ไม่มี setlist_id");
  var sheet = getSS_().getSheetByName(SH_SETLISTS);
  if (!sheet) return jsonErr_("ไม่พบ sheet");
  var rows = getRows_(SH_SETLISTS);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].uid === sess.uid && rows[i].setlist_id === body.setlist_id) {
      sheet.deleteRow(rows[i]._row);
      return jsonOk_({message:"ลบ setlist สำเร็จ"});
    }
  }
  return jsonErr_("ไม่พบ setlist");
}

/* ============ RECENT ============ */

function handleAddRecent_(body) {
  var sess = verifyUser_(body.token);
  if (!sess) return jsonErr_("กรุณาเข้าสู่ระบบ", 401);
  if (!body.song_name) return jsonErr_("ไม่มีชื่อเพลง");

  var sheet = getOrCreateSheet_(SH_RECENT, ["uid","song_name","song_url","opened_at"]);
  var recs = getRows_(SH_RECENT);
  for (var i = recs.length-1; i >= 0; i--) {
    if (recs[i].uid === sess.uid && recs[i].song_name === body.song_name) {
      sheet.deleteRow(recs[i]._row); break;
    }
  }

  sheet.appendRow([sess.uid, body.song_name, body.song_url||"", now_()]);

  recs = getRows_(SH_RECENT);
  var mine = recs.filter(function(r){ return r.uid === sess.uid; });
  if (mine.length > 50) {
    var del = mine.slice(0, mine.length - 50);
    del.sort(function(a,b){ return b._row - a._row; });
    for (var j = 0; j < del.length; j++) sheet.deleteRow(del[j]._row);
  }

  return jsonOk_({message:"บันทึกเพลงล่าสุดแล้ว"});
}

function handleGetRecent_(token) {
  var sess = verifyUser_(token);
  if (!sess) return jsonErr_("กรุณาเข้าสู่ระบบ", 401);
  var recs = getRows_(SH_RECENT), list = [];
  for (var i = 0; i < recs.length; i++) {
    if (recs[i].uid === sess.uid) list.push({name:recs[i].song_name, url:recs[i].song_url, opened_at:recs[i].opened_at});
  }
  list.reverse();
  return jsonOk_({recent: list});
}
