/***********************************************
 *  Note Chord SoulCiety — Sheet Music Sync
 *  Google Apps Script
 *  Spreadsheet: 17znwgPpX-Kp4dcGRRWDtzyGfIrdh_DAZoNxA9c2o0wg
 *  Drive Folders:
 *    - 1-pg1F3716VRZ7xMAcPtlRL_hJJSYIIbM (Primary)
 *    - 1v0xKLZPX_Lw13pj5YddAlXuwADd8af_K
 ***********************************************/

var FOLDER_IDS = [
  "1-pg1F3716VRZ7xMAcPtlRL_hJJSYIIbM",
  "1v0xKLZPX_Lw13pj5YddAlXuwADd8af_K"
];
var SHEET_NAME = "SheetMusic_Index";

var ALLOWED_MIMES = [
  MimeType.PDF,
  MimeType.JPEG,
  MimeType.PNG,
  MimeType.BMP
];

function extractSongName(fileName) {
  return fileName.replace(/\.(pdf|jpg|jpeg|png|bmp)$/i, "").trim();
}

function normalizeSongKey(songName) {
  return songName
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function collectFilesFromFolders() {
  var bySongKey = {};
  var duplicateCount = 0;

  for (var folderIndex = 0; folderIndex < FOLDER_IDS.length; folderIndex++) {
    var folderId = FOLDER_IDS[folderIndex];
    var folder;

    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (err) {
      Logger.log("Folder not found or no permission: " + folderId);
      continue;
    }

    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      if (ALLOWED_MIMES.indexOf(file.getMimeType()) === -1) continue;

      var songName = extractSongName(file.getName());
      var songKey  = normalizeSongKey(songName);
      if (!songKey) continue;

      var candidate = {
        name: songName,
        url: "https://drive.google.com/file/d/" + file.getId() + "/preview",
        updatedAt: file.getLastUpdated().getTime(),
        folderIndex: folderIndex,
        folderId: folderId
      };

      var existing = bySongKey[songKey];
      if (!existing) {
        bySongKey[songKey] = candidate;
        continue;
      }

      duplicateCount++;

      // เพลงซ้ำ: โฟลเดอร์หลัก (index 0) ชนะก่อนเสมอ; ถ้าไม่ใช่โฟลเดอร์หลักค่อยเทียบเวลาแก้ล่าสุด
      if (existing.folderIndex === 0 && candidate.folderIndex !== 0) {
        continue;
      }
      if (candidate.folderIndex === 0 && existing.folderIndex !== 0) {
        bySongKey[songKey] = candidate;
        continue;
      }

      if (
        candidate.updatedAt > existing.updatedAt ||
        (candidate.updatedAt === existing.updatedAt && candidate.folderIndex < existing.folderIndex)
      ) {
        bySongKey[songKey] = candidate;
      }
    }
  }

  var rows = [];
  for (var key in bySongKey) {
    rows.push([bySongKey[key].name, bySongKey[key].url]);
  }

  rows.sort(function(a, b) {
    return a[0].localeCompare(b[0], "th");
  });

  return {
    rows: rows,
    duplicateCount: duplicateCount
  };
}

function readSheetRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  return sheet.getRange(2, 1, lastRow - 1, 2).getValues().filter(function(row) {
    return row[0] !== "";
  });
}

function rowsEqual(a, b) {
  if (a.length !== b.length) return false;

  for (var i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) {
      return false;
    }
  }

  return true;
}

function writeRowsToSheet(sheet, rows) {
  var lastRow = sheet.getLastRow();
  var clearRows = Math.max(lastRow - 1, rows.length);
  if (clearRows > 0) {
    sheet.getRange(2, 1, clearRows, 2).clearContent();
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }
}

/* ====================================================
   1) FULL SYNC — ดึงไฟล์ทั้งหมดเขียนใหม่หมด
   รันครั้งแรก หรือกดปุ่ม Force Refresh
   ==================================================== */
function syncFilesAuto() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  // สร้าง sheet อัตโนมัติถ้ายังไม่มี
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange("A1:B1").setValues([["ชื่อเพลง", "ลิงก์"]]);
    sheet.getRange("A1:B1").setFontWeight("bold");
  }

  var result = collectFilesFromFolders();
  writeRowsToSheet(sheet, result.rows);

  // บันทึกเวลา sync ล่าสุด
  PropertiesService.getScriptProperties().setProperty(
    "lastSync", new Date().toISOString()
  );

  Logger.log(
    "Full sync: " + result.rows.length + " files, duplicates resolved: " + result.duplicateCount +
    " at " + new Date().toISOString()
  );
}

/* ====================================================
   2) INCREMENTAL SYNC — ตรวจเฉพาะไฟล์ใหม่/ที่ถูกลบ
   ถูกเรียกอัตโนมัติทุก 5 นาที (ประหยัด quota)
   ==================================================== */
function syncNewFiles() {
  var props    = PropertiesService.getScriptProperties();
  var lastSync = props.getProperty("lastSync");

  // ถ้ายังไม่เคย sync → sync ทั้งหมด
  if (!lastSync) {
    syncFilesAuto();
    return;
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    syncFilesAuto();
    return;
  }

  var existingRows = readSheetRows(sheet);
  var result = collectFilesFromFolders();

  if (rowsEqual(existingRows, result.rows)) {
    Logger.log("No changes detected.");
  } else {
    writeRowsToSheet(sheet, result.rows);
    Logger.log(
      "Incremental sync updated. Total: " + result.rows.length +
      ", duplicates resolved: " + result.duplicateCount
    );
  }

  props.setProperty("lastSync", new Date().toISOString());
}

/* ====================================================
   3) ติดตั้ง TRIGGER — ทุก 5 นาที (รันครั้งเดียว)
   ==================================================== */
function installTrigger() {
  // ลบ trigger เก่าก่อน (กัน duplicate)
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncNewFiles") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // สร้าง trigger ใหม่: ทุก 5 นาที
  ScriptApp.newTrigger("syncNewFiles")
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("Trigger installed: syncNewFiles runs every 5 minutes");
}

/* ====================================================
   4) ลบ TRIGGER
   ==================================================== */
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