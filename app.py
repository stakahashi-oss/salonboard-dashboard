from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import pandas as pd
import json, os, subprocess, requests, io, sqlite3
from datetime import datetime, date, timedelta
from config import LINE_CHANNEL_ACCESS_TOKEN, SPREADSHEET_ID, DATA_DIR, GAS_URL, PUBLIC_URL

DB_PATH = os.path.join(DATA_DIR, "counseling.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS counseling (
            id          TEXT PRIMARY KEY,
            created_at  TEXT,
            store       TEXT,
            visit_date  TEXT,
            reservation_id TEXT,
            phone       TEXT,
            name        TEXT,
            menu        TEXT,
            staff       TEXT,
            skin_type   TEXT,
            allergy     TEXT,
            allergy_detail TEXT,
            past_treatment TEXT,
            request     TEXT,
            treatment_memo TEXT,
            next_menu   TEXT,
            next_timing TEXT,
            line_uid    TEXT,
            line_status TEXT DEFAULT '未送信'
        );
        CREATE TABLE IF NOT EXISTS line_log (
            id          TEXT PRIMARY KEY,
            sent_at     TEXT,
            phone       TEXT,
            name        TEXT,
            line_uid    TEXT,
            msg_type    TEXT,
            content     TEXT,
            status      TEXT,
            error       TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS line_friends (
            line_uid    TEXT PRIMARY KEY,
            phone       TEXT,
            name        TEXT,
            registered_at TEXT,
            last_visit  TEXT DEFAULT ''
        );
    """)
    conn.commit()
    conn.close()

init_db()

app = Flask(__name__)
CORS(app)

LINE_HEADERS = {
    "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
    "Content-Type": "application/json",
}
LINE_API = "https://api.line.me/v2/bot"


# ── Static ───────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(DATA_DIR, "dashboard.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(DATA_DIR, filename)

@app.route("/counseling")
@app.route("/counseling/")
def counseling():
    return send_from_directory(os.path.join(DATA_DIR, "counseling"), "index.html")


# ══════════════════════════════════════════════════════════
#  カウンセリングシート API（SQLite + Google Sheets 二重保存）
# ══════════════════════════════════════════════════════════

def gas_post(action, data=None):
    """GAS Web AppにPOSTしてスプレッドシートに書き込む（エラーは無視）"""
    if not GAS_URL:
        return
    try:
        body = {"key": "ssin2026", "action": action}
        if data:
            body["data"] = data
        requests.post(GAS_URL, json=body, timeout=10)
    except Exception:
        pass  # GAS失敗してもSQLiteには保存済みなので続行


# ── カウンセリング保存（SQLite + Google Sheets） ──────────
@app.route("/api/counseling/save", methods=["POST"])
def counseling_save():
    try:
        d = request.json
        rec_id = "C" + str(int(datetime.now().timestamp()))
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # SQLiteに保存
        conn = get_db()
        conn.execute("""
            INSERT INTO counseling VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (rec_id, now, d.get("store",""), d.get("visit_date",""), d.get("reservation_id",""),
              d.get("phone",""), d.get("name",""), d.get("menu",""), d.get("staff",""),
              d.get("skin_type",""), d.get("allergy","なし"), d.get("allergy_detail",""),
              d.get("past_treatment",""), d.get("request",""), d.get("treatment_memo",""),
              d.get("next_menu",""), d.get("next_timing",""),
              d.get("line_uid",""), "未送信"))
        conn.commit()
        conn.close()

        # Googleスプレッドシートにも保存（GAS経由）
        gas_post("save_counseling", d)

        return jsonify({"status": "ok", "id": rec_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── 電話番号で検索（予約 + カウンセリング履歴） ───────────
@app.route("/api/counseling/search")
def counseling_search():
    phone = request.args.get("phone","").replace("-","")
    # 予約スプレッドシートから検索
    reservations = []
    try:
        url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv"
        resp = requests.get(url, timeout=15, allow_redirects=True)
        df = pd.read_csv(io.StringIO(resp.content.decode("utf-8")))
        df.columns = df.columns.str.strip()
        df = df.fillna("")
        if "来店日" in df.columns:
            df["来店日"] = pd.to_datetime(df["来店日"], errors="coerce").dt.strftime("%Y-%m-%d")
        phone_col = "電話番号" if "電話番号" in df.columns else (df.columns[14] if len(df.columns) > 14 else None)
        if phone_col:
            matched = df[df[phone_col].astype(str).str.replace("-","") == phone]
            for _, r in matched.head(5).iterrows():
                reservations.append({
                    "reservation_id": str(r.get("予約番号", r.iloc[0])),
                    "status":   str(r.get("ステータス", r.iloc[1])),
                    "store":    str(r.get("店舗名", r.iloc[2])),
                    "staff":    str(r.get("スタッフ名", r.iloc[4] if len(r)>4 else "")),
                    "visit_date": str(r.get("来店日", r.iloc[6] if len(r)>6 else "")),
                    "start_time": str(r.get("開始時間", r.iloc[7] if len(r)>7 else "")),
                    "menu":     str(r.get("予約時メニュー", r.iloc[11] if len(r)>11 else "")),
                    "name":     str(r.get("お名前", r.iloc[13] if len(r)>13 else "")),
                    "phone":    str(r.get("電話番号", r.iloc[14] if len(r)>14 else "")),
                    "first_visit": str(r.get("初来店フラグ", r.iloc[20] if len(r)>20 else "")),
                })
    except Exception as e:
        pass

    # SQLiteからカウンセリング履歴
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM counseling WHERE replace(phone,'-','')=? ORDER BY created_at DESC LIMIT 5",
        (phone,)
    ).fetchall()
    conn.close()
    past = [dict(r) for r in rows]
    return jsonify({"reservations": reservations, "past_counseling": past})


# ── カウンセリング一覧 ────────────────────────────────────
@app.route("/api/counseling/list")
def counseling_list():
    conn = get_db()
    rows = conn.execute("SELECT * FROM counseling ORDER BY created_at DESC LIMIT 100").fetchall()
    conn.close()
    return jsonify({"records": [dict(r) for r in rows]})


# ── LINE友だち登録（Webhook連携用） ─────────────────────
@app.route("/api/counseling/register_friend", methods=["POST"])
def register_friend():
    try:
        d = request.json
        conn = get_db()
        conn.execute("""
            INSERT OR REPLACE INTO line_friends VALUES (?,?,?,?,?)
        """, (d.get("line_uid",""), d.get("phone",""), d.get("name",""),
              datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ""))
        conn.commit()
        conn.close()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── LINE配信ログ保存 ─────────────────────────────────────
@app.route("/api/counseling/log_line", methods=["POST"])
def log_line_send():
    try:
        d = request.json
        log_id = "L" + str(int(datetime.now().timestamp()))
        conn = get_db()
        conn.execute("INSERT INTO line_log VALUES (?,?,?,?,?,?,?,?,?)",
            (log_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
             d.get("phone",""), d.get("name",""), d.get("line_uid",""),
             d.get("type",""), d.get("content",""), d.get("status",""), d.get("error","")))
        conn.commit()
        conn.close()
        return jsonify({"status": "ok", "id": log_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── 予約データ ────────────────────────────────────────────
@app.route("/api/reservations")
def reservations():
    try:
        url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv"
        resp = requests.get(url, timeout=15, allow_redirects=True)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.content.decode("utf-8")))
        df.columns = df.columns.str.strip()
        if "来店日" in df.columns:
            df["来店日"] = pd.to_datetime(df["来店日"], errors="coerce").dt.strftime("%Y-%m-%d")
        df = df.fillna("")
        today = date.today().strftime("%Y-%m-%d")
        status_counts = df["ステータス"].value_counts().to_dict() if "ステータス" in df.columns else {}
        store_counts = df["店舗名"].value_counts().to_dict() if "店舗名" in df.columns else {}
        revenue = 0
        if "来店処理金額" in df.columns:
            paid = df[df["ステータス"] == "会計済み"]["来店処理金額"]
            paid_num = pd.to_numeric(paid.astype(str).str.replace(",","").str.replace("¥",""), errors="coerce")
            revenue = int(paid_num.sum())
        return jsonify({
            "records": df.to_dict(orient="records"),
            "summary": {
                "total": len(df),
                "today": len(df[df["来店日"] == today]) if "来店日" in df.columns else 0,
                "status": status_counts,
                "stores": store_counts,
                "revenue": revenue,
            },
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Lステップ データ ──────────────────────────────────────
@app.route("/api/lstep")
def lstep():
    try:
        def load(name):
            p = os.path.join(DATA_DIR, name)
            return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
        stats = load("lstep_stats.json")
        nav   = load("lstep_nav.json")
        logs  = json.load(open(os.path.join(DATA_DIR,"lstep_sendlogs.json"), encoding="utf-8")) \
                if os.path.exists(os.path.join(DATA_DIR,"lstep_sendlogs.json")) else []
        stats_path = os.path.join(DATA_DIR, "lstep_stats.json")
        updated = datetime.fromtimestamp(os.path.getmtime(stats_path)).strftime("%Y-%m-%d %H:%M:%S") \
                  if os.path.exists(stats_path) else None
        return jsonify({"stats": stats, "nav": nav, "sendlogs": logs, "updated_at": updated})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/refresh/lstep", methods=["POST"])
def refresh_lstep():
    try:
        subprocess.Popen(["python3", os.path.join(DATA_DIR, "lstep_get_stats.py")])
        return jsonify({"status": "started", "message": "Lステップのデータ取得を開始しました。ブラウザでreCAPTCHAを確認してください。"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ══════════════════════════════════════════════════════════
#  LINE API 統合
# ══════════════════════════════════════════════════════════

# ── Bot 基本情報 ──────────────────────────────────────────
@app.route("/api/line/info")
def line_info():
    try:
        r = requests.get(f"{LINE_API}/info", headers=LINE_HEADERS, timeout=10)
        data = r.json()
        # 友だち統計
        today_str = date.today().strftime("%Y%m%d")
        fr = requests.get(f"{LINE_API}/insight/followers?date={today_str}", headers=LINE_HEADERS, timeout=10)
        followers = fr.json()
        data.update(followers)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── 友だち統計（過去30日） ────────────────────────────────
@app.route("/api/line/followers")
def line_followers():
    try:
        results = []
        for i in range(30):
            d = (date.today() - timedelta(days=i)).strftime("%Y%m%d")
            r = requests.get(f"{LINE_API}/insight/followers?date={d}", headers=LINE_HEADERS, timeout=8)
            data = r.json()
            if data.get("status") == "ready":
                results.append({
                    "date": d[:4]+"-"+d[4:6]+"-"+d[6:],
                    "followers": data.get("followers", 0),
                    "blocks": data.get("blocks", 0),
                    "targetedReaches": data.get("targetedReaches", 0),
                })
        return jsonify({"data": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── メッセージ配信統計（過去30日） ───────────────────────
@app.route("/api/line/delivery")
def line_delivery():
    try:
        results = []
        for i in range(30):
            d = (date.today() - timedelta(days=i)).strftime("%Y%m%d")
            r = requests.get(f"{LINE_API}/insight/message/delivery?date={d}", headers=LINE_HEADERS, timeout=8)
            data = r.json()
            if data.get("status") == "ready":
                results.append({
                    "date": d[:4]+"-"+d[4:6]+"-"+d[6:],
                    "broadcast": data.get("broadcast", 0),
                    "targeting": data.get("targeting", 0),
                    "delivered": data.get("delivered", 0),
                })
        return jsonify({"data": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── 一斉配信 送信 ─────────────────────────────────────────
@app.route("/api/line/broadcast", methods=["POST"])
def line_broadcast():
    try:
        body = request.json
        msg_type = body.get("type", "text")
        content  = body.get("content", "")

        if msg_type == "text":
            messages = [{"type": "text", "text": content}]

        elif msg_type == "image":
            messages = [{
                "type": "image",
                "originalContentUrl": body.get("imageUrl", ""),
                "previewImageUrl": body.get("imageUrl", ""),
            }]

        elif msg_type == "flex":
            messages = [{
                "type": "flex",
                "altText": body.get("altText", "メッセージが届きました"),
                "contents": json.loads(content),
            }]

        else:
            return jsonify({"error": "unsupported message type"}), 400

        payload = {"messages": messages}
        r = requests.post(f"{LINE_API}/message/broadcast", headers=LINE_HEADERS,
                          json=payload, timeout=15)
        result = r.json()

        # 送信ログを保存
        log_path = os.path.join(DATA_DIR, "line_broadcast_log.json")
        logs = json.load(open(log_path, encoding="utf-8")) if os.path.exists(log_path) else []
        logs.insert(0, {
            "sent_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type": msg_type,
            "content": content[:100],
            "status": "success" if r.status_code == 200 else "error",
            "response": result,
        })
        json.dump(logs[:50], open(log_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

        if r.status_code == 200:
            return jsonify({"status": "success", "message": "配信しました"})
        else:
            return jsonify({"status": "error", "detail": result}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── ナローキャスト（条件付き配信） ───────────────────────
@app.route("/api/line/narrowcast", methods=["POST"])
def line_narrowcast():
    try:
        body = request.json
        content = body.get("content", "")
        payload = {
            "messages": [{"type": "text", "text": content}],
            "recipient": body.get("recipient"),   # None で全員
            "filter": body.get("filter"),
            "limit": body.get("limit"),
        }
        # None キーを除去
        payload = {k: v for k, v in payload.items() if v is not None}
        r = requests.post(f"{LINE_API}/message/narrowcast", headers=LINE_HEADERS,
                          json=payload, timeout=15)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── 配信ログ取得 ──────────────────────────────────────────
@app.route("/api/line/broadcast/log")
def broadcast_log():
    try:
        log_path = os.path.join(DATA_DIR, "line_broadcast_log.json")
        logs = json.load(open(log_path, encoding="utf-8")) if os.path.exists(log_path) else []
        return jsonify({"logs": logs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Webhook（友だち追加・メッセージ受信） ─────────────────
@app.route("/webhook", methods=["POST"])
def webhook():
    try:
        body = request.json
        events = body.get("events", [])
        for event in events:
            etype = event.get("type")
            user_id = event.get("source", {}).get("userId", "")
            if etype == "follow":
                _log_webhook("follow", user_id, "友だち追加")
                _send_counseling_link(user_id)
            elif etype == "unfollow":
                _log_webhook("unfollow", user_id, "ブロック/削除")
            elif etype == "message":
                text = event.get("message", {}).get("text", "")
                _log_webhook("message", user_id, text[:50])
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _send_counseling_link(user_id):
    """友だち追加時にカウンセリングフォームURLを自動送信"""
    base = PUBLIC_URL if PUBLIC_URL else "http://192.168.100.111:5001"
    form_url = f"{base}/counseling/?uid={user_id}"
    message = (
        "友だち追加ありがとうございます！😊\n"
        "SSIN STUDIO / most eyes / LUMISS です✨\n\n"
        "ご来店前に下記のカウンセリングシートにご記入いただけると\n"
        "スムーズにご案内できます📋\n\n"
        f"▼ カウンセリングシート\n{form_url}\n\n"
        "ご不明点はこちらのLINEへお気軽にどうぞ🌸"
    )
    try:
        requests.post(
            f"{LINE_API}/message/push",
            headers=LINE_HEADERS,
            json={"to": user_id, "messages": [{"type": "text", "text": message}]},
            timeout=10,
        )
    except Exception:
        pass


def _log_webhook(event_type, user_id, content):
    log_path = os.path.join(DATA_DIR, "line_webhook_log.json")
    logs = json.load(open(log_path, encoding="utf-8")) if os.path.exists(log_path) else []
    logs.insert(0, {
        "type": event_type,
        "user_id": user_id,
        "content": content,
        "received_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })
    json.dump(logs[:200], open(log_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


# ── サマリー ──────────────────────────────────────────────
@app.route("/api/summary")
def summary():
    try:
        url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv"
        resp = requests.get(url, timeout=15, allow_redirects=True)
        df = pd.read_csv(io.StringIO(resp.content.decode("utf-8")))
        df.columns = df.columns.str.strip()
        if "来店日" in df.columns:
            df["来店日"] = pd.to_datetime(df["来店日"], errors="coerce").dt.strftime("%Y-%m-%d")
        df = df.fillna("")
        today = date.today().strftime("%Y-%m-%d")
        today_count = len(df[df["来店日"] == today]) if "来店日" in df.columns else 0
        lstep_total = 0
        stats_path = os.path.join(DATA_DIR, "lstep_stats.json")
        if os.path.exists(stats_path):
            stats = json.load(open(stats_path, encoding="utf-8"))
            for row in stats.get("送信数分析", []):
                if len(row) == 3 and row[0] == "合計":
                    try: lstep_total = int(row[1]) + int(row[2])
                    except: pass
        return jsonify({
            "today_reservations": today_count,
            "total_reservations": len(df),
            "lstep_sends_this_month": lstep_total,
            "today": today,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("=" * 50)
    print("  ダッシュボード起動中...")
    print(f"  ローカル:  http://localhost:5001")
    print(f"  LAN:      http://0.0.0.0:5001")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5001, debug=False)
