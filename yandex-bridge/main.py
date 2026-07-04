# -*- coding: utf-8 -*-
"""Мост между Analog Player и Яндекс Музыкой.

Обёртка над MarshalX/yandex-music-api: приложение шлёт токен пользователя,
мост возвращает плейлисты/треки и отдаёт поток через redirect на прямую
ссылку (ссылки временные, поэтому резолвятся в момент воспроизведения).

Запуск:  uvicorn main:app --host 0.0.0.0 --port 8977
"""

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from yandex_music import Client
from yandex_music.exceptions import YandexMusicError

app = FastAPI(title="Yandex Music Bridge", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_clients: dict[str, Client] = {}


def get_client(token: str) -> Client:
    token = (token or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Нужен токен Яндекс Музыки")
    client = _clients.get(token)
    if client is None:
        try:
            client = Client(token).init()
        except YandexMusicError as error:
            raise HTTPException(status_code=401, detail=f"Токен не принят: {error}")
        _clients[token] = client
    return client


def track_payload(track) -> dict:
    cover = f"https://{track.cover_uri.replace('%%', '400x400')}" if track.cover_uri else None
    artists = ", ".join(artist.name for artist in (track.artists or []) if artist.name)
    return {
        "id": track.track_id if ":" in str(track.track_id) else str(track.id),
        "title": track.title or "Без названия",
        "artists": artists or "Неизвестный исполнитель",
        "album": track.albums[0].title if track.albums else "Яндекс Музыка",
        "durationMs": track.duration_ms or 0,
        "cover": cover,
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/playlists")
def playlists(x_yandex_token: str = Header("")) -> list[dict]:
    client = get_client(x_yandex_token)
    items = [{"kind": "liked", "title": "Мне нравится", "count": None}]
    try:
        user_playlists = client.users_playlists_list() or []
    except YandexMusicError as error:
        raise HTTPException(status_code=502, detail=f"Яндекс не ответил: {error}")
    for playlist in user_playlists:
        items.append({
            "kind": str(playlist.kind),
            "title": playlist.title or "Без названия",
            "count": playlist.track_count,
        })
    return items


@app.get("/playlists/{kind}/tracks")
def playlist_tracks(kind: str, x_yandex_token: str = Header("")) -> list[dict]:
    client = get_client(x_yandex_token)
    try:
        if kind == "liked":
            liked = client.users_likes_tracks()
            short_tracks = liked.tracks if liked else []
        else:
            playlist = client.users_playlists(int(kind))
            short_tracks = playlist.tracks or []
        track_ids = [short.track_id for short in short_tracks]
        tracks = client.tracks(track_ids) if track_ids else []
    except (YandexMusicError, ValueError) as error:
        raise HTTPException(status_code=502, detail=f"Не удалось получить треки: {error}")
    return [track_payload(track) for track in tracks if track is not None and track.available]


@app.get("/search")
def search(text: str = Query(""), x_yandex_token: str = Header("")) -> dict:
    client = get_client(x_yandex_token)
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Пустой запрос")
    try:
        result = client.search(text)
    except YandexMusicError as error:
        raise HTTPException(status_code=502, detail=f"Поиск не удался: {error}")
    found_tracks = result.tracks.results if result and result.tracks else []
    found_albums = result.albums.results if result and result.albums else []
    return {
        "tracks": [track_payload(track) for track in found_tracks[:25] if track.available],
        "albums": [
            {
                "id": str(album.id),
                "title": album.title or "Без названия",
                "artists": ", ".join(artist.name for artist in (album.artists or []) if artist.name),
                "count": album.track_count,
                "year": album.year,
            }
            for album in found_albums[:12]
        ],
    }


@app.get("/albums/{album_id}/tracks")
def album_tracks(album_id: str, x_yandex_token: str = Header("")) -> list[dict]:
    client = get_client(x_yandex_token)
    try:
        album = client.albums_with_tracks(int(album_id))
    except (YandexMusicError, ValueError) as error:
        raise HTTPException(status_code=502, detail=f"Не удалось получить альбом: {error}")
    tracks = [track for volume in (album.volumes or []) for track in volume]
    return [track_payload(track) for track in tracks if track is not None and track.available]


@app.get("/stream/{track_id}")
def stream(track_id: str, token: str = Query("")) -> RedirectResponse:
    client = get_client(token)
    try:
        tracks = client.tracks([track_id])
        if not tracks:
            raise HTTPException(status_code=404, detail="Трек не найден")
        infos = tracks[0].get_download_info(get_direct_links=True) or []
    except YandexMusicError as error:
        raise HTTPException(status_code=502, detail=f"Не удалось получить поток: {error}")
    mp3 = [info for info in infos if info.codec == "mp3" and info.direct_link]
    if not mp3:
        raise HTTPException(status_code=404, detail="Нет доступного mp3-потока")
    best = max(mp3, key=lambda info: info.bitrate_in_kbps or 0)
    return RedirectResponse(best.direct_link, status_code=307)
