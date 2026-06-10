import { useRef, useEffect, useState, useCallback, lazy, Suspense } from "react";
import { usePlayer } from "@/store/playerStore";
import { useSettings } from "@/store/settingsStore";
import { useSplitStore } from "@/store/splitStore";
import { useAudioEngine, useTrackUrl, useKeyboardControls } from "@/hooks/useAudioEngine";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, X, RotateCcw, Pencil, Image as ImageIcon } from "lucide-react";
import { Visualizer } from "@/components/Visualizer";
import { CoverEditor } from "@/components/CoverEditor";
import { TagsEditor } from "@/components/TagsEditor";
import { toast } from "sonner";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const WelcomeMessage = lazy(() => new Promise((resolve) => {
  const username = 'Music Lover';
  resolve({
    default: () => (
      <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        Hi, {username}! 
      </h2>
    )
  });
}));

export function PlayerView() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const errorHandledRef = useRef<Set<string>>(new Set());
  const [vizKey, setVizKey] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [showCoverEditor, setShowCoverEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPrefixPanel, setShowPrefixPanel] = useState(false);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [newPrefix, setNewPrefix] = useState("");

  const {
    tracks,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    setStatus,
    addProcessedPath,
    next,
    prev,
    setIsPlaying,
    setTime,
    setDuration,
    setVolume,
    skipToNextValid,
    markCurrentAsPlayed,
    renameTrack,
    setTrackCover,
    addBrokenTrack,
  } = usePlayer();

  const {
    seekStep,
    acceptMode,
    rejectMode,
    rejectedFolder,
    targetFolder,
    autoPlayNext,
    vizEnabled,
    vizMode,
    vizSensitivity,
    performanceMode,
    coverApplyMode,
    showTagsPanel,
    analyzeBpm,
    analyzeKey,
  } = useSettings();

  const { isSplitMode, getBindingByKey, isWaitingForBinding, splitAutoNext } = useSplitStore();

  const currentTrack = tracks[currentIndex];
  const trackWithId = currentTrack ? { ...currentTrack, id: currentTrack.id } : undefined;
  const { url: trackUrl, error: trackError } = useTrackUrl(trackWithId);
  const { analyser, ensureAudioContext, resetAudioContext } = useAudioEngine(audioRef);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshVisualizer = useCallback(() => {
    setVizKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    refreshVisualizer();
  }, [tracks.length, currentIndex, refreshVisualizer]);

  useEffect(() => {
    if (analyser) {
      refreshVisualizer();
    }
  }, [analyser, refreshVisualizer]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // ✅ Автосохранение сессии при смене трека
  const { saveSession } = usePlayer();
  useEffect(() => {
    if (tracks.length > 0) saveSession();
  }, [currentIndex]);

  useEffect(() => {
    if (trackError && currentTrack && currentTrack.status !== "error" && !errorHandledRef.current.has(currentTrack.id)) {
      errorHandledRef.current.add(currentTrack.id);
      setStatus(currentTrack.id, "error");
      addBrokenTrack({ id: currentTrack.id, name: currentTrack.name, path: currentTrack.path });
      toast.error(`Cannot play: ${currentTrack.name}`);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
      resetAudioContext();
      refreshVisualizer();
      setTimeout(() => {
        const { tracks, currentIndex } = usePlayer.getState();
        if (currentIndex < tracks.length - 1) skipToNextValid();
      }, 100);
    }
  }, [trackError, currentTrack, setStatus, skipToNextValid, resetAudioContext, refreshVisualizer, addBrokenTrack]);

  useEffect(() => {
    if (audioRef.current && trackUrl && currentTrack?.status !== "error" && isPlaying) {
      const playTrack = async () => {
        try {
          await ensureAudioContext();
          await new Promise(resolve => setTimeout(resolve, 10));
          await audioRef.current?.play();
        } catch (err) {
          console.error("❌ Auto-play failed:", err);
        }
      };
      playTrack();
    }
  }, [currentIndex, trackUrl, currentTrack?.status, ensureAudioContext, isPlaying]);

  useEffect(() => {
    if (!isSplitMode || isWaitingForBinding) return;
    const handleSplitKey = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const keyCode = e.code;
      const binding = getBindingByKey(keyCode);
      if (binding && currentTrack && currentTrack.status !== "error") {
        e.preventDefault();
        e.stopPropagation();
        const api = window.electronAPI;
        if (api) {
          setIsLoading(true);
          try {
            const result = await api.acceptTrack(currentTrack.path, binding.folderPath, "copy");
            if (result.ok) {
              addProcessedPath(currentTrack.path);
              setStatus(currentTrack.id, "accepted");
              toast.success(`✅ Sent to ${binding.folderName}`);
              if (useSplitStore.getState().splitAutoNext) {
                setTimeout(() => {
                  const { tracks, currentIndex } = usePlayer.getState();
                  if (currentIndex < tracks.length - 1) next();
                }, 100);
              }
            } else {
              throw new Error(result.error || "Failed to send track");
            }
          } catch (err) {
            toast.error(`Failed to send: ${err instanceof Error ? err.message : "Unknown error"}`);
          } finally {
            setIsLoading(false);
          }
        }
      }
    };
    window.addEventListener("keydown", handleSplitKey);
    return () => window.removeEventListener("keydown", handleSplitKey);
  }, [isSplitMode, isWaitingForBinding, getBindingByKey, currentTrack, setStatus, addProcessedPath, next]);

  const keys = useSettings((s) => s.keys);

  useKeyboardControls(
    {
      reject: () => handleReject(),
      accept: () => handleAccept(),
      playPause: () => togglePlay(),
      volumeUp: () => setVolume(Math.min(1, volume + 0.1)),
      volumeDown: () => setVolume(Math.max(0, volume - 0.1)),
      seekBack: () => seekRelative(-seekStep),
      seekForward: () => seekRelative(seekStep),
      prevTrack: () => prev(),
      nextTrack: () => next(),
    },
    keys,
    true
  );

  const togglePlay = async () => {
    if (!trackUrl || currentTrack?.status === "error") {
      if (currentTrack?.status === "error") toast.error("This track is broken, please skip it");
      return;
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await ensureAudioContext();
          await new Promise(resolve => setTimeout(resolve, 10));
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (err) {
          console.error("❌ Play failed:", err);
          toast.error("Cannot play: " + (err as Error).message);
          setStatus(currentTrack.id, "error");
          addBrokenTrack({ id: currentTrack.id, name: currentTrack.name, path: currentTrack.path });
        }
      }
    }
  };

  const seekRelative = (seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    if (audioRef.current) audioRef.current.currentTime = newTime;
    setTime(newTime);
  };

  const handleAccept = useCallback(async () => {
    if (!currentTrack || currentTrack.status === "error") return;
    if (!targetFolder) { toast.error("Please set a target folder first"); return; }
    setIsLoading(true);
    setError(null);
    try {
      const api = window.electronAPI;
      if (api) {
        const result = await api.acceptTrack(currentTrack.path, targetFolder, acceptMode);
        if (result.ok) {
          addProcessedPath(currentTrack.path);
          // "moved" — файл удалён с диска, нельзя вернуться
          // "accepted" — файл скопирован, можно вернуться
          setStatus(currentTrack.id, acceptMode === "move" ? "moved" : "accepted");
          if (coverApplyMode === "onAccept" && currentTrack.cover) {
            await api.updateCoverOnAccept(targetFolder, currentTrack.name, currentTrack.cover);
          }
          // ✅ BPM/Key анализ при Accept
          if ((analyzeBpm || analyzeKey) && (api as any).analyzeBpm) {
            try {
              const dest = acceptMode === "move" ? currentTrack.path : `${targetFolder}/${currentTrack.name}`;
              const tagUpdates: Record<string, string> = {};
              if (analyzeBpm) {
                const bpmResult = await (api as any).analyzeBpm(dest);
                if (bpmResult?.ok) tagUpdates.bpm = bpmResult.bpm;
              }
              if (analyzeKey) {
                const keyResult = await (api as any).analyzeKey(dest);
                if (keyResult?.ok) tagUpdates.initialKey = keyResult.key;
              }
              if (Object.keys(tagUpdates).length > 0) {
                await (api as any).writeFullTags(dest, tagUpdates);
                const parts = [];
                if (tagUpdates.bpm) parts.push("BPM: " + tagUpdates.bpm);
                if (tagUpdates.initialKey) parts.push("Key: " + tagUpdates.initialKey);
                toast.info("🎵 " + parts.join(" | "));
              }
            } catch (err) { console.warn("BPM/Key analysis failed:", err); }
          }
          if (result.skipped) {
            toast.warning(`⚠️ File already exists, skipped: ${currentTrack.name}`);
          } else {
            toast.success(`✅ Accepted: ${currentTrack.name}`);
          }
          setTimeout(() => {
            const { tracks, currentIndex } = usePlayer.getState();
            if (currentIndex < tracks.length - 1) next();
          }, 100);
        } else {
          throw new Error(result.error || "Failed to accept track");
        }
      } else {
        addProcessedPath(currentTrack.path);
        setStatus(currentTrack.id, "accepted");
        toast.success(`✅ Accepted (demo): ${currentTrack.name}`);
        setTimeout(() => {
          const { tracks, currentIndex } = usePlayer.getState();
          if (currentIndex < tracks.length - 1) next();
        }, 100);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      toast.error(`Failed to accept: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentTrack, targetFolder, acceptMode, setStatus, addProcessedPath, next, coverApplyMode]);

  const handleReject = useCallback(async () => {
    if (!currentTrack || currentTrack.status === "error") return;
    setIsLoading(true);
    setError(null);
    try {
      const api = window.electronAPI;
      if (api) {
        const result = await api.rejectTrack(
          currentTrack.path,
          rejectMode,
          rejectMode === "move" ? rejectedFolder || undefined : undefined
        );
        if (result.ok) {
          addProcessedPath(currentTrack.path);
          setStatus(currentTrack.id, "rejected");
          toast.warning(`❌ Skipped: ${currentTrack.name}`);
          setTimeout(() => {
            const { tracks, currentIndex } = usePlayer.getState();
            if (currentIndex < tracks.length - 1) next();
          }, 100);
        } else {
          throw new Error(result.error || "Failed to skip track");
        }
      } else {
        addProcessedPath(currentTrack.path);
        setStatus(currentTrack.id, "rejected");
        toast.warning(`❌ Skipped (demo): ${currentTrack.name}`);
        setTimeout(() => {
          const { tracks, currentIndex } = usePlayer.getState();
          if (currentIndex < tracks.length - 1) next();
        }, 100);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      toast.error(`Failed to skip: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentTrack, rejectMode, rejectedFolder, setStatus, addProcessedPath, next]);

  const handleReset = useCallback(() => {
    if (currentTrack && currentTrack.status !== "error") {
      setStatus(currentTrack.id, "pending");
      toast.info(`Reset: ${currentTrack.name}`);
    }
  }, [currentTrack, setStatus]);

  // ✅ FIX 1: handleRename теперь объявлен правильно — на уровне компонента
  const handleRename = useCallback(async () => {
    if (!currentTrack || !editName.trim()) return;
    const trimmed = editName.trim();
    if (trimmed === currentTrack.name) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      const success = await renameTrack(currentTrack.id, trimmed);
      if (success) {
        toast.success(`Renamed to: ${trimmed}`);
        setIsEditing(false);
      } else {
        toast.error("Failed to rename file");
      }
    } catch (err) {
      toast.error("Error renaming: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  }, [currentTrack, editName, renameTrack]);

  const onTimeUpdate = () => {
    if (audioRef.current) setTime(audioRef.current.currentTime);
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);

  const onEnded = () => {
    markCurrentAsPlayed();
    if (autoPlayNext) {
      const { tracks, currentIndex } = usePlayer.getState();
      if (currentIndex < tracks.length - 1) {
        next();
        setTimeout(() => {
          if (audioRef.current) audioRef.current.play().catch(e => console.log('Auto-play error:', e));
        }, 50);
      } else {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }
  };

  const onError = () => {
    if (currentTrack && currentTrack.status !== "error" && !errorHandledRef.current.has(currentTrack.id)) {
      errorHandledRef.current.add(currentTrack.id);
      setStatus(currentTrack.id, "error");
      addBrokenTrack({ id: currentTrack.id, name: currentTrack.name, path: currentTrack.path });
      toast.error(`Failed to load: ${currentTrack.name}`);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
      resetAudioContext();
      refreshVisualizer();
      setTimeout(() => {
        const { tracks, currentIndex } = usePlayer.getState();
        if (currentIndex < tracks.length - 1) skipToNextValid();
      }, 100);
    }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const handleResize = () => refreshVisualizer();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [refreshVisualizer]);

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center w-full p-8 pt-[15vh]">
        <div className="text-center space-y-4 w-full max-w-[400px]">
          <div className="text-8xl animate-bounce">🎵</div>
          {!isClient ? (
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Hi, Music Lover! 
            </h2>
          ) : (
            <Suspense fallback={
              <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Hi, Music Lover! 
              </h2>
            }>
              <WelcomeMessage />
            </Suspense>
          )}
          <p className="text-xl font-semibold mt-4">No tracks loaded</p>
          <p className="text-sm text-muted-foreground break-words">
            Click <span className="font-mono bg-muted px-2 py-0.5 rounded">"Source folder"</span> to load your music library
          </p>
          <div className="pt-8 text-muted-foreground">
            <p className="text-sm">✨ Ready to sort your music collection ✨</p>
            <p className="text-xs mt-2">🎧 Drag & drop a folder or use the button above</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentTrack && tracks.length > 0) {
    const firstValidIndex = tracks.findIndex(t => t.status !== "error");
    if (firstValidIndex !== -1) {
      const { setIndex } = usePlayer.getState();
      setIndex(firstValidIndex);
    }
    return null;
  }

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 overflow-auto min-h-0">
      {vizEnabled && (
        <div className="mb-4 md:mb-6 flex-shrink-0" key={vizKey}>
          <Visualizer
            analyser={analyser}
            mode={vizMode}
            enabled={isPlaying}
            sensitivity={vizSensitivity}
            perfMode={performanceMode}
            onSeek={(progress) => {
              if (audioRef.current && duration) {
                audioRef.current.currentTime = progress * duration;
              }
            }}
          />
        </div>
      )}

      <div className="text-center mb-4 md:mb-6 flex-shrink-0">
        {isEditing ? (
          <div className="flex items-center justify-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="text-xl md:text-2xl font-bold bg-background border border-border rounded-lg px-3 py-1 text-center focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              disabled={isSaving}
            />
            <Button size="sm" variant="ghost" onClick={handleRename} disabled={isSaving}>✓</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>✗</Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 group">
            <h2 className={cn(
              "text-xl md:text-2xl font-bold mb-1 md:mb-2 transition-all break-words px-2",
              currentTrack?.status === "error" && "text-muted-foreground line-through",
              isPlaying && "text-primary"
            )}>
              {currentTrack?.name || "Unknown"}
            </h2>
            {currentTrack && currentTrack.status !== "error" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                  onClick={() => { setEditName(currentTrack.name.replace(/\.[^.]+$/, "")); setIsEditing(true); }}
                  title="Rename track"
                  disabled={isSaving}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                  onClick={() => setShowCoverEditor(true)}
                  title="Edit cover"
                  disabled={isSaving}
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                  onClick={() => setShowPrefixPanel(p => !p)}
                  title="Prefix manager"
                  disabled={isSaving}
                >
                  <span className="text-xs font-bold text-muted-foreground">[P]</span>
                </Button>
              </>
            )}
          </div>
        )}
        <p className="text-xs md:text-sm text-muted-foreground">
          Track {currentIndex + 1} of {tracks.length}
        </p>
        {currentTrack?.status === "error" && (
          <p className="text-destructive text-xs md:text-sm mt-2 animate-pulse">
            ⚠️ File not found or inaccessible
          </p>
        )}
        {error && (
          <p className="text-destructive text-xs md:text-sm mt-2">{error}</p>
        )}
      </div>

      {currentTrack?.status !== "error" && (
        <audio
          ref={audioRef}
          src={trackUrl}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          onError={onError}
        />
      )}

      <div className="mb-4 md:mb-6 flex-shrink-0">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={([value]) => {
            if (audioRef.current) audioRef.current.currentTime = value;
            setTime(value);
          }}
          className="cursor-pointer"
          disabled={currentTrack?.status === "error"}
        />
        <div className="flex justify-between text-xs md:text-sm text-muted-foreground mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 md:gap-4 mb-4 md:mb-6 flex-shrink-0">
        <div className="flex justify-center gap-2 md:gap-4">
          <Button
            variant="outline"
            size="default"
            onClick={() => seekRelative(-seekStep)}
            disabled={isLoading || currentTrack?.status === "error"}
            className="px-3 md:px-4"
          >
            <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
            <span className="ml-1 md:ml-2 text-xs md:text-sm">-{seekStep}s</span>
          </Button>

          <Button
            size="default"
            onClick={togglePlay}
            disabled={!trackUrl || isLoading || currentTrack?.status === "error"}
            className="w-12 h-12 md:w-16 md:h-16 rounded-full"
          >
            {isPlaying ? <Pause className="w-6 h-6 md:w-8 md:h-8" /> : <Play className="w-6 h-6 md:w-8 md:h-8" />}
          </Button>

          <Button
            variant="outline"
            size="default"
            onClick={() => seekRelative(seekStep)}
            disabled={isLoading || currentTrack?.status === "error"}
            className="px-3 md:px-4"
          >
            <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
            <span className="ml-1 md:ml-2 text-xs md:text-sm">+{seekStep}s</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 w-32 md:w-48">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVolume(volume === 0 ? 0.85 : 0)}
            className="p-1 md:p-2"
          >
            {volume === 0 ? <VolumeX className="w-3 h-3 md:w-4 md:h-4" /> : <Volume2 className="w-3 h-3 md:w-4 md:h-4" />}
          </Button>
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={([value]) => setVolume(value)}
            className="cursor-pointer"
          />
        </div>
      </div>

      <div className="flex justify-center gap-3 md:gap-6 flex-shrink-0 pb-2">
        <Button
          variant="destructive"
          size="default"
          onClick={handleReject}
          disabled={isLoading || currentTrack?.status === "error"}
          className="w-24 md:w-32 text-xs md:text-sm"
        >
          <X className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
          Skip
        </Button>

        <Button
          variant="outline"
          size="default"
          onClick={handleReset}
          disabled={isLoading || currentTrack?.status === "pending" || currentTrack?.status === "error"}
          className="w-24 md:w-32 text-xs md:text-sm"
        >
          <RotateCcw className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
          Reset
        </Button>

        <Button
          variant="default"
          size="default"
          onClick={handleAccept}
          disabled={isLoading || currentTrack?.status === "error"}
          className="w-24 md:w-32 bg-green-600 hover:bg-green-700 text-xs md:text-sm"
        >
          <Heart className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
          Accept
        </Button>
      </div>

      {/* ✅ Prefix Panel */}
      {showPrefixPanel && currentTrack && currentTrack.status !== "error" && (
        <div className="border-t border-border bg-card/40 px-4 py-3 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Filename Prefixes</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowPrefixPanel(false)}>✗</Button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPrefix}
              onChange={e => setNewPrefix(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newPrefix.trim()) {
                  setPrefixes(prev => [...prev, newPrefix.trim()]);
                  setNewPrefix("");
                }
              }}
              placeholder="Type prefix and press Enter"
              className="flex-1 h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => {
              if (newPrefix.trim()) { setPrefixes(prev => [...prev, newPrefix.trim()]); setNewPrefix(""); }
            }}>Add</Button>
          </div>
          {prefixes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prefixes.map((p, i) => (
                <div key={i} className="flex items-center gap-1 bg-primary/10 rounded px-2 py-0.5 text-xs">
                  <span className="font-mono">{p}</span>
                  <button onClick={() => setPrefixes(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">✗</button>
                </div>
              ))}
            </div>
          )}
          {prefixes.length > 0 && (
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                if (!currentTrack) return;
                const prefix = prefixes.join(" ");
                const ext = currentTrack.name.match(/\.[^.]+$/)?.[0] || "";
                const baseName = currentTrack.name.slice(0, currentTrack.name.length - ext.length);
                const newName = prefix + " " + baseName;
                const success = await renameTrack(currentTrack.id, newName);
                if (success) toast.success("Prefix applied");
                else toast.error("Rename failed");
              }}>+ Apply to current</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                const prefix = prefixes.join(" ");
                let ok = 0; let fail = 0;
                for (const t of tracks) {
                  if (t.status === "error" || t.status === "moved") continue;
                  const ext = t.name.match(/\.[^.]+$/)?.[0] || "";
                  const baseName = t.name.slice(0, t.name.length - ext.length);
                  if (baseName.startsWith(prefix)) continue;
                  const success = await renameTrack(t.id, prefix + " " + baseName);
                  if (success) ok++; else fail++;
                }
                toast.success(`Applied to ${ok} tracks${fail > 0 ? ", " + fail + " failed" : ""}`);
              }}>+ Apply to all</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-orange-400 border-orange-400/30 hover:bg-orange-400/10" onClick={async () => {
                if (!currentTrack) return;
                const prefix = prefixes.join(" ") + " ";
                const ext = currentTrack.name.match(/\.[^.]+$/)?.[0] || "";
                const baseName = currentTrack.name.slice(0, currentTrack.name.length - ext.length);
                if (!baseName.startsWith(prefix)) { toast.info("Prefix not found in this track"); return; }
                const newName = baseName.slice(prefix.length);
                const success = await renameTrack(currentTrack.id, newName);
                if (success) toast.success("Prefix removed");
                else toast.error("Failed");
              }}>- Remove from current</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-orange-400 border-orange-400/30 hover:bg-orange-400/10" onClick={async () => {
                const prefix = prefixes.join(" ") + " ";
                let ok = 0; let skip = 0; let fail = 0;
                for (const t of tracks) {
                  if (t.status === "error" || t.status === "moved") continue;
                  const ext = t.name.match(/\.[^.]+$/)?.[0] || "";
                  const baseName = t.name.slice(0, t.name.length - ext.length);
                  if (!baseName.startsWith(prefix)) { skip++; continue; }
                  const success = await renameTrack(t.id, baseName.slice(prefix.length));
                  if (success) ok++; else fail++;
                }
                toast.success("Removed from " + ok + " tracks" + (skip > 0 ? ", " + skip + " skipped" : "") + (fail > 0 ? ", " + fail + " failed" : ""));
              }}>- Remove from all</Button>
            </div>
          )}
        </div>
      )}

      {/* ✅ Tags Panel */}
      {showTagsPanel && currentTrack && currentTrack.status !== "error" && (
        <TagsEditor
          filePath={currentTrack.path}
          trackName={currentTrack.name}
        />
      )}

      {showCoverEditor && currentTrack && (
        <CoverEditor
          currentCover={currentTrack.cover}
          trackName={currentTrack.name}
          trackId={currentTrack.id}
          onSave={async (id, cover) => {
            setIsSaving(true);
            const success = await setTrackCover(id, cover);
            if (success) {
              toast.success("Cover updated");
            } else {
              toast.error("Failed to update cover");
            }
            setIsSaving(false);
          }}
          onClose={() => setShowCoverEditor(false)}
        />
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
