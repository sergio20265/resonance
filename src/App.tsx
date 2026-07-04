import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Capacitor } from '@capacitor/core'
import { MediaSession } from '@jofr/capacitor-media-session'
import { Directory, Filesystem } from '@capacitor/filesystem'

const nativeSession = Capacitor.isNativePlatform()

const audioFileRe = /\.(mp3|m4a|aac|ogg|oga|opus|flac|wav)$/i
const audioMime: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  wav: 'audio/wav',
}

function base64ToBlob(base64: string, mime: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

type Theme = 'vintage' | 'modern'
type View = 'tracks' | 'playlists' | 'folders' | 'artists' | 'modes' | 'eq' | 'sources' | 'settings'
type RepeatMode = 'off' | 'one' | 'all'
type TrackKind = 'music' | 'book'
type SortMode = 'added' | 'title' | 'artist' | 'source'
type LibraryLocation = {
  view: View
  query: string
  selectedArtist: string
  activeFolderId: string
  activePlaylistId: string
}

type Track = {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  folderId: string
  playlistIds: string[]
  kind: TrackKind
  source: 'local' | 'external'
  audioKey?: string
  externalUrl?: string
  cover?: string
  position?: number
  sourcePath?: string
  addedAt: number
}

type Folder = { id: string; name: string }
type Playlist = { id: string; name: string; trackIds: string[] }
type EqPreset = { id: string; name: string; gains: number[] }

type YaTrack = { id: string; title: string; artists: string; album: string; durationMs: number; cover: string | null }
type YaAlbum = { id: string; title: string; artists: string; count: number | null; year: number | null }
type RadioStation = { stationuuid: string; name: string; url_resolved: string; favicon: string; country: string; bitrate: number }

type IconName = 'play' | 'pause' | 'prev' | 'next' | 'more' | 'music' | 'book' | 'trash' | 'plus' | 'sliders' | 'settings' | 'list' | 'folder' | 'wave' | 'shuffle' | 'repeat'

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  }

  switch (name) {
    case 'play':
      return <svg {...common}><path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" /></svg>
    case 'pause':
      return <svg {...common}><path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z" fill="currentColor" /></svg>
    case 'prev':
      return <svg {...common}><path d="M6 5v14M18 6l-9 6 9 6V6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'next':
      return <svg {...common}><path d="M18 5v14M6 6l9 6-9 6V6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'more':
      return <svg {...common}><path d="M12 6.5h.01M12 12h.01M12 17.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
    case 'music':
      return <svg {...common}><path d="M15 5v10.2a2.8 2.8 0 1 1-2-2.68V7.4l6-1.4v7.2a2.8 2.8 0 1 1-2-2.68V4.5L15 5Z" fill="currentColor" /></svg>
    case 'book':
      return <svg {...common}><path d="M5 5.8A2.8 2.8 0 0 1 7.8 3H20v16H7.8A2.8 2.8 0 0 0 5 21.8v-16Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M5 6a2.8 2.8 0 0 1 2.8-2H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    case 'trash':
      return <svg {...common}><path d="M5 7h14M9 7V5h6v2M8 10l.5 9h7l.5-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    case 'sliders':
      return <svg {...common}><path d="M5 7h14M5 17h14M9 5v4M15 15v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
    case 'settings':
      return <svg {...common}><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="1.8" /><path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a7.2 7.2 0 0 0-1.9-1.1L14.2 3h-4.4l-.4 2.9A7.2 7.2 0 0 0 7.5 7L5.1 6 3.1 9.4l2 1.5a7 7 0 0 0 0 2.2l-2 1.5 2 3.4 2.4-1a7.2 7.2 0 0 0 1.9 1.1l.4 2.9h4.4l.4-2.9a7.2 7.2 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.36.1-.73.1-1.1Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" /></svg>
    case 'list':
      return <svg {...common}><path d="M8 6h11M8 12h11M8 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    case 'folder':
      return <svg {...common}><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5V17A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V7.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
    case 'wave':
      return <svg {...common}><path d="M4 13c2.2 0 2.2-5 4.4-5s2.2 10 4.4 10 2.2-10 4.4-10S19.4 13 22 13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
    case 'shuffle':
      return <svg {...common}><path d="M4 7h3c3 0 4 10 7 10h6M17 14l3 3-3 3M4 17h3c1.2 0 2-.7 2.7-1.7M14.5 7H20M17 4l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'repeat':
      return <svg {...common}><path d="M17 2.5 20.5 6 17 9.5M3.5 11V9a3 3 0 0 1 3-3h14M7 21.5 3.5 18 7 14.5M20.5 13v2a3 3 0 0 1-3 3h-14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    default:
      return null
  }
}

function clampStep(value: number, min: number, max: number, step: number) {
  const snapped = Math.round(value / step) * step
  return Math.min(max, Math.max(min, Number(snapped.toFixed(4))))
}

function makeSaturationCurve(drive: number) {
  const curve = new Float32Array(1024)
  const norm = Math.tanh(drive)
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(drive * x) / norm
  }
  return curve
}

function createCrackleBuffer(ctx: AudioContext) {
  const length = Math.floor(ctx.sampleRate * 3)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.035
  }
  let i = 0
  while (i < length) {
    if (Math.random() < 0.00007) {
      const pop = 0.35 + Math.random() * 0.65
      const decay = 30 + Math.random() * 220
      for (let j = 0; j < decay && i + j < length; j += 1) {
        data[i + j] += pop * (Math.random() * 2 - 1) * Math.exp(-j / (decay * 0.3))
      }
      i += decay
    }
    i += 1
  }
  return buffer
}

let clickCtx: AudioContext | null = null

function playSwitchClick() {
  if (document.documentElement.dataset.theme === 'modern') return
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return
  clickCtx = clickCtx ?? new Ctx()
  const ctx = clickCtx
  void ctx.resume()
  const now = ctx.currentTime
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2600
  band.Q.value = 1.4
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.5, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
  noise.connect(band)
  band.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  const thump = ctx.createOscillator()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(140, now)
  thump.frequency.exponentialRampToValueAtTime(60, now + 0.05)
  const thumpGain = ctx.createGain()
  thumpGain.gain.setValueAtTime(0.25, now)
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
  thump.connect(thumpGain)
  thumpGain.connect(ctx.destination)
  noise.start(now)
  thump.start(now)
  thump.stop(now + 0.08)
}

type KnobProps = {
  label: string
  display: string
  value: number
  min: number
  max: number
  step: number
  small?: boolean
  onChange: (value: number) => void
}

function Knob({ label, display, value, min, max, step, small, onChange }: KnobProps) {
  const drag = useRef<{ pointerId: number; startY: number; startValue: number } | null>(null)
  const angle = -135 + ((value - min) / (max - min)) * 270

  return (
    <div className={`knob ${small ? 'knob-small' : ''}`}>
      <div
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { pointerId: event.pointerId, startY: event.clientY, startValue: value }
        }}
        onPointerMove={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return
          const travel = ((drag.current.startY - event.clientY) / 150) * (max - min)
          onChange(clampStep(drag.current.startValue + travel, min, max, step))
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight') onChange(clampStep(value + step, min, max, step))
          if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') onChange(clampStep(value - step, min, max, step))
        }}
      >
        <i style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <b>{display}</b>
      <span>{label}</span>
    </div>
  )
}

function Switch({ label, state, active, disabled, onToggle }: { label: string; state?: string; active: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`switch ${active ? 'on' : ''}`}
      disabled={disabled}
      onClick={() => {
        playSwitchClick()
        onToggle()
      }}
      aria-pressed={active}
    >
      <span className="switch-plate" aria-hidden />
      <span className="switch-text">
        <span>{label}</span>
        <small>{state ?? (active ? 'вкл' : 'выкл')}</small>
      </span>
      <span className="switch-lamp" aria-hidden />
    </button>
  )
}

function Fader({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const ratio = (value - min) / (max - min)

  const applyPointer = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const next = min + (1 - (clientY - rect.top) / rect.height) * (max - min)
    onChange(clampStep(next, min, max, 1))
  }

  return (
    <div
      ref={trackRef}
      className="fader"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        dragging.current = true
        applyPointer(event.clientY)
      }}
      onPointerMove={(event) => { if (dragging.current) applyPointer(event.clientY) }}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') onChange(clampStep(value + 1, min, max, 1))
        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') onChange(clampStep(value - 1, min, max, 1))
      }}
    >
      <i className="fader-slot" />
      <i className="fader-cap" style={{ bottom: `calc((100% - 22px) * ${ratio})` }} />
    </div>
  )
}

function SeekBar({ current, duration, onSeek }: { current: number; duration: number; onSeek: (time: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const ratio = duration > 0 ? Math.min(current / duration, 1) : 0

  const applyPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || !duration) return
    const next = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onSeek(next * duration)
  }

  return (
    <div
      ref={trackRef}
      className="seek"
      role="slider"
      tabIndex={0}
      aria-label="Позиция"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(current)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        dragging.current = true
        applyPointer(event.clientX)
      }}
      onPointerMove={(event) => { if (dragging.current) applyPointer(event.clientX) }}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') onSeek(Math.min(duration, current + 5))
        if (event.key === 'ArrowLeft') onSeek(Math.max(0, current - 5))
      }}
    >
      <i className="seek-rail" />
      <i className="seek-fill" style={{ width: `${ratio * 100}%` }} />
      <i className="seek-thumb" style={{ left: `calc((100% - 18px) * ${ratio})` }} />
    </div>
  )
}

type PlayerState = {
  tracks: Track[]
  folders: Folder[]
  playlists: Playlist[]
  presets: EqPreset[]
  theme: Theme
  activeFolderId: string
  activePlaylistId: string
  yandexBridge: string
  yandexToken: string
  listenBrainzToken: string
  scanFolders: string[]
}

const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
const defaultGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const storageKey = 'analog-player-state-v1'
const dbName = 'analog-player-files'
const storeName = 'audio'

const factoryPresets: EqPreset[] = [
  { id: 'flat', name: 'Ровно', gains: [...defaultGains] },
  { id: 'warm-vinyl', name: 'Теплая пластинка', gains: [4, 3, 2, 1, 0, 0, 1, 2, 2, 1] },
  { id: 'bass', name: 'Бас', gains: [6, 5, 4, 1, 0, -1, -2, -2, -1, 0] },
  { id: 'vocal', name: 'Вокал', gains: [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1] },
  { id: 'book', name: 'Аудиокнига', gains: [-4, -3, -1, 3, 5, 5, 3, 0, -3, -5] },
]

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

function trackName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

function decodeSynchsafe(bytes: Uint8Array) {
  return (bytes[0] << 21) | (bytes[1] << 14) | (bytes[2] << 7) | bytes[3]
}

function fixCyrillicMojibake(value: string) {
  if (!/[À-ÿ]{2}/.test(value)) return value
  const chars = [...value]
  if (chars.some((char) => char.charCodeAt(0) > 0xff)) return value
  const bytes = new Uint8Array(chars.map((char) => char.charCodeAt(0)))
  try {
    const decoded = new TextDecoder('windows-1251').decode(bytes)
    return /[а-яё]/i.test(decoded) ? decoded : value
  } catch {
    return value
  }
}

function decodeTextFrame(bytes: Uint8Array) {
  if (!bytes.length) return ''
  const encoding = bytes[0]
  const body = bytes.slice(1)
  if (encoding === 1 || encoding === 2) {
    const bigEndian = !(body[0] === 0xff && body[1] === 0xfe)
    const offset = body[0] === 0xff || body[0] === 0xfe ? 2 : 0
    const values: number[] = []
    for (let i = offset; i + 1 < body.length; i += 2) {
      const code = bigEndian ? (body[i] << 8) | body[i + 1] : body[i] | (body[i + 1] << 8)
      if (code === 0) break
      values.push(code)
    }
    return String.fromCharCode(...values).trim()
  }
  try {
    const decoded = new TextDecoder(encoding === 3 ? 'utf-8' : 'iso-8859-1').decode(body).replace(/\0/g, '').trim()
    return encoding === 3 ? decoded : fixCyrillicMojibake(decoded)
  } catch {
    return new TextDecoder().decode(body).replace(/\0/g, '').trim()
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk))
  }
  return btoa(binary)
}

function parsePictureFrame(bytes: Uint8Array) {
  if (!bytes.length) return undefined
  const encoding = bytes[0]
  let cursor = 1
  let mime = ''
  while (cursor < bytes.length && bytes[cursor] !== 0) {
    mime += String.fromCharCode(bytes[cursor])
    cursor += 1
  }
  cursor += 2
  if (encoding === 1 || encoding === 2) {
    while (cursor + 1 < bytes.length && !(bytes[cursor] === 0 && bytes[cursor + 1] === 0)) cursor += 2
    cursor += 2
  } else {
    while (cursor < bytes.length && bytes[cursor] !== 0) cursor += 1
    cursor += 1
  }
  const image = bytes.slice(cursor)
  if (!mime || !image.length) return undefined
  return `data:${mime};base64,${bytesToBase64(image)}`
}

async function readAudioMetadata(file: File) {
  const fallback = {
    title: trackName(file.name),
    artist: 'Неизвестный исполнитель',
    album: 'Локальные файлы',
    cover: undefined as string | undefined,
    duration: 0,
  }

  const header = new Uint8Array(await file.slice(0, 10).arrayBuffer())
  if (String.fromCharCode(...header.slice(0, 3)) !== 'ID3') return fallback

  const version = header[3]
  const tagSize = decodeSynchsafe(header.slice(6, 10))
  const tag = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer())
  const meta = { ...fallback }
  let cursor = 0

  while (cursor + 10 <= tag.length) {
    const id = String.fromCharCode(...tag.slice(cursor, cursor + 4))
    if (!id.trim() || /^\0+$/.test(id)) break
    const sizeBytes = tag.slice(cursor + 4, cursor + 8)
    const size = version === 4 ? decodeSynchsafe(sizeBytes) : (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]
    if (size <= 0 || cursor + 10 + size > tag.length) break
    const payload = tag.slice(cursor + 10, cursor + 10 + size)

    if (id === 'TIT2') meta.title = decodeTextFrame(payload) || meta.title
    if (id === 'TPE1') meta.artist = decodeTextFrame(payload) || meta.artist
    if (id === 'TALB') meta.album = decodeTextFrame(payload) || meta.album
    if (id === 'APIC' && !meta.cover) meta.cover = parsePictureFrame(payload)

    cursor += 10 + size
  }

  return meta
}

async function readAudioDuration(file: File) {
  return new Promise<number>((resolve) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    audio.src = url
  })
}

function initialState(): PlayerState {
  const stored = localStorage.getItem(storageKey)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as PlayerState
      return {
        ...parsed,
        tracks: (parsed.tracks ?? []).map((track) => ({
          ...track,
          title: fixCyrillicMojibake(track.title),
          artist: fixCyrillicMojibake(track.artist),
          album: fixCyrillicMojibake(track.album),
        })),
        presets: parsed.presets.length ? parsed.presets : factoryPresets,
        yandexBridge: parsed.yandexBridge ?? '',
        yandexToken: parsed.yandexToken ?? '',
        listenBrainzToken: parsed.listenBrainzToken ?? '',
        scanFolders: parsed.scanFolders ?? ['Music', 'Download'],
      }
    } catch {
      localStorage.removeItem(storageKey)
    }
  }

  const folderId = 'folder-main'
  const playlistId = 'playlist-favorites'
  return {
    tracks: [],
    folders: [{ id: folderId, name: 'Медиатека' }],
    playlists: [{ id: playlistId, name: 'Избранное', trackIds: [] }],
    presets: factoryPresets,
    theme: 'vintage',
    activeFolderId: 'all',
    activePlaylistId: 'all',
    yandexBridge: '',
    yandexToken: '',
    listenBrainzToken: '',
    scanFolders: ['Music', 'Download'],
  }
}

function openAudioDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveAudioBlob(key: string, blob: Blob) {
  const db = await openAudioDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function loadAudioBlob(key: string) {
  const db = await openAudioDb()
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result as Blob | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return blob
}

async function deleteAudioBlob(key: string) {
  const db = await openAudioDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const filtersRef = useRef<BiquadFilterNode[]>([])
  const vuAnalyserRef = useRef<{ left: AnalyserNode; right: AnalyserNode } | null>(null)
  const warmthNodesRef = useRef<{ shaper: WaveShaperNode; tone: BiquadFilterNode; crackleGain: GainNode } | null>(null)
  const scrobbleRef = useRef<{ trackId: string; startedAt: number; sent: boolean } | null>(null)
  const sleepFadingRef = useRef(false)
  const objectUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const playlistInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  const navigationRef = useRef<LibraryLocation[]>([])
  const restoringNavigationRef = useRef(false)

  const [state, setState] = useState(initialState)
  const [view, setView] = useState<View>('tracks')
  const [expandedPlayer, setExpandedPlayer] = useState(false)
  const [detailsTrackId, setDetailsTrackId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('added')
  const [query, setQuery] = useState('')
  const [selectedArtist, setSelectedArtist] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.82)
  const [speed, setSpeed] = useState(1)
  const [repeat, setRepeat] = useState<RepeatMode>('all')
  const [shuffle, setShuffle] = useState(false)
  const [gains, setGains] = useState(defaultGains)
  const [vu, setVu] = useState({ left: 0, right: 0 })
  const [spectrum, setSpectrum] = useState<number[]>(() => Array(20).fill(0))
  const [toast, setToast] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [newPlaylist, setNewPlaylist] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [externalTitle, setExternalTitle] = useState('')
  const [yaPlaylists, setYaPlaylists] = useState<Array<{ kind: string; title: string; count: number | null }>>([])
  const [yaBusy, setYaBusy] = useState('')
  const [yaSearch, setYaSearch] = useState('')
  const [yaResults, setYaResults] = useState<{ tracks: YaTrack[]; albums: YaAlbum[] } | null>(null)
  const [radioQuery, setRadioQuery] = useState('')
  const [newScanFolder, setNewScanFolder] = useState('')
  const [scanStatus, setScanStatus] = useState('')
  const [radioStations, setRadioStations] = useState<RadioStation[]>([])
  const [radioBusy, setRadioBusy] = useState(false)
  const [sleepUntil, setSleepUntil] = useState<number | null>(null)
  const [sleepLeft, setSleepLeft] = useState(0)
  const [warmth, setWarmth] = useState(0)

  const currentTrack = state.tracks.find((track) => track.id === currentId) ?? null

  const visibleTracks = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.tracks
      .filter((track) => state.activeFolderId === 'all' || track.folderId === state.activeFolderId)
      .filter((track) => {
        if (state.activePlaylistId === 'all') return true
        return track.playlistIds.includes(state.activePlaylistId)
      })
      .filter((track) => {
        if (!q) return true
        return `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(q)
      })
      .filter((track) => !selectedArtist || track.artist === selectedArtist)
      .sort((a, b) => {
        if (sortMode === 'title') return a.title.localeCompare(b.title, 'ru')
        if (sortMode === 'artist') return a.artist.localeCompare(b.artist, 'ru') || a.title.localeCompare(b.title, 'ru')
        if (sortMode === 'source') return a.source.localeCompare(b.source) || a.title.localeCompare(b.title, 'ru')
        return b.addedAt - a.addedAt
      })
  }, [query, selectedArtist, sortMode, state.activeFolderId, state.activePlaylistId, state.tracks])

  const bookTracks = useMemo(() => state.tracks.filter((track) => track.kind === 'book'), [state.tracks])
  const artists = useMemo(() => {
    const map = new Map<string, number>()
    state.tracks.forEach((track) => map.set(track.artist, (map.get(track.artist) ?? 0) + 1))
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))
  }, [state.tracks])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
  }, [state.theme])

  useEffect(() => {
    const root = document.documentElement
    const cover = currentTrack?.cover
    if (!cover) {
      root.style.removeProperty('--cover-a')
      root.style.removeProperty('--cover-b')
      return
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 24
        canvas.height = 24
        const context = canvas.getContext('2d')
        if (!context) return
        context.drawImage(img, 0, 0, 24, 24)
        const { data } = context.getImageData(0, 0, 24, 24)
        let r = 0
        let g = 0
        let b = 0
        let count = 0
        let vividR = 103
        let vividG = 212
        let vividB = 255
        let best = -1
        for (let i = 0; i < data.length; i += 4) {
          const red = data[i]
          const green = data[i + 1]
          const blue = data[i + 2]
          r += red
          g += green
          b += blue
          count += 1
          const max = Math.max(red, green, blue)
          const vivid = (max - Math.min(red, green, blue)) * (max / 255)
          if (vivid > best) {
            best = vivid
            vividR = red
            vividG = green
            vividB = blue
          }
        }
        root.style.setProperty('--cover-a', `rgb(${Math.round(r / count)} ${Math.round(g / count)} ${Math.round(b / count)})`)
        root.style.setProperty('--cover-b', `rgb(${vividR} ${vividG} ${vividB})`)
      } catch {
      }
    }
    img.src = cover
    return () => {
      cancelled = true
    }
  }, [currentTrack?.cover])

  const restoreLocation = (location: LibraryLocation) => {
    restoringNavigationRef.current = true
    setView(location.view)
    setQuery(location.query)
    setSelectedArtist(location.selectedArtist)
    setState((prev) => ({
      ...prev,
      activeFolderId: location.activeFolderId,
      activePlaylistId: location.activePlaylistId,
    }))
    window.setTimeout(() => {
      restoringNavigationRef.current = false
    }, 0)
  }

  const resetLibraryFilters = () => {
    setQuery('')
    setSelectedArtist('')
    setState((prev) => ({ ...prev, activeFolderId: 'all', activePlaylistId: 'all' }))
  }

  const handleBackNavigation = () => {
    if (detailsTrackId) {
      setDetailsTrackId(null)
      return
    }
    if (expandedPlayer) {
      setExpandedPlayer(false)
      return
    }
    const history = navigationRef.current
    if (history.length > 1) {
      history.pop()
      restoreLocation(history[history.length - 1])
      return
    }
    if (view !== 'tracks' || query || selectedArtist || state.activeFolderId !== 'all' || state.activePlaylistId !== 'all') {
      restoreLocation({ view: 'tracks', query: '', selectedArtist: '', activeFolderId: 'all', activePlaylistId: 'all' })
    }
  }

  useEffect(() => {
    const next: LibraryLocation = {
      view,
      query,
      selectedArtist,
      activeFolderId: state.activeFolderId,
      activePlaylistId: state.activePlaylistId,
    }
    const key = JSON.stringify(next)
    const history = navigationRef.current
    const last = history[history.length - 1]
    if (restoringNavigationRef.current) {
      if (!last || JSON.stringify(last) !== key) history[history.length - 1] = next
      return
    }
    if (!last || JSON.stringify(last) !== key) {
      history.push(next)
      if (history.length > 50) history.shift()
    }
  }, [query, selectedArtist, state.activeFolderId, state.activePlaylistId, view])

  useEffect(() => {
    const onNativeBack = () => handleBackNavigation()
    window.addEventListener('nativeback' as keyof WindowEventMap, onNativeBack as EventListener)
    return () => window.removeEventListener('nativeback' as keyof WindowEventMap, onNativeBack as EventListener)
  }, [detailsTrackId, expandedPlayer, query, selectedArtist, state.activeFolderId, state.activePlaylistId, view])

  useEffect(() => {
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.playbackRate = speed
  }, [speed, volume])

  useEffect(() => {
    if (!currentTrack) return
    if (nativeSession) {
      void MediaSession.setMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: currentTrack.cover ? [{ src: currentTrack.cover }] : [],
      })
      void MediaSession.setPlaybackState({ playbackState: playing ? 'playing' : 'paused' })
      void MediaSession.setActionHandler({ action: 'play' }, () => void togglePlay())
      void MediaSession.setActionHandler({ action: 'pause' }, () => void togglePlay())
      void MediaSession.setActionHandler({ action: 'previoustrack' }, () => void skip(-1))
      void MediaSession.setActionHandler({ action: 'nexttrack' }, () => void skip(1))
      void MediaSession.setActionHandler({ action: 'seekto' }, (details) => {
        if (audioRef.current && details.seekTime != null) audioRef.current.currentTime = details.seekTime
      })
      void MediaSession.setActionHandler({ action: 'seekbackward' }, () => {
        if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15)
      })
      void MediaSession.setActionHandler({ action: 'seekforward' }, () => {
        if (audioRef.current && duration) audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 30)
      })
      return
    }
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: currentTrack.cover
        ? [
            { src: currentTrack.cover, sizes: '96x96', type: 'image/jpeg' },
            { src: currentTrack.cover, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    })
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    navigator.mediaSession.setActionHandler('play', () => void togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => void togglePlay())
    navigator.mediaSession.setActionHandler('previoustrack', () => void skip(-1))
    navigator.mediaSession.setActionHandler('nexttrack', () => void skip(1))
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15)
    })
    navigator.mediaSession.setActionHandler('seekforward', () => {
      if (audioRef.current && duration) audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 30)
    })
  }, [currentTrack, duration, playing])

  useEffect(() => {
    if (!duration) return
    if (nativeSession) {
      void MediaSession.setPositionState({
        duration,
        playbackRate: speed,
        position: Math.min(currentTime, duration),
      })
      return
    }
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: speed,
        position: Math.min(currentTime, duration),
      })
    } catch {
    }
  }, [currentTime, duration, speed])

  useEffect(() => {
    filtersRef.current.forEach((filter, index) => {
      filter.gain.value = gains[index] ?? 0
    })
  }, [gains])

  useEffect(() => {
    applyWarmth(warmth, playing)
  }, [warmth, playing])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!playing || warmth <= 0) {
      if (!sleepFadingRef.current) {
        audio.playbackRate = speed
        audio.preservesPitch = true
      }
      return
    }
    audio.preservesPitch = false
    let t = 0
    const timer = window.setInterval(() => {
      if (sleepFadingRef.current) return
      t += 0.08
      const depth = 0.0035 * warmth
      const wobble = Math.sin(t * 2 * Math.PI * 0.55) * depth + Math.sin(t * 2 * Math.PI * 3.7) * depth * 0.35
      audio.playbackRate = speed * (1 + wobble)
    }, 80)
    return () => {
      window.clearInterval(timer)
      if (!sleepFadingRef.current) {
        audio.playbackRate = speed
        audio.preservesPitch = true
      }
    }
  }, [playing, speed, warmth])

  useEffect(() => {
    if (!sleepUntil) {
      setSleepLeft(0)
      return
    }
    const update = () => {
      const leftMs = sleepUntil - Date.now()
      setSleepLeft(Math.max(0, leftMs / 60000))
      if (leftMs > 0 || sleepFadingRef.current) return
      sleepFadingRef.current = true
      const audio = audioRef.current
      if (!audio || audio.paused) {
        sleepFadingRef.current = false
        setSleepUntil(null)
        return
      }
      const startRate = audio.playbackRate
      const startVolume = audio.volume
      const hadPreservesPitch = audio.preservesPitch
      audio.preservesPitch = false
      const started = performance.now()
      const step = () => {
        const progress = Math.min(1, (performance.now() - started) / 6000)
        audio.playbackRate = Math.max(0.25, startRate * (1 - 0.5 * progress))
        audio.volume = startVolume * (1 - progress) ** 1.4
        if (progress < 1 && !audio.paused) {
          requestAnimationFrame(step)
        } else {
          audio.pause()
          audio.playbackRate = startRate
          audio.volume = startVolume
          audio.preservesPitch = hadPreservesPitch
          sleepFadingRef.current = false
          setSleepUntil(null)
        }
      }
      requestAnimationFrame(step)
    }
    update()
    const timer = window.setInterval(update, 5000)
    return () => window.clearInterval(timer)
  }, [sleepUntil])

  useEffect(() => {
    if (!playing) {
      setVu({ left: 0, right: 0 })
      setSpectrum(Array(20).fill(0))
      return
    }
    const buffer = new Float32Array(1024)
    const freq = new Uint8Array(512)
    const level = (analyser: AnalyserNode) => {
      analyser.getFloatTimeDomainData(buffer)
      let sum = 0
      for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i]
      return Math.min(1, Math.sqrt(sum / buffer.length) * 3.4)
    }
    const timer = window.setInterval(() => {
      const analysers = vuAnalyserRef.current
      if (!analysers) return
      setVu((prev) => ({
        left: prev.left * 0.55 + level(analysers.left) * 0.45,
        right: prev.right * 0.55 + level(analysers.right) * 0.45,
      }))
      if (state.theme === 'modern') {
        analysers.left.getByteFrequencyData(freq)
        const bars: number[] = []
        for (let i = 0; i < 20; i += 1) {
          const from = Math.max(1, Math.floor(Math.pow(freq.length, i / 20)))
          const to = Math.max(from + 1, Math.floor(Math.pow(freq.length, (i + 1) / 20)))
          let sum = 0
          for (let j = from; j < to; j += 1) sum += freq[j]
          bars.push(sum / (to - from) / 255)
        }
        setSpectrum(bars)
      }
    }, 90)
    return () => window.clearInterval(timer)
  }, [playing, state.theme])

  const persistTrack = (trackId: string, patch: Partial<Track>) => {
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track)),
    }))
  }

  const submitListen = async (track: Track, type: 'playing_now' | 'single', startedAt?: number) => {
    const token = state.listenBrainzToken.trim()
    if (!token || track.kind !== 'music') return
    const payload = {
      listen_type: type,
      payload: [
        {
          ...(type === 'single' ? { listened_at: Math.floor((startedAt ?? Date.now()) / 1000) } : {}),
          track_metadata: {
            artist_name: track.artist,
            track_name: track.title,
            release_name: track.album,
          },
        },
      ],
    }
    try {
      await fetch('https://api.listenbrainz.org/1/submit-listens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify(payload),
      })
    } catch {
    }
  }

  const applyWarmth = (amount: number, audible: boolean) => {
    const nodes = warmthNodesRef.current
    if (!nodes) return
    nodes.shaper.curve = makeSaturationCurve(1 + amount * 3)
    nodes.tone.frequency.value = 20000 - amount * 11500
    nodes.crackleGain.gain.value = audible ? 0.09 * amount ** 1.4 : 0
  }

  const initAudioGraph = () => {
    const audio = audioRef.current
    if (!audio || sourceRef.current) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    audioCtxRef.current = ctx
    sourceRef.current = ctx.createMediaElementSource(audio)
    filtersRef.current = bands.map((frequency, index) => {
      const filter = ctx.createBiquadFilter()
      filter.type = 'peaking'
      filter.frequency.value = frequency
      filter.Q.value = 1.08
      filter.gain.value = gains[index] ?? 0
      return filter
    })
    sourceRef.current.connect(filtersRef.current[0])
    filtersRef.current.forEach((filter, index) => {
      const next = filtersRef.current[index + 1]
      if (next) filter.connect(next)
    })
    const lastFilter = filtersRef.current[filtersRef.current.length - 1]

    const shaper = ctx.createWaveShaper()
    shaper.oversample = '2x'
    shaper.curve = makeSaturationCurve(1)
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 20000
    tone.Q.value = 0.5
    lastFilter.connect(shaper)
    shaper.connect(tone)
    tone.connect(ctx.destination)

    const crackle = ctx.createBufferSource()
    crackle.buffer = createCrackleBuffer(ctx)
    crackle.loop = true
    const crackleGain = ctx.createGain()
    crackleGain.gain.value = 0
    crackle.connect(crackleGain)
    crackleGain.connect(ctx.destination)
    crackle.start()
    warmthNodesRef.current = { shaper, tone, crackleGain }

    const stereo = ctx.createGain()
    stereo.channelCount = 2
    stereo.channelCountMode = 'explicit'
    const splitter = ctx.createChannelSplitter(2)
    const left = ctx.createAnalyser()
    const right = ctx.createAnalyser()
    left.fftSize = 1024
    right.fftSize = 1024
    tone.connect(stereo)
    crackleGain.connect(stereo)
    stereo.connect(splitter)
    splitter.connect(left, 0)
    splitter.connect(right, 1)
    vuAnalyserRef.current = { left, right }
    applyWarmth(warmth, playing)
  }

  const playTrack = async (track: Track, resume = false) => {
    const audio = audioRef.current
    if (!audio) return
    initAudioGraph()
    await audioCtxRef.current?.resume()

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    if (track.source === 'local') {
      if (!track.audioKey) return
      const blob = await loadAudioBlob(track.audioKey)
      if (!blob) {
        setToast('Файл не найден в локальном хранилище')
        return
      }
      objectUrlRef.current = URL.createObjectURL(blob)
      audio.src = objectUrlRef.current
    } else if (track.externalUrl) {
      audio.src = track.externalUrl
    }

    setCurrentId(track.id)
    audio.playbackRate = speed
    audio.load()
    if (resume && track.position) audio.currentTime = track.position
    try {
      await audio.play()
      setPlaying(true)
      scrobbleRef.current = { trackId: track.id, startedAt: Date.now(), sent: false }
      void submitListen(track, 'playing_now')
    } catch {
      setToast('Браузер не дал запустить этот источник')
      setPlaying(false)
    }
  }

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!currentTrack) {
      if (visibleTracks[0]) await playTrack(visibleTracks[0], true)
      return
    }
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    await audioCtxRef.current?.resume()
    await audio.play()
    setPlaying(true)
  }

  const pickNextTrack = (direction: 1 | -1) => {
    const queue = visibleTracks.length ? visibleTracks : state.tracks
    if (!queue.length) return null
    if (!currentTrack) return queue[0]
    if (shuffle && direction === 1) return queue[Math.floor(Math.random() * queue.length)]
    const index = queue.findIndex((track) => track.id === currentTrack.id)
    const nextIndex = index < 0 ? 0 : index + direction
    if (nextIndex >= queue.length) return repeat === 'all' ? queue[0] : null
    if (nextIndex < 0) return repeat === 'all' ? queue[queue.length - 1] : null
    return queue[nextIndex]
  }

  const skip = async (direction: 1 | -1) => {
    const next = pickNextTrack(direction)
    if (next) await playTrack(next, true)
  }

  const onEnded = () => {
    if (currentTrack?.kind === 'book') persistTrack(currentTrack.id, { position: duration })
    if (repeat === 'one' && currentTrack) {
      void playTrack(currentTrack, false)
      return
    }
    void skip(1)
  }

  const onTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    if (currentTrack?.kind === 'book') persistTrack(currentTrack.id, { position: audio.currentTime })
    const scrobble = scrobbleRef.current
    if (scrobble && currentTrack && scrobble.trackId === currentTrack.id && !scrobble.sent) {
      const total = Number.isFinite(audio.duration) ? audio.duration : 0
      if (total > 30 && audio.currentTime > Math.min(240, total / 2)) {
        scrobble.sent = true
        void submitListen(currentTrack, 'single', scrobble.startedAt)
      }
    }
  }

  const buildTrackFromFile = async (file: File, folderId: string, playlistIds: string[], sourcePath?: string): Promise<Track> => {
    const id = makeId('track')
    const meta = await readAudioMetadata(file)
    const duration = await readAudioDuration(file)
    await saveAudioBlob(id, file)
    return {
      id,
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      duration,
      folderId,
      playlistIds,
      kind: file.name.toLowerCase().match(/book|chapter|глава|аудиокнига/) ? 'book' : 'music',
      source: 'local',
      audioKey: id,
      cover: meta.cover,
      sourcePath,
      addedAt: Date.now(),
    }
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const folderId = state.activeFolderId === 'all' ? state.folders[0]?.id : state.activeFolderId
    if (!folderId) return
    const additions: Track[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) continue
      additions.push(await buildTrackFromFile(file, folderId, state.activePlaylistId === 'all' ? [] : [state.activePlaylistId]))
    }
    setState((prev) => ({ ...prev, tracks: [...additions, ...prev.tracks] }))
    setToast(`Добавлено: ${additions.length}`)
    if (!currentTrack && additions[0]) await playTrack(additions[0], true)
  }

  const collectAudioPaths = async (folder: string, found: Array<{ path: string; name: string }>) => {
    const listing = await Filesystem.readdir({ directory: Directory.ExternalStorage, path: folder })
    for (const item of listing.files) {
      const itemPath = `${folder}/${item.name}`
      if (item.type === 'directory') {
        await collectAudioPaths(itemPath, found).catch(() => undefined)
      } else if (audioFileRe.test(item.name)) {
        found.push({ path: itemPath, name: item.name })
      }
    }
  }

  const runFolderScan = async () => {
    if (!nativeSession) {
      dirInputRef.current?.click()
      return
    }
    const folderId = state.activeFolderId === 'all' ? state.folders[0]?.id : state.activeFolderId
    if (!folderId) return
    await Filesystem.requestPermissions().catch(() => undefined)
    const known = new Set(state.tracks.map((track) => track.sourcePath).filter(Boolean))
    let added = 0
    let failed = 0
    setScanStatus('Поиск файлов…')
    for (const folder of state.scanFolders) {
      const found: Array<{ path: string; name: string }> = []
      try {
        await collectAudioPaths(folder.replace(/^\/+|\/+$/g, ''), found)
      } catch {
        setToast(`Папка недоступна: ${folder}`)
        continue
      }
      for (const item of found) {
        if (known.has(item.path)) continue
        setScanStatus(`Импорт: ${item.name}`)
        try {
          const read = await Filesystem.readFile({ directory: Directory.ExternalStorage, path: item.path })
          const ext = item.name.split('.').pop()?.toLowerCase() ?? 'mp3'
          const blob = base64ToBlob(read.data as string, audioMime[ext] ?? 'audio/mpeg')
          const track = await buildTrackFromFile(new File([blob], item.name, { type: blob.type }), folderId, [], item.path)
          known.add(item.path)
          setState((prev) => ({ ...prev, tracks: [track, ...prev.tracks] }))
          added += 1
        } catch {
          failed += 1
        }
      }
    }
    setScanStatus('')
    setToast(added ? `Найдено новых треков: ${added}${failed ? `, ошибок: ${failed}` : ''}` : 'Новых файлов не нашлось')
  }

  const addScannedWebFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const folderId = state.activeFolderId === 'all' ? state.folders[0]?.id : state.activeFolderId
    if (!folderId) return
    const known = new Set(state.tracks.map((track) => track.sourcePath).filter(Boolean))
    let added = 0
    setScanStatus('Импорт…')
    for (const file of Array.from(files)) {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      if (!file.type.startsWith('audio/') && !audioFileRe.test(file.name)) continue
      if (known.has(rel)) continue
      const track = await buildTrackFromFile(file, folderId, [], rel)
      known.add(rel)
      setState((prev) => ({ ...prev, tracks: [track, ...prev.tracks] }))
      added += 1
    }
    setScanStatus('')
    setToast(added ? `Найдено новых треков: ${added}` : 'Новых файлов не нашлось')
  }

  const addFolder = () => {
    const name = newFolder.trim()
    if (!name) return
    const folder = { id: makeId('folder'), name }
    setState((prev) => ({ ...prev, folders: [...prev.folders, folder], activeFolderId: folder.id }))
    setNewFolder('')
  }

  const addPlaylist = () => {
    const name = newPlaylist.trim()
    if (!name) return
    const playlist = { id: makeId('playlist'), name, trackIds: [] }
    setState((prev) => ({ ...prev, playlists: [...prev.playlists, playlist], activePlaylistId: playlist.id }))
    setNewPlaylist('')
  }

  const toggleTrackPlaylist = (trackId: string, playlistId: string) => {
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => {
        if (track.id !== trackId) return track
        const has = track.playlistIds.includes(playlistId)
        return { ...track, playlistIds: has ? track.playlistIds.filter((id) => id !== playlistId) : [...track.playlistIds, playlistId] }
      }),
      playlists: prev.playlists.map((playlist) => {
        if (playlist.id !== playlistId) return playlist
        const has = playlist.trackIds.includes(trackId)
        return { ...playlist, trackIds: has ? playlist.trackIds.filter((id) => id !== trackId) : [...playlist.trackIds, trackId] }
      }),
    }))
  }

  const removeTrack = async (track: Track) => {
    if (track.audioKey) await deleteAudioBlob(track.audioKey)
    if (currentId === track.id) {
      audioRef.current?.pause()
      setCurrentId(null)
      setPlaying(false)
    }
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((item) => item.id !== track.id),
      playlists: prev.playlists.map((playlist) => ({ ...playlist, trackIds: playlist.trackIds.filter((id) => id !== track.id) })),
    }))
  }

  const savePreset = () => {
    const name = window.prompt('Название пресета')
    if (!name?.trim()) return
    const preset = { id: makeId('preset'), name: name.trim(), gains: [...gains] }
    setState((prev) => ({ ...prev, presets: [...prev.presets, preset] }))
    setToast('Пресет сохранен')
  }

  const importPlaylist = async (file: File | undefined) => {
    if (!file) return
    const raw = new Uint8Array(await file.arrayBuffer())
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(raw)
    } catch {
      text = new TextDecoder('windows-1251').decode(raw)
    }

    const name = trackName(file.name)
    const lower = file.name.toLowerCase()
    const entries: Array<{ location: string; title?: string; artist?: string }> = []

    if (lower.endsWith('.pls')) {
      const slots = new Map<number, { location?: string; title?: string }>()
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^(File|Title)(\d+)\s*=\s*(.+)$/i)
        if (!match) continue
        const slot = slots.get(Number(match[2])) ?? {}
        if (match[1].toLowerCase() === 'file') slot.location = match[3].trim()
        else slot.title = match[3].trim()
        slots.set(Number(match[2]), slot)
      }
      for (const [, slot] of [...slots.entries()].sort((a, b) => a[0] - b[0])) {
        if (slot.location) entries.push({ location: slot.location, title: slot.title })
      }
    } else if (lower.endsWith('.xspf')) {
      const doc = new DOMParser().parseFromString(text, 'text/xml')
      doc.querySelectorAll('track').forEach((node) => {
        const location = node.querySelector('location')?.textContent?.trim()
        if (!location) return
        entries.push({
          location: decodeURIComponent(location.replace(/^file:\/{2,3}/i, '')),
          title: node.querySelector('title')?.textContent?.trim() || undefined,
          artist: node.querySelector('creator')?.textContent?.trim() || undefined,
        })
      })
    } else {
      let pendingTitle: string | undefined
      let pendingArtist: string | undefined
      for (const line of text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
        if (line.toUpperCase().startsWith('#EXTINF')) {
          const meta = line.slice(line.indexOf(',') + 1).trim()
          const dash = meta.split(' - ')
          if (dash.length >= 2) {
            pendingArtist = dash[0].trim()
            pendingTitle = dash.slice(1).join(' - ').trim()
          } else {
            pendingTitle = meta
            pendingArtist = undefined
          }
          continue
        }
        if (line.startsWith('#')) continue
        entries.push({ location: line, title: pendingTitle, artist: pendingArtist })
        pendingTitle = undefined
        pendingArtist = undefined
      }
    }

    if (!entries.length) {
      setToast('В файле не нашлось треков')
      return
    }

    const normalize = (value: string) =>
      value.toLowerCase().replace(/\.[^.]+$/, '').replace(/[_\-–—]+/g, ' ').replace(/\s+/g, ' ').trim()
    const index = new Map<string, Track>()
    for (const track of state.tracks) {
      index.set(normalize(track.title), track)
      index.set(normalize(`${track.artist} ${track.title}`), track)
    }

    const playlistId = makeId('playlist')
    const externals: Track[] = []
    const matchedIds: string[] = []
    let missing = 0

    for (const entry of entries) {
      if (/^https?:\/\//i.test(entry.location)) {
        externals.push({
          id: makeId('track'),
          title: entry.title || decodeURIComponent(entry.location.split('/').pop() || 'External track'),
          artist: entry.artist || 'Внешний источник',
          album: name,
          duration: 0,
          folderId: state.folders[0]?.id ?? 'folder-main',
          playlistIds: [playlistId],
          kind: 'music',
          source: 'external',
          externalUrl: entry.location,
          addedAt: Date.now(),
        })
        continue
      }
      const baseName = entry.location.replace(/\\/g, '/').split('/').pop() || ''
      const candidates = [
        entry.title,
        entry.artist && entry.title ? `${entry.artist} ${entry.title}` : undefined,
        baseName,
      ].filter((value): value is string => Boolean(value))
      const found = candidates.map(normalize).map((key) => index.get(key)).find(Boolean)
      if (found) {
        if (!matchedIds.includes(found.id)) matchedIds.push(found.id)
      } else {
        missing += 1
      }
    }

    if (!matchedIds.length && !externals.length) {
      setToast(`Совпадений нет: сначала добавьте эти файлы в библиотеку (${missing} шт.)`)
      return
    }

    setState((prev) => ({
      ...prev,
      tracks: [
        ...externals,
        ...prev.tracks.map((track) =>
          matchedIds.includes(track.id) && !track.playlistIds.includes(playlistId)
            ? { ...track, playlistIds: [...track.playlistIds, playlistId] }
            : track,
        ),
      ],
      playlists: [...prev.playlists, { id: playlistId, name, trackIds: [...matchedIds, ...externals.map((track) => track.id)] }],
      activePlaylistId: playlistId,
    }))
    setToast(`«${name}»: из библиотеки ${matchedIds.length}, ссылок ${externals.length}${missing ? `, не найдено ${missing}` : ''}`)
  }

  const addExternal = () => {
    const url = externalUrl.trim()
    if (!url) return
    const track: Track = {
      id: makeId('track'),
      title: externalTitle.trim() || 'External stream',
      artist: 'Внешний источник',
      album: 'Подключенные источники',
      duration: 0,
      folderId: state.folders[0]?.id ?? 'folder-main',
      playlistIds: state.activePlaylistId === 'all' ? [] : [state.activePlaylistId],
      kind: 'music',
      source: 'external',
      externalUrl: url,
      addedAt: Date.now(),
    }
    setState((prev) => ({ ...prev, tracks: [track, ...prev.tracks] }))
    setExternalTitle('')
    setExternalUrl('')
  }

  const yandexBase = () => state.yandexBridge.trim().replace(/\/+$/, '')

  const loadYandexPlaylists = async () => {
    const base = yandexBase()
    const token = state.yandexToken.trim()
    if (!base || !token) {
      setToast('Укажите адрес моста и токен')
      return
    }
    setYaBusy('list')
    try {
      const res = await fetch(`${base}/playlists`, { headers: { 'X-Yandex-Token': token } })
      if (!res.ok) throw new Error(String(res.status))
      setYaPlaylists(await res.json())
    } catch {
      setToast('Мост недоступен или токен не принят')
    }
    setYaBusy('')
  }

  const buildYandexTrack = (item: YaTrack, playlistIds: string[], fallbackAlbum: string): Track => ({
    id: makeId('track'),
    title: item.title,
    artist: item.artists,
    album: item.album || fallbackAlbum,
    duration: Math.round((item.durationMs || 0) / 1000),
    folderId: state.folders[0]?.id ?? 'folder-main',
    playlistIds,
    kind: 'music',
    source: 'external',
    externalUrl: `${yandexBase()}/stream/${encodeURIComponent(item.id)}?token=${encodeURIComponent(state.yandexToken.trim())}`,
    cover: item.cover ?? undefined,
    addedAt: Date.now(),
  })

  const importYandexList = async (url: string, playlistName: string, busyKey: string) => {
    setYaBusy(busyKey)
    try {
      const res = await fetch(url, { headers: { 'X-Yandex-Token': state.yandexToken.trim() } })
      if (!res.ok) throw new Error(String(res.status))
      const items = (await res.json()) as YaTrack[]
      if (!items.length) {
        setToast('Нет доступных треков')
        setYaBusy('')
        return
      }
      const playlistId = makeId('playlist')
      const tracks = items.map((item) => buildYandexTrack(item, [playlistId], playlistName))
      setState((prev) => ({
        ...prev,
        tracks: [...tracks, ...prev.tracks],
        playlists: [...prev.playlists, { id: playlistId, name: `ЯМ · ${playlistName}`, trackIds: tracks.map((track) => track.id) }],
        activePlaylistId: playlistId,
      }))
      setToast(`Импортировано треков: ${tracks.length}`)
    } catch {
      setToast('Не удалось получить треки')
    }
    setYaBusy('')
  }

  const importYandexPlaylist = (kind: string, title: string) =>
    importYandexList(`${yandexBase()}/playlists/${kind}/tracks`, title, kind)

  const importYandexAlbum = (album: YaAlbum) =>
    importYandexList(`${yandexBase()}/albums/${album.id}/tracks`, album.title, `album-${album.id}`)

  const searchYandex = async () => {
    const base = yandexBase()
    const token = state.yandexToken.trim()
    const text = yaSearch.trim()
    if (!base || !token) {
      setToast('Укажите адрес моста и токен')
      return
    }
    if (!text) return
    setYaBusy('search')
    try {
      const res = await fetch(`${base}/search?text=${encodeURIComponent(text)}`, { headers: { 'X-Yandex-Token': token } })
      if (!res.ok) throw new Error(String(res.status))
      setYaResults(await res.json())
    } catch {
      setToast('Поиск не удался')
    }
    setYaBusy('')
  }

  const addYandexTrack = (item: YaTrack) => {
    setState((prev) => ({ ...prev, tracks: [buildYandexTrack(item, [], 'Яндекс Музыка'), ...prev.tracks] }))
    setToast(`Добавлено: ${item.title}`)
  }

  const searchRadio = async (params: Record<string, string>) => {
    setRadioBusy(true)
    try {
      const qs = new URLSearchParams({ limit: '25', hidebroken: 'true', is_https: 'true', order: 'votes', reverse: 'true', ...params })
      const res = await fetch(`https://all.api.radio-browser.info/json/stations/search?${qs}`)
      if (!res.ok) throw new Error(String(res.status))
      const stations = (await res.json()) as RadioStation[]
      setRadioStations(stations)
      if (!stations.length) setToast('Станций не нашлось')
    } catch {
      setToast('Каталог радио недоступен')
    }
    setRadioBusy(false)
  }

  const addRadioStation = async (station: RadioStation) => {
    const track: Track = {
      id: makeId('track'),
      title: station.name,
      artist: station.country || 'Интернет-радио',
      album: 'Интернет-радио',
      duration: 0,
      folderId: state.folders[0]?.id ?? 'folder-main',
      playlistIds: [],
      kind: 'music',
      source: 'external',
      externalUrl: station.url_resolved,
      cover: station.favicon || undefined,
      addedAt: Date.now(),
    }
    setState((prev) => ({ ...prev, tracks: [track, ...prev.tracks] }))
    setToast(`Станция добавлена: ${station.name}`)
    await playTrack(track, false)
  }

  const refreshYandexLinks = () => {
    const base = yandexBase()
    const token = state.yandexToken.trim()
    if (!base || !token) {
      setToast('Укажите адрес моста и токен')
      return
    }
    const count = state.tracks.filter((track) => track.externalUrl && /\/stream\//.test(track.externalUrl)).length
    if (!count) {
      setToast('Треков Яндекса в библиотеке нет')
      return
    }
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => {
        const match = track.externalUrl?.match(/\/stream\/([^?]+)/)
        if (!match) return track
        return { ...track, externalUrl: `${base}/stream/${match[1]}?token=${encodeURIComponent(token)}` }
      }),
    }))
    setToast(`Обновлено ссылок: ${count}`)
  }

  const activePreset = state.presets.find((preset) => preset.gains.every((gain, index) => gain === gains[index]))
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const bookProgress = currentTrack?.kind === 'book' && duration > 0 ? Math.round(progress) : 0
  const navItems: Array<{ id: View; label: string; icon: IconName }> = [
    { id: 'tracks', label: 'Треки', icon: 'music' },
    { id: 'playlists', label: 'Плейлисты', icon: 'list' },
    { id: 'folders', label: 'Папки', icon: 'folder' },
    { id: 'artists', label: 'Исполнители', icon: 'wave' },
    { id: 'eq', label: 'EQ', icon: 'sliders' },
    { id: 'settings', label: 'Еще', icon: 'settings' },
  ]

  return (
    <main className="player-app">
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onLoadedMetadata={onTimeUpdate} onEnded={onEnded} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />

      <header className="topbar">
        <div>
          <p className="eyebrow">Resonance</p>
          <h1>Моя музыка</h1>
        </div>
      </header>

      <section className="mini-player">
        <button className="mini-cover-button" aria-label="Открыть проигрыватель" onClick={() => setExpandedPlayer((value) => !value)}>
          {currentTrack?.cover ? <img src={currentTrack.cover} alt="" /> : <Icon name={currentTrack?.kind === 'book' ? 'book' : 'music'} />}
        </button>
        <div className="mini-meta" onClick={() => setExpandedPlayer((value) => !value)}>
          <strong>{currentTrack?.title || 'Ничего не играет'}</strong>
          <span>{currentTrack ? `${currentTrack.artist} · ${currentTrack.album}` : 'Выберите трек из списка'}</span>
        </div>
        <div className="mini-controls">
          <button className="plain-icon" aria-label="Предыдущий трек" onClick={() => void skip(-1)}><Icon name="prev" /></button>
          <button className="plain-icon mini-play" aria-label={playing ? 'Пауза' : 'Играть'} onClick={() => void togglePlay()}><Icon name={playing ? 'pause' : 'play'} size={24} /></button>
          <button className="plain-icon" aria-label="Следующий трек" onClick={() => void skip(1)}><Icon name="next" /></button>
        </div>
        <div className="mini-progress" style={{ width: `${progress}%` }} />
      </section>

      {expandedPlayer && <section
        className={`deck ${state.theme === 'modern' ? 'modern-deck' : 'vintage-deck'}`}
        style={{ '--pulse': ((vu.left + vu.right) / 2).toFixed(3) } as CSSProperties}
      >
        <div className="cover-stage">
          {state.theme === 'vintage' ? (
            <>
              <div className="record" style={{ animationPlayState: playing ? 'running' : 'paused' }}>
                {currentTrack?.cover ? <img src={currentTrack.cover} alt="" /> : null}
                <div className="record-label">
                  <span>{currentTrack?.album || 'Локальные файлы'}</span>
                </div>
              </div>
              <div className="tonearm" data-playing={playing} />
            </>
          ) : (
            <div
              className="modern-cover-wrap"
              style={{ animationPlayState: playing ? 'running' : 'paused' }}
              onPointerMove={(event) => {
                const target = event.currentTarget.firstElementChild as HTMLElement | null
                if (!target) return
                const rect = event.currentTarget.getBoundingClientRect()
                const x = (event.clientX - rect.left) / rect.width - 0.5
                const y = (event.clientY - rect.top) / rect.height - 0.5
                target.style.transform = `rotateY(${(x * 16).toFixed(1)}deg) rotateX(${(-y * 16).toFixed(1)}deg)`
              }}
              onPointerLeave={(event) => {
                const target = event.currentTarget.firstElementChild as HTMLElement | null
                if (target) target.style.transform = ''
              }}
            >
              <div className="modern-cover">
                {currentTrack?.cover ? <img src={currentTrack.cover} alt="" /> : <span>♪</span>}
              </div>
            </div>
          )}
        </div>

        <div className="now-panel">
          <div className="panel-head">
            <div className="track-meta">
              <p>{currentTrack?.artist || 'Выберите трек'}</p>
              <h2>{currentTrack?.title || 'Плеер готов'}</h2>
              <span>{currentTrack?.album || 'Локальная библиотека и внешние источники'}</span>
            </div>
            <span className={`power-lamp ${playing ? 'on' : ''}`} aria-hidden />
          </div>

          {state.theme === 'vintage' ? (
            <div className="meters">
              <div className="vu">
                <span>VU L</span>
                <i style={{ transform: `rotate(${-38 + (vu.left * 72)}deg)` }} />
              </div>
              <div className="vu">
                <span>VU R</span>
                <i style={{ transform: `rotate(${-38 + (vu.right * 72)}deg)` }} />
              </div>
            </div>
          ) : (
            <div className="spectrum" aria-hidden>
              {spectrum.map((bar, index) => (
                <i key={index} style={{ height: `${Math.round((0.06 + bar * 0.94) * 100)}%` }} />
              ))}
            </div>
          )}

          <div className="transport">
            <button aria-label="Назад" onClick={() => void skip(-1)}><Icon name="prev" /></button>
            <button className="play" aria-label={playing ? 'Пауза' : 'Играть'} onClick={() => void togglePlay()}><Icon name={playing ? 'pause' : 'play'} size={28} /></button>
            <button aria-label="Вперед" onClick={() => void skip(1)}><Icon name="next" /></button>
          </div>

          <div className="timeline">
            <span>{formatTime(currentTime)}</span>
            <SeekBar
              current={Math.min(currentTime, duration || 0)}
              duration={duration}
              onSeek={(time) => {
                if (audioRef.current) audioRef.current.currentTime = time
                setCurrentTime(time)
              }}
            />
            <span>{formatTime(duration)}</span>
          </div>

          <div className="control-board">
            <div className="knob-row">
              <Knob label="Громкость" display={`${Math.round(volume * 100)}%`} value={volume} min={0} max={1} step={0.01} onChange={setVolume} />
              <Knob label="Скорость" display={`${speed.toFixed(2)}x`} value={speed} min={0.5} max={2} step={0.05} onChange={setSpeed} />
              <Knob
                label="Сон"
                display={sleepUntil ? `${Math.max(1, Math.ceil(sleepLeft))} мин` : 'выкл'}
                value={sleepUntil ? Math.min(90, sleepLeft) : 0}
                min={0}
                max={90}
                step={5}
                onChange={(value) => setSleepUntil(value > 0 ? Date.now() + value * 60000 : null)}
              />
              <Knob
                label="Прогрев"
                display={warmth > 0 ? `${Math.round(warmth * 100)}%` : 'выкл'}
                value={warmth}
                min={0}
                max={1}
                step={0.05}
                onChange={setWarmth}
              />
            </div>
            <div className="switch-row">
              <Switch label="Случайно" active={shuffle} onToggle={() => setShuffle((value) => !value)} />
              <Switch
                label="Повтор"
                state={repeat === 'off' ? 'выкл' : repeat === 'all' ? 'все' : 'трек'}
                active={repeat !== 'off'}
                onToggle={() => setRepeat((value) => (value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'))}
              />
              <Switch
                label="Книга"
                active={currentTrack?.kind === 'book'}
                disabled={!currentTrack}
                onToggle={() => currentTrack && persistTrack(currentTrack.id, { kind: currentTrack.kind === 'book' ? 'music' : 'book' })}
              />
            </div>
          </div>
        </div>
      </section>}

      <nav className="bottom-nav" aria-label="Разделы">
        {navItems.map((item) => (
          <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)} aria-label={item.label}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {view === 'tracks' && (
        <section className="workspace tracks-view">
          <input ref={fileInputRef} type="file" accept="audio/*" multiple hidden onChange={(event) => void addFiles(event.target.files)} />

          <div className="track-list">
            <div className="list-tools">
              <button className="primary add-audio" onClick={() => fileInputRef.current?.click()}>
                <Icon name="plus" size={18} /> Добавить
              </button>
              <input className="search" value={query} onChange={(event) => { setQuery(event.target.value); if (selectedArtist) setSelectedArtist('') }} placeholder="Поиск по библиотеке" />
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Сортировка">
                <option value="added">Недавние</option>
                <option value="title">По названию</option>
                <option value="artist">По исполнителю</option>
                <option value="source">По источнику</option>
              </select>
            </div>
            {(selectedArtist || query || state.activeFolderId !== 'all' || state.activePlaylistId !== 'all') && (
              <div className="filter-strip">
                <span>{selectedArtist ? `Исполнитель: ${selectedArtist}` : query ? `Поиск: ${query}` : 'Фильтр медиатеки'}</span>
                <button onClick={resetLibraryFilters}>Все треки</button>
              </div>
            )}
            {visibleTracks.length === 0 && <div className="empty">Пока пусто. Добавьте аудиофайлы или импортируйте внешний плейлист.</div>}
            {visibleTracks.map((track) => (
              <article key={track.id} className={`track-row ${track.id === currentId ? 'active' : ''}`}>
                <button className="row-play plain-icon" onClick={() => void playTrack(track, true)} aria-label={track.id === currentId && playing ? 'Пауза' : 'Играть'}>
                  <Icon name={track.id === currentId && playing ? 'pause' : 'play'} />
                </button>
                <div className="mini-cover">{track.cover ? <img src={track.cover} alt="" /> : <Icon name={track.kind === 'book' ? 'book' : 'music'} />}</div>
                <div className="row-main">
                  <h3>{track.title}</h3>
                  <p>{track.artist} · {track.album}</p>
                </div>
                <button className="plain-icon row-more" aria-label="Действия" onClick={() => setDetailsTrackId((id) => id === track.id ? null : track.id)}><Icon name="more" /></button>
                {detailsTrackId === track.id && (
                  <div className="track-actions">
                    <select value={track.folderId} onChange={(event) => persistTrack(track.id, { folderId: event.target.value })} aria-label="Папка">
                      {state.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                    </select>
                    <select value="" onChange={(event) => event.target.value && toggleTrackPlaylist(track.id, event.target.value)} aria-label="Плейлист">
                      <option value="">Добавить в плейлист</option>
                      {state.playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{track.playlistIds.includes(playlist.id) ? '✓ ' : ''}{playlist.name}</option>)}
                    </select>
                    <button className="ghost" onClick={() => persistTrack(track.id, { kind: track.kind === 'book' ? 'music' : 'book' })}><Icon name={track.kind === 'book' ? 'book' : 'music'} /> {track.kind === 'book' ? 'Книга' : 'Музыка'}</button>
                    <button className="danger text-action" onClick={() => void removeTrack(track)}><Icon name="trash" /> Удалить</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {view === 'artists' && (
        <section className="workspace manager-view">
          <div className="manager wide">
            <h3>Исполнители</h3>
            <button onClick={() => { resetLibraryFilters(); setView('tracks') }}>
              <span>Все треки</span>
              <small>{state.tracks.length}</small>
            </button>
            {artists.map(([artist, count]) => (
              <button key={artist} onClick={() => { setSelectedArtist(artist); setQuery(''); setView('tracks') }}>
                <span>{artist}</span>
                <small>{count}</small>
              </button>
            ))}
            {artists.length === 0 && <div className="empty">Исполнители появятся после добавления треков.</div>}
          </div>
        </section>
      )}

      {view === 'playlists' && (
        <section className="workspace manager-view">
          <div className="manager wide">
            <h3>Плейлисты</h3>
            <button className={state.activePlaylistId === 'all' ? 'active' : ''} onClick={() => setState((prev) => ({ ...prev, activePlaylistId: 'all' }))}>Все треки</button>
            {state.playlists.map((playlist) => (
              <button key={playlist.id} className={state.activePlaylistId === playlist.id ? 'active' : ''} onClick={() => setState((prev) => ({ ...prev, activePlaylistId: playlist.id }))}>
                <span>{playlist.name}</span>
                <small>{playlist.trackIds.length}</small>
              </button>
            ))}
            <div className="inline-form">
              <input value={newPlaylist} onChange={(event) => setNewPlaylist(event.target.value)} placeholder="Новый плейлист" />
              <button onClick={addPlaylist}>+</button>
            </div>
          </div>
        </section>
      )}

      {view === 'folders' && (
        <section className="workspace manager-view">
          <div className="manager wide">
            <h3>Папки</h3>
            <button className={state.activeFolderId === 'all' ? 'active' : ''} onClick={() => setState((prev) => ({ ...prev, activeFolderId: 'all' }))}>Все треки</button>
            {state.folders.map((folder) => (
              <button key={folder.id} className={state.activeFolderId === folder.id ? 'active' : ''} onClick={() => setState((prev) => ({ ...prev, activeFolderId: folder.id }))}>
                <span>{folder.name}</span>
                <small>{state.tracks.filter((track) => track.folderId === folder.id).length}</small>
              </button>
            ))}
            <div className="inline-form">
              <input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder="Новая папка" />
              <button onClick={addFolder}>+</button>
            </div>
          </div>
        </section>
      )}

      {view === 'eq' && (
        <section className="workspace eq-view">
          <div className="eq-head">
            <div>
              <p className="eyebrow">Эквалайзер</p>
              <h2>{activePreset?.name ?? 'Свой'}</h2>
            </div>
            <div className="eq-actions">
              <button onClick={() => setGains(defaultGains)}>Ровно</button>
              <button className="primary" onClick={savePreset}>Сохранить</button>
            </div>
          </div>
          <div className="preset-strip">
            {state.presets.map((preset) => (
              <button key={preset.id} className={activePreset?.id === preset.id ? 'active' : ''} onClick={() => setGains([...preset.gains])}>{preset.name}</button>
            ))}
          </div>
          <div className={`equalizer ${state.theme === 'vintage' ? 'radio-eq' : ''}`}>
            {bands.map((band, index) => {
              const bandLabel = band >= 1000 ? `${band / 1000}k` : `${band}`
              const gainLabel = `${gains[index] > 0 ? `+${gains[index]}` : gains[index]} dB`
              const setBand = (value: number) => setGains((prev) => prev.map((gain, gainIndex) => (gainIndex === index ? value : gain)))
              return state.theme === 'vintage' ? (
                <Knob key={band} small label={bandLabel} display={gainLabel} value={gains[index]} min={-12} max={12} step={1} onChange={setBand} />
              ) : (
                <div key={band} className="eq-band">
                  <span>{gainLabel}</span>
                  <Fader label={`${band} Гц`} value={gains[index]} min={-12} max={12} onChange={setBand} />
                  <b>{bandLabel}</b>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {view === 'modes' && (
        <section className="workspace book-view">
          <div className="book-dashboard">
            <div className="book-gauge">
              <div style={{ transform: `rotate(${bookProgress * 1.8 - 90}deg)` }} />
              <span>{bookProgress}%</span>
            </div>
            <div>
              <p className="eyebrow">Аудиокниги</p>
              <h2>{currentTrack?.kind === 'book' ? currentTrack.title : 'Выберите аудиокнигу'}</h2>
              <p>Позиция сохраняется автоматически.</p>
              <div className="book-controls">
                <button onClick={() => audioRef.current && (audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15))}>-15 сек</button>
                <button onClick={() => setGains(factoryPresets.find((preset) => preset.id === 'book')?.gains ?? defaultGains)}>Голосовой EQ</button>
                <button onClick={() => audioRef.current && (audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 30))}>+30 сек</button>
              </div>
            </div>
          </div>
          <div className="book-list">
            {bookTracks.map((track) => (
              <button key={track.id} className={track.id === currentId ? 'active' : ''} onClick={() => void playTrack(track, true)}>
                <span>{track.title}</span>
                <small>{formatTime(track.position ?? 0)}</small>
              </button>
            ))}
            {bookTracks.length === 0 && <div className="empty">Пометьте трек как “Книга”, чтобы он появился здесь.</div>}
          </div>
        </section>
      )}

      {view === 'settings' && (
        <section className="workspace settings-view">
          <div className="source-card">
            <h2>Оформление</h2>
            <div className="theme-switch settings-switch" role="group" aria-label="Тема">
              <button className={state.theme === 'vintage' ? 'active' : ''} onClick={() => setState((prev) => ({ ...prev, theme: 'vintage' }))}>Винтаж</button>
              <button className={state.theme === 'modern' ? 'active' : ''} onClick={() => setState((prev) => ({ ...prev, theme: 'modern' }))}>Современная</button>
            </div>
          </div>
          <div className="source-card">
            <h2>Воспроизведение</h2>
            <div className="switch-row settings-switches">
              <Switch label="Случайно" active={shuffle} onToggle={() => setShuffle((value) => !value)} />
              <Switch
                label="Повтор"
                state={repeat === 'off' ? 'выкл' : repeat === 'all' ? 'все' : 'трек'}
                active={repeat !== 'off'}
                onToggle={() => setRepeat((value) => (value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'))}
              />
            </div>
          </div>
          <div className="source-card">
            <h2>Скробблинг</h2>
            <p>ListenBrainz: токен на listenbrainz.org → Settings.</p>
            <input
              value={state.listenBrainzToken}
              onChange={(event) => setState((prev) => ({ ...prev, listenBrainzToken: event.target.value }))}
              placeholder="Токен ListenBrainz"
              type="password"
              autoComplete="off"
            />
            <p className="hint">{state.listenBrainzToken.trim() ? 'Скробблинг включён' : 'Выключено — история не отправляется'}</p>
          </div>
          <div className="source-card">
            <h2>Разделы</h2>
            <div className="settings-links">
              <button onClick={() => setView('modes')}><Icon name="book" /> Аудиокниги</button>
              <button onClick={() => setView('sources')}><Icon name="plus" /> Источники и импорт</button>
            </div>
          </div>
        </section>
      )}

      {view === 'sources' && (
        <section className="workspace sources-view">
          <div className="source-card">
            <h2>Сканер папок</h2>
            <p>Новые аудиофайлы из этих папок добавятся сами.</p>
            <div className="radio-tags">
              {state.scanFolders.map((folder) => (
                <button
                  key={folder}
                  title="Убрать папку"
                  onClick={() => setState((prev) => ({ ...prev, scanFolders: prev.scanFolders.filter((item) => item !== folder) }))}
                >
                  {folder} ✕
                </button>
              ))}
            </div>
            <div className="ya-search">
              <input
                value={newScanFolder}
                onChange={(event) => setNewScanFolder(event.target.value)}
                placeholder="Например Music или Download/Telegram"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <button
                onClick={() => {
                  const folder = newScanFolder.trim().replace(/^\/+|\/+$/g, '')
                  if (!folder || state.scanFolders.includes(folder)) return
                  setState((prev) => ({ ...prev, scanFolders: [...prev.scanFolders, folder] }))
                  setNewScanFolder('')
                }}
              >
                +
              </button>
            </div>
            <button className="primary" disabled={scanStatus !== ''} onClick={() => void runFolderScan()}>
              {scanStatus || 'Сканировать папки'}
            </button>
            <input
              ref={dirInputRef}
              type="file"
              hidden
              multiple
              onChange={(event) => void addScannedWebFiles(event.target.files)}
              {...({ webkitdirectory: 'true' } as object)}
            />
          </div>
          <div className="source-card">
            <h2>Радио</h2>
            <p>Тап по станции — добавить и слушать.</p>
            <div className="ya-search">
              <input
                value={radioQuery}
                onChange={(event) => setRadioQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && radioQuery.trim() && void searchRadio({ name: radioQuery.trim() })}
                placeholder="Название станции"
              />
              <button disabled={radioBusy} onClick={() => radioQuery.trim() && void searchRadio({ name: radioQuery.trim() })}>
                {radioBusy ? '…' : 'Найти'}
              </button>
            </div>
            <div className="radio-tags">
              {([['джаз', 'jazz'], ['рок', 'rock'], ['ретро', 'oldies'], ['классика', 'classical'], ['лоу-фай', 'lofi'], ['русское', 'russian']] as const).map(([label, tag]) => (
                <button key={tag} disabled={radioBusy} onClick={() => void searchRadio({ tag })}>{label}</button>
              ))}
            </div>
            {radioStations.length > 0 && (
              <div className="ya-playlists ya-results">
                {radioStations.map((station) => (
                  <button key={station.stationuuid} onClick={() => void addRadioStation(station)}>
                    <span>{station.name}</span>
                    <small>{station.bitrate ? `${station.bitrate}k` : station.country}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="source-card">
            <h2>Импорт плейлистов</h2>
            <p>M3U, PLS, XSPF из любого плеера. Локальные файлы ищутся в библиотеке по названию.</p>
            <button className="primary" onClick={() => playlistInputRef.current?.click()}>Импорт плейлиста</button>
            <input ref={playlistInputRef} type="file" accept=".m3u,.m3u8,.pls,.xspf,.txt" hidden onChange={(event) => void importPlaylist(event.target.files?.[0])} />
          </div>
          <div className="source-card">
            <h2>Внешний поток</h2>
            <input value={externalTitle} onChange={(event) => setExternalTitle(event.target.value)} placeholder="Название" />
            <input value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://..." />
            <button onClick={addExternal}>Добавить ссылку</button>
          </div>
          <div className="source-card">
            <h2>Яндекс Музыка</h2>
            <p>Нужен запущенный мост (папка yandex-bridge) и токен.</p>
            <input
              value={state.yandexBridge}
              onChange={(event) => setState((prev) => ({ ...prev, yandexBridge: event.target.value }))}
              placeholder="Адрес моста, например http://192.168.1.10:8977"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
            />
            <input
              value={state.yandexToken}
              onChange={(event) => setState((prev) => ({ ...prev, yandexToken: event.target.value }))}
              placeholder="Токен OAuth Яндекс Музыки"
              type="password"
              autoComplete="off"
            />
            <button className="primary" disabled={yaBusy !== ''} onClick={() => void loadYandexPlaylists()}>
              {yaBusy === 'list' ? 'Загрузка…' : 'Показать плейлисты'}
            </button>
            {yaPlaylists.length > 0 && (
              <div className="ya-playlists">
                {yaPlaylists.map((playlist) => (
                  <button key={playlist.kind} disabled={yaBusy !== ''} onClick={() => void importYandexPlaylist(playlist.kind, playlist.title)}>
                    <span>{yaBusy === playlist.kind ? 'Импорт…' : playlist.title}</span>
                    {playlist.count != null && <small>{playlist.count}</small>}
                  </button>
                ))}
              </div>
            )}
            <div className="ya-search">
              <input
                value={yaSearch}
                onChange={(event) => setYaSearch(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void searchYandex()}
                placeholder="Поиск трека или альбома"
              />
              <button disabled={yaBusy !== ''} onClick={() => void searchYandex()}>{yaBusy === 'search' ? '…' : 'Найти'}</button>
            </div>
            {yaResults && (
              <div className="ya-playlists ya-results">
                {yaResults.tracks.length > 0 && <h3>Треки — тап добавляет в библиотеку</h3>}
                {yaResults.tracks.map((item) => (
                  <button key={item.id} onClick={() => addYandexTrack(item)}>
                    <span>{item.artists} — {item.title}</span>
                    <small>{formatTime(Math.round((item.durationMs || 0) / 1000))}</small>
                  </button>
                ))}
                {yaResults.albums.length > 0 && <h3>Альбомы — тап импортирует целиком</h3>}
                {yaResults.albums.map((album) => (
                  <button key={album.id} disabled={yaBusy !== ''} onClick={() => void importYandexAlbum(album)}>
                    <span>{album.artists ? `${album.artists} — ` : ''}{album.title}{album.year ? ` (${album.year})` : ''}</span>
                    <small>{yaBusy === `album-${album.id}` ? 'Импорт…' : album.count ?? ''}</small>
                  </button>
                ))}
                {yaResults.tracks.length === 0 && yaResults.albums.length === 0 && <div className="empty">Ничего не нашлось</div>}
              </div>
            )}
            <button onClick={refreshYandexLinks}>Обновить ссылки Яндекса</button>
          </div>
        </section>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
