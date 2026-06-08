import { useEffect, useRef, useState, useCallback } from "react";
import { usePlayer } from "@/store/playerStore";
import { useSettings } from "@/store/settingsStore";

const isBrowser = typeof window !== 'undefined';

// ========== useAudioEngine ==========
export function useAudioEngine(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [ready, setReady] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isAudioContextRunning, setIsAudioContextRunning] = useState(false);

  const resetAudioContext = useCallback(async () => {
    if (ctxRef.current) {
      try {
        await ctxRef.current.close();
      } catch(e) {}
      ctxRef.current = null;
    }
    analyserRef.current = null;
    sourceRef.current = null;
    setAnalyser(null);
    setReady(false);
    setIsAudioContextRunning(false);
    console.log('🔄 AudioContext reset');
  }, []);

  const initAudioContext = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !isBrowser) return false;

    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      return true;
    }

    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(el);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNode.smoothingTimeConstant = 0.8;
      src.connect(analyserNode);
      analyserNode.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyserNode;
      sourceRef.current = src;
      
      console.log('✅ Audio engine initialized, analyser created');
      setAnalyser(analyserNode);
      setReady(true);
      return true;
    } catch (err) {
      console.error('❌ Failed to initialize audio engine:', err);
      return false;
    }
  }, [audioRef]);

  const resumeAudioContext = useCallback(async () => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      const inited = await initAudioContext();
      if (!inited) return false;
    }
    
    if (ctxRef.current && ctxRef.current.state === 'suspended') {
      try {
        await ctxRef.current.resume();
        setIsAudioContextRunning(true);
        console.log('✅ AudioContext resumed');
        return true;
      } catch (err) {
        console.error('❌ Failed to resume AudioContext:', err);
        return false;
      }
    } else if (ctxRef.current && ctxRef.current.state === 'running') {
      setIsAudioContextRunning(true);
      return true;
    }
    return false;
  }, [initAudioContext]);

  const ensureAudioContext = useCallback(async () => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      await initAudioContext();
    }
    if (ctxRef.current && ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume();
      setIsAudioContextRunning(true);
      console.log('✅ AudioContext ensured running');
    }
    
    if (analyserRef.current && !analyser) {
      console.log('🔄 Updating analyser state');
      setAnalyser(analyserRef.current);
    }
    
    return analyserRef.current;
  }, [initAudioContext, analyser]);

  useEffect(() => {
    if (!isBrowser) return;

    const onAnyInteraction = async () => {
      await ensureAudioContext();
    };
    
    window.addEventListener("click", onAnyInteraction);
    window.addEventListener("keydown", onAnyInteraction);
    
    return () => {
      window.removeEventListener("click", onAnyInteraction);
      window.removeEventListener("keydown", onAnyInteraction);
    };
  }, [ensureAudioContext]);

  return { 
    analyser: analyser,
    ctx: ctxRef.current, 
    ready, 
    initAudioContext,
    resumeAudioContext, 
    ensureAudioContext,
    resetAudioContext,
    isAudioContextRunning
  };
}

// ========== useTrackUrl ==========
export function useTrackUrl(track: { path: string; url?: string; id?: string; name?: string; status?: string } | undefined) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ FIX: берём функции из стора через ref чтобы они не попадали
  // в зависимости useEffect и не вызывали повторные срабатывания
  const setStatusRef = useRef(usePlayer.getState().setStatus);
  const addBrokenTrackRef = useRef(usePlayer.getState().addBrokenTrack);
  useEffect(() => {
    setStatusRef.current = usePlayer.getState().setStatus;
    addBrokenTrackRef.current = usePlayer.getState().addBrokenTrack;
  });
  // ✅ Счётчик битых файлов подряд
  const brokenCountRef = useRef(0);

  useEffect(() => {
    let revoked: string | undefined;
    let cancelled = false;

    async function load() {
      if (!track) {
        setUrl(undefined);
        setError(null);
        return;
      }

      if (track.url) {
        setUrl(track.url);
        setError(null);
        return;
      }

      // ✅ FIX MOVE MODE: если трек перемещён — файла на диске уже нет
      // "accepted" (Copy) — файл остался, читаем нормально
      if (track.status === 'moved') {
        setUrl(undefined);
        setError(null);
        return;
      }

      const api = isBrowser ? window.electronAPI : null;
      if (!api) {
        console.warn('No electronAPI, cannot load local file:', track.path);
        setUrl(undefined);
        setError('No electronAPI available');
        return;
      }

      // ✅ FIX: запоминаем id и path трека на момент начала загрузки
      // чтобы не применить ошибку к уже другому треку
      const trackId = track.id;
      const trackName = track.name;
      const trackPath = track.path;

      setIsLoading(true);
      try {
        const buf = await api.readFileAsBuffer(trackPath);

        // ✅ FIX: если пока читали файл — трек уже сменился, не применяем результат
        if (cancelled) return;

        const ext = trackPath.split('.').pop()?.toLowerCase();
        // ✅ FIX AIFF: правильный MIME чтобы не ломал соседние треки
        const MIME_MAP: Record<string, string> = {
          mp3: 'audio/mpeg', mp2: 'audio/mpeg', mpa: 'audio/mpeg', mpga: 'audio/mpeg',
          wav: 'audio/wav',
          flac: 'audio/flac',
          aac: 'audio/aac',
          ogg: 'audio/ogg', oga: 'audio/ogg',
          opus: 'audio/opus',
          webm: 'audio/webm',
          mp4: 'audio/mp4', m4a: 'audio/mp4', m4b: 'audio/mp4', m4r: 'audio/mp4', m4p: 'audio/mp4',
          aiff: 'audio/aiff', aif: 'audio/aiff', aifc: 'audio/aiff',
          wma: 'audio/x-ms-wma',
          ape: 'audio/ape',
          wv: 'audio/x-wavpack',
          tta: 'audio/tta',
          alac: 'audio/mp4',
        };
        const mimeType = (ext && MIME_MAP[ext]) || 'audio/mpeg';
        
        const blob = new Blob([buf], { type: mimeType });
        const u = URL.createObjectURL(blob);
        revoked = u;
        
        setUrl(u);
        setError(null);
        brokenCountRef.current = 0; // ✅ сброс счётчика при успешной загрузке
        console.log('✅ Track URL created:', trackName, 'type:', mimeType);
        
      } catch (e) {
        // ✅ FIX: если трек уже сменился — не помечаем новый трек как битый
        if (cancelled) {
          console.warn('⚠️ Load cancelled for:', trackName, '— skipping error handling');
          return;
        }

        console.error('❌ Failed to load track:', trackName, e);
        setError('Failed to load file');
        setUrl(undefined);
        
        // ✅ FIX: помечаем битым только тот трек чей id/path совпадает
        if (trackId && trackName) {
          const currentTracks = usePlayer.getState().tracks;
          const trackInStore = currentTracks.find(t => t.id === trackId && t.path === trackPath);
          if (trackInStore && trackInStore.status !== 'error') {
            console.log('🔴 Marking as broken:', trackName);
            setStatusRef.current(trackId, "error");
            addBrokenTrackRef.current({ id: trackId, name: trackName, path: trackPath });

            // ✅ Логика остановки при битых файлах
            brokenCountRef.current += 1;
            const { brokenStopMode, maxBrokenBeforeStop } = useSettings.getState();
            if (brokenStopMode === 'stop' && brokenCountRef.current >= maxBrokenBeforeStop) {
              console.warn(`🛑 Stopping: ${brokenCountRef.current} broken files in a row`);
              usePlayer.getState().setIsPlaying(false);
              brokenCountRef.current = 0;
            }
          } else {
            console.log('⚠️ Track already handled or not found, skipping:', trackName);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  // ✅ FIX: зависим только от path/url/id — не от функций стора
  }, [track?.path, track?.url, track?.id, track?.status]);

  return { url, error, isLoading };
}

// ========== useKeyboardControls ==========
export function useKeyboardControls(
  handlers: {
    reject: () => void;
    accept: () => void;
    playPause: () => void;
    volumeUp: () => void;
    volumeDown: () => void;
    seekBack: () => void;
    seekForward: () => void;
    prevTrack?: () => void;
    nextTrack?: () => void;
  },
  keys: Record<string, string>,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled || !isBrowser) return;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const code = e.code;
      
      if (code === keys.reject) {
        e.preventDefault();
        e.stopPropagation();
        handlers.reject();
      }
      else if (code === keys.accept) {
        e.preventDefault();
        e.stopPropagation();
        handlers.accept();
      }
      else if (code === keys.playPause) {
        e.preventDefault();
        e.stopPropagation();
        handlers.playPause();
      }
      else if (code === keys.volumeUp) {
        e.preventDefault();
        e.stopPropagation();
        handlers.volumeUp();
      }
      else if (code === keys.volumeDown) {
        e.preventDefault();
        e.stopPropagation();
        handlers.volumeDown();
      }
      else if (code === keys.seekBack) {
        e.preventDefault();
        e.stopPropagation();
        handlers.seekBack();
      }
      else if (code === keys.seekForward) {
        e.preventDefault();
        e.stopPropagation();
        handlers.seekForward();
      }
      else if (code === keys.prevTrack && handlers.prevTrack) {
        e.preventDefault();
        e.stopPropagation();
        handlers.prevTrack();
      }
      else if (code === keys.nextTrack && handlers.nextTrack) {
        e.preventDefault();
        e.stopPropagation();
        handlers.nextTrack();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers, keys, enabled]);
}
