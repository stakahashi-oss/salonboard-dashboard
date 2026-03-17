/**
 * カウンセリングシート GAS バックエンド
 *
 * 【デプロイ手順】
 * 1. https://script.google.com で新規プロジェクト作成
 * 2. このコードを貼り付け
 * 3. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
 * 4. アクセス: 「全員」
 * 5. デプロイして表示されたURLを counseling/index.html の GAS_URL に貼り付け
 */

// ── 設定 ──────────────────────────────────────────────────
const CONFIG = {
  SPREADSHEET_NAME: "カウンセリングシート管理_テスト",
  SECRET_KEY: "ssin2026",  // セキュリティキー（index.htmlと合わせる）
  LINE_TOKEN: "E0gasK7zfaVSi5SEFzmvbvZLOwAjvyxEatqHUzv2cFhIqNE4Pg8R8i5/139d9oKI6uExBLGieIqgN36szq1dWEZ5qXxU8T8paVtFhkBOwKESOZRb+muKxCmy8mrI1WyT8/VyJBsXpyYU+CKtRLo8uAdB04t89/1O/w1cDnyilFU=",
  RESERVATION_SS_ID: "1Uwvhc1S_4gLStUiWBp8M_x8cDZBbu7VpMuskkpA8zXg",
};

// ── エントリーポイント ─────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.key !== CONFIG.SECRET_KEY) return resp({error: "unauthorized"}, 401);

    const action = body.action;
    if (action === "save_counseling")    return resp(saveCounseling(body.data));
    if (action === "get_counseling")     return resp(getCounseling(body.phone));
    if (action === "log_line")           return resp(logLine(body.data));
    if (action === "register_line_uid")  return resp(registerLineUid(body.data));
    if (action === "get_pending_follow") return resp(getPendingFollow());
    if (action === "mark_sent")          return resp(markSent(body.log_id));
    return resp({error: "unknown action"}, 400);
  } catch(err) {
    return resp({error: err.toString()}, 500);
  }
}

function doGet(e) {
  const key  = e.parameter.key;
  const act  = e.parameter.action;
  if (key !== CONFIG.SECRET_KEY) return resp({error: "unauthorized"}, 401);
  if (act === "search_phone")   return resp(searchByPhone(e.parameter.phone));
  if (act === "get_stats")      return resp(getStats());
  if (act === "get_all")        return resp(getAllCounseling());
  return resp({error: "unknown action"}, 400);
}

// ── スプレッドシート初期化 ────────────────────────────────
function getOrCreateSS() {
  const files = DriveApp.getFilesByName(CONFIG.SPREADSHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  const ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  initSheets(ss);
  return ss;
}

function initSheets(ss) {
  // デフォルトシートをカウンセリング記録に
  const s1 = ss.getSheets()[0];
  s1.setName("カウンセリング記録");
  s1.appendRow([
    "記録ID","記録日時","店舗名","来店日","予約番号",
    "電話番号","お名前","メニュー","担当スタッフ",
    "肌質","アレルギー","アレルギー詳細",
    "過去施術歴","本日の要望","施術メモ","次回提案","次回提案時期",
    "LINE_UID","LINE送信フラグ","最終更新"
  ]);
  s1.getRange(1,1,1,20).setFontWeight("bold").setBackground("#00b900").setFontColor("#ffffff");
  s1.setFrozenRows(1);

  // LINE配信ログ
  const s2 = ss.insertSheet("LINE配信ログ");
  s2.appendRow(["ログID","送信日時","電話番号","お名前","LINE_UID","種別","内容","ステータス","エラー"]);
  s2.getRange(1,1,1,9).setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");
  s2.setFrozenRows(1);

  // LINE友だちリスト
  const s3 = ss.insertSheet("LINE友だち");
  s3.appendRow(["LINE_UID","電話番号","お名前","登録日時","最終来店日"]);
  s3.getRange(1,1,1,5).setFontWeight("bold").setBackground("#0d7a0d").setFontColor("#ffffff");
  s3.setFrozenRows(1);

  // 設定
  const s4 = ss.insertSheet("設定");
  s4.appendRow(["キー","値"]);
  s4.appendRow(["店舗名", "テスト店舗"]);
  s4.appendRow(["LINE公式アカウント", "@027qvfqz"]);
  s4.appendRow(["リマインド_来店前日数", "2"]);
  s4.appendRow(["フォロー_来店後日数", "1"]);
  s4.appendRow(["ステップ1_日数", "14"]);
  s4.appendRow(["ステップ2_日数", "30"]);
  s4.appendRow(["ステップ3_日数", "60"]);
}

function getSheet(name) {
  const ss = getOrCreateSS();
  return ss.getSheetByName(name);
}

// ── カウンセリング保存 ────────────────────────────────────
function saveCounseling(data) {
  const sheet = getSheet("カウンセリング記録");
  const now   = new Date().toLocaleString("ja-JP");
  const id    = "C" + Date.now();

  sheet.appendRow([
    id, now, data.store || "", data.visit_date || "", data.reservation_id || "",
    data.phone || "", data.name || "", data.menu || "", data.staff || "",
    data.skin_type || "", data.allergy || "なし", data.allergy_detail || "",
    data.past_treatment || "", data.request || "", data.treatment_memo || "",
    data.next_menu || "", data.next_timing || "",
    data.line_uid || "", "未送信", now,
  ]);

  return {status: "ok", id: id};
}

// ── カウンセリング取得（電話番号で検索） ─────────────────
function getCounseling(phone) {
  const sheet = getSheet("カウンセリング記録");
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[5]).replace(/-/g,"") === String(phone).replace(/-/g,"")) {
      const obj = {};
      headers.forEach((h, j) => obj[h] = row[j]);
      results.push(obj);
    }
  }
  return {records: results.reverse()};
}

// ── 電話番号で予約情報検索 ───────────────────────────────
function searchByPhone(phone) {
  try {
    const ss  = SpreadsheetApp.openById(CONFIG.RESERVATION_SS_ID);
    const sheet = ss.getSheetByName("予約一覧") || ss.getSheets()[0];
    const data  = sheet.getDataRange().getValues();
    const norm  = String(phone).replace(/-/g,"");
    const results = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // O列(index14)が電話番号
      if (String(row[14]).replace(/-/g,"") === norm) {
        results.push({
          reservation_id: row[0],
          status:         row[1],
          store:          row[2],
          staff:          row[4],
          visit_date:     row[6],
          start_time:     row[7],
          menu:           row[11],
          name:           row[13],
          phone:          row[14],
          first_visit:    row[20],
        });
      }
    }
    return {reservations: results};
  } catch(e) {
    return {reservations: [], error: e.toString()};
  }
}

// ── LINE配信ログ保存 ─────────────────────────────────────
function logLine(data) {
  const sheet = getSheet("LINE配信ログ");
  const id    = "L" + Date.now();
  const now   = new Date().toLocaleString("ja-JP");
  sheet.appendRow([
    id, now, data.phone || "", data.name || "", data.line_uid || "",
    data.type || "", data.content || "", data.status || "", data.error || "",
  ]);
  return {status: "ok", log_id: id};
}

// ── LINE友だち登録 ───────────────────────────────────────
function registerLineUid(data) {
  const sheet = getSheet("LINE友だち");
  const all   = sheet.getDataRange().getValues();
  // 既存チェック
  for (let i = 1; i < all.length; i++) {
    if (all[i][0] === data.line_uid) {
      sheet.getRange(i+1, 2, 1, 3).setValues([[data.phone||all[i][1], data.name||all[i][2], all[i][3]]]);
      return {status: "updated"};
    }
  }
  sheet.appendRow([data.line_uid, data.phone||"", data.name||"", new Date().toLocaleString("ja-JP"), ""]);
  return {status: "registered"};
}

// ── LINE自動追尾: 送信待ちリスト取得 ────────────────────
function getPendingFollow() {
  const pending = [];
  const now = new Date();

  // 予約スプレッドシートから対象取得
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.RESERVATION_SS_ID);
    const sheet = ss.getSheetByName("予約一覧") || ss.getSheets()[0];
    const data  = sheet.getDataRange().getValues();
    const lineFriends = getLineFriendsMap();
    const counselingMap = getCounselingMap();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status    = String(row[1]);
      const store     = String(row[2]);
      const visitDate = parseDate(row[6]);
      const phone     = String(row[14]).replace(/-/g,"");
      const name      = String(row[13]);
      const menu      = String(row[11]);
      const lineUid   = lineFriends[phone] || null;

      if (!visitDate || !lineUid) continue;

      const daysUntil = Math.floor((visitDate - now) / 86400000);
      const daysAfter = Math.floor((now - visitDate) / 86400000);

      // 来店2日前リマインド
      if (daysUntil === 2 && !isAlreadySent(phone, "リマインド", visitDate)) {
        pending.push({type:"リマインド", phone, name, line_uid:lineUid, store, menu, visit_date:row[6], days_until:2});
      }

      // 来店翌日お礼（会計済み）
      if (status.includes("会計済み") && daysAfter === 1 && !isAlreadySent(phone, "お礼", visitDate)) {
        const cs = counselingMap[phone];
        pending.push({type:"お礼", phone, name, line_uid:lineUid, store, menu, next_menu:cs?.next_menu||"", next_timing:cs?.next_timing||""});
      }

      // キャンセル再予約促進
      if ((status.includes("キャンセル")) && daysAfter >= 1 && daysAfter <= 3 && !isAlreadySent(phone, "キャンセル", visitDate)) {
        pending.push({type:"キャンセル", phone, name, line_uid:lineUid, store, menu});
      }

      // ステップ配信（14/30/60日後）
      if (status.includes("会計済み")) {
        [14, 30, 60].forEach(d => {
          if (daysAfter === d && !isAlreadySent(phone, `ステップ${d}日`, visitDate)) {
            pending.push({type:`ステップ${d}日`, phone, name, line_uid:lineUid, store, menu, days_after:d});
          }
        });
      }
    }
  } catch(e) {
    return {pending: [], error: e.toString()};
  }

  return {pending};
}

function parseDate(val) {
  if (!val) return null;
  const s = String(val).replace(/\//g,"-");
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function getLineFriendsMap() {
  const sheet = getSheet("LINE友だち");
  const data  = sheet.getDataRange().getValues();
  const map   = {};
  for (let i = 1; i < data.length; i++) {
    const uid   = data[i][0];
    const phone = String(data[i][1]).replace(/-/g,"");
    if (phone) map[phone] = uid;
  }
  return map;
}

function getCounselingMap() {
  const sheet = getSheet("カウンセリング記録");
  const data  = sheet.getDataRange().getValues();
  const map   = {};
  for (let i = 1; i < data.length; i++) {
    const phone = String(data[i][5]).replace(/-/g,"");
    if (phone) map[phone] = {
      next_menu:   data[i][15],
      next_timing: data[i][16],
    };
  }
  return map;
}

function isAlreadySent(phone, type, visitDate) {
  const sheet = getSheet("LINE配信ログ");
  const data  = sheet.getDataRange().getValues();
  const dateStr = visitDate ? Utilities.formatDate(visitDate, "Asia/Tokyo", "yyyy-MM-dd") : "";
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).replace(/-/g,"") === String(phone).replace(/-/g,"") &&
        String(data[i][5]).includes(type)) {
      return true;
    }
  }
  return false;
}

// ── 送信済みマーク ───────────────────────────────────────
function markSent(logId) {
  const sheet = getSheet("LINE配信ログ");
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === logId) {
      sheet.getRange(i+1, 8).setValue("送信済み");
      return {status: "ok"};
    }
  }
  return {status: "not_found"};
}

// ── 統計 ────────────────────────────────────────────────
function getStats() {
  const cs = getSheet("カウンセリング記録").getDataRange().getValues();
  const ll = getSheet("LINE配信ログ").getDataRange().getValues();
  const lf = getSheet("LINE友だち").getDataRange().getValues();
  return {
    counseling_count: Math.max(0, cs.length - 1),
    line_log_count:   Math.max(0, ll.length - 1),
    line_friends:     Math.max(0, lf.length - 1),
  };
}

function getAllCounseling() {
  const sheet = getSheet("カウンセリング記録");
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return {records: []};
  const headers = data[0];
  const records = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  return {records: records.reverse()};
}

// ── レスポンスヘルパー ───────────────────────────────────
function resp(data, code) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
