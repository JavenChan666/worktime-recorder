#!/usr/bin/env bash
# 从各分类目录重新生成可运行的「07-运行时」目录并打成 zip
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/07-运行时"
rm -rf "$RUN"
mkdir -p "$RUN/js" "$RUN/css" "$RUN/icons"
cp "$ROOT/01-应用入口/index.html"          "$RUN/"
cp "$ROOT/01-应用入口/manifest.webmanifest" "$RUN/"
cp "$ROOT/01-应用入口/sw.js"               "$RUN/"
cp "$ROOT/02-样式/style.css"               "$RUN/css/"
cp "$ROOT/03-业务脚本/"*.js                 "$RUN/js/"
cp "$ROOT/04-应用图标/"*.png                "$RUN/icons/"
cd "$ROOT"
zip -rq "../工时记录助手-源码包.zip" . -x "*.DS_Store"
echo "已重新打包：$(cd .. && pwd)/工时记录助手-源码包.zip"
