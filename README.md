# Resonance

Resonance is a Capacitor-based Android music player focused on local listening, playlists, internet radio, audiobooks, and hands-on playback controls.

## Features

- Local audio library with folders, artists, albums, playlists, queue, and search.
- Editable local track metadata for title, artist, and album.
- Playlist ordering and sorting by recent additions, title, artist, source, and most-played tracks.
- Internet radio section with station search and favorites-style library entries.
- Large player with swipe gestures, vintage and modern themes, EQ presets, loudness, mono, speech mode, sleep timer, warmth, and playback speed.
- Android media-session integration for lock-screen and notification controls.
- Optional Yandex Music bridge for importing account playlists through a local helper service.
- Track sharing through Android share targets when the platform supports it.

## Android Build

Install dependencies:

```bash
npm install
```

Build and sync the web app into Android:

```bash
npm run android:sync
```

Build a debug APK:

```bash
npm run android:apk
```

Build a release APK:

```bash
cd android
./gradlew assembleRelease
```

The release APK is generated at:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## Release Notes

Current app version: `1.7.0`.

This release includes radio playback stability work, Android media-session hardening, local metadata editing, track sharing, hidden in-app scrollbars, and UI alignment fixes.

## Repository Description

Use this as the GitHub repository description:

```text
Android music player with local library management, playlists, radio, EQ, metadata editing, sharing, and media-session controls.
```

## Yandex Music Bridge

The optional bridge lives in `yandex-bridge/`. It is a small local Python service used to resolve Yandex Music playlists and stream URLs for the app.

See [yandex-bridge/README.md](yandex-bridge/README.md) for setup details.
