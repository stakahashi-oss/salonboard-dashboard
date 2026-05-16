const FORM_URL = "https://salonboard-dashboard.vercel.app/counseling/";

// 店舗別設定（新店舗追加はここだけ）
const STORES = {
  "fujisawa": {
    gasUrl: "https://script.google.com/macros/s/AKfycbwwbux1fkwj7jdAKv-lqXyLpRjTxNEARvQYEs4T0Ir0lrypVq6vvzYjIOWgQEjVkV0Tyg/exec",
    token:  "E0gasK7zfaVSi5SEFzmvbvZLOwAjvyxEatqHUzv2cFhIqNE4Pg8R8i5/139d9oKI6uExBLGieIqgN36szq1dWEZ5qXxU8T8paVtFhkBOwKESOZRb+muKxCmy8mrI1WyT8/VyJBsXpyYU+CKtRLo8uAdB04t89/1O/w1cDnyilFU="
  },
  "sapporo": {
    gasUrl: "https://script.google.com/macros/s/AKfycbzJRbpPVo1-bUa1ruOSADhf6ZJyGYWIiSwy98VxUlLDnqC7JxywP29iPgzn43r1aMGp/exec",
    token:  "OVWoRXHkZOEINMNOPly4BFq4fRPauohaxYpaQstRXbBc3apzMhqKgAKOzipFPJyQXxIlLpv9vv/U8rhnOTmtVqj8wet92Mzdj0ZxtLrL8+gA5iYx3kv7p83S/cNvWuIhQDxPkuLQDfDMv0vD5Mgo2o9PbdgDzCFqoOLOYbqAITQ="
  }
};

// デフォルト（フォールバック用）
const DEFAULT_STORE = "fujisawa";

function getStore(storeName) {
  return STORES[storeName] || STORES[DEFAULT_STORE];
}

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);
    var storeName = url.searchParams.get("store") || DEFAULT_STORE;

    // コンバージョン追跡: /track?bid=配信ID&uid=LINE_UID&url=転送先URL
    if (url.pathname === "/track") {
      var bid = url.searchParams.get("bid") || "";
      var uid = url.searchParams.get("uid") || "";
      var dest = url.searchParams.get("url") || "";
      if (bid && dest) {
        ctx.waitUntil(fetch(getStore(storeName).gasUrl, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            key: "ssin2026",
            action: "log_conversion",
            data: {broadcast_id: bid, line_uid: uid, url: dest}
          }),
          redirect: "follow"
        }));
      }
      return Response.redirect(dest || "https://salonboard-dashboard.vercel.app/", 302);
    }

    var body = null;
    if (request.method === "POST") {
      body = await request.json();
    }
    ctx.waitUntil(forwardToGAS(body, storeName));
    return new Response(JSON.stringify({status: "ok"}), {
      status: 200,
      headers: {"Content-Type": "application/json"}
    });
  }
};

async function forwardToGAS(body, storeName) {
  try {
    if (!body) return;
    var store = getStore(storeName);
    var gasUrl = store.gasUrl;
    var token  = store.token;
    var events = body.events || [];

    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var userId = event.source ? event.source.userId : "";

      if (event.type === "follow") {
        var profile = await fetchLineProfile(userId, token);
        var displayName = profile ? (profile.displayName || "") : "";
        await fetch(gasUrl, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            key: "ssin2026",
            action: "register_friend",
            data: {line_uid: userId, phone: "", name: "", display_name: displayName, store: storeName}
          }),
          redirect: "follow"
        });
        await sendCounselingLink(userId, displayName, storeName, token);
      }

      if (event.type === "message") {
        var text = event.message ? (event.message.text || "[スタンプ/画像/ファイル]") : "[不明]";
        await fetch(gasUrl, {
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
          await fetch(gasUrl, {
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
            headers: {"Authorization": "Bearer " + token, "Content-Type": "application/json"},
            body: JSON.stringify({
              to: userId,
              messages: [{type: "text", text: contact.name + "様、ありがとうございます🙏\nお名前と電話番号を登録しました✨\nご来店をお待ちしております🌸"}]
            })
          });
        }
      }

      if (event.type === "unfollow") {
        await fetch(gasUrl, {
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
function parseContact(text) {
  if (!text) return null;
  var phonePattern = /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}/;
  var phoneMatch = text.match(phonePattern);
  if (!phoneMatch) return null;

  var phone = phoneMatch[0].replace(/[-\s]/g, "");
  var nameCandidate = text.replace(phoneMatch[0], "").replace(/[0-9\-\s　]/g, " ").trim();
  var lines = nameCandidate.split(/[\n\r]+/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length >= 2; });
  if (!lines.length) return null;

  var name = lines.reduce(function(a, b){ return a.length >= b.length ? a : b; });
  if (!name) return null;

  return {phone: phone, name: name};
}

async function fetchLineProfile(userId, token) {
  try {
    var res = await fetch("https://api.line.me/v2/bot/profile/" + userId, {
      headers: {"Authorization": "Bearer " + token}
    });
    return await res.json();
  } catch(e) {
    return null;
  }
}

async function fetchBotName(token) {
  try {
    var res = await fetch("https://api.line.me/v2/bot/info", {
      headers: {"Authorization": "Bearer " + token}
    });
    var data = await res.json();
    return data.displayName || "SSIN STUDIO / most eyes / LUMISS";
  } catch(e) {
    return "SSIN STUDIO / most eyes / LUMISS";
  }
}

async function sendCounselingLink(userId, displayName, storeName, token) {
  var formUrl = FORM_URL + "?uid=" + encodeURIComponent(userId) + (storeName ? "&store=" + encodeURIComponent(storeName) : "");
  var botName = await fetchBotName(token);
  var name = displayName ? displayName + "様、" : "";
  var message = "友だち追加ありがとうございます！😊\n" + botName + " です✨\n\n"
    + name + "スムーズにご案内するため、お手数ですがこちらのLINEに以下をご返信ください🙏\n\n"
    + "📝 『フルネーム』　例：山田 花子\n"
    + "📱 『電話番号』　例：090-0000-0000\n\n"
    + "――――――――――\n"
    + "また、ゴ来店前に下記のカウンセリングシートにご記入いただけるとよりスムーズにご案内できます📋\n\n"
    + "▼ カウンセリングシート\n" + formUrl + "\n\n"
    + "ご不明点はこちらのLINEへお気軽に🌸";

  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: userId,
      messages: [{type: "text", text: message}]
    })
  });
}
