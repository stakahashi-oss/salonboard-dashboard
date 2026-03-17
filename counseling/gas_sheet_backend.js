var SECRET_KEY = "ssin2026";
var LINE_TOKEN = "E0gasK7zfaVSi5SEFzmvbvZLOwAjvyxEatqHUzv2cFhIqNE4Pg8R8i5/139d9oKI6uExBLGieIqgN36szq1dWEZ5qXxU8T8paVtFhkBOwKESOZRb+muKxCmy8mrI1WyT8/VyJBsXpyYU+CKtRLo8uAdB04t89/1O/w1cDnyilFU=";
var RESERVATION_SS_ID = "1Uwvhc1S_4gLStUiWBp8M_x8cDZBbu7VpMuskkpA8zXg";

// ★ GitHub Pages のカウンセリングフォームURL
var COUNSELING_FORM_URL = "https://stakahashi-oss.github.io/salonboard-dashboard/counseling/";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // LINE Webhook（友だち追加）
    if (body.events) {
      return handleLineWebhook(body);
    }

    // 通常API
    if (body.key !== SECRET_KEY) return resp({error: "unauthorized"});
    var action = body.action;
    if (action === "save_counseling")    return resp(saveCounseling(body.data));
    if (action === "log_line")           return resp(logLine(body.data));
    if (action === "register_friend")    return resp(registerFriend(body.data));
    if (action === "get_line_friends")   return resp(getLineFriends());
    return resp({error: "unknown action"});
  } catch(err) {
    return resp({error: err.toString()});
  }
}

function doGet(e) {
  var key = e.parameter.key;
  var act = e.parameter.action;
  if (key !== SECRET_KEY) return resp({error: "unauthorized"});
  if (act === "get_all")          return resp(getAllCounseling());
  if (act === "get_stats")        return resp(getStats());
  if (act === "search_phone")     return resp(searchByPhone(e.parameter.phone));
  if (act === "get_line_friends") return resp(getLineFriends());
  return resp({error: "unknown action"});
}

// ── LINE Webhook ──────────────────────────────────────────
function handleLineWebhook(body) {
  var events = body.events || [];
  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    if (event.type === "follow") {
      var userId = event.source.userId;
      sendCounselingLink(userId);
      registerFriend({line_uid: userId, phone: "", name: ""});
    }
  }
  return resp({status: "ok"});
}

function sendCounselingLink(userId) {
  var formUrl = COUNSELING_FORM_URL + "?uid=" + userId;
  var message = "友だち追加ありがとうございます！\uD83D\uDE0A\n"
    + "SSIN STUDIO / most eyes / LUMISS です\u2728\n\n"
    + "ご来店前に下記のカウンセリングシートにご記入いただけると\n"
    + "スムーズにご案内できます\uD83D\uDCCB\n\n"
    + "\u25BC カウンセリングシート\n" + formUrl + "\n\n"
    + "ご不明点はこちらのLINE\u3078\u304A\u6C17\u8EFD\u306B\u3069\u3046\u305E\uD83C\uDF38";
  var payload = {
    to: userId,
    messages: [{type: "text", text: message}]
  };
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {Authorization: "Bearer " + LINE_TOKEN},
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
}

// ── スプレッドシート取得 ──────────────────────────────────
function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    setupSheet(sheet, name);
  }
  return sheet;
}

function setupSheet(sheet, name) {
  var headerMap = {
    "カウンセリング記録": ["記録ID","記録日時","店舗名","来店日","予約番号","電話番号","お名前","メニュー","担当スタッフ","肌質","アレルギー","アレルギー詳細","過去施術歴","本日の要望","施術メモ","次回提案","次回提案時期","LINE_UID","LINE送信フラグ","最終更新"],
    "LINE配信ログ": ["ログID","送信日時","電話番号","お名前","LINE_UID","種別","内容","ステータス","エラー"],
    "LINE友だち": ["LINE_UID","電話番号","お名前","LINE表示名","メモ","登録日時","最終来店日"],
    "設定": ["キー","値"]
  };
  var colorMap = {
    "カウンセリング記録": "#00b900",
    "LINE配信ログ": "#1a73e8",
    "LINE友だち": "#0d7a0d",
    "設定": "#888888"
  };
  var headers = headerMap[name];
  if (!headers) return;
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground(colorMap[name] || "#444444")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  if (name === "設定") {
    sheet.appendRow(["店舗名", "SSIN STUDIO"]);
    sheet.appendRow(["LINE公式アカウント", "@027qvfqz"]);
    sheet.appendRow(["リマインド_来店前日数", "2"]);
    sheet.appendRow(["フォロー_来店後日数", "1"]);
    sheet.appendRow(["ステップ1_日数", "14"]);
    sheet.appendRow(["ステップ2_日数", "30"]);
    sheet.appendRow(["ステップ3_日数", "60"]);
  }
}

// ── カウンセリング保存 ────────────────────────────────────
function saveCounseling(data) {
  var sheet = getSheet("カウンセリング記録");
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  var id = "C" + new Date().getTime();

  // LINE UIDを電話番号から検索（未指定の場合）
  var lineUid = data.line_uid || findLineUidByPhone(data.phone || "");
  var lineSent = "未送信";

  // LINE UID があればお礼メッセージを自動送信
  if (lineUid) {
    var sent = sendThankYouMessage(lineUid, data);
    lineSent = sent ? "送信済み" : "送信失敗";
    if (sent) {
      logLine({
        phone: data.phone || "", name: data.name || "", line_uid: lineUid,
        type: "お礼", content: "カウンセリング保存時自動送信", status: "成功", error: ""
      });
    }
  }

  sheet.appendRow([
    id, now,
    data.store || "", data.visit_date || "", data.reservation_id || "",
    data.phone || "", data.name || "", data.menu || "", data.staff || "",
    data.skin_type || "", data.allergy || "なし", data.allergy_detail || "",
    data.past_treatment || "", data.request || "", data.treatment_memo || "",
    data.next_menu || "", data.next_timing || "",
    lineUid, lineSent, now
  ]);
  return {status: "ok", id: id, line_sent: lineSent};
}

// ── 電話番号からLINE UIDを検索 ───────────────────────────
function findLineUidByPhone(phone) {
  if (!phone) return "";
  var norm = String(phone).replace(/-/g, "");
  var sheet = getSheet("LINE友だち");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).replace(/-/g, "") === norm && data[i][0]) {
      return String(data[i][0]);
    }
  }
  return "";
}

// ── お礼メッセージ送信 ───────────────────────────────────
function sendThankYouMessage(lineUid, data) {
  var name       = data.name || "お客様";
  var store      = data.store || "当店";
  var menu       = data.menu || "";
  var nextMenu   = data.next_menu || "";
  var nextTiming = data.next_timing || "";
  var memo       = data.treatment_memo || "";

  var msg = "本日はご来店いただきありがとうございました\uD83D\uDE4F\n"
    + store + " \u30B9\u30BF\u30C3\u30D5\u4E00\u540C\u3088\u308A\n\n"
    + name + "\u69D8\u306B\u3054\u6E80\u8DB3\u3044\u305F\u3060\u3051\u307E\u3057\u305F\u3067\u3057\u3087\u3046\u304B\uFF1F\u2728";

  if (nextMenu) {
    msg += "\n\n\u27A1\uFE0F \u6B21\u56DE\u306E\u304A\u3059\u3059\u3081\n"
      + "\u300C" + nextMenu + "\u300D";
    if (nextTiming) {
      msg += "\n\u76EE\u5B89\u306F" + nextTiming + "\u3054\u308D\u3067\u3059\uD83D\uDCC5";
    }
  }

  msg += "\n\n\u307E\u305F\u306E\u3054\u6765\u5E97\u3092\u30B9\u30BF\u30C3\u30D5\u4E00\u540C\u304A\u5F85\u3061\u3057\u3066\u304A\u308A\u307E\u3059\uD83C\uDF38\n\u3054\u4E88\u7D04\u30FB\u3054\u76F8\u8AC7\u306F\u3053\u3061\u3089\u306ELINE\u3078\uD83D\uDCF1";

  var payload = {
    to: lineUid,
    messages: [{type: "text", text: msg}]
  };
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {Authorization: "Bearer " + LINE_TOKEN},
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
    return res.getResponseCode() === 200;
  } catch(e) {
    return false;
  }
}

// ── カウンセリング全件取得 ────────────────────────────────
function getAllCounseling() {
  var sheet = getSheet("カウンセリング記録");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {records: []};
  var headers = data[0];
  var records = [];
  for (var i = data.length - 1; i >= 1; i--) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    records.push(obj);
  }
  return {records: records};
}

// ── 電話番号で検索（カウンセリング記録）─────────────────
function searchByPhone(phone) {
  var norm = String(phone || "").replace(/-/g, "");

  // カウンセリング履歴
  var sheet = getSheet("カウンセリング記録");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var past = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][5]).replace(/-/g, "") === norm) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      past.push(obj);
    }
  }

  // 予約情報（予約スプレッドシートから）
  var reservations = [];
  try {
    var ss = SpreadsheetApp.openById(RESERVATION_SS_ID);
    var rsheet = ss.getSheets()[0];
    var rdata = rsheet.getDataRange().getValues();
    for (var r = 1; r < rdata.length; r++) {
      var row = rdata[r];
      if (String(row[14]).replace(/-/g, "") === norm) {
        reservations.push({
          reservation_id: String(row[0]),
          status:         String(row[1]),
          store:          String(row[2]),
          staff:          String(row[4]),
          visit_date:     String(row[6]),
          start_time:     String(row[7]),
          menu:           String(row[11]),
          name:           String(row[13]),
          phone:          String(row[14]),
          first_visit:    String(row[20])
        });
        if (reservations.length >= 5) break;
      }
    }
  } catch(e) {}

  return {reservations: reservations, past_counseling: past};
}

// ── LINE友だち一覧取得 ───────────────────────────────────
function getLineFriends() {
  var sheet = getSheet("LINE友だち");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {friends: []};
  var headers = data[0];
  var friends = [];
  for (var i = data.length - 1; i >= 1; i--) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    friends.push(obj);
  }
  return {friends: friends};
}

// ── LINE配信ログ保存 ─────────────────────────────────────
function logLine(data) {
  var sheet = getSheet("LINE配信ログ");
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  var id = "L" + new Date().getTime();
  sheet.appendRow([
    id, now,
    data.phone || "", data.name || "", data.line_uid || "",
    data.type || "", data.content || "", data.status || "", data.error || ""
  ]);
  return {status: "ok", log_id: id};
}

// ── LINE友だち登録 ───────────────────────────────────────
function registerFriend(data) {
  var sheet = getSheet("LINE友だち");
  var all = sheet.getDataRange().getValues();
  for (var i = 1; i < all.length; i++) {
    if (all[i][0] === data.line_uid) {
      if (data.phone || data.name) {
        sheet.getRange(i + 1, 2, 1, 2).setValues([[data.phone || all[i][1], data.name || all[i][2]]]);
      }
      return {status: "updated"};
    }
  }
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([data.line_uid, data.phone || "", data.name || "", data.display_name || "", data.memo || "", now, ""]);
  return {status: "registered"};
}

// ── 統計 ────────────────────────────────────────────────
function getStats() {
  var cs = getSheet("カウンセリング記録").getDataRange().getValues();
  var ll = getSheet("LINE配信ログ").getDataRange().getValues();
  var lf = getSheet("LINE友だち").getDataRange().getValues();
  return {
    counseling_count: Math.max(0, cs.length - 1),
    line_log_count:   Math.max(0, ll.length - 1),
    line_friends:     Math.max(0, lf.length - 1)
  };
}

// ── レスポンス ───────────────────────────────────────────
function resp(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
