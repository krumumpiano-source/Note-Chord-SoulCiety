/***********************************************
 *  Note Chord SoulCiety — WEB APP ROUTER
 ***********************************************/

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
    case "get-pdf":          return handleGetPdf_(p.token, p.fileId);
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
    case "admin-block":       return handleAdminBlockUser_(body);
    case "admin-unblock":     return handleAdminUnblockUser_(body);
    case "admin-reset-pw":    return handleAdminResetPassword_(body);
    case "admin-delete-user": return handleAdminDeleteUser_(body);
    case "toggle-favorite":   return handleToggleFavorite_(body);
    case "save-setlist":      return handleSaveSetlist_(body);
    case "delete-setlist":    return handleDeleteSetlist_(body);
    case "add-recent":        return handleAddRecent_(body);
    case "change-password":   return handleChangePassword_(body);
    default:                  return jsonErr_("Unknown action: " + action, 404);
  }
}
