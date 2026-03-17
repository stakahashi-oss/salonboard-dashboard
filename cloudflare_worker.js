// LINE Webhook → GAS 中継ワーカー
// Cloudflare Workers に貼り付けて使用

const GAS_URL = "https://script.google.com/macros/s/AKfycbyG9tomwZkWxkHszj7pM9Lw3ZSh__TARFQJGobmyLtJB1t3i81O7bi-wNtKQMrmbAc8yw/exec";

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
  // GASへの転送はバックグラウンドで実行（LINEへの200応答を遅らせない）
  event.waitUntil(forwardToGAS(event.request.clone()));
});

async function handleRequest(request) {
  // LINE の webhook 検証・実際のイベント両方に即座に200を返す
  return new Response(JSON.stringify({status: "ok"}), {
    status: 200,
    headers: {"Content-Type": "application/json"}
  });
}

async function forwardToGAS(request) {
  try {
    if (request.method !== "POST") return;
    const body = await request.json();
    const events = body.events || [];

    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var userId = event.source ? event.source.userId : "";

      if (event.type === "follow") {
        // 友だち追加 → GASに登録
        await fetch(GAS_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            key: "ssin2026",
            action: "register_friend",
            data: {line_uid: userId, phone: "", name: ""}
          }),
          redirect: "follow"
        });
        // カウンセリングフォームURLを送信
        await sendCounselingLink(userId);
      }

      if (event.type === "unfollow") {
        // ブロック・削除をGASに記録
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
    // エラーは無視（LINEへの応答は既に返済済み）
    console.error(e);
  }
}

async function sendCounselingLink(userId) {
  const LINE_TOKEN = "E0gasK7zfaVSi5SEFzmvbvZLOwAjvyxEatqHUzv2cFhIqNE4Pg8R8i5/139d9oKI6uExBLGieIqgN36szq1dWEZ5qXxU8T8paVtFhkBOwKESOZRb+muKxCmy8mrI1WyT8/VyJBsXpyYU+CKtRLo8uAdB04t89/1O/w1cDnyilFU=";
  const formUrl = "https://stakahashi-oss.github.io/salonboard-dashboard/counseling/";
  const message = "友だち追加ありがとうございます！\uD83D\uDE0A\nSSIN STUDIO / most eyes / LUMISS です\u2728\n\nご来店前に下記のカウンセリングシートにご記入いただけるとスムーズにご案内できます\uD83D\uDCCB\n\n\u25BC カウンセリングシート\n" + formUrl + "\n\nご不明点はこちらのLINE\u3078\u304A\u6C17\u8EFD\u306B\uD83C\uDF38";

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
