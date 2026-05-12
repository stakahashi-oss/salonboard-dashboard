const COUNSELING_URL = "https://salonboard-dashboard.vercel.app/counseling/";
// コンバージョン追跡のフォールバック先（/track は藤沢GASへ）
const FUJISAWA_GAS_URL = "https://script.google.com/macros/s/AKfycbwwbux1fkwj7jdAKv-lqXyLpRjTxNEARvQYEs4T0Ir0lrypVq6vvzYjIOWgQEjVkV0Tyg/exec";

// 店舗別設定（destination = LINE BotのuserId = webhook body.destination）
// gasUrl: 店舗専用GASのWebアプリURL
const STORE_TOKENS = {
  // ── S藤沢 ──────────────────────────────────────────
  "Uee68876a1fd6e81c310e42eb7391fc25": {
    token: "SGedhcEWaQr53y2EmjxzcyFUpMjWS8DrcQVgpUFnqiRkIhfxGGYT3t6TmDLx+VLfUQWPwb6/9HlrZkhoB9/VTGgv3B6BvOmr9WAm/rijNxfw41iE9VFTiGYCkT16mAYLkHxbnI2ZKNEWwYr36hQ5N49PbdgDzCFqoOLOYbqAITQ=",
    store: "SSIN STUDIO 藤沢",
    gasUrl: "https://script.google.com/macros/s/AKfycbwwbux1fkwj7jdAKv-lqXyLpRjTxNEARvQYEs4T0Ir0lrypVq6vvzYjIOWgQEjVkV0Tyg/exec"
  },
  // ── S札幌 ──────────────────────────────────────────
  "U0cdc6d43d3e5be2d7cc67f8eb0c5fb84": {
    token: "OVWoRXHkZOEINMNOPly4BFq4fRPauohaxYpaQstRXbBc3apzMhqKgAKOzipFPJyQXxIlLpv9vv/U8rhnOTmtVqj8wet92Mzdj0ZxtLrL8+gA5iYx3kv7p83S/cNvWuIhQDxPkuLQDfDMv0vD5Mgo2o9PbdgDzCFqoOLOYbqAITQ=",
    store: "SSIN STUDIO 札幌",
    gasUrl: "" // ← 札幌GASデプロイ後にURLを設定
  }
};

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);

    // コンバージョン追跡
    if (url.pathname === "/track") {
      var bid = url.searchParams.get("bid") || "";
      var uid = url.searchParams.get("uid") || "";
      var dest = url.searchParams.get("url") || "";
      if (bid && dest) {
        ctx.waitUntil(forwardToGAS({
          key: "ssin2026",
          action: "log_conversion",
          data: {broadcast_id: bid, line_uid: uid, url: dest}
        }, FUJISAWA_GAS_URL));
      }
      return Response.redirect(dest || "https://salonboard-dashboard.vercel.app/", 302);
    }

    var body = null;
    if (request.method === "POST") {
      body = await request.json();
    }

    // LINE webhookの処理
    if (body && body.events) {
      ctx.waitUntil(handleLineEvents(body));
    }

    return new Response(JSON.stringify({status: "ok"}), {
      status: 200,
      headers: {"Content-Type": "application/json"}
    });
  }
};

async function handleLineEvents(body) {
  var destination = body.destination || "";
  var storeInfo = STORE_TOKENS[destination];

  for (var i = 0; i < body.events.length; i++) {
    var event = body.events[i];
    var userId = event.source && event.source.userId;

    if (event.type === "follow" && userId && storeInfo && storeInfo.token) {
      // 挨拶はreplyToken使用（無料・通数カウントなし）
      var formUrl = COUNSELING_URL + "?uid=" + userId + "&store=" + encodeURIComponent(storeInfo.store);
      var message = await buildGreetingMessage(storeInfo.store, formUrl, storeInfo.gasUrl);
      if (message) {
        var replyToken = event.replyToken;
        if (replyToken) {
          await replyToLine(replyToken, message, storeInfo.token);
        } else {
          await pushToLine(userId, message, storeInfo.token);
        }
      }

      // GAS GETでUID登録（POST失敗時のフォールバック）
      if (storeInfo.gasUrl) {
        var registerUrl = storeInfo.gasUrl
          + "?key=ssin2026&action=register_friend"
          + "&line_uid=" + encodeURIComponent(userId)
          + "&store=" + encodeURIComponent(storeInfo.store);
        await fetch(registerUrl).catch(function(e) { console.error("register_friend GET error:", e); });
      }
    }

    // メッセージ受信 → UIDとストアのみ登録（メッセージ本文は保存しない）
    if (event.type === "message" && event.message && event.message.type === "text" && userId && storeInfo && storeInfo.gasUrl) {
      var msgRegisterUrl = storeInfo.gasUrl
        + "?key=ssin2026&action=register_friend"
        + "&line_uid=" + encodeURIComponent(userId)
        + "&store=" + encodeURIComponent(storeInfo.store);
      await fetch(msgRegisterUrl).catch(function(e) { console.error("message register GET error:", e); });
    }
  }

  // 店舗専用GASにイベントを転送（トーク保存など）
  if (storeInfo && storeInfo.gasUrl) {
    await forwardToGAS(body, storeInfo.gasUrl);
  }
}

async function buildGreetingMessage(storeName, counselingUrl, gasUrl) {
  var defaultMsg = storeName + "です😊\n\nLINEのご登録ありがとうございます✨\n\nご来店前に下記のカウンセリングシートをご記入いただけるとスムーズにご案内できます📋\n\n▼ カウンセリングシート\n" + counselingUrl + "\n\nご予約・お問い合わせはいつでもこちらのLINEへお気軽にどうぞ🌸";
  if (!gasUrl) return defaultMsg;
  try {
    var settingsUrl = gasUrl + "?key=ssin2026&action=get_settings";
    var res = await fetch(settingsUrl);
    if (res.ok) {
      var json = await res.json();
      var settings = (json && json.settings) ? json.settings : {};
      // 挨拶が無効設定なら送信しない
      if (settings["有効_挨拶"] === "false" || settings["有効_挨拶"] === false) return null;
      var template = settings["メッセージ_挨拶"];
      if (template) {
        return template
          .replace(/\{store\}/g, storeName)
          .replace(/\{name\}/g, "お客様")
          .replace(/\{url\}/g, counselingUrl);
      }
    }
  } catch(e) {
    console.error("buildGreetingMessage error:", e);
  }
  return defaultMsg;
}

async function replyToLine(replyToken, message, token) {
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: [{type: "text", text: message}]
      })
    });
  } catch(e) {
    console.error("replyToLine error:", e);
  }
}

async function pushToLine(userId, message, token) {
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        to: userId,
        messages: [{type: "text", text: message}]
      })
    });
  } catch(e) {
    console.error("pushToLine error:", e);
  }
}

async function forwardToGAS(body, gasUrl) {
  try {
    if (!body || !gasUrl) return;
    var res = await fetch(gasUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
      redirect: "manual"
    });
    if (res.status === 301 || res.status === 302) {
      var location = res.headers.get("Location");
      if (location) {
        await fetch(location, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(body)
        });
      }
    }
  } catch(e) {
    console.error("forwardToGAS error:", e);
  }
}

