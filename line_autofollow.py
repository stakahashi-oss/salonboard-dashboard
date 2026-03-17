"""
LINE自動追尾スクリプト
GASエンドポイント経由でスプレッドシートを読み取り、LINE APIで配信する

実行タイミング（LaunchAgentで設定）:
  毎朝 9:00 → python3 line_autofollow.py
"""

import requests
import json
import sys
from datetime import datetime

# ── 設定 ──────────────────────────────────────────────────
GAS_URL   = "YOUR_GAS_WEB_APP_URL_HERE"  # デプロイ後に設定
SECRET    = "ssin2026"
LINE_TOKEN = "E0gasK7zfaVSi5SEFzmvbvZLOwAjvyxEatqHUzv2cFhIqNE4Pg8R8i5/139d9oKI6uExBLGieIqgN36szq1dWEZ5qXxU8T8paVtFhkBOwKESOZRb+muKxCmy8mrI1WyT8/VyJBsXpyYU+CKtRLo8uAdB04t89/1O/w1cDnyilFU="

LINE_API  = "https://api.line.me/v2/bot"
LINE_HEADERS = {
    "Authorization": f"Bearer {LINE_TOKEN}",
    "Content-Type": "application/json",
}

LOG_FILE = "/Users/shou/.salonboard_dashboard/line_autofollow_log.txt"


# ── メッセージテンプレート ─────────────────────────────────
def make_message(item):
    t    = item.get("type", "")
    name = item.get("name", "お客様")
    store = item.get("store", "")
    menu  = item.get("menu", "")
    next_menu   = item.get("next_menu", "")
    next_timing = item.get("next_timing", "")
    visit_date  = item.get("visit_date", "")
    days_after  = item.get("days_after", 0)

    if t == "リマインド":
        return f"""こんにちは！{store}です😊

{visit_date}のご予約のご確認です✨

📅 ご来店日：{visit_date}
💇 メニュー：{menu}

お時間になりましたらお気をつけてお越しください🌟
ご不明点はこちらにメッセージしてください。

当日お会いできるのを楽しみにしています！"""

    if t == "お礼":
        msg = f"""本日はご来店いただきありがとうございました！🙏

{name}様にご満足いただけましたでしょうか？

またのご来店をスタッフ一同お待ちしています✨"""
        if next_menu:
            msg += f"""

次回は「{next_menu}」がおすすめです😊
目安は{next_timing}頃です。

ご予約はLINEからもお気軽にどうぞ📱"""
        return msg

    if t == "キャンセル":
        return f"""こんにちは！{store}です😊

先日はご予約のキャンセルをいただきありがとうございました。
またのご来店をお待ちしています✨

ご都合のよい日程が決まりましたら、こちらのLINEまたはホットペッパーからご予約いただけます📅

またお会いできることを楽しみにしています🌸"""

    if t == "ステップ14日":
        return f"""こんにちは！{store}です💬

ご来店から2週間が経ちました✨
まつげの状態はいかがでしょうか？

そろそろメンテナンスの時期が近づいています😊
ご都合のよい日程でご予約お待ちしております！

📱 LINEからもご予約いただけます"""

    if t == "ステップ30日":
        return f"""こんにちは！{store}です🌸

ご来店から1ヶ月が経ちました✨
眉毛・まつげのケアはいかがですか？

そろそろ整える時期です😊
今月もご来店いただけると嬉しいです！

お気軽にご予約・ご相談ください📅"""

    if t == "ステップ60日":
        return f"""こんにちは！{store}です💝

ご来店から2ヶ月が経ちました！
{name}様にまた会いたいな〜と思いつつご連絡しました😊

今月限定のお得なキャンペーンもございます✨
ぜひまたご来店ください！

📱 ご予約・ご相談はこちらのLINEへお気軽に🌸"""

    return None


# ── GAS API ───────────────────────────────────────────────
def gas_post(action, data=None):
    body = {"key": SECRET, "action": action}
    if data:
        body.update(data)
    r = requests.post(GAS_URL, json=body, timeout=30)
    return r.json()

def gas_get(action, params=None):
    p = {"key": SECRET, "action": action}
    if params:
        p.update(params)
    r = requests.get(GAS_URL, params=p, timeout=30)
    return r.json()


# ── LINE 個別送信 ─────────────────────────────────────────
def send_line_push(line_uid, text):
    payload = {
        "to": line_uid,
        "messages": [{"type": "text", "text": text}],
    }
    r = requests.post(f"{LINE_API}/message/push", headers=LINE_HEADERS, json=payload, timeout=15)
    return r.status_code == 200, r.json()


# ── ログ ─────────────────────────────────────────────────
def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line_str = f"[{ts}] {msg}"
    print(line_str)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line_str + "\n")


# ── メイン ───────────────────────────────────────────────
def main():
    if GAS_URL == "YOUR_GAS_WEB_APP_URL_HERE":
        log("⚠️  GAS_URLが設定されていません。gas_backend.js をデプロイしてURLを設定してください。")
        sys.exit(0)

    log("=" * 50)
    log("LINE自動追尾 開始")

    # 送信待ちリスト取得
    try:
        result = gas_post("get_pending_follow")
        pending = result.get("pending", [])
    except Exception as e:
        log(f"❌ GAS取得エラー: {e}")
        sys.exit(1)

    log(f"送信対象: {len(pending)}件")

    sent = 0
    failed = 0

    for item in pending:
        t        = item.get("type", "")
        name     = item.get("name", "")
        phone    = item.get("phone", "")
        line_uid = item.get("line_uid", "")

        if not line_uid:
            log(f"⏭ スキップ（LINE未登録）: {name} {phone}")
            continue

        msg = make_message(item)
        if not msg:
            log(f"⏭ スキップ（テンプレートなし）: {t}")
            continue

        log(f"📤 送信: {t} → {name}（{phone}）")

        success, resp = send_line_push(line_uid, msg)

        # ログ保存（GAS）
        try:
            log_data = {
                "data": {
                    "phone":    phone,
                    "name":     name,
                    "line_uid": line_uid,
                    "type":     t,
                    "content":  msg[:100],
                    "status":   "成功" if success else "失敗",
                    "error":    "" if success else str(resp),
                }
            }
            gas_post("log_line", log_data)
        except Exception as e:
            log(f"  ログ保存エラー: {e}")

        if success:
            log(f"  ✅ 送信成功")
            sent += 1
        else:
            log(f"  ❌ 送信失敗: {resp}")
            failed += 1

    log(f"完了: 成功 {sent}件 / 失敗 {failed}件")
    log("=" * 50)


if __name__ == "__main__":
    main()
