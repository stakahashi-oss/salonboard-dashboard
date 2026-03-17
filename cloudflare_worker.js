const GAS_URL = "https://script.google.com/macros/s/AKfycbwwbux1fkwj7jdAKv-lqXyLpRjTxNEARvQYEs4T0Ir0lrypVq6vvzYjIOWgQEjVkV0Tyg/exec";
const LINE_TOKEN = "E0gasK7zfaVSi5SEFzmvbvZLOwAjvyxEatqHUzv2cFhIqNE4Pg8R8i5/139d9oKI6uExBLGieIqgN36szq1dWEZ5qXxU8T8paVtFhkBOwKESOZRb+muKxCmy8mrI1WyT8/VyJBsXpyYU+CKtRLo8uAdB04t89/1O/w1cDnyilFU=";
const FORM_URL = "https://stakahashi-oss.github.io/salonboard-dashboard/counseling/";

export default {
  async fetch(request, env, ctx) {
    var body = null;
    if (request.method === "POST") {
      body = await request.json();
    }
    ctx.waitUntil(forwardToGAS(body));
    return new Response(JSON.stringify({status: "ok"}), {
      status: 200,
      headers: {"Content-Type": "application/json"}
    });
  }
};

async function forwardToGAS(body) {
  try {
    if (!body) return;
    var events = body.events || [];

    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var userId = event.source ? event.source.userId : "";

      if (event.type === "follow") {
        var profile = await fetchLineProfile(userId);
        var displayName = profile ? (profile.displayName || "") : "";
        await fetch(GAS_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            key: "ssin2026",
            action: "register_friend",
            data: {line_uid: userId, phone: "", name: "", display_name: displayName}
          }),
          redirect: "follow"
        });
        await sendCounselingLink(userId, displayName);
      }

      if (event.type === "message") {
        var text = event.message ? (event.message.text || "[スタンプ/画像/ファイル]") : "[不明]";
        await fetch(GAS_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            key: "ssin2026",
            action: "save_talk",
            data: {line_uid: userId, direction: "受信", content: text}
          }),
          redirect: "follow"
        });

        // フルネーム＋電話番号の返信を自動検出してシートに反映
        var contact = parseContact(text);
        if (contact) {
          await fetch(GAS_URL, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              key: "ssin2026",
              action: "register_friend",
              data: {line_uid: userId, phone: contact.phone, name: contact.name}
            }),
            redirect: "follow"
          });
          // 登録完了の返信
          await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {"Authorization": "Bearer " + LINE_TOKEN, "Content-Type": "application/json"},
            body: JSON.stringify({
              to: userId,
              messages: [{type: "text", text: contact.name + "様、ありがとうございます\uD83D\uDE4F\nお名前と電話番号を登録しました\u2728\nご来店をお待ちしております\uD83C\uDF38"}]
            })
          });
        }
      }

      if (event.type === "unfollow") {
        await fetch(GAS_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            key: "ssin2026",
            action: "log_line",
            data: {
              line_uid: userId, phone: "", name: "",
              type: "ブロック/削除", content: "", status: "自動記録", error: ""
            }
          }),
          redirect: "follow"
        });
      }
    }
  } catch(e) {
    console.error(e);
  }
}

// メッセージからフルネーム＋電話番号を抽出
// 対応形式: 「山田 花子\n090-1234-5678」「090-1234-5678\n山田花子」など
function parseContact(text) {
  if (!text) return null;
  var phonePattern = /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}/;
  var phoneMatch = text.match(phonePattern);
  if (!phoneMatch) return null;

  var phone = phoneMatch[0].replace(/[-\s]/g, "");
  // 電話番号部分を除いた残りをフルネームとして取得
  var nameCandidate = text.replace(phoneMatch[0], "").replace(/[0-9\-\s　]/g, " ").trim();
  // 行分割して最も長い日本語らしい行を名前とする
  var lines = nameCandidate.split(/[\n\r]+/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length >= 2; });
  if (!lines.length) return null;

  var name = lines.reduce(function(a, b){ return a.length >= b.length ? a : b; });
  if (!name) return null;

  return {phone: phone, name: name};
}

async function fetchLineProfile(userId) {
  try {
    var res = await fetch("https://api.line.me/v2/bot/profile/" + userId, {
      headers: {"Authorization": "Bearer " + LINE_TOKEN}
    });
    return await res.json();
  } catch(e) {
    return null;
  }
}

async function fetchBotName() {
  try {
    var res = await fetch("https://api.line.me/v2/bot/info", {
      headers: {"Authorization": "Bearer " + LINE_TOKEN}
    });
    var data = await res.json();
    return data.displayName || "SSIN STUDIO / most eyes / LUMISS";
  } catch(e) {
    return "SSIN STUDIO / most eyes / LUMISS";
  }
}

async function sendCounselingLink(userId, displayName) {
  var formUrl = FORM_URL + "?uid=" + encodeURIComponent(userId);
  var botName = await fetchBotName();
  var name = displayName ? displayName + "様、" : "";
  var message = "友だち追加ありがとうございます！\uD83D\uDE0A\n" + botName + " です\u2728\n\n"
    + name + "スムーズにご案内するため、お手数ですがこちらのLINEに以下をご返信ください\uD83D\uDE4F\n\n"
    + "\u{1F4DD} \u300Eフルネーム\u300F\u3000\u4F8B\uff1a\u5C71\u7530 \u82B1\u5B50\n"
    + "\uD83D\uDCF1 \u300E\u96FB\u8A71\u756A\u53F7\u300F\u3000\u4F8B\uff1a090-0000-0000\n\n"
    + "\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\n"
    + "\u307E\u305F\u3001\u30B4\u6765\u5E97\u524D\u306B\u4E0B\u8A18\u306E\u30AB\u30A6\u30F3\u30BB\u30EA\u30F3\u30B0\u30B7\u30FC\u30C8\u306B\u3054\u8A18\u5165\u3044\u305F\u3060\u3051\u308B\u3068\u3088\u308A\u30B9\u30E0\u30FC\u30BA\u306B\u3054\u6848\u5185\u3067\u304D\u307E\u3059\uD83D\uDCCB\n\n"
    + "\u25BC \u30AB\u30A6\u30F3\u30BB\u30EA\u30F3\u30B0\u30B7\u30FC\u30C8\n" + formUrl + "\n\n"
    + "\u3054\u4E0D\u660E\u70B9\u306F\u3053\u3061\u3089\u306ELINE\u3078\u304A\u6C17\u8EFD\u306B\uD83C\uDF38";

  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + LINE_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: userId,
      messages: [{type: "text", text: message}]
    })
  });
}
