/***********************************************
 *  Note Chord SoulCiety — ADMIN
 ***********************************************/

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
