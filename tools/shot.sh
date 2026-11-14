#!/usr/bin/env bash
# 휴대폰 크기 전체 화면 스크린샷: bash tools/shot.sh <경로> <출력파일> [높이]
# 예) bash tools/shot.sh / docs/shots/home.png 2000
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
URL="http://localhost:5173$1"
OUT="$(cygpath -w "$(realpath -m "$2")")"
H="${3:-1800}"
mkdir -p "$(dirname "$2")"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=520,"$H" --virtual-time-budget=6000 --screenshot="$OUT" "$URL" 2>/dev/null
echo "$OUT"
