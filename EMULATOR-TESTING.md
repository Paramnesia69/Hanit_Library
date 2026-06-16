# Emulator testing (iOS Simulator + Android)

The app is a **web app (PWA)**, so "connecting an emulator" = opening the live URL in
the emulator's browser. Both emulators are driven from the CLI — no native build needed.

## Standing rule
**After every push to `main`, test the app on BOTH emulators.** Pushing to `main`
auto-deploys to Vercel, so wait for the new build, then open it on both and eyeball it.
One command does it:

```bash
scripts/test-emulators.sh --wait-deploy
```

This waits until the new Vercel build is live (the main JS chunk hash changes), opens
`https://hanit-library.vercel.app/` on the booted iOS Simulator **and** the running
Android emulator, and saves a screenshot of each to `$TMPDIR` (`hanit-ios.png`,
`hanit-android.png`). It warns (doesn't fail) if an emulator isn't running.

To test a local build instead: `scripts/test-emulators.sh http://localhost:4173/`
(start it with `npx vite preview --host --port 4173` first; Android reaches the host at
`http://10.0.2.2:4173/`). Note: admin unlock needs the `/api` backend, so use prod or
`vercel dev` — not static `vite preview`.

## Connection settings

### iOS Simulator (Xcode)
- Device used: **iPhone 17 Pro** (any booted device works — the commands target `booted`).
- Open a URL in Simulator Safari:
  ```bash
  xcrun simctl openurl booted "https://hanit-library.vercel.app/"
  ```
- Screenshot the Simulator:
  ```bash
  xcrun simctl io booted screenshot /tmp/hanit-ios.png
  ```
- List booted devices: `xcrun simctl list devices booted`

### Android emulator (Google / Android Studio)
- `adb` path on this Mac: `~/Library/Android/sdk/platform-tools/adb`
- Device id seen: **`emulator-5554`** (`sdk_gphone16k_arm64`, 1080×2340).
  The script auto-picks the first `device` from `adb devices`.
- Open a URL in the emulator browser:
  ```bash
  ~/Library/Android/sdk/platform-tools/adb -s emulator-5554 \
    shell am start -a android.intent.action.VIEW -d "https://hanit-library.vercel.app/"
  ```
- Screenshot the emulator:
  ```bash
  ~/Library/Android/sdk/platform-tools/adb -s emulator-5554 exec-out screencap -p > /tmp/hanit-android.png
  ```
- Tap (e.g. to dismiss a Chrome promo): `adb -s emulator-5554 shell input tap <x> <y>`
- The Android emulator reaches the host machine's `localhost` via **`10.0.2.2`**.

## Admin mode while testing
Browsing is open to everyone; admin controls (edit, data tools, full offline download)
appear only after **⋮ → כניסת אדמין → the Vercel `EDIT_PASSPHRASE`**. This works on prod
(and `vercel dev`) but NOT on static `vite preview` (no `/api`). The passphrase is stored
per-browser in `localStorage['hanit-library:editpass']`, so each emulator stays logged in.
