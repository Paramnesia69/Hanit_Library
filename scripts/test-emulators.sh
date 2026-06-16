#!/usr/bin/env bash
# Open the app on BOTH local emulators (iOS Simulator + Android) and screenshot each.
# Used to smoke-test after every push (see EMULATOR-TESTING.md).
#
# Usage:
#   scripts/test-emulators.sh [URL] [--wait-deploy]
#     URL           default: https://hanit-library.vercel.app/
#     --wait-deploy poll prod until the main JS chunk hash changes (new build live),
#                   then test — so you test the deploy you just pushed, not the old one.
#
# Exits 0 even if an emulator is off (it just warns) — it must never block a push.

set -uo pipefail

URL="https://hanit-library.vercel.app/"
WAIT=0
for a in "$@"; do
  case "$a" in
    --wait-deploy) WAIT=1 ;;
    http*) URL="$a" ;;
  esac
done

ADB="$(command -v adb || echo "$HOME/Library/Android/sdk/platform-tools/adb")"
OUT_DIR="${TMPDIR:-/tmp}"
IOS_PNG="$OUT_DIR/hanit-ios.png"
AND_PNG="$OUT_DIR/hanit-android.png"

chunk() { curl -s --max-time 8 "$URL" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1; }

if [ "$WAIT" = "1" ] && [[ "$URL" == http*vercel.app* ]]; then
  # get a real (non-empty) baseline first, else any first response looks like a "change"
  before=""
  for i in $(seq 1 6); do before="$(chunk)"; [ -n "$before" ] && break; sleep 2; done
  echo "⏳ waiting for new deploy (baseline: ${before:-unknown})…"
  for i in $(seq 1 40); do      # ~120s max
    now="$(chunk)"
    if [ -n "$now" ] && [ -n "$before" ] && [ "$now" != "$before" ]; then echo "✅ new build live: $now"; break; fi
    sleep 3
  done
fi

echo "🌐 URL under test: $URL"

# ---------- iOS Simulator ----------
if xcrun simctl list devices booted 2>/dev/null | grep -qi booted; then
  dev="$(xcrun simctl list devices booted | grep -i booted | head -1 | sed -E 's/^ *//; s/ \(.*//')"
  xcrun simctl openurl booted "$URL" && echo "📱 iOS: opened on \"$dev\""
  sleep 5
  xcrun simctl io booted screenshot "$IOS_PNG" 2>/dev/null && echo "   screenshot → $IOS_PNG"
else
  echo "⚠️  iOS: no booted Simulator (open Simulator.app first)"
fi

# ---------- Android emulator ----------
if [ -x "$ADB" ] && "$ADB" get-state 1>/dev/null 2>&1; then
  aid="$("$ADB" devices | awk 'NR>1 && $2=="device"{print $1; exit}')"
  "$ADB" -s "$aid" shell am start -a android.intent.action.VIEW -d "$URL" >/dev/null 2>&1 && echo "🤖 Android: opened on $aid"
  sleep 5
  "$ADB" -s "$aid" exec-out screencap -p > "$AND_PNG" 2>/dev/null && echo "   screenshot → $AND_PNG"
else
  echo "⚠️  Android: no running emulator (adb has no device)"
fi

echo "done."
