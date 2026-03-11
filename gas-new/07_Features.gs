/***********************************************
 *  Note Chord SoulCiety — FAVORITES / SETLISTS / RECENT
 ***********************************************/

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
