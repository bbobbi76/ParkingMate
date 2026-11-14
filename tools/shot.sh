#!/usr/bin/env bash
# 휴대폰 크기 전체 화면 스크린샷: bash tools/shot.sh <경로> <출력파일> [높이] [기준주소]
# 예) bash tools/shot.sh / docs/shots/home.png 2000
#     bash tools/shot.sh /p/wirari out.png 1800 https://parking-mate.vercel.app
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
BASE="${4:-http://localhost:5173}"
URL="$BASE$1"
OUT="$(cygpath -w "$(realpath -m "$2")")"
H="${3:-1800}"
PROFILE="$(cygpath -w "${TEMP:-/tmp}/parkingmate-shot-profile")"   # 개인 브라우저 프로필과 분리
mkdir -p "$(dirname "$2")"
"$EDGE" --headless=new --user-data-dir="$PROFILE" --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=520,"$H" --virtual-time-budget=8000 --screenshot="$OUT" "$URL" >/dev/null 2>&1
echo "$OUT"
