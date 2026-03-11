/***********************************************
 *  Note Chord SoulCiety — AUTH (Register/Login/Session)
 ***********************************************/

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
