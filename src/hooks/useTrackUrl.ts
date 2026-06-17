import { useState, useEffect, useRef } from "react";
import { usePlayer } from "@/store/playerStore";

const isBrowser = typeof window !== 'undefined';

const MIME_TYPES: Record<string, string> = {
  'mp3': 'audio/mpeg', 'mp2': 'audio/mpeg', 'mpa': 'audio/mpeg', 'mpga': 'audio/mpeg',
  'mp4': 'audio/mp4', 'm4a': 'audio/mp4', 'm4b': 'audio/mp4', 'm4r': 'audio/mp4',
  'wav': 'audio/wav', 'wave': 'audio/wav', 'flac': 'audio/flac', 'aac': 'audio/aac',
  'ogg': 'audio/ogg', 'oga': 'audio/ogg', 'opus': 'audio/ogg; codecs=opus',
  'webm': 'audio/webm', 'wma': 'audio/x-ms-wma',
  'aiff': 'audio/x-aiff', 'aif': 'audio/x-aiff', 'aifc': 'audio/x-aiff',
  'alac': 'audio/mp4',
};

// Глобальный стоп-кран от быстрого листания
let rapidSkipCount = 0;
let rapidSkipTimer: ReturnType<typeof setTimeout> | null = null;
const RAPID_SKIP_THRESHOLD = 6;
const RAPID_SKIP_WINDOW = 1500;
const RAPID_SKIP_COOLDOWN = 2000;

function trackRapidSkip(): boolean {
  rapidSkipCount++;
  if (rapidSkipTimer) clearTimeout(rapidSkipTimer);
  rapidSkipTimer = setTimeout(() => { rapidSkipCount = 0; }, RAPID_SKIP_WINDOW);
  return rapidSkipCount >= RAPID_SKIP_THRESHOLD;
}

// Удаление blob URL с задержкой (аудио успевает переключиться)
const pendingRevokes: Map<string, ReturnType<typeof setTimeout>> = new Map();

function scheduleRevoke(url: string, delayMs = 3000) {
  if (pendingRevokes.has(url)) return;
  const timer = setTimeout(() => {
    URL.revokeObjectURL(url);
    pendingRevokes.delete(url);
  }, delayMs);
  pendingRevokes.set(url, timer);
}

function cancelRevoke(url: string) {
  const timer = pendingRevokes.get(url);
  if (timer) { clearTimeout(timer); pendingRevokes.delete(url); }
}

// ── LRU-кэш готовых blob URL по пути файла ────────────────────────────────────
// Хранит уже прочитанные треки чтобы при возврате не перечитывать с диска.
const URL_CACHE_LIMIT = 6;
const urlCache = new Map<string, { url: string; mime: string }>();
const inFlight = new Set<string>();

function cacheGet(path: string) {
  const entry = urlCache.get(path);
  if (entry) {
    urlCache.delete(path);
    urlCache.set(path, entry);
    cancelRevoke(entry.url);
  }
  return entry;
}

function cacheSet(path: string, url: string, mime: string) {
  const old = urlCache.get(path);
  if (old && old.url !== url) scheduleRevoke(old.url, 0);
  urlCache.set(path, { url, mime });
  while (urlCache.size > URL_CACHE_LIMIT) {
    const oldestKey = urlCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = urlCache.get(oldestKey)!;
    urlCache.delete(oldestKey);
    scheduleRevoke(oldest.url, 3000);
  }
}

async function readTrackToBlobUrl(
  api: NonNullable<typeof window.electronAPI>,
  trackPath: string
): Promise<{ url: string; mime: string }> {
  const ext = trackPath.split('.').pop()?.toLowerCase() || '';
  const isAiff = ext === 'aif' || ext === 'aiff' || ext === 'aifc';

  let buf: ArrayBuffer;
  let mimeType: string;

  if (isAiff && api.readAudioForPlayback) {
    const result = await api.readAudioForPlayback(trackPath);
    buf = result.buffer;
    mimeType = MIME_TYPES[result.ext] || 'audio/wav';
  } else {
    buf = await api.readFileAsBuffer(trackPath);
    mimeType = MIME_TYPES[ext] || 'audio/mpeg';
  }

  const blob = new Blob([buf], { type: mimeType });
  if (blob.size === 0) throw new Error('Empty blob');
  const url = URL.createObjectURL(blob);
  return { url, mime: mimeType };
}

// ── Предзагрузка соседних треков в фоне ──────────────────────────────────────
export function preloadTrack(trackPath: string | undefined) {
  if (!trackPath || !isBrowser) return;
  if (urlCache.has(trackPath) || inFlight.has(trackPath)) return;

  const api = window.electronAPI;
  if (!api) return;

  const ext = trackPath.split('.').pop()?.toLowerCase() || '';
  const isAiff = ext === 'aif' || ext === 'aiff' || ext === 'aifc';
  // AIFF предзагрузку не делаем — конвертация ffmpeg слишком тяжёлая для фона
  if (isAiff) return;

  inFlight.add(trackPath);
  api.getFileInfo(trackPath)
    .then((info) => {
      if (!info || info.size === 0) throw new Error('Empty file');
      return readTrackToBlobUrl(api, trackPath);
    })
    .then(({ url, mime }) => {
      cacheSet(trackPath, url, mime);
      console.log('📦 Preloaded:', trackPath.split(/[/\\]/).pop());
    })
    .catch(() => {
      // best effort — реальная ошибка всплывёт при настоящей загрузке
    })
    .finally(() => {
      inFlight.delete(trackPath);
    });
}

export function useTrackUrl(track: { path: string; url?: string; id?: string; name?: string } | undefined) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevObjectUrlRef = useRef<string | undefined>(undefined);

  const setStatusRef = useRef(usePlayer.getState().setStatus);
  const addBrokenTrackRef = useRef(usePlayer.getState().addBrokenTrack);
  useEffect(() => {
    setStatusRef.current = usePlayer.getState().setStatus;
    addBrokenTrackRef.current = usePlayer.getState().addBrokenTrack;
  });

  useEffect(() => {
    let cancelled = false;

    if (loadDelayRef.current) clearTimeout(loadDelayRef.current);

    // ✅ Если трек уже в кэше — отдаём мгновенно
    if (track && !track.url) {
      const cached = cacheGet(track.path);
      if (cached) {
        setUrl(cached.url);
        setError(null);
        setIsLoading(false);
        prevObjectUrlRef.current = cached.url;
        return;
      }
    }

    loadDelayRef.current = setTimeout(() => {
      if (!cancelled) load();
    }, 80);

    async function load() {
      if (!track) { setUrl(undefined); setError(null); return; }
      if (track.url) { setUrl(track.url); setError(null); return; }

      const api = isBrowser ? window.electronAPI : null;
      if (!api) { setUrl(undefined); setError('No electronAPI'); return; }

      const trackId = track.id;
      const trackName = track.name;
      const trackPath = track.path;

      // Повторная проверка кэша — могла появиться запись пока ждали дебаунс
      const cached = cacheGet(trackPath);
      if (cached) {
        setUrl(cached.url);
        setError(null);
        prevObjectUrlRef.current = cached.url;
        return;
      }

      if (trackRapidSkip()) {
        console.warn(`🛑 Rapid skip! Pausing ${RAPID_SKIP_COOLDOWN}ms`);
        await new Promise(r => setTimeout(r, RAPID_SKIP_COOLDOWN));
        rapidSkipCount = 0;
        if (cancelled) return;
      }

      setIsLoading(true);
      try {
        const fileInfo = await api.getFileInfo(trackPath);
        if (cancelled) return;
        if (!fileInfo || fileInfo.size === 0) throw new Error('File not found or empty');

        const { url: u, mime } = await readTrackToBlobUrl(api, trackPath);
        if (cancelled) {
          scheduleRevoke(u, 0);
          return;
        }

        cacheSet(trackPath, u, mime);

        if (prevObjectUrlRef.current && prevObjectUrlRef.current !== u) {
          scheduleRevoke(prevObjectUrlRef.current, 3000);
        }
        prevObjectUrlRef.current = u;

        setUrl(u);
        setError(null);
        console.log('✅ Blob URL:', trackName, mime);
      } catch (e) {
        if (cancelled) { console.log('⚠️ Cancelled:', trackName); return; }
        console.error('❌ Failed:', trackName, e);
        setError('Failed to load file');
        setUrl(undefined);
        if (trackId && trackName) {
          const stillExists = usePlayer.getState().tracks.find(t => t.id === trackId && t.path === trackPath);
          if (stillExists && stillExists.status !== 'error') {
            setStatusRef.current(trackId, 'error');
            addBrokenTrackRef.current({ id: trackId, name: trackName, path: trackPath });
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    return () => {
      cancelled = true;
      if (loadDelayRef.current) clearTimeout(loadDelayRef.current);
    };
  }, [track?.path, track?.url, track?.id]);

  return { url, error, isLoading };
}
