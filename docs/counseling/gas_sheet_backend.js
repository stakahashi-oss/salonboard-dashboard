var SECRET_KEY = "ssin2026";
var LINE_TOKEN = "E0gasK7zfaVSi5SEFzmvbvZLOwAjvyxEatqHUzv2cFhIqNE4Pg8R8i5/139d9oKI6uExBLGieIqgN36szq1dWEZ5qXxU8T8paVtFhkBOwKESOZRb+muKxCmy8mrI1WyT8/VyJBsXpyYU+CKtRLo8uAdB04t89/1O/w1cDnyilFU=";
var RESERVATION_SS_ID = "1Uwvhc1S_4gLStUiWBp8M_x8cDZBbu7VpMuskkpA8zXg";

var COUNSELING_FORM_URL = "https://stakahashi-oss.github.io/salonboard-dashboard/counseling/";

// ══════════════════════════════════════════════════════════
//  エントリポイント
// ══════════════════════════════════════════════════════════
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.events) return handleLineWebhook(body);
    if (body.key !== SECRET_KEY) return resp({error: "unauthorized"});
    var action = body.action;
    if (action === "save_counseling")  return resp(saveCounseling(body.data));
    if (action === "log_line")         return resp(logLine(body.data));
    if (action === "register_friend")  return resp(registerFriend(body.data));
    if (action === "get_line_friends") return resp(getLineFriends());
    if (action === "update_setting")   return resp(updateSetting(body.key_name, body.value));
    if (action === "send_push")        return resp(sendPush(body.line_uid, body.message));
    if (action === "send_flex")        return resp(sendFlex(body.line_uid, body.flex));
    if (action === "schedule_broadcast") return resp(scheduleBroadcast(body));
    if (action === "cancel_scheduled") return resp(cancelScheduled(body.id));
    if (action === "reset_trigger")    return resp(resetTrigger());
    if (action === "save_talk")        return resp(saveTalk(body.data));
    if (action === "get_talks")        return resp(getTalks(body.line_uid));
    if (action === "tag_friend")         return resp(tagFriend(body.line_uid, body.tags));
    if (action === "create_tag")         return resp(createTag(body.tag_name, body.color));
    if (action === "delete_tag")         return resp(deleteTag(body.tag_name));
    if (action === "send_image")         return resp(sendImage(body.line_uid, body.image_url, body.caption));
    if (action === "log_conversion")     return resp(logConversion(body.broadcast_id, body.line_uid, body.url));
    if (action === "send_broadcast_all") return resp(sendBroadcastAll(body));
    return resp({error: "unknown action"});
  } catch(err) {
    return resp({error: err.toString()});
  }
}

function doGet(e) {
  var key = e.parameter.key;
  var act = e.parameter.action;
  if (key !== SECRET_KEY) return resp({error: "unauthorized"});
  if (act === "get_all")              return resp(getAllCounseling());
  if (act === "get_stats")            return resp(getStats());
  if (act === "search_phone")         return resp(searchByPhone(e.parameter.phone));
  if (act === "get_line_friends")     return resp(getLineFriends());
  if (act === "get_settings")         return resp(getSettings());
  if (act === "get_scheduled")        return resp(getScheduledBroadcasts());
  if (act === "get_talks_list")       return resp(getTalksList());
  if (act === "get_talks")            return resp(getTalks(e.parameter.line_uid));
  if (act === "get_customer_profile") return resp(getCustomerProfile(e.parameter.line_uid));
  if (act === "get_tags")             return resp(getTags());
  if (act === "get_conversions")      return resp(getConversions(e.parameter.broadcast_id));
  if (act === "get_broadcast_stats")  return resp(getBroadcastStats());
  return resp({error: "unknown action"});
}

// ══════════════════════════════════════════════════════════
//  LINE Webhook（友だち追加）
// ══════════════════════════════════════════════════════════
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
    + "ご不明点はこちらのLINE\u3078\u304A\u6C17\u8EFD\u306B\uD83C\uDF38";
  pushToLine(userId, message);
}

// ══════════════════════════════════════════════════════════
//  スプレッドシート管理
// ══════════════════════════════════════════════════════════
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
    "LINE友だち": ["LINE_UID","電話番号","お名前","LINE表示名","タグ","メモ","登録日時","最終来店日"],
    "トーク履歴": ["ログID","日時","LINE_UID","お名前","方向","内容"],
    "設定": ["キー","値"],
    "配信スケジュール": ["配信ID","作成日時","配信予定日時","種別","タグ","メッセージ","FlexJSON","ステータス","配信数","クリック数","画像URL"],
    "タグマスタ": ["タグ名","色","作成日時"],
    "コンバージョンログ": ["ログID","日時","配信ID","LINE_UID","クリックURL"]
  };
  var colorMap = {
    "カウンセリング記録": "#00b900",
    "LINE配信ログ": "#1a73e8",
    "LINE友だち": "#0d7a0d",
    "トーク履歴": "#e67e22",
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
    // 基本設定
    sheet.appendRow(["店舗名", "SSIN STUDIO"]);
    sheet.appendRow(["LINE公式アカウント", "@027qvfqz"]);
    sheet.appendRow(["送信時間", "9"]);
    // トリガー有効/無効
    sheet.appendRow(["有効_来店前リマインド", "ON"]);
    sheet.appendRow(["有効_会計後お礼", "ON"]);
    sheet.appendRow(["有効_キャンセル再予約", "ON"]);
    sheet.appendRow(["有効_ステップ14日", "ON"]);
    sheet.appendRow(["有効_ステップ30日", "ON"]);
    sheet.appendRow(["有効_ステップ60日", "ON"]);
    // タイミング
    sheet.appendRow(["リマインド_来店前日数", "2"]);
    sheet.appendRow(["タイミング_フォロー2", "14"]);
    sheet.appendRow(["タイミング_フォロー3", "30"]);
    sheet.appendRow(["タイミング_フォロー4", "60"]);
    // メッセージテンプレート
    sheet.appendRow(["メッセージ_来店前リマインド",
      "{store}です\uD83C\uDF38\n\n{name}様、来店のご予約ありがとうございます\u2728\n\n\uD83D\uDCC5 来店日時: {visit_date}\n\u23F0 開始時間: {start_time}\n\uD83D\uDC86 メニュー: {menu}\n\nご来店をお待ちしております\uD83D\uDE0A\n変更・キャンセルはこちらのLINEへ\uD83D\uDCF1"
    ]);
    sheet.appendRow(["メッセージ_お礼",
      "本日はご来店いただきありがとうございました\uD83D\uDE4F\n{store}スタッフ一同より\n\n{name}様にご満足いただけましたでしょうか？\u2728\n\n\u27A1\uFE0F 次回のおすすめ\n\u300C{next_menu}\u300D\n目安は{next_timing}ごろです\uD83D\uDCC5\n\nまたのご来店をお待ちしております\uD83C\uDF38\nご予約・ご相談はこちらのLINEへ\uD83D\uDCF1"
    ]);
    sheet.appendRow(["メッセージ_14日後",
      "{store}です\uD83D\uDCAC\n\nご来店から2週間が経ちました\u2728\nまつげの状態はいかがでしょうか？\n\nそろそろメンテナンスの時期が近づいています\uD83D\uDE0A\nお気軽にご予約ください\uD83D\uDCC5"
    ]);
    sheet.appendRow(["メッセージ_30日後",
      "{store}です\uD83C\uDF38\n\nご来店から1ヶ月が経ちました\u2728\nそろそろ整える時期です\uD83D\uDE0A\n\n今月もご来店いただけると嬉しいです！\nご予約はこちらのLINEへ\uD83D\uDCF1"
    ]);
    sheet.appendRow(["メッセージ_60日後",
      "{store}です\uD83D\uDC9D\n\nご来店から2ヶ月が経ちました！\n{name}様にまた会いたいなとご連絡しました\uD83D\uDE0A\n\nぜひまたご来店ください\u2728\nご予約・ご相談はこちらのLINEへ\uD83C\uDF38"
    ]);
    sheet.appendRow(["メッセージ_キャンセル再予約",
      "{store}です\uD83D\uDC9D\n\n{name}様、このたびはご予約をキャンセルされたとのこと承知いたしました\uD83D\uDE4F\n\nまたご都合がよろしい時にぜひご来店ください\u2728\n\nご予約・ご相談はいつでもこちらのLINEへ\uD83C\uDF38"
    ]);
  }
}

// ══════════════════════════════════════════════════════════
//  カウンセリング保存
// ══════════════════════════════════════════════════════════
function saveCounseling(data) {
  var sheet = getSheet("カウンセリング記録");
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  var id = "C" + new Date().getTime();
  var lineUid = data.line_uid || findLineUidByPhone(data.phone || "");
  var lineSent = "未送信";

  if (lineUid) {
    var msg = buildFollowMessage("お礼", {
      name: data.name || "お客様",
      store: data.store || "当店",
      nextMenu: data.next_menu || "",
      nextTiming: data.next_timing || ""
    });
    if (msg) {
      var ok = pushToLine(lineUid, msg);
      lineSent = ok ? "送信済み" : "送信失敗";
      if (ok) {
        logLine({phone: data.phone || "", name: data.name || "", line_uid: lineUid,
                 type: "お礼", content: "カウンセリング保存時自動送信", status: "成功", error: ""});
      }
    }
  }

  // LINE友だちシートに電話番号・名前を逆引きで更新
  if (lineUid && data.phone) {
    var friendSheet = getSheet("LINE友だち");
    var friendData = friendSheet.getDataRange().getValues();
    for (var fi = 1; fi < friendData.length; fi++) {
      if (friendData[fi][0] === lineUid) {
        if (!friendData[fi][1]) friendSheet.getRange(fi + 1, 2).setValue(data.phone);
        if (!friendData[fi][2]) friendSheet.getRange(fi + 1, 3).setValue(data.name || "");
        break;
      }
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

// ══════════════════════════════════════════════════════════
//  予約SSヘルパー（仕様書の列定義に準拠）
//  A:予約番号 B:ステータス C:店舗名 E:スタッフ G:来店日(YYYYMMDD)
//  H:開始時間(HHMM) L:メニュー N:お名前 O:電話番号 U:初回
// ══════════════════════════════════════════════════════════
function getReservationSheet() {
  var ss = SpreadsheetApp.openById(RESERVATION_SS_ID);
  return ss.getSheets()[0];
}

function getReservationData() {
  return getReservationSheet().getDataRange().getValues();
}

function getChangeHistorySheet() {
  var ss = SpreadsheetApp.openById(RESERVATION_SS_ID);
  return ss.getSheetByName("変更履歴");
}

function findLineUidByPhone(phone) {
  if (!phone) return "";
  var norm = normalizePhone(phone);
  var sheet = getSheet("LINE友だち");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (normalizePhone(String(data[i][1])) === norm && data[i][0]) {
      return String(data[i][0]);
    }
  }
  return "";
}

function getReservationInfoByReservationId(reservationId) {
  if (!reservationId) return null;
  try {
    var data = getReservationData();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(reservationId)) {
        return {
          phone: String(data[i][14]),
          name:  String(data[i][13]),
          store: String(data[i][2])
        };
      }
    }
  } catch(e) {}
  return null;
}

function getCounselingLatestByPhone(phone) {
  if (!phone) return null;
  var norm = normalizePhone(phone);
  var sheet = getSheet("カウンセリング記録");
  var data = sheet.getDataRange().getValues();
  var latest = null;
  for (var i = 1; i < data.length; i++) {
    if (normalizePhone(String(data[i][5])) === norm) {
      latest = {next_menu: String(data[i][15]), next_timing: String(data[i][16])};
    }
  }
  return latest;
}

function normalizePhone(phone) {
  return String(phone).replace(/-/g, "");
}

function formatVisitDate(yyyymmdd) {
  var s = String(yyyymmdd);
  if (s.length === 8) return s.substring(0, 4) + "/" + s.substring(4, 6) + "/" + s.substring(6, 8);
  return s;
}

function formatStartTime(hhmm) {
  var s = String(hhmm).padStart(4, "0");
  return s.substring(0, 2) + ":" + s.substring(2, 4);
}

// ══════════════════════════════════════════════════════════
//  自動フォロー（毎日トリガー実行）
//  1. 来店前リマインド（来店N日前）
//  2. 会計後お礼（昨日の 会計済み）
//  3. キャンセル再予約（昨日の キャンセル）
//  4. ステップ配信（14/30/60日後）
// ══════════════════════════════════════════════════════════
function dailyFollowUp() {
  checkPreVisitReminders();
  checkPostCheckoutMessages();
  checkCancellationFollowup();
  checkStepMessages();
}

// ── 1. 来店前リマインド ───────────────────────────────────
function checkPreVisitReminders() {
  if (getSetting("有効_来店前リマインド") === "OFF") return;
  var days = parseInt(getSetting("リマインド_来店前日数") || "2");
  var targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);
  var targetStr = Utilities.formatDate(targetDate, "Asia/Tokyo", "yyyyMMdd");

  try {
    var data = getReservationData();
    for (var i = 1; i < data.length; i++) {
      var row      = data[i];
      var visitDate = String(row[6]);   // G列 YYYYMMDD
      var status    = String(row[1]);   // B列
      var phone     = String(row[14]);  // O列
      var name      = String(row[13]);  // N列
      var store     = String(row[2]);   // C列
      var startTime = String(row[7]);   // H列 HHMM
      var menu      = String(row[11]);  // L列

      if (visitDate !== targetStr) continue;
      if (status.indexOf("キャンセル") !== -1) continue;

      var lineUid = findLineUidByPhone(phone);
      if (!lineUid) continue;

      var typeKey = "来店前リマインド_" + visitDate;
      if (isAlreadySent(phone, typeKey)) continue;

      var msg = buildReminderMessage({
        name: name, store: store,
        visitDate: formatVisitDate(visitDate),
        startTime: formatStartTime(startTime),
        menu: menu
      });
      var ok = pushToLine(lineUid, msg);
      logLine({phone: phone, name: name, line_uid: lineUid,
               type: typeKey, content: msg.substring(0, 80),
               status: ok ? "成功" : "失敗", error: ""});
    }
  } catch(e) {
    Logger.log("checkPreVisitReminders error: " + e.toString());
  }
}

// ── 2. 会計後お礼（カウンセリング未送信の顧客向け）───────
function checkPostCheckoutMessages() {
  if (getSetting("有効_会計後お礼") === "OFF") return;
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var yesterdayStr = Utilities.formatDate(yesterday, "Asia/Tokyo", "yyyyMMdd");

  try {
    var data = getReservationData();
    for (var i = 1; i < data.length; i++) {
      var row      = data[i];
      var status    = String(row[1]);
      var visitDate = String(row[6]);
      var phone     = String(row[14]);
      var name      = String(row[13]);
      var store     = String(row[2]);

      if (status !== "会計済み") continue;
      if (visitDate !== yesterdayStr) continue;

      var lineUid = findLineUidByPhone(phone);
      if (!lineUid) continue;

      // カウンセリング保存時にすでに送信済みの場合はスキップ
      if (isAlreadySent(phone, "お礼")) continue;

      var counseling  = getCounselingLatestByPhone(phone);
      var nextMenu    = counseling ? counseling.next_menu    : "";
      var nextTiming  = counseling ? counseling.next_timing  : "";

      var msg = buildFollowMessage("お礼", {name: name, store: store, nextMenu: nextMenu, nextTiming: nextTiming});
      if (!msg) continue;

      var ok = pushToLine(lineUid, msg);
      logLine({phone: phone, name: name, line_uid: lineUid,
               type: "お礼", content: msg.substring(0, 80),
               status: ok ? "成功" : "失敗", error: ""});
    }
  } catch(e) {
    Logger.log("checkPostCheckoutMessages error: " + e.toString());
  }
}

// ── 3. キャンセル再予約促進 ──────────────────────────────
function checkCancellationFollowup() {
  if (getSetting("有効_キャンセル再予約") === "OFF") return;
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var yesterdayStr = Utilities.formatDate(yesterday, "Asia/Tokyo", "yyyy-MM-dd");

  try {
    var sheet = getChangeHistorySheet();
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      var row        = data[i];
      var detectedAt  = String(row[0]);   // A列 検知日時
      var reservId    = String(row[1]);   // B列 予約番号
      var changeType  = String(row[2]);   // C列 変更種別
      var storeName   = String(row[3]);   // D列
      var customerName = String(row[4]);  // E列

      if (!detectedAt.startsWith(yesterdayStr)) continue;
      if (changeType.indexOf("キャンセル") === -1) continue;

      // 予約一覧から電話番号を取得
      var info = getReservationInfoByReservationId(reservId);
      var phone = info ? info.phone : "";
      var name  = info ? info.name  : customerName;
      var store = info ? info.store : storeName;

      if (!phone) continue;

      var lineUid = findLineUidByPhone(phone);
      if (!lineUid) continue;

      var typeKey = "キャンセル再予約_" + detectedAt.substring(0, 10);
      if (isAlreadySent(phone, typeKey)) continue;

      var msg = buildCancellationMessage({name: name, store: store});
      var ok = pushToLine(lineUid, msg);
      logLine({phone: phone, name: name, line_uid: lineUid,
               type: typeKey, content: msg.substring(0, 80),
               status: ok ? "成功" : "失敗", error: ""});
    }
  } catch(e) {
    Logger.log("checkCancellationFollowup error: " + e.toString());
  }
}

// ── 4. ステップ配信（来店後 14/30/60日）──────────────────
function checkStepMessages() {
  var sheet = getSheet("カウンセリング記録");
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var timing2 = parseInt(getSetting("タイミング_フォロー2") || "14");
  var timing3 = parseInt(getSetting("タイミング_フォロー3") || "30");
  var timing4 = parseInt(getSetting("タイミング_フォロー4") || "60");
  var en2 = getSetting("有効_ステップ14日") !== "OFF";
  var en3 = getSetting("有効_ステップ30日") !== "OFF";
  var en4 = getSetting("有効_ステップ60日") !== "OFF";

  var sent = 0;
  for (var i = 1; i < data.length; i++) {
    var row       = data[i];
    var visitRaw  = row[3];
    var phone     = String(row[5]);
    var name      = String(row[6]);
    var store     = String(row[2]);
    var nextMenu  = String(row[15]);
    var nextTiming = String(row[16]);
    var lineUid   = String(row[17]);

    if (!visitRaw || !lineUid || lineUid === "") continue;

    var visitDate = new Date(visitRaw);
    visitDate.setHours(0, 0, 0, 0);
    var daysAfter = Math.round((today - visitDate) / 86400000);

    var msgType = null;
    if (en2 && daysAfter === timing2 && !isAlreadySent(phone, "ステップ14日")) msgType = "ステップ14日";
    if (en3 && daysAfter === timing3 && !isAlreadySent(phone, "ステップ30日")) msgType = "ステップ30日";
    if (en4 && daysAfter === timing4 && !isAlreadySent(phone, "ステップ60日")) msgType = "ステップ60日";

    if (!msgType) continue;

    var msg = buildFollowMessage(msgType, {name: name, store: store, nextMenu: nextMenu, nextTiming: nextTiming});
    if (!msg) continue;

    var ok = pushToLine(lineUid, msg);
    logLine({phone: phone, name: name, line_uid: lineUid,
             type: msgType, content: msg.substring(0, 80),
             status: ok ? "成功" : "失敗", error: ""});
    if (ok) sent++;
  }
  Logger.log("ステップ配信完了: " + sent + "件");
}

// ══════════════════════════════════════════════════════════
//  メッセージビルダー
// ══════════════════════════════════════════════════════════
function buildReminderMessage(d) {
  var name = d.name || "お客様";
  var store = d.store || "当店";
  var template = getSetting("メッセージ_来店前リマインド");
  if (template) {
    return template
      .replace(/\{name\}/g,       name)
      .replace(/\{store\}/g,      store)
      .replace(/\{visit_date\}/g, d.visitDate || "")
      .replace(/\{start_time\}/g, d.startTime || "")
      .replace(/\{menu\}/g,       d.menu      || "");
  }
  return store + "です\uD83C\uDF38\n\n" + name + "様、来店のご予約ありがとうございます\u2728\n\n"
    + "\uD83D\uDCC5 来店日時: " + (d.visitDate || "") + "\n"
    + "\u23F0 開始時間: " + (d.startTime || "") + "\n"
    + "\uD83D\uDC86 メニュー: " + (d.menu || "") + "\n\n"
    + "ご来店をお待ちしております\uD83D\uDE0A\n変更はこちらのLINEへ\uD83D\uDCF1";
}

function buildCancellationMessage(d) {
  var name = d.name || "お客様";
  var store = d.store || "当店";
  var template = getSetting("メッセージ_キャンセル再予約");
  if (template) {
    return template
      .replace(/\{name\}/g,  name)
      .replace(/\{store\}/g, store);
  }
  return store + "です\uD83D\uDC9D\n\n" + name + "様、キャンセルのご連絡ありがとうございます\uD83D\uDE4F\n\n"
    + "またご都合がよろしい時にぜひご来店ください\u2728\n"
    + "ご予約はこちらのLINEへ\uD83C\uDF38";
}

function buildFollowMessage(type, d) {
  var name      = d.name      || "お客様";
  var store     = d.store     || "当店";
  var nextMenu  = d.nextMenu  || "";
  var nextTiming = d.nextTiming || "";

  var templateKey = null;
  if (type === "お礼")         templateKey = "メッセージ_お礼";
  if (type === "ステップ14日") templateKey = "メッセージ_14日後";
  if (type === "ステップ30日") templateKey = "メッセージ_30日後";
  if (type === "ステップ60日") templateKey = "メッセージ_60日後";

  if (templateKey) {
    var template = getSetting(templateKey);
    if (template) {
      return template
        .replace(/\{name\}/g,        name)
        .replace(/\{store\}/g,       store)
        .replace(/\{next_menu\}/g,   nextMenu)
        .replace(/\{next_timing\}/g, nextTiming);
    }
  }

  // フォールバック
  if (type === "お礼") {
    var msg = "本日はご来店いただきありがとうございました\uD83D\uDE4F\n" + store + "です\u2728\n\n" + name + "様にご満足いただけましたでしょうか？";
    if (nextMenu) {
      msg += "\n\n\u27A1\uFE0F 次回のおすすめ\n\u300C" + nextMenu + "\u300D";
      if (nextTiming) msg += "\n目安は" + nextTiming + "ごろ\uD83D\uDCC5";
    }
    msg += "\n\nまたのご来店をお待ちしております\uD83C\uDF38\nご予約はこちらのLINEへ\uD83D\uDCF1";
    return msg;
  }
  if (type === "ステップ14日") return store + "です\uD83D\uDCAC\n\nご来店から2週間が経ちました\u2728\nそろそろメンテナンスの時期です\uD83D\uDE0A\nお気軽にご予約ください\uD83D\uDCC5";
  if (type === "ステップ30日") return store + "です\uD83C\uDF38\n\nご来店から1ヶ月が経ちました\u2728\nそろそろ整える時期です\uD83D\uDE0A\n\n今月もご来店いただけると嬉しいです！\nご予約はこちらのLINEへ\uD83D\uDCF1";
  if (type === "ステップ60日") return store + "です\uD83D\uDC9D\n\nご来店から2ヶ月が経ちました！\n" + name + "様にまた会いたいなとご連絡しました\uD83D\uDE0A\n\nぜひまたご来店ください\u2728\nご予約はこちらのLINEへ\uD83C\uDF38";
  return null;
}

// ══════════════════════════════════════════════════════════
//  配信済みチェック / LINE送信
// ══════════════════════════════════════════════════════════
function isAlreadySent(phone, type) {
  var norm = normalizePhone(phone);
  var sheet = getSheet("LINE配信ログ");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (normalizePhone(String(data[i][2])) === norm && String(data[i][5]) === type) {
      return true;
    }
  }
  return false;
}

function pushToLine(lineUid, text) {
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {Authorization: "Bearer " + LINE_TOKEN},
    payload: JSON.stringify({to: lineUid, messages: [{type: "text", text: text}]}),
    muteHttpExceptions: true
  };
  try {
    var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
    var code = res.getResponseCode();
    if (code !== 200) {
      Logger.log("LINE API error: " + code + " " + res.getContentText());
    }
    return code === 200;
  } catch(e) {
    Logger.log("pushToLine exception: " + e);
    return false;
  }
}

function pushToLineDebug(lineUid, text) {
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {Authorization: "Bearer " + LINE_TOKEN},
    payload: JSON.stringify({to: lineUid, messages: [{type: "text", text: text}]}),
    muteHttpExceptions: true
  };
  var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
  return {code: res.getResponseCode(), body: res.getContentText()};
}

// ══════════════════════════════════════════════════════════
//  設定シート操作
// ══════════════════════════════════════════════════════════
function getSetting(key) {
  var sheet = getSheet("設定");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) return String(data[i][1]);
  }
  return null;
}

function getSettings() {
  var sheet = getSheet("設定");
  var data = sheet.getDataRange().getValues();
  var result = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) result[String(data[i][0])] = String(data[i][1]);
  }
  return {settings: result};
}

function updateSetting(key, value) {
  if (!key) return {error: "key required"};
  var sheet = getSheet("設定");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return {status: "updated", key: key};
    }
  }
  sheet.appendRow([key, value]);
  return {status: "created", key: key};
}

// ══════════════════════════════════════════════════════════
//  トリガー設定
// ══════════════════════════════════════════════════════════
function setupDailyTrigger() {
  var hour = parseInt(getSetting("送信時間") || "9");
  if (isNaN(hour) || hour < 0 || hour > 23) hour = 9;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "dailyFollowUp") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("dailyFollowUp")
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();
  Logger.log("トリガー設定完了（毎日 " + hour + "時）");
}

function resetTrigger() {
  setupDailyTrigger();
  var hour = getSetting("送信時間") || "9";
  return {status: "ok", message: "トリガーを再設定しました（毎日 " + hour + "時）"};
}

// ══════════════════════════════════════════════════════════
//  カウンセリング記録取得
// ══════════════════════════════════════════════════════════
function getAllCounseling() {
  var sheet = getSheet("カウンセリング記録");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {records: []};
  var headers = data[0];
  var records = [];
  for (var i = data.length - 1; i >= 1; i--) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
    records.push(obj);
  }
  return {records: records};
}

// 電話番号でカウンセリング履歴＋予約情報を検索
function searchByPhone(phone) {
  var norm = normalizePhone(phone || "");

  // カウンセリング履歴
  var sheet = getSheet("カウンセリング記録");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var past = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (normalizePhone(String(data[i][5])) === norm) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
      past.push(obj);
    }
  }

  // 予約一覧から最新5件（仕様書準拠: O列=電話番号, G列=来店日 etc.）
  var reservations = [];
  try {
    var rdata = getReservationData();
    for (var r = 1; r < rdata.length; r++) {
      var row = rdata[r];
      if (normalizePhone(String(row[14])) === norm) {
        reservations.push({
          reservation_id: String(row[0]),
          status:         String(row[1]),
          store:          String(row[2]),
          staff:          String(row[4]),
          visit_date:     formatVisitDate(String(row[6])),
          start_time:     formatStartTime(String(row[7])),
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

// ══════════════════════════════════════════════════════════
//  LINE友だち管理
// ══════════════════════════════════════════════════════════
function getLineFriends() {
  var sheet = getSheet("LINE友だち");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {friends: []};
  var headers = data[0];
  var friends = [];
  for (var i = data.length - 1; i >= 1; i--) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
    friends.push(obj);
  }
  return {friends: friends};
}

function registerFriend(data) {
  var sheet = getSheet("LINE友だち");
  var all = sheet.getDataRange().getValues();
  for (var i = 1; i < all.length; i++) {
    if (all[i][0] === data.line_uid) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[data.phone || all[i][1], data.name || all[i][2], data.display_name || all[i][3]]]);
      return {status: "updated"};
    }
  }
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([data.line_uid, data.phone || "", data.name || "", data.display_name || "", data.tag || "", data.memo || "", now, ""]);
  return {status: "registered"};
}

// ══════════════════════════════════════════════════════════
//  個別LINE送信 / ログ
// ══════════════════════════════════════════════════════════
function sendPush(lineUid, message) {
  if (!lineUid || !message) return {error: "line_uid and message required"};
  lineUid = String(lineUid).trim().replace(/^'+|'+$/g, "");
  var ok = pushToLine(lineUid, message);
  if (ok) {
    logLine({phone: "", name: "", line_uid: lineUid,
             type: "個別送信", content: message.substring(0, 80), status: "成功", error: ""});
    saveTalk({line_uid: lineUid, direction: "送信", content: message.substring(0, 200)});
    return {status: "ok"};
  }
  return {status: "error", error: "LINE送信失敗"};
}

// ══════════════════════════════════════════════════════════
//  スケジュール配信
// ══════════════════════════════════════════════════════════
function scheduleBroadcast(data) {
  var sheet = getSheet("配信スケジュール");
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  var id = "B" + new Date().getTime();
  sheet.appendRow([id, now, data.schedule_time, data.type || "text", data.tag || "", data.message || "", data.flex || "", "予約済み"]);
  return {status: "ok", id: id};
}

function cancelScheduled(id) {
  var sheet = getSheet("配信スケジュール");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 8).setValue("取消済み");
      return {status: "ok"};
    }
  }
  return {status: "not_found"};
}

function getScheduledBroadcasts() {
  var sheet = getSheet("配信スケジュール");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {list: []};
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] !== "予約済み") continue;
    var msg = String(data[i][5] || data[i][6] || "");
    list.push({
      id: data[i][0],
      schedule_time: data[i][2],
      type: data[i][3],
      tag: data[i][4],
      preview: msg.substring(0, 30) + (msg.length > 30 ? "…" : "")
    });
  }
  return {list: list};
}

function checkScheduledBroadcasts() {
  var sheet = getSheet("配信スケジュール");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;
  var now = new Date();
  var friendSheet = getSheet("LINE友だち");
  var friends = friendSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][7] !== "予約済み") continue;
    var schedTime = new Date(data[i][2]);
    if (schedTime > now) continue;

    // 送信対象を絞り込み
    var tag = data[i][4];
    var targets = [];
    for (var j = 1; j < friends.length; j++) {
      var uid = String(friends[j][0]).trim();
      if (!uid) continue;
      if (tag) {
        var tags = String(friends[j][4] || "").split(",").map(function(t){ return t.trim(); });
        if (tags.indexOf(tag) === -1) continue;
      }
      targets.push(uid);
    }

    var type = data[i][3];
    var message = data[i][5];
    var flexJson = data[i][6];

    for (var k = 0; k < targets.length; k++) {
      try {
        if (type === "coupon" && flexJson) {
          sendFlex(targets[k], flexJson);
        } else {
          pushToLine(targets[k], message);
        }
      } catch(e) { Logger.log(e); }
    }
    sheet.getRange(i + 1, 8).setValue("送信済み");
  }
}

function sendFlex(lineUid, flexJson) {
  if (!lineUid || !flexJson) return {error: "line_uid and flex required"};
  lineUid = String(lineUid).trim().replace(/^'+|'+$/g, "");
  var flexMsg = typeof flexJson === "string" ? JSON.parse(flexJson) : flexJson;
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {Authorization: "Bearer " + LINE_TOKEN},
    payload: JSON.stringify({to: lineUid, messages: [flexMsg]}),
    muteHttpExceptions: true
  };
  try {
    var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
    var ok = res.getResponseCode() === 200;
    if (ok) saveTalk({line_uid: lineUid, direction: "送信", content: "[クーポン送信]"});
    return ok ? {status: "ok"} : {status: "error", error: "LINE送信失敗"};
  } catch(e) {
    return {status: "error", error: e.toString()};
  }
}

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

// ══════════════════════════════════════════════════════════
//  統計
// ══════════════════════════════════════════════════════════
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

// ── トーク履歴保存（受信メッセージ）─────────────────────
function saveTalk(data) {
  var sheet = getSheet("トーク履歴");
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  var id = "T" + new Date().getTime();
  // LINE友だちから名前を取得
  var name = "";
  if (data.line_uid) {
    var friends = getSheet("LINE友だち").getDataRange().getValues();
    for (var i = 1; i < friends.length; i++) {
      if (String(friends[i][0]) === data.line_uid) {
        name = String(friends[i][2] || friends[i][3] || "");
        break;
      }
    }
  }
  sheet.appendRow([id, now, data.line_uid || "", name, data.direction || "受信", data.content || ""]);
  return {status: "ok", id: id};
}

// ── トーク履歴取得（ユーザー別）──────────────────────────
function getTalks(lineUid) {
  var sheet = getSheet("トーク履歴");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {talks: []};
  var talks = [];
  for (var i = 1; i < data.length; i++) {
    if (!lineUid || String(data[i][2]) === String(lineUid)) {
      talks.push({
        id:       String(data[i][0]),
        datetime: String(data[i][1]),
        line_uid: String(data[i][2]),
        name:     String(data[i][3]),
        direction: String(data[i][4]),
        content:  String(data[i][5])
      });
    }
  }
  return {talks: talks};
}

// ── トーク一覧（ユーザーごとの最新メッセージ）────────────
function getTalksList() {
  var sheet = getSheet("トーク履歴");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {list: []};
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var uid = String(data[i][2]);
    map[uid] = {
      line_uid: uid,
      name:     String(data[i][3]),
      last_msg: String(data[i][5]),
      last_at:  String(data[i][1]),
      direction: String(data[i][4])
    };
  }
  var list = [];
  for (var k in map) list.push(map[k]);
  list.sort(function(a, b) { return b.last_at.localeCompare(a.last_at); });
  return {list: list};
}

// ── タグ付け ────────────────────────────────────────────
function tagFriend(lineUid, tags) {
  if (!lineUid) return {error: "line_uid required"};
  var sheet = getSheet("LINE友だち");
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var tagColIdx = headers.indexOf("タグ");
  if (tagColIdx === -1) {
    // タグ列がなければ追加
    var lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue("タグ");
    tagColIdx = lastCol;
  } else {
    tagColIdx = tagColIdx; // 0-based index
  }
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(lineUid)) {
      sheet.getRange(i + 1, tagColIdx + 1).setValue(tags);
      return {status: "ok"};
    }
  }
  return {error: "friend not found"};
}

// ══════════════════════════════════════════════════════════
//  タグマスタ管理
// ══════════════════════════════════════════════════════════
function getTags() {
  var sheet = getSheet("タグマスタ");
  var data = sheet.getDataRange().getValues();
  var tags = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) tags.push({name: String(data[i][0]), color: String(data[i][1] || "#00b900"), created_at: String(data[i][2] || "")});
  }
  return {tags: tags};
}

function createTag(tagName, color) {
  if (!tagName) return {error: "tag_name required"};
  var sheet = getSheet("タグマスタ");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === tagName) return {error: "既に存在するタグです"};
  }
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([tagName, color || "#00b900", now]);
  return {status: "ok", tag_name: tagName};
}

function deleteTag(tagName) {
  if (!tagName) return {error: "tag_name required"};
  var sheet = getSheet("タグマスタ");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === tagName) {
      sheet.deleteRow(i + 1);
      return {status: "ok"};
    }
  }
  return {error: "tag not found"};
}

// ══════════════════════════════════════════════════════════
//  画像送信
// ══════════════════════════════════════════════════════════
function sendImage(lineUid, imageUrl, caption) {
  if (!lineUid || !imageUrl) return {error: "line_uid and image_url required"};
  lineUid = String(lineUid).trim().replace(/^'+|'+$/g, "");
  var messages = [{
    type: "image",
    originalContentUrl: imageUrl,
    previewImageUrl: imageUrl
  }];
  if (caption) messages.push({type: "text", text: caption});
  var options = {
    method: "post", contentType: "application/json",
    headers: {Authorization: "Bearer " + LINE_TOKEN},
    payload: JSON.stringify({to: lineUid, messages: messages}),
    muteHttpExceptions: true
  };
  try {
    var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
    var ok = res.getResponseCode() === 200;
    if (ok) saveTalk({line_uid: lineUid, direction: "送信", content: "[画像送信]" + (caption ? " " + caption : "")});
    return ok ? {status: "ok"} : {status: "error", error: res.getContentText()};
  } catch(e) {
    return {status: "error", error: e.toString()};
  }
}

// ══════════════════════════════════════════════════════════
//  コンバージョン追跡
// ══════════════════════════════════════════════════════════
function logConversion(broadcastId, lineUid, url) {
  var sheet = getSheet("コンバージョンログ");
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  var id = "CV" + new Date().getTime();
  sheet.appendRow([id, now, broadcastId || "", lineUid || "", url || ""]);

  // 配信スケジュールのクリック数を更新
  if (broadcastId) {
    var sched = getSheet("配信スケジュール");
    var sdata = sched.getDataRange().getValues();
    for (var i = 1; i < sdata.length; i++) {
      if (String(sdata[i][0]) === broadcastId) {
        var current = parseInt(sdata[i][9] || 0);
        sched.getRange(i + 1, 10).setValue(current + 1);
        break;
      }
    }
  }
  return {status: "ok"};
}

function getConversions(broadcastId) {
  var sheet = getSheet("コンバージョンログ");
  var data = sheet.getDataRange().getValues();
  var logs = [];
  for (var i = 1; i < data.length; i++) {
    if (!broadcastId || String(data[i][2]) === broadcastId) {
      logs.push({id: data[i][0], datetime: data[i][1], broadcast_id: data[i][2], line_uid: data[i][3], url: data[i][4]});
    }
  }
  return {logs: logs};
}

function getBroadcastStats() {
  var sheet = getSheet("配信スケジュール");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {list: []};
  var list = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][7] === "送信済み") {
      var msg = String(data[i][5] || "");
      list.push({
        id:            String(data[i][0]),
        sent_at:       String(data[i][2]),
        type:          String(data[i][3]),
        tag:           String(data[i][4]),
        preview:       msg.substring(0, 30) + (msg.length > 30 ? "…" : ""),
        sent_count:    parseInt(data[i][8] || 0),
        click_count:   parseInt(data[i][9] || 0),
        image_url:     String(data[i][10] || "")
      });
      if (list.length >= 30) break;
    }
  }
  return {list: list};
}

// ══════════════════════════════════════════════════════════
//  一斉送信（画像・クーポン対応）
// ══════════════════════════════════════════════════════════
function sendBroadcastAll(data) {
  var tag       = data.tag || "";
  var message   = data.message || "";
  var imageUrl  = data.image_url || "";
  var broadcastId = data.broadcast_id || ("B" + new Date().getTime());

  var friendSheet = getSheet("LINE友だち");
  var friends = friendSheet.getDataRange().getValues();
  var targets = [];
  for (var j = 1; j < friends.length; j++) {
    var uid = String(friends[j][0]).trim();
    if (!uid) continue;
    if (tag) {
      var ftags = String(friends[j][4] || "").split(",").map(function(t){ return t.trim(); });
      if (ftags.indexOf(tag) === -1) continue;
    }
    targets.push(uid);
  }

  var sent = 0;
  for (var k = 0; k < targets.length; k++) {
    try {
      var messages = [];
      if (imageUrl) messages.push({type:"image", originalContentUrl:imageUrl, previewImageUrl:imageUrl});
      if (message)  messages.push({type:"text", text:message});
      if (!messages.length) continue;
      var options = {
        method:"post", contentType:"application/json",
        headers:{Authorization:"Bearer " + LINE_TOKEN},
        payload: JSON.stringify({to: targets[k], messages: messages}),
        muteHttpExceptions: true
      };
      var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
      if (res.getResponseCode() === 200) sent++;
    } catch(e) { Logger.log(e); }
  }

  // 配信スケジュールの配信数を記録
  var sched = getSheet("配信スケジュール");
  var sdata = sched.getDataRange().getValues();
  for (var si = 1; si < sdata.length; si++) {
    if (String(sdata[si][0]) === broadcastId) {
      sched.getRange(si + 1, 8).setValue("送信済み");
      sched.getRange(si + 1, 9).setValue(sent);
      break;
    }
  }
  return {status: "ok", sent: sent, total: targets.length};
}

// ══════════════════════════════════════════════════════════
//  顧客プロフィール（LINE_UID → 予約履歴・カウンセリング統合）
// ══════════════════════════════════════════════════════════
function getCustomerProfile(lineUid) {
  if (!lineUid) return {error: "line_uid required"};
  lineUid = String(lineUid).trim().replace(/^'+|'+$/g, "");

  // LINE友だち情報
  var friendSheet = getSheet("LINE友だち");
  var friends = friendSheet.getDataRange().getValues();
  var friend = null;
  var friendRowIdx = -1;
  for (var i = 1; i < friends.length; i++) {
    if (String(friends[i][0]).trim() === lineUid) {
      friend = {
        line_uid:     String(friends[i][0]),
        phone:        String(friends[i][1] || ""),
        name:         String(friends[i][2] || ""),
        display_name: String(friends[i][3] || ""),
        tags:         String(friends[i][4] || ""),
        memo:         String(friends[i][5] || ""),
        registered_at: String(friends[i][6] || ""),
        last_visit:   String(friends[i][7] || "")
      };
      friendRowIdx = i;
      break;
    }
  }
  if (!friend) return {error: "friend not found"};

  var phone = friend.phone;
  var name  = friend.name || friend.display_name;

  // 予約履歴（電話番号一致＋名前で補強照合）
  var reservations = [];
  if (phone) {
    var norm = normalizePhone(phone);
    try {
      var rdata = getReservationData();
      for (var r = 1; r < rdata.length; r++) {
        var row = rdata[r];
        if (normalizePhone(String(row[14])) !== norm) continue;
        // 名前が双方設定済みの場合のみ名前チェック（部分一致）
        var rowName = String(row[13] || "").replace(/\s/g, "");
        var myName  = name.replace(/\s/g, "");
        if (rowName && myName && rowName.indexOf(myName) === -1 && myName.indexOf(rowName) === -1) continue;
        reservations.push({
          reservation_id:  String(row[0]),
          status:          String(row[1]),
          store:           String(row[2]),
          staff:           String(row[4]),
          visit_date:      formatVisitDate(String(row[6])),
          start_time:      formatStartTime(String(row[7])),
          menu:            String(row[11]),
          coupon_category: String(row[12]),
          name:            String(row[13]),
          first_visit:     String(row[20]),
          amount:          String(row[19] || "")
        });
      }
      reservations.sort(function(a, b) {
        return b.visit_date.localeCompare(a.visit_date);
      });
    } catch(e) {
      Logger.log("getCustomerProfile reservation error: " + e);
    }
  }

  // カウンセリング履歴
  var counseling = [];
  if (phone) {
    var norm2 = normalizePhone(phone);
    var cSheet = getSheet("カウンセリング記録");
    var cData = cSheet.getDataRange().getValues();
    var cHeaders = cData[0];
    for (var c = cData.length - 1; c >= 1; c--) {
      if (normalizePhone(String(cData[c][5])) === norm2) {
        var obj = {};
        for (var j = 0; j < cHeaders.length; j++) obj[cHeaders[j]] = cData[c][j];
        counseling.push(obj);
        if (counseling.length >= 10) break;
      }
    }
  }

  // 来店回数・最終来店日を LINE友だちシートに自動更新
  var visitCount = 0;
  var lastVisit  = "";
  for (var v = 0; v < reservations.length; v++) {
    if (reservations[v].status === "会計済み") {
      visitCount++;
      if (!lastVisit) lastVisit = reservations[v].visit_date;
    }
  }
  if (lastVisit && friendRowIdx > 0) {
    friendSheet.getRange(friendRowIdx + 1, 8).setValue(lastVisit);
  }

  return {
    friend:       friend,
    reservations: reservations,
    counseling:   counseling,
    visit_count:  visitCount,
    last_visit:   lastVisit
  };
}

// ══════════════════════════════════════════════════════════
//  レスポンス
// ══════════════════════════════════════════════════════════
function resp(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
