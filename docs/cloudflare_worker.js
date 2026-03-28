const GAS_URL = "https://script.google.com/macros/s/AKfycbwwbux1fkwj7jdAKv-lqXyLpRjTxNEARvQYEs4T0Ir0lrypVq6vvzYjIOWgQEjVkV0Tyg/exec";
const COUNSELING_URL = "https://salonboard-dashboard.vercel.app/counseling/";

// 店舗別トークン（destination = BotのuserId）
// ※テスト中：藤沢店のみ有効
const STORE_TOKENS = {
  "Uee68876a1fd6e81c310e42eb7391fc25": {
    token: "nnZPLMB+/uCYYXgb53+eWZIRdpLQ+2raDYVB9sRgeYyp4eOjRemM4pMvIbZrMuutUQWPwb6/9HlrZkhoB9/VTGgv3B6BvOmr9WAm/rijNxckFfybOnK2UycxSsF3+FPVItv8S1hFe6YtTRx2w0DhQI9PbdgDzCFqoOLOYbqAITQ=",
    store: "SSIN STUDIO 藤沢"
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
        }));
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

    if (event.type === "follow" && userId && storeInfo) {
      // 挨拶メッセージをWorkerから直接送信
      var formUrl = COUNSELING_URL + "?uid=" + userId + "&store=" + encodeURIComponent(storeInfo.store);
      var message = "友だち追加ありがとうございます！😊\n"
        + storeInfo.store + " です✨\n\n"
        + "ご来店前に下記のカウンセリングシートにご記入いただけると\n"
        + "スムーズにご案内できます📋\n\n"
        + "▼ カウンセリングシート\n" + formUrl + "\n\n"
        + "ご不明点はこちらのLINEへお気軽に🌸";
      await pushToLine(userId, message, storeInfo.token);

      // GAS GETでUID登録（POST失敗時のフォールバック）
      var registerUrl = GAS_URL
        + "?key=ssin2026&action=register_friend"
        + "&line_uid=" + encodeURIComponent(userId)
        + "&store=" + encodeURIComponent(storeInfo.store);
      await fetch(registerUrl).catch(function(e) { console.error("register_friend GET error:", e); });
    }
  }

  // GASにも全イベントを転送（トーク保存など）
  await forwardToGAS(body);
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

async function forwardToGAS(body) {
  try {
    if (!body) return;
    var res = await fetch(GAS_URL, {
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
