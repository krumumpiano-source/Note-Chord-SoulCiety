/***********************************************
 *  Note Chord SoulCiety — Complete GAS Backend
 *  Spreadsheet: 17znwgPpX-Kp4dcGRRWDtzyGfIrdh_DAZoNxA9c2o0wg
 *  Drive Folder: 1v0xKLZPX_Lw13pj5YddAlXuwADd8af_K
 *
 *  วิธีใช้:
 *  1. ลบโค้ดเก่าใน Apps Script → วางโค้ดนี้ทั้งหมด
 *  2. รัน syncFilesAuto() ครั้งแรก (อนุญาต permissions)
 *  3. รัน installTrigger() ครั้งเดียว (auto-sync ทุก 5 นาที)
 *  4. รัน initSheets() ครั้งเดียว (สร้าง sheets สำหรับ users/auth)
 *  5. Deploy > New deployment > Web app > Anyone > Deploy
 *  6. Copy URL ไปใส่ใน js/config.js
 ***********************************************/

/* ============ CONFIG ============ */
var FOLDER_ID      = "1v0xKLZPX_Lw13pj5YddAlXuwADd8af_K";
var SPREADSHEET_ID = "17znwgPpX-Kp4dcGRRWDtzyGfIrdh_DAZoNxA9c2o0wg";
var SHEET_SONGS    = "SheetMusic_Index";
var SHEET_USERS    = "users";
var SHEET_SESSIONS = "sessions";
var SHEET_FAVORITES= "favorites";
var SHEET_SETLISTS = "setlists";
var SHEET_RECENT   = "recent";
var ADMIN_EMAIL    = "krumum.piano@gmail.com";
var SESSION_HOURS  = 24;

/* ============ HELPERS ============ */

function getSS() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet(name, headers) {
  var ss = getSS();
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

function uuid() {
  return Utilities.getUuid();
}

function now() {
  return new Date().toISOString();
}

function hashPassword(password, salt) {
  var input = salt + password;
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    if (h.length === 1) h = "0" + h;
    hex += h;
  }
  return hex;
}

function jsonOk(data) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(msg, code) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg, code: code || 400 }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetRows(sheetName) {
  var sheet = getSS().getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    obj._row = i + 2;
    rows.push(obj);
  }
  return rows;
}

/* ============ INIT SHEETS ============ */

function initSheets() {
  getOrCreateSheet(SHEET_USERS, ["uid", "email", "name", "password_hash", "salt", "status", "package", "created_at"]);
  getOrCreateSheet(SHEET_SESSIONS, ["token", "uid", "email", "name", "role", "package", "created_at", "expires_at"]);
  getOrCreateSheet(SHEET_FAVORITES, ["uid", "song_name", "song_url", "added_at"]);
  getOrCreateSheet(SHEET_SETLISTS, ["uid", "setlist_id", "name", "songs_json", "created_at", "updated_at"]);
  getOrCreateSheet(SHEET_RECENT, ["uid", "song_name", "song_url", "opened_at"]);
  Logger.log("All sheets initialized!");
}

/* ============ WEB APP ROUTER ============ */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  var p = e ? e.parameter : {};

  switch (action) {
    case "ping":
      return jsonOk({ message: "Note Chord SoulCiety API ready", time: now() });
    case "list-songs":
      return handleListSongs();
    case "verify-session":
      return handleVerifySession(p.token);
    case "admin-list-users":
      return handleAdminListUsers(p.token);
    case "get-favorites":
      return handleGetFavorites(p.token);
    case "get-setlists":
      return handleGetSetlists(p.token);
    case "get-recent":
      return handleGetRecent(p.token);
    default:
      return jsonError("Unknown action: " + action, 404);
  }
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonError("Invalid JSON body", 400);
  }

  var action = body.action || "";

  switch (action) {
    case "register":
      return handleRegister(body);
    case "login":
      return handleLogin(body);
    case "logout":
      return handleLogout(body);
    case "admin-approve":
      return handleAdminApprove(body);
    case "admin-reject":
      return handleAdminReject(body);
    case "admin-set-package":
      return handleAdminSetPackage(body);
    case "toggle-favorite":
      return handleToggleFavorite(body);
    case "save-setlist":
      return handleSaveSetlist(body);
    case "delete-setlist":
      return handleDeleteSetlist(body);
    case "add-recent":
      return handleAddRecent(body);
    default:
      return jsonError("Unknown action: " + action, 404);
  }
}

/* ============ AUTH ============ */

function handleRegister(body) {
  var email = (body.email || "").trim().toLowerCase();
  var name = (body.name || "").trim();
  var password = body.password || "";

  if (!email || !name || !password) {
    return jsonError("กรุณากรอกข้อมูลให้ครบ");
  }
  if (password.length < 6) {
    return jsonError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
  }

  // Check duplicate email
  var users = getSheetRows(SHEET_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) {
      return jsonError("อีเมลนี้ถูกใช้แล้ว");
    }
  }

  var salt = uuid();
  var hash = hashPassword(password, salt);
  var uid = uuid();
  var status = (email === ADMIN_EMAIL) ? "approved" : "pending";
  var pkg = (email === ADMIN_EMAIL) ? "gold" : "free";

  var sheet = getOrCreateSheet(SHEET_USERS, ["uid", "email", "name", "password_hash", "salt", "status", "package", "created_at"]);
  sheet.appendRow([uid, email, name, hash, salt, status, pkg, now()]);

  if (status === "pending") {
    return jsonOk({ message: "สมัครสำเร็จ! กรุณารอแอดมินอนุมัติ" });
  }
  return jsonOk({ message: "สมัครสำเร็จ! (Admin) เข้าสู่ระบบได้เลย" });
}

function handleLogin(body) {
  var email = (body.email || "").trim().toLowerCase();
  var password = body.password || "";

  if (!email || !password) {
    return jsonError("กรุณากรอกอีเมลและรหัสผ่าน");
  }

  var users = getSheetRows(SHEET_USERS);
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) {
      user = users[i];
      break;
    }
  }

  if (!user) {
    return jsonError("ไม่พบบัญชีผู้ใช้นี้");
  }

  var hash = hashPassword(password, user.salt);
  if (hash !== user.password_hash) {
    return jsonError("รหัสผ่านไม่ถูกต้อง");
  }

  if (user.status === "pending") {
    return jsonError("บัญชีของคุณยังรอการอนุมัติจากแอดมิน");
  }
  if (user.status === "rejected") {
    return jsonError("บัญชีของคุณถูกปฏิเสธ");
  }

  // Create session
  var token = uuid();
  var role = (email === ADMIN_EMAIL) ? "admin" : "member";
  var expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_HOURS);

  var sessSheet = getOrCreateSheet(SHEET_SESSIONS, ["token", "uid", "email", "name", "role", "package", "created_at", "expires_at"]);
  sessSheet.appendRow([token, user.uid, user.email, user.name, role, user.package || "free", now(), expiresAt.toISOString()]);

  return jsonOk({
    token: token,
    user: {
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: role,
      package: user.package || "free"
    }
  });
}

function handleVerifySession(token) {
  if (!token) return jsonError("ไม่มี token", 401);

  var sessions = getSheetRows(SHEET_SESSIONS);
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].token === token) {
      var expires = new Date(sessions[i].expires_at);
      if (expires > new Date()) {
        return jsonOk({
          user: {
            uid: sessions[i].uid,
            email: sessions[i].email,
            name: sessions[i].name,
            role: sessions[i].role,
            package: sessions[i]["package"] || "free"
          }
        });
      } else {
        // Expired - delete it
        var sheet = getSS().getSheetByName(SHEET_SESSIONS);
        if (sheet) sheet.deleteRow(sessions[i]._row);
        return jsonError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
      }
    }
  }
  return jsonError("Session ไม่ถูกต้อง", 401);
}

function handleLogout(body) {
  var token = body.token || "";
  if (!token) return jsonOk({ message: "Logged out" });

  var sheet = getSS().getSheetByName(SHEET_SESSIONS);
  if (!sheet) return jsonOk({ message: "Logged out" });

  var sessions = getSheetRows(SHEET_SESSIONS);
  for (var i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].token === token) {
      sheet.deleteRow(sessions[i]._row);
      break;
    }
  }
  return jsonOk({ message: "ออกจากระบบสำเร็จ" });
}

/* ============ SONGS ============ */

function handleListSongs() {
  var sheet = getSS().getSheetByName(SHEET_SONGS);
  if (!sheet) return jsonError("ไม่พบ sheet เพลง");

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonOk({ songs: [] });

  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var songs = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      songs.push({
        name: data[i][0].toString().trim(),
        url: data[i][1].toString().trim()
      });
    }
  }

  return jsonOk({ songs: songs, total: songs.length });
}

/* ============ ADMIN ============ */

function verifyAdmin(token) {
  if (!token) return null;
  var sessions = getSheetRows(SHEET_SESSIONS);
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].token === token && sessions[i].role === "admin") {
      var expires = new Date(sessions[i].expires_at);
      if (expires > new Date()) return sessions[i];
    }
  }
  return null;
}

function verifyUser(token) {
  if (!token) return null;
  var sessions = getSheetRows(SHEET_SESSIONS);
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].token === token) {
      var expires = new Date(sessions[i].expires_at);
      if (expires > new Date()) return sessions[i];
    }
  }
  return null;
}

function handleAdminListUsers(token) {
  if (!verifyAdmin(token)) return jsonError("ไม่ได้รับอนุญาต", 403);

  var users = getSheetRows(SHEET_USERS);
  var list = [];
  for (var i = 0; i < users.length; i++) {
    list.push({
      uid: users[i].uid,
      email: users[i].email,
      name: users[i].name,
      status: users[i].status,
      package: users[i]["package"] || "free",
      created_at: users[i].created_at,
      _row: users[i]._row
    });
  }
  return jsonOk({ users: list });
}

function handleAdminApprove(body) {
  if (!verifyAdmin(body.token)) return jsonError("ไม่ได้รับอนุญาต", 403);

  var uid = body.uid;
  if (!uid) return jsonError("ไม่มี uid");

  var sheet = getSS().getSheetByName(SHEET_USERS);
  var users = getSheetRows(SHEET_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === uid) {
      sheet.getRange(users[i]._row, 6).setValue("approved"); // col 6 = status
      return jsonOk({ message: "อนุมัติสมาชิกสำเร็จ" });
    }
  }
  return jsonError("ไม่พบผู้ใช้");
}

function handleAdminReject(body) {
  if (!verifyAdmin(body.token)) return jsonError("ไม่ได้รับอนุญาต", 403);

  var uid = body.uid;
  if (!uid) return jsonError("ไม่มี uid");

  var sheet = getSS().getSheetByName(SHEET_USERS);
  var users = getSheetRows(SHEET_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === uid) {
      sheet.getRange(users[i]._row, 6).setValue("rejected");
      return jsonOk({ message: "ปฏิเสธสมาชิกสำเร็จ" });
    }
  }
  return jsonError("ไม่พบผู้ใช้");
}

function handleAdminSetPackage(body) {
  if (!verifyAdmin(body.token)) return jsonError("ไม่ได้รับอนุญาต", 403);

  var uid = body.uid;
  var pkg = body.package;
  if (!uid || !pkg) return jsonError("ข้อมูลไม่ครบ");
  if (["free", "silver", "gold"].indexOf(pkg) === -1) return jsonError("Package ไม่ถูกต้อง");

  var sheet = getSS().getSheetByName(SHEET_USERS);
  var users = getSheetRows(SHEET_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === uid) {
      sheet.getRange(users[i]._row, 7).setValue(pkg); // col 7 = package
      return jsonOk({ message: "เปลี่ยน package สำเร็จ" });
    }
  }
  return jsonError("ไม่พบผู้ใช้");
}

/* ============ FAVORITES ============ */

function handleToggleFavorite(body) {
  var session = verifyUser(body.token);
  if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);

  var songName = body.song_name || "";
  var songUrl = body.song_url || "";
  if (!songName) return jsonError("ไม่มีชื่อเพลง");

  var sheet = getOrCreateSheet(SHEET_FAVORITES, ["uid", "song_name", "song_url", "added_at"]);
  var favs = getSheetRows(SHEET_FAVORITES);

  // Check if exists
  for (var i = 0; i < favs.length; i++) {
    if (favs[i].uid === session.uid && favs[i].song_name === songName) {
      // Remove favorite
      sheet.deleteRow(favs[i]._row);
      return jsonOk({ favorited: false, message: "ลบออกจากรายการโปรดแล้ว" });
    }
  }

  // Add favorite
  sheet.appendRow([session.uid, songName, songUrl, now()]);
  return jsonOk({ favorited: true, message: "เพิ่มในรายการโปรดแล้ว" });
}

function handleGetFavorites(token) {
  var session = verifyUser(token);
  if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);

  var favs = getSheetRows(SHEET_FAVORITES);
  var list = [];
  for (var i = 0; i < favs.length; i++) {
    if (favs[i].uid === session.uid) {
      list.push({ name: favs[i].song_name, url: favs[i].song_url });
    }
  }
  return jsonOk({ favorites: list });
}

/* ============ SETLISTS ============ */

function handleSaveSetlist(body) {
  var session = verifyUser(body.token);
  if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);

  var setlistId = body.setlist_id || "";
  var name = (body.name || "").trim();
  var songsJson = body.songs_json || "[]";
  if (!name) return jsonError("กรุณาตั้งชื่อ setlist");

  var sheet = getOrCreateSheet(SHEET_SETLISTS, ["uid", "setlist_id", "name", "songs_json", "created_at", "updated_at"]);

  if (setlistId) {
    // Update existing
    var setlists = getSheetRows(SHEET_SETLISTS);
    for (var i = 0; i < setlists.length; i++) {
      if (setlists[i].uid === session.uid && setlists[i].setlist_id === setlistId) {
        sheet.getRange(setlists[i]._row, 3).setValue(name);
        sheet.getRange(setlists[i]._row, 4).setValue(songsJson);
        sheet.getRange(setlists[i]._row, 6).setValue(now());
        return jsonOk({ setlist_id: setlistId, message: "อัพเดท setlist สำเร็จ" });
      }
    }
  }

  // Create new
  setlistId = uuid();
  sheet.appendRow([session.uid, setlistId, name, songsJson, now(), now()]);
  return jsonOk({ setlist_id: setlistId, message: "สร้าง setlist สำเร็จ" });
}

function handleGetSetlists(token) {
  var session = verifyUser(token);
  if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);

  var setlists = getSheetRows(SHEET_SETLISTS);
  var list = [];
  for (var i = 0; i < setlists.length; i++) {
    if (setlists[i].uid === session.uid) {
      list.push({
        setlist_id: setlists[i].setlist_id,
        name: setlists[i].name,
        songs_json: setlists[i].songs_json,
        created_at: setlists[i].created_at,
        updated_at: setlists[i].updated_at
      });
    }
  }
  return jsonOk({ setlists: list });
}

function handleDeleteSetlist(body) {
  var session = verifyUser(body.token);
  if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);

  var setlistId = body.setlist_id || "";
  if (!setlistId) return jsonError("ไม่มี setlist_id");

  var sheet = getSS().getSheetByName(SHEET_SETLISTS);
  if (!sheet) return jsonError("ไม่พบ sheet");

  var setlists = getSheetRows(SHEET_SETLISTS);
  for (var i = 0; i < setlists.length; i++) {
    if (setlists[i].uid === session.uid && setlists[i].setlist_id === setlistId) {
      sheet.deleteRow(setlists[i]._row);
      return jsonOk({ message: "ลบ setlist สำเร็จ" });
    }
  }
  return jsonError("ไม่พบ setlist");
}

/* ============ RECENT ============ */

function handleAddRecent(body) {
  var session = verifyUser(body.token);
  if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);

  var songName = body.song_name || "";
  var songUrl = body.song_url || "";
  if (!songName) return jsonError("ไม่มีชื่อเพลง");

  var sheet = getOrCreateSheet(SHEET_RECENT, ["uid", "song_name", "song_url", "opened_at"]);

  // Remove old entry for same song (to move to top)
  var recents = getSheetRows(SHEET_RECENT);
  for (var i = recents.length - 1; i >= 0; i--) {
    if (recents[i].uid === session.uid && recents[i].song_name === songName) {
      sheet.deleteRow(recents[i]._row);
      break;
    }
  }

  // Add new entry
  sheet.appendRow([session.uid, songName, songUrl, now()]);

  // Keep only last 50
  recents = getSheetRows(SHEET_RECENT);
  var userRecents = recents.filter(function(r) { return r.uid === session.uid; });
  if (userRecents.length > 50) {
    var toDelete = userRecents.slice(0, userRecents.length - 50);
    // Delete from bottom to avoid row shift
    toDelete.sort(function(a, b) { return b._row - a._row; });
    for (var j = 0; j < toDelete.length; j++) {
      sheet.deleteRow(toDelete[j]._row);
    }
  }

  return jsonOk({ message: "บันทึกเพลงล่าสุดแล้ว" });
}

function handleGetRecent(token) {
  var session = verifyUser(token);
  if (!session) return jsonError("กรุณาเข้าสู่ระบบ", 401);

  var recents = getSheetRows(SHEET_RECENT);
  var list = [];
  for (var i = 0; i < recents.length; i++) {
    if (recents[i].uid === session.uid) {
      list.push({
        name: recents[i].song_name,
        url: recents[i].song_url,
        opened_at: recents[i].opened_at
      });
    }
  }
  // Sort newest first
  list.reverse();
  return jsonOk({ recent: list });
}

/* ========================================================
   FILE SYNC (เดิม — ดึงไฟล์จาก Drive ลง Sheet อัตโนมัติ)
   ======================================================== */

function syncFilesAuto() {
  var ss = getSS();
  var sheet = ss.getSheetByName(SHEET_SONGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SONGS);
    sheet.getRange("A1:B1").setValues([["ชื่อเพลง", "ลิงก์"]]);
    sheet.getRange("A1:B1").setFontWeight("bold");
  }

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
  }

  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFiles();
  var allowedMimes = [MimeType.PDF, MimeType.JPEG, MimeType.PNG, MimeType.BMP];

  var data = [];
  while (files.hasNext()) {
    var file = files.next();
    if (allowedMimes.indexOf(file.getMimeType()) === -1) continue;
    var name = file.getName().replace(/\.(pdf|jpg|jpeg|png|bmp)$/i, "");
    var url = "https://drive.google.com/file/d/" + file.getId() + "/preview";
    data.push([name, url]);
  }

  data.sort(function(a, b) { return a[0].localeCompare(b[0], "th"); });

  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, 2).setValues(data);
  }

  PropertiesService.getScriptProperties().setProperty("lastSync", now());
  Logger.log("Full sync: " + data.length + " files at " + now());
}

function syncNewFiles() {
  var props = PropertiesService.getScriptProperties();
  var lastSync = props.getProperty("lastSync");
  if (!lastSync) { syncFilesAuto(); return; }

  var ss = getSS();
  var sheet = ss.getSheetByName(SHEET_SONGS);
  if (!sheet) { syncFilesAuto(); return; }

  var lastRow = sheet.getLastRow();
  var existingUrls = {};
  if (lastRow > 1) {
    var existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i][0]) existingUrls[existing[i][0]] = true;
    }
  }

  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFiles();
  var allowedMimes = [MimeType.PDF, MimeType.JPEG, MimeType.PNG, MimeType.BMP];
  var newFiles = [];
  var allUrls = {};

  while (files.hasNext()) {
    var file = files.next();
    if (allowedMimes.indexOf(file.getMimeType()) === -1) continue;
    var url = "https://drive.google.com/file/d/" + file.getId() + "/preview";
    allUrls[url] = true;
    if (!existingUrls[url]) {
      var name = file.getName().replace(/\.(pdf|jpg|jpeg|png|bmp)$/i, "");
      newFiles.push([name, url]);
    }
  }

  var hasDeleted = false;
  for (var existUrl in existingUrls) {
    if (!allUrls[existUrl]) { hasDeleted = true; break; }
  }

  if (hasDeleted) { syncFilesAuto(); return; }

  if (newFiles.length > 0) {
    var allData = [];
    if (lastRow > 1) {
      allData = sheet.getRange(2, 1, lastRow - 1, 2).getValues().filter(function(r) { return r[0] !== ""; });
    }
    allData = allData.concat(newFiles);
    allData.sort(function(a, b) { return a[0].localeCompare(b[0], "th"); });
    var clearRows = Math.max(lastRow - 1, allData.length);
    sheet.getRange(2, 1, clearRows, 2).clearContent();
    if (allData.length > 0) {
      sheet.getRange(2, 1, allData.length, 2).setValues(allData);
    }
    Logger.log("Added " + newFiles.length + " new files. Total: " + allData.length);
  } else {
    Logger.log("No changes detected.");
  }

  props.setProperty("lastSync", now());
}

/* ============ TRIGGERS ============ */

function installTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncNewFiles") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("syncNewFiles").timeBased().everyMinutes(5).create();
  Logger.log("Trigger installed: syncNewFiles every 5 minutes");
}

function removeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncNewFiles") {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  Logger.log("Removed " + count + " trigger(s)");
}
