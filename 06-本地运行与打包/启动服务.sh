#!/usr/bin/env bash
# 本地预览：把整个「运行时」目录跑起来（手机与电脑同 Wi-Fi 即可访问）
# 用法：bash 启动服务.sh [端口]
PORT=${1:-8080}
cd "$(dirname "$0")/../07-运行时" || exit 1
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "服务已启动："
echo "  电脑访问  http://localhost:$PORT"
[ -n "$IP" ] && echo "  手机访问  http://$IP:$PORT   （需同一 Wi-Fi）"
python3 -m http.server "$PORT" --bind 0.0.0.0
