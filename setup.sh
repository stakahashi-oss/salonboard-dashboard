#!/bin/bash
# 必要ライブラリのインストール

echo "必要なライブラリをインストールします..."

pip3 install flask flask-cors pandas requests

echo ""
echo "✅ インストール完了！"
echo ""
echo "起動するには:"
echo "  bash /Users/shou/.salonboard_dashboard/start.sh"
