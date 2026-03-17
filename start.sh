#!/bin/bash
# ダッシュボード起動スクリプト

DIR="/Users/shou/.salonboard_dashboard"
cd "$DIR"

echo "========================================"
echo "  ダッシュボード起動中..."
echo "========================================"

# ── Flask サーバー起動
echo ""
echo "[1/3] Flask サーバーを起動..."
python3 app.py &
FLASK_PID=$!
sleep 2

# ── ローカルIPを取得
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "不明")

echo ""
echo "========================================"
echo "  ✅ 起動完了！"
echo ""
echo "  📱 Mac でアクセス:"
echo "     http://localhost:5001"
echo ""
echo "  📱 同じWiFiのスマホからアクセス:"
echo "     http://$LOCAL_IP:5001"
echo ""
echo "  ⚠️  スマホからアクセスできない場合:"
echo "     Mac と スマホ が同じWiFiに接続されているか確認"
echo "========================================"
echo ""
echo "  Ctrl+C で終了"
echo "========================================"

# ── ブラウザを開く
sleep 1
open "http://localhost:5001"

# ── 終了待機
wait $FLASK_PID
