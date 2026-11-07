# Kube application

React + TypeScript + Vite, with Electron desktop packaging and Capacitor Android.
The existing `website/` landing page and `brand/` assets are separate from the application.

## GitHub builds

The **Build Kube** workflow runs on pushes, pull requests, and manual dispatches.
Open [Actions](https://github.com/kebab-software/kube/actions/workflows/build.yml),
choose a run, and download its artifacts when it completes:

- `kube-web`: static web build.
- `kube-android-debug`: installable debug APK.
- `kube-desktop-windows-latest`: Windows installer.
- `kube-desktop-macos-latest`: unsigned macOS disk image.
- `kube-desktop-ubuntu-latest`: Linux AppImage.

Artifacts are retained for 14 days. Android and desktop jobs run only after tests
and the web build pass. These builds do not require release-signing secrets and do
not publish a GitHub Release. To build manually, select **Run workflow** on the
workflow page. Live Invidious availability is checked separately from CI so an
external instance outage does not make deterministic builds fail.

## Development and web

Install Node.js 22.12 or newer, then run:

```sh
npm ci
npm run dev
npm run check
```

`npm run build` writes the static web application to `dist/`. Serve that directory
over HTTPS. The app uses in-memory navigation, so no server-side route rewriting is
required. Web requests require an Invidious instance with CORS enabled.

Copy `.env.example` to `.env.local` to choose an initial endpoint at build time.
Users can change the endpoint in Settings. No backend secrets are required.

## Desktop

```sh
npm run desktop
npm run build:desktop
```

Electron Builder produces the host platform's installer in `release/`: NSIS on
Windows, DMG on macOS, AppImage on Linux. Build each platform on its corresponding
OS. Distribution signing/notarization requires your own certificates and release
configuration. The renderer runs sandboxed with Node integration disabled. A
restricted preload bridge permits HTTPS Invidious JSON requests without disabling
Chromium web security.

## Android

Install Android Studio, Android SDK platform 36, build tools, and a Gradle-compatible
JDK 21 or newer. Set `ANDROID_HOME` and `JAVA_HOME` to these installations.

```sh
npm run android:sync
npm run android:open
npm run build:android
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
`npm run build:android:release` builds an unsigned release bundle. Configure your own
keystore with Android Studio before distributing a signed release. Never commit
keystores or passwords.

The native Media3 service owns audio playback, audio focus, headphone-disconnect
handling, and the system media notification. Prepared upcoming tracks use Invidious
itag 140 (M4A). Background queue transitions, notification controls, interruptions,
and device-specific battery behaviour still require physical-device verification.
Recommendation-driven queue extension runs in the React layer; it may wait until
the WebView resumes after the prepared native queue ends. Listening time recorded
by the JavaScript polling loop can undercount while the WebView is suspended.

## Real API diagnostics

```sh
npm run smoke:live
```

This is separate from deterministic unit tests. It contacts the official registry,
searches a real song, resolves its metadata, then requests actual audio bytes from
the instance proxy. Set `INVIDIOUS_INSTANCE` to test a particular HTTPS origin.

The default endpoint is `https://yt.chocolatemoo53.com`, listed in the official
registry at implementation time. Public instances are independently operated and
may disable APIs, impose challenges, or lose upstream playback access. A successful
search is not proof of working audio. Kube does not bypass challenges or silently
fall back to Google media servers. Choose a functioning API-enabled instance in
Settings or host your own Invidious instance.

## Local library and recommendations

Likes, playlists, artist follows, hidden tracks, preferences, and listening history
are stored using Capacitor Preferences (localStorage on web/desktop). Backups have
a versioned, validated JSON format. Android exports through the system file picker.
Unreadable storage is not automatically overwritten. There is no account sync,
telemetry, or offline audio download. Instance operators still observe requests.

Recommendations combine music trending results, related videos from up to three
listening/liked seeds, and uploads from up to two followed channels. Ranking uses
likes, completed listening, early skips, a 21-day affinity decay, recent-play
penalties, adjustable exploration, and artist diversification. This is an independent
heuristic recommender; it does not reproduce YouTube Music's proprietary model.
Invidious is a video API, so channel uploads and related videos can include nonmusic.

## Verification state

- A production web build completed successfully, and 13 unit tests passed.
- The latest native queue TypeScript integration and updated test dependencies pass
  the 13 unit tests; native platform verification is performed by the GitHub jobs.
- Real default-instance search and video detail requests succeeded.
- The audio-byte smoke test failed with HTTP 403 from the instance's proxy.
- Android and desktop packages have not yet been compiled or launched.
- Browser interaction and physical Android playback have not yet been verified.
- Production dependencies reported no advisories at the first audit. After test-tool
  updates, npm reported six moderate development dependency advisories; review before
  release.

The implementation is **not yet release-verified**. Do not treat the current build
output or platform configuration as evidence that end-to-end playback works.

References: [Invidious API](https://docs.invidious.io/api/),
[official instances](https://docs.invidious.io/instances/),
[Capacitor Android](https://capacitorjs.com/docs/android),
[Media3 background playback](https://developer.android.com/media/media3/session/background-playback).
