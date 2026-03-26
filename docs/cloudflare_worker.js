const GAS_URL = "https://script.google.com/macros/s/AKfycbwwbux1fkwj7jdAKv-lqXyLpRjTxNEARvQYEs4T0Ir0lrypVq6vvzYjIOWgQEjVkV0Tyg/exec";

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);

    // コンバージョン追跡: /track?bid=配信ID&uid=LINE_UID&url=転送先URL
    if (url.pathname === "/track") {
      var bid = url.searchParams.get("bid") || "";
      var uid = url.searchParams.get("uid") || "";
      var dest = url.searchParams.get("url") || "";
      if (bid && dest) {
        ctx.waitUntil(fetch(GAS_URL, {
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
    // LINE webhookの生ボディをそのままGASに転送（マルチストアトークン対応）
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
    await fetch(GAS_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
      redirect: "follow"
    });
  } catch(e) {
    console.error(e);
  }
}
