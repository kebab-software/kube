# Kube application

React + TypeScript + Vite, with Tauri 2 desktop packaging and Capacitor Android.
The existing `website/` landing page and `brand/` assets are separate from the application.

## GitHub builds

The **Build Kube** workflow runs on pushes, pull requests, and manual dispatches.
Open [Actions](https://github.com/getkube/kube/actions/workflows/build.yml),
choose a run, and download its artifacts when it completes:

- `kube-web`: static web build.
- `Kube-v<version>-debug.apk`: installable debug APK.
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

Install the Tauri system prerequisites for your OS and stable Rust. Run npm run desktop for development and npm run build:desktop for an installer. Bundles are written under src-tauri/target/release/bundle. Release CI also builds the Electron update channel for existing installations.

## Android

Install Android Studio, Android SDK platform 36, build tools, and a Gradle-compatible
JDK 21 or newer. Set `ANDROID_HOME` and `JAVA_HOME` to these installations.

```sh
npm run android:sync
npm run android:open
npm run build:android
```

The debug APK is written to `android/app/build/outputs/apk/debug/Kube-v<version>-debug.apk`.
`npm run build:android:release` builds a signed release APK and bundle, requiring
the persistent signing environment described in [RELEASING.md](RELEASING.md).
It fails if signing credentials are absent. Never commit keystores or passwords.

The native Media3 service owns audio playback, audio focus, headphone-disconnect
handling, and the system media notification. Prepared upcoming tracks use Invidious
itag 140 (M4A). Background queue transitions, notification controls, interruptions,
and device-specific battery behaviour still require physical-device verification.
Recommendation-driven queue extension runs in the React layer; it may wait until
the WebView resumes after the prepared native queue ends. Listening time recorded
by the JavaScript polling loop can undercount while the WebView is suspended.

## Brand icons

`npm run icons` derives all application artwork from `brand/logo.png` and
`brand/logo-rounded.png`. It runs automatically before development and production
builds. Outputs include the in-app logo, favicon, Apple touch icon, web manifest
icons, Windows ICO, macOS ICNS, Linux PNG, and Android legacy, round, adaptive,
and monochrome launcher icons. Android foreground artwork is padded for launcher
masking. No replacement brand artwork is generated.

## GitHub release attachments

Publishing a stable release such as `v0.2.0` triggers **Publish app release**.
It rebuilds the tagged commit with the release version, signs Android with the
permanent key, and uploads installers and automatic-update metadata. This replaces
copying the latest development artifacts, which lack the right version and signing.

See [RELEASING.md](RELEASING.md) for one-time signing setup, supported update
behaviour, the dry-run workflow, and optional Apple/Windows signing credentials.
Release CI does not publish anything in dry-run mode.

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

- The updated production web build, 20 unit tests, and two desktop/mobile browser
  interaction tests passed locally. Platform packaging is verified in GitHub Actions.
- Real default-instance search and video detail requests succeeded.
- The audio-byte smoke test failed with HTTP 403 from the instance's proxy.
- Android and all three desktop packages compiled successfully in the initial GitHub
  workflow. The latest platform build results are available on the Actions page.
- Physical Android playback and desktop installer runtime behaviour remain unverified.
- The latest dependency installation reported zero known npm vulnerabilities.

The implementation is **not yet release-verified**. Do not treat the current build
output or platform configuration as evidence that end-to-end playback works.

References: [Invidious API](https://docs.invidious.io/api/),
[official instances](https://docs.invidious.io/instances/),
[Capacitor Android](https://capacitorjs.com/docs/android),
[Media3 background playback](https://developer.android.com/media/media3/session/background-playback).
