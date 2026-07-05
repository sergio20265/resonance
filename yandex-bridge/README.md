# Yandex Music Bridge for Resonance

This directory contains a small Python service based on [`MarshalX/yandex-music-api`](https://github.com/MarshalX/yandex-music-api).

The Android app sends the bridge a Yandex Music OAuth token. The bridge returns playlists, tracks, search results, and temporary stream redirects. Playback still happens in the app; the bridge only resolves the account library and fresh stream URLs.

Yandex Music direct links expire quickly, so the bridge resolves a stream URL right when playback starts. Imported playlists therefore do not become stale just because an old URL expired.

## Run

Python 3.10+ is required.

```bash
cd yandex-bridge
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8977
```

Health check:

```text
http://127.0.0.1:8977/health
```

Expected response:

```json
{"ok": true}
```

## Token

The bridge requires a Yandex Music OAuth token. The upstream library documents token retrieval here:

https://yandex-music.readthedocs.io/en/main/token.html

The token is entered in the Android app and stored locally on the device. The bridge keeps it only in memory for client caching and does not write it to disk.

## App Setup

1. Run the bridge on a computer or server reachable from the phone on the same network.
2. In Resonance, open `More -> Sources and import -> Yandex Music`.
3. Set the bridge URL to `http://<computer-ip>:8977`. Do not use `127.0.0.1` from the phone.
4. Paste the token, load playlists, then import the playlist you need.

Imported playlists are stored as local app playlists.

## API

| Method | Path | Header or parameter | Response |
| --- | --- | --- | --- |
| GET | `/health` | none | `{"ok": true}` |
| GET | `/playlists` | `X-Yandex-Token` | `[{kind, title, count}]` |
| GET | `/playlists/{kind}/tracks` | `X-Yandex-Token` | `[{id, title, artists, album, durationMs, cover}]` |
| GET | `/search?text=` | `X-Yandex-Token` | `{tracks: [...], albums: [...]}` |
| GET | `/albums/{album_id}/tracks` | `X-Yandex-Token` | album tracks in playlist-track format |
| GET | `/stream/{track_id}` | `?token=` | `307` redirect to a direct MP3 URL |

## Notes

- The bridge only exposes content available to the provided account.
- Do not expose the bridge to the public internet without authentication and HTTPS. The `/stream` endpoint accepts the token as a query parameter.
- Local-network home usage is the intended setup.
- The APK allows cleartext traffic so the app can talk to an HTTP bridge on the local network.
