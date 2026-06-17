import { useEffect, useRef, useState, useCallback } from "react";

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

      // ✅ Seek назад/вперёд — единственные действия, которым разрешено
      // повторяться при зажатой клавише (e.repeat = true). Всё остальное
      // (accept/reject/play/next/prev) блокируется на повторе, чтобы не
      // "съедать" треки при удержании клавиши.
      const isSeekKey = code === keys.seekBack || code === keys.seekForward;
      if (e.repeat && !isSeekKey) return;

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