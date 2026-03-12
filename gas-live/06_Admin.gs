/***********************************************
 *  Note Chord SoulCiety — ADMIN
 ***********************************************/

function handleAdminListUsers_(token) {
  if (!verifyAdmin_(token)) return jsonErr_("ไม่ได้รับอนุญาต", 403);
  var users = getRows_(SH_USERS);
  var favs = getRows_(SH_FAVORITES);
  var sets = getRows_(SH_SETLISTS);
  var recs = getRows_(SH_RECENT);

  var list = [];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    // Count user data
    var favCount = 0, setCount = 0, recCount = 0;
    for (var j = 0; j < favs.length; j++) { if (favs[j].uid === u.uid) favCount++; }
    for (var j = 0; j < sets.length; j++) { if (sets[j].uid === u.uid) setCount++; }
    for (var j = 0; j < recs.length; j++) { if (recs[j].uid === u.uid) recCount++; }

    list.push({
      uid: u.uid,
      email: u.email,
      name: u.name,
      status: u.status,
      "package": u["package"] || "free",
      created_at: u.created_at,
      fav_count: favCount,
      setlist_count: setCount,
      recent_count: recCount
    });
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

function handleAdminBlockUser_(body) {
  if (!verifyAdmin_(body.token)) return jsonErr_("ไม่ได้รับอนุญาต", 403);
  if (!body.uid) return jsonErr_("ไม่มี uid");
  var sheet = getSS_().getSheetByName(SH_USERS), users = getRows_(SH_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === body.uid) {
      if (users[i].email === ADMIN_EMAIL) return jsonErr_("ไม่สามารถบล็อก Admin ได้");
      sheet.getRange(users[i]._row, 6).setValue("blocked");
      // Revoke all sessions of this user
      deleteUserSessions_(users[i].uid);
      return jsonOk_({message:"บล็อกสมาชิกสำเร็จ"});
    }
  }
  return jsonErr_("ไม่พบผู้ใช้");
}

function handleAdminUnblockUser_(body) {
  if (!verifyAdmin_(body.token)) return jsonErr_("ไม่ได้รับอนุญาต", 403);
  if (!body.uid) return jsonErr_("ไม่มี uid");
  var sheet = getSS_().getSheetByName(SH_USERS), users = getRows_(SH_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === body.uid) {
      sheet.getRange(users[i]._row, 6).setValue("approved");
      return jsonOk_({message:"ปลดบล็อกสมาชิกสำเร็จ"});
    }
  }
  return jsonErr_("ไม่พบผู้ใช้");
}

function handleAdminResetPassword_(body) {
  if (!verifyAdmin_(body.token)) return jsonErr_("ไม่ได้รับอนุญาต", 403);
  if (!body.uid || !body.new_password) return jsonErr_("ข้อมูลไม่ครบ");
  if (body.new_password.length < 6) return jsonErr_("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
  var sheet = getSS_().getSheetByName(SH_USERS), users = getRows_(SH_USERS);
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === body.uid) {
      var newSalt = uuid_(), newHash = hashPassword_(body.new_password, newSalt);
      sheet.getRange(users[i]._row, 4).setValue(newHash);
      sheet.getRange(users[i]._row, 5).setValue(newSalt);
      // Revoke all sessions so user must login with new password
      deleteUserSessions_(users[i].uid);
      return jsonOk_({message:"รีเซ็ตรหัสผ่านสำเร็จ"});
    }
  }
  return jsonErr_("ไม่พบผู้ใช้");
}

function handleAdminDeleteUser_(body) {
  if (!verifyAdmin_(body.token)) return jsonErr_("ไม่ได้รับอนุญาต", 403);
  if (!body.uid) return jsonErr_("ไม่มี uid");
  var users = getRows_(SH_USERS);
  var targetUser = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === body.uid) { targetUser = users[i]; break; }
  }
  if (!targetUser) return jsonErr_("ไม่พบผู้ใช้");
  if (targetUser.email === ADMIN_EMAIL) return jsonErr_("ไม่สามารถลบ Admin ได้");

  var uid = targetUser.uid;
  // Delete user data from all sheets (reverse order to avoid row shift)
  deleteRowsByUid_(SH_RECENT, uid);
  deleteRowsByUid_(SH_SETLISTS, uid);
  deleteRowsByUid_(SH_FAVORITES, uid);
  deleteUserSessions_(uid);

  // Delete user row last
  var userSheet = getSS_().getSheetByName(SH_USERS);
  var freshUsers = getRows_(SH_USERS);
  for (var i = 0; i < freshUsers.length; i++) {
    if (freshUsers[i].uid === uid) {
      userSheet.deleteRow(freshUsers[i]._row);
      break;
    }
  }

  return jsonOk_({message:"ลบสมาชิก " + targetUser.name + " สำเร็จ"});
}

/* ---------- Helper: delete sessions for a user ---------- */
function deleteUserSessions_(uid) {
  var sheet = getSS_().getSheetByName(SH_SESSIONS);
  if (!sheet) return;
  var rows = getRows_(SH_SESSIONS);
  // Delete in reverse to avoid row shift
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].uid === uid) {
      sheet.deleteRow(rows[i]._row);
    }
  }
}

/* ---------- Helper: delete all rows for a uid in a sheet ---------- */
function deleteRowsByUid_(sheetName, uid) {
  var sheet = getSS_().getSheetByName(sheetName);
  if (!sheet) return;
  var rows = getRows_(sheetName);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].uid === uid) {
      sheet.deleteRow(rows[i]._row);
    }
  }
}
