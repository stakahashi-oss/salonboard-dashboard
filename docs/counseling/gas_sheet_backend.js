var SECRET_KEY = "ssin2026";
var SALES_SS_ID = "1B2eQ8K4oN7DgvTU3-mWF8ZShfDDVPXM8aU6GuxlWwMI";
var SALES_SHEET_GID = 50056376;
var LINE_TOKEN = "E0gasK7zfaVSi5SEFzmvbvZLOwAjvyxEatqHUzv2cFhIqNE4Pg8R8i5/139d9oKI6uExBLGieIqgN36szq1dWEZ5qXxU8T8paVtFhkBOwKESOZRb+muKxCmy8mrI1WyT8/VyJBsXpyYU+CKtRLo8uAdB04t89/1o/w1cDnyilFU=";
var RESERVATION_SS_ID = "1Uwvhc1S_4gLStUiWBp8M_x8cDZBbu7VpMuskkpA8zXg";
// 新規追加シート（売上情報 gid=670101152）
var NEW_SALES_SS_ID  = "18M2qZjIUUNWG7NWdnJX5VcguggmNFox8espJSuG6Qv0";
var NEW_SALES_GID    = 670101152;

var COUNSELING_FORM_URL = "https://salonboard-dashboard.vercel.app/counseling/";

// ══════════════════════════════════════════════════════════
//  マルチ店舗 LINE トークン管理
//  PropertiesService に JSON で保存:
//  キー "STORE_LINE_TOKENS" → {"destination_userId": {"token":"...", "secret":"...", "store":"..."}}
// ══════════════════════════════════════════════════════════
function getStoreLineToken(destination) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("STORE_LINE_TOKENS");
    if (!raw) return LINE_TOKEN;
    var map = JSON.parse(raw);
    return (map[destination] && map[destination].token) ? map[destination].token : LINE_TOKEN;
  } catch(e) { return LINE_TOKEN; }
}

function getStoreNameByDestination(destination) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty("STORE_LINE_TOKENS");
    if (!raw) return "";
    var map = JSON.parse(raw);
    return (map[destination] && map[destination].store) ? map[destination].store : "";
  } catch(e) { return ""; }
}

function saveStoreLineToken(destination, token, secret, storeName) {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty("STORE_LINE_TOKENS");
  var map = raw ? JSON.parse(raw) : {};
  map[destination] = {token: token, secret: secret, store: storeName};
  props.setProperty("STORE_LINE_TOKENS", JSON.stringify(map));
  return {status: "ok", store: storeName};
}

function getStoreLineTokens() {
  var raw = PropertiesService.getScriptProperties().getProperty("STORE_LINE_TOKENS");
  var map = raw ? JSON.parse(raw) : {};
  // tokenは返さずstore名とdestinationのみ返す（セキュリティ）
  var result = {};
  for (var dest in map) {
    result[dest] = {store: map[dest].store, has_token: !!map[dest].token, has_secret: !!map[dest].secret};
  }
  return {stores: result};
}

// ══════════════════════════════════════════════════════════
//  エントリポイント
// ══════════════════════════════════════════════════════════
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.events) return handleLineWebhook(body);
    if (body.key !== SECRET_KEY) return resp({error: "unauthorized"});
    var action = body.action;
    if (action === "save_counseling")    return resp(saveCounseling(body.data));
    if (action === "update_counseling")  return resp(updateCounseling(body.record_id, body));
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
    if (action === "delete_talk")      return resp(deleteTalk(body.talk_id));
    if (action === "delete_talks_by_uid") return resp(deleteTalksByUid(body.line_uid));
    if (action === "tag_friend")         return resp(tagFriend(body.line_uid, body.tags));
    if (action === "create_tag")         return resp(createTag(body.tag_name, body.color));
    if (action === "delete_tag")         return resp(deleteTag(body.tag_name));
    if (action === "send_image")         return resp(sendImage(body.line_uid, body.image_url, body.caption));
    if (action === "log_conversion")     return resp(logConversion(body.broadcast_id, body.line_uid, body.url));
    if (action === "send_broadcast_all") return resp(sendBroadcastAll(body));
    if (action === "upload_image")       return resp(uploadImageToDrive(body.base64, body.filename, body.mime_type));
    if (action === "import_followers")   return resp(importFollowers());
    if (action === "fix_headers")        return resp(fixAllHeaders());
    if (action === "save_auto_tag_rules") return resp(saveAutoTagRules(body.rules));
    if (action === "save_store_line_token") return resp(saveStoreLineToken(body.destination, body.token, body.secret, body.store_name));
    if (action === "run_auto_tag")          return resp(runAutoTag());
    if (action === "update_friend_memo")    return resp(updateFriendMemo(body.line_uid, body.memo));
    if (action === "save_customer_form")    return resp(saveCustomerForm(body.data));
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
  if (act === "get_customer_profile_ext") return resp(getCustomerProfileExt(e.parameter.line_uid));
  if (act === "get_visits_by_phone")  return resp(getVisitsByPhone(e.parameter.phone));
  if (act === "get_sales_by_customer") return resp(getSalesByCustomer(e.parameter.name, e.parameter.store));
  if (act === "get_tags")             return resp(getTags());
  if (act === "get_conversions")      return resp(getConversions(e.parameter.broadcast_id));
  if (act === "get_broadcast_stats")  return resp(getBroadcastStats());
  if (act === "get_step_stats")       return resp(getStepStats());
  if (act === "get_auto_tag_rules")   return resp(getAutoTagRules());
  if (act === "get_store_line_tokens") return resp(getStoreLineTokens());
  if (act === "get_sales")            return resp(getSalesData());
  if (act === "register_friend")      return resp(registerFriend({line_uid: e.parameter.line_uid, store: e.parameter.store || "", display_name: e.parameter.display_name || "", name: e.parameter.name || "", phone: e.parameter.phone || ""}));
  if (act === "link_uid_to_phone")    return resp(linkUidToPhone(e.parameter.line_uid, e.parameter.phone));
  if (act === "delete_friend")        return resp(deleteFriend(e.parameter.line_uid));
  return resp({error: "unknown action"});
}

// ══════════════════════════════════════════════════════════
//  LINE Webhook（友だち追加）
// ══════════════════════════════════════════════════════════
function handleLineWebhook(body) {
  var destination = body.destination || "";
  var token = getStoreLineToken(destination);
  var storeName = getStoreNameByDestination(destination);
  Logger.log("[Webhook] destination=" + destination + " store=" + storeName + " tokenFound=" + (token !== LINE_TOKEN));
  var events = body.events || [];
  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    Logger.log("[Webhook] eventType=" + event.type);
    if (event.type === "follow") {
      var userId = event.source.userId;
      Logger.log("[Webhook] follow userId=" + userId);
      // 挨拶はCloudflare Workerが送信済みのためGAS側では送らない
      registerFriend({line_uid: userId, phone: "", name: "", store: storeName});
    } else if (event.type === "message" && event.message.type === "text") {
      var uid = event.source.userId;
      var text = event.message.text;
      saveTalk({line_uid: uid, direction: "受信", content: text});
      // 名前＋電話番号の自動検出・登録
      var contact = parseContact(text);
      if (contact) {
        registerFriend({line_uid: uid, phone: contact.phone, name: contact.name});
        var reply = contact.name + "\u69D8\u3001\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uD83D\uDE4F\n\u304A\u540D\u524D\u3068\u96FB\u8A71\u756A\u53F7\u3092\u767B\u9332\u3057\u307E\u3057\u305F\u2728\n\u3054\u6765\u5E97\u3092\u304A\u5F85\u3061\u3057\u3066\u304A\u308A\u307E\u3059\uD83C\uDF38";
        pushToLineWithToken(uid, reply, token);
      }
    } else if (event.type === "unfollow") {
      var unfollowUid = event.source.userId;
      logLine({line_uid: unfollowUid, phone: "", name: "", type: "\u30D6\u30ED\u30C3\u30AF/\u524A\u9664", content: "", status: "\u81EA\u52D5\u8A18\u9332", error: ""});
    }
  }
  return resp({status: "ok"});
}

function parseContact(text) {
  if (!text) return null;
  var phonePattern = /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}/;
  var phoneMatch = text.match(phonePattern);
  if (!phoneMatch) return null;
  var phone = phoneMatch[0].replace(/[-\s]/g, "");
  var nameCandidate = text.replace(phoneMatch[0], "").replace(/[0-9\-\s\u3000]/g, " ").trim();
  var lines = nameCandidate.split(/[\n\r]+/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length >= 2; });
  if (!lines.length) return null;
  var name = lines.reduce(function(a, b){ return a.length >= b.length ? a : b; });
  return name ? {phone: phone, name: name} : null;
}

function sendCounselingLink(userId, token, storeName) {
  var storeParam = storeName ? "&store=" + encodeURIComponent(storeName) : "";
  var formUrl = COUNSELING_FORM_URL + "?uid=" + userId + storeParam;
  var storeLabel = storeName || "SSIN STUDIO / most eyes / LUMISS";
  var message = "友だち追加ありがとうございます！\uD83D\uDE0A\n"
    + storeLabel + " です\u2728\n\n"
    + "ご来店前に下記のカウンセリングシートにご記入いただけると\n"
    + "スムーズにご案内できます\uD83D\uDCCB\n\n"
    + "\u25BC カウンセリングシート\n" + formUrl + "\n\n"
    + "ご不明点はこちらのLINE\u3078\u304A\u6C17\u8EFD\u306B\uD83C\uDF38";
  pushToLineWithToken(userId, message, token);
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

// 既存シートのヘッダーを強制修正（データは保持）
function fixAllHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var headerMap = {
    "カウンセリング記録": ["記録ID","記録日時","店舗名","来店日","予約番号","電話番号","お名前","メニュー","担当スタッフ","施術メモ","次回提案","次回提案時期","LINE_UID","LINE送信フラグ","最終更新","住所","生年月日","職業","知ったきっかけ","選んだ理由","転店理由","転店不満内容","施術頻度","興味メニュー","初回物販商品","眉_施術歴","眉_セルフケア","眉_手術歴","眉_アレルギー","眉_肌状態","眉_カラー","眉_デザイン","眉_印象","眉_メイク","眉_SNS同意","まつ_施術歴","まつ_グルーアレルギー","まつ_手術歴","まつ_アレルギー","まつ_肌状態","まつ_目の見え方","まつ_デザイン","まつ_ホームケア","まつ_SNS同意","エクステ_グルーアレルギー","エクステ_目元トラブル","エクステ_体調","エクステ_手術歴","エクステ_アレルギー","エクステ_目の見え方","エクステ_デザイン","エクステ_カール","エクステ_SNS同意"],
    "LINE友だち": ["LINE_UID","電話番号","お名前","LINE表示名","タグ","メモ","登録日時","最終来店日","登録店舗"],
    "トーク履歴": ["ログID","日時","LINE_UID","お名前","方向","内容"]
  };
  var results = [];
  for (var name in headerMap) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) { results.push(name + ": シートなし"); continue; }
    var headers = headerMap[name];
    // 現在の1行目を取得
    var currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    // 1行目がヘッダーでなければ挿入、あればそのまま上書き
    var firstCell = String(currentHeaders[0] || "");
    if (firstCell === headers[0]) {
      // ヘッダー行を上書き（列数が足りない場合に備えて）
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      // ヘッダー行を先頭に挿入
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold").setBackground("#00b900").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    results.push(name + ": OK");
  }
  return {status: "ok", results: results};
}

function setupSheet(sheet, name) {
  var headerMap = {
    "カウンセリング記録": ["記録ID","記録日時","店舗名","来店日","予約番号","電話番号","お名前","メニュー","担当スタッフ","施術メモ","次回提案","次回提案時期","LINE_UID","LINE送信フラグ","最終更新","住所","生年月日","職業","知ったきっかけ","選んだ理由","転店理由","転店不満内容","施術頻度","興味メニュー","初回物販商品","眉_施術歴","眉_セルフケア","眉_手術歴","眉_アレルギー","眉_肌状態","眉_カラー","眉_デザイン","眉_印象","眉_メイク","眉_SNS同意","まつ_施術歴","まつ_グルーアレルギー","まつ_手術歴","まつ_アレルギー","まつ_肌状態","まつ_目の見え方","まつ_デザイン","まつ_ホームケア","まつ_SNS同意","エクステ_グルーアレルギー","エクステ_目元トラブル","エクステ_体調","エクステ_手術歴","エクステ_アレルギー","エクステ_目の見え方","エクステ_デザイン","エクステ_カール","エクステ_SNS同意"],
    "LINE配信ログ": ["ログID","送信日時","電話番号","お名前","LINE_UID","種別","内容","ステータス","エラー"],
    "LINE友だち": ["LINE_UID","電話番号","お名前","LINE表示名","タグ","メモ","登録日時","最終来店日","登録店舗"],
    "トーク履歴": ["ログID","日時","LINE_UID","お名前","方向","内容"],
    "設定": ["キー","値"],
    "配信スケジュール": ["配信ID","作成日時","配信予定日時","種別","タグ","メッセージ","FlexJSON","ステータス","配信数","クリック数","画像URL"],
    "タグマスタ": ["タグ名","色","作成日時"],
    "コンバージョンログ": ["ログID","日時","配信ID","LINE_UID","クリックURL"],
    "配信ターゲット": ["配信ID","種別","LINE_UID","送信日時","予約日時","来店日時"]
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

  // カウンセリング保存時のLINEお礼自動送信は無効化（手動送信に変更）
  // if (lineUid) {
  //   var msg = buildFollowMessage("お礼", { ... });
  //   if (msg) { pushToLineWithToken(...); }
  // }

  // LINE友だちシートに電話番号・名前を逆引きで更新
  if (lineUid && data.phone) {
    var friendSheet2 = getSheet("LINE友だち");
    var friendData = friendSheet2.getDataRange().getValues();
    var fH2 = friendData[0];
    var fc2Phone = fH2.indexOf("電話番号"); if (fc2Phone < 0) fc2Phone = 1;
    var fc2Name  = fH2.indexOf("お名前");   if (fc2Name  < 0) fc2Name  = 2;
    for (var fi = 1; fi < friendData.length; fi++) {
      if (friendData[fi][0] === lineUid) {
        if (!friendData[fi][fc2Phone]) friendSheet2.getRange(fi + 1, fc2Phone + 1).setValue(data.phone);
        if (!friendData[fi][fc2Name])  friendSheet2.getRange(fi + 1, fc2Name  + 1).setValue(data.name || "");
        break;
      }
    }
  }

  sheet.appendRow([
    id, now,
    data.store || "", data.visit_date || "", data.reservation_id || "",
    data.phone || "", data.name || "", data.menu || "", data.staff || "",
    data.treatment_memo || "", data.next_menu || "", data.next_timing || "",
    lineUid, lineSent, now,
    // 基本情報
    data.address || "", data.birthdate || "", data.job || "",
    // サロン情報
    data.source || "", data.reason || "", data.transfer || "", data.complaint || "",
    data.freq || "", data.interest || "",
    // 物販
    data.homecare_product || "",
    // 眉毛
    data.b_timing || "", data.b_self_care || "", data.b_surgery || "",
    data.b_allergy || "", data.b_skin || "", data.b_color || "",
    data.b_design || "", data.b_impression || "", data.b_makeup || "", data.b_sns || "",
    // まつ毛
    data.l_timing || "", data.l_glue || "", data.l_surgery || "",
    data.l_allergy || "", data.l_skin || "", data.l_eye_look || "",
    data.l_design || "", data.l_homecare || "", data.l_sns || "",
    // LEDエクステ
    data.e_glue || "", data.e_trouble || "", data.e_condition || "",
    data.e_surgery || "", data.e_allergy || "", data.e_eye_look || "",
    data.e_design || "", data.e_curl || "", data.e_sns || ""
  ]);
  // 自動タグ付け
  applyAutoTags(data, lineUid);
  return {status: "ok", id: id, line_sent: lineSent};
}

// ══════════════════════════════════════════════════════════
//  カウンセリング スタッフ追記（施術メモ・次回提案）
// ══════════════════════════════════════════════════════════
function updateCounseling(recordId, body) {
  if (!recordId) return {error: "record_id required"};
  var sheet = getSheet("カウンセリング記録");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idIdx   = headers.indexOf("記録ID");
  var memoIdx = headers.indexOf("施術メモ");
  var nextIdx = headers.indexOf("次回提案");
  var timingIdx = headers.indexOf("次回提案時期");
  var updatedIdx = headers.indexOf("最終更新");
  if (idIdx < 0) return {error: "記録IDカラムが見つかりません"};
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(recordId)) {
      if (memoIdx   >= 0) sheet.getRange(i+1, memoIdx+1).setValue(body.treatment_memo || "");
      if (nextIdx   >= 0) sheet.getRange(i+1, nextIdx+1).setValue(body.next_menu || "");
      if (timingIdx >= 0) sheet.getRange(i+1, timingIdx+1).setValue(body.next_timing || "");
      if (updatedIdx >= 0) sheet.getRange(i+1, updatedIdx+1).setValue(now);
      return {status: "ok"};
    }
  }
  return {error: "record not found: " + recordId};
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
  checkConversionByReservation();
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
      var ok = pushToLineWithToken(lineUid, msg, getTokenByStoreName(store));
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

      var ok = pushToLineWithToken(lineUid, msg, getTokenByStoreName(store));
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
      var ok = pushToLineWithToken(lineUid, msg, getTokenByStoreName(store));
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

    var ok = pushToLineWithToken(lineUid, msg, getTokenByStoreName(store));
    logLine({phone: phone, name: name, line_uid: lineUid,
             type: msgType, content: msg.substring(0, 80),
             status: ok ? "成功" : "失敗", error: ""});
    if (ok) {
      var stepId = "STEP_" + msgType + "_" + (new Date().getTime());
      getSheet("配信ターゲット").appendRow([stepId, msgType, lineUid, Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss"), "", ""]);
    }
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
  return pushToLineWithToken(lineUid, text, LINE_TOKEN);
}

// 店舗名からLINEトークンを取得
function getTokenByStoreName(storeName) {
  try {
    if (!storeName) return LINE_TOKEN;
    var raw = PropertiesService.getScriptProperties().getProperty("STORE_LINE_TOKENS");
    if (!raw) return LINE_TOKEN;
    var map = JSON.parse(raw);
    var normalize = function(s) { return (s || "").replace(/店$/, "").trim(); };
    var normalizedTarget = normalize(storeName);
    // 完全一致優先
    for (var dest in map) {
      if (map[dest].store === storeName) return map[dest].token;
    }
    // 正規化一致（店あり/なし吸収）
    for (var dest in map) {
      if (normalize(map[dest].store) === normalizedTarget) return map[dest].token;
    }
  } catch(e) {}
  return LINE_TOKEN;
}

// 古い誤ったPropertiesServiceエントリーを削除（一度だけ実行）
function cleanupOldStoreEntries() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty("STORE_LINE_TOKENS");
  if (!raw) return;
  var map = JSON.parse(raw);
  // 旧藤沢店の間違いエントリー（所沢店のBot userId）を削除
  delete map["U99dad428965ccff38f5352c90c47e183"];
  props.setProperty("STORE_LINE_TOKENS", JSON.stringify(map));
  Logger.log("クリーンアップ完了: " + JSON.stringify(Object.keys(map)));
}

function pushToLineWithToken(lineUid, text, token) {
  var useToken = token || LINE_TOKEN;
  Logger.log("[pushToLine] to=" + lineUid + " tokenPrefix=" + useToken.substring(0, 10));
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {Authorization: "Bearer " + useToken},
    payload: JSON.stringify({to: lineUid, messages: [{type: "text", text: text}]}),
    muteHttpExceptions: true
  };
  try {
    var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
    var code = res.getResponseCode();
    Logger.log("[pushToLine] responseCode=" + code + " body=" + res.getContentText().substring(0, 200));
    return code === 200;
  } catch(e) {
    Logger.log("[pushToLine] exception: " + e);
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
//  トリガー設定（ステップごとに個別時間）
// ══════════════════════════════════════════════════════════
function getH(key, def) {
  var v = parseInt(getSetting(key) || String(def));
  return (isNaN(v) || v < 0 || v > 23) ? def : v;
}

function resetTrigger() {
  // 既存の自動トリガーを全削除
  var targets = ["dailyFollowUp", "runReminder", "runThanks", "runCancel", "runSteps"];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (targets.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });

  var log = [];

  // リマインド
  if (getSetting("有効_来店前リマインド") !== "OFF") {
    var h = getH("送信時間_リマインド", 10);
    ScriptApp.newTrigger("runReminder").timeBased().everyDays(1).atHour(h).create();
    log.push("リマインド:" + h + "時");
  }
  // お礼
  if (getSetting("有効_会計後お礼") !== "OFF") {
    var h = getH("送信時間_お礼", 18);
    ScriptApp.newTrigger("runThanks").timeBased().everyDays(1).atHour(h).create();
    log.push("お礼:" + h + "時");
  }
  // キャンセル
  if (getSetting("有効_キャンセル再予約") !== "OFF") {
    var h = getH("送信時間_キャンセル", 10);
    ScriptApp.newTrigger("runCancel").timeBased().everyDays(1).atHour(h).create();
    log.push("キャンセル:" + h + "時");
  }
  // ステップ配信（14/30/60日 まとめて1トリガー）
  var stepEnabled = getSetting("有効_ステップ14日") !== "OFF"
    || getSetting("有効_ステップ30日") !== "OFF"
    || getSetting("有効_ステップ60日") !== "OFF";
  if (stepEnabled) {
    var h = getH("送信時間_ステップ", 11);
    ScriptApp.newTrigger("runSteps").timeBased().everyDays(1).atHour(h).create();
    log.push("ステップ:" + h + "時");
  }

  Logger.log("トリガー再設定: " + log.join(", "));
  return {status: "ok", message: "トリガー設定完了: " + log.join(", ")};
}

// 各ステップのトリガーラッパー関数
function runReminder() { checkPreVisitReminders(); }
function runThanks()   { checkPostCheckoutMessages(); }
function runCancel()   { checkCancellationFollowup(); }
function runSteps()    { checkStepMessages(); }

// 後方互換（旧トリガー名）
function dailyFollowUp() {
  checkPreVisitReminders();
  checkPostCheckoutMessages();
  checkCancellationFollowup();
  checkStepMessages();
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
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "Asia/Tokyo", "yyyy-MM-dd");
      }
      obj[headers[j]] = val === null || val === undefined ? "" : val;
    }
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
  var headers = all[0];
  var storeIdx = headers.indexOf("登録店舗");
  for (var i = 1; i < all.length; i++) {
    if (all[i][0] === data.line_uid) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[data.phone || all[i][1], data.name || all[i][2], data.display_name || all[i][3]]]);
      // 店舗名が渡されていて未設定の場合のみ更新
      if (data.store && storeIdx >= 0 && !all[i][storeIdx]) {
        sheet.getRange(i + 1, storeIdx + 1).setValue(data.store);
      }
      return {status: "updated"};
    }
  }
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([data.line_uid, data.phone || "", data.name || "", data.display_name || "", data.tag || "", data.memo || "", now, "", data.store || ""]);
  return {status: "registered"};
}

// LINE_UIDから登録店舗のLINEトークンを取得
function getTokenForLineUid(lineUid) {
  try {
    var sheet = getSheet("LINE友だち");
    var all = sheet.getDataRange().getValues();
    var headers = all[0];
    var uidIdx = headers.indexOf("LINE_UID");
    var storeIdx = headers.indexOf("登録店舗");
    if (uidIdx < 0 || storeIdx < 0) return LINE_TOKEN;
    for (var i = 1; i < all.length; i++) {
      if (all[i][uidIdx] === lineUid) {
        var storeName = all[i][storeIdx];
        if (!storeName) return LINE_TOKEN;
        var raw = PropertiesService.getScriptProperties().getProperty("STORE_LINE_TOKENS");
        if (!raw) return LINE_TOKEN;
        var map = JSON.parse(raw);
        for (var dest in map) {
          if (map[dest].store === storeName) return map[dest].token;
        }
      }
    }
  } catch(e) { return LINE_TOKEN; }
  return LINE_TOKEN;
}

// ══════════════════════════════════════════════════════════
//  個別LINE送信 / ログ
// ══════════════════════════════════════════════════════════
function sendPush(lineUid, message) {
  if (!lineUid || !message) return {error: "line_uid and message required"};
  lineUid = String(lineUid).trim().replace(/^'+|'+$/g, "");
  var token = getTokenForLineUid(lineUid);
  var ok = pushToLineWithToken(lineUid, message, token);
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
        var storeToken = getTokenForLineUid(targets[k]);
        if (type === "coupon" && flexJson) {
          sendFlex(targets[k], flexJson);
        } else {
          pushToLineWithToken(targets[k], message, storeToken);
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

// ── トーク削除（1件）────────────────────────────────────
function deleteTalk(talkId) {
  if (!talkId) return {error: "talk_id required"};
  var sheet = getSheet("トーク履歴");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(talkId)) {
      sheet.deleteRow(i + 1);
      return {status: "ok"};
    }
  }
  return {error: "not found"};
}

// ── トーク削除（ユーザーの全履歴）──────────────────────
function deleteTalksByUid(lineUid) {
  if (!lineUid) return {error: "line_uid required"};
  var sheet = getSheet("トーク履歴");
  var data = sheet.getDataRange().getValues();
  var deleted = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][2]) === String(lineUid)) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }
  return {status: "ok", deleted: deleted};
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

  // 配信ターゲットから予約数・来店数を集計
  var targetSheet = getSheet("配信ターゲット");
  var targets = targetSheet.getDataRange().getValues();
  var reservationMap = {};
  var visitMap = {};
  for (var t = 1; t < targets.length; t++) {
    var bid = String(targets[t][0]);
    if (!reservationMap[bid]) reservationMap[bid] = 0;
    if (!visitMap[bid]) visitMap[bid] = 0;
    if (String(targets[t][4] || "")) reservationMap[bid]++;
    if (String(targets[t][5] || "")) visitMap[bid]++;
  }

  var list = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][7] === "送信済み") {
      var msg = String(data[i][5] || "");
      var bid2 = String(data[i][0]);
      list.push({
        id:               bid2,
        sent_at:          String(data[i][2]),
        type:             String(data[i][3]),
        tag:              String(data[i][4]),
        preview:          msg.substring(0, 30) + (msg.length > 30 ? "…" : ""),
        sent_count:       parseInt(data[i][8] || 0),
        click_count:      parseInt(data[i][9] || 0),
        image_url:        String(data[i][10] || ""),
        reservation_count: reservationMap[bid2] || 0,
        visit_count:       visitMap[bid2] || 0
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
  var sentAt = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
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
      if (res.getResponseCode() === 200) {
        sent++;
        getSheet("配信ターゲット").appendRow([broadcastId, data.type || "text", targets[k], sentAt, "", ""]);
      }
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
// ══════════════════════════════════════════════════════════
//  電話番号で来店回数・メニュー履歴を取得（カウンセリング詳細用）
// ══════════════════════════════════════════════════════════
function getVisitsByPhone(phone) {
  if (!phone) return {error: "phone required"};
  var norm = normalizePhone(String(phone));
  var reservations = [];
  try {
    var rdata = getReservationData();
    for (var i = 1; i < rdata.length; i++) {
      var row = rdata[i];
      if (normalizePhone(String(row[14] || "")) !== norm) continue;
      var vd = String(row[6] || "");
      reservations.push({
        visit_date:  vd.length === 8 ? vd.slice(0,4)+"/"+vd.slice(4,6)+"/"+vd.slice(6,8) : vd,
        store:       String(row[2]  || ""),
        staff:       String(row[4]  || ""),
        menu:        String(row[11] || ""),
        status:      String(row[1]  || ""),
        amount:      String(row[19] || "")
      });
    }
  } catch(e) {
    return {error: String(e)};
  }
  reservations.sort(function(a, b) { return b.visit_date.localeCompare(a.visit_date); });
  var completedVisits = reservations.filter(function(r) {
    return r.status !== "キャンセル（顧客）" && r.status !== "キャンセル（サロン）" && r.status !== "無断キャンセル";
  });
  var menuCount = {};
  completedVisits.forEach(function(r) {
    if (r.menu) menuCount[r.menu] = (menuCount[r.menu] || 0) + 1;
  });
  var favoriteMenu = "";
  var maxCnt = 0;
  for (var mk in menuCount) { if (menuCount[mk] > maxCnt) { maxCnt = menuCount[mk]; favoriteMenu = mk; } }
  return {
    visit_count:    completedVisits.length,
    last_visit:     completedVisits.length ? completedVisits[0].visit_date : "",
    favorite_menu:  favoriteMenu,
    reservations:   reservations.slice(0, 10)
  };
}

function getCustomerProfile(lineUid) {
  if (!lineUid) return {error: "line_uid required"};
  lineUid = String(lineUid).trim().replace(/^'+|'+$/g, "");

  // LINE友だち情報
  var friendSheet = getSheet("LINE友だち");
  var friends = friendSheet.getDataRange().getValues();
  var fHeaders = friends[0];
  // ヘッダー名で列インデックスを動的取得
  function fCol(name) { return fHeaders.indexOf(name); }
  var colPhone   = fCol("電話番号");      if (colPhone   < 0) colPhone   = 1;
  var colName    = fCol("お名前");        if (colName    < 0) colName    = 2;
  var colDisp    = fCol("LINE表示名");    if (colDisp    < 0) colDisp    = 3;
  var colTag     = fCol("タグ");          if (colTag     < 0) colTag     = 4;
  var colMemo    = fCol("メモ");          if (colMemo    < 0) colMemo    = 5;
  var colRegAt   = fCol("登録日時");      if (colRegAt   < 0) colRegAt   = 6;
  var colLastVis = fCol("最終来店日");    if (colLastVis < 0) colLastVis = 7;

  var friend = null;
  var friendRowIdx = -1;
  for (var i = 1; i < friends.length; i++) {
    if (String(friends[i][0]).trim() === lineUid) {
      friend = {
        line_uid:      String(friends[i][0]),
        phone:         String(friends[i][colPhone]   || ""),
        name:          String(friends[i][colName]    || ""),
        display_name:  String(friends[i][colDisp]    || ""),
        tags:          String(friends[i][colTag]     || ""),
        memo:          String(friends[i][colMemo]    || ""),
        registered_at: String(friends[i][colRegAt]   || ""),
        last_visit:    String(friends[i][colLastVis] || "")
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
    friendSheet.getRange(friendRowIdx + 1, colLastVis + 1).setValue(lastVisit);
  }

  // 来店周期・よく使うメニュー・担当スタッフ・平均単価を計算
  var completedVisits = reservations.filter(function(r){ return r.status === "会計済み"; });
  completedVisits.sort(function(a,b){ return a.visit_date.localeCompare(b.visit_date); });

  // 平均来店周期（日数）
  var avgCycle = 0;
  if (completedVisits.length >= 2) {
    var totalDays = 0;
    for (var cv = 1; cv < completedVisits.length; cv++) {
      var d1 = new Date(completedVisits[cv-1].visit_date.replace(/\//g,"-"));
      var d2 = new Date(completedVisits[cv].visit_date.replace(/\//g,"-"));
      totalDays += Math.round((d2 - d1) / 86400000);
    }
    avgCycle = Math.round(totalDays / (completedVisits.length - 1));
  }

  // よく使うメニュー
  var menuCount = {};
  for (var m = 0; m < completedVisits.length; m++) {
    var mn = completedVisits[m].menu || "";
    if (mn) menuCount[mn] = (menuCount[mn] || 0) + 1;
  }
  var favoriteMenu = "";
  var maxMenuCnt = 0;
  for (var mk in menuCount) { if (menuCount[mk] > maxMenuCnt) { maxMenuCnt = menuCount[mk]; favoriteMenu = mk; } }

  // 担当スタッフ
  var staffCount = {};
  for (var st = 0; st < completedVisits.length; st++) {
    var sn = completedVisits[st].staff || "";
    if (sn) staffCount[sn] = (staffCount[sn] || 0) + 1;
  }
  var favoriteStaff = "";
  var maxStaffCnt = 0;
  for (var sk in staffCount) { if (staffCount[sk] > maxStaffCnt) { maxStaffCnt = staffCount[sk]; favoriteStaff = sk; } }

  // 平均単価
  var totalAmount = 0;
  var amountCount = 0;
  for (var am = 0; am < completedVisits.length; am++) {
    var amt = parseInt(String(completedVisits[am].amount || "").replace(/[^0-9]/g,""));
    if (!isNaN(amt) && amt > 0) { totalAmount += amt; amountCount++; }
  }
  var avgAmount = amountCount > 0 ? Math.round(totalAmount / amountCount) : 0;

  // 売上CSV照合（名前マッチング）
  var salesRecords = [];
  var salesVisitCount = 0;
  var salesLastVisit = "";
  var salesTotalAmount = 0;
  if (name) {
    var sd = getSalesByCustomer(name, friend.store || "");
    if (!sd.error && sd.records) {
      salesRecords = sd.records;
      salesVisitCount = sd.visit_count || 0;
      salesLastVisit = sd.last_visit || "";
      salesTotalAmount = sd.total_amount || 0;
      if (!favoriteMenu && sd.favorite_menu) favoriteMenu = sd.favorite_menu;
    }
  }

  // HPBデータ優先、なければ売上CSV、それもなければカウンセリング記録でフォールバック
  if (visitCount === 0 && salesVisitCount > 0) {
    visitCount = salesVisitCount;
    if (!lastVisit) lastVisit = salesLastVisit;
    if (avgAmount === 0 && salesTotalAmount > 0) avgAmount = Math.round(salesTotalAmount / salesVisitCount);
  } else if (visitCount === 0 && counseling.length > 0) {
    visitCount = counseling.length;
    for (var ci = 0; ci < counseling.length; ci++) {
      var cDate = String(counseling[ci]["来店日"] || "").substring(0, 10);
      if (cDate && (!lastVisit || cDate > lastVisit)) lastVisit = cDate;
    }
    if (!favoriteMenu && counseling[0]) favoriteMenu = String(counseling[0]["メニュー"] || "");
  }

  return {
    friend:         friend,
    reservations:   reservations.length ? reservations : salesRecords,
    counseling:     counseling,
    visit_count:    visitCount,
    last_visit:     lastVisit,
    avg_cycle:      avgCycle,
    favorite_menu:  favoriteMenu,
    favorite_staff: favoriteStaff,
    avg_amount:     avgAmount
  };
}

// ══════════════════════════════════════════════════════════
//  コンバージョン照合（毎日自動実行）
//  配信ターゲットの各ユーザーが配信後に予約・来店したか照合
// ══════════════════════════════════════════════════════════
function checkConversionByReservation() {
  var targetSheet = getSheet("配信ターゲット");
  var targets = targetSheet.getDataRange().getValues();
  if (targets.length <= 1) return;

  var friendSheet = getSheet("LINE友だち");
  var friends = friendSheet.getDataRange().getValues();

  // LINE_UID → phone のマップ
  var uidToPhone = {};
  for (var f = 1; f < friends.length; f++) {
    uidToPhone[String(friends[f][0]).trim()] = String(friends[f][1] || "");
  }

  var rdata = null;
  try { rdata = getReservationData(); } catch(e) { return; }

  for (var i = 1; i < targets.length; i++) {
    var broadcastId = String(targets[i][0]);
    var lineUid     = String(targets[i][2]).trim();
    var sentAt      = String(targets[i][3]);
    var resDate     = String(targets[i][4] || "");
    var visitDate   = String(targets[i][5] || "");

    // 両方埋まっていればスキップ
    if (resDate && visitDate) continue;

    var phone = uidToPhone[lineUid];
    if (!phone) continue;
    var norm = normalizePhone(phone);

    var sentTime = new Date(sentAt);

    for (var r = 1; r < rdata.length; r++) {
      var row = rdata[r];
      if (normalizePhone(String(row[14])) !== norm) continue;

      var rawDate = String(row[6]); // YYYYMMDD
      if (rawDate.length !== 8) continue;
      var resDateParsed = new Date(rawDate.substring(0,4)+"-"+rawDate.substring(4,6)+"-"+rawDate.substring(6,8));

      // 配信後の予約か
      if (resDateParsed < sentTime) continue;

      var status = String(row[1]);
      var formattedDate = formatVisitDate(rawDate);

      // 予約日時を記録（まだ未記録なら）
      if (!resDate) {
        targetSheet.getRange(i + 1, 5).setValue(formattedDate);
        resDate = formattedDate;
      }

      // 来店済みなら来店日時も記録
      if (!visitDate && status === "会計済み") {
        targetSheet.getRange(i + 1, 6).setValue(formattedDate);
        visitDate = formattedDate;
      }

      if (resDate && visitDate) break;
    }
  }
}

// ══════════════════════════════════════════════════════════
//  配信ステップ別効果集計
// ══════════════════════════════════════════════════════════
function getStepStats() {
  var targetSheet = getSheet("配信ターゲット");
  var targets = targetSheet.getDataRange().getValues();
  if (targets.length <= 1) return {steps: []};

  var stepMap = {};
  for (var i = 1; i < targets.length; i++) {
    var type     = String(targets[i][1]);
    var resDate  = String(targets[i][4] || "");
    var visitDate = String(targets[i][5] || "");

    if (!type.startsWith("ステップ") && !type.startsWith("STEP")) continue;

    if (!stepMap[type]) stepMap[type] = {type: type, sent: 0, reservations: 0, visits: 0};
    stepMap[type].sent++;
    if (resDate) stepMap[type].reservations++;
    if (visitDate) stepMap[type].visits++;
  }

  var steps = [];
  for (var k in stepMap) steps.push(stepMap[k]);
  steps.sort(function(a,b){ return a.type.localeCompare(b.type); });
  return {steps: steps};
}

// ══════════════════════════════════════════════════════════
//  既存フォロワー一括インポート
// ══════════════════════════════════════════════════════════
function importFollowers() {
  var imported = 0;
  var skipped  = 0;
  var nextToken = null;

  do {
    var url = "https://api.line.me/v2/bot/followers/ids?limit=300";
    if (nextToken) url += "&start=" + nextToken;
    var res = UrlFetchApp.fetch(url, {
      headers: {Authorization: "Bearer " + LINE_TOKEN},
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) break;
    var data = JSON.parse(res.getContentText());
    var uids = data.userIds || [];

    for (var i = 0; i < uids.length; i++) {
      var result = registerFriend({line_uid: uids[i], phone: "", name: "", display_name: ""});
      if (result.status === "registered") imported++;
      else skipped++;
    }

    nextToken = data.next || null;
  } while (nextToken);

  return {status: "ok", imported: imported, skipped: skipped};
}

// ══════════════════════════════════════════════════════════
//  Google Drive 画像アップロード
// ══════════════════════════════════════════════════════════
function uploadImageToDrive(base64Data, filename, mimeType) {
  if (!base64Data || !filename) return {error: "base64 and filename required"};
  try {
    var folders = DriveApp.getFoldersByName("LINE配信画像");
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("LINE配信画像");
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType || "image/jpeg", filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();
    // LINE APIはGoogleDriveの直リンクを受け付けるURL形式
    var url = "https://drive.google.com/uc?export=view&id=" + fileId;
    return {status: "ok", url: url, file_id: fileId};
  } catch(e) {
    return {error: e.toString()};
  }
}

// ══════════════════════════════════════════════════════════
//  自動タグルール
// ══════════════════════════════════════════════════════════
function getAutoTagRules() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty("AUTO_TAG_RULES");
  var rules = raw ? JSON.parse(raw) : [];
  return {rules: rules};
}

function saveAutoTagRules(rules) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("AUTO_TAG_RULES", JSON.stringify(rules || []));
  return {status: "ok"};
}

function applyAutoTags(data, lineUid) {
  if (!lineUid) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty("AUTO_TAG_RULES");
    if (!raw) return;
    var rules = JSON.parse(raw);
    var matchedTags = [];
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (!rule.enabled) continue;
      var fieldVal = String(data[rule.field] || "");
      var matched = false;
      if (rule.condition === "equals")    matched = fieldVal === rule.value;
      else if (rule.condition === "contains")  matched = fieldVal.indexOf(rule.value) !== -1;
      else if (rule.condition === "not_empty") matched = fieldVal !== "";
      if (matched) matchedTags.push(rule.tag);
    }
    if (matchedTags.length === 0) return;
    var sheet = getSheet("LINE友だち");
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var tagColIdx = headers.indexOf("タグ");
    if (tagColIdx === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue("タグ");
      tagColIdx = sheet.getLastColumn() - 1;
    }
    var friendData = sheet.getDataRange().getValues();
    for (var j = 1; j < friendData.length; j++) {
      if (String(friendData[j][0]) === String(lineUid)) {
        var existing = String(friendData[j][tagColIdx] || "");
        var existingArr = existing ? existing.split(",").map(function(t){ return t.trim(); }) : [];
        matchedTags.forEach(function(t) {
          if (existingArr.indexOf(t) === -1) existingArr.push(t);
        });
        sheet.getRange(j + 1, tagColIdx + 1).setValue(existingArr.join(", "));
        break;
      }
    }
  } catch(e) {
    Logger.log("applyAutoTags error: " + e.toString());
  }
}

// ══════════════════════════════════════════════════════════
//  売上データ取得（ダッシュボード用）
// ══════════════════════════════════════════════════════════
function getSalesData() {
  // カラム定義（ヘッダー行なし）
  // 0:店舗略称 1:店舗名 2:会計日 3:時間 4:会計ID 5:会計区分
  // 6:区分 7:ジャンル 8:カテゴリ 9:メニュー 10:単価 11:単価区分
  // 12:個数 13:金額 14:スタッフ 15:指名 16:客名 17:客番号
  // 18:フリガナ 19:予約経路 20:性別 21:新規再来 22:年月
  var COL = {abbr:0, date:2, acct:4, menu:9, amt:13, nr:21};

  try {
    var ss = SpreadsheetApp.openById(SALES_SS_ID);
    var sheets = ss.getSheets();
    var sheet = null;
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === SALES_SHEET_GID) { sheet = sheets[i]; break; }
    }
    if (!sheet) sheet = sheets[0];

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return {error: "no data", stores: {}, meta: {}};

    var now = new Date();
    var ym = Utilities.formatDate(now, "Asia/Tokyo", "yyyyMM");
    var dayOfMonth = parseInt(Utilities.formatDate(now, "Asia/Tokyo", "d"));
    var daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();

    var stores = {};
    for (var r = 0; r < data.length; r++) {
      var row = data[r];
      if (!row[COL.abbr]) continue;
      var dateVal = String(row[COL.date]).replace(/-/g,'').replace(/\//g,'').replace(/ .*/,'');
      if (!dateVal.startsWith(ym)) continue;

      var abbr = String(row[COL.abbr]);
      var amt = Number(row[COL.amt]) || 0;
      var nrType = String(row[COL.nr] || '');
      var acctId = String(row[COL.acct] || '') + '_' + dateVal;
      var menu = String(row[COL.menu] || '');
      var isKaisu = menu.indexOf('回数券') >= 0 || menu.indexOf('コース') >= 0;

      if (!stores[abbr]) {
        stores[abbr] = {revenue:0, kaisuRev:0, newCount:0, returnCount:0, seenAcct:{}};
      }
      stores[abbr].revenue += amt;
      if (isKaisu) stores[abbr].kaisuRev += amt;
      if (!stores[abbr].seenAcct[acctId]) {
        stores[abbr].seenAcct[acctId] = true;
        if (nrType === '新規') stores[abbr].newCount++;
        else if (nrType === '再来') stores[abbr].returnCount++;
      }
    }

    var result = {};
    for (var s in stores) {
      var d = stores[s];
      result[s] = {
        revenue: d.revenue,
        kaisuRev: d.kaisuRev,
        newCount: d.newCount,
        returnCount: d.returnCount,
        totalCustomers: d.newCount + d.returnCount
      };
    }

    return {
      stores: result,
      meta: {
        yearMonth: ym,
        dayOfMonth: dayOfMonth,
        daysInMonth: daysInMonth,
        updatedAt: Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HH:mm")
      }
    };
  } catch(e) {
    return {error: e.toString(), stores: {}, meta: {}};
  }
}

// ══════════════════════════════════════════════════════════
//  店舗別LINE初期セットアップ（GASエディタから手動実行）
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  店舗別LINEセットアップ関数（各店舗を連携するときに1回だけ実行）
// ══════════════════════════════════════════════════════════
function _setupStore(token, secret, storeName) {
  var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/info", {
    headers: {Authorization: "Bearer " + token},
    muteHttpExceptions: true
  });
  var info = JSON.parse(res.getContentText());
  Logger.log("Bot userId: " + info.userId);
  if (info.userId) {
    saveStoreLineToken(info.userId, token, secret, storeName);
    Logger.log("✅ " + storeName + "の登録完了: " + info.userId);
  } else {
    Logger.log("❌ エラー: " + res.getContentText());
  }
}

function setupFujisawaStore() {
  _setupStore(
    "nnZPLMB+/uCYYXgb53+eWZIRdpLQ+2raDYVB9sRgeYyp4eOjRemM4pMvIbZrMuutUQWPwb6/9HlrZkhoB9/VTGgv3B6BvOmr9WAm/rijNxckFfybOnK2UycxSsF3+FPVItv8S1hFe6YtTRx2w0DhQI9PbdgDzCFqoOLOYbqAITQ=",
    "55d615e016f364f2a4c557bbb1c41ec6",
    "SSIN STUDIO 藤沢"
  );
}

function setupTakadanobabaStore() {
  _setupStore(
    "MVLap76hu9mrQTHbhuLKT+w9jCU25lZRbzFaBbtAklDn3/vSsnh+xsRChpzAvfMgYKd4aJTRSLkCIImQqTQnBr0XjQenq2IKF8iRkDpucUrK69ri1JGn7H2W7dIZYmAg4GG10QDvB+7/GydZUL3WoY9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "SSIN STUDIO 高田馬場"
  );
}

function setupShimokitazawaStore() {
  _setupStore(
    "EyMClB8B2rbJhVYmUfDfmjd6o6ZsaddT+nP7fRSEqMmiCZHjuQ7s/Lst7jKdw/1U3z7ylGceebuY0ktgdXp+bM47d4adWcf0udPjj+0HhqTK69ri1JGn7H2W7dIZYmAgO7CYgljgXs02i21FKEF/ZY9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "most eyes 下北沢"
  );
}

function setupMosteyesTachikawa() {
  _setupStore(
    "NO6q3e8uT8kFQzGm8FCvi/8KwAIJPiD7wB8HmV8nVLWOs3TFpT4odyHgbOt2STsGlWjK4cWYELbKNHVSSDS7LaUwH6eLUfxlUe8RQt9szDrK69ri1JGn7H2W7dIZYmAgRrD/+AvtWp/DQsLI3VUrwI9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "most eyes 立川"
  );
}

function setupKawasakiStore() {
  _setupStore(
    "+i9FbFho9ZnFDEpgy3Fl6ZDyfPt7PsSyEXbJp684F9YPO88he07vsRrEOFc2PN0tJGnY2/g9YosT3tauPcH7uxjexpjA0rC2kysC8Z/XPgPK69ri1JGn7H2W7dIZYmAgsIYP/T9uM4oGwJJWcE4zbI9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "most eyes 川崎"
  );
}

function setupMosteyesYokohama() {
  _setupStore(
    "Q6s8woXd8WYjbqsrpi/rPP4Zng3llVvkB57sjXCdmXPsdDiE0nQdKbP3wik8+zd7nwErxeDTNktVCruMoI+nimmVNtMwYL5KyTAkov/3nlXK69ri1JGn7H2W7dIZYmAgd4UvWP6BLkFACTavDHrut49PbdgDzCFqoOLOYbqAITQ=",
    "",
    "most eyes 横浜"
  );
}

function setupFutakotamagawaStore() {
  _setupStore(
    "Pu2laIsMfibU1Fum9uSlXHmJKV6i1bMOfu3yz9AkA10rStT/FZwhqaOlqkgGpZi/FPhd3QpWjlMLNfTz/8zjLhV1Xuv1i+/OSQgdemOCAxGEAP/dD+UTFGMXOarFKI/ML0NQGaoeqBazf/D1kGpKIo9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "SSIN STUDIO 二子玉川"
  );
}

function setupSapporoStore() {
  _setupStore(
    "cHykOcsjDB8Lyen6Gzm6vPosiC3LbIW6Pibzl7EnqY+UxCdmzF6QMRBemYQuDZCIXxIlLpv9vv/U8rhnOTmtVqj8wet92Mzdj0ZxtLrL8+iEAP/dD+UTFGMXOarFKI/MDVLUWomzkFQ+f4uvHZIa5Y9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "SSIN STUDIO 札幌"
  );
}

function setupGifuStore() {
  _setupStore(
    "M8rBbZFe63ynjAWpc3Oe3i9gN8v7RLckxNylLyIHkcm+ts1dAs9inyMryUlgOu+7xISCUNY1HLbGU5gCeKAN1LZzLRhjDvUN3GjWON3PnbqEAP/dD+UTFGMXOarFKI/MpgLn20lMnXA+zeIfforD4o9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "SSIN STUDIO 岐阜"
  );
}

function setupNakanoStore() {
  _setupStore(
    "GLqMAba/U/eeyNXbLApYq9BmcvYoaY3GB9piGUJnmk+dctwQIk73mzhjxPp6ITTq6WAtHOr1/mKALZKQSrIeh9ToirQxqvwc0PKKB+188xqEAP/dD+UTFGMXOarFKI/MJZ/fwx+pLkolS23GGklOyo9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "SSIN STUDIO 中野"
  );
}

function setupKumamotoStore() {
  _setupStore(
    "U5TUANiCZucFTPOYAXLj12u485+dtdhzin7aDz7pPjL+mHWoc7sPdDlC3CbONUS/tBgBHi3orWJLAZUCez+7/9M6VaqOd8QXQu0Y51Hdv7aEAP/dD+UTFGMXOarFKI/MoWYmfuvw8Co71CtMJHU+oI9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "SSIN STUDIO 熊本"
  );
}

function setupSsinTachikawa() {
  _setupStore(
    "MHXppEe/uAEq9NUfQhn0+CEsa7MVP4/yCfFKtICtj1vNx78waFUIWNcReGeVfyq0n9uFHpg2fhy6W78rAVIakabDVBIsY8TykQysHNtH/MWEAP/dD+UTFGMXOarFKI/MKsZRp3bcxqCr6ReFxLvvqI9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "SSIN STUDIO 立川"
  );
}

function setupTokorozawaStore() {
  _setupStore(
    "nwpQPE6lcKEOBaI8DIgBfVAs7Yi6ydpYSxdVM5eiRmHMoV/ZRMgNCjUVJElZwtHP5ogy8aYXCxwx1b7M76nEA+ifPR4UyGPXAi9JMyVaWb0Axkin0Zrbxa0Kw0NBUw+diTRrrlxq89x6fQyh99UWhI9PbdgDzCFqoOLOYbqAITQ=",
    "",
    "most eyes 所沢"
  );
}

function saveCustomerForm(data) {
  var sheet = getSheet("顧客アンケート");
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  var id = "Q" + new Date().getTime();

  var lineUid = "";
  if (data.phone) {
    lineUid = findLineUidByPhone(data.phone) || "";
  }

  var hpbLinked = "未確認";
  if (data.phone) {
    try {
      var resData = getReservationData();
      var phoneNorm = (data.phone || "").replace(/[-\s]/g, "");
      for (var i = 1; i < resData.length; i++) {
        var rowPhone = (resData[i][5] || "").toString().replace(/[-\s]/g, "");
        if (rowPhone === phoneNorm) { hpbLinked = "連携済み"; break; }
      }
      if (hpbLinked === "未確認") hpbLinked = "未連携";
    } catch(e) { hpbLinked = "確認失敗"; }
  }

  sheet.appendRow([
    id, now,
    data.name || "", data.phone || "", data.store || "",
    data.birth_month || "", data.menu || "", data.next_menu || "",
    data.ext_type || "", data.cycle || "", data.current_state || "",
    data.job || "", data.priority || "", data.home_care || "",
    data.purchase || "", data.line_pref || "", data.line_freq || "",
    lineUid, hpbLinked, now
  ]);

  if (lineUid && (data.name || data.phone)) {
    var friendSheet = getSheet("LINE友だち");
    var friendData = friendSheet.getDataRange().getValues();
    var fHeaders = friendData[0];
    var colPhone = fHeaders.indexOf("電話番号"); if (colPhone < 0) colPhone = 1;
    var colName  = fHeaders.indexOf("お名前");   if (colName  < 0) colName  = 2;
    for (var fi = 1; fi < friendData.length; fi++) {
      if (friendData[fi][0] === lineUid) {
        if (data.phone && !friendData[fi][colPhone])
          friendSheet.getRange(fi + 1, colPhone + 1).setValue(data.phone);
        if (data.name && !friendData[fi][colName])
          friendSheet.getRange(fi + 1, colName + 1).setValue(data.name);
        break;
      }
    }
  }

  return {status: "ok", id: id, line_uid: lineUid, hpb_linked: hpbLinked};
}

function updateFriendMemo(lineUid, memo) {
  if (!lineUid) return {error: "line_uid required"};
  var sheet = getSheet("LINE友だち");
  var data  = sheet.getDataRange().getValues();
  var fH    = data[0];
  var memoIdx = fH.indexOf("メモ"); if (memoIdx < 0) memoIdx = 5;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === lineUid) {
      sheet.getRange(i + 1, memoIdx + 1).setValue(memo || "");
      return {status: "ok"};
    }
  }
  return {error: "friend not found"};
}

function runAutoTag() {
  var friendSheet = getSheet("LINE友だち");
  var friends = friendSheet.getDataRange().getValues();
  if (friends.length <= 1) return {status: "ok", updated: 0};

  var fH        = friends[0];
  var phoneIdx  = fH.indexOf("電話番号");   if (phoneIdx  < 0) phoneIdx  = 1;
  var tagIdx    = fH.indexOf("タグ");       if (tagIdx    < 0) tagIdx    = 4;
  var regAtIdx  = fH.indexOf("登録日時");   if (regAtIdx  < 0) regAtIdx  = 6;
  var lastVIdx  = fH.indexOf("最終来店日"); if (lastVIdx  < 0) lastVIdx  = 7;

  var visitMap = {};
  var todayStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd");
  try {
    var rdata = getReservationData();
    for (var r = 1; r < rdata.length; r++) {
      var row    = rdata[r];
      var ph     = normalizePhone(String(row[14]));
      var st     = String(row[1]);
      var vd     = String(row[6]);
      if (!ph) continue;
      if (!visitMap[ph]) visitMap[ph] = {completed: 0, lastVisit: "", upcoming: 0};
      if (st === "会計済み") {
        visitMap[ph].completed++;
        var vdFmt = vd.length === 8 ? vd.substring(0,4)+"-"+vd.substring(4,6)+"-"+vd.substring(6,8) : "";
        if (vdFmt && vdFmt > visitMap[ph].lastVisit) visitMap[ph].lastVisit = vdFmt;
      }
      if (vd >= todayStr && st.indexOf("キャンセル") === -1) visitMap[ph].upcoming++;
    }
  } catch(e) {
    Logger.log("runAutoTag error: " + e);
  }

  var now     = new Date();
  var updated = 0;
  for (var i = 1; i < friends.length; i++) {
    var phone = normalizePhone(String(friends[i][phoneIdx] || ""));
    var vi    = phone ? (visitMap[phone] || {completed:0, lastVisit:"", upcoming:0}) : {completed:0, lastVisit:"", upcoming:0};
    var tags  = [];
    if (vi.completed === 0 && vi.upcoming > 0) tags.push("未来店");
    if (vi.completed >= 1 && vi.completed < 3) tags.push("リピーター予備軍");
    if (vi.completed >= 3) tags.push("常連");
    if (vi.lastVisit) {
      var lastDate = new Date(vi.lastVisit);
      var diffDays = Math.floor((now - lastDate) / 86400000);
      if (diffDays > 60)  tags.push("休眠60日");
      if (diffDays > 90)  tags.push("休眠90日");
      if (diffDays > 180) tags.push("休眠180日");
    }
    if (vi.upcoming > 0) tags.push("予約済み");
    var newTagStr = tags.join(",");
    if (newTagStr !== String(friends[i][tagIdx] || "")) {
      friendSheet.getRange(i + 1, tagIdx + 1).setValue(newTagStr);
      updated++;
    }
  }
  return {status: "ok", updated: updated};
}

// 電話番号でLINE_UIDを紐付け（既存行のUID空セルを更新）
function deleteFriend(lineUid) {
  if (!lineUid) return {error: "line_uid required"};
  var sheet = getSheet("LINE友だち");
  var all = sheet.getDataRange().getValues();
  var headers = all[0];
  var uidIdx = headers.indexOf("LINE_UID");
  if (uidIdx < 0) return {error: "header not found"};
  for (var i = 1; i < all.length; i++) {
    if (String(all[i][uidIdx]) === lineUid) {
      sheet.deleteRow(i + 1);
      return {status: "deleted", row: i + 1};
    }
  }
  return {error: "uid not found: " + lineUid};
}

function linkUidToPhone(lineUid, phone) {
  if (!lineUid || !phone) return {error: "line_uid and phone required"};
  var sheet = getSheet("LINE友だち");
  var all = sheet.getDataRange().getValues();
  var headers = all[0];
  var uidIdx = headers.indexOf("LINE_UID");
  var phoneIdx = headers.indexOf("電話番号");
  if (uidIdx < 0 || phoneIdx < 0) return {error: "header not found"};
  var phoneStr = String(phone).replace(/\D/g, "");
  for (var i = 1; i < all.length; i++) {
    var rowPhone = String(all[i][phoneIdx] || "").replace(/\D/g, "");
    if (rowPhone === phoneStr) {
      sheet.getRange(i + 1, uidIdx + 1).setValue(lineUid);
      return {status: "linked", row: i + 1, name: all[i][headers.indexOf("お名前")]};
    }
  }
  return {error: "phone not found: " + phone};
}

function resp(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════
//  売上データ照合（店舗名＋顧客名で一致）
//  ※売上CSVに電話番号なし → 店舗名＋氏名漢字でマッチング
// ══════════════════════════════════════════════════════════
function getSalesByCustomer(customerName, storeName) {
  if (!customerName) return {error: "name required"};
  try {
    var ss = SpreadsheetApp.openById(SALES_SS_ID);
    var sheet = ss.getSheetByName("売上情報csv(毎日更新)");
    if (!sheet) sheet = ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();

    var normName  = String(customerName).replace(/\s/g, "");
    var normStore = storeName ? String(storeName).replace(/\s/g, "") : "";

    var records = [];
    for (var r = 0; r < data.length; r++) {
      var row = data[r];
      var rowName  = String(row[16] || "").replace(/\s/g, "");
      var rowStore = String(row[1]  || "").replace(/\s/g, "");
      if (rowName !== normName) continue;
      if (normStore && rowStore.indexOf(normStore) === -1 && normStore.indexOf(rowStore) === -1) continue;
      var dateStr = String(row[2] || "");
      records.push({
        date:   dateStr.length === 8 ? dateStr.slice(0,4)+"/"+dateStr.slice(4,6)+"/"+dateStr.slice(6,8) : dateStr,
        store:  String(row[1] || ""),
        menu:   String(row[9] || ""),
        amount: Number(row[13]) || 0,
        staff:  String(row[14] || ""),
        new_return: String(row[21] || "")
      });
    }
    records.sort(function(a, b) { return b.date.localeCompare(a.date); });

    var menuCount = {};
    records.forEach(function(rec) {
      if (rec.menu) menuCount[rec.menu] = (menuCount[rec.menu] || 0) + 1;
    });
    var favoriteMenu = "";
    var maxCnt = 0;
    for (var mk in menuCount) { if (menuCount[mk] > maxCnt) { maxCnt = menuCount[mk]; favoriteMenu = mk; } }

    var totalAmount = records.reduce(function(s, rec) { return s + rec.amount; }, 0);

    return {
      visit_count:   records.length,
      last_visit:    records.length ? records[0].date : "",
      favorite_menu: favoriteMenu,
      total_amount:  totalAmount,
      records:       records.slice(0, 20)
    };
  } catch(e) {
    return {error: String(e)};
  }
}

// ══════════════════════════════════════════════════════════
//  毎日自動タグ付け（GASトリガーで22:30実行）
//  全LINE友だちの予約・売上データを集計してタグを自動更新
// ══════════════════════════════════════════════════════════
function runDailyAutoTag() {
  var friendSheet = getSheet("LINE友だち");
  var friends = friendSheet.getDataRange().getValues();
  var fHeaders = friends[0];
  var colPhone   = fHeaders.indexOf("電話番号");   if (colPhone   < 0) colPhone   = 1;
  var colName    = fHeaders.indexOf("お名前");     if (colName    < 0) colName    = 2;
  var colTag     = fHeaders.indexOf("タグ");       if (colTag     < 0) colTag     = 4;
  var colStore   = fHeaders.indexOf("登録店舗");   if (colStore   < 0) colStore   = 8;

  var counselSheet = getSheet("カウンセリング記録");
  var counselData  = counselSheet.getDataRange().getValues();
  var cHeaders     = counselData[0];
  var cColPhone    = cHeaders.indexOf("電話番号");
  var cColHomecare = cHeaders.indexOf("初回物販商品");
  var cColInterest = cHeaders.indexOf("興味メニュー");

  // 電話番号→カウンセリングデータのマップ
  var counselMap = {};
  for (var ci = 1; ci < counselData.length; ci++) {
    var cp = normalizePhone(String(counselData[ci][cColPhone] || ""));
    if (!cp) continue;
    if (!counselMap[cp]) counselMap[cp] = {homecare: "", interest: ""};
    if (!counselMap[cp].homecare && cColHomecare >= 0) counselMap[cp].homecare = String(counselData[ci][cColHomecare] || "");
    if (!counselMap[cp].interest && cColInterest >= 0) counselMap[cp].interest = String(counselData[ci][cColInterest] || "");
  }

  var rdata = getReservationData();
  var now   = new Date();

  for (var fi = 1; fi < friends.length; fi++) {
    var phone = normalizePhone(String(friends[fi][colPhone] || ""));
    if (!phone) continue;

    // 予約データから来店履歴を集計
    var visits = [];
    for (var ri = 1; ri < rdata.length; ri++) {
      var rPhone = normalizePhone(String(rdata[ri][14] || ""));
      if (rPhone !== phone) continue;
      var status = String(rdata[ri][1] || "");
      if (status === "キャンセル（顧客）" || status === "キャンセル（サロン）" || status === "無断キャンセル") continue;
      visits.push({date: String(rdata[ri][6] || ""), menu: String(rdata[ri][11] || "")});
    }
    visits.sort(function(a, b) { return b.date.localeCompare(a.date); });

    var visitCount = visits.length;
    var lastVisitDate = visits.length ? visits[0].date : "";
    var daysSinceLast = 999;
    if (lastVisitDate && lastVisitDate.length >= 8) {
      var lv = new Date(
        parseInt(lastVisitDate.slice(0,4)),
        parseInt(lastVisitDate.slice(4,6)) - 1,
        parseInt(lastVisitDate.slice(6,8))
      );
      daysSinceLast = Math.floor((now - lv) / 86400000);
    }

    // メニュー分類
    var eyebrowCount = 0, lashCount = 0;
    visits.forEach(function(v) {
      var m = v.menu || "";
      if (m.indexOf("眉") !== -1 || m.indexOf("アイブロウ") !== -1 || m.indexOf("Wax") !== -1 || m.indexOf("WAX") !== -1) eyebrowCount++;
      if (m.indexOf("まつ") !== -1 || m.indexOf("パリジェンヌ") !== -1 || m.indexOf("エクステ") !== -1 || m.indexOf("ラッシュ") !== -1) lashCount++;
    });

    // カウンセリングデータ
    var counsel = counselMap[phone] || {};

    // タグ判定
    var tags = [];
    if (visitCount === 0) {
      // 予約あるがまだ未来店の場合は何もしない
    } else if (visitCount === 1) {
      tags.push("新規");
    } else if (visitCount <= 5) {
      tags.push("リピーター");
    } else {
      tags.push("VIP");
    }

    if (daysSinceLast >= 90) tags.push("休眠");
    else if (daysSinceLast >= 60) tags.push("失客リスク");

    if (visitCount > 0) {
      var eyebrowRatio = eyebrowCount / visitCount;
      var lashRatio    = lashCount    / visitCount;
      if (eyebrowRatio >= 0.7) tags.push("眉毛メイン");
      if (lashRatio    >= 0.7) tags.push("まつ毛メイン");
    }

    if (counsel.interest && counsel.interest.indexOf("、") !== -1) tags.push("セット狙い");
    if (counsel.homecare && counsel.homecare !== "今回は購入しない" && counsel.homecare !== "") tags.push("物販購入済み");
    else if (visitCount >= 1 && (!counsel.homecare || counsel.homecare === "今回は購入しない")) tags.push("未物販");

    if (tags.length === 0) continue;

    // 既存タグに追記（重複除去）
    var existing = String(friends[fi][colTag] || "");
    var existingArr = existing ? existing.split(",").map(function(t){ return t.trim(); }).filter(function(t){ return t; }) : [];
    // 来店ステータス系タグは上書き
    var statusTags = ["新規","リピーター","VIP"];
    existingArr = existingArr.filter(function(t){ return statusTags.indexOf(t) === -1; });
    tags.forEach(function(t) {
      if (existingArr.indexOf(t) === -1) existingArr.push(t);
    });
    friendSheet.getRange(fi + 1, colTag + 1).setValue(existingArr.join(", "));
  }

  Logger.log("runDailyAutoTag 完了: " + (friends.length - 1) + "件処理");
  return {status: "ok", processed: friends.length - 1};
}
